/**
 * Loadout report (docs/plan/06 Phase 2 exit, "build diversity"): plays every Chord preset
 * against every encounter with each bot, and flags loadouts that miss the difficulty contract
 * (dead) or beat every other loadout everywhere (dominant).
 *
 *   npx tsx tools/loadouts.ts --seeds 20 --bots skilled,novice --runs 10 --md docs/phase-2/loadouts.md
 *   npx tsx tools/loadouts.ts --movement 2 --seeds 20    # Movement II's fights, on the arrival kit
 *   npx tsx tools/loadouts.ts --movement 3 --seeds 20    # Movement III's, on ARRIVAL3_KIT
 *   npx tsx tools/loadouts.ts --movement 4 --seeds 50 --runs 30 --bots skilled   # five viable builds
 *   npx tsx tools/loadouts.ts --movement 4 --seeds 50 --runs 30 --bots skilled --sets   # all 3 sets
 *   npx tsx tools/loadouts.ts --seed-base 500003 --run-seed-base 900007   # another seed set
 *
 * Movement I's cells play bare; later Movements' play each preset with their kit's motifs and
 * relics (tools/kits.ts: the arrival kit, ARRIVAL3_KIT, ARRIVAL4_KIT), against their floors
 * (docs/phase-5a.md, docs/phase-5c.md and docs/phase-5d.md, "Bands"). `--runs` plays whole runs
 * on the Movement's route (Movement II: I-II Expeditions; Movement III: I-III; the Finale: the
 * Finale route).
 *
 * The Finale's viable-build report (docs/phase-5d.md, "Five viable builds"; 06:123): per-cell
 * floors can't be met on Movement II-III fights that this slice can't retune, so a preset is
 * viable on whole runs plus the Conductor's cell: its Finale-route Expeditions won ≥ 50% and its
 * Conductor cell ≥ 80% (Skilled). The band is at least 5 of the 6 presets. It is printed for the
 * Skilled bot with `--movement 4 --runs N`.
 *
 * Seeds: cells play `--seed-base` + i × 7919 (1000 by default), whole runs `--run-seed-base` +
 * i × 104729 (2000). `--sets` plays the doc's three sets in turn (FINALE_SEED_SETS: cells on
 * 1000 / 500003 / 777001, runs on 2000 / 900007 / 333003), a report each, and then the builds
 * viable on all three: the band is 'Met' only there.
 */
import { writeFileSync } from 'node:fs';
import type { BotKind } from '../src/bots';
import { encounterDef } from '../src/content';
import { CONDUCTOR, FINALE_MOVEMENT } from '../src/content/crucibleIds';
import { CHORD_PRESETS } from '../src/meta/run';
import {
  FINALE_SEED_SETS,
  movementEncounters,
  onEverySet,
  playEncounter,
  playRun,
} from './harness-core';
import { defaultKit, kitById, kitConfig } from './kits';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const movement = Number(arg('movement') ?? 1);
const kit = kitById(arg('kit') ?? defaultKit(movement));
const ENCOUNTERS = movementEncounters(movement);
const SHORT: Record<string, string> = {
  first_light: 'First',
  tolling_halls: 'Tolling',
  glass_gallery: 'Glass',
  choir_loft: 'Loft',
  mourning_steps: 'Steps',
  muted_nave: 'Nave*',
  shattered_choir: 'Shatter*',
  bellwarden: 'Bell**',
  hollow_cantor: 'Cantor**',
  crimson_gate: 'Gate',
  blood_rites: 'Rites',
  pike_line: 'Pikes',
  red_muster: 'Muster',
  leech_warren: 'Warren',
  shield_wall: 'Wall*',
  blood_forge: 'Forge*',
  gorehound_matriarch: 'Matriarch**',
  vharun: 'Vharun**',
  frayed_threshold: 'Threshold',
  maw_hollow: 'Maw',
  wraith_vigil: 'Vigil',
  null_chapel: 'Chapel',
  mirror_hall: 'Mirror',
  frayed_court: 'Court*',
  the_seamstress: 'Seamstress**',
  the_unweaver: 'Unweaver**',
  the_silent_conductor: 'Conductor**',
};
/**
 * Skilled-bot floors from the difficulty contract (docs/phase-1.md; Movement II's from
 * docs/phase-5a.md: skirmishes and elites 85%, the Matriarch 90%, Vharun 85%; Movement III's from
 * docs/phase-5c.md: the same, but the Unweaver 80%; the Finale's from docs/phase-5d.md: the
 * Silent Conductor 80%).
 */
function floor(encounter: string): number {
  const def = encounterDef(encounter);
  if ((def.movement ?? 1) >= FINALE_MOVEMENT) return 0.8;
  if ((def.movement ?? 1) >= 3 && def.kind === 'boss') return 0.8;
  if ((def.movement ?? 1) >= 2) return def.kind === 'miniboss' ? 0.9 : 0.85;
  if (encounter === 'first_light') return 1;
  if (encounter === 'muted_nave' || encounter === 'shattered_choir') return 0.9;
  if (encounter === 'bellwarden' || encounter === 'hollow_cantor') return 0.9;
  return 0.8;
}

const seeds = Number(arg('seeds') ?? 20);
const runsN = Number(arg('runs') ?? 0);
const bots = (arg('bots') ?? 'skilled,novice').split(',') as BotKind[];
const only = arg('loadouts')?.split(',');
const sets = process.argv.includes('--sets')
  ? FINALE_SEED_SETS
  : [{ cells: Number(arg('seed-base') ?? 1000), runs: Number(arg('run-seed-base') ?? 2000) }];
const presets = CHORD_PRESETS.filter((p) => !only || only.includes(p.id));
const pct = (v: number) => `${Math.round(v * 100)}%`;

/** The Finale's viable build: whole runs won at least this often, and the Conductor's cell. */
const VIABLE_RUNS = 0.5;
const VIABLE_CELL = 0.8;
const VIABLE_BAND = 5;

const lines: string[] = [];
const out = (line = '') => {
  console.log(line);
  lines.push(line);
};

const t0 = Date.now();
out(`# Loadout report`);
out();
out(
  `${movement >= 2 ? `Movement ${movement}, ${kit.name}. ` : ''}${seeds} seeds per cell${runsN ? `, ${runsN} whole ${movement >= 2 ? 'Expeditions' : 'Prelude runs'} per loadout` : ''}. * elite, ** boss.`,
);
/** Each set's viable builds (Skilled, the Finale, with `--runs`), by preset id. */
const viableBySet: string[][] = [];
for (const [k, set] of sets.entries()) {
  if (sets.length > 1) {
    out();
    out(`## Set ${k + 1} of ${sets.length}: cells from ${set.cells}, runs from ${set.runs}`);
  }
  const viable = report(set.cells, set.runs, sets.length > 1 ? '###' : '##');
  if (viable) viableBySet.push(viable);
}
if (sets.length > 1 && viableBySet.length === sets.length) {
  const all = onEverySet(viableBySet);
  const names = presets.filter((p) => all.includes(p.id)).map((p) => p.name);
  out();
  out(
    `Viable on all ${sets.length} sets: ${all.length} of ${presets.length} (band ≥${VIABLE_BAND} of 6) · ${all.length >= VIABLE_BAND ? 'Met' : 'not met'}${names.length ? ` · ${names.join(', ')}` : ''}`,
  );
}

/**
 * One set's report: cells from `cellBase` + i × 7919, whole runs from `runBase` + i × 104729.
 * Returns the Skilled bot's viable builds when the Finale's report was printed, else null.
 */
function report(cellBase: number, runBase: number, heading: string): string[] | null {
  let viableIds: string[] | null = null;
  for (const bot of bots) {
    out();
    out(`${heading} ${bot}`);
    out();
    out(
      `| Loadout | ${ENCOUNTERS.map((e) => SHORT[e]).join(' | ')} | Share | Calls answered |${runsN ? ' Runs |' : ''}`,
    );
    out(`|---|${ENCOUNTERS.map(() => '---').join('|')}|---|---|${runsN ? '---|' : ''}`);
    const table: Record<string, number[]> = {};
    /** Whole-run win rates by preset (with `--runs`), for the viable-build report. */
    const runRates: Record<string, number> = {};
    for (const p of presets) {
      const rates: number[] = [];
      let share = 0;
      let calls = 0;
      let answered = 0;
      let n = 0;
      for (const encounter of ENCOUNTERS) {
        let wins = 0;
        for (let i = 0; i < seeds; i++) {
          const r = playEncounter(
            kit.id === 'bare'
              ? { seed: cellBase + i * 7919, encounter, chords: p.chords.map((c) => ({ ...c })) }
              : { seed: cellBase + i * 7919, encounter, ...kitConfig(kit, p.chords) },
            bot,
          );
          if (r.outcome === 'victory') wins++;
          share += r.share;
          calls += r.calls;
          answered += r.responses;
          n++;
        }
        rates.push(wins / seeds);
      }
      table[p.id] = rates;
      let runCell = '';
      if (runsN) {
        let wins = 0;
        for (let i = 0; i < runsN; i++)
          if (
            playRun(runBase + i * 104729, bot, p.chords, { movements: movement }).outcome ===
            'victory'
          )
            wins++;
        runCell = ` ${pct(wins / runsN)} |`;
        runRates[p.id] = wins / runsN;
      }
      const flags =
        bot === 'skilled'
          ? ENCOUNTERS.filter((e, i) => rates[i]! < floor(e)).map((e) => SHORT[e])
          : [];
      out(
        `| ${p.name}${flags.length ? ` ⚠ ${flags.join(', ')}` : ''} | ${rates.map(pct).join(' | ')} | ${pct(share / n)} | ${calls > 0 ? pct(answered / calls) : '—'} |${runCell}`,
      );
    }
    // Dominance: one loadout at least as good everywhere and better in total by 10 points.
    for (const a of presets) {
      const ra = table[a.id]!;
      const dominates = presets.every((b) => {
        if (b.id === a.id) return true;
        const rb = table[b.id]!;
        const total = ra.reduce((s, v, i) => s + v - rb[i]!, 0);
        return ra.every((v, i) => v >= rb[i]!) && total >= 0.1 * ENCOUNTERS.length;
      });
      if (dominates && presets.length > 1)
        out(`\n⚠ **${a.name}** dominates every other loadout for ${bot}.`);
    }
    // The Finale's five viable builds (docs/phase-5d.md): whole Finale-route runs and the
    // Conductor's cell, Skilled.
    const cell = ENCOUNTERS.indexOf(CONDUCTOR);
    if (bot === 'skilled' && movement >= FINALE_MOVEMENT && runsN > 0 && cell >= 0) {
      const viable = presets.filter(
        (p) => runRates[p.id]! >= VIABLE_RUNS && table[p.id]![cell]! >= VIABLE_CELL,
      );
      viableIds = viable.map((p) => p.id);
      out();
      out(
        `Viable builds (whole Finale-route Expedition ≥${pct(VIABLE_RUNS)} and the Conductor ≥${pct(VIABLE_CELL)}): ${viable.length} of ${presets.length} (band ≥${VIABLE_BAND} of 6)${viable.length ? ` · ${viable.map((p) => p.name).join(', ')}` : ''}`,
      );
    }
  }
  return viableIds;
}
out();
out(`_Generated by \`tools/loadouts.ts\` in ${((Date.now() - t0) / 1000).toFixed(0)} s._`);
const md = arg('md');
if (md) writeFileSync(md, lines.join('\n') + '\n');
