/**
 * True Dissonance's Postlude (docs/phase-6.md, "True Dissonance: the Postlude"): the killing
 * blow raises the Silent Conductor once, untouchable for `rise` s, at `life` of its life, with no
 * `enemyKilled` and no `onDeath`; two voices are Raised in the slot order of the heroes they
 * sing; pairs every `cueEvery` s, the second `pairGap` s after the first and waiting while two
 * damaging telegraphs are live; Discord at `discordRate`, Fortissimo at 100, cancelled by any
 * Calling's Crescendo; the pressure after `enrageAfter` s; the fight ends at the second death; no
 * windup under the Finale's floor; the Decree's form. Staged in a sandbox as finaleScript.test.ts
 * stages the Conductor, then played whole with the Skilled bot.
 */
import { describe, expect, it } from 'vitest';
import { CONTENT, dissonanceLevel } from '../../src/content';
import { FINALE_MIN_WINDUP, POSTLUDE, POSTLUDE_DECREE } from '../../src/content/crucible';
import {
  ALTO,
  BASS,
  CONDUCTOR,
  CUE,
  FORTISSIMO,
  POSTLUDE_PHASE,
  SOPRANO,
  TENOR,
} from '../../src/content/crucibleIds';
import { makeBot } from '../../src/bots';
import { createSim, type Command, type Sim, type SimConfig, type SimEvent } from '../../src/sim';
import { dealDamage } from '../../src/sim/combat/health';
import { parseReplay, runReplay } from '../../src/sim/replay';
import type { Entity, Telegraph } from '../../src/sim/state';
import { bossPhaseTable, bossPhaseTableWith, phaseDecree } from '../../src/sim/systems/bosses';
import type { World } from '../../src/sim/world';
import { blindDecree } from '../../src/ui/screens/dissonanceModel';
import { ARRIVAL4_KIT, kitConfig } from '../../tools/kits';
import { runScenario } from '../../tools/runScenario';
import { SCENARIO_CONDUCTOR, type Scenario } from '../../tools/scenarios';
import { ofType, sandbox, spawn, stepFor, stepUntil, worldOf } from './helpers';

const TD = [{ id: 'true_dissonance', rank: 1 }];
const NEVER = 1e9;
const VOICES = [ALTO, BASS, TENOR, SOPRANO];
const CRESCENDO: Command = { t: 'crescendo' };

const voicesOf = (w: World): Entity[] =>
  w.entities.list().filter((e) => e.enemy && VOICES.includes(e.enemy.defId) && !e.health!.dead);

/** The Conductor in a sandbox with True Dissonance; it and the party too tough to fall. */
function conductor(config: Partial<SimConfig> = {}) {
  const sim = sandbox({ dissonance: TD, ...config });
  stepFor(sim, 1, [spawn(CONDUCTOR, 0, -8)]);
  const w = worldOf(sim);
  const boss = w.entities.list().find((e) => e.enemy?.defId === CONDUCTOR)!;
  boss.health!.hp = boss.health!.maxHp = 1e6;
  for (const id of w.party) {
    const h = w.entities.get(id)!.health!;
    h.hp = h.maxHp = 1e6;
    h.invulnerable = NEVER;
  }
  stepUntil(sim, () => w.field.finale !== undefined, 600);
  return { sim, w, boss };
}

/** Clears the choir (standing and on its way), so the Postlude's Raise brings its own. */
function silenceChoir(w: World): void {
  w.internal.pendingSpawns = w.internal.pendingSpawns.filter((p) => !VOICES.includes(p.defId));
  for (const e of voicesOf(w)) e.health!.dead = true;
  for (const e of [...w.entities.list()]) if (e.health?.dead && e.enemy) w.entities.despawn(e.id);
}

/** The killing blow, struck by the first hero: the events it made. */
function fell(sim: Sim, boss: Entity): SimEvent[] {
  const w = worldOf(sim);
  boss.health!.hp = 1;
  dealDamage(w, boss, {
    source: w.party[0]!,
    sourceName: 'test',
    amount: 50,
    telegraph: null,
  });
  return sim.drainEvents();
}

/** Steps past the rise. */
function risen(sim: Sim): void {
  const w = worldOf(sim);
  stepUntil(sim, () => w.time >= w.field.finale!.postlude!.riseUntil + 1 / 60, 600);
}

/** Steps until a new telegraph of `attackId` starts. */
function next(sim: Sim, attackId: string, max = 60 * 30): Telegraph {
  const w = worldOf(sim);
  const seen = new Set(w.telegraphs.map((t) => t.id));
  let found: Telegraph | undefined;
  stepUntil(
    sim,
    () => {
      found = w.telegraphs.find((t) => t.attackId === attackId && !seen.has(t.id));
      for (const t of w.telegraphs) seen.add(t.id);
      return found !== undefined;
    },
    max,
  );
  return found!;
}

describe('True Dissonance: the Postlude (docs/phase-6.md)', () => {
  it('the level, its mod, and the par value the run layer reads', () => {
    const level = dissonanceLevel('true_dissonance');
    expect([level.effect, level.points, level.ranks]).toEqual(['true_dissonance', 5, 1]);
    expect(level.values.life).toBe(POSTLUDE.life * 100);
    expect(level.values.finalePar).toBeGreaterThan(0);
    expect(level.text).toContain('{life}%');
    expect(level.text).toContain('Expeditions only');
    const { w } = conductor();
    expect(w.mods.postludeLife).toBeCloseTo(POSTLUDE.life, 12);
    expect(worldOf(sandbox()).mods.postludeLife).toBe(0);
  });

  it('the boss bar’s fourth phase and the Decree, which Blind Score cuts', () => {
    expect(bossPhaseTable(CONDUCTOR)).toHaveLength(3);
    expect(bossPhaseTableWith(CONDUCTOR)).toEqual(bossPhaseTable(CONDUCTOR));
    const four = bossPhaseTableWith(CONDUCTOR, { postlude: true });
    expect(four.slice(0, 3)).toEqual(bossPhaseTable(CONDUCTOR));
    expect(four[3]!.name).toBe('Postlude');
    expect(bossPhaseTableWith('vharun_crimson_warden', { postlude: true })).toEqual(
      bossPhaseTable('vharun_crimson_warden'),
    );
    const decree = phaseDecree(CONDUCTOR, POSTLUDE_PHASE - 1)!;
    expect(decree.text).toBe(POSTLUDE_DECREE);
    expect(decree.text.startsWith('Postlude — ')).toBe(true);
    expect(blindDecree(decree.text)).not.toContain('Crescendo');
    expect(decree.text).not.toMatch(/\d/);
    expect(phaseDecree(CONDUCTOR, 4)).toBeNull();
  });

  it('the killing blow raises it once: untouchable, at its share of life, no kill', () => {
    const { sim, w, boss } = conductor();
    const status = w.encounter.status;
    const events = fell(sim, boss);
    expect(ofType(events, 'enemyKilled')).toEqual([]);
    expect(ofType(events, 'postludeRose')).toEqual([
      { type: 'postludeRose', tick: w.tick, boss: boss.id, hp: Math.round(1e6 * POSTLUDE.life) },
    ]);
    expect(ofType(events, 'phaseChanged').map((e) => e.phase)).toEqual([POSTLUDE_PHASE]);
    expect(ofType(events, 'decree').map((e) => e.name)).toEqual(['Postlude']);
    expect(boss.health!.dead).toBe(false);
    expect(boss.health!.hp).toBe(Math.round(1e6 * POSTLUDE.life));
    expect(boss.enemy!.phase).toBe(POSTLUDE_PHASE);
    // Rising, but not Restless Dead's rise: no `risen`, no `enemyRose` (no ash mark is drawn).
    expect(boss.enemy!.state).toBe('spawning');
    expect(boss.enemy!.risen).toBe(false);
    expect(ofType(events, 'enemyRose')).toEqual([]);
    expect(boss.health!.invulnerable).toBeGreaterThan(0);
    expect(w.encounter.status).toBe(status);
    expect(w.encounter.bossId).toBe(boss.id);
    expect(w.telegraphs.filter((t) => t.owner === boss.id)).toEqual([]);
    const p = w.field.finale!.postlude!;
    expect(p.riseUntil - p.since).toBe(POSTLUDE.rise);
    expect(w.internal.m4!.postlude!.nextPairAt).toBe(p.riseUntil);
    // Untouchable while it rises: hits pass.
    const hp = boss.health!.hp;
    stepFor(sim, 60);
    const hit = dealDamage(w, boss, {
      source: null,
      sourceName: 'test',
      amount: 500,
      telegraph: null,
    });
    expect(hit.dealt).toBe(0);
    expect(boss.health!.hp).toBe(hp);
    risen(sim);
    expect(boss.enemy!.state).not.toBe('spawning');
    expect(boss.health!.invulnerable).toBe(0);
    const after = dealDamage(w, boss, {
      source: null,
      sourceName: 'test',
      amount: 500,
      telegraph: null,
    });
    expect(after.dealt).toBeGreaterThan(0);
    // Once: the next fall is its death, and the Finale's state goes with it.
    sim.drainEvents();
    const death = fell(sim, boss);
    expect(ofType(death, 'enemyKilled').map((e) => e.enemy)).toEqual([boss.id]);
    expect(ofType(death, 'postludeRose')).toEqual([]);
    expect(w.field.finale).toBeUndefined();
    expect(w.internal.m4).toBeUndefined();
  });

  it('nothing once-a-fight is refreshed by the rise', () => {
    const relic = CONTENT.relics.find((r) => (r.triggers?.length ?? 0) > 0)!;
    const { sim, w, boss } = conductor({ relics: [relic.id] });
    w.internal.waterClockUsed = true;
    w.internal.lambUsed = true;
    w.entities.get(w.weaverId)!.weaver!.spareUsed = true;
    const triggers = JSON.stringify(w.internal.triggers);
    expect(w.internal.triggers).toBeDefined();
    fell(sim, boss);
    expect(JSON.stringify(w.internal.triggers)).toBe(triggers);
    stepFor(sim, 60 * 5);
    expect(w.internal.waterClockUsed).toBe(true);
    expect(w.internal.lambUsed).toBe(true);
    expect(w.entities.get(w.weaverId)!.weaver!.spareUsed).toBe(true);
  });

  for (const [party, raised] of [
    [
      ['kael', 'lyra', 'vexis'],
      [TENOR, ALTO],
    ],
    [
      ['brann', 'vexis', 'kael'],
      [BASS, SOPRANO],
    ],
    [
      ['seren', 'lyra', 'oro'],
      [ALTO, TENOR],
    ],
  ] as const)
    it(`the choir re-forms: ${raised.join(' and ')} for ${party.join(', ')}`, () => {
      const { sim, w, boss } = conductor({ party: [...party] });
      silenceChoir(w);
      fell(sim, boss);
      risen(sim);
      const events = stepUntil(
        sim,
        () => w.internal.pendingSpawns.some((p) => VOICES.includes(p.defId)),
        60 * 5,
      );
      const spawns = w.internal.pendingSpawns.filter((p) => VOICES.includes(p.defId));
      expect(spawns.map((p) => p.defId)).toEqual(raised);
      expect(spawns.every((p) => p.elite)).toBe(true);
      expect(ofType(events, 'spawnWarning').length).toBeGreaterThanOrEqual(2);
    });

  it('duets: pairs on their cadence, the second after its gap, never past two damaging live', () => {
    const { sim, w, boss } = conductor();
    silenceChoir(w);
    fell(sim, boss);
    const cues: { at: number; soloist: number; live: number }[] = [];
    const pairs: number[][] = [];
    const short: number[] = [];
    for (let t = 0; t < 60 * 50; t++) {
      for (const v of voicesOf(w)) v.health!.hp = v.health!.maxHp = 1e7;
      sim.step([]);
      const events = sim.drainEvents();
      for (const e of ofType(events, 'enemyCued'))
        cues.push({
          at: w.time,
          soloist: e.soloist,
          live: w.telegraphs.filter((x) => x.effect === 'damage').length,
        });
      for (const e of ofType(events, 'postludePair')) pairs.push(e.voices);
      for (const e of ofType(events, 'telegraphStarted'))
        if (e.impact - e.start < FINALE_MIN_WINDUP - 1e-9) short.push(e.telegraph);
    }
    expect(pairs.length).toBeGreaterThanOrEqual(3);
    for (const v of pairs) {
      expect(v).toHaveLength(2);
      expect(v[0]).not.toBe(v[1]);
    }
    expect(cues.every((c) => c.live < 2)).toBe(true);
    // Cues come in twos: each pair's second at least `pairGap` after its first, each pair's first
    // at least `cueEvery` after the last.
    for (let i = 0; i + 1 < cues.length; i += 2) {
      expect(cues[i + 1]!.at - cues[i]!.at).toBeGreaterThanOrEqual(POSTLUDE.pairGap - 1e-6);
      expect([cues[i]!.soloist, cues[i + 1]!.soloist]).toEqual(pairs[i / 2]);
      if (i >= 2)
        expect(cues[i]!.at - cues[i - 2]!.at).toBeGreaterThanOrEqual(POSTLUDE.cueEvery - 1e-6);
    }
    expect(short).toEqual([]);
  });

  it('a second Cue waits while two damaging telegraphs are live', () => {
    const { sim, w, boss } = conductor();
    silenceChoir(w);
    fell(sim, boss);
    const clocks = () => w.internal.m4!.postlude!;
    stepUntil(
      sim,
      () => clocks().secondAt !== undefined,
      60 * 20,
      () => {
        for (const v of voicesOf(w)) v.health!.hp = v.health!.maxHp = 1e7;
        return [];
      },
    );
    const proto = w.telegraphs[0] ?? next(sim, CUE);
    const fake = (id: number): Telegraph => ({
      ...proto,
      id,
      effect: 'damage',
      owner: boss.id,
      impact: NEVER,
    });
    w.telegraphs.push(fake(90001), fake(90002));
    const held = stepFor(sim, Math.ceil((POSTLUDE.pairGap + 1) * 60));
    expect(ofType(held, 'enemyCued')).toEqual([]);
    expect(clocks().secondAt).toBeDefined();
    w.telegraphs = w.telegraphs.filter((t) => t.id < 90001);
    const free = stepUntil(sim, (ev) => ev.some((e) => e.type === 'enemyCued'), 60 * 5);
    expect(ofType(free, 'postludePair')).toHaveLength(1);
  });

  it('Discord returns at its rate; the pressure after its time', () => {
    const { sim, w, boss } = conductor();
    fell(sim, boss);
    risen(sim);
    const m4 = w.internal.m4!;
    m4.postlude!.nextPairAt = NEVER;
    m4.nextRaiseAt = NEVER;
    m4.nextDownbeatAt = NEVER;
    m4.nextSforzandoAt = NEVER;
    const f = w.field.finale!;
    expect(f.discord).toEqual({ value: expect.any(Number) as number, rate: POSTLUDE.discordRate });
    const before = f.discord!.value;
    const events = stepFor(sim, 60);
    expect(ofType(events, 'discordRose')).toEqual([]);
    expect(f.discord!.value - before).toBeCloseTo(POSTLUDE.discordRate, 6);
    // The pressure: after `enrageAfter` s, Discord × `enragedDiscord` and pairs every
    // `enragedCueEvery` s.
    f.postlude!.since = w.time - POSTLUDE.enrageAfter;
    stepFor(sim, 1);
    expect(f.postlude!.enraged).toBe(true);
    expect(f.discord!.rate).toBe(POSTLUDE.discordRate * POSTLUDE.enragedDiscord);
    m4.postlude!.nextPairAt = w.time;
    stepUntil(sim, (ev) => ev.some((e) => e.type === 'enemyCued'), 60 * 10);
    expect(m4.postlude!.nextPairAt - w.time).toBeCloseTo(POSTLUDE.enragedCueEvery, 6);
  });

  for (const calling of [
    undefined,
    { id: 'luminary' as const, path: [] },
    { id: 'martyr' as const, path: [] },
    { id: 'chronomancer' as const, path: [] },
    { id: 'conductor' as const, path: [] },
  ])
    it(`Fortissimo Silence at 100, cancelled by a Crescendo (${calling?.id ?? 'no Calling'})`, () => {
      const { sim, w, boss } = conductor(calling ? { calling } : {});
      fell(sim, boss);
      risen(sim);
      const m4 = w.internal.m4!;
      m4.postlude!.nextPairAt = NEVER;
      m4.nextRaiseAt = NEVER;
      m4.nextDownbeatAt = NEVER;
      m4.nextSforzandoAt = NEVER;
      w.field.finale!.discord!.value = 100;
      next(sim, FORTISSIMO[0], 600);
      w.entities.get(w.weaverId)!.weaver!.resonance = 100;
      const cast = stepFor(sim, 1, [CRESCENDO]);
      expect(ofType(cast, 'fortissimoCancelled')).toEqual([
        { type: 'fortissimoCancelled', tick: w.tick - 1, boss: boss.id, by: 'crescendo' },
      ]);
      // Emptied by the Crescendo, then swelling again from 0 in the same tick.
      expect(w.field.finale!.discord!.value).toBeLessThanOrEqual(POSTLUDE.discordRate / 60 + 1e-9);
      expect(w.telegraphs.some((t) => (FORTISSIMO as readonly string[]).includes(t.attackId))).toBe(
        false,
      );
    });
});

/**
 * The Silent Conductor's golden fight with True Dissonance (and Short Fuse ×2, for the floor):
 * its life staged to the Grand Silence, then to its last after the burn begins, so the Skilled
 * bot plays the Postlude out.
 */
const POSTLUDE_FIGHT: Scenario = {
  name: 'skilled-postlude-test',
  seed: 4343,
  ticks: 60 * 150,
  config: {
    encounter: CONDUCTOR,
    ...kitConfig(ARRIVAL4_KIT),
    debug: true,
    dissonance: [{ id: 'short_fuse', rank: 2 }, ...TD],
  },
  driver: () => {
    const player = makeBot('skilled', 4343);
    let stage = 0;
    let silenced = false;
    return (_tick, state) => {
      const out = player.decide(state);
      const boss =
        state.encounter.bossId === null ? undefined : state.entities.get(state.encounter.bossId);
      if (state.field.finale?.silence) silenced = true;
      if (stage === 0 && boss) {
        out.push({ t: 'debug', op: { op: 'setBossHp', pct: 0.26 } });
        stage = 1;
      } else if (stage === 1 && silenced && !state.field.finale?.silence) {
        out.push({ t: 'debug', op: { op: 'setBossHp', pct: 0.02 } });
        stage = 2;
      }
      return out;
    };
  },
};

describe('the Postlude, played', () => {
  it('a True Dissonance fight rises, plays its Postlude, ends at the second death; twice the same; a replay', () => {
    const play = () => {
      const sim = createSim({ seed: POSTLUDE_FIGHT.seed, ...POSTLUDE_FIGHT.config });
      const w = worldOf(sim);
      const drive = POSTLUDE_FIGHT.driver();
      const seen: SimEvent[] = [];
      const short: number[] = [];
      let postlude = false;
      for (let t = 0; t < POSTLUDE_FIGHT.ticks; t++) {
        sim.step(drive(t, sim.state));
        const events = sim.drainEvents();
        postlude ||= w.field.finale?.postlude !== undefined;
        for (const e of events)
          if (['postludeRose', 'postludePair', 'enemyKilled', 'encounterEnded'].includes(e.type))
            seen.push(e);
        if (postlude)
          for (const e of ofType(events, 'telegraphStarted'))
            if (e.impact - e.start < FINALE_MIN_WINDUP - 1e-9) short.push(e.telegraph);
      }
      return { hash: sim.hash(), seen, short, status: w.encounter.status };
    };
    const a = play();
    expect(ofType(a.seen, 'postludeRose')).toHaveLength(1);
    const rose = a.seen.findIndex((e) => e.type === 'postludeRose');
    // No kill of the Conductor before its rise; its death after; then the victory.
    const kills = ofType(a.seen, 'enemyKilled');
    const bossKill = a.seen.findIndex((e) => e.type === 'enemyKilled' && e.defId === CONDUCTOR);
    expect(kills.filter((e) => e.defId === CONDUCTOR)).toHaveLength(1);
    expect(bossKill).toBeGreaterThan(rose);
    expect(ofType(a.seen, 'postludePair').length).toBeGreaterThanOrEqual(1);
    expect(a.status).toBe('victory');
    expect(a.short).toEqual([]);
    expect(play().hash).toBe(a.hash);
    const run = runScenario(POSTLUDE_FIGHT);
    expect(run.hash).toBe(a.hash);
    const result = runReplay(parseReplay(JSON.parse(JSON.stringify(run.replay))));
    expect(result.hash).toBe(a.hash);
    expect(result.matches).toBe(true);
  }, 300_000);

  it('without the level, and at every existing level at once, no Postlude and no Tyrant key', () => {
    const all = [
      { id: 'brisk_foes', rank: 1 },
      { id: 'hardened', rank: 2 },
      { id: 'short_fuse', rank: 2 },
      { id: 'muted_choir', rank: 1 },
      { id: 'fragile_threads', rank: 1 },
      { id: 'wounding_strikes', rank: 2 },
      { id: 'elite_vanguard', rank: 1 },
      { id: 'silent_cues', rank: 1 },
      { id: 'restless_dead', rank: 1 },
      { id: 'unforgiving', rank: 1 },
      { id: 'blind_score', rank: 1 },
      { id: 'discordant_pact', rank: 1 },
    ];
    const s = SCENARIO_CONDUCTOR;
    const sim = createSim({ seed: s.seed, ...s.config, dissonance: all });
    const w = worldOf(sim);
    const drive = s.driver();
    let killed = false;
    for (let t = 0; t < s.ticks; t++) {
      sim.step(drive(t, sim.state));
      const events = sim.drainEvents();
      killed ||= ofType(events, 'enemyKilled').some((e) => e.defId === CONDUCTOR);
      expect(ofType(events, 'postludeRose')).toEqual([]);
      expect(ofType(events, 'tyrantEdict')).toEqual([]);
      if (t % 60 !== 0) continue;
      expect(w.field.finale && 'postlude' in w.field.finale).toBeFalsy();
      expect(w.internal.m4 && 'postlude' in w.internal.m4).toBeFalsy();
      for (const e of w.entities.list()) expect(e.enemy && 'tyrant' in e.enemy).toBeFalsy();
    }
    void killed;
  }, 300_000);
});
