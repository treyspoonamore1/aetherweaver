/**
 * Balance harness v1 (docs/plan/06 §2 Phase 1 exit): plays encounters with Idle / Novice /
 * Skilled bots across many seeds and reports win rates, durations, the Weaver's share of
 * party output and the go/no-go bands.
 *
 *   npx tsx tools/harness.ts --encounters first_light,tolling_halls --seeds 20
 *   npx tsx tools/harness.ts --movement 2 --seeds 50      # Movement II's fights, arrival kit
 *   npx tsx tools/harness.ts --movement 2 --kit bare      # …or bare, as Movement I is measured
 *   npx tsx tools/harness.ts --run --seeds 10             # whole Prelude runs (map, drafts, carry-over)
 *   npx tsx tools/harness.ts --run --movements 2          # whole Expeditions (docs/phase-5a.md)
 *   npx tsx tools/harness.ts --movement 2 --seed-base 500003   # another seed set (a check)
 *   npx tsx tools/harness.ts --party kael,vexis,brann --verbose    # a roster party (docs/phase-5b.md)
 *   npx tsx tools/harness.ts --party B --compare                    # party B, beside the default party
 *
 * The fight list comes from content by Movement (`--movement`, default 1: Movement I's nine
 * fights). Movement I's cells play bare (the loadout alone), Movement II's the arrival kit
 * (tools/kits.ts); `--kit` overrides it.
 *
 * `--party` plays a roster party (docs/phase-5b.md): 3 hero ids, or A (Kael, Vexis, Brann),
 * B (Lyra, Vexis, Brann) or C (Kael, Lyra, Brann). Without it the config has no `party` key, so
 * every default-party report keeps its baseline. `--compare` plays the default party beside it.
 */
import { writeFileSync } from 'node:fs';
import type { BotKind } from '../src/bots';
import { CONTENT, encounterDef } from '../src/content';
import { CHORD_PRESETS } from '../src/meta/run';
import type { ChordLoadout } from '../src/meta/types';
import { movementEncounters, playEncounter, playRun, type EncounterRun } from './harness-core';
import { defaultKit, kitById, kitConfig, presetChords, type Kit } from './kits';

interface Args {
  encounters: string[];
  bots: BotKind[];
  seeds: number;
  /** The loadout: `--loadout <preset>` or `--auras a,b` (one Chord, no ornaments). */
  chords: ChordLoadout[];
  label: string;
  json: string | null;
  verbose: boolean;
  /** The Movement whose fights it plays (`--movement`), and the kit they play with. */
  movement: number;
  kit: Kit;
  /** Whole runs: the route (`--movements`, 1 the Prelude). */
  movements: number;
  /** The first seed (`--seed-base`): fights 1000 + i × 7919, runs 2000 + i × 104729 by default. */
  seedBase: number | null;
  /** The party (`--party`), in content order; null: the default party (no `party` key). */
  party: string[] | null;
  /** `--compare`: play the default party beside `party`, for the bands' "≥ default − 5". */
  compare: boolean;
}

/** The roster parties the bands measure (docs/phase-5b.md, "Bands"). */
export const NAMED_PARTIES: Readonly<Record<string, readonly string[]>> = {
  A: ['kael', 'vexis', 'brann'],
  B: ['lyra', 'vexis', 'brann'],
  C: ['kael', 'lyra', 'brann'],
};

/**
 * `--party`'s value: A, B or C, or 3 distinct known hero ids, comma-separated; in content
 * order (the run's slot order). Undefined: null, the default party. Throws on anything else.
 */
export function partyArg(value: string | undefined): string[] | null {
  if (value === undefined) return null;
  const named = NAMED_PARTIES[value.toUpperCase()];
  const ids = named ? [...named] : value.split(',').filter(Boolean);
  const known = CONTENT.heroes.map((h) => h.id);
  const unknown = ids.filter((id) => !known.includes(id));
  if (unknown.length > 0) throw new Error(`Unknown hero "${unknown.join(',')}" (${known})`);
  if (ids.length !== 3 || new Set(ids).size !== 3)
    throw new Error(`A party is 3 distinct heroes, or A, B or C: "${value}"`);
  return known.filter((id) => ids.includes(id));
}

export function parseArgs(argv: string[]): Args {
  const get = (name: string) => {
    const i = argv.indexOf(`--${name}`);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const movement = Number(get('movement') ?? 1);
  const kit = kitById(get('kit') ?? defaultKit(movement));
  // The arrival kit brings its own preset unless a loadout is named; bare plays the old default.
  const named = get('loadout') !== undefined || get('auras') !== undefined;
  const loadout =
    kit.id === 'bare' || named
      ? loadoutArg(get('loadout'), get('auras'))
      : { chords: presetChords(kit.preset), label: `${kit.preset} (${kit.name})` };
  return {
    encounters: (get('encounters') ?? movementEncounters(movement).join(',')).split(','),
    bots: (get('bots') ?? 'idle,novice,skilled').split(',') as BotKind[],
    seeds: Number(get('seeds') ?? 10),
    ...loadout,
    json: get('json') ?? null,
    verbose: argv.includes('--verbose'),
    movement,
    kit,
    movements: Number(get('movements') ?? 1),
    seedBase: get('seed-base') === undefined ? null : Number(get('seed-base')),
    party: partyArg(get('party')),
    compare: argv.includes('--compare'),
  };
}

function loadoutArg(
  preset: string | undefined,
  auras: string | undefined,
): { chords: ChordLoadout[]; label: string } {
  if (preset) {
    const p = CHORD_PRESETS.find((x) => x.id === preset);
    if (!p) throw new Error(`Unknown loadout "${preset}" (${CHORD_PRESETS.map((x) => x.id)})`);
    return { chords: presetChords(preset), label: p.name };
  }
  const ids = (auras ?? 'sostenuto,fortissimo').split(',').filter(Boolean);
  return {
    chords: ids.length ? [{ auras: ids, ornaments: [] }] : [],
    label: ids.join('+') || 'none',
  };
}

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

/** `--calling luminary` and `--path 0101` (the option to take at each tier). */
const callingArg = ((): string | undefined => {
  const i = process.argv.indexOf('--calling');
  return i >= 0 ? process.argv[i + 1] : undefined;
})();
const pathArg = ((): (0 | 1)[] | undefined => {
  const i = process.argv.indexOf('--path');
  return i >= 0 ? [...(process.argv[i + 1] ?? '')].map((c) => (c === '1' ? 1 : 0)) : undefined;
})();

function runs(args: Args): void {
  const route = args.movements >= 2 ? `Expeditions (${args.movements} Movements)` : 'Prelude runs';
  console.log(
    `harness · whole ${route} · ${args.seeds} seeds · loadout ${args.label}${callingArg ? ` · ${callingArg} ${pathArg?.join('') ?? '0000'}` : ''}${args.party ? ` · party ${args.party.join(',')}` : ''}`,
  );
  for (const bot of args.bots) {
    const results = Array.from({ length: args.seeds }, (_, i) =>
      playRun((args.seedBase ?? 2000) + i * 104729, bot, args.chords, {
        relics: !process.argv.includes('--no-relics'),
        calling: callingArg,
        path: pathArg,
        movements: args.movements,
        ...(args.party ? { party: args.party } : {}),
      }),
    );
    const wins = results.filter((r) => r.outcome === 'victory').length;
    const endedAt: Record<string, number> = {};
    for (const r of results)
      if (r.outcome === 'defeat') endedAt[r.lastEncounter] = (endedAt[r.lastEncounter] ?? 0) + 1;
    const mean = (f: (r: (typeof results)[number]) => number) =>
      results.reduce((s, r) => s + f(r), 0) / results.length;
    let movementLine = '';
    if (args.movements >= 2) {
      const reached = Array.from(
        { length: args.movements - 1 },
        (_, k) =>
          `reach ${k + 2}: ${pct(results.filter((r) => r.movementReached >= k + 2).length / results.length)}`,
      );
      const split = Array.from({ length: args.movements }, (_, k) =>
        mean((r) => r.minutesByMovement[k] ?? 0).toFixed(1),
      );
      movementLine = ` · ${reached.join(' · ')} · combat min by Movement ${split.join(' / ')}`;
    }
    console.log(
      `${bot.padEnd(8)} win ${pct(wins / results.length).padStart(4)} · avg ${mean((r) => r.minutes).toFixed(1)} min of combat · ${mean((r) => r.fights).toFixed(1)} fights · ${mean((r) => r.relics.length).toFixed(1)} relics · Aether ${Math.round(mean((r) => r.aetherEarned))} earned, ${Math.round(mean((r) => r.aetherLeft))} left${movementLine} · lost at ${JSON.stringify(endedAt)}`,
    );
    const harmony = results.filter((r) => r.harmony);
    if (harmony.length > 0) {
      // Harmony reachability (docs/phase-5b.md, "Other gates"): offered ≥ 50% of the runs that
      // owned both its prerequisites; the overall rate is recorded with no target.
      const owned = harmony.filter((r) => r.harmony!.prereqsOwned);
      const offered = owned.filter((r) => r.harmony!.silkOfferedEligible > 0).length;
      console.log(
        `         Blood and Silk: offered in ${pct(harmony.filter((r) => r.harmony!.silkOffered > 0).length / harmony.length)} of runs · prerequisites owned in ${owned.length} · offered then in ${owned.length ? pct(offered / owned.length) : '-'} (band ≥50%)`,
      );
    }
    if (args.verbose)
      for (const r of results)
        console.log(
          `  ${r.seed} ${r.outcome.padEnd(7)} ${r.fights} fights · Movement ${r.movementReached} · relics ${r.relics.join(', ') || '—'} · motifs ${r.motifs.join(', ')}`,
        );
  }
}

/**
 * The difficulty contract's bands for a fight (docs/phase-1.md; Movement II: docs/phase-5a.md,
 * "Bands"), printed beside each row so a miss shows. Win rates and the Skilled bot's share.
 */
export function band(
  encounter: string,
  bot: BotKind,
  party: readonly string[] | null = null,
): string {
  const def = encounterDef(encounter);
  if (party?.includes('brann')) return brannBand(def.movement ?? 1, def.kind, bot, party);
  if ((def.movement ?? 1) < 2) return '';
  const kind = def.kind;
  const bands: Record<string, Record<BotKind, string>> = {
    skirmish: { idle: '≤15%', novice: '≥65%', skilled: '≥85% · share ≥35% · 35-60 s' },
    elite: { idle: '0%', novice: '35-75%', skilled: '≥85% · share ≥35% · 50-80 s' },
    miniboss: { idle: '0%', novice: '40-70%', skilled: '≥90% · share ≥35% · 60-110 s' },
    boss: { idle: '0%', novice: '35-65%', skilled: '≥85% · share ≥30% · 180-300 s' },
  };
  return bands[kind]?.[bot] ?? '';
}

/**
 * Brann's cells (docs/phase-5b.md, "Bands") for parties A, B and C: win and share against the
 * default party's cell (`--compare` prints it), the Novice and the Idle bot, and Brann's own
 * numbers from the tally (`--verbose`).
 */
function brannBand(movement: number, kind: string, bot: BotKind, party: readonly string[]): string {
  const noTank = !party.includes('kael');
  const big = kind === 'miniboss' || kind === 'boss';
  const own = '· Brann below 40% ≥40% of his time, ≤0.3 downs, lifesteal 20-45% of his healing';
  if (movement < 2) {
    if (big)
      return { idle: '0%', novice: '25-70%', skilled: `≥ default − 5 · share ≥30% ${own}` }[bot];
    return {
      idle: 'its Movement I band',
      novice: '≤ default, ≥ Idle + 30',
      skilled: `≥ default − 5 · share ≥35% ${own}`,
    }[bot];
  }
  if (!big)
    return {
      idle: 'as in 5a',
      novice: '5-20 pts under default',
      skilled: `≥ default − 5 · share ≥35% ${own} · ≤3 refused Rallies`,
    }[bot];
  if (noTank)
    return {
      idle: '0%',
      novice: '≥10%',
      skilled: '≥ default − 15 · share ≥30% · Twin Cleave on Brann survived ≥70%',
    }[bot];
  return {
    idle: '0%',
    novice: '20-60%',
    skilled: '≥ default − 5 · share ≥30% · Execution on Brann spared ≥80%',
  }[bot];
}

/** The tally line for a Brann party's runs (`--verbose`): his numbers, averaged a fight. */
function brannLine(runs: readonly EncounterRun[]): string | null {
  const tallies = runs.map((r) => r.brann).filter((b): b is NonNullable<typeof b> => !!b);
  if (tallies.length === 0) return null;
  const avg = (f: (b: (typeof tallies)[number]) => number) =>
    tallies.reduce((s, b) => s + f(b), 0) / tallies.length;
  return `   Brann: below 40% ${pct(avg((b) => b.lowShare40))} · below 30% ${pct(avg((b) => b.lowShare30))} · downs ${avg((b) => b.downs).toFixed(2)} · Weaver heal ${Math.round(avg((b) => b.weaverHealOn))} · Wards ${avg((b) => b.wardsOn).toFixed(1)} (Perfect ${avg((b) => b.perfectsOn).toFixed(1)}) · lifesteal ${Math.round(avg((b) => b.lifesteal))} (${pct(avg((b) => b.lifestealShare))} of his healing) · Blood and Silk ${avg((b) => b.silkResonance).toFixed(1)} · Deathless ${avg((b) => b.deathless).toFixed(1)} · Rallies refused ${avg((b) => b.refusedRallies).toFixed(1)} of ${avg((b) => b.rallies).toFixed(1)}`;
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  if (process.argv.includes('--run')) {
    runs(args);
    return;
  }
  const all: EncounterRun[] = [];
  const t0 = Date.now();
  const kit = kitConfig(args.kit, args.chords);
  console.log(
    `harness · ${args.seeds} seeds · loadout ${args.label}${args.kit.id === 'bare' || args.label.includes(args.kit.name) ? '' : ` · ${args.kit.name}`}${args.party ? ` · party ${args.party.join(',')}` : ''}`,
  );
  console.log(
    'encounter          bot      win   avg s   wave@loss  boss%@loss  share  perf  saves  downs',
  );
  for (const encounter of args.encounters) {
    for (const bot of args.bots) {
      const runs: EncounterRun[] = [];
      const defaults: EncounterRun[] = [];
      for (let i = 0; i < args.seeds; i++) {
        const seed = (args.seedBase ?? 1000) + i * 7919;
        // The party key only when one is asked for: a default party's config stays as it was.
        runs.push(
          playEncounter(
            { seed, encounter, ...kit, ...(args.party ? { party: args.party } : {}) },
            bot,
          ),
        );
        if (args.party && args.compare)
          defaults.push(playEncounter({ seed, encounter, ...kit }, bot));
      }
      all.push(...runs);
      const wins = runs.filter((r) => r.outcome === 'victory');
      const losses = runs.filter((r) => r.outcome !== 'victory');
      const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
      const waveAtLoss = losses.length ? avg(losses.map((r) => r.wave)).toFixed(1) : '-';
      const bossAtLoss =
        losses.length && losses[0]!.bossPct !== null
          ? pct(avg(losses.map((r) => r.bossPct ?? 0)))
          : '-';
      const versus =
        defaults.length > 0
          ? ` · default ${pct(defaults.filter((r) => r.outcome === 'victory').length / defaults.length)} win, share ${pct(avg(defaults.map((r) => r.share)))}`
          : '';
      const target = band(encounter, bot, args.party) + versus;
      console.log(
        [
          encounter.padEnd(18),
          bot.padEnd(8),
          pct(wins.length / runs.length).padStart(4),
          avg(runs.map((r) => r.duration))
            .toFixed(0)
            .padStart(7),
          String(waveAtLoss).padStart(10),
          String(bossAtLoss).padStart(11),
          pct(avg(runs.map((r) => r.share))).padStart(6),
          avg(runs.map((r) => r.perfects))
            .toFixed(1)
            .padStart(5),
          avg(runs.map((r) => r.saves))
            .toFixed(1)
            .padStart(6),
          avg(runs.map((r) => r.downs))
            .toFixed(1)
            .padStart(6),
          ...(target ? [`  band ${target}`] : []),
        ].join(' '),
      );
      if (args.verbose) {
        const k = (f: (r: EncounterRun) => number) => Math.round(avg(runs.map(f)));
        console.log(
          `   heroDmg ${k((r) => r.partyDamage - r.amplified)} amp ${k((r) => r.amplified)} heal ${k((r) => r.healing)} shield ${k((r) => r.shielded)} negated ${k((r) => r.negated)} incoming ${k((r) => r.incoming)}`,
        );
        if ((encounterDef(encounter).movement ?? 1) >= 2) {
          const cleanses = runs.flatMap((r) => r.bleedCleanses);
          const guard = runs.filter((r) => r.guardBlockedPct !== null);
          const pools = runs.filter((r) => r.timeInSanctuary !== null);
          const casts = runs.reduce((s, r) => s + r.executeCasts, 0);
          console.log(
            `   pins freed ${avg(runs.map((r) => r.pinsFreed)).toFixed(1)} · bleed cleanses ${(cleanses.length / runs.length).toFixed(1)} at ${avg(cleanses).toFixed(1)} stacks · pact blasts ${avg(runs.map((r) => r.pactBlasts)).toFixed(1)} · guard blocked ${guard.length ? pct(avg(guard.map((r) => r.guardBlockedPct!))) : '-'} · executions ${runs.reduce((s, r) => s + r.executions, 0)}/${casts} · in Sanctuary ${pools.length ? pct(avg(pools.map((r) => r.timeInSanctuary!))) : '-'}`,
          );
        }
        const line = brannLine(runs);
        if (line) console.log(line);
      }
    }
  }
  console.log(`done in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  if (args.json) {
    writeFileSync(args.json, JSON.stringify(all, null, 2));
  }
}

if (process.argv[1]?.endsWith('harness.ts')) main();
