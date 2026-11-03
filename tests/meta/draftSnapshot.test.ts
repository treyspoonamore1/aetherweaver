/**
 * Characterisation of drafts and shops (docs/phase-5b.md, W0a), taken before any Brann content
 * landed: `makeDraft` for every reason and `makeShop` on a node, for 40 seeds, Preludes and
 * Expeditions, with a few owned motifs and relics. Hero-gated motifs are dropped before the RNG
 * draws (ground rule 4), so a default party's offers must stay equal.
 *
 * Regenerate ONLY when drafts are meant to change:
 *   WRITE_DRAFT_SNAPSHOT=1 npx vitest run tests/meta/draftSnapshot.test.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../src/content';
import * as Run from '../../src/meta/run';
import type { DraftOffer, RunState, ShopItem } from '../../src/meta/types';

const PATH = fileURLToPath(new URL('./draftSnapshot.json', import.meta.url));
const SEEDS = Array.from({ length: 40 }, (_, i) => i + 1);
/** The motifs content held before Phase 5b, so the owned sets never pick up new ones. */
const OLD_MOTIFS = 27;

interface SeedOffers {
  drafts: DraftOffer[];
  shop: ShopItem[];
}

/** A run for `seed`: an Expedition on odd seeds, a few motifs owned, star_chart every 4th. */
function runFor(seed: number): RunState {
  const fresh = Run.newRun(seed, undefined, [], [], [], [], undefined, seed % 2 === 1 ? 2 : 1);
  const run = Run.embark(fresh);
  const motifs = CONTENT.motifs
    .slice(0, OLD_MOTIFS)
    .filter((_, i) => (i * 7 + seed) % 5 === 0)
    .map((m, i) => ({ id: m.id, level: 1 + ((seed + i) % m.values.length) }));
  const relics = seed % 4 === 0 ? [{ id: 'star_chart', cleansed: false }] : [];
  return { ...run, motifs, relics: [...run.relics, ...relics] };
}

function offers(seed: number): SeedOffers {
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
}

describe('drafts and shops are unchanged for the default party (docs/phase-5b.md)', () => {
  it('makeDraft and makeShop over 40 seeds equal the committed snapshot', () => {
    const fresh = Object.fromEntries(SEEDS.map((seed) => [seed, offers(seed)]));
    if (process.env.WRITE_DRAFT_SNAPSHOT)
      writeFileSync(PATH, JSON.stringify(fresh, null, 1) + '\n');
    const kept = JSON.parse(readFileSync(PATH, 'utf8')) as Record<string, SeedOffers>;
    expect(Object.keys(kept)).toHaveLength(40);
    expect(fresh).toEqual(kept);
  });
});
