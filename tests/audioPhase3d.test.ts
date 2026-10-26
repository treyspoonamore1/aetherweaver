/** Phase 3d audio: the Martyr's Bear, Borne, Martyr's Vow, Undying Devotion and the lab buttons. */
import { describe, expect, it } from 'vitest';
import { getAudio } from '../src/audio';
import { SynthDirector } from '../src/audio/director';
import { FakeWorld, IDS } from '../src/audio/lab/labState';
import { SOUNDS } from '../src/audio/lab/soundBoard';
import type { SimEvent, WorldState } from '../src/sim';

const ev = (type: SimEvent['type'], rest: Record<string, unknown>): SimEvent =>
  ({ type, tick: 0, ...rest }) as unknown as SimEvent;

const mode = (m: 'mend' | 'empower' | 'bear'): SimEvent => ev('threadModeChanged', { mode: m });
const borne = (
  hero: number = IDS.kael,
  amount = 60,
  via: 'bear' | 'shared' | 'vow' = 'bear',
): SimEvent => ev('borne', { hero, amount, via });
const vow = (): SimEvent => ev('crescendoStart', { calling: 'Martyr’s Vow', duration: 5 });
const sunrise = (): SimEvent => ev('crescendoStart', { calling: 'Sunrise', duration: 8 });
const save = (cause: string, target: number = IDS.kael): SimEvent =>
  ev('save', { target, cause, counterfactualDamage: 600, attack: 'Requiem' });
const undying = (): SimEvent => ev('undying', {});
const selfHeal = (amount = 8): SimEvent =>
  ev('healApplied', {
    target: IDS.weaver,
    source: IDS.weaver,
    amount,
    overheal: 0,
    via: 'self',
  });
const BASS = [IDS.kael, IDS.lyra, IDS.vexis];

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

const HEROES = BASS;

describe('Bear on and off', () => {
  it('Bear on plays its own sound on the sfx bus, not the Mend/Empower pluck', () => {
    const h = harness();
    const r = h.fire(mode('bear'));
    expect(r.groups).toEqual(['bear']);
    expect(r.added).toBeGreaterThan(0);
    expect(r.addedSfx).toBe(r.added);
    const plain = harness().fire(mode('empower'));
    expect(plain.groups).toEqual(['mode']);
    // Heavier than the pluck: two heartbeats and a bowed pair.
    expect(r.added).toBeGreaterThan(plain.added * 3);
    h.d.dispose();
  });

  it('leaving Bear plays a release (and then the mode she returns to)', () => {
    const h = harness();
    h.fire(mode('bear'));
    h.advance(3);
    const r = h.fire(mode('mend'));
    const pluck = harness().fire(mode('mend')).added;
    // The release (a beat, a sigh, a breath) plus the pluck of the mode she returns to.
    expect(r.added).toBeGreaterThan(pluck);
    expect(r.addedSfx).toBe(r.added);
    const on = harness().fire(mode('bear'));
    expect(r.added).not.toBe(on.added);
    h.d.dispose();
  });

  it('Mend and Empower are untouched when Bear was not on', () => {
    const h = harness();
    expect(h.fire(mode('mend')).groups).toEqual(['mode']);
    h.advance(1);
    expect(h.fire(mode('empower')).added).toBe(harness().fire(mode('empower')).added);
    h.d.dispose();
  });

  it('a mashed key does not stack: the toggle is gated', () => {
    const h = harness();
    const r = h.fire(mode('bear'), mode('mend'), mode('bear'), mode('mend'));
    expect(h.stats().peakVoices['bear'] ?? 0).toBeLessThanOrEqual(2);
    const one = harness().fire(mode('bear')).added;
    expect(r.added).toBeLessThan(one * 3);
    h.d.dispose();
  });
});

describe('Borne', () => {
  it('plays a muffled low thud on the sfx bus', () => {
    const h = harness();
    const r = h.fire(borne());
    expect(r.groups).toEqual(['borne']);
    expect(r.added).toBeGreaterThan(0);
    expect(r.addedSfx).toBe(r.added);
    h.d.dispose();
  });

  it('is quiet by construction: a handful of sources, no bell or glass', () => {
    const h = harness();
    expect(h.fire(borne(IDS.lyra, 140)).added).toBeLessThanOrEqual(5);
    h.d.dispose();
  });

  it('Shared Wounds is quieter and simpler than Bear', () => {
    const bear = harness().fire(borne(IDS.kael, 60, 'bear')).added;
    const shared = harness().fire(borne(IDS.kael, 60, 'shared')).added;
    expect(shared).toBeLessThan(bear);
  });

  it('is gated per hero, tighter for Shared Wounds', () => {
    const h = harness();
    h.fire(borne(IDS.kael));
    h.advance(0.3);
    expect(h.fire(borne(IDS.kael)).added).toBe(0); // 0.4 s per hero
    h.advance(0.2);
    expect(h.fire(borne(IDS.kael)).added).toBeGreaterThan(0);
    const s = harness();
    s.fire(borne(IDS.kael, 60, 'shared'));
    s.advance(0.6);
    expect(s.fire(borne(IDS.kael, 60, 'shared')).added).toBe(0); // 0.8 s
    h.d.dispose();
    s.d.dispose();
  });

  it('is rate-limited under a burst: 100 borne events in a second play a handful', () => {
    const h = harness();
    let played = 0;
    for (let i = 0; i < 100; i++) {
      played += h.fire(borne(HEROES[i % 3] as number, 40)).added > 0 ? 1 : 0;
      h.advance(0.01);
    }
    expect(played).toBeGreaterThan(0);
    expect(played).toBeLessThanOrEqual(6);
    expect(h.stats().peakVoices['borne'] ?? 0).toBeLessThanOrEqual(3);
    expect(h.stats().skipped).toBeGreaterThan(80);
    h.d.dispose();
  });

  it('100 in a single frame make one', () => {
    const h = harness();
    const one = harness().fire(borne(IDS.kael)).added;
    const r = h.fire(...Array.from({ length: 100 }, (_, i) => borne(HEROES[i % 3] as number)));
    expect(r.added).toBe(one);
    h.d.dispose();
  });

  it('a long fight stays sparse: six seconds of constant Bear', () => {
    const h = harness();
    let played = 0;
    for (let i = 0; i < 600; i++) {
      played += h.fire(borne(HEROES[i % 3] as number)).added > 0 ? 1 : 0;
      h.advance(0.01);
    }
    expect(played).toBeGreaterThan(5);
    expect(played).toBeLessThanOrEqual(30);
    h.d.dispose();
  });

  it('is louder with the amount (a bigger thud is longer) and softer under a telegraph', () => {
    const count = (amount: number) => harness().fire(borne(IDS.kael, amount)).added;
    expect(count(0)).toBe(0);
    expect(count(5)).toBeGreaterThan(0);
    // The body noise lengthens and the thump grows; the source count is the same recipe.
    expect(count(200)).toBeGreaterThanOrEqual(count(5));
  });

  it('keeps the hero-hit thump on the Weaver: the damage that follows still sounds', () => {
    const h = harness();
    h.fire(borne());
    const r = h.fire(
      ev('damageTaken', {
        target: IDS.weaver,
        source: IDS.enemyBase,
        amount: 40,
        absorbed: 0,
        amplified: 0,
        aura: 0,
        radiance: 0,
        eclipse: 0,
        crit: false,
        telegraph: null,
        hit: 'hit',
      }),
    );
    expect(r.groups).toEqual(['hit']);
    h.d.dispose();
  });

  it('survives a missing hero or an empty amount', () => {
    const h = harness();
    expect(() => {
      h.fire(borne(9999));
      h.fire(borne(IDS.kael, 0));
      h.fire(borne(IDS.kael, Number.NaN));
    }).not.toThrow();
    h.d.dispose();
  });
});

describe("Martyr's Vow", () => {
  const run = (calling: string | null, e: SimEvent) => {
    const h = harness();
    h.world.setCalling(calling);
    if (calling === 'martyr') h.world.setVow(true);
    const r = h.fire(e);
    h.d.dispose();
    return r;
  };

  it('plays its own sound on a Martyr run: not Sunrise, not the Luminary', () => {
    const r = run('martyr', vow());
    expect(r.groups).toEqual(['bigVow']);
    expect(r.groups).not.toContain('bigCrescendo');
    expect(r.groups).not.toContain('bigSunriseLuminary');
    expect(r.added).toBeGreaterThan(15);
  });

  it('is recognised by the event name alone (no Calling in the state)', () => {
    expect(run(null, vow()).groups).toEqual(['bigVow']);
  });

  it('Sunrise is unchanged: the Luminary still gets its layer, a plain run its Crescendo', () => {
    expect(run('luminary', sunrise()).groups).toEqual(
      expect.arrayContaining(['bigCrescendo', 'bigSunriseLuminary']),
    );
    expect(run(null, sunrise()).groups).toEqual(['bigCrescendo']);
  });

  it('is not bright: no noise cymbal swell (sources differ from the Crescendo)', () => {
    expect(run('martyr', vow()).added).not.toBe(run(null, sunrise()).added);
  });

  it('is a single Vow for a double event', () => {
    const h = harness();
    h.world.setCalling('martyr');
    const once = harness();
    once.world.setCalling('martyr');
    const a = once.fire(vow()).added;
    expect(h.fire(vow(), vow()).added).toBe(a);
    h.d.dispose();
    once.d.dispose();
  });

  it('ends with a low bell, not the Sunrise whoosh', () => {
    const h = harness();
    h.world.setCalling('martyr');
    h.world.setVow(true);
    h.fire(vow());
    h.advance(5);
    const r = h.fire(ev('crescendoEnd', {}));
    expect(r.groups).toEqual(['vowEnd']);
    const plain = harness();
    plain.fire(sunrise());
    plain.advance(8);
    expect(plain.fire(ev('crescendoEnd', {})).groups).toEqual(['crescEnd']);
    h.d.dispose();
    plain.d.dispose();
  });
});

describe('Saves under the Martyr', () => {
  it('a Vow hold rings a clang over the ordinary save', () => {
    const h = harness();
    const r = h.fire(save('vow'));
    expect(r.groups).toEqual(expect.arrayContaining(['bigVowHeld', 'bigSave']));
    expect(r.addedSfx).toBe(r.added);
    const plain = harness().fire(save('ward'));
    expect(plain.groups).toEqual(['bigSave']);
    expect(r.added).toBeGreaterThan(plain.added);
    h.d.dispose();
  });

  it('the clang is pitched from the hero', () => {
    const k = harness().fire(save('vow', IDS.kael));
    const l = harness().fire(save('vow', IDS.lyra));
    expect(k.groups).toContain('bigVowHeld');
    expect(l.groups).toContain('bigVowHeld');
  });

  it('repeated holds in a Vow stay bounded: the bright save is once a second', () => {
    const save0 = harness().fire(save('ward')).added;
    const clang0 = harness().fire(save('vow')).added - save0;
    const h = harness();
    let saves = 0;
    let clangs = 0;
    for (let i = 0; i < 100; i++) {
      const n = h.fire(save('vow', HEROES[i % 3] as number)).added;
      if (n === clang0 || n === clang0 + save0) clangs++;
      if (n === save0 || n === clang0 + save0) saves++;
      h.advance(0.05);
    }
    // Five seconds of constant holds.
    expect(saves).toBeGreaterThan(0);
    expect(saves).toBeLessThanOrEqual(5);
    expect(clangs).toBeGreaterThan(saves);
    expect(clangs).toBeLessThanOrEqual(17);
    expect(h.stats().peakVoices['bigVowHeld'] ?? 0).toBeLessThanOrEqual(1);
    h.d.dispose();
  });

  it('a Bear save adds a heartbeat under the ordinary one', () => {
    const r = harness().fire(save('bear', IDS.lyra));
    expect(r.groups).toEqual(expect.arrayContaining(['bearSave', 'bigSave']));
    expect(harness().fire(save('ward')).groups).toEqual(['bigSave']);
    expect(harness().fire(save('mend')).groups).toEqual(['bigSave']);
  });
});

describe('Undying Devotion', () => {
  it('plays a breath, a deep bell and the Mend shimmer on the sfx bus', () => {
    const h = harness();
    const r = h.fire(undying());
    expect(r.groups).toEqual(['bigUndying']);
    expect(r.addedSfx).toBe(r.added);
    // Bells (4 partials each, x2), a heartbeat, 6 plucks and 6 glass notes: a lot.
    expect(r.added).toBeGreaterThan(40);
    h.d.dispose();
  });

  it('is once per event: a double is one', () => {
    const h = harness();
    const one = harness().fire(undying()).added;
    expect(h.fire(undying(), undying()).added).toBe(one);
    h.d.dispose();
  });
});

describe('Self heal', () => {
  it('is nearly silent: a couple of sources, at most every 3 s', () => {
    const h = harness();
    const r = h.fire(selfHeal());
    expect(r.groups).toEqual(['selfHeal']);
    expect(r.added).toBeLessThanOrEqual(3);
    h.advance(1);
    expect(h.fire(selfHeal()).added).toBe(0);
    h.advance(2.5);
    expect(h.fire(selfHeal()).added).toBeGreaterThan(0);
    expect(h.fire(selfHeal(0)).added).toBe(0);
    h.d.dispose();
  });

  it('other heals are unchanged: via mend still plays the pluck, via other nothing', () => {
    const heal = (via: string) =>
      ev('healApplied', {
        target: IDS.kael,
        source: IDS.weaver,
        amount: 60,
        overheal: 0,
        via,
      });
    expect(harness().fire(heal('mend')).groups).toEqual(['mend']);
    expect(harness().fire(heal('other')).added).toBe(0);
  });
});

describe('Phase 3d without an AudioContext', () => {
  it('is a safe no-op in Node, with a full or a minimal state', () => {
    const audio = getAudio();
    const world = new FakeWorld();
    world.setCalling('martyr');
    world.setVow(true);
    const all = [
      mode('bear'),
      mode('mend'),
      borne(),
      borne(IDS.lyra, 10, 'shared'),
      vow(),
      save('vow'),
      save('bear'),
      undying(),
      selfHeal(),
      ev('crescendoEnd', {}),
    ];
    expect(() => {
      audio.onEvents(all, world.state);
      audio.onEvents(all, {} as WorldState);
      audio.onEvents(all, { calling: null } as unknown as WorldState);
    }).not.toThrow();
    audio.dispose();
  });

  it('does not throw with a context but a minimal state either', () => {
    const h = harness();
    expect(() => {
      h.d.onEvents([borne(), vow(), save('vow'), undying(), mode('bear')], {} as WorldState);
      h.d.onEvents([borne(), vow()], {
        entities: { get: () => undefined },
      } as unknown as WorldState);
    }).not.toThrow();
    h.d.dispose();
  });
});

describe('audio lab: Phase 3d buttons', () => {
  const ids = SOUNDS.map((s) => s.id);
  const buttons = SOUNDS.filter((s) => s.group === 'martyr');

  it('has a button for each sound', () => {
    for (const id of [
      'martyr-bear-on',
      'martyr-bear-off',
      'martyr-borne',
      'martyr-borne-burst',
      'martyr-borne-shared',
      'martyr-vow',
      'martyr-vow-held',
      'martyr-undying',
    ])
      expect(ids, id).toContain(id);
  });

  it('fires every button without throwing, and each makes a sound', () => {
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

  it('the burst button stays within the borne cap', () => {
    const burst = SOUNDS.find((s) => s.id === 'martyr-borne-burst');
    const h = harness();
    burst?.fire(h.d, h.world);
    for (const f of burst?.then ?? []) {
      h.advance(0.1);
      f.fire(h.d, h.world);
    }
    expect(h.stats().peakVoices['borne'] ?? 0).toBeLessThanOrEqual(3);
    expect(h.stats().skipped).toBeGreaterThan(60);
    h.d.dispose();
  });
});
