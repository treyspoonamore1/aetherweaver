/**
 * Phase 4g VFX: the Weaver's keepsakes in the fight (docs/phase-4g.md). The robe she wears reaches
 * her model's materials (its vertex colours: body, trim, glow), her resting rim and her decoys;
 * her Thread look its filament and glow, her ribbons and her hands; and Mend and Empower keep what
 * says which (beads along the Thread, its pulses, both ends) and stay apart under every look and
 * every colour vision. No look: everything as it has always been. Every check drives the real sim
 * and feeds its state to the real EntityLayer and ThreadView over a real FxKit, as
 * tests/renderMartyr.test.ts does; the Atelier's preview is rendered to markup and agrees.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as THREE from 'three';
import { afterEach, describe, expect, it } from 'vitest';
import {
  COLOR_VISIONS,
  deltaE,
  simulateVision,
  visionPalette,
  type ColorVision,
} from '../src/app/colorVision';
import {
  LOOK_CLEARANCE,
  LOOK_MIN_L,
  fitThreadLook,
  lightness,
  luminance,
  modeClearance,
} from '../src/app/threadLook';
import { CONTENT } from '../src/content';
import type { Command, Sim } from '../src/sim';
import { EntityLayer } from '../src/render/entities';
import { FxKit } from '../src/render/fx/kit';
import {
  OWN_LOOK,
  OWN_PALETTE,
  OWN_RIM,
  restRim,
  threadLookHex,
  weaverPalette,
  type WeaverLook,
} from '../src/render/keepsakeCues';
import { buildWeaver } from '../src/render/models/library';
import { createModelMaterial } from '../src/render/models/material';
import { C, applyVision, threadColor } from '../src/render/palette';
import { BEAD_SPACING, ThreadView } from '../src/render/thread';
import type { FrameInfo } from '../src/render/types';
import { sandbox } from './sim/helpers';

const ROBES = CONTENT.cosmetics.robes;
const THREADS = CONTENT.cosmetics.threads;
const LOOKS: (string | null)[] = [null, ...THREADS.map((t) => t.id)];
/** The Thread's mode toggles, Mend ⇄ Empower (it starts in Mend). */
const TOGGLE: Command = { t: 'mode' };

const SETTINGS: FrameInfo['settings'] = {
  screenShake: 1,
  flashes: 1,
  damageNumbers: true,
  colorVision: 'normal',
};

afterEach(() => {
  applyVision('normal');
});

/** "#rrggbb" of a (linear) three.js colour, as authored. */
const hexOf = (c: THREE.Color) => `#${c.getHexString()}`;
/** ΔE between two colours as `vision` sees them. */
const seenDE = (a: string, b: string, vision: ColorVision) =>
  deltaE(simulateVision(a, vision), simulateVision(b, vision));

/** Every distinct vertex colour of a model, as "#rrggbb". */
function vertexColors(geometry: THREE.BufferGeometry): Set<string> {
  const a = geometry.getAttribute('color') as THREE.BufferAttribute;
  const c = new THREE.Color();
  const out = new Set<string>();
  for (let i = 0; i < a.count; i++) out.add(hexOf(c.setRGB(a.getX(i), a.getY(i), a.getZ(i))));
  return out;
}

/** The real EntityLayer and ThreadView over a real FxKit, driven by a real sim. */
function harness(sim: Sim = sandbox()) {
  const kit = new FxKit();
  const entities = new EntityLayer(createModelMaterial());
  const thread = new ThreadView(entities, null);
  const cam = new THREE.Vector3(0, 22, 18);
  let time = 0;
  let look: WeaverLook = { ...OWN_LOOK };
  const tick = (commands: Command[] = [], vision: ColorVision = 'normal') => {
    sim.step(commands);
    sim.drainEvents();
    applyVision(vision);
    // What CombatView does with the frame's look.
    entities.setLook(look);
    thread.setLook(look.thread);
    const frame: FrameInfo = {
      realDt: 1 / 60,
      time,
      alpha: 1,
      hoveredHero: null,
      hoveredEnemy: null,
      aim: null,
      settings: { ...SETTINGS, colorVision: vision },
      look,
    };
    kit.begin(time, cam);
    entities.sync(sim.state, frame, kit, 1 / 60);
    const sprites = kit.sprites.size;
    thread.sync(sim.state, kit, 1 / 60, time);
    const own = { sprites: [sprites, kit.sprites.size - sprites] as const };
    kit.end(1 / 60, 1280, 720, 720, 45);
    time += 1 / 60;
    return own;
  };
  const run = (ticks: number, commands: Command[] = [], vision: ColorVision = 'normal') => {
    let last = tick(commands, vision);
    for (let i = 1; i < ticks; i++) last = tick([], vision);
    return last;
  };
  const wear = (next: Partial<WeaverLook>) => {
    look = { ...look, ...next };
  };
  const weaverRec = () => entities.recs.get(sim.state.weaverId)!;
  return { sim, kit, entities, thread, tick, run, wear, weaverRec };
}

/** Sprites the Thread pushed last frame in exactly `c`. */
function spritesIn(kit: FxKit, [from, count]: readonly [number, number], c: THREE.Color): number {
  const a = kit.sprites.array('iColor');
  let n = 0;
  for (let i = from; i < from + count; i++) {
    const o = i * 4;
    if (Math.abs(a[o]! - c.r) < 1e-4 && Math.abs(a[o + 1]! - c.g) < 1e-4)
      if (Math.abs(a[o + 2]! - c.b) < 1e-4) n++;
  }
  return n;
}

describe('robes on the Weaver', () => {
  // Phase 8b: she is stained glass (src/render/models/art/weaver.ts). Each pane's glass varies a
  // little in tone round its palette colour (a fixed tone per pane), so her colours are read with a
  // tolerance; the outline shell (dark lead) is left out. What these pin is unchanged: her own
  // palette, and every robe's colours (and only the robe's) reaching her model in place.
  /** Her model's glass vertices (no outline shell): [colour, glow]. */
  const glassOf = (g: THREE.BufferGeometry) => {
    const col = g.getAttribute('color') as THREE.BufferAttribute;
    const glow = g.getAttribute('aGlow') as THREE.BufferAttribute;
    const misc = g.getAttribute('aMisc') as THREE.BufferAttribute;
    const out: { c: THREE.Color; glow: number }[] = [];
    for (let i = 0; i < col.count; i++)
      if (misc.getY(i) < 8.5)
        out.push({ c: new THREE.Color(col.getX(i), col.getY(i), col.getZ(i)), glow: glow.getX(i) });
    return out;
  };
  const dist = (a: THREE.Color, hex: string) => {
    const b = new THREE.Color(hex);
    return Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b);
  };
  /**
   * A pane's tone stays within this (linear RGB) of its palette colour (measured: 0.082 at most;
   * her trim, halo and lights are untoned).
   */
  const TONE = 0.09;
  const shareWithin = (g: THREE.BufferGeometry, hex: string, r: number) => {
    const v = glassOf(g);
    return v.filter((x) => dist(x.c, hex) < r).length / v.length;
  };
  const nearShare = (g: THREE.BufferGeometry, hex: string) => shareWithin(g, hex, 0.08);
  const litNearOnly = (g: THREE.BufferGeometry, hexes: string[]) =>
    glassOf(g)
      .filter((x) => x.glow > 0.5)
      .every((x) => hexes.some((h) => dist(x.c, h) < TONE));

  it('her own model: ivory glass, her gold trim and halo, white-gold hands', () => {
    const ivory = '#f4ecdc';
    expect(OWN_PALETTE).toEqual({
      body: ivory,
      head: '#fff8ea',
      trim: '#ffd27a',
      halo: '#ffd27a',
      hand: '#fff1c4',
    });
    const g = buildWeaver();
    // Her robe is ivory glass; her lights are her trim, halo and hands, nothing else.
    expect(nearShare(g, ivory)).toBeGreaterThan(0.15);
    expect(nearShare(g, OWN_PALETTE.trim)).toBeGreaterThan(0.15);
    expect(nearShare(g, OWN_PALETTE.hand)).toBeGreaterThan(0);
    expect(litNearOnly(g, [OWN_PALETTE.trim, OWN_PALETTE.halo, OWN_PALETTE.hand])).toBe(true);
    // No look in the fight: her own, and her faint gold rim.
    const h = harness();
    h.run(4);
    expect(vertexColors(h.weaverRec().batch.geometry)).toEqual(vertexColors(buildWeaver()));
    const rim = new THREE.Color();
    expect(h.weaverRec().batch.tintOf(0, rim)).toBeCloseTo(OWN_RIM.strength, 5);
    expect(hexOf(rim)).toBe(OWN_RIM.hex);
  });

  it("each robe's colours reach her model: its body, its trim on the sash and hem, its glow on the halo", () => {
    for (const robe of ROBES) {
      const h = harness();
      h.wear({ robe: robe.id });
      h.run(3);
      const geometry = h.weaverRec().batch.geometry;
      const c = robe.colors;
      for (const hex of [c.body, c.trim, c.glow])
        expect(nearShare(geometry, hex), `${robe.id} ${hex}`).toBeGreaterThan(0.05);
      // Nothing of her own ivory and gold is left but her hands (her Thread's): no pane within a
      // pane's tone of either.
      expect(shareWithin(geometry, OWN_PALETTE.body, TONE), robe.id).toBe(0);
      expect(shareWithin(geometry, OWN_PALETTE.trim, TONE), robe.id).toBe(0);
      expect(nearShare(geometry, OWN_PALETTE.hand), robe.id).toBeGreaterThan(0);
      // The sash and hem glow in the trim, the halo in the glow, her hands in theirs: no other light.
      expect(litNearOnly(geometry, [c.trim, c.glow, OWN_PALETTE.hand]), robe.id).toBe(true);
    }
  });

  it('a dark robe keeps a rim of its trim, stronger the darker it is', () => {
    for (const robe of ROBES) {
      const h = harness();
      h.wear({ robe: robe.id });
      h.run(3);
      const rim = new THREE.Color();
      const strength = h.weaverRec().batch.tintOf(0, rim);
      expect(hexOf(rim), robe.id).toBe(robe.colors.trim);
      expect(strength, robe.id).toBeCloseTo(restRim(robe.id).strength, 5);
      const dark = luminance(robe.colors.body) < 0.2;
      if (dark) expect(strength, robe.id).toBeGreaterThan(OWN_RIM.strength + 0.12);
      else expect(strength, robe.id).toBeGreaterThanOrEqual(OWN_RIM.strength);
    }
  });

  it('changes when the look does, in place: the same model and batch, recoloured', () => {
    const h = harness();
    h.run(3);
    const geometry = h.weaverRec().batch.geometry;
    const models = h.entities.group.children.length;
    for (const robe of [...ROBES, null]) {
      h.wear({ robe: robe?.id ?? null });
      h.run(2);
      expect(h.weaverRec().batch.geometry).toBe(geometry);
      expect(h.entities.group.children.length).toBe(models);
      expect(vertexColors(geometry)).toEqual(
        vertexColors(buildWeaver(weaverPalette({ robe: robe?.id ?? null, thread: null }))),
      );
    }
    expect(h.entities.weaverLook).toEqual(OWN_LOOK);
  });

  it('an unknown robe (a save from a newer build) is her own', () => {
    expect(weaverPalette({ robe: 'robe_nonesuch', thread: null })).toEqual(OWN_PALETTE);
    expect(restRim('robe_nonesuch')).toEqual(OWN_RIM);
  });
});

describe("the Thread's look", () => {
  /** The Thread on Kael in `look`, under `vision`: its colours in Mend, then in Empower. */
  function modes(look: string | null, vision: ColorVision) {
    const h = harness();
    h.wear({ thread: look });
    h.run(1, [{ t: 'thread', slot: 0 }], vision);
    const mend = h.run(40, [], vision);
    const m = {
      mode: hexOf(h.thread.modeColor),
      halo: hexOf(h.thread.haloColor),
      filament: hexOf(h.thread.filamentColor),
      beads: h.thread.beadsDrawn,
      inMode: spritesIn(h.kit, mend.sprites, h.thread.modeColor),
    };
    const emp = h.run(70, [TOGGLE], vision);
    const e = {
      mode: hexOf(h.thread.modeColor),
      halo: hexOf(h.thread.haloColor),
      filament: hexOf(h.thread.filamentColor),
      beads: h.thread.beadsDrawn,
      inMode: spritesIn(h.kit, emp.sprites, h.thread.modeColor),
    };
    return { mend: m, empower: e };
  }

  it('Mend and Empower stay apart under every look and colour vision (ΔE ≥ 20 as that vision sees them)', () => {
    for (const vision of COLOR_VISIONS) {
      const p = visionPalette(vision);
      for (const look of LOOKS) {
        const r = modes(look, vision);
        const at = `${look ?? 'own'} · ${vision}`;
        // What says which: the mode's own colour (the beads, the pulses, the ends).
        expect(r.mend.mode, at).toBe(p.mend);
        expect(r.empower.mode, at).toBe(p.empower);
        expect(seenDE(r.mend.mode, r.empower.mode, vision), at).toBeGreaterThanOrEqual(20);
      }
    }
  });

  it("a look is the filament and the glow; the mode's colour flows along it as beads and glows at both ends", () => {
    for (const vision of COLOR_VISIONS) {
      for (const look of THREADS) {
        const r = modes(look.id, vision);
        const fit = threadLookHex(look.id, vision)!;
        const at = `${look.id} · ${vision}`;
        for (const m of [r.mend, r.empower]) {
          expect(m.halo, at).toBe(fit.glow);
          expect(m.filament, at).toBe(fit.filament);
          // A Thread of a few metres carries several beads, all in the mode's colour (with the
          // hero's end glow in it too).
          expect(m.beads, at).toBeGreaterThanOrEqual(3);
          expect(m.inMode, at).toBeGreaterThanOrEqual(m.beads + 1);
        }
      }
    }
  });

  it('a look never borrows a mode’s colour: its body keeps its clearance from both, under every vision', () => {
    for (const vision of COLOR_VISIONS) {
      const p = visionPalette(vision);
      for (const look of THREADS) {
        const fit = threadLookHex(look.id, vision)!;
        for (const hex of [fit.filament, fit.glow]) {
          const at = `${look.id} ${hex} · ${vision}`;
          expect(modeClearance(hex, vision), at).toBeGreaterThanOrEqual(LOOK_CLEARANCE);
          expect(seenDE(hex, p.mend, vision), at).toBeGreaterThanOrEqual(LOOK_CLEARANCE);
          expect(seenDE(hex, p.empower, vision), at).toBeGreaterThanOrEqual(LOOK_CLEARANCE);
        }
      }
    }
    // In the standard palette the content's looks are drawn as authored.
    for (const look of THREADS)
      expect(fitThreadLook(look, 'normal')).toEqual({
        filament: look.filament.toLowerCase(),
        glow: look.glow.toLowerCase(),
      });
    // Rose's glow is tritanopia's Empower pink as authored: there it pales until it's clear.
    const rose = THREADS.find((t) => t.id === 'thread_rose')!;
    expect(seenDE(rose.glow, visionPalette('tritanopia').empower, 'tritanopia')).toBeLessThan(5);
    expect(threadLookHex(rose.id, 'tritanopia')!.glow).not.toBe(rose.glow.toLowerCase());
  });

  it('reads over every arena: each look keeps its light and its contrast on every floor', () => {
    const contrast = (a: string, b: string) => {
      const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
      return (hi + 0.05) / (lo + 0.05);
    };
    for (const arena of CONTENT.arenas) {
      // The floor as drawn (arena.ts darkens the theme's floor).
      const floor = hexOf(new THREE.Color(arena.theme.floor).multiplyScalar(0.78));
      for (const vision of COLOR_VISIONS)
        for (const look of THREADS) {
          const fit = threadLookHex(look.id, vision)!;
          for (const hex of [fit.filament, fit.glow]) {
            const at = `${look.id} ${hex} on ${arena.id} · ${vision}`;
            expect(lightness(hex), at).toBeGreaterThanOrEqual(LOOK_MIN_L);
            expect(contrast(hex, floor), at).toBeGreaterThanOrEqual(4.5);
          }
        }
    }
  });

  it('no look: the mode’s colour all through, and no beads, as it has always been', () => {
    for (const vision of COLOR_VISIONS) {
      const r = modes(null, vision);
      for (const m of [r.mend, r.empower]) {
        expect(m.halo).toBe(m.mode);
        expect(m.filament).toBe(m.mode);
        expect(m.beads).toBe(0);
      }
    }
  });

  it("the beads flow out from her hand, keeping their spacing (metres) as the Thread's length changes", () => {
    const h = harness();
    h.wear({ thread: THREADS[0]!.id });
    h.run(30, [{ t: 'thread', slot: 0 }]);
    const near = h.thread.beadsDrawn;
    // She steps back: a longer Thread carries more beads, as many as fit at their spacing.
    h.run(40, [{ t: 'debug', op: { op: 'teleportWeaver', x: 0, z: 8 } }]);
    const far = h.thread.beadsDrawn;
    expect(far).toBeGreaterThan(near);
    const kael = h.entities.recs.get(h.sim.state.party[0]!)!;
    const wr = h.weaverRec();
    const len = Math.hypot(kael.x - wr.x, kael.z - wr.z);
    expect(far).toBeLessThanOrEqual(Math.ceil(len / BEAD_SPACING) + 1);
    expect(far).toBeGreaterThanOrEqual(Math.floor(len / BEAD_SPACING) - 2);
  });

  it("Bear's crimson still takes the whole Thread, a look or not, and its beads give way", () => {
    const sim = sandbox({ calling: { id: 'martyr', path: [] } });
    const h = harness(sim);
    h.wear({ thread: 'thread_rose' });
    h.run(6, [{ t: 'thread', slot: 0 }]);
    expect(h.thread.beadsDrawn).toBeGreaterThan(0);
    h.run(90, [{ t: 'mode', mode: 'bear' }]);
    expect(h.thread.bearLevel).toBeGreaterThan(0.99);
    expect(deltaE(hexOf(h.thread.haloColor), hexOf(C.bear))).toBeLessThan(2);
    expect(deltaE(hexOf(h.thread.filamentColor), hexOf(C.bear))).toBeLessThan(2);
    expect(hexOf(h.thread.modeColor)).toBe(hexOf(threadColor('bear')));
    expect(h.thread.beadsDrawn).toBe(0);
  });

  it("her ribbons and hands are her Thread look's (fitted to the vision), else her own white-gold", () => {
    for (const vision of COLOR_VISIONS) {
      for (const id of LOOKS) {
        const h = harness();
        h.wear({ thread: id });
        h.run(8, [], vision);
        const fit = threadLookHex(id, vision);
        const ribbons = h.kit.ribbons.mesh.geometry.getAttribute('aColor') as THREE.BufferAttribute;
        const seen = new Set<string>();
        const c = new THREE.Color();
        for (let i = 0; i < h.kit.ribbons.vertices; i++)
          seen.add(hexOf(c.setRGB(ribbons.getX(i), ribbons.getY(i), ribbons.getZ(i))));
        // No Thread drawn (none threaded): every ribbon strip is hers.
        expect(h.thread.drawn).toBe(false);
        expect(seen, `${id} · ${vision}`).toEqual(
          new Set(fit ? [fit.filament, fit.glow] : [hexOf(C.goldHot), hexOf(C.gold)]),
        );
        const hand = fit?.filament ?? OWN_PALETTE.hand;
        expect(vertexColors(h.weaverRec().batch.geometry), `${id} · ${vision}`).toContain(hand);
      }
    }
  });

  it("the Atelier's preview draws each look as the fight does, under every colour vision", () => {
    // Both draw a look through the same fitting: the fight by its id, the preview by its colours.
    for (const vision of COLOR_VISIONS)
      for (const look of THREADS)
        expect(fitThreadLook({ filament: look.filament, glow: look.glow }, vision)).toEqual(
          threadLookHex(look.id, vision),
        );
    // The preview (ui/screens/LoomParts.tsx: TSX, outside the tests' project) fits its look to the
    // player's colour vision before it draws the filament and the glow.
    const src = readFileSync(
      join(__dirname, '..', 'src', 'ui', 'screens', 'LoomParts.tsx'),
      'utf8',
    );
    const preview = src.slice(src.indexOf('export function ThreadPreview'));
    expect(preview).toMatch(/fitThreadLook\(look, vision \?\? setting\)/);
    expect(preview).toMatch(/const filament = fitted\?\.filament \?\? m\.color;/);
    expect(preview).toMatch(/const glow = fitted\?\.glow \?\? m\.color;/);
  });
});
