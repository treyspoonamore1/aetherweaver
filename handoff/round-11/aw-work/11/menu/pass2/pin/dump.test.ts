// Dumps the Brann UI pin's values and hashes, and the Codex heroes page's markup, so two trees
// can be compared line by line.
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { createElement, type FunctionComponent } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { it } from 'vitest';
import { heroDef } from '../src/content';
import { brannUiPin } from './uiPhase5eBrannPin';
it('dump', async () => {
  const pin = await brannUiPin();
  const hashes: Record<string, string> = {};
  for (const [k, v] of Object.entries(pin))
    hashes[k] = createHash('sha256').update(JSON.stringify(v)).digest('hex').slice(0, 16);
  const path = '../src/ui/screens/CodexScreen';
  const mod = (await import(/* @vite-ignore */ path)) as Record<string, FunctionComponent<Record<string, unknown>>>;
  const html = renderToStaticMarkup(
    createElement(mod.CodexView!, { onBack: () => {}, initialTab: 'heroes', roster: ['kael', 'lyra', 'vexis', 'brann'] }),
  );
  let stripped = html;
  for (const id of ['seren', 'oro']) stripped = stripped.replace(heroDef(id).recruit!.lockedText!, '');
  writeFileSync(process.env.PIN_OUT!, JSON.stringify({ pin, hashes, heroes: stripped, heroesHash: createHash('sha256').update(stripped).digest('hex') }, null, 1));
});
