/**
 * Phase 3c UI: the Luminary (docs/phase-3c.md, docs/phase-3c/ui.md). Numbers come from
 * content (`callingDef`, `optionText`), the run (`CALLING_ROWS`, `fieldAuraSlots`,
 * `chordsAllowed`) and the sim (`WorldState.calling`, `radianceOf`).
 */
import { describe, expect, it } from 'vitest';
import { CONTENT, callingDef, callingOption, optionText } from '../src/content';
import { EVERYTHING, allowanceFor, unlockRank, UNLOCKS } from '../src/meta/profile';
import * as Run from '../src/meta/run';
import type { ChordLoadout, RunState } from '../src/meta/types';
import { createSim, type Sim } from '../src/sim';
import { radianceOf } from '../src/sim/combat/health';
import type { World } from '../src/sim/world';
import { buildHudSnapshot } from '../src/ui/hudBridge';
import { callingHud, callingHudLabel, popcount, shineLabel, shineOf } from '../src/ui/hud/calling';
import {
  callingOfferRun,
  callingResultRun,
  callingSummaryRun,
  fakeOutcome,
  luminaryRun,
  mockCallingSource,
  mockHud,
} from '../src/ui/lab/mock';
import { auraSlotsFor, isBonusSlot, loadoutProblems } from '../src/ui/screens/chordModel';
import {
  AXIS_LOOK,
  OPTION_AXIS,
  callingParts,
  callingResultLine,
  callingTierAt,
  milestoneLine,
  nextTier,
  numeral,
  pathLabel,
  pathSteps,
  pathTipLines,
  slotBonus,
  tierWhen,
  tierWhenList,
  withOption,
} from '../src/ui/screens/callingText';
import { nextStep } from '../src/ui/screens/interlude';
import { callingLine, statLines } from '../src/ui/screens/resultText';
import { unlockIcon } from '../src/ui/screens/rankText';

const LUMINARY = callingDef('luminary');
const step = (sim: Sim, ticks: number, commands: Parameters<Sim['step']>[0] = []) => {
  for (let i = 0; i < ticks; i++) {
    sim.step(i === 0 ? commands : []);
    sim.drainEvents();
  }
};
const GUARDIAN: ChordLoadout[] = [
  { auras: ['fortissimo'], ornaments: [] },
  { auras: ['sostenuto'], ornaments: [] },
];

describe('Radiance on the party frames', () => {
  it('shine = radiance per aura × auras heard (× Sunrise), only in the field', () => {
    const c = { radiancePerAura: 0.04, sunriseMult: 3 };
    expect(popcount(0)).toBe(0);
    expect(popcount(0b1011)).toBe(3);
    expect(shineOf({ inField: true, auraMask: 0b11 }, c, false)).toBeCloseTo(0.08, 9);
    expect(shineOf({ inField: true, auraMask: 0b11 }, c, true)).toBeCloseTo(0.24, 9);
    expect(shineOf({ inField: false, auraMask: 0b11 }, c, true)).toBe(0);
    expect(shineOf({ inField: true, auraMask: 0 }, c, false)).toBe(0);
    expect(shineOf({ inField: true, auraMask: 0b11 }, null, false)).toBe(0);
    expect(shineLabel(0.08)).toBe('+8%');
    expect(shineLabel(0.24)).toBe('+24%');
    expect(shineLabel(0.005)).toBe('+0.5%');
  });

  it('the snapshot agrees with the sim’s own Radiance, in and out of Sunrise', () => {
    const sim = createSim({
      seed: 7,
      encounter: 'sandbox',
      debug: true,
      chords: GUARDIAN,
      calling: { id: 'luminary', path: ['haloed', 'searing_hymns'] },
    });
    step(sim, 2, [{ t: 'thread', slot: 1 }]);
    const w = sim.state as unknown as World;
    for (const sunrise of [false, true]) {
      w.field.crescendo = sunrise;
      const hud = buildHudSnapshot(sim.state, { seed: 7, hovered: null });
      expect(hud.calling).toMatchObject({
        id: 'luminary',
        sunrise,
        haloed: true,
        sovereign: false,
      });
      expect(hud.calling!.tiers.map((t) => t?.id ?? null)).toEqual([
        'haloed',
        'searing_hymns',
        null,
        null,
      ]);
      let shining = 0;
      for (const h of hud.party) {
        const e = w.entities.get(h.id)!;
        expect(h.radiance).toBeCloseTo(radianceOf(w, e), 9);
        if (h.radiance > 0) shining++;
      }
      expect(shining).toBeGreaterThan(0);
    }
    // Out of the field: no shine, whatever the beam pours.
    const lyra = w.entities.get(w.party[1]!)!;
    lyra.hero!.inField = false;
    expect(buildHudSnapshot(sim.state, { seed: 7, hovered: null }).party[1]!.radiance).toBe(0);
  });

  it('without a Calling the HUD shows none, and nobody shines', () => {
    const sim = createSim({ seed: 7, encounter: 'sandbox', debug: true, chords: GUARDIAN });
    step(sim, 2);
    const hud = buildHudSnapshot(sim.state, { seed: 7, hovered: null });
    expect(hud.calling).toBeNull();
    expect(hud.party.every((h) => h.radiance === 0)).toBe(true);
  });

  it('the chip shows Sovereign Symphony only when the sim says it holds', () => {
    const on = callingHud(
      mockCallingSource(['haloed', 'dawnward', 'third_voice', 'sovereign_symphony']),
      true,
    )!;
    expect(on.sovereign).toBe(true);
    expect(on.sunrise).toBe(true);
    expect(callingHudLabel(on)).toMatch(/Sunrise: Radiance ×3\./);
    expect(callingHudLabel(on)).toMatch(/Sovereign Symphony/);
    const early = callingHud(mockCallingSource(['wide_choir']), false)!;
    expect(early.haloed).toBe(false);
    expect(early.tiers.filter(Boolean)).toHaveLength(1);
  });

  it('the lab mocks: Kael and Vexis shine, Lyra (outside the field) doesn’t; Sunrise ×3', () => {
    const calm = mockHud('luminary');
    const sun = mockHud('luminary-sunrise');
    for (const hud of [calm, sun]) {
      expect(hud.calling).not.toBeNull();
      expect(hud.party.find((h) => h.name === 'Lyra')!.radiance).toBe(0);
      expect(hud.party.filter((h) => h.radiance > 0)).toHaveLength(2);
    }
    const vexis = (hud: typeof calm) => hud.party.find((h) => h.name === 'Vexis')!.radiance;
    expect(vexis(sun)).toBeCloseTo(vexis(calm) * sun.calling!.sunriseMult, 9);
    expect(mockHud('calm').calling).toBeNull();
  });
});

describe('the third field slot (Third Voice) in the song builder', () => {
  const threeInField: ChordLoadout[] = [
    { auras: ['fortissimo'], ornaments: [] },
    { auras: ['sostenuto', 'ostinato', 'allegro'], ornaments: ['grace_note'] },
  ];
  const threeOnBeam: ChordLoadout[] = [
    { auras: ['fortissimo', 'allegro', 'sostenuto'], ornaments: [] },
    { auras: [], ornaments: [] },
  ];

  it('the builder and the run agree on every loadout, slot count and allowance', () => {
    const loadouts = [
      threeInField,
      threeOnBeam,
      GUARDIAN,
      ...Run.CHORD_PRESETS.map((p) => p.chords),
    ];
    for (const chords of loadouts)
      for (const slots of [CONTENT.weaver.auraSlots, CONTENT.weaver.auraSlots + 1])
        for (const allowance of [EVERYTHING, allowanceFor(1), allowanceFor(5)])
          expect(
            loadoutProblems(chords, allowance, slots).length === 0,
            `${JSON.stringify(chords)} with ${slots} field slots`,
          ).toBe(Run.chordsAllowed(chords, allowance, slots));
  });

  it('three field auras need Third Voice; three on the beam never pass', () => {
    expect(loadoutProblems(threeInField)).toContain('The field song holds at most 2 auras.');
    expect(loadoutProblems(threeInField, EVERYTHING, 3)).toEqual([]);
    expect(Run.chordsLegal(threeInField, 3)).toBe(true);
    expect(Run.chordsLegal(threeInField)).toBe(false);
    expect(loadoutProblems(threeOnBeam, EVERYTHING, 3)).toContain(
      'The beam song holds at most 2 auras.',
    );
    expect(auraSlotsFor(0, 3)).toBe(CONTENT.weaver.auraSlots);
    expect(auraSlotsFor(1, 3)).toBe(3);
    expect(auraSlotsFor(1)).toBe(CONTENT.weaver.auraSlots);
    expect(isBonusSlot({ chord: 1, kind: 'aura', index: 2 })).toBe(true);
    expect(isBonusSlot({ chord: 1, kind: 'aura', index: 1 })).toBe(false);
    expect(isBonusSlot({ chord: 0, kind: 'aura', index: 2 })).toBe(false);
  });

  it('every retune site reads the run: Prep 2, after Third Voice 3, marked as its slot', () => {
    const prep = Run.setCalling(Run.newRun(7), 'luminary');
    expect(Run.fieldAuraSlots(prep)).toBe(CONTENT.weaver.auraSlots);
    expect(slotBonus(prep)).toBeNull();
    const offer = callingOfferRun(2);
    expect(offer.callingOffer!.options[0]).toBe('third_voice');
    // The tier screen previews the slot before the pick is made.
    const preview = withOption(offer, 2, 'third_voice');
    expect(Run.fieldAuraSlots(preview)).toBe(CONTENT.weaver.auraSlots + 1);
    expect(slotBonus(preview)).toEqual({
      name: 'Third Voice',
      icon: callingOption('third_voice').icon,
      callingId: 'luminary',
    });
    expect(slotBonus(withOption(offer, 2, 'lantern_bearer'))).toBeNull();
  });

  it('Retune (Third Voice) applies chords the builder calls legal; Keep my songs keeps them', () => {
    const offer = callingOfferRun(2);
    const slots = Run.fieldAuraSlots(withOption(offer, 2, 'third_voice'));
    expect(loadoutProblems(threeInField, EVERYTHING, slots)).toEqual([]);
    const retuned = Run.pickCalling(offer, 0, threeInField);
    expect(retuned.calling!.path[2]).toBe('third_voice');
    expect(retuned.chords[1]!.auras).toHaveLength(3);
    const kept = Run.pickCalling(offer, 0);
    expect(kept.calling!.path[2]).toBe('third_voice');
    expect(kept.chords).toEqual(offer.chords);
    // Lantern Bearer adds no slot: the same chords are refused, the pick still happens.
    const lantern = Run.pickCalling(offer, 1, threeInField);
    expect(lantern.calling!.path[2]).toBe('lantern_bearer');
    expect(lantern.chords).toEqual(offer.chords);
  });
});

describe('the path: pips, tooltips and when each tier comes', () => {
  it('names the milestones in the map’s terms', () => {
    expect(tierWhen(0)).toBe('after First Light');
    expect(tierWhen(1)).toBe(`after your fight at step ${Run.CALLING_ROWS[1]! + 1}`);
    expect(tierWhen(2)).toBe(`after your fight at step ${Run.CALLING_ROWS[2]! + 1}`);
    expect(tierWhen(3)).toBe('after the Bellwarden');
    expect(tierWhenList(LUMINARY.tiers.length)).toBe(
      `after First Light, your fights at steps ${Run.CALLING_ROWS[1]! + 1} and ${Run.CALLING_ROWS[2]! + 1}, and the Bellwarden`,
    );
    // Every map agrees: First Light and the Bellwarden are alone on their rows.
    for (const seed of [1, 7, 11, 4242])
      expect([0, 3].map((t) => tierWhen(t, Run.generateMap(seed)))).toEqual([
        'after First Light',
        'after the Bellwarden',
      ]);
    expect(numeral(0)).toBe('I');
    expect(numeral(3)).toBe('IV');
  });

  it('tooltip lines: chosen options with their text, open tiers with when and both options', () => {
    const calling = { id: 'luminary', path: ['haloed', null, null, null] };
    const lines = pathTipLines(calling);
    expect(lines).toHaveLength(LUMINARY.tiers.length);
    expect(lines[0]).toEqual({
      numeral: 'I',
      title: 'Haloed',
      text: optionText(callingOption('haloed')),
      chosen: true,
      icon: callingOption('haloed').icon,
    });
    expect(lines[1]).toMatchObject({
      title: `After your fight at step ${Run.CALLING_ROWS[1]! + 1}`,
      text: 'Choose Dawnward or Searing Hymns.',
      chosen: false,
    });
    expect(lines[3]!.text).toBe('Choose Sovereign Symphony or Eclipse.');
    expect(pathLabel(calling)).toBe(
      `The Luminary: Haloed. Next pick after your fight at step ${Run.CALLING_ROWS[1]! + 1}.`,
    );
    expect(nextTier(calling)).toEqual({ tier: 1, when: tierWhen(1) });
    const full = { id: 'luminary', path: ['haloed', 'dawnward', 'third_voice', 'eclipse'] };
    expect(nextTier(full)).toBeNull();
    expect(pathLabel(full)).toMatch(/The path is complete\.$/);
  });

  it('the tier screen: taken tiers lit, the one on offer, the rest open', () => {
    const run = callingOfferRun(2);
    const steps = pathSteps(run.calling!, { offerTier: run.callingOffer!.tier, map: run.map });
    expect(steps.map((s) => s.state)).toEqual(['chosen', 'chosen', 'offer', 'open']);
    expect(steps[0]!.chosen!.id).toBe('haloed');
    expect(steps[2]!.options.map((o) => o.id)).toEqual(run.callingOffer!.options);
  });

  it('every option has an axis, as the design names them', () => {
    const ids = LUMINARY.tiers.flatMap((t) => t.options.map((o) => o.id));
    for (const id of ids) expect(Object.keys(AXIS_LOOK)).toContain(OPTION_AXIS[id]);
    expect(ids.filter((id) => OPTION_AXIS[id] === 'protect')).toEqual(['haloed', 'dawnward']);
    expect(ids.filter((id) => OPTION_AXIS[id] === 'radiance')).toEqual([
      'searing_hymns',
      'lantern_bearer',
      'eclipse',
    ]);
  });
});

describe('the map: fights that grow the Calling', () => {
  it('marks every fight on a milestone row whose tier is open, never events', () => {
    const run = Run.embark(Run.setCalling(Run.newRun(7), 'luminary'));
    for (const node of run.map.rows.flat()) {
      const tier = callingTierAt(run, node);
      const milestone =
        Run.CALLING_ROWS.includes(node.row) && !!node.encounterId && node.kind !== 'event';
      expect(tier !== null, node.id).toBe(milestone);
      if (tier !== null) {
        expect(tier).toBe(Run.CALLING_ROWS.indexOf(node.row));
        expect(milestoneLine(run, node)).toEqual({
          title: 'Your Calling grows after this fight',
          text: `Tier ${numeral(tier)}: ${LUMINARY.tiers[tier]!.options.map((o) => o.name).join(' or ')}.`,
        });
      }
    }
    // Without a Calling, nothing is marked.
    const plain = Run.embark(Run.newRun(7));
    expect(plain.map.rows.flat().some((n) => callingTierAt(plain, n) !== null)).toBe(false);
  });

  it('agrees with the run: a marked fight won leads to that tier, and the mark goes', () => {
    let run: RunState = Run.embark(Run.setCalling(Run.newRun(7), 'luminary'));
    const first = Run.reachable(run)[0]!;
    expect(callingTierAt(run, first)).toBe(0);
    run = Run.chooseNode(run, first.id);
    run = Run.finishCombat(run, fakeOutcome(run, true));
    expect(nextStep(run)).toBe('Continue: your Calling grows');
    run = Run.continueFromResult(run);
    expect(run.phase).toBe('calling');
    expect(run.callingOffer!.tier).toBe(0);
    run = Run.pickCalling(run, 0);
    expect(callingTierAt(run, first)).toBeNull();
    // A fight on another row grows nothing.
    const later = luminaryRun({ picks: ['haloed'], fights: 2 });
    const next = Run.reachable(later).find((n) => n.encounterId)!;
    if (!Run.CALLING_ROWS.includes(next.row)) expect(callingTierAt(later, next)).toBeNull();
  });
});

describe('Result and Summary', () => {
  it('the Calling line names the path and leaves out what did nothing', () => {
    expect(
      callingResultLine(
        { callingAmplified: 412, callingShielded: 96 },
        { path: ['haloed', null, null, null] },
      ),
    ).toBe('Radiance: +412 damage through your heroes · Haloed: 96 damage kept off');
    expect(
      callingResultLine(
        { callingAmplified: 1250, callingShielded: 0 },
        { path: ['wide_choir', 'searing_hymns', 'third_voice', 'eclipse'] },
      ),
    ).toBe('Radiance and Eclipse: +1,250 damage through your heroes');
    expect(
      callingResultLine({ callingAmplified: 0, callingShielded: 40 }, { path: ['haloed'] }),
    ).toBe('Haloed: 40 damage kept off');
    expect(callingResultLine({ callingAmplified: 0, callingShielded: 0 }, null)).toBeNull();
    expect(callingLine({ callingAmplified: 0, callingShielded: 0 }, null)).toBeNull();
    expect(callingParts({ callingAmplified: 3, callingShielded: 0 }, null)[0]!.label).toBe(
      'Radiance',
    );
  });

  it('the Result shows the line after the songs’ lines, and only with something to say', () => {
    const run = callingResultRun();
    const r = run.lastResult!;
    expect(r.stats.callingAmplified).toBeGreaterThan(0);
    const lines = statLines(r, run.calling);
    const at = lines.findIndex((l) => l.calling);
    expect(at).toBe(2);
    expect(lines[at]!.text).toBe(`${callingResultLine(r.stats, run.calling)!}.`);
    expect(nextStep(run)).toBe('Continue: your Calling grows');
    const quiet = { ...r, stats: { ...r.stats, callingAmplified: 0, callingShielded: 0 } };
    expect(statLines(quiet, run.calling).some((l) => l.calling)).toBe(false);
  });

  it('the Summary totals the run and keeps the four picks', () => {
    const run = callingSummaryRun();
    const totals = Run.runTotals(run);
    expect(run.calling!.path).toEqual(['haloed', 'searing_hymns', 'third_voice', 'eclipse']);
    expect(totals.callingAmplified).toBe(
      run.results.reduce((n, r) => n + r.stats.callingAmplified, 0),
    );
    expect(callingParts(totals, run.calling).map((p) => p.label)).toEqual([
      'Radiance and Eclipse',
      'Haloed',
    ]);
  });
});

describe('Rank 7', () => {
  it('the Luminary unlocks at its content Rank, with its own glyph on the rank-up card', () => {
    const unlock = UNLOCKS.find((u) => u.kind === 'calling' && u.target === 'luminary')!;
    expect(unlock.rank).toBe(LUMINARY.unlockRank);
    expect(unlockRank('calling', 'luminary')).toBe(LUMINARY.unlockRank);
    expect(unlockIcon(unlock)).toBe('sun');
    expect(allowanceFor(LUMINARY.unlockRank - 1).callings.has('luminary')).toBe(false);
    expect(allowanceFor(LUMINARY.unlockRank).callings.has('luminary')).toBe(true);
    // Prep's picker refuses a locked Calling the same way the run does.
    const locked = Run.setCalling(Run.newRun(7), 'luminary', allowanceFor(1));
    expect(locked.calling).toBeNull();
  });
});
