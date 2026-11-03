/** Hits in flight (arrows, bolts, meteors, Volley) land when their time comes. */
import { enemyDef, heroDef } from '../../content';
import { distSq } from '../core/dmath';
import {
  addStatus,
  applyOnHit,
  applyStatusPayload,
  dealDamage,
  isActive,
  rising,
} from '../combat/health';
import type { Entity } from '../state';
import type { PendingHit, World } from '../world';

const CHAIN_RADIUS = 4;
const CHAIN_FALLOFF = 0.6;

export function updatePendingHits(world: World): void {
  const hits = world.internal.pendingHits;
  if (hits.length === 0) return;
  for (let i = 0; i < hits.length;) {
    const hit = hits[i]!;
    if (hit.at > world.time + 1e-9) {
      i++;
      continue;
    }
    hits.splice(i, 1);
    land(world, hit);
  }
}

function land(world: World, hit: PendingHit): void {
  const target = world.entities.get(hit.target);
  const source = world.entities.get(hit.source);
  const sourceName = sourceNameOf(source);
  if (!isActive(target)) return;
  const x = target.x;
  const z = target.z;
  strike(world, target, hit, 1, sourceName, source);
  if (hit.splashRadius > 0 && hit.splash > 0) {
    for (const e of world.entities.list()) {
      if (e.id === target.id || e.team !== target.team || !isActive(e)) continue;
      if (distSq(e.x, e.z, x, z) > (hit.splashRadius + e.radius) * (hit.splashRadius + e.radius))
        continue;
      strike(world, e, hit, hit.splash, sourceName, source);
    }
  }
  // Ricochet (Bonds): Lyra's arrow bounces once, to another enemy inside your field.
  if (hit.bounce) bounce(world, hit, target, x, z, sourceName, source);
  if (hit.chain > 0) {
    let from: Entity = target;
    const struck = new Set<number>([target.id]);
    let scale = 1;
    for (let c = 0; c < hit.chain; c++) {
      let next: Entity | null = null;
      let best = CHAIN_RADIUS * CHAIN_RADIUS;
      for (const e of world.entities.list()) {
        if (struck.has(e.id) || e.team !== target.team || !isActive(e)) continue;
        const d = distSq(e.x, e.z, from.x, from.z);
        if (d < best) {
          best = d;
          next = e;
        }
      }
      if (!next) break;
      scale *= CHAIN_FALLOFF;
      struck.add(next.id);
      world.events.push({
        type: 'attackFired',
        tick: world.tick,
        source: hit.source,
        target: next.id,
        visual: 'bolt',
        fromX: from.x,
        fromZ: from.z,
        toX: next.x,
        toZ: next.z,
        travel: 0,
      });
      strike(world, next, hit, scale, sourceName, source);
      from = next;
    }
  }
}

const BOUNCE_RANGE = 8;

function bounce(
  world: World,
  hit: PendingHit,
  from: Entity,
  x: number,
  z: number,
  sourceName: string,
  source: Entity | undefined,
): void {
  let next: Entity | null = null;
  let best = BOUNCE_RANGE * BOUNCE_RANGE;
  for (const e of world.entities.list()) {
    if (e.id === from.id || !e.enemy?.inField || !isActive(e) || rising(e)) continue;
    const d = distSq(e.x, e.z, x, z);
    if (d < best) {
      best = d;
      next = e;
    }
  }
  if (!next) return;
  world.events.push({
    type: 'attackFired',
    tick: world.tick,
    source: hit.source,
    target: next.id,
    visual: 'arrow',
    fromX: x,
    fromZ: z,
    toX: next.x,
    toZ: next.z,
    travel: 0,
  });
  // One arrow, one crit: the bounce doesn't ring Hawk Eye again.
  strike(world, next, { ...hit, crit: false }, hit.bounce!, sourceName, source);
}

/** Lands `scale` × the hit on `e` (splash and chain falloff scale every share alike). */
function strike(
  world: World,
  e: Entity,
  hit: PendingHit,
  scale: number,
  sourceName: string,
  source: Entity | undefined,
): void {
  const result = dealDamage(world, e, {
    source: hit.source,
    sourceName,
    amount: hit.amount * scale,
    amplified: hit.amplified * scale,
    aura: hit.aura * scale,
    empower: hit.empower * scale,
    crit: hit.crit,
    empowered: hit.empowered,
  });
  if (hit.stun > 0 && isActive(e)) addStatus(world, e, 'stun', hit.stun, hit.source);
  // On-hit payloads (docs/phase-5a.md P3): the bolt's own and its caster's affixes'. Only an
  // enemy's bolt carries any; a Ward that takes it all blocks them.
  if (source?.enemy) applyOnHit(world, source, e, result.dealt, hit.onHit);
  else if (hit.onHit && result.dealt > 0 && isActive(e))
    applyStatusPayload(world, e, hit.onHit, hit.source);
}

function sourceNameOf(e: Entity | undefined): string {
  if (!e) return 'Unknown';
  if (e.enemy) return enemyDef(e.enemy.defId).name;
  if (e.hero) return heroDef(e.hero.defId).name;
  return e.kind;
}
