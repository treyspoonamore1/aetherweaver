// Who goes down in a fight, and were they mid-Solo: npx tsx downs-look.mts <root> <fight> <bot> <seeds>
const root = process.argv[2]!;
const fight = process.argv[3]!;
const botKind = process.argv[4] ?? 'skilled';
const seeds = Number(process.argv[5] ?? 60);
const callingId = process.argv[6];
let weaverDowns = 0;
let bearTicks = 0;
let ticks = 0;
let cresc = 0;
const { createSim } = await import(`${root}/src/sim/index.ts`);
const { makeBot } = await import(`${root}/src/bots/index.ts`);
const { encounterDef } = await import(`${root}/src/content/index.ts`);
const { defaultKit, kitById, kitConfig } = await import(`${root}/tools/kits.ts`);
const def = encounterDef(fight);
const by: Record<string, { downs: number; midSolo: number; rooted: number }> = {};
let wins = 0;
let solos = 0;
const when: number[] = [];
for (let i = 0; i < seeds; i++) {
  const seed = 1000 + i * 7919;
  const sim = createSim({ seed, encounter: fight, ...kitConfig(kitById(defaultKit(def.movement ?? 1))), ...(callingId ? { calling: { id: callingId } } : {}) });
  const bot = makeBot(botKind, seed);
  for (let t = 0; t < 9 * 3600; t++) {
    const mid = new Map<number, { solo: number; id: string; cued: boolean }>();
    for (const id of sim.state.party) {
      const e = sim.state.entities.get(id);
      if (e?.hero) mid.set(id, { solo: e.hero.soloActive, id: e.hero.soloId, cued: e.hero.soloCued });
    }
    sim.step(bot.decide(sim.state));
    for (const e of sim.drainEvents()) {
      if (e.type === 'soloStarted') solos++;
      if (e.type === 'weaverDowned') weaverDowns++;
      if (e.type === 'crescendoStart') cresc++;
      if (e.type === 'allyDowned') {
        const h = sim.state.entities.get(e.hero);
        const name = h?.hero?.defId ?? '?';
        const b = (by[name] ??= { downs: 0, midSolo: 0, rooted: 0 });
        b.downs++;
        const m = mid.get(e.hero);
        if (m && m.solo > 0) {
          b.midSolo++;
          if (m.id === 'starfall' || (m.id === 'galeBarrage' && !m.cued)) b.rooted++;
        }
        when.push(sim.state.time);
      }
    }
    ticks++;
    if (sim.state.entities.get(sim.state.weaverId)?.weaver?.threadMode === 'bear') bearTicks++;
    const s = sim.state.encounter.status;
    if (s === 'victory' || s === 'defeat') {
      if (s === 'victory') wins++;
      break;
    }
  }
}
console.log(root.split('/').pop(), fight, botKind, `won ${wins}/${seeds}`, 'solos/fight', (solos / seeds).toFixed(1), JSON.stringify(by), 'mean time of a down', (when.reduce((a, b) => a + b, 0) / Math.max(1, when.length)).toFixed(0), 'weaver downs', weaverDowns, 'bear share', (bearTicks / ticks).toFixed(2), 'crescendos', cresc, 'secs/fight', (ticks / 60 / seeds).toFixed(0));
