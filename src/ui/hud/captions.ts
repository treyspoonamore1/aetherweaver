/**
 * Captions (docs/phase-7.md, W2): sounds that carry meaning, in words. The runtime asks for each
 * sim event the fight raises while Settings → captions is on (`src/app/runtime.ts`), after the
 * event's own callouts, and pushes what comes back; a caption with a `key` first replaces the
 * last one with that key.
 *
 * W0 moves today's block here unchanged: the Finale's four captions (`finaleCaption`), as the
 * quiet bracketed line `captionCallout` writes. W2 writes the rest (telegraph wind-ups with their
 * side, Tyrant's edict, the Postlude, Mimicry's first sighting, the low-life sound).
 */
import type { SimEvent, WorldState } from '../../sim';
import { captionCallout, finaleCaption, type FinaleCallout } from './finaleLook';

/** The caption for `event`, or null (every event but the Finale's four, at W0). */
export function captionFor(event: SimEvent, _state: WorldState): FinaleCallout | null {
  const caption = finaleCaption(event);
  return caption ? captionCallout(caption) : null;
}
