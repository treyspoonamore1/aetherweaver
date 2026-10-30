/**
 * Phase 4e audio: Bonds (docs/phase-4e.md, docs/phase-4e/vfx-audio.md). A sound for every talent
 * and alternate Solo the sim announces (`talentFired`), each in its hero's voice; the alternate
 * Solos' starts; and the Bonds UI sounds (`bondRankUp`, `talentPick`, `soloPick`, `sceneStart`,
 * `sceneReply`). Each plays on its bus, in its own group, distinct from its neighbours, with its
 * intended notes, all in D dorian, within its gate and cap; the frequent ones stay light; the lab
 * has a button for each.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getAudio } from '../src/audio';
import { SynthDirector } from '../src/audio/director';
import { FakeWorld, IDS, type HeroKey } from '../src/audio/lab/labState';
import { SOUNDS } from '../src/audio/lab/soundBoard';
import { ALT_SOLO_SOUND_GROUPS, TALENT_SOUND_GROUPS, TALENT_SOUND_LIMITS } from '../src/audio/sfx';
import { LEITMOTIFS, isInScale, midiToHz, scaleMidi } from '../src/audio/theory';
import type { UiSound, UiSoundDetail } from '../src/audio/types';
import { BOND_LIMITS, UI_SOUND_NAMES, bondVoice } from '../src/audio/ui';
import { CONTENT } from '../src/content';
import { createSim, type SimEvent, type WorldState } from '../src/sim';

const ev = (type: SimEvent['type'], rest: Record<string, unknown>): SimEvent =>
  ({ type, tick: 0, ...rest }) as unknown as SimEvent;

// ── A recording fake AudioContext (as tests/audioPhase4.test.ts) ─────────────────────

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
  /** Every source node made, to end them when their stop time comes (as WebAudio does). */
  private readonly live: { node: Fake; source: Source; ended: boolean }[] = [];
  [k: string]: unknown;
  /** Ends the sources whose stop time has passed (their `onended` frees the engine's count). */
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
  return { ctx, d, world, fire, ui, advance, stats };
}

type Recorded = { sources: Source[] };
const freqsOf = (sources: Source[]) => sources.flatMap((s) => s.freqs);
const hasPitch = (sources: Source[], hz: number, tol = 0.5) =>
  freqsOf(sources).some((f) => Math.abs(f - hz) < tol);
const hasMidi = (r: Recorded, m: number) => hasPitch(r.sources, midiToHz(m));
/** Cents from the nearest D dorian pitch. */
const centsOff = (hz: number) => {
  const midi = 69 + 12 * Math.log2(hz / 440);
  let best = Infinity;
  for (let m = Math.floor(midi) - 1; m <= Math.ceil(midi) + 1; m++)
    if (isInScale(m)) best = Math.min(best, Math.abs(midi - m) * 100);
  return best;
};
/**
 * In D dorian: a note within 3 cents of the scale (a brass bell's twin is 2.8 cents sharp), or one
 * of glass's inharmonic partials over such a note (as every glass recipe has).
 */
const inKey = (f: number) => [1, 2.32, 4.25, 6.63].some((r) => centsOff(f / r) < 3);
/** A glass note on `hz` (found by its first inharmonic partial: a pluck's octave has none). */
const glassOn = (sources: Source[], hz: number) => hasPitch(sources, hz * 2.32, 1);
const signature = (r: Recorded) =>
  `${r.sources.length}:${freqsOf(r.sources)
    .map((f) => f.toFixed(2))
    .join(',')}`;
const endOf = (r: Recorded, now: number) => Math.max(...r.sources.map(stopOf)) - now;

// ── The talents as the sim announces them ────────────────────────────────────────────

/** Every talent id the sim announces (`talentFired(world, hero, 'id', …)`), read from its sources. */
function simTalents(): string[] {
  const found = new Set<string>();
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (p.endsWith('.ts')) {
        const src = readFileSync(p, 'utf8');
        for (const m of src.matchAll(/talentFired\(\s*world,\s*[\w.]+,\s*'([a-z_]+)'/g))
          found.add(m[1] as string);
      }
    }
  };
  walk(join(__dirname, '..', 'src', 'sim'));
  return [...found].sort();
}

const TALENTS = Object.keys(TALENT_SOUND_GROUPS);
/** Whose each is (content). */
const heroOf = (id: string) =>
  CONTENT.talents.find((t) => t.id === id)?.hero ?? CONTENT.altSolos.find((s) => s.id === id)?.hero;
const talentValue = (id: string, key: string) =>
  CONTENT.talents.find((t) => t.id === id)?.values[key] ?? Number.NaN;

/** A talent's `talentFired`, as the sim sends it, with the lab world set for it. */
function talentEv(h: ReturnType<typeof harness>, id: string): SimEvent {
  if (!h.world.entities.has(IDS.enemyBase)) h.world.setEnemies(3);
  const hero = (heroOf(id) ?? 'kael') as HeroKey;
  const at = h.world.state.entities.get(IDS[hero])!;
  const target =
    id === 'oathkeeper' || id === 'celestial_sphere'
      ? IDS.lyra
      : id === 'unbreakable' || id === 'shieldbearer' || id === 'wind_step'
        ? null
        : id === 'constellation'
          ? IDS.kael
          : IDS.enemyBase;
  return ev('talentFired', { hero: IDS[hero], talent: id, x: at.x + 2, z: at.z + 3, target });
}

/** The talent's sound alone, in a fresh harness. */
function talentSound(id: string, setup?: (h: ReturnType<typeof harness>) => void) {
  const h = harness();
  setup?.(h);
  const r = h.fire(talentEv(h, id));
  return { h, r };
}

describe('Bonds in the fight: a sound for every talent the sim announces', () => {
  it('covers every talent and alternate Solo the sim announces, and only known ones', () => {
    const found = simTalents();
    expect(found.length).toBeGreaterThanOrEqual(14);
    expect([...TALENTS].sort()).toEqual(found);
    for (const id of TALENTS) {
      expect(heroOf(id), id).toBeDefined();
      expect(TALENT_SOUND_LIMITS[id], id).toBeDefined();
    }
  });

  it('each plays on the sfx bus, in its own group, and nothing on the UI bus', () => {
    for (const id of TALENTS) {
      const { h, r } = talentSound(id, (k) => k.world.setSphere('lyra', 1));
      expect(r.added, id).toBeGreaterThan(0);
      expect(r.addedSfx, id).toBe(r.added);
      expect(r.groups, id).toEqual([TALENT_SOUND_GROUPS[id]]);
      expect(h.stats().activeSources.ui, id).toBe(0);
      h.d.dispose();
    }
  });

  it('are distinct from each other and from the sounds they sit with', () => {
    const ours = TALENTS.map((id) => {
      const { h, r } = talentSound(id, (k) => k.world.setSphere('lyra', 1));
      h.d.dispose();
      return signature(r);
    });
    expect(new Set(ours).size).toBe(TALENTS.length);
    const neighbours: [string, SimEvent][] = [
      ['ward', ev('techniqueCast', { technique: 'ward', target: IDS.kael, x: 0, z: 0 })],
      ['perfect', ev('perfectWard', { target: IDS.kael, telegraph: 1, negated: 400 })],
      ['cue', ev('cued', { hero: IDS.vexis })],
      ['shield break', ev('shieldBroken', { target: IDS.kael, shield: 'ward' })],
      ['glide', ev('glided', { fromX: 0, fromZ: 0, toX: 4, toZ: 0 })],
      ['save', ev('save', { target: IDS.lyra, cause: 'ward', counterfactualDamage: 900 })],
    ];
    for (const [name, e] of neighbours) {
      const h = harness();
      const sig = signature(h.fire(e));
      expect(ours, name).not.toContain(sig);
      h.d.dispose();
    }
    for (const role of ['swarm', 'brute', 'caster']) {
      const h = harness();
      const id = h.world.addEnemy(role, 4);
      const kill = h.fire(ev('enemyKilled', { enemy: id, defId: role, killer: null, x: 4, z: 5 }));
      expect(ours, role).not.toContain(signature(kill));
      h.d.dispose();
    }
  });

  it('each says what happened, in its hero’s voice and notes', () => {
    const notes: Record<string, number[]> = {
      // Kael: horn and brass on D (and the A a fifth up).
      steady_vanguard: [45, 50, 38],
      vanguards_roar: [38, 45, 50],
      riposte_bash: [57, 38],
      unbreakable: [38, 50, 62],
      shieldbearer: [62, 69],
      oathkeeper: [50, 62],
      // Lyra: a flute's E5 to A5, a pluck on A5.
      wind_step: [76, 81],
      hawks_vigil: [81],
      // Vexis: glass on B against F, and the stars over them.
      starthread: [83, 89],
      event_horizon: [41, 71, 77],
      supernova: [83, 86, 89, 50, 53, 59, 38],
      constellation: [86, 93, 100],
      arcane_ward: [83, 89],
      celestial_sphere: [83],
    };
    for (const id of TALENTS) {
      const { h, r } = talentSound(id, (k) => k.world.setSphere('lyra', 1));
      for (const m of notes[id] ?? []) expect(hasMidi(r, m), `${id} ${m}`).toBe(true);
      // Its hero's own pitch class is in it: Kael's D, Lyra's A, Vexis's B.
      const pc = { kael: 2, lyra: 9, vexis: 11 }[heroOf(id) as 'kael' | 'lyra' | 'vexis'];
      const pcs = freqsOf(r.sources).map(
        (f) => ((Math.round(69 + 12 * Math.log2(f / 440)) % 12) + 12) % 12,
      );
      expect(pcs, id).toContain(pc);
      h.d.dispose();
    }
    // Unbreakable's shimmer, a glass D6, rings for the seconds he is untouchable (content).
    const u = talentSound('unbreakable');
    expect(glassOn(u.r.sources, midiToHz(86))).toBe(true);
    const glass = u.r.sources.filter((s) => hasPitch([s], midiToHz(86)));
    const ring = Math.max(...glass.map(stopOf)) - Math.min(...glass.map(startOf));
    expect(ring).toBeGreaterThan(talentValue('unbreakable', 'seconds'));
    u.h.d.dispose();
  });

  it('everything they play is in D dorian (glass’s own partials aside), to the cent below glass', () => {
    const variants: (() => { h: ReturnType<typeof harness>; r: Recorded })[] = [
      ...TALENTS.map((id) => () => talentSound(id, (k) => k.world.setSphere('lyra', 1))),
      () => talentSound('celestial_sphere', (k) => k.world.setSphere('lyra', 0)),
      () => talentSound('hawks_vigil', (k) => k.world.setAltSolo('lyra', 'hawks_vigil', true)),
    ];
    for (const make of variants) {
      const { h, r } = make();
      for (const f of freqsOf(r.sources)) expect(inKey(f), `${f.toFixed(1)} Hz`).toBe(true);
      // Below the glass (whose partials are inharmonic), every pitch is on the scale.
      for (const f of freqsOf(r.sources).filter((x) => x < 600))
        expect(centsOff(f), `${f.toFixed(1)} Hz`).toBeLessThan(3);
      h.d.dispose();
    }
  });

  it('the frequent ones (Hawk’s Vigil, Oathkeeper, the sphere) stay light', () => {
    const light = ['hawks_vigil', 'oathkeeper', 'celestial_sphere'];
    const big = talentSound('unbreakable');
    const ward = harness();
    const wardPeak = ward.fire(
      ev('techniqueCast', { technique: 'ward', target: IDS.kael, x: 0, z: 0 }),
    ).peak;
    for (const id of light) {
      const { h, r } = talentSound(id, (k) => k.world.setSphere('lyra', 1));
      expect(r.added, id).toBeLessThanOrEqual(6);
      expect(r.peak, id).toBeLessThan(wardPeak);
      expect(r.peak, id).toBeLessThan(big.r.peak);
      expect(endOf(r, h.ctx.currentTime), id).toBeLessThan(0.8);
      h.d.dispose();
    }
    big.h.d.dispose();
    ward.d.dispose();
  });

  it('is gated: a burst of each stays within its cap, the frequent ones heard a few times', () => {
    for (const id of TALENTS) {
      const h = harness();
      h.world.setSphere('lyra', 2);
      let heard = 0;
      for (let i = 0; i < 40; i++) {
        heard += h.fire(talentEv(h, id)).added > 0 ? 1 : 0;
        h.advance(0.025);
      }
      const [gate, cap] = TALENT_SOUND_LIMITS[id]!;
      expect(h.stats().peakVoices[TALENT_SOUND_GROUPS[id]!] ?? 0, id).toBeLessThanOrEqual(cap);
      // 40 in a second: at most one per gate.
      expect(heard, id).toBeLessThanOrEqual(Math.ceil(1 / gate) + 1);
      expect(heard, id).toBeGreaterThanOrEqual(1);
      h.d.dispose();
    }
    // A step and a blink are each hero's own: two heroes at once are both heard.
    const h = harness();
    const a = h.fire(
      ev('talentFired', { hero: IDS.lyra, talent: 'wind_step', x: 0, z: 0, target: null }),
    );
    const b = h.fire(
      ev('talentFired', { hero: IDS.kael, talent: 'wind_step', x: 0, z: 0, target: null }),
    );
    expect(a.added).toBeGreaterThan(0);
    expect(b.added).toBeGreaterThan(0);
    h.d.dispose();
  });

  it('Shieldbearer glints once for each hero it reached, counted from the state', () => {
    const near = talentSound('shieldbearer', (h) => {
      h.world.moveHero('kael', 0, 0);
      h.world.moveHero('lyra', 2, 0);
      h.world.moveHero('vexis', -2, 0);
    });
    const one = talentSound('shieldbearer', (h) => {
      h.world.moveHero('kael', 0, 0);
      h.world.moveHero('lyra', 2, 0);
      h.world.moveHero('vexis', talentValue('shieldbearer', 'radius') + 4, 0);
    });
    const down = talentSound('shieldbearer', (h) => {
      h.world.moveHero('kael', 0, 0);
      h.world.moveHero('lyra', 2, 0);
      h.world.moveHero('vexis', -2, 0);
      h.world.setDowned('lyra', true);
      h.world.setDowned('vexis', true);
    });
    const glints = (r: Recorded) => [81, 86].filter((m) => glassOn(r.sources, midiToHz(m))).length;
    expect(glints(near.r)).toBe(2);
    expect(glints(one.r)).toBe(1);
    expect(glints(down.r)).toBe(0);
    for (const x of [near, one, down]) x.h.d.dispose();
  });

  it('Hawk’s Vigil: its shots turn through A5, C6, E6; cued, each marks (a small glass E6)', () => {
    const h = harness();
    const heard: number[] = [];
    for (let i = 0; i < 3; i++) {
      const r = h.fire(talentEv(h, 'hawks_vigil'));
      heard.push([81, 84, 88].findIndex((m) => hasMidi(r, m)));
      h.advance(0.2);
    }
    expect(heard).toEqual([0, 1, 2]);
    h.d.dispose();
    const plain = talentSound('hawks_vigil');
    const cued = talentSound('hawks_vigil', (k) => k.world.setAltSolo('lyra', 'hawks_vigil', true));
    expect(glassOn(plain.r.sources, midiToHz(88))).toBe(false);
    expect(glassOn(cued.r.sources, midiToHz(88))).toBe(true);
    plain.h.d.dispose();
    cued.h.d.dispose();
  });

  it('Celestial Sphere: a pop on B5; its last hit shatters it (fuller, falling to F5 and B4)', () => {
    const pop = talentSound('celestial_sphere', (h) => h.world.setSphere('lyra', 1));
    const last = talentSound('celestial_sphere', (h) => h.world.setSphere('lyra', 0));
    expect(last.r.added).toBeGreaterThan(pop.r.added);
    for (const m of [77, 71]) {
      expect(hasMidi(pop.r, m), `pop ${m}`).toBe(false);
      expect(hasMidi(last.r, m), `last ${m}`).toBe(true);
    }
    pop.h.d.dispose();
    last.h.d.dispose();
  });

  it('Riposte Bash answers the Perfect Ward a beat later, under it', () => {
    const h = harness();
    const now = h.ctx.currentTime;
    const perfect = h.fire(ev('perfectWard', { target: IDS.kael, telegraph: 1, negated: 400 }));
    const riposte = h.fire(talentEv(h, 'riposte_bash'));
    expect(riposte.groups).toEqual(['talent:riposte']);
    expect(Math.min(...riposte.sources.map(startOf))).toBeGreaterThanOrEqual(now + 0.1);
    expect(riposte.peak).toBeLessThan(perfect.peak);
    h.d.dispose();
  });

  it('Unbreakable and Supernova are the big ones: weightier than the rest, a few sources more', () => {
    const big = ['unbreakable', 'supernova'].map((id) => talentSound(id));
    for (const id of TALENTS.filter((x) => x !== 'unbreakable' && x !== 'supernova')) {
      const s = talentSound(id, (k) => k.world.setSphere('lyra', 1));
      for (const b of big) expect(b.r.added, id).toBeGreaterThan(s.r.added);
      s.h.d.dispose();
    }
    for (const b of big) b.h.d.dispose();
  });
});

describe('the alternate Solos’ starts (Phase 4e)', () => {
  const start = (solo: string, hero: HeroKey, cued: boolean) => {
    const h = harness();
    const r = h.fire(ev('soloStarted', { hero: IDS[hero], solo, cued, duration: 5 }));
    return { h, r };
  };
  const ALT: [string, HeroKey][] = [
    ['oathkeeper', 'kael'],
    ['hawks_vigil', 'lyra'],
    ['celestial_sphere', 'vexis'],
  ];

  it('each starts with a sound of its own, cued or not; the default Solos have none of these', () => {
    const sigs: string[] = [];
    for (const [solo, hero] of ALT) {
      for (const cued of [false, true]) {
        const { h, r } = start(solo, hero, cued);
        expect(r.groups, solo).toContain(ALT_SOLO_SOUND_GROUPS[solo]);
        if (cued) expect(r.groups, solo).toContain('leitmotif');
        else sigs.push(signature(r));
        for (const f of freqsOf(r.sources)) expect(inKey(f), `${solo} ${f}`).toBe(true);
        h.d.dispose();
      }
    }
    expect(new Set(sigs).size).toBe(3);
    for (const [solo, hero] of [
      ['aegisWall', 'kael'],
      ['galeBarrage', 'lyra'],
      ['starfall', 'vexis'],
    ] as const) {
      const { h, r } = start(solo, hero, false);
      expect(r.added, solo).toBe(0);
      h.d.dispose();
    }
  });

  it('say what they ask: an oath on D, a held breath and a flute A5, a sphere of glass B5 and F6', () => {
    const oath = start('oathkeeper', 'kael', false);
    for (const m of [50, 38, 62]) expect(hasMidi(oath.r, m), `oath ${m}`).toBe(true);
    const vigil = start('hawks_vigil', 'lyra', false);
    expect(hasMidi(vigil.r, 81)).toBe(true);
    expect(vigil.r.sources.some((s) => s.kind === 'noise')).toBe(true);
    const sphere = start('celestial_sphere', 'vexis', false);
    for (const m of [83, 89])
      expect(glassOn(sphere.r.sources, midiToHz(m)), `sphere ${m}`).toBe(true);
    for (const x of [oath, vigil, sphere]) x.h.d.dispose();
  });

  it('is gated per hero: a double start is one sound', () => {
    const h = harness();
    const e = ev('soloStarted', { hero: IDS.kael, solo: 'oathkeeper', cued: false, duration: 5 });
    expect(h.fire(e).added).toBeGreaterThan(0);
    expect(h.fire(e).added).toBe(0);
    h.d.dispose();
  });
});

describe('Bonds in a real fight (Phase 4e)', () => {
  it('heard as each talent acts, within its cap, never throwing', () => {
    const h = harness();
    const sim = createSim({
      seed: 5,
      encounter: 'first_light',
      chords: [{ auras: ['fortissimo'] }, { auras: ['sostenuto'] }],
      assists: { autonomy: true },
      bonds: {
        talents: [
          'vanguards_roar',
          'riposte_bash',
          'unbreakable',
          'wind_step',
          'ricochet',
          'storm_queen',
          'arcane_ward',
          'starthread',
          'supernova',
        ],
        solos: ['oathkeeper'],
      },
    });
    const seen = new Map<string, number>();
    for (let i = 0; i < 60 * 45; i++) {
      // Thread Kael now and then (Starthread rides it), as a player would.
      sim.step(i % 600 === 30 ? [{ t: 'thread', slot: 0 }] : []);
      const events = sim.drainEvents();
      for (const e of events)
        if (e.type === 'talentFired') seen.set(e.talent, (seen.get(e.talent) ?? 0) + 1);
      h.ctx.currentTime += 1 / 60;
      h.ctx.endDue();
      expect(() => h.d.onEvents(events, sim.state)).not.toThrow();
      if (i % 3 === 0) h.d.update(sim.state, 1 / 20);
      h.d.pump();
    }
    expect(seen.size).toBeGreaterThan(0);
    const peaks = h.stats().peakVoices;
    let heard = 0;
    for (const [id] of seen) {
      const group = TALENT_SOUND_GROUPS[id]!;
      heard += (peaks[group] ?? 0) > 0 ? 1 : 0;
      expect(peaks[group] ?? 0, id).toBeLessThanOrEqual(TALENT_SOUND_LIMITS[id]![1]);
    }
    expect(heard).toBeGreaterThan(0);
    h.d.dispose();
  });
});

// ── The UI sounds ────────────────────────────────────────────────────────────────────

const BOND_UI: UiSound[] = ['bondRankUp', 'talentPick', 'soloPick', 'sceneStart', 'sceneReply'];
const HEROES = ['kael', 'lyra', 'vexis'] as const;
const heartOf = (hero: string) => scaleMidi(bondVoice(hero)!.heart);

describe('Bonds’ UI sounds (Phase 4e)', () => {
  it('are agreed UiSound names, each with its own recipe, gate and cap', () => {
    for (const s of BOND_UI) {
      expect(UI_SOUND_NAMES, s).toContain(s);
      expect(BOND_LIMITS[s], s).toBeDefined();
    }
  });

  it('each plays on the UI bus, in its own group, and nothing on the sfx bus, for each hero', () => {
    for (const s of BOND_UI) {
      for (const detail of [undefined, ...HEROES.map((hero) => ({ hero, rank: 3 }))]) {
        const h = harness();
        const r = h.ui(s, detail);
        expect(r.added, s).toBeGreaterThan(0);
        expect(r.addedUi, s).toBe(r.added);
        expect(r.groups, s).toEqual([`ui:${s}`]);
        h.d.dispose();
      }
    }
  });

  it('are distinct from each other, for each hero, and from the sounds they sit with', () => {
    const sig = (s: UiSound, detail?: UiSoundDetail) => {
      const h = harness();
      const out = signature(h.ui(s, detail));
      h.d.dispose();
      return out;
    };
    const ours: string[] = [];
    for (const s of BOND_UI)
      for (const detail of [undefined, ...HEROES.map((hero) => ({ hero }))])
        ours.push(sig(s, detail));
    expect(new Set(ours).size).toBe(ours.length);
    for (const other of [
      'click',
      'pick',
      'confirm',
      'back',
      'unlock',
      'reward',
      'rankUp',
      'deed',
      'relicPick',
      'callingPick',
      'callingReveal',
      'eventOpen',
      'reveal',
      'starTake',
      'starNotable',
      'starKeystone',
      'dissonanceToggle',
    ] as UiSound[])
      expect(ours, other).not.toContain(sig(other));
  });

  it('a Bond rank-up is the hero’s own theme in their own voice, not the Weaver’s rank-up', () => {
    for (const hero of HEROES) {
      const h = harness();
      const r = h.ui('bondRankUp', { hero, rank: 4 });
      for (const n of LEITMOTIFS[hero]!.notes)
        expect(hasPitch(r.sources, midiToHz(scaleMidi(n.idx))), `${hero} ${n.idx}`).toBe(true);
      // A glass note on their heart closes it.
      expect(glassOn(r.sources, midiToHz(heartOf(hero))), hero).toBe(true);
      // Warm and low under it: a bowed D2.
      expect(hasPitch(r.sources, midiToHz(38)), hero).toBe(true);
      h.d.dispose();
    }
    // The Weaver's rank-up climbs to a D6 (pluck and glass); a Bond's doesn't.
    const h = harness();
    const weaver = h.ui('rankUp');
    expect(hasPitch(weaver.sources, midiToHz(86))).toBe(true);
    for (const hero of HEROES) {
      const k = harness();
      expect(hasPitch(k.ui('bondRankUp', { hero, rank: 4 }).sources, midiToHz(86)), hero).toBe(
        false,
      );
      k.d.dispose();
    }
    h.d.dispose();
  });

  it('a rank that opens a talent tier or the alternate Solo (content) rings a second glass note', () => {
    const rules = CONTENT.bondRules;
    for (const hero of HEROES) {
      const up = midiToHz(scaleMidi(bondVoice(hero)!.heart + 4));
      for (let rank = 1; rank <= rules.ranks.length; rank++) {
        const h = harness();
        const r = h.ui('bondRankUp', { hero, rank });
        const opens = rules.talentRanks.includes(rank) || rank === rules.soloRank;
        expect(glassOn(r.sources, up), `${hero} rank ${rank}`).toBe(opens);
        h.d.dispose();
      }
    }
  });

  it('talents, Solos and replies are each hero’s: Kael’s brass, Lyra’s flute, Vexis’s glass', () => {
    const pick = (hero: string) => {
      const h = harness();
      const r = h.ui('talentPick', { hero });
      h.d.dispose();
      return r;
    };
    // The heart's note, plucked an octave down, and the fifth up the scale from it.
    for (const hero of HEROES) {
      const r = pick(hero);
      const heart = bondVoice(hero)!.heart;
      expect(hasPitch(r.sources, midiToHz(scaleMidi(heart - 7))), hero).toBe(true);
      expect(hasPitch(r.sources, midiToHz(scaleMidi(heart - 3))), hero).toBe(true);
    }
    // Kael's brass on D5 (its hum on D4), Lyra's flute on A5, Vexis's glass on B5.
    expect(hasPitch(pick('kael').sources, midiToHz(74) * 1.0016, 0.6)).toBe(true);
    expect(hasPitch(pick('lyra').sources, midiToHz(81))).toBe(true);
    expect(glassOn(pick('vexis').sources, midiToHz(83))).toBe(true);
    // A Solo chosen: the first notes of their theme.
    for (const hero of HEROES) {
      const h = harness();
      const r = h.ui('soloPick', { hero });
      for (const n of LEITMOTIFS[hero]!.notes.slice(0, 3))
        expect(hasPitch(r.sources, midiToHz(scaleMidi(n.idx))), `${hero} ${n.idx}`).toBe(true);
      expect(r.added).toBeGreaterThan(pick(hero).added);
      h.d.dispose();
    }
  });

  it('a scene begins quietly: the fire’s crackle, a low warm drone, a held breath, about 3 s', () => {
    const h = harness();
    const now = h.ctx.currentTime;
    const scene = h.ui('sceneStart', { hero: 'lyra' });
    expect(scene.sources.filter((s) => s.kind === 'noise').length).toBeGreaterThanOrEqual(10);
    expect(hasPitch(scene.sources, midiToHz(38))).toBe(true);
    expect(endOf(scene, now)).toBeGreaterThan(2.5);
    h.advance(4);
    const rank = h.ui('bondRankUp', { hero: 'lyra', rank: 4 });
    expect(scene.peak).toBeLessThan(rank.peak);
    h.advance(4);
    // A reply is small: shorter and softer than a rank-up.
    const reply = h.ui('sceneReply', { hero: 'lyra' });
    expect(reply.peak).toBeLessThan(rank.peak);
    expect(endOf(reply, h.ctx.currentTime)).toBeLessThan(1.2);
    h.d.dispose();
  });

  it('everything they play is in D dorian (glass’s own partials aside)', () => {
    for (const s of BOND_UI) {
      for (const detail of [
        undefined,
        ...HEROES.flatMap((hero) => [{ hero, rank: 3 }, { hero }]),
      ]) {
        const h = harness();
        const r = h.ui(s, detail);
        for (const f of freqsOf(r.sources))
          expect(inKey(f), `${s} ${detail?.hero ?? '-'} ${f.toFixed(1)} Hz`).toBe(true);
        h.d.dispose();
      }
    }
  });

  it('mashing never stacks: within each cap, most of a burst skipped', () => {
    const h = harness();
    for (let i = 0; i < 40; i++) {
      for (const s of BOND_UI) h.d.playUi(s, null, { hero: HEROES[i % 3], rank: i % 10 });
      h.advance(0.02);
    }
    for (const s of BOND_UI) {
      const cap = BOND_LIMITS[s]?.[1] ?? 0;
      expect(h.stats().peakVoices[`ui:${s}`] ?? 0, s).toBeLessThanOrEqual(cap);
    }
    expect(h.stats().skipped).toBeGreaterThan(100);
    h.d.dispose();
  });

  it('a safe no-op without an AudioContext, with or without a detail', () => {
    const audio = getAudio();
    expect(() => {
      for (const s of BOND_UI) {
        audio.playUi(s);
        audio.playUi(s, null, { hero: 'kael', rank: 3 });
        audio.playUi(s, null, { hero: 'nobody', rank: Number.NaN });
      }
      audio.onEvents(
        [ev('talentFired', { hero: 2, talent: 'supernova', x: 0, z: 0, target: null })],
        {} as WorldState,
      );
    }).not.toThrow();
    audio.dispose();
  });

  it('does not throw with a context but an odd state or an unknown talent', () => {
    const h = harness();
    expect(() => {
      h.d.onEvents(
        [
          ev('talentFired', { hero: 99, talent: 'shieldbearer', x: 0, z: 0, target: null }),
          ev('talentFired', { hero: 2, talent: 'not_a_talent', x: 0, z: 0, target: null }),
          ev('talentFired', { hero: 4, talent: 'celestial_sphere', x: 0, z: 0, target: 77 }),
        ],
        { time: 0 } as unknown as WorldState,
      );
    }).not.toThrow();
    h.d.dispose();
  });
});

describe('audio lab: the Phase 4e buttons', () => {
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

  it('has a button for each talent, each alternate Solo’s start, each UI sound and each hero', () => {
    const ids = SOUNDS.map((s) => s.id);
    for (const id of TALENTS) expect(ids, id).toContain(`talent-${id}`);
    for (const solo of Object.keys(ALT_SOLO_SOUND_GROUPS))
      for (const cued of ['', '-cued']) expect(ids).toContain(`altsolo-${solo}${cued}`);
    for (const s of BOND_UI) expect(ids, s).toContain(`ui-${s}`);
    for (const hero of HEROES)
      for (const b of ['rank', 'rank-x-talent', 'talent', 'solo', 'scene', 'reply'])
        expect(ids).toContain(
          b === 'rank-x-talent' ? `bond-rank-${hero}-talent` : `bond-${b}-${hero}`,
        );
    for (const id of ['talent-vigil-burst', 'talent-oath-burst', 'talent-every'])
      expect(ids).toContain(id);
  });

  it('each makes its sound: a talent its group, a UI button the UI bus', () => {
    for (const s of SOUNDS.filter((b) => b.group === 'bonds' || b.id.startsWith('bond-'))) {
      const h = press(s.id);
      expect(h.stats().peakSources, s.id).toBeGreaterThan(0);
      const talent = /^talent-([a-z_]+)$/.exec(s.id)?.[1];
      if (talent && TALENT_SOUND_GROUPS[talent])
        expect(h.stats().peakVoices[TALENT_SOUND_GROUPS[talent]!] ?? 0, s.id).toBeGreaterThan(0);
      h.d.dispose();
    }
  });

  it('the bursts stay within their caps', () => {
    const vigil = press('talent-vigil-burst');
    expect(vigil.stats().peakVoices['talent:vigil']).toBeLessThanOrEqual(3);
    vigil.d.dispose();
    const oath = press('talent-oath-burst');
    expect(oath.stats().peakVoices['talent:oath']).toBeLessThanOrEqual(3);
    oath.d.dispose();
    const every = press('talent-every');
    for (const id of TALENTS)
      expect(every.stats().peakVoices[TALENT_SOUND_GROUPS[id]!] ?? 0, id).toBeGreaterThan(0);
    every.d.dispose();
  });
});
