import { session, newPage, openVfx, step, api, pin, unpin, crop, log, W } from './lib.mjs';
const out = `${W}/raw`;
await session(async (browser) => {
  const page = await newPage(browser);
  await openVfx(page);
  await step(page, 45);
  await api(page, () => { const V = window.__VFX__; for (const s of [0,1,2]) V.attackers(s, 2); });
  await step(page, 30);
  const info = await api(page, () => {
    const V = window.__VFX__; const st = V.state();
    return [0,1,2].map((s) => { const e = st.entities.get(V.heroId(s)); return { solo: e.hero.solo, engaged: e.hero.engaged, target: e.hero.targetId, id: e.hero.defId }; });
  });
  log(JSON.stringify(info));
  // Kael: coming, Thread elsewhere (on Vexis). Lyra: coming, Thread on her.
  await api(page, () => { const V = window.__VFX__; const st = V.state(); V.thread(1);
    for (const s of [0,1]) { const e = st.entities.get(V.heroId(s)); e.hero.solo = 96; e.hero.engaged = true; } });
  await step(page, 20);
  await page.screenshot({ path: `${out}/x1-full.png` });
  for (const s of [0, 1]) { await pin(page, s); await crop(page, s, `${out}/x1-close-${s}.png`); await unpin(page); }
  const info2 = await api(page, () => {
    const V = window.__VFX__; const st = V.state();
    return [0,1,2].map((s) => { const e = st.entities.get(V.heroId(s)); return { solo: e.hero.solo, held: e.hero.soloHeld, active: e.hero.soloActive, target: e.hero.targetId }; });
  });
  log(JSON.stringify(info2));
});
