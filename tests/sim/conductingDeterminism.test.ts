/**
 * Phase 5f W1: the Conductor is deterministic and additive (docs/phase-5f.md, "Engineering ground
 * rules"). A Conductor fight run twice agrees on its hash and every event, and its replay
 * survives a JSON round-trip; without the Conductor no new hashed key exists (absent, not
 * undefined), the view carries no `conducting`, and `NO_MODS` keeps every existing value.
 */
import { describe, expect, it } from 'vitest';
import { makeBot } from '../../src/bots';
import { CONTENT } from '../../src/content';
import { createSim, type SimConfig, type SimEvent, type WorldState } from '../../src/sim';
import { FILL_NO_MODS, NO_MODS, resolveMods } from '../../src/sim/mods';
import { parseReplay, runReplay } from '../../src/sim/replay';
import { resolveConfig } from '../../src/sim/world';
import { runScenario } from '../../tools/runScenario';
import type { Scenario } from '../../tools/scenarios';

/** Every path option, one per tier, across the two setups W4's harness plays. */
const PATHS = [
  ['marcato', 'reprise', 'ensemble', 'triad'],
  ['a_tempo', 'upbeat', 'spotlight', 'maestro'],
] as const;

const GUARDIAN = [
  { auras: ['fortissimo'], ornaments: [] },
  { auras: ['sostenuto'], ornaments: [] },
];

function scenario(path: readonly string[], seed: number, extra: Omit<SimConfig, 'seed'> = {}) {
  return {
    name: `conducting-${path.join('-')}-${seed}`,
    seed,
    ticks: 60 * 40,
    config: {
      // Debug, for the opening's full Solos and meter (the replay records the commands).
      debug: true,
      encounter: 'bellwarden',
      chords: GUARDIAN,
      calling: { id: 'conductor', path: [...path] },
      ...extra,
    },
    driver: () => {
      const bot = makeBot('skilled', seed);
      return (tick: number, state: WorldState) => {
        const out = bot.decide(state);
        // Once the fight is on, everything is ready: the bot Cues and Crescendos at once.
        if (tick === 60 * 8 || tick === 60 * 20)
          out.push(
            { t: 'debug', op: { op: 'chargeSolos' } },
            { t: 'debug', op: { op: 'setResonance', value: 100 } },
          );
        if (tick === 60 * 20 + 1) out.push({ t: 'crescendo' });
        return out;
      };
    },
  } satisfies Scenario;
}

function play(s: Scenario, ticks: number): { hash: string; events: SimEvent[] } {
  const sim = createSim({ seed: s.seed, ...s.config });
  const drive = s.driver();
  const events: SimEvent[] = [];
  for (let t = 0; t < ticks; t++) {
    sim.step(drive(t, sim.state));
    events.push(...sim.drainEvents());
  }
  return { hash: sim.hash(), events };
}

/** The key paths anywhere under `value` named `conducting` or `cuePower`. */
function newKeys(value: unknown, at: string, out: string[], seen: Set<unknown>): void {
  if (value === null || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (k === 'conducting' || k === 'cuePower') out.push(`${at}.${k}`);
    if (typeof v !== 'function') newKeys(v, `${at}.${k}`, out, seen);
  }
}

function hashedNewKeys(state: WorldState): string[] {
  const out: string[] = [];
  const seen = new Set<unknown>();
  const s = state as unknown as Record<string, unknown>;
  for (const k of ['field', 'ledger', 'internal', 'telegraphs', 'chimes', 'relics', 'encounter'])
    newKeys(s[k], k, out, seen);
  for (const e of state.entities.list()) newKeys(e, `entity${e.id}`, out, seen);
  return out;
}

describe('a Conductor fight is deterministic', () => {
  for (const [i, path] of PATHS.entries()) {
    it(`twice gives the same hash and events, and its replay round-trips (${path.join(', ')})`, () => {
      const s = scenario(path, 900 + i);
      const a = play(s, 60 * 30);
      const b = play(s, 60 * 30);
      expect(b.hash).toBe(a.hash);
      expect(b.events).toEqual(a.events);
      // The Calling's rules were at work.
      expect(a.events.some((e) => e.type === 'cueChained')).toBe(true);
      expect(a.events.some((e) => e.type === 'finaleTurn')).toBe(true);
      const { replay, hash } = runScenario(s);
      const loaded = parseReplay(JSON.parse(JSON.stringify(replay)));
      const result = runReplay(loaded);
      expect(result.matches).toBe(true);
      expect(result.hash).toBe(hash);
    }, 60_000);
  }

  it('its state carries the Conductor’s hashed keys', () => {
    const sim = createSim({ seed: 3, ...scenario(PATHS[0], 3).config });
    sim.step([]);
    expect(hashedNewKeys(sim.state)).toEqual(['field.conducting', 'ledger.conducting']);
  });
});

describe('without the Conductor, nothing new (absent, not undefined)', () => {
  const OTHERS: (SimConfig['calling'] | undefined)[] = [
    undefined,
    { id: 'luminary', path: ['haloed', 'dawnward', 'third_voice', 'eclipse'] },
    { id: 'martyr', path: ['penitence'] },
    { id: 'chronomancer', path: ['quickened', 'echo_ward', 'temporal_mastery', 'paradox'] },
  ];

  for (const calling of OTHERS) {
    it(`${calling?.id ?? 'no Calling'}: no conducting or cuePower key in a fight`, () => {
      const seed = 21;
      const sim = createSim({
        seed,
        encounter: 'bellwarden',
        chords: GUARDIAN,
        ...(calling ? { calling } : {}),
      });
      const bot = makeBot('skilled', seed);
      const found: string[] = [];
      for (let t = 0; t < 60 * 30; t++) {
        sim.step(bot.decide(sim.state));
        for (const e of sim.drainEvents())
          if (e.type === 'damageTaken' && 'conducted' in e) found.push(`event ${e.tick}`);
        if (t % 60 === 59) found.push(...hashedNewKeys(sim.state));
      }
      expect(found).toEqual([]);
      expect(sim.state.field).not.toHaveProperty('conducting');
      expect(sim.state.ledger).not.toHaveProperty('conducting');
      if (sim.state.calling) {
        expect(sim.state.calling).not.toHaveProperty('conducting');
        expect(sim.state.calling.crescendo).not.toBe('finale');
      }
    }, 60_000);
  }

  it('a Conductor hit at power 1 carries no cuePower', () => {
    const sim = createSim({
      seed: 5,
      encounter: 'bellwarden',
      chords: GUARDIAN,
      calling: { id: 'conductor', path: [] },
    });
    const bot = makeBot('skilled', 5);
    for (let t = 0; t < 60 * 20; t++) {
      sim.step(bot.decide(sim.state));
      sim.drainEvents();
      const w = sim.state as unknown as { internal: { pendingHits: Record<string, unknown>[] } };
      for (const h of w.internal.pendingHits) if ('cuePower' in h) expect(h.cuePower).not.toBe(1);
    }
  });
});

describe('the mods', () => {
  /** NO_MODS before Phase 5f, as committed (src/sim/mods.ts at 2b34c39). */
  const BEFORE = JSON.parse(
    '{"enemySpeedMult":1,"enemyLifeMult":1,"dissonanceWindupMult":1,"dissonanceRadiusMult":1,"heroHealMult":1,"cueCostBonus":0,"restlessPct":0,"vanguardElites":0,"vanguardAffixes":0,"relayHealPct":0,"threadRangeBonus":0,"lifelineMult":1,"tautReleasePct":0,"empowerMult":1,"wardBarrierMult":1,"wardDurationBonus":0,"perfectWindowBonus":0,"ripostePower":0,"wardCharges":1,"chimeRadiusMult":1,"reelCooldownCut":0,"fieldRadiusMult":1,"spiritRegenMult":1,"sostenutoMult":1,"ostinatoRefillCut":0,"allegroBonus":0,"hammerfallChance":0,"heavyEyelidsSleep":0,"bulwarksEchoPct":0,"lyraAttackSpeed":0,"starboltCastMult":1,"resonanceMult":1,"soloChargeMult":1,"canon":0,"encoreBonus":0,"daCapo":0,"mendMult":1,"thimbleBarrierPct":0,"thimbleCooldown":0,"thimbleDuration":0,"lanternBarrierPct":0,"lanternDuration":0,"glideCooldownMult":1,"noGlide":false,"muteDamageMult":1,"partyDamageMult":1,"perfectSoloCharge":0,"perfectHealPct":0,"cuedSoloDurationMult":1,"chimeCooldownMult":1,"chimeHealMult":1,"martyrsVeil":false,"startResonance":0,"prismRadius":0,"prismPotency":0,"metronomeCooldown":0,"beamEcho":null,"startSolos":false,"spiritMult":1,"radiancePerAura":0,"sunriseRadianceMult":1,"fieldSongRadiusMult":1,"haloedReduction":0,"dawnwardPct":0,"dawnwardCooldown":0,"dawnwardDuration":0,"plantedEffectMult":1,"sovereignMult":1,"sovereignMinAuras":0,"eclipseVulnerability":0,"crescendoRadiusMult":null,"lifeMult":1,"lifeReserve":false,"bearShare":0,"borneTaken":1,"vowDuration":0,"vowRedirect":0,"vowHealMult":1,"penitencePer100":0,"bearDamageTaken":1,"bloodFontPct":0,"bloodFontBelow":0,"sharedWounds":0,"undyingInvulnerable":0,"undyingMendPct":0,"vigilBelow":0,"vigilMult":1,"aegisWardMult":1,"aegisSelf":false,"covenantPct":0,"rewindSeconds":0,"rewindCooldown":0,"stasisDuration":0,"stasisCostMult":1,"techCooldownMult":1,"foresight":0,"echoWardDelay":0,"echoWardPct":0,"borrowedTimeSolo":0,"masteryCooldown":0,"slowDanceSpeed":0,"slowDanceWindup":0,"paradox":false,"stasisPerfectResonance":0,"telegraphTimers":false,"auraEffectMult":1,"unsuppressible":false,"auraPerExtra":0,"beamFocusMult":1,"reserveMult":1,"lifeReserveMult":1,"techCostMult":1,"techniquesCostLife":false,"lifeCapPct":1,"wardCooldownCut":0,"wardHitCap":0,"wardDurationMult":1,"staggerMult":1,"perfectResonance":0,"graceShieldPct":0,"graceShieldDuration":0,"mendLowBonus":0,"mendLowBelow":0,"mendWarded":0,"empowerLinger":0,"heroLifeMult":1,"inFieldDamage":0,"wardedDamage":0,"closeRanks":0,"closeRanksRadius":0,"bleedOutMult":1,"reviveSpeedMult":1,"reviveHpPct":null,"reviveInvulnerable":0,"responseBonus":0,"bloodTithe":0,"bloodTitheRefund":0,"bloodAndSilk":0,"enGarde":0,"verdantChoir":0,"guardStrand":0,"cutLockMult":1,"cutResonance":0,"chimeCooldownCut":0,"stillwaterBell":0,"stillwaterRefund":0,"sacrificialLamb":0}',
  ) as Record<string, unknown>;

  /** The Conductor's mods and the defaults that do nothing. */
  const NEW = {
    cueCostBase: null,
    chainWindow: 0,
    duetPower: 1,
    trioPower: 1,
    cueKeepsWhole: false,
    finaleTurns: 0,
    finaleRamp: 1,
    finaleGap: 0,
    finaleWait: 0,
    crescendoCostBase: null,
    marcatoPct: 0,
    marcatoSeconds: 0,
    marcatoCooldown: 0,
    beatWindow: 0,
    repriseCharge: 0,
    ensemblePct: 0,
    ensembleMax: 0,
    spotlightMult: 0,
    triadCount: 0,
  };

  it('NO_MODS keeps every existing value, and the new ones do nothing', () => {
    // Phase 5g's fields (docs/phase-5g.md) follow, each at a default that does nothing.
    expect(NO_MODS).toEqual({ ...BEFORE, ...NEW, ...FILL_NO_MODS });
  });

  it('no other Calling, relic, motif or tree sets a Conductor mod', () => {
    for (const calling of CONTENT.callings.filter((c) => c.id !== 'conductor')) {
      const path = calling.tiers.map((t) => t.options[0]!.id);
      const m = resolveMods(
        resolveConfig({
          seed: 1,
          calling: { id: calling.id, path },
          motifs: CONTENT.motifs.map((d) => ({ id: d.id, level: 1 })).slice(0, 6),
          relics: ['cantors_hymnal', 'choirmasters_baton'],
        }),
        CONTENT,
      );
      for (const [k, v] of Object.entries(NEW))
        expect((m as unknown as Record<string, unknown>)[k], `${calling.id} ${k}`).toEqual(v);
    }
  });

  it('the Conductor’s passive and each option set theirs', () => {
    const mods = (path: string[]) =>
      resolveMods(resolveConfig({ seed: 1, calling: { id: 'conductor', path } }), CONTENT);
    const base = mods([]);
    expect(base).toMatchObject({
      cueCostBase: 15,
      chainWindow: 3,
      duetPower: 1.25,
      trioPower: 1.5,
      cueKeepsWhole: true,
      finaleTurns: 1,
      finaleRamp: 1.2,
      finaleGap: 1,
      finaleWait: 12,
      crescendoCostBase: null,
    });
    expect(base.resonanceMult).toBeCloseTo(1.2, 12);
    expect(mods(['marcato'])).toMatchObject({ marcatoSeconds: 4, marcatoCooldown: 8 });
    expect(mods(['marcato']).marcatoPct).toBeCloseTo(0.1, 12);
    expect(mods(['a_tempo']).beatWindow).toBe(0.15);
    expect(mods(['reprise']).repriseCharge).toBe(30);
    expect(mods(['upbeat']).startResonance).toBe(50);
    expect(mods(['ensemble']).ensemblePct).toBeCloseTo(0.05, 12);
    expect(mods(['ensemble']).ensembleMax).toBeCloseTo(0.15, 12);
    expect(mods(['spotlight']).spotlightMult).toBe(2);
    expect(mods(['triad']).triadCount).toBe(3);
    expect(mods(['maestro'])).toMatchObject({ crescendoCostBase: 75, finaleTurns: 2 });
    // Standing Ovation III and the passive multiply.
    const both = resolveMods(
      resolveConfig({
        seed: 1,
        calling: { id: 'conductor', path: [] },
        motifs: [{ id: 'standing_ovation', level: 3 }],
      }),
      CONTENT,
    );
    expect(both.resonanceMult).toBeCloseTo(1.44, 12);
  });
});
