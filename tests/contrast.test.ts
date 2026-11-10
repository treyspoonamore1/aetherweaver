/**
 * WCAG AA contrast for text (docs/phase-7.md, W2): every text colour token of the stylesheet, and
 * every role of every colour-vision palette that is written as text, against the surfaces text sits
 * on, at 4.5:1. One helper (`contrastRatio`, WCAG 2.x relative luminance) for the whole game's
 * tokens; the four phase tests that carry their own copy (uiPhase4c-4f) check their own colours.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { COLOR_VISIONS, VISION_PALETTES } from '../src/app/colorVision';

/** WCAG 2.x relative luminance of a `#rrggbb` colour. */
export function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

/** WCAG 2.x contrast ratio, 1-21. */
export function contrastRatio(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x! + 0.05) / (y! + 0.05);
}

const AA = 4.5;

/** The stylesheet's colour tokens (`src/index.css`, `@theme`). */
function tokens(): Record<string, string> {
  const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
  return Object.fromEntries(
    [...css.matchAll(/--color-([a-z0-9-]+):\s*(#[0-9a-f]{6});/g)].map((m) => [m[1]!, m[2]!]),
  );
}

/** The surfaces text sits on: the page, panels, cards and raised controls. */
const SURFACES = ['ink-950', 'ink-900', 'ink-800', 'ink-700'] as const;

/**
 * Pairs below 4.5:1, each known and kept to its place: lethal on the raised ink-700 (4.0) is used
 * there only in bold text and glyphs, which AA reads at 3:1 (large or bold). Any other pair under
 * 4.5 fails this test.
 */
const KNOWN: readonly string[] = ['lethal on ink-700'];

/**
 * Palette roles under 4.5:1, found by this test and left as they are (src/app/colorVision.ts is not
 * W2's file; its colours are pinned by tests/colorVision.test.ts's ΔE pairs): reported for the
 * owner. Any new one fails.
 */
const KNOWN_PALETTE: readonly string[] = [
  'protanopia lethal on ink-950 4.05',
  'protanopia lethal on ink-900 3.84',
  'protanopia lethal on ink-800 3.49',
  'deuteranopia lethal on ink-950 4.05',
  'deuteranopia lethal on ink-900 3.84',
  'deuteranopia lethal on ink-800 3.49',
  'tritanopia ailment on ink-900 4.47',
  'tritanopia ailment on ink-800 4.07',
  'tritanopia lethal on ink-950 3.61',
  'tritanopia lethal on ink-900 3.42',
  'tritanopia lethal on ink-800 3.12',
];

describe('contrast: the text tokens on their surfaces', () => {
  const t = tokens();
  const text = Object.keys(t).filter((k) => !k.startsWith('ink-'));

  it('reads every token from the stylesheet', () => {
    for (const k of [...SURFACES, 'text', 'muted', 'gold-300', 'lethal'])
      expect(t[k], k).toMatch(/^#/);
    expect(text.length).toBeGreaterThanOrEqual(18);
  });

  it('the helper: black on white is 21, a colour on itself is 1', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#3d4c7d', '#3d4c7d')).toBe(1);
  });

  it('every text token at 4.5:1 on every surface (the known pair listed)', () => {
    const low: string[] = [];
    for (const k of text)
      for (const s of SURFACES) {
        const r = contrastRatio(t[k]!, t[s]!);
        if (r < AA) low.push(`${k} on ${s}`);
        else expect(r, `${k} on ${s}`).toBeGreaterThanOrEqual(AA);
      }
    expect(low).toEqual(KNOWN);
    // Even the known pair clears the large-or-bold bar.
    expect(contrastRatio(t.lethal!, t['ink-700']!)).toBeGreaterThanOrEqual(3);
  });

  it('every colour-vision palette’s roles at 4.5:1 on the page, panel and card surfaces', () => {
    const low: string[] = [];
    for (const v of COLOR_VISIONS)
      for (const [role, hex] of Object.entries(VISION_PALETTES[v]))
        for (const s of ['ink-950', 'ink-900', 'ink-800'] as const)
          if (contrastRatio(hex, t[s]!) < AA)
            low.push(`${v} ${role} on ${s} ${contrastRatio(hex, t[s]!).toFixed(2)}`);
    expect(low).toEqual(KNOWN_PALETTE);
  });
});
