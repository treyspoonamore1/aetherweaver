import type { Entity } from '../state';
import type { World } from '../world';
import { heroFx } from '../combat/auras';
import { empowerBonus } from './thread';
import { hasTalent, talentValue } from '../bonds';

const CRIT_CHANCE = 0.1;
const CRIT_MULT = 1.6;

export interface HeroHit {
  amount: number;
  /** The Weaver's share of `amount`: the auras' and Empower's parts (and a Flourish's). */
  amplified: number;
  /** The auras' part of `amplified`. */
  aura: number;
  /** Empower's part of `amplified`. */
  empower: number;
  crit: boolean;
  empowered: boolean;
}

/**
 * A hero hit's damage: (base + Fortissimo flat) × (1 + Fortissimo) × (1 + Empower) × crit.
 * Everything above the hero's own base × crit is the Weaver's amplified share, the auras'
 * part counted first. A basic attack (`hasted`) also credits the extra hits the auras' and
 * Empower's attack speed buy: at this pace, the hero alone would have dealt
 * own × (their own pace) / pace per hit.
 */
export function heroDamage(
  world: World,
  hero: Entity,
  base: number,
  critBonus: number,
  hasted = false,
): HeroHit {
  const fx = heroFx(world, hero);
  const empower = empowerBonus(world, hero);
  const crit = world.rng.combat.chance(CRIT_CHANCE + critBonus);
  const critMult = crit ? CRIT_MULT : 1;
  const own = base * critMult;
  const withAuras = (base + fx.flatDamage) * (1 + fx.damage) * critMult;
  const amount = withAuras * (1 + empower.more);
  const empowered = empower.more > 0;
  if (!hasted) {
    const aura = withAuras - own;
    const boost = amount - withAuras;
    return { amount, amplified: aura + boost, aura, empower: boost, crit, empowered };
  }
  const pace = heroAttackSpeed(world, hero);
  const ownPace = pace - fx.attackSpeed - empower.attackSpeed;
  const auraPace = ownPace + fx.attackSpeed;
  // Damage rates (per base attack rate): alone, with the auras, with everything.
  const aura = (withAuras * auraPace - own * ownPace) / pace;
  const boost = (amount * pace - withAuras * auraPace) / pace;
  return { amount, amplified: aura + boost, aura, empower: boost, crit, empowered };
}

/** Attack-speed multiplier from auras, Empower and motifs. */
export function heroAttackSpeed(world: World, hero: Entity): number {
  let bonus = heroFx(world, hero).attackSpeed + empowerBonus(world, hero).attackSpeed;
  if (hero.hero?.defId === 'lyra' && hero.hero.inField) bonus += world.mods.lyraAttackSpeed;
  // Last Light (Bonds): Lyra, low, shoots faster. Her own pace, not your share.
  const h = hero.health;
  if (
    h &&
    hasTalent(hero, 'last_light') &&
    h.hp < (h.maxHp * talentValue(world, 'last_light', 'below')) / 100
  )
    bonus += talentValue(world, 'last_light', 'pct') / 100;
  return 1 + bonus;
}

/** A hero's basic attack reach: Hawk Eye (Bonds) takes Lyra's farther. */
export function attackRange(world: World, hero: Entity, range: number): number {
  return hasTalent(hero, 'hawk_eye') ? range + talentValue(world, 'hawk_eye', 'range') : range;
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
