/**
 * CONTRACT — Seren, the Riposte (docs/phase-5e.md, "Seren" and "New sim primitives").
 *
 * W0b lands this file: the pure, read-only rules (real, shared by sim, render, bots and UI, and
 * exported from src/sim/index.ts) and every hook the shared sim files call, each a no-op until
 * W1 fills it. Every hook is reached only through a guard that is false without Seren in the
 * party (`hero.duel`, `def.role === 'duelist'`, `ability.id === 'lunge'`), so no other party's
 * state, draws or hashes can change. Nothing here draws RNG.
 */
import { attackDef, enemyDef } from '../../content';
import type { AttackDef, HeroDef } from '../../content/schema';
import { DUEL_CLAMP, DUEL_PICK, HEAVY_LIFE, PARRY_REACH } from '../../content/rosterIds';
import type { DamageOpts, DamageResult } from '../combat/health';
import type {
  DeepReadonly,
  DuelState,
  Entity,
  ReadonlyEntity,
  Telegraph,
  WorldState,
} from '../state';
import type { World } from '../world';
import { clampPointToArena } from './physics';

type Ability = HeroDef['abilities'][number];
type Flourish = HeroDef['call']['flourish'];

/** Showboat leaves a Kael-held enemy to him when anything else will do. */
const KAEL = 'kael';
/** Overextended: this many enemies on her, or below this share of life outside every field. */
const SURROUNDED = 3;
const LOW_OUTSIDE = 0.4;
/** Lunge: within this many metres of a caster it is a contact thrust (no dash). */
export const LUNGE_CONTACT = 3.5;
/** A Lunge lands this far short of its target's edge. */
const LUNGE_SHORT = 1.2;

// ── State ─────────────────────────────────────────────────────────────────────────────

/** A fresh `DuelState` (set at spawn for a hero whose passive is `parry`). */
export function newDuel(): DuelState {
  return {
    parryOn: null,
    killShotOn: null,
    quarry: null,
    quarryUntil: 0,
    showboatQuietUntil: 0,
    parries: 0,
    killShots: 0,
    counterDamage: 0,
    overextendedTime: 0,
  };
}

// ── Pure rules (real) ─────────────────────────────────────────────────────────────────

/**
 * The parry's shape rule (docs/phase-5e.md, "Parry: what is melee"): a damaging cone ('cleave')
 * telegraph of radius `PARRY_REACH` m or less. An enemy's basic melee swing is the other case,
 * marked by `DamageOpts.melee`. Crimson Tide (r 30), the Tolls and every beam, burst, donut,
 * mark, link, raid, bolt and zone are never parryable.
 */
export function parryable(
  attack: DeepReadonly<Pick<AttackDef, 'kind' | 'radius' | 'effect'>> | null | undefined,
): boolean {
  return (
    !!attack &&
    attack.kind === 'cleave' &&
    attack.effect === 'damage' &&
    attack.radius <= PARRY_REACH
  );
}

/**
 * Seren stands en garde: a Weaver Ward is on her (the plain Ward, every castWard variant, a
 * Chorale's plain Ward, an Echo Ward: any `ward` shield the Weaver made), or Blade Waltz holds.
 * Aegis Link, Swap's barrier (not the Weaver's on a hero), Ostinato, relic barriers and domes
 * don't arm it. False for every other hero.
 */
export function parryArmed(e: ReadonlyEntity): boolean {
  const hero = e.hero;
  if (!hero?.duel || !e.health) return false;
  if (hero.soloId === 'blade_waltz' && hero.soloActive > 0) return true;
  return e.health.shields.some((s) => s.kind === 'ward' && s.fromWeaver);
}

/**
 * Heavy (docs/phase-5e.md, "Heavy foes"): a normal or elite enemy whose def has at least
 * `HEAVY_LIFE` base life (today only the Hollow Champion). Never executed by a kill shot, never
 * taunted or rooted by summons. Bosses and minibosses are excluded by tier on their own, and
 * read false here.
 */
export function heavy(_world: WorldState, e: ReadonlyEntity): boolean {
  const c = e.enemy;
  if (!c || (c.tier !== 'normal' && c.tier !== 'elite')) return false;
  return enemyDef(c.defId).hp >= HEAVY_LIFE;
}

const TIER_RANK = { normal: 0, elite: 1, miniboss: 2, boss: 3 } as const;

function live(m: ReadonlyEntity | undefined): m is ReadonlyEntity {
  return (
    !!m?.enemy && !!m.health && !m.health.dead && !m.health.downed && m.enemy.state !== 'spawning'
  );
}

/**
 * Showboat's pick (docs/phase-5e.md, "Showboat target"): the strongest enemy within `DUEL_PICK`
 * m of the Weaver — by tier (boss > miniboss > elite > normal), then max life, then id. Your
 * Focus overrides. Stationary enemies (Void Maw, Spindles) are skipped unless Focused. With Kael
 * in the party she prefers enemies not targeting him; if his is the only choice, she takes it
 * (and duels it from the flank). Cold Focus: only your Focus or an enemy inside your field.
 * Null without a candidate, or for a hero who isn't a duellist. Reads state only; draws nothing.
 */
export function duelTarget(world: WorldState, e: ReadonlyEntity): ReadonlyEntity | null {
  if (!e.hero?.duel) return null;
  const focus = world.focusTarget === null ? undefined : world.entities.get(world.focusTarget);
  if (live(focus)) return focus;
  const weaver = world.entities.get(world.weaverId);
  if (!weaver) return null;
  let kaelId: number | null = null;
  for (const id of world.party) {
    const p = world.entities.get(id);
    if (p?.hero?.defId === KAEL) kaelId = p.id;
  }
  const kael = kaelId === null ? undefined : world.entities.get(kaelId);
  const kaelTarget = kael?.hero?.targetId ?? null;
  const cold = e.hero.talents.includes('cold_focus');
  let best: ReadonlyEntity | null = null;
  let bestKael = true;
  for (const m of world.entities.list()) {
    if (!live(m)) continue;
    const reach = DUEL_PICK + m.radius;
    const dx = m.x - weaver.x;
    const dz = m.z - weaver.z;
    if (dx * dx + dz * dz > reach * reach) continue;
    if (enemyDef(m.enemy!.defId).stationary === true) continue;
    if (cold && !m.enemy!.inField) continue;
    const onKael = kaelTarget !== null && (m.id === kaelTarget || m.enemy!.targetId === kaelId);
    if (best === null || better(m, onKael, best, bestKael)) {
      best = m;
      bestKael = onKael;
    }
  }
  return best;
}

/** `a` beats `b`: not Kael's over Kael's, then tier, then max life, then the lower id. */
function better(a: ReadonlyEntity, aKael: boolean, b: ReadonlyEntity, bKael: boolean): boolean {
  if (aKael !== bKael) return !aKael;
  const ta = TIER_RANK[a.enemy!.tier];
  const tb = TIER_RANK[b.enemy!.tier];
  if (ta !== tb) return ta > tb;
  const la = a.health!.maxHp;
  const lb = b.health!.maxHp;
  if (la !== lb) return la > lb;
  return a.id < b.id;
}

/** Does any standing boss or miniboss have an interruptible special (Lunge waits for it)? */
function interruptibleBoss(world: WorldState): boolean {
  for (const m of world.entities.list()) {
    const c = m.enemy;
    if (!c || (c.tier !== 'boss' && c.tier !== 'miniboss') || !m.health || m.health.dead) continue;
    for (const id of enemyDef(c.defId).specials) {
      const a = attackDef(id);
      if (a?.interruptible) return true;
    }
  }
  return false;
}

const lungeAt = { x: 0, z: 0 };

/**
 * Where a Lunge at `target` would land: `LUNGE_SHORT` m short of its edge along her line to it
 * (a contact thrust within `LUNGE_CONTACT`: where she stands), kept in the arena.
 */
export function lungeLanding(
  world: World,
  e: ReadonlyEntity,
  target: ReadonlyEntity,
): { x: number; z: number } {
  const dx = target.x - e.x;
  const dz = target.z - e.z;
  const d = Math.sqrt(dx * dx + dz * dz);
  if (d <= LUNGE_CONTACT + target.radius || d < 1e-6) {
    lungeAt.x = e.x;
    lungeAt.z = e.z;
    return lungeAt;
  }
  const back = Math.min(d, target.radius + LUNGE_SHORT);
  lungeAt.x = target.x - (dx / d) * back;
  lungeAt.z = target.z - (dz / d) * back;
  clampPointToArena(world, lungeAt, e.radius);
  return lungeAt;
}

/**
 * Lunge's target (docs/phase-5e.md, "Lunge"): an interruptible caster within `range` m at any
 * distance (within `LUNGE_CONTACT` m, a contact thrust), else her quarry `minRange`–`range` m
 * away; every landing within `DUEL_CLAMP` m of the Weaver. Refused while Held, Scattered with a
 * link on her, rooted, pinned or latched, during a Rally, and for a hero who isn't a duellist.
 * In a fight whose boss or miniboss has an interruptible special, only casters. Draws nothing.
 */
export function lungeTarget(
  world: World,
  e: Entity,
  ability: { readonly range: number; readonly minRange?: number },
): Entity | null {
  const hero = e.hero;
  const duel = hero?.duel;
  if (!hero || !duel || hero.follow === 'hold' || hero.hold) return null;
  const has = (id: string) => e.health?.statuses.some((s) => s.id === id) ?? false;
  if (hero.follow === 'scatter' && (has('resound') || has('pact') || has('stitch'))) return null;
  if (has('pinned') || has('stitched') || has('latched')) return null;
  if (world.internal.rallyUntil > world.time) return null;
  const weaver = world.entities.get(world.weaverId);
  if (!weaver) return null;
  const clamp = DUEL_CLAMP * DUEL_CLAMP;
  const lands = (m: Entity) => {
    const p = lungeLanding(world, e, m);
    return (p.x - weaver.x) ** 2 + (p.z - weaver.z) ** 2 <= clamp;
  };
  let caster: Entity | null = null;
  let casterD = Infinity;
  for (const m of world.entities.list()) {
    if (!live(m) || !m.enemy!.cast?.interruptible) continue;
    const d2 = (m.x - e.x) ** 2 + (m.z - e.z) ** 2;
    const max = ability.range + m.radius;
    if (d2 > max * max || d2 >= casterD || !lands(m)) continue;
    caster = m;
    casterD = d2;
  }
  if (caster) return caster;
  if (interruptibleBoss(world)) return null;
  const quarry = duel.quarry === null ? undefined : world.entities.get(duel.quarry);
  if (!live(quarry)) return null;
  const d2 = (quarry.x - e.x) ** 2 + (quarry.z - e.z) ** 2;
  const min = ability.minRange ?? 0;
  const max = ability.range + quarry.radius;
  if (d2 < min * min || d2 > max * max || !lands(quarry)) return null;
  return quarry;
}

/**
 * Overextended (docs/phase-5e.md): duelling, with `SURROUNDED` or more enemies targeting her,
 * or below 40% life outside every field. One rule for HUD, bots and recaps. False for every
 * other hero, and while she has no quarry.
 */
export function overextended(world: WorldState, e: ReadonlyEntity): boolean {
  const duel = e.hero?.duel;
  const h = e.health;
  if (!duel || duel.quarry === null || !h || h.dead || h.downed) return false;
  if (h.hp < h.maxHp * LOW_OUTSIDE && !e.hero!.inField) return true;
  let on = 0;
  for (const m of world.entities.list())
    if (live(m) && m.enemy!.targetId === e.id && ++on >= SURROUNDED) return true;
  return false;
}

/**
 * The parry's melee test on a telegraph (computed in `hitEntity` only for a duel victim): a
 * parryable cone whose target is her. A cone aimed at another hero that catches her is not.
 */
export function duelMelee(
  t: DeepReadonly<Telegraph>,
  attack: DeepReadonly<AttackDef> | null,
  e: ReadonlyEntity,
): boolean {
  return t.target === e.id && t.kind === 'cleave' && parryable(attack);
}

/**
 * Warded, she stands her ground (docs/phase-5e.md, "Seren's stance and dodge"): she never rolls
 * a dodge on a parryable blow aimed at her while armed. `noticeTelegraphs` skips the roll then.
 */
export function duelStands(world: World, e: Entity, t: DeepReadonly<Telegraph>): boolean {
  if (!parryArmed(e) || t.target !== e.id || t.kind !== 'cleave') return false;
  return parryable(world.content.attacks.find((a) => a.id === t.attackId));
}

/** Clamps `p` to `DUEL_CLAMP` m from the Weaver, then into the arena (every Seren destination). */
export function clampDuel(world: World, e: ReadonlyEntity, p: { x: number; z: number }): void {
  const weaver = world.entities.get(world.weaverId);
  if (weaver) {
    const dx = p.x - weaver.x;
    const dz = p.z - weaver.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d > DUEL_CLAMP) {
      p.x = weaver.x + (dx / d) * DUEL_CLAMP;
      p.z = weaver.z + (dz / d) * DUEL_CLAMP;
    }
  }
  clampPointToArena(world, p, e.radius);
}

/**
 * A Perfect Ward on a telegraph aimed at her marks a kill shot on its owner, taken next tick
 * (`perfect()` calls this beside Riposte Bash). Every other Perfect effect still happens.
 */
export function markKillShot(
  world: World,
  e: Entity,
  owner: Entity,
  t: DeepReadonly<Telegraph>,
): void {
  const duel = e.hero?.duel;
  if (!duel || t.target !== e.id || !owner.enemy) return;
  duel.killShotOn = owner.id;
  void world;
}

// ── Hooks (no-ops until W1) ───────────────────────────────────────────────────────────

/**
 * The parry intercept (dealDamage, after the Sphere, Oathkeeper and the Aegis Link share, before
 * guards, armour, Fermata and shields). Called only for a duel victim and never for a redirected
 * share (`opts.oath`). Returns the parry's result (`dealt 0, absorbed 0, parried`) or null.
 */
export function parryIntercept(
  _world: World,
  _target: Entity,
  _source: Entity | undefined,
  _opts: DamageOpts,
): DamageResult | null {
  return null;
}

/** A telegraph's blow was parried (`hitEntity`): answered, the Ward-absorb Resonance, the save. */
export function duelResolved(
  _world: World,
  _t: Telegraph,
  _e: Entity,
  _result: DamageResult,
  _wouldDie: boolean,
): void {}

/** Each tick, after `isDisabled`: the deferred counter and kill shot, Showboat, the stance. */
export function duelTick(_world: World, _e: Entity, _def: HeroDef, _dt: number): void {}

/** Downed or disabled this tick: a pending counter or kill shot is lost. */
export function duelLost(_world: World, _e: Entity): void {}

/** `chooseTarget`'s duelist arm: her pick, or undefined for the shared rule. */
export function duelChooseTarget(
  _world: World,
  _weaver: Entity,
  _e: Entity,
  _def: HeroDef,
): Entity | null | undefined {
  return undefined;
}

/** `targetInSight`'s duelist arm (after the Focus): her pick, or undefined for the shared rule. */
export function duelTargetInSight(
  _world: World,
  _weaver: Entity,
  _e: Entity,
  _def: HeroDef,
  _current: Entity | undefined,
): Entity | null | undefined {
  return undefined;
}

/**
 * `combatMove`'s duelist arm (before the flank): writes `out` (face to face, or at the flank)
 * and returns true; `combatMove` then steps her out of others' blows and clamps her. False: the
 * shared ranged branch.
 */
export function duelMove(
  _world: World,
  _weaver: Entity,
  _e: Entity,
  _def: HeroDef,
  _target: Entity,
  _out: { x: number; z: number },
): boolean {
  return false;
}

/** `tryAbilities`: Lunge's or Feint's target now, or null (not this tick). */
export function duelAbility(
  _world: World,
  _e: Entity,
  _def: HeroDef,
  _ability: Ability,
  _target: Entity,
): Entity | null {
  return null;
}

/** `executeAbility`: Lunge and Feint (`flourish`: Flèche). `emit` reports the ability. */
export function duelExecute(
  _world: World,
  _e: Entity,
  _def: HeroDef,
  _index: 0 | 1,
  _target: Entity | undefined,
  _x: number,
  _z: number,
  _flourish: Flourish | null,
  _emit: (x: number, z: number, radius: number) => void,
): void {}

/** `startSolo`: Thousand Cuts or Blade Waltz begins. */
export function duelSoloStart(
  _world: World,
  _hero: Entity,
  _cued: boolean,
  _duration: number,
): void {}

/** `updateSolo`: Thousand Cuts' pulses, Blade Waltz. */
export function duelSolo(_world: World, _hero: Entity, _def: HeroDef): void {}

/** `finishSolo`: Thousand Cuts returns her to its start. */
export function duelSoloEnd(_world: World, _hero: Entity): void {}

/** `tickSoloClock` (she can't act): a stun ends Thousand Cuts. */
export function duelSoloClock(_world: World, _hero: Entity): void {}

/** `updateSolo`'s cast bar for a Cued Thousand Cuts, whose kills extend it (`duel.cutsEnd`). */
export function duelCastProgress(_world: World, _hero: Entity, progress: number): number {
  return progress;
}
