import { useState, type CSSProperties } from 'react';
import { Icon, type IconName } from '../kit/Icon';
import { useUi, type Callout, type HeroHud } from '../store';
import { blindDecree } from '../screens/dissonanceModel';
import { AnswerGlyph } from './AnswerGlyph';
import { allyDef, allyOf, sightingDef, sightingOf } from './sighting';
import { shownDecree } from './legionLook';
import { heroInk } from '../kit/bondLook';
import { simText, t as txt } from '../text';

/** The party as the decree banner reads it (docs/phase-5b.md): who is in it, who is condemned. */
type CalloutParty = readonly Pick<HeroHud, 'defId' | 'execute'>[];

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

/**
 * The Crescendo's banner (made in src/app/runtime.ts): the one Perfect banner with neither a glyph
 * of its own nor a detail line (Perfect Ward's names who and how much; the Finale's and Conducting's
 * bring their glyphs). Read from what the callout carries, never its words, so every locale agrees.
 */
function crescendoBanner(c: Callout): boolean {
  return c.kind === 'perfect' && !c.icon && !c.detail;
}

/** Big centred banners: PERFECT, SAVE, CLUTCH, Crescendo (a callout may bring its own glyph). */
function Banner({ c }: { c: Callout }) {
  const ttl = useLifetime(c.expiresAt);
  const color = c.color ?? '#f5d78e';
  const icon = c.icon ?? (crescendoBanner(c) ? 'sparkle' : BANNER_ICON[c.kind]);
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

/**
 * A note of the Grand Silence (docs/phase-5d.md): "Note 3/8 · Perfect Ward", numbered, with its
 * source's glyph and eight pips, so it reads with the sound off and Flashes at 0.
 */
function NoteBanner({ c }: { c: Callout }) {
  const ttl = useLifetime(c.expiresAt);
  const color = c.color ?? '#f5d78e';
  const n = c.note?.n ?? 0;
  const of = c.note?.of ?? 8;
  return (
    <div
      className="flex flex-col items-center rounded-xl border bg-ink-950/80 px-5 py-2 text-center shadow-xl shadow-black/60"
      style={{
        ...fadeStyle(ttl, 'banner-in 0.35s cubic-bezier(0.2,0.9,0.3,1.2) both'),
        borderColor: `${color}99`,
      }}
      role="status"
      data-testid="note-callout"
      data-note={n}
    >
      <p
        className="flex items-center gap-2 font-display text-2xl font-bold tracking-wide"
        style={{ color, textShadow: `0 0 18px ${color}, 0 2px 0 rgb(0 0 0 / 0.6)` }}
      >
        {c.icon && <Icon name={c.icon} size={24} />}
        {c.text}
      </p>
      <span className="mt-1 flex items-center gap-1" aria-hidden>
        {Array.from({ length: of }, (_, i) => (
          <span
            key={i}
            className="h-2 w-2 rounded-full border"
            style={{ borderColor: color, background: i < n ? color : 'transparent' }}
          />
        ))}
      </span>
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

/** A boss's decree; under Blind Score (Phase 4d), what's coming without how to answer it. */
function DecreeBanner({ c, blind, party }: { c: Callout; blind: boolean; party?: CalloutParty }) {
  const ttl = useLifetime(c.expiresAt);
  // As this party should read it (docs/phase-5b.md): no dome without one, Brann condemned.
  const said = c.detail && party ? shownDecree(c.detail, party) : c.detail;
  const detail = said && blind ? blindDecree(said) : said;
  return (
    <div
      className="max-w-xl rounded-xl border border-ailment/60 bg-ink-950/85 px-5 py-3 text-center shadow-xl shadow-black/60"
      style={fadeStyle(ttl, 'banner-in 0.45s cubic-bezier(0.2,0.9,0.3,1.2) both')}
    >
      <p className="font-display text-xs font-semibold uppercase tracking-[0.3em] text-violet-300">
        {txt('hud.callouts.decree')}
      </p>
      <p className="font-display text-xl font-bold text-violet-100">{c.text}</p>
      {detail && <p className="mt-0.5 text-sm text-violet-200">{detail}</p>}
    </div>
  );
}

/**
 * A foe met for the first time (docs/phase-5a.md): its name, its lesson in one line and the answer
 * glyph. Non-blocking, beside the fight; Blind Score keeps the name and drops the answer.
 */
function NewFoe({ c, blind }: { c: Callout; blind: boolean }) {
  const ttl = useLifetime(c.expiresAt);
  const defId = sightingDef(c);
  const rewinds = useUi((st) => !!st.hud?.weaver.rewind);
  // The fight's party (docs/phase-5b.md): no dome glyph without a hero who brings it.
  const partyKey = useUi((st) => st.hud?.party.map((h) => h.defId).join(' ') ?? '');
  const party = partyKey ? partyKey.split(' ') : undefined;
  // Movement III: a card names Paradox only when it is on the path.
  const paradox = useUi((st) => !!st.hud?.calling?.tiers.some((t) => t?.id === 'paradox'));
  // The Finale: the Conductor's card names what Reel's variant makes of the silence.
  const reel = useUi(
    (st) => st.hud?.weaver.techniques.find((t) => t.key === 'reel')?.variant?.id ?? null,
  );
  const s = defId ? sightingOf(defId, rewinds, paradox, reel) : null;
  return (
    <div
      className="w-72 rounded-xl border border-gold-500/60 bg-ink-950/88 px-4 py-3 shadow-xl shadow-black/60"
      style={fadeStyle(ttl, 'toast-in 0.3s ease-out both')}
      role="status"
      aria-label={txt('hud.callouts.newFoe2', {
        text: c.text,
        value: blind ? '' : (c.detail ?? ''),
      })}
      data-testid="new-foe"
      data-foe={defId ?? undefined}
    >
      <p className="flex items-center gap-1.5 font-mono text-xs font-semibold uppercase tracking-[0.25em] text-gold-300">
        <Icon name="sparkle" size={13} /> {txt('hud.callouts.newFoe')}
      </p>
      <p className="mt-0.5 font-display text-lg font-bold leading-tight text-gold-100">{c.text}</p>
      {c.detail && !blind && <p className="mt-1 text-sm leading-snug text-text">{c.detail}</p>}
      {s && s.answers.length > 0 && !blind && (
        <p className="mt-1.5 flex flex-wrap items-center gap-1 text-xs text-muted">
          {txt('hud.callouts.answer')}
          {s.answers.map((a) => (
            <AnswerGlyph key={a} tag={a} party={party} />
          ))}
        </p>
      )}
    </div>
  );
}

/**
 * A hero's first fight beside you (docs/phase-5b.md, the 'New ally' card, `ally:<id>`): who they
 * are and the one rule that changes how you play them. Non-blocking, like a first sighting.
 */
function NewAlly({ c }: { c: Callout }) {
  const ttl = useLifetime(c.expiresAt);
  const defId = allyDef(c);
  const a = defId ? allyOf(defId) : null;
  if (!a) return null;
  return (
    <div
      className="w-80 rounded-xl border bg-ink-950/90 px-4 py-3 shadow-xl shadow-black/60"
      style={{ ...fadeStyle(ttl, 'toast-in 0.3s ease-out both'), borderColor: a.color }}
      role="status"
      aria-label={txt('hud.callouts.newAlly2', { name: a.name, lines: a.lines.join(' ') })}
      data-testid="new-ally"
      data-ally={defId ?? undefined}
    >
      <p className="flex items-center gap-1.5 font-mono text-xs font-semibold uppercase tracking-[0.25em] text-gold-300">
        <Icon name="sparkle" size={13} /> {txt('hud.callouts.newAlly')}
      </p>
      <p
        className="mt-0.5 font-display text-lg font-bold leading-tight"
        style={{ color: heroInk(defId!) }}
      >
        {a.name}
      </p>
      <ul className="mt-1 flex flex-col gap-0.5 text-sm leading-snug text-text">
        {a.lines.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
    </div>
  );
}

export function Toast({ c, small = false }: { c: Callout; small?: boolean }) {
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
      <span style={c.speaker ? undefined : { color: c.color }}>
        {c.kind === 'bark' ? simText(c.text) : c.text}
      </span>
      {c.detail && <span className="ml-2 text-muted">{c.detail}</span>}
    </div>
  );
}

/** The kinds drawn as big banners (the HUD's timing hints wait them out, Phase 5f). */
export const BANNER_KINDS: ReadonlySet<Callout['kind']> = new Set([
  'perfect',
  'save',
  'clutch',
  'response',
]);
const BIG = BANNER_KINDS;

/**
 * Transient feedback by kind (docs/plan/04 §5.2): big banners centre-low, decrees and wave
 * toasts at the top. Rejections sit over the Weaver bar beside the Thread dial, which the bar
 * draws (`rejectCallouts`). Barks with a known speaker are drawn by the party frames, so
 * `barkSpeakers` lists who already has a bubble.
 */
export function Callouts({
  callouts,
  barkSpeakers,
  blind = false,
  party,
  waves,
}: {
  callouts: Callout[];
  barkSpeakers: string[];
  /** Phase 4d, Blind Score: a decree doesn't say how to answer it. */
  blind?: boolean;
  /** Phase 5b: the party, so a decree reads true for it (no dome without Kael; Brann condemned). */
  party?: CalloutParty;
  /** The fight's wave count: a one-wave fight shows no wave toast (decided on it, not the words). */
  waves?: number;
}) {
  const big = callouts.filter((c) => BIG.has(c.kind));
  const holds = callouts.filter((c) => c.kind === 'hold');
  // The Finale: the Grand Silence's notes (no other fight pushes one).
  const notes = callouts.filter((c) => c.kind === 'note');
  const decrees = callouts.filter((c) => c.kind === 'decree');
  const waveToasts = waves === 1 ? [] : callouts.filter((c) => c.kind === 'wave');
  const foes = callouts.filter((c) => c.kind === 'sighting');
  const mid = callouts.filter(
    (c) =>
      c.kind === 'system' ||
      c.kind === 'solo' ||
      c.kind === 'hint' ||
      ((c.kind === 'bark' || c.kind === 'call') &&
        (!c.speaker || !barkSpeakers.includes(c.speaker))),
  );
  return (
    <div aria-live="polite">
      <div className="absolute left-1/2 top-[42%] flex -translate-x-1/2 flex-col items-center gap-3">
        {holds.slice(-1).map((c) => (
          <HoldBanner key={c.id} c={c} />
        ))}
        {big.slice(holds.length > 0 ? -1 : -2).map((c) => (
          <Banner key={c.id} c={c} />
        ))}
        {notes.slice(-1).map((c) => (
          <NoteBanner key={c.id} c={c} />
        ))}
      </div>
      <div className="absolute left-1/2 top-[11.25rem] flex -translate-x-1/2 flex-col items-center gap-2">
        {decrees.slice(-1).map((c) => (
          <DecreeBanner key={c.id} c={c} blind={blind} party={party} />
        ))}
      </div>
      <div className="absolute left-1/2 top-[7.5rem] flex -translate-x-1/2 flex-col items-center gap-2">
        {waveToasts.slice(-1).map((c) => (
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
      {foes.length > 0 && (
        <div className="absolute right-6 top-[30%] flex flex-col items-end gap-2">
          {/* Every card: a foe's first sighting shows once ever (it is recorded as seen). */}
          {foes.map((c) =>
            allyDef(c) ? <NewAlly key={c.id} c={c} /> : <NewFoe key={c.id} c={c} blind={blind} />,
          )}
        </div>
      )}
      <div className="absolute left-1/2 top-[56%] flex -translate-x-1/2 flex-col items-center gap-1.5">
        {mid.slice(-2).map((c) => (
          <Toast key={c.id} c={c} />
        ))}
      </div>
    </div>
  );
}
