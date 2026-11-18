// p1.mjs <dist> <outdir> <tag> [scene regex] [cams]: the marks over a hero that are not aura,
// ornament or Calling drawing, staged in the VFX lab's real fight (the same staging, frames and
// camera in every build), at the game camera and close, cropped round the figure.
// Writes p1-<scene>-<who>-<cam>-<tag>.png (device scale 2) and p1-<tag>.json.
import { mkdirSync, writeFileSync } from 'node:fs';
import { session, newPage, log, step, BASE } from './lib.mjs';
const [dist, out, tag, only, camsArg] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const ONLY = only && only !== '-' ? new RegExp(only) : null;
const CAMS = camsArg ? camsArg.split(',') : ['game', 'close'];
const api = (p, fn, arg) => p.evaluate(fn, arg);
const notes = {};

async function open(page) {
  await page.goto(`${BASE}/?lab=vfx`);
  await page.waitForFunction(() => window.__VFX__ !== undefined, null, { timeout: 300_000 });
  await api(page, () => window.__VFX__.manual(2, 33, true));
  const [mx, my] = (process.env.AW_MOUSE ?? '1275,715').split(',').map(Number);
  await page.mouse.move(mx, my);
}
// 'close' is a pinned close-up on the figure (the game's pitch, 11 m away, looking at its head):
// set in crop(). 'maxzoom' is the player's own closest zoom, following the Weaver.
const zoom = (page, cam) => (cam === 'maxzoom' ? api(page, () => window.__VFX__.zoom(-5000)) : null);
const pin = (page, who) =>
  api(page, (w) => {
    const V = window.__VFX__;
    const st = V.state();
    const e = st.entities.get(w === 'weaver' ? st.weaverId : V.heroId(w));
    const d = 11, pitch = (52 * Math.PI) / 180;
    V.pinCamera({ eye: [e.x, 2 + d * Math.sin(pitch), e.z + d * Math.cos(pitch)], at: [e.x, 2, e.z] });
    V.manual(2, 16, true);
  }, who);
const unpin = (page) => api(page, () => window.__VFX__.pinCamera(null));
const pause = (page) => api(page, () => window.__VFX__.setPaused(true));
/** `who`: a party slot, or 'weaver'. */
const around = (page, who) =>
  api(page, (w) => {
    const V = window.__VFX__;
    const st = V.state();
    const e = st.entities.get(w === 'weaver' ? st.weaverId : V.heroId(w));
    const c = document.querySelector('canvas').getBoundingClientRect();
    return { a: V.screenOf(e.x, 0, e.z), b: V.screenOf(e.x, 2.0, e.z), canvas: { x: c.left, y: c.top, w: c.width, h: c.height }, x: e.x, z: e.z, height: e.height, time: st.time };
  }, who);
/** A crop `wide` reference heights (2 m) wide and `tall` high, the feet a little above its bottom edge. */
async function crop(page, scene, who, name, cam, wide = 2.6, tall = 3.0) {
  if (cam === 'close') await pin(page, who);
  const at = await around(page, who);
  const h = at.a.y - at.b.y;
  const w = h * wide;
  let x = at.a.x - w / 2;
  let y = at.a.y + h * 0.3 - h * tall;
  x = Math.max(at.canvas.x, Math.min(at.canvas.x + 1280 - w, x));
  const cut = y < at.canvas.y;
  y = Math.max(at.canvas.y, y);
  const clip = { x, y, width: w, height: Math.min(at.a.y + h * 0.3, at.canvas.y + 720) - y };
  const file = `${out}/p1-${scene}-${name}-${cam}-${tag}.png`;
  await page.screenshot({ path: file, clip, timeout: 300_000 });
  notes[`${scene}-${name}-${cam}`] = { ...at, clip, cutAtTop: cut };
  log('p1', file, cut ? '(crop meets the top of the view)' : '');
  if (cam === 'close') await unpin(page);
}
const status = (page, slot, s) =>
  api(page, ([sl, st]) => {
    const V = window.__VFX__;
    const h = V.state().entities.get(V.heroId(sl)).health;
    h.statuses.push({ remaining: 8, duration: 8, stacks: 1, source: null, ...st });
  }, [slot, s]);
const NAMES = ['kael', 'lyra', 'vexis'];
const tickNow = (page) => api(page, () => window.__VFX__.state().tick ?? Math.round(window.__VFX__.state().time * 60));

const SCENES = {
  // Stun stars round the head.
  stun: async (page, cam) => {
    await open(page); await zoom(page, cam);
    await step(page, 45);
    for (const s of [0, 1]) await status(page, s, { id: 'stun', remaining: 6, duration: 6 });
    await step(page, 12);
    await pause(page); await step(page, 2);
    for (const s of [0, 1]) await crop(page, 'stun', s, NAMES[s], cam, 2.6, 2.6);
  },
  // Bleed pips, Wound's heart and the status's answer badge.
  bleed: async (page, cam) => {
    await open(page); await zoom(page, cam);
    await step(page, 45);
    for (const s of [0, 1]) {
      await status(page, s, { id: 'bleed', stacks: 6, dps: 0.01, tickIn: 0.5 });
      await status(page, s, { id: 'wound' });
    }
    await step(page, 12);
    await pause(page); await step(page, 2);
    for (const s of [0, 1]) await crop(page, 'bleed', s, NAMES[s], cam, 2.6, 3.4);
  },
  // With a mark already raised: the Thread's mode glyph over a bleeding, Wounded hero.
  combo: async (page, cam) => {
    for (const s of [0, 1]) {
      await open(page); await zoom(page, cam);
      await api(page, () => window.__VFX__.setLoadout('Field song only'));
      await step(page, 45);
      await api(page, (sl) => window.__VFX__.thread(sl), s);
      await step(page, 60);
      await status(page, s, { id: 'bleed', stacks: 6, dps: 0.01, tickIn: 0.5 });
      await status(page, s, { id: 'wound' });
      await step(page, 12);
      await pause(page); await step(page, 2);
      await crop(page, 'combo', s, NAMES[s], cam, 2.6, 3.4);
    }
  },
  // PERFECT over a Perfect Ward.
  perfect: async (page, cam) => {
    for (const s of [0, 1]) {
      await open(page); await zoom(page, cam);
      await step(page, 45);
      await api(page, (sl) => { const V = window.__VFX__; V.inject([{ type: 'perfectWard', tick: 0, target: V.heroId(sl), telegraph: null, negated: 520 }]); }, s);
      await step(page, 14);
      await pause(page); await step(page, 2);
      await crop(page, 'perfect', s, NAMES[s], cam, 5.2, 3.0);
    }
  },
  // SAVED over a Save.
  saved: async (page, cam) => {
    for (const s of [0, 1]) {
      await open(page); await zoom(page, cam);
      await step(page, 45);
      await api(page, (sl) => window.__VFX__.save(sl), s);
      await step(page, 16);
      await pause(page); await step(page, 2);
      await crop(page, 'saved', s, NAMES[s], cam, 5.2, 3.2);
    }
  },
  // A damage number and a heal number starting from the head.
  numbers: async (page, cam) => {
    for (const s of [0, 1]) {
      await open(page); await zoom(page, cam);
      await step(page, 45);
      await api(page, (sl) => {
        const V = window.__VFX__; const id = V.heroId(sl); const st = V.state();
        V.inject([{ type: 'healApplied', tick: 0, target: id, source: st.weaverId, amount: 120, overheal: 0, via: 'mend' }]);
      }, s);
      await step(page, 14);
      await api(page, (sl) => {
        const V = window.__VFX__; const id = V.heroId(sl);
        V.inject([{ type: 'damageTaken', tick: 0, target: id, source: null, amount: 86, absorbed: 0, amplified: 0, aura: 0, radiance: 0, eclipse: 0, crit: false, telegraph: null, hit: 'hit' }]);
      }, s);
      await step(page, 3);
      await pause(page); await step(page, 2);
      await crop(page, 'numbers', s, NAMES[s], cam, 2.6, 2.6);
    }
  },
  // Bond marks: Kael's Oathkeeper (a diamond in a ring over him), Lyra's Hawk's Vigil (her timer).
  oath: async (page, cam) => {
    await open(page);
    await api(page, () => window.__VFX__.bondScenario('Oathkeeper · cued'));
    await step(page, 6); await zoom(page, cam);
    await step(page, 60);
    await pause(page); await step(page, 2);
    notes[`oath-stats-${cam}`] = await api(page, () => window.__VFX__.bondStats().drawn);
    await crop(page, 'bond', 0, 'kael', cam, 2.6, 2.6);
  },
  vigil: async (page, cam) => {
    await open(page);
    await api(page, () => window.__VFX__.bondScenario('Hawk’s Vigil · cued'));
    await step(page, 6); await zoom(page, cam);
    await step(page, 120);
    await pause(page); await step(page, 2);
    notes[`vigil-stats-${cam}`] = await api(page, () => window.__VFX__.bondStats().drawn);
    await crop(page, 'bond', 1, 'lyra', cam, 2.6, 2.6);
  },
  // Relic marks: the Glass Halo over the warded hero; the Cracked Metronome over the Weaver.
  halo: async (page, cam) => {
    for (const s of [0, 1]) {
      await open(page); await zoom(page, cam);
      await step(page, 45);
      await api(page, (sl) => { const V = window.__VFX__; V.inject([{ type: 'relicTriggered', tick: 0, relic: 'glass_halo', hero: V.heroId(sl) }]); }, s);
      await step(page, 11);
      await pause(page); await step(page, 2);
      notes[`halo-fired-${cam}-${s}`] = await api(page, () => window.__VFX__.relicStats().fired);
      await crop(page, 'relic', s, NAMES[s], cam, 2.6, 2.6);
    }
  },
  metronome: async (page, cam) => {
    await open(page);
    await api(page, () => window.__VFX__.setRelics(['cracked_metronome']));
    await step(page, 6); await zoom(page, cam);
    await step(page, 60);
    await pause(page); await step(page, 2);
    await crop(page, 'relic', 'weaver', 'weaver', cam, 2.2, 2.2);
  },
  // Seren: crossed blades over her (en garde) and the parry glyph on a blow at her.
  seren: async (page, cam) => {
    await open(page);
    await api(page, () => window.__VFX__.bondScenario('Seren · en garde and the parry'));
    await step(page, 6); await zoom(page, cam);
    const drawn = (key) => api(page, (k) => window.__VFX__.rosterStats()[k] ?? 0, key);
    let got = false;
    for (let i = 0; i < 150 && !got; i++) { await step(page, 2); got = (await drawn('drawn.enGarde')) > 0; }
    await step(page, 4);
    notes[`seren-guard-${cam}`] = await api(page, () => ({ time: window.__VFX__.state().time, g: window.__VFX__.rosterStats()['drawn.enGarde'], p: window.__VFX__.rosterStats()['drawn.parryGlyphs'] }));
    await crop(page, 'seren', 1, 'seren', cam, 2.6, 2.6);
  },
  // Seren en garde while she is the Thread's hero: the blades with the mode glyph.
  serent: async (page, cam) => {
    await open(page);
    await api(page, () => window.__VFX__.bondScenario('Seren · en garde and the parry'));
    await step(page, 6); await zoom(page, cam);
    await api(page, () => window.__VFX__.thread(1));
    const drawn = (key) => api(page, (k) => window.__VFX__.rosterStats()[k] ?? 0, key);
    let got = false;
    for (let i = 0; i < 150 && !got; i++) { await step(page, 2); got = (await drawn('drawn.enGarde')) > 0; }
    await step(page, 14);
    await crop(page, 'serent', 1, 'seren', cam, 2.6, 2.6);
  },
  // Oro: the tending drop over him.
  oro: async (page, cam) => {
    await open(page);
    await api(page, () => window.__VFX__.bondScenario('Oro · Saplings in and out of your field'));
    await step(page, 6); await zoom(page, cam);
    await step(page, 75);
    await pause(page); await step(page, 2);
    notes[`oro-stats-${cam}`] = await api(page, () => ({ r: window.__VFX__.rosterStats(), time: window.__VFX__.state().time }));
    await crop(page, 'oro', 2, 'oro', cam, 2.6, 2.6);
    await api(page, () => window.__VFX__.setPaused(false));
    await api(page, () => window.__VFX__.thread(2));
    await step(page, 50);
    await crop(page, 'orot', 2, 'oro', cam, 2.6, 2.6);
  },
};

await session(dist, async (browser) => {
  const page = await newPage(browser, { width: 1570, height: 720 });
  for (const [name, run] of Object.entries(SCENES)) {
    if (ONLY && !ONLY.test(name)) continue;
    for (const cam of CAMS) {
      try {
        await run(page, cam);
      } catch (err) {
        log('p1 failed', name, cam, String(err).slice(0, 300));
      }
    }
  }
  writeFileSync(`${out}/p1-${tag}${ONLY ? '-' + only.replace(/\W/g, '') : ''}.json`, JSON.stringify(notes, null, 1));
});
