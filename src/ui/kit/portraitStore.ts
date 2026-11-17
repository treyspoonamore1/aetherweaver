import { useEffect, useSyncExternalStore } from 'react';
import type { ColorVision } from '../../app/colorVision';
import { OWN_LOOK, restRim, weaverPalette, type WeaverLook } from '../../render/keepsakeCues';
import type { PortraitStudio, PortraitSubject } from '../../render/portrait';

/**
 * The portraits' cache (docs/phase-8.md, 8d): each figure is drawn once, when a screen first wants
 * it, and kept as a small picture. The drawing itself (`render/portrait.ts`, and three.js with it)
 * is loaded only then, so the Codex stays as light to open as it was.
 *
 * - One studio at a time, opened for the pictures wanted and closed when they are drawn: no WebGL
 *   context is held while nothing is being drawn.
 * - Never beside a fight: while a fight's canvas is on screen nothing is drawn (`fightOnScreen`),
 *   and a screen that asks then gets what it showed before portraits.
 * - Where WebGL is not to be had (the unit tests, a refused or lost context) every portrait is
 *   `none` and the screens show what they showed before.
 * - The work is spread: a few milliseconds of drawing, then the browser gets its turn. What is on
 *   screen is drawn first; what a screen may show next (`requestPortraits`) after it, and that
 *   part is dropped when the screen closes (`cancelPortraits`).
 */

/** The pictures' side in device pixels (shown at up to 128 CSS px on a 2× screen). */
export const PORTRAIT_PX = 256;
/** How long one turn of drawing may run before the browser gets its turn (ms). */
const SLICE_MS = 8;
/** How many pictures of the Weaver are kept (one a robe and Thread look she has been seen in). */
const WEAVERS_KEPT = 16;

/** A portrait's state for a screen: its picture, still being drawn, or not to be had. */
export type PortraitState = { src: string } | 'pending' | 'none';

interface Wanted {
  key: string;
  subject: PortraitSubject;
}

const images = new Map<string, { src: string }>();
/** On screen now, by key: the subject and how many frames show it (drawn first, in order). */
const shown = new Map<string, { subject: PortraitSubject; count: number }>();
/** What a screen may show next, in the order asked. */
const later: Wanted[] = [];
const listeners = new Set<() => void>();
let failed = false;
let blocked = false;
let running = false;
const stats = {
  drawn: 0,
  bytes: 0,
  ms: 0,
  sessions: 0,
  calls: 0,
  triangles: 0,
  loadMs: 0,
  prepareMs: 0,
  firstMs: 0,
};

function notify(): void {
  for (const l of [...listeners]) l();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Whether this environment can draw at all (false in the unit tests: no document, no WebGL). */
export function portraitsPossible(): boolean {
  return (
    !failed &&
    typeof document !== 'undefined' &&
    typeof (globalThis as { WebGL2RenderingContext?: unknown }).WebGL2RenderingContext !==
      'undefined'
  );
}

/** A fight's canvas is in the page (stage.ts marks it): nothing is drawn beside it. */
function fightOnScreen(): boolean {
  return document.querySelector('canvas[data-testid="game-canvas"]') !== null;
}

/** The Weaver as she is dressed: her robe and Thread look, in the colour vision's fit. */
export function weaverSubject(
  look: Readonly<WeaverLook> = OWN_LOOK,
  vision: ColorVision = 'normal',
): PortraitSubject {
  return {
    kind: 'weaver',
    id: 'weaver',
    palette: weaverPalette(look, vision),
    rim: restRim(look.robe),
  };
}

/** What a picture depends on, and nothing else: a figure's id; the Weaver's colours and rim. */
export function portraitKey(subject: PortraitSubject): string {
  if (subject.kind !== 'weaver') return `${subject.kind}|${subject.id}`;
  const p = subject.palette;
  const r = subject.rim;
  return [
    'weaver',
    p ? [p.body, p.head, p.trim, p.halo, p.hand].join(',') : 'own',
    r ? `${r.hex},${r.strength}` : 'own',
  ].join('|');
}

function snapshot(key: string): PortraitState {
  const held = images.get(key);
  if (held) return held;
  return failed || blocked || !portraitsPossible() ? 'none' : 'pending';
}

/** A portrait's state now (tests; a screen reads it through `usePortrait`). */
export function portraitState(subject: PortraitSubject): PortraitState {
  return snapshot(portraitKey(subject));
}

/** The next picture to draw: what is on screen first, then what was asked for later. */
function next(): Wanted | null {
  for (const [key, want] of shown) if (!images.has(key)) return { key, subject: want.subject };
  // (Left in the list until its picture is held: asking twice gives the same answer.)
  while (later.length > 0 && images.has(later[0]!.key)) later.shift();
  return later[0] ?? null;
}

/** Whether a fight is on screen: if so nothing is drawn, and what was asked for is let go. */
function standDown(): boolean {
  if (!fightOnScreen()) {
    if (blocked) {
      blocked = false;
      notify();
    }
    return false;
  }
  later.length = 0;
  if (!blocked) {
    blocked = true;
    notify();
  }
  return true;
}

/**
 * Asks for pictures a screen may show next (the Codex's other pages), drawn in the order asked
 * once what is on screen is drawn. Asking for a picture already held costs nothing.
 */
export function requestPortraits(subjects: readonly PortraitSubject[]): void {
  if (!portraitsPossible() || standDown()) return;
  for (const subject of subjects) {
    const key = portraitKey(subject);
    if (!images.has(key) && !later.some((q) => q.key === key)) later.push({ key, subject });
  }
  void run();
}

/** Drops what was asked for later use and is not drawn yet (the screen that asked has closed). */
export function cancelPortraits(): void {
  later.length = 0;
}

/**
 * A frame on screen wants `subject` (drawn before anything asked for later). Returns its release:
 * a frame gone before its picture is drawn no longer asks for it.
 */
export function showPortrait(subject: PortraitSubject): () => void {
  const key = portraitKey(subject);
  const held = shown.get(key);
  if (held) held.count++;
  else shown.set(key, { subject, count: 1 });
  if (portraitsPossible() && !standDown()) void run();
  return () => {
    const mine = shown.get(key);
    if (mine && --mine.count <= 0) shown.delete(key);
  };
}

const now = (): number => (typeof performance === 'undefined' ? Date.now() : performance.now());
/** The browser's turn: a frame painted where there are frames (none while the page is hidden). */
const breathe = (): Promise<void> =>
  new Promise((resolve) => {
    if (typeof requestAnimationFrame === 'function' && document.visibilityState !== 'hidden')
      requestAnimationFrame(() => setTimeout(resolve, 0));
    else setTimeout(resolve, 0);
  });

async function run(): Promise<void> {
  if (running) return;
  running = true;
  let studio: PortraitStudio | null = null;
  const started = now();
  let drawnHere = 0;
  try {
    const mod = await import('../../render/portrait');
    stats.loadMs = now() - started;
    // The page that asked is painted first: the first picture may hold the browser a moment
    // (the figures' shader, where it cannot be compiled in the background).
    await breathe();
    let want = standDown() ? null : next();
    if (!want) return;
    studio = mod.openPortraitStudio(PORTRAIT_PX);
    if (!studio) {
      failed = true;
      return;
    }
    stats.sessions++;
    const preparing = now();
    await studio.prepare(want.subject);
    stats.prepareMs = now() - preparing;
    want = standDown() ? null : next();
    while (want) {
      const sliceStart = now();
      while (want) {
        const src = studio.draw(want.subject);
        if (drawnHere === 0) stats.firstMs = now() - sliceStart;
        if (src === null) {
          // The context was lost: keep what is drawn, show the rest as before portraits.
          failed = true;
          break;
        }
        keep(want.key, src);
        drawnHere++;
        stats.calls = studio.lastCalls;
        stats.triangles = studio.lastTriangles;
        if (now() - sliceStart >= SLICE_MS) break;
        // Before every picture: nothing is drawn once a fight's canvas is on screen.
        want = standDown() ? null : next();
      }
      stats.ms += now() - sliceStart;
      notify();
      if (failed) break;
      await breathe();
      want = standDown() ? null : next();
    }
  } catch {
    failed = true;
  } finally {
    studio?.dispose();
    if (failed) later.length = 0;
    running = false;
    if (drawnHere > 0) mark(started, drawnHere);
    notify();
  }
}

/** Holds a picture. The Weaver's are bounded: the oldest robes she was drawn in are let go. */
function keep(key: string, src: string): void {
  images.set(key, { src });
  stats.bytes += src.length;
  stats.drawn++;
  if (!key.startsWith('weaver|')) return;
  const weavers = [...images.keys()].filter((k) => k.startsWith('weaver|') && !shown.has(k));
  const over = [...images.keys()].filter((k) => k.startsWith('weaver|')).length - WEAVERS_KEPT;
  for (const old of weavers.slice(0, Math.max(0, over))) {
    stats.bytes -= images.get(old)!.src.length;
    images.delete(old);
  }
}

/** A measure on the browser's timeline, for the measurements (docs/phase-8.md, 8d). */
function mark(started: number, drawn: number): void {
  try {
    performance.measure('aw-portraits', {
      start: started,
      end: now(),
      detail: { session: drawn, ...portraitStats() },
    });
  } catch {
    // No timeline: no measure.
  }
}

/**
 * The measurements: pictures drawn and held, their size as held (characters of PNG data URL, one
 * byte each), the time spent drawing (ms, building each model included), studios opened, the
 * time the drawing code took to load (ms), the last studio's wait for its shader and its first
 * picture (ms), and the last picture's draw calls and triangles.
 */
export function portraitStats(): Readonly<typeof stats> & { held: number; open: boolean } {
  return { ...stats, held: images.size, open: running };
}

/** A portrait for a frame on screen: asked for when the frame shows, put in place when drawn. */
export function usePortrait(subject: PortraitSubject): PortraitState {
  const key = portraitKey(subject);
  // The same reading for a page rendered to text (the unit tests: no WebGL there, so `none`).
  const read = (): PortraitState => snapshot(key);
  const state = useSyncExternalStore(subscribe, read, read);
  // The key is all a picture depends on: a new object for the same figure asks for nothing new.
  useEffect(() => showPortrait(subject), [subject, key]);
  return state;
}

/** Tests: forget every picture and failure. */
export function resetPortraits(): void {
  images.clear();
  shown.clear();
  later.length = 0;
  failed = false;
  blocked = false;
  stats.drawn = stats.bytes = stats.ms = stats.sessions = stats.calls = stats.triangles = 0;
  stats.loadMs = stats.prepareMs = stats.firstMs = 0;
  notify();
}
