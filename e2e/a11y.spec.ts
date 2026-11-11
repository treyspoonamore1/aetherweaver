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
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
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
  await page.getByRole('heading', { name: 'Telegraphs' }).scrollIntoViewIfNeeded();
  await shot(page, 'settings-options-set');
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
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
    await shot(page, `scale-${scale * 100}-settings`);
    await page.getByRole('heading', { name: 'Telegraphs' }).scrollIntoViewIfNeeded();
    await shot(page, `scale-${scale * 100}-settings-telegraphs`);
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

/**
 * Review A, finding 2 (docs/phase-7.md, ground rule 4): an aura's and an ornament's own interface
 * keeps its motion exactly as at 81a12ef, whatever Reduced motion says. At 81a12ef the stylesheet
 * had one rule, the OS's: under `reduce` every animation and transition was cut to 0.01 ms, and
 * otherwise each played as styled. So, for each OS setting and each Reduced motion setting, the
 * computed transition of a Weaver-bar song chip's part (inside `chords`), a Chord-builder aura or
 * ornament slot card and a picker item must equal: the styled duration with the OS not reducing
 * motion, and 0.01 ms (`1e-05s`) with it reducing. System is the OS rule alone, as at 81a12ef.
 */
test('the aura and ornament interface keeps its motion as at 81a12ef, per OS and setting', async ({
  page,
}) => {
  const errors = trackErrors(page);
  const CUT = '1e-05s';
  const read = async (selector: string, os: 'no-preference' | 'reduce', motion: string | null) =>
    page
      .evaluate(
        ([sel, m]) => {
          const root = document.documentElement;
          if (m === null) delete root.dataset.motion;
          else root.dataset.motion = m;
          const els = [...document.querySelectorAll(sel)];
          return els.map((el) => getComputedStyle(el).transitionDuration);
        },
        [selector, motion] as const,
      )
      .then((v) => ({ os, motion, v }));
  const SITES = [
    // The song chips: the Ring's arc as the Ring styles it (src/ui/kit/Ring.tsx; it shows on a
    // chip while a song cools down), put inside the HUD's real chips, and the chips' own parts.
    { view: 'hud-calm', sel: '[data-testid="chords"] *', styled: '0.12s', ring: true },
    // A song's aura and ornament slot cards, and the palette's picker items.
    {
      view: 'chords-illegal',
      sel: '[data-testid="chord-builder"] [data-testid^="song-"] button[aria-pressed]',
      styled: '0.15s',
      ring: false,
    },
    {
      view: 'chords-illegal',
      sel: '[data-testid="chord-builder"] [aria-labelledby="palette-title"] button[aria-pressed]',
      styled: '0.15s',
      ring: false,
    },
  ];
  for (const site of SITES) {
    for (const os of ['no-preference', 'reduce'] as const) {
      await page.emulateMedia({ reducedMotion: os });
      await page.goto(`/?lab=ui&view=${site.view}&nav=0&fit=0`);
      await expect(page.locator(site.sel).first()).toBeAttached({ timeout: 60_000 });
      if (site.ring)
        await page.evaluate(() => {
          const arc = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
          arc.setAttribute('style', 'transition: stroke-dashoffset 120ms linear');
          const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
          svg.append(arc);
          document.querySelector('[data-testid="chords"]')!.append(svg);
        });
      // As at 81a12ef: the OS rule alone (System, no `data-motion`).
      const base = await read(site.sel, os, null);
      if (os === 'no-preference') {
        const moving = base.v.filter((d) => d !== '0s');
        expect(moving.length, `${site.view}: something here transitions`).toBeGreaterThan(0);
        if (site.styled) expect(new Set(moving)).toEqual(new Set([site.styled]));
      } else expect(new Set(base.v)).toEqual(new Set([CUT]));
      for (const motion of ['off', 'on']) {
        const got = await read(site.sel, os, motion);
        expect(got.v, `${site.view}: OS ${os}, Reduced motion ${motion}`).toEqual(base.v);
      }
    }
  }
  // Everything else still follows the setting: On cuts it, Off keeps it, whatever the OS says.
  for (const os of ['no-preference', 'reduce'] as const) {
    await page.emulateMedia({ reducedMotion: os });
    await page.goto('/?lab=ui&view=chords-illegal&nav=0&fit=0');
    const sel = '[data-testid="chord-builder"] [aria-labelledby="presets-title"] button';
    await expect(page.locator(sel).first()).toBeAttached({ timeout: 60_000 });
    expect(new Set((await read(sel, os, 'on')).v)).toEqual(new Set([CUT]));
    expect(new Set((await read(sel, os, 'off')).v)).toEqual(new Set(['0.15s']));
  }
  expect(errors).toEqual([]);
});
