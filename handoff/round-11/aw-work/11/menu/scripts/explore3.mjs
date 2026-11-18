import { session, newPage, snap, log, wait, S } from './lib.mjs';
const dist = process.argv[2], out = process.argv[3], port = Number(process.argv[4] ?? 4620);
const run = (page, fn, arg) => page.evaluate(fn, arg);
const buttons = (page) => page.evaluate(() => [...document.querySelectorAll('button')].filter((b) => b.checkVisibility()).map((b) => (b.getAttribute('aria-label') || b.innerText).replace(/\s+/g, ' ').slice(0, 70)));
await session(dist, port, async (browser, base) => {
  const page = await newPage(browser);
  const step = async (name, fn) => { try { await fn(); } catch (e) { log('STEP FAILED', name, String(e).slice(0, 300)); await page.screenshot({ path: `${out}/FAIL-${name}.png` }).catch(() => {}); } };
  await page.goto(base + '/?e2e=1&seed=4242');
  await page.getByTestId('demo-fresh').click();
  await page.getByRole('button', { name: 'Enter the Loom' }).click();
  await page.getByTestId('intro-later').click();
  await page.getByRole('button', { name: /^The Gate/ }).click();
  await page.getByRole('button', { name: /Embark/i }).first().click();
  await wait(800);
  // hover a node
  await step('map-hover', async () => {
    const n = page.locator('[data-testid="node-rewards"]').first();
    await page.mouse.move(180, 410);
    await wait(600);
    await snap(page, out, 'map-fresh-hover');
    console.log(await buttons(page));
  });
  await step('combat', async () => {
    await page.mouse.click(180, 410);
    await wait(1500);
    await snap(page, out, 'prefight-fresh');
    console.log(await buttons(page));
    const begin = page.getByRole('button', { name: /Begin the fight/i });
    if (await begin.count()) await begin.click();
    await page.waitForFunction(() => window.__AW__ !== undefined);
    await wait(2500);
    console.log('dialogs', await page.evaluate(() => document.querySelectorAll('[role=dialog]').length), 'tick', await run(page, () => window.__AW__.tick()));
    await snap(page, out, 'howto-fresh');
    console.log(await buttons(page));
  });
  await step('result', async () => {
    const b = page.getByRole('button', { name: /Begin the fight/i });
    if (await b.count()) await b.click();
    await wait(3000);
    await snap(page, out, 'combat-hints');
    console.log('win', await run(page, () => window.__AWRUN__.winFight()));
    await wait(2500);
    await snap(page, out, 'result-fresh');
    console.log(await buttons(page));
    await run(page, () => window.__AWRUN__.continue());
    await wait(1500);
    console.log('phase', await run(page, () => window.__AWRUN__.phase()));
    await snap(page, out, 'draft-fresh');
    console.log(await buttons(page));
  });
  for (const kind of ['respite', 'merchant', 'forge', 'event', 'shrine', 'elite']) {
    await step(kind, async () => {
      const ph = await run(page, () => window.__AWRUN__.phase());
      if (ph === 'draft') await run(page, () => window.__AWRUN__.pick(0));
      console.log(kind, 'warp ->', await run(page, (k) => window.__AWRUN__.warp(k, 200), kind));
      await wait(1500);
      await snap(page, out, `${kind}-fresh`);
      console.log(await buttons(page));
    });
  }
});
