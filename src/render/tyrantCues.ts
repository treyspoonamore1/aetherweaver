/**
 * Tyrant (docs/phase-6.md, "Tyrant"): pure helpers, no three.js scene objects, tested in Node.
 * What render (and audio) read of a boss's borrowed attack: `EnemyComponent.tyrant`
 * (`{ attack, from, phase, readyAt }`, set only on a boss or mini-boss on a Tyrant run), its
 * current `cast`, and the `tyrantEdict` event (`{ boss, phase, attack, from }`). Every one of them
 * is absent on every other run, so nothing here answers anything but "none" there.
 *
 * - **The borrowed foe's accent ring**: for the phase, the boss wears a band round its body in the
 *   accent of the foe it borrowed from (`enemyDef(from).accent`, the colour that foe's own body
 *   wears). A body colour, never a mark on the disc: it is drawn round the body between its waist
 *   and its chest, never on the floor, under a telegraph's or a hero's ring, or over the head where
 *   a hex's swirl sits. Most enemy accents sit close to a semantic colour in some vision (the
 *   Cantor Acolyte's is the call gold itself), so the band carries no meaning by colour: its shape
 *   says "borrowed" (a pair of dashed hoops with a bead at each quarter), and the colour only says
 *   from whom, as that foe's own body does.
 * - **The crown sigil over a Tyrant cast** (SPRITE.crown): over the boss's head while it casts its
 *   borrowed attack, in the same accent, so the shape says "Tyrant" and the colour whose attack it
 *   is; the attack's own telegraph is drawn as the foe's always is.
 */
import { enemyDef } from '../content';
import type {
  EntityId,
  ReadonlyEntity,
  SimEvent,
  SimEventOf,
  TyrantHold,
  WorldState,
} from '../sim';

/** What render reads of a boss's Tyrant hold (the sim's, read-only). */
export type TyrantView = Readonly<TyrantHold>;

/** The neutral the band falls back to for a foe render has no definition of (a lab stand-in). */
export const TYRANT_FALLBACK_HEX = '#b8b0c8';

/** A boss's borrowed attack for its phase (null: none; every enemy on every run without Tyrant). */
export function tyrantOf(e: ReadonlyEntity | undefined): TyrantView | null {
  const t = e?.enemy?.tyrant;
  return t ?? null;
}

/**
 * The boss is casting its borrowed attack right now: its cast is the hold's attack. (The Silent
 * Conductor borrows its own Sforzando and Downbeat, so every cast of the held attack counts.)
 */
export function tyrantCasting(e: ReadonlyEntity | undefined): boolean {
  const t = e?.enemy?.tyrant;
  const cast = e?.enemy?.cast;
  return !!t && !!cast && cast.attackId === t.attack;
}

/** A telegraph's attack is its owner's Tyrant attack (the cast sounds as the foe's, under the boss's voice). */
export function isTyrantAttack(
  owner: ReadonlyEntity | undefined,
  attackId: string | undefined,
): boolean {
  const t = owner?.enemy?.tyrant;
  return !!t && attackId !== undefined && attackId === t.attack;
}

/** The accent the borrowed foe's body wears (its content definition), else the fallback. */
export function tyrantAccentHex(from: string | undefined | null): string {
  if (!from) return TYRANT_FALLBACK_HEX;
  try {
    const hex = enemyDef(from).accent;
    return typeof hex === 'string' && /^#[0-9a-f]{6}$/i.test(hex) ? hex : TYRANT_FALLBACK_HEX;
  } catch {
    return TYRANT_FALLBACK_HEX;
  }
}

/** The borrowed foe's name (its content definition), else its id. */
export function tyrantFoeName(from: string): string {
  try {
    return enemyDef(from).name;
  } catch {
    return from;
  }
}

/** The bosses on the field holding a borrowed attack, into `out` (cleared first); returns it. */
export function tyrantBosses(state: WorldState, out: EntityId[]): EntityId[] {
  out.length = 0;
  for (const e of state.entities.list()) {
    if (!e.enemy?.tyrant || !e.health || e.health.dead || e.enemy.state === 'dying') continue;
    out.push(e.id);
  }
  return out;
}

/** The `tyrantEdict` events of a batch (none on a run without Tyrant). */
export function tyrantEdicts(events: readonly SimEvent[]): SimEventOf<'tyrantEdict'>[] {
  const out: SimEventOf<'tyrantEdict'>[] = [];
  for (const e of events) if (e.type === 'tyrantEdict') out.push(e);
  return out;
}

/** The band's shape round a body of `height`: its two hoops' heights and how they turn. */
export const TYRANT_BAND = {
  /** The two hoops, as shares of the body's height (between the waist and the chest). */
  lower: 0.42,
  upper: 0.6,
  /** How far out of the body's radius they sit (m), and their thickness (m). */
  out: 0.12,
  thickness: 0.05,
  /** Dashes per hoop; a bead every quarter turn. */
  dashes: 9,
  beads: 4,
  /** How fast it turns (rad/s); it holds still at Flashes 0 (no motion asked for). */
  spin: 0.6,
} as const;

/** The edict's moment: the band closes in from wide onto the body (render seconds). */
export const EDICT_SECONDS = 1.1;
