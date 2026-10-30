/**
 * Dissonance in the fight (docs/phase-4d.md, docs/phase-4d/vfx-audio.md): pure helpers, no
 * three.js, tested in Node. What render reads of `WorldState.dissonance` and of the enemies
 * (`enemy.risen`, `enemy.affixes`), the colours of Restless Dead's rise and its mark, and the
 * shape of a risen enemy standing back up. Every number is the state's or the content's.
 */
import { CONTENT } from '../content';
import type { ReadonlyEntity, WorldState } from '../sim';

export const DISSONANCE_HEX = {
  /**
   * Restless Dead: the ash a risen enemy is drawn in. Its life bar, its rim, the motes drifting
   * off it, the ring it gathers itself from. A dull warm grey: no meaning of its own but "spent".
   */
  ash: '#b3aa9c',
  /** The cold light it re-forms in: the edge of its body coming back, the ring that climbs it. */
  grave: '#d9ece2',
  /** Blind Score's "?" on a telegraph's badge: a neutral bone white, no answer's colour. */
  blind: '#e7e2d8',
} as const;

/**
 * How long a risen enemy takes to stand back up: the sim holds it in `spawning` for its
 * `SPAWN_TIME` (sim/systems/enemies.ts, 0.8 s; a test checks the two agree). The pose is driven
 * by its `stateTime`, so Stasis holds it mid-rise with every other enemy.
 */
export const RISE_SECONDS = 0.8;

/** How drained of colour a risen enemy is drawn once it stands (its mark). */
export const RISEN_DESAT = 0.62;

/** What render reads of Dissonance this frame (rebuilt only when the fight's levels change). */
export interface DissonanceLook {
  /** Any level in force. */
  any: boolean;
  /** Blind Score: the telegraphs don't show which answer they want. */
  blindScore: boolean;
  /** Restless Dead: enemies rise once. */
  restless: boolean;
  /** Restless Dead's share of its life an enemy rises at (0..1; 0 without it). */
  risePct: number;
  /** Elite Vanguard: elites carry more affixes. */
  vanguard: boolean;
  /** What a Cue costs this fight (Silent Cues adds to the content's). */
  cueCost: number;
  /** The Resonance segment and the most Resonance (content). */
  segment: number;
  max: number;
  /** The levels array this look was built from (rebuilt when it changes). */
  from: unknown;
}

export function emptyDissonanceLook(): DissonanceLook {
  return {
    any: false,
    blindScore: false,
    restless: false,
    risePct: 0,
    vanguard: false,
    cueCost: CONTENT.resonance.cueCost,
    segment: CONTENT.resonance.segment,
    max: CONTENT.resonance.max,
    from: null,
  };
}

/** A level's effect in force this fight, by the content's `effect` (its rank, 0: not in force). */
function rankOf(levels: readonly { id: string; rank: number }[], effect: string): number {
  for (let i = 0; i < levels.length; i++) {
    const l = levels[i]!;
    const def = CONTENT.dissonance.find((d) => d.id === l.id);
    if (def?.effect === effect) return l.rank;
  }
  return 0;
}

/**
 * Fills `out` from the state. A state with no `dissonance` (an old fixture, a lab stand-in) reads
 * as none. Allocates nothing per frame: the levels are looked at only when their array changes.
 */
export function dissonanceLook(state: WorldState, out: DissonanceLook): DissonanceLook {
  const d = (state as { dissonance?: WorldState['dissonance'] }).dissonance;
  const levels = d?.levels ?? null;
  out.blindScore = !!d?.blindScore;
  out.cueCost =
    typeof d?.cueCost === 'number' && Number.isFinite(d.cueCost)
      ? d.cueCost
      : CONTENT.resonance.cueCost;
  if (levels === out.from) return out;
  out.from = levels;
  const list = levels ?? [];
  out.any = list.length > 0;
  out.restless = rankOf(list, 'restless_dead') > 0;
  const rise = CONTENT.dissonance.find((l) => l.effect === 'restless_dead');
  out.risePct = out.restless ? (rise?.values.pct ?? 0) / 100 : 0;
  out.vanguard = rankOf(list, 'elite_vanguard') > 0;
  out.segment = CONTENT.resonance.segment;
  out.max = CONTENT.resonance.max;
  return out;
}

/** Restless Dead: this enemy has fallen and risen once already (it won't rise again). */
export function isRisen(e: ReadonlyEntity | undefined): boolean {
  return !!e?.enemy?.risen;
}

/** A risen enemy still standing back up (the sim holds it in `spawning`, untargetable). */
export function isRising(e: ReadonlyEntity | undefined): boolean {
  return !!e?.enemy?.risen && e.enemy.state === 'spawning';
}

/** Its shape as it stands back up (`riseShape`). */
export interface RiseShape {
  /** How far down it is (0 standing, 1 lying on its back) and its pitch (radians, + is back). */
  lie: number;
  pitch: number;
  /** Ash eating into it (the model's dissolve, 0..1) and how drained of colour it is. */
  dissolve: number;
  desat: number;
  /** The cold light at its edges as it comes back (0..1). */
  glow: number;
  /** How much of its life bar has come back (0..1 of what it rises with). */
  fill: number;
}

const smooth = (t: number) => t * t * (3 - 2 * t);
const seg = (t: number, a: number, b: number) => Math.max(0, Math.min(1, (t - a) / (b - a)));

/**
 * A risen enemy's pose `t` seconds into its rise (its `stateTime`): struck down, it topples back
 * and crumbles into ash (the first 22% of the rise), lies there a breath as the ash gathers, then
 * stands back up out of it (35–90%), re-forming from the feet as its life bar fills back to what
 * it rises with. Done by `RISE_SECONDS`, when the sim lets it fight again.
 */
export function riseShape(t: number, out: RiseShape): RiseShape {
  const u = Math.max(0, t) / RISE_SECONDS;
  const fall = smooth(seg(u, 0, 0.22));
  const up = smooth(seg(u, 0.35, 0.9));
  out.lie = fall * (1 - up);
  out.pitch = 1.35 * out.lie;
  // It crumbles as it falls; it re-forms as it stands.
  out.dissolve = 0.5 * fall * (1 - smooth(seg(u, 0.4, 0.95)));
  out.desat = 0.8 * fall - (0.8 - RISEN_DESAT) * up;
  out.glow = fall * (1 - seg(u, 0.85, 1));
  out.fill = smooth(seg(u, 0.35, 0.95));
  return out;
}

export function emptyRiseShape(): RiseShape {
  return { lie: 0, pitch: 0, dissolve: 0, desat: 0, glow: 0, fill: 0 };
}

/** Blind Score's badge: the one glyph shown in place of a telegraph's answers. */
export const BLIND_ANSWERS = ['unknown'] as const;
export const BLIND_KEY = 'unknown';

/**
 * Silent Cues: where the Cue's cost falls on the Weaver's Resonance orbit, in segments (the orbit
 * draws one star per segment, lit when it is full). Every multiple of the cost up to the most
 * Resonance that doesn't land on a star's own full point is a tick there; at the content's cost
 * (one segment) there is none and the orbit looks as it always has. Fills `out`, returns how many.
 */
export function cueTicks(look: DissonanceLook, out: Float32Array): number {
  const seg = look.segment;
  const cost = look.cueCost;
  if (!(seg > 0) || !(cost > 0)) return 0;
  let n = 0;
  for (let k = 1; k * cost <= look.max + 1e-9 && n < out.length; k++) {
    const at = (k * cost) / seg;
    if (Math.abs(at - Math.round(at)) < 1e-6) continue;
    out[n++] = at;
  }
  return n;
}

/** A Cue could be paid for now (the Weaver's Resonance against this fight's cost). */
export function cueReady(state: WorldState): boolean {
  const w = state.entities.get(state.weaverId)?.weaver;
  const d = (state as { dissonance?: WorldState['dissonance'] }).dissonance;
  const cost = typeof d?.cueCost === 'number' ? d.cueCost : CONTENT.resonance.cueCost;
  return !!w && w.resonance + 1e-9 >= cost;
}
