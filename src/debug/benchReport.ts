/**
 * The bench page's read-out (docs/phase-7.md, W4) as plain text, so the owner can copy it from
 * any laptop and paste it anywhere. Pure: `tests/perfPhase7.test.ts` reads it.
 */
import type { FrameSummary } from './frameStats';

/** 05 §12's budgets, as the read-out checks them. */
export const BUDGETS = {
  frameP95Ms: 16.7,
  drawCalls: 200,
  triangles: 600_000,
  commitsPerSec: 20,
} as const;

export interface BenchResult {
  scene: string;
  name: string;
  what: string;
  /** The ticks measured: from the warm-up's end to the halt. */
  fromTick: number;
  toTick: number;
  /** Real seconds the measuring took. */
  realSeconds: number;
  frames: FrameSummary;
  /** `performance.memory.usedJSHeapSize` at the measuring's start and end (Chromium only). */
  heapStart: number | null;
  heapEnd: number | null;
  /** The quality at the end ("high", or "auto · medium · 80%"), and auto's changes. */
  quality: string;
  qualityChanges: number;
  canvas: { width: number; height: number };
  hash: string;
  /** Errors seen while it ran (the page's own console stays the place for detail). */
  errors: string[];
  /** It didn't reach its last tick in time. */
  timedOut: boolean;
}

export interface BenchEnvironment {
  when: string;
  userAgent: string;
  gpu: string;
  screen: string;
  quality: string;
}

const MB = 1024 * 1024;

function ms(v: number): string {
  return `${v.toFixed(1)} ms`;
}

function count(v: number): string {
  return Math.round(v).toLocaleString('en-US');
}

function mark(ok: boolean): string {
  return ok ? 'within budget' : 'OVER BUDGET';
}

/** One scene's lines. */
export function sceneLines(r: BenchResult): string[] {
  const f = r.frames;
  const seconds = (r.toTick - r.fromTick) / 60;
  const heap =
    r.heapStart !== null && r.heapEnd !== null
      ? `${(r.heapStart / MB).toFixed(1)} MB at start, ${(r.heapEnd / MB).toFixed(1)} MB at end`
      : 'not exposed by this browser';
  return [
    `${r.name} [${r.scene}]: ${r.what}`,
    `  measured ticks ${r.fromTick}-${r.toTick} (${seconds.toFixed(1)} s of game time) in ${r.realSeconds.toFixed(1)} s real, ${count(f.frames)} frames${r.timedOut ? ' (TIMED OUT before its last tick)' : ''}`,
    `  frame time (real time between frames, GPU included): p50 ${ms(f.frameP50)}, p95 ${ms(f.frameP95)}, ${f.fps.toFixed(1)} fps; budget p95 <= ${BUDGETS.frameP95Ms} ms: ${mark(f.frameP95 <= BUDGETS.frameP95Ms)}`,
    `  CPU per frame (main thread: sim, render submission, audio, HUD bridge): p50 ${ms(f.cpuP50)}, p95 ${ms(f.cpuP95)}, max ${ms(f.cpuMax)}`,
    `  draw calls: p95 ${count(f.drawCallsP95)}, max ${count(f.drawCallsMax)}; budget <= ${BUDGETS.drawCalls}: ${mark(f.drawCallsMax <= BUDGETS.drawCalls)}`,
    `  triangles: p95 ${count(f.trianglesP95)}, max ${count(f.trianglesMax)}; budget <= ${count(BUDGETS.triangles)}: ${mark(f.trianglesMax <= BUDGETS.triangles)}`,
    `  entities: up to ${f.entitiesMax}`,
    `  HUD React commits: ${f.commitsPerSec.toFixed(1)} a second; budget <= ${BUDGETS.commitsPerSec}: ${mark(f.commitsPerSec <= BUDGETS.commitsPerSec)}`,
    `  JS heap: ${heap}`,
    `  quality at the end: ${r.quality} (auto's changes: ${r.qualityChanges}); canvas ${r.canvas.width}x${r.canvas.height} device pixels`,
    `  sim hash at tick ${r.toTick}: ${r.hash}`,
    ...(r.errors.length > 0 ? [`  errors: ${r.errors.join(' | ')}`] : []),
  ];
}

/** The whole read-out: what was run where, the scenes, and how to read them. */
export function benchText(env: BenchEnvironment, results: readonly BenchResult[]): string {
  return [
    'Aetherweaver bench',
    `When: ${env.when}`,
    `Browser: ${env.userAgent}`,
    `GPU: ${env.gpu}`,
    `Screen: ${env.screen}`,
    `Quality asked for: ${env.quality}`,
    `Budgets (docs/plan/05 §12, at 1080p): frame time p95 <= ${BUDGETS.frameP95Ms} ms; draw calls <= ${BUDGETS.drawCalls}; triangles <= ${count(BUDGETS.triangles)}; HUD React commits <= ${BUDGETS.commitsPerSec} a second.`,
    '',
    ...results.flatMap((r) => [...sceneLines(r), '']),
    'How to read it: "frame time" is what you see (on a 60 Hz screen it cannot go below 16.7 ms).',
    '"CPU per frame" is the main thread only; the GPU works beside it. Draw calls, triangles and',
    'commits do not depend on the machine. The sim hash is the same on every machine for the same',
    'scene: if it differs, the scene did not play as designed. Timings vary from run to run.',
  ].join('\n');
}
