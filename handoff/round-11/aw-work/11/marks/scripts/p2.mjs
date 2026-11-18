// p2.mjs <dist> <outdir> <tag> [scene regex] [cams]: the aura, ornament and Calling marks over a
// hero or the Weaver, staged in the VFX lab's real fight (the same staging, frames and camera in
// every build), at the game camera and close, cropped round the figure.
// Writes p2-<scene>-<who>-<cam>-<tag>.png (device scale 2) and p2-<tag>.json.
import { mkdirSync, writeFileSync } from 'node:fs';
import { session, newPage, log, step, BASE } from './lib.mjs';
const [dist, out, tag, only, camsArg] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const ONLY = only && only !== '-' ? new RegExp(only) : null;
const CAMS = camsArg ? camsArg.split(',') : ['game', 'close'];
const api = (p, fn, arg) => p.evaluate(fn, arg);
const notes = {};
const NAMES = ['kael', 'lyra', 'vexis'];

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
const around = (page, who) =>
  api(page, (w) => {
    const V = window.__VFX__;
    const st = V.state();
    const e = st.entities.get(w === 'weaver' ? st.weaverId : V.heroId(w));
    const c = document.querySelector('canvas').getBoundingClientRect();
    return { a: V.screenOf(e.x, 0, e.z), b: V.screenOf(e.x, 2.0, e.z), canvas: { x: c.left, y: c.top, w: c.width, h: c.height }, x: e.x, z: e.z, height: e.height, time: st.time };
  }, who);
async function crop(page, scene, who, cam, wide = 2.6, tall = 3.0) {
  const name = who === 'weaver' ? 'weaver' : NAMES[who];
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
  const file = `${out}/p2-${scene}-${name}-${cam}-${tag}.png`;
  await page.screenshot({ path: file, clip, timeout: 300_000 });
  notes[`${scene}-${name}-${cam}`] = { ...at, clip, cutAtTop: cut };
  log('p2', file, cut ? '(crop meets the top of the view)' : '');
  if (cam === 'close') await unpin(page);
}
/** Steps two frames at a time until `fn` (run in the page) is truthy, at most `max` times. */
async function until(page, fn, max = 200) {
  for (let i = 0; i < max; i++) {
    await step(page, 2);
    if (await api(page, fn)) return true;
  }
  return false;
}
const still = async (page) => { await pause(page); await step(page, 2); };

const SCENES = {
  // P1: the pour's label over the hero the Thread moved to (the Guardian loadout's beam song).
  pour: async (page, cam) => {
    for (const [from, to] of [[1, 0], [0, 1]]) {
      await open(page);
      await api(page, () => window.__VFX__.setLoadout('Guardian'));
      await step(page, 45); await zoom(page, cam);
      await api(page, (s) => window.__VFX__.thread(s), from);
      await step(page, 90);
      await api(page, (s) => window.__VFX__.thread(s), to);
      const base = await api(page, () => window.__VFX__.debug().pours ?? -1);
      notes[`pour-debug-${cam}-${to}`] = await api(page, () => window.__VFX__.debug());
      // The label appears as the pour arrives: when a callout holding the song's glyph is shown.
      const ok = await until(page, () => [...document.querySelectorAll('div')].some((d) => d.children.length === 0 && /^♪/.test(d.textContent ?? '') && d.getBoundingClientRect().width > 0 && getComputedStyle(d).opacity !== '0'), 60);
      notes[`pour-found-${cam}-${to}`] = { ok, base };
      await step(page, 6);
      await still(page);
      await crop(page, 'pour', to, cam, 2.8, 3.0);
    }
  },
  // P2: the Luminary. The Radiance shaft on a hero in the light.
  radiance: async (page, cam) => {
    await open(page);
    await api(page, () => window.__VFX__.setTheme('rift_mouth'));
    await step(page, 6);
    await api(page, () => window.__VFX__.lumScenario('Radiance'));
    await step(page, 6); await zoom(page, cam);
    await step(page, 90);
    await still(page);
    for (const s of [0, 1]) await crop(page, 'radiance', s, cam, 2.6, 3.4);
  },
  // The Dawn callout over a hero walking back into the field.
  dawn: async (page, cam) => {
    await open(page);
    await api(page, () => window.__VFX__.lumScenario('Dawnward'));
    await step(page, 6); await zoom(page, cam);
    let shot = 0;
    for (let i = 0; i < 200 && shot < 3; i++) {
      await step(page, 2);
      const fired = await api(page, () => window.__VFX__.callingStats().fired);
      const n = fired.dawn ?? fired.dawns ?? fired.dawnward ?? 0;
      notes[`dawn-stats-${cam}`] = fired;
      if (n > shot) {
        // A hero just got theirs: every hero is shot, and the sheet takes the one with the callout.
        shot = n;
        await step(page, 4);
        for (const s of [0, 1, 2]) await crop(page, `dawn${n}`, s, cam, cam === 'close' ? 4.6 : 2.8, 3.0);
      }
    }
  },
  // The Sovereign circlet over the Weaver.
  circlet: async (page, cam) => {
    await open(page);
    await api(page, () => window.__VFX__.lumScenario('Sovereign Symphony'));
    await step(page, 6); await zoom(page, cam);
    await step(page, 90);
    await still(page);
    await crop(page, 'circlet', 'weaver', cam, 2.6, 2.4);
  },
  // P3: the Martyr. The Vow's seals over the heroes (and its tethers at the chest).
  vow: async (page, cam) => {
    await open(page);
    await api(page, () => window.__VFX__.martyrScenario('Vow · quiet'));
    await step(page, 6); await zoom(page, cam);
    await until(page, () => window.__VFX__.martyrStats().vow, 120);
    await step(page, 50);
    await still(page);
    notes[`vow-stats-${cam}`] = await api(page, () => window.__VFX__.martyrStats().drawn);
    for (const s of [0, 1]) await crop(page, 'vow', s, cam, 2.6, 2.8);
  },
  // The ember over the Weaver while Undying Devotion is unused.
  ember: async (page, cam) => {
    await open(page);
    await api(page, () => window.__VFX__.setMartyr(['penitence', 'blood_font', 'undying_devotion']));
    await step(page, 6); await zoom(page, cam);
    await step(page, 60);
    await still(page);
    notes[`ember-stats-${cam}`] = await api(page, () => window.__VFX__.martyrStats().look);
    await crop(page, 'ember', 'weaver', cam, 2.6, 2.4);
  },
  // P4: the Chronomancer. The mastery clock over the Weaver on the Glide; the Stasis clock over her.
  mastery: async (page, cam) => {
    await open(page);
    await api(page, () => window.__VFX__.chronoScenario('Temporal Mastery'));
    await step(page, 6); await zoom(page, cam);
    const ok = await until(page, () => (window.__VFX__.chronoStats().fired.mastery ?? 0) > 0, 120);
    notes[`mastery-${cam}`] = { ok, fired: await api(page, () => window.__VFX__.chronoStats().fired) };
    await step(page, 8);
    await still(page);
    await crop(page, 'mastery', 'weaver', cam, 2.8, 2.6);
  },
  stasis: async (page, cam) => {
    await open(page);
    await api(page, () => window.__VFX__.chronoScenario('Stasis · quiet'));
    await step(page, 6); await zoom(page, cam);
    const ok = await until(page, () => window.__VFX__.chronoStats().stasis, 120);
    notes[`stasis-${cam}`] = { ok };
    await step(page, 8);
    await still(page);
    await crop(page, 'stasis', 'weaver', cam, 3.0, 3.2);
  },
  // P5: the Conductor. The chain sigil over a Cued hero; Marcato's mark; the Spotlight's cone.
  sigil: async (page, cam) => {
    await open(page);
    await api(page, () => window.__VFX__.conductScenario('Duet'));
    await step(page, 6); await zoom(page, cam);
    await until(page, () => window.__VFX__.conductStats().chain.length >= 2, 150);
    await step(page, 10);
    await still(page);
    notes[`sigil-stats-${cam}`] = await api(page, () => window.__VFX__.conductStats().drawn);
    for (const s of [0, 1]) await crop(page, 'sigil', s, cam, 2.6, 3.0);
  },
  marcato: async (page, cam) => {
    await open(page);
    await api(page, () => window.__VFX__.conductScenario('Marcato'));
    await step(page, 6); await zoom(page, cam);
    await until(page, () => (window.__VFX__.conductStats().drawn.marks ?? 0) > 0, 80);
    await step(page, 20);
    await still(page);
    notes[`marcato-stats-${cam}`] = await api(page, () => window.__VFX__.conductStats().drawn);
    for (const s of [0, 1]) await crop(page, 'marcato', s, cam, 2.6, 2.6);
  },
  spotlight: async (page, cam) => {
    await open(page);
    await api(page, () => window.__VFX__.conductScenario('Spotlight'));
    await step(page, 6); await zoom(page, cam);
    await until(page, () => (window.__VFX__.conductStats().drawn.cones ?? 0) > 0, 80);
    await step(page, 14);
    await still(page);
    notes[`spotlight-stats-${cam}`] = await api(page, () => window.__VFX__.conductStats().drawn);
    await crop(page, 'spotlight', 1, cam, 2.8, 3.6);
  },
  // P6: the target mark over a marked hero (a Lamenter's Dirge), and Foresight's outline of it.
  mark: async (page, cam) => {
    await open(page);
    await api(page, () => window.__VFX__.chronoScenario('Foresight'));
    await step(page, 6); await zoom(page, cam);
    const who = async () => api(page, () => {
      const V = window.__VFX__; const st = V.state();
      const t = st.telegraphs.find((k) => k.shape && k.shape.kind === 'mark');
      return t ? st.party.indexOf(t.shape.target) : -1;
    });
    const seen = async () => api(page, () => {
      const V = window.__VFX__; const st = V.state();
      for (const e of st.entities.list()) { const f = e.enemy?.foreseen; if (f && e.enemy.defId === 'lamenter') return true; }
      return false;
    });
    // First the foreseen outline (a second early), then the mark itself.
    const look = () => api(page, () => {
      const V = window.__VFX__; const st = V.state();
      const t = st.telegraphs.find((k) => k.shape && k.shape.kind === 'mark');
      let fore = -1;
      for (const e of st.entities.list()) {
        const f = e.enemy?.foreseen;
        if (f && e.enemy.defId === 'lamenter') fore = f.target === undefined || f.target === null ? 9 : st.party.indexOf(f.target);
      }
      return { mark: t ? st.party.indexOf(t.shape.target) : -1, fore, time: st.time };
    });
    // This staging's mark (a Lamenter's Dirge) starts on a hero at about 5.9 s; Foresight draws its
    // outline over that hero for the second before. Every hero is shot at 5.4 s, then the marked one.
    let fore = false;
    for (let i = 0; i < 170; i++) {
      await step(page, 3);
      const k = await look();
      if (!fore && k.time >= 5.4) {
        fore = true;
        notes[`mark-foreseen-${cam}`] = { ...k, d: await api(page, () => window.__VFX__.chronoStats().drawn) };
        for (const s of [0, 1, 2]) await crop(page, 'foreseen', s, cam, 2.8, 3.4);
      }
      if (k.mark >= 0) {
        await step(page, 14);
        notes[`mark-on-${cam}`] = k;
        await still(page);
        await crop(page, 'mark', k.mark, cam, 2.8, 3.4);
        break;
      }
    }
  },
  // P7: the chest anchors. Fermata's shell; the song's glow on the Thread's hero; the Vow's
  // tethers (the vow scene above); a call's answer beam.
  shell: async (page, cam) => {
    for (const s of [0, 1]) {
      await open(page); await zoom(page, cam);
      await step(page, 45);
      await api(page, (sl) => window.__VFX__.stageHold(sl), s);
      await step(page, 20);
      await still(page);
      await crop(page, 'shell', s, cam, 2.6, 2.8);
    }
  },
  glow: async (page, cam) => {
    for (const s of [0, 1]) {
      await open(page);
      await api(page, () => window.__VFX__.setLoadout('Guardian'));
      await step(page, 45); await zoom(page, cam);
      await api(page, (sl) => window.__VFX__.thread(sl), s);
      await step(page, 90);
      await still(page);
      await crop(page, 'glow', s, cam, 2.6, 2.6);
    }
  },
  answer: async (page, cam) => {
    for (const s of [0, 1]) {
      await open(page); await zoom(page, cam);
      await step(page, 45);
      await api(page, (sl) => window.__VFX__.stageCall(sl), s);
      await step(page, 24);
      await api(page, (sl) => window.__VFX__.answerCall(sl), s);
      await step(page, 4);
      await still(page);
      await crop(page, 'answer', s, cam, 3.0, 2.8);
    }
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
        log('p2 failed', name, cam, String(err).slice(0, 300));
      }
      writeFileSync(`${out}/p2-${tag}${ONLY ? '-' + only.replace(/\W/g, '') : ''}.json`, JSON.stringify(notes, null, 1));
    }
  }
  writeFileSync(`${out}/p2-${tag}${ONLY ? '-' + only.replace(/\W/g, '') : ''}.json`, JSON.stringify(notes, null, 1));
});
