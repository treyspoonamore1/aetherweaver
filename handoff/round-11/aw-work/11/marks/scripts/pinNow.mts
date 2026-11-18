// pinNow.ts <out.json>: computes the aura presentation pin on the tree it is run in (cwd) and
// writes it to a scratch file (never the pin itself), for pindiff.py.
import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const { computePin, serializePin } = await import(
  pathToFileURL(`${process.cwd()}/tests/aura/presentationPinFixture.ts`).href
);
const out = process.argv[2]!;
writeFileSync(out, serializePin(await computePin()));
console.log('wrote', out);
