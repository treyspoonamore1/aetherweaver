/**
 * Hero AI v1 (docs/plan/03 §5): competent but flawed. Heroes pick targets, keep their
 * range, use their two abilities, sometimes dodge — and their quirks get them into the kind
 * of trouble only the Weaver can get them out of.
 */
import { enemyDef, heroDef } from '../../content';
import type { HeroDef } from '../../content/schema';
import { AUTONOMY, TUNING } from '../constants';
import { datan2, dcos, distSq, dsin, len } from '../core/dmath';
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
import { attackRange, flourishHit, heroAttackSpeed, heroDamage } from './heroDamage';
import { hasTalent, ricochet, talentFired, talentValue } from '../bonds';
import { nearestEnemy, soloSpec, startSolo, tickSoloClock, updateSolo } from './solos';
import { approachVelocity, arrive } from './steering';
import { clampPointToArena, pushPointOutOfObstacles } from './physics';
import { empowerBonus } from './thread';
import { isRooted } from '../rules3';
import {
  clampDuel,
  duelAbility,
  duelChooseTarget,
  duelEscape,
  duelExecute,
  duelLost,
  duelMove,
  duelReeled,
  duelStands,
  duelTargetInSight,
  duelTick,
} from './duel';
import {
  groveAbility,
  groveCharge,
  groveChooseTarget,
  groveExecute,
  groveFireUncued,
  groveHeld,
  groveMove,
  groveRetreat,
  groveTargetInSight,
  groveTick,
} from './grove';
import {
  BERSERKER_LEASH,
  BERSERKER_SCATTER_GAP,
  BERSERKER_UNTARGETED_DODGE,
  bloodletCost,
  bloodlusting,
  leapTarget,
  tickBlood,
} from './blood';

const desired = { x: 0, z: 0 };
const slotPos = { x: 0, z: 0 };

/** Ranged heroes stay this close to the Weaver; the tank roams a little farther. */
const RANGED_LEASH = 7.5;
const TANK_LEASH = 11;
const GLORY_TIME = 5;
/** Flankers stand this far (degrees) past the edge of a guard arc (docs/phase-5a.md). */
const FLANK_MARGIN = 35;
/** Event Horizon (Bonds) draws enemies this deep into the field (its radius's share), no deeper. */
const HORIZON_DEPTH = 0.75;
/** Sunder Leap lands this far short of its target's edge (docs/phase-5b.md). */
const LEAP_SHORT = 1.2;
/** Bloodletting is used only above this share of his life. */
const BLOODLET_ABOVE = 0.5;

export function updateHeroes(world: World, dt: number): void {
  const weaver = weaverOf(world);
  const fighting = world.encounter.status === 'fighting';
  for (const id of world.party) {
    const e = world.entities.get(id);
    const hero = e?.hero;
    const h = e?.health;
    if (!e || !hero || !h) continue;
    const def = heroDef(hero.defId);
    // Blood Rage (docs/phase-5b.md): Brann's own clocks, whatever he's doing.
    if (hero.blood) tickBlood(world, e, dt);

    // A Reel also drags a downed hero's body out of danger.
    if (hero.reel && !h.dead) {
      // Seren (docs/phase-5e.md): a pending counter or kill shot is lost to the pull.
      if (hero.duel) duelReeled(world, e);
      updateReel(world, e, dt);
      tickSoloClock(world, e, dt);
      hero.soloHeld = 0;
      continue;
    }
    if (h.dead || h.downed) {
      e.vx = 0;
      e.vz = 0;
      hero.action = 'downed';
      hero.soloHeld = 0;
      // Seren (docs/phase-5e.md): a pending counter or kill shot is lost.
      if (hero.duel) duelLost(world, e);
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
    if (hero.riposteOn !== null) {
      const attacker = world.entities.get(hero.riposteOn);
      hero.riposteOn = null;
      if (attacker) riposteBash(world, e, attacker, 0);
    }

    if (isDisabled(e)) {
      hero.cast = null;
      hero.castName = hero.soloActive > 0 ? hero.castName : null;
      tickSoloClock(world, e, dt);
      approachVelocity(e, 0, 0, TUNING.heroAccel, dt);
      hero.action = 'idle';
      hero.soloHeld = 0;
      // Seren (docs/phase-5e.md): stunned, stilled or possessed, she loses a counter or kill shot.
      if (hero.duel) duelLost(world, e);
      continue;
    }
    // Seren and Oro (docs/phase-5e.md): their own clocks, after `isDisabled` (duel.ts, grove.ts).
    if (hero.duel) duelTick(world, e, def, dt);
    if (hero.grove) groveTick(world, e, def, dt);
    // Pinned (Movement II) or stitched (Movement III): rooted, though they still attack and
    // cast. Reel frees them (a Chime frees the stitched too).
    const pinned = isRooted(e);
    if (pinned && hero.dodge) hero.dodge = null;

    if (!fighting) {
      hero.cast = null;
      hero.castName = null;
      hero.castProgress = 0;
      hero.targetId = null;
      hero.soloHeld = 0;
      if (pinned) root(e, dt);
      else formationMove(weaver, e, def, dt);
      continue;
    }

    // Solo charge (by fighting), and Solos that fire without a Cue.
    if (hero.soloActive <= 0 && hero.engaged && hero.solo < 100) {
      hero.solo = Math.min(
        100,
        hero.solo + (100 / soloSpec(world, e).chargeTime) * world.mods.soloChargeMult * dt,
      );
      if (hero.solo >= 100) world.events.push({ type: 'soloReady', tick: world.tick, hero: e.id });
    }
    // Oro (docs/phase-5e.md): his Solo charges while a Sapling fights, though he doesn't.
    if (hero.grove) groveCharge(world, e, dt);
    // How long a full Solo has waited with someone to fight (hero autonomy's Cue window): the
    // window starts over after any gap (between waves, downed, stunned, Reeled).
    if (hero.soloActive <= 0 && hero.solo >= 100 && hero.targetId !== null) hero.soloHeld += dt;
    else hero.soloHeld = 0;
    // …and its Cue window runs while a Sapling fights.
    if (hero.grove) groveHeld(world, e, dt);
    if (hero.soloActive <= 0 && hero.solo >= 100 && shouldFireUncued(world, e))
      startSolo(world, e, false);

    // Wind Step (Bonds): her step out of an attack beats a rooted Solo, and doesn't break a cast.
    const stepping =
      hero.dodge?.sure === true && world.time >= hero.dodge.at && world.time <= hero.dodge.until;
    if (hero.soloActive > 0) {
      const rooted = updateSolo(world, e, dt);
      if (rooted && !stepping) {
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
          if (stepping) arrive(e, hero.dodge!.x, hero.dodge!.z, TUNING.heroAccel * 1.5, 0.8, dt);
          else approachVelocity(e, 0, 0, TUNING.heroAccel * 2, dt);
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
      distSq(e.x, e.z, target.x, target.z) <=
        sqr(attackRange(world, e, def.attack.range) + target.radius + e.radius);
    // Red Frenzy (docs/phase-5b.md): he spins instead of swinging his axe.
    const frenzy = hero.soloId === 'redFrenzy' && hero.soloActive > 0;
    // Thousand Cuts (docs/phase-5e.md): she blinks instead of thrusting.
    const cutting = hero.soloId === 'thousandCuts' && hero.soloActive > 0;
    if (target && inRange && hero.attackCooldown <= 0 && !frenzy && !cutting)
      basicAttack(world, e, def, target);

    if (pinned) root(e, dt);
    else combatMove(world, weaver, e, def, target, dt);
    hero.action = inRange ? 'attacking' : len(e.vx, e.vz) > 0.3 ? 'moving' : 'idle';
    if (inRange && len(e.vx, e.vz) < 1) faceTarget(world, e);
  }
}

const sqr = (v: number) => v * v;

/** A pinned hero stays where they are. */
function root(e: Entity, dt: number): void {
  approachVelocity(e, 0, 0, TUNING.heroAccel * 2, dt);
}

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

function shouldFireUncued(world: World, e: Entity): boolean {
  const h = e.health!;
  const solo = e.hero!.soloId;
  if (solo === 'aegisWall' && h.hp < h.maxHp * 0.3) return true; // Kael braces when desperate.
  if (friendFalling(world, e)) return true;
  if (!world.config.assists.autonomy) return false;
  // Hero autonomy: Kael raises his wall at once when hurt or a big hit is coming at him...
  if (solo === 'aegisWall' && (h.hp < h.maxHp * 0.5 || h.incoming > h.hp * 0.5)) return true;
  // ...and every hero fires once the Cue window (Kael: his hold) has passed in a fight.
  // Oro (docs/phase-5e.md): target-less, he fires while a Sapling fights.
  if (e.hero!.grove && e.hero!.targetId === null) return groveFireUncued(world, e);
  if (e.hero!.targetId === null) return false;
  return e.hero!.soloHeld >= (solo === 'aegisWall' ? AUTONOMY.kaelHold : AUTONOMY.cueGrace);
}

/**
 * Shieldbearer (Bonds): Kael raises his Aegis Wall himself when a hero within its reach falls
 * low.
 */
function friendFalling(world: World, kael: Entity): boolean {
  if (kael.hero!.soloId !== 'aegisWall' || !hasTalent(kael, 'shieldbearer')) return false;
  const reach = talentValue(world, 'shieldbearer', 'radius');
  const below = talentValue(world, 'shieldbearer', 'below');
  for (const id of world.party) {
    const ally = world.entities.get(id);
    if (!isActive(ally) || ally.id === kael.id) continue;
    if (ally.health.hp >= (ally.health.maxHp * below) / 100) continue;
    if (distSq(ally.x, ally.z, kael.x, kael.z) <= reach * reach) return true;
  }
  return false;
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
  // Brann (docs/phase-5b.md): bloodlusting, he refuses the Rally and has no leash.
  const berserker = def.role === 'berserker';
  const lust = berserker && bloodlusting(world.content, e);
  if ((world.internal.rallyUntil > world.time && !lust) || !target) {
    // Answering a Rally (or with no one to fight), Brann still walks round a blow aimed elsewhere.
    if (berserker && formationSidestep(world, weaver, e, def, dt)) return;
    // So does Seren (docs/phase-5e.md), on her own line.
    if (def.role === 'duelist' && formationSidestep(world, weaver, e, def, dt)) return;
    // Oro (docs/phase-5e.md): Gentle, he steps away from the fighting.
    if (def.role === 'summoner' && groveRetreat(world, weaver, e, def, desired)) {
      // His retreat doesn't end in a blow aimed at another hero (docs/phase-5e.md, W9).
      sidestepOthers(world, e);
      arrive(e, desired.x, desired.z, TUNING.heroAccel, 1.2, dt);
      return;
    }
    // Nor does his formation slot: he walks round it, on his own line, as Seren does.
    if (def.role === 'summoner' && formationSidestep(world, weaver, e, def, dt)) return;
    formationMove(weaver, e, def, dt);
    return;
  }
  const tank = def.role === 'tank';
  const glory = tank && hero.quirk > 0;
  const reach = def.attack.range + target.radius + e.radius - 0.35;
  // A stationary enemy (Movement III) never comes: the Weaver's leash would only keep them off it.
  const free = stationaryTarget(target);
  if (hero.follow === 'hold') {
    desired.x = hero.holdX;
    desired.z = hero.holdZ;
    if ((tank || berserker) && distSq(target.x, target.z, hero.holdX, hero.holdZ) < sqr(4))
      chase(e, target, reach);
  } else if (tank) {
    chase(e, target, reach);
    if (!glory && !free) leash(weaver, TANK_LEASH);
  } else if (berserker) {
    // The berserker chases to reach: no kite, no flank, never gives ground. Under Scatter he
    // still keeps clear of the other heroes, bloodlusting or not (docs/phase-5b.md).
    chase(e, target, reach);
    if (!lust && !free) leash(weaver, BERSERKER_LEASH);
    const scatter = hero.follow === 'scatter';
    if (scatter) {
      keepApart(world, e, BERSERKER_SCATTER_GAP);
      clampToArena(world, desired);
    }
    // He never dodges a blow aimed at him, but he doesn't stand in one aimed at someone else.
    sidestepOthers(world, e);
    // The Scatter gap wins over the step: it is what breaks a link on him and his neighbour.
    if (scatter) {
      keepApart(world, e, BERSERKER_SCATTER_GAP);
      clampToArena(world, desired);
    }
  } else if (def.role === 'duelist' && duelMove(world, weaver, e, def, target, desired)) {
    // Seren (docs/phase-5e.md): her own branch. She steps out of blows aimed at the others, and
    // every destination stays within reach of the Weaver.
    sidestepOthers(world, e);
    clampDuel(world, e, desired);
  } else if (def.role === 'summoner' && groveMove(world, weaver, e, def, target, desired)) {
    // Oro (docs/phase-5e.md): his own branch wrote `desired`.
    clampToArena(world, desired);
  } else if (flank(world, e, def, target)) {
    // Focus on a guarded enemy: out of its arc, whatever the Weaver's leash says.
    clampToArena(world, desired);
    if (def.role === 'summoner') sidestepOthers(world, e);
  } else {
    // Ranged: anchor on the formation slot, step toward the target only as far as needed.
    const spread = hero.follow === 'scatter' ? TUNING.scatterSpread : 1;
    formationSlot(weaver, def.formation, spread, slotPos);
    desired.x = slotPos.x;
    desired.z = slotPos.z;
    const d = len(target.x - desired.x, target.z - desired.z);
    // Hawk Eye (Bonds): Lyra stands as much farther back as she shoots.
    const farther = attackRange(world, e, def.attack.range) - def.attack.range;
    const want =
      Math.min(def.preferredRange + farther, def.attack.range + farther - 0.5) + target.radius;
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
    if (!free) leash(weaver, RANGED_LEASH);
    // Oro with a Focus (docs/phase-5e.md, W9): out of blows aimed at the others, on his own line.
    if (def.role === 'summoner') sidestepOthers(world, e);
  }
  arrive(e, desired.x, desired.z, TUNING.heroAccel, 1.2, dt);
}

// ── Brann keeps out of others' blows (docs/phase-5b.md, "Keeping out of others' blows") ──

/** The spot Brann tests against a telegraph: his body moved to `desired` (see `sidestepOthers`). */
const spot = { id: 0, x: 0, z: 0, radius: 0, fx: 1, fz: 0 };
/** How far past a cone's edge or radius his body's edge stops (m). */
const SIDESTEP_MARGIN = 0.6;

/**
 * Brann has no dodge (`dodge 0`) and never steps out of a blow aimed at him: that one is the
 * Weaver's to Ward. But he doesn't stand in one aimed at another hero (a Toll Cleave swung at
 * Kael, a Twin Cleave at Lyra, a lance at Vexis): before he moves, `desired` is carried to the
 * nearest point outside each live damage telegraph that holds it and names another hero as its
 * target. A blow aimed at no one (`target: null`, a caster-centred burst or donut) he leaves only
 * by chance (`untargetedDodge`). Marks, raids and links hit whoever they name wherever he stands,
 * so they're left alone. Two passes, so clearing one shape doesn't leave him in another. A fixed
 * rule, checked every tick: no RNG, and only his own branch of `combatMove` calls it.
 */
function sidestepOthers(world: World, e: Entity): void {
  spot.id = e.id;
  spot.radius = e.radius;
  spot.fx = e.fx;
  spot.fz = e.fz;
  // `contains` and `escapePoint` read only id, x, z, radius and facing.
  const body = spot as unknown as Entity;
  for (let pass = 0; pass < 2; pass++) {
    let moved = false;
    for (const t of world.telegraphs) {
      // Aimed at another hero only: one aimed at no one is his to dodge by chance, as the
      // starters do (`untargetedDodge`); one aimed at him is the Weaver's to Ward.
      if (t.effect !== 'damage' || t.target === null || t.target === e.id) continue;
      const k = t.shape.kind;
      if (k === 'mark' || k === 'raid' || k === 'link') continue;
      spot.x = desired.x;
      spot.z = desired.z;
      if (!contains(world, t, body)) continue;
      const out =
        t.shape.kind === 'cone' ? coneStep(world, t, t.shape, body) : escapePoint(world, t, body);
      if (!out) continue;
      desired.x = out.x;
      desired.z = out.z;
      moved = true;
    }
    if (!moved) break;
  }
}

/** The lateral exit `coneStep` weighs against the radial one (`escape`). */
const lateral = { x: 0, z: 0 };

/**
 * Out of a cone: round its apex to past the edge of its arc at the same distance, which keeps
 * him in reach of the enemy swinging it, or straight out past its radius, whichever is nearer.
 * Standing on the apex itself (the cone always holds that), only the second works. Both points
 * are clamped to the arena before they're weighed: by a wall the radial exit can be clamped back
 * into the cone, and then the lateral one wins even when it is farther. `body` is `spot` (see
 * `sidestepOthers`), moved here to test each point and left where the caller resets it.
 */
function coneStep(
  world: World,
  t: Telegraph,
  s: { x: number; z: number; r: number; dirX: number; dirZ: number; halfAngleCos: number },
  body: Entity,
): { x: number; z: number } {
  const px = body.x;
  const pz = body.z;
  let dx = px - s.x;
  let dz = pz - s.z;
  let d = len(dx, dz);
  if (d < 1e-3) {
    // Exactly on the apex: out behind it.
    dx = -s.dirX;
    dz = -s.dirZ;
    d = 1;
  }
  const margin = body.radius + SIDESTEP_MARGIN;
  const ux = dx / d;
  const uz = dz / d;
  escape.x = s.x + ux * (s.r + margin);
  escape.z = s.z + uz * (s.r + margin);
  clampToArena(world, escape);
  if (d <= body.radius + 0.5) return escape;
  // Turned from the axis toward the side he's on, by the half-angle plus his body's width.
  const side = s.dirX * dz - s.dirZ * dx >= 0 ? 1 : -1;
  const hc = Math.max(-1, Math.min(1, s.halfAngleCos));
  const a = datan2(Math.sqrt(1 - hc * hc), hc) + datan2(margin, d);
  const c = dcos(a);
  const sn = dsin(a) * side;
  lateral.x = s.x + (s.dirX * c - s.dirZ * sn) * d;
  lateral.z = s.z + (s.dirX * sn + s.dirZ * c) * d;
  clampToArena(world, lateral);
  const nearer = distSq(px, pz, lateral.x, lateral.z) <= distSq(px, pz, escape.x, escape.z);
  const outside = (q: { x: number; z: number }) => {
    body.x = q.x;
    body.z = q.z;
    return !contains(world, t, body);
  };
  const radialOut = outside(escape);
  const lateralOut = outside(lateral);
  // The nearer exit that leaves the cone; with neither out (or both), the nearer.
  if (radialOut === lateralOut ? nearer : lateralOut) {
    escape.x = lateral.x;
    escape.z = lateral.z;
  }
  return escape;
}

/**
 * Brann answering a Rally (or with no one to fight): when his formation slot lies in a blow
 * aimed at someone else, he walks to the nearest point outside it instead (`sidestepOthers`), and
 * returns true. Otherwise false, and he keeps formation as every hero does. Not while Held.
 */
function formationSidestep(
  world: World,
  weaver: Entity,
  e: Entity,
  def: HeroDef,
  dt: number,
): boolean {
  const hero = e.hero!;
  if (hero.follow === 'hold' || world.telegraphs.length === 0) return false;
  const spread = hero.follow === 'scatter' ? TUNING.scatterSpread : 1;
  formationSlot(weaver, def.formation, spread, slotPos);
  desired.x = slotPos.x;
  desired.z = slotPos.z;
  sidestepOthers(world, e);
  if (desired.x === slotPos.x && desired.z === slotPos.z) return false;
  arrive(e, desired.x, desired.z, TUNING.heroAccel, 1.2, dt);
  return true;
}

/**
 * Flanking (docs/phase-5a.md P6): when the Focus target has an unbroken guard, a non-tank
 * stands at its range, rotated ±(arc/2 + 35°) from the guard's direction, on the nearer side.
 * Kael holds the front, so the guard keeps facing him. Writes `desired`; false otherwise.
 */
function flank(world: World, e: Entity, def: HeroDef, target: Entity): boolean {
  const g = target.enemy?.guard;
  if (!g || world.focusTarget !== target.id || g.brokenUntil > world.time) return false;
  const arc = enemyDef(target.enemy!.defId).guard?.arcDeg ?? 0;
  const a = ((arc / 2 + FLANK_MARGIN) * Math.PI) / 180;
  const c = dcos(a);
  const s = dsin(a);
  const want = Math.min(def.preferredRange, def.attack.range - 0.5) + target.radius;
  // The guard direction turned each way.
  const lx = g.fx * c - g.fz * s;
  const lz = g.fx * s + g.fz * c;
  const rx = g.fx * c + g.fz * s;
  const rz = -g.fx * s + g.fz * c;
  const left = distSq(e.x, e.z, target.x + lx * want, target.z + lz * want);
  const right = distSq(e.x, e.z, target.x + rx * want, target.z + rz * want);
  const useLeft = left <= right;
  desired.x = target.x + (useLeft ? lx : rx) * want;
  desired.z = target.z + (useLeft ? lz : rz) * want;
  return true;
}

/**
 * Moves `desired` to at least `gap` from every other standing hero: straight away from each one
 * (from where `e` stands when the point is on them). Two passes, so clearing one hero doesn't
 * leave him on another.
 */
function keepApart(world: World, e: Entity, gap: number): void {
  for (let pass = 0; pass < 2; pass++) {
    for (const id of world.party) {
      if (id === e.id) continue;
      const o = world.entities.get(id);
      if (!isActive(o)) continue;
      let dx = desired.x - o.x;
      let dz = desired.z - o.z;
      let d = len(dx, dz);
      if (d >= gap) continue;
      if (d < 1e-6) {
        dx = e.x - o.x;
        dz = e.z - o.z;
        d = len(dx, dz);
        if (d < 1e-6) {
          dx = 1;
          dz = 0;
          d = 1;
        }
      }
      desired.x = o.x + (dx / d) * gap;
      desired.z = o.z + (dz / d) * gap;
    }
  }
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
  // Seren and Oro (docs/phase-5e.md): their own picks first; undefined keeps the shared rule.
  if (def.role === 'duelist') {
    const pick = duelChooseTarget(world, weaver, e, def);
    if (pick !== undefined) return pick;
  }
  if (def.role === 'summoner') {
    const pick = groveChooseTarget(world, weaver, e, def);
    if (pick !== undefined) return pick;
  }
  const berserker = def.role === 'berserker';
  if (world.internal.rallyUntil > world.time && !(berserker && bloodlusting(world.content, e)))
    return nearestEnemy(world, e, attackRange(world, e, def.attack.range), e.hero!.targetId);
  // Nothing in sight: a stationary enemy (Movement III) never comes to the party, so seek it.
  return targetInSight(world, weaver, e, def) ?? seekStationary(world, e);
}

/**
 * Movement III (docs/phase-5c.md, Q3): a hero with no target in sight seeks the nearest living
 * stationary enemy (a Void Maw, a Spindle), which never comes to the party. It reads positions
 * and content only (no RNG, no state), and before Movement III no def is `stationary`, so it
 * finds nothing and the hero keeps no target, as before.
 */
function seekStationary(world: World, e: Entity): Entity | null {
  let best: Entity | null = null;
  let bestD = Infinity;
  for (const m of world.entities.list()) {
    if (!m.enemy || !isActive(m) || m.enemy.state === 'spawning' || rising(m)) continue;
    if (enemyDef(m.enemy.defId).stationary !== true) continue;
    const d = distSq(m.x, m.z, e.x, e.z);
    if (d < bestD) {
      best = m;
      bestD = d;
    }
  }
  return best;
}

/** A stationary enemy (Movement III's Void Maw, a Spindle): the leash only keeps a hero off it. */
function stationaryTarget(target: Entity): boolean {
  return enemyDef(target.enemy!.defId).stationary === true;
}

function targetInSight(world: World, weaver: Entity, e: Entity, def: HeroDef): Entity | null {
  const hero = e.hero!;
  const berserker = def.role === 'berserker';
  const focus = world.focusTarget === null ? undefined : world.entities.get(world.focusTarget);
  if (focus?.enemy && isActive(focus) && !rising(focus)) return focus;

  const found = hero.targetId === null ? undefined : world.entities.get(hero.targetId);
  // A target standing up again (Restless Dead) is left until it has.
  const current = found && rising(found) ? undefined : found;
  if (berserker) return berserkerTarget(world, e, def, current);
  if (def.role === 'duelist') {
    const pick = duelTargetInSight(world, weaver, e, def, current);
    if (pick !== undefined) return pick;
  }
  if (def.role === 'summoner') {
    const pick = groveTargetInSight(world, weaver, e, def, current);
    if (pick !== undefined) return pick;
  }
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
  const keepRange = attackRange(world, e, def.attack.range) + 3;
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

/**
 * The berserker's target (docs/phase-5b.md): the one he's on while it's in reach, else the
 * nearest enemy. (The Focus, and a Rally he obeys, were decided before.)
 */
function berserkerTarget(
  world: World,
  e: Entity,
  def: HeroDef,
  current: Entity | undefined,
): Entity | null {
  const reach = attackRange(world, e, def.attack.range) + e.radius;
  // His axe barely scratches a discord barrier unless the Weaver Empowers him: he leaves a
  // shielded enemy to the Empowered while anything else is in reach of a chase.
  const plain = empowerBonus(world, e).more <= 0;
  const barred = (m: Entity) => plain && m.health!.shields.some((x) => x.kind === 'discord');
  if (
    current?.enemy &&
    isActive(current) &&
    !barred(current) &&
    distSq(current.x, current.z, e.x, e.z) <= sqr(reach + current.radius)
  )
    return current;
  let best: Entity | null = null;
  let bestD = Infinity;
  let fallback: Entity | null = null;
  let fallbackD = Infinity;
  for (const m of world.entities.list()) {
    if (!m.enemy || !isActive(m) || m.enemy.state === 'spawning' || rising(m)) continue;
    const d = distSq(m.x, m.z, e.x, e.z);
    if (d > sqr(20)) continue;
    if (barred(m)) {
      if (d < fallbackD) {
        fallback = m;
        fallbackD = d;
      }
      continue;
    }
    if (d >= bestD) continue;
    best = m;
    bestD = d;
  }
  return best ?? fallback;
}

// ── Attacks and abilities ─────────────────────────────────────────────────────────────

function basicAttack(world: World, e: Entity, def: HeroDef, target: Entity): void {
  const hero = e.hero!;
  hero.attackCooldown = def.attack.interval;
  // Bloodletting (docs/phase-5b.md): an empowered swing hits harder, all round him.
  const blood = hero.blood;
  const bloodlet = !!blood && blood.bloodlet > 0;
  let base = def.attack.damage;
  if (blood && bloodlet) {
    base *= 1 + (def.abilities.find((a) => a.id === 'bloodletting')?.hitBonus ?? 0);
    blood.bloodlet--;
  }
  const hit = heroDamage(world, e, base, 0, true);
  if (def.attack.projectileSpeed <= 0) {
    const cleave = def.attack.cleave;
    world.events.push({
      type: 'attackFired',
      tick: world.tick,
      source: e.id,
      target: target.id,
      visual: cleave ? 'cleave' : 'melee',
      fromX: e.x,
      fromZ: e.z,
      toX: target.x,
      toZ: target.z,
      travel: 0,
    });
    let amount = hit.amount;
    let amplified = hit.amplified;
    // Blood Oath (Bonds): the overheal he banked rides on this swing, your healing's doing.
    if (blood && blood.oathBank > 0) {
      amount += blood.oathBank;
      amplified += blood.oathBank;
      blood.oathBank = 0;
      talentFired(world, e, 'blood_oath', target.x, target.z, target.id);
    }
    dealDamage(world, target, {
      source: e.id,
      sourceName: def.name,
      amount,
      amplified,
      aura: hit.aura,
      empower: hit.empower,
      crit: hit.crit,
      empowered: hit.empowered,
    });
    if (cleave) cleaveAround(world, e, def, target, hit, bloodlet ? 360 : cleave.arcDeg);
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
    ...ricochet(world, e),
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

/**
 * The axe's cleave (docs/phase-5b.md): every other enemy within its radius, in its arc toward
 * the target (all round him when Bloodlet), takes its share of the swing.
 */
function cleaveAround(
  world: World,
  e: Entity,
  def: HeroDef,
  target: Entity,
  hit: ReturnType<typeof heroDamage>,
  arcDeg: number,
): void {
  const cleave = def.attack.cleave!;
  let fx = target.x - e.x;
  let fz = target.z - e.z;
  const m0 = len(fx, fz);
  if (m0 > 1e-6) {
    fx /= m0;
    fz /= m0;
  } else {
    fx = e.fx;
    fz = e.fz;
  }
  const all = arcDeg >= 360;
  const minCos = dcos(((arcDeg / 2) * Math.PI) / 180);
  for (const m of world.entities.list()) {
    if (m === target || !m.enemy || !isActive(m) || rising(m)) continue;
    const dx = m.x - e.x;
    const dz = m.z - e.z;
    const d = len(dx, dz);
    if (d > cleave.radius + m.radius) continue;
    if (!all && d > 1e-6 && (dx * fx + dz * fz) / d < minCos) continue;
    dealDamage(world, m, {
      source: e.id,
      sourceName: def.name,
      amount: hit.amount * cleave.pct,
      amplified: hit.amplified * cleave.pct,
      aura: hit.aura * cleave.pct,
      empower: hit.empower * cleave.pct,
      crit: hit.crit,
      empowered: hit.empowered,
    });
  }
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
  // Overchannel (Bonds): a longer Starbolt.
  if (ability.id === 'starbolt' && hasTalent(e, 'overchannel'))
    castTime *= 1 + talentValue(world, 'overchannel', 'cast') / 100;
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
        // Empowered, she breaks a guard first (Movement II); then she interrupts a caster.
        const guarded = guardedInReach(world, e, ability.range);
        const breaker = guarded && empowerBonus(world, e).more > 0 ? guarded : null;
        const caster = breaker ?? interruptibleCaster(world, e, ability.range);
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
      // Brann (docs/phase-5b.md).
      case 'sunderLeap': {
        const t = leapTarget(world, e, ability);
        if (t) return beginAbility(world, e, def, index, t, t.x, t.z);
        break;
      }
      case 'bloodletting': {
        const h = e.health!;
        if (hero.blood && h.hp > h.maxHp * BLOODLET_ABOVE && inReach(target))
          return beginAbility(world, e, def, index, target, e.x, e.z);
        break;
      }
      // Seren (docs/phase-5e.md): duel.ts decides.
      case 'lunge':
      case 'feint': {
        const t = duelAbility(world, e, def, ability, target);
        if (t) return beginAbility(world, e, def, index, t, t.x, t.z);
        break;
      }
      // Oro (docs/phase-5e.md): grove.ts decides.
      case 'regrowth':
      case 'bramble': {
        const use = groveAbility(world, e, def, ability, target);
        if (use) return beginAbility(world, e, def, index, use.target, use.x, use.z);
        break;
      }
    }
  }
  return false;
}

/** The nearest enemy in reach whose guard is up (none in Movement I). */
function guardedInReach(world: World, e: Entity, range: number): Entity | null {
  let best: Entity | null = null;
  let bestD = Infinity;
  for (const m of world.entities.list()) {
    const g = m.enemy?.guard;
    if (!g || g.brokenUntil > world.time || !isActive(m)) continue;
    const d = distSq(m.x, m.z, e.x, e.z);
    if (d <= sqr(range + m.radius) && d < bestD) {
      best = m;
      bestD = d;
    }
  }
  return best;
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
  // `pierce`: an Empowered hit of it breaks a guard (Piercing Shot, docs/phase-5a.md P6).
  const hitEnemy = (m: Entity, amount: number, pierce = false) => {
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
      ...(pierce && hit.empowered ? { breaksGuard: true } : {}),
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
        hitEnemy(m, ability.damage, true);
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
      // Event Horizon (Bonds): it reaches farther, and pulls its enemies into your field, toward
      // the point well inside it nearest the well: together still, but not onto the Weaver.
      const horizon = hasTalent(e, 'event_horizon') && !world.field.suppressed;
      const extra = horizon ? talentValue(world, 'event_horizon', 'radius') : 0;
      const radius = ability.radius * radiusMult + extra;
      let cx = x;
      let cz = z;
      if (horizon) {
        const f = world.field;
        const depth = f.radius * HORIZON_DEPTH;
        const away = len(x - f.x, z - f.z);
        if (away > depth) {
          cx = f.x + ((x - f.x) / away) * depth;
          cz = f.z + ((z - f.z) / away) * depth;
        }
      }
      emit(x, z, radius);
      if (horizon) talentFired(world, e, 'event_horizon', cx, cz);
      for (const m of world.entities.list()) {
        if (!m.enemy || !isActive(m)) continue;
        if (len(x - m.x, z - m.z) > radius + m.radius) continue;
        const dx = cx - m.x;
        const dz = cz - m.z;
        const d = len(dx, dz);
        // A stationary enemy (Movement III's Void Maw, a Spindle) isn't pulled.
        if (
          (m.enemy.tier === 'normal' || m.enemy.tier === 'elite') &&
          enemyDef(m.enemy.defId).stationary !== true
        ) {
          // Event Horizon's farther reach pulls as much farther.
          const pull = Math.min(d * 0.7, 3 + extra);
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
      // Overchannel (Bonds): a longer cast, a bigger bolt.
      const power = hasTalent(e, 'overchannel')
        ? ability.damage * (1 + talentValue(world, 'overchannel', 'damage') / 100)
        : ability.damage;
      const hit = hitOf(power);
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
      if (hasTalent(e, 'starthread')) starthread(world, e, def, power, radius);
      return;
    }
    case 'sunderLeap': {
      // A gap-closer slam (docs/phase-5b.md): he lands just short of it and hits all round.
      if (!isActive(target)) return;
      const fromX = e.x;
      const fromZ = e.z;
      const land = leapLanding(world, e, target);
      e.x = land.x;
      e.z = land.z;
      e.vx = 0;
      e.vz = 0;
      world.events.push({
        type: 'attackFired',
        tick: world.tick,
        source: e.id,
        target: target.id,
        visual: 'leap',
        fromX,
        fromZ,
        toX: e.x,
        toZ: e.z,
        travel: 0,
      });
      const radius = ability.radius * radiusMult;
      emit(e.x, e.z, radius);
      for (const m of world.entities.list()) {
        if (!m.enemy || !isActive(m)) continue;
        if (distSq(m.x, m.z, e.x, e.z) > sqr(radius + m.radius)) continue;
        if (m.enemy.cast?.interruptible) interruptEnemy(world, m, e.id);
        if (ability.stun > 0) addStatus(world, m, 'stun', ability.stun, e.id);
        hitEnemy(m, ability.damage);
      }
      return;
    }
    case 'bloodletting': {
      // He cuts his own palm: life spent, not damage taken (no ledger, threat, Fermata or recap).
      const h = e.health!;
      const blood = e.hero!.blood;
      if (!blood) return;
      const cost = bloodletCost(h.hp, h.maxHp, ability);
      emit(e.x, e.z, 0);
      if (!(cost > 0)) return;
      h.hp -= cost;
      blood.spent += cost;
      blood.bloodlet = ability.hits ?? 0;
      world.events.push({ type: 'lifeSpent', tick: world.tick, hero: e.id, amount: cost });
      // His quirk bark ('Blood calls!'), spaced by the shared bark cooldown (Brann-only draw).
      bark(world, e, 'quirk');
      return;
    }
    // Seren's and Oro's (docs/phase-5e.md): their files act.
    case 'lunge':
    case 'feint':
      duelExecute(world, e, def, index, target, x, z, f, emit);
      return;
    case 'regrowth':
    case 'bramble':
      groveExecute(world, e, def, index, target, x, z, f, emit);
      return;
  }
}

const landing = { x: 0, z: 0 };
/**
 * Where Sunder Leap sets him down: `LEAP_SHORT` m short of the target's edge, along his line to
 * it, then through the physics step's own pillar push and arena clamp, in the step's order, so
 * a pillar by the wall can never push him out of the arena.
 */
function leapLanding(world: World, e: Entity, target: Entity): { x: number; z: number } {
  const dx = target.x - e.x;
  const dz = target.z - e.z;
  const d = len(dx, dz);
  const back = Math.min(d, target.radius + LEAP_SHORT);
  landing.x = d > 1e-6 ? target.x - (dx / d) * back : e.x;
  landing.z = d > 1e-6 ? target.z - (dz / d) * back : e.z;
  pushPointOutOfObstacles(world, landing, e.radius);
  clampPointToArena(world, landing, e.radius);
  return landing;
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
    // Brann (`dodge 0`) rolls only for a blow aimed at no one (`untargetedDodge`); every other
    // hero's chance, and so every roll a default party draws, is its `dodge` as before.
    const chance = def.dodge > 0 ? def.dodge : untargetedDodge(def, t);
    if (t.kind === 'mark' || t.kind === 'raid' || chance <= 0) continue;
    // A rooted hero can't step out (no roll is drawn: pins and stitches exist only in
    // Movements II and III).
    if (isRooted(e)) continue;
    if (!contains(world, t, e)) continue;
    // Seren (docs/phase-5e.md): Warded, she stands her ground against a parryable blow at her.
    if (hero.duel && duelStands(world, e, t)) continue;
    // Wind Step (Bonds): every so often, Lyra steps out at once, whatever she's doing.
    if (hasTalent(e, 'wind_step') && world.time >= hero.talentReadyAt && !isDisabled(e)) {
      const out = escapePoint(world, t, e);
      if (out) {
        hero.dodge = {
          telegraph: t.id,
          x: out.x,
          z: out.z,
          at: world.time + 0.1,
          until: t.impact + 0.15,
          sure: true,
        };
        hero.talentReadyAt = world.time + talentValue(world, 'wind_step', 'seconds');
        talentFired(world, e, 'wind_step', e.x, e.z);
        continue;
      }
    }
    if (!world.rng.ai.chance(chance)) continue;
    const escape = escapePoint(world, t, e);
    if (!escape) continue;
    // Seren (docs/phase-5e.md): her step stays within the leash.
    if (hero.duel) duelEscape(world, e, t, escape);
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
    const greedy =
      !dodge.sure && def.quirk.id === 'greedyShot' && t !== undefined && t.impact - world.time < 1;
    const spellbound = !dodge.sure && def.quirk.id === 'spellbound' && hero.cast !== null;
    if (greedy || spellbound) {
      hero.dodge = null;
      bark(world, e, 'quirk');
    } else if (!dodge.sure) {
      hero.cast = null;
      hero.castName = null;
    }
  }
}

/**
 * Brann's chance to step out of a telegraph he notices (his `dodge` is 0): a damage blow on the
 * ground aimed at no one, `BERSERKER_UNTARGETED_DODGE`; 0 for everything else, and for every
 * other hero. A blow aimed at another hero he walks out of with no roll (`sidestepOthers`).
 */
function untargetedDodge(def: HeroDef, t: Telegraph): number {
  if (def.role !== 'berserker' || t.effect !== 'damage' || t.target !== null) return 0;
  const k = t.shape.kind;
  return k === 'circle' || k === 'donut' || k === 'cone' || k === 'line'
    ? BERSERKER_UNTARGETED_DODGE
    : 0;
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
    // Steady Vanguard (Bonds): he charges only your Focus, and only if you've set one.
    let quarry = biggest;
    if (hasTalent(e, 'steady_vanguard')) {
      const focus = world.focusTarget === null ? undefined : world.entities.get(world.focusTarget);
      if (!focus?.enemy || !isActive(focus)) continue;
      quarry = focus;
      talentFired(world, e, 'steady_vanguard', focus.x, focus.z, focus.id);
    }
    e.hero.quirk = GLORY_TIME;
    e.hero.targetId = quarry.id;
    bark(world, e, 'quirk', true);
    if (hasTalent(e, 'vanguards_roar')) roar(world, e, quarry);
  }
}

/** Vanguard's Roar (Bonds): everything near Kael's quarry turns on him. */
function roar(world: World, kael: Entity, quarry: Entity): void {
  const radius = talentValue(world, 'vanguards_roar', 'radius');
  const seconds = talentValue(world, 'vanguards_roar', 'seconds');
  for (const m of world.entities.list()) {
    if (!m.enemy || !isActive(m)) continue;
    if (distSq(m.x, m.z, quarry.x, quarry.z) > sqr(radius + m.radius)) continue;
    topThreat(m, kael.hero!.slot, 150);
    if (m.enemy.tier === 'normal' || m.enemy.tier === 'elite') {
      m.enemy.tauntTarget = kael.id;
      m.enemy.tauntUntil = Math.max(m.enemy.tauntUntil, world.time + seconds);
    }
  }
  talentFired(world, kael, 'vanguards_roar', quarry.x, quarry.z, quarry.id);
}

/**
 * Riposte Bash (Bonds): a Ward on Kael that takes a blow fires his Shield Bash at the attacker,
 * if it's close enough, whatever its cooldown, once in a while. A Perfect Ward does every time,
 * and sends back a share of the blow you turned (`blow`).
 */
export function riposteBash(world: World, kael: Entity, attacker: Entity, blow: number): void {
  if (!isActive(kael) || !isActive(attacker) || !attacker.enemy || isDisabled(kael)) return;
  const range = talentValue(world, 'riposte_bash', 'range');
  if (distSq(kael.x, kael.z, attacker.x, attacker.z) > sqr(range + attacker.radius + kael.radius))
    return;
  const def = heroDef(kael.hero!.defId);
  const index = def.abilities.findIndex((a) => a.id === 'shieldBash');
  if (index !== 0 && index !== 1) return;
  talentFired(world, kael, 'riposte_bash', attacker.x, attacker.z, attacker.id);
  kael.hero!.talentReadyAt = world.time + talentValue(world, 'riposte_bash', 'seconds');
  executeAbility(world, kael, def, index, attacker.id, attacker.x, attacker.z);
  const back = (blow * talentValue(world, 'riposte_bash', 'pct')) / 100;
  if (back > 0 && isActive(attacker))
    dealDamage(world, attacker, { source: kael.id, sourceName: 'Riposte Bash', amount: back });
}

/** Starthread (Bonds): Starbolt also strikes the enemy nearest the hero you Thread. */
function starthread(
  world: World,
  vexis: Entity,
  def: HeroDef,
  power: number,
  radius: number,
): void {
  const slot = world.entities.get(world.weaverId)?.weaver?.threadSlot;
  if (slot === null || slot === undefined) return;
  const threaded = world.entities.get(world.party[slot] ?? -1);
  if (!isActive(threaded) || threaded.id === vexis.id) return;
  const target = nearestAt(world, threaded.x, threaded.z, 8);
  if (!target) return;
  const hit = heroDamage(world, vexis, (power * talentValue(world, 'starthread', 'pct')) / 100, 0);
  const travel =
    len(target.x - threaded.x, target.z - threaded.z) / Math.max(1, def.attack.projectileSpeed);
  world.internal.pendingHits.push({
    at: world.time + travel,
    source: vexis.id,
    target: target.id,
    amount: hit.amount,
    amplified: hit.amplified,
    aura: hit.aura,
    empower: hit.empower,
    crit: hit.crit,
    splashRadius: radius,
    splash: 1,
    chain: 0,
    empowered: hit.empowered,
    stun: 0,
  });
  world.events.push({
    type: 'attackFired',
    tick: world.tick,
    source: vexis.id,
    target: target.id,
    visual: 'starbolt',
    fromX: threaded.x,
    fromZ: threaded.z,
    toX: target.x,
    toZ: target.z,
    travel,
  });
  talentFired(world, vexis, 'starthread', threaded.x, threaded.z, target.id);
}
