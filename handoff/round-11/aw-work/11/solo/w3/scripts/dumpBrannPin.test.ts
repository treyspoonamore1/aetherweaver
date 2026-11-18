// Dumps the Brann UI pin's values (not hashes) to AW_PIN_OUT, to compare two trees line by line.
import { writeFileSync } from 'node:fs';
import { it } from 'vitest';
import { brannUiPin } from './uiPhase5eBrannPin';
it('dump', async () => {
  writeFileSync(process.env.AW_PIN_OUT!, JSON.stringify(await brannUiPin(), null, 1));
});
