// On main (the base): how often does a Solo's start cancel a cast in progress, with the Skilled bot Cueing?
const ROOT = process.argv[2]!;
const seeds = Number(process.argv[3] ?? 4);
const { makeBot } = await import(`${ROOT}/src/bots`);
const { encounterDef } = await import(`${ROOT}/src/content`);
const { createSim } = await import(`${ROOT}/src/sim`);
const { defaultKit, kitById, kitConfig } = await import(`${ROOT}/tools/kits`);
const FIGHTS = ['tolling_halls','mourning_steps','bellwarden','hollow_cantor','pike_line','leech_warren','gorehound_matriarch','vharun','maw_hollow','mirror_hall','the_seamstress','the_unweaver','the_silent_conductor'];
let solos = 0, cast = 0, flourish = 0;
for (const bot of ['skilled', 'novice']) for (const fight of FIGHTS) for (let s = 1; s <= seeds; s++) {
  const def = encounterDef(fight);
  const sim = createSim({ seed: 500 + s, encounter: fight, ...kitConfig(kitById(defaultKit(def.movement ?? 1))) });
  const b = makeBot(bot, 500 + s);
  for (let t = 0; t < 9 * 3600; t++) {
    const st = sim.state;
    const pre = new Map(st.party.map((id: number) => { const e = st.entities.get(id)!; return [id, { cast: e.hero.cast !== null, fl: e.hero.cast?.flourish === true }]; }));
    sim.step(b.decide(st));
    for (const e of sim.drainEvents()) if (e.type === 'soloStarted') { solos++; const p: any = pre.get(e.hero); if (p.cast) cast++; if (p.fl) flourish++; }
    const status = sim.state.encounter.status;
    if (status === 'victory' || status === 'defeat') break;
  }
}
console.log(ROOT, { solos, cast, flourish, castPct: (cast / solos * 100).toFixed(1), flourishPct: (flourish / solos * 100).toFixed(1) });
