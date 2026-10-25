/** Older saves and settings are migrated, never thrown away (docs/plan/05 §8). */
import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, migrateSettings } from '../../src/app/settings';
import { newProfile } from '../../src/meta/profile';
import * as Run from '../../src/meta/run';
import {
  loadProfile,
  loadRun,
  migrateRunJson,
  saveProfile,
  saveRun,
  type KeyValueStore,
} from '../../src/meta/save';
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

const V3_STATS = [
  'auraHealing',
  'auraShielded',
  'auraAmplified',
  'threadHealing',
  'threadAmplified',
];

/** A current run turned back into what Phase 3 (save v3) would have written. */
function asV3(run: ReturnType<typeof Run.newRun>): Record<string, unknown> {
  const json = JSON.parse(JSON.stringify(run)) as Record<string, unknown>;
  for (const k of ['aether', 'relics', 'boons', 'shop', 'forge', 'event', 'relicOffer'])
    delete json[k];
  const map = json.map as { rows: Record<string, unknown>[][] };
  for (const row of map.rows) {
    for (const node of row) {
      delete node.eventId;
      const reward = node.reward as Record<string, unknown>;
      delete reward.aether;
      delete reward.relics;
      delete reward.threat;
    }
  }
  const strip = (r: Record<string, unknown>) => {
    const { aether: _a, ...res } = r;
    void _a;
    return res;
  };
  return {
    ...json,
    version: 3,
    results: (json.results as Record<string, unknown>[]).map(strip),
    lastResult: json.lastResult ? strip(json.lastResult as Record<string, unknown>) : null,
  };
}

/** A current run turned back into what Phase 2 (save v2) would have written. */
function asV2(run: ReturnType<typeof Run.newRun>): Record<string, unknown> {
  const json = asV3(run);
  const { xp: _x, ...rest } = json;
  void _x;
  const strip = (r: Record<string, unknown>) => {
    const { xp: _rx, ...res } = r;
    void _rx;
    const stats = { ...(res.stats as Record<string, unknown>) };
    for (const k of V3_STATS) delete stats[k];
    return { ...res, stats };
  };
  return {
    ...rest,
    version: 2,
    results: (json.results as Record<string, unknown>[]).map(strip),
    lastResult: json.lastResult ? strip(json.lastResult as Record<string, unknown>) : null,
  };
}

/** A current run turned back into what Phase 1 (save v1) would have written. */
function asV1(run: ReturnType<typeof Run.newRun>): unknown {
  const json = asV2(run);
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

/** A run one fight in. */
function oneFight(): ReturnType<typeof Run.newRun> {
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
  return run;
}

describe('save migration', () => {
  it('loads a Phase 3 save: the run gains an empty purse, no relics and no boons', () => {
    const run = oneFight();
    const store = memoryStore();
    store.data.set('aetherweaver.run', JSON.stringify(asV3(run)));
    const loaded = loadRun(store)!;
    expect(loaded).not.toBeNull();
    expect(loaded).toMatchObject({
      version: 4,
      aether: 0,
      relics: [],
      boons: [],
      shop: null,
      forge: null,
      event: null,
      relicOffer: null,
    });
    expect(loaded.results[0]!.aether).toBe(0);
    const first = loaded.map.rows[0]![0]!;
    expect(first.eventId).toBeNull();
    expect(first.reward).toMatchObject({ aether: 20, relics: 0, threat: 1 });
  });

  it('a Phase 3 save keeps its seven-stop map, with no Threat on its fights', () => {
    const run = oneFight();
    // The Phase 3 map: seven rows, the last a dead end.
    const rows = run.map.rows
      .slice(0, 7)
      .map((row, r) => row.map((n) => ({ ...n, next: r === 6 ? [] : n.next })));
    const store = memoryStore();
    store.data.set('aetherweaver.run', JSON.stringify(asV3({ ...run, map: { rows } })));
    const loaded = loadRun(store)!;
    expect(loaded.map.rows).toHaveLength(7);
    expect(loaded.map.rows.flat().every((n) => n.reward.threat === 1)).toBe(true);
    const fight = loaded.map.rows[3]!.find((n) => n.encounterId !== null)!;
    const at = Run.chooseNode(
      {
        ...loaded,
        phase: 'map',
        path: [loaded.map.rows[2]!.find((n) => n.next.includes(fight.id))!.id],
        pending: null,
      },
      fight.id,
    );
    expect(Run.combatConfig(at)!.threat).toBe(1);
  });

  it('loads a Phase 1 save: auras become Chord I, renamed motifs follow, stats gain new fields', () => {
    const store = memoryStore();
    store.data.set('aetherweaver.run', JSON.stringify(asV1(oneFight())));
    const loaded = loadRun(store)!;
    expect(loaded).not.toBeNull();
    expect(loaded.version).toBe(4);
    expect(loaded.chords).toEqual([{ auras: ['sostenuto', 'fortissimo'], ornaments: [] }]);
    expect(loaded.motifs).toEqual([{ id: 'canon', level: 2 }]);
    expect(loaded.results[0]!.stats).toMatchObject({ calls: 0, responses: 0, holds: 0 });
    expect(loaded.results[0]!.stats).toMatchObject({ auraHealing: 0, threadAmplified: 0 });
    expect(loaded.results[0]!.withoutYou).toBeNull();
    expect(loaded.xp).toBe(0);
    // Saving writes the current version.
    saveRun(store, loaded);
    expect(JSON.parse(store.data.get('aetherweaver.run')!).version).toBe(4);
  });

  it('loads a Phase 2 save: a Unison Chord II moves to the beam; illegal Chords fall back', () => {
    const run = oneFight();
    const v2 = asV2(run);
    const store = memoryStore();
    store.data.set(
      'aetherweaver.run',
      JSON.stringify({
        ...v2,
        chords: [
          { auras: ['sostenuto'], ornaments: [] },
          { auras: ['fortissimo'], ornaments: ['unison'] },
        ],
      }),
    );
    const loaded = loadRun(store)!;
    expect(loaded.chords).toEqual([
      { auras: ['fortissimo'], ornaments: ['unison'] },
      { auras: ['sostenuto'], ornaments: [] },
    ]);
    expect(loaded.results[0]!.xp).toBe(0);
    store.data.set(
      'aetherweaver.run',
      JSON.stringify({
        ...v2,
        chords: [{ auras: ['sostenuto', 'ostinato', 'allegro'], ornaments: [] }],
      }),
    );
    expect(loadRun(store)!.chords).toEqual([{ auras: ['sostenuto', 'fortissimo'], ornaments: [] }]);
  });

  it('leaves current and unknown shapes alone', () => {
    const run = Run.newRun(4);
    expect(migrateRunJson(run)).toBe(run);
    expect(migrateRunJson({ version: 99 })).toEqual({ version: 99 });
  });
});

describe('profile', () => {
  it('starts fresh, round-trips, and falls back to the backup', () => {
    const store = memoryStore();
    expect(loadProfile(store)).toEqual(newProfile());
    const profile = { ...newProfile(), xp: 250, runs: 3, wins: 1 };
    saveProfile(store, profile);
    expect(loadProfile(store)).toEqual(profile);
    saveProfile(store, { ...profile, xp: 300 });
    store.data.set('aetherweaver.profile', '{broken');
    expect(loadProfile(store).xp).toBe(250);
  });

  it('forgets remembered Chords this build can no longer play', () => {
    const store = memoryStore();
    store.data.set(
      'aetherweaver.profile',
      JSON.stringify({ ...newProfile(), lastChords: [{ auras: ['gone'], ornaments: [] }] }),
    );
    expect(loadProfile(store).lastChords).toEqual([]);
  });
});

describe('settings migration', () => {
  it('moves Phase 1 and Phase 2 settings to v3, keeping the player’s choices', () => {
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
      version: 3,
      unlockAll: false,
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
    const { unlockAll: _u, ...phase2 } = { ...DEFAULT_SETTINGS, version: 2, uiScale: 1.25 };
    void _u;
    expect(migrateSettings(phase2)).toEqual({ ...DEFAULT_SETTINGS, uiScale: 1.25 });
    expect(migrateSettings({ version: 7 })).toBeNull();
  });
});
