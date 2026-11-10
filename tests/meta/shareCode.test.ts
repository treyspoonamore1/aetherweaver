/**
 * Share codes (docs/phase-6.md, "Share codes"): 38 characters that round-trip, read as people
 * type them, and catch every single-character error and every swap of neighbours.
 */
import { describe, expect, it } from 'vitest';
import { CONTENT_VERSION } from '../../src/content';
import {
  SHARE_BODY,
  SHARE_FIELDS,
  SHARE_LENGTH,
  buildOf,
  clampClaim,
  decodeShareCode,
  encodeShareCode,
  normalShareCode,
  shareLine,
  thousands,
  type ShareClaim,
} from '../../src/meta/shareCode';

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

const CLAIMS: ShareClaim[] = [
  {
    week: 47,
    build: '3d16ade0',
    simVersion: 22,
    won: true,
    fightsWon: 15,
    score: 3210,
    seconds: 1860,
    digest: '082d1abefa',
  },
  {
    week: 0,
    build: '00000000',
    simVersion: 0,
    won: false,
    fightsWon: 0,
    score: 0,
    seconds: 0,
    digest: '0000000000',
  },
  {
    week: 16383,
    build: 'ffffffff',
    simVersion: 255,
    won: true,
    fightsWon: 31,
    score: 8191,
    seconds: 8191,
    digest: 'ffffffffff',
  },
  {
    week: 44,
    build: 'c9bed066',
    simVersion: 22,
    won: false,
    fightsWon: 9,
    score: 1760,
    seconds: 1594,
    digest: 'a1b2c3d4e5',
  },
];

/** More claims, from a fixed little generator: the error tests run over every one. */
function moreClaims(n: number): ShareClaim[] {
  let x = 12345;
  const next = (bits: number) => {
    x = (Math.imul(x, 1103515245) + 12345) >>> 0;
    return x % 2 ** bits;
  };
  const hex = (digits: number) =>
    Array.from({ length: digits }, () => next(4).toString(16)).join('');
  return Array.from({ length: n }, () => ({
    week: next(14),
    build: hex(8),
    simVersion: next(8),
    won: next(1) === 1,
    fightsWon: next(5),
    score: next(13),
    seconds: next(13),
    digest: hex(10),
  }));
}

const ALL = [...CLAIMS, ...moreClaims(40)];

/** The 28 characters after the prefix. */
function body(code: string): string {
  return code.slice(4).replace(/-/g, '');
}

function withBody(chars: string): string {
  return `AW1-${chars.match(/.{4}/g)!.join('-')}`;
}

describe('share codes', () => {
  it('lays out 136 bits of fields and checks in 28 characters', () => {
    const data = Object.values(SHARE_FIELDS).reduce((s, n) => s + n, 0);
    expect(data + 10).toBe(136);
    expect(SHARE_BODY * 5).toBeGreaterThanOrEqual(136);
    expect(SHARE_LENGTH).toBe(38);
  });

  it('round-trips, 38 characters in groups of four', () => {
    for (const claim of ALL) {
      const code = encodeShareCode(claim);
      expect(code).toHaveLength(38);
      expect(code).toMatch(/^AW1-([0-9A-HJKMNP-TV-Z]{4}-){6}[0-9A-HJKMNP-TV-Z]{4}$/);
      expect(decodeShareCode(code)).toEqual({ ok: true, claim });
    }
  });

  it('carries only the first 32 bits of the content hash, and the first 40 of the digest', () => {
    expect(buildOf(CONTENT_VERSION)).toBe(CONTENT_VERSION.slice(2, 10));
    const claim = { ...CLAIMS[0]!, digest: '082d1abefa893e82' };
    const read = decodeShareCode(encodeShareCode(claim));
    expect(read.ok && read.claim.digest).toBe('082d1abefa');
  });

  it('clamps what its fields can’t hold, and refuses a week or version they can’t', () => {
    const big = { ...CLAIMS[0]!, score: 9000, seconds: 9999, fightsWon: 40 };
    const read = decodeShareCode(encodeShareCode(big));
    expect(read.ok && read.claim).toEqual(clampClaim(big));
    expect(read.ok && [read.claim.score, read.claim.seconds, read.claim.fightsWon]).toEqual([
      8191, 8191, 31,
    ]);
    expect(() => encodeShareCode({ ...CLAIMS[0]!, week: -1 })).toThrow();
    expect(() => encodeShareCode({ ...CLAIMS[0]!, week: 16384 })).toThrow();
    expect(() => encodeShareCode({ ...CLAIMS[0]!, simVersion: 256 })).toThrow();
    expect(() => encodeShareCode({ ...CLAIMS[0]!, build: 'xyz' })).toThrow();
  });

  it('reads I and L as 1 and O as 0, any case, with or without dashes and spaces', () => {
    for (const claim of CLAIMS) {
      const code = encodeShareCode(claim);
      const typed = withBody(
        body(code)
          .split('')
          .map((ch, i) => (ch === '1' ? (i % 2 ? 'I' : 'l') : ch === '0' ? 'o' : ch.toLowerCase()))
          .join(''),
      );
      expect(decodeShareCode(typed)).toEqual({ ok: true, claim });
      expect(decodeShareCode(`  aw1 ${body(code).match(/.{7}/g)!.join(' ')} `)).toEqual({
        ok: true,
        claim,
      });
      expect(normalShareCode(typed)).toBe(code);
    }
    // The fixtures do exercise the reading.
    expect(CLAIMS.some((c) => /[10]/.test(body(encodeShareCode(c))))).toBe(true);
  });

  it('catches every single-character error', () => {
    for (const claim of ALL) {
      const chars = body(encodeShareCode(claim));
      for (let i = 0; i < chars.length; i++)
        for (const ch of ALPHABET) {
          if (ch === chars[i]) continue;
          const wrong = chars.slice(0, i) + ch + chars.slice(i + 1);
          const read = decodeShareCode(withBody(wrong));
          expect(read.ok, `position ${i} as ${ch}`).toBe(false);
        }
    }
  });

  it('catches every swap of neighbours', () => {
    let swaps = 0;
    for (const claim of ALL) {
      const chars = body(encodeShareCode(claim));
      for (let i = 0; i + 1 < chars.length; i++) {
        if (chars[i] === chars[i + 1]) continue;
        const swapped = chars.slice(0, i) + chars[i + 1] + chars[i] + chars.slice(i + 2);
        expect(decodeShareCode(withBody(swapped)).ok, `swap at ${i}`).toBe(false);
        swaps++;
      }
    }
    expect(swaps).toBeGreaterThan(1000);
  });

  it('writes the line Share copies, with thousands commas and no locale', () => {
    const code = encodeShareCode(CLAIMS[0]!);
    expect(shareLine(code)).toBe(`My Week 47 song: 3,210 points, won. ${code}`);
    expect(shareLine('nope')).toBeNull();
    expect([0, 7, 999, 1000, 12345, 1234567, -4321].map(thousands)).toEqual([
      '0',
      '7',
      '999',
      '1,000',
      '12,345',
      '1,234,567',
      '-4,321',
    ]);
  });

  it('says what is wrong with what isn’t a code', () => {
    const code = encodeShareCode(CLAIMS[0]!);
    expect(decodeShareCode(`AW2-${code.slice(4)}`)).toEqual({
      ok: false,
      error: 'Not a share code: it starts AW1-.',
    });
    expect(decodeShareCode(`XW1-${code.slice(4)}`).ok).toBe(false);
    expect(decodeShareCode(code.slice(0, -1))).toEqual({
      ok: false,
      error: 'Not a share code: it has 27 characters after AW1-, not 28.',
    });
    const u = withBody(`U${body(code).slice(1)}`);
    expect(decodeShareCode(u)).toEqual({
      ok: false,
      error: 'Not a share code: “U” isn’t one of its letters.',
    });
    const typo = withBody(`${body(code)[0] === 'Z' ? 'Y' : 'Z'}${body(code).slice(1)}`);
    expect(decodeShareCode(typo)).toEqual({
      ok: false,
      error: 'This code has a typo: its check letters don’t match.',
    });
    expect(normalShareCode('nonsense')).toBeNull();
  });
});
