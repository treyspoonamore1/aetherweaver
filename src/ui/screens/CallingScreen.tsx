import { useEffect, useState, type CSSProperties } from 'react';
import { useRun } from '../../app/runStore';
import { callingDef, callingOption, optionText, type CallingOption } from '../../content';
import { EVERYTHING, type Allowance } from '../../meta/profile';
import type { ChordLoadout, RunState } from '../../meta/types';
import { ScreenFrame } from '../kit/Backdrop';
import { Button } from '../kit/Button';
import { CallingEmblem, CallingGlyph, PathPip, callingLook } from '../kit/CallingGlyph';
import { Icon } from '../kit/Icon';
import { KeyCap } from '../kit/KeyCap';
import { playUi, useMood } from '../kit/sound';
import { AxisChip, CallingPassive } from './CallingParts';
import { RetuneView } from './RespiteScreen';
import { useAllowance } from './PrepScreen';
import {
  belowNote,
  passiveName,
  pathSteps,
  reservesLife,
  tierWhenLabel,
  withOption,
  type PathStep,
} from './callingText';

export interface CallingViewProps {
  run: RunState;
  /** Take option `index`; `chords` is Third Voice's free retune (omitted: keep the songs). */
  onPick(index: 0 | 1, chords?: ChordLoadout[]): void;
  /** What the player's Rank opens, for Third Voice's song builder (default: everything). */
  allowance?: Allowance;
  /** UI lab: open straight into Third Voice's builder for this option. */
  initialRetune?: 0 | 1;
}

/** Keys 1 and 2 wait this long after the screen opens (RunScreen's arrival guard is 350 ms). */
const KEY_GUARD_MS = 400;

/** Does taking this option add a song slot (Third Voice), and so open the builder? */
function grantsSlot(o: CallingOption): boolean {
  return (o.values.slots ?? 0) > 0;
}

/**
 * The Calling's next tier (docs/phase-3c.md): after a milestone fight, pick one of two
 * options for the rest of the run. The path so far is lit, the tiers to come wait dimmed with
 * when they come. Third Voice opens the song builder for a free retune with its third slot.
 * Keys 1 and 2 (RunScreen's arrival guard keeps the previous screen's keys out).
 */
export function CallingView({
  run,
  onPick,
  allowance = EVERYTHING,
  initialRetune,
}: CallingViewProps) {
  useMood('map');
  const offer = run.callingOffer;
  const [retune, setRetune] = useState<0 | 1 | null>(initialRetune ?? null);
  const tier = offer?.tier ?? -1;
  useEffect(() => {
    if (tier >= 0) playUi('callingReveal');
  }, [tier]);
  const options = offer?.options.map((id) => callingOption(id)) ?? [];
  const take = (i: 0 | 1) => {
    const o = options[i];
    if (!o) return;
    playUi('callingPick');
    if (grantsSlot(o)) setRetune(i);
    else onPick(i);
  };
  // The tier screen's own arrival guard, behind RunScreen's: a 1 or 2 pressed for the screen
  // before (or held over from it) never takes an option for the rest of the run.
  const [openedAt] = useState(() => performance.now());
  useEffect(() => {
    if (retune !== null || !offer) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      if (performance.now() - openedAt < KEY_GUARD_MS) return;
      if (e.key === '1' || e.key === '2') {
        e.preventDefault();
        take(e.key === '1' ? 0 : 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  if (!offer || !run.calling) return null;
  const def = callingDef(run.calling.id);
  const look = callingLook(def.id);

  if (retune !== null) {
    const option = options[retune]!;
    const preview = withOption(run, offer.tier, option.id);
    return (
      <RetuneView
        run={preview}
        allowance={allowance}
        fresh={[]}
        tone="gold"
        onBack={() => setRetune(null)}
        onRetune={(chords) => onPick(retune, chords)}
        confirmVariant="primary"
        copy={{
          eyebrow: `The ${def.name} · ${option.name} · a free retune`,
          title: 'A third voice for your field song',
          blurb: `Your field song now holds a third aura (the slot marked ${option.name}). Rebuild your songs for free, or keep them and fill it at a Respite or a forge later.`,
          back: 'Back: choose again',
          confirm: 'Retune and go on',
        }}
        extra={
          <Button size="lg" onClick={() => onPick(retune)} sound="confirm">
            Keep my songs
          </Button>
        }
      />
    );
  }

  const steps = pathSteps(run.calling, { offerTier: offer.tier, map: run.map });
  return (
    <ScreenFrame tone="gold">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-80"
        style={{
          background: `radial-gradient(ellipse at 50% 0%, color-mix(in srgb, ${look.color} 22%, transparent), transparent 70%)`,
        }}
      />
      <div className="relative mx-auto max-w-5xl px-6 pb-12 pt-6">
        <header className="anim-rise flex items-center gap-5">
          <CallingEmblem
            callingId={def.id}
            icon={def.icon}
            size={76}
            bright
            className="anim-glow"
          />
          <div className="min-w-0">
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-muted">
              The {def.name} · {def.title}
            </p>
            <h1
              className="mt-1 font-display text-3xl font-bold tracking-wide sm:text-4xl"
              style={{ color: look.color }}
            >
              Your Calling grows
            </h1>
            <p className="mt-1 text-sm text-muted">
              Tier {steps[offer.tier]!.numeral} of {steps.length}. Choose one: it lasts the rest of
              the run.
            </p>
          </div>
        </header>

        <PathTrack steps={steps} callingId={def.id} map={run.map} />

        <ul className="mt-5 grid gap-5 md:grid-cols-2" data-testid="calling-options">
          {options.map((o, i) => (
            <li key={o.id} className="anim-rise" style={{ animationDelay: `${120 + i * 110}ms` }}>
              <OptionCard
                option={o}
                callingId={def.id}
                keyLabel={String(i + 1)}
                chords={run.chords}
                onTake={() => take(i as 0 | 1)}
              />
            </li>
          ))}
        </ul>

        <div className="mt-5 rounded-xl border border-ink-600/60 bg-ink-900/60 px-4 py-3">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted">
            Always yours · {passiveName(def.id)}
          </p>
          <CallingPassive def={def} compact />
        </div>
      </div>
    </ScreenFrame>
  );
}

/** The path so far, left to right: lit options, the tier on offer, the tiers to come. */
function PathTrack({
  steps,
  callingId,
  map,
}: {
  steps: PathStep[];
  callingId: string;
  map: RunState['map'];
}) {
  const look = callingLook(callingId);
  return (
    <ol className="mt-5 grid grid-cols-4 gap-2" aria-label="Your path" data-testid="calling-path">
      {steps.map((s, i) => (
        <li key={s.tier} className="relative flex flex-col items-center text-center">
          {i > 0 && (
            <span
              aria-hidden
              className="absolute right-1/2 top-5 h-0.5 w-full -translate-y-1/2"
              style={{
                background:
                  s.state === 'chosen' || s.state === 'offer'
                    ? `linear-gradient(90deg, ${look.color}, ${look.deep})`
                    : 'var(--color-ink-600)',
                opacity: s.state === 'open' ? 0.7 : 1,
              }}
            />
          )}
          <PathPip
            callingId={callingId}
            state={s.state}
            icon={s.chosen?.icon}
            numeral={s.numeral}
            size={40}
            className={`relative ${s.state === 'offer' ? 'anim-glow' : ''}`}
          />
          <span
            className={`mt-1.5 text-sm font-semibold leading-tight ${s.state === 'open' ? 'text-muted' : ''}`}
            style={s.state !== 'open' ? { color: look.color } : undefined}
          >
            {s.chosen
              ? s.chosen.name
              : s.state === 'offer'
                ? `Tier ${s.numeral}: now`
                : `Tier ${s.numeral}`}
          </span>
          <span className="text-xs leading-tight text-muted">
            {s.state === 'offer' ? 'Choose below' : tierWhenLabel(s.tier, map)}
          </span>
        </li>
      ))}
    </ol>
  );
}

function OptionCard({
  option: o,
  callingId,
  keyLabel,
  chords,
  onTake,
}: {
  option: CallingOption;
  callingId: string;
  keyLabel: string;
  /** The run's songs: what they hold of the Martyr's Life decides when Blood Font and Vigil wake. */
  chords: readonly ChordLoadout[];
  onTake(): void;
}) {
  const look = callingLook(callingId);
  const text = optionText(o);
  const below = reservesLife(callingDef(callingId)) ? belowNote(o, chords) : null;
  return (
    <button
      type="button"
      onClick={onTake}
      aria-label={`Take ${o.name}: ${text}`}
      className="group flex h-full w-full flex-col rounded-2xl border-2 bg-ink-800/90 p-5 text-left shadow-xl shadow-black/40 transition-all hover:-translate-y-1 hover:bg-ink-700/90 focus-visible:-translate-y-1"
      style={{ borderColor: `color-mix(in srgb, ${look.color} 70%, transparent)` }}
    >
      <span className="flex w-full items-start justify-between gap-3">
        <span
          className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-2 transition-shadow group-hover:shadow-[0_0_24px_var(--glow)]"
          style={
            {
              color: look.light,
              borderColor: look.color,
              background: `radial-gradient(circle at 50% 65%, color-mix(in srgb, ${look.color} 35%, transparent), rgb(10 16 34 / 0.92) 75%)`,
              '--glow': look.color,
            } as CSSProperties
          }
          aria-hidden
        >
          <CallingGlyph icon={o.icon} size={36} />
        </span>
        <KeyCap label={keyLabel} />
      </span>
      <span className="mt-3 flex flex-wrap items-center gap-2">
        <span className="font-display text-2xl font-bold" style={{ color: look.color }}>
          {o.name}
        </span>
        <AxisChip optionId={o.id} size="md" all />
      </span>
      <span className="mt-2 flex-1 text-base leading-relaxed text-text">{text}</span>
      {below && (
        <span
          className="mt-2 flex items-start gap-1.5 text-sm leading-snug"
          style={{ color: look.light }}
          data-testid="below-note"
        >
          <Icon name="drop" size={15} className="mt-0.5 shrink-0" />
          {below.text}
        </span>
      )}
      {grantsSlot(o) && (
        <span className="mt-2 flex items-center gap-1.5 text-sm text-gold-200">
          <Icon name="tune" size={15} /> Opens the song builder: retune for free, or keep your
          songs.
        </span>
      )}
      <span
        className="mt-4 block rounded-lg py-2 text-center text-sm font-semibold text-ink-950 opacity-90 group-hover:opacity-100"
        style={{ background: `linear-gradient(90deg, ${look.color}, ${look.light})` }}
      >
        Take {o.name}
      </span>
    </button>
  );
}

export function CallingScreen() {
  const run = useRun((s) => s.run);
  const pick = useRun((s) => s.pickCalling);
  const allowance = useAllowance();
  if (!run) return null;
  return <CallingView run={run} onPick={pick} allowance={allowance} />;
}
