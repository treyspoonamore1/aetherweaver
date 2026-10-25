import type { Entity } from '../state';
import type { World } from '../world';
import { heroFx } from '../combat/auras';
import { empowerBonus } from './thread';

const CRIT_CHANCE = 0.1;
const CRIT_MULT = 1.6;

export interface HeroHit {
  amount: number;
  /** The Weaver's share of `amount` (auras + Empower). */
  amplified: number;
  crit: boolean;
  empowered: boolean;
}

/**
 * A hero hit's damage: (base + Fortissimo flat) × (1 + Fortissimo) × (1 + Empower) × crit.
 * Everything above the hero's own base × crit is the Weaver's amplified share (gold chips).
 */
export function heroDamage(world: World, hero: Entity, base: number, critBonus: number): HeroHit {
  const fx = heroFx(world, hero);
  const empower = empowerBonus(world, hero);
  const crit = world.rng.combat.chance(CRIT_CHANCE + critBonus);
  const critMult = crit ? CRIT_MULT : 1;
  const own = base * critMult;
  const amount = (base + fx.flatDamage) * (1 + fx.damage) * (1 + empower.more) * critMult;
  return { amount, amplified: amount - own, crit, empowered: empower.more > 0 };
}

/** Attack-speed multiplier from auras, Empower and motifs. */
export function heroAttackSpeed(world: World, hero: Entity): number {
  let bonus = heroFx(world, hero).attackSpeed + empowerBonus(world, hero).attackSpeed;
  if (hero.hero?.defId === 'lyra' && hero.hero.inField) bonus += world.mods.lyraAttackSpeed;
  return 1 + bonus;
}

/**
 * A Flourish hit (an answered call): the ability, stronger. It only happens because the
 * Weaver answered, so everything above the plain base hit counts as the Weaver's share.
 */
export function flourishHit(
  world: World,
  hero: Entity,
  base: number,
  f: { damageMult: number; crit: boolean },
): HeroHit {
  const hit = heroDamage(world, hero, base * f.damageMult, f.crit ? 1 : 0);
  return { ...hit, amplified: Math.max(hit.amplified, hit.amount - base) };
}
