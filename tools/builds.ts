/**
 * The six builds (docs/phase-5g.md, "The six builds"): each plays whole Expeditions with its
 * Calling and path, party and Chords, and drafts its motifs (then its relics) first, so the
 * report can say how often a build wins, and how often it comes together.
 *
 *   npx tsx tools/builds.ts --seeds 2                    # 2 runs a build, Skilled, the Finale route
 *   npx tsx tools/builds.ts --runs 30 --sets             # the Bands' archetype report, all 3 sets
 *   npx tsx tools/builds.ts --seeds 20 --bot novice --movements 2
 *   npx tsx tools/builds.ts --builds CS,RD --run-seed-base 900007
 *
 * A build is a preset (`BUILDS`): `draftPrefer` is the doc's "Drafts first" list in its order
 * (an offered option nearest the front of the list; none on offer: the harness's first option),
 * `relicPrefer` the relics whose "Builds" column names the build, then those that serve every
 * build. An id that `CONTENT` doesn't hold yet is skipped with one line on stderr, so the tool
 * runs before the content merges (preferring nothing) and fully after. Whole runs are played by
 * `playRun`; the rest of a run (map, fights, respites, shops, events) is the harness's own.
 *
 * Per build: wins, runs that reached the last Movement, wins ÷ reached, how many of the build's
 * listed motifs the run held at its end (and how often 3 or more: "came together"), and the
 * trigger fire rates of what it held. Seeds: `--run-seed-base` + i × 104729 (2000 by default);
 * `--sets` plays the doc's three sets in turn (FINALE_SEED_SETS), then the builds viable on all.
 * The band (Bands, "Five viable archetypes"): at least 5 of 6 builds win ≥ 50% of whole Finale
 * route Expeditions on all three sets, each holds ≥ 3 of its listed motifs by the Finale in
 * ≥ 60% of its runs, and none wins more than 15 points above the median build.
 */
import type { BotKind } from '../src/bots';
import { CONTENT, callingDef } from '../src/content';
import { CHORD_PRESETS } from '../src/meta/run';
import type { ChordLoadout } from '../src/meta/types';
import { FINALE_SEED_SETS, knownIds, onEverySet, playRun, type RunSummary } from './harness-core';
import { NAMED_PARTIES } from './harness';

/** A build's definition: a Calling and its path, a party, Chords, and what it drafts first. */
export interface BuildPreset {
  /** The doc's code: CS, PP, BS, RL, MA, RD. */
  code: string;
  name: string;
  /** The Calling's id (null: none) and the option taken at each tier, by id. */
  calling: string | null;
  path: readonly string[];
  party: readonly string[];
  /** A `CHORD_PRESETS` id. */
  chords: string;
  /** Motif ids, in the doc's order. */
  draftPrefer: readonly string[];
  /** Relic ids: the new relics that name this build, then those that serve every build. */
  relicPrefer: readonly string[];
}

const DEFAULT_PARTY = ['kael', 'lyra', 'vexis'] as const;
/** Relics the doc says serve every build (its "Builds" column reads "all"). */
const EVERY_BUILD = ['pilgrims_lamp', 'black_ribbon', 'menders_needle', 'water_clock'] as const;

export const BUILDS: readonly BuildPreset[] = [
  {
    code: 'CS',
    name: 'Choir Sovereign',
    calling: 'luminary',
    path: ['wide_choir', 'dawnward', 'third_voice', 'sovereign_symphony'],
    party: DEFAULT_PARTY,
    chords: 'anchor',
    draftPrefer: [
      'massed_voices',
      'close_harmony',
      'full_chord',
      'breath_between',
      'long_phrase',
      'stray_stitch',
      'closed_circle',
    ],
    relicPrefer: ['bell_clapper', ...EVERY_BUILD, 'iron_mask'],
  },
  {
    code: 'PP',
    name: 'Perfect Pitch',
    calling: 'chronomancer',
    path: ['foresight', 'echo_ward', 'temporal_mastery', 'eternal_moment'],
    party: DEFAULT_PARTY,
    chords: 'bastion',
    draftPrefer: [
      'steady_hands',
      'thread_the_needle',
      'riposte_bloom',
      'tender_guard',
      'clean_strike',
      'ringing_steel',
      'shatterglass',
      'concert_pitch',
    ],
    relicPrefer: [
      'echoing_shell',
      'sand_glass',
      'prompt_book',
      'everbell',
      'bell_clapper',
      ...EVERY_BUILD,
      'red_ink',
    ],
  },
  {
    code: 'BS',
    name: 'Bleeding Saint',
    calling: 'martyr',
    path: ['penitence', 'blood_font', 'undying_devotion', 'sanguine_covenant'],
    party: DEFAULT_PARTY,
    chords: 'guardian',
    draftPrefer: [
      'kindred_wound',
      'last_bastion',
      'vigil_song',
      'saving_grace',
      'breath_between',
      'wounded_healer',
    ],
    relicPrefer: ['lament_pin', 'thornwreath', ...EVERY_BUILD, 'iron_mask'],
  },
  {
    code: 'RL',
    name: 'Razor Loom',
    calling: null,
    path: [],
    party: DEFAULT_PARTY,
    chords: 'all_in',
    draftPrefer: [
      'razor_silk',
      'whiplash',
      'slack_line',
      'quickening_thread',
      'gilded_wake',
      'constellation_lines',
      'cutting_chorus',
    ],
    relicPrefer: ['spare_strings', ...EVERY_BUILD],
  },
  {
    code: 'MA',
    name: 'Maestro',
    calling: 'conductor',
    path: ['a_tempo', 'reprise', 'ensemble', 'maestro'],
    party: DEFAULT_PARTY,
    chords: 'steady',
    draftPrefer: [
      'call_and_response',
      'opening_bars',
      'answering_phrase',
      'footlights',
      'tenuto',
      'tuning_up',
      'tempo_rubato',
      'grand_staff',
    ],
    relicPrefer: [
      'tin_whistle',
      'echoing_shell',
      'prompt_book',
      'heartwood_lute',
      ...EVERY_BUILD,
      'hollow_crown',
    ],
  },
  {
    code: 'RD',
    name: 'Red Line',
    calling: null,
    path: [],
    party: NAMED_PARTIES.R!,
    chords: 'choir',
    draftPrefer: [
      'blood_tithe',
      'edge_of_the_red',
      'bloodsong',
      'second_intention',
      'cold_steel',
      'shieldsong',
      'bright_peal',
      'crossed_steel',
    ],
    relicPrefer: ['thornwreath', ...EVERY_BUILD],
  },
];

/** The build with this code (case-insensitive); throws on an unknown one. */
export function buildByCode(code: string): BuildPreset {
  const build = BUILDS.find((b) => b.code === code.toUpperCase());
  if (!build) throw new Error(`Unknown build "${code}" (${BUILDS.map((b) => b.code)})`);
  return build;
}

/** A fresh copy of a build's Chords. */
export function buildChords(build: BuildPreset): ChordLoadout[] {
  const preset = CHORD_PRESETS.find((p) => p.id === build.chords);
  if (!preset)
    throw new Error(`Unknown loadout "${build.chords}" (${CHORD_PRESETS.map((p) => p.id)})`);
  return preset.chords.map((c) => ({ auras: [...c.auras], ornaments: [...c.ornaments] }));
}

/** The index of each path option in its tier, for `playRun`'s `path`; throws on an unknown one. */
export function buildPath(build: BuildPreset): (0 | 1)[] {
  if (build.calling === null) return [];
  const tiers = callingDef(build.calling).tiers;
  return build.path.map((id, tier) => {
    const index = tiers[tier]?.options.findIndex((o) => o.id === id) ?? -1;
    if (index !== 0 && index !== 1)
      throw new Error(`${build.code}: "${id}" is not an option of ${build.calling} tier ${tier}`);
    return index;
  });
}

/** One run of a build: its Calling, party and Chords, drafting and picking relics by its lists. */
export function playBuild(
  build: BuildPreset,
  seed: number,
  bot: BotKind,
  movements = 4,
): RunSummary {
  return playRun(seed, bot, buildChords(build), {
    movements,
    party: [...build.party],
    ...(build.calling ? { calling: build.calling, path: buildPath(build) } : {}),
    draftPrefer: build.draftPrefer,
    relicPrefer: build.relicPrefer,
  });
}

/** How many of a build's listed motifs a run holds (`RunSummary.motifs` are `id:level`). */
export function listedHeld(build: BuildPreset, run: RunSummary): number {
  const held = new Set(run.motifs.map((m) => m.split(':')[0]));
  return build.draftPrefer.filter((id) => held.has(id)).length;
}

/** A build's runs on one seed set, tallied. */
export interface BuildResult {
  build: BuildPreset | null;
  runs: number;
  won: number;
  reached: number;
  /** Runs holding at least `TOGETHER` of the listed motifs at their end, and among those that reached. */
  together: number;
  togetherReached: number;
  /** Total listed motifs held at the end, over all runs. */
  listed: number;
  /** Per trigger source: fights held, fights fired, fires. */
  triggers: Record<string, { held: number; fired: number; fires: number }>;
}

/** The doc's "holds ≥ 3 of its listed motifs by the Finale". */
export const TOGETHER = 3;
/** The Bands: a build is viable at this win rate, and must hold the build this often. */
export const VIABLE_WIN = 0.5;
export const VIABLE_TOGETHER = 0.6;
export const VIABLE_BAND = 5;
/** No build wins more than this far above the median build. */
export const MAX_ABOVE_MEDIAN = 0.15;

export function measureBuild(
  build: BuildPreset | null,
  runs: readonly RunSummary[],
  movements: number,
): BuildResult {
  const r: BuildResult = {
    build,
    runs: runs.length,
    won: 0,
    reached: 0,
    together: 0,
    togetherReached: 0,
    listed: 0,
    triggers: {},
  };
  for (const run of runs) {
    const reached = run.movementReached >= movements;
    if (run.outcome === 'victory') r.won++;
    if (reached) r.reached++;
    if (build) {
      const held = listedHeld(build, run);
      r.listed += held;
      if (held >= TOGETHER) {
        r.together++;
        if (reached) r.togetherReached++;
      }
    }
    for (const [source, fights] of Object.entries(run.triggerFights ?? {})) {
      const t = (r.triggers[source] ??= { held: 0, fired: 0, fires: 0 });
      t.held += fights.held;
      t.fired += fights.fired;
      t.fires += run.triggers?.[source] ?? 0;
    }
  }
  return r;
}

const pct = (n: number, d: number) => (d > 0 ? `${Math.round((n / d) * 100)}%` : '—');

/** The median of a list (the mean of the middle two for an even count). */
export function median(values: readonly number[]): number {
  const s = [...values].sort((a, b) => a - b);
  if (s.length === 0) return 0;
  const m = s.length >> 1;
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

/** The builds viable on one set: won ≥ 50%, holding the build ≥ 60% of the time, and not far above the median. */
export function viableBuilds(results: readonly BuildResult[]): string[] {
  const built = results.filter((r) => r.build !== null);
  const med = median(built.map((r) => r.won / Math.max(1, r.runs)));
  return built
    .filter(
      (r) =>
        r.won / r.runs >= VIABLE_WIN &&
        r.together / r.runs >= VIABLE_TOGETHER &&
        r.won / r.runs - med <= MAX_ABOVE_MEDIAN + 1e-9,
    )
    .map((r) => r.build!.code);
}

/** The report's tables for one set and bot, as lines. */
export function reportLines(
  results: readonly BuildResult[],
  bot: BotKind,
  movements: number,
  heading: string,
): string[] {
  const out: string[] = [];
  const last = movements;
  out.push(`${heading} ${bot}`, '');
  out.push(
    `| Build | Runs | Won | Reached ${last} | Won ÷ reached | Listed held | Holds ≥${TOGETHER} (all) | Holds ≥${TOGETHER} (reached) |`,
  );
  out.push('|---|---|---|---|---|---|---|---|');
  for (const r of results) {
    const label = r.build ? `${r.build.code} ${r.build.name}` : '(default party, no build)';
    out.push(
      `| ${label} | ${r.runs} | ${pct(r.won, r.runs)} | ${pct(r.reached, r.runs)} | ${pct(r.won, r.reached)} | ${r.build ? `${(r.listed / Math.max(1, r.runs)).toFixed(1)} of ${r.build.draftPrefer.filter((id) => CONTENT.motifs.some((m) => m.id === id)).length}` : '—'} | ${r.build ? pct(r.together, r.runs) : '—'} | ${r.build ? pct(r.togetherReached, r.reached) : '—'} |`,
    );
  }
  const built = results.filter((r) => r.build !== null);
  if (built.length > 0) {
    const med = median(built.map((r) => r.won / Math.max(1, r.runs)));
    const viable = viableBuilds(results);
    out.push('');
    out.push(
      `Median build win rate ${Math.round(med * 100)}% · widest gap above it ${Math.round(Math.max(0, ...built.map((r) => r.won / Math.max(1, r.runs) - med)) * 100)} points (band ≤ ${MAX_ABOVE_MEDIAN * 100})`,
    );
    out.push(
      `Viable builds (won ≥${VIABLE_WIN * 100}%, holds ≥${TOGETHER} listed in ≥${VIABLE_TOGETHER * 100}% of runs, within ${MAX_ABOVE_MEDIAN * 100} points of the median): ${viable.length} of ${built.length} (band ≥${VIABLE_BAND} of 6)${viable.length ? ` · ${viable.join(', ')}` : ''}`,
    );
  }
  const rows = results.flatMap((r) =>
    Object.entries(r.triggers).map(([source, t]) => ({ build: r.build?.code ?? '—', source, t })),
  );
  if (rows.length > 0) {
    out.push(
      '',
      '| Build | Trigger | Fights held | Fights fired | Fires |',
      '|---|---|---|---|---|',
    );
    for (const { build, source, t } of rows)
      out.push(`| ${build} | ${source} | ${t.held} | ${pct(t.fired, t.held)} | ${t.fires} |`);
  }
  return out;
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function main(): void {
  const t0 = Date.now();
  const runsN = Number(arg('seeds') ?? arg('runs') ?? 30);
  const movements = Number(arg('movements') ?? 4);
  const bots = (arg('bot') ?? arg('bots') ?? 'skilled').split(',') as BotKind[];
  if (!Number.isInteger(runsN) || runsN < 1) throw new Error(`--seeds is a count: ${runsN}`);
  if (!Number.isInteger(movements) || movements < 2)
    throw new Error(`An Expedition is 2 Movements or more: ${movements}`);
  const only = arg('builds')?.split(',');
  const builds = only ? only.map(buildByCode) : BUILDS;
  const sets = process.argv.includes('--sets')
    ? FINALE_SEED_SETS.map((s) => s.runs)
    : [Number(arg('run-seed-base') ?? 2000)];
  // Say once, up front, which of the doc's ids this tree doesn't hold yet.
  for (const b of builds) {
    knownIds('motif', b.draftPrefer);
    knownIds('relic', b.relicPrefer);
  }
  console.log('# Build report\n');
  console.log(
    `${runsN} whole ${movements === 4 ? 'Finale-route ' : ''}Expeditions (${movements} Movements) a build, per set. A build is a Calling and path, a party, Chords, and drafts and relics taken first from its lists.`,
  );
  /** Viable builds by bot, one list per set. */
  const viableBySet = new Map<BotKind, string[][]>();
  for (const [k, base] of sets.entries()) {
    if (sets.length > 1) console.log(`\n## Set ${k + 1} of ${sets.length}: runs from ${base}`);
    for (const bot of bots) {
      const results: BuildResult[] = [];
      for (const build of [null, ...builds]) {
        const runs: RunSummary[] = [];
        for (let i = 0; i < runsN; i++) {
          const seed = base + i * 104729;
          runs.push(
            build
              ? playBuild(build, seed, bot, movements)
              : playRun(seed, bot, undefined, { movements }),
          );
        }
        results.push(measureBuild(build, runs, movements));
      }
      console.log();
      for (const line of reportLines(results, bot, movements, sets.length > 1 ? '###' : '##'))
        console.log(line);
      const list = viableBySet.get(bot) ?? [];
      list.push(viableBuilds(results));
      viableBySet.set(bot, list);
    }
  }
  if (sets.length > 1)
    for (const [bot, lists] of viableBySet) {
      const all = onEverySet(lists);
      console.log(
        `\nViable on all ${sets.length} sets (${bot}): ${all.length} of ${builds.length} (band ≥${VIABLE_BAND} of 6) · ${all.length >= VIABLE_BAND ? 'Met' : 'not met'}${all.length ? ` · ${all.join(', ')}` : ''}`,
      );
    }
  console.log(
    `\n_Generated by \`tools/builds.ts\` in ${((Date.now() - t0) / 1000).toFixed(0)} s._`,
  );
}

if (process.argv[1]?.endsWith('builds.ts')) main();
