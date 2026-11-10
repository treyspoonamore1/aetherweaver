/**
 * Phase 7 W8: a whole Finale-route Expedition, played node by node through the real app
 * (docs/phase-7.md, W8 and Exit criteria 6; release checklist row 6).
 *
 *   npm run e2e:fullrun            (sets AW_FULLRUN=1; builds, serves and runs this one file)
 *
 * What it does, in the page and with sound on:
 *   - Settings → Skip the unlocks opens Expeditions; a new Expedition (all four Movements, ending
 *     at the Silent Conductor) is begun, Prep is embarked on with the default party;
 *   - every fight is played through the combat screen by the Skilled bot's autoplay, at a raised
 *     dev time scale (the runtime still takes at most five ticks a frame, so the frame rate is
 *     the real limit under software rendering);
 *   - every other stop is passed through its own screen, with clicks and keys where the screen
 *     takes them: the map's Movement cards, each Result, the Calling's tiers, relic offers,
 *     drafts, Respites and their Bond scenes, merchants, forges, events (with a fight inside),
 *     and then the epilogue and the Summary. The one exception is choosing the next stop on the
 *     map: it goes through the run hook (`choose`, the store action a click on the node calls),
 *     because the page offers no stable handle for "this node". The stop is chosen so that the route
 *     passes an event, a Respite, a merchant and a forge when the map allows it (`nextStop`).
 *
 * The page's console errors, **warnings**, page errors and failed requests (a request that fails
 * or answers 400 and up) are collected, with one list of known environment-only warnings below;
 * none else is allowed. The run ends with one line, `[fullrun] {json}`, which
 * `tools/release-check.ts` reads: the outcome, the time, the counts, the heap's trend.
 *
 * It is outside the default e2e suite on purpose (its length is long and varies with the frame
 * rate): without AW_FULLRUN it is skipped. `AW_FULLRUN_SEED` picks the run's seed;
 * `AW_FULLRUN_FAST=1` wins each fight through the test hook instead of playing it, to check the
 * navigation alone in minutes. That mode is marked in its result line and `release-check` does
 * not accept it.
 */
import { expect, test, type Locator, type Page } from '@playwright/test';

const SEED = Number(process.env.AW_FULLRUN_SEED ?? 4242);
const FAST = process.env.AW_FULLRUN_FAST === '1';
/** The longest the whole run may take. Its length was unknown when this was written. */
const RUN_TIMEOUT_MS = 4 * 60 * 60 * 1000;
/** The longest one fight may take, and the longest the sim may stand still in one. */
const FIGHT_TIMEOUT_MS = 30 * 60 * 1000;
const STALL_MS = 90_000;
/** Raised dev time scale: see the header. */
const TIME_SCALE = 4;

/**
 * Console messages that come from the browser's software GL and not from the game. Each entry
 * names why. Anything else, a warning included, fails the run.
 */
const ENVIRONMENT_ONLY: { match: RegExp; why: string }[] = [
  {
    match: /GL Driver Message|GPU stall due to ReadPixels|Automatic fallback to software WebGL/i,
    why: 'headless Chromium rendering with SwiftShader (no GPU) reports these itself',
  },
];

interface FullHook {
  reachable(): { id: string; kind: string; movement: number }[];
  map(): { id: string; kind: string; next: string[] }[][];
  audio(): { unlocked: boolean; contextState: string; eventsHandled: number } | null;
  heap(): number | null;
}

type WindowWithFull = Window & { __AWFULL__?: FullHook };

interface Findings {
  errors: string[];
  warnings: string[];
  pageErrors: string[];
  failedRequests: string[];
  /** Environment-only messages that were let through, by their reason. */
  tolerated: Record<string, number>;
}

function collect(page: Page): Findings {
  const found: Findings = {
    errors: [],
    warnings: [],
    pageErrors: [],
    failedRequests: [],
    tolerated: {},
  };
  page.on('console', (msg) => {
    const type = msg.type();
    if (type !== 'error' && type !== 'warning') return;
    const text = msg.text();
    const known = ENVIRONMENT_ONLY.find((k) => k.match.test(text));
    if (known) {
      found.tolerated[known.why] = (found.tolerated[known.why] ?? 0) + 1;
      return;
    }
    (type === 'error' ? found.errors : found.warnings).push(text);
  });
  page.on('pageerror', (err) => found.pageErrors.push(err.message));
  page.on('requestfailed', (req) =>
    found.failedRequests.push(`${req.method()} ${req.url()}: ${req.failure()?.errorText ?? '?'}`),
  );
  page.on('response', (res) => {
    if (res.status() >= 400) found.failedRequests.push(`${res.status()} ${res.url()}`);
  });
  return found;
}

/** The kinds of stop worth passing at least once: the ones that are not a fight. */
const QUIET_KINDS = ['event', 'respite', 'merchant', 'forge', 'shrine'] as const;

/** How hard a stop is on the party: the tie-break between routes that cover the same kinds. */
const DANGER: Record<string, number> = {
  respite: 0,
  forge: 0,
  merchant: 0,
  shrine: 0,
  event: 1,
  skirmish: 2,
  elite: 3,
  miniboss: 4,
  boss: 5,
};

/**
 * The next stop: of the stops on offer, the one from which some route to the end of the map
 * passes the most quiet kinds this run has not passed yet (an event, a Respite, a merchant, a
 * forge); the gentler stop on a tie.
 */
function nextStop<T extends { id: string; kind: string }>(
  rows: { id: string; kind: string; next: string[] }[][],
  options: T[],
  seen: ReadonlySet<string>,
): T {
  const byId = new Map(rows.flat().map((n) => [n.id, n]));
  const bit = (kind: string) => {
    const i = QUIET_KINDS.indexOf(kind as (typeof QUIET_KINDS)[number]);
    return i < 0 || seen.has(kind) ? 0 : 1 << i;
  };
  const memo = new Map<string, Set<number>>();
  // The sets of new kinds some route from this stop to the end of the map can pass.
  const reach = (id: string): Set<number> => {
    const known = memo.get(id);
    if (known) return known;
    const node = byId.get(id);
    const out = new Set<number>();
    const own = node ? bit(node.kind) : 0;
    const after = node && node.next.length > 0 ? node.next.flatMap((n) => [...reach(n)]) : [0];
    for (const mask of after) out.add(mask | own);
    memo.set(id, out);
    return out;
  };
  const count = (mask: number) => mask.toString(2).replaceAll('0', '').length;
  const score = (id: string) => Math.max(...[...reach(id)].map(count));
  return [...options].sort(
    (a, b) => score(b.id) - score(a.id) || (DANGER[a.kind] ?? 9) - (DANGER[b.kind] ?? 9),
  )[0]!;
}

const phase = (page: Page) => page.evaluate(() => window.__AWRUN__!.phase());

/** Waits for the run to leave `from` (or for it to be a new stop of the same phase). */
async function leaves(page: Page, from: string, timeout = 30_000): Promise<void> {
  await expect.poll(() => phase(page), { timeout, intervals: [200] }).not.toBe(from);
}

/** The stop the run is at, as one string that changes whenever it moves on. */
const where = (page: Page) =>
  page.evaluate(() => {
    const run = window.__AWRUN__!;
    return `${run.phase()}|${run.results()}|${run.aether()}|${run.relics().length}`;
  });

async function waitForChange(page: Page, before: string, timeout = 30_000): Promise<void> {
  await expect.poll(() => where(page), { timeout, intervals: [200] }).not.toBe(before);
}

/** The bottom bar's one primary button (Result, Event outcome: "Continue", "Onward"…). */
function bottomButton(page: Page): Locator {
  return page.locator('div.fixed.inset-x-0.bottom-0 button').last();
}

/** Cards that sit over a screen until dismissed (a Rank-up, a Bond rank). */
async function dismissCards(page: Page): Promise<void> {
  for (const id of ['rank-up', 'bond-rank-up']) {
    const card = page.getByTestId(id);
    while (await card.isVisible().catch(() => false)) {
      await card.getByRole('button', { name: /Onward/ }).click();
      await expect(card).toHaveCount(0);
    }
  }
}

interface Tally {
  fights: number;
  steps: number;
  kinds: Record<string, number>;
  phases: Record<string, number>;
  fightLog: string[];
  heapMb: number[];
}

function stamp(start: number): string {
  const s = Math.round((Date.now() - start) / 1000);
  return `${String(Math.floor(s / 60)).padStart(3)}m${String(s % 60).padStart(2, '0')}s`;
}

/** Plays the fight on screen to its end: the Skilled bot through the real runtime, frames and all. */
async function playFight(page: Page, tally: Tally): Promise<void> {
  await page.waitForFunction(() => window.__AW__ !== undefined, undefined, { timeout: 120_000 });
  const id = await page.evaluate(() => window.__AW__!.encounter().id);
  const began = Date.now();
  if (FAST) {
    expect(await page.evaluate(() => window.__AWRUN__!.winFight())).toBe(true);
    tally.fightLog.push(`${id}: won through the hook (fast mode)`);
    return;
  }
  const begin = page.getByRole('button', { name: /Begin the fight/i });
  if (await begin.isVisible().catch(() => false)) await begin.click({ force: true });
  await page.evaluate((scale) => {
    window.__AW__!.autoplay('skilled');
    window.__AW__!.setDevTimeScale(scale);
  }, TIME_SCALE);
  let lastTick = -1;
  let lastMove = Date.now();
  for (;;) {
    if ((await phase(page)) !== 'combat') break;
    if (Date.now() - began > FIGHT_TIMEOUT_MS)
      throw new Error(`${id}: the fight ran past ${FIGHT_TIMEOUT_MS / 60000} minutes`);
    const tick = await page.evaluate(() => window.__AW__?.tick() ?? -1);
    if (tick !== lastTick) {
      lastTick = tick;
      lastMove = Date.now();
    } else if (Date.now() - lastMove > STALL_MS) {
      throw new Error(`${id}: the sim stood still at tick ${tick} for ${STALL_MS / 1000} s`);
    }
    await page.waitForTimeout(1500);
  }
  const seconds = (Date.now() - began) / 1000;
  const ticksPerSecond = lastTick > 0 ? Math.round(lastTick / seconds) : 0;
  tally.fightLog.push(
    `${id}: ${Math.round(seconds)} s, about ${lastTick} ticks (${ticksPerSecond} ticks per real second)`,
  );
}

test('Phase 7: a whole Finale-route Expedition, node by node, through the real app', async ({
  page,
}, testInfo) => {
  test.skip(!process.env.AW_FULLRUN, 'long: run it with `npm run e2e:fullrun`');
  test.setTimeout(RUN_TIMEOUT_MS);
  const found = collect(page);
  const tally: Tally = { fights: 0, steps: 0, kinds: {}, phases: {}, fightLog: [], heapMb: [] };
  const start = Date.now();
  let outcome = 'incomplete';
  let sound = false;

  const sampleHeap = async () => {
    const bytes = await page.evaluate(() => (window as WindowWithFull).__AWFULL__?.heap() ?? null);
    if (bytes !== null) tally.heapMb.push(Math.round(bytes / 1024 / 1024));
  };
  const log = (text: string) => console.log(`[fullrun] ${stamp(start)} ${text}`);

  try {
    await page.goto(`/?e2e=1&seed=${SEED}`);
    await page.waitForFunction(() => window.__AWRUN__ !== undefined);
    await page.waitForFunction(() => (window as WindowWithFull).__AWFULL__ !== undefined);

    // Settings → Skip the unlocks opens Expeditions (a new profile is Rank 1).
    await page
      .getByRole('button', { name: /^Settings$/ })
      .first()
      .click();
    await page.getByText('Skip the unlocks', { exact: true }).click();
    await expect(page.getByRole('switch', { name: /Skip the unlocks/ })).toBeChecked();
    await page.evaluate((seed) => window.__AWRUN__!.newRun(seed, 'expedition'), SEED);
    await expect.poll(() => phase(page)).toBe('prep');
    expect(await page.evaluate(() => window.__AWRUN__!.movement())).toMatchObject({ movements: 4 });
    log(
      `an Expedition, seed ${SEED}${FAST ? ' (fast mode: fights are won through the hook)' : ''}`,
    );

    // The step loop: one stop at a time, until the Summary.
    for (let step = 0; step < 400; step++) {
      const at = await phase(page);
      if (!at) throw new Error('the run vanished');
      tally.steps++;
      tally.phases[at] = (tally.phases[at] ?? 0) + 1;
      if (at === 'summary') break;
      const before = await where(page);

      if (at === 'prep') {
        await page
          .getByRole('button', { name: /Embark/i })
          .first()
          .click();
        await leaves(page, 'prep');
        // The first click on the page was a user gesture: the audio engine must have woken.
        await expect
          .poll(
            () => page.evaluate(() => (window as WindowWithFull).__AWFULL__?.audio()?.unlocked),
            {
              timeout: 20_000,
            },
          )
          .toBe(true);
      } else if (at === 'map') {
        const card = page.getByTestId('movement-card');
        if (await card.isVisible().catch(() => false))
          await card.getByRole('button').first().click();
        await expect(card).toHaveCount(0);
        const options = await page.evaluate(() =>
          (window as WindowWithFull).__AWFULL__!.reachable(),
        );
        if (options.length === 0) throw new Error('the map offers no stop');
        const rows = await page.evaluate(() => (window as WindowWithFull).__AWFULL__!.map());
        const pick = nextStop(rows, options, new Set(Object.keys(tally.kinds)));
        tally.kinds[pick.kind] = (tally.kinds[pick.kind] ?? 0) + 1;
        log(
          `map: ${pick.kind} (movement ${pick.movement}) of ${options.map((o) => o.kind).join('/')}`,
        );
        await page.evaluate((id) => window.__AWRUN__!.choose(id), pick.id);
        // Building an arena under software rendering can hold the page for a while.
        await leaves(page, 'map', 180_000);
      } else if (at === 'combat') {
        tally.fights++;
        await playFight(page, tally);
        log(tally.fightLog[tally.fightLog.length - 1]!);
        await sampleHeap();
        await expect.poll(() => phase(page), { timeout: 60_000 }).not.toBe('combat');
      } else if (at === 'result') {
        await dismissCards(page);
        await bottomButton(page).click();
        await waitForChange(page, before);
      } else if (at === 'calling') {
        await page.waitForTimeout(700);
        await page.keyboard.press('1');
        await leaves(page, 'calling');
      } else if (at === 'relic') {
        await page
          .getByRole('button', { name: /^Take / })
          .first()
          .click();
        await leaves(page, 'relic');
      } else if (at === 'draft') {
        await page.waitForTimeout(700);
        await page.keyboard.press('1');
        await leaves(page, 'draft');
      } else if (at === 'respite') {
        const scene = page.locator('[data-testid^="respite-scene-"]').first();
        if (await scene.isVisible().catch(() => false)) await scene.click();
        else {
          await page.waitForTimeout(700);
          await page.keyboard.press('1');
        }
        await leaves(page, 'respite');
      } else if (at === 'scene') {
        const reply = page.getByTestId('scene-reply-1');
        if (await reply.isVisible().catch(() => false)) await reply.click();
        await page.getByTestId('scene-continue').click();
        await leaves(page, 'scene');
      } else if (at === 'merchant') {
        const healing = page.getByRole('button', { name: /^Healing:/ });
        if (
          (await healing.count()) > 0 &&
          (await healing.first().getAttribute('aria-disabled')) !== 'true'
        )
          await healing.first().click();
        await page.getByRole('button', { name: /Leave the merchant/ }).click();
        await leaves(page, 'merchant');
      } else if (at === 'forge') {
        await page.getByRole('button', { name: /Leave (the forge|without using it)/ }).click();
        await leaves(page, 'forge');
      } else if (at === 'event') {
        await runEvent(page);
      } else {
        throw new Error(`a stop this run does not know how to pass: ${at}`);
      }
    }

    expect(await phase(page)).toBe('summary');
    outcome = (await page.evaluate(() => window.__AWRUN__!.outcome())) ?? 'none';
    log(`the Summary: ${outcome}`);
    if (outcome === 'victory') {
      // The epilogue comes first on a victory (skippable), then the cards.
      const epilogue = page.getByTestId('epilogue');
      await expect(epilogue).toBeVisible();
      await page.getByTestId('epilogue-skip').click();
      await expect(epilogue).toHaveCount(0);
      await dismissCards(page);
      await expect(page.getByRole('heading', { name: 'The song goes on' })).toBeVisible();
      await expect(page.getByTestId('summary-songs')).toBeVisible();
    } else {
      await expect(
        page.getByTestId('summary-without-you').or(page.locator('main, body')).first(),
      ).toBeVisible();
    }
    const audio = await page.evaluate(() => (window as WindowWithFull).__AWFULL__?.audio() ?? null);
    sound =
      !!audio && audio.unlocked && audio.contextState === 'running' && audio.eventsHandled > 0;
    log(`sound: ${JSON.stringify(audio)}`);
    await sampleHeap();
  } finally {
    const result = {
      outcome,
      seconds: Math.round((Date.now() - start) / 1000),
      errors: found.errors.length,
      warnings: found.warnings.length,
      pageErrors: found.pageErrors.length,
      failedRequests: found.failedRequests.length,
      fights: tally.fights,
      steps: tally.steps,
      sound,
      fast: FAST,
      seed: SEED,
      kinds: tally.kinds,
      phases: tally.phases,
      heapMb: tally.heapMb,
      tolerated: found.tolerated,
    };
    console.log(`[fullrun] ${JSON.stringify(result)}`);
    await testInfo.attach('fullrun.json', {
      body: JSON.stringify({ ...result, fightLog: tally.fightLog, found }, null, 2),
      contentType: 'application/json',
    });
  }

  expect(outcome, 'the run must end in victory (a defeat is the bot losing, not the app)').toBe(
    'victory',
  );
  expect(found.errors).toEqual([]);
  expect(found.warnings).toEqual([]);
  expect(found.pageErrors).toEqual([]);
  expect(found.failedRequests).toEqual([]);
  expect(sound, 'the audio engine ran with sound on').toBe(true);
});

/** An event: the first choice that can be taken (a motif step first, if it asks), then its outcome. */
async function runEvent(page: Page): Promise<void> {
  const choices = page.getByTestId('event-choices');
  await expect(choices).toBeVisible();
  await page.waitForTimeout(700);
  const open = choices.locator('button:not([aria-disabled="true"])').first();
  await open.click();
  // A choice may ask for one of your motifs first; the first offered is taken.
  const outcome = page.getByTestId('event-outcome');
  const picker = page.getByRole('button', { name: /, level \d+ to \d+/ }).first();
  const next = await Promise.race([
    outcome.waitFor({ state: 'visible', timeout: 5000 }).then(() => 'outcome' as const),
    picker.waitFor({ state: 'visible', timeout: 5000 }).then(() => 'picker' as const),
    expect
      .poll(() => phase(page), { timeout: 5000 })
      .not.toBe('event')
      .then(() => 'left' as const),
  ]).catch(() => 'outcome' as const);
  if (next === 'picker') await picker.click();
  if ((await phase(page)) === 'event') {
    await expect(outcome).toBeVisible();
    await bottomButton(page).click();
  }
  // Left for a fight (an event's own), or for the map: the loop reads the new phase.
  await expect.poll(() => phase(page), { timeout: 30_000 }).not.toBe('event');
}
