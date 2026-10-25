/**
 * Aura effects by coverage mask (docs/plan/03 §3). The field system decides each tick which
 * auras cover whom (a bit per content aura on every hero and enemy) and how strong each aura is
 * right now (ornaments × Crescendo). Everything that reads an aura's effect goes through here.
 */
import type { Content } from '../../content/schema';
import type { Entity } from '../state';
import type { World } from '../world';

export interface AuraTotals {
  // On the party
  regenPctPerSec: number;
  barrierPct: number;
  attackSpeed: number;
  moveSpeed: number;
  damage: number;
  flatDamage: number;
  /** Fermata: below this fraction of max HP, take `guardDr` less damage. */
  guardBelow: number;
  guardDr: number;
  /** Fermata: seconds a lethal hit is held (0 = no Fermata). */
  holdTime: number;
  // On enemies (hexes)
  enemySlow: number;
  enemyWindup: number;
}

export const NO_AURAS: Readonly<AuraTotals> = Object.freeze({
  regenPctPerSec: 0,
  barrierPct: 0,
  attackSpeed: 0,
  moveSpeed: 0,
  damage: 0,
  flatDamage: 0,
  guardBelow: 0,
  guardDr: 0,
  holdTime: 0,
  enemySlow: 0,
  enemyWindup: 0,
});

const MAX_SLOW = 0.6;
const MAX_GUARD = 0.6;

interface AuraTable {
  bit: Map<string, number>;
  /** Mask of auras with any effect on the party / on enemies. */
  partyMask: number;
  enemyMask: number;
}

const tables = new WeakMap<Content, AuraTable>();

function table(content: Content): AuraTable {
  let t = tables.get(content);
  if (!t) {
    const bit = new Map<string, number>();
    let partyMask = 0;
    let enemyMask = 0;
    content.auras.forEach((a, i) => {
      const b = 1 << i;
      bit.set(a.id, b);
      const fx = a.effects;
      if (
        fx.regenPctPerSec + fx.barrierPct + fx.attackSpeed + fx.moveSpeed + fx.damage > 0 ||
        fx.flatDamage + fx.guardDr + fx.holdTime > 0
      )
        partyMask |= b;
      if (fx.enemySlow + fx.enemyWindup > 0) enemyMask |= b;
    });
    t = { bit, partyMask, enemyMask };
    tables.set(content, t);
  }
  return t;
}

/** The mask bit for an aura id (0 if unknown). */
export function auraBit(content: Content, id: string): number {
  return table(content).bit.get(id) ?? 0;
}

/** Auras that affect the party (buffs) and enemies (hexes). */
export function partyAuraMask(content: Content): number {
  return table(content).partyMask;
}
export function enemyAuraMask(content: Content): number {
  return table(content).enemyMask;
}

export function hasAura(world: World, mask: number, id: string): boolean {
  return (mask & auraBit(world.content, id)) !== 0;
}

/** Aura ids in a mask, in content order (HUD, tests). */
export function auraIds(content: Content, mask: number): string[] {
  const out: string[] = [];
  content.auras.forEach((a, i) => {
    if (mask & (1 << i)) out.push(a.id);
  });
  return out;
}

/**
 * Totals for whoever a `mask` covers, at this tick's strengths. Cached per mask until the
 * field system updates the strengths (each tick), so hot loops don't allocate.
 */
export function auraTotals(world: World, mask: number): Readonly<AuraTotals> {
  if (mask === 0) return NO_AURAS;
  const cache = world.scratch.auraTotals;
  if (world.scratch.auraTick !== world.tick) {
    cache.clear();
    world.scratch.auraTick = world.tick;
  }
  const hit = cache.get(mask);
  if (hit) return hit;
  const out: AuraTotals = { ...NO_AURAS };
  const auras = world.content.auras;
  for (let i = 0; i < auras.length; i++) {
    if ((mask & (1 << i)) === 0) continue;
    const def = auras[i]!;
    const k = world.scratch.auraMult[i] ?? 0;
    if (k <= 0) continue;
    const fx = def.effects;
    let regen = fx.regenPctPerSec;
    if (def.id === 'sostenuto') regen *= world.mods.sostenutoMult;
    let attackSpeed = fx.attackSpeed;
    if (def.id === 'allegro') attackSpeed += world.mods.allegroBonus;
    out.regenPctPerSec += regen * k;
    out.barrierPct += fx.barrierPct * k;
    out.attackSpeed += attackSpeed * k;
    out.moveSpeed += fx.moveSpeed * k;
    out.damage += fx.damage * k;
    out.flatDamage += fx.flatDamage * k;
    out.guardDr += fx.guardDr * k;
    // Thresholds and the hold length are rules, not strengths: ornaments don't scale them.
    out.guardBelow = Math.max(out.guardBelow, fx.guardBelow);
    out.holdTime = Math.max(out.holdTime, fx.holdTime);
    out.enemySlow += fx.enemySlow * k;
    out.enemyWindup += fx.enemyWindup * k;
  }
  out.enemySlow = Math.min(MAX_SLOW, out.enemySlow);
  out.guardDr = Math.min(MAX_GUARD, out.guardDr);
  cache.set(mask, out);
  return out;
}

/** Forget cached totals (the field system calls this after changing strengths). */
export function invalidateAuraTotals(world: World): void {
  world.scratch.auraTotals.clear();
  world.scratch.auraTick = world.tick;
}

export function heroFx(world: World, e: Entity): Readonly<AuraTotals> {
  return auraTotals(world, e.hero?.auraMask ?? 0);
}

export function enemyFx(world: World, e: Entity): Readonly<AuraTotals> {
  return auraTotals(world, e.enemy?.auraMask ?? 0);
}
