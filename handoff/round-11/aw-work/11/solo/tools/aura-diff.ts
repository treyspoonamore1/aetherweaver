import { readFileSync } from 'node:fs';
import { DEFAULT_SETTINGS } from '/home/user/aw-work/wt-p11solo/src/app/settings';
import { computePin, serializePin } from '/home/user/aw-work/wt-p11solo/tests/aura/presentationPinFixture';

async function main(): Promise<void> {
const file = readFileSync('/home/user/aw-work/wt-p11solo/tests/aura/presentationPin.json', 'utf8');
const now = serializePin(await computePin(DEFAULT_SETTINGS));
const a = file.split('\n');
const b = now.split('\n');
const diff: string[] = [];
for (let i = 0; i < Math.max(a.length, b.length); i++)
  if (a[i] !== b[i]) diff.push(`line ${i + 1}: ${a[i]} -> ${b[i]}`);
console.log(`${a.length} lines in the file, ${b.length} computed, ${diff.length} differ`);
for (const d of diff.slice(0, 10)) console.log(d);
}
void main();
