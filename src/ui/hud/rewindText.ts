/**
 * The Chronomancer's Rewind in words (Phase 3e), testable without React: the mark on a hero's
 * frame ("Rewind +540", "Rewind: stands back up", "Rewind: out of reach") and the sentence for
 * the F button and the frame's accessible label. Numbers come from the sim's preview
 * (`HeroHud.rewind`, read from the hero's `past`).
 */
import { fmt } from '../kit/format';
import type { RewindHud } from '../store';
import { t } from '../text';

/** What going back does about the hit on its way: " · dodges it", " · undoes it". */
function escapeWords(r: RewindHud): string {
  return r.escape === 'undo'
    ? t('hud.rewindText.undoesIt')
    : r.escape === 'dodge'
      ? t('hud.rewindText.dodgesIt')
      : '';
}

/**
 * The frame's mark, or null when Rewind would only move them back (nothing to give back and
 * nothing to escape): "Rewind +540", "Rewind +540 · dodges it", "Rewind: stands back up",
 * "Rewind: revive spent", "Rewind: out of reach".
 */
export function rewindMark(r: RewindHud): string | null {
  switch (r.kind) {
    case 'revive':
      return t('hud.rewindText.rewindStandsBackUp');
    case 'spent':
      return t('hud.rewindText.rewindReviveSpent');
    case 'reach':
      return t('hud.rewindText.rewindOutOfReach');
    case 'restore':
      return t('hud.rewindText.rewind', {
        amount: fmt(r.amount),
        value: r.escape ? ` · ${escapeWords(r)}` : '',
      });
    case 'none':
      return r.escape ? `Rewind: ${escapeWords(r)}` : null;
  }
}

/**
 * A whole sentence (the F button's label and tooltip, a frame's accessible label): "Kael gets
 * 540 life back", "Lyra stands back up with 612 life, once a run", "Vexis has been down too
 * long".
 */
export function rewindSentence(name: string, r: RewindHud): string {
  const away =
    r.escape === 'undo'
      ? t('hud.rewindText.andTheAttacksOn')
      : r.escape === 'dodge'
        ? t('hud.rewindText.outOfTheHit')
        : '';
  switch (r.kind) {
    case 'revive':
      return t('hud.rewindText.standsBackUpWith', {
        name,
        amount: fmt(r.amount),
        left: r.left.toFixed(1),
      });
    case 'spent':
      return t('hud.rewindText.rewindHasStoodA', { name });
    case 'reach':
      return t('hud.rewindText.hasBeenDownToo', { name });
    case 'restore':
      return t('hud.rewindText.getsLifeBack', { name, amount: fmt(r.amount), away });
    case 'none':
      return t('hud.rewindText.goesBackToWhere', { name, away });
  }
}
