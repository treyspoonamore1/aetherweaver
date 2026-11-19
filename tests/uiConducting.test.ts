/**
 * Phase 5f UI: the Conductor (docs/phase-5f.md, "Contracts → UI"). Every rule the HUD shows is
 * the sim's own (`nextCue`, `beatAt`, `onBeat`, `finaleView`, `crescendoCostOf`), read from a real
 * sim; every number is content's (`callingDef('conductor')`) or the view's (`calling.conducting`).
 */
import { readFileSync } from 'node:fs';
import { createElement, type FunctionComponent } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { COLOR_VISIONS, deltaE, simulateVision } from '../src/app/colorVision';
import { CONTENT, callingDef } from '../src/content';
import { EVERYTHING, UNLOCKS, allowanceFor, unlockRank } from '../src/meta/profile';
import {
  BAR_SECONDS,
  beatAt,
  beatWait,
  createSim,
  crescendoCostOf,
  ensembleBonus,
  finaleTurnBlock,
  finaleView,
  marcatoOn,
  marcatoReadyIn,
  onBeat,
  resonanceScale,
  soloDueIn,
  soloQueue,
  type Command,
  type PartySlot,
  type Sim,
  type SimEvent,
} from '../src/sim';
import { buildHudSnapshot } from '../src/ui/hudBridge';
import { dealDamage } from '../src/sim/combat/health';
import type { World } from '../src/sim/world';
import {
  FINALE_TURNS_KEY,
  beatNow,
  beatStrip,
  ensembleMost,
  finaleTurnLabel,
  finaleTurnOf,
  finaleTurnSentence,
  liveBeat,
  marcatoHud,
  heardFinale,
  conductingCallouts,
  cueBadge,
  cueBadgeLabel,
  finalePips,
} from '../src/ui/hud/conducting';
import { evaluateHints } from '../src/ui/hud/hints';
import { CALLING_GLYPHS } from '../src/ui/kit/callingGlyphs';
import { CALLING_LOOK } from '../src/ui/kit/callingLook';
import { PATHS } from '../src/ui/kit/iconPaths';
import { conductResultRun, conductStage, conductSummaryRun } from '../src/ui/lab/conductingMock';
import {
  AXIS_LOOK,
  callingAxes,
  callingNothingText,
  callingParts,
  callingResultLine,
  conductingTip,
  crescendoLine,
  optionAxes,
  passiveName,
  powerLabel,
} from '../src/ui/screens/callingText';
import { deedGlyph } from '../src/ui/screens/deedsModel';
import { hudDissonanceView } from '../src/ui/screens/dissonanceModel';
import { unlockIcon } from '../src/ui/screens/rankText';
import { callingLine } from '../src/ui/screens/resultText';
import { runTotals } from '../src/meta/run';

/** A .tsx module's export, at run time (the node test build has no JSX to import statically). */
async function component<P>(name: string): Promise<FunctionComponent<P>> {
  const path = '../src/ui/hud/ConductParts';
  const mod = (await import(/* @vite-ignore */ path)) as Record<string, FunctionComponent<P>>;
  return mod[name]!;
}

const DEF = callingDef('conductor');
const V = DEF.values;
const GUARDIAN = [
  { auras: ['fortissimo'], ornaments: [] },
  { auras: ['sostenuto'], ornaments: [] },
];

/** A Conductor sandbox on `path`, Solos charged and the meter full. */
function conductSim(
  path: string[] = [],
  extra: { dissonance?: { id: string; rank: number }[] } = {},
) {
  const sim = createSim({
    seed: 7,
    encounter: 'sandbox',
    debug: true,
    chords: GUARDIAN.map((c) => ({ ...c, auras: [...c.auras] })),
    calling: { id: 'conductor', path, reviveSpent: false },
    ...extra,
  });
  const events: SimEvent[] = [];
  const step = (n: number, commands: Command[] = []) => {
    for (let i = 0; i < n; i++) {
      sim.step(i === 0 ? commands : []);
      events.push(...sim.drainEvents());
    }
  };
  step(1, [{ t: 'debug', op: { op: 'chargeSolos' } }]);
  step(1, [{ t: 'debug', op: { op: 'setResonance', value: CONTENT.resonance.max } }]);
  return { sim, step, events };
}
const cue = (slot: number): Command => ({
  t: 'debug',
  op: { op: 'fireSolo', slot: slot as PartySlot, cued: true },
});
const hud = (sim: Sim) => buildHudSnapshot(sim.state, { seed: 7, hovered: null });
/**
 * Brutes by the party, and stepped until every hero has one to fight: only then do their full
 * Solos count as coming (docs/solos.md). They fire a second apart from here, Lyra first.
 */
function engage(sim: Sim, step: (n: number, commands?: Command[]) => void) {
  const st = sim.state;
  step(
    1,
    [-3, 0, 3].map((x) => ({
      t: 'debug' as const,
      op: { op: 'spawnEnemy' as const, defId: 'bell_brute', x, z: -5 },
    })),
  );
  const fighting = () => st.party.every((id) => st.entities.get(id)!.hero!.targetId !== null);
  for (let i = 0; i < 240 && !fighting(); i++) step(1);
  expect(fighting()).toBe(true);
}
/** Steps until `pred`, at most `max` ticks; says whether it came. */
function stepUntil(step: (n: number) => void, pred: () => boolean, max = 600): boolean {
  for (let i = 0; i < max && !pred(); i++) step(1);
  return pred();
}
/** Steps until the sim's time is off the beat (no A Tempo needs none). */
function offBeat(sim: Sim, step: (n: number) => void) {
  for (let i = 0; i < 400 && onBeat(sim.state); i++) step(1);
}

describe('the Conductor’s look, glyphs and axes', () => {
  it('a glyph for the emblem and every option; the chain and finale kit icons', () => {
    expect(CALLING_GLYPHS[DEF.icon]).toBeTruthy();
    for (const t of DEF.tiers)
      for (const o of t.options) expect(CALLING_GLYPHS[o.icon], o.icon).toBeTruthy();
    expect(PATHS.chain).toBeTruthy();
    expect(PATHS.finale).toBeTruthy();
    // His emblem is not the Silent Conductor's baton.
    expect(CALLING_GLYPHS[DEF.icon]).not.toBe(PATHS.baton);
    expect(CALLING_LOOK.conductor).toMatchObject({ icon: 'chain', crescendoIcon: 'finale' });
    // Gold is the Weaver's: his accent is ink, his text and glyphs ivory.
    expect(CALLING_LOOK.conductor!.text).toBe(CALLING_LOOK.conductor!.light);
    for (const id of ['luminary', 'martyr', 'chronomancer'])
      expect(CALLING_LOOK[id]!.text, id).toBe(CALLING_LOOK[id]!.color);
  });

  it('every option has its axis; his legend is Lead them, In time, More Solos', () => {
    for (const t of DEF.tiers)
      for (const o of t.options) expect(optionAxes(o.id).length, o.id).toBe(1);
    expect(callingAxes(DEF)).toEqual(['lead', 'tempo', 'encore']);
    const axis = (id: string) => optionAxes(id)[0];
    expect(['marcato', 'ensemble', 'spotlight'].map(axis)).toEqual(['lead', 'lead', 'lead']);
    expect(['a_tempo', 'upbeat', 'triad'].map(axis)).toEqual(['tempo', 'tempo', 'tempo']);
    expect(['reprise', 'maestro'].map(axis)).toEqual(['encore', 'encore']);
    expect(AXIS_LOOK.lead.label).toBe('Lead them');
    expect(AXIS_LOOK.tempo.label).toBe('In time');
    expect(AXIS_LOOK.encore.label).toBe('More Solos');
    expect(AXIS_LOOK.lead.blurb).toBe('Your heroes hit harder');
    expect(AXIS_LOOK.tempo.blurb).toBe('The beat and the meter');
    expect(AXIS_LOOK.encore.blurb).toBe('Solos come round sooner');
  });

  it('his three axes are ΔE ≥ 25 apart in every colour-vision mode', () => {
    const colors = (['lead', 'tempo', 'encore'] as const).map((a) => AXIS_LOOK[a].color);
    for (const vision of COLOR_VISIONS)
      for (let i = 0; i < colors.length; i++)
        for (let j = i + 1; j < colors.length; j++)
          expect(
            deltaE(simulateVision(colors[i]!, vision), simulateVision(colors[j]!, vision)),
            `${colors[i]} vs ${colors[j]} (${vision})`,
          ).toBeGreaterThanOrEqual(25);
  });

  it('the passive’s name, the Crescendo line, and Rank 12 from content', () => {
    expect(passiveName('conductor')).toBe('Duets and Trios');
    const c = crescendoLine(DEF);
    expect(c.name).toBe(DEF.crescendoName);
    expect(c.rest.startsWith(' replaces Sunrise')).toBe(true);
    expect(unlockRank('calling', 'conductor')).toBe(DEF.unlockRank);
    expect(allowanceFor(DEF.unlockRank - 1).callings.has('conductor')).toBe(false);
    expect(allowanceFor(DEF.unlockRank).callings.has('conductor')).toBe(true);
    expect(EVERYTHING.callings.has('conductor')).toBe(true);
    expect(unlockIcon(UNLOCKS.find((u) => u.id === 'calling.conductor')!)).toBe('chain');
    // His badge takes his kit icon, as each Calling's does (no placeholder).
    const deed = CONTENT.deeds.find((d) => d.id === 'curtain_call')!;
    expect(deedGlyph(deed)).toBe(CALLING_LOOK.conductor!.icon);
  });
});

describe('the Duet and Trio badge, from the sim’s nextCue', () => {
  it('no badge for a plain Cue; Duet and Trio on a hero whose Solo is coming', () => {
    const { sim, step, events } = conductSim();
    const st = sim.state;
    const view = st.calling!.conducting!;
    const id = (slot: number) => st.party[slot]!;
    // No chain: a Cued Solo would be a plain Cue, which has no badge.
    expect(cueBadge(st, id(0))).toBeNull();
    step(30, [cue(0)]);
    for (const slot of [1, 2]) {
      const b = cueBadge(st, id(slot))!;
      expect(b).toEqual({ link: 2, power: view.duet, label: 'Duet', on: false });
    }
    expect(cueBadgeLabel(2)).toBe('Duet');
    expect(cueBadgeLabel(3)).toBe('Trio');
    // Nobody to fight: no Solo is coming, so no frame carries the badge yet.
    let h = hud(sim);
    expect(h.party.every((p) => p.soloIn === null && p.cue === undefined)).toBe(true);
    expect(h.conducting!.chain).toMatchObject({ link: 2, power: view.duet, heroes: ['Kael'] });
    expect(h.conducting!.chain!.total).toBe(view.chainWindow);
    // With someone to fight, Lyra's Solo is coming: her frame reads "Duet" (and Vexis's).
    engage(sim, step);
    h = hud(sim);
    expect(h.party[1]!.soloIn).toBeCloseTo(soloDueIn(st, st.entities.get(id(1))!)!, 9);
    expect(h.party[1]!.cue).toEqual({ link: 2, power: view.duet, label: 'Duet', on: false });
    expect(h.party[1]!.willCue).toBe(false);
    // The Thread on her as it fires: the Duet. Vexis's would be the Trio.
    step(1, [{ t: 'thread', slot: 1 }]);
    expect(hud(sim).party[1]!.willCue).toBe(true);
    expect(stepUntil(step, () => events.some((e) => e.type === 'cueChained' && e.link === 2))).toBe(
      true,
    );
    expect(cueBadge(st, id(2))).toEqual({ link: 3, power: view.trio, label: 'Trio', on: false });
    h = hud(sim);
    expect(h.party[2]!.cue?.label).toBe('Trio');
    expect(h.party[1]!.cue).toBeUndefined();
    expect(h.conducting!.chain!.link).toBe(3);
    // The window passes: the chain is gone, a Cued Solo starts a new one (no badge).
    step(Math.ceil((view.chainWindow + 0.2) * 60));
    expect(cueBadge(st, id(2))).toBeNull();
    expect(hud(sim).conducting!.chain).toBeNull();
  });

  it('the badge promises only what the Solo will be: none for a Solo due after the chain has closed', () => {
    // Vexis's Solo fires Cued and opens a chain. A second and a half later Lyra's Solo is
    // staged `charge` seconds from full, the Thread on her: due a second after that.
    const staged = (charge: number) => {
      const { sim, step, events } = conductSim();
      const st = sim.state;
      const solo = (slot: number) => st.entities.get(st.party[slot]!)!.hero!;
      const set = (slot: number, value: number) => {
        (solo(slot) as { solo: number }).solo = value;
      };
      // The Thread to a hero, the Weaver standing by them so that it holds.
      const threadTo = (slot: number): Command[] => {
        const e = st.entities.get(st.party[slot]!)!;
        return [
          { t: 'debug', op: { op: 'teleportWeaver', x: e.x, z: e.z + 2 } },
          { t: 'thread', slot: slot as PartySlot },
        ];
      };
      engage(sim, step);
      // Foes that outlast Starfall: there must be someone left for Lyra to fight.
      for (const e of (st as unknown as World).entities.list())
        if (e.enemy && e.health) e.health.hp = e.health.maxHp = 1e6;
      for (const slot of [0, 1]) set(slot, 0);
      step(1, threadTo(2));
      expect(
        stepUntil(step, () => {
          for (const slot of [0, 1]) set(slot, 0);
          return events.some((e) => e.type === 'cueChained');
        }),
      ).toBe(true);
      for (let i = 0; i < 90; i++) {
        set(0, 0);
        set(1, 0);
        step(1);
      }
      // What one tick of fighting charges, then `charge` seconds short of full.
      set(1, 0);
      step(1);
      expect(solo(1).solo).toBeGreaterThan(0);
      set(1, 100 - solo(1).solo * 60 * charge);
      step(1, threadTo(1));
      const shown: { soloIn: number; left: number | null; badge: string | null; on?: boolean }[] =
        [];
      const before = events.length;
      for (let i = 0; i < 300 && solo(1).soloActive <= 0; i++) {
        set(0, 0);
        const h = hud(sim);
        const v = h.party[1]!;
        expect(v.threaded).toBe(true);
        if (v.soloIn !== null && v.soloIn !== undefined)
          shown.push({
            soloIn: v.soloIn,
            left: h.conducting!.chain?.left ?? null,
            badge: v.cue?.label ?? null,
            on: v.cue?.on,
          });
        step(1);
      }
      const chained = events.slice(before).find((e) => e.type === 'cueChained');
      return { shown, link: chained?.type === 'cueChained' ? chained.link : null };
    };

    // Due 3 s after staging, 1.5 s into a 4 s window: the chain closes first. Her Solo is a
    // plain Cue (link 1), and her strip never said "Duet".
    const late = staged(2);
    expect(late.link).toBe(1);
    expect(late.shown.length).toBeGreaterThan(100);
    expect(late.shown.filter((s) => s.badge !== null)).toEqual([]);
    // The chain was open for part of that time: without the rule the badge would have shown.
    expect(late.shown.some((s) => s.left !== null && s.left > 0)).toBe(true);

    // Due 1.5 s after staging: inside the window. The badge says Duet all the way, filled
    // (the Thread is on her), and it is one.
    const soon = staged(0.5);
    expect(soon.link).toBe(2);
    expect(soon.shown.length).toBeGreaterThan(30);
    expect(soon.shown.every((s) => s.badge === 'Duet' && s.on === true)).toBe(true);
    // Whenever a badge showed, the Solo was due inside the chain's time left.
    for (const s of [...late.shown, ...soon.shown])
      if (s.badge !== null) expect(s.soloIn).toBeLessThanOrEqual(s.left! + 1e-6);
  });

  it('on the downbeat (A Tempo) the badge names no price and nothing is called free', async () => {
    const { sim, step } = conductSim(['a_tempo']);
    const st = sim.state;
    for (let i = 0; i < 400 && !(st.time > 0.5 && onBeat(st)); i++) step(1);
    expect(onBeat(st)).toBe(true);
    expect(cueBadge(st, st.party[0]!)).toBeNull();
    expect(hud(sim).party.every((p) => p.cue === undefined)).toBe(true);
    // The badge's markup: the word and the chain glyph, gold outline or gold fill, no number.
    const CueBadge = await component<{ hero: unknown }>('CueBadge');
    const frame = { soloName: 'Starfall', cue: { link: 2, power: 1.25, label: 'Duet' } };
    const off = renderToStaticMarkup(
      createElement(CueBadge, { hero: { ...frame, willCue: false } }),
    );
    const on = renderToStaticMarkup(createElement(CueBadge, { hero: { ...frame, willCue: true } }));
    expect(off).toContain('>Duet<');
    expect(off).not.toContain('data-on');
    expect(on).toContain('data-on="true"');
    for (const html of [off, on]) {
      expect(html).not.toMatch(/Free|Resonance|\d+ ?(s|%)/);
      expect(html).toContain('Starfall, Cued, is a Duet: ×1.25');
    }
  });

  it('a hero who can’t be Cued has no badge; no Conductor, no keys at all', () => {
    const { sim, step } = conductSim();
    step(2, [cue(0)]);
    expect(hud(sim).party[0]!.cue).toBeUndefined();
    const lum = createSim({
      seed: 7,
      encounter: 'sandbox',
      debug: true,
      chords: GUARDIAN.map((c) => ({ ...c, auras: [...c.auras] })),
      calling: { id: 'luminary', path: [], reviveSpent: false },
    });
    lum.step([{ t: 'debug', op: { op: 'chargeSolos' } }]);
    const h = hud(lum);
    expect(h.conducting).toBeUndefined();
    for (const p of h.party) {
      expect('cue' in p).toBe(false);
      expect('finale' in p).toBe(false);
      expect('spotlight' in p).toBe(false);
      expect('marcato' in p).toBe(false);
    }
    expect(h.weaver.crescendoCost).toBe(CONTENT.resonance.crescendoCost);
    // No Cue has a price (docs/solos.md): the meter carries none, and no hold without Silent Cues.
    expect('cueCost' in h.weaver).toBe(false);
    expect('cueBase' in h.weaver).toBe(false);
    expect(h.weaver.cueHold).toBe(0);
  });
});

describe('the beat strip, from beatAt and onBeat', () => {
  type Next = NonNullable<ReturnType<typeof hud>['conducting']>['beat'] & object;
  const beat = (time: number, on = false, next: Next['next'] = null): Next => ({
    time,
    bar: BAR_SECONDS,
    within: 0.15,
    on,
    gift: 5.5,
    next,
  });

  it('four marks, the downbeat first; the band its window; the light the bar’s phase', () => {
    const v = beatStrip(beat(0));
    expect(v.marks).toHaveLength(4);
    expect(v.marks[0]!.down).toBe(true);
    expect(v.marks.slice(1).every((m) => !m.down)).toBe(true);
    const down = v.marks[0]!.x;
    // The band: the window either side of the downbeat, as a share of the bar.
    expect(v.band.from).toBeCloseTo(down - 0.15 / BAR_SECONDS, 12);
    expect(v.band.to).toBeCloseTo(down + 0.15 / BAR_SECONDS, 12);
    for (const t of [0, 0.3, BAR_SECONDS / 4, 1.1, BAR_SECONDS * 0.75, BAR_SECONDS * 3.4]) {
      const { phase } = beatAt(t, BAR_SECONDS);
      const at = beatStrip(beat(t)).light;
      // The light sits at the downbeat's mark plus the phase, wrapping round the strip.
      expect(at).toBeCloseTo((down + phase) % 1, 9);
    }
    // On each beat it sits on that beat's mark.
    for (let k = 0; k < 4; k++)
      expect(beatStrip(beat(BAR_SECONDS * (2 + k / 4))).light).toBeCloseTo(v.marks[k]!.x, 9);
  });

  it('inside the window it glows: the sim’s onBeat, not a copy', () => {
    expect(beatStrip(beat(1, true)).inside).toBe(true);
    expect(beatStrip(beat(1, false)).inside).toBe(false);
    const { sim, step } = conductSim(['a_tempo']);
    for (let i = 0; i < 600; i++) {
      step(1);
      const h = hud(sim);
      expect(h.conducting!.beat!.on).toBe(onBeat(sim.state));
      expect(h.conducting!.beat).toMatchObject({
        bar: sim.state.calling!.conducting!.beat!.bar,
        within: sim.state.calling!.conducting!.beat!.within,
      });
    }
    // No A Tempo, no strip.
    expect(hud(conductSim().sim).conducting!.beat).toBeNull();
  });

  it('reduced motion: the light is on the downbeat’s mark exactly while the window is open', async () => {
    const BeatStrip = await component<{ beat: Next; reduced?: boolean }>('BeatStrip');
    const marks = beatStrip(beat(0)).marks.map((m) => m.x);
    const within = 0.15;
    const inWindow = (t: number) => Math.abs(t - beatAt(t, BAR_SECONDS).nearest) <= within + 1e-9;
    // Through two bars, a frame at a time: the light is on the downbeat's mark iff the window
    // is open, and it moves only at the window's edges and on the other beats.
    let moves = 0;
    let prev = beatStrip(beat(BAR_SECONDS, true), true).light;
    for (let f = 0; f <= 2 * 60 * BAR_SECONDS; f++) {
      const t = BAR_SECONDS + f / 60;
      const on = inWindow(t);
      const light = beatStrip(beat(t, on), true).light;
      expect(Math.abs(light - marks[0]!) < 1e-9, `t=${t.toFixed(3)}`).toBe(on);
      expect(marks.some((m) => Math.abs(m - light) < 1e-9)).toBe(true);
      if (Math.abs(light - prev) > 1e-9) moves++;
      prev = light;
    }
    // A bar's steps: the window shuts (to beat 2's mark), beats 3 and 4, the window opens.
    expect(moves).toBe(8);
    // Just after the window shuts it is on beat 2's mark, not the downbeat's; on beats 3 and 4
    // it is on theirs; just before the window opens it is still on beat 4's.
    expect(beatStrip(beat(within + 0.02), true).light).toBeCloseTo(marks[1]!, 9);
    expect(beatStrip(beat(BAR_SECONDS / 2 + 0.01), true).light).toBeCloseTo(marks[2]!, 9);
    expect(beatStrip(beat(BAR_SECONDS - within - 0.02), true).light).toBeCloseTo(marks[3]!, 9);
    expect(beatStrip(beat(BAR_SECONDS - within + 0.02, true), true).light).toBeCloseTo(
      marks[0]!,
      9,
    );
    const on = renderToStaticMarkup(
      createElement(BeatStrip, { beat: beat(2.65, true), reduced: true }),
    );
    expect(on).toContain('data-stepped="true"');
    expect(on).toContain('data-inside="true"');
    expect(on).toContain(`data-light="${marks[0]!.toFixed(3)}"`);
    // Nothing on the strip names a price or calls a Cue free.
    expect(on).not.toContain('Free');
    const off = renderToStaticMarkup(createElement(BeatStrip, { beat: beat(1.3), reduced: true }));
    expect(off).not.toContain('data-inside');
    expect(off).not.toContain('Free');
  });

  it('shows when the next Solo begins: the band lit and the hero’s initial, from soloDueIn', async () => {
    const BeatStrip = await component<{ beat: Next; reduced?: boolean }>('BeatStrip');
    const lyra = (inS: number, willCue = false) => ({
      name: 'Lyra',
      color: '#34d399',
      in: inS,
      willCue,
    });
    // Mid-bar at 1.3 s: the next window shuts at one bar plus its half-width.
    const shuts = BAR_SECONDS + 0.15 - 1.3;
    expect(beatStrip(beat(1.3)).armed).toBe(false);
    expect(beatStrip(beat(1.3, false, lyra(shuts - 0.1))).armed).toBe(true);
    // A Solo due only on the downbeat after is not this one's.
    expect(beatStrip(beat(1.3, false, lyra(shuts + 0.2))).armed).toBe(false);
    const plain = renderToStaticMarkup(
      createElement(BeatStrip, { beat: beat(1.3, false, lyra(1.4)), reduced: true }),
    );
    expect(plain).toContain('data-armed="true"');
    expect(plain).toMatch(/data-testid="beat-next"[^>]*>L</);
    expect(plain).not.toContain('data-cued');
    expect(plain).toContain('Lyra’s Solo begins in 1.4 s. Thread them to Cue it');
    const cued = renderToStaticMarkup(
      createElement(BeatStrip, { beat: beat(1.3, false, lyra(1.4, true)), reduced: true }),
    );
    expect(cued).toContain('data-cued="true"');
    expect(cued).toContain('Lyra’s Solo begins in 1.4 s, Cued');
    const none = renderToStaticMarkup(createElement(BeatStrip, { beat: beat(1.3), reduced: true }));
    expect(none).not.toContain('data-armed');
    expect(none).toMatch(/visibility:hidden[^>]*data-testid="beat-next"/);
    // In a real fight the strip's next Solo is the sim's: the least soloDueIn, held for the beat.
    const { sim, step } = conductSim(['a_tempo']);
    const st = sim.state;
    engage(sim, step);
    const next = hud(sim).conducting!.beat!.next!;
    const dues = st.party.map((id) => soloDueIn(st, st.entities.get(id)!)!);
    expect(next.in).toBe(Math.min(...dues));
    // soloDueIn already holds the Solo for the beat: no wait is left at the moment it names.
    expect(beatWait(st, st.time + next.in)).toBe(0);
    // It begins inside a downbeat's window, never before.
    const at = st.time + next.in;
    expect(Math.abs(at - beatAt(at, BAR_SECONDS).nearest)).toBeLessThanOrEqual(0.15 + 1e-6);
    expect(hud(sim).conducting!.beat!.gift).toBe(
      Number((st.calling!.conducting!.cueResonance * resonanceScale(st)).toFixed(1)),
    );
    // The party stilled (the Grand Silence), or stunned: nobody can fire, so the strip names no
    // next Solo. It asks the sim, which holds no turn for a hero who cannot fire.
    for (const id of ['stilled', 'stun']) {
      for (const hero of st.party) {
        const statuses = st.entities.get(hero)!.health!.statuses as unknown as unknown[];
        statuses.push({ id, remaining: 9, duration: 9, stacks: 1, source: null });
      }
      expect(soloQueue(st), id).toEqual([]);
      expect(hud(sim).conducting!.beat!.next, id).toBeNull();
      for (const hero of st.party)
        (st.entities.get(hero)!.health!.statuses as unknown as unknown[]).pop();
      expect(hud(sim).conducting!.beat!.next, id).not.toBeNull();
    }
  });

  it('the strip reads the frame’s beat, not the snapshot’s (A Tempo)', () => {
    const { sim, step } = conductSim(['a_tempo']);
    const st = sim.state;
    engage(sim, step);
    // A snapshot taken off the beat, then the sim stepped on a little.
    offBeat(sim, step);
    const snap = hud(sim);
    expect(snap.conducting!.beat!.next).not.toBeNull();
    step(6);
    const now = beatNow(st);
    expect(now).toEqual({ time: st.time, on: onBeat(st) });
    // The live beat is the sim's now, and the next Solo's seconds have run down with it.
    const strip = liveBeat(snap.conducting!.beat!, now);
    expect(strip).toMatchObject({ time: st.time, on: onBeat(st) });
    expect(strip.next!.in).toBeCloseTo(snap.conducting!.beat!.next!.in - 6 / 60, 9);
    for (let i = 0; i < 400 && !onBeat(st); i++) step(1);
    expect(snap.conducting!.beat!.on).toBe(false);
    expect(beatStrip(liveBeat(snap.conducting!.beat!, beatNow(st))).inside).toBe(true);
    // With no live beat (no A Tempo, the UI lab) the snapshot's stands.
    expect(liveBeat(snap.conducting!.beat!, null)).toBe(snap.conducting!.beat);
  });

  it('the runtime writes the live beat on A Tempo runs only', () => {
    const src = readFileSync(new URL('../src/app/runtime.ts', import.meta.url), 'utf8');
    // The one write, behind the A Tempo flag fixed when the fight is made.
    expect(src.match(/useBeatNow\.setState/g)).toHaveLength(1);
    expect(src).toMatch(/if \(this\.aTempo &&[^\n]*\n[^\n]*\n\s*useBeatNow\.setState/);
    expect(src).toContain('this.aTempo = !!this.sim.state.calling?.conducting?.beat;');
  });
});

describe('the Grand Finale, from finaleView', () => {
  it('pips: played lit, lost crossed, the rest due', () => {
    expect(finalePips({ fired: 1, lost: 2, left: 3 })).toEqual([
      'played',
      'lost',
      'lost',
      'due',
      'due',
      'due',
    ]);
  });

  it('a waiting and a lost turn (Maestro: six pips), each frame’s turn, and its read-out', async () => {
    const FinaleReadout = await component<Record<string, unknown>>('FinaleReadout');
    const stage = conductStage('conduct-waits');
    expect(stage.reached).toBe(true);
    const st = stage.sim.state;
    const f = st.field.conducting!.finale!;
    const h = stage.hud;
    const turns = st.calling!.conducting!.finale.turns;
    expect(turns).toBe(DEF.tiers[3]!.options.find((o) => o.id === 'maestro')!.values.loops);
    const pips = h.conducting!.finale!.pips;
    expect(pips).toHaveLength(turns * st.party.length);
    expect(pips.filter((p) => p === 'played')).toHaveLength(f.fired);
    expect(pips.filter((p) => p === 'lost')).toHaveLength(f.lost);
    expect(f.lost).toBeGreaterThan(0);
    // Who the next turn goes to is the sim's.
    const view = finaleView(st)!;
    expect(h.conducting!.finale!.next?.name ?? null).toBe(
      view.next === null ? null : h.party[st.party.indexOf(view.next)]!.name,
    );
    // Kael, Cued just before, waits mid-Solo; Vexis, down, has lost his turns; Lyra plays.
    expect(h.party[0]!.finale).toMatchObject({ state: 'waits', place: 1 });
    expect(h.party[2]!.finale!.state).toBe('lost');
    expect(h.party[1]!.finale!.state).toBe('plays');
    // The read-out: its name, one pip a turn.
    const html = renderToStaticMarkup(
      createElement(FinaleReadout, { finale: h.conducting!.finale!, name: h.weaver.crescendoName }),
    );
    expect(html).toContain(DEF.crescendoName!);
    expect(html.match(/data-pip="lost"/g)).toHaveLength(f.lost);
    expect(html.match(/data-pip="played"/g)).toHaveLength(f.fired);
    // Its call-outs: a lost turn says why.
    expect(stage.callouts.some((c) => c.text === 'Vexis can’t play: down')).toBe(true);
  });

  it('a hero who played and then went down reads played, not lost (the heard events)', () => {
    const { sim, step, events } = conductSim();
    step(1, [{ t: 'crescendo' }]);
    const st = sim.state;
    // Kael's turn is the first, taken the tick it is cast.
    expect(events.some((e) => e.type === 'finaleTurn' && e.hero === st.party[0])).toBe(true);
    const world = sim.state as unknown as World;
    dealDamage(world, world.entities.get(world.party[0]!)!, {
      source: null,
      sourceName: 'Toll Cleave',
      amount: 1e5,
      telegraph: null,
    });
    step(2);
    expect(st.field.conducting!.finale).toBeTruthy();
    const heard = heardFinale(events, null);
    expect(heard!.played).toContain(st.party[0]);
    const h = buildHudSnapshot(st, { seed: 7, hovered: null, finaleHeard: heard });
    expect(h.party[0]!.downed).toBe(true);
    expect(h.party[0]!.finale!.state).toBe('done');
    expect(finaleTurnLabel(h.party[0]!.finale!)).toBe('played');
    // Lost only when the sim says so.
    expect(finaleTurnOf(st, st.party[0]!, { played: [], lost: [st.party[0]!] })!.state).toBe(
      'lost',
    );
    expect(finaleTurnOf(st, st.party[0]!, { played: [], lost: [] })!.state).toBe('done');
    // A new Finale clears what was heard.
    expect(
      heardFinale([{ type: 'crescendoStart', tick: 9, calling: 'x' } as SimEvent], heard),
    ).toEqual({
      played: [],
      lost: [],
    });
  });

  it('a hero downed with a turn still queued reads as losing it (the sim’s finaleTurnBlock)', async () => {
    const ConductMarks = await component<Record<string, unknown>>('ConductMarks');
    const { sim, step, events } = conductSim();
    step(1, [{ t: 'crescendo' }]);
    step(10);
    const st = sim.state;
    const world = sim.state as unknown as World;
    const lyra = st.party[1]!;
    dealDamage(world, world.entities.get(lyra)!, {
      source: null,
      sourceName: 'Toll Cleave',
      amount: 1e5,
      telegraph: null,
    });
    // Ahead of the next in the queue, down: not "waits" but losing the turn.
    expect(finaleView(st)!.queue.indexOf(lyra)).toBe(0);
    expect(finaleTurnBlock(st, lyra)).toBe('down');
    const turn = finaleTurnOf(st, lyra, heardFinale(events, null))!;
    expect(turn).toEqual({ place: 1, state: 'losing', block: 'down' });
    expect(finaleTurnLabel(turn)).toBe('can’t play');
    expect(finaleTurnSentence('Lyra', turn)).toBe('Lyra can’t play: down. Their turn will be lost');
    // The sim drops it when the next turn comes due.
    for (let i = 0; i < 120 && !events.some((e) => e.type === 'finaleTurnLost'); i++) step(1);
    expect(events).toContainEqual(
      expect.objectContaining({ type: 'finaleTurnLost', hero: lyra, reason: 'down' }),
    );
    // Lost now (Vexis took the last turn, so the Finale is over), and said so in the past tense.
    expect(st.field.conducting!.finale).toBeUndefined();
    const lost = { place: null, state: 'lost', played: 0, lost: 1 } as const;
    expect(finaleTurnLabel(lost)).toBe('lost');
    const sentence = finaleTurnSentence('Lyra', lost);
    expect(sentence).toBe('Lyra lost their turn');
    const html = renderToStaticMarkup(
      createElement(ConductMarks, { hero: { name: 'Lyra', finale: lost } }),
    );
    expect(html).toContain('aria-label="Lyra lost their turn"');
    expect(html).not.toContain('will lose');
    // A possessed or stilled hero likewise: the reason is the sim's.
    for (const block of ['possessed', 'stilled'] as const)
      expect(finaleTurnSentence('Kael', { place: 2, state: 'losing', block })).toBe(
        `Kael can’t play: ${block}. Their turn will be lost`,
      );
  });

  it('with Maestro, a hero who played pass 1 and lost pass 2 reads both', () => {
    const { sim, step, events } = conductSim(['marcato', 'reprise', 'ensemble', 'maestro']);
    step(1, [{ t: 'crescendo' }]);
    const st = sim.state;
    const kael = st.party[0]!;
    expect(events).toContainEqual(expect.objectContaining({ type: 'finaleTurn', hero: kael }));
    const world = sim.state as unknown as World;
    dealDamage(world, world.entities.get(kael)!, {
      source: null,
      sourceName: 'Toll Cleave',
      amount: 1e5,
      telegraph: null,
    });
    step(2);
    expect(finaleTurnOf(st, kael, heardFinale(events, null))!.state).toBe('losing');
    const lostKael = () => events.some((e) => e.type === 'finaleTurnLost' && e.hero === kael);
    for (let i = 0; i < 600 && !lostKael(); i++) step(1);
    expect(lostKael()).toBe(true);
    expect(st.field.conducting!.finale).toBeTruthy();
    const turn = finaleTurnOf(st, kael, heardFinale(events, null))!;
    expect(turn).toMatchObject({ place: null, state: 'lost', played: 1, lost: 1 });
    expect(finaleTurnLabel(turn)).toBe('played · lost');
    expect(finaleTurnSentence('Kael', turn)).toBe('Kael played a turn of the Finale and lost one');
  });

  it('the timing hints wait while the Finale plays or a banner is up', () => {
    const fighting = (h: ReturnType<typeof hud>) => ({
      ...h,
      encounter: { ...h.encounter, kind: 'skirmish' as const, status: 'fighting' as const },
    });
    const { sim, step } = conductSim(['a_tempo']);
    step(30, [cue(0)]);
    engage(sim, step);
    const quiet = fighting(hud(sim));
    const ids = (o?: { banner?: boolean }) => evaluateHints(quiet, o).map((x) => x.id);
    expect(ids()).toEqual(expect.arrayContaining(['chain', 'beat']));
    expect(ids({ banner: true })).not.toContain('chain');
    expect(ids({ banner: true })).not.toContain('beat');
    const finale = fighting(conductStage('conduct-finale').hud);
    const during = evaluateHints(finale).map((x) => x.id);
    for (const id of ['chain', 'beat', 'solo']) expect(during).not.toContain(id);
  });

  it('the next hero and the ramp’s power, from finaleView (“Vexis next ×1.44”)', async () => {
    const ConductRow = await component<Record<string, unknown>>('ConductRow');
    const stage = conductStage('conduct-finale');
    expect(stage.reached).toBe(true);
    const view = finaleView(stage.sim.state)!;
    const next = stage.hud.conducting!.finale!.next!;
    expect(next.power).toBe(view.power);
    expect(next.name).toBe('Vexis');
    const row = renderToStaticMarkup(createElement(ConductRow, { c: stage.hud.conducting! }));
    expect(row).toContain(`Vexis next ${powerLabel(view.power)}`);
    expect(powerLabel(view.power)).toBe('×1.44');
    // The turns build one toast: "Kael ×1 · Lyra ×1.2".
    const toast = stage.callouts.find((c) => c.key === FINALE_TURNS_KEY)!;
    expect(toast.text).toBe('Kael ×1 · Lyra ×1.2');
  });
});

describe('the Crescendo read-out and the Dissonance chip', () => {
  it('with Maestro the Crescendo costs 75 (crescendoCostOf), and is ready at that cost', () => {
    const { sim, step } = conductSim(['marcato', 'reprise', 'ensemble', 'maestro']);
    const cost = DEF.tiers[3]!.options.find((o) => o.id === 'maestro')!.values.cost!;
    step(1, [{ t: 'debug', op: { op: 'setResonance', value: cost } }]);
    const h = hud(sim);
    expect(h.weaver.crescendoCost).toBe(crescendoCostOf(sim.state));
    expect(h.weaver.crescendoCost).toBe(cost);
    expect(
      evaluateHints({
        ...h,
        encounter: { ...h.encounter, kind: 'skirmish', status: 'fighting' },
      }).map((x) => x.id),
    ).toContain('finale');
    // Without Maestro, the content's.
    expect(hud(conductSim().sim).weaver.crescendoCost).toBe(CONTENT.resonance.crescendoCost);
  });

  it('quiet on a Conductor run with no Dissonance; Silent Cues asks for a hold, never a price', () => {
    const plain = hud(conductSim().sim);
    expect(plain.dissonance).toBeNull();
    expect(plain.weaver.cueHold).toBe(0);
    const other = hud(conductSim([], { dissonance: [{ id: 'blind_score', rank: 1 }] }).sim);
    expect(other.weaver.cueHold).toBe(0);
    expect(hudDissonanceView(other.dissonance!.levels).label).not.toMatch(/A Cue costs/);
    // Silent Cues: the Thread must hold; the chip lists the level in content's own words.
    const level = CONTENT.dissonance.find((d) => d.effect === 'cue_hold')!;
    const silent = hud(conductSim([], { dissonance: [{ id: level.id, rank: 1 }] }).sim);
    expect(silent.weaver.cueHold).toBe(level.values.seconds);
    const view = hudDissonanceView(silent.dissonance!.levels);
    expect(view.levels.map((l) => l.name)).toEqual([level.name]);
    expect(view.label).toContain(level.name);
    expect(view.label).not.toMatch(/costs|Resonance/);
  });
});
describe('call-outs and hints', () => {
  it('DUET a toast, TRIO a banner, A Tempo’s gift, Reprise, Marcato: from the events’ own numbers', () => {
    const stage = conductStage('conduct-trio');
    expect(stage.reached).toBe(true);
    const texts = stage.callouts.map((c) => `${c.kind}:${c.text}`);
    // The Thread followed the Solos as they fired: Lyra, then Vexis, then Kael's wall.
    expect(texts).toContain('system:DUET · Vexis ×1.25');
    expect(texts).toContain('perfect:TRIO · Kael ×1.5');
    // No Cue can join a Trio: no ring, no "Trio next", nothing to drain.
    expect(stage.hud.conducting!.chain).toBeNull();
    expect(stage.hud.party.every((p) => (p.cue?.link ?? 1) === 1)).toBe(true);
    expect(texts).toContain(
      `system:Reprise · every Solo +${DEF.tiers[1]!.options[0]!.values.pct}%`,
    );
    const name = () => 'Lyra';
    const onTheBeat = {
      type: 'cueChained' as const,
      tick: 1,
      hero: 2,
      link: 1 as const,
      power: 1,
      onBeat: true,
      until: 3,
    };
    // A Solo Cued on the downbeat: what A Tempo gave the meter. Never "free".
    const gift = conductingCallouts(onTheBeat, { name, time: 0, gift: 5.5 });
    expect(gift.map((c) => c.callout.text)).toEqual(['On the beat · +5.5 Resonance']);
    expect(conductingCallouts(onTheBeat, { name, time: 0 })).toEqual([]);
    expect(
      conductingCallouts({ ...onTheBeat, onBeat: false }, { name, time: 0, gift: 5.5 }),
    ).toEqual([]);
    const marcato = conductingCallouts(
      { type: 'marcato', tick: 1, heroes: [1], until: 4, readyAt: 8 },
      { name, time: 0, marcato: { pct: 0.1, seconds: 4 } },
    );
    expect(marcato[0]!.callout.text).toBe('Marcato · +10% for 4 s');
    // Marcato's chip: ready, or back in so many seconds (the sim's marcatoReadyIn).
    const m = { pct: 0.1, seconds: 4 };
    expect(marcatoHud(0, m)).toMatchObject({ ready: true, readyIn: 0 });
    expect(marcatoHud(5, m)).toMatchObject({ ready: false, readyIn: 5 });
    expect(stage.hud.conducting!.marcato!.ready).toBe(false);
    expect(stage.hud.conducting!.marcato!.readyIn).toBe(marcatoReadyIn(stage.sim.state));
  });

  it('the chain hint names the link, the hero and their Thread key; the beat hint what A Tempo gives', () => {
    const fighting = (h: ReturnType<typeof hud>) =>
      evaluateHints({ ...h, encounter: { ...h.encounter, kind: 'skirmish', status: 'fighting' } });
    const { sim, step } = conductSim();
    step(30, [cue(0)]);
    // No Solo is coming yet (nobody to fight): nothing to follow, no hint.
    expect(fighting(hud(sim)).map((x) => x.id)).not.toContain('chain');
    engage(sim, step);
    const chain = fighting(hud(sim)).find((x) => x.id === 'chain')!;
    expect(chain.text).toBe('Duet next. Thread Lyra {2} as their Solo fires');
    // The Thread already on that hero: the hint has nothing to add.
    step(1, [{ t: 'thread', slot: 1 }]);
    const after = fighting(hud(sim)).find((x) => x.id === 'chain');
    expect(after?.text ?? '').not.toContain('Lyra');
    // A Tempo: the beat hint says when Solos begin and what a Cued one gives (the sim's number).
    const beat = conductSim(['a_tempo']);
    expect(fighting(hud(beat.sim)).map((x) => x.id)).not.toContain('beat');
    engage(beat.sim, beat.step);
    const h = hud(beat.sim);
    const hint = fighting(h).find((x) => x.id === 'beat')!;
    expect(hint.text).toBe(
      `Solos begin on the downbeat. Each one you Cue gives ${h.conducting!.beat!.gift} Resonance`,
    );
    expect(hint.text).not.toMatch(/free|costs/i);
  });
});

describe('the sim’s rules, read not copied', () => {
  it('Ensemble’s bonus is the sim’s; its pips count to the cap, a whole step or not', () => {
    const { sim, step } = conductSim(['marcato', 'reprise', 'ensemble']);
    const e = sim.state.calling!.conducting!.ensemble!;
    for (const slot of [0, 1, 2]) {
      step(1, [{ t: 'debug', op: { op: 'chargeSolos' } }]);
      step(1, [{ t: 'debug', op: { op: 'setResonance', value: CONTENT.resonance.max } }]);
      step(1, [cue(slot)]);
      expect(hud(sim).conducting!.ensemble!.bonus).toBe(ensembleBonus(sim.state));
    }
    expect(hud(sim).conducting!.ensemble!.most).toBe(ensembleMost(e));
    expect(ensembleMost({ pct: 0.05, max: 0.15 })).toBe(3);
    // Not a whole number of steps: the third hero still raises it (to the cap).
    expect(ensembleMost({ pct: 0.05, max: 0.12 })).toBe(3);
    expect(ensembleMost({ pct: 0.05, max: 0.1 })).toBe(2);
    expect(ensembleMost({ pct: 0.04, max: 0.1 })).toBe(3);
  });

  it('Marcato’s hold on a frame and its chip are the sim’s marcatoOn and marcatoReadyIn', () => {
    const { sim, step } = conductSim(['marcato']);
    const st = sim.state;
    const rally: Command = { t: 'directive', kind: 'rally' };
    expect(hud(sim).conducting!.marcato).toMatchObject({ ready: true, readyIn: 0 });
    expect(marcatoReadyIn(st)).toBe(0);
    step(1, [rally]);
    for (let i = 0; i < 60 * 12; i += 15) {
      const h = hud(sim);
      for (let slot = 0; slot < st.party.length; slot++)
        expect(!!h.party[slot]!.marcato, `t=${st.time}`).toBe(marcatoOn(st, st.party[slot]!));
      expect(h.conducting!.marcato!.readyIn).toBe(marcatoReadyIn(st));
      expect(h.conducting!.marcato!.ready).toBe(marcatoReadyIn(st) === 0);
      step(15);
    }
  });
});

describe('Result and Summary', () => {
  it('the Result’s line: damage, Duets, Trios, the Finale’s Solos, Solos Cued on the beat', () => {
    const stats = {
      callingAmplified: 412,
      callingShielded: 0,
      conducting: {
        duets: 3,
        trios: 1,
        freeCues: 4,
        saved: 60,
        finales: 1,
        finaleSolos: 6,
        reprised: 0,
        marcatos: 0,
      },
    };
    expect(callingResultLine(stats, { id: 'conductor', path: [] })).toBe(
      `+412 damage through your heroes · 3 Duets · 1 Trio · ${DEF.crescendoName} played 6 Solos · 4 Solos Cued on the beat`,
    );
    // Without a Duet the Summary says how; with one it doesn't.
    expect(
      conductingTip('conductor', { conducting: { ...stats.conducting, duets: 0, trios: 0 } }),
    ).toBe(
      `No Duet this run. Thread two heroes as their Solos fire, within ${V.chain} s: the second plays ${V.duet}% stronger.`,
    );
    expect(conductingTip('conductor', stats)).toBeNull();
    expect(conductingTip('luminary', {})).toBeNull();
    expect(callingNothingText('conductor')).toContain(`within ${V.chain} s`);
  });

  it('a Conductor run’s Result and Summary read his tallies', () => {
    const run = conductResultRun();
    const r = run.lastResult!;
    expect(r.stats.conducting).toBeTruthy();
    const line = callingLine(r.stats, run.calling)!;
    expect(line.text).toContain(`${r.stats.conducting!.duets} Duet`);
    expect(line.calling).toBe(true);
    const summary = conductSummaryRun();
    const totals = runTotals(summary);
    const labels = callingParts(totals, summary.calling).map((p) => p.label);
    expect(labels).toContain('Duets');
    expect(labels[0]).toBe('Led');
  });
});
