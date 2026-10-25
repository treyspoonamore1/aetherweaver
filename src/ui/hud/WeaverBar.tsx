import type { CSSProperties } from 'react';
import { fmt } from '../kit/format';
import { Icon } from '../kit/Icon';
import { KeyCap } from '../kit/KeyCap';
import { Ring } from '../kit/Ring';
import type { AuraHud, HudSnapshot, TechniqueHud, WeaverHud } from '../store';
import { TECHNIQUE_ICON, WEAVER_BAR_LEFT, WEAVER_BAR_WIDTH, bindingLabel } from './labels';

const SPIRIT = '#8ea2ff';
const LIFE = '#fb7185';
const GOLD = 'var(--color-gold-300)';

/** Weaver bar (docs/plan/04 §5.2, bottom-centre): resources, techniques, Resonance, Thread. */
export function WeaverBar({ hud }: { hud: HudSnapshot }) {
  const w = hud.weaver;
  const target = w.threadSlot === null ? null : hud.party.find((p) => p.slot === w.threadSlot);
  return (
    <div
      className="absolute bottom-5 flex flex-col gap-2 rounded-2xl border border-ink-600/70 bg-ink-900/88 px-4 pb-3 pt-3 shadow-lg shadow-black/40 backdrop-blur-sm"
      style={{ left: WEAVER_BAR_LEFT, width: WEAVER_BAR_WIDTH }}
      data-testid="weaver-bar"
    >
      {w.fieldSuppressed && (
        <span className="animate-pulse-soft absolute -top-3.5 right-4 flex items-center gap-1 rounded-md border border-lethal bg-ink-900 px-2 py-0.5 text-xs font-bold text-rose-200">
          <Icon name="mute" size={13} /> Auras silenced
        </span>
      )}
      <div className="flex items-end gap-4">
        <div className="flex w-44 shrink-0 flex-col gap-2">
          <LifeBar weaver={w} />
          <SpiritBar weaver={w} />
        </div>
        <div className="flex flex-1 items-end justify-center gap-2">
          {w.techniques.map((t) => (
            <TechniqueButton key={t.key} technique={t} silenced={w.downed} />
          ))}
        </div>
        <ResonanceArc weaver={w} />
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-ink-600/50 pt-2">
        <ThreadStatus weaver={w} targetName={target?.name ?? null} targetColor={target?.color} />
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          {w.auras.map((a) => (
            <AuraChip key={a.id} aura={a} suppressed={w.fieldSuppressed} />
          ))}
        </div>
      </div>
    </div>
  );
}

function LifeBar({ weaver: w }: { weaver: WeaverHud }) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs text-muted">
        <span className="flex items-center gap-1">
          <Icon name="heart" size={12} style={{ color: LIFE }} /> Life
        </span>
        <span className="font-mono">
          {w.downed ? `re-forming ${Math.ceil(w.reform)}s` : `${fmt(w.life)} / ${fmt(w.maxLife)}`}
        </span>
      </div>
      <div
        role="meter"
        aria-label="Weaver life"
        aria-valuemin={0}
        aria-valuemax={w.maxLife}
        aria-valuenow={Math.round(w.life)}
        className="relative mt-1 h-3 overflow-hidden rounded-full bg-ink-700"
      >
        <div
          className="absolute inset-y-0 left-0 transition-[width] duration-150 ease-linear"
          style={{ width: `${pctOf(w.life, w.maxLife)}%`, background: LIFE }}
        />
      </div>
    </div>
  );
}

function pctOf(v: number, max: number): number {
  return max > 0 ? Math.max(0, Math.min(100, (v / max) * 100)) : 0;
}

/** Spirit: the filled part, with the reserved part hatched at the end. */
function SpiritBar({ weaver: w }: { weaver: WeaverHud }) {
  const reservedPct = pctOf(w.reserved, w.maxSpirit);
  const freeMax = Math.max(0, w.maxSpirit - w.reserved);
  return (
    <div>
      <div className="flex items-center justify-between text-xs text-muted">
        <span className="flex items-center gap-1">
          <Icon name="sparkle" size={12} style={{ color: SPIRIT }} /> Spirit
        </span>
        <span className="font-mono">
          {fmt(w.spirit)} / {fmt(freeMax)}
          {w.reserved > 0 && (
            <span className="ml-1 text-gold-300" title="Reserved by your active auras">
              ▨{fmt(w.reserved)}
            </span>
          )}
        </span>
      </div>
      <div
        role="meter"
        aria-label="Spirit"
        aria-valuemin={0}
        aria-valuemax={freeMax}
        aria-valuenow={Math.round(w.spirit)}
        aria-valuetext={`${fmt(w.spirit)} of ${fmt(freeMax)}, ${fmt(w.reserved)} reserved by auras`}
        className="relative mt-1 h-3 overflow-hidden rounded-full bg-ink-700"
      >
        <div
          className="absolute inset-y-0 left-0 transition-[width] duration-150 ease-linear"
          style={{ width: `${pctOf(w.spirit, w.maxSpirit)}%`, background: SPIRIT }}
        />
        {reservedPct > 0 && (
          <div
            className="stripes absolute inset-y-0 right-0 border-l border-gold-400"
            style={{ width: `${reservedPct}%`, backgroundColor: 'rgb(217 154 30 / 0.55)' }}
            title="Reserved by your active auras"
          />
        )}
      </div>
    </div>
  );
}

function TechniqueButton({
  technique: t,
  silenced,
}: {
  technique: TechniqueHud;
  silenced: boolean;
}) {
  const cooling = t.remaining > 0.05 && t.total > 0;
  const dim = !cooling && !t.affordable;
  const ready = !cooling && t.affordable && !silenced;
  const frac = cooling ? Math.min(1, t.remaining / t.total) : 0;
  const style: CSSProperties = cooling
    ? { background: `conic-gradient(rgb(5 8 20 / 0.78) ${frac * 360}deg, transparent 0)` }
    : {};
  const keyName = bindingLabel(t.key);
  const state = cooling ? `${Math.ceil(t.remaining)} seconds` : dim ? 'not enough Spirit' : 'ready';
  return (
    <div
      role="img"
      aria-label={`${t.name}, key ${keyName}, ${state}${t.cost > 0 ? `, costs ${t.cost} Spirit` : ''}`}
      className="flex flex-col items-center gap-1"
    >
      <div
        className={`relative flex h-14 w-14 items-center justify-center rounded-xl border-2 transition-colors ${
          ready
            ? 'border-gold-400 bg-ink-800 text-gold-200 shadow-[0_0_10px_rgb(245_184_61/0.35)]'
            : 'border-ink-500 bg-ink-800 text-muted'
        } ${dim ? 'opacity-55' : ''}`}
      >
        <Icon name={TECHNIQUE_ICON[t.key]} size={26} className={cooling ? 'opacity-30' : ''} />
        {cooling && (
          <>
            <div className="absolute inset-0 rounded-[10px]" style={style} />
            <span className="absolute inset-0 flex items-center justify-center font-mono text-sm font-bold text-text">
              {t.remaining >= 10 ? Math.ceil(t.remaining) : t.remaining.toFixed(1)}
            </span>
          </>
        )}
        <KeyCap
          code={undefined}
          label={keyName}
          className="absolute -left-1.5 -top-2"
          accent={ready}
        />
        {t.cost > 0 && (
          <span
            className={`absolute -bottom-2 -right-1.5 rounded-md border px-1 font-mono text-xs leading-4 ${
              dim ? 'border-lethal/70 bg-ink-900 text-rose-300' : 'border-ink-500 bg-ink-900'
            }`}
            style={dim ? undefined : { color: SPIRIT }}
            title={`Costs ${t.cost} Spirit`}
          >
            {t.cost}
          </span>
        )}
      </div>
      <span className="flex h-3 items-center gap-0.5" aria-hidden>
        {t.maxCharges > 1 &&
          Array.from({ length: t.maxCharges }, (_, i) => (
            <Icon
              key={i}
              name="diamond"
              size={9}
              solid={i < t.charges}
              style={{ color: i < t.charges ? GOLD : 'var(--color-ink-500)' }}
            />
          ))}
      </span>
    </div>
  );
}

/** The Resonance arc: four segments, Crescendo key at its heart. */
function ResonanceArc({ weaver: w }: { weaver: WeaverHud }) {
  const segments = Math.max(1, Math.round(w.resonanceMax / w.segment));
  const ready = w.resonance + 1e-9 >= w.crescendoCost;
  const active = w.crescendo > 0;
  const cx = 68;
  const cy = 62;
  const radius = 54;
  const gap = 5; // degrees
  const arcs = Array.from({ length: segments }, (_, i) => {
    const span = 180 / segments;
    const a0 = 180 + i * span + gap / 2;
    const a1 = 180 + (i + 1) * span - gap / 2;
    const rad = (deg: number) => (deg * Math.PI) / 180;
    const p = (deg: number) =>
      `${(cx + radius * Math.cos(rad(deg))).toFixed(2)} ${(cy + radius * Math.sin(rad(deg))).toFixed(2)}`;
    const fill = Math.max(0, Math.min(1, (w.resonance - i * w.segment) / w.segment));
    return { d: `M ${p(a0)} A ${radius} ${radius} 0 0 1 ${p(a1)}`, fill };
  });
  const full = Math.floor((w.resonance + 1e-9) / w.segment);
  return (
    <div
      className="relative h-[4.6rem] w-[8.5rem] shrink-0"
      role="meter"
      aria-label="Resonance"
      aria-valuemin={0}
      aria-valuemax={w.resonanceMax}
      aria-valuenow={Math.round(w.resonance)}
      aria-valuetext={`${full} of ${segments} segments${ready ? ', Crescendo ready' : ''}`}
    >
      <svg viewBox="0 0 136 74" width="136" height="74" className="absolute inset-0" aria-hidden>
        {arcs.map((a, i) => (
          <g key={i}>
            <path
              d={a.d}
              fill="none"
              stroke="var(--color-ink-700)"
              strokeWidth={9}
              strokeLinecap="butt"
            />
            <path
              d={a.d}
              pathLength={1}
              fill="none"
              stroke={a.fill >= 1 ? '#fff1c7' : GOLD}
              strokeWidth={9}
              strokeDasharray={`${a.fill} 1.01`}
              style={{
                transition: 'stroke-dasharray 150ms linear',
                filter: a.fill >= 1 ? 'drop-shadow(0 0 4px rgb(245 184 61 / 0.9))' : undefined,
              }}
            />
          </g>
        ))}
      </svg>
      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center">
        {active ? (
          <span className="flex items-center gap-1 text-xs font-bold text-gold-200">
            <Ring value={w.crescendo / 6} size={20} stroke={3} color={GOLD}>
              <Icon name="note" size={11} className="text-gold-200" />
            </Ring>
            {w.crescendoName} {Math.ceil(w.crescendo)}s
          </span>
        ) : (
          <div
            className={`flex items-center gap-1.5 rounded-lg border px-2 py-1 ${
              ready
                ? 'anim-glow border-gold-300 bg-gold-400 text-ink-950'
                : 'border-ink-500 bg-ink-800 text-muted'
            }`}
            title={`Crescendo: ${w.crescendoName}. Costs a full song (${w.crescendoCost} Resonance).`}
          >
            <KeyCap label={bindingLabel('crescendo')} accent={ready} />
            <span className="text-xs font-bold leading-none">
              {ready ? w.crescendoName.toUpperCase() : `${full}/${segments}`}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function ThreadStatus({
  weaver: w,
  targetName,
  targetColor,
}: {
  weaver: WeaverHud;
  targetName: string | null;
  targetColor?: string;
}) {
  const mend = w.threadMode === 'mend';
  const color = mend ? 'var(--color-heal)' : 'var(--color-amp)';
  const taut = w.threadTension > 0.75;
  return (
    <div className="flex min-w-0 items-center gap-2 text-sm" data-testid="thread-mode">
      <Icon name="thread" size={16} className="text-muted" />
      <span className="flex items-center gap-1 font-semibold" style={{ color }}>
        <Icon name={mend ? 'mend' : 'empower'} size={14} />
        {mend ? 'Mend' : 'Empower'}
      </span>
      <span className="truncate text-muted">
        →{' '}
        {targetName ? (
          <span style={{ color: targetColor }}>{targetName}</span>
        ) : (
          'no one (press 1–3)'
        )}
      </span>
      <KeyCap label="RMB" />
      {w.threadLock > 0 ? (
        <span className="text-xs font-semibold text-lethal">
          Snapped · {w.threadLock.toFixed(1)}s
        </span>
      ) : targetName ? (
        <span
          className="flex items-center gap-1"
          title="Thread tension: stay close or it snaps"
          role="meter"
          aria-label="Thread tension"
          aria-valuemin={0}
          aria-valuemax={1}
          aria-valuenow={Number(w.threadTension.toFixed(2))}
        >
          <span className="relative h-1.5 w-14 overflow-hidden rounded-full bg-ink-700">
            <span
              className="absolute inset-y-0 left-0 transition-[width] duration-150 ease-linear"
              style={{
                width: `${w.threadTension * 100}%`,
                background: taut ? 'var(--color-lethal)' : 'var(--color-gold-400)',
              }}
            />
          </span>
          {taut && <span className="text-xs font-semibold text-lethal">Taut!</span>}
        </span>
      ) : null}
    </div>
  );
}

function AuraChip({ aura, suppressed }: { aura: AuraHud; suppressed: boolean }) {
  return (
    <span
      className={`flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium ${suppressed ? 'opacity-45' : ''}`}
      style={{
        color: aura.color,
        borderColor: `color-mix(in srgb, ${aura.color} 55%, transparent)`,
        background: `color-mix(in srgb, ${aura.color} 12%, transparent)`,
      }}
      title={`${aura.name} reserves ${Math.round(aura.reserve * 100)}% of your Spirit`}
    >
      <Icon name="note" size={12} />
      {aura.name}
      <span className="font-mono text-muted">{Math.round(aura.reserve * 100)}%</span>
    </span>
  );
}
