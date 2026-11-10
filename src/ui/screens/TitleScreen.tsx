import { useRef, useState, type KeyboardEvent } from 'react';
import { DEMO, VETERAN_RANK, type DemoStart } from '../../app/demo';
import { askDemoChoice, chooseDemo } from '../../app/demoChoice';
import { useProfile } from '../../app/profileStore';
import { useRun } from '../../app/runStore';
import { useSettings } from '../../app/settings';
import { Backdrop } from '../kit/Backdrop';
import { Button } from '../kit/Button';
import { Icon, type IconName } from '../kit/Icon';
import { arrowFocus } from '../kit/menuNav';
import { playUi, unlockAudio, useMood } from '../kit/sound';
import { useUi } from '../store';
import { RankPanelView } from './Rank';
import { allowanceFor, rankOf } from '../../meta/profile';
import { titleEyebrow } from './routeText';

/** Golden threads drifting across the cosmos: the title's "living" layer. */
function Threads() {
  const paths = [
    'M -50 520 C 250 380, 420 640, 720 460 S 1180 300, 1500 420',
    'M -50 300 C 200 180, 480 380, 760 240 S 1160 120, 1500 220',
    'M -50 700 C 300 640, 520 520, 800 600 S 1200 520, 1500 640',
  ];
  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 1440 800"
      preserveAspectRatio="xMidYMid slice"
    >
      {paths.map((d, i) => (
        <g key={d}>
          <path
            d={d}
            fill="none"
            stroke="var(--color-gold-400)"
            strokeOpacity={0.14}
            strokeWidth={6}
          />
          <path
            d={d}
            fill="none"
            stroke="var(--color-gold-200)"
            strokeOpacity={0.7}
            strokeWidth={1.6}
            strokeLinecap="round"
            strokeDasharray="18 120"
            style={{
              animation: `thread-flow ${14 + i * 5}s linear infinite`,
              animationDelay: `${-i * 4}s`,
            }}
          />
        </g>
      ))}
      <style>{`@keyframes thread-flow { to { stroke-dashoffset: -1380; } }`}</style>
    </svg>
  );
}

/** The demo's quiet line: it's a playtest, and where its progress lives. */
export const PLAYTEST_LINE = 'A playtest build: your progress stays in this browser.';

const STARTS: readonly { kind: DemoStart; icon: IconName; title: string; text: string }[] = [
  {
    kind: 'fresh',
    icon: 'sparkle',
    title: 'Start fresh',
    text: 'A new Weaver: the real first hours. Every station of the Loom stays dark until it opens, and shows you around when it does.',
  },
  {
    kind: 'veteran',
    icon: 'crown',
    title: 'Veteran',
    text: `A Weaver some hours in: Rank ${VETERAN_RANK} with Starlight to spend, the Luminary mastered, Bonds and the Reliquary under way. Try the later systems at once.`,
  },
];

/**
 * The playtest demo's first question (docs/demo.md): start fresh, or as a veteran. Two cards; the
 * arrows move between them, Enter chooses.
 */
export function DemoChoiceView({ onChoose }: { onChoose(kind: DemoStart): void }) {
  const box = useRef<HTMLDivElement>(null);
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (box.current && arrowFocus(box.current, e.key)) e.preventDefault();
  };
  return (
    <section
      aria-labelledby="demo-choice-title"
      className="anim-fade mt-10 w-full max-w-2xl"
      data-testid="demo-choice"
    >
      <h2
        id="demo-choice-title"
        className="text-center font-display text-xl font-bold tracking-wide text-gold-200"
      >
        How would you like to begin?
      </h2>
      <p className="mt-1 text-center text-sm text-muted">
        Choose once. Settings can bring you back to this choice.
      </p>
      <div ref={box} className="mt-4 grid gap-3 sm:grid-cols-2" onKeyDown={onKey}>
        {STARTS.map((s, i) => (
          <button
            key={s.kind}
            type="button"
            data-nav
            autoFocus={i === 0}
            onClick={() => {
              unlockAudio();
              playUi('confirm');
              onChoose(s.kind);
            }}
            onFocus={() => playUi('hover')}
            className="flex flex-col gap-1.5 rounded-xl border border-gold-500/50 bg-ink-900/85 p-4 text-left transition-colors hover:border-gold-300 hover:bg-ink-800/90"
            data-testid={`demo-${s.kind}`}
          >
            <span className="flex items-center gap-2 font-display text-lg font-bold text-gold-200">
              <Icon name={s.icon} size={20} className="text-gold-300" /> {s.title}
            </span>
            <span className="text-sm leading-relaxed text-text">{s.text}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

/**
 * The Title: the front door (Phase 4g). Continue (a run in progress), Enter the Loom (the hub,
 * where every other system now lives), Settings, and the Weaver's Rank. In the playtest demo's
 * build, the first visit asks how to start before anything else, and a quiet line says what the
 * build is.
 */
export function TitleScreen({
  demo = DEMO,
  onChooseDemo = chooseDemo,
}: {
  /** The playtest demo's build (`DEMO`); the UI lab shows it in any build. */
  demo?: boolean;
  /** How a start is chosen (`chooseDemo`); the UI lab's changes nothing. */
  onChooseDemo?(kind: DemoStart): void;
} = {}) {
  useMood('title');
  const setScreen = useUi((s) => s.setScreen);
  const [asking, setAsking] = useState(() => askDemoChoice(demo));
  const hasSave = useRun.getState().hasSave();
  const profile = useProfile((s) => s.profile);
  const unlockAll = useSettings((s) => s.settings.unlockAll);
  // The route the next run takes (docs/phase-5a.md): the Prelude until Expeditions open.
  const expedition =
    profile.runMode === 'expedition' && (unlockAll || allowanceFor(rankOf(profile.xp)).expedition);
  const items: {
    label: string;
    icon: IconName;
    onClick(): void;
    primary?: boolean;
    hidden?: boolean;
  }[] = [
    {
      label: 'Continue',
      icon: 'play',
      primary: true,
      hidden: !hasSave,
      onClick: () => {
        if (useRun.getState().resume()) setScreen('run');
      },
    },
    { label: 'Enter the Loom', icon: 'loom', primary: !hasSave, onClick: () => setScreen('loom') },
    { label: 'Settings', icon: 'gear', onClick: () => setScreen('settings') },
  ];

  return (
    <main className="relative h-full overflow-hidden">
      <Backdrop tone="gold" />
      <Threads />
      <div className="relative z-10 flex h-full flex-col items-center justify-center px-6">
        <p className="anim-fade font-mono text-xs uppercase tracking-[0.4em] text-muted">
          {titleEyebrow(expedition)}
        </p>
        <h1
          className="anim-rise mt-4 text-center font-display text-4xl font-bold tracking-wide text-gold-300 min-[430px]:text-5xl sm:text-7xl lg:text-8xl"
          style={{ textShadow: '0 0 40px rgb(245 184 61 / 0.35), 0 4px 0 rgb(0 0 0 / 0.5)' }}
        >
          Aetherweaver
        </h1>
        <p
          className="anim-fade mt-4 text-center text-lg text-muted"
          style={{ animationDelay: '300ms' }}
        >
          You are the support. Your party is the weapon.
        </p>

        {asking ? (
          <DemoChoiceView
            onChoose={(kind) => {
              onChooseDemo(kind);
              setAsking(false);
            }}
          />
        ) : (
          <nav
            aria-label="Main menu"
            className="mt-12 flex w-80 flex-col gap-2.5"
            data-testid="front-door"
            onKeyDown={(e) => {
              if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
              const buttons = [...e.currentTarget.querySelectorAll('button')];
              const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
              const step = e.key === 'ArrowDown' ? 1 : -1;
              buttons[(at + step + buttons.length) % buttons.length]?.focus();
              e.preventDefault();
            }}
          >
            {items
              .filter((i) => !i.hidden)
              .map((item, idx) => (
                <Button
                  key={item.label}
                  size="lg"
                  variant={item.primary ? 'primary' : 'secondary'}
                  onClick={item.onClick}
                  autoFocus={idx === 0}
                  onFocus={() => playUi('hover')}
                  onPointerDown={unlockAudio}
                  className="w-full justify-start gap-3"
                >
                  <Icon name={item.icon} size={18} />
                  {item.label}
                </Button>
              ))}
          </nav>
        )}
        {!asking && (
          <RankPanelView
            profile={profile}
            unlockAll={unlockAll}
            className="anim-fade mt-6 w-full max-w-sm md:absolute md:bottom-10 md:right-6 md:mt-0 md:w-[22rem]"
          />
        )}
        <div className="absolute bottom-4 flex flex-col items-center gap-0.5 text-xs text-muted">
          {demo && <p data-testid="playtest-line">{PLAYTEST_LINE}</p>}
          <p>Arrow keys or Tab to move · Enter to choose</p>
        </div>
      </div>
    </main>
  );
}
