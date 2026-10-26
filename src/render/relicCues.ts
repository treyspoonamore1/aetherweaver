/**
 * Relics as render sees them (docs/phase-3b/vfx.md). Pure helpers, no three.js, so the event →
 * visual mapping, the Prism Loom's reach and the relic charge timers are testable in Node
 * against the real sim.
 *
 * Everything is read from `WorldState.relics`, the `relicTriggered` / `techniqueRejected`
 * events and the Thread's state. Numbers come from content (`relic.values`), never hard-coded,
 * so the lead's tuning shows up without render changes.
 */
import { CONTENT } from '../content';
import type { EntityId, SimEvent, WorldState } from '../sim';

/** The relic moments render draws (one per `relicTriggered` relic, plus Heavy Score's curse). */
export type RelicCue =
  'thimble' | 'lantern' | 'veil' | 'metronome' | 'fork' | 'halo' | 'hymnal' | 'heavy';

export const RELIC_CUES: readonly RelicCue[] = [
  'thimble',
  'lantern',
  'veil',
  'metronome',
  'fork',
  'halo',
  'hymnal',
  'heavy',
];

/** `relicTriggered.relic` → the moment it plays. */
export const CUE_OF_RELIC: Readonly<Record<string, RelicCue>> = {
  silver_thimble: 'thimble',
  lantern_of_the_lost: 'lantern',
  martyrs_veil: 'veil',
  cracked_metronome: 'metronome',
  tuning_fork: 'fork',
  glass_halo: 'halo',
  cantors_hymnal: 'hymnal',
  heavy_score: 'heavy',
};

/**
 * The moment an event plays, if any: every `relicTriggered` the sim sends, and a Glide refused
 * because it is `'locked'` (Heavy Score's curse is the only lock on Glide).
 */
export function relicCue(e: SimEvent): RelicCue | null {
  if (e.type === 'relicTriggered') return CUE_OF_RELIC[e.relic] ?? null;
  if (e.type === 'techniqueRejected' && e.technique === 'glide' && e.reason === 'locked')
    return 'heavy';
  return null;
}

/** A relic's content value (`values[key]`), or `fallback` for an unknown relic or key. */
export function relicValue(id: string, key: string, fallback: number): number {
  const v = CONTENT.relics.find((r) => r.id === id)?.values[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

export function carries(state: WorldState, id: string): boolean {
  return state.relics.ids.includes(id);
}

/**
 * A rate-limited relic's charge: null without it, 1 when ready, otherwise how far it has wound
 * back up (0..1) from `readyAt` and its content `cooldown`.
 */
export function relicCharge(readyAt: number | null, time: number, cooldown: number): number | null {
  if (readyAt === null) return null;
  if (time >= readyAt) return 1;
  const left = (readyAt - time) / Math.max(0.01, cooldown);
  return Math.max(0, Math.min(0.999, 1 - left));
}

/** The Cracked Metronome's charge (1 = the next telegraphed Ward is a free Perfect). */
export function metronomeCharge(state: WorldState): number | null {
  return relicCharge(
    state.relics.metronomeAt,
    state.time,
    relicValue('cracked_metronome', 'cooldown', 12),
  );
}

/** The Silver Thimble's charge (1 = the next hero you thread gets a shield). */
export function thimbleCharge(state: WorldState): number | null {
  return relicCharge(
    state.relics.thimbleAt,
    state.time,
    relicValue('silver_thimble', 'cooldown', 4),
  );
}

/** Full-screen-free "flash" scale for bright in-world flares (`settings.flashes` 0..1). */
export function flareScale(flashes: number): number {
  const f = flashes < 0 ? 0 : flashes > 1 ? 1 : flashes;
  return 0.35 + 0.65 * f;
}

// ── Prism Loom ────────────────────────────────────────────────────────────────────────

export interface PrismLink {
  hero: EntityId;
  slot: number;
  /** The share of the Thread this hero gets right now (the sim's `threadPotency`). */
  potency: number;
}

/**
 * Who the Prism Loom reaches this frame, mirroring the sim's `threadPotency`: with the Weaver
 * up and a hero threaded and standing, every other standing hero whose centre is within
 * `radius + their radius` of the threaded one gets `potency × pct` of the Thread, where the
 * Thread's own potency falls with tension to `tautPotency`. Reused every frame (no allocation).
 */
export class PrismScan {
  readonly radius = relicValue('prism_loom', 'radius', 4);
  readonly pct = relicValue('prism_loom', 'pct', 50) / 100;
  /** False without the relic: nothing else is filled in. */
  carried = false;
  threaded: EntityId | null = null;
  threadedSlot = -1;
  mode: 'mend' | 'empower' = 'mend';
  /** The main Thread's potency on the threaded hero. */
  base = 0;
  count = 0;
  readonly links: PrismLink[] = [0, 1, 2, 3, 4, 5].map(() => ({ hero: -1, slot: -1, potency: 0 }));

  scan(state: WorldState): this {
    this.count = 0;
    this.threaded = null;
    this.threadedSlot = -1;
    this.base = 0;
    this.carried = carries(state, 'prism_loom');
    if (!this.carried) return this;
    const weaver = state.entities.get(state.weaverId);
    const w = weaver?.weaver;
    // The Prism Loom spreads Mend and Empower; Bear (the Martyr) has nothing to spread.
    if (!w || !weaver.health || weaver.health.downed || w.threadSlot === null) return this;
    if (w.threadMode === 'bear') return this;
    this.mode = w.threadMode;
    const threadedId = state.party[w.threadSlot];
    const threaded = threadedId === undefined ? undefined : state.entities.get(threadedId);
    if (!threaded?.health || threaded.health.dead || threaded.health.downed) return this;
    this.threaded = threaded.id;
    this.threadedSlot = w.threadSlot;
    this.base = 1 - w.threadTension * (1 - CONTENT.thread.tautPotency);
    for (let slot = 0; slot < state.party.length; slot++) {
      const id = state.party[slot]!;
      if (id === threaded.id || this.count >= this.links.length) continue;
      const other = state.entities.get(id);
      if (!other?.health || other.health.dead || other.health.downed) continue;
      const r = this.radius + other.radius;
      const dx = other.x - threaded.x;
      const dz = other.z - threaded.z;
      if (dx * dx + dz * dz > r * r) continue;
      const link = this.links[this.count++]!;
      link.hero = id;
      link.slot = slot;
      link.potency = this.base * this.pct;
    }
    return this;
  }

  /** The Prism share `id` gets this frame (0 when outside or not carried). */
  potencyOf(id: EntityId): number {
    for (let i = 0; i < this.count; i++)
      if (this.links[i]!.hero === id) return this.links[i]!.potency;
    return 0;
  }
}
