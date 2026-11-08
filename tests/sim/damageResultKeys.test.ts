/**
 * The DamageResult key sets, pinned before Phase 5e (docs/phase-5e.md, W0a "Characterisation
 * first"; contracts item 3: `DamageResult.parried?: number`, set only by Seren's parry). Every
 * `dealDamage` result the sim's systems receive over the 19 goldens is read, and the distinct
 * `Object.keys` lists are recorded, so `parried` is proved never present for an existing party,
 * and a stray key would show up here before it moved a hash.
 *
 * The probe wraps `dealDamage` as the other sim modules import it (the share calls health.ts
 * makes to itself, Oathkeeper's and Aegis Link's, return into dealDamage, not to a caller, so
 * they're not seen; their outer result is). It only reads, and each golden's hash is checked.
 *
 * Regenerate ONLY when damage results are meant to change:
 *   WRITE_DAMAGE_RESULT_KEYS=1 npx vitest run tests/sim/damageResultKeys.test.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { createSim } from '../../src/sim';
import type * as Health from '../../src/sim/combat/health';
import { SCENARIOS } from '../../tools/scenarios';
import golden from './golden.json';

const probe = vi.hoisted(() => ({ lists: new Map<string, number>(), calls: 0 }));

vi.mock('../../src/sim/combat/health', async (importOriginal) => {
  const real = await importOriginal<typeof Health>();
  return {
    ...real,
    dealDamage: (...args: Parameters<typeof real.dealDamage>) => {
      const result = real.dealDamage(...args);
      const key = Object.keys(result).join(',');
      probe.lists.set(key, (probe.lists.get(key) ?? 0) + 1);
      probe.calls++;
      return result;
    },
  };
});

const PATH = fileURLToPath(new URL('./damageResultKeys.json', import.meta.url));
const GOLDENS = golden.scenarios as Record<string, string>;

interface Kept {
  /** Each golden's distinct key lists, sorted, with how many results carried each. */
  byScenario: Record<string, Record<string, number>>;
  /** Every key any result carried, sorted. */
  keys: string[];
}

/** Plays a golden exactly as tools/runScenario.ts does. */
function play(name: string): string {
  const scenario = SCENARIOS.find((s) => s.name === name)!;
  const sim = createSim({ seed: scenario.seed, debug: true, ...scenario.config });
  const drive = scenario.driver();
  for (let tick = 0; tick < scenario.ticks; tick++) {
    sim.step(drive(tick, sim.state));
    sim.drainEvents();
  }
  return sim.hash();
}

function current(): Kept {
  const byScenario: Record<string, Record<string, number>> = {};
  const keys = new Set<string>();
  for (const name of Object.keys(GOLDENS)) {
    probe.lists.clear();
    expect(play(name), name).toBe(GOLDENS[name]);
    byScenario[name] = Object.fromEntries([...probe.lists].sort(([a], [b]) => (a < b ? -1 : 1)));
    for (const list of probe.lists.keys()) for (const k of list.split(',')) if (k) keys.add(k);
  }
  return { byScenario, keys: [...keys].sort() };
}

describe('DamageResult keys are unchanged over the 19 goldens (docs/phase-5e.md, W0a)', () => {
  it('equal the committed key sets, and `parried` is never present', () => {
    expect(Object.keys(GOLDENS)).toHaveLength(19);
    const fresh = current();
    if (process.env.WRITE_DAMAGE_RESULT_KEYS)
      writeFileSync(PATH, JSON.stringify(fresh, null, 1) + '\n');
    const kept = JSON.parse(readFileSync(PATH, 'utf8')) as Kept;
    expect(fresh).toEqual(kept);
    // The probe really saw the hits.
    expect(probe.calls).toBeGreaterThan(1000);
    expect(fresh.keys).toContain('dealt');
    expect(fresh.keys).not.toContain('parried');
  }, 600_000);
});
