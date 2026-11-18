import { session, newPage, snap, log, wait, S } from './lib.mjs';
const dist = process.argv[2], out = process.argv[3], port = Number(process.argv[4] ?? 4620);
const run = (page, fn, arg) => page.evaluate(fn, arg);
await session(dist, port, async (browser, base) => {
  const page = await newPage(browser);
  const step = async (name, fn) => { try { await fn(); } catch (e) { log('STEP FAILED', name, String(e).slice(0, 300)); await page.screenshot({ path: `${out}/FAIL-${name}.png` }).catch(() => {}); } };
  await page.goto(base + '/?e2e=1&seed=4242');
  await page.getByTestId('demo-fresh').click();
  await page.getByRole('button', { name: 'Enter the Loom' }).click();
  await page.getByTestId('intro-later').click();
  await step('prep', async () => {
    await page.getByRole('button', { name: /^The Gate/ }).click();
    await wait(800);
    await snap(page, out, 'prep-fresh');
    console.log(await page.evaluate(() => [...document.querySelectorAll('button')].map((b) => (b.getAttribute('aria-label') || b.innerText).slice(0, 60))));
  });
  await step('map', async () => {
    await page.getByRole('button', { name: /Embark/i }).first().click();
    await wait(1200);
    await snap(page, out, 'map-fresh');
  });
  await step('combat', async () => {
    console.log('choose', await run(page, () => window.__AWRUN__.choose()));
    await wait(800);
    await snap(page, out, 'prefight-fresh');
    const begin = page.getByRole('button', { name: /Begin the fight/i });
    if (await begin.count()) await begin.click();
    await page.waitForFunction(() => window.__AW__ !== undefined);
    await wait(4000);
    await snap(page, out, 'combat-fresh');
    await page.keyboard.press('Escape');
    await wait(500);
    await snap(page, out, 'pause');
    console.log(await page.evaluate(() => [...document.querySelectorAll('button')].map((b) => (b.getAttribute('aria-label') || b.innerText).slice(0, 60))));
    await page.getByTestId('pause-controls-open').click();
    await snap(page, out, 'pause-controls');
  });
});
