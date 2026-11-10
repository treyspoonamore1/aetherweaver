/**
 * Phase 5d, W0a "Characterisation first" (docs/phase-5d.md, ground rule 1): the three-Movement
 * Expedition is pinned before any Finale content lands, and this file is re-run once it has.
 *
 * - `generateMap(seed, 3)` for seeds 1-40 equals the fingerprints captured on main (b11f149): the
 *   Finale's `road`, `routeDefs` and the Finale def itself must leave a 3-Movement map byte-equal
 *   (ground rule 7: the road is route-scoped).
 * - The I-III route strings, for a run that says `movements: 3` (an in-flight I-III save keeps the
 *   length it was made with), are literals here: the Expedition's default copy is re-derived for
 *   the Finale (W3), the I-III copy never changes.
 *
 * The I-III Expedition baseline (tools/expedition3-baseline.json) is checked by
 * `npx tsx tools/expedition-baseline.ts --movements 3 --check` and, a run per bot, by
 * tests/meta/movement3Handoff.test.ts. The I-II pin is tests/meta/expedition2Pin.test.ts.
 *
 * `GEN_EXPEDITION3_PIN=<file> npx vitest run tests/meta/expedition3Pin` writes the map
 * fingerprints to `<file>` (only for a change meant to move a 3-Movement map, never in Phase 5d).
 */
import { writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as Run from '../../src/meta/run';
import { expeditionReach } from '../../src/meta/profile';
import type { MapNode, RunMap } from '../../src/meta/types';
import {
  abandonLine,
  combatSubtitle,
  expeditionLength,
  expeditionOnward,
  finalEncounter,
  gateStep,
  mapHeader,
  movementCard,
  movementLabel,
  movementPlace,
  movementReached,
  outcomeSub,
  prepEyebrow,
  routeHint,
  routeName,
  summaryEyebrow,
  titleEyebrow,
} from '../../src/ui/screens/routeText';

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
  const map = Run.generateMap(seed, 3);
  const json = JSON.stringify(map);
  return `${map.rows.length}/${map.rows.flat().length}:${fnv(json)}`;
}

/** `generateMap(seed, 3)` for seeds 1-40: captured on main (b11f149) before Phase 5d, re-recorded at Phase 5g go-live (its new Movement II and III events change the maps). */
const MAPS: readonly string[] = [
  '23/49:7690a441',
  '23/49:8d2f962c',
  '23/49:16bf6aa1',
  '23/49:2a86526f',
  '23/49:80604284',
  '23/49:616c980a',
  '23/49:4e0d9d0a',
  '23/49:abba97f8',
  '23/49:145cf5ae',
  '23/49:a43753cc',
  '23/49:5675cc69',
  '23/49:2bf80f2d',
  '23/49:ae5f0502',
  '23/49:358d20c4',
  '23/49:829816b9',
  '23/49:172ff387',
  '23/49:f55bf74a',
  '23/49:d1c3f8f3',
  '23/49:033be6dc',
  '23/49:e83cf1e5',
  '23/49:b987c480',
  '23/49:4108f5f7',
  '23/49:1293a372',
  '23/49:611772ac',
  '23/49:9bf4df2e',
  '23/49:2aa3b67d',
  '23/49:223ef796',
  '23/49:3fc342e8',
  '23/49:d24654a9',
  '23/49:a08dd7a6',
  '23/49:dec007bf',
  '23/49:ac6ac2b7',
  '23/49:78fba153',
  '23/49:ec89ce4f',
  '23/49:93eace33',
  '23/49:ec685d98',
  '23/49:3cbbda89',
  '23/49:9c83da65',
  '23/49:8bb33181',
  '23/49:4605f03f',
];

/** A walk from the first stop to the last, always taking a node's first `next`. */
function walk(map: RunMap): string[] {
  const nodes = map.rows.flat();
  const path: string[] = [];
  let node: MapNode | undefined = map.rows[0]![0];
  while (node) {
    path.push(node.id);
    const next: string | undefined = node.next[0];
    node = next === undefined ? undefined : nodes.find((n) => n.id === next);
  }
  return path;
}

describe('the three-Movement Expedition is pinned (Phase 5d, W0a)', () => {
  const gen = process.env['GEN_EXPEDITION3_PIN'];
  it.runIf(!!gen)('writes the map fingerprints', () => {
    writeFileSync(gen!, JSON.stringify(SEEDS.map(fingerprint), null, 2) + '\n');
  });

  it('generateMap(seed, 3) for seeds 1-40 equals its pinned fingerprint', () => {
    expect(MAPS).toHaveLength(SEEDS.length);
    for (const seed of SEEDS) expect(fingerprint(seed), `seed ${seed}`).toBe(MAPS[seed - 1]);
  });

  it('generateMap is deterministic: two calls give equal maps', () => {
    for (const seed of [1, 17, 40])
      expect(Run.generateMap(seed, 3)).toStrictEqual(Run.generateMap(seed, 3));
  });

  it('an I-III map is 10 + 7 + 6 rows and ends at the Unweaver', () => {
    const map = Run.generateMap(1, 3);
    const rowsOf = (m: number) => map.rows.filter((r) => r[0]!.movement === m).length;
    expect([rowsOf(1), rowsOf(2), rowsOf(3)]).toEqual([10, 7, 6]);
    expect(finalEncounter({ map })).toBe('the_unweaver');
    expect(movementReached({ map, path: walk(map) })).toBe(3);
  });
});

describe('the I-III route strings are unchanged (Phase 5d, W0a)', () => {
  it('the route copy for a three-Movement run is the literal it always was', () => {
    expect(routeHint('expedition', 3)).toBe('Movements I–III, to the Unweaver.');
    expect(titleEyebrow(true, 3)).toBe('Movements I–III · The Expedition');
    expect(prepEyebrow({ movements: 3 })).toBe('The Expedition · Movements I–III');
    expect(expeditionOnward(3)).toBe('through Movements II–III');
    expect(expeditionLength({ movements: 3 })).toBe(3);
    expect(expeditionReach(3)).toBe('Movements II–III to the Unweaver');
    expect(routeName({ movements: 3 })).toBe('The Expedition');
    expect(summaryEyebrow({ movements: 3 })).toBe('The Expedition · summary');
    expect(abandonLine({ movements: 3 })).toBe(
      'The Expedition ends here and you go to the summary. This cannot be undone.',
    );
    expect(abandonLine({ movements: 3 }, true)).toBe(
      'The Expedition ends here and you go straight to the summary. This cannot be undone.',
    );
  });

  it('Movements I-III keep their labels, cards and places', () => {
    expect([1, 2, 3].map((n) => movementLabel(n))).toEqual([
      'Movement I',
      'Movement II',
      'Movement III',
    ]);
    expect([1, 2, 3].map((n) => movementPlace(n))).toEqual([
      'the Reliquary',
      'the Crimson Spire',
      'the Abyssal Rift',
    ]);
    expect(movementCard(1)).toEqual({
      title: 'Movement I · The Hollow Choir',
      text: 'The Reliquary Road: 10 stops to The Hollow Cantor.',
    });
    expect(movementCard(2)).toEqual({
      title: 'Movement II · The Crimson Legion',
      text: 'The Crimson Ascent: 7 stops to Vharun, the Crimson Warden.',
    });
    expect(movementCard(3)).toEqual({
      title: 'Movement III · The Unstitched',
      text: 'The Unravelling Descent: 6 stops to The Unweaver.',
    });
  });

  it('an I-III map reads as it did on the map, the Gate and the combat HUD', () => {
    const map = Run.generateMap(1, 3);
    const path = walk(map);
    expect(path).toHaveLength(23);
    const at = (k: number) => ({ map, path: path.slice(0, k), pending: path[k], movements: 3 });
    const read = (k: number) => [mapHeader(at(k)), gateStep(at(k)), combatSubtitle(at(k))];
    expect(read(0)).toEqual([
      {
        eyebrow: 'Movement I · The Hollow Choir · step 1 of 10',
        title: 'The Reliquary Road',
        movement: 1,
      },
      'Movement I · step 1 of 10',
      'Movement I · node 1 of 10',
    ]);
    expect(read(10)).toEqual([
      {
        eyebrow: 'Movement II · The Crimson Legion · step 1 of 7',
        title: 'The Crimson Ascent',
        movement: 2,
      },
      'Movement II · step 1 of 7',
      'Movement II · node 1 of 7',
    ]);
    expect(read(19)).toEqual([
      {
        eyebrow: 'Movement III · The Unstitched · step 3 of 6',
        title: 'The Unravelling Descent',
        movement: 3,
      },
      'Movement III · step 3 of 6',
      'Movement III · node 2 of 6',
    ]);
    expect(read(22)).toEqual([
      {
        eyebrow: 'Movement III · The Unstitched · step 6 of 6',
        title: 'The Unravelling Descent',
        movement: 3,
      },
      'Movement III · step 6 of 6',
      'Movement III · node 5 of 6',
    ]);
  });

  it('an I-III Summary names the Unweaver on a win and Movement III on a loss', () => {
    const map = Run.generateMap(1, 3);
    const path = walk(map);
    expect(outcomeSub({ map, path, outcome: 'victory', movements: 3 })).toBe(
      'The Unweaver falls, and the Rift knits shut.',
    );
    expect(outcomeSub({ map, path: path.slice(0, 18), outcome: 'defeat', movements: 3 })).toBe(
      'The party is lost in Movement III, the Unstitched, but every note you wove is on record.',
    );
  });
});
