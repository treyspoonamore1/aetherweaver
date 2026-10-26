/**
 * Phase 3d UI: the Martyr (docs/phase-3d.md, docs/phase-3d/ui.md). Numbers come from content
 * (`callingDef`, `optionText`), the run (`reservePool`, `chordsAllowed`) and the sim
 * (`WeaverComponent.maxLife` / `reservedLife`, `WorldState.calling`, `FieldState.vow`).
 */
import { describe, expect, it } from 'vitest';
import { CONTENT, callingDef, callingOption } from '../src/content';
import { COLOR_VISIONS, deltaE, simulateVision } from '../src/app/colorVision';
import { EVERYTHING, MAX_RANK, allowanceFor, unlockRank, UNLOCKS } from '../src/meta/profile';
import * as Run from '../src/meta/run';
import type { ChordLoadout } from '../src/meta/types';
import { LIFE_RESERVE_CAP, createSim, type Sim } from '../src/sim';
import type { World } from '../src/sim/world';
import { buildHudSnapshot } from '../src/ui/hudBridge';
import { callingHud, callingHudLabel, lifeMarksOf } from '../src/ui/hud/calling';
import { evaluateHints } from '../src/ui/hud/hints';
import { CALLING_GLYPHS } from '../src/ui/kit/callingGlyphs';
import { CALLING_LOOK } from '../src/ui/kit/callingLook';
import {
  GUARDIAN_CHORDS,
  MARTYR_PICKS,
  OVER_LIFE_CHORDS,
  martyrOfferRun,
  martyrResultRun,
  martyrSummaryRun,
  mockHud,
  mockMartyrSource,
  mockMartyrWeaver,
  mockRankUps,
} from '../src/ui/lab/mock';
import { loadoutProblems, spiritBudget, weaverLifeFor } from '../src/ui/screens/chordModel';
import {
  belowNote,
  callingAxes,
  callingNothingText,
  callingParts,
  callingResultLine,
  crescendoLine,
  crescendoName,
  lowLifeMarks,
  optionAxes,
  passiveName,
} from '../src/ui/screens/callingText';
import { nextStep } from '../src/ui/screens/interlude';
import { callingLine, statLines } from '../src/ui/screens/resultText';
import { rankPanel, runRank, unlockIcon } from '../src/ui/screens/rankText';
import { telegraphOn } from './sim/helpers';

const MARTYR = callingDef('martyr');
const LUMINARY = callingDef('luminary');
const hud = (sim: Sim) => buildHudSnapshot(sim.state, { seed: 7, hovered: null });
const step = (sim: Sim, ticks: number, commands: Parameters<Sim['step']>[0] = []) => {
  for (let i = 0; i < ticks; i++) {
    sim.step(i === 0 ? commands : []);
    sim.drainEvents();
  }
};
const martyrSim = (path: string[] = [], chords: readonly ChordLoadout[] = GUARDIAN_CHORDS) =>
  createSim({
    seed: 7,
    encounter: 'sandbox',
    debug: true,
    chords: chords.map((c) => ({ auras: [...c.auras], ornaments: [...c.ornaments] })),
    calling: { id: 'martyr', path },
  });

describe('the Life budget (song builder on a Martyr run)', () => {
  const loadouts: readonly (readonly ChordLoadout[])[] = [
    GUARDIAN_CHORDS,
    OVER_LIFE_CHORDS,
    ...Run.CHORD_PRESETS.map((p) => p.chords),
    [
      { auras: ['fortissimo', 'allegro'], ornaments: [] },
      { auras: ['ostinato', 'sostenuto'], ornaments: [] },
    ],
  ];

  it('the builder and the run agree on every loadout, pool, slot count and allowance', () => {
    let lifeOnlyRejected = 0;
    for (const chords of loadouts)
      for (const pool of ['spirit', 'life'] as const)
        for (const slots of [CONTENT.weaver.auraSlots, CONTENT.weaver.auraSlots + 1])
          for (const allowance of [EVERYTHING, allowanceFor(1), allowanceFor(5)]) {
            const ui = loadoutProblems(chords, allowance, slots, pool).length === 0;
            expect(ui, `${JSON.stringify(chords)} · ${pool} · ${slots}`).toBe(
              Run.chordsAllowed(chords, allowance, slots, pool),
            );
            if (
              pool === 'life' &&
              !ui &&
              loadoutProblems(chords, allowance, slots, 'spirit').length === 0
            )
              lifeOnlyRejected++;
          }
    // Some loadout is legal for Spirit and not for the Martyr's Life (the 90% cap).
    expect(lifeOnlyRejected).toBeGreaterThan(0);
  });

  it('more than 90% of her Life: the sim’s sentence, and Spirit would have allowed it', () => {
    expect(loadoutProblems(OVER_LIFE_CHORDS, EVERYTHING, 2, 'spirit')).toEqual([]);
    const problems = loadoutProblems(OVER_LIFE_CHORDS, EVERYTHING, 2, 'life');
    expect(problems).toContain('Your songs would leave you less than a tenth of your Life.');
    const b = spiritBudget(OVER_LIFE_CHORDS, 'life', 'martyr');
    expect(b.over).toBe(true);
    expect(b.cap).toBeCloseTo(b.max * LIFE_RESERVE_CAP, 9);
    expect(spiritBudget(GUARDIAN_CHORDS, 'life', 'martyr').over).toBe(false);
  });

  it('every retune site reads the pool from the run: Prep follows the Calling chosen', () => {
    const prep = Run.newRun(7, GUARDIAN_CHORDS);
    expect(Run.reservePool(prep)).toBe('spirit');
    expect(Run.reservePool(Run.setCalling(prep, 'martyr'))).toBe('life');
    expect(Run.reservePool(Run.setCalling(prep, 'luminary'))).toBe('spirit');
    const offer = martyrOfferRun(1);
    expect(Run.reservePool(offer)).toBe('life');
    // Prep keeps Spirit songs the Martyr can't hold, and says so; embark resets them.
    const over = Run.setChords(prep, OVER_LIFE_CHORDS);
    const chosen = Run.setCalling(over, 'martyr');
    expect(loadoutProblems(chosen.chords, EVERYTHING, 2, Run.reservePool(chosen))).toHaveLength(1);
  });

  it('her Life and what her songs hold match a real sim, Spirit all free', () => {
    const sim = martyrSim();
    const e = sim.state.entities.get(sim.state.weaverId)!;
    expect(weaverLifeFor('martyr')).toBeCloseTo(e.weaver!.maxLife, 9);
    expect(weaverLifeFor('luminary')).toBe(CONTENT.weaver.maxLife);
    expect(weaverLifeFor(null)).toBe(CONTENT.weaver.maxLife);
    const b = spiritBudget(GUARDIAN_CHORDS, 'life', 'martyr');
    expect(b.reserved).toBeCloseTo(e.weaver!.reservedLife, 6);
    expect(b.free).toBeCloseTo(e.health!.maxHp, 6);
    expect(e.weaver!.reservedSpirit).toBe(0);
    expect(b.spirit).toBe(CONTENT.weaver.maxSpirit);
    expect(b.techniques.every((t) => t.affordable)).toBe(true);
    // The Spirit budget is as before.
    const spirit = spiritBudget(GUARDIAN_CHORDS);
    expect(spirit.pool).toBe('spirit');
    expect(spirit.max).toBe(CONTENT.weaver.maxSpirit);
    expect(spirit.spirit).toBe(spirit.free);
  });

  it('Blood Font and Vigil: the marks come from content, and the tier screen says when they wake', () => {
    const marks = lowLifeMarks(MARTYR_PICKS);
    expect(marks.map((m) => m.id)).toEqual(['low_life_vigil', 'blood_font']);
    expect(marks[0]!.below).toBe(callingOption('low_life_vigil').values.below! / 100);
    expect(marks[1]!.below).toBe(callingOption('blood_font').values.below! / 100);
    expect(lowLifeMarks(['penitence', 'shared_wounds', null, null])).toEqual([]);
    // Guardian holds 55%: below half from the start, so Blood Font is always on.
    const font = belowNote(callingOption('blood_font'), GUARDIAN_CHORDS)!;
    expect(font.always).toBe(true);
    expect(font.text).toMatch(/Your songs hold 55% of your Life/);
    const vigil = belowNote(callingOption('low_life_vigil'), GUARDIAN_CHORDS)!;
    expect(vigil.always).toBe(false);
    expect(vigil.text).toMatch(/wakes after you lose 10% of it/);
    expect(belowNote(callingOption('penitence'), GUARDIAN_CHORDS)).toBeNull();
  });
});

describe('the HUD on a Martyr run (from a real sim)', () => {
  it('her Life: all of it, what the songs hold (hatched), what she fights with; Spirit free', () => {
    const sim = martyrSim(['scarred_hide', 'blood_font', 'low_life_vigil']);
    step(sim, 2);
    const h = hud(sim);
    const w = sim.state.entities.get(sim.state.weaverId)!;
    expect(h.weaver.pool).toBe('life');
    expect(h.weaver.lifeTotal).toBe(w.weaver!.maxLife);
    expect(h.weaver.reservedLife).toBe(w.weaver!.reservedLife);
    expect(h.weaver.maxLife).toBe(w.health!.maxHp);
    expect(h.weaver.reserved).toBe(0);
    expect(h.weaver.lifeTotal).toBeCloseTo(h.weaver.maxLife + h.weaver.reservedLife, 6);
    // Marks at their share of all her Life; Guardian starts her below Blood Font's half.
    const font = h.weaver.lifeMarks.find((m) => m.id === 'blood_font')!;
    const vigil = h.weaver.lifeMarks.find((m) => m.id === 'low_life_vigil')!;
    expect(font.at).toBeCloseTo(w.weaver!.maxLife * 0.5, 6);
    expect(font.active).toBe(true);
    expect(vigil.active).toBe(w.health!.hp < vigil.at);
    // Hurt her below Vigil: both lit, and the chip says so.
    (sim.state as unknown as World).entities.get(sim.state.weaverId)!.health!.hp = vigil.at - 1;
    const low = hud(sim);
    expect(low.weaver.lifeMarks.every((m) => m.active)).toBe(true);
    expect(low.calling!.lowLife.filter((m) => m.active)).toHaveLength(2);
    expect(callingHudLabel(low.calling!)).toMatch(/Low-Life Vigil: on\./);
  });

  it('Bear: the read-out, the Borne mark on the threaded hero only, and back again', () => {
    const sim = martyrSim();
    step(sim, 2, [{ t: 'thread', slot: 1 }]);
    expect(hud(sim).weaver.threadMode).toBe('mend');
    step(sim, 2, [{ t: 'mode', mode: 'bear' }]);
    const h = hud(sim);
    const share = sim.state.calling!.bearShare;
    expect(share).toBeGreaterThan(0);
    expect(h.weaver.threadMode).toBe('bear');
    expect(h.weaver.lastMode).toBe('mend');
    expect(h.weaver.bearShare).toBe(share);
    expect(h.party.map((p) => p.borne)).toEqual(h.party.map((p) => (p.slot === 1 ? share : 0)));
    expect(h.calling!.bearing).toBe(true);
    expect(callingHudLabel(h.calling!)).toMatch(/Bearing: you take 35% of your threaded hero/);
    // Right-click from Bear goes back to the mode Bear left.
    step(sim, 2, [{ t: 'mode' }]);
    const back = hud(sim);
    expect(back.weaver.threadMode).toBe('mend');
    expect(back.party.every((p) => p.borne === 0)).toBe(true);
    expect(back.calling!.bearing).toBe(false);
  });

  it('the Vow: named as the Calling’s own Crescendo, every hero held, Sunrise untouched', () => {
    const sim = martyrSim(['penitence', 'shared_wounds', 'undying_devotion']);
    step(sim, 2);
    const world = sim.state as unknown as World;
    world.field.vow = true;
    world.entities.get(world.weaverId)!.weaver!.crescendo = 4;
    const h = hud(sim);
    expect(h.weaver.vow).toBe(true);
    expect(h.weaver.crescendoName).toBe(MARTYR.crescendoName);
    expect(h.calling!.crescendo).toBe('vow');
    expect(h.calling!.vow).toBe(true);
    expect(h.calling!.sunrise).toBe(false);
    expect(h.party.every((p) => p.vow)).toBe(true);
    expect(h.calling!.undying).toBe('ready');
    world.entities.get(world.weaverId)!.weaver!.undying = false;
    expect(hud(sim).calling!.undying).toBe('spent');
    expect(callingHudLabel(hud(sim).calling!)).toMatch(/Undying Devotion: spent/);
  });

  it('the Vow: no hero reads LETHAL while it will outlast every hit on the board', () => {
    const sim = martyrSim();
    step(sim, 2);
    const world = sim.state as unknown as World;
    const { telegraph } = telegraphOn('bell_brute', 'Toll Cleave', 0, 2.5, sim, true);
    // Kael's alone in the cleave (the Vow doesn't hold her), at 1 life.
    const weaver = world.entities.get(world.weaverId)!;
    weaver.x = weaver.px = 0;
    weaver.z = weaver.pz = 3;
    const kael = world.entities.get(world.party[0]!)!;
    kael.health!.hp = 1;
    step(sim, 1);
    expect(weaver.health!.incoming).toBe(0);
    expect(hud(sim).party[0]!.lethal).toBe(true);
    expect(telegraph.severity).toBe('lethal');
    world.field.vow = true;
    const clock = weaver.weaver!;
    clock.crescendo = 30;
    step(sim, 1);
    expect(hud(sim).party[0]!.lethal).toBe(false);
    expect(telegraph.severity).toBe('normal');
    // The Vow ends before the hit lands: the forecast warns again.
    clock.crescendo = (telegraph.impact - world.time) / 2;
    step(sim, 1);
    expect(hud(sim).party[0]!.lethal).toBe(true);
    expect(telegraph.severity).toBe('lethal');
  });

  it('without the Martyr: no Bear, Spirit pool, Sunrise by name', () => {
    const sim = createSim({
      seed: 7,
      encounter: 'sandbox',
      debug: true,
      chords: GUARDIAN_CHORDS.map((c) => ({ ...c, auras: [...c.auras] })),
      calling: { id: 'luminary', path: [] },
    });
    step(sim, 2, [{ t: 'thread', slot: 0 }]);
    const h = hud(sim);
    expect(h.weaver.pool).toBe('spirit');
    expect(h.weaver.bearShare).toBe(0);
    expect(h.weaver.reservedLife).toBe(0);
    expect(h.weaver.lifeTotal).toBe(h.weaver.maxLife);
    expect(h.weaver.crescendoName).toBe(CONTENT.crescendo.name);
    expect(h.calling!.crescendo).toBe('sunrise');
    expect(h.party.every((p) => p.borne === 0 && !p.vow)).toBe(true);
  });

  it('the coach introduces Bear on Martyr runs only; the key follows the binding', () => {
    const coach = mockHud('martyr-coach');
    const ids = evaluateHints(coach).map((x) => x.id);
    expect(ids).toContain('bear');
    expect(evaluateHints(coach).find((x) => x.id === 'bear')!.text).toMatch(
      /^\{B\} Bear — take part of the big hit coming at Kael/,
    );
    expect(ids).toContain('bear-intro');
    const intro = evaluateHints(coach).find((x) => x.id === 'bear-intro')!;
    expect(intro.text).toMatch(/^\{B\}: Bear — take part of a big hit on your threaded hero/);
    for (const scenario of ['calm', 'luminary', 'crisis'] as const)
      expect(evaluateHints(mockHud(scenario)).some((x) => x.id.startsWith('bear'))).toBe(false);
    // In the Vow, the coach names it.
    expect(evaluateHints(mockHud('martyr-vow')).find((x) => x.id === 'vow')!.text).toMatch(
      /^Martyr’s Vow: your heroes can’t fall below 1 life/,
    );
  });

  it('the lab mocks read a real sim: Life, what the songs hold, Bear', () => {
    const me = mockMartyrWeaver(['scarred_hide']);
    for (const s of ['martyr-coach', 'martyr-bear', 'martyr-vow', 'martyr-low'] as const) {
      const h = mockHud(s);
      expect(h.weaver.lifeTotal).toBe(me.maxLife);
      expect(h.weaver.reservedLife).toBe(me.reservedLife);
      expect(h.calling!.id).toBe('martyr');
    }
    expect(mockHud('martyr-bear').party[0]!.borne).toBe(mockMartyrSource([]).bearShare);
    expect(mockHud('martyr-low').weaver.lifeMarks.every((m) => m.active)).toBe(true);
    expect(lifeMarksOf(['blood_font'], 400, 720)).toEqual([
      expect.objectContaining({ id: 'blood_font', at: 360, active: false }),
    ]);
    expect(callingHud(mockMartyrSource([]), false)!.crescendoName).toBe(MARTYR.crescendoName);
  });
});

describe('the Martyr’s words', () => {
  it('the Result line: what she bore and what was kept off them; the Luminary’s unchanged', () => {
    const martyr = { id: 'martyr', path: [null, null, null, null] };
    expect(
      callingResultLine({ callingAmplified: 0, callingShielded: 1280, callingBorne: 640 }, martyr),
    ).toBe('Bore 640 for your heroes · 1,280 kept off them');
    expect(
      callingResultLine({ callingAmplified: 0, callingShielded: 0, callingBorne: 75 }, martyr),
    ).toBe('Bore 75 for your heroes');
    expect(
      callingResultLine({ callingAmplified: 0, callingShielded: 0, callingBorne: 0 }, martyr),
    ).toBeNull();
    expect(
      callingResultLine(
        { callingAmplified: 412, callingShielded: 96, callingBorne: 0 },
        { id: 'luminary', path: ['haloed'] },
      ),
    ).toBe('Radiance: +412 damage through your heroes · Haloed: 96 damage kept off');
    const line = callingLine(
      { callingAmplified: 0, callingShielded: 10, callingBorne: 5 },
      martyr,
    )!;
    expect(line).toMatchObject({ icon: 'drop', calling: true });
    expect(line.text).toBe('Bore 5 for your heroes · 10 kept off them.');
    expect(
      callingParts({ callingAmplified: 0, callingShielded: 9, callingBorne: 3 }, martyr),
    ).toEqual([
      expect.objectContaining({
        label: 'Borne',
        figure: '3',
        caption: 'damage you bore for your heroes',
      }),
      expect.objectContaining({ label: 'Kept off', figure: '9' }),
    ]);
    expect(callingNothingText('martyr', 'B')).toMatch(/press B to Bear/);
  });

  it('a Martyr run’s Result carries her line after the songs, and Continue leads to the tier', () => {
    const run = martyrResultRun();
    const r = run.lastResult!;
    expect(r.stats.callingBorne).toBeGreaterThan(0);
    const lines = statLines(r, run.calling);
    const i = lines.findIndex((l) => l.calling);
    expect(i).toBe(2);
    expect(lines[i]!.text).toMatch(/^Bore [\d,]+ for your heroes · [\d,]+ kept off them\.$/);
    expect(nextStep(run)).toMatch(/Calling grows/);
  });

  it('the Summary lists her path and totals', () => {
    const run = martyrSummaryRun();
    expect(run.calling!.path).toEqual([...MARTYR_PICKS]);
    const totals = Run.runTotals(run);
    expect(totals.callingBorne).toBeGreaterThan(0);
    const parts = callingParts(totals, run.calling);
    expect(parts.map((p) => p.label)).toEqual(['Borne', 'Kept off']);
  });

  it('the Crescendo line names the Vow once, and Sunrise is set in bold the same way', () => {
    expect(crescendoName(MARTYR)).toBe(MARTYR.crescendoName);
    expect(crescendoName(LUMINARY)).toBe(CONTENT.crescendo.name);
    const vow = crescendoLine(MARTYR);
    expect(vow.name).toBe(MARTYR.crescendoName);
    expect(vow.lead).toBe(false);
    expect(vow.rest.startsWith(' replaces Sunrise')).toBe(true);
    const sun = crescendoLine(LUMINARY);
    expect(sun.name).toBe('Sunrise');
    expect(passiveName('martyr')).toMatch(/Bear/);
    expect(passiveName('luminary')).toBe('Radiance');
  });

  it('every Martyr option has its design axis; the Codex legend has her three', () => {
    for (const t of MARTYR.tiers)
      for (const o of t.options) expect(optionAxes(o.id).length).toBeGreaterThan(0);
    expect(optionAxes('blood_font')).toEqual(['endure', 'lowlife']);
    expect(new Set(callingAxes(MARTYR))).toEqual(new Set(['endure', 'share', 'lowlife']));
    expect(new Set(callingAxes(LUMINARY))).toEqual(new Set(['protect', 'reach', 'radiance']));
  });
});

describe('the Martyr’s look and glyphs', () => {
  it('a glyph for the emblem and every option icon', () => {
    expect(CALLING_GLYPHS[MARTYR.icon]).toBeTruthy();
    for (const t of MARTYR.tiers)
      for (const o of t.options) expect(CALLING_GLYPHS[o.icon]).toBeTruthy();
  });

  it('her blood reads apart from the Luminary’s gold and the relic rarities, in every palette', () => {
    const martyr = CALLING_LOOK.martyr!.color;
    const others = [
      CALLING_LOOK.luminary!.color,
      CALLING_LOOK.luminary!.light,
      // RELIC_RARITY in src/ui/kit/RelicGlyph.tsx (a .tsx module the node config can't load).
      '#cbd5e1',
      '#60a5fa',
      '#fdba74',
      '#fb7185',
    ];
    for (const vision of COLOR_VISIONS)
      for (const other of others)
        expect(
          deltaE(simulateVision(martyr, vision), simulateVision(other, vision)),
          `${martyr} vs ${other} (${vision})`,
        ).toBeGreaterThanOrEqual(20);
  });
});

describe('Rank 8', () => {
  it('opens the Martyr; the card, the allowance and the glyph follow content', () => {
    expect(unlockRank('calling', 'martyr')).toBe(MARTYR.unlockRank);
    expect(MAX_RANK).toBeGreaterThanOrEqual(MARTYR.unlockRank);
    const card = mockRankUps([MARTYR.unlockRank]);
    expect(card[0]!.unlocks.map((u) => u.id)).toContain('calling.martyr');
    expect(unlockIcon(UNLOCKS.find((u) => u.id === 'calling.martyr')!)).toBe('drop');
    expect(unlockIcon(UNLOCKS.find((u) => u.id === 'calling.luminary')!)).toBe('sun');
    expect(allowanceFor(MARTYR.unlockRank - 1).callings.has('martyr')).toBe(false);
    expect(allowanceFor(MARTYR.unlockRank).callings.has('martyr')).toBe(true);
    expect(
      Run.setCalling(Run.newRun(3), 'martyr', allowanceFor(MARTYR.unlockRank - 1)).calling,
    ).toBeNull();
  });

  it('the Rank panel and the run line cope with the top Rank', () => {
    const before = rankPanel({ xp: 1900, runs: 1, wins: 0 });
    expect(before.nextRank).toBe(8);
    expect(before.next.map((u) => u.id)).toContain('calling.martyr');
    const top = rankPanel({ xp: 99_999, runs: 1, wins: 0 });
    expect(top.rank).toBe(MAX_RANK);
    expect(top.span).toBeNull();
    expect(top.progressText).toMatch(/the highest Rank for now/);
    expect(runRank({ xp: 40 }, 99_999).line).toMatch(
      new RegExp(`Rank ${MAX_RANK} is the highest for now`),
    );
    expect(runRank({ xp: 40 }, 100).line).toMatch(/toward Rank 3\./);
  });
});
