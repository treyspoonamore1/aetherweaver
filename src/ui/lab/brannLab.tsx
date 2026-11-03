/**
 * The UI lab's 'Brann' group (docs/phase-5b.md): every state of the roster and of Brann on
 * screen, against mock data. Prep's picker (parties A, B and C, and a pick of two), his frames
 * (raging, a refused Rally, critical, falling fast, Bloodletting, Deathless, a Fermata hold, two
 * Ward calls told apart, Blood Oath and a Tithe Ward), Vharun against party B, the 'New ally'
 * card, the Codex locked and unlocked, the Bonds tabs with him, the Cell's three texts, the
 * Result's recruit lines and his Blood Rage line, the Summary, and the Harmony on a draft.
 */
import { useState, type ReactNode } from 'react';
import { CONTENT } from '../../content';
import { heroRoster } from '../../meta/profile';
import type { RunState } from '../../meta/types';
import { HudView } from '../hud/Hud';
import { BondsView } from '../screens/BondsScreen';
import { CodexView } from '../screens/CodexScreen';
import { DraftView } from '../screens/DraftScreen';
import { EventView } from '../screens/EventScreen';
import { PrepView } from '../screens/PrepScreen';
import { ResultView } from '../screens/ResultScreen';
import { SummaryView } from '../screens/SummaryScreen';
import {
  BRANN_PARTIES,
  brannCallouts,
  brannHud,
  brannPrepRun,
  brannResultRun,
  brannSummaryRun,
  cellRun,
  draftRun,
  labSetSolo,
  labSetTalent,
  mockBonds,
  withParty,
  type BrannScenario,
} from './mock';
import type { Bond } from '../../meta/bonds';

export interface BrannLabView {
  id: string;
  group: string;
  label: string;
  w: number;
  h: number;
  render(): ReactNode;
}

const noop = () => {};
const GROUP = 'Brann';
/** Every hero (a profile that has recruited Brann). */
const ROSTER = heroRoster({ recruited: ['brann'] }, false);

/** A stand-in for the 3D arena behind the HUD (as the lab's other HUD stages). */
function World({ children }: { children: ReactNode }) {
  return (
    <div
      className="relative h-full w-full overflow-hidden"
      style={{
        background:
          'radial-gradient(ellipse at 50% 45%, #3a2230 0%, #1c1426 60%, #0a0d1c 100%), repeating-linear-gradient(0deg, transparent 0 63px, rgb(255 255 255 / 0.04) 63px 64px)',
      }}
    >
      {children}
    </div>
  );
}

function BrannStage({ scenario, ally = false }: { scenario: BrannScenario; ally?: boolean }) {
  const hud = brannHud(scenario);
  return (
    <World>
      <HudView
        hud={hud}
        callouts={brannCallouts(ally ? 'brann-ally' : scenario)}
        decree={hud.boss?.decree ?? null}
        subtitle={hud.boss ? 'Movement II · node 7 of 7' : 'Movement I · node 3 of 7'}
        forceCoach
      />
    </World>
  );
}

/** Prep with the picker live: toggling heroes changes the run's party, as the store would. */
function PrepLab({ party }: { party: readonly string[] }) {
  const [run, setRun] = useState<RunState>(() => brannPrepRun(party));
  return (
    <PrepView
      run={run}
      onChords={noop}
      onEmbark={noop}
      onBack={noop}
      rank={6}
      party={{ roster: ROSTER, onChange: (ids) => setRun((r) => withParty(r, ids)) }}
    />
  );
}

function BondsLab() {
  const [bonds, setBonds] = useState<Record<string, Bond>>(() => ({
    ...mockBonds(4),
    brann: { xp: 900, talents: ['iron_will', null, null], solo: 'default', seen: {} },
  }));
  return (
    <BondsView
      bonds={bonds}
      unlockAll={false}
      heroes={['kael', 'lyra', 'vexis', 'brann']}
      onTalent={(h, tier, id) => setBonds((b) => labSetTalent(b, h, tier, id, false))}
      onSolo={(h, solo) => setBonds((b) => labSetSolo(b, h, solo, false))}
      onBack={noop}
      backTo="Prep"
      onRules={noop}
      initialHero="brann"
    />
  );
}

/** A draft offering Blood Tithe and Taut Release (each would enable Blood and Silk) and it. */
function harmonyDraftRun(): RunState {
  const run = withParty(draftRun(), BRANN_PARTIES.A);
  return {
    ...run,
    draft: {
      reason: 'elite',
      rerollsLeft: 1,
      options: ['blood_tithe', 'taut_release', 'blood_and_silk'].map((motifId) => ({
        motifId,
        level: 1,
        upgrade: false,
      })),
    },
  };
}

const HUD_STATES: readonly [BrannScenario, string][] = [
  ['brann-raging', 'HUD: Brann raging (40–15%), no alarm, Ward him'],
  ['brann-rally', 'HUD: Bloodlust, a Rally he refuses'],
  ['brann-critical', 'HUD: Brann critical below 15%, Deathless tick'],
  ['brann-fast', 'HUD: Brann falling fast (critical at 55%)'],
  ['brann-bloodlet', 'HUD: Bloodletting, three swings'],
  ['brann-deathless', 'HUD: Deathless, Berserker’s Hymn tick'],
  ['brann-held', 'HUD: a Fermata hold on Brann'],
  ['brann-calls', 'HUD: Kael and Brann both call for a Ward'],
  ['brann-oath', 'HUD: Blood Oath bank and a Tithe Ward (healing not cut)'],
  ['brann-cleave', 'HUD: party B vs Twin Cleave (no dome)'],
  ['brann-execution', 'HUD: party B, Execution on Brann'],
];

export const BRANN_VIEWS: BrannLabView[] = [
  ...HUD_STATES.map(([scenario, label]): BrannLabView => ({
    id: `brann-hud-${scenario}`,
    group: GROUP,
    label,
    w: 1280,
    h: 720,
    render: () => <BrannStage scenario={scenario} />,
  })),
  {
    id: 'brann-hud-ally',
    group: GROUP,
    label: 'HUD: his first fight, the New ally card',
    w: 1280,
    h: 720,
    render: () => <BrannStage scenario="brann-raging" ally />,
  },
  ...(
    [
      ['default', CONTENT.defaultParty, 'Prep: the picker, the default party'],
      ['a', BRANN_PARTIES.A, 'Prep: party A (no Lyra)'],
      ['b', BRANN_PARTIES.B, 'Prep: party B (no Kael), keys 1/2/3 = Lyra/Vexis/Brann'],
      ['c', BRANN_PARTIES.C, 'Prep: party C (no Vexis)'],
      ['two', ['kael', 'brann'], 'Prep: two picked, Embark waits'],
    ] as const
  ).map(([id, party, label]): BrannLabView => ({
    id: `brann-prep-${id}`,
    group: GROUP,
    label,
    w: 1280,
    h: 1700,
    render: () => <PrepLab party={party} />,
  })),
  {
    id: 'brann-codex-locked',
    group: GROUP,
    label: 'Codex: Heroes, Brann locked (two routes)',
    w: 1280,
    h: 1400,
    render: () => <CodexView onBack={noop} initialTab="heroes" roster={CONTENT.defaultParty} />,
  },
  {
    id: 'brann-codex-calls-locked',
    group: GROUP,
    label: 'Codex: Calls, Brann locked',
    w: 1280,
    h: 1200,
    render: () => <CodexView onBack={noop} initialTab="calls" roster={CONTENT.defaultParty} />,
  },
  {
    id: 'brann-codex-motifs-locked',
    group: GROUP,
    label: 'Codex: Motifs, his Bond motifs waiting',
    w: 1280,
    h: 2600,
    render: () => <CodexView onBack={noop} initialTab="motifs" roster={CONTENT.defaultParty} />,
  },
  {
    id: 'brann-codex',
    group: GROUP,
    label: 'Codex: Heroes, Brann recruited (Passive, Needs)',
    w: 1280,
    h: 1600,
    render: () => <CodexView onBack={noop} initialTab="heroes" roster={ROSTER} />,
  },
  {
    id: 'brann-bonds',
    group: GROUP,
    label: 'Bonds: four tabs, Brann’s page',
    w: 1280,
    h: 900,
    render: () => <BondsLab />,
  },
  ...(
    [
      ['new', CONTENT.defaultParty, CONTENT.defaultParty, 'Event: the Cell, not yet recruited'],
      ['recruited', CONTENT.defaultParty, ROSTER, 'Event: the Cell, Brann recruited'],
      ['party', BRANN_PARTIES.A, ROSTER, 'Event: the Cell, Brann in the party'],
    ] as const
  ).map(([id, party, roster, label]): BrannLabView => ({
    id: `brann-event-${id}`,
    group: GROUP,
    label,
    w: 1280,
    h: 900,
    render: () => <EventView run={cellRun(party)} onChoose={noop} onLeave={noop} roster={roster} />,
  })),
  {
    id: 'brann-result-recruit',
    group: GROUP,
    label: 'Result: the Cell won, Brann joins next run',
    w: 1280,
    h: 1700,
    render: () => {
      const run = starterResultRun();
      return (
        <ResultView run={run} result={run.lastResult!} onContinue={noop} recruits={['brann']} />
      );
    },
  },
  {
    id: 'brann-result-fallback',
    group: GROUP,
    label: 'Result: the fallback (Vharun), the prisoner slipped his chain',
    w: 1280,
    h: 1700,
    render: () => {
      const run = starterResultRun();
      const result = { ...run.lastResult!, encounterId: 'vharun' };
      return <ResultView run={run} result={result} onContinue={noop} recruits={['brann']} />;
    },
  },
  {
    id: 'brann-result',
    group: GROUP,
    label: 'Result: Brann’s Blood Rage line',
    w: 1280,
    h: 1700,
    render: () => {
      const run = brannResultRun();
      return <ResultView run={run} result={run.lastResult!} onContinue={noop} />;
    },
  },
  {
    id: 'brann-summary',
    group: GROUP,
    label: 'Summary: Brann’s run line',
    w: 1280,
    h: 2000,
    render: () => <SummaryView run={brannSummaryRun()} onNewRun={noop} onLoom={noop} />,
  },
  {
    id: 'brann-draft-harmony',
    group: GROUP,
    label: 'Draft: Blood and Silk (Harmony) and what would enable it',
    w: 1280,
    h: 900,
    render: () => <DraftView run={harmonyDraftRun()} onPick={noop} onReroll={noop} />,
  },
];

/** A default-party fight's Result (the Cell's fight is the starters' too). */
function starterResultRun(): RunState {
  return brannResultRun(CONTENT.defaultParty);
}
