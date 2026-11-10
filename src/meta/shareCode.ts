/**
 * Share codes (docs/phase-6.md, "Share codes", decision 9): a weekly result in 38 characters,
 * `AW1-` then 28 characters of Crockford base32 in groups of four. Pure: no clock, no locale.
 *
 * The 140 bits the 28 characters hold, most significant first:
 *
 * | field | bits |
 * |---|---|
 * | week | 14 |
 * | build: the first 32 bits of the content hash | 32 |
 * | sim version | 8 |
 * | won | 1 |
 * | fights won | 5 |
 * | score | 13 |
 * | total fight time, whole seconds | 13 |
 * | run digest: its first 40 bits | 40 |
 * | spare, always 0 | 4 |
 * | check bits: a CRC-10 over everything before them | 10 |
 *
 * The CRC's generator (x^10 + x^9 + x^5 + x^4 + x + 1) has a constant term, so it catches every
 * error confined to 10 neighbouring bits: any one character wrong (5 bits) and any two neighbouring
 * characters swapped (10 bits), wherever they are, the check characters included.
 *
 * Only the content hash's first 32 bits are carried: its second lane is weak (docs/phase-6.md,
 * "Found at reconciliation", 6). Fields too large for their bits are clamped (a score over 8,191,
 * more than 31 fights won, more than 8,191 seconds); `verifyRunReplay` clamps the same way before it
 * compares.
 */

/** The code's prefix: the game and the code's format. */
export const SHARE_PREFIX = 'AW1-';
/** Characters after the prefix, without the dashes. */
export const SHARE_BODY = 28;
/** The whole code's length, dashes included: `AW1-` and seven groups of four. */
export const SHARE_LENGTH = SHARE_PREFIX.length + SHARE_BODY + SHARE_BODY / 4 - 1;

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** Each field's width in bits, in order (the spare bits and the check bits follow). */
export const SHARE_FIELDS = {
  week: 14,
  build: 32,
  simVersion: 8,
  won: 1,
  fightsWon: 5,
  score: 13,
  seconds: 13,
  digest: 40,
} as const;
const SPARE = 4;
const CHECK = 10;
const CRC_POLY = 0x233; // x^10 + x^9 + x^5 + x^4 + x + 1, without its x^10 term.

/** What a share code states. */
export interface ShareClaim {
  /** The week (`weekOf`, meta/weekly.ts). */
  week: number;
  /** The build: the content hash's first 32 bits, as 8 lowercase hex digits (`buildOf`). */
  build: string;
  simVersion: number;
  won: boolean;
  fightsWon: number;
  score: number;
  /** Total fight time, whole seconds. */
  seconds: number;
  /** The run digest's first 40 bits, as 10 lowercase hex digits (more are cut). */
  digest: string;
}

export type DecodedShareCode = { ok: true; claim: ShareClaim } | { ok: false; error: string };

/** The largest value a field holds. */
function maxOf(bits: number): number {
  return 2 ** bits - 1;
}

/** A claim's numbers as the code holds them: clamped to their fields, digest cut to 40 bits. */
export function clampClaim(claim: ShareClaim): ShareClaim {
  const clamp = (n: number, bits: number) => Math.min(maxOf(bits), Math.max(0, Math.round(n)));
  return {
    ...claim,
    build: claim.build.toLowerCase(),
    fightsWon: clamp(claim.fightsWon, SHARE_FIELDS.fightsWon),
    score: clamp(claim.score, SHARE_FIELDS.score),
    seconds: clamp(claim.seconds, SHARE_FIELDS.seconds),
    digest: claim.digest.slice(0, SHARE_FIELDS.digest / 4).toLowerCase(),
  };
}

/** The build a content version names: the first 32 bits of its hash (`c-` then hex). */
export function buildOf(contentVersion: string): string {
  return contentVersion.replace(/^c-/, '').slice(0, 8).toLowerCase();
}

function pushNumber(bits: number[], value: number, width: number): void {
  for (let i = width - 1; i >= 0; i--) bits.push(Math.floor(value / 2 ** i) % 2);
}

function pushHex(bits: number[], hex: string, width: number): void {
  for (let i = 0; i < width / 4; i++) pushNumber(bits, parseInt(hex[i] ?? '0', 16), 4);
}

function readNumber(bits: readonly number[], at: number, width: number): number {
  let n = 0;
  for (let i = 0; i < width; i++) n = n * 2 + bits[at + i]!;
  return n;
}

function readHex(bits: readonly number[], at: number, width: number): string {
  let s = '';
  for (let i = 0; i < width; i += 4) s += readNumber(bits, at + i, 4).toString(16);
  return s;
}

/** The CRC-10 of a run of bits. */
function crc10(bits: readonly number[]): number {
  let reg = 0;
  for (const b of bits) {
    const top = ((reg >> 9) & 1) ^ b;
    reg = (reg << 1) & 0x3ff;
    if (top) reg ^= CRC_POLY;
  }
  return reg;
}

/**
 * The share code for a claim. Throws for a week or sim version its field can't hold (a week
 * before the epoch, or past 16,383) and for a build or digest that isn't hex.
 */
export function encodeShareCode(claim: ShareClaim): string {
  const c = clampClaim(claim);
  if (!Number.isInteger(c.week) || c.week < 0 || c.week > maxOf(SHARE_FIELDS.week))
    throw new Error(`week ${c.week} doesn't fit a share code`);
  if (!Number.isInteger(c.simVersion) || c.simVersion < 0 || c.simVersion > 255)
    throw new Error(`sim version ${c.simVersion} doesn't fit a share code`);
  if (!/^[0-9a-f]{8}$/.test(c.build)) throw new Error(`build "${c.build}" is not 8 hex digits`);
  if (!/^[0-9a-f]{10}$/.test(c.digest))
    throw new Error(`digest "${c.digest}" is not 10 hex digits`);
  const bits: number[] = [];
  pushNumber(bits, c.week, SHARE_FIELDS.week);
  pushHex(bits, c.build, SHARE_FIELDS.build);
  pushNumber(bits, c.simVersion, SHARE_FIELDS.simVersion);
  pushNumber(bits, c.won ? 1 : 0, SHARE_FIELDS.won);
  pushNumber(bits, c.fightsWon, SHARE_FIELDS.fightsWon);
  pushNumber(bits, c.score, SHARE_FIELDS.score);
  pushNumber(bits, c.seconds, SHARE_FIELDS.seconds);
  pushHex(bits, c.digest, SHARE_FIELDS.digest);
  pushNumber(bits, 0, SPARE);
  pushNumber(bits, crc10(bits), CHECK);
  let body = '';
  for (let i = 0; i < SHARE_BODY; i++) {
    body += ALPHABET[readNumber(bits, i * 5, 5)]!;
    if (i % 4 === 3 && i < SHARE_BODY - 1) body += '-';
  }
  return SHARE_PREFIX + body;
}

/**
 * Reads a share code as a person may type or paste it: any case, spaces and dashes anywhere after
 * the prefix, I and L read as 1, O as 0. Says what's wrong when it can't be read.
 */
export function decodeShareCode(text: string): DecodedShareCode {
  const upper = text.trim().toUpperCase();
  if (!upper.startsWith('AW1')) return { ok: false, error: 'Not a share code: it starts AW1-.' };
  const body = upper.slice(3).replace(/[\s-]/g, '').replace(/[IL]/g, '1').replace(/O/g, '0');
  if (body.length !== SHARE_BODY)
    return {
      ok: false,
      error: `Not a share code: it has ${body.length} characters after AW1-, not ${SHARE_BODY}.`,
    };
  const bits: number[] = [];
  for (const ch of body) {
    const v = ALPHABET.indexOf(ch);
    if (v < 0) return { ok: false, error: `Not a share code: “${ch}” isn’t one of its letters.` };
    pushNumber(bits, v, 5);
  }
  const data = bits.slice(0, bits.length - CHECK);
  const typo = {
    ok: false as const,
    error: 'This code has a typo: its check letters don’t match.',
  };
  if (crc10(data) !== readNumber(bits, data.length, CHECK)) return typo;
  if (readNumber(bits, data.length - SPARE, SPARE) !== 0) return typo;
  let at = 0;
  const take = (width: number) => {
    const n = readNumber(bits, at, width);
    at += width;
    return n;
  };
  const takeHex = (width: number) => {
    const s = readHex(bits, at, width);
    at += width;
    return s;
  };
  const week = take(SHARE_FIELDS.week);
  const build = takeHex(SHARE_FIELDS.build);
  const simVersion = take(SHARE_FIELDS.simVersion);
  const won = take(SHARE_FIELDS.won) === 1;
  const fightsWon = take(SHARE_FIELDS.fightsWon);
  const score = take(SHARE_FIELDS.score);
  const seconds = take(SHARE_FIELDS.seconds);
  const digest = takeHex(SHARE_FIELDS.digest);
  return { ok: true, claim: { week, build, simVersion, won, fightsWon, score, seconds, digest } };
}

/** The code as it is shown: the canonical spelling of whatever was typed (null: unreadable). */
export function normalShareCode(text: string): string | null {
  const read = decodeShareCode(text);
  return read.ok ? encodeShareCode(read.claim) : null;
}
