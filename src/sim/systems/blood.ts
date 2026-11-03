/**
 * CONTRACT — Brann's Blood Rage (docs/phase-5b.md, "Passive: Blood Rage").
 *
 * The pure, read-only rules live here once and are shared: the sim, the bots, render and the UI
 * all call them (exported from src/sim/index.ts), so nobody re-derives a threshold. They read
 * only a hero's def, its talents, its health and its `blood` state, and draw no RNG. Every one is
 * neutral (0, false or 1) for a hero without `passive`, so the default party is untouched.
 *
 * The mutating hooks below them (`onBloodHit`, `tickBlood`, `afterBloodDamage`) act only on a
 * hero with `blood`, which only a Blood Rage def's hero has.
 */
import type { Content } from '../../content/schema';
import { bark } from '../combat/feedback';
import { heal, isActive, rising, type HealVia } from '../combat/health';
import { hasTalent, soloValue, talentFired, talentHolder, talentValue } from '../bonds';
import type { BloodState, Entity, ReadonlyEntity, WorldState } from '../state';
import type { World } from '../world';

/** Lifesteal is summed and announced (one `healApplied`) this often, in seconds. */
export const STEAL_FLUSH = 0.5;
/** The bleed rate's time constant, in seconds (an exponential average of damage a second). */
export const BLEED_TAU = 2;
/** The low-time stats' second line: 30% life. */
const LOW30 = 0.3;

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

/** The life below which Bloodlust (and Blood Tithe) holds: `quirk.below` × maxHp; 0 without. */
export function bloodLine(content: Heroes, e: ReadonlyEntity): number {
  const h = e.health;
  if (!e.hero?.blood || !h) return 0;
  return (defOf(content, e)?.quirk.below ?? 0) * h.maxHp;
}

// ── The mutating hooks (W1) ─────────────────────────────────────────────────────────────

/**
 * Berserker's Hymn's scale on every hero's damage: 1 + its `pct`% while the hero who holds it
 * (Brann) stands below its `below`% life; 1 otherwise, and always without it in the config.
 */
export function hymnScale(world: World): number {
  const holder = talentHolder(world, 'berserkers_hymn');
  if (!holder || !isActive(holder)) return 1;
  const h = holder.health;
  if (!(h.hp < (h.maxHp * talentValue(world, 'berserkers_hymn', 'below')) / 100)) return 1;
  return 1 + talentValue(world, 'berserkers_hymn', 'pct') / 100;
}

/**
 * A hero hit `target` for `dealt` (dealDamage's hero-hit block): when `source` has `blood`, its
 * axe drinks. Lifesteal is the def's share of the hit (×`solo.cuedPower` during a Cued Red
 * Frenzy) through `heal(…, 'lifesteal')`: cut by Wound, Bloodmoon and Wounding Strikes, never by
 * Blood Rage, 0 while he is held, and summed into `stealAcc` for `tickBlood`'s flush. During
 * Blood Brother it heals the hero you Thread instead (Cued: every hero in your field), via `solo`.
 */
export function onBloodHit(world: World, source: Entity, _target: Entity, dealt: number): void {
  const b = source.hero?.blood;
  if (!b || !(dealt > 0)) return;
  const def = defOf(world.content, source);
  if (!def?.passive) return;
  const hero = source.hero!;
  if (hero.soloId === 'blood_brother' && hero.soloActive > 0) {
    bloodBrother(world, source, dealt);
    return;
  }
  let amount = dealt * def.passive.lifesteal;
  if (hero.soloId === 'redFrenzy' && hero.soloActive > 0 && hero.soloCued)
    amount *= def.solo.cuedPower;
  const got = heal(world, source, amount, 'lifesteal', false);
  if (got > 0) {
    b.stealAcc += got;
    b.lifesteal += got;
  }
}

/** Blood Brother (Brann's alternate Solo): his axe feeds the hero you Thread, not him. */
function bloodBrother(world: World, brann: Entity, dealt: number): void {
  const cued = brann.hero!.soloCued;
  const share = soloValue(world, 'blood_brother', cued ? 'cuedPct' : 'pct') / 100;
  if (!(share > 0)) return;
  if (cued) {
    for (const id of world.party) {
      const ally = world.entities.get(id);
      if (isActive(ally) && ally.hero?.inField) heal(world, ally, dealt * share, 'solo');
    }
    return;
  }
  const slot = world.entities.get(world.weaverId)?.weaver?.threadSlot;
  if (slot === null || slot === undefined) return;
  const threaded = world.entities.get(world.party[slot] ?? -1);
  if (isActive(threaded)) heal(world, threaded, dealt * share, 'solo');
}

/**
 * After a hit on a Blood Rage hero landed (`before` → his life now, `dealt` of it): the bleed
 * rate; Deathless's trigger (once a fight, at or under its `pct`% life; a lethal blow was
 * already clamped to 1, and a Fermata hold at 1 starts it too); Berserker's Hymn turning on as
 * he crosses its line.
 */
export function afterBloodDamage(world: World, e: Entity, before: number, dealt: number): void {
  const b = e.hero?.blood;
  const h = e.health;
  if (!b || !h) return;
  if (dealt > 0) b.bleedRate += dealt / BLEED_TAU;
  if (h.hp <= 0) return;
  const hero = e.hero!;
  if (
    !hero.unbreakableUsed &&
    hasTalent(e, 'deathless') &&
    h.hp <= (h.maxHp * talentValue(world, 'deathless', 'pct')) / 100
  ) {
    // Deathless reuses `unbreakableUsed` (Unbreakable is Kael's: Brann never needs it).
    hero.unbreakableUsed = true;
    b.deathlessUntil = world.time + talentValue(world, 'deathless', 'seconds');
    talentFired(world, e, 'deathless', e.x, e.z);
  }
  if (hasTalent(e, 'berserkers_hymn')) {
    const line = (h.maxHp * talentValue(world, 'berserkers_hymn', 'below')) / 100;
    if (!(before < line) && h.hp < line) talentFired(world, e, 'berserkers_hymn', e.x, e.z);
  }
}

/** A lethal blow on a Blood Rage hero leaves him at 1: Deathless is open, or about to open. */
export function deathlessHolds(world: World, e: Entity): boolean {
  const hero = e.hero;
  if (!hero?.blood) return false;
  return deathlessActive(world, e) || (!hero.unbreakableUsed && hasTalent(e, 'deathless'));
}

/**
 * A Blood Rage hero's tick (updateHeroes, before anything else of his): the lifesteal flush
 * (one `healApplied` every `STEAL_FLUSH` s, source = him), the bleed rate's decay, Deathless's
 * end, the fight's low-life timers and `peakAfterLow`, and Bloodlust's answer to a Rally:
 * refused (a `bloodlust` event and one `defiant` bark; `refusedRally` = that Rally), or, below
 * his line, obeyed under Iron Will (an `iron_will` talentFired; `refusedRally` = −that Rally,
 * which reads as none). Draws no RNG but the defiant bark's cosmetic pick.
 */
export function tickBlood(world: World, e: Entity, dt: number): void {
  const b = e.hero?.blood;
  const h = e.health;
  if (!b || !h) return;
  if (world.time >= b.stealFlushAt) {
    if (b.stealAcc > 0) {
      world.events.push({
        type: 'healApplied',
        tick: world.tick,
        target: e.id,
        source: e.id,
        amount: b.stealAcc,
        overheal: 0,
        via: 'lifesteal',
      });
      b.stealAcc = 0;
    }
    b.stealFlushAt = world.time + STEAL_FLUSH;
  }
  if (b.bleedRate > 0) {
    b.bleedRate *= Math.max(0, 1 - dt / BLEED_TAU);
    if (b.bleedRate < 1e-3) b.bleedRate = 0;
  }
  if (b.deathlessUntil > 0 && world.time >= b.deathlessUntil) b.deathlessUntil = 0;
  if (h.dead || h.downed || world.encounter.status !== 'fighting') return;

  const line = bloodLine(world.content, e);
  b.aliveTime += dt;
  if (h.hp < line) b.lowTime += dt;
  if (h.hp < h.maxHp * LOW30) b.low30Time += dt;
  const frac = h.maxHp > 0 ? h.hp / h.maxHp : 0;
  if (b.peakAfterLow >= 0) {
    if (frac > b.peakAfterLow) b.peakAfterLow = frac;
  } else if (h.hp <= line) b.peakAfterLow = frac;

  const rally = world.internal.rallyUntil;
  if (rally > world.time && h.hp < line) {
    if (bloodlusting(world.content, e)) {
      if (b.refusedRally !== rally) {
        b.refusedRally = rally;
        world.events.push({ type: 'bloodlust', tick: world.tick, hero: e.id });
        bark(world, e, 'defiant', true);
      }
    } else if (b.refusedRally !== -rally) {
      // Below his line, yet he comes back: Iron Will, and your Ward on him.
      b.refusedRally = -rally;
      talentFired(world, e, 'iron_will', e.x, e.z);
    }
  }
}

/**
 * Bloodletting's price: its `lifeCost` share of his life, never taking him below its
 * `lifeFloor` share (0 when he's already there).
 */
export function bloodletCost(
  hp: number,
  maxHp: number,
  ability: { readonly lifeCost?: number; readonly lifeFloor?: number },
): number {
  return Math.max(
    0,
    Math.min(maxHp * (ability.lifeCost ?? 0), hp - maxHp * (ability.lifeFloor ?? 0)),
  );
}

/** The berserker's leash from the Weaver, in metres, while he isn't bloodlusting. */
export const BERSERKER_LEASH = 11;

/**
 * Sunder Leap's target (docs/phase-5b.md): an enemy `minRange`-`range` m away — your Focus
 * first, then an interruptible caster, then the nearest. None while he holds (a Hold, or
 * Fermata), while he answers a Rally, or (not bloodlusting) past his leash from the Weaver.
 * The Call opens on the same rule (calls.ts `canCall`). Draws nothing.
 */
export function leapTarget(
  world: World,
  e: Entity,
  ability: { readonly range: number; readonly minRange?: number },
): Entity | null {
  const hero = e.hero;
  if (!hero || hero.follow === 'hold' || hero.hold) return null;
  const lust = bloodlusting(world.content, e);
  if (!lust && world.internal.rallyUntil > world.time) return null;
  const weaver = world.entities.get(world.weaverId);
  const min = ability.minRange ?? 0;
  const fits = (m: Entity | undefined): m is Entity => {
    if (!m?.enemy || !isActive(m) || rising(m) || m.enemy.state === 'spawning') return false;
    const d2 = (m.x - e.x) * (m.x - e.x) + (m.z - e.z) * (m.z - e.z);
    const max = ability.range + m.radius;
    if (d2 < min * min || d2 > max * max) return false;
    if (lust || !weaver) return true;
    const reach = BERSERKER_LEASH + m.radius;
    return (m.x - weaver.x) ** 2 + (m.z - weaver.z) ** 2 <= reach * reach;
  };
  const focus = world.focusTarget === null ? undefined : world.entities.get(world.focusTarget);
  if (fits(focus)) return focus;
  let caster: Entity | null = null;
  let casterD = Infinity;
  let nearest: Entity | null = null;
  let nearestD = Infinity;
  for (const m of world.entities.list()) {
    if (!fits(m)) continue;
    const d2 = (m.x - e.x) * (m.x - e.x) + (m.z - e.z) * (m.z - e.z);
    if (m.enemy!.cast?.interruptible && d2 < casterD) {
      caster = m;
      casterD = d2;
    }
    if (d2 < nearestD) {
      nearest = m;
      nearestD = d2;
    }
  }
  return caster ?? nearest;
}

/** The down record's `blood`: a refused Rally still live, and the Weaver-heal multiplier now. */
export function refusedRallyLive(world: World, e: ReadonlyEntity): boolean {
  const b = e.hero?.blood;
  const rally = world.internal.rallyUntil;
  return !!b && b.refusedRally > 0 && b.refusedRally === rally && rally > world.time;
}
