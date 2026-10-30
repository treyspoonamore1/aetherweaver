/**
 * The Reliquary in runs and the stores (docs/phase-4c.md): Prep carries the chosen relics within
 * the slots and follows the profile until it embarks; a fight gets their passives; a run's end
 * pays once; a won run enshrines one relic it found; saves migrate and fit the content.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { useProfile } from '../src/app/profileStore';
import { useRun } from '../src/app/runStore';
import { useSettings } from '../src/app/settings';
import { PROFILE_VERSION, RANK_XP, newProfile } from '../src/meta/profile';
import { relicPassives, runMaterials, type ReliquaryRelic } from '../src/meta/reliquary';
import * as Run from '../src/meta/run';
import { CONTENT } from '../src/content';
import { loadProfile, loadRun, type KeyValueStore } from '../src/meta/save';
import type { EncounterResult, OwnedRelic } from '../src/meta/types';
import { emptyLedger } from '../src/sim/world';

function memoryStore(): KeyValueStore {
  const data = new Map<string, string>();
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

const skipUnlocks = (on: boolean) =>
  useSettings.getState().update((s) => ({ ...s, unlockAll: on }));
const run = () => useRun.getState().run!;
const reliquary = () => useProfile.getState().profile.reliquary;

function relic(uid: string, id: string, over: Partial<ReliquaryRelic> = {}): ReliquaryRelic {
  return {
    uid,
    id,
    cleansed: false,
    inscriptions: [],
    instability: 0,
    fractured: false,
    dissonance: null,
    ...over,
  };
}

/** Puts relics straight into the profile's Reliquary, with materials to craft. */
function stock(relics: ReliquaryRelic[], carry: string[] = []): void {
  const p = useProfile.getState().profile;
  useProfile.setState({
    profile: {
      ...p,
      reliquary: { ...p.reliquary, relics, carry, next: relics.length + 1, shards: 100, tears: 2 },
    },
  });
}

const STOCK = [
  relic('r1', 'cantors_hymnal', { inscriptions: [{ id: 'potent_thread', tier: 4, value: 5 }] }),
  relic('r2', 'prism_loom'),
  relic('r3', 'tuning_fork'),
  relic('r4', 'cantors_hymnal'),
];

/** Ends the run in place: its fights in, the last its boss (won with this grade, or lost). */
function endRun(won: boolean, found: OwnedRelic[] = [], grade = 'S'): void {
  const fights = [
    { kind: 'skirmish', outcome: 'victory', grade: 'B' },
    { kind: 'elite', outcome: 'victory', grade: 'A' },
    { kind: 'boss', outcome: won ? 'victory' : 'defeat', grade },
  ] as EncounterResult[];
  const r = run();
  useRun.setState({
    run: {
      ...r,
      phase: 'result',
      pending: null,
      outcome: won ? null : 'defeat',
      relics: [...r.relics, ...found],
      results: fights,
    },
  });
  useRun.getState().continueFromResult();
}

beforeEach(() => {
  useSettings.getState().reset();
  useProfile.getState().resetProgress();
  // No run in play, and none saved: a saved one would be a run a new one replaces.
  useRun.getState().closeRun();
});

describe('the carry', () => {
  it('opens at Rank 10 with a slot; Prep carries the chosen relics, within the slots', () => {
    useProfile.getState().award(RANK_XP[8]!); // Rank 9
    expect(useProfile.getState().reliquaryOpen()).toBe(false);
    stock(STOCK, ['r1']);
    useRun.getState().newRun(41);
    expect(run().carried).toEqual([]);
    // Rank 10: one slot, and Prep follows.
    useProfile.getState().award(RANK_XP[9]! - RANK_XP[8]!);
    expect(useProfile.getState().carrySlots()).toBe(1);
    expect(run().carried.map((r) => r.uid)).toEqual(['r1']);
    expect(run().relics).toEqual([
      { id: 'cantors_hymnal', cleansed: false, carried: true, empowered: false },
    ]);
    // Never past the slots, never the same relic twice.
    useProfile.getState().setCarry(['r2', 'r1']);
    expect(reliquary().carry).toEqual(['r2']);
    skipUnlocks(true);
    useProfile.getState().setCarry(['r1', 'r4', 'r2', 'r3']);
    expect(reliquary().carry).toEqual(['r1', 'r2', 'r3']);
    expect(run().carried.map((r) => r.uid)).toEqual(['r1', 'r2', 'r3']);
    // Turning "Skip the unlocks" off takes the slots back; the profile keeps its choice.
    skipUnlocks(false);
    expect(run().carried.map((r) => r.uid)).toEqual(['r1']);
    expect(reliquary().carry).toEqual(['r1', 'r2', 'r3']);
  });

  it('Prep follows crafting; embarking freezes what the run carries; fights get its passives', () => {
    skipUnlocks(true);
    stock(STOCK, ['r1']);
    useRun.getState().newRun(42);
    expect(useProfile.getState().craft('r1', 'inscribe', 'aegis').ok).toBe(true);
    expect(run().carried[0]!.inscriptions).toHaveLength(2);
    useRun.getState().embark();
    expect(useProfile.getState().craft('r1', 'inscribe', 'bond').ok).toBe(true);
    expect(reliquary().relics[0]!.inscriptions).toHaveLength(3);
    expect(run().carried[0]!.inscriptions).toHaveLength(2);
    useRun.getState().chooseNode(Run.reachable(run())[0]!.id);
    const config = useRun.getState().combatConfig()!;
    expect(config.relics).toEqual([{ id: 'cantors_hymnal', cleansed: false, empowered: false }]);
    expect(config.passives).toEqual(relicPassives(run().carried[0]!));
    // The run's offers never give back what it carries.
    expect(Run.hasRelic(run(), 'cantors_hymnal')).toBe(true);
  });

  it('only the first is attuned: the others lend their affixes and sleep', () => {
    const carried = [
      relic('r1', 'prism_loom', { inscriptions: [{ id: 'hardy', tier: 4, value: 2 }] }),
      relic('r2', 'heavy_score', { inscriptions: [{ id: 'fierce', tier: 4, value: 2 }] }),
      relic('r3', 'cantors_hymnal', { dissonance: { kind: 'empowered' } }),
    ];
    let r = Run.embark(Run.newRun(50, undefined, [], carried));
    expect(r.relics).toEqual([
      { id: 'prism_loom', cleansed: false, carried: true, empowered: false },
      { id: 'heavy_score', cleansed: false, carried: true, dormant: true },
      { id: 'cantors_hymnal', cleansed: false, carried: true, dormant: true },
    ]);
    r = Run.chooseNode(r, Run.reachable(r)[0]!.id);
    const config = Run.combatConfig(r)!;
    // Only the attuned relic's own effect reaches the fight; every relic's affixes do.
    expect(config.relics).toEqual([{ id: 'prism_loom', cleansed: false, empowered: false }]);
    expect(config.passives).toEqual(carried.flatMap(relicPassives));
    // The run still holds them: offers won't give them again, and a dormant curse is no
    // Forge's to lift.
    expect(Run.hasRelic(r, 'heavy_score')).toBe(true);
    expect(Run.forgeTargets(r, 'cleanse')).toEqual([]);
  });

  it('a dormant Star Chart gives no fourth choice; an attuned one does', () => {
    const draftOf = (carried: ReliquaryRelic[]) => {
      const r = Run.embark(Run.newRun(51, undefined, [], carried));
      return Run.respite({ ...r, phase: 'respite' }, 'meditate').draft!.options.length;
    };
    const chart = relic('r2', 'star_chart');
    expect(draftOf([relic('r1', 'prism_loom')])).toBe(3);
    expect(draftOf([relic('r1', 'prism_loom'), chart])).toBe(3);
    expect(draftOf([chart, relic('r1', 'prism_loom')])).toBe(4);
  });

  it('a lighter reserve from a carried relic counts for the songs Prep allows', () => {
    const light = relic('r1', 'tuning_fork', {
      inscriptions: [{ id: 'light_reserve', tier: 1, value: 10 }],
    });
    const base = Run.newRun(1);
    expect(Run.reserveMult(Run.newRun(1, undefined, [], [light]))).toBeCloseTo(
      Run.reserveMult(base) * 0.9,
      9,
    );
  });
});

describe('a run’s end', () => {
  it('pays its materials once, when the Reliquary is open', () => {
    useProfile.getState().award(RANK_XP[8]!); // Rank 9: closed
    useRun.getState().newRun(43);
    useRun.getState().embark();
    endRun(true);
    expect(run().reliquary).toBeNull();
    expect(reliquary().shards).toBe(0);
    useProfile.getState().award(RANK_XP[9]! - RANK_XP[8]!); // Rank 10
    useRun.getState().newRun(44);
    useRun.getState().embark();
    endRun(true);
    const paid = runMaterials(run());
    expect(paid.tears).toBe(1);
    expect(run().reliquary).toEqual({ ...paid, enshrined: null });
    expect(reliquary()).toMatchObject({ shards: paid.shards, tears: 1 });
    // Again: nothing more.
    useRun.getState().continueFromResult();
    useRun.getState().abandon();
    expect(reliquary()).toMatchObject({ shards: paid.shards, tears: 1 });
  });

  it('a saved run a new one replaces after a restart pays too', () => {
    skipUnlocks(true);
    useRun.getState().newRun(52);
    useRun.getState().embark();
    useRun.getState().chooseNode(Run.reachable(run())[0]!.id);
    useRun.getState().finishCombat({
      encounterId: run()
        .map.rows.flat()
        .find((n) => n.id === run().pending)!.encounterId!,
      outcome: 'victory',
      duration: 40,
      ledger: emptyLedger(),
      party: [],
      withoutYou: null,
    });
    // The game closed mid-run: only storage holds it.
    const saved = run();
    expect(runMaterials(saved).shards).toBeGreaterThan(0);
    useRun.setState({ run: null });
    const runs = useProfile.getState().profile.runs;
    useRun.getState().newRun(53);
    expect(reliquary().shards).toBe(runMaterials(saved).shards);
    expect(useProfile.getState().profile.runs).toBe(runs + 1);
  });

  it('an abandoned run pays for the fights it won; so does one a new run replaces', () => {
    skipUnlocks(true);
    useRun.getState().newRun(45);
    useRun.getState().embark();
    const won = [{ kind: 'elite', outcome: 'victory', grade: 'A' }] as EncounterResult[];
    useRun.setState({ run: { ...run(), results: won } });
    useRun.getState().abandon();
    const once = runMaterials(run()).shards;
    expect(once).toBeGreaterThan(0);
    expect(reliquary().shards).toBe(once);
    useRun.getState().newRun(46);
    useRun.getState().embark();
    useRun.setState({ run: { ...run(), results: won } });
    useRun.getState().newRun(47);
    expect(reliquary().shards).toBe(once * 2);
  });
});

describe('enshrining', () => {
  const found: OwnedRelic[] = [
    { id: 'prism_loom', cleansed: false },
    { id: 'heavy_score', cleansed: true },
  ];

  it('a won run keeps one relic it found (not one it carried), once', () => {
    skipUnlocks(true);
    stock([relic('r1', 'cantors_hymnal')], ['r1']);
    useRun.getState().newRun(48);
    useRun.getState().embark();
    endRun(true, found);
    expect(Run.enshrineOptions(run()).map((r) => r.id)).toEqual(['prism_loom', 'heavy_score']);
    expect(useRun.getState().enshrine('cantors_hymnal').ok).toBe(false);
    const result = useRun.getState().enshrine('heavy_score');
    if (!result.ok) throw new Error(result.reason);
    expect(result.relic).toMatchObject({ uid: 'r2', id: 'heavy_score', cleansed: true });
    expect(reliquary().relics.map((r) => r.uid)).toEqual(['r1', 'r2']);
    expect(run().reliquary?.enshrined).toBe('heavy_score');
    expect(useRun.getState().enshrine('prism_loom').ok).toBe(false);
  });

  it('a lost run keeps none', () => {
    skipUnlocks(true);
    useRun.getState().newRun(49);
    useRun.getState().embark();
    endRun(false, found);
    expect(Run.enshrineOptions(run())).toEqual([]);
    expect(useRun.getState().enshrine('prism_loom').ok).toBe(false);
    expect(reliquary().relics).toEqual([]);
  });
});

describe('saves', () => {
  it('a v3 profile migrates with an empty Reliquary', () => {
    const { reliquary: _r, ...v3 } = { ...newProfile(), version: 3, xp: RANK_XP[11]! };
    const store = memoryStore();
    store.setItem('aetherweaver.profile', JSON.stringify(v3));
    const loaded = loadProfile(store);
    expect(loaded.version).toBe(PROFILE_VERSION);
    expect(loaded.xp).toBe(RANK_XP[11]);
    expect(loaded.reliquary).toMatchObject({ relics: [], shards: 0, tears: 0, carry: [] });
  });

  it('one relic that doesn’t parse is left behind, not the profile; a later kind freezes', () => {
    const profile = { ...newProfile(), xp: RANK_XP[12]! };
    const json = JSON.parse(JSON.stringify(profile));
    json.reliquary.relics = [
      relic('r1', 'prism_loom', { dissonance: { kind: 'mirrored' as 'shattered' } }),
      { uid: 'r2', id: 'tuning_fork', inscriptions: 'garbled' },
      relic('r3', 'tuning_fork'),
    ];
    const store = memoryStore();
    store.setItem('aetherweaver.profile', JSON.stringify(json));
    const loaded = loadProfile(store);
    expect(loaded.xp).toBe(RANK_XP[12]);
    expect(loaded.reliquary.relics.map((r) => [r.uid, r.dissonance?.kind ?? null])).toEqual([
      ['r1', 'shattered'],
      ['r3', null],
    ]);
    // A Reliquary that's garbled through and through is lost alone.
    json.reliquary = { relics: 7 };
    store.setItem('aetherweaver.profile', JSON.stringify(json));
    expect(loadProfile(store).xp).toBe(RANK_XP[12]);
  });

  it('values rolled under older tiers come back inside today’s', () => {
    const profile = newProfile();
    profile.reliquary.relics = [
      relic('r1', 'prism_loom', {
        fractured: true,
        inscriptions: [{ id: 'potent_thread', tier: 3, value: 7 }],
      }),
    ];
    const store = memoryStore();
    store.setItem('aetherweaver.profile', JSON.stringify(profile));
    const ins = loadProfile(store).reliquary.relics[0]!.inscriptions[0]!;
    const def = CONTENT.inscriptions.find((d) => d.id === 'potent_thread')!;
    if (def.kind !== 'normal') throw new Error('normal');
    expect(ins.value).toBe(def.tiers[2]![1]);
  });

  it('a new or migrated Reliquary takes the seed it’s given', () => {
    const store = memoryStore();
    expect(loadProfile(store, 777).reliquary.seed).toBe(777);
    const { reliquary: _r, ...v3 } = { ...newProfile(), version: 3 };
    store.setItem('aetherweaver.profile', JSON.stringify(v3));
    expect(loadProfile(store, 4242).reliquary.seed).toBe(4242);
  });

  it('a run saved before attunement plays as this build does, keeping a Forge’s cleanse', () => {
    const carried = [relic('r1', 'heavy_score'), relic('r2', 'prism_loom')];
    const r = Run.embark(Run.newRun(54, undefined, [], carried));
    const json = JSON.parse(JSON.stringify(r));
    // As an older build saved it: every carried relic playing, the first cleansed at a Forge.
    json.relics = [
      { id: 'heavy_score', cleansed: true, carried: true, empowered: false },
      { id: 'prism_loom', cleansed: false, carried: true, empowered: false },
      { id: 'tuning_fork', cleansed: false },
    ];
    const store = memoryStore();
    store.setItem('aetherweaver.run', JSON.stringify(json));
    expect(loadRun(store)!.relics).toEqual([
      { id: 'heavy_score', cleansed: true, carried: true, empowered: false },
      { id: 'prism_loom', cleansed: false, carried: true, dormant: true },
      { id: 'tuning_fork', cleansed: false },
    ]);
  });

  it('relics, Inscriptions and curses no longer in the content are left behind', () => {
    const profile = newProfile();
    profile.reliquary = {
      ...profile.reliquary,
      relics: [
        relic('r1', 'gone_relic'),
        relic('r7', 'prism_loom', {
          inscriptions: [
            { id: 'gone_inscription', tier: 3, value: 6 },
            { id: 'stout_ward', tier: 9, value: 12 },
          ],
          dissonance: { kind: 'cursed', curse: 'gone_curse' },
        }),
      ],
      carry: ['r1', 'r7', 'r9'],
      next: 2,
    };
    const store = memoryStore();
    store.setItem('aetherweaver.profile', JSON.stringify(profile));
    const rq = loadProfile(store).reliquary;
    expect(rq.relics).toHaveLength(1);
    // Its tier is T5 now, so its value comes back inside T5's range.
    const ward = CONTENT.inscriptions.find((d) => d.id === 'stout_ward')!;
    if (ward.kind !== 'normal') throw new Error('normal');
    expect(rq.relics[0]!.inscriptions).toEqual([
      { id: 'stout_ward', tier: 5, value: ward.tiers[0]![1] },
    ]);
    expect(rq.relics[0]!.dissonance).toEqual({ kind: 'cursed' });
    expect(rq.carry).toEqual(['r7']);
    // The next uid never repeats one held.
    expect(rq.next).toBe(8);
  });

  it('a run saved before the Reliquary carries nothing; a carried relic that’s gone leaves', () => {
    const store = memoryStore();
    const old = JSON.parse(JSON.stringify(Run.newRun(5)));
    delete old.carried;
    delete old.reliquary;
    store.setItem('aetherweaver.run', JSON.stringify(old));
    const loaded = loadRun(store)!;
    expect(loaded.carried).toEqual([]);
    expect(loaded.reliquary).toBeNull();
    // A carried relic with an Inscription the content no longer knows keeps the rest.
    const carrying = Run.newRun(
      6,
      undefined,
      [],
      [
        relic('r1', 'tuning_fork', {
          inscriptions: [
            { id: 'stout_ward', tier: 3, value: 11 },
            { id: 'hardy', tier: 4, value: 2 },
          ],
        }),
        relic('r2', 'prism_loom'),
      ],
    );
    const renamed = JSON.parse(JSON.stringify(carrying));
    renamed.carried[0].inscriptions[0].id = 'gone_inscription';
    store.setItem('aetherweaver.run', JSON.stringify(renamed));
    const fitted = loadRun(store)!;
    expect(fitted.carried[0]!.inscriptions).toEqual([{ id: 'hardy', tier: 4, value: 2 }]);
    // A carried relic that's gone leaves the run's relics too; the run itself stays.
    const json = JSON.parse(JSON.stringify(carrying));
    json.carried[1].id = 'gone_relic';
    json.relics[1].id = 'gone_relic';
    store.setItem('aetherweaver.run', JSON.stringify(json));
    const left = loadRun(store)!;
    expect(left.carried.map((r) => r.id)).toEqual(['tuning_fork']);
    expect(left.relics.map((r) => r.id)).toEqual(['tuning_fork']);
  });
});
