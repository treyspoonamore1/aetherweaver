/**
 * The aura fields (docs/plan/03 §3–§4). Each Chord's auras reserve Spirit and affect whoever
 * stands in that Chord's field: around the Weaver, where Pedal Point planted it, or — with
 * Unison — on the threaded hero alone (Unison hexes hit whatever attacks that hero). Mutes
 * crack every field inside their dome and silence the Weaver entirely if the Weaver stands in
 * one; during the Silent Verse only the hymn circles carry the song.
 */
import { enemyDef } from '../../content';
import type { Vec2 } from '../commands';
import { distSq, len } from '../core/dmath';
import {
  auraBit,
  auraTotals,
  enemyAuraMask,
  invalidateAuraTotals,
  partyAuraMask,
  type AuraTotals,
} from '../combat/auras';
import { addShield, heal, isActive, removeShield, shieldOf, NEVER } from '../combat/health';
import type { ChordField, Entity, EntityId } from '../state';
import { weaverOf, type World } from '../world';
import { reject } from './techniques';

const AURA_FLUSH_TICKS = 60;

/** Mute domes this tick: x, z, r triples (reused, no per-tick allocation). */
const domes: number[] = [];

function collectDomes(world: World): void {
  domes.length = 0;
  for (const m of world.entities.list()) {
    if (!m.enemy || m.health?.dead) continue;
    const r = enemyDef(m.enemy.defId).suppressRadius;
    if (r > 0) domes.push(m.x, m.z, r);
  }
}

function inDome(e: Entity): boolean {
  for (let i = 0; i < domes.length; i += 3) {
    const r = domes[i + 2]!;
    if (distSq(e.x, e.z, domes[i]!, domes[i + 1]!) <= r * r) return true;
  }
  return false;
}

function inHymn(world: World, e: Entity): boolean {
  const circles = world.field.hymnCircles;
  if (circles.length === 0) return true;
  for (const c of circles) {
    if (distSq(e.x, e.z, c.x, c.z) <= (c.r + e.radius) * (c.r + e.radius)) return true;
  }
  return false;
}

function chordMask(world: World, chord: ChordField): number {
  let mask = 0;
  for (const id of chord.auras) mask |= auraBit(world.content, id);
  return mask;
}

/** Which auras cover `e` right now (party buffs for heroes and the Weaver, hexes for enemies). */
function coverage(world: World, e: Entity, side: 'party' | 'enemy'): number {
  if (world.field.suppressed || inDome(e) || !inHymn(world, e)) return 0;
  const sideMask = side === 'party' ? partyAuraMask(world.content) : enemyAuraMask(world.content);
  let mask = 0;
  for (const chord of world.field.chords) {
    let covered: boolean;
    if (chord.anchor === 'thread') {
      covered =
        chord.threadHero !== null &&
        (side === 'party' ? e.id === chord.threadHero : e.enemy?.targetId === chord.threadHero);
    } else {
      const r = chord.radius + e.radius;
      covered = distSq(e.x, e.z, chord.x, chord.z) <= r * r;
    }
    if (covered) mask |= chordMask(world, chord);
  }
  return mask & sideMask;
}

function threadedHero(world: World, weaver: Entity): EntityId | null {
  const w = weaver.weaver!;
  if (w.threadSlot === null || weaver.health!.downed) return null;
  const id = world.party[w.threadSlot];
  const hero = id === undefined ? undefined : world.entities.get(id);
  return isActive(hero) ? hero.id : null;
}

export function updateField(world: World, dt: number): void {
  const weaver = weaverOf(world);
  const w = weaver.weaver!;
  const f = world.field;
  const content = world.content;
  if (w.plantCooldown > 0) w.plantCooldown = Math.max(0, w.plantCooldown - dt);
  f.x = weaver.x;
  f.z = weaver.z;

  collectDomes(world);
  f.suppressed = world.config.absent || weaver.health!.downed || inDome(weaver);

  const base = Math.min(
    content.weaver.fieldRadiusCap,
    content.weaver.fieldRadius * world.mods.fieldRadiusMult,
  );
  const radiusMult = f.crescendo ? content.crescendo.radiusMult : 1;
  const effectMult = f.crescendo ? content.crescendo.auraEffectMult : 1;
  const thread = threadedHero(world, weaver);
  const mult = world.scratch.auraMult;
  mult.fill(0);
  let weaverRadius = 0;
  for (let i = 0; i < f.chords.length; i++) {
    const chord = f.chords[i]!;
    const def = world.loadout[i]!;
    if (chord.anchor === 'thread') {
      chord.threadHero = thread;
      const hero = thread === null ? undefined : world.entities.get(thread);
      chord.x = hero?.x ?? weaver.x;
      chord.z = hero?.z ?? weaver.z;
      chord.radius = 0;
    } else {
      if (chord.anchor === 'weaver') {
        chord.x = weaver.x;
        chord.z = weaver.z;
      }
      chord.radius = Math.min(content.weaver.fieldRadiusCap, base * def.radiusMult) * radiusMult;
      if (chord.anchor === 'weaver') weaverRadius = Math.max(weaverRadius, chord.radius);
    }
    for (const id of chord.auras) {
      const index = content.auras.findIndex((a) => a.id === id);
      if (index >= 0) mult[index] = chord.effectMult * effectMult;
    }
  }
  f.radius = weaverRadius > 0 ? weaverRadius : base * radiusMult;
  invalidateAuraTotals(world);

  const flush = world.tick % AURA_FLUSH_TICKS === 0;
  const refill = Math.max(0.5, 3 - world.mods.ostinatoRefillCut);
  for (const id of world.party) {
    const hero = world.entities.get(id);
    if (!hero?.hero || !hero.health) continue;
    const mask = !hero.health.dead && !hero.health.downed ? coverage(world, hero, 'party') : 0;
    hero.hero.auraMask = mask;
    hero.hero.inField = mask !== 0;
    applyAuraLife(world, hero, auraTotals(world, mask), dt, flush, refill);
  }
  // The Weaver hears their own song too (never a Unison Chord: that rides the Thread).
  const weaverMask = weaver.health!.downed ? 0 : coverage(world, weaver, 'party');
  applyAuraLife(world, weaver, auraTotals(world, weaverMask), dt, flush, refill);

  for (const e of world.entities.list()) {
    if (!e.enemy || !e.health || e.health.dead) continue;
    const mask = coverage(world, e, 'enemy');
    e.enemy.auraMask = mask;
    e.enemy.inField = mask !== 0;
  }
}

/** Pedal Point: plant the planted Chord's field at `point` (pulled in to the planting range). */
export function plantField(world: World, point: Vec2): void {
  const weaver = weaverOf(world);
  const w = weaver.weaver!;
  if (weaver.health!.downed) return reject(world, 'plant', 'down');
  const status = world.encounter.status;
  if (status === 'victory' || status === 'defeat') return;
  const chord = world.field.chords.find((c) => c.anchor === 'planted');
  if (!chord) return reject(world, 'plant', 'not-ready');
  if (w.plantCooldown > 0) return reject(world, 'plant', 'cooldown');
  const range = world.content.weaver.plantRange;
  let x = point.x;
  let z = point.z;
  const dx = x - weaver.x;
  const dz = z - weaver.z;
  const d = len(dx, dz);
  if (d > range) {
    x = weaver.x + (dx / d) * range;
    z = weaver.z + (dz / d) * range;
  }
  const edge = world.arenaRadius - 1;
  const r = len(x, z);
  if (r > edge) {
    x = (x / r) * edge;
    z = (z / r) * edge;
  }
  world.events.push({
    type: 'fieldPlanted',
    tick: world.tick,
    chord: chord.index,
    fromX: chord.x,
    fromZ: chord.z,
    x,
    z,
  });
  chord.x = x;
  chord.z = z;
  w.plantCooldown = world.content.weaver.plantCooldown;
}

function applyAuraLife(
  world: World,
  e: Entity,
  fx: Readonly<AuraTotals>,
  dt: number,
  flush: boolean,
  refill: number,
): void {
  const h = e.health!;
  if (fx.regenPctPerSec > 0 && h.hp < h.maxHp && !h.downed && !h.dead) {
    const healed = heal(world, e, h.maxHp * fx.regenPctPerSec * dt, 'aura', false);
    if (e.hero) e.hero.auraHealAcc += healed;
  }
  if (flush && e.hero && e.hero.auraHealAcc > 0.5) {
    world.events.push({
      type: 'healApplied',
      tick: world.tick,
      target: e.id,
      source: world.weaverId,
      amount: e.hero.auraHealAcc,
      overheal: 0,
      via: 'aura',
    });
    e.hero.auraHealAcc = 0;
  }
  const barrier = shieldOf(h, 'barrier');
  if (fx.barrierPct <= 0) {
    if (barrier) removeShield(world, e, 'barrier', false);
    return;
  }
  const max = h.maxHp * fx.barrierPct;
  if (world.time - h.lastHitAt < refill) return;
  if (!barrier) addShield(world, e, 'barrier', max, NEVER, true);
  else if (barrier.amount < max - 0.5 || barrier.max !== max) {
    barrier.amount = max;
    barrier.max = max;
  }
}

/** Any Chord field (not Unison) that contains (x, z) widened by `pad`, for targeting. */
export function inAnyField(world: World, x: number, z: number, pad: number): boolean {
  for (const c of world.field.chords) {
    if (c.anchor === 'thread') continue;
    const r = c.radius + pad;
    if (distSq(x, z, c.x, c.z) <= r * r) return true;
  }
  return false;
}
