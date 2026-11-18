// Version 18 check: the Codex's portraits (timed), the map's reward pills, a fight with red outlines.
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
const ready = (page) => page.evaluate(() => { const a = [...document.querySelectorAll('[data-testid=portrait]')]; return { n: a.length, ready: a.filter((e) => e.dataset.ready === 'true').length }; });
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage(); track(page, bag, 'veteran');
  await toLoom(page, 'veteran');
  console.log('loom buttons:', (await page.locator('button').allInnerTexts()).join(' | ').replace(/\n/g, ' / ').slice(0, 600));
  const t0 = Date.now();
  await page.getByRole('button', { name: /Codex/ }).first().click();
  await page.waitForSelector('[data-testid=portrait]', { timeout: 30000 });
  console.log('codex open, first portrait frame after ms', Date.now() - t0, JSON.stringify(await ready(page)));
  // The page answers while the pictures are drawn?
  let allAt = null;
  for (let i = 0; i < 150; i++) {
    const r = await ready(page);
    if (r.n > 0 && r.ready === r.n) { allAt = Date.now() - t0; break; }
    await page.waitForTimeout(1000);
    if (i % 10 === 0) console.log('  waiting', Date.now() - t0, JSON.stringify(r));
  }
  console.log('heroes page: all portraits ready after ms', allAt);
  check('Codex heroes: every portrait drew', allAt !== null);
  await shot(page, 'v18-codex-heroes');
  const t1 = Date.now();
  await page.getByText('Enemies', { exact: true }).first().click();
  await page.waitForTimeout(500);
  let en = null;
  for (let i = 0; i < 150; i++) { const r = await ready(page); if (r.n > 0 && r.ready === r.n) { en = { ms: Date.now() - t1, ...r }; break; } await page.waitForTimeout(1000); }
  console.log('enemies page ready', JSON.stringify(en));
  check('Codex enemies: every portrait drew', en !== null);
  await shot(page, 'v18-codex-enemies');
  await page.getByText('The Weaver', { exact: true }).first().click();
  await page.waitForTimeout(2500);
  check('Codex Weaver card shown', await page.getByTestId('codex-weaver-card').isVisible());
  await shot(page, 'v18-codex-weaver');
  await page.getByRole('button', { name: /Back/ }).first().click();
  await page.getByTestId('loom-screen').waitFor();
  // A run: the map's pills, then the first fight.
  await page.getByRole('button', { name: /The Gate/ }).first().click();
  const embark = page.getByRole('button', { name: /Embark/i }).first();
  await embark.waitFor({ timeout: 20000 }); await page.waitForTimeout(800);
  await embark.click(); await page.waitForTimeout(3000);
  const pills = await page.getByTestId('node-rewards').count();
  console.log('map reward pills:', pills);
  check('map shows reward pills', pills > 0);
  await shot(page, 'v18-map');
  await page.getByRole('button', { name: /First Light/ }).first().click();
  await page.waitForTimeout(2500);
  const begin = page.getByRole('button', { name: /Begin the fight/i });
  if (await begin.count()) await begin.first().click();
  const t2 = Date.now();
  await page.getByTestId('party-frames').waitFor({ timeout: 120000 });
  console.log('fight HUD after ms', Date.now() - t2);
  await page.mouse.move(640, 300);
  await page.waitForTimeout(14000);
  await shot(page, 'v18-first-light-fight');
  check('fight: a canvas is drawn', (await page.locator('canvas').count()) > 0);
  await ctx.close();
} catch (e) { console.log('SCRIPT ERROR', e.message); }
report(bag);
await browser.close(); server.close();
