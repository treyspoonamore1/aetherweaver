/**
 * The damage / heal / shield / status pipeline (docs/plan/05 §4.6). Every change to HP goes
 * through here so the ledger, threat and events stay consistent.
 */
import { enemyDef, heroDef } from '../../content';
import { HEAL_CUT, PACT_TAKEN } from '../../content/legion';
import { AILMENT_IDS, type StatusPayload } from '../../content/schema';
import type { PartySlot } from '../commands';
import type { AnswerTag } from '../events';
import { dcos, distSq } from '../core/dmath';
import type {
  DeepReadonly,
  Entity,
  EntityId,
  EntityStoreView,
  ReadonlyEntity,
  Health,
  Shield,
  ShieldKind,
  Status,
  StatusId,
  Telegraph,
  WorldState,
} from '../state';
import { canPay } from '../astrolabe';
import type { World } from '../world';
import { hasAura, heroFx } from './auras';
import { addHealingThreat, addThreat } from './threat';
import { bark, pushMarker, relicFired, setTimeScale } from './feedback';
import { gainResonance } from './resonance';
import { recordSave } from './saves';
import { hasTalent, soloValue, talentFired, talentHolder, talentValue } from '../bonds';
import { variantGuard, variantValue } from '../variants';
import { suppressRadiusOf, weaverSilenced } from '../rules3';
import { markStatusOf } from './telegraphs';
import {
  afterBloodDamage,
  deathlessActive,
  deathlessHolds,
  isWeaverVia,
  onBloodHit,
  refusedRallyLive,
  weaverHealCut,
} from '../systems/blood';

/** Shields with no natural expiry (aura barriers, discord) expire at this sim time. */
export const NEVER = 1e9;

/** How hard hits bite into a Discord barrier, with and without Empower. */
const DISCORD_EMPOWERED = 1.5;
const DISCORD_PLAIN = 0.2;

/**
 * Ailments Chime cleanses and immunity blocks: content's list (`AILMENT_IDS`), so the lint that
 * checks Chime answers and the sim that honours them can't drift apart.
 */
const AILMENTS: ReadonlySet<StatusId> = new Set<StatusId>(AILMENT_IDS);

/** Seconds between a damage-over-time status's ticks (docs/phase-5a.md P2). */
export const DOT_TICK = 0.5;
/** A drain (a Leech's latch) lets go when its source is farther than this, in metres. */
export const DRAIN_REACH = 4;
/** Blood Pact: a hero linked by it takes this much damage (docs/phase-5a.md P5). */
const PACT_MULT = 1 + PACT_TAKEN;
/** Wound: healing received is multiplied by this. */
const WOUND_HEAL_MULT = 1 - HEAL_CUT;
/** A guard break also staggers the enemy this long (docs/phase-5a.md P6). */
const GUARD_BREAK_STAGGER = 1;
/** At most one `guardBlocked` event per guarded enemy in this many seconds. */
const GUARD_BLOCKED_GAP = 0.5;

export function isAilment(id: StatusId): boolean {
  return AILMENTS.has(id);
}

/** Alive and standing: can act, can be targeted. */
export function isActive(e: Entity | undefined): e is Entity & { health: Health } {
  return !!e?.health && !e.health.dead && !e.health.downed;
}

/**
 * Restless Dead (Dissonance): an enemy standing up again. Nothing touches it until it has:
 * hits and statuses pass, and heroes look elsewhere.
 */
export function rising(e: Entity): boolean {
  return e.enemy?.risen === true && e.enemy.state === 'spawning';
}

export function hasStatus(e: Entity, id: StatusId): boolean {
  const statuses = e.health?.statuses;
  if (!statuses) return false;
  for (const s of statuses) if (s.id === id) return true;
  return false;
}

export function getStatus(e: Entity, id: StatusId): Status | undefined {
  const statuses = e.health?.statuses;
  if (!statuses) return undefined;
  for (const s of statuses) if (s.id === id) return s;
  return undefined;
}

/**
 * Can't act: stunned, staggered or asleep; or (Movement III) possessed; or (the Finale) stilled by
 * the Grand Silence, which only the Silent Conductor applies.
 */
export function isDisabled(e: Entity): boolean {
  return (
    hasStatus(e, 'stun') ||
    hasStatus(e, 'stagger') ||
    hasStatus(e, 'sleep') ||
    hasStatus(e, 'possessed') ||
    hasStatus(e, 'stilled')
  );
}

export function totalShield(h: Health): number {
  let total = 0;
  for (const s of h.shields) total += s.amount;
  return total;
}

export function shieldOf(h: Health, kind: ShieldKind): Shield | undefined {
  for (const s of h.shields) if (s.kind === kind) return s;
  return undefined;
}

/** Shields that are not the Weaver's: what the hero would have had anyway (counterfactuals). */
export function ownShield(h: Health): number {
  let total = 0;
  for (const s of h.shields) if (!s.fromWeaver) total += s.amount;
  return total;
}

/** Adds (or replaces) a shield of one kind. One shield per kind per entity. */
/** Close Ranks: another hero standing within reach of `hero`. */
function nearAlly(world: World, hero: Entity): boolean {
  const r = world.mods.closeRanksRadius;
  for (const id of world.party) {
    const other = world.entities.get(id);
    if (!other || other.id === hero.id || !isActive(other)) continue;
    if (distSq(hero.x, hero.z, other.x, other.z) <= r * r) return true;
  }
  return false;
}

/**
 * Overflowing Grace: Mend's overheal tops up a shield on the hero, up to a share of their life,
 * lasting a few seconds from the last top-up (so it holds while Mend keeps feeding it). It keeps
 * to its own shield: another overshield (a hero's own, or another of yours) is left as it is.
 * Returns the overheal it took. On Brann with Scar Tissue the shield (its cap too) is that much
 * stronger, as `addShield` makes it: a top-up never cuts it back below what it already holds.
 */
function graceShield(world: World, hero: Entity, overheal: number): number {
  const h = hero.health!;
  const cap = h.maxHp * world.mods.graceShieldPct;
  const existing = shieldOf(h, 'overshield');
  if (existing?.grace) {
    const scar = scarTissueMult(world, hero);
    const before = existing.amount;
    if (scar === 1) existing.amount = Math.min(cap, existing.amount + overheal);
    else existing.amount = Math.max(before, Math.min(cap * scar, before + overheal * scar));
    existing.max = Math.max(existing.max, existing.amount);
    existing.expiresAt = Math.max(existing.expiresAt, world.time + world.mods.graceShieldDuration);
    const gained = Math.max(0, existing.amount - before);
    return scar === 1 ? gained : gained / scar;
  }
  if (existing) return 0;
  const amount = Math.min(cap, overheal);
  const shield = addShield(world, hero, 'overshield', amount, world.mods.graceShieldDuration, true);
  if (!shield) return 0;
  shield.grace = true;
  world.events.push({ type: 'graceShield', tick: world.tick, hero: hero.id, amount });
  return amount;
}

/** Scar Tissue (Bonds, docs/phase-5b.md): the Weaver's barriers on Brann are stronger. 1 else. */
export function scarTissueMult(world: World, target: Entity): number {
  if (!target.hero?.blood || !hasTalent(target, 'scar_tissue')) return 1;
  return 1 + talentValue(world, 'scar_tissue', 'pct') / 100;
}

export function addShield(
  world: World,
  target: Entity,
  kind: ShieldKind,
  amount: number,
  duration: number,
  fromWeaver: boolean,
  fromAura = false,
): Shield | null {
  const h = target.health;
  if (!h || h.dead || amount <= 0) return null;
  // Scar Tissue: every barrier of yours on Brann (Kael's Cued dome counts as yours).
  if (fromWeaver && target.hero?.blood) {
    const scar = scarTissueMult(world, target);
    if (scar !== 1) amount *= scar;
  }
  const shield: Shield = {
    kind,
    amount,
    max: amount,
    appliedAt: world.time,
    expiresAt: duration >= NEVER ? NEVER : world.time + duration,
    fromWeaver,
    fromAura,
  };
  const index = h.shields.findIndex((s) => s.kind === kind);
  if (index >= 0) h.shields[index] = shield;
  else h.shields.push(shield);
  world.events.push({
    type: 'shieldApplied',
    tick: world.tick,
    target: target.id,
    shield: kind,
    amount,
    fromWeaver,
  });
  return shield;
}

export function removeShield(
  world: World,
  target: Entity,
  kind: ShieldKind,
  broken: boolean,
): void {
  const h = target.health;
  if (!h) return;
  const index = h.shields.findIndex((s) => s.kind === kind);
  if (index < 0) return;
  const [removed] = h.shields.splice(index, 1);
  if (broken)
    world.events.push({ type: 'shieldBroken', tick: world.tick, target: target.id, shield: kind });
  // Blood Tithe (docs/phase-5b.md): a Tithe Ward gives Spirit back when it breaks (a blow or a
  // Perfect), never when it runs out.
  if (broken && removed?.tithe) titheRefund(world, target);
}

/**
 * Blood Tithe's refund: Spirit, capped like the Perfect Ward's; under Eldritch Conduit, Life
 * instead, by the same rule (telegraphs.ts `perfect`).
 */
function titheRefund(world: World, target: Entity): void {
  const weaver = world.entities.get(world.weaverId);
  const w = weaver?.weaver;
  const refund = world.mods.bloodTitheRefund;
  if (!weaver || !w || !(refund > 0)) return;
  let spirit = 0;
  let life = 0;
  if (world.mods.techniquesCostLife) {
    life = heal(world, weaver, refund, 'self', false);
    w.selfHealAcc += life;
  } else {
    const before = w.spirit;
    w.spirit = Math.min(w.maxSpirit - w.reservedSpirit, w.spirit + refund);
    spirit = Math.max(0, w.spirit - before);
  }
  world.events.push({ type: 'titheRefund', tick: world.tick, target: target.id, spirit, life });
}

/** Applies a status, unless immunity blocks it. Re-applying refreshes the duration. */
export function addStatus(
  world: World,
  target: Entity,
  id: StatusId,
  duration: number,
  source: EntityId | null,
): boolean {
  const h = target.health;
  if (!h || h.dead || rising(target)) return false;
  if (target.team === 'party' && isAilment(id) && hasStatus(target, 'immune')) return false;
  if (target.enemy && (target.enemy.tier === 'boss' || target.enemy.tier === 'miniboss')) {
    // Bosses shrug off hard control; Perfect Ward stagger still lands, briefly.
    if (id === 'stun' || id === 'sleep') return false;
    if (id === 'stagger') duration = Math.min(duration, 0.5);
  }
  const existing = getStatus(target, id);
  if (existing) {
    if (duration > existing.remaining) {
      existing.remaining = duration;
      existing.duration = duration;
    }
    existing.source = source;
  } else {
    h.statuses.push({ id, remaining: duration, duration, stacks: 1, source });
  }
  world.events.push({
    type: 'statusApplied',
    tick: world.tick,
    target: target.id,
    status: id,
    duration,
  });
  if ((id === 'stun' || id === 'stagger' || id === 'sleep') && target.enemy)
    interruptEnemy(world, target, null);
  return true;
}

/**
 * The answer a damage-over-time status wants, for the death recap (docs/phase-5a.md: every down
 * names the answer it missed).
 */
export const DOT_ANSWERS: Readonly<Partial<Record<StatusId, readonly AnswerTag[]>>> = {
  bleed: ['chime'],
  pinned: ['reel'],
  latched: ['reel', 'chime'],
  // Movement III (docs/phase-5c.md). `possessed`: a down at a possessed hero's hands.
  doom: ['chime', 'ward'],
  doomed: ['chime', 'ward'],
  voided: ['stack', 'reel', 'move'],
  unravelled: ['empower'],
  possessed: ['chime', 'focus'],
};

/**
 * Applies a content status payload (docs/phase-5a.md P2): stacks up to `maxStacks` with one
 * shared, refreshed timer; `dps` (× the Movement's damage scale) or `pctPerSec` ticks; `drain`
 * heals the source. A plain payload ({id, duration}) behaves as `addStatus`. True if it landed.
 * Chime's immunity blocks new stacks of an ailment; the payload's keys (`dps`, `tickIn`,
 * `drain`) appear on the status only when it has them.
 */
export function applyStatusPayload(
  world: World,
  target: Entity,
  payload: StatusPayload,
  source: EntityId | null,
): boolean {
  // A pin roots a hero (docs/phase-5a.md: heroes only); the Weaver and enemies take the hit alone.
  if (payload.id === 'pinned' && !target.hero) return false;
  // Movement III (docs/phase-5c.md): Doom (a payload with a `burst`) stacks on heroes only, so
  // the Weaver is never Doomed; and only a hero can be possessed.
  if (payload.burst && !target.hero) return false;
  if (payload.id === 'possessed') return possess(world, target, payload, source);
  const stacking = payload.stacks !== undefined || payload.maxStacks !== undefined;
  const ticking = payload.dps !== undefined || payload.pctPerSec !== undefined;
  // Today's statuses (a Dirge's silence): exactly as before.
  if (!stacking && !ticking && !payload.drain)
    return addStatus(world, target, payload.id, payload.duration, source);
  const h = target.health;
  if (!h || h.dead || h.downed || rising(target)) return false;
  // Chime's immunity blocks new stacks too: a deliberate reward for cleansing.
  if (target.team === 'party' && isAilment(payload.id) && hasStatus(target, 'immune')) return false;
  const add = payload.stacks ?? 1;
  const cap = payload.maxStacks ?? Infinity;
  // Per stack, per second: the Movement's damage scale on flat damage, never on a share of life.
  const dps =
    (payload.dps ?? 0) * (world.config.movement?.damage ?? 1) + (payload.pctPerSec ?? 0) * h.maxHp;
  const duration = payload.duration;
  let status = getStatus(target, payload.id);
  if (status) {
    // One shared timer, refreshed by every application. A payload that doesn't stack (a pin, a
    // latch) only refreshes: one stack, its source the latest to apply it (never doubled).
    status.stacks = stacking ? Math.min(cap, status.stacks + add) : 1;
    status.remaining = duration;
    status.duration = duration;
    status.source = source;
    if (ticking) {
      status.dps = dps;
      status.tickIn ??= DOT_TICK;
    }
    if (payload.drain) status.drain = true;
  } else {
    const stacks = stacking ? Math.min(cap, add) : 1;
    status = { id: payload.id, remaining: duration, duration, stacks, source };
    if (ticking) {
      status.dps = dps;
      status.tickIn = DOT_TICK;
    }
    if (payload.drain) status.drain = true;
    h.statuses.push(status);
  }
  world.events.push({
    type: 'statusApplied',
    tick: world.tick,
    target: target.id,
    status: payload.id,
    duration,
    ...(stacking ? { stacks: status.stacks } : {}),
  });
  // Doom (Movement III): at its `burst.at` stacks it clears and ignites its mark on the hero,
  // owned by the source that stacked it. Nothing lands within this hit.
  if (payload.burst && status.stacks >= payload.burst.at) ignite(world, target, payload, source);
  return true;
}

/**
 * A full Doom ignites (docs/phase-5c.md Q7): the stacks clear and its burst attack starts as a
 * mark on the hero (`startPayloadMark`, owned by the living source). While that hero still
 * carries an earlier burst's mark the stacks hold at the cap instead: never a second burst.
 */
function ignite(
  world: World,
  target: Entity,
  payload: StatusPayload,
  source: EntityId | null,
): void {
  const owner = source === null ? undefined : world.entities.get(source);
  const burst = payload.burst!.attack;
  if (!startPayloadMark || !isActive(owner) || !owner.enemy) return;
  if (!startPayloadMark(world, owner, target, burst, true)) return;
  removeStatus(world, target, payload.id, 'detonated');
  startPayloadMark(world, owner, target, burst, false);
}

/**
 * Possession (docs/phase-5c.md Q6): a plain status on a hero (`addStatus`, so Chime's immunity
 * blocks it), striking an ally on its own `tickIn` clock (statuses.ts). Heroes only.
 */
function possess(
  world: World,
  target: Entity,
  payload: StatusPayload,
  source: EntityId | null,
): boolean {
  if (!target.hero || !addStatus(world, target, payload.id, payload.duration, source)) return false;
  const status = getStatus(target, payload.id)!;
  status.tickIn ??= DOT_TICK;
  world.events.push({ type: 'possessed', tick: world.tick, hero: target.id, source });
  return true;
}

/**
 * Starts a payload's burst mark (enemies.ts `startPayloadMark`), installed by the enemy system
 * to avoid an import cycle. With `check`, it only says whether it could start one now.
 */
type PayloadMarkStarter = (
  world: World,
  owner: Entity,
  target: Entity,
  attack: string,
  check: boolean,
) => boolean;
let startPayloadMark: PayloadMarkStarter | null = null;
export function setStartPayloadMark(fn: PayloadMarkStarter): void {
  startPayloadMark = fn;
}

/**
 * After a hit from `source` dealt `dealt` to `target` (docs/phase-5a.md P3): applies the hit's
 * payload merged with the source's affix `onHit`, only if `dealt > 0` (a Ward that absorbs it
 * all blocks it). Does nothing when neither is present, as on every Movement I hit. Melee
 * (enemies.ts), bolts (hits.ts, `PendingHit.onHit`) and telegraphs (telegraphs.ts) call it.
 */
export function applyOnHit(
  world: World,
  source: Entity,
  target: Entity,
  dealt: number,
  payload?: StatusPayload,
): void {
  if (dealt <= 0 || !isActive(target)) return;
  if (payload) applyStatusPayload(world, target, payload, source.id);
  const affixes = source.enemy?.affixes;
  if (!affixes || affixes.length === 0) return;
  for (const id of affixes) {
    const onHit = world.content.affixes.find((a) => a.id === id)?.onHit;
    // The hit's own payload already landed; an affix naming the same status doesn't stack on it.
    if (onHit && onHit.id !== payload?.id && isActive(target))
      applyStatusPayload(world, target, onHit, source.id);
  }
}

/**
 * A damage-over-time status's name in damage events and death recaps: "Bleed ×6 (Sanguine
 * Hound)", "Pinned (Impaler)".
 */
export function dotName(
  world: { readonly entities: EntityStoreView },
  s: DeepReadonly<Status>,
): string {
  const label = s.id.charAt(0).toUpperCase() + s.id.slice(1);
  const stacks = s.stacks > 1 ? ` ×${s.stacks}` : '';
  const source = s.source === null ? undefined : world.entities.get(s.source);
  const by = source?.enemy ? ` (${enemyDef(source.enemy.defId).name})` : '';
  return `${label}${stacks}${by}`;
}

/** Inside a Sanctuary pool (Vharun's Bloodmoon), or no Bloodmoon at all. */
export function inSanctuary(
  world: Pick<WorldState, 'field'>,
  e: { readonly x: number; readonly z: number },
): boolean {
  const sanctuary = world.field.sanctuary;
  if (!sanctuary) return true;
  for (const p of sanctuary.pools) if (distSq(e.x, e.z, p.x, p.z) <= p.r * p.r) return true;
  return false;
}

/**
 * What healing `target` receives is multiplied by (Wound, Bloodmoon); 1 almost always. A Wound
 * cuts whoever carries it, the Weaver included; the Bloodmoon cuts heroes outside every pool
 * (docs/phase-5a.md), never the Weaver.
 */
export function healReceivedMult(world: Pick<WorldState, 'field'>, target: ReadonlyEntity): number {
  if (target.team !== 'party') return 1;
  let mult = 1;
  if (target.health?.statuses.some((s) => s.id === 'wound')) mult *= WOUND_HEAL_MULT;
  const sanctuary = world.field.sanctuary;
  if (sanctuary && target.hero && !inSanctuary(world, target)) mult *= sanctuary.healMult;
  return mult;
}

export function removeStatus(
  world: World,
  target: Entity,
  id: StatusId,
  reason: 'expired' | 'cleansed' | 'detonated' | 'freed',
): boolean {
  const h = target.health;
  if (!h) return false;
  const index = h.statuses.findIndex((s) => s.id === id);
  if (index < 0) return false;
  const [removed] = h.statuses.splice(index, 1);
  world.events.push({
    type: 'statusRemoved',
    tick: world.tick,
    target: target.id,
    status: id,
    reason,
    ...stacksOf(removed!),
  });
  return true;
}

/** `statusRemoved.stacks`: only for a stacking status with more than one stack. */
function stacksOf(s: Status): { stacks?: number } {
  return s.stacks > 1 ? { stacks: s.stacks } : {};
}

/** Removes every ailment. Returns how many were removed. */
export function cleanseAilments(world: World, target: Entity): number {
  const h = target.health;
  if (!h) return 0;
  let removed = 0;
  for (let i = h.statuses.length - 1; i >= 0; i--) {
    const s = h.statuses[i]!;
    if (!isAilment(s.id)) continue;
    h.statuses.splice(i, 1);
    world.events.push({
      type: 'statusRemoved',
      tick: world.tick,
      target: target.id,
      status: s.id,
      reason: 'cleansed',
      ...stacksOf(s),
    });
    removed++;
  }
  return removed;
}

/** `self`: the Martyr healing herself (Blood Font, Sanguine Covenant), not support. */
/**
 * `lifesteal` (docs/phase-5b.md): what Brann's axe drinks. Never the Weaver's: no ledger,
 * supportReceived, healing threat or Fermata save; 0 while he is held.
 */
export type HealVia =
  'mend' | 'chime' | 'aura' | 'revive' | 'solo' | 'self' | 'rewind' | 'other' | 'lifesteal';

/**
 * Heals `target`. Weaver healing (everything except hero Solos) counts in the ledger and
 * draws healing aggro. `emit = false` lets callers aggregate floating numbers.
 */
export function heal(
  world: World,
  target: Entity,
  amount: number,
  via: HealVia,
  emit = true,
): number {
  const h = target.health;
  if (!h || h.dead || h.downed || amount <= 0) return 0;
  // Lifesteal (docs/phase-5b.md) is blocked while Fermata holds him: a release can't stand him
  // up on his own axe.
  if (via === 'lifesteal' && target.hero?.hold) return 0;
  // Wounding Strikes (Dissonance): heroes are healed less.
  if (target.hero) amount *= world.mods.heroHealMult;
  // Movement II (docs/phase-5a.md): a Wound, and Bloodmoon outside the Sanctuary pools, cut the
  // party's healing. A revive stands them up whole; shields aren't healing.
  if (via !== 'revive') {
    const cut = healReceivedMult(world, target);
    if (cut !== 1) amount *= cut;
  }
  // Blood Rage (docs/phase-5b.md): the Weaver's healing on Brann is halved (Blood Oath lifts it).
  if (target.hero?.blood) {
    const cut = weaverHealCut(world.content, target, via);
    if (cut !== 1) amount *= cut;
  }
  // Bulwark of Faith (Bonds): Kael is healed more while you Thread him. That part is his.
  let own = 1;
  if (hasTalent(target, 'bulwark_of_faith') && threadedOn(world, target)) {
    own = 1 + talentValue(world, 'bulwark_of_faith', 'pct') / 100;
    amount *= own;
  }
  // Martyr's Vow: the Weaver's healing received is doubled while it lasts.
  if (target.weaver && world.field.vow) amount *= world.mods.vowHealMult;
  // Prism Covenant (the Astrolabe): the Weaver can't be healed above a share of her Life.
  const ceiling =
    target.weaver && world.mods.lifeCapPct < 1 ? h.maxHp * world.mods.lifeCapPct : h.maxHp;
  const effective = Math.max(0, Math.min(amount, ceiling - h.hp));
  const overheal = amount - effective;
  h.hp += effective;
  // Overflowing Grace (the Astrolabe): Mend's overheal becomes a shield on the hero.
  let graced = 0;
  if (via === 'mend' && overheal > 0 && target.hero && world.mods.graceShieldPct > 0)
    graced = graceShield(world, target, overheal);
  // Blood Oath (Bonds): what Grace didn't take of your overheal on Brann rides on his next swing.
  const blood = target.hero?.blood;
  if (blood && overheal > graced && isWeaverVia(via) && hasTalent(target, 'blood_oath')) {
    const cap = (h.maxHp * talentValue(world, 'blood_oath', 'cap')) / 100;
    blood.oathBank = Math.min(cap, blood.oathBank + (overheal - graced));
  }
  // Fermata: the Weaver's healing during a hold is what saves the hero (passive regen doesn't).
  const hold = target.hero?.hold;
  if (hold && hold.savedBy === null && effective > 0) {
    if (via === 'mend' || via === 'chime' || via === 'rewind' || via === 'other')
      hold.savedBy = via;
  }
  if (via !== 'solo' && via !== 'self' && via !== 'lifesteal' && target.team === 'party') {
    const yours = effective / own;
    world.ledger.healing += yours;
    world.ledger.overheal += overheal / own;
    // Bonds: what you did for this hero.
    if (target.hero) target.hero.supportReceived += yours;
    if (via === 'aura') world.ledger.auras.healing += yours;
    else if (via === 'mend') world.ledger.thread.healing += yours;
    if (effective > 0) addHealingThreat(world, effective);
  }
  if (emit && (effective > 0 || overheal > 0)) {
    world.events.push({
      type: 'healApplied',
      tick: world.tick,
      target: target.id,
      source: via === 'solo' ? null : via === 'lifesteal' ? target.id : world.weaverId,
      amount: effective,
      overheal,
      via,
    });
  }
  return effective;
}

export interface DamageOpts {
  source: EntityId | null;
  /** Shown in death recaps ("Toll Cleave", "Bell Brute"). */
  sourceName: string;
  amount: number;
  /** The Weaver's share of `amount` (Empower, auras, Flourishes). */
  amplified?: number;
  /** The auras' part of `amplified`. */
  aura?: number;
  /** Empower's part of `amplified`. */
  empower?: number;
  crit?: boolean;
  telegraph?: Telegraph | null;
  kind?: 'hit' | 'tick' | 'detonation';
  /** Empowered hits can damage Discord shields. */
  empowered?: boolean;
  /**
   * Already taken over by Oathkeeper (Bonds), or borne by the Weaver for a hero (Bear): it lands
   * where it was sent, not taken over again.
   */
  oath?: boolean;
  /**
   * What an Aegis Link spared a hero of this hit (docs/phase-4f.md): the share it lightened, and
   * the Weaver's share once she's joined. Credited as support with the life it kept.
   */
  linked?: number;
  /**
   * An Empowered Piercing Shot (docs/phase-5a.md P6): it breaks a guarded enemy's guard for the
   * guard's `breakTime`, with a 1 s stagger.
   */
  breaksGuard?: boolean;
  /**
   * A damage-over-time status's tick (with kind 'tick'): the death recap puts the answer it
   * wanted (`DOT_ANSWERS`) first among the techniques that were ready.
   */
  status?: StatusId;
}

export interface DamageResult {
  dealt: number;
  absorbed: number;
  /** Of `absorbed`, how much Weaver shields took. */
  absorbedByWeaver: number;
  /** Of `absorbed`, how much a Ward took. */
  absorbedByWard: number;
  /** Of `absorbed`, how much a cued dome took. */
  absorbedByDome: number;
  /** Invulnerable or otherwise ignored. */
  blocked: boolean;
  /** Oathkeeper (Bonds) took the hit: who did, and what landed on them. */
  takenBy?: EntityId;
  takenDealt?: number;
  /** This hit downed or killed the target. */
  downed: boolean;
  /** Martyr's Veil took this hit for the hero (a Save is already recorded). */
  martyred: boolean;
  /** This hit's Save is already logged (Martyr's Veil, the Martyr's Bear or Vow). */
  saved: boolean;
  /**
   * The Finale (docs/phase-5d.md Q2): what Bear, Shared Wounds or the Vow sent to the Weaver
   * from this hit. Set only when above 0 and while `world.internal.m4` exists, so no legacy
   * result ever carries the key.
   */
  borne?: number;
  /**
   * The Finale's verdict: of `absorbedByWeaver`, how much an aura's barrier took (Ostinato, the
   * chorus pulse), which answers nothing. Set only when above 0 and while `world.internal.m4`
   * exists, as `borne` is.
   */
  absorbedByAura?: number;
}

const NO_DAMAGE: DamageResult = {
  dealt: 0,
  absorbed: 0,
  absorbedByWeaver: 0,
  absorbedByWard: 0,
  absorbedByDome: 0,
  blocked: true,
  downed: false,
  martyred: false,
  saved: false,
};

/** Deals damage through armour and shields, then handles downs, deaths, threat and the ledger. */
export function dealDamage(world: World, target: Entity, opts: DamageOpts): DamageResult {
  const h = target.health;
  if (!h || h.dead || h.downed || opts.amount <= 0) return NO_DAMAGE;
  if (h.invulnerable > 0 || rising(target)) return NO_DAMAGE;
  if (
    target.enemy &&
    world.internal.boss.phaseShiftUntil > world.time &&
    (target.enemy.tier === 'boss' || target.enemy.tier === 'miniboss')
  ) {
    return NO_DAMAGE;
  }

  const source = opts.source === null ? undefined : world.entities.get(opts.source);
  // Bonds (docs/phase-4e.md): an enemy's hit on a hero may be swallowed by Vexis's sphere; on a
  // hero or the Weaver, taken over by Kael's Oathkeeper.
  if ((target.hero || target.weaver) && opts.kind !== 'tick' && (source?.enemy || opts.telegraph)) {
    const taken =
      (target.hero ? sphere(world, target, opts.amount, !!opts.telegraph) : null) ??
      (opts.oath ? null : oath(world, target, opts));
    if (taken) return taken;
    // Aegis Link (a Ward variant, docs/phase-4f.md): a linked member takes only their share.
    if (!opts.oath) opts = linkShare(world, target, opts) ?? opts;
  }
  let amount = opts.amount;
  // Relics on hero hits (Heavy Score, Warden's Key): the extra is the Weaver's share.
  let amplifiedIn = opts.amplified ?? 0;
  // The Calling's part of it (the Luminary's Radiance and Eclipse, docs/phase-3c.md).
  let callingIn = 0;
  let radianceIn = 0;
  if (source?.hero && target.enemy) {
    // Bonds: Hunter's Mark (Lyra) on your Focus, and Hawk's Vigil's mark. The heroes', not your
    // share.
    if (target.id === world.focusTarget && isActive(talentHolder(world, 'hunters_mark')))
      amount *= 1 + talentValue(world, 'hunters_mark', 'pct') / 100;
    if (target.enemy.markedUntil > world.time)
      amount *= 1 + soloValue(world, 'hawks_vigil', 'pct') / 100;
    // Warden's Key: on the Mutes, and (Movement III) the Silencing elites that carry their field.
    let mult =
      world.mods.partyDamageMult *
      (suppressRadiusOf(world, target) > 0 ? world.mods.muteDamageMult : 1);
    // The Astrolabe's Anthem and Shield Bearer: heroes in a field, or under a Ward, hit harder.
    if (world.mods.inFieldDamage > 0 && source.hero.inField) mult *= 1 + world.mods.inFieldDamage;
    if (world.mods.wardedDamage > 0 && source.health && shieldOf(source.health, 'ward'))
      mult *= 1 + world.mods.wardedDamage;
    if (mult !== 1) {
      amplifiedIn += amount * (mult - 1);
      amount *= mult;
    }
    const shine = radianceOf(world, source);
    const eclipse = eclipseOn(world, target);
    if (shine + eclipse > 0) {
      radianceIn = amount * shine;
      callingIn = amount * (shine + eclipse);
      amplifiedIn += callingIn;
      amount += callingIn;
    }
  }
  const amountIn = amount;
  // A guard arc (docs/phase-5a.md P6): a hero's hit from in front of it mostly glances off; an
  // Empowered Piercing Shot breaks it. After `amountIn`, so every share is of what landed.
  if (source?.hero && target.enemy?.guard) amount *= guardMult(world, target, source, opts);
  // Spindles (Movement III, docs/phase-5c.md Q11): a tethered boss takes less from heroes.
  if (source?.hero && target.enemy?.tethered !== undefined && target.enemy.tethered > 0)
    amount *= tetherMult(world, target, source);
  // Blood Pact (P5): a hero it links takes more of everything while it lasts.
  if (target.hero && hasStatus(target, 'pact')) amount *= PACT_MULT;
  // Scarred Hide (the Martyr): the Weaver takes less while she Bears someone.
  if (target.weaver?.threadMode === 'bear' && target.weaver.threadSlot !== null)
    amount *= world.mods.bearDamageTaken;
  // Oathkeeper (Bonds): while he keeps it, Kael takes less of everything, his own hits too.
  if (target.hero?.soloId === 'oathkeeper' && target.hero.soloActive > 0)
    amount *= 1 - soloValue(world, 'oathkeeper', 'guard') / 100;
  // Armour only softens ordinary hits; telegraphed attacks are answered, not soaked, and so are
  // damage-over-time ticks (a Chime or a Reel ends them).
  if (target.hero && !opts.telegraph && opts.kind !== 'tick')
    amount *= 1 - heroDef(target.hero.defId).armor;
  // Absolve and Anchor (technique variants): credited, as the guards below are, with the life
  // they kept.
  let spared = 0;
  const guard = variantGuard(world, target);
  if (guard > 0) {
    spared = amount * guard;
    amount -= spared;
  }
  // Fermata: heroes low on life take less from everything.
  const fx = target.hero ? heroFx(world, target) : null;
  let guarded = 0;
  if (fx && fx.guardDr > 0 && h.hp < h.maxHp * fx.guardBelow) {
    const before = amount;
    amount *= 1 - fx.guardDr;
    guarded = before - amount;
  }
  // Haloed (the Luminary): heroes in your field take less from ordinary hits. Like armour,
  // it leaves telegraphed attacks alone: the big hits you see coming are still yours to Ward.
  let haloed = 0;
  if (!opts.telegraph && target.hero?.inField && world.mods.haloedReduction > 0) {
    haloed = amount * world.mods.haloedReduction;
    amount -= haloed;
  }
  // Close Ranks (the Astrolabe): a hero near another takes less from ordinary hits.
  let ranks = 0;
  if (!opts.telegraph && target.hero && world.mods.closeRanks > 0 && nearAlly(world, target)) {
    ranks = amount * world.mods.closeRanks;
    amount -= ranks;
  }

  let absorbed = 0;
  let absorbedByWeaver = 0;
  let absorbedByAura = 0;
  let absorbedByWard = 0;
  let absorbedByDome = 0;
  if (h.shields.length > 0) {
    const discord = shieldOf(h, 'discord');
    if (discord) {
      // Empowered heroes shatter Discord barriers (×1.5); everyone else barely scratches them.
      const scale = opts.empowered ? DISCORD_EMPOWERED : DISCORD_PLAIN;
      const take = Math.min(discord.amount, amount * scale);
      discord.amount -= take;
      absorbed += take;
      amount = 0;
      if (discord.amount <= 0.0001) removeShield(world, target, 'discord', true);
    }
    // Soonest-expiring first, so nothing is wasted.
    h.shields.sort(
      (a, b) => a.expiresAt - b.expiresAt || shieldOrder(a.kind) - shieldOrder(b.kind),
    );
    for (let i = 0; i < h.shields.length && amount > 0;) {
      const s = h.shields[i]!;
      // Shatterproof Halo (the Astrolabe): a Ward takes the whole hit, and loses at most a share
      // of its full barrier to it. Never a Mimic's `mirror` copy of one (Movement III).
      const halo = s.kind === 'ward' && world.mods.wardHitCap > 0;
      const take = halo ? amount : Math.min(s.amount, amount);
      s.amount -= halo ? Math.min(s.amount, take, s.max * world.mods.wardHitCap) : take;
      amount -= take;
      absorbed += take;
      if (s.fromWeaver) absorbedByWeaver += take;
      if (s.fromAura) absorbedByAura += take;
      if (s.kind === 'ward') absorbedByWard += take;
      if (s.kind === 'dome' && s.fromWeaver) absorbedByDome += take;
      if (s.amount <= 0.0001) removeShield(world, target, s.kind, true);
      else i++;
    }
    // Riposte Bash (Bonds): a Ward on Kael took a blow; he answers it (heroes.ts).
    const hero = target.hero;
    // Not on a damage-over-time tick: there's no blow to answer.
    if (
      absorbedByWard > 0 &&
      opts.kind !== 'tick' &&
      source?.enemy &&
      hero &&
      hasTalent(target, 'riposte_bash')
    )
      if (world.time >= hero.talentReadyAt) hero.riposteOn = source.id;
  }

  // The Martyr (docs/phase-3d.md): Bear and Shared Wounds send part of what got through to the
  // Weaver; the Vow holds a hero at 1 life and sends her the rest, softened. A hero Fermata
  // already holds needs neither.
  const hpBefore = h.hp;
  const martyrFor = !!target.hero && amount > 0 && !target.hero.hold;
  let borne = 0;
  let borneVia: 'bear' | 'shared' = 'bear';
  if (martyrFor && world.mods.bearShare > 0) {
    const bear = bearShareOf(world, target);
    if (bear.share > 0) {
      // She takes only what she can bear (never more than leaves her at 1 life), and nothing
      // of a hit that fells the hero anyway: the Veil, Fermata or the Vow may still catch it.
      const lift = Math.min(amount * bear.share, bearRoom(world));
      if (amount - lift < h.hp) {
        borne = lift;
        borneVia = bear.via;
        amount -= lift;
      }
    }
  }
  let vowExcess = 0;
  if (martyrFor && world.field.vow) {
    const allowed = Math.max(0, h.hp - 1);
    if (amount > allowed) {
      vowExcess = amount - allowed;
      amount = allowed;
    }
  }
  let dealt = Math.min(h.hp, amount);
  let martyred = false;
  let saved = false;
  if (target.hero && dealt >= h.hp && dealt > 0) {
    // Fermata holds a lethal hit at 1 HP (once per encounter); a held hero can't drop below 1.
    if (!target.hero.hold && !target.hero.fermataUsed && fx && fx.holdTime > 0)
      startHold(
        world,
        target,
        fx.holdTime,
        opts.sourceName,
        amount,
        opts.status,
        telegraphAnswers(world, opts.telegraph),
      );
    if (target.hero.hold) dealt = Math.max(0, h.hp - 1);
    // Deathless (Bonds, docs/phase-5b.md): open, or about to open on this very blow, at 1 life.
    else if (target.hero.blood && deathlessHolds(world, target)) dealt = Math.max(0, h.hp - 1);
    else if (world.relics.veil && martyr(world, target, amount, opts)) {
      dealt = 0;
      martyred = true;
      saved = true;
    } else if (unbreakable(world, target)) dealt = Math.max(0, h.hp - 1);
    // Sacrificial Lamb (a Movement III relic): once a fight, the healthiest other hero takes it.
    else if (
      world.mods.sacrificialLamb > 0 &&
      !world.internal.lambUsed &&
      lamb(world, target, amount, opts)
    ) {
      dealt = 0;
      saved = true;
    }
  }
  if (target.weaver?.undying && dealt >= h.hp && dealt > 0) {
    dealt = Math.max(0, h.hp - 1);
    undying(world, target);
  }
  h.hp -= dealt;
  h.lastHitAt = world.time;
  // Brann (docs/phase-5b.md): his bleed rate, Deathless's trigger, Berserker's Hymn turning on.
  if (target.hero?.blood) afterBloodDamage(world, target, hpBefore, dealt);
  if (absorbedByWeaver > 0) world.ledger.shielded += absorbedByWeaver;
  if (absorbedByAura > 0) world.ledger.auras.shielded += absorbedByAura;
  // Bonds: the life your shields and guards kept for this hero (summed as it's credited).
  const shieldedBefore = world.ledger.shielded;
  // The guard and Haloed are credited only with life the hero kept, between them: none if the
  // hit downs them anyway.
  let keptLife = h.hp;
  if (guarded > 0) {
    const kept = Math.min(guarded, keptLife);
    keptLife -= kept;
    world.ledger.shielded += kept;
    world.ledger.auras.shielded += kept;
  }
  if (haloed > 0) {
    const kept = Math.min(haloed, keptLife);
    keptLife -= kept;
    world.ledger.shielded += kept;
    world.ledger.calling.shielded += kept;
  }
  if (ranks > 0) {
    const kept = Math.min(ranks, keptLife);
    keptLife -= kept;
    world.ledger.shielded += kept;
  }
  // The technique variants' (docs/phase-4f.md): Absolve's and Anchor's guards, an Aegis Link.
  const variantKept = spared + (target.hero ? (opts.linked ?? 0) : 0);
  if (variantKept > 0) {
    const kept = Math.min(variantKept, keptLife);
    keptLife -= kept;
    world.ledger.shielded += kept;
  }
  if (borne > 0 || vowExcess > 0) {
    // What the Martyr took for the hero: credited with the life it kept; a Save if it was the
    // difference between standing and falling.
    const kept = Math.min(borne + vowExcess, keptLife);
    world.ledger.shielded += kept;
    world.ledger.calling.shielded += kept;
    // Bear's Save each time it turns a fall; the Vow's once, when it first holds them at 1.
    const lethal = dealt + borne + vowExcess >= hpBefore && h.hp > 0;
    if (lethal && target.hero && !martyred && (vowExcess === 0 || hpBefore > 1)) {
      recordSave(
        world,
        target,
        vowExcess > 0 ? 'vow' : 'bear',
        borne + vowExcess + dealt,
        opts.sourceName,
      );
      saved = true;
    }
    if (borne > 0) sendToWeaver(world, target, borne, borneVia, opts);
    if (vowExcess > 0) sendToWeaver(world, target, vowExcess * world.mods.vowRedirect, 'vow', opts);
  }
  if (target.hero)
    target.hero.supportReceived += absorbedByWeaver + world.ledger.shielded - shieldedBefore;

  const total = dealt + absorbed;
  const amplifiedShare = amplifiedIn > 0 && amountIn > 0 ? (amplifiedIn * total) / amountIn : 0;
  const auraShare = opts.aura && amountIn > 0 ? (opts.aura * total) / amountIn : 0;
  const empowerShare = opts.empower && amountIn > 0 ? (opts.empower * total) / amountIn : 0;
  const callingShare = callingIn > 0 && amountIn > 0 ? (callingIn * total) / amountIn : 0;
  const radianceShare = radianceIn > 0 && amountIn > 0 ? (radianceIn * total) / amountIn : 0;
  if (source?.hero && target.enemy) {
    source.hero.damageDealt += total;
    source.hero.damageAmplified += amplifiedShare;
    world.ledger.partyDamage += total;
    world.ledger.amplified += amplifiedShare;
    world.ledger.auras.amplified += auraShare;
    world.ledger.thread.amplified += empowerShare;
    world.ledger.calling.amplified += callingShare;
    addThreat(target, source.hero.slot, total * heroDef(source.hero.defId).threatMult);
    if (target.enemy.tier === 'normal' && world.mods.hammerfallChance > 0) {
      if (
        hasAura(world, source.hero.auraMask, 'fortissimo') &&
        world.rng.combat.chance(world.mods.hammerfallChance)
      ) {
        addStatus(world, target, 'stun', 0.6, source.id);
      }
    }
    if (hasStatus(target, 'sleep')) removeStatus(world, target, 'sleep', 'expired');
    // Hawk Eye (Bonds): Lyra's Empowered crits ring for you.
    if (opts.crit && opts.empowered && hasTalent(source, 'hawk_eye'))
      gainResonance(world, talentValue(world, 'hawk_eye', 'resonance'), 'hawk_eye');
    // Blood Rage (docs/phase-5b.md): Brann's axe drinks from what it cuts.
    if (source.hero.blood) onBloodHit(world, source, target, total);
  }
  if (target.hero && dealt > 0) {
    const recent = target.hero.recentDamage;
    recent.push({ time: world.time, amount: dealt, source: opts.sourceName });
    if (recent.length > 8) recent.shift();
  }

  world.events.push({
    type: 'damageTaken',
    tick: world.tick,
    target: target.id,
    source: opts.source,
    amount: dealt,
    absorbed,
    amplified: amplifiedShare,
    aura: auraShare,
    radiance: radianceShare,
    eclipse: callingShare - radianceShare,
    crit: opts.crit ?? false,
    telegraph: opts.telegraph?.id ?? null,
    hit: opts.kind ?? 'hit',
  });

  let downed = false;
  if (h.hp <= 0) {
    downed = true;
    if (target.hero)
      downHero(
        world,
        target,
        opts.sourceName,
        opts.status,
        telegraphAnswers(world, opts.telegraph),
      );
    else if (target.weaver) downWeaver(world, target);
    else if (!restlessRise(world, target)) killEnemy(world, target, source ?? null);
  } else if (opts.kind !== 'tick' && source?.enemy && hasTalent(target, 'arcane_ward'))
    arcaneWard(world, target, source);
  const result: DamageResult = {
    dealt,
    absorbed,
    absorbedByWeaver,
    absorbedByWard,
    absorbedByDome,
    blocked: false,
    downed,
    martyred,
    saved,
  };
  // The Finale (docs/phase-5d.md Q2): what the Martyr took off this hit, for the Discord verdict.
  // Only while the Conductor's script state exists, so no other fight's result has the key.
  if (world.internal.m4 && borne + vowExcess > 0) result.borne = borne + vowExcess;
  if (world.internal.m4 && absorbedByAura > 0) result.absorbedByAura = absorbedByAura;
  return result;
}

/**
 * A guarded enemy (docs/phase-5a.md P6) struck by `source`: ×`frontMult` from inside the arc
 * while the guard holds (a grey "Blocked", at most every half second), ×1 from the flank or
 * while it's broken. A `breaksGuard` hit breaks it for `breakTime`, with a 1 s stagger.
 */
function guardMult(world: World, target: Entity, source: Entity, opts: DamageOpts): number {
  const guard = target.enemy!.guard!;
  if (guard.brokenUntil > world.time) return 1;
  const def = enemyDef(target.enemy!.defId).guard;
  if (!def) return 1;
  if (opts.breaksGuard) {
    guard.brokenUntil = world.time + def.breakTime;
    addStatus(world, target, 'guardBroken', def.breakTime, source.id);
    addStatus(world, target, 'stagger', GUARD_BREAK_STAGGER, source.id);
    world.events.push({ type: 'guardBroken', tick: world.tick, enemy: target.id });
    return 1;
  }
  const dx = source.x - target.x;
  const dz = source.z - target.z;
  const d = Math.sqrt(dx * dx + dz * dz);
  // Standing on it, a hero is in front.
  const front =
    d < 1e-6 || (dx * guard.fx + dz * guard.fz) / d >= dcos((def.arcDeg / 2) * (Math.PI / 180));
  if (!front) return 1;
  if (guard.blockedAt === undefined || world.time - guard.blockedAt >= GUARD_BLOCKED_GAP) {
    guard.blockedAt = world.time;
    world.events.push({
      type: 'guardBlocked',
      tick: world.tick,
      enemy: target.id,
      source: source.id,
    });
  }
  return def.frontMult;
}

/**
 * A tethered boss's damage taken from heroes (docs/phase-5c.md Q11): × (1 − the Spindles' `dr`),
 * the largest of its standing tethered adds', with a grey "Spindled" at most every half second.
 */
function tetherMult(world: World, target: Entity, source: Entity): number {
  let dr = 0;
  for (const m of world.entities.list()) {
    if (!m.enemy || !m.health || m.health.dead) continue;
    const tether = enemyDef(m.enemy.defId).tether;
    if (tether && tether.dr > dr) dr = tether.dr;
  }
  if (dr <= 0) return 1;
  const last = spindledAt.get(target);
  if (last === undefined || world.time - last >= GUARD_BLOCKED_GAP) {
    spindledAt.set(target, world.time);
    world.events.push({ type: 'spindled', tick: world.tick, enemy: target.id, source: source.id });
  }
  return 1 - dr;
}

/**
 * When each tethered boss last showed "Spindled": the floater's rate limit. It decides only an
 * event, never state, so it lives beside the entity (unhashed) rather than on it.
 */
const spindledAt = new WeakMap<Entity, number>();

/**
 * Sacrificial Lamb (docs/phase-5c.md): the lethal hit goes to the healthiest other standing hero
 * (the most life; ties to the lower slot), once a fight. False when there is no one to take it.
 * Like Martyr's Veil, it passes on only what got through: `amount` is the hit after the target's
 * own armour, guards and shields, which this very blow has already spent. Redirecting the raw
 * hit would make it be paid twice (the target's Ward gone, and the whole blow on the other).
 */
function lamb(world: World, target: Entity, amount: number, opts: DamageOpts): boolean {
  let other: (Entity & { health: Health }) | null = null;
  for (const id of world.party) {
    const e = world.entities.get(id);
    if (!isActive(e) || e === target || !e.hero || e.health.invulnerable > 0) continue;
    if (other === null || e.health.hp > other.health.hp) other = e;
  }
  if (!other) return false;
  world.internal.lambUsed = true;
  relicFired(world, 'sacrificial_lamb', target.id, [other.id]);
  recordSave(world, target, 'other', amount, opts.sourceName);
  dealDamage(world, other, { ...opts, amount, oath: true });
  return true;
}

/** The Weaver's Thread is on this hero. */
function threadedOn(world: World, e: Entity): boolean {
  const slot = world.entities.get(world.weaverId)?.weaver?.threadSlot;
  return slot !== null && slot !== undefined && e.hero?.slot === slot;
}

/**
 * Celestial Sphere (Bonds, Vexis's alternate Solo): it swallows a hit whole while it lasts. A
 * cued one is your Cue's doing: its hits are credited to you.
 */
function sphere(
  world: World,
  target: Entity,
  amount: number,
  telegraph: boolean,
): DamageResult | null {
  const hero = target.hero!;
  if (hero.sphereHits <= 0 || hero.sphereUntil <= world.time) return null;
  hero.sphereHits--;
  if (hero.sphereCued) {
    // The life it kept: after armour (telegraphs ignore it), up to what the hero has.
    const armor = telegraph ? 0 : heroDef(hero.defId).armor;
    const kept = Math.min(amount * (1 - armor), target.health!.hp);
    world.ledger.shielded += kept;
    hero.supportReceived += kept;
  }
  const vexis = world.party
    .map((id) => world.entities.get(id))
    .find((e) => e?.hero?.soloId === 'celestial_sphere');
  if (vexis) talentFired(world, vexis, 'celestial_sphere', target.x, target.z, target.id);
  return { ...NO_DAMAGE, absorbed: amount, blocked: false };
}

/**
 * Oathkeeper (Bonds, Kael's alternate Solo): while it lasts, a hit on a hero near Kael lands on
 * him instead, at a share.
 */
function oath(world: World, target: Entity, opts: DamageOpts): DamageResult | null {
  for (const id of world.party) {
    const kael = world.entities.get(id);
    const k = kael?.hero;
    if (!k || k.soloId !== 'oathkeeper' || k.soloActive <= 0 || kael === target) continue;
    // Untouchable or held at 1 life, he can't take it: it lands where it was aimed.
    if (!isActive(kael) || kael.health.invulnerable > 0 || k.hold) continue;
    const radius = soloValue(world, 'oathkeeper', k.soloCued ? 'cuedRadius' : 'radius');
    if (distSq(kael.x, kael.z, target.x, target.z) > radius * radius) continue;
    const share = soloValue(world, 'oathkeeper', k.soloCued ? 'cuedPct' : 'pct') / 100;
    talentFired(world, kael, 'oathkeeper', target.x, target.z, target.id);
    const r = dealDamage(world, kael, { ...opts, amount: opts.amount * share, oath: true });
    return { ...NO_DAMAGE, blocked: false, takenBy: kael.id, takenDealt: r.downed ? 0 : r.dealt };
  }
  return null;
}

/**
 * Aegis Link (a Ward variant): a hit on a linked member is lightened, then split evenly among the
 * members still standing, the Weaver among them once a Perfect brought her in. The others take
 * their shares here; the target's share goes on. Shares are never split again. In the Finale's
 * Grand Silence the Weaver takes no share: its blows are shares of a stilled hero's own life
 * (a third of a Final Cadence on Kael is more than her whole life), and she plays every note.
 */
function linkShare(world: World, target: Entity, opts: DamageOpts): DamageOpts | null {
  const link = world.internal.link;
  if (!link || link.until <= world.time) return null;
  const weaver = link.weaver && !world.field.finale?.silence;
  const ids = weaver ? [link.a, link.b, world.weaverId] : [link.a, link.b];
  if (!ids.includes(target.id)) return null;
  // Who takes a share: the target, and the other members standing who can be hurt (untouchable
  // or held at 1 life, they can't, as for Oathkeeper). A Link cast alone has its hero once.
  const members = [...new Set(ids)]
    .map((id) => world.entities.get(id))
    .filter(isActive)
    .filter((m) => m === target || (m.health.invulnerable <= 0 && !rising(m) && !m.hero?.hold));
  if (!members.includes(target as Entity & { health: Health })) return null;
  const lighter = variantValue(world, 'aegis_link', 'pct') / 100;
  const share = (opts.amount * (1 - lighter)) / members.length;
  // Bonds and the Summary: what the link takes off a hit, and what you take for a hero, is your
  // support of them (credited in dealDamage with the life it kept).
  let spared = opts.amount * lighter;
  for (const m of members) {
    if (m === target) continue;
    const r = dealDamage(world, m, { ...opts, amount: share, oath: true });
    if (m.weaver) spared += r.dealt + r.absorbed;
  }
  return { ...opts, amount: share, oath: true, linked: spared };
}

/** Arcane Ward (Bonds): struck up close, Vexis blinks away from the blow, once in a while. */
function arcaneWard(world: World, vexis: Entity, enemy: Entity): void {
  const hero = vexis.hero!;
  if (world.time < hero.talentReadyAt) return;
  const reach = vexis.radius + enemy.radius + 2;
  if (distSq(vexis.x, vexis.z, enemy.x, enemy.z) > reach * reach) return;
  const metres = talentValue(world, 'arcane_ward', 'metres');
  // Away from it: toward the Weaver, she'd bring it to you.
  const dx = vexis.x - enemy.x;
  const dz = vexis.z - enemy.z;
  const d = Math.sqrt(dx * dx + dz * dz);
  if (d < 1e-6) return;
  const fromX = vexis.x;
  const fromZ = vexis.z;
  let x = vexis.x + (dx / d) * metres;
  let z = vexis.z + (dz / d) * metres;
  const edge = world.arenaRadius - 1;
  const r = Math.sqrt(x * x + z * z);
  if (r > edge) {
    x = (x / r) * edge;
    z = (z / r) * edge;
  }
  vexis.x = x;
  vexis.z = z;
  vexis.vx = 0;
  vexis.vz = 0;
  hero.dodge = null;
  hero.talentReadyAt = world.time + talentValue(world, 'arcane_ward', 'seconds');
  talentFired(world, vexis, 'arcane_ward', fromX, fromZ, enemy.id);
}

/**
 * Radiance (the Luminary): a hero standing in the Weaver's field hits harder for every aura
 * they hear, three times so during Sunrise. 0 without the Luminary.
 */
export function radianceOf(world: World, hero: Entity): number {
  const per = world.mods.radiancePerAura;
  const h = hero.hero;
  if (per <= 0 || !h?.inField || h.auraMask === 0) return 0;
  let count = 0;
  for (let mask = h.auraMask; mask !== 0; mask &= mask - 1) count++;
  return per * count * (world.field.crescendo ? world.mods.sunriseRadianceMult : 1);
}

/** Eclipse (the Luminary): during Sunrise, enemies in the Weaver's field take more. */
function eclipseOn(world: World, target: Entity): number {
  return world.field.crescendo && target.enemy?.inField ? world.mods.eclipseVulnerability : 0;
}

/**
 * Martyr's Veil: once per fight, the Weaver takes the hit that would have downed a hero. The
 * hero's life is kept — a Save — and the blow lands on the Weaver instead, leaving them at 1
 * life at worst: a martyr, not a casualty.
 */
function martyr(world: World, hero: Entity, amount: number, opts: DamageOpts): boolean {
  const weaver = world.entities.get(world.weaverId);
  if (!isActive(weaver) || !weaver.weaver) return false;
  world.relics.veil = false;
  // Like Fermata's guard, credit only the life the hero kept, not the overkill.
  world.ledger.shielded += Math.min(amount, hero.health!.hp);
  hero.hero!.supportReceived += Math.min(amount, hero.health!.hp);
  relicFired(world, 'martyrs_veil', hero.id);
  recordSave(world, hero, 'martyr', amount, opts.sourceName);
  const spare = Math.max(0, weaver.health.hp + totalShield(weaver.health) - 1);
  dealDamage(world, weaver, {
    source: opts.source,
    sourceName: opts.sourceName,
    amount: Math.min(amount, spare),
    kind: opts.kind ?? 'hit',
  });
  return true;
}

/** Lantern of the Lost: when a hero goes down, the others are shielded. */
function lantern(world: World, downed: Entity): void {
  const pct = world.mods.lanternBarrierPct;
  if (pct <= 0) return;
  const reached: EntityId[] = [];
  for (const id of world.party) {
    const ally = world.entities.get(id);
    if (!ally || ally.id === downed.id || !isActive(ally)) continue;
    const amount = ally.health.maxHp * pct;
    // A hero's own overshield (an uncued Aegis Wall) is theirs to keep.
    const existing = shieldOf(ally.health, 'overshield');
    if (existing && (!existing.fromWeaver || existing.amount >= amount)) continue;
    addShield(world, ally, 'overshield', amount, world.mods.lanternDuration, true);
    reached.push(ally.id);
  }
  if (reached.length > 0) relicFired(world, 'lantern_of_the_lost', downed.id, reached);
}

function shieldOrder(kind: ShieldKind): number {
  switch (kind) {
    case 'dome':
      return 0;
    case 'ward':
      return 1;
    case 'overshield':
      return 2;
    case 'barrier':
      return 3;
    default:
      return 4;
  }
}

/** Fermata catches a lethal hit: the hero hangs on at 1 HP until the hold is released. */
export function startHold(
  world: World,
  e: Entity,
  duration: number,
  attack: string,
  damage: number,
  dot?: StatusId,
  answers?: readonly AnswerTag[],
): void {
  const hero = e.hero!;
  const until = world.time + duration;
  hero.fermataUsed = true;
  hero.hold = {
    until,
    attack,
    damage,
    savedBy: null,
    ...(dot ? { dot } : {}),
    ...(answers ? { answers: [...answers] } : {}),
  };
  e.health!.hp = Math.max(1, Math.min(e.health!.hp, 1));
  addStatus(world, e, 'held', duration, null);
  world.ledger.holds++;
  pushMarker(world, 'hold', hero.slot);
  world.events.push({ type: 'fermataHold', tick: world.tick, hero: e.id, until, attack, damage });
  setTimeScale(world, 0.6, 8, 'hold');
}

/**
 * A Fermata hold ends: healed by the Weaver during it, the hero lives and it's a Save;
 * otherwise the held hit lands after all — unless the fight is already over (`fightOver`),
 * in which case the hero simply lives.
 */
export function releaseHold(world: World, e: Entity, fightOver = false): void {
  const hero = e.hero;
  const hold = hero?.hold;
  if (!hero || !hold) return;
  hero.hold = null;
  removeStatus(world, e, 'held', 'expired');
  const h = e.health!;
  if (h.dead || h.downed) return;
  const healed = hold.savedBy !== null;
  world.events.push({
    type: 'fermataReleased',
    tick: world.tick,
    hero: e.id,
    saved: healed || fightOver,
  });
  if (healed) recordSave(world, e, 'fermata', hold.damage, hold.attack);
  // Martyr's Vow: a hold that runs out while it lasts doesn't fell them; the Vow keeps them.
  else if (world.field.vow) recordSave(world, e, 'vow', hold.damage, hold.attack);
  // Deathless (docs/phase-5b.md): inside its window the held blow can't fell him either.
  else if (!fightOver && !deathlessActive(world, e) && !unbreakable(world, e))
    downHero(world, e, hold.attack, hold.dot, hold.answers);
}

/**
 * Unbreakable (Bonds): once a fight, Kael stands through what would down him, at 1 life and
 * untouchable for a moment: a blow, or a Fermata hold you didn't heal him through.
 */
function unbreakable(world: World, e: Entity): boolean {
  const hero = e.hero;
  if (!hero || hero.unbreakableUsed || !hasTalent(e, 'unbreakable')) return false;
  hero.unbreakableUsed = true;
  const h = e.health!;
  h.invulnerable = Math.max(h.invulnerable, talentValue(world, 'unbreakable', 'seconds'));
  talentFired(world, e, 'unbreakable', e.x, e.z);
  return true;
}

const BLEED_OUT = 12;

export function bleedOutTime(): number {
  return BLEED_OUT;
}

/**
 * The answers a killing telegraph wanted, for the death recap (docs/phase-5a.md exit criterion
 * 4: Execution's Mend or Ward, a Blood Pact's Scatter). Movement II only: a Movement I death
 * record stays exactly as it was.
 */
function telegraphAnswers(
  world: World,
  t: Telegraph | null | undefined,
): readonly AnswerTag[] | undefined {
  if (!t || t.answers.length === 0) return undefined;
  const movement2 =
    world.config.movement !== undefined || t.executeBelow !== undefined || t.linkStatus === 'pact';
  return movement2 ? t.answers : undefined;
}

/**
 * Down a hero. `dot` is the damage-over-time status whose tick felled them; `hit` the answers
 * the killing telegraph wanted (Movement II), named when no DoT did it.
 */
function downHero(
  world: World,
  e: Entity,
  killer: string,
  dot?: StatusId,
  hit?: readonly AnswerTag[],
): void {
  const h = e.health!;
  const hero = e.hero!;
  // Brann's down (docs/phase-5b.md), read before the down clears his statuses: a refused Rally
  // still live, and what the Weaver's healing on him was worth.
  const blood = hero.blood
    ? {
        refusedRally: refusedRallyLive(world, e),
        healCut:
          world.mods.heroHealMult *
          healReceivedMult(world, e) *
          weaverHealCut(world.content, e, 'mend'),
        ...(world.field.sanctuary && !inSanctuary(world, e) ? { bloodmoon: true as const } : {}),
      }
    : undefined;
  hero.hold = null;
  if (hero.call) {
    hero.call = null;
    hero.callCooldown = world.content.calls.heroCooldown;
    world.events.push({ type: 'callEnded', tick: world.tick, hero: e.id, reason: 'cancelled' });
  }
  h.hp = 0;
  h.downed = true;
  h.bleedOut = BLEED_OUT * world.mods.bleedOutMult;
  h.revive = 0;
  h.shields.length = 0;
  h.statuses = h.statuses.filter((s) => s.id === 'shaken');
  hero.cast = null;
  hero.castName = null;
  hero.castProgress = 0;
  hero.dodge = null;
  if (hero.soloActive > 0) {
    hero.soloActive = 0;
    world.events.push({ type: 'soloEnded', tick: world.tick, hero: e.id });
  }
  hero.action = 'downed';
  e.vx = 0;
  e.vz = 0;
  world.ledger.downs++;
  const weaver = world.entities.get(world.weaverId)?.weaver;
  const ready: ('ward' | 'chime' | 'reel' | 'glide')[] = [];
  // Inside a Null rune (Movement III) her Ward, Chime and Reel are refused: none was ready.
  if (weaver && !weaverSilenced(world)) {
    // What she could have cast: the tree's costs and Life included, as `spend` would take them.
    const content = world.content;
    if (weaver.wardCharges > 0 && canPay(world, 'ward', content)) ready.push('ward');
    if (weaver.cooldowns.chime <= 0 && canPay(world, 'chime', content)) ready.push('chime');
    if (weaver.cooldowns.reel <= 0 && canPay(world, 'reel', content)) ready.push('reel');
  }
  // A damage-over-time or telegraph down (Movement II): the answer it wanted comes first.
  const wanted = dot ? DOT_ANSWERS[dot] : hit && hit.length > 0 ? hit : undefined;
  if (wanted) {
    const first = (t: string) => (wanted.includes(t as AnswerTag) ? 0 : 1);
    ready.sort((a, b) => first(a) - first(b));
  }
  world.ledger.deaths.push({
    time: world.time - world.encounter.startedAt,
    hero: e.id,
    heroDefId: hero.defId,
    killer,
    recap: hero.recentDamage
      .filter((d) => d.time >= world.time - 5)
      .map((d) => ({
        time: d.time - world.encounter.startedAt,
        amount: d.amount,
        source: d.source,
      })),
    readyTechniques: ready,
    // The answers the killing tick wanted, ready or not (docs/phase-5a.md: every down names it).
    ...(wanted ? { answers: [...wanted] } : {}),
    ...(blood ? { blood } : {}),
  });
  pushMarker(world, 'down', hero.slot);
  world.events.push({ type: 'allyDowned', tick: world.tick, hero: e.id });
  bark(world, e, 'downed', true);
  lantern(world, e);
  // A threaded hero stays threaded: Mend revives them.
}

function downWeaver(world: World, e: Entity): void {
  const h = e.health!;
  const w = e.weaver!;
  h.hp = 0;
  h.downed = true;
  h.shields.length = 0;
  w.reform = world.content.weaver.reformTime;
  // Martyr's Vow ends with her: there's no one left to take the wounds.
  if (world.field.vow) {
    world.field.vow = false;
    w.crescendo = 0;
    world.events.push({ type: 'crescendoEnd', tick: world.tick });
  }
  w.glide = 0;
  if (w.threadSlot !== null) {
    const hero = world.party[w.threadSlot];
    w.threadSlot = null;
    if (hero !== undefined)
      world.events.push({ type: 'threadSnapped', tick: world.tick, target: hero });
  }
  e.vx = 0;
  e.vz = 0;
  world.events.push({ type: 'weaverDowned', tick: world.tick, reform: w.reform });
}

/** Called when a downed hero's bleed-out runs out. */
export function heroOut(world: World, e: Entity): void {
  const h = e.health!;
  h.dead = true;
  h.downed = true;
  h.bleedOut = 0;
  h.revive = 0;
  e.hero!.action = 'downed';
  const w = world.entities.get(world.weaverId)?.weaver;
  if (w && w.threadSlot === e.hero!.slot) w.threadSlot = null;
  world.events.push({ type: 'allyOut', tick: world.tick, hero: e.id });
}

/** Revives a downed hero at a fraction of max HP. */
export function reviveHero(world: World, e: Entity, hpPct: number): void {
  const h = e.health!;
  if (!h.downed || h.dead) return;
  h.downed = false;
  h.hp = Math.max(1, Math.round(h.maxHp * hpPct));
  h.revive = 0;
  h.bleedOut = 0;
  h.invulnerable = Math.max(h.invulnerable, 1);
  e.hero!.action = 'idle';
  e.hero!.lowHpBarked = false;
  world.events.push({ type: 'revived', tick: world.tick, hero: e.id });
  pushMarker(world, 'revive', e.hero!.slot);
  bark(world, e, 'revived', true);
}

/**
 * Restless Dead (Dissonance, docs/phase-4d.md): an enemy struck down falls and rises once, at a
 * share of its life, standing up again as it first did (untouchable while it does: `rising`).
 * Its attacks in progress die with the fall. Not bosses or mini-bosses; true when it rose
 * instead of dying.
 */
function restlessRise(world: World, e: Entity): boolean {
  const pct = world.mods.restlessPct;
  const enemy = e.enemy;
  const h = e.health;
  if (pct <= 0 || !enemy || !h || enemy.risen) return false;
  if (enemy.tier === 'boss' || enemy.tier === 'miniboss') return false;
  if (world.encounter.status !== 'fighting') return false;
  enemy.risen = true;
  h.hp = Math.max(1, Math.round((h.maxHp * pct) / 100));
  h.statuses = [];
  enemy.cast = null;
  if (enemy.mimic) delete enemy.mimic;
  enemy.state = 'spawning';
  enemy.stateTime = 0;
  dropTelegraphs(world, e);
  world.events.push({
    type: 'enemyRose',
    tick: world.tick,
    enemy: e.id,
    defId: enemy.defId,
    x: e.x,
    z: e.z,
    hp: h.hp,
  });
  return true;
}

/**
 * A link telegraph `t` is over, detonated (`'detonated'`) or cancelled (`'expired'`: its caster
 * killed, interrupted or phase-shifted): a Blood Pact's status comes off both heroes, unless
 * another live Pact still binds the hero (two Pacts sharing one, whose second must still land).
 * `pending` is the rest of a tick's due batch, already out of `world.telegraphs`. Movement I's
 * Resound keeps its rules exactly (a detonation strips it, a cancel leaves it to its clock): its
 * event stream stays byte-identical.
 */
export function releaseLink(
  world: World,
  t: Telegraph,
  reason: 'detonated' | 'expired',
  pending: readonly Telegraph[] = [],
): void {
  if (t.shape.kind !== 'link') return;
  // Movement III's Stitch (docs/phase-5c.md Q8) comes off both heroes either way, as Resound does
  // when it detonates.
  const status: StatusId = t.linkStatus ?? 'resound';
  const pact = status === 'pact';
  if (status === 'resound' && reason === 'expired') return;
  for (const id of [t.shape.a, t.shape.b]) {
    const e = world.entities.get(id);
    if (!e || !hasStatus(e, status)) continue;
    if (!pact) {
      removeStatus(world, e, status, reason);
      continue;
    }
    const binds = (o: Telegraph) =>
      o !== t &&
      o.shape.kind === 'link' &&
      o.linkStatus === 'pact' &&
      (o.shape.a === id || o.shape.b === id);
    if (world.telegraphs.some(binds) || pending.some(binds)) continue;
    removeStatus(world, e, status, reason);
  }
}

/** An enemy's attacks in progress end with it (a boss's last toll still rings if in flight). */
function dropTelegraphs(world: World, e: Entity): void {
  for (let i = world.telegraphs.length - 1; i >= 0; i--) {
    const t = world.telegraphs[i]!;
    if (t.owner === e.id && t.attackId !== 'volatile_burst') {
      world.telegraphs.splice(i, 1);
      forgetReel(world, t.id);
      releaseLink(world, t, 'expired');
      world.events.push({
        type: 'telegraphResolved',
        tick: world.tick,
        telegraph: t.id,
        target: null,
        outcome: 'cancelled',
        damage: 0,
      });
      world.events.push({ type: 'telegraphEnded', tick: world.tick, telegraph: t.id });
    }
  }
}

export function killEnemy(world: World, e: Entity, killer: Entity | null): void {
  const h = e.health!;
  const enemy = e.enemy!;
  if (h.dead) return;
  h.dead = true;
  h.hp = 0;
  enemy.state = 'dying';
  dropTelegraphs(world, e);
  world.events.push({
    type: 'enemyKilled',
    tick: world.tick,
    enemy: e.id,
    defId: enemy.defId,
    killer: killer?.id ?? null,
    x: e.x,
    z: e.z,
  });
  if (killer?.hero && world.entities.get(world.weaverId)?.weaver) {
    const w = world.entities.get(world.weaverId)!.weaver!;
    if (w.threadMode === 'empower' && w.threadSlot === killer.hero.slot) {
      gainResonance(world, world.content.resonance.gains.empoweredKill, 'empowered kill');
    }
  }
  if (world.focusTarget === e.id) world.focusTarget = null;
  onEnemyDeath(world, e);
  world.entities.despawn(e.id);
  world.events.push({ type: 'entityDespawned', tick: world.tick, id: e.id, kind: 'enemy' });
}

/**
 * Bear (the Martyr): the share of `hero`'s wounds the Weaver takes right now — the threaded hero
 * at Bear's share (less as the Thread pulls taut), every other hero in a field at Shared
 * Wounds'. 0 when not Bearing, or the Weaver is down.
 */
export function bearShareOf(world: World, hero: Entity): { share: number; via: 'bear' | 'shared' } {
  const weaver = world.entities.get(world.weaverId);
  const w = weaver?.weaver;
  if (!w || w.threadMode !== 'bear' || w.threadSlot === null || weaver!.health!.downed)
    return { share: 0, via: 'bear' };
  if (world.party[w.threadSlot] === hero.id) {
    const potency = 1 - w.threadTension * (1 - world.content.thread.tautPotency);
    return { share: world.mods.bearShare * potency, via: 'bear' };
  }
  return { share: hero.hero?.inField ? world.mods.sharedWounds : 0, via: 'shared' };
}

/**
 * What Bear can still send the Weaver without downing her: her life above 1 and her shields,
 * before Scarred Hide softens it.
 */
function bearRoom(world: World): number {
  const weaver = world.entities.get(world.weaverId);
  const h = weaver?.health;
  // Untouchable, she can't take anything on.
  if (!h || h.downed || h.invulnerable > 0) return 0;
  let shields = 0;
  for (const s of h.shields) shields += s.amount;
  return (
    Math.max(0, h.hp - 1 + shields) /
    Math.max(1e-6, world.mods.bearDamageTaken * world.mods.borneTaken)
  );
}

/**
 * Life a hero would have lost (`lifted`) goes to the Weaver, through her own shields and Scarred
 * Hide. Bear's and Shared Wounds' reach her softened by the Martyr's toll; the Vow's arrive
 * already softened by its own.
 */
function sendToWeaver(
  world: World,
  hero: Entity,
  lifted: number,
  via: 'bear' | 'shared' | 'vow',
  opts: DamageOpts,
): void {
  const weaver = world.entities.get(world.weaverId);
  if (!weaver?.health || lifted <= 0) return;
  const amount = via === 'vow' ? lifted : lifted * world.mods.borneTaken;
  const r = dealDamage(world, weaver, {
    source: opts.source,
    sourceName: opts.sourceName,
    amount,
    telegraph: null,
    kind: opts.kind,
    // Hers to bear: Oathkeeper doesn't send it back to Kael.
    oath: true,
  });
  // What she really took (her shields included), not what was sent.
  const taken = r.dealt + r.absorbed;
  if (taken <= 0) return;
  world.events.push({ type: 'borne', tick: world.tick, hero: hero.id, amount: taken, via });
  world.ledger.calling.borne += taken;
  // Penitence: the damage she bears fills Resonance.
  if (world.mods.penitencePer100 > 0)
    gainResonance(world, (lifted / 100) * world.mods.penitencePer100, 'penitence');
}

/**
 * Undying Devotion (the Martyr): once a fight, the hit that would have downed the Weaver leaves
 * her at 1 life, untouchable for a moment, and Mends every hero.
 */
function undying(world: World, weaver: Entity): void {
  weaver.weaver!.undying = false;
  weaver.health!.invulnerable = Math.max(
    weaver.health!.invulnerable,
    world.mods.undyingInvulnerable,
  );
  for (const id of world.party) {
    const hero = world.entities.get(id);
    if (isActive(hero)) heal(world, hero, hero.health.maxHp * world.mods.undyingMendPct, 'mend');
  }
  world.events.push({ type: 'undying', tick: world.tick });
}

/** Hook installed by the enemy system (volatile bursts) to avoid an import cycle. */
let onEnemyDeath: (world: World, e: Entity) => void = () => {};
export function setOnEnemyDeath(fn: (world: World, e: Entity) => void): void {
  onEnemyDeath = fn;
}

/** Interrupts an enemy's interruptible cast. Returns true if something was interrupted. */
export function interruptEnemy(world: World, e: Entity, by: EntityId | null): boolean {
  const enemy = e.enemy;
  if (!enemy?.cast || !enemy.cast.interruptible) return false;
  const cast = enemy.cast;
  enemy.cast = null;
  // A Mimic's copy (Movement III) goes with its cast.
  if (enemy.mimic) delete enemy.mimic;
  enemy.state = 'recover';
  enemy.stateTime = 0;
  if (cast.telegraph !== null) {
    const index = world.telegraphs.findIndex((t) => t.id === cast.telegraph);
    if (index >= 0) {
      const [t] = world.telegraphs.splice(index, 1);
      forgetReel(world, cast.telegraph);
      // A Blood Pact cut off mid-cast takes its ×1.2 with it (Movement II only).
      releaseLink(world, t!, 'expired');
      // A mark goes with its cast, as a Paradox takes it (the Doubt Wraith's Doubt: no Movement
      // I or II mark is interruptible).
      if (t!.shape.kind === 'mark') clearMark(world, t!.shape.target, t!.attackId);
      world.events.push({
        type: 'telegraphResolved',
        tick: world.tick,
        telegraph: cast.telegraph,
        target: null,
        outcome: 'cancelled',
        damage: 0,
      });
      world.events.push({ type: 'telegraphEnded', tick: world.tick, telegraph: cast.telegraph });
    }
  }
  world.events.push({
    type: 'castInterrupted',
    tick: world.tick,
    enemy: e.id,
    by,
    name: cast.name,
  });
  return true;
}

/**
 * Takes an interrupted mark's status off its target (`markStatusOf`, combat/telegraphs.ts),
 * unless another mark still in flight on that hero puts the same status on it.
 */
function clearMark(world: World, target: EntityId, attackId: string): void {
  const status = markOf(world, attackId);
  const e = world.entities.get(target);
  if (status === null || !e?.health || !hasStatus(e, status)) return;
  for (const t of world.telegraphs)
    if (
      t.shape.kind === 'mark' &&
      t.shape.target === target &&
      markOf(world, t.attackId) === status
    )
      return;
  removeStatus(world, e, status, 'expired');
}

function markOf(world: World, attackId: string): StatusId | null {
  return markStatusOf(world.content.attacks.find((a) => a.id === attackId));
}

/** Drops Reel-dodge and Paradox bookkeeping for a telegraph that was removed. */
function forgetReel(world: World, telegraph: number): void {
  const internal = world.internal;
  if (internal.reelDodges.length > 0)
    internal.reelDodges = internal.reelDodges.filter((r) => r.telegraph !== telegraph);
  if (internal.spared.length > 0)
    internal.spared = internal.spared.filter((r) => r.telegraph !== telegraph);
}

export function slotHero(world: World, slot: PartySlot | number): Entity | undefined {
  const id = world.party[slot];
  return id === undefined ? undefined : world.entities.get(id);
}

export { setTimeScale };
