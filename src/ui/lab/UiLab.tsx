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
import { CONTENT, callingDef, sceneDef } from '../../content';
import type { ActiveBoon, ChordLoadout, ForgeService } from '../../meta/types';
import { MapView } from '../screens/MapScreen';
import { PrepView } from '../screens/PrepScreen';
import { RespiteView } from '../screens/RespiteScreen';
import { SceneView } from '../screens/SceneScreen';
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
import {
  carriedRelics,
  carrySlots,
  chooseCarry,
  enshrine as enshrineRelic,
  release as releaseRelic,
  type CraftAction,
  type CraftOutcome,
  type Reliquary,
  type ReliquaryRelic,
} from '../../meta/reliquary';
import type { InscriptionCategory } from '../../content';
import { ReliquaryView } from '../screens/ReliquaryScreen';
import type { ActionId, CraftRecord } from '../screens/reliquaryModel';
import { relicHuds } from '../hud/relics';
import {
  EMPTY_RELIQUARY,
  craftOn,
  depthReliquary,
  dissonanceSummaryRun,
  dissonated,
  fullReliquary,
  mockCraft,
  mockDissonance,
  mockDissonanceHud,
  mockRelic,
  partwayReliquary,
  reliquarySummaryRun,
} from './mock';
import { dissonancePoints, type DissonanceChoice } from '../../meta/dissonance';
import type { Bond } from '../../meta/bonds';
import { BondsView } from '../screens/BondsScreen';
import { BondRankUpCard } from '../screens/BondsParts';
import { bondRanks } from '../screens/bondsModel';
import { labSetSolo, labSetTalent, mockBonds, mockBondsHud, mockRunBonds, sceneRun } from './mock';

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
    case 'scene':
      return <SceneView run={run} onEnd={() => set(Run.endScene)} />;
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

/**
 * The Reliquary in local state (Phase 4c), so crafting, releasing and the carry really work: the
 * meta's own functions, as the profile store calls them.
 */
function ReliquaryLab({
  initial,
  rank,
  unlockAll = false,
  selected,
  action,
  arg,
  last = null,
  holdRoll = false,
  release = false,
}: {
  initial: Reliquary;
  rank: number;
  unlockAll?: boolean;
  selected?: string | null;
  action?: ActionId;
  arg?: number | InscriptionCategory;
  last?: CraftRecord | null;
  holdRoll?: boolean;
  release?: boolean;
}) {
  const [rq, setRq] = useState<Reliquary>(initial);
  const slots = carrySlots(rank, unlockAll);
  return (
    <ReliquaryView
      reliquary={rq}
      rank={rank}
      unlockAll={unlockAll}
      slots={slots}
      onCraft={(uid, a, x) => {
        const res = craftOn(rq, uid, a, x);
        if (res.ok) setRq(res.reliquary);
        return res;
      }}
      onRelease={(uid) => {
        const res = releaseRelic(rq, uid);
        if (!res.ok) return 0;
        setRq(res.reliquary);
        return res.shards;
      }}
      onCarry={(uids) => setRq((r) => chooseCarry(r, uids, slots))}
      onBack={noop}
      backTo="Prep"
      onRules={noop}
      initialSelected={selected}
      initialAction={action}
      initialArg={arg}
      initialLast={last}
      holdRoll={holdRoll}
      initialRelease={release}
    />
  );
}

/** A craft's outcome, real (the meta's roll on a seed that gives it), as the screen shows it. */
function CraftedLab({
  from,
  uid,
  action,
  arg,
  want,
  holdRoll = false,
}: {
  from: Reliquary;
  uid: string;
  action: CraftAction;
  arg?: number | InscriptionCategory;
  want(o: CraftOutcome): boolean;
  holdRoll?: boolean;
}) {
  const [made] = useState(() => mockCraft(from, uid, action, arg, want));
  return (
    <ReliquaryLab
      initial={made.reliquary}
      rank={20}
      selected={uid}
      action={action}
      arg={arg}
      last={made.record}
      holdRoll={holdRoll}
    />
  );
}

/**
 * The Summary of a run that ended with the Reliquary open, its Reliquary in local state: enshrine
 * (once) and release work as the stores do. `enshrine`: one already enshrined.
 */
function SummaryReliquaryLab({
  outcome = 'victory',
  initial,
  enshrine,
  levels,
}: {
  outcome?: 'victory' | 'defeat';
  initial: Reliquary;
  enshrine?: string;
  /** Phase 4d: the run's Dissonance (what it enshrines keeps it as its depth). */
  levels?: readonly DissonanceChoice[];
}) {
  const [state, setState] = useState(() => {
    let run = levels
      ? dissonanceSummaryRun(levels, { opened: false, best: false }, { reliquary: true })
      : reliquarySummaryRun(outcome);
    let rq = initial;
    let arrived: ReliquaryRelic | null = null;
    const found = enshrine ? Run.enshrineOptions(run).find((r) => r.id === enshrine) : undefined;
    if (found) {
      const res = enshrineRelic(rq, found, dissonancePoints(run.dissonance));
      if (res.ok) {
        rq = res.reliquary;
        arrived = res.relic;
        run = { ...run, reliquary: { ...run.reliquary!, enshrined: found.id } };
      }
    }
    return { run, rq, arrived };
  });
  return (
    <SummaryView
      run={state.run}
      onNewRun={noop}
      onTitle={noop}
      profileXp={RANK_XP[19]! + 400}
      enshrined={state.arrived}
      reliquary={{
        reliquary: state.rq,
        onEnshrine: (id) => {
          const found = Run.enshrineOptions(state.run).find((r) => r.id === id);
          if (!found || state.run.reliquary?.enshrined)
            return { ok: false, reason: 'This run has enshrined one.' };
          // At the run's Dissonance, as the run store enshrines (Phase 4d).
          const res = enshrineRelic(state.rq, found, dissonancePoints(state.run.dissonance));
          if (res.ok)
            setState((st) => ({
              ...st,
              rq: res.reliquary,
              run: { ...st.run, reliquary: { ...st.run.reliquary!, enshrined: id } },
            }));
          return res;
        },
        onRelease: (uid) => {
          const res = releaseRelic(state.rq, uid);
          if (!res.ok) return 0;
          setState((st) => ({ ...st, rq: res.reliquary }));
          return res.shards;
        },
      }}
    />
  );
}

/** The HUD with three relics carried: the first attuned (marked), the others dormant. */
function HudReliquary() {
  const carried = carriedRelics(fullReliquary(), 3);
  const base = mockHud('calm');
  const hud = {
    ...base,
    relics: relicHuds({
      relics: {
        ids: [carried[0]!.id, 'silver_thimble'],
        cleansed: [],
        metronomeAt: null,
        thimbleAt: 92.3,
        veil: false,
      },
      time: base.seconds,
      ledger: { perfects: 2, downs: 0 },
    }),
  };
  return (
    <World>
      <HudView
        hud={hud}
        callouts={[]}
        decree={null}
        subtitle="The Prelude · node 3 of 10"
        carried={carried}
        coach={false}
      />
    </World>
  );
}

/** Prep with the Reliquary's row: what this run carries, at a Rank. */
function PrepReliquary({ rank, rq }: { rank: number; rq: Reliquary }) {
  const slots = carrySlots(rank);
  return (
    <Interactive initial={() => Run.newRun(7, GUARDIAN_CHORDS, [], carriedRelics(rq, slots))}>
      {(run, set) => (
        <PrepView
          run={run}
          onChords={(c) => set((r) => Run.setChords(r, c))}
          onCalling={(id) => set((r) => Run.setCalling(r, id))}
          onEmbark={noop}
          onBack={noop}
          rank={rank}
          astrolabe={{ points: astrolabePoints(rank), onOpen: noop }}
          reliquary={{ slots, onOpen: noop }}
        />
      )}
    </Interactive>
  );
}

/** The map of a run that carries three relics (one attuned), a carried one's tooltip open. */
function MapReliquary({ peek }: { peek: string }) {
  const [run] = useState(() =>
    Run.embark(Run.newRun(7, undefined, [], carriedRelics(fullReliquary(), 3))),
  );
  return <MapView run={run} onChoose={noop} onAbandon={noop} peekRelic={peek} />;
}

/** The Title at a Rank with a Reliquary (its materials on the menu). */
function TitleReliquary({ rank, rq }: { rank: number; rq: Reliquary }) {
  useState(() => {
    const p = useProfile.getState().profile;
    useProfile.setState({
      profile: { ...p, xp: RANK_XP[rank - 1]! + 10, reliquary: rq, runs: 21, wins: 9 },
    });
    return true;
  });
  return <TitleScreen />;
}

/**
 * Prep with Dissonance (Phase 4d), open or closed, at a Rank: these levels chosen, these bests
 * kept. Choosing works as the store does it (the run follows the choice: `Run.setDissonance`).
 */
function PrepDissonance({
  rank,
  open,
  levels = [],
  best = {},
  calling = null,
  carried = [],
}: {
  rank: number;
  open: boolean;
  levels?: readonly DissonanceChoice[];
  best?: Readonly<Record<string, number>>;
  calling?: string | null;
  /** Relics the run carries (Discordant Pact has nothing to give when they're every cursed one). */
  carried?: readonly ReliquaryRelic[];
}) {
  const allowance = allowanceFor(rank);
  return (
    <Interactive
      initial={() => {
        const run = Run.newRun(7, GUARDIAN_CHORDS, [], carried, open ? levels : []);
        return calling ? Run.setCalling(run, calling, allowance) : run;
      }}
    >
      {(run, set) => (
        <PrepView
          run={run}
          onChords={(c) => set((r) => Run.setChords(r, c, allowance))}
          onCalling={(id) => set((r) => Run.setCalling(r, id, allowance))}
          onEmbark={noop}
          onBack={noop}
          allowance={allowance}
          rank={rank}
          astrolabe={{ points: astrolabePoints(rank), onOpen: noop }}
          reliquary={{ slots: carrySlots(rank), onOpen: noop }}
          dissonance={{ open, best, onChange: (lv) => set((r) => Run.setDissonance(r, lv)) }}
        />
      )}
    </Interactive>
  );
}

/** Unforgiving's level (by its effect, so the tuning can rename it). */
function unforgivingId(): string {
  return CONTENT.dissonance.find((d) => d.effect === 'no_respite_heal')?.id ?? 'unforgiving';
}

/** The HUD with Dissonance in force (what the bridge reads of a real fight at these levels). */
function HudDissonance({
  scenario,
  levels,
  tip = false,
}: {
  scenario: HudScenario;
  levels: readonly DissonanceChoice[];
  tip?: boolean;
}) {
  const [hud] = useState(() => mockDissonanceHud(scenario, levels));
  return (
    <World>
      <HudView
        hud={hud}
        callouts={mockCallouts(scenario)}
        decree={
          scenario === 'boss'
            ? {
                name: 'Requiem',
                text: 'Every hero will lose 90% of their life. Cue Kael’s dome, or Ward and heal.',
              }
            : null
        }
        subtitle="The Prelude · node 3 of 10"
        forceCoach
        dissonanceTip={tip}
      />
    </World>
  );
}

/**
 * The Bonds screen (Phase 4e) over mock Bonds: choosing works as the profile store does it
 * (`labSetTalent`, `labSetSolo`), at these ranks or with Skip the unlocks.
 */
function BondsLab({
  initial,
  unlockAll = false,
  hero,
  reading = null,
}: {
  initial(): Record<string, Bond>;
  unlockAll?: boolean;
  hero?: string;
  reading?: string | null;
}) {
  const [bonds, setBonds] = useState(initial);
  return (
    <BondsView
      bonds={bonds}
      unlockAll={unlockAll}
      onTalent={(h, tier, id) => setBonds((b) => labSetTalent(b, h, tier, id, unlockAll))}
      onSolo={(h, solo) => setBonds((b) => labSetSolo(b, h, solo, unlockAll))}
      onBack={noop}
      backTo="Prep"
      onRules={noop}
      initialHero={hero}
      initialReading={reading}
    />
  );
}

/** Prep with the Bonds row (Phase 4e): the run plays what these Bonds open. */
function PrepBonds({ bonds, rank }: { bonds: Record<string, Bond>; rank: number }) {
  const allowance = allowanceFor(rank);
  return (
    <Interactive initial={() => Run.newRun(7, GUARDIAN_CHORDS, [], [], [], mockRunBonds(bonds))}>
      {(run, set) => (
        <PrepView
          run={run}
          onChords={(c) => set((r) => Run.setChords(r, c, allowance))}
          onCalling={(id) => set((r) => Run.setCalling(r, id, allowance))}
          onEmbark={noop}
          onBack={noop}
          allowance={allowance}
          rank={rank}
          astrolabe={{ points: astrolabePoints(rank, false, 0), onOpen: noop }}
          bonds={{ bonds, onOpen: noop }}
        />
      )}
    </Interactive>
  );
}

/** A content scene of a hero's, by its place among theirs (0: the first). */
function heroScene(heroId: string, index = 0): string {
  return CONTENT.scenes.filter((sc) => sc.hero === heroId).sort((a, b) => a.rank - b.rank)[index]!
    .id;
}

/** The Title with Bonds open (Phase 4e): the button and each hero's rank on it. */
function TitleBonds({ bonds, rank }: { bonds: Record<string, Bond>; rank: number }) {
  useState(() => {
    const p = useProfile.getState().profile;
    useProfile.setState({
      profile: { ...p, xp: RANK_XP[rank - 1]! + 10, bonds, runs: 6, wins: 2 },
    });
    return true;
  });
  return <TitleScreen />;
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
  // ── Phase 4c: the Reliquary ──────────────────────────────────────────────────────────
  {
    id: 'reliquary-empty',
    group: 'Reliquary',
    label: 'The screen at Rank 10: nothing enshrined yet',
    w: 1280,
    h: 720,
    render: () => <ReliquaryLab initial={EMPTY_RELIQUARY} rank={10} />,
  },
  {
    id: 'reliquary-partway',
    group: 'Reliquary',
    label: 'Partway (Rank 15): six relics, two carried, Inscribe’s preview',
    w: 1280,
    h: 720,
    render: () => <ReliquaryLab initial={partwayReliquary()} rank={15} />,
  },
  {
    id: 'reliquary-full',
    group: 'Reliquary',
    label: 'Full (Rank 20): twelve relics, every state, three carried',
    w: 1280,
    h: 720,
    render: () => <ReliquaryLab initial={fullReliquary()} rank={20} selected="r7" />,
  },
  {
    id: 'reliquary-inscribe',
    group: 'Reliquary',
    label: 'Inscribe: Choir is full on Silver Thimble (disabled, with why)',
    w: 1280,
    h: 720,
    render: () => (
      <ReliquaryLab
        initial={partwayReliquary()}
        rank={15}
        selected="r3"
        action="inscribe"
        arg="aegis"
      />
    ),
  },
  {
    id: 'reliquary-retune',
    group: 'Reliquary',
    label: 'Retune: the chance of a higher value; a tier of one value refused',
    w: 1280,
    h: 720,
    render: () => (
      <ReliquaryLab initial={fullReliquary()} rank={20} selected="r12" action="retune" arg={1} />
    ),
  },
  {
    id: 'reliquary-ascend',
    group: 'Reliquary',
    label: 'Ascend: its odds; T3 waits for Dissonance',
    w: 1280,
    h: 720,
    render: () => (
      <ReliquaryLab initial={partwayReliquary()} rank={15} selected="r1" action="ascend" arg={0} />
    ),
  },
  {
    id: 'reliquary-risky',
    group: 'Reliquary',
    label: 'High Instability: a big Fracture chance before Ascend',
    w: 1280,
    h: 720,
    render: () => (
      <ReliquaryLab
        initial={{
          ...partwayReliquary(),
          relics: partwayReliquary().relics.map((r) =>
            r.uid === 'r4' ? { ...r, instability: 74 } : r,
          ),
        }}
        rank={15}
        selected="r4"
        action="ascend"
        arg={1}
      />
    ),
  },
  {
    id: 'reliquary-dissonate',
    group: 'Reliquary',
    label: 'Dissonate: the four outcomes for this relic',
    w: 1280,
    h: 720,
    render: () => (
      <ReliquaryLab initial={partwayReliquary()} rank={15} selected="r1" action="dissonate" />
    ),
  },
  {
    id: 'reliquary-dissonate-veil',
    group: 'Reliquary',
    label: 'Dissonate: no numbers to grow (Martyr’s Veil)',
    w: 1280,
    h: 720,
    render: () => (
      <ReliquaryLab initial={fullReliquary()} rank={20} selected="r12" action="dissonate" />
    ),
  },
  {
    id: 'reliquary-short',
    group: 'Reliquary',
    label: 'Not enough Tuning Shards: the reason before the click',
    w: 1280,
    h: 720,
    render: () => (
      <ReliquaryLab
        initial={{ ...partwayReliquary(), shards: 4, tears: 0 }}
        rank={15}
        selected="r2"
        action="inscribe"
        arg="bond"
      />
    ),
  },
  {
    id: 'reliquary-release',
    group: 'Reliquary',
    label: 'Release: asked first, with its shards',
    w: 1280,
    h: 720,
    render: () => (
      <ReliquaryLab initial={partwayReliquary()} rank={15} selected="r1" action="release" release />
    ),
  },
  {
    id: 'reliquary-four',
    group: 'Reliquary',
    label: 'Four Inscriptions: Inscribe refused at the button, Retune’s odds',
    w: 1280,
    h: 720,
    render: () => <ReliquaryLab initial={fullReliquary()} rank={20} selected="r11" />,
  },
  {
    id: 'reliquary-twin',
    group: 'Reliquary',
    label: 'The carry: never two of the same relic (a second Cantor’s Hymnal)',
    w: 1280,
    h: 720,
    render: () => <ReliquaryLab initial={fullReliquary()} rank={20} selected="r10" />,
  },
  {
    id: 'reliquary-dormant',
    group: 'Reliquary',
    label: 'A carried relic in slot 2: dormant, with Attune',
    w: 1280,
    h: 720,
    render: () => <ReliquaryLab initial={partwayReliquary()} rank={15} selected="r2" />,
  },
  {
    id: 'reliquary-inscribed',
    group: 'Reliquary',
    label: 'Outcome: a fine Inscription (T3), etched',
    w: 1280,
    h: 720,
    render: () => (
      <CraftedLab
        from={partwayReliquary()}
        uid="r2"
        action="inscribe"
        arg="aegis"
        want={(o) => o.kind === 'inscribed' && o.inscription.tier === 3}
      />
    ),
  },
  {
    id: 'reliquary-retuned',
    group: 'Reliquary',
    label: 'Outcome: Retune, a higher value',
    w: 1280,
    h: 720,
    render: () => (
      <CraftedLab
        from={partwayReliquary()}
        uid="r3"
        action="retune"
        arg={0}
        want={(o) => o.kind === 'retuned' && o.to > o.from}
      />
    ),
  },
  {
    id: 'reliquary-ascended',
    group: 'Reliquary',
    label: 'Outcome: Ascend rose a tier',
    w: 1280,
    h: 720,
    render: () => (
      <CraftedLab
        from={partwayReliquary()}
        uid="r2"
        action="ascend"
        arg={0}
        want={(o) => o.kind === 'ascended'}
      />
    ),
  },
  {
    id: 'reliquary-missed',
    group: 'Reliquary',
    label: 'Outcome: Ascend missed',
    w: 1280,
    h: 720,
    render: () => (
      <CraftedLab
        from={partwayReliquary()}
        uid="r1"
        action="ascend"
        arg={0}
        want={(o) => o.kind === 'missed'}
      />
    ),
  },
  {
    id: 'reliquary-fractured',
    group: 'Reliquary',
    label: 'Outcome: a Fracture',
    w: 1280,
    h: 720,
    render: () => (
      <CraftedLab
        from={partwayReliquary()}
        uid="r1"
        action="inscribe"
        arg="bond"
        want={(o) => o.kind === 'fractured'}
      />
    ),
  },
  {
    id: 'reliquary-rolling',
    group: 'Reliquary',
    label: 'Dissonate: the roll, before its outcome',
    w: 1280,
    h: 720,
    render: () => (
      <CraftedLab
        from={partwayReliquary()}
        uid="r1"
        action="dissonate"
        want={dissonated('dissonant')}
        holdRoll
      />
    ),
  },
  {
    id: 'reliquary-dissonant',
    group: 'Reliquary',
    label: 'Outcome: Dissonant, a fifth slot',
    w: 1280,
    h: 720,
    render: () => (
      <CraftedLab
        from={partwayReliquary()}
        uid="r1"
        action="dissonate"
        want={dissonated('dissonant')}
      />
    ),
  },
  {
    id: 'reliquary-empowered',
    group: 'Reliquary',
    label: 'Outcome: Empowered, its own effect grows',
    w: 1280,
    h: 720,
    render: () => (
      <CraftedLab
        from={partwayReliquary()}
        uid="r1"
        action="dissonate"
        want={dissonated('empowered')}
      />
    ),
  },
  {
    id: 'reliquary-cursed',
    group: 'Reliquary',
    label: 'Outcome: Cursed, every Inscription a tier up and a curse',
    w: 1280,
    h: 720,
    render: () => (
      <CraftedLab
        from={partwayReliquary()}
        uid="r1"
        action="dissonate"
        want={dissonated('cursed')}
      />
    ),
  },
  {
    id: 'reliquary-shattered',
    group: 'Reliquary',
    label: 'Outcome: Shattered, nothing changes',
    w: 1280,
    h: 720,
    render: () => (
      <CraftedLab
        from={partwayReliquary()}
        uid="r1"
        action="dissonate"
        want={dissonated('shattered')}
      />
    ),
  },
  {
    id: 'summary-enshrine',
    group: 'Reliquary',
    label: 'Summary: a won run’s Enshrine panel',
    w: 1280,
    h: 1100,
    render: () => <SummaryReliquaryLab initial={partwayReliquary()} />,
  },
  {
    id: 'summary-enshrined',
    group: 'Reliquary',
    label: 'Summary: enshrined, its first Inscriptions',
    w: 1280,
    h: 1100,
    render: () => <SummaryReliquaryLab initial={partwayReliquary()} enshrine="glass_halo" />,
  },
  {
    id: 'summary-enshrine-full',
    group: 'Reliquary',
    label: 'Summary: the Reliquary is full, release one first',
    w: 1280,
    h: 1200,
    render: () => <SummaryReliquaryLab initial={fullReliquary()} />,
  },
  {
    id: 'summary-reliquary-lost',
    group: 'Reliquary',
    label: 'Summary: a lost run, what it paid',
    w: 1280,
    h: 900,
    render: () => <SummaryReliquaryLab outcome="defeat" initial={partwayReliquary()} />,
  },
  {
    id: 'prep-reliquary',
    group: 'Reliquary',
    label: 'Prep: the Reliquary’s row (Rank 15, two carried)',
    w: 1280,
    h: 720,
    render: () => <PrepReliquary rank={15} rq={partwayReliquary()} />,
  },
  {
    id: 'prep-reliquary-20',
    group: 'Reliquary',
    label: 'Prep: Rank 20, three carried',
    w: 1280,
    h: 720,
    render: () => <PrepReliquary rank={20} rq={fullReliquary()} />,
  },
  {
    id: 'hud-reliquary',
    group: 'Reliquary',
    label: 'HUD: the attuned relic marked, two dormant',
    w: 1280,
    h: 720,
    render: () => <HudReliquary />,
  },
  {
    id: 'map-reliquary',
    group: 'Reliquary',
    label: 'Map: a carried relic’s tooltip (its Inscriptions)',
    w: 1280,
    h: 900,
    render: () => <MapReliquary peek="prism_loom" />,
  },
  {
    id: 'map-reliquary-dormant',
    group: 'Reliquary',
    label: 'Map: a dormant relic’s tooltip',
    w: 1280,
    h: 900,
    render: () => <MapReliquary peek="lantern_of_the_lost" />,
  },
  {
    id: 'codex-reliquary',
    group: 'Reliquary',
    label: 'Codex: the Reliquary',
    w: 1280,
    h: 3300,
    render: () => <CodexView onBack={noop} initialTab="reliquary" />,
  },
  {
    id: 'codex-reliquary-locked',
    group: 'Reliquary',
    label: 'Codex: the Reliquary, locked (Rank 6)',
    w: 1280,
    h: 720,
    render: () => (
      <CodexView onBack={noop} initialTab="reliquary" allowance={allowanceFor(6)} rank={6} />
    ),
  },
  {
    id: 'rank-up-10',
    group: 'Reliquary',
    label: 'Rank 10: the Reliquary opens',
    w: 1280,
    h: 800,
    render: () => (
      <World>
        <RankUpCard rankUps={mockRankUps([10])} onDismiss={noop} />
      </World>
    ),
  },
  {
    id: 'rank-up-15-20',
    group: 'Reliquary',
    label: 'Ranks 15 and 20: a second and a third relic to carry',
    w: 1280,
    h: 900,
    render: () => (
      <World>
        <RankUpCard rankUps={mockRankUps([15, 20])} onDismiss={noop} />
      </World>
    ),
  },
  {
    id: 'rank-panels-reliquary',
    group: 'Reliquary',
    label: 'Rank panels at Ranks 9 and 14: what the next Rank opens',
    w: 1280,
    h: 720,
    render: () => (
      <ScreenFrame tone="gold">
        <div className="mx-auto grid max-w-6xl items-start gap-6 px-6 py-10 md:grid-cols-2">
          <RankPanelView profile={{ xp: RANK_XP[8]! + 600, runs: 24, wins: 10 }} />
          <RankPanelView profile={{ xp: RANK_XP[13]! + 900, runs: 41, wins: 19 }} />
        </div>
      </ScreenFrame>
    ),
  },
  {
    id: 'codex-rank-reliquary',
    group: 'Reliquary',
    label: 'Codex: Weaver Rank, its unlocks with their icons',
    w: 1280,
    h: 2000,
    render: () => <CodexView onBack={noop} initialTab="rank" />,
  },
  {
    id: 'title-reliquary',
    group: 'Reliquary',
    label: 'Title at Rank 16: the Reliquary with its materials',
    w: 1280,
    h: 720,
    render: () => <TitleReliquary rank={16} rq={partwayReliquary()} />,
  },
  // ── Phase 4d: Dissonance ─────────────────────────────────────────────────────────────
  {
    id: 'prep-dissonance-closed',
    group: 'Dissonance',
    label: 'Prep: closed (Rank 12): how it opens',
    w: 1280,
    h: 860,
    render: () => <PrepDissonance rank={12} open={false} />,
  },
  {
    id: 'prep-dissonance-closed-16',
    group: 'Dissonance',
    label: 'Prep: closed at Rank 16: the next win opens it',
    w: 1280,
    h: 860,
    render: () => <PrepDissonance rank={16} open={false} />,
  },
  {
    id: 'prep-dissonance-open',
    group: 'Dissonance',
    label: 'Prep: open, nothing chosen',
    w: 1280,
    h: 1160,
    render: () => <PrepDissonance rank={16} open />,
  },
  {
    id: 'prep-dissonance-10',
    group: 'Dissonance',
    label: 'Prep: about 10 points, the Luminary’s best 8',
    w: 1280,
    h: 1160,
    render: () => (
      <PrepDissonance
        rank={18}
        open
        levels={mockDissonance(10)}
        calling="luminary"
        best={{ luminary: 8, none: 12 }}
      />
    ),
  },
  {
    id: 'prep-dissonance-20',
    group: 'Dissonance',
    label: 'Prep: about 20 points, below the best',
    w: 1280,
    h: 1160,
    render: () => (
      <PrepDissonance
        rank={20}
        open
        levels={mockDissonance(20)}
        best={{ none: dissonancePoints(mockDissonance(20)) + 2 }}
      />
    ),
  },
  {
    id: 'prep-dissonance-max',
    group: 'Dissonance',
    label: 'Prep: every level at its top rank',
    w: 1280,
    h: 1160,
    render: () => (
      <PrepDissonance
        rank={20}
        open
        levels={mockDissonance(Infinity)}
        best={{ none: 21, luminary: 14 }}
      />
    ),
  },
  {
    id: 'prep-dissonance-pact',
    group: 'Dissonance',
    label: 'Prep: Discordant Pact with nothing to give (every cursed relic carried)',
    w: 1280,
    h: 1160,
    render: () => (
      <PrepDissonance
        rank={20}
        open
        levels={[
          ...mockDissonance(10),
          { id: CONTENT.dissonance.find((d) => d.effect === 'cursed_start')!.id, rank: 1 },
        ]}
        carried={CONTENT.relics
          .filter((r) => r.rarity === 'cursed')
          .map((r, i) => mockRelic(`r${i + 1}`, r.id))}
      />
    ),
  },
  {
    id: 'summary-dissonance-opened',
    group: 'Dissonance',
    label: 'Summary: the win that opened it (Rank 15)',
    w: 1280,
    h: 900,
    render: () => (
      <SummaryView
        run={dissonanceSummaryRun([], { opened: true, best: false })}
        onNewRun={noop}
        onTitle={noop}
        profileXp={RANK_XP[14]! + 300}
      />
    ),
  },
  {
    id: 'summary-dissonance-best',
    group: 'Dissonance',
    label: 'Summary: a new best as the Luminary',
    w: 1280,
    h: 900,
    render: () => (
      <SummaryView
        run={dissonanceSummaryRun(
          mockDissonance(14),
          { opened: false, best: true },
          { calling: true },
        )}
        onNewRun={noop}
        onTitle={noop}
        profileXp={RANK_XP[17]! + 300}
      />
    ),
  },
  {
    id: 'summary-dissonance-enshrine',
    group: 'Dissonance',
    label: 'Summary: enshrine at its depth (about 12)',
    w: 1280,
    h: 1300,
    render: () => <SummaryReliquaryLab initial={partwayReliquary()} levels={mockDissonance(12)} />,
  },
  {
    id: 'summary-dissonance-enshrined',
    group: 'Dissonance',
    label: 'Summary: enshrined, its depth and what it reaches',
    w: 1280,
    h: 1300,
    render: () => (
      <SummaryReliquaryLab
        initial={partwayReliquary()}
        levels={mockDissonance(12)}
        enshrine="glass_halo"
      />
    ),
  },
  {
    id: 'hud-dissonance',
    group: 'Dissonance',
    label: 'HUD: the readout, its levels on hover; Silent Cues on the arc',
    w: 1280,
    h: 720,
    render: () => <HudDissonance scenario="calm" levels={mockDissonance(20)} tip />,
  },
  {
    id: 'hud-dissonance-blind',
    group: 'Dissonance',
    label: 'HUD: Blind Score at the Cantor: answers hidden',
    w: 1280,
    h: 720,
    render: () => <HudDissonance scenario="boss" levels={mockDissonance(20)} />,
  },
  {
    id: 'hud-dissonance-seen',
    group: 'Dissonance',
    label: 'HUD: the same fight without Blind Score (to compare)',
    w: 1280,
    h: 720,
    render: () => <HudDissonance scenario="boss" levels={mockDissonance(10)} />,
  },
  {
    id: 'reliquary-depth-0',
    group: 'Dissonance',
    label: 'Reliquary: depth 0, T3 waits for a deeper relic',
    w: 1280,
    h: 720,
    render: () => (
      <ReliquaryLab initial={depthReliquary()} rank={20} selected="r1" action="ascend" arg={0} />
    ),
  },
  {
    id: 'reliquary-depth-10',
    group: 'Dissonance',
    label: 'Reliquary: won at the first band, Ascend to T2',
    w: 1280,
    h: 720,
    render: () => (
      <ReliquaryLab initial={depthReliquary()} rank={20} selected="r2" action="ascend" arg={1} />
    ),
  },
  {
    id: 'reliquary-depth-20',
    group: 'Dissonance',
    label: 'Reliquary: won deepest, Ascend to T1',
    w: 1280,
    h: 720,
    render: () => (
      <ReliquaryLab initial={depthReliquary()} rank={20} selected="r3" action="ascend" arg={1} />
    ),
  },
  {
    id: 'reliquary-depth-inscribe',
    group: 'Dissonance',
    label: 'Reliquary: Inscribe at the deepest band (T2 and T1 odds)',
    w: 1280,
    h: 720,
    render: () => (
      <ReliquaryLab
        initial={depthReliquary()}
        rank={20}
        selected="r3"
        action="inscribe"
        arg="bond"
      />
    ),
  },
  {
    id: 'reliquary-depth-dissonate',
    group: 'Dissonance',
    label: 'Reliquary: Dissonate at the first band (Cursed reaches further)',
    w: 1280,
    h: 720,
    render: () => (
      <ReliquaryLab initial={depthReliquary()} rank={20} selected="r2" action="dissonate" />
    ),
  },
  {
    id: 'respite-unforgiving',
    group: 'Dissonance',
    label: 'Respite under Unforgiving: Rest only steadies the Shaken',
    w: 1280,
    h: 800,
    render: () => (
      <RespiteView
        run={{ ...respiteRun(), dissonance: [{ id: unforgivingId(), rank: 1 }] }}
        onChoose={noop}
        onRetune={noop}
      />
    ),
  },
  {
    id: 'draft-unforgiving',
    group: 'Dissonance',
    label: 'Meditate under Unforgiving: skipping heals nothing',
    w: 1280,
    h: 800,
    render: () => (
      <Interactive
        initial={() =>
          Run.respite(
            { ...respiteRun(), dissonance: [{ id: unforgivingId(), rank: 1 }] },
            'meditate',
          )
        }
      >
        {(run, set) => <DraftView run={run} onPick={noop} onReroll={() => set(Run.rerollDraft)} />}
      </Interactive>
    ),
  },
  {
    id: 'codex-dissonance',
    group: 'Dissonance',
    label: 'Codex: Dissonance',
    w: 1280,
    h: 1520,
    render: () => (
      <CodexView
        onBack={noop}
        initialTab="dissonance"
        dissonance={{ open: true, best: { none: 21, luminary: 14 } }}
      />
    ),
  },
  {
    id: 'codex-dissonance-locked',
    group: 'Dissonance',
    label: 'Codex: Dissonance, locked (Rank 12)',
    w: 1280,
    h: 720,
    render: () => (
      <CodexView
        onBack={noop}
        initialTab="dissonance"
        allowance={allowanceFor(12)}
        rank={12}
        dissonance={{ open: false, best: {} }}
      />
    ),
  },
  {
    id: 'codex-reliquary-depth',
    group: 'Dissonance',
    label: 'Codex: the Reliquary, its crafts with depth',
    w: 1280,
    h: 1500,
    render: () => <CodexView onBack={noop} initialTab="reliquary" />,
  },
  {
    id: 'rank-up-15-dissonance',
    group: 'Dissonance',
    label: 'Rank 15: Dissonance, opened by a win',
    w: 1280,
    h: 800,
    render: () => (
      <World>
        <RankUpCard rankUps={mockRankUps([15])} onDismiss={noop} />
      </World>
    ),
  },
  {
    id: 'rank-panels-dissonance',
    group: 'Dissonance',
    label: 'Rank panel at 14: what Rank 15 opens',
    w: 1280,
    h: 720,
    render: () => (
      <ScreenFrame tone="gold">
        <div className="mx-auto grid max-w-6xl items-start gap-6 px-6 py-10 md:grid-cols-2">
          <RankPanelView profile={{ xp: RANK_XP[13]! + 900, runs: 41, wins: 19 }} />
        </div>
      </ScreenFrame>
    ),
  },
  // ── Phase 4e: Bonds ──────────────────────────────────────────────────────────────────
  {
    id: 'bonds-rank-1',
    group: 'Bonds',
    label: 'Bonds screen: rank 1, everything ahead',
    w: 1280,
    h: 720,
    render: () => <BondsLab initial={() => mockBonds(1, { choose: false })} />,
  },
  {
    id: 'bonds-rank-4',
    group: 'Bonds',
    label: 'Bonds screen: rank 4, tier I chosen, the first scene seen',
    w: 1280,
    h: 720,
    render: () => <BondsLab initial={() => mockBonds(4, { seenAll: true })} />,
  },
  {
    id: 'bonds-rank-7',
    group: 'Bonds',
    label: 'Bonds screen: rank 7 (Lyra), two tiers, a scene waiting',
    w: 1280,
    h: 720,
    render: () => <BondsLab initial={() => mockBonds(7)} hero="lyra" />,
  },
  {
    id: 'bonds-rank-10',
    group: 'Bonds',
    label: 'Bonds screen: rank 10 (Vexis), every tier and the alternate Solo',
    w: 1280,
    h: 720,
    render: () => <BondsLab initial={() => mockBonds(10, { seenAll: true })} hero="vexis" />,
  },
  {
    id: 'bonds-skip',
    group: 'Bonds',
    label: 'Bonds screen: Skip the unlocks at rank 1',
    w: 1280,
    h: 760,
    render: () => <BondsLab initial={() => mockBonds(1, { choose: false })} unlockAll />,
  },
  {
    id: 'bonds-reader',
    group: 'Bonds',
    label: 'Bonds screen: a seen scene read again',
    w: 1280,
    h: 720,
    render: () => (
      <BondsLab initial={() => mockBonds(7)} reading={heroScene(CONTENT.defaultParty[0]!)} />
    ),
  },
  {
    id: 'title-bonds',
    group: 'Bonds',
    label: 'Title: Bonds open, each hero’s rank',
    w: 1280,
    h: 720,
    render: () => <TitleBonds bonds={mockBonds(4)} rank={6} />,
  },
  {
    id: 'prep-bonds',
    group: 'Bonds',
    label: 'Prep: the Bonds row and the hero cards (rank 10: alternate Solos)',
    w: 1280,
    h: 1400,
    render: () => <PrepBonds bonds={mockBonds(10)} rank={12} />,
  },
  {
    id: 'prep-bonds-early',
    group: 'Bonds',
    label: 'Prep: the Bonds row at ranks 2–4',
    w: 1280,
    h: 900,
    render: () => (
      <PrepBonds
        bonds={{ ...mockBonds(4), lyra: mockBonds(2).lyra!, vexis: mockBonds(3).vexis! }}
        rank={5}
      />
    ),
  },
  {
    id: 'result-bonds',
    group: 'Bonds',
    label: 'Result: each hero’s Bond XP',
    w: 1280,
    h: 900,
    render: () => (
      <ResultView
        run={resultRun(true)}
        result={resultRun(true).lastResult!}
        onContinue={noop}
        profileXp={RANK_XP[5]! + 120}
        bonds={mockBonds(4)}
      />
    ),
  },
  {
    id: 'result-bond-first',
    group: 'Bonds',
    label: 'Result: the first Bond rank-up ever introduces Bonds',
    w: 1280,
    h: 900,
    render: () => {
      const bonds = mockBonds(2, { choose: false, share: 0.05 });
      return (
        <ResultView
          run={resultRun(true)}
          result={resultRun(true).lastResult!}
          onContinue={noop}
          profileXp={RANK_XP[1]! + 40}
          bonds={bonds}
          bondCard={{
            notices: CONTENT.defaultParty.map((heroId) => ({ heroId, rank: 2 })),
            bonds,
            first: true,
            unlockAll: false,
            onDismiss: noop,
          }}
        />
      );
    },
  },
  {
    id: 'result-bond-rankup',
    group: 'Bonds',
    label: 'Result: Bond rank-ups open a tier, and nothing',
    w: 1280,
    h: 900,
    render: () => {
      const bonds = { ...mockBonds(3, { share: 0.05 }), lyra: mockBonds(5, { share: 0.05 }).lyra! };
      return (
        <ResultView
          run={resultRun(true)}
          result={resultRun(true).lastResult!}
          onContinue={noop}
          profileXp={RANK_XP[5]! + 40}
          bonds={bonds}
          bondCard={{
            notices: [
              { heroId: 'kael', rank: 3 },
              { heroId: 'lyra', rank: 5 },
            ],
            bonds,
            first: false,
            unlockAll: false,
            onDismiss: noop,
          }}
        />
      );
    },
  },
  {
    id: 'summary-bonds',
    group: 'Bonds',
    label: 'Summary: the run’s Bond XP; rank 10 opens an alternate Solo, rank 7 a scene',
    w: 1280,
    h: 900,
    render: () => {
      const bonds = {
        ...mockBonds(7, { share: 0.05 }),
        lyra: mockBonds(6).lyra!,
        vexis: mockBonds(10, { share: 0.02 }).vexis!,
      };
      return (
        <SummaryView
          run={summaryRun('victory')}
          onNewRun={noop}
          onTitle={noop}
          profileXp={RANK_XP[11]! + 300}
          bonds={bonds}
          bondCard={{
            notices: [
              { heroId: 'kael', rank: 7 },
              { heroId: 'vexis', rank: 10 },
            ],
            bonds,
            first: false,
            unlockAll: false,
            onDismiss: noop,
          }}
        />
      );
    },
  },
  {
    id: 'summary-bonds-panel',
    group: 'Bonds',
    label: 'Summary: the Bonds panel (no card)',
    w: 1280,
    h: 900,
    render: () => (
      <SummaryView
        run={summaryRun('victory')}
        onNewRun={noop}
        onTitle={noop}
        profileXp={RANK_XP[11]! + 300}
        bonds={mockBonds(5)}
      />
    ),
  },
  {
    id: 'map-bond-rankup',
    group: 'Bonds',
    label: 'Map after a scene: its Bond XP reached a rank',
    w: 1280,
    h: 800,
    render: () => {
      const bonds = mockBonds(3, { share: 0.02 });
      return (
        <>
          <MapView run={playedRun(3)} onChoose={noop} onAbandon={noop} />
          <BondRankUpCard
            notices={[{ heroId: 'lyra', rank: 3 }]}
            bonds={bonds}
            first={false}
            unlockAll={false}
            onDismiss={noop}
          />
        </>
      );
    },
  },
  {
    id: 'respite-scene-1',
    group: 'Bonds',
    label: 'Respite: a scene waiting (a fourth choice)',
    w: 1280,
    h: 900,
    render: () => (
      <RespiteView
        run={respiteRun()}
        onChoose={noop}
        onRetune={noop}
        scenes={[sceneDef(heroScene('kael'))]}
        onScene={noop}
      />
    ),
  },
  {
    id: 'respite-scenes-2',
    group: 'Bonds',
    label: 'Respite: two scenes waiting',
    w: 1280,
    h: 900,
    render: () => (
      <RespiteView
        run={respiteRun()}
        onChoose={noop}
        onRetune={noop}
        scenes={[sceneDef(heroScene('lyra')), sceneDef(heroScene('vexis', 1))]}
        onScene={noop}
      />
    ),
  },
  ...CONTENT.scenes.map((sc): ViewDef => ({
    id: `scene-${sc.id}`,
    group: 'Bonds',
    label: `Scene: ${sc.title} (${CONTENT.heroes.find((h) => h.id === sc.hero)?.name}, rank ${sc.rank})`,
    w: 1280,
    h: 800,
    render: () => <SceneView run={sceneRun(sc.id)} onEnd={noop} rank={sc.rank} />,
  })),
  {
    id: 'scene-reply',
    group: 'Bonds',
    label: 'Scene: a reply chosen, the answer, Continue',
    w: 1280,
    h: 800,
    render: () => (
      <SceneView
        run={sceneRun(heroScene('kael'))}
        onEnd={noop}
        rank={sceneDef(heroScene('kael')).rank}
        initialReply={0}
      />
    ),
  },
  {
    id: 'hud-bonds-alt',
    group: 'Bonds',
    label: 'HUD: Vexis brings Celestial Sphere (her tooltip: the Solo and talents)',
    w: 1280,
    h: 720,
    render: () => {
      const bonds = mockBonds(10);
      return (
        <World>
          <HudView
            hud={mockBondsHud('calm', mockRunBonds(bonds), (h) =>
              h.defId === 'vexis' ? { solo: 100, soloReady: true } : {},
            )}
            callouts={[]}
            decree={null}
            subtitle="The Prelude · node 3 of 10"
            coach={false}
            bondRanks={bondRanks(bonds)}
            frameTip="vexis"
          />
        </World>
      );
    },
  },
  {
    id: 'hud-bonds-kael',
    group: 'Bonds',
    label: 'HUD: Kael’s tooltip, his own Solo and two talents (rank 7)',
    w: 1280,
    h: 720,
    render: () => {
      const bonds = mockBonds(7);
      return (
        <World>
          <HudView
            hud={mockBondsHud('calm', mockRunBonds(bonds))}
            callouts={[]}
            decree={null}
            subtitle="The Prelude · node 3 of 10"
            coach={false}
            bondRanks={bondRanks(bonds)}
            frameTip="kael"
          />
        </World>
      );
    },
  },
  {
    id: 'codex-bonds',
    group: 'Bonds',
    label: 'Codex: Bonds (rank 7, scenes seen)',
    w: 1280,
    h: 1960,
    render: () => <CodexView onBack={noop} initialTab="bonds" bonds={mockBonds(7)} />,
  },
  {
    id: 'codex-bonds-locked',
    group: 'Bonds',
    label: 'Codex: Bonds, locked (no rank-up yet)',
    w: 1280,
    h: 720,
    render: () => (
      <CodexView
        onBack={noop}
        initialTab="bonds"
        allowance={allowanceFor(3)}
        rank={3}
        bonds={mockBonds(1, { choose: false })}
      />
    ),
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
