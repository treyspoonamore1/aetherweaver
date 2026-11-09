/**
 * The frozen resolver fixture's shape and number encoding (docs/phase-5g.md, ground rule 4),
 * shared by `freezeResolver.ts` (which wrote `resolver.json` once, on the pre-5g tree) and
 * `tests/fill/foundations.test.ts` (which resolves every stored input again and compares).
 */

/** What `resolveMods` reads from a resolved config. */
export interface ResolverInput {
  motifs: { id: string; level: number }[];
  relics: { id: string; cleansed: boolean; empowered: boolean }[];
  boons: string[];
  calling: { id: string; path: string[]; reviveSpent: boolean } | null;
  astrolabe: string[];
  passives: { effect: string; value: number }[];
  dissonance: { id: string; rank: number }[];
}

/** One input and the resolved mods' keys that differ from the frozen NO_MODS. */
export interface ResolverCase {
  input: ResolverInput;
  mods: Record<string, unknown>;
}

export interface ResolverFixture {
  noMods: Record<string, unknown>;
  cases: ResolverCase[];
}

/** A number as JSON keeps it exactly, except -0, NaN and the infinities, which become strings. */
export function encodeNumber(n: number): number | string {
  if (Object.is(n, -0)) return '-0';
  if (Number.isNaN(n)) return 'NaN';
  if (n === Infinity) return 'Infinity';
  if (n === -Infinity) return '-Infinity';
  return n;
}

function encode(value: unknown): unknown {
  if (typeof value === 'number') return encodeNumber(value);
  if (Array.isArray(value)) return value.map(encode);
  if (value !== null && typeof value === 'object')
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, encode(v)]));
  return value;
}

/** Mods with every number encoded (`encodeNumber`), keys in their own order. */
export function encodeMods(mods: Record<string, unknown>): Record<string, unknown> {
  return encode(mods) as Record<string, unknown>;
}
