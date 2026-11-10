/**
 * Phase 5g, W5: the Harmonies' sim (docs/phase-5g.md, "Harmonies"; content in
 * `src/content/fill/harmonies.ts`). Harmonies are the only new entries allowed to be "more"
 * sources (02 §12 rule 1; `tests/fill/moreSources.test.ts` counts them). W0 placed every call
 * site; the bodies are here. Each runs only behind an early `if` on its own `Mods` field, and
 * each body checks its own field again, so called on a world without it, it does nothing. A
 * Harmony's aura condition ("with Fortissimo in your songs") is checked here, at the time of
 * use, from `world.field.chords` (read, never written): never an aura's numbers, reach,
 * reservation or who it reaches. Guardian's Cadence and Crossed Steel are triggers (their rules
 * are in content, run by sim/systems/triggers.ts); Tempo Rubato sets `freeCueEvery`, which W3's
 * N15 body (`cueCostCut`, src/sim/fill/finale.ts) reads.
 *
 * The rules of `src/sim/fill/silk.ts`'s header hold here too: state only in W0's optional keys
 * (never `undefined`), `harmonyMotifIds` returns an array literal, no edits to shared files, and
 * no runtime import of `world.ts` or of a system module that imports this file (`thread.ts`,
 * `heroes.ts`, `solos.ts`...): it would bind this module before `tests/fill/hooks.test.ts` can
 * wrap it, so the two small helpers that need them are copied below. One random draw exists:
 * Cutting Chorus's crit, taken only with the Harmony held and Fortissimo in the songs.
 */
import { addStatus, isActive, shieldOf, type DamageOpts } from '../combat/health';
import type { Mods } from '../mods';
import type { Entity } from '../state';
import type { World } from '../world';
import { touchingThread } from './threadContact';

/** Float slack for sim-time comparisons (sim time is a sum of tick lengths). */
const EPS = 1e-9;
/**
 * Cutting Chorus: a Razor Silk strike is critical with this chance, for this multiple. The same
 * numbers as a hero's crit (`CRIT_CHANCE`, `CRIT_MULT` in systems/heroDamage.ts, not exported),
 * drawn from the same stream (`world.rng.combat`).
 */
export const RAZOR_CRIT_CHANCE = 0.1;
export const RAZOR_CRIT_MULT = 1.6;
/** Spindle Lullaby: an enemy it put to sleep can be slept by it again this long after. */
export const LULLABY_EVERY = 8;
/** Concert Pitch: the ring lasts this long after a Perfect Ward. */
export const RINGING_SECONDS = 4;
/** Wounded Healer: below this share of the Weaver's Life (`maxLife`). */
export const WOUNDED_BELOW = 0.5;

/** The Harmony ids this file's resolver knows (the trigger ones too). An array literal. */
export function harmonyMotifIds(): readonly string[] {
  return [
    'woven_aegis',
    'cutting_chorus',
    'guardians_cadence',
    'spindle_lullaby',
    'tempo_rubato',
    'concert_pitch',
    'grand_staff',
    'crossed_steel',
    'wounded_healer',
    'closed_circle',
  ];
}

/**
 * The resolver's cases for the Harmonies (see `applySilkMotif`). `v` is the value in display
 * units (30 = 30%, 1 = 1 s). Every case accumulates (`+=` from 0, `*=` from 1, `Math.max` for
 * "the larger"). Fields: `razorMult` and `razorCrit` (Cutting Chorus), `razorSleep` (Spindle
 * Lullaby, seconds, the larger), `freeCueEvery` (Tempo Rubato: the shorter period, 0 is none),
 * `wovenRefill` (Woven Aegis, a share 0..1), `ringingPct` and `ringingSeconds` (Concert Pitch;
 * the seconds the larger), `staffMult` (Grand Staff, × the charge), `woundedBonus` (Wounded
 * Healer, a share 0..1), `circleGuard` (Closed Circle, a share 0..1). Guardian's Cadence and
 * Crossed Steel are triggers. Returns true when `id` is a Harmony of this file.
 */
export function applyHarmonyMotif(m: Mods, id: string, v: number): boolean {
  const pct = v / 100;
  switch (id) {
    case 'woven_aegis':
      m.wovenRefill += pct;
      return true;
    case 'cutting_chorus':
      m.razorMult *= 1 + pct;
      m.razorCrit = true;
      return true;
    case 'spindle_lullaby':
      m.razorSleep = Math.max(m.razorSleep, v);
      return true;
    case 'tempo_rubato':
      m.freeCueEvery = m.freeCueEvery > 0 ? Math.min(m.freeCueEvery, v) : v;
      return true;
    case 'concert_pitch':
      m.ringingPct += pct;
      m.ringingSeconds = Math.max(m.ringingSeconds, RINGING_SECONDS);
      return true;
    case 'grand_staff':
      m.staffMult *= 1 + pct;
      return true;
    case 'wounded_healer':
      m.woundedBonus += pct;
      return true;
    case 'closed_circle':
      m.circleGuard += pct;
      return true;
    // Triggers only: their rules are resolved from content.
    case 'guardians_cadence':
    case 'crossed_steel':
      return true;
    default:
      return false;
  }
}

/**
 * `aura` sings in the songs now: carried by a Chord, not the stolen verse (docs/phase-5c.md), and
 * the field not suppressed (the Weaver downed or in a Mute's dome silences every Chord), as
 * `aurasInSongs` (src/sim/fill/choir.ts) counts them. Read only.
 */
export function inSongs(world: World, aura: string): boolean {
  const f = world.field;
  if (f.suppressed) return false;
  const stolen = f.stolen;
  for (const chord of f.chords)
    for (const [j, id] of chord.auras.entries())
      if (id === aura && !(stolen && stolen.chord === chord.index && stolen.aura === j))
        return true;
  return false;
}

/**
 * N1, Cutting Chorus: Razor Silk's power for one strike, for W1's `razorSilk`
 * (src/sim/fill/silk.ts), which asks once per enemy struck while `razorMult !== 1` or
 * `razorCrit`, deals `base × mult`, and passes `crit` on. With Fortissimo in the songs: `mult` is
 * `razorMult`, times `RAZOR_CRIT_MULT` on a critical strike (`razorCrit`: one draw of
 * `RAZOR_CRIT_CHANCE` from `world.rng.combat`, as a hero's crit is drawn). Without Fortissimo, or
 * without the Harmony's fields: `{ mult: 1, crit: false }`, and nothing is drawn.
 */
export function cuttingChorus(world: World): { mult: number; crit: boolean } {
  const m = world.mods;
  if (m.razorMult === 1 && !m.razorCrit) return { mult: 1, crit: false };
  if (!inSongs(world, 'fortissimo')) return { mult: 1, crit: false };
  const crit = m.razorCrit && world.rng.combat.chance(RAZOR_CRIT_CHANCE);
  return { mult: m.razorMult * (crit ? RAZOR_CRIT_MULT : 1), crit };
}

/**
 * N1, Spindle Lullaby: called from `updateThread` (systems/thread.ts) every tick the Thread is on
 * a hero, after its range check, behind `if (world.mods.razorSleep > 0)`. With Lullaby in the
 * songs and the Weaver standing, each ordinary (`tier === 'normal'`) enemy touching the Thread
 * (`touchingThread`) whose clock allows it is put to sleep for `razorSleep` s (`addStatus`, the
 * Weaver's); once it is, its clock (`world.internal.lullabyReady[id]`, the sim time it may be
 * slept by this again) is set `LULLABY_EVERY` s on. The record is created on the first sleep, so
 * it is absent until the Harmony has acted. Draws nothing.
 */
export function spindleLullaby(world: World, _dt: number): void {
  const seconds = world.mods.razorSleep;
  if (!(seconds > 0)) return;
  const weaver = world.entities.get(world.weaverId);
  if (!weaver?.weaver || weaver.health?.downed) return;
  if (!inSongs(world, 'lullaby')) return;
  for (const enemy of touchingThread(world, [])) {
    if (enemy.enemy?.tier !== 'normal') continue;
    const ready = world.internal.lullabyReady?.[enemy.id];
    if (ready !== undefined && world.time + EPS < ready) continue;
    if (!addStatus(world, enemy, 'sleep', seconds, world.weaverId)) continue;
    const clocks = (world.internal.lullabyReady ??= {});
    clocks[enemy.id] = world.time + LULLABY_EVERY;
  }
}

/**
 * N19, Woven Aegis: called in `mendHero` (systems/thread.ts) after each tick of Mend on `hero`
 * (the threaded one, and the Prism Loom's spill), behind `if (world.mods.wovenRefill > 0)`;
 * `healed` is the life it gave back. A Ward on the hero (its `ward` shield, still holding) is
 * refilled by `wovenRefill` of it, never above the Ward's `max`.
 */
export function wovenAegis(world: World, hero: Entity, healed: number): void {
  const share = world.mods.wovenRefill;
  if (!(share > 0) || !(healed > 0) || !hero.health) return;
  const ward = shieldOf(hero.health, 'ward');
  if (!ward || !(ward.amount > 0)) return;
  ward.amount = Math.min(ward.max, ward.amount + healed * share);
}

/**
 * N20, Concert Pitch (the Perfect): called in `perfect` (combat/telegraphs.ts) after the Perfect
 * Ward's own effects, behind `if (world.mods.ringingPct > 0)`. `world.field.ringing` becomes now +
 * `ringingSeconds` (a later Perfect starts it over).
 */
export function concertPitchRing(world: World, _hero: Entity): void {
  if (!(world.mods.ringingPct > 0) || !(world.mods.ringingSeconds > 0)) return;
  world.field.ringing = world.time + world.mods.ringingSeconds;
}

/**
 * N20, Concert Pitch (the damage): called in `dealDamage` (combat/health.ts) on a hero's hit on
 * an enemy, behind `if (world.mods.ringingPct > 0)`; returns exactly `1 + ringingPct` while
 * `field.ringing` is later than now, else exactly 1.
 */
export function concertPitchMult(world: World, _source: Entity): number {
  const pct = world.mods.ringingPct;
  if (!(pct > 0)) return 1;
  const until = world.field.ringing;
  return until !== undefined && until > world.time ? 1 + pct : 1;
}

/**
 * N21, Grand Staff: called in `updateHeroes` (systems/heroes.ts) just before a hero's Solo charges
 * for the tick (only while it can charge), behind `if (world.mods.staffMult !== 1)`. While the
 * hero is Empowered (`empowered`, below: the same test a hero's hit uses), adds
 * `staffMult − 1` times the tick's normal charge (`100 / chargeTime × soloChargeMult × dt`), never
 * above 100. The normal charge after it reports `soloReady`.
 */
export function grandStaffCharge(world: World, hero: Entity, dt: number): void {
  const extra = world.mods.staffMult - 1;
  const h = hero.hero;
  if (!(extra > 0) || !h || h.soloActive > 0 || h.solo >= 100) return;
  if (!empowered(world, hero)) return;
  const chargeTime = soloChargeTime(world, hero);
  if (!(chargeTime > 0)) return;
  const normal = (100 / chargeTime) * world.mods.soloChargeMult * dt;
  h.solo = Math.min(100, h.solo + normal * extra);
}

/**
 * `hero` is Empowered now: `empowerBonus(world, hero).more > 0` (systems/thread.ts), the test a
 * hero's hit uses (`heroDamage`'s `empowered`). Copied, not imported: a runtime import of a
 * system module that imports this file binds it before `tests/fill/hooks.test.ts` can wrap it.
 * The Empowering Thread's potency on the hero (its own, or the Prism Loom's share), else a
 * lingering Empower (`afterglowUntil`), else (the Conductor) a Spotlight.
 */
function empowered(world: World, hero: Entity): boolean {
  if (!(world.content.thread.empowerMore * world.mods.empowerMult > 0)) return false;
  const weaver = world.entities.get(world.weaverId);
  const w = weaver?.weaver;
  let p = 0;
  if (w?.threadMode === 'empower' && w.threadSlot !== null && !weaver!.health!.downed) {
    const potency = 1 - w.threadTension * (1 - world.content.thread.tautPotency);
    const threadedId = world.party[w.threadSlot];
    if (threadedId === hero.id) p = potency;
    else if (world.mods.prismRadius > 0 && isActive(hero)) {
      const threaded = threadedId === undefined ? undefined : world.entities.get(threadedId);
      const r = world.mods.prismRadius + hero.radius;
      const dx = threaded ? threaded.x - hero.x : 0;
      const dz = threaded ? threaded.z - hero.z : 0;
      if (isActive(threaded) && dx * dx + dz * dz <= r * r) p = potency * world.mods.prismPotency;
    }
  }
  if (!(p > 0)) p = (hero.hero?.afterglowUntil ?? 0) > world.time ? 1 : 0;
  if (p > 0) return true;
  const solos = world.field.conducting?.solos;
  const spot = solos?.find((s) => s.hero === hero.id);
  return !!spot?.spotlight && world.mods.spotlightMult > 0;
}

/**
 * The hero's Solo charge time, as `soloSpec` (systems/solos.ts) gives it: its own Solo's, or the
 * alternate Solo it has slotted. Copied for the same reason as `empowered`.
 */
function soloChargeTime(world: World, hero: Entity): number {
  const h = hero.hero!;
  const own = world.content.heroes.find((d) => d.id === h.defId)?.solo;
  if (own && h.soloId === own.id) return own.chargeTime;
  return world.content.altSolos.find((s) => s.id === h.soloId)?.chargeTime ?? 0;
}

/**
 * N22, Wounded Healer (Mend): called in `mendBonus` (systems/thread.ts) behind
 * `if (m.woundedBonus > 0)`; returns the multiplier on Mend for `hero`: `1 + woundedBonus` while
 * the Weaver is below `WOUNDED_BELOW` of her Life (`weaver.maxLife`), else exactly 1.
 */
export function woundedMendMult(world: World, _hero: Entity): number {
  return wounded(world) ? 1 + world.mods.woundedBonus : 1;
}

/**
 * N22, Wounded Healer (the Ward): called in `castWard` (systems/techniques.ts), beside Blood
 * Tithe and Last Bastion, behind `if (world.mods.woundedBonus > 0)`; returns the multiplier on
 * the Ward's barrier, as for Mend.
 */
export function woundedWardMult(world: World, _hero: Entity): number {
  return wounded(world) ? 1 + world.mods.woundedBonus : 1;
}

function wounded(world: World): boolean {
  if (!(world.mods.woundedBonus > 0)) return false;
  const weaver = world.entities.get(world.weaverId);
  if (!weaver?.weaver || !weaver.health) return false;
  return weaver.health.hp < weaver.weaver.maxLife * WOUNDED_BELOW;
}

/**
 * N23, Closed Circle: called in `dealDamage` (combat/health.ts), beside Full Chord, on a hit to a
 * hero, behind `if (target.hero && world.mods.circleGuard > 0)`; returns the damage it takes off
 * `amount`: `circleGuard` of it (at most all of it) on any hit to a standing hero while every
 * standing hero is `inField` (read only). What it takes off is credited to `ledger.shielded`, as
 * Full Chord's and Haloed's guards are, capped at the life the hero has.
 */
export function closedCircleGuard(
  world: World,
  target: Entity,
  amount: number,
  _opts: DamageOpts,
): number {
  const share = world.mods.circleGuard;
  if (!(share > 0) || !target.hero || !isActive(target) || !(amount > 0)) return 0;
  for (const id of world.party) {
    const e = world.entities.get(id);
    if (e?.hero && isActive(e) && !e.hero.inField) return 0;
  }
  const removed = amount * Math.min(1, share);
  world.ledger.shielded += Math.min(removed, target.health.hp);
  return removed;
}
