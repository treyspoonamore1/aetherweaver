/**
 * Phase 5g, W1: the Silk motifs' sim (docs/phase-5g.md, "Silk: the Thread"; content in
 * `src/content/fill/silk.ts`). W0 placed every call site; the bodies are here. Each hook is called
 * only behind an early `if` on its own `Mods` field (named below), so none runs without its
 * motif. Whiplash, Stray Stitch, Spindle Turn and Kindred Wound are triggers (their rules are in
 * content, run by sim/systems/triggers.ts); Gilded Wake, Brimming Thread and Warded Weft set
 * existing fields.
 *
 * Rules for this file (docs/phase-5g.md, ground rules 3 and 12):
 * - No RNG on any existing path; a new draw only with the motif held (none is planned).
 * - New hashed state only in the optional keys W0 declared (named below), never written as
 *   `undefined` (create them, or `delete` them).
 * - `silkMotifIds` must return an array literal: `src/sim/mods.ts` calls it while modules load.
 * - Import any sim module at runtime except `systems/enemies.ts` and the modules that import it
 *   (`systems/director.ts`, `bosses.ts`, `conductorBoss.ts`, `unstitchedBosses.ts`,
 *   `commands.ts`, `sim/api.ts`, `sim/index.ts`): `src/sim/mods.ts` loads this file early, and
 *   those register hooks with `combat/health.ts` as they load, which then fails. Use the values
 *   you import only inside functions, never at the top level. `tests/fill/foundations.test.ts`
 *   loads the sim through each of these files first and fails on a bad import.
 * - Never edit a shared sim file; ask the orchestrator for another call site.
 * - The word for a time span is "within": the other word is banned in sim and content code.
 */
import { dealDamage } from '../combat/health';
import { gainResonance } from '../combat/resonance';
import type { Mods } from '../mods';
import type { Entity, Telegraph } from '../state';
import type { World } from '../world';
import { cuttingChorus } from './harmonies';
import { touchingThread } from './threadContact';

/** Float slack for sim-time comparisons (sim time is a sum of tick lengths). */
const EPS = 1e-9;
/** Razor Silk deals its damage a second in ticks this far apart (docs/phase-5g.md, N1). */
export const RAZOR_TICK = 0.5;
/** Thread the Needle: a telegraph striking within this long of the Thread's arrival is caught. */
export const NEEDLE_LEAD = 0.35;
/** Brimming Thread's barrier lasts this long from its last top-up. */
export const BRIMMING_SECONDS = 4;

/**
 * The Silk motif ids this file's resolver knows (`KNOWN_MOTIFS` lists them first). Return an
 * array literal: it is called while modules load. The trigger-only ones are listed too: every
 * motif in content must be known.
 */
export function silkMotifIds(): readonly string[] {
  return [
    'razor_silk',
    'whiplash',
    'slack_line',
    'gilded_wake',
    'quickening_thread',
    'brimming_thread',
    'warded_weft',
    'thread_the_needle',
    'gilt_edge',
    'stray_stitch',
    'spindle_turn',
    'kindred_wound',
  ];
}

/**
 * The resolver's cases for the Silk motifs (called from `resolveMods` for a motif no older case
 * knows). `v` is the motif's value at its level, in display units (30 = 30%, 1.5 = 1.5 s).
 * Every case accumulates (`+=` from 0, `*=` from 1, `Math.max` for "the larger"). Returns true
 * when `id` is a Silk motif.
 *
 * Fields: `razorDps` (Razor Silk, damage a second), `snapLockMult` (Slack Line, × the range
 * snap's lock), `empowerSpeedMult` (Quickening Thread), `needlePct` (Thread the Needle, a share
 * 0..1), `empoweredKillBonus` (Gilt Edge); existing `empowerLinger` (Gilded Wake, the larger, as
 * the Astrolabe's Afterglow takes it), `graceShieldPct` and `graceShieldDuration` (Brimming
 * Thread, the larger; the Overflowing Grace keystone assigns its own after motifs, so with it the
 * keystone's cap applies), `mendWarded` (Warded Weft, adds to the Astrolabe's Lifeguard).
 */
export function applySilkMotif(m: Mods, id: string, v: number): boolean {
  const pct = v / 100;
  switch (id) {
    case 'razor_silk':
      m.razorDps += v;
      return true;
    case 'slack_line':
      m.snapLockMult *= 1 - pct;
      return true;
    case 'gilded_wake':
      m.empowerLinger = Math.max(m.empowerLinger, v);
      return true;
    case 'quickening_thread':
      m.empowerSpeedMult *= 1 + pct;
      return true;
    case 'brimming_thread':
      m.graceShieldPct = Math.max(m.graceShieldPct, pct);
      m.graceShieldDuration = Math.max(m.graceShieldDuration, BRIMMING_SECONDS);
      return true;
    case 'warded_weft':
      m.mendWarded += pct;
      return true;
    case 'thread_the_needle':
      m.needlePct += pct;
      return true;
    case 'gilt_edge':
      m.empoweredKillBonus += v;
      return true;
    // Triggers only: their rules are resolved from content.
    case 'whiplash':
    case 'stray_stitch':
    case 'spindle_turn':
    case 'kindred_wound':
      return true;
    default:
      return false;
  }
}

/**
 * N1, Razor Silk's damage: called from `updateThread` (systems/thread.ts) every tick the Thread
 * is on a hero, after its range check, behind `if (world.mods.razorDps > 0)`. Every
 * `RAZOR_TICK` s, each standing enemy touching the Thread (`touchingThread`) takes
 * `razorDps × RAZOR_TICK`, the Weaver's, credited to `ledger.amplified` as Riposte Bloom's nova
 * is. The clock is `world.internal.razorAt` (the sim time of the next tick): created on the first
 * tick the Thread is on a hero, it waits one `RAZOR_TICK`; a clock left behind while the Thread
 * was off (more than a tick late) starts again the same way, so a re-attached Thread never cuts
 * at once. Cutting Chorus (W5, `cuttingChorus` in `src/sim/fill/harmonies.ts`) is asked only
 * while its fields are set, once per enemy struck: `mult` is the whole multiplier on that strike
 * (a critical one's included), `crit` marks it critical for the views. Draws nothing.
 */
export function razorSilk(world: World, _dt: number): void {
  const weaver = world.entities.get(world.weaverId);
  if (!weaver?.weaver || weaver.health?.downed) return;
  const due = world.internal.razorAt;
  if (due === undefined || due + RAZOR_TICK < world.time - EPS) {
    world.internal.razorAt = world.time + RAZOR_TICK;
    return;
  }
  if (world.time + EPS < due) return;
  world.internal.razorAt = due + RAZOR_TICK;
  const base = world.mods.razorDps * RAZOR_TICK;
  const chorus = world.mods.razorMult !== 1 || world.mods.razorCrit;
  const name = world.content.motifs.find((d) => d.id === 'razor_silk')?.name ?? 'Razor Silk';
  for (const enemy of touchingThread(world, [])) {
    const power = chorus ? cuttingChorus(world) : null;
    const r = dealDamage(world, enemy, {
      source: world.weaverId,
      sourceName: name,
      amount: power ? base * power.mult : base,
      ...(power?.crit ? { crit: true } : {}),
    });
    world.ledger.amplified += r.dealt + r.absorbed;
  }
}

/**
 * N2, Slack Line: called in `updateThread`'s range snap, after the lock is set and the snap is
 * reported, behind `if (world.mods.snapLockMult !== 1)`; returns the lock to keep (seconds):
 * `lock × snapLockMult`. The enemy cut's lock is Knotted Cord's `cutLockMult`, untouched.
 */
export function slackLineLock(world: World, lock: number): number {
  return lock * world.mods.snapLockMult;
}

/**
 * N3, Quickening Thread: called in `empowerBonus` (systems/thread.ts) behind
 * `if (world.mods.empowerSpeedMult !== 1)`; returns the multiplier on Empower's attack speed for
 * `hero` (the bonus is `content.thread.empowerAttackSpeed × potency × this`): `empowerSpeedMult`,
 * for every Empowered hero (the Thread's, a lingering Empower's, a Spotlight's).
 */
export function quickeningSpeed(world: World, _hero: Entity): number {
  return world.mods.empowerSpeedMult;
}

/**
 * N4, Thread the Needle (attach): called from `attachThread` (systems/thread.ts) after
 * `threadAttached`, behind `if (world.mods.needlePct > 0)`. Arms the catch: `hero.needleUntil`
 * is the sim time `NEEDLE_LEAD` s on (a later attach on the same hero moves it on).
 */
export function needleAttach(world: World, hero: Entity): void {
  if (hero.hero) hero.hero.needleUntil = world.time + NEEDLE_LEAD;
}

/**
 * N4, Thread the Needle (the catch): called in `hitEntity` (combat/telegraphs.ts) just before a
 * telegraph's damage lands on hero `e` (after a Perfect Ward or an Aegis Link would have taken
 * it), behind `if (e.hero?.needleUntil !== undefined)`; returns the damage that lands. The arming
 * is spent on the first telegraph to strike the hero, caught or not (`needleUntil` is deleted).
 * It catches only while it is in time (`time ≤ needleUntil`) and the Thread is still on that hero
 * (so sweeping the Thread across the party doesn't arm everyone): `needlePct` of the hit is
 * negated, half a Perfect Ward's Resonance is given (`gains.perfectWard / 2`; never Ringing
 * Parry's extra), and `needled { hero, telegraph, negated }` is emitted. Its credit comes once the
 * rest has landed (`needleKept`). No Ward refund, no stagger, not a Perfect: nothing that pays a
 * Perfect Ward fires on it.
 */
export function needleCatch(world: World, t: Telegraph, e: Entity, damage: number): number {
  const h = e.hero;
  if (!h || h.needleUntil === undefined) return damage;
  const until = h.needleUntil;
  delete h.needleUntil;
  const share = world.mods.needlePct;
  if (!(share > 0) || !(damage > 0) || world.time > until + EPS) return damage;
  const weaver = world.entities.get(world.weaverId);
  const w = weaver?.weaver;
  if (!w || weaver.health?.downed || w.threadSlot === null || world.party[w.threadSlot] !== e.id)
    return damage;
  const negated = damage * Math.min(1, share);
  world.events.push({
    type: 'needled',
    tick: world.tick,
    hero: e.id,
    telegraph: t.id,
    negated,
  });
  gainResonance(world, world.content.resonance.gains.perfectWard / 2, 'thread the needle');
  return damage - negated;
}

/**
 * N4, Thread the Needle (the credit): called in `hitEntity` (combat/telegraphs.ts) once the rest of
 * a caught hit has landed, behind `if (landing !== damage)`; `negated` is what the catch took off.
 * Credited to `ledger.shielded` and the hero's support with the life it kept, as a Perfect Ward's
 * is: what they still stand on, at most what it took off; none if the hit downs them anyway.
 */
export function needleKept(world: World, e: Entity, negated: number): void {
  const h = e.health;
  if (!h || h.downed || h.dead || !(negated > 0)) return;
  const kept = Math.min(negated, h.hp);
  world.ledger.shielded += kept;
  if (e.hero) e.hero.supportReceived += kept;
}

/**
 * N5, Gilt Edge: called in `killEnemy` (combat/health.ts) right after an Empowered kill's
 * Resonance, behind `if (world.mods.empoweredKillBonus > 0)`; `killer` is the Empowered hero.
 * Gives `empoweredKillBonus` more Resonance.
 */
export function giltEdge(world: World, _killer: Entity): void {
  gainResonance(world, world.mods.empoweredKillBonus, 'gilt edge');
}
