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

/** `generateMap(seed, 2)` for seeds 1-40, captured on main (eccfbbd) before Phase 5c. */
const MAPS: readonly string[] = [
  '17/37:22854301',
  '17/37:ea827a73',
  '17/37:43100739',
  '17/37:83749486',
  '17/37:c7288d08',
  '17/37:4cb2ac9b',
  '17/37:1b64bf6f',
  '17/37:870d8610',
  '17/37:f9df9643',
  '17/37:b075c648',
  '17/37:15b3e8c2',
  '17/37:643d5dd8',
  '17/37:37dc54a8',
  '17/37:68d36cac',
  '17/37:d890d5d6',
  '17/37:e11bbf38',
  '17/37:eee34eb0',
  '17/37:2b232c5f',
  '17/37:7b210b86',
  '17/37:6f576bf8',
  '17/37:576d507b',
  '17/37:c00c3bf0',
  '17/37:639c5bb8',
  '17/37:3ffe14f7',
  '17/37:8213269e',
  '17/37:dd753f70',
  '17/37:19201f28',
  '17/37:967b832d',
  '17/37:fd4a4e6c',
  '17/37:011067ca',
  '17/37:cf395027',
  '17/37:e7ad91d8',
  '17/37:a7db3212',
  '17/37:6f7751cc',
  '17/37:a1cc2fa0',
  '17/37:299c5d3c',
  '17/37:609c1f8c',
  '17/37:09f98a01',
  '17/37:d6ae5c29',
  '17/37:cf52eda5',
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
