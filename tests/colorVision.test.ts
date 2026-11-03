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
import { CONTENT } from '../src/content';
import { CRIMSON_HEX } from '../src/render/crimsonCues';
import { MARTYR_HEX } from '../src/render/martyrCues';

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

describe('Movement II colours (docs/phase-5a/vfx-audio.md)', () => {
  /** The roles a new semantic colour must never be mistaken for (and the Martyr's Bear). */
  const AGAINST = ['lethal', 'threat', 'mend', 'empower'] as const;

  for (const vision of COLOR_VISIONS) {
    it(`keeps every Crimson Legion colour ≥ 20 ΔE from lethal, threat, Bear, Mend and Empower with ${vision}`, () => {
      const palette = VISION_PALETTES[vision];
      const see = (hex: string) => simulateVision(hex, vision);
      for (const [name, hex] of Object.entries(CRIMSON_HEX)) {
        for (const role of AGAINST) {
          const d = deltaE(see(hex), see(palette[role]));
          expect(d, `${vision}: ${name} ${hex} vs ${role} ${palette[role]}`).toBeGreaterThanOrEqual(
            20,
          );
        }
        const bear = deltaE(see(hex), see(MARTYR_HEX.blood));
        expect(bear, `${vision}: ${name} ${hex} vs Bear`).toBeGreaterThanOrEqual(20);
      }
    });
  }
});

describe('the Vampiric affix colour (docs/phase-5a.md, Affixes)', () => {
  /**
   * An elite's affix rim must not read as an ailment, a threat, a heal or the Bear. `#9f7aea` (the
   * first pick) failed: ΔE 6.5 from ailment violet, 16.1 from Mend under deuteranopia. The deep
   * crimson-magenta `#a01a8a` keeps blood in it while staying clear of every one of them.
   */
  const AGAINST = ['ailment', 'lethal', 'threat', 'mend', 'heal', 'empower'] as const;
  const vampiric = CONTENT.affixes.find((a) => a.id === 'vampiric')!.color;

  for (const vision of COLOR_VISIONS) {
    it(`is ≥ 20 ΔE from ailment violet, lethal, threat, Bear, Mend/heal and Empower with ${vision}`, () => {
      const palette = VISION_PALETTES[vision];
      const see = (hex: string) => simulateVision(hex, vision);
      for (const role of AGAINST) {
        const d = deltaE(see(vampiric), see(palette[role]));
        expect(
          d,
          `${vision}: vampiric ${vampiric} vs ${role} ${palette[role]}`,
        ).toBeGreaterThanOrEqual(20);
      }
      const bear = deltaE(see(vampiric), see(MARTYR_HEX.blood));
      expect(bear, `${vision}: vampiric ${vampiric} vs Bear`).toBeGreaterThanOrEqual(20);
    });
  }
});
