/**
 * CONTRACT — Seren, the Riposte (docs/phase-5e.md, "Seren" and "New sim primitives").
 *
 * W0b landed this file's pure, read-only rules (real, shared by sim, render, bots and UI, and
 * exported from src/sim/index.ts) and every hook the shared sim files call; W1 filled the
 * hooks. Every hook is reached only through a guard that is false without Seren in the party
 * (`hero.duel`, `def.role === 'duelist'`, `ability.id === 'lunge'`), so no other party's state,
 * draws or hashes can change. Showboat, Lunge, Feint and Thousand Cuts draw nothing; the
 * counter, the kill shot and the cuts roll their crits through `heroDamage` (`rng.combat`), and
 * her barks draw `rng.cosmetic`, only with her in the party.
 */
import { attackDef, enemyDef, heroDef } from '../../content';
import type { AttackDef, HeroDef, ParryPassive } from '../../content/schema';
import {
  BLADE_WALTZ,
  DUEL_CLAMP,
  DUEL_PICK,
  HEAVY_LIFE,
  PARRY_REACH,
  SEREN_LEASH,
} from '../../content/rosterIds';
import { dcos, distSq, dsin } from '../core/dmath';
import {
  addStatus,
  dealDamage,
  hasStatus,
  interruptEnemy,
  isActive,
  isDisabled,
  NEVER,
  removeShield,
  removeStatus,
  rising,
  type DamageOpts,
  type DamageResult,
} from '../combat/health';
import { bark } from '../combat/feedback';
import { gainResonance } from '../combat/resonance';
import { recordSave } from '../combat/saves';
import { answered, contains } from '../combat/telegraphs';
import { topThreat } from '../combat/threat';
import { hasTalent, soloValue, talentFired, talentValue } from '../bonds';
import { isRooted } from '../rules3';
import type {
  DeathRecord,
  DeepReadonly,
  DuelState,
  Entity,
  EntityId,
  ReadonlyEntity,
  Shield,
  Telegraph,
  WorldState,
} from '../state';
import type { World } from '../world';
import { BERSERKER_SCATTER_GAP } from './blood';
import { attackRange, flourishHit, heroDamage } from './heroDamage';
import { clampPointToArena, pushPointOutOfObstacles } from './physics';

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
    // Kael's: his own target, or an enemy swinging at him (even while he has no target).
    const onKael =
      kaelId !== null &&
      ((kaelTarget !== null && m.id === kaelTarget) || m.enemy!.targetId === kaelId);
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

// ── Hooks (W1) ────────────────────────────────────────────────────────────────────────

/** A Rally ends Showboat and suspends it this long after the Rally (s); a Reel, from the Reel. */
const SHOWBOAT_QUIET = 4;
/** How long a Rally lasts (commands.ts): its suspension ends `SHOWBOAT_QUIET` after it began. */
const RALLY_LENGTH = 3;
/** Showboat's tell: she barks this long before she goes (s). */
const SHOWBOAT_TELL = 0.8;
/** A duel is dropped once its quarry is this far beyond Showboat's reach of the Weaver (m). */
const QUARRY_SLACK = 4;
/** A Thousand Cuts blink lands this far off its target's edge (m). */
const BLINK_SHORT = 0.3;
/** Thousand Cuts' invulnerability is re-armed each pulse for the pulse and this much more (s). */
const CUTS_GUARD = 0.05;
/** Feint (a) answers an aimed blow landing within this many seconds. */
const FEINT_SOON = 0.9;
/** Feint's sure step lasts this long (s). */
const FEINT_STEP = 0.5;

/** Her passive's numbers (every duellist's def has a `parry` passive; the lint holds it). */
function parryOf(def: HeroDef): ParryPassive | null {
  return def.passive?.id === 'parry' ? def.passive : null;
}

/** `ledger.duel`, set on first use (absent in every fight without a parry or kill shot). */
function duelLedger(world: World): NonNullable<World['ledger']['duel']> {
  return (world.ledger.duel ??= { parries: 0, killShots: 0, wardsDealt: 0 });
}

function waltzing(e: ReadonlyEntity): boolean {
  return e.hero?.soloId === BLADE_WALTZ && e.hero.soloActive > 0;
}

function cutting(e: ReadonlyEntity): boolean {
  return e.hero?.soloId === 'thousandCuts' && e.hero.soloActive > 0;
}

/**
 * Unflinching (Bonds): a Ward of yours on her lasts longer. Called by `addShield` as the Ward is
 * made, once per Ward, whatever she is doing that tick (stunned, staggered, Reeled or frozen in
 * Stasis); only on a duellist with the talent, so no other Ward changes.
 */
export function unflinchWard(world: World, e: Entity, ward: Shield): void {
  if (!e.hero?.duel || !hasTalent(e, 'unflinching')) return;
  if (ward.kind !== 'ward' || !ward.fromWeaver || ward.expiresAt >= NEVER) return;
  ward.expiresAt += talentValue(world, 'unflinching', 'seconds');
}

/** The Weaver's Ward on her that arms a parry, if any. */
function armingWard(e: Entity): Shield | undefined {
  return e.health?.shields.find((s) => s.kind === 'ward' && s.fromWeaver);
}

/**
 * Whether the parry just taken in `parryIntercept` was a Ward's (credited to the Weaver), read
 * by `duelResolved` in the same call chain (`hitEntity`). Never state: set and read in one tick.
 */
let parriedByWard = false;

const PARRIED: DamageResult = {
  dealt: 0,
  absorbed: 0,
  absorbedByWeaver: 0,
  absorbedByWard: 0,
  absorbedByDome: 0,
  blocked: false,
  downed: false,
  martyred: false,
  saved: false,
};

/**
 * The parry intercept (dealDamage, after the Sphere, Oathkeeper and the Aegis Link share, before
 * guards, armour, Fermata and shields). Called only for a duel victim and never for a redirected
 * share (`opts.oath`); `own` marks her own share of a blow aimed at her under an Aegis Link
 * (marked `oath` like the shares it sent the others, but not redirected), which can be parried.
 * A melee blow aimed at her (`opts.melee`: an enemy's basic swing at her, or a parryable cone
 * whose target is her), while she stands en garde, is negated whole: the Ward is spent (with
 * Riposte Chain, marked on its first parry), and the counter is owed next tick. Returns the
 * parry's result (`dealt 0, absorbed 0, parried`) or null.
 */
export function parryIntercept(
  world: World,
  target: Entity,
  source: Entity | undefined,
  opts: DamageOpts,
  own = false,
): DamageResult | null {
  const duel = target.hero?.duel;
  const h = target.health;
  if (!duel || !h || opts.melee !== true || opts.kind === 'tick') return null;
  if (opts.oath && !own) return null;
  if (!source?.enemy) return null;
  const waltz = waltzing(target);
  const ward = waltz ? undefined : armingWard(target);
  if (!waltz && !ward) return null;
  const blow = opts.amount;
  if (ward) {
    // Riposte Chain: a Ward on her parries twice before it breaks.
    if (hasTalent(target, 'riposte_chain') && !ward.parried) {
      ward.parried = true;
      talentFired(world, target, 'riposte_chain', target.x, target.z, source.id);
    } else removeShield(world, target, 'ward', true);
    // Proof of support: the blow your Ward turned, and the life it kept.
    const kept = Math.min(blow, h.hp);
    world.ledger.negated += blow;
    world.ledger.shielded += kept;
    target.hero!.supportReceived += kept;
  }
  // Blade Waltz (her alternate Solo): each blow it parries.
  if (waltz) talentFired(world, target, 'blade_waltz', target.x, target.z, source.id);
  parriedByWard = !!ward;
  duel.parries++;
  duel.parryOn = source.id;
  duelLedger(world).parries++;
  world.events.push({
    type: 'parried',
    tick: world.tick,
    hero: target.id,
    attacker: source.id,
    negated: blow,
  });
  bark(world, target, 'parried');
  // En Garde (her Bond motif): each parry rings for you.
  if (world.mods.enGarde > 0) gainResonance(world, world.mods.enGarde, 'enGarde');
  return { ...PARRIED, parried: blow };
}

/**
 * A telegraph's blow was parried (`hitEntity`): a Ward's parry answers it, gives the Ward-absorb
 * Resonance, and is a Ward save when the blow would have downed her. Blade Waltz's are hers.
 */
export function duelResolved(
  world: World,
  t: Telegraph,
  e: Entity,
  result: DamageResult,
  wouldDie: boolean,
): void {
  if (!parriedByWard || !e.hero) return;
  parriedByWard = false;
  answered(world);
  gainResonance(world, world.content.resonance.gains.wardAbsorb, 'ward absorb');
  if (wouldDie) recordSave(world, e, 'ward', result.parried ?? 0, t.name);
}

/**
 * Each tick, after `isDisabled`: the deferred counter and kill shot, the Rally's and Reel's
 * suspension of Showboat, the stance (a dodge she committed to is dropped once a Ward lands),
 * and the overextended clock. (Unflinching's longer Wards are made where the Ward is, in
 * `addShield`, so a Ward that lands on her stunned, staggered or mid-Reel keeps them too.)
 */
export function duelTick(world: World, e: Entity, def: HeroDef, dt: number): void {
  const hero = e.hero!;
  const duel = hero.duel;
  const p = parryOf(def);
  if (!duel || !p) return;
  if ((duel.parryOn !== null || duel.killShotOn !== null) && rewoundNow(world, e, dt))
    duelReeled(world, e);
  // A Rewind or a Rally during Thousand Cuts, as a Reel (`duelReeled`): the cuts end where the
  // Rewind put her, or beside you.
  if (cutting(e)) {
    if (rewoundNow(world, e, dt)) cutsFrom(duel, e.x, e.z);
    else if (world.internal.rallyUntil > world.time) rallyAnchor(world, duel);
  }
  if (duel.parryOn !== null) {
    const attacker = world.entities.get(duel.parryOn);
    duel.parryOn = null;
    if (attacker) counter(world, e, def, p, attacker);
  }
  if (duel.killShotOn !== null) {
    const owner = world.entities.get(duel.killShotOn);
    duel.killShotOn = null;
    killShot(world, e, def, p, owner);
  }
  quiet(world, e, duel);
  // The stance: Warded, she stands her ground against a parryable blow aimed at her, even one
  // she had already decided to step out of (her roll is taken when she first sees it).
  const dodge = hero.dodge;
  if (dodge && !dodge.sure && parryArmed(e)) {
    const t = world.telegraphs.find((x) => x.id === dodge.telegraph);
    if (t && duelStands(world, e, t)) hero.dodge = null;
  }
  const over = overextended(world, e);
  if (over) duel.overextendedTime += dt;
  if (over !== (duel.overextended === true)) setOverextended(world, e, duel, over);
}

function setOverextended(world: World, e: Entity, duel: DuelState, on: boolean): void {
  if (on) duel.overextended = true;
  else delete duel.overextended;
  world.events.push({ type: 'overextended', tick: world.tick, hero: e.id, on });
}

/**
 * A Rally or a Reel (or a Rewind) on her ends her duel and suspends Showboat. Only the pull
 * counts as a Reel: Anchor has no pull (she holds her ground, and Rally is the answer), and a
 * Swap puts you in her duel rather than her out of it, so neither ends it.
 */
function quiet(world: World, e: Entity, duel: DuelState): void {
  const rally = world.internal.rallyUntil;
  if (rally > world.time) suspend(duel, rally - RALLY_LENGTH + SHOWBOAT_QUIET);
  // A Reel leaves its mark in the ledger (`pushMarker`), the only trace once it has landed.
  // Swap and Anchor leave the same 'reel' mark; the Weaver's Reel variant tells them apart.
  const variant = world.entities.get(world.weaverId)?.weaver?.variants.reel ?? null;
  const pulls = variant !== 'swap' && variant !== 'anchor';
  const markers = world.ledger.markers;
  const start = world.encounter.startedAt;
  const slot = e.hero!.slot;
  for (let i = markers.length - 1; i >= 0; i--) {
    const m = markers[i]!;
    const until = m.time + start + SHOWBOAT_QUIET;
    if (until <= Math.max(duel.showboatQuietUntil, world.time)) break;
    if (((m.kind === 'reel' && pulls) || m.kind === 'rewind') && m.slot === slot) {
      suspend(duel, until);
      break;
    }
  }
}

function suspend(duel: DuelState, until: number): void {
  if (until > duel.showboatQuietUntil) duel.showboatQuietUntil = until;
  duel.quarry = null;
  duel.quarryUntil = 0;
}

/** Her counter: 3× her attack (through `heroDamage`) at the attacker, if it's within reach. */
function counter(world: World, e: Entity, def: HeroDef, p: ParryPassive, attacker: Entity): void {
  const hero = e.hero!;
  const duel = hero.duel!;
  if (!attacker.enemy || !isActive(attacker) || rising(attacker)) return;
  const reach = attackRange(world, e, def.attack.range) + p.reach + e.radius + attacker.radius;
  if (distSq(e.x, e.z, attacker.x, attacker.z) > reach * reach) return;
  // Blade Waltz's counters are hers, at its own share; a Ward's are the Weaver's.
  const waltz = waltzing(e);
  const pct = waltz
    ? soloValue(world, BLADE_WALTZ, hero.soloCued ? 'cuedPct' : 'pct') / 100
    : p.counterPct;
  const hit = heroDamage(world, e, def.attack.damage * pct, 0);
  world.events.push({
    type: 'attackFired',
    tick: world.tick,
    source: e.id,
    target: attacker.id,
    visual: 'melee',
    fromX: e.x,
    fromZ: e.z,
    toX: attacker.x,
    toZ: attacker.z,
    travel: 0,
  });
  const r = dealDamage(world, attacker, {
    source: e.id,
    sourceName: 'Counter',
    amount: hit.amount,
    amplified: hit.amplified,
    aura: hit.aura,
    empower: hit.empower,
    crit: hit.crit,
    empowered: hit.empowered,
  });
  let amount = r.dealt + r.absorbed;
  // Bladesong: the counter also cuts every enemy close round her (announced when it cuts one).
  if (hasTalent(e, 'bladesong')) {
    let cuts = 0;
    const radius = talentValue(world, 'bladesong', 'radius');
    const share = talentValue(world, 'bladesong', 'pct') / 100;
    for (const m of world.entities.list()) {
      if (m === attacker || !m.enemy || !isActive(m) || rising(m)) continue;
      if (distSq(m.x, m.z, e.x, e.z) > (radius + m.radius) ** 2) continue;
      const c = dealDamage(world, m, {
        source: e.id,
        sourceName: 'Bladesong',
        amount: hit.amount * share,
        amplified: hit.amplified * share,
        aura: hit.aura * share,
        empower: hit.empower * share,
        crit: hit.crit,
        empowered: hit.empowered,
      });
      amount += c.dealt + c.absorbed;
      cuts++;
    }
    if (cuts > 0) talentFired(world, e, 'bladesong', e.x, e.z);
  }
  duel.counterDamage += amount;
  if (!waltz) duelLedger(world).wardsDealt += amount;
  world.events.push({
    type: 'parryCountered',
    tick: world.tick,
    hero: e.id,
    target: attacker.id,
    amount,
  });
}

const leapAt = { x: 0, z: 0 };

/**
 * The kill shot (Q5), taken the tick after the Perfect: lost in the Grand Silence or if its
 * owner is gone. A normal foe is executed; an elite at or below `eliteExecuteBelow` of its life;
 * a heavy foe, a miniboss or a boss takes `killShotMult` × her attack and is never executed.
 * Within `killShotRange` she leaps to it, if the landing is within `DUEL_CLAMP` of the Weaver;
 * otherwise a thrown lance strikes it at range. It goes through `dealDamage`, so invulnerability,
 * rising, a phase shift, guards, tethers and Pacts all apply.
 */
function killShot(
  world: World,
  e: Entity,
  def: HeroDef,
  p: ParryPassive,
  owner: Entity | undefined,
): void {
  const duel = e.hero!.duel!;
  if (world.field.finale?.silence) return lostShot(world, e, owner?.id ?? null, 'silence');
  if (!owner?.enemy || !isActive(owner)) return lostShot(world, e, owner?.id ?? null, 'gone');
  const c = owner.enemy;
  const h = owner.health;
  const lesser = (c.tier === 'normal' || c.tier === 'elite') && !heavy(world, owner);
  const execute = lesser && (c.tier === 'normal' || h.hp <= h.maxHp * p.eliteExecuteBelow + 1e-9);
  // The leap: her own landing (Sunder Leap's rule), never out of the Weaver's reach.
  const fromX = e.x;
  const fromZ = e.z;
  const range = p.killShotRange + owner.radius;
  let leapt = false;
  if (distSq(e.x, e.z, owner.x, owner.z) <= range * range && canLeap(e)) {
    const dx = owner.x - e.x;
    const dz = owner.z - e.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    const back = Math.min(d, owner.radius + LUNGE_SHORT);
    leapAt.x = d > 1e-6 ? owner.x - (dx / d) * back : e.x;
    leapAt.z = d > 1e-6 ? owner.z - (dz / d) * back : e.z;
    pushPointOutOfObstacles(world, leapAt, e.radius);
    clampPointToArena(world, leapAt, e.radius);
    const weaver = world.entities.get(world.weaverId);
    if (!weaver || distSq(leapAt.x, leapAt.z, weaver.x, weaver.z) <= DUEL_CLAMP * DUEL_CLAMP) {
      e.x = leapAt.x;
      e.z = leapAt.z;
      e.vx = 0;
      e.vz = 0;
      leapt = true;
    }
  }
  world.events.push({
    type: 'attackFired',
    tick: world.tick,
    source: e.id,
    target: owner.id,
    visual: leapt ? 'charge' : 'lance',
    fromX,
    fromZ,
    toX: owner.x,
    toZ: owner.z,
    travel: 0,
  });
  let r: DamageResult;
  if (execute) {
    r = dealDamage(world, owner, { source: e.id, sourceName: 'Kill Shot', amount: h.hp + 1 });
  } else {
    const hit = heroDamage(world, e, def.attack.damage * p.killShotMult, 0);
    r = dealDamage(world, owner, {
      source: e.id,
      sourceName: 'Kill Shot',
      amount: hit.amount,
      amplified: hit.amplified,
      aura: hit.aura,
      empower: hit.empower,
      crit: hit.crit,
      empowered: hit.empowered,
    });
  }
  const amount = r.dealt + r.absorbed;
  duel.killShots++;
  const ledger = duelLedger(world);
  ledger.killShots++;
  ledger.wardsDealt += amount;
  world.events.push({
    type: 'killShot',
    tick: world.tick,
    hero: e.id,
    target: owner.id,
    executed: execute && r.downed,
    amount,
  });
  // En Garde: a kill shot counts as a parry.
  if (world.mods.enGarde > 0) gainResonance(world, world.mods.enGarde, 'enGarde');
  // Duellist's Honour: a kill shot readies your Ward again (announced when a charge comes back).
  // A charge comes back, as Temporal Mastery gives one (the recharge loop only adds charges as a
  // running cooldown reaches 0, so zeroing the clock alone would leave the Weaver none).
  if (hasTalent(e, 'duellists_honour')) {
    const w = world.entities.get(world.weaverId)?.weaver;
    if (w && w.wardCharges < w.maxWardCharges) {
      w.wardCharges++;
      if (w.wardCharges >= w.maxWardCharges) w.cooldowns.ward = 0;
      talentFired(world, e, 'duellists_honour', e.x, e.z);
    }
  }
}

/** Rooted, latched or Held, she throws her lance rather than leap. */
function canLeap(e: Entity): boolean {
  const hero = e.hero!;
  if (hero.follow === 'hold' || hero.hold) return false;
  return !isRooted(e) && !hasStatus(e, 'latched');
}

function lostShot(
  world: World,
  e: Entity,
  target: EntityId | null,
  lost: 'disabled' | 'silence' | 'gone',
): void {
  world.events.push({
    type: 'killShot',
    tick: world.tick,
    hero: e.id,
    target: target ?? e.id,
    executed: false,
    amount: 0,
    lost,
  });
}

/**
 * Seren's down recap (docs/phase-5e.md, "Down recaps"; `DeathRecord.duel`), read in `downHero`
 * before the down clears her: a Ward was on her as the killing blow came (`warded`, read before
 * it was absorbed), the blow was one she parries (`parryable`: a melee blow aimed at her), she
 * was overextended and the blow came from the pack (`overextended`: a plain hit, or a lesser
 * foe's telegraph that is no raid, mark or link; a boss's cone or raid has its own answer), and
 * it came from far (`far`: an enemy's bolt or beam from beyond `PARRY_REACH`, that no parry
 * answers; a mark, raid, burst or cleave is no beam).
 */
export function duelDownRecord(
  e: Entity,
  blow: {
    source: Entity | undefined;
    melee: boolean;
    tick: boolean;
    warded: boolean;
    kind?: Telegraph['kind'];
  },
): NonNullable<DeathRecord['duel']> {
  const duel = e.hero!.duel!;
  const src = blow.source;
  const reach = PARRY_REACH + e.radius + (src?.radius ?? 0);
  const k = blow.kind;
  const far =
    !blow.melee &&
    !blow.tick &&
    (k === undefined || k === 'beam') &&
    !!src?.enemy &&
    distSq(src.x, src.z, e.x, e.z) > reach * reach;
  const tier = src?.enemy?.tier;
  const pack =
    !blow.tick &&
    (k === undefined ||
      ((tier === 'normal' || tier === 'elite') && k !== 'raid' && k !== 'mark' && k !== 'link'));
  return {
    warded: blow.warded,
    parryable: blow.melee,
    overextended: duel.overextended === true && pack,
    far,
  };
}

/**
 * Downed or disabled this tick: a pending counter or kill shot is lost (the Perfect itself
 * stood). Downed, her duel ends. Unflinching: Warded, a stagger doesn't hold her.
 */
export function duelLost(world: World, e: Entity): void {
  const duel = e.hero?.duel;
  const h = e.health;
  if (!duel || !h) return;
  const down = h.dead || h.downed;
  if (!down && hasTalent(e, 'unflinching') && parryArmed(e) && hasStatus(e, 'stagger')) {
    removeStatus(world, e, 'stagger', 'expired');
    if (!isDisabled(e)) return;
  }
  duel.parryOn = null;
  if (duel.killShotOn !== null) {
    const owner = duel.killShotOn;
    duel.killShotOn = null;
    lostShot(world, e, owner, 'disabled');
  }
  if (down) {
    duel.quarry = null;
    duel.quarryUntil = 0;
    if (duel.overextended) setOverextended(world, e, duel, false);
  }
}

/**
 * Reeled (each tick of the pull, `updateHeroes`' Reel branch) or Rewound this tick: a pending
 * counter or kill shot is lost, as when disabled. Held through the pull, a kill shot would leap
 * her back onto its owner and undo the extraction you just paid for.
 */
export function duelReeled(world: World, e: Entity): void {
  const duel = e.hero?.duel;
  if (!duel) return;
  // A Reel during Thousand Cuts (docs/phase-5e.md, "Overextended"): the cuts go on, but from,
  // and back to, where it put her, not the pack she was pulled out of.
  const reel = e.hero!.reel;
  if (reel && cutting(e)) cutsFrom(duel, reel.toX, reel.toZ);
  duel.parryOn = null;
  if (duel.killShotOn !== null) {
    const owner = duel.killShotOn;
    duel.killShotOn = null;
    lostShot(world, e, owner, 'disabled');
  }
}

/** Thousand Cuts' start point (its reach and its return) moves to (x, z). */
function cutsFrom(duel: DuelState, x: number, z: number): void {
  if (duel.cutsVisited === undefined) return;
  duel.cutsFromX = x;
  duel.cutsFromZ = z;
}

/** A Rally during Thousand Cuts brings its start point beside you, on her side. */
const RALLY_BESIDE = 2.5;
function rallyAnchor(world: World, duel: DuelState): void {
  const weaver = world.entities.get(world.weaverId);
  if (!weaver || duel.cutsFromX === undefined || duel.cutsFromZ === undefined) return;
  const dx = duel.cutsFromX - weaver.x;
  const dz = duel.cutsFromZ - weaver.z;
  const d = Math.sqrt(dx * dx + dz * dz);
  if (d <= RALLY_BESIDE) return;
  cutsFrom(duel, weaver.x + (dx / d) * RALLY_BESIDE, weaver.z + (dz / d) * RALLY_BESIDE);
}

/** A Rewind on her slot this tick (its mark is pushed with the commands, before time moves on). */
function rewoundNow(world: World, e: Entity, dt: number): boolean {
  const markers = world.ledger.markers;
  const since = world.time - dt - world.encounter.startedAt - 1e-9;
  for (let i = markers.length - 1; i >= 0; i--) {
    const m = markers[i]!;
    if (m.time < since) return false;
    if (m.kind === 'rewind' && m.slot === e.hero!.slot) return true;
  }
  return false;
}

/** A live, standing enemy (not spawning, not rising): a duel can be fought with it. */
function standing(m: Entity | undefined): m is Entity & { enemy: object } {
  return !!m?.enemy && isActive(m) && m.enemy.state !== 'spawning' && !rising(m);
}

/**
 * `chooseTarget`'s duelist arm: her pick, or undefined for the shared rule. Answering a Rally she
 * keeps the shared rule (she always obeys); your Focus moves her duel; suspended (a Rally or a
 * Reel), she fights near you. Otherwise Showboat: the strongest enemy within `DUEL_PICK` m of the
 * Weaver (`duelTarget`), sticky for its `seconds` or until it falls, unless a higher tier comes
 * within reach; overextended she won't leave it on her own. A new duel starts with her bark,
 * `SHOWBOAT_TELL` s before she goes.
 */
export function duelChooseTarget(
  world: World,
  weaver: Entity,
  e: Entity,
  def: HeroDef,
): Entity | null | undefined {
  const duel = e.hero?.duel;
  if (!duel || def.quirk.id !== 'showboat') return undefined;
  if (world.internal.rallyUntil > world.time) return undefined;
  if (cutting(e)) return undefined;
  const seconds = def.quirk.seconds ?? 8;
  const focus = world.focusTarget === null ? undefined : world.entities.get(world.focusTarget);
  if (standing(focus)) {
    if (duel.quarry !== focus.id) choose(world, e, duel, focus, 0);
    duel.quarryUntil = world.time + seconds;
    return focus;
  }
  if (world.time < duel.showboatQuietUntil) {
    duel.quarry = null;
    return undefined;
  }
  let q = duel.quarry === null ? undefined : world.entities.get(duel.quarry);
  if (q && !standing(q)) q = undefined;
  const reach = DUEL_PICK + QUARRY_SLACK;
  if (q && distSq(q.x, q.z, weaver.x, weaver.z) > (reach + q.radius) ** 2) q = undefined;
  const pick = duelTarget(world, e) as Entity | null;
  if (q) {
    const higher = pick !== null && TIER_RANK[pick.enemy!.tier] > TIER_RANK[q.enemy!.tier];
    if (!higher) {
      if (duel.quarryUntil > world.time || overextended(world, e)) return q;
      if (pick === null || pick.id === q.id) {
        duel.quarryUntil = world.time + seconds;
        return q;
      }
    }
  }
  if (!pick) {
    duel.quarry = null;
    duel.quarryUntil = 0;
    return undefined;
  }
  choose(world, e, duel, pick, SHOWBOAT_TELL);
  duel.quarryUntil = world.time + SHOWBOAT_TELL + seconds;
  return pick;
}

function choose(world: World, e: Entity, duel: DuelState, m: Entity, tell: number): void {
  duel.quarry = m.id;
  world.events.push({ type: 'duelChosen', tick: world.tick, hero: e.id, target: m.id });
  if (tell > 0) bark(world, e, 'quirk');
}

/** Her Showboat bark is still ringing: she points, and goes once it has. */
function telling(world: World, e: Entity, def: HeroDef): boolean {
  const duel = e.hero!.duel!;
  if (duel.quarry === null || def.quirk.id !== 'showboat') return false;
  return duel.quarryUntil - (def.quirk.seconds ?? 8) > world.time;
}

/**
 * `targetInSight`'s duelist arm (after the Focus), reached with no duel: the enemy she is on
 * while it is in reach, else the nearest one (stationary ones are left to `seekStationary`).
 */
export function duelTargetInSight(
  world: World,
  _weaver: Entity,
  e: Entity,
  def: HeroDef,
  current: Entity | undefined,
): Entity | null | undefined {
  if (!e.hero?.duel) return undefined;
  const keep = attackRange(world, e, def.attack.range) + 3;
  if (standing(current) && distSq(current.x, current.z, e.x, e.z) <= (keep + current.radius) ** 2)
    return current;
  let best: Entity | null = null;
  let bestD = 20 * 20;
  for (const m of world.entities.list()) {
    if (!standing(m) || enemyDef(m.enemy!.defId).stationary === true) continue;
    const d = distSq(m.x, m.z, e.x, e.z);
    if (d < bestD || (d === bestD && best !== null && m.id < best.id)) {
      best = m;
      bestD = d;
    }
  }
  return best;
}

/**
 * `combatMove`'s duelist arm (before the flank): writes `out` and returns true; `combatMove`
 * then steps her out of others' blows and clamps her to `DUEL_CLAMP` m of the Weaver. Hold was
 * decided before (she holds). An enemy swinging at her she meets face to face at her
 * `preferredRange`; one swinging at another hero, or guarded, she takes from the flank. Out of a
 * duel she keeps within `SEREN_LEASH` m of the Weaver. Under Scatter she keeps clear of the
 * others. She stands still while her Showboat bark rings, and through Thousand Cuts.
 */
export function duelMove(
  world: World,
  weaver: Entity,
  e: Entity,
  def: HeroDef,
  target: Entity,
  out: { x: number; z: number },
): boolean {
  const hero = e.hero!;
  const duel = hero.duel;
  if (!duel) return false;
  if (cutting(e) || (duel.quarry === target.id && telling(world, e, def))) {
    out.x = e.x;
    out.z = e.z;
    return true;
  }
  const c = target.enemy;
  const g = c?.guard;
  const guarded = !!g && g.brokenUntil <= world.time;
  const onOther = !!c && c.targetId !== null && c.targetId !== e.id;
  if (c && (guarded || onOther)) flankPoint(world, e, def, target, guarded, out);
  else facePoint(e, def, target, out);
  const free = !!c && enemyDef(c.defId).stationary === true;
  if (duel.quarry !== target.id && !free) leashTo(weaver, SEREN_LEASH, out);
  if (hero.follow === 'scatter') keepClear(world, e, BERSERKER_SCATTER_GAP, out);
  return true;
}

/** Face to face: `preferredRange` off its edge, along her line to it (she stays if closer). */
function facePoint(e: Entity, def: HeroDef, target: Entity, out: { x: number; z: number }): void {
  const reach = Math.min(def.preferredRange, def.attack.range - 0.35) + target.radius + e.radius;
  const dx = target.x - e.x;
  const dz = target.z - e.z;
  const d = Math.sqrt(dx * dx + dz * dz);
  if (d <= reach || d < 1e-6) {
    out.x = e.x;
    out.z = e.z;
    return;
  }
  out.x = target.x - (dx / d) * reach;
  out.z = target.z - (dz / d) * reach;
}

/**
 * At its flank: its facing (a guard's direction while the guard holds) turned 90° (past the
 * guard's arc by `FLANK_MARGIN`) toward the side she is on, at her `preferredRange`.
 */
function flankPoint(
  world: World,
  e: Entity,
  def: HeroDef,
  target: Entity,
  guarded: boolean,
  out: { x: number; z: number },
): void {
  const g = target.enemy!.guard;
  const fx = guarded && g ? g.fx : target.fx;
  const fz = guarded && g ? g.fz : target.fz;
  const arc = guarded ? (enemyDef(target.enemy!.defId).guard?.arcDeg ?? 0) : 0;
  const a = (Math.max(90, arc / 2 + FLANK_MARGIN) * Math.PI) / 180;
  const c = dcos(a);
  const s = dsin(a);
  const want = Math.min(def.preferredRange, def.attack.range - 0.5) + target.radius + e.radius;
  const lx = fx * c - fz * s;
  const lz = fx * s + fz * c;
  const rx = fx * c + fz * s;
  const rz = -fx * s + fz * c;
  const left = distSq(e.x, e.z, target.x + lx * want, target.z + lz * want);
  const right = distSq(e.x, e.z, target.x + rx * want, target.z + rz * want);
  const useLeft = left <= right;
  out.x = target.x + (useLeft ? lx : rx) * want;
  out.z = target.z + (useLeft ? lz : rz) * want;
  clampPointToArena(world, out, e.radius);
}

/** Past the guard's arc by this many degrees (heroes.ts `flank`'s margin). */
const FLANK_MARGIN = 35;

function leashTo(weaver: Entity, max: number, p: { x: number; z: number }): void {
  const dx = p.x - weaver.x;
  const dz = p.z - weaver.z;
  const d = Math.sqrt(dx * dx + dz * dz);
  if (d > max) {
    p.x = weaver.x + (dx / d) * max;
    p.z = weaver.z + (dz / d) * max;
  }
}

/** Under Scatter: at least `gap` from every other standing hero (two passes). */
function keepClear(world: World, e: Entity, gap: number, p: { x: number; z: number }): void {
  for (let pass = 0; pass < 2; pass++) {
    for (const id of world.party) {
      if (id === e.id) continue;
      const o = world.entities.get(id);
      if (!isActive(o)) continue;
      let dx = p.x - o.x;
      let dz = p.z - o.z;
      let d = Math.sqrt(dx * dx + dz * dz);
      if (d >= gap) continue;
      if (d < 1e-6) {
        dx = e.x - o.x;
        dz = e.z - o.z;
        d = Math.sqrt(dx * dx + dz * dz);
        if (d < 1e-6) {
          dx = 1;
          dz = 0;
          d = 1;
        }
      }
      p.x = o.x + (dx / d) * gap;
      p.z = o.z + (dz / d) * gap;
    }
  }
}

/**
 * `tryAbilities`: Lunge's or Feint's target now, or null (not this tick). Lunge: `lungeTarget`.
 * Feint: (a) a damaging, non-parryable blow aimed at her lands soon: the sure step, taunting
 * its owner (or her target) when in reach; (b) Warded, her quarry is swinging at someone else:
 * she baits it into the parry (normal and elite only; a boss's Feint is only the step).
 */
export function duelAbility(
  world: World,
  e: Entity,
  def: HeroDef,
  ability: Ability,
  target: Entity,
): Entity | null {
  const duel = e.hero?.duel;
  if (!duel || cutting(e)) return null;
  if (ability.id === 'lunge') {
    const t = lungeTarget(world, e, ability);
    // Her Showboat bark rings before she goes: no dash at the duel until it has (a cast she
    // can interrupt is never kept waiting).
    if (t && t.id === duel.quarry && !t.enemy?.cast?.interruptible && telling(world, e, def))
      return null;
    return t;
  }
  if (ability.id !== 'feint') return null;
  const inReach = (m: Entity | undefined): m is Entity =>
    standing(m) && distSq(m.x, m.z, e.x, e.z) <= (ability.range + m.radius + e.radius) ** 2;
  const armed = parryArmed(e);
  // (a) waits out Stasis: the blow can't land meanwhile, so she keeps fighting, and steps once
  // it moves again (its time to land is unchanged).
  for (const t of world.telegraphs) {
    if (world.field.stasis) break;
    if (!aimedShape(t, e) || t.impact - world.time > FEINT_SOON) continue;
    if (!contains(world, t, e)) continue;
    if (armed && duelStands(world, e, t)) continue;
    const owner = world.entities.get(t.owner);
    if (inReach(owner)) return owner;
    if (inReach(target)) return target;
  }
  if (!armed || duel.quarry !== target.id || !inReach(target)) return null;
  const c = target.enemy!;
  if (c.tier !== 'normal' && c.tier !== 'elite') return null;
  if (c.targetId === null || c.targetId === e.id) return null;
  return target;
}

const stepAt = { x: 0, z: 0 };
const stepAlt = { x: 0, z: 0 };
/** A probe body for `contains` (id, position, radius and facing only). */
const probe = { id: 0, x: 0, z: 0, radius: 0, fx: 1, fz: 0 };

/**
 * `executeAbility`: Lunge (`flourish`: Flèche) and Feint. Lunge dashes to its landing (a contact
 * thrust where she stands), interrupts the cast it lands on, and strikes; Flèche's multipliers
 * and stun apply. Feint is a sure `step` sidestep to its flank (the side out of any blow aimed at
 * her), then a `taunt` s hard taunt of it if it is normal or elite.
 */
export function duelExecute(
  world: World,
  e: Entity,
  def: HeroDef,
  index: 0 | 1,
  target: Entity | undefined,
  _x: number,
  _z: number,
  flourish: Flourish | null,
  emit: (x: number, z: number, radius: number) => void,
): void {
  const hero = e.hero!;
  if (!hero.duel || !standing(target)) return;
  const ability = def.abilities[index];
  if (ability.id === 'lunge') {
    const fromX = e.x;
    const fromZ = e.z;
    const land = lungeLanding(world, e, target);
    stepAt.x = land.x;
    stepAt.z = land.z;
    pushPointOutOfObstacles(world, stepAt, e.radius);
    clampDuel(world, e, stepAt);
    e.x = stepAt.x;
    e.z = stepAt.z;
    e.vx = 0;
    e.vz = 0;
    world.events.push({
      type: 'attackFired',
      tick: world.tick,
      source: e.id,
      target: target.id,
      visual: 'lunge',
      fromX,
      fromZ,
      toX: e.x,
      toZ: e.z,
      travel: 0,
    });
    emit(target.x, target.z, 0);
    if (target.enemy.cast?.interruptible) interruptEnemy(world, target, e.id);
    const hit = flourish
      ? flourishHit(world, e, ability.damage, flourish)
      : heroDamage(world, e, ability.damage, 0);
    dealDamage(world, target, {
      source: e.id,
      sourceName: flourish?.name ?? ability.name,
      amount: hit.amount,
      amplified: hit.amplified,
      aura: hit.aura,
      empower: hit.empower,
      crit: hit.crit,
      empowered: hit.empowered,
    });
    if (flourish && flourish.stun > 0 && isActive(target))
      addStatus(world, target, 'stun', flourish.stun, e.id);
    return;
  }
  if (ability.id !== 'feint') return;
  // The step: square to her line with it, on whichever side leaves the blows aimed at her.
  const step = ability.step ?? 0;
  let dx = e.x - target.x;
  let dz = e.z - target.z;
  const d = Math.sqrt(dx * dx + dz * dz);
  if (d < 1e-6) {
    dx = -target.fx;
    dz = -target.fz;
  } else {
    dx /= d;
    dz /= d;
  }
  stepAt.x = e.x - dz * step;
  stepAt.z = e.z + dx * step;
  stepAlt.x = e.x + dz * step;
  stepAlt.z = e.z - dx * step;
  clampDuel(world, e, stepAt);
  clampDuel(world, e, stepAlt);
  if (hitsAt(world, e, stepAt) > hitsAt(world, e, stepAlt)) {
    stepAt.x = stepAlt.x;
    stepAt.z = stepAlt.z;
  }
  // A blow too wide for the sidestep: the nearest spot inside the leash that leaves every blow
  // aimed at her, else the dodge she already chose if that one leaves them, else the better side.
  if (
    hitsAt(world, e, stepAt) > 0 &&
    !ringOut(world, e, stepAt, (p) => hitsAt(world, e, p, RING_SPARE) === 0)
  ) {
    const own = hero.dodge;
    if (own && hitsAt(world, e, own) === 0) {
      stepAt.x = own.x;
      stepAt.z = own.z;
    }
  }
  // A step that answers a blow holds until it lands (as any dodge, and with it under Stasis), so
  // she never walks back into it; one that answers none is her own half-second.
  const answers = aimedAt(world, e);
  const blow = answers < 0 ? undefined : world.telegraphs.find((x) => x.id === answers);
  const until = world.time + FEINT_STEP;
  hero.dodge = {
    telegraph: answers,
    x: stepAt.x,
    z: stepAt.z,
    at: world.time,
    until: blow ? Math.max(until, blow.impact + DODGE_AFTER) : until,
    sure: true,
    ...(blow ? {} : { free: true as const }),
  };
  world.events.push({
    type: 'attackFired',
    tick: world.tick,
    source: e.id,
    target: target.id,
    visual: 'feint',
    fromX: e.x,
    fromZ: e.z,
    toX: stepAt.x,
    toZ: stepAt.z,
    travel: 0,
  });
  emit(target.x, target.z, 0);
  const c = target.enemy;
  if (c.tier !== 'normal' && c.tier !== 'elite') return;
  topThreat(target, hero.slot, 150);
  c.tauntTarget = e.id;
  c.tauntUntil = Math.max(c.tauntUntil, world.time + (ability.taunt ?? 0));
}

/** A damaging ground blow aimed at her: one a step can leave. */
function aimedShape(t: DeepReadonly<Telegraph>, e: ReadonlyEntity): boolean {
  if (t.effect !== 'damage' || t.target !== e.id) return false;
  const k = t.shape.kind;
  return k !== 'mark' && k !== 'raid' && k !== 'link';
}

/**
 * How many damaging blows aimed at her would still hold her at `p` (with `spare` m to spare),
 * leaving out those she stands her ground against (`duelStands`).
 */
function hitsAt(world: World, e: Entity, p: { x: number; z: number }, spare = 0): number {
  probe.id = e.id;
  probe.x = p.x;
  probe.z = p.z;
  probe.radius = e.radius + spare;
  probe.fx = e.fx;
  probe.fz = e.fz;
  let n = 0;
  for (const t of world.telegraphs)
    if (
      aimedShape(t, e) &&
      contains(world, t, probe as unknown as Entity) &&
      !duelStands(world, e, t)
    )
      n++;
  return n;
}

/** Would `t` hold her at `p` (with `RING_SPARE` m to spare)? */
function holdsAt(world: World, t: DeepReadonly<Telegraph>, e: Entity, p: { x: number; z: number }) {
  probe.id = e.id;
  probe.x = p.x;
  probe.z = p.z;
  probe.radius = e.radius + RING_SPARE;
  probe.fx = e.fx;
  probe.fz = e.fz;
  return contains(world, t, probe as unknown as Entity);
}

/** A dodge holds this long past its blow's impact (as `noticeTelegraphs`' own). */
const DODGE_AFTER = 0.15;
/** The search ring for a step out: distances from her (m), nearest first, and its headings. */
const RING_RADII = [1.5, 2.5, 3.5, 4.5, 6, 7.5, 9] as const;
const RING_HEADINGS = 16;
/** Room a found spot leaves between her body and the blow's edge (m). */
const RING_SPARE = 0.3;
const ringAt = { x: 0, z: 0 };

/**
 * The nearest spot round her, inside the leash (`clampDuel`), that `clear` accepts: the first
 * ring that has one, and on it the spot nearest the Weaver. Writes `out`; false (and `out`
 * untouched) if none does.
 */
function ringOut(
  world: World,
  e: Entity,
  out: { x: number; z: number },
  clear: (p: { x: number; z: number }) => boolean,
): boolean {
  const weaver = world.entities.get(world.weaverId);
  for (const r of RING_RADII) {
    let best = Infinity;
    for (let i = 0; i < RING_HEADINGS; i++) {
      const a = (i * 2 * Math.PI) / RING_HEADINGS;
      ringAt.x = e.x + dcos(a) * r;
      ringAt.z = e.z + dsin(a) * r;
      clampDuel(world, e, ringAt);
      if (!clear(ringAt)) continue;
      const d = weaver ? distSq(ringAt.x, ringAt.z, weaver.x, weaver.z) : 0;
      if (d < best) {
        best = d;
        out.x = ringAt.x;
        out.z = ringAt.z;
      }
    }
    if (best < Infinity) return true;
  }
  return false;
}

/**
 * Her ordinary dodge's spot (`noticeTelegraphs`, docs/phase-5e.md "The leash": every destination
 * of hers is within `DUEL_CLAMP` of the Weaver). `out` (the escape point) is kept when it is
 * inside the leash; else it is clamped, and if the clamp puts it back in `t`, the nearest spot
 * round her inside the leash that leaves `t` is taken instead (the clamped one if none does).
 */
export function duelEscape(
  world: World,
  e: Entity,
  t: DeepReadonly<Telegraph>,
  out: { x: number; z: number },
): void {
  const weaver = world.entities.get(world.weaverId);
  if (!weaver || distSq(out.x, out.z, weaver.x, weaver.z) <= DUEL_CLAMP * DUEL_CLAMP) return;
  clampDuel(world, e, out);
  if (holdsAt(world, t, e, out)) ringOut(world, e, out, (p) => !holdsAt(world, t, e, p));
}

/**
 * The first blow aimed at her that holds her now and that she doesn't stand her ground against
 * (Feint's step answers it), else -1.
 */
function aimedAt(world: World, e: Entity): number {
  for (const t of world.telegraphs)
    if (aimedShape(t, e) && contains(world, t, e) && !duelStands(world, e, t)) return t.id;
  return -1;
}

/** Thousand Cuts' own length: Thousandfold's longer one, the Choirmaster's Baton's when Cued. */
function cutsLength(world: World, hero: Entity, def: HeroDef, cued: boolean): number {
  const base = hasTalent(hero, 'thousandfold')
    ? talentValue(world, 'thousandfold', 'seconds')
    : def.solo.duration;
  return base * (cued ? world.mods.cuedSoloDurationMult : 1);
}

/** `startSolo`: Thousand Cuts begins (where it began, whom it struck, when it ends). */
export function duelSoloStart(world: World, hero: Entity, cued: boolean, duration: number): void {
  const h = hero.hero!;
  const duel = h.duel;
  if (!duel || h.soloId !== 'thousandCuts') return;
  const def = heroDef(h.defId);
  const length = hasTalent(hero, 'thousandfold') ? cutsLength(world, hero, def, cued) : duration;
  h.soloActive = length;
  duel.cutsFrom = world.time;
  duel.cutsEnd = world.time + length;
  duel.cutsFromX = hero.x;
  duel.cutsFromZ = hero.z;
  duel.cutsVisited = [];
  const health = hero.health!;
  health.invulnerable = Math.max(health.invulnerable, (def.solo.pulse ?? 0.5) + CUTS_GUARD);
}

const blinkAt = { x: 0, z: 0 };

/**
 * `updateSolo`: Thousand Cuts' pulses. Each is a blink to the enemy struck fewest times so far
 * (then the nearest, then the lower id) within its `reach` of where it began and `DUEL_CLAMP` of
 * the Weaver, and a cut for `power` × her attack. She is invulnerable throughout. Cued, each kill
 * adds `cuedPower` s, up to `extendCap`. The Grand Silence ends it at once.
 */
export function duelSolo(world: World, hero: Entity, def: HeroDef): void {
  const h = hero.hero!;
  const duel = h.duel;
  if (!duel || h.soloId !== 'thousandCuts' || duel.cutsVisited === undefined) return;
  if (world.field.finale?.silence) {
    h.soloActive = 0;
    return;
  }
  const solo = def.solo;
  const every = Math.max(0.05, solo.pulse ?? 0.5);
  const reach = solo.reach ?? 10;
  const visited = duel.cutsVisited;
  const weaver = world.entities.get(world.weaverId);
  while (h.soloPulseAt <= world.time && h.soloActive > 0) {
    // One cut a pulse, as many as its (extended) length holds: 8 in 4 s, never a 9th on the
    // tick it ends.
    const from = duel.cutsFrom ?? h.soloPulseAt;
    const cuts = Math.round(((duel.cutsEnd ?? from) - from) / every);
    if (Math.round((h.soloPulseAt - from) / every) >= cuts) break;
    h.soloPulseAt += every;
    hero.health!.invulnerable = Math.max(hero.health!.invulnerable, every + CUTS_GUARD);
    let best: Entity | null = null;
    let bestN = Infinity;
    let bestD = Infinity;
    for (const m of world.entities.list()) {
      if (!standing(m)) continue;
      const r = reach + m.radius;
      if (distSq(m.x, m.z, duel.cutsFromX!, duel.cutsFromZ!) > r * r) continue;
      if (weaver && distSq(m.x, m.z, weaver.x, weaver.z) > (DUEL_CLAMP + m.radius) ** 2) continue;
      let n = 0;
      for (const id of visited) if (id === m.id) n++;
      const d = distSq(m.x, m.z, hero.x, hero.z);
      if (n < bestN || (n === bestN && (d < bestD || (d === bestD && m.id < best!.id)))) {
        best = m;
        bestN = n;
        bestD = d;
      }
    }
    if (!best) continue;
    visited.push(best.id);
    const fromX = hero.x;
    const fromZ = hero.z;
    const dx = hero.x - best.x;
    const dz = hero.z - best.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    const off = best.radius + hero.radius + BLINK_SHORT;
    blinkAt.x = d > 1e-6 ? best.x + (dx / d) * off : best.x + off;
    blinkAt.z = d > 1e-6 ? best.z + (dz / d) * off : best.z;
    pushPointOutOfObstacles(world, blinkAt, hero.radius);
    clampDuel(world, hero, blinkAt);
    hero.x = blinkAt.x;
    hero.z = blinkAt.z;
    hero.vx = 0;
    hero.vz = 0;
    world.events.push({
      type: 'attackFired',
      tick: world.tick,
      source: hero.id,
      target: best.id,
      visual: 'blink',
      fromX,
      fromZ,
      toX: hero.x,
      toZ: hero.z,
      travel: 0,
    });
    const hit = heroDamage(world, hero, def.attack.damage * solo.power, 0);
    const r = dealDamage(world, best, {
      source: hero.id,
      sourceName: solo.name,
      amount: hit.amount,
      amplified: hit.amplified,
      aura: hit.aura,
      empower: hit.empower,
      crit: hit.crit,
      empowered: hit.empowered,
    });
    h.strikeX = best.x;
    h.strikeZ = best.z;
    h.struck = true;
    // Cued: every kill buys another cut, up to the cap.
    if (h.soloCued && r.downed && duel.cutsEnd !== undefined && duel.cutsFrom !== undefined) {
      const extended = duel.cutsEnd - duel.cutsFrom - cutsLength(world, hero, def, true);
      const more = solo.cuedPower;
      if (more > 0 && extended + more <= (solo.extendCap ?? 0) + 1e-9) {
        h.soloActive += more;
        duel.cutsEnd += more;
      }
    }
  }
}

const backAt = { x: 0, z: 0 };

/** `finishSolo`: Thousand Cuts returns her to where it began (within the Weaver's reach). */
export function duelSoloEnd(world: World, hero: Entity): void {
  const duel = hero.hero?.duel;
  if (!duel || duel.cutsFromX === undefined || duel.cutsFromZ === undefined) return;
  backAt.x = duel.cutsFromX;
  backAt.z = duel.cutsFromZ;
  pushPointOutOfObstacles(world, backAt, hero.radius);
  clampDuel(world, hero, backAt);
  world.events.push({
    type: 'attackFired',
    tick: world.tick,
    source: hero.id,
    target: null,
    visual: 'blink',
    fromX: hero.x,
    fromZ: hero.z,
    toX: backAt.x,
    toZ: backAt.z,
    travel: 0,
  });
  hero.x = backAt.x;
  hero.z = backAt.z;
  hero.vx = 0;
  hero.vz = 0;
  delete duel.cutsEnd;
  delete duel.cutsFrom;
  delete duel.cutsFromX;
  delete duel.cutsFromZ;
  delete duel.cutsVisited;
}

/** `tickSoloClock` (she can't act): a stun, a stilling or a possession ends Thousand Cuts. */
export function duelSoloClock(_world: World, hero: Entity): void {
  const h = hero.hero!;
  if (!h.duel || h.soloId !== 'thousandCuts' || h.soloActive <= 0) return;
  if (isDisabled(hero)) h.soloActive = 0;
}

/** `updateSolo`'s cast bar for Thousand Cuts, whose kills extend it (`duel.cutsEnd`). */
export function duelCastProgress(_world: World, hero: Entity, progress: number): number {
  const duel = hero.hero?.duel;
  if (!duel || duel.cutsEnd === undefined || duel.cutsFrom === undefined) return progress;
  const total = Math.max(0.01, duel.cutsEnd - duel.cutsFrom);
  return Math.max(0, Math.min(1, 1 - hero.hero!.soloActive / total));
}
