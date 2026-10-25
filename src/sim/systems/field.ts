/**
 * The aura fields (docs/plan/03 §3–§4, docs/phase-3.md). Each Chord's auras reserve Spirit.
 * Chord I, the **beam song**, rides the Thread: the threaded hero hears it at focus strength
 * wherever they are (its hexes hit whatever attacks that hero), and everyone else in its field
 * hears an echo. Chord II, the **field song**, covers everyone in its field at full strength.
 * A field sits around the Weaver or where Pedal Point planted it. Mutes crack every field
 * inside their dome and silence the Weaver entirely if the Weaver stands in one; during the
 * Silent Verse only the hymn circles carry the song.
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

/** Set by `coverage` for the entity it just looked at: the beam song pours into it. */
let focused = false;
/** Set by `coverage`: it stands inside a song's field (not just on the beam). */
let inRadius = false;

/**
 * Which auras cover `e` right now (party buffs for heroes and the Weaver, hexes for enemies).
 * Also sets `focused` (`e` is the threaded hero, or an enemy attacking them, and the beam song
 * has something for its side) and `inRadius` (`e` stands inside a field that does).
 */
function coverage(world: World, e: Entity, side: 'party' | 'enemy'): number {
  focused = false;
  inRadius = false;
  if (world.field.suppressed || inDome(e) || !inHymn(world, e)) return 0;
  const sideMask = side === 'party' ? partyAuraMask(world.content) : enemyAuraMask(world.content);
  let mask = 0;
  for (const chord of world.field.chords) {
    // A song with nothing for this side (or no auras at all) covers nobody here.
    const song = chordMask(world, chord) & sideMask;
    if (song === 0) continue;
    const r = chord.radius + e.radius;
    const inside = chord.radius > 0 && distSq(e.x, e.z, chord.x, chord.z) <= r * r;
    const focus =
      chord.role === 'beam' &&
      chord.threadHero !== null &&
      (side === 'party' ? e.id === chord.threadHero : e.enemy?.targetId === chord.threadHero);
    if (focus) focused = true;
    if (inside) inRadius = true;
    if (focus || inside) mask |= song;
  }
  return mask;
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
  // Eclipse (the Luminary) takes Sunrise farther.
  const radiusMult = f.crescendo
    ? (world.mods.crescendoRadiusMult ?? content.crescendo.radiusMult)
    : 1;
  const effectMult = f.crescendo ? content.crescendo.auraEffectMult : 1;
  // Sovereign Symphony (the Luminary): enough auras across the songs make every one stronger.
  const sovereign = world.calling?.sovereign ? world.mods.sovereignMult : 1;
  const thread = threadedHero(world, weaver);
  const mult = world.scratch.auraMult;
  const focus = world.scratch.auraFocus;
  const echo = world.scratch.auraEcho;
  mult.fill(0);
  focus.fill(1);
  echo.fill(1);
  let weaverRadius = 0;
  for (let i = 0; i < f.chords.length; i++) {
    const chord = f.chords[i]!;
    const def = world.loadout[i]!;
    const singing = chord.auras.length > 0;
    chord.threadHero = chord.role === 'beam' && singing ? thread : null;
    if (chord.anchor === 'weaver') {
      chord.x = weaver.x;
      chord.z = weaver.z;
    }
    // An empty song, or a beam song without an echo (Unison), has no field at all.
    // The Luminary's field song reaches farther (still within the cap).
    const reach = chord.role === 'field' ? world.mods.fieldSongRadiusMult : 1;
    chord.radius =
      singing && chord.echo > 0
        ? Math.min(content.weaver.fieldRadiusCap, base * def.radiusMult * reach) * radiusMult
        : 0;
    if (chord.anchor === 'weaver') weaverRadius = Math.max(weaverRadius, chord.radius);
    for (const id of chord.auras) {
      const index = content.auras.findIndex((a) => a.id === id);
      if (index < 0) continue;
      // Lantern Bearer (the Luminary): a planted field sings stronger. On a planted beam song
      // that's its echo: the beam's pour into the threaded hero isn't a field.
      const planted = chord.anchor === 'planted' ? world.mods.plantedEffectMult : 1;
      const beam = chord.role === 'beam';
      mult[index] = chord.effectMult * effectMult * (beam ? 1 : planted) * sovereign;
      focus[index] = chord.focus;
      echo[index] = chord.echo * (beam ? planted : 1);
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
    const wasIn = hero.hero.inField;
    hero.hero.auraMask = mask;
    hero.hero.beamFocus = mask !== 0 && focused;
    // Standing in a field: the beam alone (a threaded hero far away) doesn't count.
    hero.hero.inField = mask !== 0 && inRadius;
    if (!wasIn && hero.hero.inField) dawnward(world, hero, mask);
    applyAuraLife(world, hero, auraTotals(world, mask, hero.hero.beamFocus), dt, flush, refill);
  }
  // The Weaver hears their own songs too (the beam song only as its echo).
  const weaverMask = weaver.health!.downed ? 0 : coverage(world, weaver, 'party');
  applyAuraLife(world, weaver, auraTotals(world, weaverMask), dt, flush, refill);

  for (const e of world.entities.list()) {
    if (!e.enemy || !e.health || e.health.dead) continue;
    const mask = coverage(world, e, 'enemy');
    e.enemy.auraMask = mask;
    e.enemy.beamFocus = mask !== 0 && focused;
    // Inside the light, whatever the songs hold for enemies (Eclipse reads it).
    e.enemy.inField =
      !f.suppressed && !inDome(e) && inHymn(world, e) && inAnyField(world, e.x, e.z, e.radius);
  }
}

/**
 * Dawnward (the Luminary): a hero stepping into a field is shielded by the light, a share of
 * their life for every aura they now hear, once every few seconds each. Their own overshield
 * (an uncued Aegis Wall), or a bigger one, is left alone.
 */
function dawnward(world: World, hero: Entity, mask: number): void {
  const pct = world.mods.dawnwardPct;
  const h = hero.hero!;
  const health = hero.health!;
  if (pct <= 0 || world.time < h.dawnwardAt || health.dead || health.downed) return;
  let auras = 0;
  for (let m = mask; m !== 0; m &= m - 1) auras++;
  const amount = health.maxHp * pct * auras;
  const existing = shieldOf(health, 'overshield');
  if (amount <= 0 || (existing && (!existing.fromWeaver || existing.amount >= amount))) return;
  addShield(world, hero, 'overshield', amount, world.mods.dawnwardDuration, true);
  h.dawnwardAt = world.time + world.mods.dawnwardCooldown;
  world.events.push({ type: 'dawnward', tick: world.tick, hero: hero.id, amount });
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
  if (!barrier) addShield(world, e, 'barrier', max, NEVER, true, true);
  else if (barrier.amount < max - 0.5 || barrier.max !== max) {
    barrier.amount = max;
    barrier.max = max;
  }
}

/** Any Chord field (not a beam song without an echo) containing (x, z) widened by `pad`. */
export function inAnyField(world: World, x: number, z: number, pad: number): boolean {
  for (const c of world.field.chords) {
    if (c.radius <= 0) continue;
    const r = c.radius + pad;
    if (distSq(x, z, c.x, c.z) <= r * r) return true;
  }
  return false;
}
