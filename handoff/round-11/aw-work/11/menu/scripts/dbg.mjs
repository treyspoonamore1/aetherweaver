import { session, newPage, snap, log, wait, S } from './lib.mjs';
const out = '/home/user/aw-work/11/menu/explore';
await session('/home/user/aw-work/11/menu/dist-before', 4620, async (browser, base) => {
  const page = await newPage(browser);
  await page.goto(base + '/?e2e=1&seed=4242');
  await page.getByTestId('demo-fresh').click();
  await page.getByRole('button', { name: 'Enter the Loom' }).click();
  await page.getByTestId('intro-later').click();
  await page.getByRole('button', { name: /^The Gate/ }).click();
  await page.getByRole('button', { name: /Embark/i }).first().click();
  await wait(800);
  await page.evaluate(() => window.__AWRUN__.choose());
  for (let i = 0; i < 6; i++) {
    await wait(700);
    console.log(i, await page.evaluate(() => ({ ls: Object.keys(localStorage), howto: localStorage.getItem('aetherweaver.howto.v1'), dialogs: [...document.querySelectorAll('[role=dialog]')].map((d) => d.innerText.slice(0, 40)), phase: window.__AWRUN__.phase(), tick: window.__AW__?.tick() })));
  }
  await snap(page, out, 'dbg');
});
