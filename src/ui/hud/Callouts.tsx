import { useState, type CSSProperties } from 'react';
import { Icon, type IconName } from '../kit/Icon';
import type { Callout } from '../store';
import { WEAVER_BAR_LEFT, WEAVER_BAR_WIDTH } from './labels';

/** Fades the element out over its last 350 ms, whatever its lifetime. */
function useLifetime(expiresAt: number): number {
  const [ttl] = useState(() => Math.max(400, expiresAt - performance.now()));
  return ttl;
}

function fadeStyle(ttl: number, entry: string): CSSProperties {
  return {
    animation: `${entry}, fade-out 0.35s ease-in ${Math.max(0, ttl - 350)}ms forwards`,
  };
}

const BANNER_ICON: Partial<Record<Callout['kind'], IconName>> = {
  perfect: 'ward',
  save: 'heart',
  clutch: 'chime',
  response: 'call',
};

/** Big centred banners: PERFECT, SAVE, CLUTCH, Crescendo. */
function Banner({ c }: { c: Callout }) {
  const ttl = useLifetime(c.expiresAt);
  const color = c.color ?? '#f5d78e';
  const icon = c.text.startsWith('Crescendo') ? 'sparkle' : BANNER_ICON[c.kind];
  return (
    <div
      className="flex flex-col items-center text-center"
      style={fadeStyle(ttl, 'banner-in 0.45s cubic-bezier(0.2,0.9,0.3,1.2) both')}
    >
      <p
        className="flex items-center gap-3 font-display text-4xl font-bold uppercase tracking-[0.14em]"
        style={{ color, textShadow: `0 0 24px ${color}, 0 2px 0 rgb(0 0 0 / 0.6)` }}
      >
        {icon && <Icon name={icon} size={32} />}
        {c.text}
        {icon && <Icon name={icon} size={32} />}
      </p>
      {c.detail && (
        <p
          className="mt-1 rounded-full bg-ink-950/70 px-4 py-1 text-sm font-medium text-text"
          style={{ boxShadow: `0 0 0 1px ${color}55` }}
        >
          {c.detail}
        </p>
      )}
    </div>
  );
}

/** Fermata caught a lethal hit: urgent, but a sentence, not a shout. */
function HoldBanner({ c }: { c: Callout }) {
  const ttl = useLifetime(c.expiresAt);
  const color = c.color ?? '#e2d6f8';
  return (
    <div
      className="flex items-center gap-3 rounded-xl border-2 bg-ink-950/85 px-5 py-2.5 shadow-xl shadow-black/60"
      style={{
        ...fadeStyle(ttl, 'banner-in 0.35s cubic-bezier(0.2,0.9,0.3,1.2) both'),
        borderColor: color,
      }}
      role="alert"
    >
      <Icon name="fermata" size={30} style={{ color }} />
      <div>
        <p className="font-display text-xl font-bold" style={{ color }}>
          {c.text}
        </p>
        {c.detail && <p className="text-sm text-text">{c.detail}</p>}
      </div>
    </div>
  );
}

function DecreeBanner({ c }: { c: Callout }) {
  const ttl = useLifetime(c.expiresAt);
  return (
    <div
      className="max-w-xl rounded-xl border border-ailment/60 bg-ink-950/85 px-5 py-3 text-center shadow-xl shadow-black/60"
      style={fadeStyle(ttl, 'banner-in 0.45s cubic-bezier(0.2,0.9,0.3,1.2) both')}
    >
      <p className="font-display text-xs font-semibold uppercase tracking-[0.3em] text-violet-300">
        Decree
      </p>
      <p className="font-display text-xl font-bold text-violet-100">{c.text}</p>
      {c.detail && <p className="mt-0.5 text-sm text-violet-200">{c.detail}</p>}
    </div>
  );
}

function Toast({ c, small = false }: { c: Callout; small?: boolean }) {
  const ttl = useLifetime(c.expiresAt);
  return (
    <div
      className={`rounded-lg border border-ink-600/70 bg-ink-900/88 shadow-lg shadow-black/40 ${small ? 'px-2.5 py-1 text-xs' : 'px-4 py-1.5 text-sm'}`}
      style={fadeStyle(ttl, 'toast-in 0.25s ease-out both')}
    >
      {c.speaker && (
        <span className="mr-1.5 font-semibold" style={{ color: c.color }}>
          {c.speaker}:
        </span>
      )}
      <span style={c.speaker ? undefined : { color: c.color }}>{c.text}</span>
      {c.detail && <span className="ml-2 text-muted">{c.detail}</span>}
    </div>
  );
}

const BIG = new Set<Callout['kind']>(['perfect', 'save', 'clutch', 'response']);

/**
 * Transient feedback by kind (docs/plan/04 §5.2): big banners centre-low, decrees and wave
 * toasts at the top, rejections beside the Weaver bar. Barks with a known speaker are drawn
 * by the party frames, so `barkSpeakers` lists who already has a bubble.
 */
export function Callouts({
  callouts,
  barkSpeakers,
}: {
  callouts: Callout[];
  barkSpeakers: string[];
}) {
  const big = callouts.filter((c) => BIG.has(c.kind));
  const holds = callouts.filter((c) => c.kind === 'hold');
  const decrees = callouts.filter((c) => c.kind === 'decree');
  const waves = callouts.filter((c) => c.kind === 'wave' && !/of 1$/.test(c.text));
  const mid = callouts.filter(
    (c) =>
      c.kind === 'system' ||
      c.kind === 'solo' ||
      c.kind === 'hint' ||
      ((c.kind === 'bark' || c.kind === 'call') &&
        (!c.speaker || !barkSpeakers.includes(c.speaker))),
  );
  const rejects = callouts.filter((c) => c.kind === 'reject').slice(-2);
  return (
    <div aria-live="polite">
      <div className="absolute left-1/2 top-[42%] flex -translate-x-1/2 flex-col items-center gap-3">
        {holds.slice(-1).map((c) => (
          <HoldBanner key={c.id} c={c} />
        ))}
        {big.slice(holds.length > 0 ? -1 : -2).map((c) => (
          <Banner key={c.id} c={c} />
        ))}
      </div>
      <div className="absolute left-1/2 top-[11.25rem] flex -translate-x-1/2 flex-col items-center gap-2">
        {decrees.slice(-1).map((c) => (
          <DecreeBanner key={c.id} c={c} />
        ))}
      </div>
      <div className="absolute left-1/2 top-[7.5rem] flex -translate-x-1/2 flex-col items-center gap-2">
        {waves.slice(-1).map((c) => (
          <p
            key={c.id}
            className="font-display text-lg font-semibold uppercase tracking-[0.3em] text-gold-200"
            style={{
              ...fadeStyle(1800, 'toast-in 0.25s ease-out both'),
              textShadow: '0 2px 8px rgb(0 0 0 / 0.8)',
            }}
          >
            {c.text}
          </p>
        ))}
      </div>
      <div className="absolute left-1/2 top-[56%] flex -translate-x-1/2 flex-col items-center gap-1.5">
        {mid.slice(-2).map((c) => (
          <Toast key={c.id} c={c} />
        ))}
      </div>
      <div
        className="absolute bottom-[12.25rem] flex flex-col items-center gap-1"
        style={{ left: WEAVER_BAR_LEFT, width: WEAVER_BAR_WIDTH }}
      >
        {rejects.map((c) => (
          <Toast key={c.id} c={c} small />
        ))}
      </div>
    </div>
  );
}
