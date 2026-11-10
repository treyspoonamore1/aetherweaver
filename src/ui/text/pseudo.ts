/**
 * The pseudo-locale `en-XA` (docs/phase-7.md, *Words used here*): English with accents added,
 * brackets around it and 30% padding. It shows any string that skipped the text layer (it stays
 * plain) and any layout that can't grow (the padding). `{placeholders}` are left as they are, so a
 * message still takes its parameters.
 */
const ACCENTS: Readonly<Record<string, string>> = {
  a: 'á',
  b: 'ƀ',
  c: 'ç',
  d: 'ð',
  e: 'é',
  f: 'ƒ',
  g: 'ĝ',
  h: 'ĥ',
  i: 'í',
  j: 'ĵ',
  k: 'ķ',
  l: 'ļ',
  m: 'ɱ',
  n: 'ñ',
  o: 'ó',
  p: 'þ',
  q: 'ǫ',
  r: 'ŕ',
  s: 'š',
  t: 'ţ',
  u: 'ú',
  v: 'ṽ',
  w: 'ŵ',
  x: 'ẋ',
  y: 'ý',
  z: 'ž',
  A: 'Á',
  B: 'Ɓ',
  C: 'Ç',
  D: 'Ð',
  E: 'É',
  F: 'Ƒ',
  G: 'Ĝ',
  H: 'Ĥ',
  I: 'Í',
  J: 'Ĵ',
  K: 'Ķ',
  L: 'Ļ',
  M: 'Ṁ',
  N: 'Ñ',
  O: 'Ó',
  P: 'Þ',
  Q: 'Ǫ',
  R: 'Ŕ',
  S: 'Š',
  T: 'Ţ',
  U: 'Ú',
  V: 'Ṽ',
  W: 'Ŵ',
  X: 'Ẋ',
  Y: 'Ý',
  Z: 'Ž',
};

/** The share of a string's length added as padding. */
export const PSEUDO_PADDING = 0.3;

/** `"Settings"` → `"[Šéţţíñĝš~~~]"`. */
export function pseudo(text: string): string {
  let out = '';
  let depth = 0;
  for (const ch of text) {
    if (ch === '{') depth++;
    out += depth > 0 ? ch : (ACCENTS[ch] ?? ch);
    if (ch === '}' && depth > 0) depth--;
  }
  const pad = Math.ceil([...text].length * PSEUDO_PADDING);
  return `[${out}${'~'.repeat(pad)}]`;
}
