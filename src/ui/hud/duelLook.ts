/**
 * Seren on the HUD (docs/phase-5e.md, "Seren's frame"), as plain data so it is testable without
 * React: the chips her frame shows (en garde and the parries it has left, Blade Waltz, her duel,
 * a kill shot due, Thousand Cuts, overextended and its answer, out of your reach) and the outline
 * that replaces the plain `far` fade for her: the hero who most needs a Ward is never faded.
 * Everything keys on `HeroHud.duel` (present only for a hero with Parry), so every other frame is
 * exactly as it was. Her colour is her def's rapier violet; silver never appears on her frame.
 */
import { CONTENT, heroDef } from '../../content';
import type { HeroHud } from '../store';

/** Seren's rapier violet (her def's colour): every chip and her outline. Never silver. */
export const DUEL_VIOLET = heroDef('seren').color;
/** Her chips' text: her violet lightened, so it reads on the dark frame. */
export const DUEL_INK = '#d8b4fe';

export type DuelChipId = 'garde' | 'waltz' | 'killShot' | 'cuts' | 'duel' | 'over' | 'reach';

export interface DuelChip {
  id: DuelChipId;
  label: string;
  /** The tooltip and accessible sentence. */
  title: string;
  /** A key cap the label ends on (`{F}`, `{C}`), or none. */
  key?: string;
  /** An alarm (overextended, out of reach): the chip pulses. */
  alarm?: boolean;
}

/** The glyph each chip carries (colour is never the only cue). */
export const DUEL_ICON = {
  garde: 'swords',
  waltz: 'swords',
  killShot: 'star',
  cuts: 'sparkle',
  duel: 'crown',
  over: 'stack',
  reach: 'glide',
} as const satisfies Record<DuelChipId, string>;

/** Beyond the Ward's reach (the frames' `far`), standing: for her, a chip and an outline. */
export function outOfReach(h: Pick<HeroHud, 'duel' | 'distance' | 'dead' | 'downed'>): boolean {
  return !!h.duel && !h.dead && !h.downed && h.distance > CONTENT.techniques.ward.range;
}

/**
 * Whether Seren's overextension answer is Rally rather than the Reel key: for the Chronomancer
 * (`rewind` set), whose Rewind is no sure extraction; the Anchor, which doesn't pull; and the
 * Swap, which puts the Weaver in her duel instead of bringing her home (docs/phase-5e.md, 'By
 * Calling'). Only the plain Reel (and any other pulling variant) answers it with the Reel key.
 */
export function overextendedRallyHome(rewind: unknown, reelVariant: string | null): boolean {
  return (
    (rewind !== null && rewind !== undefined) || reelVariant === 'anchor' || reelVariant === 'swap'
  );
}

/**
 * Her frame's chips, most urgent first. `keys`: the Reel and Rally key labels as bound, and
 * `rallyHome`: the overextension answer is Rally (`overextendedRallyHome`: the Chronomancer,
 * the Anchor or the Swap). Empty for a hero without `duel`, or down.
 */
export function duelChips(
  h: Pick<HeroHud, 'name' | 'duel' | 'distance' | 'dead' | 'downed'>,
  keys: { reel: string; rally: string; rallyHome: boolean },
): DuelChip[] {
  const d = h.duel;
  if (!d || h.dead || h.downed) return [];
  const out: DuelChip[] = [];
  if (d.overextended)
    out.push(
      keys.rallyHome
        ? {
            id: 'over',
            label: 'Overextended · Rally',
            key: keys.rally,
            alarm: true,
            title: `Overextended: the pack has closed on ${h.name}. Rally brings her home; she always comes`,
          }
        : {
            id: 'over',
            label: 'Overextended · Reel',
            key: keys.reel,
            alarm: true,
            title: `Overextended: the pack has closed on ${h.name}. Reel her home, or Rally: she always comes`,
          },
    );
  if (outOfReach(h))
    out.push({
      id: 'reach',
      label: 'Out of reach · Glide closer',
      alarm: true,
      title: `${h.name} is beyond your Ward and Reel: Glide toward her`,
    });
  if (d.killShot)
    out.push({
      id: 'killShot',
      label: 'Kill shot',
      title: `Your Perfect Ward: ${h.name} strikes a kill shot`,
    });
  if (d.waltz)
    out.push({
      id: 'waltz',
      label: 'Blade Waltz',
      title: `Blade Waltz: every melee blow at ${h.name} is parried, Ward or not`,
    });
  else if (d.armed)
    out.push(
      (d.charges ?? 1) >= 2
        ? {
            id: 'garde',
            label: 'Parry ×2',
            title: `En garde: your Ward on ${h.name} parries the next two melee blows at her, and she answers each threefold`,
          }
        : {
            id: 'garde',
            label: 'En garde',
            title: `En garde: your Ward on ${h.name} parries the next melee blow at her, and she answers it threefold`,
          },
    );
  if (d.cuts)
    out.push({
      id: 'cuts',
      label: `Cuts ${Math.max(0, d.cuts.left).toFixed(1)} s`,
      title: `Thousand Cuts: ${h.name} can’t be hit until she returns`,
    });
  if (d.quarryName)
    out.push({
      id: 'duel',
      label: `Duelling ${d.quarryName}`,
      title: `Showboat: ${h.name} duels the ${d.quarryName}, outside your songs but never beyond your reach. Focus moves her duel`,
    });
  return out;
}

/**
 * What her frame's edge says instead of the fade (docs/phase-5e.md): her violet, pulsing, while
 * she is out of your reach or overextended. Null otherwise (and for every other hero).
 */
export function duelOutline(
  h: Pick<HeroHud, 'duel' | 'distance' | 'dead' | 'downed'>,
): { color: string; pulse: boolean } | null {
  if (!h.duel || h.dead || h.downed) return null;
  if (outOfReach(h) || h.duel.overextended) return { color: DUEL_VIOLET, pulse: true };
  return null;
}
