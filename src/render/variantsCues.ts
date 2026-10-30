/**
 * Technique variants in the fight (docs/phase-4f.md, docs/phase-4f/vfx-audio.md): pure helpers, no
 * three.js, tested in Node. Which variants the sim casts and in which slot, what each moment is
 * and how long it plays, and what render reads of the state: the Weaver's variants, Skate's
 * charges, the `absolved` and `anchored` guards, Chorale's barriers. Every number is the state's
 * or the content's.
 */
import { CONTENT } from '../content';
import type { ReadonlyEntity, WorldState } from '../sim';

/** Every variant the sim casts (`techniqueCast.variant`), in the content's order. */
export const VARIANT_IDS = [
  'chorale',
  'aegis_link',
  'purge',
  'absolve',
  'swap',
  'anchor',
  'phase_step',
  'skate',
] as const;
export type VariantId = (typeof VARIANT_IDS)[number];
export type VariantSlot = 'ward' | 'chime' | 'reel' | 'glide';

const IDS: ReadonlySet<string> = new Set(VARIANT_IDS);

/** A `techniqueCast.variant` as one of render's variants (null: the default, or unknown). */
export function variantOf(id: string | null | undefined): VariantId | null {
  return typeof id === 'string' && IDS.has(id) ? (id as VariantId) : null;
}

/** The slot a variant takes (content), or undefined. */
export function variantSlot(id: string): VariantSlot | undefined {
  return CONTENT.techniqueVariants.find((v) => v.id === id)?.slot;
}

/** A variant's name (content). */
export function variantName(id: string): string {
  return CONTENT.techniqueVariants.find((v) => v.id === id)?.name ?? id;
}

/** A variant's number (content; 0 if it has none). */
export function variantValue(id: string, key: string): number {
  return CONTENT.techniqueVariants.find((v) => v.id === id)?.values[key] ?? 0;
}

/** Chorale: how far its burst reaches round the hero you Ward (content). */
export const choraleRadius = (): number => variantValue('chorale', 'radius');
/** Chorale: how long its barriers last (content, before the Ward's modifiers). */
export const choraleSeconds = (): number => variantValue('chorale', 'seconds');
/** Aegis Link: how long a link holds (content). */
export const linkSeconds = (): number => variantValue('aegis_link', 'seconds');
/** Purge: how far what the Chime cleanses bursts out (content). */
export const purgeRadius = (): number => variantValue('purge', 'radius');
/** Absolve: how long its guard lasts (content). */
export const absolveSeconds = (): number => variantValue('absolve', 'seconds');
/** Anchor: how long the hero is held fast (content). */
export const anchorSeconds = (): number => variantValue('anchor', 'seconds');
/** Phase Step: how far the blink carries the Weaver (content). */
export const phaseMetres = (): number => variantValue('phase_step', 'metres');
/** Phase Step: how long the enemies hunting her lose her, and her decoy stands (content). */
export const phaseSeconds = (): number => variantValue('phase_step', 'seconds');
/** Skate: its charges (content). */
export const skateMax = (): number => variantValue('skate', 'charges');
/** Skate: how far each dash carries her (content). */
export const skateMetres = (): number => variantValue('skate', 'metres');

/**
 * The moments render plays. Each variant's cast is one (`CAST_MOMENT`); three more answer what
 * happens after: several Chorale barriers turning Perfect together (`chord`), the Weaver joining
 * a link on its Perfect (`join`) and a hit shared along it (`share`).
 */
export const VARIANT_MOMENTS = [
  'chorale',
  'chord',
  'link',
  'join',
  'share',
  'purge',
  'absolve',
  'swap',
  'anchor',
  'phase_step',
  'skate',
] as const;
export type VariantMoment = (typeof VARIANT_MOMENTS)[number];

/** The moment each variant's cast plays (from its own event: `chorale`, `linked`, `purged`…). */
export const CAST_MOMENT: Readonly<Record<VariantId, VariantMoment>> = {
  chorale: 'chorale',
  aegis_link: 'link',
  purge: 'purge',
  absolve: 'absolve',
  swap: 'swap',
  anchor: 'anchor',
  phase_step: 'phase_step',
  skate: 'skate',
};

/**
 * How long each moment plays (seconds of render time). What lasts (a link, a guard, a hold, the
 * decoy, Chorale's barriers, Skate's charges) is drawn from the state's clock instead.
 */
export const MOMENT_LIFE: Readonly<Record<VariantMoment, number>> = {
  chorale: 1.0,
  chord: 1.15,
  link: 0.6,
  join: 0.8,
  share: 0.45,
  purge: 0.95,
  absolve: 0.7,
  swap: 0.8,
  anchor: 0.65,
  phase_step: 0.7,
  skate: 0.9,
};

/**
 * The variants' own colours. Each moment is in its slot's colour (the Ward's shield, the Chime's
 * lavender, the Thread's for a Reel, the Weaver's gold for a Glide); these are the light inside
 * them. Pale and warm, none of them a semantic colour (tested against danger in every vision).
 */
export const VARIANTS_HEX = {
  /** A Chorale's choir: the band round its barriers and the chord of several Perfects. */
  choir: '#fff6dc',
  /** Absolve's veil of falling light. */
  absolve: '#fff2e0',
  /** Anchor's stakes and the dust of its drop. */
  stake: '#f3ead8',
} as const;

/** The Weaver's variant in each slot (null: the default). An old fixture without them: null. */
export function weaverVariants(
  state: WorldState,
): Readonly<Record<VariantSlot, string | null>> | null {
  const v = state.entities.get(state.weaverId)?.weaver?.variants;
  return v && typeof v === 'object' ? v : null;
}

/** Seconds left of a guard status (`absolved`, `anchored`) on a living, standing entity. */
export function statusLeft(e: ReadonlyEntity | undefined, id: 'absolved' | 'anchored'): number {
  const h = e?.health;
  if (!h || h.dead || h.downed || !h.statuses) return 0;
  for (const s of h.statuses) if (s.id === id) return Math.max(0, s.remaining);
  return 0;
}

/** The whole of a guard status as it was given (its `duration`), for its countdown. */
export function statusTotal(e: ReadonlyEntity | undefined, id: 'absolved' | 'anchored'): number {
  const statuses = e?.health?.statuses;
  if (!statuses) return 0;
  for (const s of statuses) if (s.id === id) return Math.max(0, s.duration);
  return 0;
}

/** Seconds left of a hero's Chorale barrier: 0 for none (or a plain Ward, or one spent). */
export function choraleLeft(e: ReadonlyEntity | undefined, time: number): number {
  const h = e?.health;
  if (!h || h.dead || !h.shields) return 0;
  for (const s of h.shields) {
    if (s.kind !== 'ward' || s.chorale !== true) continue;
    return s.amount > 0 ? Math.max(0, s.expiresAt - time) : 0;
  }
  return 0;
}

/**
 * A hero's Chorale barrier is the one you Warded: it can turn Perfect, as a Ward's can. The others
 * a Chorale lays (`plain`) only absorb. False for none.
 */
export function choraleLead(e: ReadonlyEntity | undefined): boolean {
  const shields = e?.health?.shields;
  if (!shields) return false;
  for (const s of shields) if (s.kind === 'ward' && s.chorale === true) return s.plain !== true;
  return false;
}

/** Skate's charges as the state has them, and how far the next is back (0..1). */
export interface SkateCharges {
  charges: number;
  max: number;
  /** How far the next charge has come back (0 spent just now, 1 back): its cooldown's sweep. */
  refill: number;
}

/** Skate's charges, or null when the Glide is not Skate (or the state has no charges). */
export function skateCharges(state: WorldState, out: SkateCharges): SkateCharges | null {
  const w = state.entities.get(state.weaverId)?.weaver;
  if (!w || w.variants?.glide !== 'skate') return null;
  const max = w.maxGlideCharges;
  if (typeof max !== 'number' || !(max > 0)) return null;
  out.max = max;
  out.charges = Math.max(0, Math.min(max, w.glideCharges ?? 0));
  const total = w.cooldownTotals?.glide ?? 0;
  const left = w.cooldowns?.glide ?? 0;
  out.refill = out.charges >= max || !(total > 0) ? 1 : Math.max(0, Math.min(1, 1 - left / total));
  return out;
}

/** What render reads of the variants this frame (else it skips their work). */
export interface VariantsLook {
  /** The Weaver casts some variant. */
  any: boolean;
  ward: VariantId | null;
  chime: VariantId | null;
  reel: VariantId | null;
  glide: VariantId | null;
}

export function emptyVariantsLook(): VariantsLook {
  return { any: false, ward: null, chime: null, reel: null, glide: null };
}

/** Fills `out` from the Weaver. A state without variants (an old fixture) reads as none. */
export function variantsLook(state: WorldState, out: VariantsLook): VariantsLook {
  const v = weaverVariants(state);
  out.ward = variantOf(v?.ward);
  out.chime = variantOf(v?.chime);
  out.reel = variantOf(v?.reel);
  out.glide = variantOf(v?.glide);
  out.any = !!(out.ward || out.chime || out.reel || out.glide);
  return out;
}
