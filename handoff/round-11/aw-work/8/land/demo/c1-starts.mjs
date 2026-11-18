import { chromium, serve, track, newBag, shot, check, report, LAUNCH, ORIGIN } from './lib/harness.mjs';
const { server } = serve();
const browser = await chromium.launch(LAUNCH);
const bag = newBag();
const notice = (p) => p.getByTestId('saves-kept-notice');
async function titleReady(page) { await page.waitForSelector('[data-testid=demo-choice],[data-testid=front-door]', { timeout: 30000 }); await page.waitForTimeout(800); }
try {
  for (const kind of ['fresh', 'veteran']) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await ctx.newPage();
    track(page, bag, kind);
    await page.goto(ORIGIN + '/');
    await titleReady(page);
    check(`${kind}: first screen is the choice`, await page.getByTestId('demo-choice').isVisible());
    check(`${kind}: no kept-save notice on the choice`, (await notice(page).count()) === 0);
    if (kind === 'fresh') await shot(page, 'start-choice');
    await page.getByTestId(`demo-${kind}`).click();
    await page.getByTestId('front-door').waitFor();
    await page.waitForTimeout(1200);
    check(`${kind}: Title shown`, await page.getByTestId('front-door').isVisible());
    check(`${kind}: no kept-save notice on the Title`, (await notice(page).count()) === 0);
    await shot(page, `title-${kind}`);
    // reload on the Title: stays on the Title (choice made), still no notice
    await page.reload(); await titleReady(page);
    check(`${kind}: after reload, Title again, no notice`, (await page.getByTestId('front-door').isVisible()) && (await notice(page).count()) === 0);
    await page.getByRole('button', { name: 'Enter the Loom' }).click();
    await page.getByTestId('loom-screen').waitFor();
    await page.waitForTimeout(1500);
    const intro = page.getByTestId('station-intro');
    const welcome = await intro.isVisible().catch(() => false);
    check(`${kind}: Loom with its welcome`, welcome, welcome ? (await intro.innerText()).slice(0, 80).replace(/\n/g, ' / ') : 'no welcome dialog');
    await shot(page, `loom-welcome-${kind}`);
    check(`${kind}: no kept-save notice in the Loom`, (await notice(page).count()) === 0);
    if (welcome) { await page.getByTestId('intro-later').click(); await page.waitForTimeout(500); }
    await shot(page, `loom-${kind}`);
    const gate = page.getByRole('button', { name: /The Gate/ }).first();
    console.log(kind, 'gate text:', (await gate.innerText()).replace(/\n/g, ' / '));
    await gate.click();
    await page.waitForTimeout(1500);
    // Prep: Embark present?
    const embark = page.getByRole('button', { name: /Embark/i }).first();
    await embark.waitFor({ timeout: 20000 });
    check(`${kind}: Prep shown`, await embark.isVisible());
    await page.waitForTimeout(800);
    await shot(page, `prep-${kind}`);
    check(`${kind}: no kept-save notice in Prep`, (await notice(page).count()) === 0);
    if (kind === 'veteran') {
      // the tab-close fix: embark, into the map, reload at the Title twice
      await embark.click();
      await page.waitForTimeout(2500);
      await shot(page, 'map-veteran-run-started');
      const onMap = (await page.locator('main button').count()) > 0 && (await page.getByRole('button', { name: /Embark/i }).count()) === 0;
      check('veteran: embarked, on the map', onMap);
      await page.reload(); await titleReady(page);
      const cont = page.getByRole('button', { name: /^Continue/ }).first();
      check('veteran: reload 1 (from the map) -> Title offers Continue', await cont.isVisible().catch(() => false));
      await shot(page, 'title-continue-after-reload-1');
      await page.reload(); await titleReady(page);
      check('veteran: reload 2 (at the Title) -> Continue still offered', await page.getByRole('button', { name: /^Continue/ }).first().isVisible().catch(() => false));
      await shot(page, 'title-continue-after-reload-2');
      check('veteran: no kept-save notice after the reloads', (await notice(page).count()) === 0);
      // Continue goes back into the run
      await page.getByRole('button', { name: /^Continue/ }).first().click();
      await page.waitForTimeout(2500);
      await shot(page, 'continue-resumes-map');
      console.log('after Continue buttons:', (await page.locator('button').allInnerTexts()).slice(0, 14).join(' | '));
    }
    await ctx.close();
  }
} catch (e) { console.log('SCRIPT ERROR', e.message); }
report(bag);
await browser.close(); server.close();
