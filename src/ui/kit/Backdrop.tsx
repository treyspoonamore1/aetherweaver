import type { ReactNode } from 'react';
import type { BackdropTone } from './backdropTone';

export type { BackdropTone };

/** Deterministic star field (no Math.random in render: same stars every time). */
const STARS = (() => {
  let s = 1234567;
  const next = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
  return Array.from({ length: 70 }, () => ({
    x: next() * 100,
    y: next() * 100,
    r: 0.6 + next() * 1.4,
    d: next() * 3.2,
    gold: next() > 0.82,
  }));
})();

/**
 * The Abyssal Rift's fray (docs/phase-5c.md): a few loose threads drifting across the cosmos, in
 * bone, never Mend's teal. Fixed, so the backdrop draws the same every time.
 */
const FRAYS = [
  'M -8 22 C 18 30, 34 12, 62 24 S 96 18, 112 30',
  'M -6 64 C 22 58, 40 76, 70 66 S 98 72, 110 60',
  'M 14 -6 C 22 18, 8 40, 26 62',
  'M 84 104 C 78 82, 92 64, 80 40',
];

/** The shared "stained-glass cosmos" backdrop for every non-combat screen. */
export function Backdrop({ tone = 'navy' }: { tone?: BackdropTone }) {
  const glow =
    tone === 'gold'
      ? 'rgb(245 184 61 / 0.13)'
      : tone === 'dusk'
        ? 'rgb(167 139 250 / 0.14)'
        : tone === 'crimson'
          ? // Phase 5a: the Crimson Spire's map (Movement II).
            'rgb(168 46 52 / 0.2)'
          : tone === 'abyss'
            ? // Phase 5c: the Abyssal Rift's map (Movement III), an indigo glow.
              'rgb(76 70 170 / 0.26)'
            : tone === 'crucible'
              ? // Phase 5d: the Celestial Crucible (the Finale), a white-gold sky. Kept low enough
                // that the screens' text keeps WCAG AA on it.
                'rgb(255 246 224 / 0.16)'
              : 'rgb(61 76 125 / 0.28)';
  // The Finale: the four rings are the music drawn in the sky, brighter and breathing.
  const crucible = tone === 'crucible';
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
      style={{
        background: `radial-gradient(ellipse at 50% 35%, ${glow} 0%, transparent 60%), radial-gradient(ellipse at center, #14204a 0%, #0a1022 55%, #050814 100%)`,
      }}
    >
      <svg
        className={`absolute left-1/2 top-1/2 h-[140vmax] w-[140vmax] -translate-x-1/2 -translate-y-1/2 anim-spin-slow ${crucible ? 'opacity-[0.3]' : 'opacity-[0.16]'}`}
        viewBox="-100 -100 200 200"
        {...(crucible ? { 'data-testid': 'backdrop-rings' } : {})}
      >
        {[96, 78, 60, 42].map((r, i) => (
          <circle
            key={r}
            r={r}
            fill="none"
            stroke={crucible ? '#fff6e0' : 'var(--color-gold-400)'}
            strokeWidth={crucible ? 0.4 : 0.25}
            strokeDasharray={i % 2 ? '2 3' : '10 4 1 4'}
            {...(crucible
              ? {
                  style: {
                    animation: `glow-breathe ${3.2 + i * 0.6}s ease-in-out ${i * 0.4}s infinite`,
                  },
                }
              : {})}
          />
        ))}
        {Array.from({ length: 12 }, (_, i) => (
          <line
            key={i}
            x1={0}
            y1={0}
            x2={Math.round(96 * Math.cos((i * Math.PI) / 6) * 100) / 100}
            y2={Math.round(96 * Math.sin((i * Math.PI) / 6) * 100) / 100}
            stroke="var(--color-gold-400)"
            strokeWidth={0.15}
          />
        ))}
      </svg>
      {tone === 'abyss' && (
        <svg
          className="absolute inset-0 h-full w-full opacity-[0.14]"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          data-testid="backdrop-fray"
        >
          {FRAYS.map((d) => (
            <path
              key={d}
              d={d}
              fill="none"
              stroke="#e8e3c8"
              strokeWidth={0.18}
              strokeDasharray="6 2 1 2"
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>
      )}
      {STARS.map((s, i) => (
        <span
          key={i}
          className="absolute rounded-full"
          style={{
            left: `${s.x}%`,
            top: `${s.y}%`,
            width: s.r * 2,
            height: s.r * 2,
            background: s.gold ? 'var(--color-gold-300)' : '#cbd5ff',
            animation: `twinkle ${2.4 + s.d}s ease-in-out ${s.d}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

/** A full-size scrolling screen on the cosmos backdrop. */
export function ScreenFrame({
  children,
  tone,
  className = '',
}: {
  children: ReactNode;
  tone?: BackdropTone;
  className?: string;
}) {
  return (
    <main className="relative h-full w-full overflow-hidden">
      <Backdrop tone={tone} />
      <div className={`scroll-thin relative z-10 h-full overflow-y-auto ${className}`}>
        {children}
      </div>
    </main>
  );
}

export function ScreenHeader({
  eyebrow,
  title,
  right,
  children,
}: {
  eyebrow?: string;
  title: string;
  right?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && (
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-muted">{eyebrow}</p>
        )}
        <h1 className="mt-1 font-display text-3xl font-bold tracking-wide text-gold-300 sm:text-4xl">
          {title}
        </h1>
        {children}
      </div>
      {right && <div className="flex items-center gap-2">{right}</div>}
    </header>
  );
}
