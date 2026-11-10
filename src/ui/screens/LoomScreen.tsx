import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useProfile } from '../../app/profileStore';
import { useRun } from '../../app/runStore';
import { useSettings } from '../../app/settings';
import { storage } from '../../app/storage';
import { shopItems, type ShopItem } from '../../meta/loom';
import { rankOf } from '../../meta/profile';
import { loadRun } from '../../meta/save';
import { Backdrop } from '../kit/Backdrop';
import { Button } from '../kit/Button';
import { Icon } from '../kit/Icon';
import { Tip } from '../kit/Tip';
import { KeyCap } from '../kit/KeyCap';
import { LOOM_SOUNDS, STATION_LOOK, ribbonColors, robeColors } from '../kit/loomLook';
import { arrowFocus, useGamepadMenu } from '../kit/menuNav';
import { Modal } from '../kit/Modal';
import { useReducedMotion } from '../kit/motion';
import { playUi, useMood } from '../kit/sound';
import { StarlightChip } from '../kit/Starlight';
import { WeaverFigure } from '../kit/WeaverFigure';
import { useUi } from '../store';
import {
  CodexView,
  useCodexBonds,
  useCodexDissonance,
  useCodexRoster,
  useCodexTechniques,
} from './CodexScreen';
import {
  LOOM_CSS,
  LoomThreads,
  SanctumBackdrop,
  StationArt,
  StationBadge,
  StationIntroDialog,
  placeStyle,
} from './LoomParts';
import {
  darkSaid,
  freshLine,
  starlightAbout,
  starlightText,
  stationIntro,
  stationViews,
  weaverPlate,
  welcomeDue,
  welcomeIntro,
  WELCOME,
  type GateRun,
  type LoomProfile,
  type StationId,
  type StationIntro,
  type StationView,
} from './loomModel';
import { XpBar } from './Rank';
import { AtlasScreenView } from './AtlasParts';
import { useAllowance } from './PrepScreen';

export interface LoomViewProps {
  profile: LoomProfile;
  /** Settings → Skip the unlocks: every station lit. */
  unlockAll: boolean;
  /** The Atelier's items (`shop()`): its station counts what the balance buys. */
  shop: readonly ShopItem[];
  /** The saved run the Gate would continue (null: none). */
  run: GateRun | null;
  /** Opens a lit station (the Gate begins a run, or continues the saved one). */
  onStation(id: StationId): void;
  /** The Gate's other door: a new run in place of the saved one (after its confirm). */
  onNewRun(): void;
  /** Intros seen (the profile store's `markIntroduced`). */
  onIntroduced(ids: string[]): void;
  /** Back to the front door (the Title). */
  onFrontDoor(): void;
  onSettings(): void;
  /** The station to focus on arrival (the one just left), unless one has newly lit. */
  focusOn?: StationId | null;
  /** UI lab: an intro open (the welcome's, or a station's), at a panel. */
  initialIntro?: StationId | 'welcome' | null;
  initialPanel?: number;
  /** UI lab, screenshots: no motion (reduced motion does this too). */
  still?: boolean;
}

/**
 * The Loom (Phase 4g, docs/phase-4g.md): the sanctum between runs, drawn in code. Each system is
 * a place in the hall, dark until it opens (with a line saying when) and lit in its own colour
 * after: the Gate (a new run, or the one in progress), the Training Grounds, the Codex, the
 * Astrolabe, the Atelier, the Reliquary, Bonds, the Hall of Deeds and Dissonance. A station that
 * has lit up since pulls the eye (a pulsing rim, a brighter thread, "New", the hub's first focus)
 * and its first visit plays a short intro; the stations open from the first run share a welcome,
 * which plays on the first visit to the hub. The Weaver stands on the dais in her robe, with her
 * title under her name; the Starlight balance is in the corner.
 *
 * From `lg` the stations stand in the hall (`PLACES`), threads running to them from her hands;
 * narrower, they're tiles under her. The arrows move between stations by where they stand, Enter
 * opens one, Esc goes back to the front door; a gamepad does the same.
 */
export function LoomView({
  profile,
  unlockAll,
  shop,
  run,
  onStation,
  onNewRun,
  onIntroduced,
  onFrontDoor,
  onSettings,
  focusOn = null,
  initialIntro = null,
  initialPanel = 0,
  still: stillProp = false,
}: LoomViewProps) {
  useMood('loom');
  useGamepadMenu();
  const reduced = useReducedMotion();
  // Her ribbons wear the Thread look as the fight draws it, fitted to the colour vision.
  const vision = useSettings((st) => st.settings.colorVision);
  const still = stillProp || reduced;
  const stations = stationViews(profile, unlockAll, { run, shop });
  const [intro, setIntro] = useState<StationIntro | null>(() => {
    if (initialIntro === 'welcome') return welcomeIntro(run);
    if (initialIntro) return stationIntro(initialIntro);
    return welcomeDue(profile.introduced) ? welcomeIntro(run) : null;
  });
  const [confirmNew, setConfirmNew] = useState(false);
  const [say, setSay] = useState('');
  const scene = useRef<HTMLDivElement>(null);
  const fresh = freshLine(stations);
  const plate = weaverPlate(profile);
  // What Starlight is for (it's on the hub from the first visit, the Atelier only from its Rank).
  const about = starlightAbout(plate.rank, unlockAll);
  // First focus: a station newly lit, else the one just left, else the Gate.
  const first = stations.find((s) => s.fresh && !WELCOME.includes(s.id))?.id ?? focusOn ?? 'gate';

  // Arriving with stations newly lit: the eye is drawn, and the ear (once a visit).
  const litOnArrival = useRef(!!fresh && !intro);
  useEffect(() => {
    if (litOnArrival.current) playUi(LOOM_SOUNDS.lit);
  }, []);

  // Escape goes to the front door (a dialog closes itself first).
  useEffect(() => {
    if (intro || confirmNew) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      e.preventDefault();
      onFrontDoor();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [intro, confirmNew, onFrontDoor]);

  const choose = (s: StationView) => {
    if (!s.open) {
      playUi(LOOM_SOUNDS.dark);
      setSay(darkSaid(s.id, plate.rank));
      return;
    }
    if (s.fresh) {
      playUi(LOOM_SOUNDS.intro);
      setIntro(stationIntro(s.id));
      return;
    }
    onStation(s.id);
  };
  const closeIntro = (andTry: boolean) => {
    if (!intro) return;
    onIntroduced(intro.seen);
    setIntro(null);
    if (andTry) onStation(intro.station);
  };
  const onArrows = (e: KeyboardEvent<HTMLDivElement>) => {
    if (scene.current && arrowFocus(scene.current, e.key)) e.preventDefault();
  };

  return (
    <main className="relative h-full w-full overflow-hidden" data-testid="loom-screen">
      <Backdrop tone="gold" />
      <style>{LOOM_CSS}</style>
      <div className="scroll-thin relative z-10 flex h-full flex-col overflow-y-auto px-4 pb-4 pt-3 sm:px-5">
        <header className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="min-w-0">
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-muted">
              Between runs{unlockAll && ' · all unlocked'}
            </p>
            <h1 className="flex items-center gap-2 font-display text-3xl font-bold tracking-wide text-gold-300">
              <Icon name="loom" size={28} /> The Loom
            </h1>
          </div>
          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
            <div className="flex flex-col items-end">
              <Tip tip={about.tip} align="end" width="w-72">
                <span
                  tabIndex={0}
                  role="group"
                  aria-label={`${starlightText(profile.starlight)}. ${about.tip}`}
                  className="rounded-lg"
                  data-testid="loom-starlight-about"
                >
                  <StarlightChip amount={profile.starlight} testId="loom-starlight" />
                </span>
              </Tip>
              {about.line && (
                <span className="mt-0.5 text-xs text-muted" data-testid="loom-starlight-line">
                  {about.line}
                </span>
              )}
            </div>
            <Button variant="ghost" size="sm" onClick={onSettings} aria-label="Settings">
              <Icon name="gear" size={16} /> <span className="hidden sm:inline">Settings</span>
            </Button>
            <Button variant="ghost" onClick={onFrontDoor} sound="back" data-testid="loom-back">
              <Icon name="back" size={16} /> Front door <KeyCap label="Esc" />
            </Button>
          </div>
        </header>
        {fresh && (
          <p
            className="anim-fade mt-2 flex items-start gap-2 self-start rounded-lg border border-gold-500/50 bg-gold-400/10 px-3 py-1.5 text-sm text-gold-100"
            data-testid="loom-fresh"
          >
            <Icon name="sparkle" size={15} className="mt-0.5 shrink-0 text-gold-300" />
            {fresh}
          </p>
        )}
        <p className="sr-only" aria-live="polite" data-testid="loom-said">
          {say}
        </p>
        <div
          ref={scene}
          className="relative mt-3 grid flex-1 grid-cols-2 content-start gap-2.5 sm:grid-cols-3 lg:block lg:min-h-[35rem]"
          onKeyDown={onArrows}
          data-testid="loom-scene"
        >
          <SanctumBackdrop />
          <LoomThreads stations={stations} still={still} />
          <div
            className="col-span-2 flex flex-col items-center pb-1 sm:col-span-3 lg:absolute lg:left-[var(--x)] lg:top-[var(--y)] lg:-translate-x-1/2 lg:-translate-y-1/2"
            style={placeStyle('weaver')}
            data-testid="loom-weaver"
            data-robe={profile.look.robe ?? 'own'}
            data-thread={profile.look.thread ?? 'own'}
            data-title={profile.look.title ?? ''}
          >
            <WeaverFigure
              robe={robeColors(profile.look.robe)}
              ribbons={ribbonColors(profile.look.thread, vision)}
              still={still}
              className="h-36 w-auto lg:h-44"
              label={`The Weaver${plate.title ? `, ${plate.title}` : ''}`}
            />
            {/* Her name plate: a plaque, not a place (the stations have none). */}
            <div
              className="-mt-1.5 flex w-56 flex-col items-center rounded-xl border border-gold-500/45 bg-ink-900/90 px-3 pb-2 pt-1 shadow-lg shadow-black/50"
              data-testid="loom-nameplate"
            >
              <p className="font-mono text-xs uppercase tracking-[0.3em] text-muted">You</p>
              <p className="font-display text-base font-bold leading-tight tracking-wide text-gold-100">
                {plate.name}
              </p>
              {plate.title && (
                <p
                  className="font-display text-sm italic leading-tight text-gold-300"
                  data-testid="loom-title"
                >
                  {plate.title}
                </p>
              )}
              <div className="mt-1.5 flex w-full items-center gap-2">
                <span className="shrink-0 font-mono text-xs font-semibold text-gold-300">
                  Rank {plate.rank}
                </span>
                <XpBar
                  before={plate.fraction}
                  after={plate.fraction}
                  label={`Weaver XP: ${plate.progress}`}
                  className="flex-1"
                />
              </div>
              <p className="mt-0.5 font-mono text-xs text-muted">{plate.progress}</p>
            </div>
          </div>
          {stations.map((s) =>
            s.id === 'gate' ? (
              <GateStation
                key={s.id}
                view={s}
                running={!!run}
                autoFocus={first === 'gate'}
                still={still}
                onOpen={() => choose(s)}
                onNewRun={() => setConfirmNew(true)}
              />
            ) : (
              <Station
                key={s.id}
                view={s}
                autoFocus={first === s.id}
                still={still}
                onOpen={() => choose(s)}
                profile={profile}
              />
            ),
          )}
        </div>
        <p className="mt-2 hidden text-center text-xs text-muted lg:block">
          Arrow keys to move between stations · Enter to open · Esc for the front door
        </p>
      </div>
      {intro && (
        <StationIntroDialog
          intro={intro}
          still={still}
          initialPanel={initialPanel}
          onClose={() => closeIntro(false)}
          onTry={() => closeIntro(true)}
        />
      )}
      {confirmNew && (
        <Modal
          title="Begin a new run?"
          onClose={() => setConfirmNew(false)}
          closeOnEscape
          width="max-w-md"
        >
          <p className="mt-2 text-sm text-text">
            Starting a new run replaces your saved one. What it earned is kept.
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <Button onClick={() => setConfirmNew(false)} sound="back" data-autofocus>
              Keep it
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setConfirmNew(false);
                onNewRun();
              }}
              sound="confirm"
              data-testid="gate-new-confirm"
            >
              New run
            </Button>
          </div>
        </Modal>
      )}
    </main>
  );
}

/** How a station reads out: its name, whether it's new or dark, its line and what waits there. */
function stationLabel(s: StationView): string {
  const state = !s.open ? ' (dark)' : s.fresh ? ' (new)' : '';
  return `${s.name}${state}: ${s.line}${s.badge ? `. ${s.badge}` : ''}`;
}

/**
 * A dark station's name: dimmed well below a lit one's, so a first visit reads as the places
 * open and the ones to come (its line, what it is and when it opens, stays readable).
 */
const DARK_NAME = '#66729a';

/** Station labels stay legible over the hall's lines and threads. */
const LABEL_SHADOW = '0 1px 3px #050814, 0 0 10px #050814';

const PLACED =
  'lg:absolute lg:left-[var(--x)] lg:top-[var(--y)] lg:-translate-x-1/2 lg:-translate-y-1/2';

/** A station in the hall: its drawing, its name, its line, what waits there. */
function Station({
  view: s,
  autoFocus,
  still,
  onOpen,
  profile,
}: {
  view: StationView;
  autoFocus: boolean;
  still: boolean;
  onOpen(): void;
  profile: LoomProfile;
}) {
  const look = STATION_LOOK[s.id];
  return (
    <button
      type="button"
      data-nav
      data-station={s.id}
      data-open={s.open}
      data-fresh={s.fresh}
      aria-disabled={!s.open || undefined}
      aria-label={stationLabel(s)}
      autoFocus={autoFocus}
      onClick={onOpen}
      onPointerEnter={() => s.open && playUi('hover')}
      onFocus={() => s.open && playUi('hover')}
      className={`group flex flex-col items-center gap-0.5 rounded-xl border px-2 pb-2 pt-1.5 text-center transition-colors lg:w-52 lg:border-transparent lg:bg-transparent ${s.open ? 'border-ink-600/70 bg-ink-900/70 hover:bg-ink-800/80 lg:hover:bg-ink-800/50' : 'border-dashed border-ink-600/70 bg-ink-950/60'} ${PLACED}`}
      style={{ ...placeStyle(s.id), textShadow: LABEL_SHADOW }}
    >
      <span className="relative block">
        <StationArt id={s.id} lit={s.open} fresh={s.fresh} still={still} width={112} />
        {s.fresh && (
          <span
            className="absolute -top-1 left-1/2 -translate-x-1/2 rounded-full px-2 py-px text-xs font-bold uppercase tracking-wider text-ink-950"
            style={{ background: look.light }}
            aria-hidden
          >
            New
          </span>
        )}
      </span>
      <span
        className="font-display text-base font-bold leading-tight tracking-wide"
        style={{ color: s.open ? look.light : DARK_NAME }}
        aria-hidden
      >
        {s.name}
      </span>
      <span className="text-xs leading-snug text-muted" aria-hidden data-testid="station-line">
        {s.line}
      </span>
      {s.open && s.badge && (
        <span className="mt-0.5">
          <StationBadge view={s} reliquary={profile.reliquary} bonds={profile.bonds} />
        </span>
      )}
    </button>
  );
}

/** The Gate: begin a run, or continue the saved one (and, beside it, begin another instead). */
function GateStation({
  view: s,
  running,
  autoFocus,
  still,
  onOpen,
  onNewRun,
}: {
  view: StationView;
  running: boolean;
  autoFocus: boolean;
  still: boolean;
  onOpen(): void;
  onNewRun(): void;
}) {
  const look = STATION_LOOK.gate;
  return (
    <div
      className={`col-span-2 flex flex-col items-center gap-1 sm:col-span-3 lg:w-60 ${PLACED}`}
      style={{ ...placeStyle('gate'), textShadow: LABEL_SHADOW }}
    >
      <button
        type="button"
        data-nav
        data-station="gate"
        data-open="true"
        data-fresh={s.fresh}
        data-running={running}
        aria-label={stationLabel(s)}
        autoFocus={autoFocus}
        onClick={onOpen}
        onPointerEnter={() => playUi('hover')}
        className="flex w-full flex-col items-center gap-0.5 rounded-xl border border-gold-500/40 bg-ink-900/70 px-3 pb-2 pt-1.5 text-center transition-colors hover:bg-ink-800/80 lg:border-transparent lg:bg-transparent lg:hover:bg-ink-800/40"
      >
        <StationArt id="gate" lit still={still} width={150} />
        <span
          className="font-display text-xl font-bold leading-tight tracking-wide"
          style={{ color: look.light }}
          aria-hidden
        >
          {s.name}
        </span>
        <span
          className="flex items-center gap-1.5 rounded-lg bg-gold-400 px-3 py-1 text-sm font-semibold text-ink-950 shadow-md shadow-gold-500/20"
          aria-hidden
          data-testid="gate-line"
        >
          <Icon name={running ? 'play' : 'flag'} size={14} /> {s.line}
        </span>
      </button>
      {running && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onNewRun}
          data-nav
          data-testid="gate-new-run"
          className="lg:-mt-1"
        >
          <Icon name="flag" size={14} /> New run (ends this one)
        </Button>
      )}
    </div>
  );
}

/** The station the hub was left for: it takes focus when the hub comes back. */
let lastStation: StationId | null = null;

/** The saved run, if there's one to continue (the run store's `hasSave`, read for its step). */
function savedRun(): GateRun | null {
  const saved = loadRun(storage());
  return saved && saved.phase !== 'summary' ? saved : null;
}

/**
 * The Loom from the stores. Each station opens its screen (Back and Esc there come back here, the
 * store's `previous`); the Hall of Deeds and Dissonance open the Codex's pages in place, as the
 * Astrolabe opens its Deeds.
 */
export function LoomScreen() {
  const profile = useProfile((s) => s.profile);
  const unlockAll = useSettings((s) => s.settings.unlockAll);
  const setScreen = useUi((s) => s.setScreen);
  const allowance = useAllowance();
  const dissonance = useCodexDissonance();
  const bonds = useCodexBonds();
  const techniques = useCodexTechniques();
  // Phase 5b: the profile's heroes, as the Codex from Prep and the Bonds shows them.
  const codexRoster = useCodexRoster();
  const [run] = useState(savedRun);
  const [codex, setCodex] = useState<'deeds' | 'dissonance' | null>(null);
  // Phase 6: the Atlas of Echoes opens in place, as the Codex's pages do.
  const [atlasOpen, setAtlasOpen] = useState(false);
  const [focusOn, setFocusOn] = useState<StationId | null>(lastStation);
  // The Atelier's items as this profile sees them (its station's badge), as the store's `shop()`.
  const shop = shopItems(profile, rankOf(profile.xp), unlockAll);
  if (atlasOpen) {
    return (
      <AtlasScreenView
        atlas={profile.atlas}
        weekly={null}
        canBegin={!run}
        onBack={() => {
          setFocusOn('atlas');
          setAtlasOpen(false);
        }}
      />
    );
  }
  if (codex) {
    return (
      <CodexView
        onBack={() => {
          setFocusOn(codex === 'deeds' ? 'deeds' : 'dissonance');
          setCodex(null);
        }}
        initialTab={codex}
        allowance={allowance}
        seen={profile.seen}
        rank={rankOf(profile.xp)}
        deeds={{ earned: profile.deeds, best: profile.deedBest, atlas: profile.atlas }}
        atlas={profile.atlas ?? null}
        dissonance={dissonance}
        bonds={bonds}
        techniques={techniques}
        roster={codexRoster}
      />
    );
  }
  const go = (id: StationId) => {
    lastStation = id;
    switch (id) {
      case 'gate':
        if (run) {
          if (useRun.getState().resume()) setScreen('run');
        } else {
          useRun.getState().newRun();
          setScreen('run');
        }
        return;
      case 'deeds':
      case 'dissonance':
        setCodex(id);
        return;
      case 'atlas':
        setAtlasOpen(true);
        return;
      default:
        setScreen(id);
    }
  };
  return (
    <LoomView
      profile={profile}
      unlockAll={unlockAll}
      shop={shop}
      run={run}
      focusOn={focusOn}
      onStation={go}
      onNewRun={() => {
        lastStation = 'gate';
        useRun.getState().newRun();
        setScreen('run');
      }}
      onIntroduced={(ids) => useProfile.getState().markIntroduced(ids)}
      onFrontDoor={() => {
        lastStation = null;
        setScreen('title');
      }}
      onSettings={() => setScreen('settings')}
    />
  );
}
