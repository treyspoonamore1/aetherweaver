import { describe, expect, it } from 'vitest';
import { playEncounter, playRun, VerbTally } from '../tools/harness-core';
import { band, NAMED_PARTIES, parseArgs, partyArg } from '../tools/harness';
import { ARRIVAL_KIT, kitConfig } from '../tools/kits';
import { SCENARIO_HOUND_PACK } from '../tools/scenarios';
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
  });
});

// ── The roster (docs/phase-5b.md, "Bots and harness") ────────────────────────────────

const BRANN_TALLY_KEYS = [
  'lowShare40',
  'lowShare30',
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
