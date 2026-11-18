import { describe, it } from 'vitest';
import { threadCues, type Command, type Sim } from '/home/user/aw-work/wt-p11solo-review/src/sim';
import { addStatus, dealDamage } from '/home/user/aw-work/wt-p11solo-review/src/sim/combat/health';
import { spawnEnemy } from '/home/user/aw-work/wt-p11solo-review/src/sim/systems/enemies';
import { soloTell } from '/home/user/aw-work/wt-p11solo-review/src/ui/hudBridge';
import { ofType, sandbox, stepFor, worldOf } from '/home/user/aw-work/wt-p11solo-review/tests/sim/helpers';

describe('Oro', () => {
  for (const solo of ['homecoming', 'wildgrowth']) it(`${solo}: every Sapling felled, an enemy on the field, the Thread on Oro`, () => {
    const sim = sandbox({ party: ['kael', 'vexis', 'oro'], ...(solo === 'homecoming' ? { bonds: { talents: [], solos: ['homecoming'] } } : {}) } as any);
    const w = worldOf(sim);
    const oro = w.entities.get(w.party[2]!)!;
    for (const slot of [0, 1]) { const h = w.entities.get(w.party[slot]!)!; addStatus(w, h, 'stun', 1e6, null); h.health!.hp = h.health!.maxHp = 1e6; }
    const foe = spawnEnemy(w, 'hollow_chorister', oro.x + 3, oro.z, { instant: true }); w.entities.flush(); foe.enemy!.engaged = true; foe.health!.hp = foe.health!.maxHp = 1e6;
    for (const id of oro.hero!.grove!.saplings) dealDamage(w, w.entities.get(id)!, { source: null, sourceName: 'test', amount: 1e6 });
    oro.hero!.solo = 100; oro.hero!.engaged = true;
    const log: string[] = [];
    let stood = -1;
    for (let t = 0; t < 40 * 60; t++) {
      oro.health!.hp = oro.health!.maxHp;
      const ev = stepFor(sim, 1, t === 0 ? [{ t: 'thread', slot: 2 }] : []);
      const alive = oro.hero!.grove!.saplings.map((id) => w.entities.get(id)).filter((s) => s && !s.health!.dead).length;
      if (alive > 0 && stood < 0) { stood = t; log.push(`a Sapling stands again at ${(t / 60).toFixed(1)} s (${ev.filter((e) => e.type === 'abilityUsed').map((e: any) => e.name).join(',')})`); }
      for (const e of ofType(ev, 'soloStarted')) log.push(`Solo fires at ${(t / 60).toFixed(1)} s: ${e.solo} cued=${e.cued}`);
      if (t === 300) { const tell = soloTell(sim.state, oro); log.push(`at 5 s: strip soloIn=${tell.soloIn} now=${tell.soloNow} willCue=${tell.willCue} target=${oro.hero!.targetId} Solo ${oro.hero!.solo}`); }
      if (log.some((l) => l.startsWith('Solo fires'))) break;
    }
    console.log(solo, '->', log.join(' ; ') || 'never fired in 40 s');
  });
});
