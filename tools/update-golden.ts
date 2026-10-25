/**
 * Regenerates tests/sim/golden.json. Run ONLY when a sim or content change is meant to change
 * results (bump SIM_VERSION if old replays should be invalidated). Prints what changed;
 * writes only with `--write` (`npm run golden:update`). docs/plan/05 §4.9.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CONTENT_VERSION } from '../src/content';
import { SIM_VERSION } from '../src/sim/constants';
import { runScenario } from './runScenario';
import { SCENARIOS } from './scenarios';

interface Golden {
  simVersion: number;
  contentVersion: string;
  scenarios: Record<string, string>;
}

const path = fileURLToPath(new URL('../tests/sim/golden.json', import.meta.url));
const previous: Golden | null = existsSync(path)
  ? (JSON.parse(readFileSync(path, 'utf8')) as Golden)
  : null;
const next: Golden = {
  simVersion: SIM_VERSION,
  contentVersion: CONTENT_VERSION,
  scenarios: Object.fromEntries(SCENARIOS.map((s) => [s.name, runScenario(s).hash])),
};

const changes: string[] = [];
if (previous?.simVersion !== next.simVersion)
  changes.push(`simVersion ${previous?.simVersion} → ${next.simVersion}`);
if (previous?.contentVersion !== next.contentVersion) {
  changes.push(`contentVersion ${previous?.contentVersion} → ${next.contentVersion}`);
}
for (const [name, hash] of Object.entries(next.scenarios)) {
  const old = previous?.scenarios[name];
  if (old !== hash) changes.push(`${name}: ${old ?? '(new)'} → ${hash}`);
}
for (const name of Object.keys(previous?.scenarios ?? {})) {
  if (!(name in next.scenarios)) changes.push(`${name}: removed`);
}

if (changes.length === 0) {
  console.log('Goldens are up to date.');
} else {
  console.log(changes.map((c) => `  ${c}`).join('\n'));
  if (process.argv.includes('--write')) {
    writeFileSync(path, JSON.stringify(next, null, 2) + '\n');
    console.log(`Wrote ${path}. Commit it with a note on why results changed.`);
  } else {
    console.log('Dry run: pass --write to update tests/sim/golden.json.');
  }
}
