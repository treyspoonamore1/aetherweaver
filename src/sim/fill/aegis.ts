/**
 * Phase 5g, W2: the Aegis motifs' sim (docs/phase-5g.md, "Aegis: Ward, Chime, Reel and Glide";
 * content in `src/content/fill/aegis.ts`). Most are triggers (resolved from content); the one hook
 * is N6. W0 placed its call site; this file writes its body.
 *
 * The rules of `src/sim/fill/silk.ts`'s header hold here too: no RNG, state only in W0's optional
 * keys (never `undefined`), `aegisMotifIds` returns an array literal, no edits to shared files.
 * New barriers are `overshield`s (never the aura's `barrier` kind).
 */
import type { Mods } from '../mods';
import type { Entity } from '../state';
import type { World } from '../world';

/** Last Bastion's line (its text's "below 35%"): a Ward on a hero below this share of life. */
export const LAST_BASTION_BELOW = 0.35;

/** The Aegis motif ids this file's resolver knows. Return an array literal. */
export function aegisMotifIds(): readonly string[] {
  return [
    'shatterglass',
    'sister_ward',
    'clean_strike',
    'ringing_steel',
    'clutch_peal',
    'bright_peal',
    'safe_harbour',
    'light_step',
    'shieldsong',
    'second_toll',
    'tender_guard',
    'last_bastion',
  ];
}

/**
 * The resolver's cases for the Aegis motifs (see `applySilkMotif`). Fields: `lowWardBonus` and
 * `lowWardBelow` (Last Bastion: a share 0..1 larger, below a share 0..1 of life); existing
 * `staggerMult` (Ringing Steel, multiplies, as the Astrolabe's Ringing Parry does) and
 * `wardedDamage` (Shieldsong, adds). The other nine are triggers only and set no field here:
 * their `triggers` are resolved from content. Return true when `id` is yours.
 */
export function applyAegisMotif(m: Mods, id: string, v: number): boolean {
  const pct = v / 100;
  switch (id) {
    case 'ringing_steel':
      m.staggerMult *= 1 + pct;
      return true;
    case 'shieldsong':
      m.wardedDamage += pct;
      return true;
    case 'last_bastion':
      m.lowWardBonus += pct;
      // A line, not an amount: the higher one stands.
      m.lowWardBelow = Math.max(m.lowWardBelow, LAST_BASTION_BELOW);
      return true;
    case 'shatterglass':
    case 'sister_ward':
    case 'clean_strike':
    case 'clutch_peal':
    case 'bright_peal':
    case 'safe_harbour':
    case 'light_step':
    case 'second_toll':
    case 'tender_guard':
      return true;
    default:
      return false;
  }
}

/**
 * N6, Last Bastion: called in `castWard` (systems/techniques.ts), beside Blood Tithe, on the
 * Ward's barrier for `hero`, behind `if (world.mods.lowWardBonus > 0)`; returns the multiplier on
 * the barrier (1 + `lowWardBonus` while the hero is below `lowWardBelow` of their life). Only the
 * default Ward's path: a Chorale and an Aegis Link return before it. Neutral: exactly 1.
 */
export function lastBastionMult(world: World, hero: Entity): number {
  const h = hero.health;
  if (!h || !(world.mods.lowWardBonus > 0)) return 1;
  return h.hp < h.maxHp * world.mods.lowWardBelow ? 1 + world.mods.lowWardBonus : 1;
}
