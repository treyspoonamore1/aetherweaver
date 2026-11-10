/**
 * Run replays from the command line (docs/phase-6.md, "Run replays").
 *
 *   npx tsx tools/run-verify.ts <file.awrun|file.json> [share code]
 *     Verifies a run replay (gzipped or plain JSON) as the game does, and prints what the
 *     player would read, the time it took and the file's size. Exit code 0 when it verifies
 *     (on this version or another), or, for a run that isn't a weekly, plays back as recorded;
 *     1 when it doesn't.
 *
 *   npx tsx tools/run-verify.ts --record <out.awrun> [--week N] [--bot skilled|novice]
 *     [--prelude --seed N]
 *     Plays a whole run with a bot through the run layer, recording it as the game would, and
 *     writes its replay (gzipped JSON; plain JSON if <out> ends in .json). A weekly of week N by
 *     default (week 44 if absent); --prelude records a Prelude with --seed instead. Prints its
 *     share code (weeklies only) and its sizes.
 */
import { readFileSync, statSync, writeFileSync } from 'node:fs';
import { gunzipSync, gzipSync } from 'node:zlib';
import { makeBot, type BotKind } from '../src/bots';
import { CONTENT } from '../src/content';
import { buildOutcome } from '../src/meta/outcome';
import { EVERYTHING, type Allowance } from '../src/meta/profile';
import * as Run from '../src/meta/run';
import {
  REPLAY_FILE_MAX_BYTES,
  REPLAY_JSON_MAX_BYTES,
  RunRecorder,
  allowanceRecord,
  applyStep,
  shareCodeOf,
  verifyRunReplay,
  type ChoiceStep,
  type RunReplay,
} from '../src/meta/runReplay';
import type { RunState } from '../src/meta/types';
import { weeklyStart } from '../src/meta/weekly';
import { ReplayRecorder, createSim } from '../src/sim';

/** The longest a bot fight runs, in sim seconds, before the recorder gives up on it. */
const MAX_FIGHT_SECONDS = 20 * 60;
/** The most steps a recorded run may take. */
const MAX_STEPS = 2000;

/**
 * Plays a run from `start` (just embarked) with a bot, through `applyStep` for every choice and
 * the sim for every fight, recording each as the game's run store would. Its choices: the map node
 * `seed mod options` (as the harness's `playRun`), the first draft (one reroll a run, when it can
 * pay), the first relic, the Calling's first option, a Respite's rest (the first one a retune to
 * the same Chords instead), the first affordable Merchant item once, a Forge's temper or cleanse,
 * an event's first choice it can make (with the run's first motif when it asks for one; never a
 * retune). Deterministic.
 */
export function recordBotRun(
  start: RunState,
  bot: BotKind = 'skilled',
  allowance: Allowance = EVERYTHING,
): { replay: RunReplay; run: RunState; ticks: number } {
  const rec = RunRecorder.begin(start);
  const allow = allowanceRecord(allowance);
  let run = start;
  let ticks = 0;
  let rerolled = false;
  let retuned = false;
  let shopped: string | null = null;
  const take = (s: ChoiceStep): boolean => {
    const next = applyStep(run, s);
    rec.step(s, run, next);
    const changed = next !== run;
    run = next;
    return changed;
  };
  for (let guard = 0; guard < MAX_STEPS && run.phase !== 'summary'; guard++) {
    switch (run.phase) {
      case 'map': {
        const options = Run.reachable(run);
        take({ k: 'node', id: options[run.seed % options.length]!.id });
        break;
      }
      case 'combat': {
        const config = Run.combatConfig(run, {
          perfectWindowBonus: 0,
          telegraphLead: 1,
          autonomy: false,
        })!;
        const sim = createSim(config);
        const recorder = new ReplayRecorder(sim.config);
        const player = makeBot(bot, config.seed);
        let ended = false;
        for (let t = 0; t < MAX_FIGHT_SECONDS * 60 && !ended; t++) {
          const tick = sim.tick;
          recorder.record(tick, sim.step(player.decide(sim.state)));
          const s = sim.state.encounter.status;
          ended = s === 'victory' || s === 'defeat';
        }
        ticks += sim.tick;
        // A fight the bot can't end: the run is given up, as a player would (a fight step must
        // end its fight, so it is not recorded).
        if (!ended) {
          take({ k: 'abandon' });
          break;
        }
        const fight = recorder.export(sim.tick, sim.hash());
        const outcome = buildOutcome(
          sim.state,
          sim.config.party.map((p) => p.heroId),
        );
        const next = Run.finishCombat(run, outcome);
        rec.fight(fight, outcome.outcome === 'victory', run, next);
        run = next;
        break;
      }
      case 'result':
        take({ k: 'continue' });
        break;
      case 'draft':
        if (!rerolled && take({ k: 'reroll' })) rerolled = true;
        else take({ k: 'draft', index: (run.draft?.options.length ?? 0) > 0 ? 0 : null });
        break;
      case 'relic':
        take({ k: 'relic', index: (run.relicOffer?.options.length ?? 0) > 0 ? 0 : null });
        break;
      case 'calling':
        take({ k: 'calling', index: 0, allowance: allow });
        break;
      case 'respite':
        if (!retuned && take({ k: 'retune', chords: run.chords, allowance: allow })) retuned = true;
        else take({ k: 'respite', choice: 'rest' });
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
        const curse = Run.forgeTargets(run, 'cleanse')[0];
        const motif = Run.forgeTargets(run, 'temper')[0];
        const used = run.forge?.used !== null;
        if (!used && curse)
          take({ k: 'forge', choice: { service: 'cleanse', relicId: curse }, allowance: allow });
        else if (!used && motif)
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
        throw new Error(`recordBotRun: unexpected phase ${run.phase}`);
    }
  }
  if (run.phase !== 'summary') throw new Error('recordBotRun: the run did not end');
  return { replay: rec.finish(run), run, ticks };
}

/** A replay file's bytes: gzipped JSON, as the game saves it. */
export function replayBytes(replay: RunReplay): Buffer {
  return gzipSync(Buffer.from(JSON.stringify(replay)));
}

/**
 * Reads a replay file, gzipped or plain JSON; null when it can't be read: not JSON, more than
 * `REPLAY_FILE_MAX_BYTES` on disk, or more than `REPLAY_JSON_MAX_BYTES` once inflated (the
 * inflating stops there), as the game reads one (`readReplayFile`).
 */
export function readReplay(path: string): unknown {
  try {
    if (statSync(path).size > REPLAY_FILE_MAX_BYTES) return null;
    const bytes = readFileSync(path);
    const text =
      bytes[0] === 0x1f && bytes[1] === 0x8b
        ? gunzipSync(bytes, { maxOutputLength: REPLAY_JSON_MAX_BYTES }).toString('utf8')
        : bytes.toString('utf8');
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function main(): void {
  const out = arg('--record');
  if (out) {
    const bot = (arg('--bot') ?? 'skilled') as BotKind;
    const week = Number(arg('--week') ?? 44);
    const start = process.argv.includes('--prelude')
      ? Run.embark(Run.newRun(Number(arg('--seed') ?? 2000)))
      : weeklyStart(week, { chords: Run.DEFAULT_CHORDS, techniques: {} });
    if (!start) {
      console.error(`week ${week}'s route can't be started here`);
      process.exit(2);
    }
    const t0 = performance.now();
    const { replay, ticks } = recordBotRun(start, bot);
    const ms = performance.now() - t0;
    const json = JSON.stringify(replay);
    const gz = replayBytes(replay);
    writeFileSync(out, out.endsWith('.json') ? json : gz);
    console.log(
      `${replay.kind}${replay.week !== undefined ? ` week ${replay.week}` : ''} · ${bot} · ${replay.claim.won ? 'won' : 'lost'} · ${replay.claim.fightsWon} fights won · ${replay.claim.score} points · ${replay.claim.seconds} s of fighting · ${ticks} ticks · ${replay.steps.length} steps`,
    );
    console.log(`recorded in ${(ms / 1000).toFixed(1)} s`);
    console.log(
      `size: ${(json.length / 1024).toFixed(1)} KB JSON, ${(gz.length / 1024).toFixed(1)} KB gzipped`,
    );
    if (replay.week !== undefined) console.log(`code: ${shareCodeOf(replay)}`);
    return;
  }
  const file = process.argv[2];
  if (!file || file.startsWith('--')) {
    console.error('usage: npx tsx tools/run-verify.ts <file.awrun> [share code]');
    process.exit(2);
  }
  const code = process.argv[3];
  const t0 = performance.now();
  const json = readReplay(file);
  const result = verifyRunReplay(json, code);
  const ms = performance.now() - t0;
  console.log(result.message);
  if (result.played)
    console.log(
      `plays to: ${result.played.won ? 'won' : 'lost'}, ${result.played.fightsWon} fights won, ${result.played.score} points, ${result.played.seconds} s, digest ${result.played.digest}`,
    );
  if (result.code) console.log(`code: ${result.code}`);
  console.log(
    `status ${result.status} · checked in ${(ms / 1000).toFixed(1)} s · ${(statSync(file).size / 1024).toFixed(1)} KB file`,
  );
  const good = ['verified', 'otherVersion', 'playsBack'];
  process.exit(good.includes(result.status) ? 0 : 1);
}

if (process.argv[1]?.endsWith('run-verify.ts')) main();
