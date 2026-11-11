import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { ColorVision } from '../../app/colorVision';
import { useProfile } from '../../app/profileStore';
import { useSettings } from '../../app/settings';
import { fitThreadLook } from '../../app/threadLook';
import { heroDef } from '../../content';
import { rosterHeroes, type Bond } from '../../meta/bonds';
import type { Reliquary } from '../../meta/reliquary';
import { BOND_LOOK, heroInk } from '../kit/bondLook';
import { Button } from '../kit/Button';
import { Icon, iconPath } from '../kit/Icon';
import {
  LOOM_SOUNDS,
  STATION_LOOK,
  THREAD_MODES,
  type StationId,
  type ThreadColors,
} from '../kit/loomLook';
import { Modal } from '../kit/Modal';
import { SHARD_LOOK, TEAR_LOOK } from '../kit/reliquaryLook';
import { playUi } from '../kit/sound';
import { bondRanks } from './bondsModel';
import type { StationIntro, StationView } from './loomModel';
import { t } from '../text';

/** A dark station: slate lines, no glow (still clear: its name and line are full text). */
const DARK = { stroke: '#3d4c7d', tint: '#2a3760', light: '#4a5a8e' } as const;

/** The scene's motion (all of it stops under reduced motion: the stylesheet, and `still`). */
export const LOOM_CSS = `
@keyframes loom-wheel { to { transform: rotate(360deg); } }
@keyframes loom-fresh { 0%, 100% { opacity: 0.25; } 50% { opacity: 1; } }
@keyframes loom-flow { to { stroke-dashoffset: -64; } }
@keyframes loom-swirl { to { transform: rotate(-360deg); } }
.loom-halo * { stroke-width: 6px; stroke-opacity: 0.16; fill-opacity: 0; }
`;

// ── Where each station stands in the hall (lg and up), in % of the scene ──────────────

export interface Place {
  x: number;
  y: number;
}

/**
 * The hall seen from its floor: the Gate in the apse's centre, the back wall's alcoves on either
 * side (the Astrolabe and the Hall of Deeds, Dissonance and the Reliquary), the side walls (the
 * Codex, Bonds), and the front corners (the Training Grounds, the Atelier). The Weaver stands
 * on the dais before the Gate.
 */
export const PLACES: Readonly<Record<StationId | 'weaver', Place>> = {
  astrolabe: { x: 10.5, y: 25 },
  deeds: { x: 29, y: 17 },
  gate: { x: 50, y: 25 },
  dissonance: { x: 71, y: 17 },
  // Phase 6 (decision 13): the Atlas of Echoes, below Dissonance, between it and Bonds.
  atlas: { x: 71, y: 49 },
  reliquary: { x: 89.5, y: 25 },
  codex: { x: 10, y: 58 },
  bonds: { x: 90, y: 58 },
  training: { x: 23, y: 86 },
  atelier: { x: 77, y: 86 },
  weaver: { x: 50, y: 72 },
};

/** Where the Weaver's threads leave from: her hands, on the dais. */
const HANDS: Place = { x: 50, y: 70 };

/** A station's place as CSS variables (the classes put it there from `lg`). */
export function placeStyle(id: StationId | 'weaver'): CSSProperties {
  const p = PLACES[id];
  return { '--x': `${p.x}%`, '--y': `${p.y}%` } as CSSProperties;
}

// ── The stations, drawn ───────────────────────────────────────────────────────────────

interface ArtInk {
  /** Lines. */
  ink: string;
  /** Soft fills (at low opacity). */
  tint: string;
  /** Highlights. */
  light: string;
  still: boolean;
}

/** A 4-point star at (x, y), radius r. */
function sparkle(x: number, y: number, r: number): string {
  const k = r * 0.28;
  return `M${x} ${y - r} L${x + k} ${y - k} L${x + r} ${y} L${x + k} ${y + k} L${x} ${y + r} L${x - k} ${y + k} L${x - r} ${y} L${x - k} ${y - k} Z`;
}

/** A 5-point star at (x, y), radius r (the Hall's banners). */
function star5(x: number, y: number, r: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r : r * 0.45;
    pts.push(`${(x + rr * Math.cos(a)).toFixed(2)} ${(y + rr * Math.sin(a)).toFixed(2)}`);
  }
  return `M${pts.join(' L')} Z`;
}

/** Each station's object, standing in its alcove (a 120 × 100 box, the floor at y 92). */
const OBJECTS: Readonly<Record<Exclude<StationId, 'gate'>, (c: ArtInk) => ReactNode>> = {
  // A practice dummy with a target on its chest, and the drill's training bell on its frame.
  training: (c) => (
    <>
      <path d="M44 92 V45 M33 58 H55 M36 92 H52" />
      <circle cx={44} cy={38} r={7} fill={c.tint} fillOpacity={0.25} />
      <circle cx={44} cy={67} r={9} fill={c.tint} fillOpacity={0.22} />
      <circle cx={44} cy={67} r={3.5} fill={c.light} stroke="none" />
      <path d="M70 92 V49 Q80 41 90 49 V92 M80 46 V55" />
      <path
        d="M73.5 69 C73.5 58 86.5 58 86.5 69 L88.5 74 H71.5 Z"
        fill={c.tint}
        fillOpacity={0.3}
      />
      <circle cx={80} cy={77} r={1.8} fill={c.ink} stroke="none" />
    </>
  ),
  // A lectern with the open book on it, the pages lit.
  codex: (c) => (
    <>
      <path d="M60 92 V66 M48 92 H72 M52 92 Q60 86 68 92" />
      <path d="M40 66 H80 L75 60 H45 Z" fill={c.tint} fillOpacity={0.25} />
      <path
        d="M60 59 C53 52 46 51 39 55 L43 42 C49 39 55 40 60 46 Z M60 59 C67 52 74 51 81 55 L77 42 C71 39 65 40 60 46 Z"
        fill={c.light}
        fillOpacity={0.22}
      />
      <path d="M60 46 V59" />
      <path
        d="M46 47 L56 49 M45 51 L55 53 M64 49 L74 47 M65 53 L75 51"
        strokeWidth={1}
        strokeOpacity={0.7}
      />
      <path d={sparkle(60, 30, 5)} fill={c.light} stroke="none" />
    </>
  ),
  // An armillary sphere on its stand, the Weaver's Star at its heart.
  astrolabe: (c) => (
    <>
      <path d="M60 92 V76 M47 92 H73 M51 92 Q60 83 69 92" />
      <circle cx={60} cy={52} r={23} fill={c.tint} fillOpacity={0.12} />
      <ellipse cx={60} cy={52} rx={23} ry={8} transform="rotate(-24 60 52)" />
      <ellipse cx={60} cy={52} rx={23} ry={8} transform="rotate(30 60 52)" />
      <ellipse cx={60} cy={52} rx={8} ry={23} strokeOpacity={0.7} />
      <path d={sparkle(60, 52, 8)} fill={c.light} stroke="none" />
    </>
  ),
  // A dress form in a draped sash, a spool whose thread climbs to it, a needle.
  atelier: (c) => (
    <>
      <path
        d="M50 34 C56 31 64 31 70 34 C73 42 70 49 67 53 C72 58 73 66 71 74 H49 C47 66 48 58 53 53 C50 49 47 42 50 34 Z"
        fill={c.tint}
        fillOpacity={0.25}
      />
      <circle cx={60} cy={30} r={2.4} />
      <path d="M60 74 V86 M51 92 L60 86 L69 92" />
      <path d="M52 40 C58 47 64 57 66 72" stroke={c.light} strokeWidth={2.6} />
      <rect x={80} y={80} width={12} height={11} rx={2} fill={c.tint} fillOpacity={0.3} />
      <path d="M78 80 H94 M78 91 H94" />
      <path d="M86 80 C90 64 83 51 70 47" stroke={c.light} strokeDasharray="2 3" />
      <path d="M27 63 L40 50" />
      <circle cx={38.6} cy={51.4} r={1.1} />
    </>
  ),
  // A shrine on its plinth, a relic aglow within, candles either side.
  reliquary: (c) => (
    <>
      <path d="M38 92 H82 M42 92 V86 H78 V92" />
      <path d="M46 86 V55 A14 14 0 0 1 74 55 V86 Z" fill={c.tint} fillOpacity={0.25} />
      <path d="M60 41 V35 M57 37.5 H63" />
      <path d="M60 59 L67 68 L60 77 L53 68 Z" fill={c.light} fillOpacity={0.85} />
      <path d="M31 92 V79 M89 92 V79" strokeWidth={3} />
      <path
        d="M31 75 C29 73 30.5 70 31 68.5 C32 70.5 33 73 31 75 Z M89 75 C87 73 88.5 70 89 68.5 C90 70.5 91 73 89 75 Z"
        fill={c.light}
        stroke="none"
      />
    </>
  ),
  // A hearth: crossed logs, the fire, and two rings linked above it.
  bonds: (c) => (
    <>
      <path d="M41 92 L79 84 M41 84 L79 92" strokeWidth={3} />
      <path
        d="M60 86 C50 78 52 66 60 56 C61 64 70 68 67 78 C66 83 63 86 60 86 Z"
        fill={c.tint}
        fillOpacity={0.35}
      />
      <path
        d="M60 84 C56 80 57 74 60 70 C62 74 65 77 63 81 C62 83 61 84 60 84 Z"
        fill={c.light}
        stroke="none"
      />
      <circle cx={53} cy={36} r={8} />
      <circle cx={67} cy={36} r={8} />
    </>
  ),
  // Three banners on a rod, each with its star; the middle one longest.
  deeds: (c) => (
    <>
      <path d="M27 33 H93" />
      <circle cx={26} cy={33} r={2} fill={c.ink} />
      <circle cx={94} cy={33} r={2} fill={c.ink} />
      <path
        d="M34 33 V66 L40 60 L46 66 V33 M53 33 V77 L60 70 L67 77 V33 M74 33 V66 L80 60 L86 66 V33"
        fill={c.tint}
        fillOpacity={0.25}
      />
      <path d={star5(40, 45, 4)} fill={c.light} stroke="none" />
      <path d={star5(60, 49, 5.5)} fill={c.light} stroke="none" />
      <path d={star5(80, 45, 4)} fill={c.light} stroke="none" />
    </>
  ),
  // A cracked bell, its sound breaking into jagged waves.
  dissonance: (c) => (
    <>
      <path d="M60 37 V31 M40 92 H80" />
      <path
        d="M48 73 C48 51 52 41 60 39 C68 41 72 51 72 73 L76 79 H44 Z"
        fill={c.tint}
        fillOpacity={0.28}
      />
      <path d="M62 43 L57 55 L63 62 L58 73" stroke={c.light} strokeWidth={1.6} />
      <circle cx={60} cy={83} r={2.2} fill={c.ink} stroke="none" />
      <path d="M22 59 L26 51 L30 65 L34 53 L38 59 M82 59 L86 53 L90 65 L94 51 L98 59" />
    </>
  ),
  // Phase 6: the Atlas of Echoes, a star chart on its easel: three constellations, their lines.
  atlas: (c) => (
    <>
      <path d="M44 92 L52 72 M76 92 L68 72 M60 92 V72" />
      <rect x={30} y={34} width={60} height={38} rx={3} fill={c.tint} fillOpacity={0.18} />
      <path d="M37 62 L44 46 L51 58 M57 50 L64 40 L70 54 M74 60 L80 44 L85 56" strokeWidth={1.4} />
      {(
        [
          [37, 62],
          [44, 46],
          [51, 58],
          [57, 50],
          [64, 40],
          [70, 54],
          [74, 60],
          [80, 44],
          [85, 56],
        ] as const
      ).map(([x, y], i) => (
        <path key={i} d={sparkle(x, y, 3)} fill={c.light} stroke="none" />
      ))}
    </>
  ),
};

/** The alcove every station but the Gate stands in: a round arch on the floor. */
const ALCOVE = 'M16 98 V46 A44 44 0 0 1 104 46 V98';

/**
 * A station, drawn (Phase 4g): its object in its alcove, lit in its own colour with a glow, or
 * dark (slate lines, a lock). A station that has just lit up (`fresh`) pulses a second rim. The
 * Gate is its own, larger: an arched portal swirling with stars, its doors open.
 */
export function StationArt({
  id,
  lit,
  fresh = false,
  still = false,
  width = 120,
}: {
  id: StationId;
  lit: boolean;
  fresh?: boolean;
  still?: boolean;
  width?: number;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const look = STATION_LOOK[id];
  const c: ArtInk = lit
    ? { ink: look.color, tint: look.color, light: look.light, still }
    : { ink: DARK.stroke, tint: DARK.tint, light: DARK.light, still };
  if (id === 'gate') return <GateArt width={width} still={still} uid={uid} />;
  const glow = `glow-${uid}`;
  return (
    <svg
      viewBox="0 0 120 100"
      width={width}
      height={(width * 100) / 120}
      fill="none"
      stroke={c.ink}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="overflow-visible"
      aria-hidden
      focusable="false"
    >
      <defs>
        <radialGradient id={glow} cx="50%" cy="62%" r="60%">
          <stop
            offset="0%"
            stopColor={lit ? look.color : DARK.tint}
            stopOpacity={lit ? 0.3 : 0.35}
          />
          <stop offset="100%" stopColor={lit ? look.color : DARK.tint} stopOpacity={0.04} />
        </radialGradient>
      </defs>
      <path d={`${ALCOVE} Z`} fill={`url(#${glow})`} stroke="none" />
      {/* Dark, the alcove is only sketched in: a dashed arch, a place still to come. */}
      <path
        d={ALCOVE}
        strokeWidth={2.2}
        strokeOpacity={lit ? 0.8 : 1}
        strokeDasharray={lit ? undefined : '5 5'}
      />
      {fresh && (
        <path
          d="M10 98 V46 A50 50 0 0 1 110 46 V98"
          stroke={look.light}
          strokeWidth={2.5}
          style={{ animation: still ? undefined : 'loom-fresh 1.6s ease-in-out infinite' }}
          data-testid="station-fresh-rim"
        />
      )}
      <path d="M8 98 H112" strokeOpacity={0.5} />
      {/* Lit, the object glows: itself again, wide and faint, beneath (no filter to repaint). */}
      {lit && <g className="loom-halo">{OBJECTS[id](c)}</g>}
      <g style={lit ? undefined : { opacity: 0.4 }}>{OBJECTS[id](c)}</g>
      {/* Dark: a large lock on the alcove, over its faint object. */}
      {!lit && (
        <g transform="translate(60 60)" data-testid="station-lock">
          <circle r={17} fill="#0a1022" fillOpacity={0.92} stroke={DARK.light} strokeWidth={1.6} />
          <path
            d="M-6 -1.5 V-5.5 a6 6 0 0 1 12 0 V-1.5 M-8.5 -1.5 h17 v12 h-17 z M0 3 v3"
            stroke="#a3acc7"
            strokeWidth={2}
          />
        </g>
      )}
    </svg>
  );
}

/** The Gate: an arched portal swirling with stars, its doors open, steps before it. */
function GateArt({ width, still, uid }: { width: number; still: boolean; uid: string }) {
  const look = STATION_LOOK.gate;
  const portal = `portal-${uid}`;
  return (
    <svg
      viewBox="0 0 160 150"
      width={width}
      height={(width * 150) / 160}
      fill="none"
      stroke={look.color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="overflow-visible"
      aria-hidden
      focusable="false"
    >
      <defs>
        <radialGradient id={portal} cx="50%" cy="58%" r="60%">
          <stop offset="0%" stopColor={look.light} stopOpacity={0.95} />
          <stop offset="35%" stopColor={look.color} stopOpacity={0.55} />
          <stop offset="100%" stopColor="#0a1022" stopOpacity={0.95} />
        </radialGradient>
      </defs>
      <path d="M16 146 H144 M24 140 H136" strokeOpacity={0.7} />
      <path
        d="M44 139 V70 C44 42 60 28 80 26 C100 28 116 42 116 70 V139 Z"
        fill={`url(#${portal})`}
      />
      <g
        style={{
          transformOrigin: '80px 84px',
          animation: still ? undefined : 'loom-swirl 40s linear infinite',
        }}
        stroke={look.light}
        strokeOpacity={0.55}
        strokeWidth={1.4}
      >
        <path d="M80 84 m-3 0 a3 3 0 1 1 6 0 a7 7 0 1 1 -14 0 a11 11 0 1 1 22 0 a15 15 0 1 1 -30 0 a19 19 0 1 1 38 0" />
      </g>
      {[
        [62, 58],
        [97, 64],
        [70, 112],
        [94, 104],
        [58, 92],
      ].map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r={1.2} fill="#ffffff" stroke="none" />
      ))}
      <path
        d="M44 72 L32 79 V143 L44 139 Z M116 72 L128 79 V143 L116 139 Z"
        fill={look.color}
        fillOpacity={0.16}
        strokeOpacity={0.8}
      />
      <path
        d="M30 140 V66 C30 30 52 14 80 12 C108 14 130 30 130 66 V140"
        strokeWidth={10}
        strokeOpacity={0.15}
      />
      <path d="M30 140 V66 C30 30 52 14 80 12 C108 14 130 30 130 66 V140" strokeWidth={3.2} />
      <path d="M80 4 L86 11 L80 18 L74 11 Z" fill={look.color} stroke="none" />
    </svg>
  );
}

/** The Loom itself, the hub's great wheel: the welcome's first panel draws it. */
export function LoomWheel({ size = 120, still = false }: { size?: number; still?: boolean }) {
  return (
    <svg viewBox="-60 -60 120 120" width={size} height={size} aria-hidden focusable="false">
      <g
        fill="none"
        stroke="var(--color-gold-300)"
        style={{ animation: still ? undefined : 'loom-wheel 90s linear infinite' }}
      >
        <circle r={54} strokeWidth={1.6} />
        <circle r={44} strokeWidth={1} strokeDasharray="5 4" />
        <circle r={28} strokeWidth={1.2} />
        <circle r={10} strokeWidth={1.6} fill="var(--color-gold-400)" fillOpacity={0.3} />
        {Array.from({ length: 24 }, (_, i) => {
          const a = (i * Math.PI) / 12;
          return (
            <line
              key={i}
              x1={Math.round(10 * Math.cos(a) * 100) / 100}
              y1={Math.round(10 * Math.sin(a) * 100) / 100}
              x2={Math.round(54 * Math.cos(a) * 100) / 100}
              y2={Math.round(54 * Math.sin(a) * 100) / 100}
              strokeWidth={0.7}
              strokeOpacity={0.7}
            />
          );
        })}
      </g>
    </svg>
  );
}

// ── The hall ──────────────────────────────────────────────────────────────────────────

/**
 * The sanctum behind the stations (from `lg`): the apse's wall, its rose window that is the Loom
 * itself (warp threads round a hub), light falling from it onto the dais, pillars between the
 * alcoves, the floor's woven rings. Drawn faint, so the stations read first, and still: the
 * backdrop's star map turns behind it, and a repaint of the whole hall every frame would cost
 * more than it shows.
 */
export function SanctumBackdrop() {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const g = (n: string) => `${n}-${uid}`;
  return (
    <svg
      viewBox="0 0 1600 900"
      preserveAspectRatio="xMidYMid slice"
      className="pointer-events-none absolute inset-0 hidden h-full w-full lg:block"
      aria-hidden
      focusable="false"
    >
      <defs>
        <linearGradient id={g('wall')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1b2647" stopOpacity={0.15} />
          <stop offset="70%" stopColor="#111a33" stopOpacity={0.55} />
          <stop offset="100%" stopColor="#0a1022" stopOpacity={0.75} />
        </linearGradient>
        <radialGradient id={g('rose')}>
          <stop offset="0%" stopColor="#f5b83d" stopOpacity={0.3} />
          <stop offset="100%" stopColor="#f5b83d" stopOpacity={0} />
        </radialGradient>
        <linearGradient id={g('ray')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fde9b8" stopOpacity={0.1} />
          <stop offset="100%" stopColor="#fde9b8" stopOpacity={0} />
        </linearGradient>
        <radialGradient id={g('dais')}>
          <stop offset="0%" stopColor="#f5b83d" stopOpacity={0.14} />
          <stop offset="100%" stopColor="#f5b83d" stopOpacity={0} />
        </radialGradient>
      </defs>
      <path
        d="M70 900 V340 Q70 70 800 52 Q1530 70 1530 340 V900 Z"
        fill={`url(#${g('wall')})`}
        stroke="#f5b83d"
        strokeOpacity={0.16}
        strokeWidth={2}
      />
      <path
        d="M130 900 V350 Q130 120 800 104 Q1470 120 1470 350 V900"
        fill="none"
        stroke="#f5b83d"
        strokeOpacity={0.08}
        strokeWidth={1.5}
      />
      {[300, 560, 1040, 1300].map((x) => (
        <g key={x} stroke="#f5b83d" strokeOpacity={0.12}>
          <path
            d={`M${x - 15} 650 L${x - 10} 205 H${x + 10} L${x + 15} 650 Z`}
            fill="#1b2647"
            fillOpacity={0.35}
          />
          <path
            d={`M${x - 22} 205 H${x + 22} L${x + 14} 192 H${x - 14} Z`}
            fill="#1b2647"
            fillOpacity={0.5}
          />
          <path d={`M${x - 22} 650 H${x + 22}`} />
        </g>
      ))}
      <path d="M690 230 L470 900 H1130 L910 230 Z" fill={`url(#${g('ray')})`} />
      <circle cx={800} cy={150} r={170} fill={`url(#${g('rose')})`} />
      <g transform="translate(800 150)" fill="none" stroke="#f5b83d" strokeOpacity={0.32}>
        <g>
          <circle r={104} strokeWidth={2} />
          <circle r={86} strokeWidth={1} strokeDasharray="7 6" />
          <circle r={58} strokeWidth={1.4} />
          <circle r={20} strokeWidth={2} />
          {Array.from({ length: 32 }, (_, i) => {
            const a = (i * Math.PI) / 16;
            return (
              <line
                key={i}
                x1={Math.round(20 * Math.cos(a) * 10) / 10}
                y1={Math.round(20 * Math.sin(a) * 10) / 10}
                x2={Math.round(104 * Math.cos(a) * 10) / 10}
                y2={Math.round(104 * Math.sin(a) * 10) / 10}
                strokeWidth={0.8}
              />
            );
          })}
        </g>
      </g>
      <path d="M0 650 H1600" stroke="#f5b83d" strokeOpacity={0.1} />
      {[-640, -400, -180, 0, 180, 400, 640].map((dx) => (
        <path
          key={dx}
          d={`M${800 + dx * 0.32} 650 L${800 + dx * 1.6} 900`}
          stroke="#f5b83d"
          strokeOpacity={0.06}
        />
      ))}
      <ellipse cx={800} cy={790} rx={420} ry={100} fill={`url(#${g('dais')})`} />
      <ellipse
        cx={800}
        cy={790}
        rx={330}
        ry={76}
        fill="none"
        stroke="#f5b83d"
        strokeOpacity={0.2}
      />
      <ellipse
        cx={800}
        cy={790}
        rx={250}
        ry={56}
        fill="none"
        stroke="#f5b83d"
        strokeOpacity={0.14}
        strokeDasharray="10 8"
      />
    </svg>
  );
}

/**
 * The Weaver's threads to each station (from `lg`), from her hands across the floor: gold and
 * flowing to a lit station, brighter to one that has just lit, a faint dashed line to a dark one.
 */
export function LoomThreads({
  stations,
  still = false,
}: {
  stations: readonly StationView[];
  still?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-0 hidden h-full w-full lg:block"
      aria-hidden
      focusable="false"
      data-testid="loom-threads"
    >
      {stations.map((s) => {
        const to = PLACES[s.id];
        const ty = s.id === 'gate' ? to.y + 14 : to.y - 1.5;
        // Bow each thread up from the hands, then across to its station.
        const cx = HANDS.x + (to.x - HANDS.x) * 0.45;
        const cy = Math.min(HANDS.y, ty) - 10;
        const d = `M${HANDS.x} ${HANDS.y} Q${cx} ${cy} ${to.x} ${ty}`;
        const look = STATION_LOOK[s.id];
        if (!s.open)
          return (
            <path
              key={s.id}
              d={d}
              fill="none"
              stroke={DARK.stroke}
              strokeOpacity={0.55}
              strokeWidth={1}
              strokeDasharray="2 6"
              vectorEffect="non-scaling-stroke"
              data-thread={s.id}
              data-lit="false"
            />
          );
        return (
          <g key={s.id} data-thread={s.id} data-lit="true">
            <path
              d={d}
              fill="none"
              stroke={look.color}
              strokeOpacity={s.fresh ? 0.3 : 0.12}
              strokeWidth={s.fresh ? 6 : 4}
              vectorEffect="non-scaling-stroke"
            />
            <path
              d={d}
              fill="none"
              stroke={s.fresh ? look.light : 'var(--color-gold-300)'}
              strokeOpacity={s.fresh ? 0.95 : 0.5}
              strokeWidth={s.fresh ? 1.8 : 1.2}
              strokeDasharray="14 18"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
              style={{
                animation: still || !s.fresh ? undefined : 'loom-flow 2.2s linear infinite',
              }}
            />
          </g>
        );
      })}
    </svg>
  );
}

// ── What waits at a station ───────────────────────────────────────────────────────────

/**
 * A lit station's badge, as the Title drew them: the Astrolabe's points to spend (gold), the
 * Reliquary's materials (their glyphs), each hero's Bond rank (their initial in their colour);
 * the rest as words.
 */
export function StationBadge({
  view,
  reliquary,
  bonds,
  heroes,
}: {
  view: StationView;
  reliquary: Pick<Reliquary, 'shards' | 'tears'>;
  bonds: Readonly<Record<string, Bond>>;
  /** The Bonded heroes the player has (docs/phase-5b.md); omitted, the profile's roster. */
  heroes?: readonly string[];
}) {
  const recruited = useProfile((s) => s.profile.recruited);
  const unlockAll = useSettings((s) => s.settings.unlockAll);
  if (!view.badge) return null;
  if (view.id === 'bonds') {
    // Each hero by name, in their colour, with their Bond rank: "Kael 2 · Lyra 2 · Vexis 2".
    // Phase 5e: a roster of four to six wraps inside its station (each hero whole on a line)
    // rather than running past it on one.
    const ranks = Object.entries(
      bondRanks(bonds, heroes ?? rosterHeroes({ recruited }, unlockAll)),
    );
    return (
      <span
        className="flex max-w-full flex-wrap items-center justify-center gap-x-1 rounded-md border bg-ink-900/80 px-2 py-0.5 text-xs font-semibold"
        style={{ borderColor: `color-mix(in srgb, ${BOND_LOOK.color} 40%, transparent)` }}
        data-testid="station-badge"
        aria-hidden
      >
        {ranks.map(([heroId, r], i) => (
          <span key={heroId} className="flex items-center gap-1 whitespace-nowrap">
            {i > 0 && <span className="text-muted">·</span>}
            <span style={{ color: heroInk(heroId) }}>{heroDef(heroId).name}</span>
            <span className="font-mono text-text">{r}</span>
          </span>
        ))}
      </span>
    );
  }
  if (view.id === 'reliquary') {
    // The materials with their glyphs and their names: "34 Shards · 1 Tear".
    return (
      <span
        className="flex items-center gap-1.5 whitespace-nowrap rounded-md border border-ink-500 bg-ink-900/80 px-2 py-0.5 text-xs font-semibold text-text"
        data-testid="station-badge"
        aria-hidden
      >
        {reliquary.shards > 0 && (
          <span className="flex items-center gap-1">
            <Icon name="shard" size={13} style={{ color: SHARD_LOOK.color }} />
            <span className="font-mono">{reliquary.shards}</span>{' '}
            {reliquary.shards === 1 ? t('screens.loomParts.shard') : t('screens.loomParts.shards')}
          </span>
        )}
        {reliquary.shards > 0 && reliquary.tears > 0 && <span className="text-muted">·</span>}
        {reliquary.tears > 0 && (
          <span className="flex items-center gap-1">
            <Icon name="tear" size={13} style={{ color: TEAR_LOOK.color }} />
            <span className="font-mono">{reliquary.tears}</span>{' '}
            {reliquary.tears === 1 ? t('screens.loomParts.tear') : t('screens.loomParts.tears')}
          </span>
        )}
      </span>
    );
  }
  const look = STATION_LOOK[view.id];
  return (
    <span
      className="whitespace-nowrap rounded-md border px-2 py-0.5 text-xs font-semibold"
      style={{
        color: look.light,
        borderColor: `color-mix(in srgb, ${look.color} 60%, transparent)`,
        background: `color-mix(in srgb, ${look.color} 14%, rgb(10 16 34 / 0.8))`,
      }}
      data-testid="station-badge"
      aria-hidden
    >
      {view.badge}
    </span>
  );
}

// ── The first-contact intro ───────────────────────────────────────────────────────────

/**
 * A station's first-contact intro (Phase 4g): two or three short panels, each with the station
 * drawn beside it; Next and Back (or the arrows) turn them, and the last offers "Try it", which
 * opens the station. Later (or Esc) closes it. Either way it counts as seen: the caller records
 * `intro.seen` (`markIntroduced`).
 */
export function StationIntroDialog({
  intro,
  onClose,
  onTry,
  still = false,
  initialPanel = 0,
}: {
  intro: StationIntro;
  onClose(): void;
  onTry(): void;
  still?: boolean;
  /** UI lab: open at a later panel. */
  initialPanel?: number;
}) {
  const [at, setAt] = useState(Math.min(initialPanel, intro.panels.length - 1));
  const box = useRef<HTMLDivElement>(null);
  const first = useRef(true);
  const panel = intro.panels[at]!;
  const last = at === intro.panels.length - 1;
  const look = STATION_LOOK[intro.station];
  useEffect(() => {
    // The Modal focuses on open; each later panel puts focus back on its main button.
    if (first.current) {
      first.current = false;
      return;
    }
    box.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus();
  }, [at]);
  const turn = (to: number) => {
    if (to < 0 || to >= intro.panels.length || to === at) return;
    playUi(LOOM_SOUNDS.page);
    setAt(to);
  };
  return (
    <Modal title={intro.title} onClose={onClose} closeOnEscape width="max-w-xl">
      <div
        ref={box}
        data-testid="station-intro"
        data-intro={intro.station}
        data-panel={at}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') turn(at + 1);
          else if (e.key === 'ArrowLeft') turn(at - 1);
          else return;
          e.preventDefault();
        }}
      >
        <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row sm:items-start">
          <div className="flex shrink-0 items-end justify-center gap-1" aria-hidden>
            {panel.art.length === 0 ? (
              <LoomWheel size={124} still={still} />
            ) : (
              panel.art.map((a) => (
                <StationArt
                  key={a}
                  id={a}
                  lit
                  still={still}
                  width={panel.art.length > 1 ? 96 : a === 'gate' ? 132 : 128}
                />
              ))
            )}
          </div>
          <div className="min-w-0" aria-live="polite">
            <p className="font-mono text-xs uppercase tracking-[0.25em] text-muted">
              {t('screens.loomParts.of', { value: at + 1, length: intro.panels.length })}
            </p>
            <h3
              className="mt-1 font-display text-xl font-bold tracking-wide"
              style={{ color: look.light }}
            >
              {panel.heading}
            </h3>
            <p className="mt-1.5 text-sm leading-relaxed text-text" data-testid="intro-body">
              {panel.body}
            </p>
          </div>
        </div>
        <div className="mt-4 flex justify-center gap-1.5" aria-hidden>
          {intro.panels.map((p, i) => (
            <span
              key={p.heading}
              className="h-1.5 w-6 rounded-full"
              style={{ background: i <= at ? look.color : 'var(--color-ink-600)' }}
            />
          ))}
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            sound="back"
            data-testid="intro-later"
          >
            {t('screens.loomParts.later')}
          </Button>
          <div className="flex gap-2">
            {at > 0 && (
              <Button size="sm" onClick={() => turn(at - 1)} sound={null}>
                <Icon name="back" size={15} /> {t('screens.loomParts.back')}
              </Button>
            )}
            {last ? (
              <Button
                variant="primary"
                onClick={onTry}
                sound="confirm"
                data-autofocus
                data-testid="intro-try"
              >
                {intro.tryIt} <Icon name="arrow" size={16} />
              </Button>
            ) : (
              <Button
                variant="primary"
                onClick={() => turn(at + 1)}
                sound={null}
                data-autofocus
                data-testid="intro-next"
              >
                {t('screens.loomParts.next')} <Icon name="arrow" size={16} />
              </Button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ── The Atelier's Thread preview ──────────────────────────────────────────────────────

/**
 * A Thread look beside Mend's and Empower's colours (Phase 4g): the Thread from the Weaver's hand
 * to a hero, once in each mode. The look's glow and filament are the strand; beads in the mode's
 * colour run along it and the hero wears the mode's glyph, so the Thread still says which it is.
 * The Thread's own look (null) is the mode's colour all through, as in the fight. Under a
 * colour-vision palette the look is fitted as the fight fits it (app/threadLook.ts), clear of the
 * modes' colours.
 */
export function ThreadPreview({
  look,
  still = false,
  vision,
}: {
  look: ThreadColors | null;
  still?: boolean;
  /** The colour vision to draw it in (default: the player's setting). */
  vision?: ColorVision;
}) {
  const setting = useSettings((s) => s.settings.colorVision);
  const fitted = look ? fitThreadLook(look, vision ?? setting) : null;
  return (
    <ul className="flex flex-col gap-1.5" data-testid="thread-preview">
      {THREAD_MODES.map((m) => {
        const filament = fitted?.filament ?? m.color;
        const glow = fitted?.glow ?? m.color;
        const d = 'M14 22 C60 4 96 40 140 20 S206 10 226 22';
        return (
          <li key={m.mode} className="flex items-center gap-2" data-mode={m.mode}>
            <svg viewBox="0 0 240 44" className="h-11 min-w-0 flex-1" aria-hidden focusable="false">
              <circle cx={14} cy={22} r={5} fill="#fff1c4" />
              <path
                d={d}
                fill="none"
                stroke={glow}
                strokeOpacity={0.4}
                strokeWidth={7}
                strokeLinecap="round"
              />
              <path d={d} fill="none" stroke={filament} strokeWidth={2.2} strokeLinecap="round" />
              <path
                d={d}
                fill="none"
                stroke={m.color}
                strokeWidth={4.5}
                strokeLinecap="round"
                strokeDasharray="0.1 22"
                style={{ animation: still ? undefined : 'loom-flow 2.8s linear infinite' }}
              />
              <circle cx={226} cy={22} r={11} fill="#0a1022" stroke={m.color} strokeWidth={2} />
              <g
                transform="translate(219 15) scale(0.58)"
                stroke={m.color}
                strokeWidth={2.4}
                fill="none"
              >
                <path d={iconPath(m.icon)} />
              </g>
            </svg>
            <span
              className="flex w-24 shrink-0 items-center gap-1 text-sm font-semibold"
              style={{ color: m.color }}
            >
              <Icon name={m.icon} size={14} /> {m.label}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
