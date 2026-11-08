/**
 * Phase 5e audio: Oro, the Grovekeeper (docs/phase-5e.md, "Audio"). His voice (`hollowWood`: a
 * hollow knock, a dark pluck and a breath, never the glass), his leitmotif and Call on G3
 * appended after Seren's, his hit (F2), his Flourish (Spring Rain, not the Starbolt), his
 * heartbeat (a wooden knock), his grove's sounds in their own groups with their limits, and his
 * summons: a Sapling never has a heartbeat or a low-life alert, and the intensity scan reads
 * heroes only. The default heroes' fingerprints are pinned in tests/audioSeren.test.ts and
 * tests/audioBrann.test.ts.
 */
import { describe, expect, it } from 'vitest';
import { SynthDirector } from '../src/audio/director';
import { FakeWorld, HERO_IDS, IDS, ORO_LAB_PARTY } from '../src/audio/lab/labState';
import { SOUNDS } from '../src/audio/lab/soundBoard';
import {
  ALT_SOLO_SOUND_GROUPS,
  ORO_SOUND_GROUPS,
  ORO_SOUND_LIMITS,
  TALENT_SOUND_GROUPS,
  TALENT_SOUND_LIMITS,
} from '../src/audio/sfx';
import {
  CALL_PHRASES,
  LEITMOTIFS,
  callPhraseFor,
  heroPluckIndex,
  isInScale,
  leitmotifFor,
  midiToHz,
  scaleMidi,
} from '../src/audio/theory';
import type { UiSound, UiSoundDetail } from '../src/audio/types';
import { CONTENT } from '../src/content';
import { newGrove, type Entity, type SimEvent } from '../src/sim';
import { sandbox, worldOf } from './sim/helpers';

const ev = (type: SimEvent['type'], rest: Record<string, unknown>): SimEvent =>
  ({ type, tick: 0, ...rest }) as unknown as SimEvent;

// ── A recording fake AudioContext (as tests/audioBrann.test.ts) ──────────────────────

type Fake = Record<string, unknown>;

interface Source {
  kind: 'osc' | 'noise';
  freqs: number[];
  starts: number[];
  stops: number[];
}

const stopOf = (s: Source) => s.stops[s.stops.length - 1] ?? Infinity;

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

function director(ctx: RecordingContext, mood: 'silent' | 'combat' = 'silent') {
  const d = new SynthDirector({
    context: ctx as unknown as BaseAudioContext,
    autoPump: false,
    installUnlock: false,
    followSettings: false,
  });
  d.setMood(mood);
  d.pump();
  return d;
}

const alertsOf = (d: SynthDirector) =>
  (d as unknown as { sfx: { lowAlerts: number } }).sfx.lowAlerts;

/** A lab harness (the FakeWorld). */
function lab(world = new FakeWorld(), mood: 'silent' | 'combat' = 'combat') {
  const ctx = new RecordingContext();
  const d = director(ctx, mood);
  const stats = () => d.debugStats();
  const fire = (...events: SimEvent[]) => {
    const before = { ...stats().peakVoices };
    const n = stats().totalSources;
    const from = ctx.sources.length;
    d.onEvents(events, world.state);
    const after = stats().peakVoices;
    return {
      groups: Object.keys(after).filter((k) => (after[k] ?? 0) > (before[k] ?? 0)),
      added: stats().totalSources - n,
      sources: ctx.sources.slice(from),
    };
  };
  const ui = (sound: UiSound, detail?: UiSoundDetail) => {
    const from = ctx.sources.length;
    d.playUi(sound, null, detail);
    return { sources: ctx.sources.slice(from) };
  };
  const advance = (dt: number) => {
    ctx.currentTime += dt;
    ctx.endDue();
    world.advance(dt);
    d.pump();
  };
  return { ctx, d, world, fire, ui, advance, stats };
}

const freqsOf = (sources: Source[]) => sources.flatMap((s) => s.freqs);
/** Cents from the nearest D dorian pitch. */
const centsOff = (hz: number) => {
  const midi = 69 + 12 * Math.log2(hz / 440);
  let best = Infinity;
  for (let m = Math.floor(midi) - 1; m <= Math.ceil(midi) + 1; m++)
    if (isInScale(m)) best = Math.min(best, Math.abs(midi - m) * 100);
  return best;
};
/** In D dorian, or one of glass's or a handbell's own partials over a note that is. */
const inKey = (f: number) => [1, 2.01, 2.32, 3, 4.16, 4.25, 6.63].some((r) => centsOff(f / r) < 3);
const hasPitch = (sources: Source[], hz: number, tol = 0.5) =>
  freqsOf(sources).some((f) => Math.abs(f - hz) < tol);
/** A glass note on `hz` (its first inharmonic partial, 2.32 x; nothing else makes one). */
const glassOn = (sources: Source[], hz: number) => hasPitch(sources, hz * 2.32, 1);

const hit = (target: number, amount: number, kind: 'hit' | 'tick' = 'hit') =>
  ev('damageTaken', {
    target,
    source: IDS.enemyBase,
    amount,
    absorbed: 0,
    amplified: 0,
    aura: 0,
    radiance: 0,
    eclipse: 0,
    crit: amount > 100,
    telegraph: null,
    hit: kind,
  });

/** A lab world with Oro in it (a fourth hero, his two Saplings with him). */
const oroWorld = () => new FakeWorld({ party: ORO_LAB_PARTY });
const SAPLINGS = CONTENT.heroes.find((h) => h.id === 'oro')!.summons!.sapling!.count;

describe('the roster’s tables: Oro appended last (Phase 5e)', () => {
  it('LEITMOTIFS and CALL_PHRASES end with Seren and Oro, in that order', () => {
    expect(Object.keys(LEITMOTIFS).slice(-2)).toEqual(['seren', 'oro']);
    expect(Object.keys(CALL_PHRASES).slice(-2)).toEqual(['seren', 'oro']);
  });
  it('his talents and Homecoming have sound groups, after Seren’s', () => {
    const talents = Object.keys(TALENT_SOUND_GROUPS);
    const his = [
      ...CONTENT.talents.filter((t) => t.hero === 'oro').map((t) => t.id),
      ...CONTENT.altSolos.filter((t) => t.hero === 'oro').map((t) => t.id),
    ];
    expect(talents.slice(-his.length)).toEqual(his);
    for (const id of his) expect(TALENT_SOUND_LIMITS[id], id).toBeDefined();
    expect(ALT_SOLO_SOUND_GROUPS['homecoming']).toBe('altSolo:homecoming');
  });
});

describe('Oro’s voice: hollow wood, a dark pluck and a breath, never glass', () => {
  it('his leitmotif and Call are in his own voice, on G3, slow', () => {
    expect(LEITMOTIFS['oro']?.voice).toBe('hollowWood');
    expect(CALL_PHRASES['oro']?.voice).toBe('hollowWood');
    expect(leitmotifFor('oro')).toBe(LEITMOTIFS['oro']);
    expect(callPhraseFor('oro')).toBe(CALL_PHRASES['oro']);
    // G3 A3 B3 E4; the Call is G A B … C4 (the 7th), resolved to D4.
    expect(LEITMOTIFS['oro']!.notes.map((n) => scaleMidi(n.idx))).toEqual([55, 57, 59, 64]);
    expect(CALL_PHRASES['oro']!.notes.map((n) => scaleMidi(n.idx))).toEqual([55, 57, 59, 60]);
    expect(scaleMidi(CALL_PHRASES['oro']!.resolve)).toBe(62);
    const degree = (id: string) => (((heroPluckIndex(id) % 7) + 7) % 7) as number;
    expect(degree('oro')).toBe(3);
    for (const id of ['kael', 'lyra', 'vexis', 'brann', 'seren'])
      expect(degree(id), id).not.toBe(3);
    // Slow: the slowest onsets of the six.
    const gap = (id: string) => {
      const at = LEITMOTIFS[id]!.notes.map((n) => n.at);
      return (at[at.length - 1]! - at[0]!) / (at.length - 1);
    };
    for (const id of ['kael', 'lyra', 'vexis', 'brann', 'seren'])
      expect(gap('oro'), id).toBeGreaterThan(gap(id));
    // Over Brann's register (his A2), under Lyra's.
    const lowest = (id: string) => Math.min(...LEITMOTIFS[id]!.notes.map((n) => n.idx));
    expect(lowest('oro')).toBeGreaterThan(lowest('brann'));
  });

  it('his Cue, Call and Bond sounds are wood, not glass: every partial a scale note', () => {
    const notes = [
      ...LEITMOTIFS['oro']!.notes.map((n) => midiToHz(scaleMidi(n.idx))),
      ...CALL_PHRASES['oro']!.notes.map((n) => midiToHz(scaleMidi(n.idx))),
    ];
    const h = lab(oroWorld());
    const cue = h.fire(ev('cued', { hero: IDS.oro }));
    expect(cue.groups).toEqual(['leitmotif']);
    for (const n of LEITMOTIFS['oro']!.notes)
      expect(hasPitch(cue.sources, midiToHz(scaleMidi(n.idx)))).toBe(true);
    h.advance(3);
    const call = h.fire(
      ev('callStarted', {
        hero: IDS.oro,
        answer: 'chime',
        ability: 'regrowth',
        flourish: 'Spring Rain',
        until: 2.5,
        line: 'Lab',
      }),
    );
    for (const r of [cue, call]) {
      for (const f of freqsOf(r.sources)) expect(centsOff(f), `${f.toFixed(1)} Hz`).toBeLessThan(3);
      for (const hz of notes) expect(glassOn(r.sources, hz)).toBe(false);
      // The breath: noise in it (a pluck alone has none).
      expect(r.sources.some((s) => s.kind === 'noise')).toBe(true);
    }
    h.d.dispose();
    for (const s of ['bondRankUp', 'talentPick', 'soloPick'] as UiSound[]) {
      const k = lab();
      const r = k.ui(s, { hero: 'oro', rank: 4 });
      for (const hz of notes) expect(glassOn(r.sources, hz), `${s} ${hz}`).toBe(false);
      expect(
        freqsOf(r.sources).some((f) => Math.round(69 + 12 * Math.log2(f / 440)) % 12 === 7),
        s,
      ).toBe(true);
      k.d.dispose();
    }
  });

  it('his hit is his own pitch (F2, 87.3 Hz); his Flourish is Spring Rain, not the Starbolt', () => {
    const h = lab(oroWorld());
    const r = h.fire(hit(IDS.oro, 100));
    const max = h.world.state.entities.get(IDS.oro)!.health!.maxHp;
    expect(max).toBe(CONTENT.heroes.find((x) => x.id === 'oro')!.maxHp);
    expect(hasPitch(r.sources, 87.3 * (1 + (100 / max) * 0.5), 0.01)).toBe(true);
    h.d.dispose();
    for (const name of ['Spring Rain', 'Lab']) {
      const f = lab(oroWorld());
      const fl = f.fire(ev('flourish', { hero: IDS.oro, name, x: 0, z: 4, radius: 0 }));
      expect(fl.groups, name).toEqual(['bigFlourish']);
      // His G3 and D4 knocked; the rain's drops; all in key.
      expect(hasPitch(fl.sources, midiToHz(55)), name).toBe(true);
      expect(hasPitch(fl.sources, midiToHz(62)), name).toBe(true);
      for (const x of freqsOf(fl.sources)) expect(inKey(x), `${name} ${x}`).toBe(true);
      f.d.dispose();
    }
  });

  it('his heartbeat is a wooden knock, not Kael’s thump', () => {
    const h = lab(oroWorld(), 'silent');
    h.d.setLowLifeAlert(false);
    h.world.setHeroHp('oro', 0.2);
    for (let i = 0; i < 20; i++) {
      h.advance(0.1);
      h.d.update(h.world.state, 0.1);
    }
    expect(h.stats().peakVoices['heart:oro'] ?? 0).toBeGreaterThan(0);
    expect(h.stats().peakVoices['heart:kael'] ?? 0).toBe(0);
    const freqs = freqsOf(h.ctx.sources);
    expect(freqs.some((f) => Math.abs(f - 62) < 0.01)).toBe(false);
    expect(freqs.some((f) => Math.abs(f - 98) < 0.01)).toBe(true);
    h.d.dispose();
  });
});

describe('his grove’s sounds', () => {
  const fired = (setup: (w: FakeWorld) => void, ...events: SimEvent[]) => {
    const h = lab(oroWorld());
    h.world.setEnemies(3);
    setup(h.world);
    const r = h.fire(...events);
    h.d.dispose();
    return r;
  };
  const none = () => undefined;
  const sapling = IDS.sapling;
  const groveHeal = (target: number) =>
    ev('healApplied', { target, source: IDS.weaver, amount: 12, overheal: 0, via: 'grove' });

  it('each plays in its own group, in key, and each is its own', () => {
    const cases: [string, (w: FakeWorld) => void, SimEvent][] = [
      [
        ORO_SOUND_GROUPS.sprout,
        none,
        ev('summonSpawned', { owner: IDS.oro, summon: sapling, kind: 'sapling' }),
      ],
      [ORO_SOUND_GROUPS.saplingHurt, none, hit(sapling, 40)],
      [
        ORO_SOUND_GROUPS.saplingFell,
        none,
        ev('summonFell', { owner: IDS.oro, summon: sapling, kind: 'sapling' }),
      ],
      [ORO_SOUND_GROUPS.rootbond, none, groveHeal(sapling)],
      [
        ORO_SOUND_GROUPS.wildgrowth,
        none,
        ev('soloStarted', { hero: IDS.oro, solo: 'wildgrowth', cued: false, duration: 8 }),
      ],
      [ORO_SOUND_GROUPS.ancientRoot, none, ev('rooted', { target: IDS.enemyBase, seconds: 1.5 })],
      [ORO_SOUND_GROUPS.gentle, none, ev('gentleRefused', { hero: IDS.oro })],
    ];
    const sigs = new Set<string>();
    for (const [group, setup, e] of cases) {
      const r = fired(setup, e);
      expect(r.groups, group).toEqual([group]);
      for (const f of freqsOf(r.sources)) expect(inKey(f), `${group} ${f.toFixed(1)}`).toBe(true);
      sigs.add(`${r.sources.length}:${freqsOf(r.sources).join(',')}`);
    }
    // The Ancient's rise and withering, and a burrow (read from the state), on their own too.
    const rise = fired(
      (w) => w.setAncient(true),
      ev('summonSpawned', { owner: IDS.oro, summon: IDS.ancient, kind: 'ancient' }),
    );
    const wither = fired(
      none,
      ev('summonFell', { owner: IDS.oro, summon: IDS.ancient, kind: 'ancient' }),
    );
    for (const r of [rise, wither]) {
      expect(r.groups).toEqual([ORO_SOUND_GROUPS.wildgrowth]);
      sigs.add(`${r.sources.length}:${freqsOf(r.sources).join(',')}`);
    }
    expect(sigs.size).toBe(cases.length + 2);
    // A blow on a Sapling is never a hero's hit (nor a hit on Oro a Sapling's).
    expect(fired(none, hit(sapling, 40)).groups).not.toContain('hit');
    expect(fired(none, hit(IDS.oro, 40)).groups).toEqual(['hit']);
  });

  it('a Rally’s re-plant burrows each Sapling once, read from the state', () => {
    const h = lab(oroWorld());
    h.d.update(h.world.state, 0.1);
    const before = h.stats().peakVoices[ORO_SOUND_GROUPS.burrow] ?? 0;
    expect(before).toBe(0);
    h.world.setBurrow(0, h.world.time + 0.8);
    const n0 = h.stats().totalSources;
    h.d.update(h.world.state, 0.1);
    expect(h.stats().peakVoices[ORO_SOUND_GROUPS.burrow] ?? 0).toBe(1);
    // The same burrow is not heard again.
    h.advance(0.4);
    const n1 = h.stats().totalSources;
    h.d.update(h.world.state, 0.1);
    expect(h.stats().totalSources).toBe(n1);
    expect(n1).toBeGreaterThan(n0);
    // A new Rally later burrows it again.
    h.advance(1);
    h.world.setBurrow(0, h.world.time + 0.8);
    const n2 = h.stats().totalSources;
    h.d.update(h.world.state, 0.1);
    expect(h.stats().totalSources).toBeGreaterThan(n2);
    h.d.dispose();
  });

  it('roots are deeper while the Ancient stands', () => {
    const root = ev('rooted', { target: IDS.enemyBase, seconds: 1.5 });
    const plain = fired(none, root);
    const deep = fired((w) => w.setAncient(true), root);
    expect(deep.added).toBeGreaterThan(plain.added);
    expect(hasPitch(deep.sources, midiToHz(38))).toBe(true);
    expect(hasPitch(plain.sources, midiToHz(38))).toBe(false);
  });

  it('the frequent ones are gated: Saplings struck, Rootbond’s heals, his refusals', () => {
    for (const [group, e] of [
      ['saplingHurt', hit(sapling, 30)],
      ['rootbond', groveHeal(sapling)],
      ['gentle', ev('gentleRefused', { hero: IDS.oro })],
    ] as const) {
      const h = lab(oroWorld());
      let heard = 0;
      for (let i = 0; i < 40; i++) {
        heard += h.fire(e).added > 0 ? 1 : 0;
        h.advance(0.025);
      }
      const [gate, cap] = ORO_SOUND_LIMITS[group];
      expect(gate, group).toBeGreaterThanOrEqual(0.6);
      expect(heard, group).toBeGreaterThanOrEqual(1);
      expect(heard, group).toBeLessThanOrEqual(Math.ceil(1 / gate) + 1);
      expect(h.stats().peakVoices[ORO_SOUND_GROUPS[group]] ?? 0, group).toBeLessThanOrEqual(cap);
      h.d.dispose();
    }
  });
});

describe('his summons: never a heartbeat or an alert; the intensity scan reads heroes only', () => {
  /** Six seconds of frames: the heartbeat groups heard, the alerts, the last intensity. */
  const watch = (w: FakeWorld) => {
    const h = lab(w, 'combat');
    for (let i = 0; i < 60; i++) {
      h.advance(0.1);
      h.d.update(h.world.state, 0.1);
    }
    const out = {
      hearts: Object.keys(h.stats().peakVoices).filter((k) => k.startsWith('heart:')),
      alerts: alertsOf(h.d),
      intensity: (h.d as unknown as { sfx: { debugIntensity: number } }).sfx.debugIntensity,
    };
    h.d.dispose();
    return out;
  };

  it('Saplings and the Ancient at 5%, or one at 0 and dead: silence (FakeWorld)', () => {
    const w = oroWorld();
    w.setEnemies(3);
    expect(w.state.entities.list().filter((e) => e.kind === 'summon').length).toBe(SAPLINGS);
    for (let i = 0; i < SAPLINGS; i++) w.setSaplingHp(i, 0.05);
    w.setAncient(true);
    w.entities.get(IDS.ancient)!.health.hp = 10;
    const low = watch(w);
    expect(low.hearts).toEqual([]);
    expect(low.alerts).toBe(0);
    // The intensity is the enemies' alone: the same as with no summon at all.
    const bare = oroWorld();
    bare.setEnemies(3);
    bare.setSaplings(0);
    expect(watch(bare).intensity).toBeCloseTo(low.intensity, 9);
    // Oro himself, low, still has his.
    const oro = oroWorld();
    oro.setHeroHp('oro', 0.1);
    const his = watch(oro);
    expect(his.hearts).toEqual(['heart:oro']);
    expect(his.alerts).toBe(1);
  });

  it('a summon in the real sim’s state, at 5%: no heartbeat, no alert', () => {
    const ctx = new RecordingContext();
    const d = director(ctx);
    const sim = sandbox({ party: ['kael', 'lyra', 'oro'] });
    sim.step([]);
    const world = worldOf(sim);
    const oro = world.entities.get(sim.state.party[2]!)!;
    oro.hero!.grove ??= newGrove();
    const s: Entity = world.entities.spawn('summon', {
      x: oro.x,
      z: oro.z + 5,
      radius: 0.55,
      team: 'party',
      health: {
        hp: 19,
        maxHp: 380,
        shields: [],
        statuses: [],
        invulnerable: 0,
        downed: false,
        bleedOut: 0,
        revive: 0,
        dead: false,
        lastHitAt: 0,
        incoming: 0,
      },
      summon: {
        owner: oro.id,
        kind: 'sapling',
        index: 0,
        targetId: null,
        attackCooldown: 0,
        tauntAt: 0,
        plantX: oro.x,
        plantZ: oro.z + 5,
        mendHealAcc: 0,
        auraHealAcc: 0,
      },
    });
    oro.hero!.grove.saplings.push(s.id);
    for (let i = 0; i < 24; i++) {
      ctx.currentTime += 0.25;
      ctx.endDue();
      sim.step([]);
      s.health!.hp = 19;
      d.update(sim.state, 0.25);
    }
    expect(sim.state.entities.get(s.id)?.kind).toBe('summon');
    const hearts = Object.keys(d.debugStats().peakVoices).filter((k) => k.startsWith('heart:'));
    expect(hearts).toEqual([]);
    expect(alertsOf(d)).toBe(0);
    d.dispose();
  }, 30_000);
});

describe('audio lab: Oro is opt-in, his Saplings with him', () => {
  const press = (id: string) => {
    const s = SOUNDS.find((b) => b.id === id);
    expect(s, id).toBeDefined();
    const h = lab();
    s?.fire(h.d, h.world);
    let t = 0;
    for (const f of s?.then ?? []) {
      while (t + 1e-9 < f.delay) {
        h.advance(0.05);
        t += 0.05;
      }
      f.fire(h.d, h.world);
    }
    return h;
  };

  it('his Saplings come with him, stay through new enemies, and leave with him', () => {
    const w = new FakeWorld({ party: ORO_LAB_PARTY });
    expect(w.state.party).toEqual([IDS.kael, IDS.lyra, IDS.vexis, IDS.oro]);
    const summons = () => w.state.entities.list().filter((e) => e.kind === 'summon');
    expect(summons().map((e) => e.id)).toEqual(
      Array.from({ length: SAPLINGS }, (_, i) => IDS.sapling + i),
    );
    expect(w.entities.get(IDS.oro)!.hero!.grove!.saplings).toHaveLength(SAPLINGS);
    w.setEnemies(6);
    expect(summons()).toHaveLength(SAPLINGS);
    // Clear of the enemies' ids.
    for (const e of summons()) expect(w.entities.get(e.id)!.kind).toBe('summon');
    w.setParty(HERO_IDS);
    expect(summons()).toHaveLength(0);
    expect(w.entities.has(IDS.oro)).toBe(false);
    // The default world has none.
    expect(new FakeWorld().state.entities.list().some((e) => e.kind === 'summon')).toBe(false);
  });

  it('every Oro button makes its sound, bringing him in', () => {
    const ids = SOUNDS.filter((s) => s.group === 'oro').map((s) => s.id);
    expect(ids.length).toBeGreaterThanOrEqual(15);
    for (const id of ids) {
      const h = press(id);
      if (id !== 'oro-saplings-low') expect(h.stats().peakSources, id).toBeGreaterThan(0);
      expect(h.world.heroes(), id).toContain('oro');
      h.d.dispose();
    }
    const groupOf = (id: string, group: string) => {
      const h = press(id);
      const n = h.stats().peakVoices[group] ?? 0;
      h.d.dispose();
      return n;
    };
    expect(groupOf('oro-sprout', ORO_SOUND_GROUPS.sprout)).toBeGreaterThan(0);
    expect(groupOf('oro-sapling-hurt', ORO_SOUND_GROUPS.saplingHurt)).toBe(1);
    expect(groupOf('oro-burrow', ORO_SOUND_GROUPS.burrow)).toBeGreaterThan(0);
    expect(groupOf('oro-wildgrowth', ORO_SOUND_GROUPS.wildgrowth)).toBeGreaterThan(0);
    expect(groupOf('oro-wildgrowth', ORO_SOUND_GROUPS.ancientRoot)).toBeGreaterThan(0);
    expect(groupOf('oro-wildgrowth-cued', 'leitmotif')).toBeGreaterThan(0);
    expect(groupOf('oro-heartbeat', 'heart:oro')).toBeGreaterThan(0);
    // His Saplings low: nothing at all (no heartbeat, no alert).
    const quiet = press('oro-saplings-low');
    expect(Object.keys(quiet.stats().peakVoices).filter((k) => k.startsWith('heart:'))).toEqual([]);
    expect(alertsOf(quiet.d)).toBe(0);
    quiet.d.dispose();
  });

  it('his talent, alternate Solo and Bond UI buttons', () => {
    const ids = SOUNDS.map((s) => s.id);
    for (const t of [
      ...CONTENT.talents.filter((x) => x.hero === 'oro'),
      ...CONTENT.altSolos.filter((x) => x.hero === 'oro'),
    ])
      expect(ids).toContain(`talent-${t.id}`);
    for (const cued of ['', '-cued']) expect(ids).toContain(`altsolo-homecoming${cued}`);
    for (const b of ['rank', 'talent', 'solo', 'scene', 'reply'])
      expect(ids).toContain(`bond-${b}-oro`);
  });
});
