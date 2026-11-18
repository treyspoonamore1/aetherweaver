// boss.mjs <tag> <kind> [fromSeconds]: a real boss fight through the real combat screen with its
// HUD (1280x720, device scale 2), the Skilled bot playing (its Thread follows the Solos). Freezes
// the sim on the first frames that show (a) a Solo strip in the "now" state, (b) a Cued one beside
// a plain one, (c) a Cued one, after `fromSeconds`, and takes each. Writes raw/boss-<tag>-<a|b|c>.png.
import { session, newPage, log, W, BASE } from './lib.mjs';
const [tag = 'cantor', kind = 'boss', from = '18'] = process.argv.slice(2);
const out = `${W}/raw`;
const until = (page, fn, arg, timeout = 180_000) => page.waitForFunction(fn, arg, { timeout, polling: 250 });
await session(async (browser) => {
  const page = await newPage(browser);
  await page.goto(`${BASE}/?e2e=1&seed=4242`);
  await until(page, () => window.__AWRUN__ !== undefined);
  await page.getByRole('button', { name: /^Settings$/ }).first().click();
  await page.getByText('Skip the unlocks', { exact: true }).click();
  await page.evaluate(() => window.__AWRUN__.newRun(4242, 'expedition'));
  await until(page, () => window.__AWRUN__.phase() === 'prep');
  await page.evaluate(() => window.__AWRUN__.embark());
  await until(page, () => window.__AWRUN__.phase() === 'map');
  log(tag, 'node', await page.evaluate((k) => window.__AWRUN__.warp(k), kind));
  await until(page, () => window.__AWRUN__.phase() === 'combat');
  await until(page, () => window.__AW__ !== undefined);
  await page.waitForTimeout(3000);
  const begin = page.getByRole('button', { name: /Begin the fight/ });
  if (await begin.isVisible().catch(() => false)) { await begin.click(); await page.waitForTimeout(800); }
  await page.mouse.move(1270, 710);
  log(tag, 'encounter', JSON.stringify(await page.evaluate(() => window.__AW__.encounter())));
  await page.evaluate(() => window.__AW__.autoplay('skilled'));
  // A small view while the fight runs up to the moment (software rendering is slow at full size).
  await page.setViewportSize({ width: 320, height: 180 });
  await page.evaluate(() => window.__AW__.setDevTimeScale(3));
  await page.waitForFunction((s) => window.__AW__.snapshot().time >= s, Number(from), { timeout: 900_000, polling: 200 });
  await page.evaluate(() => window.__AW__.setDevTimeScale(0.5));
  log(tag, 'at', await page.evaluate(() => window.__AW__.snapshot().time.toFixed(2)));
  const WANT = {
    // A Solo full with the Thread elsewhere, and none Cued.
    a: () => {
      const s = [...document.querySelectorAll('[data-testid="solo-strip"]')].map((e) => e.dataset.state);
      return s.includes('now') && !s.includes('cued');
    },
    // One Cued beside one that is not.
    b: () => {
      const s = [...document.querySelectorAll('[data-testid="solo-strip"]')].map((e) => e.dataset.state);
      return s.includes('cued') && (s.includes('now') || s.includes('coming'));
    },
    // Later in the fight (more on screen): any Cued strip.
    c: () => !!document.querySelector('[data-testid="solo-strip"][data-state="cued"]'),
    // Later still: a Solo coming or full with the Thread elsewhere.
    d: () => !!document.querySelector('[data-testid="solo-strip"]:not([data-state="cued"])'),
  };
  const AFTER = { a: 0, b: 0, c: Number(process.argv[5] ?? 55), d: Number(process.argv[6] ?? 80) };
  for (const key of ['a', 'b', 'c', 'd']) {
    if (AFTER[key] > 0) {
      await page.evaluate(() => window.__AW__.setDevTimeScale(3));
      await page.waitForFunction((s) => window.__AW__.snapshot().time >= s || window.__AWRUN__.phase() !== 'combat', AFTER[key], { timeout: 900_000, polling: 200 });
      await page.evaluate(() => window.__AW__.setDevTimeScale(0.5));
    }
    try {
      await page.waitForFunction(
        (src) => {
          // eslint-disable-next-line no-new-func
          if (new Function(`return (${src})()`)()) { window.__AW__.setDevTimeScale(0); return true; }
          return false;
        },
        WANT[key].toString(),
        { timeout: 300_000, polling: 'raf' },
      );
    } catch { log(tag, key, 'not seen'); continue; }
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.mouse.move(1270, 710);
    await page.waitForTimeout(2500);
    const states = await page.evaluate(() => [...document.querySelectorAll('[data-testid="solo-strip"]')].map((e) => e.dataset.state + ':' + e.textContent));
    await page.screenshot({ path: `${out}/boss-${tag}-${key}.png` });
    log(tag, key, 'at', await page.evaluate(() => window.__AW__.snapshot().time.toFixed(2)), JSON.stringify(states));
    await page.setViewportSize({ width: 320, height: 180 });
    // Run on past this moment before looking for the next.
    await page.evaluate(() => window.__AW__.setDevTimeScale(1));
    const t0 = await page.evaluate(() => window.__AW__.snapshot().time);
    await page.waitForFunction((t) => window.__AW__.snapshot().time >= t + 4 || window.__AWRUN__.phase() !== 'combat', t0, { timeout: 300_000, polling: 200 });
    await page.evaluate(() => window.__AW__.setDevTimeScale(0.5));
  }
});
