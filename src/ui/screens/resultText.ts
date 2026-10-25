/** Plain-text parts of the Result screen (testable without React). */
import type { EncounterResult } from '../../meta/types';
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

/** Plain-English lines for a fight (also reused by tests and the lab). */
export function statLines(r: EncounterResult): { icon: IconName; text: string; muted?: boolean }[] {
  const s = r.stats;
  const lines: { icon: IconName; text: string; muted?: boolean }[] = [];
  lines.push({
    icon: 'mend',
    text:
      s.healing > 0
        ? `Mend and auras healed ${fmt(s.healing)} life${s.overheal > 0 ? `; ${fmt(s.overheal)} more was wasted on heroes who were already full` : ''}.`
        : 'You did no healing this fight.',
    muted: s.healing === 0,
  });
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
      s.amplified > 0
        ? `Your Empower thread and auras added ${fmt(s.amplified)} damage, ${pct(s.partyDamage > 0 ? s.amplified / s.partyDamage : 0)} of everything your party dealt.`
        : 'Empower added no damage. Switch the Thread (right-click) when everyone is healthy.',
    muted: s.amplified === 0,
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
