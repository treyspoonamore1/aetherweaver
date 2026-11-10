/**
 * The trigger system (docs/phase-5g.md, "The trigger system"): data-driven rules of the form
 * "when this event happens, do that", from the content of the run's motifs, relics and boons
 * (`mods.triggers`, resolved by sim/mods.ts in the order they were resolved). It replaces a
 * bespoke hook per entry with one interpreter, and it is inert on every existing run: without a
 * trigger held, `world.internal.triggers` is absent and `stepWorld` never calls in.
 *
 * - **When.** Once a tick, just before the ledger samples (sim/api.ts). It reads the tick's
 *   events, from `mark` (the queue's length as the tick began) to the queue's length as it is
 *   entered, in emission order; then the timers (`on: 'every'`). Events its own effects emit are
 *   never read: not in this pass, and not by a later tick (whose mark comes after them).
 * - **What it reads.** Each event's subject (`subjectOf`): its hero (or a fallen summon's owner),
 *   its place, its amount and radius. Conditions (`holds`) and limits (`every`, `perFight`).
 * - **What it does.** Each effect through the sim's own function for it: `addShield` (an
 *   overshield, the Weaver's), `heal`, `gainResonance`, Spirit, Solo charge, `dealDamage`
 *   (credited to the Weaver, as Riposte Bloom's nova is), `addStatus`, a technique's or a hero
 *   ability's cooldown, Empower (`hero.afterglowUntil`), the Crescendo's clock.
 * - **What it tells the views.** A fire whose effects did something (`fire`) emits
 *   `motifTriggered { source, target? }` and counts into `ledger.triggers[source]`.
 * - **Draws.** None. Targets go by distance, then entity id.
 */
import type { TriggerPoint } from '../../content/schema';
import { distSq } from '../core/dmath';
import {
  addShield,
  addStatus,
  dealDamage,
  heal,
  isActive,
  shieldOf,
  slotHero,
} from '../combat/health';
import { gainResonance } from '../combat/resonance';
import type { SimEvent } from '../events';
import type { ResolvedEffect, ResolvedTrigger, ResolvedTriggerDef } from '../mods';
import type { Entity, EntityId, TechniqueKey } from '../state';
import { weaverOf, type World } from '../world';
import { wardCooldown } from './techniques';

/** Float slack for sim-time comparisons (sim time is a sum of tick lengths). */
const EPS = 1e-9;

/** One trigger's clocks, by its index in `mods.triggers`. */
export interface TriggerClock {
  /** Sim time it may fire again (its `every`); 0 until it has fired. */
  readyAt: number;
  /** Times it has fired this fight. */
  fired: number;
  /** A timer (`on: 'every'`): seconds its conditions have held since it last fired. */
  held: number;
  /** A `crescendo` effect: seconds it has added to the Crescendo playing now. */
  added: number;
}

/**
 * `world.internal.triggers` (hashed): created with the world only while a trigger is held, so
 * absent in every other fight. Never holds `undefined`.
 */
export interface TriggerState {
  clocks: TriggerClock[];
  /** The last Cue: when, and on whom (for `cueWithin`). Absent before the first. */
  lastCue?: { at: number; hero: EntityId };
}

/**
 * Called by `createWorld` behind `if (mods.triggers.length > 0)`: the clocks, and the ledger's
 * tally with every source at 0 (so a held trigger that never fires reads 0, not missing).
 */
export function armTriggers(world: World): void {
  const triggers = world.mods.triggers;
  world.internal.triggers = {
    clocks: triggers.map(() => ({ readyAt: 0, fired: 0, held: 0, added: 0 })),
  };
  world.ledger.triggers = Object.fromEntries(triggers.map((t) => [t.source, 0]));
}

/** What an event is about, as a trigger reads it. */
interface Subject {
  event: SimEvent | null;
  /** The event's hero (a fallen summon's owner), if it has one. */
  hero: Entity | null;
  /** Where it happened. */
  x: number;
  z: number;
  /** The event's own amount (`damageTaken`: the life the Weaver lost). */
  amount: number;
  /** The event's own radius (`chimeLanded`: the Chime's). */
  radius: number;
}

function heroAt(world: World, id: EntityId | null): Entity | null {
  if (id === null) return null;
  const e = world.entities.get(id);
  return e?.hero ? e : null;
}

/** A subject for `hero`, placed where it stands (or at the Weaver without one). */
function about(world: World, event: SimEvent | null, hero: Entity | null, amount = 0): Subject {
  const at = hero ?? weaverOf(world);
  return { event, hero, x: at.x, z: at.z, amount, radius: 0 };
}

function placed(event: SimEvent, hero: Entity | null, x: number, z: number, radius = 0): Subject {
  return { event, hero, x, z, amount: 0, radius };
}

/** The subject of an event a trigger can react to; null for any other event (or one it skips). */
function subjectOf(world: World, e: SimEvent): Subject | null {
  switch (e.type) {
    case 'perfectWard':
    case 'save':
    case 'cleansed':
    case 'threadSnapped':
      return about(world, e, heroAt(world, e.target));
    case 'reeled':
      return placed(e, heroAt(world, e.target), e.toX, e.toZ);
    case 'chimeLanded':
      return placed(e, null, e.x, e.z, e.radius);
    case 'glided':
      return placed(e, null, e.toX, e.toZ);
    case 'threadAttached':
    case 'cued':
    case 'allyDowned':
    case 'revived':
    case 'parried':
      return about(world, e, heroAt(world, e.hero));
    case 'techniqueCast':
      return placed(e, heroAt(world, e.target), e.x, e.z);
    case 'shieldBroken': {
      // A party shield only: a hero's, or the Weaver's (never an enemy's or a summon's).
      if (e.target !== world.weaverId && !heroAt(world, e.target)) return null;
      return about(world, e, heroAt(world, e.target));
    }
    case 'damageTaken':
      // Only with the Weaver as the target: what she lost.
      return e.target === world.weaverId ? about(world, e, null, e.amount) : null;
    case 'abilityUsed': {
      const hero = heroAt(world, e.source);
      return hero ? placed(e, hero, e.x, e.z) : null;
    }
    case 'crescendoStart':
    case 'crescendoEnd':
      return about(world, e, null);
    case 'summonFell': {
      const owner = heroAt(world, e.owner);
      const summon = world.entities.get(e.summon);
      return summon ? placed(e, owner, summon.x, summon.z) : about(world, e, owner);
    }
    case 'enemyKilled':
      return placed(e, heroAt(world, e.killer), e.x, e.z);
    default:
      return null;
  }
}

/** The tick's events a condition may look across (`usedUp`), from `mark` to `end`. */
interface Tick {
  mark: number;
  end: number;
}

/** A `perfectWard` on `target` among the tick's events (a Perfect spends its Ward: `usedUp`). */
function perfectedIn(world: World, tick: Tick, target: EntityId): boolean {
  for (let i = tick.mark; i < tick.end; i++) {
    const e = world.events.at(i)!;
    if (e.type === 'perfectWard' && e.target === target) return true;
  }
  return false;
}

/** Every condition of `def` holds for `s` (limits apart). */
function holds(
  world: World,
  state: TriggerState,
  def: ResolvedTriggerDef,
  s: Subject,
  tick: Tick,
): boolean {
  const e = s.event;
  if (def.hero !== undefined && s.hero?.hero?.defId !== def.hero) return false;
  if (
    def.technique !== undefined &&
    !(e?.type === 'techniqueCast' && e.technique === def.technique)
  )
    return false;
  if (def.ability !== undefined && !(e?.type === 'abilityUsed' && e.ability === def.ability))
    return false;
  if (def.shield !== undefined && !(e?.type === 'shieldBroken' && e.shield === def.shield))
    return false;
  if (def.usedUp && !(e?.type === 'shieldBroken' && !perfectedIn(world, tick, e.target)))
    return false;
  if (def.summon !== undefined && !(e?.type === 'summonFell' && e.kind === def.summon))
    return false;
  if (def.clutch && !((e?.type === 'cleansed' || e?.type === 'chimeLanded') && e.clutch))
    return false;
  if (def.removed && !(e?.type === 'cleansed' && e.removed > 0)) return false;
  if (def.role !== undefined) {
    if (e?.type !== 'enemyKilled') return false;
    if (world.content.enemies.find((d) => d.id === e.defId)?.role !== def.role) return false;
  }
  if (def.cueWithin !== undefined) {
    const last = state.lastCue;
    if (e?.type !== 'cued' || !last || last.hero === e.hero) return false;
    if (world.time - last.at > def.cueWithin + EPS) return false;
  }
  const weaver = weaverOf(world);
  const w = weaver.weaver!;
  if (def.thread !== undefined) {
    if (w.threadSlot === null || weaver.health!.downed || w.threadMode !== def.thread) return false;
  }
  if (def.crescendo && !(w.crescendo > 0)) return false;
  return true;
}

/** Its limits allow a fire now. */
function ready(world: World, def: ResolvedTriggerDef, clock: TriggerClock): boolean {
  if (def.perFight !== undefined && clock.fired >= def.perFight) return false;
  return def.every === undefined || world.time + EPS >= clock.readyAt;
}

/**
 * The trigger system's tick (docs/phase-5g.md). `mark` is the event queue's length as the tick
 * began (`stepWorld`'s first line); `dt` the tick's sim seconds. Called only while
 * `world.internal.triggers` exists.
 */
export function updateTriggers(world: World, mark: number, dt: number): void {
  const state = world.internal.triggers;
  if (!state) return;
  const triggers = world.mods.triggers;
  const end = world.events.length;
  const tick: Tick = { mark, end };
  for (let i = mark; i < end; i++) {
    const event = world.events.at(i)!;
    // A new Crescendo: what the last one was lengthened by no longer counts against its cap.
    if (event.type === 'crescendoStart') for (const c of state.clocks) c.added = 0;
    const s = subjectOf(world, event);
    if (s) {
      for (const [k, t] of triggers.entries()) {
        if (t.def.on !== event.type) continue;
        const clock = state.clocks[k]!;
        if (holds(world, state, t.def, s, tick) && ready(world, t.def, clock))
          fire(world, t, clock, s);
      }
    }
    if (event.type === 'cued') state.lastCue = { at: world.time, hero: event.hero };
  }
  // Timers: `period` seconds of their conditions holding, in a fight.
  if (world.encounter.status !== 'fighting') return;
  for (const [k, t] of triggers.entries()) {
    if (t.def.on !== 'every') continue;
    const period = t.def.period ?? 0;
    if (!(period > 0)) continue;
    const clock = state.clocks[k]!;
    const s = about(world, null, null);
    if (!holds(world, state, t.def, s, tick)) continue;
    clock.held = Math.min(period, clock.held + dt);
    if (clock.held + EPS < period || !ready(world, t.def, clock)) continue;
    clock.held = 0;
    fire(world, t, clock, s);
  }
}

/**
 * Applies every effect and starts its clock (`fired`, `readyAt`: its limits count every fire).
 * It counts into the ledger and reports `motifTriggered` only when an effect did something: a
 * heal that healed, damage dealt, a barrier added, a status applied, a clock moved, a resource
 * gained. A rule that found no one, or nothing left to give, fired but did not trigger.
 */
function fire(world: World, t: ResolvedTrigger, clock: TriggerClock, s: Subject): void {
  let did = false;
  let first: EntityId | undefined;
  for (const effect of t.def.effects) {
    const landed = apply(world, t, clock, effect, s);
    if (landed === false) continue;
    did = true;
    if (first === undefined && landed !== true) first = landed;
  }
  clock.fired++;
  if (t.def.every !== undefined) clock.readyAt = world.time + t.def.every;
  if (!did) return;
  const tally = world.ledger.triggers;
  if (tally) tally[t.source] = (tally[t.source] ?? 0) + 1;
  world.events.push({
    type: 'motifTriggered',
    tick: world.tick,
    source: t.source,
    ...(first !== undefined ? { target: first } : {}),
  });
}

/** Where an effect is centred. */
function pointOf(world: World, at: TriggerPoint | undefined, s: Subject): { x: number; z: number } {
  if (at === 'weaver') return weaverOf(world);
  if (at === 'threaded') return threadedHero(world) ?? weaverOf(world);
  if (at === 'hero') return s.hero ?? weaverOf(world);
  return s;
}

function threadedHero(world: World): Entity | null {
  const w = weaverOf(world).weaver!;
  if (w.threadSlot === null) return null;
  const hero = slotHero(world, w.threadSlot);
  return isActive(hero) ? hero : null;
}

/** Standing heroes, in slot order. */
function standingHeroes(world: World): Entity[] {
  const out: Entity[] = [];
  for (const id of world.party) {
    const e = world.entities.get(id);
    if (e?.hero && isActive(e)) out.push(e);
  }
  return out;
}

/** Nearer to (x, z) first, then the lower entity id. */
function byDistance(x: number, z: number): (a: Entity, b: Entity) => number {
  return (a, b) => distSq(a.x, a.z, x, z) - distSq(b.x, b.z, x, z) || a.id - b.id;
}

type HeroEffect = Extract<ResolvedEffect, { to: unknown }>;

/** The heroes an effect lands on (each standing; `inField` only when asked). */
function heroesFor(world: World, e: HeroEffect, s: Subject): Entity[] {
  const own = s.hero && isActive(s.hero) ? s.hero : null;
  let out: Entity[];
  switch (e.to) {
    case 'event':
      out = own ? [own] : [];
      break;
    case 'threaded': {
      const hero = threadedHero(world);
      out = hero ? [hero] : [];
      break;
    }
    case 'all':
      out = standingHeroes(world);
      break;
    case 'others':
      out = standingHeroes(world).filter((h) => h.id !== s.hero?.id);
      break;
    case 'near': {
      const p = pointOf(world, e.at, s);
      const r = e.radius ?? 0;
      out = standingHeroes(world)
        .filter((h) => distSq(h.x, h.z, p.x, p.z) <= (r + h.radius) * (r + h.radius))
        .sort(byDistance(p.x, p.z));
      break;
    }
    case 'nearestOther': {
      const from = s.hero;
      const r = e.radius ?? Infinity;
      out = from
        ? standingHeroes(world)
            .filter((h) => h.id !== from.id)
            .filter((h) => distSq(h.x, h.z, from.x, from.z) <= (r + h.radius) * (r + h.radius))
            .sort(byDistance(from.x, from.z))
            .slice(0, 1)
        : [];
      break;
    }
    case 'neediest': {
      const threaded = threadedHero(world);
      const share = (h: Entity) => h.health!.hp / h.health!.maxHp;
      const near = byDistance(s.x, s.z);
      out = standingHeroes(world)
        .filter((h) => h.id !== s.hero?.id && h.id !== threaded?.id)
        .filter((h) => !e.inField || h.hero!.inField)
        .sort((a, b) => share(a) - share(b) || near(a, b))
        .slice(0, 1);
      break;
    }
  }
  return e.inField ? out.filter((h) => h.hero!.inField) : out;
}

/** Standing enemies within `radius` of (x, z) (their own radius added), nearest first. */
function enemiesNear(world: World, x: number, z: number, radius: number): Entity[] {
  const out: Entity[] = [];
  for (const e of world.entities.list()) {
    if (!e.enemy || !isActive(e)) continue;
    const r = radius + e.radius;
    if (distSq(e.x, e.z, x, z) <= r * r) out.push(e);
  }
  return out.sort(byDistance(x, z));
}

/** The source's content name, for death recaps and floaters. */
function nameOf(world: World, source: string): string {
  const c = world.content;
  return (
    c.motifs.find((d) => d.id === source)?.name ??
    c.relics.find((d) => d.id === source)?.name ??
    c.boons.find((d) => d.id === source)?.name ??
    source
  );
}

/**
 * What an effect did: `false` nothing; `true` something, on no entity of its own (Resonance,
 * Spirit, a cooldown, the Crescendo); otherwise the first entity it did something to.
 */
type Landed = EntityId | boolean;

/** One effect. */
function apply(
  world: World,
  t: ResolvedTrigger,
  clock: TriggerClock,
  e: ResolvedEffect,
  s: Subject,
): Landed {
  switch (e.kind) {
    case 'barrier': {
      let first: Landed = false;
      for (const hero of heroesFor(world, e, s)) {
        const h = hero.health!;
        const amount = (h.maxHp * e.pct) / 100;
        // A hero's own overshield (an uncued Aegis Wall), or a bigger one of yours, is kept.
        const existing = shieldOf(h, 'overshield');
        if (existing && (!existing.fromWeaver || existing.amount >= amount)) continue;
        if (addShield(world, hero, 'overshield', amount, e.seconds, true) && first === false)
          first = hero.id;
      }
      return first;
    }
    case 'heal': {
      let first: Landed = false;
      for (const hero of heroesFor(world, e, s)) {
        const base = e.of === 'event' ? s.amount : hero.health!.maxHp;
        const healed = heal(world, hero, (base * e.pct) / 100, 'other');
        if (healed > 0 && first === false) first = hero.id;
      }
      return first;
    }
    case 'resonance': {
      const w = weaverOf(world).weaver!;
      const before = w.resonance;
      gainResonance(world, e.amount, t.source);
      return w.resonance > before;
    }
    case 'spirit': {
      const w = weaverOf(world).weaver!;
      const before = w.spirit;
      if (e.amount > 0) w.spirit = Math.min(w.maxSpirit - w.reservedSpirit, w.spirit + e.amount);
      return w.spirit > before;
    }
    case 'solo': {
      let first: Landed = false;
      for (const hero of heroesFor(world, e, s)) {
        const h = hero.hero!;
        if (h.soloActive > 0 || h.solo >= 100 || !(e.pct > 0)) continue;
        h.solo = Math.min(100, h.solo + e.pct);
        if (h.solo >= 100)
          world.events.push({ type: 'soloReady', tick: world.tick, hero: hero.id });
        if (first === false) first = hero.id;
      }
      return first;
    }
    case 'damage': {
      const amount = e.of === 'riposte' ? (world.mods.ripostePower * e.amount) / 100 : e.amount;
      if (!(amount > 0)) return false;
      const p = pointOf(world, e.at, s);
      const struck = enemiesNear(world, p.x, p.z, e.radius);
      let first: Landed = false;
      const sourceName = nameOf(world, t.source);
      for (const enemy of e.nearest !== undefined ? struck.slice(0, e.nearest) : struck) {
        const r = dealDamage(world, enemy, { source: world.weaverId, sourceName, amount });
        // Credited as Riposte Bloom's nova is: all of it is the Weaver's.
        world.ledger.amplified += r.dealt + r.absorbed;
        if (r.dealt + r.absorbed > 0 && first === false) first = enemy.id;
      }
      return first;
    }
    case 'status': {
      const p = pointOf(world, e.at, s);
      const radius = e.radius === 'event' ? s.radius : e.radius;
      let first: Landed = false;
      for (const enemy of enemiesNear(world, p.x, p.z, radius)) {
        if (enemy.enemy!.tier !== 'normal') continue;
        if (addStatus(world, enemy, e.status, e.seconds, world.weaverId) && first === false)
          first = enemy.id;
      }
      return first;
    }
    case 'cooldown': {
      let did = false;
      for (const key of e.techniques) if (cutCooldown(world, key, e.seconds)) did = true;
      return did;
    }
    case 'ability': {
      let first: Landed = false;
      for (const hero of heroesFor(world, e, s)) {
        const def = world.content.heroes.find((d) => d.id === hero.hero!.defId);
        const index = def ? def.abilities.findIndex((a) => a.id === e.ability) : -1;
        if (index < 0) continue;
        const cds = hero.hero!.abilityCooldowns;
        const before = cds[index]!;
        cds[index] = Math.max(0, before - e.seconds);
        if (cds[index]! < before && first === false) first = hero.id;
      }
      return first;
    }
    case 'empower': {
      let first: Landed = false;
      for (const hero of heroesFor(world, e, s)) {
        const h = hero.hero!;
        const before = h.afterglowUntil;
        h.afterglowUntil = Math.max(h.afterglowUntil, world.time + e.seconds);
        if (h.afterglowUntil > before && first === false) first = hero.id;
      }
      return first;
    }
    case 'crescendo': {
      const w = weaverOf(world).weaver!;
      const add = Math.min(e.seconds, e.cap - clock.added);
      if (w.crescendo > 0 && add > 0) {
        w.crescendo += add;
        clock.added += add;
        return true;
      }
      return false;
    }
  }
}

/**
 * A technique recovers `seconds` at once. Reaching 0, a Ward or Glide charge comes back as the
 * Weaver's own clock would give it (systems/weaver.ts), its next charge starting at once. Returns
 * whether its clock moved.
 */
function cutCooldown(world: World, key: TechniqueKey, seconds: number): boolean {
  const w = weaverOf(world).weaver!;
  // On a Chronomancer run Reel's clock is Rewind's (systems/rewind.ts): no trigger reaches it.
  if (key === 'reel' && world.mods.rewindSeconds > 0) return false;
  if (!(seconds > 0) || w.cooldowns[key] <= 0) return false;
  w.cooldowns[key] = Math.max(0, w.cooldowns[key] - seconds);
  if (w.cooldowns[key] > 0) return true;
  if (key === 'ward' && w.wardCharges < w.maxWardCharges) {
    w.wardCharges++;
    if (w.wardCharges < w.maxWardCharges) {
      w.cooldowns.ward = wardCooldown(world);
      w.cooldownTotals.ward = w.cooldowns.ward;
    }
  }
  if (key === 'glide' && w.glideCharges < w.maxGlideCharges) {
    w.glideCharges++;
    if (w.glideCharges < w.maxGlideCharges) w.cooldowns.glide = w.cooldownTotals.glide;
  }
  return true;
}
