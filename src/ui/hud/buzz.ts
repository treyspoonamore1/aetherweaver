import type { Callout, TechniqueHud } from '../store';

/**
 * The latest rejection of each technique slot (its callout id), from the rejection callouts'
 * `reject:<slot>` keys (Phase 3e): the Weaver bar shakes that slot, so Rewind's rejections buzz
 * F, Reel's slot. Callouts without a slot key buzz nothing.
 */
export function rejectBuzz(
  callouts: readonly Callout[],
): Partial<Record<TechniqueHud['key'], number>> {
  const out: Partial<Record<TechniqueHud['key'], number>> = {};
  for (const c of callouts) {
    if (c.kind !== 'reject' || !c.key?.startsWith('reject:')) continue;
    const slot = c.key.slice('reject:'.length);
    if (slot === 'ward' || slot === 'chime' || slot === 'reel' || slot === 'glide')
      out[slot] = c.id;
  }
  return out;
}
