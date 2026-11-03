/**
 * CONTRACT — Brann's Blood Rage (docs/phase-5b.md, "Passive: Blood Rage").
 *
 * The pure, read-only rules live here once and are shared: the sim, the bots, render and the UI
 * all call them (exported from src/sim/index.ts), so nobody re-derives a threshold. They read
 * only a hero's def, its talents, its health and its `blood` state, and draw no RNG. Every one is
 * neutral (0, false or 1) for a hero without `passive`, so the default party is untouched.
 *
 * The mutating hooks (`onBloodHit`, `tickBlood`) are W1's; W0 lands their signatures as no-ops.
 */
import type { Content } from '../../content/schema';
import type { HealVia } from '../combat/health';
import type { BloodState, Entity, ReadonlyEntity, WorldState } from '../state';
import type { World } from '../world';

type Heroes = Pick<Content, 'heroes'>;
type HeroesAndTalents = Pick<Content, 'heroes' | 'talents'>;

/** A fresh `BloodState` (set at spawn for a hero whose def has `passive`). */
export function newBlood(): BloodState {
  return {
    lifesteal: 0,
    stealAcc: 0,
    stealFlushAt: 0,
    lowTime: 0,
    low30Time: 0,
    aliveTime: 0,
    peakAfterLow: -1,
    oathBank: 0,
    bloodlet: 0,
    deathlessUntil: 0,
    refusedRally: 0,
    bleedRate: 0,
    spent: 0,
  };
}

/**
 * The Weaver's healing that Blood Rage halves: Mend, the Chime, the auras, Rewind and the rest.
 * Revive, Solos, self-heals and lifesteal aren't (and shields and barriers aren't healing).
 */
export function isWeaverVia(via: HealVia): boolean {
  return via === 'mend' || via === 'chime' || via === 'aura' || via === 'rewind' || via === 'other';
}

function defOf(content: Heroes, e: ReadonlyEntity) {
  const id = e.hero?.defId;
  return id === undefined ? undefined : content.heroes.find((h) => h.id === id);
}

function talentNumber(content: HeroesAndTalents, id: string, key: string): number | undefined {
  return content.talents.find((t) => t.id === id)?.values[key];
}

function has(e: ReadonlyEntity, talent: string): boolean {
  return e.hero?.talents.includes(talent) ?? false;
}

/**
 * Blood Rage's damage bonus now: `perMissing` × missing life, up to `maxBonus` (Red Mist:
 * its `max`%). 0 for a hero without `passive`, without health, or downed or dead (a fallen
 * hero swings nothing, so no HUD chip or bot reads a rage he can't use).
 */
export function bloodRageBonus(content: HeroesAndTalents, e: ReadonlyEntity): number {
  const passive = defOf(content, e)?.passive;
  const h = e.health;
  if (!passive || !h || h.downed || h.dead || h.maxHp <= 0) return 0;
  const cap = has(e, 'red_mist')
    ? (talentNumber(content, 'red_mist', 'max') ?? passive.maxBonus * 100) / 100
    : passive.maxBonus;
  const missing = 1 - h.hp / h.maxHp;
  const bonus = passive.perMissing * (missing > 0 ? missing : 0);
  return bonus < cap ? bonus : cap;
}

/**
 * Bloodlust: a hero with `blood` below its quirk's `below` × maxHp, unless Iron Will and one of
 * the Weaver's Wards holds it. While it holds he ignores Rally and has no leash. Never while
 * downed or dead: a fallen hero refuses nothing, so the bots' Rally limits and the HUD chip lift.
 */
export function bloodlusting(content: HeroesAndTalents, e: ReadonlyEntity): boolean {
  const h = e.health;
  if (!e.hero?.blood || !h || h.downed || h.dead) return false;
  const below = defOf(content, e)?.quirk.below;
  if (below === undefined || !(h.hp < below * h.maxHp)) return false;
  return !(has(e, 'iron_will') && h.shields.some((s) => s.kind === 'ward'));
}

/**
 * The multiplier on a heal of this kind on this hero: the def's `weaverHealMult` for the
 * Weaver's vias on a Blood Rage hero (lifted by Blood Oath); 1 otherwise.
 */
export function weaverHealCut(content: Heroes, e: ReadonlyEntity, via: HealVia): number {
  const passive = defOf(content, e)?.passive;
  if (!passive || !isWeaverVia(via) || has(e, 'blood_oath')) return 1;
  return passive.weaverHealMult;
}

/**
 * Falling fast: the damage of the last ~2 s (twice the bleed rate's per-second average) is at
 * least the life he has left. Drives his critical alarm; Bloodletting never counts.
 */
export function fallingFast(e: ReadonlyEntity): boolean {
  const b = e.hero?.blood;
  const h = e.health;
  if (!b || !h || h.downed || h.dead || !(b.bleedRate > 0)) return false;
  return 2 * b.bleedRate >= h.hp;
}

/** Deathless's window is open: he can't drop below 1 life until it ends. */
export function deathlessActive(world: Pick<WorldState, 'time'>, e: ReadonlyEntity): boolean {
  const until = e.hero?.blood?.deathlessUntil ?? 0;
  return until > 0 && world.time < until;
}

/**
 * A hero hit `target` for `dealt`: when `source` has `blood`, its axe drinks (lifesteal). W0
 * stub: does nothing (W1 implements it).
 */
export function onBloodHit(_world: World, _source: Entity, _target: Entity, _dealt: number): void {}

/**
 * A Blood Rage hero's tick: lifesteal flushes, low-life timers, the bleed rate, Deathless. W0
 * stub: does nothing (W1 implements it).
 */
export function tickBlood(_world: World, _e: Entity, _dt: number): void {}
