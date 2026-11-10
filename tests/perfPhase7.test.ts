/**
 * Phase 7, W4 (docs/phase-7.md, "W4: performance"): the quality setting and `auto`'s pick on
 * scripted frame-time series, the bench's scenes played headless (the same seed gives the same
 * hash), the bench's frame recorder and read-out, and the runtime's sites that stay as W0 left
 * them. Frame-time budgets are not asserted here: they need a real GPU (e2e/perf.spec.ts and the
 * bench page record readings).
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  BENCH_KITS,
  BENCH_SCENES,
  CROWD_ENEMIES,
  benchEndTick,
  runBenchHeadless,
} from '../src/app/bench';
import { DEFAULT_SETTINGS, optionsOf, SettingsSchema } from '../src/app/settings';
import { BUDGETS, benchText, type BenchResult } from '../src/debug/benchReport';
import { FrameStats, pct } from '../src/debug/frameStats';
import {
  AUTO_QUALITY,
  AutoQuality,
  RESOLUTION_SCALE_MAX,
  RESOLUTION_SCALE_MIN,
  pixelRatioFor,
} from '../src/render/stage';
import { ARRIVAL3_KIT, ARRIVAL4_KIT, ARRIVAL_KIT, presetChords } from '../tools/kits';

const RUNTIME = readFileSync(new URL('../src/app/runtime.ts', import.meta.url), 'utf8');

/** Feeds `seconds` of frames of `ms` each; returns how many samples changed something. */
function feed(auto: AutoQuality, ms: number, seconds: number): number {
  let changed = 0;
  for (let t = 0; t < seconds * 1000; t += ms) if (auto.sample(ms)) changed++;
  return changed;
}

describe('quality: the setting', () => {
  it('is high with the key absent, as before Phase 7', () => {
    expect(optionsOf(DEFAULT_SETTINGS).quality).toBe('high');
    expect('quality' in DEFAULT_SETTINGS).toBe(false);
  });

  it('takes every value of the contract, and nothing else', () => {
    for (const q of ['auto', 'low', 'medium', 'high'] as const) {
      const s = SettingsSchema.parse({ ...DEFAULT_SETTINGS, quality: q });
      expect(optionsOf(s).quality).toBe(q);
    }
    expect(SettingsSchema.safeParse({ ...DEFAULT_SETTINGS, quality: 'ultra' }).success).toBe(false);
  });

  it("each tier's pixel ratio at full resolution is the one the stage always set", () => {
    for (const dpr of [0.75, 1, 1.25, 1.5, 2, 3]) {
      expect(pixelRatioFor('high', dpr)).toBe(Math.min(dpr, 2));
      expect(pixelRatioFor('medium', dpr)).toBe(Math.min(dpr, 1.5));
      expect(pixelRatioFor('low', dpr)).toBe(1);
      expect(pixelRatioFor('high', dpr, 1)).toBe(Math.min(dpr, 2));
    }
    expect(pixelRatioFor('high', 2, 0.6)).toBeCloseTo(1.2, 10);
    expect([RESOLUTION_SCALE_MIN, RESOLUTION_SCALE_MAX]).toEqual([0.6, 1]);
  });

  it('the runtime reads it through optionsOf, and only builds an AutoQuality on auto', () => {
    expect(RUNTIME).toMatch(/optionsOf\(useSettings\.getState\(\)\.settings\)\.quality/);
    expect(RUNTIME).toMatch(/optionsOf\(settings\)\.quality/);
    expect(RUNTIME).not.toMatch(/settings\.quality\b/);
    expect(RUNTIME).toMatch(/if \(quality === 'auto'\) this\.auto = new AutoQuality/);
  });
});

describe('quality: auto on scripted frame times', () => {
  it('a machine holding 60 fps stays on high at full resolution', () => {
    const auto = new AutoQuality();
    expect(feed(auto, 1000 / 60, 60)).toBe(0);
    expect([auto.tier, auto.scale, auto.changes]).toEqual(['high', 1, 0]);
  });

  it('a machine at 30 fps steps to low while picking, then the resolution to 0.6, and stays', () => {
    const auto = new AutoQuality();
    feed(auto, 33, AUTO_QUALITY.settleMs / 1000);
    expect(auto.tier).toBe('high'); // the first second is ignored
    feed(auto, 33, 3);
    expect(auto.tier).toBe('low');
    expect(auto.scale).toBe(1);
    feed(auto, 33, 30);
    expect(auto.scale).toBe(0.6);
    // high → medium → low, then 0.9, 0.8, 0.7, 0.6, and nothing more.
    expect(auto.changes).toBe(6);
    expect(feed(auto, 33, 30)).toBe(0);
  });

  it('a 45 fps machine ends the pick on low, then the resolution settles at 0.6', () => {
    const auto = new AutoQuality();
    feed(auto, 22, 1 + AUTO_QUALITY.pickMs / 1000);
    expect(auto.tier).toBe('low');
    expect(auto.picking).toBe(false);
    feed(auto, 22, 10);
    expect(auto.tier).toBe('low');
    expect(auto.scale).toBe(0.6);
  });

  it('a machine drawing two frames a second is still judged while the tier is picked', () => {
    const auto = new AutoQuality();
    feed(auto, 480, 1 + AUTO_QUALITY.pickMs / 1000);
    expect(auto.tier).toBe('low');
    feed(auto, 480, 30);
    expect(auto.scale).toBe(0.6);
    expect(auto.changes).toBe(6);
  });

  it('one long frame in a window (a hitch) changes nothing', () => {
    const auto = new AutoQuality();
    let changed = 0;
    for (let i = 0; i < 60 * 60; i++) if (auto.sample(i % 40 === 39 ? 120 : 1000 / 60)) changed++;
    expect(changed).toBe(0);
    expect([auto.tier, auto.scale]).toEqual(['high', 1]);
  });

  it('the resolution climbs back only after fast windows in a row, never the tier after the pick', () => {
    const auto = new AutoQuality();
    feed(auto, 33, 12);
    expect([auto.tier, auto.scale]).toEqual(['low', 0.6]);
    // Two fast windows, then one between the bounds: no step up (the run starts again).
    const win = AUTO_QUALITY.window;
    for (let w = 0; w < 2; w++) for (let i = 0; i < win; i++) auto.sample(1000 / 60);
    for (let i = 0; i < win; i++) auto.sample(18);
    expect(auto.scale).toBe(0.6);
    feed(auto, 1000 / 60, 30);
    expect(auto.scale).toBe(1);
    expect(auto.tier).toBe('low');
  });

  it('frames between the two bounds (the dead band) move nothing', () => {
    const auto = new AutoQuality();
    expect(feed(auto, 19, 60)).toBe(0);
  });

  it('alternating slow and fast windows only step down: it cannot swing', () => {
    const auto = new AutoQuality();
    const win = AUTO_QUALITY.window;
    let ups = 0;
    let last = auto.scale;
    for (let w = 0; w < 200; w++) {
      const ms = w % 2 === 0 ? 25 : 1000 / 60;
      for (let i = 0; i < win; i++) auto.sample(ms);
      if (auto.scale > last) ups++;
      last = auto.scale;
    }
    expect(ups).toBe(0);
    expect(auto.changes).toBeLessThanOrEqual(2 + 4);
  });

  it('started from a lower tier (the last fight’s pick), it steps up once at most', () => {
    const auto = new AutoQuality('low');
    feed(auto, 1000 / 60, 60);
    expect(auto.tier).toBe('medium');
    expect(auto.changes).toBe(1);
  });

  it('ignores zero, negative and non-finite frame times', () => {
    const auto = new AutoQuality();
    for (const v of [0, -5, Number.NaN, Number.POSITIVE_INFINITY])
      expect(auto.sample(v)).toBe(false);
    expect(auto.picking).toBe(true);
  });
});

describe('the bench scenes', () => {
  it('play from the harness’s own kits (no copy drifts)', () => {
    expect(BENCH_KITS.arrival).toEqual({ motifs: ARRIVAL_KIT.motifs, relics: ARRIVAL_KIT.relics });
    expect(BENCH_KITS.arrival3).toEqual({
      motifs: ARRIVAL3_KIT.motifs,
      relics: ARRIVAL3_KIT.relics,
    });
    expect(BENCH_KITS.arrival4).toEqual({
      motifs: ARRIVAL4_KIT.motifs,
      relics: ARRIVAL4_KIT.relics,
    });
    for (const scene of BENCH_SCENES) {
      expect(scene.config.chords).toEqual(presetChords('guardian'));
      expect(scene.config.debug).toBe(true);
      expect(scene.config.seed).toBe(scene.seed);
    }
    expect(BENCH_SCENES.map((s) => s.id)).toEqual(['finale', 'hounds', 'unweaver', 'crowd']);
  });

  for (const scene of BENCH_SCENES) {
    it(`${scene.id}: the same seed gives the same hash, and the fight is still on at the halt`, () => {
      const a = runBenchHeadless(scene);
      const b = runBenchHeadless(scene);
      expect(a.tick).toBe(benchEndTick(scene));
      expect(b).toEqual(a);
      expect(a.status).toBe('fighting');
      if (scene.id === 'finale') {
        expect(a.maxChoir).toBe(4);
        expect(a.silence).toBe(true);
      }
      if (scene.id === 'hounds') expect(a.maxEnemies).toBeGreaterThanOrEqual(12);
      if (scene.id === 'unweaver') expect(a.maxEnemies).toBeGreaterThanOrEqual(10);
      if (scene.id === 'crowd') expect(a.maxEnemies).toBeGreaterThanOrEqual(CROWD_ENEMIES);
    });
  }

  it('the crowd stands at 150 or more from its warm-up to its halt', () => {
    const crowd = BENCH_SCENES.find((s) => s.id === 'crowd')!;
    const early = runBenchHeadless(crowd, crowd.warmupTicks);
    expect(early.maxEnemies).toBeGreaterThanOrEqual(CROWD_ENEMIES);
  });
});

describe('the bench recorder and read-out', () => {
  it('summarises frames by nearest rank, keeping the latest when full', () => {
    const stats = new FrameStats(100);
    for (let i = 1; i <= 100; i++) stats.record(i, 16, 100 + i, 1000 * i, i % 7);
    stats.addCommits(15, 1000);
    const s = stats.summary();
    expect(s.frames).toBe(100);
    expect([s.cpuP50, s.cpuP95, s.cpuMax]).toEqual([51, 96, 100]);
    expect([s.drawCallsP95, s.drawCallsMax, s.trianglesMax]).toEqual([196, 200, 100_000]);
    expect(s.fps).toBeCloseTo(62.5, 6);
    expect(s.seconds).toBeCloseTo(1.6, 6);
    expect(s.entitiesMax).toBe(6);
    expect(s.commitsPerSec).toBe(15);
    stats.record(500, 16, 1, 1, 0);
    expect(stats.count).toBe(100);
    expect(stats.summary().cpuMax).toBe(500);
    expect(pct([], 0.5)).toBe(0);
  });

  it('prints every budget, every scene and the hash as copyable text', () => {
    const frames = new FrameStats(10);
    for (let i = 0; i < 10; i++) frames.record(5, 20, 210, 1000, 9);
    frames.addCommits(5, 1000);
    const result: BenchResult = {
      scene: 'finale',
      name: 'The Finale',
      what: 'x',
      fromTick: 240,
      toTick: 3240,
      realSeconds: 51,
      frames: frames.summary(),
      heapStart: 40 * 1024 * 1024,
      heapEnd: 41 * 1024 * 1024,
      quality: 'high',
      qualityChanges: 0,
      canvas: { width: 1920, height: 1080 },
      hash: 'abc',
      errors: [],
      timedOut: false,
    };
    const text = benchText(
      { when: 'now', userAgent: 'ua', gpu: 'gpu', screen: '1920x1080', quality: 'high' },
      [result],
    );
    expect(text).toContain(`frame time p95 <= ${BUDGETS.frameP95Ms} ms`);
    expect(text).toContain('draw calls <= 200');
    expect(text).toContain('triangles <= 600,000');
    expect(text).toContain('HUD React commits <= 20 a second');
    expect(text).toContain('The Finale [finale]');
    expect(text).toMatch(/draw calls: p95 210, max 210; budget <= 200: OVER BUDGET/);
    expect(text).toMatch(/frame time .*p95 20\.0 ms.*OVER BUDGET/);
    expect(text).toContain('HUD React commits: 5.0 a second; budget <= 20: within budget');
    expect(text).toContain('40.0 MB at start, 41.0 MB at end');
    expect(text).toContain('sim hash at tick 3240: abc');
    expect(text).not.toMatch(/\t/);
  });
});

describe('the runtime keeps W0’s sites', () => {
  it('the game-speed multiply, the after-switch caption block and the runEnd constants', () => {
    expect(RUNTIME).toContain(
      'const steps = this.stepper.advance(elapsed * this.devTimeScale * gameSpeed());',
    );
    expect(RUNTIME).toContain(
      "import { FIGHT_END_DELAY_MS, WITHOUT_YOU_GRACE_MS } from '../meta/runEnd';",
    );
    expect(RUNTIME).toMatch(
      /if \(useSettings\.getState\(\)\.settings\.captions\) \{\n\s+const c = captionFor\(event, state\);/,
    );
  });

  it('the frame loop hands the view one frame object, filled in place', () => {
    const loop = RUNTIME.slice(
      RUNTIME.indexOf('private frame = '),
      RUNTIME.indexOf('private followQuality'),
    );
    expect(loop).toContain('this.view.sync(state, frame);');
    expect(loop).not.toMatch(/\.push\(|\[\.\.\.this\.perf|this\.stage\.info\(\)/);
  });
});
