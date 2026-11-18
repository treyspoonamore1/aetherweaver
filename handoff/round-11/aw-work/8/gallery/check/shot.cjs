const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const G = process.argv[2];
  const body = fs.readFileSync(G + '/index.html', 'utf8');
  fs.writeFileSync(G + '/_preview.html', '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>body{margin:0;font:14px system-ui}img{max-width:100%}</style></head><body>' + body + '</body></html>');
  const b = await chromium.launch();
  for (const [name, w, h, scheme] of [['desk', 1280, 900, 'dark'], ['phone', 400, 800, 'light']]) {
    const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1, colorScheme: scheme });
    const errs = []; p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); }); p.on('pageerror', e => errs.push(String(e)));
    await p.goto('file://' + G + '/_preview.html'); await p.waitForTimeout(1500);
    await p.evaluate(async () => { for (const i of document.images) { i.loading = 'eager'; } await new Promise(r => setTimeout(r, 1500)); });
    const ov = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, h: document.documentElement.scrollHeight, broken: [...document.images].filter(i => i.complete && !i.naturalWidth).map(i => i.src) }));
    console.log(name, JSON.stringify(ov), errs.slice(0, 5));
    await p.screenshot({ path: process.argv[3] + '/' + name + '.png', fullPage: true });
    await p.close();
  }
  await b.close();
})();
