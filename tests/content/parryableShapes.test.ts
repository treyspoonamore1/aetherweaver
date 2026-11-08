/**
 * The parryable list, enumerated before any Parry code lands (docs/phase-5e.md, "Parry: what is
 * melee"; decision: "Parry's melee test is a shape rule … It is enumerated in W0a"). Besides an
 * enemy's basic melee swing at her, Seren parries a cone ('cleave') telegraph of radius 6 m or
 * less (`PARRY_REACH`) whose target is her. This pins today's qualifying cones, so a new cleave
 * with r ≤ 6 m opts in visibly, by failing here, and no hashed AttackDef is edited to mark it.
 */
import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../src/content';

/** `PARRY_REACH` (W0b puts it in src/content/rosterIds.ts): a parryable cone's largest radius. */
const PARRY_REACH = 6;

/** Today's cones of radius ≤ 6 m, in content order (docs/phase-5e.md's list). */
const PARRYABLE = [
  'brute_toll_cleave',
  'bellwarden_slam',
  'cantor_toll',
  'leech_latch',
  'gorehound_rend',
  'vharun_twin_cleave',
  'vharun_twin_cleave_second',
  'unweaver_shear',
  'champion_cleave',
  'conductor_downbeat',
];

describe('the parryable cones (docs/phase-5e.md, W0a)', () => {
  it("today's cone telegraphs with radius ≤ 6 m are exactly the ten listed", () => {
    const cones = CONTENT.attacks.filter((a) => a.kind === 'cleave' && a.radius <= PARRY_REACH);
    expect(cones.map((a) => a.id)).toEqual(PARRYABLE);
  });

  it('each is a damaging blow on its current target', () => {
    for (const id of PARRYABLE) {
      const a = CONTENT.attacks.find((x) => x.id === id)!;
      expect(a.effect, id).toBe('damage');
      expect(a.targeting, id).toBe('current');
      expect(a.radius, id).toBeGreaterThan(0);
    }
  });

  it("the only wider cones are Crimson Tide's two halves (r 30), never parried", () => {
    const wide = CONTENT.attacks.filter((a) => a.kind === 'cleave' && a.radius > PARRY_REACH);
    expect(wide.map((a) => [a.id, a.radius])).toEqual([
      ['vharun_crimson_tide', 30],
      ['vharun_crimson_tide_back', 30],
    ]);
  });

  it('the Tolls are a burst and a donut, not cones', () => {
    const kind = (id: string) => CONTENT.attacks.find((a) => a.id === id)?.kind;
    expect(kind('bellwarden_toll_out')).toBe('burst');
    expect(kind('bellwarden_toll_in')).toBe('donut');
  });
});
