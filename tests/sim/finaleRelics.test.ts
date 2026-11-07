/**
 * The Finale's three relics (docs/phase-5d.md, "Rewards and the first Finale clear"): each has its
 * own `applyRelic` case adding to an existing mod key, so it stacks on the motif that sets that
 * key (relics resolve after motifs). Carried into a Movement I-III fight they sleep: the mods and
 * the events are those of a run without them.
 */
import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../src/content';
import {
  CONDUCTOR_ENCOUNTER,
  FIRST_SCORE,
  QUICK_ROSIN,
  TACET_MARK,
} from '../../src/content/crucibleIds';
import { createSim, type Sim } from '../../src/sim';
import { KNOWN_RELICS, type Mods } from '../../src/sim/mods';
import type { SimConfig } from '../../src/sim/world';
import { stepFor, worldOf } from './helpers';

type Owned = { id: string; level: number };

/** Each relic, the mod key it moves, the content value it moves it by, and the motif it stacks on. */
const CASES: readonly { relic: string; key: keyof Mods; by: number; motif: Owned }[] = [
  {
    relic: TACET_MARK,
    key: 'perfectWindowBonus',
    by: 0.1,
    motif: { id: 'steady_hands', level: 1 },
  },
  { relic: QUICK_ROSIN, key: 'reelCooldownCut', by: 3, motif: { id: 'fishers_knot', level: 1 } },
  { relic: FIRST_SCORE, key: 'wardCharges', by: 1, motif: { id: 'twin_aegis', level: 1 } },
];

/** A fight of each earlier Movement: Movement I's opening, Vharun and the Unweaver. */
const EARLIER = ['first_light', 'vharun', 'the_unweaver'] as const;

function sim(encounter: string, config: Partial<SimConfig> = {}): Sim {
  return createSim({ seed: 11, encounter, ...config });
}
const modsOf = (s: Sim): Mods => ({ ...worldOf(s).mods });

describe('the Finale relics (docs/phase-5d.md)', () => {
  it('are Movement 4 relics the sim knows', () => {
    for (const { relic, by } of CASES) {
      const def = CONTENT.relics.find((r) => r.id === relic)!;
      expect(def.movement, relic).toBe(4);
      expect(Object.values(def.values), relic).toEqual([by]);
      expect(KNOWN_RELICS, relic).toContain(relic);
    }
    expect(KNOWN_RELICS.slice(-3)).toEqual([TACET_MARK, QUICK_ROSIN, FIRST_SCORE]);
  });

  it('in the Finale each moves its key by its value, and nothing else', () => {
    const plain = modsOf(sim(CONDUCTOR_ENCOUNTER));
    for (const { relic, key, by } of CASES) {
      const mods = modsOf(sim(CONDUCTOR_ENCOUNTER, { relics: [relic] }));
      expect(mods[key] as number, relic).toBeCloseTo((plain[key] as number) + by, 9);
      expect({ ...mods, [key]: plain[key] }, relic).toEqual(plain);
    }
  });

  it('they stack after Steady Hands, Fisher’s Knot and Twin Aegis', () => {
    for (const { relic, key, by, motif } of CASES) {
      const alone = modsOf(sim(CONDUCTOR_ENCOUNTER, { motifs: [motif] }));
      const both = modsOf(sim(CONDUCTOR_ENCOUNTER, { motifs: [motif], relics: [relic] }));
      expect(both[key] as number, relic).toBeCloseTo((alone[key] as number) + by, 9);
      // The motif set the key (a plain assignment), so the stack is the motif's value plus ours.
      expect(alone[key], motif.id).not.toBe(modsOf(sim(CONDUCTOR_ENCOUNTER))[key]);
    }
    // All three together, each on its motif.
    const all = modsOf(
      sim(CONDUCTOR_ENCOUNTER, {
        motifs: CASES.map((c) => c.motif),
        relics: CASES.map((c) => c.relic),
      }),
    );
    expect(all.perfectWindowBonus).toBeCloseTo(0.2, 9);
    expect(all.reelCooldownCut).toBe(5);
    expect(all.wardCharges).toBe(3);
  });

  it('The First Score gives the Weaver her extra charge at the fight’s start', () => {
    const w = (config: Partial<SimConfig>) => {
      const s = sim(CONDUCTOR_ENCOUNTER, config);
      return worldOf(s).entities.get(worldOf(s).weaverId)!.weaver!;
    };
    expect([w({}).wardCharges, w({}).maxWardCharges]).toEqual([1, 1]);
    const scored = w({ relics: [FIRST_SCORE] });
    expect([scored.wardCharges, scored.maxWardCharges]).toEqual([2, 2]);
    const twin = w({ relics: [FIRST_SCORE], motifs: [{ id: 'twin_aegis', level: 1 }] });
    expect([twin.wardCharges, twin.maxWardCharges]).toEqual([3, 3]);
  });

  it('carried into a Movement I-III fight they sleep: mods and events unchanged', () => {
    const relics = CASES.map((c) => c.relic);
    for (const encounter of EARLIER) {
      for (const motifs of [[], CASES.map((c) => c.motif)]) {
        const without = sim(encounter, { motifs });
        const carried = sim(encounter, { motifs, relics });
        expect(modsOf(carried), encounter).toEqual(modsOf(without));
        // Every event of the first 20 s, byte for byte.
        const a = JSON.stringify(stepFor(without, 60 * 20));
        const b = JSON.stringify(stepFor(carried, 60 * 20));
        expect(b, encounter).toBe(a);
        // The carried list keeps them (hashed config, the HUD), asleep.
        expect(worldOf(carried).relics.ids, encounter).toEqual(relics);
      }
    }
  });
});
