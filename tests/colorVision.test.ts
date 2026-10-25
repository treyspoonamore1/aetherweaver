import { describe, expect, it } from 'vitest';
import {
  COLOR_VISIONS,
  COLOR_VISION_LABELS,
  CRITICAL_PAIRS,
  VISION_PALETTES,
  applyVisionCss,
  deltaE,
  simulateVision,
  visionPalette,
  type VisionPalette,
} from '../src/app/colorVision';

/** Every role a palette must define (the keys of VisionPalette, taken from the standard one). */
const ROLES = Object.keys(VISION_PALETTES.normal) as (keyof VisionPalette)[];
const HEX = /^#[0-9a-f]{6}$/i;

describe('colour-vision palettes', () => {
  it('has a palette and a label for every vision type', () => {
    for (const vision of COLOR_VISIONS) {
      expect(VISION_PALETTES[vision], vision).toBeDefined();
      expect(COLOR_VISION_LABELS[vision], vision).toMatch(/\S/);
      expect(visionPalette(vision)).toBe(VISION_PALETTES[vision]);
    }
  });

  it('defines every role as a 6-digit hex colour in every palette', () => {
    expect(ROLES.length).toBeGreaterThanOrEqual(9);
    for (const vision of COLOR_VISIONS) {
      const palette = VISION_PALETTES[vision];
      expect(Object.keys(palette).sort(), vision).toEqual([...ROLES].sort());
      for (const role of ROLES) expect(palette[role], `${vision}.${role}`).toMatch(HEX);
    }
  });

  it('only names real roles in the critical pairs', () => {
    expect(CRITICAL_PAIRS.length).toBeGreaterThan(0);
    for (const [a, b] of CRITICAL_PAIRS) {
      expect(ROLES).toContain(a);
      expect(ROLES).toContain(b);
    }
  });

  for (const vision of COLOR_VISIONS) {
    it(`keeps every critical pair ≥ 20 ΔE apart as seen with ${vision}`, () => {
      const palette = VISION_PALETTES[vision];
      for (const [a, b] of CRITICAL_PAIRS) {
        const seenA = simulateVision(palette[a], vision);
        const seenB = simulateVision(palette[b], vision);
        const d = deltaE(seenA, seenB);
        expect(
          d,
          `${vision}: ${a} ${palette[a]}→${seenA} vs ${b} ${palette[b]}→${seenB}`,
        ).toBeGreaterThanOrEqual(20);
      }
    });
  }

  it('simulates and measures sensibly', () => {
    expect(simulateVision('#ABCDEF', 'normal')).toBe('#abcdef');
    expect(deltaE('#123456', '#123456')).toBe(0);
    expect(deltaE('#000000', '#ffffff')).toBeCloseTo(100, 0);
    // Red and green collapse for red-green colour vision.
    const red = simulateVision('#ff0000', 'deuteranopia');
    const green = simulateVision('#00ff00', 'deuteranopia');
    expect(deltaE(red, green)).toBeLessThan(deltaE('#ff0000', '#00ff00'));
  });

  it('applyVisionCss is a no-op without a document', () => {
    expect(() => applyVisionCss('tritanopia')).not.toThrow();
  });

  it('applyVisionCss sets one custom property per role', () => {
    const set = new Map<string, string>();
    const g = globalThis as unknown as { document?: unknown };
    g.document = {
      documentElement: { style: { setProperty: (k: string, v: string) => set.set(k, v) } },
    };
    try {
      applyVisionCss('protanopia');
    } finally {
      delete g.document;
    }
    for (const role of ROLES) {
      expect(set.get(`--color-${role}`)).toBe(VISION_PALETTES.protanopia[role]);
    }
  });
});
