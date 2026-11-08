/**
 * CONTRACT — Oro, the Grovekeeper (docs/phase-5e.md, "Oro" and "The summon model").
 *
 * W0b lands this file: the pure, read-only rules (real, exported from src/sim/index.ts) and the
 * hooks the shared sim files call, each a no-op until W2 fills it (W2b adds the answered aura
 * reach, Q1-Q3, in field.ts and auras.ts). Every hook is reached only through a guard that is
 * false without Oro in the party (`hero.grove`, `def.role === 'summoner'`, `target.summon`,
 * `world.internal.summons`), so no other party's state, draws or hashes can change. Nothing
 * here draws RNG.
 */
import { enemyDef, heroDef } from '../../content';
import type { HeroDef } from '../../content/schema';
import { pickEnemyTarget } from '../combat/threat';
import type { DamageOpts } from '../combat/health';
import type { Entity, EntityId, GroveState, ReadonlyEntity, WorldState } from '../state';
import type { World } from '../world';
import { heavy } from './duel';
import { inAnyField, underMuteDome } from './field';

type Ability = HeroDef['abilities'][number];
type Flourish = HeroDef['call']['flourish'];

/** Regrowth's Call opens when a Sapling is felled or below this share of its life. */
const CALL_BELOW = 0.6;

// ── State ─────────────────────────────────────────────────────────────────────────────

/** A fresh `GroveState` (set at spawn for a hero whose passive is `rootbond`). */
export function newGrove(): GroveState {
  return {
    saplings: [],
    respawnAt: [],
    ancient: null,
    lost: 0,
    rootbondHeal: 0,
    inFieldTime: 0,
    aliveTime: 0,
  };
}

// ── Pure rules (real) ─────────────────────────────────────────────────────────────────

/** One of Oro's summons (a Sapling or the Ancient). */
export function isSummon(e: ReadonlyEntity | undefined): boolean {
  return e?.summon !== undefined;
}

/**
 * `owner`'s summons standing now (every summon with `owner` null), in entity order. Empty in
 * every party without Oro: no summon entity exists there.
 */
export function summonsOf(world: WorldState, owner: EntityId | null = null): ReadonlyEntity[] {
  const out: ReadonlyEntity[] = [];
  for (const e of world.entities.list()) {
    const s = e.summon;
    if (!s || !e.health || e.health.dead) continue;
    if (owner === null || s.owner === owner) out.push(e);
  }
  return out;
}

/**
 * A summon (or any body) stands inside your field (docs/phase-5e.md Q1), composed from public
 * state exactly as the private `inDome`/`inHymn` tests inside `coverage()`: your field isn't
 * suppressed (the Weaver downed or in a dome), no Mute or Silencing dome covers it (unless
 * Unbroken Chorus holds), it is inside a hymn circle whenever any exist, and inside a field.
 */
export function saplingInField(
  world: WorldState,
  s: Pick<ReadonlyEntity, 'x' | 'z' | 'radius'>,
): boolean {
  const f = world.field;
  if (f.suppressed) return false;
  if (!world.mods.unsuppressible && underMuteDome(world, s.x, s.z)) return false;
  if (f.hymnCircles.length > 0) {
    let inside = false;
    for (const c of f.hymnCircles) {
      const r = c.r + s.radius;
      if ((s.x - c.x) ** 2 + (s.z - c.z) ** 2 <= r * r) inside = true;
    }
    if (!inside) return false;
  }
  return inAnyField(world as World, s.x, s.z, s.radius);
}

/** Gentle (docs/phase-5e.md): Oro with no living Focus target is tending, and won't attack. */
export function gentle(world: WorldState, e: ReadonlyEntity): boolean {
  if (!e.hero?.grove) return false;
  const quirk = heroDef(e.hero.defId).quirk;
  if (quirk.id !== 'gentle') return false;
  const focus = world.focusTarget === null ? undefined : world.entities.get(world.focusTarget);
  return !focus?.enemy || !focus.health || focus.health.dead;
}

/** Regrowth's Call opens (docs/phase-5e.md): a Sapling is felled or below 60% of its life. */
export function groveCallReady(world: WorldState, e: ReadonlyEntity): boolean {
  const grove = e.hero?.grove;
  if (!grove) return false;
  if (grove.respawnAt.some((at) => at > 0)) return true;
  for (const id of grove.saplings) {
    const s = world.entities.get(id);
    const h = s?.health;
    if (!s?.summon || !h || h.dead || h.hp < h.maxHp * CALL_BELOW) return true;
  }
  return false;
}

/**
 * Can Oro's root hold this enemy (docs/phase-5e.md, "Enemy root")? A normal or elite, non-heavy
 * enemy that isn't root-immune. Bosses, minibosses, heavy foes, heroes and summons never are.
 */
export function rootable(world: WorldState, e: ReadonlyEntity): boolean {
  const c = e.enemy;
  if (!c || (c.tier !== 'normal' && c.tier !== 'elite') || heavy(world, e)) return false;
  return c.rootImmuneUntil === undefined || world.time >= c.rootImmuneUntil;
}

/**
 * Rooted now: no approach, chase, charge or leap (attacks and casts go on). The immunity key is
 * set whenever a root lands, so the status scan runs only for an enemy Oro has rooted.
 */
export function enemyRooted(e: ReadonlyEntity): boolean {
  if (e.enemy?.rootImmuneUntil === undefined) return false;
  return e.health?.statuses.some((s) => s.id === 'rooted') ?? false;
}

/** A summon's armour against ordinary hits (its owner's content). */
export function summonArmor(world: World, e: ReadonlyEntity): number {
  const s = e.summon;
  if (!s) return 0;
  const owner = world.entities.get(s.owner);
  const summons = owner?.hero ? heroDef(owner.hero.defId).summons : undefined;
  if (!summons) return 0;
  return s.kind === 'ancient' ? summons.ancient.armor : summons.sapling.armor;
}

/**
 * A special that would aim at a summon (a taunt holds its owner there) re-aims at the party
 * member it would pick without the taunt (docs/phase-5e.md, "Telegraphs on summons"). The taunt
 * is left as it was. Null when there is no one.
 */
export function untauntedTarget(world: World, e: Entity): Entity | null {
  const c = e.enemy!;
  const taunt = c.tauntTarget;
  c.tauntTarget = null;
  const id = pickEnemyTarget(world, e);
  c.tauntTarget = taunt;
  const t = id === null ? undefined : world.entities.get(id);
  return t && !t.summon ? t : null;
}

/** A foe summons may hold (taunt, root): normal or elite, and not heavy. */
export function lesserFoe(world: WorldState, e: ReadonlyEntity): boolean {
  const c = e.enemy;
  return !!c && (c.tier === 'normal' || c.tier === 'elite') && !heavy(world, e);
}

/** Is `e` stationary (a Void Maw, a Spindle)? Saplings swing at those only when Focused. */
export function stationaryFoe(e: ReadonlyEntity): boolean {
  return !!e.enemy && enemyDef(e.enemy.defId).stationary === true;
}

/** Weaver healing or shielding on a summon is its owner's support (Bond XP). */
export function summonSupport(world: World, summon: Entity, amount: number): void {
  if (!(amount > 0) || !summon.summon) return;
  const owner = world.entities.get(summon.summon.owner);
  if (owner?.hero) owner.hero.supportReceived += amount;
}

// ── Hooks (no-ops until W2) ───────────────────────────────────────────────────────────

/** world.ts, after the party loop: Oro's Saplings sprout at the Weaver's front spots. */
export function spawnGrove(_world: World): void {}

/** api.ts, after `updateField`: the grove's field bookkeeping (W2b: Q1-Q3). */
export function groveAfterField(world: World, _dt: number): void {
  if (!world.internal.summons) return;
}

/** Each tick, after `isDisabled`: Gentle's tending, the Focus bark, Regrowth's AI. */
export function groveTick(_world: World, _e: Entity, _def: HeroDef, _dt: number): void {}

/** heroes.ts:131: his Solo charges while a Sapling fights, though he doesn't. */
export function groveCharge(_world: World, _e: Entity, _dt: number): void {}

/** heroes.ts:140: his full Solo's Cue window runs while a Sapling fights. */
export function groveHeld(_world: World, _e: Entity, _dt: number): void {}

/** heroes.ts:262 (`shouldFireUncued`, target-less Oro): fire uncued on autonomy? */
export function groveFireUncued(_world: World, _e: Entity): boolean {
  return false;
}

/** `chooseTarget`'s summoner arm: his pick (null: none, Gentle), or undefined for the shared rule. */
export function groveChooseTarget(
  _world: World,
  _weaver: Entity,
  _e: Entity,
  _def: HeroDef,
): Entity | null | undefined {
  return undefined;
}

/** `targetInSight`'s summoner arm, or undefined for the shared rule. */
export function groveTargetInSight(
  _world: World,
  _weaver: Entity,
  _e: Entity,
  _def: HeroDef,
  _current: Entity | undefined,
): Entity | null | undefined {
  return undefined;
}

/** `combatMove` with no target (or a Rally): Gentle's own retreat. Writes `out`; true to use it. */
export function groveRetreat(
  _world: World,
  _weaver: Entity,
  _e: Entity,
  _def: HeroDef,
  _out: { x: number; z: number },
): boolean {
  return false;
}

/** `combatMove`'s summoner arm (with a target): writes `out`; false for the shared branch. */
export function groveMove(
  _world: World,
  _weaver: Entity,
  _e: Entity,
  _def: HeroDef,
  _target: Entity,
  _out: { x: number; z: number },
): boolean {
  return false;
}

/** `tryAbilities`: Regrowth's or Bramble's target and point now, or null. */
export function groveAbility(
  _world: World,
  _e: Entity,
  _def: HeroDef,
  _ability: Ability,
  _target: Entity,
): { target: Entity; x: number; z: number } | null {
  return null;
}

/** `executeAbility`: Regrowth and Bramble (`flourish`: Spring Rain). */
export function groveExecute(
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

/** `startSolo`: Wildgrowth (the Ancient's ground warning) or Homecoming. */
export function groveSoloStart(
  _world: World,
  _hero: Entity,
  _cued: boolean,
  _duration: number,
): void {}

/** `updateSolo`: Wildgrowth's pulses. */
export function groveSolo(_world: World, _hero: Entity, _def: HeroDef): void {}

/** `finishSolo`: the Ancient leaves. */
export function groveSoloEnd(_world: World, _hero: Entity): void {}

/** thread.ts, after `mendHero` on Oro: Rootbond Mends each living summon at `mendShare`. */
export function rootbond(_world: World, _oro: Entity, _amount: number): void {}

/** commands.ts, a Rally: his Saplings burrow and re-plant at the Weaver's front spots. */
export function groveRally(_world: World, _oro: Entity): void {}

/**
 * dealDamage, a summon's hit on an enemy: `partyDamage` on its owner's slot, no threat (W2).
 * `total`, `amplified`, `aura`: the hit's landed damage and the Weaver's shares of it.
 */
export function summonCredit(
  _world: World,
  _source: Entity,
  _target: Entity,
  _total: number,
  _amplified: number,
  _aura: number,
  _opts: DamageOpts,
): void {}
