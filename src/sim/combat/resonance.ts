/**
 * Resonance (docs/plan/02 §4): earned by answering threats well, spent on Cues (one
 * segment) and the Crescendo (a full song). Partial segments decay when idle; filled
 * segments are kept. Nothing is gained or lost during a Crescendo.
 */
import type { WorldState } from '../state';
import type { World } from '../world';
import { tenutoDelay } from '../fill/finale';

/** `silent` skips the event (passive trickles like Empower would otherwise fire every tick). */
export function gainResonance(world: World, amount: number, reason: string, silent = false): void {
  const w = world.entities.get(world.weaverId)?.weaver;
  if (!w || amount <= 0 || w.crescendo > 0) return;
  const max = world.content.resonance.max;
  const before = w.resonance;
  w.resonance = Math.min(max, w.resonance + amount * world.mods.resonanceMult);
  w.resonanceIdle = 0;
  const gained = w.resonance - before;
  if (gained > 0 && !silent) {
    world.events.push({
      type: 'resonanceGained',
      tick: world.tick,
      amount: gained,
      reason,
      total: w.resonance,
    });
  }
}

export function spendResonance(world: World, amount: number, on: 'cue' | 'crescendo'): boolean {
  const w = world.entities.get(world.weaverId)?.weaver;
  if (!w || w.resonance + 1e-9 < amount) return false;
  w.resonance = Math.max(0, w.resonance - amount);
  world.events.push({ type: 'resonanceSpent', tick: world.tick, amount, total: w.resonance, on });
  return true;
}

export function decayResonance(world: World, dt: number): void {
  const w = world.entities.get(world.weaverId)?.weaver;
  if (!w || w.crescendo > 0) return;
  // Triad (the Conductor, docs/phase-5f.md): while it holds, nothing fades and the idle clock waits.
  if (world.mods.triadCount > 0 && triadHolds(world)) {
    w.resonanceIdle = 0;
    return;
  }
  const def = world.content.resonance;
  w.resonanceIdle += dt;
  if (w.resonanceIdle < def.decayDelay) return;
  // Phase 5g (N16): Tenuto holds the fade back longer (fill/finale.ts).
  if (world.mods.fadeDelay > 0 && w.resonanceIdle < def.decayDelay + tenutoDelay(world)) return;
  const floor = Math.floor(w.resonance / def.segment + 1e-9) * def.segment;
  // The Conductor keeps whole Cues too (docs/phase-5f.md, decision 7).
  const keep = world.mods.cueKeepsWhole ? Math.max(floor, wholeCues(world, w.resonance)) : floor;
  if (w.resonance > keep) w.resonance = Math.max(keep, w.resonance - def.decayPerSec * dt);
}

/**
 * The Conductor's fade floor (docs/phase-5f.md): `resonance` rounded down to whole off-beat Cues
 * (the fight's `dissonance.cueCost`: 15, or 25 with Silent Cues).
 */
export function wholeCues(world: World, resonance: number): number {
  const cue = world.dissonance.cueCost;
  if (!(cue > 0)) return 0;
  return Math.floor(resonance / cue + 1e-9) * cue;
}

/**
 * Triad (the Conductor's keystone, docs/phase-5f.md): on the path, and at least its count of
 * standing heroes are in the Weaver's field (`hero.inField`: read, never written). Oro's
 * Saplings are not heroes. Re-exported by systems/conducting.ts for the views and bots.
 */
export function triadHolds(state: WorldState): boolean {
  const need = state.mods.triadCount;
  if (!(need > 0)) return false;
  let n = 0;
  for (const id of state.party) {
    const e = state.entities.get(id);
    if (e?.hero?.inField && e.health && !e.health.dead && !e.health.downed) n++;
  }
  return n >= need;
}
