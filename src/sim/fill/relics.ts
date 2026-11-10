/**
 * Phase 5g, W6: the new relics' and boons' sim (docs/phase-5g.md, "Relics", "Events and boons";
 * content in `src/content/fill/relics.ts` and `fill/events.ts`). W0 placed every call site
 * (N24-N30); the bodies are here. Each runs only behind an early `if` on its own `Mods` field or
 * optional state. Relics resolve after motifs: accumulate into a field a motif or the Astrolabe
 * also sets (`+=`, `*=`), never assign over it.
 *
 * The rules of `src/sim/fill/silk.ts`'s header hold here too: no RNG, state only in W0's optional
 * keys (never `undefined`), `fillRelicIds` and `fillBoonIds` return array literals, no edits to
 * shared files. A cursed relic's curse applies only `!cleansed`.
 *
 * How each relic is built: Tin Whistle, Mender's Needle, Red Ink's curse and Hollow Crown use
 * existing `Mods` fields; Pilgrim's Lamp, Black Ribbon, Echoing Shell, Lament Pin, Sand Glass,
 * Bell Clapper, Heartwood Lute and Red Ink's blessing are triggers (their content's `triggers`,
 * sim/systems/triggers.ts), so their case here only marks them known; Spare Strings (N24),
 * Pedlar's Ledger (N25, run layer), Everbell (N26), Water Clock (N27), Iron Mask (N28), Hollow
 * Crown's floor (N29), Thornwreath (N30) and Prompt Book (W3's N15b reads its field) are hooks.
 */
import type { Content } from '../../content/schema';
import { PAST_SAMPLE_SECONDS, pastSamples } from '../constants';
import { reviveHero, type DamageOpts } from '../combat/health';
import type { Mods } from '../mods';
import type { Entity, PastSample, ThreadMode, WorldState } from '../state';
import type { World } from '../world';

// Only these sim modules are imported at runtime: `systems/rewind.ts` and `world.ts` (and the
// systems they load, which import this file) would bind to this module before
// `tests/fill/hooks.test.ts` can wrap it, so their two small helpers are written out below.

/** The Weaver (as `weaverOf` in sim/world.ts). */
function weaverOf(world: World): Entity {
  return world.entities.get(world.weaverId)!;
}

/** The oldest sample of a hero's record (as `pastOf` in systems/rewind.ts). */
function pastOf(hero: Entity): PastSample | null {
  const h = hero.hero;
  return h && h.past.length > 0 ? h.past[h.pastAt]! : null;
}

/** The relic ids this file's resolver knows (run-only ones need none). Return an array literal. */
export function fillRelicIds(): readonly string[] {
  return [
    'pilgrims_lamp',
    'tin_whistle',
    'black_ribbon',
    'spare_strings',
    'echoing_shell',
    'lament_pin',
    'sand_glass',
    'prompt_book',
    'thornwreath',
    'bell_clapper',
    'menders_needle',
    'everbell',
    'heartwood_lute',
    'water_clock',
    'iron_mask',
    'red_ink',
    'hollow_crown',
  ];
}

/** The boon ids this file's resolver knows. Return an array literal. */
export function fillBoonIds(): readonly string[] {
  return ['steadied', 'faltering'];
}

const num = (v: Readonly<Record<string, number>>, key: string): number => v[key] ?? 0;

/**
 * The resolver's cases for the new relics (called from `applyRelic` for an id no older case
 * knows). `v` is the relic's values, its Empowered numbers already merged in when a Dissonate
 * Empowered it; `cleansed`: a Forge lifted its curse. Pedlar's Ledger is `runOnly` (N25, below).
 * Returns true when `id` is one of this file's.
 */
export function applyFillRelic(
  m: Mods,
  id: string,
  v: Readonly<Record<string, number>>,
  cleansed: boolean,
): boolean {
  switch (id) {
    // Triggers only: their content's `triggers` act (mods.ts resolves them after this case).
    case 'pilgrims_lamp':
    case 'black_ribbon':
    case 'echoing_shell':
    case 'lament_pin':
    case 'sand_glass':
    case 'bell_clapper':
    case 'heartwood_lute':
      return true;
    case 'tin_whistle':
      m.responseBonus += num(v, 'resonance');
      return true;
    case 'spare_strings':
      m.spareSnap = true;
      return true;
    case 'prompt_book':
      m.firstCrescendoCut += num(v, 'cost');
      return true;
    case 'thornwreath':
      m.thornPct += num(v, 'pct') / 100;
      m.thornBelow = Math.max(m.thornBelow, num(v, 'below') / 100);
      return true;
    case 'menders_needle':
      m.reviveSpeedMult *= 1 + num(v, 'pct') / 100;
      return true;
    case 'everbell':
      // From the default 1: the relic's count is the Chime's whole count.
      m.chimeCharges += num(v, 'charges') - 1;
      return true;
    case 'water_clock':
      m.waterClock = Math.max(m.waterClock, num(v, 'seconds'));
      return true;
    case 'iron_mask':
      m.maskGuard += num(v, 'pct') / 100;
      if (!cleansed) m.noEmpower = true;
      return true;
    case 'red_ink':
      // The blessing is a trigger (a Perfect Ward's Resonance); the curse slows the Ward.
      if (!cleansed) m.wardCooldownCut -= num(v, 'slower');
      return true;
    case 'hollow_crown':
      m.cueCostBonus -= num(v, 'cut');
      m.cueCostFloor = true;
      if (!cleansed) m.soloChargeMult *= 1 - num(v, 'pct') / 100;
      return true;
    default:
      return false;
  }
}

/**
 * The resolver's cases for the new boons (Steadied, Faltering: existing `partyDamageMult`,
 * multiply). Returns true when `id` is one of this file's.
 */
export function applyFillBoon(m: Mods, id: string, v: Readonly<Record<string, number>>): boolean {
  switch (id) {
    case 'steadied':
      m.partyDamageMult *= 1 + num(v, 'pct') / 100;
      return true;
    case 'faltering':
      m.partyDamageMult *= 1 - num(v, 'pct') / 100;
      return true;
    default:
      return false;
  }
}

/**
 * N24, Spare Strings: called in `updateThread`'s range snap (systems/thread.ts), after the lock is
 * set, the snap reported and Slack Line applied, behind `if (world.mods.spareSnap)`; `hero` is
 * the hero it let go. Once a fight (`weaver.spareUsed`), the snap doesn't lock: the Thread can
 * attach again at once (the hero is out of reach as it snaps, so it can't hold on by itself).
 * It reports no `relicTriggered`: the audio's relic table pins the relics the sim reports, so
 * that cue is the presentation's to add.
 */
export function spareStrings(world: World, _hero: Entity): void {
  if (!world.mods.spareSnap) return;
  const w = weaverOf(world).weaver!;
  if (w.spareUsed) return;
  w.spareUsed = true;
  w.threadLock = 0;
}

/** A relic as the run holds it (meta's `OwnedRelic`, which the sim can't import). */
export interface HeldRelic {
  readonly id: string;
  readonly dormant?: boolean;
  readonly empowered?: boolean;
}

/**
 * N25, Pedlar's Ledger: called by the run layer's `makeShop` (src/meta/run.ts) for the number of
 * relics a merchant stocks: `SHOP_RELICS` + this. `relics` is the run's (a dormant one plays no
 * effect; an Empowered one its Empowered `more`). Pure. Without the relic: exactly 0.
 */
export function shopRelicBonus(relics: readonly HeldRelic[], content: Content): number {
  let more = 0;
  for (const r of relics) {
    if (r.id !== 'pedlars_ledger' || r.dormant) continue;
    const def = content.relics.find((d) => d.id === r.id);
    if (!def) continue;
    const values =
      r.empowered && def.empowered ? { ...def.values, ...def.empowered.values } : def.values;
    more += num(values, 'more');
  }
  return more;
}

/**
 * N26, Everbell (spawn): called in `createWorld` (sim/world.ts) once the Weaver exists, behind
 * `if (mods.chimeCharges > 1)`. She starts with every charge, and no recharge running.
 */
export function everbellSpawn(world: World, weaver: Entity): void {
  weaver.weaver!.chimeCharges = world.mods.chimeCharges;
}

/**
 * N26, Everbell (a cast): called in `castChime` (systems/techniques.ts) after the Chime's
 * cooldown is set, behind `if (w.chimeCharges !== undefined)`. A Chime is refused while
 * `cooldowns.chime > 0`, so the charge clock is `weaver.chimeRecharge`: the cast spends a charge
 * and starts that clock (at the cooldown just set) if none is running. While a charge is left,
 * `cooldowns.chime` goes back to 0; with none left it reads the clock's time, so the Chime comes
 * back exactly when the next charge does.
 */
export function everbellCast(_world: World, weaver: Entity): void {
  const w = weaver.weaver!;
  const charges = Math.max(0, (w.chimeCharges ?? 1) - 1);
  w.chimeCharges = charges;
  if (w.chimeRecharge === undefined) w.chimeRecharge = w.cooldowns.chime;
  w.cooldowns.chime = charges > 0 ? 0 : w.chimeRecharge;
}

/**
 * N26, Everbell (the clock): called in `updateWeaver` (systems/weaver.ts) after the techniques'
 * cooldowns tick, behind `if (w.chimeCharges !== undefined)`. Runs `chimeRecharge` down and gives
 * a charge back when it ends, starting the next one while she is short. With no charge left, the
 * Chime's own cooldown is the gate: anything that cut it (Sand Glass, Temporal Mastery) cuts the
 * clock with it, so the two never disagree.
 */
export function everbellTick(world: World, weaver: Entity, dt: number): void {
  const w = weaver.weaver!;
  const recharge = w.chimeRecharge;
  if (recharge === undefined) return;
  const charges = w.chimeCharges ?? 0;
  let left = Math.max(0, recharge - dt);
  if (charges === 0) left = Math.min(left, w.cooldowns.chime);
  if (left > 0) {
    w.chimeRecharge = left;
    return;
  }
  const now = charges + 1;
  w.chimeCharges = now;
  w.cooldowns.chime = 0;
  if (now < world.mods.chimeCharges) w.chimeRecharge = w.cooldownTotals.chime;
  else delete w.chimeRecharge;
}

/**
 * N27, Water Clock (spawn): called in `createWorld` (sim/world.ts) for each hero right after it
 * spawns, behind `if (mods.waterClock > 0)`. The history buffer is allocated only here, as long
 * as the relic reaches, when the Chronomancer's Rewind hasn't made one (with her it already holds
 * `rewindSeconds`, which Rewind's reach reads, so it is left alone: Water Clock then reaches as
 * far back as Rewind does).
 */
export function waterClockSpawn(world: World, hero: Entity): void {
  const h = hero.hero;
  const health = hero.health;
  if (!h || !health || h.past.length > 0) return;
  const n = pastSamples(world.mods.waterClock);
  h.past = Array.from({ length: n }, () => ({ hp: health.hp, x: hero.x, z: hero.z, up: true }));
  h.pastAt = 0;
}

/**
 * N27, Water Clock (the record): called first in `recordPast` (systems/rewind.ts), behind
 * `if (world.mods.waterClock > 0 && world.mods.rewindSeconds <= 0)`: the heroes' life and place
 * every 0.1 s of sim time, exactly as Rewind records them.
 */
export function waterClockPast(world: World): void {
  // As `samplePast` (systems/rewind.ts) does it: every 0.1 s of sim time, into each ring buffer.
  const internal = world.internal;
  if (world.time + 1e-9 < internal.pastSampleAt) return;
  internal.pastSampleAt += PAST_SAMPLE_SECONDS;
  if (internal.pastSampleAt <= world.time) internal.pastSampleAt = world.time + PAST_SAMPLE_SECONDS;
  for (const id of world.party) {
    const e = world.entities.get(id);
    const h = e?.hero;
    if (!e?.health || !h || h.past.length === 0) continue;
    const sample = h.past[h.pastAt]!;
    sample.hp = e.health.hp;
    sample.x = e.x;
    sample.z = e.z;
    sample.up = !e.health.downed;
    h.pastAt = (h.pastAt + 1) % h.past.length;
  }
}

/**
 * N27, Water Clock (a down): called at the end of `downHero` (combat/health.ts), once the hero
 * is down and every down effect has run, behind `if (world.mods.waterClock > 0)`. Once a fight
 * (`world.internal.waterClockUsed`), time turns back for them: they stand again where they stood
 * and with the life they had as far back as the record reaches. Not when they were already down
 * then (or there is no record): the turn back is then still unspent. The views see it as the
 * `allyDowned` and then the `revived` of the same tick (no `relicTriggered`, as Spare Strings).
 */
export function waterClockDowned(world: World, hero: Entity): void {
  if (!(world.mods.waterClock > 0) || world.internal.waterClockUsed) return;
  const h = hero.health;
  const past = pastOf(hero);
  if (!h || h.dead || !h.downed || !past || !past.up) return;
  world.internal.waterClockUsed = true;
  reviveHero(world, hero, 0);
  h.hp = Math.min(h.maxHp, Math.max(1, past.hp));
  hero.x = hero.px = past.x;
  hero.z = hero.pz = past.z;
  hero.vx = 0;
  hero.vz = 0;
}

/**
 * N27, Water Clock (a hero lost): called first in `heroOut` (combat/health.ts), behind
 * `if (world.mods.waterClock > 0)`. The relic acts as a hero goes down (`waterClockDowned`), so a
 * bleed-out running out is never turned back: always false.
 */
export function waterClockOut(_world: World, _hero: Entity): boolean {
  return false;
}

/**
 * N28, Iron Mask (the curse): called first in `toggleThreadMode` (systems/thread.ts), before the
 * mode changes, behind `if (world.mods.noEmpower)`; `mode` is the toggle's argument (`'bear'`,
 * the Martyr's Bear on and off, or absent: Mend ⇄ Empower, or back out of Bear to `lastMode`).
 * True (refused, as `locked`) for a toggle that would set `'empower'`.
 */
export function ironMaskRefuses(world: World, mode: 'bear' | undefined): boolean {
  if (!world.mods.noEmpower) return false;
  const w = weaverOf(world).weaver!;
  let next: ThreadMode;
  if (mode === 'bear') next = w.threadMode === 'bear' ? w.lastMode : 'bear';
  else if (w.threadMode === 'bear') next = w.lastMode;
  else next = w.threadMode === 'mend' ? 'empower' : 'mend';
  return next === 'empower';
}

/**
 * N28, Iron Mask (the guard): called in `dealDamage` (combat/health.ts), beside Haloed, Full Chord
 * and Closed Circle, on a hit to a hero, behind `if (target.hero && world.mods.maskGuard > 0)`;
 * returns the damage it takes off `amount`: its share of everything.
 */
export function ironMaskGuard(
  world: World,
  _target: Entity,
  amount: number,
  _opts: DamageOpts,
): number {
  return amount * Math.min(1, world.mods.maskGuard);
}

/**
 * N29, Hollow Crown: called in `cueCostNow` (systems/conducting.ts) after N15, behind
 * `if (state.mods.cueCostFloor)`; the Cue's price, never below 0 (on the beat with A Tempo a Cue
 * costs `cueCostBonus` alone, which Hollow Crown makes negative). Pure.
 */
export function cueCostFloor(state: WorldState, cost: number): number {
  if (!state.mods.cueCostFloor) return cost;
  return Math.max(0, cost);
}

/**
 * N30, Thornwreath: called in `dealDamage` (combat/health.ts) on a hero's hit on an enemy, beside
 * Anthem and Shield Bearer (its extra is the Weaver's share), behind
 * `if (world.mods.thornPct > 0)`; the multiplier for `source`: 1 + `thornPct` while they are
 * below `thornBelow` of their life, else exactly 1.
 */
export function thornwreathMult(world: World, source: Entity): number {
  if (!(world.mods.thornPct > 0)) return 1;
  const h = source.health;
  if (!h || !(h.hp < h.maxHp * world.mods.thornBelow)) return 1;
  return 1 + world.mods.thornPct;
}
