/**
 * Records the Dissonance pins (docs/phase-6.md, ground rule 2) into `dissonancePins.json`,
 * beside this file. It was run ONCE, on the tree before Phase 6's W0 changed any source, and its
 * output is committed:
 *
 *   npx tsx tests/sim/recordDissonancePins.ts
 *
 * It refuses to overwrite the file: recording it again on a later tree would pin that tree, which
 * proves nothing. `dissonancePins.test.ts` computes the pins again and compares.
 */
import { existsSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { computePins, serializePins } from './dissonancePinsFixture';

const PATH = fileURLToPath(new URL('./dissonancePins.json', import.meta.url));

if (existsSync(PATH)) {
  console.error(`${PATH} exists: the pins are recorded once, before Phase 6 changes any source.`);
  process.exit(1);
}
const t0 = performance.now();
writeFileSync(PATH, serializePins(computePins()));
console.log(`wrote ${PATH} in ${((performance.now() - t0) / 1000).toFixed(1)} s`);
