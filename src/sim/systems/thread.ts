/**
 * The Thread (docs/plan/03 §1): one hero at a time is Mended (heal, revive) or Empowered
 * (more damage, faster attacks). Strength falls off past the comfort range and the Thread
 * snaps past the snap range, locking out for a moment.
 */
import { CONTENT } from '../../content';
import { SEVER_EVERY } from '../../content/unstitched';
import type { PartySlot } from '../commands';
import { distSq, len, segmentDistSq } from '../core/dmath';
import {
  addShield,
  dealDamage,
  DOT_TICK,
  heal,
  isActive,
  reviveHero,
  shieldOf,
  slotHero,
} from '../combat/health';
import { relicFired } from '../combat/feedback';
import { gainResonance } from '../combat/resonance';
import type { ThreadCutCause } from '../events';
import { threadSegment, type Segment } from '../rules3';
import type { Entity, EntityId } from '../state';
import { weaverOf, type World } from '../world';
import { reject } from './techniques';

const MEND_FLUSH = 0.5;
/** Blood and Silk counts while Brann is below this share of his life (docs/phase-5b.md). */
const SILK_BELOW = 0.3;

export function attachThread(world: World, slot: PartySlot): void {
  const weaver = weaverOf(world);
  const w = weaver.weaver!;
  if (weaver.health!.downed) return reject(world, 'thread', 'down');
  const hero = slotHero(world, slot);
  if (!hero?.health || hero.health.dead) return reject(world, 'thread', 'target');
  if (w.threadSlot === slot) return;
  if (w.threadLock > 0) return reject(world, 'thread', 'locked');
  if (len(hero.x - weaver.x, hero.z - weaver.z) > w.threadRange)
    return reject(world, 'thread', 'range');
  const previous = w.threadSlot;
  // Afterglow (the Astrolabe): Empower lingers on the hero the Thread leaves.
  if (previous !== null && w.threadMode === 'empower' && world.mods.empowerLinger > 0) {
    const left = slotHero(world, previous);
    if (left?.hero) left.hero.afterglowUntil = world.time + world.mods.empowerLinger;
  }
  w.threadSlot = slot;
  w.threadTension = 0;
  world.events.push({ type: 'threadAttached', tick: world.tick, hero: hero.id, slot });
  // Under Unravel (docs/phase-5c.md) the Thread wounds: no Relay heal.
  if (
    previous !== null &&
    world.mods.relayHealPct > 0 &&
    !hero.health.downed &&
    !unravelling(world)
  ) {
    heal(world, hero, hero.health.maxHp * world.mods.relayHealPct, 'mend');
  }
  silverThimble(world, hero);
}

/**
 * An enemy cuts the Thread (docs/phase-5c.md, Q1): a new path beside the range snap, which is
 * untouched. It lets go of the hero, locks the Thread for `lock` × `mods.cutLockMult` seconds,
 * reports `threadSnapped { cause, lock, by }` and fires Taut Release; Knotted Cord gives its
 * Resonance. Guard Strand turns a Shears, Severing or Snip cut aside once every `guardStrand`
 * seconds (never the Unpick). Returns what happened: `cut`, `strand` (turned aside), or `none`
 * (there was no Thread). The caller reports a cut telegraph's `cutResolved`.
 */
export function cutThread(
  world: World,
  cause: ThreadCutCause,
  lock: number,
  by: EntityId | null,
): 'cut' | 'strand' | 'none' {
  const w = world.entities.get(world.weaverId)?.weaver;
  if (!w || w.threadSlot === null) return 'none';
  const hero = slotHero(world, w.threadSlot);
  if (!hero?.health || hero.health.dead) return 'none';
  if (cause !== 'unpick' && guardStrandReady(world)) {
    spendGuardStrand(world);
    return 'strand';
  }
  const k = world.mods.cutLockMult;
  const locked = k !== 1 ? lock * k : lock;
  w.threadSlot = null;
  w.threadTension = 0;
  w.threadLock = Math.max(w.threadLock, locked);
  world.events.push({
    type: 'threadSnapped',
    tick: world.tick,
    target: hero.id,
    cause,
    lock: locked,
    ...(by !== null ? { by } : {}),
  });
  // Taut Release reads 'When the Thread snaps': a cut is a snap.
  if (world.mods.tautReleasePct > 0 && !hero.health.downed) {
    addShield(world, hero, 'overshield', hero.health.maxHp * world.mods.tautReleasePct, 4, true);
  }
  // Knotted Cord: every cut rings for you.
  if (world.mods.cutResonance > 0) {
    gainResonance(world, world.mods.cutResonance, 'knotted cord');
  }
  return 'cut';
}

/** Guard Strand is held and its clock (`internal.guardStrandAt`, lazy) has run out. */
export function guardStrandReady(world: World): boolean {
  if (world.mods.guardStrand <= 0) return false;
  const at = world.internal.guardStrandAt;
  return at === undefined || world.time + 1e-9 >= at;
}

/** Guard Strand turned a bolt or a cut aside: its clock starts again. */
export function spendGuardStrand(world: World): void {
  world.internal.guardStrandAt = world.time + world.mods.guardStrand;
}

/** Each affix's cut (Severing's reach and lock), by affix id. */
const AFFIX_CUTS: ReadonlyMap<string, { readonly radius: number; readonly lock: number }> = new Map(
  CONTENT.affixes.flatMap((a) => (a.cut ? [[a.id, a.cut] as const] : [])),
);

/** The nearest point of the segment `s` to (x, z): where a turned-aside Severing is drawn. */
function nearestOn(s: Segment, x: number, z: number): { x: number; z: number } {
  const lx = s.bx - s.ax;
  const lz = s.bz - s.az;
  const l2 = lx * lx + lz * lz;
  let u = l2 > 0 ? ((x - s.ax) * lx + (z - s.az) * lz) / l2 : 0;
  u = u < 0 ? 0 : u > 1 ? 1 : u;
  return { x: s.ax + lx * u, z: s.az + lz * u };
}

/**
 * Severing (docs/phase-5c.md): a hit a Severing elite lands while the Thread passes within the
 * affix's reach plus the elite's own radius of it cuts the Thread, at most once every
 * `SEVER_EVERY` seconds per elite (`internal.m3.severAt`, lazy). Call it once the hit has landed:
 * bolts here (systems/hits.ts), melee and telegraph hits from the enemy side. A cut Guard Strand
 * turns aside is drawn as a `strandBlocked` where the Thread came closest.
 */
export function severingHit(world: World, source: Entity): void {
  const c = source.enemy;
  if (!c || c.affixes.length === 0) return;
  let cut: { readonly radius: number; readonly lock: number } | undefined;
  for (const id of c.affixes) cut ??= AFFIX_CUTS.get(id);
  if (!cut || !isActive(source)) return;
  const at = world.internal.m3?.severAt?.[source.id];
  if (at !== undefined && world.time + 1e-9 < at) return;
  const seg = threadSegment(world);
  if (!seg) return;
  const reach = cut.radius + source.radius;
  const d2 = segmentDistSq(source.x, source.z, source.x, source.z, seg.ax, seg.az, seg.bx, seg.bz);
  if (d2 > reach * reach) return;
  const result = cutThread(world, 'severing', cut.lock, source.id);
  if (result === 'none') return;
  const m3 = (world.internal.m3 ??= {});
  (m3.severAt ??= {})[source.id] = world.time + SEVER_EVERY;
  if (result === 'strand') {
    const p = nearestOn(seg, source.x, source.z);
    world.events.push({ type: 'strandBlocked', tick: world.tick, source: source.id, ...p });
  }
}

/** Unravel's reversed Mend is running: its window is open and Stasis isn't holding it. */
function unravelling(world: World): boolean {
  return world.field.unravel !== undefined && !world.field.stasis;
}

/**
 * Unravel (docs/phase-5c.md, Q12): Mend deals what it would have healed to the threaded hero
 * (`mendPerSec × mendMult × potency`), gathered in `field.unravel.acc` and landing every half
 * second as a tick. Mend's bonuses, the Prism Loom's spill and Sanguine Covenant don't apply,
 * and a downed hero's revive holds where it is.
 */
function unravelMend(world: World, hero: Entity, potency: number, dt: number): void {
  const u = world.field.unravel!;
  if (hero.health!.downed) return;
  u.acc += world.content.thread.mendPerSec * world.mods.mendMult * dt * potency;
  u.tickIn -= dt;
  if (u.tickIn > 1e-9) return;
  u.tickIn = u.tickIn + DOT_TICK > 1e-9 ? u.tickIn + DOT_TICK : DOT_TICK;
  const amount = u.acc;
  u.acc = 0;
  dealDamage(world, hero, {
    source: u.source,
    sourceName: 'Unravel — your Mend',
    amount,
    telegraph: null,
    kind: 'tick',
    status: 'unravelled',
  });
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

/**
 * Mend ⇄ Empower, or (with `'bear'`, the Martyr only) Bear on and off. Bear returns to the
 * mode it left; so does a plain toggle made while Bearing.
 */
export function toggleThreadMode(world: World, mode?: 'bear'): void {
  const w = weaverOf(world).weaver!;
  if (mode === 'bear') {
    if (world.mods.bearShare <= 0) return reject(world, 'thread', 'locked');
    if (w.threadMode === 'bear') w.threadMode = w.lastMode;
    else {
      w.lastMode = w.threadMode;
      w.threadMode = 'bear';
    }
  } else if (w.threadMode === 'bear') w.threadMode = w.lastMode;
  else w.threadMode = w.threadMode === 'mend' ? 'empower' : 'mend';
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
  // Sanguine Covenant (the Martyr): Mend heals the Weaver too (reported with her own healing).
  if (healed > 0 && world.mods.covenantPct > 0) {
    const weaver = weaverOf(world);
    weaver.weaver!.selfHealAcc += heal(
      world,
      weaver,
      healed * world.mods.covenantPct,
      'self',
      false,
    );
  }
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
  const threaded = w?.threadMode === 'empower' ? threadPotency(world, hero) : 0;
  // Afterglow: a hero the Empowering Thread just left keeps it, at full strength, a moment.
  const p = threaded > 0 ? threaded : (hero.hero?.afterglowUntil ?? 0) > world.time ? 1 : 0;
  if (p <= 0) return { more: 0, attackSpeed: 0 };
  const def = world.content.thread;
  return {
    more: def.empowerMore * world.mods.empowerMult * p,
    attackSpeed: def.empowerAttackSpeed * p,
  };
}

/** Mend's bonuses on one hero (the Astrolabe's Second Stitch and Lifeguard; Lifeline). */
function mendBonus(world: World, hero: Entity): number {
  const h = hero.health!;
  const m = world.mods;
  let mult = h.hp < h.maxHp * 0.5 ? m.lifelineMult : 1;
  if (m.mendLowBonus > 0 && h.hp < h.maxHp * m.mendLowBelow) mult *= 1 + m.mendLowBonus;
  if (m.mendWarded > 0 && h.shields.some((s) => s.kind === 'ward' && s.amount > 0))
    mult *= 1 + m.mendWarded;
  return mult;
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
  const snap = w.threadRange;
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
    // Unravel (docs/phase-5c.md): while it runs, Mend wounds instead. Empower and Bear don't.
    if (unravelling(world)) return unravelMend(world, hero, potency, dt);
    if (h.downed) {
      if (h.revive === 0)
        world.events.push({ type: 'reviveStarted', tick: world.tick, hero: hero.id });
      h.revive = Math.min(
        1,
        h.revive + (dt / def.reviveTime) * potency * world.mods.reviveSpeedMult,
      );
      if (h.revive >= 1) {
        reviveHero(world, hero, world.mods.reviveHpPct ?? def.reviveHpPct);
        // Bonds (docs/phase-4e.md): the life a revive gives back is your support.
        if (hero.hero) hero.hero.supportReceived += h.hp;
        // Second Wind (the Astrolabe): they stand up untouchable for a moment.
        h.invulnerable = Math.max(h.invulnerable, world.mods.reviveInvulnerable);
      }
      return;
    }
    const perSec = def.mendPerSec * world.mods.mendMult * dt;
    mendHero(world, hero, perSec * potency * mendBonus(world, hero));
    if (world.mods.prismRadius > 0) {
      // The Prism Loom: Mend spills onto heroes standing close to the threaded one.
      for (const id of world.party) {
        const other = world.entities.get(id);
        if (!other || other.id === hero.id || !isActive(other) || !inPrism(world, hero, other))
          continue;
        mendHero(
          world,
          other,
          perSec * potency * world.mods.prismPotency * mendBonus(world, other),
        );
      }
    }
  } else if (
    w.threadMode === 'empower' &&
    (c.action === 'attacking' || c.action === 'casting' || c.soloActive > 0)
  ) {
    gainResonance(world, world.content.resonance.gains.empowerPerSec * dt, 'empower', true);
  }
  // Blood and Silk (a Harmony, docs/phase-5b.md): Empowering Brann below 30% rings for you.
  if (
    world.mods.bloodAndSilk > 0 &&
    w.threadMode === 'empower' &&
    c.blood &&
    !h.downed &&
    h.hp < h.maxHp * SILK_BELOW
  )
    gainResonance(world, world.mods.bloodAndSilk * dt, 'blood_and_silk', true);
  // Bear works in the damage code (combat/health.ts `bearShareOf`).
}
