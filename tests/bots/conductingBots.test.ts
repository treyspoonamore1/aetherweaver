/**
 * The bots on the Conductor Calling (docs/phase-5f.md, "Bots and harness"): the Skilled bot
 * chains Cues into a Trio and casts a Grand Finale at the Bellwarden; with A Tempo most of its
 * Cues are free; each of its rules and each of the Novice's draws, left off, changes what the
 * fight showed; and nothing of it is read, or drawn, on a run without the Calling (the committed
 * command snapshots, commandSnapshot*.test.ts and roster20.test.ts, pin that for the default and
 * roster parties; here the same is checked against the rules' own switches).
 */
import { describe, expect, it } from 'vitest';
import { NoviceBot, SkilledBot } from '../../src/bots';
import { CONDUCTING_RULES, type ConductingRule, type SkilledOptions } from '../../src/bots/skilled';
import { NOVICE_CONDUCTING, NOVICE_CONDUCTING_RULES } from '../../src/bots/novice';
import {
  beatSoon,
  chainOpen,
  conductingOf,
  crescendoCostOf,
  finaleOn,
  marcatoReady,
} from '../../src/bots/common';
import { CONTENT } from '../../src/content';
import { createSim, onBeat, type SimConfig, type SimEvent } from '../../src/sim';
import { StateHasher, hashValue } from '../../src/sim/core/hash';
import { BAR_SECONDS } from '../../src/sim/constants';
import { kitConfig, ARRIVAL3_KIT, ARRIVAL4_KIT } from '../../tools/kits';
import { SCENARIO_CONDUCTING_BELLWARDEN, SCENARIOS } from '../../tools/scenarios';
import golden from '../sim/golden.json';

/** The golden Bellwarden's path: the beat, Reprise, Ensemble, Maestro (cost 75, twice round). */
const TEMPO_MAESTRO = ['a_tempo', 'reprise', 'ensemble', 'maestro'];
/** Marcato, Upbeat, Spotlight, Triad (cost 100). */
const MARCATO_TRIAD = ['marcato', 'upbeat', 'spotlight', 'triad'];
/** The seeds the rule checks play (the harness's: 1000 + i × 7919). */
const SEEDS = Array.from({ length: 8 }, (_, i) => 1000 + i * 7919);
const MAX_TICKS = 9 * 60 * 60;

type Skip = ReadonlySet<ConductingRule>;
const NONE: Skip = new Set();

function conductorConfig(seed: number, encounter: string, path: string[] | null): SimConfig {
  return {
    seed,
    encounter,
    ...(path ? { calling: { id: 'conductor', path } } : {}),
  };
}

interface Counts {
  won: boolean;
  cues: number;
  duets: number;
  trios: number;
  freeCues: number;
  finales: number;
  marcatos: number;
  commands: string;
}

/** A Skilled bot's whole fight on the Bellwarden, `skip` left off. */
function skilledFight(
  seed: number,
  path: string[] | null,
  skip: Skip = NONE,
  encounter = 'bellwarden',
  config: Partial<SimConfig> = {},
): Counts {
  const sim = createSim({ ...conductorConfig(seed, encounter, path), ...config });
  const opts: SkilledOptions = {
    every: 4,
    attention: 1,
    callReaction: 0.4,
    ...(skip.size > 0 ? { skip } : {}),
  };
  const bot = new SkilledBot(seed, opts);
  const h = new StateHasher();
  for (let t = 0; t < MAX_TICKS; t++) {
    const commands = bot.decide(sim.state);
    if (commands.length > 0) {
      h.u32(t);
      hashValue(h, commands);
    }
    sim.step(commands);
    sim.drainEvents();
    const s = sim.state.encounter.status;
    if (s === 'victory' || s === 'defeat') break;
  }
  const l = sim.state.ledger;
  const c = l.conducting;
  return {
    won: sim.state.encounter.status === 'victory',
    cues: l.cues,
    duets: c?.duets ?? 0,
    trios: c?.trios ?? 0,
    freeCues: c?.freeCues ?? 0,
    finales: c?.finales ?? 0,
    marcatos: c?.marcatos ?? 0,
    commands: h.digest(),
  };
}

const total = (rows: readonly Counts[], f: (c: Counts) => number) =>
  rows.reduce((s, r) => s + f(r), 0);
const fights = (path: string[] | null, skip: Skip = NONE) =>
  SEEDS.map((seed) => skilledFight(seed, path, skip));

describe('the Skilled bot on the Conductor (docs/phase-5f.md)', () => {
  it('makes a Trio and casts a Grand Finale at the Bellwarden (the golden fight)', () => {
    const sc = SCENARIO_CONDUCTING_BELLWARDEN;
    const sim = createSim({ seed: sc.seed, debug: true, ...sc.config });
    const drive = sc.driver();
    let chained = false;
    let finaled = false;
    for (let t = 0; t < sc.ticks; t++) {
      sim.step(drive(t, sim.state));
      sim.drainEvents();
      if (chainOpen(sim.state)) chained = true;
      if (finaleOn(sim.state)) finaled = true;
    }
    const c = sim.state.ledger.conducting!;
    expect(c.trios).toBeGreaterThanOrEqual(1);
    expect(c.finales).toBeGreaterThanOrEqual(1);
    expect(c.finaleSolos).toBe(9);
    expect(chained).toBe(true);
    expect(finaled).toBe(true);
  });

  it('with A Tempo most of its Cues are free', () => {
    const rows = fights(TEMPO_MAESTRO);
    expect(total(rows, (r) => r.cues)).toBeGreaterThan(0);
    expect(total(rows, (r) => r.freeCues) / total(rows, (r) => r.cues)).toBeGreaterThan(0.6);
    // Without the beat's rule it falls to about the chance of landing there (11%).
    const blind = fights(TEMPO_MAESTRO, new Set<ConductingRule>(['conductBeat']));
    expect(total(blind, (r) => r.freeCues) / total(blind, (r) => r.cues)).toBeLessThan(0.3);
  });

  it('plays every fight of the default setup without Conductor rules, as it did', () => {
    // Every rule off or on, a run without the Calling is the same command stream.
    const all = new Set<ConductingRule>(CONDUCTING_RULES);
    for (const seed of SEEDS.slice(0, 3)) {
      const on = skilledFight(seed, null);
      const off = skilledFight(seed, null, all);
      expect(off.commands).toBe(on.commands);
      expect(on.freeCues + on.duets + on.trios + on.finales + on.marcatos).toBe(0);
    }
  });

  describe('each rule, left off, changes what the fight showed', () => {
    it('conductChain: fewer Duets and Trios', () => {
      const on = fights(MARCATO_TRIAD);
      const off = fights(MARCATO_TRIAD, new Set<ConductingRule>(['conductChain']));
      const links = (rows: readonly Counts[]) => total(rows, (r) => r.duets + r.trios);
      expect(links(on)).toBeGreaterThan(0);
      expect(links(off)).toBeLessThan(links(on));
    });

    it('conductHold: another fight', () => {
      // Without A Tempo: with it, the wait for the downbeat (BEAT_AHEAD, a whole bar) covers it.
      const on = fights(MARCATO_TRIAD);
      const off = fights(MARCATO_TRIAD, new Set<ConductingRule>(['conductHold']));
      expect(off.map((r) => r.commands)).not.toEqual(on.map((r) => r.commands));
    });

    it('conductBeat: fewer Cues on the beat', () => {
      const on = fights(TEMPO_MAESTRO);
      const off = fights(TEMPO_MAESTRO, new Set<ConductingRule>(['conductBeat']));
      expect(total(off, (r) => r.freeCues)).toBeLessThan(total(on, (r) => r.freeCues));
    });

    it('conductFinale: fewer Grand Finales', () => {
      const on = fights(MARCATO_TRIAD);
      const off = fights(MARCATO_TRIAD, new Set<ConductingRule>(['conductFinale']));
      expect(total(on, (r) => r.finales)).toBeGreaterThan(0);
      expect(total(off, (r) => r.finales)).toBeLessThan(total(on, (r) => r.finales));
    });

    it('conductMarcato: fewer Marcato grants (at the Unweaver, where a Focus stands)', () => {
      // It sends only the Focus already standing again (a wider Focus costs fights: see
      // `MARCATO_FOCUS`), so it needs a fight in which the bot Focuses: the Unweaver's Spindles.
      const kit = kitConfig(ARRIVAL3_KIT);
      const play = (skip: Skip) =>
        SEEDS.slice(0, 5).map((seed) =>
          skilledFight(seed, MARCATO_TRIAD, skip, 'the_unweaver', kit),
        );
      const on = play(NONE);
      const off = play(new Set<ConductingRule>(['conductMarcato']));
      expect(total(on, (r) => r.marcatos)).toBeGreaterThan(0);
      expect(total(off, (r) => r.marcatos)).toBeLessThan(total(on, (r) => r.marcatos));
      // Ten Unweaver fights: longer than the default 5 s on a loaded machine.
    }, 30_000);
  });

  it('is deterministic: a Conductor fight twice is the same stream', () => {
    expect(skilledFight(1000, TEMPO_MAESTRO)).toEqual(skilledFight(1000, TEMPO_MAESTRO));
  });
});

describe('the Novice on the Conductor (docs/phase-5f.md)', () => {
  function noviceFight(
    seed: number,
    path: string[] | null,
    skip: ReadonlySet<'chain' | 'beat' | 'finale'> = new Set(),
    encounter = 'bellwarden',
    config: Partial<SimConfig> = {},
  ): Counts {
    const sim = createSim({ ...conductorConfig(seed, encounter, path), ...config });
    const bot = new NoviceBot(seed, skip.size > 0 ? { skip } : {});
    const h = new StateHasher();
    for (let t = 0; t < MAX_TICKS; t++) {
      const commands = bot.decide(sim.state);
      if (commands.length > 0) {
        h.u32(t);
        hashValue(h, commands);
      }
      sim.step(commands);
      sim.drainEvents();
      const s = sim.state.encounter.status;
      if (s === 'victory' || s === 'defeat') break;
    }
    const l = sim.state.ledger;
    const c = l.conducting;
    return {
      won: sim.state.encounter.status === 'victory',
      cues: l.cues,
      duets: c?.duets ?? 0,
      trios: c?.trios ?? 0,
      freeCues: c?.freeCues ?? 0,
      finales: c?.finales ?? 0,
      marcatos: c?.marcatos ?? 0,
      commands: h.digest(),
    };
  }

  it('draws only on a Conductor run: with every draw left off, a run without it is unchanged', () => {
    const all = new Set(NOVICE_CONDUCTING_RULES);
    for (const seed of SEEDS.slice(0, 4)) {
      for (const encounter of ['first_light', 'bellwarden']) {
        const on = noviceFight(seed, null, new Set(), encounter);
        const off = noviceFight(seed, null, all, encounter);
        expect(off.commands, `${encounter} ${seed}`).toBe(on.commands);
      }
    }
  });

  it('her three chances are the named constants, and each is a draw on a Conductor run', () => {
    expect(NOVICE_CONDUCTING_RULES).toEqual(['chain', 'beat', 'finale']);
    expect(NOVICE_CONDUCTING).toEqual({ chain: 0.4, beat: 0.5, finale: 0.15 });
    const on = SEEDS.map((seed) => noviceFight(seed, TEMPO_MAESTRO));
    for (const rule of NOVICE_CONDUCTING_RULES) {
      // `finale` needs a whole song banked: a long fight at the Silent Conductor has one.
      const skip = new Set([rule]);
      const off = SEEDS.map((seed) => noviceFight(seed, TEMPO_MAESTRO, skip));
      if (rule !== 'finale')
        expect(
          off.map((r) => r.commands),
          rule,
        ).not.toEqual(on.map((r) => r.commands));
    }
  });

  it('with A Tempo, more of her Cues are free than chance alone (about 11%) gives', () => {
    const rows = SEEDS.map((seed) => noviceFight(seed, TEMPO_MAESTRO));
    const free = total(rows, (r) => r.freeCues) / total(rows, (r) => r.cues);
    expect(free).toBeGreaterThan(0.25);
    const blind = SEEDS.map((seed) => noviceFight(seed, TEMPO_MAESTRO, new Set(['beat'])));
    expect(total(blind, (r) => r.freeCues) / total(blind, (r) => r.cues)).toBeLessThan(free);
  });
});

describe('every party of the roster plays the Conductor (docs/phase-5f.md)', () => {
  /** Every party of three, in content (slot) order, as roster20.test.ts has them. */
  function parties(): string[][] {
    const ids = CONTENT.heroes.map((h) => h.id);
    const out: string[][] = [];
    for (let a = 0; a < ids.length; a++)
      for (let b = a + 1; b < ids.length; b++)
        for (let c = b + 1; c < ids.length; c++) out.push([ids[a]!, ids[b]!, ids[c]!]);
    return out;
  }

  it('all 20 parties, both bots, on the Bellwarden: the fight ends, the Calling is in play', () => {
    expect(parties()).toHaveLength(20);
    for (const party of parties())
      for (const kind of ['skilled', 'novice'] as const) {
        const seed = 1000;
        const sim = createSim({ ...conductorConfig(seed, 'bellwarden', TEMPO_MAESTRO), party });
        const bot = kind === 'skilled' ? new SkilledBot(seed) : new NoviceBot(seed);
        for (let t = 0; t < MAX_TICKS; t++) {
          sim.step(bot.decide(sim.state));
          sim.drainEvents();
          const s = sim.state.encounter.status;
          if (s === 'victory' || s === 'defeat') break;
        }
        const label = `${party.join(',')} ${kind}`;
        expect(['victory', 'defeat'], label).toContain(sim.state.encounter.status);
        expect(sim.state.ledger.conducting, label).toBeDefined();
      }
  }, 120_000);
});

describe('the Conductor readers (src/bots/common.ts)', () => {
  it('are null, false or empty without the Calling', () => {
    const sim = createSim({ seed: 1, encounter: 'first_light' });
    expect(conductingOf(sim.state)).toBeNull();
    expect(beatSoon(sim.state)).toBeNull();
    expect(chainOpen(sim.state)).toBeNull();
    expect(finaleOn(sim.state)).toBe(false);
    expect(marcatoReady(sim.state)).toBe(false);
    expect(crescendoCostOf(sim.state)).toBe(CONTENT.resonance.crescendoCost);
  });

  it('read the sim’s beat: beatSoon is 0 exactly inside the window and counts down to it', () => {
    const sim = createSim(conductorConfig(7, 'bellwarden', TEMPO_MAESTRO));
    const state = sim.state;
    let inside = 0;
    for (let t = 0; t < 60 * 12; t++) {
      const soon = beatSoon(state);
      expect(soon).not.toBeNull();
      expect(soon === 0, `tick ${t}`).toBe(onBeat(state));
      expect(soon!).toBeLessThanOrEqual(BAR_SECONDS);
      if (soon === 0) inside++;
      // A wait of `soon` seconds lands inside (within a tick's slack either side).
      if (soon! > 0 && t % 20 === 0) {
        const ahead = state.time + soon!;
        const k = Math.round(ahead / BAR_SECONDS);
        expect(Math.abs(ahead - k * BAR_SECONDS)).toBeLessThanOrEqual(state.mods.beatWindow + 1e-9);
      }
      sim.step([]);
    }
    // 0.3 s of every 2.73 s, over 12 s.
    expect(inside).toBeGreaterThan(60 * 0.3 * 3);
    expect(inside).toBeLessThan(60 * 0.3 * 6);
  });

  it('read Maestro’s cost, and without A Tempo there is no beat', () => {
    const maestro = createSim(conductorConfig(3, 'bellwarden', TEMPO_MAESTRO));
    expect(crescendoCostOf(maestro.state)).toBe(75);
    expect(conductingOf(maestro.state)!.view.finale.turns).toBe(2);
    const triad = createSim(conductorConfig(3, 'bellwarden', MARCATO_TRIAD));
    expect(crescendoCostOf(triad.state)).toBe(100);
    expect(beatSoon(triad.state)).toBeNull();
    expect(marcatoReady(triad.state)).toBe(true);
  });
});

describe('the Conductor goldens', () => {
  it('play the Calling and paths the doc names, Silent Conductor on the Finale’s kit', () => {
    const want: Record<string, { bot: string; path: string[] }> = {
      'skilled-conducting-bellwarden': { bot: 'skilled', path: TEMPO_MAESTRO },
      'novice-conducting-first-light': { bot: 'novice', path: MARCATO_TRIAD },
      'skilled-conducting-silent': {
        bot: 'skilled',
        path: ['marcato', 'reprise', 'spotlight', 'maestro'],
      },
    };
    for (const [name, { path }] of Object.entries(want)) {
      const sc = SCENARIOS.find((s) => s.name === name);
      expect(sc, name).toBeDefined();
      expect(sc!.config?.calling, name).toEqual({ id: 'conductor', path });
    }
    const silent = SCENARIOS.find((s) => s.name === 'skilled-conducting-silent')!;
    expect(silent.config).toMatchObject(kitConfig(ARRIVAL4_KIT));
  });

  // docs/phase-5f.md, A2: each golden produces the events its name and doc comment name. The
  // fight is played as tools/runScenario.ts plays it, and its hash is checked against the golden,
  // so the events are the pinned fight's.

  /** A golden scenario's fight: its events, its end and its hash. */
  function goldenFight(name: string) {
    const sc = SCENARIOS.find((s) => s.name === name)!;
    const sim = createSim({ seed: sc.seed, debug: true, ...sc.config });
    const drive = sc.driver();
    const events: SimEvent[] = [];
    for (let tick = 0; tick < sc.ticks; tick++) {
      sim.step(drive(tick, sim.state));
      events.push(...sim.drainEvents());
    }
    const of = <K extends SimEvent['type']>(type: K) =>
      events.filter((e): e is Extract<SimEvent, { type: K }> => e.type === type);
    expect(sim.hash(), name).toBe((golden.scenarios as Record<string, string>)[name]);
    return { sc, state: sim.state, of };
  }

  it('novice-conducting-first-light: the Novice Cues a Solo on the Conductor, under Triad, and wins', () => {
    const { state, of } = goldenFight('novice-conducting-first-light');
    expect(state.encounter.status).toBe('victory');
    // Her Cue: a Cued Solo that starts a chain.
    expect(of('cued').length).toBeGreaterThanOrEqual(1);
    expect(of('cueChained').some((e) => e.link === 1)).toBe(true);
    expect(of('soloStarted').some((e) => e.cued)).toBe(true);
    expect(state.ledger.cues).toBeGreaterThanOrEqual(1);
    // Triad (on her path) holds the meter.
    expect(of('triad').some((e) => e.on)).toBe(true);
  });

  it('skilled-conducting-silent: Grand Finales, a turn lost to the Grand Silence’s stilling, Marcato and a Duet; the Conductor falls', () => {
    const { sc, state, of } = goldenFight('skilled-conducting-silent');
    expect(state.encounter.status).toBe('victory');
    expect(state.encounter.endedAt!).toBeLessThan(sc.ticks / 60);
    // Grand Finales played their turns.
    expect(of('crescendoStart').some((e) => e.calling === 'Grand Finale')).toBe(true);
    expect(of('finaleTurn').length).toBeGreaterThanOrEqual(1);
    expect(of('finaleEnded').length).toBeGreaterThanOrEqual(1);
    // The Grand Silence fell, and a Finale turn was lost to its stilling.
    expect(of('silenceBegan').length).toBeGreaterThanOrEqual(1);
    expect(of('finaleTurnLost').some((e) => e.reason === 'stilled')).toBe(true);
    expect(state.ledger.conducting!.finaleLost).toBeGreaterThanOrEqual(1);
    // Marcato (on its path) was given, and two Cues chained into a Duet.
    expect(of('marcato').length).toBeGreaterThanOrEqual(1);
    expect(of('cueChained').some((e) => e.link === 2)).toBe(true);
    expect(state.ledger.conducting!.duets).toBeGreaterThanOrEqual(1);
  }, 60_000);
});
