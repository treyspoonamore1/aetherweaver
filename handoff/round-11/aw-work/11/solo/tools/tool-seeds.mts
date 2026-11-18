// Seeds for the tool tests whose expectations depend on how a run or a fight happens to go.
const root = process.argv[2]!;
const { playRun } = await import(`${root}/tools/harness-core.ts`);
const { decreeFight } = await import(`${root}/tools/decrees.ts`);
const { verbConfig, verbFight, techniquesArg } = await import(`${root}/tools/verbs.ts`);
const { NAMED_PARTIES } = await import(`${root}/tools/harness.ts`);
const { SkilledBot } = await import(`${root}/src/bots/skilled.ts`);
const { makeBot } = await import(`${root}/src/bots/index.ts`);
const { createSim } = await import(`${root}/src/sim/index.ts`);
const what = process.argv[3] ?? 'all';

if (what === 'all' || what === 'unweaver') {
  for (let k = 0; k < 12; k++) {
    const seed = 2000 + k * 104729;
    const r = playRun(seed, 'skilled', undefined, { movements: 3 });
    console.log('I-III', seed, r.outcome, 'M' + r.movementReached, r.lastEncounter);
  }
}
if (what === 'all' || what === 'finale') {
  for (let seed = 2000; seed < 2012; seed++) {
    const r = playRun(seed, 'skilled', undefined, { movements: 4 });
    console.log('finale', seed, r.outcome, 'M' + r.movementReached, r.lastEncounter);
  }
}
if (what === 'all' || what === 'maw') {
  for (let k = 0; k < 16; k++) {
    const seed = 1000 + k * 7919;
    const holds = (setup: object) => {
      const sim = createSim(verbConfig('maw_hollow', seed, 3, setup));
      const bot = new SkilledBot(seed, { every: 4, attention: 1, callReaction: 0.4 });
      let n = 0;
      for (let t = 0; t < 9 * 60 * 60; t++) {
        const out = bot.decide(sim.state);
        n += out.filter((c: { t: string; kind?: string }) => c.t === 'directive' && c.kind === 'hold').length;
        sim.step(out);
        sim.drainEvents();
        const s = sim.state.encounter.status;
        if (s === 'victory' || s === 'defeat') break;
      }
      return n;
    };
    const brann = { party: NAMED_PARTIES.A!, techniques: techniquesArg('swap') };
    const h = holds(brann);
    let differ = '';
    if (h > 0) {
      const on = verbFight('maw_hollow', seed, new Set(), 3, brann);
      const off = verbFight('maw_hollow', seed, new Set(['mawHold']), 3, brann);
      differ = JSON.stringify(on) !== JSON.stringify(off) ? 'on/off differ' : 'on/off SAME';
    }
    console.log('maw', seed, 'default', holds({}), 'brann', h, differ);
  }
}
if (what === 'all' || what === 'decree') {
  for (let k = 0; k < 16; k++) {
    const seed = 1000 + k * 7919;
    const skilled = makeBot('skilled', seed);
    let cut = false;
    const lazy = {
      name: 'lazy',
      decide(state: { entities: { get(id: number): { weaver?: { threadLock?: number } } | undefined }; weaverId: number }) {
        if ((state.entities.get(state.weaverId)?.weaver?.threadLock ?? 0) > 0) cut = true;
        const out = skilled.decide(state);
        return cut ? out.filter((c: { t: string }) => c.t !== 'thread') : out;
      },
    };
    const g = decreeFight('the_seamstress', seed, 'skilled', lazy);
    const failed = g.unpicks!.some((u: { lockEnd: number | null; rethreaded: boolean }) => u.lockEnd !== null && !u.rethreaded);
    console.log('decree', seed, 'won', g.won, 'unpicks', g.unpicks!.length, 'a cut one not rethreaded:', failed, 'answered', g.answered.Unpicking, 'of', g.occurrences.Unpicking);
  }
}
