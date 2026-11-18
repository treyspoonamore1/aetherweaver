/**
 * Resonance (docs/plan/02 §4): earned by answering threats well, spent on the Crescendo (a full
 * song: the whole meter, 200) and on nothing else (a Cue costs nothing: docs/solos.md). Partial segments decay when
 * idle; filled segments are kept. Nothing is gained or lost during a Crescendo.
 */
import { CONTENT } from '../../content';
import type { WorldState } from '../state';
import type { World } from '../world';
import { tenutoDelay } from '../fill/finale';

/**
 * What every Resonance gain is multiplied by this fight: the fight's "more Resonance" (Standing
 * Ovation, the Conductor), times the content's `gainScale`, which is 1 (the gains are written as
 * what they give; the Solo study varies it for a run). For the sim, and for the views and tests
 * that say what a gain adds to the meter.
 */
export function resonanceScale(state: WorldState): number {
  return CONTENT.resonance.gainScale * state.mods.resonanceMult;
}

/** `silent` skips the event (passive trickles like Empower would otherwise fire every tick). */
export function gainResonance(world: World, amount: number, reason: string, silent = false): void {
  const w = world.entities.get(world.weaverId)?.weaver;
  if (!w || amount <= 0 || w.crescendo > 0) return;
  const max = world.content.resonance.max;
  const before = w.resonance;
  const scale = world.content.resonance.gainScale * world.mods.resonanceMult;
  w.resonance = Math.min(max, w.resonance + amount * scale);
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

/** The Crescendo's price: the only thing Resonance is spent on. */
export function spendResonance(world: World, amount: number): boolean {
  const w = world.entities.get(world.weaverId)?.weaver;
  if (!w || w.resonance + 1e-9 < amount) return false;
  w.resonance = Math.max(0, w.resonance - amount);
  world.events.push({
    type: 'resonanceSpent',
    tick: world.tick,
    amount,
    total: w.resonance,
    on: 'crescendo',
  });
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
  const keep = Math.floor(w.resonance / def.segment + 1e-9) * def.segment;
  if (w.resonance > keep) w.resonance = Math.max(keep, w.resonance - def.decayPerSec * dt);
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
