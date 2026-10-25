/** Plain-text parts of the Result screen (testable without React). */
import type { EncounterResult, EncounterStats } from '../../meta/types';
import { auraVerbs, splitContribution, type ContributionParts } from '../contribution';
import { fmt, pct, plural } from '../kit/format';
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
export function statLines(r: EncounterResult): StatLine[] {
  const s = r.stats;
  const lines: StatLine[] = songLines(s);
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
    lines.push({
      icon: 'reel',
      text: `Reeled heroes out of danger ${s.reels} ${plural(s.reels, 'time')}.`,
    });
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
