/**
 * Deeds report (docs/phase-4b.md): how often a whole Prelude run earns each Deed, per bot, and
 * after how many runs of a "career" (the seeds in order) each is first earned.
 *
 *   npx tsx tools/deeds.ts --seeds 200                     both bots, Guardian, no Calling
 *   npx tsx tools/deeds.ts --bots skilled --calling martyr --seeds 100
 */
import type { BotKind } from '../src/bots';
import { CONTENT } from '../src/content';
import { deedsEarned } from '../src/meta/deeds';
import { CHORD_PRESETS } from '../src/meta/run';
import type { RunState } from '../src/meta/types';
import { playRun } from './harness-core';

const argv = process.argv.slice(2);
const get = (name: string) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
};

function main(): void {
  const loadout = CHORD_PRESETS.find((p) => p.id === (get('loadout') ?? 'guardian'));
  if (!loadout) throw new Error(`Unknown loadout (${CHORD_PRESETS.map((p) => p.id)})`);
  const seeds = Number(get('seeds') ?? 100);
  const bots = (get('bots') ?? 'novice,skilled').split(',') as BotKind[];
  const calling = get('calling');
  const tree = (get('tree') ?? '').split(',').filter(Boolean);
  console.log(
    `deeds · loadout ${loadout.name} · ${calling ?? 'no Calling'} · ${seeds} runs a bot` +
      (tree.length ? ` · tree ${tree.length} nodes` : ''),
  );
  for (const bot of bots) {
    const count = new Map<string, number>();
    const first = new Map<string, number>();
    let wins = 0;
    for (let i = 0; i < seeds; i++) {
      const seed = 3000 + i * 6007;
      let run: RunState | undefined;
      const summary = playRun(seed, bot, loadout.chords, {
        ...(calling
          ? { calling, path: [i % 2, (i >> 1) % 2, i % 2, (i >> 1) % 2] as (0 | 1)[] }
          : {}),
        astrolabe: tree,
        onEnd: (r) => (run = r),
      });
      if (summary.outcome === 'victory') wins++;
      for (const id of run ? deedsEarned(run, []) : []) {
        count.set(id, (count.get(id) ?? 0) + 1);
        if (!first.has(id)) first.set(id, i + 1);
      }
    }
    console.log(`\n${bot}: won ${Math.round((wins / seeds) * 100)}% of runs`);
    console.log(`  ${'Deed'.padEnd(20)} pt  runs earning   first earned in run`);
    for (const d of CONTENT.deeds) {
      const n = count.get(d.id) ?? 0;
      const pct = `${Math.round((n / seeds) * 100)}%`.padStart(4);
      console.log(
        `  ${d.name.padEnd(20)} ${d.points ? '★ ' : '  '}  ${pct}          ${first.get(d.id) ?? '-'}`,
      );
    }
  }
}

if (process.argv[1]?.endsWith('deeds.ts')) main();
