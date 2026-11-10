/**
 * The aura presentation pin (docs/phase-7.md, ground rule 5): how every aura and ornament looks
 * and sounds, fixed before Phase 7 changed any source, so that no polish, comfort option or
 * refactor can move it unseen. Shared by `recordPresentationPin.ts` (which wrote
 * `presentationPin.json` once, on the tree before Phase 7's W0 changed any source) and
 * `presentationPin.test.ts` (which computes it again, with default settings and with every comfort
 * option at its strongest, and compares both with the file).
 *
 * The cases: each of the six auras alone on each Chord role (the beam song, Chord I; the field
 * song, Chord II), and each of the four ornaments on each role it may take (Unison: the beam song
 * only), carried by Sostenuto. Each case plays the same scripted sandbox fight (`SCRIPT`): the
 * Thread on Kael, two enemies, the Thread moved to Lyra (the pour), a Pedal Point plant, the Weaver
 * stepping away from the party, a Crescendo, the Thread moved to Vexis; Fermata's cases also stage
 * a hold healed in time and a hold that runs out. 480 ticks, one render frame and one audio frame
 * a tick.
 *
 * What it records, each frame, as a running hash sampled every 60 frames:
 *   - `field`: the FieldView's instance data (every `i*` attribute of its instanced disc batch, the
 *     instance count, its visibility), and every call it makes on the FX kit (rings, beams, sprites,
 *     shells, shadows, particles, with their arguments: colours, radii, alphas, positions);
 *   - `beam`: the beam song as ThreadView draws it: every ribbon strip with a point in an aura's
 *     colour (the song's sheath), every other kit call with an aura's colour (its beads), and every
 *     kit and overlay call made while it pours (`pour`: the head, the splash, the "♪ ×2" label);
 *   - `fermata`: every kit and overlay call FermataView makes (the shell, the ring timer, the glyph,
 *     the heal badge);
 *   - `chips`: the Weaver bar's song chips (`data-testid="chords"`) as rendered markup, every 60
 *     frames, by a hash into `markup`;
 *   - `audio`: through a recording AudioContext, every node the SFX engine's aura sounds create (the
 *     pour, Pedal Point's plant thunk and pedal drone, the beam song's harmony on the Thread's hum,
 *     Fermata's held note and its release, Chorus Pulse) and every parameter write, automation,
 *     property, start, stop and connection on those nodes, wherever it is made; and every write any
 *     of those sounds makes on another node while it plays (the music's duck under a Fermata), by
 *     the node's role on the engine (`engine.bus.music.duck.gain`).
 *
 * Isolation (so that only an aura's own presentation can move it): the views draw into a recording
 * kit, never the real one, so the kit's internals (src/render/fx, W6's) don't enter; the heroes'
 * render records are built from the sim's own positions, so the EntityLayer's motion (W6's) doesn't
 * enter; in ThreadView only the beam song's parts are kept; each view, and the audio's aura sounds,
 * draw from their own seeded `Math.random`, so another view's or sound's use of it doesn't shift
 * theirs; audio nodes are named by their order among the aura sounds' own nodes, so another sound's
 * nodes don't renumber them.
 *
 * Not in it (listed in W0's report): the hero's beam swell, the Fermata freeze and lavender rim and
 * the aura coverage marks drawn by `src/render/entities.ts`; the transient FX `src/render/feedback.ts`
 * spawns on `fieldPlanted`, `chorusPulse`, `fermataHold` and `fermataReleased`; ChordBuilder's
 * cards; the aura glyphs in `src/ui/kit/iconPaths.ts` beyond what the chips render.
 */
import { createElement, type FunctionComponent } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type * as THREE from 'three';
import { SynthDirector } from '../../src/audio/director';
import { SfxEngine } from '../../src/audio/sfx';
import { DEFAULT_SETTINGS, useSettings, type Settings } from '../../src/app/settings';
import { CONTENT } from '../../src/content';
import { FermataView } from '../../src/render/fermata';
import { FieldView } from '../../src/render/field';
import type { FxKit } from '../../src/render/fx/kit';
import { OWN_LOOK } from '../../src/render/keepsakeCues';
import type { Overlay } from '../../src/render/overlay';
import { applyVision, auraColor } from '../../src/render/palette';
import { ThreadView } from '../../src/render/thread';
import {
  createSim,
  type ChordConfig,
  type Command,
  type SimEvent,
  type WorldState,
} from '../../src/sim';
import { SIM_VERSION } from '../../src/sim/constants';
import { buildHudSnapshot } from '../../src/ui/hudBridge';
import type { HudSnapshot } from '../../src/ui/store';

// ── The cases ─────────────────────────────────────────────────────────────────────────

export interface PinCase {
  key: string;
  chords: ChordConfig[];
  fermata: boolean;
}

const ROLES = ['beam', 'field'] as const;

/** The carrier of the ornament cases. */
const CARRIER = 'sostenuto';

function chordsOn(role: 'beam' | 'field', chord: ChordConfig): ChordConfig[] {
  const empty: ChordConfig = { auras: [], ornaments: [] };
  return role === 'beam' ? [chord, empty] : [empty, chord];
}

/** Every aura on each role, then every ornament on each role it may take. */
export function pinCases(): PinCase[] {
  const out: PinCase[] = [];
  for (const a of CONTENT.auras)
    for (const role of ROLES)
      out.push({
        key: `aura:${a.id}:${role}`,
        chords: chordsOn(role, { auras: [a.id], ornaments: [] }),
        fermata: a.effects.holdTime !== undefined && a.effects.holdTime > 0,
      });
  for (const o of CONTENT.ornaments)
    for (const role of ROLES) {
      if (o.roles && !o.roles.includes(role)) continue;
      out.push({
        key: `ornament:${o.id}:${role}`,
        chords: chordsOn(role, { auras: [CARRIER], ornaments: [o.id] }),
        fermata: false,
      });
    }
  return out;
}

export const TICKS = 480;
export const SAMPLE_EVERY = 60;

const debug = (op: Extract<Command, { t: 'debug' }>['op']): Command => ({ t: 'debug', op });

/** The scripted fight: commands by tick. */
function script(fermata: boolean): Map<number, Command[]> {
  const s = new Map<number, Command[]>();
  const at = (tick: number, ...c: Command[]) => s.set(tick, [...(s.get(tick) ?? []), ...c]);
  at(0, { t: 'thread', slot: 0 });
  at(
    1,
    debug({ op: 'spawnEnemy', defId: 'bell_brute', x: -2.5, z: -6 }),
    debug({ op: 'spawnEnemy', defId: 'hollow_chorister', x: 2, z: -5.5 }),
  );
  at(90, { t: 'thread', slot: 1 });
  at(150, { t: 'plant', point: { x: 2.5, z: 1.5 } });
  at(180, debug({ op: 'teleportWeaver', x: 4, z: 4 }));
  if (fermata) {
    at(210, debug({ op: 'forceHold', slot: 2 }));
    at(240, debug({ op: 'healParty' }));
    at(300, debug({ op: 'forceHold', slot: 0 }));
  }
  at(330, debug({ op: 'setResonance', value: 100 }));
  at(332, { t: 'crescendo' });
  at(360, { t: 'thread', slot: 2 });
  return s;
}

// ── Fingerprints ──────────────────────────────────────────────────────────────────────

/** FNV-1a over a string, continuing from `h`. */
function fnvStep(h: number, s: string): number {
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}
const FNV0 = 0x811c9dc5;
const hex = (h: number) => h.toString(16).padStart(8, '0');
export const fnv = (s: string) => hex(fnvStep(FNV0, s));

const num = (v: number) => (Object.is(v, -0) ? 0 : v).toFixed(4);

/** An argument as recorded: numbers to 4 places, colours and vectors by their components. */
function fmtArg(v: unknown, depth = 0): string {
  if (typeof v === 'number') return num(v);
  if (typeof v === 'string') return JSON.stringify(v);
  if (typeof v === 'boolean' || v === null || v === undefined) return String(v);
  if (typeof v === 'function') return 'fn';
  const o = v as Record<string, unknown>;
  if ((o as { isColor?: boolean }).isColor) {
    const c = v as THREE.Color;
    return `c(${num(c.r)},${num(c.g)},${num(c.b)})`;
  }
  if ((o as { isVector3?: boolean }).isVector3) {
    const p = v as THREE.Vector3;
    return `v(${num(p.x)},${num(p.y)},${num(p.z)})`;
  }
  if (Array.isArray(v) || ArrayBuffer.isView(v))
    return `[${Array.from(v as ArrayLike<unknown>, (x) => fmtArg(x, depth + 1)).join(',')}]`;
  if (depth > 2) return 'obj';
  return `{${Object.keys(o)
    .sort()
    .map((k) => `${k}:${fmtArg(o[k], depth + 1)}`)
    .join(',')}}`;
}

/** A deterministic Math.random (mulberry32). */
function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Runs `fn` with `Math.random` replaced by `rnd`. */
function withRandom<T>(rnd: () => number, fn: () => T): T {
  const was = Math.random;
  Math.random = rnd;
  try {
    return fn();
  } finally {
    Math.random = was;
  }
}

/** A running hash of one view's frames, sampled every `SAMPLE_EVERY` frames. */
class Track {
  private h = FNV0;
  private frame: string[] = [];
  readonly samples: string[] = [];
  push(entry: string): void {
    this.frame.push(entry);
  }
  endFrame(n: number): void {
    this.h = fnvStep(this.h, `${n}|${this.frame.join(';')}`);
    this.frame.length = 0;
    if ((n + 1) % SAMPLE_EVERY === 0) this.samples.push(hex(this.h));
  }
}

// ── Render: a recording kit and overlay ───────────────────────────────────────────────

type Sink = 'field' | 'beam' | 'fermata' | null;

class RenderRecorder {
  readonly field = new Track();
  readonly beam = new Track();
  readonly fermata = new Track();
  /** Which view is drawing. */
  view: Sink = null;
  /** ThreadView is pouring (every call kept). */
  pouring = 0;
  private strip: string[] | null = null;
  private stripAura = false;
  private readonly auraColors = new Set<unknown>(CONTENT.auras.map((a) => auraColor(a.id)));

  private track(s: Sink): Track | null {
    return s === 'field'
      ? this.field
      : s === 'beam'
        ? this.beam
        : s === 'fermata'
          ? this.fermata
          : null;
  }

  call(path: string, args: unknown[]): void {
    const entry = `${path}(${args.map((a) => fmtArg(a)).join(',')})`;
    if (this.view === 'field' || this.view === 'fermata') {
      this.track(this.view)!.push(entry);
      return;
    }
    if (this.view !== 'beam') return;
    if (this.pouring > 0) {
      this.beam.push(entry);
      return;
    }
    // Outside the pour, ThreadView draws the whole Thread: keep only the beam song's parts.
    if (path === 'ribbons.beginStrip') {
      this.strip = [entry];
      this.stripAura = false;
      return;
    }
    if (this.strip && path === 'ribbons.point') {
      this.strip.push(entry);
      if (args.some((a) => this.auraColors.has(a))) this.stripAura = true;
      return;
    }
    if (this.strip && path === 'ribbons.endStrip') {
      this.strip.push(entry);
      if (this.stripAura) for (const e of this.strip) this.beam.push(e);
      this.strip = null;
      return;
    }
    if (args.some((a) => this.auraColors.has(a))) this.beam.push(entry);
  }

  /** A kit whose every batch records its calls (and draws nothing). */
  kit(): FxKit {
    const batch = (name: string) =>
      new Proxy(
        {},
        {
          get: (_t, key) => {
            if (typeof key !== 'string') return undefined;
            if (key === 'density') return 1;
            return (...args: unknown[]) => this.call(`${name}.${key}`, args);
          },
        },
      );
    const batches = new Map<string, unknown>();
    return new Proxy({} as FxKit, {
      get: (_t, key) => {
        if (typeof key !== 'string') return undefined;
        let b = batches.get(key);
        if (!b) batches.set(key, (b = batch(key)));
        return b;
      },
    });
  }

  /** An overlay that records its calls (FermataView's bubble, the pour's label). */
  overlay(): Overlay {
    return new Proxy({} as Overlay, {
      get: (_t, key) => {
        if (typeof key !== 'string') return undefined;
        return (...args: unknown[]) => this.call(`overlay.${key}`, args);
      },
    });
  }
}

/** A render record per entity, from the sim's own positions (no EntityLayer motion). */
function recsOf(state: WorldState, recs: Map<number, Record<string, unknown>>): void {
  recs.clear();
  for (const e of state.entities.list())
    recs.set(e.id, {
      id: e.id,
      kind: e.kind,
      x: e.x,
      z: e.z,
      y: 0,
      yaw: Math.atan2(-e.fx, -e.fz),
      radius: e.radius,
      height: e.height,
    });
}

/** Methods of a prototype wrapped for the length of `fn`. */
function wrapping<T>(
  proto: object,
  names: readonly string[],
  around: (name: string, call: () => unknown) => unknown,
  fn: () => T,
): T {
  const p = proto as Record<string, unknown>;
  const saved = new Map<string, unknown>();
  for (const name of names) {
    const orig = p[name];
    if (typeof orig !== 'function')
      throw new Error(
        `the aura pin wraps ${name}, which is gone: see tests/aura/presentationPinFixture.ts`,
      );
    saved.set(name, orig);
    p[name] = function (this: unknown, ...args: unknown[]) {
      return around(name, () => (orig as (...a: unknown[]) => unknown).apply(this, args));
    };
  }
  try {
    return fn();
  } finally {
    for (const [name, orig] of saved) p[name] = orig;
  }
}

/** ThreadView's beam-song methods (src/render/thread.ts). */
export const THREAD_SONG_METHODS = ['pour', 'startPour', 'findSong'] as const;

// ── Audio: a recording AudioContext that keeps the aura sounds' work ──────────────────

/** The SFX engine's aura sounds (src/audio/sfx.ts). */
export const SFX_AURA_METHODS = [
  'pour',
  'fieldPlanted',
  'chorusPulse',
  'fermataHold',
  'fermataReleased',
  'ensureHarmony',
  'ensureDrone',
  'stopDrone',
] as const;

type Fake = Record<string, unknown>;

interface Source {
  node: Fake;
  stops: number[];
  ended: boolean;
}

class AuraAudio {
  /** Inside an aura sound (depth > 0): every node made is the aura's, every write is kept. */
  depth = 0;
  private n = 0;
  private readonly aura = new WeakMap<object, string>();
  private readonly kinds = new WeakMap<object, string>();
  private readonly roles = new WeakMap<object, string>();
  private readonly params = new WeakMap<object, [object, string]>();
  private readonly log = new Map<string, string[]>();
  readonly calls: string[] = [];
  readonly counts: Record<string, number> = {};
  nodes = 0;
  writes = 0;

  nameOf(o: object): string {
    const p = this.params.get(o);
    if (p) return `${this.nameOf(p[0])}.${p[1]}`;
    return this.aura.get(o) ?? this.roles.get(o) ?? `ext:${this.kinds.get(o) ?? 'obj'}`;
  }

  /** Names the engine's own nodes by their place on it (`engine.bus.sfx.input`). */
  nameEngine(engine: object): void {
    const walk = (o: Record<string, unknown>, path: string, depth: number) => {
      for (const [k, v] of Object.entries(o)) {
        if (!v || typeof v !== 'object') continue;
        if (this.kinds.has(v) || this.params.has(v)) {
          if (!this.roles.has(v)) this.roles.set(v, `${path}.${k}`);
        } else if (depth < 2 && !Array.isArray(v))
          walk(v as Record<string, unknown>, `${path}.${k}`, depth + 1);
      }
    };
    walk(engine as Record<string, unknown>, 'engine', 0);
  }

  private fmt(v: unknown): string {
    if (typeof v === 'number')
      return Number.isFinite(v) ? String(Number(v.toPrecision(7))) : String(v);
    if (typeof v === 'string' || typeof v === 'boolean') return String(v);
    if (v === undefined) return 'u';
    if (v === null) return 'null';
    if (typeof v === 'function') return 'fn';
    if (typeof v === 'object' && (this.kinds.has(v) || this.params.has(v))) return this.nameOf(v);
    if (ArrayBuffer.isView(v)) {
      const a = v as unknown as ArrayLike<number>;
      return `arr${a.length}:${fnv(Array.from(a, (x) => x.toPrecision(6)).join(','))}`;
    }
    return 'obj';
  }

  private keep(owner: object): boolean {
    return this.depth > 0 || this.aura.has(owner);
  }

  private push(key: string, event: string): void {
    this.writes++;
    let l = this.log.get(key);
    if (!l) this.log.set(key, (l = []));
    l.push(event);
  }

  enter(name: string, now: number): void {
    this.calls.push(`${name}@${this.fmt(now)}`);
    this.counts[name] = (this.counts[name] ?? 0) + 1;
  }

  node(kind: string, source?: Source[]): Fake {
    const params = new Map<string, Fake>();
    const base: Fake = {};
    const node = new Proxy(base, {
      get: (target, key) => {
        if (typeof key !== 'string') return undefined;
        if (key in target) return target[key];
        switch (key) {
          case 'connect':
            return (to: unknown, ...io: unknown[]) => {
              if (this.keep(node))
                this.push(`${this.nameOf(node)}>`, [to, ...io].map((a) => this.fmt(a)).join(','));
              return to;
            };
          case 'disconnect':
            return (...to: unknown[]) => {
              if (this.keep(node))
                this.push(`${this.nameOf(node)}>`, `x${to.map((a) => this.fmt(a)).join(',')}`);
            };
          case 'start':
          case 'stop':
            return (t = 0) => {
              if (key === 'stop') rec?.stops.push(t);
              if (this.keep(node)) this.push(`${this.nameOf(node)}:${key}`, this.fmt(t));
            };
          default: {
            let p = params.get(key);
            if (!p) params.set(key, (p = this.param(node, key)));
            return p;
          }
        }
      },
      set: (target, key, v) => {
        if (typeof key !== 'string') return false;
        target[key] = v;
        if (this.keep(node)) this.push(`${this.nameOf(node)}:${key}`, this.fmt(v));
        return true;
      },
    });
    this.kinds.set(node, kind);
    if (this.depth > 0) {
      this.aura.set(node, `a${String(this.n++).padStart(5, '0')}${kind}`);
      this.nodes++;
    }
    const rec: Source | undefined = source ? { node, stops: [], ended: false } : undefined;
    if (rec) source!.push(rec);
    return node;
  }

  private param(owner: object, key: string): Fake {
    let value = 0;
    const at = (op: string, ...args: unknown[]) => {
      if (this.keep(owner))
        this.push(
          `${this.nameOf(owner)}.${key}`,
          `${op}(${args.map((a) => this.fmt(a)).join(',')})`,
        );
    };
    const p: Fake = {
      get value() {
        return value;
      },
      set value(v: number) {
        value = v;
        at('=', v);
      },
      setValueAtTime: (v: number, t: number) => at('set', v, t),
      linearRampToValueAtTime: (v: number, t: number) => at('lin', v, t),
      exponentialRampToValueAtTime: (v: number, t: number) => at('exp', v, t),
      setTargetAtTime: (v: number, t: number, tc: number) => at('tgt', v, t, tc),
      setValueCurveAtTime: (c: unknown, t: number, d: number) => at('curve', c, t, d),
      cancelScheduledValues: (t: number) => at('cancel', t),
      cancelAndHoldAtTime: (t: number) => at('hold', t),
    };
    this.params.set(p, [owner, key]);
    return p;
  }

  digest(): string {
    const lines = [...this.log.keys()].sort().map((k) => `${k}=${this.log.get(k)!.join(';')}`);
    return fnv(`${this.calls.join(',')}#${lines.join('|')}`);
  }
}

class RecordingContext {
  currentTime = 1;
  sampleRate = 8000;
  state = 'running';
  readonly sources: Source[] = [];
  destination: Fake;
  [k: string]: unknown;
  constructor(readonly rec: AuraAudio) {
    this.destination = rec.node('dest');
    for (const [name, kind] of [
      ['createDynamicsCompressor', 'comp'],
      ['createWaveShaper', 'shaper'],
      ['createConvolver', 'conv'],
      ['createBiquadFilter', 'filter'],
      ['createStereoPanner', 'pan'],
      ['createGain', 'gain'],
    ] as const)
      this[name] = () => rec.node(kind);
    this['createOscillator'] = () => rec.node('osc', this.sources);
    this['createBufferSource'] = () => rec.node('noise', this.sources);
    this['createBuffer'] = (_ch: number, length: number, sr: number) => ({
      length,
      sampleRate: sr,
      duration: length / sr,
      getChannelData: () => new Float32Array(length),
    });
  }
  /** Fires `onended` on every source stopped by now (the engine's voice clean-up). */
  endDue(): void {
    for (const s of this.sources) {
      const stop = s.stops[s.stops.length - 1] ?? Infinity;
      if (s.ended || stop > this.currentTime) continue;
      s.ended = true;
      const cb = s.node['onended'];
      if (typeof cb === 'function') (cb as () => void)();
    }
  }
}

// ── One case ──────────────────────────────────────────────────────────────────────────

export interface CasePin {
  /** Hashes every 60 frames (8 a case). */
  field: string[];
  beam: string[];
  fermata: string[];
  /** The song chips' markup every 60 frames, by its hash in `markup`. */
  chips: string[];
  audio: {
    /** How many times each aura sound was called. */
    calls: Record<string, number>;
    /** Nodes the aura sounds made, and writes kept. */
    nodes: number;
    writes: number;
    hash: string;
  };
}

export interface PresentationPin {
  simVersion: number;
  /** The field batch's shaders (FieldView), hashed. */
  fieldShader: string;
  cases: Record<string, CasePin>;
  markup: Record<string, string>;
}

/** The song chips out of the Weaver bar's markup. */
export function chipsOf(html: string): string {
  const at = html.indexOf('data-testid="chords"');
  if (at < 0) {
    const none = html.indexOf('>No auras sung<');
    if (none < 0) throw new Error('no song chips in the Weaver bar');
    const start = html.lastIndexOf('<span', none);
    return html.slice(start, html.indexOf('</span>', none) + 7);
  }
  const start = html.lastIndexOf('<div', at);
  let depth = 0;
  const re = /<div\b|<\/div>/g;
  re.lastIndex = start;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    depth += m[0] === '</div>' ? -1 : 1;
    if (depth === 0) return html.slice(start, m.index + 6);
  }
  throw new Error('unbalanced song chips');
}

type WeaverBarView = FunctionComponent<{ hud: HudSnapshot }>;

/** The Weaver bar, loaded at run time (tsconfig.node.json compiles no JSX, as tests/uiFill does). */
async function weaverBar(): Promise<WeaverBarView> {
  const path = '../../src/ui/hud/WeaverBar';
  const mod = (await import(/* @vite-ignore */ path)) as Record<string, WeaverBarView>;
  return mod['WeaverBar']!;
}

function playCase(c: PinCase, markup: Record<string, string>, WeaverBar: WeaverBarView): CasePin {
  const sim = createSim({ seed: 7, encounter: 'sandbox', debug: true, chords: c.chords });
  const commands = script(c.fermata);
  const rr = new RenderRecorder();
  const kit = rr.kit();
  const overlay = rr.overlay();
  const recs = new Map<number, Record<string, unknown>>();
  const layer = { recs } as never;
  const field = new FieldView(layer);
  const thread = new ThreadView(layer, overlay);
  thread.setLook(OWN_LOOK.thread);
  const fermata = new FermataView(layer);
  const fieldRandom = seededRandom(11);
  const beamRandom = seededRandom(13);
  const fermataRandom = seededRandom(17);
  const pourRandom = seededRandom(19);
  const auraRandom = seededRandom(23);

  const audio = new AuraAudio();
  const ctx = new RecordingContext(audio);
  const d = new SynthDirector({
    context: ctx as unknown as BaseAudioContext,
    autoPump: false,
    installUnlock: false,
    followSettings: false,
  });
  audio.nameEngine((d as unknown as { engine: object }).engine);
  d.setMood('combat');
  d.pump();

  const chips: string[] = [];
  const flashes = useSettings.getState().settings.flashes;
  const sync = (view: Sink, rnd: () => number, fn: () => void) => {
    rr.view = view;
    try {
      withRandom(rnd, fn);
    } finally {
      rr.view = null;
    }
  };
  const drive = () => {
    for (let tick = 0; tick < TICKS; tick++) {
      sim.step(commands.get(tick) ?? []);
      const state = sim.state;
      const events: SimEvent[] = sim.drainEvents();
      recsOf(state, recs);
      // The views' share of feedback.ts's dispatch.
      for (const ev of events) {
        if (ev.type === 'fieldPlanted') field.planted(ev.chord);
        else if (ev.type === 'crescendoStart') field.crescendoBlaze();
        else if (ev.type === 'fermataHold') fermata.onHold(ev, state);
        else if (ev.type === 'fermataReleased') fermata.onReleased(ev);
      }
      // One frame, as CombatView draws it (the Flashes value passed where the views take one).
      const time = tick / 60;
      const dt = (1 / 60) * (0.3 + 0.7 * Math.min(1, state.timeScale));
      const call = (o: object, name: string, ...args: unknown[]) =>
        (o as Record<string, (...a: unknown[]) => void>)[name]!(...args);
      sync('field', fieldRandom, () => call(field, 'sync', state, kit, dt, time, flashes));
      sync('beam', beamRandom, () => call(thread, 'sync', state, kit, dt, time, flashes));
      sync('fermata', fermataRandom, () =>
        call(fermata, 'sync', state, kit, overlay, dt, time, flashes),
      );
      const inst = field.mesh.geometry as THREE.InstancedBufferGeometry;
      const count = inst.instanceCount;
      const parts = [`n${count}`, `vis${field.mesh.visible}`];
      for (const name of ['iPos', 'iC0', 'iC1', 'iState', 'iExtra', 'iRole', 'iC2', 'iLum']) {
        const a = inst.getAttribute(name) as THREE.InstancedBufferAttribute;
        parts.push(
          `${name}:${Array.from((a.array as Float32Array).subarray(0, count * 4), num).join(',')}`,
        );
      }
      rr.field.push(parts.join('|'));
      rr.field.endFrame(tick);
      rr.beam.endFrame(tick);
      rr.fermata.endFrame(tick);

      ctx.currentTime += 1 / 60;
      ctx.endDue();
      if (events.length) d.onEvents(events, state);
      d.update(state, 1 / 60);

      if ((tick + 1) % SAMPLE_EVERY === 0) {
        const hud = buildHudSnapshot(state, { seed: 7, hovered: null });
        const html = chipsOf(renderToStaticMarkup(createElement(WeaverBar, { hud })));
        const h = fnv(html);
        markup[h] = html;
        chips.push(h);
      }
    }
  };
  wrapping(
    ThreadView.prototype,
    ['pour'],
    (_name, call) => {
      rr.pouring++;
      try {
        return withRandom(pourRandom, call);
      } finally {
        rr.pouring--;
      }
    },
    () =>
      wrapping(
        SfxEngine.prototype,
        SFX_AURA_METHODS,
        (name, call) => {
          audio.enter(name, ctx.currentTime);
          audio.depth++;
          try {
            return withRandom(auraRandom, call);
          } finally {
            audio.depth--;
          }
        },
        // Everything else draws from its own seeded stream.
        () => withRandom(seededRandom(7), drive),
      ),
  );
  const out: CasePin = {
    field: rr.field.samples,
    beam: rr.beam.samples,
    fermata: rr.fermata.samples,
    chips,
    audio: { calls: audio.counts, nodes: audio.nodes, writes: audio.writes, hash: audio.digest() },
  };
  d.dispose();
  field.dispose();
  return out;
}

/** Every case, with `settings` in the settings store (and Flashes passed to the views). */
export async function computePin(settings: Settings = DEFAULT_SETTINGS): Promise<PresentationPin> {
  const WeaverBar = await weaverBar();
  const before = useSettings.getState().settings;
  useSettings.setState({ settings });
  applyVision(settings.colorVision);
  try {
    // ThreadView's song methods must still be there to be pinned.
    for (const m of THREAD_SONG_METHODS)
      if (typeof (ThreadView.prototype as unknown as Record<string, unknown>)[m] !== 'function')
        throw new Error(`ThreadView.${m} is gone: the aura pin reads the beam song through it`);
    const field = new FieldView({ recs: new Map() } as never);
    const mat = field.mesh.material as THREE.ShaderMaterial;
    const fieldShader = fnv(mat.vertexShader + mat.fragmentShader);
    field.dispose();
    const markup: Record<string, string> = {};
    const cases: Record<string, CasePin> = {};
    for (const c of pinCases()) cases[c.key] = playCase(c, markup, WeaverBar);
    const sorted: Record<string, string> = {};
    for (const k of Object.keys(markup).sort()) sorted[k] = markup[k]!;
    return { simVersion: SIM_VERSION, fieldShader, cases, markup: sorted };
  } finally {
    useSettings.setState({ settings: before });
    applyVision(before.colorVision);
  }
}

/** The file's text: stable key order, one case per block. */
export function serializePin(pin: PresentationPin): string {
  return `${JSON.stringify(pin, null, 2)}\n`;
}
