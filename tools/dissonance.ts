/**
 * Dissonance report (docs/phase-4d.md): what each level costs a Rank-20 build, in the enemy
 * life that costs as much.
 *
 *   npx tsx tools/dissonance.ts --find --seeds 100                the threat the build wins ~half at
 *   npx tsx tools/dissonance.ts --seeds 200 --threat 1.6          each level against that base
 *   npx tsx tools/dissonance.ts --seeds 200 --threat 1.6 --levels brisk_foes,short_fuse:2
 *
 * The build: the Skilled bot, Guardian, a full tree (29 points, through Overflowing Grace and
 * the notables) and a typical carried set (three legendaries). It wins nearly every run at the
 * usual difficulty, so it plays against enemies with more life (`--threat`) until it wins about
 * half; there each level's cost is read as the extra enemy life that costs as much, on a
 * logistic scale between the base and the base with 25% more life (one rank of Hardened).
 *
 * `--tiers` (docs/phase-6.md, decision 1(a) and "Bands": the tiers) plays whole Finale-route
 * Expeditions at each tier's fixed set of levels (`TIERS`: 0, 10, 20, 30 and every level, 42),
 * the default party, the Calling rotating by seed among none and the four (`TIER_CALLINGS`, each
 * on its `EXPERT_PATHS` path), with the Rank 20 build (`rank20Build`: the tree and carried set
 * above, Bonds at rank 10, the `--loadout` preset). The Expert plays its run policy
 * (src/bots/expertRun.ts); the other bots the harness's own, unless `--policy all` gives it to
 * every bot (`--policy none`: to none). Seeds: `--seed-base` (2000) + i × 104729, as the
 * harness's whole runs; `--sets` plays the three sets of `FINALE_SEED_SETS` in turn.
 *
 *   npx tsx tools/dissonance.ts --tiers --seeds 2                    the Expert, every tier
 *   npx tsx tools/dissonance.ts --tiers --seeds 20 --bots expert,skilled --only 10,20
 *   npx tsx tools/dissonance.ts --tiers --seeds 100 --sets
 *
 * Each row: wins, the runs that reached the Finale, wins ÷ reached, minutes of combat, and where
 * the lost runs ended (the fight they lost), against the tier's band.
 *
 * `--echoes` (docs/phase-6.md, "Bands": Echoes) plays whole Echoes at the Dissonance its stars
 * ask (`ECHO_TIERS`: 0 for ★, Tier I's 10 for ★★, Tier II's 20 for ★★★; `--only` picks), with
 * the Rank 20 build for the Echo's party (its twists drop what they forbid), the Calling rotating
 * by seed as `--tiers` (an Echo with no Calling plays none) and, for the Expert, its run policy
 * (`--policy` as `--tiers`). `--echo` names some (default: all nine). Rows: wins, where lost runs
 * ended, minutes of combat, against the star's band and the 12-22 min length band.
 *
 *   npx tsx tools/dissonance.ts --echoes --seeds 2 --bots expert,skilled
 *   npx tsx tools/dissonance.ts --echoes --seeds 20 --echo strangers,the_unrested --only 0
 *
 * `--weekly` (docs/phase-6.md, "Bands": the weekly rotation) plays each rotation entry (`--entry`
 * picks by index, default all twelve) on `--seeds` weeks holding it, from `--week-base` (44) on
 * (the first such week, then every 12th): the level field (no tree, carry or Bonds; the
 * `--loadout` preset as the picks), the Expert with its run policy and its path for the entry's
 * Calling. Rows: wins, mean score (`weeklyScore`), minutes, where lost runs ended, against the
 * entry's band (Expert 50-85%, Skilled 25-70%).
 *
 *   npx tsx tools/dissonance.ts --weekly --seeds 2 --bots expert,skilled
 *   npx tsx tools/dissonance.ts --weekly --seeds 8 --entry 3,8 --bots expert
 */
import type { BotKind } from '../src/bots';
import {
  expertBonds,
  expertDraft,
  expertMotifOrder,
  expertNode,
  expertPath,
  expertRelic,
  expertRespite,
  expertShop,
} from '../src/bots/expertRun';
import { CONTENT } from '../src/content';
import { dissonancePoints } from '../src/meta/dissonance';
import { CHORD_PRESETS } from '../src/meta/run';
import type { ChordLoadout } from '../src/meta/types';
import { buildTree, TREES } from './astrolabe';
import { FINALE_SEED_SETS, playRun, type RunSummary } from './harness-core';
import { weeklyEntry, weeklyScore, weeklySeed } from '../src/meta/weekly';
import type { RunState } from '../src/meta/types';
import { SETS } from './reliquary';

type Levels = { id: string; rank: number }[];
type RunOptions = NonNullable<Parameters<typeof playRun>[3]>;

/**
 * The tiers (docs/phase-6.md, "Points, tiers and what the player sees"; decision 1(a)): each a
 * point total measured with one fixed set of levels, so every reading measures the same thing.
 */
export const TIERS: readonly { name: string; points: number; levels: Levels }[] = (() => {
  const one: Levels = [
    { id: 'hardened', rank: 2 },
    { id: 'wounding_strikes', rank: 2 },
  ];
  const two: Levels = [...one, { id: 'restless_dead', rank: 1 }, { id: 'elite_vanguard', rank: 1 }];
  const three: Levels = [
    ...two,
    { id: 'tyrant', rank: 1 },
    { id: 'mimicry', rank: 1 },
    { id: 'short_fuse', rank: 2 },
    { id: 'brisk_foes', rank: 1 },
  ];
  const all: Levels = CONTENT.dissonance.map((d) => ({ id: d.id, rank: d.ranks }));
  return [
    { name: '0', points: 0, levels: [] },
    { name: 'I', points: 10, levels: one },
    { name: 'II', points: 20, levels: two },
    { name: 'III', points: 30, levels: three },
    { name: 'IV', points: 42, levels: all },
  ];
})();

/** The Expert's bands by tier (docs/phase-6.md, "Bands": Tiers), and the Skilled bot's beside it. */
const TIER_BANDS: Readonly<Record<string, string>> = {
  '0': 'Expert ≥90% · Skilled, Novice reported · Idle 0%',
  I: 'Expert 70-90% · Skilled ≤ Expert − 10 · Novice ≤15% · Idle 0%',
  II: 'Expert 40-70% · Skilled ≤ Expert − 10 · Idle 0%',
  III: 'Expert 15-40% · Skilled ≤ Expert − 5 · Idle 0%',
  IV: 'Expert 2-15%, above 0 on every set · Idle 0%',
};

/** The Calling of the run at seed index `i` (docs/phase-6.md, Bands' protocol): none and the four. */
export const TIER_CALLINGS: readonly (string | null)[] = [
  null,
  'luminary',
  'martyr',
  'chronomancer',
  'conductor',
];

/** The default party, as the Bands' protocol plays it (content's own). */
const DEFAULT_PARTY: readonly string[] = CONTENT.defaultParty;

/**
 * The Rank 20 build (docs/phase-6.md, "Design: the expert bot", item 4): this report's tree (29
 * points: Overflowing Grace and the notables) and typical carried set (three legendaries), and
 * Bonds at rank 10 for `party` (`expertBonds`).
 */
export function rank20Build(
  party: readonly string[] = DEFAULT_PARTY,
): Pick<RunOptions, 'astrolabe' | 'carried' | 'bonds'> {
  return {
    astrolabe: buildTree([...TREES.grace!, ...TREES.notables!], 29),
    carried: SETS.typical!(),
    bonds: expertBonds(party),
  };
}

/** The Expert's run policy as `playRun` takes it (src/bots/expertRun.ts), for `calling`. */
export function expertPolicy(calling: string | null): RunOptions {
  const path = expertPath(calling);
  return {
    draftPrefer: expertDraft,
    relicPrefer: expertRelic,
    shopPrefer: expertShop,
    nodePrefer: expertNode,
    respitePrefer: expertRespite,
    motifOrder: expertMotifOrder,
    ...(path ? { path } : {}),
  };
}

/** One tier's whole Finale-route Expedition at seed index `i` (its Calling by `TIER_CALLINGS`). */
export function tierRun(
  seed: number,
  i: number,
  bot: BotKind,
  chords: readonly ChordLoadout[],
  levels: Levels,
  policy: boolean,
): RunSummary {
  const calling = TIER_CALLINGS[i % TIER_CALLINGS.length]!;
  return playRun(seed, bot, chords, {
    ...rank20Build(),
    dissonance: levels,
    movements: 4,
    ...(calling ? { calling } : {}),
    ...(policy ? expertPolicy(calling) : {}),
  });
}

/** The Dissonance an Echo's stars ask (docs/phase-6.md, "Stars"): the tier sets 0, I and II. */
export const ECHO_TIERS: readonly { stars: number; tier: (typeof TIERS)[number] }[] = [
  { stars: 1, tier: TIERS[0]! },
  { stars: 2, tier: TIERS[1]! },
  { stars: 3, tier: TIERS[2]! },
];

/** The Echo bands (docs/phase-6.md, "Bands": Echoes, the Expert at Rank 20), by stars. */
function echoBand(echo: string, stars: number): string {
  const length = 'length 12-22 min';
  if (stars === 1) return `${echo === 'strangers' ? 'Expert ≥40%' : 'Expert 60-95%'} · ${length}`;
  if (stars === 3) return `Expert 10-45% · ${length}`;
  return `none set · ${length}`;
}

/** The party an Echo plays: its twist's, or the default. */
export function echoParty(echo: string): readonly string[] {
  const def = CONTENT.echoes.find((e) => e.id === echo);
  if (!def) throw new Error(`Unknown Echo "${echo}" (${CONTENT.echoes.map((e) => e.id)})`);
  return def.twists.party
    ? CONTENT.heroes.map((h) => h.id).filter((id) => def.twists.party!.includes(id))
    : DEFAULT_PARTY;
}

/**
 * One whole Echo at seed index `i`: the Rank 20 build for its party, `levels` chosen, the Calling
 * by `TIER_CALLINGS` (none on an Echo whose twists forbid one), the Expert's policy if `policy`.
 */
export function echoRun(
  echo: string,
  seed: number,
  i: number,
  bot: BotKind,
  chords: readonly ChordLoadout[],
  levels: Levels,
  policy: boolean,
): RunSummary {
  const def = CONTENT.echoes.find((e) => e.id === echo)!;
  const calling = def.twists.noCalling ? null : TIER_CALLINGS[i % TIER_CALLINGS.length]!;
  return playRun(seed, bot, chords, {
    ...rank20Build(echoParty(echo)),
    echo,
    dissonance: levels,
    ...(calling ? { calling } : {}),
    ...(policy ? expertPolicy(calling) : {}),
  });
}

/**
 * One weekly run of `week`, as everyone plays it (the level field), with `chords` as the picks,
 * the Expert's policy (and its path for the entry's Calling) if `policy`. Its score with it.
 */
export function weeklyRun(
  week: number,
  bot: BotKind,
  chords: readonly ChordLoadout[],
  policy: boolean,
): { summary: RunSummary; score: number } {
  const entry = weeklyEntry(week);
  if (!entry) throw new Error('no weekly rotation');
  let end: RunState | null = null;
  const summary = playRun(weeklySeed(week), bot, chords, {
    week,
    ...(policy ? expertPolicy(entry.calling) : {}),
    onEnd: (run) => (end = run),
  });
  return { summary, score: weeklyScore(end!) };
}

/** The runs' line: wins, then whatever `extra` adds, minutes and where lost runs ended. */
function runsLine(runs: readonly RunSummary[], extra = ''): string {
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  const won = runs.filter((r) => r.outcome === 'victory').length;
  const endedAt: Record<string, number> = {};
  for (const r of runs)
    if (r.outcome === 'defeat') endedAt[r.lastEncounter] = (endedAt[r.lastEncounter] ?? 0) + 1;
  const minutes = runs.reduce((s, r) => s + r.minutes, 0) / Math.max(1, runs.length);
  return `won ${pct(won / Math.max(1, runs.length)).padStart(4)} (${won}/${runs.length})${extra} · ${minutes.toFixed(1)} min of combat · lost at ${JSON.stringify(endedAt)}`;
}

/** The run policy `--policy` gives `bot` (the Expert's, by default, to the Expert only). */
function policyFor(policy: string, bot: BotKind): boolean {
  return policy === 'all' || (policy === 'expert' && bot === 'expert');
}

function policyArg(): string {
  const policy = get('policy') ?? 'expert';
  if (!['all', 'expert', 'none'].includes(policy))
    throw new Error(`--policy is all, expert or none, not "${policy}"`);
  return policy;
}

function echoes(): void {
  const loadout = CHORD_PRESETS.find((p) => p.id === (get('loadout') ?? 'guardian'))!;
  const seeds = Number(get('seeds') ?? 20);
  const bots = (get('bots') ?? 'expert').split(',') as BotKind[];
  const policy = policyArg();
  const only = get('only')?.split(',').map(Number);
  const base = Number(get('seed-base') ?? 2000);
  const ids = get('echo')?.split(',') ?? CONTENT.echoes.map((e) => e.id);
  for (const id of ids) echoParty(id);
  const t0 = Date.now();
  console.log(
    `dissonance echoes · ${bots.join(', ')} · Rank 20 build for each Echo's party (${loadout.name}) · run policy: ${policy === 'all' ? 'the Expert’s for every bot' : policy === 'expert' ? 'the Expert’s for the Expert' : 'the harness’s'} · ${seeds} seeds from ${base} · Calling by seed: ${TIER_CALLINGS.map((c) => c ?? 'none').join(', ')}`,
  );
  for (const id of ids) {
    const name = CONTENT.echoes.find((e) => e.id === id)!.name;
    for (const { stars, tier } of ECHO_TIERS) {
      if (only && !only.includes(tier.points)) continue;
      console.log(
        `${name} · ${'★'.repeat(stars)} (${tier.points} pts) · band ${echoBand(id, stars)}`,
      );
      for (const bot of bots) {
        const runs = Array.from({ length: seeds }, (_, i) =>
          echoRun(
            id,
            base + i * 104729,
            i,
            bot,
            loadout.chords,
            tier.levels,
            policyFor(policy, bot),
          ),
        );
        console.log(`  ${bot.padEnd(8)} ${runsLine(runs)}`);
      }
    }
  }
  console.log(`done in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
}

function weekly(): void {
  const loadout = CHORD_PRESETS.find((p) => p.id === (get('loadout') ?? 'guardian'))!;
  const seeds = Number(get('seeds') ?? 20);
  const bots = (get('bots') ?? 'expert').split(',') as BotKind[];
  const policy = policyArg();
  const from = Number(get('week-base') ?? 44);
  const n = CONTENT.weekly.length;
  const entries = get('entry')?.split(',').map(Number) ?? Array.from({ length: n }, (_, i) => i);
  const t0 = Date.now();
  console.log(
    `dissonance weekly · ${bots.join(', ')} · the level field, ${loadout.name} as the picks · run policy: ${policy === 'all' ? 'the Expert’s for every bot' : policy === 'expert' ? 'the Expert’s for the Expert' : 'the harness’s'} · ${seeds} weeks an entry from week ${from} · band Expert 50-85%, Skilled 25-70%`,
  );
  for (const e of entries) {
    const entry = CONTENT.weekly[e];
    if (!entry) throw new Error(`no rotation entry ${e} (0-${n - 1})`);
    const first = from + ((((e - from) % n) + n) % n);
    const weeks = Array.from({ length: seeds }, (_, k) => first + k * n);
    console.log(
      `entry ${e} · ${entry.route} · ${entry.calling ?? 'no Calling'} · ${entry.party.join(', ')} · ${dissonancePoints(entry.dissonance)} pts${entry.dissonance.length ? ` (${entry.dissonance.map((l) => (l.rank > 1 ? `${l.id}×${l.rank}` : l.id)).join(', ')})` : ''} · weeks ${weeks.join(', ')}`,
    );
    for (const bot of bots) {
      const runs = weeks.map((w) => weeklyRun(w, bot, loadout.chords, policyFor(policy, bot)));
      const score = runs.reduce((s, r) => s + r.score, 0) / Math.max(1, runs.length);
      console.log(
        `  ${bot.padEnd(8)} ${runsLine(
          runs.map((r) => r.summary),
          ` · score ${Math.round(score)}`,
        )}`,
      );
    }
  }
  console.log(`done in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
}

function tiers(): void {
  const loadout = CHORD_PRESETS.find((p) => p.id === (get('loadout') ?? 'guardian'))!;
  const seeds = Number(get('seeds') ?? 20);
  const bots = (get('bots') ?? 'expert').split(',') as BotKind[];
  const policy = get('policy') ?? 'expert';
  if (!['all', 'expert', 'none'].includes(policy))
    throw new Error(`--policy is all, expert or none, not "${policy}"`);
  const only = get('only')?.split(',').map(Number);
  const bases = argv.includes('--sets')
    ? FINALE_SEED_SETS.map((s) => s.runs)
    : [Number(get('seed-base') ?? 2000)];
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  const t0 = Date.now();
  console.log(
    `dissonance tiers · Finale-route Expeditions · ${bots.join(', ')} · Rank 20 build (29-point tree, typical carried set, Bonds at rank 10, ${loadout.name}) · run policy: ${policy === 'all' ? 'the Expert’s for every bot' : policy === 'expert' ? 'the Expert’s for the Expert' : 'the harness’s'} · ${seeds} seeds a set · Calling by seed: ${TIER_CALLINGS.map((c) => c ?? 'none').join(', ')}`,
  );
  for (const tier of TIERS) {
    if (only && !only.includes(tier.points)) continue;
    const points = dissonancePoints(tier.levels);
    if (points !== tier.points)
      throw new Error(`tier ${tier.name}: its levels add to ${points}, not ${tier.points}`);
    const named = tier.levels.map((l) => (l.rank > 1 ? `${l.id}×${l.rank}` : l.id)).join(', ');
    console.log(
      `tier ${tier.name} (${tier.points} pts: ${tier.points === 42 ? 'every level' : named || 'none'}) · band ${TIER_BANDS[tier.name]}`,
    );
    for (const base of bases) {
      for (const bot of bots) {
        const runs = Array.from({ length: seeds }, (_, i) =>
          tierRun(
            base + i * 104729,
            i,
            bot,
            loadout.chords,
            tier.levels,
            policy === 'all' || (policy === 'expert' && bot === 'expert'),
          ),
        );
        const won = runs.filter((r) => r.outcome === 'victory').length;
        const reached = runs.filter((r) => r.movementReached >= 4).length;
        const endedAt: Record<string, number> = {};
        for (const r of runs)
          if (r.outcome === 'defeat')
            endedAt[r.lastEncounter] = (endedAt[r.lastEncounter] ?? 0) + 1;
        const minutes = runs.reduce((s, r) => s + r.minutes, 0) / Math.max(1, runs.length);
        console.log(
          `  ${bases.length > 1 ? `set ${base} · ` : ''}${bot.padEnd(8)} won ${pct(won / seeds).padStart(4)} (${won}/${seeds}) · reached the Finale ${pct(reached / seeds)} · won ÷ reached ${reached ? pct(won / reached) : '-'} · ${minutes.toFixed(1)} min of combat · lost at ${JSON.stringify(endedAt)}`,
        );
      }
    }
  }
  console.log(`done in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
}

const argv = process.argv.slice(2);
const get = (name: string) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
};

const logit = (p: number) => {
  const q = Math.min(0.995, Math.max(0.005, p));
  return Math.log(q / (1 - q));
};

function main(): void {
  if (argv.includes('--tiers')) {
    tiers();
    return;
  }
  if (argv.includes('--echoes')) {
    echoes();
    return;
  }
  if (argv.includes('--weekly')) {
    weekly();
    return;
  }
  const loadout = CHORD_PRESETS.find((p) => p.id === (get('loadout') ?? 'guardian'))!;
  const seeds = Number(get('seeds') ?? 100);
  const bot = (get('bot') ?? 'skilled') as BotKind;
  const tree = buildTree([...TREES.grace!, ...TREES.notables!], 29);
  const carried = SETS.typical!();
  const runs = (threatMult: number, dissonance: { id: string; rank: number }[] = []) => {
    let won = 0;
    for (let i = 0; i < seeds; i++) {
      const seed = 5000 + i * 104729;
      const opts = { astrolabe: tree, carried, threatMult, dissonance };
      if (playRun(seed, bot, loadout.chords, opts).outcome === 'victory') won++;
    }
    return won / seeds;
  };
  const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

  if (argv.includes('--find')) {
    console.log(`dissonance base · ${bot} · tree ${tree.length} nodes · ${seeds} runs each`);
    const steps = (get('steps') ?? '1,1.3,1.5,1.7,1.9,2.1').split(',').map(Number);
    for (const t of steps) console.log(`  ×${t}: ${pct(runs(t))}`);
    return;
  }

  const threat = Number(get('threat') ?? 1.6);
  const levels = (get('levels') ?? CONTENT.dissonance.map((d) => d.id).join(','))
    .split(',')
    .map((s) => {
      const [id, rank] = s.split(':');
      return { id: id!, rank: Number(rank ?? 1) };
    });
  const base = Number(get('base') ?? NaN);
  const harder = Number(get('base-hard') ?? NaN);
  const hi = Number.isFinite(base) ? base : runs(threat);
  const lo = Number.isFinite(harder) ? harder : runs(threat * 1.25);
  console.log(
    `dissonance levels · ${bot} · ${seeds} runs each · base ×${threat}: ${pct(hi)}, ×${(threat * 1.25).toFixed(2)}: ${pct(lo)}`,
  );
  if (argv.includes('--combo')) {
    // The listed levels together, as one run's Dissonance.
    const win = runs(threat, levels);
    const life = (25 * (logit(hi) - logit(win))) / (logit(hi) - logit(lo));
    console.log(
      `  together (${dissonancePoints(levels)} pts): ${pct(win)} · like ${life.toFixed(1)}% more enemy life`,
    );
    return;
  }
  for (const level of levels) {
    const def = CONTENT.dissonance.find((d) => d.id === level.id);
    if (!def) throw new Error(`Unknown level "${level.id}"`);
    const win = runs(threat, [level]);
    // Enemy life that costs as much: 25% (one rank of Hardened) per base-to-harder step.
    const life = (25 * (logit(hi) - logit(win))) / (logit(hi) - logit(lo));
    console.log(
      `  ${`${def.name}${level.rank > 1 ? ` ×${level.rank}` : ''}`.padEnd(22)} ${pct(win)} · like ${life.toFixed(1)}% more enemy life · ${def.points * level.rank} pts now`,
    );
  }
}

if (process.argv[1]?.endsWith('dissonance.ts')) main();
