/**
 * The Finale's boss script (docs/phase-5d.md): the Silent Conductor, registered in `BOSS_SCRIPTS`
 * (bossScripts.ts) and built like Movement III's (unstitchedBosses.ts).
 *
 * - **Phases 1-2** (Overture, Mirror Choir): it Raises its mirror-choir as elite `pendingSpawns`
 *   with a ground warning each, Cues a voice (its own `conductor_cue` cast, resolved here into the
 *   voice's Solo through `beginAttack`), and keeps the Conductor's **Discord**: a passive swell plus
 *   every failed Finale telegraph (the verdict hook). At 100 it plays **Fortissimo Silence**, a P7
 *   chain of three raid pulses, which any Crescendo cancels (the crescendo hook).
 * - **Phase 3** (Grand Silence): the choir shatters, the heroes are `stilled`, and only the
 *   program's telegraphs (Rest → Measure → Cadence, scheduled from impacts) touch them. Eight notes
 *   (Perfects, clutch Chimes, Reel-saves, Rewinds that undo a silence blow; ledger diffs) Reignite
 *   the party; at the cap comes the Coda. Then the last burn: Downbeat and Sforzando, begun here.
 *
 * Its public state is the lazy `field.finale`, its clocks and ledger snapshots the lazy
 * `internal.m4`; both are deleted at its death and the encounter's end, with `stilled`. Nothing
 * here runs for any other boss: the registry's lookup misses for their ids. Every number is a
 * named constant in content (`crucible.ts`, `crucibleIds.ts`) or below. Its only `rng.ai` draws are
 * the Raise's ring points and the Lament's and Rest's `randomNonTank` targets.
 *
 * The script is built by a hoisted function, not held in a `const`, so the registry can be filled
 * whichever module of the enemies ↔ bossScripts ↔ conductorBoss cycle loads first.
 */
import { attackDef, heroDef } from '../../content';
import {
  CHOIR_CAP,
  CHOIR_RING,
  CONDUCTOR_DECREES,
  CUE_EVERY,
  CUE_RETRY,
  DISCORD_RATE,
  BURN_EVERY,
  LIVE_CAP,
  RAISE_WARNING,
  SILENCE_STEPS,
  SOLO_PER_NOTE,
  soloDecree,
} from '../../content/crucible';
import {
  ALTO,
  BASS,
  CHOIR,
  CUE,
  DISCORD_MAX,
  DISCORD_P2_FLOOR,
  DOWNBEAT,
  FINAL_CADENCE,
  FORTISSIMO,
  GRAND_SILENCE,
  HALF_CADENCE,
  MEASURE,
  NOTES_NEEDED,
  RAISE,
  REST,
  REVIVE_PCT,
  SFORZANDO,
  SILENCE_CAP,
  SOLOS,
  SOPRANO,
  TENOR,
} from '../../content/crucibleIds';
import type { AttackDef } from '../../content/schema';
import { SIM_DT } from '../constants';
import { announceDecree, setTimeScale } from '../combat/feedback';
import {
  addStatus,
  hasStatus,
  interruptEnemy,
  isActive,
  isDisabled,
  killEnemy,
  NEVER,
  removeStatus,
  reviveHero,
} from '../combat/health';
import { cancelTelegraph } from '../combat/telegraphs';
import { pickEnemyTarget } from '../combat/threat';
import type { AnswerTag } from '../events';
import type { Entity, EntityId, FinaleField, NoteSource, Telegraph } from '../state';
import type { World } from '../world';
import type { BossScript, ScriptedNext } from './bossScripts';
import { beginAttack, ensureM2, ensureM4, ringPoint } from './enemies';

type M4 = NonNullable<World['internal']['m4']>;

// ── Rules this script adds (the content holds the rest) ──────────────────────────────

/** A Raise brings at most this many voices (the Alto and the Bass; the Tenor and the Soprano). */
const RAISE_MAX = 2;
/** The voices the Overture Raises, in order; the Mirror Choir Raises the whole `CHOIR`. */
const OVERTURE_VOICES = [ALTO, BASS] as const;
/** The voices the Mirror Choir's entry Raise brings, whatever the cap (docs/phase-5d.md). */
const MIRROR_VOICES = [TENOR, SOPRANO] as const;
/** A Rewind makes at most one note this often (s; docs/phase-5d.md Q8). */
const REWIND_NOTE_EVERY = 18;
/** Every voice of the mirror-choir. */
const VOICES: ReadonlySet<string> = new Set(CHOIR);
/** Every Solo a voice sings. */
const SOLO_IDS: ReadonlySet<string> = new Set(Object.values(SOLOS));
/** The Grand Silence's program attacks (the Measure and the Cadences at a hero's feet). */
const PROGRAM: ReadonlySet<string> = new Set([REST, MEASURE, FINAL_CADENCE, HALF_CADENCE]);
const FORTISSIMO_IDS: ReadonlySet<string> = new Set(FORTISSIMO);
/** The silence keeps the boss untouchable and its melee held at least this far ahead (s). */
const SILENCE_HOLD = 0.5;
/** Reignite's barks, one per party hero as they unfreeze (docs/phase-5d.md, "Eight notes"). */
const REIGNITE_BARKS: Readonly<Record<string, string>> = {
  kael: 'Still needed.',
  lyra: 'You had my back.',
  vexis: 'It… resolves.',
  brann: 'A pain I can sing to.',
  // Seren and Oro (docs/phase-5e.md): appended.
  seren: 'Again!',
  oro: 'Grow!',
};
/** Reignite's beat of slow motion (the Crescendo's). */
const REIGNITE_SCALE = 0.5;
const REIGNITE_TICKS = 12;
/** Each phase Decree is heard again on the phase's first Cue (the Grand Silence's on its first
 * Measure), so a fast phase still hears it twice. */
const PHASE_DECREE_AGAIN = 1;
/** The phase Decrees' answers (the PHASES row's, bosses.ts). */
const PHASE_ANSWERS: readonly (readonly AnswerTag[])[] = [
  ['focus', 'ward', 'chime', 'reel'],
  ['focus', 'crescendo'],
  ['ward', 'chime', 'reel'],
];

/** Every clock the script keeps in `m4`: Stasis waits each one. */
const CLOCKS = [
  'nextCueAt',
  'nextRaiseAt',
  'nextRestAt',
  'nextMeasureAt',
  'nextCadenceAt',
  'nextDownbeatAt',
  'nextSforzandoAt',
  'nextRewindNoteAt',
] as const;

// ── The registry's entry ─────────────────────────────────────────────────────────────

/** The Silent Conductor's script. */
export function conductorScript(): BossScript {
  return {
    update: conductorUpdate,
    tick: conductorTick,
    enter: conductorEnter,
    resolved: conductorResolved,
    scriptedNext: conductorNext,
    onAddDeath: conductorAddDeath,
    onDeath: conductorDeath,
    stasis: conductorStasis,
    cleanup,
    telegraphVerdict: conductorVerdict,
    crescendo: conductorCrescendo,
  };
}

// ── Shared ───────────────────────────────────────────────────────────────────────────

function due(world: World, at: number | undefined): boolean {
  return at !== undefined && world.time >= at - 1e-9;
}

function enraged(world: World): boolean {
  return world.internal.boss.enraged;
}

/** Sim time the current phase shift ends (set before a script's `enter` runs). */
function shiftEnd(world: World): number {
  return world.internal.boss.phaseShiftUntil;
}

function shifting(world: World): boolean {
  return world.time < world.internal.boss.phaseShiftUntil;
}

/** The standing boss (null once it has fallen). */
function standingBoss(world: World): Entity | null {
  const id = world.encounter.bossId;
  const boss = id === null ? undefined : world.entities.get(id);
  return boss?.enemy && isActive(boss) ? boss : null;
}

/** An entity's current target if it can still be hit. */
function currentTarget(world: World, e: Entity): Entity | null {
  const id = e.enemy!.targetId;
  const target = id === null ? undefined : world.entities.get(id);
  return isActive(target) ? target : null;
}

/** The telegraph `e`'s cast just began (undefined if it has none). */
function castTelegraph(world: World, e: Entity): Telegraph | undefined {
  const id = e.enemy?.cast?.telegraph;
  return id === null || id === undefined ? undefined : world.telegraphs.find((t) => t.id === id);
}

/** Damaging telegraphs live now, whoever owns them (the Cue gate and the silence's cap). */
function liveDamaging(world: World): number {
  let n = 0;
  for (const t of world.telegraphs) if (t.effect === 'damage') n++;
  return n;
}

function soloLive(world: World): boolean {
  return world.telegraphs.some((t) => SOLO_IDS.has(t.attackId));
}

/** The Weaver's Crescendo (any Calling's) is running. */
function crescendoRunning(world: World): boolean {
  return (world.entities.get(world.weaverId)?.weaver?.crescendo ?? 0) > 0;
}

function announce(
  world: World,
  boss: Entity,
  name: string,
  text: string,
  answers: readonly AnswerTag[],
): void {
  announceDecree(world, {
    type: 'decree',
    tick: world.tick,
    boss: boss.id,
    name,
    text,
    answers: [...answers],
  });
}

/** The Decree of phase `phase` (1-based), the Grand Silence's in the Calling's own words. */
function phaseDecreeOf(world: World, phase: number): { name: string; text: string } {
  if (phase === 1) return { name: 'Overture', text: CONDUCTOR_DECREES.overture };
  if (phase === 2) return { name: 'Mirror Choir', text: CONDUCTOR_DECREES.mirrorChoir };
  // The Chronomancer's Reel slot casts Rewind: a Rewind that undoes a blow is her note (Q8).
  const rewind = world.mods.rewindSeconds > 0;
  return {
    name: 'Grand Silence',
    text: rewind ? CONDUCTOR_DECREES.grandSilenceRewind : CONDUCTOR_DECREES.grandSilence,
  };
}

/**
 * The phase's Decree again, on its signature cast's first `PHASE_DECREE_AGAIN` (counted by a
 * per-phase key in `m2.decrees`, beside the attacks' own `decreeLimit` counts).
 */
function phaseDecreeAgain(world: World, boss: Entity, phase: number): void {
  const key = `${CUE}_phase_${phase}`;
  const decrees = (ensureM2(world).decrees ??= {});
  const n = decrees[key] ?? 0;
  if (n >= PHASE_DECREE_AGAIN) return;
  decrees[key] = n + 1;
  const d = phaseDecreeOf(world, phase);
  announce(world, boss, d.name, d.text, PHASE_ANSWERS[phase - 1]!);
}

/** The soonest of the due-able casts, the first listed on a tie. */
function soonest(options: (ScriptedNext | null)[]): ScriptedNext | null {
  let best: ScriptedNext | null = null;
  for (const o of options) if (o && (!best || o.at < best.at - 1e-9)) best = o;
  return best;
}

/** Every party hero (standing or not). */
function partyHeroes(world: World): Entity[] {
  const heroes: Entity[] = [];
  for (const id of world.party) {
    const e = world.entities.get(id);
    if (e?.hero && e.health) heroes.push(e);
  }
  return heroes;
}

/** The Grand Silence's freeze comes off every hero. */
function unstill(world: World): void {
  for (const e of partyHeroes(world))
    if (hasStatus(e, 'stilled')) removeStatus(world, e, 'stilled', 'expired');
}

/** The encounter ended: nothing the script made outlives it (director.ts deletes these too). */
function cleanup(world: World): void {
  delete world.field.finale;
  delete world.internal.m4;
  unstill(world);
}

/**
 * The fight's public state and clocks, created as the Conductor first notices the party (or a
 * phase is entered first, as `setBossHp` can): Discord at 0 with the Overture's swell, the first
 * Raise and Cue on their content's `initialDelay`, and the Overture's Decree.
 */
function start(world: World, boss: Entity): FinaleField {
  if (world.field.finale) return world.field.finale;
  const m4 = ensureM4(world);
  m4.nextRaiseAt = world.time + attackDef(RAISE).initialDelay;
  m4.nextCueAt = world.time + attackDef(CUE).initialDelay;
  world.field.finale = { discord: { value: 0, rate: DISCORD_RATE.overture } };
  // The Overture's Decree, unless a later phase was entered first (its own Decree stands).
  if (boss.enemy!.phase <= 1) {
    const d = phaseDecreeOf(world, 1);
    announce(world, boss, d.name, d.text, PHASE_ANSWERS[0]!);
  }
  return world.field.finale;
}

// ── Every tick it stands ─────────────────────────────────────────────────────────────

/**
 * Every tick it stands, whatever it is doing: the Cue's and Fortissimo Silence's public state
 * follow their telegraphs, Discord swells, and in phase 3 the Grand Silence runs (its program
 * begins through the boss's own casts: scheduled from impacts, they can't wait for one to end).
 */
function conductorUpdate(world: World, boss: Entity): void {
  const c = boss.enemy!;
  if (!world.field.finale && !c.engaged) return;
  const f = start(world, boss);
  const m4 = ensureM4(world);
  trackCue(world, f);
  if (c.phase <= 2) {
    trackFortissimo(world, boss, f);
    swell(world, f, m4);
    return;
  }
  if (f.silence) {
    countNotes(world, boss, f, m4);
    const s = f.silence;
    if (!s) return;
    if (world.time >= s.until - 1e-9) {
      coda(world, boss, f, m4);
      return;
    }
    holdBoss(boss);
    restill(world, boss);
    program(world, boss, m4);
  } else if (m4.nextDownbeatAt === undefined && !silenceCasting(world, boss)) {
    // Phase 3 before the silence: its cast didn't begin (or was cut off). Cast it now.
    beginGrandSilence(world, boss);
  }
}

/** The Cue's state ends with its Solo: resolved (the verdict), interrupted, or the voice gone. */
function trackCue(world: World, f: FinaleField): void {
  const cue = f.cue;
  if (!cue) return;
  const live = world.telegraphs.some((t) =>
    cue.target !== undefined
      ? t.owner === cue.soloist && t.attackId === cue.solo
      : t.owner === cue.boss && t.attackId === CUE,
  );
  if (!live) delete f.cue;
}

/** Fortissimo Silence's pulse and impact follow its telegraphs; after the third, Discord is 0. */
function trackFortissimo(world: World, boss: Entity, f: FinaleField): void {
  if (!f.fortissimo) return;
  const t = world.telegraphs.find((x) => x.owner === boss.id && FORTISSIMO_IDS.has(x.attackId));
  if (t) {
    const pulse = (FORTISSIMO.indexOf(t.attackId as (typeof FORTISSIMO)[number]) + 1) as 1 | 2 | 3;
    f.fortissimo = { pulse, impact: t.impact };
    return;
  }
  if (fortissimoPending(world, boss)) return;
  // It was played out.
  delete f.fortissimo;
  if (f.discord) f.discord.value = 0;
}

/** A pulse is still to come: being cast, or queued as the next follow-up. */
function fortissimoPending(world: World, boss: Entity): boolean {
  const cast = boss.enemy!.cast;
  if (cast && FORTISSIMO_IDS.has(cast.attackId)) return true;
  const f = world.internal.m2?.followUp;
  return !!f && f.owner === boss.id && FORTISSIMO_IDS.has(f.attack);
}

/** Discord's passive swell; it waits through the phase shift and Fortissimo Silence. */
function swell(world: World, f: FinaleField, m4: M4): void {
  const d = f.discord;
  if (!d || d.value >= DISCORD_MAX || shifting(world) || f.fortissimo || m4.queued) return;
  d.value = Math.min(DISCORD_MAX, d.value + d.rate * SIM_DT * world.timeScale);
}

// ── Its casts, when it isn't casting ─────────────────────────────────────────────────

/**
 * Every tick it stands and isn't casting (after the follow-ups): in phases 1-2 Fortissimo
 * Silence first, then a Raise, then a Cue; in phase 3, after the silence, the last burn's
 * Downbeat and Sforzando.
 */
function conductorTick(world: World, boss: Entity): void {
  const f = world.field.finale;
  const m4 = world.internal.m4;
  if (!f || !m4) return;
  if (boss.enemy!.phase <= 2) {
    if (beginFortissimo(world, boss, f, m4)) return;
    if (due(world, m4.nextRaiseAt) && beginRaise(world, boss, m4)) return;
    if (due(world, m4.nextCueAt)) beginCue(world, boss, f, m4);
    return;
  }
  burn(world, boss, m4);
}

/**
 * Fortissimo Silence at 100 Discord (or cast again after a phase shift cut it off), once no Solo
 * is live and no Cue is in flight: a Cue whose cast ended this tick lands (and begins its Solo)
 * after the script's tick, so it waits for that Solo too. One that would begin while a Crescendo
 * runs is cancelled by it at once.
 */
function beginFortissimo(world: World, boss: Entity, f: FinaleField, m4: M4): boolean {
  const full = !!f.discord && f.discord.value >= DISCORD_MAX - 1e-9;
  if ((!full && !m4.queued) || f.fortissimo || f.cue || soloLive(world)) return false;
  if (crescendoRunning(world)) {
    delete m4.queued;
    if (f.discord) f.discord.value = 0;
    fortissimoCancelled(world, boss.id, 'crescendo');
    return false;
  }
  if (!beginAttack(world, boss, attackDef(FORTISSIMO[0]), currentTarget(world, boss))) return false;
  const t = castTelegraph(world, boss);
  f.fortissimo = { pulse: 1, impact: t?.impact ?? world.time };
  delete m4.queued;
  return true;
}

function fortissimoCancelled(world: World, boss: EntityId, by: 'crescendo' | 'phase' | 'boss') {
  world.events.push({ type: 'fortissimoCancelled', tick: world.tick, boss, by });
}

/** Every pulse still to come is cancelled: its telegraph, the boss's cast and the follow-up. */
function cancelFortissimo(world: World, boss: Entity | null): void {
  for (const t of [...world.telegraphs])
    if (FORTISSIMO_IDS.has(t.attackId)) cancelTelegraph(world, t.id);
  const c = boss?.enemy;
  if (c?.cast && FORTISSIMO_IDS.has(c.cast.attackId)) {
    c.cast = null;
    c.state = 'recover';
    c.stateTime = 0;
  }
  const m2 = world.internal.m2;
  if (m2?.followUp && FORTISSIMO_IDS.has(m2.followUp.attack)) m2.followUp = null;
}

// ── The mirror-choir ─────────────────────────────────────────────────────────────────

/** A voice of the choir that hasn't fallen (spawning or not). */
function voicesStanding(world: World): Entity[] {
  const out: Entity[] = [];
  for (const e of world.entities.list())
    if (e.enemy && VOICES.has(e.enemy.defId) && e.health && !e.health.dead) out.push(e);
  return out;
}

/** Voices standing or on their way (a Raise's pending spawns), by def id. */
function voicesPresent(world: World): Set<string> {
  const ids = new Set(voicesStanding(world).map((e) => e.enemy!.defId));
  for (const p of world.internal.pendingSpawns) if (VOICES.has(p.defId)) ids.add(p.defId);
  return ids;
}

function choirCap(boss: Entity): number {
  return boss.enemy!.phase >= 2 ? CHOIR_CAP.choir : CHOIR_CAP.overture;
}

/**
 * The voices the next Raise would bring: missing ones in the phase's order, under the cap. Phase
 * 2's entry Raise brings the Tenor and the Soprano whatever the cap (the doc's "a Raise is cast at
 * once and brings the Tenor and Soprano"): with the Alto and the Bass still standing, the choir
 * is briefly four, and later Raises wait until it is under three. The cap governs the every-20 s
 * Raises ("while under the cap"); the entry Raise is what lets the Tenor and Soprano be Cued first
 * in phase 2 (the Decree gate's per-voice count and "the whole choir sings"), and in the usual
 * Skilled fight the Alto and the Bass both stand at 60%.
 */
function raiseVoices(world: World, boss: Entity): string[] {
  const present = voicesPresent(world);
  if (world.internal.m4?.choirRaise) {
    const mirror = MIRROR_VOICES.filter((id) => !present.has(id));
    if (mirror.length > 0) return mirror;
  }
  let n = voicesStanding(world).length;
  for (const p of world.internal.pendingSpawns) if (VOICES.has(p.defId)) n++;
  const room = Math.min(RAISE_MAX, choirCap(boss) - n);
  if (room <= 0) return [];
  const order: readonly string[] = boss.enemy!.phase >= 2 ? CHOIR : OVERTURE_VOICES;
  return order.filter((id) => !present.has(id)).slice(0, room);
}

/**
 * Begins a Raise if it would bring anyone; the next is due a cooldown on. Never while one is in
 * flight: a Raise whose cast ended but whose telegraph hasn't resolved yet (the script's tick runs
 * before `resolveTelegraphs` on its landing tick) has voices on their way that aren't in
 * `pendingSpawns` yet, so a Cue turned Raise would otherwise be cast twice.
 */
function beginRaise(world: World, boss: Entity, m4: M4): boolean {
  if (raiseInFlight(world, boss) || raiseVoices(world, boss).length === 0) return false;
  const raise = attackDef(RAISE);
  if (!beginAttack(world, boss, raise, null)) return false;
  m4.nextRaiseAt = world.time + raise.cooldown;
  return true;
}

/** The boss's Raise is unresolved: its telegraph still live (its cast is `c.cast` until then). */
function raiseInFlight(world: World, boss: Entity): boolean {
  return world.telegraphs.some((t) => t.owner === boss.id && t.attackId === RAISE);
}

/**
 * The Raise lands: each voice it brings stands on the 6 m ring around the Conductor after its
 * ground warning, an elite (the summon pattern, with `elite`).
 */
function raise(world: World, boss: Entity): void {
  const voices = raiseVoices(world, boss);
  delete world.internal.m4?.choirRaise;
  const p = { x: 0, z: 0 };
  voices.forEach((defId, i) => {
    ringPoint(world, boss.x, boss.z, CHOIR_RING, i, voices.length, p);
    world.internal.pendingSpawns.push({
      at: world.time + RAISE_WARNING,
      defId,
      x: p.x,
      z: p.z,
      elite: true,
      affixes: [],
      wave: world.encounter.wave,
    });
    world.events.push({
      type: 'spawnWarning',
      tick: world.tick,
      x: p.x,
      z: p.z,
      delay: RAISE_WARNING,
    });
  });
}

/** A voice that can take a Cue now: standing, arrived, not casting and not disabled. */
function idle(e: Entity): boolean {
  const c = e.enemy!;
  return isActive(e) && c.state !== 'spawning' && !c.cast && !isDisabled(e);
}

/**
 * The soloist: an idle voice never Cued first, else the one Cued longest ago; ties go to the
 * lower entity id. Deterministic: no draw.
 */
function pickSoloist(world: World, m4: M4): Entity | null {
  let best: Entity | null = null;
  let bestAt = Infinity;
  for (const e of voicesStanding(world)) {
    if (!idle(e)) continue;
    const at = m4.cuedAt?.[e.id] ?? -Infinity;
    if (best === null || at < bestAt || (at === bestAt && e.id < best.id)) {
      best = e;
      bestAt = at;
    }
  }
  return best;
}

/**
 * The Cue, on its cadence, past its gate: no Fortissimo Silence up or due, no Cue already
 * singing, and fewer than two damaging telegraphs live. With no idle voice it waits; with none
 * standing (or on its way) it becomes a Raise.
 */
function beginCue(world: World, boss: Entity, f: FinaleField, m4: M4): boolean {
  if (f.fortissimo || m4.queued || f.cue) return false;
  if (f.discord && f.discord.value >= DISCORD_MAX - 1e-9) return false;
  if (liveDamaging(world) >= LIVE_CAP) return false;
  const soloist = pickSoloist(world, m4);
  if (!soloist) {
    if (voicesPresent(world).size === 0) return beginRaise(world, boss, m4);
    return false;
  }
  const solo = SOLOS[soloist.enemy!.defId]!;
  if (!beginAttack(world, boss, attackDef(CUE), null)) return false;
  const t = castTelegraph(world, boss);
  f.cue = { boss: boss.id, soloist: soloist.id, solo, until: t?.impact ?? world.time };
  world.events.push({
    type: 'enemyCued',
    tick: world.tick,
    boss: boss.id,
    soloist: soloist.id,
    solo,
  });
  m4.nextCueAt = world.time + cueEvery(world, boss);
  phaseDecreeAgain(world, boss, boss.enemy!.phase);
  return true;
}

function cueEvery(world: World, boss: Entity): number {
  if (enraged(world)) return CUE_EVERY.enraged;
  return boss.enemy!.phase >= 2 ? CUE_EVERY.choir : CUE_EVERY.overture;
}

/**
 * The Cue lands: its voice begins its Solo, which names its target as it begins (in its Decree,
 * the first `decreeLimit` times). A Solo that can't begin (the voice fell, is busy or disabled,
 * or has no one to aim at) drops the Cue, and the next is tried `CUE_RETRY` s on.
 */
function beginSolo(world: World, f: FinaleField, m4: M4): void {
  const cue = f.cue;
  const soloist = cue ? world.entities.get(cue.soloist) : undefined;
  const solo = cue ? attackDef(cue.solo) : undefined;
  if (!cue || !soloist?.enemy || !solo || !idle(soloist) || !beginQuiet(world, soloist, solo)) {
    delete f.cue;
    m4.nextCueAt = world.time + CUE_RETRY;
    return;
  }
  (m4.cuedAt ??= {})[soloist.id] = world.time;
  const t = castTelegraph(world, soloist);
  if (t?.target !== null && t?.target !== undefined) cue.target = t.target;
  cue.until = t?.impact ?? world.time;
  if (solo.decree && soloDecreeDue(world, solo)) {
    const hero = cue.target === undefined ? undefined : world.entities.get(cue.target)?.hero;
    const name = hero ? heroDef(hero.defId).name : undefined;
    announce(world, soloist, solo.name, soloDecree(solo.id, name), solo.answers);
  }
}

/** Begins `attack` without its own (unnamed) Decree: the script announces the named one. */
function beginQuiet(world: World, e: Entity, attack: AttackDef): boolean {
  const { decree: _unnamed, ...quiet } = attack;
  return beginAttack(world, e, quiet as AttackDef, currentTarget(world, e));
}

/** A Solo's Decree is due on its first `decreeLimit` casts (counted as `beginAttack` counts). */
function soloDecreeDue(world: World, attack: AttackDef): boolean {
  if (attack.decreeLimit === undefined) return true;
  const decrees = (ensureM2(world).decrees ??= {});
  const n = decrees[attack.id] ?? 0;
  if (n >= attack.decreeLimit) return false;
  decrees[attack.id] = n + 1;
  return true;
}

// ── Phases ───────────────────────────────────────────────────────────────────────────

/**
 * Phase 2 (Mirror Choir): Discord rises to its floor and swells faster, a Fortissimo Silence the
 * shift cut off is cast again after it, and a Raise is cast at once. Phase 3 (Grand Silence): the
 * choir shatters, Discord goes, and the Grand Silence is cast.
 */
function conductorEnter(world: World, boss: Entity, phase: number): void {
  const f = start(world, boss);
  const m4 = ensureM4(world);
  if (phase === 2) {
    if (f.discord) {
      f.discord.value = Math.max(f.discord.value, DISCORD_P2_FLOOR);
      f.discord.rate = DISCORD_RATE.choir;
    }
    if (f.fortissimo || m4.queued) {
      cancelFortissimo(world, boss);
      if (f.fortissimo) fortissimoCancelled(world, boss.id, 'phase');
      delete f.fortissimo;
      m4.queued = true;
      if (f.discord) f.discord.value = DISCORD_MAX;
    }
    m4.nextCueAt = Math.min(m4.nextCueAt ?? Infinity, shiftEnd(world) + CUE_RETRY);
    // The Raise is cast now, through the shift (the next is due a cooldown on), and brings the
    // Tenor and the Soprano whatever the cap. If it can't begin now, it is due as the shift ends.
    m4.choirRaise = true;
    if (!beginRaise(world, boss, m4))
      m4.nextRaiseAt = Math.min(m4.nextRaiseAt ?? Infinity, shiftEnd(world));
  } else if (phase === 3) {
    if (f.fortissimo || m4.queued) {
      cancelFortissimo(world, boss);
      if (f.fortissimo) fortissimoCancelled(world, boss.id, 'phase');
    }
    delete f.fortissimo;
    delete f.discord;
    delete f.cue;
    delete m4.queued;
    delete m4.nextCueAt;
    delete m4.nextRaiseAt;
    delete m4.choirRaise;
    delete m4.cuedAt;
    // A Raise or a Cue whose cast ended this tick hasn't landed yet (its telegraph resolves after
    // the boss's tick): it is cancelled, or its voices would stand in the silence.
    for (const t of [...world.telegraphs])
      if (t.owner === boss.id && (t.attackId === RAISE || t.attackId === CUE))
        cancelTelegraph(world, t.id);
    shatterChoir(world);
    beginGrandSilence(world, boss);
  }
}

/** The choir falls silent: every singing voice is interrupted, then each shatters (no credit). */
function shatterChoir(world: World): void {
  const spawns = world.internal.pendingSpawns;
  for (let i = spawns.length - 1; i >= 0; i--)
    if (VOICES.has(spawns[i]!.defId)) spawns.splice(i, 1);
  for (const e of voicesStanding(world)) {
    if (e.enemy!.cast) interruptEnemy(world, e, null);
    killEnemy(world, e, null);
  }
}

function silenceCasting(world: World, boss: Entity): boolean {
  return world.telegraphs.some((t) => t.owner === boss.id && t.attackId === GRAND_SILENCE);
}

function beginGrandSilence(world: World, boss: Entity): void {
  beginAttack(world, boss, attackDef(GRAND_SILENCE), null);
}

/** A `script` cast landed: the Raise, the Cue, or the Grand Silence. */
function conductorResolved(world: World, boss: Entity, t: Telegraph): void {
  const f = world.field.finale;
  const m4 = world.internal.m4;
  if (!f || !m4) return;
  // The choir is gone from phase 3 on: no Raise or Cue lands in the Grand Silence or the burn.
  const choir = boss.enemy!.phase <= 2;
  if (t.attackId === RAISE) {
    if (choir) raise(world, boss);
  } else if (t.attackId === CUE) {
    if (choir) beginSolo(world, f, m4);
  } else if (t.attackId === GRAND_SILENCE && !f.silence) beginSilence(world, boss, f, m4);
}

// ── The verdict and the Crescendo (the Finale's hooks) ──────────────────────────────

/**
 * A Finale telegraph resolved. A silence attack leaves the tracked list (the heroes it took life
 * from are remembered, for a Rewind's note); a Solo ends its Cue; and a failed one feeds Discord
 * its `discord` (phases 1-2, never past 100 or during Fortissimo).
 */
function conductorVerdict(
  world: World,
  boss: Entity | null,
  t: Telegraph,
  failed: boolean,
  victims: readonly EntityId[] = [],
  struck: readonly EntityId[] = [],
): void {
  const m4 = world.internal.m4;
  if (m4?.live) {
    const i = m4.live.indexOf(t.id);
    if (i >= 0) {
      m4.live.splice(i, 1);
      if (m4.struck) for (const id of struck) if (!m4.struck.includes(id)) m4.struck.push(id);
    }
  }
  const f = world.field.finale;
  if (!f) return;
  if (f.cue && f.cue.soloist === t.owner && f.cue.solo === t.attackId) delete f.cue;
  const d = f.discord;
  if (!failed || !d || f.fortissimo) return;
  const amount = Math.min(DISCORD_MAX - d.value, attackDef(t.attackId).discord ?? 0);
  if (amount <= 0) return;
  d.value += amount;
  world.events.push({
    type: 'discordRose',
    tick: world.tick,
    boss: boss?.id ?? t.owner,
    telegraph: t.id,
    amount,
    value: d.value,
    failed: [...victims],
  });
}

/**
 * The Weaver's Crescendo (any Calling's: Sunrise, the Vow, Stasis) cancels Fortissimo Silence,
 * live, cast again after a shift, or due (Discord full, waiting for a Cue or Solo to resolve): its
 * pulses, the boss's cast and the follow-up go, and Discord is 0. Synchronous, so Stasis (which
 * stops the boss systems, and outlasts no Solo it holds) cancels it too.
 */
function conductorCrescendo(world: World): void {
  const f = world.field.finale;
  const m4 = world.internal.m4;
  const pending = !!f?.discord && f.discord.value >= DISCORD_MAX - 1e-9;
  if (!f || !m4 || (!f.fortissimo && !m4.queued && !pending)) return;
  const boss = standingBoss(world);
  cancelFortissimo(world, boss);
  delete f.fortissimo;
  delete m4.queued;
  if (f.discord) f.discord.value = 0;
  fortissimoCancelled(world, boss?.id ?? world.encounter.bossId ?? world.weaverId, 'crescendo');
}

// ── The Grand Silence ────────────────────────────────────────────────────────────────

/**
 * The Grand Silence lands: every standing hero is stilled, the boss is held, the ledger is
 * snapshot for the notes, and the program's first Rest is due now. Its cap is 50 s, stretched by
 * the assist's lead and the Dissonance windup as every telegraph is.
 */
function beginSilence(world: World, boss: Entity, f: FinaleField, m4: M4): void {
  const cap = SILENCE_CAP * world.config.assists.telegraphLead * world.mods.dissonanceWindupMult;
  const until = world.time + cap;
  restill(world, boss);
  holdBoss(boss);
  f.silence = { notes: 0, of: NOTES_NEEDED, since: world.time, until, sources: [] };
  snapshot(world, m4);
  m4.struck = [];
  m4.nextRestAt = world.time;
  world.events.push({ type: 'silenceBegan', tick: world.tick, boss: boss.id, until });
}

/** Every standing hero is (still) stilled: one a Mend stood back up mid-silence too. */
function restill(world: World, boss: Entity): void {
  for (const e of partyHeroes(world))
    if (isActive(e) && !hasStatus(e, 'stilled')) addStatus(world, e, 'stilled', NEVER, boss.id);
}

/** Untouchable, and its melee held, while the silence stands (both count down: re-armed). */
function holdBoss(boss: Entity): void {
  const h = boss.health!;
  h.invulnerable = Math.max(h.invulnerable, SILENCE_HOLD);
  boss.enemy!.attackCooldown = Math.max(boss.enemy!.attackCooldown, SILENCE_HOLD);
}

/** The ledger as the notes were last counted. */
function snapshot(world: World, m4: M4): void {
  const l = world.ledger;
  m4.seen = {
    perfects: l.perfects,
    clutch: l.clutchCleanses,
    saves: l.saves.length,
    rewound: l.calling.rewound,
    markers: l.markers.length,
  };
}

/**
 * The program, from impacts: the Rest at the cycle's start, the Measure `measureLead` s before
 * the Rest lands, the Cadence (Final on even cycles, Half on odd) `cadenceLag` s after the Measure
 * lands, and the next cycle `nextCycle` s after the Cadence lands. Never more than two live.
 */
function program(world: World, boss: Entity, m4: M4): void {
  if (liveDamaging(world) >= LIVE_CAP) return;
  if (due(world, m4.nextRestAt)) {
    const foreseen = boss.enemy!.foreseen;
    const promised = foreseen?.attackId === REST && foreseen.special === -1 ? foreseen : null;
    const t = beginProgram(world, boss, m4, REST, null, promised);
    if (!t) return;
    m4.cycle = m4.cycle === undefined ? 0 : m4.cycle + 1;
    delete m4.nextRestAt;
    m4.nextMeasureAt = t.impact - SILENCE_STEPS.measureLead;
    return;
  }
  if (due(world, m4.nextMeasureAt)) {
    const t = beginProgram(world, boss, m4, MEASURE, measureTarget(world, boss));
    if (!t) return;
    delete m4.nextMeasureAt;
    m4.nextCadenceAt = t.impact + SILENCE_STEPS.cadenceLag;
    phaseDecreeAgain(world, boss, 3);
    return;
  }
  if (due(world, m4.nextCadenceAt)) {
    const t = beginProgram(world, boss, m4, cadenceOf(m4), null);
    if (!t) return;
    delete m4.nextCadenceAt;
    m4.nextRestAt = t.impact + SILENCE_STEPS.nextCycle;
  }
}

/** This cycle's Cadence: the Final Cadence on even cycles, the Half Cadence on odd. */
function cadenceOf(m4: M4): string {
  return (m4.cycle ?? 0) % 2 === 0 ? FINAL_CADENCE : HALF_CADENCE;
}

/** Begins one of the program's attacks; its telegraph is tracked in `m4.live` until it ends. */
function beginProgram(
  world: World,
  boss: Entity,
  m4: M4,
  attackId: string,
  current: Entity | null,
  promised: NonNullable<Entity['enemy']>['foreseen'] = null,
): Telegraph | undefined {
  if (!beginAttack(world, boss, attackDef(attackId), current, promised)) return undefined;
  const t = castTelegraph(world, boss);
  if (t) (m4.live ??= []).push(t.id);
  // A circle at a stilled hero's feet strikes that hero alone: the party is frozen in formation,
  // and one Ward and one Reel answer one victim (the Rest's mark has one already).
  if (t && t.shape.kind === 'circle' && t.target !== null) t.sole = t.target;
  return t;
}

/** The Measure's hero: the boss's target if a standing hero, else its threat's pick, else the
 * first standing hero by slot. Deterministic: no draw. */
function measureTarget(world: World, boss: Entity): Entity | null {
  const current = currentTarget(world, boss);
  if (current?.hero) return current;
  const picked = pickEnemyTarget(world, boss);
  const e = picked === null ? undefined : world.entities.get(picked);
  if (isActive(e) && e.hero) return e;
  for (const hero of partyHeroes(world)) if (isActive(hero)) return hero;
  return null;
}

/**
 * The notes since the last count, from the ledger: each new Perfect, each new clutch Chime, each
 * new Reel-save, and a Rewind that restored life or cancelled a tracked silence telegraph (at
 * most one a Rewind, and one per `REWIND_NOTE_EVERY` s). Each fills every stilled hero's Solo a share; the eighth Reignites. No
 * Weaver (`config.absent`), no notes.
 */
function countNotes(world: World, boss: Entity, f: FinaleField, m4: M4): void {
  const s = f.silence;
  const seen = m4.seen;
  if (!s || !seen) return;
  const l = world.ledger;
  // A tracked silence telegraph gone without its verdict was cancelled (a Paradox Rewind's).
  let cancelled = 0;
  if (m4.live) {
    const before = m4.live.length;
    m4.live = m4.live.filter((id) => world.telegraphs.some((t) => t.id === id));
    cancelled = before - m4.live.length;
  }
  const notes: { source: NoteSource; hero: EntityId | null }[] = [];
  if (!world.config.absent) {
    const marks = l.markers.slice(seen.markers);
    const slotHero = (slot: number | null | undefined): EntityId | null =>
      slot === null || slot === undefined ? null : (world.party[slot] ?? null);
    const perfects = marks.filter((m) => m.kind === 'perfect');
    for (let i = 0; i < l.perfects - seen.perfects; i++)
      notes.push({ source: 'perfect', hero: slotHero(perfects[i]?.slot) });
    const cleanses = marks.filter((m) => m.kind === 'cleanse');
    const clutches = l.clutchCleanses - seen.clutch;
    for (let i = 0; i < clutches; i++)
      notes.push({
        source: 'clutch',
        hero: cleanses.length === clutches ? slotHero(cleanses[i]!.slot) : null,
      });
    for (const save of l.saves.slice(seen.saves))
      if (save.cause === 'reel') notes.push({ source: 'reel', hero: save.hero });
    // A Rewind that undid a blow, at most one per `REWIND_NOTE_EVERY` s (Temporal Mastery and
    // Quick Rosin can bring Rewind back sooner): life back on a hero a silence blow struck (life
    // lost before the silence, in Rewind's reach just after its entry, is no note), or a tracked
    // silence telegraph cancelled (Paradox).
    const rewinds = marks.filter((m) => m.kind === 'rewind');
    const undid = rewinds.some((m) => {
      const hero = slotHero(m.slot);
      return hero !== null && (m4.struck ?? []).includes(hero);
    });
    if (
      rewinds.length > 0 &&
      ((l.calling.rewound > seen.rewound + 1e-9 && undid) || cancelled > 0) &&
      (m4.nextRewindNoteAt === undefined || due(world, m4.nextRewindNoteAt))
    ) {
      notes.push({ source: 'rewind', hero: null });
      m4.nextRewindNoteAt = world.time + REWIND_NOTE_EVERY;
    }
  }
  snapshot(world, m4);
  for (const note of notes) {
    if (s.notes >= NOTES_NEEDED) break;
    playNote(world, s, note.source, note.hero);
  }
  if (s.notes >= NOTES_NEEDED) reignite(world, boss, f, m4);
}

/** A note sounds: every stilled hero's Solo fills a share (eight fill it). */
function playNote(
  world: World,
  s: NonNullable<FinaleField['silence']>,
  source: NoteSource,
  hero: EntityId | null,
): void {
  s.notes++;
  s.sources.push(source);
  world.events.push({
    type: 'silenceNote',
    tick: world.tick,
    n: s.notes,
    of: s.of,
    source,
    hero,
  });
  for (const e of partyHeroes(world)) {
    const h = e.hero!;
    if (!isActive(e) || !hasStatus(e, 'stilled') || h.soloActive > 0 || h.solo >= 100) continue;
    h.solo = Math.min(100, h.solo + SOLO_PER_NOTE);
    if (h.solo >= 100) world.events.push({ type: 'soloReady', tick: world.tick, hero: e.id });
  }
}

/**
 * Eight notes: the song returns. `stilled` comes off, every standing Solo is full, every downed
 * hero stands back up at 30%, and the last burn begins.
 */
function reignite(world: World, boss: Entity, f: FinaleField, m4: M4): void {
  endProgram(world, boss, m4);
  unstill(world);
  for (const e of partyHeroes(world)) {
    const h = e.hero!;
    if (!isActive(e) || h.soloActive > 0 || h.solo >= 100) continue;
    h.solo = 100;
    world.events.push({ type: 'soloReady', tick: world.tick, hero: e.id });
  }
  const revived: EntityId[] = [];
  for (const e of partyHeroes(world)) {
    if (!e.health!.downed || e.health!.dead) continue;
    reviveHero(world, e, REVIVE_PCT);
    revived.push(e.id);
  }
  delete f.silence;
  world.events.push({ type: 'reignited', tick: world.tick, boss: boss.id, revived });
  // Each standing hero speaks as they unfreeze: a fixed line, no draw.
  for (const e of partyHeroes(world)) {
    const line = REIGNITE_BARKS[e.hero!.defId];
    if (!isActive(e) || line === undefined) continue;
    e.hero!.lastBarkAt = world.time;
    world.events.push({ type: 'bark', tick: world.tick, speaker: e.id, line });
  }
  setTimeScale(world, REIGNITE_SCALE, REIGNITE_TICKS, 'crescendo');
  beginBurn(world, m4);
}

/**
 * The cap: the Coda. `stilled` comes off and the burn begins, but the Solos keep only what the
 * notes gave, and nobody is stood back up.
 */
function coda(world: World, boss: Entity, f: FinaleField, m4: M4): void {
  const notes = f.silence?.notes ?? 0;
  endProgram(world, boss, m4);
  unstill(world);
  delete f.silence;
  world.events.push({ type: 'silenceBroken', tick: world.tick, boss: boss.id, notes });
  beginBurn(world, m4);
}

/**
 * The program stops: its live telegraphs are cancelled (a Rest's mark with it), the boss's cast
 * of one ends, its clocks and snapshots go, and the boss can be struck again.
 */
function endProgram(world: World, boss: Entity, m4: M4): void {
  for (const id of m4.live ?? []) {
    const t = world.telegraphs.find((x) => x.id === id);
    if (!t) continue;
    cancelTelegraph(world, id);
    if (t.shape.kind === 'mark') {
      const marked = world.entities.get(t.shape.target);
      if (marked && hasStatus(marked, 'dirge')) removeStatus(world, marked, 'dirge', 'expired');
    }
  }
  const c = boss.enemy!;
  if (c.cast && PROGRAM.has(c.cast.attackId)) {
    c.cast = null;
    c.state = 'recover';
    c.stateTime = 0;
  }
  delete m4.live;
  delete m4.nextRestAt;
  delete m4.nextMeasureAt;
  delete m4.nextCadenceAt;
  delete m4.cycle;
  delete m4.seen;
  delete m4.struck;
  delete m4.nextRewindNoteAt;
  boss.health!.invulnerable = 0;
}

/** The last burn: the script's own Downbeat and Sforzando on their cadences. */
function beginBurn(world: World, m4: M4): void {
  m4.nextDownbeatAt = world.time + BURN_EVERY.downbeat;
  m4.nextSforzandoAt = world.time + BURN_EVERY.sforzando;
}

/** The burn's casts, through the same gate as the Cue's (fewer than two damaging live). */
function burn(world: World, boss: Entity, m4: M4): void {
  if (m4.nextDownbeatAt === undefined || liveDamaging(world) >= LIVE_CAP) return;
  if (
    due(world, m4.nextDownbeatAt) &&
    beginAttack(world, boss, attackDef(DOWNBEAT), currentTarget(world, boss))
  ) {
    m4.nextDownbeatAt = world.time + BURN_EVERY.downbeat;
    return;
  }
  if (due(world, m4.nextSforzandoAt) && beginAttack(world, boss, attackDef(SFORZANDO), null))
    m4.nextSforzandoAt = world.time + BURN_EVERY.sforzando;
}

// ── Foresight, deaths and Stasis ─────────────────────────────────────────────────────

/** Its next scheduled cast: the soonest of Fortissimo Silence, the Raise, the Cue, the silence's
 * next attack and the burn's. */
function conductorNext(world: World, boss: Entity): ScriptedNext | null {
  const m4 = world.internal.m4;
  const f = world.field.finale;
  if (!m4 || !f) return null;
  const at = (attackId: string, when: number | undefined): ScriptedNext | null =>
    when === undefined ? null : { attackId, at: when };
  if (boss.enemy!.phase <= 2) {
    const d = f.discord;
    const fortissimo =
      f.fortissimo !== undefined
        ? null
        : m4.queued
          ? at(FORTISSIMO[0], world.time)
          : d && d.rate > 0
            ? at(FORTISSIMO[0], world.time + Math.max(0, DISCORD_MAX - d.value) / d.rate)
            : null;
    return soonest([
      fortissimo,
      raiseVoices(world, boss).length > 0 ? at(RAISE, m4.nextRaiseAt) : null,
      at(CUE, m4.nextCueAt),
    ]);
  }
  return soonest([
    at(REST, m4.nextRestAt),
    at(MEASURE, m4.nextMeasureAt),
    at(cadenceOf(m4), m4.nextCadenceAt),
    at(DOWNBEAT, m4.nextDownbeatAt),
    at(SFORZANDO, m4.nextSforzandoAt),
  ]);
}

/** A voice fell: its Cue goes with it (the Cue lands on nothing and is tried again). */
function conductorAddDeath(world: World, _boss: Entity, add: Entity): void {
  const f = world.field.finale;
  if (f?.cue?.soloist === add.id) delete f.cue;
  const cued = world.internal.m4?.cuedAt;
  if (cued && add.id in cued) delete cued[add.id];
}

/**
 * It fell: the freeze comes off and Fortissimo Silence is cancelled, and its state goes at once,
 * so none of it outlives it where no fight's end follows (a sandbox's encounter never ends).
 */
function conductorDeath(world: World, boss: Entity): void {
  const f = world.field.finale;
  if (f?.fortissimo || world.internal.m4?.queued) {
    cancelFortissimo(world, boss);
    if (f?.fortissimo) fortissimoCancelled(world, boss.id, 'boss');
  }
  cleanup(world);
}

/**
 * One tick of Stasis: every clock waits (the Cue's and Fortissimo's shown impacts and the
 * silence's cap too: the telegraphs they follow wait in stasis.ts), and the notes are counted.
 * The passive Discord waits by itself: `update` doesn't run under Stasis.
 */
function conductorStasis(world: World, dt: number): void {
  const m4 = world.internal.m4;
  if (!m4) return;
  for (const key of CLOCKS) {
    const at = m4[key];
    if (at !== undefined) m4[key] = at + dt;
  }
  const f = world.field.finale;
  if (!f) return;
  if (f.cue) f.cue.until += dt;
  if (f.fortissimo) f.fortissimo.impact += dt;
  if (f.silence) {
    f.silence.until += dt;
    const boss = standingBoss(world);
    if (boss) countNotes(world, boss, f, m4);
  }
}
