import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { COLOR_VISIONS, applyVisionCss } from '../../app/colorVision';
import { EVERYTHING, UNLOCKS, allowanceFor, type Allowance } from '../../meta/profile';
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
import { CONTENT } from '../../content';
import type { ActiveBoon, ForgeService } from '../../meta/types';
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
} from './mock';

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
      return <CallingView run={run} onPick={(i) => set((r) => Run.pickCalling(r, i))} />;
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

/** Profile XP for the lab's result and summary screens (Rank 3, partway to 4). */
const LAB_XP = 318;

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
