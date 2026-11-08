/**
 * The UI lab's 'Oro' group (docs/phase-5e.md): every state of Oro on screen, against mock data.
 * His frames (two Saplings in your songs, one outside, one felled with its re-sprout timer, none
 * standing, a Cued Ancient, Seedling Swarm's three, tending with no Focus, a Rally's burrow), the
 * 'New ally' card, Prep (his Rootbond and Saplings rows; party OB's note), the Codex (Saplings and
 * the Ancient, his terms), the Bonds tabs at six, the Loose Thread, and the Result's and Summary's
 * grove lines, with Seren beside him.
 */
import { HudView } from '../hud/Hud';
import { CodexView } from '../screens/CodexScreen';
import { EpilogueView } from '../screens/EpilogueView';
import { EventView } from '../screens/EventScreen';
import { ResultView } from '../screens/ResultScreen';
import { SummaryView } from '../screens/SummaryScreen';
import { CONTENT } from '../../content';
import {
  DUO_PARTIES,
  ORO_PARTIES,
  oroHud,
  recruitAllyCallouts,
  recruitEventRun,
  recruitResultRun,
  recruitSummaryRun,
  type OroScenario,
} from './mock';
import { LabWorld, ROSTER6, RecruitPrepLab, SixBondsLab, type RecruitLabView } from './serenLab';

const noop = () => {};
const GROUP = 'Oro';

function OroStage({ scenario, ally = false }: { scenario: OroScenario; ally?: boolean }) {
  return (
    <LabWorld>
      <HudView
        hud={oroHud(scenario)}
        callouts={ally ? recruitAllyCallouts('oro') : []}
        decree={null}
        subtitle="Movement I · node 3 of 7"
        forceCoach
      />
    </LabWorld>
  );
}

const HUD_STATES: readonly [OroScenario, string][] = [
  ['oro-grove', 'HUD: two Saplings in your songs'],
  ['oro-outside', 'HUD: a Sapling outside your songs'],
  ['oro-felled', 'HUD: a Sapling felled, its re-sprout timer'],
  ['oro-bare', 'HUD: no Sapling standing'],
  ['oro-ancient', 'HUD: the Cued Ancient, its disc your field'],
  ['oro-swarm', 'HUD: Seedling Swarm, three Saplings in 19 rem'],
  ['oro-tending', 'HUD: tending, no Focus (the closed leaf)'],
  ['oro-burrow', 'HUD: a Rally, the Saplings burrowing'],
];

export const ORO_VIEWS: RecruitLabView[] = [
  ...HUD_STATES.map(([scenario, label]): RecruitLabView => ({
    id: `oro-hud-${scenario}`,
    group: GROUP,
    label,
    w: 1280,
    h: 720,
    render: () => <OroStage scenario={scenario} />,
  })),
  {
    id: 'oro-hud-ally',
    group: GROUP,
    label: 'HUD: his first fight, the New ally card',
    w: 1280,
    h: 720,
    render: () => <OroStage scenario="oro-grove" ally />,
  },
  ...(
    [
      ['oa', ORO_PARTIES.OA, 'Prep: party OA (Rootbond, Saplings)'],
      ['ob', ORO_PARTIES.OB, 'Prep: party OB (no Kael: the hardest party)'],
      ['so', DUO_PARTIES.SO, 'Prep: Kael, Seren and Oro'],
    ] as const
  ).map(([id, party, label]): RecruitLabView => ({
    id: `oro-prep-${id}`,
    group: GROUP,
    label,
    w: 1280,
    h: 1800,
    render: () => <RecruitPrepLab party={party} roster={ROSTER6} />,
  })),
  {
    id: 'oro-codex',
    group: GROUP,
    label: 'Codex: Heroes, all six (Saplings and the Ancient, Terms)',
    w: 1280,
    h: 2200,
    render: () => <CodexView onBack={noop} initialTab="heroes" roster={ROSTER6} />,
  },
  {
    id: 'oro-bonds',
    group: GROUP,
    label: 'Bonds: six tabs (3 × 2), Oro’s page',
    w: 1280,
    h: 900,
    render: () => <SixBondsLab hero="oro" />,
  },
  {
    id: 'oro-event',
    group: GROUP,
    label: 'Event: the Loose Thread, four choices (2 × 2)',
    w: 1280,
    h: 900,
    render: () => (
      <EventView
        run={recruitEventRun('loose_thread')}
        onChoose={noop}
        onLeave={noop}
        roster={CONTENT.defaultParty}
      />
    ),
  },
  {
    id: 'oro-result',
    group: GROUP,
    label: 'Result: Oro’s grove line (party OA)',
    w: 1280,
    h: 1700,
    render: () => {
      const run = recruitResultRun(ORO_PARTIES.OA);
      return <ResultView run={run} result={run.lastResult!} onContinue={noop} />;
    },
  },
  {
    id: 'oro-result-duo',
    group: GROUP,
    label: 'Result: Seren and Oro together, both lines',
    w: 1280,
    h: 1700,
    render: () => {
      const run = recruitResultRun(DUO_PARTIES.SO);
      return <ResultView run={run} result={run.lastResult!} onContinue={noop} />;
    },
  },
  {
    id: 'oro-summary',
    group: GROUP,
    label: 'Summary: Seren and Oro, their run lines',
    w: 1280,
    h: 2000,
    render: () => (
      <SummaryView run={recruitSummaryRun(DUO_PARTIES.SO)} onNewRun={noop} onLoom={noop} />
    ),
  },
  {
    id: 'oro-epilogue',
    group: GROUP,
    label: 'Epilogue: party W (Seren answers the Conductor)',
    w: 1280,
    h: 900,
    render: () => <EpilogueView party={DUO_PARTIES.W} onDone={noop} still />,
  },
];
