/**
 * The UI lab's 'Seren' group (docs/phase-5e.md): every state of Seren on screen, against mock
 * data. Prep with five and six heroes (her Parry row, its blades), her frames (en garde, Riposte
 * Chain's two parries, a duel outside your songs, overextended, out of your reach — never faded,
 * a kill shot due, Thousand Cuts, Blade Waltz, a boss blow she will parry), the 'New ally' card,
 * the Codex locked and unlocked (her terms), the Bonds tabs at six, the Tithe Altar, and the
 * Result's and Summary's duel line.
 */
import { useState, type ReactNode } from 'react';
import { CONTENT } from '../../content';
import { heroRoster } from '../../meta/profile';
import type { RunState } from '../../meta/types';
import type { Bond } from '../../meta/bonds';
import { HudView } from '../hud/Hud';
import { BondsView } from '../screens/BondsScreen';
import { CodexView } from '../screens/CodexScreen';
import { EventView } from '../screens/EventScreen';
import { PrepView } from '../screens/PrepScreen';
import { ResultView } from '../screens/ResultScreen';
import { SummaryView } from '../screens/SummaryScreen';
import {
  SEREN_PARTIES,
  brannPrepRun,
  labSetSolo,
  labSetTalent,
  mockBonds,
  recruitAllyCallouts,
  recruitEventRun,
  recruitResultRun,
  recruitSummaryRun,
  serenHud,
  withParty,
  type SerenScenario,
} from './mock';

export interface RecruitLabView {
  id: string;
  group: string;
  label: string;
  w: number;
  h: number;
  render(): ReactNode;
}

const noop = () => {};
const GROUP = 'Seren';
/** Five heroes: Brann and Seren recruited. */
const ROSTER5 = heroRoster({ recruited: ['brann', 'seren'] }, false);
/** All six. */
export const ROSTER6 = heroRoster({ recruited: ['brann', 'seren', 'oro'] }, false);

/** A stand-in for the 3D arena behind the HUD (as the lab's other HUD stages). */
export function LabWorld({ children }: { children: ReactNode }) {
  return (
    <div
      className="relative h-full w-full overflow-hidden"
      style={{
        background:
          'radial-gradient(ellipse at 50% 45%, #2a2238 0%, #17142a 60%, #0a0d1c 100%), repeating-linear-gradient(0deg, transparent 0 63px, rgb(255 255 255 / 0.04) 63px 64px)',
      }}
    >
      {children}
    </div>
  );
}

function SerenStage({ scenario, ally = false }: { scenario: SerenScenario; ally?: boolean }) {
  const hud = serenHud(scenario);
  return (
    <LabWorld>
      <HudView
        hud={hud}
        callouts={ally ? recruitAllyCallouts('seren') : []}
        decree={hud.boss?.decree ?? null}
        subtitle={hud.boss ? 'Movement I · node 7 of 7' : 'Movement I · node 3 of 7'}
        forceCoach
      />
    </LabWorld>
  );
}

/** Prep with the picker live: toggling heroes changes the run's party, as the store would. */
export function RecruitPrepLab({
  party,
  roster,
}: {
  party: readonly string[];
  roster: readonly string[];
}) {
  const [run, setRun] = useState<RunState>(() => brannPrepRun(party));
  return (
    <PrepView
      run={run}
      onChords={noop}
      onEmbark={noop}
      onBack={noop}
      rank={12}
      party={{ roster, onChange: (ids) => setRun((r) => withParty(r, ids)) }}
    />
  );
}

/** The Bonds screen with six tabs (3 × 2), opened on this hero. */
export function SixBondsLab({ hero }: { hero: 'seren' | 'oro' }) {
  const [bonds, setBonds] = useState<Record<string, Bond>>(() => ({
    ...mockBonds(4),
    brann: { xp: 900, talents: ['iron_will', null, null], solo: 'default', seen: {} },
    seren: { xp: 700, talents: ['riposte_chain', null, null], solo: 'default', seen: {} },
    oro: { xp: 600, talents: ['taproot', null, null], solo: 'default', seen: {} },
  }));
  return (
    <BondsView
      bonds={bonds}
      unlockAll={false}
      heroes={ROSTER6}
      onTalent={(h, tier, id) => setBonds((b) => labSetTalent(b, h, tier, id, false))}
      onSolo={(h, solo) => setBonds((b) => labSetSolo(b, h, solo, false))}
      onBack={noop}
      backTo="Prep"
      onRules={noop}
      initialHero={hero}
    />
  );
}

const HUD_STATES: readonly [SerenScenario, string][] = [
  ['seren-garde', 'HUD: Seren en garde (your Ward on her)'],
  ['seren-chain', 'HUD: Riposte Chain, Parry ×2'],
  ['seren-duel', 'HUD: duelling outside your songs'],
  ['seren-over', 'HUD: overextended, Reel her home'],
  ['seren-reach', 'HUD: out of your reach, outlined, never faded'],
  ['seren-killshot', 'HUD: a kill shot due'],
  ['seren-cuts', 'HUD: Thousand Cuts'],
  ['seren-waltz', 'HUD: Blade Waltz (the alternate Solo)'],
  ['seren-cast', 'HUD: a boss blow she will parry'],
];

export const SEREN_VIEWS: RecruitLabView[] = [
  ...HUD_STATES.map(([scenario, label]): RecruitLabView => ({
    id: `seren-hud-${scenario}`,
    group: GROUP,
    label,
    w: 1280,
    h: 720,
    render: () => <SerenStage scenario={scenario} />,
  })),
  {
    id: 'seren-hud-ally',
    group: GROUP,
    label: 'HUD: her first fight, the New ally card',
    w: 1280,
    h: 720,
    render: () => <SerenStage scenario="seren-garde" ally />,
  },
  ...(
    [
      ['five', SEREN_PARTIES.SA, ROSTER5, 'Prep: five heroes (3 × 2), party SA'],
      ['six', SEREN_PARTIES.SB, ROSTER6, 'Prep: six heroes (3 × 2), party SB (no Kael)'],
      ['w', ['vexis', 'seren', 'oro'], ROSTER6, 'Prep: party W (no Kael, no Lyra)'],
    ] as const
  ).map(([id, party, roster, label]): RecruitLabView => ({
    id: `seren-prep-${id}`,
    group: GROUP,
    label,
    w: 1280,
    h: 1800,
    render: () => <RecruitPrepLab party={party} roster={roster} />,
  })),
  {
    id: 'seren-codex-locked',
    group: GROUP,
    label: 'Codex: Heroes, Seren locked (Rank 8, two routes)',
    w: 1280,
    h: 1400,
    render: () => (
      <CodexView
        onBack={noop}
        initialTab="heroes"
        roster={heroRoster({ recruited: ['brann'] }, false)}
      />
    ),
  },
  {
    id: 'seren-codex',
    group: GROUP,
    label: 'Codex: Heroes, Seren recruited (Parry, Needs, Terms)',
    w: 1280,
    h: 1900,
    render: () => <CodexView onBack={noop} initialTab="heroes" roster={ROSTER5} />,
  },
  {
    id: 'seren-bonds',
    group: GROUP,
    label: 'Bonds: six tabs (3 × 2), Seren’s page',
    w: 1280,
    h: 900,
    render: () => <SixBondsLab hero="seren" />,
  },
  {
    id: 'seren-event',
    group: GROUP,
    label: 'Event: the Tithe Altar, four choices (2 × 2)',
    w: 1280,
    h: 900,
    render: () => (
      <EventView
        run={recruitEventRun('tithe_altar')}
        onChoose={noop}
        onLeave={noop}
        roster={CONTENT.defaultParty}
      />
    ),
  },
  {
    id: 'seren-result',
    group: GROUP,
    label: 'Result: Seren’s duel line (party SA)',
    w: 1280,
    h: 1700,
    render: () => {
      const run = recruitResultRun(SEREN_PARTIES.SA);
      return <ResultView run={run} result={run.lastResult!} onContinue={noop} />;
    },
  },
  {
    id: 'seren-result-recruit',
    group: GROUP,
    label: 'Result: the Matriarch fallback, Seren joins next run',
    w: 1280,
    h: 1700,
    render: () => {
      const run = recruitResultRun(CONTENT.defaultParty);
      const result = { ...run.lastResult!, encounterId: 'gorehound_matriarch' };
      return <ResultView run={run} result={result} onContinue={noop} recruits={['seren']} />;
    },
  },
  {
    id: 'seren-summary',
    group: GROUP,
    label: 'Summary: Seren’s run line (party SA)',
    w: 1280,
    h: 2000,
    render: () => (
      <SummaryView run={recruitSummaryRun(SEREN_PARTIES.SA)} onNewRun={noop} onLoom={noop} />
    ),
  },
];
