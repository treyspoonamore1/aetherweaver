/**
 * The Thread's mode in the world (docs/thread-dial.md): a glyph over the threaded hero, as the
 * HUD's Thread dial shows it. Mend's plus, Empower's four-point star (a switch morphs one into the
 * other, with a pop), Bear's drop on the Martyr's runs; each in the mode's own colour under every
 * colour vision. The real sim drives the real EntityLayer and ThreadView over a real FxKit, as
 * tests/renderKeepsakes.test.ts does.
 */
import * as THREE from 'three';
import { afterEach, describe, expect, it } from 'vitest';
import { COLOR_VISIONS, type ColorVision } from '../src/app/colorVision';
import type { Command, Sim } from '../src/sim';
import { EntityLayer } from '../src/render/entities';
import { FxKit } from '../src/render/fx/kit';
import { SPRITE } from '../src/render/fx/sprites';
import { createModelMaterial } from '../src/render/models/material';
import { C, applyVision } from '../src/render/palette';
import { ThreadView } from '../src/render/thread';
import type { FrameInfo } from '../src/render/types';
import { sandbox } from './sim/helpers';

const SETTINGS: FrameInfo['settings'] = {
  screenShake: 1,
  flashes: 1,
  damageNumbers: true,
  colorVision: 'normal',
};
const TOGGLE: Command = { t: 'mode' };
const BEAR: Command = { t: 'mode', mode: 'bear' };
const THREAD_KAEL: Command = { t: 'thread', slot: 0 };

function harness(sim: Sim = sandbox()) {
  const kit = new FxKit();
  const entities = new EntityLayer(createModelMaterial());
  const thread = new ThreadView(entities, null);
  const cam = new THREE.Vector3(0, 22, 18);
  let time = 0;
  const tick = (commands: Command[] = [], vision: ColorVision = 'normal') => {
    sim.step(commands);
    sim.drainEvents();
    applyVision(vision);
    const frame: FrameInfo = {
      realDt: 1 / 60,
      time,
      alpha: 1,
      hoveredHero: null,
      hoveredEnemy: null,
      aim: null,
      settings: { ...SETTINGS, colorVision: vision },
    };
    kit.begin(time, cam);
    entities.sync(sim.state, frame, kit, 1 / 60);
    thread.sync(sim.state, kit, 1 / 60, time);
    kit.end(1 / 60, 1280, 720, 720, 45);
    time += 1 / 60;
  };
  const run = (ticks: number, commands: Command[] = [], vision: ColorVision = 'normal') => {
    tick(commands, vision);
    for (let i = 1; i < ticks; i++) tick([], vision);
  };
  return { sim, kit, thread, tick, run };
}

/** The mode glyphs drawn last frame, from the overhead sprites: shape, colour, alpha, size. */
function glyphs(kit: FxKit) {
  const siz = kit.spritesTop.array('iSize');
  const col = kit.spritesTop.array('iColor');
  const out: { shape: number; color: THREE.Color; alpha: number; size: number }[] = [];
  for (let i = 0; i < kit.spritesTop.size; i++) {
    const o = i * 4;
    if (Math.round(siz[o + 2]!) !== SPRITE.mode) continue;
    out.push({
      shape: siz[o + 3]!,
      color: new THREE.Color(col[o]!, col[o + 1]!, col[o + 2]!),
      alpha: col[o + 3]!,
      size: siz[o + 1]!,
    });
  }
  return out;
}

const near = (a: THREE.Color, b: THREE.Color) =>
  Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b) < 1e-3;

afterEach(() => {
  applyVision('normal');
});

describe('the mode glyph over the threaded hero', () => {
  it('none without a Thread; Mend’s plus in Mend’s colour once a hero is threaded', () => {
    const h = harness();
    h.run(5);
    expect(h.thread.glyphDrawn).toBeNull();
    expect(glyphs(h.kit)).toEqual([]);
    h.run(40, [THREAD_KAEL]);
    expect(h.thread.glyphDrawn).toMatchObject({ morph: 0, bear: 0 });
    const [g] = glyphs(h.kit);
    expect(g).toBeDefined();
    expect(g!.shape).toBe(0);
    expect(near(g!.color, C.mend)).toBe(true);
    expect(g!.alpha).toBeGreaterThan(0.9);
  });

  it('a switch to Empower morphs the plus into the star, with a pop, and settles there', () => {
    const h = harness();
    h.run(40, [THREAD_KAEL]);
    const rest = h.thread.glyphDrawn!.size;
    h.run(8, [TOGGLE]);
    const mid = h.thread.glyphDrawn!;
    expect(mid.morph).toBeGreaterThan(0.2);
    expect(mid.morph).toBeLessThan(1);
    expect(mid.size).toBeGreaterThan(rest * 1.2);
    h.run(60);
    expect(h.thread.glyphDrawn!.morph).toBeGreaterThan(0.99);
    expect(h.thread.glyphDrawn!.size).toBeCloseTo(rest, 5);
    const [g] = glyphs(h.kit);
    expect(g!.shape).toBeGreaterThan(0.99);
    expect(near(g!.color, C.empower)).toBe(true);
    // And back.
    h.run(60, [TOGGLE]);
    expect(h.thread.glyphDrawn!.morph).toBeLessThan(0.01);
  });

  it('Bear (the Martyr): its drop fades in over the plus in her blood', () => {
    const h = harness(sandbox({ calling: { id: 'martyr', path: [] } }));
    h.run(40, [THREAD_KAEL]);
    h.run(60, [BEAR]);
    expect(h.thread.glyphDrawn!.bear).toBeGreaterThan(0.99);
    const drop = glyphs(h.kit).find((g) => g.shape === 2);
    expect(drop).toBeDefined();
    expect(near(drop!.color, C.bear)).toBe(true);
    expect(drop!.alpha).toBeGreaterThan(0.9);
    // The plus under it is gone (pushed at no alpha, so not drawn at all).
    expect(glyphs(h.kit).some((g) => g.shape < 1.5)).toBe(false);
  });

  it('in the mode’s own colour under every colour vision', () => {
    for (const vision of COLOR_VISIONS) {
      const h = harness();
      h.run(40, [THREAD_KAEL], vision);
      expect(near(glyphs(h.kit)[0]!.color, C.mend), vision).toBe(true);
      h.run(60, [TOGGLE], vision);
      expect(near(glyphs(h.kit)[0]!.color, C.empower), vision).toBe(true);
    }
  });
});
