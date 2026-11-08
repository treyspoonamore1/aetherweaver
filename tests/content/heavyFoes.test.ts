/**
 * The heavy foes, enumerated before any Seren or Oro code lands (docs/phase-5e.md, "Heavy foes"):
 * `HEAVY_LIFE` = 5,000 base life. A heavy foe is never executed by Seren's kill shot, and never
 * taunted or rooted by Oro's summons. Bosses and minibosses are excluded on their own; the only
 * other enemy def at or above the line is the Hollow Champion, a normal-tier 12,000-life summon.
 * A new heavy foe opts in visibly, by failing here.
 */
import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../src/content';

/** `HEAVY_LIFE` (W0b puts it in src/content/rosterIds.ts). */
const HEAVY_LIFE = 5000;

const lesser = () => CONTENT.enemies.filter((e) => e.role !== 'boss' && e.role !== 'miniboss');

describe('the heavy foes (docs/phase-5e.md, W0a)', () => {
  it('non-boss, non-miniboss enemy defs with base life ≥ 5,000 are [mirror_champion]', () => {
    const heavy = lesser().filter((e) => e.hp >= HEAVY_LIFE);
    expect(heavy.map((e) => e.id)).toEqual(['mirror_champion']);
    expect(heavy[0]!.hp).toBe(12000);
  });

  it('every boss and miniboss is above the line too (excluded by tier anyway)', () => {
    const big = CONTENT.enemies.filter((e) => e.role === 'boss' || e.role === 'miniboss');
    expect(big.length).toBeGreaterThan(0);
    for (const e of big) expect(e.hp, e.id).toBeGreaterThanOrEqual(HEAVY_LIFE);
  });

  it('every other lesser foe is under the line', () => {
    const hps = lesser()
      .filter((e) => e.id !== 'mirror_champion')
      .map((e) => e.hp);
    expect(Math.max(...hps)).toBeLessThan(HEAVY_LIFE);
  });
});
