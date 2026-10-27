import { heroDef } from '../../content';
import { callingLook } from '../kit/callingLook';
import { iconPath, type IconName } from '../kit/Icon';
import { clock } from '../kit/format';
import type { EncounterResult } from '../../meta/types';

type MarkerKind = EncounterResult['markers'][number]['kind'];

export const MARKER: Record<MarkerKind, { icon: IconName; label: string; color: string }> = {
  perfect: { icon: 'ward', label: 'Perfect Ward', color: '#fcd98a' },
  save: { icon: 'heart', label: 'Save', color: '#2dd4bf' },
  cleanse: { icon: 'chime', label: 'Chime', color: '#c4b5fd' },
  reel: { icon: 'reel', label: 'Reel', color: '#7dd3fc' },
  // The Chronomancer's Rewind (Phase 3e): its own glyph, in his silver.
  rewind: { icon: 'rewind', label: 'Rewind', color: callingLook('chronomancer').light },
  cue: { icon: 'note', label: 'Cue', color: '#fbbf24' },
  crescendo: { icon: 'sparkle', label: 'Crescendo', color: '#fff1c7' },
  revive: { icon: 'mend', label: 'Revive', color: '#2dd4bf' },
  phase: { icon: 'eye', label: 'Boss phase', color: '#cbd5e1' },
  down: { icon: 'skull', label: 'Hero down', color: '#f43f5e' },
  response: { icon: 'note', label: 'Call answered', color: '#fde68a' },
  hold: { icon: 'heart', label: 'Fermata hold', color: '#e2d6f8' },
};

const DASH = [undefined, '7 4', '2 4', '10 3 2 3'] as const;

export interface TimelineSegment {
  /** Label of the fight (shown on a separator in multi-fight timelines). */
  name?: string;
  duration: number;
  timeline: EncounterResult['timeline'];
  markers: EncounterResult['markers'];
}

/**
 * Party HP over time with the Weaver's interventions marked underneath, like a raid log
 * (docs/plan/04 §6.1). Hero lines differ by dash pattern as well as colour. One or several
 * fights; several are laid end to end with a gap and a separator.
 */
const NARROW = /[iljtfr .,'’]/;
const WIDE = /[mwMW]/;

/** About how wide a name is in the chart's 12-unit type (the sans's letters, roughly). */
function labelWidth(s: string): number {
  let w = 0;
  for (const ch of s)
    w += NARROW.test(ch) ? 3.8 : WIDE.test(ch) ? 10 : ch >= 'A' && ch <= 'Z' ? 8.2 : 6.9;
  return w;
}

/**
 * A fight's name cut to its stretch of the chart, so a short fight's name doesn't run into the
 * next one's. The full name is its tooltip.
 */
function fitLabel(name: string, width: number): string {
  if (labelWidth(name) <= width) return name;
  for (let n = name.length - 1; n >= 3; n--) {
    const cut = `${name.slice(0, n).trimEnd()}…`;
    if (labelWidth(cut) <= width) return cut;
  }
  return '';
}

export function HpTimeline({
  segments,
  heroIds,
  height = 250,
}: {
  segments: TimelineSegment[];
  heroIds: string[];
  height?: number;
}) {
  const W = 880;
  const H = height;
  const padL = 44;
  const padR = 12;
  const padT = segments.length > 1 ? 30 : 12;
  const laneH = 34;
  const plotH = H - padT - laneH - 22;
  const gap = segments.length > 1 ? 8 : 0;
  const total = Math.max(
    1,
    segments.reduce((s, seg) => s + Math.max(seg.duration, 1), 0) + gap * (segments.length - 1),
  );
  const x = (t: number) => padL + (t / total) * (W - padL - padR);
  const y = (hp: number) => padT + (1 - hp) * plotH;

  // A long run has hundreds of markers: keep icons for the moments that matter and reduce
  // the rest to ticks, so the lane stays readable.
  const markerCount = segments.reduce((n, seg) => n + seg.markers.length, 0);
  const dense = markerCount > 28;
  const KEY_KINDS: MarkerKind[] = ['save', 'down', 'crescendo', 'revive', 'phase'];

  let offset = 0;
  const placed = segments.map((seg) => {
    const start = offset;
    offset += Math.max(seg.duration, 1) + gap;
    return { seg, start };
  });

  const ticks: number[] = [];
  const step = total > 400 ? 120 : total > 150 ? 60 : 30;
  for (let t = 0; t <= total; t += step) ticks.push(t);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      role="img"
      aria-label="Party health over time, with your interventions marked"
    >
      {[0, 0.5, 1].map((v) => (
        <g key={v}>
          <line
            x1={padL}
            x2={W - padR}
            y1={y(v)}
            y2={y(v)}
            stroke="var(--color-ink-600)"
            strokeWidth={1}
            strokeDasharray={v === 0.5 ? '3 5' : undefined}
          />
          <text
            x={padL - 8}
            y={y(v) + 4}
            textAnchor="end"
            fontSize={12}
            fill="var(--color-muted)"
            fontFamily="var(--font-mono)"
          >
            {Math.round(v * 100)}%
          </text>
        </g>
      ))}
      {ticks.map((t) => (
        <text
          key={t}
          x={x(t)}
          y={H - 4}
          textAnchor="middle"
          fontSize={12}
          fill="var(--color-muted)"
          fontFamily="var(--font-mono)"
        >
          {clock(t)}
        </text>
      ))}
      {placed.map(({ seg, start }, si) => (
        <g key={si}>
          {segments.length > 1 && (
            <>
              <line
                x1={x(start)}
                x2={x(start)}
                y1={padT - 6}
                y2={padT + plotH + laneH}
                stroke="var(--color-ink-500)"
                strokeWidth={1}
                strokeDasharray="2 3"
              />
              <text
                x={x(start) + 4}
                y={padT - 12}
                fontSize={12}
                fill="var(--color-gold-300)"
                fontFamily="var(--font-sans)"
              >
                <title>{seg.name}</title>
                {fitLabel(
                  seg.name ?? '',
                  (si + 1 < placed.length ? x(placed[si + 1]!.start) : W - padR) - x(start) - 6,
                )}
              </text>
            </>
          )}
          {heroIds.map((id, slot) => {
            const pts = seg.timeline.filter((p) => p.hp[slot] !== undefined);
            if (pts.length < 2) return null;
            const d = pts
              .map(
                (p, i) =>
                  `${i ? 'L' : 'M'} ${x(start + p.time).toFixed(1)} ${y(p.hp[slot]!).toFixed(1)}`,
              )
              .join(' ');
            return (
              <path
                key={id}
                d={d}
                fill="none"
                stroke={heroDef(id).color}
                strokeWidth={2.4}
                strokeDasharray={DASH[slot % DASH.length]}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            );
          })}
          {seg.markers.map((m, i) => {
            const look = MARKER[m.kind];
            const mx = x(start + m.time);
            if (dense && !KEY_KINDS.includes(m.kind)) {
              return (
                <rect
                  key={i}
                  x={mx - 1}
                  y={padT + plotH + 14}
                  width={2}
                  height={12}
                  rx={1}
                  fill={look.color}
                  opacity={0.85}
                >
                  <title>{`${look.label} at ${clock(m.time)}`}</title>
                </rect>
              );
            }
            const tint =
              m.slot !== null && heroIds[m.slot] ? heroDef(heroIds[m.slot]!).color : look.color;
            const who =
              m.slot !== null && heroIds[m.slot] ? ` on ${heroDef(heroIds[m.slot]!).name}` : '';
            return (
              <g key={i}>
                <line
                  x1={mx}
                  x2={mx}
                  y1={padT}
                  y2={padT + plotH}
                  stroke={tint}
                  strokeOpacity={0.28}
                  strokeWidth={1}
                />
                <g
                  transform={`translate(${mx - 8} ${padT + plotH + 8}) scale(0.67)`}
                  style={{ color: look.color }}
                >
                  <circle
                    cx={12}
                    cy={12}
                    r={13}
                    fill="var(--color-ink-900)"
                    stroke={tint}
                    strokeWidth={1.5}
                  />
                  <path
                    d={iconPath(look.icon)}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2.2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <title>{`${look.label}${who} at ${clock(m.time)}`}</title>
                </g>
              </g>
            );
          })}
        </g>
      ))}
    </svg>
  );
}

/** Legend for the hero lines and the marker glyphs. */
export function TimelineLegend({ heroIds, kinds }: { heroIds: string[]; kinds: MarkerKind[] }) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-muted">
      {heroIds.map((id, slot) => (
        <span key={id} className="flex items-center gap-1.5">
          <svg width={28} height={8} aria-hidden>
            <line
              x1={0}
              x2={28}
              y1={4}
              y2={4}
              stroke={heroDef(id).color}
              strokeWidth={2.4}
              strokeDasharray={DASH[slot % DASH.length]}
            />
          </svg>
          {heroDef(id).name}
        </span>
      ))}
      {kinds.map((k) => (
        <span key={k} className="flex items-center gap-1.5" style={{ color: MARKER[k].color }}>
          <svg width={14} height={14} viewBox="0 0 24 24" aria-hidden>
            <path
              d={iconPath(MARKER[k].icon)}
              fill="none"
              stroke="currentColor"
              strokeWidth={2.2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {MARKER[k].label}
        </span>
      ))}
    </div>
  );
}
