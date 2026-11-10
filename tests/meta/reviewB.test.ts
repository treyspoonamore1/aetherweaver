/**
 * Phase 6 review B's findings (the run layer, saves, Deeds, the Atlas, the weekly seed, whole-run
 * replays, share codes and verification): one regression per finding, each failing before its
 * fix. The finding's id leads each `describe`.
 */
import { gzipSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { makeBot, type BotKind } from '../../src/bots';
import { CONTENT } from '../../src/content';
import { ContentSchema } from '../../src/content/schema';
import { deedProgress, isRunWideDeed } from '../../src/meta/deeds';
import { buildOutcome } from '../../src/meta/outcome';
import { EVERYTHING, newProfile } from '../../src/meta/profile';
import * as Run from '../../src/meta/run';
import {
  ASSIST_VALUES,
  REPLAY_JSON_MAX_BYTES,
  REPLAY_FILE_MAX_BYTES,
  RunRecorder,
  allowanceRecord,
  applyStep,
  logFits,
  parseRunLog,
  runDigest,
  shareCodeOf,
  stepOfAction,
  verifyRunReplay,
  type ChoiceStep,
  type FightStep,
  type RunReplay,
} from '../../src/meta/runReplay';
import {
  FIGHT_END_DELAY_MS,
  FIGHT_TAIL_MAX_TICKS,
  WITHOUT_YOU_GRACE_MS,
  countsRunWide,
} from '../../src/meta/runEnd';
import { loadProfile, loadRun, saveRun, type KeyValueStore } from '../../src/meta/save';
import { encodeShareCode } from '../../src/meta/shareCode';
import type { CombatOutcome, RunState } from '../../src/meta/types';
import {
  WEEKLY_CYCLE,
  WEEKLY_KEEP_WEEKS,
  weekStartMs,
  weeklyEntry,
  weeklyPrep,
  weeklyStart,
  withWeeklyEntry,
} from '../../src/meta/weekly';
import { weeksWon } from '../../src/meta/deeds';
import { ReplayRecorder, SIM_HZ, createSim } from '../../src/sim';
import { emptyLedger } from '../../src/sim/world';
import { SettingsSchema } from '../../src/app/settings';
import type * as ReplayStoreModule from '../../src/app/replayStore';
import type { ReplayStore } from '../../src/app/replayStore';
import { readReplay, recordBotRun } from '../../tools/run-verify';

// The replay store the app's recorder and start-up re-verification open: one that hands each
// call to the test's own store (`fake.store`), or answers as an empty one. (The recorder opens its
// store once, so this one stands for whichever store a test sets.)
const fake = vi.hoisted(() => ({ store: null as ReplayStore | null }));
vi.mock('../../src/app/replayStore', async (importOriginal) => {
  const real = await importOriginal<typeof ReplayStoreModule>();
  const through: ReplayStore = {
    saveLog: (id, log) => fake.store?.saveLog(id, log) ?? Promise.resolve(),
    loadLog: (id) => fake.store?.loadLog(id) ?? Promise.resolve(null),
    deleteLog: (id) => fake.store?.deleteLog(id) ?? Promise.resolve(),
    keep: (id, r, at) => fake.store?.keep(id, r, at) ?? Promise.resolve(),
    kept: (id) => fake.store?.kept(id) ?? Promise.resolve(null),
    listKept: () => fake.store?.listKept() ?? Promise.resolve([]),
    forget: (id) => fake.store?.forget(id) ?? Promise.resolve(),
    close: () => {},
  };
  return { ...real, openReplayStore: () => Promise.resolve(through) };
});

const { readReplayFile } = await import('../../src/app/replayStore');
const recorder = await import('../../src/app/runRecorder');
const { verifyReplay } = await import('../../src/app/verify');
const { useProfile } = await import('../../src/app/profileStore');
const { reverifyClaimedWeeklies } = await import('../../src/app/runStore');

const SLOW = 600_000;
const DEFAULT_ASSISTS = { perfectWindowBonus: 0, telegraphLead: 1, autonomy: false };

function memoryStore(init: Record<string, string> = {}): KeyValueStore {
  const data = new Map(Object.entries(init));
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

function copy<T>(r: T): T {
  return JSON.parse(JSON.stringify(r)) as T;
}

function redigest(r: RunReplay): RunReplay {
  return { ...r, claim: { ...r.claim, digest: runDigest(r) } };
}

function canonical(value: unknown): string {
  return JSON.stringify(value, (_k, v: unknown) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(
          Object.keys(v)
            .sort()
            .map((k) => [k, (v as Record<string, unknown>)[k]]),
        )
      : v,
  );
}

interface ForgeOpts {
  bot?: BotKind;
  /** Ticks played on past each fight's end (fight 1 the first). */
  tail?: (fight: number) => number;
  assists?: typeof DEFAULT_ASSISTS;
  /** Reloads before each fight (fight 1 the first): its step counts them. */
  restarts?: (fight: number) => number;
  /** After this many steps the log is stored, read back and resumed (a reload). */
  resumeAt?: number;
}

/**
 * Records a bot run as the game would (`recordBotRun`'s choices), with what a forger, the
 * runtime's end delay or a reload changes: ticks after each fight's end, the assists, restarts,
 * and a log stored and resumed part-way.
 */
function forgeRun(start: RunState, o: ForgeOpts = {}): { replay: RunReplay; run: RunState } {
  let rec = RunRecorder.begin(start);
  const allow = allowanceRecord(EVERYTHING);
  let run = start;
  let shopped: string | null = null;
  let fight = 0;
  const resume = () => {
    if (o.resumeAt === undefined || rec.log.steps.length !== o.resumeAt) return;
    const stored = parseRunLog(copy(rec.log))!;
    const store = memoryStore();
    saveRun(store, run);
    expect(logFits(stored, loadRun(store)!)).toBe(true);
    rec = RunRecorder.resume(stored);
  };
  const take = (s: ChoiceStep): boolean => {
    const next = applyStep(run, s);
    rec.step(s, run, next);
    const changed = next !== run;
    run = next;
    if (changed) resume();
    return changed;
  };
  for (let guard = 0; guard < 2000 && run.phase !== 'summary'; guard++) {
    switch (run.phase) {
      case 'map': {
        const options = Run.reachable(run);
        take({ k: 'node', id: options[run.seed % options.length]!.id });
        break;
      }
      case 'combat': {
        fight++;
        for (let r = 0; r < (o.restarts?.(fight) ?? 0); r++) rec.restarted();
        const config = Run.combatConfig(run, o.assists ?? DEFAULT_ASSISTS)!;
        const sim = createSim(config);
        const replay = new ReplayRecorder(sim.config);
        const player = makeBot(o.bot ?? 'skilled', config.seed);
        for (let t = 0; t < 20 * 60 * 60; t++) {
          replay.record(sim.tick, sim.step(player.decide(sim.state)));
          const s = sim.state.encounter.status;
          if (s === 'victory' || s === 'defeat') break;
        }
        // The runtime goes on stepping through its end delay, the player's input still recorded.
        for (let t = 0; t < (o.tail?.(fight) ?? 0); t++)
          replay.record(sim.tick, sim.step(player.decide(sim.state)));
        const outcome = buildOutcome(
          sim.state,
          sim.config.party.map((p) => p.heroId),
        );
        const next = Run.finishCombat(run, outcome);
        rec.fight(replay.export(sim.tick, sim.hash()), outcome.outcome === 'victory', run, next);
        run = next;
        resume();
        break;
      }
      case 'result':
        take({ k: 'continue' });
        break;
      case 'draft':
        take({ k: 'draft', index: (run.draft?.options.length ?? 0) > 0 ? 0 : null });
        break;
      case 'relic':
        take({ k: 'relic', index: (run.relicOffer?.options.length ?? 0) > 0 ? 0 : null });
        break;
      case 'calling':
        take({ k: 'calling', index: 0, allowance: allow });
        break;
      case 'respite':
        take({ k: 'respite', choice: 'rest' });
        break;
      case 'merchant': {
        const items = run.shop?.items ?? [];
        const index = items.findIndex((i) => !i.sold && i.price <= run.aether);
        if (shopped !== run.pending && index >= 0) {
          shopped = run.pending;
          if (take({ k: 'buy', index })) break;
        }
        take({ k: 'leaveShop' });
        break;
      }
      case 'forge': {
        const motif = Run.forgeTargets(run, 'temper')[0];
        if (run.forge?.used === null && motif)
          take({ k: 'forge', choice: { service: 'temper', motifId: motif }, allowance: allow });
        if (run.phase === 'forge') take({ k: 'leaveForge' });
        break;
      }
      case 'event': {
        if (run.event && run.event.choice === null) {
          const def = CONTENT.events.find((e) => e.id === run.event!.eventId)!;
          const motifId = run.motifs[0]?.id;
          const made = def.choices.some(
            (c) =>
              !c.effects.some((e) => e.kind === 'retune') &&
              (c.motif === 'none' || motifId !== undefined) &&
              take({
                k: 'event',
                choice: c.id,
                ...(c.motif !== 'none' && motifId !== undefined ? { motifId } : {}),
                allowance: allow,
              }),
          );
          if (made) break;
        }
        take({ k: 'leaveEvent' });
        break;
      }
      default:
        throw new Error(`unexpected phase ${run.phase}`);
    }
  }
  if (run.phase !== 'summary') throw new Error('the run did not end');
  return { replay: rec.finish(run), run };
}

/** The run a replay's steps lead to before step `i` (fights played from their frames). */
function runBefore(replay: RunReplay, i: number): RunState {
  let run = replay.start;
  for (let k = 0; k < i; k++) {
    const s = replay.steps[k]!;
    if (s.k !== 'fight') {
      run = applyStep(run, s);
      continue;
    }
    const sim = createSim(Run.combatConfig(run, { ...s.assists })!);
    let f = 0;
    for (let tick = 0; tick < s.finalTick; tick++) {
      const fr = s.frames[f];
      if (fr && fr[0] === tick) {
        sim.step(fr[1]);
        f++;
      } else sim.step();
    }
    run = Run.finishCombat(
      run,
      buildOutcome(
        sim.state,
        sim.config.party.map((p) => p.heroId),
      ),
    );
  }
  return run;
}

const PICKS = { chords: Run.DEFAULT_CHORDS, techniques: {} };
/** The real-time bound of the runtime's end delay and grace, in ticks (396). */
const RUNTIME_TAIL = Math.ceil(((FIGHT_END_DELAY_MS + WITHOUT_YOU_GRACE_MS) * SIM_HZ) / 1000);

let prelude: { replay: RunReplay; run: RunState };
let weekly: { replay: RunReplay; run: RunState };

beforeAll(() => {
  prelude = recordBotRun(Run.embark(Run.newRun(2000)), 'skilled');
  weekly = recordBotRun(weeklyStart(44, PICKS)!, 'skilled');
}, SLOW);

afterEach(() => {
  fake.store = null;
  vi.unstubAllGlobals();
});

// ── B1 ────────────────────────────────────────────────────────────────────────────────────

describe('B1: a fight ends where its encounter ends', () => {
  it('the limit holds the runtime’s own end delay and grace, with room', () => {
    expect(RUNTIME_TAIL).toBe(396);
    expect(FIGHT_TAIL_MAX_TICKS).toBeGreaterThanOrEqual(2 * RUNTIME_TAIL);
    expect(FIGHT_TAIL_MAX_TICKS).toBeLessThan(20 * SIM_HZ);
  });

  it(
    'a weekly whose fights run on past their end (healing the party) does not verify',
    () => {
      const start = weeklyStart(44, PICKS)!;
      const forged = forgeRun(start, { tail: () => 1800 });
      const r = verifyRunReplay(forged.replay, shareCodeOf(forged.replay));
      expect(r.status).toBe('mismatch');
      expect(r.problem).toBe('fight');
      expect(r.at?.fight).toBe(1);
      expect(r.message).toMatch(/^Parts ways at fight 1 \(.+\): it plays on long past its end\./);
      // One tick past the limit, on one fight, is caught too.
      const edge = forgeRun(start, { tail: (n) => (n === 2 ? FIGHT_TAIL_MAX_TICKS + 1 : 0) });
      const e = verifyRunReplay(edge.replay);
      expect(e.problem).toBe('fight');
      expect(e.at?.fight).toBe(2);
    },
    SLOW,
  );

  it(
    'a recording with the runtime’s end delay (and the limit itself) verifies',
    () => {
      const start = weeklyStart(44, PICKS)!;
      const store = forgeRun(start, { tail: () => RUNTIME_TAIL });
      const r = verifyRunReplay(store.replay, shareCodeOf(store.replay));
      expect(r.status).toBe('verified');
      const edge = forgeRun(start, { tail: (n) => (n === 1 ? FIGHT_TAIL_MAX_TICKS : 7) });
      expect(verifyRunReplay(edge.replay).status).toBe('verified');
    },
    SLOW,
  );

  it('a fight cut short while still under way does not verify', () => {
    const t = copy(prelude.replay);
    const i = t.steps.findIndex((s) => s.k === 'fight');
    const f = t.steps[i] as FightStep;
    f.finalTick = 60;
    f.frames = f.frames.filter(([tick]) => tick < 60);
    const run = runBefore(t, i);
    const sim = createSim(Run.combatConfig(run, { ...f.assists })!);
    let fi = 0;
    for (let tick = 0; tick < 60; tick++) {
      const fr = f.frames[fi];
      if (fr && fr[0] === tick) {
        sim.step(fr[1]);
        fi++;
      } else sim.step();
    }
    f.finalHash = sim.hash();
    f.won = false;
    t.steps = t.steps.slice(0, i + 1);
    t.steps.push({ k: 'continue' });
    t.claim = { ...t.claim, won: false, fightsWon: 0, score: 0, seconds: 1 };
    const r = verifyRunReplay(redigest(t));
    expect(r.status).toBe('mismatch');
    expect(r.problem).toBe('fight');
    expect(r.message).toMatch(/: it stops while the fight is still under way\./);
  });

  it(
    'giving up mid-fight (a step of its own, no fight recorded) still plays back',
    () => {
      const start = Run.embark(Run.newRun(31));
      const rec = RunRecorder.begin(start);
      const node = Run.reachable(start)[0]!;
      const there = applyStep(start, { k: 'node', id: node.id });
      rec.step({ k: 'node', id: node.id }, start, there);
      expect(there.phase).toBe('combat');
      const done = applyStep(there, { k: 'abandon' });
      rec.step({ k: 'abandon' }, there, done);
      expect(verifyRunReplay(rec.finish(done)).status).toBe('playsBack');
    },
    SLOW,
  );

  it(
    'restarted fights, and a log resumed part-way, verify',
    () => {
      const start = weeklyStart(44, PICKS)!;
      const r = forgeRun(start, {
        tail: (n) => 150 + n,
        restarts: (n) => (n % 3 === 1 ? 2 : 0),
        resumeAt: 9,
      });
      expect(r.replay.steps.some((s) => s.k === 'fight' && s.restarts === 2)).toBe(true);
      expect(verifyRunReplay(r.replay, shareCodeOf(r.replay)).status).toBe('verified');
    },
    SLOW,
  );

  describe('every rotation entry, recorded by the Skilled bot, verifies with its code', () => {
    for (let week = 36; week < 36 + WEEKLY_CYCLE; week++)
      it(
        `week ${week} (entry ${week % WEEKLY_CYCLE})`,
        () => {
          const { replay } = recordBotRun(weeklyStart(week, PICKS)!, 'skilled');
          const r = verifyRunReplay(replay, shareCodeOf(replay));
          expect(r.status).toBe('verified');
        },
        SLOW,
      );
  });
});

// ── B2 ────────────────────────────────────────────────────────────────────────────────────

describe('B2: no hostile file throws; each can’t be read', () => {
  const cases: [string, () => unknown][] = [
    ['a content version that isn’t hex', () => ({ ...copy(weekly.replay), contentVersion: 'x' })],
    ['a sim version no code holds', () => ({ ...copy(weekly.replay), simVersion: 999 })],
    [
      'a week no code holds',
      () => {
        const t = copy(weekly.replay);
        t.week = 20_000;
        t.start = { ...t.start, weekly: { week: 20_000 } };
        return redigest(t);
      },
    ],
    [
      'a start nested 200,000 deep',
      () => {
        let deep: unknown = 0;
        for (let i = 0; i < 200_000; i++) deep = [deep];
        const t = copy(prelude.replay) as RunReplay & { start: Record<string, unknown> };
        t.start.junk = deep;
        return t;
      },
    ],
    [
      'a weekly’s start nested 200,000 deep',
      () => {
        let deep: unknown = 0;
        for (let i = 0; i < 200_000; i++) deep = { a: deep };
        const t = copy(weekly.replay) as RunReplay & { start: Record<string, unknown> };
        t.start.junk = deep;
        return t;
      },
    ],
    [
      'a start whose map names an encounter the game doesn’t have',
      () => {
        const t = copy(prelude.replay);
        for (const n of t.start.map.rows.at(-1)!)
          if (n.encounterId) n.encounterId = 'no_such_encounter';
        return redigest(t);
      },
    ],
  ];
  for (const [name, make] of cases)
    it(
      name,
      () => {
        const file = make();
        let r: ReturnType<typeof verifyRunReplay> | null = null;
        expect(() => (r = verifyRunReplay(file))).not.toThrow();
        expect(r!.status).toBe('mismatch');
        expect(r!.problem).toBe('file');
        expect(r!.message).toMatch(/^Can’t be read: /);
      },
      SLOW,
    );

  /** A stand-in for the browser's Worker: `ready` or not, then an error. */
  function stubWorker(ready: boolean) {
    const made: { terminated: boolean }[] = [];
    class FakeWorker {
      onmessage: ((e: { data: unknown }) => void) | null = null;
      onerror: ((e: { preventDefault(): void }) => void) | null = null;
      onmessageerror: (() => void) | null = null;
      terminated = false;
      constructor() {
        made.push(this);
      }
      postMessage() {
        setTimeout(() => {
          if (ready) this.onmessage?.({ data: { type: 'ready' } });
          this.onerror?.({ preventDefault() {} });
        }, 0);
      }
      terminate() {
        this.terminated = true;
      }
    }
    vi.stubGlobal('Worker', FakeWorker);
    return made;
  }

  it('a worker that started and then failed on a file: it can’t be read (never re-run here)', async () => {
    const made = stubWorker(true);
    const r = await verifyReplay(prelude.replay).result;
    expect(made).toHaveLength(1);
    expect(made[0]!.terminated).toBe(true);
    expect(r.problem).toBe('file');
    expect(r.played).toBeUndefined();
  });

  it(
    'a worker that never started: the main thread verifies',
    async () => {
      stubWorker(false);
      const r = await verifyReplay(prelude.replay).result;
      expect(r.status).toBe('playsBack');
      expect(r.played).toEqual(prelude.replay.claim);
    },
    SLOW,
  );

  it('a file nested too deep is answered before any worker', async () => {
    const made = stubWorker(true);
    let deep: unknown = 0;
    for (let i = 0; i < 100_000; i++) deep = [deep];
    const r = await verifyReplay({ ...copy(prelude.replay), start: { junk: deep } }).result;
    expect(made).toHaveLength(0);
    expect(r.problem).toBe('file');
  });
});

// ── M1 ────────────────────────────────────────────────────────────────────────────────────

describe('M1: assists are only the values Settings offer', () => {
  it('the replay’s values are exactly the settings’ literals', () => {
    const assists = SettingsSchema.shape.assists;
    const grid = [-1, 0, 0.05, 0.1, 0.15, 0.2, 0.3, 1, 1.1, 1.25, 1.5, 2, 1e6];
    for (const v of grid) {
      const ok = (key: keyof typeof ASSIST_VALUES, x: number) =>
        assists.safeParse({ ...DEFAULT_ASSISTS, [key]: x }).success;
      expect(ok('perfectWindowBonus', v)).toBe(
        (ASSIST_VALUES.perfectWindowBonus as readonly number[]).includes(v),
      );
      expect(ok('telegraphLead', v)).toBe(
        (ASSIST_VALUES.telegraphLead as readonly number[]).includes(v),
      );
    }
  });

  it(
    'a weekly played with assists no setting offers does not verify; the most a setting gives does',
    () => {
      const start = weeklyStart(44, PICKS)!;
      const odd = forgeRun(start, {
        assists: { perfectWindowBonus: 0.3, telegraphLead: 2, autonomy: true },
      });
      const r = verifyRunReplay(odd.replay);
      expect(r.status).toBe('mismatch');
      expect(r.problem).toBe('fight');
      expect(r.message).toBe('Uses an assist no setting offers in fight 1: it can’t be verified.');
      const huge = forgeRun(start, {
        assists: { perfectWindowBonus: 1e6, telegraphLead: 1e6, autonomy: false },
      });
      expect(verifyRunReplay(huge.replay).problem).toBe('fight');
      const most = forgeRun(start, {
        assists: { perfectWindowBonus: 0.2, telegraphLead: 1.5, autonomy: true },
      });
      expect(verifyRunReplay(most.replay).status).toBe('verified');
    },
    SLOW,
  );
});

// ── M2 ────────────────────────────────────────────────────────────────────────────────────

describe('M2: a resumed log that lost a step is caught', () => {
  it(
    'a log missing any one step never fits; the log of every step fits the run saved and loaded',
    () => {
      const { replay } = prelude;
      let run = replay.start;
      const rec = RunRecorder.begin(run);
      const lost: string[] = [];
      for (let i = 0; i < replay.steps.length; i++) {
        const s = replay.steps[i]!;
        const before = parseRunLog(copy(rec.log))!;
        const next = runBefore({ ...replay, start: run, steps: [s] }, 1);
        if (s.k === 'fight')
          rec.fight({ config: { assists: s.assists } as never, ...s }, s.won, run, next);
        else rec.step(s, run, next);
        run = next;
        if (run.phase === 'summary') break;
        if (logFits(before, run)) lost.push(s.k);
        const store = memoryStore();
        saveRun(store, run);
        const loaded = loadRun(store)!;
        expect(logFits(parseRunLog(copy(rec.log))!, loaded)).toBe(true);
      }
      expect(replay.steps.some((s) => s.k === 'buy')).toBe(true);
      expect(lost).toEqual([]);
    },
    SLOW,
  );

  it('an in-place step changes the fingerprint (a purchase, a reroll, a Forge service, a retune)', () => {
    const start = Run.embark(Run.newRun(5));
    const rec = RunRecorder.begin(start);
    const merchant: RunState = {
      ...start,
      phase: 'merchant',
      aether: 500,
      shop: {
        nodeId: start.map.rows[0]![0]!.id,
        items: [
          { kind: 'heal', id: 'heal', level: 0, upgrade: false, heal: 0.3, price: 10, sold: false },
        ],
      },
    } as RunState;
    const bought = {
      ...merchant,
      aether: 490,
      shop: { ...merchant.shop!, items: [{ ...merchant.shop!.items[0]!, sold: true }] },
    };
    rec.step({ k: 'buy', index: 0 }, merchant, bought);
    const log = parseRunLog(copy(rec.log))!;
    expect(logFits(log, bought)).toBe(true);
    expect(logFits(log, merchant)).toBe(false);
    // A log stored before the fingerprint was kept is judged by the rest, as before.
    const old = copy(log);
    delete (old.at as { fp?: string }).fp;
    expect(logFits(parseRunLog(old)!, merchant)).toBe(true);
  });
});

// ── M3 ────────────────────────────────────────────────────────────────────────────────────

function win(run: RunState): CombatOutcome {
  const config = Run.combatConfig(run)!;
  return {
    encounterId: config.encounter!,
    outcome: 'victory',
    duration: 40,
    ledger: emptyLedger(),
    party: run.party.map((h, slot) => ({
      slot,
      heroId: h.heroId,
      hp: 900,
      maxHp: 1000,
      downed: false,
      dead: false,
      damage: 100,
      amplified: 10,
    })),
    withoutYou: null,
  };
}

/**
 * Walks a run to its last boss, winning every fight and choosing the map node `pick(options)`;
 * returns the Calling's path when the last boss is chosen.
 */
function pathAtLastBoss(start: RunState, pick: (n: number, row: number) => number) {
  let run = start;
  for (let guard = 0; guard < 500; guard++) {
    switch (run.phase) {
      case 'map': {
        const options = Run.reachable(run);
        const node = options[pick(options.length, options[0]!.row)]!;
        if (Run.isFinalNode(node)) return run.calling?.path ?? null;
        run = Run.chooseNode(run, node.id);
        break;
      }
      case 'combat':
        run = Run.finishCombat(run, win(run));
        break;
      case 'result':
        run = Run.continueFromResult(run);
        break;
      case 'calling':
        run = Run.pickCalling(run, 0, undefined, EVERYTHING);
        break;
      case 'draft':
        run = Run.pickDraft(run, null);
        break;
      case 'relic':
        run = Run.pickRelic(run, null);
        break;
      case 'respite':
        run = Run.respite(run, 'rest');
        break;
      case 'merchant':
        run = Run.leaveShop(run);
        break;
      case 'forge':
        run = Run.leaveForge(run);
        break;
      case 'event': {
        const left = Run.leaveEvent(run);
        if (left !== run) run = left;
        else {
          const def = CONTENT.events.find((e) => e.id === run.event!.eventId)!;
          run = def.choices.reduce(
            (r, c) => (r === run ? Run.chooseEvent(run, c.id, {}, EVERYTHING) : r),
            run,
          );
        }
        break;
      }
      case 'scene':
        run = Run.endScene(run);
        break;
      default:
        throw new Error(`unexpected phase ${run.phase}`);
    }
  }
  throw new Error('the walk did not reach the last boss');
}

describe('M3: an Echo’s Calling tiers all come before its last boss', () => {
  const calling = CONTENT.callings[0]!.id;
  const echoes = CONTENT.echoes.filter((e) => !e.twists.noCalling);

  it('eight Echoes allow a Calling; the one that doesn’t has no rows', () => {
    expect(echoes).toHaveLength(8);
    for (const e of CONTENT.echoes.filter((x) => x.twists.noCalling))
      expect(Run.callingRows({ movements: 1, echo: e.id })).toEqual([]);
  });

  it('Preludes and Expeditions keep their rows', () => {
    expect(Run.callingRows({ movements: 1 })).toBe(Run.CALLING_ROWS);
    expect(Run.callingRows({ movements: 2 })).toBe(Run.CALLING_ROWS);
    expect(Run.callingRows({ movements: CONTENT.movements.length })).toEqual([0, 1, 2, 4]);
  });

  for (const echo of echoes)
    it(`${echo.id}: on 50 seeds, every path brings all four tiers, in order, first`, () => {
      const rows = Run.callingRows({ movements: 1, echo: echo.id });
      expect(rows).toHaveLength(4);
      rows.forEach((r, k) => k > 0 && expect(r).toBeGreaterThanOrEqual(rows[k - 1]!));
      for (let seed = 1; seed <= 50; seed++) {
        const start = Run.embark(Run.setCalling(Run.newEchoRun(seed, echo.id), calling));
        expect(start.calling?.id).toBe(calling);
        // Two walks a seed: the first node offered, and the last.
        for (const pick of [() => 0, (n: number) => n - 1]) {
          const path = pathAtLastBoss(start, pick);
          expect(path).not.toBeNull();
          expect(path!.every((p) => p !== null)).toBe(true);
        }
      }
    });

  const affected = CONTENT.weekly
    .map((entry, slot) => ({ entry, slot }))
    .filter(({ entry }) => entry.route !== 'expedition' && entry.calling !== null);
  for (const { entry, slot } of affected)
    it(`weekly entry ${slot} (${entry.route}): all four tiers first, on 50 weeks`, () => {
      for (let n = 0; n < 50; n++) {
        const week = slot + WEEKLY_CYCLE * n;
        const start = weeklyStart(week, PICKS, entry)!;
        const path = pathAtLastBoss(start, (k) => (week + n) % k);
        expect(path!.every((p) => p !== null)).toBe(true);
      }
    });

  it('the affected entries include the four the review named (7, 8, 10, 11)', () => {
    expect(affected.map((a) => a.slot)).toEqual(expect.arrayContaining([7, 8, 10, 11]));
  });
});

// ── M4 ────────────────────────────────────────────────────────────────────────────────────

describe('M4: a run whose results hold a Rewind loads', () => {
  it(
    'a Chronomancer Expedition saved after a Rewind loads, and resumes to the same run',
    () => {
      const base = Run.newRun(1234, undefined, [], [], [], [], undefined, CONTENT.movements.length);
      const { replay, run: end } = recordBotRun(
        Run.embark(Run.setCalling(base, 'chronomancer')),
        'skilled',
      );
      let run = replay.start;
      let checked = false;
      for (let i = 0; i < replay.steps.length && run.phase !== 'summary'; i++) {
        run = runBefore({ ...replay, start: run, steps: [replay.steps[i]!] }, 1);
        if (!run.results.some((r) => r.markers.some((m) => m.kind === 'rewind'))) continue;
        const store = memoryStore();
        saveRun(store, run);
        const loaded = loadRun(store);
        expect(loaded).not.toBeNull();
        expect(canonical(loaded)).toBe(canonical(copy(run)));
        // The rest of the run from the loaded save ends where the run did.
        const rest = runBefore(
          { ...replay, start: loaded!, steps: replay.steps.slice(i + 1) },
          replay.steps.length - i - 1,
        );
        expect(canonical(rest.results.map((r) => r.encounterId))).toBe(
          canonical(end.results.map((r) => r.encounterId)),
        );
        expect(rest.outcome).toBe(end.outcome);
        checked = true;
        break;
      }
      expect(checked).toBe(true);
    },
    SLOW,
  );

  it('a marker of a kind this build doesn’t know is dropped, not the run', () => {
    const { run } = prelude;
    const odd = copy(run);
    odd.results[0]!.markers.push({ time: 1, kind: 'zzz' as never, slot: null });
    const store = memoryStore();
    saveRun(store, odd);
    const loaded = loadRun(store);
    expect(loaded).not.toBeNull();
    expect(canonical(loaded!.results[0]!.markers)).toBe(canonical(run.results[0]!.markers));
  });
});

// ── M5 ────────────────────────────────────────────────────────────────────────────────────

describe('M5: a replay file too large is refused, and inflating stops at a budget', () => {
  it('readReplayFile: a gzip bomb and an oversized file can’t be read', async () => {
    const bomb = gzipSync(Buffer.alloc(REPLAY_JSON_MAX_BYTES + 1024 * 1024, 0x20));
    expect(bomb.byteLength).toBeLessThan(1024 * 1024);
    expect(await readReplayFile(bomb)).toBeNull();
    expect(await readReplayFile(new Uint8Array(REPLAY_FILE_MAX_BYTES + 1))).toBeNull();
    // An honest file still reads.
    const good = gzipSync(Buffer.from(JSON.stringify(prelude.replay)));
    expect(await readReplayFile(good)).toEqual(copy(prelude.replay));
  });

  it('tools/run-verify reads a bomb as nothing, not out of memory', () => {
    const dir = join(tmpdir(), 'aw-reviewB');
    mkdirSync(dir, { recursive: true });
    const bombPath = join(dir, 'bomb.awrun');
    writeFileSync(bombPath, gzipSync(Buffer.alloc(REPLAY_JSON_MAX_BYTES + 1024 * 1024, 0x20)));
    expect(readReplay(bombPath)).toBeNull();
    const goodPath = join(dir, 'good.awrun');
    writeFileSync(goodPath, gzipSync(Buffer.from(JSON.stringify(prelude.replay))));
    expect(readReplay(goodPath)).toEqual(copy(prelude.replay));
  });
});

// ── m1 ────────────────────────────────────────────────────────────────────────────────────

describe('m1: only a weekly reads Verified', () => {
  it('a Prelude plays back as recorded, its start not checked', () => {
    const r = verifyRunReplay(prelude.replay);
    expect(r.status).toBe('playsBack');
    expect(r.message).toMatch(
      /^Plays back as recorded on this device: a Prelude, (won|lost), [0-9,]+ points?, \d+ min of fighting\. Its start isn’t checked: only a weekly’s start can be rebuilt\.$/,
    );
    expect(r.message).not.toMatch(/Verified/);
  });

  it(
    'a made-up Prelude start plays back but is never Verified',
    () => {
      const base = Run.embark(Run.newRun(2000));
      const start: RunState = { ...base, aether: 5000 };
      const forged = forgeRun(start);
      const r = verifyRunReplay(forged.replay);
      expect(r.status).toBe('playsBack');
      expect(r.message).not.toMatch(/Verified/);
    },
    SLOW,
  );

  it('another version: plays back, not Verified; a weekly’s message stays the doc’s', () => {
    const t = copy(prelude.replay);
    t.contentVersion = 'c-0123456789abcdef';
    const r = verifyRunReplay(t);
    expect(r.status).toBe('playsBack');
    expect(r.message).toBe(
      'Plays back as recorded, though it was recorded on another version of the game. Its start isn’t checked: only a weekly’s start can be rebuilt.',
    );
    expect(verifyRunReplay(weekly.replay).message).toMatch(/^Verified on this device: Week 44, /);
  });
});

// ── m2 ────────────────────────────────────────────────────────────────────────────────────

describe('m2: a code is added only for a week of the kept span', () => {
  const code = (week: number, won = false) =>
    encodeShareCode({
      week,
      build: '01234567',
      simVersion: 22,
      won,
      fightsWon: 3,
      score: 400 + week,
      seconds: 300,
      digest: '0123456789',
    });
  const NOW = weekStartMs(44) + 3600_000;

  it('refuses a future week and a week too old, with their words', () => {
    useProfile.getState().resetProgress();
    const add = useProfile.getState().addWeeklyCode;
    expect(add(code(45), 'Mara', NOW)).toEqual({
      ok: false,
      error: 'This code is for Week 45, which hasn’t begun.',
    });
    expect(add(code(16_383), undefined, NOW).ok).toBe(false);
    expect(add(code(44 - WEEKLY_KEEP_WEEKS), undefined, NOW)).toEqual({
      ok: false,
      error: `This code is for Week ${44 - WEEKLY_KEEP_WEEKS}: only the last ${WEEKLY_KEEP_WEEKS} weeks are kept.`,
    });
    expect(add(code(44 - WEEKLY_KEEP_WEEKS + 1), undefined, NOW).ok).toBe(true);
    expect(add(code(44), 'Mara', NOW)).toMatchObject({ ok: true, week: 44 });
    expect(useProfile.getState().profile.weekly?.map((w) => w.week)).toEqual([
      44 - WEEKLY_KEEP_WEEKS + 1,
      44,
    ]);
  });

  it('a code never pushes out the player’s own weeks, nor the weeks the Deeds count', () => {
    let weeks: ReturnType<typeof withWeeklyEntry> | undefined;
    for (let w = 20; w < 20 + WEEKLY_KEEP_WEEKS; w++)
      weeks = withWeeklyEntry(weeks, w, { code: code(w, true), mine: true, status: 'verified' });
    expect(weeksWon({ weekly: weeks })).toBe(WEEKLY_KEEP_WEEKS);
    useProfile.getState().resetProgress();
    useProfile.setState({ profile: { ...useProfile.getState().profile, weekly: weeks } });
    const r = useProfile.getState().addWeeklyCode(code(44), undefined, NOW);
    expect(r.ok).toBe(false);
    expect(weeksWon(useProfile.getState().profile)).toBe(WEEKLY_KEEP_WEEKS);
    // Far-off weeks someone pasted: refused, the record as it was.
    for (let w = 16_372; w < 16_384; w++)
      useProfile.getState().addWeeklyCode(code(w), undefined, NOW);
    expect(weeksWon(useProfile.getState().profile)).toBe(WEEKLY_KEEP_WEEKS);
    // A week of codes only goes before a week of the player's own.
    let mixed = withWeeklyEntry(weeks!.slice(1), 40, { code: code(40), status: 'claimed' });
    mixed = withWeeklyEntry(mixed, 44, { code: code(44, true), mine: true, status: 'claimed' });
    expect(mixed.map((w) => w.week)).not.toContain(40);
    expect(weeksWon({ weekly: mixed })).toBe(WEEKLY_KEEP_WEEKS - 1);
  });
});

// ── m3 ────────────────────────────────────────────────────────────────────────────────────

describe('m3: a week no share code can name can’t start', () => {
  it('before the epoch and from week 16,384: no run', () => {
    expect(weeklyPrep(-3, PICKS)).toBeNull();
    expect(weeklyPrep(-1, PICKS)).toBeNull();
    expect(weeklyPrep(16_384, PICKS)).toBeNull();
    expect(weeklyPrep(0, PICKS)).not.toBeNull();
    const last = weeklyStart(16_383, PICKS)!;
    const replay = RunRecorder.begin(last).finish(Run.abandon(last));
    expect(() => shareCodeOf(replay)).not.toThrow();
  });
});

// ── m4 ────────────────────────────────────────────────────────────────────────────────────

/** A replay store in memory, with the kept replays given. */
function memoryReplayStore(kept: Record<string, RunReplay>): ReplayStore {
  const logs = new Map<string, unknown>();
  return {
    saveLog: (id, log) => Promise.resolve(void logs.set(id, copy(log))),
    loadLog: (id) => Promise.resolve(logs.has(id) ? parseRunLog(logs.get(id)) : null),
    deleteLog: (id) => Promise.resolve(void logs.delete(id)),
    keep: (id, replay) => Promise.resolve(void (kept[id] = replay)),
    kept: (id) => Promise.resolve(kept[id] ?? null),
    listKept: () => Promise.resolve([]),
    forget: (id) => Promise.resolve(void delete kept[id]),
    close: () => {},
  };
}

describe('m4: an own weekly left Claimed is verified again at start-up', () => {
  it(
    'a kept replay is verified; one whose kept replay is gone stays Claimed',
    async () => {
      const own = shareCodeOf(weekly.replay);
      const other = encodeShareCode({
        week: 43,
        build: '01234567',
        simVersion: 22,
        won: true,
        fightsWon: 3,
        score: 999,
        seconds: 300,
        digest: '0123456789',
      });
      useProfile.getState().resetProgress();
      let weeks = withWeeklyEntry(undefined, 44, {
        code: own,
        mine: true,
        status: 'claimed',
        replay: 'run-kept',
      });
      weeks = withWeeklyEntry(weeks, 43, {
        code: other,
        mine: true,
        status: 'claimed',
        replay: 'run-gone',
      });
      useProfile.setState({ profile: { ...useProfile.getState().profile, weekly: weeks } });
      fake.store = memoryReplayStore({ 'run-kept': weekly.replay });
      const job = reverifyClaimedWeeklies();
      await job.done;
      const status = (week: number) =>
        useProfile.getState().profile.weekly!.find((w) => w.week === week)!.entries[0]!.status;
      expect(status(44)).toBe('verified');
      expect(status(43)).toBe('claimed');
    },
    SLOW,
  );

  it('cancelled before it begins, it changes nothing', async () => {
    useProfile.getState().resetProgress();
    const weeks = withWeeklyEntry(undefined, 44, {
      code: shareCodeOf(weekly.replay),
      mine: true,
      status: 'claimed',
      replay: 'run-kept',
    });
    useProfile.setState({ profile: { ...useProfile.getState().profile, weekly: weeks } });
    fake.store = memoryReplayStore({ 'run-kept': weekly.replay });
    const job = reverifyClaimedWeeklies();
    job.cancel();
    await job.done;
    expect(useProfile.getState().profile.weekly![0]!.entries[0]!.status).toBe('claimed');
  });
});

// ── m5 ────────────────────────────────────────────────────────────────────────────────────

describe('m5: a step that can’t be recorded breaks the log (no replay)', () => {
  it('a step whose arguments the log refuses', () => {
    const start = { ...Run.embark(Run.newRun(9)), logId: 'log-m5' };
    recorder.beginRecording(start);
    const next = { ...start, aether: start.aether + 1 };
    // A draft pick by a name, not an index: no step reads it.
    expect(stepOfAction('pickDraft', ['first'])).toBeNull();
    recorder.recordAction({ action: 'pickDraft', args: ['first'] }, start, next);
    expect(recorder.recordingNow()?.broken).toBe(true);
    expect(recorder.finishRecording(Run.abandon(next))).toBeNull();
    // An action that is no run step leaves the log as it was.
    recorder.beginRecording(start);
    recorder.recordAction({ action: 'embark', args: [] }, start, next);
    expect(recorder.recordingNow()?.broken).toBe(false);
    void recorder.stopRecording();
  });

  it('a step taken while the log is still being read back', async () => {
    const start = { ...Run.embark(Run.newRun(9)), logId: 'log-m5b' };
    fake.store = memoryReplayStore({});
    recorder.beginRecording(start);
    await recorder.flushRecording();
    const node = Run.reachable(start)[0]!;
    const there = Run.chooseNode(start, node.id);
    // The page reloads: the run is resumed, and a step is taken before the log is back.
    const resumed = recorder.resumeRecording(start);
    expect(recorder.recordingNow()?.resuming).toBe(true);
    recorder.recordAction({ action: 'chooseNode', args: [node.id] }, start, there);
    expect(await resumed).toBe(false);
    expect(recorder.recordingNow()?.broken).toBe(true);
    expect(recorder.finishRecording(Run.abandon(there))).toBeNull();
    // Without the stray step, the same resume picks the log up.
    const again = recorder.resumeRecording(start);
    expect(await again).toBe(true);
    await recorder.stopRecording();
  });
});

// ── m6 ────────────────────────────────────────────────────────────────────────────────────

describe('m6: a corrupt key costs only itself', () => {
  it('an Atlas whose best doesn’t parse keeps its stars', () => {
    const base = { ...newProfile(5), xp: 12345 };
    const p = {
      ...base,
      atlas: { stars: { choir_of_blood: 2, retrograde: 1 }, best: null },
    };
    const loaded = loadProfile(memoryStore({ 'aetherweaver.profile': JSON.stringify(p) }));
    expect(loaded.xp).toBe(12345);
    expect(loaded.atlas).toEqual({ stars: { choir_of_blood: 2, retrograde: 1 }, best: {} });
  });

  const saved = (run: unknown) => {
    const s = memoryStore();
    s.setItem('aetherweaver.run', JSON.stringify(run));
    return loadRun(s);
  };

  it('a log key that doesn’t parse costs only the recording', () => {
    const start = Run.embark(Run.newEchoRun(9, 'choir_of_blood'));
    const loaded = saved({ ...start, logId: 7 });
    expect(loaded).not.toBeNull();
    expect('logId' in loaded!).toBe(false);
    expect(loaded!.echo).toBe('choir_of_blood');
  });

  it('a weekly whose week doesn’t parse is found again from its seed', () => {
    const start = weeklyStart(44, PICKS)!;
    const loaded = saved({ ...start, weekly: { week: 'x' } });
    expect(loaded?.weekly).toEqual({ week: 44 });
    // One whose seed is no week's can't play as what it was: not loaded.
    expect(saved({ ...start, seed: start.seed ^ 1, weekly: { week: 'x' } })).toBeNull();
  });

  it('an Echo whose Echo doesn’t parse is found again from its map', () => {
    const start = Run.embark(Run.newEchoRun(9, 'bells_in_the_rift'));
    const loaded = saved({ ...start, echo: 5 });
    expect(loaded?.echo).toBe('bells_in_the_rift');
    expect(canonical(loaded)).toBe(canonical(copy(start)));
    // A map no Echo draws for its seed: not loaded (its legs can't be known).
    expect(saved({ ...start, seed: start.seed + 1, echo: 5 })).toBeNull();
  });
});

// ── q2 ────────────────────────────────────────────────────────────────────────────────────

describe('q2: an Echo-route weekly counts as an Echo for run-wide Deeds', () => {
  it('judges the run-wide Deeds on an Expedition-route weekly, not an Echo-route one', () => {
    const echoSlot = CONTENT.weekly.findIndex((e) => e.route !== 'expedition');
    const expSlot = CONTENT.weekly.findIndex((e) => e.route === 'expedition');
    const echoWeekly = weeklyStart(echoSlot, PICKS)!;
    const expWeekly = weeklyStart(expSlot, PICKS)!;
    expect(echoWeekly.echo).toBeDefined();
    expect(countsRunWide(echoWeekly)).toBe(false);
    expect(countsRunWide(expWeekly)).toBe(true);
    expect(countsRunWide(Run.newEchoRun(1, 'choir_of_blood'))).toBe(false);
    expect(countsRunWide(Run.newRun(1))).toBe(true);
    const counting = CONTENT.deeds.filter(
      (d) => isRunWideDeed(d) && deedProgress(expWeekly, d) !== null,
    );
    expect(counting.length).toBeGreaterThan(0);
    for (const d of counting) expect(deedProgress(echoWeekly, d)).toBeNull();
  });
});

// ── q4 ────────────────────────────────────────────────────────────────────────────────────

describe('q4: the weekly rotation has exactly twelve entries, if any', () => {
  it('a thirteenth entry (or eleven) is refused; twelve and none are not', () => {
    const parse = (n: number) => {
      const c = structuredClone(CONTENT);
      const rotation = c.weekly;
      c.weekly = Array.from({ length: n }, (_, i) => rotation[i % rotation.length]!);
      return ContentSchema.safeParse(c);
    };
    expect(CONTENT.weekly).toHaveLength(WEEKLY_CYCLE);
    expect(parse(12).success).toBe(true);
    expect(parse(0).success).toBe(true);
    for (const n of [11, 13]) {
      const r = parse(n);
      expect(r.success).toBe(false);
      expect(JSON.stringify(r.error?.issues)).toMatch(/the weekly rotation has \d+ entries/);
    }
    expect(weeklyEntry(WEEKLY_CYCLE)).toBe(CONTENT.weekly[0]);
  });
});
