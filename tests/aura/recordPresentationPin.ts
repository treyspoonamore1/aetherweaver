/**
 * Records the aura presentation pin (docs/phase-7.md, ground rule 5) into `presentationPin.json`,
 * beside this file. It was run ONCE, on the tree before Phase 7's W0 changed any source (main at
 * 81a12ef), with default settings, and its output is committed:
 *
 *   npx tsx --tsconfig tsconfig.app.json tests/aura/recordPresentationPin.ts
 *
 * It refuses to overwrite the file: recording it again on a later tree would pin that tree, which
 * proves nothing. `presentationPin.test.ts` computes the pin again, with default settings and with
 * every comfort option at its strongest, and compares both with the file. Only the owner, in
 * person, may approve a change to an aura's or an ornament's look or sound (docs/phase-7.md).
 */
import { existsSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { computePin, serializePin } from './presentationPinFixture';

const PATH = fileURLToPath(new URL('./presentationPin.json', import.meta.url));

if (existsSync(PATH)) {
  console.error(`${PATH} exists: the pin is recorded once, before Phase 7 changes any source.`);
  process.exit(1);
}
const t0 = performance.now();
writeFileSync(PATH, serializePin(await computePin()));
console.log(`wrote ${PATH} in ${((performance.now() - t0) / 1000).toFixed(1)} s`);
