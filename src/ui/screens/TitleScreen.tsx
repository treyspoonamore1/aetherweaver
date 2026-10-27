import { useState } from 'react';
import { useProfile } from '../../app/profileStore';
import { useRun } from '../../app/runStore';
import { useSettings } from '../../app/settings';
import { astrolabePoints } from '../../meta/astrolabe';
import { deedPoints } from '../../meta/deeds';
import { rankOf } from '../../meta/profile';
import { AstrolabeGlyph } from '../kit/AstrolabeGlyph';
import { Backdrop } from '../kit/Backdrop';
import { Button } from '../kit/Button';
import { Icon, type IconName } from '../kit/Icon';
import { playUi, unlockAudio, useMood } from '../kit/sound';
import { useUi } from '../store';
import { astrolabeOpen, spendLine } from './astrolabeModel';
import { RankPanelView } from './Rank';

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

export function TitleScreen() {
  useMood('title');
  const setScreen = useUi((s) => s.setScreen);
  const [confirmNew, setConfirmNew] = useState(false);
  const hasSave = useRun.getState().hasSave();
  const profile = useProfile((s) => s.profile);
  const unlockAll = useSettings((s) => s.settings.unlockAll);
  // The Astrolabe (Phase 4): open from Rank 4 (or with Skip the unlocks), points left to spend.
  const rank = rankOf(profile.xp);
  const astrolabe = astrolabeOpen(rank, unlockAll);
  const toSpend =
    astrolabePoints(rank, unlockAll, deedPoints(profile.deeds)) - profile.astrolabe.length;

  const startNew = () => {
    useRun.getState().newRun();
    setScreen('run');
  };
  const items: {
    label: string;
    icon: IconName | 'astrolabe';
    onClick(): void;
    primary?: boolean;
    hidden?: boolean;
    /** A note on the button's right ("3 points to spend"). */
    badge?: string;
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
    {
      label: 'New run',
      icon: 'flag',
      primary: !hasSave,
      onClick: () => (hasSave ? setConfirmNew(true) : startNew()),
    },
    { label: 'Training Grounds', icon: 'swords', onClick: () => setScreen('training') },
    {
      label: 'Astrolabe',
      icon: 'astrolabe',
      hidden: !astrolabe,
      badge: toSpend > 0 ? spendLine(toSpend) : undefined,
      onClick: () => setScreen('astrolabe'),
    },
    { label: 'Codex', icon: 'book', onClick: () => setScreen('codex') },
    { label: 'Settings', icon: 'gear', onClick: () => setScreen('settings') },
  ];

  return (
    <main className="relative h-full overflow-hidden">
      <Backdrop tone="gold" />
      <Threads />
      <div className="relative z-10 flex h-full flex-col items-center justify-center px-6">
        <p className="anim-fade font-mono text-xs uppercase tracking-[0.4em] text-muted">
          Movement I · The Prelude
        </p>
        <h1
          className="anim-rise mt-4 text-center font-display text-6xl font-bold tracking-wide text-gold-300 sm:text-8xl"
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

        <nav
          aria-label="Main menu"
          className="mt-12 flex w-80 flex-col gap-2.5"
          onKeyDown={(e) => {
            if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
            const buttons = [...e.currentTarget.querySelectorAll('button')];
            const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
            const step = e.key === 'ArrowDown' ? 1 : -1;
            buttons[(at + step + buttons.length) % buttons.length]?.focus();
            e.preventDefault();
          }}
        >
          {confirmNew ? (
            <div className="anim-fade rounded-xl border border-gold-500/60 bg-ink-900/90 p-4 text-center">
              <p className="text-sm text-text">Starting a new run replaces your saved one.</p>
              <div className="mt-3 flex justify-center gap-2">
                <Button
                  variant="secondary"
                  onClick={() => setConfirmNew(false)}
                  sound="back"
                  autoFocus
                >
                  Keep it
                </Button>
                <Button variant="primary" onClick={startNew} sound="confirm">
                  New run
                </Button>
              </div>
            </div>
          ) : (
            items
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
                  aria-label={item.badge ? `${item.label}: ${item.badge}` : undefined}
                >
                  {item.icon === 'astrolabe' ? (
                    <AstrolabeGlyph glyph="weaver_star" size={18} />
                  ) : (
                    <Icon name={item.icon} size={18} />
                  )}
                  {item.label}
                  {item.badge && (
                    <span
                      className="ml-auto whitespace-nowrap rounded-md border border-gold-400/70 bg-gold-400/15 px-2 py-0.5 text-xs font-semibold text-gold-200"
                      data-testid="title-astrolabe-points"
                    >
                      {item.badge}
                    </span>
                  )}
                </Button>
              ))
          )}
        </nav>
        <RankPanelView
          profile={profile}
          unlockAll={unlockAll}
          className="anim-fade mt-6 w-full max-w-sm md:absolute md:bottom-10 md:right-6 md:mt-0 md:w-[22rem]"
        />
        <p className="absolute bottom-4 text-xs text-muted">
          Arrow keys or Tab to move · Enter to choose
        </p>
      </div>
    </main>
  );
}
