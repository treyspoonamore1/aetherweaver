import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Icon } from '../kit/Icon';
import { KeyCap } from '../kit/KeyCap';
import { threadModeLook, type ThreadDialView, type ThreadModeId } from './threadMode';

/** How long a switch's crossfade plays (ms): the sweep, the glyphs trading places, the ripple. */
export const DIAL_SWITCH_MS = 450;

const LETHAL = 'var(--color-lethal)';

const mix = (color: string, pct: number) => `color-mix(in srgb, ${color} ${pct}%, transparent)`;

/**
 * The Thread dial (docs/thread-dial.md): the Thread's mode as one big glyph in a ring of its
 * colour, over the middle of the Weaver bar (its crest), so Mend and Empower read at a glance.
 * Switching crossfades it: the new colour sweeps round the ring from the top, the old glyph
 * turns away as the new one turns in, and a ripple of the new colour spreads. With reduced
 * motion the stylesheet cuts the animations short, so it simply changes.
 *
 * Its keys sit on it as on the technique buttons: the switch at the top left and, on the
 * Martyr's runs, Bear's at the top right. Its plate names the mode. Dimmed and dashed when the
 * Thread is on no one, snapped (in the lethal red) or slack while the Weaver is down. It takes
 * no pointer events: a right-click over it still reaches the game.
 */
export function ThreadDial({ view }: { view: ThreadDialView }) {
  // The mode switched from, while the switch's crossfade plays (`n` restarts its animations).
  const [swap, setSwap] = useState<{ from: ThreadModeId; n: number } | null>(null);
  const shown = useRef(view.mode);
  const switches = useRef(0);
  useEffect(() => {
    if (view.mode === shown.current) return;
    const from = shown.current;
    shown.current = view.mode;
    switches.current++;
    setSwap({ from, n: switches.current });
    const t = window.setTimeout(() => setSwap(null), DIAL_SWITCH_MS);
    return () => window.clearTimeout(t);
  }, [view.mode]);

  const { look, state } = view;
  const live = state === 'live';
  const ring = state === 'snapped' ? LETHAL : look.color;
  const from = swap && swap.from !== view.mode ? threadModeLook(swap.from) : null;
  const n = swap?.n ?? 0;
  // No CSS filter on the glyphs: the disc's glow lights them, and the dial stays cheap to draw.
  const glyph = (l: typeof look): CSSProperties => ({ color: l.color });
  return (
    <div
      className="pointer-events-none relative h-[4.25rem] w-[4.25rem]"
      style={{ opacity: state === 'down' ? 0.42 : live ? 1 : 0.66 }}
      role="img"
      aria-label={view.says}
      data-testid="thread-dial"
      data-mode={view.mode}
      data-state={state}
    >
      {/* The disc, lit from within by the mode (faded in again on a switch). */}
      <span
        className="absolute inset-0 rounded-full bg-ink-950/92"
        style={{
          boxShadow: `0 0 0 1px rgb(0 0 0 / 0.55), 0 0 18px ${mix(ring, live ? 42 : 18)}, 0 6px 16px rgb(0 0 0 / 0.45)`,
          transition: 'box-shadow 0.3s ease-out',
        }}
      />
      <span
        key={`glow${n}`}
        className={`absolute inset-0 rounded-full ${from ? 'anim-fade' : ''}`}
        style={{
          background: `radial-gradient(circle at 50% 46%, ${mix(look.color, live ? 30 : 14)} 0%, transparent 70%)`,
        }}
      />
      <svg viewBox="0 0 64 64" className="absolute inset-0 h-full w-full -rotate-90" aria-hidden>
        <circle cx="32" cy="32" r="28.5" fill="none" stroke={mix(ring, 20)} strokeWidth="4.5" />
        {/* The ring: in a switch, the old colour under the new colour's sweep. */}
        <circle
          cx="32"
          cy="32"
          r="28.5"
          fill="none"
          stroke={from ? from.color : ring}
          strokeWidth="3.25"
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray={live || from ? undefined : '5.5 3'}
        />
        {from && (
          <circle
            key={`sweep${n}`}
            className="anim-dial-sweep"
            cx="32"
            cy="32"
            r="28.5"
            fill="none"
            stroke={ring}
            strokeWidth="3.6"
            strokeLinecap="round"
            pathLength={100}
            strokeDasharray="100"
          />
        )}
        <circle cx="32" cy="32" r="22.5" fill="none" stroke={mix(ring, 32)} strokeWidth="1" />
      </svg>
      {/* The glyphs: the old one turning away as the new one turns in. */}
      {from && (
        <span
          key={`out${n}`}
          className="anim-dial-out absolute inset-0 flex items-center justify-center"
          style={glyph(from)}
        >
          <Icon
            name={from.icon}
            className="h-8 w-8"
            strokeWidth={2.5}
            solid={from.icon !== 'mend'}
          />
        </span>
      )}
      <span
        key={`in${n}`}
        className={`absolute inset-0 flex items-center justify-center ${from ? 'anim-dial-in' : ''}`}
        style={glyph(look)}
        data-testid="thread-dial-glyph"
        data-icon={look.icon}
      >
        <Icon name={look.icon} className="h-8 w-8" strokeWidth={2.5} solid={look.icon !== 'mend'} />
      </span>
      {from && (
        <span
          key={`ripple${n}`}
          className="anim-dial-ripple absolute inset-0 rounded-full border-2"
          style={{ borderColor: look.color }}
        />
      )}
      <KeyCap label={view.switchKey} className="absolute -left-2.5 -top-1.5" />
      {view.bearKey && (
        <KeyCap
          label={view.bearKey}
          accent={view.mode === 'bear'}
          className="absolute -right-2.5 -top-1.5"
        />
      )}
      <span
        className="absolute left-1/2 top-full -mt-2.5 -translate-x-1/2 whitespace-nowrap rounded-md border bg-ink-950 px-1.5 py-px text-[0.625rem] font-bold uppercase leading-tight tracking-wider"
        style={{ color: ring, borderColor: mix(ring, 70) }}
        data-testid="thread-dial-plate"
      >
        {view.plate}
      </span>
    </div>
  );
}
