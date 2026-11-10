/**
 * Phase 5g, W4: the Bond motifs' sim (docs/phase-5g.md, "Bond: heroes"; content in
 * `src/content/fill/bond.ts`). Each motif is hero-gated before any draw, so it changes only runs
 * with that hero; each hook below also checks its hero itself (by `hero.hero.defId`, or the
 * passive's state: `hero.blood`, `hero.duel`, `hero.grove`). Each runs only behind an early `if`
 * on its own field, at its call site.
 *
 * Six are hooks: Split Fletching (N11), Constellation Lines (N10b), Inner Orbit (N10), Edge of
 * the Red (N12), Cold Steel (N13), Graft (N14). The other six (Penitent Shield, Iron Answer,
 * Steady Draw, Bloodsong, Second Intention, Seed Vault) are triggers in their content, each with
 * its `hero` condition; the resolver knows them and sets nothing else.
 *
 * Damage a motif adds is the Weaver's (as Riposte Bloom's nova is): its whole amount goes into
 * `amplified`, so `ledger.amplified` (and the hero's `damageAmplified`) show it.
 *
 * The rules of `src/sim/fill/silk.ts`'s header hold here too: no RNG, state only in W0's optional
 * keys (never `undefined`), `bondMotifIds` returns an array literal, no edits to shared files.
 */
import { len } from '../core/dmath';
import { dealDamage, isActive, rising } from '../combat/health';
import type { Mods } from '../mods';
import type { Entity } from '../state';
import type { HeroHit } from '../systems/heroDamage';
import type { PendingHit, World } from '../world';
import { touchingThread } from './threadContact';

/** Edge of the Red counts while Brann is below this share of his life. */
const RED_BELOW = 0.3;
/** Split Fletching: how far behind its target the arrow flies on (metres). */
const PIERCE_REACH = 6;
/** Split Fletching: the arrow's half-width, added to each enemy's own radius (metres). */
const PIERCE_WIDTH = 0.5;

/** The Bond motif ids this file's resolver knows. Return an array literal. */
export function bondMotifIds(): readonly string[] {
  return [
    'penitent_shield',
    'iron_answer',
    'split_fletching',
    'steady_draw',
    'constellation_lines',
    'inner_orbit',
    'bloodsong',
    'edge_of_the_red',
    'cold_steel',
    'second_intention',
    'graft',
    'seed_vault',
  ];
}

/**
 * The resolver's cases for the Bond motifs (see `applySilkMotif`). Fields: `orbitCast` (Inner
 * Orbit, a share 0..1 faster), `constellationPct` (Constellation Lines, a share 0..1 of the
 * bolt), `pierce` (Split Fletching, a share 0..1), `redEdge` (Edge of the Red, a share 0..1
 * stronger), `counterBonus` (Cold Steel, a share 0..1 more), `graftMult` (Graft, × Rootbond's
 * share on the Saplings). Penitent Shield, Iron Answer, Steady Draw, Bloodsong, Second Intention
 * and Seed Vault are triggers: known here, with nothing to set. Return true when `id` is yours.
 */
export function applyBondMotif(m: Mods, id: string, v: number): boolean {
  const pct = v / 100;
  switch (id) {
    case 'split_fletching':
      m.pierce += pct;
      return true;
    case 'constellation_lines':
      m.constellationPct += pct;
      return true;
    case 'inner_orbit':
      m.orbitCast += pct;
      return true;
    case 'edge_of_the_red':
      m.redEdge += pct;
      return true;
    case 'cold_steel':
      m.counterBonus += pct;
      return true;
    case 'graft':
      m.graftMult *= 1 + pct;
      return true;
    // Triggers (their rules are in content).
    case 'penitent_shield':
    case 'iron_answer':
    case 'steady_draw':
    case 'bloodsong':
    case 'second_intention':
    case 'seed_vault':
      return true;
    default:
      return false;
  }
}

/**
 * N10, Inner Orbit: called in `startCast` (systems/heroes.ts) on every ability cast, after
 * Starlit Study and Overchannel, behind `if (world.mods.orbitCast > 0)`; returns the multiplier
 * on the cast time: 1 / (1 + `orbitCast`) for Vexis standing `inField`, else exactly 1.
 */
export function innerOrbitCast(world: World, hero: Entity): number {
  const h = hero.hero;
  if (h?.defId !== 'vexis' || !h.inField) return 1;
  return 1 / (1 + world.mods.orbitCast);
}

const touching: Entity[] = [];

/**
 * N10b, Constellation Lines: called in `executeAbility`'s Starbolt (systems/heroes.ts) right
 * after the bolt's pending hit is queued, behind `if (world.mods.constellationPct > 0)`. Every
 * enemy touching the Thread now (`touchingThread`), but the bolt's own target, is struck for
 * `constellationPct` of the bolt: a hit of Vexis's queued to land with it (no splash, chain or
 * stun), all of it the Weaver's. Draws nothing.
 */
export function constellationLines(world: World, vexis: Entity, bolt: PendingHit): void {
  if (vexis.hero?.defId !== 'vexis') return;
  const pct = world.mods.constellationPct;
  for (const enemy of touchingThread(world, touching)) {
    if (enemy.id === bolt.target) continue;
    const amount = bolt.amount * pct;
    world.internal.pendingHits.push({
      at: bolt.at,
      source: vexis.id,
      target: enemy.id,
      amount,
      amplified: amount,
      aura: bolt.aura * pct,
      empower: bolt.empower * pct,
      crit: bolt.crit,
      splashRadius: 0,
      splash: 0,
      chain: 0,
      empowered: bolt.empowered,
      stun: 0,
    });
    world.events.push({
      type: 'attackFired',
      tick: world.tick,
      source: vexis.id,
      target: enemy.id,
      visual: 'bolt',
      fromX: vexis.x,
      fromZ: vexis.z,
      toX: enemy.x,
      toZ: enemy.z,
      travel: Math.max(0, bolt.at - world.time),
    });
  }
  touching.length = 0;
}

/**
 * N11, Split Fletching: called in `land` (systems/hits.ts) once a pending hit has struck its
 * target (after splash and Ricochet), behind `if (world.mods.pierce > 0)`. Only Lyra's Empowered
 * arrows (her attack's and Gale Barrage's: no splash; Volley falls from above) fly on: the
 * nearest standing enemy behind `target` on the line from Lyra, within `PIERCE_REACH` m, takes
 * `pierce` of the hit, all of it the Weaver's. One arrow, one crit (as Ricochet's bounce).
 */
export function splitFletching(
  world: World,
  hit: PendingHit,
  target: Entity,
  source: Entity | undefined,
): void {
  if (source?.hero?.defId !== 'lyra' || !hit.empowered || hit.splashRadius > 0) return;
  const d = len(target.x - source.x, target.z - source.z);
  if (d < 1e-6) return;
  const dx = (target.x - source.x) / d;
  const dz = (target.z - source.z) / d;
  let next: Entity | null = null;
  let best = Infinity;
  for (const e of world.entities.list()) {
    if (e.id === target.id || !e.enemy || !isActive(e) || rising(e)) continue;
    const rx = e.x - target.x;
    const rz = e.z - target.z;
    const along = rx * dx + rz * dz;
    if (along <= 0 || along > PIERCE_REACH + e.radius) continue;
    if (Math.abs(rx * dz - rz * dx) > PIERCE_WIDTH + e.radius) continue;
    if (along < best) {
      best = along;
      next = e;
    }
  }
  if (!next) return;
  const pct = world.mods.pierce;
  const amount = hit.amount * pct;
  world.events.push({
    type: 'attackFired',
    tick: world.tick,
    source: hit.source,
    target: next.id,
    visual: 'arrow',
    fromX: target.x,
    fromZ: target.z,
    toX: next.x,
    toZ: next.z,
    travel: 0,
  });
  dealDamage(world, next, {
    source: hit.source,
    sourceName: 'Split Fletching',
    amount,
    amplified: amount,
    aura: hit.aura * pct,
    empower: hit.empower * pct,
    crit: false,
    empowered: true,
    ...(hit.cuePower !== undefined ? { cuePower: hit.cuePower } : {}),
  });
}

/**
 * N12, Edge of the Red: called in `empowerBonus` (systems/thread.ts) behind
 * `if (world.mods.redEdge > 0)`; returns the multiplier on Empower's `more` for `hero`: 1 +
 * `redEdge` while the hero has Blood Rage (`hero.hero.blood`, Brann) and is below 30% of his
 * life, else exactly 1.
 */
export function edgeOfTheRedMult(world: World, hero: Entity): number {
  const h = hero.health;
  if (!hero.hero?.blood || !h || h.dead || h.downed) return 1;
  return h.hp < h.maxHp * RED_BELOW ? 1 + world.mods.redEdge : 1;
}

/**
 * N13, Cold Steel: called in Seren's parry `counter` (systems/duel.ts) right after the counter's
 * hit is rolled, behind `if (world.mods.counterBonus > 0)`; `hit` is the counter's (mutable;
 * Bladesong's cuts share it). Raises it by `counterBonus`; the extra is the Weaver's, so it is
 * added to `amplified` too.
 */
export function coldSteel(world: World, seren: Entity, hit: HeroHit): void {
  if (!seren.hero?.duel) return;
  const extra = hit.amount * world.mods.counterBonus;
  hit.amount += extra;
  hit.amplified += extra;
}

/**
 * N14, Graft: called in `rootbond` (systems/grove.ts) on Rootbond's share of Mend for each of
 * Oro's summons, behind `if (world.mods.graftMult !== 1)`; returns the share × `graftMult`.
 * Rootbond heals as Mend, so the extra shows in `ledger.healing`, `ledger.thread.healing` and
 * `ledger.grove.rootbondHeal`.
 */
export function graftShare(world: World, oro: Entity, share: number): number {
  if (!oro.hero?.grove) return share;
  return share * world.mods.graftMult;
}
