/**
 * Phase 4f audio: the Weaver's technique variants (docs/phase-4f.md, docs/phase-4f/vfx-audio.md). A
 * cast sound for every variant the sim casts, in the Weaver's voice (on the music's chord, as her
 * techniques are) and unlike its default; the moments that follow (several Chorale barriers
 * Perfect at once, a Link's Perfect, a hit shared along it, Purge's burst, Absolve's guard); the
 * `variantPick` UI sound. Each plays on its bus, in its own group, within its gate and cap; the lab
 * has a button for each.
 */
import { describe, expect, it } from 'vitest';
import { getAudio } from '../src/audio';
import { SynthDirector } from '../src/audio/director';
import { FakeWorld, IDS } from '../src/audio/lab/labState';
import { SOUNDS } from '../src/audio/lab/soundBoard';
import {
  VARIANT_MOMENT_GROUPS,
  VARIANT_SOUND_GROUPS,
  VARIANT_SOUND_LIMITS,
} from '../src/audio/sfx';
import { CHORDS, isInScale, type Chord } from '../src/audio/theory';
import type { UiSound, UiSoundDetail } from '../src/audio/types';
import { UI_SOUND_NAMES, VARIANT_LIMITS } from '../src/audio/ui';
import { CONTENT } from '../src/content';
import { createSim, type Command, type SimEvent, type WorldState } from '../src/sim';
import { KNOWN_VARIANTS } from '../src/sim/variants';

const ev = (type: SimEvent['type'], rest: Record<string, unknown>): SimEvent =>
  ({ type, tick: 0, ...rest }) as unknown as SimEvent;
const vv = (id: string, key: string) =>
  CONTENT.techniqueVariants.find((v) => v.id === id)?.values[key] ?? Number.NaN;
const slotOf = (id: string) => CONTENT.techniqueVariants.find((v) => v.id === id)!.slot;

// ── A recording fake AudioContext (as tests/audioPhase4e.test.ts) ─────────────────────

type Fake = Record<string, unknown>;

interface Source {
  kind: 'osc' | 'noise';
  freqs: number[];
  starts: number[];
  stops: number[];
}

const stopOf = (s: Source) => s.stops[s.stops.length - 1] ?? Infinity;
const startOf = (s: Source) => s.starts[0] ?? -Infinity;

function param(record?: (v: number) => void, ramps = false): Fake {
  return {
    value: 0,
    setValueAtTime: (v: number) => {
      record?.(v);
    },
    linearRampToValueAtTime: (v: number) => {
      if (ramps) record?.(v);
    },
    exponentialRampToValueAtTime: (v: number) => {
      if (ramps) record?.(v);
    },
    setTargetAtTime: () => undefined,
    cancelScheduledValues: () => undefined,
  };
}

function fakeNode(source?: Source, levels?: number[]): Fake {
  const base: Fake = {
    connect: (to: unknown) => to,
    disconnect: () => undefined,
    start: (t = 0) => {
      source?.starts.push(t);
    },
    stop: (t = 0) => {
      source?.stops.push(t);
    },
  };
  if (source?.kind === 'osc') base['frequency'] = param((v) => source.freqs.push(v));
  if (levels) base['gain'] = param((v) => levels.push(v), true);
  return new Proxy(base, {
    get(target, key: string) {
      if (!(key in target)) target[key] = param();
      return target[key];
    },
  });
}

class RecordingContext {
  currentTime = 1;
  sampleRate = 8000;
  state = 'running';
  destination = fakeNode();
  readonly sources: Source[] = [];
  readonly levels: number[] = [];
  private readonly live: { node: Fake; source: Source; ended: boolean }[] = [];
  [k: string]: unknown;
  endDue(): void {
    for (const l of this.live) {
      if (l.ended || stopOf(l.source) > this.currentTime) continue;
      l.ended = true;
      const cb = l.node['onended'];
      if (typeof cb === 'function') (cb as () => void)();
    }
  }
  constructor() {
    for (const name of [
      'createDynamicsCompressor',
      'createWaveShaper',
      'createConvolver',
      'createBiquadFilter',
      'createStereoPanner',
    ])
      this[name] = () => fakeNode();
    this['createGain'] = () => fakeNode(undefined, this.levels);
    this['createOscillator'] = () => {
      const s: Source = { kind: 'osc', freqs: [], starts: [], stops: [] };
      this.sources.push(s);
      const node = fakeNode(s);
      this.live.push({ node, source: s, ended: false });
      return node;
    };
    this['createBufferSource'] = () => {
      const s: Source = { kind: 'noise', freqs: [], starts: [], stops: [] };
      this.sources.push(s);
      const node = fakeNode(s);
      this.live.push({ node, source: s, ended: false });
      return node;
    };
    this['createBuffer'] = (_ch: number, length: number, sr: number) => ({
      length,
      sampleRate: sr,
      duration: length / sr,
      getChannelData: () => new Float32Array(length),
    });
  }
}

function harness() {
  const ctx = new RecordingContext();
  const d = new SynthDirector({
    context: ctx as unknown as BaseAudioContext,
    autoPump: false,
    installUnlock: false,
    followSettings: false,
  });
  d.setMood('combat');
  const world = new FakeWorld();
  d.pump();
  const stats = () => d.debugStats();
  const fire = (...events: SimEvent[]) => {
    const before = { ...stats().peakVoices };
    const n = stats().totalSources;
    const nSfx = stats().activeSources.sfx;
    const from = ctx.sources.length;
    const fromLevel = ctx.levels.length;
    d.onEvents(events, world.state);
    const after = stats().peakVoices;
    return {
      groups: Object.keys(after).filter((k) => (after[k] ?? 0) > (before[k] ?? 0)),
      added: stats().totalSources - n,
      addedSfx: stats().activeSources.sfx - nSfx,
      sources: ctx.sources.slice(from),
      peak: Math.max(0, ...ctx.levels.slice(fromLevel)),
    };
  };
  const ui = (sound: UiSound, detail?: UiSoundDetail) => {
    const before = { ...stats().peakVoices };
    const n = stats().totalSources;
    const nUi = stats().activeSources.ui;
    const from = ctx.sources.length;
    const fromLevel = ctx.levels.length;
    if (detail) d.playUi(sound, null, detail);
    else d.playUi(sound);
    const after = stats().peakVoices;
    return {
      groups: Object.keys(after).filter((k) => (after[k] ?? 0) > (before[k] ?? 0)),
      added: stats().totalSources - n,
      addedUi: stats().activeSources.ui - nUi,
      sources: ctx.sources.slice(from),
      peak: Math.max(0, ...ctx.levels.slice(fromLevel)),
    };
  };
  const advance = (dt: number) => {
    ctx.currentTime += dt;
    ctx.endDue();
    world.advance(dt);
    d.pump();
  };
  /** The chord the music is on now (the director's). */
  const chord = (): Chord => CHORDS[stats().chord as keyof typeof CHORDS]!;
  return { ctx, d, world, fire, ui, advance, stats, chord };
}
type Harness = ReturnType<typeof harness>;
type Recorded = { sources: Source[] };

const freqsOf = (sources: Source[]) => sources.flatMap((s) => s.freqs);
const midiOf = (hz: number) => 69 + 12 * Math.log2(hz / 440);
/** Cents from the nearest D dorian pitch. */
const centsOff = (hz: number) => {
  const midi = midiOf(hz);
  let best = Infinity;
  for (let m = Math.floor(midi) - 1; m <= Math.ceil(midi) + 1; m++)
    if (isInScale(m)) best = Math.min(best, Math.abs(midi - m) * 100);
  return best;
};
/** Glass's and a handbell's partials over a note (the recipes' own ratios). */
const PARTIALS = [1, 2.32, 4.25, 6.63, 2.01, 3.0, 4.16];
const inKey = (f: number) => PARTIALS.some((r) => centsOff(f / r) < 3);
/** A chord tone (any octave), or one of its partials. */
const onChord = (f: number, c: Chord) => {
  const pcs = new Set(c.tones.map((t) => (c.root + t) % 12));
  return PARTIALS.some((r) => {
    const m = midiOf(f / r);
    return Math.abs(m - Math.round(m)) < 0.03 && pcs.has(((Math.round(m) % 12) + 12) % 12);
  });
};
const signature = (r: Recorded) =>
  `${r.sources.length}:${freqsOf(r.sources)
    .map((f) => f.toFixed(2))
    .join(',')}`;
const endOf = (r: Recorded, now: number) => Math.max(...r.sources.map(stopOf)) - now;

// ── The casts as the sim reports them ────────────────────────────────────────────────

const VARIANTS = Object.keys(VARIANT_SOUND_GROUPS);
const HERO_AT = { x: 0, z: -3 };

/** A variant's cast batch as the sim sends it, with the lab world set for it. */
function castOf(h: Harness, id: string): SimEvent[] {
  const slot = slotOf(id);
  h.world.setVariant(slot, id);
  const cast = (technique: string, target: number | null, x = HERO_AT.x, z = HERO_AT.z) =>
    ev('techniqueCast', { technique, target, x, z, variant: id });
  switch (id) {
    case 'chorale':
      return [
        cast('ward', IDS.lyra),
        ev('chorale', {
          x: 0,
          z: -3,
          radius: vv('chorale', 'radius'),
          targets: [IDS.kael, IDS.lyra, IDS.vexis],
        }),
      ];
    case 'aegis_link':
      return [
        cast('ward', IDS.kael),
        ev('linked', { a: IDS.kael, b: IDS.lyra, weaver: false, until: 5 }),
      ];
    case 'purge':
    case 'absolve':
      return [
        cast('chime', null),
        ev('chimeLaunched', { chime: 1, fromX: 0, fromZ: 0, x: 0, z: -3, landsAt: 0.25 }),
      ];
    case 'swap':
      return [
        cast('reel', IDS.lyra),
        ev('swapped', { hero: IDS.lyra, fromX: 0, fromZ: -3, toX: 0, toZ: 0 }),
      ];
    case 'anchor':
      return [
        cast('reel', IDS.kael),
        ev('statusApplied', { target: IDS.kael, status: 'anchored', duration: 3 }),
      ];
    case 'phase_step':
      return [
        cast('glide', null, 8, 0),
        ev('phaseStep', { fromX: 0, fromZ: 0, toX: 8, toZ: 0, until: 2 }),
      ];
    case 'skate':
      h.world.setGlideCharges(h.world.weaverData().maxGlideCharges - 1);
      return [cast('glide', null, 4, 0), ev('glided', { fromX: 0, fromZ: 0, toX: 4, toZ: 0 })];
    default:
      throw new Error(id);
  }
}

/** The default technique's cast batch in a variant's slot. */
function defaultOf(id: string): SimEvent[] {
  switch (slotOf(id)) {
    case 'ward':
      return [ev('techniqueCast', { technique: 'ward', target: IDS.kael, x: 0, z: 0 })];
    case 'chime':
      return [
        ev('techniqueCast', { technique: 'chime', target: null, x: 0, z: -3 }),
        ev('chimeLaunched', { chime: 1, fromX: 0, fromZ: 0, x: 0, z: -3, landsAt: 0.25 }),
      ];
    case 'reel':
      return [
        ev('techniqueCast', { technique: 'reel', target: IDS.lyra, x: 0, z: -3 }),
        ev('reeled', { target: IDS.lyra, fromX: 0, fromZ: -3, toX: 0, toZ: 2 }),
      ];
    default:
      return [
        ev('techniqueCast', { technique: 'glide', target: null, x: 6, z: 0 }),
        ev('glided', { fromX: 0, fromZ: 0, toX: 6, toZ: 0 }),
      ];
  }
}

function castSound(id: string) {
  const h = harness();
  const r = h.fire(...castOf(h, id));
  return { h, r };
}

const hitOn = (target: number, source: number = IDS.enemyBase, telegraph: number | null = null) =>
  ev('damageTaken', {
    target,
    source,
    amount: 50,
    absorbed: 0,
    amplified: 0,
    aura: 0,
    radiance: 0,
    eclipse: 0,
    crit: false,
    telegraph,
    hit: 'hit',
  });

describe('a cast sound for every variant the sim casts', () => {
  it('covers every variant the sim knows, each with its gate and cap', () => {
    expect([...VARIANTS].sort()).toEqual([...KNOWN_VARIANTS].sort());
    expect([...VARIANTS].sort()).toEqual(CONTENT.techniqueVariants.map((v) => v.id).sort());
    const groups = [
      ...Object.values(VARIANT_SOUND_GROUPS),
      ...Object.values(VARIANT_MOMENT_GROUPS),
    ];
    expect(new Set(groups).size).toBe(groups.length);
    for (const g of groups) expect(VARIANT_SOUND_LIMITS[g], g).toBeDefined();
  });

  it('each plays on the sfx bus in its own group, in place of its default, and nothing on the UI bus', () => {
    for (const id of VARIANTS) {
      const { h, r } = castSound(id);
      expect(r.added, id).toBeGreaterThan(0);
      expect(r.addedSfx, id).toBe(r.added);
      // Its own group only: not the Ward's glass, the Chime's launch nor the Glide's breath.
      expect(r.groups, id).toEqual([VARIANT_SOUND_GROUPS[id]]);
      expect(h.stats().activeSources.ui, id).toBe(0);
      h.d.dispose();
    }
  });

  it('each is distinct from its default and from the others', () => {
    const ours = VARIANTS.map((id) => {
      const { h, r } = castSound(id);
      h.d.dispose();
      return signature(r);
    });
    expect(new Set(ours).size).toBe(VARIANTS.length);
    for (const id of VARIANTS) {
      const h = harness();
      const sig = signature(h.fire(...defaultOf(id)));
      expect(ours, `${id}'s default`).not.toContain(sig);
      h.d.dispose();
    }
  });

  it('in the Weaver’s voice: on the music’s chord, in D dorian (to the cent), as her techniques are', () => {
    for (const id of VARIANTS) {
      const { h, r } = castSound(id);
      const c = h.chord();
      expect(freqsOf(r.sources).length, id).toBeGreaterThan(0);
      for (const f of freqsOf(r.sources)) {
        expect(inKey(f), `${id} ${f.toFixed(1)} Hz`).toBe(true);
        expect(onChord(f, c), `${id} ${f.toFixed(1)} Hz on ${c.name}`).toBe(true);
      }
      h.d.dispose();
    }
  });

  it('every variant cast is no louder than the Perfect it may meet', () => {
    const p = harness();
    const perfect = p.fire(ev('perfectWard', { target: IDS.kael, telegraph: 1, negated: 400 }));
    for (const id of VARIANTS) {
      const { h, r } = castSound(id);
      expect(r.peak, id).toBeLessThanOrEqual(perfect.peak);
      h.d.dispose();
    }
    p.d.dispose();
  });

  it('Chorale sings a voice for each hero it reached (from its event)', () => {
    const one = harness();
    one.world.setVariant('ward', 'chorale');
    const a = one.fire(
      ev('techniqueCast', { technique: 'ward', target: IDS.lyra, x: 0, z: -3, variant: 'chorale' }),
      ev('chorale', { x: 0, z: -3, radius: 5, targets: [IDS.lyra] }),
    );
    const three = castSound('chorale');
    expect(three.r.added).toBeGreaterThan(a.added);
    one.d.dispose();
    three.h.d.dispose();
  });

  it('Aegis Link on a hero alone (no other standing) is one voice, not two', () => {
    const two = castSound('aegis_link');
    const h = harness();
    h.world.setVariant('ward', 'aegis_link');
    const one = h.fire(
      ev('techniqueCast', {
        technique: 'ward',
        target: IDS.kael,
        x: 0,
        z: 0,
        variant: 'aegis_link',
      }),
      ev('linked', { a: IDS.kael, b: IDS.kael, weaver: false, until: 5 }),
    );
    expect(one.groups).toEqual([VARIANT_SOUND_GROUPS.aegis_link]);
    expect(one.added).toBeLessThan(two.r.added);
    two.h.d.dispose();
    h.d.dispose();
  });

  it('Skate replaces the Glide’s breath, its pluck climbing with each charge spent', () => {
    const h = harness();
    const first = h.fire(...castOf(h, 'skate'));
    h.advance(0.3);
    // The second charge: none left after it.
    h.world.setGlideCharges(0);
    const second = h.fire(
      ev('techniqueCast', { technique: 'glide', target: null, x: 4, z: 0, variant: 'skate' }),
      ev('glided', { fromX: 0, fromZ: 0, toX: 4, toZ: 0 }),
    );
    expect(first.groups).toEqual(['variant:skate']);
    expect(second.added).toBe(first.added);
    expect(h.stats().peakVoices['glide'] ?? 0).toBe(0);
    // Its pluck: the only triangle (its octave sine aside), climbing.
    const pluckOf = (r: Recorded) => r.sources.filter((s) => s.kind === 'osc')[0]!.freqs[0]!;
    expect(pluckOf(second)).toBeGreaterThan(pluckOf(first));
    h.d.dispose();
  });

  it('Phase Step’s decoy shimmers for as long as it stands (content)', () => {
    const { h, r } = castSound('phase_step');
    const now = h.ctx.currentTime;
    expect(endOf(r, now)).toBeGreaterThan(vv('phase_step', 'seconds'));
    h.d.dispose();
  });
});

describe('the moments after a cast', () => {
  it('several Chorale barriers Perfect at once: a chord over the Perfect, crowned once', () => {
    const perfects = (n: number) =>
      Array.from({ length: n }, (_, i) =>
        ev('perfectWard', {
          target: [IDS.kael, IDS.lyra, IDS.vexis][i],
          telegraph: 7,
          negated: 300,
        }),
      );
    const h = harness();
    h.world.setVariant('ward', 'chorale');
    const three = h.fire(...perfects(3));
    expect(three.groups).toContain('bigPerfect');
    expect(three.groups).toContain(VARIANT_MOMENT_GROUPS.chord);
    expect(h.stats().peakVoices[VARIANT_MOMENT_GROUPS.chord]).toBe(1);
    // The chord's own sources (after the Perfect's) are on the music's chord.
    const p = harness();
    const perfectOnly = p.fire(...perfects(3)).sources.length;
    p.d.dispose();
    const c = h.chord();
    const chord = three.sources.slice(perfectOnly);
    expect(chord.length).toBeGreaterThan(0);
    for (const f of freqsOf(chord)) expect(onChord(f, c), `${f}`).toBe(true);
    h.d.dispose();
    // One alone is the ordinary Perfect; so are several with the default Ward.
    const lone = harness();
    lone.world.setVariant('ward', 'chorale');
    expect(lone.fire(...perfects(1)).groups).not.toContain(VARIANT_MOMENT_GROUPS.chord);
    lone.d.dispose();
    const plain = harness();
    expect(plain.fire(...perfects(3)).groups).not.toContain(VARIANT_MOMENT_GROUPS.chord);
    plain.d.dispose();
  });

  it('a Link’s Perfect: the Weaver joins a beat after the strike, a third voice on the chord', () => {
    const h = harness();
    h.fire(...castOf(h, 'aegis_link'));
    h.advance(0.5);
    const now = h.ctx.currentTime;
    const r = h.fire(
      ev('perfectWard', { target: IDS.kael, telegraph: 1, negated: 400 }),
      ev('linked', { a: IDS.kael, b: IDS.lyra, weaver: true, until: 5 }),
    );
    expect(r.groups).toContain('bigPerfect');
    expect(r.groups).toContain(VARIANT_MOMENT_GROUPS.join);
    const join = h.fire(ev('linked', { a: IDS.kael, b: IDS.lyra, weaver: true, until: 5 }));
    // Gated: the same moment twice in a breath is one.
    expect(join.added).toBe(0);
    const mine = r.sources.filter((s) => startOf(s) >= now + 0.09);
    expect(mine.length).toBeGreaterThan(0);
    h.d.dispose();
  });

  it('a hit shared along the Link: a light sound; a lone hit, or after the Link ends, none', () => {
    const h = harness();
    h.fire(...castOf(h, 'aegis_link'));
    h.advance(0.3);
    const shared = h.fire(hitOn(IDS.lyra), hitOn(IDS.kael));
    expect(shared.groups).toContain(VARIANT_MOMENT_GROUPS.share);
    h.advance(0.3);
    const lone = h.fire(hitOn(IDS.lyra));
    expect(lone.groups).not.toContain(VARIANT_MOMENT_GROUPS.share);
    // The Link is over (its `until`): hits on its old members aren't shared.
    h.world.advance(10);
    h.advance(0.3);
    const late = h.fire(hitOn(IDS.lyra), hitOn(IDS.kael));
    expect(late.groups).not.toContain(VARIANT_MOMENT_GROUPS.share);
    h.d.dispose();
    // Alone (members with no hit sound of their own): light, quieter than a Ward, short.
    const k = harness();
    const ward = k.fire(...defaultOf('chorale'));
    k.advance(0.5);
    k.fire(ev('linked', { a: IDS.enemyBase, b: IDS.enemyBase + 1, weaver: false, until: 99 }));
    const only = k.fire(hitOn(IDS.enemyBase + 1, 5), hitOn(IDS.enemyBase, 5));
    expect(only.groups).toEqual([VARIANT_MOMENT_GROUPS.share]);
    expect(only.added).toBeLessThanOrEqual(4);
    expect(only.peak).toBeLessThan(ward.peak);
    expect(endOf(only, k.ctx.currentTime)).toBeLessThan(0.6);
    k.d.dispose();
  });

  it('Purge’s burst: a glass falling for each enemy it reached (up to four)', () => {
    const burst = (n: number) => {
      const h = harness();
      h.world.setEnemies(Math.max(1, n));
      const hit = Array.from({ length: n }, (_, i) => IDS.enemyBase + i);
      const r = h.fire(ev('purged', { hero: IDS.lyra, x: 0, z: -3, radius: 3.5, hit }));
      h.d.dispose();
      return r;
    };
    const none = burst(0);
    const three = burst(3);
    const six = burst(6);
    expect(none.groups).toEqual([VARIANT_MOMENT_GROUPS.purged]);
    expect(three.added).toBeGreaterThan(none.added);
    expect(six.added).toBe(burst(4).added);
  });

  it('Absolve’s guard settles once per Chime, however many it reached', () => {
    const h = harness();
    const r = h.fire(
      ev('statusApplied', { target: IDS.kael, status: 'absolved', duration: 2 }),
      ev('statusApplied', { target: IDS.lyra, status: 'absolved', duration: 2 }),
    );
    expect(r.groups).toEqual([VARIANT_MOMENT_GROUPS.absolved]);
    expect(h.stats().peakVoices[VARIANT_MOMENT_GROUPS.absolved]).toBe(1);
    h.d.dispose();
  });

  it('is gated: a burst of each stays within its cap', () => {
    const E = IDS.enemyBase;
    const bursts: [string, (h: Harness) => SimEvent[]][] = [
      ...VARIANTS.map((id): [string, (h: Harness) => SimEvent[]] => [
        VARIANT_SOUND_GROUPS[id]!,
        (h) => castOf(h, id),
      ]),
      [VARIANT_MOMENT_GROUPS.share, () => [hitOn(E + 1, 5), hitOn(E, 5)]],
      [
        VARIANT_MOMENT_GROUPS.purged,
        () => [ev('purged', { hero: IDS.lyra, x: 0, z: -3, radius: 3, hit: [E] })],
      ],
      [
        VARIANT_MOMENT_GROUPS.absolved,
        () => [ev('statusApplied', { target: IDS.kael, status: 'absolved', duration: 2 })],
      ],
    ];
    for (const [group, make] of bursts) {
      const h = harness();
      h.world.setEnemies(3);
      // A Link between two enemies: their hits shared, with no hit sounds of their own.
      h.fire(ev('linked', { a: E, b: E + 1, weaver: false, until: 99 }));
      let heard = 0;
      for (let i = 0; i < 40; i++) {
        heard += h.fire(...make(h)).added > 0 ? 1 : 0;
        h.advance(0.025);
      }
      const [gate, cap] = VARIANT_SOUND_LIMITS[group]!;
      expect(h.stats().peakVoices[group] ?? 0, group).toBeLessThanOrEqual(cap);
      expect(h.stats().peakVoices[group] ?? 0, group).toBeGreaterThan(0);
      // 40 in a second: at most one per gate.
      expect(heard, group).toBeLessThanOrEqual(Math.ceil(1 / gate) + 1);
      expect(heard, group).toBeGreaterThanOrEqual(1);
      h.d.dispose();
    }
  });
});

describe('the variants in a real fight', () => {
  it('heard as each is cast, within its cap, never throwing', () => {
    for (const techniques of [
      { ward: 'chorale', chime: 'purge', reel: 'swap', glide: 'phase_step' },
      { ward: 'aegis_link', chime: 'absolve', reel: 'anchor', glide: 'skate' },
    ]) {
      const h = harness();
      const sim = createSim({
        seed: 5,
        encounter: 'first_light',
        chords: [{ auras: ['fortissimo'] }, { auras: ['sostenuto'] }],
        assists: { autonomy: true },
        techniques,
      });
      const cast = new Set<string>();
      for (let i = 0; i < 60 * 40; i++) {
        const c: Command[] = [];
        if (i === 10) c.push({ t: 'thread', slot: 1 });
        if (i % 420 === 60) c.push({ t: 'tech', id: 'ward', slot: 0 });
        if (i % 600 === 200) {
          const k = sim.state.entities.get(sim.state.party[0]!)!;
          c.push({ t: 'tech', id: 'chime', point: { x: k.x, z: k.z } });
        }
        if (i % 900 === 300) c.push({ t: 'tech', id: 'reel', slot: 1 });
        if (i % 300 === 120) c.push({ t: 'glide', x: i % 600 === 120 ? 1 : -1, z: 0.4 });
        sim.step(c);
        const events = sim.drainEvents();
        for (const e of events) if (e.type === 'techniqueCast' && e.variant) cast.add(e.variant);
        h.ctx.currentTime += 1 / 60;
        h.ctx.endDue();
        expect(() => h.d.onEvents(events, sim.state)).not.toThrow();
        if (i % 3 === 0) h.d.update(sim.state, 1 / 20);
        h.d.pump();
      }
      expect(cast.size, JSON.stringify(techniques)).toBe(4);
      const peaks = h.stats().peakVoices;
      for (const id of cast) {
        const group = VARIANT_SOUND_GROUPS[id]!;
        expect(peaks[group] ?? 0, id).toBeGreaterThan(0);
        expect(peaks[group] ?? 0, id).toBeLessThanOrEqual(VARIANT_SOUND_LIMITS[group]![1]);
      }
      for (const g of Object.values(VARIANT_MOMENT_GROUPS))
        expect(peaks[g] ?? 0, g).toBeLessThanOrEqual(VARIANT_SOUND_LIMITS[g]![1]);
      h.d.dispose();
    }
  });
});

describe('variantPick (Phase 4f UI)', () => {
  const SLOTS = ['ward', 'chime', 'reel', 'glide'] as const;
  const anyOf = (slot: string) => CONTENT.techniqueVariants.find((v) => v.slot === slot)!.id;

  it('is an agreed UiSound with its own recipe, gate and cap', () => {
    expect(UI_SOUND_NAMES).toContain('variantPick');
    expect(VARIANT_LIMITS.variantPick).toBeDefined();
  });

  it('plays on the UI bus in its own group, for each slot and with no detail', () => {
    for (const detail of [undefined, ...SLOTS.map((s) => ({ variant: anyOf(s) }))]) {
      const h = harness();
      const r = h.ui('variantPick', detail);
      expect(r.added).toBeGreaterThan(0);
      expect(r.addedUi).toBe(r.added);
      expect(r.groups).toEqual(['ui:variantPick']);
      for (const f of freqsOf(r.sources)) expect(inKey(f), `${f.toFixed(1)} Hz`).toBe(true);
      expect(endOf(r, h.ctx.currentTime)).toBeLessThan(1.2);
      h.d.dispose();
    }
  });

  it('is voiced by its slot, distinct from a plain pick and from a talent’s', () => {
    const sig = (s: UiSound, detail?: UiSoundDetail) => {
      const h = harness();
      const out = signature(h.ui(s, detail));
      h.d.dispose();
      return out;
    };
    const ours = [
      sig('variantPick'),
      ...SLOTS.map((s) => sig('variantPick', { variant: anyOf(s) })),
    ];
    expect(new Set(ours).size).toBe(ours.length);
    for (const other of [
      'pick',
      'click',
      'confirm',
      'back',
      'talentPick',
      'relicPick',
    ] as UiSound[])
      expect(ours, other).not.toContain(sig(other));
    // Both variants of a slot sound alike (the slot voices it).
    for (const slot of SLOTS) {
      const [a, b] = CONTENT.techniqueVariants.filter((v) => v.slot === slot);
      expect(sig('variantPick', { variant: a!.id })).toBe(sig('variantPick', { variant: b!.id }));
    }
  });

  it('mashing stays within its cap; a safe no-op without an AudioContext', () => {
    const h = harness();
    for (let i = 0; i < 40; i++) {
      h.d.playUi('variantPick', null, { variant: anyOf(SLOTS[i % 4]!) });
      h.advance(0.02);
    }
    expect(h.stats().peakVoices['ui:variantPick'] ?? 0).toBeLessThanOrEqual(
      VARIANT_LIMITS.variantPick![1],
    );
    h.d.dispose();
    const audio = getAudio();
    expect(() => {
      audio.playUi('variantPick');
      audio.playUi('variantPick', null, { variant: 'nope' });
      audio.onEvents(
        [ev('techniqueCast', { technique: 'ward', target: 1, x: 0, z: 0, variant: 'chorale' })],
        {} as WorldState,
      );
    }).not.toThrow();
    audio.dispose();
  });

  it('does not throw with a context but an odd state or an unknown variant', () => {
    const h = harness();
    expect(() => {
      h.d.onEvents(
        [
          ev('techniqueCast', { technique: 'ward', target: 9, x: 0, z: 0, variant: 'not_one' }),
          ev('techniqueCast', { technique: 'glide', target: null, x: 0, z: 0, variant: 'skate' }),
          ev('purged', { hero: 99, x: 0, z: 0, radius: 3, hit: [77] }),
          ev('linked', { a: 98, b: 99, weaver: true, until: 3 }),
          hitOn(98, 5),
          hitOn(99, 5),
        ],
        { time: 0 } as unknown as WorldState,
      );
    }).not.toThrow();
    h.d.dispose();
  });
});

describe('audio lab: the Phase 4f buttons', () => {
  const press = (id: string) => {
    const s = SOUNDS.find((b) => b.id === id);
    const h = harness();
    s?.fire(h.d, h.world);
    let at = 0;
    for (const f of s?.then ?? []) {
      while (at + 1e-9 < f.delay) {
        h.advance(0.05);
        at += 0.05;
      }
      f.fire(h.d, h.world);
    }
    return h;
  };

  it('has a button for each variant, each moment, the bursts and each slot’s pick', () => {
    const ids = SOUNDS.map((s) => s.id);
    for (const id of VARIANTS) expect(ids, id).toContain(`variant-${id}`);
    for (const id of [
      'variant-chorale-perfect',
      'variant-chorale-lone',
      'variant-link-perfect',
      'variant-link-share',
      'variant-share-burst',
      'variant-purge-burst',
      'variant-purge-none',
      'variant-skate-twice',
      'variant-every',
      'ui-variantPick',
      'variant-pick-ward',
      'variant-pick-chime',
      'variant-pick-reel',
      'variant-pick-glide',
    ])
      expect(ids, id).toContain(id);
  });

  it('each makes its sound: a cast its group, a moment its own', () => {
    for (const s of SOUNDS.filter((b) => b.group === 'variants')) {
      const h = press(s.id);
      expect(h.stats().peakSources, s.id).toBeGreaterThan(0);
      const id = /^variant-([a-z_]+)$/.exec(s.id)?.[1];
      if (id && VARIANT_SOUND_GROUPS[id])
        expect(h.stats().peakVoices[VARIANT_SOUND_GROUPS[id]!] ?? 0, s.id).toBeGreaterThan(0);
      h.d.dispose();
    }
    const moments: [string, string][] = [
      ['variant-chorale-perfect', VARIANT_MOMENT_GROUPS.chord],
      ['variant-link-perfect', VARIANT_MOMENT_GROUPS.join],
      ['variant-link-share', VARIANT_MOMENT_GROUPS.share],
      ['variant-purge-burst', VARIANT_MOMENT_GROUPS.purged],
      ['variant-absolve', VARIANT_MOMENT_GROUPS.absolved],
      ['variant-purge', VARIANT_MOMENT_GROUPS.purged],
    ];
    for (const [button, group] of moments) {
      const h = press(button);
      expect(h.stats().peakVoices[group] ?? 0, button).toBeGreaterThan(0);
      h.d.dispose();
    }
    const lone = press('variant-chorale-lone');
    expect(lone.stats().peakVoices[VARIANT_MOMENT_GROUPS.chord] ?? 0).toBe(0);
    lone.d.dispose();
  });

  it('the bursts stay within their caps; every variant in turn is heard', () => {
    const share = press('variant-share-burst');
    expect(share.stats().peakVoices[VARIANT_MOMENT_GROUPS.share]).toBeLessThanOrEqual(
      VARIANT_SOUND_LIMITS[VARIANT_MOMENT_GROUPS.share]![1],
    );
    share.d.dispose();
    const every = press('variant-every');
    for (const id of VARIANTS)
      expect(every.stats().peakVoices[VARIANT_SOUND_GROUPS[id]!] ?? 0, id).toBeGreaterThan(0);
    every.d.dispose();
  });
});
