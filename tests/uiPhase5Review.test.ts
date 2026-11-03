/**
 * Phase 5a review fixes (UI): Starlight's lines add up in Movement II, the death recap and the
 * hints are Calling-aware (no Reel on a Chronomancer run), the recap names Execution's and the
 * Blood Pact's answers, and every first-sighting card is drawn.
 */
import { createElement, type FunctionComponent } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it } from 'vitest';
import { useProfile } from '../src/app/profileStore';
import { useRun } from '../src/app/runStore';
import { useSettings } from '../src/app/settings';
import { CONTENT } from '../src/content';
import { starlightForFight } from '../src/meta/loom';
import type { DeathRecap, EncounterResult } from '../src/meta/types';
import { evaluateHints } from '../src/ui/hud/hints';
import { noteSightings, sightingDef } from '../src/ui/hud/sighting';
import { legionHud } from '../src/ui/lab/mock';
import { deathAnswerLine, deathAnswers, deathReadyLine } from '../src/ui/screens/resultText';
import { fightStarlight, runStarlight } from '../src/ui/screens/starlightModel';
import { useUi } from '../src/ui/store';
import type { Callout, HudSnapshot } from '../src/ui/store';

/**
 * The HUD's callouts component, rendered to markup. Imported at run time: the node test build
 * has no JSX, so the .tsx module can't be imported statically here.
 */
async function drawCallouts(callouts: Callout[]): Promise<string> {
  const path = '../src/ui/hud/Callouts';
  const { Callouts } = (await import(/* @vite-ignore */ path)) as {
    Callouts: FunctionComponent<{ callouts: Callout[]; barkSpeakers: string[] }>;
  };
  return renderToStaticMarkup(createElement(Callouts, { callouts, barkSpeakers: [] }));
}

beforeEach(() => {
  useSettings.getState().reset();
  useProfile.getState().resetProgress();
  useRun.getState().closeRun();
  useUi.setState({ callouts: [] });
});

const S = CONTENT.starlight;
const M2 = CONTENT.movements[1]!.rewards.starlight;

/** The numbers a Starlight detail adds up ("3 for a skirmish won, 1 for Movement II · ×1.25"). */
const addsUp = (detail: string) =>
  detail
    .split(' · Dissonance')[0]!
    .split(', ')
    .reduce((n, part) => n + Number(/^(\d+) for /.exec(part)?.[1] ?? NaN), 0);

describe('Starlight in Movement II', () => {
  it('a Movement II fight’s detail has its ×1.25 line, and the lines add up to what it paid', () => {
    expect(M2).toBe(1.25);
    const paid = (kind: 'skirmish' | 'boss', wonRun: boolean) =>
      starlightForFight({ kind, outcome: 'victory' }, wonRun, M2);
    const skirmish = fightStarlight({
      kind: 'skirmish',
      outcome: 'victory',
      starlight: paid('skirmish', false),
      movement: 2,
    })!;
    expect(skirmish.detail).toMatch(/for Movement II · ×1\.25$/);
    expect(addsUp(skirmish.detail)).toBe(skirmish.amount);
    const vharun = fightStarlight({
      kind: 'boss',
      outcome: 'victory',
      starlight: paid('boss', true),
      wonRun: true,
      movement: 2,
    })!;
    expect(vharun.amount).toBe(Math.round((S.fights.boss + S.winBonus) * M2));
    expect(vharun.detail).toMatch(/winning the run, \d+ for Movement II · ×1\.25$/);
    expect(addsUp(vharun.detail)).toBe(vharun.amount);
    // Movement I (and results from before Movements) keep their lines as they were.
    const cantor = fightStarlight({
      kind: 'boss',
      outcome: 'victory',
      starlight: S.fights.boss,
      wonRun: false,
      movement: 1,
    })!;
    expect(cantor.detail).toBe(`${S.fights.boss} for the boss won`);
  });

  it('the Summary’s win bonus is what Vharun’s result paid for it (×1.25)', () => {
    const cantor = {
      kind: 'boss',
      outcome: 'victory',
      starlight: S.fights.boss,
      movement: 1,
      wonRun: false,
    };
    const vharun = {
      kind: 'boss',
      outcome: 'victory',
      starlight: starlightForFight({ kind: 'boss', outcome: 'victory' }, true, M2),
      movement: 2,
      wonRun: true,
    };
    const results = [cantor, vharun] as unknown as EncounterResult[];
    const s = runStarlight({ results, deeds: [], dissonance: [] });
    const win = s.lines.find((l) => l.label === 'Winning the run')!;
    expect(win.amount).toBe(Math.round(S.winBonus * M2));
    const fights = s.lines.find((l) => l.label === 'Fights')!;
    expect(fights.amount).toBe(S.fights.boss + Math.round(S.fights.boss * M2));
    expect(fights.amount + win.amount).toBe(s.total);
  });
});

const recap = (over: Partial<DeathRecap>): DeathRecap => ({
  time: 40,
  heroId: 'lyra',
  killer: 'Impale',
  recap: [],
  readyTechniques: [],
  ...over,
});

describe('the death recap on a Chronomancer run', () => {
  it('never names Reel: a pin’s answer is Ward, a latch’s is Chime', () => {
    expect(deathAnswerLine(['reel'], 'chronomancer')).toBe('Answer: Ward');
    expect(deathAnswerLine(['reel', 'chime'], 'chronomancer')).toBe('Answer: Chime');
    expect(deathAnswerLine(['chime'], 'chronomancer')).toBe('Answer: Chime');
    expect(deathAnswers(['reel', 'ward'], 'chronomancer')).toEqual(['ward']);
    // Every other Calling (and none) keeps Reel.
    expect(deathAnswerLine(['reel'], 'luminary')).toBe('Answer: Reel');
    expect(deathAnswerLine(['reel', 'chime'], null)).toBe('Answers: Reel or Chime');
    expect(deathAnswerLine(['reel'])).toBe('Answer: Reel');
  });

  it('Rewind ready on a pin death answers nothing; a ready Ward does', () => {
    const rewindOnly = deathReadyLine(
      recap({ answers: ['reel'], readyTechniques: ['reel'] }),
      'chronomancer',
    );
    expect(rewindOnly).toEqual({ kind: 'ready', names: 'Rewind', couldAnswer: false });
    const ward = deathReadyLine(
      recap({ answers: ['reel'], readyTechniques: ['reel', 'ward'] }),
      'chronomancer',
    );
    expect(ward).toMatchObject({ names: 'Rewind, Ward', couldAnswer: true });
    // A Reel run's ready Reel answers its pin.
    expect(
      deathReadyLine(recap({ answers: ['reel'], readyTechniques: ['reel'] }), 'luminary'),
    ).toMatchObject({ names: 'Reel', couldAnswer: true });
  });
});

describe('the death recap names Execution’s and the Blood Pact’s answers', () => {
  it('Execution (mend, ward) with nothing ready: the answer, not "on cooldown"', () => {
    const d = recap({ killer: 'Execution', answers: ['mend', 'ward'] });
    expect(deathAnswerLine(d.answers)).toBe('Answers: Mend or Ward');
    expect(deathReadyLine(d)).toBeNull();
  });

  it('Blood Pact (scatter) with Chime and Reel ready: Scatter, and they don’t answer it', () => {
    const d = recap({
      killer: 'Blood Pact',
      answers: ['scatter'],
      readyTechniques: ['chime', 'reel'],
    });
    expect(deathAnswerLine(d.answers)).toBe('Answer: Scatter');
    expect(deathReadyLine(d)).toEqual({ kind: 'ready', names: 'Chime, Reel', couldAnswer: false });
    // Nothing ready, and Scatter is a directive (never on cooldown): no cooldown line.
    expect(deathReadyLine({ ...d, readyTechniques: [] })).toBeNull();
  });

  it('a Movement I death (no answers) reads as it did', () => {
    expect(deathAnswerLine(undefined)).toBeNull();
    expect(deathReadyLine(recap({ killer: 'Dirge' }))).toEqual({ kind: 'cooldown' });
    expect(deathReadyLine(recap({ readyTechniques: ['ward', 'reel'] }), 'chronomancer')).toEqual({
      kind: 'ready',
      names: 'Ward, Rewind',
      couldAnswer: true,
    });
  });
});

/** A Chronomancer's HUD: Reel's key casts Rewind. */
function chrono(hud: HudSnapshot): HudSnapshot {
  return { ...hud, weaver: { ...hud.weaver, rewind: { seconds: 3, range: 14, ready: true } } };
}

/** Vharun's Bloodmoon, with Lyra latched by a Leech. */
function latchedBloodmoon(): HudSnapshot {
  const hud = legionHud('vharun-bloodmoon');
  return {
    ...hud,
    party: hud.party.map((h, i) =>
      i === 1
        ? { ...h, statuses: [...h.statuses, { id: 'latched', remaining: 3, duration: 5 }] }
        : h,
    ),
  } as HudSnapshot;
}

describe('the latched and Bloodmoon hints on a Chronomancer run', () => {
  it('never tell the player to Reel', () => {
    const text = (hud: HudSnapshot, id: string) =>
      evaluateHints(hud).find((h) => h.id === id)!.text;
    const plain = latchedBloodmoon();
    expect(text(plain, 'latched')).toMatch(/Reel \{.*\} or Chime/);
    expect(text(plain, 'bloodmoon')).toMatch(/Reel \{.*\} frees a pinned hero/);
    const rewinds = chrono(plain);
    expect(text(rewinds, 'latched')).toMatch(/— Chime \{.*\} frees them$/);
    expect(text(rewinds, 'bloodmoon')).toMatch(/Rally \{.*\} the party to you$/);
    for (const h of evaluateHints(rewinds)) expect(h.text).not.toMatch(/Reel \{/);
  });
});

describe('first-sighting cards', () => {
  const foes = ['sanguine_hound', 'impaler', 'hemomancer', 'crimson_sentinel', 'leech'];

  it('three new foes at once: every card is drawn', async () => {
    useProfile.getState().see(['sanguine_hound', 'impaler']);
    expect(noteSightings(foes, 1000)).toEqual(['hemomancer', 'crimson_sentinel', 'leech']);
    const callouts = useUi.getState().callouts;
    const html = await drawCallouts(callouts);
    for (const name of ['Hemomancer', 'Crimson Sentinel', 'Leech'])
      expect(html).toContain(`New foe: ${name}.`);
  });

  it('other callouts never evict a card before it expires', () => {
    useProfile.getState().see(['sanguine_hound', 'impaler']);
    noteSightings(foes, 1000);
    const ui = useUi.getState();
    for (let i = 0; i < 8; i++) ui.pushCallout({ kind: 'system', text: `toast ${i}` }, 1100 + i);
    const callouts = useUi.getState().callouts;
    expect(callouts.map(sightingDef).filter(Boolean)).toEqual([
      'hemomancer',
      'crimson_sentinel',
      'leech',
    ]);
    // The other kinds keep their cap of 5 (the newest).
    expect(callouts.filter((c) => c.kind !== 'sighting').map((c) => c.text)).toEqual([
      'toast 3',
      'toast 4',
      'toast 5',
      'toast 6',
      'toast 7',
    ]);
    // Without a sighting, the cap is the same 5 as ever.
    useUi.setState({ callouts: [] });
    for (let i = 0; i < 8; i++) ui.pushCallout({ kind: 'system', text: `t${i}` }, 2000 + i);
    expect(useUi.getState().callouts).toHaveLength(5);
  });
});
