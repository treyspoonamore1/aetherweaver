import { useState, type ReactNode } from 'react';
import { useProfile } from '../../app/profileStore';
import { buy, equip, shopItems, type Look } from '../../meta/loom';
import { RANK_XP, newProfile, rankOf, type Profile } from '../../meta/profile';
import * as Run from '../../meta/run';
import { AtelierView } from '../screens/AtelierScreen';
import { LoomView } from '../screens/LoomScreen';
import {
  STATIONS,
  WELCOME,
  buyLine,
  introId,
  type GateRun,
  type StationId,
} from '../screens/loomModel';
import { RankUpCard } from '../screens/Rank';
import { TitleScreen } from '../screens/TitleScreen';
import {
  EARLY_DEEDS,
  RANK12_TREE,
  SOME_DEEDS,
  mockBonds,
  mockRankUps,
  partwayReliquary,
} from './mock';

/**
 * The UI lab's Loom (Phase 4g): the hub and the Atelier against three mock profiles (fresh,
 * mid-game, veteran), the intros, the Title's front door and the demo's first choice. Each view
 * holds its profile in local state, so intros, buying and wearing work as the stores do them
 * (`markIntroduced`'s list, meta/loom.ts's `buy` and `equip`), without saving anything.
 */

/** A lab view (UiLab's `ViewDef`). */
export interface LoomLabView {
  id: string;
  group: string;
  label: string;
  w: number;
  h: number;
  render(): ReactNode;
}

const noop = () => {};

/** The welcome's intros, seen. */
const WELCOMED = WELCOME.map(introId);
/** Every station's intro, seen. */
const STATIONS_SEEN = STATIONS.map(introId);

/** A profile at a Rank (a little into it). */
function atRank(rank: number, extra: Partial<Profile> = {}): Profile {
  return { ...newProfile(7), xp: RANK_XP[rank - 1]! + 60, ...extra };
}

/** Fresh: a new Weaver, nothing seen. */
export function freshProfile(): Profile {
  return newProfile(7);
}

/**
 * Mid-game (Rank 6, an hour in): the Astrolabe (two points left), Bonds (Kael and Lyra rank 2),
 * three Deeds, 185 Starlight saved, and the Atelier just lit (its intro waiting). No Reliquary
 * yet, no Dissonance.
 */
export function midProfile(): Profile {
  return atRank(6, {
    runs: 7,
    wins: 3,
    astrolabe: RANK12_TREE.slice(0, 3),
    deeds: [...EARLY_DEEDS],
    bonds: mockBonds(2, { choose: false }),
    starlight: 185,
    introduced: [...WELCOMED, introId('astrolabe'), introId('bonds'), introId('deeds')],
  });
}

/**
 * The veteran (Rank 16, some hours in): every station lit, Dissonance new (just opened by a win at
 * Rank 15 or above, as its rule has it), the Luminary mastered (Lightbearer worn, Chorale for
 * sale), Dusk and Starlit worn, the Reliquary partway, and 640 Starlight.
 */
export function veteranProfile(): Profile {
  return atRank(16, {
    runs: 41,
    wins: 22,
    astrolabe: [...RANK12_TREE],
    deeds: [...SOME_DEEDS],
    bonds: mockBonds(7),
    reliquary: partwayReliquary(),
    dissonance: { open: true, levels: [], best: {} },
    starlight: 640,
    variants: ['purge', 'skate'],
    cosmetics: ['robe_dusk', 'thread_starlit', 'title_steady_hand'],
    look: { robe: 'robe_dusk', thread: 'thread_starlit', title: 'title_lightbearer' },
    mastery: { luminary: 1500, martyr: 480 },
    introduced: [
      ...WELCOMED,
      ...(['astrolabe', 'atelier', 'reliquary', 'bonds', 'deeds'] as StationId[]).map(introId),
    ],
  });
}

/** A run partway along the road (step 4), for the Gate. */
function runAlong(): GateRun {
  const run = Run.embark(Run.newRun(7));
  return { phase: 'map', map: run.map, path: run.map.rows.slice(0, 3).map((row) => row[0]!.id) };
}

/**
 * The hub with a profile held here: intros mark it, the Atelier station opens the Atelier in
 * place (the lab's own way round), the other stations do nothing.
 */
function LoomLab({
  initial,
  unlockAll = false,
  run = null,
  intro = null,
  panel = 0,
}: {
  initial(): Profile;
  unlockAll?: boolean;
  run?: GateRun | null;
  intro?: StationId | 'welcome' | null;
  panel?: number;
}) {
  const [profile, setProfile] = useState(initial);
  const [atelier, setAtelier] = useState(false);
  if (atelier)
    return (
      <AtelierLab initial={() => profile} unlockAll={unlockAll} onBack={() => setAtelier(false)} />
    );
  return (
    <LoomView
      profile={profile}
      unlockAll={unlockAll}
      shop={shopItems(profile, rankOf(profile.xp), unlockAll)}
      run={run}
      onStation={(id) => id === 'atelier' && setAtelier(true)}
      onNewRun={noop}
      onIntroduced={(ids) =>
        setProfile((p) => ({
          ...p,
          introduced: [...p.introduced, ...ids.filter((id) => !p.introduced.includes(id))],
        }))
      }
      onFrontDoor={noop}
      onSettings={noop}
      initialIntro={intro}
      initialPanel={panel}
      still
    />
  );
}

/** The Atelier with a profile held here: buying and wearing as meta/loom.ts does them. */
function AtelierLab({
  initial,
  unlockAll = false,
  trying = null,
  buyFirst = null,
  onBack = noop,
}: {
  initial(): Profile;
  unlockAll?: boolean;
  /** A keepsake tried on when the view opens. */
  trying?: { kind: 'robe' | 'thread' | 'title'; id: string | null } | null;
  /** An item bought (or refused) as the view opens: its line shows. */
  buyFirst?: string | null;
  onBack?: () => void;
}) {
  // The view opens with `buyFirst` bought (or refused), its line said, as a click would leave it.
  const [boot] = useState(() => {
    const p = initial();
    const item = buyFirst
      ? shopItems(p, rankOf(p.xp), unlockAll).find((i) => i.id === buyFirst)
      : null;
    if (!buyFirst || !item) return { profile: p, said: null };
    const done = buy(p, buyFirst, rankOf(p.xp), unlockAll);
    const refused = 'refused' in done ? done.refused : null;
    const short = item.price !== null ? Math.max(0, item.price - p.starlight) : 0;
    return {
      profile: 'refused' in done ? p : { ...p, ...done.state },
      said: { id: buyFirst, text: buyLine(item, refused, short), refused: refused !== null },
    };
  });
  const [profile, setProfile] = useState(boot.profile);
  const rank = rankOf(profile.xp);
  return (
    <AtelierView
      items={shopItems(profile, rank, unlockAll)}
      unskipped={unlockAll ? shopItems(profile, rank, false) : null}
      look={profile.look}
      starlight={profile.starlight}
      onBuy={(id) => {
        const done = buy(profile, id, rank, unlockAll);
        if ('refused' in done) return done.refused;
        setProfile((p) => ({ ...p, ...done.state }));
        return null;
      }}
      onWear={(slot: keyof Look, id) => setProfile((p) => ({ ...p, look: equip(p, slot, id) }))}
      onBack={onBack}
      initialTrying={trying}
      initialSaid={boot.said}
      still
    />
  );
}

/** The Title with a profile (the lab sets the profile store once, without saving it). */
function FrontDoorAt({ initial, demo = false }: { initial(): Profile; demo?: boolean }) {
  useState(() => {
    useProfile.setState({ profile: initial() });
    return true;
  });
  return <TitleScreen demo={demo} onChooseDemo={noop} />;
}

export const LOOM_VIEWS: LoomLabView[] = [
  {
    id: 'loom-fresh-welcome',
    group: 'Loom',
    label: 'Loom: a fresh profile, the welcome intro',
    w: 1280,
    h: 720,
    render: () => <LoomLab initial={freshProfile} />,
  },
  {
    id: 'loom-fresh',
    group: 'Loom',
    label: 'Loom: a fresh profile, dark stations',
    w: 1280,
    h: 720,
    render: () => <LoomLab initial={() => ({ ...freshProfile(), introduced: WELCOMED })} />,
  },
  {
    id: 'loom-mid',
    group: 'Loom',
    label: 'Loom: mid-game (Rank 6), the Atelier just lit, a run to continue',
    w: 1280,
    h: 720,
    render: () => <LoomLab initial={midProfile} run={runAlong()} />,
  },
  {
    id: 'loom-intro-atelier',
    group: 'Loom',
    label: 'Loom: the Atelier’s intro (its last panel)',
    w: 1280,
    h: 720,
    render: () => <LoomLab initial={midProfile} intro="atelier" panel={2} />,
  },
  {
    id: 'loom-veteran',
    group: 'Loom',
    label: 'Loom: a veteran (Rank 16), every station lit, Dissonance new',
    w: 1280,
    h: 720,
    render: () => <LoomLab initial={veteranProfile} run={runAlong()} />,
  },
  {
    id: 'loom-intro-dissonance',
    group: 'Loom',
    label: 'Loom: Dissonance’s intro',
    w: 1280,
    h: 720,
    render: () => <LoomLab initial={veteranProfile} intro="dissonance" />,
  },
  {
    id: 'loom-intro-reliquary',
    group: 'Loom',
    label: 'Loom: the Reliquary’s intro (its carry)',
    w: 1280,
    h: 720,
    render: () => <LoomLab initial={veteranProfile} intro="reliquary" panel={2} />,
  },
  {
    id: 'loom-intro-bonds',
    group: 'Loom',
    label: 'Loom: the Bonds intro',
    w: 1280,
    h: 720,
    render: () => <LoomLab initial={midProfile} intro="bonds" />,
  },
  {
    id: 'loom-welcome-grounds',
    group: 'Loom',
    label: 'Loom: the welcome’s last panel (the Training Grounds and the Codex)',
    w: 1280,
    h: 720,
    render: () => <LoomLab initial={freshProfile} intro="welcome" panel={2} />,
  },
  {
    id: 'loom-skip',
    group: 'Loom',
    label: 'Loom: Skip the unlocks on a fresh profile (every station new)',
    w: 1280,
    h: 720,
    render: () => (
      <LoomLab initial={() => ({ ...freshProfile(), introduced: WELCOMED })} unlockAll />
    ),
  },
  {
    id: 'atelier-new',
    group: 'Loom',
    label: 'Atelier: just opened (Rank 5, 95 Starlight, nothing owned)',
    w: 1280,
    h: 1500,
    render: () => <AtelierLab initial={() => atRank(5, { starlight: 95 })} />,
  },
  {
    id: 'atelier-mid',
    group: 'Loom',
    label: 'Atelier: mid-game, Dusk worn, trying on Starlit; a refusal',
    w: 1280,
    h: 1500,
    render: () => (
      <AtelierLab
        initial={() => ({
          ...midProfile(),
          starlight: 64,
          cosmetics: ['robe_dusk', 'title_steady_hand'],
          look: { robe: 'robe_dusk', thread: null, title: 'title_steady_hand' },
        })}
        trying={{ kind: 'thread', id: 'thread_starlit' }}
        buyFirst="thread_starlit"
      />
    ),
  },
  {
    id: 'atelier-veteran',
    group: 'Loom',
    label: 'Atelier: a veteran, Chorale for sale (the Luminary mastered), Lightbearer worn',
    w: 1280,
    h: 1500,
    render: () => <AtelierLab initial={veteranProfile} />,
  },
  {
    id: 'atelier-bought',
    group: 'Loom',
    label: 'Atelier: Ember bought, trying it on',
    w: 1280,
    h: 1500,
    render: () => (
      <AtelierLab
        initial={midProfile}
        trying={{ kind: 'robe', id: 'robe_ember' }}
        buyFirst="robe_ember"
      />
    ),
  },
  {
    id: 'atelier-skip',
    group: 'Loom',
    label: 'Atelier: Skip the unlocks (every variant open, keepsakes still bought)',
    w: 1280,
    h: 1500,
    render: () => <AtelierLab initial={() => atRank(1, { starlight: 30 })} unlockAll />,
  },
  {
    id: 'title-front-door',
    group: 'Loom',
    label: 'Title: the front door',
    w: 1280,
    h: 720,
    render: () => <FrontDoorAt initial={midProfile} />,
  },
  {
    id: 'title-demo-choice',
    group: 'Loom',
    label: 'Title: the playtest demo’s first choice',
    w: 1280,
    h: 720,
    render: () => <FrontDoorAt initial={freshProfile} demo />,
  },
  {
    id: 'rank-up-atelier',
    group: 'Loom',
    label: 'Rank 5’s rank-up card: the Atelier',
    w: 1280,
    h: 800,
    render: () => <RankUpCard rankUps={mockRankUps([5])} onDismiss={noop} />,
  },
];

/**
 * The Loom with the profile the lab has put in the store (the Title's old badges, now on the
 * stations: the Astrolabe's points, the Reliquary's materials, each hero's Bond rank). Every intro
 * counts as seen, so the stations show plainly.
 */
export function LoomFromStore() {
  const profile = useProfile((s) => s.profile);
  const seen = { ...profile, introduced: STATIONS_SEEN };
  return (
    <LoomView
      profile={seen}
      unlockAll={false}
      shop={shopItems(seen, rankOf(seen.xp), false)}
      run={null}
      onStation={noop}
      onNewRun={noop}
      onIntroduced={noop}
      onFrontDoor={noop}
      onSettings={noop}
      still
    />
  );
}
