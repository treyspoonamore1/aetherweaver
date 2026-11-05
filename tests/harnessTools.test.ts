import { describe, expect, it } from 'vitest';
import {
  BrannWatch,
  MAX_PHASES,
  playEncounter,
  playRun,
  VERB_TALLY3_KEYS,
  VerbTally,
} from '../tools/harness-core';
import { ExtraWatch } from '../tools/brann-bands';
import { decreeFight } from '../tools/decrees';
import { callingArg, techniquesArg, verbConfig, verbFight } from '../tools/verbs';
import { SkilledBot } from '../src/bots/skilled';
import { makeBot, type Bot } from '../src/bots';
import { band, NAMED_PARTIES, parseArgs, partyArg, runBand } from '../tools/harness';
import { ARRIVAL3_KIT, ARRIVAL_KIT, defaultKit, kitConfig } from '../tools/kits';
import { SCENARIO_HOUND_PACK } from '../tools/scenarios';
import { CONTENT } from '../src/content';
import * as Run from '../src/meta/run';
import type { RunState } from '../src/meta/types';
import { createSim, type SimEvent } from '../src/sim';
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

  it('plays a I-III Expedition to the Unweaver, its minutes in 3 Movements, well inside MAX_PHASES', () => {
    let phases = 0;
    const run = playRun(SEED, 'skilled', undefined, { movements: 3, onPhase: () => phases++ });
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
    // Seed 16838 (1000 + 2 × 7919; 72271 before W9's tuning): an Unpick cuts and the Seamstress
    // falls before its 1 s lock runs out, so no re-thread was possible. It once read as a
    // failure (Skilled's Unpicking 93% over 30 seeds, where every Unpick it could judge was
    // answered).
    const f = decreeFight('the_seamstress', 16838, 'skilled');
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
    // with the default party and techniques every row read 'no change (not met here)'.
    const holds = (setup: Parameters<typeof verbConfig>[3]) => {
      const seed = 1000;
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
    const on = verbFight('maw_hollow', 1000, new Set(), 3, brann);
    const off = verbFight('maw_hollow', 1000, new Set(['mawHold']), 3, brann);
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
