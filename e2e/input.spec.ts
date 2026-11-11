/**
 * Phase 7 W1 (docs/phase-7.md, *Tests*): a gamepad, faked through `navigator.getGamepads`,
 * drives the menu screens (one global hook) and plays a Training fight, and that fight's replay
 * plays back bit for bit in Node.
 */
import { expect, test, type Locator, type Page } from '@playwright/test';
import { PAD_BUTTONS } from '../src/input/actions';
import { parseReplay, runReplay } from '../src/sim/replay';

const START_URL = '/?e2e=1&seed=4242';
const SHOTS = '/home/user/aw-work/7/w1';

type Button = (typeof PAD_BUTTONS)[number];

function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(err.message));
  return errors;
}

/** A standard-mapping pad, connected before the page loads; tests press its buttons. */
async function installPad(page: Page): Promise<void> {
  await page.addInitScript((count) => {
    const pad = {
      id: 'Test pad (standard)',
      index: 0,
      connected: true,
      mapping: 'standard',
      timestamp: 0,
      buttons: Array.from({ length: count }, () => ({ pressed: false, touched: false, value: 0 })),
      axes: [0, 0, 0, 0],
    };
    (window as unknown as { __pad: typeof pad }).__pad = pad;
    Object.defineProperty(Navigator.prototype, 'getGamepads', {
      configurable: true,
      value: () => [pad, null, null, null],
    });
  }, PAD_BUTTONS.length);
}

async function setButton(page: Page, button: Button, down: boolean): Promise<void> {
  await page.evaluate(
    ([i, d]) => {
      const b = (window as unknown as { __pad: { buttons: { pressed: boolean; value: number }[] } })
        .__pad.buttons[i as number]!;
      b.pressed = d as boolean;
      b.value = d ? 1 : 0;
    },
    [PAD_BUTTONS.indexOf(button), down] as const,
  );
}

async function setAxes(page: Page, axes: [number, number, number, number]): Promise<void> {
  await page.evaluate((a) => {
    const pad = (window as unknown as { __pad: { axes: number[] } }).__pad;
    for (let i = 0; i < 4; i++) pad.axes[i] = a[i]!;
  }, axes);
}

/** A few rendered frames: the pad is polled once a frame. */
async function frames(page: Page, n = 4): Promise<void> {
  await page.evaluate(
    (count) =>
      new Promise<void>((resolve) => {
        let left = count;
        const step = () => (--left <= 0 ? resolve() : requestAnimationFrame(step));
        requestAnimationFrame(step);
      }),
    n,
  );
}

async function tap(page: Page, button: Button): Promise<void> {
  await setButton(page, button, true);
  await frames(page);
  await setButton(page, button, false);
  await frames(page);
}

/** What has focus: its accessible name or text, or '' for the page itself. */
async function focused(page: Page): Promise<string> {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) return '';
    // Its name, else its markup (a radio or a slider has no text of its own).
    return (
      el.getAttribute('aria-label')?.trim() || el.textContent?.trim() || el.outerHTML.slice(0, 120)
    );
  });
}

/** The d-pad moves focus to some control on this screen (and then on, to another). */
async function dpadMovesFocus(page: Page, onlyOne = false): Promise<void> {
  await tap(page, 'dpadDown');
  const first = await focused(page);
  expect(first).not.toBe('');
  // A screen with one control: the d-pad finds it, and there is nowhere else to go.
  if (onlyOne) return;
  let moved = false;
  for (const b of ['dpadDown', 'dpadRight', 'dpadUp', 'dpadLeft'] as const) {
    await tap(page, b);
    if ((await focused(page)) !== first) {
      moved = true;
      break;
    }
  }
  expect(moved).toBe(true);
}

/** Puts focus on a control, then the pad's bottom button presses it. */
async function padPress(page: Page, target: Locator): Promise<void> {
  await target.focus();
  await tap(page, 'faceDown');
}

async function waitTicks(page: Page, n: number, timeout = 90_000): Promise<void> {
  const start = await page.evaluate(() => window.__AW__!.tick());
  await page.waitForFunction((target) => window.__AW__!.tick() >= target, start + n, { timeout });
}

test('the pad drives the menu screens: Title, Settings and its Controls, the Loom, a run', async ({
  page,
}) => {
  test.setTimeout(240_000);
  const errors = trackErrors(page);
  await installPad(page);
  await page.goto(START_URL);
  await page.waitForFunction(() => window.__AWRUN__ !== undefined);

  // The Title: the d-pad finds its controls; the bottom button opens Settings.
  await dpadMovesFocus(page);
  await padPress(page, page.getByRole('button', { name: /^Settings$/ }).first());
  await expect(page.getByTestId('controls-settings')).toBeVisible();

  // Settings: the d-pad moves through its controls; a slider steps with left and right.
  await dpadMovesFocus(page);
  const master = page.getByLabel('Master');
  const before = await master.inputValue();
  await master.focus();
  await tap(page, 'dpadLeft');
  expect(Number(await master.inputValue())).toBeLessThan(Number(before));
  // Controls, by pad: Glide's pad slot, then the left bumper (Crescendo's): swap them.
  const glide = page.getByTestId('controls-pad').getByRole('button', { name: /^Glide \(dash\):/ });
  await padPress(page, glide.first());
  await expect(page.getByText('Press a pad button…')).toBeVisible();
  await tap(page, 'bumperLeft');
  const prompt = page.getByRole('alertdialog');
  await expect(prompt).toContainText('is already Crescendo');
  // The prompt's first choice has focus: the bottom button swaps.
  await tap(page, 'faceDown');
  await expect(prompt).toHaveCount(0);
  const saved = await page.evaluate(
    () => JSON.parse(localStorage.getItem('aetherweaver.settings') ?? '{}').input,
  );
  expect(saved).toEqual({ padBindings: { glide: ['bumperLeft'], crescendo: ['faceDown'] } });
  await page.getByTestId('controls-pad').screenshot({ path: `${SHOTS}/controls-pad.png` });
  await page.getByTestId('controls-mouse').screenshot({ path: `${SHOTS}/controls-mouse.png` });
  // Back: the pad presses Back.
  await padPress(page, page.getByRole('button', { name: 'Back' }).first());
  await expect(page.getByTestId('controls-settings')).toHaveCount(0);

  // The Loom, and its welcome dialog: the d-pad stays inside the dialog.
  await padPress(page, page.getByRole('button', { name: 'Enter the Loom' }));
  await expect(page.getByTestId('loom-screen')).toBeVisible();
  if (await page.getByTestId('station-intro').isVisible()) {
    await padPress(page, page.getByTestId('intro-later'));
    await expect(page.getByTestId('station-intro')).toHaveCount(0);
  }
  await dpadMovesFocus(page);
  // The right button is Escape: the Loom goes back to the front door.
  await tap(page, 'faceRight');
  await expect(page.getByTestId('loom-screen')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Enter the Loom' })).toBeVisible();

  // A run: Prep, the Map, the first fight's primer, the Result, the Draft.
  await page.evaluate(() => window.__AWRUN__!.newRun(4242));
  await expect.poll(() => page.evaluate(() => window.__AWRUN__!.phase())).toBe('prep');
  // The run's screens load on demand: wait for Prep to be drawn.
  await expect(page.getByRole('button', { name: /Embark/i }).first()).toBeVisible();
  await dpadMovesFocus(page);
  await padPress(page, page.getByRole('button', { name: /Embark/i }).first());
  await expect.poll(() => page.evaluate(() => window.__AWRUN__!.phase())).toBe('map');
  await expect(page.getByRole('button', { name: /Embark/i })).toHaveCount(0);
  await expect(page.locator('main button').first()).toBeVisible();
  await dpadMovesFocus(page);
  await page.evaluate(() => window.__AWRUN__!.choose());
  await page.waitForFunction(() => window.__AW__ !== undefined);
  const begin = page.getByRole('button', { name: /Begin the fight/i });
  await expect(begin).toBeVisible();
  await padPress(page, begin);
  await expect(begin).toHaveCount(0);
  expect(await page.evaluate(() => window.__AWRUN__!.winFight())).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__AWRUN__!.phase())).toBe('result');
  const onward = page.getByRole('button', { name: /^Continue/ });
  await expect(onward).toBeVisible();
  await dpadMovesFocus(page, true);
  // Past the Result's arrival guard (a press as the screen arrives is swallowed, keys and pad
  // alike: e2e/smoke.spec.ts waits the same).
  await page.waitForTimeout(700);
  await padPress(page, onward);
  await expect.poll(() => page.evaluate(() => window.__AWRUN__!.phase())).toBe('draft');
  await expect(page.getByTestId('draft-skip')).toBeVisible();
  await dpadMovesFocus(page);
  await page.screenshot({ path: `${SHOTS}/pad-draft.png` });
  await padPress(page, page.getByTestId('draft-skip'));
  await expect.poll(() => page.evaluate(() => window.__AWRUN__!.phase())).toBe('map');
  expect(errors).toEqual([]);
});

test('a pad-played Training fight, paused and resumed by the pad, replays bit for bit in Node', async ({
  page,
}) => {
  test.setTimeout(240_000);
  const errors = trackErrors(page);
  await installPad(page);
  await page.goto(START_URL);
  await padPress(page, page.getByRole('button', { name: 'Enter the Loom' }));
  await expect(page.getByTestId('loom-screen')).toBeVisible();
  if (await page.getByTestId('station-intro').isVisible())
    await padPress(page, page.getByTestId('intro-later'));
  await padPress(page, page.getByRole('button', { name: /Training Grounds/i }).first());
  await page.waitForFunction(() => window.__AW__ !== undefined);
  await expect(page.getByTestId('party-frames')).toContainText('Kael');
  await page.evaluate(() => {
    const hook = window.__AW__!;
    hook.queue({ t: 'debug', op: { op: 'spawnEnemy', defId: 'bell_brute', x: 7, z: -3 } });
  });
  await waitTicks(page, 5);
  const weaver = () =>
    page.evaluate(() => window.__AW__!.snapshot().entities.find((e) => e.kind === 'weaver')!);
  const z0 = (await weaver()).z;

  // The left stick moves (up the screen), as W would.
  await setAxes(page, [0, -1, 0, 0]);
  await waitTicks(page, 40);
  await setAxes(page, [0, 0, 0, 0]);
  await waitTicks(page, 2);
  expect((await weaver()).z).toBeLessThan(z0 - 1);

  // The right stick flicks the reticle to the second hero (it starts from the threaded hero, or
  // before the first); the right trigger threads them.
  const from = (await weaver()).threadSlot as number | null;
  const flicks = from === null ? 2 : (((1 - from) % 3) + 3) % 3 || 3;
  for (let i = 0; i < flicks; i++) {
    await setAxes(page, [0, 0, 1, 0]);
    await frames(page);
    await setAxes(page, [0, 0, 0, 0]);
    await frames(page);
  }
  await tap(page, 'triggerRight');
  await waitTicks(page, 3);
  expect((await weaver()).threadSlot).toBe(1);
  // The left trigger: Mend ⇄ Empower. The left face button: Ward the reticle's hero.
  await tap(page, 'triggerLeft');
  await waitTicks(page, 3);
  expect((await weaver()).threadMode).toBe('empower');
  await tap(page, 'faceLeft');
  await tap(page, 'dpadRight');
  await waitTicks(page, 3);

  // Start pauses: the ticks stop and the pause menu takes the pad.
  await tap(page, 'start');
  const resume = page.getByRole('button', { name: /Resume/ });
  await expect(resume).toBeVisible();
  const pausedAt = await page.evaluate(() => window.__AW__!.tick());
  await dpadMovesFocus(page);
  expect(await page.evaluate(() => window.__AW__!.tick())).toBe(pausedAt);
  await page.screenshot({ path: `${SHOTS}/pad-pause-menu.png` });
  // The bottom button presses Resume; held into the fight, it doesn't Glide.
  await padPress(page, resume);
  await expect(resume).toHaveCount(0);
  await waitTicks(page, 10);

  const replay = await page.evaluate(() => window.__AW__!.exportReplay());
  const commands = replay.frames.flatMap(([, cmds]) => cmds);
  expect(commands).toContainEqual({ t: 'move', x: 0, z: -1 });
  expect(commands).toContainEqual({ t: 'thread', slot: 1 });
  expect(commands).toContainEqual({ t: 'mode' });
  expect(commands).toContainEqual({ t: 'tech', id: 'ward', slot: 1 });
  expect(commands).toContainEqual({ t: 'directive', kind: 'rally' });
  expect(commands.filter((c) => c.t === 'glide')).toEqual([]);
  const result = runReplay(parseReplay(JSON.parse(JSON.stringify(replay))));
  expect(result.tick).toBe(replay.finalTick);
  expect(result.hash).toBe(replay.finalHash);
  expect(result.matches).toBe(true);
  expect(errors).toEqual([]);
});
