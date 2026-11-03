import type { ArenaDef, EnemyDef } from '../content';
import { attackDef, enemyDef } from '../content';
import type { EntityId, ReadonlyEntity, WorldState } from '../sim';

/**
 * Movement II, the Crimson Legion (docs/phase-5a.md, Presentation; docs/phase-5a/vfx-audio.md):
 * what render reads from the state for the Legion's statuses, guard arcs, Sanctuary pools, Blood
 * Pacts and Executions, and the colours it draws them in. Everything here is pure (tests, the
 * lab). Every key it reads is absent in Movement I, so nothing here draws there.
 */

/**
 * The new semantic colours. Each is ΔE ≥ 20 from lethal, threat, the Martyr's Bear, Mend and
 * Empower under every colour-vision palette (tests/renderMovement2.test.ts). Bleed, Wound and
 * Latched are ailments and draw in the live ailment violet (`C.ailment`); the Sanctuary pools
 * draw in the live heal teal and gold: neither is a new colour.
 */
export const CRIMSON_HEX = {
  /** Blood Pact's link tint and its '+20%' (a bruised plum: never lethal red, never Bear). */
  pact: '#9d4f8a',
  /** The Crimson Sentinel's guard arc at its feet (brass). */
  guard: '#c9b28a',
  /** A pinned hero's ring at the feet (pale amber) and the stake through it (steel). */
  pin: '#e2c78f',
  stake: '#cbd5e1',
  /** Execution's 40% notch on the over-head bar (bone white). */
  notch: '#f1f5f9',
  /** A Legion death's sparks and the Spire's embers (a pale ember: not threat amber). */
  ember: '#ffd2a6',
  /** The 'Blocked' floater a guard throws back (steel grey). */
  blocked: '#cbd5e1',
} as const;

/**
 * Ambient Crimson Spire colours: lights, sky and debris. Not semantic (nothing reads as an
 * answer or a threat by them), so they are kept off the combat disc: sky, rim and perimeter only.
 */
export const SPIRE_HEX = {
  sky: '#3a1416',
  torch: '#ffb27a',
  rim: '#9e2a33',
  /** The sky the Bloodmoon lerps the hemisphere light toward. */
  bloodmoon: '#8a1c24',
  /** Iron debris: dark shards and smoke. */
  iron: '#6b6468',
  smoke: '#2a2426',
  obsidian: '#191416',
  brass: '#a8875a',
  banner: '#5a1a20',
} as const;

/** The over-head pips a stacking status shows (bleed caps at 8). */
export const MAX_PIPS = 8;
/** From this many bleed stacks the pips glow and the Chime glyph shows (docs/phase-5a.md). */
export const BLEED_CHIME_AT = 5;

/** The light mood an arena is lit in (Stage.setMood's argument). */
export interface ArenaMood {
  sky: string;
  ground: string;
  hemi: number;
  key: string;
  keyIntensity: number;
  rim: string;
  rimIntensity: number;
  fog: string;
  fogNear: number;
  fogFar: number;
}

/** How an arena's air is dressed: Reliquary god rays and dust, or Spire torch cards and embers. */
export type ArenaLook = 'warm' | 'cool' | 'crimson';

/**
 * Which look an arena gets: its biome first (the Crimson Spire), else as Movement I always did
 * (`warm` unless it is the sandbox). A Movement I arena has no `biome`, so it is unchanged.
 */
export function arenaLook(def: Pick<ArenaDef, 'id' | 'biome'>): ArenaLook {
  if (def.biome === 'crimson_spire') return 'crimson';
  return def.id !== 'sandbox' ? 'warm' : 'cool';
}

/**
 * The per-biome mood table (replaces `warm = def.id !== 'sandbox'`). The warm and cool rows are
 * Movement I's exact arguments (tests/renderMovement2.test.ts snapshots them).
 */
export function arenaMood(def: Pick<ArenaDef, 'id' | 'biome' | 'theme'>): ArenaMood {
  const theme = def.theme;
  switch (arenaLook(def)) {
    case 'crimson':
      return {
        sky: SPIRE_HEX.sky,
        ground: theme.floor,
        hemi: 0.55,
        key: SPIRE_HEX.torch,
        keyIntensity: 1.6,
        rim: SPIRE_HEX.rim,
        rimIntensity: 0.6,
        fog: theme.fog,
        fogNear: 38,
        fogFar: 84,
      };
    case 'warm':
      return {
        sky: '#ffe7c2',
        ground: theme.floor,
        hemi: 0.6,
        key: '#ffd9a0',
        keyIntensity: 1.85,
        rim: theme.accent,
        rimIntensity: 0.55,
        fog: theme.fog,
        fogNear: 46,
        fogFar: 96,
      };
    case 'cool':
      return {
        sky: '#c9d6ff',
        ground: theme.floor,
        hemi: 0.65,
        key: '#fff1dc',
        keyIntensity: 1.9,
        rim: '#8fb0ff',
        rimIntensity: 0.55,
        fog: theme.fog,
        fogNear: 46,
        fogFar: 96,
      };
  }
}

// ── Enemy looks ──────────────────────────────────────────────────────────────────────────

/** The Legion's low four-legged bodies: a dog's gait (a faster bob, a pitch rock, no sway). */
const QUADRUPEDS = new Set(['sanguine_hound', 'gorehound_matriarch']);

export function isQuadruped(defId: string): boolean {
  return QUADRUPEDS.has(defId);
}

/** An enemy def's death material (`material`, absent = porcelain: Movement I's shards). */
export function materialOf(def: Pick<EnemyDef, 'material'>): 'porcelain' | 'iron' {
  return def.material === 'iron' ? 'iron' : 'porcelain';
}

/** How an attack moves its caster when it lands (`move`), or null. Unknown ids: null. */
export function moveOf(attackId: string): 'charge' | 'leap' | null {
  try {
    return attackDef(attackId).move ?? null;
  } catch {
    return null;
  }
}

/** A guard arc's half angle (radians) for a def, 0 without a guard. */
export function guardHalf(defId: string): number {
  try {
    const g = enemyDef(defId).guard;
    return g ? ((g.arcDeg / 2) * Math.PI) / 180 : 0;
  } catch {
    return 0;
  }
}

/**
 * The guard arc as the ring batch draws it (its lit arc from `arcStart`, `arcLen` long, in the
 * ring shader's angle: atan2(z, x)), from the *sim's* guard direction, never the render yaw.
 */
export function guardArc(
  guard: { readonly fx: number; readonly fz: number },
  half: number,
  out: { start: number; len: number },
): { start: number; len: number } {
  out.start = Math.atan2(guard.fz, guard.fx) - half;
  out.len = half * 2;
  return out;
}

/** The guard is broken (an Empowered Piercing Shot) at sim time `time`. */
export function guardBrokenAt(
  guard: { readonly brokenUntil: number } | undefined,
  time: number,
): boolean {
  return !!guard && guard.brokenUntil > time;
}

// ── Statuses ─────────────────────────────────────────────────────────────────────────────

type StatusList = readonly { readonly id: string; readonly stacks: number }[];

/** A status's stacks on an entity (0 without it). */
export function statusStacks(list: StatusList, id: string): number {
  for (const s of list) if (s.id === id) return Math.max(1, s.stacks);
  return 0;
}

/** The Legion statuses render draws on a hero, read once per hero per frame (reused). */
export interface CrimsonStatusLook {
  bleed: number;
  wound: boolean;
  pinned: boolean;
  /** The enemy a latch drains into (-1: none). */
  latchedBy: EntityId;
  pact: boolean;
  condemned: boolean;
}

export function emptyStatusLook(): CrimsonStatusLook {
  return {
    bleed: 0,
    wound: false,
    pinned: false,
    latchedBy: -1,
    pact: false,
    condemned: false,
  };
}

/** Reads the Legion's statuses off an entity into `out`. False when it has none of them. */
export function crimsonStatuses(e: ReadonlyEntity, out: CrimsonStatusLook): boolean {
  out.bleed = 0;
  out.wound = false;
  out.pinned = false;
  out.latchedBy = -1;
  out.pact = false;
  out.condemned = false;
  const h = e.health;
  if (!h) return false;
  let any = false;
  for (const s of h.statuses) {
    switch (s.id) {
      case 'bleed':
        out.bleed = Math.max(1, s.stacks);
        any = true;
        break;
      case 'wound':
        out.wound = true;
        any = true;
        break;
      case 'pinned':
        out.pinned = true;
        any = true;
        break;
      case 'latched':
        out.latchedBy = s.source ?? -1;
        any = true;
        break;
      case 'pact':
        out.pact = true;
        any = true;
        break;
      case 'condemned':
        out.condemned = true;
        any = true;
        break;
      default:
        break;
    }
  }
  return any;
}

/**
 * Where pip `i` of `n` sits over the head: a shallow arc, in metres from the head's centre
 * (x across, y up). Wider for more stacks; centred.
 */
export function pipOffset(i: number, n: number, out: { x: number; y: number }): void {
  const span = Math.min(n, MAX_PIPS);
  const k = span <= 1 ? 0 : i / (span - 1) - 0.5;
  out.x = k * Math.min(1.1, 0.16 * span);
  out.y = -Math.abs(k) * 0.12;
}

/** The answers a hero's Legion statuses want, over the head (null: none). */
export function statusAnswers(look: CrimsonStatusLook): readonly ('chime' | 'reel')[] | null {
  // A Reel frees both a pin and a latch at once; a pin has no other answer.
  if (look.pinned) return REEL;
  if (look.latchedBy >= 0) return REEL_CHIME;
  if (look.bleed >= BLEED_CHIME_AT) return CHIME;
  return null;
}
const REEL = ['reel'] as const;
const CHIME = ['chime'] as const;
const REEL_CHIME = ['reel', 'chime'] as const;

// ── Telegraphs ───────────────────────────────────────────────────────────────────────────

type TelegraphLike = Pick<
  WorldState['telegraphs'][number],
  'attackId' | 'linkStatus' | 'executeBelow'
>;

/** A Blood Pact: a link whose status is 'pact' (the telegraph's, else its attack's). */
export function isPact(t: TelegraphLike): boolean {
  if (t.linkStatus === 'pact') return true;
  try {
    return attackDef(t.attackId).linkStatus === 'pact';
  } catch {
    return false;
  }
}

/** Execution's threshold (a share of max life), or 0 when the telegraph isn't one. */
export function executeBelowOf(t: TelegraphLike): number {
  if (t.executeBelow !== undefined) return t.executeBelow;
  try {
    return attackDef(t.attackId).executeBelow ?? 0;
  } catch {
    return 0;
  }
}

/**
 * A cone this wide is a Crimson Tide (half the arena, 180°): render draws its sweep arrows and
 * keeps the badge near the caster (its far edge is off the arena).
 */
export const TIDE_HALF = Math.PI / 2 - 0.05;

/** The Damage multiplier a Blood Pact puts on both heroes (content's text constant). */
export const PACT_TAKEN = 0.2;
export const PACT_LABEL = `+${Math.round(PACT_TAKEN * 100)}%`;

// ── Sanctuary pools ──────────────────────────────────────────────────────────────────────

type Pool = { readonly x: number; readonly z: number; readonly r: number };

/** Inside some pool (or there are none: no Bloodmoon, nothing to be outside of). */
export function inSanctuary(
  pools: readonly Pool[] | null | undefined,
  x: number,
  z: number,
): boolean {
  if (!pools || pools.length === 0) return true;
  for (const p of pools)
    if ((x - p.x) * (x - p.x) + (z - p.z) * (z - p.z) <= p.r * p.r) return true;
  return false;
}

/** The Bloodmoon is up: the sim keeps Sanctuary pools (absent in Movement I). */
export function bloodmoonOn(state: WorldState): boolean {
  return (state.field.sanctuary?.pools.length ?? 0) > 0;
}

/** A heal number outside the pools under the Bloodmoon: this much smaller and this dim. */
export const CUT_HEAL_SIZE = 0.72;
export const CUT_HEAL_ALPHA = 0.55;
