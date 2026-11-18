// Plays real fights tick by tick and checks the Solo rules' invariants on every tick.
import { makeBot, type BotKind } from '/home/user/aw-work/wt-p11solo-review/src/bots';
import { encounterDef } from '/home/user/aw-work/wt-p11solo-review/src/content';
import { createSim, SOLOS, soloDueIn, threadCues, type SimConfig } from '/home/user/aw-work/wt-p11solo-review/src/sim';
import { isDisabled } from '/home/user/aw-work/wt-p11solo-review/src/sim/combat/health';
import { STUDY_FIGHTS } from '/home/user/aw-work/wt-p11solo-review/tools/solo-study';
import { defaultKit, kitById, kitConfig } from '/home/user/aw-work/wt-p11solo-review/tools/kits';

const seeds = Number(process.argv[2] ?? 3);
const callingArg = process.argv[3];
const partyArg = process.argv[4];
const extra: Partial<SimConfig> = {};
if (callingArg && callingArg !== '-') {
  const [id, ...path] = callingArg.split(':');
  (extra as any).calling = { id, path: path[0] ? path[0].split(',') : [] };
}
if (partyArg) (extra as any).party = partyArg.split(',').map((heroId) => ({ heroId }));

const stats = {
  fights: 0, solos: 0, cued: 0, plain: 0, finale: 0,
  castCancelled: 0, flourishCancelled: 0, gapViolations: 0, cuedMismatch: 0, cuedEventMismatch: 0,
  firedDisabled: 0, firedNotFull: 0, noTarget: 0, maxWait: 0, maxWaitWho: '',
  dueNullWhenFired: 0, dueBigWhenFired: 0, dueErr: [] as number[], urgent: 0, dueStuck: 0, longStuck: '' ,
  doubleFire: 0, tellFalse: 0, tellTotal: 0,
};
for (const bot of ['skilled', 'novice'] as BotKind[]) {
  for (const fight of STUDY_FIGHTS) {
    for (let s = 1; s <= seeds; s++) {
      const def = encounterDef(fight);
      const config: SimConfig = { seed: 500 + s, encounter: fight, ...kitConfig(kitById(defaultKit(def.movement ?? 1))), ...extra } as SimConfig;
      const sim = createSim(config);
      const b = makeBot(bot, 500 + s);
      stats.fights++;
      let lastOwn = -1e9;
      const wait = new Map<number, number>();
      const stuck = new Map<number, number>();
      const tell = new Map<number, number>(); // tick the tell first went loud
      for (let t = 0; t < 9 * 3600; t++) {
        const st = sim.state;
        // before-step snapshot
        const pre = st.party.map((id) => {
          const e = st.entities.get(id)!;
          return { id, solo: e.hero!.solo, cast: e.hero!.cast !== null, flourish: e.hero!.cast !== null && (e.hero!.cast as any).flourish === true,
            disabled: isDisabled(e as any), target: e.hero!.targetId, due: soloDueIn(st, e), active: e.hero!.soloActive, held: e.hero!.soloHeld,
            hp: e.health!.hp / e.health!.maxHp, inc: e.health!.incoming, soloId: e.hero!.soloId, grove: !!e.hero!.grove };
        });
        const cmds = b.decide(st);
        sim.step(cmds);
        const ev = sim.drainEvents();
        const fin = new Set<number>();
        for (const e of ev) if (e.type === 'finaleTurn') fin.add(e.hero);
        const cuedEv = ev.filter((e) => e.type === 'cued').length;
        let cuedStarts = 0;
        const startedThisTick = new Map<number, number>();
        for (const e of ev) {
          if (e.type !== 'soloStarted') continue;
          startedThisTick.set(e.hero, (startedThisTick.get(e.hero) ?? 0) + 1);
          if (fin.has(e.hero)) { stats.finale++; continue; }
          const p = pre.find((x) => x.id === e.hero)!;
          stats.solos++;
          if (e.cued) { stats.cued++; cuedStarts++; } else stats.plain++;
          if (p.cast) stats.castCancelled++;
          if (p.flourish) stats.flourishCancelled++;
          if (p.disabled) stats.firedDisabled++;
          if (p.target === null && !p.grove) { stats.noTarget++; console.log('NOTARGET', bot, fight, 500+s, p.soloId, 'hp', p.hp.toFixed(2), 'inc', p.inc.toFixed(0), 't', t, 'cued', e.cued, 'enemies', sim.state.entities.list().filter((x:any)=>x.enemy && x.health && !x.health.dead).length); }
          const urgent = p.soloId === 'aegisWall' && p.held < SOLOS.kaelHold - 0.05;
          if (urgent) stats.urgent++;
          if (!urgent && t - lastOwn < 60) stats.gapViolations++;
          lastOwn = t;
          if (!urgent) {
            if (p.due === null) stats.dueNullWhenFired++;
            else { stats.dueErr.push(p.due); if (p.due > 0.1) stats.dueBigWhenFired++; }
          }
          const w = sim.state.entities.get(sim.state.weaverId)!.weaver!;
          const slot = sim.state.party.indexOf(e.hero);
          if (!sim.state.mods.alwaysCued && e.cued !== (w.threadSlot === slot)) stats.cuedMismatch++;
        }
        for (const [, n] of startedThisTick) if (n > 1) stats.doubleFire++;
        if (cuedEv !== cuedStarts) stats.cuedEventMismatch++;
        for (const p of pre) {
          const e = sim.state.entities.get(p.id)!;
          const h = e.hero!;
          if (h.solo >= 100 && h.soloActive <= 0 && h.targetId !== null && !e.health!.downed && !isDisabled(e as any) && sim.state.encounter.status === 'fighting' && !sim.state.field.conducting?.finale) {
            const n = (wait.get(p.id) ?? 0) + 1; wait.set(p.id, n);
            if (n / 60 > stats.maxWait) { stats.maxWait = n / 60; stats.maxWaitWho = `${bot}/${fight}/${500 + s}/${h.defId}@${t}`; }
          } else wait.set(p.id, 0);
          // a loud tell that stands still
          const due = soloDueIn(sim.state, e);
          if (due !== null && h.solo >= 100) {
            const n = (stuck.get(p.id) ?? 0) + 1; stuck.set(p.id, n);
            if (n === 6 * 60) { console.log('STUCK', bot, fight, 500+s, h.defId, 't', t, 'target', h.targetId, 'st', e.health!.statuses.map((x:any)=>x.id).join(','), 'reel', !!h.reel, 'due', due, 'held', h.soloHeld.toFixed(2), 'finaleQ', !!sim.state.field.conducting?.finale); stats.dueStuck++; stats.longStuck = `${bot}/${fight}/${500 + s}/${h.defId}@${t} target=${h.targetId} dis=${isDisabled(e as any)} due=${due}`; }
          } else stuck.set(p.id, 0);
        }
        const status = sim.state.encounter.status;
        if (status === 'victory' || status === 'defeat') break;
      }
    }
  }
}
const errs = stats.dueErr; errs.sort((a, b) => a - b);
console.log({ ...stats, dueErr: errs.length ? { n: errs.length, p50: errs[errs.length >> 1], p90: errs[Math.floor(errs.length * 0.9)], max: errs[errs.length - 1] } : null });
