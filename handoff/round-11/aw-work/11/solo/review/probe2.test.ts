import { describe, expect, it } from 'vitest';
const R = '/home/user/aw-work/wt-p11solo-review';
import { soloDueIn, threadCues, type Command, type Sim, type SimConfig } from '/home/user/aw-work/wt-p11solo-review/src/sim';
import { SIM_HZ, SOLOS } from '/home/user/aw-work/wt-p11solo-review/src/sim/constants';
import { addStatus, dealDamage } from '/home/user/aw-work/wt-p11solo-review/src/sim/combat/health';
import { spawnEnemy } from '/home/user/aw-work/wt-p11solo-review/src/sim/systems/enemies';
import { soloTell, buildHudSnapshot } from '/home/user/aw-work/wt-p11solo-review/src/ui/hudBridge';
import { autoSoloTarget } from '/home/user/aw-work/wt-p11solo-review/src/input/InputController';
import { hero, ofType, sandbox, spawn, stepFor, stepUntil, worldOf } from '/home/user/aw-work/wt-p11solo-review/tests/sim/helpers';

const CHARGE: Command = { t: 'debug', op: { op: 'chargeSolos' } };
const thread = (slot: 0 | 1 | 2): Command => ({ t: 'thread', slot });
function fight(config: Partial<SimConfig> = {}): Sim {
  const sim = sandbox(config);
  const k = hero(sim, 0);
  stepFor(sim, 1, [spawn('bell_brute', k.x, k.z - 4)]);
  for (const e of worldOf(sim).entities.list()) if (e.enemy && e.health) e.health.hp = e.health.maxHp = 1e6;
  stepUntil(sim, () => [0, 1, 2].every((s) => hero(sim, s).hero!.targetId !== null));
  return sim;
}
function topUp(sim: Sim) { for (const s of [0,1,2]) { const h = worldOf(sim).entities.get(sim.state.party[s]!)!.health!; h.hp = h.maxHp; } }
function solos(sim: Sim, ticks: number, cmds: (t: number) => Command[] = () => [], keepFull = true) {
  const out: string[] = [];
  for (let t = 0; t < ticks; t++) {
    if (keepFull) topUp(sim);
    const ev = stepFor(sim, 1, cmds(t));
    for (const e of ev) {
      if (e.type === 'soloStarted') out.push(`${t}:start:${sim.state.party.indexOf(e.hero)}:${e.cued ? 'cued' : 'plain'}`);
      if (e.type === 'finaleTurn') out.push(`${t}:finaleTurn:${sim.state.party.indexOf(e.hero)}`);
      if (e.type === 'finaleTurnLost') out.push(`${t}:turnLost:${sim.state.party.indexOf(e.hero)}:${e.reason}`);
      if (e.type === 'cueChained') out.push(`${t}:chain:${e.link}:beat=${e.onBeat}:paid=${e.paid}`);
      if (e.type === 'finaleEnded') out.push(`${t}:finaleEnded`);
      if (e.type === 'cued') out.push(`${t}:cuedEv:${sim.state.party.indexOf(e.hero)}`);
    }
  }
  return out;
}

describe('probes', () => {
  it('P1 a stunned hero with a full Solo: the tell stands at 1.0 and says "now"', () => {
    const sim = fight();
    const w = worldOf(sim);
    const lyra = w.entities.get(w.party[1]!)!;
    lyra.hero!.solo = 100;
    addStatus(w, lyra, 'stun', 5, null);
    const seen: (number | null | undefined)[] = [];
    for (let t = 0; t < 240; t++) { topUp(sim); stepFor(sim, 1); if (t % 60 === 59) seen.push(soloTell(sim.state, lyra).soloIn); }
    console.log('P1 stunned Lyra soloIn each second:', seen, 'soloNow', soloTell(sim.state, lyra).soloNow, 'soloActive', lyra.hero!.soloActive);
  });

  it('P2 Oro, Homecoming, every Sapling felled, an enemy on the field, no Focus: does it ever fire?', () => {
    const sim = sandbox({ party: ['kael', 'vexis', 'oro'], bonds: { talents: [], solos: ['homecoming'] } } as any);
    const w = worldOf(sim);
    const oro = w.entities.get(w.party[2]!)!;
    for (const slot of [0, 1]) { const h = w.entities.get(w.party[slot]!)!; addStatus(w, h, 'stun', 1e6, null); h.health!.hp = h.health!.maxHp = 1e6; }
    const foe = spawnEnemy(w, 'hollow_chorister', oro.x + 3, oro.z, { instant: true }); w.entities.flush(); foe.enemy!.engaged = true; foe.health!.hp = foe.health!.maxHp = 1e6;
    for (const id of oro.hero!.grove!.saplings) dealDamage(w, w.entities.get(id)!, { source: null, sourceName: 'test', amount: 1e6 });
    oro.hero!.solo = 100; oro.hero!.engaged = true;
    let fired = 0; const tells: any[] = [];
    for (let t = 0; t < 30 * 60; t++) {
      oro.health!.hp = oro.health!.maxHp; oro.hero!.abilityCooldowns[0] = oro.hero!.abilityCooldowns[1] = 99; // no Regrowth: the Solo is what would bring them back
      const ev = stepFor(sim, 1, t === 0 ? [thread(2)] : []);
      fired += ofType(ev, 'soloStarted').length;
      if (t % 300 === 299) tells.push({ s: (t + 1) / 60, soloIn: soloTell(sim.state, oro).soloIn, now: soloTell(sim.state, oro).soloNow, target: oro.hero!.targetId, solo: oro.hero!.solo, willCue: threadCues(sim.state, oro) });
    }
    console.log('P2 Homecoming with no Sapling standing, 30 s, Thread on Oro: fired', fired, JSON.stringify(tells));
    // and with a Focus given?
    const ev = stepFor(sim, 200, [{ t: 'directive', kind: 'focus', target: foe.id } as any]);
    console.log('P2 after a Focus:', ofType(ev, 'soloStarted').map((e) => `${e.solo} cued=${e.cued}`));
  });

  it('P3 Kael hurt during the Grand Finale with his turn still to come', () => {
    const sim = fight({ calling: { id: 'conductor', path: ['marcato', 'reprise', 'ensemble', 'triad'] } } as any);
    const w = worldOf(sim);
    stepFor(sim, 1, [CHARGE, { t: 'debug', op: { op: 'setResonance', value: 100 } }]);
    const kael = w.entities.get(w.party[0]!)!;
    const log: string[] = [];
    // Vexis and Lyra first? The queue is party order: Kael first. Make Kael wait: he is mid-Solo.
    const out = solos(sim, 1, () => [{ t: 'crescendo' }]);
    log.push(...out);
    // now hurt Kael each tick below half
    for (let t = 1; t < 15 * 60; t++) {
      for (const s of [1, 2]) { const h = w.entities.get(w.party[s]!)!.health!; h.hp = h.maxHp; }
      kael.health!.hp = kael.health!.maxHp * 0.4;
      log.push(...solos(sim, 1, () => [], false).map((x) => `${t}+${x}`));
    }
    console.log('P3', log.join(' | '));
  });

  it('P4 the Finale ends: three full Solos, a Thread that follows each', () => {
    const sim = fight({ calling: { id: 'conductor', path: ['marcato', 'reprise', 'ensemble', 'triad'] } } as any);
    stepFor(sim, 1, [CHARGE, { t: 'debug', op: { op: 'setResonance', value: 100 } }]);
    const out = solos(sim, 30 * 60, (t) => (t === 0 ? [{ t: 'crescendo' }] : []));
    console.log('P4 no Thread:', out.join(' | '));
  });

  it('P5 Hollow Crown: every Solo Cued with no Thread, the Weaver down; chains', () => {
    const sim = fight({ relics: [{ id: 'hollow_crown' }], calling: { id: 'conductor', path: [] } } as any);
    const out = solos(sim, 8 * 60, (t) => (t === 0 ? [CHARGE] : []));
    const led = sim.state.ledger;
    console.log('P5 Hollow Crown + Conductor, no Thread at all:', out.join(' | '), 'cues', led.cues, 'duets', led.conducting?.duets, 'trios', led.conducting?.trios);
  });

  it('P6 Silent Cues: the Thread arrives N ticks before the Solo fires', () => {
    const res: string[] = [];
    for (const before of [58, 59, 60, 61, 62]) {
      const sim = fight({ dissonance: [{ id: 'silent_cues', rank: 1 }] } as any);
      const w = worldOf(sim);
      w.entities.get(w.party[1]!)!.hero!.solo = 100; // Lyra only
      // Lyra fires 59 ticks after the tick she is full (measured above). Thread arrives `before` ticks before that step.
      const fireAt = 59;
      const out = solos(sim, 80, (t) => (t === fireAt - before + 1 ? [thread(1)] : []));
      res.push(`thread ${before} ticks before the firing tick -> ${out.filter((x) => x.includes('start')).join(',')}`);
    }
    console.log('P6\n' + res.join('\n'));
  });

  it('P7 A Tempo: when do they fire, and what does soloDueIn say', () => {
    const sim = fight({ calling: { id: 'conductor', path: ['a_tempo'] } } as any);
    const w = worldOf(sim);
    const log: string[] = [];
    let lastDue: (number | null)[] = [];
    for (let t = 0; t < 14 * 60; t++) {
      topUp(sim);
      const pre = [0, 1, 2].map((s) => soloDueIn(sim.state, hero(sim, s)));
      const ev = stepFor(sim, 1, t === 0 ? [CHARGE, thread(1)] : []);
      for (const e of ev) if (e.type === 'soloStarted') { const s = sim.state.party.indexOf(e.hero); log.push(`t=${t} time=${sim.state.time.toFixed(3)} slot ${s} ${e.cued ? 'cued' : 'plain'} dueSaidTickBefore=${pre[s]?.toFixed(3)} beatPhase=${((sim.state.time % (60 / 88 * 4))).toFixed(3)}`); }
      for (const e of ev) if (e.type === 'cueChained') log.push(`   chain link=${e.link} onBeat=${e.onBeat} paid=${e.paid}`);
    }
    console.log('P7\n' + log.join('\n'), '\nresonance', w.entities.get(w.weaverId)!.weaver!.resonance, 'ledger', JSON.stringify(sim.state.ledger.conducting));
  });

  it('P8 Kael, wall full, under half life, no enemy on the field', () => {
    const sim = sandbox();
    const w = worldOf(sim);
    const kael = w.entities.get(w.party[0]!)!;
    stepFor(sim, 30);
    kael.hero!.solo = 100; kael.health!.hp = kael.health!.maxHp * 0.45;
    const ev = stepFor(sim, 5);
    console.log('P8 status', sim.state.encounter.status, 'enemies', w.entities.list().filter((e) => e.enemy).length, 'fired', ofType(ev, 'soloStarted').map((e) => e.solo));
  });
});
