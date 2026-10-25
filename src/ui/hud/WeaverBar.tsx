import type { CSSProperties } from 'react';
import { fmt } from '../kit/format';
import { Icon } from '../kit/Icon';
import { KeyCap } from '../kit/KeyCap';
import { Ring } from '../kit/Ring';
import { keyLabel } from '../../input/keyLabel';
import type { AuraHud, ChordHud, HeroHud, HudSnapshot, TechniqueHud, WeaverHud } from '../store';
import { compact, splitContribution } from '../contribution';
import { mult } from '../screens/chordModel';
import type { ContributionHud } from '../store';
import { TECHNIQUE_ICON, WEAVER_BAR_LEFT, WEAVER_BAR_WIDTH, bindingLabel } from './labels';
import { beamSong, beamTitle } from './songs';

const SPIRIT = '#8ea2ff';
const LIFE = '#fb7185';
const GOLD = 'var(--color-gold-300)';
/** The songs' accents (as on the Prep screen): the beam is the Thread's gold, the field blue. */
const BEAM = 'var(--color-gold-300)';
const FIELD = '#93c5fd';
const AURAS = '#c4b5fd';

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
      <ContributionReadout c={hud.contribution} />
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
        <ThreadStatus
          weaver={w}
          targetName={target?.name ?? null}
          targetColor={target?.color}
          beamFocus={target?.beamFocus ? (beamSong(w.chords)?.focus ?? null) : null}
        />
        <ChordChips weaver={w} party={hud.party} />
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
  const keyName = t.key0 ? keyLabel(t.key0) : bindingLabel(t.key);
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

/**
 * This fight so far: what the auras did against what the Thread did (the sim's ledger), as
 * two compact numbers and a split line. Sits on the Weaver bar's top edge; hidden until
 * either has done something.
 */
function ContributionReadout({ c }: { c: ContributionHud }) {
  const s = splitContribution(c);
  if (s.auras + s.thread < 1) return null;
  const both = s.auras + s.thread;
  return (
    <span
      className="absolute -top-3 left-4 flex items-center gap-1.5 rounded-md border border-ink-600 bg-ink-900 px-2 py-0.5 text-xs"
      role="img"
      aria-label={`This fight: auras ${compact(s.auras)}, Thread ${compact(s.thread)}`}
      title={`This fight: your auras healed ${compact(c.auras.healing)}, shielded ${compact(c.auras.shielded)} and added ${compact(c.auras.amplified)} damage; your Thread healed ${compact(c.thread.healing)} and added ${compact(c.thread.amplified)}.`}
      data-testid="contribution-readout"
    >
      <Icon name="note" size={11} style={{ color: AURAS }} />
      <span className="font-mono font-semibold" style={{ color: AURAS }}>
        {compact(s.auras)}
      </span>
      <span
        className="relative h-1.5 w-12 overflow-hidden rounded-full"
        style={{ background: BEAM }}
      >
        <span
          className="stripes absolute inset-y-0 left-0"
          style={{ width: `${(s.auras / both) * 100}%`, backgroundColor: AURAS }}
        />
      </span>
      <span className="font-mono font-semibold" style={{ color: BEAM }}>
        {compact(s.thread)}
      </span>
      <Icon name="thread" size={11} style={{ color: BEAM }} />
    </span>
  );
}

function ThreadStatus({
  weaver: w,
  targetName,
  targetColor,
  beamFocus,
}: {
  weaver: WeaverHud;
  targetName: string | null;
  targetColor?: string;
  /** The beam song's strength on the threaded hero (null: no beam song on them). */
  beamFocus: number | null;
}) {
  const mend = w.threadMode === 'mend';
  const color = mend ? 'var(--color-heal)' : 'var(--color-amp)';
  const taut = w.threadTension > 0.75;
  return (
    <div className="flex shrink-0 items-center gap-2 text-sm" data-testid="thread-mode">
      <Icon name="thread" size={16} className="text-muted" />
      <span className="flex items-center gap-1 font-semibold" style={{ color }}>
        <Icon name={mend ? 'mend' : 'empower'} size={14} />
        {mend ? 'Mend' : 'Empower'}
      </span>
      <span className="truncate text-muted">
        →{' '}
        {targetName ? (
          <>
            <span style={{ color: targetColor }}>{targetName}</span>
            {beamFocus !== null && (
              <span
                className="ml-1 font-mono text-xs font-bold"
                style={{ color: BEAM }}
                title={`Your beam song pours into ${targetName} at ${mult(beamFocus)}`}
              >
                ♪{mult(beamFocus)}
              </span>
            )}
          </>
        ) : w.chords.some((c) => c.role === 'beam' && c.auras.length > 0) ? (
          'no one (1–3): beam song idle'
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

/** Your songs: aura and ornament chips per song, the beam's strength, Pedal Point's key. */
function ChordChips({ weaver: w, party }: { weaver: WeaverHud; party: HeroHud[] }) {
  if (w.chords.every((c) => c.auras.length === 0)) {
    return <span className="text-xs text-muted">No auras sung</span>;
  }
  return (
    <div className="flex min-w-0 flex-wrap items-center justify-end gap-1.5" data-testid="chords">
      {w.chords
        .filter((c) => c.auras.length > 0)
        .map((c) => (
          <ChordGroup key={c.index} chord={c} weaver={w} party={party} />
        ))}
    </div>
  );
}

function ChordGroup({
  chord: c,
  weaver: w,
  party,
}: {
  chord: ChordHud;
  weaver: WeaverHud;
  party: HeroHud[];
}) {
  const beam = c.role === 'beam';
  const rider = c.threadSlot === null ? null : party.find((p) => p.slot === c.threadSlot);
  const accent = beam ? BEAM : FIELD;
  const title = beam
    ? beamTitle(c, rider?.name ?? null)
    : `Field song: everyone within ${Number(c.radius.toFixed(1))} m of ${c.anchor === 'planted' ? 'where you planted it' : 'you'} hears it at full strength.`;
  return (
    <span
      className="flex items-center gap-1 rounded-lg border bg-ink-950/40 py-0.5 pl-1.5 pr-1"
      style={{ borderColor: `color-mix(in srgb, ${accent} 45%, transparent)` }}
      role="group"
      aria-label={title}
      title={title}
      data-testid={`song-${c.role}`}
    >
      <span
        className="flex items-center gap-0.5 font-mono text-xs font-bold"
        style={{ color: accent }}
        aria-hidden
      >
        <Icon name={beam ? 'thread' : 'scatter'} size={12} />
        {beam ? mult(c.focus) : 'Field'}
      </span>
      {c.auras.map((a) => (
        <AuraChip key={a.id} aura={a} suppressed={w.fieldSuppressed} />
      ))}
      {c.ornaments.map((o) => {
        if (o.id === 'pedal_point') {
          const plant = w.plant;
          const cooling = !!plant && plant.remaining > 0.05;
          return (
            <span
              key={o.id}
              className="flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-medium"
              style={{
                color: o.color,
                borderColor: `color-mix(in srgb, ${o.color} 55%, transparent)`,
              }}
              title={`Pedal Point: plant this song's field at the cursor${plant ? ` (${keyLabel(plant.key0)})` : ''}`}
            >
              <Icon name="pin" size={12} />
              Plant
              {plant && (
                <KeyCap
                  label={plant.key0 ? keyLabel(plant.key0) : bindingLabel('plant')}
                  accent={!cooling}
                />
              )}
              {cooling && plant && (
                <span className="flex items-center gap-0.5 font-mono text-muted">
                  <Ring
                    value={plant.remaining / Math.max(0.01, plant.total)}
                    size={13}
                    stroke={2}
                    color={o.color}
                  />
                  {plant.remaining.toFixed(1)}
                </span>
              )}
            </span>
          );
        }
        return (
          <span
            key={o.id}
            className="flex items-center gap-0.5 rounded-md border px-1 py-0.5 text-xs"
            style={{
              color: o.color,
              borderColor: `color-mix(in srgb, ${o.color} 45%, transparent)`,
            }}
            title={o.name}
          >
            <Icon name="diamond" size={10} />
            {o.name}
          </span>
        );
      })}
    </span>
  );
}

function AuraChip({ aura, suppressed }: { aura: AuraHud; suppressed: boolean }) {
  return (
    <span
      className={`flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-medium ${suppressed ? 'opacity-45' : ''}`}
      style={{
        color: aura.color,
        borderColor: `color-mix(in srgb, ${aura.color} 55%, transparent)`,
        background: `color-mix(in srgb, ${aura.color} 12%, transparent)`,
      }}
      title={`${aura.name} reserves ${Math.round(aura.reserve * 100)}% of your Spirit`}
    >
      <Icon name="note" size={12} />
      {aura.name}
    </span>
  );
}
