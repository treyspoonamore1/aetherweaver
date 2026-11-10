import { CallingGlyph } from '../kit/CallingGlyph';
import { callingLook } from '../kit/callingLook';
import { clock, fmt } from '../kit/format';
import { Icon } from '../kit/Icon';
import { EXECUTE_PCT, bossCastIcon, bossDecreeShown, phaseTicks } from './legionLook';
import { bossConditions, type BossCondition } from './riftLook';
import type { BossHud } from '../store';
import { POSTLUDE_NAME, type PostludeHud, type TyrantDecree } from './phase6Look';
import { AnswerGlyph } from './AnswerGlyph';
import { secondsLabel } from './chrono';
import { BLIND_LOOK } from '../kit/dissonanceLook';
import { blindDecree, blindLine, levelName } from '../screens/dissonanceModel';
import {
  CUE_ANSWER,
  DISCORD_HEX,
  DISCORD_INK,
  NOTE_LOOK,
  SILENCE_INK,
  codaText,
  cueText,
  discordSegments,
  discordText,
  fortissimoInText,
  silenceAsk,
  silenceLeftFrac,
  silencePips,
  silenceText,
} from './finaleLook';

/**
 * Phase 6, Tyrant: the boss's borrowed attack for this phase, as its decree words it (cut to its
 * first sentence under Blind Score), with the borrowed foe's accent beside the crown: the accent is
 * never alone, the foe and the attack are named.
 */
function TyrantLine({ tyrant }: { tyrant: TyrantDecree }) {
  return (
    <p
      className="mt-1.5 flex items-start gap-1.5 rounded-lg border bg-ink-950/60 px-3 py-1 text-xs text-text"
      style={{ borderColor: `color-mix(in srgb, ${tyrant.accent} 55%, transparent)` }}
      role="status"
      aria-label={`${tyrant.name}: ${tyrant.text}`}
      data-testid="boss-tyrant"
      data-phase={tyrant.phase}
    >
      <Icon name="crown" size={14} className="mt-px shrink-0" style={{ color: tyrant.accent }} />
      <span>
        <b className="uppercase tracking-wider text-gold-200">{tyrant.name}</b> — {tyrant.text}
      </span>
    </p>
  );
}

/**
 * Phase 6, True Dissonance: the Postlude's rise (untouchable, its seconds), its pressure once on,
 * and its decree while fresh.
 */
function PostludeLine({ postlude }: { postlude: PostludeHud }) {
  return (
    <div
      className="mt-1.5 rounded-lg border border-gold-500/50 bg-ink-950/60 px-3 py-1 text-xs text-text"
      role="status"
      data-testid="boss-postlude"
      data-rising={postlude.rising !== null}
      data-enraged={postlude.enraged}
    >
      <p className="flex flex-wrap items-center gap-x-2 font-semibold">
        <Icon name="finale" size={14} className="text-gold-200" />
        <span className="uppercase tracking-wider text-gold-200">{POSTLUDE_NAME}</span>
        {postlude.rising !== null && (
          <span className="text-muted">Rising · untouchable {secondsLabel(postlude.rising)}</span>
        )}
        {postlude.enraged && (
          <span className="flex items-center gap-1 text-lethal">
            <Icon name="hourglass" size={12} /> Faster Cues, faster Discord
          </span>
        )}
      </p>
      {postlude.decree && <p className="mt-0.5 leading-snug">{postlude.decree.text}</p>}
    </div>
  );
}

/** The Chronomancer's silver, for Foresight's line (Phase 3e). */
const CHRONO = callingLook('chronomancer');

/**
 * Boss bar (docs/plan/04 §5.2, top-centre): HP with phase ticks, the cast and its answers. With
 * the Chronomancer's Foresight, the boss's next attack shows before it begins. Under Blind Score
 * (Phase 4d) the cast's answers are hidden, and a decree keeps what's coming but not its answer.
 */
export function BossBar({
  boss,
  decree,
  decreeBanner = false,
  rewind = false,
  blind = false,
  reel = null,
}: {
  boss: BossHud;
  /** The Finale (docs/phase-5d.md): the variant Reel's slot plays, for the silence stave's words. */
  reel?: string | null;
  /** The latest decree, worded as it was announced (the store's `lastDecree`). */
  decree: { name: string; text: string } | null;
  /** The big decree banner is on screen: the quiet line below the bar waits. */
  decreeBanner?: boolean;
  /** A Chronomancer run: Reel's answer is Rewind's (Phase 3e). */
  rewind?: boolean;
  /** Phase 4d, Blind Score: don't name the answer a telegraph wants. */
  blind?: boolean;
}) {
  const hpPct = boss.maxHp > 0 ? Math.max(0, Math.min(100, (boss.hp / boss.maxHp) * 100)) : 0;
  const shieldPct = boss.maxHp > 0 ? Math.min(100 - 0, (boss.shield / boss.maxHp) * 100) : 0;
  const ticks = phaseTicks(boss);
  const enrageSoon = boss.enrageIn !== null && boss.enrageIn < 30;
  // Phase 5b: the wording latched when the decree was announced (`decree`, the store's) outlasts
  // the bridge's live rewording, which reverts once Execution has resolved.
  const shown = bossDecreeShown(boss.decree, decree);
  return (
    <div
      className="absolute left-1/2 top-4 w-[36rem] max-w-[calc(100vw-2rem)] -translate-x-1/2"
      data-testid="boss-bar"
    >
      <div className="rounded-2xl border border-ink-600/70 bg-ink-900/88 px-4 py-2.5 shadow-lg shadow-black/40 backdrop-blur-sm">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="truncate font-display text-lg font-bold tracking-wide text-gold-200">
            {boss.name}
          </h2>
          <div className="flex shrink-0 items-center gap-3 text-xs">
            <span className="font-semibold text-muted">
              Phase {boss.phase} / {boss.phases}
              {boss.postlude && (
                <span className="ml-1 text-gold-200" data-testid="boss-postlude-phase">
                  · {POSTLUDE_NAME}
                </span>
              )}
            </span>
            {boss.enrageIn !== null && (
              <span
                className={`flex items-center gap-1 font-mono font-semibold ${enrageSoon ? 'text-lethal' : 'text-muted'}`}
                title="Time until the boss enrages"
              >
                <Icon name="hourglass" size={13} />
                Enrage {clock(boss.enrageIn)}
              </span>
            )}
          </div>
        </div>
        <div
          role="meter"
          aria-label={`${boss.name} health`}
          aria-valuemin={0}
          aria-valuemax={boss.maxHp}
          aria-valuenow={Math.round(boss.hp)}
          className="relative mt-1.5 h-4 overflow-hidden rounded-full border border-ink-500 bg-ink-800"
        >
          <div
            className="absolute inset-y-0 left-0 transition-[width] duration-150 ease-linear"
            style={{ width: `${hpPct}%`, background: 'linear-gradient(90deg,#be3a5b,#f43f5e)' }}
          />
          {boss.shield > 0 && (
            <div
              className="stripes absolute inset-y-0 left-0 transition-[width] duration-150 ease-linear"
              style={{ width: `${shieldPct}%`, backgroundColor: 'rgb(244 114 182 / 0.7)' }}
              title={`Discord shield ${fmt(boss.shield)}`}
            />
          )}
          {ticks.map((t) => (
            <span
              key={t}
              className="absolute inset-y-0 w-0.5 bg-gold-200"
              style={{ left: `${t}%` }}
              aria-hidden
            />
          ))}
        </div>
        <div className="mt-0.5 flex justify-between font-mono text-xs text-muted">
          <span>
            {fmt(boss.hp)} / {fmt(boss.maxHp)}
          </span>
          {boss.shield > 0 && (
            <span className="text-pink-300">Discord shield {fmt(boss.shield)}</span>
          )}
        </div>
        {/* The Finale (docs/phase-5d.md): the Conductor's Discord, then the Grand Silence's stave. */}
        {boss.discord && <DiscordStave discord={boss.discord} blind={blind} />}
        {boss.silence && (
          <SilenceStave silence={boss.silence} blind={blind} rewinds={rewind} reel={reel} />
        )}
        {boss.cast && (
          <div className="mt-1.5 rounded-lg bg-ink-950/60 px-3 py-1.5">
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-wider text-threat">
                <Icon name={bossCastIcon(boss.defId, !!boss.fortissimo)} size={14} />{' '}
                {boss.cast.name}
                {boss.pips !== undefined && boss.pips > 1 && (
                  <BlowPips pips={boss.pips} pip={boss.pip ?? 1} />
                )}
              </span>
              <span className="flex flex-wrap items-center justify-end gap-1">
                <span className="text-xs text-muted">Answer:</span>
                {blind ? (
                  <BlindAnswer />
                ) : (
                  boss.cast.answers.map((a) => <AnswerGlyph key={a} tag={a} rewind={rewind} />)
                )}
                {boss.cast.parried && !blind && (
                  // Phase 5e: your Ward is on Seren, and this blow is hers to parry.
                  <span
                    className="flex items-center gap-1 rounded-md border px-1 text-xs font-bold leading-5"
                    style={{ color: '#d8b4fe', borderColor: 'rgb(160 24 248 / 0.6)' }}
                    title={`${boss.cast.parried} is en garde: your Ward on her parries this blow`}
                    data-testid="cast-parried"
                  >
                    <Icon name="blades" size={12} /> Parried
                  </span>
                )}
              </span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-ink-700">
              <div
                className="h-full transition-[width] duration-150 ease-linear"
                style={{
                  width: `${Math.max(0, Math.min(1, boss.cast.progress)) * 100}%`,
                  background: 'linear-gradient(90deg,#fb923c,#f43f5e)',
                }}
              />
            </div>
          </div>
        )}
        {boss.executeTarget && (
          <p
            className="mt-1.5 flex items-center gap-1.5 rounded-lg border border-lethal/60 bg-ink-950/60 px-3 py-1 text-xs font-semibold text-rose-100"
            role="status"
            data-testid="boss-execute"
          >
            <Icon name="skull" size={14} className="text-lethal" />
            <span className="uppercase tracking-wider text-lethal">Execution</span>
            <span className="font-display text-sm font-bold">{boss.executeTarget}</span>
            <span className="text-muted">· below {EXECUTE_PCT}% when it lands dies</span>
          </p>
        )}
        {boss.postlude && <PostludeLine postlude={boss.postlude} />}
        {boss.tyrant && <TyrantLine tyrant={boss.tyrant} />}
        {boss.cue && <CueLine cue={boss.cue} blind={blind} />}
        {bossConditions(boss).map((c) => (
          <BossConditionLine key={c.id} condition={c} blind={blind} />
        ))}
        {boss.foreseen && (
          <p
            className="mt-1.5 flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs"
            style={{
              color: CHRONO.light,
              background: `color-mix(in srgb, ${CHRONO.color} 18%, rgb(5 8 20 / 0.6))`,
            }}
            role="status"
            aria-label={`Foresight: ${boss.foreseen.name} ${boss.foreseen.in < 0.05 ? 'is about to begin' : `begins in ${boss.foreseen.in.toFixed(1)} seconds`}${boss.foreseen.target ? `, at ${boss.foreseen.target}` : ''}`}
            data-testid="boss-foreseen"
          >
            <CallingGlyph icon="foresight" size={14} />
            <span className="font-semibold uppercase tracking-wider">Foresight</span>
            <span className="font-display text-sm font-bold">{boss.foreseen.name}</span>
            {boss.foreseen.target && <span>→ {boss.foreseen.target}</span>}
            <span className="ml-auto font-mono">{secondsLabel(boss.foreseen.in)}</span>
          </p>
        )}
      </div>
      {shown && !decreeBanner && <DecreeLine decree={shown} blind={blind} />}
    </div>
  );
}

/**
 * A condition under the boss bar (Movement II's Bloodmoon, Movement III's Spindles, stolen song,
 * Unravel, Mirror Ward, champion and Stitch): a glyph, a word and what it means (never colour
 * alone). Under Blind Score the answer after the "·" stays hidden.
 */
function BossConditionLine({ condition: c, blind }: { condition: BossCondition; blind: boolean }) {
  const text = blind ? c.text.split(' · ')[0]! : c.text;
  return (
    <p
      className="mt-1.5 flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-semibold"
      style={{ color: c.color, background: CONDITION_BG[c.id] ?? 'rgb(30 27 75 / 0.45)' }}
      role="status"
      data-testid={`boss-${c.id}`}
    >
      <Icon name={c.icon} size={14} />
      <span className="uppercase tracking-wider">{c.label}</span>
      <span className="font-normal text-rose-100">{text}</span>
      {c.bar !== undefined && (
        <span
          className="ml-auto h-1.5 w-20 overflow-hidden rounded-full bg-ink-700"
          role="meter"
          aria-label={`${c.label} health`}
          aria-valuemin={0}
          aria-valuemax={1}
          aria-valuenow={Number(c.bar.toFixed(2))}
          data-testid="boss-champion-bar"
        >
          <span
            className="block h-full"
            style={{ width: `${c.bar * 100}%`, background: c.color }}
          />
        </span>
      )}
    </p>
  );
}

/** Each condition's ground: Bloodmoon's crimson as it was; the Rift's indigo. */
const CONDITION_BG: Partial<Record<BossCondition['id'], string>> = {
  bloodmoon: 'rgb(127 29 29 / 0.35)',
};

/** A multi-blow cast's pips: "1/2", the blow being cast filled. */
function BlowPips({ pips, pip }: { pips: number; pip: number }) {
  return (
    <span
      className="ml-1 flex items-center gap-1"
      role="img"
      aria-label={`blow ${pip} of ${pips}`}
      data-testid="boss-pips"
    >
      {Array.from({ length: pips }, (_, i) => (
        <span
          key={i}
          className="h-2 w-2 rounded-full border border-threat"
          style={{ background: i < pip ? 'var(--color-threat)' : 'transparent' }}
        />
      ))}
      <span className="font-mono text-xs normal-case text-muted">
        {pip}/{pips}
      </span>
    </span>
  );
}

/** Blind Score where a cast's answers would be: the answer is the player's to read. */
function BlindAnswer() {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md border border-ink-500 bg-ink-900/70 px-1.5 py-0.5 text-xs font-semibold"
      style={{ color: BLIND_LOOK.color }}
      title={blindLine()}
      data-testid="blind-answer"
    >
      <Icon name={BLIND_LOOK.icon} size={13} />
      {levelName('blind_score')}
    </span>
  );
}

function DecreeLine({ decree, blind }: { decree: { name: string; text: string }; blind: boolean }) {
  const text = blind ? blindDecree(decree.text) : decree.text;
  return (
    <p
      className="mt-1.5 rounded-lg border border-ailment/50 bg-ink-900/85 px-3 py-1.5 text-xs leading-snug text-violet-200 backdrop-blur-sm"
      title={text}
      data-testid="decree-line"
    >
      <span className="mr-1.5 font-display text-sm font-bold text-violet-100">Decree</span>
      <span className="line-clamp-2">{text || decree.name}</span>
    </p>
  );
}

// ── The Finale (docs/phase-5d.md) ───────────────────────────────────────────────────────

/**
 * The Conductor's Discord as a stave meter under the HP bar: four segments of 25 (as the Weaver's
 * Resonance fills), the number, a bronze baton, the rise per second and when Fortissimo Silence
 * comes at that rate. Never colour alone: the glyph, the segments and the words say it.
 */
function DiscordStave({
  discord,
  blind,
}: {
  discord: NonNullable<BossHud['discord']>;
  blind: boolean;
}) {
  const segments = discordSegments(discord);
  const eta = fortissimoInText(discord);
  return (
    <div
      className="mt-1.5 rounded-lg px-3 py-1"
      style={{ background: 'rgb(122 86 70 / 0.18)', color: DISCORD_INK }}
      data-testid="boss-discord"
    >
      <p className="flex items-center gap-1.5 text-xs font-semibold" role="status">
        <Icon name="baton" size={14} style={{ color: DISCORD_INK }} />
        <span>{discordText(discord, blind)}</span>
        {discord.rate > 0 && (
          <span className="ml-auto whitespace-nowrap font-mono" title="Discord’s rise per second">
            ▲ +{discord.rate.toFixed(1)}/s
          </span>
        )}
      </p>
      <div
        className="mt-1 flex gap-1"
        role="meter"
        aria-label="Conductor’s Discord"
        aria-valuemin={0}
        aria-valuemax={discord.max}
        aria-valuenow={Math.floor(discord.value)}
        data-testid="boss-discord-meter"
      >
        {segments.map((fill, i) => (
          <span
            key={i}
            className="relative h-2 flex-1 overflow-hidden rounded-sm border"
            style={{ borderColor: DISCORD_HEX, background: 'rgb(5 8 20 / 0.6)' }}
            data-fill={Number(fill.toFixed(2))}
          >
            <span
              className="absolute inset-y-0 left-0"
              style={{ width: `${fill * 100}%`, background: DISCORD_HEX }}
            />
          </span>
        ))}
      </div>
      {eta && (
        <p className="mt-0.5 text-right font-mono text-xs" data-testid="boss-fortissimo-in">
          {eta}
        </p>
      )}
    </div>
  );
}

/**
 * The Grand Silence's stave, in Discord's place: eight pips, each filled with its note's source
 * glyph (Ward, Chime, Reel, Rewind), and the countdown to the Coda. It reads with the sound off.
 */
function SilenceStave({
  silence,
  blind,
  rewinds,
  reel,
}: {
  silence: NonNullable<BossHud['silence']>;
  blind: boolean;
  rewinds: boolean;
  reel: string | null;
}) {
  const pips = silencePips(silence);
  // The cap stretches with the windup assists; the bar is measured against the real one.
  const frac = silenceLeftFrac(silence);
  return (
    <div
      className="mt-1.5 rounded-lg border px-3 py-1.5"
      style={{
        borderColor: 'rgb(203 213 225 / 0.35)',
        background: 'rgb(30 33 45 / 0.6)',
        color: SILENCE_INK,
      }}
      data-testid="boss-silence"
    >
      <p className="flex items-center gap-1.5 text-xs font-semibold" role="status">
        <Icon name="mute" size={14} />
        <span className="uppercase tracking-wider">{silenceText(silence)}</span>
        <span className="ml-auto font-mono">{codaText(silence.left)}</span>
      </p>
      <ol
        className="relative mt-1 flex items-center justify-between gap-1"
        aria-label={`${silence.notes} of ${silence.of} notes played`}
        data-testid="boss-silence-stave"
      >
        <span className="absolute inset-x-0 top-1/2 h-px bg-slate-400/40" aria-hidden />
        {pips.map((source, i) => {
          const look = source ? NOTE_LOOK[source] : null;
          return (
            <li
              key={i}
              className="relative flex h-5 w-5 items-center justify-center rounded-full border"
              style={{
                borderColor: look ? look.color : 'rgb(203 213 225 / 0.45)',
                background: look ? 'rgb(245 215 142 / 0.16)' : 'rgb(5 8 20 / 0.85)',
                color: look?.color,
              }}
              aria-label={look ? `note ${i + 1}: ${look.label}` : `note ${i + 1}: not yet`}
              data-note={source ?? ''}
            >
              {look && <Icon name={look.icon} size={12} />}
            </li>
          );
        })}
      </ol>
      <div className="mt-1 h-1 overflow-hidden rounded-full bg-ink-700" aria-hidden>
        <div className="h-full bg-slate-300/70" style={{ width: `${frac * 100}%` }} />
      </div>
      {!blind && (
        <p className="mt-0.5 text-xs text-slate-300" data-testid="boss-silence-ask">
          {silenceAsk({ rewinds, reel })}
        </p>
      )}
    </div>
  );
}

/** The Cue: the soloist and its Solo (the target once it begins), and how to answer it. */
function CueLine({ cue, blind }: { cue: NonNullable<BossHud['cue']>; blind: boolean }) {
  return (
    <p
      className="mt-1.5 flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-semibold"
      style={{ color: DISCORD_INK, background: 'rgb(122 86 70 / 0.22)' }}
      role="status"
      data-testid="boss-cue"
    >
      <Icon name="baton" size={14} />
      <span className="font-display text-sm font-bold">{cueText(cue)}</span>
      {!blind && <span className="font-normal text-rose-100">· {CUE_ANSWER}</span>}
    </p>
  );
}
