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
  dealDamage,
  heal,
  isActive,
  ownShield,
  shieldOf,
  slotHero,
} from '../combat/health';
import { pushMarker, setTimeScale } from '../combat/feedback';
import { gainResonance, spendResonance } from '../combat/resonance';
import { contains, dirgeRemaining, recordSave, telegraphDamage } from '../combat/telegraphs';
import type { Entity, EntityId, TechniqueKey } from '../state';
import type { World } from '../world';
import { weaverOf } from '../world';
import { glideDistance, slotCooldown, slotCost, variantValue } from '../variants';
import { answerCall } from './calls';
import { placeStar, startSolo } from './solos';

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
  const variant = w.variants.ward;
  // Stasis: no cooldowns, so no charge is needed or used.
  const stasis = world.field.stasis;
  if (w.wardCharges <= 0 && !stasis) return reject(world, 'ward', 'cooldown');
  if (distSq(hero.x, hero.z, weaver.x, weaver.z) > def.range * def.range)
    return reject(world, 'ward', 'range');
  if (!spend(world, weaver, 'ward', slotCost(world, 'ward', def.cost))) return;
  if (!stasis) {
    w.wardCharges--;
    if (w.cooldowns.ward <= 0) {
      w.cooldowns.ward = wardCooldown(world);
      w.cooldownTotals.ward = w.cooldowns.ward;
    }
  }
  w.lastTechnique = 'ward';
  if (variant === 'chorale') return chorale(world, weaver, hero, stasis);
  // Aegis Link (docs/phase-4f.md): with no other hero standing, the hero alone is linked.
  if (variant === 'aegis_link')
    return aegisLink(world, hero, linkPartner(world, weaver, hero) ?? hero, stasis);
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
  if (!spend(world, weaver, 'chime', slotCost(world, 'chime', def.cost))) return;
  if (!stasis) {
    const base = slotCooldown(world, 'chime', def.cooldown);
    const chimeCooldown = techCooldown(world, base * world.mods.chimeCooldownMult);
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
    ...variantField(w.variants.chime),
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
  // Technique variants (docs/phase-4f.md): Purge sends what it cleanses out; Absolve heals more
  // and guards.
  const variant = weaverOf(world).weaver?.variants.chime ?? null;
  const healPct =
    variant === 'absolve' ? variantValue(world, 'absolve', 'heal') / 100 : def.healPct;
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
      const purged = variant === 'purge' ? ailmentsOf(world, hero) : [];
      const removed = cleanseAilments(world, hero);
      addStatus(world, hero, 'immune', def.immunity, world.weaverId);
      // The Hollow Bell rings softer.
      heal(world, hero, hero.health.maxHp * healPct * world.mods.chimeHealMult, 'chime');
      if (variant === 'absolve')
        addStatus(
          world,
          hero,
          'absolved',
          variantValue(world, 'absolve', 'seconds'),
          world.weaverId,
        );
      if (purged.length > 0) purge(world, hero, purged);
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
        if (lethalDirge) {
          recordSave(world, hero, 'chime', dirgeDamage(world, hero), 'Dirge');
          // Bonds (docs/phase-4e.md): the life the cleanse kept.
          if (hero.hero) hero.hero.supportReceived += hero.health!.hp;
        }
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
  if (!spend(world, weaver, 'reel', slotCost(world, 'reel', def.cost))) return;
  const base = slotCooldown(world, 'reel', def.cooldown);
  const cd = Math.max(1, techCooldown(world, base - world.mods.reelCooldownCut));
  w.cooldowns.reel = cd;
  w.cooldownTotals.reel = cd;
  w.lastTechnique = 'reel';
  if (w.variants.reel === 'swap') return swap(world, weaver, hero);
  if (w.variants.reel === 'anchor') return anchor(world, hero);

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
  // Skate (docs/phase-4f.md) dashes on charges, each back after its cooldown.
  const skate = w.variants.glide === 'skate';
  if (skate ? w.glideCharges <= 0 && !stasis : w.cooldowns.glide > 0 && !stasis)
    return reject(world, 'glide', 'cooldown');
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
  const glideCooldown = techCooldown(
    world,
    slotCooldown(world, 'glide', def.cooldown) * world.mods.glideCooldownMult,
  );
  if (!stasis) {
    if (skate) w.glideCharges--;
    // Skate's charges come back one at a time: start the clock only if it isn't running.
    if (!skate || w.cooldowns.glide <= 0) {
      w.cooldowns.glide = glideCooldown;
      w.cooldownTotals.glide = glideCooldown;
    }
  }
  if (w.variants.glide === 'phase_step') return phaseStep(world, weaver);
  w.glide = def.duration;
  weaver.health!.invulnerable = Math.max(weaver.health!.invulnerable, def.iframes);
  temporalMastery(world, weaver);
  const r = world.arenaRadius - weaver.radius;
  const distance = glideDistance(world);
  let toX = weaver.x + w.glideX * distance;
  let toZ = weaver.z + w.glideZ * distance;
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
    ...variantField(w.variants.glide),
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

// ── Technique variants (docs/phase-4f.md) ────────────────────────────────────────────────

/** The `variant` a cast event carries: present only when one was cast. */
function variantField(id: string | null): { variant?: string } {
  return id === null ? {} : { variant: id };
}

/**
 * Chorale (a Ward variant): barriers on every hero near the one you Ward. They're Wards, so the
 * Ward's modifiers shape them; the one on the hero you Ward is Perfect as a Ward is, the others
 * only absorb (combat/telegraphs.ts).
 */
function chorale(world: World, weaver: Entity, hero: Entity, stasis: boolean): void {
  const radius = variantValue(world, 'chorale', 'radius');
  const pct = variantValue(world, 'chorale', 'pct') / 100;
  const flat = variantValue(world, 'chorale', 'flat');
  const strength = world.mods.wardBarrierMult * world.mods.aegisWardMult;
  const duration =
    (variantValue(world, 'chorale', 'seconds') + world.mods.wardDurationBonus) *
    world.mods.wardDurationMult;
  const targets: EntityId[] = [];
  for (const id of world.party) {
    const ally = world.entities.get(id);
    if (!isActive(ally)) continue;
    const reach = radius + ally.radius;
    if (distSq(ally.x, ally.z, hero.x, hero.z) > reach * reach) continue;
    const amount = (ally.health.maxHp * pct + flat) * strength;
    const ward = addShield(world, ally, 'ward', amount, duration, true);
    if (!ward) continue;
    ward.chorale = true;
    if (ally.id !== hero.id) ward.plain = true;
    if (stasis) ward.stasis = true;
    targets.push(ally.id);
  }
  // Martyr's Aegis: the burst shields the Weaver too, sized from her own Life.
  if (world.mods.aegisSelf)
    addShield(
      world,
      weaver,
      'ward',
      (weaver.health!.maxHp * pct + flat) * strength,
      duration,
      false,
    );
  world.events.push({
    type: 'techniqueCast',
    tick: world.tick,
    technique: 'ward',
    target: hero.id,
    x: hero.x,
    z: hero.z,
    variant: 'chorale',
  });
  world.events.push({ type: 'chorale', tick: world.tick, x: hero.x, z: hero.z, radius, targets });
  for (const id of targets) answerCall(world, world.entities.get(id)!, 'ward');
}

/** Aegis Link's second hero: the one you Thread, or the hero nearest the first. */
function linkPartner(world: World, weaver: Entity, hero: Entity): Entity | null {
  const threaded = heroForSlot(world, weaver, undefined) ?? undefined;
  if (isActive(threaded) && threaded.id !== hero.id) return threaded;
  let best: Entity | null = null;
  let bestD = Infinity;
  for (const id of world.party) {
    const ally = world.entities.get(id);
    if (!isActive(ally) || ally.id === hero.id) continue;
    const d = distSq(ally.x, ally.z, hero.x, hero.z);
    if (d < bestD) {
      bestD = d;
      best = ally;
    }
  }
  return best;
}

/**
 * Aegis Link (a Ward variant): two heroes share what hits them (combat/health.ts). `partner` is
 * `hero` again when no other hero is standing: then what hits them is only lighter.
 */
function aegisLink(world: World, hero: Entity, partner: Entity, stasis: boolean): void {
  const until = world.time + variantValue(world, 'aegis_link', 'seconds');
  world.internal.link = { a: hero.id, b: partner.id, weaver: false, appliedAt: world.time, until };
  // Eternal Moment: a Link cast during Stasis that turns out Perfect gives Resonance.
  if (stasis) world.internal.link.stasis = true;
  world.events.push({
    type: 'techniqueCast',
    tick: world.tick,
    technique: 'ward',
    target: hero.id,
    x: hero.x,
    z: hero.z,
    variant: 'aegis_link',
  });
  world.events.push({
    type: 'linked',
    tick: world.tick,
    a: hero.id,
    b: partner.id,
    weaver: false,
    until,
  });
  answerCall(world, hero, 'ward');
  if (partner !== hero) answerCall(world, partner, 'ward');
}

/** A Link ends when its time is up. */
export function updateLink(world: World): void {
  const link = world.internal.link;
  if (link && link.until <= world.time + 1e-9) world.internal.link = null;
}

interface Ailment {
  id: 'dirge' | 'silence' | 'stun' | 'sleep';
  remaining: number;
  /** A Dirge's damage, had it run out. */
  damage: number;
}

/** The ailments Purge can send out, read before the Chime cleanses them. */
function ailmentsOf(world: World, hero: Entity): Ailment[] {
  const out: Ailment[] = [];
  for (const s of hero.health!.statuses) {
    if (s.id === 'dirge')
      out.push({ id: 'dirge', remaining: s.remaining, damage: dirgeDamage(world, hero) });
    else if (s.id === 'silence' || s.id === 'stun' || s.id === 'sleep')
      out.push({ id: s.id, remaining: s.remaining, damage: 0 });
  }
  return out;
}

/** Purge (a Chime variant): what was cleansed bursts out at the enemies near the hero. */
function purge(world: World, hero: Entity, ailments: Ailment[]): void {
  const radius = variantValue(world, 'purge', 'radius');
  const share = variantValue(world, 'purge', 'pct') / 100;
  const hold = variantValue(world, 'purge', 'share') / 100;
  const hit: EntityId[] = [];
  for (const e of world.entities.list()) {
    if (!e.enemy || !isActive(e)) continue;
    const reach = radius + e.radius;
    if (distSq(e.x, e.z, hero.x, hero.z) > reach * reach) continue;
    for (const a of ailments) {
      if (a.id === 'dirge') {
        if (a.damage > 0) {
          // Yours, as a Riposte Bloom's is.
          const r = dealDamage(world, e, {
            source: world.weaverId,
            sourceName: 'Purge',
            amount: a.damage * share,
          });
          world.ledger.amplified += r.dealt + r.absorbed;
        }
      } else if (a.remaining > 0) addStatus(world, e, a.id, a.remaining * hold, world.weaverId);
    }
    hit.push(e.id);
  }
  world.events.push({
    type: 'purged',
    tick: world.tick,
    hero: hero.id,
    x: hero.x,
    z: hero.z,
    radius,
    hit,
  });
}

/**
 * Swap (a Reel variant): the Weaver and the threaded hero trade places, at once. She takes what
 * was coming for them behind a barrier sized from their life.
 */
function swap(world: World, weaver: Entity, hero: Entity): void {
  // The hero leaves the shapes they stood in: a dodge (and a save) as for a Reel.
  for (const t of world.telegraphs) {
    if (contains(world, t, hero))
      world.internal.reelDodges.push({ telegraph: t.id, hero: hero.id });
  }
  const fromX = hero.x;
  const fromZ = hero.z;
  hero.x = weaver.x;
  hero.z = weaver.z;
  weaver.x = fromX;
  weaver.z = fromZ;
  hero.vx = hero.vz = weaver.vx = weaver.vz = 0;
  weaver.weaver!.glide = 0;
  // Her barrier for what was coming, sized for the blow it was meant for: her own, not support
  // of the hero.
  const barrier = hero.health!.maxHp * (variantValue(world, 'swap', 'pct') / 100);
  addShield(world, weaver, 'ward', barrier, variantValue(world, 'swap', 'seconds'), false);
  const h = hero.hero!;
  h.cast = null;
  h.castName = null;
  h.castProgress = 0;
  h.dodge = null;
  pushMarker(world, 'reel', h.slot);
  world.events.push({
    type: 'techniqueCast',
    tick: world.tick,
    technique: 'reel',
    target: hero.id,
    x: fromX,
    z: fromZ,
    variant: 'swap',
  });
  world.events.push({
    type: 'swapped',
    tick: world.tick,
    hero: hero.id,
    fromX,
    fromZ,
    toX: hero.x,
    toZ: hero.z,
  });
}

/** Anchor (a Reel variant): the threaded hero takes less, and holds their ground. */
function anchor(world: World, hero: Entity): void {
  addStatus(world, hero, 'anchored', variantValue(world, 'anchor', 'seconds'), world.weaverId);
  pushMarker(world, 'reel', hero.hero!.slot);
  world.events.push({
    type: 'techniqueCast',
    tick: world.tick,
    technique: 'reel',
    target: hero.id,
    x: hero.x,
    z: hero.z,
    variant: 'anchor',
  });
}

/**
 * Phase Step (a Glide variant): a blink, and the enemies hunting the Weaver lose her for a
 * moment, turning on the hero nearest them.
 */
function phaseStep(world: World, weaver: Entity): void {
  const w = weaver.weaver!;
  const def = world.content.techniques.glide;
  const metres = variantValue(world, 'phase_step', 'metres');
  const seconds = variantValue(world, 'phase_step', 'seconds');
  const r = world.arenaRadius - weaver.radius;
  const fromX = weaver.x;
  const fromZ = weaver.z;
  let toX = weaver.x + w.glideX * metres;
  let toZ = weaver.z + w.glideZ * metres;
  const tm = len(toX, toZ);
  if (tm > r) {
    toX = (toX / tm) * r;
    toZ = (toZ / tm) * r;
  }
  weaver.x = toX;
  weaver.z = toZ;
  weaver.vx = weaver.vz = 0;
  w.glide = 0;
  weaver.health!.invulnerable = Math.max(weaver.health!.invulnerable, def.iframes);
  temporalMastery(world, weaver);
  const until = world.time + seconds;
  for (const e of world.entities.list()) {
    const c = e.enemy;
    if (!c || !isActive(e) || c.targetId !== weaver.id) continue;
    let best: Entity | null = null;
    let bestD = Infinity;
    for (const id of world.party) {
      const ally = world.entities.get(id);
      if (!isActive(ally)) continue;
      const d = distSq(ally.x, ally.z, e.x, e.z);
      if (d < bestD) {
        bestD = d;
        best = ally;
      }
    }
    if (!best) continue;
    c.tauntTarget = best.id;
    c.tauntUntil = Math.max(c.tauntUntil, until);
    c.targetId = best.id;
  }
  world.events.push({
    type: 'techniqueCast',
    tick: world.tick,
    technique: 'glide',
    target: null,
    x: toX,
    z: toZ,
    variant: 'phase_step',
  });
  world.events.push({ type: 'phaseStep', tick: world.tick, fromX, fromZ, toX, toZ, until });
}

export function cue(world: World, slot: PartySlot): void {
  const weaver = weaverReady(world, 'cue');
  if (!weaver) return;
  const hero = slotHero(world, slot);
  if (!isActive(hero) || !hero.hero) return reject(world, 'cue', 'target');
  const h = hero.hero;
  if (h.soloActive > 0 || h.solo < 100) return reject(world, 'cue', 'not-ready');
  // Silent Cues (Dissonance) raises it.
  const cost = world.content.resonance.cueCost + world.mods.cueCostBonus;
  if (weaver.weaver!.resonance + 1e-9 < cost) return reject(world, 'cue', 'resonance');
  spendResonance(world, cost, 'cue');
  world.ledger.cues++;
  pushMarker(world, 'cue', h.slot);
  world.events.push({ type: 'cued', tick: world.tick, hero: hero.id });
  startSolo(world, hero, true);
  // Constellation (Bonds): a Cue leaves a star where the hero stands.
  placeStar(world, hero);
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
