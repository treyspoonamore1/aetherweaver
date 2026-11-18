// Dumps the Brann UI pin's values (before hashing) and the Codex heroes page, to compare two
// trees piece by piece.  cp to tests/, DUMP_OUT=<prefix> npx vitest run tests/zzDump.test.ts, remove.
import { writeFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { it } from 'vitest';
import { heroDef } from '../src/content';
import { brannUiPin } from './uiPhase5eBrannPin';

it('dump', async () => {
  const out = process.env.DUMP_OUT!;
  writeFileSync(`${out}-pin.json`, JSON.stringify(await brannUiPin(), null, 1));
  const mod = (await import('../src/ui/screens/CodexScreen')) as Record<string, never>;
  const html = renderToStaticMarkup(
    createElement(mod.CodexView, {
      onBack: () => {},
      initialTab: 'heroes',
      roster: ['kael', 'lyra', 'vexis', 'brann'],
    } as never),
  );
  let stripped = html;
  for (const id of ['seren', 'oro']) stripped = stripped.replace(heroDef(id).recruit!.lockedText!, '');
  writeFileSync(`${out}-codex.html`, stripped.replace(/></g, '>\n<'));
}, 120000);
