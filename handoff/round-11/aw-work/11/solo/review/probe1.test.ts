import { describe, expect, it } from 'vitest';
import { soloDueIn, threadCues, type Command, type Sim, type SimEvent } from '/home/user/aw-work/wt-p11solo-review/src/sim';
import { SIM_HZ, SOLOS } from '/home/user/aw-work/wt-p11solo-review/src/sim/constants';
import { hero, ofType, sandbox, spawn, stepFor, stepUntil, worldOf } from '/home/user/aw-work/wt-p11solo-review/tests/sim/helpers';

const CHARGE: Command = { t: 'debug', op: { op: 'chargeSolos' } };
const thread = (slot: 0 | 1 | 2): Command => ({ t: 'thread', slot });
function fight(config: Parameters<typeof sandbox>[0] = {}): Sim {
  const sim = sandbox(config);
  const k = hero(sim, 0);
  stepFor(sim, 1, [spawn('bell_brute', k.x, k.z - 4)]);
  for (const e of worldOf(sim).entities.list()) if (e.enemy && e.health) e.health.hp = e.health.maxHp = 1e6;
  stepUntil(sim, () => [0, 1, 2].every((s) => hero(sim, s).hero!.targetId !== null));
  return sim;
}
function topUp(sim: Sim) { for (const s of [0,1,2]) { const h = worldOf(sim).entities.get(sim.state.party[s]!)!.health!; h.hp = h.maxHp; } }

describe('probe', () => {
  it('exact ticks', () => {
    const sim = fight();
    const log: string[] = [];
    for (let t = 0; t < 400; t++) {
      topUp(sim);
      const ev = stepFor(sim, 1, t === 0 ? [CHARGE] : []);
      for (const e of ev) if (e.type === 'soloStarted' || e.type === 'soloReady') log.push(`${t} ${e.type} ${sim.state.party.indexOf(e.hero)} ${(e as any).cued ?? ''}`);
      if (t < 3 || (t > 55 && t < 63)) log.push(`  t=${t} due=${[0,1,2].map(s => soloDueIn(sim.state, hero(sim, s))?.toFixed(4)).join(',')} held=${[0,1,2].map(s=>hero(sim,s).hero!.soloHeld.toFixed(6)).join(',')}`);
    }
    console.log(log.join('\n'));
  });
});
