import { session, newPage, openVfx, step, api, pin, unpin, crop, log, W } from './lib.mjs';
const out = `${W}/raw`;
await session(async (browser) => {
  const page = await newPage(browser);
  await openVfx(page);
  await step(page, 45);
  await api(page, () => { const V = window.__VFX__; for (const s of [0,1,2]) V.attackers(s, 2); });
  await step(page, 30);
  // Kael: coming with a call open; Lyra: coming, Thread elsewhere; Vexis: Thread on.
  await api(page, () => { const V = window.__VFX__; const st = V.state(); V.thread(2); V.stageCall(0);
    for (const s of [0,1,2]) { const e = st.entities.get(V.heroId(s)); e.hero.solo = 95; e.hero.engaged = true; } });
  await step(page, 30);
  await page.screenshot({ path: `${out}/x2-full.png`, clip: { x: 0, y: 0, width: 990, height: 720 } });
  for (const s of [0, 1, 2]) { await pin(page, s); await crop(page, s, `${out}/x2-close-${s}.png`); await unpin(page); }
});
