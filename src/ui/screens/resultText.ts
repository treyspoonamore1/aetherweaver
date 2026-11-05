/** Plain-text parts of the Result screen (testable without React). */
import type { DeathRecap, EncounterResult, EncounterStats, RunCalling } from '../../meta/types';
import { CONTENT } from '../../content';
import { downAdvice } from '../../meta/run';
import { callingResultLine, rewindsFor, techniqueName } from './callingText';
import { callingLook } from '../kit/callingLook';
import { auraVerbs, splitContribution, type ContributionParts } from '../contribution';
import { fmt, pct, plural } from '../kit/format';
import { ANSWER } from '../hud/labels';
import { doomMax } from '../hud/riftLook';
import type { IconName } from '../kit/iconPaths';

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
  return `${names.length === 1 ? 'Answer' : 'Answers'}: ${names.join(' or ')}`;
}

/**
 * Phase 5b: the line a death's recap leads with. A Blood Rage hero's down names what it asked of
 * the Weaver (`downAdvice`: a refused Rally, a quartered heal, Twin Cleave with no dome), in place
 * of the generic answers; any other death keeps `deathAnswerLine`. `party` is the fight's.
 */
export function deathAdviceLine(
  d: Pick<DeathRecap, 'heroId' | 'killer' | 'blood' | 'answers'>,
  party: readonly string[],
  callingId?: string | null,
): string | null {
  return (
    downAdvice(d, party) ?? riftDownLine(d, callingId) ?? deathAnswerLine(d.answers, callingId)
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
  if (possessed) return `${name}, struck by ${possessed[1]} (possessed): Chime frees them`;
  if (d.killer === UNRAVEL_SOURCE || d.killer.startsWith('Unravelled'))
    return 'Your Mend, unravelled: switch to Empower';
  if (d.killer === attackName('doom_burst'))
    return `Doom: Chime before ${NUMBER_WORDS[doomMax()] ?? doomMax()}, or Ward the burst`;
  if (d.killer.startsWith('Voided'))
    return rewindsFor(callingId)
      ? 'Pulled into the Maw: Rally, or Rewind them back'
      : 'Pulled into the Maw: Rally or Reel';
  if (d.killer === attackName('unweaver_snip')) return 'Snip: Retarget off the line';
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
): { text: string; count: number }[] {
  const out: { text: string; count: number }[] = [];
  for (const r of results) {
    const party = r.heroes.map((h) => h.heroId);
    for (const d of r.deaths) {
      if (d.heroId !== heroId) continue;
      const text = downAdvice(d, party);
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
 * them"; the Chronomancer's "Rewind gave back 1,240 life · stood 1 hero back up"; nothing if it
 * did nothing (or there is no Calling).
 */
export function callingLine(
  s: Pick<EncounterStats, 'callingAmplified' | 'callingShielded'> &
    Partial<Pick<EncounterStats, 'callingBorne' | 'callingRewound' | 'callingRevived'>>,
  calling: (Pick<RunCalling, 'path'> & { id?: string }) | null | undefined,
): StatLine | null {
  const text = callingResultLine(s, calling ?? null);
  return text ? { icon: callingLook(calling?.id).icon, text: `${text}.`, calling: true } : null;
}

/**
 * The auras' and the Thread's lines: "Your auras healed 1,840, shielded 960 and added 2,210
 * damage: 38% of everything you did." / "Your beam healed 2,630 and Empower added 1,980
 * damage." (Shared by the Result and the Summary.)
 */
export function songLines(s: EncounterStats): StatLine[] {
  const split = splitContribution(contributionOf(s));
  const verbs = auraVerbs(contributionOf(s).auras);
  const lines: StatLine[] = [];
  lines.push(
    verbs
      ? {
          icon: 'note',
          text: `Your auras ${verbs}: ${pct(split.auraShare)} of everything you did.`,
        }
      : {
          icon: 'note',
          text: 'Your auras did nothing this time. Sing them where the party is: the beam song on whoever you thread, the field song around you.',
          muted: true,
        },
  );
  const heal = s.threadHealing >= 1;
  const amp = s.threadAmplified >= 1;
  lines.push({
    icon: 'thread',
    text:
      heal && amp
        ? `Your beam healed ${fmt(s.threadHealing)} and Empower added ${fmt(s.threadAmplified)} damage.`
        : heal
          ? `Your beam healed ${fmt(s.threadHealing)}. Empower added no damage: right-click when everyone is healthy.`
          : amp
            ? `Empower added ${fmt(s.threadAmplified)} damage. Your beam healed nothing.`
            : 'Your Thread did no healing or damage. Thread a hero with 1–4 or a click.',
    muted: !heal && !amp,
  });
  return lines;
}

/** Plain-English lines for a fight (also reused by tests and the lab). */
export function statLines(
  r: EncounterResult,
  /** The run's Calling, to name its line by the path (Radiance, Eclipse, Haloed; the Martyr). */
  calling?: (Pick<RunCalling, 'path'> & { id?: string }) | null,
): StatLine[] {
  const s = r.stats;
  const lines: StatLine[] = songLines(s);
  const shine = callingLine(s, calling);
  if (shine) lines.push(shine);
  lines.push({
    icon: 'ward',
    text:
      s.shielded + s.negated > 0
        ? `${fmt(s.shielded + s.negated)} damage never landed: ${fmt(s.shielded)} stopped by your shields and auras, and ${fmt(s.negated)} negated by ${s.perfects} Perfect ${plural(s.perfects, 'Ward')}.`
        : 'No Wards landed. A Ward just before a big hit absorbs it.',
    muted: s.shielded + s.negated === 0,
  });
  lines.push({
    icon: 'empower',
    text:
      s.healing + s.amplified > 0
        ? `In all you healed ${fmt(s.healing)} life${s.overheal > 0 ? ` (${fmt(s.overheal)} more went to heroes already full)` : ''} and added ${fmt(s.amplified)} damage, ${pct(s.partyDamage > 0 ? s.amplified / s.partyDamage : 0)} of everything your party dealt.`
        : 'You did no healing and added no damage this fight.',
    muted: s.healing + s.amplified === 0,
  });
  if (s.saves > 0) {
    lines.push({
      icon: 'heart',
      text: `Saved a hero from a lethal blow ${s.saves} ${plural(s.saves, 'time')}.`,
    });
  }
  if (s.cleanses > 0) {
    lines.push({
      icon: 'chime',
      text: `Cleansed ${s.cleanses} ${plural(s.cleanses, 'mark')}${s.clutchCleanses > 0 ? `, ${s.clutchCleanses} of them at the last moment` : ''}.`,
    });
  }
  if (s.reels > 0)
    lines.push(
      // On a Chronomancer run Reel's slot is Rewind's, and going back out of a hit dodges it.
      rewindsFor(calling?.id)
        ? {
            icon: 'rewind',
            text: `Rewind took heroes out of danger ${s.reels} ${plural(s.reels, 'time')}.`,
          }
        : {
            icon: 'reel',
            text: `Reeled heroes out of danger ${s.reels} ${plural(s.reels, 'time')}.`,
          },
    );
  if (s.cues + s.crescendos > 0) {
    lines.push({
      icon: 'note',
      text: `Cued ${s.cues} ${plural(s.cues, 'Solo')}${s.crescendos > 0 ? ` and sang ${s.crescendos} ${plural(s.crescendos, 'Crescendo')}` : ''}.`,
    });
  }
  if (s.calls > 0) {
    lines.push({
      icon: 'call',
      text:
        s.responses > 0
          ? `Answered ${s.responses} of ${s.calls} ${plural(s.calls, 'call')} for help: ${s.responses} ${plural(s.responses, 'Flourish', 'Flourishes')}.`
          : `Your party called for help ${s.calls} ${plural(s.calls, 'time')}. Answer with what they ask for and the move becomes a Flourish.`,
      muted: s.responses === 0,
    });
  }
  if (s.holds > 0) {
    const healed = r.highlights.filter((h) => h.kind === 'fermata').length;
    lines.push({
      icon: 'fermata',
      text: `Fermata caught ${s.holds} lethal ${plural(s.holds, 'hit')} and held the hero at 1 life${healed > 0 ? `; you healed ${healed === s.holds ? (s.holds === 1 ? 'them' : 'every one') : healed} through the hold` : ''}.`,
    });
  }
  if (s.telegraphsAimed > 0) {
    lines.push({
      icon: 'focus',
      text: `Answered ${s.telegraphsAnswered} of ${s.telegraphsAimed} enemy attacks aimed at your party.`,
    });
  }
  return lines;
}
