/** Phase 3b audio: the ten shop/forge/event/relic UI sounds and the relic combat sounds. */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getAudio } from '../src/audio';
import { SynthDirector } from '../src/audio/director';
import { FakeWorld, IDS } from '../src/audio/lab/labState';
import { SOUNDS } from '../src/audio/lab/soundBoard';
import { RELIC_SOUND_GROUPS } from '../src/audio/sfx';
import { UI_SOUND_NAMES } from '../src/audio/ui';
import type { UiSound } from '../src/audio/types';
import { KNOWN_RELICS } from '../src/sim/mods';
import type { SimEvent, WorldState } from '../src/sim';

const PHASE_3B_UI: UiSound[] = [
  'buy',
  'cantAfford',
  'forge',
  'eventOpen',
  'gambleWin',
  'gambleLose',
  'relicReveal',
  'relicPick',
  'curseLifted',
  'aether',
];

const ev = (type: SimEvent['type'], rest: Record<string, unknown>): SimEvent =>
  ({ type, tick: 0, ...rest }) as unknown as SimEvent;
const relicEv = (relic: string, hero: number | null = IDS.kael): SimEvent =>
  ev('relicTriggered', { relic, hero });
const perfect = (): SimEvent => ev('perfectWard', { target: IDS.kael, telegraph: 1, negated: 400 });

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

/** Every `relic: 'id'` the sim pushes in a relicTriggered event, read from its sources. */
function simEmittedRelics(): string[] {
  const found = new Set<string>();
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (p.endsWith('.ts')) {
        const src = readFileSync(p, 'utf8');
        for (const m of src.matchAll(/type:\s*'relicTriggered'[^}]*?relic:\s*'([a-z_]+)'/gs))
          found.add(m[1] as string);
      }
    }
  };
  walk(join(__dirname, '..', 'src', 'sim'));
  return [...found].sort();
}

describe('Phase 3b UI sounds', () => {
  it('lists every UiSound, and no stand-ins remain', () => {
    expect(new Set(UI_SOUND_NAMES).size).toBe(UI_SOUND_NAMES.length);
    for (const s of PHASE_3B_UI) expect(UI_SOUND_NAMES, s).toContain(s);
    const src = readFileSync(join(__dirname, '..', 'src', 'audio', 'ui.ts'), 'utf8');
    expect(src).not.toMatch(/STAND_INS/);
    // Each name has a `case '<name>':` of its own in the recipe switch.
    for (const s of UI_SOUND_NAMES) expect(src, s).toMatch(new RegExp(`case '${s}':`));
  });

  it('gives each sound its own voice group on the UI bus', () => {
    for (const sound of UI_SOUND_NAMES) {
      const h = harness();
      const before = h.stats().activeSources.ui;
      h.d.playUi(sound);
      expect(h.stats().activeSources.ui, sound).toBeGreaterThan(before);
      expect(h.stats().peakVoices[`ui:${sound}`], sound).toBe(1);
      // Nothing was borrowed: only this sound's own group opened.
      const groups = Object.keys(h.stats().peakVoices).filter((k) => k.startsWith('ui:'));
      expect(groups, sound).toEqual([`ui:${sound}`]);
      h.d.dispose();
    }
  });

  it('builds the ten new sounds differently from each other', () => {
    const counts = new Map<number, UiSound[]>();
    for (const sound of PHASE_3B_UI) {
      const h = harness();
      h.d.playUi(sound);
      const n = h.stats().totalSources;
      counts.set(n, [...(counts.get(n) ?? []), sound]);
      h.d.dispose();
    }
    // Some recipes may share a source count by chance, but never most of them.
    expect(counts.size).toBeGreaterThanOrEqual(6);
  });

  it('rate-gates the sounds that can be called in a run (aether, relicReveal)', () => {
    for (const sound of ['aether', 'relicReveal'] as const) {
      const h = harness();
      for (let i = 0; i < 30; i++) h.d.playUi(sound);
      expect(h.stats().peakVoices[`ui:${sound}`], sound).toBe(1);
      h.advance(0.5);
      h.d.playUi(sound);
      expect(h.stats().peakVoices[`ui:${sound}`], sound).toBeLessThanOrEqual(2);
      h.d.dispose();
    }
  });

  it('keeps the brief, repeated sounds short and the long ones capped', () => {
    const h = harness();
    for (let i = 0; i < 40; i++) {
      for (const s of PHASE_3B_UI) h.d.playUi(s);
      h.advance(0.02);
    }
    for (const s of PHASE_3B_UI)
      expect(h.stats().peakVoices[`ui:${s}`] ?? 0, s).toBeLessThanOrEqual(3);
    h.d.dispose();
  });
});

describe('relic combat sounds', () => {
  it('covers every relic id the sim emits, and only known relics', () => {
    const emitted = simEmittedRelics();
    // The sim sources really do emit the seven visible relics (guards the scan itself).
    expect(emitted).toEqual(
      [
        'cantors_hymnal',
        'cracked_metronome',
        'glass_halo',
        'lantern_of_the_lost',
        'martyrs_veil',
        'silver_thimble',
        'tuning_fork',
      ].sort(),
    );
    for (const id of emitted) expect(RELIC_SOUND_GROUPS[id], id).toBeTruthy();
    for (const id of Object.keys(RELIC_SOUND_GROUPS)) expect(KNOWN_RELICS, id).toContain(id);
  });

  it('plays each relic on the sfx bus in its own voice group', () => {
    for (const [id, group] of Object.entries(RELIC_SOUND_GROUPS)) {
      const h = harness();
      const r = h.fire(relicEv(id, id === 'cantors_hymnal' ? null : IDS.kael));
      expect(r.groups, id).toEqual([group]);
      expect(r.added, id).toBeGreaterThan(0);
      expect(r.addedSfx, id).toBe(r.added);
      h.d.dispose();
    }
    expect(new Set(Object.values(RELIC_SOUND_GROUPS)).size).toBe(
      Object.keys(RELIC_SOUND_GROUPS).length,
    );
  });

  it('is silent and safe for unknown relics, missing heroes and odd payloads', () => {
    const h = harness();
    expect(h.fire(relicEv('featherweight_robes')).added).toBe(0);
    expect(h.fire(relicEv('nobody_knows')).added).toBe(0);
    expect(() => {
      h.fire(relicEv('silver_thimble', 9999));
      h.fire(relicEv('martyrs_veil', null));
      h.fire(relicEv('tuning_fork', null));
    }).not.toThrow();
    h.d.dispose();
  });

  it('holds under a burst: 20 Silver Thimble triggers in a second', () => {
    const single = harness();
    const one = single.fire(relicEv('silver_thimble')).added;
    expect(one).toBeGreaterThan(0);
    single.d.dispose();

    // All 20 in one frame: only the first passes the gate.
    const same = harness();
    const r = same.fire(...Array.from({ length: 20 }, () => relicEv('silver_thimble')));
    expect(r.added).toBe(one);

    // 20 spread over a second: a handful of ticks, never 20 voices.
    const h = harness();
    let total = 0;
    for (let i = 0; i < 20; i++) {
      total += h.fire(relicEv('silver_thimble', i % 2 ? IDS.lyra : IDS.vexis)).added;
      h.advance(0.05);
    }
    expect(total).toBeGreaterThan(one);
    expect(total).toBeLessThanOrEqual(one * 4);
    expect(h.stats().peakVoices['relic:thimble'] ?? 0).toBeLessThanOrEqual(2);
    same.d.dispose();
    h.d.dispose();
  });

  it('caps every relic group when all relic events are spammed', () => {
    const h = harness();
    const all = Object.keys(RELIC_SOUND_GROUPS).map((id) => relicEv(id));
    for (let i = 0; i < 60; i++) {
      h.fire(...all, perfect());
      h.advance(0.03);
    }
    const peaks = h.stats().peakVoices;
    expect(peaks['relic:thimble'] ?? 0).toBeLessThanOrEqual(2);
    for (const [id, group] of Object.entries(RELIC_SOUND_GROUPS))
      if (id !== 'silver_thimble') expect(peaks[group] ?? 0, group).toBeLessThanOrEqual(1);
    // The rate gates did the work: most of the 60 x 8 events were skipped.
    expect(h.stats().skipped).toBeGreaterThan(100);
    h.d.dispose();
  });

  it('layers under the Perfect Ward without replacing it', () => {
    const h = harness();
    const r = h.fire(
      relicEv('cracked_metronome'),
      perfect(),
      relicEv('tuning_fork'),
      relicEv('glass_halo'),
    );
    expect(r.groups).toEqual(
      expect.arrayContaining(['bigPerfect', 'relic:metronome', 'relic:fork', 'relic:halo']),
    );
    h.d.dispose();
  });

  it('answers a Glide refused by Heavy Score with its own thud, not the generic error', () => {
    const locked = harness().fire(
      ev('techniqueRejected', { technique: 'glide', reason: 'locked' }),
    );
    expect(locked.groups).toEqual(['rejectLocked']);
    expect(locked.added).toBeGreaterThan(0);
    const cooldown = harness().fire(
      ev('techniqueRejected', { technique: 'glide', reason: 'cooldown' }),
    );
    expect(cooldown.groups).toEqual(['reject']);
    // A locked Thread keeps the generic sound.
    const thread = harness().fire(
      ev('techniqueRejected', { technique: 'thread', reason: 'locked' }),
    );
    expect(thread.groups).toEqual(['reject']);
    // Mashing the key does not stack.
    const h = harness();
    for (let i = 0; i < 30; i++) {
      h.fire(ev('techniqueRejected', { technique: 'glide', reason: 'locked' }));
      h.advance(0.02);
    }
    expect(h.stats().peakVoices['rejectLocked'] ?? 0).toBeLessThanOrEqual(2);
    h.d.dispose();
  });
});

describe('Phase 3b without an AudioContext', () => {
  it('is a safe no-op in Node', () => {
    const audio = getAudio();
    const state = {} as WorldState;
    expect(() => {
      for (const s of UI_SOUND_NAMES) audio.playUi(s);
      for (const id of [...Object.keys(RELIC_SOUND_GROUPS), 'unknown'])
        audio.onEvents([relicEv(id), relicEv(id, null)], state);
      audio.onEvents([ev('techniqueRejected', { technique: 'glide', reason: 'locked' })], state);
    }).not.toThrow();
    audio.dispose();
  });
});

describe('audio lab: Phase 3b buttons', () => {
  it('has a button for every UI sound and every relic', () => {
    const ids = new Set(SOUNDS.map((s) => s.id));
    for (const s of UI_SOUND_NAMES) expect(ids.has(`ui-${s}`), s).toBe(true);
    for (const id of Object.keys(RELIC_SOUND_GROUPS)) expect(ids.has(`relic-${id}`), id).toBe(true);
    expect(ids.has('relic-glide-locked')).toBe(true);
    expect(ids.has('relic-thimble-burst')).toBe(true);
  });

  it('fires every new button without throwing, and each makes a sound', () => {
    const buttons = SOUNDS.filter(
      (s) => s.group === 'relic' || PHASE_3B_UI.some((u) => s.id === `ui-${u}`),
    );
    expect(buttons.length).toBeGreaterThanOrEqual(PHASE_3B_UI.length + 7);
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
});
