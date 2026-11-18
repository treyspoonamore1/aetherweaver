const ROOT = '/home/user/aw-work/wt-p11solo-review';
const { makeBot } = await import(`${ROOT}/src/bots`);
const { encounterDef } = await import(`${ROOT}/src/content`);
const { createSim, runReplay, parseReplay } = await import(`${ROOT}/src/sim`);
const { ReplayRecorder } = await import(`${ROOT}/src/sim/replay`);
const { defaultKit, kitById, kitConfig } = await import(`${ROOT}/tools/kits`);
function play(fight: string, seed: number, extra: any) {
  const def = encounterDef(fight);
  const sim = createSim({ seed, encounter: fight, ...kitConfig(kitById(defaultKit(def.movement ?? 1))), ...extra });
  const b = makeBot('skilled', seed);
  const hashes: string[] = [];
  for (let t = 0; t < 9 * 3600; t++) {
    sim.step(b.decide(sim.state)); sim.drainEvents();
    if (t % 600 === 0) hashes.push(sim.hash());
    const st = sim.state.encounter.status; if (st === 'victory' || st === 'defeat') break;
  }
  hashes.push(sim.hash());
  return hashes.join(',');
}
for (const [fight, extra] of [['vharun', {}], ['the_silent_conductor', { calling: { id: 'conductor', path: ['a_tempo', 'reprise', 'spotlight', 'maestro'] } }], ['hollow_cantor', { party: ['kael', 'oro', 'seren'].map((heroId) => ({ heroId })), dissonance: [{ id: 'silent_cues', rank: 1 }], relics: [{ id: 'hollow_crown' }] }]] as const) {
  const a = play(fight, 42, extra), b = play(fight, 42, extra);
  console.log(fight, a === b ? 'same hashes twice' : 'DIFFERENT', a.split(',').length, 'hashes');
}
