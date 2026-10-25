/**
 * The Thread (docs/plan/03 §1): one hero at a time is Mended (heal, revive) or Empowered
 * (more damage, faster attacks). Strength falls off past the comfort range and the Thread
 * snaps past the snap range, locking out for a moment.
 */
import type { PartySlot } from '../commands';
import { distSq, len } from '../core/dmath';
import { addShield, heal, isActive, reviveHero, shieldOf, slotHero } from '../combat/health';
import { relicFired } from '../combat/feedback';
import { gainResonance } from '../combat/resonance';
import type { Entity } from '../state';
import { weaverOf, type World } from '../world';
import { reject } from './techniques';

const MEND_FLUSH = 0.5;

export function attachThread(world: World, slot: PartySlot): void {
  const weaver = weaverOf(world);
  const w = weaver.weaver!;
  if (weaver.health!.downed) return reject(world, 'thread', 'down');
  const hero = slotHero(world, slot);
  if (!hero?.health || hero.health.dead) return reject(world, 'thread', 'target');
  if (w.threadSlot === slot) return;
  if (w.threadLock > 0) return reject(world, 'thread', 'locked');
  const range = world.content.thread.snapRange + world.mods.threadRangeBonus;
  if (len(hero.x - weaver.x, hero.z - weaver.z) > range) return reject(world, 'thread', 'range');
  const previous = w.threadSlot;
  w.threadSlot = slot;
  w.threadTension = 0;
  world.events.push({ type: 'threadAttached', tick: world.tick, hero: hero.id, slot });
  if (previous !== null && world.mods.relayHealPct > 0 && !hero.health.downed) {
    heal(world, hero, hero.health.maxHp * world.mods.relayHealPct, 'mend');
  }
  silverThimble(world, hero);
}

/** Silver Thimble: the hero the Thread moves to is shielded (rate-limited). */
function silverThimble(world: World, hero: Entity): void {
  const relics = world.relics;
  const pct = world.mods.thimbleBarrierPct;
  if (pct <= 0 || relics.thimbleAt === null || world.time < relics.thimbleAt) return;
  const h = hero.health;
  if (!h || h.downed || h.dead) return;
  const amount = h.maxHp * pct;
  // A hero's own overshield (an uncued Aegis Wall) is theirs to keep.
  const existing = shieldOf(h, 'overshield');
  if (existing && (!existing.fromWeaver || existing.amount >= amount)) return;
  addShield(world, hero, 'overshield', amount, world.mods.thimbleDuration, true);
  relics.thimbleAt = world.time + world.mods.thimbleCooldown;
  relicFired(world, 'silver_thimble', hero.id);
}

export function toggleThreadMode(world: World): void {
  const w = weaverOf(world).weaver!;
  w.threadMode = w.threadMode === 'mend' ? 'empower' : 'mend';
  world.events.push({ type: 'threadModeChanged', tick: world.tick, mode: w.threadMode });
}

/**
 * Potency of the Thread on `hero` right now (0 when not threaded). With the Prism Loom, heroes
 * standing near the threaded one get a share of it.
 */
export function threadPotency(world: World, hero: Entity): number {
  const weaver = world.entities.get(world.weaverId);
  const w = weaver?.weaver;
  if (!w || w.threadSlot === null || weaver!.health!.downed) return 0;
  const threadedId = world.party[w.threadSlot];
  const potency = 1 - w.threadTension * (1 - world.content.thread.tautPotency);
  if (threadedId === hero.id) return potency;
  if (world.mods.prismRadius <= 0 || !isActive(hero)) return 0;
  const threaded = threadedId === undefined ? undefined : world.entities.get(threadedId);
  if (!isActive(threaded) || !inPrism(world, threaded, hero)) return 0;
  return potency * world.mods.prismPotency;
}

function inPrism(world: World, threaded: Entity, other: Entity): boolean {
  const r = world.mods.prismRadius + other.radius;
  return distSq(threaded.x, threaded.z, other.x, other.z) <= r * r;
}

/** Mend on one hero this tick, its floating number flushed every half second. */
function mendHero(world: World, hero: Entity, amount: number): void {
  const c = hero.hero!;
  const healed = heal(world, hero, amount, 'mend', false);
  c.mendHealAcc += healed;
  if (c.mendHealAcc > 0 && world.tick % Math.round(MEND_FLUSH * 60) === 0) {
    world.events.push({
      type: 'healApplied',
      tick: world.tick,
      target: hero.id,
      source: world.weaverId,
      amount: c.mendHealAcc,
      overheal: 0,
      via: 'mend',
    });
    c.mendHealAcc = 0;
  }
}

/** Empower multiplier for a hero's damage (1 when not Empowered). */
export function empowerBonus(world: World, hero: Entity): { more: number; attackSpeed: number } {
  const w = world.entities.get(world.weaverId)?.weaver;
  if (!w || w.threadMode !== 'empower') return { more: 0, attackSpeed: 0 };
  const p = threadPotency(world, hero);
  if (p <= 0) return { more: 0, attackSpeed: 0 };
  const def = world.content.thread;
  return {
    more: def.empowerMore * world.mods.empowerMult * p,
    attackSpeed: def.empowerAttackSpeed * p,
  };
}

export function updateThread(world: World, dt: number): void {
  const weaver = weaverOf(world);
  const w = weaver.weaver!;
  if (w.threadSlot === null) {
    w.threadTension = 0;
    return;
  }
  const hero = slotHero(world, w.threadSlot);
  if (!hero?.health || hero.health.dead) {
    w.threadSlot = null;
    w.threadTension = 0;
    return;
  }
  const def = world.content.thread;
  const comfort = def.comfortRange + world.mods.threadRangeBonus;
  const snap = def.snapRange + world.mods.threadRangeBonus;
  const d = len(hero.x - weaver.x, hero.z - weaver.z);
  if (d > snap) {
    w.threadSlot = null;
    w.threadTension = 0;
    w.threadLock = def.lockout;
    world.events.push({ type: 'threadSnapped', tick: world.tick, target: hero.id });
    if (world.mods.tautReleasePct > 0 && !hero.health.downed) {
      addShield(world, hero, 'overshield', hero.health.maxHp * world.mods.tautReleasePct, 4, true);
    }
    return;
  }
  const before = w.threadTension;
  w.threadTension = d <= comfort ? 0 : (d - comfort) / (snap - comfort);
  if (before < 0.6 && w.threadTension >= 0.6) {
    world.events.push({
      type: 'threadTaut',
      tick: world.tick,
      target: hero.id,
      tension: w.threadTension,
    });
  }
  const potency = 1 - w.threadTension * (1 - def.tautPotency);
  const h = hero.health;
  const c = hero.hero!;

  if (w.threadMode === 'mend') {
    if (h.downed) {
      if (h.revive === 0)
        world.events.push({ type: 'reviveStarted', tick: world.tick, hero: hero.id });
      h.revive = Math.min(1, h.revive + (dt / def.reviveTime) * potency);
      if (h.revive >= 1) reviveHero(world, hero, def.reviveHpPct);
      return;
    }
    const perSec = def.mendPerSec * world.mods.mendMult * dt;
    let amount = perSec * potency;
    if (h.hp < h.maxHp * 0.5) amount *= world.mods.lifelineMult;
    mendHero(world, hero, amount);
    if (world.mods.prismRadius > 0) {
      // The Prism Loom: Mend spills onto heroes standing close to the threaded one.
      for (const id of world.party) {
        const other = world.entities.get(id);
        if (!other || other.id === hero.id || !isActive(other) || !inPrism(world, hero, other))
          continue;
        let share = perSec * potency * world.mods.prismPotency;
        if (other.health.hp < other.health.maxHp * 0.5) share *= world.mods.lifelineMult;
        mendHero(world, other, share);
      }
    }
  } else if (c.action === 'attacking' || c.action === 'casting' || c.soloActive > 0) {
    gainResonance(world, world.content.resonance.gains.empowerPerSec * dt, 'empower', true);
  }
}
