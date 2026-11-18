// The study's fights on any tree (main too): npx tsx fights-mini.mts <root> <bot> <seeds> [calling] [path,..] [fights,..]
const root = process.argv[2]!;
const botKind = process.argv[3] ?? 'skilled';
const seeds = Number(process.argv[4] ?? 20);
const callingId = process.argv[5] && process.argv[5] !== '-' ? process.argv[5] : undefined;
const path = process.argv[6] && process.argv[6] !== '-' ? process.argv[6].split(',') : undefined;
const { createSim } = await import(`${root}/src/sim/index.ts`);
const { makeBot } = await import(`${root}/src/bots/index.ts`);
const { encounterDef } = await import(`${root}/src/content/index.ts`);
const { defaultKit, kitById, kitConfig } = await import(`${root}/tools/kits.ts`);
const FIGHTS = (process.argv[7] ?? 'tolling_halls,mourning_steps,bellwarden,hollow_cantor,pike_line,leech_warren,gorehound_matriarch,vharun,maw_hollow,mirror_hall,the_seamstress,the_unweaver,the_silent_conductor').split(',');
const groups: Record<string, { n: number; wins: number; secs: number; downs: number; cresc: number }> = {};
for (const fight of FIGHTS) {
  const def = encounterDef(fight);
  const g = def.kind === 'boss' || def.kind === 'miniboss' ? 'bosses' : 'skirmishes';
  const acc = (groups[g] ??= { n: 0, wins: 0, secs: 0, downs: 0, cresc: 0 });
  const one = (groups[fight] ??= { n: 0, wins: 0, secs: 0, downs: 0, cresc: 0 });
  for (let i = 0; i < seeds; i++) {
    const seed = 1000 + i * 7919;
    const sim = createSim({
      seed,
      encounter: fight,
      ...kitConfig(kitById(defaultKit(def.movement ?? 1))),
      ...(callingId ? { calling: { id: callingId, ...(path ? { path } : {}) } } : {}),
    });
    const bot = makeBot(botKind, seed);
    for (let t = 0; t < 9 * 3600; t++) {
      sim.step(bot.decide(sim.state));
      sim.drainEvents();
      const s = sim.state.encounter.status;
      if (s === 'victory' || s === 'defeat') break;
    }
    const st = sim.state;
    const won = st.encounter.status === 'victory';
    for (const a of [acc, one]) {
      a.n++;
      if (won) {
        a.wins++;
        a.secs += (st.encounter.endedAt ?? st.time) - st.encounter.startedAt;
      }
      a.downs += st.ledger.downs;
      a.cresc += st.ledger.crescendos;
    }
  }
}
for (const [k, a] of Object.entries(groups))
  console.log(root.split('/').pop()!.padEnd(14), botKind.padEnd(8), (callingId ?? 'none').padEnd(10), (path?.join(',') ?? '').padEnd(36), k.padEnd(22), `n ${a.n}`, `win ${((100 * a.wins) / a.n).toFixed(0)}%`, `secs ${(a.secs / Math.max(1, a.wins)).toFixed(0)}`, `downs ${(a.downs / a.n).toFixed(2)}`, `crescendos ${(a.cresc / a.n).toFixed(2)}`);
