/**
 * CONTRACT v5 — the run store (meta/types.ts RunActions). Screens read `run` and call the
 * actions; every action is a pure transition from meta/run.ts followed by a save. Fights award
 * Weaver XP to the profile (app/profileStore.ts) as they finish, and Prep and Retune only
 * accept what the profile has unlocked.
 */
import { create } from 'zustand';
import { pruneTree } from '../meta/astrolabe';
import {
  carriedRelics,
  runMaterials,
  type EnshrineResult,
  type ReliquaryRelic,
} from '../meta/reliquary';
import { awardedBondXp, sceneWaiting, type RunBond } from '../meta/bonds';
import { dissonancePoints, type DissonanceChoice } from '../meta/dissonance';
import { CONTENT, type SceneDef } from '../content';
import * as Run from '../meta/run';
import { EXPEDITION_MOVEMENTS, type Allowance } from '../meta/profile';
import { loadRun, saveRun } from '../meta/save';
import type { CombatOutcome, RunActions, RunState } from '../meta/types';
import { fitTechniques, type Techniques } from '../meta/variants';
import type { SimConfig } from '../sim';
import type { Replay } from '../sim/replay';
import type { WeeklyEntry } from '../content';
import type { RunReplay, VerifyResult } from '../meta/runReplay';
import { embarkWeekly, weeklyEntry, weeklyPrep, weeklyRecords } from '../meta/weekly';
import {
  beginRecording,
  finishRecording,
  keepReplay,
  newLogId,
  recordAction,
  recordFight,
  recordingNow,
  resumeRecording,
  stopRecording,
} from './runRecorder';
import { openReplayStore } from './replayStore';
import { verifyReplay, type VerifyJob } from './verify';
import type { WeeklyStatus } from '../meta/profile';
import { useProfile } from './profileStore';
import { useSettings } from './settings';
import { withAssisted } from './gameSpeed';
import { storage } from './storage';

export interface RunStore extends RunActions {
  run: RunState | null;
  /**
   * The finished run's replay file (docs/phase-6.md, "Run replays"), made at its Summary for a
   * recorded run (a weekly or an Echo); null otherwise. Kept in memory: `keepReplay` stores it.
   */
  replay: RunReplay | null;
  /** A finished weekly's own re-verification (its entry's status follows it); null otherwise. */
  weeklyCheck: Promise<VerifyResult> | null;
  /** The Summary's Keep: the finished replay stored on the device (false without IndexedDB). */
  keepReplay(): Promise<boolean>;
  /** A saved, unfinished run exists (Title → Continue). */
  hasSave(): boolean;
  /** Loads the saved run. Returns false if there is none. */
  resume(): boolean;
  /** A run in Prep follows the profile's Astrolabe (free between runs). */
  followAstrolabe(tree: readonly string[]): void;
  /** A run in Prep follows the profile's carry (docs/phase-4c.md). */
  followReliquary(): void;
  /** A won run's Summary: enshrine one of the relics it found (once). */
  enshrine(relicId: string): EnshrineResult;
  /** A run in Prep follows the profile's Dissonance (docs/phase-4d.md). */
  followDissonance(): void;
  /** A run in Prep follows the profile's Bond choices (docs/phase-4e.md). */
  followBonds(): void;
  /** Prep follows the profile's technique variants (docs/phase-4f.md). */
  followTechniques(): void;
  /**
   * A run in Prep follows the profile's roster (docs/phase-5b.md): a party with a hero the roster
   * no longer has (picked while "Skip the unlocks" was on) falls back to the default party.
   */
  followParty(): void;
  /** At a Respite: the Bond scenes waiting for the party's heroes, one per hero. */
  scenesWaiting(): SceneDef[];
  /** A Respite's fourth choice: a waiting Bond scene, instead of resting. */
  bondScene(sceneId: string): void;
  /** The scene is over, with this reply: it's seen, pays its Bond XP, and the run goes on. */
  endScene(reply: number): void;
  // ── Phase 6 (docs/phase-6.md) ──
  /**
   * Starts an Echo run in Prep (the Atlas of Echoes): the Echo's route and twists, a new seed
   * each attempt (`seed` for tests and tools), the profile's tree, carry, Dissonance, Bonds and
   * variants where its twists allow. Ignored for an Echo the content doesn't have.
   */
  newEchoRun(echoId: string, seed?: number): void;
  /**
   * Starts this week's weekly run in Prep (This Week's Song): `week` is `weekOf(now)` (the app
   * passes the time in); everything but the Chords and the technique variants is the week's
   * (`weeklyPrep`, the verifier's own start). `entry` is for tests and tools only: a replay
   * verifies only on the week's own entry. Ignored when the week has no entry it can play.
   */
  newWeeklyRun(week: number, entry?: WeeklyEntry): void;
  /** Prep of a weekly: the technique variants, any of them (the level field). Ignored elsewhere. */
  setRunTechniques(techniques: Partial<Techniques>): void;
  /**
   * The combat screen's end of a fight (docs/phase-6.md, "Recording"): the outcome, as
   * `finishCombat` takes it, with the fight replay the runtime exports at the tick the outcome
   * was built (`GameRuntime.exportReplay()`). A recorded run (a weekly or an Echo) logs the fight;
   * a fight ended without its replay (null, or the plain `finishCombat`) ends that run's
   * recording, since its replay could no longer verify. Any other run ignores `replay`.
   */
  finishFight(outcome: CombatOutcome, replay: Replay | null): void;
}

/**
 * What a run step reads from the profile (docs/phase-6.md, ground rule 8): everything on a weekly
 * run, the profile's allowance on any other.
 */
function stepAllowance(run: RunState | null): Allowance {
  return run?.weekly !== undefined ? Run.runAllowance(run) : useProfile.getState().allowance();
}

/** One run-layer step as the run's log keeps it: the action and what it was given. */
interface RunStepNote {
  action: string;
  args: readonly unknown[];
  /** The allowance the step read (`pickCalling`, `retune`, `forge`, `chooseEvent`). */
  allowance?: Allowance;
}

/**
 * Does this run keep a run replay (docs/phase-6.md, "Run replays")? A weekly (its share code and
 * verification need one) and an Echo. A Prelude or an Expedition records nothing and carries no
 * log key, so it plays and saves exactly as before.
 */
export function recordsReplay(run: Pick<RunState, 'weekly' | 'echo'>): boolean {
  return run.weekly !== undefined || run.echo !== undefined;
}

/** The step the store just applied, for the run's log (nothing while nothing records). */
function logStep(prev: RunState, next: RunState, step: RunStepNote | undefined): void {
  if (!step || !recordingNow()) return;
  recordAction(step, prev, next);
}

/** The profile's tree as a run may hold it: within the points the Rank (or the settings) give. */
function profileTree(): string[] {
  const profile = useProfile.getState();
  return pruneTree(profile.profile.astrolabe, profile.astrolabePoints());
}

/** The relics the profile carries into a run, within its slots (docs/phase-4c.md). */
function profileCarry(): ReliquaryRelic[] {
  const profile = useProfile.getState();
  return carriedRelics(profile.profile.reliquary, profile.carrySlots());
}

/** What the run's heroes play with, from the profile's Bonds (docs/phase-4e.md). */
function profileBonds(heroes: readonly string[]): RunBond[] {
  return useProfile.getState().runBonds(heroes);
}

/**
 * The party a new run starts with (docs/phase-5b.md): the one the profile remembers, when every
 * hero in it is still in the roster; the default party otherwise.
 */
function startingParty(): string[] {
  const profile = useProfile.getState();
  const last = profile.profile.lastParty;
  const roster = new Set(profile.roster());
  return last && last.length === 3 && last.every((id) => roster.has(id))
    ? [...last]
    : [...CONTENT.defaultParty];
}

/**
 * Recruits whatever the run has recruited so far (idempotent: nothing new, no write). A
 * Rank-gated recruit (docs/phase-5e.md) counts once the profile's allowance holds it: read after
 * `award(xp)`, so a Rank reached in this very fight counts, and an earlier fight of the run then
 * counts too (`recruitsOf` rescans the results).
 */
function recruitFrom(run: RunState | null): void {
  if (!run) return;
  const profile = useProfile.getState();
  profile.recruit(Run.recruitsOf(run, profile.allowance()));
}

/** The Dissonance the profile plays new runs at, if it's open (docs/phase-4d.md). */
function profileDissonance(): DissonanceChoice[] {
  const profile = useProfile.getState();
  return profile.dissonanceOpen() ? profile.profile.dissonance.levels : [];
}

/**
 * A run ended, by its Summary, an abandon or a new run (docs/phase-4c.md): it pays the Reliquary
 * its materials, once, if the Reliquary is open.
 */
function settleReliquary(run: RunState): RunState {
  if (run.reliquary || !useProfile.getState().reliquaryOpen()) return run;
  const paid = runMaterials(run);
  useProfile.getState().payReliquary(paid);
  return { ...run, reliquary: { ...paid, enshrined: null } };
}

/**
 * A just-finished fight's result with its Bond XP as the profile awards it (`awardedBondXp`), in
 * `lastResult` and its entry in `results`. The same run when the fight didn't finish, or nothing
 * changes (every default party).
 */
function withAwardedBondXp(
  next: RunState,
  prev: RunState,
  bonds: Parameters<typeof awardedBondXp>[0],
): RunState {
  const r = next.lastResult;
  if (next === prev || !r || r === prev.lastResult || !r.bondXp) return next;
  const bondXp = awardedBondXp(bonds, r.bondXp);
  if (Object.keys(bondXp).every((id) => bondXp[id] === r.bondXp[id])) return next;
  const result = { ...r, bondXp };
  const results = next.results.map((x) => (x === r ? result : x));
  return { ...next, lastResult: result, results };
}

/**
 * Remembers the run's songs for the next Prep, judged as this run held them. Not a weekly's: its
 * level field may hold songs the profile hasn't unlocked (docs/phase-6.md).
 */
function remember(run: RunState): void {
  if (run.weekly !== undefined) return;
  useProfile.getState().rememberChords(run.chords, Run.reservePool(run), Run.reserveMult(run));
}

/**
 * A run that ended (by its Summary, or replaced by a new run) records what Phase 6 keeps of it
 * (docs/phase-6.md): its Finale-clear Dissonance, an Echo's stars, a weekly's entry.
 */
function recordEnd(run: RunState, replay: RunReplay | null = null): string | null {
  const profile = useProfile.getState();
  profile.recordFinaleDissonance(run);
  if (run.echo !== undefined && run.weekly === undefined) profile.recordAtlas(run);
  return run.weekly !== undefined ? profile.recordWeekly(run, replay) : null;
}

/** A weekly's verification as its entry keeps it (a weekly never `playsBack`; if so, unmatched). */
function weeklyStatusOf(result: VerifyResult): WeeklyStatus {
  return result.status === 'playsBack' ? 'mismatch' : result.status;
}

/**
 * A finished weekly's own replay, verified again on this device (docs/phase-6.md, "The local
 * leaderboard": "yours, re-verified when finished"); its entry takes the result's status.
 */
function reverify(week: number, code: string, replay: RunReplay): Promise<VerifyResult> {
  const job = verifyReplay(replay, code).result;
  void job
    .then((r) => useProfile.getState().setWeeklyStatus(week, code, weeklyStatusOf(r)))
    .catch(() => {});
  return job;
}

/**
 * The player's own weekly replay, kept on the device as it is made (under its log's key), so an
 * entry still Claimed when the page closed (its re-verification cut short) can be verified at the
 * next start (`reverifyClaimedWeeklies`). The entry names the kept replay once it is stored; on a
 * device without IndexedDB nothing is kept, and the entry stays as its re-verification leaves it.
 */
function keepOwnWeekly(week: number, code: string, id: string, replay: RunReplay): void {
  void keepReplay(id, replay, Date.now())
    .then((kept) => {
      if (!kept) return;
      const held = useProfile
        .getState()
        .profile.weekly?.find((w) => w.week === week)
        ?.entries.find((e) => e.code === code);
      if (held) useProfile.getState().setWeeklyStatus(week, code, held.status, id);
    })
    .catch(() => {
      // Storage full or refused: the entry keeps no replay.
    });
}

/**
 * Verifies again, one after another in the background worker, the player's own weekly entries
 * still Claimed whose replay was kept (a page closed while its re-verification ran): each takes
 * the result's status. One whose kept replay is gone (storage cleared) stays Claimed, as a code
 * alone is, and is looked for again at the next start. Never blocks: it begins after the
 * current task, and `cancel` stops it (the job under way too). Resolves when it is done.
 */
export function reverifyClaimedWeeklies(): { done: Promise<void>; cancel(): void } {
  let cancelled = false;
  let job: VerifyJob | null = null;
  const done = (async () => {
    await new Promise((r) => setTimeout(r, 0));
    const claimed = (useProfile.getState().profile.weekly ?? []).flatMap((w) =>
      w.entries
        .filter((e) => e.mine === true && e.status === 'claimed' && e.replay !== undefined)
        .map((e) => ({ week: w.week, code: e.code, id: e.replay! })),
    );
    if (claimed.length === 0 || cancelled) return;
    const store = await openReplayStore();
    if (!store) return;
    try {
      for (const entry of claimed) {
        if (cancelled) return;
        const replay = await store.kept(entry.id).catch(() => null);
        if (!replay || cancelled) continue;
        job = verifyReplay(replay, entry.code);
        const result = await job.result.catch(() => null);
        job = null;
        if (result && !cancelled)
          useProfile
            .getState()
            .setWeeklyStatus(entry.week, entry.code, weeklyStatusOf(result), entry.id);
      }
    } finally {
      store.close();
    }
  })().catch(() => {});
  return {
    done,
    cancel: () => {
      cancelled = true;
      job?.cancel();
    },
  };
}

export const useRun = create<RunStore>()((set, get) => {
  const apply = (fn: (run: RunState) => RunState, step?: RunStepNote) => {
    const run = get().run;
    if (!run) return;
    let next = fn(run);
    if (next === run) return;
    logStep(run, next, step);
    // A run that just ended pays the Reliquary and counts toward the profile.
    const ended = run.phase !== 'summary' && next.phase === 'summary';
    if (ended) {
      next = settleReliquary(next);
      // Dissonance (docs/phase-4d.md): a win may open it, or set a new best.
      next = { ...next, dissonanceEnd: useProfile.getState().recordDissonance(next) };
    }
    saveRun(storage(), next);
    set({ run: next });
    if (ended) {
      useProfile.getState().recordRun(next.outcome === 'victory');
      // A recorded run's replay file (docs/phase-6.md): made at its Summary, kept in memory. A
      // weekly that played no fight records nothing, its replay included.
      const made = recordingNow() ? finishRecording(next) : null;
      const replay = made && (next.weekly === undefined || weeklyRecords(next)) ? made : null;
      const code = recordEnd(next, replay);
      const week = next.weekly?.week;
      if (replay && code !== null && week !== undefined && next.logId !== undefined)
        keepOwnWeekly(week, code, next.logId, replay);
      if (replay || get().replay || get().weeklyCheck)
        set({
          replay,
          weeklyCheck:
            replay && code !== null && week !== undefined ? reverify(week, code, replay) : null,
        });
    }
  };
  /** A run replaced or closed: its recording stops (and its log goes), its replay is let go. */
  const stopLog = () => {
    if (recordingNow()) void stopRecording();
    if (get().replay || get().weeklyCheck) set({ replay: null, weeklyCheck: null });
  };
  /**
   * Deeds (docs/phase-4b.md): records what the run has earned so far (its fights' feats and
   * counts; the win's once its boss is beaten). The run lists each new one once, for its Summary,
   * even when Settings → Reset progress lets it earn them again.
   */
  const recordDeeds = () => {
    const run = get().run;
    if (!run) return;
    const earned = useProfile.getState().recordDeeds(run);
    const fresh = earned.filter((id) => !run.deeds.includes(id));
    if (fresh.length > 0) apply((r) => ({ ...r, deeds: [...r.deeds, ...fresh] }));
  };
  /**
   * A run replaced before its summary still counts (won if its last fight won the run: its final
   * boss, not an Expedition's Cantor), and pays the Reliquary: the one in play, or the saved one
   * after a restart.
   */
  const retirePrevious = () => {
    const previous = get().run ?? loadRun(storage());
    if (previous && previous.phase !== 'prep' && previous.phase !== 'summary') {
      const last = previous.lastResult;
      const won = previous.outcome === 'victory' || (!!last && Run.endsRun(last));
      useProfile.getState().recordRun(won);
      settleReliquary(previous);
      // A win may open Dissonance or set a best, as at a Summary (docs/phase-4d.md).
      if (won) useProfile.getState().recordDissonance({ ...previous, outcome: 'victory' });
      // …and keeps what Phase 6 records of a run's end (docs/phase-6.md).
      recordEnd(won ? { ...previous, outcome: 'victory' } : previous);
    }
    stopLog();
  };
  return {
    run: null,
    replay: null,
    weeklyCheck: null,
    keepReplay: async () => {
      const { replay, run } = get();
      if (!replay || !run?.logId) return false;
      return keepReplay(run.logId, replay, Date.now());
    },
    hasSave: () => {
      const saved = loadRun(storage());
      return !!saved && saved.phase !== 'summary';
    },
    resume: () => {
      const loaded = loadRun(storage());
      if (!loaded) return false;
      // An Expedition still in Prep, saved when Expeditions were shorter (docs/phase-5c.md), is
      // drawn again at the current length: an I-III save becomes the Finale's route, whose
      // shorter road redraws the whole map (docs/phase-5d.md); its path is empty, so nothing is
      // lost. A run past Prep keeps the map it was saved with, whatever content has added since.
      const saved =
        loaded.phase === 'prep' && loaded.movements > 1 && loaded.movements < EXPEDITION_MOVEMENTS
          ? Run.setMovements(loaded, EXPEDITION_MOVEMENTS)
          : loaded;
      // A fight can't be resumed mid-way: restart the pending encounter from its start.
      // A run still in Prep picks up the tree, the carry, the Dissonance and the Bonds as they
      // are now.
      const followed = Run.setBonds(
        Run.setDissonance(
          Run.setCarried(Run.setAstrolabe(saved, profileTree()), profileCarry()),
          profileDissonance(),
        ),
        profileBonds(saved.party.map((h) => h.heroId)),
      );
      set({
        // A weekly keeps its own variants (docs/phase-6.md).
        run:
          followed.weekly !== undefined
            ? followed
            : Run.setTechniques(followed, useProfile.getState().runTechniques()),
      });
      // …and the roster as it is now: Prep never shows a party it wouldn't embark.
      get().followParty();
      // A run saved before Deeds (or before a reset) gets what its fights have earned.
      recordDeeds();
      // …and a recruit its fights made (docs/phase-5b.md), if the app closed before it was kept.
      recruitFrom(get().run);
      // A recorded run picks its log up again (docs/phase-6.md); a fight under way restarts.
      const resumed = get().run;
      if (resumed?.logId !== undefined) void resumeRecording(resumed);
      return true;
    },
    followAstrolabe: (tree) =>
      apply((run) =>
        Run.setAstrolabe(run, pruneTree(tree, useProfile.getState().astrolabePoints())),
      ),
    followReliquary: () => apply((run) => Run.setCarried(run, profileCarry())),
    followDissonance: () => apply((run) => Run.setDissonance(run, profileDissonance())),
    followBonds: () =>
      apply((run) => Run.setBonds(run, profileBonds(run.party.map((h) => h.heroId)))),
    // A weekly's variants are its own (any of them, docs/phase-6.md): it doesn't follow.
    followTechniques: () =>
      apply((run) =>
        run.weekly !== undefined
          ? run
          : Run.setTechniques(run, useProfile.getState().runTechniques()),
      ),
    followParty: () =>
      apply((run) => {
        const roster = useProfile.getState().roster();
        // An Echo's or a weekly's own party stands, recruited or not (docs/phase-6.md).
        if (Run.partyFixed(run) || run.party.every((h) => roster.includes(h.heroId))) return run;
        const next = Run.setParty(run, CONTENT.defaultParty, roster);
        return next === run ? run : Run.setBonds(next, profileBonds(CONTENT.defaultParty));
      }),
    scenesWaiting: () => {
      const run = get().run;
      if (!run || run.phase !== 'respite') return [];
      const bonds = useProfile.getState().profile.bonds;
      return run.party.flatMap((h) => {
        const scene = sceneWaiting(h.heroId, bonds[h.heroId]);
        return scene ? [scene] : [];
      });
    },
    bondScene: (sceneId) => {
      if (
        !get()
          .scenesWaiting()
          .some((s) => s.id === sceneId)
      )
        return;
      apply((run) => Run.bondScene(run, sceneId), { action: 'bondScene', args: [sceneId] });
    },
    endScene: (reply) => {
      const scene = get().run?.scene;
      if (!scene || get().run?.phase !== 'scene') return;
      apply(Run.endScene, { action: 'endScene', args: [reply] });
      useProfile.getState().seeScene(scene.sceneId, reply);
    },
    enshrine: (relicId) => {
      const run = get().run;
      // A won Prelude, or an Expedition that reached Movement II (docs/phase-5a.md).
      if (!run || run.phase !== 'summary' || !Run.enshrineEligible(run))
        return {
          ok: false,
          reason:
            run && run.movements >= 2
              ? 'Only an Expedition that reached Movement II enshrines a relic.'
              : 'Only a won run enshrines a relic.',
        };
      if (run.reliquary?.enshrined) return { ok: false, reason: 'This run has enshrined one.' };
      const found = Run.enshrineOptions(run).find((r) => r.id === relicId);
      if (!found) return { ok: false, reason: 'This run didn’t find that relic.' };
      // Its depth: the Dissonance the run won at (docs/phase-4d.md).
      const result = useProfile.getState().enshrine(found, dissonancePoints(run.dissonance));
      if (result.ok)
        apply((r) => ({
          ...r,
          reliquary: {
            shards: r.reliquary?.shards ?? 0,
            tears: r.reliquary?.tears ?? 0,
            enshrined: relicId,
            enshrinedUid: result.relic.uid,
          },
        }));
      return result;
    },
    newRun: (seed, mode) => {
      retirePrevious();
      // Start from the last Chords used, if they're still unlocked and the tree can hold them.
      const profile = useProfile.getState();
      const last = profile.profile.lastChords;
      // The party the profile remembers, if the roster still has it (docs/phase-5b.md).
      const party = startingParty();
      // Math.random is fine here: the app picks the seed; the run itself is seeded.
      let run = Run.newRun(
        seed ?? Math.floor(Math.random() * 2 ** 31),
        undefined,
        profileTree(),
        profileCarry(),
        profileDissonance(),
        profileBonds(party),
        profile.runTechniques(),
        // Its route (docs/phase-5a.md): the Prelude, or an Expedition once they're open (every
        // Movement in content, EXPEDITION_MOVEMENTS, docs/phase-5c.md).
        profile.routeMovements(mode),
      );
      if (party.join() !== CONTENT.defaultParty.join())
        run = Run.setParty(run, party, profile.roster());
      if (last.length > 0) run = Run.setChords(run, last, profile.allowance());
      saveRun(storage(), run);
      set({ run });
    },
    newEchoRun: (echoId, seed) => {
      if (!Run.echoDef(echoId)) return;
      retirePrevious();
      const profile = useProfile.getState();
      const party = startingParty();
      // Math.random is fine here: the app picks each attempt's seed; the run itself is seeded.
      let run = Run.newEchoRun(
        seed ?? Math.floor(Math.random() * 2 ** 31),
        echoId,
        undefined,
        profileTree(),
        profileCarry(),
        profileDissonance(),
        profileBonds(party),
        profile.runTechniques(),
      );
      // The remembered party, unless the Echo names its own (`setParty` refuses then).
      if (party.join() !== CONTENT.defaultParty.join())
        run = Run.setParty(run, party, profile.roster());
      if (Run.partyFixed(run))
        run = Run.setBonds(run, profileBonds(run.party.map((h) => h.heroId)));
      const last = profile.profile.lastChords;
      if (last.length > 0) run = Run.setChords(run, last, profile.allowance());
      saveRun(storage(), run);
      set({ run });
    },
    newWeeklyRun: (week, entry) => {
      const profile = useProfile.getState();
      // The level field (decision 6): the profile's last Chords and variants are only where Prep
      // starts; any aura, ornament and variant may be chosen.
      const run = weeklyPrep(
        week,
        { chords: profile.profile.lastChords, techniques: profile.profile.techniques },
        entry ?? weeklyEntry(week),
      );
      if (!run) return;
      retirePrevious();
      saveRun(storage(), run);
      set({ run });
    },
    setRunTechniques: (techniques) =>
      apply((run) =>
        run.weekly !== undefined
          ? Run.setTechniques(run, fitTechniques(techniques, [], true))
          : run,
      ),
    // Prep's choices are the run's start (its state at embark), not steps of it.
    setChords: (chords) => apply((run) => Run.setChords(run, chords, stepAllowance(run))),
    setCalling: (id) => apply((run) => Run.setCalling(run, id, stepAllowance(run))),
    setRunMode: (mode) => {
      const profile = useProfile.getState();
      if (mode === 'expedition' && !profile.expeditionOpen()) return;
      profile.setRunMode(mode);
      apply((run) => Run.setMovements(run, profile.routeMovements(mode)));
    },
    // The roster (docs/phase-5b.md): 3 heroes the roster has, in canonical order; the run
    // follows their Bonds, and the profile remembers a pick that isn't the default party.
    setParty: (ids) => {
      const before = get().run;
      apply((run) => {
        const next = Run.setParty(run, ids, useProfile.getState().roster());
        return next === run
          ? run
          : Run.setBonds(next, profileBonds(next.party.map((h) => h.heroId)));
      });
      const after = get().run;
      if (after && after !== before && after.phase === 'prep')
        useProfile.getState().setLastParty(after.party.map((h) => h.heroId));
    },
    embark: () => {
      const profile = useProfile.getState();
      // Chords or a Calling picked while "Skip the unlocks" was on don't outlive turning it off.
      // The tree and the relics it embarks with are the run's to keep (within the points and
      // the carry slots the Rank gives).
      // Its heroes' Bond choices too, as their ranks (or the settings) open them now.
      // An Expedition chosen while "Skip the unlocks" was on plays as the Prelude if Expeditions
      // aren't open any more (docs/phase-5a.md); the route is frozen from here.
      // A hero picked while "Skip the unlocks" was on doesn't outlive turning it off either
      // (docs/phase-5b.md): the run plays the default party, and follows its Bonds.
      const roster = profile.roster();
      apply(
        (current) => {
          // A weekly embarks on its level field, whatever the profile holds (docs/phase-6.md):
          // as the verifier rebuilds it (`embarkWeekly`).
          if (current.weekly !== undefined) return embarkWeekly(current);
          const owned =
            Run.partyFixed(current) || current.party.every((h) => roster.includes(h.heroId));
          const run = owned ? current : Run.setParty(current, CONTENT.defaultParty, roster);
          return Run.embark(
            Run.setCallingTiers(
              Run.setTechniques(
                Run.setBonds(
                  Run.setMovements(run, profile.expeditionOpen() ? run.movements : 1),
                  profileBonds(run.party.map((h) => h.heroId)),
                ),
                profile.runTechniques(),
              ),
              run.calling ? profile.tiersOpen(run.calling.id) : 0,
            ),
            profile.allowance(),
            profile.astrolabePoints(),
            profile.carrySlots(),
            profile.dissonanceOpen(),
            roster,
          );
        },
        { action: 'embark', args: [] },
      );
      const run = get().run;
      if (run?.phase === 'map') remember(run);
      // A weekly's or an Echo's run replay begins as it embarks, under a log key of its own.
      if (run?.phase === 'map' && recordsReplay(run) && run.path.length === 0) {
        // Date.now is fine here: the log's key is the app's, never part of the run's start.
        const logged: RunState = { ...run, logId: newLogId(run.seed, Date.now()) };
        saveRun(storage(), logged);
        set({ run: logged });
        beginRecording(logged);
      }
    },
    chooseNode: (id) =>
      apply((run) => Run.chooseNode(run, id), { action: 'chooseNode', args: [id] }),
    combatConfig: (): SimConfig | null => {
      let run = get().run;
      if (!run) return null;
      // Decision 16 (docs/phase-7.md, W2): a fight with an assist marks the run for the badge.
      const marked = withAssisted(run, useSettings.getState().settings);
      if (marked !== run) {
        saveRun(storage(), marked);
        set({ run: (run = marked) });
      }
      return Run.combatConfig(run, { ...useSettings.getState().settings.assists });
    },
    finishCombat: (outcome: CombatOutcome) => get().finishFight(outcome, null),
    finishFight: (outcome, replay) => {
      const before = get().run;
      // Bonds (docs/phase-5b.md): the fight's Bond XP as the profile awards it (a late recruit's
      // catch-up, judged on the profile's Bonds before this award), so the Result and the Summary
      // show what each hero really earned.
      const bonds = useProfile.getState().profile.bonds;
      // Decision 16: an assist on as the fight ends (game speed, Auto-Thread) marks the run too.
      const settings = useSettings.getState().settings;
      apply(
        (run) => {
          const next = withAwardedBondXp(Run.finishCombat(run, outcome), run, bonds);
          return next === run ? run : withAssisted(next, settings);
        },
        {
          action: 'finishCombat',
          args: [],
        },
      );
      const after = get().run;
      // The run's log (docs/phase-6.md): the fight's replay, or, without one, no replay at all.
      if (before && after && after !== before && recordingNow()) {
        if (replay) recordFight(replay, outcome.outcome === 'victory', before, after);
        else void stopRecording();
      }
      if (after && after !== before && after.lastResult) {
        useProfile.getState().award(after.lastResult.xp);
        // Bonds (docs/phase-4e.md): each hero's Bond XP from the fight, already as awarded.
        useProfile.getState().awardBonds(after.lastResult.bondXp, false);
        // The Loom (docs/phase-4g.md): Starlight, and the Calling's mastery with the Weaver XP.
        useProfile.getState().awardStarlight(after.lastResult.starlight);
        if (after.calling)
          useProfile.getState().awardMastery(after.calling.id, after.lastResult.xp);
        recordDeeds();
        // The roster (docs/phase-5b.md): a hero this fight freed joins from the next Prep.
        recruitFrom(get().run);
      }
    },
    continueFromResult: () =>
      apply(Run.continueFromResult, { action: 'continueFromResult', args: [] }),
    pickCalling: (index, chords) => {
      const before = get().run;
      const allowance = stepAllowance(before);
      apply((run) => Run.pickCalling(run, index, chords, allowance), {
        action: 'pickCalling',
        args: [index, chords],
        allowance,
      });
      const run = get().run;
      // Third Voice's free retune took.
      if (run && before && run.chords !== before.chords) remember(run);
    },
    pickRelic: (index) =>
      apply((run) => Run.pickRelic(run, index), { action: 'pickRelic', args: [index] }),
    pickDraft: (index) =>
      apply((run) => Run.pickDraft(run, index), { action: 'pickDraft', args: [index] }),
    rerollDraft: () => apply(Run.rerollDraft, { action: 'rerollDraft', args: [] }),
    respite: (choice) =>
      apply((run) => Run.respite(run, choice), { action: 'respite', args: [choice] }),
    retune: (chords) => {
      const allowance = stepAllowance(get().run);
      apply((run) => Run.retune(run, chords, allowance), {
        action: 'retune',
        args: [chords],
        allowance,
      });
      const run = get().run;
      if (run?.phase === 'map') remember(run);
    },
    buy: (index) => apply((run) => Run.buy(run, index), { action: 'buy', args: [index] }),
    leaveShop: () => apply(Run.leaveShop, { action: 'leaveShop', args: [] }),
    forge: (choice) => {
      const allowance = stepAllowance(get().run);
      apply((run) => Run.forge(run, choice, allowance), {
        action: 'forge',
        args: [choice],
        allowance,
      });
      const run = get().run;
      if (choice.service === 'retune' && run?.forge?.used === 'retune') remember(run);
    },
    leaveForge: () => apply(Run.leaveForge, { action: 'leaveForge', args: [] }),
    chooseEvent: (choiceId, opts) => {
      const allowance = stepAllowance(get().run);
      apply((run) => Run.chooseEvent(run, choiceId, opts, allowance), {
        action: 'chooseEvent',
        args: [choiceId, opts],
        allowance,
      });
      const run = get().run;
      if (run?.event?.gains?.retuned) remember(run);
    },
    leaveEvent: () => apply(Run.leaveEvent, { action: 'leaveEvent', args: [] }),
    abandon: () => apply(Run.abandon, { action: 'abandon', args: [] }),
    closeRun: () => {
      stopLog();
      saveRun(storage(), null);
      set({ run: null });
    },
  };
});

/** The run's Calling id (null: none, or no run): Combat's primer mentions Bear for the Martyr. */
export const selectCallingId = (s: RunStore): string | null => s.run?.calling?.id ?? null;

// The Astrolabe is free between runs: a run still in Prep follows the profile's tree, within
// the points it has now (turning "Skip the unlocks" off takes the points back).
useProfile.subscribe((state, prev) => {
  if (state.profile.astrolabe !== prev.profile.astrolabe || state.profile.xp !== prev.profile.xp)
    useRun.getState().followAstrolabe(state.profile.astrolabe);
});
useSettings.subscribe((state, prev) => {
  if (state.settings.unlockAll !== prev.settings.unlockAll) {
    // The party first, so the Bonds below follow the heroes Prep will embark.
    useRun.getState().followParty();
    useRun.getState().followAstrolabe(useProfile.getState().profile.astrolabe);
    useRun.getState().followReliquary();
    useRun.getState().followDissonance();
    useRun.getState().followBonds();
    useRun.getState().followTechniques();
  }
});
// So does its carry (docs/phase-4c.md): a relic chosen, crafted or released, or a slot opened.
useProfile.subscribe((state, prev) => {
  if (state.profile.reliquary !== prev.profile.reliquary || state.profile.xp !== prev.profile.xp)
    useRun.getState().followReliquary();
});
// And its Dissonance (docs/phase-4d.md): a level chosen, or Dissonance opened.
useProfile.subscribe((state, prev) => {
  if (state.profile.dissonance !== prev.profile.dissonance) useRun.getState().followDissonance();
});
// And its heroes' Bonds (docs/phase-4e.md): a talent or Solo chosen, or a rank reached.
useProfile.subscribe((state, prev) => {
  if (state.profile.bonds !== prev.profile.bonds) useRun.getState().followBonds();
});
// And its technique variants (docs/phase-4f.md): one chosen, or bought.
useProfile.subscribe((state, prev) => {
  if (
    state.profile.techniques !== prev.profile.techniques ||
    state.profile.variants !== prev.profile.variants
  )
    useRun.getState().followTechniques();
});

/** The start-up re-verification of own weekly entries left Claimed (cancel it to stop it). */
export let startupReverify: { done: Promise<void>; cancel(): void } | null = null;

if (typeof window !== 'undefined') {
  // Save on the way out, so closing the tab never loses a transition.
  window.addEventListener('pagehide', () => saveRun(storage(), useRun.getState().run));
  // An own weekly entry left Claimed (the page closed mid re-verification) is verified again.
  startupReverify = reverifyClaimedWeeklies();
}
