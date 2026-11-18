// Shared harness for the demo checks: serves dist-demo under a host-like content policy on port
// 4440 (also a few "host" pages that show the demo in an iframe) and collects problems.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { createRequire } from 'node:module';
export const { chromium } = createRequire('/home/user/aetherweaver/package.json')('playwright');

export const ROOT = process.env.DEMO_ROOT ?? '/home/user/aetherweaver/dist-demo';
export const SHOTS = '/home/user/aw-work/8/land/demo/shots';
export const PORT = 4440;
export const ORIGIN = `http://localhost:${PORT}`;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };
// Same policy as /home/user/aw-work/scripts/demo-smoke.mjs.
export const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://unpkg.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob:",
  "media-src 'self' data: blob:",
  "connect-src 'self'",
  "worker-src 'self' blob:",
].join('; ');

export function serve() {
  const hits = [];
  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', ORIGIN);
    const path = decodeURIComponent(url.pathname);
    hits.push(path);
    // A "host" page that shows the demo in an iframe from another origin (127.0.0.1 vs localhost).
    if (path.startsWith('/__host/')) {
      const mode = path.slice('/__host/'.length);
      const sandbox = { plain: '', sandboxed: ' sandbox="allow-scripts allow-same-origin"', downloads: ' sandbox="allow-scripts allow-same-origin allow-downloads"', strict: ' sandbox="allow-scripts"' }[mode] ?? '';
      const html = `<!doctype html><title>host ${mode}</title><body style="margin:0;background:#222"><iframe id="demo" src="http://127.0.0.1:${PORT}/index.html${url.search}"${sandbox} style="width:1280px;height:720px;border:0" allow="autoplay"></iframe>`;
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end(html);
      return;
    }
    const file = join(ROOT, path === '/' ? 'index.html' : path);
    try {
      const body = await readFile(file);
      res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream', 'content-security-policy': CSP });
      res.end(body);
    } catch {
      res.writeHead(404); res.end('nf');
    }
  }).listen(PORT);
  return { server, hits };
}

export const LAUNCH = { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] };

/** Collects console errors and warnings, page errors and failed requests from a page. */
export function track(page, bag, label = '') {
  const tag = label ? `[${label}] ` : '';
  page.on('console', (m) => {
    if (m.type() === 'error') bag.errors.push(`${tag}console.error: ${m.text()}`);
    else if (m.type() === 'warning') bag.warnings.push(`${tag}console.warning: ${m.text()}`);
  });
  page.on('pageerror', (e) => bag.errors.push(`${tag}pageerror: ${e.message}`));
  page.on('requestfailed', (r) => bag.errors.push(`${tag}requestfailed: ${r.url()} ${r.failure()?.errorText ?? ''}`));
  page.on('response', (r) => { if (r.status() >= 400) bag.errors.push(`${tag}http ${r.status()}: ${r.url()}`); });
}
export const newBag = () => ({ errors: [], warnings: [] });

export async function shot(page, name) {
  for (let i = 0; i < 2; i++) {
    try {
      await page.screenshot({ path: `${SHOTS}/${name}.png`, timeout: 170000, animations: 'disabled' });
      console.log('shot', name, i ? `(attempt ${i + 1})` : '');
      return true;
    } catch (e) { console.log('shot attempt failed', name, i + 1); }
  }
  console.log('SHOT FAILED', name);
  return false;
}

export const results = [];
export function check(name, ok, detail = '') {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -- ' + detail : ''}`);
}
export function report(bag) {
  console.log('--- errors:', bag.errors.length, ' warnings:', bag.warnings.length);
  for (const e of bag.errors) console.log('  E', e.slice(0, 400));
  const seen = new Map();
  for (const w of bag.warnings) seen.set(w.slice(0, 300), (seen.get(w.slice(0, 300)) ?? 0) + 1);
  for (const [w, n] of seen) console.log(`  W x${n}`, w);
}
