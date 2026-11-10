/**
 * Numbers, percentages, durations, plurals and possessives for player-facing text (docs/phase-7.md,
 * *Contracts*). Each takes the locale in force (`currentLocale`) unless one is passed, and prints
 * exactly what `src/ui/kit/format.ts` printed before Phase 7 for `'en'` (and `'en-XA'`, which is
 * English): `tests/phase7Contracts.test.ts` compares them over a table of inputs.
 */
import { currentLocale } from './locale';
import { NUMBER_TAG, type Locale } from './locales';

const numberFormats = new Map<string, Intl.NumberFormat>();
const pluralRules = new Map<string, Intl.PluralRules>();

function numberFormat(locale: Locale): Intl.NumberFormat {
  const tag = NUMBER_TAG[locale];
  let f = numberFormats.get(tag);
  if (!f) numberFormats.set(tag, (f = new Intl.NumberFormat(tag)));
  return f;
}

function rules(locale: Locale): Intl.PluralRules {
  const tag = NUMBER_TAG[locale];
  let r = pluralRules.get(tag);
  if (!r) pluralRules.set(tag, (r = new Intl.PluralRules(tag)));
  return r;
}

/** A whole number with grouping: 12345.6 → "12,346". */
export function num(n: number, locale: Locale = currentLocale()): string {
  return numberFormat(locale).format(Math.round(n));
}

/** A share as a percentage: 0.123 → "12%"; with `digits`, that many decimals. */
export function percent(n: number, digits = 0, _locale: Locale = currentLocale()): string {
  // Both locales are English: no grouping, a point for the decimals, the sign before the digits.
  return `${(n * 100).toFixed(digits)}%`;
}

/** A duration in seconds: 2.5 → "2.5 s"; with `digits`, that many decimals. */
export function seconds(n: number, digits = 1, _locale: Locale = currentLocale()): string {
  return `${n.toFixed(digits)} s`;
}

/** 83.4 → "1:23" */
export function clockText(totalSeconds: number, _locale: Locale = currentLocale()): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * The word for `n` of something: `one` when the locale's plural rules say "one" for `n` (and `n`
 * isn't negative), else `many`. In English that is exactly `n === 1`, as before.
 */
export function plural(
  n: number,
  one: string,
  many = `${one}s`,
  locale: Locale = currentLocale(),
): string {
  return n >= 0 && rules(locale).select(n) === 'one' ? one : many;
}

/** "Kael's", "Vexis'" (with typographic apostrophes). */
export function possessive(name: string, _locale: Locale = currentLocale()): string {
  return name.endsWith('s') ? `${name}’` : `${name}’s`;
}
