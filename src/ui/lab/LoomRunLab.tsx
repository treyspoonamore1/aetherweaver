import { useState, type ReactNode } from 'react';
import { CONTENT } from '../../content';
import { RANK_XP, allowanceFor } from '../../meta/profile';
import * as Run from '../../meta/run';
import type { RunState } from '../../meta/types';
import { noVariants } from '../../meta/variants';
import type { PartySlot } from '../../sim';
import { HudView } from '../hud/Hud';
import { CallingView } from '../screens/CallingScreen';
import { MapView } from '../screens/MapScreen';
import { PrepView } from '../screens/PrepScreen';
import { ResultView } from '../screens/ResultScreen';
import { SummaryView } from '../screens/SummaryScreen';
import { SpawnPalette } from '../screens/TrainingParts';
import { WardTrainerView } from '../screens/WardTrainer';
import type { DrillMode, DrillView } from '../screens/wardDrill';
import {
  masteryRun,
  masteryXpAt,
  mockDrillView,
  mockHistory,
  mockMastery,
  mockTry,
  withDeeds,
} from './loomRunMock';
import { mockDissonance, mockHud, prepCallingRun, resultRun, summaryRun } from './mock';

/**
 * The UI lab's views of Phase 4g's run-side screens (docs/phase-4g.md): Starlight on the Result
 * and the Summary, Calling mastery in Prep, on the tier screen and the map, and the Perfect-Ward
 * trainer's feedback. `LOOM_RUN_VIEWS` joins the lab's list (UiLab.tsx).
 */

/** The lab's view shape (UiLab.tsx's `ViewDef`). */
interface LabView {
  id: string;
  group: string;
  label: string;
  w: number;
  h: number;
  render(): ReactNode;
}

const noop = () => {};
const MASTERY = 'Starlight & mastery';
const TRAINER = 'Ward trainer';
const PICKS = ['haloed', 'searing_hymns', 'third_voice', 'eclipse'];

/** Profile XP at a Rank, `share` of the way to the next. */
function xpAt(rank: number, share = 0.4): number {
  const from = RANK_XP[rank - 1] ?? 0;
  const to = RANK_XP[rank] ?? from + 1000;
  return Math.round(from + (to - from) * share);
}

/** A Result with the Starlight panel: the profile at `rank` holding `starlight` and `mastery`. */
function loomResult(run: RunState, rank: number, starlight: number, mastery?: number) {
  return (
    <ResultView
      run={run}
      result={run.lastResult!}
      onContinue={noop}
      profileXp={xpAt(rank)}
      loom={{ starlight, rank, mastery }}
    />
  );
}

function loomSummary(run: RunState, rank: number, starlight: number, mastery?: number) {
  return (
    <SummaryView
      run={run}
      onNewRun={noop}
      onLoom={noop}
      profileXp={xpAt(rank)}
      loom={{ starlight, rank, mastery }}
    />
  );
}

/** The run's mastery XP, `after` the gain the last fight (or the run) earned. */
const gainedFrom = (run: RunState, after: number) => Math.max(after, run.lastResult?.xp ?? 0);

/** Prep at Rank 12 with the Luminary chosen, its mastery at `xp` (the others' as given). */
function PrepMastery({
  xp,
  all = false,
  openPath,
}: {
  xp: Readonly<Record<string, number>>;
  all?: boolean;
  openPath?: string;
}) {
  const allowance = allowanceFor(12);
  const [run, setRun] = useState<RunState>(() => prepCallingRun(true));
  return (
    <PrepView
      run={run}
      onChords={(c) => setRun((r) => Run.setChords(r, c, allowance))}
      onCalling={(id) => setRun((r) => Run.setCalling(r, id, allowance))}
      onEmbark={noop}
      onBack={noop}
      allowance={allowance}
      rank={12}
      openCallingPath={openPath}
      mastery={mockMastery(xp, all)}
      techniques={{ owned: [], all, onChoose: noop, expanded: false }}
    />
  );
}

/** A stand-in for the arena (UiLab.tsx's `World`). */
function Floor({ children }: { children: ReactNode }) {
  return (
    <div
      className="relative h-full w-full overflow-hidden"
      style={{
        background:
          'radial-gradient(ellipse at 50% 45%, #2a3354 0%, #161c33 60%, #0a0d1c 100%), repeating-linear-gradient(0deg, transparent 0 63px, rgb(255 255 255 / 0.04) 63px 64px)',
      }}
    >
      <div className="absolute left-1/2 top-[44%] h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-dashed border-gold-400/30" />
      {children}
    </div>
  );
}

/** The Training Grounds: the sandbox's HUD and tools, and the trainer at the top. */
function TrainerStage({ view, folded = false }: { view: DrillView; folded?: boolean }) {
  const [v, setV] = useState(view);
  return (
    <Floor>
      <HudView
        hud={mockHud('sandbox')}
        callouts={[]}
        decree={null}
        subtitle="Sandbox"
        keyHints={false}
      />
      <SpawnPalette
        loadout={Run.CHORD_PRESETS[0]!.id}
        onLoadout={noop}
        techniques={noVariants()}
        onTechnique={noop}
      />
      <WardTrainerView
        view={v}
        folded={folded}
        onStart={() => setV((x) => ({ ...x, running: true }))}
        onStop={() => setV((x) => ({ ...x, running: false, status: { kind: 'idle' } }))}
        onMode={(mode: DrillMode) => setV((x) => ({ ...x, mode }))}
        onTarget={(target: PartySlot) => setV((x) => ({ ...x, target }))}
        className="absolute left-1/2 top-4 -translate-x-1/2"
      />
    </Floor>
  );
}

const top = CONTENT.mastery.levels.length;

export const LOOM_RUN_VIEWS: LabView[] = [
  // ── Starlight on the Result and the Summary, with the mastery earned ───────────────
  {
    id: 'result-starlight',
    group: MASTERY,
    label: 'Result: Starlight beside the XP, the Luminary’s mastery (Rank 9)',
    w: 1280,
    h: 1500,
    render: () => {
      const run = masteryRun({ tiers: 2, picks: PICKS, result: 3 });
      return loomResult(run, 9, 126, gainedFrom(run, masteryXpAt(2, 0.55)));
    },
  },
  {
    id: 'result-starlight-level',
    group: MASTERY,
    label: 'Result: a fight that reached mastery 3 (tier III, from the next run)',
    w: 1280,
    h: 1500,
    render: () => {
      const run = masteryRun({ tiers: 2, picks: PICKS, result: 3 });
      return loomResult(run, 9, 126, masteryXpAt(3) + 6);
    },
  },
  {
    id: 'result-starlight-boss',
    group: MASTERY,
    label: 'Result: the boss won, the run’s bonus; top mastery (its title and Chorale)',
    w: 1280,
    h: 1500,
    render: () => {
      const run = masteryRun({ tiers: 4, picks: PICKS, result: 'boss' });
      return loomResult(run, 12, 342, masteryXpAt(top) + 4);
    },
  },
  {
    id: 'result-starlight-closed',
    group: MASTERY,
    label: 'Result: before the Atelier opens (Rank 3, no Calling)',
    w: 1280,
    h: 1500,
    render: () => loomResult(resultRun(true), 3, 9),
  },
  {
    id: 'result-starlight-loss',
    group: MASTERY,
    label: 'Result: a loss pays no Starlight; the mastery still counts',
    w: 1280,
    h: 1600,
    render: () => {
      const run = masteryRun({ tiers: 1, picks: PICKS, result: 2, lose: true });
      return loomResult(run, 7, 12, gainedFrom(run, masteryXpAt(1, 0.5)));
    },
  },
  {
    id: 'summary-starlight',
    group: MASTERY,
    label: 'Summary: the run’s Starlight (fights, the win, Deeds); top mastery reached',
    w: 1280,
    h: 1400,
    render: () => {
      const run = withDeeds(masteryRun({ tiers: 4, picks: PICKS }));
      return loomSummary(run, 12, 418, masteryXpAt(4, 0.75) + run.xp);
    },
  },
  {
    id: 'summary-starlight-locked',
    group: MASTERY,
    label: 'Summary: tiers III and IV locked by mastery; mastery 3 reached',
    w: 1280,
    h: 1400,
    render: () => {
      const run = masteryRun({ tiers: 2, picks: PICKS });
      // It embarked at mastery 2; the run's Weaver XP takes it past 3's threshold.
      return loomSummary(
        run,
        9,
        205,
        Math.max(masteryXpAt(2, 0.6), masteryXpAt(3) - run.xp + 40) + run.xp,
      );
    },
  },
  {
    id: 'summary-starlight-dissonance',
    group: MASTERY,
    label: 'Summary: a run at Dissonance (its fights paid more)',
    w: 1280,
    h: 1500,
    render: () => {
      const run = masteryRun({ tiers: 4, picks: PICKS, dissonance: mockDissonance(12) });
      return loomSummary(run, 16, 760, masteryXpAt(top) + 400);
    },
  },
  {
    id: 'summary-starlight-closed',
    group: MASTERY,
    label: 'Summary: a lost run before the Atelier opens (Rank 3)',
    w: 1280,
    h: 1300,
    render: () => loomSummary(summaryRun('defeat'), 3, 21),
  },
  // ── Mastery in Prep, on the tier screen and on the map ──────────────────────────────
  {
    id: 'prep-mastery-1',
    group: MASTERY,
    label: 'Prep: the Luminary at mastery 1 (tier I only)',
    w: 1280,
    h: 900,
    render: () => (
      <PrepMastery xp={{ luminary: masteryXpAt(1, 0.3), martyr: masteryXpAt(2, 0.5) }} />
    ),
  },
  {
    id: 'prep-mastery-3',
    group: MASTERY,
    label: 'Prep: the Luminary at mastery 3 (tiers I–III; IV next)',
    w: 1280,
    h: 900,
    render: () => (
      <PrepMastery xp={{ luminary: masteryXpAt(3, 0.6), martyr: masteryXpAt(2, 0.5) }} />
    ),
  },
  {
    id: 'prep-mastery-5',
    group: MASTERY,
    label: 'Prep: the Luminary mastered (its title and Chorale)',
    w: 1280,
    h: 900,
    render: () => (
      <PrepMastery xp={{ luminary: masteryXpAt(top) + 120, martyr: masteryXpAt(4, 0.2) }} />
    ),
  },
  {
    id: 'prep-mastery-path',
    group: MASTERY,
    label: 'Prep: the path dialog at mastery 2 (III and IV locked)',
    w: 1280,
    h: 900,
    render: () => <PrepMastery xp={{ luminary: masteryXpAt(2, 0.4) }} openPath="luminary" />,
  },
  {
    id: 'prep-mastery-skip',
    group: MASTERY,
    label: 'Prep: Skip the unlocks (every tier, whatever the mastery)',
    w: 1280,
    h: 900,
    render: () => <PrepMastery xp={{ luminary: masteryXpAt(1, 0.3) }} all />,
  },
  {
    id: 'calling-mastery',
    group: MASTERY,
    label: 'Tier screen: tier II on offer, III and IV locked by mastery',
    w: 1280,
    h: 1000,
    render: () => (
      <CallingView
        run={masteryRun({ tiers: 2, picks: PICKS, untilTier: 1 })}
        onPick={noop}
        mastery={masteryXpAt(2, 0.7)}
      />
    ),
  },
  {
    id: 'map-mastery',
    group: MASTERY,
    label: 'Map: the strip with tiers III and IV locked (tooltip)',
    w: 1280,
    h: 860,
    render: () => (
      <MapView
        run={masteryRun({ tiers: 2, picks: ['wide_choir', 'searing_hymns'], fights: 4 })}
        onChoose={noop}
        onAbandon={noop}
        peekCalling
      />
    ),
  },
  {
    id: 'hud-mastery',
    group: MASTERY,
    label: 'HUD: the Calling’s chip, tiers II–IV locked by mastery this run',
    w: 1280,
    h: 720,
    render: () => (
      <Floor>
        <HudView
          hud={mockHud('luminary')}
          callouts={[]}
          decree={null}
          subtitle="The Prelude · node 2 of 10"
          coach={false}
          tiersOpen={1}
        />
      </Floor>
    ),
  },
  // ── The Perfect-Ward trainer ─────────────────────────────────────────────────────────
  {
    id: 'trainer-ready',
    group: TRAINER,
    label: 'Training Grounds: the trainer, before a drill',
    w: 1280,
    h: 720,
    render: () => <TrainerStage view={mockDrillView({ running: false, best: 7 })} />,
  },
  {
    id: 'trainer-perfect',
    group: TRAINER,
    label: 'Trainer: Perfect, a streak of 4 (a new best), the next blow on the beat',
    w: 1280,
    h: 720,
    render: () => (
      <TrainerStage
        view={mockDrillView({
          last: mockTry('perfect', { cast: -0.14 }),
          history: mockHistory('missed', 'early', 'perfect', 'perfect', 'perfect', 'perfect'),
          streak: 4,
          best: 4,
          newBest: true,
          status: { kind: 'next', slot: 0, speed: 'slow', seconds: 2.4 },
        })}
      />
    ),
  },
  {
    id: 'trainer-early',
    group: TRAINER,
    label: 'Trainer: early by 180 ms (Warded, not Perfect), the next blow in 1.2 s',
    w: 1280,
    h: 720,
    render: () => (
      <TrainerStage
        view={mockDrillView({
          mode: 'normal',
          target: 1,
          last: mockTry('warded', { speed: 'normal', slot: 1, cast: -0.53 }),
          history: mockHistory('perfect', 'perfect', 'early'),
          best: 6,
          status: { kind: 'next', slot: 1, speed: 'normal', seconds: 1.2 },
        })}
      />
    ),
  },
  {
    id: 'trainer-late',
    group: TRAINER,
    label: 'Trainer: late by 90 ms, a blow winding up',
    w: 1280,
    h: 720,
    render: () => (
      <TrainerStage
        view={mockDrillView({
          mode: 'quick',
          target: 2,
          last: mockTry('hit', { speed: 'quick', slot: 2, cast: 0.09 }),
          history: mockHistory('perfect', 'late', 'perfect', 'late'),
          best: 3,
          status: { kind: 'blow', slot: 2, speed: 'quick' },
        })}
      />
    ),
  },
  {
    id: 'trainer-missed',
    group: TRAINER,
    label: 'Trainer: mixed, missed (the Ward went to Lyra)',
    w: 1280,
    h: 720,
    render: () => (
      <TrainerStage
        view={mockDrillView({
          mode: 'mixed',
          last: mockTry('hit', { speed: 'quick', slot: 0, cast: -0.1, castSlot: 1 }),
          history: mockHistory('perfect', 'late', 'perfect', 'early', 'perfect', 'missed'),
          best: 2,
          status: { kind: 'next', slot: 2, speed: 'slow', seconds: 0.8 },
        })}
      />
    ),
  },
  {
    id: 'trainer-folded',
    group: TRAINER,
    label: 'Trainer: folded to its title (a streak of 2)',
    w: 1280,
    h: 720,
    render: () => (
      <TrainerStage
        folded
        view={mockDrillView({ streak: 2, best: 5, history: mockHistory('perfect', 'perfect') })}
      />
    ),
  },
];
