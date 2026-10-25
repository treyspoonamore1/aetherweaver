/** Phase 3c audio: the Calling UI sounds, Radiance's shimmer, Dawnward and the Luminary's Sunrise. */
import { describe, expect, it } from 'vitest';
import { getAudio } from '../src/audio';
import { SynthDirector } from '../src/audio/director';
import { FakeWorld, IDS } from '../src/audio/lab/labState';
import { SOUNDS } from '../src/audio/lab/soundBoard';
import { UI_SOUND_NAMES } from '../src/audio/ui';
import type { UiSound } from '../src/audio/types';
import type { SimEvent, WorldState } from '../src/sim';

const CALLING_UI: UiSound[] = ['callingSelect', 'callingReveal', 'callingPick'];

const ev = (type: SimEvent['type'], rest: Record<string, unknown>): SimEvent =>
  ({ type, tick: 0, ...rest }) as unknown as SimEvent;

/** A hero's hit on an enemy; `radiance` is Radiance's part of the 100 damage. */
const hit = (hero: number, radiance: number, enemy: number = IDS.enemyBase): SimEvent =>
  ev('damageTaken', {
    target: enemy,
    source: hero,
    amount: 100,
    absorbed: 0,
    amplified: radiance,
    aura: 0,
    radiance,
    crit: false,
    telegraph: null,
    hit: 'hit',
  });
const dawnward = (hero: number = IDS.kael, amount = 60): SimEvent =>
  ev('dawnward', { hero, amount });
const shield = (hero: number = IDS.kael): SimEvent =>
  ev('shieldApplied', { target: hero, shield: 'overshield', amount: 60, fromWeaver: true });
const sunrise = (): SimEvent => ev('crescendoStart', { calling: 'Lab', duration: 8 });

// ── A recording fake AudioContext (as in tests/audio.test.ts) ─────────────────────────

type Fake = Record<string, unknown>;

function fakeNode(): Fake {
  const base: Fake = {
    connect: (to: unknown) => to,
    disconnect: () => undefined,
    start: () => undefined,
    stop: () => undefined,
  };
  return new Proxy(base, {
    get(target, key: string) {
      if (!(key in target)) {
        target[key] = {
          value: 0,
          setValueAtTime: () => undefined,
          linearRampToValueAtTime: () => undefined,
          exponentialRampToValueAtTime: () => undefined,
          setTargetAtTime: () => undefined,
          cancelScheduledValues: () => undefined,
        };
      }
      return target[key];
    },
  });
}

class FakeContext {
  currentTime = 1;
  sampleRate = 8000;
  state = 'running';
  destination = fakeNode();
  [k: string]: unknown;
  constructor() {
    for (const name of [
      'createGain',
      'createDynamicsCompressor',
      'createWaveShaper',
      'createConvolver',
      'createBiquadFilter',
      'createStereoPanner',
      'createOscillator',
      'createBufferSource',
    ])
      this[name] = () => fakeNode();
    this['createBuffer'] = (_ch: number, length: number, sr: number) => ({
      length,
      sampleRate: sr,
      duration: length / sr,
      getChannelData: () => new Float32Array(length),
    });
  }
}

function harness() {
  const ctx = new FakeContext();
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
  /** Fires events; returns the voice groups they opened, and the sources and sfx sources added. */
  const fire = (...events: SimEvent[]) => {
    const before = { ...stats().peakVoices };
    const n = stats().totalSources;
    const nSfx = stats().activeSources.sfx;
    d.onEvents(events, world.state);
    const after = stats().peakVoices;
    const groups = Object.keys(after).filter((k) => (after[k] ?? 0) > (before[k] ?? 0));
    return { groups, added: stats().totalSources - n, addedSfx: stats().activeSources.sfx - nSfx };
  };
  const advance = (dt: number) => {
    ctx.currentTime += dt;
    d.pump();
  };
  return { ctx, d, world, fire, advance, stats };
}

const HEROES = [IDS.kael, IDS.lyra, IDS.vexis];

describe('Calling UI sounds', () => {
  it('are listed, each with a case of its own', () => {
    for (const s of CALLING_UI) expect(UI_SOUND_NAMES, s).toContain(s);
  });

  it('each plays on the UI bus in its own group', () => {
    for (const sound of CALLING_UI) {
      const h = harness();
      const before = h.stats().activeSources.ui;
      h.d.playUi(sound);
      expect(h.stats().activeSources.ui, sound).toBeGreaterThan(before);
      expect(Object.keys(h.stats().peakVoices).filter((k) => k.startsWith('ui:'))).toEqual([
        `ui:${sound}`,
      ]);
      h.d.dispose();
    }
  });

  it('are three distinct recipes, and not trivial', () => {
    const counts = CALLING_UI.map((sound) => {
      const h = harness();
      h.d.playUi(sound);
      const n = h.stats().totalSources;
      h.d.dispose();
      return n;
    });
    expect(new Set(counts).size).toBe(3);
    for (const n of counts) expect(n).toBeGreaterThan(12);
  });

  it('are weightier than the pick they follow: callingPick has more voices than relicPick', () => {
    const count = (s: UiSound) => {
      const h = harness();
      h.d.playUi(s);
      const n = h.stats().totalSources;
      h.d.dispose();
      return n;
    };
    expect(count('callingPick')).toBeGreaterThan(count('relicPick'));
  });
});

describe('Radiance shimmer', () => {
  it('plays a shimmer on the sfx bus for a radiant hit', () => {
    const h = harness();
    const r = h.fire(hit(IDS.lyra, 12));
    expect(r.groups).toContain('radiance');
    expect(r.added).toBeGreaterThan(0);
    expect(r.addedSfx).toBeGreaterThan(0);
    h.d.dispose();
  });

  it('makes no shimmer for a hit with no Radiance', () => {
    const h = harness();
    const r = h.fire(hit(IDS.lyra, 0));
    expect(r.groups).not.toContain('radiance');
    expect(r.added).toBe(0);
    h.d.dispose();
  });

  it('is rate-limited under a burst: 100 radiant hits in one second', () => {
    const h = harness();
    let groups = 0;
    for (let i = 0; i < 100; i++) {
      groups += h.fire(hit(HEROES[i % 3] as number, 12)).added > 0 ? 1 : 0;
      h.advance(0.01);
    }
    // About four a second at most (0.7 s per hero, 0.15 s across the party), never a hundred.
    expect(groups).toBeGreaterThan(0);
    expect(groups).toBeLessThanOrEqual(8);
    expect(h.stats().peakVoices['radiance'] ?? 0).toBeLessThanOrEqual(3);
    expect(h.stats().skipped).toBeGreaterThan(80);
    h.d.dispose();
  });

  it('plays one for 100 hits in a single frame', () => {
    const h = harness();
    const single = harness().fire(hit(IDS.kael, 12)).added;
    const r = h.fire(...Array.from({ length: 100 }, (_, i) => hit(HEROES[i % 3] as number, 12)));
    // The first hero's shimmer passes; the party gate (0.15 s) refuses the rest of the frame.
    expect(r.added).toBe(single);
    expect(h.stats().peakVoices['radiance'] ?? 0).toBe(1);
    h.d.dispose();
  });

  it('keeps going on a long fight: sparse, steady and bounded', () => {
    const h = harness();
    let played = 0;
    for (let i = 0; i < 600; i++) {
      played += h.fire(hit(HEROES[i % 3] as number, 12)).added > 0 ? 1 : 0;
      h.advance(0.01);
    }
    // Six seconds of constant hits: at most ~4.3 a second.
    expect(played).toBeGreaterThan(5);
    expect(played).toBeLessThanOrEqual(30);
    h.d.dispose();
  });

  it('is brighter for a bigger Radiance share and in Sunrise (more sources)', () => {
    const count = (radiance: number, inSunrise = false) => {
      const h = harness();
      h.world.sunrise = inSunrise;
      const n = h.fire(hit(IDS.vexis, radiance)).added;
      h.d.dispose();
      return n;
    };
    expect(count(35)).toBeGreaterThan(count(8));
    expect(count(8, true)).toBeGreaterThan(count(8));
  });

  it('is quiet: well under the Thimble and far under the core cues', () => {
    // Every voice of the shimmer is a glass note: a handful of sources, no noise bed.
    const h = harness();
    const r = h.fire(hit(IDS.lyra, 12));
    expect(r.added).toBeLessThanOrEqual(10);
    h.d.dispose();
  });

  it('still lets a hero hit through, and is safe for odd sources', () => {
    const h = harness();
    expect(() => {
      h.fire(hit(9999, 12));
      h.fire(ev('damageTaken', { ...(hit(IDS.kael, 12) as object), source: null }));
      h.fire(hit(IDS.kael, 12, 4242));
    }).not.toThrow();
    // A hero damaged by an enemy (radiance 0) keeps the hero-hit thump.
    const r = h.fire(
      ev('damageTaken', {
        target: IDS.kael,
        source: IDS.enemyBase,
        amount: 80,
        absorbed: 0,
        amplified: 0,
        aura: 0,
        radiance: 0,
        crit: false,
        telegraph: null,
        hit: 'hit',
      }),
    );
    expect(r.groups).toEqual(['hit']);
    h.d.dispose();
  });
});

describe('Dawnward chime', () => {
  it('plays a chime on the sfx bus', () => {
    const h = harness();
    const r = h.fire(dawnward());
    expect(r.groups).toEqual(['dawnward']);
    expect(r.added).toBeGreaterThan(0);
    expect(r.addedSfx).toBe(r.added);
    h.d.dispose();
  });

  it('is the only sound of the barrier forming: shieldApplied adds nothing', () => {
    const h = harness();
    expect(h.fire(shield()).added).toBe(0);
    const both = h.fire(shield(), dawnward());
    const alone = harness().fire(dawnward());
    expect(both.added).toBe(alone.added);
    expect(both.groups).toEqual(['dawnward']);
    h.d.dispose();
  });

  it('is gated per hero, and stays within its group cap', () => {
    const h = harness();
    for (let i = 0; i < 40; i++) {
      h.fire(dawnward(IDS.kael), dawnward(IDS.lyra), dawnward(IDS.vexis));
      h.advance(0.05);
    }
    expect(h.stats().peakVoices['dawnward'] ?? 0).toBeLessThanOrEqual(3);
    h.d.dispose();
    const g = harness();
    const r = g.fire(dawnward(), dawnward(), dawnward());
    const one = harness().fire(dawnward()).added;
    expect(r.added).toBe(one);
    g.d.dispose();
  });

  it('survives a missing hero', () => {
    const h = harness();
    expect(() => h.fire(dawnward(9999))).not.toThrow();
    h.d.dispose();
  });
});

describe("The Luminary's Sunrise", () => {
  const sources = (calling: { id: string; path: string[] } | null) => {
    const h = harness();
    h.world.setCalling(calling?.id ?? null, calling?.path ?? []);
    const r = h.fire(sunrise());
    h.d.dispose();
    return r;
  };

  it('keeps the ordinary Crescendo for a run without a Calling', () => {
    const r = sources(null);
    expect(r.groups).toEqual(['bigCrescendo']);
  });

  it('adds a high layer only when the Calling is the Luminary', () => {
    const plain = sources(null);
    const lum = sources({ id: 'luminary', path: [] });
    expect(lum.groups).toEqual(expect.arrayContaining(['bigCrescendo', 'bigSunriseLuminary']));
    expect(lum.added).toBeGreaterThan(plain.added);
    // Another Calling (none exist yet) must not get the Luminary's layer.
    const other = sources({ id: 'someone_else', path: ['eclipse'] });
    expect(other.groups).toEqual(['bigCrescendo']);
    expect(other.added).toBe(plain.added);
  });

  it('adds a darker undertone with Eclipse on the path', () => {
    const lum = sources({ id: 'luminary', path: ['haloed', 'dawnward'] });
    const ecl = sources({ id: 'luminary', path: ['haloed', 'dawnward', 'third_voice', 'eclipse'] });
    expect(ecl.groups).toEqual(expect.arrayContaining(['bigCrescendo', 'bigSunriseLuminary']));
    expect(ecl.added).not.toBe(lum.added);
  });

  it('is gated with the Crescendo: a double event makes one Sunrise', () => {
    const h = harness();
    h.world.setCalling('luminary');
    const once = harness();
    once.world.setCalling('luminary');
    const a = once.fire(sunrise()).added;
    const r = h.fire(sunrise(), sunrise());
    expect(r.added).toBe(a);
    h.d.dispose();
    once.d.dispose();
  });

  it('the ordinary Crescendo is unchanged by the Calling machinery', () => {
    const h = harness();
    // A world with no `calling` property at all (older fakes) still works.
    const state = { ...h.world.state } as unknown as WorldState;
    expect(() => h.d.onEvents([sunrise()], state)).not.toThrow();
    h.d.dispose();
  });
});

describe('Phase 3c without an AudioContext', () => {
  it('is a safe no-op in Node', () => {
    const audio = getAudio();
    const world = new FakeWorld();
    world.setCalling('luminary', ['eclipse']);
    expect(() => {
      for (const s of CALLING_UI) audio.playUi(s);
      audio.onEvents(
        [hit(IDS.kael, 12), hit(IDS.kael, 0), dawnward(), shield(), sunrise()],
        world.state,
      );
      audio.onEvents([hit(IDS.kael, 12), dawnward(), sunrise()], {} as WorldState);
    }).not.toThrow();
    audio.dispose();
  });
});

describe('audio lab: Phase 3c buttons', () => {
  const ids = SOUNDS.map((s) => s.id);

  it('has a button for each Calling UI sound and each new combat sound', () => {
    for (const s of CALLING_UI) expect(ids, s).toContain(`ui-${s}`);
    for (const id of [
      'calling-radiant-hit',
      'calling-radiant-big',
      'calling-radiant-burst',
      'calling-radiant-sunrise',
      'calling-dawnward',
      'calling-sunrise-plain',
      'calling-sunrise-luminary',
      'calling-sunrise-eclipse',
    ])
      expect(ids, id).toContain(id);
  });

  it('fires every Calling button without throwing, and each makes a sound', () => {
    const buttons = SOUNDS.filter((s) => s.group === 'calling');
    expect(buttons.length).toBeGreaterThanOrEqual(8);
    for (const s of buttons) {
      const h = harness();
      expect(() => {
        s.fire(h.d, h.world);
        for (const f of s.then ?? []) f.fire(h.d, h.world);
      }, s.id).not.toThrow();
      expect(h.stats().totalSources, s.id).toBeGreaterThan(0);
      h.d.dispose();
    }
  });

  it('the burst button stays within the shimmer cap', () => {
    const burst = SOUNDS.find((s) => s.id === 'calling-radiant-burst');
    const h = harness();
    burst?.fire(h.d, h.world);
    for (const f of burst?.then ?? []) {
      h.advance(0.05);
      f.fire(h.d, h.world);
    }
    expect(h.stats().peakVoices['radiance'] ?? 0).toBeLessThanOrEqual(3);
    expect(h.stats().skipped).toBeGreaterThan(50);
    h.d.dispose();
  });
});
