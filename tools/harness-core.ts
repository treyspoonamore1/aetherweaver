/** Plays one encounter with a bot, headlessly. Shared by the harness CLI and tests. */
import { buildOutcome } from '../src/app/outcome';
import { makeBot, type BotKind } from '../src/bots';
import * as Run from '../src/meta/run';
import type { ChordLoadout } from '../src/meta/types';
import { weaverShare } from '../src/meta/run';
import { createSim, type SimConfig } from '../src/sim';

export interface EncounterRun {
  encounter: string;
  bot: BotKind;
  seed: number;
  outcome: 'victory' | 'defeat' | 'timeout';
  duration: number;
  wave: number;
  waves: number;
  bossPct: number | null;
  share: number;
  perfects: number;
  saves: number;
  downs: number;
  partyDamage: number;
  healing: number;
  shielded: number;
  negated: number;
  amplified: number;
  incoming: number;
}

const MAX_SECONDS = 9 * 60;

export function playEncounter(config: SimConfig, bot: BotKind): EncounterRun {
  const sim = createSim(config);
  const player = makeBot(bot, config.seed);
  const maxTicks = MAX_SECONDS * 60;
  let incoming = 0;
  for (let t = 0; t < maxTicks; t++) {
    sim.step(player.decide(sim.state));
    for (const e of sim.drainEvents()) {
      if (e.type === 'damageTaken' && sim.state.party.includes(e.target))
        incoming += e.amount + e.absorbed;
    }
    const s = sim.state.encounter.status;
    if (s === 'victory' || s === 'defeat') break;
  }
  const state = sim.state;
  const l = state.ledger;
  const boss =
    state.encounter.bossId === null ? undefined : state.entities.get(state.encounter.bossId);
  const status = state.encounter.status;
  return {
    encounter: state.encounter.id,
    bot,
    seed: config.seed,
    outcome: status === 'victory' ? 'victory' : status === 'defeat' ? 'defeat' : 'timeout',
    duration: (state.encounter.endedAt ?? state.time) - state.encounter.startedAt,
    wave: state.encounter.wave,
    waves: state.encounter.waves,
    bossPct: boss?.health
      ? boss.health.hp / boss.health.maxHp
      : state.encounter.bossId === null
        ? null
        : 0,
    share: weaverShare(l),
    perfects: l.perfects,
    saves: l.saves.length,
    downs: l.downs,
    partyDamage: l.partyDamage,
    healing: l.healing,
    shielded: l.shielded,
    negated: l.negated,
    amplified: l.amplified,
    incoming: incoming,
  };
}

export interface RunSummary {
  seed: number;
  bot: BotKind;
  outcome: 'victory' | 'defeat';
  /** Encounter where the run ended (or the boss). */
  lastEncounter: string;
  fights: number;
  minutes: number;
  motifs: string[];
}

/** Plays a whole Prelude run: map choices, fights, drafts (first option), respites (rest). */
export function playRun(
  seed: number,
  bot: BotKind,
  chords: readonly ChordLoadout[] = Run.DEFAULT_CHORDS,
): RunSummary {
  let run = Run.embark(Run.setChords(Run.newRun(seed), chords));
  let seconds = 0;
  let last = '';
  for (let guard = 0; guard < 60 && run.phase !== 'summary'; guard++) {
    switch (run.phase) {
      case 'map': {
        const options = Run.reachable(run);
        // Prefer fights early (more motifs), otherwise the first option.
        run = Run.chooseNode(run, options[seed % options.length]!.id);
        break;
      }
      case 'combat': {
        const config = Run.combatConfig(run)!;
        const sim = createSim(config);
        const player = makeBot(bot, config.seed);
        for (let t = 0; t < MAX_SECONDS * 60; t++) {
          sim.step(player.decide(sim.state));
          sim.drainEvents();
          const s = sim.state.encounter.status;
          if (s === 'victory' || s === 'defeat') break;
        }
        last = config.encounter ?? '';
        seconds += sim.state.time;
        run = Run.finishCombat(
          run,
          buildOutcome(
            sim.state,
            sim.config.party.map((p) => p.heroId),
          ),
        );
        break;
      }
      case 'result':
        run = Run.continueFromResult(run);
        break;
      case 'draft':
        run = Run.pickDraft(run, run.draft && run.draft.options.length > 0 ? 0 : null);
        break;
      case 'respite':
        run = Run.respite(run, 'rest');
        break;
      default:
        throw new Error(`unexpected phase ${run.phase}`);
    }
  }
  return {
    seed,
    bot,
    outcome: run.outcome === 'victory' ? 'victory' : 'defeat',
    lastEncounter: last,
    fights: run.results.length,
    minutes: seconds / 60,
    motifs: run.motifs.map((m) => `${m.id}:${m.level}`),
  };
}
