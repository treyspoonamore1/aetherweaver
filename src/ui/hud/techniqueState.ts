import type { TechniqueHud } from '../store';

/** A Weaver bar slot's state, as the button draws it. */
export interface SlotState {
  /** A cooldown is running: the slot's own, or a charge coming back. */
  recharging: boolean;
  /** It runs on charges (the Ward's two, Skate's). */
  charged: boolean;
  /** It must wait: a cooldown with no charge left (the sweep and the seconds). */
  cooling: boolean;
  /** A charge is coming back while one is left: it still works (a thin line fills). */
  refilling: boolean;
  /** Ready but not affordable: dimmed. */
  dim: boolean;
  ready: boolean;
}

/**
 * Stasis (`free`) lifts every cooldown; with charges (Phase 4f: Skate's, and the Ward's), a slot
 * works while one is left, whatever its cooldown says; `silenced`: the Weaver is down.
 */
export function slotState(
  t: Pick<TechniqueHud, 'free' | 'remaining' | 'total' | 'charges' | 'maxCharges' | 'affordable'>,
  silenced: boolean,
): SlotState {
  const recharging = !t.free && t.remaining > 0.05 && t.total > 0;
  const charged = t.maxCharges > 1;
  const cooling = recharging && (!charged || t.charges <= 0);
  return {
    recharging,
    charged,
    cooling,
    refilling: recharging && !cooling,
    dim: !cooling && !t.affordable,
    ready: !cooling && t.affordable && !silenced,
  };
}

/**
 * The techniques a Null rune refuses (docs/phase-5c.md Q5): Ward, Chime and Reel (or Rewind, in
 * Reel's slot). Glide is never refused, so it never greys.
 */
export const RUNE_KEYS: ReadonlySet<TechniqueHud['key']> = new Set(['ward', 'chime', 'reel']);

/**
 * Whether a Weaver bar slot is silenced now (`slotState`'s `silenced`): every slot while she is
 * down; inside a Null rune (`runeLocked`), only Ward, Chime and Reel.
 */
export function slotSilenced(
  key: TechniqueHud['key'],
  downed: boolean,
  runeLocked: boolean | undefined,
): boolean {
  return downed || (!!runeLocked && RUNE_KEYS.has(key));
}
