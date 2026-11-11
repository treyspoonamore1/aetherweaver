import { expect, test, type CDPSession, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { BENCH_SCENES, CROWD_ENEMIES, runBenchHeadless, type BenchScene } from '../src/app/bench';
import { BUDGETS, type BenchResult } from '../src/debug/benchReport';

/**
 * Phase 7, W4 (docs/phase-7.md, "Budgets as tests"): the bench page (`?lab=bench`) plays each
 * scene in headless Chromium, and the budgets that don't depend on the machine are asserted: draw
 * calls ≤ 200 and triangles ≤ 600k in every frame measured, the HUD's React commits ≤ 20 a second,
 * no error, and the sim at the scene's last tick equal to a headless run's. Frame times here are
 * SwiftShader's (the GPU rasterised on the CPU, beside other jobs): they are logged as readings,
 * and only a gross-regression bound is asserted.
 *
 * Two passes are long and run only when asked:
 * - `AW_PERF_LONG=1`: the heap over ten minutes of the Finale scene (played again and again);
 * - `AW_PERF_SAMPLE=1`: a heap-sampling pass over every scene, the profiles written to
 *   `AW_PERF_OUT` (default: the test's output folder).
 */

/** Ticks measured per scene here (the page's `&measure=`): 10 s of game time after the warm-up. */
const MEASURE = 600;
/**
 * CPU per frame, p95, under SwiftShader on a shared machine: only a gross regression (a frame
 * loop ten times slower than read in W4's runs) fails it.
 */
const CPU_P95_GROSS_MS = 400;
/**
 * The ten-minute heap test: the heap after it, collected, may be at most this share above the
 * heap after the first pass. Set from W4's first reading (docs/phase-7.md asks for it to be
 * stated), SwiftShader under load: 13.88 MB after the first pass, then 14.28, 14.50 and 14.84 MB
 * after 4.8, 8.8 and 12.8 minutes (4 passes), so ×1.069. A heap-snapshot diff over three short
 * passes put most of the rise (0.65 of 0.96 MB) in compiled code. A faster machine plays more
 * passes in ten minutes, so the share is a bound for this machine's pace.
 */
const HEAP_SHARE = 0.1;
const LONG = process.env.AW_PERF_LONG === '1';
const SAMPLE = process.env.AW_PERF_SAMPLE === '1';

function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(err.message));
  return errors;
}

async function results(page: Page): Promise<BenchResult[]> {
  return page.evaluate(() => window.__AWPERF__?.results ?? []);
}

/** Waits for the page's list to finish, and returns what it measured. */
async function benchDone(page: Page, timeout: number): Promise<BenchResult[]> {
  await page.waitForFunction(() => window.__AWPERF__?.status === 'done', null, {
    timeout,
    polling: 1000,
  });
  return results(page);
}

function headlessHash(scene: BenchScene, measure: number): string {
  return runBenchHeadless(scene, scene.warmupTicks + measure).hash;
}

function reading(r: BenchResult): string {
  const f = r.frames;
  return (
    `[perf] ${r.scene} (${r.quality}): ${f.frames} frames in ${r.realSeconds.toFixed(1)} s; ` +
    `CPU p50 ${f.cpuP50.toFixed(1)} / p95 ${f.cpuP95.toFixed(1)} ms; frame p50 ${f.frameP50.toFixed(1)} / ` +
    `p95 ${f.frameP95.toFixed(1)} ms; draw calls max ${f.drawCallsMax}; triangles max ${f.trianglesMax}; ` +
    `entities ${f.entitiesMax}; commits ${f.commitsPerSec.toFixed(1)}/s; heap ${r.heapStart} -> ${r.heapEnd}; ` +
    `canvas ${r.canvas.width}x${r.canvas.height} (SwiftShader, a reading under load)`
  );
}

for (const scene of BENCH_SCENES) {
  test(`perf: the bench's ${scene.name} plays to the headless hash, inside the draw-call, triangle and commit budgets`, async ({
    page,
  }) => {
    test.setTimeout(900_000);
    const errors = trackErrors(page);
    await page.goto(`/?lab=bench&scene=${scene.id}&measure=${MEASURE}`);
    const [r] = await benchDone(page, 840_000);
    expect(r).toBeDefined();
    console.log(reading(r!));
    expect(errors).toEqual([]);
    expect(r!.errors).toEqual([]);
    expect(r!.timedOut).toBe(false);
    // The sim, driven by the scene alone, is the sim headless: same ticks, same hash.
    expect(r!.toTick).toBe(scene.warmupTicks + MEASURE);
    expect(r!.hash).toBe(headlessHash(scene, MEASURE));
    expect(r!.frames.frames).toBeGreaterThan(20);
    if (scene.id === 'crowd') expect(r!.frames.entitiesMax).toBeGreaterThanOrEqual(CROWD_ENEMIES);
    // 05 §12's budgets that don't depend on the machine, in every frame measured.
    expect(r!.frames.drawCallsMax).toBeLessThanOrEqual(BUDGETS.drawCalls);
    expect(r!.frames.trianglesMax).toBeLessThanOrEqual(BUDGETS.triangles);
    expect(r!.frames.commitsPerSec).toBeLessThanOrEqual(BUDGETS.commitsPerSec);
    // SwiftShader's frame times are recorded above; only a gross regression fails here.
    expect(r!.frames.cpuP95).toBeLessThan(CPU_P95_GROSS_MS);
  });
}

test('perf: the bench on auto quality picks a tier and scales the resolution with no error', async ({
  page,
}) => {
  test.setTimeout(900_000);
  const errors = trackErrors(page);
  const scene = BENCH_SCENES.find((s) => s.id === 'hounds')!;
  await page.goto(`/?lab=bench&scene=hounds&quality=auto&measure=${MEASURE}`);
  const [r] = await benchDone(page, 840_000);
  console.log(
    `${reading(r!)}; auto's changes ${r!.qualityChanges}; ${r!.frames.fps.toFixed(1)} fps`,
  );
  expect(errors).toEqual([]);
  expect(r!.quality).toMatch(/^auto · (low|medium|high) · (60|70|80|90|100)%$/);
  // Quality is presentation: the sim plays the same.
  expect(r!.hash).toBe(headlessHash(scene, MEASURE));
  expect(r!.frames.drawCallsMax).toBeLessThanOrEqual(BUDGETS.drawCalls);
});

test('perf: HUD commits stay within 20 a second at the fastest frames this machine draws', async ({
  page,
}) => {
  // At 1280x720 SwiftShader draws a few frames a second, and the HUD can't commit faster than
  // frames come. A small window on low quality draws faster, so the 15 Hz HUD bridge and the
  // callouts are measured nearer the rate a laptop runs at (the fps is logged with the reading).
  test.setTimeout(900_000);
  const errors = trackErrors(page);
  await page.setViewportSize({ width: 320, height: 180 });
  const scene = BENCH_SCENES.find((s) => s.id === 'hounds')!;
  await page.goto(`/?lab=bench&scene=hounds&quality=low&measure=${MEASURE}`);
  const [r] = await benchDone(page, 840_000);
  console.log(`${reading(r!)}; ${r!.frames.fps.toFixed(1)} fps`);
  expect(errors).toEqual([]);
  expect(r!.hash).toBe(headlessHash(scene, MEASURE));
  expect(r!.frames.commitsPerSec).toBeLessThanOrEqual(BUDGETS.commitsPerSec);
});

test('perf: the bench page lists every scene and prints a read-out to copy', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/?lab=bench');
  for (const scene of BENCH_SCENES)
    await expect(page.getByTestId(`bench-run-${scene.id}`)).toBeVisible();
  await expect(page.getByTestId('bench-readout')).toContainText('Budgets (docs/plan/05 §12');
  expect(errors).toEqual([]);
});

/** The JS heap after a full collection (Chromium's own count, through the DevTools protocol). */
async function heapAfterGc(cdp: CDPSession): Promise<number> {
  await cdp.send('HeapProfiler.collectGarbage');
  const usage = (await cdp.send('Runtime.getHeapUsage')) as { usedSize: number };
  return usage.usedSize;
}

test('perf @long: the heap after ten minutes of the Finale scene is within a set share of its start', async ({
  page,
}) => {
  test.skip(!LONG, 'long: AW_PERF_LONG=1 runs it (about fifteen minutes)');
  test.setTimeout(40 * 60_000);
  const errors = trackErrors(page);
  const cdp = await page.context().newCDPSession(page);
  // The full Finale scene, again and again, 4 s apart: the heap is read in the gaps, with no
  // runtime alive, after the first pass (chunks loaded, shaders compiled) and after each other.
  await page.goto('/?lab=bench&scene=finale&repeat=60&gap=4000');
  const pass = async (n: number) =>
    page.waitForFunction((k) => (window.__AWPERF__?.results.length ?? 0) >= k, n, {
      timeout: 20 * 60_000,
      polling: 250,
    });
  await pass(1);
  const start = await heapAfterGc(cdp);
  const began = Date.now();
  const readings: { pass: number; minutes: number; bytes: number }[] = [
    { pass: 1, minutes: 0, bytes: start },
  ];
  let passes = 1;
  while (Date.now() - began < 10 * 60_000) {
    await pass(passes + 1);
    passes++;
    readings.push({
      pass: passes,
      minutes: (Date.now() - began) / 60_000,
      bytes: await heapAfterGc(cdp),
    });
  }
  const end = readings[readings.length - 1]!.bytes;
  console.log(
    `[perf] heap over ${readings[readings.length - 1]!.minutes.toFixed(1)} min of the Finale scene ` +
      `(${passes} passes): ${readings.map((x) => `${x.minutes.toFixed(1)} min ${(x.bytes / 1048576).toFixed(2)} MB`).join(', ')}; ` +
      `end / start ${(end / start).toFixed(3)} (SwiftShader, under load)`,
  );
  const last = (await results(page)).at(-1)!;
  expect(errors).toEqual([]);
  expect(last.errors).toEqual([]);
  expect(end).toBeLessThanOrEqual(start * (1 + HEAP_SHARE));
});

interface SamplingNode {
  callFrame: { functionName: string; url: string; lineNumber: number; columnNumber: number };
  selfSize: number;
  children: SamplingNode[];
}

test('perf @sample: heap sampling over each bench scene (the allocation pass)', async ({
  page,
}, testInfo) => {
  test.skip(!SAMPLE, 'long: AW_PERF_SAMPLE=1 runs it');
  test.setTimeout(60 * 60_000);
  const out = process.env.AW_PERF_OUT ?? testInfo.outputPath('heap');
  mkdirSync(out, { recursive: true });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('HeapProfiler.enable');
  for (const scene of BENCH_SCENES) {
    await page.goto(`/?lab=bench&scene=${scene.id}&measure=${MEASURE}`);
    // Sample the measured part only: from the warm-up's end to the halt.
    await page.waitForFunction(
      () =>
        document
          .querySelector('[data-testid="bench-progress"]')
          ?.textContent?.includes('measuring'),
      null,
      { timeout: 600_000, polling: 100 },
    );
    await cdp.send('HeapProfiler.startSampling', {
      samplingInterval: 8192,
      includeObjectsCollectedByMajorGC: true,
      includeObjectsCollectedByMinorGC: true,
    });
    const [r] = await benchDone(page, 840_000);
    const { profile } = (await cdp.send('HeapProfiler.stopSampling')) as {
      profile: { head: SamplingNode };
    };
    // Self bytes by allocation site, over the measured seconds. A built-in (no script: `push`,
    // `Map`, an iterator's `next`) is charged to the nearest script function that called it.
    const sites = new Map<string, number>();
    const walk = (n: SamplingNode, owner: string) => {
      const f = n.callFrame;
      const own = f.url
        ? `${f.url}:${f.lineNumber + 1}:${f.columnNumber + 1} ${f.functionName || '(anonymous)'}`
        : null;
      const key = own ?? `${owner} [${f.functionName || '(native)'}]`;
      if (n.selfSize > 0) sites.set(key, (sites.get(key) ?? 0) + n.selfSize);
      for (const c of n.children) walk(c, own ?? owner);
    };
    walk(profile.head, '(root)');
    const total = [...sites.values()].reduce((a, b) => a + b, 0);
    const top = [...sites.entries()].sort((a, b) => b[1] - a[1]).slice(0, 150);
    writeFileSync(
      `${out}/heap-${scene.id}.json`,
      JSON.stringify(
        {
          scene: scene.id,
          seconds: r!.realSeconds,
          frames: r!.frames.frames,
          totalBytes: total,
          bytesPerFrame: total / Math.max(1, r!.frames.frames),
          top: top.map(([site, bytes]) => ({ site, bytes })),
        },
        null,
        1,
      ),
    );
    console.log(
      `[perf] ${scene.id}: ${(total / 1048576).toFixed(1)} MB sampled over ${r!.frames.frames} frames ` +
        `(${(total / Math.max(1, r!.frames.frames) / 1024).toFixed(1)} KB a frame; under load)`,
    );
  }
});
