import { describe, expect, it } from 'vitest';
import { getAudio } from '../src/audio';
import { SynthDirector } from '../src/audio/director';
import { SOUNDS } from '../src/audio/lab/soundBoard';
import { FakeWorld } from '../src/audio/lab/labState';
import type { UiSound } from '../src/audio/types';
import {
  CALL_PHRASES,
  chorusVoicing,
  CHORDS,
  KEY_ROOT_MIDI,
  LEITMOTIFS,
  MELODY_BRIGHT,
  MELODY_DARK,
  PROGRESSION_BRIGHT,
  PROGRESSION_DARK,
  chordNotesInRange,
  chordPitchClasses,
  isInScale,
  leitmotifFor,
  mendPitch,
  midiToHz,
  quantizeToScale,
  scaleMidi,
  snapToChord,
} from '../src/audio/theory';
import type { SimEvent, WorldState } from '../src/sim';

const UI_SOUNDS: UiSound[] = [
  'hover',
  'click',
  'confirm',
  'back',
  'pick',
  'node',
  'error',
  'reward',
  'wheelOpen',
  'wheelPick',
  'reveal',
  'rankUp',
  'unlock',
];

const ev = (type: SimEvent['type'], rest: Record<string, unknown>): SimEvent =>
  ({ type, tick: 0, ...rest }) as unknown as SimEvent;

/** One of each CONTRACT v3 event, with plausible payloads. */
const PHASE2_EVENTS: SimEvent[] = [
  ev('fieldPlanted', { chord: 0, fromX: 0, fromZ: 0, x: 4, z: 0 }),
  ev('chorusPulse', { hero: 2, auras: 4, reached: 3 }),
  ev('fermataHold', { hero: 2, until: 2, attack: 'x', damage: 900 }),
  ev('fermataReleased', { hero: 2, saved: true }),
  ev('callStarted', {
    hero: 2,
    answer: 'ward',
    ability: 'a',
    flourish: 'Bulwark',
    until: 2.5,
    line: '!',
  }),
  ev('callAnswered', { hero: 2, answer: 'ward', flourish: 'Bulwark', after: 1 }),
  ev('callEnded', { hero: 2, reason: 'missed' }),
  ev('flourish', { hero: 2, name: 'Bulwark', x: 0, z: 0, radius: 5 }),
  ev('save', { target: 2, cause: 'fermata', counterfactualDamage: 1, attack: 'x' }),
];

describe('audio director without AudioContext', () => {
  it('is a safe no-op in Node', async () => {
    const audio = getAudio();
    expect(getAudio()).toBe(audio);
    expect(audio.unlocked).toBe(false);
    const state = {} as WorldState;
    const events = [
      { type: 'perfectWard', tick: 0, target: 1, telegraph: null, negated: 1 },
    ] as SimEvent[];
    expect(() => {
      audio.onEvents(events, state);
      audio.update(state, 0.016);
      audio.setMood('combat');
      audio.setMood('boss');
      audio.playUi('click');
      audio.setVolumes({ master: 1, music: 1, sfx: 1, ui: 1 });
      audio.stopCombat();
      audio.onEvents(PHASE2_EVENTS, state);
      for (const u of UI_SOUNDS) audio.playUi(u);
    }).not.toThrow();
    await expect(audio.unlock()).resolves.toBeUndefined();
    expect(audio.unlocked).toBe(false);
    expect(audio.debugStats?.().contextState).toBe('none');
    expect(() => audio.dispose()).not.toThrow();
  });
});

describe('scale and chord helpers', () => {
  it('maps scale-degree indices to D dorian', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7].map(scaleMidi)).toEqual([62, 64, 65, 67, 69, 71, 72, 74]);
    expect(scaleMidi(-1)).toBe(60);
    expect(scaleMidi(-7)).toBe(50);
    expect(midiToHz(69)).toBeCloseTo(440, 6);
  });

  it('quantises to the scale, resolving ties downwards', () => {
    for (let m = 40; m < 100; m++) {
      const q = quantizeToScale(m);
      expect(isInScale(q)).toBe(true);
      expect(Math.abs(q - m)).toBeLessThanOrEqual(1);
      if (isInScale(m)) expect(q).toBe(m);
    }
    expect(quantizeToScale(63)).toBe(62);
    expect(quantizeToScale(66)).toBe(65);
  });

  it('keeps every chord and melody note inside the key', () => {
    for (const chord of Object.values(CHORDS)) {
      for (const pc of chordPitchClasses(chord))
        expect(isInScale(62 + ((pc - 2 + 12) % 12))).toBe(true);
    }
    for (const prog of [PROGRESSION_BRIGHT, PROGRESSION_DARK]) expect(prog).toHaveLength(8);
    for (const phrase of [MELODY_BRIGHT, MELODY_DARK]) {
      expect(phrase).toHaveLength(8);
      for (const bar of phrase) {
        expect(bar).toHaveLength(8);
        for (const idx of bar) if (idx !== null) expect(isInScale(scaleMidi(idx))).toBe(true);
      }
    }
  });

  it('snaps pitches to chord tones in any octave', () => {
    for (const chord of [CHORDS.Dm9, CHORDS.G6, CHORDS.Cmaj7, CHORDS.Am7]) {
      const pcs = new Set(chordPitchClasses(chord));
      for (let m = 50; m < 90; m++) {
        const s = snapToChord(m, chord);
        expect(pcs.has(s % 12)).toBe(true);
        expect(Math.abs(s - m)).toBeLessThanOrEqual(4);
      }
      for (const n of chordNotesInRange(chord, 60, 84)) expect(pcs.has(n % 12)).toBe(true);
    }
  });

  it('Mend pitch rises with the target HP fraction and stays on chord tones', () => {
    for (const chord of [CHORDS.Dm9, CHORDS.G6, CHORDS.Cmaj7, CHORDS.Am7]) {
      let last = -Infinity;
      const pcs = new Set(chordPitchClasses(chord));
      for (let f = 0; f <= 1.0001; f += 0.05) {
        const p = mendPitch(f, chord);
        expect(p).toBeGreaterThanOrEqual(last);
        expect(pcs.has(p % 12)).toBe(true);
        last = p;
      }
      expect(mendPitch(1, chord)).toBeGreaterThan(mendPitch(0, chord));
    }
  });

  it('gives each hero a distinct 3–5 note leitmotif in key', () => {
    const seen = new Set<string>();
    for (const id of ['kael', 'lyra', 'vexis']) {
      const m = leitmotifFor(id);
      expect(m.notes.length).toBeGreaterThanOrEqual(3);
      expect(m.notes.length).toBeLessThanOrEqual(5);
      for (const n of m.notes) expect(isInScale(scaleMidi(n.idx))).toBe(true);
      seen.add(m.notes.map((n) => n.idx).join(','));
    }
    expect(seen.size).toBe(3);
    expect(Object.keys(LEITMOTIFS)).toEqual(['kael', 'lyra', 'vexis']);
    expect(leitmotifFor('nobody')).toBe(LEITMOTIFS['kael']);
  });
});

// ── A recording fake AudioContext ────────────────────────────────────────────────────

type Fake = Record<string, unknown>;

function fakeNode(): Fake {
  const base: Fake = {
    connect: (to: unknown) => to,
    disconnect: () => undefined,
    start: () => undefined,
    stop: () => undefined,
  };
  // Any other property read (frequency, gain, Q, pan…) is an AudioParam stand-in.
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
  oscillators = 0;
  [k: string]: unknown;
  constructor() {
    for (const name of [
      'createGain',
      'createDynamicsCompressor',
      'createWaveShaper',
      'createConvolver',
      'createBiquadFilter',
      'createStereoPanner',
    ])
      this[name] = () => fakeNode();
    this['createOscillator'] = () => {
      this.oscillators++;
      return fakeNode();
    };
    this['createBufferSource'] = () => fakeNode();
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
  const sources = () => d.debugStats().totalSources;
  /** Fires events and returns the voice groups they created and the sources they added. */
  const fire = (...events: SimEvent[]) => {
    const before = { ...d.debugStats().peakVoices };
    const n = sources();
    d.onEvents(events, world.state);
    const after = d.debugStats().peakVoices;
    const groups = Object.keys(after).filter((k) => (after[k] ?? 0) > (before[k] ?? 0));
    return { groups, added: sources() - n };
  };
  const advance = (dt: number) => {
    ctx.currentTime += dt;
    d.pump();
  };
  return { ctx, d, world, fire, advance, sources };
}

describe('Phase 2 events: sound mapping', () => {
  it('makes a sound for every new event, in the right voice group', () => {
    const cases: [SimEvent, string][] = [
      [PHASE2_EVENTS[0] as SimEvent, 'pedal'],
      [PHASE2_EVENTS[1] as SimEvent, 'chorus'],
      [PHASE2_EVENTS[2] as SimEvent, 'bigFermata'],
      [PHASE2_EVENTS[3] as SimEvent, 'fermataEnd'],
      [PHASE2_EVENTS[4] as SimEvent, 'callQ'],
      [PHASE2_EVENTS[5] as SimEvent, 'callA'],
      [PHASE2_EVENTS[6] as SimEvent, 'callEnd'],
      [PHASE2_EVENTS[7] as SimEvent, 'bigFlourish'],
    ];
    for (const [event, group] of cases) {
      const h = harness();
      const r = h.fire(event);
      expect(r.groups, event.type).toContain(group);
      expect(r.added, event.type).toBeGreaterThan(0);
      h.d.dispose();
    }
  });

  it('adds the ghost swell under the Save', () => {
    const plain = harness();
    const a = plain.fire(
      ev('save', { target: 2, cause: 'ward', counterfactualDamage: 1, attack: 'x' }),
    );
    expect(a.groups).toContain('bigSave');
    // The phrase is 3 notes of pluck + 4 glass partials + whoosh; the ghost adds 3 sines + noise.
    expect(a.added).toBeGreaterThan(20);
    plain.d.dispose();
  });

  it('plays all three flourishes, each with its own recipe', () => {
    const counts = new Set<number>();
    for (const [hero, name] of [
      [2, 'Bulwark'],
      [3, 'Heartseeker'],
      [4, 'Resonant Starbolt'],
    ] as const) {
      const h = harness();
      const r = h.fire(ev('flourish', { hero, name, x: 0, z: 0, radius: 4 }));
      expect(r.groups).toContain('bigFlourish');
      counts.add(r.added);
      h.d.dispose();
    }
    expect(counts.size).toBeGreaterThan(1);
  });

  it('answers a call with a different sound per answer, and fades the question', () => {
    for (const answer of ['ward', 'empower', 'chime'] as const) {
      const h = harness();
      h.fire(
        ev('callStarted', { hero: 3, answer, ability: 'a', flourish: 'f', until: 2.8, line: '' }),
      );
      h.advance(0.5);
      const r = h.fire(ev('callAnswered', { hero: 3, answer, flourish: 'f', after: 0.5 }));
      expect(r.groups).toContain('callA');
      h.d.dispose();
    }
  });

  it('a cancelled call is quieter than a missed one, and both are handled', () => {
    const h = harness();
    const missed = h.fire(ev('callEnded', { hero: 2, reason: 'missed' }));
    h.advance(1);
    const cancelled = h.fire(ev('callEnded', { hero: 2, reason: 'cancelled' }));
    expect(missed.added).toBeGreaterThan(cancelled.added);
    expect(cancelled.added).toBeGreaterThan(0);
    h.d.dispose();
  });

  it('holds the music during a Fermata and releases it for both outcomes', () => {
    for (const saved of [true, false]) {
      const h = harness();
      const music = h.d.musicEngine();
      expect(music?.holding).toBe(false);
      h.fire(ev('fermataHold', { hero: 2, until: 2, attack: 'x', damage: 1 }));
      expect(music?.holding).toBe(true);
      h.advance(0.5);
      h.fire(ev('fermataReleased', { hero: 2, saved }));
      expect(music?.holding).toBe(false);
      h.d.dispose();
    }
  });

  it('a hold that never gets its release ends on its own', () => {
    const h = harness();
    const music = h.d.musicEngine();
    h.fire(ev('fermataHold', { hero: 2, until: 1, attack: 'x', damage: 1 }));
    expect(music?.holding).toBe(true);
    h.advance(5);
    expect(music?.holding).toBe(false);
    h.d.dispose();
  });

  it('keeps voice counts under their caps when events are spammed', () => {
    const h = harness();
    for (let i = 0; i < 40; i++) {
      for (const e of PHASE2_EVENTS) h.fire(e);
      h.advance(0.02);
    }
    const peaks = h.d.debugStats().peakVoices;
    expect(peaks['callQ'] ?? 0).toBeLessThanOrEqual(3);
    expect(peaks['callA'] ?? 0).toBeLessThanOrEqual(3);
    expect(peaks['bigFlourish'] ?? 0).toBeLessThanOrEqual(2);
    expect(peaks['chorus'] ?? 0).toBeLessThanOrEqual(1);
    expect(peaks['bigFermata'] ?? 0).toBeLessThanOrEqual(2);
    h.d.dispose();
  });

  it('plays the three new UI sounds on the UI bus', () => {
    for (const sound of ['wheelOpen', 'wheelPick', 'reveal', 'rankUp', 'unlock'] as const) {
      const h = harness();
      const before = h.d.debugStats().activeSources.ui;
      h.d.playUi(sound);
      expect(h.d.debugStats().activeSources.ui, sound).toBeGreaterThan(before);
      expect(h.d.debugStats().peakVoices[`ui:${sound}`], sound).toBe(1);
      h.d.dispose();
    }
  });

  it('every lab button for the new sounds fires without throwing', () => {
    for (const s of SOUNDS.filter((b) => b.group === 'phase2' || b.id.startsWith('ui-'))) {
      const h = harness();
      expect(() => {
        s.fire(h.d, h.world);
        for (const f of s.then ?? []) f.fire(h.d, h.world);
      }, s.id).not.toThrow();
      expect(h.sources(), s.id).toBeGreaterThan(0);
      h.d.dispose();
    }
  });
});

describe('Phase 2 continuous layers', () => {
  it('runs a quiet pedal drone only while a planted Chord stands', () => {
    const h = harness();
    h.d.update(h.world.state, 0.016);
    const idle = h.ctx.oscillators;
    h.world.setChords(true, false);
    h.d.update(h.world.state, 0.016);
    expect(h.ctx.oscillators).toBeGreaterThanOrEqual(idle + 3);
    const withDrone = h.ctx.oscillators;
    h.d.update(h.world.state, 0.016);
    expect(h.ctx.oscillators).toBe(withDrone);
    h.world.setChords(false, false);
    h.d.update(h.world.state, 0.016);
    h.advance(4);
    h.d.update(h.world.state, 0.016);
    h.world.setChords(true, false);
    h.d.update(h.world.state, 0.016);
    expect(h.ctx.oscillators).toBeGreaterThanOrEqual(withDrone + 3);
    h.d.dispose();
  });

  it('harmonises the thread hum when a Chord rides the Thread', () => {
    const h = harness();
    h.d.update(h.world.state, 0.016);
    const idle = h.ctx.oscillators;
    h.world.setChords(false, 3);
    h.d.update(h.world.state, 0.016);
    expect(h.ctx.oscillators).toBe(idle + 2);
    h.d.dispose();
  });

  it('pours musically when the beam moves while a beam song sings, and not otherwise', () => {
    const h = harness();
    const attach = ev('threadAttached', { hero: 2, slot: 1 });
    h.d.onEvents([attach], h.world.state);
    const plain = h.d.debugStats().peakVoices['pour'] ?? 0;
    expect(plain).toBe(0);
    h.world.setChords(false, 2);
    h.d.onEvents([attach], h.world.state);
    expect(h.d.debugStats().peakVoices['pour']).toBe(1);
    h.d.dispose();
  });

  it('keeps passive aura heals silent', () => {
    const h = harness();
    const before = h.sources();
    h.d.onEvents(
      [ev('healApplied', { target: 2, source: 1, amount: 3, overheal: 0, via: 'aura' })],
      h.world.state,
    );
    expect(h.sources()).toBe(before);
    h.d.dispose();
  });

  it('tolerates a field without chords (older states, the lab, tests)', () => {
    const h = harness();
    const bare = { ...h.world.state, field: undefined } as unknown as typeof h.world.state;
    expect(() => h.d.update(bare, 0.016)).not.toThrow();
    h.d.dispose();
  });

  it('the music clock exposes a grid for quantising answers', () => {
    const h = harness();
    const music = h.d.musicEngine();
    const t = music?.gridAfter(0.07, 2) ?? 0;
    expect(t).toBeGreaterThanOrEqual(h.ctx.currentTime + 0.07 - 1e-6);
    expect(t).toBeLessThanOrEqual(h.ctx.currentTime + 0.07 + 0.341 + 1e-6);
    h.d.dispose();
  });
});

describe('Call and Response theory', () => {
  it('asks each hero question in key, ending off the tonic, and resolves to a D', () => {
    for (const id of ['kael', 'lyra', 'vexis']) {
      const q = CALL_PHRASES[id];
      const m = LEITMOTIFS[id];
      expect(q, id).toBeDefined();
      if (!q || !m) continue;
      for (const n of q.notes) expect(isInScale(scaleMidi(n.idx))).toBe(true);
      const last = q.notes[q.notes.length - 1];
      expect(last).toBeDefined();
      // Unresolved: the phrase ends on a degree that isn't the tonic D…
      expect((scaleMidi(last?.idx ?? 0) - KEY_ROOT_MIDI + 120) % 12).not.toBe(0);
      // …but resolves, by the Weaver's answer, to a D.
      expect((scaleMidi(q.resolve) - KEY_ROOT_MIDI + 120) % 12).toBe(0);
      // It is recognisably the hero's own motif: it starts the same way.
      expect(q.notes[0]?.idx).toBe(m.notes[0]?.idx);
      expect(q.voice).toBe(m.voice);
    }
  });

  it('grows the Chorus Pulse voicing with the aura count, always in key', () => {
    for (const root of [CHORDS.Dm9.root, CHORDS.G6.root, CHORDS.Cmaj7.root, CHORDS.Am7.root]) {
      let last = 0;
      for (const auras of [3, 4, 5, 6]) {
        const v = chorusVoicing(root, auras);
        expect(v).toHaveLength(auras);
        expect(v.length).toBeGreaterThan(last);
        last = v.length;
        for (const m of v) expect(isInScale(m)).toBe(true);
        expect(v[0] ? v[0] % 12 : -1).toBe(root % 12);
        expect([...v].sort((a, b) => a - b)).toEqual(v);
      }
      // 3 auras: a triad (root, 3rd, 5th); 4 auras adds the 9th.
      const triad = chorusVoicing(root, 3).map((m) => m - (chorusVoicing(root, 3)[0] ?? 0));
      expect(triad[2]).toBe(7);
      const four = chorusVoicing(root, 4);
      expect((four[3] ?? 0) - (four[0] ?? 0)).toBeGreaterThanOrEqual(13);
    }
  });
});
