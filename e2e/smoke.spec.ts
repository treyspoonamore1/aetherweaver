import { expect, test, type Page } from '@playwright/test';
import { CONTENT, deedText, inscriptionDef } from '../src/content';
import { DEED_POINTS_MAX, deedPoints } from '../src/meta/deeds';
import { rankOf } from '../src/meta/profile';
import { runWithoutYou } from '../src/sim/counterfactual';
import { parseReplay, runReplay } from '../src/sim/replay';

const START_URL = '/?e2e=1&seed=4242';

function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(err.message));
  return errors;
}

async function enterTraining(page: Page): Promise<void> {
  await page.goto(START_URL);
  await page
    .getByRole('button', { name: /Training Grounds/i })
    .first()
    .click();
  await page.waitForFunction(() => window.__AW__ !== undefined);
  await expect(page.getByTestId('party-frames')).toContainText('Kael');
  // Pointer over the arena so aim/hover input is live.
  await page.mouse.move(640, 300);
}

/** Waits for the sim to advance n ticks. Frame rate varies (SwiftShader), ticks don't. */
async function waitTicks(page: Page, n: number, timeout = 90_000): Promise<void> {
  const start = await page.evaluate(() => window.__AW__!.tick());
  await page.waitForFunction((target) => window.__AW__!.tick() >= target, start + n, { timeout });
}

async function holdKey(page: Page, code: string, ticks: number): Promise<void> {
  await page.keyboard.down(code);
  await waitTicks(page, ticks);
  await page.keyboard.up(code);
}

const weaverOf = (page: Page) =>
  page.evaluate(() => window.__AW__!.snapshot().entities.find((e) => e.kind === 'weaver')!);

test('boots to the title and into the Training Grounds with no console errors', async ({
  page,
}) => {
  const errors = trackErrors(page);
  await page.goto(START_URL);
  await expect(page.getByRole('heading', { name: /Aetherweaver/i })).toBeVisible();
  await page
    .getByRole('button', { name: /Training Grounds/i })
    .first()
    .click();
  await expect(page.getByTestId('game-canvas')).toBeVisible();
  await expect(page.getByTestId('party-frames')).toContainText('Lyra');
  await waitTicks(page, 30);
  expect(errors).toEqual([]);
});

test('real input: movement, Thread by key and frame, Mend ⇄ Empower, Ward', async ({ page }) => {
  await enterTraining(page);
  const z0 = (await weaverOf(page)).z;
  await holdKey(page, 'KeyW', 60);
  expect((await weaverOf(page)).z).toBeLessThan(z0 - 3);

  await page.keyboard.press('Digit2');
  await waitTicks(page, 2);
  expect((await weaverOf(page)).threadSlot).toBe(1);
  await page.getByTestId('party-frames').getByRole('button', { name: /Vexis/ }).first().click();
  await waitTicks(page, 2);
  expect((await weaverOf(page)).threadSlot).toBe(2);
  await page.mouse.click(640, 360, { button: 'right' });
  await waitTicks(page, 2);
  expect((await weaverOf(page)).threadMode).toBe('empower');

  // Ward the threaded hero: the replay records it as a normalised tech command.
  await page.keyboard.press('KeyQ');
  await waitTicks(page, 2);
  const replay = await page.evaluate(() => window.__AW__!.exportReplay());
  const commands = replay.frames.flatMap(([, cmds]) => cmds);
  expect(commands).toContainEqual({ t: 'tech', id: 'ward', slot: 2 });
});

test('a Prelude run: Prep → Map → an autoplayed fight → Result → Draft → Map', async ({ page }) => {
  // A whole fight under SwiftShader (≈ 25 ticks per real second) needs more than the default.
  test.setTimeout(480_000);
  const errors = trackErrors(page);
  await page.goto(START_URL);
  await page.waitForFunction(() => window.__AWRUN__ !== undefined);
  await page.evaluate(() => window.__AWRUN__!.newRun(4242));
  await expect.poll(() => page.evaluate(() => window.__AWRUN__!.phase())).toBe('prep');
  const xpBefore = await page.evaluate(() => window.__AWRUN__!.weaverXp());
  await page
    .getByRole('button', { name: /Embark/i })
    .first()
    .click();
  await expect.poll(() => page.evaluate(() => window.__AWRUN__!.phase())).toBe('map');

  // The first node is always First Light.
  expect(await page.evaluate(() => window.__AWRUN__!.choose())).toBe('skirmish');
  await page.waitForFunction(() => window.__AW__ !== undefined);
  await expect.poll(() => page.evaluate(() => window.__AW__!.encounter().id)).toBe('first_light');
  // The first fight opens with a pausing primer: the sim never runs behind tutorial text.
  const tickBefore = await page.evaluate(() => window.__AW__!.tick());
  await page.waitForTimeout(1000);
  expect(await page.evaluate(() => window.__AW__!.tick())).toBe(tickBefore);
  await page.getByRole('button', { name: /Begin the fight/i }).click();
  const fightConfig = await page.evaluate(() => window.__AW__!.exportReplay().config);
  await page.evaluate(() => window.__AW__!.autoplay('skilled'));
  await page.evaluate(() => window.__AW__!.setDevTimeScale(2));
  // A full fight under SwiftShader takes a while in real time; ticks are what matter.
  await expect
    .poll(() => page.evaluate(() => window.__AWRUN__!.phase()), {
      timeout: 420_000,
      intervals: [2000],
    })
    .toBe('result');
  expect(await page.evaluate(() => window.__AWRUN__!.results())).toBe(1);
  // The fight paid Weaver XP into the profile.
  expect(await page.evaluate(() => window.__AWRUN__!.weaverXp())).toBeGreaterThan(xpBefore);
  // The "without you" re-run ran in a worker and matches Node bit for bit.
  const alone = await page.evaluate(() => window.__AWRUN__!.lastWithoutYou());
  expect(alone).not.toBeNull();
  expect(alone!.hash).toBe(runWithoutYou(fightConfig).hash);
  await page.evaluate(() => window.__AWRUN__!.continue());
  await expect.poll(() => page.evaluate(() => window.__AWRUN__!.phase())).toBe('draft');
  await page.evaluate(() => window.__AWRUN__!.pick(0));
  await expect.poll(() => page.evaluate(() => window.__AWRUN__!.phase())).toBe('map');
  expect(errors).toEqual([]);
});

test('an autoplayed fight in the browser replays bit-exactly in Node', async ({
  page,
}, testInfo) => {
  await enterTraining(page);
  await page.evaluate(() => {
    const hook = window.__AW__!;
    hook.queue({ t: 'debug', op: { op: 'spawnEnemy', defId: 'bell_brute', x: 0, z: -8 } });
    hook.queue({ t: 'debug', op: { op: 'spawnEnemy', defId: 'lamenter', x: 6, z: -12 } });
    hook.queue({ t: 'debug', op: { op: 'spawnEnemy', defId: 'hollow_chorister', x: -5, z: -9 } });
    hook.autoplay('skilled');
  });
  await page.keyboard.press('Digit3');
  await waitTicks(page, 600);
  const replay = await page.evaluate(() => window.__AW__!.exportReplay());
  await testInfo.attach('session.replay.json', {
    body: JSON.stringify(replay),
    contentType: 'application/json',
  });
  expect(replay.frames.length).toBeGreaterThan(10);
  const result = runReplay(parseReplay(JSON.parse(JSON.stringify(replay))));
  expect(result.tick).toBe(replay.finalTick);
  expect(result.hash).toBe(replay.finalHash);
  expect(result.matches).toBe(true);
});

test('perf: a busy fight stays inside the CPU and draw-call budgets', async ({
  page,
}, testInfo) => {
  await enterTraining(page);
  await page.keyboard.press('F3');
  await page.evaluate(() => {
    const hook = window.__AW__!;
    for (let i = 0; i < 10; i++) {
      hook.queue({
        t: 'debug',
        op: { op: 'spawnEnemy', defId: 'hollow_chorister', x: -9 + i * 2, z: -12 },
      });
    }
    hook.queue({ t: 'debug', op: { op: 'spawnEnemy', defId: 'bell_brute', x: 0, z: -10 } });
    hook.queue({ t: 'debug', op: { op: 'spawnEnemy', defId: 'glass_lancer', x: 10, z: -14 } });
    hook.queue({ t: 'debug', op: { op: 'spawnEnemy', defId: 'lamenter', x: -10, z: -14 } });
    hook.queue({ t: 'debug', op: { op: 'spawnDummies', count: 120 } });
    hook.autoplay('skilled');
  });
  await waitTicks(page, 240);
  await page.waitForTimeout(1200);
  const perf = (await page.evaluate(() => window.__AW__!.perf()))!;
  await testInfo.attach('perf.json', {
    body: JSON.stringify(perf, null, 2),
    contentType: 'application/json',
  });
  await testInfo.attach('busy-fight.png', {
    body: await page.screenshot(),
    contentType: 'image/png',
  });
  console.log(`[perf] ${JSON.stringify(perf)}`);
  expect(perf.entities).toBeGreaterThanOrEqual(120);
  expect(perf.drawCalls).toBeLessThanOrEqual(220);
  // `sim:bench --check` enforces the real 1.5 ms budget headless. On CI runners SwiftShader
  // rasterises on the same few CPUs as the sim, so there this only catches gross regressions.
  expect(perf.simMsPerTick).toBeLessThan(process.env.CI ? 4 : 1.5);
  // Main-thread CPU per frame. GPU raster time isn't measurable under SwiftShader.
  expect(perf.frameMsP95).toBeLessThan(25);
  expect(perf.hudCommitsPerSec).toBeLessThanOrEqual(20);
});

test('Phase 3b: a merchant through the test hook — buy, the purse drops, leave', async ({
  page,
}) => {
  const errors = trackErrors(page);
  await page.goto(START_URL);
  await page.waitForFunction(() => window.__AWRUN__ !== undefined);
  await page.evaluate(() => window.__AWRUN__!.newRun(4242));
  await page
    .getByRole('button', { name: /Embark/i })
    .first()
    .click();
  await expect.poll(() => page.evaluate(() => window.__AWRUN__!.phase())).toBe('map');
  // The purse on screen, not just the store: a run starts with none.
  await expect(page.getByRole('status', { name: '0 Aether' }).first()).toBeVisible();

  expect(await page.evaluate(() => window.__AWRUN__!.warp('merchant', 200))).toBe('merchant');
  await expect(page.getByRole('heading', { name: 'The Merchant' })).toBeVisible();
  await expect(page.getByRole('status', { name: '200 Aether' }).first()).toBeVisible();
  // The healing is always on the cloth (25 Aether); buy it by clicking its card.
  await page.getByRole('button', { name: /^Healing:/ }).click();
  await expect(page.getByRole('status', { name: '175 Aether' }).first()).toBeVisible();
  expect(await page.evaluate(() => window.__AWRUN__!.aether())).toBe(175);
  await expect(page.getByText('Sold: yours now')).toBeVisible();
  await page.getByRole('button', { name: /Leave the merchant/ }).click();
  await expect.poll(() => page.evaluate(() => window.__AWRUN__!.phase())).toBe('map');
  expect(errors).toEqual([]);
});

test('Phase 3c: the Luminary — skip the unlocks, choose it in Prep, win First Light, take tier I', async ({
  page,
}) => {
  const errors = trackErrors(page);
  await page.goto(START_URL);
  await page.waitForFunction(() => window.__AWRUN__ !== undefined);
  // Settings → Progress → Skip the unlocks (a new profile is Rank 1: the Luminary is Rank 7).
  await page
    .getByRole('button', { name: /^Settings$/ })
    .first()
    .click();
  await page.getByText('Skip the unlocks', { exact: true }).click();
  await expect(page.getByRole('switch', { name: /Skip the unlocks/ })).toBeChecked();

  await page.evaluate(() => window.__AWRUN__!.newRun(4242));
  await expect.poll(() => page.evaluate(() => window.__AWRUN__!.phase())).toBe('prep');
  // The Calling picker: choose the Luminary by clicking its card.
  await page.getByRole('radio', { name: /^The Luminary/ }).click();
  await expect(page.getByRole('radio', { name: /^The Luminary.*chosen/ })).toBeVisible();
  expect(await page.evaluate(() => window.__AWRUN__!.calling())).toEqual({
    id: 'luminary',
    path: [null, null, null, null],
  });
  await page
    .getByRole('button', { name: /Embark/i })
    .first()
    .click();
  await expect.poll(() => page.evaluate(() => window.__AWRUN__!.phase())).toBe('map');
  // The strip carries the Calling; First Light is marked as the fight that grows it.
  await expect(page.getByTestId('calling-strip')).toBeVisible();
  await expect(page.getByTestId('calling-mark').first()).toBeVisible();

  // First Light, won through the hook (no need to play it here).
  expect(await page.evaluate(() => window.__AWRUN__!.choose())).toBe('skirmish');
  await expect.poll(() => page.evaluate(() => window.__AWRUN__!.phase())).toBe('combat');
  expect(await page.evaluate(() => window.__AWRUN__!.winFight())).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__AWRUN__!.phase())).toBe('result');
  const next = page.getByRole('button', { name: /Continue: your Calling grows/ });
  await expect(next).toBeVisible();
  // A new profile's first win may reach Rank 2: its card sits over the Result until dismissed.
  if (await page.getByTestId('rank-up').isVisible())
    await page.getByRole('button', { name: /Onward/ }).click();
  await next.click();
  await expect.poll(() => page.evaluate(() => window.__AWRUN__!.phase())).toBe('calling');
  await expect(page.getByRole('heading', { name: 'Your Calling grows' })).toBeVisible();
  // Past the arrival guard, key 1 takes the first option (Haloed); the draft follows.
  await page.waitForTimeout(700);
  await page.keyboard.press('1');
  await expect.poll(() => page.evaluate(() => window.__AWRUN__!.phase())).toBe('draft');
  expect(await page.evaluate(() => window.__AWRUN__!.calling())).toEqual({
    id: 'luminary',
    path: ['haloed', null, null, null],
  });
  expect(errors).toEqual([]);
});

test('Phase 3d: the Martyr — choose her in Prep, the Life budget, her HUD and Bear', async ({
  page,
}) => {
  const errors = trackErrors(page);
  await page.goto(START_URL);
  await page.waitForFunction(() => window.__AWRUN__ !== undefined);
  // Settings → Skip the unlocks (a new profile is Rank 1: the Martyr is Rank 8).
  await page
    .getByRole('button', { name: /^Settings$/ })
    .first()
    .click();
  await page.getByText('Skip the unlocks', { exact: true }).click();
  await expect(page.getByRole('switch', { name: /Skip the unlocks/ })).toBeChecked();

  await page.evaluate(() => window.__AWRUN__!.newRun(4242));
  await expect.poll(() => page.evaluate(() => window.__AWRUN__!.phase())).toBe('prep');
  expect(await page.evaluate(() => window.__AWRUN__!.reservePool())).toBe('spirit');
  await page.getByRole('radio', { name: /^The Martyr/ }).click();
  await expect(page.getByRole('radio', { name: /^The Martyr.*chosen/ })).toBeVisible();
  expect(await page.evaluate(() => window.__AWRUN__!.reservePool())).toBe('life');
  // The builder's budget is her Life now.
  await expect(page.getByTestId('life-budget')).toBeVisible();
  await page
    .getByRole('button', { name: /Embark/i })
    .first()
    .click();
  await expect.poll(() => page.evaluate(() => window.__AWRUN__!.phase())).toBe('map');

  // Into First Light: the Weaver bar shows what her songs hold of her Life, Spirit all free.
  expect(await page.evaluate(() => window.__AWRUN__!.choose())).toBe('skirmish');
  await expect.poll(() => page.evaluate(() => window.__AWRUN__!.phase())).toBe('combat');
  await page.waitForFunction(() => window.__AW__ !== undefined);
  // A new profile's first fight opens the primer; on her run it names Bear's key.
  const begin = page.getByRole('button', { name: /Begin the fight/i });
  if (await begin.isVisible().catch(() => false)) {
    await expect(page.getByText(/As the Martyr, B Bears/)).toBeVisible();
    await begin.click();
  }
  await expect(page.getByTestId('weaver-life')).toHaveAttribute('data-pool', 'life');
  await expect(page.getByTestId('life-reserved')).toBeVisible();
  await expect(page.getByTestId('calling-chip')).toBeVisible();
  // Thread Kael, then Bear (B): the read-out and his frame say so.
  await page.mouse.move(640, 300);
  await page.keyboard.press('Digit1');
  await page.keyboard.press('KeyB');
  await expect(page.getByTestId('thread-mode')).toHaveAttribute('data-mode', 'bear');
  await expect(page.getByTestId('borne')).toBeVisible();
  expect(errors).toEqual([]);
});

test('Phase 3e: the Chronomancer — choose him in Prep, Rewind in Reel’s slot, F Rewinds Kael', async ({
  page,
}) => {
  const errors = trackErrors(page);
  await page.goto(START_URL);
  await page.waitForFunction(() => window.__AWRUN__ !== undefined);
  // Settings → Skip the unlocks (a new profile is Rank 1: the Chronomancer is Rank 9).
  await page
    .getByRole('button', { name: /^Settings$/ })
    .first()
    .click();
  await page.getByText('Skip the unlocks', { exact: true }).click();
  await expect(page.getByRole('switch', { name: /Skip the unlocks/ })).toBeChecked();

  await page.evaluate(() => window.__AWRUN__!.newRun(4242));
  await expect.poll(() => page.evaluate(() => window.__AWRUN__!.phase())).toBe('prep');
  // Three Callings side by side; choose the Chronomancer.
  await expect(page.getByTestId('calling-chronomancer')).toBeVisible();
  await page.getByRole('radio', { name: /^The Chronomancer/ }).click();
  await expect(page.getByRole('radio', { name: /^The Chronomancer.*chosen/ })).toBeVisible();
  expect(await page.evaluate(() => window.__AWRUN__!.calling())).toEqual({
    id: 'chronomancer',
    path: [null, null, null, null],
  });
  // His songs reserve Spirit, as always.
  expect(await page.evaluate(() => window.__AWRUN__!.reservePool())).toBe('spirit');
  await page
    .getByRole('button', { name: /Embark/i })
    .first()
    .click();
  await expect.poll(() => page.evaluate(() => window.__AWRUN__!.phase())).toBe('map');

  // Into First Light.
  expect(await page.evaluate(() => window.__AWRUN__!.choose())).toBe('skirmish');
  await expect.poll(() => page.evaluate(() => window.__AWRUN__!.phase())).toBe('combat');
  await page.waitForFunction(() => window.__AW__ !== undefined);
  // A new profile's first fight opens the primer; on his run it says F Rewinds.
  const begin = page.getByRole('button', { name: /Begin the fight/i });
  if (await begin.isVisible().catch(() => false)) {
    await expect(page.getByText(/As the Chronomancer, F Rewinds instead of Reeling/)).toBeVisible();
    await begin.click();
  }
  // Reel's slot is Rewind's: its own name and glyph on the F button, the chip above.
  await expect(page.getByTestId('technique-reel')).toHaveAttribute('data-name', 'Rewind');
  await expect(page.getByTestId('calling-chip')).toBeVisible();
  // Thread Kael, then F: Rewind sends him back (a 'rewind' marker, not a 'reel' one), and its
  // cooldown starts on the F slot.
  await page.mouse.move(640, 300);
  await page.keyboard.press('Digit1');
  await expect(page.getByTestId('thread-mode')).toContainText('Kael');
  await page.keyboard.press('KeyF');
  await expect
    .poll(() => page.evaluate(() => window.__AW__!.markers()), { timeout: 10_000 })
    .toContain('rewind');
  expect(await page.evaluate(() => window.__AW__!.markers())).not.toContain('reel');
  await expect(page.getByTestId('technique-reel')).not.toHaveAttribute('data-ready', 'true');
  expect(errors).toEqual([]);
});

test('Phase 4: the Astrolabe — from Prep, take, give back, respec, a keystone’s path, embark with it', async ({
  page,
}) => {
  const errors = trackErrors(page);
  await page.goto(START_URL);
  await page.waitForFunction(() => window.__AWRUN__ !== undefined);
  // Settings → Skip the unlocks (a new profile is Rank 1: the Astrolabe opens at Rank 4).
  await page
    .getByRole('button', { name: /^Settings$/ })
    .first()
    .click();
  await page.getByText('Skip the unlocks', { exact: true }).click();
  await expect(page.getByRole('switch', { name: /Skip the unlocks/ })).toBeChecked();

  await page.evaluate(() => window.__AWRUN__!.newRun(4242));
  await expect.poll(() => page.evaluate(() => window.__AWRUN__!.phase())).toBe('prep');
  const { points } = await page.evaluate(() => window.__AWRUN__!.astrolabe());
  // Prep's button says how many points there are to spend; it opens the star map.
  await expect(page.getByTestId('prep-astrolabe')).toContainText(`${points} points to spend`);
  await page.getByTestId('prep-astrolabe').click();
  await expect(page.getByTestId('astrolabe-screen')).toBeVisible();
  const left = () => page.getByTestId('astrolabe-points');
  // A star on the map (the tooltip and the side card name the star they show, too).
  const star = (id: string) => page.getByTestId('astrolabe-map').locator(`[data-star="${id}"]`);

  // Spun Silver, three stars out: clicking it takes the path to it.
  await star('silk_n1').click();
  await expect
    .poll(() => page.evaluate(() => window.__AWRUN__!.astrolabe().tree))
    .toEqual(['silk_t1', 'silk_t2', 'silk_n1']);
  await expect(left()).toHaveAttribute('data-left', String(points - 3));
  // The run in Prep follows the tree.
  expect(await page.evaluate(() => window.__AWRUN__!.astrolabe().run)).toEqual([
    'silk_t1',
    'silk_t2',
    'silk_n1',
  ]);

  // The trunk can't go back while Spun Silver hangs on it; Spun Silver can (right-click).
  await star('silk_t1').click({ button: 'right' });
  expect(await page.evaluate(() => window.__AWRUN__!.astrolabe().tree)).toHaveLength(3);
  await star('silk_n1').click({ button: 'right' });
  await expect
    .poll(() => page.evaluate(() => window.__AWRUN__!.astrolabe().tree))
    .toEqual(['silk_t1', 'silk_t2']);
  await expect(left()).toHaveAttribute('data-left', String(points - 2));

  // Respec, confirmed: everything back.
  await page.getByRole('button', { name: /Respec/ }).click();
  await page.getByRole('button', { name: /Give everything back/ }).click();
  await expect.poll(() => page.evaluate(() => window.__AWRUN__!.astrolabe().tree)).toEqual([]);
  await expect(left()).toHaveAttribute('data-left', String(points));

  // A keystone at the rim: pointing at it shows the path's price; one click takes the path.
  const prism = star('prism_covenant');
  await prism.hover();
  const tip = page.getByTestId('star-tip');
  await expect(tip).toHaveAttribute('data-star', 'prism_covenant');
  await expect(tip).toHaveAttribute('data-action', 'take');
  const cost = Number(await tip.getAttribute('data-cost'));
  expect(cost).toBeGreaterThan(1);
  await prism.click();
  await expect
    .poll(() => page.evaluate(() => window.__AWRUN__!.astrolabe().tree.length))
    .toBe(cost);
  const tree = await page.evaluate(() => window.__AWRUN__!.astrolabe().tree);
  expect(tree.at(-1)).toBe('prism_covenant');
  await expect(left()).toHaveAttribute('data-left', String(points - cost));
  await expect(page.getByTestId('astrolabe-keystones')).toContainText('Prism Covenant');

  // Esc goes back to Prep, which names the keystone.
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => window.__AWRUN__!.phase())).toBe('prep');
  await expect(page.getByTestId('prep-astrolabe')).toContainText(
    `${points - cost} points to spend`,
  );
  await expect(page.getByTestId('keystone-chips')).toContainText('Prism Covenant');

  // Embark: the first fight's config carries the tree (the sim keeps it sorted).
  await page
    .getByRole('button', { name: /Embark/i })
    .first()
    .click();
  await expect.poll(() => page.evaluate(() => window.__AWRUN__!.phase())).toBe('map');
  expect(await page.evaluate(() => window.__AWRUN__!.astrolabe().run)).toEqual(tree);
  expect(await page.evaluate(() => window.__AWRUN__!.choose())).toBe('skirmish');
  await expect.poll(() => page.evaluate(() => window.__AWRUN__!.phase())).toBe('combat');
  await page.waitForFunction(() => window.__AW__ !== undefined);
  const config = await page.evaluate(() => window.__AW__!.exportReplay().config);
  expect(config.astrolabe).toEqual([...tree].sort());
  // The fight shows the keystone beside the Calling chip's place.
  await expect(page.getByTestId('keystone-chip')).toBeVisible();
  expect(errors).toEqual([]);
});

test('Phase 4b: Deeds — a fight earns two, their toasts follow the rank-up card, lit in the Codex', async ({
  page,
}) => {
  const errors = trackErrors(page);
  // Two Deeds one fight can earn: answering calls over a run (a point) and every call in a fight
  // (a badge). The hook wins a fight with that many calls made and answered.
  const heard = CONTENT.deeds.find((d) => d.test === 'runCount' && d.stat === 'responses')!;
  const everyCall = CONTENT.deeds.find((d) => d.test === 'callAll')!;
  const both = CONTENT.deeds.filter((d) => d === heard || d === everyCall).map((d) => d.id);
  const calls = Math.max(heard.values.n ?? 0, everyCall.values.n ?? 0);
  const phase = () => page.evaluate(() => window.__AWRUN__!.phase());
  await page.goto(START_URL);
  await page.waitForFunction(() => window.__AWRUN__ !== undefined);
  await page.evaluate(() => window.__AWRUN__!.newRun(4242));
  await expect.poll(phase).toBe('prep');
  await page
    .getByRole('button', { name: /Embark/i })
    .first()
    .click();
  await expect.poll(phase).toBe('map');

  // First Light, a plain win: no Deed, no toast.
  expect(await page.evaluate(() => window.__AWRUN__!.choose())).toBe('skirmish');
  await expect.poll(phase).toBe('combat');
  expect(await page.evaluate(() => window.__AWRUN__!.winFight())).toBe(true);
  await expect.poll(phase).toBe('result');
  expect(await page.evaluate(() => window.__AWRUN__!.deeds().notices)).toEqual([]);
  const xpBefore = await page.evaluate(() => window.__AWRUN__!.weaverXp());
  await page.evaluate(() => window.__AWRUN__!.continue());
  await expect.poll(phase).toBe('draft');
  await page.evaluate(() => window.__AWRUN__!.pick(0));
  await expect.poll(phase).toBe('map');

  // The next skirmish, every call answered: both Deeds at once.
  expect(await page.evaluate(() => window.__AWRUN__!.warp('skirmish'))).toBe('combat');
  expect(
    await page.evaluate((n) => window.__AWRUN__!.winFight({ calls: n, responses: n }), calls),
  ).toBe(true);
  await expect.poll(phase).toBe('result');
  // The profile keeps them (content order), the run remembers them for its Summary.
  const deeds = await page.evaluate(() => window.__AWRUN__!.deeds());
  expect(deeds.earned).toEqual(both);
  expect(deeds.run).toEqual(both);
  expect(deeds.notices).toEqual(both);

  const toast = page.getByTestId('deed-toast');
  await expect(page.getByTestId('xp-gain')).toBeVisible();
  // Two wins cross a Rank (from a new profile): its card comes first, and the toasts wait.
  const xp = await page.evaluate(() => window.__AWRUN__!.weaverXp());
  if (rankOf(xp) > rankOf(xpBefore)) {
    await expect(page.getByTestId('rank-up')).toBeVisible();
    await page.waitForTimeout(1500);
    await expect(toast).toHaveCount(0);
    await page.getByRole('button', { name: /Onward/ }).click();
  }
  // One toast per Deed, one after another, each with its sound: the point's, then the badge's.
  await expect(toast).toHaveAttribute('data-deed', heard.id);
  await expect(toast).toContainText(`Deed earned · ${heard.name}`);
  await expect(toast).toContainText(deedText(heard));
  await expect(toast).toContainText(`★ +${heard.points} Astrolabe point`);
  await expect(toast).toHaveAttribute('data-sound', 'deedStar');
  await expect(toast).toHaveAttribute('data-deed', everyCall.id, { timeout: 10_000 });
  await expect(toast).toContainText(`Deed earned · ${everyCall.name}`);
  await expect(toast).toContainText(deedText(everyCall));
  await expect(toast).not.toContainText('Astrolabe point');
  await expect(toast).toHaveAttribute('data-sound', 'deed');
  // All shown: those notices are dismissed.
  await expect(toast).toHaveCount(0, { timeout: 10_000 });
  await expect.poll(() => page.evaluate(() => window.__AWRUN__!.deeds().notices)).toEqual([]);

  // The Codex, from the Title: both lit, with the header's counts and Heard's best run.
  await page.goto(START_URL);
  await page.getByRole('button', { name: /^Codex$/ }).click();
  await page.getByRole('tab', { name: 'Deeds' }).click();
  await expect(page.getByTestId('deeds-header')).toHaveText(
    `${both.length} of ${CONTENT.deeds.length} earned · ${deedPoints(both)} of ${DEED_POINTS_MAX} Astrolabe points from Deeds`,
  );
  for (const d of CONTENT.deeds)
    await expect(page.getByTestId(`deed-${d.id}`)).toHaveAttribute(
      'data-earned',
      String(both.includes(d.id)),
    );
  await expect(page.getByTestId(`deed-${heard.id}`)).toContainText(`best ${calls}`);
  expect(errors).toEqual([]);
});

test('Phase 4c: the Reliquary — from Prep, craft, carry and attune, embark with it, enshrine at the Summary', async ({
  page,
}) => {
  test.setTimeout(180_000);
  const errors = trackErrors(page);
  const rules = CONTENT.reliquary;
  const phase = () => page.evaluate(() => window.__AWRUN__!.phase());
  const reliquary = () => page.evaluate(() => window.__AWRUN__!.reliquary());
  await page.goto(START_URL);
  await page.waitForFunction(() => window.__AWRUN__ !== undefined);
  // Settings → Skip the unlocks: the Reliquary opens (a new profile is Rank 1), every slot too.
  await page
    .getByRole('button', { name: /^Settings$/ })
    .first()
    .click();
  await page.getByText('Skip the unlocks', { exact: true }).click();
  await expect(page.getByRole('switch', { name: /Skip the unlocks/ })).toBeChecked();
  // Two enshrined relics and materials (a profile only earns them from play).
  const shards = rules.inscribe.cost * 3;
  await page.evaluate((seed) => window.__AWRUN__!.seedReliquary(seed), {
    relics: [
      { id: 'prism_loom', inscriptions: [{ id: 'potent_thread', tier: 5 }] },
      { id: 'cantors_hymnal', inscriptions: [{ id: 'hardy', tier: 5 }] },
    ],
    shards,
    tears: 1,
  });
  expect((await reliquary()).slots).toBe(rules.slotRanks.length);

  // Prep's row: nothing carried yet; its button opens the Reliquary.
  await page.evaluate(() => window.__AWRUN__!.newRun(4242));
  await expect.poll(phase).toBe('prep');
  await expect(page.getByTestId('prep-reliquary')).toHaveAttribute('data-carried', '');
  await page.getByTestId('prep-reliquary-open').click();
  await expect(page.getByTestId('reliquary-screen')).toBeVisible();
  await expect(page.getByTestId('materials')).toHaveAttribute('data-shards', String(shards));

  // Prism Loom: Inscribe an Aegis Inscription. The preview's numbers are the meta's (no risk at
  // Instability 0), and the craft lands: the shards drop, an Aegis Inscription joins it.
  await page.locator('[data-testid="reliquary-tile"][data-relic="r1"]').click();
  await page.getByTestId('craft-tab-inscribe').click();
  await page.locator('[data-category="aegis"]').click();
  const preview = page.getByTestId('craft-preview');
  await expect(preview).toHaveAttribute('data-shards', String(rules.inscribe.cost));
  await expect(preview).toHaveAttribute('data-fracture', '0');
  await expect(preview).toHaveAttribute('data-instability', String(rules.inscribe.instability));
  await page.getByTestId('craft-commit').click();
  await expect(page.getByTestId('craft-outcome')).toHaveAttribute('data-kind', 'inscribed');
  let rq = await reliquary();
  expect(rq.shards).toBe(shards - rules.inscribe.cost);
  expect(rq.relics[0]!.instability).toBe(rules.inscribe.instability);
  expect(rq.relics[0]!.inscriptions).toHaveLength(2);
  const added = rq.relics[0]!.inscriptions[1]!;
  expect(inscriptionDef(added.id).category).toBe('aegis');
  await expect(page.getByTestId('reliquary-detail')).toContainText(inscriptionDef(added.id).name);

  // The carry: Prism Loom, then Cantor's Hymnal; then attune the Hymnal (to the first slot).
  await page.getByTestId('carry-toggle').click();
  await expect.poll(async () => (await reliquary()).carry).toEqual(['r1']);
  await page.locator('[data-testid="reliquary-tile"][data-relic="r2"]').click();
  await page.getByTestId('carry-toggle').click();
  await expect.poll(async () => (await reliquary()).carry).toEqual(['r1', 'r2']);
  await expect(page.getByTestId('carry-slot-2')).toHaveAttribute('data-relic', 'r2');
  await page.getByTestId('attune').click();
  await expect.poll(async () => (await reliquary()).carry).toEqual(['r2', 'r1']);
  // The run in Prep follows: the Hymnal attuned, Prism Loom dormant (it lends its Inscriptions).
  rq = await reliquary();
  expect(rq.run!.carried).toEqual(['cantors_hymnal', 'prism_loom']);
  expect(rq.run!.relics).toEqual([
    { id: 'cantors_hymnal', carried: true, dormant: false },
    { id: 'prism_loom', carried: true, dormant: true },
  ]);

  // Esc goes back to Prep, whose row shows what this run carries.
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('prep-reliquary')).toHaveAttribute(
    'data-carried',
    'cantors_hymnal prism_loom',
  );
  await expect(
    page.locator('[data-testid="prep-carried"][data-relic="prism_loom"]'),
  ).toHaveAttribute('data-dormant', 'true');

  // Embark: the map's strip marks both, attuned and dormant; a tooltip lists the Inscriptions.
  await page
    .getByRole('button', { name: /Embark/i })
    .first()
    .click();
  await expect.poll(phase).toBe('map');
  const badge = (id: string) => page.locator(`[data-testid="relic-badge"][data-relic="${id}"]`);
  await expect(badge('cantors_hymnal')).toHaveAttribute('data-carried', 'attuned');
  await expect(badge('prism_loom')).toHaveAttribute('data-carried', 'dormant');
  await badge('prism_loom').hover();
  await expect(page.getByTestId('carried-tip').filter({ visible: true })).toContainText(
    inscriptionDef(added.id).name,
  );

  // The first fight plays the attuned relic's effect and every carried relic's Inscriptions.
  expect(await page.evaluate(() => window.__AWRUN__!.choose())).toBe('skirmish');
  await expect.poll(phase).toBe('combat');
  await page.waitForFunction(() => window.__AW__ !== undefined);
  const config = await page.evaluate(() => window.__AW__!.exportReplay().config);
  expect((config.relics ?? []).map((r) => (typeof r === 'string' ? r : r.id))).toEqual([
    'cantors_hymnal',
  ]);
  expect(config.passives).toHaveLength(3);
  // The HUD: the attuned relic marked, the dormant one dimmed beside it.
  await expect(
    page.getByTestId('relic-bar').locator('[data-relic="cantors_hymnal"][data-carried="attuned"]'),
  ).toBeVisible();
  await expect(
    page.getByTestId('relic-bar').locator('[data-relic="prism_loom"][data-state="dormant"]'),
  ).toBeVisible();

  // Win it, then the run (the hook walks to the boss), having found a Tuning Fork.
  expect(await page.evaluate(() => window.__AWRUN__!.winFight())).toBe(true);
  await expect.poll(phase).toBe('result');
  await page.evaluate(() => window.__AWRUN__!.continue());
  await expect.poll(phase).toBe('draft');
  await page.evaluate(() => window.__AWRUN__!.pick(0));
  await expect.poll(phase).toBe('map');
  expect(await page.evaluate(() => window.__AWRUN__!.winRun(['tuning_fork']))).toBe(true);
  await expect.poll(phase).toBe('summary');

  // The Summary: what the run paid, and only what it found to enshrine (not what it carried).
  const panel = page.getByTestId('summary-reliquary');
  await expect(panel).toHaveAttribute('data-stage', 'choose');
  rq = await reliquary();
  expect(rq.run!.paid).not.toBeNull();
  expect(rq.shards).toBe(shards - rules.inscribe.cost + rq.run!.paid!.shards);
  // From a new profile the run's XP crosses a Rank or two: that card comes first.
  if ((await page.getByTestId('rank-up').count()) > 0)
    await page.getByRole('button', { name: /Onward/ }).click();
  await expect(page.getByTestId('rank-up')).toHaveCount(0);
  const options = page.getByTestId('enshrine-options');
  await expect(options.locator('[data-relic="tuning_fork"]')).toBeVisible();
  await expect(options.locator('[data-relic="cantors_hymnal"]')).toHaveCount(0);
  await expect(options.locator('[data-relic="prism_loom"]')).toHaveCount(0);
  await options.locator('[data-relic="tuning_fork"]').getByTestId('enshrine').click();
  await expect(panel.getByTestId('enshrined')).toHaveAttribute('data-relic', 'tuning_fork');
  rq = await reliquary();
  expect(rq.run!.paid!.enshrined).toBe('tuning_fork');
  expect(rq.relics).toHaveLength(3);
  expect(rq.relics[2]!.id).toBe('tuning_fork');
  expect(rq.relics[2]!.inscriptions).toHaveLength(rules.enshrineInscriptions.common);
  // Once is all: no more options.
  await expect(panel).toHaveAttribute('data-stage', 'done');
  await expect(page.getByTestId('enshrine-options')).toHaveCount(0);
  expect(errors).toEqual([]);
});
