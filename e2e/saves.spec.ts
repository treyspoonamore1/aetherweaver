/**
 * Saves through the panel (docs/phase-7.md, W5): export a file and a code from Settings → Progress,
 * import each over other saves (the page starts again on them, byte for byte as exported, the
 * replaced saves kept under `.before-import`), garbage refused in words, and a profile that won't
 * load kept raw and offered for download.
 */
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { DEFAULT_SETTINGS } from '../src/app/settings';
import { newProfile } from '../src/meta/profile';
import { chooseNode, embark, newRun, reachable } from '../src/meta/run';

const START_URL = '/?e2e=1&seed=4242';
const KEYS = ['aetherweaver.profile', 'aetherweaver.run', 'aetherweaver.settings'] as const;

function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(err.message));
  return errors;
}

async function stored(page: Page): Promise<Record<string, string | null>> {
  return page.evaluate(
    (keys) => Object.fromEntries(keys.map((k) => [k, localStorage.getItem(k)])),
    [...KEYS],
  );
}

async function ready(page: Page): Promise<void> {
  await page.waitForFunction(() => window.__AWRUN__ !== undefined);
}

/** The Title's Settings, scrolled to the Saves panel. */
async function openSaves(page: Page): Promise<void> {
  await page
    .getByRole('button', { name: /^Settings$/ })
    .first()
    .click();
  await page.getByTestId('saves-panel').scrollIntoViewIfNeeded();
  await expect(page.getByTestId('saves-panel')).toBeVisible();
}

/** Replaces this browser's saves with others (a different Weaver, no run), and starts again. */
async function otherSaves(page: Page): Promise<void> {
  const other = JSON.stringify({ ...newProfile(9), xp: 40, runs: 1 });
  await page.evaluate((profile) => {
    localStorage.clear();
    localStorage.setItem('aetherweaver.profile', profile);
  }, other);
  await page.reload();
  await ready(page);
}

/** Confirms the import shown, and waits for the page to start again on it. */
async function confirmImport(page: Page, withSettings: boolean): Promise<void> {
  const preview = page.getByTestId('saves-preview');
  await expect(preview).toContainText('Weaver Rank 10');
  await expect(preview).toContainText('7 runs, 3 won');
  await expect(preview).toContainText(/A run in progress: Movement 1 of \d/);
  if (withSettings) await page.getByTestId('saves-with-settings').check();
  await Promise.all([page.waitForEvent('load'), page.getByTestId('saves-import-confirm').click()]);
  await ready(page);
}

test('export a file and a code, import each through the panel, refuse garbage', async ({
  page,
}, testInfo) => {
  test.setTimeout(240_000);
  const errors = trackErrors(page);
  await page.goto(START_URL);
  await ready(page);
  // A Weaver some way in: Rank 10, seven runs, a run in progress, a setting changed.
  const profile = JSON.stringify({ ...newProfile(3), xp: 4400, runs: 7, wins: 3 });
  await page.evaluate((p) => localStorage.setItem('aetherweaver.profile', p), profile);
  await page.reload();
  await ready(page);
  await page.evaluate(() => {
    window.__AWRUN__!.newRun(4242);
    window.__AWRUN__!.embark();
    window.__AWRUN__!.choose();
  });
  // The run is saved; back to the Title (the page saves the run in play as it unloads).
  await page.reload();
  await ready(page);
  await openSaves(page);
  await page.getByText('Skip the unlocks', { exact: true }).click();
  const mine = await stored(page);
  for (const k of KEYS) expect(mine[k], k).not.toBeNull();

  // Export: the file, then the code.
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('saves-export-file').click(),
  ]);
  expect(download.suggestedFilename()).toBe('aetherweaver-save.json');
  const path = testInfo.outputPath('aetherweaver-save.json');
  await download.saveAs(path);
  const file = readFileSync(path);
  expect(JSON.parse(file.toString('utf8'))).toMatchObject({
    format: 'aetherweaver-save',
    version: 1,
  });
  await page.getByTestId('saves-export-code').click();
  const code = await page.getByTestId('saves-code-out').inputValue();
  expect(code).toMatch(/^AWSAVE1\.[0-9a-f]{8}\.[A-Za-z0-9_-]+$/);
  // Exporting changed nothing.
  expect(await stored(page)).toEqual(mine);

  // Import the file over other saves: byte for byte as they were, the replaced ones kept.
  await otherSaves(page);
  const replaced = await stored(page);
  await openSaves(page);
  await page.getByTestId('saves-import-file').setInputFiles(path);
  await confirmImport(page, true);
  expect(await stored(page)).toEqual(mine);
  expect(
    await page.evaluate(() => localStorage.getItem('aetherweaver.profile.before-import')),
  ).toBe(replaced['aetherweaver.profile']);
  // The Title offers the imported run.
  await expect(page.getByRole('button', { name: /Continue/i }).first()).toBeVisible();

  // Import the code the same way (settings left as they are this time).
  await otherSaves(page);
  const settingsBefore = (await stored(page))['aetherweaver.settings'];
  await openSaves(page);
  await page.getByTestId('saves-code-in').fill(`${code.slice(0, 50)}\n${code.slice(50)}`);
  await page.getByTestId('saves-read-code').click();
  await confirmImport(page, false);
  const afterCode = await stored(page);
  expect(afterCode['aetherweaver.profile']).toBe(mine['aetherweaver.profile']);
  expect(afterCode['aetherweaver.run']).toBe(mine['aetherweaver.run']);
  expect(afterCode['aetherweaver.settings']).toBe(settingsBefore);

  // Garbage, refused in words, and nothing written.
  await openSaves(page);
  const before = await stored(page);
  await page.getByTestId('saves-import-file').setInputFiles({
    name: 'notes.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"hello":"world"}'),
  });
  await expect(page.getByTestId('saves-error')).toHaveText(
    'This isn’t an Aetherweaver save, so nothing was imported.',
  );
  const typo = code.slice(0, -12) + (code.at(-12) === 'A' ? 'B' : 'A') + code.slice(-11);
  await page.getByTestId('saves-code-in').fill(typo);
  await page.getByTestId('saves-read-code').click();
  await expect(page.getByTestId('saves-error')).toContainText('This code has a typo');
  await expect(page.getByTestId('saves-preview')).toHaveCount(0);
  expect(await stored(page)).toEqual(before);

  // Put back the saves from before the import.
  await page.getByRole('button', { name: 'Put them back…' }).click();
  await Promise.all([page.waitForEvent('load'), page.getByTestId('saves-restore-confirm').click()]);
  await ready(page);
  expect((await stored(page))['aetherweaver.profile']).toBe(replaced['aetherweaver.profile']);
  expect(errors).toEqual([]);
});

// Review B, finding 1: setting the imported settings in force before the reload woke the run
// store's subscriber, which saved the run held in memory (a run in Prep) over the imported one.
test('an import with its settings, made while a run in Prep is held, keeps the imported run', async ({
  page,
}, testInfo) => {
  const errors = trackErrors(page);
  await page.goto(START_URL);
  await ready(page);
  // The file: a Weaver at Rank 10, a run (seed 777) on its map, settings with Skip the unlocks on.
  let other = embark(newRun(777));
  other = chooseNode(other, reachable(other)[0]!.id);
  const file = {
    format: 'aetherweaver-save',
    version: 1,
    profile: { ...newProfile(3), xp: 4400, runs: 7, wins: 3 },
    run: other,
    settings: { ...DEFAULT_SETTINGS, unlockAll: true },
  };
  const path = testInfo.outputPath('import-prep.json');
  writeFileSync(path, JSON.stringify(file));
  // A run begun (seed 5), in Prep; then Prep's way back to the Loom, and the Loom's Settings.
  await page.evaluate(() => window.__AWRUN__!.newRun(5));
  await expect.poll(() => page.evaluate(() => window.__AWRUN__!.phase())).toBe('prep');
  await page
    .getByRole('button', { name: /The Loom/ })
    .first()
    .click();
  // The Loom's first-contact welcome, if it shows.
  await page
    .getByRole('button', { name: 'Later' })
    .click({ timeout: 15_000 })
    .catch(() => {});
  await expect(page.getByRole('button', { name: /The Gate/ }).first()).toContainText(/in Prep/);
  await page.getByRole('button', { name: 'Settings' }).first().click();
  await page.getByTestId('saves-panel').scrollIntoViewIfNeeded();
  await page.getByTestId('saves-import-file').setInputFiles(path);
  await expect(page.getByTestId('saves-preview')).toBeVisible();
  await page.getByTestId('saves-with-settings').check();
  await Promise.all([page.waitForEvent('load'), page.getByTestId('saves-import-confirm').click()]);
  await ready(page);
  const run = await page.evaluate(() => {
    const t = localStorage.getItem('aetherweaver.run');
    return t ? (JSON.parse(t) as { seed: number }) : null;
  });
  expect(run?.seed, 'the imported run (seed 777) is the saved run').toBe(777);
  const settings = await page.evaluate(() => localStorage.getItem('aetherweaver.settings'));
  expect((JSON.parse(settings!) as { unlockAll: boolean }).unlockAll).toBe(true);
  expect(errors).toEqual([]);
});

test('a profile that won’t load is kept raw, and offered for download', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto(START_URL);
  await ready(page);
  const raw = '{"version":10,"xp":9001,"broken":';
  await page.evaluate((r) => {
    localStorage.clear();
    localStorage.setItem('aetherweaver.profile', r);
  }, raw);
  await page.reload();
  await ready(page);
  expect(await page.evaluate(() => localStorage.getItem('aetherweaver.profile.corrupt'))).toBe(raw);
  await openSaves(page);
  await expect(page.getByTestId('saves-kept')).toContainText('Your profile couldn’t be loaded');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('saves-kept-download').click(),
  ]);
  expect(download.suggestedFilename()).toBe('aetherweaver-unreadable-profile.json');
  expect(readFileSync(await download.path()).toString('utf8')).toBe(raw);
  // Saves after it never overwrite it.
  await page.getByText('Skip the unlocks', { exact: true }).click();
  await page.reload();
  await ready(page);
  expect(await page.evaluate(() => localStorage.getItem('aetherweaver.profile.corrupt'))).toBe(raw);
  expect(errors).toEqual([]);
});

/**
 * A file path for a file the test makes: under the system's temp folder. The test's own output
 * folder is named after its title, and with curly quotes in the title the file chooser found no
 * file there (the same flow worked from a plain path).
 */
function scratchPath(name: string): string {
  return join(mkdtempSync(join(tmpdir(), 'aw-saves-')), name);
}

/** A save file with a Weaver at Rank 10 and a run on its map, written for the test to open. */
function importFile(name: string): string {
  let run = embark(newRun(4242));
  run = chooseNode(run, reachable(run)[0]!.id);
  const path = scratchPath(name);
  writeFileSync(
    path,
    JSON.stringify({
      format: 'aetherweaver-save',
      version: 1,
      profile: { ...newProfile(3), xp: 4400, runs: 7, wins: 3 },
      run,
      settings: null,
    }),
  );
  return path;
}

/** Imports the file named, from Settings, and waits for the page to start again on it. */
async function importFrom(page: Page, path: string): Promise<void> {
  await openSaves(page);
  await page.getByTestId('saves-import-file').setInputFiles(path);
  await expect(page.getByTestId('saves-preview')).toBeVisible();
  await Promise.all([page.waitForEvent('load'), page.getByTestId('saves-import-confirm').click()]);
  await ready(page);
}

const BEFORE = 'aetherweaver.profile.before-import';

// Review B, finding 6: a second import keeps the copy from before the first, and the panel says so.
test('import twice, then “Put them back” restores the saves from before the first import', async ({
  page,
}) => {
  test.setTimeout(240_000);
  const errors = trackErrors(page);
  await page.goto(START_URL);
  await ready(page);
  await otherSaves(page);
  const first = (await stored(page))['aetherweaver.profile'];
  expect(first).not.toBeNull();
  const path = importFile('import-twice.json');

  // The first import: no earlier copy, so the plain warning; the saves it replaces are kept.
  await openSaves(page);
  await expect(page.getByTestId('saves-restore')).toHaveCount(0);
  await page.getByTestId('saves-import-file').setInputFiles(path);
  await expect(page.getByTestId('saves-import-warning')).toContainText(
    'They’re kept first, and you can put them back from here.',
  );
  await Promise.all([page.waitForEvent('load'), page.getByTestId('saves-import-confirm').click()]);
  await ready(page);
  expect(await page.evaluate((k) => localStorage.getItem(k), BEFORE)).toBe(first);
  const imported = (await stored(page))['aetherweaver.profile'];
  expect(imported).not.toBe(first);

  // The second import: the panel says the earlier copy stays kept, and it does.
  await openSaves(page);
  await expect(page.getByTestId('saves-restore')).toBeVisible();
  await page.getByTestId('saves-import-file').setInputFiles(path);
  await expect(page.getByTestId('saves-import-warning')).toContainText(
    'The saves from before your earlier import stay kept instead',
  );
  await Promise.all([page.waitForEvent('load'), page.getByTestId('saves-import-confirm').click()]);
  await ready(page);
  expect(await page.evaluate((k) => localStorage.getItem(k), BEFORE)).toBe(first);

  // Put them back: the saves from before the first import.
  await openSaves(page);
  await page.getByRole('button', { name: 'Put them back…' }).click();
  await Promise.all([page.waitForEvent('load'), page.getByTestId('saves-restore-confirm').click()]);
  await ready(page);
  expect((await stored(page))['aetherweaver.profile']).toBe(first);
  expect(await page.evaluate((k) => localStorage.getItem(k), BEFORE)).toBeNull();
  await openSaves(page);
  await expect(page.getByTestId('saves-restore')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('“Forget them…” asks first, then removes the offer and the copy', async ({ page }) => {
  test.setTimeout(240_000);
  const errors = trackErrors(page);
  await page.goto(START_URL);
  await ready(page);
  await otherSaves(page);
  const first = (await stored(page))['aetherweaver.profile'];
  const path = importFile('import-forget.json');
  await importFrom(page, path);
  const imported = (await stored(page))['aetherweaver.profile'];

  await openSaves(page);
  const restore = page.getByTestId('saves-restore');
  await expect(restore).toBeVisible();
  // Asked first; “Keep these” leaves everything as it was.
  await restore.getByRole('button', { name: 'Forget them…' }).click();
  await expect(restore).toContainText('Forget the saves from before the import for good?');
  await restore.getByRole('button', { name: 'Keep these' }).click();
  await expect(restore.getByRole('button', { name: 'Put them back…' })).toBeVisible();
  expect(await page.evaluate((k) => localStorage.getItem(k), BEFORE)).toBe(first);

  // Forgotten: the offer goes, the copy is gone, the saves in force are untouched.
  await restore.getByRole('button', { name: 'Forget them…' }).click();
  await restore.getByTestId('saves-restore-forget-confirm').click();
  await expect(page.getByTestId('saves-restore')).toHaveCount(0);
  expect(await page.evaluate((k) => localStorage.getItem(k), BEFORE)).toBeNull();
  expect((await stored(page))['aetherweaver.profile']).toBe(imported);
  await page.reload();
  await ready(page);
  await openSaves(page);
  await expect(page.getByTestId('saves-restore')).toHaveCount(0);

  // The next import then keeps the saves in force then, under the plain warning.
  await page.getByTestId('saves-import-file').setInputFiles(path);
  await expect(page.getByTestId('saves-import-warning')).toContainText(
    'They’re kept first, and you can put them back from here.',
  );
  expect(errors).toEqual([]);
});

test('a kept unreadable profile’s download is a file the import reads, and says why it can’t load', async ({
  page,
}) => {
  const errors = trackErrors(page);
  await page.goto(START_URL);
  await ready(page);
  // Valid JSON that is not a profile this build can read (a later build’s, say).
  const raw = '{"version":9999,"xp":9001,"someFutureField":{"a":[1,2,3]}}';
  await page.evaluate((r) => {
    localStorage.clear();
    localStorage.setItem('aetherweaver.profile', r);
  }, raw);
  await page.reload();
  await ready(page);
  expect(await page.evaluate(() => localStorage.getItem('aetherweaver.profile.corrupt'))).toBe(raw);
  await openSaves(page);
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('saves-kept-download').click(),
  ]);
  expect(download.suggestedFilename()).toBe('aetherweaver-unreadable-profile.json');
  const path = scratchPath('kept-profile.json');
  await download.saveAs(path);
  const file = JSON.parse(readFileSync(path).toString('utf8')) as Record<string, unknown>;
  expect(file).toMatchObject({ format: 'aetherweaver-save', version: 1, run: null });
  expect(file['profile']).toEqual(JSON.parse(raw));

  // The import’s reader accepts it as a save file, and says why this save can’t load here.
  const before = await stored(page);
  await page.getByTestId('saves-import-file').setInputFiles(path);
  await expect(page.getByTestId('saves-error')).toHaveText(
    'The profile in this save can’t be read by this version of the game. Nothing was imported.',
  );
  await expect(page.getByTestId('saves-preview')).toHaveCount(0);
  expect(await stored(page)).toEqual(before);
  expect(errors).toEqual([]);
});

/** Two frames after start-up: the notice reads storage in an effect after the first render. */
async function settled(page: Page): Promise<void> {
  await expect(page.getByTestId('front-door').or(page.getByTestId('demo-choice'))).toBeVisible();
  await page.evaluate(
    () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );
}

async function startOn(page: Page, saves: Record<string, string>): Promise<void> {
  await page.evaluate((s) => {
    localStorage.clear();
    for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v);
  }, saves);
  await page.reload();
  await ready(page);
  await settled(page);
}

test('the kept-save notice shows once at start-up, downloads the raw text, and not again', async ({
  page,
}) => {
  const errors = trackErrors(page);
  await page.goto(START_URL);
  await ready(page);
  await settled(page);
  test.skip(await page.getByTestId('playtest-line').isVisible(), 'not the demo’s build');
  const notice = page.getByTestId('saves-kept-notice');

  // A normal start, new or with a Weaver and a run: nothing.
  await startOn(page, {});
  await expect(notice).toHaveCount(0);
  await page.evaluate(() => {
    window.__AWRUN__!.newRun(4242);
    window.__AWRUN__!.embark();
  });
  await page.reload();
  await ready(page);
  await settled(page);
  await expect(notice).toHaveCount(0);

  // A profile that won't load: the notice, once, over the Title. Dismissed, it doesn't come back.
  const raw = '{"version":10,"xp":9001,"broken":';
  await startOn(page, { 'aetherweaver.profile': raw });
  await expect(notice).toHaveCount(1);
  await expect(notice).toContainText('A save couldn’t be loaded');
  await expect(notice).toContainText('Your profile couldn’t be loaded');
  await notice.getByRole('button', { name: 'OK' }).click();
  await expect(notice).toHaveCount(0);
  await page.reload();
  await ready(page);
  await settled(page);
  await expect(notice).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('aetherweaver.profile.corrupt'))).toBe(raw);

  // Another one that won't load: told again, kept beside the first (which nothing overwrites,
  // review B finding 7), and its download is the raw text.
  const raw2 = '{"version":10,"xp":12,"runs":';
  await page.evaluate((r) => localStorage.setItem('aetherweaver.profile', r), raw2);
  await page.reload();
  await ready(page);
  await settled(page);
  await expect(notice).toHaveCount(1);
  expect(await page.evaluate(() => localStorage.getItem('aetherweaver.profile.corrupt'))).toBe(raw);
  expect(
    await page.evaluate(() => localStorage.getItem('aetherweaver.profile.corrupt.latest')),
  ).toBe(raw2);
  const downloads = notice.getByRole('button', { name: /^Download it/ });
  await expect(downloads).toHaveCount(2);
  await expect(downloads.nth(1)).toContainText('(a later one, kept beside the first)');
  await expect(downloads.nth(0)).not.toContainText('a later one');
  const [download] = await Promise.all([page.waitForEvent('download'), downloads.nth(1).click()]);
  expect(download.suggestedFilename()).toBe('aetherweaver-unreadable-profile-latest.json');
  expect(readFileSync(await download.path()).toString('utf8')).toBe(raw2);
  await notice.getByRole('button', { name: 'OK' }).click();
  await expect(notice).toHaveCount(0);
  await page.reload();
  await ready(page);
  await settled(page);
  await expect(notice).toHaveCount(0);
  expect(errors).toEqual([]);
});

// Run in the demo's build only: `VITE_DEMO=1` for the build, and `-g "demo starts"`.
test('both demo starts show no kept-save notice', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto(START_URL);
  await ready(page);
  await settled(page);
  test.skip(!(await page.getByTestId('playtest-line').isVisible()), 'the demo’s build only');
  const notice = page.getByTestId('saves-kept-notice');
  for (const kind of ['fresh', 'veteran'] as const) {
    await startOn(page, {});
    await expect(page.getByTestId('demo-choice')).toBeVisible();
    await expect(notice).toHaveCount(0);
    await page.getByTestId(`demo-${kind}`).click();
    await expect(page.getByTestId('front-door')).toBeVisible();
    await expect(notice).toHaveCount(0);
    await page.reload();
    await ready(page);
    await settled(page);
    await expect(page.getByTestId('front-door')).toBeVisible();
    await expect(notice).toHaveCount(0);
  }
  expect(errors).toEqual([]);
});
