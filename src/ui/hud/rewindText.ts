/**
 * The Chronomancer's Rewind in words (Phase 3e), testable without React: the mark on a hero's
 * frame ("Rewind +540", "Rewind: stands back up", "Rewind: out of reach") and the sentence for
 * the F button and the frame's accessible label. Numbers come from the sim's preview
 * (`HeroHud.rewind`, read from the hero's `past`).
 */
import { fmt } from '../kit/format';
import type { RewindHud } from '../store';

/** What going back does about the hit on its way: " · dodges it", " · undoes it". */
function escapeWords(r: RewindHud): string {
  return r.escape === 'undo' ? 'undoes it' : r.escape === 'dodge' ? 'dodges it' : '';
}

/**
 * The frame's mark, or null when Rewind would only move them back (nothing to give back and
 * nothing to escape): "Rewind +540", "Rewind +540 · dodges it", "Rewind: stands back up",
 * "Rewind: revive spent", "Rewind: out of reach".
 */
export function rewindMark(r: RewindHud): string | null {
  switch (r.kind) {
    case 'revive':
      return 'Rewind: stands back up';
    case 'spent':
      return 'Rewind: revive spent';
    case 'reach':
      return 'Rewind: out of reach';
    case 'restore':
      return `Rewind +${fmt(r.amount)}${r.escape ? ` · ${escapeWords(r)}` : ''}`;
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
      ? ', and the attacks on them are undone'
      : r.escape === 'dodge'
        ? ', out of the hit on its way'
        : '';
  switch (r.kind) {
    case 'revive':
      return `${name} stands back up with ${fmt(r.amount)} life, once a run (${r.left.toFixed(1)} s left to reach them)`;
    case 'spent':
      return `Rewind has stood a hero back up this run already: it can’t stand ${name} up`;
    case 'reach':
      return `${name} has been down too long for Rewind to reach`;
    case 'restore':
      return `${name} gets ${fmt(r.amount)} life back${away}`;
    case 'none':
      return `${name} goes back to where they stood${away}`;
  }
}
