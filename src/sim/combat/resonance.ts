/**
 * Resonance (docs/plan/02 §4): earned by answering threats well, spent on Cues (one
 * segment) and the Crescendo (a full song). Partial segments decay when idle; filled
 * segments are kept. Nothing is gained or lost during a Crescendo.
 */
import type { World } from '../world';

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
  const def = world.content.resonance;
  w.resonanceIdle += dt;
  if (w.resonanceIdle < def.decayDelay) return;
  const floor = Math.floor(w.resonance / def.segment + 1e-9) * def.segment;
  if (w.resonance > floor) w.resonance = Math.max(floor, w.resonance - def.decayPerSec * dt);
}
