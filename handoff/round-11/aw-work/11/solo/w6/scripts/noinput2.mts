const root = process.argv[2]!;
const { createSim, soloDueIn } = await import(`${root}/src/sim/index.ts`);
const sim = createSim({ seed: 4242, encounter: 'first_light' });
for (let t = 0; t < 60 * 240; t++) {
  const events = sim.step([]);
  const st = sim.state;
  for (const e of events) {
    if (e.type === 'soloStarted' || e.type === 'heroDowned' || e.type === 'downed' || e.type === 'waveStarted') console.log(st.time.toFixed(1), JSON.stringify(e));
  }
  if (t % 300 === 0) {
    console.log(st.time.toFixed(1), st.encounter.status, 'wave', st.encounter.wave, st.party.map((id: number) => { const e = st.entities.get(id)!; return `${e.hero!.defId} solo ${e.hero!.solo.toFixed(0)} hp ${Math.round(e.health!.hp)}/${Math.round(e.health!.maxHp)} ${e.health!.downed ? 'DOWN' : ''} eng ${e.hero!.engaged} due ${soloDueIn(st, e)}`; }).join(' | '));
    const w = st.entities.get(st.weaverId)!; console.log('   weaver hp', Math.round(w.health!.hp), 'downed', w.health!.downed, 'thread', w.weaver!.threadSlot);
  }
  if (st.encounter.status === 'victory' || st.encounter.status === 'defeat') { console.log('END', st.encounter.status, st.time.toFixed(1)); break; }
}
