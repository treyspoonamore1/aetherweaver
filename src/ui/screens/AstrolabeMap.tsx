import { useEffect, useMemo, useRef, type KeyboardEvent } from 'react';
import { astrolabeNode, type AstrolabeNode } from '../../content';
import { neighbours } from '../../meta/astrolabe';
import { astrolabeGlyphPath } from '../kit/astrolabeGlyphs';
import {
  CONSTELLATIONS,
  CONSTELLATION_LOOK,
  STARLIGHT,
  constellationLook,
  type Constellation,
} from '../kit/astrolabeLook';
import {
  LINKS,
  MAP_BOX,
  STARS,
  STAR_RADIUS,
  bridgeOf,
  linkKey,
  linkState,
  litIn,
  ownedSet,
  pathLinks,
  starAt,
  starConstellations,
  starGlyph,
  starLabel,
  starState,
  type StarPreview,
  type StarState,
} from './astrolabeModel';

/** The ring of names round the dial sits this far out from the rim, in map units. */
const BAND = 1.05;
const THREAT = '#fb923c';
const GIVE = '#fda4af';
const FOCUS = 'var(--color-gold-200)';

export interface AstrolabeMapProps {
  tree: readonly string[];
  /** The star pointed at (hovered, else focused): its path, or what hangs on it, lights up. */
  preview?: StarPreview | null;
  /** The star with keyboard focus (its ring). */
  focused?: string | null;
  /** Stars embarking would leave behind (the tree holds more than the points). */
  dropped?: ReadonlySet<string>;
  /** A star that just refused a move shakes (`n` changes each time). */
  buzz?: { id: string; n: number } | null;
  /** Small and still (the Summary): no input, no names, no dial words. */
  mini?: boolean;
  onPoint?(id: string | null, via: 'pointer' | 'focus'): void;
  onTake?(id: string): void;
  onGiveBack?(id: string): void;
  onKey?(e: KeyboardEvent<SVGGElement>, id: string): void;
  /** Each star's element, for moving focus with the arrow keys. */
  starRef?(id: string, el: SVGGElement | null): void;
  className?: string;
  label?: string;
}

/**
 * The Astrolabe's star map (Phase 4): the dial with the four constellations' names on its rim,
 * the links (lit between stars you own), and every star drawn by its kind: travel stars small,
 * notables larger with an inner ring, great notables crowned, keystones in a diamond frame. A
 * star you own is lit in its constellation's colour; one that touches the tree has a bright
 * ring; one out of reach is faint. Pointing at a star draws the path taking it would take.
 */
export function AstrolabeMap({
  tree,
  preview = null,
  focused = null,
  dropped,
  buzz = null,
  mini = false,
  onPoint,
  onTake,
  onGiveBack,
  onKey,
  starRef,
  className = '',
  label = 'The Astrolabe',
}: AstrolabeMapProps) {
  const owned = useMemo(() => ownedSet(tree), [tree]);
  const path = useMemo(() => new Set(preview?.path ?? []), [preview]);
  const marching = useMemo(
    () => new Set(pathLinks(tree, preview?.path ?? []).map(([a, b]) => linkKey(a, b))),
    [tree, preview],
  );
  const hangs = useMemo(() => new Set(preview?.hangs ?? []), [preview]);
  const short = preview?.action === 'short';
  return (
    <svg
      viewBox={`${MAP_BOX.x} ${MAP_BOX.y} ${MAP_BOX.w} ${MAP_BOX.h}`}
      className={`block select-none ${className}`}
      role={mini ? 'img' : 'group'}
      aria-label={label}
      onContextMenu={(e) => e.preventDefault()}
      data-testid={mini ? 'astrolabe-mini' : 'astrolabe-map'}
    >
      <style>{MAP_CSS}</style>
      <Defs />
      <Dial tree={tree} mini={mini} />
      <g aria-hidden>
        {LINKS.map(([a, b]) => (
          <Link key={linkKey(a, b)} a={a} b={b} state={linkState(owned, a, b)} mini={mini} />
        ))}
        {[...marching].map((key) => {
          const [a, b] = key.split('|') as [string, string];
          const pa = starAt(astrolabeNode(a));
          const pb = starAt(astrolabeNode(b));
          return (
            <line
              key={`m${key}`}
              x1={pa.x}
              y1={pa.y}
              x2={pb.x}
              y2={pb.y}
              className="astro-march"
              stroke={short ? THREAT : STARLIGHT.light}
              strokeWidth={0.1}
              strokeDasharray="0.24 0.16"
              strokeLinecap="round"
            />
          );
        })}
      </g>
      <g>
        {STARS.map((node) => (
          <Star
            key={node.id}
            node={node}
            state={starState(tree, node.id, owned)}
            mark={markOf(node.id, preview, path, hangs)}
            focused={focused === node.id}
            dropped={dropped?.has(node.id) ?? false}
            buzz={buzz?.id === node.id ? buzz.n : 0}
            mini={mini}
            label={mini ? '' : starLabel(node, starState(tree, node.id, owned), null)}
            onPoint={onPoint}
            onTake={onTake}
            onGiveBack={onGiveBack}
            onKey={onKey}
            starRef={starRef}
          />
        ))}
      </g>
      {!mini && <Names tree={tree} />}
    </svg>
  );
}

/** How the preview marks a star: on the path, its end, hanging on it, or the star itself. */
type Mark = 'path' | 'target' | 'short' | 'shortTarget' | 'hang' | 'mine' | 'held' | null;

function markOf(
  id: string,
  p: StarPreview | null,
  path: ReadonlySet<string>,
  hangs: ReadonlySet<string>,
): Mark {
  if (!p) return null;
  if (p.id === id) {
    if (p.action === 'take') return 'target';
    if (p.action === 'short') return 'shortTarget';
    if (p.action === 'mine') return 'mine';
    if (p.action === 'held') return 'held';
    return null;
  }
  if (path.has(id)) return p.action === 'short' ? 'short' : 'path';
  if (hangs.has(id)) return 'hang';
  return null;
}

const MAP_CSS = `
.astro-march { animation: astro-march 0.9s linear infinite; }
@keyframes astro-march { to { stroke-dashoffset: -0.8; } }
.astro-pulse { animation: astro-pulse 2.2s ease-in-out infinite; }
@keyframes astro-pulse { 0%, 100% { opacity: 0.25; } 50% { opacity: 0.85; } }
.astro-star { outline: none; cursor: pointer; }
.astro-star:focus { outline: none; }
`;

/** Gradients: each constellation's lit star and glow, the centre's, each bridge's two colours. */
function Defs() {
  const lit = (id: string, light: string, color: string, deep: string) => (
    <radialGradient key={`lit-${id}`} id={`lit-${id}`} cx="40%" cy="35%" r="70%">
      <stop offset="0%" stopColor={light} />
      <stop offset="55%" stopColor={color} />
      <stop offset="100%" stopColor={deep} />
    </radialGradient>
  );
  const glow = (id: string, color: string) => (
    <radialGradient key={`glow-${id}`} id={`glow-${id}`}>
      <stop offset="0%" stopColor={color} stopOpacity={0.55} />
      <stop offset="45%" stopColor={color} stopOpacity={0.18} />
      <stop offset="100%" stopColor={color} stopOpacity={0} />
    </radialGradient>
  );
  return (
    <defs>
      {CONSTELLATIONS.map((c) => {
        const l = CONSTELLATION_LOOK[c];
        return [lit(c, l.light, l.color, l.deep), glow(c, l.color)];
      })}
      {lit('centre', STARLIGHT.light, STARLIGHT.color, STARLIGHT.deep)}
      {glow('centre', STARLIGHT.color)}
      {STARS.filter((n) => n.constellation === 'bridge').map((n) => {
        const [a, b] = bridgeOf(n.id) as [Constellation, Constellation];
        const u = bridgeAxis(n);
        const la = CONSTELLATION_LOOK[a];
        const lb = CONSTELLATION_LOOK[b];
        return (
          <linearGradient
            key={n.id}
            id={`lit-${n.id}`}
            x1={0.5 - u.x / 2}
            y1={0.5 - u.y / 2}
            x2={0.5 + u.x / 2}
            y2={0.5 + u.y / 2}
          >
            <stop offset="0%" stopColor={la.color} />
            <stop offset="48%" stopColor={la.light} />
            <stop offset="52%" stopColor={lb.light} />
            <stop offset="100%" stopColor={lb.color} />
          </linearGradient>
        );
      })}
      <radialGradient id="astro-sky" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#1a2752" stopOpacity={0.95} />
        <stop offset="70%" stopColor="#0c1430" stopOpacity={0.9} />
        <stop offset="100%" stopColor="#070b1b" stopOpacity={0.85} />
      </radialGradient>
    </defs>
  );
}

/**
 * A bridge's axis on screen: the unit vector from its first constellation's neighbour toward its
 * second's, so its two colours face their own sides.
 */
function bridgeAxis(node: AstrolabeNode): { x: number; y: number } {
  const [a, b] = bridgeOf(node.id);
  const side = (c: Constellation | undefined) => {
    const n = neighbours(node.id).find((id) => astrolabeNode(id).constellation === c);
    return n ? starAt(astrolabeNode(n)) : starAt(node);
  };
  const pa = side(a);
  const pb = side(b);
  const len = Math.hypot(pb.x - pa.x, pb.y - pa.y) || 1;
  return { x: (pb.x - pa.x) / len, y: (pb.y - pa.y) / len };
}

/** Deterministic faint stars in the sky behind the map. */
const SKY = (() => {
  let s = 4242;
  const next = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
  return Array.from({ length: 90 }, () => {
    const a = next() * Math.PI * 2;
    const r = Math.sqrt(next()) * MAP_BOX.rim * 0.98;
    return {
      x: Math.cos(a) * r,
      y: Math.sin(a) * r,
      r: 0.025 + next() * 0.05,
      o: 0.2 + next() * 0.5,
    };
  });
})();

/** Each constellation's quarter of the dial, clockwise from screen-up = −90°. */
const QUARTER: Readonly<Record<Constellation, number>> = {
  silk: -90,
  choir: 0,
  bond: 90,
  aegis: 180,
};

function polar(r: number, deg: number): { x: number; y: number } {
  const a = (deg * Math.PI) / 180;
  return { x: r * Math.cos(a), y: r * Math.sin(a) };
}

function arc(r: number, from: number, to: number, clockwise = true): string {
  const a = polar(r, from);
  const b = polar(r, to);
  const large = Math.abs(to - from) > 180 ? 1 : 0;
  return `M ${a.x.toFixed(3)} ${a.y.toFixed(3)} A ${r} ${r} 0 ${large} ${clockwise ? 1 : 0} ${b.x.toFixed(3)} ${b.y.toFixed(3)}`;
}

/** The instrument: the sky, guide rings, the rim with its ticks and the constellations' names. */
function Dial({ tree, mini }: { tree: readonly string[]; mini: boolean }) {
  const rim = MAP_BOX.rim;
  const outer = rim + BAND;
  const gold = 'var(--color-gold-400)';
  return (
    <g aria-hidden>
      <circle r={mini ? rim : outer} fill="url(#astro-sky)" />
      {!mini &&
        SKY.map((s, i) => (
          <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#cbd5ff" opacity={s.o} />
        ))}
      {/* Guide rings: where the first notables, the second notables and the rim stars sit. */}
      {[3.2, 6, 9].map((r) => (
        <circle
          key={r}
          r={r}
          fill="none"
          stroke={gold}
          strokeOpacity={0.09}
          strokeWidth={0.03}
          strokeDasharray="0.12 0.18"
        />
      ))}
      {[45, 135, 225, 315].map((deg) => {
        const p = polar(rim, deg);
        return (
          <line
            key={deg}
            x1={0}
            y1={0}
            x2={p.x}
            y2={p.y}
            stroke={gold}
            strokeOpacity={0.06}
            strokeWidth={0.03}
          />
        );
      })}
      <circle r={rim} fill="none" stroke={gold} strokeOpacity={0.4} strokeWidth={0.05} />
      {!mini && (
        <>
          <circle r={outer} fill="none" stroke={gold} strokeOpacity={0.4} strokeWidth={0.05} />
          {Array.from({ length: 72 }, (_, i) => {
            const deg = i * 5;
            const long = deg % 30 === 0;
            const a = polar(rim, deg);
            const b = polar(rim - (long ? 0.32 : 0.16), deg);
            return (
              <line
                key={deg}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={gold}
                strokeOpacity={long ? 0.45 : 0.25}
                strokeWidth={long ? 0.05 : 0.03}
              />
            );
          })}
          {CONSTELLATIONS.map((c) => {
            const look = CONSTELLATION_LOOK[c];
            const mid = QUARTER[c];
            const lit = litIn(tree, c);
            // The bottom quarter reads left to right the other way round, so it stays upright.
            const flip = c === 'bond';
            const r = flip ? outer - 0.3 : rim + 0.3;
            const d = flip ? arc(r, mid + 44, mid - 44, false) : arc(r, mid - 44, mid + 44);
            const words = `${look.name} · ${look.blurb}${lit > 0 ? ` · ${lit} lit` : ''}`;
            return (
              <g key={c}>
                <path
                  d={arc(rim + BAND / 2, mid - 43, mid + 43)}
                  fill="none"
                  stroke={look.color}
                  strokeOpacity={0.12}
                  strokeWidth={BAND - 0.08}
                />
                <path id={`band-${c}`} d={d} fill="none" stroke="none" />
                <text
                  fontFamily="var(--font-display)"
                  fontSize={0.52}
                  fontWeight={700}
                  letterSpacing={0.1}
                  fill={look.color}
                  style={{ textTransform: 'uppercase' }}
                >
                  <textPath href={`#band-${c}`} startOffset="50%" textAnchor="middle">
                    {words}
                  </textPath>
                </text>
              </g>
            );
          })}
          {[45, 135, 225, 315].map((deg) => {
            const p = polar(rim + BAND / 2, deg);
            return (
              <rect
                key={deg}
                x={p.x - 0.16}
                y={p.y - 0.16}
                width={0.32}
                height={0.32}
                transform={`rotate(45 ${p.x} ${p.y})`}
                fill="var(--color-ink-900)"
                stroke={gold}
                strokeOpacity={0.6}
                strokeWidth={0.04}
              />
            );
          })}
        </>
      )}
    </g>
  );
}

function Link({
  a,
  b,
  state,
  mini,
}: {
  a: string;
  b: string;
  state: 'lit' | 'open' | 'dark';
  mini: boolean;
}) {
  const na = astrolabeNode(a);
  const nb = astrolabeNode(b);
  const pa = starAt(na);
  const pb = starAt(nb);
  if (state === 'lit')
    return (
      <g>
        <line
          x1={pa.x}
          y1={pa.y}
          x2={pb.x}
          y2={pb.y}
          stroke={STARLIGHT.color}
          strokeOpacity={0.22}
          strokeWidth={mini ? 0.32 : 0.26}
          strokeLinecap="round"
        />
        <line
          x1={pa.x}
          y1={pa.y}
          x2={pb.x}
          y2={pb.y}
          stroke={STARLIGHT.light}
          strokeWidth={mini ? 0.14 : 0.08}
          strokeLinecap="round"
        />
      </g>
    );
  // An open link takes the colour of the star it leads to.
  const toward = state === 'open' ? (na.id === 'star' ? nb : nb.id === 'star' ? na : null) : null;
  const end = toward ?? (state === 'open' ? farEnd(na, nb) : na);
  const c = starConstellations(end)[0];
  const color = c ? CONSTELLATION_LOOK[c].color : STARLIGHT.color;
  return (
    <line
      x1={pa.x}
      y1={pa.y}
      x2={pb.x}
      y2={pb.y}
      stroke={state === 'open' ? color : '#33426f'}
      strokeOpacity={state === 'open' ? 0.75 : mini ? 0.5 : 0.85}
      strokeWidth={state === 'open' ? 0.07 : 0.05}
      strokeLinecap="round"
    />
  );
}

/** Of an open link's two ends, the one not yet taken is drawn in its own colour. */
function farEnd(a: AstrolabeNode, b: AstrolabeNode): AstrolabeNode {
  return a.constellation === 'bridge' ? b : b.constellation === 'bridge' ? a : b;
}

interface StarProps {
  node: AstrolabeNode;
  state: StarState;
  mark: Mark;
  focused: boolean;
  dropped: boolean;
  buzz: number;
  mini: boolean;
  label: string;
  onPoint?: AstrolabeMapProps['onPoint'];
  onTake?: AstrolabeMapProps['onTake'];
  onGiveBack?: AstrolabeMapProps['onGiveBack'];
  onKey?: AstrolabeMapProps['onKey'];
  starRef?: AstrolabeMapProps['starRef'];
}

/**
 * A shake: a move the star refused (Web Animations, no stylesheet). In map units, which the
 * SVG scales up: 0.14 is about 4 px on screen.
 */
const SHAKE: Keyframe[] = [
  { transform: 'translateX(0)' },
  { transform: 'translateX(-0.14px)' },
  { transform: 'translateX(0.14px)' },
  { transform: 'translateX(-0.1px)' },
  { transform: 'translateX(0.06px)' },
  { transform: 'translateX(0)' },
];

function Star({
  node,
  state,
  mark,
  focused,
  dropped,
  buzz,
  mini,
  label,
  onPoint,
  onTake,
  onGiveBack,
  onKey,
  starRef,
}: StarProps) {
  const R = STAR_RADIUS[node.kind];
  const cs = starConstellations(node);
  const look = cs[0] ? constellationLook(cs[0]) : { ...STARLIGHT, glyph: 'weaver_star' };
  const fillId = node.constellation === 'bridge' ? node.id : (cs[0] ?? 'centre');
  const p = starAt(node);
  const lit = state === 'owned' || state === 'centre';
  const far = state === 'far';
  const onPath = mark === 'path' || mark === 'target';
  const shortPath = mark === 'short' || mark === 'shortTarget';
  const inner = useRef<SVGGElement>(null);
  useEffect(() => {
    const el = inner.current;
    if (!buzz || !el || typeof el.animate !== 'function') return;
    // A refusal still sounds and says why; reduced motion just doesn't shake.
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    el.animate(SHAKE, { duration: 360, easing: 'ease-out' });
  }, [buzz]);
  const stroke = node.constellation === 'bridge' ? `url(#lit-${node.id})` : look.color;
  const body = lit
    ? `url(#lit-${fillId})`
    : onPath
      ? `color-mix(in srgb, ${look.color} 30%, #0b1330)`
      : far
        ? '#070c1c'
        : '#0d1632';
  const glyphColor = lit ? look.deep : onPath ? look.light : look.color;
  const glyphOpacity = far && !onPath ? 0.4 : 1;
  const ringOpacity = lit ? 1 : far && !onPath && !shortPath ? 0.34 : 1;
  const g = node.kind === 'travel' ? R * 1.35 : node.kind === 'start' ? R * 1.25 : R * 1.2;
  const interactive = !mini && !!onPoint;
  return (
    <g transform={`translate(${p.x} ${p.y})`} opacity={dropped ? 0.55 : 1}>
      <g
        ref={(el) => {
          inner.current = el;
          starRef?.(node.id, el);
        }}
        className={interactive ? 'astro-star' : undefined}
        tabIndex={interactive ? 0 : undefined}
        role={interactive ? 'button' : undefined}
        aria-label={interactive ? label : undefined}
        aria-pressed={interactive && state !== 'centre' ? lit : undefined}
        data-star={node.id}
        data-state={state}
        data-mark={mark ?? undefined}
        onPointerEnter={interactive ? () => onPoint?.(node.id, 'pointer') : undefined}
        onPointerLeave={interactive ? () => onPoint?.(null, 'pointer') : undefined}
        onFocus={interactive ? () => onPoint?.(node.id, 'focus') : undefined}
        onBlur={interactive ? () => onPoint?.(null, 'focus') : undefined}
        onClick={interactive ? () => onTake?.(node.id) : undefined}
        onContextMenu={
          interactive
            ? (e) => {
                e.preventDefault();
                onGiveBack?.(node.id);
              }
            : undefined
        }
        onKeyDown={interactive ? (e) => onKey?.(e, node.id) : undefined}
      >
        {/* Wider than the star, so the small ones are easy to point at. */}
        {interactive && <circle r={Math.max(R + 0.2, 0.48)} fill="transparent" />}
        {lit && (
          <circle
            r={R * (node.kind === 'travel' ? 2.6 : 2.2)}
            fill={`url(#glow-${cs[0] ?? 'centre'})`}
          />
        )}
        {state === 'takeable' && !mini && !mark && (
          <circle
            r={R + 0.12}
            fill="none"
            stroke={look.color}
            strokeWidth={0.05}
            className="astro-pulse"
          />
        )}
        <Frame node={node} R={R} stroke={stroke} lit={lit} opacity={ringOpacity} />
        <circle
          r={R}
          fill={body}
          stroke={stroke}
          strokeOpacity={ringOpacity}
          strokeWidth={
            (node.kind === 'travel' ? 0.05 : 0.08) * (state === 'takeable' && !mini ? 1.4 : 1)
          }
        />
        {node.kind === 'notable' && (
          <circle
            r={R - 0.1}
            fill="none"
            stroke={lit ? look.deep : look.color}
            strokeOpacity={lit ? 0.45 : ringOpacity * 0.5}
            strokeWidth={0.03}
          />
        )}
        {(!mini || node.kind !== 'travel') && (
          <path
            d={astrolabeGlyphPath(starGlyph(node))}
            transform={`translate(${-g / 2} ${-g / 2}) scale(${g / 24})`}
            fill="none"
            stroke={glyphColor}
            strokeOpacity={glyphOpacity}
            strokeWidth={node.kind === 'travel' ? 2.4 : 2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
        {mark && <MarkRing mark={mark} R={R} />}
        {dropped && (
          <circle
            r={R + 0.1}
            fill="none"
            stroke={THREAT}
            strokeWidth={0.05}
            strokeDasharray="0.1 0.08"
          />
        )}
        {focused && (
          <circle
            r={R + 0.3}
            fill="none"
            stroke={FOCUS}
            strokeWidth={0.06}
            strokeDasharray="0.14 0.09"
          />
        )}
      </g>
    </g>
  );
}

/** A keystone's diamond, a great notable's crown of points; the centre's rays. */
function Frame({
  node,
  R,
  stroke,
  lit,
  opacity,
}: {
  node: AstrolabeNode;
  R: number;
  stroke: string;
  lit: boolean;
  opacity: number;
}) {
  if (node.kind === 'keystone') {
    const s = (R + 0.34) / Math.SQRT2;
    return (
      <g>
        <rect
          x={-s}
          y={-s}
          width={2 * s}
          height={2 * s}
          rx={0.06}
          transform="rotate(45)"
          fill={lit ? 'color-mix(in srgb, #0b1330 55%, transparent)' : '#0a1126'}
          stroke={stroke}
          strokeOpacity={opacity}
          strokeWidth={0.07}
        />
        <circle
          r={R + 0.13}
          fill="none"
          stroke={stroke}
          strokeOpacity={opacity * 0.6}
          strokeWidth={0.03}
        />
      </g>
    );
  }
  if (node.kind === 'great') {
    return (
      <g>
        <circle
          r={R + 0.13}
          fill="none"
          stroke={stroke}
          strokeOpacity={opacity}
          strokeWidth={0.045}
        />
        {Array.from({ length: 8 }, (_, i) => {
          const a = polar(R + 0.13, i * 45 - 90);
          const b = polar(R + 0.33, i * 45 - 90);
          return (
            <line
              key={i}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={stroke}
              strokeOpacity={opacity}
              strokeWidth={0.06}
              strokeLinecap="round"
            />
          );
        })}
      </g>
    );
  }
  if (node.kind === 'start') {
    return (
      <g>
        {Array.from({ length: 8 }, (_, i) => {
          const long = i % 2 === 0;
          const a = polar(R * 0.9, i * 45 - 90);
          const b = polar(R + (long ? 0.42 : 0.22), i * 45 - 90);
          return (
            <line
              key={i}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={STARLIGHT.color}
              strokeWidth={long ? 0.07 : 0.045}
              strokeLinecap="round"
            />
          );
        })}
      </g>
    );
  }
  return null;
}

function MarkRing({ mark, R }: { mark: Exclude<Mark, null>; R: number }) {
  switch (mark) {
    case 'path':
      return (
        <circle
          r={R + 0.13}
          fill="none"
          stroke={STARLIGHT.light}
          strokeWidth={0.05}
          strokeDasharray="0.1 0.07"
        />
      );
    case 'target':
      return (
        <>
          <circle r={R + 0.2} fill="none" stroke={STARLIGHT.light} strokeWidth={0.08} />
          <circle
            r={R + 0.36}
            fill="none"
            stroke={STARLIGHT.light}
            strokeOpacity={0.35}
            strokeWidth={0.04}
          />
        </>
      );
    case 'short':
      return (
        <circle
          r={R + 0.13}
          fill="none"
          stroke={THREAT}
          strokeWidth={0.05}
          strokeDasharray="0.1 0.07"
        />
      );
    case 'shortTarget':
      return <circle r={R + 0.2} fill="none" stroke={THREAT} strokeWidth={0.08} />;
    case 'hang':
      return (
        <circle
          r={R + 0.14}
          fill="none"
          stroke={THREAT}
          strokeWidth={0.06}
          strokeDasharray="0.12 0.07"
        />
      );
    case 'mine':
      return (
        <circle
          r={R + 0.2}
          fill="none"
          stroke={GIVE}
          strokeWidth={0.07}
          strokeDasharray="0.14 0.08"
        />
      );
    case 'held':
      return <circle r={R + 0.2} fill="none" stroke={THREAT} strokeWidth={0.08} />;
  }
}

/** Where a landmark's name goes: beside a rim star, away from the axis it's nearest. */
function namePlace(node: AstrolabeNode): {
  x: number;
  y: number;
  anchor: 'start' | 'middle' | 'end';
} {
  const p = starAt(node);
  const R = STAR_RADIUS[node.kind] + 0.5;
  if (Math.abs(p.x) > Math.abs(p.y)) {
    // East or west: above or below, away from the horizon.
    return { x: p.x, y: p.y + Math.sign(p.y) * (R + 0.22), anchor: 'middle' };
  }
  return { x: p.x + Math.sign(p.x) * R, y: p.y + 0.15, anchor: p.x > 0 ? 'start' : 'end' };
}

/** The landmarks' names: keystones and great notables, at the rim. */
function Names({ tree }: { tree: readonly string[] }) {
  const owned = new Set(tree);
  return (
    <g aria-hidden pointerEvents="none">
      {STARS.filter((n) => n.kind === 'keystone' || n.kind === 'great').map((n) => {
        const at = namePlace(n);
        const look = constellationLook(n.constellation);
        const lit = owned.has(n.id);
        return (
          <text
            key={n.id}
            x={at.x}
            y={at.y}
            textAnchor={at.anchor}
            fontFamily="var(--font-display)"
            fontSize={0.38}
            fontWeight={700}
            fill={lit ? look.light : look.color}
            fillOpacity={lit ? 1 : 0.8}
            stroke="#070b1b"
            strokeWidth={0.12}
            paintOrder="stroke"
          >
            {n.name}
          </text>
        );
      })}
    </g>
  );
}
