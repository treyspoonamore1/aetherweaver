/**
 * Re-simulates a replay file and checks it lands on the recorded hash.
 *   npm run sim:replay -- path/to/file.replay.json
 *
 * Exits 0 on a match, 1 on a mismatch, 2 on bad usage, and 3 for a replay recorded by an older
 * format, which this build cannot play back (docs/solos.md: there is no Cue command any more).
 */
import { readFileSync } from 'node:fs';
import { parseReplay, runReplay } from '../src/sim/replay';

const file = process.argv[2];
if (!file) {
  console.error('usage: npm run sim:replay -- <file.replay.json>');
  process.exit(2);
}
/** An old replay is refused by name (`OldReplayError`, src/sim/replay.ts): say so, plainly. */
function read(path: string): ReturnType<typeof parseReplay> {
  try {
    return parseReplay(JSON.parse(readFileSync(path, 'utf8')));
  } catch (error) {
    if (error instanceof Error && error.name === 'OldReplayError') {
      console.error(error.message);
      process.exit(3);
    }
    throw error;
  }
}
const replay = read(file);
const result = runReplay(replay);
console.log(
  `seed ${replay.config.seed} · ${result.tick} ticks · ${replay.frames.length} command frames`,
);
console.log(`recorded ${replay.finalHash}`);
console.log(`replayed ${result.hash}`);
if (result.versionMismatch) console.warn(`⚠ version mismatch: ${result.versionMismatch}`);
console.log(result.matches ? '✔ bit-exact match' : '✘ MISMATCH');
process.exit(result.matches ? 0 : 1);
