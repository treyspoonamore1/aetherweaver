import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
} from 'react';
import type { CombatSession } from '../../app/runtime';
import { getRuntime } from '../../app/runtimeRegistry';
import { CONTENT, heroDef } from '../../content';
import type { Action } from '../../input/actions';
import type { PartySlot } from '../../sim';
import { bindingLabel } from '../hud/labels';
import { Icon, type IconName } from '../kit/Icon';
import { KeyCap } from '../kit/KeyCap';
import { STATION_LOOK } from '../kit/loomLook';
import { Panel } from '../kit/Panel';
import { playUi } from '../kit/sound';
import {
  BAR_FROM,
  BAR_TO,
  DRILL_MODES,
  DRILL_SPEEDS,
  WardDrill,
  barPercent,
  modeLabel,
  statusLine,
  tryDetail,
  tryTitle,
  type DrillMode,
  type DrillTry,
  type DrillView,
  type TryKind,
} from './wardDrill';

/**
 * The Perfect-Ward trainer (Phase 4g, docs/phase-4g.md) over the Training Grounds: choose a speed
 * and a hero, Start, and Ward each blow the training bell telegraphs. Each try says how it went,
 * with where the Ward fell against the window; the streak and this speed's best sit in the
 * corner. The keys are the fight's (Q Wards, the hero keys Thread), and the panel's buttons
 * never keep the keyboard from the game.
 */

/** How each kind of try looks: a colour, always with its glyph and its words. */
export const TRY_LOOK: Readonly<Record<TryKind, { color: string; icon: IconName; label: string }>> =
  {
    // The Perfect Ward callout's gold.
    perfect: { color: '#f5d78e', icon: 'ward', label: 'Perfect' },
    early: { color: '#93c5fd', icon: 'back', label: 'Early' },
    late: { color: '#fdba74', icon: 'arrow', label: 'Late' },
    warded: { color: 'var(--color-shield)', icon: 'ward', label: 'Warded, not Perfect' },
    missed: { color: '#fda4af', icon: 'close', label: 'Missed' },
  };

/** The Grounds' own light (the Loom's station): the Ward's shield, cooler. */
const LOOK = STATION_LOOK.training;

const FOCUS: readonly Action[] = ['focus1', 'focus2', 'focus3', 'focus4'];

/** The Training Grounds' party: the content's (the sandbox plays the default party). */
function party(): { name: string; color: string }[] {
  return CONTENT.defaultParty.map((id) => {
    const def = heroDef(id);
    return { name: def.name, color: def.color };
  });
}

/** A click from the pointer gives the keyboard back to the game; Enter and Space keep focus. */
function release(e: MouseEvent<HTMLButtonElement>): void {
  if (e.detail > 0) e.currentTarget.blur();
}

export interface WardTrainerViewProps {
  view: DrillView;
  onStart(): void;
  onStop(): void;
  onMode(mode: DrillMode): void;
  onTarget(slot: PartySlot): void;
  /** Folded to its title line (UI lab). */
  folded?: boolean;
  className?: string;
}

/** The trainer's panel, from its view (the UI lab draws it from mock views). */
export function WardTrainerView({
  view: v,
  onStart,
  onStop,
  onMode,
  onTarget,
  folded = false,
  className = '',
}: WardTrainerViewProps) {
  const [open, setOpen] = useState(!folded);
  const heroes = party();
  const name = (slot: number) => heroes[slot]?.name ?? `Hero ${slot + 1}`;
  const key = (slot: number) => bindingLabel(FOCUS[slot] ?? 'focus1');
  const wardKey = bindingLabel('ward');
  const mixed = v.mode === 'mixed';
  return (
    <Panel
      className={`pointer-events-auto w-[31rem] p-3 ${className}`}
      style={{ borderColor: `color-mix(in srgb, ${LOOK.color} 45%, var(--color-ink-600))` }}
      aria-label="Perfect-Ward trainer"
      data-testid="ward-trainer"
      data-running={v.running}
    >
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          className="flex items-center gap-2 rounded-md text-left font-display text-sm font-bold tracking-wide"
          style={{ color: LOOK.light }}
          aria-expanded={open}
          onClick={(e) => {
            setOpen(!open);
            release(e);
          }}
        >
          <Icon name="ward" size={15} style={{ color: LOOK.color }} />
          Perfect-Ward trainer
          <span className="font-sans text-xs font-normal text-muted">{open ? 'hide' : 'show'}</span>
        </button>
        <p
          className="flex items-center gap-2 font-mono text-xs text-muted"
          data-testid="drill-streak"
          data-streak={v.streak}
          data-best={v.best}
        >
          <span>
            Streak{' '}
            <b
              className="text-sm text-text"
              style={v.streak > 0 ? { color: TRY_LOOK.perfect.color } : undefined}
            >
              {v.streak}
            </b>
          </span>
          <span aria-hidden>·</span>
          <span
            title={`Your best streak at ${modeLabel(v.mode).toLowerCase()}, kept on this device`}
          >
            Best <b className="text-sm text-text">{v.best}</b>
            <span className="sr-only"> at {modeLabel(v.mode)}</span>
          </span>
          {v.newBest && v.streak > 0 && v.streak === v.best && (
            <span
              className="rounded-md px-1.5 font-sans text-[11px] font-bold leading-5 text-ink-950"
              style={{ background: TRY_LOOK.perfect.color }}
            >
              New best
            </span>
          )}
        </p>
      </div>
      {open && (
        <>
          <div className="mt-2.5 flex flex-col gap-2">
            <Choices label="Speed">
              {DRILL_MODES.map((m) => (
                <Choice
                  key={m}
                  pressed={v.mode === m}
                  onPick={() => onMode(m)}
                  testId={`drill-mode-${m}`}
                  title={
                    m === 'mixed'
                      ? 'Any hero, any speed, at random'
                      : `Each blow winds up for ${DRILL_SPEEDS[m].windup.toFixed(1)} s`
                  }
                >
                  {modeLabel(m)}
                  {m !== 'mixed' && (
                    <span className="font-mono text-[11px] font-normal opacity-80">
                      {DRILL_SPEEDS[m].windup.toFixed(1)} s
                    </span>
                  )}
                </Choice>
              ))}
            </Choices>
            <div className="flex items-center justify-between gap-2">
              <Choices label="Hero" note={mixed ? 'Mixed picks any hero.' : undefined}>
                {heroes.map((h, slot) => (
                  <Choice
                    key={h.name}
                    pressed={!mixed && v.target === slot}
                    disabled={mixed}
                    onPick={() => onTarget(slot as PartySlot)}
                    testId={`drill-target-${slot}`}
                    title={`The blows come at ${h.name}: ${key(slot)} Threads them`}
                  >
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: h.color }}
                      aria-hidden
                    />
                    {h.name}
                    <KeyCap label={key(slot)} className="!min-w-4 !px-1 !py-0 text-[10px]" />
                  </Choice>
                ))}
              </Choices>
              <button
                type="button"
                className={`flex shrink-0 items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors ${
                  v.running
                    ? 'border border-ink-500 bg-ink-800 text-text hover:border-rose-300 hover:text-rose-200'
                    : 'bg-gold-400 text-ink-950 shadow-md shadow-gold-500/20 hover:bg-gold-300'
                }`}
                onClick={(e) => {
                  if (v.running) onStop();
                  else onStart();
                  release(e);
                }}
                data-testid="drill-start"
              >
                <Icon name={v.running ? 'pause' : 'play'} size={14} />
                {v.running ? 'Stop' : 'Start'}
              </button>
            </div>
          </div>
          <TryResult last={v.last} history={v.history} tries={v.tries} heroName={name} />
          <p
            className="mt-2 flex items-start gap-1.5 text-xs leading-snug text-muted"
            data-testid="drill-status"
            data-status={v.status.kind}
          >
            <Icon
              name={v.status.kind === 'blow' ? 'bell' : v.status.kind === 'idle' ? 'info' : 'clock'}
              size={13}
              className="mt-px shrink-0"
              style={v.status.kind === 'blow' ? { color: LOOK.color } : undefined}
            />
            <span className={v.status.kind === 'blow' ? 'font-semibold text-text' : ''}>
              {statusLine(v, name, key, wardKey)}
            </span>
          </p>
        </>
      )}
    </Panel>
  );
}

/** A labelled row of toggle buttons (the speed, the hero); `note` is said, not shown. */
function Choices({ label, note, children }: { label: string; note?: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 items-center gap-2" role="group" aria-label={label}>
      <span className="w-11 shrink-0 text-[11px] font-semibold uppercase tracking-wider text-muted">
        {label}
      </span>
      <div className="flex flex-wrap items-center gap-1">{children}</div>
      {note && <span className="sr-only">{note}</span>}
    </div>
  );
}

function Choice({
  pressed,
  disabled = false,
  onPick,
  testId,
  title,
  children,
}: {
  pressed: boolean;
  disabled?: boolean;
  onPick(): void;
  testId: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      disabled={disabled}
      title={title}
      onClick={(e) => {
        onPick();
        release(e);
      }}
      data-testid={testId}
      className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${
        pressed
          ? 'border-transparent text-ink-950'
          : 'border-ink-500 bg-ink-800 text-text enabled:hover:border-gold-400 enabled:hover:text-gold-200'
      }`}
      style={pressed ? { background: LOOK.color } : undefined}
    >
      {children}
    </button>
  );
}

/** The last try: its headline, its sentence, where the Ward fell, and the tries before it. */
function TryResult({
  last,
  history,
  tries,
  heroName,
}: {
  last: DrillTry | null;
  history: readonly TryKind[];
  tries: number;
  heroName(slot: number): string;
}) {
  const look = last ? TRY_LOOK[last.kind] : null;
  return (
    <div
      className="mt-2.5 rounded-lg border border-ink-600/70 bg-ink-950/50 px-3 py-2"
      style={
        look ? { borderColor: `color-mix(in srgb, ${look.color} 45%, transparent)` } : undefined
      }
    >
      <div className="flex items-center justify-between gap-3">
        <div
          aria-live="polite"
          className="min-w-0"
          data-testid="drill-result"
          data-kind={last?.kind}
        >
          {last && look ? (
            <p
              key={tries}
              className="anim-rise flex items-center gap-2 font-display text-xl font-bold leading-tight"
              style={{ color: look.color }}
            >
              <Icon name={look.icon} size={18} solid={last.kind === 'perfect'} />
              {tryTitle(last)}
              <span className="sr-only">: {tryDetail(last, heroName)}</span>
            </p>
          ) : (
            <p className="font-display text-base font-semibold text-muted">No tries yet</p>
          )}
        </div>
        <TryHistory history={history} />
      </div>
      {last ? (
        <>
          <p className="mt-0.5 text-xs leading-snug text-text" aria-hidden>
            {tryDetail(last, heroName)}
          </p>
          <TimingBar t={last} />
        </>
      ) : (
        <p className="mt-0.5 text-xs leading-snug text-muted">
          The bell strikes on a steady beat, your Ward and Spirit readied for each blow. Ward in the
          window, the last moment before it lands, for a Perfect.
        </p>
      )}
    </div>
  );
}

/** The last tries as glyphs, oldest first. */
function TryHistory({ history }: { history: readonly TryKind[] }) {
  if (history.length === 0) return null;
  const perfects = history.filter((k) => k === 'perfect').length;
  return (
    <ol
      className="flex shrink-0 items-center gap-0.5"
      aria-label={`The last ${history.length} tries: ${perfects} Perfect`}
      data-testid="drill-history"
    >
      {history.map((k, i) => (
        <li
          key={i}
          className="flex h-4 w-4 items-center justify-center rounded-full border"
          style={{
            color: TRY_LOOK[k].color,
            borderColor: `color-mix(in srgb, ${TRY_LOOK[k].color} 55%, transparent)`,
            background:
              k === 'perfect'
                ? `color-mix(in srgb, ${TRY_LOOK[k].color} 22%, transparent)`
                : undefined,
          }}
          title={TRY_LOOK[k].label}
        >
          <Icon name={TRY_LOOK[k].icon} size={10} />
        </li>
      ))}
    </ol>
  );
}

/**
 * Where the Ward fell: a second of the windup and a moment after it, the Perfect window lit,
 * the impact marked, and the cast as a pin in the try's colour (at the edge, with an arrow, when
 * it was further out).
 */
function TimingBar({ t }: { t: DrillTry }) {
  const look = TRY_LOOK[t.kind];
  const from = barPercent(-t.windowMs / 1000);
  const impact = barPercent(0);
  const cast = t.castAt === null ? null : barPercent(t.castAt);
  const off =
    t.castAt === null ? null : t.castAt < BAR_FROM ? 'before' : t.castAt > BAR_TO ? 'after' : null;
  return (
    <div className="mt-2" aria-hidden data-testid="drill-bar">
      <div className="relative h-3 rounded-full border border-ink-600 bg-ink-800">
        <div
          className="absolute inset-y-0 rounded-sm"
          style={{
            left: `${from}%`,
            width: `${impact - from}%`,
            background: `color-mix(in srgb, ${TRY_LOOK.perfect.color} 45%, transparent)`,
            boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${TRY_LOOK.perfect.color} 70%, transparent)`,
          }}
        />
        <div
          className="absolute -inset-y-1 w-0.5 rounded-full bg-text"
          style={{ left: `calc(${impact}% - 1px)` }}
        />
        {cast !== null && (
          <span
            className="absolute top-1/2 flex h-4 w-4 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-ink-950"
            style={{ left: `${cast}%`, background: look.color } as CSSProperties}
          >
            {off && (
              <Icon name={off === 'before' ? 'back' : 'arrow'} size={9} className="text-ink-950" />
            )}
          </span>
        )}
      </div>
      <div className="relative mt-0.5 h-3.5 font-mono text-[10px] leading-none text-muted">
        <span className="absolute left-0">−1 s</span>
        <span className="absolute -translate-x-1/2" style={{ left: `${(from + impact) / 2}%` }}>
          window
        </span>
        <span className="absolute -translate-x-1/2 text-text" style={{ left: `${impact}%` }}>
          lands
        </span>
      </div>
    </div>
  );
}

/**
 * The trainer in the Training Grounds: one drill for the visit, fed by the fight's runtime after
 * each batch of ticks (again whenever the session, and so the runtime, is replaced).
 */
export function WardTrainer({
  session,
  hidden = false,
  className = '',
}: {
  /** The Grounds' session: a new one starts a new runtime, which the drill then follows. */
  session: CombatSession;
  /** Out of sight (the dev panel is open); the drill keeps going. */
  hidden?: boolean;
  className?: string;
}) {
  const [drill] = useState(() => new WardDrill());
  const subscribe = useCallback((listener: () => void) => drill.subscribe(listener), [drill]);
  const read = useCallback(() => drill.view(), [drill]);
  const view = useSyncExternalStore(subscribe, read);
  useEffect(() => {
    // GameHost (before this in the tree) has started the session's runtime by now.
    const runtime = getRuntime();
    if (!runtime) return;
    return runtime.listen((events, state) => {
      for (const command of drill.step(events, state)) runtime.queue(command);
    });
  }, [drill, session]);
  useEffect(() => () => drill.stop(), [drill]);
  // Each try's verdict, heard just after the fight's own sound for the blow (docs/phase-4g.md):
  // a Perfect, early or late by how much, a miss; a streak's milestones; a best beaten.
  const heard = useRef({ tries: view.tries, best: view.best });
  useEffect(() => {
    const before = heard.current;
    heard.current = { tries: view.tries, best: view.best };
    const t = view.last;
    if (view.tries === before.tries || !t) return;
    const timers: number[] = [];
    const later = (ms: number, play: () => void) => timers.push(window.setTimeout(play, ms));
    if (t.kind === 'perfect') {
      later(120, () => playUi('drillPerfect'));
      if (view.streak === 5 || view.streak === 10 || view.streak === 25)
        later(370, () => playUi('drillStreak', { streak: view.streak }));
      // Once a streak, as it first passes a best already kept (not the first ever).
      if (before.best > 0 && view.streak === before.best + 1) later(620, () => playUi('drillBest'));
    } else if (t.kind === 'early' || t.kind === 'late') {
      const sound = t.kind === 'early' ? 'drillEarly' : 'drillLate';
      later(120, () => playUi(sound, { ms: Math.abs(t.ms ?? 0) }));
    } else if (t.kind === 'missed') later(120, () => playUi('drillMiss'));
    return () => timers.forEach((id) => window.clearTimeout(id));
  }, [view]);
  if (hidden) return null;
  return (
    <WardTrainerView
      view={view}
      onStart={() => drill.start()}
      onStop={() => drill.stop()}
      onMode={(m) => drill.setMode(m)}
      onTarget={(slot) => drill.setTarget(slot)}
      className={className}
    />
  );
}
