/**
 * Phase 5c, Movement III's UI (docs/phase-5c.md "UI"): the HUD's Movement III keys only in
 * Movement III, the per-key rune lock (Glide stays ready inside a rune), the Cut and Unravelled
 * chips, the derived route copy (the Prelude's strings unchanged), no Guard Strand or Paradox text
 * without it, Calling-aware sightings, the input's fallback only after an enemy cut, the sleeping
 * relic's label, the boss bar's conditions, the hints and the recaps.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useSettings } from '../src/app/settings';
import { CONTENT } from '../src/content';
import { InputController, CUT_FALLBACK_SECONDS } from '../src/input/InputController';
import { EXPEDITION_MOVEMENTS } from '../src/meta/profile';
import { createSim, type SimEvent } from '../src/sim';
import { ANSWER_HINTS, evaluateHints } from '../src/ui/hud/hints';
import { ANSWER, STATUS } from '../src/ui/hud/labels';
import { bossCastIcon, stacksUrgent } from '../src/ui/hud/legionLook';
import {
  bossConditions,
  cutPlate,
  doomCount,
  doomMax,
  DOOM_EMPHASIS,
  unravelPlate,
} from '../src/ui/hud/riftLook';
import { sightingOf } from '../src/ui/hud/sighting';
import { RUNE_KEYS, slotSilenced, slotState } from '../src/ui/hud/techniqueState';
import { threadDialView } from '../src/ui/hud/threadMode';
import { buildHudSnapshot, heardCut } from '../src/ui/hudBridge';
import { PATHS } from '../src/ui/kit/iconPaths';
import {
  legionHud,
  mockHud,
  mockRelic,
  riftHud,
  riftRun,
  riftSummaryRun,
  withMovementThree,
  type LegionScenario,
  type RiftScenario,
} from '../src/ui/lab/mock';
import { bossSpoils } from '../src/ui/screens/interlude';
import { materialsHow, relicView, wakesLabel } from '../src/ui/screens/reliquaryModel';
import { deathAdviceLine, riftDownLine } from '../src/ui/screens/resultText';
import {
  biomeTone,
  encounterIcon,
  expeditionOnward,
  mapHeader,
  movementCard,
  movementCardLook,
  outcomeSub,
  prepEyebrow,
  routeHint,
  titleEyebrow,
} from '../src/ui/screens/routeText';
import type { HudSnapshot } from '../src/ui/store';
import { worldOf } from './sim/helpers';

const RIFT_ENEMIES = CONTENT.enemies.filter((e) => e.movement === 3).map((e) => e.id);
/** The HUD keys only Movement III sets. */
const RIFT_WEAVER_KEYS = ['runeLocked', 'threadCut', 'unravelLeft', 'stolenAura'] as const;
const RIFT_BOSS_KEYS = [
  'spindles',
  'stolen',
  'unravelLeft',
  'mirrorWard',
  'champion',
  'stitched',
] as const;
const RIFT_HERO_KEYS = ['possessed', 'stitchedWith'] as const;
const RIFT_HINTS = [
  'rune',
  'cut-coming',
  'cut',
  'inhale',
  'possessed',
  'wraith',
  'doom',
  'stitched',
  'unravel',
  'spindles',
  'verse',
  'mirror-ward',
  'mimic',
];

function snapshot(encounter: string, ticks = 120): HudSnapshot {
  const sim = createSim({ seed: 7, encounter });
  for (let i = 0; i < ticks; i++) sim.step([]);
  return buildHudSnapshot(sim.state, { seed: 7, hovered: null });
}

function noRiftKeys(hud: HudSnapshot): void {
  expect(hud.rift).toBeUndefined();
  for (const k of RIFT_WEAVER_KEYS) expect(hud.weaver, k).not.toHaveProperty(k);
  for (const h of hud.party) for (const k of RIFT_HERO_KEYS) expect(h, k).not.toHaveProperty(k);
  if (hud.boss) for (const k of RIFT_BOSS_KEYS) expect(hud.boss, k).not.toHaveProperty(k);
}

describe('the HUD bridge: Movement III keys only in Movement III', () => {
  it('a Movement I and a Movement II fight (bosses too) carry none of them', () => {
    for (const id of ['first_light', 'hollow_cantor', 'crimson_gate', 'vharun']) {
      const hud = snapshot(id, 900);
      if (id === 'hollow_cantor' || id === 'vharun') expect(hud.boss, id).not.toBeNull();
      noRiftKeys(hud);
    }
  });

  it('a Rift boss with its mechanics up sets them, from public state only', () => {
    const sim = createSim({ seed: 7, encounter: 'the_unweaver' });
    for (let i = 0; i < 900 && sim.state.encounter.bossId === null; i++) sim.step([]);
    const world = worldOf(sim);
    const boss = world.entities.get(world.encounter.bossId!)!;
    boss.enemy!.tethered = 2;
    world.field.unravel = { until: world.time + 4, source: boss.id, acc: 0, tickIn: 0.5 };
    const chord = world.field.chords.findIndex((c) => c.auras.length > 0);
    if (chord >= 0) world.field.stolen = { chord, aura: 0, add: boss.id, until: world.time + 20 };
    // Two heroes Stitched by the same Stitch.
    const [a, b] = [world.party[0]!, world.party[1]!].map((id) => world.entities.get(id)!);
    for (const h of [a, b])
      h.health!.statuses.push({
        id: 'stitched',
        remaining: 5,
        duration: 6,
        stacks: 1,
        source: boss.id,
      });
    const hud = buildHudSnapshot(sim.state, { seed: 7, hovered: null });
    expect(hud.boss?.spindles).toBe(2);
    expect(hud.boss?.unravelLeft).toBeCloseTo(4, 5);
    expect(hud.weaver.unravelLeft).toBeCloseTo(4, 5);
    expect(hud.boss?.stitched).toBe(2);
    expect(hud.party[0]!.stitchedWith).toEqual([1]);
    expect(hud.party[1]!.stitchedWith).toEqual([0]);
    expect(hud.party[2]).not.toHaveProperty('stitchedWith');
    if (chord >= 0) {
      const id = world.field.chords[chord]!.auras[0]!;
      expect(hud.weaver.stolenAura).toBe(id);
      expect(hud.boss?.stolen).toEqual({ id, name: CONTENT.auras.find((x) => x.id === id)!.name });
    }
    // The boss bar's conditions, each a glyph and words.
    const ids = bossConditions(hud.boss!).map((c) => c.id);
    expect(ids).toEqual(expect.arrayContaining(['spindles', 'unravel', 'stitched']));
    for (const c of bossConditions(hud.boss!)) expect(PATHS[c.icon]).toBeTruthy();
  });

  it('a possessed hero names whom they strike (never the Weaver); a Null rune locks the Weaver', () => {
    const sim = createSim({ seed: 7, encounter: 'wraith_vigil' });
    for (let i = 0; i < 30; i++) sim.step([]);
    const world = worldOf(sim);
    const lyra = world.entities.get(world.party[1]!)!;
    lyra.health!.statuses.push({
      id: 'possessed',
      remaining: 4,
      duration: 5,
      stacks: 1,
      source: null,
    });
    const weaver = world.entities.get(world.weaverId)!;
    world.field.zones = [
      {
        id: 1,
        kind: 'null',
        owner: lyra.id,
        x: weaver.x,
        z: weaver.z,
        r: 5,
        until: world.time + 6,
      },
    ];
    const hud = buildHudSnapshot(sim.state, { seed: 7, hovered: null });
    const p = hud.party[1]!.possessed!;
    expect(p).toBeDefined();
    expect(p.victim === null || hud.party.some((h) => h.name === p.victim)).toBe(true);
    expect(hud.weaver.runeLocked).toBe(true);
    // The rune refuses Ward, Chime and Reel; Glide stays ready inside it.
    const glide = hud.weaver.techniques.find((t) => t.key === 'glide')!;
    expect(slotState(glide, slotSilenced('glide', false, hud.weaver.runeLocked)).ready).toBe(true);
    for (const t of hud.weaver.techniques)
      expect(slotSilenced(t.key, false, true), t.key).toBe(RUNE_KEYS.has(t.key));
    expect(RUNE_KEYS.has('glide')).toBe(false);
    // Down, every slot is silenced, Glide too (as before).
    expect(slotSilenced('glide', true, undefined)).toBe(true);
    expect(
      evaluateHints({ ...hud, encounter: { ...hud.encounter, status: 'fighting' } }).map(
        (h) => h.id,
      ),
    ).toContain('rune');
    delete world.field.zones;
  });

  it('heardCut hears only an enemy cut: the range snap has no cause', () => {
    const snap: SimEvent = { type: 'threadSnapped', tick: 60, target: 5 };
    expect(heardCut([snap], 1)).toBeNull();
    const cut: SimEvent = {
      type: 'threadSnapped',
      tick: 120,
      target: 5,
      cause: 'snip',
      lock: 3,
      by: 9,
    };
    expect(heardCut([snap, cut], 2)).toEqual({ cause: 'snip', at: 2, lock: 3, target: 5 });
  });
});

describe('the Thread chip: Cut and Unravelled', () => {
  const w = mockHud('calm').weaver;
  it('a cut names its cause while the lock runs; a plain snap still reads Snapped', () => {
    const snapped = threadDialView({ ...w, threadSlot: null, threadLock: 3 }, null);
    expect(snapped.state).toBe('snapped');
    expect(snapped.plate).toBe('Snapped');
    const cut = threadDialView(
      { ...w, threadSlot: null, threadLock: 3, threadCut: { cause: 'snip' } },
      null,
    );
    expect(cut.plate).toBe('Cut · 3.0 s (Snip)');
    expect(cut.says).toMatch(/^Snip cut the Thread/);
    expect(cutPlate('shears', 1)).toBe('Cut · 1.0 s (Shears)');
  });

  it('Unravel shows on Mend, with Empower as the way out; in Empower the plate is as before', () => {
    const party = mockHud('calm').party;
    const target = party[0]!;
    const mend = threadDialView({ ...w, threadMode: 'mend', unravelLeft: 4.2 }, target);
    expect(mend.plate).toBe('Unravelled · 5 s');
    expect(mend.unravelled).toBe(true);
    expect(mend.says).toMatch(/Empower/);
    const emp = threadDialView({ ...w, threadMode: 'empower', unravelLeft: 4.2 }, target);
    expect(emp.plate).toBe('Empower');
    expect(emp).not.toHaveProperty('unravelled');
    expect(unravelPlate(0.2)).toBe('Unravelled · 1 s');
  });
});

describe('the route copy, derived from content', () => {
  it('the Prelude’s strings are unchanged', () => {
    expect(titleEyebrow(false)).toBe('Movement I · The Prelude');
    expect(routeHint('prelude')).toBe('Movement I alone, to The Hollow Cantor.');
    expect(prepEyebrow({ movements: 1 })).toBe('The Prelude · Movement I');
  });

  it('the Expedition names Movements I–III, to the Unweaver; two Movements read as they did', () => {
    expect(EXPEDITION_MOVEMENTS).toBe(CONTENT.movements.length);
    expect(EXPEDITION_MOVEMENTS).toBe(3);
    expect(titleEyebrow(true)).toBe('Movements I–III · The Expedition');
    expect(routeHint('expedition')).toBe('Movements I–III, to the Unweaver.');
    expect(expeditionOnward()).toBe('through Movements II–III');
    expect(prepEyebrow({ movements: 3 })).toBe('The Expedition · Movements I–III');
    // A 2-Movement Expedition (an old save) as it was.
    expect(titleEyebrow(true, 2)).toBe('Movements I–II · The Expedition');
    expect(expeditionOnward(2)).toBe('into Movement II');
    expect(routeHint('expedition', 2)).toBe(
      'Movement I, then Movement II (The Crimson Legion), to Vharun, the Crimson Warden.',
    );
  });

  it('the Rift’s map: its card, tone, icons, the victory line and Vharun’s interlude', () => {
    expect(movementCard(3).title).toBe('Movement III · The Unstitched');
    expect(movementCard(3).text).toBe('The Unravelling Descent: 6 stops to The Unweaver.');
    expect(movementCardLook(3).button).toBe('Descend');
    expect(movementCardLook(2).button).toBe('Climb on');
    expect(biomeTone('abyssal_rift')).toBe('abyss');
    expect(biomeTone('crimson_spire')).toBe('crimson');
    expect(biomeTone('reliquary')).toBeUndefined();
    expect(encounterIcon('the_seamstress')).toBe('needle');
    expect(encounterIcon('the_unweaver')).toBe('scissors');
    expect(encounterIcon('vharun')).toBe('crown');
    expect(bossCastIcon('the_seamstress')).toBe('needle');
    expect(bossCastIcon('the_unweaver')).toBe('scissors');
    expect(bossCastIcon('the_bellwarden')).toBe('bell');
    expect(outcomeSub(riftSummaryRun('victory'))).toBe(
      'The Unweaver falls, and the Rift knits shut.',
    );
    expect(outcomeSub(riftSummaryRun('defeat'))).toMatch(
      /^The party is lost in Movement III, the Unstitched/,
    );
    const run = riftRun('arrive');
    expect(mapHeader(run).eyebrow).toBe('Movement III · The Unstitched · step 1 of 6');
    const vharun = run.map.rows.flat().find((n) => n.encounterId === 'vharun')!;
    expect(vharun.next.length).toBeGreaterThan(0);
    expect(vharun.reward.text).toBe('Vharun, the Crimson Warden. Beyond it, the Abyssal Rift.');
    expect(withMovementThree(run)).toMatchObject({ movements: 3 });
    expect(bossSpoils('vharun').hoard).toBe('The Warden’s armoury');
    expect(bossSpoils('vharun').giftBlurb).toMatch(/the Rift yawns below/);
    expect(bossSpoils('the_seamstress').fallen).toBe('The Seamstress falls');
    // The Tear is the last Movement's boss's.
    expect(materialsHow().tears).toContain('the Hollow Cantor, or the Unweaver on an Expedition');
  });
});

describe('labels, badges and the boss bar', () => {
  it('both new answer glyphs, and every Movement III status with its glyph and answer', () => {
    expect(ANSWER.thread).toMatchObject({ label: 'Retarget', icon: 'threadCut' });
    expect(ANSWER.empower).toMatchObject({ label: 'Empower', action: 'threadMode' });
    for (const id of [
      'doubt',
      'possessed',
      'doom',
      'doomed',
      'voided',
      'stitch',
      'stitched',
      'unravelled',
    ] as const) {
      expect(PATHS[STATUS[id].icon], id).toBeTruthy();
      expect(STATUS[id].answer, id).toBeTruthy();
    }
    expect(STATUS.possessed.answer).toBe(
      'Chime frees them; Focus the Wraith before its cast ends.',
    );
    expect(STATUS.stitched.answer).toBe('A Chime frees each one it reaches.');
    expect(STATUS.voided.answer).toBe('Rally or Reel them out.');
    expect(STATUS.unravelled.answer).toBe('Your Mend wounds — Empower.');
    for (const icon of ['scissors', 'needle', 'spindle', 'mask', 'rune', 'mirror', 'maw'] as const)
      expect(PATHS[icon]).toBeTruthy();
  });

  it('Doom counts against its ignition and glows a stack early; bleed keeps its 5', () => {
    expect(doomMax()).toBe(5);
    expect(DOOM_EMPHASIS).toBe(4);
    expect(doomCount(3)).toBe('×3/5');
    expect(stacksUrgent({ id: 'doom', stacks: 4 })).toBe(true);
    expect(stacksUrgent({ id: 'doom', stacks: 3 })).toBe(false);
    expect(stacksUrgent({ id: 'bleed', stacks: 4 })).toBe(false);
    expect(stacksUrgent({ stacks: 5 })).toBe(true);
  });

  it('the Bloodmoon stays as it was among the conditions; a Movement I boss has none', () => {
    const vharun = legionHud('vharun-bloodmoon').boss!;
    expect(bossConditions(vharun).map((c) => [c.id, c.label, c.text])).toEqual([
      ['bloodmoon', 'Bloodmoon', 'healing −50% outside the pools'],
    ]);
    expect(bossConditions(legionHud('matriarch').boss!)).toEqual([]);
    const mirror = bossConditions(riftHud('unweaver-mirror').boss!);
    expect(mirror.map((c) => c.id)).toEqual(['mirrorWard', 'champion']);
    expect(mirror.find((c) => c.id === 'champion')!.bar).toBeCloseTo(15600 / 21000, 5);
    expect(bossConditions(riftHud('unweaver-snip').boss!)[0]).toMatchObject({
      id: 'spindles',
      label: 'Spindles ×2',
      text: '−75% damage to the boss · Focus them',
    });
  });
});

describe('hints', () => {
  const ids = (hud: HudSnapshot) =>
    evaluateHints({ ...hud, encounter: { ...hud.encounter, status: 'fighting' } }).map((h) => h.id);

  it('none of Movement III’s show in Movement I or II', () => {
    const scenarios: LegionScenario[] = [
      'legion',
      'matriarch',
      'vharun-cleave',
      'vharun-bloodmoon',
      'vharun-execution',
    ];
    for (const s of scenarios)
      for (const id of ids(legionHud(s))) expect(RIFT_HINTS, `${s}: ${id}`).not.toContain(id);
  });

  it('each Movement III threat names its verb; the rune and the cut hints are not answer hints', () => {
    const expected: Record<RiftScenario, string[]> = {
      'rift-cut': ['cut'],
      'rift-rune': ['rune'],
      'rift-possessed': ['possessed', 'wraith'],
      'rift-sighting': ['possessed', 'wraith'],
      'rift-doom': ['doom', 'inhale'],
      seamstress: ['stitched'],
      'unweaver-snip': ['cut-coming', 'spindles'],
      'unweaver-unravel': ['unravel', 'verse'],
      'unweaver-mirror': ['mirror-ward', 'mimic'],
    };
    for (const [s, want] of Object.entries(expected) as [RiftScenario, string[]][])
      expect(ids(riftHud(s)), s).toEqual(expect.arrayContaining(want));
    expect(ANSWER_HINTS.has('rune')).toBe(false);
    expect(ANSWER_HINTS.has('cut')).toBe(false);
    for (const id of RIFT_HINTS.filter((h) => h !== 'rune' && h !== 'cut'))
      expect(ANSWER_HINTS.has(id), id).toBe(true);
    // Swap puts you in the Maw: the Inhale hint says so when Reel's slot plays it.
    const hud = riftHud('rift-doom');
    const swap = {
      ...hud,
      weaver: {
        ...hud.weaver,
        techniques: hud.weaver.techniques.map((t) =>
          t.key === 'reel' ? { ...t, variant: { id: 'swap', name: 'Swap' } as never } : t,
        ),
      },
    };
    const inhale = evaluateHints({
      ...swap,
      encounter: { ...swap.encounter, status: 'fighting' },
    }).find((h) => h.id === 'inhale')!;
    expect(inhale.text).toMatch(/Swap puts you in the Maw/);
  });

  it('never teaches Guard Strand', () => {
    for (const s of Object.keys({
      'rift-cut': 1,
      'rift-rune': 1,
      'rift-possessed': 1,
      'rift-doom': 1,
      seamstress: 1,
      'unweaver-snip': 1,
      'unweaver-unravel': 1,
      'unweaver-mirror': 1,
    }) as RiftScenario[]) {
      const hud = riftHud(s);
      for (const h of evaluateHints({
        ...hud,
        encounter: { ...hud.encounter, status: 'fighting' },
      }))
        expect(h.text).not.toMatch(/Guard Strand/);
    }
  });
});

describe('first sightings, Calling-aware', () => {
  it('every Unstitched foe has a lesson with answers; no Paradox or Guard Strand without it', () => {
    for (const id of RIFT_ENEMIES) {
      const s = sightingOf(id);
      expect(s.lesson.length, id).toBeGreaterThan(10);
      expect(s.answers.length, id).toBeGreaterThan(0);
      expect(s.lesson, id).not.toMatch(/Paradox|Guard Strand/);
      expect(sightingOf(id, true).lesson, id).not.toMatch(/Paradox|Guard Strand/);
    }
    expect(sightingOf('shears').answers).toContain('thread');
    expect(sightingOf('the_unweaver').answers).toContain('empower');
  });

  it('Paradox is named only when it is held; a Chronomancer’s cards never teach Reel', () => {
    expect(sightingOf('doubt_wraith', true, true).lesson).toMatch(/Paradox/);
    const maw = sightingOf('void_maw', true);
    expect(maw.lesson).toMatch(/Rewind takes back a hero you lost to the pull/);
    expect(maw.answers).not.toContain('reel');
    expect(sightingOf('void_maw').answers).toContain('reel');
    expect(sightingOf('null_priest', true).lesson).toMatch(/Rewind are refused/);
    for (const id of RIFT_ENEMIES) expect(sightingOf(id, true).answers, id).not.toContain('reel');
  });
});

describe('recaps', () => {
  it('a Movement III down names its answer in words; Movement I and II deaths keep theirs', () => {
    const d = (killer: string, answers?: string[]) => ({ heroId: 'lyra', killer, answers });
    expect(riftDownLine(d('Kael (possessed)', ['chime', 'focus']))).toBe(
      'Lyra, struck by Kael (possessed): Chime frees them',
    );
    expect(riftDownLine(d('Doom'))).toBe('Doom: Chime before five, or Ward the burst');
    expect(riftDownLine(d('Voided (Void Maw)', ['stack', 'reel', 'move']))).toBe(
      'Pulled into the Maw: Rally or Reel',
    );
    expect(riftDownLine(d('Voided (Void Maw)'), 'chronomancer')).toMatch(/Rewind/);
    expect(riftDownLine(d('Snip'))).toBe('Snip: Retarget off the line');
    expect(riftDownLine(d('Unravel — your Mend', ['empower']))).toBe(
      'Your Mend, unravelled: switch to Empower',
    );
    for (const k of ['Dirge', 'Bleed ×6 (Sanguine Hound)', 'Twin Cleave', 'Execution', 'Requiem'])
      expect(riftDownLine(d(k)), k).toBeNull();
    expect(deathAdviceLine({ ...d('Snip'), blood: undefined }, CONTENT.defaultParty)).toBe(
      'Snip: Retarget off the line',
    );
  });
});

describe('the Reliquary: a sleeping Rift relic', () => {
  it('reads "Wakes in the Abyssal Rift"; every other relic has no label', () => {
    for (const id of ['sacrificial_lamb', 'knotted_cord', 'stillwater_bell'])
      expect(wakesLabel(id), id).toBe('Wakes in the Abyssal Rift');
    for (const r of CONTENT.relics.filter((x) => x.movement === undefined))
      expect(wakesLabel(r.id), r.id).toBeNull();
    const v = relicView(mockRelic('u1', 'stillwater_bell'));
    expect(v.wakes).toBe('Wakes in the Abyssal Rift');
    expect(v.label).toMatch(/Wakes in the Abyssal Rift\.$/);
    expect(relicView(mockRelic('u2', 'wardens_key')).wakes).toBeNull();
  });
});

describe('input: the last-threaded fallback after an enemy cut', () => {
  let win: EventTarget;
  let input: InputController;
  const keyDown = (code: string) =>
    win.dispatchEvent(Object.assign(new Event('keydown'), { code, key: code, repeat: false }));
  const keyUp = (code: string) =>
    win.dispatchEvent(Object.assign(new Event('keyup'), { code, key: code, repeat: false }));

  beforeEach(() => {
    win = new EventTarget();
    (globalThis as unknown as { window: EventTarget }).window = win;
    input = new InputController(
      new EventTarget() as unknown as HTMLElement,
      () => false,
      () => {},
    );
  });
  afterEach(() => {
    input.dispose();
    useSettings.getState().update((d) => ({ ...d, bindings: {} }));
    delete (globalThis as unknown as { window?: EventTarget }).window;
  });

  it('only after an enemy cut, for its seconds, to the hero the Thread was on', () => {
    const sim = createSim({ seed: 1 });
    sim.step([]);
    // No Thread, no cut: Ward has no target (the sim refuses it, as ever).
    input.updatePointer(sim.state);
    keyDown('KeyQ');
    keyUp('KeyQ');
    expect(input.collect()).toEqual([{ t: 'tech', id: 'ward' }]);
    // An enemy cut the Thread off Lyra (slot 1): Ward and Reel go to her for a few seconds.
    const lyra = sim.state.party[1]!;
    input.onThreadCut({ target: lyra, at: sim.state.time });
    input.updatePointer(sim.state);
    keyDown('KeyQ');
    keyUp('KeyQ');
    keyDown('KeyF');
    keyUp('KeyF');
    expect(input.collect()).toEqual([
      { t: 'tech', id: 'ward', slot: 1 },
      { t: 'tech', id: 'reel', slot: 1 },
    ]);
    // Chime and Cue keep their own targeting.
    keyDown('KeyE');
    keyUp('KeyE');
    expect(input.collect()[0]).not.toHaveProperty('slot');
    // Past the fallback, Ward has no target again.
    const steps = Math.ceil((CUT_FALLBACK_SECONDS + 0.1) * 60);
    for (let i = 0; i < steps; i++) sim.step([]);
    input.updatePointer(sim.state);
    keyDown('KeyQ');
    keyUp('KeyQ');
    expect(input.collect()).toEqual([{ t: 'tech', id: 'ward' }]);
  });

  it('a hovered or threaded hero still wins over the fallback', () => {
    const sim = createSim({ seed: 1 });
    sim.step([{ t: 'thread', slot: 2 }]);
    input.onThreadCut({ target: sim.state.party[1]!, at: sim.state.time });
    input.updatePointer(sim.state);
    keyDown('KeyQ');
    keyUp('KeyQ');
    expect(input.collect()).toEqual([{ t: 'tech', id: 'ward', slot: 2 }]);
  });
});
