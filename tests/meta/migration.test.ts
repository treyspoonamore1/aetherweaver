/** Older saves and settings are migrated, never thrown away (docs/plan/05 §8). */
import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, migrateSettings } from '../../src/app/settings';
import * as Run from '../../src/meta/run';
import { loadRun, migrateRunJson, saveRun, type KeyValueStore } from '../../src/meta/save';
import { emptyLedger } from '../../src/sim/world';

function memoryStore(): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

/** A v2 run turned back into what Phase 1 (save v1) would have written. */
function asV1(run: ReturnType<typeof Run.newRun>): unknown {
  const json = JSON.parse(JSON.stringify(run)) as Record<string, unknown>;
  const { chords, ...rest } = json as { chords: { auras: string[] }[] };
  const strip = (r: Record<string, unknown>) => {
    const { withoutYou: _w, ...res } = r;
    void _w;
    const { calls: _c, responses: _r, holds: _h, ...stats } = res.stats as Record<string, unknown>;
    void _c;
    void _r;
    void _h;
    return { ...res, stats };
  };
  return {
    ...rest,
    version: 1,
    auras: chords[0]?.auras ?? [],
    motifs: [{ id: 'call_and_response', level: 2 }],
    results: (json.results as Record<string, unknown>[]).map(strip),
    lastResult: json.lastResult ? strip(json.lastResult as Record<string, unknown>) : null,
  };
}

describe('save migration', () => {
  it('loads a Phase 1 save: auras become Chord I, renamed motifs follow, stats gain new fields', () => {
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
    const store = memoryStore();
    store.data.set('aetherweaver.run', JSON.stringify(asV1(run)));
    const loaded = loadRun(store)!;
    expect(loaded).not.toBeNull();
    expect(loaded.version).toBe(2);
    expect(loaded.chords).toEqual([{ auras: ['sostenuto', 'fortissimo'], ornaments: [] }]);
    expect(loaded.motifs).toEqual([{ id: 'canon', level: 2 }]);
    expect(loaded.results[0]!.stats).toMatchObject({ calls: 0, responses: 0, holds: 0 });
    expect(loaded.results[0]!.withoutYou).toBeNull();
    // Saving writes the current version.
    saveRun(store, loaded);
    expect(JSON.parse(store.data.get('aetherweaver.run')!).version).toBe(2);
  });

  it('leaves current and unknown shapes alone', () => {
    const run = Run.newRun(4);
    expect(migrateRunJson(run)).toBe(run);
    expect(migrateRunJson({ version: 99 })).toEqual({ version: 99 });
  });
});

describe('settings migration', () => {
  it('moves Phase 1 settings to v2, keeping the player’s choices', () => {
    const v1 = {
      version: 1,
      volumes: { master: 0.5, music: 0.2, sfx: 0.9, ui: 0.4 },
      screenShake: 0.3,
      flashes: false,
      damageNumbers: false,
      hints: true,
      assists: { perfectWindowBonus: 0.2, telegraphLead: 1.5, autonomy: true },
    };
    const v2 = migrateSettings(v1)!;
    expect(v2).toMatchObject({
      version: 2,
      volumes: v1.volumes,
      screenShake: 0.3,
      flashes: 0,
      damageNumbers: false,
      uiScale: 1,
      colorVision: 'normal',
      bindings: {},
      assists: v1.assists,
    });
    expect(migrateSettings({ ...v1, flashes: true })!.flashes).toBe(1);
    expect(migrateSettings(DEFAULT_SETTINGS)).toEqual(DEFAULT_SETTINGS);
    expect(migrateSettings({ version: 7 })).toBeNull();
  });
});
