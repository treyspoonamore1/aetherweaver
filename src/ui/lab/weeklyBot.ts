/**
 * A whole run played by a bot through the run functions and recorded as the game records it
 * (docs/phase-6.md, "Tests": "same browser, bit for bit"), for the UI lab's weekly bench and its
 * page-side worker. Every choice goes through `applyStep`, every fight through the sim with the
 * run's own config, so the replay is the one a player's run would make.
 *
 * Its choices follow `tools/run-verify.ts`'s `recordBotRun` (which the browser can't import: it
 * reads and writes files): the map node `seed mod options`, the first draft (one reroll a run),
 * the first relic, the Calling's first option, a Respite's rest (the first one a retune to the
 * same Chords), the first affordable Merchant item once, a Forge's temper or cleanse, an event's
 * first choice it can make (never a retune). Deterministic.
 */
import { makeBot, type BotKind } from '../../bots';
import { CONTENT } from '../../content';
import { buildOutcome } from '../../meta/outcome';
import { EVERYTHING } from '../../meta/profile';
import * as Run from '../../meta/run';
import {
  RunRecorder,
  allowanceRecord,
  applyStep,
  type ChoiceStep,
  type RunReplay,
} from '../../meta/runReplay';
import type { RunState } from '../../meta/types';
import { weeklyStart } from '../../meta/weekly';
import { ReplayRecorder, createSim } from '../../sim';

/** The longest a bot fight runs, in sim seconds. */
const MAX_FIGHT_SECONDS = 20 * 60;
/** The most steps a run may take. */
const MAX_STEPS = 2000;

/** Plays `start` (just embarked) to its Summary with a bot, recording it. */
export function playRecorded(
  start: RunState,
  bot: BotKind = 'skilled',
): { replay: RunReplay; ticks: number } {
  const rec = RunRecorder.begin(start);
  const allow = allowanceRecord(EVERYTHING);
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
        for (let t = 0; t < MAX_FIGHT_SECONDS * 60; t++) {
          const tick = sim.tick;
          recorder.record(tick, sim.step(player.decide(sim.state)));
          const s = sim.state.encounter.status;
          if (s === 'victory' || s === 'defeat') break;
        }
        ticks += sim.tick;
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
        throw new Error(`weekly bench: unexpected phase ${run.phase}`);
    }
  }
  if (run.phase !== 'summary') throw new Error('weekly bench: the run did not end');
  return { replay: rec.finish(run), ticks };
}

/** This week's run, as the weekly starts it (the default Chords, no variants), played through. */
export function playWeekly(
  week: number,
  bot: BotKind = 'skilled',
): { replay: RunReplay; ticks: number } {
  const start = weeklyStart(week, { chords: Run.DEFAULT_CHORDS, techniques: {} });
  if (!start) throw new Error(`week ${week} can't be started`);
  return playRecorded(start, bot);
}

/** A Prelude (seeded), played through: the quick check. */
export function playPrelude(seed: number, bot: BotKind = 'skilled') {
  return playRecorded(Run.embark(Run.newRun(seed)), bot);
}
