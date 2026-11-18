/**
 * Solos in the real app (docs/solos.md): heroes fire their own, and a Solo is Cued when the
 * Weaver's Thread is on the hero as it fires. No key Cues a Solo.
 *
 *   - A new player's first fight, with nothing touched: a Solo comes, the frame says so, and it
 *     fires plain.
 *   - The same fight with the Thread moved to the hero as their Solo comes: it fires Cued.
 *   - The old Cue key and Shift+number Cue nothing; with Auto-Thread on and the hands off, the
 *     Thread follows each Solo and they fire Cued.
 *   - A settings file from before the rework opens, and Controls has no Cue row.
 *
 * The Conductor's Duet, made by moving the Thread, is in `smoke.spec.ts`.
 *
 * What the page showed is collected by an observer inside it (`watchHud`), so that a state a
 * second long (the full Solo's "Thread to Cue", a call-out) is never missed between two polls on
 * a slow, software-rendered page.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import { CONTENT } from '../src/content';

const START_URL = '/?e2e=1&seed=4242';

function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(err.message));
  return errors;
}

/** What the page has shown since `watchHud`: the Solo strips' states and every call-out line. */
interface Seen {
  /** `"<slot>|<state>|<what the strip says>"`, in the order first seen. */
  strips: string[];
  /** Each line a call-out showed, in the order first seen. */
  callouts: string[];
}
declare global {
  interface Window {
    __SEEN__?: Seen;
  }
}

/** Starts collecting what the HUD shows (see the header). Call once the fight's HUD is up. */
async function watchHud(page: Page): Promise<void> {
  await page.evaluate(() => {
    const seen: Seen = { strips: [], callouts: [] };
    window.__SEEN__ = seen;
    const add = (list: string[], line: string) => {
      if (line && !list.includes(line)) list.push(line);
    };
    const look = () => {
      const frames = [...document.querySelectorAll('[data-testid="party-frames"] > div > div')];
      frames.forEach((frame, slot) => {
        const strip = frame.querySelector('[data-testid="solo-strip"]');
        if (!strip) return;
        const say = strip.querySelector('[data-testid="solo-say"]')?.textContent ?? '';
        add(seen.strips, `${slot}|${strip.getAttribute('data-state')}|${say}`);
      });
      const callouts = document.querySelector<HTMLElement>('[data-testid="callouts"]');
      for (const line of (callouts?.innerText ?? '').split('\n')) add(seen.callouts, line.trim());
    };
    look();
    new MutationObserver(look).observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['data-state'],
    });
  });
}
const seen = (page: Page) => page.evaluate(() => window.__SEEN__!);
const solos = (page: Page) => page.evaluate(() => window.__AW__!.solos());
const threadSlot = (page: Page) =>
  page.evaluate(
    () => window.__AW__!.snapshot().entities.find((e) => e.kind === 'weaver')!.threadSlot ?? null,
  );

/** A hero's party frame, by slot (the same elements `watchHud` reads). */
const frameOf = (page: Page, slot: number) =>
  page.locator('[data-testid="party-frames"] > div > div').nth(slot);

/** A hero's name and their Solo's, as the HUD writes them. */
function named(heroId: string): { hero: string; solo: string } {
  const def = CONTENT.heroes.find((h) => h.id === heroId)!;
  return { hero: def.name, solo: def.solo.name };
}

/**
 * A new profile's first run, to the start of its first fight (First Light), through Prep and
 * the map. The primer that opens the fight teaches the rule; Begin starts it.
 */
async function firstFight(page: Page): Promise<void> {
  await page.goto(START_URL);
  await page.waitForFunction(() => window.__AWRUN__ !== undefined);
  await page.evaluate(() => window.__AWRUN__!.newRun(4242));
  await expect.poll(() => page.evaluate(() => window.__AWRUN__!.phase())).toBe('prep');
  await page
    .getByRole('button', { name: /Embark/i })
    .first()
    .click();
  await expect.poll(() => page.evaluate(() => window.__AWRUN__!.phase())).toBe('map');
  expect(await page.evaluate(() => window.__AWRUN__!.choose())).toBe('skirmish');
  await page.waitForFunction(() => window.__AW__ !== undefined);
  await expect.poll(() => page.evaluate(() => window.__AW__!.encounter().id)).toBe('first_light');
  // The primer: heroes fire their own Solos, and what "Cued" is, in the one phrase used everywhere.
  await expect(page.getByText('Cue their Solos')).toBeVisible();
  await expect(
    page.getByText(
      'Heroes fire their own Solos. A Solo fired with your Thread on them is Cued: the stronger form.',
    ),
  ).toBeVisible();
  // It names no key for a Solo.
  await expect(page.getByText(/Cue key|to Cue it \(|Shift/)).toHaveCount(0);
  await page.getByRole('button', { name: /Begin the fight/i }).click();
  await watchHud(page);
}

/**
 * Lets the fight run fast until a Solo is nearly charged, then at its own pace, so the last
 * seconds (the tell, the wait, the Solo) pass slowly enough to be seen.
 */
async function untilASoloNears(page: Page): Promise<void> {
  await page.evaluate(() => window.__AW__!.setDevTimeScale(3));
  await expect
    .poll(async () => Math.max(...(await solos(page)).heroes.map((h) => h.charge)), {
      timeout: 300_000,
      intervals: [250],
    })
    .toBeGreaterThanOrEqual(75);
  await page.evaluate(() => window.__AW__!.setDevTimeScale(1));
}

test('a new player’s first fight, nothing touched: a Solo comes, the frame says “Thread to Cue”, and it fires plain', async ({
  page,
}) => {
  // The Solos take about 30 s of the fight to charge (software rendering runs it slower).
  test.setTimeout(420_000);
  const errors = trackErrors(page);
  await firstFight(page);
  // No key, no click, no mouse move from here on. The Thread is on nobody.
  expect(await threadSlot(page)).toBeNull();
  await untilASoloNears(page);

  // A Solo fires, with nothing done to make it.
  await expect
    .poll(async () => (await solos(page)).heroes.some((h) => h.playing), {
      timeout: 240_000,
      intervals: [100],
    })
    .toBe(true);
  const now = await solos(page);
  const first = now.heroes.find((h) => h.playing)!;
  const { hero, solo } = named(first.heroId);
  // Plain: the Thread was on nobody, so nothing was Cued.
  expect(first.cued).toBe(false);
  expect(now.cuedSoFar).toBe(0);
  expect(await threadSlot(page)).toBeNull();
  expect(await page.evaluate(() => window.__AW__!.markers())).not.toContain('cue');
  // While it plays, their frame says so.
  await expect(frameOf(page, first.slot).getByTestId('solo-count')).toHaveText('SOLO');

  const shown = await seen(page);
  const strips = shown.strips.filter((s) => s.startsWith(`${first.slot}|`));
  // Their frame told of it first: quiet while it charged, then "Thread to Cue" once it was full.
  expect(strips).toContain(`${first.slot}|coming|`);
  expect(strips).toContain(`${first.slot}|now|Thread to Cue`);
  // It never said "Cued": the Thread was elsewhere.
  expect(shown.strips.filter((s) => s.includes('|cued|'))).toEqual([]);
  // The call-out names the hero and the Solo, with no "Cued" in front.
  await expect.poll(async () => (await seen(page)).callouts).toContain(`${hero}: ${solo}`);
  expect((await seen(page)).callouts.filter((c) => c.startsWith('Cued'))).toEqual([]);
  expect(errors).toEqual([]);
});

test('threading a hero as their Solo comes makes it Cued: the frame says so, then the call-out', async ({
  page,
}) => {
  test.setTimeout(420_000);
  const errors = trackErrors(page);
  await firstFight(page);
  // The Thread on Kael, as a player would keep the tank alive.
  await page.keyboard.press('Digit1');
  await expect.poll(() => threadSlot(page)).toBe(0);
  await untilASoloNears(page);

  // The first other hero whose Solo is full: their frame says "Thread to Cue".
  let slot = -1;
  await expect
    .poll(
      async () => {
        const full = (await solos(page)).heroes.find(
          (h) => h.slot !== 0 && h.charge >= 100 && h.dueIn !== null && !h.playing,
        );
        slot = full ? full.slot : -1;
        return slot;
      },
      { timeout: 240_000, intervals: [50] },
    )
    .toBeGreaterThan(0);
  const before = (await solos(page)).cuedSoFar;
  // Their key threads them. That is all a Cue is.
  await page.keyboard.press(`Digit${slot + 1}`);
  await expect.poll(() => threadSlot(page)).toBe(slot);

  // The Solo fires with the Thread on them: Cued.
  await expect
    .poll(async () => (await solos(page)).heroes[slot]!.playing, {
      timeout: 120_000,
      intervals: [50],
    })
    .toBe(true);
  const now = await solos(page);
  expect(now.heroes[slot]!.cued).toBe(true);
  expect(now.cuedSoFar).toBe(before + 1);
  expect(await page.evaluate(() => window.__AW__!.markers())).toContain('cue');

  const { hero, solo } = named(now.heroes[slot]!.heroId);
  const shown = await seen(page);
  // Their frame went from "Thread to Cue" to "Cued" as the Thread arrived.
  expect(shown.strips).toContain(`${slot}|now|Thread to Cue`);
  expect(shown.strips).toContain(`${slot}|cued|Cued`);
  expect(shown.strips.indexOf(`${slot}|cued|Cued`)).toBeGreaterThan(
    shown.strips.indexOf(`${slot}|now|Thread to Cue`),
  );
  await expect.poll(async () => (await seen(page)).callouts).toContain(`Cued · ${hero}: ${solo}`);
  expect(errors).toEqual([]);
});

/** Into the Training Grounds, with a sturdy brute for the party to fight. */
async function trainingFight(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Enter the Loom' }).click();
  await expect(page.getByTestId('loom-screen')).toBeVisible();
  if (await page.getByTestId('station-intro').isVisible())
    await page.getByTestId('intro-later').click();
  await page
    .getByRole('button', { name: /Training Grounds/i })
    .first()
    .click();
  await page.waitForFunction(() => window.__AW__ !== undefined && window.__AW__.tick() > 30);
  await expect(page.getByTestId('party-frames')).toContainText('Kael');
  const kael = await page.evaluate(() => {
    const s = window.__AW__!.snapshot();
    return s.entities.find((e) => e.id === s.party[0])!;
  });
  await page.evaluate(
    ([x, z]) => {
      window.__AW__!.queue({
        t: 'debug',
        op: { op: 'spawnEnemy', defId: 'bell_brute', x: x!, z: z! - 4, elite: true },
      });
      // The Weaver stands back, out of the brute's swings and within the Thread's reach.
      window.__AW__!.queue({ t: 'debug', op: { op: 'teleportWeaver', x: 0, z: 5 } });
    },
    [kael.x, kael.z],
  );
}

/** Waits `n` ticks of the fight (the page's own clock: it runs slower than real time here). */
async function waitTicks(page: Page, n: number): Promise<void> {
  const target = (await page.evaluate(() => window.__AW__!.tick())) + n;
  await page.waitForFunction((t) => window.__AW__!.tick() >= t, target, { timeout: 300_000 });
}

/**
 * Every Solo charged at once in the Training Grounds, hands off, the party kept whole: the slots
 * the Thread visited and how many Solos fired Cued.
 */
async function chargedHandsOff(page: Page): Promise<{ visited: (number | null)[]; cued: number }> {
  const before = (await solos(page)).cuedSoFar;
  await page.evaluate(() => {
    window.__AW__!.queue({ t: 'debug', op: { op: 'healParty' } });
    window.__AW__!.queue({ t: 'debug', op: { op: 'chargeSolos' } });
  });
  const visited: (number | null)[] = [];
  const end = (await page.evaluate(() => window.__AW__!.tick())) + 420;
  while ((await page.evaluate(() => window.__AW__!.tick())) < end) {
    const at = await threadSlot(page);
    if (visited[visited.length - 1] !== at) visited.push(at);
    await page.evaluate(() => window.__AW__!.queue({ t: 'debug', op: { op: 'healParty' } }));
    await page.waitForTimeout(40);
  }
  return { visited, cued: (await solos(page)).cuedSoFar - before };
}

test('no key Cues a Solo: T and Shift+number do nothing of the kind, and with the hands off only the threaded hero’s Solo is Cued', async ({
  page,
}) => {
  test.setTimeout(420_000);
  const errors = trackErrors(page);
  await page.goto(START_URL);
  await trainingFight(page);
  // Shift with a hero's number threads that hero, as the number alone does. T is bound to nothing.
  await page.keyboard.press('KeyT');
  await page.keyboard.press('Shift+Digit2');
  await waitTicks(page, 20);
  expect(await threadSlot(page)).toBe(1);
  expect(await page.evaluate(() => window.__AW__!.markers())).not.toContain('cue');
  // Hands off for more than Auto-Thread's 2 s (it is off: nothing may move the Thread).
  await waitTicks(page, 200);
  const { visited, cued } = await chargedHandsOff(page);
  expect(visited).toEqual([1]);
  // The three fire on their own, a second apart. Only the hero the Thread is on is Cued.
  expect(cued).toBe(1);
  expect(errors).toEqual([]);
});

test('Auto-Thread on, hands off: the Thread follows each Solo, and all three fire Cued', async ({
  page,
}) => {
  test.setTimeout(420_000);
  const errors = trackErrors(page);
  await page.goto(START_URL);
  // The aid is turned on where a player turns it on: Settings, under how the controls behave.
  await page
    .getByRole('button', { name: /^Settings$/ })
    .first()
    .click();
  const aid = page.getByRole('switch', { name: /Auto-Thread/ });
  await aid.evaluate((el) => (el as HTMLElement).click());
  await expect(aid).toBeChecked();
  // The setting is kept: the page opened again has it.
  await page.goto(START_URL);
  await trainingFight(page);
  await page.keyboard.press('Digit2');
  await waitTicks(page, 200);
  const { visited, cued } = await chargedHandsOff(page);
  // It went from hero to hero, and every Solo had the Thread on it as it fired.
  expect(new Set(visited.filter((s) => s !== null)).size).toBe(3);
  expect(cued).toBe(3);
  expect(errors).toEqual([]);
});

test('a settings file from before the rework opens: no Cue rows in Settings, its other choices kept, and it is saved as version 5', async ({
  page,
}) => {
  const errors = trackErrors(page);
  // A real save from the last build before the rework (tests/fixtures/saves): settings 4, with
  // Hero autonomy on, the Cue key on Y, the Cue modifier on Ctrl and the pad's Cue on a button.
  const fixture = JSON.parse(
    readFileSync(
      fileURLToPath(new URL('../tests/fixtures/saves/b16-2a2b91b.json', import.meta.url)),
      'utf8',
    ),
  ) as { keys: Record<string, string> };
  const old = fixture.keys['aetherweaver.settings']!;
  expect((JSON.parse(old) as { version: number }).version).toBe(4);
  expect(old).toMatch(/autonomy/);
  expect(old).toMatch(/cueModifier/);
  await page.addInitScript((text) => {
    if (!localStorage.getItem('aetherweaver.settings'))
      localStorage.setItem('aetherweaver.settings', text);
  }, old);
  await page.goto(START_URL);
  await page
    .getByRole('button', { name: /^Settings$/ })
    .first()
    .click();
  await expect(page.getByTestId('controls-settings')).toBeVisible();
  const text = await page.locator('body').innerText();
  for (const gone of [
    'Cue modifier',
    'Hero autonomy',
    'Cue a Solo',
    'Cue their Solo',
    'Cue the reticle',
  ])
    expect(text, gone).not.toContain(gone);
  for (const there of ['Auto-Thread', 'Perfect Ward window', 'Telegraph lead', 'Thread hero 1'])
    expect(text, there).toContain(there);
  // Auto-Thread's hint says the rule as built.
  expect(text).toContain('Left alone for 2 s, the Thread follows each Solo.');
  // A change writes the file back: version 5, without the three things, the rest as it was.
  await page
    .getByRole('switch', { name: /Captions/ })
    .first()
    .evaluate((el) => (el as HTMLElement).click());
  await expect
    .poll(async () => {
      const raw = await page.evaluate(() => localStorage.getItem('aetherweaver.settings'));
      return (JSON.parse(raw!) as { version: number }).version;
    })
    .toBe(5);
  const after = await page.evaluate(() => localStorage.getItem('aetherweaver.settings')!);
  expect(after).not.toMatch(/autonomy|cueModifier|cueReticle|"cue"/);
  const kept = JSON.parse(after) as {
    assists: { telegraphLead: number };
    input?: { threadMode?: string };
  };
  const was = JSON.parse(old) as typeof kept;
  expect(kept.assists.telegraphLead).toBe(was.assists.telegraphLead);
  expect(kept.input?.threadMode).toBe(was.input?.threadMode);
  expect(errors).toEqual([]);
});
