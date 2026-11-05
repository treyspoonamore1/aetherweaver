/**
 * Phase 5a, Movement II's UI after integration (docs/phase-5a.md): the regressions for the fixes
 * once every workstream landed. The heal-cut hatch follows the sim's own pool rule, the Loom and
 * the Codex count Deeds alike, Prep's Route toggle keeps the Calling and Chords, an Expedition's
 * Cantor is not the run's end, a Movement II defeat enshrines from the Summary, a damage-over-time
 * death names its answer, the Map voices its Movement's biome, and the Sentinel hint waits for
 * its shield to block a blow.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { useProfile } from '../src/app/profileStore';
import { useRun } from '../src/app/runStore';
import { useSettings } from '../src/app/settings';
import { getAudio, type SynthDirector } from '../src/audio';
import { CONTENT } from '../src/content';
import {
  EVERYTHING,
  EXPEDITION_MOVEMENTS,
  MAX_RANK,
  newProfile,
  RANK_XP,
  type Profile,
} from '../src/meta/profile';
import * as Run from '../src/meta/run';
import { loadRun, saveRun } from '../src/meta/save';
import type { EncounterResult, RunState } from '../src/meta/types';
import { createSim } from '../src/sim';
import { healReceivedMult } from '../src/sim/combat/health';
import { ANSWER_HINTS, evaluateHints } from '../src/ui/hud/hints';
import { recordSeen } from '../src/ui/hud/sighting';
import {
  bossPhasesOf,
  buildHudSnapshot,
  GUARD_HINT_SECONDS,
  guardBlockedRecently,
} from '../src/ui/hudBridge';
import { useUi } from '../src/ui/store';
import { EMPTY_RELIQUARY, expeditionReliquaryRun, legionHud, victoryRun } from '../src/ui/lab/mock';
import { deedsTally, deedsView, type DeedsOpen } from '../src/ui/screens/deedsModel';
import { nextStep } from '../src/ui/screens/interlude';
import { stationViews } from '../src/ui/screens/loomModel';
import { mapBiome, voiceMapBiome } from '../src/ui/screens/mapBiome';
import { prepRoute } from '../src/ui/screens/prepRoute';
import { endsRun, fightXp } from '../src/ui/screens/rankText';
import { enshrineChoices, enshrineStage } from '../src/ui/screens/reliquaryModel';
import { deathAnswerLine } from '../src/ui/screens/resultText';
import { finalEncounter, mapMovement, movementRows, outcomeSub } from '../src/ui/screens/routeText';
import { fightStarlight, runStarlight } from '../src/ui/screens/starlightModel';
import { worldOf } from './sim/helpers';

beforeEach(() => {
  useSettings.getState().reset();
  useProfile.getState().resetProgress();
  useRun.getState().closeRun();
  useUi.setState({ callouts: [] });
});

const skipUnlocks = () => useSettings.getState().update((s) => ({ ...s, unlockAll: true }));

/** A real Expedition in Prep (Skip the unlocks opens the route). */
function expedition(seed: number): RunState {
  skipUnlocks();
  useRun.getState().newRun(seed, 'expedition');
  return useRun.getState().run!;
}

const cantorOf = (run: RunState) =>
  run.map.rows.flat().find((n) => n.encounterId === 'hollow_cantor')!;

describe('the heal-cut hatch follows the sim (inPool)', () => {
  it('a hero whose centre is outside the pool is cut, even with their body over its edge', () => {
    const sim = createSim({ seed: 7, encounter: 'vharun' });
    const w = worldOf(sim);
    for (let i = 0; i < 400 && w.encounter.bossId === null; i++) sim.step([]);
    const [kael, lyra] = w.party.map((id) => w.entities.get(id)!);
    // Kael's centre is just past the rim (within his radius of it): the sim halves his heals.
    const r = 3.6;
    const gap = r + kael!.radius * 0.5;
    w.field.sanctuary = {
      pools: [{ x: kael!.x - gap, z: kael!.z, r, vx: 0, vz: 0 }],
      healMult: 0.5,
      reformAt: 999,
    };
    expect(healReceivedMult(w, kael!)).toBe(0.5);
    const hud = buildHudSnapshot(sim.state, { seed: 7, hovered: null });
    expect(hud.party[0]!.healCut).toBe(0.5);
    // Inside by its centre: no cut, as the sim says.
    w.field.sanctuary.pools[0] = { x: lyra!.x, z: lyra!.z, r, vx: 0, vz: 0 };
    expect(healReceivedMult(w, lyra!)).toBe(1);
    expect(buildHudSnapshot(sim.state, { seed: 7, hovered: null }).party[1]!.healCut).toBe(
      undefined,
    );
    // Every frame agrees with the sim's own multiplier.
    const frames = buildHudSnapshot(sim.state, { seed: 7, hovered: null }).party;
    for (const f of frames) {
      const mult = healReceivedMult(w, w.entities.get(f.id)!);
      expect(f.healCut).toBe(mult < 1 ? mult : undefined);
    }
  });
});

describe('the Deeds count: the Loom and the Codex agree', () => {
  const open: DeedsOpen = { allowance: EVERYTHING, astrolabe: true };
  const legion = ['crimson_crowned', 'pack_leader'];
  /** Movement III's badges wait for the Rift (docs/phase-5c.md). */
  const rift = ['whole_cloth', 'needle_sure'];
  /** Every Deed but a hero's, which waits for the roster (docs/phase-5b.md). */
  const ALL = CONTENT.deeds.filter((d) => !d.hero).length;
  /** …and, with the Legion seen but not the Rift, every one but Movement III's too. */
  const SHOWN = CONTENT.deeds.filter((d) => !d.hero && !rift.includes(d.id)).length;

  it('a Movement I profile counts (and lists) only the Deeds in sight', () => {
    const p = newProfile();
    const earned = CONTENT.deeds.slice(0, 3).map((d) => d.id);
    const profile: Profile = { ...p, xp: RANK_XP[MAX_RANK - 1]!, deeds: earned };
    // A hero's Deed (In the Red) waits for the roster (docs/phase-5b.md).
    const inSight = CONTENT.deeds.filter(
      (d) => !legion.includes(d.id) && !rift.includes(d.id) && !d.hero,
    ).length;
    const tally = deedsTally(earned, profile.seen);
    expect(tally).toEqual({ earned: 3, total: inSight });
    const v = deedsView({ earned, best: {} }, open, profile.seen);
    expect(v.total).toBe(tally.total);
    expect(v.header).toMatch(new RegExp(`^3 of ${inSight} earned`));
    // Crimson Crowned and Pack Leader wait until the Legion is met.
    for (const id of legion) expect(v.badges.map((b) => b.id)).not.toContain(id);
    const badge = stationViews(profile, false).find((s) => s.id === 'deeds')!.badge;
    expect(badge).toBe(`3 of ${tally.total} earned`);
  });

  it('once the Legion is seen, both count every Deed', () => {
    const seen = [...newProfile().seen, 'sanguine_hound'];
    const earned = [CONTENT.deeds[0]!.id];
    const profile: Profile = { ...newProfile(), deeds: earned, seen };
    const v = deedsView({ earned, best: {} }, open, seen);
    expect(v.total).toBe(SHOWN);
    for (const id of legion) expect(v.badges.map((b) => b.id)).toContain(id);
    expect(stationViews(profile, false).find((s) => s.id === 'deeds')!.badge).toBe(
      `1 of ${SHOWN} earned`,
    );
    // Without sightings (the labs), everything shows.
    expect(deedsView({ earned, best: {} }, open).total).toBe(ALL);
  });
});

describe('Prep’s Route toggle', () => {
  it('is shown once Expeditions are open, and switching keeps the Calling and Chords', () => {
    useRun.getState().newRun(41);
    expect(prepRoute()).toBeNull();
    skipUnlocks();
    const route = prepRoute();
    expect(route).not.toBeNull();
    const calling = CONTENT.callings[0]!.id;
    useRun.getState().setCalling(calling);
    const chords = [
      { auras: ['fortissimo'], ornaments: [] },
      { auras: ['sostenuto'], ornaments: [] },
    ];
    useRun.getState().setChords(chords);
    const before = useRun.getState().run!;
    expect(before.calling?.id).toBe(calling);
    route!.onChange('expedition');
    const after = useRun.getState().run!;
    expect(after.movements).toBe(EXPEDITION_MOVEMENTS);
    expect(after.seed).toBe(before.seed);
    expect(after.calling?.id).toBe(calling);
    expect(after.chords).toEqual(before.chords);
    expect(useProfile.getState().profile.runMode).toBe('expedition');
    route!.onChange('prelude');
    expect(useRun.getState().run!).toMatchObject({ movements: 1, chords: before.chords });
    expect(useRun.getState().run!.calling?.id).toBe(calling);
  });

  it('Rank 2 opens it without Skip the unlocks', () => {
    useRun.getState().newRun(42);
    useProfile.getState().award(RANK_XP[1]!);
    expect(prepRoute()).not.toBeNull();
  });
});

describe('W4 cleanups', () => {
  it('sightings go through the profile store’s see(): once each, saved', () => {
    const before = useProfile.getState().profile.seen.length;
    recordSeen(['impaler', 'impaler']);
    recordSeen(['impaler']);
    const seen = useProfile.getState().profile.seen;
    expect(seen.length).toBe(before + 1);
    expect(seen).toContain('impaler');
  });

  it('the map’s Movement and rows are the meta’s', () => {
    const run = expedition(43);
    expect(mapMovement(run)).toBe(Run.mapMovement(run));
    expect(movementRows(run, 2)).toEqual(Run.rowsOfMovement(run.map, 2));
    const cantor = cantorOf(run);
    const at = { ...run, path: [...run.path, cantor.id] };
    expect(mapMovement(at)).toBe(2);
    expect(Run.movementOf(at)).toBe(1);
  });

  it('endsRun takes a result as it is (no cast): the Cantor of an Expedition is no win', () => {
    expect(endsRun({ kind: 'boss', outcome: 'victory', wonRun: false })).toBe(false);
    expect(endsRun({ kind: 'boss', outcome: 'victory', wonRun: true })).toBe(true);
    // Saved before Movements: a won boss stood for it.
    expect(endsRun({ kind: 'boss', outcome: 'victory' })).toBe(true);
  });

  it('the Movement II enshrine stage reaches choose', () => {
    const fallen = expeditionReliquaryRun();
    expect(Run.enshrineOptions(fallen).length).toBeGreaterThan(0);
    expect(enshrineStage(fallen, EMPTY_RELIQUARY)).toBe('choose');
  });
});

describe('end of the run: in an Expedition the Cantor is not the end', () => {
  it('a Cantor victory in an Expedition leads on; in a Prelude it ends the run', () => {
    const run = expedition(44);
    const cantor = cantorOf(run);
    expect(Run.isFinalNode(cantor)).toBe(false);
    expect(finalEncounter(run)).toBe(CONTENT.movements.at(-1)!.boss);
    const won: RunState = {
      ...run,
      phase: 'result',
      outcome: null,
      path: [...run.path, cantor.id],
      pending: cantor.id,
      lastResult: {
        ...victoryRun(7).lastResult!,
        kind: 'boss',
        outcome: 'victory',
        wonRun: false,
      },
    };
    expect(nextStep(won)).toMatch(/^Continue: /);
    expect(nextStep(won)).not.toBe('Continue');
    // The Prelude's Cantor: the run's end, plain Continue to the summary.
    const prelude = victoryRun(7);
    const preludeCantor = cantorOf(prelude);
    expect(Run.isFinalNode(preludeCantor)).toBe(true);
    expect(
      nextStep({
        ...prelude,
        phase: 'result',
        outcome: null,
        pending: preludeCantor.id,
        lastResult: { ...prelude.lastResult!, kind: 'boss', outcome: 'victory' },
      }),
    ).toBe('Continue');
  });

  it('the Cantor’s Starlight and XP in an Expedition carry no run-win bonus', () => {
    const cantor = {
      kind: 'boss' as const,
      outcome: 'victory' as const,
      starlight: 20,
      grade: 'B' as const,
      name: 'The Hollow Cantor',
      xp: 0,
    };
    expect(fightStarlight({ ...cantor, wonRun: false })!.detail).not.toMatch(/winning the run/);
    expect(fightStarlight({ ...cantor, wonRun: true })!.detail).toMatch(/winning the run/);
    const lines = (wonRun: boolean) =>
      fightXp({ ...cantor, wonRun, xp: 999 }).lines.map((l) => l.label);
    expect(lines(false)).not.toContain('Run complete');
    expect(lines(true)).toContain('Run complete');
    const results = [{ ...cantor, wonRun: false }] as unknown as EncounterResult[];
    expect(
      runStarlight({ results, deeds: [], dissonance: [] }).lines.map((l) => l.label),
    ).not.toContain('Winning the run');
  });

  it('a Movement II fight’s XP shows its ×1.25 on its own line, not as Dissonance', () => {
    const r = {
      kind: 'skirmish' as const,
      outcome: 'victory' as const,
      grade: 'A' as const,
      name: 'Red Muster',
    };
    const base = fightXp({ ...r, xp: 0 }).lines.reduce((n, l) => n + l.xp, 0);
    const xp = Math.round(base * Run.movementRewards(2).xp);
    const x = fightXp({ ...r, xp }, [], 2);
    expect(x.total).toBe(xp);
    expect(x.lines.reduce((n, l) => n + l.xp, 0)).toBe(xp);
    expect(x.lines.map((l) => l.label)).toContain(`Movement II · ×${Run.movementRewards(2).xp}`);
    expect(x.lines.some((l) => l.label.startsWith('Dissonance'))).toBe(false);
    // Movement I: as it was.
    expect(fightXp({ ...r, xp: base }, [], 1).lines).toEqual(fightXp({ ...r, xp: base }).lines);
  });

  it('a Movement II defeat can enshrine through the Summary', () => {
    skipUnlocks();
    const fallen: RunState = { ...expeditionReliquaryRun(), phase: 'summary' };
    expect(fallen.outcome).toBe('defeat');
    expect(outcomeSub(fallen)).toMatch(/Movement II/);
    const choices = enshrineChoices(fallen);
    expect(choices.length).toBeGreaterThan(0);
    expect(enshrineStage(fallen, EMPTY_RELIQUARY)).toBe('choose');
    useRun.setState({ run: fallen });
    const result = useRun.getState().enshrine(choices[0]!.id);
    expect(result.ok).toBe(true);
    expect(useRun.getState().run!.reliquary!.enshrined).toBe(choices[0]!.id);
    expect(enshrineStage(useRun.getState().run!, EMPTY_RELIQUARY)).toBe('done');
  });
});

describe('the death recap names the missed answer', () => {
  it('"Answer: Chime"; several are joined; none on a Movement I death', () => {
    expect(deathAnswerLine(['chime'])).toBe('Answer: Chime');
    expect(deathAnswerLine(['reel', 'chime'])).toBe('Answers: Reel or Chime');
    expect(deathAnswerLine(['chime', 'chime'])).toBe('Answer: Chime');
    expect(deathAnswerLine(undefined)).toBeNull();
    expect(deathAnswerLine([])).toBeNull();
  });

  it('a recap’s answers survive the save; one without keeps no key', () => {
    const run = victoryRun(7);
    const r = run.lastResult!;
    const death = {
      time: 12,
      heroId: 'kael',
      killer: 'Bleed ×6 (Sanguine Hound)',
      recap: [{ time: 11.5, amount: 40, source: 'Bleed ×6 (Sanguine Hound)' }],
      readyTechniques: [],
    };
    const withDeaths = {
      ...run,
      lastResult: { ...r, deaths: [{ ...death, answers: ['chime'] }, death] },
    };
    const store = new Map<string, string>();
    const storage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    };
    saveRun(storage, withDeaths);
    const loaded = loadRun(storage)!;
    const [a, b] = loaded.lastResult!.deaths;
    expect(a!.answers).toEqual(['chime']);
    expect(deathAnswerLine(a!.answers)).toBe('Answer: Chime');
    expect('answers' in b!).toBe(false);
  });
});

describe('the Map voices its Movement’s biome', () => {
  const biome = () => (getAudio() as SynthDirector).getBiome();

  it('Movement II’s map is the Spire’s from the Cantor on; a Prelude after it is the Reliquary’s', () => {
    const run = expedition(45);
    expect(mapBiome(run)).toBe('reliquary');
    const at = { ...run, path: [...run.path, cantorOf(run).id] };
    expect(mapBiome(at)).toBe(CONTENT.movements[1]!.biome);
    voiceMapBiome(at);
    expect(biome()).toBe('crimson_spire');
    // Idempotent.
    voiceMapBiome(at);
    expect(biome()).toBe('crimson_spire');
    // Then a Prelude: its map is the Sunlit Reliquary's again.
    const prelude = Run.embark(Run.newRun(46));
    expect(mapBiome(prelude)).toBe('reliquary');
    voiceMapBiome(prelude);
    expect(biome()).toBe('reliquary');
  });
});

describe('the Sentinel hint follows its shield blocking a blow', () => {
  it('a guarded foe alone gives no hint; a recent guardBlocked does', () => {
    const hud = legionHud('legion');
    expect(evaluateHints(hud).map((h) => h.id)).toContain('guard');
    const quiet = { ...hud, guardBlocked: undefined };
    expect(quiet.foes).toContain('crimson_sentinel');
    expect(evaluateHints(quiet).map((h) => h.id)).not.toContain('guard');
    expect(evaluateHints({ ...hud, focusTarget: 3 }).map((h) => h.id)).not.toContain('guard');
    expect(ANSWER_HINTS.has('guard')).toBe(true);
  });

  it('the bridge marks a block for a few seconds; a Movement I fight has no key', () => {
    expect(guardBlockedRecently(10, 9)).toBe(true);
    expect(guardBlockedRecently(10, 10 - GUARD_HINT_SECONDS - 0.1)).toBe(false);
    expect(guardBlockedRecently(10, null)).toBe(false);
    expect(guardBlockedRecently(10, undefined)).toBe(false);
    const sim = createSim({ seed: 7, encounter: 'first_light' });
    const hud = buildHudSnapshot(sim.state, { seed: 7, hovered: null });
    expect('guardBlocked' in hud).toBe(false);
    const t = sim.state.time;
    expect(
      buildHudSnapshot(sim.state, { seed: 7, hovered: null, guardBlockedAt: t }).guardBlocked,
    ).toBe(true);
  });
});

describe('phase ticks come from the sim alone', () => {
  it('every boss and mini-boss has its thresholds in the sim’s table', () => {
    expect(bossPhasesOf('vharun_crimson_warden')).toEqual({ phases: 3, phaseAt: [0.66, 0.33] });
    expect(bossPhasesOf('gorehound_matriarch')).toEqual({ phases: 2, phaseAt: [0.5] });
  });
});

describe('every Codex a screen opens knows what the profile has seen', () => {
  it('passes `seen`, so its Deeds page agrees with the Loom badge', async () => {
    const { readFileSync, readdirSync } = await import('node:fs');
    const dir = 'src/ui/screens';
    const sites = readdirSync(dir)
      .filter((f) => f.endsWith('.tsx'))
      .flatMap((f) => {
        const src = readFileSync(`${dir}/${f}`, 'utf8');
        return [...src.matchAll(/<CodexView\b[\s\S]*?\n\s*\/>/g)].map((m) => ({ f, tag: m[0] }));
      });
    expect(sites.length).toBeGreaterThanOrEqual(6);
    for (const { f, tag } of sites) expect(tag, f).toMatch(/\bseen=\{/);
  });
});
