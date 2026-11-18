// capture.mjs <dist> <outDir> <port> [sections,comma]: a picture and a word count of every menu screen.
import { session, newPage, snap, log, wait, readWords } from './lib.mjs';
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
const dist = process.argv[2], out = process.argv[3], port = Number(process.argv[4] ?? 4620);
const only = process.argv[5] ? process.argv[5].split(',') : null;
mkdirSync(out, { recursive: true });
const R = (page, fn, arg) => page.evaluate(fn, arg);
const want = (s) => !only || only.includes(s);

/** A scrolling screen whole: a tall window, so every word of it is in the picture. */
async function snapTall(page, id, opts = {}) {
  await page.setViewportSize({ width: 1280, height: opts.height ?? 3600 });
  await wait(500);
  await snap(page, out, id, opts);
  await page.setViewportSize({ width: 1280, height: 720 });
  await wait(300);
}
/** A part of a screen, counted without a picture (the Chord builder inside Prep). */
async function countPart(page, id, root) {
  const w = await readWords(page, root);
  const file = `${out}/counts.json`;
  const counts = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
  counts[id] = { words: w.all, inView: w.inView, note: 'part: ' + root };
  writeFileSync(file, JSON.stringify(counts, null, 1));
  writeFileSync(`${out}/${id}.txt`, w.lines.map((l) => l.text).join('\n') + '\n');
  log('part', id, w.all);
}
async function intro(page, id) {
  let k = 1;
  await wait(900);
  while (await page.getByTestId('station-intro').isVisible()) {
    await snap(page, out, `${id}-intro-${k}`);
    const next = page.getByTestId('intro-next');
    if (await next.isVisible()) await next.click();
    else { await page.getByTestId('intro-later').click(); break; }
    if (++k > 6) break;
  }
  await wait(700);
}
async function start(browser, base, kind, { unlock = false } = {}) {
  const page = await newPage(browser);
  await page.goto(base + '/?e2e=1&seed=4242');
  await page.getByTestId(`demo-${kind}`).click();
  await page.getByTestId('front-door').waitFor();
  if (unlock) {
    await R(page, () => {
      const raw = JSON.parse(localStorage.getItem('aetherweaver.settings') ?? '{}');
      return Object.keys(localStorage);
    });
  }
  return page;
}
async function toLoom(page, id) {
  await page.getByRole('button', { name: 'Enter the Loom' }).click();
  await page.getByTestId('loom-screen').waitFor();
  if (id) await intro(page, id);
  else if (await page.getByTestId('station-intro').isVisible()) await page.getByTestId('intro-later').click();
  await wait(500);
}
async function backToLoom(page) {
  for (let i = 0; i < 5; i++) {
    await wait(700);
    if (await page.getByTestId('loom-screen').isVisible()) return;
    if (await page.getByTestId('front-door').isVisible()) {
      await page.getByRole('button', { name: 'Enter the Loom' }).click();
      continue;
    }
    await page.keyboard.press('Escape');
  }
}
async function newRunAt(page, kind, aether = 200, seed = 4242) {
  await R(page, (s) => window.__AWRUN__.newRun(s), seed);
  await R(page, () => window.__AWRUN__.embark());
  const ph = await R(page, ([k, a]) => window.__AWRUN__.warp(k, a), [kind, aether]);
  await wait(1500);
  return ph;
}

await session(dist, port, async (browser, base) => {
  const step = async (page, name, fn) => {
    try { await fn(); } catch (e) { log('STEP FAILED', name, String(e).slice(0, 400)); await page.screenshot({ path: `${out}/FAIL-${name}.png` }).catch(() => {}); }
  };

  if (want('fresh')) {
    const page = await newPage(browser);
    await page.goto(base + '/?e2e=1&seed=4242');
    await page.getByTestId('demo-choice').waitFor();
    await snap(page, out, 'title-choice');
    await page.getByTestId('demo-fresh').click();
    await page.getByTestId('front-door').waitFor();
    await snap(page, out, 'title-fresh');
    await toLoom(page, 'loom-welcome');
    await snap(page, out, 'loom-fresh');
    await step(page, 'loom-hover', async () => {
      // A closed station says what it is on hover, and on focus (keyboard and pad).
      await page.getByRole('button', { name: /^The Astrolabe/ }).hover();
      await snap(page, out, 'loom-fresh-hover', { note: 'pointer over the Astrolabe' });
      await page.mouse.move(640, 700);
      await page.getByRole('button', { name: /^The Atelier/ }).focus();
      await snap(page, out, 'loom-fresh-focus', { note: 'keyboard focus on the Atelier' });
      await page.getByRole('button', { name: /^The Gate/ }).focus();
    });
    await step(page, 'prep', async () => {
      // A fixed seed, so the road is the same in every capture.
      await R(page, () => window.__AWRUN__.newRun(4242));
      await page.getByRole('button', { name: /Embark/i }).first().waitFor();
      await wait(900);
      await snap(page, out, 'prep-fresh');
      await snapTall(page, 'prep-fresh-whole', { height: 4600 });
      await countPart(page, 'prep-fresh-builder', 'section[aria-label="Songs"]');
      await countPart(page, 'prep-fresh-party', 'section[aria-labelledby="party-title"]');
      // Prep without the Chord builder (the owner's): the words this stream may change.
      const w = await R(page, () => { const b = document.querySelector('[data-testid="chord-builder"]'); return b ? true : [...document.querySelectorAll('[data-testid]')].map((e) => e.dataset.testid).filter((x, i, a) => a.indexOf(x) === i).join(' '); });
      log('prep testids', String(w).slice(0, 900));
    });
    await step(page, 'map', async () => {
      await page.getByRole('button', { name: /Embark/i }).first().click();
      await wait(1200);
      await snap(page, out, 'map-fresh');
      const quiet = page.locator('[data-quiet]').first();
      if (await quiet.count()) {
        const box = await quiet.boundingBox();
        await page.mouse.move(box.x + box.width / 2, box.y - 30);
        await snap(page, out, 'map-fresh-hover', { note: 'pointer over a fight out of reach' });
        await page.mouse.move(640, 20);
        const stop = page.locator('[data-stop="locked"][tabindex="0"]').first();
        if (await stop.count()) {
          await stop.focus();
          await snap(page, out, 'map-fresh-focus', { note: 'keyboard focus on a stop out of reach' });
        }
      }
    });
    await page.context().close();
  }

  if (want('fight')) {
    const page = await start(browser, base, 'fresh');
    await toLoom(page);
    await R(page, () => window.__AWRUN__.newRun(4242));
    await page.getByRole('button', { name: /Embark/i }).first().click();
    await wait(800);
    await step(page, 'howto', async () => {
      await R(page, () => window.__AWRUN__.choose());
      await page.getByRole('dialog').waitFor();
      await wait(1500);
      await snap(page, out, 'howto');
      await page.getByRole('button', { name: /Begin the fight/i }).click();
      await page.waitForFunction(() => window.__AW__ && window.__AW__.tick() > 150, null, { timeout: 240000 });
      await snap(page, out, 'fight-first', { note: 'HUD with a coach hint' });
      await page.keyboard.press('Escape');
      await page.getByRole('dialog').waitFor();
      await wait(1500);
      await snap(page, out, 'pause');
      await page.getByTestId('pause-controls-open').click();
      await wait(1200);
      await snap(page, out, 'pause-controls');
      await page.getByRole('button', { name: /Back to the pause menu/ }).click();
      await wait(800);
      await page.getByRole('dialog').getByRole('button', { name: /Abandon run/ }).click();
      await wait(1200);
      await snap(page, out, 'pause-abandon');
      await page.getByRole('button', { name: /Keep/ }).click();
    });
    await step(page, 'result', async () => {
      log('win', await R(page, () => window.__AWRUN__.winFight()));
      await wait(3000);
      await snap(page, out, 'result-win');
      await snapTall(page, 'result-win-whole', { height: 2400 });
      await R(page, () => window.__AWRUN__.continue());
      await wait(1500);
      await snap(page, out, 'draft');
    });
    await page.context().close();
  }

  if (want('road')) {
    const page = await start(browser, base, 'fresh');
    await toLoom(page);
    for (const kind of ['respite', 'merchant', 'forge', 'event', 'shrine']) {
      await step(page, kind, async () => {
        const ph = await newRunAt(page, kind, 200);
        log(kind, '->', ph);
        await wait(1200);
        await snap(page, out, kind);
        if (kind === 'event') {
          const whole = await readWords(page);
        }
        await R(page, () => window.__AWRUN__.phase());
        await page.goto(base + '/?e2e=1&seed=4242');
        await page.getByTestId('front-door').waitFor();
        await toLoom(page);
      });
    }
    await step(page, 'relic', async () => {
      await newRunAt(page, 'miniboss', 200);
      log('win miniboss', await R(page, () => window.__AWRUN__.winFight()), await R(page, () => window.__AWRUN__.phase()));
      await wait(2500);
      await snap(page, out, 'result-miniboss');
      await R(page, () => window.__AWRUN__.continue());
      await wait(1500);
      log('phase', await R(page, () => window.__AWRUN__.phase()));
      await snap(page, out, 'relic-offer');
    });
    await page.context().close();
  }

  if (want('summary')) {
    const page = await start(browser, base, 'fresh');
    await toLoom(page);
    await step(page, 'summary-abandon', async () => {
      await page.goto(base + '/?e2e=1&seed=4242');
      await page.getByTestId('front-door').waitFor();
      await toLoom(page);
      await R(page, () => window.__AWRUN__.newRun(4242));
      await R(page, () => window.__AWRUN__.embark());
      await wait(1000);
      await R(page, () => window.__AWRUN__.warp('skirmish'));
      await R(page, () => window.__AWRUN__.winFight());
      await wait(800);
      await R(page, () => window.__AWRUN__.continue());
      await R(page, () => window.__AWRUN__.pick(0));
      await wait(1000);
      await page.getByRole('button', { name: /Abandon run/ }).click();
      await wait(500);
      await snap(page, out, 'map-abandon');
      await page.getByRole('dialog').getByRole('button', { name: /Abandon/ }).click();
      await wait(2500);
      await snap(page, out, 'summary-abandon');
      await snapTall(page, 'summary-abandon-whole', { height: 3600 });
    });
    await step(page, 'summary-win', async () => {
      await page.goto(base + '/?e2e=1&seed=4242');
      await page.getByTestId('front-door').waitFor();
      await toLoom(page);
      await R(page, () => window.__AWRUN__.newRun(4242));
      await R(page, () => window.__AWRUN__.embark());
      await wait(1000);
      await R(page, () => window.__AWRUN__.warp('skirmish'));
      await R(page, () => window.__AWRUN__.winFight());
      await R(page, () => window.__AWRUN__.continue());
      await R(page, () => window.__AWRUN__.pick(0));
      log('winRun', await R(page, () => window.__AWRUN__.winRun()));
      await wait(3000);
      for (let i = 0; i < 6; i++) {
        const onward = page.getByRole('button', { name: /Onward|Skip/ });
        if (await onward.count()) { await snap(page, out, `summary-card-${i + 1}`); await onward.first().click(); await wait(900); } else break;
      }
      await snap(page, out, 'summary-win');
      await snapTall(page, 'summary-win-whole', { height: 5200 });
    });
    await page.context().close();
  }

  if (want('settings')) {
    const page = await start(browser, base, 'fresh');
    await step(page, 'settings', async () => {
      await page.getByRole('button', { name: 'Settings' }).click();
      await wait(600);
      await snap(page, out, 'settings');
      await snapTall(page, 'settings-whole', { height: 7000 });
      const tab = page.getByTestId('settings-tab-controls');
      if (await tab.count()) {
        await tab.click();
        await wait(500);
        await snap(page, out, 'settings-controls');
        await snapTall(page, 'settings-controls-whole', { height: 5200 });
      }
      // Each section's own count.
      const secs = await R(page, () => [...document.querySelectorAll('section')].map((s) => s.querySelector('h2')?.innerText ?? '?'));
      log('settings sections', secs.join(' | '));
    });
    await page.context().close();
  }

  if (want('veteran')) {
    const page = await start(browser, base, 'veteran');
    await snap(page, out, 'title-veteran');
    await toLoom(page);
    await snap(page, out, 'loom-veteran');
    const stations = [['The Astrolabe', 'astrolabe'], ['The Atelier', 'atelier'], ['The Reliquary', 'reliquary'], ['Bonds', 'bonds'], ['Hall of Deeds', 'deeds']];
    for (const [name, id] of stations) {
      await step(page, id, async () => {
        await page.getByRole('button', { name: new RegExp('^' + name) }).first().click();
        await intro(page, id);
        // The intro's Later leaves you in the Loom: open the station itself.
        if (await page.getByTestId('loom-screen').isVisible()) { await page.getByRole('button', { name: new RegExp('^' + name) }).first().click(); await wait(1200); }
        await snap(page, out, id);
        await backToLoom(page);
      });
    }
    await step(page, 'prep-veteran', async () => {
      await R(page, () => window.__AWRUN__.newRun(4242, 'expedition'));
      await page.getByRole('button', { name: /Embark/i }).first().waitFor();
      await wait(1000);
      await snap(page, out, 'prep-veteran');
      await snapTall(page, 'prep-veteran-whole', { height: 6400 });
      await countPart(page, 'prep-veteran-builder', 'section[aria-label="Songs"]');
      await countPart(page, 'prep-veteran-party', 'section[aria-labelledby="party-title"]');
      await page.getByRole('button', { name: 'See the path' }).first().click();
      await wait(700);
      await snap(page, out, 'calling-path');
      await page.keyboard.press('Escape');
    });
    await page.context().close();
  }

  if (want('codex')) {
    const page = await start(browser, base, 'veteran');
    await toLoom(page);
    await step(page, 'codex', async () => {
      await page.getByRole('button', { name: /^Codex/ }).first().click();
      await wait(1200);
      const tabs = ['Heroes', 'Bonds', 'Enemies', 'The Weaver', 'Techniques', 'Auras', 'Songs & ornaments', 'Weaver Rank', 'The Astrolabe', 'Deeds', 'The Reliquary', 'Dissonance', 'Atlas of Echoes', 'Callings', 'Calls', 'Motifs', 'Relics', 'Events'];
      for (const tab of tabs) {
        await step(page, 'codex-' + tab, async () => {
          await page.getByRole('tab', { name: new RegExp('^' + tab) }).first().click();
          await wait(700);
          const id = 'codex-' + tab.toLowerCase().replace(/[^a-z]+/g, '-');
          await snap(page, out, id);
        });
      }
    });
    await page.context().close();
  }

  if (want('endgame')) {
    const page = await start(browser, base, 'veteran');
    await step(page, 'unlock', async () => {
      await page.getByRole('button', { name: 'Settings' }).click();
      await wait(500);
      await page.getByRole('switch', { name: /Skip the unlocks/ }).check({ force: true });
      await page.getByRole('button', { name: 'Back' }).click();
      await toLoom(page);
      await snap(page, out, 'loom-all-open');
      for (const [name, id] of [['Dissonance', 'dissonance'], ['The Atlas of Echoes', 'atlas']]) {
        await step(page, id, async () => {
          await page.getByRole('button', { name: new RegExp('^' + name) }).first().click();
          await intro(page, id);
          if (await page.getByTestId('loom-screen').isVisible()) { await page.getByRole('button', { name: new RegExp('^' + name) }).first().click(); await wait(1200); }
          await snap(page, out, id);
          await snapTall(page, `${id}-whole`, { height: 3600 });
          await backToLoom(page);
        });
      }
    });
    await page.context().close();
  }
});
