// How long does Oro's tell stand at "1.0 s" with a full Solo, no target and no Sapling fighting?
const ROOT = '/home/user/aw-work/wt-p11solo-review';
const { makeBot } = await import(`${ROOT}/src/bots`);
const { encounterDef } = await import(`${ROOT}/src/content`);
const { createSim, soloDueIn } = await import(`${ROOT}/src/sim`);
const { soloTell } = await import(`${ROOT}/src/ui/hudBridge`);
const { defaultKit, kitById, kitConfig } = await import(`${ROOT}/tools/kits`);
const { autoSoloTarget } = await import(`${ROOT}/src/input/InputController`);
for (const [bot, fight, seed, diss] of [['novice','maw_hollow',501,false],['novice','hollow_cantor',501,false],['novice','mirror_hall',502,false],['skilled','maw_hollow',501,false],['novice','maw_hollow',501,true]] as const) {
  const def = encounterDef(fight);
  const sim = createSim({ seed, encounter: fight, ...kitConfig(kitById(defaultKit(def.movement ?? 1))), party: ['kael','oro','vexis'].map((heroId) => ({ heroId })), ...(diss ? { dissonance: [{ id: 'silent_cues', rank: 1 }] } : {}) });
  const b = makeBot(bot, seed);
  let run = 0, longest = 0, total = 0, ticks = 0, fights = 0, autoOnOro = 0, enemiesDuring = 0;
  for (let t = 0; t < 9 * 3600; t++) {
    sim.step(b.decide(sim.state)); sim.drainEvents();
    const st = sim.state; ticks++;
    const oro = st.entities.list().find((x: any) => x.hero?.defId === 'oro');
    const tell = soloTell(st, oro);
    const stuck = oro.hero.solo >= 100 && oro.hero.soloActive <= 0 && oro.hero.targetId === null && tell.soloIn !== null && oro.hero.soloHeld === 0;
    if (stuck) { run++; total++; longest = Math.max(longest, run); if (autoSoloTarget(st) === oro.hero.slot) autoOnOro++; if (st.entities.list().some((x: any) => x.enemy && x.health && !x.health.dead)) enemiesDuring++; } else run = 0;
    if (st.encounter.status !== 'fighting' && st.encounter.status !== 'intro') break;
  }
  console.log(bot, fight, seed, diss ? 'silent_cues' : '', `fight ${(ticks/60).toFixed(0)} s; Oro's strip stood at soloIn=1.0, soloNow=true for ${(total/60).toFixed(1)} s in all, longest ${(longest/60).toFixed(1)} s; enemies alive for ${(enemiesDuring/60).toFixed(1)} s of it; Auto-Thread would sit on Oro for ${(autoOnOro/60).toFixed(1)} s of it`);
}
