/**
 * Solos (docs/solos.md), their sound: a soft tick as a hero's Solo wait begins, so a player hears
 * a Solo coming (src/audio/soloWait.ts). Read from the state each frame, with the real sim and
 * the director side by side: one tick per filling, before the Solo fires; waits that begin
 * together are one rolled voice; none for a Solo kept for later or a fight over; quiet, in key, on
 * the Effects bus (its slider and the Grand Silence's allow-list are the bus's and the mix's).
 */
import { describe, expect, it } from 'vitest';
import { SynthDirector } from '../src/audio/director';
import {
  SOLO_WAIT_GAIN,
  SOLO_WAIT_GROUP,
  SOLO_WAIT_LIMITS,
  SOLO_WAIT_MAX,
  SoloWaitTicks,
  soloWaitNote,
} from '../src/audio/soloWait';
import { isInScale } from '../src/audio/theory';
import { type Command, type Sim, type SimEvent } from '../src/sim';
import { SIM_HZ, SOLOS } from '../src/sim/constants';
import { hero, ofType, sandbox, spawn, stepFor, stepUntil, worldOf } from './sim/helpers';

// ── A small recording AudioContext: counts oscillators by frequency ──────────────────────────

type Fake = Record<string, unknown>;

function param(record?: (v: number) => void): Fake {
  return {
    value: 0,
    setValueAtTime: (v: number) => {
      record?.(v);
    },
    linearRampToValueAtTime: () => undefined,
    exponentialRampToValueAtTime: () => undefined,
    setTargetAtTime: () => undefined,
    cancelScheduledValues: () => undefined,
  };
}

function fakeNode(freqs?: number[]): Fake {
  const base: Fake = {
    connect: (to: unknown) => to,
    disconnect: () => undefined,
    start: () => undefined,
    stop: () => undefined,
  };
  if (freqs) base['frequency'] = param((v) => freqs.push(v));
  return new Proxy(base, {
    get(target, key: string) {
      if (!(key in target)) target[key] = param();
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
      'createDynamicsCompressor',
      'createWaveShaper',
      'createConvolver',
      'createBiquadFilter',
      'createStereoPanner',
      'createGain',
      'createBufferSource',
    ])
      this[name] = () => fakeNode();
    this['createOscillator'] = () => fakeNode([]);
    this['createBuffer'] = (_ch: number, length: number, sr: number) => ({
      length,
      sampleRate: sr,
      duration: length / sr,
      getChannelData: () => new Float32Array(length),
    });
  }
}

// ── The fight ───────────────────────────────────────────────────────────────────────────────

const CHARGE: Command = { t: 'debug', op: { op: 'chargeSolos' } };

/** The party against a brute that won't die (tests/sim/solos.test.ts), heard by a director. */
function fight(): { sim: Sim; d: SynthDirector; ctx: FakeContext } {
  const sim = sandbox();
  const k = hero(sim, 0);
  stepFor(sim, 1, [spawn('bell_brute', k.x, k.z - 4)]);
  for (const e of worldOf(sim).entities.list())
    if (e.enemy && e.health) e.health.hp = e.health.maxHp = 1e6;
  stepUntil(sim, () => [0, 1, 2].every((s) => hero(sim, s).hero!.targetId !== null));
  const ctx = new FakeContext();
  const d = new SynthDirector({
    context: ctx as unknown as BaseAudioContext,
    autoPump: false,
    installUnlock: false,
    followSettings: false,
  });
  d.setMood('combat');
  d.pump();
  return { sim, d, ctx };
}

/** One tick of the sim and one frame of the director, at full life; what it heard. */
function frame(
  f: ReturnType<typeof fight>,
  commands: Command[] = [],
): { events: SimEvent[]; ticks: number } {
  for (const slot of [0, 1, 2]) {
    const h = worldOf(f.sim).entities.get(f.sim.state.party[slot]!)!.health!;
    h.hp = h.maxHp;
  }
  f.sim.step(commands);
  const events = f.sim.drainEvents();
  f.ctx.currentTime += 1 / SIM_HZ;
  f.d.onEvents(events, f.sim.state);
  const waits = f.d.sfxEngine()!.soloWait;
  const before = waits.asked.ticks;
  f.d.update(f.sim.state, 1 / SIM_HZ);
  return { events, ticks: waits.asked.ticks - before };
}

describe('a soft tick as a Solo’s wait begins', () => {
  it('three Solos filled together: one rolled tick at once, before any of them fires', () => {
    const f = fight();
    const ticksAt: number[] = [];
    const firedAt: number[] = [];
    for (let t = 0; t < 5 * SIM_HZ; t++) {
      const { events, ticks } = frame(f, t === 0 ? [CHARGE] : []);
      if (ticks > 0) ticksAt.push(t);
      if (ofType(events, 'soloStarted').length > 0) firedAt.push(t);
    }
    // The three waits began on the charge's tick: one voice, three ticks in it.
    expect(ticksAt).toEqual([0]);
    expect(f.d.sfxEngine()!.soloWait.asked.ticks).toBe(3);
    expect(f.d.debugStats().peakVoices[SOLO_WAIT_GROUP]).toBe(1);
    // All three fired, a second or more after it, and none of their waits ticked again.
    expect(firedAt.length).toBe(3);
    expect(Math.min(...firedAt)).toBeGreaterThanOrEqual(SOLOS.wait * SIM_HZ - 2);
  });

  it('once per filling: a gap that starts the wait over is not ticked again; the next filling is', () => {
    const f = fight();
    const lyra = () => worldOf(f.sim).entities.get(f.sim.state.party[1]!)!.hero!;
    // Lyra alone full.
    lyra().solo = 100;
    let ticks = 0;
    for (let t = 0; t < 20; t++) ticks += frame(f).ticks;
    expect(ticks).toBe(1);
    // A gap (her target lost for a moment): the sim's wait starts over; no second tick.
    lyra().soloHeld = 0;
    lyra().targetId = null;
    ticks = 0;
    for (let t = 0; t < 3 * SIM_HZ; t++) ticks += frame(f).ticks;
    expect(ticks).toBe(0);
    // She fired; once her Solo is over and full again, her next wait ticks.
    expect(lyra().solo).toBeLessThan(100);
    for (let t = 0; t < 30 * SIM_HZ && lyra().soloActive > 0; t++) ticks += frame(f).ticks;
    expect(lyra().soloActive).toBeLessThanOrEqual(0);
    expect(ticks).toBe(0);
    lyra().solo = 100;
    ticks = 0;
    for (let t = 0; t < 20; t++) ticks += frame(f).ticks;
    expect(ticks).toBe(1);
  });

  it('no tick while no Solo is coming: not full, mid-Solo, down, or the fight over', () => {
    const f = fight();
    let ticks = 0;
    for (let t = 0; t < 30; t++) ticks += frame(f).ticks;
    expect(ticks).toBe(0);
    const w = worldOf(f.sim);
    const kael = w.entities.get(f.sim.state.party[0]!)!;
    kael.health!.downed = true;
    kael.hero!.solo = 100;
    for (let t = 0; t < 30; t++) ticks += frame(f).ticks;
    expect(ticks).toBe(0);
    kael.health!.downed = false;
    (w.encounter as { status: string }).status = 'victory';
    for (const slot of [1, 2]) w.entities.get(f.sim.state.party[slot]!)!.hero!.solo = 100;
    for (let t = 0; t < 30; t++) ticks += frame(f).ticks;
    expect(ticks).toBe(0);
  });

  it('quiet, short, in key, on the Effects bus, under one gate and a small cap', () => {
    // Quieter than the "Solo full" glass it replaces (0.045), and every note the key's own.
    expect(SOLO_WAIT_GAIN).toBeLessThan(0.045);
    for (const id of ['kael', 'lyra', 'vexis', 'brann', 'seren', 'oro'])
      expect(isInScale(soloWaitNote(id)), id).toBe(true);
    expect(SOLO_WAIT_LIMITS.cap).toBeLessThanOrEqual(2);
    expect(SOLO_WAIT_LIMITS.gate).toBeGreaterThan(0);
    // Through a stand-in host: the group, the cap and the bus it asks for, and the gate.
    const asks: { key: string; max: number; bus: string }[] = [];
    let now = 0;
    const gates = new Map<string, number>();
    const ticks = new SoloWaitTicks({
      e: {
        gate: (key: string, s: number) => {
          const last = gates.get(key);
          if (last !== undefined && now - last < s) return false;
          gates.set(key, now);
          return true;
        },
      } as never,
      play: (key, max, bus) => {
        asks.push({ key, max, bus });
        return null;
      },
    });
    const sim = sandbox();
    const party = sim.state.party.map((id) => sim.state.entities.get(id)!);
    ticks.tick(sim.state, party);
    ticks.tick(sim.state, party);
    now = SOLO_WAIT_LIMITS.gate + 0.01;
    ticks.tick(sim.state, [...party, ...party]);
    expect(asks).toEqual([
      { key: SOLO_WAIT_GROUP, max: SOLO_WAIT_LIMITS.cap, bus: 'sfx' },
      { key: SOLO_WAIT_GROUP, max: SOLO_WAIT_LIMITS.cap, bus: 'sfx' },
    ]);
    // At most SOLO_WAIT_MAX ticks in a roll.
    expect(ticks.asked.ticks).toBe(3 + SOLO_WAIT_MAX);
  });
});
