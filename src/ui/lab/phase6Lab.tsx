/**
 * The UI lab's Phase 6 groups (docs/phase-6.md): the Atlas station at four stages, This Week's
 * Song's panel in each state, the Loom with the Atlas lit, Prep under an Echo and on a weekly,
 * the Summary's stars and weekly score, the boss bar under Tyrant and in the Postlude, the Mimic's
 * card under Mimicry, the Codex's Atlas and Dissonance pages, and the new Deeds' cards. Data from
 * `phase6Fixture.ts`; every name and number content holds comes from content.
 */
import type { ReactNode } from 'react';
import { CONTENT } from '../../content';
import { dissonancePoints } from '../../meta/dissonance';
import { shopItems } from '../../meta/loom';
import { STATIONS, introId } from '../screens/loomModel';
import { rankOf } from '../../meta/profile';
import * as Run from '../../meta/run';
import type { RunState } from '../../meta/types';
import { HudView } from '../hud/Hud';
import { postludeDecree, tyrantDecree } from '../hud/phase6Look';
import { sightingCallout } from '../hud/sighting';
import type { HudSnapshot } from '../store';
import { AtlasScreenView, WeeklyPanel } from '../screens/AtlasParts';
import { CodexView } from '../screens/CodexScreen';
import { DeedCard } from '../screens/DeedsParts';
import { deedRow } from '../screens/deedsModel';
import { LoomView } from '../screens/LoomScreen';
import { AtelierView } from '../screens/AtelierScreen';
import { WeeklyBenchView } from './weeklyBench';
import { PrepView } from '../screens/PrepScreen';
import { SummaryView } from '../screens/SummaryScreen';
import { veteranProfile } from './loomLab';
import { finaleHud, finaleSummaryRun, mockHud, summaryRun } from './mock';
import {
  atlasAt,
  atlasRecordFor,
  phase6Deeds,
  weeklyEntryFixture,
  weeklyInput,
  type AtlasStage,
  type WeeklyState,
} from './phase6Fixture';

export interface Phase6LabView {
  id: string;
  group: string;
  label: string;
  w: number;
  h: number;
  render(): ReactNode;
}

const noop = () => {};
/** Blind Score alone, at its first rank (content's id, by its effect). */
const BLIND = CONTENT.dissonance
  .filter((d) => d.effect === 'blind_score')
  .map((d) => ({ id: d.id, rank: 1 }));
const ATLAS = 'Phase 6 · Atlas and weekly';
const RUN = 'Phase 6 · Prep, Summary, Codex, Deeds';
const FIGHT = 'Phase 6 · In the fight';

const echoIndex = (id: string) => CONTENT.echoes.findIndex((e) => e.id === id);

function atlasStage(stage: AtlasStage, echo: string | null, weekly: WeeklyState | null) {
  return (
    <AtlasScreenView
      atlas={atlasAt(stage)}
      weekly={weekly ? weeklyInput(weekly) : null}
      onBack={noop}
      initialEcho={echo}
      still
    />
  );
}

function weeklyStage(state: WeeklyState, adding = false) {
  return (
    <div className="h-full overflow-auto bg-ink-950 p-6">
      <WeeklyPanel input={weeklyInput(state)} initialAdding={adding} />
    </div>
  );
}

/** A Prep run on an Echo: its id set, its forced levels marked (as the run layer will). */
function echoPrepRun(echoId: string): RunState {
  const run = Run.newRun(7);
  const echo = CONTENT.echoes.find((e) => e.id === echoId)!;
  const forced = (echo.twists.dissonance ?? []).map((l) => ({ ...l, forced: true as const }));
  return { ...run, echo: echoId, dissonance: [...forced, ...run.dissonance] };
}

function prepEcho(echoId: string) {
  return (
    <PrepView
      run={echoPrepRun(echoId)}
      onChords={noop}
      onEmbark={noop}
      onBack={noop}
      rank={18}
      atlas={atlasAt('partway')}
      dissonance={{ open: true, best: {}, onChange: noop }}
    />
  );
}

function prepWeekly() {
  const run = Run.newRun(7);
  const entry = weeklyEntryFixture();
  return (
    <PrepView
      run={{ ...run, weekly: { week: 44 }, dissonance: entry.dissonance.map((l) => ({ ...l })) }}
      onChords={noop}
      onEmbark={noop}
      onBack={noop}
      rank={18}
      weekly={{ week: 44, entry }}
      dissonance={{ open: true, best: {}, onChange: noop }}
    />
  );
}

function summaryEcho(echoId: string, points: number, before: AtlasStage) {
  const record = atlasRecordFor(echoIndex(echoId), points, atlasAt(before));
  return (
    <SummaryView
      run={{ ...summaryRun('victory'), echo: echoId }}
      onNewRun={noop}
      onLoom={noop}
      atlas={record}
    />
  );
}

/** The last Echo of the first constellation, cleared at 20 with the rest of it lit. */
function summaryConstellation() {
  const first = CONTENT.constellations[0]!.id;
  const its = CONTENT.echoes.filter((e) => e.constellation === first);
  const last = its.at(-1)!;
  const before = atlasAt('constellation')!;
  const atlas = {
    stars: { ...before.stars, [last.id]: 1 },
    best: { ...before.best, [last.id]: 0 },
  };
  const record = atlasRecordFor(echoIndex(last.id), 20, atlas);
  return (
    <SummaryView
      run={{ ...summaryRun('victory'), echo: last.id }}
      onNewRun={noop}
      onLoom={noop}
      atlas={record}
    />
  );
}

/** A boss bar under Tyrant: the boss's borrowed attack and its decree. */
function tyrantHud(blind: boolean): HudSnapshot {
  const base = mockHud('boss');
  const boss = base.boss!;
  const lancer = CONTENT.enemies.find((e) => e.id === 'glass_lancer');
  const hold = { attack: 'lancer_lance', from: lancer?.id ?? 'glass_lancer', phase: 1 };
  return {
    ...base,
    dissonance: blind
      ? { levels: BLIND, points: dissonancePoints(BLIND), blindScore: true }
      : base.dissonance,
    boss: { ...boss, tyrant: tyrantDecree(boss.defId ?? 'hollow_cantor', hold, { blind }) },
  };
}

/** The Silent Conductor in the Postlude: the fourth pip, the rise, its pressure. */
function postludeHud(stage: 'rising' | 'fresh' | 'enraged'): HudSnapshot {
  const base = finaleHud('discord-75');
  const boss = base.boss!;
  return {
    ...base,
    boss: {
      ...boss,
      phase: boss.phases + 1,
      phases: boss.phases + 1,
      phaseAt: [],
      hp: stage === 'rising' ? 0 : Math.round(boss.maxHp * (stage === 'fresh' ? 0.3 : 0.12)),
      decree: null,
      postlude: {
        rising: stage === 'rising' ? 2.2 : null,
        enraged: stage === 'enraged',
        decree: stage === 'enraged' ? null : postludeDecree(false),
      },
    },
  };
}

function hudStage(hud: HudSnapshot, callouts: ReturnType<typeof mimicCallouts> = []) {
  return (
    <div
      className="relative h-full w-full overflow-hidden"
      style={{
        background: 'radial-gradient(ellipse at 50% 45%, #2a3354 0%, #161c33 60%, #0a0d1c 100%)',
      }}
    >
      <HudView hud={hud} callouts={callouts} decree={hud.boss?.decree ?? null} subtitle="Phase 6" />
    </div>
  );
}

function mimicCallouts() {
  const far = performance.now() + 1e9;
  return [{ id: 901, ...sightingCallout('mimic'), expiresAt: far }];
}

function deedsStage(atlas: AtlasStage) {
  const held = { earned: ['faint_star'], best: { absolute_pitch: 31 }, atlas: atlasAt(atlas) };
  const open = { allowance: { all: true, callings: new Set<string>() }, astrolabe: true };
  return (
    <div className="h-full overflow-auto bg-ink-950 p-6">
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {phase6Deeds().map((d) => (
          <DeedCard key={d.id} row={deedRow(d, held, open, null)} />
        ))}
      </ul>
    </div>
  );
}

function loomAtlas() {
  const p = {
    ...veteranProfile(),
    atlas: atlasAt('partway'),
    introduced: STATIONS.map(introId),
  };
  return (
    <LoomView
      profile={p}
      unlockAll={false}
      shop={shopItems(p, rankOf(p.xp), false)}
      run={null}
      onStation={noop}
      onNewRun={noop}
      onIntroduced={noop}
      onFrontDoor={noop}
      onSettings={noop}
      focusOn="atlas"
      still
    />
  );
}

/** The Atelier with the Atlas's keepsakes: the earned shown as earned, never for sale. */
function atelierEarned(stage: AtlasStage) {
  const p = { ...veteranProfile(), atlas: atlasAt(stage) };
  return (
    <AtelierView
      items={shopItems(p, rankOf(p.xp), false)}
      look={p.look}
      starlight={p.starlight}
      onBuy={() => null}
      onWear={noop}
      onBack={noop}
    />
  );
}

export const PHASE6_VIEWS: Phase6LabView[] = [
  // ── The Atlas station ──
  {
    id: 'p6-atlas-none',
    group: ATLAS,
    label: 'Atlas: nothing lit yet',
    w: 1280,
    h: 1500,
    render: () => atlasStage('none', null, 'board'),
  },
  {
    id: 'p6-atlas-partway',
    group: ATLAS,
    label: 'Atlas: partway, Retrograde open',
    w: 1280,
    h: 1500,
    render: () => atlasStage('partway', 'retrograde', 'verified'),
  },
  {
    id: 'p6-atlas-hard-bargains',
    group: ATLAS,
    label: 'Atlas: A Cappella’s card (its twists)',
    w: 1280,
    h: 1500,
    render: () => atlasStage('partway', 'a_cappella', null),
  },
  {
    id: 'p6-atlas-constellation',
    group: ATLAS,
    label: 'Atlas: a constellation complete',
    w: 1280,
    h: 1500,
    render: () => atlasStage('constellation', null, 'empty'),
  },
  {
    id: 'p6-atlas-whole',
    group: ATLAS,
    label: 'Atlas: every star lit',
    w: 1280,
    h: 1500,
    render: () => atlasStage('whole', 'the_unrested', 'board'),
  },
  {
    id: 'p6-loom-atlas',
    group: ATLAS,
    label: 'The Loom with the Atlas lit',
    w: 1280,
    h: 900,
    render: loomAtlas,
  },
  {
    id: 'p6-atelier-earned',
    group: ATLAS,
    label: 'Atelier: the Atlas’s looks earned (shown as earned, never sold)',
    w: 1280,
    h: 1900,
    render: () => atelierEarned('whole'),
  },
  // ── This Week's Song ──
  ...(
    [
      ['board', 'board (four statuses)'],
      ['verifying', 'verifying'],
      ['verified', 'Verified'],
      ['otherVersion', 'Verified on another version'],
      ['claimed', 'only a code (Claimed)'],
      ['mismatch', 'Didn’t match'],
      ['empty', 'no results yet, last day'],
    ] as const
  ).map(([state, label]) => ({
    id: `p6-weekly-${state}`,
    group: ATLAS,
    label: `Weekly: ${label}`,
    w: 1000,
    h: 640,
    render: () => weeklyStage(state),
  })),
  {
    id: 'p6-weekly-add',
    group: ATLAS,
    label: 'Weekly: adding a code',
    w: 1000,
    h: 700,
    render: () => weeklyStage('board', true),
  },
  // ── Prep, Summary, Codex, Deeds ──
  {
    id: 'p6-prep-a-cappella',
    group: RUN,
    label: 'Prep: A Cappella (no Calling, no Astrolabe, no carry)',
    w: 1280,
    h: 1800,
    render: () => prepEcho('a_cappella'),
  },
  {
    id: 'p6-prep-unrested',
    group: RUN,
    label: 'Prep: The Unrested (two levels forced on, locked)',
    w: 1280,
    h: 1900,
    render: () => prepEcho('the_unrested'),
  },
  {
    id: 'p6-prep-strangers',
    group: RUN,
    label: 'Prep: Strangers (the party fixed)',
    w: 1280,
    h: 1800,
    render: () => prepEcho('strangers'),
  },
  {
    id: 'p6-prep-weekly',
    group: RUN,
    label: 'Prep: This Week’s Song (everyone plays this)',
    w: 1280,
    h: 1900,
    render: prepWeekly,
  },
  {
    id: 'p6-summary-echo',
    group: RUN,
    label: 'Summary: an Echo cleared at 12, two stars lit',
    w: 1280,
    h: 1800,
    render: () => summaryEcho('choir_of_blood', 12, 'none'),
  },
  {
    id: 'p6-summary-constellation',
    group: RUN,
    label: 'Summary: a constellation completed',
    w: 1280,
    h: 1800,
    render: summaryConstellation,
  },
  {
    id: 'p6-summary-weekly',
    group: RUN,
    label: 'Summary: a weekly’s score, code and Share',
    w: 1280,
    h: 1800,
    render: () => (
      <SummaryView
        run={{ ...summaryRun('victory'), weekly: { week: 44 } }}
        onNewRun={noop}
        onLoom={noop}
        weekly={{ week: 44, score: 3210, won: true, code: weeklyInput('board').shareCode }}
      />
    ),
  },
  {
    id: 'p6-summary-first-clear',
    group: RUN,
    label: 'Summary: the first Finale clear (no “Coming later” for the Atlas)',
    w: 1280,
    h: 1800,
    render: () => (
      <SummaryView
        run={finaleSummaryRun('victory')}
        onNewRun={noop}
        onLoom={noop}
        dissonanceOpen
        epilogueStill
      />
    ),
  },
  {
    id: 'p6-codex-atlas',
    group: RUN,
    label: 'Codex: the Atlas of Echoes',
    w: 1280,
    h: 2400,
    render: () => (
      <CodexView
        onBack={noop}
        initialTab="atlas"
        atlas={atlasAt('partway') ?? null}
        dissonance={{ open: true, best: {} }}
      />
    ),
  },
  {
    id: 'p6-codex-dissonance',
    group: RUN,
    label: 'Codex: Dissonance (still to come, from content)',
    w: 1280,
    h: 2000,
    render: () => (
      <CodexView
        onBack={noop}
        initialTab="dissonance"
        dissonance={{ open: true, best: { none: 12 } }}
      />
    ),
  },
  {
    id: 'p6-deeds',
    group: RUN,
    label: 'Hall of Deeds: the new Deeds (fixtures), Atlas progress',
    w: 1280,
    h: 900,
    render: () => deedsStage('partway'),
  },
  {
    id: 'p6-weekly-bench',
    group: ATLAS,
    label: 'Weekly bench (a bot plays a weekly in a worker; the e2e hook)',
    w: 900,
    h: 300,
    render: () => <WeeklyBenchView />,
  },
  // ── In the fight ──
  {
    id: 'p6-hud-tyrant',
    group: FIGHT,
    label: 'Boss bar: Tyrant’s borrowed attack',
    w: 1280,
    h: 720,
    render: () => hudStage(tyrantHud(false)),
  },
  {
    id: 'p6-hud-tyrant-blind',
    group: FIGHT,
    label: 'Boss bar: Tyrant under Blind Score',
    w: 1280,
    h: 720,
    render: () => hudStage(tyrantHud(true)),
  },
  {
    id: 'p6-hud-postlude-rising',
    group: FIGHT,
    label: 'Boss bar: the Postlude, rising',
    w: 1280,
    h: 720,
    render: () => hudStage(postludeHud('rising')),
  },
  {
    id: 'p6-hud-postlude',
    group: FIGHT,
    label: 'Boss bar: the Postlude (fourth pip, decree)',
    w: 1280,
    h: 720,
    render: () => hudStage(postludeHud('fresh')),
  },
  {
    id: 'p6-hud-postlude-enraged',
    group: FIGHT,
    label: 'Boss bar: the Postlude after its 90 s',
    w: 1280,
    h: 720,
    render: () => hudStage(postludeHud('enraged')),
  },
  {
    id: 'p6-hud-mimicry',
    group: FIGHT,
    label: 'Mimicry: the Mimic’s first-sighting card',
    w: 1280,
    h: 720,
    render: () => hudStage(mockHud('calm'), mimicCallouts()),
  },
];
