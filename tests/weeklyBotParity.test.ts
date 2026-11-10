/**
 * The UI lab bench's recorder (`src/ui/lab/weeklyBot.ts`) is the command line's
 * (`tools/run-verify.ts`'s `recordBotRun`), line for line (docs/phase-6.md, *Open* 4; docs/phase-7.md,
 * W9). The browser can't import the tool (it reads and writes files), so the lab keeps the loop;
 * this test fails the moment the two drift.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as Run from '../src/meta/run';
import { recordBotRun as benchRecord } from '../src/ui/lab/weeklyBot';
import { recordBotRun as toolRecord } from '../tools/run-verify';

/** Two whole Preludes, played by a bot. */
const SLOW = 180_000;

/** The text of `export function recordBotRun(...) {...}` in a source file. */
function loopSource(path: string): string {
  const text = readFileSync(new URL(path, import.meta.url), 'utf8');
  const start = text.indexOf('export function recordBotRun(');
  expect(start, path).toBeGreaterThanOrEqual(0);
  const end = text.indexOf('\n}\n', start);
  expect(end, path).toBeGreaterThan(start);
  return text.slice(start, end + 2);
}

describe("the lab bench's recorder is the command line's", () => {
  it('has the same source, line for line', () => {
    expect(loopSource('../src/ui/lab/weeklyBot.ts')).toBe(loopSource('../tools/run-verify.ts'));
  });

  it(
    'records the same Prelude: the same replay, end state and ticks',
    () => {
      const start = Run.embark(Run.newRun(2000));
      const bench = benchRecord(start, 'skilled');
      const tool = toolRecord(start, 'skilled');
      expect(bench.replay).toEqual(tool.replay);
      expect(bench.run).toEqual(tool.run);
      expect(bench.ticks).toBe(tool.ticks);
      expect(bench.run.phase).toBe('summary');
    },
    SLOW,
  );
});
