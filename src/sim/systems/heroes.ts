/**
 * Hero AI v1 (docs/plan/03 §5): competent but flawed. Heroes pick targets, keep their
 * range, use their two abilities, sometimes dodge — and their quirks get them into the kind
 * of trouble only the Weaver can get them out of.
 */
import { heroDef } from '../../content';
import type { HeroDef } from '../../content/schema';
import { TUNING } from '../constants';
import { distSq, len } from '../core/dmath';
import {
  addShield,
  addStatus,
  dealDamage,
  hasStatus,
  interruptEnemy,
  isActive,
  isDisabled,
  rising,
  shieldOf,
} from '../combat/health';
import { bark } from '../combat/feedback';
import { contains } from '../combat/telegraphs';
import { topThreat } from '../combat/threat';
import type { Entity, Telegraph } from '../state';
import { weaverOf, type World } from '../world';
import { heroFx } from '../combat/auras';
import { canCall, flourishing, settleCall, startCall, tendCall } from './calls';
import { formationSlot } from './formation';
import { flourishHit, heroAttackSpeed, heroDamage } from './heroDamage';
import { nearestEnemy, startSolo, tickSoloClock, updateSolo } from './solos';
import { approachVelocity, arrive } from './steering';
import { empowerBonus } from './thread';

const desired = { x: 0, z: 0 };
const slotPos = { x: 0, z: 0 };

/** Ranged heroes stay this close to the Weaver; the tank roams a little farther. */
const RANGED_LEASH = 7.5;
const TANK_LEASH = 11;
const GLORY_TIME = 5;

export function updateHeroes(world: World, dt: number): void {
  const weaver = weaverOf(world);
  const fighting = world.encounter.status === 'fighting';
  for (const id of world.party) {
    const e = world.entities.get(id);
    const hero = e?.hero;
    const h = e?.health;
    if (!e || !hero || !h) continue;
    const def = heroDef(hero.defId);

    // A Reel also drags a downed hero's body out of danger.
    if (hero.reel && !h.dead) {
      updateReel(world, e, dt);
      tickSoloClock(world, e, dt);
      continue;
    }
    if (h.dead || h.downed) {
      e.vx = 0;
      e.vz = 0;
      hero.action = 'downed';
      continue;
    }

    e.speed = def.moveSpeed * (1 + heroFx(world, e).moveSpeed);
    hero.attackCooldown = Math.max(0, hero.attackCooldown - dt * heroAttackSpeed(world, e));
    hero.abilityCooldowns[0] = Math.max(0, hero.abilityCooldowns[0] - dt);
    hero.abilityCooldowns[1] = Math.max(0, hero.abilityCooldowns[1] - dt);
    if (hero.quirk > 0) hero.quirk = Math.max(0, hero.quirk - dt);
    if (hero.callCooldown > 0) hero.callCooldown = Math.max(0, hero.callCooldown - dt);
    if (hero.call) tendCall(world, e, empowerBonus(world, e).more > 0);

    lowHpCheck(world, e);
    if (fighting) noticeTelegraphs(world, e, def);

    if (isDisabled(e)) {
      hero.cast = null;
      hero.castName = hero.soloActive > 0 ? hero.castName : null;
      tickSoloClock(world, e, dt);
      approachVelocity(e, 0, 0, TUNING.heroAccel, dt);
      hero.action = 'idle';
      continue;
    }

    if (!fighting) {
      hero.cast = null;
      hero.castName = null;
      hero.castProgress = 0;
      hero.targetId = null;
      formationMove(weaver, e, def, dt);
      continue;
    }

    // Solo charge (by fighting), and Solos that fire without a Cue.
    if (hero.soloActive <= 0 && hero.engaged && hero.solo < 100) {
      hero.solo = Math.min(
        100,
        hero.solo + (100 / def.solo.chargeTime) * world.mods.soloChargeMult * dt,
      );
      if (hero.solo >= 100) world.events.push({ type: 'soloReady', tick: world.tick, hero: e.id });
    }
    if (hero.soloActive <= 0 && hero.solo >= 100 && shouldFireUncued(world, e, def))
      startSolo(world, e, false);

    if (hero.soloActive > 0) {
      const rooted = updateSolo(world, e, dt);
      if (rooted) {
        hero.action = 'channeling';
        approachVelocity(e, 0, 0, TUNING.heroAccel * 2, dt);
        faceTarget(world, e);
        continue;
      }
    }

    // A cast in progress roots the hero until it completes.
    if (hero.cast) {
      if (hasStatus(e, 'silence')) {
        hero.cast = null;
        hero.castName = null;
      } else {
        const c = hero.cast;
        hero.castProgress = (world.time - c.start) / Math.max(0.01, c.end - c.start);
        if (world.time >= c.end - 1e-9) {
          hero.cast = null;
          hero.castName = null;
          hero.castProgress = 0;
          // Answered any time before it lands (even mid-cast), the move is a Flourish.
          const index = c.ability as 0 | 1;
          executeAbility(world, e, def, index, c.target, c.x, c.z, flourishing(e, index));
          settleCall(world, e, index);
        } else {
          hero.action = 'casting';
          approachVelocity(e, 0, 0, TUNING.heroAccel * 2, dt);
          faceTarget(world, e);
          continue;
        }
      }
    }

    const target = chooseTarget(world, weaver, e, def);
    hero.targetId = target?.id ?? null;
    if (target) hero.engaged = true;

    // A dodge in progress takes priority over everything but casts.
    if (hero.dodge && world.time >= hero.dodge.at) {
      if (world.time > hero.dodge.until) hero.dodge = null;
      else {
        hero.action = 'dodging';
        arrive(e, hero.dodge.x, hero.dodge.z, TUNING.heroAccel * 1.5, 0.8, dt);
        continue;
      }
    }

    // Their big move is almost ready: a good moment to ask the Weaver for help.
    if (target && canCall(world, e, def)) startCall(world, e, def);

    if (target && !hasStatus(e, 'silence') && tryAbilities(world, e, def, target)) {
      hero.action = 'casting';
      approachVelocity(e, 0, 0, TUNING.heroAccel * 2, dt);
      continue;
    }

    const inRange =
      target !== null &&
      distSq(e.x, e.z, target.x, target.z) <= sqr(def.attack.range + target.radius + e.radius);
    if (target && inRange && hero.attackCooldown <= 0) basicAttack(world, e, def, target);

    combatMove(world, weaver, e, def, target, dt);
    hero.action = inRange ? 'attacking' : len(e.vx, e.vz) > 0.3 ? 'moving' : 'idle';
    if (inRange && len(e.vx, e.vz) < 1) faceTarget(world, e);
  }
}

const sqr = (v: number) => v * v;

function faceTarget(world: World, e: Entity): void {
  const t = e.hero!.targetId === null ? undefined : world.entities.get(e.hero!.targetId);
  if (!t) return;
  const dx = t.x - e.x;
  const dz = t.z - e.z;
  const m = len(dx, dz);
  if (m > 0.05) {
    e.fx = dx / m;
    e.fz = dz / m;
  }
}

function lowHpCheck(world: World, e: Entity): void {
  const h = e.health!;
  const hero = e.hero!;
  if (!hero.lowHpBarked && h.hp < h.maxHp * 0.3) {
    hero.lowHpBarked = true;
    bark(world, e, 'lowHp');
  } else if (hero.lowHpBarked && h.hp > h.maxHp * 0.6) {
    hero.lowHpBarked = false;
  }
}

function shouldFireUncued(world: World, e: Entity, def: HeroDef): boolean {
  const h = e.health!;
  if (def.solo.id === 'aegisWall' && h.hp < h.maxHp * 0.3) return true; // Kael braces when desperate.
  if (!world.config.assists.autonomy) return false;
  if (def.solo.id === 'aegisWall') return h.hp < h.maxHp * 0.5 || h.incoming > h.hp * 0.5;
  return e.hero!.targetId !== null;
}

// ── Movement ──────────────────────────────────────────────────────────────────────────

function formationMove(weaver: Entity, e: Entity, def: HeroDef, dt: number): void {
  const hero = e.hero!;
  if (hero.follow === 'hold') {
    arrive(e, hero.holdX, hero.holdZ, TUNING.heroAccel, TUNING.heroArriveRadius, dt);
    hero.action = len(e.vx, e.vz) > 0.3 ? 'moving' : 'idle';
    return;
  }
  const spread = hero.follow === 'scatter' ? TUNING.scatterSpread : 1;
  formationSlot(weaver, def.formation, spread, slotPos);
  // Feed-forward formation keeping: match the Weaver's velocity, then close the gap.
  const ex = slotPos.x - e.x;
  const ez = slotPos.z - e.z;
  let dvx = weaver.vx + ex * TUNING.formationGain;
  let dvz = weaver.vz + ez * TUNING.formationGain;
  const m = len(dvx, dvz);
  if (m > e.speed) {
    dvx = (dvx / m) * e.speed;
    dvz = (dvz / m) * e.speed;
  }
  if (len(ex, ez) < 0.05 && len(weaver.vx, weaver.vz) < 0.05) {
    dvx = 0;
    dvz = 0;
  }
  approachVelocity(e, dvx, dvz, TUNING.heroAccel, dt);
  hero.action = len(e.vx, e.vz) > 0.3 ? 'moving' : 'idle';
}

function combatMove(
  world: World,
  weaver: Entity,
  e: Entity,
  def: HeroDef,
  target: Entity | null,
  dt: number,
): void {
  const hero = e.hero!;
  if (world.internal.rallyUntil > world.time || !target) {
    formationMove(weaver, e, def, dt);
    return;
  }
  const tank = def.role === 'tank';
  const glory = tank && hero.quirk > 0;
  const reach = def.attack.range + target.radius + e.radius - 0.35;
  if (hero.follow === 'hold') {
    desired.x = hero.holdX;
    desired.z = hero.holdZ;
    if (tank && distSq(target.x, target.z, hero.holdX, hero.holdZ) < sqr(4))
      chase(e, target, reach);
  } else if (tank) {
    chase(e, target, reach);
    if (!glory) leash(weaver, TANK_LEASH);
  } else {
    // Ranged: anchor on the formation slot, step toward the target only as far as needed.
    const spread = hero.follow === 'scatter' ? TUNING.scatterSpread : 1;
    formationSlot(weaver, def.formation, spread, slotPos);
    desired.x = slotPos.x;
    desired.z = slotPos.z;
    const d = len(target.x - desired.x, target.z - desired.z);
    const want = Math.min(def.preferredRange, def.attack.range - 0.5) + target.radius;
    if (d > want) {
      const k = (d - want) / d;
      desired.x += (target.x - desired.x) * k;
      desired.z += (target.z - desired.z) * k;
    } else if (d < want - 1.5 && d > 1e-6) {
      // Too close: back off to range (out of cleaves aimed at the tank).
      const k = (want - d) / d;
      desired.x -= (target.x - desired.x) * k;
      desired.z -= (target.z - desired.z) * k;
    }
    kite(world, e);
    leash(weaver, RANGED_LEASH);
  }
  arrive(e, desired.x, desired.z, TUNING.heroAccel, 1.2, dt);
}

function chase(e: Entity, target: Entity, reach: number): void {
  const dx = target.x - e.x;
  const dz = target.z - e.z;
  const d = len(dx, dz);
  if (d <= reach || d < 1e-6) {
    desired.x = e.x;
    desired.z = e.z;
    return;
  }
  desired.x = target.x - (dx / d) * reach;
  desired.z = target.z - (dz / d) * reach;
}

function leash(weaver: Entity, max: number): void {
  const dx = desired.x - weaver.x;
  const dz = desired.z - weaver.z;
  const d = len(dx, dz);
  if (d > max) {
    desired.x = weaver.x + (dx / d) * max;
    desired.z = weaver.z + (dz / d) * max;
  }
}

/** Step away from enemies in melee range of a ranged hero. */
function kite(world: World, e: Entity): void {
  let ax = 0;
  let az = 0;
  for (const m of world.entities.list()) {
    if (!m.enemy || !isActive(m) || m.enemy.targetId !== e.id) continue;
    const dx = e.x - m.x;
    const dz = e.z - m.z;
    const d = len(dx, dz);
    if (d < 3 + m.radius && d > 1e-6) {
      ax += dx / d;
      az += dz / d;
    }
  }
  const m = len(ax, az);
  if (m > 0) {
    desired.x = e.x + (ax / m) * 3;
    desired.z = e.z + (az / m) * 3;
  }
}

function updateReel(world: World, e: Entity, dt: number): void {
  const hero = e.hero!;
  const r = hero.reel!;
  const span = Math.max(0.01, r.end - r.start);
  const t = Math.min(1, (world.time - r.start) / span);
  // Ease-out pull; velocity is set so interpolation and physics agree.
  const k = 1 - (1 - t) * (1 - t);
  const nx = r.fromX + (r.toX - r.fromX) * k;
  const nz = r.fromZ + (r.toZ - r.fromZ) * k;
  e.vx = dt > 0 ? (nx - e.x) / dt : 0;
  e.vz = dt > 0 ? (nz - e.z) / dt : 0;
  const downed = e.health!.downed;
  hero.action = downed ? 'downed' : 'reeled';
  if (t >= 1) {
    hero.reel = null;
    e.vx = 0;
    e.vz = 0;
    hero.action = downed ? 'downed' : 'idle';
  }
}

// ── Targeting ─────────────────────────────────────────────────────────────────────────

function chooseTarget(world: World, weaver: Entity, e: Entity, def: HeroDef): Entity | null {
  const hero = e.hero!;
  if (world.internal.rallyUntil > world.time)
    return nearestEnemy(world, e, def.attack.range, hero.targetId);
  const focus = world.focusTarget === null ? undefined : world.entities.get(world.focusTarget);
  if (focus?.enemy && isActive(focus) && !rising(focus)) return focus;

  const found = hero.targetId === null ? undefined : world.entities.get(hero.targetId);
  // A target standing up again (Restless Dead) is left until it has.
  const current = found && rising(found) ? undefined : found;
  if (def.role === 'tank') {
    if (hero.quirk > 0 && current?.enemy && isActive(current)) return current;
    // Peel: whatever is hitting a squishy (or the Weaver) near the party.
    let best: Entity | null = null;
    let bestScore = Infinity;
    for (const m of world.entities.list()) {
      if (!m.enemy || !isActive(m) || m.enemy.state === 'spawning') continue;
      const dw = len(m.x - weaver.x, m.z - weaver.z);
      if (dw > 18) continue;
      const onSquishy = m.enemy.targetId !== null && m.enemy.targetId !== e.id;
      let score = dw - (onSquishy ? 4 : 0) - (current && m.id === current.id ? 2.5 : 0);
      if (m.enemy.tier === 'boss' || m.enemy.tier === 'miniboss') score -= 6;
      if (score < bestScore) {
        bestScore = score;
        best = m;
      }
    }
    return best;
  }
  const keepRange = def.attack.range + 3;
  if (
    current?.enemy &&
    isActive(current) &&
    distSq(current.x, current.z, e.x, e.z) <= sqr(keepRange)
  )
    return current;
  let best: Entity | null = null;
  let bestScore = Infinity;
  for (const m of world.entities.list()) {
    if (!m.enemy || !isActive(m) || m.enemy.state === 'spawning') continue;
    const d = len(m.x - e.x, m.z - e.z);
    if (d > 20) continue;
    const role = m.enemy.role;
    const priority = role === 'caster' || role === 'sniper' || role === 'support' ? 3 : 0;
    const score = d - priority;
    if (score < bestScore) {
      bestScore = score;
      best = m;
    }
  }
  return best;
}

// ── Attacks and abilities ─────────────────────────────────────────────────────────────

function basicAttack(world: World, e: Entity, def: HeroDef, target: Entity): void {
  const hero = e.hero!;
  hero.attackCooldown = def.attack.interval;
  const hit = heroDamage(world, e, def.attack.damage, 0, true);
  if (def.attack.projectileSpeed <= 0) {
    world.events.push({
      type: 'attackFired',
      tick: world.tick,
      source: e.id,
      target: target.id,
      visual: 'melee',
      fromX: e.x,
      fromZ: e.z,
      toX: target.x,
      toZ: target.z,
      travel: 0,
    });
    dealDamage(world, target, {
      source: e.id,
      sourceName: def.name,
      amount: hit.amount,
      amplified: hit.amplified,
      aura: hit.aura,
      empower: hit.empower,
      crit: hit.crit,
      empowered: hit.empowered,
    });
    return;
  }
  const d = len(target.x - e.x, target.z - e.z);
  const travel = d / def.attack.projectileSpeed;
  world.internal.pendingHits.push({
    at: world.time + travel,
    source: e.id,
    target: target.id,
    amount: hit.amount,
    amplified: hit.amplified,
    aura: hit.aura,
    empower: hit.empower,
    crit: hit.crit,
    splashRadius: 0,
    splash: 0,
    chain: def.attack.chain,
    empowered: hit.empowered,
    stun: 0,
  });
  world.events.push({
    type: 'attackFired',
    tick: world.tick,
    source: e.id,
    target: target.id,
    visual: def.attack.kind === 'arrow' ? 'arrow' : 'bolt',
    fromX: e.x,
    fromZ: e.z,
    toX: target.x,
    toZ: target.z,
    travel,
  });
}

function startCast(
  world: World,
  e: Entity,
  def: HeroDef,
  index: 0 | 1,
  target: Entity,
  x: number,
  z: number,
): void {
  const ability = def.abilities[index];
  const hero = e.hero!;
  hero.abilityCooldowns[index] = ability.cooldown;
  let castTime = ability.castTime;
  if (ability.id === 'starbolt') castTime *= world.mods.starboltCastMult;
  const flourish = flourishing(e, index);
  if (castTime <= 0) {
    executeAbility(world, e, def, index, target.id, x, z, flourish);
    settleCall(world, e, index);
    return;
  }
  hero.cast = {
    ability: index,
    name: ability.name,
    start: world.time,
    end: world.time + castTime,
    target: target.id,
    x,
    z,
    flourish,
  };
  hero.castName = flourish ? def.call.flourish.name : ability.name;
  hero.castProgress = 0;
  if (ability.id === 'starbolt' && world.rng.cosmetic.chance(0.25)) bark(world, e, 'quirk');
}

/** Starts ability `index`. Returns true if a cast (rather than an instant move) started. */
function beginAbility(
  world: World,
  e: Entity,
  def: HeroDef,
  index: 0 | 1,
  target: Entity,
  x: number,
  z: number,
): boolean {
  startCast(world, e, def, index, target, x, z);
  return e.hero!.cast !== null;
}

/** Decides whether to use an ability this tick. Returns true if a cast started. */
function tryAbilities(world: World, e: Entity, def: HeroDef, target: Entity): boolean {
  const hero = e.hero!;
  const cd = hero.abilityCooldowns;
  for (const index of [0, 1] as const) {
    if (cd[index] > 0) continue;
    const ability = def.abilities[index];
    const inReach = (t: Entity) =>
      distSq(t.x, t.z, e.x, e.z) <= sqr(ability.range + t.radius + e.radius);
    switch (ability.id) {
      case 'shieldBash':
        if (inReach(target)) return beginAbility(world, e, def, index, target, target.x, target.z);
        break;
      case 'challenge': {
        let loose = 0;
        for (const m of world.entities.list()) {
          if (!m.enemy || !isActive(m) || m.enemy.targetId === e.id) continue;
          if (distSq(m.x, m.z, e.x, e.z) <= sqr(ability.radius)) loose++;
        }
        if (loose >= 2) return beginAbility(world, e, def, index, target, e.x, e.z);
        break;
      }
      case 'piercingShot': {
        const caster = interruptibleCaster(world, e, ability.range);
        const t = caster ?? (inReach(target) ? target : null);
        if (t) return beginAbility(world, e, def, index, t, t.x, t.z);
        break;
      }
      case 'volley':
      case 'gravityWell': {
        const cluster = findCluster(world, e, ability.range, ability.radius, 3);
        if (cluster) return beginAbility(world, e, def, index, target, cluster.x, cluster.z);
        if (
          ability.id === 'volley' &&
          (target.enemy!.tier === 'boss' || target.enemy!.tier === 'miniboss') &&
          inReach(target)
        )
          return beginAbility(world, e, def, index, target, target.x, target.z);
        break;
      }
      case 'starbolt':
        if (inReach(target)) return beginAbility(world, e, def, index, target, target.x, target.z);
        break;
    }
  }
  return false;
}

function interruptibleCaster(world: World, e: Entity, range: number): Entity | null {
  for (const m of world.entities.list()) {
    if (!m.enemy?.cast?.interruptible || !isActive(m)) continue;
    if (distSq(m.x, m.z, e.x, e.z) <= sqr(range + m.radius)) return m;
  }
  return null;
}

const cluster = { x: 0, z: 0 };
function findCluster(
  world: World,
  from: Entity,
  range: number,
  radius: number,
  min: number,
): { x: number; z: number } | null {
  let best = 0;
  for (const a of world.entities.list()) {
    if (!a.enemy || !isActive(a)) continue;
    if (distSq(a.x, a.z, from.x, from.z) > sqr(range)) continue;
    let n = 0;
    let sx = 0;
    let sz = 0;
    for (const b of world.entities.list()) {
      if (!b.enemy || !isActive(b)) continue;
      if (distSq(a.x, a.z, b.x, b.z) <= sqr(radius)) {
        n++;
        sx += b.x;
        sz += b.z;
      }
    }
    if (n >= min && n > best) {
      best = n;
      cluster.x = sx / n;
      cluster.z = sz / n;
    }
  }
  return best > 0 ? cluster : null;
}

function executeAbility(
  world: World,
  e: Entity,
  def: HeroDef,
  index: 0 | 1,
  targetId: number | null,
  x: number,
  z: number,
  flourish = false,
): void {
  const ability = def.abilities[index];
  // An answered call: the Flourish's multipliers apply to whatever the ability does.
  const f = flourish ? def.call.flourish : null;
  const radiusMult = f?.radiusMult ?? 1;
  const target = targetId === null ? undefined : world.entities.get(targetId);
  const emit = (ax: number, az: number, radius: number) => {
    world.events.push({
      type: 'abilityUsed',
      tick: world.tick,
      source: e.id,
      ability: ability.id,
      name: f?.name ?? ability.name,
      x: ax,
      z: az,
      radius,
    });
    if (f)
      world.events.push({
        type: 'flourish',
        tick: world.tick,
        hero: e.id,
        name: f.name,
        x: ax,
        z: az,
        radius,
      });
  };
  const hitOf = (amount: number) =>
    f ? flourishHit(world, e, amount, f) : heroDamage(world, e, amount, 0);
  const hitEnemy = (m: Entity, amount: number) => {
    const hit = hitOf(amount);
    dealDamage(world, m, {
      source: e.id,
      sourceName: f?.name ?? ability.name,
      amount: hit.amount,
      amplified: hit.amplified,
      aura: hit.aura,
      empower: hit.empower,
      crit: hit.crit,
      empowered: hit.empowered,
    });
    if (f && f.stun > 0 && isActive(m)) addStatus(world, m, 'stun', f.stun, e.id);
  };
  switch (ability.id) {
    case 'shieldBash': {
      if (!isActive(target)) return;
      emit(target.x, target.z, 1);
      interruptEnemy(world, target, e.id);
      addStatus(world, target, 'stun', ability.stun, e.id);
      hitEnemy(target, ability.damage);
      return;
    }
    case 'challenge': {
      const radius = ability.radius * radiusMult;
      emit(e.x, e.z, radius);
      let caught = 0;
      for (const m of world.entities.list()) {
        if (!m.enemy || !isActive(m)) continue;
        if (distSq(m.x, m.z, e.x, e.z) > sqr(radius + m.radius)) continue;
        caught++;
        topThreat(m, e.hero!.slot, 150);
        if (m.enemy.tier === 'normal' || m.enemy.tier === 'elite') {
          m.enemy.tauntTarget = e.id;
          m.enemy.tauntUntil = world.time + 4 + (f?.tauntBonus ?? 0);
        }
      }
      // Bulwark: a barrier for every enemy the answered Challenge catches.
      if (f && f.barrierPerTarget > 0 && caught > 0) {
        const amount = e.health!.maxHp * Math.min(f.barrierCap, f.barrierPerTarget * caught);
        // One overshield per hero: never trade a bigger one (Aegis Wall…) for this.
        const existing = shieldOf(e.health!, 'overshield');
        if (!existing || existing.amount < amount)
          addShield(world, e, 'overshield', amount, 5, true);
      }
      return;
    }
    case 'piercingShot': {
      // A line from Lyra through the target point.
      let dx = x - e.x;
      let dz = z - e.z;
      const d = len(dx, dz);
      if (d < 1e-6) return;
      dx /= d;
      dz /= d;
      const toX = e.x + dx * ability.range;
      const toZ = e.z + dz * ability.range;
      const width = ability.radius * radiusMult;
      world.events.push({
        type: 'attackFired',
        tick: world.tick,
        source: e.id,
        target: targetId,
        visual: 'pierce',
        fromX: e.x,
        fromZ: e.z,
        toX,
        toZ,
        travel: 0.12,
      });
      emit(toX, toZ, width);
      for (const m of world.entities.list()) {
        if (!m.enemy || !isActive(m)) continue;
        const rx = m.x - e.x;
        const rz = m.z - e.z;
        const along = rx * dx + rz * dz;
        if (along < 0 || along > ability.range) continue;
        const perp = Math.abs(rx * dz - rz * dx);
        if (perp > width + m.radius) continue;
        interruptEnemy(world, m, e.id);
        hitEnemy(m, ability.damage);
      }
      // Heartseeker refunds part of the Solo.
      const hero = e.hero!;
      if (f && f.soloCharge > 0 && hero.soloActive <= 0 && hero.solo < 100) {
        hero.solo = Math.min(100, hero.solo + f.soloCharge);
        if (hero.solo >= 100)
          world.events.push({ type: 'soloReady', tick: world.tick, hero: e.id });
      }
      return;
    }
    case 'volley': {
      world.events.push({
        type: 'attackFired',
        tick: world.tick,
        source: e.id,
        target: null,
        visual: 'arrow',
        fromX: e.x,
        fromZ: e.z,
        toX: x,
        toZ: z,
        travel: 0.5,
      });
      const radius = ability.radius * radiusMult;
      const hit = hitOf(ability.damage);
      // Arrows fall half a second later on whoever is still there.
      const anchor = nearestAt(world, x, z, radius);
      if (!anchor) return;
      emit(x, z, radius);
      world.internal.pendingHits.push({
        at: world.time + 0.5,
        source: e.id,
        target: anchor.id,
        amount: hit.amount,
        amplified: hit.amplified,
        aura: hit.aura,
        empower: hit.empower,
        crit: hit.crit,
        splashRadius: radius,
        splash: 1,
        chain: 0,
        empowered: hit.empowered,
        stun: f?.stun ?? 0,
      });
      return;
    }
    case 'gravityWell': {
      const radius = ability.radius * radiusMult;
      emit(x, z, radius);
      for (const m of world.entities.list()) {
        if (!m.enemy || !isActive(m)) continue;
        const dx = x - m.x;
        const dz = z - m.z;
        const d = len(dx, dz);
        if (d > radius + m.radius) continue;
        if (m.enemy.tier === 'normal' || m.enemy.tier === 'elite') {
          const pull = Math.min(d * 0.7, 3);
          if (d > 1e-6) {
            m.x += (dx / d) * pull;
            m.z += (dz / d) * pull;
          }
        }
        hitEnemy(m, ability.damage);
      }
      return;
    }
    case 'starbolt': {
      const tx = isActive(target) ? target.x : x;
      const tz = isActive(target) ? target.z : z;
      const d = len(tx - e.x, tz - e.z);
      const travel = d / Math.max(1, def.attack.projectileSpeed);
      const radius = ability.radius * radiusMult;
      const anchor = isActive(target) ? target : nearestAt(world, tx, tz, radius);
      world.events.push({
        type: 'attackFired',
        tick: world.tick,
        source: e.id,
        target: anchor?.id ?? null,
        visual: 'starbolt',
        fromX: e.x,
        fromZ: e.z,
        toX: tx,
        toZ: tz,
        travel,
      });
      if (!anchor) return;
      if (f) emit(tx, tz, radius);
      const hit = hitOf(ability.damage);
      world.internal.pendingHits.push({
        at: world.time + travel,
        source: e.id,
        target: anchor.id,
        amount: hit.amount,
        amplified: hit.amplified,
        aura: hit.aura,
        empower: hit.empower,
        crit: hit.crit,
        splashRadius: radius,
        splash: 1,
        chain: 0,
        empowered: hit.empowered,
        stun: f?.stun ?? 0,
      });
      return;
    }
  }
}

function nearestAt(world: World, x: number, z: number, radius: number): Entity | null {
  let best: Entity | null = null;
  let bestD = sqr(radius + 1.5);
  for (const m of world.entities.list()) {
    if (!m.enemy || !isActive(m)) continue;
    const d = distSq(m.x, m.z, x, z);
    if (d < bestD) {
      best = m;
      bestD = d;
    }
  }
  return best;
}

// ── Dodging (and the quirks that stop it) ─────────────────────────────────────────────

function noticeTelegraphs(world: World, e: Entity, def: HeroDef): void {
  const hero = e.hero!;
  for (const t of world.telegraphs) {
    if (t.id <= hero.lastTelegraphSeen) continue;
    hero.lastTelegraphSeen = t.id;
    if (t.kind === 'mark' || t.kind === 'raid' || def.dodge <= 0) continue;
    if (!contains(world, t, e)) continue;
    if (!world.rng.ai.chance(def.dodge)) continue;
    const escape = escapePoint(world, t, e);
    if (!escape) continue;
    const reaction = 0.3 + world.rng.ai.float() * 0.45;
    hero.dodge = {
      telegraph: t.id,
      x: escape.x,
      z: escape.z,
      at: world.time + reaction,
      until: t.impact + 0.15,
    };
  }
  // Quirks: Lyra won't abandon a shot for danger under a second away; Vexis commits to Starbolt.
  const dodge = hero.dodge;
  if (dodge && world.time >= dodge.at && (hero.cast || hero.soloActive > 0)) {
    const t = world.telegraphs.find((x) => x.id === dodge.telegraph);
    const greedy = def.quirk.id === 'greedyShot' && t !== undefined && t.impact - world.time < 1;
    const spellbound = def.quirk.id === 'spellbound' && hero.cast !== null;
    if (greedy || spellbound) {
      hero.dodge = null;
      bark(world, e, 'quirk');
    } else {
      hero.cast = null;
      hero.castName = null;
    }
  }
}

const escape = { x: 0, z: 0 };
function escapePoint(world: World, t: Telegraph, e: Entity): { x: number; z: number } | null {
  const s = t.shape;
  const margin = e.radius + 1;
  switch (s.kind) {
    case 'circle':
    case 'cone': {
      const r = s.r;
      let dx = e.x - s.x;
      let dz = e.z - s.z;
      let d = len(dx, dz);
      if (d < 1e-3) {
        dx = e.fx;
        dz = e.fz;
        d = 1;
      }
      escape.x = s.x + (dx / d) * (r + margin);
      escape.z = s.z + (dz / d) * (r + margin);
      return clampToArena(world, escape);
    }
    case 'line': {
      const lx = s.toX - s.x;
      const lz = s.toZ - s.z;
      const l = len(lx, lz);
      if (l < 1e-6) return null;
      const nx = -lz / l;
      const nz = lx / l;
      const side = (e.x - s.x) * nx + (e.z - s.z) * nz >= 0 ? 1 : -1;
      const off = s.width / 2 + margin - Math.abs((e.x - s.x) * nx + (e.z - s.z) * nz);
      escape.x = e.x + nx * side * Math.max(0, off);
      escape.z = e.z + nz * side * Math.max(0, off);
      return clampToArena(world, escape);
    }
    case 'donut': {
      let dx = e.x - s.x;
      let dz = e.z - s.z;
      const d = len(dx, dz);
      if (d < 1e-6) return null;
      dx /= d;
      dz /= d;
      const into = Math.max(0, s.innerR - e.radius - 0.6);
      escape.x = s.x + dx * into;
      escape.z = s.z + dz * into;
      return escape;
    }
    case 'link': {
      const partner = world.entities.get(s.a === e.id ? s.b : s.a);
      if (!partner) return null;
      let dx = e.x - partner.x;
      let dz = e.z - partner.z;
      const d = len(dx, dz);
      if (d < 1e-3) {
        dx = 1;
        dz = 0;
      } else {
        dx /= d;
        dz /= d;
      }
      const need = s.r + 1 - d;
      escape.x = e.x + dx * Math.max(1.5, need * 0.6);
      escape.z = e.z + dz * Math.max(1.5, need * 0.6);
      return clampToArena(world, escape);
    }
    default:
      return null;
  }
}

function clampToArena(world: World, p: { x: number; z: number }): { x: number; z: number } {
  const r = world.arenaRadius - 1;
  const d = len(p.x, p.z);
  if (d > r) {
    p.x = (p.x / d) * r;
    p.z = (p.z / d) * r;
  }
  return p;
}

/** Glory Hound: a new pack arrives and Kael charges its biggest member. */
export function onPackArrived(world: World, pack: readonly Entity[]): void {
  if (pack.length === 0 || world.encounter.wave <= 1) return;
  let biggest: Entity | null = null;
  for (const m of pack) if (!biggest || m.health!.maxHp > biggest.health!.maxHp) biggest = m;
  if (!biggest) return;
  for (const id of world.party) {
    const e = world.entities.get(id);
    if (!isActive(e) || !e.hero) continue;
    if (heroDef(e.hero.defId).quirk.id !== 'gloryHound') continue;
    if (e.hero.cast || e.hero.soloActive > 0) continue;
    e.hero.quirk = GLORY_TIME;
    e.hero.targetId = biggest.id;
    bark(world, e, 'quirk', true);
  }
}
