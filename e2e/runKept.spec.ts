/**
 * A saved run outlives the page closing before it is resumed: the game opened with a run saved
 * mid-Movement, and the tab reloaded at the Title (twice) and at the Loom, keeps the run and its
 * backup byte for byte, and the Title still offers Continue (`runStore.ts`, its save on `pagehide`).
 */
import { expect, test, type Page } from '@playwright/test';

const START_URL = '/?e2e=1&seed=4242';
const KEYS = ['aetherweaver.run', 'aetherweaver.run.bak'] as const;

async function ready(page: Page): Promise<void> {
  await page.waitForFunction(() => window.__AWRUN__ !== undefined);
}

async function stored(page: Page): Promise<Record<string, string | null>> {
  return page.evaluate(
    (keys) => Object.fromEntries(keys.map((k) => [k, localStorage.getItem(k)])),
    [...KEYS],
  );
}

const continueButton = (page: Page) => page.getByRole('button', { name: /^Continue/ }).first();

test('a saved run survives reloads at the Title and the Loom before it is resumed', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));
  await page.goto(START_URL);
  await ready(page);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await ready(page);
  // A run mid-Movement: embarked and a fight chosen, saved as it goes.
  await page.evaluate(() => {
    window.__AWRUN__!.newRun(4242);
    window.__AWRUN__!.embark();
    window.__AWRUN__!.choose();
  });
  const saved = await stored(page);
  for (const k of KEYS) expect(saved[k], k).not.toBeNull();

  // The page starts again at the Title, with the run saved and not resumed.
  await page.reload();
  await ready(page);
  await expect(continueButton(page)).toBeVisible();
  expect(await stored(page)).toEqual(saved);

  // Reloaded at the Title again: still there.
  await page.reload();
  await ready(page);
  await expect(continueButton(page)).toBeVisible();
  expect(await stored(page)).toEqual(saved);

  // …and reloaded at the Loom.
  await page.getByRole('button', { name: 'Enter the Loom' }).click();
  await page.reload();
  await ready(page);
  await expect(continueButton(page)).toBeVisible();
  expect(await stored(page)).toEqual(saved);
  expect(errors).toEqual([]);
});
