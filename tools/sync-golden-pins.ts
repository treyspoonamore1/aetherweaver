/**
 * Copies the hashes of `tests/sim/golden.json` into the literals of
 * `tests/sim/m1Unchanged.test.ts`, which pins every golden a second time so that
 * `npm run golden:update` alone cannot move one unseen.
 *
 * Run it only when a change that every fight plays by has re-recorded the goldens on purpose
 * (so far: the Solo rework, docs/solos.md), after `npx tsx tools/update-golden.ts --write`, and
 * say why in the commit:
 *
 *   npx tsx tools/sync-golden-pins.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const goldenPath = fileURLToPath(new URL('../tests/sim/golden.json', import.meta.url));
const testPath = fileURLToPath(new URL('../tests/sim/m1Unchanged.test.ts', import.meta.url));
const golden = JSON.parse(readFileSync(goldenPath, 'utf8')) as {
  scenarios: Record<string, string>;
};
let text = readFileSync(testPath, 'utf8');
let moved = 0;
const missing: string[] = [];
for (const [name, hash] of Object.entries(golden.scenarios)) {
  // A pin is `name: 'hash'` or `'name': 'hash'`, a 16-digit hex literal.
  const key = /^[A-Za-z_$][\w$]*$/.test(name) ? `(?:'${name}'|${name})` : `'${name}'`;
  const pin = new RegExp(`(${key}:\\s*')([0-9a-f]{16})(')`);
  const found = pin.exec(text);
  if (!found) {
    missing.push(name);
    continue;
  }
  if (found[2] !== hash) {
    text = text.replace(pin, `$1${hash}$3`);
    moved++;
  }
}
if (missing.length > 0) throw new Error(`No pin in m1Unchanged.test.ts for: ${missing.join(', ')}`);
writeFileSync(testPath, text);
console.log(`${moved} pins moved in tests/sim/m1Unchanged.test.ts.`);
