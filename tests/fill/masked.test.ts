/**
 * The masked replay (docs/phase-5g.md, ground rule 5): with every entry Phase 5g adds taken out of
 * `CONTENT` again, every seeded-run pin comes out byte-identical to the copy W0 froze before any
 * source changed (`tests/fill/pre5g/`). It passes at W0 (no entries yet), at every content merge,
 * at go-live and after tuning: with the cells and the Prelude pins untouched while the content is
 * live (ground rule 1), it shows the only thing that moved a seeded run is the new pool content.
 *
 * `vi.mock` replaces `src/content/index.ts` for everything this file loads (the run layer, the
 * sim, the bots and the harness all read `CONTENT` from it): the real module, its `CONTENT`
 * without any id in `FILL_IDS` and without Phase 6's appended entries (docs/phase-6.md, decision
 * 16), and `CONTENT_VERSION` recomputed by `contentVersionOf`. It checks:
 * - the recomputed version equals the pre-W0 `contentVersion` (golden.json as frozen);
 * - all 40 seeds of `tests/meta/draftSnapshot.json` (`makeDraft`, `makeShop`), as frozen;
 * - `generateMap(seed, route)` for seeds 1-40 on routes 2, 3 and 4, against fingerprints taken
 *   on the pre-W0 tree (`maps.json`);
 * - the first Novice and the first Skilled run of every Expedition baseline file, as frozen.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { CONTENT, CONTENT_VERSION, contentVersionOf } from '../../src/content';
import type * as ContentModule from '../../src/content';
import { FILL_IDS } from '../../src/content/fill';
import * as Run from '../../src/meta/run';
import type { DraftOffer, RunState, ShopItem } from '../../src/meta/types';
import { createWorld } from '../../src/sim/world';
import {
  EXPEDITION_SEEDS,
  expeditionRun,
  projectRun,
  type ExpeditionBaseline,
} from '../../tools/expedition-baseline';
import type { BaselineParty } from '../../tools/m1-baseline';

vi.mock('../../src/content', async (importOriginal) => {
  const real = await importOriginal<typeof ContentModule>();
  const { FILL_IDS: ids } = await import('../../src/content/fill');
  const drop = new Set(ids);
  const keep = <T extends { id: string }>(list: readonly T[]): T[] =>
    list.filter((x) => !drop.has(x.id));
  // Phase 6 (docs/phase-6.md, decision 16): its content is only ever appended, so everything
  // after each list's last entry before Phase 6 goes too: the levels after Discordant Pact, the
  // Deeds after Curtain Call (`PHASE6_DEEDS`), and the keepsakes after each cosmetic list's last
  // (the Atlas's robe, Thread look and titles); its three new lists are emptied (an empty one is
  // left out of the hash, `contentVersionOf`).
  const upTo = <T extends { id: string }>(list: readonly T[], last: string): T[] => {
    const i = list.findIndex((x) => x.id === last);
    if (i < 0) throw new Error(`the mask's anchor "${last}" is gone`);
    return list.slice(0, i + 1);
  };
  const cosmetics = real.CONTENT.cosmetics;
  const masked = {
    ...real.CONTENT,
    motifs: keep(real.CONTENT.motifs),
    relics: keep(real.CONTENT.relics),
    boons: keep(real.CONTENT.boons),
    events: keep(real.CONTENT.events),
    deeds: upTo(real.CONTENT.deeds, 'curtain_call'),
    dissonance: upTo(real.CONTENT.dissonance, 'discordant_pact'),
    cosmetics: {
      ...cosmetics,
      robes: upTo(cosmetics.robes, 'robe_bone'),
      threads: upTo(cosmetics.threads, 'thread_starlit'),
      titles: upTo(cosmetics.titles, 'title_flawless'),
    },
    echoes: [],
    constellations: [],
    weekly: [],
  };
  // A tag JSON never sees (not enumerable), so the tests can tell this object reached the sim.
  Object.defineProperty(masked, 'masked', { value: true, enumerable: false });
  return { ...real, CONTENT: masked, CONTENT_VERSION: real.contentVersionOf(masked) };
});

const pre5g = (name: string): string =>
  readFileSync(fileURLToPath(new URL(`./pre5g/${name}`, import.meta.url)), 'utf8');
const frozen = <T>(name: string): T => JSON.parse(pre5g(name)) as T;

describe('the masked replay (docs/phase-5g.md, ground rule 5)', () => {
  it('the mock took every Phase 5g entry out of CONTENT, and the sim reads that CONTENT', () => {
    const ids = new Set(FILL_IDS);
    for (const list of [CONTENT.motifs, CONTENT.relics, CONTENT.boons, CONTENT.events])
      expect(list.filter((x) => ids.has(x.id)).map((x) => x.id)).toEqual([]);
    expect((CONTENT as unknown as { masked?: boolean }).masked).toBe(true);
    // ...and every Phase 6 entry (decision 16).
    expect(CONTENT.dissonance.at(-1)?.id).toBe('discordant_pact');
    expect(CONTENT.deeds.at(-1)?.id).toBe('curtain_call');
    expect([CONTENT.echoes, CONTENT.constellations, CONTENT.weekly]).toEqual([[], [], []]);
    // The sim's world holds the content its module imported: the masked one.
    expect(createWorld({ seed: 1 }).content).toBe(CONTENT);
  });

  it('the recomputed contentVersion equals the pre-W0 one', () => {
    const { contentVersion } = frozen<{ contentVersion: string }>('golden.json');
    expect(contentVersionOf(CONTENT)).toBe(contentVersion);
    expect(CONTENT_VERSION).toBe(contentVersion);
  });

  it('all 40 draftSnapshot seeds equal the frozen copy', () => {
    // As tests/meta/draftSnapshot.test.ts plays them.
    const OLD_MOTIFS = 27;
    const runFor = (seed: number): RunState => {
      const fresh = Run.newRun(seed, undefined, [], [], [], [], undefined, seed % 2 === 1 ? 2 : 1);
      const run = Run.embark(fresh);
      const motifs = CONTENT.motifs
        .slice(0, OLD_MOTIFS)
        .filter((_, i) => (i * 7 + seed) % 5 === 0)
        .map((m, i) => ({ id: m.id, level: 1 + ((seed + i) % m.values.length) }));
      const relics = seed % 4 === 0 ? [{ id: 'star_chart', cleansed: false }] : [];
      return { ...run, motifs, relics: [...run.relics, ...relics] };
    };
    const offers = (seed: number): { drafts: DraftOffer[]; shop: ShopItem[] } => {
      const run = runFor(seed);
      const drafts = [
        Run.makeDraft(run, 'victory', 'common'),
        Run.makeDraft(run, 'victory', 'common', 1),
        Run.makeDraft(run, 'elite', 'rare'),
        Run.makeDraft(run, 'boss', 'epic'),
        Run.makeDraft(run, 'shrine', 'common'),
        Run.makeDraft(run, 'meditate', 'common'),
      ];
      const nodes = run.map.rows.flat();
      const node = nodes.find((n) => n.kind === 'merchant') ?? nodes[seed % nodes.length]!;
      return { drafts, shop: Run.makeShop(run, node) };
    };
    const kept = frozen<Record<string, unknown>>('draftSnapshot.json');
    expect(Object.keys(kept)).toHaveLength(40);
    for (let seed = 1; seed <= 40; seed++)
      expect(offers(seed), `seed ${seed}`).toEqual(kept[String(seed)]);
  });

  it('generateMap(seed, 2|3|4) for seeds 1-40 equals the pre-W0 fingerprints', () => {
    const fnv = (s: string): string => {
      let h = 0x811c9dc5;
      for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 0x01000193) >>> 0;
      }
      return h.toString(16).padStart(8, '0');
    };
    const kept = frozen<Record<string, string[]>>('maps.json');
    for (const route of [2, 3, 4]) {
      expect(kept[String(route)]).toHaveLength(40);
      for (let seed = 1; seed <= 40; seed++) {
        const map = Run.generateMap(seed, route);
        const print = `${map.rows.length}/${map.rows.flat().length}:${fnv(JSON.stringify(map))}`;
        expect(print, `route ${route} seed ${seed}`).toBe(kept[String(route)]![seed - 1]);
      }
    }
  });

  // Every Expedition baseline file: its route and party, as tools/expedition-baseline.ts names it.
  const BASELINES: readonly { file: string; movements: number; party?: BaselineParty }[] = [
    { file: 'expedition-baseline.json', movements: 2 },
    { file: 'expedition3-baseline.json', movements: 3 },
    { file: 'expedition4-baseline.json', movements: 4 },
    ...(['A', 'B', 'C', 'SA', 'SB', 'SC', 'OA', 'OB', 'OC'] as const).map((party) => ({
      file: `expedition4-baseline-${party}.json`,
      movements: 4,
      party,
    })),
  ];

  for (const b of BASELINES)
    it(`${b.file}: its first Novice and first Skilled run equal the frozen copy`, () => {
      const kept = frozen<ExpeditionBaseline>(b.file);
      expect(kept.movements).toBe(b.movements);
      const novice = kept.runs[0]!;
      const skilled = kept.runs[EXPEDITION_SEEDS]!;
      expect([novice.bot, skilled.bot]).toEqual(['novice', 'skilled']);
      expect(projectRun(expeditionRun('novice', 0, b.movements, b.party), novice)).toEqual(novice);
      expect(projectRun(expeditionRun('skilled', 0, b.movements, b.party), skilled)).toEqual(
        skilled,
      );
      // Two whole Expeditions: far past vitest's default on a loaded machine.
    }, 600_000);
});
