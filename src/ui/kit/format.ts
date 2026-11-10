/**
 * Number and time formatting shared by HUD and screens. Phase 7 (docs/phase-7.md, *Contracts*):
 * these go through the text layer's formatters (`src/ui/text/format.ts`), which print exactly what
 * this file printed before for English (tests/phase7Contracts.test.ts compares them).
 */
import {
  clockText,
  num,
  percent,
  plural as pluralWord,
  possessive as possessiveOf,
} from '../text/format';

/** 12345.6 → "12,346" */
export function fmt(n: number): string {
  return num(n);
}

/** 0.123 → "12%" */
export function pct(n: number, digits = 0): string {
  return percent(n, digits);
}

/** 83.4 → "1:23" */
export function clock(seconds: number): string {
  return clockText(seconds);
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return pluralWord(n, one, many);
}

/** "Kael's" */
export function possessive(name: string): string {
  return possessiveOf(name);
}
