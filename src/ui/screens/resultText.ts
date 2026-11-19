/** Plain-text parts of the Result screen (testable without React). */
import type { DeathRecap, EncounterResult, EncounterStats, RunCalling } from '../../meta/types';
import { CONTENT } from '../../content';
import { downAdvice, downFallback, GROVE_FELT_OUTSIDE } from '../../meta/run';
import { callingResultLine, rewindsFor, techniqueName } from './callingText';
import { callingLook } from '../kit/callingLook';
import { auraVerbs, type ContributionParts } from '../contribution';
import { fmt, pct } from '../kit/format';
import { ANSWER } from '../hud/labels';
import { doomMax } from '../hud/riftLook';
import {
  ALTO,
  BASS,
  BASSO_OSTINATO,
  CONDUCTOR,
  CADENZA,
  DOWNBEAT,
  FINAL_CADENCE,
  FORTISSIMO,
  HALF_CADENCE,
  LAMENT,
  MEASURE,
  REST,
  SFORZANDO,
  SHATTER_ARIA,
  SOPRANO,
  TENOR,
} from '../../content/crucibleIds';
import type { IconName } from '../kit/iconPaths';
import { triggerIcon, triggerSentence, triggerTallies, type TriggerContent } from '../hud/triggers';
import { t as txt } from '../text';

export const HIGHLIGHT_ICON: Record<EncounterResult['highlights'][number]['kind'], IconName> = {
  perfect: 'ward',
  save: 'heart',
  clutch: 'chime',
  reel: 'reel',
  cue: 'note',
  crescendo: 'sparkle',
  revive: 'mend',
  response: 'call',
  fermata: 'fermata',
};

/** Calls answered and Fermata holds stand out from the other highlights. */
export const HIGHLIGHT_COLOR: Partial<
  Record<EncounterResult['highlights'][number]['kind'], string>
> = {
  response: 'var(--color-call, #fde68a)',
  fermata: '#e2d6f8',
};

/**
 * A technique the death recap found ready but unused (`readyTechniques`): Reel's slot is
 * Rewind's on a Chronomancer run (Phase 3e).
 */
export function readyName(t: string, callingId: string | null | undefined): string {
  if (t === 'ward' || t === 'chime' || t === 'reel' || t === 'glide')
    return techniqueName(t, callingId);
  return (CONTENT.techniques as Record<string, { name?: string }>)[t]?.name ?? t;
}

/**
 * The answers a death names, for the run's Calling: on a Chronomancer run Reel's slot casts
 * Rewind, which frees no one, so Reel is never named. A pin's answer becomes Ward (it soaks what
 * the pin deals, as the HUD's hint says) and a latch's becomes Chime. Deduplicated, in order.
 */
export function deathAnswers(
  answers: readonly string[] | undefined,
  callingId?: string | null,
): string[] {
  const tags = [...new Set(answers ?? [])];
  if (!rewindsFor(callingId) || !tags.includes('reel')) return tags;
  const rest = tags.filter((t) => t !== 'reel');
  // Reel alone answered the pin; a latch keeps its Chime.
  return rest.length > 0 ? rest : ['ward'];
}

/**
 * Phase 5a: a death names what answered it (the recap's `answers`: a damage-over-time status's,
 * Execution's, a Blood Pact's): "Answer: Chime", "Answers: Mend or Ward". Calling-aware like
 * `readyName` (`deathAnswers`). Null when the recap has none (every Movement I death).
 */
export function deathAnswerLine(
  answers: readonly string[] | undefined,
  callingId?: string | null,
): string | null {
  const names = deathAnswers(answers, callingId).map(
    (a) => (ANSWER as Record<string, { label: string } | undefined>)[a]?.label ?? a,
  );
  if (names.length === 0) return null;
  return `${names.length === 1 ? txt('screens.resultText.answer') : txt('screens.resultText.answers')}: ${names.join(' or ')}`;
}

/**
 * Phase 5b: the line a death's recap leads with. A Blood Rage hero's down names what it asked of
 * the Weaver (`downAdvice`: a refused Rally, a quartered heal, Twin Cleave with no dome), in place
 * of the generic answers; any other death keeps `deathAnswerLine`. `party` is the fight's.
 */
export function deathAdviceLine(
  d: Pick<DeathRecap, 'heroId' | 'killer' | 'blood' | 'answers'> &
    Partial<Pick<DeathRecap, 'duel' | 'grove'>>,
  party: readonly string[],
  callingId?: string | null,
  /** The run's Reel variant (`run.techniques.reel`): Anchor and Swap answer Seren with Rally. */
  reelVariant?: string | null,
): string | null {
  return (
    // Phase 5e: Seren's and Oro's downs name their own answers (Calling- and Reel-aware for
    // Seren's Rally).
    downAdvice(d, party, callingId, reelVariant) ??
    riftDownLine(d, callingId) ??
    finaleDownLine(d, callingId) ??
    deathAnswerLine(d.answers, callingId) ??
    // …and every one of their downs names one (docs/phase-5e.md exit criterion 4).
    downFallback(d)
  );
}

const NUMBER_WORDS = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
];
/** The source name the sim gives Unravel's ticks (docs/phase-5c.md Q12). */
const UNRAVEL_SOURCE = 'Unravel — your Mend';
const attackName = (id: string) => CONTENT.attacks.find((a) => a.id === id)?.name;

/**
 * Phase 5c: a Movement III down names its answer in words (docs/phase-5c.md "Recaps"): a blow from
 * a possessed ally, Doom's burst, the Void Maw's pull, the Snip, and your own Mend unravelled. Keyed
 * on the recap's killer as the sim names it (an attack's name, a status tick's `Voided (…)`, a
 * possessed hero's `<Hero> (possessed)`), so every Movement I and II death gets null and keeps
 * its line. Calling-aware: on a Chronomancer run Rewind takes Reel's place.
 */
export function riftDownLine(
  d: Pick<DeathRecap, 'heroId' | 'killer' | 'answers'>,
  callingId?: string | null,
): string | null {
  const name = CONTENT.heroes.find((h) => h.id === d.heroId)?.name ?? d.heroId;
  const possessed = /^(.+) \(possessed\)$/.exec(d.killer);
  if (possessed)
    return txt('screens.resultText.struckByPossessedChime', { name, value: possessed[1] });
  if (d.killer === UNRAVEL_SOURCE || d.killer.startsWith('Unravelled'))
    return txt('screens.resultText.yourMendUnravelledSwitch');
  if (d.killer === attackName('doom_burst'))
    return txt('screens.resultText.doomChimeBeforeOr', {
      value: NUMBER_WORDS[doomMax()] ?? doomMax(),
    });
  if (d.killer.startsWith('Voided'))
    return rewindsFor(callingId)
      ? txt('screens.resultText.pulledIntoTheMaw')
      : txt('screens.resultText.pulledIntoTheMaw2');
  if (d.killer === attackName('unweaver_snip')) return txt('screens.resultText.snipRetargetOffThe');
  return null;
}

/**
 * The Finale (docs/phase-5d.md "Recaps"): every down in the Silent Conductor's fight names its
 * answer in words, keyed on the killer as the sim names it (an attack's name, a voice's or the
 * Conductor's name for its basic blow). The Finale's names are its own, so every Movement I-III death gets null and
 * keeps its line. Calling-aware: on a Chronomancer run Rewind takes Reel's place.
 */
export function finaleDownLine(
  d: Pick<DeathRecap, 'killer'>,
  callingId?: string | null,
): string | null {
  const rewinds = rewindsFor(callingId);
  const out = rewinds
    ? txt('screens.resultText.rewindThemBackOut')
    : txt('screens.resultText.reelThemOut');
  const k = d.killer;
  if (k === attackName(LAMENT)) return txt('screens.resultText.lamentChimeItAway');
  if (k === attackName(BASSO_OSTINATO)) return txt('screens.resultText.bassoOstinatoWardOn');
  if (k === attackName(CADENZA)) return txt('screens.resultText.cadenzaOrStepAside', { out });
  if (k === attackName(SHATTER_ARIA)) return txt('screens.resultText.shatterAriaScatterSo');
  if (k === attackName(DOWNBEAT)) return txt('screens.resultText.downbeatWardOrDome');
  if (k === attackName(SFORZANDO))
    return txt('screens.resultText.sforzandoStepOutOf', {
      value: rewinds ? txt('screens.resultText.rewindThem') : txt('screens.resultText.reelThemOut'),
    });
  if (FORTISSIMO.some((id) => k === attackName(id)))
    return txt('screens.resultText.fortissimoSilenceCrescendoBefore');
  if (k === attackName(REST)) return txt('screens.resultText.restChimeItAway');
  if (
    k === attackName(MEASURE) ||
    k === attackName(FINAL_CADENCE) ||
    k === attackName(HALF_CADENCE)
  )
    return txt('screens.resultText.onlyYouCanAnswer', {
      value: rewinds
        ? txt('screens.resultText.rewindTheBlow')
        : txt('screens.resultText.reelThemOut'),
    });
  if (
    [ALTO, BASS, TENOR, SOPRANO].some((id) => k === CONTENT.enemies.find((e) => e.id === id)?.name)
  )
    return txt('screens.resultText.theMirrorChoirFocus');
  // The Conductor's own baton (its basic melee): no telegraph answers it, so the recap names the
  // steady answer.
  if (k === CONTENT.enemies.find((e) => e.id === CONDUCTOR)?.name)
    return txt('screens.resultText.theConductorSBaton', {
      value: rewinds
        ? txt('screens.resultText.rewindTheBlow')
        : txt('screens.resultText.reelThemOutOf'),
    });
  return null;
}

/**
 * Phase 5b: what a hero's downs this run asked of the Weaver (`downAdvice`), each distinct line
 * once with how many downs it answers, in the order first met. Empty for every hero without
 * `blood` (the default party), so the Summary shows nothing new for them.
 */
export function runDownAdvice(
  results: readonly Pick<EncounterResult, 'deaths' | 'heroes'>[],
  heroId: string,
  callingId?: string | null,
  /** The run's Reel variant (`run.techniques.reel`): Anchor and Swap answer Seren with Rally. */
  reelVariant?: string | null,
): { text: string; count: number }[] {
  const out: { text: string; count: number }[] = [];
  for (const r of results) {
    const party = r.heroes.map((h) => h.heroId);
    for (const d of r.deaths) {
      if (d.heroId !== heroId) continue;
      // Oro's Saplings felled outside your songs: a line of their own here (`downFallback`).
      const text =
        downAdvice(d, party, callingId, reelVariant) ??
        (d.grove && d.grove.feltOutside > 0 ? GROVE_FELT_OUTSIDE : null);
      if (!text) continue;
      const seen = out.find((a) => a.text === text);
      if (seen) seen.count++;
      else out.push({ text, count: 1 });
    }
  }
  return out;
}

/**
 * The recap's line on the techniques that were ready: "ready" lists them (`couldAnswer`: one of
 * them answers the death, or the death names no answer, as every Movement I death); "cooldown"
 * when nothing was ready and every named answer is a technique (Chime, Reel, Ward), as true as
 * ever; null when nothing was ready but a named answer is never on cooldown (Mend, Scatter), so
 * the recap must not say everything was.
 */
/** The answers that are techniques with a cooldown or charges (the rest, Mend and Scatter, are always there). */
const COOLDOWN_ANSWERS: ReadonlySet<string> = new Set(['chime', 'reel', 'ward']);

export function deathReadyLine(
  d: Pick<DeathRecap, 'readyTechniques' | 'answers'>,
  callingId?: string | null,
): { kind: 'ready'; names: string; couldAnswer: boolean } | { kind: 'cooldown' } | null {
  const wanted = deathAnswers(d.answers, callingId);
  if (d.readyTechniques.length === 0)
    return wanted.some((a) => !COOLDOWN_ANSWERS.has(a)) ? null : { kind: 'cooldown' };
  // Reel's slot is Rewind's on a Chronomancer run, and `deathAnswers` never names Reel there.
  const rewinds = rewindsFor(callingId);
  return {
    kind: 'ready',
    names: d.readyTechniques.map((t) => readyName(t, callingId)).join(', '),
    couldAnswer:
      wanted.length === 0 ||
      d.readyTechniques.some((t) => wanted.includes(t) && !(t === 'reel' && rewinds)),
  };
}

/** A fight's (or a run's) stats as the auras / Thread / everything split. */
export function contributionOf(s: EncounterStats): ContributionParts {
  return {
    auras: { healing: s.auraHealing, shielded: s.auraShielded, amplified: s.auraAmplified },
    thread: { healing: s.threadHealing, amplified: s.threadAmplified },
    total: s.healing + s.shielded + s.negated + s.amplified,
  };
}

export interface StatLine {
  icon: IconName;
  text: string;
  muted?: boolean;
  /** Drawn in the Calling's colour (Phase 3c). */
  calling?: boolean;
}

/**
 * The Calling's line (Phase 3c, 3d, 3e): "Radiance: +412 damage through your heroes · Haloed: 96
 * damage kept off", named by the path; the Martyr's "Bore 640 for your heroes · 1,280 kept off
 * them"; the Chronomancer's "Rewind gave back 1,240 life · stood 1 hero back up"; the
 * Conductor's "+412 damage through your heroes · 3 Duets · 1 Trio · Grand Finale played 6 Solos ·
 * 4 free Cues"; nothing if it did nothing (or there is no Calling).
 */
export function callingLine(
  s: Pick<EncounterStats, 'callingAmplified' | 'callingShielded'> &
    Partial<
      Pick<EncounterStats, 'callingBorne' | 'callingRewound' | 'callingRevived' | 'conducting'>
    >,
  calling: (Pick<RunCalling, 'path'> & { id?: string }) | null | undefined,
): StatLine | null {
  const text = callingResultLine(s, calling ?? null);
  return text ? { icon: callingLook(calling?.id).icon, text: `${text}.`, calling: true } : null;
}

/**
 * Phase 5g (docs/phase-5g.md): one line per motif, relic or boon whose rule is a trigger, from
 * the fight's (or the run's) `triggers`: "Clean Strike triggered 3 times.", named from content;
 * a held one that never fired reads muted. Nothing without `triggers` (no trigger held).
 */
export function triggerLines(
  s: Pick<EncounterStats, 'triggers'>,
  content?: TriggerContent,
): StatLine[] {
  return triggerTallies(s.triggers, content).map((t) => ({
    icon: triggerIcon(t.source),
    text: triggerSentence(t),
    ...(t.count <= 0 ? { muted: true } : {}),
  }));
}

/**
 * One tile on the Result or the Summary (the third menu pass): a number, a short label, and at
 * most a short line of the numbers under it. `sr` is the whole sentence a screen reader hears.
 */
export interface StatTile {
  id: string;
  icon: IconName;
  value: string;
  label: string;
  detail?: string;
  /** Nothing to show yet: drawn quiet. */
  muted?: boolean;
  color: string;
  sr: string;
}

const TILE_COLOR = {
  heal: 'var(--color-heal)',
  amp: 'var(--color-amp)',
  shield: 'var(--color-shield)',
  save: '#f9a8d4',
  chime: '#c4b5fd',
  gold: 'var(--color-gold-300)',
  call: 'var(--color-call, #fde68a)',
  fermata: '#e2d6f8',
} as const;

function tile(t: Omit<StatTile, 'sr'>): StatTile {
  const sr = txt('screens.resultText.tileSr', { value: t.value, label: t.label });
  return { ...t, sr: t.detail ? `${sr} ${t.detail}.` : sr };
}

const ofN = (n: number, total: number) => txt('screens.resultText.tileOf', { n, total });

/**
 * A fight's (or a run's) support as tiles. Healed, Damage added and Damage stopped always show,
 * quiet at zero; every other tile shows only when its number is not zero. Solos show as "7 of 9"
 * over "Solos Cued" once any Solo fired, Cued or not.
 */
export function statTiles(
  s: EncounterStats,
  opts: {
    callingId?: string | null;
    /** Fermata holds the Weaver healed through in time (the fight's or run's highlights). */
    fermataHealed?: number;
  } = {},
): StatTile[] {
  const out: StatTile[] = [];
  const join = (...parts: (string | null | false)[]) =>
    parts.filter((p): p is string => !!p).join(' · ') || undefined;
  out.push(
    tile({
      id: 'healed',
      icon: 'mend',
      color: TILE_COLOR.heal,
      value: fmt(s.healing),
      label: txt('screens.resultText.tileHealed'),
      detail:
        s.healing > 0
          ? join(
              txt('screens.resultText.tileSplitHeal', {
                auras: fmt(s.auraHealing),
                beam: fmt(s.threadHealing),
              }),
              s.overheal > 0 &&
                txt('screens.resultText.tileOverheal', { overheal: fmt(s.overheal) }),
            )
          : undefined,
      muted: s.healing <= 0,
    }),
  );
  out.push(
    tile({
      id: 'amplified',
      icon: 'empower',
      color: TILE_COLOR.amp,
      value: fmt(s.amplified),
      label: txt('screens.resultText.tileDamageAdded'),
      detail:
        s.amplified > 0
          ? join(
              txt('screens.resultText.tileSplitDamage', {
                auras: fmt(s.auraAmplified),
                empower: fmt(s.threadAmplified),
              }),
              s.partyDamage > 0 &&
                txt('screens.resultText.tilePartyShare', { pct: pct(s.amplified / s.partyDamage) }),
            )
          : undefined,
      muted: s.amplified <= 0,
    }),
  );
  const stopped = s.shielded + s.negated;
  out.push(
    tile({
      id: 'stopped',
      icon: 'ward',
      color: TILE_COLOR.shield,
      value: fmt(stopped),
      label: txt('screens.resultText.tileDamageStopped'),
      detail:
        stopped > 0
          ? txt('screens.resultText.tileShields', { shielded: fmt(s.shielded) })
          : undefined,
      muted: stopped <= 0,
    }),
  );
  if (s.perfects > 0)
    out.push(
      tile({
        id: 'perfects',
        icon: 'ward',
        color: TILE_COLOR.shield,
        value: String(s.perfects),
        label: txt(
          s.perfects === 1
            ? 'screens.resultText.tilePerfectWard'
            : 'screens.resultText.tilePerfectWards',
        ),
        detail: txt('screens.resultText.tileNegated', { negated: fmt(s.negated) }),
      }),
    );
  if (s.saves > 0)
    out.push(
      tile({
        id: 'saves',
        icon: 'heart',
        color: TILE_COLOR.save,
        value: String(s.saves),
        label: txt(s.saves === 1 ? 'screens.resultText.tileSave' : 'screens.resultText.tileSaves'),
      }),
    );
  if (s.cleanses > 0)
    out.push(
      tile({
        id: 'cleanses',
        icon: 'chime',
        color: TILE_COLOR.chime,
        value: String(s.cleanses),
        label: txt(
          s.cleanses === 1
            ? 'screens.resultText.tileCleansedOne'
            : 'screens.resultText.tileCleansed',
        ),
        detail:
          s.clutchCleanses > 0
            ? txt('screens.resultText.tileClutch', { n: s.clutchCleanses })
            : undefined,
      }),
    );
  if (s.reels > 0) {
    // On a Chronomancer run Reel's slot is Rewind's.
    const rewind = rewindsFor(opts.callingId);
    out.push(
      tile({
        id: 'reels',
        icon: rewind ? 'rewind' : 'reel',
        color: TILE_COLOR.chime,
        value: String(s.reels),
        label: txt(rewind ? 'screens.resultText.tileRewound' : 'screens.resultText.tileReeled'),
      }),
    );
  }
  // Every Solo the heroes fired, and how many had your Thread on them: "7 of 9 Solos Cued". A
  // fight saved before plain Solos were counted shows the Cued ones alone.
  const solos = s.plainSolos === undefined ? null : s.cues + s.plainSolos;
  if ((solos ?? s.cues) > 0)
    out.push(
      tile({
        id: 'solos',
        icon: 'note',
        color: TILE_COLOR.gold,
        value: solos === null ? String(s.cues) : ofN(s.cues, solos),
        label: txt(
          (solos ?? s.cues) === 1
            ? 'screens.resultText.tileSoloCued'
            : 'screens.resultText.tileSolosCued',
        ),
      }),
    );
  if (s.crescendos > 0)
    out.push(
      tile({
        id: 'crescendos',
        icon: 'sparkle',
        color: TILE_COLOR.gold,
        value: String(s.crescendos),
        label: txt(
          s.crescendos === 1
            ? 'screens.resultText.tileCrescendo'
            : 'screens.resultText.tileCrescendos',
        ),
      }),
    );
  if (s.calls > 0)
    out.push(
      tile({
        id: 'calls',
        icon: 'call',
        color: TILE_COLOR.call,
        value: ofN(s.responses, s.calls),
        label: txt('screens.resultText.tileCalls'),
        muted: s.responses <= 0,
      }),
    );
  if (s.holds > 0)
    out.push(
      tile({
        id: 'holds',
        icon: 'fermata',
        color: TILE_COLOR.fermata,
        value: String(s.holds),
        label: txt(s.holds === 1 ? 'screens.resultText.tileHold' : 'screens.resultText.tileHolds'),
        detail:
          (opts.fermataHealed ?? 0) > 0
            ? txt('screens.resultText.tileHealedThrough', { n: opts.fermataHealed! })
            : undefined,
      }),
    );
  if (s.telegraphsAimed > 0)
    out.push(
      tile({
        id: 'attacks',
        icon: 'focus',
        color: TILE_COLOR.gold,
        value: ofN(s.telegraphsAnswered, s.telegraphsAimed),
        label: txt('screens.resultText.tileAttacks'),
      }),
    );
  return out;
}

/**
 * At most two things to do better next time, the most useful first: the Thread unused, no Ward
 * landed, the auras unheard, Empower never used, a call never answered. None when all went well.
 */
export function coachLines(s: EncounterStats): string[] {
  const out: string[] = [];
  const thread = s.threadHealing >= 1 || s.threadAmplified >= 1;
  if (!thread) out.push(txt('screens.resultText.coachThread'));
  if (s.shielded + s.negated <= 0) out.push(txt('screens.resultText.coachWard'));
  if (!auraVerbs(contributionOf(s).auras)) out.push(txt('screens.resultText.coachAuras'));
  if (thread && s.threadAmplified < 1) out.push(txt('screens.resultText.coachEmpower'));
  if (s.calls > 0 && s.responses === 0) out.push(txt('screens.resultText.coachCalls'));
  return out.slice(0, 2);
}
