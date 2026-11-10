/**
 * Run replays (docs/phase-6.md, "Run replays", "Verifying a shared run" and *Tests*): a Skilled
 * bot's weekly recorded in Node verifies in Node, and every tampering the doc lists is caught
 * with its message. A Prelude (fast) carries most tamper cases; the weekly carries the ones only
 * a weekly has (its week, its start, its code, its allowance).
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { CONTENT, CONTENT_VERSION } from '../../src/content';
import { allowanceFor, EVERYTHING, type Allowance } from '../../src/meta/profile';
import * as Run from '../../src/meta/run';
import {
  RUN_REPLAY_FORMAT,
  RunRecorder,
  allowanceOf,
  allowanceRecord,
  applyStep,
  codeOnlyResult,
  logFits,
  parseRunLog,
  parseRunReplay,
  runDigest,
  shareCodeOf,
  stepOfAction,
  verifyRunReplay,
  type ChoiceStep,
  type FightStep,
  type RunReplay,
  type VerifyProgress,
} from '../../src/meta/runReplay';
import { decodeShareCode, encodeShareCode } from '../../src/meta/shareCode';
import type { RunState } from '../../src/meta/types';
import { weeklyScore, weeklyStart } from '../../src/meta/weekly';
import { SIM_VERSION } from '../../src/sim';
import { recordBotRun } from '../../tools/run-verify';

const SLOW = 240_000;
const WEEK = 44;

let prelude: { replay: RunReplay; run: RunState };
let weekly: { replay: RunReplay; run: RunState };

beforeAll(() => {
  prelude = recordBotRun(Run.embark(Run.newRun(2000)), 'skilled');
  weekly = recordBotRun(
    weeklyStart(WEEK, { chords: Run.DEFAULT_CHORDS, techniques: {} })!,
    'skilled',
  );
}, SLOW);

/** The run store action that makes a step, with its arguments and allowance. */
function actionOf(s: ChoiceStep): [string, unknown[], Allowance?] {
  const allowance = 'allowance' in s ? allowanceOf(s.allowance) : undefined;
  switch (s.k) {
    case 'node':
      return ['chooseNode', [s.id]];
    case 'continue':
      return ['continueFromResult', []];
    case 'calling':
      return ['pickCalling', s.chords ? [s.index, s.chords] : [s.index], allowance];
    case 'relic':
      return ['pickRelic', [s.index]];
    case 'draft':
      return ['pickDraft', [s.index]];
    case 'reroll':
      return ['rerollDraft', []];
    case 'respite':
      return ['respite', [s.choice]];
    case 'retune':
      return ['retune', [s.chords], allowance];
    case 'scene':
      return ['bondScene', [s.sceneId]];
    case 'endScene':
      return ['endScene', [0]];
    case 'buy':
      return ['buy', [s.index]];
    case 'leaveShop':
      return ['leaveShop', []];
    case 'forge':
      return ['forge', [s.choice], allowance];
    case 'leaveForge':
      return ['leaveForge', []];
    case 'event':
      return [
        'chooseEvent',
        [
          s.choice,
          {
            ...(s.motifId ? { motifId: s.motifId } : {}),
            ...(s.chords ? { chords: s.chords } : {}),
          },
        ],
        allowance,
      ];
    case 'leaveEvent':
      return ['leaveEvent', []];
    case 'abandon':
      return ['abandon', []];
  }
}

/** A deep copy to tamper with. */
function copy(r: RunReplay): RunReplay {
  return JSON.parse(JSON.stringify(r)) as RunReplay;
}

/** A tampered file whose claim's digest is made again to fit, as a careful forger would. */
function redigest(r: RunReplay): RunReplay {
  return { ...r, claim: { ...r.claim, digest: runDigest(r) } };
}

function fights(r: RunReplay): FightStep[] {
  return r.steps.filter((s): s is FightStep => s.k === 'fight');
}

describe('a recorded run', () => {
  it('records every step and fight, and claims what the run came to', () => {
    const { replay, run } = prelude;
    expect(replay.format).toBe(RUN_REPLAY_FORMAT);
    expect(replay.kind).toBe('prelude');
    expect(replay.simVersion).toBe(SIM_VERSION);
    expect(replay.contentVersion).toBe(CONTENT_VERSION);
    expect(fights(replay)).toHaveLength(run.results.length);
    expect(replay.claim.score).toBe(weeklyScore(run));
    expect(replay.claim.digest).toBe(runDigest(replay));
    expect(parseRunReplay(JSON.parse(JSON.stringify(replay)))).toEqual(replay);
    const kinds = new Set(replay.steps.map((s) => s.k));
    for (const k of ['node', 'fight', 'continue', 'draft'])
      expect(kinds.has(k as never)).toBe(true);
  });

  it(
    'a Skilled-bot weekly verifies in Node, with its code',
    () => {
      const { replay } = weekly;
      expect(replay.kind).toBe('weekly');
      expect(replay.week).toBe(WEEK);
      const code = shareCodeOf(replay);
      const seen: VerifyProgress[] = [];
      const result = verifyRunReplay(replay, code, { onProgress: (p) => seen.push(p) });
      expect(result.status).toBe('verified');
      expect(result.code).toBe(code);
      expect(result.played).toEqual(replay.claim);
      expect(result.message).toMatch(
        new RegExp(
          `^Verified on this device: Week ${WEEK}, (won|lost), [0-9,]+ points?, \\d+ min of fighting\\.$`,
        ),
      );
      const last = seen[seen.length - 1]!;
      expect(last.fight).toBe(last.fights);
      expect(last.ticks).toBe(last.totalTicks);
      expect(seen.length).toBeGreaterThan(fights(replay).length);
    },
    SLOW,
  );

  it('a Prelude verifies, and its message says so', () => {
    const result = verifyRunReplay(prelude.replay);
    expect(result.status).toBe('verified');
    expect(result.message).toMatch(/^Verified on this device: a Prelude, (won|lost), /);
    expect(result.code).toBeUndefined();
  });

  it('leaves the profile-written run fields out of the digest and the claim', () => {
    const { run } = prelude;
    const written: RunState = {
      ...run,
      deeds: ['first_light'],
      dissonanceEnd: { opened: true, best: 3 } as unknown as RunState['dissonanceEnd'],
      reliquary: { shards: 9, tears: 1, enshrined: null },
      results: run.results.map((r) => ({
        ...r,
        bondXp: Object.fromEntries(Object.keys(r.bondXp).map((h) => [h, 999])),
        withoutYou: null,
      })),
      lastResult: null,
    };
    const rec = RunRecorder.resume({
      ...prelude.replay,
      restarts: 0,
      at: { steps: 0, path: 0, encounters: 0, phase: 'map' },
    });
    expect(rec.finish(written).claim).toEqual(prelude.replay.claim);
  });
});

describe('tampering is caught', () => {
  it('an edited command: the fight and its number', () => {
    const t = copy(prelude.replay);
    const second = fights(t)[1]!;
    const at = second.frames.findIndex(([, cmds]) => cmds.some((c) => c.t === 'move'));
    second.frames[at]![1] = second.frames[at]![1].map((c) =>
      c.t === 'move' ? { ...c, x: c.x + 3 } : c,
    );
    const result = verifyRunReplay(t);
    const name = CONTENT.encounters.find((e) => e.id === prelude.run.results[1]!.encounterId)!.name;
    expect(result.status).toBe('mismatch');
    expect(result.problem).toBe('fight');
    expect(result.at?.fight).toBe(2);
    expect(result.message).toMatch(
      new RegExp(
        `^Parts ways at fight 2 \\(${name}\\): it (was recorded as a (win|loss) and plays as a (win|loss) here|plays out differently here than it was recorded)\\. It may have been edited, or recorded on another browser\\.$`,
      ),
    );
  });

  it('an edited step (another draft): parts ways, or the claim doesn’t cover it', () => {
    const t = copy(prelude.replay);
    const draft = t.steps.find((s) => s.k === 'draft' && s.index === 0);
    expect(draft).toBeDefined();
    if (draft?.k === 'draft') draft.index = 1;
    const unsigned = verifyRunReplay(t);
    expect(unsigned.problem).toBe('claim');
    expect(unsigned.message).toBe(
      'Doesn’t match its claim: its steps aren’t the ones its claim was made from.',
    );
    const forged = verifyRunReplay(redigest(t));
    expect(forged.status).toBe('mismatch');
    expect(forged.message).toMatch(/^Parts ways at (fight|step) \d+ \(/);
  });

  it('an edited claim', () => {
    const t = copy(prelude.replay);
    t.claim.score += 100;
    const result = verifyRunReplay(t);
    const s = (n: number) => n.toLocaleString('en-US');
    expect(result.problem).toBe('claim');
    expect(result.message).toBe(
      `Doesn’t match its claim: the file says ${s(prelude.replay.claim.score + 100)} points; the replay plays to ${s(prelude.replay.claim.score)}.`,
    );
    expect(result.played).toEqual(prelude.replay.claim);
  });

  it('a step that isn’t open where it stands', () => {
    const t = copy(prelude.replay);
    const i = t.steps.findIndex((s) => s.k === 'node');
    t.steps[i] = { k: 'node', id: 'nowhere' };
    const result = verifyRunReplay(redigest(t));
    expect(result.problem).toBe('step');
    expect(result.message).toBe(
      `Parts ways at step ${i + 1} (a map choice): that choice isn’t open here. It may have been edited, or recorded on another browser.`,
    );
  });

  it('a debug command', () => {
    const t = copy(prelude.replay);
    fights(t)[2]!.frames.push([
      fights(t)[2]!.finalTick - 1,
      [{ t: 'debug', op: { op: 'killEnemies' } }],
    ]);
    const result = verifyRunReplay(redigest(t));
    expect(result.problem).toBe('debug');
    expect(result.message).toBe(
      'Uses debug commands in fight 3: a run with debug commands can’t be verified.',
    );
    const u = copy(prelude.replay);
    fights(u)[0]!.debug = true;
    expect(verifyRunReplay(redigest(u)).problem).toBe('debug');
  });

  it('a config smuggled into the file is dropped: the run’s own is used', () => {
    const t = copy(prelude.replay) as RunReplay & { steps: (FightStep & { config?: unknown })[] };
    const f = fights(t)[0]! as FightStep & { config?: unknown };
    f.config = {
      relics: CONTENT.relics.map((r) => ({ id: r.id, cleansed: true, empowered: true })),
      threat: 0.1,
    };
    const result = verifyRunReplay(t);
    expect(result.status).toBe('verified');
    expect(result.played).toEqual(prelude.replay.claim);
    expect(parseRunReplay(t)!.steps.some((s) => 'config' in s)).toBe(false);
  });

  it('another version with matching hashes reads “another version”', () => {
    const t = copy(prelude.replay);
    t.contentVersion = 'c-0123456789abcdef';
    const result = verifyRunReplay(t);
    expect(result.status).toBe('otherVersion');
    expect(result.message).toBe('Verified, though it was recorded on another version of the game.');
    t.steps[0] = { k: 'node', id: 'nowhere' };
    expect(verifyRunReplay(redigest(t)).message).toMatch(
      /It was recorded on another version of the game, which may be why\.$/,
    );
  });

  it('a weekly whose start isn’t what its week plays', () => {
    const t = copy(weekly.replay);
    t.start.party = t.start.party.map((h, i) => (i === 0 ? { ...h, heroId: 'oro' } : h));
    const result = verifyRunReplay(redigest(t));
    expect(result.problem).toBe('start');
    expect(result.message).toBe(
      `Doesn’t match its week: its start isn’t what Week ${WEEK} plays (it differs in its party).`,
    );
    const r = copy(weekly.replay);
    r.start.relics = [{ id: CONTENT.relics[0]!.id, cleansed: false } as RunState['relics'][number]];
    expect(verifyRunReplay(redigest(r)).message).toBe(
      `Doesn’t match its week: its start isn’t what Week ${WEEK} plays (it differs in its relics).`,
    );
    const w = copy(weekly.replay);
    w.week = WEEK + 1;
    expect(verifyRunReplay(redigest(w)).message).toBe(
      'Doesn’t match its week: its start names another week.',
    );
  });

  it('a weekly step played with less than everything open', () => {
    const t = copy(weekly.replay);
    const i = t.steps.findIndex((s) => 'allowance' in s);
    expect(i).toBeGreaterThanOrEqual(0);
    const s = t.steps[i]!;
    if ('allowance' in s) s.allowance = allowanceRecord(allowanceFor(1));
    const result = verifyRunReplay(redigest(t));
    expect(result.problem).toBe('start');
    expect(result.message).toBe(
      `Doesn’t match its week: step ${i + 1} was played with less than everything open, as no weekly is.`,
    );
  });

  it(
    'a code that doesn’t match its replay',
    () => {
      const { replay } = weekly;
      const code = shareCodeOf(replay);
      const read = decodeShareCode(code);
      if (!read.ok) throw new Error(read.error);
      const other = (patch: Partial<typeof read.claim>) =>
        encodeShareCode({ ...read.claim, ...patch });
      expect(verifyRunReplay(replay, other({ week: WEEK + 2 })).message).toBe(
        `This code is for Week ${WEEK + 2}.`,
      );
      const score = replay.claim.score;
      expect(verifyRunReplay(replay, other({ score: score + 250 })).message).toBe(
        `Doesn’t match its code: the code says ${(score + 250).toLocaleString('en-US')} points; the replay plays to ${score.toLocaleString('en-US')}.`,
      );
      expect(verifyRunReplay(replay, other({ digest: 'ffffffffff' })).message).toBe(
        'Doesn’t match its code: the code names another run than this replay.',
      );
      expect(verifyRunReplay(replay, other({ build: '00000000' })).message).toBe(
        'Doesn’t match its code: the code names another build of the game than its replay.',
      );
      const typo = code.slice(0, 5) + (code[5] === 'Z' ? 'Y' : 'Z') + code.slice(6);
      expect(verifyRunReplay(replay, typo).message).toBe(
        'This code has a typo: its check letters don’t match.',
      );
      expect(verifyRunReplay(prelude.replay, code).message).toBe(
        'This replay isn’t a weekly, so no code can name it.',
      );
    },
    SLOW,
  );

  it('what isn’t a replay, and a code alone', () => {
    expect(verifyRunReplay({ hello: 1 }).message).toBe(
      'Can’t be read: it isn’t a run replay of this game.',
    );
    expect(verifyRunReplay(null).problem).toBe('file');
    const cut = copy(prelude.replay);
    cut.steps = cut.steps.slice(0, -2);
    expect(verifyRunReplay(redigest(cut)).message).toBe(
      'Can’t be verified: the replay ends before its run does.',
    );
    const code = shareCodeOf(weekly.replay);
    expect(codeOnlyResult(code)).toEqual({
      status: 'claimed',
      week: WEEK,
      message: 'Only a code: its replay hasn’t been checked.',
    });
    expect(codeOnlyResult('AW1-nope').status).toBe('mismatch');
  });
});

describe('the recorder', () => {
  it('stores and resumes its log, and knows when a log no longer fits its run', () => {
    const start = Run.embark(Run.newRun(77));
    const rec = RunRecorder.begin({ ...start, logId: 'log-1' });
    expect('logId' in rec.log.start).toBe(false);
    const node = Run.reachable(start)[0]!;
    const next = applyStep(start, { k: 'node', id: node.id });
    rec.step({ k: 'node', id: node.id }, start, next);
    rec.step({ k: 'node', id: 'nowhere' }, next, next);
    expect(rec.log.steps).toHaveLength(1);
    rec.restarted();
    const stored = parseRunLog(JSON.parse(JSON.stringify(rec.log)));
    expect(stored).not.toBeNull();
    expect(stored!.restarts).toBe(1);
    expect(logFits(stored!, next)).toBe(true);
    expect(logFits(stored!, start)).toBe(false);
    expect(RunRecorder.resume(stored!).log).toEqual(rec.log);
    expect(() => RunRecorder.begin(next)).toThrow();
  });

  it('records an event’s motif and Chords, and the allowance, as the run layer takes them', () => {
    const start = Run.embark(Run.newRun(5));
    const motif = CONTENT.motifs[0]!.id;
    const at = (eventId: string): RunState => ({
      ...start,
      phase: 'event',
      pending: start.map.rows[0]![0]!.id,
      motifs: [{ id: motif, level: 1 }],
      event: {
        nodeId: start.map.rows[0]![0]!.id,
        eventId,
        choice: null,
        won: null,
        outcome: null,
        gains: null,
        encounterId: null,
        relics: 0,
      },
    });
    const shrine = at('shrine_of_discord');
    const offer = {
      k: 'event' as const,
      choice: 'offer',
      motifId: motif,
      allowance: 'all' as const,
    };
    expect(applyStep(shrine, offer)).toEqual(
      Run.chooseEvent(shrine, 'offer', { motifId: motif }, EVERYTHING),
    );
    expect(applyStep(shrine, offer)).not.toBe(shrine);
    expect(applyStep(shrine, { ...offer, motifId: undefined })).toBe(shrine);
    const pool = at('tuning_pool');
    const chords = [{ auras: ['ostinato', 'allegro'], ornaments: [] }];
    const retune = { k: 'event' as const, choice: 'retune', chords, allowance: 'all' as const };
    expect(applyStep(pool, retune).chords).toEqual(chords);
    // A Rank 1 allowance doesn't hold every aura: the same retune may be refused under it.
    const low = allowanceRecord(allowanceFor(1));
    expect(applyStep(pool, { ...retune, allowance: low })).toEqual(
      Run.chooseEvent(pool, 'retune', { chords }, allowanceFor(1)),
    );
  });

  it('names the step each run store action makes', () => {
    const chords = [{ auras: ['ostinato', 'allegro'], ornaments: [] }];
    expect(stepOfAction('chooseNode', ['n1'])).toEqual({ k: 'node', id: 'n1' });
    expect(stepOfAction('pickDraft', [null])).toEqual({ k: 'draft', index: null });
    expect(stepOfAction('pickCalling', [1, chords], allowanceFor(9))).toEqual({
      k: 'calling',
      index: 1,
      chords,
      allowance: allowanceRecord(allowanceFor(9)),
    });
    expect(stepOfAction('chooseEvent', ['offer', { motifId: 'm' }])).toEqual({
      k: 'event',
      choice: 'offer',
      motifId: 'm',
      allowance: 'all',
    });
    expect(stepOfAction('forge', [{ service: 'retune', chords }])).toEqual({
      k: 'forge',
      choice: { service: 'retune', chords },
      allowance: 'all',
    });
    expect(stepOfAction('endScene', [2])).toEqual({ k: 'endScene' });
    for (const prep of ['setChords', 'setCalling', 'embark', 'finishCombat', 'newRun'])
      expect(stepOfAction(prep, [])).toBeNull();
    expect(stepOfAction('pickDraft', ['first'])).toBeNull();
    expect(stepOfAction('respite', ['sleep'])).toBeNull();
    // Every step of a recorded run is one an action names.
    for (const s of prelude.replay.steps)
      if (s.k !== 'fight') expect(s).toEqual(stepOfAction(...actionOf(s)));
  });

  it('writes an allowance down and reads it back as it was', () => {
    for (const rank of [1, 5, 12, 30]) {
      const a = allowanceFor(rank);
      const back = allowanceOf(JSON.parse(JSON.stringify(allowanceRecord(a))));
      expect({
        ...back,
        auras: [...back.auras].sort(),
        ornaments: [...back.ornaments].sort(),
        callings: [...back.callings].sort(),
        recruits: [...back.recruits].sort(),
      }).toEqual({
        ...a,
        auras: [...a.auras].sort(),
        ornaments: [...a.ornaments].sort(),
        callings: [...a.callings].sort(),
        recruits: [...a.recruits].sort(),
      });
    }
    expect(allowanceRecord(EVERYTHING)).toBe('all');
    expect(allowanceOf('all')).toBe(EVERYTHING);
  });
});
