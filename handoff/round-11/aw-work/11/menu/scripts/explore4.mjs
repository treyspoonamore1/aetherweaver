import { session, newPage, snap, log, wait, S } from './lib.mjs';
const dist = process.argv[2], out = process.argv[3], port = Number(process.argv[4] ?? 4620);
const run = (page, fn, arg) => page.evaluate(fn, arg);
const buttons = (page) => page.evaluate(() => [...document.querySelectorAll('button,[role=tab],a')].filter((b) => b.checkVisibility()).map((b) => (b.getAttribute('data-testid') ?? '') + '|' + (b.getAttribute('aria-label') || b.innerText).replace(/\s+/g, ' ').slice(0, 60)));
await session(dist, port, async (browser, base) => {
  const page = await newPage(browser);
  const step = async (name, fn) => { try { await fn(); } catch (e) { log('STEP FAILED', name, String(e).slice(0, 300)); await page.screenshot({ path: `${out}/FAIL-${name}.png` }).catch(() => {}); } };
  await page.goto(base + '/?e2e=1&seed=4242');
  await page.getByTestId('demo-veteran').click();
  await snap(page, out, 'title-veteran');
  await step('settings', async () => {
    await page.getByRole('button', { name: 'Settings' }).click();
    await wait(500);
    await snap(page, out, 'settings-veteran');
    console.log(await buttons(page));
    await page.getByRole('button', { name: 'Back' }).click();
  });
  await page.getByRole('button', { name: 'Enter the Loom' }).click();
  await wait(800);
  let i = 1;
  while (await page.getByTestId('station-intro').isVisible()) {
    await snap(page, out, `loomv-welcome-${i}`);
    const next = page.getByTestId('intro-next');
    if (await next.isVisible()) await next.click();
    else { await page.getByTestId('intro-later').click(); break; }
    if (++i > 8) break;
  }
  await wait(500);
  await snap(page, out, 'loom-veteran');
  console.log(await buttons(page));
  for (const st of ['The Astrolabe', 'The Atelier', 'The Reliquary', 'Bonds', 'Hall of Deeds', 'Codex']) {
    await step(st, async () => {
      await page.getByRole('button', { name: new RegExp('^' + st) }).first().click();
      await wait(1200);
      const id = st.toLowerCase().replace(/[^a-z]+/g, '-');
      let k = 1;
      while (await page.getByTestId('station-intro').isVisible()) {
        await snap(page, out, `${id}-intro-${k}`);
        const next = page.getByTestId('intro-next');
        if (await next.isVisible()) await next.click();
        else { const t = page.getByTestId('intro-try'); if (await t.isVisible()) await t.click(); else await page.getByTestId('intro-later').click(); break; }
        if (++k > 6) break;
      }
      await wait(800);
      await snap(page, out, `${id}-veteran`);
      console.log(st, await buttons(page));
      await page.keyboard.press('Escape');
      await wait(800);
      console.log('after esc', (await buttons(page)).slice(0, 4));
    });
  }
});
