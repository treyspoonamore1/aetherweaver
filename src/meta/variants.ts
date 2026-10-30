/**
 * CONTRACT v14 — technique variants (docs/phase-4f.md): which the profile owns, which it chose
 * for each slot, and what a run plays with. Pure: the stores keep the state.
 */
import { CONTENT, type TechniqueVariantDef } from '../content';
import type { TechniqueKey } from '../sim';

/** The variant chosen for each slot (null: the default). */
export type Techniques = Record<TechniqueKey, string | null>;

export const TECHNIQUE_SLOTS: readonly TechniqueKey[] = ['ward', 'chime', 'reel', 'glide'];

export function noVariants(): Techniques {
  return { ward: null, chime: null, reel: null, glide: null };
}

/** A slot's two variants, in content order. */
export function variantsFor(slot: TechniqueKey): TechniqueVariantDef[] {
  return CONTENT.techniqueVariants.filter((v) => v.slot === slot);
}

/** The owned variants the content still knows, each once. */
export function fitOwned(owned: readonly string[]): string[] {
  const known = new Set(CONTENT.techniqueVariants.map((v) => v.id));
  return [...new Set(owned.filter((id) => known.has(id)))];
}

/**
 * A choice fitted to the content and to what's open: a slot keeps its variant if the content
 * knows it in that slot and it's owned (or `all`, Skip the unlocks), else the default.
 */
export function fitTechniques(
  choice: Partial<Record<TechniqueKey, string | null>>,
  owned: readonly string[],
  all: boolean,
): Techniques {
  const out = noVariants();
  for (const slot of TECHNIQUE_SLOTS) {
    const id = choice[slot];
    if (!id) continue;
    const def = CONTENT.techniqueVariants.find((v) => v.id === id);
    if (def?.slot === slot && (all || owned.includes(id))) out[slot] = id;
  }
  return out;
}

/** A run's choice as the fight takes it (`SimConfig.techniques`): the variants alone. */
export function variantsConfig(t: Techniques): Partial<Record<TechniqueKey, string>> {
  const out: Partial<Record<TechniqueKey, string>> = {};
  for (const slot of TECHNIQUE_SLOTS) {
    const id = t[slot];
    if (id) out[slot] = id;
  }
  return out;
}
