/**
 * CONTRACT v3 — Commands are the only way into the simulation (docs/plan/05 §4.4).
 *
 * The input layer, bots and replays all produce `Command`s. Each tick consumes a list of
 * commands; a replay is just (config, per-tick command lists). Commands are plain JSON data
 * and are normalised at the boundary (normalize.ts). Change this file deliberately: it
 * versions every replay. `replay.ts` keeps a zod schema that must match this type exactly
 * (checked at compile time).
 */

/** Party slot index (0-based). Heroes are referenced by slot in input-facing commands. */
export type PartySlot = 0 | 1 | 2 | 3;
export const PARTY_SLOTS: readonly PartySlot[] = [0, 1, 2, 3];

export interface Vec2 {
  x: number;
  z: number;
}

/** Weaver techniques cast with `tech` (docs/plan/03 §1). Glide has its own command. */
export type TechniqueId = 'ward' | 'chime' | 'reel';

export type DirectiveKind = 'focus' | 'rally' | 'hold' | 'scatter';

/** Debug-only commands. Ignored unless `SimConfig.debug` is true. Recorded like any other. */
export type DebugOp =
  | { op: 'spawnDummies'; count: number }
  | { op: 'clearDummies' }
  | { op: 'teleportWeaver'; x: number; z: number }
  | { op: 'spawnEnemy'; defId: string; x: number; z: number; elite?: boolean }
  | { op: 'killEnemies' }
  | { op: 'setResonance'; value: number }
  | { op: 'healParty' }
  /** Fill every hero's Solo charge (stage Cues). */
  | { op: 'chargeSolos' }
  /** Set the boss's HP to a fraction of its max (stage boss phases). */
  | { op: 'setBossHp'; pct: number }
  /** Make the hero in `slot` call for support now (stage Call and Response). */
  | { op: 'forceCall'; slot: PartySlot }
  /** Catch a lethal hit on the hero in `slot` with a Fermata hold (stage holds). */
  | { op: 'forceHold'; slot: PartySlot }
  /**
   * The Perfect-Ward trainer (docs/phase-4g.md): a training bell telegraphs one blow at the hero
   * in `slot`, landing after `windup` seconds (0.5–3). It can't be dodged, and a Ward answers it.
   */
  | { op: 'drill'; slot: PartySlot; windup: number };

export type Command =
  /** Movement intent, |(x, z)| ≤ 1. Persists until the next `move` (send on change only). */
  | { t: 'move'; x: number; z: number }
  /** World-space aim point under the cursor. Persists until the next `aim`. */
  | { t: 'aim'; x: number; z: number }
  /** Attach / retarget the Thread to a hero. */
  | { t: 'thread'; slot: PartySlot }
  /**
   * Toggle the Thread between Mend and Empower (from Bear: back to the mode Bear left). With
   * `mode: 'bear'`, Bear on and off (the Martyr only; otherwise refused).
   */
  | { t: 'mode'; mode?: 'bear' }
  /**
   * Cast a technique. Ward and Reel target a hero (`slot`, else the threaded hero);
   * Chime lands at `point` (snapped to a hovered hero by the input layer).
   */
  | { t: 'tech'; id: TechniqueId; slot?: PartySlot; point?: Vec2 }
  /** Glide (dash) in a direction. */
  | { t: 'glide'; x: number; z: number }
  /** Fire a hero's Solo (costs one Resonance segment). */
  | { t: 'cue'; slot: PartySlot }
  /** Spend 100 Resonance on the Crescendo. */
  | { t: 'crescendo' }
  /** Party command. `target` is an enemy entity id (Focus), `point` a location. */
  | { t: 'directive'; kind: DirectiveKind; target?: number; point?: Vec2 }
  /** Plant the Pedal Point Chord's field at `point` (pulled in to the planting range). */
  | { t: 'plant'; point: Vec2 }
  | { t: 'debug'; op: DebugOp };

export type CommandType = Command['t'];
