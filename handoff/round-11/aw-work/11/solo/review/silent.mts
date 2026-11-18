// Silent Cues: what share of Solos does the Skilled bot Cue, and of those that fire one gap after another?
const ROOT = '/home/user/aw-work/wt-p11solo-review';
const { makeBot } = await import(`${ROOT}/src/bots`);
const { encounterDef } = await import(`${ROOT}/src/content`);
const { createSim } = await import(`${ROOT}/src/sim`);
const { defaultKit, kitById, kitConfig } = await import(`${ROOT}/tools/kits`);
const { STUDY_FIGHTS } = await import(`${ROOT}/tools/solo-study`);
const seeds = Number(process.argv[2] ?? 4);
for (const calling of [undefined, { id: 'conductor', path: ['marcato', 'reprise', 'ensemble', 'triad'] }]) for (const silent of [false, true]) {
  let cued = 0, plain = 0, backCued = 0, backPlain = 0, duets = 0, trios = 0, fights = 0, wins = 0;
  for (const fight of STUDY_FIGHTS) for (let s = 1; s <= seeds; s++) {
    const def = encounterDef(fight);
    const sim = createSim({ seed: 700 + s, encounter: fight, ...kitConfig(kitById(defaultKit(def.movement ?? 1))), ...(calling ? { calling } : {}), ...(silent ? { dissonance: [{ id: 'silent_cues', rank: 1 }] } : {}) });
    const b = makeBot('skilled', 700 + s);
    let last = -1e9; fights++;
    for (let t = 0; t < 9 * 3600; t++) {
      sim.step(b.decide(sim.state));
      const ev = sim.drainEvents();
      const fin = new Set(ev.filter((e: any) => e.type === 'finaleTurn').map((e: any) => e.hero));
      for (const e of ev) if (e.type === 'soloStarted' && !fin.has(e.hero)) {
        const back = t - last <= 62;
        if (e.cued) { cued++; if (back) backCued++; } else { plain++; if (back) backPlain++; }
        last = t;
      }
      const st = sim.state.encounter.status;
      if (st === 'victory' || st === 'defeat') { if (st === 'victory') wins++; break; }
    }
    duets += sim.state.ledger.conducting?.duets ?? 0; trios += sim.state.ledger.conducting?.trios ?? 0;
  }
  console.log(`${calling ? 'conductor' : 'no calling'} ${silent ? 'Silent Cues' : 'plain      '}: fights ${fights} win ${(wins / fights * 100).toFixed(0)}% Cued ${(cued / (cued + plain) * 100).toFixed(0)}% (${cued}/${cued + plain}); fired within a gap of the last: Cued ${backCued} plain ${backPlain}; duets/fight ${(duets / fights).toFixed(2)} trios/fight ${(trios / fights).toFixed(2)}`);
}
