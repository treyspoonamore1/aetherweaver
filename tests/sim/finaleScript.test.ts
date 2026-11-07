/**
 * The Silent Conductor's script (docs/phase-5d.md, W1): the registry, the Raise, the Cue and its
 * Solos, Discord and Fortissimo Silence, the Grand Silence (its program, notes, Reignite and the
 * Coda), the last burn, Stasis, Foresight, the enrages and the end of the fight. Staged in a
 * sandbox with the Conductor standing close and everyone tough, so only the script decides.
 */
import { describe, expect, it } from 'vitest';
import { attackDef } from '../../src/content';
import {
  CHOIR_RING,
  CONDUCTOR_DECREES,
  CUE_EVERY,
  DISCORD_RATE,
  SILENCE_STEPS,
  SOLO_PER_NOTE,
  VOICE_PCT_MULT,
} from '../../src/content/crucible';
import {
  ALTO,
  BASS,
  CADENZA,
  CONDUCTOR,
  CUE,
  DOWNBEAT,
  FINAL_CADENCE,
  FORTISSIMO,
  GRAND_SILENCE,
  HALF_CADENCE,
  LAMENT,
  MEASURE,
  RAISE,
  REST,
  SFORZANDO,
  SOLOS,
  SOPRANO,
  TENOR,
} from '../../src/content/crucibleIds';
import { createSim, type Command, type Sim, type SimConfig, type SimEvent } from '../../src/sim';
import {
  addStatus,
  dealDamage,
  hasStatus,
  interruptEnemy,
  killEnemy,
} from '../../src/sim/combat/health';
import { startTelegraph } from '../../src/sim/combat/telegraphs';
import type { Entity, Telegraph } from '../../src/sim/state';
import { BOSS_SCRIPTS, bossScript, encounterScript } from '../../src/sim/systems/bossScripts';
import { bossPhaseTable, phaseRules } from '../../src/sim/systems/bosses';
import type { World } from '../../src/sim/world';
import { ofType, sandbox, spawn, stepFor, stepUntil, worldOf } from './helpers';

const TICK = 1 / 60;
const NEVER = 1e9;
const LYRA = 1;
const setBossHp = (pct: number): Command => ({ t: 'debug', op: { op: 'setBossHp', pct } });
const near = (a: number, b: number, ticks = 1) =>
  expect(Math.abs(a - b)).toBeLessThanOrEqual(ticks * TICK + 1e-6);
const script = BOSS_SCRIPTS[CONDUCTOR]!;
const at = (w: World, slot: number) => w.entities.get(w.party[slot]!)!;

function voices(w: World, defId?: string): Entity[] {
  return w.entities
    .list()
    .filter(
      (e) =>
        e.enemy &&
        [ALTO, BASS, TENOR, SOPRANO].includes(e.enemy.defId) &&
        (defId === undefined || e.enemy.defId === defId) &&
        !e.health!.dead,
    );
}

/**
 * The Conductor in a sandbox, close to the party; it and the heroes too tough to fall (and with
 * `untouchable`, the heroes can't be hurt at all, so the program never runs out of targets).
 */
function conductor(config: Partial<SimConfig> = {}, opts: { untouchable?: boolean } = {}) {
  const sim = sandbox(config);
  const events = stepFor(sim, 1, [spawn(CONDUCTOR, 0, -8)]);
  const w = worldOf(sim);
  const boss = w.entities.list().find((e) => e.enemy?.defId === CONDUCTOR)!;
  boss.health!.hp = boss.health!.maxHp = 1e7;
  for (const id of w.party) {
    const h = w.entities.get(id)!.health!;
    h.hp = h.maxHp = 1e6;
    if (opts.untouchable) h.invulnerable = NEVER;
  }
  if (!w.field.finale) events.push(...stepUntil(sim, () => w.field.finale !== undefined, 600));
  return { sim, w, boss, startedAt: w.time, events };
}

/** The boss's picker waits, so only the script casts. */
function quiet(boss: Entity): void {
  boss.enemy!.specialCooldowns.fill(NEVER);
}

/** Steps until a new telegraph of `attackId` starts; the events on the way go to `sink`. */
function next(sim: Sim, attackId: string, max = 60 * 60, sink: SimEvent[] = []): Telegraph {
  const w = worldOf(sim);
  const seen = new Set(w.telegraphs.map((t) => t.id));
  let found: Telegraph | undefined;
  sink.push(
    ...stepUntil(
      sim,
      () => {
        found = w.telegraphs.find((t) => t.attackId === attackId && !seen.has(t.id));
        for (const t of w.telegraphs) seen.add(t.id);
        return found !== undefined;
      },
      max,
    ),
  );
  return found!;
}

/** Steps `seconds`, recording each new telegraph by attack id. */
function watch(sim: Sim, seconds: number, sink: SimEvent[] = []): Record<string, Telegraph[]> {
  const w = worldOf(sim);
  const starts: Record<string, Telegraph[]> = {};
  const seen = new Set(w.telegraphs.map((t) => t.id));
  for (let i = 0; i < seconds * 60; i++) {
    sink.push(...stepFor(sim, 1));
    for (const t of w.telegraphs) {
      if (seen.has(t.id)) continue;
      seen.add(t.id);
      (starts[t.attackId] ??= []).push(t);
    }
  }
  return starts;
}

/** Takes the boss to `pct` (one phase a tick); returns the events of the crossing. */
function cross(sim: Sim, pct: number): SimEvent[] {
  const events = stepFor(sim, 1, [setBossHp(pct)]);
  for (;;) {
    const more = stepFor(sim, 1);
    events.push(...more);
    if (!more.some((e) => e.type === 'phaseChanged')) return events;
  }
}

/** Into the Grand Silence: phase 3, its cast landed. Returns the silence's start events. */
function silence(sim: Sim): SimEvent[] {
  const events = cross(sim, 0.2);
  events.push(...stepUntil(sim, (ev) => ev.some((e) => e.type === 'silenceBegan'), 60 * 5));
  return events;
}

describe('the registry and the phase table', () => {
  it('has three scripts; every legacy boss misses it; the encounter finds the Conductor’s', () => {
    expect(Object.keys(BOSS_SCRIPTS).sort()).toEqual([
      'the_seamstress',
      'the_silent_conductor',
      'the_unweaver',
    ]);
    for (const id of ['the_bellwarden', 'the_hollow_cantor', 'vharun_crimson_warden', 'toString'])
      expect(bossScript(id), id).toBeUndefined();
    const sim = createSim({ seed: 1, encounter: CONDUCTOR });
    expect(encounterScript(worldOf(sim))).toBe(script);
    expect(script.telegraphVerdict).toBeTypeOf('function');
    expect(script.crescendo).toBeTypeOf('function');
    expect(BOSS_SCRIPTS.the_unweaver!.telegraphVerdict).toBeUndefined();
    expect(BOSS_SCRIPTS.the_seamstress!.crescendo).toBeUndefined();
  });

  it('names its three phases; the Grand Silence leaves the picker no specials', () => {
    expect(bossPhaseTable(CONDUCTOR)).toEqual([
      { at: 1, name: 'Overture' },
      { at: 0.6, name: 'Mirror Choir' },
      { at: 0.3, name: 'Grand Silence' },
    ]);
    expect(phaseRules(CONDUCTOR, 2)).toEqual({ answers: ['ward', 'chime', 'reel'], specials: [] });
  });

  it('setBossHp drives the phases and their Decrees', () => {
    const { sim, w, boss, events } = conductor();
    expect(ofType(events, 'decree').map((d) => d.text)).toContain(CONDUCTOR_DECREES.overture);
    expect(w.field.finale).toEqual({
      discord: { value: expect.any(Number), rate: DISCORD_RATE.overture },
    });
    expect(w.field.finale!.discord!.value).toBeLessThan(0.05);
    const two = cross(sim, 0.55);
    expect(boss.enemy!.phase).toBe(2);
    expect(ofType(two, 'decree').map((d) => d.name)).toContain('Mirror Choir');
    const three = cross(sim, 0.2);
    expect(boss.enemy!.phase).toBe(3);
    const decree = ofType(three, 'decree').find((d) => d.name === 'Grand Silence')!;
    expect(decree.text).toBe(CONDUCTOR_DECREES.grandSilence);
    expect(decree.answers).toEqual(['ward', 'chime', 'reel']);
  });

  it('a Chronomancer hears the Grand Silence in her own words at its entry, and again', () => {
    const { sim } = conductor({ calling: { id: 'chronomancer', path: [] } });
    cross(sim, 0.55);
    const three = cross(sim, 0.2);
    const entry = ofType(three, 'decree').filter((d) => d.name === 'Grand Silence');
    expect(entry.map((d) => d.text)).toEqual([CONDUCTOR_DECREES.grandSilenceRewind]);
    expect(entry[0]!.answers).toEqual(['ward', 'chime', 'reel']);
    const after = stepUntil(sim, (ev) => ev.some((e) => e.type === 'silenceBegan'), 60 * 5);
    next(sim, MEASURE, 60 * 10, after);
    const again = ofType(after, 'decree').filter((d) => d.name === 'Grand Silence');
    expect(again.map((d) => d.text)).toEqual([CONDUCTOR_DECREES.grandSilenceRewind]);
  });
});

describe('the Raise', () => {
  it('pushes elite pendingSpawns at +1.0 s with a spawnWarning each, on the 6 m ring', () => {
    const { sim, w, boss, startedAt } = conductor();
    quiet(boss);
    const raise = next(sim, RAISE);
    near(raise.start, startedAt + attackDef(RAISE).initialDelay, 2);
    const events = stepUntil(
      sim,
      (ev) => ev.some((e) => e.type === 'telegraphEnded' && e.telegraph === raise.id),
      300,
    );
    const pending = w.internal.pendingSpawns;
    expect(pending.map((p) => p.defId)).toEqual([ALTO, BASS]);
    const warnings = ofType(events, 'spawnWarning');
    expect(warnings).toHaveLength(2);
    pending.forEach((p, i) => {
      expect(p.elite).toBe(true);
      expect(p.affixes).toEqual([]);
      near(p.at, w.time + 1);
      expect(warnings[i]).toMatchObject({ x: p.x, z: p.z, delay: 1 });
      expect(Math.hypot(p.x - boss.x, p.z - boss.z)).toBeCloseTo(CHOIR_RING, 1);
    });
    stepFor(sim, 61);
    expect(voices(w).map((e) => [e.enemy!.defId, e.enemy!.tier])).toEqual([
      [ALTO, 'elite'],
      [BASS, 'elite'],
    ]);
    // The Overture's cap is 2: no Raise while both stand.
    const later = watch(sim, 25);
    expect(later[RAISE]).toBeUndefined();
  });
});

describe('the Mirror Choir’s Raise', () => {
  /** The Overture's Alto and Bass standing (and the heroes through Fortissimo Silence). */
  function choir() {
    const c = conductor({}, { untouchable: true });
    quiet(c.boss);
    next(c.sim, RAISE);
    stepUntil(c.sim, () => voices(c.w).length === 2, 60 * 5);
    stepFor(c.sim, 30);
    for (const v of voices(c.w)) v.health!.hp = v.health!.maxHp = 1e7;
    return c;
  }

  it('is cast at once and brings the Tenor and the Soprano, though the Alto and Bass stand', () => {
    const { sim, w } = choir();
    expect(voices(w).map((e) => e.enemy!.defId)).toEqual([ALTO, BASS]);
    const events = cross(sim, 0.55);
    expect(w.internal.m4!.choirRaise).toBe(true);
    const raise = w.telegraphs.find((t) => t.attackId === RAISE)!;
    expect(raise).toBeDefined();
    events.push(
      ...stepUntil(
        sim,
        (ev) => ev.some((e) => e.type === 'telegraphEnded' && e.telegraph === raise.id),
        300,
      ),
    );
    expect(w.internal.pendingSpawns.map((p) => p.defId)).toEqual([TENOR, SOPRANO]);
    expect(w.internal.m4!.choirRaise).toBeUndefined();
    stepFor(sim, 61);
    for (const v of voices(w)) v.health!.hp = v.health!.maxHp = 1e7;
    expect(
      voices(w)
        .map((e) => e.enemy!.defId)
        .sort(),
    ).toEqual([ALTO, BASS, SOPRANO, TENOR]);
    // Four is over the cap of 3: no Raise while three or more stand.
    expect(watch(sim, 22)[RAISE]).toBeUndefined();
    killEnemy(w, voices(w, ALTO)[0]!, null);
    expect(watch(sim, 22)[RAISE]).toBeUndefined();
    // Under the cap, the next Raise brings the missing voice.
    killEnemy(w, voices(w, BASS)[0]!, null);
    const again = next(sim, RAISE, 60 * 25);
    stepUntil(sim, () => !w.telegraphs.some((t) => t.id === again.id), 300);
    expect(w.internal.pendingSpawns.map((p) => p.defId)).toEqual([ALTO]);
  });

  it('is a boss cast no one can interrupt', () => {
    const { sim, w, boss } = choir();
    cross(sim, 0.55);
    const raise = w.telegraphs.find((t) => t.attackId === RAISE)!;
    expect(raise).toBeDefined();
    expect(interruptEnemy(w, boss, null)).toBe(false);
    expect(w.telegraphs.some((t) => t.id === raise.id)).toBe(true);
  });

  it('a phase-3 crossing before it lands drops the owed voices', () => {
    const { sim, w } = choir();
    cross(sim, 0.55);
    expect(w.internal.m4!.choirRaise).toBe(true);
    cross(sim, 0.2);
    expect(w.internal.m4?.choirRaise).toBeUndefined();
    expect(w.telegraphs.some((t) => t.attackId === RAISE)).toBe(false);
    stepFor(sim, 60 * 3);
    expect(voices(w)).toEqual([]);
    expect(w.internal.pendingSpawns.filter((p) => [TENOR, SOPRANO].includes(p.defId))).toEqual([]);
  });

  it('a phase-3 crossing on the tick the Raise lands (or just before or after) brings no voice', () => {
    // The Raise's cast ends in updateEnemies, the crossing comes in updateBosses, and its
    // telegraph resolves after both: on that tick the old Raise must not bring its voices.
    for (const ticksBefore of [2, 1, 0]) {
      const { sim, w, boss } = choir();
      cross(sim, 0.55);
      const raise = w.telegraphs.find((t) => t.owner === boss.id && t.attackId === RAISE)!;
      expect(raise, `${ticksBefore}`).toBeDefined();
      // Up to the step `ticksBefore` ticks before the one that lands it (0: that very step).
      while (w.time + (ticksBefore + 1) * TICK < raise.impact - 1e-9) stepFor(sim, 1);
      cross(sim, 0.2);
      expect(boss.enemy!.phase).toBe(3);
      const owed = () => w.internal.pendingSpawns.filter((p) => [TENOR, SOPRANO].includes(p.defId));
      expect(owed(), `${ticksBefore}`).toEqual([]);
      stepUntil(sim, () => w.field.finale!.silence !== undefined, 60 * 5);
      stepFor(sim, 60 * 3);
      expect(w.field.finale!.silence, `${ticksBefore}`).toBeDefined();
      expect(voices(w), `${ticksBefore}`).toEqual([]);
      expect(owed(), `${ticksBefore}`).toEqual([]);
    }
  });

  it('with one Overture voice fallen, it still brings both: the choir is three', () => {
    const { sim, w } = choir();
    killEnemy(w, voices(w, ALTO)[0]!, null);
    cross(sim, 0.55);
    const raise = w.telegraphs.find((t) => t.attackId === RAISE)!;
    stepUntil(sim, () => !w.telegraphs.some((t) => t.id === raise.id), 300);
    expect(w.internal.pendingSpawns.map((p) => p.defId)).toEqual([TENOR, SOPRANO]);
  });
});

describe('the Cue', () => {
  it('Cues a never-Cued voice; its Solo begins as the Cue lands and names the target then', () => {
    const { sim, w, boss, startedAt } = conductor();
    quiet(boss);
    const sink: SimEvent[] = [];
    const cue = next(sim, CUE, 60 * 20, sink);
    near(cue.start, startedAt + attackDef(CUE).initialDelay, 2);
    const alto = voices(w, ALTO)[0]!;
    const cued = ofType(sink, 'enemyCued');
    expect(cued).toEqual([
      expect.objectContaining({ boss: boss.id, soloist: alto.id, solo: LAMENT }),
    ]);
    expect(w.field.finale!.cue).toEqual({
      boss: boss.id,
      soloist: alto.id,
      solo: LAMENT,
      until: cue.impact,
    });
    // The Overture's Decree again, on its first Cue (the first was at the fight's start).
    expect(ofType(sink, 'decree').filter((d) => d.name === 'Overture')).toHaveLength(1);
    const events: SimEvent[] = [];
    const solo = next(sim, LAMENT, 120, events);
    near(solo.start, cue.impact);
    expect(solo.owner).toBe(alto.id);
    expect(w.field.finale!.cue).toMatchObject({ target: solo.target, until: solo.impact });
    expect(w.internal.m4!.cuedAt![alto.id]).toBeCloseTo(solo.start, 6);
    const named = ofType(events, 'decree').find((d) => d.name === 'Lament')!;
    const hero = w.entities.get(solo.target!)!;
    expect(named.text).toContain(hero.hero!.defId === 'lyra' ? 'Lyra' : 'Vexis');
    // It ends with its Solo; the next Cue (12 s on) goes to the Bass, never Cued yet.
    stepUntil(sim, () => !w.telegraphs.some((t) => t.id === solo.id), 300);
    stepFor(sim, 2);
    expect(w.field.finale!.cue).toBeUndefined();
    const second: SimEvent[] = [];
    const cue2 = next(sim, CUE, 60 * 20, second);
    near(cue2.start - cue.start, CUE_EVERY.overture, 2);
    expect(ofType(second, 'enemyCued')[0]!.soloist).toBe(voices(w, BASS)[0]!.id);
  });

  it('waits for an idle voice; with none standing it Raises instead', () => {
    const { sim, w, boss } = conductor();
    quiet(boss);
    stepUntil(
      sim,
      () => voices(w).length === 2 && voices(w).every((v) => v.enemy!.state !== 'spawning'),
    );
    for (const v of voices(w)) addStatus(w, v, 'stun', 6, null);
    const m4 = w.internal.m4!;
    const due = m4.nextCueAt!;
    const waited = watch(sim, due - w.time + 3);
    expect(waited[CUE]).toBeUndefined();
    const cue = next(sim, CUE, 60 * 10);
    expect(cue.start).toBeGreaterThan(due + 2);
    // Both fall: the next due Cue is a Raise.
    stepUntil(sim, () => !w.telegraphs.some((t) => t.owner !== boss.id), 600);
    for (const v of voices(w)) killEnemy(w, v, null);
    m4.nextCueAt = w.time + 0.5;
    m4.nextRaiseAt = NEVER;
    const starts = watch(sim, 2);
    expect(starts[CUE]).toBeUndefined();
    expect(starts[RAISE]).toHaveLength(1);
  });

  it('a Cue turned Raise is cast once: the voices on their way wait for it to land', () => {
    const { sim, w, boss } = conductor();
    quiet(boss);
    const m4 = w.internal.m4!;
    m4.nextRaiseAt = NEVER;
    m4.nextCueAt = w.time + 0.5;
    expect(voices(w)).toEqual([]);
    const sink: SimEvent[] = [];
    const starts = watch(sim, 5, sink);
    expect(starts[RAISE]).toHaveLength(1);
    expect(ofType(sink, 'spawnWarning')).toHaveLength(2);
    expect(
      voices(w)
        .map((e) => e.enemy!.defId)
        .sort(),
    ).toEqual([ALTO, BASS]);
    // The same with the choir felled after each Raise lands: one Raise per due Cue, never two.
    for (const v of voices(w)) killEnemy(w, v, null);
    m4.nextCueAt = w.time + 0.5;
    const again = watch(sim, 5);
    expect(again[RAISE]).toHaveLength(1);
  });

  it('in the Mirror Choir, a Cue turned Raise brings its voices once, not again 1.5 s on', () => {
    const { sim, w, boss } = conductor({}, { untouchable: true });
    quiet(boss);
    const m4 = w.internal.m4!;
    m4.nextRaiseAt = NEVER;
    cross(sim, 0.55);
    // The entry Raise lands; then the whole choir falls, and the Cue is due with no one standing.
    stepUntil(sim, () => !w.telegraphs.some((t) => t.attackId === RAISE), 600);
    stepFor(sim, 70);
    w.internal.pendingSpawns.length = 0;
    for (const v of voices(w)) killEnemy(w, v, null);
    w.field.finale!.discord!.value = 0;
    m4.nextRaiseAt = NEVER;
    m4.nextCueAt = w.time + 0.5;
    const sink: SimEvent[] = [];
    const starts = watch(sim, 6, sink);
    expect(starts[RAISE]).toHaveLength(1);
    expect(ofType(sink, 'spawnWarning')).toHaveLength(2);
  });

  it('a Solo’s share of life lands as its voice’s Codex tells it (an elite’s ×1.1)', () => {
    const { sim, w, boss } = conductor();
    quiet(boss);
    next(sim, CUE, 60 * 20);
    const alto = voices(w, ALTO)[0]!;
    expect(alto.enemy!.tier).toBe('elite');
    const solo = next(sim, LAMENT, 120);
    expect(solo.pctMaxHp).toBeCloseTo(attackDef(LAMENT).pctMaxHp! * VOICE_PCT_MULT, 9);
    const codex = w.content.enemies.find((e) => e.id === ALTO)!.codex!;
    expect(codex).toContain(`takes ${Math.round(solo.pctMaxHp * 100)}% of their life`);
    expect(codex).toContain('55%');
    const tenor = w.content.enemies.find((e) => e.id === TENOR)!.codex!;
    expect(tenor).toContain(`${Math.round(attackDef(CADENZA).pctMaxHp! * VOICE_PCT_MULT * 100)}%`);
    expect(tenor).toContain('110% of their life');
  });

  it('a Solo that can’t begin drops the Cue, and the next is tried 2 s on', () => {
    const { sim, w, boss } = conductor();
    quiet(boss);
    const cue = next(sim, CUE, 60 * 20);
    const soloist = w.entities.get(w.field.finale!.cue!.soloist)!;
    addStatus(w, soloist, 'stun', 3, null);
    const events = stepUntil(
      sim,
      (ev) => ev.some((e) => e.type === 'telegraphEnded' && e.telegraph === cue.id),
      300,
    );
    expect(ofType(events, 'telegraphStarted').some((t) => t.owner === soloist.id)).toBe(false);
    expect(w.field.finale!.cue).toBeUndefined();
    expect(w.internal.m4!.cuedAt?.[soloist.id]).toBeUndefined();
    near(w.internal.m4!.nextCueAt!, w.time + 2, 1);
  });

  it('waits behind Fortissimo Silence and two live damaging telegraphs', () => {
    const { sim, w, boss } = conductor();
    quiet(boss);
    stepUntil(
      sim,
      () => voices(w).length === 2 && voices(w).every((v) => v.enemy!.state !== 'spawning'),
    );
    const m4 = w.internal.m4!;
    // Two damaging telegraphs live, far from anyone.
    for (const x of [-15, 15])
      startTelegraph(w, {
        owner: boss,
        attack: attackDef(DOWNBEAT),
        target: null,
        shape: { kind: 'circle', x, z: 15, r: 0.5 },
        windup: 4,
        damage: 1,
        pctMaxHp: 0,
      });
    m4.nextCueAt = w.time;
    expect(watch(sim, 3)[CUE]).toBeUndefined();
    const cue = next(sim, CUE, 120);
    expect(cue.start).toBeGreaterThan(m4.nextCueAt - 15);
    // Fortissimo Silence: no Cue while it plays.
    stepUntil(sim, () => !w.field.finale!.cue, 600);
    w.field.finale!.discord!.value = 100;
    next(sim, FORTISSIMO[0], 600);
    m4.nextCueAt = w.time;
    const during = watch(sim, 5);
    expect(during[CUE]).toBeUndefined();
    expect(during[FORTISSIMO[2]]).toHaveLength(1);
  });
});

describe('Discord', () => {
  it('swells 0.3/s in the Overture; failures add their amount; at phase 2 a floor of 70 and 1/s', () => {
    const { sim, w, boss } = conductor();
    quiet(boss);
    const d = w.field.finale!.discord!;
    const v0 = d.value;
    const t0 = w.time;
    stepFor(sim, 120);
    expect(d.value - v0).toBeCloseTo((w.time - t0) * DISCORD_RATE.overture, 6);
    // A failed boss attack: +5.
    const t = startTelegraph(w, {
      owner: boss,
      attack: attackDef(DOWNBEAT),
      target: null,
      shape: { kind: 'raid' },
      windup: 0.5,
      damage: 100,
      pctMaxHp: 0,
    });
    const events = stepFor(sim, 40);
    expect(ofType(events, 'discordRose')).toEqual([
      expect.objectContaining({ telegraph: t.id, amount: attackDef(DOWNBEAT).discord }),
    ]);
    const shift = cross(sim, 0.55);
    expect(ofType(shift, 'phaseChanged')).toHaveLength(1);
    expect(d.value).toBeGreaterThanOrEqual(70);
    expect(d.rate).toBe(1);
    const held = d.value;
    stepUntil(sim, () => w.time >= w.internal.boss.phaseShiftUntil - TICK);
    expect(d.value).toBe(held);
    const t1 = w.time;
    const v1 = d.value;
    stepFor(sim, 60);
    expect(d.value - v1).toBeCloseTo(w.time - t1, 6);
  });
});

describe('Fortissimo Silence', () => {
  function play(config: Partial<SimConfig>) {
    const s = conductor(config);
    quiet(s.boss);
    s.w.internal.m4!.nextCueAt = NEVER;
    s.w.internal.m4!.nextRaiseAt = NEVER;
    s.w.field.finale!.discord!.value = 100;
    const sink: SimEvent[] = [];
    const first = next(s.sim, FORTISSIMO[0], 120, sink);
    const second = next(s.sim, FORTISSIMO[1], 600, sink);
    const third = next(s.sim, FORTISSIMO[2], 600, sink);
    sink.push(...stepFor(s.sim, Math.ceil((third.impact - s.w.time) * 60) + 3));
    return { ...s, first, second, third, sink };
  }

  it('three raid pulses at 3.0 / ≈4.5 / ≈6.0 s; Discord is 0 after the third', () => {
    const { w, first, second, third, sink } = play({});
    near(first.impact - first.start, 3);
    near(second.impact - first.start, 4.5, 1);
    near(third.impact - first.start, 6, 2);
    expect([first, second, third].every((t) => t.shape.kind === 'raid')).toBe(true);
    expect(ofType(sink, 'damageTaken').filter((d) => d.telegraph === first.id)).toHaveLength(3);
    expect(ofType(sink, 'telegraphEnded').some((e) => e.telegraph === third.id)).toBe(true);
    expect(w.field.finale!.fortissimo).toBeUndefined();
    expect(w.field.finale!.discord!.value).toBeLessThan(1);
  });

  it('every pulse is longer in proportion with telegraphLead 1.5', () => {
    const { first, second, third } = play({ assists: { telegraphLead: 1.5 } });
    near(first.impact - first.start, 4.5);
    near(second.impact - first.start, 6.75, 1);
    near(third.impact - first.start, 9, 2);
  });

  it('waits for a Cue in flight: its Solo begins and resolves first, never beside it', () => {
    const { sim, w, boss } = conductor({}, { untouchable: true });
    quiet(boss);
    const m4 = w.internal.m4!;
    m4.nextRaiseAt = NEVER;
    const cue = next(sim, CUE, 60 * 20);
    // Discord fills during the Cue's cast, before its Solo begins.
    w.field.finale!.discord!.value = 99.8;
    const solos = new Set(Object.values(SOLOS));
    let overlap = 0;
    let soloSeen = false;
    const fortissimo = stepUntil(
      sim,
      () => {
        const live = w.telegraphs.map((t) => t.attackId);
        const solo = live.some((id) => solos.has(id));
        soloSeen ||= solo;
        if (solo && live.includes(FORTISSIMO[0])) overlap++;
        return live.includes(FORTISSIMO[0]);
      },
      60 * 10,
    );
    expect(ofType(fortissimo, 'telegraphStarted').some((t) => t.owner === boss.id)).toBe(true);
    expect(soloSeen).toBe(true);
    expect(overlap).toBe(0);
    const first = w.telegraphs.find((t) => t.attackId === FORTISSIMO[0])!;
    expect(first.start).toBeGreaterThan(cue.impact + 1e-6);
  });

  it('a phase-2 crossing re-queues it, cast again after the shift with a full telegraph', () => {
    const { sim, w, boss } = conductor();
    quiet(boss);
    w.field.finale!.discord!.value = 100;
    next(sim, FORTISSIMO[0], 120);
    const events = cross(sim, 0.55);
    expect(ofType(events, 'fortissimoCancelled')).toEqual([
      expect.objectContaining({ by: 'phase' }),
    ]);
    expect(w.internal.m4!.queued).toBe(true);
    expect(w.field.finale!.discord!.value).toBe(100);
    const again = next(sim, FORTISSIMO[0], 600);
    expect(again.start).toBeGreaterThanOrEqual(w.internal.boss.phaseShiftUntil - 1e-6);
    near(again.impact - again.start, 3);
    expect(w.internal.m4!.queued).toBeUndefined();
  });

  it('a phase-3 crossing drops it: the Grand Silence replaces Discord', () => {
    const { sim, w, boss } = conductor();
    quiet(boss);
    cross(sim, 0.55);
    w.field.finale!.discord!.value = 100;
    next(sim, FORTISSIMO[0], 600);
    const events = cross(sim, 0.2);
    expect(ofType(events, 'fortissimoCancelled')).toEqual([
      expect.objectContaining({ by: 'phase' }),
    ]);
    expect(w.telegraphs.some((t) => (FORTISSIMO as readonly string[]).includes(t.attackId))).toBe(
      false,
    );
    expect(w.field.finale!.discord).toBeUndefined();
    expect(w.field.finale!.fortissimo).toBeUndefined();
    expect(w.internal.m4!.queued).toBeUndefined();
    expect(watch(sim, 8)[FORTISSIMO[0]]).toBeUndefined();
  });

  it('any Calling’s Crescendo cancels one due behind a Solo: Stasis outlasts no Solo it holds', () => {
    const resonance: Command = { t: 'debug', op: { op: 'setResonance', value: 100 } };
    for (const calling of [undefined, { id: 'chronomancer' as const, path: [] }]) {
      const name = calling?.id ?? 'none';
      const { sim, w, boss } = conductor(calling ? { calling } : {}, { untouchable: true });
      quiet(boss);
      w.internal.m4!.nextRaiseAt = NEVER;
      const cue = next(sim, CUE, 60 * 20);
      stepUntil(sim, () => !w.telegraphs.some((t) => t.id === cue.id), 120);
      // Its Solo sings; Discord fills, so Fortissimo Silence waits for the Solo to resolve.
      expect(w.field.finale!.cue, name).toBeDefined();
      w.field.finale!.discord!.value = 100;
      stepFor(sim, 1, [resonance]);
      const events = stepFor(sim, 1, [{ t: 'crescendo' }]);
      expect(ofType(events, 'fortissimoCancelled'), name).toEqual([
        expect.objectContaining({ by: 'crescendo' }),
      ]);
      expect(w.field.finale!.discord!.value, name).toBeLessThan(1);
      expect(watch(sim, 10)[FORTISSIMO[0]], name).toBeUndefined();
    }
  });

  it('Short Fuse never takes a Finale telegraph under 1.0 s (the Cue’s 1.2 s × 0.8)', () => {
    const { sim, w, boss } = conductor(
      { dissonance: [{ id: 'short_fuse', rank: 2 }] },
      { untouchable: true },
    );
    expect(w.mods.dissonanceWindupMult).toBeCloseTo(0.8, 9);
    quiet(boss);
    const raise = next(sim, RAISE, 60 * 10);
    near(raise.impact - raise.start, 1.5 * 0.8);
    const cue = next(sim, CUE, 60 * 20);
    near(cue.impact - cue.start, 1);
    expect(cue.impact - cue.start).toBeGreaterThanOrEqual(1 - 1e-9);
  });
});

describe('the Grand Silence', () => {
  it('shatters the choir; stills the heroes; holds the boss; plays the program from impacts', () => {
    const { sim, w, boss } = conductor({}, { untouchable: true });
    quiet(boss);
    stepUntil(sim, () => voices(w).length === 2, 60 * 8);
    stepFor(sim, 60);
    const three = cross(sim, 0.2);
    expect(voices(w)).toHaveLength(0);
    expect(ofType(three, 'enemyKilled').map((k) => k.killer)).toEqual([null, null]);
    const cast = w.telegraphs.find((t) => t.attackId === GRAND_SILENCE)!;
    near(cast.impact - cast.start, 2);
    const began = silence(sim);
    const ev = ofType(began, 'silenceBegan')[0]!;
    const s = w.field.finale!.silence!;
    expect(s).toEqual({ notes: 0, of: 8, since: w.time, until: w.time + 50, sources: [] });
    expect(ev).toMatchObject({ boss: boss.id, until: s.until });
    for (const id of w.party) expect(hasStatus(w.entities.get(id)!, 'stilled')).toBe(true);
    expect(w.internal.m4!.seen).toEqual({
      perfects: w.ledger.perfects,
      clutch: w.ledger.clutchCleanses,
      saves: w.ledger.saves.length,
      rewound: w.ledger.calling.rewound,
      markers: w.ledger.markers.length,
    });
    const sink: SimEvent[] = [];
    const starts: Record<string, Telegraph[]> = {};
    const seen = new Set<number>();
    for (let i = 0; i < 60 * 30; i++) {
      sink.push(...stepFor(sim, 1));
      expect(boss.health!.invulnerable).toBeGreaterThan(0);
      expect(boss.enemy!.attackCooldown).toBeGreaterThanOrEqual(0.4);
      expect(w.telegraphs.filter((t) => t.effect === 'damage').length).toBeLessThanOrEqual(2);
      for (const id of w.party) expect(w.entities.get(id)!.hero!.riposteOn).toBeNull();
      for (const t of w.telegraphs)
        if (!seen.has(t.id)) {
          seen.add(t.id);
          (starts[t.attackId] ??= []).push(t);
        }
    }
    // The heroes dealt nothing, and the boss took nothing.
    expect(
      ofType(sink, 'damageTaken').filter((d) => d.target === boss.id && d.amount > 0),
    ).toHaveLength(0);
    const rests = starts[REST]!;
    const measures = starts[MEASURE]!;
    near(rests[0]!.start, s.since);
    near(measures[0]!.start, rests[0]!.impact - 0.5);
    const cadences = [...(starts[FINAL_CADENCE] ?? []), ...(starts[HALF_CADENCE] ?? [])].sort(
      (a, b) => a.start - b.start,
    );
    near(cadences[0]!.start, measures[0]!.impact + 0.5);
    near(rests[1]!.start, cadences[0]!.impact + SILENCE_STEPS.nextCycle);
    near(rests[1]!.start - rests[0]!.start, 10, 2);
    expect(cadences.map((t) => t.attackId).slice(0, 3)).toEqual([
      FINAL_CADENCE,
      HALF_CADENCE,
      FINAL_CADENCE,
    ]);
    expect(measures[0]!.pctMaxHp).toBe(0.7);
  });

  it('the program keeps its order and its cap of two under telegraphLead 1.5 and Lullaby', () => {
    const { sim, w, boss } = conductor(
      {
        assists: { telegraphLead: 1.5 },
        chords: [
          { auras: [], ornaments: [] },
          { auras: ['lullaby'], ornaments: [] },
        ],
      },
      { untouchable: true },
    );
    quiet(boss);
    silence(sim);
    const s = w.field.finale!.silence!;
    near(s.until - s.since, 75);
    const order: string[] = [];
    const seen = new Set<number>();
    const starts: Record<string, Telegraph[]> = {};
    for (let i = 0; i < 60 * 40; i++) {
      stepFor(sim, 1);
      expect(w.telegraphs.filter((t) => t.effect === 'damage').length).toBeLessThanOrEqual(2);
      for (const t of w.telegraphs)
        if (!seen.has(t.id)) {
          seen.add(t.id);
          order.push(t.attackId === HALF_CADENCE ? FINAL_CADENCE : t.attackId);
          (starts[t.attackId] ??= []).push(t);
        }
    }
    expect(order.slice(0, 6)).toEqual([REST, MEASURE, FINAL_CADENCE, REST, MEASURE, FINAL_CADENCE]);
    const rest = starts[REST]![0]!;
    expect(rest.impact - rest.start).toBeGreaterThanOrEqual(3.5 * 1.5 - 1e-6);
    const measure = starts[MEASURE]![0]!;
    near(measure.start, rest.impact - 0.5);
  });

  it('notes: a Perfect, a clutch, a Reel-save and a Rewind; never a Bear, Vow or other save', () => {
    const { sim, w } = conductor();
    silence(sim);
    const m4 = w.internal.m4!;
    for (const id of w.party) w.entities.get(id)!.hero!.solo = 0;
    const l = w.ledger;
    const save = (cause: 'reel' | 'bear' | 'vow' | 'other') =>
      l.saves.push({
        time: 0,
        hero: w.party[LYRA]!,
        heroDefId: 'lyra',
        cause,
        prevented: 1,
        attack: 'x',
      });
    l.perfects++;
    l.markers.push({ time: 0, kind: 'perfect', slot: 2 });
    l.clutchCleanses++;
    l.markers.push({ time: 0, kind: 'cleanse', slot: 1 });
    save('bear');
    save('vow');
    save('other');
    save('reel');
    const events = stepFor(sim, 1);
    const notes = ofType(events, 'silenceNote');
    expect(notes.map((n) => [n.n, n.source, n.hero])).toEqual([
      [1, 'perfect', w.party[2]],
      [2, 'clutch', w.party[1]],
      [3, 'reel', w.party[LYRA]],
    ]);
    expect(w.field.finale!.silence).toMatchObject({
      notes: 3,
      sources: ['perfect', 'clutch', 'reel'],
    });
    for (const id of w.party) expect(w.entities.get(id)!.hero!.solo).toBe(3 * SOLO_PER_NOTE);
    // A Rewind that restored life to a hero a silence blow struck: one note, no hero.
    m4.struck!.push(w.party[0]!);
    l.markers.push({ time: 0, kind: 'rewind', slot: 0 });
    l.calling.rewound += 50;
    expect(ofType(stepFor(sim, 1), 'silenceNote').map((n) => [n.source, n.hero])).toEqual([
      ['rewind', null],
    ]);
    // A Rewind that neither restored nor cancelled: none.
    l.markers.push({ time: 0, kind: 'rewind', slot: 0 });
    expect(ofType(stepFor(sim, 1), 'silenceNote')).toHaveLength(0);
    expect(m4.seen!.saves).toBe(l.saves.length);
  });

  it('a Rewind makes at most one note per 18 s (Temporal Mastery and Quick Rosin can’t beat it)', () => {
    const { sim, w } = conductor({}, { untouchable: true });
    silence(sim);
    const l = w.ledger;
    w.internal.m4!.struck!.push(w.party[0]!);
    const rewind = () => {
      l.markers.push({ time: 0, kind: 'rewind', slot: 0 });
      l.calling.rewound += 50;
      return ofType(stepFor(sim, 1), 'silenceNote').map((n) => n.source);
    };
    const first = w.time;
    expect(rewind()).toEqual(['rewind']);
    near(w.internal.m4!.nextRewindNoteAt!, first + 18, 1);
    // Glide, then Rewind again inside 10 s: it restores life, but no second note.
    stepFor(sim, 60 * 9);
    expect(rewind()).toEqual([]);
    stepUntil(sim, () => w.time >= first + 17.5, 60 * 10);
    expect(rewind()).toEqual([]);
    // Once 18 s have passed, a Rewind that undoes a blow is a note again; other notes never wait.
    stepUntil(sim, () => w.time >= first + 18, 60 * 2);
    l.perfects++;
    expect(rewind()).toEqual(['perfect', 'rewind']);
    expect(w.field.finale!.silence!.notes).toBe(3);
  });

  it('a real Perfect Ward on the Measure and a real clutch Chime on the Rest are notes', () => {
    const { sim, w } = conductor();
    silence(sim);
    const rest = next(sim, REST, 120);
    const marked = w.entities.get(rest.target!)!;
    const events: SimEvent[] = [];
    events.push(...stepUntil(sim, () => w.time >= rest.impact - 0.5, 600));
    events.push(
      ...stepFor(sim, 2, [{ t: 'tech', id: 'chime', point: { x: marked.x, z: marked.z } }]),
    );
    const measure = next(sim, MEASURE, 600, events);
    const target = w.entities.get(measure.target!)!;
    events.push(...stepUntil(sim, () => w.time >= measure.impact - 0.15, 600));
    events.push(...stepFor(sim, 1, [{ t: 'tech', id: 'ward', slot: target.hero!.slot as 0 }]));
    events.push(...stepFor(sim, 30));
    expect(ofType(events, 'cleansed').some((c) => c.clutch)).toBe(true);
    expect(ofType(events, 'perfectWard')).toHaveLength(1);
    expect(ofType(events, 'silenceNote').map((n) => [n.source, n.hero])).toEqual([
      ['clutch', marked.id],
      ['perfect', target.id],
    ]);
  });

  it('a Chronomancer’s Rewind is a note: restoring life, or (Paradox) cancelling a silence blow', () => {
    const restore = conductor({ calling: { id: 'chronomancer', path: [] } });
    silence(restore.sim);
    // The Measure lands on its hero; Rewound half a second on, the life it took comes back.
    const measure = next(restore.sim, MEASURE, 600);
    const struck = restore.w.entities.get(measure.target!)!;
    stepUntil(restore.sim, () => restore.w.time >= measure.impact + 0.5, 600);
    expect(struck.health!.hp).toBeLessThan(struck.health!.maxHp);
    const e1 = stepFor(restore.sim, 2, [{ t: 'tech', id: 'reel', slot: struck.hero!.slot as 0 }]);
    expect(ofType(e1, 'rewound')).toHaveLength(1);
    expect(ofType(e1, 'silenceNote').map((n) => [n.source, n.hero])).toEqual([['rewind', null]]);

    const paradox = conductor({
      calling: {
        id: 'chronomancer',
        path: ['quickened', 'echo_ward', 'temporal_mastery', 'paradox'],
      },
    });
    silence(paradox.sim);
    const rest = next(paradox.sim, REST, 120);
    stepFor(paradox.sim, 60);
    const e2 = stepFor(paradox.sim, 2, [
      { t: 'tech', id: 'reel', slot: paradox.w.entities.get(rest.target!)!.hero!.slot as 0 },
    ]);
    expect(ofType(e2, 'paradox')).toHaveLength(1);
    expect(paradox.w.telegraphs.some((t) => t.id === rest.id)).toBe(false);
    expect(ofType(e2, 'silenceNote').map((n) => n.source)).toEqual(['rewind']);
  });

  it('a Rewind just after the silence’s entry, of life lost before it, is no note', () => {
    const { sim, w } = conductor({ calling: { id: 'chronomancer', path: [] } });
    stepFor(sim, 60 * 4);
    cross(sim, 0.2);
    // Struck while the Grand Silence is still being cast, then Rewound once it has landed.
    stepFor(sim, 30);
    expect(w.field.finale!.silence).toBeUndefined();
    const lyra = at(w, LYRA);
    dealDamage(w, lyra, { source: null, sourceName: 't', amount: 5000, telegraph: null });
    stepUntil(sim, (ev) => ev.some((e) => e.type === 'silenceBegan'), 60 * 5);
    const events = stepFor(sim, 2, [{ t: 'tech', id: 'reel', slot: LYRA }]);
    expect(ofType(events, 'rewound')[0]!.restored).toBeGreaterThan(4000);
    expect(ofType(events, 'silenceNote')).toHaveLength(0);
  });

  it('eight notes Reignite: stilled off, Solos full, the downed stand at 30%, the burn begins', () => {
    const { sim, w, boss } = conductor();
    quiet(boss);
    silence(sim);
    const lyra = at(w, LYRA);
    dealDamage(w, lyra, { source: null, sourceName: 't', amount: 2e6, telegraph: null });
    expect(lyra.health!.downed).toBe(true);
    for (const id of w.party) w.entities.get(id)!.hero!.solo = 0;
    w.ledger.perfects += 8;
    const events = stepFor(sim, 1);
    expect(ofType(events, 'silenceNote')).toHaveLength(8);
    const re = ofType(events, 'reignited');
    expect(re).toEqual([expect.objectContaining({ boss: boss.id, revived: [lyra.id] })]);
    // Each party hero barks as they unfreeze, a fixed line, after Reignite (the downed Lyra too,
    // stood up: her revive's own bark comes before it).
    const lines: Record<string, string> = {
      kael: 'Still needed.',
      lyra: 'You had my back.',
      vexis: 'It… resolves.',
      brann: 'A pain I can sing to.',
    };
    const after = events.slice(events.findIndex((e) => e.type === 'reignited'));
    expect(ofType(after, 'bark').map((b) => [b.speaker, b.line])).toEqual(
      w.party.map((id) => [id, lines[w.entities.get(id)!.hero!.defId]]),
    );
    expect(lyra.health!.downed).toBe(false);
    expect(lyra.health!.hp).toBe(Math.round(lyra.health!.maxHp * 0.3));
    for (const id of w.party) {
      const e = w.entities.get(id)!;
      expect(hasStatus(e, 'stilled')).toBe(false);
      if (e !== lyra) expect(e.hero!.solo).toBe(100);
    }
    expect(w.field.finale!.silence).toBeUndefined();
    expect(boss.health!.invulnerable).toBe(0);
    expect(w.telegraphs.filter((t) => t.owner === boss.id)).toHaveLength(0);
    const m4 = w.internal.m4!;
    expect(m4.live).toBeUndefined();
    expect(m4.seen).toBeUndefined();
    near(m4.nextDownbeatAt!, w.time + 9);
    near(m4.nextSforzandoAt!, w.time + 12);
    // The burn: its Downbeat and Sforzando are the script's; the picker casts nothing before.
    boss.enemy!.specialCooldowns.fill(0);
    const t0 = w.time;
    const starts = watch(sim, 14);
    expect(starts[DOWNBEAT]![0]!.start).toBeGreaterThanOrEqual(t0 + 9 - 1e-6);
    expect(starts[SFORZANDO]![0]!.start).toBeGreaterThanOrEqual(t0 + 12 - 1e-6);
  });

  it('holds the downed from bleeding out, so the eighth note stands up even the long-fallen', () => {
    const { sim, w, boss } = conductor();
    quiet(boss);
    silence(sim);
    const lyra = at(w, LYRA);
    dealDamage(w, lyra, { source: null, sourceName: 't', amount: 2e6, telegraph: null });
    expect(lyra.health!.downed).toBe(true);
    const left = lyra.health!.bleedOut;
    // Longer than any bleed-out (12 s), with no Mend on her.
    const events = stepFor(sim, 60 * 20);
    expect(ofType(events, 'allyOut')).toEqual([]);
    expect(lyra.health!.dead).toBe(false);
    expect(lyra.health!.bleedOut).toBe(left);
    w.ledger.perfects += 8;
    const re = ofType(stepFor(sim, 1), 'reignited');
    expect(re[0]!.revived).toContain(lyra.id);
    expect(lyra.health!.downed).toBe(false);
  });

  it('the Measure and the Cadences strike only the stilled hero they are aimed at', () => {
    const { sim, w, boss } = conductor();
    quiet(boss);
    silence(sim);
    for (const attackId of [MEASURE, FINAL_CADENCE]) {
      const t = next(sim, attackId, 60 * 12);
      expect(t.shape.kind).toBe('circle');
      const target = w.entities.get(t.target!)!;
      expect(t.sole).toBe(target.id);
      // Every other hero frozen right beside it, inside its circle.
      const others = w.party.map((id) => w.entities.get(id)!).filter((e) => e !== target);
      others.forEach((e, i) => Object.assign(e, { x: target.x + 0.6 * (i + 1), z: target.z }));
      const events = stepUntil(
        sim,
        (ev) => ev.some((e) => e.type === 'telegraphEnded' && e.telegraph === t.id),
        60 * 5,
      );
      const hit = ofType(events, 'damageTaken').filter((d) => d.telegraph === t.id);
      expect(
        hit.map((d) => d.target),
        attackId,
      ).toEqual([target.id]);
    }
  });

  it('in the silence an Aegis Link the Weaver joined passes her no share', () => {
    const shareOn = (inSilence: boolean) => {
      const { sim, w, boss } = conductor();
      quiet(boss);
      if (inSilence) silence(sim);
      const lyra = at(w, LYRA);
      const vexis = at(w, 2);
      const weaver = w.entities.get(w.weaverId)!;
      weaver.health!.invulnerable = 0;
      w.internal.link = {
        a: lyra.id,
        b: vexis.id,
        weaver: true,
        appliedAt: w.time,
        until: w.time + 5,
      };
      const before = { weaver: weaver.health!.hp, vexis: vexis.health!.hp };
      // A blow from the boss (a share is split only from an enemy's hit).
      dealDamage(w, lyra, {
        source: boss.id,
        sourceName: 'Conductor',
        amount: 300,
        telegraph: null,
      });
      return {
        weaver: before.weaver - weaver.health!.hp,
        vexis: before.vexis - vexis.health!.hp,
      };
    };
    const silent = shareOn(true);
    expect(silent.weaver).toBe(0);
    expect(silent.vexis).toBeGreaterThan(0);
    // Outside the silence she takes her share, as ever.
    expect(shareOn(false).weaver).toBeGreaterThan(0);
  });

  it('the Coda at the cap: stilled off, the notes’ share kept, no one revived', () => {
    const { sim, w, boss } = conductor();
    quiet(boss);
    silence(sim);
    const lyra = at(w, LYRA);
    dealDamage(w, lyra, { source: null, sourceName: 't', amount: 2e6, telegraph: null });
    for (const id of w.party) w.entities.get(id)!.hero!.solo = 0;
    w.ledger.perfects += 2;
    stepFor(sim, 1);
    const until = w.field.finale!.silence!.until;
    const events = stepUntil(sim, (ev) => ev.some((e) => e.type === 'silenceBroken'), 60 * 60);
    near(w.time, until, 1);
    expect(ofType(events, 'silenceBroken')).toEqual([
      expect.objectContaining({ boss: boss.id, notes: 2 }),
    ]);
    expect(ofType(events, 'reignited')).toHaveLength(0);
    expect(lyra.health!.downed).toBe(true);
    for (const id of w.party) {
      const e = w.entities.get(id)!;
      expect(hasStatus(e, 'stilled')).toBe(false);
      if (e !== lyra) expect(e.hero!.solo).toBe(2 * SOLO_PER_NOTE);
    }
    expect(w.internal.m4!.nextDownbeatAt).toBeDefined();
  });

  it('without a Weaver no notes come, and the party falls before the enrage', () => {
    const sim = createSim({ seed: 4, encounter: CONDUCTOR, debug: true, absent: true });
    const w = worldOf(sim);
    stepUntil(sim, () => w.field.finale !== undefined, 60 * 20);
    const events = cross(sim, 0.2);
    events.push(
      ...stepUntil(
        sim,
        () => w.encounter.status === 'defeat',
        60 * 450,
        () => [],
      ),
    );
    expect(ofType(events, 'silenceBegan')).toHaveLength(1);
    expect(ofType(events, 'silenceNote')).toHaveLength(0);
    expect(w.time).toBeLessThan(w.encounter.enrageAt!);
    // The end of the fight takes everything with it.
    expect(w.field.finale).toBeUndefined();
    expect(w.internal.m4).toBeUndefined();
    for (const id of w.party) expect(hasStatus(w.entities.get(id)!, 'stilled')).toBe(false);
  });
});

describe('Stasis, Foresight, the enrages and the end', () => {
  it('Stasis waits every clock and the silence’s cap, and counts notes', () => {
    const { sim, w } = conductor({ calling: { id: 'chronomancer', path: [] } });
    silence(sim);
    const m4 = w.internal.m4!;
    m4.nextCueAt = 100;
    m4.nextRaiseAt = 101;
    m4.nextDownbeatAt = 102;
    m4.nextSforzandoAt = 103;
    stepFor(sim, 1, [{ t: 'debug', op: { op: 'setResonance', value: 100 } }]);
    stepFor(sim, 1, [{ t: 'crescendo' }]);
    expect(w.field.stasis).toBe(true);
    const before = { ...m4, until: w.field.finale!.silence!.until, time: w.time };
    w.ledger.perfects++;
    const events = stepFor(sim, 30);
    expect(w.field.stasis).toBe(true);
    const waited = w.time - before.time;
    for (const key of [
      'nextCueAt',
      'nextRaiseAt',
      'nextDownbeatAt',
      'nextSforzandoAt',
      'nextRestAt',
      'nextMeasureAt',
      'nextCadenceAt',
    ] as const)
      if (before[key] !== undefined) expect(m4[key]! - before[key]!).toBeCloseTo(waited, 6);
    expect(w.field.finale!.silence!.until - before.until).toBeCloseTo(waited, 6);
    expect(ofType(events, 'silenceNote')).toHaveLength(1);
  });

  it('scriptedNext: the soonest scripted cast, in each phase', () => {
    const { sim, w, boss, startedAt } = conductor();
    expect(script.scriptedNext!(w, boss)).toEqual({
      attackId: RAISE,
      at: startedAt + attackDef(RAISE).initialDelay,
    });
    silence(sim);
    // The Rest is due at once, then the Measure half a second before it lands.
    expect(script.scriptedNext!(w, boss)).toEqual({ attackId: REST, at: w.time });
    const rest = next(sim, REST, 10);
    expect(script.scriptedNext!(w, boss)).toEqual({ attackId: MEASURE, at: rest.impact - 0.5 });
  });

  it('enraged, the Cue comes every 7 s; the silence’s blows stay shares of life', () => {
    const { sim, w, boss } = conductor();
    quiet(boss);
    w.encounter.enrageAt = w.time;
    const a = next(sim, CUE, 60 * 20);
    stepUntil(sim, () => !w.field.finale!.cue, 600);
    const b = next(sim, CUE, 60 * 20);
    near(b.start - a.start, 7, 2);
    silence(sim);
    const measure = next(sim, MEASURE, 600);
    expect(measure.pctMaxHp).toBe(attackDef(MEASURE).pctMaxHp);
  });

  it('its death and cleanup delete everything and lift the freeze', () => {
    const dies = conductor();
    silence(dies.sim);
    killEnemy(dies.w, dies.boss, null);
    expect(dies.w.field.finale).toBeUndefined();
    expect(dies.w.internal.m4).toBeUndefined();
    for (const id of dies.w.party)
      expect(hasStatus(dies.w.entities.get(id)!, 'stilled')).toBe(false);

    const ends = conductor();
    silence(ends.sim);
    script.cleanup!(ends.w);
    expect(ends.w.field.finale).toBeUndefined();
    expect(ends.w.internal.m4).toBeUndefined();
    for (const id of ends.w.party)
      expect(hasStatus(ends.w.entities.get(id)!, 'stilled')).toBe(false);
  });
});
