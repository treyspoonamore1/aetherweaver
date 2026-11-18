import { attackDef } from '/home/user/aw-work/wt-p11solo/src/content';
import { makeBot } from '/home/user/aw-work/wt-p11solo/src/bots';
import { createSim } from '/home/user/aw-work/wt-p11solo/src/sim';
import type { World } from '/home/user/aw-work/wt-p11solo/src/sim/world';
import { SCENARIO_VHARUN } from '/home/user/aw-work/wt-p11solo/tools/scenarios';
const s = SCENARIO_VHARUN;
const sim = createSim({ seed: s.seed, ...s.config, debug: true, dissonance: [{ id: 'tyrant', rank: 1 }], calling: { id: 'chronomancer', path: ['foresight'] } });
const w = sim.state as unknown as World;
const bot = makeBot('skilled', s.seed);
const seen = new Set<number>();
let promised: string | null = null; let last: string | null = null; let prev = '';
for (let t = 0; t < 90 * 60; t++) {
  sim.step(bot.decide(sim.state));
  const ev = sim.drainEvents();
  const b = w.encounter.bossId === null ? undefined : w.entities.get(w.encounter.bossId);
  if (!b?.enemy) continue;
  for (const e of ev) if (['bossPhase', 'stasisStart', 'crescendoStart', 'enemyInterrupted', 'tyrantHeld', 'soloStarted'].includes(e.type) && promised) console.log(' ', w.time.toFixed(2), e.type, JSON.stringify(e).slice(0, 120));
  for (const tg of w.telegraphs) {
    if (seen.has(tg.id) || tg.owner !== b.id) continue;
    seen.add(tg.id);
    if (b.enemy.cast?.telegraph !== tg.id) continue;
    const chained = last !== null && attackDef(last).followUp?.attack === tg.attackId;
    last = tg.attackId;
    if (promised !== null && !chained) { if (promised !== tg.attackId) console.log(w.time.toFixed(2), 'PROMISED', promised, 'BEGAN', tg.attackId, 'phase', b.enemy.phase, 'tyrant', JSON.stringify(b.enemy.tyrant)); promised = null; }
  }
  const now = b.enemy.foreseen;
  const cur = JSON.stringify(now ?? null);
  if (cur !== prev && (now?.special === -2 || promised)) console.log(' ', w.time.toFixed(2), 'foreseen', cur.slice(0, 140));
  prev = cur;
  if (now && now.special === -2) promised = now.attackId;
}
