/**
 * The Weaver's Calling as render sees it (docs/phase-3c/vfx.md). Pure helpers, no three.js, so
 * the shine rule, the radiant-hit tiers, the number split and the look flags are testable in
 * Node against the real sim.
 *
 * Everything is read from `WorldState.calling`, the heroes' `inField` / `auraMask`, the
 * enemies' `inField`, `field.crescendo` and the `damageTaken.radiance` / `dawnward` events.
 * Numbers come from the state (`radiancePerAura`, `sunriseMult`) and content, never hard-coded,
 * so the lead's tuning shows up without render changes.
 */
import { CONTENT } from '../content';
import type { ReadonlyEntity, WorldState } from '../sim';

/** The Luminary's id, as `WorldState.calling.id`. */
export const LUMINARY = 'luminary';

/** The Luminary's light (identity colours, not semantic: barriers keep `C.shield` / `C.amp`). */
export const CALLING_HEX = {
  /** Radiance: warm sunlight on the heroes who shine. */
  sun: '#ffe7a6',
  /** Sunrise burning hot (the Luminary's): a deeper gold. */
  sunHot: '#ffd36b',
  /** Dawnward: the pale rose-gold of first light. */
  dawn: '#ffd2bd',
  /** Eclipse: the corona round the dark rim. */
  corona: '#ffdf9a',
  /** Haloed: a pale, almost white gold. */
  halo: '#fff4d2',
} as const;

/** Eclipse's dark rim (drawn with normal blending, so it can darken). */
export const ECLIPSE_DARK_HEX = '#120a1a';

/** The glyph on Radiance's damage chip (text presentation, never the colour emoji). */
export const SUN_GLYPH = '☀︎';

/**
 * A hit's radiant part (`damageTaken.radiance` over what the hit dealt) at or above this shows
 * a ☀ chip on the number and a warm spark at the target. Below it, only the number glows.
 * Radiance at +4% per aura outside Sunrise stays under it; Searing Hymns, Sunrise and Eclipse
 * cross it.
 */
export const RADIANT_CHIP = 0.12;
/** At or above this the spark becomes a small sunburst (Sunrise with Searing Hymns, Eclipse). */
export const RADIANT_FLARE = 0.25;

/** Radiant hit tiers: 0 nothing, 1 the number glows, 2 chip and spark, 3 chip and sunburst. */
export type RadiantTier = 0 | 1 | 2 | 3;

/** How radiant a hit (or an aggregated number) was: `radiance` out of `total` dealt. */
export function radiantTier(radiance: number, total: number): RadiantTier {
  if (!(radiance > 0.05) || !(total > 0)) return 0;
  const frac = radiance / total;
  if (frac >= RADIANT_FLARE) return 3;
  if (frac >= RADIANT_CHIP) return 2;
  return 1;
}

/** The three chips of a damage number. Mutated in place (no allocation per hit). */
export interface RadiantSplit {
  /** Empower, Flourishes and relics: the gold chip. */
  empower: number;
  /** The auras' part: the ♪ song chip. */
  aura: number;
  /** Radiance (and Eclipse): the ☀ chip. */
  radiance: number;
}

/**
 * Splits the Weaver's share of a hit: `aura` and `radiance` are parts of `amplified`, the rest
 * is the gold chip. Radiance never inflates the gold chip (it used to: `amplified - aura`).
 */
export function splitRadiant(
  amplified: number,
  aura: number,
  radiance: number,
  out: RadiantSplit,
): RadiantSplit {
  const amp = Math.max(0, amplified);
  const a = Math.max(0, Math.min(aura, amp));
  const r = Math.max(0, Math.min(radiance, amp - a));
  out.aura = a;
  out.radiance = r;
  out.empower = Math.max(0, amp - a - r);
  return out;
}

/** Bits set in an aura mask. */
export function auraCount(mask: number): number {
  let n = 0;
  for (let m = mask; m !== 0; m &= m - 1) n++;
  return n;
}

/**
 * How brightly a hero shines right now: `radiancePerAura × auras heard` (× `sunriseMult` in
 * Sunrise) while they stand in the field, 0 otherwise or without the Calling. The sim's own
 * rule (`radianceOf`); tests/renderLuminary.test.ts checks they agree.
 */
export function shineOf(state: WorldState, e: ReadonlyEntity | undefined): number {
  const calling = state.calling;
  const h = e?.hero;
  if (!calling || !h || !h.inField || h.auraMask === 0 || calling.radiancePerAura <= 0) return 0;
  const health = e.health;
  if (health && (health.dead || health.downed)) return 0;
  const k = state.field.crescendo ? calling.sunriseMult : 1;
  return calling.radiancePerAura * auraCount(h.auraMask) * k;
}

/** Radiance that reads as "fully lit" (level 1): +12%, three auras at +4%. */
const FULL_SHINE = 0.12;
/** The shine level's cap (Sunrise with Searing Hymns would otherwise blow out). */
export const MAX_SHINE_LEVEL = 1.6;

/**
 * Shine → visual level, 0..1.6. A square root, so +4% already shows (0.58), +12% is 1, and
 * Sunrise's ×3 is clearly brighter (1.4–1.6) without blowing out.
 */
export function shineLevel(shine: number): number {
  if (!(shine > 0)) return 0;
  return Math.min(MAX_SHINE_LEVEL, Math.sqrt(shine / FULL_SHINE));
}

/** What the Calling adds to the fight this frame. Reused (no allocation per frame). */
export interface CallingLook {
  /** The Luminary is the Calling. */
  luminary: boolean;
  /** The Luminary's Sunrise is on (field.crescendo with the Luminary). */
  sunrise: boolean;
  /** Eclipse is on the path. */
  eclipse: boolean;
  /** Eclipse in force: on the path and Sunrise on. */
  eclipseOn: boolean;
  haloed: boolean;
  dawnward: boolean;
  searing: boolean;
  /** Lantern Bearer is on the path (it shows on a planted field). */
  lantern: boolean;
  /** Sovereign Symphony is in force (`calling.sovereign`). */
  sovereign: boolean;
  thirdVoice: boolean;
}

export function emptyLook(): CallingLook {
  return {
    luminary: false,
    sunrise: false,
    eclipse: false,
    eclipseOn: false,
    haloed: false,
    dawnward: false,
    searing: false,
    lantern: false,
    sovereign: false,
    thirdVoice: false,
  };
}

function has(path: readonly string[], id: string): boolean {
  for (let i = 0; i < path.length; i++) if (path[i] === id) return true;
  return false;
}

/** Fills `out` from the state (fixed for the fight apart from Sunrise). */
export function callingLook(state: WorldState, out: CallingLook): CallingLook {
  const c = state.calling;
  const lum = !!c && c.id === LUMINARY;
  const path = lum ? c.path : [];
  out.luminary = lum;
  out.sunrise = lum && state.field.crescendo;
  out.eclipse = lum && has(path, 'eclipse');
  out.eclipseOn = out.eclipse && state.field.crescendo;
  out.haloed = lum && has(path, 'haloed');
  out.dawnward = lum && has(path, 'dawnward');
  out.searing = lum && has(path, 'searing_hymns');
  out.lantern = lum && has(path, 'lantern_bearer');
  out.sovereign = lum && !!c?.sovereign;
  out.thirdVoice = lum && has(path, 'third_voice');
  return out;
}

/** Eclipse marks an enemy (the sim's rule: Sunrise on and the enemy `inField`). */
export function eclipseMarks(state: WorldState, e: ReadonlyEntity | undefined): boolean {
  const en = e?.enemy;
  if (!en || !en.inField || !state.field.crescendo) return false;
  if (e.health && (e.health.dead || e.health.downed)) return false;
  return !!state.calling && state.calling.id === LUMINARY && has(state.calling.path, 'eclipse');
}

/** A Calling option's content value (`values[key]`), or `fallback`. */
export function callingValue(option: string, key: string, fallback: number): number {
  for (const c of CONTENT.callings)
    for (const t of c.tiers)
      for (const o of t.options) {
        if (o.id !== option) continue;
        const v = o.values[key];
        return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
      }
  return fallback;
}

/** The ☀ chip text: null below 1 so a sliver never shows "+0". */
export function sunChipText(v: number): string | null {
  return v >= 1 ? `${SUN_GLYPH}+${Math.round(v)}` : null;
}
