/**
 * Characterisation of the Prelude (docs/phase-5a.md, "Characterisation first"), taken before any
 * Movement II behaviour landed: the maps for seeds 1-40 and whole-run summaries for 10 Novice
 * and 10 Skilled seeds. Phase 5a must leave them equal.
 *
 * Regenerate ONLY when Movement I is meant to change:
 *   WRITE_PRELUDE_SNAPSHOT=1 npx vitest run tests/meta/preludeSnapshot.test.ts
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../src/content';
import { PROFILE_VERSION, movementOneEnemies, newProfile } from '../../src/meta/profile';
import * as Run from '../../src/meta/run';
import { loadProfile, loadRun, type KeyValueStore } from '../../src/meta/save';
import type { RunMap } from '../../src/meta/types';
import { emptyLedger } from '../../src/sim/world';
import { playRun, type RunSummary } from '../../tools/harness-core';

const PATH = fileURLToPath(new URL('./__snapshots__/prelude.json', import.meta.url));
const MAP_SEEDS = Array.from({ length: 40 }, (_, i) => i + 1);
/** The harness's whole-run seeds (tools/harness.ts `--run`). */
const RUN_SEEDS = Array.from({ length: 10 }, (_, i) => 2000 + i * 104729);

interface PreludeSnapshot {
  maps: Record<string, RunMap>;
  runs: { novice: RunSummary[]; skilled: RunSummary[] };
}

/**
 * A Prelude node as it was before Movements existed: a node's `movement` (CONTRACT v7) must
 * be 1, and is left out of the comparison.
 */
function prelude(map: RunMap): RunMap {
  return {
    rows: map.rows.map((row) =>
      row.map((node) => {
        const { movement, ...rest } = node as typeof node & { movement?: number };
        expect(movement ?? 1).toBe(1);
        return rest as typeof node;
      }),
    ),
  };
}

/** A fresh summary cut down to the snapshot's fields (the harness may gain more later). */
function project(fresh: RunSummary, kept: RunSummary | undefined): RunSummary {
  const keys = Object.keys(kept ?? fresh) as (keyof RunSummary)[];
  return Object.fromEntries(keys.map((k) => [k, fresh[k]])) as unknown as RunSummary;
}

function current(): PreludeSnapshot {
  return {
    maps: Object.fromEntries(MAP_SEEDS.map((seed) => [seed, prelude(Run.generateMap(seed))])),
    runs: {
      novice: RUN_SEEDS.map((seed) => playRun(seed, 'novice')),
      skilled: RUN_SEEDS.map((seed) => playRun(seed, 'skilled')),
    },
  };
}

describe('Prelude characterisation (docs/phase-5a.md)', () => {
  if (process.env.WRITE_PRELUDE_SNAPSHOT === '1') {
    it('writes the snapshot', () => {
      writeFileSync(PATH, JSON.stringify(current(), null, 1) + '\n');
    }, 120_000);
    return;
  }

  const kept = existsSync(PATH)
    ? (JSON.parse(readFileSync(PATH, 'utf8')) as PreludeSnapshot)
    : null;

  it('has a committed snapshot', () => {
    expect(kept, `${PATH} is missing`).not.toBeNull();
  });

  it('generateMap(seed) for seeds 1-40 is unchanged', () => {
    for (const seed of MAP_SEEDS)
      expect(prelude(Run.generateMap(seed)), `map seed ${seed}`).toStrictEqual(kept!.maps[seed]);
  });

  for (const bot of ['novice', 'skilled'] as const)
    it(`${bot} whole-run summaries are unchanged`, () => {
      const fresh = RUN_SEEDS.map((seed) => playRun(seed, bot));
      expect(fresh.map((r, i) => project(r, kept!.runs[bot][i]))).toStrictEqual(kept!.runs[bot]);
    }, 120_000);
});

function memoryStore(): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

/** A run one won fight in, as plain JSON. */
function oneFightJson(): Record<string, unknown> {
  let run = Run.embark(Run.newRun(31));
  run = Run.chooseNode(run, Run.reachable(run)[0]!.id);
  const node = Run.findNode(run, run.pending!)!;
  run = Run.finishCombat(run, {
    encounterId: node.encounterId!,
    outcome: 'victory',
    duration: 40,
    ledger: emptyLedger(),
    party: run.party.map((h, slot) => ({
      slot,
      heroId: h.heroId,
      hp: 800,
      maxHp: 1000,
      downed: false,
      dead: false,
      damage: 100,
      amplified: 10,
    })),
    withoutYou: null,
  });
  return JSON.parse(JSON.stringify(run)) as Record<string, unknown>;
}

describe('Movements contracts keep the Prelude a Prelude (docs/phase-5a.md)', () => {
  it('a new run is a one-Movement Prelude whose Cantor is final', () => {
    const run = Run.newRun(5);
    expect(run.movements).toBe(1);
    expect(run.map.rows.flat().every((n) => n.movement === 1)).toBe(true);
    const cantor = run.map.rows[run.map.rows.length - 1]![0]!;
    expect(cantor.encounterId).toBe('hollow_cantor');
    expect(Run.isFinalNode(cantor)).toBe(true);
    expect(run.map.rows.flat().filter((n) => Run.isFinalNode(n))).toEqual([cantor]);
    expect(Run.movementOf(run)).toBe(1);
    expect(Run.reachedMovement(run, 1)).toBe(true);
    expect(Run.reachedMovement(run, 2)).toBe(false);
  });

  it('a v5 run save from before Movements loads as a Prelude', () => {
    const json = oneFightJson();
    delete json.movements;
    for (const row of (json.map as { rows: Record<string, unknown>[][] }).rows)
      for (const node of row) delete node.movement;
    for (const r of json.results as Record<string, unknown>[]) delete r.movement;
    delete (json.lastResult as Record<string, unknown>).movement;
    const store = memoryStore();
    store.data.set('aetherweaver.run', JSON.stringify({ ...json, version: 5 }));
    const loaded = loadRun(store)!;
    expect(loaded).not.toBeNull();
    expect(loaded.version).toBe(5);
    expect(loaded.movements).toBe(1);
    expect(loaded.map.rows.flat().every((n) => n.movement === 1)).toBe(true);
    expect(loaded.results.map((r) => r.movement)).toEqual([1]);
    expect(loaded.lastResult!.movement).toBe(1);
    expect('wonRun' in loaded.results[0]!).toBe(false);
    const last = loaded.map.rows[loaded.map.rows.length - 1]![0]!;
    expect(Run.isFinalNode(last)).toBe(true);
    // Its fights end the run as they always did: a won boss, and nothing else.
    expect(Run.endsRun(loaded.results[0]!)).toBe(false);
    expect(Run.endsRun({ ...loaded.results[0]!, kind: 'boss' })).toBe(true);
    expect(Run.endsRun({ ...loaded.results[0]!, kind: 'boss', outcome: 'defeat' })).toBe(false);
    expect(Run.endsRun({ ...loaded.results[0]!, kind: 'boss', wonRun: false })).toBe(false);
    expect(Run.enshrineEligible(loaded)).toBe(false);
    expect(Run.enshrineEligible({ ...loaded, outcome: 'victory' })).toBe(true);
  });

  it('a v8 profile migrates to v9: Expeditions as the route, every Movement I enemy seen', () => {
    const { runMode: _m, seen: _s, ...v8 } = { ...newProfile(), version: 8, xp: 500 };
    const store = memoryStore();
    store.data.set('aetherweaver.profile', JSON.stringify(v8));
    const loaded = loadProfile(store);
    // Through v9 to v10 since Phase 6 (docs/phase-6.md, ground rule 9: that step is the version alone).
    expect(PROFILE_VERSION).toBe(10);
    expect(loaded.version).toBe(10);
    expect(loaded.xp).toBe(500);
    expect(loaded.runMode).toBe('expedition');
    const m1 = CONTENT.enemies.filter((e) => (e.movement ?? 1) === 1).map((e) => e.id);
    expect(movementOneEnemies()).toEqual(m1);
    expect(loaded.seen).toEqual(m1);
    expect(newProfile().seen).toEqual(m1);
  });
});
