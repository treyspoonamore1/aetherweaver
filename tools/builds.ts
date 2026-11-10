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
 * A build is a preset (`BUILDS`): `draftPrefer` is the doc's "Drafts first" list in its order,
 * which the run drafts by with each listed Harmony's prerequisites (from content) just before it
 * (`draftOrder`; an offered option nearest the front of the list; none on offer: the harness's
 * first option); `relicPrefer` the relics whose "Builds" column names the build, then those that
 * serve every build, taken at relic offers and bought first at merchants (the only place a cursed
 * relic comes from); `thirdAura` the aura Third Voice adds to the field song. An id that `CONTENT`
 * doesn't hold yet is skipped with one line on stderr, so the tool runs before the content merges
 * (preferring nothing) and fully after. Whole runs are played by `playRun`; the rest of a run
 * (map, fights, respites, events) is the harness's own, and an event choice that asks for a motif
 * is taken by the draft order (`eventMotif`).
 *
 * Per build: wins, runs that reached the last Movement, wins ÷ reached, how many of the build's
 * listed motifs the run held at its end (and how often 3 or more: "came together"), the runs that
 * were the build as the preset claims (its third aura, 3 or more listed motifs; every other run is
 * named, with what it lacked), and the trigger fire rates of what it held. Seeds:
 * `--run-seed-base` + i × 104729 (2000 by default); `--sets` plays the doc's three sets in turn
 * (FINALE_SEED_SETS), then what held on all. The band (Bands, "Five viable archetypes"): at least 5
 * of 6 builds win ≥ 50% of whole Finale route Expeditions on all three sets ("viable"), each holds
 * ≥ 3 of its listed motifs by the Finale in ≥ 60% of its runs, and none wins more than 15 points
 * above the median build ("within the spread"; one above it is too strong, not unviable).
 */
import type { BotKind } from '../src/bots';
import { CONTENT, callingDef, callingOption, runEventDef } from '../src/content';
import { RELIC_OFFERS, SHOP_RELIC_ODDS } from '../src/meta/economy';
import { CHORD_PRESETS, routeDefs } from '../src/meta/run';
import type { ChordLoadout, RunState } from '../src/meta/types';
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
  /** The aura Third Voice adds to the field song, for a path that takes it. */
  thirdAura?: string;
}

const DEFAULT_PARTY = ['kael', 'lyra', 'vexis'] as const;
/** Relics the doc says serve every build (its "Builds" column reads "all"). */
const EVERY_BUILD = [
  'pilgrims_lamp',
  'black_ribbon',
  'pedlars_ledger',
  'menders_needle',
  'water_clock',
] as const;

export const BUILDS: readonly BuildPreset[] = [
  {
    code: 'CS',
    name: 'Choir Sovereign',
    calling: 'luminary',
    path: ['wide_choir', 'dawnward', 'third_voice', 'sovereign_symphony'],
    party: DEFAULT_PARTY,
    chords: 'anchor',
    // The doc names Lullaby + Sostenuto planted, "Third Voice fills a third", and no aura for it.
    // Fermata: "few active saves" (its hold catches a lethal blow for them), and the fourth aura
    // Sovereign Symphony counts and Full Chord pays for. It fits only with the Grace Note moved
    // to the field song (82.5% reserved; on the beam song, 96%).
    thirdAura: 'fermata',
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

/** A motif's prerequisites (`requires.motifs`), theirs first, from content. */
function prerequisites(id: string, seen = new Set<string>()): string[] {
  const needs = CONTENT.motifs.find((m) => m.id === id)?.requires.motifs ?? [];
  const out: string[] = [];
  for (const need of needs) {
    if (seen.has(need)) continue;
    seen.add(need);
    out.push(...prerequisites(need, seen), need);
  }
  return out;
}

/**
 * The order a build drafts by: the doc's list in its order, with each listed Harmony's
 * prerequisites (from content, theirs first) just before it when the list doesn't name them
 * already, so a build can reach its Harmonies on purpose (MA: Canon before Tempo Rubato, Golden
 * Filament before Grand Staff; RD: En Garde before Crossed Steel). The listed motifs keep their
 * order, and only they count as "listed" in the report.
 */
export function draftOrder(build: BuildPreset): string[] {
  const out: string[] = [];
  for (const id of build.draftPrefer) {
    for (const need of prerequisites(id))
      if (!build.draftPrefer.includes(need) && !out.includes(need)) out.push(need);
    if (!out.includes(id)) out.push(id);
  }
  return out;
}

/** A build's run: the summary, and the songs it ended with. */
export interface BuildRun extends RunSummary {
  /** The auras of each song at the run's end, the beam song first. */
  songs: string[][];
}

/** One run of a build: its Calling, party and Chords, drafting and picking relics by its lists. */
export function playBuild(build: BuildPreset, seed: number, bot: BotKind, movements = 4): BuildRun {
  let songs: string[][] = [];
  const summary = playRun(seed, bot, buildChords(build), {
    movements,
    party: [...build.party],
    ...(build.calling ? { calling: build.calling, path: buildPath(build) } : {}),
    draftPrefer: draftOrder(build),
    relicPrefer: build.relicPrefer,
    ...(build.thirdAura ? { thirdAura: build.thirdAura } : {}),
    onEnd: (run: RunState) => {
      songs = run.chords.map((c) => [...c.auras]);
    },
  });
  return { ...summary, songs };
}

/**
 * What a run of a build lacked of what the preset claims (docs/phase-5g.md, review B5): its third
 * aura (Third Voice not reached, or reached and the aura not added), or 3 of its listed motifs.
 * Empty: the run was the build. A summary without `songs` (not a `playBuild` run) is read for its
 * motifs only.
 */
export function buildLacks(build: BuildPreset, run: RunSummary & { songs?: string[][] }): string[] {
  const out: string[] = [];
  if (build.thirdAura && run.songs) {
    const slot = build.path.find((id) => (callingOption(id).values.slots ?? 0) > 0);
    if (slot && !run.path.includes(slot)) out.push(`${slot} not reached`);
    else if (!run.songs[1]?.includes(build.thirdAura)) out.push(`no ${build.thirdAura}`);
  }
  const held = listedHeld(build, run);
  if (held < TOGETHER) out.push(`${held} of ${TOGETHER} listed`);
  return out;
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
  /** Runs that were the build as the preset claims (`buildLacks` empty), and those won. */
  asBuilt: number;
  wonAsBuilt: number;
  /** The runs that weren't, by seed, with what each lacked. */
  lacking: { seed: number; lacks: string[] }[];
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
  runs: readonly (RunSummary & { songs?: string[][] })[],
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
    asBuilt: 0,
    wonAsBuilt: 0,
    lacking: [],
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
      const lacks = buildLacks(build, run);
      if (lacks.length === 0) {
        r.asBuilt++;
        if (run.outcome === 'victory') r.wonAsBuilt++;
      } else r.lacking.push({ seed: run.seed, lacks });
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

/** One build's standing against the band's three conditions (docs/phase-5g.md, Bands). */
export interface BuildStanding {
  code: string;
  /** Wins ≥ 50% of its runs: "viable". */
  viable: boolean;
  /** Holds ≥ 3 of its listed motifs in ≥ 60% of its runs. */
  holds: boolean;
  /** Wins no more than 15 points above the median build; false: too strong (not unviable). */
  withinSpread: boolean;
}

/** Each build on one set against the band's three conditions, reported apart (review C9). */
export function buildStandings(results: readonly BuildResult[]): BuildStanding[] {
  const built = results.filter((r) => r.build !== null);
  const med = median(built.map((r) => r.won / Math.max(1, r.runs)));
  return built.map((r) => ({
    code: r.build!.code,
    viable: r.won / Math.max(1, r.runs) >= VIABLE_WIN,
    holds: r.together / Math.max(1, r.runs) >= VIABLE_TOGETHER,
    withinSpread: r.won / Math.max(1, r.runs) - med <= MAX_ABOVE_MEDIAN + 1e-9,
  }));
}

/** The builds viable on one set: those winning ≥ 50% of their runs (the band's count). */
export function viableBuilds(results: readonly BuildResult[]): string[] {
  return buildStandings(results)
    .filter((s) => s.viable)
    .map((s) => s.code);
}

/** The builds no more than 15 points above the median build on one set. */
export function withinSpread(results: readonly BuildResult[]): string[] {
  return buildStandings(results)
    .filter((s) => s.withinSpread)
    .map((s) => s.code);
}

/** The builds holding ≥ 3 listed motifs in ≥ 60% of their runs on one set. */
export function holdingBuilds(results: readonly BuildResult[]): string[] {
  return buildStandings(results)
    .filter((s) => s.holds)
    .map((s) => s.code);
}

/**
 * Where each rarity of relic comes from on a route of `movements`: relic offers (elites, bosses,
 * events' fights), merchants, and event choices that give one (the harness takes an event's first
 * choice it can, so a later one only when the earlier can't be made).
 */
export function relicSources(movements: number): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  const add = (rarity: string, where: string) => {
    const list = (out[rarity] ??= []);
    if (!list.includes(where)) list.push(where);
  };
  for (const [reason, offer] of Object.entries(RELIC_OFFERS))
    for (const [rarity, odds] of Object.entries(offer.odds))
      if (odds > 0) add(rarity, `${reason} offers`);
  for (const [rarity, odds] of Object.entries(SHOP_RELIC_ODDS))
    if (odds > 0) add(rarity, 'merchants');
  const route = routeDefs(movements);
  for (const def of CONTENT.events) {
    const m = def.movement ?? 1;
    // On the Finale route Movement I's shorter road has no event node (docs/phase-5g.md).
    if (m > route.length || (m === 1 && movements >= 4)) continue;
    for (const choice of def.choices)
      for (const e of [...choice.effects, ...choice.fail])
        if (e.kind === 'relic') add(e.rarity, `${runEventDef(def.id).name}`);
  }
  return out;
}

/**
 * The preferred relics a build can't get on this route (no source of its rarity, or a Movement it
 * doesn't reach), and those only a merchant stocks; by relic, the builds that name it.
 */
export function relicReach(
  builds: readonly BuildPreset[],
  movements: number,
): { unobtainable: Map<string, string[]>; merchantOnly: Map<string, string[]> } {
  const sources = relicSources(movements);
  const unobtainable = new Map<string, string[]>();
  const merchantOnly = new Map<string, string[]>();
  for (const b of builds)
    for (const id of b.relicPrefer) {
      const def = CONTENT.relics.find((r) => r.id === id);
      if (!def) continue;
      const from = sources[def.rarity] ?? [];
      const into =
        from.length === 0 || (def.movement !== undefined && def.movement > movements)
          ? unobtainable
          : from.every((w) => w === 'merchants')
            ? merchantOnly
            : null;
      if (into) into.set(id, [...(into.get(id) ?? []), b.code]);
    }
  return { unobtainable, merchantOnly };
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
    `| Build | Runs | Won | Reached ${last} | Won ÷ reached | Listed held | Holds ≥${TOGETHER} (all) | Holds ≥${TOGETHER} (reached) | As built | Won as built |`,
  );
  out.push('|---|---|---|---|---|---|---|---|---|---|');
  for (const r of results) {
    const label = r.build ? `${r.build.code} ${r.build.name}` : '(default party, no build)';
    out.push(
      `| ${label} | ${r.runs} | ${pct(r.won, r.runs)} | ${pct(r.reached, r.runs)} | ${pct(r.won, r.reached)} | ${r.build ? `${(r.listed / Math.max(1, r.runs)).toFixed(1)} of ${r.build.draftPrefer.filter((id) => CONTENT.motifs.some((m) => m.id === id)).length}` : '—'} | ${r.build ? pct(r.together, r.runs) : '—'} | ${r.build ? pct(r.togetherReached, r.reached) : '—'} | ${r.build ? `${r.asBuilt} of ${r.runs}` : '—'} | ${r.build ? pct(r.wonAsBuilt, r.asBuilt) : '—'} |`,
    );
  }
  const built = results.filter((r) => r.build !== null);
  if (built.length > 0) {
    const med = median(built.map((r) => r.won / Math.max(1, r.runs)));
    const standings = buildStandings(results);
    const yes = (b: boolean, no = 'no') => (b ? 'yes' : no);
    out.push('');
    out.push(
      `| Build | Won | Viable (won ≥${VIABLE_WIN * 100}%) | Holds ≥${TOGETHER} listed in ≥${VIABLE_TOGETHER * 100}% | Within ${MAX_ABOVE_MEDIAN * 100} points of the median |`,
      '|---|---|---|---|---|',
    );
    for (const s of standings) {
      const r = built.find((b) => b.build!.code === s.code)!;
      out.push(
        `| ${s.code} | ${pct(r.won, r.runs)} | ${yes(s.viable)} | ${yes(s.holds)} | ${yes(s.withinSpread, `too strong (+${Math.round((r.won / Math.max(1, r.runs) - med) * 100)})`)} |`,
      );
    }
    const viable = standings.filter((s) => s.viable).map((s) => s.code);
    const holding = standings.filter((s) => s.holds).map((s) => s.code);
    const strong = standings.filter((s) => !s.withinSpread).map((s) => s.code);
    out.push('');
    out.push(
      `Median build win rate ${Math.round(med * 100)}% · widest gap above it ${Math.round(Math.max(0, ...built.map((r) => r.won / Math.max(1, r.runs) - med)) * 100)} points (band ≤ ${MAX_ABOVE_MEDIAN * 100})`,
    );
    out.push(
      `Viable builds (won ≥${VIABLE_WIN * 100}%): ${viable.length} of ${built.length} (band ≥${VIABLE_BAND} of 6)${viable.length ? ` · ${viable.join(', ')}` : ''}`,
    );
    out.push(
      `Holding their build (≥${TOGETHER} listed in ≥${VIABLE_TOGETHER * 100}% of runs): ${holding.length} of ${built.length} (band: every build)${holding.length ? ` · ${holding.join(', ')}` : ''}`,
    );
    out.push(
      `Within the spread (≤${MAX_ABOVE_MEDIAN * 100} points above the median): ${built.length - strong.length} of ${built.length} (band: every build)${strong.length ? ` · too strong: ${strong.join(', ')}` : ''}`,
    );
    const lacking = built.filter((r) => r.lacking.length > 0);
    if (lacking.length > 0) {
      out.push(
        '',
        'Runs that were not the build the preset claims (counted above, but not as built):',
      );
      for (const r of lacking)
        out.push(
          `- ${r.build!.code}: ${r.lacking.map((l) => `seed ${l.seed} (${l.lacks.join('; ')})`).join(', ')}`,
        );
    }
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
    knownIds('motif', draftOrder(b));
    knownIds('relic', b.relicPrefer);
  }
  console.log('# Build report\n');
  console.log(
    `${runsN} whole ${movements === 4 ? 'Finale-route ' : ''}Expeditions (${movements} Movements) a build, per set. A build is a Calling and path, a party, Chords, and drafts and relics taken first from its lists.`,
  );
  const named = (m: Map<string, string[]>) =>
    [...m].map(([id, codes]) => `${id} (${codes.join(', ')})`).join(', ');
  const reach = relicReach(builds, movements);
  console.log(
    `\nRelic preferences this route can't give (they never match): ${reach.unobtainable.size ? named(reach.unobtainable) : 'none'}.`,
  );
  if (reach.merchantOnly.size)
    console.log(
      `Relic preferences only a merchant stocks (relic offers have no ${[...new Set([...reach.merchantOnly.keys()].map((id) => CONTENT.relics.find((r) => r.id === id)!.rarity))].join(', ')} odds; the harness buys them first there): ${named(reach.merchantOnly)}.`,
    );
  /** Viable builds, those within the spread and those holding their build, by bot, a list per set. */
  const viableBySet = new Map<BotKind, string[][]>();
  const spreadBySet = new Map<BotKind, string[][]>();
  const holdingBySet = new Map<BotKind, string[][]>();
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
      for (const [map, list] of [
        [viableBySet, viableBuilds(results)],
        [spreadBySet, withinSpread(results)],
        [holdingBySet, holdingBuilds(results)],
      ] as const)
        map.set(bot, [...(map.get(bot) ?? []), list]);
    }
  }
  if (sets.length > 1)
    for (const [bot, lists] of viableBySet) {
      const all = onEverySet(lists);
      const spread = onEverySet(spreadBySet.get(bot) ?? []);
      const holding = onEverySet(holdingBySet.get(bot) ?? []);
      console.log(
        `\nViable on all ${sets.length} sets (${bot}): ${all.length} of ${builds.length} (band ≥${VIABLE_BAND} of 6) · ${all.length >= VIABLE_BAND ? 'Met' : 'not met'}${all.length ? ` · ${all.join(', ')}` : ''}`,
      );
      console.log(
        `Holding their build on all ${sets.length} sets (${bot}): ${holding.length} of ${builds.length}${holding.length ? ` · ${holding.join(', ')}` : ''} · within the spread on all: ${spread.length} of ${builds.length}${spread.length ? ` · ${spread.join(', ')}` : ''}`,
      );
    }
  console.log(
    `\n_Generated by \`tools/builds.ts\` in ${((Date.now() - t0) / 1000).toFixed(0)} s._`,
  );
}

if (process.argv[1]?.endsWith('builds.ts')) main();
