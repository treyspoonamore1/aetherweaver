// Whole runs as the Expedition baselines play them, now against what the baseline holds.
import { readFileSync } from 'node:fs';
import { type RunSummary } from '/home/user/aw-work/wt-p11solo/tools/harness-core';
import { expeditionRun } from '/home/user/aw-work/wt-p11solo/tools/expedition-baseline';

const movements = Number(process.argv[2] ?? 2);
const file =
  movements === 2
    ? 'expedition-baseline.json'
    : `expedition${movements}-baseline.json`;
const base = JSON.parse(
  readFileSync(`/home/user/aw-work/wt-p11solo/tools/${file}`, 'utf8'),
) as { runs: RunSummary[] };
const seen = new Map<string, number>();
for (const b of base.runs) {
  const i = seen.get(b.bot) ?? 0;
  seen.set(b.bot, i + 1);
  const t0 = Date.now();
  const now = expeditionRun(b.bot as 'novice' | 'skilled', i, movements);
  console.log(
    `${b.bot.padEnd(8)} ${b.seed}  before: ${b.outcome.padEnd(8)} M${b.movementReached} ${String(b.fights).padStart(2)} fights ${b.minutes.toFixed(1)} min (${b.lastEncounter})   now: ${now.outcome.padEnd(8)} M${now.movementReached} ${String(now.fights).padStart(2)} fights ${now.minutes.toFixed(1)} min (${now.lastEncounter})  [${((Date.now() - t0) / 1000).toFixed(0)}s]`,
  );
}
