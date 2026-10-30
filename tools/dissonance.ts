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
 */
import type { BotKind } from '../src/bots';
import { CONTENT } from '../src/content';
import { dissonancePoints } from '../src/meta/dissonance';
import { CHORD_PRESETS } from '../src/meta/run';
import { buildTree, TREES } from './astrolabe';
import { playRun } from './harness-core';
import { SETS } from './reliquary';

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
