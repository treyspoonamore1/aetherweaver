/**
 * Phase 8c (docs/phase-8.md, "the fight out from under the interface"), in the real game: a
 * miniboss fight keeps the boss clear of the boss bar and the Weaver clear of the Weaver bar; the
 * boss's decree and the coach's hint are in the notes column, off the arena's middle; the key
 * reminders are in the pause menu's Controls.
 */
import { expect, test, type Page } from '@playwright/test';

const START_URL = '/?e2e=1&seed=4242';

function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(err.message));
  return errors;
}

test('a miniboss fight: the boss and the Weaver stand clear of the HUD; notes at the top right; Controls in the pause menu', async ({
  page,
}) => {
  test.setTimeout(240_000);
  const errors = trackErrors(page);
  await page.goto(START_URL);
  await page.waitForFunction(() => window.__AWRUN__ !== undefined);
  await page.evaluate(() => window.__AWRUN__!.newRun(4242, 'prelude'));
  await expect.poll(() => page.evaluate(() => window.__AWRUN__!.phase())).toBe('prep');
  await page.evaluate(() => window.__AWRUN__!.embark());
  await expect.poll(() => page.evaluate(() => window.__AWRUN__!.phase())).toBe('map');
  expect(await page.evaluate(() => window.__AWRUN__!.warp('miniboss'))).toBe('combat');
  await page.waitForFunction(() => window.__AW__ !== undefined);
  const begin = page.getByRole('button', { name: /Begin the fight/ });
  if (await begin.isVisible().catch(() => false)) await begin.click();
  await page.evaluate(() => window.__AW__!.autoplay('skilled'));

  // The fight opens already framed: the Weaver low in the view before the Bellwarden arrives.
  await page.waitForFunction(() => window.__AW__!.tick() >= 60, null, { timeout: 60_000 });
  const figure = (kind: string) =>
    page.evaluate((k) => window.__AW__!.figures().find((f) => f.kind === k) ?? null, kind);
  const opening = (await figure('weaver'))!;
  expect((opening.top + opening.bottom) / 2).toBeGreaterThan(360);

  // Ten seconds in: the Bellwarden has arrived and the party has closed with it.
  await page.waitForFunction(() => window.__AW__!.tick() >= 600, null, { timeout: 150_000 });
  await page.evaluate(() => window.__AW__!.setDevTimeScale(0));
  const boss = (await figure('miniboss'))!;
  const weaver = (await figure('weaver'))!;
  const bossBar = (await page.getByTestId('boss-bar').boundingBox())!;
  const weaverBar = (await page.getByTestId('weaver-bar').boundingBox())!;
  // All of the boss under the boss bar's lower edge, on the screen; all of the Weaver over the
  // Weaver bar.
  expect(boss.top).toBeGreaterThanOrEqual(bossBar.y + bossBar.height - 2);
  expect(boss.left).toBeGreaterThanOrEqual(0);
  expect(boss.right).toBeLessThanOrEqual(1280);
  expect(weaver.bottom).toBeLessThanOrEqual(weaverBar.y + 2);
  expect(weaver.top).toBeGreaterThanOrEqual(bossBar.y + bossBar.height);

  // The slimmer boss bar: within 8 px of the top edge.
  expect(bossBar.y).toBeLessThanOrEqual(8.5);
  // The notes column holds the key reminders (a new player's first fights), at the top right and
  // clear of the boss bar.
  const notes = (await page.getByTestId('hud-notes').boundingBox())!;
  expect(notes.x).toBeGreaterThan(bossBar.x + bossBar.width);
  await expect(page.getByTestId('hud-notes').getByLabel('Controls')).toBeVisible();
  // A decree, once the boss has one, is in the column and not under the bar.
  const decree = page.getByTestId('decree-line');
  if ((await decree.count()) > 0) {
    const at = (await decree.first().boundingBox())!;
    expect(at.x).toBeGreaterThan(bossBar.x + bossBar.width);
  }

  // The pause menu's Controls: the same reminders on demand.
  await page.evaluate(() => window.__AW__!.setDevTimeScale(1));
  await page.keyboard.press('Escape');
  await page.getByTestId('pause-controls-open').click();
  await expect(page.getByTestId('pause-controls')).toContainText('Thread a hero');
  await expect(page.getByTestId('pause-controls')).toContainText('Pause');
  await page.getByRole('button', { name: 'Back to the pause menu' }).click();
  await expect(page.getByTestId('edit-layout')).toBeVisible();
  expect(errors).toEqual([]);
});
