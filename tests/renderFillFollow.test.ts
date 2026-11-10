/**
 * Phase 5g presentation follow-ups (render): Concert Pitch's Ringing, the Spare Strings and Water
 * Clock relic cues, and the fill's world cues checked against the real sim now that its content
 * is merged (Razor Silk's bite against its real damage ticks, Thread the Needle's real catch, the
 * trigger table against the real content, the two trigger Harmonies, Cutting Chorus's crits and
 * Spindle Lullaby's sleeps through the existing damage-number and status visuals), and the VFX
 * lab's fill scenarios played in Node. Every check drives a real headless sim and feeds its state
 * and events to the real views over a real FxKit.
 */
import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { CONTENT } from '../src/content';
import { FILL_IDS } from '../src/content/fill';
import { CallView } from '../src/render/calls';
import { EntityLayer } from '../src/render/entities';
import { FermataView } from '../src/render/fermata';
import { Feedback } from '../src/render/feedback';
import { FieldView } from '../src/render/field';
import { CUE_LOOK, FillView } from '../src/render/fill';
import {
  CLOCK_FLIPPED,
  RINGING_FADE,
  RelicFlips,
  SPARE_FLIPPED,
  TRIGGER_KINDS,
  razorBit,
  ringStruck,
  ringingLeft,
  ringingLevel,
  triggerCue,
} from '../src/render/fillCues';
import { FxKit } from '../src/render/fx/kit';
import { FILL_SCENARIOS, FILL_SCENARIO_NAMES } from '../src/render/lab/fillScenarios';
import { createModelMaterial } from '../src/render/models/material';
import type { Overlay } from '../src/render/overlay';
import type { Stage } from '../src/render/stage';
import { TelegraphLayer } from '../src/render/telegraphs';
import { ThreadView } from '../src/render/thread';
import type { CameraRig } from '../src/render/camera';
import type { FrameInfo } from '../src/render/types';
import type { Command, Sim, SimConfig, SimEvent } from '../src/sim';
import { RAZOR_TICK } from '../src/sim/fill/silk';
import type { Entity } from '../src/sim/state';
import { ofType, sandbox, worldOf } from './sim/helpers';
import { cone, foe, place, setup as serenSetup } from './sim/serenHelpers';

const SETTINGS: FrameInfo['settings'] = {
  screenShake: 1,
  flashes: 1,
  damageNumbers: true,
  colorVision: 'normal',
};

type Held = { id: string; level: number }[];
const held = (...ids: string[]): Held => ids.map((id) => ({ id, level: 1 }));

/** Records the callouts and numbers the views ask for, and ignores the rest. */
class FakeOverlay {
  width = 1280;
  height = 720;
  callouts: { text: string; color: string }[] = [];
  numbers: { text: string; target: number }[] = [];
  private spawned: number[] = [];
  callout(_x: number, _y: number, _z: number, text: string, color: string): void {
    this.callouts.push({ text, color });
  }
  spawnNumber(): number {
    this.spawned.push(this.numbers.length);
    this.numbers.push({ text: '', target: -1 });
    return this.numbers.length - 1;
  }
  setNumber(handle: number, text: string): void {
    const n = this.numbers[handle];
    if (n) n.text = text;
  }
  numberAlive(): boolean {
    return true;
  }
  beginFrame(): void {}
  badge(): void {}
  allyBar(): void {}
  raid(): void {}
  flash(): void {}
  coolFlash(): void {}
  chroma(): void {}
  spotlight(): void {}
  danger(): void {}
  setStasis(): void {}
  bubble(): void {}
  edgeArrow(): void {}
}

/** The real FillView (and the views it rides on) over a real FxKit, a sim tick a frame. */
function harness(sim: Sim) {
  const kit = new FxKit();
  const entities = new EntityLayer(createModelMaterial());
  const thread = new ThreadView(entities, null);
  const overlay = new FakeOverlay();
  const view = new FillView({ kit, recs: entities.recs, thread, overlay });
  const cam = new THREE.Vector3(0, 22, 18);
  let time = 0;
  /** One frame as the game plays it: the tick's events handed over, then the frame drawn. */
  const tick = (
    commands: Command[] = [],
    flashes = 1,
    before?: () => void,
    extra: SimEvent[] = [],
  ) => {
    sim.step(commands);
    before?.();
    const ev = [...sim.drainEvents(), ...extra];
    view.handle(ev, sim.state);
    const frame: FrameInfo = {
      realDt: 1 / 60,
      time,
      alpha: 1,
      hoveredHero: null,
      hoveredEnemy: null,
      aim: null,
      settings: { ...SETTINGS, flashes },
    };
    kit.begin(time, cam);
    entities.sync(sim.state, frame, kit, 1 / 60);
    thread.sync(sim.state, kit, 1 / 60, time);
    const was = { rings: kit.rings.size, sprites: kit.sprites.size, ribbons: kit.ribbons.vertices };
    view.sync(sim.state, 1 / 60, time, flashes);
    const mine = {
      rings: kit.rings.size - was.rings,
      sprites: kit.sprites.size - was.sprites,
      ribbons: kit.ribbons.vertices - was.ribbons,
    };
    kit.end(1 / 60, 1280, 720, 720, 45);
    time += 1 / 60;
    return { events: ev, mine, drawn: { ...view.drawn } };
  };
  return { kit, entities, thread, view, overlay, tick };
}

/** A sandbox holding `motifs` (and `config`), one tick in. */
function stage(motifs: Held, config: Partial<SimConfig> = {}) {
  const sim = sandbox({ ...config, motifs });
  const h = harness(sim);
  h.tick();
  const w = worldOf(sim);
  const hero = (slot: number): Entity => w.entities.get(w.party[slot]!)!;
  return { sim, w, h, hero, weaver: w.entities.get(w.weaverId)! };
}

const ward = (slot: number): Command => ({ t: 'tech', id: 'ward', slot: slot as 0 | 1 | 2 });

/** A Perfect Ward on Kael against a Toll Cleave, played frame by frame through the harness. */
function perfectOnKael(s: ReturnType<typeof stage>) {
  const kael = s.hero(0);
  const brute = foe(s.w, 'bell_brute', kael.x, kael.z - 2, { hp: 1e7, stun: true });
  const t = cone(s.w, brute, kael, kael.id, { impact: 1, damage: 50 });
  let perfect = false;
  for (let i = 0; i < 600 && s.w.time < t.perfectFrom + 0.05; i++) s.h.tick();
  const first = s.h.tick([ward(0)]);
  perfect ||= first.events.some((e) => e.type === 'perfectWard');
  for (let i = 0; i < 600 && !perfect; i++)
    perfect = s.h.tick().events.some((e) => e.type === 'perfectWard');
  expect(perfect).toBe(true);
  return { brute };
}

// ── Concert Pitch's Ringing ─────────────────────────────────────────────────────────────────

describe('Concert Pitch’s Ringing, drawn', () => {
  it('on every standing hero exactly while field.ringing is ahead of the sim, fading as it ends', () => {
    const s = stage(held('concert_pitch'));
    expect(s.h.tick().drawn.ringing).toBe(0);
    perfectOnKael(s);
    const until = s.w.field.ringing!;
    expect(until).toBeGreaterThan(s.w.time);
    let frames = 0;
    let fading = 0;
    let lastLevel = 1;
    for (let i = 0; i < 60 * 12; i++) {
      const f = s.h.tick();
      const rings = (s.w.field.ringing ?? 0) > s.w.time;
      expect(f.drawn.ringing > 0, `t ${s.w.time.toFixed(3)}`).toBe(rings);
      if (rings) {
        frames++;
        expect(f.drawn.ringing).toBe(3);
        const level = ringingLevel(s.w);
        if (ringingLeft(s.w) < RINGING_FADE) {
          fading++;
          expect(level).toBeLessThan(1);
          expect(level).toBeLessThanOrEqual(lastLevel + 1e-9);
        } else expect(level).toBe(1);
        lastLevel = level;
      }
    }
    expect(frames).toBeGreaterThan(60 * 3);
    expect(fading).toBeGreaterThan(20);
    // Gone once it ends; nothing else of the fill drawn or kept.
    expect(ringingLevel(s.w)).toBe(0);
    expect(s.h.tick().drawn.ringing).toBe(0);
  });

  it('a hero who is down shows none; upright gold streaks only: no ring, nothing at the feet', () => {
    const s = stage(held('concert_pitch'));
    s.w.field.ringing = s.w.time + 3;
    const vexis = s.hero(2);
    vexis.health!.downed = true;
    const f = s.h.tick();
    expect(f.drawn.ringing).toBe(2);
    // Two sprites a streak, three streaks a hero; not one ring (an aura's look is rings).
    expect(f.mine.rings).toBe(0);
    expect(f.mine.ribbons).toBe(0);
    expect(f.mine.sprites).toBeGreaterThan(0);
    expect(f.mine.sprites).toBeLessThanOrEqual(2 * 3 * 2);
    // Every streak is drawn upright (rotated a quarter turn) and long (stretched), above the feet.
    const pos = s.h.kit.sprites.array('iPos');
    const size = s.h.kit.sprites.array('iSize');
    let streaks = 0;
    for (let i = 0; i < s.h.kit.sprites.size; i++) {
      if (Math.abs(pos[i * 4 + 3]! - Math.PI / 2) > 1e-6) continue;
      streaks++;
      expect(size[i * 4]! / size[i * 4 + 1]!).toBeGreaterThanOrEqual(6 - 1e-6);
    }
    expect(streaks).toBeGreaterThan(0);
  });

  it('Flashes 0 draws the same streaks; nothing on a world without Concert Pitch', () => {
    const s = stage(held('concert_pitch'));
    s.w.field.ringing = s.w.time + 3;
    const on = s.h.tick([], 1);
    const off = s.h.tick([], 0);
    expect(off.drawn.ringing).toBe(on.drawn.ringing);
    expect(off.mine.sprites).toBe(on.mine.sprites);
    // Without the key: a Perfect Ward rings nothing, draws nothing and allocates nothing.
    const none = stage([]);
    perfectOnKael(none);
    expect('ringing' in none.w.field).toBe(false);
    for (let i = 0; i < 120; i++) {
      const f = none.h.tick();
      expect(f.drawn.ringing).toBe(0);
      expect(f.mine).toEqual({ rings: 0, sprites: 0, ribbons: 0 });
    }
    expect(none.h.view.allocated).toBe(false);
  });

  it('ringStruck: a start, a re-strike while it rings, nothing for the same ring or a past one', () => {
    expect(ringStruck(undefined, undefined, 1)).toBe(null);
    expect(ringStruck(undefined, 5, 1)).toBe('start');
    expect(ringStruck(5, 5, 2)).toBe(null);
    expect(ringStruck(5, 7, 3)).toBe('restrike');
    expect(ringStruck(5, 9, 6)).toBe('start');
    expect(ringStruck(5, 4.5, 4)).toBe(null);
    expect(ringStruck(undefined, 3, 4)).toBe(null);
  });
});

// ── Spare Strings and Water Clock ───────────────────────────────────────────────────────────

describe('Spare Strings and Water Clock: a relic cue when the flag turns on in a fight', () => {
  it('RelicFlips: a flag turning on while watched is a flip; one already on at the first read is not', () => {
    const s = stage([]);
    const flips = new RelicFlips();
    expect(flips.read(s.w)).toBe(0);
    s.w.entities.get(s.w.weaverId)!.weaver!.spareUsed = true;
    expect(flips.read(s.w)).toBe(SPARE_FLIPPED);
    expect(flips.read(s.w)).toBe(0);
    s.w.internal.waterClockUsed = true;
    expect(flips.read(s.w)).toBe(CLOCK_FLIPPED);
    // A loaded fight: both already on the first time it is read.
    const loaded = stage([]);
    loaded.w.entities.get(loaded.w.weaverId)!.weaver!.spareUsed = true;
    loaded.w.internal.waterClockUsed = true;
    expect(new RelicFlips().read(loaded.w)).toBe(0);
    expect(flips.read(loaded.w)).toBe(0);
  });

  it('Spare Strings, in the real sim: the range snap it forgives plays its cue once and names it', () => {
    const s = stage([], { relics: ['spare_strings'] });
    s.h.tick([{ t: 'thread', slot: 0 }]);
    for (let i = 0; i < 20; i++) s.h.tick();
    const kael = s.hero(0);
    let spares = 0;
    let frames = 0;
    let snapped = false;
    for (let i = 0; i < 90; i++) {
      const f = s.h.tick(
        i === 0
          ? [{ t: 'debug', op: { op: 'teleportWeaver', x: kael.x - 16, z: kael.z + 9 } }]
          : [],
      );
      snapped ||= f.events.some((e) => e.type === 'threadSnapped');
      if (f.drawn.spares > 0) frames++;
      spares = s.h.view.fired.spares;
    }
    expect(snapped).toBe(true);
    expect(s.w.entities.get(s.w.weaverId)!.weaver!.spareUsed).toBe(true);
    expect(spares).toBe(1);
    expect(s.h.view.targetsOf('spare')).toEqual([]);
    expect(frames).toBeGreaterThan(30);
    const name = CONTENT.relics.find((r) => r.id === 'spare_strings')!.name.toUpperCase();
    expect(s.h.overlay.callouts.map((c) => c.text)).toEqual([name]);
    // A second snap in the same fight: no flag change, no cue.
    s.h.tick([{ t: 'thread', slot: 0 }]);
    for (let i = 0; i < 30; i++) s.h.tick();
    for (let i = 0; i < 60; i++)
      s.h.tick(
        i === 0
          ? [{ t: 'debug', op: { op: 'teleportWeaver', x: kael.x + 16, z: kael.z + 9 } }]
          : [],
      );
    expect(s.h.view.fired.spares).toBe(1);
  });

  it('Water Clock, in the real sim: over the hero it stood up again, once, named', () => {
    const s = stage([], { relics: ['water_clock'] });
    for (let i = 0; i < 60 * 3.2; i++) s.h.tick();
    const kael = s.hero(0);
    let at: number[] = [];
    for (let i = 0; i < 60 * 8 && s.h.view.fired.clocks === 0; i++) {
      const f = s.h.tick(i === 0 ? [{ t: 'debug', op: { op: 'forceHold', slot: 0 } }] : []);
      if (s.h.view.fired.clocks > 0) {
        at = s.h.view.targetsOf('clock');
        expect(ofType(f.events, 'revived').map((e) => e.hero)).toContain(kael.id);
        expect(f.drawn.clocks).toBe(1);
      }
    }
    expect(s.w.internal.waterClockUsed).toBe(true);
    expect(s.h.view.fired.clocks).toBe(1);
    expect(at).toEqual([kael.id]);
    expect(s.h.overlay.callouts.map((c) => c.text)).toEqual([
      CONTENT.relics.find((r) => r.id === 'water_clock')!.name.toUpperCase(),
    ]);
  });

  it('nothing on a world without either relic, through downs and snaps', () => {
    const s = stage([]);
    s.h.tick([{ t: 'thread', slot: 0 }]);
    const kael = s.hero(0);
    for (let i = 0; i < 60 * 6; i++) {
      const f = s.h.tick(
        i === 30
          ? [{ t: 'debug', op: { op: 'teleportWeaver', x: kael.x - 16, z: kael.z + 9 } }]
          : i === 60
            ? [{ t: 'debug', op: { op: 'forceHold', slot: 1 } }]
            : [],
      );
      expect(f.mine).toEqual({ rings: 0, sprites: 0, ribbons: 0 });
    }
    expect(s.h.view.fired.spares + s.h.view.fired.clocks).toBe(0);
    expect(s.h.view.allocated).toBe(false);
    expect(s.h.overlay.callouts).toEqual([]);
  });
});

// ── Against the real sim: Razor Silk ────────────────────────────────────────────────────────

describe('Razor Silk against the real sim (sim/fill/silk.ts)', () => {
  /** Razor Silk held, the Thread on Kael, a chorister held on the Thread's middle. */
  function razor() {
    const s = stage(held('razor_silk'));
    s.h.tick([{ t: 'thread', slot: 0 }]);
    const kael = s.hero(0);
    const on = foe(s.w, 'hollow_chorister', (s.weaver.x + kael.x) / 2, (s.weaver.z + kael.z) / 2, {
      hp: 1e7,
      stun: true,
    });
    const hold = () => {
      place(on, (s.weaver.x + kael.x) / 2, (s.weaver.z + kael.z) / 2);
      on.health!.hp = on.health!.maxHp;
    };
    return { ...s, on, hold };
  }
  const cuts = (events: readonly SimEvent[], weaver: number, target: number) =>
    ofType(events as SimEvent[], 'damageTaken').filter(
      (e) => e.source === weaver && e.target === target,
    ).length;

  it('a bite follows each real damage tick, and only then: not when its clock is set up, or set up again', () => {
    const r = razor();
    let ticks = 0;
    let wrong = 0;
    const play = (frames: number, each?: () => void) => {
      for (let i = 0; i < frames; i++) {
        const bites = r.h.view.fired.bites;
        const f = r.h.tick([], 1, () => {
          r.hold();
          each?.();
        });
        const cut = cuts(f.events, r.w.weaverId, r.on.id);
        ticks += cut;
        if (r.h.view.fired.bites - bites !== cut) wrong++;
      }
    };
    play(60 * 4);
    expect(ticks).toBeGreaterThanOrEqual(6);
    // The Thread off for two seconds, then back: its clock is set up again (no damage, no bite).
    const ww = r.weaver.weaver!;
    play(60 * 2, () => {
      ww.threadSlot = null;
    });
    const before = ticks;
    play(Math.round((RAZOR_TICK * 60) / 2), () => {
      ww.threadSlot = 0;
    });
    expect(ticks).toBe(before);
    play(60 * 3, () => {
      ww.threadSlot = 0;
    });
    expect(ticks).toBeGreaterThan(before);
    expect(wrong).toBe(0);
    expect(r.h.view.fired.bites).toBe(ticks);
  });

  it('razorBit reads the sim’s three clock moves: created, set up again, ticked', () => {
    // Created (first read): no bite. Ticked (due, moved a tick on): a bite. Set up again after
    // more than a tick behind: no bite. A clock that went back (a new fight): no bite.
    expect(razorBit(undefined, 10.5, 10)).toBe(false);
    expect(razorBit(10.5, 11, 10.5)).toBe(true);
    expect(razorBit(10.5, 11, 10.5 + 5 / 60)).toBe(true);
    expect(razorBit(10.5, 13.5, 13)).toBe(false);
    expect(razorBit(10.5, 2, 1.5)).toBe(false);
    expect(razorBit(10.5, 10.5, 10.6)).toBe(false);
  });
});

// ── Against the real sim: Thread the Needle ─────────────────────────────────────────────────

describe('Thread the Needle against the real sim', () => {
  it('the real catch’s `needled` names the hero the Thread moved onto, and the view draws it there', () => {
    const s = stage(held('thread_the_needle'));
    const kael = s.hero(0);
    const brute = foe(s.w, 'bell_brute', kael.x, kael.z - 2, { hp: 1e6, stun: true });
    s.h.tick([{ t: 'thread', slot: 1 }]);
    for (let i = 0; i < 60; i++) s.h.tick();
    const t = cone(s.w, brute, kael, kael.id, { impact: 1, damage: 400 });
    while (s.w.time < t.impact - 0.2) s.h.tick();
    const seen: SimEvent[] = [];
    seen.push(...s.h.tick([{ t: 'thread', slot: 0 }]).events);
    let drawnOn: number[] = [];
    for (let i = 0; i < 120 && ofType(seen, 'needled').length === 0; i++) {
      const f = s.h.tick();
      seen.push(...f.events);
      if (ofType(f.events, 'needled').length > 0) {
        drawnOn = s.h.view.targetsOf('needle');
        expect(f.drawn.needles).toBe(1);
      }
    }
    const caught = ofType(seen, 'needled');
    expect(caught).toHaveLength(1);
    const e = caught[0]!;
    // What the views read: `hero` (the cue's place, the sound's pan); the rest is carried.
    expect(e.hero).toBe(kael.id);
    expect(e.telegraph).toBe(t.id);
    expect(e.negated).toBeGreaterThan(0);
    expect(s.w.entities.get(e.hero)?.hero).toBeDefined();
    expect(drawnOn).toEqual([kael.id]);
    expect(s.h.view.fired.needles).toBe(1);
  });
});

// ── Against the real content: the trigger table ─────────────────────────────────────────────

describe('the trigger table against the real content', () => {
  const withTriggers = [CONTENT.motifs, CONTENT.relics, CONTENT.boons].flatMap((list) =>
    (
      list as readonly {
        id: string;
        triggers?: readonly { effects: readonly { kind: string }[] }[];
      }[]
    ).filter((d) => (d.triggers?.length ?? 0) > 0),
  );

  it('every fill entry with a trigger plays the kind of its trigger’s first effect', () => {
    const fill = withTriggers.filter((d) => FILL_IDS.includes(d.id));
    expect(fill.length).toBe(37);
    for (const d of fill) expect(triggerCue(d.id), d.id).toBe(d.triggers![0]!.effects[0]!.kind);
  });

  it('the table names exactly the entries content gives a trigger, each as content does', () => {
    expect(Object.keys(TRIGGER_KINDS).sort()).toEqual(withTriggers.map((d) => d.id).sort());
    for (const d of withTriggers)
      expect(TRIGGER_KINDS[d.id], d.id).toBe(d.triggers![0]!.effects[0]!.kind);
  });
});

// ── The ten Harmonies ───────────────────────────────────────────────────────────────────────

describe('the Harmonies’ looks', () => {
  it('Guardian’s Cadence, in the real sim: Kael’s bash fires it and its damage cue lands on an enemy it struck', () => {
    const s = stage(held('riposte_bloom', 'guardians_cadence'));
    const kael = s.hero(0);
    place(kael, 0, -4);
    const near = foe(s.w, 'bell_brute', 0, -5.5, { hp: 1e6, stun: true });
    foe(s.w, 'bell_brute', 2.5, -6, { hp: 1e6, stun: true });
    kael.hero!.abilityCooldowns = [0, 99];
    let fired: SimEvent[] = [];
    for (let i = 0; i < 60 * 10 && fired.length === 0; i++) {
      const f = s.h.tick();
      fired = f.events.filter((e) => e.type === 'motifTriggered');
      if (fired.length > 0) expect(f.drawn.damage).toBe(1);
    }
    expect(fired.map((e) => (e as { source: string }).source)).toEqual(['guardians_cadence']);
    expect(triggerCue('guardians_cadence')).toBe('damage');
    const target = (fired[0] as { target?: number }).target;
    expect(target).toBeDefined();
    expect(s.w.entities.get(target!)?.enemy).toBeDefined();
    expect(s.h.view.targetsOf('damage')).toEqual([target]);
    void near;
  });

  it('Crossed Steel, in the real sim: Seren’s parry fires it and its cooldown cue plays at the Weaver', () => {
    const s = serenSetup(['kael', 'lyra', 'seren'], { motifs: held('crossed_steel') });
    const h = harness(s.sim);
    const brute = foe(s.w, 'bell_brute', s.seren.x, s.seren.z - 2, { hp: 1e6, stun: true });
    h.tick([ward(s.slot)]);
    for (let i = 0; i < 30; i++) h.tick();
    cone(s.w, brute, s.seren, s.seren.id, { impact: 1, damage: 500 });
    let fired: SimEvent[] = [];
    for (let i = 0; i < 60 * 3 && fired.length === 0; i++) {
      const f = h.tick();
      fired = f.events.filter((e) => e.type === 'motifTriggered');
      if (fired.length > 0) expect(f.drawn.cooldown).toBe(1);
    }
    expect(fired.map((e) => (e as { source: string }).source)).toEqual(['crossed_steel']);
    expect(triggerCue('crossed_steel')).toBe('cooldown');
    expect(CUE_LOOK.cooldown.at).toBe('weaver');
    expect(h.view.targetsOf('cooldown')).toEqual([s.w.weaverId]);
  });

  it('the other eight are not triggers: they play no trigger cue', () => {
    const harmonies = CONTENT.motifs.filter(
      (m) => m.tags.includes('harmony') && FILL_IDS.includes(m.id),
    );
    expect(harmonies).toHaveLength(10);
    const triggers = harmonies.filter((m) => (m.triggers?.length ?? 0) > 0).map((m) => m.id);
    expect(triggers.sort()).toEqual(['crossed_steel', 'guardians_cadence']);
    for (const m of harmonies)
      if (!triggers.includes(m.id)) expect(TRIGGER_KINDS[m.id], m.id).toBeUndefined();
  });

  /** The real Feedback (damage numbers, status puffs) over the harness's views. */
  function feedbackOn(sim: Sim) {
    const kit = new FxKit();
    const entities = new EntityLayer(createModelMaterial());
    const overlay = new FakeOverlay();
    const stageStub = {
      lights: {
        key: new THREE.DirectionalLight(),
        hemi: new THREE.HemisphereLight('#ffe7c2'),
        rim: new THREE.DirectionalLight(),
      },
    } as unknown as Stage;
    const rig = { punch() {}, addTrauma() {}, panToward() {} } as unknown as CameraRig;
    const feedback = new Feedback({
      kit,
      entities,
      telegraphs: new TelegraphLayer(entities),
      thread: new ThreadView(entities, null),
      field: new FieldView(entities),
      overlay: overlay as unknown as Overlay,
      rig,
      stage: stageStub,
      calls: new CallView(entities),
      fermata: new FermataView(entities),
    });
    const cam = new THREE.Vector3(0, 22, 18);
    let time = 0;
    const tick = (before?: () => void) => {
      sim.step([]);
      before?.();
      const ev = sim.drainEvents();
      feedback.handle(ev, sim.state);
      const info: FrameInfo = {
        realDt: 1 / 60,
        time,
        alpha: 1,
        hoveredHero: null,
        hoveredEnemy: null,
        aim: null,
        settings: SETTINGS,
      };
      kit.begin(time, cam);
      entities.sync(sim.state, info, kit, 1 / 60);
      feedback.sync(sim.state, info, 1 / 60);
      kit.end(1 / 60, 1280, 720, 720, 45);
      time += 1 / 60;
      return ev;
    };
    return { kit, overlay, tick };
  }

  /** Razor Silk with a Harmony, Thread on Kael, an enemy held on its middle, `aura` sung. */
  function onThread(harmony: string, aura: string) {
    const sim = sandbox({ motifs: held('razor_silk', harmony), auras: [aura] });
    sim.step([{ t: 'thread', slot: 0 }]);
    sim.drainEvents();
    const w = worldOf(sim);
    const me = w.entities.get(w.weaverId)!;
    const kael = w.entities.get(w.party[0]!)!;
    const mid = () => ({ x: (me.x + kael.x) / 2, z: (me.z + kael.z) / 2 });
    const enemy = foe(w, 'hollow_chorister', mid().x + 8, mid().z + 8, { hp: 1e7 });
    enemy.health!.statuses.length = 0;
    /** Off to the side first (so the views have drawn it once), then on the Thread's middle. */
    let frames = 0;
    const hold = () => {
      const p = mid();
      if (frames++ < 10) place(enemy, p.x + 8, p.z + 8);
      else place(enemy, p.x, p.z);
      enemy.health!.hp = enemy.health!.maxHp;
    };
    return { sim, w, enemy, hold };
  }

  it('Cutting Chorus: its critical Razor Silk cuts read as critical numbers (the existing “!”)', () => {
    const r = onThread('cutting_chorus', 'fortissimo');
    const f = feedbackOn(r.sim);
    let crit = 0;
    for (let i = 0; i < 60 * 40 && crit === 0; i++) {
      const ev = f.tick(r.hold);
      crit += ofType(ev, 'damageTaken').filter(
        (e) => e.source === r.w.weaverId && e.target === r.enemy.id && e.crit,
      ).length;
    }
    expect(crit).toBeGreaterThan(0);
    // The number the existing feedback shows for the enemy's bucket ends in the crit mark.
    expect(f.overlay.numbers.some((n) => n.text.endsWith('!'))).toBe(true);
  });

  it('Spindle Lullaby: its sleeps are the real `sleep` status, drawn as every sleep is', () => {
    const r = onThread('spindle_lullaby', 'lullaby');
    const f = feedbackOn(r.sim);
    const smoke = vi.spyOn(f.kit.smoke, 'burst');
    let slept = 0;
    let puffed = false;
    for (let i = 0; i < 60 * 4 && slept === 0; i++) {
      const calls = smoke.mock.calls.length;
      const ev = f.tick(r.hold);
      slept = ofType(ev, 'statusApplied').filter(
        (e) => e.target === r.enemy.id && e.status === 'sleep',
      ).length;
      if (slept > 0) puffed = smoke.mock.calls.length > calls;
    }
    expect(slept).toBe(1);
    // The existing ailment puff every sleep gets (Feedback's `statusApplied`).
    expect(puffed).toBe(true);
  });
});

// ── The VFX lab's scenarios ─────────────────────────────────────────────────────────────────

describe('the VFX lab’s fill scenarios, played in Node', () => {
  it('each stages its moment in the real sim, and every look it shows is drawn', () => {
    for (const name of FILL_SCENARIO_NAMES) {
      const sc = FILL_SCENARIOS[name]!;
      const sim = sandbox({
        ...(sc.motifs ? { motifs: sc.motifs } : {}),
        ...(sc.relics ? { relics: sc.relics } : {}),
      });
      const h = harness(sim);
      const pending: Command[] = [];
      const scheduled: { at: number; fn: () => void }[] = [];
      const taps: { pred: (e: SimEvent) => boolean; fn: (e: SimEvent) => void }[] = [];
      const injected: SimEvent[] = [];
      sc.stage({
        sim,
        later: (delay, fn) => scheduled.push({ at: sim.state.time + delay, fn }),
        onEvent: (pred, fn) => taps.push({ pred, fn }),
        queue: (c) => pending.push(c),
        inject: (events) => injected.push(...events),
      });
      const drawn = new Set<string>();
      for (let i = 0; i < sc.seconds * 60; i++) {
        const f = h.tick(pending.splice(0), 1, undefined, injected.splice(0));
        for (const e of f.events)
          for (let k = taps.length - 1; k >= 0; k--) {
            const t = taps[k]!;
            if (!t.pred(e)) continue;
            taps.splice(k, 1);
            t.fn(e);
          }
        for (let k = scheduled.length - 1; k >= 0; k--) {
          if (scheduled[k]!.at > sim.state.time) continue;
          const [job] = scheduled.splice(k, 1);
          job!.fn();
        }
        for (const [k, n] of Object.entries(f.drawn)) if (n > 0) drawn.add(k);
      }
      for (const k of sc.shows) expect(drawn.has(k), `${name}: ${k}`).toBe(true);
    }
  });
});
