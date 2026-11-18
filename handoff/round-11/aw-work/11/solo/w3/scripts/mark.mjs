// mark.mjs [scene regex]: the Solo mark, staged in the VFX lab's real fight. Crops round each hero
// at the game camera and close (a camera 11 m from the head at the game's pitch), device scale 2.
// Writes raw/m-<scene>-<who>-<state>-<cam>.png.
import { session, newPage, openVfx, step, api, pin, unpin, crop, log, W } from './lib.mjs';
const out = `${W}/raw`;
const ONLY = process.argv[2] ? new RegExp(process.argv[2]) : null;
const want = (name) => !ONLY || ONLY.test(name);

const engage = async (page) => {
  await step(page, 45);
  await api(page, () => { const V = window.__VFX__; for (const s of [0, 1, 2]) V.attackers(s, 2); });
  await step(page, 40);
};
const setSolo = (page, slot, solo) =>
  api(page, ([s, v]) => { const V = window.__VFX__; const e = V.state().entities.get(V.heroId(s)); e.hero.solo = v; e.hero.engaged = true; e.hero.soloHeld = 0; }, [slot, solo]);
const quiet = (page, except) =>
  api(page, (x) => { const V = window.__VFX__; for (const s of [0, 1, 2]) if (s !== x) V.state().entities.get(V.heroId(s)).hero.solo = 5; }, except);
const thread = (page, slot) => api(page, (s) => window.__VFX__.thread(s), slot);
const pause = (page, on) => api(page, (p) => window.__VFX__.setPaused(p), on);
const info = (page, slot) =>
  api(page, (s) => { const V = window.__VFX__; const st = V.state(); const e = st.entities.get(V.heroId(s)); return { solo: e.hero.solo, held: e.hero.soloHeld, active: e.hero.soloActive, target: e.hero.targetId, thread: st.entities.get(st.weaverId).weaver.threadSlot, hp: e.health.hp }; }, slot);
async function both(page, slot, name) {
  await pause(page, true);
  await step(page, 2);
  await crop(page, slot, `${out}/m-${name}-game.png`, 2.6, 3.4);
  await pin(page, slot);
  await crop(page, slot, `${out}/m-${name}-close.png`, 2.6, 3.4);
  await unpin(page);
  await pause(page, false);
  log(name, JSON.stringify(await info(page, slot)));
}

/** The four states on one hero: charging, coming, now, Thread on (and, for `fire`, the Solo). */
async function states(page, slot, who, fire = false) {
  const other = (slot + 1) % 3;
  await quiet(page, slot);
  await thread(page, other);
  await setSolo(page, slot, 60);
  await step(page, 20);
  await both(page, slot, `${who}-1charging`);
  await setSolo(page, slot, 93);
  await step(page, 8);
  await both(page, slot, `${who}-2coming`);
  await setSolo(page, slot, 100);
  await step(page, 9);
  await both(page, slot, `${who}-3now`);
  await setSolo(page, slot, 93.5);
  await thread(page, slot);
  await step(page, 40);
  await both(page, slot, `${who}-4cued`);
  if (fire) {
    await api(page, (sl) => window.__VFX__.attackers(sl, 3), slot);
    await step(page, 40);
    await setSolo(page, slot, 100);
    for (let i = 0; i < 60; i++) {
      await step(page, 2);
      if ((await info(page, slot)).active > 0) break;
    }
    await step(page, 18);
    await both(page, slot, `${who}-5fired`);
  }
}

await session(async (browser) => {
  const page = await newPage(browser);
  if (want('default')) {
    for (const [slot, who, fire] of [[1, 'lyra', true], [0, 'kael', false], [2, 'vexis', false]]) {
      await openVfx(page);
      await engage(page);
      await states(page, slot, who, fire);
    }
  }
  if (want('brann')) {
    await openVfx(page);
    await api(page, () => window.__VFX__.bondScenario('Brann · Blood Rage'));
    await step(page, 10);
    // Heal him: the mark is the subject, not his rage.
    await api(page, () => { const V = window.__VFX__; for (const s of [0, 1, 2]) { const e = V.state().entities.get(V.heroId(s)); e.health.hp = e.health.maxHp; } });
    await engage(page);
    log('party', JSON.stringify(await api(page, () => { const V = window.__VFX__; return [0, 1, 2].map((s) => V.state().entities.get(V.heroId(s)).hero.defId); })));
    await states(page, 1, 'brann');
  }
  if (want('marks')) {
    // Beside the other marks over heads: a call's bubble, a Fermata hold, bleed pips and a Wound.
    const status = (slot, s) => api(page, ([sl, st]) => { const V = window.__VFX__; V.state().entities.get(V.heroId(sl)).health.statuses.push({ remaining: 8, duration: 8, stacks: 1, source: null, ...st }); }, [slot, s]);
    for (const [name, slot, threadOn, prep] of [
      ['call-now', 1, false, async () => api(page, () => window.__VFX__.queue({ t: 'debug', op: { op: 'forceCall', slot: 1 } }))],
      ['call-cued', 1, true, async () => api(page, () => window.__VFX__.queue({ t: 'debug', op: { op: 'forceCall', slot: 1 } }))],
      ['bleed-now', 1, false, async () => { await status(1, { id: 'bleed', stacks: 6, dps: 0.01, tickIn: 0.5 }); await status(1, { id: 'wound' }); }],
      ['bleed-cued', 1, true, async () => { await status(1, { id: 'bleed', stacks: 6, dps: 0.01, tickIn: 0.5 }); await status(1, { id: 'wound' }); }],
      ['hold-now', 1, false, async () => api(page, () => window.__VFX__.stageHold(1))],
    ]) {
      await openVfx(page);
      await engage(page);
      await quiet(page, slot);
      await thread(page, threadOn ? slot : 2);
      await step(page, 20);
      const late = name.startsWith('call');
      if (!late) await prep();
      await setSolo(page, slot, threadOn ? 93.5 : 100);
      await step(page, threadOn ? 30 : 3);
      if (late) await prep();
      await step(page, threadOn ? 10 : 6);
      log(name, JSON.stringify(await api(page, () => { const V = window.__VFX__; return V.state().entities.get(V.heroId(1)).hero.call; })));
      await both(page, slot, `marks-${name}`);
    }
  }
  if (want('vision')) {
    // The colour-vision palettes: a plain mark and a Cued one side by side, an enemy in view.
    for (const vision of ['normal', 'protanopia', 'deuteranopia', 'tritanopia']) {
      await openVfx(page);
      await api(page, (v) => window.__VFX__.setSettings({ colorVision: v }), vision);
      await engage(page);
      await api(page, () => { const V = window.__VFX__; V.state().entities.get(V.heroId(0)).hero.solo = 5; });
      await thread(page, 2);
      await setSolo(page, 2, 93);
      await step(page, 30);
      await setSolo(page, 1, 100);
      await step(page, 10);
      await pause(page, true);
      await step(page, 2);
      await page.screenshot({ path: `${out}/m-vision-${vision}.png`, clip: { x: 0, y: 0, width: 990, height: 720 } });
      log('vision', vision, JSON.stringify(await info(page, 1)), JSON.stringify(await info(page, 2)));
      await pause(page, false);
    }
  }
});
