/**
 * Prep's party picker (docs/phase-5b.md, "Choosing the party"). It exists only once the roster
 * holds more heroes than a party, so first-run and Prelude Prep stay exactly as they are.
 */

/** Heroes a party fields (the sim takes 1–4; Prep picks exactly this many). */
export const PARTY_SIZE = 3;

/** The heroes the picker offers, in content order; null while the roster is no bigger than a party. */
export function prepParty(roster: readonly string[]): string[] | null {
  return roster.length <= PARTY_SIZE ? null : [...roster];
}
