/**
 * Re-simulates a replay file and checks it lands on the recorded hash.
 *   npm run sim:replay -- path/to/file.replay.json
 */
import { readFileSync } from 'node:fs';
import { parseReplay, runReplay } from '../src/sim/replay';

const file = process.argv[2];
if (!file) {
  console.error('usage: npm run sim:replay -- <file.replay.json>');
  process.exit(2);
}
const replay = parseReplay(JSON.parse(readFileSync(file, 'utf8')));
const result = runReplay(replay);
console.log(
  `seed ${replay.config.seed} · ${result.tick} ticks · ${replay.frames.length} command frames`,
);
console.log(`recorded ${replay.finalHash}`);
console.log(`replayed ${result.hash}`);
if (result.versionMismatch) console.warn(`⚠ version mismatch: ${result.versionMismatch}`);
console.log(result.matches ? '✔ bit-exact match' : '✘ MISMATCH');
process.exit(result.matches ? 0 : 1);
