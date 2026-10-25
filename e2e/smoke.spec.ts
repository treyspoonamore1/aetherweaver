import { expect, test, type Page } from '@playwright/test';
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
  expect(perf.simMsPerTick).toBeLessThan(1.5);
  // Main-thread CPU per frame. GPU raster time isn't measurable under SwiftShader.
  expect(perf.frameMsP95).toBeLessThan(25);
  expect(perf.hudCommitsPerSec).toBeLessThanOrEqual(20);
});
