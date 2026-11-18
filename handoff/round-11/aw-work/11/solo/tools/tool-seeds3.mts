// Round 2: seeds for the tests whose expectations hang on one seed's fight or run.
const root = '/home/user/aw-work/wt-p11solo';
const { playRun, playEncounter } = await import(`${root}/tools/harness-core.ts`);
const { decreeFight } = await import(`${root}/tools/decrees.ts`);
const { verbConfig, verbFight, techniquesArg } = await import(`${root}/tools/verbs.ts`);
const { NAMED_PARTIES } = await import(`${root}/tools/harness.ts`);
const { SkilledBot } = await import(`${root}/src/bots/skilled.ts`);
const { makeBot } = await import(`${root}/src/bots/index.ts`);
const { createSim } = await import(`${root}/src/sim/index.ts`);
const { kitConfig, ARRIVAL4_KIT } = await import(`${root}/tools/kits.ts`);
const out = (s: string) => console.log(s);
// whole runs
for (const seed of [1, 2, 3, 4, 5, 6]) {
  const r = playRun(seed, 'skilled', undefined, { movements: 2 });
  let relics = 0;
  playRun(seed, 'skilled', undefined, { movements: 2, onPhase: (phase: string, run: any) => { if (phase === 'relic' && run.relicOffer && run.relicOffer.options.length > 1) relics++; } });
  const skipped = playRun(seed, 'skilled', undefined, { movements: 2, draftPrefer: () => null });
  out(`run2 seed ${seed}: ${r.outcome} M${r.movementReached}; relic offers ${relics}; skipped-draft motifs ${skipped.motifs.length}`);
}
for (let k = 0; k < 8; k++) {
  const seed = 2000 + k * 104729;
  const r = playRun(seed, 'skilled', undefined, { movements: 3 });
  out(`I-III seed ${seed} (k=${k}): ${r.outcome} M${r.movementReached} ${r.lastEncounter}`);
}
for (let seed = 2000; seed < 2010; seed++) {
  const r = playRun(seed, 'skilled', undefined, { movements: 4 });
  out(`finale route seed ${seed}: ${r.outcome} M${r.movementReached} ${r.lastEncounter}`);
}
// mawHold
for (let k = 0; k < 20; k++) {
  const seed = 1000 + k * 7919;
  const holds = (setup: object) => {
    const sim = createSim(verbConfig('maw_hollow', seed, 3, setup));
    const bot = new SkilledBot(seed, { every: 4, attention: 1, callReaction: 0.4 });
    let n = 0;
    for (let t = 0; t < 9 * 60 * 60; t++) {
      const cmds = bot.decide(sim.state);
      n += cmds.filter((c: any) => c.t === 'directive' && c.kind === 'hold').length;
      sim.step(cmds); sim.drainEvents();
      const s = sim.state.encounter.status;
      if (s === 'victory' || s === 'defeat') break;
    }
    return n;
  };
  const brann = { party: NAMED_PARTIES.A!, techniques: techniquesArg('swap') };
  const h = holds(brann);
  if (h > 0) {
    const on = verbFight('maw_hollow', seed, new Set(), 3, brann);
    const off = verbFight('maw_hollow', seed, new Set(['mawHold']), 3, brann);
    out(`maw seed ${seed}: default ${holds({})} brann ${h} ${JSON.stringify(on) !== JSON.stringify(off) ? 'on/off differ' : 'SAME'}`);
  }
}
// Decree gate: lazy weaver; unpick inside lock; Stolen Verse deserter
for (let k = 0; k < 20; k++) {
  const seed = 1000 + k * 7919;
  const skilled = makeBot('skilled', seed);
  let cut = false;
  const lazy = { name: 'lazy', decide(state: any) { if ((state.entities.get(state.weaverId)?.weaver?.threadLock ?? 0) > 0) cut = true; const o = skilled.decide(state); return cut ? o.filter((c: any) => c.t !== 'thread') : o; } };
  const g = decreeFight('the_seamstress', seed, 'skilled', lazy);
  const lazyOk = g.unpicks!.some((u: any) => u.lockEnd !== null && !u.rethreaded) && g.answered.Unpicking < g.occurrences.Unpicking;
  const f = decreeFight('the_seamstress', seed, 'skilled');
  const open = f.unpicks!.filter((u: any) => u.open);
  const unpickOk = f.won && open.length > 0 && open.every((u: any) => u.lockEnd !== null && !u.rethreaded) && f.answered.Unpicking === f.unpicks!.filter((u: any) => !u.downed).length;
  const cuts = f.unpicks!.filter((u: any) => u.lockEnd !== null);
  const baseOk = cuts.length > 0;
  // deserter
  const sk2 = makeBot('skilled', seed);
  let gone = false; let up = false;
  const deserter = { name: 'deserter', decide(state: any) { up = state.field.stolen !== undefined; const boss = state.entities.get(state.encounter.bossId ?? -1); const near = boss?.health !== undefined && boss.health.hp <= 0.7 * boss.health.maxHp; if (!near && !gone) return sk2.decide(state); if (gone) return []; gone = true; return [{ t: 'debug', op: { op: 'teleportWeaver', x: 0, z: 21 } }]; } };
  const d = decreeFight('the_unweaver', seed, 'skilled', deserter);
  const desertOk = !d.won && up && d.occurrences['Steal Verse'] === (d.seen['Steal Verse'] ?? 0) - 1 && d.answered['Steal Verse'] === 0;
  out(`decree seed ${seed}: lazy ${lazyOk} unpick ${unpickOk} cutsAt1000style ${baseOk} deserter ${desertOk}`);
}
for (let seed = 1000; seed < 1012; seed++) {
  let cue: number | null = null; let excused = 0; let unsung = 0;
  const run = playEncounter({ seed, encounter: 'the_silent_conductor', ...kitConfig(ARRIVAL4_KIT) }, 'skilled', (sim: any, events: any[]) => {
    for (const e of events) { if (e.type === 'enemyCued') cue = e.soloist; if (e.type === 'telegraphStarted' && e.owner === cue) cue = null; if (cue !== null && (e.type === 'phaseChanged' || (e.type === 'enemyKilled' && e.enemy === cue))) { excused++; cue = null; } }
    if (cue !== null && sim.state.field.finale?.cue?.soloist !== cue) { if (sim.state.encounter.status !== 'victory') unsung++; cue = null; }
  });
  out(`finalewatch seed ${seed}: ${run.outcome} excused ${excused} unsung ${unsung} cuesFailed ${run.finale?.cuesFailed}`);
}
