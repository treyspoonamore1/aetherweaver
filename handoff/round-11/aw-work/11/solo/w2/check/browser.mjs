// W2's own look at the real app (not a test in the repo): old settings load, Controls has no Cue
// rows, T does nothing in a fight, and Auto-Thread follows Solos with the hands off.
//   node browser.mjs <port> <out dir>
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const require = createRequire('/home/user/aw-work/wt-p11solo-w2/');
const { chromium } = require('playwright');

const port = process.argv[2] ?? '4605';
const out = process.argv[3] ?? '/home/user/aw-work/11/solo/w2/check/out';
mkdirSync(out, { recursive: true });
const BASE = `http://localhost:${port}`;
const fixture = JSON.parse(
  readFileSync('/home/user/aw-work/wt-p11solo-w2/tests/fixtures/saves/b16-2a2b91b.json', 'utf8'),
);
const OLD_SETTINGS = fixture.keys['aetherweaver.settings'];
const report = [];
const say = (ok, what, detail = '') => {
  report.push(`${ok ? 'PASS' : 'FAIL'}  ${what}${detail ? `  [${detail}]` : ''}`);
  console.log(report[report.length - 1]);
};

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});

async function open(settingsText) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('response', (r) => r.status() >= 400 && console.log(`  (http ${r.status()} ${r.url().slice(0, 120)})`));
  if (settingsText !== null)
    await page.addInitScript((text) => {
      if (!localStorage.getItem('aetherweaver.settings'))
        localStorage.setItem('aetherweaver.settings', text);
    }, settingsText);
  await page.goto(`${BASE}/?e2e=1&seed=4242`, { waitUntil: 'load', timeout: 240000 });
  return { context, page, errors };
}

// ── 1. A version 4 settings file from main, with the Cue key's things in use ──
if (!process.env.ONLY_FIGHT) {
  const { context, page, errors } = await open(OLD_SETTINGS);
  await page.getByRole('button', { name: /^Settings$/ }).first().click({ timeout: 240000 });
  await page.getByTestId('controls-settings').waitFor({ timeout: 60000 });
  const text = await page.locator('body').innerText();
  for (const gone of ['Cue modifier', 'Hero autonomy', 'Cue a Solo', 'Cue their Solo', 'Cue the reticle'])
    say(!text.includes(gone), `Settings does not say "${gone}"`);
  for (const there of ['Auto-Thread', 'Perfect Ward window', 'Telegraph lead', 'Thread hero 1'])
    say(text.includes(there), `Settings says "${there}"`);
  // What the old file had set otherwise is still set: Scatter on T, Thread mode on hold.
  const controls = page.getByTestId('controls-settings');
  const shot = async (locator, name) => {
    await locator.evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${out}/${name}.png`, timeout: 180000 });
  };
  await shot(page.getByText('Perfect Ward window').first(), 'settings-assists');
  await shot(page.getByText('Thread hero 1').first(), 'controls-keys');
  await shot(page.getByText('Auto-Thread').first(), 'controls-behave');
  await shot(page.getByTestId('controls-pad'), 'controls-pad');
  const scatter = await controls.getByRole('button', { name: /^Scatter: / }).first().innerText().catch(() => '?');
  say(scatter.trim() === 'T', 'the old file\'s own choice is kept: Scatter is on T', scatter.trim());
  // A change writes the settings back: version 5, the three things gone.
  const before = JSON.parse(await page.evaluate(() => localStorage.getItem('aetherweaver.settings')));
  say(before.version === 4, 'until something is changed the stored file is still the old one', `version ${before.version}`);
  await page.getByRole('switch', { name: /Captions/ }).first().evaluate((el) => el.click());
  await page.waitForTimeout(200);
  const after = JSON.parse(await page.evaluate(() => localStorage.getItem('aetherweaver.settings')));
  const flat = JSON.stringify(after);
  say(after.version === 5, 'after a change the stored file is version 5', `version ${after.version}`);
  say(!/autonomy|cueModifier|cueReticle|"cue"/.test(flat), 'and holds no autonomy, Cue modifier or Cue binding');
  say(after.bindings.directiveScatter?.[0] === 'KeyT' && after.input?.threadMode === 'hold' && after.assists.telegraphLead === 1.25 && after.aids?.autoThread === true,
    'and keeps the rest (Scatter on T, hold, lead ×1.25, Auto-Thread on)');
  writeFileSync(`${out}/settings-after.json`, JSON.stringify(after, null, 2));
  say(errors.length === 0, 'no page errors on the Settings screen', errors.slice(0, 3).join(' | '));
  await context.close();
}

// ── 2. A Training fight: T does nothing; Auto-Thread follows Solos with the hands off ──
async function fight(autoThread) {
  const settings = JSON.parse(OLD_SETTINGS);
  // The old file's Auto-Thread, on or off; its T goes back to nothing (the default).
  if (autoThread) settings.aids = { autoThread: true };
  else delete settings.aids;
  settings.bindings = {};
  settings.input = {};
  const { context, page, errors } = await open(JSON.stringify(settings));
  await page.getByRole('button', { name: 'Enter the Loom' }).click({ timeout: 240000 });
  await page.getByTestId('loom-screen').waitFor({ timeout: 60000 });
  if (await page.getByTestId('station-intro').isVisible()) await page.getByTestId('intro-later').click();
  await page.getByRole('button', { name: /Training Grounds/i }).first().click();
  await page.getByTestId('party-frames').waitFor({ timeout: 120000 });
  await page.waitForFunction(() => window.__AW__ && window.__AW__.tick() > 30, null, { timeout: 120000 });
  const snap = () => page.evaluate(() => {
    const s = window.__AW__.snapshot();
    const weaver = s.entities.find((e) => e.id === s.weaverId);
    const heroes = s.party.map((id, slot) => ({ slot, ...s.entities.find((e) => e.id === id) }));
    return { time: s.time, thread: weaver?.threadSlot ?? null, weaverHp: Math.round(weaver?.hp ?? -1), heroes };
  });
  // The page runs slower than real time here (software rendering, a busy machine): every wait
  // is in sim ticks, as Auto-Thread's own clock is.
  const tick = () => page.evaluate(() => window.__AW__.tick());
  // BUSY=1: the player presses other keys the whole time (Ward, Chime, a step left, a step
  // right), never a Thread key.
  const BUSY = !!process.env.BUSY;
  const OTHER_KEYS = ['KeyQ', 'KeyE', 'KeyA', 'KeyD'];
  let pressed = 0;
  let lastPress = 0;
  const busyPress = async () => {
    // About five presses a second of real time.
    if (!BUSY || Date.now() - lastPress < 200) return;
    lastPress = Date.now();
    await page.keyboard.press(OTHER_KEYS[pressed++ % OTHER_KEYS.length]);
  };
  const waitTicks = async (n) => {
    const target = (await tick()) + n;
    await page.waitForFunction((t) => window.__AW__.tick() >= t, target, { timeout: 600000, polling: 100 });
  };
  const s0 = await snap();
  const kael = s0.heroes.find((h) => h.slot === 0);
  // T, the old Cue key: nothing happens, the fight does not notice.
  const before = await page.evaluate(() => window.__AW__.markers().length);
  await page.keyboard.press('KeyT');
  await page.keyboard.press('Shift+Digit2');
  await waitTicks(20);
  const mid = await snap();
  const markersAfterT = await page.evaluate(() => window.__AW__.markers());
  say(!markersAfterT.slice(before).includes('cue'),
    `[auto ${autoThread}] T and Shift+2 leave no Cue on the fight's record`);
  say(mid.thread === 1, `[auto ${autoThread}] Shift+2 threads hero 2`, `thread slot ${mid.thread}`);
  // An enemy, hands off for 3.3 s of the fight's own time, then every Solo charged.
  await page.evaluate(([x, z]) => {
    window.__AW__.queue({ t: 'debug', op: { op: 'spawnEnemy', defId: 'bell_brute', x, z: z - 4, elite: true } });
    // The Weaver stands back, out of the brute's swings but within the Thread's reach.
    window.__AW__.queue({ t: 'debug', op: { op: 'teleportWeaver', x: 0, z: 5 } });
  }, [kael.x, kael.z]);
  if (BUSY) {
    const until = (await tick()) + 200;
    while ((await tick()) < until) {
      await busyPress();
      await page.waitForTimeout(120);
    }
  } else await waitTicks(200);
  const lullThread = (await snap()).thread;
  const markers0 = (await page.evaluate(() => window.__AW__.markers())).length;
  await page.evaluate(() => {
    window.__AW__.queue({ t: 'debug', op: { op: 'healParty' } });
    window.__AW__.queue({ t: 'debug', op: { op: 'chargeSolos' } });
  });
  const seen = [];
  const end = (await tick()) + 420;
  while ((await tick()) < end) {
    const s = await snap();
    if (seen.length === 0 || seen[seen.length - 1] !== s.thread) {
      seen.push(s.thread);
      console.log(`  [auto ${autoThread}] tick ${await tick()} thread ${s.thread} weaver hp ${s.weaverHp} heroes ${s.heroes.map((h) => `${Math.round(h.hp)}@${h.x.toFixed(1)},${h.z.toFixed(1)}`).join(' ')}`);
    }
    await page.evaluate(() => window.__AW__.queue({ t: 'debug', op: { op: 'healParty' } }));
    await busyPress();
    await page.waitForTimeout(40);
  }
  if (BUSY) {
    console.log(`[auto ${autoThread}] other keys pressed: ${pressed}; the Thread after the lull: ${lullThread}`);
    say(lullThread === 1, `[auto ${autoThread}] busy, the Thread is still where the player put it when the Solos are charged`, `slot ${lullThread}`);
  }
  const markers = (await page.evaluate(() => window.__AW__.markers())).slice(markers0);
  const cues = markers.filter((m) => m === 'cue').length;
  await page.screenshot({ path: `${out}/fight-auto-${autoThread}.png`, timeout: 180000 });
  console.log(`[auto ${autoThread}] thread slots seen: ${JSON.stringify(seen)}; markers: ${JSON.stringify(markers)}`);
  say(errors.length === 0, `[auto ${autoThread}] no page errors in the fight`, errors.slice(0, 3).join(' | '));
  await context.close();
  return { seen, cues, markers };
}
const off = await fight(false);
say(off.seen.every((t) => t === 1 || t === null), 'Auto-Thread off: the Thread never moves to another hero', JSON.stringify(off.seen));
say(off.cues <= 1, 'Auto-Thread off: at most the threaded hero\'s Solo is Cued', `${off.cues} Cued`);
const on = await fight(true);
const how = process.env.BUSY ? 'the player pressing other keys throughout' : 'hands off';
say(on.seen.length >= 3, `Auto-Thread on, ${how}: the Thread moves from hero to hero`, JSON.stringify(on.seen));
say(on.cues >= 3, `Auto-Thread on, ${how}: all three Solos are Cued`, `${on.cues} Cued`);
if (process.env.BUSY) say(on.seen[on.seen.length - 1] === 1, 'and it ends back on the hero the player had it on', JSON.stringify(on.seen));

await browser.close();
writeFileSync(`${out}/report.txt`, report.join('\n') + '\n');
process.exit(report.some((l) => l.startsWith('FAIL')) ? 1 : 0);
