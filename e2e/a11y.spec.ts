/**
 * Phase 7 W2 (docs/phase-7.md, *W2: accessibility options*): every option on, in a fight, with no
 * error; the Settings rows write what they say; screenshots at 80, 100 and 150% UI scale and under
 * each colour-vision palette, for the owner (written to $A11Y_SHOTS when it is set).
 */
import { expect, test, type Page } from '@playwright/test';
import { COLOR_VISIONS, type ColorVision } from '../src/app/colorVision';
import { DEFAULT_SETTINGS, type Settings } from '../src/app/settings';

const START_URL = '/?e2e=1&seed=4242';
const SHOTS = process.env.A11Y_SHOTS ?? '';

/** Every Phase 7 comfort option at its strongest, captions on, game speed 70%. */
const STRONGEST: Settings = {
  ...DEFAULT_SETTINGS,
  screenShake: 0,
  flashes: 0,
  captions: true,
  reducedMotion: 'on',
  telegraphs: { opacity: 0.6, outline: 2, perfectBand: 2, highContrast: true },
  answerGlyphs: false,
  importantNumbersOnly: true,
  slowmoVignette: false,
  aids: { gameSpeed: 0.7 },
  volumes: { ...DEFAULT_SETTINGS.volumes, ambience: 0.3, barks: 0.5 },
  heroVoices: true,
  quality: 'low',
};

function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(err.message));
  return errors;
}

/** Starts the page with `settings` saved, as a returning player's device would have them. */
async function withSaved(page: Page, settings: Settings): Promise<void> {
  await page.addInitScript((json) => {
    if (!sessionStorage.getItem('a11y-seeded')) {
      localStorage.setItem('aetherweaver.settings', json);
      sessionStorage.setItem('a11y-seeded', '1');
    }
  }, JSON.stringify(settings));
}

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
  await page.mouse.move(640, 300);
}

async function waitTicks(page: Page, n: number, timeout = 120_000): Promise<void> {
  const start = await page.evaluate(() => window.__AW__!.tick());
  await page.waitForFunction((target) => window.__AW__!.tick() >= target, start + n, { timeout });
}

/** A busy few seconds: enemies winding up on every side, the skilled bot playing. */
async function busyFight(page: Page, ticks: number): Promise<void> {
  await page.evaluate(() => {
    const hook = window.__AW__!;
    hook.queue({ t: 'debug', op: { op: 'spawnEnemy', defId: 'bell_brute', x: -6, z: -8 } });
    hook.queue({ t: 'debug', op: { op: 'spawnEnemy', defId: 'lamenter', x: 7, z: -10 } });
    hook.queue({ t: 'debug', op: { op: 'spawnEnemy', defId: 'hollow_chorister', x: 0, z: -9 } });
    hook.autoplay('skilled');
  });
  await page.keyboard.press('Digit1');
  await waitTicks(page, ticks);
}

async function shot(page: Page, name: string): Promise<void> {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` });
}

test('every option at its strongest: a fight plays with no error, the page holds still', async ({
  page,
}) => {
  const errors = trackErrors(page);
  await withSaved(page, STRONGEST);
  await enterTraining(page);
  expect(await page.evaluate(() => document.documentElement.dataset.motion)).toBe('on');
  await busyFight(page, 420);
  await shot(page, 'fight-every-option-on');
  // Captions show, two at most.
  const captions = page.locator('text=/^\\[.*\\]$/');
  expect(await captions.count()).toBeLessThanOrEqual(2);
  // The UI's animations are cut as the OS setting cuts them.
  const duration = await page.evaluate(() => {
    const el = document.createElement('div');
    el.style.animation = 'fade-in 0.4s ease-out both';
    document.body.appendChild(el);
    const d = getComputedStyle(el).animationDuration;
    el.remove();
    return d;
  });
  expect(['0.01ms', '1e-05s']).toContain(duration);
  expect(errors).toEqual([]);
});

test('defaults: no Phase 7 key is written, the page follows the OS as before', async ({ page }) => {
  const errors = trackErrors(page);
  await enterTraining(page);
  await busyFight(page, 240);
  await shot(page, 'fight-defaults');
  expect(await page.evaluate(() => document.documentElement.dataset.motion ?? null)).toBeNull();
  const saved = await page.evaluate(() => localStorage.getItem('aetherweaver.settings'));
  if (saved) {
    const s = JSON.parse(saved) as Record<string, unknown>;
    for (const key of ['reducedMotion', 'telegraphs', 'aids', 'answerGlyphs', 'quality'])
      expect(key in s, key).toBe(false);
  }
  expect(errors).toEqual([]);
});

test('the Settings rows write what they say', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto(START_URL);
  await page.getByRole('button', { name: /^Settings$/ }).click();
  await shot(page, 'settings-defaults');
  const motion = page.locator('fieldset', { hasText: 'Reduced motion' });
  await motion.getByText('On', { exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.dataset.motion ?? null))
    .toBe('on');
  await page.locator('fieldset', { hasText: 'Game speed' }).getByText('80%').click();
  await page.getByRole('switch', { name: /Important numbers only/ }).check({ force: true });
  await page.getByRole('switch', { name: /High-contrast telegraphs/ }).check({ force: true });
  const saved = await page.evaluate(
    () => JSON.parse(localStorage.getItem('aetherweaver.settings')!) as Settings,
  );
  expect(saved.reducedMotion).toBe('on');
  expect(saved.aids).toEqual({ gameSpeed: 0.8 });
  expect(saved.importantNumbersOnly).toBe(true);
  expect(saved.telegraphs).toEqual({ highContrast: true });
  await motion.getByText('Off', { exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.dataset.motion ?? null))
    .toBe('off');
  await motion.getByText('System', { exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.dataset.motion ?? null))
    .toBeNull();
  await page.getByRole('button', { name: 'Restore defaults' }).click();
  const reset = await page.evaluate(
    () => JSON.parse(localStorage.getItem('aetherweaver.settings')!) as Record<string, unknown>,
  );
  expect('reducedMotion' in reset).toBe(false);
  expect(errors).toEqual([]);
});

for (const [scale, width] of [
  [0.8, 1280],
  [1, 1280],
  [1.5, 1920],
] as const) {
  test(`screens and the HUD at ${scale * 100}% UI scale`, async ({ page }) => {
    const errors = trackErrors(page);
    await page.setViewportSize({ width, height: Math.round(width * 0.5625) });
    await withSaved(page, { ...DEFAULT_SETTINGS, uiScale: scale });
    await page.goto(START_URL);
    await page.getByRole('button', { name: /^Settings$/ }).click();
    await shot(page, `scale-${scale * 100}-settings`);
    await enterTraining(page);
    await busyFight(page, 180);
    await shot(page, `scale-${scale * 100}-fight`);
    // 12 px at 100%: the smallest text is 0.75 rem of the root size.
    const root = await page.evaluate(() =>
      parseFloat(getComputedStyle(document.documentElement).fontSize),
    );
    expect(root).toBeCloseTo(16 * scale, 1);
    expect(errors).toEqual([]);
  });
}

for (const vision of COLOR_VISIONS) {
  test(`the ${vision} palette in a fight`, async ({ page }) => {
    const errors = trackErrors(page);
    await withSaved(page, { ...DEFAULT_SETTINGS, colorVision: vision as ColorVision });
    await enterTraining(page);
    await busyFight(page, 150);
    await shot(page, `palette-${vision}-fight`);
    expect(errors).toEqual([]);
  });
}
