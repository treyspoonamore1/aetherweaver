// A settings file as main writes it (version 4), with everything away from its default, read by the branch.
const MAIN = '/home/user/aetherweaver';
const HERE = '/home/user/aw-work/wt-p11solo-review';
const m = await import(`${MAIN}/src/app/settings`);
const h = await import(`${HERE}/src/app/settings`);
const bm = await import(`${MAIN}/src/input/bindings`);
const bh = await import(`${HERE}/src/input/bindings`);
const base = JSON.parse(JSON.stringify(m.DEFAULT_SETTINGS));
const cases: Record<string, any> = {
  'autonomy on, cue rebound to G, modifier Control, pad cue on dpadLeft': {
    ...base,
    volumes: { master: 0.3, music: 0.2, sfx: 0.5, ui: 0.1, ambience: 0.4, barks: 0.6 },
    screenShake: 0.4, hints: false, uiScale: 1.2, colorVision: 'deuteranopia', captions: true,
    bindings: { cue: ['KeyG'], ward: ['KeyT'], chime: ['KeyE', 'KeyC'] },
    assists: { perfectWindowBonus: 0.1, telegraphLead: 1.5, autonomy: true },
    input: { threadMode: 'hold', wheel: 'toggle', mouseoverCast: false, cueModifier: 'Control', mouse: { thread: 'Mouse0', mode: 'KeyX', wheel: 'Mouse1' }, padBindings: { cueReticle: ['dpadLeft'], ward: ['bumperRight'] } },
    aids: { autoThread: true, gameSpeed: 0.8 },
    reducedMotion: true,
  },
  'only the cue things changed (input left with nothing)': { ...base, bindings: { cue: [] }, input: { cueModifier: 'KeyC', padBindings: { cueReticle: [] } } },
  'cue swapped with ward in Controls (ward now on T, cue on Q)': { ...base, bindings: { cue: ['KeyQ'], ward: ['KeyT'] } },
  'a key action bound to the key that was the Cue modifier': { ...base, input: { cueModifier: 'KeyC' }, bindings: { bear: ['KeyC'] } },
};
for (const [name, v4] of Object.entries(cases)) {
  const okMain = m.SettingsSchema.safeParse(v4);
  const out = h.migrateSettings(JSON.parse(JSON.stringify(v4)));
  console.log(`\n== ${name}\n main reads it: ${okMain.success}${okMain.success ? '' : ' ' + JSON.stringify(okMain.error.issues.slice(0, 2))}`);
  if (!out) { console.log(' BRANCH: null (settings lost!)'); continue; }
  const lost: string[] = [];
  const walk = (a: any, b: any, path: string) => {
    if (a && typeof a === 'object' && !Array.isArray(a)) { for (const k of Object.keys(a)) walk(a[k], b?.[k], `${path}.${k}`); return; }
    if (JSON.stringify(a) !== JSON.stringify(b)) lost.push(`${path}: ${JSON.stringify(a)} -> ${JSON.stringify(b)}`);
  };
  walk(okMain.success ? okMain.data : v4, out, '');
  console.log(' differs:', lost);
  const eff = bh.effectiveBindings(out.bindings);
  console.log(' effective: ward', eff.ward, 'chime', eff.chime, 'bear', eff.bear, 'KeyT used by', Object.entries(eff).filter(([, v]: any) => v.includes('KeyT')).map(([k]) => k), 'KeyQ used by', Object.entries(eff).filter(([, v]: any) => v.includes('KeyQ')).map(([k]) => k));
}
