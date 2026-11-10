/**
 * "More" sources, counted by hand (docs/phase-5g.md, ground rule 8; docs/plan/02 §12 rule 1:
 * multiplicative "more" bonuses come only from the Thread's Empower, Callings' Crescendos,
 * Harmonies, Cue bonuses and enemy debuffs, and no build stacks more than 4 on one stat).
 * `src/content/effects.ts` says content lint enforces it; nothing does, so this registry names
 * every multiplicative factor on a hero's damage and on the damage heroes take, by what brings
 * it, and checks every Calling with any one option per tier, with every Harmony, relic and boon
 * that can be held beside it, puts at most 4 on a stat.
 *
 * A registry entry for an id content doesn't have yet (Phase 5g's, before its stream lands) is
 * counted only once its id is in `CONTENT`. A stream that adds a factor the registry doesn't
 * name adds it here, through the orchestrator (W0 owns this file).
 */
import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../src/content';
import { FILL_IDS } from '../../src/content/fill';

type Stat = 'heroDamage' | 'heroDamageTaken' | 'razorDamage';
type From =
  | { always: true }
  | { calling: string }
  | { option: string }
  | { motif: string }
  | { relic: string }
  | { boon: string };

interface Factor {
  /** What it is, and where the sim multiplies it in. */
  name: string;
  stat: Stat;
  /** What brings it; held by any of them, it counts once. */
  from: readonly From[];
}

const REGISTRY: readonly Factor[] = [
  {
    name: 'Empower, the Thread’s (Afterglow and Spotlight are the same factor; heroDamage.ts)',
    stat: 'heroDamage',
    from: [{ always: true }],
  },
  {
    name: 'the Cue bonus: a Cued Solo’s power (`solo.cuedPower`; solos.ts)',
    stat: 'heroDamage',
    from: [{ always: true }],
  },
  {
    name: 'Heavy Score’s `partyDamageMult` (health.ts); the boons Steadied and Faltering fold into it',
    stat: 'heroDamage',
    from: [{ relic: 'heavy_score' }, { boon: 'steadied' }, { boon: 'faltering' }],
  },
  {
    name: 'the Luminary’s group and Crescendo: Radiance (Searing Hymns) and Eclipse, one factor (health.ts)',
    stat: 'heroDamage',
    from: [{ calling: 'luminary' }],
  },
  {
    name: 'the Conductor’s group and Crescendo: Duets, Trios, the Grand Finale, Marcato, Ensemble (`conductingMult`)',
    stat: 'heroDamage',
    from: [{ calling: 'conductor' }],
  },
  {
    name: 'Concert Pitch (a Harmony, N20: health.ts beside Anthem)',
    stat: 'heroDamage',
    from: [{ motif: 'concert_pitch' }],
  },
  {
    name: 'Cutting Chorus on Razor Silk (a Harmony, N1: Razor Silk’s own damage)',
    stat: 'razorDamage',
    from: [{ motif: 'cutting_chorus' }],
  },
  {
    name: 'the Luminary’s Haloed (health.ts)',
    stat: 'heroDamageTaken',
    from: [{ option: 'haloed' }],
  },
  {
    name: 'Closed Circle (a Harmony, N23)',
    stat: 'heroDamageTaken',
    from: [{ motif: 'closed_circle' }],
  },
  {
    name: 'Iron Mask (N28)',
    stat: 'heroDamageTaken',
    from: [{ relic: 'iron_mask' }],
  },
];

/** The ids Phase 5g will add that the registry names (docs/phase-5g.md's tables). */
const FILL_FACTORS = [
  'concert_pitch',
  'cutting_chorus',
  'closed_circle',
  'iron_mask',
  'steadied',
  'faltering',
];

const inContent = (f: From): boolean =>
  'always' in f
    ? true
    : 'calling' in f
      ? CONTENT.callings.some((c) => c.id === f.calling)
      : 'option' in f
        ? CONTENT.callings.some((c) =>
            c.tiers.some((t) => t.options.some((o) => o.id === f.option)),
          )
        : 'motif' in f
          ? CONTENT.motifs.some((m) => m.id === f.motif)
          : 'relic' in f
            ? CONTENT.relics.some((r) => r.id === f.relic)
            : CONTENT.boons.some((b) => b.id === f.boon);

/** Every choice of one option per tier of a Calling's path (each tier's two, all combined). */
function paths(tiers: readonly { options: readonly { id: string }[] }[]): string[][] {
  return tiers.reduce<string[][]>(
    (out, t) => out.flatMap((p) => t.options.map((o) => [...p, o.id])),
    [[]],
  );
}

/** The factors on each stat for a Calling (or none) and path, with every Harmony, relic and boon. */
function count(calling: string | null, path: readonly string[]): Record<Stat, string[]> {
  const held = (f: From): boolean => {
    if (!inContent(f)) return false;
    if ('always' in f) return true;
    if ('calling' in f) return f.calling === calling;
    if ('option' in f) return path.includes(f.option);
    // Any Harmony, relic or boon can be held beside any Calling.
    return true;
  };
  const out: Record<Stat, string[]> = { heroDamage: [], heroDamageTaken: [], razorDamage: [] };
  for (const factor of REGISTRY) if (factor.from.some(held)) out[factor.stat].push(factor.name);
  return out;
}

describe('"more" sources (docs/phase-5g.md, ground rule 8)', () => {
  it('the registry names real things, or Phase 5g ids not yet landed', () => {
    for (const factor of REGISTRY)
      for (const f of factor.from) {
        const id = Object.values(f)[0] as string | true;
        if (id === true || inContent(f)) continue;
        expect(FILL_FACTORS, factor.name).toContain(id);
      }
    // Once landed, a Phase 5g factor is one of the slice's entries; a motif one is a Harmony.
    for (const id of FILL_FACTORS) {
      const motif = CONTENT.motifs.find((m) => m.id === id);
      const relic = CONTENT.relics.find((r) => r.id === id);
      const boon = CONTENT.boons.find((b) => b.id === id);
      if (motif || relic || boon) expect(FILL_IDS, id).toContain(id);
      if (motif) expect(motif.requires.motifs, `${id} is a Harmony`).toBeDefined();
    }
  });

  it('no Calling, with any one option per tier and every Harmony, relic and boon, puts more than 4 on a stat', () => {
    const over: string[] = [];
    const builds: { calling: string | null; path: string[] }[] = [{ calling: null, path: [] }];
    for (const c of CONTENT.callings)
      for (const path of paths(c.tiers)) builds.push({ calling: c.id, path });
    for (const b of builds) {
      const n = count(b.calling, b.path);
      for (const [stat, factors] of Object.entries(n))
        if (factors.length > 4)
          over.push(`${b.calling ?? 'none'} [${b.path.join(', ')}] ${stat}: ${factors.join('; ')}`);
    }
    expect(over).toEqual([]);
    expect(builds.length).toBeGreaterThan(CONTENT.callings.length);
    // The count reads the registry: a Conductor holds Empower, the Cue bonus and his own group.
    const conductor = CONTENT.callings.find((c) => c.id === 'conductor')!;
    expect(count('conductor', paths(conductor.tiers)[0]!).heroDamage).toEqual(
      expect.arrayContaining([REGISTRY[0]!.name, REGISTRY[1]!.name, REGISTRY[4]!.name]),
    );
  });
});
