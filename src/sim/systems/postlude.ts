/**
 * True Dissonance's Postlude (docs/phase-6.md, "True Dissonance: the Postlude"): on a True
 * Dissonance run the blow that would kill the Silent Conductor instead stands it up, once, into a
 * fourth phase.
 *
 * - **The rise** (`postludeRise`, called in the kill path before `killEnemy`, so no
 *   `enemyKilled`, no boss `onDeath`, and the encounter stays `fighting`): untouchable for
 *   `POSTLUDE.rise` s, as Restless Dead's rise is (hits pass: `invulnerable`; heroes look
 *   elsewhere: `spawning`; statuses laid on it then are cleared as it stands), but with no
 *   `risen` and no `enemyRose`, so no Restless Dead mark is drawn; at `postludeLife` of its life. Everything it had live is dropped, and
 *   a Fortissimo Silence still to come is cancelled.
 * - **The choir re-forms**: `POSTLUDE.voices` voices are Raised, in the slot order of the heroes
 *   they sing back (`VOICE_HERO`), with the usual ground warning.
 * - **Duets**: every `cueEvery` s the Conductor Cues two voices, the second `pairGap` s after the
 *   first, through the Finale's gate (fewer than two damaging telegraphs live, no Fortissimo).
 * - **Discord returns** at `discordRate` a second; failed telegraphs feed it as before; at 100
 *   comes Fortissimo Silence, which any Crescendo cancels (the Conductor's own hooks, unchanged).
 * - **The closing attacks continue** on the last burn's clocks (`closingEvery`: Tyrant's too).
 * - After `enrageAfter` s, the pairs come every `enragedCueEvery` s and Discord × `enragedDiscord`.
 *
 * The rise is not a new fight: nothing once-a-fight is refreshed. Its state is
 * `field.finale.postlude` and `internal.m4.postlude`, both absent until the rise, and deleted with
 * the rest of the Finale's at the Conductor's (second) death and the encounter's end. Its only
 * `rng.ai` draws are the Raise's ring points (`ringPoint`) and the Solos' own targets, all after the
 * moment every other fight has ended.
 *
 * Its hooks wrap the Conductor's script (`withPostlude`, the one call in conductorBoss.ts): each
 * runs only while `field.finale.postlude` exists, which only a True Dissonance run creates.
 */
import { attackDef, heroDef } from '../../content';
import { CHOIR_RING, LIVE_CAP, POSTLUDE, RAISE_WARNING, soloDecree } from '../../content/crucible';
import {
  CHOIR,
  CONDUCTOR,
  CUE,
  DISCORD_MAX,
  POSTLUDE_PHASE,
  RAISE,
  SOLOS,
  VOICE_HERO,
} from '../../content/crucibleIds';
import { pushMarker } from '../combat/feedback';
import { setPostludeRise } from '../combat/health';
import { cancelTelegraph } from '../combat/telegraphs';
import type { Entity, EntityId, FinaleField, PostludeClocks, Telegraph } from '../state';
import type { World } from '../world';
import type { BossScript, ScriptedNext } from './bossScripts';
import { phaseDecree } from './bosses';
import {
  announce,
  beginFortissimo,
  beginQuiet,
  cancelFortissimo,
  due,
  fortissimoCancelled,
  idle,
  liveDamaging,
  soloDecreeDue,
  swell,
  trackCue,
  trackFortissimo,
  voicesPresent,
  voicesStanding,
} from './conductorBoss';
import { beginAttack, ensureM4, ringPoint } from './enemies';
import { closingEvery } from './tyrant';

type M4 = NonNullable<World['internal']['m4']>;

/** Every voice of the mirror-choir. */
const VOICES: ReadonlySet<string> = new Set(CHOIR);

/** The Postlude has begun (only a True Dissonance run's rise begins it). */
function inPostlude(world: World): boolean {
  return world.mods.postludeLife > 0 && world.field.finale?.postlude !== undefined;
}

// ── The rise ─────────────────────────────────────────────────────────────────────────

/**
 * The killing blow on the Silent Conductor (health.ts, beside `restlessRise`, before
 * `killEnemy`): it stands up into the Postlude instead, once. True if it rose.
 */
export function postludeRise(world: World, boss: Entity): boolean {
  const c = boss.enemy;
  const h = boss.health;
  const f = world.field.finale;
  if (!c || !h || c.defId !== CONDUCTOR || !f || f.postlude) return false;
  if (world.encounter.status !== 'fighting') return false;
  const m4 = ensureM4(world);
  // A Fortissimo Silence still to come is cancelled.
  if (f.fortissimo || m4.queued) {
    cancelFortissimo(world, boss);
    if (f.fortissimo) fortissimoCancelled(world, boss.id, 'phase');
  }
  delete f.fortissimo;
  delete m4.queued;
  delete f.cue;
  // Every telegraph it had live is dropped, its cast and any follow-up with it.
  for (const t of [...world.telegraphs]) if (t.owner === boss.id) cancelTelegraph(world, t.id);
  if (world.internal.m2?.followUp?.owner === boss.id) world.internal.m2.followUp = null;
  c.cast = null;
  // The earlier phases' clocks have no use now (the closing attacks' are set again below).
  delete m4.nextCueAt;
  delete m4.nextRaiseAt;
  delete m4.choirRaise;
  // Standing up, as Restless Dead's rise does, but without its mark (`risen` stays as it is, so
  // the views draw no Restless Dead rise on it): untouchable while it rises, and `spawning`, so
  // heroes look elsewhere and it does nothing.
  c.state = 'spawning';
  c.stateTime = 0;
  c.phase = POSTLUDE_PHASE;
  h.hp = Math.max(1, Math.round(h.maxHp * world.mods.postludeLife));
  h.statuses = [];
  const riseUntil = world.time + POSTLUDE.rise;
  h.invulnerable = Math.max(h.invulnerable, POSTLUDE.rise);
  // Nothing is cast while it rises (the phase shift's gate).
  world.internal.boss.phaseShiftUntil = Math.max(world.internal.boss.phaseShiftUntil, riseUntil);
  f.postlude = { since: world.time, riseUntil };
  f.discord = { value: 0, rate: POSTLUDE.discordRate };
  m4.postlude = { nextPairAt: riseUntil };
  m4.nextRaiseAt = riseUntil;
  const every = closingEvery(world);
  m4.nextDownbeatAt = riseUntil + every.downbeat;
  m4.nextSforzandoAt = riseUntil + every.sforzando;
  world.events.push({ type: 'phaseChanged', tick: world.tick, boss: boss.id, phase: c.phase });
  pushMarker(world, 'phase', null);
  world.events.push({ type: 'postludeRose', tick: world.tick, boss: boss.id, hp: h.hp });
  const decree = phaseDecree(CONDUCTOR, POSTLUDE_PHASE - 1);
  if (decree) announce(world, boss, decree.name, decree.text, decree.answers);
  return true;
}

setPostludeRise(postludeRise);

// ── Every tick it stands ─────────────────────────────────────────────────────────────

/**
 * The Conductor's `update` in the Postlude: the rise holds until its time, then the Cue's and
 * Fortissimo Silence's state follow their telegraphs, the pressure comes on after `enrageAfter`
 * s, and Discord swells.
 */
function postludeUpdate(world: World, boss: Entity): void {
  const f = world.field.finale!;
  const p = f.postlude!;
  const c = boss.enemy!;
  if (world.time < p.riseUntil - 1e-9) {
    // Still rising: `spawning` holds (the enemy system would end it after its own spawn time),
    // and so does its guard (Stasis can stretch the rise).
    c.state = 'spawning';
    c.stateTime = 0;
    boss.health!.invulnerable = Math.max(boss.health!.invulnerable, p.riseUntil - world.time);
    return;
  }
  if (c.state === 'spawning') {
    // Risen: whatever was laid on it while it rose passes, as hits did.
    c.state = 'approach';
    c.stateTime = 0;
    boss.health!.statuses = [];
  }
  const m4 = ensureM4(world);
  if (!p.enraged && world.time >= p.since + POSTLUDE.enrageAfter - 1e-9) {
    p.enraged = true;
    if (f.discord) f.discord.rate = POSTLUDE.discordRate * POSTLUDE.enragedDiscord;
  }
  trackCue(world, f);
  trackFortissimo(world, boss, f);
  swell(world, f, m4);
}

/**
 * The Conductor's `tick` in the Postlude (it isn't casting): Fortissimo Silence first, then a
 * Raise, then a pair's second Cue, then the next pair. True if it began one (the closing attacks,
 * the script's own `burn`, come after, when none did).
 */
function postludeTick(world: World, boss: Entity): boolean {
  const f = world.field.finale!;
  const m4 = ensureM4(world);
  const clocks = m4.postlude;
  if (!clocks) return false;
  if (beginFortissimo(world, boss, f, m4)) return true;
  if (due(world, m4.nextRaiseAt) && beginRaise(world, boss, m4)) return true;
  if (clocks.secondAt !== undefined && due(world, clocks.secondAt))
    return cueSecond(world, boss, f, m4, clocks);
  if (due(world, clocks.nextPairAt)) return cuePair(world, boss, f, m4, clocks);
  return false;
}

// ── The choir ────────────────────────────────────────────────────────────────────────

/** The voices in the order the Postlude Raises them: by the party slot of the hero each sings. */
function raiseOrder(world: World): string[] {
  const slotOf = (voice: string): number => {
    const hero = VOICE_HERO[voice];
    for (const [slot, id] of world.party.entries())
      if (world.entities.get(id)?.hero?.defId === hero) return slot;
    return world.party.length + CHOIR.indexOf(voice as (typeof CHOIR)[number]);
  };
  return [...CHOIR].sort((a, b) => slotOf(a) - slotOf(b));
}

/** The voices the next Raise would bring: missing ones in `raiseOrder`, up to `voices` in all. */
function raiseVoices(world: World): string[] {
  const present = voicesPresent(world);
  let n = voicesStanding(world).length;
  for (const p of world.internal.pendingSpawns) if (VOICES.has(p.defId)) n++;
  const room = POSTLUDE.voices - n;
  if (room <= 0) return [];
  return raiseOrder(world)
    .filter((id) => !present.has(id))
    .slice(0, room);
}

/** A Raise, if it would bring anyone and none is in flight; the next is due its cooldown on. */
function beginRaise(world: World, boss: Entity, m4: M4): boolean {
  if (inFlight(world, boss, RAISE) || raiseVoices(world).length === 0) return false;
  const raise = attackDef(RAISE);
  if (!beginAttack(world, boss, raise, null)) return false;
  m4.nextRaiseAt = world.time + raise.cooldown;
  return true;
}

/** The boss's `attackId` telegraph is still unresolved. */
function inFlight(world: World, boss: Entity, attackId: string): boolean {
  return world.telegraphs.some((t) => t.owner === boss.id && t.attackId === attackId);
}

/** The Raise lands: each voice stands on the ring around the Conductor after its warning. */
function raise(world: World, boss: Entity): void {
  const voices = raiseVoices(world);
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

// ── Duets ────────────────────────────────────────────────────────────────────────────

/** The Cue's gate, as the Conductor's: no Fortissimo Silence up or due, fewer than two live. */
function cueGate(world: World, f: FinaleField, m4: M4): boolean {
  if (f.fortissimo || m4.queued) return false;
  if (f.discord && f.discord.value >= DISCORD_MAX - 1e-9) return false;
  return liveDamaging(world) < LIVE_CAP;
}

/**
 * The pair's first Cue, on its cadence, past the gate and with no Cue singing; the second is due
 * `pairGap` s on. With no idle voice it waits; with none standing or on its way, a Raise.
 */
function cuePair(world: World, boss: Entity, f: FinaleField, m4: M4, clocks: PostludeClocks) {
  if (f.cue || !cueGate(world, f, m4)) return false;
  const first = pickSoloist(world, m4);
  if (!first) {
    if (voicesPresent(world).size === 0) return beginRaise(world, boss, m4);
    return false;
  }
  if (!beginCue(world, boss, f, first)) return false;
  clocks.nextPairAt =
    world.time + (f.postlude?.enraged ? POSTLUDE.enragedCueEvery : POSTLUDE.cueEvery);
  clocks.secondAt = world.time + POSTLUDE.pairGap;
  clocks.first = first.id;
  // The voice that will answer it, if one is idle now (the second Cue takes another if not).
  const next = pickSoloist(world, m4, first.id);
  if (next) clocks.second = next.id;
  else delete clocks.second;
  return true;
}

/**
 * The pair's second Cue: another idle voice, once the first Cue has landed and the gate lets it
 * (a second that would make a third damaging telegraph live waits). With no other voice to Cue,
 * the pair ends at one.
 */
function cueSecond(world: World, boss: Entity, f: FinaleField, m4: M4, clocks: PostludeClocks) {
  if (inFlight(world, boss, CUE) || !cueGate(world, f, m4)) return false;
  const firstId = clocks.first;
  const planned = clocks.second === undefined ? undefined : world.entities.get(clocks.second);
  const second =
    planned?.enemy && planned.id !== firstId && idle(planned)
      ? planned
      : pickSoloist(world, m4, firstId);
  if (!second) {
    if (voicesStanding(world).some((e) => e.id !== firstId)) return false;
    endPair(clocks);
    return false;
  }
  if (!beginCue(world, boss, f, second)) return false;
  world.events.push({
    type: 'postludePair',
    tick: world.tick,
    voices: firstId === undefined ? [second.id] : [firstId, second.id],
  });
  endPair(clocks);
  return true;
}

/**
 * The soloist, as the Conductor picks it: an idle voice never Cued first, else the one Cued
 * longest ago, ties to the lower entity id; never `not` (the pair's first). No draw.
 */
function pickSoloist(world: World, m4: M4, not?: EntityId): Entity | null {
  let best: Entity | null = null;
  let bestAt = Infinity;
  for (const e of voicesStanding(world)) {
    if (e.id === not || !idle(e)) continue;
    const at = m4.cuedAt?.[e.id] ?? -Infinity;
    if (best === null || at < bestAt || (at === bestAt && e.id < best.id)) {
      best = e;
      bestAt = at;
    }
  }
  return best;
}

function endPair(clocks: PostludeClocks): void {
  delete clocks.secondAt;
  delete clocks.second;
  delete clocks.first;
}

/** The boss Cues `soloist` (its `conductor_cue` cast); the Cue's state names it. */
function beginCue(world: World, boss: Entity, f: FinaleField, soloist: Entity): boolean {
  const solo = SOLOS[soloist.enemy!.defId]!;
  if (!beginAttack(world, boss, attackDef(CUE), null)) return false;
  const id = boss.enemy!.cast?.telegraph;
  const t = id === null || id === undefined ? undefined : world.telegraphs.find((x) => x.id === id);
  f.cue = { boss: boss.id, soloist: soloist.id, solo, until: t?.impact ?? world.time };
  world.events.push({
    type: 'enemyCued',
    tick: world.tick,
    boss: boss.id,
    soloist: soloist.id,
    solo,
  });
  return true;
}

/**
 * A Cue lands: its voice begins its Solo (its Decree on its first `decreeLimit` casts, as the
 * Conductor's). One that can't begin drops the Cue; the pair's clocks go on.
 */
function beginSolo(world: World, f: FinaleField, m4: M4): void {
  const cue = f.cue;
  const soloist = cue ? world.entities.get(cue.soloist) : undefined;
  const solo = cue ? attackDef(cue.solo) : undefined;
  if (!cue || !soloist?.enemy || !solo || !idle(soloist) || !beginQuiet(world, soloist, solo)) {
    delete f.cue;
    return;
  }
  (m4.cuedAt ??= {})[soloist.id] = world.time;
  const id = soloist.enemy.cast?.telegraph;
  const t = id === null || id === undefined ? undefined : world.telegraphs.find((x) => x.id === id);
  if (t?.target !== null && t?.target !== undefined) cue.target = t.target;
  cue.until = t?.impact ?? world.time;
  if (solo.decree && soloDecreeDue(world, solo)) {
    const hero = cue.target === undefined ? undefined : world.entities.get(cue.target)?.hero;
    const name = hero ? heroDef(hero.defId).name : undefined;
    announce(world, soloist, solo.name, soloDecree(solo.id, name), solo.answers);
  }
}

/** A `script` cast landed in the Postlude: the Raise or a Cue. True if it was handled here. */
function postludeResolved(world: World, boss: Entity, t: Telegraph): boolean {
  if (t.attackId === RAISE) {
    raise(world, boss);
    return true;
  }
  if (t.attackId === CUE) {
    beginSolo(world, world.field.finale!, ensureM4(world));
    return true;
  }
  return false;
}

// ── Stasis and Foresight ─────────────────────────────────────────────────────────────

/** One tick of Stasis: the Postlude's clocks wait (the Conductor's own wait in its hook). */
function postludeStasis(world: World, dt: number): void {
  const p = world.field.finale?.postlude;
  if (p) {
    p.since += dt;
    p.riseUntil += dt;
  }
  const clocks = world.internal.m4?.postlude;
  if (!clocks) return;
  clocks.nextPairAt += dt;
  if (clocks.secondAt !== undefined) clocks.secondAt += dt;
}

/** Its next Cue, for Foresight. */
function postludeNext(world: World): ScriptedNext | null {
  const clocks = world.internal.m4?.postlude;
  if (!clocks) return null;
  return { attackId: CUE, at: clocks.secondAt ?? clocks.nextPairAt };
}

// ── The wrapper ──────────────────────────────────────────────────────────────────────

/**
 * The Conductor's script with the Postlude's hooks: each runs only once the Postlude has begun
 * (a True Dissonance run's rise), and every other fight runs the script exactly as it is.
 */
export function withPostlude(script: BossScript): BossScript {
  const { update, tick, resolved, stasis, scriptedNext } = script;
  return {
    ...script,
    update(world, boss) {
      if (inPostlude(world)) postludeUpdate(world, boss);
      else update?.(world, boss);
    },
    tick(world, boss) {
      if (inPostlude(world) && postludeTick(world, boss)) return;
      tick?.(world, boss);
    },
    resolved(world, boss, t) {
      if (inPostlude(world) && postludeResolved(world, boss, t)) return;
      resolved?.(world, boss, t);
    },
    stasis(world, dt) {
      stasis?.(world, dt);
      if (inPostlude(world)) postludeStasis(world, dt);
    },
    scriptedNext(world, boss) {
      const own = scriptedNext?.(world, boss) ?? null;
      if (!inPostlude(world)) return own;
      const cue = postludeNext(world);
      if (!own) return cue;
      if (!cue) return own;
      return cue.at < own.at - 1e-9 ? cue : own;
    },
  };
}
