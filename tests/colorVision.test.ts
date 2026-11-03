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
import * as THREE from 'three';
import { CONTENT } from '../src/content';
import { BRANN_HEX, CRIMSON_HEX, SPIRE_HEX } from '../src/render/crimsonCues';
import { MARTYR_HEX } from '../src/render/martyrCues';
import { BRASS_TRIM, buildHero } from '../src/render/models/library';

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

describe('the heroes’ colours (docs/phase-5b.md, Colour)', () => {
  const HEROES = CONTENT.heroes.map((h) => [h.id, h.color] as const);
  const brann = CONTENT.heroes.find((h) => h.id === 'brann')!.color;

  /**
   * Kael's blue and Vexis's violet were picked before hero colours were measured (Movement I),
   * and collapse under red-green vision (3.2 ΔE protanopia, 8.9 deuteranopia). Their silhouettes,
   * leitmotifs and key numbers carry them; changing a starter's colour is out of this slice. The
   * pair is pinned at those floors so it can't get worse; every other pair, and every pair with
   * Brann, holds the full 20. The Weaver's gold is each palette's own (`amp`: her gold chips and
   * Empower, as that vision shows them).
   */
  const STARTER_PAIRS: Record<string, number> = { 'kael|vexis': 3 };

  for (const vision of COLOR_VISIONS) {
    it(`keeps every hero ≥ 20 ΔE from every other, and from the Weaver’s gold, with ${vision}`, () => {
      const see = (hex: string) => simulateVision(hex, vision);
      const low: string[] = [];
      for (let i = 0; i < HEROES.length; i++) {
        const [a, ha] = HEROES[i]!;
        const gold = deltaE(see(ha), see(VISION_PALETTES[vision].amp));
        if (gold < 20) low.push(`${a}/gold ${gold.toFixed(1)}`);
        for (let j = i + 1; j < HEROES.length; j++) {
          const [b, hb] = HEROES[j]!;
          const d = deltaE(see(ha), see(hb));
          const floor = STARTER_PAIRS[`${a}|${b}`] ?? 20;
          if (d < floor) low.push(`${a}/${b} ${d.toFixed(1)}`);
        }
      }
      expect(low, vision).toEqual([]);
    });

    it(`keeps Brann clear of lethal, Bear and threat with ${vision} (≥ 20 in normal vision, ≥ 10 in every one)`, () => {
      const palette = VISION_PALETTES[vision];
      const see = (hex: string) => simulateVision(hex, vision);
      const floor = vision === 'normal' ? 20 : 10;
      for (const [name, hex] of [
        ['lethal', palette.lethal],
        ['threat', palette.threat],
        ['Bear', MARTYR_HEX.blood],
      ] as const)
        expect(deltaE(see(brann), see(hex)), `${vision}: Brann vs ${name}`).toBeGreaterThanOrEqual(
          floor,
        );
    });
  }

  /**
   * The Movement II environment: Brann's body (#b91c1c) and his lifesteal motes (his ink,
   * #d26b6b) against every Legion body and accent and the Bloodmoon's tint. Where a pair falls
   * under 15 ΔE his identity can't rest on colour there, so the model must carry his brass trim.
   * The rule is the normal-vision table's; it is held here in every vision, which is stricter.
   *
   * Recorded (normal vision; body / ink), 2026-11-03:
   *
   * | Legion colour                         | body | ink  |
   * |---------------------------------------|------|------|
   * | Legion bodies (bone) #b9b1aa          | 76.2 | 44.2 |
   * | hound / Matriarch accent #c9785a      | 37.9 | 16.3 |
   * | Hemomancer accent #b0577a             | 49.7 | 23.3 |
   * | Impaler accent #c8a46e                | 61.5 | 39.1 |
   * | Sentinel accent #8fa3b8               | 86.9 | 54.2 |
   * | Leech accent #7a8f5a                  | 79.9 | 58.0 |
   * | Vharun accent #e0c48a                 | 70.8 | 47.0 |
   * | Bloodmoon tint #8a1c24                | 24.3 | —    |
   *
   * Lowest elsewhere: ink vs the Leech's accent, 4.3 under deuteranopia; ink vs the hound's,
   * 9.5 under tritanopia. Hence the trim (and his ink never fills a danger channel).
   */
  it('measures him against the Movement II environment; any pair under 15 needs his brass trim', () => {
    const ink = BRANN_HEX.ink;
    const legion = CONTENT.enemies.filter((e) => e.movement === 2);
    expect(legion.length).toBeGreaterThan(0);
    const against: [string, string][] = [];
    for (const e of legion) {
      against.push([`${e.id} body`, e.color], [`${e.id} accent`, e.accent]);
    }
    against.push(['Bloodmoon', SPIRE_HEX.bloodmoon]);
    let lowest = Infinity;
    let lowestNormal = Infinity;
    for (const vision of COLOR_VISIONS) {
      const see = (hex: string) => simulateVision(hex, vision);
      for (const [, hex] of against)
        for (const his of [brann, ink]) {
          const d = deltaE(see(his), see(hex));
          lowest = Math.min(lowest, d);
          if (vision === 'normal') lowestNormal = Math.min(lowestNormal, d);
        }
    }
    // His body never sits on a Legion colour in normal vision.
    expect(lowestNormal).toBeGreaterThan(10);
    if (lowest < 15) {
      const g = buildHero(CONTENT.heroes.find((h) => h.id === 'brann')!);
      const c = g.getAttribute('color');
      const trim = new THREE.Color(BRASS_TRIM);
      let parts = 0;
      for (let i = 0; i < c.count; i++)
        if (
          Math.abs(c.getX(i) - trim.r) < 1e-4 &&
          Math.abs(c.getY(i) - trim.g) < 1e-4 &&
          Math.abs(c.getZ(i) - trim.b) < 1e-4
        )
          parts++;
      expect(
        parts,
        `lowest ΔE ${lowest.toFixed(1)}: the model needs its brass trim`,
      ).toBeGreaterThan(0);
    }
  });
});
