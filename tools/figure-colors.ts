/**
 * The figures' built colours against the game's signal colours (docs/art-style.md, Colour).
 *
 * Every figure is built (every hero, every enemy, the Weaver in her own colours and in every robe,
 * Oro's summons, the elite's crown), and its drawn vertices (not the outline shell) are read back.
 * Per colour vision and per signal
 * colour (heal, Mend, Ward's shield, threat, lethal, amp, Empower, ailment as that vision's palette
 * draws them; the dome, gold, goldHot, Resonance, the Weaver and discord), it gives the share of
 * vertices within NEAR ΔE of the signal, split into lit vertices (glow above 0.5: the figure's own
 * light, eyes, cores, lit glass) and unlit ones. tests/figureColors.test.ts holds every figure to
 * the same figure on main.
 *
 * Record main's numbers (the test's baseline) from a checkout of main with its node_modules:
 *   npx tsx tools/figure-colors.ts <main checkout> tests/fixtures/mainFigureColors.json
 */
import { writeFileSync } from 'node:fs';

export const VISIONS = ['normal', 'protanopia', 'deuteranopia', 'tritanopia'] as const;
/** Signals each vision's palette draws in its own colour. */
export const ROLE_SIGNALS = [
  'heal',
  'mend',
  'shield',
  'threat',
  'lethal',
  'amp',
  'empower',
  'ailment',
] as const;
/** Signals drawn in one colour in every vision (render/palette.ts). */
export const FIXED_SIGNALS = ['dome', 'gold', 'goldHot', 'resonance', 'weaver', 'discord'] as const;
/** Within this many ΔE (CIE76) of a signal, a vertex counts as near it. */
export const NEAR = 10;

export interface Share {
  lit: number;
  unlit: number;
}
/** `${vision}:${signal}` → share of the figure's drawn vertices near that signal. */
export type FigureShares = Record<string, Share>;

/** The modules a checkout provides (the branch's own, or main's for the baseline). */
export interface Modules {
  // Loose types: the baseline is read from another checkout's modules.
  /* eslint-disable @typescript-eslint/no-explicit-any */
  THREE: any;
  lib: any;
  CONTENT: any;
  cv: any;
  PALETTE: Record<string, string>;
  weaverPalette: (look: { robe: string; thread: null }) => any;
  /* eslint-enable @typescript-eslint/no-explicit-any */
}

/** Every figure's shares, by id (`hero:kael`, `enemy:mute`, `weaver`, `weaver:robe_dusk`, `sapling`). */
export function figureColors(m: Modules): Record<string, FigureShares> {
  const { THREE, lib, CONTENT, cv, PALETTE } = m;
  const figures: [string, () => unknown][] = [
    ...CONTENT.heroes.map((h: { id: string }) => ['hero:' + h.id, () => lib.buildHero(h)]),
    ...CONTENT.enemies.map((e: { id: string }) => ['enemy:' + e.id, () => lib.buildEnemy(e)]),
    ['weaver', () => lib.buildWeaver()],
    // Oro's summons and the elite's crown.
    ['sapling', () => lib.buildSapling()],
    ['ancient', () => lib.buildAncient()],
    ['crown', () => lib.buildCrown()],
    ...CONTENT.cosmetics.robes.map((r: { id: string }) => [
      'weaver:' + r.id,
      () => lib.buildWeaver(m.weaverPalette({ robe: r.id, thread: null })),
    ]),
  ];
  const seen = new Map<string, string>();
  const see = (hex: string, vision: string): string => {
    const key = hex + vision;
    let s = seen.get(key);
    if (!s) seen.set(key, (s = cv.simulateVision(hex, vision) as string));
    return s;
  };
  const colour = new THREE.Color();
  const out: Record<string, FigureShares> = {};
  for (const [id, build] of figures) {
    const g = build() as {
      getAttribute(n: string):
        | {
            count: number;
            getX(i: number): number;
            getY(i: number): number;
            getZ(i: number): number;
          }
        | undefined;
      dispose(): void;
    };
    const c = g.getAttribute('color')!;
    const misc = g.getAttribute('aMisc');
    const glow = g.getAttribute('aGlow')!;
    // Vertex count per drawn colour: [all, lit].
    const counts = new Map<string, [number, number]>();
    let n = 0;
    for (let i = 0; i < c.count; i++) {
      if (misc && misc.getY(i) > 8.5) continue; // the outline shell
      const hex = '#' + colour.setRGB(c.getX(i), c.getY(i), c.getZ(i)).getHexString();
      const e = counts.get(hex) ?? [0, 0];
      e[0]++;
      if (glow.getX(i) > 0.5) e[1]++;
      counts.set(hex, e);
      n++;
    }
    g.dispose();
    const shares: FigureShares = {};
    for (const vision of VISIONS) {
      const palette = cv.VISION_PALETTES[vision] as Record<string, string>;
      const signals: [string, string][] = [
        ...ROLE_SIGNALS.map((r): [string, string] => [r, palette[r]!]),
        ...FIXED_SIGNALS.map((f): [string, string] => [f, PALETTE[f]!]),
      ];
      for (const [name, hex] of signals) {
        const target = see(hex, vision);
        let lit = 0;
        let unlit = 0;
        for (const [h, [all, l]] of counts) {
          if (cv.deltaE(see(h, vision), target) >= NEAR) continue;
          lit += l;
          unlit += all - l;
        }
        shares[`${vision}:${name}`] = { lit: round(lit / n), unlit: round(unlit / n) };
      }
    }
    out[id] = shares;
  }
  return out;
}

const round = (x: number): number => Math.round(x * 10000) / 10000;

async function main(): Promise<void> {
  const [root, file] = process.argv.slice(2);
  if (!root || !file)
    throw new Error('usage: npx tsx tools/figure-colors.ts <checkout> <out.json>');
  const from = (p: string) => import(`${root}/${p}`);
  const [THREE, lib, content, cv, palette, keepsakes] = await Promise.all([
    from('node_modules/three/build/three.module.js'),
    from('src/render/models/library.ts'),
    from('src/content/index.ts'),
    from('src/app/colorVision.ts'),
    from('src/render/palette.ts'),
    from('src/render/keepsakeCues.ts'),
  ]);
  const figures = figureColors({
    THREE,
    lib,
    CONTENT: content.CONTENT,
    cv,
    PALETTE: palette.PALETTE,
    weaverPalette: keepsakes.weaverPalette,
  });
  writeFileSync(file, JSON.stringify({ near: NEAR, figures }, null, 0) + '\n');
  console.log(`${Object.keys(figures).length} figures → ${file}`);
}

if (process.argv[1]?.endsWith('figure-colors.ts')) void main();
