// The beat strip's "next Solo" during the Grand Silence, a stun or a possession: does it name a hero who can't fire?
const ROOT = '/home/user/aw-work/wt-p11solo-review';
const { makeBot } = await import(`${ROOT}/src/bots`);
const { encounterDef } = await import(`${ROOT}/src/content`);
const { createSim } = await import(`${ROOT}/src/sim`);
const { buildHudSnapshot } = await import(`${ROOT}/src/ui/hudBridge`);
const { defaultKit, kitById, kitConfig } = await import(`${ROOT}/tools/kits`);
let ticksNamed = 0, ticksSilence = 0, sample = '';
for (const seed of [501, 502, 503]) {
  const fight = 'the_silent_conductor';
  const def = encounterDef(fight);
  const sim = createSim({ seed, encounter: fight, ...kitConfig(kitById(defaultKit(def.movement ?? 1))), calling: { id: 'conductor', path: ['a_tempo', 'reprise', 'spotlight', 'maestro'] } });
  const b = makeBot('skilled', seed);
  for (let t = 0; t < 9 * 3600; t++) {
    sim.step(b.decide(sim.state)); sim.drainEvents();
    const st = sim.state;
    if (t % 4 === 0) {
      const stilled = st.party.filter((id: number) => st.entities.get(id)?.health?.statuses.some((s: any) => s.id === 'stilled'));
      if (stilled.length) {
        ticksSilence += 4;
        const hud = buildHudSnapshot(st, { seed, hovered: null });
        const next = hud.conducting?.beat?.next;
        const frames = hud.party.filter((p: any) => p.soloIn != null).length;
        if (next) { ticksNamed += 4; if (!sample) sample = `seed ${seed} t=${(t / 60).toFixed(1)}s: strip says "${next.name}'s Solo begins in ${next.in.toFixed(1)} s"; heroes stilled: ${stilled.length}; frames showing a Solo strip: ${frames}`; }
      }
    }
    if (st.encounter.status === 'victory' || st.encounter.status === 'defeat') break;
  }
}
console.log(`stilled for ${(ticksSilence / 60).toFixed(0)} s in all; the beat strip named a next Solo for ${(ticksNamed / 60).toFixed(0)} s of it. ${sample}`);
