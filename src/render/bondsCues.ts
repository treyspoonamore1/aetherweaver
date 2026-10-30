/**
 * Bonds in the fight (docs/phase-4e.md, docs/phase-4e/vfx-audio.md): pure helpers, no three.js,
 * tested in Node. Which talents and alternate Solos announce themselves (`talentFired`), whose
 * they are and in whose colour, how long each moment lasts, and what render reads of the state:
 * Oathkeeper's reach, Hawk's Vigil's reach and its marks, a Celestial Sphere's hits, a
 * Constellation star's life, Unbreakable's seconds. Every number is the state's or the content's.
 */
import { CONTENT } from '../content';
import type { ReadonlyEntity, WorldState } from '../sim';

/** Every talent and alternate Solo the sim announces with `talentFired`, in the content's order. */
export const BOND_CUES = [
  'steady_vanguard',
  'vanguards_roar',
  'riposte_bash',
  'unbreakable',
  'shieldbearer',
  'wind_step',
  'starthread',
  'event_horizon',
  'supernova',
  'constellation',
  'arcane_ward',
  'oathkeeper',
  'hawks_vigil',
  'celestial_sphere',
] as const;
export type BondCue = (typeof BOND_CUES)[number];

const CUE_SET: ReadonlySet<string> = new Set(BOND_CUES);

/** A `talentFired` id as one of render's cues (null: a talent with nothing to show). */
export function bondCue(id: string): BondCue | null {
  return CUE_SET.has(id) ? (id as BondCue) : null;
}

/** The alternate Solos (their persistent looks: the reach, the stance, the spheres). */
export const ALT_SOLO_IDS = ['oathkeeper', 'hawks_vigil', 'celestial_sphere'] as const;
export type AltSoloId = (typeof ALT_SOLO_IDS)[number];

export function isAltSolo(id: string): id is AltSoloId {
  return (ALT_SOLO_IDS as readonly string[]).includes(id);
}

/** The hero a talent or alternate Solo belongs to (content), or undefined. */
export function cueHero(id: string): string | undefined {
  return (
    CONTENT.talents.find((t) => t.id === id)?.hero ??
    CONTENT.altSolos.find((s) => s.id === id)?.hero
  );
}

/** A talent's or alternate Solo's name (content), for its callout. */
export function cueName(id: string): string {
  return (
    CONTENT.talents.find((t) => t.id === id)?.name ??
    CONTENT.altSolos.find((s) => s.id === id)?.name ??
    id
  );
}

/** A hero's signature colour (content), white for an unknown hero. */
export function heroHex(defId: string | undefined): string {
  return CONTENT.heroes.find((h) => h.id === defId)?.color ?? '#ffffff';
}

/**
 * Bonds' own colours. Every moment is drawn in its hero's colour (the content's); these are the
 * light inside them: the Celestial Sphere's starlight and a Constellation star's core. Pale and
 * cool, none of them a semantic colour (tested against danger in every colour vision).
 */
export const BONDS_HEX = {
  /** Starlight: a star's core, the sphere's points of light, its hits-left stars. */
  starlight: '#f1ecff',
  /** The event horizon's dark heart (normal blending: it darkens the floor). */
  horizon: '#1b1030',
} as const;

/** How long each moment plays (seconds of render time). The star's is its content's seconds. */
export const CUE_LIFE: Readonly<Record<BondCue, number>> = {
  steady_vanguard: 1.2,
  vanguards_roar: 1.3,
  // It answers the Perfect Ward a beat later (`RIPOSTE_LAG`, bonds.ts).
  riposte_bash: 0.9,
  // Its seconds untouchable (content) and a breath to fade: see `unbreakableSeconds`.
  unbreakable: 0,
  shieldbearer: 0.95,
  wind_step: 0.7,
  starthread: 0.65,
  event_horizon: 1.0,
  // Its nova lands `NOVA_DELAY` after the event (the sim's pending hit), then a breath.
  supernova: 1.5,
  // The star's own life (content), drawn from the state's clock: see `starSeconds`.
  constellation: 0,
  arcane_ward: 0.75,
  oathkeeper: 0.45,
  hawks_vigil: 0.42,
  celestial_sphere: 0.6,
};

/**
 * The cues that fire often: no callout, and their moments stay small. Hawk's Vigil answers every
 * attack, Oathkeeper every hit near Kael, the sphere every hit it swallows; Starthread rides every
 * Starbolt and Constellation every Cue (its star is the moment).
 */
export const FREQUENT: ReadonlySet<BondCue> = new Set<BondCue>([
  'hawks_vigil',
  'oathkeeper',
  'celestial_sphere',
  'starthread',
  'constellation',
]);

/** Supernova: the sim's nova lands this long after its event (its pending hit, solos.ts). */
export const NOVA_DELAY = 0.3;

/**
 * Hawk's Vigil: Lyra answers attacks started within her attack range (Hawk Eye's included) and
 * this much more (the sim's, solos.ts; a test checks the two agree).
 */
export const VIGIL_EXTRA = 2;

const talentValue = (id: string, key: string): number =>
  CONTENT.talents.find((t) => t.id === id)?.values[key] ?? 0;
const soloValue = (id: string, key: string): number =>
  CONTENT.altSolos.find((s) => s.id === id)?.values[key] ?? 0;

/** Oathkeeper's reach around Kael (content): cued, farther. */
export function oathReach(cued: boolean): number {
  return soloValue('oathkeeper', cued ? 'cuedRadius' : 'radius');
}

/** Vanguard's Roar: everything this close to Kael's quarry turns on him (content). */
export function roarRadius(): number {
  return talentValue('vanguards_roar', 'radius');
}

/** Shieldbearer: Aegis Wall shields the heroes this close to Kael (content). */
export function shieldbearerRadius(): number {
  return talentValue('shieldbearer', 'radius');
}

/** Supernova: the nova's reach (content). */
export function novaRadius(): number {
  return talentValue('supernova', 'radius');
}

/** Event Horizon: how much farther Gravity Well reaches (content). */
export function horizonReach(): number {
  return talentValue('event_horizon', 'radius');
}

/** Constellation: how long a Cue's star stands and casts (content). */
export function starSeconds(): number {
  return talentValue('constellation', 'seconds');
}

/** Constellation: how often a star casts (content). */
export function starInterval(): number {
  return talentValue('constellation', 'interval');
}

/** Unbreakable: how long Kael is untouchable after the blow (content). */
export function unbreakableSeconds(): number {
  return talentValue('unbreakable', 'seconds');
}

/** Celestial Sphere: the hits a sphere swallows when it is given (content). */
export function sphereMaxHits(): number {
  return soloValue('celestial_sphere', 'hits');
}

/** Hawk's Vigil, cued: how long its mark lasts (content). */
export function markSeconds(): number {
  return soloValue('hawks_vigil', 'mark');
}

/** Hawk's Vigil: how long it lasts uncued (content; the state's `soloActive` counts it down). */
export function altSoloSeconds(id: string): number {
  return soloValue(id, 'seconds');
}

/**
 * Hawk's Vigil's reach for Lyra: her attack range (the content's, and Hawk Eye's if she plays it)
 * and `VIGIL_EXTRA`, as the sim reckons it (an enemy's own radius is added to that).
 */
export function vigilReach(hero: ReadonlyEntity | undefined): number {
  const h = hero?.hero;
  const def = CONTENT.heroes.find((d) => d.id === h?.defId);
  const base = def?.attack.range ?? 0;
  const eye = h?.talents?.includes('hawk_eye') ? talentValue('hawk_eye', 'range') : 0;
  return base + eye + VIGIL_EXTRA;
}

/** An alternate Solo this hero has under way (null: none, or their own Solo). */
export function altSoloActive(e: ReadonlyEntity | undefined): AltSoloId | null {
  const h = e?.hero;
  if (!h || !(h.soloActive > 0) || e.health?.dead || e.health?.downed) return null;
  const id = h.soloId;
  return typeof id === 'string' && isAltSolo(id) ? id : null;
}

/**
 * A hero's Celestial Sphere: the hits it will still swallow (0: none, spent, run out, or the hero
 * is down). A state without Bonds (an old fixture) reads as none.
 */
export function sphereHits(e: ReadonlyEntity | undefined, time: number): number {
  const h = e?.hero;
  if (!h || e.health?.dead || e.health?.downed) return 0;
  const hits = h.sphereHits;
  const until = h.sphereUntil;
  if (typeof hits !== 'number' || typeof until !== 'number') return 0;
  return hits > 0 && until > time ? hits : 0;
}

/** Seconds a hero's sphere still holds (0 for none). */
export function sphereLeft(e: ReadonlyEntity | undefined, time: number): number {
  return sphereHits(e, time) > 0 ? Math.max(0, (e!.hero!.sphereUntil ?? 0) - time) : 0;
}

/** Hawk's Vigil's cued mark on an enemy: seconds left (0 for none). */
export function markLeft(e: ReadonlyEntity | undefined, time: number): number {
  const until = e?.enemy?.markedUntil;
  if (typeof until !== 'number' || e?.health?.dead) return 0;
  return Math.max(0, until - time);
}

/** What render reads of Bonds this frame: is any hero playing a talent or an alternate Solo. */
export interface BondsLook {
  /** Some hero plays a talent or brings an alternate Solo (else render skips Bonds' work). */
  any: boolean;
  /** Some hero brings an alternate Solo. */
  alt: boolean;
}

export function emptyBondsLook(): BondsLook {
  return { any: false, alt: false };
}

/** Fills `out` from the party (cheap: a few heroes). A state without Bonds reads as none. */
export function bondsLook(state: WorldState, out: BondsLook): BondsLook {
  out.any = false;
  out.alt = false;
  for (let i = 0; i < state.party.length; i++) {
    const h = state.entities.get(state.party[i]!)?.hero;
    if (!h) continue;
    if ((h.talents?.length ?? 0) > 0) out.any = true;
    if (typeof h.soloId === 'string' && isAltSolo(h.soloId)) {
      out.any = true;
      out.alt = true;
    }
  }
  return out;
}
