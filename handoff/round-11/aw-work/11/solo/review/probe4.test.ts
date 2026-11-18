import { describe, it } from 'vitest';
import { soloDueIn, type Command, type Sim, type SimConfig } from '/home/user/aw-work/wt-p11solo-review/src/sim';
import { buildHudSnapshot } from '/home/user/aw-work/wt-p11solo-review/src/ui/hudBridge';
import { hero, ofType, sandbox, spawn, stepFor, stepUntil, worldOf } from '/home/user/aw-work/wt-p11solo-review/tests/sim/helpers';

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

describe('the Conductor badge against what the Solo turns out to be', () => {
  it('badge says Duet for a Solo due after the chain has closed', () => {
    const sim = fight({ calling: { id: 'conductor', path: [] } } as any);
    const w = worldOf(sim);
    const lyra = w.entities.get(w.party[1]!)!; const vexis = w.entities.get(w.party[2]!)!; const kael = w.entities.get(w.party[0]!)!;
    lyra.hero!.solo = 100;
    let t = 0; let cuedAt = -1;
    const log: string[] = [];
    for (; t < 20 * 60; t++) {
      topUp(sim); kael.hero!.solo = 0;
      const ev = stepFor(sim, 1, t === 0 ? [thread(1)] : cuedAt >= 0 && t === cuedAt + 30 ? [thread(2)] : []);
      for (const e of ev) {
        if (e.type === 'cueChained') log.push(`t=${t} ${sim.state.party.indexOf(e.hero)} Cued: link ${e.link}`);
        if (e.type === 'soloStarted' && sim.state.party.indexOf(e.hero) === 1 && cuedAt < 0) { cuedAt = t; }
      }
      if (cuedAt >= 0 && t === cuedAt + 90) {
        // 1.5 s into the 4 s window: Vexis will be full in 2 s, so due in 3 s; the window has 2.5 s left.
        vexis.hero!.solo = 0; stepFor(sim, 1); const d0 = vexis.hero!.solo; vexis.hero!.solo = 100 - d0 * 120;
      }
      if (cuedAt >= 0 && t > cuedAt + 90 && (t - cuedAt) % 30 === 0 && vexis.hero!.soloActive <= 0) {
        const hud = buildHudSnapshot(sim.state, { seed: 7, hovered: null });
        const v = (hud as any).party[2]!;
        const chain = (hud as any).conducting?.chain;
        log.push(`t=${t} Vexis soloIn=${v.soloIn?.toFixed(2)} willCue=${v.willCue} badge=${v.cue?.label ?? '-'} chainLeft=${chain ? chain.left.toFixed(2) : 'closed'}`);
      }
      if (cuedAt >= 0 && t > cuedAt + 400) break;
    }
    console.log(log.join('\n'));
  });
});
