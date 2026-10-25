/**
 * Calling report (docs/phase-3c.md): whole Prelude runs with a Calling, every path played, against
 * the same seeds with no Calling. Each of the 2^tiers paths gets its own `--seeds` seeds, so a
 * report at 50 seeds is 800 runs a bot; each tier's two options are compared over the half of
 * the runs that took each one.
 *
 *   npx tsx tools/callings.ts --loadout guardian --seeds 50
 *   npx tsx tools/callings.ts --calling luminary --loadout steady --seeds 25 --bots skilled
 */
import type { BotKind } from '../src/bots';
import { callingDef } from '../src/content';
import { CHORD_PRESETS } from '../src/meta/run';
import { playRun } from './harness-core';

const argv = process.argv.slice(2);
const get = (name: string) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
};
const calling = callingDef(get('calling') ?? 'luminary');
const loadout = CHORD_PRESETS.find((p) => p.id === (get('loadout') ?? 'guardian'));
if (!loadout) throw new Error(`Unknown loadout (${CHORD_PRESETS.map((p) => p.id)})`);
const seeds = Number(get('seeds') ?? 50);
const bots = (get('bots') ?? 'novice,skilled').split(',') as BotKind[];
const tiers = calling.tiers.length;
const paths = Array.from({ length: 2 ** tiers }, (_, p) =>
  Array.from({ length: tiers }, (_, t) => ((p >> (tiers - 1 - t)) & 1) as 0 | 1),
);
const pct = (x: number) => `${Math.round(x * 100)}%`;
const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / Math.max(1, xs.length);

console.log(
  `calling report · ${calling.name} · loadout ${loadout.name} · ${paths.length} paths × ${seeds} seeds`,
);
for (const bot of bots) {
  const base: number[] = [];
  const byPath: number[] = [];
  paths.forEach((path, p) => {
    let won = 0;
    let wonWith = 0;
    for (let i = 0; i < seeds; i++) {
      const seed = 2000 + (p * seeds + i) * 104729;
      if (playRun(seed, bot, loadout.chords).outcome === 'victory') won++;
      const run = playRun(seed, bot, loadout.chords, { calling: calling.id, path });
      if (run.outcome === 'victory') wonWith++;
    }
    base.push(won / seeds);
    byPath.push(wonWith / seeds);
  });
  console.log(
    `${bot.padEnd(8)} no Calling ${pct(mean(base))} · ${calling.name} ${pct(mean(byPath))} (all paths)`,
  );
  calling.tiers.forEach((tier, t) => {
    const took = (k: 0 | 1) => mean(byPath.filter((_, p) => paths[p]![t] === k));
    const [a, b] = tier.options;
    console.log(`  tier ${t + 1}: ${a!.name} ${pct(took(0))} · ${b!.name} ${pct(took(1))}`);
  });
  console.log(
    `  by path: ${paths.map((path, p) => `${path.join('')} ${pct(byPath[p]!)}`).join(' · ')}`,
  );
}
