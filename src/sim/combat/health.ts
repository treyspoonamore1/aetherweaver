/**
 * The damage / heal / shield / status pipeline (docs/plan/05 §4.6). Every change to HP goes
 * through here so the ledger, threat and events stay consistent.
 */
import { heroDef } from '../../content';
import type { PartySlot } from '../commands';
import type {
  Entity,
  EntityId,
  Health,
  Shield,
  ShieldKind,
  Status,
  StatusId,
  Telegraph,
} from '../state';
import type { World } from '../world';
import { hasAura, heroFx } from './auras';
import { addHealingThreat, addThreat } from './threat';
import { bark, pushMarker, relicFired, setTimeScale } from './feedback';
import { gainResonance } from './resonance';
import { recordSave } from './saves';

/** Shields with no natural expiry (aura barriers, discord) expire at this sim time. */
export const NEVER = 1e9;

/** How hard hits bite into a Discord barrier, with and without Empower. */
const DISCORD_EMPOWERED = 1.5;
const DISCORD_PLAIN = 0.2;

/** Ailments Chime cleanses and immunity blocks. */
const AILMENTS: ReadonlySet<StatusId> = new Set<StatusId>([
  'dirge',
  'resound',
  'silence',
  'stun',
  'sleep',
]);

export function isAilment(id: StatusId): boolean {
  return AILMENTS.has(id);
}

/** Alive and standing: can act, can be targeted. */
export function isActive(e: Entity | undefined): e is Entity & { health: Health } {
  return !!e?.health && !e.health.dead && !e.health.downed;
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

/** Can't act: stunned, staggered or asleep. */
export function isDisabled(e: Entity): boolean {
  return hasStatus(e, 'stun') || hasStatus(e, 'stagger') || hasStatus(e, 'sleep');
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
  h.shields.splice(index, 1);
  if (broken)
    world.events.push({ type: 'shieldBroken', tick: world.tick, target: target.id, shield: kind });
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
  if (!h || h.dead) return false;
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

export function removeStatus(
  world: World,
  target: Entity,
  id: StatusId,
  reason: 'expired' | 'cleansed' | 'detonated',
): boolean {
  const h = target.health;
  if (!h) return false;
  const index = h.statuses.findIndex((s) => s.id === id);
  if (index < 0) return false;
  h.statuses.splice(index, 1);
  world.events.push({
    type: 'statusRemoved',
    tick: world.tick,
    target: target.id,
    status: id,
    reason,
  });
  return true;
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
    });
    removed++;
  }
  return removed;
}

export type HealVia = 'mend' | 'chime' | 'aura' | 'revive' | 'solo' | 'other';

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
  const effective = Math.min(amount, h.maxHp - h.hp);
  const overheal = amount - effective;
  h.hp += effective;
  // Fermata: the Weaver's healing during a hold is what saves the hero (passive regen doesn't).
  const hold = target.hero?.hold;
  if (hold && hold.savedBy === null && effective > 0) {
    if (via === 'mend' || via === 'chime' || via === 'other')
      hold.savedBy = via === 'chime' ? 'chime' : via === 'mend' ? 'mend' : 'other';
  }
  if (via !== 'solo' && target.team === 'party') {
    world.ledger.healing += effective;
    world.ledger.overheal += overheal;
    if (via === 'aura') world.ledger.auras.healing += effective;
    else if (via === 'mend') world.ledger.thread.healing += effective;
    if (effective > 0) addHealingThreat(world, effective);
  }
  if (emit && (effective > 0 || overheal > 0)) {
    world.events.push({
      type: 'healApplied',
      tick: world.tick,
      target: target.id,
      source: via === 'solo' ? null : world.weaverId,
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
  /** This hit downed or killed the target. */
  downed: boolean;
  /** Martyr's Veil took this hit for the hero (a Save is already recorded). */
  martyred: boolean;
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
};

/** Deals damage through armour and shields, then handles downs, deaths, threat and the ledger. */
export function dealDamage(world: World, target: Entity, opts: DamageOpts): DamageResult {
  const h = target.health;
  if (!h || h.dead || h.downed || opts.amount <= 0) return NO_DAMAGE;
  if (h.invulnerable > 0) return NO_DAMAGE;
  if (
    target.enemy &&
    world.internal.boss.phaseShiftUntil > world.time &&
    (target.enemy.tier === 'boss' || target.enemy.tier === 'miniboss')
  ) {
    return NO_DAMAGE;
  }

  const source = opts.source === null ? undefined : world.entities.get(opts.source);
  let amount = opts.amount;
  // Relics on hero hits (Heavy Score, Warden's Key): the extra is the Weaver's share.
  let amplifiedIn = opts.amplified ?? 0;
  // The Calling's part of it (the Luminary's Radiance and Eclipse, docs/phase-3c.md).
  let callingIn = 0;
  if (source?.hero && target.enemy) {
    const mult =
      world.mods.partyDamageMult * (target.enemy.defId === 'mute' ? world.mods.muteDamageMult : 1);
    if (mult !== 1) {
      amplifiedIn += amount * (mult - 1);
      amount *= mult;
    }
    const radiant = radianceOf(world, source) + eclipseOn(world, target);
    if (radiant > 0) {
      callingIn = amount * radiant;
      amplifiedIn += callingIn;
      amount += callingIn;
    }
  }
  const amountIn = amount;
  // Armour only softens ordinary hits; telegraphed attacks are answered, not soaked.
  if (target.hero && !opts.telegraph) amount *= 1 - heroDef(target.hero.defId).armor;
  // Fermata: heroes low on life take less from everything.
  const fx = target.hero ? heroFx(world, target) : null;
  let guarded = 0;
  if (fx && fx.guardDr > 0 && h.hp < h.maxHp * fx.guardBelow) {
    const before = amount;
    amount *= 1 - fx.guardDr;
    guarded = before - amount;
  }
  // Haloed (the Luminary): heroes in your field take less.
  let haloed = 0;
  if (target.hero?.inField && world.mods.haloedReduction > 0) {
    haloed = amount * world.mods.haloedReduction;
    amount -= haloed;
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
      const take = Math.min(s.amount, amount);
      s.amount -= take;
      amount -= take;
      absorbed += take;
      if (s.fromWeaver) absorbedByWeaver += take;
      if (s.fromAura) absorbedByAura += take;
      if (s.kind === 'ward') absorbedByWard += take;
      if (s.kind === 'dome' && s.fromWeaver) absorbedByDome += take;
      if (s.amount <= 0.0001) removeShield(world, target, s.kind, true);
      else i++;
    }
  }

  let dealt = Math.min(h.hp, amount);
  let martyred = false;
  if (target.hero && dealt >= h.hp && dealt > 0) {
    // Fermata holds a lethal hit at 1 HP (once per encounter); a held hero can't drop below 1.
    if (!target.hero.hold && !target.hero.fermataUsed && fx && fx.holdTime > 0)
      startHold(world, target, fx.holdTime, opts.sourceName, amount);
    if (target.hero.hold) dealt = Math.max(0, h.hp - 1);
    else if (world.relics.veil && martyr(world, target, amount, opts)) {
      dealt = 0;
      martyred = true;
    }
  }
  h.hp -= dealt;
  h.lastHitAt = world.time;
  if (absorbedByWeaver > 0) world.ledger.shielded += absorbedByWeaver;
  if (absorbedByAura > 0) world.ledger.auras.shielded += absorbedByAura;
  // The guard is credited only with life the hero kept: none if the hit downs them anyway.
  if (guarded > 0) {
    const kept = Math.min(guarded, h.hp);
    world.ledger.shielded += kept;
    world.ledger.auras.shielded += kept;
  }
  if (haloed > 0) {
    const kept = Math.min(haloed, h.hp);
    world.ledger.shielded += kept;
    world.ledger.calling.shielded += kept;
  }

  const total = dealt + absorbed;
  const amplifiedShare = amplifiedIn > 0 && amountIn > 0 ? (amplifiedIn * total) / amountIn : 0;
  const auraShare = opts.aura && amountIn > 0 ? (opts.aura * total) / amountIn : 0;
  const empowerShare = opts.empower && amountIn > 0 ? (opts.empower * total) / amountIn : 0;
  const callingShare = callingIn > 0 && amountIn > 0 ? (callingIn * total) / amountIn : 0;
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
    radiance: callingShare,
    crit: opts.crit ?? false,
    telegraph: opts.telegraph?.id ?? null,
    hit: opts.kind ?? 'hit',
  });

  let downed = false;
  if (h.hp <= 0) {
    downed = true;
    if (target.hero) downHero(world, target, opts.sourceName);
    else if (target.weaver) downWeaver(world, target);
    else killEnemy(world, target, source ?? null);
  }
  return {
    dealt,
    absorbed,
    absorbedByWeaver,
    absorbedByWard,
    absorbedByDome,
    blocked: false,
    downed,
    martyred,
  };
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
): void {
  const hero = e.hero!;
  const until = world.time + duration;
  hero.fermataUsed = true;
  hero.hold = { until, attack, damage, savedBy: null };
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
  else if (!fightOver) downHero(world, e, hold.attack);
}

const BLEED_OUT = 12;

export function bleedOutTime(): number {
  return BLEED_OUT;
}

function downHero(world: World, e: Entity, killer: string): void {
  const h = e.health!;
  const hero = e.hero!;
  hero.hold = null;
  if (hero.call) {
    hero.call = null;
    hero.callCooldown = world.content.calls.heroCooldown;
    world.events.push({ type: 'callEnded', tick: world.tick, hero: e.id, reason: 'cancelled' });
  }
  h.hp = 0;
  h.downed = true;
  h.bleedOut = BLEED_OUT;
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
  if (weaver) {
    const tech = world.content.techniques;
    const free = weaver.spirit;
    if (weaver.wardCharges > 0 && free >= tech.ward.cost) ready.push('ward');
    if (weaver.cooldowns.chime <= 0 && free >= tech.chime.cost) ready.push('chime');
    if (weaver.cooldowns.reel <= 0 && free >= tech.reel.cost) ready.push('reel');
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

export function killEnemy(world: World, e: Entity, killer: Entity | null): void {
  const h = e.health!;
  const enemy = e.enemy!;
  if (h.dead) return;
  h.dead = true;
  h.hp = 0;
  enemy.state = 'dying';
  // Its pending attacks die with it (a boss's last toll still rings if already in flight).
  for (let i = world.telegraphs.length - 1; i >= 0; i--) {
    const t = world.telegraphs[i]!;
    if (t.owner === e.id && t.attackId !== 'volatile_burst') {
      world.telegraphs.splice(i, 1);
      forgetReel(world, t.id);
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
  enemy.state = 'recover';
  enemy.stateTime = 0;
  if (cast.telegraph !== null) {
    const index = world.telegraphs.findIndex((t) => t.id === cast.telegraph);
    if (index >= 0) {
      world.telegraphs.splice(index, 1);
      forgetReel(world, cast.telegraph);
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

/** Drops Reel-dodge bookkeeping for a telegraph that was removed. */
function forgetReel(world: World, telegraph: number): void {
  if (world.internal.reelDodges.length === 0) return;
  world.internal.reelDodges = world.internal.reelDodges.filter((r) => r.telegraph !== telegraph);
}

export function slotHero(world: World, slot: PartySlot | number): Entity | undefined {
  const id = world.party[slot];
  return id === undefined ? undefined : world.entities.get(id);
}

export { setTimeScale };
