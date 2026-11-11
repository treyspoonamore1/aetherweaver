import type * as THREE from 'three';
import { enemyDef, heroDef, type EnemyDef, type HeroDef } from '../../../content';
import { OWN_PALETTE } from '../../keepsakeCues';
import type { WeaverPalette } from '../../keepsakeCues';
import { ART as CHOIR } from './choir';
import { ART as FINALE } from './finale';
import { ART as HEROES } from './heroes';
import { BUDGET, type ArtFamily, type SizeClass } from './kit';
import { ART as LEGION } from './legion';
import { ART as MISC } from './misc';
import { ART as UNSTITCHED } from './unstitched';
import { ART as UNWEAVER } from './unweaver';
import { ART as WEAVER } from './weaver';

/**
 * The art pass's registry: every family file's `ART`, merged. library.ts asks here first while the
 * art pass is on and falls back to main's builder for anything not yet redrawn, so a half-redrawn
 * game always renders. A family adds a figure by adding it to its own file's `ART`; nothing here
 * changes. An id claimed by two families is an error (thrown when this module loads).
 */
const FAMILIES: Record<string, ArtFamily> = {
  heroes: HEROES,
  weaver: WEAVER,
  choir: CHOIR,
  legion: LEGION,
  unstitched: UNSTITCHED,
  unweaver: UNWEAVER,
  finale: FINALE,
  misc: MISC,
};

const heroes = new Map<string, (def: HeroDef) => THREE.BufferGeometry>();
const enemies = new Map<string, (def: EnemyDef) => THREE.BufferGeometry>();
const single: Omit<ArtFamily, 'heroes' | 'enemies'> = {};

for (const [family, art] of Object.entries(FAMILIES)) {
  for (const [id, build] of Object.entries(art.heroes ?? {})) {
    if (heroes.has(id)) throw new Error(`art: hero ${id} is claimed twice (${family})`);
    heroes.set(id, build);
  }
  for (const [id, build] of Object.entries(art.enemies ?? {})) {
    if (enemies.has(id)) throw new Error(`art: enemy ${id} is claimed twice (${family})`);
    enemies.set(id, build);
  }
  for (const key of ['weaver', 'sapling', 'ancient', 'crown'] as const) {
    if (!art[key]) continue;
    if (single[key]) throw new Error(`art: ${key} is claimed twice (${family})`);
    (single as Record<string, unknown>)[key] = art[key];
  }
}

/** A hero's redrawn model, or null (main's builder then draws it). */
export function artHero(def: HeroDef): THREE.BufferGeometry | null {
  return heroes.get(def.id)?.(def) ?? null;
}

/** An enemy's redrawn model, by its id, or null. */
export function artEnemy(def: EnemyDef): THREE.BufferGeometry | null {
  return enemies.get(def.id)?.(def) ?? null;
}

export function artWeaver(palette: Readonly<WeaverPalette>): THREE.BufferGeometry | null {
  return single.weaver?.(palette) ?? null;
}

export function artSapling(moss: string): THREE.BufferGeometry | null {
  return single.sapling?.(moss) ?? null;
}

export function artAncient(moss: string): THREE.BufferGeometry | null {
  return single.ancient?.(moss) ?? null;
}

export function artCrown(): THREE.BufferGeometry | null {
  return single.crown?.() ?? null;
}

/** Which ids each family has redrawn (the studio and the roster read this). */
export function artDone(): { heroes: string[]; enemies: string[]; other: string[] } {
  return {
    heroes: [...heroes.keys()],
    enemies: [...enemies.keys()],
    other: Object.keys(single),
  };
}

/** One redrawn figure's cost against its size class's budget (docs/art-style.md, Budgets). */
export interface ArtBudgetRow {
  id: string;
  size: string;
  triangles: number;
  outline: number;
  budget: number;
  ok: boolean;
}

/**
 * Builds every redrawn figure and measures it: triangles (outline shell included), the outline's
 * share, and its size class's budget (`__VFX__.artBudgets()` in the lab, the studio script).
 */
export function artBudgets(): ArtBudgetRow[] {
  const rows: ArtBudgetRow[] = [];
  const measure = (id: string, g: THREE.BufferGeometry) => {
    const misc = g.getAttribute('aMisc');
    let shell = 0;
    if (misc) for (let i = 0; i < misc.count; i++) if (misc.getY(i) > 8.5) shell++;
    const triangles = g.getAttribute('position').count / 3;
    const size = (g.userData.sizeClass as SizeClass | undefined) ?? 'standard';
    const budget = BUDGET[size];
    rows.push({ id, size, triangles, outline: shell / 3, budget, ok: triangles <= budget });
    g.dispose();
  };
  for (const [id, build] of heroes) measure(id, build(heroDef(id)));
  for (const [id, build] of enemies) measure(id, build(enemyDef(id)));
  if (single.weaver) measure('weaver', single.weaver(OWN_PALETTE));
  if (single.sapling) measure('sapling', single.sapling('#487858'));
  if (single.ancient) measure('ancient', single.ancient('#487858'));
  if (single.crown) measure('crown', single.crown());
  return rows;
}
