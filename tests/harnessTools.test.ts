import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  BrannWatch,
  calibratedThreat,
  FINALE_SEED_SETS,
  FinaleWatch,
  MAX_PHASES,
  movementEncounters,
  movementName,
  onEverySet,
  playEncounter,
  playRun,
  SOLO_ANSWERS,
  VERB_TALLY3_KEYS,
  VERB_TALLY4_KEYS,
  VerbTally,
} from '../tools/harness-core';
import { ExtraWatch } from '../tools/brann-bands';
import { callingBand } from '../tools/callings';
import { BOSS_TABLES, decreeFight } from '../tools/decrees';
import {
  EXPEDITION_BOTS,
  EXPEDITION_SEEDS,
  expeditionRun,
  keptExpeditionBaseline,
  projectRun,
} from '../tools/expedition-baseline';
import {
  m1Baseline,
  m2Baseline,
  m3Baseline,
  projectBaseline,
  type M1Baseline,
} from '../tools/m1-baseline';
import { CHOIR_VOICES, SCENARIO_CONDUCTOR_PEAK, SCENARIO_GRAND_SILENCE } from '../tools/sim-bench';
import { callingArg, rulesFor, techniquesArg, verbConfig, verbFight } from '../tools/verbs';
import { NOVICE_M4_RULES } from '../src/bots/novice';
import { FINALE_RULES, M3_RULES, SkilledBot } from '../src/bots/skilled';
import { makeBot, type Bot } from '../src/bots';
import { band, NAMED_PARTIES, parseArgs, partyArg, runBand } from '../tools/harness';
import {
  ARRIVAL3_KIT,
  ARRIVAL4_KIT,
  ARRIVAL_KIT,
  defaultKit,
  kitConfig,
  kitFor,
} from '../tools/kits';
import { SCENARIO_HOUND_PACK } from '../tools/scenarios';
import { CONTENT } from '../src/content';
import {
  ALTO,
  BASS,
  BASSO_OSTINATO,
  CONDUCTOR,
  FORTISSIMO,
  LAMENT,
  SOPRANO,
  TENOR,
} from '../src/content/crucibleIds';
import * as Run from '../src/meta/run';
import { THREAT_PER_ROW } from '../src/meta/economy';
import type { RunState } from '../src/meta/types';
import { createSim, type Sim, type SimEvent } from '../src/sim';
import { sandbox, worldOf } from './sim/helpers';

/**
 * A Blood Pact staged on Kael and Lyra (slots 0 and 1), 6 m wide, landing in `windup` seconds;
 * their positions pinned side by side, or `apart` far out of its reach, every tick; `ward`
 * gives both a plain Ward barrier up front.
 */
function pact(opts: { apart?: boolean; ward?: boolean }) {
  const sim = sandbox();
  const w = worldOf(sim);
  const [a, b] = [w.entities.get(w.party[0]!)!, w.entities.get(w.party[1]!)!];
  for (const e of [a, b])
    e.health!.statuses.push({ id: 'pact', remaining: 30, duration: 30, stacks: 1, source: null });
  const windup = 1;
  if (opts.ward)
    for (const e of [a, b])
      e.health!.shields.push({
        kind: 'ward',
        amount: 500,
        max: 500,
        appliedAt: w.time,
        expiresAt: w.time + 30,
        fromWeaver: true,
        fromAura: false,
      });
  w.telegraphs.push({
    id: 990,
    owner: w.weaverId,
    target: null,
    attackId: 'hemomancer_blood_pact',
    name: 'Blood Pact',
    kind: 'link',
    shape: { kind: 'link', a: a.id, b: b.id, r: 6 },
    start: w.time,
    impact: w.time + windup,
    perfectFrom: w.time + windup - 0.35,
    damage: 120,
    pctMaxHp: 0,
    effect: 'damage',
    answers: ['scatter'],
    severity: 'normal',
    linkStatus: 'pact',
  });
  // The tally learns the Pact from its telegraphStarted, as in a fight.
  const tally = new VerbTally();
  tally.tick(sim, [
    {
      type: 'telegraphStarted',
      tick: sim.tick,
      telegraph: 990,
      owner: w.weaverId,
      target: null,
      name: 'Blood Pact',
      impact: w.time + windup,
      perfectFrom: w.time + windup - 0.35,
      severity: 'normal',
    } as unknown as SimEvent,
  ]);
  const seen: SimEvent[] = [];
  for (let t = 0; t < Math.ceil(windup * 60) + 5; t++) {
    Object.assign(a, { x: 0, z: 0 });
    Object.assign(b, { x: opts.apart ? 20 : 2, z: 0 });
    sim.step([]);
    const events = sim.drainEvents();
    seen.push(...events);
    tally.tick(sim, events);
  }
  const outcomes = seen
    .filter((e) => e.type === 'telegraphResolved' && e.telegraph === 990)
    .map((e) => (e.type === 'telegraphResolved' ? e.outcome : null));
  return { tally, outcomes };
}

describe('the harness tallies (tools/harness-core.ts)', () => {
  it('counts a Blood Pact that blasts the pair, however it was met', () => {
    const hit = pact({});
    expect(hit.outcomes).toContain('hit');
    expect(hit.tally.pactBlasts).toBe(1);
    // Both Warded early (no Perfect): neither share is a hit, and it still blasted.
    const warded = pact({ ward: true });
    expect(warded.outcomes.length).toBe(2);
    expect(warded.outcomes).not.toContain('hit');
    expect(warded.outcomes).not.toContain('dodged');
    expect(warded.tally.pactBlasts).toBe(1);
  });

  it('does not count a Blood Pact the pair Scattered out of', () => {
    const split = pact({ apart: true });
    expect(split.outcomes).toEqual(['dodged']);
    expect(split.tally.pactBlasts).toBe(0);
  });

  it('counts a Pact met only by a Ward as a blast (warded/absorbed/perfect outcomes)', () => {
    for (const outcome of ['warded', 'absorbed', 'perfect'] as const) {
      const sim = sandbox();
      const w = worldOf(sim);
      w.telegraphs.push({
        id: 991,
        owner: w.weaverId,
        target: null,
        attackId: 'hemomancer_blood_pact',
        name: 'Blood Pact',
        kind: 'link',
        shape: { kind: 'link', a: w.party[0]!, b: w.party[1]!, r: 6 },
        start: w.time,
        impact: w.time + 6,
        perfectFrom: w.time + 5.65,
        damage: 120,
        pctMaxHp: 0,
        effect: 'damage',
        answers: ['scatter'],
        severity: 'normal',
        linkStatus: 'pact',
      });
      const tally = new VerbTally();
      tally.tick(sim, [{ type: 'telegraphStarted', telegraph: 991 } as unknown as SimEvent]);
      tally.tick(sim, [
        {
          type: 'telegraphResolved',
          tick: 0,
          telegraph: 991,
          target: w.party[0]!,
          outcome,
          damage: 0,
        },
      ]);
      expect(tally.pactBlasts, outcome).toBe(1);
    }
  });
});

describe('the bench scenarios (tools/scenarios.ts)', () => {
  it('the hound pack lets its debug hounds loose, whoever builds its sim', () => {
    expect(SCENARIO_HOUND_PACK.config?.debug).toBe(true);
    // Built straight from its own config (not through runScenario's debug default).
    const sim = createSim({ seed: SCENARIO_HOUND_PACK.seed, ...SCENARIO_HOUND_PACK.config });
    const drive = SCENARIO_HOUND_PACK.driver();
    let most = 0;
    for (let t = 0; t < 1200; t++) {
      sim.step(drive(t, sim.state));
      sim.drainEvents();
      const hounds = sim.state.entities
        .list()
        .filter((e) => e.enemy?.defId === 'sanguine_hound' && !e.health?.dead).length;
      most = Math.max(most, hounds);
    }
    expect(most).toBeGreaterThanOrEqual(6);
  });
});

describe('whole runs (playRun)', () => {
  it('plays an Expedition into Movement II, and a Prelude stays in Movement I', () => {
    const expedition = playRun(1, 'skilled', undefined, { movements: 2 });
    expect(expedition.movementReached).toBe(2);
    expect(expedition.minutesByMovement.length).toBe(2);
    expect(expedition.minutesByMovement[1]!).toBeGreaterThan(0);
    const prelude = playRun(1, 'skilled');
    expect(prelude.movementReached).toBe(1);
    expect(prelude.minutesByMovement.length).toBe(1);
    // Two whole runs: about 3 s alone, past vitest's 5 s default on a loaded machine.
  }, 60_000);
});

// ── Movement III (docs/phase-5c.md, "Harness") ───────────────────────────────────────

describe('whole runs through Movement III (playRun)', () => {
  /** Skilled seed 2000 wins its I-II Expedition (tools/expedition-baseline.ts's first run). */
  const SEED = 2000;
  /**
   * The harness's second run seed, whose Skilled I-III Expedition reaches the Unweaver (seed
   * 2000's falls at `frayed_threshold` since its hand-off fix, docs/phase-5c.md).
   */
  const UNWEAVER_SEED = SEED + 104729;

  it('plays a I-III Expedition to the Unweaver, its minutes in 3 Movements, well inside MAX_PHASES', () => {
    let phases = 0;
    const run = playRun(UNWEAVER_SEED, 'skilled', undefined, {
      movements: 3,
      onPhase: () => phases++,
    });
    expect(run.movementReached).toBe(3);
    expect(run.minutesByMovement.length).toBe(3);
    expect(run.minutesByMovement[2]!).toBeGreaterThan(0);
    expect(run.lastEncounter).toBe('the_unweaver');
    // About 85-95 phases for three Movements: the 240 cap has room to spare (docs/phase-5c.md).
    expect(phases).toBeGreaterThan(60);
    expect(phases).toBeLessThan(MAX_PHASES / 2);
  }, 120_000);

  it('reaches Movement III exactly where the I-II run won: the same results through Vharun', () => {
    for (const bot of ['skilled', 'novice'] as const)
      for (const seed of [SEED, SEED + 104729]) {
        let two: RunState | null = null;
        let three: RunState | null = null;
        const r2 = playRun(seed, bot, undefined, { movements: 2, onEnd: (r) => (two = r) });
        const r3 = playRun(seed, bot, undefined, { movements: 3, onEnd: (r) => (three = r) });
        const a = (two as RunState | null)!.results;
        const b = (three as RunState | null)!.results;
        if (r2.outcome !== 'victory') {
          // A lost I-II run is lost the same way on the longer route.
          expect(r3.outcome, `${bot} ${seed}`).toBe('defeat');
          expect(r3.lastEncounter, `${bot} ${seed}`).toBe(r2.lastEncounter);
          expect(b, `${bot} ${seed}`).toEqual(a);
          continue;
        }
        expect(r3.movementReached, `${bot} ${seed}`).toBe(3);
        expect(b.slice(0, a.length - 1), `${bot} ${seed}`).toEqual(a.slice(0, -1));
        // Vharun's own result: the same fight, only its reward and the run's end differ.
        const strip = ({ xp, aether, starlight, wonRun, ...rest }: (typeof a)[number]) => {
          void xp;
          void aether;
          void starlight;
          void wonRun;
          return rest;
        };
        expect(strip(b[a.length - 1]!), `${bot} ${seed}`).toEqual(strip(a.at(-1)!));
        expect(a.at(-1)!.wonRun).toBe(true);
        expect(b[a.length - 1]!.wonRun).toBe(false);
      }
  }, 240_000);

  it('resumes a run recorded at its arrival in Movement III as a real arrival (opts.start)', () => {
    let start: RunState | null = null;
    const full = playRun(SEED, 'skilled', undefined, {
      movements: 3,
      onPhase: (_phase, run) => {
        if (!start && Run.movementOf(run) === 3) start = run;
      },
    });
    expect(start).not.toBeNull();
    const resumed = playRun(SEED, 'skilled', undefined, { start: start! });
    expect(resumed.outcome).toBe(full.outcome);
    expect(resumed.lastEncounter).toBe(full.lastEncounter);
    expect(resumed.fights).toBe(full.fights);
    expect(resumed.minutesByMovement.length).toBe(3);
    expect(resumed.minutesByMovement[2]!).toBeCloseTo(full.minutesByMovement[2]!, 9);
  }, 120_000);
});

describe('the Movement III verbs (VerbTally3)', () => {
  it('tallies only a Movement III fight, with its keys in order', () => {
    const m2 = playEncounter(
      { seed: 1000, encounter: 'crimson_gate', ...kitConfig(ARRIVAL_KIT) },
      'skilled',
    );
    expect('m3' in m2).toBe(false);
    const kit3 = kitConfig(ARRIVAL3_KIT);
    const run = playEncounter({ seed: 1000, encounter: 'frayed_threshold', ...kit3 }, 'skilled');
    expect(Object.keys(run.m3!)).toEqual([...VERB_TALLY3_KEYS]);
    expect(Object.keys(run.m3!.threadCuts)).toEqual(['shears', 'severing', 'snip', 'unpick']);
    expect(Object.keys(run.m3!.cutResults)).toEqual(['cut', 'held', 'strand', 'none']);
    expect(Object.keys(run.m3!.mimicCopies)).toEqual(['empower', 'ward', 'chime']);
    // The Shears dash on the opening: every dash gets its verdict.
    const verdicts = Object.values(run.m3!.cutResults).reduce((s, n) => s + n, 0);
    expect(verdicts).toBeGreaterThan(0);
    expect(run.m3!.spindleUptime).toBeNull();
  }, 60_000);

  it('reads the Unweaver: Snip cuts, Spindles, a stolen verse', () => {
    const run = playEncounter(
      { seed: 1000, encounter: 'the_unweaver', ...kitConfig(ARRIVAL3_KIT) },
      'skilled',
    );
    const m3 = run.m3!;
    expect(m3.cutResults.cut + m3.cutResults.held + m3.cutResults.strand).toBeGreaterThan(0);
    expect(m3.spindleUptime).not.toBeNull();
    expect(m3.spindleUptime!).toBeGreaterThan(0);
    expect(m3.spindleUptime!).toBeLessThan(1);
  }, 60_000);

  it('keeps a possessed hero’s blows on an ally out of the share and the party’s damage', () => {
    const sim = sandbox();
    const w = worldOf(sim);
    const kael = w.entities.get(w.party[0]!)!;
    const lyra = w.entities.get(w.party[1]!)!;
    Object.assign(kael, { x: 0, z: 0 });
    Object.assign(lyra, { x: 2, z: 0 });
    kael.health!.statuses.push({
      id: 'possessed',
      remaining: 3,
      duration: 3,
      stacks: 1,
      source: null,
      tickIn: 0.5,
    });
    const before = lyra.health!.hp;
    for (let t = 0; t < 120; t++) {
      Object.assign(kael, { x: 0, z: 0 });
      Object.assign(lyra, { x: 2, z: 0 });
      sim.step([]);
      sim.drainEvents();
    }
    // Lyra took Kael's blows; none of it is the party's damage, so the share can't count it.
    expect(lyra.health!.hp).toBeLessThan(before);
    expect(sim.state.ledger.partyDamage).toBe(0);
  });
});

describe('the harness’s Movement III tables', () => {
  it('plays Movement III’s cells on ARRIVAL3_KIT, and prints their bands', () => {
    expect(defaultKit(1)).toBe('bare');
    expect(defaultKit(2)).toBe('arrival');
    expect(defaultKit(3)).toBe('arrival3');
    expect(parseArgs(['--movement', '3']).kit).toBe(ARRIVAL3_KIT);
    // ARRIVAL3_KIT is the arrival kit and more: 10 motifs, 6 relics.
    expect(ARRIVAL3_KIT.motifs.slice(0, ARRIVAL_KIT.motifs.length)).toEqual(ARRIVAL_KIT.motifs);
    expect(ARRIVAL3_KIT.motifs.length).toBe(10);
    expect(ARRIVAL3_KIT.relics.length).toBe(6);
    for (const m of ARRIVAL3_KIT.motifs)
      expect(
        CONTENT.motifs.some((d) => d.id === m.id),
        m.id,
      ).toBe(true);
    for (const r of ARRIVAL3_KIT.relics)
      expect(
        CONTENT.relics.some((d) => d.id === r),
        r,
      ).toBe(true);
    // Movement II's rows exactly as before; Movement III's its own.
    expect(band('crimson_gate', 'skilled')).toBe('≥85% · share ≥35% · 35-60 s');
    expect(band('vharun', 'novice')).toBe('35-65%');
    expect(band('frayed_threshold', 'skilled')).toBe('≥85% · share ≥35% · 40-65 s');
    expect(band('the_unweaver', 'skilled')).toBe('≥80% · share ≥30% · 180-280 s');
    expect(band('the_seamstress', 'novice')).toBe('30-60%');
    expect(band('the_unweaver', 'skilled', NAMED_PARTIES.B)).toContain('default − 15');
    expect(band('the_unweaver', 'skilled', NAMED_PARTIES.A)).toContain('default − 5');
    expect(runBand(2, 'skilled')).toBe('');
    expect(runBand(3, 'skilled')).toContain('won ÷ reached III');
  });
});

describe('the Decree gate (tools/decrees.ts)', () => {
  it('judges the Unpick’s re-thread: its lock comes from the snap reported before its verdict', () => {
    // resolveCut reports the Unpick's threadSnapped (with its lock) before its cutResolved: the
    // gate once read the lock onto the previous Unpick, so every cut was judged 'no cut'.
    const f = decreeFight('the_seamstress', 1000, 'skilled');
    const cuts = f.unpicks!.filter((u) => u.lockEnd !== null);
    expect(cuts.length).toBeGreaterThan(0);
    for (const u of cuts) expect(u.lockEnd!).toBeGreaterThan(u.at);
    const judged = f.unpicks!.filter(
      (u) => !u.downed && (u.lockEnd === null || u.rethreaded || (u.open === true && f.won)),
    );
    expect(f.answered.Unpicking).toBe(judged.length);
    expect(f.occurrences.Unpicking).toBe(f.unpicks!.length);
    // A Weaver who never threads again after the first cut fails the Unpicks that cut.
    // (Seed 8919 since W9's tuning: at 1000 the lazy Weaver's cut Unpicks all came with a down.)
    const skilled = makeBot('skilled', 8919);
    let cut = false;
    const lazy: Bot = {
      name: 'lazy',
      decide(state) {
        if ((state.entities.get(state.weaverId)?.weaver?.threadLock ?? 0) > 0) cut = true;
        const out = skilled.decide(state);
        return cut ? out.filter((c) => c.t !== 'thread') : out;
      },
    };
    const g = decreeFight('the_seamstress', 8919, 'skilled', lazy);
    expect(g.unpicks!.some((u) => u.lockEnd !== null && !u.rethreaded)).toBe(true);
    expect(g.answered.Unpicking).toBeLessThan(g.occurrences.Unpicking!);
  }, 60_000);

  it('judges an Unpick the win leaves inside its lock on the fight, not as a missed re-thread', () => {
    // Seed 64352 (1000 + 8 × 7919; 72271, then 16838, before W9's tuning rounds): an Unpick
    // cuts and the Seamstress falls before its 1 s lock runs out, so no re-thread was possible.
    // It once read as a failure (Skilled's Unpicking 93% over 30 seeds, where every Unpick it
    // could judge was answered).
    const f = decreeFight('the_seamstress', 64352, 'skilled');
    expect(f.won).toBe(true);
    const open = f.unpicks!.filter((u) => u.open);
    expect(open.length).toBeGreaterThan(0);
    for (const u of open) {
      expect(u.lockEnd).not.toBeNull();
      expect(u.rethreaded).toBe(false);
    }
    expect(f.answered.Unpicking).toBe(f.unpicks!.filter((u) => !u.downed).length);
  }, 60_000);
});

describe('verb ablation (tools/verbs.ts)', () => {
  it('sets fights up with a party, technique variants and a Calling, and only when asked', () => {
    const plain = verbConfig('maw_hollow', 7, 3);
    expect('party' in plain || 'techniques' in plain || 'calling' in plain).toBe(false);
    const set = verbConfig('maw_hollow', 7, 3, {
      party: NAMED_PARTIES.A!,
      techniques: techniquesArg('swap,chorale'),
      calling: callingArg('chronomancer', '1'),
    });
    expect(set.party).toEqual(['kael', 'vexis', 'brann']);
    expect(set.techniques).toEqual({ reel: 'swap', ward: 'chorale' });
    const chrono = CONTENT.callings.find((c) => c.id === 'chronomancer')!;
    expect(set.calling).toEqual({
      id: 'chronomancer',
      path: chrono.tiers.map((t, i) => t.options[i === 0 ? 1 : 0]!.id),
    });
    expect(techniquesArg(undefined)).toBeUndefined();
    expect(callingArg(undefined, '1')).toBeUndefined();
    expect(() => techniquesArg('nope')).toThrow(/Unknown technique variant/);
    expect(() => techniquesArg('swap,anchor')).toThrow(/Two variants for reel/);
    expect(() => callingArg('nope', undefined)).toThrow();
  });

  it('meets the mawHold rule on a Brann party with Swap, never on the default setup', () => {
    // mawHold fires only for a Bloodlusting Brann whom no plain Reel takes out of an Inhale:
    // with the default party and techniques every row read 'no change (not met here)'. Seed
    // 80190 (1000 + 10 × 7919) meets it on the tuned waves.
    const seed = 80190;
    const holds = (setup: Parameters<typeof verbConfig>[3]) => {
      const sim = createSim(verbConfig('maw_hollow', seed, 3, setup));
      const bot = new SkilledBot(seed, { every: 4, attention: 1, callReaction: 0.4 });
      let n = 0;
      for (let t = 0; t < 9 * 60 * 60; t++) {
        const out = bot.decide(sim.state);
        n += out.filter((c) => c.t === 'directive' && c.kind === 'hold').length;
        sim.step(out);
        sim.drainEvents();
        const s = sim.state.encounter.status;
        if (s === 'victory' || s === 'defeat') break;
      }
      return n;
    };
    const brann = { party: NAMED_PARTIES.A!, techniques: techniquesArg('swap') };
    expect(holds({})).toBe(0);
    expect(holds(brann)).toBeGreaterThan(0);
    // verbFight plays the same setup.
    const on = verbFight('maw_hollow', seed, new Set(), 3, brann);
    const off = verbFight('maw_hollow', seed, new Set(['mawHold']), 3, brann);
    expect(off).not.toEqual(on);
  }, 60_000);
});

// ── The roster (docs/phase-5b.md, "Bots and harness") ────────────────────────────────

const BRANN_TALLY_KEYS = [
  'lowShare40',
  'lowShare30',
  'dealtLow60',
  'rageBonus',
  'downs',
  'weaverHealOn',
  'wardsOn',
  'perfectsOn',
  'lifesteal',
  'lifestealShare',
  'silkResonance',
  'deathless',
  'refusedRallies',
  'rallies',
];

describe('the harness and a roster party', () => {
  it('reads --party as A, B or C, or 3 distinct known heroes, in content order', () => {
    expect(partyArg(undefined)).toBeNull();
    expect(partyArg('A')).toEqual(['kael', 'vexis', 'brann']);
    expect(partyArg('b')).toEqual(['lyra', 'vexis', 'brann']);
    expect(partyArg('C')).toEqual(['kael', 'lyra', 'brann']);
    expect(partyArg('brann,vexis,kael')).toEqual(['kael', 'vexis', 'brann']);
    expect(() => partyArg('kael,vexis')).toThrow();
    expect(() => partyArg('kael,kael,brann')).toThrow();
    expect(() => partyArg('kael,vexis,seren')).toThrow();
    // The config gains a party only when one is asked for.
    expect(parseArgs([]).party).toBeNull();
    expect(parseArgs(['--party', 'kael,lyra,brann']).party).toEqual(['kael', 'lyra', 'brann']);
    expect(parseArgs(['--party', 'B', '--compare']).compare).toBe(true);
  });

  it('prints Brann’s cells for his parties, and the default bands otherwise', () => {
    expect(band('first_light', 'skilled')).toBe('');
    expect(band('first_light', 'skilled', NAMED_PARTIES.A)).toContain('Brann below 40%');
    expect(band('vharun', 'skilled', NAMED_PARTIES.B)).toContain('default − 15');
    expect(band('vharun', 'skilled', NAMED_PARTIES.C)).toContain('Execution on Brann');
    expect(band('crimson_gate', 'skilled')).toBe(band('crimson_gate', 'skilled', null));
  });

  it('tallies Brann only when he is in the party', () => {
    const config = { seed: 1000, encounter: 'crimson_gate', ...kitConfig(ARRIVAL_KIT) };
    const plain = playEncounter(config, 'skilled');
    expect('brann' in plain).toBe(false);
    const run = playEncounter({ ...config, party: ['kael', 'vexis', 'brann'] }, 'skilled');
    expect(Object.keys(run.brann!)).toEqual(BRANN_TALLY_KEYS);
    expect(run.brann!.lifesteal).toBeGreaterThan(0);
    expect(run.brann!.lifestealShare).toBeGreaterThan(0);
    expect(run.brann!.lifestealShare).toBeLessThanOrEqual(1);
    expect(run.brann!.lowShare30).toBeLessThanOrEqual(run.brann!.lowShare40);
    // Blood Rage as he dealt it: a share, and a bonus within Blood Rage's cap (0.8).
    expect(run.brann!.dealtLow60).toBeGreaterThanOrEqual(0);
    expect(run.brann!.dealtLow60).toBeLessThanOrEqual(1);
    expect(run.brann!.rageBonus).toBeGreaterThan(0);
    expect(run.brann!.rageBonus).toBeLessThanOrEqual(0.8);
  });

  it('plays a whole run with a party set in Prep, and records the Harmony only for Brann', () => {
    const plain = playRun(1, 'skilled');
    expect('harmony' in plain).toBe(false);
    let party: string[] = [];
    const brann = playRun(1, 'skilled', undefined, {
      party: ['brann', 'kael', 'vexis'],
      onEnd: (run) => (party = run.party.map((h) => h.heroId)),
    });
    // Canonical order, as Prep sets it.
    expect(party).toEqual(['kael', 'vexis', 'brann']);
    expect(brann.harmony).toBeDefined();
    expect(Object.keys(brann.harmony!)).toEqual([
      'silkOffered',
      'silkOfferedEligible',
      'prereqsOwned',
    ]);
    expect(brann.harmony!.silkOfferedEligible).toBeLessThanOrEqual(brann.harmony!.silkOffered);
    expect(() => playRun(1, 'skilled', undefined, { party: ['kael', 'brann'] })).toThrow();
  });
});

describe('the harness and a roster party: the Phase 5b review fixes', () => {
  /** Party B with Blood and Silk, Brann at 25%, Empower-Threaded; Resonance held at `held`. */
  function silk(held: number | null): number {
    const sim = sandbox({
      party: ['lyra', 'vexis', 'brann'],
      motifs: [{ id: 'blood_and_silk', level: 1 }],
    });
    const w = worldOf(sim);
    const slot = w.party.findIndex((id) => w.entities.get(id)!.hero!.blood !== undefined);
    const b = w.entities.get(w.party[slot]!)!;
    const wc = w.entities.get(w.weaverId)!.weaver!;
    if (held !== null) wc.resonance = held;
    const watch = BrannWatch.of(sim)!;
    for (let t = 0; t < 120; t++) {
      b.health!.hp = b.health!.maxHp * 0.25;
      if (held !== null) wc.resonance = held;
      const commands =
        t === 0
          ? [
              { t: 'thread' as const, slot: slot as 0 | 1 | 2 },
              ...(wc.threadMode === 'empower' ? [] : [{ t: 'mode' as const }]),
            ]
          : [];
      sim.step(commands);
      watch.tick(sim, sim.drainEvents());
    }
    expect(wc.threadMode).toBe('empower');
    return watch.result(sim).silkResonance;
  }

  it('caps Blood and Silk’s tallied Resonance at the bar’s max, as the sim does', () => {
    // An empty bar fills at 3 a second over the 2 s.
    expect(silk(0)).toBeGreaterThan(4);
    // A full bar takes nothing, so nothing is tallied.
    expect(silk(CONTENT.resonance.max)).toBe(0);
    // Nearly full: no more than the room left each tick.
    expect(silk(CONTENT.resonance.max - 0.01)).toBeLessThanOrEqual(0.01 * 120 + 1e-9);
  });

  it('records Blood and Silk offered only once both its prerequisites are owned', () => {
    // Seed 15, party B, an Expedition: the one run in 120 (A, B, C × seeds 1-40) to own both.
    const run = playRun(15, 'skilled', undefined, {
      party: ['lyra', 'vexis', 'brann'],
      movements: 2,
    });
    expect(run.harmony!.prereqsOwned).toBe(true);
    expect(run.harmony!.silkOffered).toBeGreaterThan(0);
    expect(run.harmony!.silkOffered).toBe(run.harmony!.silkOfferedEligible);
  });
});

describe('the Bands tool (tools/brann-bands.ts)', () => {
  it('a watch on a fight only reads: the fight plays the same with or without one', () => {
    const config = {
      seed: 1000,
      encounter: 'crimson_gate',
      party: ['kael', 'vexis', 'brann'],
      ...kitConfig(ARRIVAL_KIT),
    };
    const plain = playEncounter(config, 'skilled');
    const watch = new ExtraWatch();
    const watched = playEncounter(config, 'skilled', watch.watch);
    expect(watched).toStrictEqual(plain);
    // The Weaver's support it read lands on the party's heroes, Brann among them.
    expect(Object.keys(watch.x.weaverHeal).every((h) => config.party.includes(h))).toBe(true);
    expect(watch.x.weaverShield.brann ?? 0).toBeGreaterThan(0);
  });

  it('counts a Twin Cleave down on Brann though his allyDowned comes before the resolution', () => {
    // A staged tick: the second blow downs Brann; the sim emits allyDowned ahead of the
    // telegraphResolved that names him, so the down is read off his state after the tick.
    const brann = { id: 3, hero: { defId: 'brann' }, health: { downed: false } };
    const state = {
      time: 1,
      party: [3],
      weaverId: 9,
      telegraphs: [{ id: 7, attackId: 'vharun_twin_cleave_second' }],
      encounter: { bossId: null },
      entities: { get: (id: number) => (id === 3 ? brann : undefined) },
    };
    const sim = { state } as unknown as Parameters<ExtraWatch['watch']>[0];
    const watch = new ExtraWatch();
    watch.watch(sim, [{ type: 'telegraphStarted', tick: 0, telegraph: 7 } as SimEvent]);
    brann.health.downed = true;
    state.time = 2;
    watch.watch(sim, [
      { type: 'allyDowned', tick: 60, hero: 3 } as SimEvent,
      {
        type: 'telegraphResolved',
        tick: 60,
        telegraph: 7,
        target: 3,
        outcome: 'hit',
        damage: 850,
      } as SimEvent,
    ]);
    expect(watch.x.twinDownedBrann).toBe(1);
    expect(watch.x.twinFirstOnBrann).toBe(0);
  });
});

// ── The Finale (docs/phase-5d.md, "Harness") ─────────────────────────────────────────

describe('the Finale route (playRun --movements 4)', () => {
  /** Skilled seed 2000's Finale-route Expedition reaches the Silent Conductor. */
  const SEED = 2000;

  it('reaches the Conductor, its minutes in 4 Movements, well inside MAX_PHASES', () => {
    let phases = 0;
    const run = playRun(SEED, 'skilled', undefined, {
      movements: 4,
      onPhase: () => phases++,
    });
    expect(run.movementReached).toBe(4);
    expect(run.minutesByMovement.length).toBe(4);
    expect(run.minutesByMovement[3]!).toBeGreaterThan(0);
    expect(run.lastEncounter).toBe(CONDUCTOR);
    // Its shorter road (6 + 6 + 6 + 1 rows) takes fewer phases than the 3-Movement route.
    expect(phases).toBeGreaterThan(50);
    expect(phases).toBeLessThan(MAX_PHASES / 2);
  }, 120_000);

  it('leaves the I-II and I-III Expeditions as their baselines hold them', () => {
    for (const movements of [2, 3]) {
      const kept = keptExpeditionBaseline(movements);
      // The first Skilled run of each (the Novice's are pinned in expedition2Pin and
      // movement3Handoff).
      const i = EXPEDITION_BOTS.indexOf('skilled') * EXPEDITION_SEEDS;
      const fresh = expeditionRun('skilled', 0, movements);
      expect(projectRun(fresh, kept.runs[i]), `I-${movements}`).toEqual(kept.runs[i]);
    }
  }, 120_000);
});

describe('THREAT_PER_ROW calibration (playRun)', () => {
  it('reads the Threat row each fight plays: the Finale road’s, not its row on the road', () => {
    for (const movements of [1, 2, 3, 4]) {
      for (const seed of [1, 2000]) {
        const run = Run.newRun(seed, undefined, [], [], [], [], undefined, movements);
        let fights = 0;
        for (const node of run.map.rows.flat()) {
          if (node.reward.threat === 1 && !node.encounterId) continue;
          fights++;
          // At the game's own rate the calibration plays the game's own curve, row for row.
          expect(
            Math.round(calibratedThreat(run, node.id, THREAT_PER_ROW) * 1000) / 1000,
            `${movements} Movements, seed ${seed}, ${node.id}`,
          ).toBe(node.reward.threat);
        }
        expect(fights).toBeGreaterThan(0);
      }
    }
    // The Finale road's Bellwarden (road row 3) plays Movement I's row 7: ×1.30 at 0.05, not ×1.10.
    const run = Run.newRun(1, undefined, [], [], [], [], undefined, 4);
    const bell = run.map.rows.flat().find((n) => n.movement === 1 && n.kind === 'miniboss')!;
    expect(calibratedThreat(run, bell.id, 0.05)).toBeCloseTo(1.3, 9);
  });
});

describe('the harness’s Finale tables', () => {
  it('plays the Finale’s cell on ARRIVAL4_KIT, and prints its bands', () => {
    expect(defaultKit(3)).toBe('arrival3');
    expect(defaultKit(4)).toBe('arrival4');
    expect(defaultKit(5)).toBe('arrival4');
    expect(kitFor(4)).toBe(ARRIVAL4_KIT);
    expect(parseArgs(['--movement', '4']).kit).toBe(ARRIVAL4_KIT);
    expect(movementEncounters(4)).toEqual([CONDUCTOR]);
    // ARRIVAL4_KIT is ARRIVAL3_KIT and more: 12 motifs, 8 relics, every one in content.
    expect(ARRIVAL4_KIT.motifs.slice(0, ARRIVAL3_KIT.motifs.length)).toEqual(ARRIVAL3_KIT.motifs);
    expect(ARRIVAL4_KIT.relics.slice(0, ARRIVAL3_KIT.relics.length)).toEqual(ARRIVAL3_KIT.relics);
    expect(ARRIVAL4_KIT.motifs.length).toBe(12);
    expect(ARRIVAL4_KIT.relics.length).toBe(8);
    for (const m of ARRIVAL4_KIT.motifs)
      expect(
        CONTENT.motifs.some((d) => d.id === m.id),
        m.id,
      ).toBe(true);
    for (const r of ARRIVAL4_KIT.relics)
      expect(
        CONTENT.relics.some((d) => d.id === r),
        r,
      ).toBe(true);
    // ARRIVAL3_KIT as it was: 10 motifs and 6 relics.
    expect(ARRIVAL3_KIT.motifs.length).toBe(10);
    expect(ARRIVAL3_KIT.relics.length).toBe(6);
    expect(band(CONDUCTOR, 'skilled')).toBe('≥80% · share ≥30% · 170-230 s');
    expect(band(CONDUCTOR, 'novice')).toBe('15-40%');
    expect(band(CONDUCTOR, 'idle')).toBe('0%');
    expect(band(CONDUCTOR, 'skilled', NAMED_PARTIES.B)).toBe('≥ default − 15 · share ≥30%');
    expect(band(CONDUCTOR, 'skilled', NAMED_PARTIES.A)).toContain('≤280 s');
    // Movement III's bands unchanged.
    expect(band('the_unweaver', 'skilled')).toBe('≥80% · share ≥30% · 180-280 s');
    expect(runBand(3, 'skilled')).toBe('won ≥60% · won ÷ reached III ≥75%');
    expect(runBand(4, 'skilled')).toContain('won ÷ reached the Finale ≥80%');
    expect(runBand(4, 'novice')).toContain('won ÷ reached the Finale 15-40%');
    expect(movementName(3)).toBe('III');
    expect(movementName(4)).toBe('The Finale');
    expect(movementName(4, true)).toBe('the Finale');
    expect(callingBand(3)).toBe('Skilled ≥75% at the Unweaver, each');
    expect(callingBand(4)).toContain('the Silent Conductor');
    expect(rulesFor(3)).toBe(M3_RULES);
    expect(rulesFor(4)).toBe(FINALE_RULES);
    expect(rulesFor(4, 'novice')).toBe(NOVICE_M4_RULES);
    expect(rulesFor(3, 'novice')).toEqual([]);
    expect(BOSS_TABLES.the_silent_conductor!.kit).toBe(ARRIVAL4_KIT);
  });
});

describe('the Finale verbs (FinaleWatch)', () => {
  const kit4 = kitConfig(ARRIVAL4_KIT);

  it('tallies only the Conductor’s fight, with its keys in order', () => {
    const m3 = playEncounter(
      { seed: 1000, encounter: 'frayed_threshold', ...kitConfig(ARRIVAL3_KIT) },
      'skilled',
    );
    expect('finale' in m3).toBe(false);
    const run = playEncounter({ seed: 1000, encounter: CONDUCTOR, ...kit4 }, 'skilled');
    const f = run.finale!;
    expect(Object.keys(f)).toEqual([...VERB_TALLY4_KEYS]);
    // VerbTally3 stays `fightMovement >= 3`, so the Finale's row carries `m3` too.
    expect(run.m3).toBeDefined();
    expect(Object.keys(f.discordFed)).toEqual(['boss', 'solo']);
    expect(Object.keys(f.solosBegun)).toEqual([ALTO, BASS, TENOR, SOPRANO]);
    expect(Object.keys(f.notes)).toEqual(['perfect', 'clutch', 'reel', 'rewind']);
    expect(Object.keys(f.cuesAnswered)).toEqual([...SOLO_ANSWERS]);
    // Real casts: Cues, and every Solo begun is a Cue's (at most one each).
    const begun = Object.values(f.solosBegun).reduce((a, b) => a + b, 0);
    expect(f.cues).toBeGreaterThan(0);
    expect(begun).toBeGreaterThan(0);
    expect(begun + f.cuesFailed).toBeLessThanOrEqual(f.cues);
    const answered = Object.values(f.cuesAnswered).reduce((a, b) => a + b, 0);
    expect(answered).toBeLessThanOrEqual(begun);
    expect(f.cuesInterrupted).toBe(f.cuesAnswered.interrupted);
    expect(f.survived).toBeLessThanOrEqual(f.fortissimoCast);
  }, 60_000);

  it('reads the Grand Silence: its time, notes and end', () => {
    // The Skilled bot can answer every silence blow (no harm while stilled); the Novice can't.
    for (const kind of ['skilled', 'novice'] as const) silenceRead(kind);
  }, 60_000);

  function silenceRead(kind: 'skilled' | 'novice'): void {
    const seed = 9595;
    const sim = createSim({ seed, encounter: CONDUCTOR, debug: true, ...kit4 });
    const player = makeBot(kind, seed);
    const watch = FinaleWatch.of(sim)!;
    expect(watch).not.toBeNull();
    let notes = 0;
    let phased = false;
    for (let t = 0; t < 60 * 120; t++) {
      const out = player.decide(sim.state);
      if (!phased && sim.state.encounter.bossId !== null) {
        out.push({ t: 'debug', op: { op: 'setBossHp', pct: 0.26 } });
        phased = true;
      }
      sim.step(out);
      const events = sim.drainEvents();
      notes += events.filter((e) => e.type === 'silenceNote').length;
      watch.tick(sim, events);
      const s = sim.state.encounter.status;
      if (s === 'victory' || s === 'defeat') break;
    }
    const f = watch.result();
    expect(f.silenceTime).toBeGreaterThan(5);
    expect(Object.values(f.notes).reduce((a, b) => a + b, 0)).toBe(notes);
    // It ended one way or the other (or the party fell in it), never both.
    expect(f.reignited && f.silenceBroken).toBe(false);
    if (f.reignited) expect(f.timeToReignite).not.toBeNull();
    else expect(f.timeToReignite).toBeNull();
    if (kind === 'novice') expect(f.damageWhileStilled).toBeGreaterThan(0);
    else expect(f.damageWhileStilled).toBeGreaterThanOrEqual(0);
  }

  it('judges each Solo: fed Discord, interrupted, full-meter damage, a Perfect', () => {
    const real = createSim({ seed: 1, encounter: CONDUCTOR, ...kit4 });
    const watch = FinaleWatch.of(real)!;
    const kael = { hero: { defId: 'kael' }, health: { statuses: [] as { id: string }[] } };
    const state = {
      time: 0,
      party: [1],
      telegraphs: [] as { id: number; attackId: string }[],
      field: { finale: { discord: { value: 50, rate: 0.5 } } },
      entities: { get: (id: number) => (id === 1 ? kael : undefined) },
    };
    const sim = { state } as unknown as Sim;
    const step = (events: unknown[]) => {
      state.time += 1;
      watch.tick(sim, events as SimEvent[]);
    };
    // A Cue on the Bass (entity 20), and its Basso Ostinato (telegraph 7) begins.
    state.telegraphs = [{ id: 7, attackId: BASSO_OSTINATO }];
    step([
      { type: 'enemyCued', tick: 0, boss: 9, soloist: 20, solo: BASSO_OSTINATO },
      { type: 'telegraphStarted', tick: 0, telegraph: 7, owner: 20, target: 1 },
    ]);
    // It lands unanswered and feeds Discord: failed.
    state.telegraphs = [];
    step([
      { type: 'telegraphResolved', tick: 1, telegraph: 7, target: 1, outcome: 'hit', damage: 300 },
      { type: 'discordRose', tick: 1, boss: 9, telegraph: 7, amount: 20, value: 70 },
    ]);
    // A Lament (8) on the Alto (21), interrupted by Kael.
    state.telegraphs = [{ id: 8, attackId: LAMENT }];
    step([{ type: 'telegraphStarted', tick: 2, telegraph: 8, owner: 21, target: 1 }]);
    state.telegraphs = [];
    step([
      {
        type: 'telegraphResolved',
        tick: 3,
        telegraph: 8,
        target: null,
        outcome: 'cancelled',
        damage: 0,
      },
      { type: 'castInterrupted', tick: 3, enemy: 21, by: 1, name: 'Lament' },
    ]);
    // Two more on a full meter: one costs Kael life with nothing absorbed (failed, though no
    // Discord could rise), one is a Perfect.
    state.field.finale.discord.value = 100;
    state.telegraphs = [{ id: 10, attackId: BASSO_OSTINATO }];
    step([{ type: 'telegraphStarted', tick: 4, telegraph: 10, owner: 20, target: 1 }]);
    state.telegraphs = [{ id: 11, attackId: BASSO_OSTINATO }];
    step([
      { type: 'telegraphResolved', tick: 5, telegraph: 10, target: 1, outcome: 'hit', damage: 400 },
      {
        type: 'damageTaken',
        tick: 5,
        target: 1,
        source: 20,
        amount: 400,
        absorbed: 0,
        telegraph: 10,
      },
      { type: 'telegraphStarted', tick: 5, telegraph: 11, owner: 22, target: 1 },
    ]);
    state.telegraphs = [];
    step([
      {
        type: 'telegraphResolved',
        tick: 6,
        telegraph: 11,
        target: 1,
        outcome: 'perfect',
        damage: 0,
      },
    ]);
    const f = watch.result();
    expect(f.cues).toBe(1);
    expect(f.cuesFailed).toBe(0);
    expect(f.solosBegun).toEqual({ [ALTO]: 1, [BASS]: 3, [TENOR]: 0, [SOPRANO]: 0 });
    expect(f.discordFed).toEqual({ boss: 0, solo: 20 });
    expect(f.cuesInterrupted).toBe(1);
    expect(f.cuesAnswered.interrupted).toBe(1);
    expect(f.cuesAnswered.perfect).toBe(1);
    expect(watch.solos.map((s) => s.answer)).toEqual([
      'failed',
      'interrupted',
      'failed',
      'perfect',
    ]);
  });

  it('counts a Cue whose Solo never began as failed', () => {
    const real = createSim({ seed: 1, encounter: CONDUCTOR, ...kit4 });
    const watch = FinaleWatch.of(real)!;
    const state = {
      time: 0,
      party: [] as number[],
      telegraphs: [] as unknown[],
      field: { finale: { cue: { boss: 9, soloist: 20, solo: LAMENT, until: 1 } } } as {
        finale: { cue?: unknown };
      },
      entities: { get: () => undefined },
    };
    const sim = { state } as unknown as Sim;
    watch.tick(sim, [
      { type: 'enemyCued', tick: 0, boss: 9, soloist: 20, solo: LAMENT } as SimEvent,
    ]);
    expect(watch.result().cuesFailed).toBe(0);
    delete state.field.finale.cue;
    state.time = 1;
    watch.tick(sim, []);
    expect(watch.result().cuesFailed).toBe(1);
  });

  it('does not fail a Cue cleared by a phase shift or its soloist’s death', () => {
    /** A Cue on the Bass (20), then `clearBy` on the tick its state goes (or the tick before). */
    const play = (clearBy: unknown[], before = false) => {
      const watch = FinaleWatch.of(createSim({ seed: 1, encounter: CONDUCTOR, ...kit4 }))!;
      const conductor = { enemy: { defId: CONDUCTOR } };
      const state = {
        time: 0,
        party: [] as number[],
        telegraphs: [] as unknown[],
        field: { finale: { cue: { boss: 9, soloist: 20, solo: BASSO_OSTINATO, until: 1 } } } as {
          finale: { cue?: unknown };
        },
        entities: { get: (id: number) => (id === 9 ? conductor : undefined) },
      };
      const sim = { state } as unknown as Sim;
      watch.tick(sim, [
        { type: 'enemyCued', tick: 0, boss: 9, soloist: 20, solo: BASSO_OSTINATO } as SimEvent,
      ]);
      state.time = 1;
      if (before) watch.tick(sim, clearBy as SimEvent[]);
      delete state.field.finale.cue;
      state.time = 2;
      watch.tick(sim, before ? [] : (clearBy as SimEvent[]));
      return watch.result().cuesFailed;
    };
    // Phase 3 shatters the choir: the waiting Cue goes with it, like a singing Solo.
    expect(play([{ type: 'phaseChanged', tick: 60, boss: 9, phase: 3 }])).toBe(0);
    // Phase 2 cancels the Cue's cast; its state goes a tick later.
    expect(play([{ type: 'phaseChanged', tick: 60, boss: 9, phase: 2 }], true)).toBe(0);
    // The party killed the soloist before its Solo began.
    expect(play([{ type: 'enemyKilled', tick: 60, enemy: 20, killer: 1 }])).toBe(0);
    // Another voice's death, or another boss's shift, excuses nothing.
    expect(play([{ type: 'enemyKilled', tick: 60, enemy: 21, killer: 1 }])).toBe(1);
    expect(play([{ type: 'phaseChanged', tick: 60, boss: 7, phase: 2 }])).toBe(1);
    // A loss still fails it.
    expect(play([{ type: 'encounterEnded', tick: 60, outcome: 'defeat' }])).toBe(1);
  });

  it('a real fight fails no Cue its soloist’s death or a phase shift cleared (Skilled, 1002)', () => {
    let cue: number | null = null;
    let excused = 0;
    let unsung = 0;
    const run = playEncounter(
      { seed: 1002, encounter: CONDUCTOR, ...kit4 },
      'skilled',
      (sim, events) => {
        for (const e of events) {
          if (e.type === 'enemyCued') cue = e.soloist;
          if (e.type === 'telegraphStarted' && e.owner === cue) cue = null;
          if (
            cue !== null &&
            (e.type === 'phaseChanged' || (e.type === 'enemyKilled' && e.enemy === cue))
          ) {
            excused++;
            cue = null;
          }
        }
        if (cue !== null && sim.state.field.finale?.cue?.soloist !== cue) {
          if (sim.state.encounter.status !== 'victory') unsung++;
          cue = null;
        }
      },
    );
    // Seed 1002's fight (a win) has Cues cleared by both; none of them counts as failed, and
    // only the Cues that landed on a voice that couldn't sing do.
    expect(run.outcome).toBe('victory');
    expect(excused).toBeGreaterThan(0);
    expect(unsung).toBeGreaterThan(0);
    expect(run.finale!.cuesFailed).toBe(unsung);
  }, 120_000);

  it('judges a Fortissimo Silence the fight ended inside on its downs', () => {
    const play = (downs: number) => {
      const watch = FinaleWatch.of(createSim({ seed: 1, encounter: CONDUCTOR, ...kit4 }))!;
      const state = {
        time: 0,
        party: [] as number[],
        telegraphs: [{ id: 5, attackId: FORTISSIMO[0] }],
        field: { finale: {} },
        entities: { get: () => undefined },
      };
      const sim = { state } as unknown as Sim;
      watch.tick(sim, [
        { type: 'telegraphStarted', tick: 0, telegraph: 5, owner: 9, target: null },
      ] as SimEvent[]);
      state.time = 1;
      watch.tick(
        sim,
        Array.from({ length: downs }, () => ({
          type: 'allyDowned',
          tick: 60,
          hero: 1,
        })) as SimEvent[],
      );
      return { tally: watch.result(), judged: watch.fortissimos };
    };
    // A wipe before its third pulse: failed, though no pulse 3 landed.
    const wiped = play(3);
    expect(wiped.tally.fortissimoCast).toBe(1);
    expect(wiped.tally.survived).toBe(0);
    expect(wiped.tally.fortissimoDowns).toBe(3);
    expect(wiped.judged).toEqual([{ at: 0, cancelled: false, downs: 3 }]);
    // Cut short with no one down (the boss fell): not judged.
    const cut = play(0);
    expect(cut.tally.fortissimoCast).toBe(1);
    expect(cut.judged).toEqual([]);
  });

  /**
   * A mock fight: the Conductor (entity 9) and a Lament (telegraph 8) on the Alto (21), cut off
   * on the next tick by `cutBy` (that tick's events, with the telegraph gone).
   */
  const cutSolo = (cutBy: unknown[], cued = false) => {
    const watch = FinaleWatch.of(createSim({ seed: 1, encounter: CONDUCTOR, ...kit4 }))!;
    const conductor = { enemy: { defId: CONDUCTOR } };
    const alto = { enemy: { defId: ALTO } };
    const state = {
      time: 0,
      party: [] as number[],
      telegraphs: [{ id: 8, attackId: LAMENT }] as { id: number; attackId: string }[],
      field: { finale: { discord: { value: 50, rate: 0.5 } } } as {
        finale?: { discord?: unknown; cue?: unknown };
      },
      entities: { get: (id: number) => (id === 9 ? conductor : id === 21 ? alto : undefined) },
    };
    const sim = { state } as unknown as Sim;
    watch.tick(sim, [
      { type: 'telegraphStarted', tick: 0, telegraph: 8, owner: 21, target: null },
    ] as SimEvent[]);
    if (cued) {
      // A second Cue, on the Bass (20), still waiting for its Solo.
      state.field.finale!.cue = { boss: 9, soloist: 20, solo: BASSO_OSTINATO, until: 9 };
      watch.tick(sim, [
        { type: 'enemyCued', tick: 1, boss: 9, soloist: 20, solo: BASSO_OSTINATO },
      ] as SimEvent[]);
    }
    state.time = 2;
    state.telegraphs = [];
    if (cutBy.some((e) => (e as SimEvent).type === 'encounterEnded')) delete state.field.finale;
    watch.tick(sim, [
      {
        type: 'telegraphResolved',
        tick: 2,
        telegraph: 8,
        target: null,
        outcome: 'cancelled',
        damage: 0,
      },
      ...cutBy,
    ] as SimEvent[]);
    return { verdicts: watch.solos.map((v) => v.answer), tally: watch.result() };
  };
  const nullInterrupt = { type: 'castInterrupted', tick: 2, enemy: 21, by: null, name: 'Lament' };

  it('judges a Solo interrupted by a hero’s stun (by nobody) as interrupted, not shattered', () => {
    const stunned = cutSolo([nullInterrupt]);
    expect(stunned.verdicts).toEqual(['interrupted']);
    expect(stunned.tally.cuesInterrupted).toBe(1);
    expect(stunned.tally.cuesAnswered.interrupted).toBe(1);
    expect(stunned.tally.cuesAnswered.shattered).toBe(0);
    // The choir shatters only as the Conductor enters phase 3, that same tick.
    const shattered = cutSolo([
      { type: 'phaseChanged', tick: 2, boss: 9, phase: 3 },
      nullInterrupt,
      { type: 'enemyKilled', tick: 2, enemy: 21, killer: null },
    ]);
    expect(shattered.verdicts).toEqual(['shattered']);
    expect(shattered.tally.cuesInterrupted).toBe(0);
    expect(shattered.tally.cuesAnswered.shattered).toBe(1);
    // Phase 2's entry shatters nothing.
    expect(
      cutSolo([{ type: 'phaseChanged', tick: 2, boss: 9, phase: 2 }, nullInterrupt]).verdicts,
    ).toEqual(['interrupted']);
  });

  it('fails a Solo the fight’s end cancels on a loss, and leaves it open on a win', () => {
    const lost = cutSolo([{ type: 'encounterEnded', tick: 2, outcome: 'defeat' }], true);
    expect(lost.verdicts).toEqual(['failed']);
    expect(Object.values(lost.tally.cuesAnswered).reduce((a, b) => a + b, 0)).toBe(0);
    // The Cue still waiting failed with it.
    expect(lost.tally.cuesFailed).toBe(1);
    const won = cutSolo([{ type: 'encounterEnded', tick: 2, outcome: 'victory' }], true);
    expect(won.verdicts).toEqual([]);
    expect(won.tally.cuesAnswered.cancelled).toBe(0);
    expect(won.tally.cuesFailed).toBe(0);
    // A cancel mid-fight (a Paradox Rewind's) is still 'cancelled'.
    expect(cutSolo([]).verdicts).toEqual(['cancelled']);
  });

  it('a real loss leaves no Solo judged cancelled by the fight’s end (Idle, seed 8919)', () => {
    const run = playEncounter({ seed: 8919, encounter: CONDUCTOR, ...kit4 }, 'idle');
    expect(run.outcome).toBe('defeat');
    const f = run.finale!;
    expect(f.cuesAnswered.cancelled).toBe(0);
    expect(f.cuesAnswered.shattered).toBe(0);
  }, 60_000);
});

describe('the Finale’s seed sets (tools/loadouts.ts --sets)', () => {
  it('names the doc’s three sets, and keeps what passed on every one', () => {
    expect(FINALE_SEED_SETS).toEqual([
      { cells: 1000, runs: 2000 },
      { cells: 500003, runs: 900007 },
      { cells: 777001, runs: 333003 },
    ]);
    expect(
      onEverySet([
        ['a', 'b', 'c'],
        ['c', 'a'],
        ['a', 'c', 'd'],
      ]),
    ).toEqual(['a', 'c']);
    expect(onEverySet([['a'], []])).toEqual([]);
    expect(onEverySet<string>([])).toEqual([]);
  });

  it('plays each set from its own seeds, cells and runs', () => {
    const root = fileURLToPath(new URL('..', import.meta.url));
    const run = (args: string[]) =>
      execFileSync(
        'npx',
        [
          'tsx',
          'tools/loadouts.ts',
          '--movement',
          '4',
          '--seeds',
          '1',
          '--bots',
          'skilled',
          '--loadouts',
          Run.CHORD_PRESETS[0]!.id,
          ...args,
        ],
        { cwd: root, encoding: 'utf8' },
      );
    const sets = run(['--sets']);
    expect(sets.match(/^## Set \d of 3: .*$/gm)).toEqual([
      '## Set 1 of 3: cells from 1000, runs from 2000',
      '## Set 2 of 3: cells from 500003, runs from 900007',
      '## Set 3 of 3: cells from 777001, runs from 333003',
    ]);
    expect(sets.match(/^### skilled$/gm)).toHaveLength(3);
    // One set by hand: the second set's table is the same cell as `--seed-base 500003`.
    const second = run(['--seed-base', '500003']);
    const row = (text: string) =>
      text.split('\n').filter((l) => l.startsWith(`| ${Run.CHORD_PRESETS[0]!.name}`));
    expect(row(sets)[1]).toBe(row(second)[0]);
  }, 120_000);
});

describe('the Finale’s Decree gate (tools/decrees.ts)', () => {
  it('judges the Conductor’s Decrees from real casts', () => {
    const f = decreeFight(CONDUCTOR, 1000, 'skilled');
    const table = BOSS_TABLES.the_silent_conductor!;
    expect(table.decrees).toEqual([
      'Lament',
      'Basso Ostinato',
      'Cadenza',
      'Shatter Aria',
      'Fortissimo Silence',
      'Grand Silence',
    ]);
    expect(Object.keys(f.casts!)).toEqual([...table.decrees]);
    // Every Solo begun is judged once (on the fight, if it was still winding up at the end).
    for (const d of ['Lament', 'Basso Ostinato', 'Cadenza', 'Shatter Aria'])
      expect(f.occurrences[d], d).toBe(f.casts![d]);
    expect(f.answered.Lament!).toBeLessThanOrEqual(f.occurrences.Lament!);
    expect(f.casts!.Lament! + f.casts!['Basso Ostinato']!).toBeGreaterThan(0);
    // Idle answers none of them: every one N/A.
    expect(table.idleNa).toEqual(table.decrees);
  }, 60_000);
});

describe('the bench’s Finale scenarios (tools/sim-bench.ts)', () => {
  it('conductor-peak reaches three voices and Fortissimo Silence; grand-silence stills the party', () => {
    for (const scenario of [SCENARIO_CONDUCTOR_PEAK, SCENARIO_GRAND_SILENCE]) {
      const sim = createSim({ seed: scenario.seed, ...scenario.config });
      const drive = scenario.driver();
      let voices = 0;
      const names = new Set<string>();
      for (let t = 0; t < scenario.ticks; t++) {
        sim.step(drive(t, sim.state));
        for (const e of sim.drainEvents()) {
          if (e.type === 'telegraphStarted') names.add(e.name);
          if (e.type === 'silenceBegan') names.add('silenceBegan');
        }
        const standing = sim.state.entities
          .list()
          .filter((e) => e.enemy && CHOIR_VOICES.has(e.enemy.defId) && !e.health?.dead).length;
        voices = Math.max(voices, standing);
      }
      if (scenario === SCENARIO_CONDUCTOR_PEAK) {
        expect(voices).toBeGreaterThanOrEqual(3);
        expect(names.has('Fortissimo Silence')).toBe(true);
      } else expect(names.has('silenceBegan')).toBe(true);
    }
  }, 120_000);
});

describe('the Movement baselines (tools/m1-baseline.ts --check)', () => {
  const kept = (n: number) =>
    JSON.parse(
      readFileSync(fileURLToPath(new URL(`../tools/m${n}-baseline.json`, import.meta.url)), 'utf8'),
    ) as M1Baseline;
  for (const [n, table] of [
    [1, m1Baseline],
    [2, m2Baseline],
    [3, m3Baseline],
  ] as const)
    it(`Movement ${n}'s table plays out byte-equal to tools/m${n}-baseline.json`, () => {
      const want = kept(n);
      const fresh = table();
      expect(fresh.rows.length).toBe(want.rows.length);
      expect(JSON.stringify(projectBaseline(fresh, want), null, 1)).toBe(
        JSON.stringify(want, null, 1),
      );
    }, 300_000);
});
