/** Ledger sampling: party HP over time for the result timeline (every half second). */
import type { World } from '../world';

const SAMPLE = 0.5;

export function updateLedger(world: World): void {
  const enc = world.encounter;
  if (enc.status !== 'fighting') return;
  if (world.time < world.internal.ledgerSampleAt) return;
  world.internal.ledgerSampleAt = world.time + SAMPLE;
  const hp: number[] = [];
  for (const id of world.party) {
    const h = world.entities.get(id)?.health;
    hp.push(h && !h.downed ? Math.round((h.hp / h.maxHp) * 1000) / 1000 : 0);
  }
  world.ledger.timeline.push({ time: Math.round((world.time - enc.startedAt) * 100) / 100, hp });
}
