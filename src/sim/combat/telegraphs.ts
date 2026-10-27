/**
 * Telegraphs (docs/plan/04 §5.3): every big enemy attack is announced with a shape, a fill
 * from `start` to `impact`, a severity and answer tags. Resolution is where the Weaver's
 * answers pay off: Perfect Wards, warded hits, Reel dodges and counterfactual saves.
 */
import type { AttackDef } from '../../content/schema';
import type { TelegraphShape } from '../events';
import type {
  DeepReadonly,
  Entity,
  EntityId,
  EntityStoreView,
  ReadonlyEntity,
  SaveCause,
  Shield,
  Telegraph,
  WorldState,
} from '../state';
import type { World } from '../world';
import { SIM_DT } from '../constants';
import { distSq, len } from '../core/dmath';
import { recordSave } from './saves';
import {
  addStatus,
  dealDamage,
  getStatus,
  hasStatus,
  heal,
  isActive,
  ownShield,
  removeShield,
  removeStatus,
  shieldOf,
  totalShield,
} from './health';
import { bark, pushMarker, relicFired, setTimeScale } from './feedback';
import { gainResonance } from './resonance';

export interface TelegraphSpec {
  owner: Entity;
  attack: AttackDef;
  target: Entity | null;
  shape: TelegraphShape;
  windup: number;
  /** Flat damage per entity hit (already scaled by elite / enrage multipliers). */
  damage: number;
  /** Fraction of the victim's max HP (alternative to `damage`). */
  pctMaxHp: number;
  /** Scales the Perfect window (Lullaby widens it along with the wind-up). */
  perfectWindowMult?: number;
}

export function startTelegraph(world: World, spec: TelegraphSpec): Telegraph {
  const t: Telegraph = {
    id: world.internal.nextTelegraphId++,
    owner: spec.owner.id,
    target: spec.target?.id ?? null,
    attackId: spec.attack.id,
    name: spec.attack.name,
    kind: spec.attack.kind,
    shape: spec.shape,
    start: world.time,
    impact: world.time + spec.windup,
    perfectFrom: world.time + spec.windup - perfectWindow(world) * (spec.perfectWindowMult ?? 1),
    damage: spec.damage,
    pctMaxHp: spec.pctMaxHp,
    effect: spec.attack.effect,
    answers: [...spec.attack.answers],
    severity: 'normal',
  };
  world.telegraphs.push(t);
  world.events.push({
    type: 'telegraphStarted',
    tick: world.tick,
    telegraph: t.id,
    owner: t.owner,
    target: t.target,
    name: t.name,
    kind: t.kind,
    shape: t.shape,
    start: t.start,
    impact: t.impact,
    perfectFrom: t.perfectFrom,
    damage: t.damage,
    pctMaxHp: t.pctMaxHp,
    answers: t.answers,
    effect: t.effect,
  });
  if (spec.attack.effect === 'damage') countAimed(world, t);
  return t;
}

/** Ledger: one aimed threat per hero it would hit when it starts. */
export function countAimed(world: World, t: Telegraph): void {
  for (const id of world.party) {
    const e = world.entities.get(id);
    if (isActive(e) && contains(world, t, e)) world.ledger.telegraphsAimed++;
  }
}

/** The Perfect Ward window in sim seconds: base + motifs + assists. */
export function perfectWindow(world: World): number {
  return (
    world.content.techniques.ward.perfectWindow +
    world.mods.perfectWindowBonus +
    world.config.assists.perfectWindowBonus
  );
}

/** Damage this telegraph would deal to `e` (before shields). */
export function telegraphDamage(t: DeepReadonly<Telegraph>, e: ReadonlyEntity): number {
  if (!e.health) return 0;
  return t.damage + t.pctMaxHp * e.health.maxHp;
}

/** Would the telegraph hit `e` if it resolved now? (Also used by bots, on read-only state.) */
export function contains(
  world: { entities: EntityStoreView },
  t: DeepReadonly<Telegraph>,
  e: ReadonlyEntity,
): boolean {
  const s = t.shape;
  switch (s.kind) {
    case 'circle':
      return distSq(e.x, e.z, s.x, s.z) <= sq(s.r + e.radius);
    case 'donut': {
      const d = len(e.x - s.x, e.z - s.z);
      return d > s.innerR && d <= s.outerR + e.radius;
    }
    case 'cone': {
      const dx = e.x - s.x;
      const dz = e.z - s.z;
      const d = len(dx, dz);
      if (d > s.r + e.radius) return false;
      if (d <= e.radius + 0.5) return true;
      return (dx * s.dirX + dz * s.dirZ) / d >= s.halfAngleCos;
    }
    case 'line': {
      const lx = s.toX - s.x;
      const lz = s.toZ - s.z;
      const l2 = lx * lx + lz * lz;
      let u = l2 > 0 ? ((e.x - s.x) * lx + (e.z - s.z) * lz) / l2 : 0;
      u = u < 0 ? 0 : u > 1 ? 1 : u;
      const px = s.x + lx * u;
      const pz = s.z + lz * u;
      return distSq(e.x, e.z, px, pz) <= sq(s.width / 2 + e.radius);
    }
    case 'mark':
      return e.id === s.target;
    case 'link': {
      if (e.id !== s.a && e.id !== s.b) return false;
      const a = world.entities.get(s.a);
      const b = world.entities.get(s.b);
      if (!standing(a) || !standing(b)) return false;
      // A Chime that cleanses Resound from either hero breaks the link.
      if (!hasResound(a) || !hasResound(b)) return false;
      return distSq(a.x, a.z, b.x, b.z) < sq(s.r);
    }
    case 'raid':
      return !!e.hero;
    default:
      return false;
  }
}

const sq = (v: number) => v * v;

function hasResound(e: ReadonlyEntity): boolean {
  return e.health!.statuses.some((x) => x.id === 'resound');
}

function standing(e: ReadonlyEntity | undefined): e is ReadonlyEntity {
  return !!e?.health && !e.health.dead && !e.health.downed;
}

/** The entities a telegraph can hit: heroes, and the Weaver for ground shapes. */
function candidates(world: World, t: Telegraph, out: Entity[]): Entity[] {
  out.length = 0;
  for (const id of world.party) {
    const e = world.entities.get(id);
    if (isActive(e)) out.push(e);
  }
  const ground =
    t.shape.kind === 'circle' ||
    t.shape.kind === 'cone' ||
    t.shape.kind === 'line' ||
    t.shape.kind === 'donut';
  if (ground) {
    const w = world.entities.get(world.weaverId);
    if (isActive(w)) out.push(w);
  }
  return out;
}

const scratch: Entity[] = [];

/**
 * Martyr's Vow will still be holding the heroes at 1 life when a hit due at `impact` lands.
 * The Vow's clock runs before telegraphs resolve and a hit lands on the first tick at or
 * after its impact, so a hit in the Vow's last tick doesn't count. (The Vow also ends if the
 * Weaver goes down, which nothing can foresee.)
 */
export function vowHoldsAt(state: WorldState, impact: number): boolean {
  if (!state.field.vow) return false;
  const left = state.entities.get(state.weaverId)?.weaver?.crescendo ?? 0;
  return impact + SIM_DT < state.time + left;
}

/** Forecast stripes and live severity, every tick. */
export function updateIncoming(world: World): void {
  for (const id of world.party) {
    const e = world.entities.get(id);
    if (e?.health) e.health.incoming = 0;
  }
  const weaver = world.entities.get(world.weaverId);
  if (weaver?.health) weaver.health.incoming = 0;
  for (const t of world.telegraphs) {
    let lethal = false;
    // No hero falls to a hit that lands while Martyr's Vow holds them.
    const vowed = vowHoldsAt(world, t.impact);
    for (const e of candidates(world, t, scratch)) {
      if (!contains(world, t, e) || spared(world, t.id, e.id)) continue;
      const dmg = telegraphDamage(t, e);
      const h = e.health!;
      h.incoming += dmg;
      if (dmg >= h.hp + totalShield(h) && !(vowed && e.hero)) lethal = true;
    }
    t.severity = lethal ? 'lethal' : 'normal';
  }
}

/** Resolves every telegraph whose impact time has come. */
export function resolveTelegraphs(world: World): void {
  if (world.telegraphs.length === 0) return;
  const due: Telegraph[] = [];
  for (let i = 0; i < world.telegraphs.length;) {
    const t = world.telegraphs[i]!;
    if (t.impact <= world.time + 1e-9) {
      due.push(t);
      world.telegraphs.splice(i, 1);
    } else i++;
  }
  for (const t of due) resolve(world, t);
}

function resolve(world: World, t: Telegraph): void {
  const attack = world.content.attacks.find((a) => a.id === t.attackId);
  const effect = attack?.effect ?? 'damage';
  const owner = world.entities.get(t.owner);
  if (effect === 'damage') {
    let hitAnyone = false;
    const victims = candidates(world, t, []);
    for (const e of victims) {
      // Paradox: a Rewind took them out of its reach.
      if (spared(world, t.id, e.id)) {
        hitAnyone = true;
        answered(world);
        emitResolved(world, t, e.id, 'dodged', 0);
        continue;
      }
      const reeled = world.internal.reelDodges.some((r) => r.telegraph === t.id && r.hero === e.id);
      const inside = contains(world, t, e);
      // A Reel counts whether the hero is already out of the shape or still mid-flight
      // (protected by the pull) when it lands: the last-moment Reel is the best one.
      if (reeled && (!inside || e.health!.invulnerable > 0)) {
        hitAnyone = true;
        reelDodged(world, t, e);
        continue;
      }
      if (!inside) continue;
      hitAnyone = true;
      if (t.shape.kind === 'mark' && !hasStatus(e, 'dirge')) {
        // Chimed away in time.
        answered(world);
        emitResolved(world, t, e.id, 'cancelled', 0);
        continue;
      }
      hitEntity(world, t, e, attack ?? null, owner ?? null);
    }
    if (!hitAnyone) emitResolved(world, t, null, 'dodged', 0);
    if (t.shape.kind === 'link') {
      for (const id of [t.shape.a, t.shape.b]) {
        const e = world.entities.get(id);
        if (e && hasStatus(e, 'resound')) removeStatus(world, e, 'resound', 'detonated');
      }
    }
  }
  forgetTelegraph(world, t.id);
  // The caster's script follows up: heals, summons, suppression, chained tolls.
  if (owner?.enemy && onCastComplete) onCastComplete(world, owner, t);
  world.events.push({ type: 'telegraphEnded', tick: world.tick, telegraph: t.id });
}

/** Drops bookkeeping for a telegraph that resolved or was removed. */
export function forgetTelegraph(world: World, id: number): void {
  if (world.internal.reelDodges.length > 0)
    world.internal.reelDodges = world.internal.reelDodges.filter((r) => r.telegraph !== id);
  if (world.internal.spared.length > 0)
    world.internal.spared = world.internal.spared.filter((r) => r.telegraph !== id);
}

/** Paradox (the Chronomancer) spared `hero` from this telegraph. */
function spared(world: World, telegraph: number, hero: number): boolean {
  const list = world.internal.spared;
  return list.length > 0 && list.some((r) => r.telegraph === telegraph && r.hero === hero);
}

function hitEntity(
  world: World,
  t: Telegraph,
  e: Entity,
  attack: AttackDef | null,
  owner: Entity | null,
): void {
  const h = e.health!;
  const damage = telegraphDamage(t, e);
  if (h.invulnerable > 0) {
    emitResolved(world, t, e.id, 'dodged', 0);
    return;
  }
  const wouldDie = damage >= h.hp + ownShield(h);

  // Perfect Ward: a Ward cast inside the window before impact negates the hit outright.
  // The Cracked Metronome makes an early one Perfect too, every so often.
  const ward = e.hero ? shieldOf(h, 'ward') : undefined;
  const inWindow =
    !!ward && ward.appliedAt >= t.perfectFrom - 1e-9 && ward.appliedAt <= t.impact + 1e-9;
  if (ward && (inWindow || metronome(world, e))) {
    perfect(world, t, e, ward, damage, owner, wouldDie);
    if (t.shape.kind === 'mark') removeStatus(world, e, 'dirge', 'detonated');
    return;
  }

  const result = dealDamage(world, e, {
    source: t.owner,
    sourceName: t.name,
    amount: damage,
    telegraph: t,
    kind: t.shape.kind === 'mark' ? 'detonation' : 'hit',
  });
  if (t.shape.kind === 'mark') removeStatus(world, e, 'dirge', 'detonated');

  let outcome: 'hit' | 'warded' | 'absorbed' = 'hit';
  if (result.dealt <= 0 && result.absorbed > 0)
    outcome = result.absorbedByWard > 0 ? 'warded' : 'absorbed';
  if (result.absorbedByWeaver > 0) answered(world);
  if (e.hero && result.absorbedByWard > 0) {
    gainResonance(world, world.content.resonance.gains.wardAbsorb, 'ward absorb');
  }
  emitResolved(world, t, e.id, outcome, result.dealt);

  // Martyr's Veil, Bear or the Vow already logged their own Save for this hit.
  if (e.hero && wouldDie && !result.downed && !result.saved && result.absorbedByWeaver > 0) {
    const cause: SaveCause =
      result.absorbedByWard > 0 ? 'ward' : result.absorbedByDome > 0 ? 'dome' : 'other';
    if (cause !== 'other') recordSave(world, e, cause, damage, t.name);
  }
  if (attack?.status && result.dealt > 0 && !result.downed) {
    addStatus(world, e, attack.status.id, attack.status.duration, t.owner);
  }
}

function perfect(
  world: World,
  t: Telegraph,
  e: Entity,
  ward: Shield,
  damage: number,
  owner: Entity | null,
  wouldDie: boolean,
): void {
  const tech = world.content.techniques.ward;
  removeShield(world, e, 'ward', true);
  // Echo Ward (the Chronomancer): it comes back a moment later, weaker. An echo doesn't echo.
  if (world.mods.echoWardPct > 0 && !ward.echo && e.hero) {
    world.internal.echoWards.push({
      hero: e.id,
      at: world.time + world.mods.echoWardDelay,
      amount: ward.max * world.mods.echoWardPct,
    });
  }
  world.ledger.perfects++;
  world.ledger.negated += damage;
  answered(world);
  pushMarker(world, 'perfect', e.hero?.slot ?? null);
  const weaver = world.entities.get(world.weaverId);
  if (weaver?.weaver) {
    const w = weaver.weaver;
    const refund = tech.cost * world.mods.techCostMult * tech.perfectRefund;
    // Eldritch Conduit (the Astrolabe): what was paid in Life comes back as Life.
    if (world.mods.techniquesCostLife) w.selfHealAcc += heal(world, weaver, refund, 'self', false);
    else w.spirit = Math.min(w.maxSpirit - w.reservedSpirit, w.spirit + refund);
  }
  // Ringing Parry (the Astrolabe): a longer stagger.
  if (owner?.health && !owner.health.dead)
    addStatus(world, owner, 'stagger', tech.staggerTime * world.mods.staggerMult, world.weaverId);
  world.events.push({
    type: 'perfectWard',
    tick: world.tick,
    target: e.id,
    telegraph: t.id,
    negated: damage,
  });
  emitResolved(world, t, e.id, 'perfect', 0);
  gainResonance(
    world,
    world.content.resonance.gains.perfectWard + world.mods.perfectResonance,
    'perfect ward',
  );
  // Eternal Moment: a Ward cast during Stasis that turned out Perfect.
  if (ward.stasis && world.mods.stasisPerfectResonance > 0)
    gainResonance(world, world.mods.stasisPerfectResonance, 'eternal moment');
  setTimeScale(world, 0.2, 6, 'perfect');
  bark(world, e, 'perfect');
  if (world.mods.ripostePower > 0) riposte(world, e);
  perfectRelics(world, e);
  if (wouldDie) recordSave(world, e, 'ward', damage, t.name);
}

/** Cracked Metronome: spends its charge on an early Ward, if it's ready. */
function metronome(world: World, hero: Entity): boolean {
  const relics = world.relics;
  if (relics.metronomeAt === null || world.time < relics.metronomeAt) return false;
  relics.metronomeAt = world.time + world.mods.metronomeCooldown;
  relicFired(world, 'cracked_metronome', hero.id);
  return true;
}

/** Relics that answer a Perfect Ward: the Tuning Fork and the Glass Halo. */
function perfectRelics(world: World, hero: Entity): void {
  const charge = world.mods.perfectSoloCharge;
  const h = hero.hero;
  if (charge > 0 && h && h.soloActive <= 0 && h.solo < 100) {
    h.solo = Math.min(100, h.solo + charge);
    relicFired(world, 'tuning_fork', hero.id);
    if (h.solo >= 100) world.events.push({ type: 'soloReady', tick: world.tick, hero: hero.id });
  }
  const pct = world.mods.perfectHealPct;
  if (pct > 0) {
    const healed: EntityId[] = [];
    for (const id of world.party) {
      const ally = world.entities.get(id);
      if (!isActive(ally)) continue;
      heal(world, ally, ally.health.maxHp * pct, 'other');
      healed.push(ally.id);
    }
    relicFired(world, 'glass_halo', hero.id, healed);
  }
}

function riposte(world: World, hero: Entity): void {
  const power = world.mods.ripostePower;
  world.events.push({
    type: 'abilityUsed',
    tick: world.tick,
    source: world.weaverId,
    ability: 'riposteBloom',
    name: 'Riposte Bloom',
    x: hero.x,
    z: hero.z,
    radius: 4,
  });
  for (const enemy of world.entities.list()) {
    if (!enemy.enemy || !isActive(enemy)) continue;
    if (distSq(enemy.x, enemy.z, hero.x, hero.z) > sq(4 + enemy.radius)) continue;
    const r = dealDamage(world, enemy, {
      source: world.weaverId,
      sourceName: 'Riposte Bloom',
      amount: power,
    });
    world.ledger.amplified += r.dealt + r.absorbed;
  }
}

function reelDodged(world: World, t: Telegraph, e: Entity): void {
  answered(world);
  // The ledger counts heroes Reeled out of danger, not Reel casts.
  world.ledger.reels++;
  gainResonance(world, world.content.resonance.gains.reelDodge, 'reel dodge');
  emitResolved(world, t, e.id, 'dodged', 0);
  const h = e.health;
  if (h && telegraphDamage(t, e) >= h.hp + ownShield(h))
    recordSave(world, e, 'reel', telegraphDamage(t, e), t.name);
}

/** One more enemy attack aimed at the party was answered. */
export function answered(world: World): void {
  world.ledger.telegraphsAnswered++;
}

function emitResolved(
  world: World,
  t: Telegraph,
  target: EntityId | null,
  outcome: 'hit' | 'dodged' | 'warded' | 'perfect' | 'absorbed' | 'cancelled',
  damage: number,
): void {
  world.events.push({
    type: 'telegraphResolved',
    tick: world.tick,
    telegraph: t.id,
    target,
    outcome,
    damage,
  });
}

/** Removes a telegraph early (caster interrupted or killed). */
export function cancelTelegraph(world: World, id: number): void {
  const index = world.telegraphs.findIndex((t) => t.id === id);
  if (index < 0) return;
  world.telegraphs.splice(index, 1);
  forgetTelegraph(world, id);
  world.events.push({
    type: 'telegraphResolved',
    tick: world.tick,
    telegraph: id,
    target: null,
    outcome: 'cancelled',
    damage: 0,
  });
  world.events.push({ type: 'telegraphEnded', tick: world.tick, telegraph: id });
}

/** The dirge status remaining on `e` (for clutch Chimes), or Infinity. */
export function dirgeRemaining(e: Entity): number {
  return getStatus(e, 'dirge')?.remaining ?? Infinity;
}

/** Installed by the enemy system: completes non-damage casts (heals, summons, suppression). */
let onCastComplete: ((world: World, owner: Entity, t: Telegraph) => void) | null = null;
export function setOnCastComplete(fn: (world: World, owner: Entity, t: Telegraph) => void): void {
  onCastComplete = fn;
}

export { recordSave };
