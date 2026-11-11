import { Icon } from '../kit/Icon';
import { Ring } from '../kit/Ring';
import { useReducedMotion } from '../kit/motion';
import { CallingGlyph, callingLook } from '../kit/CallingGlyph';
import { powerLabel } from '../screens/callingText';
import {
  useBeatNow,
  type ConductingHud,
  type FinaleHud,
  type FinaleTurnHud,
  type HeroHud,
} from '../store';
import {
  BEAT_LIGHT,
  CONDUCT_GOLD,
  beatStrip,
  chainLabel,
  finaleNextLabel,
  finaleTurnLabel,
  finaleTurnSentence,
  liveBeat,
  liveCueBadge,
  pctLabel,
} from './conducting';
import { t } from '../text';

/**
 * The Conductor on the HUD (docs/phase-5f.md): the row under the Resonance arc (the chain ring and
 * the A Tempo beat strip), the Grand Finale's pips, and his marks on a hero's frame. His own marks
 * are ink and ivory with his glyphs; the Weaver's acts (a Duet, a Trio, the Finale) are gold.
 * Every number and every rule is the sim's, through `ConductingHud` (hud/conducting.ts).
 */
const LOOK = callingLook('conductor');

/** Under the Resonance arc: the beat strip (A Tempo), then the chain ring or the Finale's next. */
export function ConductRow({ c, reduced }: { c: ConductingHud; reduced?: boolean }) {
  return (
    <div className="flex w-[8.5rem] flex-col items-center gap-1" data-testid="conduct-row">
      {c.beat && <BeatStrip beat={c.beat} reduced={reduced} />}
      <div className="flex min-h-5 items-center justify-center">
        {c.finale ? (
          <span
            className="whitespace-nowrap font-mono text-[0.75rem] font-bold leading-none"
            style={{ color: CONDUCT_GOLD }}
            data-testid="finale-next"
          >
            {finaleNextLabel(c.finale)}
          </span>
        ) : c.chain ? (
          <ChainRing chain={c.chain} />
        ) : null}
      </div>
    </div>
  );
}

/** The chain's window: a gold ring draining from the last Cue, "Duet next" or "Trio next". */
export function ChainRing({ chain }: { chain: NonNullable<ConductingHud['chain']> }) {
  const label = chainLabel(chain);
  return (
    <span
      className="flex items-center gap-1 whitespace-nowrap text-[0.75rem] font-bold leading-none"
      style={{ color: CONDUCT_GOLD }}
      role="timer"
      aria-label={t('hud.conductParts.cueAnotherHeroWithin', {
        label,
        left: Math.ceil(chain.left),
        powerLabel: powerLabel(chain.power),
      })}
      data-testid="chain-ring"
      data-link={chain.link}
    >
      <Ring
        value={chain.total > 0 ? chain.left / chain.total : 0}
        size={18}
        stroke={2.5}
        color={CONDUCT_GOLD}
      >
        <Icon name="chain" size={10} />
      </Ring>
      {label} {powerLabel(chain.power)}
    </span>
  );
}

/**
 * A Tempo's metronome (docs/phase-5f.md): four beat marks a bar, the first larger, the downbeat's
 * window as a band round it, and a light running with the sim's time. Inside the window the band
 * glows white-gold and reads "Free". With reduced motion the light steps mark to mark, on the
 * downbeat's exactly while the window is open; the band's glow and the word mark it too, so it
 * reads with the sound off. Its time, window and cost are the frame's (`useBeatNow`), not the
 * 15 Hz snapshot's, when the runtime writes them.
 */
export function BeatStrip({
  beat: snapshot,
  reduced,
}: {
  beat: NonNullable<ConductingHud['beat']>;
  /** Reduced motion (the OS setting, read on mount; the UI lab can force it). */
  reduced?: boolean;
}) {
  const beat = liveBeat(
    snapshot,
    useBeatNow((s) => s.beat),
  );
  const osReduced = useReducedMotion();
  const stepped = reduced ?? osReduced;
  const v = beatStrip(beat, stepped);
  const W = 108;
  const H = 14;
  const x = (f: number) => 4 + f * (W - 8);
  return (
    <span
      className="flex items-center gap-1"
      role="img"
      aria-label={
        beat.downbeatCost > 0
          ? v.inside
            ? t('hud.conductParts.onTheDownbeatA', { downbeatCost: beat.downbeatCost })
            : t('hud.conductParts.theBeatCueOn', { downbeatCost: beat.downbeatCost })
          : v.inside
            ? t('hud.conductParts.onTheDownbeatA2')
            : t('hud.conductParts.theBeatCueOn2')
      }
      data-testid="beat-strip"
      data-inside={v.inside || undefined}
      data-stepped={stepped || undefined}
      data-light={v.light.toFixed(3)}
    >
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden>
        <line
          x1={x(0)}
          x2={x(1)}
          y1={H / 2}
          y2={H / 2}
          stroke="var(--color-ink-600)"
          strokeWidth={1.5}
        />
        <rect
          x={x(v.band.from)}
          y={1}
          width={Math.max(2, x(v.band.to) - x(v.band.from))}
          height={H - 2}
          rx={3}
          fill={v.inside ? BEAT_LIGHT : `color-mix(in srgb, ${LOOK.light} 18%, transparent)`}
          stroke={v.inside ? CONDUCT_GOLD : LOOK.light}
          strokeOpacity={v.inside ? 1 : 0.45}
          strokeWidth={1}
          data-testid="beat-band"
        />
        {v.marks.map((m) => (
          <line
            key={m.x}
            x1={x(m.x)}
            x2={x(m.x)}
            y1={m.down ? 2 : 4.5}
            y2={m.down ? H - 2 : H - 4.5}
            stroke={m.down && v.inside ? 'var(--color-ink-950)' : LOOK.light}
            strokeWidth={m.down ? 2.2 : 1.4}
            strokeLinecap="round"
          />
        ))}
        <circle
          cx={x(v.light)}
          cy={H / 2}
          r={3.2}
          fill={v.inside ? CONDUCT_GOLD : LOOK.light}
          stroke="var(--color-ink-950)"
          strokeWidth={1}
          data-testid="beat-light"
        />
      </svg>
      <span
        className="w-6 font-mono text-[0.75rem] font-bold leading-none"
        style={{ color: BEAT_LIGHT, visibility: v.inside ? 'visible' : 'hidden' }}
        data-testid="beat-free"
      >
        {/* Free, or (Silent Cues) the surcharge a Cue on the beat still pays. */}
        {beat.on && beat.cost > 0 ? beat.cost : t('hud.conductParts.free')}
      </span>
    </span>
  );
}

/**
 * The Grand Finale on the Resonance arc while it plays: its name and one pip a turn, lit as
 * played, crossed as lost (3, or 6 with Maestro).
 */
export function FinaleReadout({ finale, name }: { finale: FinaleHud; name: string }) {
  const played = finale.pips.filter((p) => p === 'played').length;
  const lost = finale.pips.filter((p) => p === 'lost').length;
  return (
    <span
      className="flex flex-col items-center gap-0.5 rounded-md px-1 py-0.5"
      style={{ background: `color-mix(in srgb, ${LOOK.color} 70%, transparent)` }}
      data-testid="crescendo-active"
      data-crescendo="finale"
      role="img"
      aria-label={t('hud.conductParts.ofSolosPlayed', {
        name,
        played,
        length: finale.pips.length,
        value: lost > 0 ? t('hud.conductParts.lost', { lost }) : '',
        finaleNextLabel: finaleNextLabel(finale),
      })}
    >
      <span
        className="flex items-center gap-1 whitespace-nowrap text-xs font-bold leading-none"
        style={{ color: CONDUCT_GOLD }}
      >
        <Icon name="finale" size={12} />
        {name}
      </span>
      <span className="flex items-center gap-0.5" data-testid="finale-pips">
        {finale.pips.map((p, i) => (
          <FinalePip key={i} state={p} />
        ))}
      </span>
    </span>
  );
}

function FinalePip({ state }: { state: FinaleHud['pips'][number] }) {
  const lit = state === 'played';
  return (
    <span
      className="relative flex h-2.5 w-2.5 items-center justify-center rounded-full border"
      style={{
        borderColor: state === 'lost' ? 'var(--color-muted)' : CONDUCT_GOLD,
        background: lit ? CONDUCT_GOLD : 'transparent',
        boxShadow: lit ? `0 0 5px ${CONDUCT_GOLD}` : undefined,
      }}
      data-pip={state}
    >
      {state === 'lost' && (
        <svg width="10" height="10" viewBox="0 0 10 10" className="absolute" aria-hidden>
          <path d="M2 2l6 6 M8 2l-6 6" stroke="var(--color-muted)" strokeWidth="1.4" />
        </svg>
      )}
    </span>
  );
}

// ── A hero's frame ─────────────────────────────────────────────────────────────────────

/**
 * The Cue badge under a ready hero's portrait (docs/phase-5f.md): "Duet ×1.25", "Trio ×1.5" in
 * gold, "Free" in white-gold on the downbeat. Nothing for a plain Cue: the key cap says it. On A
 * Tempo whether it is on the beat, and its cost, are the frame's (`useBeatNow`).
 */
export function CueBadge({ hero: h }: { hero: HeroHud }) {
  const on = useBeatNow((s) => s.beat?.on);
  const cost = useBeatNow((s) => s.beat?.cost);
  const c =
    h.cue && on !== undefined && cost !== undefined ? liveCueBadge(h.cue, { on, cost }) : h.cue;
  if (!c?.label) return null;
  return (
    <span
      className="mt-0.5 flex items-center gap-0.5 whitespace-nowrap rounded px-1 font-mono text-[0.75rem] font-bold leading-4"
      style={{
        color: c.free ? 'var(--color-ink-950)' : CONDUCT_GOLD,
        background: c.free ? BEAT_LIGHT : 'rgb(5 8 20 / 0.75)',
        boxShadow: `inset 0 0 0 1px ${CONDUCT_GOLD}`,
      }}
      title={t('hud.conductParts.cueNow', {
        soloName: h.soloName,
        label: c.label,
        value:
          c.cost > 0
            ? t('hud.conductParts.resonance', { cost: c.cost })
            : t('hud.conductParts.noResonance'),
      })}
      data-testid="cue-badge"
      data-link={c.link}
      data-free={c.free || undefined}
    >
      {c.link > 1 && <Icon name="chain" size={10} />}
      {c.label}
    </span>
  );
}

/** Spotlight, Marcato and the Finale's turn on a hero's frame, each a chip with its glyph. */
export function ConductMarks({ hero: h }: { hero: HeroHud }) {
  return (
    <>
      {h.finale && <FinaleTurnChip name={h.name} turn={h.finale} />}
      {h.spotlight !== undefined && (
        <span
          className="flex items-center gap-1 whitespace-nowrap rounded-md border px-1.5 text-xs font-bold leading-5"
          style={{ color: LOOK.light, borderColor: LOOK.light, background: LOOK.color }}
          role="img"
          aria-label={t('hud.conductParts.spotlightIsEmpoweredAt', {
            name: h.name,
            spotlight: h.spotlight,
          })}
          title={t('hud.conductParts.spotlightEmpoweredAtWhile', { spotlight: h.spotlight })}
          data-testid="spotlight-mark"
        >
          <CallingGlyph icon="spotlight" size={12} /> ×{h.spotlight}
        </span>
      )}
      {h.marcato && (
        <span
          className="flex items-center gap-1 whitespace-nowrap rounded-md border px-1 text-xs font-bold leading-5"
          style={{ color: LOOK.light, borderColor: LOOK.light, background: LOOK.color }}
          role="img"
          aria-label={t('hud.conductParts.marcatoDealsDamageFor', {
            name: h.name,
            pctLabel: pctLabel(h.marcato.pct),
            left: Math.ceil(h.marcato.left),
          })}
          title={t('hud.conductParts.marcatoDamageSLeft', {
            pctLabel: pctLabel(h.marcato.pct),
            left: Math.ceil(h.marcato.left),
          })}
          data-testid="marcato-mark"
        >
          <Ring
            value={h.marcato.total > 0 ? h.marcato.left / h.marcato.total : 0}
            size={16}
            stroke={2}
            color={LOOK.light}
          >
            <CallingGlyph icon="marcato" size={9} />
          </Ring>
          {pctLabel(h.marcato.pct)}
        </span>
      )}
    </>
  );
}

function FinaleTurnChip({ name, turn }: { name: string; turn: FinaleTurnHud }) {
  const label = finaleTurnLabel(turn);
  const muted = turn.state === 'lost' || turn.state === 'done' || turn.state === 'losing';
  // Struck through only when every turn they had was lost.
  const struck = turn.state === 'lost' && !(turn.played ?? 0);
  const sentence = finaleTurnSentence(name, turn);
  return (
    <span
      className={`flex items-center gap-1 whitespace-nowrap rounded-md border px-1 text-xs font-bold leading-5 ${muted ? 'opacity-70' : ''} ${struck ? 'line-through' : ''}`}
      style={{
        color: muted ? 'var(--color-muted)' : CONDUCT_GOLD,
        borderColor: turn.state === 'next' ? CONDUCT_GOLD : 'var(--color-ink-500)',
        background: 'rgb(5 8 20 / 0.7)',
      }}
      role="img"
      aria-label={sentence}
      title={sentence}
      data-testid="finale-turn"
      data-state={turn.state}
    >
      <Icon name="finale" size={12} />
      {turn.state === 'next' ? t('hud.conductParts.next', { place: turn.place }) : label}
    </span>
  );
}
