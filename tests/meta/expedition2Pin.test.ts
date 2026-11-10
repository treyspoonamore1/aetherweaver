/**
 * Phase 5c, W0a "Characterisation before behaviour" (docs/phase-5c.md, ground rule 1): the
 * two-Movement Expedition is pinned before any Movement III content lands, and this file is
 * re-run once it has.
 *
 * - `generateMap(seed, 2)` for seeds 1-40 equals the fingerprints captured on main (eccfbbd):
 *   Movement III's rows, pools and rewards must leave a 2-Movement map byte-equal.
 * - Every run of the Expedition baseline (`playRun`, `movements: 2`, tools/expedition-baseline.ts)
 *   still plays out equal to tools/expedition-baseline.json.
 * - The Prelude's route strings (`routeHint('prelude')`, `titleEyebrow(false)`) are literals here:
 *   the Expedition's copy is re-derived for three Movements, the Prelude's never changes.
 *
 * `GEN_EXPEDITION2_PIN=<file> npx vitest run tests/meta/expedition2Pin` writes the map
 * fingerprints to `<file>` (only for a change meant to move a 2-Movement map, never in Phase 5c).
 */
import { writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as Run from '../../src/meta/run';
import { prepEyebrow, routeHint, routeOptions, titleEyebrow } from '../../src/ui/screens/routeText';
import {
  EXPEDITION_BOTS,
  EXPEDITION_SEEDS,
  expeditionRun,
  keptExpeditionBaseline,
  projectRun,
} from '../../tools/expedition-baseline';

const SEEDS = Array.from({ length: 40 }, (_, i) => i + 1);

/** FNV-1a over a string, as 8 hex digits. */
function fnv(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/** A map's fingerprint: its row count, node count and a hash of its JSON (every key, in order). */
function fingerprint(seed: number): string {
  const map = Run.generateMap(seed, 2);
  const json = JSON.stringify(map);
  return `${map.rows.length}/${map.rows.flat().length}:${fnv(json)}`;
}

/** `generateMap(seed, 2)` for seeds 1-40: captured on main (eccfbbd) before Phase 5c, re-recorded at Phase 5g go-live (its new Movement II events change the maps). */
const MAPS: readonly string[] = [
  '17/37:f1c22d37',
  '17/37:53d60696',
  '17/37:7de86c69',
  '17/37:4bddb65c',
  '17/37:330b9f76',
  '17/37:f1424bb4',
  '17/37:548247da',
  '17/37:d9371162',
  '17/37:378ef686',
  '17/37:0d60c5d8',
  '17/37:e11f4747',
  '17/37:3fa78d13',
  '17/37:3c6babd3',
  '17/37:1d193cc6',
  '17/37:296dea4b',
  '17/37:7db03a35',
  '17/37:31870d2a',
  '17/37:310a6a5f',
  '17/37:ae24cc92',
  '17/37:5448227b',
  '17/37:21470b96',
  '17/37:c2e7c4f7',
  '17/37:eb8c9878',
  '17/37:0d168c9c',
  '17/37:1161df9e',
  '17/37:c3c04bd1',
  '17/37:b4c262e2',
  '17/37:1c7fe55a',
  '17/37:d78e4119',
  '17/37:7b46300c',
  '17/37:0e405d1d',
  '17/37:12ef3b49',
  '17/37:8d493797',
  '17/37:c256eb79',
  '17/37:4e32943b',
  '17/37:ffa8773a',
  '17/37:89cc544a',
  '17/37:8eb077e2',
  '17/37:1b42ba57',
  '17/37:45fc9e1b',
];

describe('the two-Movement Expedition is pinned (Phase 5c, W0a)', () => {
  const gen = process.env['GEN_EXPEDITION2_PIN'];
  it.runIf(!!gen)('writes the map fingerprints', () => {
    writeFileSync(gen!, JSON.stringify(SEEDS.map(fingerprint), null, 2) + '\n');
  });

  it('generateMap(seed, 2) for seeds 1-40 equals its pinned fingerprint', () => {
    expect(MAPS).toHaveLength(SEEDS.length);
    for (const seed of SEEDS) expect(fingerprint(seed), `seed ${seed}`).toBe(MAPS[seed - 1]);
  });

  it('generateMap is deterministic: two calls give equal maps', () => {
    for (const seed of [1, 17, 40])
      expect(Run.generateMap(seed, 2)).toStrictEqual(Run.generateMap(seed, 2));
  });

  for (const [b, bot] of EXPEDITION_BOTS.entries())
    it(`every ${bot} Expedition baseline run (movements 2) plays out equal`, () => {
      const kept = keptExpeditionBaseline();
      expect(kept.movements).toBe(2);
      expect(kept.runs).toHaveLength(EXPEDITION_BOTS.length * EXPEDITION_SEEDS);
      for (let i = 0; i < EXPEDITION_SEEDS; i++) {
        const want = kept.runs[b * EXPEDITION_SEEDS + i]!;
        expect(want.bot).toBe(bot);
        expect(projectRun(expeditionRun(bot, i), want), `${bot} ${i}`).toEqual(want);
      }
      // Five whole Expeditions: several seconds, far past vitest's default on a loaded machine.
    }, 240_000);
});

describe('the Prelude’s route strings are unchanged (Phase 5c, W0a)', () => {
  it('routeHint and titleEyebrow for the Prelude are the literals they always were', () => {
    expect(routeHint('prelude')).toBe('Movement I alone, to The Hollow Cantor.');
    expect(titleEyebrow(false)).toBe('Movement I · The Prelude');
    expect(prepEyebrow({ movements: 1 })).toBe('The Prelude · Movement I');
    expect(prepEyebrow({})).toBe('The Prelude · Movement I');
    expect(routeOptions()[0]).toEqual({ value: 'prelude', label: 'Prelude · ~15 min' });
  });
});
