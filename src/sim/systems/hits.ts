/** Hits in flight (arrows, bolts, meteors, Volley) land when their time comes. */
import { enemyDef, heroDef } from '../../content';
import { distSq, segmentsCross } from '../core/dmath';
import {
  addStatus,
  applyOnHit,
  applyStatusPayload,
  dealDamage,
  isActive,
  rising,
} from '../combat/health';
import { threadSegment } from '../rules3';
import type { Entity } from '../state';
import { weaverOf, type PendingHit, type World } from '../world';
import { guardStrandReady, severingHit, spendGuardStrand } from './thread';

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
  // Guard Strand (docs/phase-5c.md): an enemy bolt crossing the Thread is destroyed.
  if (world.mods.guardStrand > 0 && source?.enemy && strandBlocks(world, source, target)) return;
  const x = target.x;
  const z = target.z;
  strike(world, target, hit, 1, sourceName, source);
  if (hit.splashRadius > 0 && hit.splash > 0) {
    for (const e of world.entities.list()) {
      if (e.id === target.id || e.team !== target.team || !isActive(e)) continue;
      // Splash never strikes Oro's summons (docs/phase-5e.md: Saplings soak blows, not shapes).
      if (e.summon) continue;
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
        // Nor does a chain (docs/phase-5e.md).
        if (e.summon) continue;
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
    // The Conductor (docs/phase-5f.md): the power of the Solo that loosed it, splash and chain too.
    ...(hit.cuePower !== undefined ? { cuePower: hit.cuePower } : {}),
  });
  if (hit.stun > 0 && isActive(e)) addStatus(world, e, 'stun', hit.stun, hit.source);
  // On-hit payloads (docs/phase-5a.md P3): the bolt's own and its caster's affixes'. Only an
  // enemy's bolt carries any; a Ward that takes it all blocks them.
  if (source?.enemy) {
    applyOnHit(world, source, e, result.dealt, hit.onHit);
    // Severing (docs/phase-5c.md): a bolt it lands near the Thread cuts it. Only an elite with
    // a cutting affix reads anything here. A blow on a summon never cuts (docs/phase-5e.md).
    if (source.enemy.affixes.length > 0 && result.dealt + result.absorbed > 0 && !e.summon)
      severingHit(world, source);
    // Oathkeeper (Bonds): Kael took the hit, and what it carries (as a telegraph's).
    const kael = result.takenBy === undefined ? undefined : world.entities.get(result.takenBy);
    if (kael) applyOnHit(world, source, kael, result.takenDealt ?? 0, hit.onHit);
  } else if (hit.onHit && result.dealt > 0 && isActive(e))
    applyStatusPayload(world, e, hit.onHit, hit.source);
}

/**
 * Guard Strand (docs/phase-5c.md, Q15): the bolt's path, from its living source where it stands
 * now to its target, crosses the Thread, and Guard Strand is ready. A bolt at the Weaver or the
 * threaded hero only meets the Thread at its end, so it never counts. Spends the cooldown and
 * reports `strandBlocked` at the crossing.
 */
function strandBlocks(world: World, source: Entity, target: Entity): boolean {
  if (!isActive(source) || !guardStrandReady(world)) return false;
  const seg = threadSegment(world);
  if (!seg) return false;
  const threaded = world.party[weaverOf(world).weaver!.threadSlot!];
  if (target.id === world.weaverId || target.id === threaded) return false;
  if (!segmentsCross(source.x, source.z, target.x, target.z, seg.ax, seg.az, seg.bx, seg.bz))
    return false;
  spendGuardStrand(world);
  const at = crossing(source.x, source.z, target.x, target.z, seg.ax, seg.az, seg.bx, seg.bz);
  world.events.push({ type: 'strandBlocked', tick: world.tick, source: source.id, ...at });
  return true;
}

/** Where the segments p→q and a→b meet (they are known to); the midpoint of p→q if parallel. */
function crossing(
  px: number,
  pz: number,
  qx: number,
  qz: number,
  ax: number,
  az: number,
  bx: number,
  bz: number,
): { x: number; z: number } {
  const rx = qx - px;
  const rz = qz - pz;
  const sx = bx - ax;
  const sz = bz - az;
  const den = rx * sz - rz * sx;
  if (den === 0) return { x: (px + qx) / 2, z: (pz + qz) / 2 };
  const t = ((ax - px) * sz - (az - pz) * sx) / den;
  return { x: px + rx * t, z: pz + rz * t };
}

function sourceNameOf(e: Entity | undefined): string {
  if (!e) return 'Unknown';
  if (e.enemy) return enemyDef(e.enemy.defId).name;
  if (e.hero) return heroDef(e.hero.defId).name;
  return e.kind;
}
