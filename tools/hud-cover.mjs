/* global window, document, process, console, fetch, setTimeout, getComputedStyle, requestAnimationFrame, innerWidth, innerHeight */
// Measures how much of each boss, hero and the Weaver is hidden by the fight's interface
// (docs/phase-8.md, 8c).
//
//   npx vite build --outDir /tmp/cover-dist
//   node tools/hud-cover.mjs --dist /tmp/cover-dist --out /tmp/cover --port 4520
//
// For each fight below, in a real Expedition (seed 4242, Skip the unlocks, a fresh profile) with
// the Skilled bot playing at normal speed, it samples every two seconds through the first minute:
// the box each living boss, miniboss and hero and the Weaver is drawn in (`__AW__.figures()`), and
// the share of that box that lies under an interface piece or off the screen. An interface piece
// is anything painted in the HUD (a background at least half opaque) and the answer chips on the
// telegraphs; the bars and marks a figure wears over its own head are not counted.
//
// Options:
//   --only     a regular expression on the fight's tag (m1-boss-cantor, m2-skirmish, ...)
//   --sizes    viewports, default 1280x720,1920x1080
//   --seconds  how long to sample, default 60; --step the gap between samples, default 2
//   --settings JSON merged into the saved settings before the fight, e.g. '{"reducedMotion":"on"}'
//   --shots    take pictures instead of measuring: `tag@seconds,tag@seconds` (1280x720 at device
//              scale 2, the sim held at that moment), written to <out>/<tag>-t<seconds>s<suffix>.png
//   --suffix   a suffix for the pictures' file names
//   --port     the preview server's port (default 4520; give each agent its own)
// Writes <out>/cover-<width>x<height>.json (every sample) and prints a table: per fight and kind
// of figure, the worst and the average hidden share. `inputs` in the JSON is a hash of every
// command the sim consumed in the sampled time: equal before and after a camera or HUD change
// means the fight itself did not move.
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = {};
for (let i = 2; i < process.argv.length; i += 2) {
  const flag = process.argv[i];
  const value = process.argv[i + 1];
  if (!flag.startsWith('--')) throw new Error(`expected a --flag, got ${flag}`);
  if (value === undefined) throw new Error(`${flag} needs a value`);
  args[flag.slice(2)] = value;
}
const dist = args.dist && resolve(args.dist);
const out = args.out && resolve(args.out);
if (!dist || !out) throw new Error('usage: --dist <dir> --out <dir> [--only re] [--sizes WxH,WxH]');
const ONLY = args.only ? new RegExp(args.only) : null;
const SIZES = (args.sizes ?? '1280x720,1920x1080').split(',').map((s) => s.split('x').map(Number));
const SECONDS = Number(args.seconds ?? 60);
const STEP = Number(args.step ?? 2);
const SETTINGS = args.settings ? JSON.parse(args.settings) : null;
const SHOTS = args.shots
  ? args.shots.split(',').map((s) => {
      const [tag, at] = s.split('@');
      return { tag, at: Number(at) };
    })
  : null;
const SUFFIX = args.suffix ? `-${args.suffix}` : '';
const PORT = Number(args.port ?? 4520);
const BASE = `http://127.0.0.1:${PORT}`;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(`[${new Date().toISOString().slice(11, 19)}]`, ...a);
mkdirSync(out, { recursive: true });

/** tag, Movement, the node kind warped to ('' takes the Movement's first stop, a skirmish). */
const FIGHTS = [
  ['m1-skirmish', 1, ''],
  ['m1-miniboss-bellwarden', 1, 'miniboss'],
  ['m1-boss-cantor', 1, 'boss'],
  ['m2-skirmish', 2, ''],
  ['m2-miniboss-matriarch', 2, 'miniboss'],
  ['m2-boss-vharun', 2, 'boss'],
  ['m3-skirmish', 3, ''],
  ['m3-miniboss-seamstress', 3, 'miniboss'],
  ['m3-boss-unweaver', 3, 'boss'],
  ['finale-conductor', 4, 'boss'],
];

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
  try {
    process.kill(-p.pid, 'SIGTERM');
  } catch {
    // already gone
  }
  throw new Error('preview did not come up');
}

const until = (page, fn, arg, timeout = 180_000) =>
  page.waitForFunction(fn, arg, { timeout, polling: 250 });

/** Title → Expedition (seed 4242) → the fight, begun, with nothing playing yet. */
async function enterFight(page, [tag, movement, kind]) {
  await page.goto(`${BASE}/?e2e=1&seed=4242`);
  await until(page, () => window.__AWRUN__ !== undefined);
  await page
    .getByRole('button', { name: /^Settings$/ })
    .first()
    .click();
  await page.getByText('Skip the unlocks', { exact: true }).click();
  if (SETTINGS) {
    // The saved settings, as the Settings screen writes them, read again on the reload.
    await page.evaluate((extra) => {
      const key = 'aetherweaver.settings';
      const saved = JSON.parse(window.localStorage.getItem(key));
      window.localStorage.setItem(key, JSON.stringify({ ...saved, ...extra }));
    }, SETTINGS);
    await page.goto(`${BASE}/?e2e=1&seed=4242`);
    await until(page, () => window.__AWRUN__ !== undefined);
  }
  await page.evaluate(() => window.__AWRUN__.newRun(4242, 'expedition'));
  await until(page, () => window.__AWRUN__.phase() === 'prep');
  await page.evaluate(() => window.__AWRUN__.embark());
  await until(page, () => window.__AWRUN__.phase() === 'map');
  if (movement > 1) await page.evaluate((m) => window.__AWRUN__.warpMovement(m), movement);
  const node = kind
    ? await page.evaluate((k) => window.__AWRUN__.warp(k), kind)
    : await page.evaluate(() => window.__AWRUN__.choose());
  await until(page, () => window.__AWRUN__.phase() === 'combat');
  await until(page, () => window.__AW__ !== undefined);
  await wait(1500);
  const begin = page.getByRole('button', { name: /Begin the fight/ });
  if (await begin.isVisible().catch(() => false)) {
    await begin.click();
    await wait(500);
  }
  const encounter = await page.evaluate(() => window.__AW__.encounter().id);
  log(tag, 'node', node, 'encounter', encounter);
  return encounter;
}

/** In the page: starts the sampler. It fills `window.__cover` and sets `window.__coverDone`. */
function startSampler([stepTicks, maxTicks]) {
  const PIECES = [
    'decree-line',
    'boss-bar',
    'encounter-header',
    'relic-bar',
    'party-frames',
    'thread-dial',
    'reject-toasts',
    'weaver-bar',
    'note-callout',
    'new-foe',
    'new-ally',
    'hint-toast',
    'key-hints',
  ];
  const alphaOf = (color) => {
    if (!color || color === 'transparent') return 0;
    const slash = /\/\s*([\d.]+)(%?)\s*\)/.exec(color);
    if (slash) return Number(slash[1]) / (slash[2] ? 100 : 1);
    const parts = /^rgba\(([^)]+)\)/.exec(color);
    if (parts) return Number(parts[1].split(',')[3]);
    return 1;
  };
  const nameOf = (el) =>
    (el.dataset.testid === 'coach-hint' ? 'hint-toast' : '') ||
    el.dataset.testid ||
    (el.getAttribute('role') === 'status' && el.closest('[data-testid="weaver-bar-anchor"]')
      ? 'hint-toast'
      : '') ||
    (el.getAttribute('aria-label') === 'Controls' ? 'key-hints' : '') ||
    el.getAttribute('aria-label') ||
    '';
  /** Every painted box of the HUD, and the telegraphs' answer chips. */
  const pieces = () => {
    const rects = [];
    const area = innerWidth * innerHeight;
    const walk = (el, opacity, outer, known) => {
      const cs = getComputedStyle(el);
      if (cs.display === 'none') return;
      const op = opacity * Number(cs.opacity);
      if (op < 0.05) return;
      const name = nameOf(el);
      if (name && !outer) outer = name;
      if (PIECES.includes(name)) known = name;
      if (cs.visibility !== 'hidden' && alphaOf(cs.backgroundColor) * op >= 0.5) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0 && r.width * r.height < area * 0.5)
          rects.push({
            l: r.left,
            t: r.top,
            r: r.right,
            b: r.bottom,
            label: known || outer || 'hud',
          });
      }
      for (const child of el.children) walk(child, op, outer, known);
    };
    const hud = document.querySelector('[data-testid="hud"]');
    if (hud) for (const child of hud.children) walk(child, 1, '', '');
    for (const chip of document.querySelectorAll('[data-testid="world-overlay"] [data-cover]')) {
      if (chip.style.display === 'none') continue;
      const r = chip.getBoundingClientRect();
      if (r.width > 0) rects.push({ l: r.left, t: r.top, r: r.right, b: r.bottom, label: 'chip' });
    }
    return rects;
  };
  /** The share of `box` off the screen or under a piece, on a 2 px grid. */
  const cover = (box, rects) => {
    const w = box.right - box.left;
    const h = box.bottom - box.top;
    const nx = Math.max(1, Math.round(w / 2));
    const ny = Math.max(1, Math.round(h / 2));
    let off = 0;
    let under = 0;
    const by = {};
    const near = rects.filter(
      (r) => r.r > box.left && r.l < box.right && r.b > box.top && r.t < box.bottom,
    );
    for (let j = 0; j < ny; j++) {
      const y = box.top + ((j + 0.5) * h) / ny;
      for (let i = 0; i < nx; i++) {
        const x = box.left + ((i + 0.5) * w) / nx;
        if (x < 0 || x >= innerWidth || y < 0 || y >= innerHeight) {
          off++;
          continue;
        }
        let hit = false;
        let seen = '';
        for (const r of near) {
          if (x < r.l || x >= r.r || y < r.t || y >= r.b) continue;
          hit = true;
          if (!seen.includes(`|${r.label}|`)) {
            seen += `|${r.label}|`;
            by[r.label] = (by[r.label] ?? 0) + 1;
          }
        }
        if (hit) under++;
      }
    }
    const n = nx * ny;
    for (const k of Object.keys(by)) by[k] = +(by[k] / n).toFixed(4);
    return { hidden: +((off + under) / n).toFixed(4), off: +(off / n).toFixed(4), by };
  };
  const samples = [];
  window.__cover = samples;
  window.__coverDone = '';
  window.__coverPieces = pieces;
  let next = 0;
  const loop = () => {
    const aw = window.__AW__;
    if (!aw) {
      window.__coverDone = 'the fight ended';
      return;
    }
    const tick = aw.tick();
    if (tick >= next) {
      const rects = pieces();
      samples.push({
        tick,
        figures: aw.figures().map((f) => ({
          kind: f.kind,
          name: f.name,
          x: +f.x.toFixed(2),
          z: +f.z.toFixed(2),
          box: [f.left, f.top, f.right, f.bottom].map((v) => Math.round(v)),
          ...cover(f, rects),
        })),
      });
      while (next <= tick) next += stepTicks;
    }
    const status = aw.encounter().status;
    const over = status === 'victory' || status === 'defeat';
    if (next > maxTicks || over) {
      // Hold the sim so the replay read next ends close to the last sample.
      aw.setDevTimeScale(0);
      window.__coverDone = next > maxTicks ? 'full' : `the fight ended in ${status}`;
      return;
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

/** A hash of every command the sim consumed up to `ticks`. */
function inputsHash(replay, ticks) {
  const frames = replay.frames.filter((f) => f[0] < ticks);
  return createHash('sha256').update(JSON.stringify(frames)).digest('hex').slice(0, 16);
}

function summarise(samples) {
  const kinds = {};
  for (const s of samples) {
    const seconds = s.tick / 60;
    for (const f of s.figures) {
      const kind = f.kind === 'miniboss' ? 'boss' : f.kind;
      // A boss is judged after its entrance (the first three seconds).
      if (kind === 'boss' && seconds < 3) continue;
      const k = (kinds[kind] ??= { worst: 0, at: 0, who: '', sum: 0, n: 0, by: {} });
      k.sum += f.hidden;
      k.n++;
      if (f.hidden > k.worst) {
        k.worst = f.hidden;
        k.at = Math.round(seconds);
        k.who = f.name;
        k.by = f.off > 0 ? { ...f.by, 'off-screen': f.off } : f.by;
      }
    }
  }
  for (const k of Object.values(kinds)) {
    k.average = +(k.sum / Math.max(1, k.n)).toFixed(4);
    delete k.sum;
  }
  return kinds;
}

const pct = (v) => `${(v * 100).toFixed(0)}%`.padStart(4);

function table(result) {
  const lines = [
    'fight                     boss worst (at)  avg   hero worst (at)  avg   Weaver worst  avg',
  ];
  for (const [tag, r] of Object.entries(result)) {
    const cell = (k) =>
      k ? `${pct(k.worst)} (${String(k.at).padStart(2)}s)  ${pct(k.average)}` : '   -          -';
    lines.push(
      `${tag.padEnd(26)}${cell(r.summary.boss)}   ${cell(r.summary.hero)}   ${cell(r.summary.weaver)}`,
    );
  }
  return lines.join('\n');
}

const server = await serve();
const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
// Stopped from outside: never leave the browser or the server behind.
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => {
    browser
      .close()
      .catch(() => {})
      .finally(() => {
        try {
          process.kill(-server.pid, 'SIGTERM');
        } catch {
          // already gone
        }
        process.exit(1);
      });
  });
const open = async (width, height, scale) => {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: scale });
  const page = await ctx.newPage();
  page.setDefaultTimeout(300_000);
  page.on('pageerror', (e) => log('pageerror:', e.message));
  return page;
};
try {
  if (SHOTS) {
    for (const { tag, at } of SHOTS) {
      const fight = FIGHTS.find((f) => f[0] === tag);
      if (!fight) throw new Error(`no fight tagged ${tag}`);
      const page = await open(1280, 720, 2);
      try {
        await enterFight(page, fight);
        await page.evaluate(() => window.__AW__.autoplay('skilled'));
        // Normal speed up to the moment, then the sim held on its tick: the camera is where a
        // player would have it. Until six seconds before, the window is kept small, where
        // software frames come sooner (the fight is the same fight at any size).
        const reach = (tick) =>
          page.waitForFunction((t) => !!window.__AW__ && window.__AW__.tick() >= t, tick, {
            timeout: 1_800_000,
            polling: 'raf',
          });
        if (at > 8) {
          await page.setViewportSize({ width: 320, height: 180 });
          await reach(at * 60 - 360);
          await page.setViewportSize({ width: 1280, height: 720 });
        }
        await page.waitForFunction(
          (t) => {
            if (!window.__AW__ || window.__AW__.tick() < t) return false;
            window.__AW__.setDevTimeScale(0);
            return true;
          },
          at * 60,
          { timeout: 1_800_000, polling: 'raf' },
        );
        await wait(1500);
        const file = `${out}/${tag}-t${at}s${SUFFIX}.png`;
        await page.screenshot({ path: file, timeout: 300_000 });
        log('shot', file, 'tick', await page.evaluate(() => window.__AW__.tick()));
      } catch (e) {
        log(tag, 'FAILED', String(e).slice(0, 300));
      }
      await page.context().close();
    }
  } else {
    for (const [width, height] of SIZES) {
      const file = `${out}/cover-${width}x${height}.json`;
      const result = existsSync(file) && ONLY ? JSON.parse(readFileSync(file, 'utf8')) : {};
      for (const fight of FIGHTS) {
        const tag = fight[0];
        if (ONLY && !ONLY.test(tag)) continue;
        // A coarse drawing buffer: the boxes and the HUD are in CSS pixels whatever the device
        // scale is, and software frames come several times sooner.
        const page = await open(width, height, Number(args.scale ?? 0.25));
        try {
          const encounter = await enterFight(page, fight);
          await page.evaluate(startSampler, [STEP * 60, SECONDS * 60]);
          await page.evaluate(() => window.__AW__.autoplay('skilled'));
          await until(page, () => window.__coverDone !== '', null, 1_800_000);
          const samples = await page.evaluate(() => window.__cover);
          const ended = await page.evaluate(() => window.__coverDone);
          // The last whole step sampled: the same tick whatever the frames' timing was.
          const lastTick = samples[samples.length - 1]?.tick ?? 0;
          const last = Math.floor(lastTick / (STEP * 60)) * STEP * 60;
          const replay = await page.evaluate(() => window.__AW__?.exportReplay() ?? null);
          result[tag] = {
            encounter,
            ended,
            samples,
            inputs: replay ? inputsHash(replay, last) : null,
            inputsThrough: last,
            pieces: await page.evaluate(() => [
              ...new Set(window.__coverPieces().map((r) => r.label)),
            ]),
            summary: summarise(samples),
          };
          log(
            tag,
            `${width}x${height}`,
            ended,
            samples.length,
            'samples',
            JSON.stringify(result[tag].summary),
          );
        } catch (e) {
          log(tag, 'FAILED', String(e).slice(0, 300));
        }
        await page.context().close();
        writeFileSync(file, JSON.stringify(result));
      }
      console.log(`\n${width} x ${height}\n${table(result)}\n`);
      writeFileSync(`${out}/cover-${width}x${height}.txt`, `${table(result)}\n`);
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
