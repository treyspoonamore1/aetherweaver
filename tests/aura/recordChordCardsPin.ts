/**
 * Records the Chord builder's aura and ornament cards pin (docs/phase-7.md, ground rule 4; review
 * B, finding 2) into `chordCardsPin.json`, beside this file. It was run ONCE, on the tree at
 * 81a12ef (main before Phase 7's W0 changed any source: a `git archive` of it, with this file, the
 * fixture and the test copied in), and its output is committed:
 *
 *   npx tsx tests/aura/recordChordCardsPin.ts
 *
 * The cards are rendered by `chordCardsPin.test.ts` in record mode (the selected slot comes from
 * its `react` mock, so it needs the test runner). It refuses to overwrite the file: recording it
 * again on a later tree would pin that tree, which proves nothing. Only the owner, in person, may
 * approve a change to how an aura or an ornament looks (docs/phase-7.md).
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const PATH = fileURLToPath(new URL('./chordCardsPin.json', import.meta.url));
const ROOT = fileURLToPath(new URL('../..', import.meta.url));

if (existsSync(PATH)) {
  console.error(`${PATH} exists: the pin is recorded once, from the tree at 81a12ef.`);
  process.exit(1);
}
const r = spawnSync(
  'npx',
  ['vitest', 'run', 'tests/aura/chordCardsPin.test.ts', '--maxWorkers=1', '--testTimeout=300000'],
  { cwd: ROOT, stdio: 'inherit', env: { ...process.env, AW_RECORD_CHORD_CARDS: '1' } },
);
if (r.status !== 0 || !existsSync(PATH)) {
  console.error('the cards were not recorded');
  process.exit(1);
}
console.log(`wrote ${PATH}`);
