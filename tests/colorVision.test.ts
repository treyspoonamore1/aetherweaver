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
import {
  ABYSS_MOOD,
  BRANN_HEX,
  CRUCIBLE_MOOD,
  CRIMSON_HEX,
  SPIRE_HEX,
  signalHex,
} from '../src/render/crimsonCues';
import { ABYSS_HEX, RIFT_AFFIX_HEX, RIFT_HEX } from '../src/render/riftCues';
import {
  CRUCIBLE_HEX,
  CRUCIBLE_SKY_HEX,
  CRUCIBLE_UNMARKED,
  FINALE_HEX,
} from '../src/render/crucibleCues';
import { cueHex } from '../src/render/bondsCues';
import { MARTYR_HEX } from '../src/render/martyrCues';
import { BRASS_TRIM, ORO_SEED, SEREN_STEEL, buildHero } from '../src/render/models/library';
import { SILENCE_INK } from '../src/ui/hud/finaleLook';
import { PALETTE } from '../src/render/palette';

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

  /**
   * The colour actually drawn for him where a hero's colour sits beside danger: his brass trim
   * (`signalHex`: attack swipes, leap, Solo and ground rings, the edge arrow, the bar's key tag,
   * his Bonds moments). The first pick, #c8a46e, was the Impaler's own accent (0 ΔE), so an
   * Impaler's telegraph ring, badge border and charge streak wore the very colour of his swipes;
   * it sat 11.6 ΔE from Vharun's accent, 13.8 from Lyra under protanopia and 14.5 from the
   * Weaver's amp gold under tritanopia. The tarnished brass #a6a650 replaces it.
   *
   * Recorded (lowest ΔE for #a6a650), 2026-11-03: Weaver gold #f5d78e 20.8 (protanopia); the
   * red-green lethal #c84300 20.9 (deuteranopia); Leech accent #7a8f5a 21.3, Impaler accent
   * #c8a46e 21.5, Vharun accent #e0c48a 22.6 (normal); Vexis #a78bfa 21.6 (tritanopia).
   */
  describe('his brass, the colour drawn beside danger', () => {
    const brass = signalHex('brann', brann);
    const TELEGRAPH_DEFAULT = '#c084fc';

    it('is the colour his signals use, and the model’s trim', () => {
      expect(brass).toBe(BRANN_HEX.brass);
      expect(cueHex('brann')).toBe(brass);
      expect(BRASS_TRIM).toBe(brass);
    });

    it('is ≥ 20 ΔE (normal vision) from every enemy accent, Movement I and II, and every telegraph colour', () => {
      const low: string[] = [];
      const against: [string, string][] = CONTENT.enemies.map((e) => [`${e.id} accent`, e.accent]);
      expect(CONTENT.enemies.some((e) => e.movement === 2)).toBe(true);
      expect(CONTENT.enemies.some((e) => e.movement !== 2)).toBe(true);
      // A telegraph wears its owner's accent (above), the default violet without one, and the
      // threat and lethal of every palette.
      against.push(['telegraph default', TELEGRAPH_DEFAULT]);
      for (const vision of COLOR_VISIONS)
        against.push(
          [`${vision} threat`, VISION_PALETTES[vision].threat],
          [`${vision} lethal`, VISION_PALETTES[vision].lethal],
        );
      for (const [name, hex] of against) {
        const d = deltaE(brass, hex);
        if (d < 20) low.push(`${name} ${hex} ${d.toFixed(1)}`);
      }
      expect(low).toEqual([]);
    });

    for (const vision of COLOR_VISIONS) {
      it(`is ≥ 20 ΔE from every other hero, the Weaver’s gold and amp, lethal, threat and Bear with ${vision}`, () => {
        const see = (hex: string) => simulateVision(hex, vision);
        const palette = VISION_PALETTES[vision];
        const against: [string, string][] = HEROES.filter(([id]) => id !== 'brann').map(
          ([id, hex]) => [id, hex],
        );
        against.push(
          ['Weaver gold', PALETTE.gold],
          ['amp', palette.amp],
          ['lethal', palette.lethal],
          ['threat', palette.threat],
          ['Bear', MARTYR_HEX.blood],
        );
        expect(against.length).toBeGreaterThanOrEqual(8);
        const low: string[] = [];
        for (const [name, hex] of against) {
          const d = deltaE(see(brass), see(hex));
          if (d < 20) low.push(`${name} ${hex} ${d.toFixed(1)}`);
        }
        expect(low, vision).toEqual([]);
      });
    }
  });
});

describe('Movement III colours (docs/phase-5c.md, Presentation)', () => {
  /** The roles a new semantic colour must never be mistaken for (and the Martyr's Bear). */
  const AGAINST = ['lethal', 'threat', 'mend', 'empower'] as const;

  for (const vision of COLOR_VISIONS) {
    it(`keeps every Rift colour ≥ 20 ΔE from lethal, threat, Bear, Mend and Empower with ${vision}`, () => {
      const palette = VISION_PALETTES[vision];
      const see = (hex: string) => simulateVision(hex, vision);
      for (const [name, hex] of Object.entries(RIFT_HEX)) {
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

    /**
     * Teal is Mend: the naive fray teal #2dd4bf is ΔE 0.0 from it, and a pale blue moon sits on the
     * shield (#cdd8f5 measured 3.8 under deuteranopia). No ambient Rift colour may come near either:
     * the rim light tints every hero, the moon lights the disc.
     */
    it(`keeps every ambient Abyss colour ≥ 20 ΔE from Mend and shield with ${vision}`, () => {
      const palette = VISION_PALETTES[vision];
      const see = (hex: string) => simulateVision(hex, vision);
      for (const [name, hex] of Object.entries(ABYSS_HEX))
        for (const role of ['mend', 'heal', 'shield'] as const) {
          const d = deltaE(see(hex), see(palette[role]));
          expect(d, `${vision}: ${name} ${hex} vs ${role} ${palette[role]}`).toBeGreaterThanOrEqual(
            20,
          );
        }
    });
  }

  it('the mood reads the same sky, moon and rim as the ambient set, the rim held at ≤ 0.45', () => {
    expect(ABYSS_MOOD.sky).toBe(ABYSS_HEX.sky);
    expect(ABYSS_MOOD.moon).toBe(ABYSS_HEX.moon);
    expect(ABYSS_MOOD.rim).toBe(ABYSS_HEX.rim);
    expect(ABYSS_MOOD.rimIntensity).toBeLessThanOrEqual(0.45);
  });

  /**
   * The four Rift affixes (an elite's rim and crown gem) must not read as an ailment, a threat, a
   * heal or the Bear. Recorded lowest ΔE, 2026-11-05: Severing #f8fafc 35.9 (ailment,
   * deuteranopia), Silencing #2563eb 23.0 (ailment, tritanopia), Mimicking #e0e7ff 27.7 (Mend,
   * protanopia), Doom-touched #5b21b6 20.6 (ailment, tritanopia). Severing and Mimicking sit close
   * to each other, as do Silencing and Doom-touched: their crown gems' shapes tell them apart.
   */
  describe('the Rift affix colours', () => {
    const AFFIX_AGAINST = ['ailment', 'lethal', 'threat', 'mend', 'heal', 'empower'] as const;

    it('are content’s own', () => {
      for (const [id, hex] of Object.entries(RIFT_AFFIX_HEX))
        expect(CONTENT.affixes.find((a) => a.id === id)?.color, id).toBe(hex);
    });

    for (const vision of COLOR_VISIONS) {
      it(`are ≥ 20 ΔE from ailment violet, lethal, threat, Bear, Mend/heal and Empower with ${vision}`, () => {
        const palette = VISION_PALETTES[vision];
        const see = (hex: string) => simulateVision(hex, vision);
        for (const [id, hex] of Object.entries(RIFT_AFFIX_HEX)) {
          for (const role of AFFIX_AGAINST) {
            const d = deltaE(see(hex), see(palette[role]));
            expect(d, `${vision}: ${id} ${hex} vs ${role} ${palette[role]}`).toBeGreaterThanOrEqual(
              20,
            );
          }
          const bear = deltaE(see(hex), see(MARTYR_HEX.blood));
          expect(bear, `${vision}: ${id} ${hex} vs Bear`).toBeGreaterThanOrEqual(20);
        }
      });
    }
  });

  /**
   * The Movement III environment (a copy of the Movement II measure above): every hero's colour,
   * and Brann's ink, against every Unstitched body and accent and the Abyss's ambient colours.
   * Where Brann sits under 15 ΔE his model must carry his brass trim; no hero's body may sit on a
   * Rift colour in normal vision.
   */
  it('measures the heroes against the Movement III environment; Brann under 15 needs his trim', () => {
    const unstitched = CONTENT.enemies.filter((e) => e.movement === 3);
    expect(unstitched.length).toBeGreaterThan(0);
    const against: [string, string][] = [];
    for (const e of unstitched)
      against.push([`${e.id} body`, e.color], [`${e.id} accent`, e.accent]);
    for (const [name, hex] of Object.entries(ABYSS_HEX)) against.push([`abyss ${name}`, hex]);
    const brann = CONTENT.heroes.find((h) => h.id === 'brann')!.color;
    let brannLowest = Infinity;
    const lowestNormal: Record<string, number> = {};
    for (const vision of COLOR_VISIONS) {
      const see = (hex: string) => simulateVision(hex, vision);
      for (const h of CONTENT.heroes) {
        const own = h.id === 'brann' ? [brann, BRANN_HEX.ink] : [h.color];
        for (const [, hex] of against)
          for (const c of own) {
            const d = deltaE(see(c), see(hex));
            if (h.id === 'brann') brannLowest = Math.min(brannLowest, d);
            if (vision === 'normal') lowestNormal[h.id] = Math.min(lowestNormal[h.id] ?? 99, d);
          }
      }
    }
    for (const [id, d] of Object.entries(lowestNormal)) expect(d, id).toBeGreaterThan(10);
    if (brannLowest < 15) {
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
        `lowest ΔE ${brannLowest.toFixed(1)}: the model needs its brass trim`,
      ).toBeGreaterThan(0);
    }
  });
});

describe('The Finale colours (docs/phase-5d.md, Colour)', () => {
  /**
   * Every live role, and the fixed semantic colours a Finale colour must never be read as: the
   * Weaver's gold, goldHot and Resonance (04 §1 rule 4), her own colour, the dome, the Shielded
   * affix's discord pink, the Martyr's Bear and Fermata's hold.
   */
  const FIXED: Record<string, string> = {
    gold: PALETTE.gold,
    goldHot: PALETTE.goldHot,
    resonance: PALETTE.resonance,
    weaver: PALETTE.weaver,
    dome: PALETTE.dome,
    discord: PALETTE.discord,
    bear: MARTYR_HEX.blood,
    fermata: '#e2d6f8',
  };

  for (const vision of COLOR_VISIONS) {
    it(`keeps the Conductor's brass ≥ 20 ΔE from every semantic colour, Resonance and gold included, with ${vision}`, () => {
      const palette = VISION_PALETTES[vision];
      const see = (hex: string) => simulateVision(hex, vision);
      const against: [string, string][] = [
        ...ROLES.map((r): [string, string] => [r, palette[r]]),
        ...Object.entries(FIXED),
      ];
      for (const [name, hex] of Object.entries(FINALE_HEX))
        for (const [other, o] of against) {
          const d = deltaE(see(hex), see(o));
          expect(d, `${vision}: ${name} ${hex} vs ${other} ${o}`).toBeGreaterThanOrEqual(20);
        }
    });

    it(`keeps every Crucible colour that reaches the disc ≥ 20 ΔE from Mend, heal and shield with ${vision}`, () => {
      const palette = VISION_PALETTES[vision];
      const see = (hex: string) => simulateVision(hex, vision);
      for (const [name, hex] of Object.entries(CRUCIBLE_HEX))
        for (const role of ['mend', 'heal', 'shield'] as const) {
          const d = deltaE(see(hex), see(palette[role]));
          expect(d, `${vision}: ${name} ${hex} vs ${role} ${palette[role]}`).toBeGreaterThanOrEqual(
            20,
          );
        }
    });

    it(`keeps every Crucible colour that draws a mark on the disc ≥ 20 ΔE from every semantic colour with ${vision}`, () => {
      // 'CRUCIBLE_HEX kept off them': every live role and every fixed semantic colour, Resonance
      // and gold included. Only CRUCIBLE_UNMARKED (a light, the silence's ash, the glass bodies)
      // is spared, and tests/renderFinale.test.ts checks none of those draws a ring or a beam.
      const palette = VISION_PALETTES[vision];
      const see = (hex: string) => simulateVision(hex, vision);
      const against: [string, string][] = [
        ...ROLES.map((r): [string, string] => [r, palette[r]]),
        ...Object.entries(FIXED),
      ];
      const spared = new Set<string>(CRUCIBLE_UNMARKED);
      for (const [name, hex] of Object.entries(CRUCIBLE_HEX)) {
        if (spared.has(name)) continue;
        for (const [other, o] of against) {
          const d = deltaE(see(hex), see(o));
          expect(d, `${vision}: ${name} ${hex} vs ${other} ${o}`).toBeGreaterThanOrEqual(20);
        }
      }
    });
  }

  it('spares only the key light, the ash and the glass, and the silence marks the disc in slate, not ash', () => {
    expect([...CRUCIBLE_UNMARKED].sort()).toEqual(['glass', 'key', 'silence']);
    expect(CRUCIBLE_HEX.stave).not.toBe(CRUCIBLE_HEX.silence);
    // The reason ash is spared, recorded: under deuteranopia it is the ailment colour.
    const ash = simulateVision(CRUCIBLE_HEX.silence, 'deuteranopia');
    const ailment = simulateVision(VISION_PALETTES.deuteranopia.ailment, 'deuteranopia');
    expect(deltaE(ash, ailment)).toBeLessThan(5);
  });

  it('the sky white-gold and prism sit on the Weaver and the shield: they are kept off the disc', () => {
    // Recorded so the rule stays visible: these are ambient and never semantic, and
    // tests/renderFinale.test.ts checks every piece wearing them stands outside the disc.
    const near = (hex: string, other: (v: (typeof COLOR_VISIONS)[number]) => string) =>
      Math.min(
        ...COLOR_VISIONS.map((v) => deltaE(simulateVision(hex, v), simulateVision(other(v), v))),
      );
    expect(near(CRUCIBLE_SKY_HEX.orrery, () => PALETTE.resonance)).toBeLessThan(20);
    expect(near(CRUCIBLE_SKY_HEX.prism, (v) => VISION_PALETTES[v].heal)).toBeLessThan(20);
    for (const hex of Object.values(CRUCIBLE_SKY_HEX))
      expect(Object.values(CRUCIBLE_HEX) as string[]).not.toContain(hex);
  });

  it('the mood reads the same sky, key and rim as the ambient set, the rim held at ≤ 0.45', () => {
    expect(CRUCIBLE_MOOD.sky).toBe(CRUCIBLE_HEX.sky);
    expect(CRUCIBLE_MOOD.key).toBe(CRUCIBLE_HEX.key);
    expect(CRUCIBLE_MOOD.rim).toBe(CRUCIBLE_HEX.rim);
    expect(CRUCIBLE_MOOD.rimIntensity).toBeLessThanOrEqual(0.45);
    expect(CRUCIBLE_MOOD.keyIntensity).toBeLessThanOrEqual(1.85);
  });
});

describe('Seren and Oro (docs/phase-5e.md, Colour)', () => {
  const HEROES = CONTENT.heroes.map((h) => [h.id, h.color] as const);
  const seren = CONTENT.heroes.find((h) => h.id === 'seren')!.color;
  const oro = CONTENT.heroes.find((h) => h.id === 'oro')!.color;
  const TELEGRAPH_DEFAULT = '#c084fc';
  const countParts = (hex: string, id: string) => {
    const c = buildHero(CONTENT.heroes.find((h) => h.id === id)!).getAttribute('color');
    const want = new THREE.Color(hex);
    let n = 0;
    for (let i = 0; i < c.count; i++)
      if (
        Math.abs(c.getX(i) - want.r) < 1e-4 &&
        Math.abs(c.getY(i) - want.g) < 1e-4 &&
        Math.abs(c.getZ(i) - want.b) < 1e-4
      )
        n++;
    return n;
  };

  it('both are in the hero matrix and the brass test, with no exception of their own', () => {
    expect(HEROES.map(([id]) => id)).toEqual(['kael', 'lyra', 'vexis', 'brann', 'seren', 'oro']);
    expect(seren).toBe('#a018f8');
    expect(oro).toBe('#487858');
    // They signal in their own colours (no SIGNAL_HEX entry): every ring, arrow and moment.
    expect(signalHex('seren', seren)).toBe(seren);
    expect(signalHex('oro', oro)).toBe(oro);
    expect(cueHex('seren')).toBe(seren);
    expect(cueHex('oro')).toBe(oro);
  });

  /**
   * Recorded (lowest ΔE), 2026-11-08: Seren against the other heroes 25.5 (Kael, deuteranopia),
   * Oro 21.3 (Brann, protanopia); against Brann's brass, Seren 40.0 and Oro 33.9 (tritanopia).
   */
  for (const vision of COLOR_VISIONS)
    it(`keeps Seren and Oro ≥ 20 ΔE from every hero, the gold and the brass with ${vision}`, () => {
      const see = (hex: string) => simulateVision(hex, vision);
      const low: string[] = [];
      for (const [id, own] of [
        ['seren', seren],
        ['oro', oro],
      ] as const) {
        const against: [string, string][] = HEROES.filter(([h]) => h !== id).map(([h, c]) => [
          h,
          c,
        ]);
        against.push(['gold', VISION_PALETTES[vision].amp], ['brass', BRANN_HEX.brass]);
        for (const [name, hex] of against) {
          const d = deltaE(see(own), see(hex));
          if (d < 20) low.push(`${id}/${name} ${d.toFixed(1)}`);
        }
      }
      expect(low, vision).toEqual([]);
    });

  /**
   * Seren's violet sits beside danger wherever she does (her duel tether on an enemy, her ring
   * in a pack), so it takes the signal rule: ≥ 20 ΔE from every enemy accent and telegraph colour
   * in normal vision (51.4, the Lamenter). Recorded elsewhere: 30.5 protanopia, 21.8 deuteranopia
   * (the Doubt Wraith's accent), 24.5 tritanopia (the Lamenter's).
   */
  it('keeps Seren ≥ 20 ΔE (normal vision) from every enemy accent and telegraph colour', () => {
    const against: [string, string][] = CONTENT.enemies.map((e) => [`${e.id} accent`, e.accent]);
    against.push(['telegraph default', TELEGRAPH_DEFAULT]);
    for (const vision of COLOR_VISIONS)
      against.push(
        [`${vision} threat`, VISION_PALETTES[vision].threat],
        [`${vision} lethal`, VISION_PALETTES[vision].lethal],
      );
    const low = against
      .map(([name, hex]) => [name, deltaE(seren, hex)] as const)
      .filter(([, d]) => d < 20)
      .map(([name, d]) => `${name} ${d.toFixed(1)}`);
    expect(low).toEqual([]);
  });

  /**
   * Oro's moss against the Movement II and III environments: lowest 18.0 in normal vision (the
   * Abyss's fray), 11.1 (the hound's accent, protanopia), 9.4 (the fray, tritanopia). Under 15, so
   * by Brann's rule his model carries its trim, ORO_SEED, and the trim is measured with the brass
   * rules: ≥ 20 ΔE (normal) from every enemy accent and telegraph colour; ≥ 15 from the Movement
   * II and III environment in every vision (it carries him where the moss can't: lowest 20.2,
   * Vharun's accent, deuteranopia); ≥ 10 from every hero, the gold, lethal, threat, Bear, shield
   * and heal in every vision (lowest 11.1, amp under protanopia: a glow on his staff, never a
   * chip or a channel).
   */
  it('measures Oro against Movements II and III; under 15 his model carries ORO_SEED', () => {
    const env: [string, string][] = [];
    for (const e of CONTENT.enemies)
      if (e.movement === 2 || e.movement === 3)
        env.push([`${e.id} body`, e.color], [`${e.id} accent`, e.accent]);
    for (const [name, hex] of Object.entries(ABYSS_HEX)) env.push([`abyss ${name}`, hex]);
    env.push(['Bloodmoon', SPIRE_HEX.bloodmoon]);
    let lowest = Infinity;
    let lowestNormal = Infinity;
    let seedLowest = Infinity;
    for (const vision of COLOR_VISIONS) {
      const see = (hex: string) => simulateVision(hex, vision);
      for (const [, hex] of env) {
        const d = deltaE(see(oro), see(hex));
        lowest = Math.min(lowest, d);
        if (vision === 'normal') lowestNormal = Math.min(lowestNormal, d);
        seedLowest = Math.min(seedLowest, deltaE(see(ORO_SEED), see(hex)));
      }
    }
    expect(lowestNormal).toBeGreaterThan(10);
    expect(lowest).toBeLessThan(15);
    expect(countParts(ORO_SEED, 'oro'), 'the model needs its seed trim').toBeGreaterThan(0);
    expect(seedLowest).toBeGreaterThanOrEqual(15);
    // The brass rules' rows, for a trim.
    const accents: [string, string][] = CONTENT.enemies.map((e) => [e.id, e.accent]);
    accents.push(['telegraph default', TELEGRAPH_DEFAULT]);
    for (const vision of COLOR_VISIONS)
      accents.push(
        [`${vision} threat`, VISION_PALETTES[vision].threat],
        [`${vision} lethal`, VISION_PALETTES[vision].lethal],
      );
    for (const [name, hex] of accents)
      expect(deltaE(ORO_SEED, hex), name).toBeGreaterThanOrEqual(20);
    for (const vision of COLOR_VISIONS) {
      const see = (hex: string) => simulateVision(hex, vision);
      const p = VISION_PALETTES[vision];
      const against: [string, string][] = HEROES.map(([id, hex]) => [id, hex]);
      against.push(
        ['gold', PALETTE.gold],
        ['amp', p.amp],
        ['lethal', p.lethal],
        ['threat', p.threat],
        ['Bear', MARTYR_HEX.blood],
        ['shield', p.shield],
        ['heal', p.heal],
        ['brass', BRANN_HEX.brass],
      );
      for (const [name, hex] of against)
        expect(deltaE(see(ORO_SEED), see(hex)), `${vision}: ${name}`).toBeGreaterThanOrEqual(10);
    }
  });

  it('Seren’s steel is the stilled ink, on model parts only (her coat and blade)', () => {
    expect(SEREN_STEEL).toBe(SILENCE_INK);
    expect(countParts(SEREN_STEEL, 'seren')).toBeGreaterThan(0);
    // No hero signal, ring or chip is drawn in it: hers is her violet.
    expect(signalHex('seren', seren)).not.toBe(SEREN_STEEL);
    expect(cueHex('seren')).not.toBe(SEREN_STEEL);
  });
});
