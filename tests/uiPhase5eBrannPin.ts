/**
 * Phase 5e (docs/phase-5e.md): what the UI shows for Brann and the default party, as text, so
 * `tests/uiPhase5e.test.ts` can hold it byte-equal to what it was before Seren and Oro's UI
 * landed (`uiPhase5e.brann.json`, recorded from W3's head with this same module). Not a test file
 * itself: the pin's reader, shared by the test and the recorder.
 */
import { createElement, type FunctionComponent } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CONTENT, heroDef } from '../src/content';
import { evaluateHints } from '../src/ui/hud/hints';
import { shownDecree } from '../src/ui/hud/legionLook';
import { allyOf } from '../src/ui/hud/sighting';
import { brannHud, brannResultRun, BRANN_PARTIES, mockHud } from '../src/ui/lab/mock';
import { heroTabColumns } from '../src/ui/screens/bondsModel';
import {
  bloodLine,
  freshHeroes,
  healCutStackText,
  lockedHeroText,
  missingStarterNotes,
  needsRow,
  passiveRow,
  pickerCards,
  recruitLine,
} from '../src/ui/screens/rosterModel';
import type { BrannScenario } from '../src/ui/lab/mock';
import type { HudScenario } from '../src/ui/lab/mock';

const FOUR = ['kael', 'lyra', 'vexis', 'brann'] as const;

/** Every pick of one to three from the first four heroes, in content order. */
function picks(): string[][] {
  const out: string[][] = [];
  for (let m = 1; m < 16; m++) {
    const p = FOUR.filter((_, i) => m & (1 << i));
    if (p.length <= 3) out.push([...p]);
  }
  return out;
}

const BRANN_SCENARIOS: BrannScenario[] = [
  'brann-raging',
  'brann-rally',
  'brann-critical',
  'brann-fast',
  'brann-bloodlet',
  'brann-deathless',
  'brann-held',
  'brann-calls',
  'brann-oath',
  'brann-execution',
  'brann-cleave',
];
const DEFAULT_SCENARIOS: HudScenario[] = ['calm', 'crisis', 'downed', 'boss', 'calls', 'fermata'];

/** A .tsx module's export, at run time. */
async function component<P>(path: string, name: string): Promise<FunctionComponent<P>> {
  const mod = (await import(/* @vite-ignore */ path)) as Record<string, FunctionComponent<P>>;
  return mod[name]!;
}

/** The pin: every Brann and default-party UI text and frame, by key. */
export async function brannUiPin(): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {};
  for (const p of picks()) {
    out[`notes:${p.join(',')}`] = missingStarterNotes(p);
    out[`picker:${p.join(',')}`] = pickerCards([...FOUR], p);
  }
  const brann = heroDef('brann');
  out.passive = CONTENT.heroes.map((h) => passiveRow(h)).slice(0, 4);
  out.stack = healCutStackText(brann);
  out.needs = needsRow(brann);
  out.locked = [lockedHeroText('brann'), lockedHeroText('kael')];
  out.recruit = ['vharun', 'legion_vanguard', 'first_light', null].map((e) =>
    recruitLine('brann', e),
  );
  const stats = {
    lifesteal: 1240,
    lowTime: 60,
    low30Time: 24,
    aliveTime: 96,
    peakAfterLow: 0.38,
    spent: 250,
  };
  out.bloodLine = [
    bloodLine('brann', stats),
    bloodLine('brann', stats, true),
    bloodLine('brann', stats, false, true),
  ];
  out.ally = [allyOf('brann'), allyOf('kael')];
  const execution = CONTENT.attacks.find((a) => a.executeBelow !== undefined)!;
  out.decree = [0.5, 1].map((cut) =>
    shownDecree(execution.decree!, [
      { defId: 'lyra' },
      { defId: 'vexis' },
      { defId: 'brann', execute: 0.4, healCut: cut },
    ]),
  );
  out.tabs = [1, 2, 3, 4].map(heroTabColumns);
  const epiloguePath = '../src/ui/screens/EpilogueView';
  const { epilogueLines } = (await import(/* @vite-ignore */ epiloguePath)) as {
    epilogueLines(
      party: readonly string[],
    ): { speaker: string | null; text: string; color?: string }[];
  };
  out.epilogue = [
    ...picks().filter((p) => p.length === 3),
    ['vexis', 'brann', 'lyra'],
    ['brann', 'kael', 'lyra'],
  ].map((p) => epilogueLines(p).map((l) => `${l.speaker}: ${l.text} ${l.color ?? ''}`));
  out.fresh = freshHeroes(['brann'], []);
  const PartyFrames = await component<Record<string, unknown>>(
    '../src/ui/hud/PartyFrames',
    'PartyFrames',
  );
  const huds = [
    ...BRANN_SCENARIOS.map((s) => [s, brannHud(s)] as const),
    ...DEFAULT_SCENARIOS.map((s) => [s, mockHud(s)] as const),
  ];
  for (const [s, hud] of huds) {
    out[`hints:${s}`] = evaluateHints(hud);
    out[`frames:${s}`] = renderToStaticMarkup(
      createElement(PartyFrames, {
        party: hud.party,
        threadMode: hud.weaver.threadMode,
        barks: [],
        chords: hud.weaver.chords,
        calling: hud.calling,
        rewind: hud.weaver.rewind,
      }),
    );
  }
  const ResultView = await component<Record<string, unknown>>(
    '../src/ui/screens/ResultScreen',
    'ResultView',
  );
  for (const [k, party] of Object.entries(BRANN_PARTIES)) {
    const run = brannResultRun(party);
    out[`result:${k}`] = renderToStaticMarkup(
      createElement(ResultView, { run, result: run.lastResult!, onContinue: () => {} }),
    );
  }
  return out;
}
