/**
 * Phase 5b (docs/phase-5b.md, "Recaps for Brann's downs"): the sim's `DeathRecord.blood` is
 * carried into the run's `DeathRecap.blood` and survives a save and resume (zod would strip an
 * unknown key). A death without it stays exactly as before.
 */
import { describe, expect, it } from 'vitest';
import * as Run from '../../src/meta/run';
import { loadRun, saveRun, type KeyValueStore } from '../../src/meta/save';
import type { DeathRecord } from '../../src/sim/state';
import { emptyLedger } from '../../src/sim/world';

function memoryStore(): KeyValueStore {
  const data = new Map<string, string>();
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

const death = (heroDefId: string, extra: Partial<DeathRecord> = {}): DeathRecord => ({
  time: 12,
  hero: 1,
  heroDefId,
  killer: 'Twin Cleave',
  recap: [{ time: 11.5, amount: 300, source: 'Twin Cleave' }],
  readyTechniques: ['reel'],
  ...extra,
});

describe("Brann's down records reach the recap (docs/phase-5b.md)", () => {
  it('copies blood only when present, and a saved run keeps it', () => {
    let run = Run.embark(Run.newRun(9));
    run = Run.chooseNode(run, run.map.rows[0]![0]!.id);
    const ledger = emptyLedger();
    ledger.deaths.push(
      death('brann', { blood: { refusedRally: true, healCut: 0.25, bloodmoon: true } }),
      death('kael'),
    );
    const after = Run.finishCombat(run, {
      encounterId: 'first_light',
      outcome: 'defeat',
      duration: 40,
      ledger,
      party: [],
      withoutYou: null,
    });
    const deaths = after.lastResult!.deaths;
    expect(deaths[0]!.blood).toEqual({ refusedRally: true, healCut: 0.25, bloodmoon: true });
    expect('blood' in deaths[1]!).toBe(false);
    // The recap's blood is a copy, not the ledger's object.
    expect(deaths[0]!.blood).not.toBe(ledger.deaths[0]!.blood);

    const store = memoryStore();
    saveRun(store, after);
    const loaded = loadRun(store)!;
    expect(loaded).not.toBeNull();
    expect(loaded.lastResult!.deaths[0]!.blood).toEqual({
      refusedRally: true,
      healCut: 0.25,
      bloodmoon: true,
    });
    expect('blood' in loaded.lastResult!.deaths[1]!).toBe(false);
    const saved = loaded.results.at(-1)!.deaths;
    expect(saved[0]!.blood).toEqual({ refusedRally: true, healCut: 0.25, bloodmoon: true });
  });
});
