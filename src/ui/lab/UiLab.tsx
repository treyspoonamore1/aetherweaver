import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { COLOR_VISIONS, applyVisionCss } from '../../app/colorVision';
import {
  EVERYTHING,
  MAX_RANK,
  RANK_XP,
  UNLOCKS,
  allowanceFor,
  type Allowance,
} from '../../meta/profile';
import * as Run from '../../meta/run';
import { applyUiScale } from '../presentation';
import type { RunState } from '../../meta/types';
import { HudView } from '../hud/Hud';
import { HowToPlay } from '../hud/HowToPlay';
import { PauseMenu } from '../hud/PauseMenu';
import { Button } from '../kit/Button';
import { ScreenFrame, ScreenHeader } from '../kit/Backdrop';
import { ChordBuilder } from '../screens/ChordBuilder';
import { CallingView } from '../screens/CallingScreen';
import { CodexView } from '../screens/CodexScreen';
import { DraftView } from '../screens/DraftScreen';
import { EventView } from '../screens/EventScreen';
import { ForgeView } from '../screens/ForgeScreen';
import { MerchantView } from '../screens/MerchantScreen';
import { RelicOfferView } from '../screens/RelicScreen';
import { CONTENT, callingDef } from '../../content';
import type { ActiveBoon, ChordLoadout, ForgeService } from '../../meta/types';
import { MapView } from '../screens/MapScreen';
import { PrepView } from '../screens/PrepScreen';
import { RespiteView } from '../screens/RespiteScreen';
import { ResultView } from '../screens/ResultScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { SummaryView } from '../screens/SummaryScreen';
import { TitleScreen } from '../screens/TitleScreen';
import { RankPanelView, RankUpCard } from '../screens/Rank';
import {
  draftRun,
  eventAfter,
  eventFightResultRun,
  eventRun,
  fakeOutcome,
  forgeAfter,
  forgeRun,
  mapRun3b,
  merchantRun,
  nodeOf,
  relicOfferRun,
  freshRun,
  mockCallouts,
  mockHud,
  mockRankUps,
  mockWheel,
  playedRun,
  respiteRun,
  resultRun,
  summaryRun,
  type HudScenario,
  callingMapRun,
  callingOfferRun,
  callingResultRun,
  callingSummaryRun,
  milestoneNode,
  prepCallingRun,
  GUARDIAN_CHORDS,
  MARTYR_PICKS,
  OVER_LIFE_CHORDS,
  martyrOfferRun,
  martyrResultRun,
  martyrRun,
  martyrSummaryRun,
  CHRONO_PICKS,
  chronoOfferRun,
  chronoResultRun,
  chronoRun,
  chronoSummaryRun,
  KEYSTONE_TREE,
  LIGHT_TREE,
  RANK12_TREE,
  RANK20_TREE,
  SANGUINE_TREE,
  heavierSongs,
  ALL_DEEDS,
  EARLY_DEEDS,
  SOME_DEEDS,
  deedsSummaryRun,
  mockDeeds,
} from './mock';
import { useProfile } from '../../app/profileStore';
import { ControlsSettings } from '../screens/ControlsSettings';
import { AstrolabeView } from '../screens/AstrolabeScreen';
import { allocate, astrolabePoints, refund } from '../../meta/astrolabe';
import { deedPoints } from '../../meta/deeds';
import { DeedToastCard, TOAST_PLACE } from '../screens/DeedsParts';
import { DeedToasts } from '../screens/DeedToasts';
import { deedToast, pointSources } from '../screens/deedsModel';

/** A stand-in for the 3D arena behind the HUD. */
function World({ children }: { children: ReactNode }) {
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

function HudStage({
  scenario,
  coach,
  wheel = null,
  boons,
  relicFlash,
}: {
  scenario: HudScenario;
  coach?: boolean;
  wheel?: ReturnType<typeof mockWheel> | null;
  boons?: ActiveBoon[];
  relicFlash?: string[];
}) {
  return (
    <World>
      <HudView
        wheel={wheel}
        hud={mockHud(scenario)}
        callouts={mockCallouts(scenario)}
        decree={
          scenario === 'boss'
            ? {
                name: 'Requiem',
                text: 'Every hero will lose 90% of their life. Cue Kael’s dome, or Ward and heal.',
              }
            : null
        }
        subtitle={scenario === 'sandbox' ? 'Training Grounds' : 'The Prelude · node 3 of 10'}
        coach={coach}
        forceCoach
        boons={boons}
        relicFlash={relicFlash}
      />
    </World>
  );
}

/** Holds a run in local state, so a screen's buttons really work. */
function Interactive({
  initial,
  children,
}: {
  initial(): RunState;
  children: (run: RunState, set: (fn: (r: RunState) => RunState) => void) => ReactNode;
}) {
  const [run, setRun] = useState(initial);
  return <>{children(run, (fn) => setRun(fn))}</>;
}

/** The whole Prelude with fake combats: click through every screen to the summary. */
function Flow() {
  const [run, setRun] = useState<RunState>(() => freshRun(11));
  const set = (fn: (r: RunState) => RunState) => setRun(fn);
  switch (run.phase) {
    case 'prep':
      return (
        <PrepView
          run={run}
          onChords={(c) => set((r) => Run.setChords(r, c))}
          onCalling={(id) => set((r) => Run.setCalling(r, id))}
          onEmbark={() => set(Run.embark)}
          onBack={() => set(() => freshRun(Math.floor(Math.random() * 999)))}
        />
      );
    case 'map':
      return (
        <MapView
          run={run}
          onChoose={(id) => set((r) => Run.chooseNode(r, id))}
          onAbandon={() => set(Run.abandon)}
        />
      );
    case 'combat':
      return (
        <World>
          <div className="flex h-full flex-col items-center justify-center gap-4">
            <p className="font-display text-2xl text-gold-300">
              Combat (the 3D view is not rendered in the lab)
            </p>
            <div className="flex gap-3">
              <Button
                variant="primary"
                onClick={() => set((r) => Run.finishCombat(r, fakeOutcome(r, true)))}
              >
                Win this fight
              </Button>
              <Button
                onClick={() =>
                  set((r) => Run.finishCombat(r, fakeOutcome(r, false, { deaths: 2 })))
                }
              >
                Lose it
              </Button>
            </div>
          </div>
        </World>
      );
    case 'result':
      return run.lastResult ? (
        <ResultView
          run={run}
          result={run.lastResult}
          onContinue={() => set(Run.continueFromResult)}
        />
      ) : null;
    case 'draft':
      return (
        <DraftView
          run={run}
          onPick={(i) => set((r) => Run.pickDraft(r, i))}
          onReroll={() => set(Run.rerollDraft)}
        />
      );
    case 'respite':
      return (
        <RespiteView
          run={run}
          onChoose={(c) => set((r) => Run.respite(r, c))}
          onRetune={(c) => set((r) => Run.retune(r, c))}
        />
      );
    case 'summary':
      return (
        <SummaryView
          run={run}
          onNewRun={() => set(() => freshRun(Math.floor(Math.random() * 999)))}
          onTitle={() => set(() => freshRun(11))}
        />
      );
    case 'relic':
      return <RelicOfferView run={run} onPick={(i) => set((r) => Run.pickRelic(r, i))} />;
    case 'calling':
      return <CallingView run={run} onPick={(i, c) => set((r) => Run.pickCalling(r, i, c))} />;
    case 'merchant':
      return (
        <MerchantView
          run={run}
          onBuy={(i) => set((r) => Run.buy(r, i))}
          onLeave={() => set(Run.leaveShop)}
        />
      );
    case 'forge':
      return (
        <ForgeView
          run={run}
          onForge={(c) => set((r) => Run.forge(r, c))}
          onLeave={() => set(Run.leaveForge)}
        />
      );
    case 'event':
      return (
        <EventView
          run={run}
          onChoose={(id, opts) => set((r) => Run.chooseEvent(r, id, opts))}
          onLeave={() => set(Run.leaveEvent)}
        />
      );
  }
}

/** Unison with Reverb, Unison in the field song, and more Spirit reserved than there is. */
function IllegalBuilder() {
  const [draft, setDraft] = useState(() => [
    { auras: ['fortissimo', 'ostinato'], ornaments: ['reverb'] },
    { auras: ['allegro', 'lullaby'], ornaments: ['unison'] },
  ]);
  return <ChordBuilder value={draft} onChange={setDraft} />;
}

/** Remembered songs that the Rank no longer allows (say, after Reset progress). */
function LockedBuilder() {
  const [draft, setDraft] = useState(() => [
    { auras: ['fortissimo', 'allegro'], ornaments: ['unison'] },
    { auras: ['fermata'], ornaments: ['grace_note'] },
  ]);
  return <ChordBuilder value={draft} onChange={setDraft} allowance={allowanceFor(2)} />;
}

/** The song builder on a Martyr run: the Life budget, Blood Font and Low-Life Vigil marked. */
function LifeBuilder({ initial }: { initial: readonly ChordLoadout[] }) {
  const [draft, setDraft] = useState(() => initial.map((c) => ({ ...c, auras: [...c.auras] })));
  const calling = { id: 'martyr', path: [...MARTYR_PICKS] };
  return (
    <ScreenFrame>
      <div className="mx-auto max-w-7xl px-6 py-8">
        <ScreenHeader eyebrow="Song builder · the Martyr" title="Your songs hold your Life" />
        <div className="mt-6">
          <ChordBuilder value={draft} onChange={setDraft} pool="life" calling={calling} />
        </div>
      </div>
    </ScreenFrame>
  );
}

/**
 * Prep with the Calling picker: at a Rank (null: everything open), a Calling chosen (`true`:
 * the Luminary) or not, a Calling's path dialog open (`true`: the Luminary's).
 */
function prepCalling(
  rank: number | null,
  opts: { chosen?: boolean | string; openPath?: boolean | string } = {},
) {
  const allowance: Allowance = rank === null ? EVERYTHING : allowanceFor(rank);
  const fresh = rank === null ? [] : UNLOCKS.filter((u) => u.rank === rank);
  const openPath = opts.openPath === true ? 'luminary' : opts.openPath || undefined;
  return (
    <Interactive initial={() => prepCallingRun(opts.chosen ?? false)}>
      {(run, set) => (
        <PrepView
          run={run}
          onChords={(c) => set((r) => Run.setChords(r, c, allowance))}
          onCalling={(id) => set((r) => Run.setCalling(r, id, allowance))}
          onEmbark={noop}
          onBack={noop}
          allowance={allowance}
          fresh={fresh}
          rank={rank ?? MAX_RANK}
          openCallingPath={openPath}
        />
      )}
    </Interactive>
  );
}

/** Prep at a given Rank, with that Rank's unlocks marked New. */
function prepAt(rank: number | null, preset = 'steady', seed = 7) {
  const allowance: Allowance = rank === null ? EVERYTHING : allowanceFor(rank);
  const fresh = rank === null ? [] : UNLOCKS.filter((u) => u.rank === rank);
  const chords = Run.CHORD_PRESETS.find((p) => p.id === preset)!.chords;
  return (
    <Interactive initial={() => Run.newRun(seed, chords)}>
      {(run, set) => (
        <PrepView
          run={run}
          onChords={(c) => set((r) => Run.setChords(r, c, allowance))}
          onEmbark={noop}
          onBack={noop}
          allowance={allowance}
          fresh={fresh}
          rank={rank ?? 6}
        />
      )}
    </Interactive>
  );
}

/**
 * The Astrolabe at a Rank with a tree, held in local state so taking, giving back and Respec
 * really work (`allocate` / `refund`, as the profile store does). `points` overrides the Rank's
 * (an over-budget tree); `point` draws a star's path as if pointed at.
 */
function AstrolabeLab({
  rank,
  initial = [],
  points,
  point = null,
  respec = false,
  unlockAll = false,
  deeds,
}: {
  rank: number;
  initial?: readonly string[];
  points?: number;
  point?: string | null;
  respec?: boolean;
  unlockAll?: boolean;
  /** Phase 4b: the Deeds earned (their points, and where the points come from, shown). */
  deeds?: readonly string[];
}) {
  const [tree, setTree] = useState<string[]>(() => [...initial]);
  const [codex, setCodex] = useState(false);
  const pts = points ?? astrolabePoints(rank, unlockAll, deedPoints(deeds ?? []));
  if (codex && deeds) {
    return (
      <CodexView
        onBack={() => setCodex(false)}
        initialTab="deeds"
        allowance={unlockAll ? EVERYTHING : allowanceFor(rank)}
        rank={rank}
        deeds={mockDeeds(deeds)}
      />
    );
  }
  return (
    <AstrolabeView
      tree={tree}
      points={pts}
      sources={deeds ? pointSources(rank, unlockAll, deeds) : undefined}
      onDeeds={deeds ? () => setCodex(true) : undefined}
      rank={rank}
      unlockAll={unlockAll}
      onTake={(id) => setTree((t) => allocate(t, id, pts))}
      onGiveBack={(id) => setTree((t) => refund(t, id))}
      onRespec={() => setTree([])}
      onBack={noop}
      backTo="Prep"
      initialPoint={point}
      initialRespec={respec}
    />
  );
}

/**
 * The song builder with a tree (Phase 4): the run's pool and the tree's share of it, as Prep
 * reads them (`Run.reservePool`, `Run.reserveMult`).
 */
function TreeBuilder({
  tree,
  initial,
  title,
}: {
  tree: readonly string[];
  initial: readonly ChordLoadout[];
  title: string;
}) {
  const [draft, setDraft] = useState(() => initial.map((c) => ({ ...c, auras: [...c.auras] })));
  const run = Run.newRun(7, undefined, tree);
  return (
    <ScreenFrame>
      <div className="mx-auto max-w-7xl px-6 py-8">
        <ScreenHeader eyebrow="Song builder · the Astrolabe" title={title} />
        <div className="mt-6">
          <ChordBuilder
            value={draft}
            onChange={setDraft}
            pool={Run.reservePool(run)}
            reserveMult={Run.reserveMult(run)}
            astrolabe={tree}
          />
        </div>
      </div>
    </ScreenFrame>
  );
}

/**
 * The Title with a profile at a Rank and a tree (the lab sets the profile store once, without
 * saving it).
 */
function TitleAt({ rank, tree }: { rank: number; tree: readonly string[] }) {
  useState(() => {
    const p = useProfile.getState().profile;
    useProfile.setState({
      profile: { ...p, xp: RANK_XP[rank - 1]! + 10, astrolabe: [...tree], runs: 9, wins: 4 },
    });
    return true;
  });
  return <TitleScreen />;
}

/** Four auras, more than all of Spirit: too heavy without a lighter tree. */
const HEAVY_CHORDS: readonly ChordLoadout[] = [
  { auras: ['fortissimo', 'ostinato'], ornaments: [] },
  { auras: ['sostenuto', 'allegro'], ornaments: [] },
];

/** Profile XP for the lab's result and summary screens (Rank 3, partway to 4). */
const LAB_XP = 318;

/**
 * A Deed's toast where the app puts it (bottom left), over a screen (Phase 4b). The stage is
 * transformed, so the toast's fixed place is the stage's corner.
 */
function ToastStage({
  id,
  index = 0,
  total = 1,
  behind,
}: {
  id: string;
  index?: number;
  total?: number;
  behind?: ReactNode;
}) {
  const toast = deedToast(id);
  return (
    <div className="relative h-full w-full">
      {behind ?? (
        <ScreenFrame tone="gold">
          <div />
        </ScreenFrame>
      )}
      {toast && (
        <div className={TOAST_PLACE}>
          <DeedToastCard toast={toast} index={index} total={total} />
        </div>
      )}
    </div>
  );
}

/**
 * The live toast layer as the app mounts it, fed from the profile store: earn three Deeds, or
 * three with a rank-up (the toasts wait for its card). Plays the sounds.
 */
function ToastQueueLab() {
  const rankUps = useProfile((s) => s.rankUps);
  const notices = useProfile((s) => s.deedNotices);
  const three = ['heard', 'every_call', 'dawns_herald'];
  return (
    <ScreenFrame tone="gold">
      <div className="mx-auto max-w-3xl px-6 py-10">
        <ScreenHeader eyebrow="Deeds" title="The toasts, live" />
        <p className="mt-3 text-sm text-muted">
          One toast per Deed, one after another, each with its sound; then the notices are
          dismissed. With a rank-up, the toasts wait until its card is dismissed.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button
            variant="primary"
            onClick={() => useProfile.setState({ deedNotices: three })}
            sound={null}
          >
            Earn three Deeds
          </Button>
          <Button
            onClick={() => useProfile.setState({ deedNotices: three, rankUps: mockRankUps([4]) })}
            sound={null}
          >
            Three, with a rank-up
          </Button>
        </div>
        <p className="mt-4 font-mono text-xs text-muted">
          Waiting: {notices.length > 0 ? notices.join(', ') : 'none'}
        </p>
      </div>
      {rankUps.length > 0 && (
        <RankUpCard rankUps={rankUps} onDismiss={() => useProfile.getState().dismissRankUps()} />
      )}
      <DeedToasts />
    </ScreenFrame>
  );
}

interface ViewDef {
  id: string;
  group: string;
  label: string;
  /** Design size of the stage. */
  w: number;
  h: number;
  render(): ReactNode;
}

const noop = () => {};

const VIEWS: ViewDef[] = [
  {
    id: 'hud-calm',
    group: 'Combat HUD',
    label: 'Mid-fight',
    w: 1280,
    h: 720,
    render: () => <HudStage scenario="calm" />,
  },
  {
    id: 'hud-beam',
    group: 'Combat HUD',
    label: 'Beam song on Lyra (outside the field), readout',
    w: 1280,
    h: 720,
    render: () => <HudStage scenario="beam" />,
  },
  {
    id: 'hud-crisis',
    group: 'Combat HUD',
    label: 'Crisis: low HP, lethal forecast, marks',
    w: 1280,
    h: 720,
    render: () => <HudStage scenario="crisis" />,
  },
  {
    id: 'hud-downed',
    group: 'Combat HUD',
    label: 'Downed + out hero',
    w: 1280,
    h: 720,
    render: () => <HudStage scenario="downed" />,
  },
  {
    id: 'hud-boss',
    group: 'Combat HUD',
    label: 'Boss phase 3, decree, Requiem',
    w: 1280,
    h: 720,
    render: () => <HudStage scenario="boss" />,
  },
  {
    id: 'hud-resonance',
    group: 'Combat HUD',
    label: 'Full Resonance, Solos ready',
    w: 1280,
    h: 720,
    render: () => <HudStage scenario="resonance" />,
  },
  {
    id: 'hud-calls',
    group: 'Combat HUD',
    label: 'Calls: open, answered, Unison',
    w: 1280,
    h: 720,
    render: () => <HudStage scenario="calls" />,
  },
  {
    id: 'hud-fermata',
    group: 'Combat HUD',
    label: 'Fermata hold, Pedal Point, chorus',
    w: 1280,
    h: 720,
    render: () => <HudStage scenario="fermata" />,
  },
  {
    id: 'hud-wheel',
    group: 'Combat HUD',
    label: 'Directive wheel: Rally',
    w: 1280,
    h: 720,
    render: () => <HudStage scenario="wheel" wheel={mockWheel(false)} />,
  },
  {
    id: 'hud-wheel-focus',
    group: 'Combat HUD',
    label: 'Directive wheel: Focus an enemy',
    w: 1280,
    h: 720,
    render: () => <HudStage scenario="wheel" wheel={mockWheel(true)} coach={false} />,
  },
  {
    id: 'hud-sandbox',
    group: 'Combat HUD',
    label: 'Training Grounds',
    w: 1280,
    h: 720,
    render: () => <HudStage scenario="sandbox" coach={false} />,
  },
  {
    id: 'howto',
    group: 'Overlays',
    label: 'How to play card',
    w: 1280,
    h: 720,
    render: () => (
      <World>
        <HowToPlay onClose={noop} />
      </World>
    ),
  },
  {
    id: 'pause',
    group: 'Overlays',
    label: 'Pause menu',
    w: 1280,
    h: 720,
    render: () => (
      <World>
        <PauseMenu mode="run" onResume={noop} onAbandon={noop} />
      </World>
    ),
  },
  { id: 'title', group: 'Screens', label: 'Title', w: 1280, h: 720, render: () => <TitleScreen /> },
  {
    id: 'rank-panels',
    group: 'Weaver Rank',
    label: 'Rank panel at Ranks 1, 3, 6',
    w: 1280,
    h: 720,
    render: () => (
      <ScreenFrame tone="gold">
        <div className="mx-auto grid max-w-6xl items-start gap-6 px-6 py-10 md:grid-cols-2">
          <RankPanelView profile={{ xp: 0, runs: 0, wins: 0 }} />
          <RankPanelView profile={{ xp: 25, runs: 1, wins: 0 }} />
          <RankPanelView profile={{ xp: 318, runs: 4, wins: 1 }} />
          <RankPanelView profile={{ xp: 1420, runs: 11, wins: 6 }} />
          <RankPanelView profile={{ xp: 610, runs: 6, wins: 2 }} unlockAll />
        </div>
      </ScreenFrame>
    ),
  },
  {
    id: 'rank-up',
    group: 'Weaver Rank',
    label: 'Rank-up card (first ever)',
    w: 1280,
    h: 900,
    render: () => {
      const run = resultRun(true);
      return (
        <ResultView
          run={run}
          result={run.lastResult!}
          onContinue={noop}
          profileXp={52}
          rankUps={mockRankUps([2])}
          onDismissRankUps={noop}
          firstRankUp
        />
      );
    },
  },
  {
    id: 'rank-up-multi',
    group: 'Weaver Rank',
    label: 'Rank-up card: two Ranks at once',
    w: 1280,
    h: 900,
    render: () => {
      const run = resultRun(true);
      return (
        <ResultView
          run={run}
          result={run.lastResult!}
          onContinue={noop}
          profileXp={460}
          rankUps={mockRankUps([3, 4])}
          onDismissRankUps={noop}
        />
      );
    },
  },
  {
    id: 'prep-rank1',
    group: 'Weaver Rank',
    label: 'Prep at Rank 1 (first run)',
    w: 1280,
    h: 1100,
    render: () => prepAt(1),
  },
  {
    id: 'prep-rank3',
    group: 'Weaver Rank',
    label: 'Prep at Rank 3: ornaments New',
    w: 1280,
    h: 1100,
    render: () => prepAt(3, 'bastion'),
  },
  {
    id: 'chords-locked',
    group: 'Weaver Rank',
    label: 'Builder: songs the Rank no longer allows',
    w: 1280,
    h: 1000,
    render: () => (
      <ScreenFrame>
        <div className="mx-auto max-w-7xl px-6 py-8">
          <ScreenHeader eyebrow="Song builder · Rank 2" title="Locked items in the draft" />
          <div className="mt-6">
            <LockedBuilder />
          </div>
        </div>
      </ScreenFrame>
    ),
  },
  {
    id: 'codex-rank',
    group: 'Weaver Rank',
    label: 'Codex: Weaver Rank',
    w: 1280,
    h: 1000,
    render: () => <CodexView onBack={noop} initialTab="rank" />,
  },
  {
    id: 'rank-up-bare',
    group: 'Weaver Rank',
    label: 'Rank-up card alone',
    w: 1280,
    h: 800,
    render: () => (
      <World>
        <RankUpCard rankUps={mockRankUps([5])} onDismiss={noop} />
      </World>
    ),
  },
  {
    id: 'prep',
    group: 'Screens',
    label: 'Prep (everything open)',
    w: 1280,
    h: 1100,
    render: () => prepAt(null, 'guardian'),
  },
  {
    id: 'chords-illegal',
    group: 'Screens',
    label: 'Chord builder: problems',
    w: 1280,
    h: 900,
    render: () => (
      <ScreenFrame>
        <div className="mx-auto max-w-7xl px-6 py-8">
          <ScreenHeader eyebrow="Chord builder" title="An illegal draft" />
          <div className="mt-6">
            <Interactive initial={() => freshRun(7)}>{() => <IllegalBuilder />}</Interactive>
          </div>
        </div>
      </ScreenFrame>
    ),
  },
  {
    id: 'map-start',
    group: 'Screens',
    label: 'Map: start',
    w: 1280,
    h: 800,
    render: () => <MapView run={Run.embark(freshRun(7))} onChoose={noop} onAbandon={noop} />,
  },
  {
    id: 'map-mid',
    group: 'Screens',
    label: 'Map: mid-run',
    w: 1280,
    h: 800,
    render: () => <MapView run={playedRun(3)} onChoose={noop} onAbandon={noop} />,
  },
  {
    id: 'result-win',
    group: 'Screens',
    label: 'Result: victory',
    w: 1280,
    h: 1500,
    render: () => (
      <ResultView
        run={resultRun(true)}
        result={resultRun(true).lastResult!}
        onContinue={noop}
        profileXp={LAB_XP}
      />
    ),
  },
  {
    id: 'result-alone-wins',
    group: 'Screens',
    label: 'Result: they’d have won alone',
    w: 1280,
    h: 1500,
    render: () => {
      const run = resultRun(true, 0, 'victory');
      return <ResultView run={run} result={run.lastResult!} onContinue={noop} />;
    },
  },
  {
    id: 'result-stalled',
    group: 'Screens',
    label: 'Result: alone, stalled (timeout)',
    w: 1280,
    h: 1500,
    render: () => {
      const run = resultRun(true, 0, 'timeout');
      return <ResultView run={run} result={run.lastResult!} onContinue={noop} />;
    },
  },
  {
    id: 'result-no-rerun',
    group: 'Screens',
    label: 'Result: no re-run (null)',
    w: 1280,
    h: 1400,
    render: () => {
      const run = resultRun(true, 0, null);
      return <ResultView run={run} result={run.lastResult!} onContinue={noop} />;
    },
  },
  {
    id: 'result-loss',
    group: 'Screens',
    label: 'Result: defeat with deaths',
    w: 1280,
    h: 1500,
    render: () => (
      <ResultView
        run={resultRun(false, 2)}
        result={resultRun(false, 2).lastResult!}
        onContinue={noop}
        profileXp={LAB_XP}
      />
    ),
  },
  {
    id: 'draft',
    group: 'Screens',
    label: 'Draft (with an upgrade)',
    w: 1280,
    h: 800,
    render: () => (
      <Interactive initial={draftRun}>
        {(run, set) => <DraftView run={run} onPick={noop} onReroll={() => set(Run.rerollDraft)} />}
      </Interactive>
    ),
  },
  {
    id: 'respite',
    group: 'Screens',
    label: 'Respite',
    w: 1280,
    h: 800,
    render: () => <RespiteView run={respiteRun()} onChoose={noop} onRetune={noop} />,
  },
  {
    id: 'respite-retune',
    group: 'Screens',
    label: 'Respite: Retune',
    w: 1280,
    h: 1050,
    render: () => <RespiteView run={respiteRun()} onChoose={noop} onRetune={noop} initialRetune />,
  },
  {
    id: 'summary-win',
    group: 'Screens',
    label: 'Summary: victory',
    w: 1280,
    h: 1800,
    render: () => {
      const run = summaryRun('victory');
      return (
        <SummaryView
          run={run}
          onNewRun={noop}
          onTitle={noop}
          profileXp={Math.max(LAB_XP, run.xp + 40)}
        />
      );
    },
  },
  {
    id: 'summary-loss',
    group: 'Screens',
    label: 'Summary: defeat',
    w: 1280,
    h: 1800,
    render: () => (
      <SummaryView
        run={summaryRun('defeat')}
        onNewRun={noop}
        onTitle={noop}
        assisted
        profileXp={LAB_XP}
      />
    ),
  },
  {
    id: 'summary-abandon',
    group: 'Screens',
    label: 'Summary: abandoned (early)',
    w: 1280,
    h: 1500,
    render: () => (
      <SummaryView run={Run.abandon(Run.embark(freshRun(7)))} onNewRun={noop} onTitle={noop} />
    ),
  },
  {
    id: 'codex',
    group: 'Screens',
    label: 'Codex',
    w: 1280,
    h: 900,
    render: () => <CodexView onBack={noop} />,
  },
  {
    id: 'codex-chords',
    group: 'Screens',
    label: 'Codex: Songs & ornaments',
    w: 1280,
    h: 1100,
    render: () => <CodexView onBack={noop} initialTab="chords" />,
  },
  {
    id: 'codex-relics',
    group: 'Relics & stops',
    label: 'Codex: Relics',
    w: 1280,
    h: 1500,
    render: () => <CodexView onBack={noop} initialTab="relics" />,
  },
  {
    id: 'codex-events',
    group: 'Relics & stops',
    label: 'Codex: Events, boons and banes',
    w: 1280,
    h: 1500,
    render: () => <CodexView onBack={noop} initialTab="events" />,
  },
  {
    id: 'codex-calls',
    group: 'Screens',
    label: 'Codex: Calls',
    w: 1280,
    h: 900,
    render: () => <CodexView onBack={noop} initialTab="calls" />,
  },
  {
    id: 'settings',
    group: 'Screens',
    label: 'Settings (controls, accessibility)',
    w: 1280,
    h: 1900,
    render: () => <SettingsScreen />,
  },
  {
    id: 'hud-relics',
    group: 'Combat HUD',
    label: 'Relics: Metronome ready, Thimble cooling, Veil spent',
    w: 1280,
    h: 720,
    render: () => (
      <HudStage
        scenario="relics"
        coach={false}
        boons={[
          { id: 'last_note', fights: 1 },
          { id: 'frayed_spirit', fights: null },
        ]}
      />
    ),
  },
  {
    id: 'hud-relics-waiting',
    group: 'Combat HUD',
    label: 'Relics: Metronome cooling, Veil ready, Lantern flashing',
    w: 1280,
    h: 720,
    render: () => (
      <HudStage
        scenario="relics-waiting"
        coach={false}
        boons={[{ id: 'mended_loom', fights: null }]}
        relicFlash={['lantern_of_the_lost']}
      />
    ),
  },
  {
    id: 'map-3b',
    group: 'Relics & stops',
    label: 'Map: purse, relics, boons',
    w: 1280,
    h: 860,
    render: () => <MapView run={mapRun3b()} onChoose={noop} onAbandon={noop} />,
  },
  {
    id: 'map-relic-tip',
    group: 'Relics & stops',
    label: 'Map: a relic’s tooltip (cleansed curse)',
    w: 1280,
    h: 860,
    render: () => (
      <MapView run={mapRun3b()} onChoose={noop} onAbandon={noop} peekRelic="glass_halo" />
    ),
  },
  ...(['merchant', 'forge', 'event', 'elite', 'miniboss'] as const).map((kind): ViewDef => ({
    id: `map-tip-${kind}`,
    group: 'Relics & stops',
    label: `Map tooltip: ${kind === 'miniboss' ? 'the Bellwarden' : kind}`,
    w: 1280,
    h: 860,
    render: () => {
      const run = mapRun3b();
      return <MapView run={run} onChoose={noop} onAbandon={noop} peek={nodeOf(run, kind)} />;
    },
  })),
  ...(['elite', 'boss', 'event'] as const).map((reason): ViewDef => ({
    id: `relic-${reason}`,
    group: 'Relics & stops',
    label: `Relic offer: ${reason === 'boss' ? 'the Bellwarden' : reason === 'event' ? 'the Unsung Choir' : 'an elite'}`,
    w: 1280,
    h: 800,
    render: () => <RelicOfferView run={relicOfferRun(reason)} onPick={noop} />,
  })),
  {
    id: 'result-event',
    group: 'Relics & stops',
    label: 'Result after the Unsung Choir (→ relic)',
    w: 1280,
    h: 900,
    render: () => {
      const run = eventFightResultRun();
      return <ResultView run={run} result={run.lastResult!} onContinue={noop} profileXp={LAB_XP} />;
    },
  },
  {
    id: 'merchant',
    group: 'Relics & stops',
    label: 'Merchant: affordable, too dear, sold (click to buy)',
    w: 1280,
    h: 1250,
    render: () => (
      <Interactive initial={merchantRun}>
        {(run, set) => (
          <MerchantView run={run} onBuy={(i) => set((r) => Run.buy(r, i))} onLeave={noop} />
        )}
      </Interactive>
    ),
  },
  {
    id: 'forge',
    group: 'Relics & stops',
    label: 'Forge: three services (click through)',
    w: 1280,
    h: 800,
    render: () => (
      <Interactive initial={() => forgeRun()}>
        {(run, set) => (
          <ForgeView run={run} onForge={(c) => set((r) => Run.forge(r, c))} onLeave={noop} />
        )}
      </Interactive>
    ),
  },
  {
    id: 'forge-poor',
    group: 'Relics & stops',
    label: 'Forge: short of Aether, no curse',
    w: 1280,
    h: 800,
    render: () => (
      <ForgeView run={forgeRun({ aether: 25, curse: false })} onForge={noop} onLeave={noop} />
    ),
  },
  ...(['temper', 'cleanse'] as ForgeService[]).map((service): ViewDef => ({
    id: `forge-${service}-pick`,
    group: 'Relics & stops',
    label: `Forge: ${service === 'temper' ? 'Temper, choose a motif' : 'Lift a curse, choose a relic'}`,
    w: 1280,
    h: 900,
    render: () => (
      <ForgeView run={forgeRun()} onForge={noop} onLeave={noop} initialMode={service} />
    ),
  })),
  {
    id: 'forge-retune-pick',
    group: 'Relics & stops',
    label: 'Forge: Retune (song builder)',
    w: 1280,
    h: 1050,
    render: () => <ForgeView run={forgeRun()} onForge={noop} onLeave={noop} initialMode="retune" />,
  },
  ...(['temper', 'retune', 'cleanse'] as ForgeService[]).map((service): ViewDef => ({
    id: `forge-${service}-done`,
    group: 'Relics & stops',
    label: `Forge: after ${service}`,
    w: 1280,
    h: 900,
    render: () => {
      const { run, result } = forgeAfter(service);
      return <ForgeView run={run} onForge={noop} onLeave={noop} initialResult={result} />;
    },
  })),
  ...CONTENT.events.map((ev): ViewDef => ({
    id: `event-${ev.id}`,
    group: 'Events',
    label: `${ev.name}: the choice`,
    w: 1280,
    h: 820,
    render: () => (
      <Interactive initial={() => eventRun(ev.id, ev.id === 'broken_loom' ? 25 : 60)}>
        {(run, set) => (
          <EventView
            run={run}
            onChoose={(id, opts) => set((r) => Run.chooseEvent(r, id, opts))}
            onLeave={noop}
          />
        )}
      </Interactive>
    ),
  })),
  {
    id: 'event-shrine-pick',
    group: 'Events',
    label: 'Shrine of Discord: choose a motif',
    w: 1280,
    h: 900,
    render: () => (
      <EventView
        run={eventRun('shrine_of_discord')}
        onChoose={noop}
        onLeave={noop}
        initialPending="offer"
      />
    ),
  },
  {
    id: 'event-pool-retune',
    group: 'Events',
    label: 'Tuning Pool: Retune (song builder)',
    w: 1280,
    h: 1050,
    render: () => (
      <EventView
        run={eventRun('tuning_pool')}
        onChoose={noop}
        onLeave={noop}
        initialPending="retune"
      />
    ),
  },
  ...(
    [
      ['wounded_cantor', 'mend', undefined],
      ['wounded_cantor', 'last_note', undefined],
      ['shrine_of_discord', 'offer', true],
      ['shrine_of_discord', 'offer', false],
      ['tuning_pool', 'retune', undefined],
      ['tuning_pool', 'bathe', undefined],
      ['merchant_of_silences', 'blood', undefined],
      ['merchant_of_silences', 'gift', undefined],
      ['unsung_choir', 'slip', undefined],
      ['broken_loom', 'mend', undefined],
      ['broken_loom', 'salvage', undefined],
    ] as const
  ).map(([eventId, choiceId, won]): ViewDef => ({
    id: `event-${eventId}-${choiceId}${won === undefined ? '' : won ? '-won' : '-lost'}`,
    group: 'Events',
    label: `${CONTENT.events.find((e) => e.id === eventId)!.name}: ${choiceId}${won === undefined ? '' : won ? ' (won)' : ' (lost)'}`,
    w: 1280,
    h: 1000,
    render: () => (
      <EventView
        run={eventAfter(eventId, choiceId, { won, aether: 60 })}
        onChoose={noop}
        onLeave={noop}
      />
    ),
  })),
  {
    id: 'prep-calling-locked',
    group: 'Calling',
    label: 'Prep: the Luminary locked (Rank 6)',
    w: 1280,
    h: 720,
    render: () => prepCalling(6),
  },
  {
    id: 'prep-calling-new',
    group: 'Calling',
    label: 'Prep: Rank 7, the Luminary New',
    w: 1280,
    h: 720,
    render: () => prepCalling(7),
  },
  {
    id: 'prep-calling-chosen',
    group: 'Calling',
    label: 'Prep: the Luminary chosen',
    w: 1280,
    h: 720,
    render: () => prepCalling(null, { chosen: true }),
  },
  {
    id: 'prep-calling-path',
    group: 'Calling',
    label: 'Prep: the path dialog',
    w: 1280,
    h: 720,
    render: () => prepCalling(null, { chosen: true, openPath: true }),
  },
  ...[0, 1, 2, 3].map((tier): ViewDef => ({
    id: `calling-tier-${tier + 1}`,
    group: 'Calling',
    label: `Tier ${['I', 'II', 'III', 'IV'][tier]}: ${CONTENT.callings[0]!.tiers[tier]!.options.map((o) => o.name).join(' / ')}`,
    w: 1280,
    h: 720,
    render: () => (
      <Interactive initial={() => callingOfferRun(tier)}>
        {(run, set) => (
          <CallingView run={run} onPick={(i, c) => set((r) => Run.pickCalling(r, i, c))} />
        )}
      </Interactive>
    ),
  })),
  {
    id: 'calling-third-voice',
    group: 'Calling',
    label: 'Third Voice: the free retune',
    w: 1280,
    h: 1100,
    render: () => <CallingView run={callingOfferRun(2)} onPick={noop} initialRetune={0} />,
  },
  {
    id: 'calling-retune-after',
    group: 'Calling',
    label: 'Retune at a Respite with Third Voice',
    w: 1280,
    h: 1100,
    render: () => {
      const run = Run.pickCalling(callingOfferRun(2), 0);
      return (
        <RespiteView
          run={{ ...run, phase: 'respite' }}
          onChoose={noop}
          onRetune={noop}
          initialRetune
        />
      );
    },
  },
  {
    id: 'map-calling',
    group: 'Calling',
    label: 'Map: the Calling in the strip (tooltip)',
    w: 1280,
    h: 860,
    render: () => <MapView run={callingMapRun()} onChoose={noop} onAbandon={noop} peekCalling />,
  },
  {
    id: 'map-calling-node',
    group: 'Calling',
    label: 'Map: a milestone fight’s tooltip',
    w: 1280,
    h: 860,
    render: () => {
      const run = callingMapRun();
      return <MapView run={run} onChoose={noop} onAbandon={noop} peek={milestoneNode(run)} />;
    },
  },
  {
    id: 'hud-luminary',
    group: 'Calling',
    label: 'HUD: heroes shine, Haloed',
    w: 1280,
    h: 720,
    render: () => <HudStage scenario="luminary" coach={false} />,
  },
  {
    id: 'hud-luminary-sunrise',
    group: 'Calling',
    label: 'HUD: Sunrise, Sovereign Symphony',
    w: 1280,
    h: 720,
    render: () => <HudStage scenario="luminary-sunrise" coach={false} />,
  },
  {
    id: 'result-calling',
    group: 'Calling',
    label: 'Result: the Calling line (→ your Calling grows)',
    w: 1280,
    h: 1420,
    render: () => {
      const run = callingResultRun();
      return <ResultView run={run} result={run.lastResult!} onContinue={noop} profileXp={LAB_XP} />;
    },
  },
  {
    id: 'summary-calling',
    group: 'Calling',
    label: 'Summary: the path taken',
    w: 1280,
    h: 1300,
    render: () => {
      const run = callingSummaryRun();
      return <SummaryView run={run} onNewRun={noop} onTitle={noop} />;
    },
  },
  {
    id: 'codex-callings',
    group: 'Calling',
    label: 'Codex: Callings',
    w: 1280,
    h: 1000,
    render: () => <CodexView onBack={noop} initialTab="callings" />,
  },
  {
    id: 'codex-callings-locked',
    group: 'Calling',
    label: 'Codex: Callings, locked (Rank 3)',
    w: 1280,
    h: 1000,
    render: () => <CodexView onBack={noop} initialTab="callings" allowance={allowanceFor(3)} />,
  },
  {
    id: 'rank-up-7',
    group: 'Calling',
    label: 'Rank 7: the Luminary unlocked',
    w: 1280,
    h: 720,
    render: () => (
      <World>
        <RankUpCard rankUps={mockRankUps([7])} onDismiss={noop} />
      </World>
    ),
  },
  // ── Phase 3d: the Martyr ─────────────────────────────────────────────────────────────
  {
    id: 'prep-callings-locked',
    group: 'Martyr',
    label: 'Prep: both Callings locked (Rank 6)',
    w: 1280,
    h: 720,
    render: () => prepCalling(6),
  },
  {
    id: 'prep-martyr-locked',
    group: 'Martyr',
    label: 'Prep: Rank 7, the Luminary New, the Martyr locked',
    w: 1280,
    h: 720,
    render: () => prepCalling(7),
  },
  {
    id: 'prep-martyr-new',
    group: 'Martyr',
    label: 'Prep: Rank 8, the Martyr New',
    w: 1280,
    h: 720,
    render: () => prepCalling(8),
  },
  {
    id: 'prep-martyr-chosen',
    group: 'Martyr',
    label: 'Prep: the Martyr chosen (the Life budget)',
    w: 1280,
    h: 1240,
    render: () => prepCalling(null, { chosen: 'martyr' }),
  },
  {
    id: 'prep-martyr-path',
    group: 'Martyr',
    label: 'Prep: the Martyr’s path dialog',
    w: 1280,
    h: 720,
    render: () => prepCalling(null, { chosen: 'martyr', openPath: 'martyr' }),
  },
  ...[0, 1, 2, 3].map((tier): ViewDef => ({
    id: `martyr-tier-${tier + 1}`,
    group: 'Martyr',
    label: `Tier ${['I', 'II', 'III', 'IV'][tier]}: ${callingDef('martyr')
      .tiers[tier]!.options.map((o) => o.name)
      .join(' / ')}`,
    w: 1280,
    h: 720,
    render: () => (
      <Interactive initial={() => martyrOfferRun(tier)}>
        {(run, set) => (
          <CallingView run={run} onPick={(i, c) => set((r) => Run.pickCalling(r, i, c))} />
        )}
      </Interactive>
    ),
  })),
  {
    id: 'builder-life',
    group: 'Martyr',
    label: 'Builder: the Life budget (Blood Font, Vigil marked)',
    w: 1280,
    h: 1000,
    render: () => <LifeBuilder initial={GUARDIAN_CHORDS} />,
  },
  {
    id: 'builder-life-over',
    group: 'Martyr',
    label: 'Builder: songs holding more than 90% of her Life',
    w: 1280,
    h: 1000,
    render: () => <LifeBuilder initial={OVER_LIFE_CHORDS} />,
  },
  {
    id: 'retune-martyr',
    group: 'Martyr',
    label: 'Retune at a Respite on a Martyr run',
    w: 1280,
    h: 1100,
    render: () => {
      const run = martyrRun({ picks: MARTYR_PICKS, fights: 5 });
      return (
        <RespiteView
          run={{ ...run, phase: 'respite' }}
          onChoose={noop}
          onRetune={noop}
          initialRetune
        />
      );
    },
  },
  {
    id: 'map-martyr',
    group: 'Martyr',
    label: 'Map: the Martyr in the strip (tooltip)',
    w: 1280,
    h: 860,
    render: () => (
      <MapView
        run={{ ...martyrRun({ picks: ['penitence', 'blood_font'], fights: 4 }), aether: 85 }}
        onChoose={noop}
        onAbandon={noop}
        peekCalling
      />
    ),
  },
  {
    id: 'hud-martyr-coach',
    group: 'Martyr',
    label: 'HUD: a big hit coming, the Bear hint',
    w: 1280,
    h: 720,
    render: () => <HudStage scenario="martyr-coach" coach />,
  },
  {
    id: 'hud-martyr-bear',
    group: 'Martyr',
    label: 'HUD: Bearing for Kael, Blood Font on',
    w: 1280,
    h: 720,
    render: () => <HudStage scenario="martyr-bear" coach={false} />,
  },
  {
    id: 'hud-martyr-vow',
    group: 'Martyr',
    label: 'HUD: Martyr’s Vow, Undying ready',
    w: 1280,
    h: 720,
    render: () => <HudStage scenario="martyr-vow" coach={false} />,
  },
  {
    id: 'hud-martyr-low',
    group: 'Martyr',
    label: 'HUD: low Life, Vigil and Blood Font marks lit',
    w: 1280,
    h: 720,
    render: () => <HudStage scenario="martyr-low" coach={false} />,
  },
  {
    id: 'result-martyr',
    group: 'Martyr',
    label: 'Result: the Martyr’s line (→ your Calling grows)',
    w: 1280,
    h: 1420,
    render: () => {
      const run = martyrResultRun();
      return <ResultView run={run} result={run.lastResult!} onContinue={noop} profileXp={LAB_XP} />;
    },
  },
  {
    id: 'summary-martyr',
    group: 'Martyr',
    label: 'Summary: the Martyr’s path and totals',
    w: 1280,
    h: 1300,
    render: () => {
      const run = martyrSummaryRun();
      return <SummaryView run={run} onNewRun={noop} onTitle={noop} />;
    },
  },
  {
    id: 'codex-martyr',
    group: 'Martyr',
    label: 'Codex: Callings, both open',
    w: 1280,
    h: 2000,
    render: () => <CodexView onBack={noop} initialTab="callings" />,
  },
  {
    id: 'codex-martyr-locked',
    group: 'Martyr',
    label: 'Codex: Callings at Rank 7 (the Martyr locked)',
    w: 1280,
    h: 2000,
    render: () => <CodexView onBack={noop} initialTab="callings" allowance={allowanceFor(7)} />,
  },
  {
    id: 'rank-up-8',
    group: 'Martyr',
    label: 'Rank 8: the Martyr unlocked',
    w: 1280,
    h: 720,
    render: () => (
      <World>
        <RankUpCard rankUps={mockRankUps([8])} onDismiss={noop} />
      </World>
    ),
  },
  {
    id: 'rank-panels-8',
    group: 'Martyr',
    label: 'Rank panels at Ranks 7 and 8 (the top)',
    w: 1280,
    h: 720,
    render: () => (
      <ScreenFrame tone="gold">
        <div className="mx-auto grid max-w-6xl items-start gap-6 px-6 py-10 md:grid-cols-2">
          <RankPanelView profile={{ xp: 1900, runs: 14, wins: 7 }} />
          <RankPanelView profile={{ xp: 2730, runs: 19, wins: 10 }} />
        </div>
      </ScreenFrame>
    ),
  },
  {
    id: 'settings-controls-bear',
    group: 'Martyr',
    label: 'Settings → Controls: the Bear key',
    w: 1280,
    h: 900,
    render: () => (
      <ScreenFrame>
        <div className="mx-auto max-w-4xl px-6 py-8">
          <ScreenHeader eyebrow="Settings" title="Controls" />
          <div className="mt-6">
            <ControlsSettings />
          </div>
        </div>
      </ScreenFrame>
    ),
  },
  // ── Phase 3e: the Chronomancer ───────────────────────────────────────────────────────
  {
    id: 'prep-chrono-locked',
    group: 'Chronomancer',
    label: 'Prep: Rank 8, the Martyr New, the Chronomancer locked',
    w: 1280,
    h: 720,
    render: () => prepCalling(8),
  },
  {
    id: 'prep-chrono-new',
    group: 'Chronomancer',
    label: 'Prep: Rank 9, the Chronomancer New',
    w: 1280,
    h: 720,
    render: () => prepCalling(9),
  },
  {
    id: 'prep-chrono-chosen',
    group: 'Chronomancer',
    label: 'Prep: the Chronomancer chosen',
    w: 1280,
    h: 1240,
    render: () => prepCalling(null, { chosen: 'chronomancer' }),
  },
  {
    id: 'prep-chrono-path',
    group: 'Chronomancer',
    label: 'Prep: the Chronomancer’s path dialog',
    w: 1280,
    h: 720,
    render: () => prepCalling(null, { chosen: 'chronomancer', openPath: 'chronomancer' }),
  },
  ...[0, 1, 2, 3].map((tier): ViewDef => ({
    id: `chrono-tier-${tier + 1}`,
    group: 'Chronomancer',
    label: `Tier ${['I', 'II', 'III', 'IV'][tier]}: ${callingDef('chronomancer')
      .tiers[tier]!.options.map((o) => o.name)
      .join(' / ')}`,
    w: 1280,
    h: 720,
    render: () => (
      <Interactive initial={() => chronoOfferRun(tier)}>
        {(run, set) => (
          <CallingView run={run} onPick={(i, c) => set((r) => Run.pickCalling(r, i, c))} />
        )}
      </Interactive>
    ),
  })),
  {
    id: 'map-chrono',
    group: 'Chronomancer',
    label: 'Map: the Chronomancer in the strip (tooltip)',
    w: 1280,
    h: 860,
    render: () => (
      <MapView
        run={{ ...chronoRun({ picks: ['foresight', 'borrowed_time'], fights: 4 }), aether: 85 }}
        onChoose={noop}
        onAbandon={noop}
        peekCalling
      />
    ),
  },
  {
    id: 'retune-chrono',
    group: 'Chronomancer',
    label: 'Retune on a Chronomancer run: Rewind in the techniques',
    w: 1280,
    h: 1100,
    render: () => {
      const run = chronoRun({ picks: CHRONO_PICKS, fights: 5 });
      return (
        <RespiteView
          run={{ ...run, phase: 'respite' }}
          onChoose={noop}
          onRetune={noop}
          initialRetune
        />
      );
    },
  },
  {
    id: 'hud-chrono-rewind',
    group: 'Chronomancer',
    label: 'HUD: Rewind’s preview on Kael, Foresight on Lyra',
    w: 1280,
    h: 720,
    render: () => <HudStage scenario="chrono-rewind" coach />,
  },
  {
    id: 'hud-chrono-revive',
    group: 'Chronomancer',
    label: 'HUD: Kael just fell, Rewind stands him back up',
    w: 1280,
    h: 720,
    render: () => <HudStage scenario="chrono-revive" coach />,
  },
  {
    id: 'hud-chrono-spent',
    group: 'Chronomancer',
    label: 'HUD: Kael just fell, but this run’s revive is spent',
    w: 1280,
    h: 720,
    render: () => <HudStage scenario="chrono-spent" coach />,
  },
  {
    id: 'hud-chrono-reach',
    group: 'Chronomancer',
    label: 'HUD: Kael out of reach, Vexis within it',
    w: 1280,
    h: 720,
    render: () => <HudStage scenario="chrono-reach" coach />,
  },
  {
    id: 'hud-chrono-saved',
    group: 'Chronomancer',
    label: 'HUD: after the Rewind (Kael stands again)',
    w: 1280,
    h: 720,
    render: () => <HudStage scenario="chrono-saved" coach={false} />,
  },
  {
    id: 'hud-chrono-stasis',
    group: 'Chronomancer',
    label: 'HUD: Stasis, techniques free and at half cost',
    w: 1280,
    h: 720,
    render: () => <HudStage scenario="chrono-stasis" coach={false} />,
  },
  {
    id: 'hud-chrono-boss',
    group: 'Chronomancer',
    label: 'HUD: the Bellwarden, its next attack foreseen',
    w: 1280,
    h: 720,
    render: () => <HudStage scenario="chrono-boss" coach={false} />,
  },
  {
    id: 'howto-chrono',
    group: 'Chronomancer',
    label: 'First-fight primer on a Chronomancer run',
    w: 1280,
    h: 720,
    render: () => {
      const v = callingDef('chronomancer').values;
      return (
        <World>
          <HowToPlay
            onClose={noop}
            rewind={{ seconds: v.rewind ?? 0, cooldown: v.cooldown ?? 0 }}
          />
        </World>
      );
    },
  },
  {
    id: 'result-chrono',
    group: 'Chronomancer',
    label: 'Result: his line, a fall with Rewind ready (→ your Calling grows)',
    w: 1280,
    h: 2320,
    render: () => {
      const run = chronoResultRun();
      return <ResultView run={run} result={run.lastResult!} onContinue={noop} profileXp={LAB_XP} />;
    },
  },
  {
    id: 'summary-chrono',
    group: 'Chronomancer',
    label: 'Summary: the Chronomancer’s path and totals',
    w: 1280,
    h: 1300,
    render: () => {
      const run = chronoSummaryRun();
      return <SummaryView run={run} onNewRun={noop} onTitle={noop} />;
    },
  },
  {
    id: 'codex-chrono',
    group: 'Chronomancer',
    label: 'Codex: three Callings',
    w: 1280,
    h: 2700,
    render: () => <CodexView onBack={noop} initialTab="callings" />,
  },
  {
    id: 'codex-chrono-locked',
    group: 'Chronomancer',
    label: 'Codex: Callings at Rank 8 (the Chronomancer locked)',
    w: 1280,
    h: 2700,
    render: () => <CodexView onBack={noop} initialTab="callings" allowance={allowanceFor(8)} />,
  },
  {
    id: 'rank-up-9',
    group: 'Chronomancer',
    label: 'Rank 9: the Chronomancer unlocked',
    w: 1280,
    h: 720,
    render: () => (
      <World>
        <RankUpCard rankUps={mockRankUps([9])} onDismiss={noop} />
      </World>
    ),
  },
  {
    id: 'rank-panels-9',
    group: 'Chronomancer',
    label: 'Rank panels at Ranks 8 and 9 (the top)',
    w: 1280,
    h: 720,
    render: () => (
      <ScreenFrame tone="gold">
        <div className="mx-auto grid max-w-6xl items-start gap-6 px-6 py-10 md:grid-cols-2">
          <RankPanelView profile={{ xp: 2730, runs: 19, wins: 10 }} />
          <RankPanelView profile={{ xp: 3520, runs: 24, wins: 13 }} />
        </div>
      </ScreenFrame>
    ),
  },
  {
    id: 'settings-controls-rewind',
    group: 'Chronomancer',
    label: 'Settings → Controls: F reads Reel / Rewind',
    w: 1280,
    h: 900,
    render: () => (
      <ScreenFrame>
        <div className="mx-auto max-w-4xl px-6 py-8">
          <ScreenHeader eyebrow="Settings" title="Controls" />
          <div className="mt-6">
            <ControlsSettings />
          </div>
        </div>
      </ScreenFrame>
    ),
  },
  // ── Phase 4: the Astrolabe ───────────────────────────────────────────────────────────
  {
    id: 'astrolabe-rank4',
    group: 'Astrolabe',
    label: 'The Astrolabe at Rank 4: 3 points, nothing taken',
    w: 1280,
    h: 720,
    render: () => <AstrolabeLab rank={4} />,
  },
  {
    id: 'astrolabe-rank4-path',
    group: 'Astrolabe',
    label: 'Rank 4: pointing at Spun Silver (3 points)',
    w: 1280,
    h: 720,
    render: () => <AstrolabeLab rank={4} point="silk_n1" />,
  },
  {
    id: 'astrolabe-rank12',
    group: 'Astrolabe',
    label: 'Rank 12: 9 of 11 points, pointing at a Blood two stars out',
    w: 1280,
    h: 720,
    render: () => <AstrolabeLab rank={12} initial={RANK12_TREE} point="silk_b4" />,
  },
  {
    id: 'astrolabe-short',
    group: 'Astrolabe',
    label: 'Rank 12: Sanguine Font, more than the points left',
    w: 1280,
    h: 720,
    render: () => <AstrolabeLab rank={12} initial={RANK12_TREE} point="sanguine_font" />,
  },
  {
    id: 'astrolabe-held',
    group: 'Astrolabe',
    label: 'Rank 12: Spun Silver can’t go back (Afterglow hangs on it)',
    w: 1280,
    h: 720,
    render: () => <AstrolabeLab rank={12} initial={RANK12_TREE} point="silk_n1" />,
  },
  {
    id: 'astrolabe-mine',
    group: 'Astrolabe',
    label: 'Rank 12: Clear Voice can go back',
    w: 1280,
    h: 720,
    render: () => <AstrolabeLab rank={12} initial={RANK12_TREE} point="choir_n1" />,
  },
  {
    id: 'astrolabe-rank20',
    group: 'Astrolabe',
    label: 'Rank 20: 19 points, Prism Covenant',
    w: 1280,
    h: 720,
    render: () => <AstrolabeLab rank={20} initial={RANK20_TREE} />,
  },
  {
    id: 'astrolabe-keystones',
    group: 'Astrolabe',
    label: 'A keystone-heavy tree: Prism Covenant and Eldritch Conduit',
    w: 1280,
    h: 720,
    render: () => <AstrolabeLab rank={20} initial={KEYSTONE_TREE} point="eldritch_conduit" />,
  },
  {
    id: 'astrolabe-over',
    group: 'Astrolabe',
    label: 'Over budget: 19 stars, Rank 12 (Skip the unlocks turned off)',
    w: 1280,
    h: 720,
    render: () => <AstrolabeLab rank={12} initial={RANK20_TREE} />,
  },
  {
    id: 'astrolabe-respec',
    group: 'Astrolabe',
    label: 'Respec: the confirm',
    w: 1280,
    h: 720,
    render: () => <AstrolabeLab rank={20} initial={RANK20_TREE} respec />,
  },
  {
    id: 'hud-astro-conduit',
    group: 'Astrolabe',
    label: 'HUD: Eldritch Conduit and Prism Covenant, a technique refused for Life',
    w: 1280,
    h: 720,
    render: () => <HudStage scenario="astro-conduit" coach={false} />,
  },
  {
    id: 'hud-astro-afterglow',
    group: 'Astrolabe',
    label: 'HUD: Afterglow on Kael after the Thread moved to Lyra',
    w: 1280,
    h: 720,
    render: () => <HudStage scenario="astro-afterglow" coach={false} />,
  },
  {
    id: 'hud-astro-grace',
    group: 'Astrolabe',
    label: 'HUD: Overflowing Grace’s shield on Kael',
    w: 1280,
    h: 720,
    render: () => <HudStage scenario="astro-grace" coach={false} />,
  },
  {
    id: 'hud-astro-sanguine',
    group: 'Astrolabe',
    label: 'HUD: Sanguine Font, the songs hold Life (no Calling)',
    w: 1280,
    h: 720,
    render: () => <HudStage scenario="astro-sanguine" coach={false} />,
  },
  {
    id: 'builder-astrolabe',
    group: 'Astrolabe',
    label: 'Builder: Clear Voice and the Breaths let heavier songs in',
    w: 1280,
    h: 1000,
    render: () => (
      <TreeBuilder
        tree={LIGHT_TREE}
        initial={heavierSongs(LIGHT_TREE) ?? HEAVY_CHORDS}
        title="The songs, made lighter"
      />
    ),
  },
  {
    id: 'builder-sanguine',
    group: 'Astrolabe',
    label: 'Builder: Sanguine Font, the Life budget without the Martyr',
    w: 1280,
    h: 1000,
    render: () => (
      <TreeBuilder tree={SANGUINE_TREE} initial={GUARDIAN_CHORDS} title="Songs sung with Life" />
    ),
  },
  {
    id: 'builder-conduit',
    group: 'Astrolabe',
    label: 'Builder: Eldritch Conduit, techniques in Life (and the Economy)',
    w: 1280,
    h: 1000,
    render: () => (
      <TreeBuilder tree={KEYSTONE_TREE} initial={HEAVY_CHORDS} title="Techniques paid in Life" />
    ),
  },
  {
    id: 'prep-astrolabe',
    group: 'Astrolabe',
    label: 'Prep: the Astrolabe button and the keystones',
    w: 1280,
    h: 720,
    render: () => (
      <Interactive initial={() => Run.newRun(7, GUARDIAN_CHORDS, KEYSTONE_TREE)}>
        {(run, set) => (
          <PrepView
            run={run}
            onChords={(c) => set((r) => Run.setChords(r, c))}
            onCalling={(id) => set((r) => Run.setCalling(r, id))}
            onEmbark={noop}
            onBack={noop}
            rank={MAX_RANK}
            astrolabe={{ points: astrolabePoints(MAX_RANK), onOpen: noop }}
          />
        )}
      </Interactive>
    ),
  },
  {
    id: 'prep-astrolabe-spend',
    group: 'Astrolabe',
    label: 'Prep at Rank 4: the Astrolabe New, 3 points to spend',
    w: 1280,
    h: 1100,
    render: () => (
      <Interactive initial={() => Run.newRun(7)}>
        {(run, set) => (
          <PrepView
            run={run}
            onChords={(c) => set((r) => Run.setChords(r, c, allowanceFor(4)))}
            onEmbark={noop}
            onBack={noop}
            allowance={allowanceFor(4)}
            fresh={UNLOCKS.filter((u) => u.rank === 4)}
            rank={4}
            astrolabe={{ points: astrolabePoints(4), onOpen: noop }}
          />
        )}
      </Interactive>
    ),
  },
  {
    id: 'title-astrolabe',
    group: 'Astrolabe',
    label: 'Title at Rank 12: points to spend',
    w: 1280,
    h: 720,
    render: () => <TitleAt rank={12} tree={RANK12_TREE.slice(0, 6)} />,
  },
  {
    id: 'rank-up-4',
    group: 'Astrolabe',
    label: 'Rank 4: the Astrolabe opens with its points',
    w: 1280,
    h: 800,
    render: () => (
      <World>
        <RankUpCard rankUps={mockRankUps([4])} onDismiss={noop} />
      </World>
    ),
  },
  {
    id: 'rank-up-11-12',
    group: 'Astrolabe',
    label: 'Ranks 11 and 12: a point each',
    w: 1280,
    h: 720,
    render: () => (
      <World>
        <RankUpCard rankUps={mockRankUps([11, 12])} onDismiss={noop} />
      </World>
    ),
  },
  {
    id: 'rank-panels-astrolabe',
    group: 'Astrolabe',
    label: 'Rank panels at Ranks 3 and 12: what the next Rank opens',
    w: 1280,
    h: 720,
    render: () => (
      <ScreenFrame tone="gold">
        <div className="mx-auto grid max-w-6xl items-start gap-6 px-6 py-10 md:grid-cols-2">
          <RankPanelView profile={{ xp: RANK_XP[2]! + 60, runs: 3, wins: 1 }} />
          <RankPanelView profile={{ xp: RANK_XP[11]! + 300, runs: 30, wins: 15 }} />
        </div>
      </ScreenFrame>
    ),
  },
  {
    id: 'summary-astrolabe',
    group: 'Astrolabe',
    label: 'Summary: the run’s tree in brief',
    w: 1280,
    h: 1700,
    render: () => {
      const run = { ...summaryRun('victory'), astrolabe: [...KEYSTONE_TREE] };
      return <SummaryView run={run} onNewRun={noop} onTitle={noop} />;
    },
  },
  {
    id: 'codex-astrolabe',
    group: 'Astrolabe',
    label: 'Codex: the Astrolabe',
    w: 1280,
    h: 1250,
    render: () => <CodexView onBack={noop} initialTab="astrolabe" />,
  },
  // ── Phase 4b: Deeds ──────────────────────────────────────────────────────────────────
  {
    id: 'codex-deeds-none',
    group: 'Deeds',
    label: 'Codex: Deeds, none earned (a new profile, Rank 1)',
    w: 1280,
    h: 1570,
    render: () => (
      <CodexView
        onBack={noop}
        initialTab="deeds"
        allowance={allowanceFor(1)}
        rank={1}
        deeds={{ earned: [], best: {} }}
      />
    ),
  },
  {
    id: 'codex-deeds-early',
    group: 'Deeds',
    label: 'Codex: Deeds early on (Rank 3): two points waiting',
    w: 1280,
    h: 1570,
    render: () => (
      <CodexView
        onBack={noop}
        initialTab="deeds"
        allowance={allowanceFor(3)}
        rank={3}
        deeds={mockDeeds(EARLY_DEEDS, 0.4)}
      />
    ),
  },
  {
    id: 'codex-deeds-some',
    group: 'Deeds',
    label: 'Codex: Deeds partway (Rank 8): seven earned, best runs',
    w: 1280,
    h: 1570,
    render: () => (
      <CodexView
        onBack={noop}
        initialTab="deeds"
        allowance={allowanceFor(8)}
        rank={8}
        deeds={mockDeeds(SOME_DEEDS)}
      />
    ),
  },
  {
    id: 'codex-deeds-all',
    group: 'Deeds',
    label: 'Codex: every Deed earned',
    w: 1280,
    h: 1570,
    render: () => <CodexView onBack={noop} initialTab="deeds" deeds={mockDeeds(ALL_DEEDS)} />,
  },
  {
    id: 'toast-deed-star',
    group: 'Deeds',
    label: 'Toast: a Deed with an Astrolabe point',
    w: 1280,
    h: 720,
    render: () => <ToastStage id="heard" />,
  },
  {
    id: 'toast-deed',
    group: 'Deeds',
    label: 'Toast: a badge',
    w: 1280,
    h: 720,
    render: () => <ToastStage id="every_call" />,
  },
  {
    id: 'toast-deed-calling',
    group: 'Deeds',
    label: 'Toast: a Calling’s badge, in its colour',
    w: 1280,
    h: 720,
    render: () => <ToastStage id="dawns_herald" index={1} total={2} />,
  },
  {
    id: 'result-deed-toast',
    group: 'Deeds',
    label: 'Result: the first of two toasts, bottom left',
    w: 1280,
    h: 720,
    render: () => {
      const run = resultRun(true);
      return (
        <ToastStage
          id="heard"
          total={2}
          behind={
            <ResultView run={run} result={run.lastResult!} onContinue={noop} profileXp={LAB_XP} />
          }
        />
      );
    },
  },
  {
    id: 'toast-queue',
    group: 'Deeds',
    label: 'The toasts, live (with sounds)',
    w: 1280,
    h: 720,
    render: () => <ToastQueueLab />,
  },
  {
    id: 'summary-deeds',
    group: 'Deeds',
    label: 'Summary: Deeds earned this run',
    w: 1280,
    h: 1000,
    render: () => (
      <SummaryView run={deedsSummaryRun()} onNewRun={noop} onTitle={noop} profileXp={LAB_XP} />
    ),
  },
  {
    id: 'rank-up-4-deeds',
    group: 'Deeds',
    label: 'Rank 4 with six points from Deeds earned before it',
    w: 1280,
    h: 800,
    render: () => (
      <World>
        <RankUpCard
          rankUps={mockRankUps([4])}
          onDismiss={noop}
          deedPoints={deedPoints(SOME_DEEDS.concat(['encore', 'flawless']))}
        />
      </World>
    ),
  },
  {
    id: 'astrolabe-deeds',
    group: 'Deeds',
    label: 'The Astrolabe at Rank 12 with four points from Deeds',
    w: 1280,
    h: 720,
    render: () => <AstrolabeLab rank={12} initial={RANK12_TREE} deeds={SOME_DEEDS} />,
  },
  {
    id: 'flow',
    group: 'Flow',
    label: 'Whole run, fake combats',
    w: 1280,
    h: 800,
    render: () => <Flow />,
  },
];

function readParams() {
  const p = new URLSearchParams(window.location.search);
  return {
    view: p.get('view') ?? VIEWS[0]!.id,
    h: Number(p.get('h')) || 0,
    w: Number(p.get('w')) || 0,
    fit: p.get('fit') !== '0',
    nav: p.get('nav') !== '0',
    /** Preview a colour-vision palette / UI scale without touching saved settings. */
    vision: COLOR_VISIONS.find((v) => v === p.get('vision')) ?? null,
    scale: Number(p.get('scale')) || 0,
  };
}

/** `?lab=ui` — every HUD state and screen against mock data. `&view=<id>` selects one. */
export function UiLab() {
  const [params, setParams] = useState(readParams);
  const view = VIEWS.find((v) => v.id === params.view) ?? VIEWS[0]!;
  const stageH = params.h || view.h;
  const stageW = params.w || view.w;
  const select = (id: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set('view', id);
    url.searchParams.delete('h');
    window.history.replaceState(null, '', url);
    setParams(readParams());
  };

  const holder = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const el = holder.current;
    if (!el) return;
    const measure = () => setScale(params.fit ? Math.min(1, el.clientWidth / stageW) : 1);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [params.fit, stageW]);
  useEffect(() => {
    document.body.style.overflow = 'auto';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);
  useEffect(() => {
    // After App's installPresentation (effects run child-first, so defer a tick).
    const t = setTimeout(() => {
      if (params.vision) applyVisionCss(params.vision);
      if (params.scale) applyUiScale(params.scale);
    }, 0);
    return () => clearTimeout(t);
  }, [params.vision, params.scale]);

  const groups = [...new Set(VIEWS.map((v) => v.group))];
  return (
    <div className="flex min-h-full bg-ink-950 text-text">
      {params.nav && (
        <nav
          className="sticky top-0 h-screen w-64 shrink-0 overflow-y-auto border-r border-ink-600/60 bg-ink-900 p-4"
          aria-label="UI lab views"
        >
          <h1 className="font-display text-lg font-bold text-gold-300">UI lab</h1>
          <p className="mb-3 text-xs text-muted">Mock data for every HUD state and screen.</p>
          {groups.map((g) => (
            <div key={g} className="mb-4">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted">{g}</p>
              <ul className="flex flex-col gap-0.5">
                {VIEWS.filter((v) => v.group === g).map((v) => (
                  <li key={v.id}>
                    <button
                      type="button"
                      onClick={() => select(v.id)}
                      aria-current={v.id === view.id}
                      className={`w-full rounded-md px-2.5 py-1.5 text-left text-sm ${v.id === view.id ? 'bg-gold-400 font-semibold text-ink-950' : 'text-text hover:bg-ink-800'}`}
                    >
                      {v.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      )}
      <div ref={holder} className="min-w-0 flex-1 p-4">
        <div
          style={{ width: stageW * scale, height: stageH * scale }}
          data-testid="lab-stage-outer"
        >
          <div
            data-testid="lab-stage"
            className="relative origin-top-left overflow-hidden rounded-lg border border-ink-600"
            style={{ width: stageW, height: stageH, transform: `scale(${scale})` }}
          >
            {view.render()}
          </div>
        </div>
      </div>
    </div>
  );
}
