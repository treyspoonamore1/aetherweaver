/** Plays one encounter with a bot, headlessly. Shared by the harness CLI and tests. */
import { buildOutcome } from '../src/app/outcome';
import { CONTENT, callingOption, runEventDef } from '../src/content';
import { makeBot, type BotKind } from '../src/bots';
import * as Run from '../src/meta/run';
import type { ChordLoadout, RunState } from '../src/meta/types';
import { weaverShare } from '../src/meta/run';
import { chordReserve, createSim, type SimConfig } from '../src/sim';

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
  calls: number;
  responses: number;
  holds: number;
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
    calls: l.calls,
    responses: l.responses,
    holds: l.holds,
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
  relics: string[];
  /** The Calling's path options taken. */
  path: string[];
  /** Aether earned over the run, and what was left at the end. */
  aetherEarned: number;
  aetherLeft: number;
}

/**
 * The harness's shopping list (docs/phase-3b.md): relics first, the dearest it can afford,
 * then motifs; healing when the party is hurt. Deterministic, not clever.
 */
function shop(run: RunState, relics: boolean): RunState {
  for (let guard = 0; guard < 8; guard++) {
    const items = run.shop?.items ?? [];
    const hurt = run.party.reduce((s, h) => s + h.hpPct, 0) / Math.max(1, run.party.length) < 0.6;
    const want = items
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => !item.sold && item.price <= run.aether)
      .filter(({ item }) => item.kind !== 'heal' || hurt)
      .filter(({ item }) => relics || item.kind !== 'relic')
      .sort(
        (a, b) =>
          (a.item.kind === 'relic' ? 0 : a.item.kind === 'heal' ? 1 : 2) -
            (b.item.kind === 'relic' ? 0 : b.item.kind === 'heal' ? 1 : 2) ||
          b.item.price - a.item.price,
      )[0];
    if (!want) break;
    run = Run.buy(run, want.index);
  }
  return Run.leaveShop(run);
}

/** Lift a curse if there is one, else temper the first motif that can grow. */
function forge(run: RunState): RunState {
  const curse = Run.forgeTargets(run, 'cleanse')[0];
  const motif = Run.forgeTargets(run, 'temper')[0];
  if (curse) run = Run.forge(run, { service: 'cleanse', relicId: curse });
  else if (motif) run = Run.forge(run, { service: 'temper', motifId: motif });
  return Run.leaveForge(run);
}

/** The first choice it can make without picking a motif or new Chords (or a relic, if off). */
function event(run: RunState, relics: boolean): RunState {
  if (run.event && run.event.choice === null) {
    const def = runEventDef(run.event.eventId);
    const choice = def.choices.find(
      (c) =>
        c.motif === 'none' &&
        !c.effects.some((e) => e.kind === 'retune') &&
        (relics ||
          ![...c.effects, ...c.fail].some((e) => e.kind === 'relic' || e.kind === 'fight')) &&
        Run.eventChoiceProblem(run, c.id) === null,
    );
    if (choice) run = Run.chooseEvent(run, choice.id);
  }
  return run.phase === 'event' ? Run.leaveEvent(run) : run;
}

/** The most Spirit the bots will reserve when they fill a free slot (the presets reserve 55–73%). */
const MAX_RESERVE = 0.75;

/**
 * Third Voice's free retune: a third aura in a field song that already has two (the slot it
 * grants), the cheapest that stays legal and within `MAX_RESERVE`, with Grace Note on the field
 * song if that's what makes it fit. The bots never retune otherwise, so they don't fill slots
 * they already had. Undefined when nothing fits: the bot keeps its songs.
 */
function withAnotherAura(run: RunState, option: string): ChordLoadout[] | undefined {
  const path = run.calling!.path.map((p, i) => (i === run.callingOffer!.tier ? option : p));
  const slots = Run.fieldAuraSlots({ ...run, calling: { ...run.calling!, path } });
  if ((run.chords[1]?.auras.length ?? 0) < CONTENT.weaver.auraSlots) return undefined;
  const used = new Set(run.chords.flatMap((c) => c.auras));
  const base = run.chords.map((c) => ({ auras: [...c.auras], ornaments: [...c.ornaments] }));
  const variants = [base];
  const field = base[1]!;
  if (
    !base.some((c) => c.ornaments.includes('grace_note')) &&
    field.ornaments.length < CONTENT.weaver.ornamentSlots
  )
    variants.push(
      base.map((c, i) => (i === 1 ? { ...c, ornaments: [...c.ornaments, 'grace_note'] } : c)),
    );
  const auras = CONTENT.auras.filter((a) => !used.has(a.id)).sort((a, b) => a.reserve - b.reserve);
  for (const v of variants)
    for (const aura of auras) {
      const chords = v.map((c, i) => (i === 1 ? { ...c, auras: [...c.auras, aura.id] } : c));
      if (Run.chordsLegal(chords, slots) && chordReserve(chords) <= MAX_RESERVE) return chords;
    }
  return undefined;
}

/** Plays a whole Prelude run: map choices, fights, drafts (first option), respites (rest). */
export function playRun(
  seed: number,
  bot: BotKind,
  chords: readonly ChordLoadout[] = Run.DEFAULT_CHORDS,
  opts: {
    relics?: boolean;
    /** A Calling for the run (docs/phase-3c.md), and which option to take at each tier. */
    calling?: string;
    path?: readonly (0 | 1)[];
    /** The Astrolabe tree the run embarks with (docs/phase-4.md). */
    astrolabe?: readonly string[];
    /** Calibration: every fight's enemies have this much more life (1.15: 15% more). */
    threatMult?: number;
    /** Called with the finished run (the Deeds report reads it). */
    onEnd?: (run: RunState) => void;
  } = {},
): RunSummary {
  const relics = opts.relics ?? true;
  let run = Run.embark(
    Run.setCalling(
      Run.setChords(Run.newRun(seed, undefined, opts.astrolabe ?? []), chords),
      opts.calling ?? null,
    ),
  );
  let seconds = 0;
  let last = '';
  for (let guard = 0; guard < 120 && run.phase !== 'summary'; guard++) {
    switch (run.phase) {
      case 'map': {
        const options = Run.reachable(run);
        // Prefer fights early (more motifs), otherwise the first option.
        run = Run.chooseNode(run, options[seed % options.length]!.id);
        break;
      }
      case 'combat': {
        const config = Run.combatConfig(run)!;
        // Calibration: THREAT_PER_ROW=0.05 overrides the run's Threat curve.
        const perRow = process.env.THREAT_PER_ROW;
        if (perRow !== undefined) {
          const row = Run.findNode(run, run.pending!)!.row;
          config.threat = 1 + Number(perRow) * Math.max(0, row - 1);
        }
        if (opts.threatMult) config.threat = (config.threat ?? 1) * opts.threatMult;
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
      case 'calling': {
        const tier = run.callingOffer!.tier;
        const index = opts.path?.[tier] ?? 0;
        const option = callingOption(run.callingOffer!.options[index]!);
        // An option that grants a slot (Third Voice): fill it, if any aura fits.
        const filled = option.values.slots ? withAnotherAura(run, option.id) : undefined;
        run = Run.pickCalling(run, index, filled);
        break;
      }
      case 'relic':
        run = Run.pickRelic(run, relics ? 0 : null);
        break;
      case 'merchant':
        run = shop(run, relics);
        break;
      case 'forge':
        run = forge(run);
        break;
      case 'event':
        run = event(run, relics);
        break;
      default:
        throw new Error(`unexpected phase ${run.phase}`);
    }
  }
  opts.onEnd?.(run);
  return {
    seed,
    bot,
    outcome: run.outcome === 'victory' ? 'victory' : 'defeat',
    lastEncounter: last,
    fights: run.results.length,
    minutes: seconds / 60,
    motifs: run.motifs.map((m) => `${m.id}:${m.level}`),
    relics: run.relics.map((r) => (r.cleansed ? `${r.id}*` : r.id)),
    path: run.calling?.path.filter((p): p is string => p !== null) ?? [],
    aetherEarned: run.results.reduce((s, r) => s + r.aether, 0),
    aetherLeft: run.aether,
  };
}
