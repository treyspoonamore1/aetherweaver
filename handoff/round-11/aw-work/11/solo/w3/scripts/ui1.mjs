import { session, newPage, log, W, BASE } from './lib.mjs';
const out = `${W}/raw`;
const views = process.argv.slice(2);
await session(async (browser) => {
  const page = await newPage(browser);
  for (const v of views) {
    await page.goto(`${BASE}/?lab=ui&view=${v}`);
    await page.waitForFunction(() => !document.body.innerText.includes('Loading lab') && document.body.innerText.length > 200, null, { timeout: 300000 });
    await page.waitForTimeout(v.includes("conduct") ? 7000 : 3000);
    await page.screenshot({ path: `${out}/ui-${v}.png` });
    log('shot', `${out}/ui-${v}.png`);
  }
});
