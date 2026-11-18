// Menu-text capture: serve a build with `vite preview`, open it in Chromium (software WebGL),
// take a picture of each screen and write down the words a player can see on it.
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, appendFileSync, existsSync, readFileSync } from 'node:fs';

export const ROOT = '/home/user/aw-work/wt-p11menu';
export const S = '/home/user/aw-work/11/menu';
const { chromium } = await import(`${ROOT}/node_modules/playwright/index.mjs`);
export const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export function log(...a) {
  const line = `[${new Date().toISOString().slice(11, 19)}] ${a.join(' ')}`;
  console.log(line);
  appendFileSync(`${S}/logs/shots.log`, line + '\n');
}

async function up(base) {
  try {
    return (await fetch(base + '/')).ok;
  } catch {
    return false;
  }
}

export async function startServer(dist, port) {
  const base = `http://127.0.0.1:${port}`;
  if (await up(base)) return { p: null, base };
  const p = spawn(
    'npx',
    ['vite', 'preview', '--outDir', dist, '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
    { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], detached: true },
  );
  p.stdout.on('data', () => {});
  p.stderr.on('data', (d) => log('preview:', String(d).trim()));
  for (let i = 0; i < 120; i++) {
    if (await up(base)) return { p, base };
    await wait(500);
  }
  try { process.kill(-p.pid, 'SIGTERM'); } catch {}
  throw new Error('preview did not come up');
}

export async function session(dist, port, fn) {
  const { p, base } = await startServer(dist, port);
  const browser = await chromium.launch({
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  try {
    await fn(browser, base);
  } finally {
    await browser.close().catch(() => {});
    if (p) try { process.kill(-p.pid, 'SIGTERM'); } catch {}
  }
}

export async function newPage(browser, { width = 1280, height = 720, reducedMotion = 'reduce' } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, reducedMotion });
  const page = await ctx.newPage();
  page.setDefaultTimeout(20_000);
  page.on('pageerror', (e) => log('pageerror:', e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') log('console.error:', m.text().slice(0, 300));
  });
  return page;
}

/**
 * The words a player can see: every text node that is displayed, not shrunk to a pixel (the
 * screen-reader-only text) and not transparent. `inView` counts only those inside the window and
 * inside every scrolling box that holds them. Root: the topmost dialog when one is open, else the
 * selector given, else the page.
 */
export async function readWords(page, rootSel) {
  return page.evaluate((rootSel) => {
    const dialogs = [...document.querySelectorAll('[role="dialog"],[role="alertdialog"]')].filter((d) => d.checkVisibility());
    const root = (rootSel && document.querySelector(rootSel)) || dialogs.at(-1) || document.body;
    const vw = innerWidth, vh = innerHeight;
    const words = (s) => s.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w));
    const lines = [];
    let all = 0, inView = 0;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let n;
    const blockOf = (el) => {
      let e = el;
      while (e && e !== root) {
        const d = getComputedStyle(e).display;
        if (d !== 'inline' && d !== 'inline-block' && d !== 'contents' && d !== 'inline-flex') return e;
        e = e.parentElement;
      }
      return root;
    };
    let lastBlock = null;
    while ((n = walker.nextNode())) {
      const s = n.textContent.replace(/\s+/g, ' ').trim();
      if (!s) continue;
      const el = n.parentElement;
      if (!el || el.closest('script,style,noscript,title,desc')) continue;
      if (!el.checkVisibility({ opacityProperty: true, visibilityProperty: true, contentVisibilityAuto: true })) continue;
      const range = document.createRange();
      range.selectNodeContents(n);
      const rects = [...range.getClientRects()].filter((r) => r.width > 1.5 && r.height > 1.5);
      if (!rects.length) continue;
      // An ancestor shrunk to a pixel or clipped away (sr-only), or faded out.
      let hidden = false, clipBoxes = [];
      for (let e = el; e && e !== document.documentElement; e = e.parentElement) {
        const cs = getComputedStyle(e);
        if (Number(cs.opacity) < 0.05) { hidden = true; break; }
        const b = e.getBoundingClientRect();
        if ((cs.overflow !== 'visible' || cs.clip !== 'auto' || cs.clipPath !== 'none') && (b.width <= 2 || b.height <= 2)) { hidden = true; break; }
        if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible') clipBoxes.push(b);
      }
      if (hidden) continue;
      const w = words(s).length;
      if (!w) continue;
      all += w;
      const r = rects[0];
      const cx = r.left + Math.min(r.width, 8) / 2, cy = r.top + r.height / 2;
      const seen = cx >= 0 && cx <= vw && cy >= 0 && cy <= vh && clipBoxes.every((b) => cx >= b.left - 1 && cx <= b.right + 1 && cy >= b.top - 1 && cy <= b.bottom + 1);
      if (seen) inView += w;
      const blk = blockOf(el);
      if (blk === lastBlock) lines[lines.length - 1].text += ' ' + s;
      else lines.push({ text: s, seen });
      lastBlock = blk;
      if (!seen) lines[lines.length - 1].seen = false;
    }
    return { all, inView, lines };
  }, rootSel);
}

/** One screen: a picture, its words as a text file, and a row in counts.json. */
export async function snap(page, outDir, id, { root, note = '', settle = 350 } = {}) {
  mkdirSync(outDir, { recursive: true });
  await wait(settle);
  let w = await readWords(page, root);
  // A dialog still fading in reads as empty: wait for its words.
  for (let i = 0; i < 8 && w.all === 0; i++) {
    await wait(1000);
    w = await readWords(page, root);
  }
  await page.screenshot({ path: `${outDir}/${id}.png`, timeout: 180_000 });
  writeFileSync(`${outDir}/${id}.txt`, w.lines.map((l) => (l.seen ? '' : '(off screen) ') + l.text).join('\n') + '\n');
  const file = `${outDir}/counts.json`;
  const counts = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
  counts[id] = { words: w.all, inView: w.inView, note };
  writeFileSync(file, JSON.stringify(counts, null, 1));
  log('snap', id, `${w.all} words (${w.inView} in view)`);
  return w;
}
