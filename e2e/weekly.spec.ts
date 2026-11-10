/**
 * Phase 6: This Week's Song, same browser, bit for bit (docs/phase-6.md, "Tests" and "Exit
 * criteria"). In the page, a worker plays this week's run with the Skilled bot through the run
 * functions and records it; the game's verifier (its own worker) checks the replay on this
 * device; a second play in a fresh worker gives every fight's final hash and the run digest
 * again; the replay is also checked against the same verifier in Node, and the result reported
 * (a match is expected, not required).
 */
import { expect, test, type Page } from '@playwright/test';
import { verifyRunReplay } from '../src/meta/runReplay';
import type { BenchPlay } from '../src/ui/lab/weeklyBenchTypes';
import '../src/ui/lab/weeklyBenchTypes';

function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(err.message));
  return errors;
}

async function openBench(page: Page): Promise<void> {
  await page.goto('/?lab=ui&view=p6-weekly-bench&nav=0&fit=0');
  await expect(page.getByTestId('weekly-bench')).toBeVisible();
  await page.waitForFunction(() => window.__AWBENCH__ !== undefined);
}

test('Phase 6: a weekly played in a page worker verifies in the page, and plays the same twice', async ({
  page,
}) => {
  test.setTimeout(600_000);
  const errors = trackErrors(page);
  await openBench(page);
  const week = await page.evaluate(() => window.__AWBENCH__!.week());

  // First play, in a page-side worker, through the run functions.
  const first: BenchPlay = await page.evaluate((w) => window.__AWBENCH__!.playWeekly(w), week);
  expect(first.error ?? null).toBeNull();
  expect(first.ok).toBe(true);
  const replay = first.replay as { kind: string; week: number; claim: { digest: string } };
  expect(replay.kind).toBe('weekly');
  expect(replay.week).toBe(week);
  const code = await page.evaluate((r) => window.__AWBENCH__!.code(r), first.replay);
  expect(code).toMatch(/^AW1-/);

  // Verified in the page, by the game's verifier, with its own code.
  const verified = await page.evaluate(([r, c]) => window.__AWBENCH__!.verify(r, c ?? undefined), [
    first.replay,
    code,
  ] as const);
  expect(verified.status, verified.message).toBe('verified');

  // A second play in a fresh worker: every fight's hash and the digest are the same.
  const second: BenchPlay = await page.evaluate((w) => window.__AWBENCH__!.playWeekly(w), week);
  expect(second.ok).toBe(true);
  const a = await page.evaluate((r) => window.__AWBENCH__!.hashes(r), first.replay);
  const b = await page.evaluate((r) => window.__AWBENCH__!.hashes(r), second.replay);
  expect(a.fights.length).toBeGreaterThan(0);
  expect(b).toEqual(a);

  // A tampered claim doesn't match (the verifier reads the replay, not its word).
  const forged = JSON.parse(JSON.stringify(first.replay)) as { claim: { score: number } };
  forged.claim.score += 100;
  const refused = await page.evaluate((r) => window.__AWBENCH__!.verify(r), forged);
  expect(refused.status).toBe('mismatch');

  // The same file, verified in Node (another engine: reported, not required).
  const node = verifyRunReplay(first.replay, code ?? undefined);
  const note = `Node: ${node.status}: ${node.message} (page: ${first.ms?.toFixed(0)} ms to play, ${verified.ms.toFixed(0)} ms to verify; ${first.ticks} ticks)`;
  test.info().annotations.push({ type: 'node', description: note });
  console.log(note);
  expect(errors).toEqual([]);
});
