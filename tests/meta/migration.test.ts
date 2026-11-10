/** Older saves and settings are migrated, never thrown away (docs/plan/05 §8). */
import { describe, expect, it } from 'vitest';
import { DEFAULT_HUD, DEFAULT_SETTINGS, migrateSettings } from '../../src/app/settings';
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
  for (const k of [
    'aether',
    'relics',
    'boons',
    'shop',
    'forge',
    'event',
    'relicOffer',
    'calling',
    'callingOffer',
  ])
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
  it('loads a Phase 3b save: no Calling yet', () => {
    const run = oneFight();
    const json = JSON.parse(JSON.stringify(run)) as Record<string, unknown>;
    delete json.calling;
    delete json.callingOffer;
    // Phase 3b results had no Calling stats.
    for (const r of json.results as { stats: Record<string, unknown> }[]) {
      delete r.stats.callingAmplified;
      delete r.stats.callingShielded;
    }
    const store = memoryStore();
    store.data.set('aetherweaver.run', JSON.stringify({ ...json, version: 4 }));
    const loaded = loadRun(store)!;
    expect(loaded).toMatchObject({ version: 5, calling: null, callingOffer: null });
    expect(loaded.aether).toBe(run.aether);
    expect(loaded.results[0]!.stats).toMatchObject({ callingAmplified: 0, callingShielded: 0 });
  });

  it('loads a Phase 3 save: the run gains an empty purse, no relics and no boons', () => {
    const run = oneFight();
    const store = memoryStore();
    store.data.set('aetherweaver.run', JSON.stringify(asV3(run)));
    const loaded = loadRun(store)!;
    expect(loaded).not.toBeNull();
    expect(loaded).toMatchObject({
      version: 5,
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
    expect(loaded.version).toBe(5);
    expect(loaded.chords).toEqual([{ auras: ['sostenuto', 'fortissimo'], ornaments: [] }]);
    expect(loaded.motifs).toEqual([{ id: 'canon', level: 2 }]);
    expect(loaded.results[0]!.stats).toMatchObject({ calls: 0, responses: 0, holds: 0 });
    expect(loaded.results[0]!.stats).toMatchObject({ auraHealing: 0, threadAmplified: 0 });
    expect(loaded.results[0]!.withoutYou).toBeNull();
    expect(loaded.xp).toBe(0);
    // Saving writes the current version.
    saveRun(store, loaded);
    expect(JSON.parse(store.data.get('aetherweaver.run')!).version).toBe(5);
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

  it('saves from before Movements (Phase 3b on) load as Preludes whose Cantor is final', () => {
    for (const version of [4, 5]) {
      const json = JSON.parse(JSON.stringify(oneFight())) as Record<string, unknown>;
      delete json.movements;
      for (const row of (json.map as { rows: Record<string, unknown>[][] }).rows)
        for (const node of row) delete node.movement;
      for (const r of json.results as Record<string, unknown>[]) delete r.movement;
      delete (json.lastResult as Record<string, unknown>).movement;
      const store = memoryStore();
      store.data.set('aetherweaver.run', JSON.stringify({ ...json, version }));
      const loaded = loadRun(store)!;
      expect(loaded.movements, `v${version}`).toBe(1);
      expect(loaded.map.rows.flat().every((n) => n.movement === 1)).toBe(true);
      expect(loaded.results.every((r) => r.movement === 1 && r.wonRun === undefined)).toBe(true);
      expect(loaded.map.rows.flat().filter((n) => Run.isFinalNode(n))).toHaveLength(1);
      expect(Run.isFinalNode(loaded.map.rows.at(-1)![0]!)).toBe(true);
    }
  });

  it('an Expedition saved mid-run keeps its route and its two Movements', () => {
    const run = Run.embark(Run.newRun(32, undefined, [], [], [], [], undefined, 2));
    const store = memoryStore();
    saveRun(store, run);
    const loaded = loadRun(store)!;
    expect(loaded.movements).toBe(2);
    expect(loaded.map).toEqual(run.map);
  });

  it('leaves current and unknown shapes alone', () => {
    const run = Run.newRun(4);
    expect(migrateRunJson(run)).toBe(run);
    expect(migrateRunJson({ version: 99 })).toEqual({ version: 99 });
  });
});

describe('profile', () => {
  it('a v8 profile becomes v9 with its route and the Movement I enemies seen', () => {
    const { runMode: _m, seen: _s, ...v8 } = { ...newProfile(), version: 8, xp: 120, runs: 2 };
    const store = memoryStore();
    store.data.set('aetherweaver.profile', JSON.stringify(v8));
    expect(loadProfile(store)).toEqual({ ...newProfile(), xp: 120, runs: 2 });
    // The roster's keys stay absent (docs/phase-5b.md).
    expect(Object.keys(loadProfile(store)).sort()).toEqual(Object.keys(newProfile()).sort());
    // A route this build doesn't know falls back to the Expedition.
    store.data.set('aetherweaver.profile', JSON.stringify({ ...newProfile(), runMode: 'odd' }));
    expect(loadProfile(store).runMode).toBe('expedition');
  });

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

  it('a v9 profile without the roster keys loads without them (docs/phase-5b.md)', () => {
    const store = memoryStore();
    store.data.set('aetherweaver.profile', JSON.stringify({ ...newProfile(), xp: 40 }));
    const loaded = loadProfile(store);
    expect(loaded).toEqual({ ...newProfile(), xp: 40 });
    expect('recruited' in loaded).toBe(false);
    expect('lastParty' in loaded).toBe(false);
    expect('recruited' in newProfile()).toBe(false);
    expect('lastParty' in newProfile()).toBe(false);
    // Empty ones go, so they stay absent.
    store.data.set(
      'aetherweaver.profile',
      JSON.stringify({ ...newProfile(), recruited: [], lastParty: [] }),
    );
    expect(loadProfile(store)).toEqual(newProfile());
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

describe('Phase 6: profile 10 and run save 5 (docs/phase-6.md, ground rule 9)', () => {
  /** A v9 profile as Phase 5 wrote it: a veteran's, with a Finale won at Dissonance. */
  function v9(): Record<string, unknown> {
    const p = {
      ...newProfile(),
      version: 9,
      xp: 19850,
      runs: 40,
      wins: 22,
      deeds: ['through_the_prelude', 'song_goes_on'],
      dissonance: { open: true, levels: [{ id: 'hardened', rank: 2 }], best: { none: 12 } },
      recruited: ['brann'],
    };
    return JSON.parse(JSON.stringify(p)) as Record<string, unknown>;
  }

  it('a v9 profile loads as it was, version 10, with no Phase 6 key; it plays the same', () => {
    const store = memoryStore();
    store.data.set('aetherweaver.profile', JSON.stringify(v9()));
    const loaded = loadProfile(store);
    expect(loaded).toStrictEqual({ ...v9(), version: 10 });
    expect('atlas' in loaded || 'weekly' in loaded || 'finale' in loaded.dissonance).toBe(false);
    // Every v1 to v8 profile reaches 10 the same way.
    for (let version = 1; version <= 8; version++) {
      store.data.set(
        'aetherweaver.profile',
        JSON.stringify({ version, xp: 10, introduced: [], lastChords: [], runs: 0, wins: 0 }),
      );
      const old = loadProfile(store);
      expect(old.version, String(version)).toBe(10);
      expect('atlas' in old || 'weekly' in old || 'finale' in old.dissonance).toBe(false);
    }
    // A run started from it is the run Phase 5 started: no Phase 6 key, the same map and fight.
    const run = Run.embark(
      Run.newRun(31, undefined, [], [], loaded.dissonance.levels, [], undefined, 4),
    );
    expect('echo' in run || 'weekly' in run || 'logId' in run).toBe(false);
    expect(run.dissonance.every((l) => !('forced' in l))).toBe(true);
    const plain = Run.embark(
      Run.newRun(31, undefined, [], [], [{ id: 'hardened', rank: 2 }], [], undefined, 4),
    );
    expect(JSON.stringify(run)).toBe(JSON.stringify(plain));
  });

  it('the v10 keys round-trip once written: the Atlas, the weekly record, the Finale record', () => {
    const store = memoryStore();
    const profile = {
      ...newProfile(),
      atlas: { stars: { retrograde: 2, a_cappella: 3 }, best: { retrograde: 14, a_cappella: 22 } },
      weekly: [
        {
          week: 44,
          entries: [
            { code: 'AW1-0000', mine: true as const, status: 'verified' as const, replay: 'r1' },
            { code: 'AW1-1111', name: 'Mara', status: 'claimed' as const },
          ],
        },
      ],
      dissonance: { open: true, levels: [], best: { martyr: 20 }, finale: { martyr: 18, none: 4 } },
    };
    saveProfile(store, profile);
    expect(loadProfile(store)).toStrictEqual(profile);
  });

  it('a v5 run save loads as it was and plays the same next fight', () => {
    const run = Run.chooseNode(Run.embark(Run.newRun(12)), 'r0c0');
    const store = memoryStore();
    saveRun(store, run);
    const loaded = loadRun(store)!;
    expect(loaded).toStrictEqual(run);
    expect(JSON.stringify(Run.combatConfig(loaded))).toBe(JSON.stringify(Run.combatConfig(run)));
    expect('movement' in Run.combatConfig(loaded)!).toBe(false);
  });

  it('a run save with the Phase 6 keys round-trips: an Echo’s, its forced levels, a weekly’s', () => {
    const store = memoryStore();
    const echo = Run.chooseNode(
      Run.embark(
        Run.newEchoRun(5, 'the_unrested', undefined, [], [], [{ id: 'brisk_foes', rank: 1 }]),
      ),
      'r0c0',
    );
    saveRun(store, { ...echo, logId: 'log-7' });
    const loaded = loadRun(store)!;
    expect(loaded).toStrictEqual({ ...echo, logId: 'log-7' });
    expect(loaded.dissonance).toStrictEqual([
      { id: 'brisk_foes', rank: 1 },
      { id: 'restless_dead', rank: 1, forced: true },
      { id: 'unforgiving', rank: 1, forced: true },
    ]);
    // The resumed fight is the same fight, with its leg's settings.
    expect(Run.combatConfig(loaded)).toStrictEqual(Run.combatConfig(echo));
    const weekly = Run.newWeeklyRun({
      week: 47,
      seed: 3,
      entry: {
        route: 'expedition',
        calling: null,
        party: ['kael', 'lyra', 'vexis'],
        dissonance: [],
      },
    });
    saveRun(store, weekly);
    expect(loadRun(store)).toStrictEqual(weekly);
    // An Echo the content no longer has still loads, and plays its saved map.
    saveRun(store, { ...echo, echo: 'gone_echo' });
    const orphan = loadRun(store)!;
    expect(orphan.echo).toBe('gone_echo');
    expect(orphan.map).toStrictEqual(echo.map);
  });
});

describe('settings migration', () => {
  it('moves Phase 1 and Phase 2 settings to v4, keeping the player’s choices', () => {
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
      version: 4,
      unlockAll: false,
      hud: DEFAULT_HUD,
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

  it('moves Phase 4 settings (v3) to v4: the HUD gets its defaults, the rest is kept', () => {
    const { hud: _h, ...rest } = DEFAULT_SETTINGS;
    void _h;
    const v3 = { ...rest, version: 3, uiScale: 1.25, colorVision: 'tritanopia', unlockAll: true };
    expect(migrateSettings(v3)).toEqual({
      ...DEFAULT_SETTINGS,
      uiScale: 1.25,
      colorVision: 'tritanopia',
      unlockAll: true,
    });
    // The HUD's defaults: the frames and the Weaver bar where they always were, bars over the
    // heroes always, missing health on the frames, the low-health sound on.
    expect(DEFAULT_HUD).toEqual({
      frames: { at: null, scale: 1, orientation: 'vertical' },
      weaverBar: { at: null, scale: 1 },
      allyBars: 'always',
      healthText: 'missing',
      lowHealthSound: true,
    });
    // A moved, resized, side-by-side layout round-trips.
    const moved = {
      ...DEFAULT_SETTINGS,
      hud: {
        ...DEFAULT_HUD,
        frames: { at: { x: 0.5, y: 0.8, corner: 'bl' }, scale: 1.25, orientation: 'horizontal' },
      },
    };
    expect(migrateSettings(moved)).toEqual(moved);
    // Out of range: not a v4 layout, and not any older version either.
    expect(
      migrateSettings({
        ...moved,
        hud: { ...moved.hud, frames: { ...moved.hud.frames, scale: 3 } },
      }),
    ).toBeNull();
    expect(
      migrateSettings({ ...moved, hud: { ...moved.hud, weaverBar: { at: null, scale: 1.5 } } }),
    ).toBeNull();
  });

  it('v4 settings saved before the Weaver bar moved get its default place and size', () => {
    const { weaverBar: _w, ...hud } = DEFAULT_HUD;
    void _w;
    const before = { ...DEFAULT_SETTINGS, hud: { ...hud, allyBars: 'hurt' } };
    expect(migrateSettings(before)).toEqual({
      ...DEFAULT_SETTINGS,
      hud: { ...DEFAULT_HUD, allyBars: 'hurt', weaverBar: { at: null, scale: 1 } },
    });
    const moved = {
      ...DEFAULT_SETTINGS,
      hud: { ...DEFAULT_HUD, weaverBar: { at: { x: 0.5, y: 0.03, corner: 'tc' }, scale: 0.85 } },
    };
    expect(migrateSettings(moved)).toEqual(moved);
  });
});
