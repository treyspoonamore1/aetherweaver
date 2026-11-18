import { session, newPage, snap, log, wait, S } from './lib.mjs';
const dist = process.argv[2], out = process.argv[3], port = Number(process.argv[4] ?? 4620);
await session(dist, port, async (browser, base) => {
  const page = await newPage(browser);
  await page.goto(base + '/?e2e=1&seed=4242');
  await page.getByTestId('demo-choice').waitFor();
  await snap(page, out, 'title-choice');
  await page.getByTestId('demo-fresh').click();
  await page.getByTestId('front-door').waitFor();
  await snap(page, out, 'title-fresh');
  await page.getByRole('button', { name: 'Enter the Loom' }).click();
  await page.getByTestId('loom-screen').waitFor();
  let i = 1;
  while (await page.getByTestId('station-intro').isVisible()) {
    await snap(page, out, `loom-welcome-${i}`);
    const next = page.getByTestId('intro-next');
    if (await next.isVisible()) await next.click();
    else { await page.getByTestId('intro-later').click(); break; }
    if (++i > 8) break;
  }
  await wait(500);
  await snap(page, out, 'loom-fresh');
  console.log(await page.evaluate(() => [...document.querySelectorAll('button')].map((b) => (b.getAttribute('aria-label') || b.innerText).slice(0, 80))));
});
