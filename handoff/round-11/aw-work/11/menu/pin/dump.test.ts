// Dumps the Brann UI pin's values and their hashes so two trees can be compared line by line.
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { it } from 'vitest';
import { brannUiPin } from './uiPhase5eBrannPin';
it('dump', async () => {
  const pin = await brannUiPin();
  const hashes: Record<string, string> = {};
  for (const [k, v] of Object.entries(pin))
    hashes[k] = createHash('sha256').update(JSON.stringify(v)).digest('hex').slice(0, 16);
  writeFileSync(process.env.PIN_OUT!, JSON.stringify({ pin, hashes }, null, 1));
});
