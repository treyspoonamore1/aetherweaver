/**
 * Phase 5g, W1: the Choir motifs' sim (docs/phase-5g.md, "Choir: the field, outside the auras";
 * content in `src/content/fill/choir.ts`). None changes an aura's strength, reach, reservation or
 * who it reaches (decision 2): they read `hero.inField` and how many auras the songs carry
 * (`world.field.auras`), and write nothing the aura code reads. W0 placed every call site; the
 * bodies are here. Each hook runs only behind an early `if` on its own `Mods` field. Massed Voices
 * and Long Phrase set existing fields.
 *
 * The rules of `src/sim/fill/silk.ts`'s header hold here too: no RNG, state only in W0's optional
 * keys (never `undefined`), `choirMotifIds` returns an array literal, no edits to shared files.
 */
import { isActive } from '../combat/health';
import type { DamageOpts } from '../combat/health';
import type { Mods } from '../mods';
import type { Entity, WorldState } from '../state';
import type { World } from '../world';

/** Float slack for sim-time comparisons (sim time is a sum of tick lengths). */
const EPS = 1e-9;
/** Close Harmony: this many standing heroes in your field. */
export const HUDDLE_HEROES = 3;
/** Breath Between: seconds without a technique before the next one is cheaper. */
export const REST_SECONDS = 4;

/** The Choir motif ids this file's resolver knows. Return an array literal. */
export function choirMotifIds(): readonly string[] {
  return ['massed_voices', 'close_harmony', 'breath_between', 'full_chord', 'long_phrase'];
}

/**
 * The resolver's cases for the Choir motifs (see `applySilkMotif`). Fields: `huddleRegen` (Close
 * Harmony, a share 0..1 more Spirit regen), `restDiscount` (Breath Between, a share 0..1 off),
 * `perAuraGuard` (Full Chord, a share 0..1 an aura); existing `inFieldDamage` (Massed Voices,
 * adds to the Astrolabe's Anthem) and `spiritMult` (Long Phrase, multiplies). Each accumulates.
 * Returns true when `id` is a Choir motif.
 */
export function applyChoirMotif(m: Mods, id: string, v: number): boolean {
  const pct = v / 100;
  switch (id) {
    case 'massed_voices':
      m.inFieldDamage += pct;
      return true;
    case 'close_harmony':
      m.huddleRegen += pct;
      return true;
    case 'breath_between':
      m.restDiscount += pct;
      return true;
    case 'full_chord':
      m.perAuraGuard += pct;
      return true;
    case 'long_phrase':
      m.spiritMult *= 1 + pct;
      return true;
    default:
      return false;
  }
}

/** Standing heroes in the Weaver's field (`hero.inField`, read only). */
function heroesInField(world: World): number {
  let n = 0;
  for (const id of world.party) {
    const e = world.entities.get(id);
    if (e?.hero && isActive(e) && e.hero.inField) n++;
  }
  return n;
}

/**
 * N7, Close Harmony: called in `updateWeaver` (systems/weaver.ts) right after the Spirit regen,
 * behind `if (world.mods.huddleRegen > 0)`. While `HUDDLE_HEROES` or more standing heroes are
 * `inField` and the Weaver stands, the regen runs `huddleRegen` faster: the same rate as the
 * regen line (`free × spiritRegenPct × spiritRegenMult`, so Deep Breath multiplies it too) times
 * `huddleRegen`, never above the unreserved pool (`maxSpirit - reservedSpirit`).
 */
export function closeHarmonyRegen(world: World, weaver: Entity, dt: number): void {
  const w = weaver.weaver;
  if (!w || weaver.health?.downed) return;
  const free = w.maxSpirit - w.reservedSpirit;
  if (w.spirit >= free) return;
  if (heroesInField(world) < HUDDLE_HEROES) return;
  const rate = free * world.content.weaver.spiritRegenPct * world.mods.spiritRegenMult;
  w.spirit = Math.min(free, w.spirit + rate * world.mods.huddleRegen * dt);
}

/**
 * N8, Breath Between (the price): called in `paidCost` (systems/techniques.ts), what a cast
 * really costs, and in `techniqueCost` (sim/astrolabe.ts), what the HUD and bots show, behind
 * `if (state.mods.restDiscount > 0)`; returns the cost after the discount: `restDiscount` off when
 * `REST_SECONDS` have passed since the Weaver's last technique (`weaver.lastCastAt`), or, before
 * her first, since the fight began (sim time 0). Never below 0.
 */
export function restCost(state: WorldState, cost: number): number {
  const w = state.entities.get(state.weaverId)?.weaver;
  if (!w) return cost;
  const since = state.time - (w.lastCastAt ?? 0);
  if (since + EPS < REST_SECONDS) return cost;
  return cost * Math.max(0, 1 - state.mods.restDiscount);
}

/**
 * N8, Breath Between (the clock): called in `spend` (systems/techniques.ts) once a technique is
 * paid for, behind `if (world.mods.restDiscount > 0)`. Sets `weaver.lastCastAt` to now.
 */
export function restCast(world: World, weaver: Entity): void {
  if (weaver.weaver) weaver.weaver.lastCastAt = world.time;
}

/**
 * How many auras the songs carry, as the chorus pulse counts them (systems/techniques.ts
 * `chorusPulse`): every Chord's, a stolen verse (docs/phase-5c.md) one fewer, none while the
 * field is suppressed. Read only.
 */
export function aurasInSongs(world: World): number {
  const f = world.field;
  if (f.suppressed) return 0;
  return Math.max(0, f.stolen ? f.auras.length - 1 : f.auras.length);
}

/**
 * N9, Full Chord: called in `dealDamage` (combat/health.ts), beside Haloed and Close Ranks, on a
 * hit to a hero, behind `if (target.hero && world.mods.perAuraGuard > 0)`; returns the damage it
 * takes off `amount`: `perAuraGuard × aurasInSongs` of it (at most all of it), for a standing hero
 * `inField`, on any hit. What it takes off is credited to `ledger.shielded`, as Haloed's and Close
 * Ranks' guards are, capped at the life the hero has (it never credits life they didn't hold).
 */
export function fullChordGuard(
  world: World,
  target: Entity,
  amount: number,
  _opts: DamageOpts,
): number {
  if (!target.hero?.inField || !isActive(target) || !(amount > 0)) return 0;
  const auras = aurasInSongs(world);
  if (auras === 0) return 0;
  const removed = amount * Math.min(1, world.mods.perAuraGuard * auras);
  world.ledger.shielded += Math.min(removed, target.health.hp);
  return removed;
}
