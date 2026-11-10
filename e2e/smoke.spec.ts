import { expect, test, type Page } from '@playwright/test';
import { CONTENT, deedText, inscriptionDef, relicText } from '../src/content';
import { FILL_BOONS, FILL_EVENTS, FILL_MOTIFS, FILL_RELICS } from '../src/content/fill';
import { DEED_POINTS_MAX, deedPoints } from '../src/meta/deeds';
import { dissonancePoints, fitLevels, xpMult } from '../src/meta/dissonance';
import { altSoloOf, sceneXp, talentChoices } from '../src/meta/bonds';
import { newProfile, rankOf } from '../src/meta/profile';
import * as Run from '../src/meta/run';
import type { MapNode, RunState } from '../src/meta/types';
import { createSim, type Replay } from '../src/sim';
import { runWithoutYou } from '../src/sim/counterfactual';
import { FILL_GLYPHS } from '../src/ui/kit/iconPaths';
import { deedsInSight } from '../src/ui/screens/routeText';
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

/**
 * Phase 5b: what Prep shows of the party (docs/phase-5b.md, "Choosing the party"). With three
 * heroes in the roster there is no picker; with more (Skip the unlocks, or a recruit) it opens on
 * the default party, so a flow that never touches it embarks Kael, Lyra and Vexis with no clicks.
 */
async function expectDefaultPrep(page: Page, picker: boolean): Promise<void> {
  await expect(page.getByTestId('prep-party')).toHaveCount(picker ? 1 : 0);
  if (picker) {
    for (const h of CONTENT.heroes) {
      const card = page.getByTestId(`prep-pick-${h.id}`);
      if (CONTENT.defaultParty.includes(h.id))
        await expect(card).toHaveAttribute('data-selected', 'true');
      // Phase 5e: a recruit outside this roster has no card at all; one inside it isn't picked.
      else
        await expect(page.locator(`[data-testid="prep-pick-${h.id}"][data-selected]`)).toHaveCount(
          0,
        );
    }
  }
  expect(await page.evaluate(() => window.__AWRUN__!.party())).toEqual(CONTENT.defaultParty);
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
  await expectDefaultPrep(page, false);
  await page
    .getByRole('button', { name: /Embark/i })
    .first()
    .click();
  await expect.poll(() => page.evaluate(() => window.__AWRUN__!.phase())).toBe('map');
  expect(await page.evaluate(() => window.__AWRUN__!.party())).toEqual(CONTENT.defaultParty);

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

test('Phase 5a/5c/5d: an Expedition — past the Cantor, Vharun and the Unweaver to the Finale, the Silent Conductor, the epilogue, the Summary', async ({
  page,
}) => {
  test.setTimeout(300_000);
  const errors = trackErrors(page);
  const phase = () => page.evaluate(() => window.__AWRUN__!.phase());
  const movement = () => page.evaluate(() => window.__AWRUN__!.movement());
  await page.goto(START_URL);
  await page.waitForFunction(() => window.__AWRUN__ !== undefined);
  // Settings → Skip the unlocks opens Expeditions (a new profile is Rank 1).
  await page
    .getByRole('button', { name: /^Settings$/ })
    .first()
    .click();
  await page.getByText('Skip the unlocks', { exact: true }).click();
  await expect(page.getByRole('switch', { name: /Skip the unlocks/ })).toBeChecked();
  // The first run is still the Prelude; asked for, the Expedition is taken.
  await page.evaluate(() => window.__AWRUN__!.newRun(4242));
  await expect.poll(phase).toBe('prep');
  expect(await movement()).toEqual({ movements: 1, here: 1, map: 1 });
  await page.evaluate(() => window.__AWRUN__!.newRun(4242, 'expedition'));
  await expect.poll(phase).toBe('prep');
  // Phase 5d: an Expedition is every Movement in content (I–III and the Finale).
  expect(await movement()).toEqual({ movements: 4, here: 1, map: 1 });
  await expectDefaultPrep(page, true);
  await page
    .getByRole('button', { name: /Embark/i })
    .first()
    .click();
  await expect.poll(phase).toBe('map');
  expect(await page.evaluate(() => window.__AWRUN__!.party())).toEqual(CONTENT.defaultParty);

  // To Movement II's doorstep: the Cantor behind, the Crimson Gate next.
  expect(await page.evaluate(() => window.__AWRUN__!.warpMovement(2))).toBe('map');
  expect(await movement()).toEqual({ movements: 4, here: 1, map: 2 });
  expect(await page.evaluate(() => window.__AWRUN__!.choose())).toBe('skirmish');
  await expect.poll(phase).toBe('combat');
  await page.waitForFunction(() => window.__AW__ !== undefined);
  await expect.poll(() => page.evaluate(() => window.__AW__!.encounter().id)).toBe('crimson_gate');
  // Movement II's fight: the sim scales it from the encounter's Movement.
  const config = await page.evaluate(() => window.__AW__!.exportReplay().config);
  expect(config.encounter).toBe('crimson_gate');
  expect(await page.evaluate(() => window.__AWRUN__!.winFight())).toBe(true);
  await expect.poll(phase).toBe('result');
  await page.evaluate(() => window.__AWRUN__!.continue());
  await expect.poll(phase).toBe('draft');
  await page.evaluate(() => window.__AWRUN__!.pick(0));
  await expect.poll(phase).toBe('map');
  expect(await movement()).toEqual({ movements: 4, here: 2, map: 2 });

  // Vharun, the Crimson Warden: an interlude now (docs/phase-5c.md), relic → draft → map.
  expect(await page.evaluate(() => window.__AWRUN__!.warp('boss'))).toBe('combat');
  await page.waitForFunction(() => window.__AW__ !== undefined);
  await expect.poll(() => page.evaluate(() => window.__AW__!.encounter().id)).toBe('vharun');
  expect(await page.evaluate(() => window.__AWRUN__!.winFight())).toBe(true);
  await expect.poll(phase).toBe('result');
  expect(await page.evaluate(() => window.__AWRUN__!.outcome())).toBeNull();
  await page.evaluate(() => window.__AWRUN__!.continue());
  await expect.poll(phase).toBe('relic');
  await page.evaluate(() => window.__AWRUN__!.pickRelic(0));
  await expect.poll(phase).toBe('draft');
  await page.evaluate(() => window.__AWRUN__!.pick(0));
  await expect.poll(phase).toBe('map');
  expect(await movement()).toEqual({ movements: 4, here: 2, map: 3 });
  // The Abyssal Rift's map: its one-time title card, then its header.
  const card = page.getByTestId('movement-card');
  await expect(card).toBeVisible();
  await expect(card).toContainText('Movement III · The Unstitched');
  await card.getByRole('button', { name: /Descend/ }).click();
  await expect(card).toHaveCount(0);
  await expect(page.locator('[data-movement="3"]')).toBeVisible();
  await expect(page.getByText(/Movement III · The Unstitched · step 1 of 6/)).toBeVisible();

  // Movement III's opening: the Frayed Threshold.
  expect(await page.evaluate(() => window.__AWRUN__!.choose())).toBe('skirmish');
  // Building the Rift's arena under SwiftShader can take a few seconds on a busy machine.
  await expect.poll(phase, { timeout: 30_000 }).toBe('combat');
  await page.waitForFunction(() => window.__AW__ !== undefined);
  await expect
    .poll(() => page.evaluate(() => window.__AW__!.encounter().id))
    .toBe('frayed_threshold');
  expect(await page.evaluate(() => window.__AWRUN__!.winFight())).toBe(true);
  await expect.poll(phase).toBe('result');
  await page.evaluate(() => window.__AWRUN__!.continue());
  await expect.poll(phase).toBe('draft');
  await page.evaluate(() => window.__AWRUN__!.pick(0));
  await expect.poll(phase).toBe('map');
  expect(await movement()).toEqual({ movements: 4, here: 3, map: 3 });

  // The Unweaver: an interlude on the Finale route (docs/phase-5d.md), relic → draft → map.
  expect(await page.evaluate(() => window.__AWRUN__!.warp('boss'))).toBe('combat');
  await page.waitForFunction(() => window.__AW__ !== undefined);
  await expect.poll(() => page.evaluate(() => window.__AW__!.encounter().id)).toBe('the_unweaver');
  expect(await page.evaluate(() => window.__AWRUN__!.winFight())).toBe(true);
  await expect.poll(phase).toBe('result');
  expect(await page.evaluate(() => window.__AWRUN__!.outcome())).toBeNull();
  await page.evaluate(() => window.__AWRUN__!.continue());
  await expect.poll(phase).toBe('relic');
  await page.evaluate(() => window.__AWRUN__!.pickRelic(0));
  await expect.poll(phase).toBe('draft');
  await page.evaluate(() => window.__AWRUN__!.pick(0));
  await expect.poll(phase).toBe('map');
  expect(await movement()).toEqual({ movements: 4, here: 3, map: 4 });
  // The Finale's map: its one-time title card, then its one stop.
  const finaleCard = page.getByTestId('movement-card');
  await expect(finaleCard).toBeVisible();
  await expect(finaleCard).toContainText('The Finale · The Celestial Crucible');
  await finaleCard.getByRole('button', { name: /Ascend/ }).click();
  await expect(finaleCard).toHaveCount(0);
  await expect(page.locator('[data-movement="4"]')).toBeVisible();
  await expect(page.getByText(/The Finale · The Celestial Crucible · step 1 of 1/)).toBeVisible();

  // The Silent Conductor: the run's last stop.
  expect(await page.evaluate(() => window.__AWRUN__!.choose())).toBe('boss');
  await expect.poll(phase, { timeout: 30_000 }).toBe('combat');
  await page.waitForFunction(() => window.__AW__ !== undefined);
  await expect
    .poll(() => page.evaluate(() => window.__AW__!.encounter().id))
    .toBe('the_silent_conductor');
  expect(await page.evaluate(() => window.__AWRUN__!.winFight())).toBe(true);
  await expect.poll(phase).toBe('result');
  await page.evaluate(() => window.__AWRUN__!.continue());
  await expect.poll(phase).toBe('summary');
  expect(await page.evaluate(() => window.__AWRUN__!.outcome())).toBe('victory');
  expect(await page.evaluate(() => window.__AWRUN__!.results())).toBe(5);
  // The epilogue (≤ 20 s, skippable) comes first: the Rank-up and Bond cards wait for it, so
  // nothing covers it or its Skip.
  const epilogue = page.getByTestId('epilogue');
  const rankUp = page.getByTestId('rank-up');
  const bondCard = page.getByTestId('bond-rank-up');
  await expect(epilogue).toBeVisible();
  await expect(page.getByTestId('epilogue-line').first()).toBeVisible();
  await expect(rankUp).toHaveCount(0);
  await expect(bondCard).toHaveCount(0);
  await page.getByTestId('epilogue-skip').click();
  await expect(epilogue).toHaveCount(0);
  // Then the cards, as before: the Weaver's Rank-up, then the run's first Bond rank (its intro).
  if ((await rankUp.count()) > 0) await rankUp.getByRole('button', { name: /Onward/ }).click();
  await expect(rankUp).toHaveCount(0);
  await expect(bondCard).toBeVisible();
  await expect(bondCard).toHaveAttribute('data-first', 'true');
  await bondCard.getByRole('button', { name: /Onward/ }).click();
  await expect(bondCard).toHaveCount(0);
  // The Summary: the song goes on.
  await expect(page.getByRole('heading', { name: 'The song goes on' })).toBeVisible();
  await expect(
    page.getByText('The Silent Conductor lowers its baton, and the song goes on.'),
  ).toBeVisible();
  await expect(page.getByTestId('summary-songs')).toBeVisible();

  // A second Expedition, won through the hook: winRun walks past the Cantor, Vharun and the
  // Unweaver to the Silent Conductor.
  await page.evaluate(() => window.__AWRUN__!.newRun(4243, 'expedition'));
  await expect.poll(phase).toBe('prep');
  await page
    .getByRole('button', { name: /Embark/i })
    .first()
    .click();
  await expect.poll(phase).toBe('map');
  expect(await page.evaluate(() => window.__AWRUN__!.winRun())).toBe(true);
  await expect.poll(phase).toBe('summary');
  expect(await movement()).toMatchObject({ movements: 4, here: 4 });
  // Its own epilogue (a new victory), skipped from the keyboard: Enter is the epilogue's alone.
  // Neither the Summary's autofocused New run nor a card hears it, and while it is held the cards
  // wait (its auto-repeat would press their Onward).
  const cards = page.locator('[data-testid="rank-up"], [data-testid="bond-rank-up"]');
  await expect(epilogue).toBeVisible();
  await expect(cards).toHaveCount(0);
  // Past the arrival guard (a press as the screen arrives is swallowed).
  await page.waitForTimeout(700);
  await page.keyboard.down('Enter');
  await expect(epilogue).toHaveCount(0);
  await expect(cards).toHaveCount(0);
  await page.keyboard.up('Enter');
  // Let go: the run's card follows, and the Enter that skipped the epilogue never dismissed it.
  await expect(cards).toHaveCount(1);
  await expect(cards).toBeVisible();
  await expect.poll(phase).toBe('summary');
  expect(errors).toEqual([]);
});

test('Phase 5c: Movement III — the Rift’s map, a Rift fight’s HUD, and Glide never greys', async ({
  page,
}) => {
  test.setTimeout(180_000);
  const errors = trackErrors(page);
  const phase = () => page.evaluate(() => window.__AWRUN__!.phase());
  const movement = () => page.evaluate(() => window.__AWRUN__!.movement());
  await page.goto(START_URL);
  await page.waitForFunction(() => window.__AWRUN__ !== undefined);
  await page
    .getByRole('button', { name: /^Settings$/ })
    .first()
    .click();
  await page.getByText('Skip the unlocks', { exact: true }).click();
  await expect(page.getByRole('switch', { name: /Skip the unlocks/ })).toBeChecked();
  await page.evaluate(() => window.__AWRUN__!.newRun(5151, 'expedition'));
  await expect.poll(phase).toBe('prep');
  // Prep names the whole route: Movements I–III and the Finale, to the Silent Conductor.
  await expect(page.getByTestId('prep-route')).toContainText('Movements II–III and the Finale');
  await expect(page.getByTestId('prep-route')).toContainText(
    'Movements I–III and the Finale, to the Silent Conductor.',
  );
  await page
    .getByRole('button', { name: /Embark/i })
    .first()
    .click();
  await expect.poll(phase).toBe('map');

  // Straight to Movement III's doorstep: the Rift's map (header, its frayed backdrop). The title
  // card shows on arriving from a fight (the first test); the warp keeps the map mounted.
  expect(await page.evaluate(() => window.__AWRUN__!.warpMovement(3))).toBe('map');
  expect(await movement()).toEqual({ movements: 4, here: 2, map: 3 });
  await expect(page.locator('[data-movement="3"]')).toBeVisible();
  await expect(page.getByText(/Movement III · The Unstitched · step 1 of 6/)).toBeVisible();
  await expect(page.getByTestId('backdrop-fray')).toHaveCount(1);
  expect(await page.evaluate(() => window.__AWRUN__!.choose())).toBe('skirmish');
  // Building the Rift's arena under SwiftShader can take a few seconds on a busy machine.
  await expect.poll(phase, { timeout: 30_000 }).toBe('combat');
  await page.waitForFunction(() => window.__AW__ !== undefined);
  await expect
    .poll(() => page.evaluate(() => window.__AW__!.encounter().id))
    .toBe('frayed_threshold');
  // The HUD: Glide is never rune-locked, and no Movement III key shows before its mechanic.
  await expect(page.getByTestId('weaver-bar')).toBeVisible();
  await expect(page.getByTestId('technique-glide')).not.toHaveAttribute('data-rune-locked', 'true');
  await expect(page.getByTestId('rune-lock')).toHaveCount(0);
  expect(await page.evaluate(() => window.__AWRUN__!.winFight())).toBe(true);
  await expect.poll(phase).toBe('result');
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
  await expectDefaultPrep(page, false);
  await page
    .getByRole('button', { name: /Embark/i })
    .first()
    .click();
  await expect.poll(() => page.evaluate(() => window.__AWRUN__!.phase())).toBe('map');
  expect(await page.evaluate(() => window.__AWRUN__!.party())).toEqual(CONTENT.defaultParty);
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
  await expectDefaultPrep(page, true);
  await page
    .getByRole('button', { name: /Embark/i })
    .first()
    .click();
  await expect.poll(() => page.evaluate(() => window.__AWRUN__!.phase())).toBe('map');
  expect(await page.evaluate(() => window.__AWRUN__!.party())).toEqual(CONTENT.defaultParty);
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
  await expectDefaultPrep(page, true);
  await page
    .getByRole('button', { name: /Embark/i })
    .first()
    .click();
  await expect.poll(() => page.evaluate(() => window.__AWRUN__!.phase())).toBe('map');
  expect(await page.evaluate(() => window.__AWRUN__!.party())).toEqual(CONTENT.defaultParty);

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
  await expectDefaultPrep(page, true);
  await page
    .getByRole('button', { name: /Embark/i })
    .first()
    .click();
  await expect.poll(() => page.evaluate(() => window.__AWRUN__!.phase())).toBe('map');
  expect(await page.evaluate(() => window.__AWRUN__!.party())).toEqual(CONTENT.defaultParty);

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

test('Phase 5f: the Conductor — choose him in Prep, Cue cost on the meter, two Cues within the window make a Duet', async ({
  page,
}) => {
  // The Solos take about 30 s of the fight to charge (SwiftShader runs it slower than that).
  test.setTimeout(420_000);
  const errors = trackErrors(page);
  const conductor = CONTENT.callings.find((c) => c.id === 'conductor')!;
  await page.goto(START_URL);
  await page.waitForFunction(() => window.__AWRUN__ !== undefined);
  // Settings → Skip the unlocks (a new profile is Rank 1: the Conductor is Rank 12).
  await page
    .getByRole('button', { name: /^Settings$/ })
    .first()
    .click();
  await page.getByText('Skip the unlocks', { exact: true }).click();
  await expect(page.getByRole('switch', { name: /Skip the unlocks/ })).toBeChecked();

  await page.evaluate(() => window.__AWRUN__!.newRun(4242));
  await expect.poll(() => page.evaluate(() => window.__AWRUN__!.phase())).toBe('prep');
  // Four Callings beside No Calling; choose the Conductor.
  await expect(page.getByTestId('calling-conductor')).toBeVisible();
  await page.getByRole('radio', { name: /^The Conductor/ }).click();
  await expect(page.getByRole('radio', { name: /^The Conductor.*chosen/ })).toBeVisible();
  expect(await page.evaluate(() => window.__AWRUN__!.calling())).toEqual({
    id: 'conductor',
    path: [null, null, null, null],
  });
  await expectDefaultPrep(page, true);
  await page
    .getByRole('button', { name: /Embark/i })
    .first()
    .click();
  await expect.poll(() => page.evaluate(() => window.__AWRUN__!.phase())).toBe('map');

  // Into First Light.
  expect(await page.evaluate(() => window.__AWRUN__!.choose())).toBe('skirmish');
  await expect.poll(() => page.evaluate(() => window.__AWRUN__!.phase())).toBe('combat');
  await page.waitForFunction(() => window.__AW__ !== undefined);
  // A new profile's first fight opens the primer; on his run its Cue row teaches Duets.
  const begin = page.getByRole('button', { name: /Begin the fight/i });
  if (await begin.isVisible().catch(() => false)) {
    await expect(page.getByText('Lead them: Duets and Trios')).toBeVisible();
    await begin.click();
  }
  // His Cue cost (content's), marked on the Resonance meter; his chip is up.
  await expect(page.getByTestId('cue-cost')).toHaveText(`Cue ${conductor.values.cue}`);
  await expect(page.getByTestId('calling-chip')).toBeVisible();
  // Thread Lyra and Empower her: Empower fills Resonance while the Solos charge.
  await page.mouse.move(640, 300);
  await page.keyboard.press('Digit2');
  await waitTicks(page, 2);
  await page.mouse.click(640, 360, { button: 'right' });
  await waitTicks(page, 2);
  expect((await weaverOf(page)).threadMode).toBe('empower');
  // Two heroes ready, with Resonance for two Cues (the meter's own value).
  const frames = page.getByTestId('party-frames').getByRole('button');
  const readySlots = async () => {
    const out: number[] = [];
    for (let i = 0; i < 3; i++)
      if (/READY/.test((await frames.nth(i).textContent()) ?? '')) out.push(i);
    return out;
  };
  const meter = page.getByRole('meter', { name: 'Resonance' });
  // The wait runs the fight faster; the Cues are given at its own pace.
  await page.evaluate(() => window.__AW__!.setDevTimeScale(3));
  await expect
    .poll(
      async () =>
        (await readySlots()).length >= 2 &&
        Number(await meter.getAttribute('aria-valuenow')) >= 2 * conductor.values.cue!,
      { timeout: 300_000, intervals: [250] },
    )
    .toBe(true);
  await page.evaluate(() => window.__AW__!.setDevTimeScale(1));
  const [a, b] = await readySlots();
  // The first Cue opens a chain: the other ready hero's badge reads Duet, its ring drains.
  await page.keyboard.press(`Shift+Digit${a! + 1}`);
  await expect(page.getByTestId('chain-ring')).toBeVisible();
  await expect(frames.nth(b!).getByTestId('cue-badge')).toContainText(
    `Duet ×${1 + conductor.values.duet! / 100}`,
  );
  // The second within the window: a Duet, and its gold call-out.
  await page.keyboard.press(`Shift+Digit${b! + 1}`);
  await expect(page.getByText(/^DUET · /)).toBeVisible();
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
  await expectDefaultPrep(page, true);
  await page
    .getByRole('button', { name: /Embark/i })
    .first()
    .click();
  await expect.poll(() => page.evaluate(() => window.__AWRUN__!.phase())).toBe('map');
  expect(await page.evaluate(() => window.__AWRUN__!.party())).toEqual(CONTENT.defaultParty);
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
  await expectDefaultPrep(page, false);
  await page
    .getByRole('button', { name: /Embark/i })
    .first()
    .click();
  await expect.poll(phase).toBe('map');
  expect(await page.evaluate(() => window.__AWRUN__!.party())).toEqual(CONTENT.defaultParty);

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
  // A Movement I profile: the Legion's Deeds wait until it's met (docs/phase-5a.md).
  const inSight = deedsInSight(newProfile().seen);
  expect(inSight.length).toBeLessThan(CONTENT.deeds.length);
  await expect(page.getByTestId('deeds-header')).toHaveText(
    `${both.length} of ${inSight.length} earned · ${deedPoints(both)} of ${DEED_POINTS_MAX} Astrolabe points from Deeds`,
  );
  for (const d of inSight)
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
  await expectDefaultPrep(page, true);
  await page
    .getByRole('button', { name: /Embark/i })
    .first()
    .click();
  await expect.poll(phase).toBe('map');
  expect(await page.evaluate(() => window.__AWRUN__!.party())).toEqual(CONTENT.defaultParty);
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
  await expectDefaultPrep(page, true);
  await page
    .getByRole('button', { name: /Embark/i })
    .first()
    .click();
  await expect.poll(phase).toBe('map');
  expect(await page.evaluate(() => window.__AWRUN__!.party())).toEqual(CONTENT.defaultParty);
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
  await expectDefaultPrep(page, true);
  await page
    .getByRole('button', { name: /Embark/i })
    .first()
    .click();
  await expect.poll(phase).toBe('map');
  expect(await page.evaluate(() => window.__AWRUN__!.party())).toEqual(CONTENT.defaultParty);
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
  await expectDefaultPrep(page, true);
  await page
    .getByRole('button', { name: /Embark/i })
    .first()
    .click();
  await expect.poll(phase).toBe('map');
  expect(await page.evaluate(() => window.__AWRUN__!.party())).toEqual(CONTENT.defaultParty);
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
  await expectDefaultPrep(page, false);
  await page
    .getByRole('button', { name: /Embark/i })
    .first()
    .click();
  await expect.poll(phase).toBe('map');
  expect(await page.evaluate(() => window.__AWRUN__!.party())).toEqual(CONTENT.defaultParty);
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

test('Phase 5b: the roster — a veteran recruits Brann, picks him in Prep, fights beside him; his frame and his Summary line', async ({
  page,
}) => {
  // A whole First Light, autoplayed, under SwiftShader.
  test.setTimeout(480_000);
  const errors = trackErrors(page);
  const phase = () => page.evaluate(() => window.__AWRUN__!.phase());
  await page.goto(START_URL);
  await page.waitForFunction(() => window.__AWRUN__ !== undefined);
  // The demo's veteran, with Brann still in his cell: three heroes, so Prep is today's.
  await page.evaluate(() => window.__AWRUN__!.veteran());
  await page.evaluate(() => window.__AWRUN__!.newRun(5150));
  await expect.poll(phase).toBe('prep');
  await expectDefaultPrep(page, false);
  await expect(page.getByTestId('prep-passive-brann')).toHaveCount(0);

  // Freed (the hook stands in for the Cell's fight): the roster is four, and Prep's picker opens
  // on the default party.
  expect(await page.evaluate(() => window.__AWRUN__!.recruit(['brann']))).toEqual([
    'kael',
    'lyra',
    'vexis',
    'brann',
  ]);
  await expectDefaultPrep(page, true);
  // A full pick: Brann waits for a hero to be dropped.
  await expect(page.getByTestId('prep-pick-brann')).toContainText('Drop one first');
  await page.getByTestId('prep-pick-vexis').click();
  await expect(page.getByTestId('prep-pick-vexis')).not.toHaveAttribute('data-selected');
  await page.getByTestId('prep-pick-brann').click();
  await expect(page.getByTestId('prep-pick-brann')).toHaveAttribute('data-selected', 'true');
  // Content order: he takes the third key.
  await expect(page.getByTestId('prep-pick-brann')).toHaveAttribute('data-key', '3');
  // No Vexis: Prep names what the party now lacks. His card: the Passive and Needs rows.
  await expect(page.getByTestId('prep-party-notes')).toContainText('Gravity Well');
  await expect(page.getByTestId('prep-passive-brann')).toContainText('Blood Rage');
  await expect(page.getByTestId('prep-needs-brann')).toContainText('Wards and barriers');
  expect(await page.evaluate(() => window.__AWRUN__!.party())).toEqual(['kael', 'lyra', 'brann']);
  await page
    .getByRole('button', { name: /Embark/i })
    .first()
    .click();
  await expect.poll(phase).toBe('map');
  expect(await page.evaluate(() => window.__AWRUN__!.party())).toEqual(['kael', 'lyra', 'brann']);

  // First Light, beside him.
  expect(await page.evaluate(() => window.__AWRUN__!.choose())).toBe('skirmish');
  await expect.poll(phase).toBe('combat');
  await page.waitForFunction(() => window.__AW__ !== undefined);
  await expect.poll(() => page.evaluate(() => window.__AW__!.encounter().id)).toBe('first_light');
  const begin = page.getByRole('button', { name: /Begin the fight/i });
  if (await begin.isVisible()) await begin.click();
  const config = await page.evaluate(() => window.__AW__!.exportReplay().config);
  expect((config.party ?? []).map((h) => h.heroId)).toEqual(['kael', 'lyra', 'brann']);
  // His frame: key 3, his Bloodlust and critical lines on the bar, his raging band.
  const frame = page.getByTestId('party-frames').getByRole('button', { name: /^Thread Brann/ });
  await expect(frame.getByTestId('frame-key')).toHaveAttribute('data-key', '3');
  await expect(frame.getByTestId('blood-tick')).toHaveCount(2);
  await expect(frame.getByTestId('raging-band')).toHaveCount(1);
  // The starters' frames have none of it.
  const kael = page.getByTestId('party-frames').getByRole('button', { name: /^Thread Kael/ });
  await expect(kael.getByTestId('blood-tick')).toHaveCount(0);
  await page.evaluate(() => window.__AW__!.autoplay('skilled'));
  await page.evaluate(() => window.__AW__!.setDevTimeScale(2));
  // Once the fight is on, his first fight beside you shows the 'New ally' card.
  await expect(page.getByTestId('new-ally')).toHaveAttribute('data-ally', 'brann', {
    timeout: 30_000,
  });
  // Hurt, he hits harder: Blood Rage's chip.
  await expect(frame.getByTestId('blood-rage')).toBeVisible({ timeout: 120_000 });
  await expect.poll(phase, { timeout: 420_000, intervals: [2000] }).toBe('result');
  expect(await page.evaluate(() => window.__AWRUN__!.outcome())).toBeNull();
  // The Result: his fight's line.
  if ((await page.getByTestId('rank-up').count()) > 0)
    await page.getByRole('button', { name: /Onward/ }).click();
  await expect(page.getByTestId('blood-line')).toContainText(
    /^Under 40%: \d+% of the fight · Lifesteal [\d,]+ · Your healing on him: halved$/,
  );
  await page.evaluate(() => window.__AWRUN__!.continue());
  // A veteran's run is the Finale route (every Movement): First Light, on its shorter Movement I
  // road, pays a relic offer and then a rare motif (docs/phase-5d.md, "Bands").
  expect(await page.evaluate(() => window.__AWRUN__!.movement())).toMatchObject({ movements: 4 });
  await expect.poll(phase).toBe('relic');
  await page.evaluate(() => window.__AWRUN__!.pickRelic(0));
  await expect.poll(phase).toBe('draft');
  await page.evaluate(() => window.__AWRUN__!.pick(0));
  await expect.poll(phase).toBe('map');

  // The run won through the hook: the Summary carries his line for the run.
  expect(await page.evaluate(() => window.__AWRUN__!.winRun())).toBe(true);
  await expect.poll(phase).toBe('summary');
  if ((await page.getByTestId('rank-up').count()) > 0)
    await page.getByRole('button', { name: /Onward/ }).click();
  await expect(page.getByTestId('blood-line')).toContainText(
    /^Under 40%: \d+% of the run · Lifesteal [\d,]+ · Your healing on him: halved$/,
  );
  expect(errors).toEqual([]);
});

test('Phase 5e: the roster of six — a veteran recruits Brann, Seren and Oro, picks Kael, Seren and Oro, fights beside them; their frames and their Result and Summary lines', async ({
  page,
}) => {
  // A whole First Light, autoplayed, under SwiftShader.
  test.setTimeout(480_000);
  const errors = trackErrors(page);
  const phase = () => page.evaluate(() => window.__AWRUN__!.phase());
  await page.goto(START_URL);
  await page.waitForFunction(() => window.__AWRUN__ !== undefined);
  // The demo's veteran (Rank 12) has met neither: three heroes, so Prep is today's.
  await page.evaluate(() => window.__AWRUN__!.veteran());
  await page.evaluate(() => window.__AWRUN__!.newRun(5151));
  await expect.poll(phase).toBe('prep');
  await expectDefaultPrep(page, false);
  await expect(page.getByTestId('prep-passive-seren')).toHaveCount(0);

  // Recruited (the hook stands in for Brann's cell, the Tithe Altar and the Loose Thread): all six
  // heroes, laid out three across in two rows (3 × 2), the picker open on the default party.
  expect(await page.evaluate(() => window.__AWRUN__!.recruit(['brann', 'seren', 'oro']))).toEqual([
    'kael',
    'lyra',
    'vexis',
    'brann',
    'seren',
    'oro',
  ]);
  await expect(page.getByTestId('prep-party').locator('[data-columns]')).toHaveAttribute(
    'data-columns',
    '3',
  );
  const cards = page.locator('[data-testid^="prep-pick-"]');
  await expect(cards).toHaveCount(6);
  // Two rows of three: the first three cards share a top, the last three another, below.
  const tops = await cards.evaluateAll((els) =>
    els.map((el) => Math.round(el.getBoundingClientRect().top)),
  );
  expect(new Set(tops.slice(0, 3)).size, `card tops ${tops.join(',')}`).toBe(1);
  expect(new Set(tops.slice(3)).size, `card tops ${tops.join(',')}`).toBe(1);
  expect(tops[3]!).toBeGreaterThan(tops[0]!);
  await page.getByTestId('prep-pick-lyra').click();
  await page.getByTestId('prep-pick-vexis').click();
  await page.getByTestId('prep-pick-seren').click();
  await page.getByTestId('prep-pick-oro').click();
  // Content order: Kael 1, Seren 2, Oro 3.
  await expect(page.getByTestId('prep-pick-seren')).toHaveAttribute('data-key', '2');
  await expect(page.getByTestId('prep-pick-oro')).toHaveAttribute('data-key', '3');
  // Their cards: Parry and Rootbond, and Oro's Saplings. No Lyra: Seren's Lunge interrupts too.
  await expect(page.getByTestId('prep-passive-seren')).toContainText('Parry');
  await expect(page.getByTestId('prep-passive-oro')).toContainText('Rootbond');
  await expect(page.getByTestId('prep-summons-oro')).toContainText('2 Saplings');
  await expect(page.getByTestId('prep-party-notes')).toContainText('Seren’s Lunge');
  expect(await page.evaluate(() => window.__AWRUN__!.party())).toEqual(['kael', 'seren', 'oro']);
  await page
    .getByRole('button', { name: /Embark/i })
    .first()
    .click();
  await expect.poll(phase).toBe('map');

  // First Light, beside them.
  expect(await page.evaluate(() => window.__AWRUN__!.choose())).toBe('skirmish');
  await expect.poll(phase).toBe('combat');
  await page.waitForFunction(() => window.__AW__ !== undefined);
  await expect.poll(() => page.evaluate(() => window.__AW__!.encounter().id)).toBe('first_light');
  const begin = page.getByRole('button', { name: /Begin the fight/i });
  if (await begin.isVisible()) await begin.click();
  const frames = page.getByTestId('party-frames');
  const seren = frames.getByRole('button', { name: /^Thread Seren/ });
  const oro = frames.getByRole('button', { name: /^Thread Oro/ });
  await expect(seren.getByTestId('frame-key')).toHaveAttribute('data-key', '2');
  await expect(oro.getByTestId('frame-key')).toHaveAttribute('data-key', '3');
  // Oro's frame: a mini bar for each of his two Saplings. Nobody else's frame has one.
  await expect(oro.getByTestId('sapling-bar')).toHaveCount(2);
  await expect(seren.getByTestId('sapling-bar')).toHaveCount(0);
  // Ward Seren (her frame hovered, so the Ward goes on her): she stands en garde (her violet
  // chip) while it holds.
  await seren.hover();
  await waitTicks(page, 2);
  await page.keyboard.press('KeyQ');
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.__AW__!.techniques().heroes.find((h) => h.heroId === 'seren')?.wards.length ?? 0,
      ),
    )
    .toBeGreaterThan(0);
  await expect(seren.getByTestId('duel-garde')).toBeVisible({ timeout: 10_000 });
  await page.mouse.move(640, 300);
  await page.evaluate(() => window.__AW__!.autoplay('skilled'));
  await page.evaluate(() => window.__AW__!.setDevTimeScale(2));
  // Their first fight beside you: each shows its 'New ally' card.
  await expect(page.locator('[data-testid="new-ally"][data-ally="seren"]')).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.locator('[data-testid="new-ally"][data-ally="oro"]')).toBeVisible({
    timeout: 30_000,
  });
  // The summon batches stay inside the draw-call budget.
  await waitTicks(page, 120);
  const perf = (await page.evaluate(() => window.__AW__!.perf()))!;
  expect(perf.drawCalls).toBeLessThanOrEqual(220);
  await expect.poll(phase, { timeout: 420_000, intervals: [2000] }).toBe('result');
  if ((await page.getByTestId('rank-up').count()) > 0)
    await page.getByRole('button', { name: /Onward/ }).click();
  // The Result: each one's fight.
  await expect(page.getByTestId('duel-line')).toContainText(
    /^Seren · parries \d+ · kill shots \d+ · your Wards dealt [\d,]+( · overextended \d+ s)?$/,
  );
  await expect(page.getByTestId('grove-line')).toContainText(
    /^Oro · Saplings in your songs \d+% · felled \d+ · Rootbond [\d,]+( · Ancients \d+)?$/,
  );
  await page.evaluate(() => window.__AWRUN__!.continue());
  // Won, the run goes on and the hook wins it; lost (the bots are W7's), it ends here. Either
  // way the Summary carries their lines for the run.
  await expect.poll(phase).toMatch(/^(relic|summary)$/);
  if ((await phase()) === 'relic') {
    await page.evaluate(() => window.__AWRUN__!.pickRelic(0));
    await expect.poll(phase).toBe('draft');
    await page.evaluate(() => window.__AWRUN__!.pick(0));
    await expect.poll(phase).toBe('map');
    expect(await page.evaluate(() => window.__AWRUN__!.winRun())).toBe(true);
  }
  await expect.poll(phase).toBe('summary');
  if ((await page.getByTestId('rank-up').count()) > 0)
    await page.getByRole('button', { name: /Onward/ }).click();
  await expect(page.getByTestId('duel-line')).toContainText(/^Seren · parries \d+ · kill shots/);
  await expect(page.getByTestId('grove-line')).toContainText(/^Oro · Saplings in your songs/);
  expect(errors).toEqual([]);
});

// ── Phase 5g: the content fill (docs/phase-5g.md), all of it Expedition-only ───────────────────

/** Settings → Skip the unlocks, from the Title: Expeditions, every hero and every slot open. */
async function skipTheUnlocks(page: Page): Promise<void> {
  await page
    .getByRole('button', { name: /^Settings$/ })
    .first()
    .click();
  await page.getByText('Skip the unlocks', { exact: true }).click();
  await expect(page.getByRole('switch', { name: /Skip the unlocks/ })).toBeChecked();
}

/** A view of the UI lab with its list hidden and the stage at full size. */
async function openLabView(page: Page, view: string): Promise<void> {
  await page.goto(`/?lab=ui&view=${view}&nav=0&fit=0`);
  await expect(page.getByTestId('lab-stage')).toBeVisible();
}

/** A content name, by id: a motif's, a relic's, an event's or a boon's. */
function nameOf(id: string): string {
  const def =
    CONTENT.motifs.find((m) => m.id === id) ??
    CONTENT.relics.find((r) => r.id === id) ??
    CONTENT.events.find((e) => e.id === id) ??
    CONTENT.boons.find((b) => b.id === id);
  if (!def) throw new Error(`No content entry ${id}`);
  return def.name;
}

/** The relic glyph's fallback: a plain diamond, drawn for a key no table knows. */
const DEFAULT_GLYPH = 'M12 3l7 9-7 9-7-9z';

test('Phase 5g: the UI lab’s Fill group — each view renders without an error and shows what it is for', async ({
  page,
}) => {
  test.setTimeout(240_000);
  const errors = trackErrors(page);
  const stage = page.getByTestId('lab-stage');

  // The glyph sheet: every relic, event and boon of the fill, each drawn, none by the fallback.
  await openLabView(page, 'fill-glyphs');
  await expect(stage.locator('li')).toHaveCount(
    FILL_RELICS.length + FILL_EVENTS.length + FILL_BOONS.length,
  );
  for (const def of [...FILL_RELICS, ...FILL_EVENTS, ...FILL_BOONS])
    await expect(stage.getByText(def.name, { exact: true })).toBeVisible();
  await expect(stage.locator(`path[d="${DEFAULT_GLYPH}"]`)).toHaveCount(0);

  // The HUD's trigger chips: a motif and two relics, named from content, counting up.
  await openLabView(page, 'fill-hud-triggers');
  const chips = stage.getByTestId('trigger-chips');
  await expect(chips).toBeVisible();
  await expect(chips.locator('[data-trigger]')).toHaveCount(3);
  await expect(chips.locator('[data-trigger="clean_strike"]')).toHaveText(
    `${nameOf('clean_strike')} ×3`,
  );
  await expect(chips.locator('[data-trigger="clean_strike"]')).toHaveAttribute('data-count', '3');
  await expect(chips.locator('[data-trigger="echoing_shell"]')).toHaveText(nameOf('echoing_shell'));
  await expect(chips.locator('[data-trigger="red_ink"]')).toHaveText(`${nameOf('red_ink')} ×2`);
  await expect(chips.getByTestId('ringing-chip')).toHaveCount(0);

  // Concert Pitch ringing heads the row, with its seconds; the relic bar shows the fill's
  // once-a-fight tiles, Spare Strings still to come and the Water Clock spent.
  await openLabView(page, 'fill-hud-ringing');
  const ringing = stage.getByTestId('ringing-chip');
  await expect(ringing).toHaveAttribute('data-seconds', '2.6');
  await expect(ringing).toHaveText(`${nameOf('concert_pitch')} 2.6 s`);
  await expect(stage.getByTestId('trigger-chips').locator('> *').first()).toHaveAttribute(
    'data-testid',
    'ringing-chip',
  );
  const bar = stage.getByTestId('relic-bar');
  await expect(bar.locator('[data-relic="spare_strings"]')).toHaveAttribute('data-state', 'ready');
  await expect(bar.locator('[data-relic="spare_strings"] .rotate-45')).toHaveCount(0);
  await expect(bar.locator('[data-relic="water_clock"]')).toHaveAttribute('data-state', 'waiting');
  await expect(bar.locator('[data-relic="water_clock"] .rotate-45')).toHaveCount(1);

  // The Result's lines: "X triggered N times.", once, and never (muted); the Summary's panel.
  const lines = [
    `${nameOf('clean_strike')} triggered 7 times.`,
    `${nameOf('tender_guard')} triggered once.`,
    `${nameOf('saving_grace')} never triggered.`,
    `${nameOf('echoing_shell')} triggered 4 times.`,
    `${nameOf('red_ink')} triggered 7 times.`,
  ];
  await openLabView(page, 'fill-trigger-lines');
  await expect(stage.locator('li')).toHaveText(lines);
  await openLabView(page, 'fill-result');
  for (const line of lines) await expect(stage.getByText(line, { exact: true })).toBeVisible();
  await openLabView(page, 'fill-summary');
  const summary = stage.getByTestId('summary-triggers');
  await expect(summary).toContainText('Your motifs and relics at work');
  await expect(summary).toContainText(`${nameOf('clean_strike')} triggered`);
  await expect(summary).toContainText(`${nameOf('saving_grace')} never triggered.`);

  // A draft offering a Harmony with one prerequisite missing: its Needs list says which, and the
  // prerequisite beside it names the Harmony it leads to, with the rest already owned.
  const card = (name: string) =>
    stage.locator('li').filter({ has: page.getByRole('heading', { name, exact: true }) });
  const harmony = nameOf('woven_aegis');
  await openLabView(page, 'fill-draft-harmony-missing');
  const woven = card(harmony);
  await expect(woven.getByTestId('harmony-ribbon')).toBeVisible();
  await expect(woven.getByTestId('harmony-needs')).toContainText('Needs');
  await expect(woven.locator('[data-need="warded_weft"]')).toHaveAttribute('data-owned', 'true');
  await expect(woven.locator('[data-need="warded_weft"]')).toContainText(nameOf('warded_weft'));
  await expect(woven.locator('[data-need="lingering_aegis"]')).toHaveAttribute(
    'data-owned',
    'false',
  );
  await expect(woven.locator('[data-need="lingering_aegis"]')).toContainText('missing');
  const lead = card(nameOf('lingering_aegis')).getByTestId('harmony-hint');
  await expect(lead).toHaveAttribute('data-harmony', 'woven_aegis');
  await expect(lead).toContainText(`Harmony → ${harmony}`);
  await expect(lead).toContainText(`with ${nameOf('warded_weft')}`);

  // Every prerequisite owned: both checked, nothing missing.
  await openLabView(page, 'fill-draft-harmony');
  const owned = card(harmony);
  await expect(owned.locator('[data-need]')).toHaveCount(2);
  await expect(owned.locator('[data-need][data-owned="true"]')).toHaveCount(2);
  await expect(owned.getByTestId('harmony-needs')).not.toContainText('missing');

  // Cards that lead on: Razor Silk to two Harmonies (one's aura sung, one's not), Lingering Aegis
  // to one with its other prerequisite owned.
  await openLabView(page, 'fill-draft-harmony-leads');
  const razor = card(nameOf('razor_silk')).getByTestId('harmony-hint');
  await expect(razor).toHaveCount(2);
  await expect(razor.nth(0)).toHaveAttribute('data-harmony', 'cutting_chorus');
  await expect(razor.nth(0)).toHaveAttribute('data-ready', 'true');
  await expect(razor.nth(1)).toHaveAttribute('data-harmony', 'spindle_lullaby');
  await expect(razor.nth(1)).not.toHaveAttribute('data-ready', 'true');
  await expect(card(nameOf('lingering_aegis')).getByTestId('harmony-hint')).toHaveAttribute(
    'data-harmony',
    'woven_aegis',
  );

  // The Codex pages: a Harmony names its prerequisites, every new motif and relic says it is for
  // Expeditions, the events and boons are all there.
  await openLabView(page, 'fill-codex-motifs');
  const harmonies = CONTENT.motifs.filter((m) => m.requires.motifs);
  await expect(stage.getByTestId('codex-harmony')).toHaveCount(harmonies.length);
  await expect(
    stage.locator('[data-motif="woven_aegis"] [data-testid="codex-harmony"]'),
  ).toHaveText(`Harmony · needs ${nameOf('warded_weft')} + ${nameOf('lingering_aegis')}`);
  await expect(stage.locator('[data-motif="woven_aegis"]')).toContainText('Expeditions only');
  await expect(stage.getByText('Expeditions only', { exact: true })).toHaveCount(
    CONTENT.motifs.filter((m) => m.requires.expedition).length,
  );
  await openLabView(page, 'fill-codex-relics');
  await expect(stage.locator('[data-relic]')).toHaveCount(CONTENT.relics.length);
  await expect(stage.getByText('Expeditions only', { exact: true })).toHaveCount(
    CONTENT.relics.filter((r) => r.expedition).length,
  );
  await openLabView(page, 'fill-codex-events');
  await expect(stage.locator('[data-event]')).toHaveCount(CONTENT.events.length);
  for (const e of FILL_EVENTS) await expect(stage.locator(`[data-event="${e.id}"]`)).toBeVisible();
  for (const b of FILL_BOONS) await expect(stage.locator(`[data-boon="${b.id}"]`)).toBeVisible();

  // Each of the six events on its screen (the lab's purse is 60 Aether): its choices, and a
  // choice that costs more says so and is disabled.
  const purse = 60;
  for (const e of FILL_EVENTS) {
    await openLabView(page, `fill-event-${e.id}`);
    await expect(stage.getByRole('heading', { name: e.name, exact: true })).toBeVisible();
    const choices = stage.getByTestId('event-choices').getByRole('button');
    await expect(choices).toHaveCount(e.choices.length);
    for (const c of e.choices) {
      const button = choices.filter({
        has: page.getByRole('heading', { name: c.label, exact: true }),
      });
      await expect(button).toHaveCount(1);
      if ((c.cost ?? 0) > purse) {
        await expect(button).toHaveAttribute('aria-disabled', 'true');
        await expect(button).toContainText(`Needs ${c.cost} Aether.`);
      }
    }
  }
  expect(errors).toEqual([]);
});

test('Phase 5g: the Codex in the app — the 18 relics each with their own glyph, the Harmonies name their prerequisites, the fill says Expeditions only', async ({
  page,
}) => {
  test.setTimeout(180_000);
  const errors = trackErrors(page);
  await page.goto(START_URL);
  await skipTheUnlocks(page);
  await page.getByRole('button', { name: 'Back' }).click();
  await enterLoom(page);
  await page.getByRole('button', { name: /^Codex:/ }).click();

  // Relics: all 18, each with its name, its text from content, the Expedition chip and its own
  // glyph, the badge's first drawing (the fill's table, never the plain diamond a key nobody drew
  // would fall back to; the rarity pips beside it are diamonds too).
  await page.getByRole('tab', { name: 'Relics' }).click();
  expect(FILL_RELICS).toHaveLength(18);
  for (const relic of FILL_RELICS) {
    const def = CONTENT.relics.find((r) => r.id === relic.id)!;
    const panel = page.locator(`[data-relic="${def.id}"]`);
    await expect(panel, def.id).toHaveCount(1);
    await expect(panel).toContainText(def.name);
    await expect(panel).toContainText(relicText(def));
    await expect(panel).toContainText('Expeditions only');
    expect(FILL_GLYPHS[def.id], `${def.id} has its glyph`).toBeDefined();
    await expect(panel.locator('svg').first().locator('path')).toHaveAttribute(
      'd',
      FILL_GLYPHS[def.id]!,
    );
  }
  // The pre-fill relics are not Expedition-only: the chip is the fill's alone.
  await expect(page.getByText('Expeditions only', { exact: true })).toHaveCount(
    CONTENT.relics.filter((r) => r.expedition).length,
  );

  // Motifs: all 63 (Skip the unlocks opens every hero's), each Expedition-only; a Harmony names
  // its two prerequisites.
  await page.getByRole('tab', { name: 'Motifs' }).click();
  expect(FILL_MOTIFS).toHaveLength(63);
  for (const m of FILL_MOTIFS) {
    const panel = page.locator(`[data-motif="${m.id}"]`);
    await expect(panel, m.id).toHaveCount(1);
    await expect(panel).toContainText('Expeditions only');
    const needs = (CONTENT.motifs.find((x) => x.id === m.id)!.requires.motifs ?? []).map(nameOf);
    if (needs.length > 0)
      await expect(panel.getByTestId('codex-harmony')).toContainText(
        `Harmony · needs ${needs.join(' + ')}`,
      );
    else await expect(panel.getByTestId('codex-harmony')).toHaveCount(0);
  }
  expect(FILL_MOTIFS.filter((m) => m.requires?.motifs).length).toBe(10);

  // Events: a new profile has met none of the later Movements' enemies, so the six new events
  // (all of Movements II and III) are not shown, only that they wait; the boons are.
  await page.getByRole('tab', { name: 'Events' }).click();
  for (const e of FILL_EVENTS) await expect(page.locator(`[data-event="${e.id}"]`)).toHaveCount(0);
  await expect(page.getByTestId('codex-events-locked')).toHaveCount(2);
  for (const b of FILL_BOONS) await expect(page.locator(`[data-boon="${b.id}"]`)).toBeVisible();
  expect(errors).toEqual([]);
});

/**
 * Phase 5g: how often a source's trigger fired in a recorded fight, by the sim's own ledger: the
 * replay stepped through in Node, tick by tick, as the browser played it.
 */
function firesIn(replay: Replay, id: string): number {
  const sim = createSim(replay.config);
  let f = 0;
  for (let tick = 0; tick < replay.finalTick; tick++) {
    const frame = replay.frames[f];
    if (frame && frame[0] === tick) {
      sim.step(frame[1]);
      f++;
    } else sim.step();
  }
  return sim.state.ledger.triggers?.[id] ?? 0;
}

test('Phase 5g: a trigger in a real fight — Black Ribbon on First Light’s brutes: its chip on the HUD, its line on the Result and the Summary', async ({
  page,
}) => {
  // A whole First Light, autoplayed, under SwiftShader (on a small page, which draws faster).
  test.setTimeout(240_000);
  const errors = trackErrors(page);
  const phase = () => page.evaluate(() => window.__AWRUN__!.phase());
  const ribbon = CONTENT.relics.find((r) => r.id === 'black_ribbon')!;
  await page.goto(START_URL);
  await page.waitForFunction(() => window.__AWRUN__ !== undefined);
  await skipTheUnlocks(page);
  // The Reliquary hands the run its relic (the only way to start a run holding a chosen one):
  // enshrined, carried and attuned, it plays from the first fight.
  await page.evaluate((seed) => window.__AWRUN__!.seedReliquary(seed), {
    relics: [{ id: ribbon.id }],
    carry: ['r1'],
  });
  await page.evaluate(() => window.__AWRUN__!.newRun(4242, 'expedition'));
  await expect.poll(phase).toBe('prep');
  await page
    .getByRole('button', { name: /Embark/i })
    .first()
    .click();
  await expect.poll(phase).toBe('map');
  expect(await page.evaluate(() => window.__AWRUN__!.relics())).toEqual([ribbon.id]);

  expect(await page.evaluate(() => window.__AWRUN__!.choose())).toBe('skirmish');
  await expect.poll(phase).toBe('combat');
  await page.waitForFunction(() => window.__AW__ !== undefined);
  await expect.poll(() => page.evaluate(() => window.__AW__!.encounter().id)).toBe('first_light');
  const begin = page.getByRole('button', { name: /Begin the fight/i });
  if (await begin.isVisible().catch(() => false)) await begin.click();
  // The relic is on the bar, attuned, and no chip yet: nothing has fallen.
  await expect(
    page.getByTestId('relic-bar').locator(`[data-relic="${ribbon.id}"][data-carried="attuned"]`),
  ).toBeVisible();
  await expect(page.getByTestId('trigger-chips')).toHaveCount(0);

  // Software rendering sets the pace (the sim takes five steps a frame at most): a small page
  // draws faster, so the fight is over sooner.
  await page.setViewportSize({ width: 480, height: 270 });
  // A chip lives 2.2 s of the fight and the fight runs fast here: record what the row shows.
  await page.evaluate(() => {
    const seen: Record<string, number> = {};
    (window as unknown as { __chips: Record<string, number> }).__chips = seen;
    new MutationObserver(() => {
      for (const el of document.querySelectorAll('[data-testid="trigger-chips"] [data-trigger]')) {
        const id = el.getAttribute('data-trigger')!;
        seen[id] = Math.max(seen[id] ?? 0, Number(el.getAttribute('data-count')));
      }
    }).observe(document.body, { subtree: true, childList: true, attributes: true });
  });
  await page.evaluate(() => window.__AW__!.autoplay('skilled'));
  await page.evaluate(() => window.__AW__!.setDevTimeScale(4));
  // The fight's replay, taken the moment it is won (the sim has fired everything it will).
  const replay = await page.evaluate(
    () =>
      new Promise<Replay>((resolve) => {
        const timer = setInterval(() => {
          const hook = window.__AW__;
          if (hook && hook.encounter().status === 'victory') {
            clearInterval(timer);
            resolve(hook.exportReplay());
          }
        }, 25);
      }),
  );
  const fires = firesIn(replay, ribbon.id);
  expect(fires).toBeGreaterThan(0);
  await expect.poll(phase, { timeout: 120_000 }).toBe('result');

  // The HUD showed its chip, named from content, counting.
  const chipped = await page.evaluate(
    () => (window as unknown as { __chips: Record<string, number> }).__chips,
  );
  expect(Object.keys(chipped)).toEqual([ribbon.id]);
  expect(chipped[ribbon.id]).toBeGreaterThanOrEqual(1);
  expect(chipped[ribbon.id]).toBeLessThanOrEqual(fires);

  // The Result says how many times, as the sim counted it.
  if ((await page.getByTestId('rank-up').count()) > 0)
    await page.getByRole('button', { name: /Onward/ }).click();
  const sentence = fires === 1 ? 'triggered once.' : `triggered ${fires} times.`;
  await expect(page.getByText(`${ribbon.name} ${sentence}`, { exact: true })).toBeVisible();

  // And the Summary of the run that fight began, with the rest of the run won through the hook.
  await page.evaluate(() => window.__AWRUN__!.continue());
  await expect.poll(phase).toBe('relic');
  await page.evaluate(() => window.__AWRUN__!.pickRelic(0));
  await expect.poll(phase).toBe('draft');
  await page.evaluate(() => window.__AWRUN__!.pick(0));
  await expect.poll(phase).toBe('map');
  expect(await page.evaluate(() => window.__AWRUN__!.winRun())).toBe(true);
  await expect.poll(phase).toBe('summary');
  const panel = page.getByTestId('summary-triggers');
  await expect(panel).toContainText('Your motifs and relics at work');
  await expect(panel).toContainText(`${ribbon.name} ${sentence}`);
  expect(errors).toEqual([]);
});

/** The map node `warp(kind)` reaches first from where a run stands: its breadth-first route. */
function routeFrom(
  run: RunState,
  from: MapNode | null,
  matches: (node: MapNode) => boolean,
): string[] | null {
  const queue: string[][] = (from ? from.next : run.map.rows[0]!.map((n) => n.id)).map((id) => [
    id,
  ]);
  const seen = new Set<string>();
  while (queue.length > 0) {
    const route = queue.shift()!;
    const id = route[route.length - 1]!;
    if (seen.has(id)) continue;
    seen.add(id);
    const node = Run.findNode(run, id);
    if (!node) continue;
    if (matches(node)) return route;
    for (const next of node.next) if (!seen.has(next)) queue.push([...route, next]);
  }
  return null;
}

/**
 * The event a fresh Expedition's first `warp('event')` reaches after `warpMovement(2)`, by seed:
 * the hook's walk (to the doorstep of Movement II, then to the first event ahead), done on the
 * seed's map in Node.
 */
function firstEventInMovementII(seed: number): string | null {
  const run = Run.newRun(seed, undefined, [], [], [], [], undefined, CONTENT.movements.length);
  const door = routeFrom(run, null, (n) => n.movement >= 2);
  if (!door) return null;
  const last = door.length > 1 ? Run.findNode(run, door[door.length - 2]!)! : null;
  const route = routeFrom(run, last, (n) => n.kind === 'event');
  return route ? (Run.findNode(run, route[route.length - 1]!)!.eventId ?? null) : null;
}

test('Phase 5g: an event — the Quartermaster’s choices, the one that costs too much is disabled with its price, the free one returns to the map', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const errors = trackErrors(page);
  const phase = () => page.evaluate(() => window.__AWRUN__!.phase());
  const event = CONTENT.events.find((e) => e.id === 'quartermaster')!;
  const choice = (id: string) => event.choices.find((c) => c.id === id)!;
  const [crate, chest, walk] = [choice('crate'), choice('chest'), choice('walk')];
  // A purse that buys the crate and not the war chest.
  const purse = Math.floor((crate.cost + chest.cost) / 2);
  expect(purse).toBeGreaterThanOrEqual(crate.cost);
  expect(purse).toBeLessThan(chest.cost);
  // A seed whose Movement II road reaches the Quartermaster first.
  let seed = 1;
  while (firstEventInMovementII(seed) !== event.id) {
    seed++;
    if (seed > 2000) throw new Error('No seed reaches the Quartermaster first');
  }

  await page.goto(START_URL);
  await page.waitForFunction(() => window.__AWRUN__ !== undefined);
  await skipTheUnlocks(page);
  await page.evaluate((s) => window.__AWRUN__!.newRun(s, 'expedition'), seed);
  await expect.poll(phase).toBe('prep');
  await page
    .getByRole('button', { name: /Embark/i })
    .first()
    .click();
  await expect.poll(phase).toBe('map');
  expect(await page.evaluate(() => window.__AWRUN__!.warpMovement(2))).toBe('map');
  expect(await page.evaluate((a) => window.__AWRUN__!.warp('event', a), purse)).toBe('event');
  await expect(page.getByRole('heading', { name: event.name, level: 1 })).toBeVisible();

  // Three choices; the war chest is out of reach, and says what it costs.
  const buttons = page.getByTestId('event-choices').getByRole('button');
  await expect(buttons).toHaveCount(3);
  const button = (c: { label: string }) =>
    buttons.filter({ has: page.getByRole('heading', { name: c.label, exact: true }) });
  await expect(button(chest)).toHaveAttribute('aria-disabled', 'true');
  await expect(button(chest)).toContainText(`Needs ${chest.cost} Aether.`);
  await expect(button(crate)).not.toHaveAttribute('aria-disabled', 'true');
  await expect(button(walk)).not.toHaveAttribute('aria-disabled', 'true');
  // Pressing the one it cannot afford changes nothing: no outcome, the purse as it was.
  // (aria-disabled, so clicked on purpose.)
  await button(chest).click({ force: true });
  await expect(page.getByTestId('event-outcome')).toHaveCount(0);
  expect(await page.evaluate(() => window.__AWRUN__!.aether())).toBe(purse);
  expect(await phase()).toBe('event');

  // Walking on is free: its outcome reads, and Continue is back on the map with the purse intact.
  await button(walk).click();
  await expect(page.getByTestId('event-outcome')).toContainText(walk.outcome);
  await page.getByRole('button', { name: /^Continue/ }).click();
  await expect.poll(phase).toBe('map');
  expect(await page.evaluate(() => window.__AWRUN__!.aether())).toBe(purse);
  expect(await page.evaluate(() => window.__AWRUN__!.relics())).toEqual([]);
  expect(errors).toEqual([]);
});

test('Phase 5g: Expedition only — a Prelude’s drafts and merchant never offer a new entry; an Expedition’s do', async ({
  page,
}) => {
  test.setTimeout(240_000);
  const errors = trackErrors(page);
  const phase = () => page.evaluate(() => window.__AWRUN__!.phase());
  const fillIds = new Set<string>([
    ...FILL_MOTIFS.map((m) => m.id),
    ...FILL_RELICS.map((r) => r.id),
  ]);
  // The new entries' names, less any a pre-fill entry shares (a screen's text would not tell).
  const otherNames = new Set<string>([
    ...CONTENT.motifs.filter((m) => !fillIds.has(m.id)).map((m) => m.name),
    ...CONTENT.relics.filter((r) => !fillIds.has(r.id)).map((r) => r.name),
  ]);
  const fillMotifNames = FILL_MOTIFS.map((m) => m.name).filter((n) => !otherNames.has(n));
  const fillNames = [...fillMotifNames, ...FILL_RELICS.map((r) => r.name)].filter(
    (n) => !otherNames.has(n),
  );
  expect(fillMotifNames.length).toBe(FILL_MOTIFS.length);
  await page.goto(START_URL);
  await page.waitForFunction(() => window.__AWRUN__ !== undefined);
  // Expeditions open with Skip the unlocks, so the Prelude here is asked for.
  await skipTheUnlocks(page);

  /** A new run's first fight won through the hook; the draft it pays, as its cards' names. */
  const firstDraft = async (seed: number, mode: 'prelude' | 'expedition'): Promise<string[]> => {
    await page.evaluate(
      ([s, m]) => window.__AWRUN__!.newRun(Number(s), m as typeof mode),
      [seed, mode],
    );
    await expect.poll(phase).toBe('prep');
    await page.evaluate(() => window.__AWRUN__!.embark());
    await expect.poll(phase).toBe('map');
    expect(await page.evaluate(() => window.__AWRUN__!.movement())).toMatchObject({
      movements: mode === 'prelude' ? 1 : CONTENT.movements.length,
    });
    expect(await page.evaluate(() => window.__AWRUN__!.choose())).toBe('skirmish');
    // Building the arena under SwiftShader can take a few seconds.
    await expect.poll(phase, { timeout: 30_000 }).toBe('combat');
    expect(await page.evaluate(() => window.__AWRUN__!.winFight())).toBe(true);
    await expect.poll(phase).toBe('result');
    await page.evaluate(() => window.__AWRUN__!.continue());
    // An Expedition's First Light pays a relic first, then the draft.
    await expect.poll(phase).toMatch(/^(relic|draft)$/);
    if ((await phase()) === 'relic') {
      await page.evaluate(() => window.__AWRUN__!.pickRelic(0));
      await expect.poll(phase).toBe('draft');
    }
    await expect(page.locator('li h2').first()).toBeVisible();
    const names = await page.locator('li h2').allInnerTexts();
    expect(names.length).toBeGreaterThanOrEqual(3);
    return names;
  };

  const prelude: string[] = [];
  for (const seed of [4242, 4243, 4244]) prelude.push(...(await firstDraft(seed, 'prelude')));
  expect(prelude.filter((n) => fillNames.includes(n))).toEqual([]);

  // The control: the same road as an Expedition does reach the fill (the gate is the route's).
  const expedition: string[] = [];
  for (const seed of [4242, 4243, 4244, 4245])
    expedition.push(...(await firstDraft(seed, 'expedition')));
  expect(expedition.filter((n) => fillMotifNames.includes(n)).length).toBeGreaterThan(0);

  // A Prelude merchant, flush: its cloth (motifs and relics) names none of them either.
  await page.evaluate(() => window.__AWRUN__!.newRun(4242, 'prelude'));
  await expect.poll(phase).toBe('prep');
  await page.evaluate(() => window.__AWRUN__!.embark());
  await expect.poll(phase).toBe('map');
  expect(await page.evaluate(() => window.__AWRUN__!.warp('merchant', 900))).toBe('merchant');
  await expect(page.getByRole('heading', { name: 'The Merchant' })).toBeVisible();
  const cloth = await page.locator('body').innerText();
  expect(fillNames.filter((n) => cloth.includes(n))).toEqual([]);
  expect(errors).toEqual([]);
});

test('Phase 5g: the VFX lab’s fill scenarios load, step and draw without an error', async ({
  page,
}) => {
  test.setTimeout(240_000);
  const errors = trackErrors(page);
  type Lab = {
    fillScenarios(): string[];
    fillScenario(name: string): void;
    fillStats(): { fired: Record<string, number>; drawn: Record<string, number> };
    manual(frames: number, ms: number, drawLast?: boolean): void;
    state(): { time: number; field: { ringing?: number } };
  };
  await page.goto('/?lab=vfx');
  await page.waitForFunction(() => (window as unknown as { __VFX__?: Lab }).__VFX__ !== undefined);
  const names = await page.evaluate(() =>
    (window as unknown as { __VFX__: Lab }).__VFX__.fillScenarios(),
  );
  expect(names).toEqual([
    'Trigger cues',
    'Real triggers on a Perfect Ward',
    'Razor Silk',
    'Thread the Needle',
    'Concert Pitch: Ringing',
    'Spare Strings',
    'Water Clock',
  ]);
  await expect(page.getByText('Phase 5g · The fill')).toBeVisible();
  for (const name of names)
    await expect(page.getByRole('button', { name, exact: true })).toBeVisible();

  for (const name of names) {
    await page.getByRole('button', { name, exact: true }).click();
    // Ten sim seconds in 50 ms frames, drawing the last of each run: the scenario stages itself on
    // the sim's clock and plays its moment. Three seconds in, Concert Pitch should be ringing.
    const stepped = await page.evaluate(() => {
      const api = (window as unknown as { __VFX__: Lab }).__VFX__;
      api.manual(60, 50, true);
      const at = api.state();
      const ringingFor = (at.field.ringing ?? 0) - at.time;
      api.manual(140, 50, true);
      return { time: api.state().time, ringingFor, ...api.fillStats() };
    });
    expect(stepped.time, name).toBeGreaterThan(5);
    if (name === 'Concert Pitch: Ringing')
      expect(stepped.ringingFor, `${name} is ringing`).toBeGreaterThan(0);
    // The others count each moment they play (the ringing has no counter, only its streaks).
    else
      expect(
        Object.values(stepped.fired).reduce((a, b) => a + b, 0),
        `${name} plays its moment`,
      ).toBeGreaterThan(0);
    // The canvas shows a scene, not a blank: many distinct colours in the host.
    const shot = await page.getByTestId('vfx-host').screenshot();
    const colours = await page.evaluate(async (b64) => {
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(bitmap, 0, 0);
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      const seen = new Set<number>();
      for (let i = 0; i < data.length; i += 4)
        seen.add(((data[i]! >> 4) << 8) | ((data[i + 1]! >> 4) << 4) | (data[i + 2]! >> 4));
      return seen.size;
    }, shot.toString('base64'));
    expect(colours, `${name} is not blank`).toBeGreaterThan(20);
  }
  expect(errors).toEqual([]);
});

// ── Phase 6 (docs/phase-6.md): the Atlas station, This Week's Song, the lab ──────────────

/** From the front door, Skip the unlocks, then the Atlas station (its intro's Try it). */
async function openAtlas(page: Page): Promise<void> {
  await page.goto(START_URL);
  await page.waitForFunction(() => window.__AWRUN__ !== undefined);
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByText('Skip the unlocks', { exact: true }).click();
  await expect(page.getByRole('switch', { name: /Skip the unlocks/ })).toBeChecked();
  await page.getByRole('button', { name: 'Back' }).click();
  await enterLoom(page);
  const atlas = page.locator('[data-station="atlas"]');
  await expect(atlas).toHaveAttribute('data-open', 'true');
  await atlas.click();
  const intro = page.getByTestId('station-intro');
  if ((await intro.count()) > 0) {
    await expect(intro).toHaveAttribute('data-intro', 'atlas');
    while ((await page.getByTestId('intro-next').count()) > 0)
      await page.getByTestId('intro-next').click();
    await page.getByTestId('intro-try').click();
  }
  await expect(page.getByTestId('atlas-screen')).toBeVisible();
}

test('Phase 6: the Atlas station — every Echo on the chart, an Echo begun reaches Prep with its twists', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const errors = trackErrors(page);
  await openAtlas(page);
  const chart = page.getByTestId('atlas-chart');
  for (const e of CONTENT.echoes)
    await expect(chart.locator(`[data-echo="${e.id}"]`)).toHaveCount(1);
  await expect(page.getByTestId('atlas-total')).toContainText(
    `0 of ${CONTENT.echoes.length * 3} stars`,
  );
  // A Cappella: no Calling, no Astrolabe, no carried relics.
  const echo = CONTENT.echoes.find((e) => e.id === 'a_cappella')!;
  await chart.locator(`[data-echo="${echo.id}"]`).click();
  const card = page.getByTestId('echo-card');
  await expect(card).toHaveAttribute('data-echo', echo.id);
  await expect(card.getByTestId('echo-twists')).toContainText('No Calling');
  await card.getByTestId('echo-begin').click();
  await expect.poll(() => page.evaluate(() => window.__AWRUN__!.phase())).toBe('prep');
  const prep = page.getByTestId('prep-echo');
  await expect(prep).toHaveAttribute('data-echo', echo.id);
  await expect(prep.getByTestId('prep-echo-off')).toContainText('No Calling');
  await expect(prep.getByTestId('prep-echo-off')).toContainText('No carried relics');
  await expect(page.getByTestId('calling-picker')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('Phase 6: This Week’s Song — the panel in the Atlas, Begin, Prep with its choices locked', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const errors = trackErrors(page);
  await openAtlas(page);
  const panel = page.getByTestId('weekly-panel');
  await expect(panel).toBeVisible();
  await expect(panel.getByTestId('weekly-left')).toBeVisible();
  await expect(panel.getByTestId('weekly-entry')).not.toBeEmpty();
  await panel.getByTestId('weekly-begin').click();
  await expect.poll(() => page.evaluate(() => window.__AWRUN__!.phase())).toBe('prep');
  const prep = page.getByTestId('prep-weekly');
  await expect(prep).toBeVisible();
  await expect(prep).toContainText('Everyone plays this');
  for (const label of ['Route', 'Calling', 'Party', 'Dissonance', 'Seed'])
    await expect(prep.getByTestId('prep-weekly-fixed')).toContainText(label);
  // The entry's Dissonance is the weekly's, not a choice: no Dissonance panel, no route toggle.
  await expect(page.getByTestId('prep-dissonance')).toHaveCount(0);
  await expect(page.getByTestId('prep-route')).toHaveCount(0);
  await expect(page.getByTestId('calling-picker')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('Phase 6: the UI lab’s Phase 6 groups — one view of each renders without an error', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const errors = trackErrors(page);
  const stage = page.getByTestId('lab-stage');
  await openLabView(page, 'p6-atlas-partway');
  await expect(stage.getByTestId('atlas-chart')).toBeVisible();
  await expect(stage.getByTestId('weekly-result')).toHaveAttribute('data-status', 'verified');
  await openLabView(page, 'p6-prep-weekly');
  await expect(stage.getByTestId('prep-weekly')).toContainText('Everyone plays this');
  await openLabView(page, 'p6-hud-tyrant');
  await expect(stage.getByTestId('boss-tyrant')).toBeVisible();
  expect(errors).toEqual([]);
});
