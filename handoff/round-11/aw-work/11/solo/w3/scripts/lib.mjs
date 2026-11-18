// Harness for W3's pictures: one Chromium (software WebGL) against a server already running
// (vite dev or preview) on AW_PORT. No server is started or stopped here.
import { appendFileSync, mkdirSync } from 'node:fs';
export const ROOT = process.env.AW_ROOT ?? '/home/user/aw-work/wt-p11solo-w3';
export const W = process.env.AW_W ?? '/home/user/aw-work/11/solo/w3';
export const PORT = Number(process.env.AW_PORT ?? 4610);
const { chromium } = await import(`${ROOT}/node_modules/playwright/index.mjs`);
export const BASE = `http://127.0.0.1:${PORT}`;
mkdirSync(`${W}/logs`, { recursive: true });
const LOG = `${W}/logs/shots.log`;
export function log(...a) {
  const line = `[${new Date().toISOString().slice(11, 19)}] ${a.join(' ')}`;
  console.log(line);
  appendFileSync(LOG, line + '\n');
}
export async function session(fn) {
  const browser = await chromium.launch({
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  try {
    await fn(browser);
  } finally {
    await browser.close().catch(() => {});
  }
}
export async function newPage(browser, { width = 1280, height = 720, reduced = false } = {}) {
  const ctx = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 2,
    reducedMotion: reduced ? 'reduce' : 'no-preference',
  });
  const page = await ctx.newPage();
  page.setDefaultTimeout(300_000);
  page.on('pageerror', (e) => log('pageerror:', e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') log('console.error:', m.text().slice(0, 300));
  });
  return page;
}
export const api = (p, fn, arg) => p.evaluate(fn, arg);
export async function openVfx(page, query = '') {
  await page.goto(`${BASE}/?lab=vfx${query}`);
  await page.waitForFunction(() => window.__VFX__ !== undefined, null, { timeout: 300_000 });
  await api(page, () => window.__VFX__.manual(2, 33, true));
  await page.mouse.move(1275, 715);
}
export const step = (page, frames, ms = 33) =>
  api(page, ([f, m]) => window.__VFX__.manual(f, m, true), [frames, ms]);
/** Pins a close camera on a party slot (the game's pitch, `d` metres away, looking at the head). */
export const pin = (page, slot, d = 11) =>
  api(page, ([s, dist]) => {
    const V = window.__VFX__;
    const st = V.state();
    const e = st.entities.get(V.heroId(s));
    const pitch = (52 * Math.PI) / 180;
    V.pinCamera({ eye: [e.x, 2 + dist * Math.sin(pitch), e.z + dist * Math.cos(pitch)], at: [e.x, 2, e.z] });
    V.manual(2, 16, true);
  }, [slot, d]);
export const unpin = (page) => api(page, () => window.__VFX__.pinCamera(null));
/** A crop round a party slot: `wide` x `tall` reference heights (2 m), feet near the bottom. */
export async function crop(page, slot, file, wide = 2.6, tall = 3.4) {
  const at = await api(page, (s) => {
    const V = window.__VFX__;
    const st = V.state();
    const e = st.entities.get(V.heroId(s));
    const c = document.querySelector('canvas').getBoundingClientRect();
    return { a: V.screenOf(e.x, 0, e.z), b: V.screenOf(e.x, 2.0, e.z), canvas: { x: c.left, y: c.top } };
  }, slot);
  const h = at.a.y - at.b.y;
  const w = h * wide;
  let x = Math.max(at.canvas.x, Math.min(at.canvas.x + 1280 - w, at.a.x - w / 2));
  let y = Math.max(at.canvas.y, at.a.y + h * 0.3 - h * tall);
  const clip = { x, y, width: w, height: Math.min(at.a.y + h * 0.3, at.canvas.y + 720) - y };
  await page.screenshot({ path: file, clip, timeout: 300_000 });
  log('shot', file);
}
