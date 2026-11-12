import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import * as cv from '../src/app/colorVision';
import { CONTENT } from '../src/content';
import { weaverPalette } from '../src/render/keepsakeCues';
import * as lib from '../src/render/models/library';
import { PALETTE } from '../src/render/palette';
import { type FigureShares, NEAR, figureColors } from '../tools/figure-colors';
import main from './fixtures/mainFigureColors.json';

/**
 * Phase 8b (docs/art-style.md, Colour): the figures' colours as built, against the signals.
 *
 * Every figure is built (every hero and enemy, the Weaver in her own colours and every robe, Oro's
 * summons, the elite crown) and its drawn vertices read back (tools/figure-colors.ts). Per colour
 * vision and signal, the share of vertices within 10 ΔE of the signal is held to the same figure
 * on main (tests/fixtures/mainFigureColors.json, recorded from main with that tool):
 * - lit vertices (the figure's own light): at most main's share + 2 points;
 * - unlit vertices: at most main's share + 5 points. The pale signals (Ward's shield, the dome,
 *   goldHot, Resonance, the Weaver's white) are held instead to main's palest figure + 5: every
 *   pale colour (porcelain, silver, bone, skin) sits within 10 of one of them in some vision
 *   whatever its hue, and main's figures carry up to 85% of them.
 * The exceptions are named with the measured share and the reason; each must still be needed.
 */
const LIT_MARGIN = 0.02;
const UNLIT_MARGIN = 0.05;
const PALE = new Set(['shield', 'dome', 'goldHot', 'resonance', 'weaver']);

/** Measured over the limit (percent of the figure's vertices), and why it stands. */
interface Exception {
  keys: string[];
  lit?: number;
  unlit?: number;
  why: string;
}
const PALE_HUE =
  'no pale colour clears every signal: the nearest colour 12 ΔE clear of all of them is a mid ' +
  'blue-grey or violet, 16–80 ΔE from it (searched over hue, saturation and lightness)';
const EXCEPTIONS: Record<string, Exception[]> = {
  'hero:kael': [
    {
      keys: ['deuteranopia:shield'],
      unlit: 29.0,
      why: `his silver trim #e4ecfb and blade #eef3fb (main's palest figure 22.9%): ${PALE_HUE}`,
    },
  ],
  'hero:lyra': [
    {
      keys: ['protanopia:resonance', 'tritanopia:shield'],
      lit: 16.7,
      why:
        "her lit glass is her own colour (content #34d399) lightened, as main's was (7.9%): no " +
        'lightness of it clears every signal by 10 ΔE (best 8.8, half way); she has more lit glass',
    },
  ],
  'hero:vexis': [
    {
      keys: ['protanopia:heal', 'protanopia:mend'],
      lit: 2.3,
      why:
        'the three shards orbiting her focus, her colour (content #a78bfa) lightened: every ' +
        'lavender near it is within 10 of red-green heal; the clear ones are grey (#bdbde4)',
    },
    {
      keys: ['protanopia:dome', 'tritanopia:resonance'],
      lit: 7.2,
      why: `her stars of light #f3e8ff (the starfield, the focus, the mote over her palm): ${PALE_HUE}`,
    },
    {
      keys: ['deuteranopia:shield'],
      unlit: 55.8,
      why: `her silver #dcd6f0 and pale skin #efe1ff (main 16.9%): ${PALE_HUE}`,
    },
    {
      keys: ['tritanopia:ailment'],
      unlit: 11.0,
      why:
        "her robe's glass is her own colour, content #a78bfa (normal vision's ailment itself; " +
        'main 2.9%): she is drawn in it',
    },
  ],
  'hero:seren': [
    {
      keys: ['deuteranopia:shield'],
      unlit: 35.0,
      why: `her steel, shipped (SEREN_STEEL #cbd5e1, Phase 5e; main 22.9%): ${PALE_HUE}`,
    },
  ],
  'enemy:glass_lancer': [
    {
      keys: ['deuteranopia:shield'],
      unlit: 47.2,
      why: `its porcelain is its content colour #dbeafe glazed white (main 15.4%): ${PALE_HUE}`,
    },
  ],
  'enemy:the_unweaver': [
    {
      keys: [
        'normal:resonance',
        'normal:weaver',
        'protanopia:resonance',
        'protanopia:weaver',
        'deuteranopia:resonance',
        'deuteranopia:weaver',
        'tritanopia:goldHot',
        'tritanopia:resonance',
        'tritanopia:weaver',
      ],
      lit: 3.0,
      why: `the two points of bone light in its hood (the Rift's bone #e8e3c8, as main draws it): ${PALE_HUE}`,
    },
  ],
  weaver: [
    {
      keys: ['protanopia:gold', 'deuteranopia:gold', 'tritanopia:gold'],
      lit: 68.6,
      why:
        "her trim and halo in main's own colour #ffd27a (main 48.6%): gold is hers; her rings " +
        'carry more vertices',
    },
  ],
  'weaver:robe_dusk': [
    {
      keys: ['protanopia:heal', 'protanopia:mend', 'deuteranopia:heal', 'deuteranopia:mend'],
      lit: 47.8,
      why:
        "the robe's own trim (content #c4a7ff), exactly as main draws it (main 28.7%): her rings " +
        'carry more vertices',
    },
  ],
  'weaver:robe_ember': [
    {
      keys: ['protanopia:gold', 'deuteranopia:gold', 'tritanopia:amp'],
      lit: 47.8,
      why:
        "the robe's own trim (content #fdba74), exactly as main draws it (main 28.7%): her rings " +
        'carry more vertices',
    },
  ],
};

const baseline = main.figures as Record<string, FigureShares>;
const keys = Object.keys(Object.values(baseline)[0]!);
const palest: Record<string, number> = Object.fromEntries(
  keys.map((k) => [k, Math.max(...Object.values(baseline).map((f) => f[k]!.unlit))]),
);
const pct = (x: number) => +(x * 100).toFixed(1);

describe('Phase 8b: the figures’ built colours against the signals', () => {
  const now = figureColors({ THREE, lib, CONTENT, cv, PALETTE, weaverPalette });

  it('builds every figure, all of them on main', () => {
    expect(main.near).toBe(NEAR);
    expect(Object.keys(now).length).toBeGreaterThanOrEqual(45);
    expect(Object.keys(now).sort()).toEqual(Object.keys(baseline).sort());
  });

  for (const id of Object.keys(now)) {
    it(`keeps ${id} as far from the signals as main did`, () => {
      const shares = now[id]!;
      const base = baseline[id]!;
      for (const key of keys) {
        const signal = key.split(':')[1]!;
        const litLimit = base[key]!.lit + LIT_MARGIN;
        const unlitLimit = (PALE.has(signal) ? palest[key]! : base[key]!.unlit) + UNLIT_MARGIN;
        const { lit, unlit } = shares[key]!;
        const ex = EXCEPTIONS[id]?.find((e) => e.keys.includes(key));
        const at = `${id} ${key}: lit ${pct(lit)}% (limit ${pct(litLimit)}), unlit ${pct(unlit)}% (limit ${pct(unlitLimit)})`;
        if (!ex) {
          expect(lit, at).toBeLessThanOrEqual(litLimit + 1e-9);
          expect(unlit, at).toBeLessThanOrEqual(unlitLimit + 1e-9);
          continue;
        }
        // Still needed (over its limit), and no worse than measured.
        const over = [
          ex.lit !== undefined && lit > litLimit,
          ex.unlit !== undefined && unlit > unlitLimit,
        ];
        expect(over.some(Boolean), `${at}: the exception is no longer needed`).toBe(true);
        expect(pct(lit), at).toBeLessThanOrEqual(ex.lit ?? pct(litLimit));
        expect(pct(unlit), at).toBeLessThanOrEqual(ex.unlit ?? pct(unlitLimit));
      }
    });
  }

  it('names every exception against a figure that is built', () => {
    for (const [id, list] of Object.entries(EXCEPTIONS)) {
      expect(now[id], id).toBeDefined();
      for (const e of list) for (const k of e.keys) expect(keys, `${id} ${k}`).toContain(k);
    }
  });
});
