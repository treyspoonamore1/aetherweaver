/**
 * The Weaver's techniques (docs/plan/03 §1): Ward, Chime, Reel, Glide, Cue and the
 * Crescendo. Every refusal emits `techniqueRejected` so the player gets feedback.
 */
import type { PartySlot, Vec2 } from '../commands';
import { clamp, distSq, len } from '../core/dmath';
import {
  addShield,
  addStatus,
  cleanseAilments,
  heal,
  isActive,
  ownShield,
  shieldOf,
  slotHero,
} from '../combat/health';
import { pushMarker, setTimeScale } from '../combat/feedback';
import { gainResonance, spendResonance } from '../combat/resonance';
import { contains, dirgeRemaining, recordSave, telegraphDamage } from '../combat/telegraphs';
import type { Entity, TechniqueKey } from '../state';
import type { World } from '../world';
import { weaverOf } from '../world';
import { answerCall } from './calls';
import { startSolo } from './solos';

type Rejectable = TechniqueKey | 'rewind' | 'thread' | 'cue' | 'crescendo' | 'plant';
type Reason =
  | 'cooldown'
  | 'spirit'
  | 'range'
  | 'target'
  | 'silenced'
  | 'down'
  | 'resonance'
  | 'not-ready'
  | 'locked'
  | 'life';

export function reject(world: World, technique: Rejectable, reason: Reason): void {
  world.events.push({ type: 'techniqueRejected', tick: world.tick, technique, reason });
}

export function weaverReady(world: World, technique: Rejectable): Entity | null {
  const e = weaverOf(world);
  if (e.health!.downed) {
    reject(world, technique, 'down');
    return null;
  }
  if (world.encounter.status === 'victory' || world.encounter.status === 'defeat') return null;
  return e;
}

export function spend(world: World, weaver: Entity, technique: Rejectable, cost: number): boolean {
  const w = weaver.weaver!;
  // The Astrolabe's Economy.
  cost *= world.mods.techCostMult;
  // Stasis (the Chronomancer): techniques cost less while it lasts.
  if (world.field.stasis) cost *= world.mods.stasisCostMult;
  // Eldritch Conduit: paid in Life, never down to nothing (`techniqueCost` agrees).
  if (world.mods.techniquesCostLife) {
    const h = weaver.health!;
    if (h.hp - cost < 1 - 1e-9) {
      reject(world, technique, 'life');
      return false;
    }
    h.hp -= cost;
    return true;
  }
  if (w.spirit + 1e-9 < cost) {
    reject(world, technique, 'spirit');
    return false;
  }
  w.spirit -= cost;
  return true;
}

/** A technique's cooldown, Quickened (the Chronomancer) and the Astrolabe's Tempo included. */
export function techCooldown(world: World, base: number): number {
  return base * world.mods.techCooldownMult;
}

/** The Ward's recharge, a charge at a time (Shieldwright takes seconds off it). */
export function wardCooldown(world: World): number {
  const def = world.content.techniques.ward;
  return techCooldown(world, Math.max(1, def.cooldown - world.mods.wardCooldownCut));
}

/** How long a Ward lasts (Lingering Aegis adds, Shatterproof Halo shortens). */
export function wardDuration(world: World): number {
  const def = world.content.techniques.ward;
  return (def.duration + world.mods.wardDurationBonus) * world.mods.wardDurationMult;
}

export function heroForSlot(
  world: World,
  weaver: Entity,
  slot: PartySlot | undefined,
): Entity | null {
  const s = slot ?? weaver.weaver!.threadSlot;
  if (s === null || s === undefined) return null;
  const hero = slotHero(world, s);
  return hero?.health && !hero.health.dead ? hero : null;
}

export function castWard(world: World, slot: PartySlot | undefined): void {
  const weaver = weaverReady(world, 'ward');
  if (!weaver) return;
  const w = weaver.weaver!;
  const def = world.content.techniques.ward;
  const hero = heroForSlot(world, weaver, slot);
  if (!hero || hero.health!.downed) return reject(world, 'ward', 'target');
  // Stasis: no cooldowns, so no charge is needed or used.
  const stasis = world.field.stasis;
  if (w.wardCharges <= 0 && !stasis) return reject(world, 'ward', 'cooldown');
  if (distSq(hero.x, hero.z, weaver.x, weaver.z) > def.range * def.range)
    return reject(world, 'ward', 'range');
  if (!spend(world, weaver, 'ward', def.cost)) return;
  if (!stasis) {
    w.wardCharges--;
    if (w.cooldowns.ward <= 0) {
      w.cooldowns.ward = wardCooldown(world);
      w.cooldownTotals.ward = w.cooldowns.ward;
    }
  }
  w.lastTechnique = 'ward';
  const strength = world.mods.wardBarrierMult * world.mods.aegisWardMult;
  const amount = (hero.health!.maxHp * def.barrierPct + def.barrierFlat) * strength;
  const ward = addShield(world, hero, 'ward', amount, wardDuration(world), true);
  // Eternal Moment: a Ward cast during Stasis that turns out Perfect gives Resonance.
  if (ward && stasis) ward.stasis = true;
  // Martyr's Aegis: each Ward shields the Weaver too, sized from her own Life.
  if (world.mods.aegisSelf) {
    const self = (weaver.health!.maxHp * def.barrierPct + def.barrierFlat) * strength;
    // Her own, not support: it isn't credited as shielding the party.
    addShield(world, weaver, 'ward', self, wardDuration(world), false);
  }
  world.events.push({
    type: 'techniqueCast',
    tick: world.tick,
    technique: 'ward',
    target: hero.id,
    x: hero.x,
    z: hero.z,
  });
  answerCall(world, hero, 'ward');
}

export function castChime(world: World, point: Vec2 | undefined): void {
  const weaver = weaverReady(world, 'chime');
  if (!weaver) return;
  const w = weaver.weaver!;
  const def = world.content.techniques.chime;
  const stasis = world.field.stasis;
  if (w.cooldowns.chime > 0 && !stasis) return reject(world, 'chime', 'cooldown');
  if (!spend(world, weaver, 'chime', def.cost)) return;
  if (!stasis) {
    const chimeCooldown = techCooldown(world, def.cooldown * world.mods.chimeCooldownMult);
    w.cooldowns.chime = chimeCooldown;
    w.cooldownTotals.chime = chimeCooldown;
  }
  w.lastTechnique = 'chime';
  // Lands at the point, pulled in to the Chime's range.
  let x = point?.x ?? w.aimX;
  let z = point?.z ?? w.aimZ;
  const dx = x - weaver.x;
  const dz = z - weaver.z;
  const d = len(dx, dz);
  if (d > def.range) {
    x = weaver.x + (dx / d) * def.range;
    z = weaver.z + (dz / d) * def.range;
  }
  const chime = {
    id: world.internal.nextChimeId++,
    fromX: weaver.x,
    fromZ: weaver.z,
    x,
    z,
    launchedAt: world.time,
    landsAt: world.time + def.flight,
    radius: def.radius * world.mods.chimeRadiusMult,
  };
  world.chimes.push(chime);
  world.events.push({
    type: 'techniqueCast',
    tick: world.tick,
    technique: 'chime',
    target: null,
    x,
    z,
  });
  world.events.push({
    type: 'chimeLaunched',
    tick: world.tick,
    chime: chime.id,
    fromX: chime.fromX,
    fromZ: chime.fromZ,
    x,
    z,
    landsAt: chime.landsAt,
  });
}

/** Chimes in flight land: cleanse, brief immunity and a small heal. */
export function updateChimes(world: World): void {
  if (world.chimes.length === 0) return;
  const def = world.content.techniques.chime;
  for (let i = 0; i < world.chimes.length;) {
    const chime = world.chimes[i]!;
    if (chime.landsAt > world.time + 1e-9) {
      i++;
      continue;
    }
    world.chimes.splice(i, 1);
    let cleansedCount = 0;
    let clutch = false;
    const r2 = chime.radius * chime.radius;
    for (const id of world.party) {
      const hero = world.entities.get(id);
      if (!isActive(hero)) continue;
      const reach = chime.radius + hero.radius;
      if (distSq(hero.x, hero.z, chime.x, chime.z) > reach * reach) continue;
      const dirge = dirgeRemaining(hero);
      const lethalDirge = dirge !== Infinity && dirgeWouldKill(world, hero);
      const removed = cleanseAilments(world, hero);
      addStatus(world, hero, 'immune', def.immunity, world.weaverId);
      // The Hollow Bell rings softer.
      heal(world, hero, hero.health.maxHp * def.healPct * world.mods.chimeHealMult, 'chime');
      answerCall(world, hero, 'chime');
      if (removed > 0) {
        cleansedCount++;
        const isClutch = dirge <= def.clutchWindow;
        clutch = clutch || isClutch;
        world.ledger.cleanses++;
        if (isClutch) world.ledger.clutchCleanses++;
        pushMarker(world, 'cleanse', hero.hero!.slot);
        world.events.push({
          type: 'cleansed',
          tick: world.tick,
          target: hero.id,
          removed,
          clutch: isClutch,
        });
        gainResonance(world, world.content.resonance.gains.cleanse, 'cleanse');
        if (isClutch)
          gainResonance(world, world.content.resonance.gains.clutchChime, 'clutch chime');
        if (lethalDirge) recordSave(world, hero, 'chime', dirgeDamage(world, hero), 'Dirge');
      }
    }
    const weaver = world.entities.get(world.weaverId);
    if (isActive(weaver) && distSq(weaver.x, weaver.z, chime.x, chime.z) <= r2) {
      heal(world, weaver, weaver.health.maxHp * def.healPct * world.mods.chimeHealMult, 'chime');
    }
    world.events.push({
      type: 'chimeLanded',
      tick: world.tick,
      chime: chime.id,
      x: chime.x,
      z: chime.z,
      radius: chime.radius,
      cleansed: cleansedCount,
      clutch,
    });
  }
}

function dirgeDamage(world: World, hero: Entity): number {
  for (const t of world.telegraphs) {
    if (t.shape.kind === 'mark' && t.shape.target === hero.id) return telegraphDamage(t, hero);
  }
  return 0;
}

function dirgeWouldKill(world: World, hero: Entity): boolean {
  const h = hero.health!;
  const damage = dirgeDamage(world, hero);
  return damage > 0 && damage >= h.hp + ownShield(h);
}

export function castReel(world: World, slot: PartySlot | undefined): void {
  const weaver = weaverReady(world, 'reel');
  if (!weaver) return;
  const w = weaver.weaver!;
  const def = world.content.techniques.reel;
  const hero = heroForSlot(world, weaver, slot);
  if (!hero || hero.hero!.reel) return reject(world, 'reel', 'target');
  if (w.cooldowns.reel > 0) return reject(world, 'reel', 'cooldown');
  if (distSq(hero.x, hero.z, weaver.x, weaver.z) > def.range * def.range)
    return reject(world, 'reel', 'range');
  if (!spend(world, weaver, 'reel', def.cost)) return;
  const cd = Math.max(1, techCooldown(world, def.cooldown - world.mods.reelCooldownCut));
  w.cooldowns.reel = cd;
  w.cooldownTotals.reel = cd;
  w.lastTechnique = 'reel';

  // Land just in front of the Weaver, toward the aim point.
  let ax = w.aimX - weaver.x;
  let az = w.aimZ - weaver.z;
  const am = len(ax, az);
  if (am < 0.1) {
    ax = w.headingX;
    az = w.headingZ;
  } else {
    ax /= am;
    az /= am;
  }
  const toX = weaver.x + ax * def.landing;
  const toZ = weaver.z + az * def.landing;
  // Remember the threats the hero is being pulled out of (Reel dodges and saves).
  for (const t of world.telegraphs) {
    if (contains(world, t, hero))
      world.internal.reelDodges.push({ telegraph: t.id, hero: hero.id });
  }
  const h = hero.hero!;
  h.reel = {
    fromX: hero.x,
    fromZ: hero.z,
    toX,
    toZ,
    start: world.time,
    end: world.time + def.flight,
  };
  h.cast = null;
  h.castName = null;
  h.castProgress = 0;
  h.dodge = null;
  h.action = 'reeled';
  hero.health!.invulnerable = Math.max(hero.health!.invulnerable, def.flight + 0.1);
  pushMarker(world, 'reel', h.slot);
  world.events.push({
    type: 'techniqueCast',
    tick: world.tick,
    technique: 'reel',
    target: hero.id,
    x: hero.x,
    z: hero.z,
  });
  world.events.push({
    type: 'reeled',
    tick: world.tick,
    target: hero.id,
    fromX: hero.x,
    fromZ: hero.z,
    toX,
    toZ,
  });
}

export function castGlide(world: World, x: number, z: number): void {
  const weaver = weaverReady(world, 'glide');
  if (!weaver) return;
  const w = weaver.weaver!;
  const def = world.content.techniques.glide;
  // Heavy Score's curse.
  if (world.mods.noGlide) return reject(world, 'glide', 'locked');
  const stasis = world.field.stasis;
  if (w.cooldowns.glide > 0 && !stasis) return reject(world, 'glide', 'cooldown');
  let dx = x;
  let dz = z;
  let m = len(dx, dz);
  if (m < 1e-3) {
    dx = w.moveX;
    dz = w.moveZ;
    m = len(dx, dz);
  }
  if (m < 1e-3) {
    dx = w.headingX;
    dz = w.headingZ;
    m = len(dx, dz);
  }
  w.glideX = dx / m;
  w.glideZ = dz / m;
  w.glide = def.duration;
  if (!stasis) {
    const glideCooldown = techCooldown(world, def.cooldown * world.mods.glideCooldownMult);
    w.cooldowns.glide = glideCooldown;
    w.cooldownTotals.glide = glideCooldown;
  }
  weaver.health!.invulnerable = Math.max(weaver.health!.invulnerable, def.iframes);
  temporalMastery(world, weaver);
  const r = world.arenaRadius - weaver.radius;
  let toX = weaver.x + w.glideX * def.distance;
  let toZ = weaver.z + w.glideZ * def.distance;
  const tm = len(toX, toZ);
  if (tm > r) {
    toX = (toX / tm) * r;
    toZ = (toZ / tm) * r;
  }
  world.events.push({
    type: 'techniqueCast',
    tick: world.tick,
    technique: 'glide',
    target: null,
    x: toX,
    z: toZ,
  });
  world.events.push({
    type: 'glided',
    tick: world.tick,
    fromX: weaver.x,
    fromZ: weaver.z,
    toX,
    toZ,
  });
}

export function cue(world: World, slot: PartySlot): void {
  const weaver = weaverReady(world, 'cue');
  if (!weaver) return;
  const hero = slotHero(world, slot);
  if (!isActive(hero) || !hero.hero) return reject(world, 'cue', 'target');
  const h = hero.hero;
  if (h.soloActive > 0 || h.solo < 100) return reject(world, 'cue', 'not-ready');
  if (weaver.weaver!.resonance + 1e-9 < world.content.resonance.cueCost)
    return reject(world, 'cue', 'resonance');
  spendResonance(world, world.content.resonance.cueCost, 'cue');
  world.ledger.cues++;
  pushMarker(world, 'cue', h.slot);
  world.events.push({ type: 'cued', tick: world.tick, hero: hero.id });
  startSolo(world, hero, true);
  chorusPulse(world, hero);
  if (world.mods.canon > 0) {
    for (const id of world.party) {
      const other = world.entities.get(id);
      if (other?.hero && other.id !== hero.id && isActive(other) && other.hero.soloActive <= 0) {
        const before = other.hero.solo;
        other.hero.solo = clamp(other.hero.solo + world.mods.canon, 0, 100);
        if (before < 100 && other.hero.solo >= 100)
          world.events.push({ type: 'soloReady', tick: world.tick, hero: other.id });
      }
    }
  }
}

export function crescendo(world: World): void {
  const weaver = weaverReady(world, 'crescendo');
  if (!weaver) return;
  const w = weaver.weaver!;
  const def = world.content.crescendo;
  if (w.crescendo > 0) return reject(world, 'crescendo', 'not-ready');
  if (w.resonance + 1e-9 < world.content.resonance.crescendoCost)
    return reject(world, 'crescendo', 'resonance');
  spendResonance(world, world.content.resonance.crescendoCost, 'crescendo');
  world.ledger.crescendos++;
  pushMarker(world, 'crescendo', null);
  // The Martyr's Vow and the Chronomancer's Stasis replace Sunrise (docs/phase-3d.md,
  // phase-3e.md): no aura surge and no heal. While the Vow lasts heroes can't drop below 1 life
  // (combat/health.ts); while Stasis lasts every enemy stands still (systems/stasis.ts).
  const vow = world.mods.vowDuration > 0;
  const stasis = world.mods.stasisDuration > 0;
  if (stasis) {
    w.crescendo = world.mods.stasisDuration + world.mods.encoreBonus;
    world.field.stasis = true;
  } else if (vow) {
    w.crescendo = world.mods.vowDuration + world.mods.encoreBonus;
    world.field.vow = true;
  } else {
    w.crescendo = def.duration + world.mods.encoreBonus;
    world.field.crescendo = true;
    for (const id of world.party) {
      const hero = world.entities.get(id);
      if (isActive(hero)) heal(world, hero, hero.health.maxHp * def.healPct, 'other');
    }
  }
  const calling = world.config.calling
    ? world.content.callings.find((c) => c.id === world.config.calling!.id)
    : undefined;
  world.events.push({
    type: 'crescendoStart',
    tick: world.tick,
    calling: ((vow || stasis) && calling?.crescendoName) || def.name,
    duration: w.crescendo,
  });
  setTimeScale(world, 0.5, 12, 'crescendo');
}

/**
 * Temporal Mastery (the Chronomancer): a Glide resets the cooldown of the last technique cast,
 * once every few seconds, if it has one to reset. Ward gets a charge back.
 */
function temporalMastery(world: World, weaver: Entity): void {
  const w = weaver.weaver!;
  const last = w.lastTechnique;
  if (world.mods.masteryCooldown <= 0 || last === null || world.time < w.masteryAt) return;
  if (last === 'ward') {
    if (w.wardCharges >= w.maxWardCharges) return;
    w.wardCharges++;
    if (w.wardCharges >= w.maxWardCharges) w.cooldowns.ward = 0;
  } else {
    if (w.cooldowns[last] <= 0) return;
    w.cooldowns[last] = 0;
  }
  w.masteryAt = world.time + world.mods.masteryCooldown;
  world.events.push({
    type: 'temporalMastery',
    tick: world.tick,
    technique: last === 'reel' && world.mods.rewindSeconds > 0 ? 'rewind' : last,
  });
}

/** Echo Ward (the Chronomancer): Perfect Wards come back, at part strength, when they're due. */
export function updateEchoWards(world: World): void {
  const due = world.internal.echoWards;
  if (due.length === 0) return;
  for (let i = 0; i < due.length;) {
    const echo = due[i]!;
    if (echo.at > world.time + 1e-9) {
      i++;
      continue;
    }
    due.splice(i, 1);
    const hero = world.entities.get(echo.hero);
    if (!isActive(hero)) continue;
    // Never over a stronger Ward cast since.
    const current = shieldOf(hero.health, 'ward');
    if (current && current.amount >= echo.amount) continue;
    const ward = addShield(world, hero, 'ward', echo.amount, wardDuration(world), true);
    if (!ward) continue;
    ward.echo = true;
    world.events.push({ type: 'echoWard', tick: world.tick, target: hero.id, amount: echo.amount });
  }
}

/**
 * With enough auras singing, every Cue also releases a chorus pulse (docs/plan/02 §4.7): a
 * heal and a barrier for every hero in a field, scaled by the number of active auras.
 */
function chorusPulse(world: World, cued: Entity): void {
  const def = world.content.chorus;
  const auras = world.field.suppressed ? 0 : world.field.auras.length;
  if (auras < def.minAuras) return;
  let reached = 0;
  for (const id of world.party) {
    const ally = world.entities.get(id);
    if (!isActive(ally) || !ally.hero || ally.hero.auraMask === 0) continue;
    reached++;
    // A Cue's active heal ('other': it can save a Fermata hold), credited to the auras.
    const healed = heal(world, ally, ally.health.maxHp * def.healPctPerAura * auras, 'other');
    world.ledger.auras.healing += healed;
    const amount = ally.health.maxHp * def.barrierPctPerAura * auras;
    const existing = shieldOf(ally.health, 'overshield');
    if (!existing || existing.amount < amount)
      addShield(world, ally, 'overshield', amount, def.barrierDuration, true, true);
  }
  world.events.push({ type: 'chorusPulse', tick: world.tick, hero: cued.id, auras, reached });
}
