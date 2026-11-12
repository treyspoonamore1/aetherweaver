/* global window, document, Image, Buffer, process, console, fetch, setTimeout */
// Photographs stained-glass figures in the lab's art studio (docs/art-style.md, The studio).
//
//   npx vite build --outDir /tmp/art-dist
//   node tools/art-shoot/shoot.mjs --dist /tmp/art-dist --out /tmp/art-shots \
//     --ids kael,lamenter,the_hollow_cantor --world spire --views budget,close,field,lineup,pose
//
// Options:
//   --ids     roster ids: a hero id, `weaver`, an enemy id, `sapling`, `ancient`, `crown`
//             (default: the seven of the first pass, in the studio's fixed placing)
//   --world   reliquary | spire | rift | crucible, or any arena id (default reliquary)
//   --views   close (close-<id>.png), field (field-<world>.png, the game's camera), lineup
//             (lineup-<world>.png), pose (pose-<id>.png: a six-frame held attack: wind-up 0.5 and 1,
//             blow 0.26, 0.31, 0.42, 0.7), budget (budgets.json: triangles against each size
//             class's budget). Default close,field,lineup.
//   --extra   JSON merged into every studio spec, e.g. '{"elite":["mirror_alto"]}',
//             '{"hostile":"edge"}', '{"look":{"robe":"robe_dusk"}}', '{"pose":{"clock":3}}'
//   --tag     a suffix for every file name (close-<id>-<tag>.png)
//   --port    the preview server's port (default 4471; give each agent its own)
// Environment: TMPDIR for the browser's profile (put it on a disk with room: a full disk makes
// page loads fail silently).
// Pictures are 1280×720 CSS px at device scale 2 (2560×1440), software WebGL (SwiftShader).
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const args = {};
for (let i = 2; i < process.argv.length; i += 2) {
  const flag = process.argv[i];
  const value = process.argv[i + 1];
  if (!flag.startsWith('--')) throw new Error(`expected a --flag, got ${flag}`);
  if (value === undefined || value.startsWith('--')) throw new Error(`${flag} needs a value`);
  args[flag.slice(2)] = value;
}
const dist = args.dist && resolve(args.dist);
const out = args.out && resolve(args.out);
if (!dist || !out)
  throw new Error('usage: --dist <dir> --out <dir> [--ids a,b] [--world w] [--views v,w]');
const SEVEN = 'kael,lyra,vexis,weaver,hollow_chorister,bell_brute,the_bellwarden';
const ids = (args.ids ?? SEVEN).split(',').filter(Boolean);
const WORLDS = {
  reliquary: 'reliquary_hall',
  spire: 'spire_gate',
  rift: 'rift_mouth',
  crucible: 'the_crucible',
};
const world = args.world ?? 'reliquary';
const arena = WORLDS[world] ?? world;
const views = (args.views ?? 'close,field,lineup').split(',');
const extra = args.extra ? JSON.parse(args.extra) : {};
const tag = args.tag ? `-${args.tag}` : '';
const PORT = Number(args.port ?? 4471);
const BASE = `http://127.0.0.1:${PORT}`;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(`[${new Date().toISOString().slice(11, 19)}]`, ...a);
mkdirSync(out, { recursive: true });

async function up() {
  try {
    return (await fetch(`${BASE}/`)).ok;
  } catch {
    return false;
  }
}

async function serve() {
  if (await up()) throw new Error(`port ${PORT} already serving`);
  const p = spawn(
    'npx',
    [
      'vite',
      'preview',
      '--outDir',
      dist,
      '--host',
      '127.0.0.1',
      '--port',
      String(PORT),
      '--strictPort',
    ],
    { cwd: ROOT, stdio: 'ignore', detached: true },
  );
  for (let i = 0; i < 120; i++) {
    if (await up()) return p;
    await wait(500);
  }
  // Never leave a server behind: it would hold the port for the next run.
  try {
    process.kill(-p.pid, 'SIGTERM');
  } catch {
    // already gone
  }
  throw new Error('preview did not come up');
}

/** Steps the lab by hand: `frames` frames of `ms` each. */
const step = (page, frames, ms = 33) =>
  page.evaluate(([f, m]) => window.__VFX__.manual(f, m, true), [frames, ms]);

async function fitCanvas(page) {
  const rect = () =>
    page.evaluate(() => {
      const c = document.querySelector('canvas').getBoundingClientRect();
      return { x: c.left, y: c.top, w: c.width, h: c.height };
    });
  for (let i = 0; i < 3; i++) {
    const r = await rect();
    if (Math.round(r.w) === 1280 && Math.round(r.h) === 720) return r;
    const vp = page.viewportSize();
    await page.setViewportSize({
      width: vp.width + (1280 - Math.round(r.w)),
      height: vp.height + (720 - Math.round(r.h)),
    });
    await step(page, 2);
  }
  return rect();
}

async function studio(page, spec, settle = 40) {
  await page.evaluate((sp) => window.__VFX__.studio(sp), { ...spec, ...extra });
  await step(page, 3);
  if (settle) await step(page, settle, 33);
}

/** Six frames side by side, composed in the page's own canvas. */
async function strip(page, frames, file) {
  const urls = frames.map((b) => `data:image/png;base64,${b.toString('base64')}`);
  const png = await page.evaluate(async (list) => {
    const imgs = await Promise.all(
      list.map(
        (u) =>
          new Promise((res) => {
            const i = new Image();
            i.onload = () => res(i);
            i.src = u;
          }),
      ),
    );
    const w = 640;
    const c = document.createElement('canvas');
    c.width = w * imgs.length;
    c.height = w;
    const g = c.getContext('2d');
    imgs.forEach((im, k) => g.drawImage(im, k * w, 0, w, w));
    return c.toDataURL('image/png');
  }, urls);
  writeFileSync(file, Buffer.from(png.split(',')[1], 'base64'));
}

const server = await serve();
const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
try {
  const ctx = await browser.newContext({
    viewport: { width: 1570, height: 720 },
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();
  page.setDefaultTimeout(300_000);
  page.on('pageerror', (e) => log('pageerror:', e.message));
  await page.goto(`${BASE}/?lab=vfx`);
  await page.waitForFunction(() => window.__VFX__ !== undefined, null, { timeout: 300_000 });
  await step(page, 2);
  const r = await fitCanvas(page);
  const clip = { x: r.x, y: r.y, width: 1280, height: 720 };
  const shoot = async (file) => {
    await page.screenshot({ path: file, clip, timeout: 300_000 });
    log('shot', file);
  };
  if (views.includes('budget')) {
    const rows = await page.evaluate(() => window.__VFX__.artBudgets());
    writeFileSync(`${out}/budgets.json`, JSON.stringify(rows, null, 1));
    for (const row of rows) if (!row.ok) log('over budget', JSON.stringify(row));
  }
  if (views.includes('close'))
    for (const id of ids) {
      await studio(page, { layout: 'close', subject: id, arena });
      await shoot(`${out}/close-${id}${tag}.png`);
    }
  // No --ids: the studio's fixed placing of the seven (pictures line up with earlier rounds).
  const subjects = args.ids ? ids : undefined;
  if (views.includes('field')) {
    await studio(page, { layout: 'field', subjects, arena });
    await shoot(`${out}/field-${world}${tag}.png`);
  }
  if (views.includes('lineup')) {
    await studio(page, { layout: 'lineup', subjects, arena });
    await shoot(`${out}/lineup-${world}${tag}.png`);
  }
  if (views.includes('pose')) {
    const poses = [
      { windup: 0.5 },
      { windup: 1 },
      { blow: 0.26 },
      { blow: 0.31 },
      { blow: 0.42 },
      { blow: 0.7 },
    ];
    const sq = { x: r.x + 320, y: r.y + 40, width: 640, height: 640 };
    for (const id of ids) {
      const frames = [];
      for (const pose of poses) {
        await studio(page, { layout: 'close', subject: id, arena, pose: { clock: 3, ...pose } }, 0);
        frames.push(await page.screenshot({ clip: sq, timeout: 300_000 }));
      }
      await strip(page, frames, `${out}/pose-${id}${tag}.png`);
      log('strip', `${out}/pose-${id}${tag}.png`);
    }
  }
} finally {
  await browser.close().catch(() => {});
  try {
    process.kill(-server.pid, 'SIGTERM');
  } catch {
    // already gone
  }
}
