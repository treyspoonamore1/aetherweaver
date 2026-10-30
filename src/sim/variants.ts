/**
 * Technique variants (docs/phase-4f.md): helpers shared by the casts (systems/techniques.ts),
 * the damage path (combat/health.ts) and Perfect Wards (combat/telegraphs.ts).
 */
import type { Entity, TechniqueKey } from './state';
import type { World } from './world';

/** Every variant the sim acts on (a test checks the content against it). */
export const KNOWN_VARIANTS: readonly string[] = [
  'chorale',
  'aegis_link',
  'purge',
  'absolve',
  'swap',
  'anchor',
  'phase_step',
  'skate',
];

/** The variant in a slot (null: the default). */
export function variantIn(world: World, slot: TechniqueKey): string | null {
  return world.entities.get(world.weaverId)?.weaver?.variants[slot] ?? null;
}

/** A variant's number from content (0 if it has none). */
export function variantValue(world: World, id: string, key: string): number {
  return world.content.techniqueVariants.find((v) => v.id === id)?.values[key] ?? 0;
}

/** What a slot costs: its variant's cost, or the default's. */
export function slotCost(world: World, slot: TechniqueKey, base: number): number {
  const id = variantIn(world, slot);
  const def = id === null ? undefined : world.content.techniqueVariants.find((v) => v.id === id);
  return def?.cost ?? base;
}

/** A slot's cooldown before modifiers: its variant's, or the default's. */
export function slotCooldown(world: World, slot: TechniqueKey, base: number): number {
  const id = variantIn(world, slot);
  const def = id === null ? undefined : world.content.techniqueVariants.find((v) => v.id === id);
  return def?.cooldown ?? base;
}

/** How far a Glide carries the Weaver: Skate's shorter dash, or the default's. */
export function glideDistance(world: World): number {
  return variantIn(world, 'glide') === 'skate'
    ? variantValue(world, 'skate', 'metres')
    : world.content.techniques.glide.distance;
}

/**
 * Absolve and Anchor: the share of a hit a hero is spared while their guard lasts (both
 * together multiply).
 */
export function variantGuard(world: World, e: Entity): number {
  const statuses = e.health?.statuses;
  if (!statuses || statuses.length === 0) return 0;
  let through = 1;
  for (const s of statuses) {
    if (s.id === 'absolved') through *= 1 - variantValue(world, 'absolve', 'pct') / 100;
    else if (s.id === 'anchored') through *= 1 - variantValue(world, 'anchor', 'pct') / 100;
  }
  return 1 - through;
}
