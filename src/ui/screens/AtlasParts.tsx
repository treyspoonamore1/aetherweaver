/**
 * Phase 6 UI (docs/phase-6.md): the Atlas of Echoes station (its star chart, Echo cards and
 * keepsakes), the weekly panel inside it, Prep's Echo and weekly panels, and the Summary's stars
 * and weekly score. Every word and number comes from `atlasModel.ts`; these only draw.
 *
 * The chart is DOM and SVG, never the 3D scene. A lit star is filled and an unlit one an outline,
 * so a star never relies on colour alone; a status on the weekly board has its own glyph and
 * word. Twinkling stops under reduced motion (and `still`, for screenshots).
 */
import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { ProfileAtlas } from '../../meta/profile';
import type { AtlasRecord } from '../../meta/atlas';
import { Button } from '../kit/Button';
import { ScreenFrame, ScreenHeader } from '../kit/Backdrop';
import { Icon } from '../kit/Icon';
import { ATLAS_LOOK, ATLAS_SOUNDS, STATION_LOOK } from '../kit/loomLook';
import { useReducedMotion } from '../kit/motion';
import { Panel } from '../kit/Panel';
import { playUi, useMood } from '../kit/sound';
import { atlasActions } from './atlasActions';
import {
  STATUS_LOOK,
  atlasCues,
  atlasView,
  verifyCue,
  starGlyphs,
  summaryAtlasView,
  summaryWeeklyView,
  weeklyPanelView,
  type ConstellationView,
  type EchoCardView,
  type KeepsakeView,
  type PrepEchoView,
  type PrepWeeklyView,
  type StatusLook,
  type SummaryWeeklyInput,
  type WeeklyPanelInput,
  type WeeklyPanelView,
} from './atlasModel';

const LOOK = STATION_LOOK.atlas;

const ATLAS_CSS = `
@keyframes atlas-twinkle { 0%, 100% { opacity: 1; } 50% { opacity: 0.62; } }
.atlas-twinkle { animation: atlas-twinkle 2.8s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) { .atlas-twinkle { animation: none; } }
`;

/** A 5-point star path at (x, y), radius r. */
function starPath(x: number, y: number, r: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r : r * 0.45;
    pts.push(`${(x + rr * Math.cos(a)).toFixed(2)} ${(y + rr * Math.sin(a)).toFixed(2)}`);
  }
  return `M${pts.join(' L')} Z`;
}

/** Three points of light: filled for each star lit, an outline for the rest. */
export function StarPips({ lit, of, size = 14 }: { lit: number; of: number; size?: number }) {
  return (
    <span
      className="inline-flex items-center gap-0.5"
      role="img"
      aria-label={`${lit} of ${of} stars`}
      data-lit={lit}
    >
      {Array.from({ length: of }, (_, i) => (
        <svg key={i} width={size} height={size} viewBox="0 0 24 24" aria-hidden focusable="false">
          <path
            d={starPath(12, 12.5, 10)}
            fill={i < lit ? ATLAS_LOOK.star : 'none'}
            stroke={i < lit ? ATLAS_LOOK.star : ATLAS_LOOK.unlit}
            strokeWidth={1.6}
            strokeLinejoin="round"
            strokeDasharray={i < lit ? undefined : '3 2'}
          />
        </svg>
      ))}
    </span>
  );
}

// ── The star chart ─────────────────────────────────────────────────────────────────────

const CHART_W = 960;
const CHART_H = 340;

export function StarChart({
  constellations,
  selected,
  onSelect,
  still = false,
}: {
  constellations: readonly ConstellationView[];
  selected: string | null;
  onSelect(id: string): void;
  still?: boolean;
}) {
  return (
    <div className="relative" data-testid="atlas-chart">
      <style>{ATLAS_CSS}</style>
      <svg
        viewBox={`0 0 ${CHART_W} ${CHART_H}`}
        className="h-auto w-full"
        role="group"
        aria-label="The star chart"
      >
        <defs>
          <radialGradient id="atlas-sky" cx="50%" cy="40%" r="75%">
            <stop offset="0%" stopColor="#1b2550" />
            <stop offset="100%" stopColor="#070a1a" />
          </radialGradient>
        </defs>
        <rect width={CHART_W} height={CHART_H} rx={14} fill="url(#atlas-sky)" />
        {/* Background dust, fixed. */}
        {Array.from({ length: 48 }, (_, i) => (
          <circle
            key={`d${i}`}
            cx={(i * 197) % CHART_W}
            cy={(i * 89 + 31) % CHART_H}
            r={i % 5 === 0 ? 1.4 : 0.8}
            fill="#8fa0d8"
            opacity={0.35}
          />
        ))}
        {constellations.map((k) => (
          <g key={k.id} data-constellation={k.id} data-complete={k.complete}>
            {k.lines.map((l) => (
              <line
                key={`${l.from}-${l.to}`}
                x1={l.x1 * CHART_W}
                y1={l.y1 * CHART_H}
                x2={l.x2 * CHART_W}
                y2={l.y2 * CHART_H}
                stroke={l.lit ? ATLAS_LOOK.line : ATLAS_LOOK.dim}
                strokeWidth={l.lit ? 2.4 : 1.6}
                strokeDasharray={l.lit ? undefined : '6 6'}
                data-lit={l.lit}
              />
            ))}
            <text
              x={k.labelX * CHART_W}
              y={CHART_H - 14}
              textAnchor="middle"
              fill={k.complete ? LOOK.light : '#aab4d8'}
              fontSize={15}
              fontWeight={700}
              style={{ letterSpacing: '0.08em' }}
            >
              {k.name.toUpperCase()} · {k.lit}/{k.of}
            </text>
          </g>
        ))}
        {constellations.flatMap((k) =>
          k.stars.map((s) => {
            const x = s.x * CHART_W;
            const y = s.y * CHART_H - 14;
            const on = s.lit > 0;
            const sel = selected === s.id;
            return (
              <g
                key={s.id}
                role="button"
                tabIndex={0}
                aria-label={`${s.name}: ${s.lit} of ${s.of} stars`}
                aria-pressed={sel}
                data-echo={s.id}
                data-lit={s.lit}
                onClick={() => onSelect(s.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelect(s.id);
                  }
                }}
                className="cursor-pointer outline-none"
              >
                {/* The whole star, its points and its name answer a click. */}
                <rect
                  x={x - 46}
                  y={y - 24}
                  width={92}
                  height={76}
                  fill="transparent"
                  data-testid="atlas-star-hit"
                />
                {sel && (
                  <circle cx={x} cy={y} r={30} fill="none" stroke={LOOK.light} strokeWidth={2} />
                )}
                {on && <circle cx={x} cy={y} r={22} fill={ATLAS_LOOK.star} opacity={0.12} />}
                <path
                  d={starPath(x, y, on ? 17 : 14)}
                  fill={on ? ATLAS_LOOK.star : '#0b1030'}
                  stroke={on ? ATLAS_LOOK.star : ATLAS_LOOK.unlit}
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeDasharray={on ? undefined : '4 3'}
                  className={on && !still ? 'atlas-twinkle' : undefined}
                />
                {/* Its three points of light, under it. */}
                {Array.from({ length: s.of }, (_, i) => (
                  <circle
                    key={i}
                    cx={x + (i - (s.of - 1) / 2) * 11}
                    cy={y + 26}
                    r={3.6}
                    fill={i < s.lit ? ATLAS_LOOK.star : 'none'}
                    stroke={i < s.lit ? ATLAS_LOOK.star : ATLAS_LOOK.unlit}
                    strokeWidth={1.4}
                  />
                ))}
                <text
                  x={x}
                  y={y + 46}
                  textAnchor="middle"
                  stroke="#070a1a"
                  strokeWidth={4}
                  paintOrder="stroke"
                  fill={on ? '#eef2ff' : '#9aa6cc'}
                  fontSize={13}
                >
                  {s.name}
                </text>
              </g>
            );
          }),
        )}
      </svg>
    </div>
  );
}

// ── An Echo card ───────────────────────────────────────────────────────────────────────

export function EchoCard({
  card,
  onBegin,
  canBegin = true,
}: {
  card: EchoCardView;
  onBegin?(id: string): void;
  canBegin?: boolean;
}) {
  return (
    <Panel
      tone="solid"
      className="flex flex-col gap-3 p-4"
      data-testid="echo-card"
      data-echo={card.id}
      aria-label={card.label}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-xs uppercase tracking-[0.25em] text-muted">
            {card.constellationName}
          </p>
          <h3
            className="font-display text-xl font-bold leading-tight"
            style={{ color: LOOK.light }}
          >
            {card.name}
          </h3>
        </div>
        <StarPips lit={card.lit} of={card.of} size={18} />
      </div>
      <p className="text-sm leading-snug text-text">{card.text}</p>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted">The route</p>
        <ol className="mt-1 flex flex-col gap-0.5 text-sm text-text" data-testid="echo-legs">
          {card.legs.map((l, i) => (
            <li key={i} className="flex gap-2">
              <span className="font-mono text-xs text-muted">{i + 1}.</span>
              <span>{l}</span>
            </li>
          ))}
        </ol>
      </div>
      {card.twists.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">Its twists</p>
          <ul className="mt-1 flex flex-wrap gap-1.5" data-testid="echo-twists">
            {card.twists.map((t) => (
              <li
                key={t.kind}
                className="flex items-center gap-1 rounded-md border border-ink-500 bg-ink-900/80 px-2 py-0.5 text-xs text-text"
                data-twist={t.kind}
              >
                <Icon name={t.icon} size={12} className="text-muted" /> {t.text}
              </li>
            ))}
          </ul>
        </div>
      )}
      <ul className="flex flex-col gap-1.5" data-testid="echo-stars">
        {card.stars.map((s) => (
          <li
            key={s.n}
            className={`flex items-start gap-2 text-sm ${s.lit ? 'text-text' : 'text-muted'}`}
            data-lit={s.lit}
          >
            <span className="mt-0.5">
              <StarPips lit={s.lit ? 1 : 0} of={1} size={15} />
            </span>
            <span className="flex-1">
              {s.rule}
              <span className="block text-xs text-muted">{s.reward}</span>
            </span>
            <span className="sr-only">{s.lit ? '(lit)' : '(not lit)'}</span>
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-muted" data-testid="echo-best">
          {card.bestLine}
        </span>
        {onBegin && !canBegin && (
          <span className="text-xs text-muted" data-testid="echo-begin-note">
            A run is saved: continue or end it at the Gate first.
          </span>
        )}
        {onBegin && (
          <Button
            variant="primary"
            onClick={() => onBegin(card.id)}
            disabled={!canBegin}
            sound="confirm"
            data-testid="echo-begin"
          >
            <Icon name="play" size={14} /> Begin
          </Button>
        )}
      </div>
    </Panel>
  );
}

function KeepsakeChip({ k }: { k: KeepsakeView }) {
  return (
    <li
      className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${k.earned ? 'bg-ink-800/90' : 'border-dashed border-ink-500 bg-ink-900/70'}`}
      style={k.earned ? { borderColor: LOOK.color } : undefined}
      data-keepsake={k.id}
      data-earned={k.earned}
    >
      <Icon
        name={k.kind === 'robe' ? 'robe' : k.kind === 'thread' ? 'thread' : 'banner'}
        size={16}
        className="mt-0.5 shrink-0"
        style={{ color: k.earned ? LOOK.light : 'var(--color-muted)' }}
      />
      <span>
        <b className={k.earned ? 'text-text' : 'text-muted'}>{k.name}</b>{' '}
        <span className="text-xs text-muted">
          {k.earned ? (
            '· Earned'
          ) : (
            <>
              <Icon name="lock" size={11} className="-mt-0.5 inline" /> Locked
            </>
          )}
        </span>
        <span className="block text-xs text-muted">{k.how}</span>
      </span>
    </li>
  );
}

// ── The weekly panel ───────────────────────────────────────────────────────────────────

export function StatusChip({ look }: { look: StatusLook }) {
  return (
    <span
      className="inline-flex items-center gap-1 whitespace-nowrap rounded-md border px-1.5 py-px text-xs font-semibold"
      style={{
        color: look.color,
        borderColor: `color-mix(in srgb, ${look.color} 55%, transparent)`,
      }}
      title={look.means}
      data-status={look.status}
    >
      <Icon name={look.icon} size={12} /> {look.word}
    </span>
  );
}

export interface WeeklyPanelProps {
  input: WeeklyPanelInput;
  /** UI lab: the Add a code form open. */
  initialAdding?: boolean;
}

/**
 * This Week's Song (docs/phase-6.md, "The local leaderboard"): the week, its days left, the
 * entry, your best, Begin and Share, Add a code and Open a replay, the board with each row's
 * status, and a verification's progress and message (the verifier's own words).
 */
export function WeeklyPanel({ input, initialAdding = false }: WeeklyPanelProps) {
  const v: WeeklyPanelView = weeklyPanelView(input);
  const [adding, setAdding] = useState(initialAdding);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [said, setSaid] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);
  // A verification's answer sounds once, as it arrives.
  const resultStatus = input.result?.status ?? null;
  const resultKey = input.result ? `${input.result.status}:${input.result.message}` : null;
  useEffect(() => {
    // A claim (no replay checked) is no verification: it is only shown.
    const cue = resultStatus === null ? null : verifyCue(resultStatus);
    if (cue) playUi(cue);
  }, [resultKey, resultStatus]);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const refused = atlasActions().addCode(code, name.trim() || null);
    setSaid(refused);
    if (refused === null) {
      setCode('');
      setName('');
      setAdding(false);
    }
  };
  return (
    <Panel tone="solid" className="p-4" data-testid="weekly-panel" data-week={v.week}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2
          className="flex items-center gap-2 font-display text-xl font-bold"
          style={{ color: LOOK.light }}
        >
          <Icon name="week" size={20} /> This Week’s Song
        </h2>
        <p className="font-mono text-sm text-muted">
          {v.title} · <span data-testid="weekly-left">{v.left}</span>
        </p>
      </div>
      {v.entry && (
        <p className="mt-1 text-sm text-text" data-testid="weekly-entry">
          {v.entry}
        </p>
      )}
      {v.best && (
        <p className="mt-0.5 text-sm font-semibold text-gold-200" data-testid="weekly-best">
          {v.best}
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          variant="primary"
          disabled={!v.canBegin}
          onClick={() => atlasActions().beginWeekly()}
          sound="confirm"
          data-testid="weekly-begin"
        >
          <Icon name="play" size={14} /> Begin
        </Button>
        <Button
          disabled={!v.canShare}
          onClick={() => input.shareCode && atlasActions().shareWeekly(input.shareCode)}
          data-testid="weekly-share"
        >
          <Icon name="share" size={14} /> Share
        </Button>
        <Button
          onClick={() => setAdding((a) => !a)}
          aria-expanded={adding}
          data-testid="weekly-add"
        >
          <Icon name="mend" size={14} /> Add a code
        </Button>
        <Button onClick={() => file.current?.click()} data-testid="weekly-open">
          <Icon name="upload" size={14} /> Open a replay
        </Button>
        <input
          ref={file}
          type="file"
          accept=".awrun"
          className="hidden"
          aria-label="A replay file"
          onChange={(e) => {
            const f = e.currentTarget.files?.[0];
            if (f) atlasActions().openReplay(f, code.trim() || null);
            e.currentTarget.value = '';
          }}
        />
      </div>
      {adding && (
        <form
          className="mt-3 flex flex-wrap items-end gap-2"
          onSubmit={submit}
          data-testid="weekly-add-form"
        >
          <label className="flex flex-col text-xs text-muted">
            Code
            <input
              value={code}
              onChange={(e) => setCode(e.currentTarget.value)}
              placeholder="AW1-…"
              className="mt-0.5 w-80 rounded-md border border-ink-500 bg-ink-900 px-2 py-1 font-mono text-sm text-text"
            />
          </label>
          <label className="flex flex-col text-xs text-muted">
            Name
            <input
              value={name}
              maxLength={24}
              onChange={(e) => setName(e.currentTarget.value)}
              placeholder="Who sent it"
              className="mt-0.5 w-40 rounded-md border border-ink-500 bg-ink-900 px-2 py-1 text-sm text-text"
            />
          </label>
          <Button type="submit" size="sm" variant="primary">
            Add
          </Button>
        </form>
      )}
      {said && (
        <p className="mt-2 text-sm text-orange-200" role="status">
          {said}
        </p>
      )}
      {v.progress && (
        <div className="mt-3" data-testid="weekly-progress">
          <p className="text-xs text-muted">{v.progress.line}</p>
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(v.progress.fraction * 100)}
            aria-label="Verifying the replay"
            className="mt-1 h-2 overflow-hidden rounded-full border border-ink-500 bg-ink-900"
          >
            <div
              className="h-full"
              style={{ width: `${v.progress.fraction * 100}%`, background: LOOK.color }}
            />
          </div>
        </div>
      )}
      {v.result && (
        <p
          className="mt-3 flex items-start gap-2 rounded-lg border bg-ink-900/80 px-3 py-2 text-sm text-text"
          style={{ borderColor: `color-mix(in srgb, ${v.result.color} 55%, transparent)` }}
          role="status"
          data-testid="weekly-result"
          data-status={v.result.status}
        >
          <Icon
            name={v.result.icon}
            size={16}
            className="mt-0.5 shrink-0"
            style={{ color: v.result.color }}
          />
          <span>
            <b style={{ color: v.result.color }}>{v.result.word}.</b> {v.result.message}
          </span>
        </p>
      )}
      <table className="mt-3 w-full text-sm" data-testid="weekly-board">
        <caption className="sr-only">This week’s results, best first</caption>
        <thead>
          <tr className="text-left text-xs uppercase tracking-wider text-muted">
            <th className="py-1 pr-2 font-semibold">#</th>
            <th className="py-1 pr-2 font-semibold">Who</th>
            <th className="py-1 pr-2 text-right font-semibold">Score</th>
            <th className="py-1 pr-2 font-semibold">Result</th>
            <th className="py-1 pr-2 text-right font-semibold">Fighting</th>
            <th className="py-1 font-semibold">Status</th>
          </tr>
        </thead>
        <tbody>
          {v.rows.map((r) => (
            <tr
              key={r.code}
              className={`border-t border-ink-600/70 ${r.mine ? 'bg-ink-900/60' : ''}`}
              data-status={r.status.status}
              data-mine={r.mine}
              aria-label={r.label}
            >
              <td className="py-1.5 pr-2 font-mono text-muted">{r.place}</td>
              <td className={`py-1.5 pr-2 ${r.mine ? 'font-semibold text-gold-200' : 'text-text'}`}>
                {r.who}
              </td>
              <td className="py-1.5 pr-2 text-right font-mono text-text">{r.score ?? '—'}</td>
              <td className="py-1.5 pr-2 text-muted">{r.result ?? 'Can’t be read'}</td>
              <td className="py-1.5 pr-2 text-right font-mono text-muted">{r.time ?? '—'}</td>
              <td className="py-1.5">
                <StatusChip look={r.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {v.empty && <p className="mt-2 text-sm text-muted">{v.empty}</p>}
    </Panel>
  );
}

// ── The station ────────────────────────────────────────────────────────────────────────

export interface AtlasScreenViewProps {
  atlas: ProfileAtlas | undefined;
  /** This Week's Song (null: not here yet). */
  weekly: WeeklyPanelInput | null;
  onBack(): void;
  /** An Echo is open first (UI lab). */
  initialEcho?: string | null;
  /** Begin is offered (no run in progress it would replace). */
  canBegin?: boolean;
  still?: boolean;
  weeklyAdding?: boolean;
}

/** The Atlas of Echoes station: the chart, the chosen Echo's card, the keepsakes, the weekly. */
export function AtlasScreenView({
  atlas,
  weekly,
  onBack,
  initialEcho = null,
  canBegin = true,
  still: stillProp = false,
  weeklyAdding = false,
}: AtlasScreenViewProps) {
  useMood('loom');
  const reduced = useReducedMotion();
  const still = stillProp || reduced;
  const v = atlasView(atlas);
  const all = v.constellations.flatMap((k) => k.echoes);
  const [selected, setSelected] = useState<string | null>(initialEcho ?? all[0]?.id ?? null);
  const card = all.find((e) => e.id === selected) ?? null;
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      e.preventDefault();
      onBack();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onBack]);
  return (
    <ScreenFrame tone="navy">
      <div className="mx-auto max-w-7xl px-6 py-6" data-testid="atlas-screen">
        <ScreenHeader
          eyebrow="The Loom"
          title="The Atlas of Echoes"
          right={
            <div className="flex items-center gap-3">
              <span
                className="flex items-center gap-1.5 font-mono text-sm"
                style={{ color: LOOK.light }}
                data-testid="atlas-total"
              >
                <Icon name="atlas" size={16} /> {v.total}
              </span>
              <Button variant="secondary" onClick={onBack} sound="back" data-testid="atlas-back">
                <Icon name="back" size={16} /> Back
              </Button>
            </div>
          }
        />
        <p className="mt-2 max-w-3xl text-sm text-muted">{v.about}</p>
        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_24rem]">
          <div className="flex flex-col gap-4">
            <StarChart
              constellations={v.constellations}
              selected={selected}
              onSelect={setSelected}
              still={still}
            />
            <div className="grid gap-3 sm:grid-cols-3" data-testid="atlas-constellations">
              {v.constellations.map((k) => (
                <Panel
                  key={k.id}
                  tone="solid"
                  className="p-3"
                  data-constellation={k.id}
                  data-complete={k.complete}
                >
                  <p className="flex items-baseline justify-between gap-2">
                    <b
                      className="font-display text-base"
                      style={{ color: k.complete ? LOOK.light : undefined }}
                    >
                      {k.name}
                    </b>
                    <span className="shrink-0 whitespace-nowrap font-mono text-xs text-muted">
                      {k.progress}
                    </span>
                  </p>
                  <ul className="mt-1.5 flex flex-col gap-0.5">
                    {k.echoes.map((e) => (
                      <li key={e.id}>
                        <button
                          type="button"
                          onClick={() => setSelected(e.id)}
                          aria-pressed={selected === e.id}
                          className={`flex w-full items-center justify-between gap-2 rounded-md px-2 py-1 text-left text-sm ${selected === e.id ? 'bg-ink-700 text-text' : 'text-muted hover:bg-ink-800 hover:text-text'}`}
                        >
                          <span>{e.name}</span>
                          <span
                            aria-hidden
                            className="font-mono text-xs"
                            style={{ color: e.lit ? ATLAS_LOOK.star : undefined }}
                          >
                            {starGlyphs(e.lit, e.of)}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-1.5 text-xs text-muted">
                    {k.rewardLine}
                    {k.reward?.earned && <b className="text-text"> · Earned</b>}
                  </p>
                </Panel>
              ))}
            </div>
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">
                Keepsakes
              </h2>
              <ul
                className="mt-1.5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4"
                data-testid="atlas-keepsakes"
              >
                {v.keepsakes.map((k) => (
                  <KeepsakeChip key={k.id} k={k} />
                ))}
              </ul>
            </div>
          </div>
          <div className="flex flex-col gap-4">
            {card && (
              <EchoCard
                card={card}
                canBegin={canBegin}
                onBegin={(id) => atlasActions().beginEcho(id)}
              />
            )}
          </div>
        </div>
        <div className="mt-4">
          {weekly ? (
            <WeeklyPanel input={weekly} initialAdding={weeklyAdding} />
          ) : (
            <Panel
              tone="solid"
              className="p-4 text-sm text-muted"
              data-testid="weekly-panel"
              data-week=""
            >
              <Icon name="week" size={16} className="-mt-0.5 mr-1.5 inline" />
              This Week’s Song isn’t here yet.
            </Panel>
          )}
        </div>
      </div>
    </ScreenFrame>
  );
}

// ── Prep ───────────────────────────────────────────────────────────────────────────────

/** Prep under an Echo (docs/phase-6.md): what it fixes, what's off, what's yours, its stars. */
export function PrepEchoPanel({ view }: { view: PrepEchoView }) {
  return (
    <section
      className="mt-5 rounded-xl border bg-ink-900/80 p-4"
      style={{ borderColor: `color-mix(in srgb, ${LOOK.color} 55%, transparent)` }}
      aria-label={view.label}
      data-testid="prep-echo"
      data-echo={view.id}
    >
      <h2
        className="flex items-center gap-2 font-display text-lg font-bold"
        style={{ color: LOOK.light }}
      >
        <Icon name="atlas" size={18} /> {view.name}
        <span className="ml-auto">
          <StarPips lit={view.stars.filter((s) => s.lit).length} of={view.stars.length} />
        </span>
      </h2>
      <p className="mt-1 text-sm text-text">{view.text}</p>
      <div className="mt-2 grid gap-3 sm:grid-cols-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">
            Fixed by the Echo
          </p>
          <ul
            className="mt-1 flex flex-col gap-0.5 text-sm text-text"
            data-testid="prep-echo-fixed"
          >
            {view.fixed.map((f) => (
              <li key={f} className="flex items-start gap-1.5">
                <Icon name="lock" size={12} className="mt-1 shrink-0 text-muted" /> {f}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">
            Off in this Echo
          </p>
          <ul className="mt-1 flex flex-col gap-0.5 text-sm text-text" data-testid="prep-echo-off">
            {view.off.length === 0 && view.forced.length === 0 && (
              <li className="text-muted">Nothing</li>
            )}
            {view.off.map((f) => (
              <li key={f} className="flex items-start gap-1.5">
                <Icon name="close" size={12} className="mt-1 shrink-0 text-muted" /> {f}
              </li>
            ))}
            {view.forced.map((l) => (
              <li key={l.id} className="flex items-start gap-1.5" data-forced={l.id}>
                <Icon name="dissonance" size={12} className="mt-1 shrink-0 text-muted" /> {l.name}{' '}
                always on (no points)
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">Yours</p>
          <p className="mt-1 text-sm text-text">{view.yours}</p>
          <ul className="mt-1 flex flex-col gap-0.5 text-xs text-muted">
            {view.stars.map((s) => (
              <li key={s.n} className="flex items-center gap-1.5">
                <StarPips lit={s.lit ? 1 : 0} of={1} size={11} /> {s.rule}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/** Prep on This Week's Song: the entry's choices, locked, and "Everyone plays this". */
export function PrepWeeklyPanel({ view }: { view: PrepWeeklyView }) {
  return (
    <section
      className="mt-5 rounded-xl border bg-ink-900/80 p-4"
      style={{ borderColor: `color-mix(in srgb, ${LOOK.color} 55%, transparent)` }}
      aria-label={view.label}
      data-testid="prep-weekly"
      data-week={view.week}
    >
      <h2
        className="flex flex-wrap items-center gap-2 font-display text-lg font-bold"
        style={{ color: LOOK.light }}
      >
        <Icon name="week" size={18} /> {view.title}
        <span className="ml-auto flex items-center gap-1 rounded-md border border-ink-500 px-2 py-0.5 font-sans text-xs font-semibold text-text">
          <Icon name="lock" size={12} /> {view.everyone}
        </span>
      </h2>
      <dl
        className="mt-2 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[auto_1fr]"
        data-testid="prep-weekly-fixed"
      >
        {view.fixed.map((f) => (
          <div key={f.label} className="contents">
            <dt className="flex items-center gap-1.5 text-muted">
              <Icon name="lock" size={12} /> {f.label}
            </dt>
            <dd className="text-text">{f.value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-xs text-muted">{view.yours}</p>
    </section>
  );
}

// ── The Summary ────────────────────────────────────────────────────────────────────────

/** The Summary's Atlas card: the stars this run lit, what they paid, a completed constellation. */
export function SummaryAtlasCard({ record }: { record: AtlasRecord }) {
  const v = summaryAtlasView(record);
  // Once, as the card arrives: the stars lit, then a constellation (or the Atlas) completed.
  useEffect(() => {
    const cue = atlasCues(record);
    if (cue.stars !== null) playUi(ATLAS_SOUNDS.star, { stars: cue.stars });
    if (!cue.constellation) return;
    const t = setTimeout(() => playUi(ATLAS_SOUNDS.constellation), 900);
    return () => clearTimeout(t);
  }, [record]);
  if (!v) return null;
  return (
    <Panel
      tone="solid"
      className="anim-rise mt-6 flex items-start gap-4 p-5"
      style={{ borderColor: `color-mix(in srgb, ${LOOK.color} 60%, transparent)` }}
      data-testid="summary-atlas"
      data-lit={v.lit.length}
    >
      <Icon name="atlas" size={28} className="mt-0.5 shrink-0" style={{ color: LOOK.light }} />
      <div className="min-w-0 flex-1">
        <p className="font-mono text-xs uppercase tracking-[0.25em] text-muted">{v.name}</p>
        <p className="font-display text-xl font-bold" style={{ color: LOOK.light }}>
          {v.title}
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-text">
          <StarPips lit={v.stars} of={v.rows.length} size={18} />
          {v.litLine && <span>{v.litLine}</span>}
          {v.rewards && <b className="font-mono text-gold-200">{v.rewards}</b>}
        </p>
        {v.bestLine && <p className="mt-0.5 text-xs text-muted">{v.bestLine}</p>}
        {v.completions.map((c) => (
          <p key={c} className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-gold-100">
            <Icon name="sparkle" size={14} /> {c}
          </p>
        ))}
      </div>
    </Panel>
  );
}

/** The Summary's weekly slot: the score, its code and Share. */
export function SummaryWeeklyCard({ input }: { input: SummaryWeeklyInput }) {
  const v = summaryWeeklyView(input);
  return (
    <Panel
      tone="solid"
      className="mt-6 flex flex-wrap items-center gap-4 p-5"
      data-testid="summary-weekly"
    >
      <Icon name="week" size={28} className="shrink-0" style={{ color: LOOK.light }} />
      <div className="min-w-0 flex-1">
        <p className="font-mono text-xs uppercase tracking-[0.25em] text-muted">{v.title}</p>
        <p className="font-display text-2xl font-bold text-gold-100">
          {v.score} <span className="text-base text-muted">· {v.result}</span>
        </p>
        {v.code && (
          <p
            className="mt-0.5 select-all font-mono text-sm text-text"
            data-testid="summary-weekly-code"
          >
            {v.code}
          </p>
        )}
      </div>
      <Button
        disabled={!v.canShare}
        onClick={() => v.code && atlasActions().shareWeekly(v.code)}
        data-testid="summary-weekly-share"
      >
        <Icon name="share" size={14} /> Share
      </Button>
    </Panel>
  );
}

// ── The Codex ──────────────────────────────────────────────────────────────────────────

/**
 * The Codex's Atlas page: what an Echo is, its stars and what each pays, every constellation's
 * Echoes (route, twists, stars lit) and keepsake, and This Week's Song in brief. Closed (before
 * Dissonance opens), it says when it opens and shows nothing more.
 */
export function AtlasCodexPage({
  open,
  atlas,
}: {
  open: boolean;
  atlas: ProfileAtlas | undefined;
}) {
  const v = atlasView(atlas);
  if (!open)
    return (
      <Panel
        tone="solid"
        className="p-5 text-sm text-muted"
        data-testid="codex-atlas"
        data-open="false"
      >
        <Icon name="lock" size={14} className="-mt-0.5 mr-1.5 inline" />
        The Atlas of Echoes opens with Dissonance.
      </Panel>
    );
  return (
    <div className="flex flex-col gap-4" data-testid="codex-atlas" data-open="true">
      <Panel tone="solid" className="p-5">
        <h3
          className="flex items-center gap-2 font-display text-lg font-bold"
          style={{ color: LOOK.light }}
        >
          <Icon name="atlas" size={18} /> The Atlas of Echoes
          <span className="ml-auto font-mono text-sm text-muted">{v.total}</span>
        </h3>
        <p className="mt-1 text-sm text-text">{v.about}</p>
        <table className="mt-3 text-sm">
          <caption className="sr-only">
            Each star, and what it pays the first time it lights
          </caption>
          <tbody>
            {v.legend.map((s) => (
              <tr key={s.n} className="border-t border-ink-600/70">
                <td className="py-1 pr-3">
                  <StarPips lit={s.n} of={s.n} size={13} />
                </td>
                <td className="py-1 pr-3 text-text">{s.rule}</td>
                <td className="py-1 font-mono text-xs text-muted">{s.reward}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-xs text-muted">
          An Echo’s own levels count for nothing toward its stars. An Echo run pays as any run does,
          but sets no Dissonance best and earns no run-wide Deed.
        </p>
      </Panel>
      {v.constellations.map((k) => (
        <Panel key={k.id} tone="solid" className="p-5" data-constellation={k.id}>
          <h3 className="flex items-baseline justify-between gap-2 font-display text-lg font-bold text-gold-300">
            {k.name}
            <span className="font-mono text-sm font-normal text-muted">{k.progress}</span>
          </h3>
          <p className="text-xs text-muted">{k.rewardLine}</p>
          <ul className="mt-2 grid gap-3 md:grid-cols-3">
            {k.echoes.map((e) => (
              <li key={e.id} className="rounded-lg border border-ink-600/70 bg-ink-900/60 p-3">
                <p className="flex items-center justify-between gap-2">
                  <b className="text-text">{e.name}</b>
                  <StarPips lit={e.lit} of={e.of} size={12} />
                </p>
                <p className="mt-1 text-xs text-muted">{e.text}</p>
                {e.twists.length > 0 && (
                  <p className="mt-1 text-xs text-text">
                    {e.twists.map((t) => t.text).join(' · ')}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </Panel>
      ))}
      <Panel tone="solid" className="p-5">
        <h3
          className="flex items-center gap-2 font-display text-lg font-bold"
          style={{ color: LOOK.light }}
        >
          <Icon name="week" size={18} /> This Week’s Song
        </h3>
        <p className="mt-1 text-sm text-text">
          One run, the same for everyone from Monday to Monday (UTC): its seed, route, Calling,
          heroes and Dissonance are fixed, and your Chords and technique variants are your own. Its
          score counts each fight won and its grade, and a won run. Share it as a code and a replay
          file; a code you add is Claimed until its replay plays through on this device.
        </p>
        <ul className="mt-2 flex flex-wrap gap-2">
          {(Object.keys(STATUS_LOOK) as (keyof typeof STATUS_LOOK)[]).map((s) => (
            <li key={s} className="flex items-center gap-2 text-xs text-muted">
              <StatusChip look={STATUS_LOOK[s]} /> {STATUS_LOOK[s].means}
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
