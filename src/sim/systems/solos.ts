/**
 * Solos (docs/plan/03 §5): each hero's signature move. They charge by fighting and, at 100,
 * wait for the Weaver's Cue, which fires them in their stronger *cued* form.
 */
import { heroDef } from '../../content';
import type { HeroDef } from '../../content/schema';
import { distSq } from '../core/dmath';
import { addShield, isActive } from '../combat/health';
import { bark } from '../combat/feedback';
import type { Entity } from '../state';
import type { World } from '../world';
import { inAnyField } from './field';
import { heroDamage } from './heroDamage';

export function startSolo(world: World, hero: Entity, cued: boolean): void {
  const h = hero.hero!;
  const def = heroDef(h.defId);
  const solo = def.solo;
  h.solo = 0;
  h.soloCued = cued;
  h.soloActive = solo.duration;
  h.soloPulseAt = world.time;
  h.cast = null;
  h.castName = solo.name;
  h.castProgress = 0;
  h.dodge = null;
  world.events.push({
    type: 'soloStarted',
    tick: world.tick,
    hero: hero.id,
    solo: solo.id,
    cued,
    duration: solo.duration,
  });
  if (cued) bark(world, hero, 'cued', true);

  if (solo.id === 'aegisWall') {
    if (cued) {
      for (const id of world.party) {
        const ally = world.entities.get(id);
        if (isActive(ally))
          addShield(world, ally, 'dome', ally.health.maxHp * solo.cuedPower, solo.duration, true);
      }
      const weaver = world.entities.get(world.weaverId);
      if (isActive(weaver))
        addShield(world, weaver, 'dome', weaver.health.maxHp * solo.cuedPower, solo.duration, true);
    } else {
      addShield(world, hero, 'overshield', hero.health!.maxHp * solo.power, solo.duration, false);
    }
    world.events.push({
      type: 'abilityUsed',
      tick: world.tick,
      source: hero.id,
      ability: solo.id,
      name: solo.name,
      x: hero.x,
      z: hero.z,
      radius: cued ? world.field.radius : 1.5,
    });
  }
}

/** Advances an active Solo. Returns true while the hero is rooted by it. */
export function updateSolo(world: World, hero: Entity, dt: number): boolean {
  const h = hero.hero!;
  const def = heroDef(h.defId);
  const solo = def.solo;
  h.soloActive = Math.max(0, h.soloActive - dt);
  h.castProgress = 1 - h.soloActive / Math.max(0.01, solo.duration);
  if (solo.id === 'galeBarrage') galeBarrage(world, hero, def);
  else if (solo.id === 'starfall') starfall(world, hero, def);
  if (h.soloActive <= 0) {
    finishSolo(world, hero);
    return false;
  }
  // Gale Barrage roots Lyra unless cued; Starfall always roots Vexis; Aegis Wall never roots.
  if (solo.id === 'galeBarrage') return !h.soloCued;
  return solo.id === 'starfall';
}

/**
 * Keeps a Solo's clock running while the hero can't act (stunned, being Reeled): the Solo's
 * effects (domes, shields) run on their own clocks, so the Solo must end on time too.
 */
export function tickSoloClock(world: World, hero: Entity, dt: number): void {
  const h = hero.hero!;
  if (h.soloActive <= 0) return;
  h.soloActive = Math.max(0, h.soloActive - dt);
  if (h.soloActive <= 0) finishSolo(world, hero);
}

function finishSolo(world: World, hero: Entity): void {
  const h = hero.hero!;
  h.castName = null;
  h.castProgress = 0;
  world.events.push({ type: 'soloEnded', tick: world.tick, hero: hero.id });
  if (heroDef(h.defId).solo.id === 'aegisWall' && world.mods.bulwarksEchoPct > 0) {
    for (const id of world.party) {
      const ally = world.entities.get(id);
      if (isActive(ally)) {
        addShield(
          world,
          ally,
          'overshield',
          ally.health.maxHp * world.mods.bulwarksEchoPct,
          4,
          true,
        );
      }
    }
  }
}

const GALE_RATE = 1 / 12;
const STAR_RATE = 0.3;

function galeBarrage(world: World, hero: Entity, def: HeroDef): void {
  const h = hero.hero!;
  while (h.soloPulseAt <= world.time && h.soloActive > 0) {
    h.soloPulseAt += GALE_RATE;
    const target = nearestEnemy(world, hero, def.attack.range + 2, h.targetId);
    if (!target) continue;
    const base = h.soloCued ? def.solo.cuedPower : def.solo.power;
    const critBonus = h.soloCued ? 0.4 : 0;
    const hit = heroDamage(world, hero, base, critBonus);
    const d = Math.sqrt(distSq(hero.x, hero.z, target.x, target.z));
    const travel = d / def.attack.projectileSpeed;
    world.internal.pendingHits.push({
      at: world.time + travel,
      source: hero.id,
      target: target.id,
      amount: hit.amount,
      amplified: hit.amplified,
      crit: hit.crit,
      splashRadius: 0,
      splash: 0,
      chain: 0,
      empowered: hit.empowered,
      stun: 0,
    });
    world.events.push({
      type: 'attackFired',
      tick: world.tick,
      source: hero.id,
      target: target.id,
      visual: 'arrow',
      fromX: hero.x,
      fromZ: hero.z,
      toX: target.x,
      toZ: target.z,
      travel,
    });
  }
}

function starfall(world: World, hero: Entity, def: HeroDef): void {
  const h = hero.hero!;
  while (h.soloPulseAt <= world.time && h.soloActive > 0) {
    h.soloPulseAt += STAR_RATE;
    const target = h.soloCued ? randomEnemyInField(world) : randomEnemyNear(world, hero, 12);
    if (!target) continue;
    const base = h.soloCued ? def.solo.cuedPower : def.solo.power;
    const hit = heroDamage(world, hero, base, 0);
    const travel = 0.45;
    world.internal.pendingHits.push({
      at: world.time + travel,
      source: hero.id,
      target: target.id,
      amount: hit.amount,
      amplified: hit.amplified,
      crit: hit.crit,
      splashRadius: 2.5,
      splash: 1,
      chain: 0,
      empowered: hit.empowered,
      stun: h.soloCued ? 0.5 : 0,
    });
    world.events.push({
      type: 'attackFired',
      tick: world.tick,
      source: hero.id,
      target: target.id,
      visual: 'meteor',
      fromX: target.x,
      fromZ: target.z,
      toX: target.x,
      toZ: target.z,
      travel,
    });
  }
}

export function nearestEnemy(
  world: World,
  from: Entity,
  range: number,
  prefer: number | null,
): Entity | null {
  if (prefer !== null) {
    const p = world.entities.get(prefer);
    if (
      p?.enemy &&
      isActive(p) &&
      distSq(p.x, p.z, from.x, from.z) <= (range + p.radius) * (range + p.radius)
    )
      return p;
  }
  let best: Entity | null = null;
  let bestD = Infinity;
  for (const e of world.entities.list()) {
    if (!e.enemy || !isActive(e)) continue;
    const d = distSq(e.x, e.z, from.x, from.z);
    if (d < bestD && d <= (range + e.radius) * (range + e.radius)) {
      best = e;
      bestD = d;
    }
  }
  return best;
}

function randomEnemyNear(world: World, from: Entity, range: number): Entity | null {
  const ids = world.scratch.ids;
  ids.length = 0;
  for (const e of world.entities.list()) {
    if (e.enemy && isActive(e) && distSq(e.x, e.z, from.x, from.z) <= range * range) ids.push(e.id);
  }
  if (ids.length === 0) return null;
  return world.entities.get(ids[world.rng.combat.int(ids.length)]!) ?? null;
}

/** Cued Starfall: meteors fall inside your fields (around the Weaver if there are none). */
function randomEnemyInField(world: World): Entity | null {
  const ids = world.scratch.ids;
  ids.length = 0;
  const f = world.field;
  const anyField = f.chords.some((c) => c.anchor !== 'thread');
  const r = f.radius + 2;
  for (const e of world.entities.list()) {
    if (!e.enemy || !isActive(e)) continue;
    const inside = anyField ? inAnyField(world, e.x, e.z, 2) : distSq(e.x, e.z, f.x, f.z) <= r * r;
    if (inside) ids.push(e.id);
  }
  if (ids.length === 0) return null;
  return world.entities.get(ids[world.rng.combat.int(ids.length)]!) ?? null;
}
