// Harness: serve the code side's production build with `vite preview`, one Chromium (software
// WebGL), run a batch, tear down. One browser at a time (flock in run.sh).
import { spawn } from 'node:child_process';
import { mkdirSync, appendFileSync } from 'node:fs';

// Override per agent: AW_ROOT (a worktree with node_modules), AW_W (logs), AW_PORT (a free port).
export const ROOT = process.env.AW_ROOT ?? '/home/user/aw-work/wt-p9rim';
export const W = process.env.AW_W ?? '/home/user/aw-work/9/rim';
export const PORT = Number(process.env.AW_PORT ?? 4500);
const { chromium } = await import(`${ROOT}/node_modules/playwright/index.mjs`);
export const BASE = `http://127.0.0.1:${PORT}`;
mkdirSync(`${W}/logs`, { recursive: true });
const LOG = `${W}/logs/shots.log`;

export function log(...a) {
  const line = `[${new Date().toISOString().slice(11, 19)}] ${a.join(' ')}`;
  console.log(line);
  appendFileSync(LOG, line + '\n');
}
export const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function up() {
  try {
    return (await fetch(BASE + '/')).ok;
  } catch {
    return false;
  }
}

export async function startServer(dist) {
  if (await up()) throw new Error(`port ${PORT} already serving`);
  const p = spawn(
    'npx',
    ['vite', 'preview', '--outDir', dist, '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'],
    { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], detached: true },
  );
  p.stdout.on('data', () => {});
  p.stderr.on('data', (d) => log('preview:', String(d).trim()));
  for (let i = 0; i < 120; i++) {
    if (await up()) return p;
    await wait(500);
  }
  try { process.kill(-p.pid, 'SIGTERM'); } catch {}
  throw new Error('preview did not come up');
}

export function stopServer(p) {
  try {
    process.kill(-p.pid, 'SIGTERM');
  } catch {}
}

export async function session(dist, fn) {
  const server = await startServer(dist);
  log('server up', dist);
  const browser = await chromium.launch({
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--enable-precise-memory-info'],
  });
  browser.on('disconnected', () => log('browser disconnected'));
  try {
    await fn(browser);
  } finally {
    await browser.close().catch(() => {});
    stopServer(server);
    log('server down');
  }
}

export async function newPage(browser, { width = 1280, height = 720 } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.setDefaultTimeout(300_000);
  page.on('pageerror', (e) => log('pageerror:', e.message));
  page.on('crash', () => log('page crashed'));
  page.on('close', () => log('page closed'));
  page.on('console', (m) => {
    if (m.type() === 'error') log('console.error:', m.text().slice(0, 300));
  });
  return page;
}

export async function shot(page, path, opts = {}) {
  await page.screenshot({ path, ...opts, timeout: 300_000 });
  log('shot', path);
  return path;
}

export async function openVfx(page, query = '') {
  await page.goto(`${BASE}/?lab=vfx${query}`);
  await page.waitForFunction(() => window.__VFX__ !== undefined, null, { timeout: 300_000 });
  await page.evaluate(() => window.__VFX__.manual(2, 33, true));
}

export async function step(page, frames, ms = 33) {
  await page.evaluate(([f, m]) => window.__VFX__.manual(f, m, true), [frames, ms]);
}
