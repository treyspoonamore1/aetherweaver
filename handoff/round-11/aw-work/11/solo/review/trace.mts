// Traces one hero's Solo state over a tick window in one fight.
const ROOT = '/home/user/aw-work/wt-p11solo-review';
const [bot, fight, seedS, who, fromS, toS] = process.argv.slice(2);
const { makeBot } = await import(`${ROOT}/src/bots`);
const { encounterDef } = await import(`${ROOT}/src/content`);
const { createSim, soloDueIn } = await import(`${ROOT}/src/sim`);
const { defaultKit, kitById, kitConfig } = await import(`${ROOT}/tools/kits`);
const def = encounterDef(fight);
const seed = Number(seedS);
const sim = createSim({ seed, encounter: fight, ...kitConfig(kitById(defaultKit(def.movement ?? 1))) });
const b = makeBot(bot, seed);
let last = '';
for (let t = 0; t <= Number(toS); t++) {
  sim.step(b.decide(sim.state));
  const ev = sim.drainEvents();
  if (t < Number(fromS)) continue;
  const st = sim.state;
  const e = st.entities.list().find((x: any) => x.hero?.defId === who)!;
  const h = e.hero;
  const line = `solo=${h.solo.toFixed(0)} act=${h.soloActive.toFixed(1)} tgt=${h.targetId} reel=${!!h.reel} hold=${!!h.hold} st=[${e.health.statuses.map((s: any) => s.id).join(',')}] down=${e.health.downed} action=${h.action} thr=${st.entities.get(st.weaverId).weaver.threadSlot} lastSolo=${st.field.lastSoloAt?.toFixed(2)}`;
  const sol = ev.filter((x: any) => x.type === 'soloStarted').map((x: any) => `START ${x.solo} cued=${x.cued}`).join(' ');
  if (line !== last || sol) console.log(t, `held=${h.soloHeld.toFixed(2)} due=${soloDueIn(st, e)?.toFixed(2)} hp=${(e.health.hp/e.health.maxHp).toFixed(2)} inc=${e.health.incoming.toFixed(0)}`, line, sol);
  last = line;
}
