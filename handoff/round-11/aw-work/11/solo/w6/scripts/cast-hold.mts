// How long a Solo sits past the moment the sim's tell says it is due (soloDueIn at 0) because the
// hero is finishing a cast, and how many Solos fire plain while the bot's Thread waits on such a
// hero.   npx tsx cast-hold.mts <repo root> <seeds>
const root = process.argv[2]!;
const seeds = Number(process.argv[3] ?? 3);
const { makeBot } = await import(`${root}/src/bots/index.ts`);
const { encounterDef } = await import(`${root}/src/content/index.ts`);
const { createSim, soloDueIn } = await import(`${root}/src/sim/index.ts`);
const { STUDY_FIGHTS } = await import(`${root}/tools/solo-study.ts`);
const { defaultKit, kitById, kitConfig } = await import(`${root}/tools/kits.ts`);
const late: Record<string, number[]> = {};
let solos = 0, plain = 0, plainWhileParked = 0, cued = 0;
for (const fight of STUDY_FIGHTS) {
  for (let s = 1; s <= seeds; s++) {
    const def = encounterDef(fight);
    const sim = createSim({ seed: 500 + s, encounter: fight, ...kitConfig(kitById(defaultKit(def.movement ?? 1))) });
    const bot = makeBot('skilled', 500 + s);
    const dueAt = new Map<number, number>(); // tick the tell first read 0 with the hero casting
    for (let t = 0; t < 9 * 3600; t++) {
      const st = sim.state;
      const pre = st.party.map((id: number) => {
        const e = st.entities.get(id)!;
        return { id, due: soloDueIn(st, e), cast: e.hero!.cast !== null, def: e.hero!.defId, slot: e.hero!.slot };
      });
      for (const p of pre) {
        if (p.due !== null && p.due <= 1e-6) { if (!dueAt.has(p.id)) dueAt.set(p.id, t); }
        else dueAt.delete(p.id);
      }
      const thread = st.entities.get(st.weaverId)!.weaver!.threadSlot;
      sim.step(bot.decide(st));
      for (const e of sim.drainEvents() as { type: string; hero?: number; cued?: boolean }[]) {
        if (e.type !== 'soloStarted') continue;
        const p = pre.find((x: { id: number }) => x.id === e.hero);
        if (!p) continue;
        solos++;
        if (e.cued) cued++; else plain++;
        const since = dueAt.get(p.id);
        (late[p.def] ??= []).push(since === undefined ? 0 : (t - since) / 60);
        // Plain, while the Thread sat on another hero whose tell had run out (waiting on a cast)?
        if (!e.cued) {
          const parked = pre.find((x: { slot: number; id: number }) => x.slot === thread && x.id !== p.id);
          if (parked && dueAt.has(parked.id) && parked.cast) plainWhileParked++;
        }
        dueAt.delete(p.id);
      }
      if (st.encounter.status === 'victory' || st.encounter.status === 'defeat') break;
    }
  }
}
console.log(`${solos} Solos: ${cued} Cued, ${plain} plain; ${plainWhileParked} of the plain ones fired while the Thread waited on another hero who was finishing a cast`);
for (const [def, xs] of Object.entries(late)) {
  const over = xs.filter((x) => x > 0.1);
  const mean = over.reduce((a, b) => a + b, 0) / Math.max(1, over.length);
  console.log(`  ${def}: ${xs.length} Solos; ${over.length} (${Math.round((100 * over.length) / xs.length)}%) fired more than 0.1 s after the tell ran out, by ${mean.toFixed(2)} s on average, ${Math.max(0, ...xs).toFixed(2)} s at most`);
}
