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
