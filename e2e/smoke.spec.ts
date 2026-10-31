import { expect, test, type Page } from '@playwright/test';
import { CONTENT, deedText, inscriptionDef } from '../src/content';
import { DEED_POINTS_MAX, deedPoints } from '../src/meta/deeds';
import { dissonancePoints, fitLevels, xpMult } from '../src/meta/dissonance';
import { altSoloOf, sceneXp, talentChoices } from '../src/meta/bonds';
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

/**
 * Phase 4g: from the Title's front door into the Loom, the hub where the stations are. A new
 * profile's first visit plays the welcome intro: Later closes it.
 */
async function enterLoom(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Enter the Loom' }).click();
  await expect(page.getByTestId('loom-screen')).toBeVisible();
  if (await page.getByTestId('station-intro').isVisible())
    await page.getByTestId('intro-later').click();
  await expect(page.getByTestId('station-intro')).toHaveCount(0);
}

async function enterTraining(page: Page): Promise<void> {
  await page.goto(START_URL);
  await enterLoom(page);
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
  await enterLoom(page);
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
  // The Thread dial over the Weaver bar says which mode the Thread is in, and turns on a switch.
  await expect(page.getByTestId('thread-dial')).toHaveAttribute('data-mode', 'mend');
  await expect(page.getByTestId('thread-dial')).toHaveAttribute('data-state', 'live');
  await page.mouse.click(640, 360, { button: 'right' });
  await waitTicks(page, 2);
  expect((await weaverOf(page)).threadMode).toBe('empower');
  await expect(page.getByTestId('thread-dial')).toHaveAttribute('data-mode', 'empower');
  await expect(page.getByTestId('thread-dial-plate')).toHaveText('Empower');

  // Ward the threaded hero: the replay records it as a normalised tech command.
  await page.keyboard.press('KeyQ');
  await waitTicks(page, 2);
  const replay = await page.evaluate(() => window.__AW__!.exportReplay());
  const commands = replay.frames.flatMap(([, cmds]) => cmds);
  expect(commands).toContainEqual({ t: 'tech', id: 'ward', slot: 2 });
});

test('health at a glance: bars over the heroes; Edit HUD layout moves the frames and the Weaver bar', async ({
  page,
}) => {
  const errors = trackErrors(page);
  await enterTraining(page);
  await waitTicks(page, 10);
  // A bar over each hero, with the key that threads them.
  const bars = page.getByTestId('ally-bar').filter({ visible: true });
  await expect(bars).toHaveCount(3);
  await expect(bars.first()).toContainText('1');
  // Frames say the life missing (nothing at full life) and glow when critical: none yet.
  await expect(page.locator('[data-critical]')).toHaveCount(0);

  // Pause, then Edit HUD layout: the frames move where they're dropped, and are saved.
  await page.keyboard.press('Escape');
  await page.getByTestId('edit-layout').click();
  await expect(page.getByTestId('layout-editor')).toBeVisible();
  const frames = page.getByTestId('party-frames');
  const before = (await frames.boundingBox())!;
  const handle = (await page.getByTestId('frames-handle').boundingBox())!;
  await page.mouse.move(handle.x + 40, handle.y + 40);
  await page.mouse.down();
  await page.mouse.move(handle.x + 400, handle.y - 200, { steps: 6 });
  await page.mouse.move(handle.x + 800, handle.y - 300, { steps: 6 });
  await page.mouse.up();
  await page.getByText('Side by side', { exact: true }).click();
  // The Weaver bar, dragged up into the top half: chosen as it's grabbed, saved as it's dropped.
  const bar = page.getByTestId('weaver-bar-anchor');
  const barBefore = (await bar.boundingBox())!;
  const barHandle = (await page.getByTestId('weaver-bar-handle').boundingBox())!;
  await page.mouse.move(barHandle.x + 120, barHandle.y + 40);
  await page.mouse.down();
  await page.mouse.move(barHandle.x - 100, barHandle.y - 250, { steps: 6 });
  await page.mouse.move(barHandle.x - 300, barHandle.y - 480, { steps: 6 });
  await page.mouse.up();
  await expect(page.getByTestId('weaver-bar-handle')).toHaveAttribute('data-selected', 'true');
  await page.getByTestId('layout-done').click();
  await expect(page.getByTestId('layout-editor')).toHaveCount(0);
  // Pinned by their right edge now (dropped in the right half), the row grows leftward from it.
  const after = (await frames.boundingBox())!;
  expect(after.x + after.width).toBeGreaterThan(before.x + before.width + 300);
  await expect(frames).toHaveAttribute('data-orientation', 'horizontal');
  const saved = await page.evaluate(
    () => JSON.parse(localStorage.getItem('aetherweaver.settings') ?? 'null')?.hud?.frames,
  );
  expect(saved.orientation).toBe('horizontal');
  expect(saved.at.corner).toMatch(/r$/);
  // The bar is in the top half now, its crest (the Thread dial) opening under it.
  const barAfter = (await bar.boundingBox())!;
  expect(barAfter.y).toBeLessThan(barBefore.y - 300);
  await expect(bar).toHaveAttribute('data-crest', 'below');
  const dial = (await page.getByTestId('thread-dial').boundingBox())!;
  expect(dial.y).toBeGreaterThan(barAfter.y + barAfter.height - 1);
  const savedBar = await page.evaluate(
    () => JSON.parse(localStorage.getItem('aetherweaver.settings') ?? 'null')?.hud?.weaverBar,
  );
  expect(savedBar.at.corner).toMatch(/^t/);
  // Back to the pause menu, then the fight.
  await page.getByRole('button', { name: /Resume/ }).click();
  await waitTicks(page, 5);
  expect(errors).toEqual([]);
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
  await expect(page.getByTestId('thread-dial')).toHaveAttribute('data-mode', 'bear');
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
  // A fight, its cards and toasts, then the Codex by way of the Loom (Phase 4g).
  test.setTimeout(180_000);
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

  // The Codex, from the Loom: both lit, with the header's counts and Heard's best run.
  await page.goto(START_URL);
  await enterLoom(page);
  await page.getByRole('button', { name: /^Codex:/ }).click();
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

test('Phase 4d: Dissonance — choose levels in Prep, embark, the fight plays them, a win sets the record', async ({
  page,
}) => {
  test.setTimeout(180_000);
  const errors = trackErrors(page);
  const rules = CONTENT.dissonanceRules;
  const phase = () => page.evaluate(() => window.__AWRUN__!.phase());
  const dissonance = () => page.evaluate(() => window.__AWRUN__!.dissonance());
  // Two levels of content: one with ranks, taken to its top, and one without (not the Pact,
  // whose relic would join the run).
  const ranked = CONTENT.dissonance.find((d) => d.ranks > 1)!;
  const single = CONTENT.dissonance.find((d) => d.ranks === 1 && d.effect !== 'cursed_start')!;
  const levels = fitLevels([
    { id: ranked.id, rank: ranked.ranks },
    { id: single.id, rank: 1 },
  ]);
  const points = dissonancePoints(levels);
  const level = (id: string) => page.getByTestId(`dissonance-level-${id}`);
  const panel = page.getByTestId('prep-dissonance');

  // A new profile: closed, and Prep says how it opens.
  await page.goto(START_URL);
  await page.waitForFunction(() => window.__AWRUN__ !== undefined);
  await page.evaluate(() => window.__AWRUN__!.newRun(4242));
  await expect.poll(phase).toBe('prep');
  await expect(panel).toHaveAttribute('data-open', 'false');
  await expect(page.getByTestId('dissonance-closed-line')).toContainText(`Rank ${rules.openRank}`);
  expect((await dissonance()).open).toBe(false);

  // Settings → Skip the unlocks opens it; Prep shows every level, nothing chosen.
  await page.goto(START_URL);
  await page
    .getByRole('button', { name: /^Settings$/ })
    .first()
    .click();
  await page.getByText('Skip the unlocks', { exact: true }).click();
  await expect(page.getByRole('switch', { name: /Skip the unlocks/ })).toBeChecked();
  await page.evaluate(() => window.__AWRUN__!.newRun(4242));
  await expect.poll(phase).toBe('prep');
  await expect(panel).toHaveAttribute('data-open', 'true');
  await expect(panel).toHaveAttribute('data-points', '0');
  for (const d of CONTENT.dissonance) await expect(level(d.id)).toHaveAttribute('data-on', 'false');

  // Choose: the ranked level on, then up to its top rank; the other on. The panel's numbers are
  // the meta's, and the profile and the run in Prep follow.
  await level(ranked.id).getByTestId('level-switch').click();
  for (let r = 1; r < ranked.ranks; r++)
    await level(ranked.id).getByTestId('level-rank-more').click();
  await level(single.id).getByTestId('level-switch').click();
  await expect(level(ranked.id)).toHaveAttribute('data-rank', String(ranked.ranks));
  await expect(level(single.id)).toHaveAttribute('data-on', 'true');
  await expect(panel).toHaveAttribute('data-points', String(points));
  await expect(page.getByTestId('dissonance-total')).toHaveAttribute(
    'data-max',
    String(CONTENT.dissonance.reduce((n, d) => n + d.points * d.ranks, 0)),
  );
  await expect(page.getByTestId('dissonance-pays').locator('[data-xp]')).toHaveAttribute(
    'data-xp',
    String(Math.round((xpMult(points) - 1) * 1000) / 10),
  );
  await expect(page.getByTestId('embark-dissonance')).toHaveAttribute(
    'data-points',
    String(points),
  );
  let d = await dissonance();
  expect(d.open).toBe(true);
  expect(d.levels).toEqual(levels);
  expect(d.run).toMatchObject({ levels, points, end: null });

  // Embark: the run keeps them; the fight's config plays them, and the HUD says so.
  await page
    .getByRole('button', { name: /Embark/i })
    .first()
    .click();
  await expect.poll(phase).toBe('map');
  expect(await page.evaluate(() => window.__AWRUN__!.choose())).toBe('skirmish');
  await expect.poll(phase).toBe('combat');
  await page.waitForFunction(() => window.__AW__ !== undefined);
  const config = await page.evaluate(() => window.__AW__!.exportReplay().config);
  expect(config.dissonance).toEqual(levels);
  await expect(page.getByTestId('hud-dissonance')).toHaveAttribute('data-points', String(points));

  // Win it: the Result's XP has its Dissonance line. Then the run (the hook walks to the boss).
  expect(await page.evaluate(() => window.__AWRUN__!.winFight())).toBe(true);
  await expect.poll(phase).toBe('result');
  await expect(page.getByTestId('xp-gain')).toContainText(`Dissonance ${points}`);
  await page.evaluate(() => window.__AWRUN__!.continue());
  await expect.poll(phase).toBe('draft');
  await page.evaluate(() => window.__AWRUN__!.pick(0));
  await expect.poll(phase).toBe('map');
  expect(await page.evaluate(() => window.__AWRUN__!.winRun())).toBe(true);
  await expect.poll(phase).toBe('summary');

  // The Summary: the run's Dissonance and a new best (without a Calling); the profile keeps it.
  if ((await page.getByTestId('rank-up').count()) > 0)
    await page.getByRole('button', { name: /Onward/ }).click();
  await expect(page.getByTestId('rank-up')).toHaveCount(0);
  const summary = page.getByTestId('summary-dissonance');
  await expect(summary).toHaveAttribute('data-points', String(points));
  await expect(summary).toHaveAttribute('data-best', 'true');
  await expect(page.getByTestId('dissonance-new-best')).toContainText(String(points));
  d = await dissonance();
  expect(d.best.none).toBe(points);
  expect(d.run!.end).toEqual({ opened: false, best: true });

  // The next Prep shows the record, and that a new best now takes more.
  await page.getByRole('button', { name: /New run/ }).click();
  await expect.poll(phase).toBe('prep');
  const best = page.getByTestId('dissonance-best');
  await expect(best).toHaveAttribute('data-best', String(points));
  await expect(best).toContainText(`Best won without a Calling: ${points}.`);
  expect(errors).toEqual([]);
});

test('Phase 4e: Bonds — choose talents and a Solo on the Bonds screen, embark with them, a Respite scene played through', async ({
  page,
}) => {
  test.setTimeout(180_000);
  const errors = trackErrors(page);
  const phase = () => page.evaluate(() => window.__AWRUN__!.phase());
  const bonds = () => page.evaluate(() => window.__AWRUN__!.bonds());
  // Content's: Kael's second talent of tier I and first of tier II, Lyra's first of tier III,
  // and Vexis's alternate Solo. Nothing of Lyra's or Vexis's own is named here.
  const kael1 = talentChoices('kael', 1)[1]!;
  const kael2 = talentChoices('kael', 2)[0]!;
  const lyra3 = talentChoices('lyra', 3)[0]!;
  const sphere = altSoloOf('vexis')!;
  const chosen = new Set([kael1.id, kael2.id, lyra3.id]);
  const talents = CONTENT.talents.filter((t) => chosen.has(t.id)).map((t) => t.id);
  const talent = (id: string) => page.getByTestId(`talent-${id}`);

  // Settings → Skip the unlocks: every talent and Solo can be chosen, from rank 1.
  await page.goto(START_URL);
  await page.waitForFunction(() => window.__AWRUN__ !== undefined);
  await page
    .getByRole('button', { name: /^Settings$/ })
    .first()
    .click();
  await page.getByText('Skip the unlocks', { exact: true }).click();
  await expect(page.getByRole('switch', { name: /Skip the unlocks/ })).toBeChecked();
  await page.evaluate(() => window.__AWRUN__!.newRun(4242));
  await expect.poll(phase).toBe('prep');

  // Prep's Bonds row opens the Bonds screen.
  await expect(page.getByTestId('prep-bonds')).toBeVisible();
  await page.getByTestId('prep-bonds-open').click();
  await expect(page.getByTestId('bonds-screen')).toBeVisible();
  await expect(page.getByTestId('bonds-skip')).toBeVisible();
  const pageOf = page.getByTestId('bond-page');
  await expect(pageOf).toHaveAttribute('data-hero', 'kael');
  await expect(pageOf).toHaveAttribute('data-rank', '1');

  // Kael: tier I's second talent, then tier II's first. Every tier is open (Skip the unlocks).
  await expect(page.getByTestId('tier-3')).toHaveAttribute('data-open', 'true');
  await talent(kael1.id).click();
  await talent(kael2.id).click();
  await expect(talent(kael1.id)).toHaveAttribute('aria-pressed', 'true');
  await expect(talent(kael2.id)).toHaveAttribute('aria-pressed', 'true');
  // Choosing again clears it; once more chooses it back.
  await talent(kael2.id).click();
  await expect(talent(kael2.id)).toHaveAttribute('aria-pressed', 'false');
  await talent(kael2.id).click();

  // Lyra (the tab, then the keyboard): tier III's first. Vexis: the alternate Solo.
  await page.getByTestId('bonds-tab-lyra').click();
  await expect(pageOf).toHaveAttribute('data-hero', 'lyra');
  await talent(lyra3.id).click();
  await page.getByTestId('bonds-tab-lyra').press('ArrowRight');
  await expect(pageOf).toHaveAttribute('data-hero', 'vexis');
  await page.getByTestId('solo-alt').click();
  await expect(page.getByTestId('solo-choice')).toHaveAttribute('data-chosen', 'alt');

  let b = await bonds();
  expect(b.heroes.kael!.talents).toEqual([kael1.id, kael2.id, null]);
  expect(b.heroes.lyra!.talents).toEqual([null, null, lyra3.id]);
  expect(b.heroes.vexis!.solo).toBe('alt');

  // Back to Prep (Esc): the row and the run in Prep follow the profile.
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('prep-bonds')).toBeVisible();
  await expect(page.getByTestId('prep-bond-kael')).toHaveAttribute(
    'data-talents',
    `${kael1.id} ${kael2.id}`,
  );
  await expect(page.getByTestId('prep-bond-vexis')).toHaveAttribute('data-solo', sphere.id);
  await expect(page.getByTestId('prep-solo-vexis')).toContainText(sphere.name);
  b = await bonds();
  expect(b.run!.bonds).toEqual([
    { heroId: 'kael', talents: [kael1.id, kael2.id], solo: null },
    { heroId: 'lyra', talents: [lyra3.id], solo: null },
    { heroId: 'vexis', talents: [], solo: sphere.id },
  ]);

  // Embark: the fight's config carries them; the HUD names Vexis's Solo.
  await page
    .getByRole('button', { name: /Embark/i })
    .first()
    .click();
  await expect.poll(phase).toBe('map');
  expect(await page.evaluate(() => window.__AWRUN__!.choose())).toBe('skirmish');
  await expect.poll(phase).toBe('combat');
  await page.waitForFunction(() => window.__AW__ !== undefined);
  const config = await page.evaluate(() => window.__AW__!.exportReplay().config);
  expect(config.bonds).toEqual({ talents, solos: [sphere.id] });
  await expect(page.getByTestId('frame-tip-vexis')).toHaveAttribute('data-solo', sphere.id);
  await expect(page.getByTestId('frame-tip-vexis')).toContainText(sphere.name);
  await expect(page.getByTestId('frame-tip-kael')).toHaveAttribute(
    'data-talents',
    `${kael1.id} ${kael2.id}`,
  );

  // Win it: the Result shows each hero's Bond XP, as the profile holds it.
  expect(await page.evaluate(() => window.__AWRUN__!.winFight())).toBe(true);
  await expect.poll(phase).toBe('result');
  b = await bonds();
  for (const h of ['kael', 'lyra', 'vexis'])
    await expect(page.getByTestId(`bond-xp-${h}`)).toHaveAttribute(
      'data-xp',
      String(b.heroes[h]!.xp),
    );
  await page.evaluate(() => window.__AWRUN__!.continue());
  await expect.poll(phase).toBe('draft');
  await page.evaluate(() => window.__AWRUN__!.pick(0));
  await expect.poll(phase).toBe('map');

  // Kael reaches his first scene's rank; a Respite offers it as a fourth choice.
  const scene = CONTENT.scenes
    .filter((sc) => sc.hero === 'kael')
    .sort((x, y) => x.rank - y.rank)[0]!;
  const seeded = CONTENT.bondRules.ranks[scene.rank - 1]!;
  await page.evaluate((xp) => window.__AWRUN__!.seedBonds({ kael: xp }), seeded);
  expect(await page.evaluate(() => window.__AWRUN__!.warp('respite'))).toBe('respite');
  expect(await page.evaluate(() => window.__AWRUN__!.scenesWaiting())).toEqual([scene.id]);
  const choice = page.getByTestId(`respite-scene-${scene.id}`);
  await expect(choice).toBeVisible();
  await expect(choice).toHaveAttribute('data-xp', String(sceneXp(scene)));

  // Past the arrival guard: 4 sits with Kael; 1 replies; Enter goes on, to the map.
  await page.waitForTimeout(700);
  await page.keyboard.press('4');
  await expect.poll(phase).toBe('scene');
  await expect(page.getByTestId('scene')).toHaveAttribute('data-scene', scene.id);
  await page.waitForTimeout(700);
  await page.keyboard.press('1');
  await expect(page.getByTestId('scene-response')).toContainText(scene.replies[0]!.response);
  await expect(page.getByTestId('scene-xp')).toContainText(String(sceneXp(scene)));
  await page.keyboard.press('Enter');
  await expect.poll(phase).toBe('map');

  // The scene is seen with that reply, and paid its Bond XP.
  b = await bonds();
  expect(b.heroes.kael!.seen).toEqual({ [scene.id]: 0 });
  expect(b.heroes.kael!.xp).toBe(seeded + sceneXp(scene));
  expect(b.run!.scene).toBeNull();
  expect(errors).toEqual([]);
});

test('Phase 4f: technique variants — choose in Prep with Skip the unlocks, embark, the fight plays them', async ({
  page,
}) => {
  test.setTimeout(180_000);
  const errors = trackErrors(page);
  const phase = () => page.evaluate(() => window.__AWRUN__!.phase());
  const techniques = () => page.evaluate(() => window.__AWRUN__!.techniques());
  // Content's variants, by place: the first of Ward's and Chime's, the second of Reel's and
  // Glide's (Skate, on its charges). Nothing here names one by its words.
  const of = (slot: string) => CONTENT.techniqueVariants.filter((v) => v.slot === slot);
  const ward = of('ward')[0]!;
  const chime = of('chime')[0]!;
  const reel = of('reel')[1]!;
  const glide = CONTENT.techniqueVariants.find((v) => v.slot === 'glide' && v.values.charges)!;
  const chosen = { ward: ward.id, chime: chime.id, reel: reel.id, glide: glide.id };
  const option = (id: string) => page.getByTestId(`technique-option-${id}`);
  const panel = page.getByTestId('prep-techniques');

  // A new profile: none owned, so the panel is folded; opened, every variant is locked and a
  // click says how it's had, changing nothing.
  await page.goto(START_URL);
  await page.waitForFunction(() => window.__AWRUN__ !== undefined);
  await page.evaluate(() => window.__AWRUN__!.newRun(4242));
  await expect.poll(phase).toBe('prep');
  await expect(panel).toHaveAttribute('data-expanded', 'false');
  await expect(page.getByTestId('techniques-folded')).toContainText(CONTENT.techniques.ward.name);
  await page.getByTestId('techniques-toggle').click();
  await expect(panel).toHaveAttribute('data-expanded', 'true');
  for (const v of CONTENT.techniqueVariants)
    await expect(option(v.id)).toHaveAttribute('data-open', 'false');
  // Locked (aria-disabled), so clicked on purpose: the panel says how it's had.
  await option(ward.id).click({ force: true });
  await expect(page.getByTestId('techniques-said')).toContainText(`${ward.name}: Starlight`);
  expect((await techniques()).chosen.ward).toBeNull();

  // Settings → Skip the unlocks: every variant open.
  await page.goto(START_URL);
  await page
    .getByRole('button', { name: /^Settings$/ })
    .first()
    .click();
  await page.getByText('Skip the unlocks', { exact: true }).click();
  await expect(page.getByRole('switch', { name: /Skip the unlocks/ })).toBeChecked();
  await page.evaluate(() => window.__AWRUN__!.newRun(4242));
  await expect.poll(phase).toBe('prep');
  if ((await panel.getAttribute('data-expanded')) !== 'true')
    await page.getByTestId('techniques-toggle').click();
  await expect(panel).toHaveAttribute('data-all', 'true');
  for (const v of CONTENT.techniqueVariants)
    await expect(option(v.id)).toHaveAttribute('data-open', 'true');

  // Choose: Ward's and Reel's by click, Chime's by the keyboard (down from the default), Glide's
  // by click. The profile keeps them; the run in Prep follows.
  await option(ward.id).click();
  await page.getByTestId('technique-option-chime-default').focus();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByTestId('technique-slot-chime')).toHaveAttribute('data-chosen', chime.id);
  await expect(option(chime.id)).toBeFocused();
  await option(reel.id).click();
  await option(glide.id).click();
  for (const [slot, id] of Object.entries(chosen)) {
    await expect(page.getByTestId(`technique-slot-${slot}`)).toHaveAttribute('data-chosen', id);
    await expect(option(id)).toHaveAttribute('aria-checked', 'true');
  }
  await expect(page.getByTestId('techniques-said')).toContainText(`${glide.name} on Space`);
  expect(await techniques()).toMatchObject({ all: true, owned: [], chosen, run: chosen });

  // Embark: the fight's config plays them, and the Weaver bar names them.
  await page
    .getByRole('button', { name: /Embark/i })
    .first()
    .click();
  await expect.poll(phase).toBe('map');
  expect(await page.evaluate(() => window.__AWRUN__!.choose())).toBe('skirmish');
  await expect.poll(phase).toBe('combat');
  await page.waitForFunction(() => window.__AW__ !== undefined);
  const config = await page.evaluate(() => window.__AW__!.exportReplay().config);
  expect(config.techniques).toEqual(chosen);
  if ((await page.getByRole('button', { name: /Begin the fight/i }).count()) > 0)
    await page.getByRole('button', { name: /Begin the fight/i }).click();
  for (const [slot, id] of Object.entries(chosen)) {
    const name = CONTENT.techniqueVariants.find((v) => v.id === id)!.name;
    await expect(page.getByTestId(`technique-${slot}`)).toHaveAttribute('data-variant', id);
    await expect(page.getByTestId(`technique-${slot}`)).toHaveAttribute('data-name', name);
  }
  const charges = glide.values.charges!;
  await expect(page.getByTestId('technique-glide')).toHaveAttribute(
    'data-charges',
    String(charges),
  );
  expect((await page.evaluate(() => window.__AW__!.techniques())).variants).toEqual(chosen);

  // The fight plays them, from real input: Kael threaded and the Ward's variant cast (on him, or
  // on the hero under the pointer): a Chorale's barriers, Perfect-capable on the hero Warded and
  // plain on the others it reached. Glide's charges spent one by one, the slot still ready while
  // one is left.
  await page.mouse.move(640, 300);
  await page.keyboard.press('Digit1');
  await waitTicks(page, 2);
  await expect(page.getByTestId('technique-ward')).toHaveAttribute('data-ready', 'true', {
    timeout: 30_000,
  });
  await page.keyboard.press('KeyQ');
  await waitTicks(page, 3);
  const replay = await page.evaluate(() => window.__AW__!.exportReplay());
  expect(
    replay.frames.flatMap(([, cmds]) => cmds).some((c) => c.t === 'tech' && c.id === 'ward'),
  ).toBe(true);
  if (ward.id === 'chorale') {
    const wards = async () =>
      (await page.evaluate(() => window.__AW__!.techniques())).heroes.flatMap((h) => h.wards);
    await expect
      .poll(async () => (await wards()).filter((w) => w.chorale && !w.plain).length)
      .toBe(1);
  }
  await page.keyboard.press('Space');
  await waitTicks(page, 15);
  let fight = await page.evaluate(() => window.__AW__!.techniques());
  expect(fight.maxGlideCharges).toBe(charges);
  expect(fight.glideCharges).toBe(charges - 1);
  await expect(page.getByTestId('technique-glide')).toHaveAttribute('data-ready', 'true');
  await expect(page.getByTestId('technique-glide')).toHaveAttribute(
    'data-charges',
    String(charges - 1),
  );
  for (let i = 1; i < charges; i++) {
    await page.keyboard.press('Space');
    await waitTicks(page, 15);
  }
  fight = await page.evaluate(() => window.__AW__!.techniques());
  expect(fight.glideCharges).toBe(0);
  await expect(page.getByTestId('technique-glide')).not.toHaveAttribute('data-ready', 'true');

  // Win it: the run keeps what it embarked with.
  expect(await page.evaluate(() => window.__AWRUN__!.winFight())).toBe(true);
  await expect.poll(phase).toBe('result');
  expect((await techniques()).run).toEqual(chosen);
  expect(errors).toEqual([]);
});

test('Phase 4g: the Loom — dark stations and the welcome; with Skip the unlocks the Atelier’s intro once, a robe bought with Starlight and worn', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const errors = trackErrors(page);
  const loom = () => page.evaluate(() => window.__AWRUN__!.loom());
  const station = (id: string) => page.locator(`[data-station="${id}"]`);
  const intro = page.getByTestId('station-intro');
  // Content's first robe, by place: nothing here names it.
  const robe = CONTENT.cosmetics.robes[0]!;
  await page.goto(START_URL);
  await page.waitForFunction(() => window.__AWRUN__ !== undefined);

  // The Title is the front door: no run yet, so Enter the Loom and Settings.
  const door = page.getByTestId('front-door');
  await expect(door.getByRole('button')).toHaveText(['Enter the Loom', 'Settings']);
  await door.getByRole('button', { name: 'Enter the Loom' }).click();

  // A new profile: the Gate, the Grounds and the Codex lit, every other station dark, saying
  // when it opens; the welcome plays at once, for the three.
  await expect(page.getByTestId('loom-screen')).toBeVisible();
  await expect(intro).toHaveAttribute('data-intro', 'gate');
  for (const id of ['gate', 'training', 'codex'])
    await expect(station(id)).toHaveAttribute('data-open', 'true');
  for (const id of ['astrolabe', 'atelier', 'reliquary', 'bonds', 'deeds', 'dissonance'])
    await expect(station(id)).toHaveAttribute('data-open', 'false');
  await expect(station('atelier')).toContainText(
    `Opens at Weaver Rank ${CONTENT.starlight.atelierRank}`,
  );
  await page.getByTestId('intro-next').click();
  await page.getByTestId('intro-next').click();
  await expect(page.getByTestId('intro-try')).toBeVisible();
  await page.getByTestId('intro-later').click();
  await expect(intro).toHaveCount(0);
  expect((await loom()).introduced.sort()).toEqual([
    'station:codex',
    'station:gate',
    'station:training',
  ]);
  // A dark station says when it opens, and nothing opens (aria-disabled: clicked on purpose).
  await station('atelier').click({ force: true });
  await expect(page.getByTestId('loom-said')).toContainText(
    `Opens at Weaver Rank ${CONTENT.starlight.atelierRank}`,
  );
  await expect(intro).toHaveCount(0);
  await expect(page.getByTestId('atelier-screen')).toHaveCount(0);

  // Settings, from the Loom: Skip the unlocks. Back in the Loom every station is lit, the Atelier
  // draws the eye, and the welcome doesn't play again.
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByText('Skip the unlocks', { exact: true }).click();
  await expect(page.getByRole('switch', { name: /Skip the unlocks/ })).toBeChecked();
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.getByTestId('loom-screen')).toBeVisible();
  await expect(station('atelier')).toHaveAttribute('data-open', 'true');
  await expect(station('atelier')).toHaveAttribute('data-fresh', 'true');
  await expect(intro).toHaveCount(0);

  // Its first visit plays its intro; Try it opens the Atelier, and the intro is recorded.
  await station('atelier').click();
  await expect(intro).toHaveAttribute('data-intro', 'atelier');
  while ((await page.getByTestId('intro-next').count()) > 0)
    await page.getByTestId('intro-next').click();
  await page.getByTestId('intro-try').click();
  await expect(page.getByTestId('atelier-screen')).toBeVisible();
  expect((await loom()).introduced).toContain('station:atelier');

  // Starlight given through the hook, one short of the robe: the purchase is refused, and says so.
  await page.evaluate((n) => window.__AWRUN__!.giveStarlight(n), robe.price - 1);
  await expect(page.getByTestId('atelier-starlight')).toHaveAttribute(
    'data-amount',
    String(robe.price - 1),
  );
  await page.getByTestId(`atelier-buy-${robe.id}`).click();
  await expect(page.getByTestId('atelier-said')).toContainText(`${robe.name}:`);
  await expect(page.getByTestId('atelier-said')).toContainText('1 more to go');
  expect((await loom()).cosmetics).toEqual([]);
  // One more: bought, the balance spent, then worn.
  await page.evaluate(() => window.__AWRUN__!.giveStarlight(1));
  await page.getByTestId(`atelier-buy-${robe.id}`).click();
  await expect(page.getByTestId(`atelier-item-${robe.id}`)).toHaveAttribute('data-state', 'owned');
  await expect(page.getByTestId('atelier-starlight')).toHaveAttribute('data-amount', '0');
  await page.getByTestId(`atelier-wear-${robe.id}`).click();
  await expect(page.getByTestId(`atelier-item-${robe.id}`)).toHaveAttribute('data-worn', 'true');
  await expect(page.getByTestId('atelier-preview')).toHaveAttribute('data-robe', robe.id);
  expect(await loom()).toMatchObject({
    starlight: 0,
    cosmetics: [robe.id],
    look: { robe: robe.id, thread: null, title: null },
  });

  // Esc goes back to the Loom, where the Weaver wears it; the Atelier's intro doesn't play again.
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('loom-weaver')).toHaveAttribute('data-robe', robe.id);
  await station('atelier').click();
  await expect(page.getByTestId('atelier-screen')).toBeVisible();
  await expect(intro).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('Phase 4g: a normal build has no playtest demo — no choice at the front door, none in Settings', async ({
  page,
}) => {
  const errors = trackErrors(page);
  await page.goto(START_URL);
  await expect(page.getByTestId('front-door')).toBeVisible();
  await expect(page.getByTestId('demo-choice')).toHaveCount(0);
  await expect(page.getByTestId('playtest-line')).toHaveCount(0);
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.getByText('Skip the unlocks', { exact: true })).toBeVisible();
  await expect(page.getByTestId('demo-over')).toHaveCount(0);
  expect(errors).toEqual([]);
});

/**
 * Phase 4g: presses the Ward key once the training bell's blow is inside its Perfect window, by
 * the sim's clock (`__AW__.drill()`). The sim runs slowly through the windup, so the real key
 * press has room whatever the frame rate and the machine's load; between blows it runs fast.
 */
async function wardInTheWindow(page: Page): Promise<void> {
  await page.waitForFunction(() => window.__AW__!.drill() !== null, undefined, {
    timeout: 90_000,
  });
  await page.evaluate(() => window.__AW__!.setDevTimeScale(0.2));
  await page.waitForFunction(
    () => {
      const d = window.__AW__!.drill();
      return d !== null && d.time >= d.perfectFrom + 0.05;
    },
    undefined,
    { timeout: 90_000 },
  );
  await page.keyboard.press('KeyQ');
}

test('Phase 4g: the Perfect-Ward trainer — a slow drill on Kael, Warded in the window is Perfect, the streak counts', async ({
  page,
}) => {
  test.setTimeout(240_000);
  const errors = trackErrors(page);
  await enterTraining(page);
  // The pointer on the empty floor: Q Wards the threaded hero, not one under the pointer.
  await page.mouse.move(180, 260);
  const trainer = page.getByTestId('ward-trainer');
  await expect(trainer).toBeVisible();
  // Keyboard only: the speed, the hero and Start, each focused and pressed with Enter.
  for (const id of ['drill-mode-slow', 'drill-target-0', 'drill-start']) {
    await page.getByTestId(id).focus();
    await page.keyboard.press('Enter');
  }
  await expect(page.getByTestId('drill-mode-slow')).toHaveAttribute('aria-pressed', 'true');
  await expect(trainer).toHaveAttribute('data-running', 'true');
  // The hero key Threads Kael, so Q Wards him.
  await page.keyboard.press('Digit1');
  await waitTicks(page, 2);
  expect((await weaverOf(page)).threadSlot).toBe(0);

  for (const streak of [1, 2]) {
    await wardInTheWindow(page);
    // This try's verdict: the history gains it (until then, the last try's result still shows).
    await expect(page.getByTestId('drill-history').locator('li')).toHaveCount(streak, {
      timeout: 60_000,
    });
    const result = page.getByTestId('drill-result');
    await expect(result).toHaveAttribute('data-kind', 'perfect');
    await expect(result).toContainText('Perfect');
    await expect(page.getByTestId('drill-streak')).toHaveAttribute('data-streak', String(streak));
    await expect(page.getByTestId('drill-streak')).toHaveAttribute('data-best', String(streak));
    // That blow has landed; the next comes on the beat, the sim readying the Ward for it.
    expect(await page.evaluate(() => window.__AW__!.drill())).toBeNull();
    await page.evaluate(() => window.__AW__!.setDevTimeScale(3));
  }
  // The blows don't hurt: Kael is whole.
  const kael = (await page.evaluate(() => window.__AW__!.snapshot().entities)).find(
    (e) => e.defId === 'kael',
  )!;
  expect(kael.hp).toBe(kael.maxHp);

  await page.getByTestId('drill-start').click();
  await expect(trainer).toHaveAttribute('data-running', 'false');
  // Leaving the Grounds goes back to the Loom, the hub they're a station of.
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: /Leave Training Grounds/ }).click();
  await expect(page.getByTestId('loom-screen')).toBeVisible();
  expect(errors).toEqual([]);
});

test('Phase 4g: Starlight — a won fight’s Result shows what it paid', async ({ page }) => {
  const errors = trackErrors(page);
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
  // First Light, a skirmish, won through the hook.
  expect(await page.evaluate(() => window.__AWRUN__!.choose())).toBe('skirmish');
  await expect.poll(phase).toBe('combat');
  expect(await page.evaluate(() => window.__AWRUN__!.winFight())).toBe(true);
  await expect.poll(phase).toBe('result');

  const pay = CONTENT.starlight.fights.skirmish;
  const gain = page.getByTestId('starlight-gain');
  await expect(gain).toBeVisible();
  await expect(gain).toHaveAttribute('data-amount', String(pay));
  await expect(gain).toContainText(`+${pay} Starlight`);
  // Beside the fight's Weaver XP, with the balance it leaves.
  await expect(page.getByTestId('xp-gain')).toBeVisible();
  await expect(gain).toContainText(`${pay} to spend`);
  // A new profile is below the Atelier's Rank: the line says when it opens.
  await expect(gain.getByTestId('starlight-use')).toContainText(
    `Weaver Rank ${CONTENT.starlight.atelierRank}`,
  );
  expect(errors).toEqual([]);
});
