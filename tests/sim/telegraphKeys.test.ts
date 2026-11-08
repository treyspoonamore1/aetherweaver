/**
 * The telegraph-state key sets, pinned before Phase 5e (docs/phase-5e.md, W0a "Characterisation
 * first"). Every live telegraph in every tick of the 19 goldens is read, and the distinct
 * `Object.keys` lists (in the order the sim wrote them, its shape's after) are recorded. Seren's parry reads
 * telegraphs (`parryable`, the cone rule) but adds no key to them, and no Seren or Oro state
 * lands on a telegraph, so this set must stay equal: a stray optional key would show up here
 * before it moved a hash.
 *
 * Regenerate ONLY when telegraph state is meant to change:
 *   WRITE_TELEGRAPH_KEYS=1 npx vitest run tests/sim/telegraphKeys.test.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { createSim } from '../../src/sim';
import { SCENARIOS } from '../../tools/scenarios';
import golden from './golden.json';

const PATH = fileURLToPath(new URL('./telegraphKeys.json', import.meta.url));
// The nineteen goldens W0a pinned: golden.json's first nineteen (Seren's and Oro's six follow).
const GOLDENS = Object.fromEntries(Object.entries(golden.scenarios).slice(0, 19)) as Record<
  string,
  string
>;

interface Kept {
  /** Each golden's distinct key lists, sorted, with how many telegraph-ticks carried each. */
  byScenario: Record<string, Record<string, number>>;
  /** Every key any telegraph carried, sorted. */
  keys: string[];
}

/** Plays a golden exactly as tools/runScenario.ts does, reading the telegraphs every tick. */
function play(name: string): { hash: string; lists: Map<string, number> } {
  const scenario = SCENARIOS.find((s) => s.name === name)!;
  const sim = createSim({ seed: scenario.seed, debug: true, ...scenario.config });
  const drive = scenario.driver();
  const lists = new Map<string, number>();
  for (let tick = 0; tick < scenario.ticks; tick++) {
    sim.step(drive(tick, sim.state));
    sim.drainEvents();
    for (const t of sim.state.telegraphs) {
      // The telegraph's own keys, then its shape's (a union by kind).
      const key = `${Object.keys(t).join(',')} | shape ${Object.keys(t.shape).join(',')}`;
      lists.set(key, (lists.get(key) ?? 0) + 1);
    }
  }
  return { hash: sim.hash(), lists };
}

function current(): Kept {
  const byScenario: Record<string, Record<string, number>> = {};
  const keys = new Set<string>();
  for (const name of Object.keys(GOLDENS)) {
    const { hash, lists } = play(name);
    expect(hash, name).toBe(GOLDENS[name]);
    byScenario[name] = Object.fromEntries([...lists].sort(([a], [b]) => (a < b ? -1 : 1)));
    for (const list of lists.keys())
      for (const k of list.split(' | ')[0]!.split(',')) if (k) keys.add(k);
  }
  return { byScenario, keys: [...keys].sort() };
}

describe('telegraph state keys are unchanged over the 19 goldens (docs/phase-5e.md, W0a)', () => {
  it('equal the committed key sets', () => {
    expect(Object.keys(GOLDENS)).toHaveLength(19);
    const fresh = current();
    if (process.env.WRITE_TELEGRAPH_KEYS)
      writeFileSync(PATH, JSON.stringify(fresh, null, 1) + '\n');
    const kept = JSON.parse(readFileSync(PATH, 'utf8')) as Kept;
    expect(fresh).toEqual(kept);
    // Telegraphs really were read, and nothing of Seren's or Oro's rides on one.
    expect(fresh.keys).toContain('attackId');
    for (const k of ['parried', 'parryable', 'duel', 'grove', 'summon', 'melee'])
      expect(fresh.keys, k).not.toContain(k);
  }, 600_000);
});
