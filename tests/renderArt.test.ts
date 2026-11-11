/**
 * The stained-glass figures (Phase 8b, docs/art-style.md): the registry covers every figure a fight
 * can draw, each within its size class's triangle budget, built the same way for any colours,
 * deterministically, and only the Weaver leaded in gold.
 */
import type * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { CONTENT } from '../src/content';
import { OWN_PALETTE, weaverPalette } from '../src/render/keepsakeCues';
import { artBudgets, artDone } from '../src/render/models/art';
import { BUDGET, LEAD_KIND } from '../src/render/models/art/kit';
import {
  buildAncient,
  buildCrown,
  buildEnemy,
  buildHero,
  buildSapling,
  buildWeaver,
} from '../src/render/models/library';

/** Every figure a fight draws, by name, built in its own colours. */
function everyFigure(): [string, () => THREE.BufferGeometry][] {
  return [
    ...CONTENT.heroes.map(
      (h) => [`hero:${h.id}`, () => buildHero(h)] as [string, () => THREE.BufferGeometry],
    ),
    ...CONTENT.enemies.map(
      (e) => [`enemy:${e.id}`, () => buildEnemy(e)] as [string, () => THREE.BufferGeometry],
    ),
    ['weaver', () => buildWeaver()],
    ['sapling', () => buildSapling()],
    ['ancient', () => buildAncient()],
    ['crown', () => buildCrown()],
  ];
}

/** The lead kind of each vertex (aMisc.y: kind + lit share; 9 the outline shell; -1 no lead). */
function leadKinds(g: THREE.BufferGeometry): Set<number> {
  const misc = g.getAttribute('aMisc') as THREE.BufferAttribute;
  const kinds = new Set<number>();
  for (let i = 0; i < misc.count; i++) kinds.add(Math.floor(misc.getY(i) + 0.001));
  return kinds;
}

describe('the stained-glass figures', () => {
  it('every hero and enemy in content has a figure of its own, and so do the summons and the crown', () => {
    const done = artDone();
    for (const h of CONTENT.heroes) expect(done.heroes, h.id).toContain(h.id);
    for (const e of CONTENT.enemies) expect(done.enemies, e.id).toContain(e.id);
    for (const other of ['weaver', 'sapling', 'ancient', 'crown'])
      expect(done.other, other).toContain(other);
    // Each is a stained-glass figure (it carries the art pass's attributes).
    for (const [name, build] of everyFigure()) {
      const g = build();
      expect(g.getAttribute('aMisc'), name).toBeDefined();
      expect(g.getAttribute('aRig'), name).toBeDefined();
    }
  });

  it("every figure is within its size class's triangle budget (outline included)", () => {
    const rows = artBudgets();
    expect(rows.length).toBe(CONTENT.heroes.length + CONTENT.enemies.length + 4);
    for (const row of rows) {
      expect(Object.keys(BUDGET), row.id).toContain(row.size);
      expect(row.triangles, `${row.id} (${row.size})`).toBeLessThanOrEqual(row.budget);
    }
  });

  it('a builder makes the same parts in the same order for any colours (robes recolour in place)', () => {
    const own = buildWeaver(OWN_PALETTE);
    const pos = own.getAttribute('position').array;
    for (const robe of CONTENT.cosmetics.robes) {
      const g = buildWeaver(weaverPalette({ robe: robe.id, thread: null } as never));
      expect(g.getAttribute('position').array, robe.id).toEqual(pos);
    }
    // A hero's or a foe's shape does not hang on its colours.
    for (const h of CONTENT.heroes) {
      const a = buildHero(h).getAttribute('position').array;
      const b = buildHero({ ...h, color: '#808080' }).getAttribute('position').array;
      expect(b, h.id).toEqual(a);
    }
    for (const e of CONTENT.enemies) {
      const a = buildEnemy(e).getAttribute('position').array;
      const b = buildEnemy({ ...e, color: '#808080', accent: '#404040' }).getAttribute(
        'position',
      ).array;
      expect(b, e.id).toEqual(a);
    }
  });

  it('building every figure takes nothing from the shared Math.random, and builds the same twice', () => {
    const spy = vi.spyOn(Math, 'random');
    try {
      const first = everyFigure().map(([, build]) => build().getAttribute('color').array);
      expect(spy).not.toHaveBeenCalled();
      const again = everyFigure().map(([, build]) => build().getAttribute('color').array);
      expect(again).toEqual(first);
    } finally {
      spy.mockRestore();
    }
  });

  it('no figure but the Weaver is leaded in gold (gold means the Weaver)', () => {
    for (const [name, build] of everyFigure()) {
      const gold = leadKinds(build()).has(LEAD_KIND.came);
      expect(gold, name).toBe(name === 'weaver');
    }
  });
});
