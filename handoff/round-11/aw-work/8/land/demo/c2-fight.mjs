import { chromium, serve, track, newBag, shot, check, report, LAUNCH, ORIGIN } from './lib/harness.mjs';
const { server } = serve();
const browser = await chromium.launch(LAUNCH);
const bag = newBag();
async function titleReady(page) { await page.waitForSelector('[data-testid=demo-choice],[data-testid=front-door]', { timeout: 30000 }); await page.waitForTimeout(800); }
async function toLoom(page, kind) {
  await page.goto(ORIGIN + '/'); await titleReady(page);
  await page.getByTestId(`demo-${kind}`).click();
  await page.getByTestId('front-door').waitFor();
  await page.getByRole('button', { name: 'Enter the Loom' }).click();
  await page.getByTestId('loom-screen').waitFor();
  await page.waitForTimeout(1500);
  const later = page.getByTestId('intro-later');
  if (await later.isVisible().catch(() => false)) { await later.click(); await page.waitForTimeout(500); }
}
try {
  // Fresh start: the Training Grounds, the new figures in a fight.
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await ctx.newPage(); track(page, bag, 'fresh');
    await toLoom(page, 'fresh');
    await page.getByRole('button', { name: /Training Grounds/i }).first().click();
    await page.getByTestId('party-frames').waitFor({ timeout: 60000 });
    check('fresh: Training fight shows the party frames', (await page.getByTestId('party-frames').innerText()).includes('Kael'));
    await page.mouse.move(640, 300);
    await page.waitForTimeout(9000);
    await shot(page, 'v17-training-fight');
    check('fresh: a canvas is drawn', (await page.locator('canvas').count()) > 0);
    await ctx.close();
  }
  // Veteran start: a run's first fight.
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await ctx.newPage(); track(page, bag, 'veteran');
    await toLoom(page, 'veteran');
    await page.getByRole('button', { name: /The Gate/ }).first().click();
    const embark = page.getByRole('button', { name: /Embark/i }).first();
    await embark.waitFor({ timeout: 20000 }); await page.waitForTimeout(800);
    await embark.click(); await page.waitForTimeout(2500);
    await page.getByRole('button', { name: /First Light/ }).first().click();
    await page.waitForTimeout(2500);
    console.log('buttons:', (await page.locator('button').allInnerTexts()).slice(0, 12).join(' | ').replace(/\n/g, ' / '));
    const begin = page.getByRole('button', { name: /Begin the fight/i });
    if (await begin.count()) { await begin.first().click(); }
    const frames = page.getByTestId('party-frames');
    await frames.waitFor({ timeout: 60000 });
    check('veteran: first fight shows the party frames', await frames.isVisible());
    await page.mouse.move(640, 300);
    await page.waitForTimeout(12000);
    await shot(page, 'v17-first-light-fight');
    await ctx.close();
  }
} catch (e) { console.log('SCRIPT ERROR', e.message); }
report(bag);
await browser.close(); server.close();
