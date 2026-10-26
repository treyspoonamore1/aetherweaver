import { getRuntime } from '../../app/runtimeRegistry';
import { auraDef } from '../../content';
import type { Action } from '../../input/actions';
import type { PartySlot } from '../../sim';
import { fmt } from '../kit/format';
import { Icon } from '../kit/Icon';
import { KeyCap } from '../kit/KeyCap';
import { Ring } from '../kit/Ring';
import type { Callout, ChordHud, HeroHud } from '../store';
import type { CallAnswer, ThreadMode } from '../types';
import { StatusBadge } from './StatusBadge';
import { ROLE_LABEL, bindingLabel } from './labels';
import { beamSong, heroSongs, type HeroSongs } from './songs';
import { bearLabel, shineLabel } from './calling';
import { callingLook } from '../kit/CallingGlyph';

const HEAL = 'var(--color-heal)';
const AMP = 'var(--color-amp)';
const SHIELD = 'var(--color-shield)';
const GOLD = 'var(--color-gold-300)';
const CALL = 'var(--color-call, #fde68a)';
const HOLD = '#e2d6f8';
/** The Martyr's blood (Bear, her Vow): her Calling's colours. */
const BLOOD = callingLook('martyr').color;
const BLOOD_LIGHT = callingLook('martyr').light;
const MODE_LABEL: Record<ThreadMode, string> = { mend: 'Mend', empower: 'Empower', bear: 'Bear' };

/**
 * The Martyr on a hero's frame (Phase 3d): "Borne · 35%" while she Bears for them (a share of
 * what they'd lose comes to her), and the Vow's floor while it lasts ("Vow: can't fall below
 * 1"). In her colours with her glyphs, never the lethal red alone.
 */
function MartyrMarks({ hero: h }: { hero: HeroHud }) {
  return (
    <>
      {h.borne > 0 && (
        <span
          className="flex items-center gap-1 rounded-md border px-1.5 text-xs font-bold leading-5"
          style={{
            color: BLOOD_LIGHT,
            borderColor: BLOOD,
            background: `color-mix(in srgb, ${BLOOD} 22%, transparent)`,
          }}
          role="img"
          aria-label={`Borne: you take ${bearLabel(h.borne)} of what ${h.name} would lose`}
          title={`You Bear for ${h.name}: ${bearLabel(h.borne)} of what they’d lose comes to you`}
          data-testid="borne"
        >
          <Icon name="bear" size={12} /> Borne · {bearLabel(h.borne)}
        </span>
      )}
      {h.vow && (
        <span
          className="anim-glow flex items-center gap-1 rounded-md px-1.5 text-xs font-bold leading-5"
          style={{
            color: BLOOD_LIGHT,
            background: `color-mix(in srgb, ${BLOOD} 34%, transparent)`,
            boxShadow: `0 0 0 1px ${BLOOD}`,
          }}
          role="img"
          aria-label={`Martyr’s Vow: ${h.name} can’t fall below 1 life`}
          title="Martyr’s Vow: they can’t fall below 1 life while it lasts; the rest comes to you"
          data-testid="vow"
        >
          <Icon name="vow" size={12} /> Vow · ≥ 1 life
        </span>
      )}
    </>
  );
}

/** The party column (docs/plan/04 §5.2): who is in danger, at a glance. */
export function PartyFrames({
  party,
  threadMode,
  barks,
  chords = [],
  calling = null,
}: {
  party: HeroHud[];
  threadMode: ThreadMode;
  barks: Callout[];
  /** The Weaver's songs: who the beam pours into, who hears its echo. */
  chords?: ChordHud[];
  /** The Calling (Phase 3c): its id for the Radiance colour, and whether Sunrise is lit. */
  calling?: { id: string; sunrise: boolean } | null;
}) {
  const beam = beamSong(chords);
  return (
    <div
      className="pointer-events-auto absolute bottom-5 left-4 flex w-[19rem] flex-col gap-2"
      data-testid="party-frames"
      role="group"
      aria-label="Party"
    >
      {party.map((h) => (
        <div key={h.id} className="relative">
          <HeroFrame
            hero={h}
            threadMode={threadMode}
            songs={heroSongs(h, chords)}
            beamColors={beam?.auras.map((a) => a.color) ?? []}
            calling={calling}
          />
          <Bark hero={h} callouts={barks} />
        </div>
      ))}
    </div>
  );
}

function Bark({ hero, callouts }: { hero: HeroHud; callouts: Callout[] }) {
  const bark = [...callouts]
    .reverse()
    .find((c) => (c.kind === 'bark' || c.kind === 'call') && c.speaker === hero.name);
  if (!bark) return null;
  const call = bark.kind === 'call';
  return (
    <div
      key={bark.id}
      className={`anim-toast pointer-events-none absolute left-full top-1/2 z-10 ml-3 w-[12.5rem] -translate-y-1/2 rounded-xl rounded-bl-sm border bg-ink-900/92 px-3 py-2 text-sm leading-snug shadow-lg shadow-black/50 ${call ? 'border-2' : ''}`}
      style={{ borderColor: call ? CALL : hero.color }}
    >
      <span className="flex items-center gap-1 text-xs font-semibold" style={{ color: hero.color }}>
        {call && <Icon name="call" size={12} style={{ color: CALL }} />}
        {hero.name}
      </span>
      {bark.text}
      {call && bark.detail && (
        <span className="mt-0.5 block text-xs font-semibold" style={{ color: CALL }}>
          {bark.detail}
        </span>
      )}
    </div>
  );
}

const CALL_LOOK: Record<CallAnswer, { icon: 'ward' | 'empower' | 'chime'; label: string }> = {
  ward: { icon: 'ward', label: 'Ward' },
  empower: { icon: 'empower', label: 'Empower' },
  chime: { icon: 'chime', label: 'Chime' },
};

/** The keys that answer a call on this hero. */
function callKeys(h: HeroHud, answer: CallAnswer, threadMode: ThreadMode): string[] {
  if (answer === 'ward') return [bindingLabel('ward')];
  if (answer === 'chime') return [bindingLabel('chime')];
  // Empower: Thread on them, in Empower mode (from Bear, right-click goes back to the mode
  // Bear left, so Bear's own key is the sure way off it first).
  const keys: string[] = [];
  if (!h.threaded) keys.push(String(h.slot + 1));
  if (threadMode === 'bear') keys.push(bindingLabel('bear'));
  else if (!h.threaded || threadMode !== 'empower') keys.push('RMB');
  return keys.length > 0 ? keys : ['✓'];
}

/** Call and Response: the answer they want (gold glyph + key) and the time left. */
function CallStrip({ hero: h, threadMode }: { hero: HeroHud; threadMode: ThreadMode }) {
  const call = h.call!;
  const look = CALL_LOOK[call.answer];
  if (call.answered) {
    return (
      <div
        className="anim-toast mt-1.5 flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-bold"
        style={{ borderColor: CALL, color: CALL, background: 'rgb(253 230 138 / 0.12)' }}
        data-testid="call-answered"
      >
        <Icon name="check" size={13} /> Answered · {call.flourish}!
      </div>
    );
  }
  const frac = call.total > 0 ? call.remaining / call.total : 0;
  return (
    <div
      className="mt-1.5 flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs"
      style={{ borderColor: CALL, background: 'rgb(253 230 138 / 0.1)' }}
      role="status"
      aria-label={`${h.name} calls for ${look.label}: ${call.remaining.toFixed(1)} seconds to answer for ${call.flourish}`}
      data-testid="call-strip"
      title={`Answer in time and it becomes ${call.flourish}`}
    >
      <span className="flex items-center gap-1 font-bold" style={{ color: CALL }}>
        <Icon name="call" size={13} />
        <Icon name={look.icon} size={14} />
        {look.label}!
      </span>
      <span className="flex items-center gap-0.5">
        {callKeys(h, call.answer, threadMode).map((k) => (
          <KeyCap key={k} label={k} accent />
        ))}
      </span>
      <span className="ml-auto" />
      <Ring value={frac} size={18} stroke={3} color={CALL}>
        <span className="sr-only">{call.remaining.toFixed(1)} s</span>
      </Ring>
      <span className="w-7 text-right font-mono font-semibold" style={{ color: CALL }}>
        {call.remaining.toFixed(1)}
      </span>
    </div>
  );
}

/** Fermata hold: 1 life, seconds to heal them. */
function HeldStrip({ hero: h }: { hero: HeroHud }) {
  const held = h.held!;
  const frac = held.total > 0 ? held.remaining / held.total : 0;
  return (
    <div
      className="animate-pulse-lethal mt-1.5 flex items-center gap-1.5 rounded-md border-2 px-2 py-1 text-xs font-bold"
      style={{ borderColor: HOLD, color: HOLD, background: 'rgb(226 214 248 / 0.14)' }}
      role="alert"
      aria-label={`Fermata holds ${h.name} at 1 life: heal them within ${held.remaining.toFixed(1)} seconds`}
      data-testid="held-strip"
    >
      <Icon name="fermata" size={15} />
      HELD at 1 · Heal!
      <span className="ml-auto" />
      <Ring value={frac} size={18} stroke={3} color={HOLD}>
        <span className="sr-only">{held.remaining.toFixed(1)} s</span>
      </Ring>
      <span className="w-7 text-right font-mono">{held.remaining.toFixed(1)}</span>
    </div>
  );
}

/**
 * Which of your auras touch this hero right now, one pip each: field-song pips solid, the beam
 * song's pips solid with a gold ring when it pours into them, hollow when they only hear its
 * echo. Names (and what each pip means) on hover and in the accessible label.
 */
function AuraPips({ songs }: { songs: HeroSongs }) {
  const all = [
    ...songs.focusAuras.map((id) => ({ id, how: 'focus' as const })),
    ...songs.echoAuras.map((id) => ({ id, how: 'echo' as const })),
    ...songs.fieldAuras.map((id) => ({ id, how: 'field' as const })),
  ];
  if (all.length === 0) return null;
  const describe = (x: (typeof all)[number]) =>
    `${auraDef(x.id).name}${x.how === 'focus' ? ` (beam ${songs.focus})` : x.how === 'echo' ? ` (echo${songs.echo ? ` ${songs.echo}` : ''})` : ''}`;
  const names = all.map(describe);
  return (
    <span
      className="flex items-center gap-0.5"
      role="img"
      aria-label={`Auras on them: ${names.join(', ')}`}
      title={names.join(' · ')}
      data-testid="aura-pips"
    >
      {all.map((x) => {
        const color = auraDef(x.id).color;
        return (
          <span
            key={x.id}
            className="h-2.5 w-2.5 rounded-full"
            style={
              x.how === 'echo'
                ? { border: `2px solid ${color}`, background: 'transparent' }
                : x.how === 'focus'
                  ? { background: color, boxShadow: `0 0 0 1.5px ${GOLD}` }
                  : { background: color, border: '1px solid var(--color-ink-950)' }
            }
          />
        );
      })}
    </span>
  );
}

/**
 * The Luminary's Radiance on a hero who shines: a small sun and "+8%", next to the aura pips
 * it multiplies. In Sunrise it blazes (×3).
 */
function RadianceMark({
  shine,
  sunrise,
  color,
  light,
  name,
}: {
  shine: number;
  sunrise: boolean;
  color: string;
  light: string;
  name: string;
}) {
  const label = shineLabel(shine);
  return (
    <span
      className={`flex items-center gap-0.5 rounded-md px-1 font-mono text-xs font-bold leading-4 ${sunrise ? 'anim-glow' : ''}`}
      style={{
        color: sunrise ? light : color,
        background: sunrise
          ? `color-mix(in srgb, ${color} 34%, transparent)`
          : `color-mix(in srgb, ${color} 12%, transparent)`,
        boxShadow: sunrise ? `0 0 0 1px ${color}, 0 0 10px ${color}` : undefined,
      }}
      role="img"
      aria-label={`${name} shines: ${label} damage, credited to you${sunrise ? ', Sunrise' : ''}`}
      title={`Radiance: ${name} hits ${label} harder${sunrise ? ' (Sunrise)' : ''}`}
      data-testid="radiance"
      data-sunrise={sunrise || undefined}
    >
      <Icon name="sun" size={12} />
      {label}
    </span>
  );
}

/** The beam song pours into this hero: "♪ ×2" in the beam song's colours. */
function BeamBadge({ focus, colors, name }: { focus: string; colors: string[]; name: string }) {
  const stops = colors.length > 0 ? colors : [GOLD];
  const gradient =
    stops.length === 1
      ? `color-mix(in srgb, ${stops[0]} 22%, transparent)`
      : `linear-gradient(90deg, ${stops.map((c) => `color-mix(in srgb, ${c} 30%, transparent)`).join(', ')})`;
  return (
    <span
      className="flex items-center gap-0.5 rounded-md border px-1 font-mono text-xs font-bold leading-4 text-gold-100"
      style={{ borderColor: GOLD, background: gradient }}
      title={`Your beam song pours into ${name} at ${focus}`}
      data-testid="beam-badge"
    >
      <Icon name="note" size={11} />
      {focus}
    </span>
  );
}

export function HeroFrame({
  hero: h,
  threadMode,
  songs,
  beamColors = [],
  calling = null,
}: {
  hero: HeroHud;
  threadMode: ThreadMode;
  songs?: HeroSongs;
  beamColors?: string[];
  calling?: { id: string; sunrise: boolean } | null;
}) {
  const sung = songs ?? {
    focus: null,
    focusAuras: [],
    echoAuras: [],
    fieldAuras: h.auras,
    echo: null,
  };
  const threadColor = threadMode === 'mend' ? HEAL : threadMode === 'bear' ? BLOOD : AMP;
  const out = h.dead;
  const down = h.downed && !out;
  const slotKey = bindingLabel(`focus${h.slot + 1}` as Action);
  const border = h.held
    ? HOLD
    : h.call && !h.call.answered
      ? CALL
      : h.threaded
        ? threadColor
        : h.hovered
          ? 'var(--color-gold-400)'
          : undefined;
  return (
    <button
      type="button"
      aria-pressed={h.threaded}
      aria-label={`Thread ${h.name}${out ? ' (out of the fight)' : ''}${sung.focus ? `. Your beam song pours into them at ${sung.focus}` : ''}`}
      onClick={(e) => {
        getRuntime()?.queue({ t: 'thread', slot: h.slot as PartySlot });
        // Mouse clicks must not leave focus here: Space (Glide) would re-trigger the button.
        if (e.detail > 0) e.currentTarget.blur();
      }}
      onPointerEnter={() => getRuntime()?.setUiHover(h.slot as PartySlot)}
      onPointerLeave={() => getRuntime()?.setUiHover(null)}
      onFocus={() => getRuntime()?.setUiHover(h.slot as PartySlot)}
      onBlur={() => getRuntime()?.setUiHover(null)}
      className={`block w-full rounded-xl border bg-ink-900/88 px-3 py-2 text-left shadow-lg shadow-black/40 backdrop-blur-sm transition-colors hover:bg-ink-800/90 ${
        (h.lethal || h.held) && !down && !out ? 'animate-pulse-lethal' : ''
      } ${down || out ? 'saturate-0' : ''} ${out ? 'opacity-60' : ''}`}
      style={{
        borderColor: border ?? (h.lethal && !down ? 'var(--color-lethal)' : 'var(--color-ink-600)'),
      }}
    >
      <div className="flex items-start gap-2.5">
        <Portrait hero={h} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-sm font-semibold leading-tight">
              {h.name}
              <span className="ml-1.5 text-xs font-normal text-muted">{ROLE_LABEL[h.role]}</span>
            </span>
            <span className="flex shrink-0 items-center gap-1.5">
              {h.threaded && (
                <span
                  className="flex items-center gap-0.5 text-xs font-semibold"
                  style={{ color: threadColor }}
                  title={`Threaded: ${MODE_LABEL[threadMode]}`}
                >
                  <Icon name="thread" size={13} />
                  <Icon name={threadMode} size={12} />
                </span>
              )}
              {sung.focus && !out && (
                <BeamBadge focus={sung.focus} colors={beamColors} name={h.name} />
              )}
              <InFieldPip inField={h.inField} out={out} />
              <KeyCap label={slotKey} />
            </span>
          </div>
          {out ? (
            <p className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-muted">
              <Icon name="skull" size={14} /> Out for this fight
            </p>
          ) : down ? (
            <DownedBlock hero={h} />
          ) : (
            <>
              <HpBar hero={h} />
              {h.held && <HeldStrip hero={h} />}
              {h.call && <CallStrip hero={h} threadMode={threadMode} />}
              <div className="mt-1 flex min-h-5 flex-wrap items-center gap-1">
                {(h.borne > 0 || h.vow) && <MartyrMarks hero={h} />}
                {h.statuses
                  .filter((s) => !(h.held && s.id === 'held'))
                  .map((s) => (
                    <StatusBadge key={s.id} status={s} />
                  ))}
                {h.castName && <CastLine name={h.castName} progress={h.castProgress} />}
                {!h.inField && (
                  <span className="text-xs font-medium text-threat" title="Outside your aura field">
                    Outside field
                  </span>
                )}
                <span className="ml-auto flex items-center gap-1.5">
                  {calling && h.radiance > 0 && (
                    <RadianceMark
                      shine={h.radiance}
                      sunrise={calling.sunrise}
                      color={callingLook(calling.id).color}
                      light={callingLook(calling.id).light}
                      name={h.name}
                    />
                  )}
                  <AuraPips songs={sung} />
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </button>
  );
}

function InFieldPip({ inField, out }: { inField: boolean; out: boolean }) {
  if (out) return null;
  return (
    <span
      role="img"
      aria-label={inField ? 'In your aura field' : 'Outside your aura field'}
      title={inField ? 'In your aura field' : 'Outside your aura field'}
      style={{ color: inField ? GOLD : 'var(--color-threat)' }}
    >
      <Icon name="diamond" size={11} solid={inField} />
    </span>
  );
}

/** Portrait disc ringed by the Solo charge; blazes with the Cue key when ready. */
function Portrait({ hero: h }: { hero: HeroHud }) {
  const ready = h.soloReady && !h.dead && !h.downed;
  return (
    <div className="flex shrink-0 flex-col items-center gap-0.5">
      <Ring
        value={h.soloActive ? 1 : h.solo / 100}
        size={46}
        stroke={4}
        color={ready || h.soloActive ? GOLD : 'rgb(252 217 138 / 0.65)'}
        className={ready ? 'anim-glow' : ''}
      >
        <span
          className="flex h-8 w-8 items-center justify-center rounded-full font-display text-base font-bold text-ink-950"
          style={{ background: h.color }}
          aria-hidden
        >
          {h.name.slice(0, 1)}
        </span>
      </Ring>
      <span
        className={`font-mono text-xs leading-none ${ready ? 'font-bold text-gold-300' : 'text-muted'}`}
        title={`${h.soloName}: ${Math.floor(h.solo)}% charged`}
      >
        {h.dead ? '' : h.soloActive ? 'SOLO' : ready ? 'READY' : `${Math.floor(h.solo)}%`}
      </span>
      {ready && (
        <span className="mt-0.5 flex items-center gap-0.5" title={`Cue ${h.soloName}`}>
          <KeyCap label={`⇧${h.slot + 1}`} accent />
        </span>
      )}
    </div>
  );
}

/** HP + shield overlay + striped incoming-damage forecast (docs/plan/04 §5.2). */
function HpBar({ hero: h }: { hero: HeroHud }) {
  const total = h.hp + h.shield;
  const denom = Math.max(h.maxHp, total, 1);
  const pctOf = (v: number) => `${Math.max(0, Math.min(100, (v / denom) * 100))}%`;
  const forecast = Math.min(h.incoming, total);
  const forecastColor = h.lethal ? 'var(--color-lethal)' : 'var(--color-threat)';
  return (
    <div className="mt-1.5">
      <div
        role="meter"
        aria-label={`${h.name} health`}
        aria-valuemin={0}
        aria-valuemax={h.maxHp}
        aria-valuenow={Math.round(h.hp)}
        aria-valuetext={`${fmt(h.hp)} of ${fmt(h.maxHp)}${h.shield > 0 ? `, ${fmt(h.shield)} shield` : ''}${h.incoming > 0 ? `, ${fmt(h.incoming)} incoming${h.lethal ? ', lethal' : ''}` : ''}`}
        className="relative h-4 overflow-hidden rounded-full bg-ink-700"
      >
        <div
          className="absolute inset-y-0 left-0 transition-[width] duration-150 ease-linear"
          style={{ width: pctOf(h.hp), background: HEAL }}
        />
        {h.shield > 0 && (
          <div
            className="absolute inset-y-0 transition-[left,width] duration-150 ease-linear"
            style={{ left: pctOf(h.hp), width: pctOf(h.shield), background: SHIELD }}
          />
        )}
        {forecast > 0 && (
          <div
            className="stripes absolute inset-y-0 border-l-2 transition-[left,width] duration-150 ease-linear"
            style={{
              left: pctOf(total - forecast),
              width: pctOf(forecast),
              backgroundColor: `color-mix(in srgb, ${forecastColor} 78%, transparent)`,
              borderColor: '#fff',
            }}
          />
        )}
      </div>
      <div className="mt-0.5 flex items-center justify-between gap-2 font-mono text-xs">
        <span className="text-muted">
          {fmt(h.hp)} / {fmt(h.maxHp)}
          {h.shield > 0 && (
            <span className="ml-1.5" style={{ color: SHIELD }}>
              +{fmt(h.shield)}
            </span>
          )}
        </span>
        {h.incoming > 0 && (
          <span
            className="flex items-center gap-1 font-semibold"
            style={{ color: h.lethal ? 'var(--color-lethal)' : 'var(--color-threat)' }}
          >
            <Icon name={h.lethal ? 'skull' : 'sparkle'} size={12} />
            {h.lethal ? 'LETHAL ' : ''}-{fmt(h.incoming)}
          </span>
        )}
      </div>
    </div>
  );
}

function CastLine({ name, progress }: { name: string; progress: number }) {
  return (
    <span
      className="flex min-w-0 flex-1 items-center gap-1.5 text-xs text-muted"
      title={`Casting ${name}`}
    >
      <span className="truncate">{name}</span>
      <span className="relative h-1.5 w-14 shrink-0 overflow-hidden rounded-full bg-ink-700">
        <span
          className="absolute inset-y-0 left-0 bg-gold-300"
          style={{ width: `${Math.max(0, Math.min(1, progress)) * 100}%` }}
        />
      </span>
    </span>
  );
}

function DownedBlock({ hero: h }: { hero: HeroHud }) {
  return (
    <div className="mt-1">
      <p className="flex items-center gap-1.5 text-xs font-bold tracking-wide text-lethal">
        <Icon name="skull" size={14} />
        DOWN
        <span className="font-mono font-medium">{Math.ceil(h.bleedOut)}s</span>
      </p>
      <div className="mt-1 grid grid-cols-2 gap-2">
        <div>
          <p className="text-xs text-muted">Bleeding out</p>
          <div className="h-1.5 overflow-hidden rounded-full bg-ink-700">
            <div
              className="h-full bg-lethal transition-[width] duration-150 ease-linear"
              style={{ width: `${(h.bleedOutMax > 0 ? h.bleedOut / h.bleedOutMax : 0) * 100}%` }}
            />
          </div>
        </div>
        <div>
          <p className="text-xs text-muted">Mend to revive</p>
          <div className="h-1.5 overflow-hidden rounded-full bg-ink-700">
            <div
              className="h-full transition-[width] duration-150 ease-linear"
              style={{ width: `${Math.max(0, Math.min(1, h.revive)) * 100}%`, background: HEAL }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
