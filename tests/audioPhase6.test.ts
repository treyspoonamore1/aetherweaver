/**
 * Phase 6 audio (docs/phase-6.md, W6): Tyrant, Mimicry and the Postlude in the mix, and the
 * Atlas's UI sounds. The sim does not set `enemy.tyrant` or `field.finale.postlude`, nor emit
 * `tyrantEdict`, `postludeRose` or `postludePair`, in this tree yet (W1 builds them), so the
 * checks feed the real director the lab world's stand-ins with W0's shapes, and a real sim for
 * Mimicking.
 *
 * Covered: the edict's sound; a Tyrant cast sounding exactly as the foe's attack does, with the
 * boss's voice added under it (and only for the held attack, never in Stasis), by the boss's
 * material; the Postlude's rise (the eight rings' notes, D4 to D5) and its pair Cue (two voices,
 * the second answering); the Crucible's stems reopening from the bottom through the rise, then
 * re-voiced (the whole choir, the melody in pairs, the top layer once enraged); the music input
 * absent without a Postlude; Mimicking's mirror on Movement I and II enemies; the four Atlas UI
 * sounds, in D dorian, under their gates and caps. The Spire and Rift are pinned byte for byte by
 * tests/audioSpireSnapshot and tests/audioRiftSnapshot.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SynthDirector } from '../src/audio/director';
import {
  DISSONANCE_SOUND_GROUPS,
  DISSONANCE_SOUND_LIMITS,
  RISE_NOTES,
  TYRANT_VOICE_PEAK,
  postludeInput,
} from '../src/audio/dissonance';
import { FakeWorld, IDS, ev } from '../src/audio/lab/labState';
import { SOUNDS } from '../src/audio/lab/soundBoard';
import { postludeRiseNotes, silenceStems } from '../src/audio/music';
import { SfxEngine } from '../src/audio/sfx';
import { isInScale, midiToHz, scaleMidi } from '../src/audio/theory';
import { ATLAS_LIMITS, UI_SOUND_NAMES, starsLit } from '../src/audio/ui';
import type { UiSound } from '../src/audio/types';
import { ALTO, BASS, CONDUCTOR, DOWNBEAT, SFORZANDO, SOLOS } from '../src/content/crucibleIds';
import { createSim, tyrantAttackOf, type Sim, type SimEvent, type WorldState } from '../src/sim';
import { makeBot } from '../src/bots';
import { dealDamage } from '../src/sim/combat/health';
import { spawnEnemy } from '../src/sim/systems/enemies';
import { SCENARIO_BELLWARDEN, SCENARIO_CONDUCTOR } from '../tools/scenarios';
import { sandbox, spawn, worldOf } from './sim/helpers';

// ── A recording fake AudioContext (as tests/audioFill.test.ts) ──────────────────────────

type Fake = Record<string, unknown>;

interface Source {
  kind: 'osc' | 'noise';
  freqs: number[];
  starts: number[];
  stops: number[];
}

const stopOf = (s: Source) => s.stops[s.stops.length - 1] ?? Infinity;

class RecordingContext {
  currentTime = 1;
  sampleRate = 8000;
  state = 'running';
  outputLatency = 0;
  readonly sources: Source[] = [];
  readonly levels: { node: number; v: number }[] = [];
  nodes = 0;
  destination: Fake;
  private readonly live: { node: Fake; source: Source; ended: boolean }[] = [];
  [k: string]: unknown;

  private param(record?: (v: number) => void, ramps = false): Fake {
    const ramp = (v: number) => (ramps ? record?.(v) : undefined);
    return {
      value: 0,
      setValueAtTime: (v: number) => record?.(v),
      linearRampToValueAtTime: ramp,
      exponentialRampToValueAtTime: ramp,
      setTargetAtTime: ramp,
      cancelScheduledValues: () => undefined,
    };
  }

  private fakeNode(source?: Source): Fake {
    const id = this.nodes++;
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
    if (source?.kind === 'osc') base['frequency'] = this.param((v) => source.freqs.push(v));
    base['gain'] = this.param((v) => this.levels.push({ node: id, v }), true);
    return new Proxy(base, {
      get: (target, key: string) => {
        if (!(key in target)) target[key] = this.param();
        return target[key];
      },
    });
  }

  endDue(): void {
    for (const l of this.live) {
      if (l.ended || stopOf(l.source) > this.currentTime) continue;
      l.ended = true;
      const cb = l.node['onended'];
      if (typeof cb === 'function') (cb as () => void)();
    }
  }

  constructor() {
    this.destination = this.fakeNode();
    for (const name of [
      'createDynamicsCompressor',
      'createWaveShaper',
      'createConvolver',
      'createBiquadFilter',
      'createStereoPanner',
      'createGain',
    ])
      this[name] = () => this.fakeNode();
    for (const [name, kind] of [
      ['createOscillator', 'osc'],
      ['createBufferSource', 'noise'],
    ] as const)
      this[name] = () => {
        const s: Source = { kind, freqs: [], starts: [], stops: [] };
        this.sources.push(s);
        const node = this.fakeNode(s);
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

/** Cents from the nearest D dorian pitch. */
const centsOff = (hz: number) => {
  const midi = 69 + 12 * Math.log2(hz / 440);
  let best = Infinity;
  for (let m = Math.floor(midi) - 1; m <= Math.ceil(midi) + 1; m++)
    if (isInScale(m)) best = Math.min(best, Math.abs(midi - m) * 100);
  return best;
};
/** In D dorian, or one of the recipes' own partials over a note that is (glass, bells, horn, brass). */
const PARTIALS = [1, 2.32, 4.25, 6.63, 2.01, 3.0, 4.16, 0.5, 2.76, 5.4, 8.93, 0.4, 2, 4];
const inKey = (f: number) => PARTIALS.some((r) => centsOff(f / r) < 3);
const freqsOf = (sources: Source[]) => sources.flatMap((s) => s.freqs);
const hz = (idx: number) => midiToHz(scaleMidi(idx));
const near = (s: Source, f: number) => s.freqs.some((x) => Math.abs(x - f) < 0.01);

/** A lab harness (the FakeWorld and the real director): events in, what they made out. */
function lab(world = new FakeWorld()) {
  const ctx = new RecordingContext();
  const d = new SynthDirector({
    context: ctx as unknown as BaseAudioContext,
    autoPump: false,
    installUnlock: false,
    followSettings: false,
  });
  d.setMood('combat');
  d.pump();
  const stats = () => d.debugStats();
  const fire = (...events: SimEvent[]) => {
    const before = { ...stats().peakVoices };
    const from = ctx.sources.length;
    const fromNode = ctx.nodes;
    const fromLevel = ctx.levels.length;
    d.onEvents(events, world.state);
    const after = stats().peakVoices;
    const mine = ctx.levels.slice(fromLevel).filter((l) => l.node >= fromNode);
    return {
      groups: Object.keys(after).filter((k) => (after[k] ?? 0) > (before[k] ?? 0)),
      sources: ctx.sources.slice(from),
      peak: Math.max(0, ...mine.map((l) => l.v)),
    };
  };
  const advance = (dt: number) => {
    ctx.currentTime += dt;
    ctx.endDue();
    world.advance(dt);
    d.pump();
  };
  /** Steps the director and the world `seconds` on (0.1 s frames, as the game's update). */
  const run = (seconds: number) => {
    const n = Math.round(seconds / 0.1);
    for (let i = 0; i < n; i++) {
      advance(0.1);
      d.update(world.state, 0.1);
    }
  };
  const dis = () => d.sfxEngine()!.dissonance;
  return { ctx, d, world, fire, advance, run, stats, dis };
}

/** A telegraph of `attack` from `owner` in the lab world, and its `telegraphStarted`. */
function cast(w: FakeWorld, id: number, owner: number, attack: string, windup = 1.6): SimEvent {
  const t = w.addTelegraph(id, windup, { attackId: attack, name: attack });
  t.owner = owner;
  return ev('telegraphStarted', {
    telegraph: id,
    owner,
    target: IDS.kael,
    name: attack,
    kind: t.kind,
    shape: t.shape,
    start: t.start,
    impact: t.impact,
    perfectFrom: t.perfectFrom,
    damage: t.damage,
    pctMaxHp: 0,
    answers: t.answers,
    effect: 'damage',
  });
}

/** The boss's lab entity (its `enemy.tyrant` to stage or take off). */
const enemyOf = (w: FakeWorld, id: number) =>
  w.entities.get(id)!.enemy as { tyrant?: unknown; defId?: string };

/** A boss's hold for a phase, from the sim's own table: [foe, attack]. */
function entry(boss: string, phase: number): [string, string] {
  const e = tyrantAttackOf(boss, phase);
  if (!e) throw new Error(`no Tyrant entry for ${boss} ${phase}`);
  return [e.from, e.attack];
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('the Phase 6 limits', () => {
  it('every group has a gate and a cap; only the rise is a big moment', () => {
    for (const g of Object.keys(
      DISSONANCE_SOUND_GROUPS,
    ) as (keyof typeof DISSONANCE_SOUND_GROUPS)[]) {
      const [gate, cap] = DISSONANCE_SOUND_LIMITS[g];
      expect(gate, g).toBeGreaterThan(0);
      expect(cap, g).toBeGreaterThanOrEqual(1);
      expect(DISSONANCE_SOUND_GROUPS[g].startsWith('big'), g).toBe(g === 'rise');
    }
    for (const i of RISE_NOTES) expect(isInScale(scaleMidi(i))).toBe(true);
    expect(RISE_NOTES).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });
});

describe('Tyrant, heard', () => {
  it('the edict: a horn fifth under a struck crown, in D dorian, in its group, ducking the music', () => {
    const h = lab();
    const [from, attack] = entry('the_bellwarden', 1);
    const boss = h.world.addTyrant('the_bellwarden', from, attack, 2);
    const out = h.fire(ev('tyrantEdict', { boss, phase: 1, attack, from }));
    expect(out.groups).toEqual([DISSONANCE_SOUND_GROUPS.edict]);
    expect(out.sources.length).toBeGreaterThan(0);
    for (const f of freqsOf(out.sources)) expect(inKey(f), f.toFixed(1)).toBe(true);
    expect(out.sources.some((s) => near(s, hz(-14)))).toBe(true);
    expect(out.sources.some((s) => near(s, hz(7)))).toBe(true);
    expect(h.dis().asked.edict).toBe(1);
    // One a phase: a second at once is gated.
    expect(h.fire(ev('tyrantEdict', { boss, phase: 1, attack, from })).sources.length).toBe(0);
    h.d.dispose();
  });

  /** Each boss's hold in a phase, read from the sim's own table: porcelain, iron, cloth, cloth, glass. */
  const BOSSES: [string, string, string][] = (
    [
      ['the_bellwarden', 1],
      ['vharun_crimson_warden', 1],
      ['the_seamstress', 2],
      ['the_unweaver', 1],
      [CONDUCTOR, 1],
    ] as const
  ).map(([boss, phase]) => [boss, ...entry(boss, phase)]);

  for (const [boss, from, attack] of BOSSES)
    it(`${boss}'s ${attack}: the foe's own sound, with the boss's voice under it`, () => {
      // The same cast without the hold (the attack's sound as any caster of it makes it) …
      const plain = lab();
      const p = plain.world.addTyrant(boss, from, attack, 2);
      delete enemyOf(plain.world, p).tyrant;
      const without = plain.fire(cast(plain.world, 700, p, attack));
      // … and with it.
      const h = lab();
      const id = h.world.addTyrant(boss, from, attack, 2);
      const withHold = h.fire(cast(h.world, 700, id, attack));
      expect(withHold.groups.sort()).toEqual(
        [...without.groups, DISSONANCE_SOUND_GROUPS.tyrant].sort(),
      );
      // Every source the foe's sound made is made again, the same; the boss's voice comes after.
      const sig = (s: Source[]) => s.map((x) => `${x.kind}:${x.freqs.map((f) => f.toFixed(2))}`);
      expect(sig(withHold.sources).slice(0, without.sources.length)).toEqual(sig(without.sources));
      const voice = withHold.sources.slice(without.sources.length);
      expect(voice.length).toBeGreaterThan(0);
      for (const f of freqsOf(voice)) expect(inKey(f), `${boss} ${f.toFixed(1)}`).toBe(true);
      expect(h.dis().asked.tyrant).toBe(1);
      plain.d.dispose();
      h.d.dispose();
    });

  it('the boss’s voice sits under the foe’s windup, and is coloured by the boss’s material', () => {
    const sigs = new Set<string>();
    for (const [boss, from, attack] of [BOSSES[0]!, BOSSES[1]!, BOSSES[2]!, BOSSES[4]!]) {
      const h = lab();
      const id = h.world.addTyrant(boss, from, attack, 2);
      // Only the voice: the foe's own sound measured apart.
      delete enemyOf(h.world, id).tyrant;
      const foe = h.fire(cast(h.world, 701, id, attack)).sources.length;
      h.advance(1);
      (enemyOf(h.world, id) as { tyrant?: unknown }).tyrant = {
        attack,
        from,
        phase: 1,
        readyAt: 0,
      };
      const out = h.fire(cast(h.world, 702, id, attack));
      const voice = out.sources.slice(foe);
      // Its sources and their pitches over its lowest (the chord's root is the same for each).
      const low = Math.min(...freqsOf(voice));
      sigs.add(
        voice
          .map((s) => `${s.kind}:${s.freqs.map((f) => (f / low).toFixed(2)).join('/')}`)
          .join(','),
      );
      h.d.dispose();
    }
    expect(sigs.size).toBe(4);
    expect(TYRANT_VOICE_PEAK).toBeLessThan(0.08);
  });

  it('only the held attack, and never while Stasis holds the enemies', () => {
    const h = lab();
    const [from, attack] = entry('vharun_crimson_warden', 1);
    const id = h.world.addTyrant('vharun_crimson_warden', from, attack, 2);
    const own = h.fire(cast(h.world, 703, id, 'vharun_execution'));
    expect(own.groups).not.toContain(DISSONANCE_SOUND_GROUPS.tyrant);
    h.advance(1);
    h.world.setStasis(true);
    const held = h.fire(cast(h.world, 704, id, attack));
    expect(held.groups).not.toContain(DISSONANCE_SOUND_GROUPS.tyrant);
    expect(h.dis().asked.tyrant).toBe(0);
    h.d.dispose();
  });
});

describe('the Postlude, heard', () => {
  it('the rise: the shatter drawn back in, the eight rings as eight notes D4 … D5, the choir on D', () => {
    const h = lab();
    h.world.setPostlude(3);
    const boss = h.world.addTyrant(CONDUCTOR, CONDUCTOR, 'none', 0);
    const out = h.fire(ev('postludeRose', { boss, hp: 300 }));
    expect(out.groups).toEqual([DISSONANCE_SOUND_GROUPS.rise]);
    for (const i of RISE_NOTES)
      expect(
        out.sources.some((s) => near(s, hz(i))),
        `note ${i}`,
      ).toBe(true);
    // Spread over the rise: the eighth starts close to its end.
    const starts = (f: number) => out.sources.filter((s) => near(s, f)).flatMap((s) => s.starts);
    const first = Math.min(...starts(hz(0)));
    const last = Math.min(...starts(hz(7)));
    expect(last - first).toBeGreaterThan(2.2);
    expect(last - first).toBeLessThan(3);
    for (const f of freqsOf(out.sources)) expect(inKey(f), f.toFixed(1)).toBe(true);
    h.d.dispose();
  });

  it('a pair Cue in the sim’s order: the first Cue’s own phrase (the call), then the answer in place of the second’s', () => {
    const h = lab();
    const a = h.world.addStanding(ALTO, -6);
    const b = h.world.addStanding(BASS, 6);
    const boss = h.world.addTyrant(CONDUCTOR, CONDUCTOR, 'none', 0);
    // What the Bass's ordinary Cue sings (the answer is its mirrored phrase lifted a third).
    const plain = lab();
    const pb = plain.world.addStanding(BASS, 6);
    const own = plain.fire(ev('enemyCued', { boss: 0, soloist: pb, solo: SOLOS[BASS]! }));
    const pitches = (src: Source[]) => new Set(freqsOf(src).map((f) => f.toFixed(1)));
    plain.d.dispose();
    const cue = vi.spyOn(SfxEngine.prototype as unknown as { enemyCue: () => void }, 'enemyCue');
    // The first voice Cued: its ordinary mirrored phrase, and nothing of the pair's.
    const call = h.fire(ev('enemyCued', { boss, soloist: a, solo: SOLOS[ALTO]! }));
    expect(call.groups).toEqual(['finale:cue']);
    expect(cue).toHaveBeenCalledTimes(1);
    h.advance(1.5);
    // 1.5 s on: the second's Cue and the pair, in one batch (enemyCued, then postludePair).
    const answer = h.fire(
      ev('enemyCued', { boss, soloist: b, solo: SOLOS[BASS]! }),
      ev('postludePair', { voices: [a, b] }),
    );
    expect(answer.groups).toEqual([DISSONANCE_SOUND_GROUPS.pair]);
    // The second's ordinary phrase is not played: one voice sings it, the answer.
    expect(cue).toHaveBeenCalledTimes(1);
    expect(h.stats().peakVoices[DISSONANCE_SOUND_GROUPS.pair]).toBe(1);
    expect(h.stats().peakVoices['finale:cue']).toBe(1);
    for (const f of freqsOf(answer.sources)) expect(inKey(f), f.toFixed(1)).toBe(true);
    // It differs from what the Bass's ordinary Cue sings.
    expect([...pitches(answer.sources)].some((f) => !pitches(own.sources).has(f))).toBe(true);
    // A pair of one voice (no other to Cue) is a plain Cue: its phrase plays, no pair.
    h.advance(2);
    const one = h.fire(
      ev('enemyCued', { boss, soloist: a, solo: SOLOS[ALTO]! }),
      ev('postludePair', { voices: [a] }),
    );
    expect(one.groups).not.toContain(DISSONANCE_SOUND_GROUPS.pair);
    expect(one.sources.length).toBeGreaterThan(0);
    expect(cue).toHaveBeenCalledTimes(2);
    // The first voice gone, the sim sends the second Cue alone (no postludePair): an ordinary
    // Cue, its own phrase, never left silent.
    h.advance(2);
    const alone = h.fire(ev('enemyCued', { boss, soloist: b, solo: SOLOS[BASS]! }));
    expect(alone.sources.length).toBeGreaterThan(0);
    expect(alone.groups).not.toContain(DISSONANCE_SOUND_GROUPS.pair);
    expect(cue).toHaveBeenCalledTimes(3);
    // Two voices that aren't the choir's: nothing of the pair.
    h.advance(2);
    expect(h.fire(ev('postludePair', { voices: [IDS.kael, IDS.lyra] })).sources.length).toBe(0);
    h.d.dispose();
  });

  it('the music hears the Postlude from the state, and only while it is there', () => {
    const h = lab();
    const music = h.d.musicEngine()!;
    h.run(1);
    expect(music.inputs.postlude).toBeUndefined();
    h.world.setPostlude(3);
    h.run(0.5);
    expect(music.inputs.postlude?.rising).toBeGreaterThan(0.1);
    expect(music.inputs.postlude?.rising).toBeLessThan(0.3);
    h.run(3);
    expect(music.inputs.postlude).toEqual({ rising: 1, enraged: false });
    h.world.setPostlude(0, true);
    h.run(0.2);
    expect(music.inputs.postlude?.enraged).toBe(true);
    h.world.setPostlude(null);
    h.run(0.2);
    expect(music.inputs.postlude).toBeUndefined();
    expect('postlude' in music.inputs).toBe(false);
    // From a state with a Postlude, as the sim will give it.
    const st = { time: 11.5, field: { finale: { postlude: { since: 10, riseUntil: 13 } } } };
    expect(postludeInput(st as unknown as WorldState)).toEqual({ rising: 0.5, enraged: false });
    expect(postludeInput({ time: 1, field: {} } as unknown as WorldState)).toBeUndefined();
    h.d.dispose();
  });
});

describe('the Finale’s stems, re-voiced', () => {
  /** The Crucible in its boss fight (the Conductor's phase 3, everything playing). */
  function crucible() {
    const h = lab();
    h.d.setBiome('celestial_crucible');
    // Under the top layer (Resonance 100 plays it), so the pressure's is heard.
    h.world.setResonance(25);
    h.world.setEnemies(1, 'boss', 'boss', 3);
    h.d.setMood('boss');
    h.run(6);
    return h;
  }
  const stems = (h: ReturnType<typeof lab>) => {
    const s = h.d.debugStats().stems;
    return { pad: s.pad, pulse: s.pulse, melody: s.melody, choir: s.choir };
  };
  const expected = (n: number) => {
    const s = silenceStems(n);
    return { pad: s.pad, pulse: s.pulse, melody: s.melody, choir: s.choir };
  };
  const top = (h: ReturnType<typeof lab>) =>
    (h.d.musicEngine() as unknown as { targets: { top: boolean } }).targets.top;

  it('postludeRiseNotes: none as it falls, a ring an eighth, all eight as it stands', () => {
    expect(postludeRiseNotes(0)).toBe(0);
    expect(postludeRiseNotes(0.01)).toBe(1);
    expect(postludeRiseNotes(0.125)).toBe(1);
    expect(postludeRiseNotes(0.13)).toBe(2);
    expect(postludeRiseNotes(0.99)).toBe(8);
    expect(postludeRiseNotes(1)).toBe(8);
    expect(postludeRiseNotes(-1)).toBe(0);
  });

  it('through the rise the stems reopen from the bottom; then the whole choir sings', () => {
    const h = crucible();
    const before = stems(h);
    expect(before.choir).toBeGreaterThan(0);
    expect(before.choir).toBeLessThan(1);
    expect(top(h)).toBe(false);
    h.world.setPostlude(3);
    const seen: number[] = [];
    for (let i = 0; i < 30; i++) {
      h.run(0.1);
      const s = stems(h);
      // Always one of the reopening steps, at most as far as the rise has come.
      const n = [0, 1, 2, 3, 4, 5, 6, 7, 8].find(
        (k) => JSON.stringify(expected(k)) === JSON.stringify(s),
      );
      if (i >= 8) {
        expect(n, `frame ${i}: ${JSON.stringify(s)}`).toBeDefined();
        expect(n!).toBeLessThanOrEqual(postludeRiseNotes((i + 1) / 30) + 0);
        seen.push(n!);
      }
    }
    for (let i = 1; i < seen.length; i++) expect(seen[i]!).toBeGreaterThanOrEqual(seen[i - 1]!);
    expect(seen[0]!).toBeLessThanOrEqual(3);
    h.run(2);
    expect(stems(h)).toEqual({ pad: 0.9, pulse: 1, melody: 1, choir: 1 });
    expect(top(h)).toBe(false);
    // Enraged: the top layer too.
    h.world.setPostlude(0, true);
    h.run(1.5);
    expect(top(h)).toBe(true);
    // Gone: the Conductor's phase 3 as before.
    h.world.setPostlude(null);
    h.run(1.5);
    expect(stems(h)).toEqual(before);
    h.d.dispose();
  });

  it('once it stands the melody is sung in pairs: more glass notes, all in D dorian', () => {
    const count = (postlude: boolean) =>
      (() => {
        const spy = vi.spyOn(Math, 'random').mockReturnValue(0.42);
        try {
          const h = crucible();
          if (postlude) {
            h.world.setPostlude(0.01);
            h.run(1.5);
          }
          const from = h.ctx.sources.length;
          h.run(8);
          const made = h.ctx.sources.slice(from);
          for (const f of freqsOf(made)) expect(inKey(f), f.toFixed(1)).toBe(true);
          h.d.dispose();
          return made.length;
        } finally {
          spy.mockRestore();
        }
      })();
    expect(count(true)).toBeGreaterThan(count(false));
  });
});

describe('without Phase 6', () => {
  it('a Finale with no Postlude and a boss with no hold: no Phase 6 sound, no music input', () => {
    const h = lab();
    h.d.setBiome('celestial_crucible');
    h.world.setEnemies(1, 'boss', 'boss', 2);
    h.d.setMood('boss');
    for (let i = 0; i < 5; i++) {
      const id = h.world.addEnemy('vharun_crimson_warden', 2);
      (h.world.entities.get(id)!.enemy as { state: string }).state = 'idle';
      h.fire(cast(h.world, 800 + i, id, entry('vharun_crimson_warden', 1)[1]));
      h.run(1);
    }
    const asked = h.dis().asked;
    expect(asked).toEqual({ edict: 0, tyrant: 0, rise: 0, pair: 0 });
    expect(h.d.musicEngine()!.inputs.postlude).toBeUndefined();
    const peaks = h.stats().peakVoices;
    for (const key of Object.values(DISSONANCE_SOUND_GROUPS)) expect(peaks[key] ?? 0).toBe(0);
    h.d.dispose();
  });
});

describe('Mimicry: 5c’s Mimicking sounds on Movement I and II enemies', () => {
  for (const def of ['bell_brute', 'glass_lancer', 'leech', 'impaler', 'sanguine_hound'])
    it(`${def} with Mimicking casts the Mimic's mirror, heard as the Mimic's`, () => {
      const ctx = new RecordingContext();
      const d = new SynthDirector({
        context: ctx as unknown as BaseAudioContext,
        autoPump: false,
        installUnlock: false,
        followSettings: false,
      });
      d.setMood('combat');
      d.pump();
      const sim = sandbox();
      sim.step([]);
      const e = spawnEnemy(worldOf(sim), def, 0, -6, { affixes: ['mimicking'] });
      let heard = false;
      for (let t = 0; t < 60 * 20 && !heard; t++) {
        const ent = worldOf(sim).entities.get(e.id);
        if (!ent || ent.health?.dead) break;
        if (ent.health) ent.health.hp = ent.health.maxHp;
        sim.step(t % 90 === 30 ? [{ t: 'tech', id: 'ward', slot: 0 }] : []);
        const events = sim.drainEvents();
        const cast = events.find(
          (x) =>
            x.type === 'telegraphStarted' &&
            x.owner === e.id &&
            sim.state.telegraphs.find((k) => k.id === x.telegraph)?.attackId === 'mimic_mirror',
        );
        const before = d.debugStats().peakVoices['unstitched:mirror'] ?? 0;
        d.onEvents(events, sim.state);
        ctx.currentTime += 1 / 60;
        ctx.endDue();
        d.pump();
        if (cast) {
          expect((d.debugStats().peakVoices['unstitched:mirror'] ?? 0) > before || before > 0).toBe(
            true,
          );
          heard = true;
        }
      }
      expect(heard, def).toBe(true);
      d.dispose();
    });
});

describe('the Atlas’s UI sounds', () => {
  const ATLAS: UiSound[] = ['atlasStar', 'atlasConstellation', 'runVerified', 'runMismatch'];

  it('are UI sounds with their own gates and caps, and a lab button each', () => {
    const ids = new Set(SOUNDS.map((s) => s.id));
    for (const s of ATLAS) {
      expect(UI_SOUND_NAMES).toContain(s);
      expect(ATLAS_LIMITS[s], s).toBeDefined();
      expect(ids.has(`ui-${s}`), s).toBe(true);
    }
    expect(starsLit(undefined)).toBe(1);
    expect(starsLit(2)).toBe(2);
    expect(starsLit(9)).toBe(3);
    expect(starsLit(0)).toBe(1);
  });

  for (const s of ATLAS)
    it(`${s}: in D dorian, on the ui bus, under its gate`, () => {
      const h = lab();
      const from = h.ctx.sources.length;
      h.d.playUi(s);
      const made = h.ctx.sources.slice(from);
      expect(made.length).toBeGreaterThan(0);
      for (const f of freqsOf(made)) expect(inKey(f), `${s} ${f.toFixed(1)}`).toBe(true);
      // Again at once: gated.
      const again = h.ctx.sources.length;
      h.d.playUi(s);
      expect(h.ctx.sources.length).toBe(again);
      h.advance(ATLAS_LIMITS[s]![0] + 0.05);
      h.d.playUi(s);
      expect(h.ctx.sources.length).toBeGreaterThan(again);
      h.d.dispose();
    });

  it('a star climbs and fills with the stars lit; the four sound unlike one another', () => {
    const play = (s: UiSound, stars?: number) => {
      const h = lab();
      const from = h.ctx.sources.length;
      h.d.playUi(s, null, stars === undefined ? undefined : { stars });
      const made = h.ctx.sources.slice(from);
      h.d.dispose();
      return made;
    };
    const one = play('atlasStar', 1);
    const three = play('atlasStar', 3);
    expect(three.length).toBeGreaterThan(one.length);
    expect(Math.max(...freqsOf(three))).toBeGreaterThan(Math.max(...freqsOf(one)));
    const sig = (m: Source[]) => m.map((x) => x.freqs.map((f) => f.toFixed(1)).join(',')).join('|');
    expect(new Set(ATLAS.map((s) => sig(play(s)))).size).toBe(4);
  });
});

// ── With W1's sim: real Tyrant and True Dissonance fights ──────────────────────────────────

/** A real director following a real sim: every batch and every frame, as the runtime does. */
function follow(sim: Sim) {
  const ctx = new RecordingContext();
  const d = new SynthDirector({
    context: ctx as unknown as BaseAudioContext,
    autoPump: false,
    installUnlock: false,
    followSettings: false,
  });
  d.setMood('boss');
  d.pump();
  const frame = (events: SimEvent[]) => {
    const before = { ...d.debugStats().peakVoices };
    const from = ctx.sources.length;
    d.onEvents(events, sim.state);
    ctx.currentTime += 1 / 60;
    ctx.endDue();
    d.update(sim.state, 1 / 60);
    const after = d.debugStats().peakVoices;
    return {
      groups: Object.keys(after).filter((k) => (after[k] ?? 0) > (before[k] ?? 0)),
      sources: ctx.sources.slice(from),
      now: ctx.currentTime - 1 / 60,
    };
  };
  return { ctx, d, frame, dis: () => d.sfxEngine()!.dissonance };
}

describe('with the sim: Tyrant, heard', () => {
  it('the Bellwarden’s real edict and its borrowed Lance: the edict, and the voice under each cast', () => {
    const s = SCENARIO_BELLWARDEN;
    const sim = createSim({
      seed: s.seed,
      ...s.config,
      debug: true,
      dissonance: [{ id: 'tyrant', rank: 1 }],
    });
    const bot = makeBot('skilled', s.seed);
    const a = follow(sim);
    let borrowed = 0;
    for (let i = 0; i < 20 * 60; i++) {
      sim.step(bot.decide(sim.state));
      const events = sim.drainEvents();
      const boss = sim.state.encounter.bossId;
      const hold = boss === null ? undefined : sim.state.entities.get(boss)?.enemy?.tyrant;
      for (const e of events)
        if (
          e.type === 'telegraphStarted' &&
          e.owner === boss &&
          sim.state.telegraphs.find((t) => t.id === e.telegraph)?.attackId === hold?.attack
        )
          borrowed++;
      a.frame(events);
    }
    expect(a.dis().asked.edict).toBeGreaterThanOrEqual(1);
    expect(borrowed).toBeGreaterThan(0);
    expect(a.dis().asked.tyrant).toBe(borrowed);
    a.d.dispose();
  });
});

describe('with the sim: the Conductor’s Tyrant, heard', () => {
  it('its voice under every phase 1 Sforzando and phase 2 Downbeat (all its held casts), none in the Grand Silence', () => {
    const s = SCENARIO_CONDUCTOR;
    const sim = createSim({
      seed: s.seed,
      ...s.config,
      debug: true,
      dissonance: [{ id: 'tyrant', rank: 1 }],
    });
    const bot = makeBot('skilled', s.seed);
    const a = follow(sim);
    let held = 0;
    let silenceVoices = 0;
    const plan: [number, number | null][] = [
      [22, null],
      [22, 0.55],
      [12, 0.29],
    ];
    for (const [seconds, pct] of plan)
      for (let i = 0; i < seconds * 60; i++) {
        const cmds = bot.decide(sim.state);
        if (i === 0 && pct !== null) cmds.push({ t: 'debug', op: { op: 'setBossHp', pct } });
        sim.step(cmds);
        const events = sim.drainEvents();
        const boss = sim.state.encounter.bossId;
        const b = boss === null ? undefined : sim.state.entities.get(boss);
        const phase = b?.enemy?.phase ?? 0;
        const own = phase === 1 ? SFORZANDO : phase === 2 ? DOWNBEAT : null;
        for (const e of events)
          if (
            e.type === 'telegraphStarted' &&
            e.owner === boss &&
            own !== null &&
            sim.state.telegraphs.find((t) => t.id === e.telegraph)?.attackId === own
          ) {
            // Every one of them is the hold's (its own picker leaves that attack to Tyrant).
            expect(b!.enemy!.tyrant?.attack).toBe(own);
            held++;
          }
        const before = a.dis().asked.tyrant;
        a.frame(events);
        if (sim.state.field.finale?.silence) silenceVoices += a.dis().asked.tyrant - before;
      }
    expect(held).toBeGreaterThanOrEqual(2);
    expect(a.dis().asked.tyrant).toBe(held);
    expect(silenceVoices).toBe(0);
    a.d.dispose();
  });
});

describe('with the sim: the Postlude, heard', () => {
  const TD = [{ id: 'true_dissonance', rank: 1 }];
  /** W1's staging (tests/sim/postlude.test.ts): the Conductor in a sandbox, the party unkillable. */
  function staged() {
    const sim = sandbox({ dissonance: TD });
    sim.step([spawn(CONDUCTOR, 0, -8)]);
    const w = worldOf(sim);
    const boss = w.entities.list().find((e) => e.enemy?.defId === CONDUCTOR)!;
    boss.health!.hp = boss.health!.maxHp = 1e6;
    for (const id of w.party) {
      const hh = w.entities.get(id)!.health!;
      hh.hp = hh.maxHp = 1e6;
      hh.invulnerable = 1e9;
    }
    for (let i = 0; i < 900 && w.field.finale === undefined; i++) sim.step([]);
    sim.drainEvents();
    return { sim, w, boss };
  }

  it('the rise’s batch: the decree announces it low, the rise sounds high over it, no clash', () => {
    const { sim, w, boss } = staged();
    const a = follow(sim);
    a.frame([]);
    boss.health!.hp = 1;
    dealDamage(w, boss, { source: w.party[0]!, sourceName: 'test', amount: 50, telegraph: null });
    const events = sim.drainEvents();
    const types = events.map((e) => e.type);
    expect(types).toContain('postludeRose');
    expect(types).toContain('decree');
    expect(types).not.toContain('enemyKilled');
    const out = a.frame(events);
    expect(out.groups).toContain('decree');
    expect(out.groups).toContain(DISSONANCE_SOUND_GROUPS.rise);
    // The decree's horns sit on D2 and F2 for its first 1.4 s; nothing of the rise is pitched
    // under 250 Hz then (its low D comes as the Conductor stands, 3 s on): the rise alone.
    const alone = follow(sim);
    alone.frame([]);
    const r = alone.frame(events.filter((e) => e.type === 'postludeRose'));
    const early = r.sources.filter(
      (src) => src.kind === 'osc' && Math.min(...src.starts) < r.now + 1.4,
    );
    expect(early.length).toBeGreaterThan(0);
    for (const src of early) expect(Math.min(...src.freqs)).toBeGreaterThan(250);
    const late = r.sources.filter(
      (src) => src.kind === 'osc' && Math.min(...src.starts) > r.now + 2.5,
    );
    expect(late.some((src) => src.freqs.some((f) => f < 100))).toBe(true);
    alone.d.dispose();
    const riseEarly = a.dis().asked.rise;
    expect(riseEarly).toBe(1);
    const notes = RISE_NOTES.map((i) => midiToHz(scaleMidi(i)));
    for (const f of notes)
      expect(
        out.sources.some((src) => near(src, f)),
        f.toFixed(1),
      ).toBe(true);
    a.d.dispose();
  });

  it('pairs from the real sim: each pair’s second Cue sings the answer, never its own phrase too', () => {
    const { sim, w, boss } = staged();
    const a = follow(sim);
    const cue = vi.spyOn(
      SfxEngine.prototype as unknown as { enemyCue: (id: number) => void },
      'enemyCue',
    );
    boss.health!.hp = 1;
    dealDamage(w, boss, { source: w.party[0]!, sourceName: 'test', amount: 50, telegraph: null });
    a.frame(sim.drainEvents());
    const order: string[] = [];
    let pairs = 0;
    for (let i = 0; i < 40 * 60; i++) {
      sim.step([]);
      const events = sim.drainEvents();
      for (const e of events) {
        if (e.type === 'enemyCued') order.push(`cued:${e.soloist}`);
        if (e.type === 'postludePair') {
          order.push(`pair:${e.voices.join(',')}`);
          // It comes in the batch of its second Cue, right after it.
          expect(order[order.length - 2]).toBe(`cued:${e.voices[e.voices.length - 1]}`);
          if (e.voices.length >= 2) pairs++;
        }
      }
      a.frame(events);
    }
    expect(pairs).toBeGreaterThanOrEqual(2);
    expect(a.dis().asked.pair).toBe(pairs);
    // Every Cue's phrase was asked for except each pair's second, which the answer sang.
    const cued = order.filter((o) => o.startsWith('cued:')).length;
    expect(cue.mock.calls.length).toBe(cued - pairs);
    a.d.dispose();
  });
});
