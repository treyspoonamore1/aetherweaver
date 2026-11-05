/**
 * Phase 5a, Movement II's UI (docs/phase-5a.md "UI"): stacks through the HUD bridge, the boss
 * bar's real phase ticks, the map's current Movement, the Prelude's strings as they were, the
 * enshrine stage after a Movement II defeat, the first-sighting flow, the hints and the Codex.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { useProfile } from '../src/app/profileStore';
import { useRun } from '../src/app/runStore';
import { useSettings } from '../src/app/settings';
import { CONTENT } from '../src/content';
import { EXPEDITION_MOVEMENTS, newProfile } from '../src/meta/profile';
import * as Run from '../src/meta/run';
import { createSim, type Telegraph } from '../src/sim';
import { ANSWER_HINTS, evaluateHints } from '../src/ui/hud/hints';
import { readFileSync } from 'node:fs';
import { bossCastIcon, phaseTicks, STACKS_EMPHASIS, stacksUrgent } from '../src/ui/hud/legionLook';
import {
  newSightings,
  noteSightings,
  sightingDef,
  sightingOf,
  SIGHTING_KEY,
} from '../src/ui/hud/sighting';
import { blowsOf, bossPhasesOf, buildHudSnapshot } from '../src/ui/hudBridge';
import { useUi } from '../src/ui/store';
import {
  EMPTY_RELIQUARY,
  expeditionReliquaryRun,
  expeditionRun,
  expeditionSummaryRun,
  legionCallouts,
  legionHud,
  reliquarySummaryRun,
  summaryRun,
  victoryRun,
  withMovementTwo,
} from '../src/ui/lab/mock';
import { draftCopy, nextStep, relicOfferCopy } from '../src/ui/screens/interlude';
import { gateLine } from '../src/ui/screens/loomModel';
import { enshrineHow, enshrineStage } from '../src/ui/screens/reliquaryModel';
import {
  abandonLine,
  combatSubtitle,
  deedsInSight,
  encounterIcon,
  mapHeader,
  mapMovement,
  movementCard,
  movementRows,
  outcomeSub,
  prepEyebrow,
  routeOptions,
  sightedMovement,
  summaryEyebrow,
  titleEyebrow,
  wantsMovementCard,
} from '../src/ui/screens/routeText';
import { worldOf } from './sim/helpers';

beforeEach(() => {
  useSettings.getState().reset();
  useProfile.getState().resetProgress();
  useRun.getState().closeRun();
  useUi.setState({ callouts: [] });
});

const MOVEMENT_ONE_DEEDS = CONTENT.deeds.filter(
  (d) =>
    !d.encounter || (CONTENT.encounters.find((e) => e.id === d.encounter)?.movement ?? 1) === 1,
);

describe('the HUD bridge (Movement II)', () => {
  it('stacks survive the bridge; other statuses gain no key', () => {
    const sim = createSim({ seed: 7, encounter: 'first_light' });
    const w = worldOf(sim);
    const kael = w.entities.get(w.party[0]!)!;
    kael.health!.statuses.push(
      { id: 'bleed', remaining: 5, duration: 6, stacks: 6, source: null, dps: 12, tickIn: 0.5 },
      { id: 'stun', remaining: 1, duration: 1, stacks: 1, source: null },
    );
    const hud = buildHudSnapshot(sim.state, { seed: 7, hovered: null });
    const statuses = hud.party[0]!.statuses;
    expect(statuses.find((s) => s.id === 'bleed')).toMatchObject({ stacks: 6, remaining: 5 });
    expect('stacks' in statuses.find((s) => s.id === 'stun')!).toBe(false);
    // From 5 stacks the badge asks for its answer.
    expect(STACKS_EMPHASIS).toBe(5);
    expect(stacksUrgent({ stacks: 6 })).toBe(true);
    expect(stacksUrgent({ stacks: 4 })).toBe(false);
    expect(stacksUrgent({})).toBe(false);
  });

  it('a Movement I fight adds no Movement II key to the snapshot', () => {
    const sim = createSim({ seed: 7, encounter: 'first_light' });
    const hud = buildHudSnapshot(sim.state, { seed: 7, hovered: null });
    for (const h of hud.party) {
      expect('healCut' in h).toBe(false);
      expect('execute' in h).toBe(false);
    }
    expect('hymnCircles' in hud).toBe(false);
  });

  it('Wound and Bloodmoon cut healing (×0.25 together); Execution draws its line', () => {
    const sim = createSim({ seed: 7, encounter: 'vharun' });
    const w = worldOf(sim);
    for (let i = 0; i < 400 && w.encounter.bossId === null; i++) sim.step([]);
    const [kael, lyra, vexis] = w.party.map((id) => w.entities.get(id)!);
    w.field.sanctuary = {
      pools: [{ x: lyra!.x, z: lyra!.z, r: 3.6, vx: 0, vz: 0 }],
      healMult: 0.5,
      reformAt: 999,
    };
    vexis!.health!.statuses.push({
      id: 'wound',
      remaining: 4,
      duration: 4,
      stacks: 1,
      source: null,
    });
    const shape = { kind: 'circle', x: kael!.x, z: kael!.z, r: 1 } as const;
    const execution: Telegraph = {
      id: 9999,
      owner: w.encounter.bossId!,
      target: lyra!.id,
      attackId: 'vharun_execution',
      name: 'Execution',
      kind: 'mark',
      shape,
      start: w.time,
      impact: w.time + 4,
      perfectFrom: w.time + 3.6,
      damage: 80,
      pctMaxHp: 0,
      effect: 'damage',
      answers: ['mend', 'ward'],
      severity: 'normal',
      executeBelow: 0.4,
    };
    w.telegraphs.push(execution);
    const hud = buildHudSnapshot(sim.state, { seed: 7, hovered: null });
    const [k, l, v] = hud.party;
    // Lyra stands in the pool; Kael outside it; Vexis outside it and Wounded.
    expect(l!.healCut).toBeUndefined();
    expect(k!.healCut).toBe(0.5);
    expect(v!.healCut).toBe(0.25);
    expect(l!.execute).toBe(0.4);
    expect(k!.execute).toBeUndefined();
    expect(hud.boss!.bloodmoon).toBe(true);
    expect(hud.boss!.executeTarget).toBe('Lyra');
    expect(hud.boss!.defId).toBe('vharun_crimson_warden');
    expect(hud.foes).toContain('vharun_crimson_warden');
  });
});

describe('the boss bar', () => {
  it('phase ticks are the real thresholds: the Cantor at 0.7/0.4, Vharun at 0.66/0.33', () => {
    expect(bossPhasesOf('the_hollow_cantor')).toEqual({ phases: 3, phaseAt: [0.7, 0.4] });
    expect(bossPhasesOf('the_bellwarden')).toEqual({ phases: 2, phaseAt: [0.5] });
    expect(bossPhasesOf('vharun_crimson_warden')).toEqual({ phases: 3, phaseAt: [0.66, 0.33] });
    expect(bossPhasesOf('gorehound_matriarch')).toEqual({ phases: 2, phaseAt: [0.5] });
    expect(bossPhasesOf('bell_brute')).toEqual({ phases: 1, phaseAt: [] });
    expect(phaseTicks({ phases: 3, phaseAt: [0.7, 0.4] })).toEqual([70, 40]);
    expect(phaseTicks({ phases: 3, phaseAt: [0.66, 0.33] })).toEqual([66, 33]);
    // A snapshot without thresholds draws the even split, as before.
    expect(phaseTicks({ phases: 3 }).map(Math.round)).toEqual([67, 33]);
  });

  it('the Cantor’s bar reads the sim’s table', () => {
    const sim = createSim({ seed: 7, encounter: 'hollow_cantor' });
    for (let i = 0; i < 400 && sim.state.encounter.bossId === null; i++) sim.step([]);
    const boss = buildHudSnapshot(sim.state, { seed: 7, hovered: null }).boss!;
    expect(boss.phases).toBe(3);
    expect(boss.phaseAt).toEqual([0.7, 0.4]);
    expect(boss.bloodmoon).toBeUndefined();
    expect(bossCastIcon(boss.defId)).toBe('bell');
  });

  it('Twin Cleave’s two blows are pips; each boss has its cast glyph', () => {
    expect(blowsOf('vharun_twin_cleave')).toEqual({ pips: 2, pip: 1 });
    expect(blowsOf('vharun_twin_cleave_second')).toEqual({ pips: 2, pip: 2 });
    expect(blowsOf('cantor_requiem')).toBeNull();
    expect(bossCastIcon('vharun_crimson_warden')).toBe('crown');
    expect(bossCastIcon('gorehound_matriarch')).toBe('paw');
    expect(bossCastIcon(undefined)).toBe('bell');
  });
});

describe('the map in Movement II', () => {
  it('shows only the current Movement: 7 rows, header and title, the Matriarch’s paw', () => {
    const run = expeditionRun('climb');
    expect(run.map.rows).toHaveLength(17);
    expect(mapMovement(run)).toBe(2);
    const rows = movementRows(run, 2);
    expect(rows).toHaveLength(7);
    expect(rows.flat().every((n) => n.movement === 2)).toBe(true);
    const header = mapHeader(run);
    expect(header.eyebrow).toBe('Movement II · The Crimson Legion · step 3 of 7');
    expect(header.title).toBe('The Crimson Ascent');
    const matriarch = rows.flat().find((n) => n.kind === 'miniboss')!;
    expect(encounterIcon(matriarch.encounterId)).toBe('paw');
    expect(encounterIcon(rows.at(-1)![0]!.encounterId)).toBe('crown');
    // Every other stop draws its kind's glyph.
    expect(run.map.rows[0]!.map((n) => encounterIcon(n.encounterId))).toEqual([null]);
  });

  it('after the Cantor, the next stop’s Movement: the card is due, once', () => {
    const run = expeditionRun('arrive');
    // The last stop walked is the Cantor (Movement I); the map is already Movement II's.
    expect(Run.movementOf(run)).toBe(1);
    expect(mapMovement(run)).toBe(2);
    expect(mapHeader(run).eyebrow).toBe('Movement II · The Crimson Legion · step 1 of 7');
    expect(wantsMovementCard(run, 2)).toBe(true);
    expect(wantsMovementCard(expeditionRun('climb'), 2)).toBe(false);
    expect(movementCard(2).title).toBe('Movement II · The Crimson Legion');
  });

  it('an Expedition’s combat line names its Movement and node', () => {
    const run = expeditionRun('climb');
    const pending = run.path.at(-1)!;
    expect(combatSubtitle({ ...run, pending })).toBe('Movement II · node 2 of 7');
  });
});

describe('Prelude strings render as today', () => {
  it('map, combat, Prep, Pause, Summary, Title and the Loom’s Gate', () => {
    const run = Run.embark(Run.newRun(7));
    expect(mapHeader(run)).toMatchObject({
      eyebrow: 'The Prelude · Movement I · step 1 of 10',
      title: 'The Reliquary Road',
    });
    const played = victoryRun(7);
    const midway = { ...played, path: played.path.slice(0, 3), pending: played.path[2]! };
    expect(combatSubtitle(midway)).toBe(`The Prelude · node 3 of ${played.map.rows.length}`);
    expect(prepEyebrow(run)).toBe('The Prelude · Movement I');
    expect(abandonLine(run)).toBe(
      'The Prelude ends here and you go to the summary. This cannot be undone.',
    );
    expect(abandonLine(run, true)).toBe(
      'The Prelude ends here and you go straight to the summary. This cannot be undone.',
    );
    expect(summaryEyebrow(run)).toBe('The Prelude · summary');
    expect(outcomeSub(summaryRun('victory'))).toBe(
      'The Hollow Cantor falls and the Reliquary sings again.',
    );
    expect(outcomeSub(summaryRun('defeat'))).toBeNull();
    expect(titleEyebrow(false)).toBe('Movement I · The Prelude');
    const along = { ...run, path: run.path.concat(['r0c0', 'r1c0', 'r2c0']) };
    expect(gateLine(along)).toBe(`Continue · step 4 of ${run.map.rows.length}`);
  });

  it('a boss’s spoils without a source are the Bellwarden’s; the Cantor ends a Prelude', () => {
    const offer = { reason: 'boss' as const, options: ['a', 'b', 'c'] };
    expect(relicOfferCopy(offer)).toMatchObject({
      eyebrow: 'The Bellwarden falls',
      title: 'The Warden’s hoard',
    });
    expect(relicOfferCopy({ ...offer, sourceEncounter: 'bellwarden' }).title).toBe(
      'The Warden’s hoard',
    );
    expect(draftCopy({ reason: 'boss' })).toEqual({
      title: 'The Warden’s gift',
      blurb: 'The great bell is silent. Take something epic.',
    });
    expect(draftCopy({ reason: 'elite' }).title).toBe('Rare spoils');
  });
});

describe('an Expedition’s copy', () => {
  it('Prep, Title, the Route toggle and the Summary name the route and the final boss', () => {
    const prep = withMovementTwo(Run.newRun(7));
    expect(prepEyebrow(prep)).toBe('The Expedition · Movements I–II');
    // Derived from content (docs/phase-5c.md): an Expedition is every Movement, I–III now; a
    // 2-Movement count still reads as it did.
    expect(titleEyebrow(true)).toBe(
      `Movements I–${EXPEDITION_MOVEMENTS === 3 ? 'III' : 'II'} · The Expedition`,
    );
    expect(titleEyebrow(true, 2)).toBe('Movements I–II · The Expedition');
    expect(routeOptions().map((o) => o.label)).toEqual([
      'Prelude · ~15 min',
      'Expedition · ~40 min',
    ]);
    expect(summaryEyebrow(prep)).toBe('The Expedition · summary');
    expect(outcomeSub(expeditionSummaryRun('victory'))).toBe(
      'Vharun falls, and the Spire’s banners burn.',
    );
    expect(outcomeSub(expeditionSummaryRun('defeat'))).toMatch(
      /^The party is lost in Movement II, the Crimson Legion/,
    );
    expect(abandonLine(prep)).toMatch(/^The Expedition ends here/);
  });

  it('relic and draft copy come from the source encounter', () => {
    const offer = { reason: 'boss' as const, options: ['a'], sourceEncounter: 'hollow_cantor' };
    expect(relicOfferCopy(offer).eyebrow).toBe('The Hollow Cantor falls');
    expect(relicOfferCopy({ ...offer, sourceEncounter: 'gorehound_matriarch' }).eyebrow).toBe(
      'The Gorehound Matriarch falls',
    );
    expect(draftCopy({ reason: 'boss', sourceEncounter: 'hollow_cantor' }).title).toBe(
      'The Cantor’s gift',
    );
  });

  it('a non-final Cantor leads on: Continue goes to its spoils', () => {
    const won = victoryRun(7);
    const run = withMovementTwo(won);
    const cantor = run.map.rows.flat().find((n) => n.encounterId === 'hollow_cantor')!;
    expect(Run.isFinalNode(cantor)).toBe(false);
    const result = {
      ...run,
      phase: 'result' as const,
      outcome: null,
      pending: cantor.id,
      lastResult: { ...won.lastResult!, kind: 'boss' as const, outcome: 'victory' as const },
    };
    expect(nextStep(result)).toBe('Continue: choose a relic');
    // In a Prelude, the Cantor is the end.
    const prelude = { ...won, phase: 'result' as const, outcome: null, pending: cantor.id };
    expect(nextStep({ ...prelude, lastResult: result.lastResult })).toBe('Continue');
  });
});

describe('enshrine after a Movement II defeat', () => {
  it('an Expedition that reached Movement II may enshrine, won or not; a lost Prelude may not', () => {
    const fallen = expeditionReliquaryRun();
    expect(fallen.outcome).toBe('defeat');
    expect(Run.enshrineEligible(fallen)).toBe(true);
    // Its relics found are the meta's to offer (`enshrineOptions`, which follows the same rule).
    expect(Run.enshrineOptions(fallen).length).toBeGreaterThan(0);
    expect(enshrineStage(fallen, EMPTY_RELIQUARY)).toBe('choose');
    expect(enshrineStage(reliquarySummaryRun('defeat'), EMPTY_RELIQUARY)).toBe('lost');
    expect(enshrineHow(fallen)).toBe('Reach Movement II to enshrine one of the relics it found');
    expect(enshrineHow({ movements: 1 })).toBe('Win a run to enshrine one of the relics it found');
    expect(enshrineHow()).toMatch(/reach Movement II on an Expedition/);
  });
});

describe('first sighting', () => {
  it('a Prelude never shows one: every Movement I enemy is seen from the start', () => {
    const seen = useProfile.getState().profile.seen;
    const m1 = CONTENT.enemies.filter((e) => (e.movement ?? 1) === 1).map((e) => e.id);
    expect(newSightings(m1, seen)).toEqual([]);
    expect(noteSightings(m1, 0)).toEqual([]);
    expect(useUi.getState().callouts).toEqual([]);
  });

  it('a new foe gets one card, with its lesson and answers, and is recorded once', () => {
    const foes = ['hollow_chorister', 'sanguine_hound', 'sanguine_hound', 'impaler'];
    expect(newSightings(foes, newProfile().seen)).toEqual(['sanguine_hound', 'impaler']);
    expect(noteSightings(foes, 1000)).toEqual(['sanguine_hound', 'impaler']);
    const cards = useUi.getState().callouts.filter((c) => c.kind === 'sighting');
    expect(cards.map((c) => c.text)).toEqual(['Sanguine Hound', 'Impaler']);
    expect(cards.map(sightingDef)).toEqual(['sanguine_hound', 'impaler']);
    expect(cards[0]!.key).toBe(`${SIGHTING_KEY}sanguine_hound`);
    expect(cards[0]!.detail).toMatch(/Chime/);
    expect(sightingOf('sanguine_hound').answers).toContain('chime');
    expect(sightingOf('impaler').answers).toContain('reel');
    expect(sightingOf('crimson_sentinel').answers).toEqual(['focus']);
    expect(sightingOf('crimson_sentinel').lesson).toMatch(/90%/);
    expect(useProfile.getState().profile.seen).toEqual(
      expect.arrayContaining(['sanguine_hound', 'impaler']),
    );
    // Seen now: never again.
    expect(noteSightings(foes, 2000)).toEqual([]);
    expect(useUi.getState().callouts.filter((c) => c.kind === 'sighting')).toHaveLength(2);
    // Unknown ids are no foe.
    expect(newSightings(['nobody'], [])).toEqual([]);
    expect(sightingDef({ kind: 'system', key: 'sighting:impaler' })).toBeNull();
  });

  it('the lab’s card is a real sighting callout', () => {
    expect(legionCallouts('legion-sighting').map(sightingDef)).toEqual(['crimson_sentinel']);
  });
});

describe('Movement II hints', () => {
  it('each threat names its answer; Blind Score hides them', () => {
    const ids = evaluateHints(legionHud('legion')).map((h) => h.id);
    for (const id of ['bleed', 'pinned', 'wound', 'guard']) expect(ids).toContain(id);
    const vharun = evaluateHints(legionHud('vharun-execution'));
    expect(vharun.map((h) => h.id)).toEqual(expect.arrayContaining(['execution', 'bloodmoon']));
    expect(vharun.find((h) => h.id === 'execution')!.text).toMatch(/Lyra .*above 40%/);
    expect(evaluateHints(legionHud('vharun-cleave')).map((h) => h.id)).toContain('pact');
    for (const id of [
      'bleed',
      'pinned',
      'pact',
      'latched',
      'wound',
      'guard',
      'bloodmoon',
      'execution',
    ])
      expect(ANSWER_HINTS.has(id)).toBe(true);
    const blind = legionHud('legion');
    const hidden = evaluateHints({
      ...blind,
      dissonance: { levels: [], points: 0, blindScore: true },
    }).map((h) => h.id);
    expect(hidden).not.toContain('bleed');
  });

  it('the hymn-circle hint waits for hymn circles', () => {
    const base = legionHud('vharun-cleave');
    const silenced = { ...base, weaver: { ...base.weaver, fieldSuppressed: true } };
    const text = (hud: typeof silenced) =>
      evaluateHints(hud).find((h) => h.id === 'silenced')!.text;
    expect(text(silenced)).not.toMatch(/hymn circle/);
    expect(text({ ...silenced, hymnCircles: 2 })).toMatch(/hymn circle/);
  });
});

describe('the Codex and the Loom by sightings', () => {
  it('a player who hasn’t met the Legion sees Movement I’s Deeds and events only', () => {
    const seen = newProfile().seen;
    expect(sightedMovement(seen)).toBe(1);
    expect(deedsInSight(seen)).toEqual(MOVEMENT_ONE_DEEDS);
    // A hero's Deed waits for the roster too (docs/phase-5b.md), and Movement III's for the
    // Rift (docs/phase-5c.md).
    const movementOf = (id: string | undefined) =>
      CONTENT.encounters.find((e) => e.id === id)?.movement ?? 1;
    expect(deedsInSight([...seen, 'sanguine_hound'])).toEqual(
      CONTENT.deeds.filter((d) => d.hero === undefined && movementOf(d.encounter) <= 2),
    );
    expect(deedsInSight([...seen, 'sanguine_hound', 'shears'])).toEqual(
      CONTENT.deeds.filter((d) => d.hero === undefined),
    );
    expect(sightedMovement()).toBe(CONTENT.movements.length);
  });

  it('every event icon has a glyph (the Tithe Altar, the Bloodsworn’s Cell)', () => {
    // The glyph table, read as text (the node test build has no JSX).
    const source = readFileSync(new URL('../src/ui/kit/RelicGlyph.tsx', import.meta.url), 'utf8');
    const table = source.slice(source.indexOf('export const GLYPHS'), source.indexOf('\n};'));
    for (const ev of CONTENT.events)
      expect(new RegExp(`\\n  ${ev.icon}:`).test(table), ev.id).toBe(true);
    expect(table).toMatch(/\n {2}altar:/);
    expect(table).toMatch(/\n {2}cell:/);
  });
});
