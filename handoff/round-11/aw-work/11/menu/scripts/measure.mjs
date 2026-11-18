import { session, newPage, wait } from './lib.mjs';
await session(process.argv[2], Number(process.argv[3]), async (browser, base) => {
  const page = await newPage(browser);
  await page.goto(base + '/?lab=ui&view=howto&nav=0&fit=0');
  await wait(1500);
  console.log(await page.evaluate(() => { const d = document.querySelector('[role=dialog]'); const box = [...d.querySelectorAll('*')].find((e) => /overflow-y-auto/.test(e.className)) ?? d; return { scroll: box.scrollHeight, client: box.clientHeight, cls: box.className.slice(0, 80), stage: document.querySelector('[data-testid=lab-stage]')?.getBoundingClientRect().height }; }));
});
