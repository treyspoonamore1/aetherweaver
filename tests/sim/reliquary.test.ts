/**
 * Phase 4c: the Reliquary in the sim (docs/phase-4c.md). A carried relic's passives (its
 * Inscriptions, a Dissonant one, a curse) fold into the same sums as the Astrolabe's nodes; an
 * Empowered relic plays its empowered numbers.
 */
import { describe, expect, it } from 'vitest';
import { CONTENT, PASSIVE_EFFECTS, relicDef } from '../../src/content';
import { songReserveOf, type SimConfig } from '../../src/sim';
import { resolveMods } from '../../src/sim/mods';
import { resolveConfig } from '../../src/sim/world';
import { sandbox, worldOf } from './helpers';

const modsOf = (config: Partial<SimConfig> = {}) =>
  resolveMods(resolveConfig({ seed: 1, ...config }), CONTENT);

describe('passives', () => {
  it('every passive effect the content may carry changes the fight', () => {
    const base = modsOf();
    for (const effect of PASSIVE_EFFECTS)
      expect(modsOf({ passives: [{ effect, value: 5 }] }), effect).not.toEqual(base);
  });

  it('add to the tree’s sums, as gear and passives share theirs', () => {
    // Two Silk travel nodes (Thread +2% each) and a relic's +6%: ×1.10, not ×1.04 × 1.06.
    const m = modsOf({
      astrolabe: ['silk_t1', 'silk_t2'],
      passives: [{ effect: 'thread', value: 6 }],
    });
    expect(m.mendMult).toBeCloseTo(1.1, 9);
    expect(m.empowerMult).toBeCloseTo(1.1, 9);
    // Two relics' Thread add up the same way.
    const twice = modsOf({
      passives: [
        { effect: 'thread', value: 6 },
        { effect: 'thread', value: 4 },
      ],
    });
    expect(twice.mendMult).toBeCloseTo(1.1, 9);
  });

  it('a lighter reserve: the fight and the loadout check agree', () => {
    const passives = [{ effect: 'reserve' as const, value: 10 }];
    expect(songReserveOf(null, [], CONTENT, passives).mult).toBeCloseTo(0.9, 9);
    expect(modsOf({ passives }).reserveMult).toBeCloseTo(0.9, 9);
  });

  it('a curse takes away', () => {
    const m = modsOf({
      passives: [
        { effect: 'spirit', value: -8 },
        { effect: 'ward', value: -10 },
      ],
    });
    expect(m.spiritMult).toBeCloseTo(0.92, 9);
    expect(m.wardBarrierMult).toBeCloseTo(0.9, 9);
  });

  it('the fight shows them; unknown effects are refused; an absent Weaver carries none', () => {
    const sim = sandbox({ passives: [{ effect: 'hero_life', value: 4 }] });
    expect(worldOf(sim).astrolabe.passives).toEqual([{ effect: 'hero_life', value: 4 }]);
    expect(() =>
      resolveConfig({ seed: 1, passives: [{ effect: 'nonsense' as 'life', value: 1 }] }),
    ).toThrow(/passive/);
    const absent = resolveConfig({
      seed: 1,
      encounter: 'first_light',
      absent: true,
      passives: [{ effect: 'life', value: 5 }],
    });
    expect(absent.passives).toEqual([]);
  });
});

describe('empowered relics', () => {
  it('play their empowered numbers', () => {
    expect(modsOf({ relics: ['cantors_hymnal'] }).startResonance).toBe(
      relicDef('cantors_hymnal').values.resonance,
    );
    expect(modsOf({ relics: [{ id: 'cantors_hymnal', empowered: true }] }).startResonance).toBe(
      relicDef('cantors_hymnal').empowered!.values.resonance,
    );
    // Only the numbers it names change: the Hollow Bell's cooldown and heal both.
    const bell = modsOf({ relics: [{ id: 'hollow_bell', empowered: true }] });
    expect(bell.chimeCooldownMult).toBeCloseTo(0.45, 9);
    expect(bell.chimeHealMult).toBeCloseTo(0.65, 9);
  });

  it('a relic with no numbers to grow can’t be Empowered', () => {
    const config = resolveConfig({ seed: 1, relics: [{ id: 'martyrs_veil', empowered: true }] });
    expect(config.relics).toEqual([{ id: 'martyrs_veil', cleansed: false, empowered: false }]);
  });
});
