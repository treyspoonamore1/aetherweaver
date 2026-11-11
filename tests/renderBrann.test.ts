/**
 * Phase 5b VFX: Brann, the Bloodsworn (docs/phase-5b.md, Presentation). Every check drives a real
 * headless sim and feeds its state and events to the real EntityLayer, TelegraphLayer,
 * PartyBarsView, Feedback and BondsView over a real FxKit, then reads what they drew. Where a
 * Brann mechanic is the sim's to produce (his `blood` state, a lifesteal flush, Bloodletting, a
 * Sunder Leap, a refused Rally, a talent's `talentFired`), the test stages it on the real world as
 * the contract says the sim keeps it, so render is checked against the contract on its own.
 */
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { COLOR_VISIONS, deltaE, simulateVision, visionPalette } from '../src/app/colorVision';
import { CONTENT, heroDef } from '../src/content';
import { createSim, newBlood, type Command, type Sim, type SimEvent } from '../src/sim';
import type { Entity, Shield } from '../src/sim/state';
import { BondsView } from '../src/render/bonds';
import { cueHex } from '../src/render/bondsCues';
import { CallView } from '../src/render/calls';
import type { CameraRig } from '../src/render/camera';
import { edgeDanger } from '../src/render/combatView';
import {
  BRANN_HEX,
  CUT_HEAL_SIZE,
  DRAIN_SIZE,
  LIFESTEAL_MOTE,
  LIFESTEAL_MOTE_CUED,
  bloodNotches,
  healCut,
  partyDome,
  shownAnswers,
  signalHex,
} from '../src/render/crimsonCues';
import { EntityLayer } from '../src/render/entities';
import { FermataView } from '../src/render/fermata';
import { Feedback } from '../src/render/feedback';
import { FieldView } from '../src/render/field';
import { FxKit } from '../src/render/fx/kit';
import { MartyrView } from '../src/render/martyr';
import { BRASS_TRIM, buildHero } from '../src/render/models/library';
import { createModelMaterial } from '../src/render/models/material';
import { Overlay, type AllyBarView } from '../src/render/overlay';
import { VISION_HEX, applyVision } from '../src/render/palette';
import { PartyBarsView, vowCoversAll } from '../src/render/partyBars';
import type { Stage } from '../src/render/stage';
import { TelegraphLayer } from '../src/render/telegraphs';
import { ThreadView } from '../src/render/thread';
import type { FrameInfo } from '../src/render/types';
import { sandbox, spawn, stepUntil, worldOf } from './sim/helpers';

const SETTINGS: FrameInfo['settings'] = {
  screenShake: 1,
  flashes: 1,
  damageNumbers: true,
  colorVision: 'normal',
};

/** Kael, Brann, Vexis: Brann in Lyra's slot. */
const WITH_BRANN = ['kael', 'brann', 'vexis'];
const BRANN = 1;
/** No tank, no dome: Lyra, Vexis, Brann (party B). */
const PARTY_B = ['lyra', 'vexis', 'brann'];

/** An overlay that records what it is asked to show (and ignores the rest). */
class FakeOverlay {
  width = 1280;
  height = 720;
  badges: { answers: string[] }[] = [];
  callouts: { text: string; color: string }[] = [];
  numbers: { color: string; size: number; text: string }[] = [];
  bars: AllyBarView[] = [];
  beginFrame(): void {
    this.badges.length = 0;
    this.bars.length = 0;
  }
  badge(_x: number, _y: number, _z: number, answers: readonly string[]): void {
    this.badges.push({ answers: [...answers] });
  }
  allyBar(_x: number, _y: number, _z: number, bar: AllyBarView): void {
    this.bars.push({ ...bar });
  }
  raid(): void {}
  callout(_x: number, _y: number, _z: number, text: string, color: string): void {
    this.callouts.push({ text, color });
  }
  spawnNumber(_x: number, _y: number, _z: number, color: string, size: number): number {
    this.numbers.push({ color, size, text: '' });
    return this.numbers.length - 1;
  }
  setNumber(h: number, text: string): void {
    const n = this.numbers[h];
    if (n) n.text = text;
  }
  numberAlive(): boolean {
    return true;
  }
  flash(): void {}
  coolFlash(): void {}
  chroma(): void {}
  spotlight(): void {}
  danger(): void {}
  setStasis(): void {}
  bubble(): void {}
  edgeArrow(): void {}
}

/** The real views over a real FxKit, driven by a real sim (one sim tick, one frame). */
function harness(sim: Sim) {
  const kit = new FxKit();
  const entities = new EntityLayer(createModelMaterial());
  const field = new FieldView(entities);
  const telegraphs = new TelegraphLayer(entities);
  const thread = new ThreadView(entities, null);
  const bars = new PartyBarsView(entities);
  const fake = new FakeOverlay();
  const overlay = fake as unknown as Overlay;
  const stage = {
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
    telegraphs,
    thread,
    field,
    overlay,
    rig,
    stage,
    calls: new CallView(entities),
    fermata: new FermataView(entities),
  });
  const bonds = new BondsView({ kit, recs: entities.recs, overlay: fake, rig });
  const martyr = new MartyrView({ kit, recs: entities.recs } as never);
  const cam = new THREE.Vector3(0, 22, 18);
  let time = 0;
  const frame = (ev: SimEvent[]) => {
    feedback.handle(ev, sim.state);
    bonds.handle(ev, sim.state);
    const info: FrameInfo = {
      realDt: 1 / 60,
      time,
      alpha: 1,
      hoveredHero: null,
      hoveredEnemy: null,
      aim: null,
      settings: SETTINGS,
    };
    fake.beginFrame();
    kit.begin(time, cam);
    entities.sync(sim.state, info, kit, 1 / 60);
    field.sync(sim.state, kit, 1 / 60, time);
    telegraphs.sync(sim.state, kit, overlay, 1 / 60, true);
    thread.sync(sim.state, kit, 1 / 60, time);
    bars.sync(sim.state, fake, 1 / 60, time);
    feedback.sync(sim.state, info, 1 / 60);
    bonds.sync(sim.state, 1 / 60, time);
    kit.end(1 / 60, 1280, 720, 720, 45);
    time += 1 / 60;
  };
  const tick = (commands: Command[] = []) => {
    sim.step(commands);
    const ev = sim.drainEvents();
    frame(ev);
    return ev;
  };
  const run = (ticks: number, commands: Command[] = []) => {
    for (let i = 0; i < ticks; i++) tick(i === 0 ? commands : []);
  };
  /** Some instance in a batch was drawn in this colour (three's working space) last frame. */
  const drewIn = (hex: string) => {
    const c = new THREE.Color(hex);
    const scan = (a: ArrayLike<number>, n: number) => {
      for (let i = 0; i < n; i++)
        if (
          Math.abs(a[i * 4]! - c.r) < 1e-4 &&
          Math.abs(a[i * 4 + 1]! - c.g) < 1e-4 &&
          Math.abs(a[i * 4 + 2]! - c.b) < 1e-4
        )
          return true;
      return false;
    };
    return (
      scan(kit.rings.array('iColor'), kit.rings.size) ||
      scan(kit.sprites.array('iColor'), kit.sprites.size) ||
      scan(kit.spritesTop.array('iColor'), kit.spritesTop.size) ||
      scan(kit.beams.array('iColor'), kit.beams.size)
    );
  };
  return {
    kit,
    entities,
    telegraphs,
    bars,
    feedback,
    bonds,
    martyr,
    overlay: fake,
    tick,
    run,
    frame,
    drewIn,
  };
}

function setup(party: string[] = WITH_BRANN, extra: Parameters<typeof sandbox>[0] = {}) {
  const sim = sandbox({ party, ...extra });
  const w = worldOf(sim);
  const of = (slot: number) => w.entities.get(w.party[slot]!)! as Entity;
  return { sim, w, of, h: harness(sim) };
}

/** Brann's `blood` as the sim keeps it (W1 spawns it; staged here until then). */
function blooded(e: Entity): NonNullable<NonNullable<Entity['hero']>['blood']> {
  if (!e.hero!.blood) e.hero!.blood = newBlood();
  return e.hero!.blood;
}

const atPct = (e: Entity, pct: number) => {
  e.health!.hp = e.health!.maxHp * pct;
};

const barOf = (h: ReturnType<typeof harness>, id: number) => h.bars.drawn.find((b) => b.id === id)!;

afterEach(() => applyVision('normal'));

describe('Brann’s model', () => {
  /** The starters' geometry before Brann (position, normal, colour and glow), pinned. */
  // The starters as drawn in stained glass (re-recorded in Phase 8b, docs/art-style.md): this
  // hero's work must leave them untouched.
  const STARTERS: Record<string, string> = {
    kael: '2aefa43a6c4660c0',
    lyra: '53666482d35be426',
    vexis: 'c0865eb6dbb63724',
  };
  const hashOf = (g: THREE.BufferGeometry) => {
    const h = createHash('sha256');
    for (const k of ['position', 'normal', 'color', 'aGlow'])
      h.update(Buffer.from((g.getAttribute(k).array as Float32Array).buffer));
    return h.digest('hex').slice(0, 16);
  };

  it('builds a berserker of its own with its brass trim parts; the starters are untouched', () => {
    const g = buildHero(heroDef('brann'));
    const colors = g.getAttribute('color');
    const brass = new THREE.Color(BRASS_TRIM);
    let trim = 0;
    for (let i = 0; i < colors.count; i++)
      if (
        Math.abs(colors.getX(i) - brass.r) < 1e-4 &&
        Math.abs(colors.getY(i) - brass.g) < 1e-4 &&
        Math.abs(colors.getZ(i) - brass.b) < 1e-4
      )
        trim++;
    // The collar band and the axe's edge.
    expect(trim).toBeGreaterThan(24);
    expect(BRASS_TRIM).toBe(BRANN_HEX.brass);
    // Not the generic fallback (a cylinder and an orb), and not Kael's.
    expect(g.getAttribute('position').count).toBeGreaterThan(600);
    for (const [id, hash] of Object.entries(STARTERS))
      expect(hashOf(buildHero(heroDef(id))), id).toBe(hash);
  });

  it('reads apart from Kael in greyscale: a different silhouette and a different value', () => {
    const box = (id: string) => {
      const g = buildHero(heroDef(id));
      g.computeBoundingBox();
      return g.boundingBox!;
    };
    const luma = (id: string) => {
      const c = buildHero(heroDef(id)).getAttribute('color');
      let s = 0;
      for (let i = 0; i < c.count; i++)
        s += 0.2126 * c.getX(i) + 0.7152 * c.getY(i) + 0.0722 * c.getZ(i);
      return s / c.count;
    };
    const k = box('kael');
    const b = box('brann');
    // His axe reaches further forward and lower than Kael's shield.
    expect(b.min.z).toBeLessThan(k.min.z - 0.1);
    expect(Math.abs(luma('brann') - luma('kael'))).toBeGreaterThan(0.03);
  });
});

describe('Brann’s bar', () => {
  it('his notches and raging band; no hurt tier; critical only below 15%', () => {
    const { of, h } = setup(WITH_BRANN, {
      bonds: { talents: ['deathless'], solos: [] },
    });
    h.run(2);
    const brann = of(BRANN);
    const kael = of(0);
    blooded(brann);
    // The Hymn shares Deathless's rank (one talent a rank in play): staged alongside it.
    brann.hero!.talents.push('berserkers_hymn');
    atPct(brann, 0.35);
    atPct(kael, 0.35);
    h.run(1);
    const b = barOf(h, brann.id);
    expect(b.ticks).toEqual([0.4, 0.3, 0.1]);
    expect(b.band).toEqual([0.15, 0.4]);
    expect(b.raging).toBe(true);
    expect(b.level).toBe(0);
    expect(b.pulse).toBe(0);
    // Kael at the same life is hurt, as ever, and carries none of Brann's keys.
    const k = barOf(h, kael.id);
    expect(k.level).toBe(1);
    for (const key of ['ticks', 'band', 'raging', 'drain', 'drainAlpha'])
      expect(k, key).not.toHaveProperty(key);
    // Kael at 20% is critical and pulses; Brann at 20% isn't, at 12% is.
    atPct(kael, 0.2);
    atPct(brann, 0.2);
    h.run(1);
    expect(barOf(h, kael.id).level).toBe(2);
    expect(barOf(h, brann.id).level).toBe(0);
    expect(barOf(h, brann.id).pulse).toBe(0);
    atPct(brann, 0.12);
    h.run(1);
    expect(barOf(h, brann.id).level).toBe(2);
    expect(barOf(h, brann.id).raging).toBe(false);
  });

  it('only his Bloodlust line without the Hymn, Blood and Silk or Deathless; 30% with the Harmony', () => {
    const { of, sim } = setup();
    sim.step([]);
    const brann = of(BRANN);
    blooded(brann);
    expect(bloodNotches(sim.state, brann)).toEqual([0.4]);
    expect(bloodNotches({ mods: { ...sim.state.mods, bloodAndSilk: 3 } }, brann)).toEqual([
      0.4, 0.3,
    ]);
    // Every default hero: none.
    expect(bloodNotches(sim.state, of(0))).toEqual([]);
  });

  it('falling fast or a lethal hit makes him critical at any life, and pulses', () => {
    const { of, h } = setup();
    h.run(2);
    const brann = of(BRANN);
    const b = blooded(brann);
    atPct(brann, 0.3);
    b.bleedRate = brann.health!.hp; // 2 × rate ≥ hp: falling fast
    h.frame([]);
    expect(barOf(h, brann.id).level).toBe(2);
    expect(barOf(h, brann.id).pulse).toBeGreaterThan(0);
    b.bleedRate = 0;
    // The blow on its way (staged between ticks: the sim sums it each tick).
    brann.health!.incoming = brann.health!.hp + 10;
    h.frame([]);
    expect(barOf(h, brann.id).lethal).toBe(true);
    // Critical with it (the review's finding): no ember raging fill under a lethal blow.
    expect(barOf(h, brann.id).level).toBe(2);
    expect(barOf(h, brann.id).raging).toBe(false);
    brann.health!.incoming = 0;
    h.frame([]);
    expect(barOf(h, brann.id).level).toBe(0);
    expect(barOf(h, brann.id).raging).toBe(true);
  });

  it('the edge arrow warns as the bar does: his own critical, the shared one for the rest', () => {
    const { of, h } = setup();
    h.run(2);
    const brann = of(BRANN);
    const kael = of(0);
    const b = blooded(brann);
    atPct(brann, 0.2);
    atPct(kael, 0.2);
    expect(edgeDanger(brann, 0)).toBe(0);
    expect(edgeDanger(kael, 0)).toBe(0.8);
    atPct(brann, 0.12);
    expect(edgeDanger(brann, 0)).toBe(0.8);
    atPct(brann, 0.3);
    b.bleedRate = brann.health!.hp;
    expect(edgeDanger(brann, 0)).toBe(0.8);
    b.bleedRate = 0;
    brann.health!.incoming = brann.health!.hp + 1;
    expect(edgeDanger(brann, 0)).toBe(0.8);
    brann.health!.incoming = 0;
    // A telegraph at him still warns as for anyone.
    expect(edgeDanger(brann, 0.6)).toBe(0.6);
  });

  it('under the Martyr’s Vow his edge arrow, like his bar, calls no blow lethal', () => {
    const { of, w, h } = setup();
    h.run(2);
    const brann = of(BRANN);
    blooded(brann);
    atPct(brann, 0.3);
    brann.health!.incoming = brann.health!.hp + 10;
    h.frame([]);
    expect(barOf(h, brann.id).lethal).toBe(true);
    expect(edgeDanger(brann, 0, vowCoversAll(w))).toBe(0.8);
    // The Vow holds every hero at 1 life: nothing on its way (no telegraph outlasts it) is lethal.
    w.field.vow = true;
    expect(vowCoversAll(w)).toBe(true);
    brann.health!.incoming = brann.health!.hp + 10;
    h.frame([]);
    expect(barOf(h, brann.id).lethal).toBe(false);
    expect(edgeDanger(brann, 0, vowCoversAll(w))).toBe(0);
    // Still critical by his own line (below 15%), Vow or not.
    atPct(brann, 0.1);
    expect(edgeDanger(brann, 0, vowCoversAll(w))).toBe(0.8);
    w.field.vow = false;
  });
});

describe('Brann’s healing', () => {
  it('the Weaver’s heals on him are cut by via; revive, Solos, self-heals and lifesteal are not', () => {
    const { of, sim } = setup();
    sim.step([]);
    const brann = of(BRANN);
    const kael = of(0);
    for (const via of ['mend', 'chime', 'aura', 'rewind', 'other'])
      expect(healCut(sim.state, brann, via, null), via).toBe(true);
    for (const via of ['revive', 'solo', 'self', 'lifesteal'])
      expect(healCut(sim.state, brann, via, null), via).toBe(false);
    // Nobody else's are (Movement I: nothing is cut), and Blood Oath lifts his.
    for (const via of ['mend', 'chime', 'aura', 'rewind', 'other'])
      expect(healCut(sim.state, kael, via, null), via).toBe(false);
    brann.hero!.talents.push('blood_oath');
    expect(healCut(sim.state, brann, 'mend', null)).toBe(false);
  });

  it('a Mend on him shows as cut (smaller, dimmer); his lifesteal never does', () => {
    const { of, sim, h } = setup();
    h.run(2);
    const brann = of(BRANN);
    blooded(brann);
    atPct(brann, 0.5);
    const heal = (via: 'mend' | 'lifesteal', amount: number): SimEvent => ({
      type: 'healApplied',
      tick: sim.tick,
      target: brann.id,
      source: via === 'lifesteal' ? brann.id : sim.state.weaverId,
      amount,
      overheal: 0,
      via,
    });
    h.frame([heal('mend', 80)]);
    expect(h.feedback.firedM2.cutHeals).toBe(1);
    const mend = h.overlay.numbers.at(-1)!;
    expect(mend.size).toBeLessThan(30 * CUT_HEAL_SIZE + 1e-6);
    h.overlay.numbers.length = 0;
    h.frame([heal('lifesteal', 40)]);
    h.frame([heal('lifesteal', 40)]);
    expect(h.feedback.fired5b.lifesteal).toBe(2);
    expect(h.feedback.firedM2.cutHeals).toBe(1);
    // One soft number in his ink, summed (the self-heal bucket), never the heal colour.
    expect(h.overlay.numbers).toHaveLength(1);
    expect(h.overlay.numbers[0]!.color).toBe(BRANN_HEX.ink);
    expect(h.overlay.numbers[0]!.text).toBe('+80');
    // The Martyr's view never takes it for the Weaver's (no Blood Font, no Covenant).
    h.martyr.handle([heal('lifesteal', 40)], sim.state);
    expect(h.martyr.fired.selfHeal).toBe(0);
  });

  it('a Cued Red Frenzy draws his lifesteal motes larger', () => {
    const { of, sim, h } = setup();
    h.run(2);
    const brann = of(BRANN);
    blooded(brann);
    atPct(brann, 0.5);
    const steal: SimEvent = {
      type: 'healApplied',
      tick: sim.tick,
      target: brann.id,
      source: brann.id,
      amount: 40,
      overheal: 0,
      via: 'lifesteal',
    };
    const ink = new THREE.Color(BRANN_HEX.ink);
    const emit = vi.spyOn(h.kit.particles, 'emit');
    /** The sizes of the ink motes the last frame emitted. */
    const motes = () => {
      emit.mockClear();
      h.frame([steal]);
      return emit.mock.calls.filter((c) => (c[8] as THREE.Color).equals(ink)).map((c) => c[7]);
    };
    const plain = motes();
    expect(plain.length).toBeGreaterThan(0);
    for (const size of plain) expect(size).toBe(LIFESTEAL_MOTE);
    // In a Red Frenzy you did not Cue, they are as ever.
    brann.hero!.soloId = 'redFrenzy';
    brann.hero!.soloActive = 5;
    brann.hero!.soloCued = false;
    for (const size of motes()) expect(size).toBe(LIFESTEAL_MOTE);
    brann.hero!.soloCued = true;
    const cued = motes();
    expect(cued.length).toBeGreaterThan(0);
    for (const size of cued) expect(size).toBe(LIFESTEAL_MOTE_CUED);
    expect(LIFESTEAL_MOTE_CUED).toBeGreaterThan(LIFESTEAL_MOTE);
    emit.mockRestore();
  });
});

describe('Bloodletting', () => {
  it('is a drain, not a hit: a drain segment and no white trail, a calm floater in his ink', () => {
    const { of, sim, h } = setup();
    h.run(2);
    const brann = of(BRANN);
    const b = blooded(brann);
    atPct(brann, 0.9);
    // The staged drop's own white trail settles first.
    h.run(90);
    const amount = brann.health!.maxHp * 0.1;
    brann.health!.hp -= amount;
    b.spent += amount;
    b.bloodlet = 3;
    h.frame([{ type: 'lifeSpent', tick: sim.tick, hero: brann.id, amount }]);
    const bar = barOf(h, brann.id);
    expect(bar.drain).toBeCloseTo(0.1, 5);
    expect(bar.trail).toBeCloseTo(bar.hp, 5);
    expect(bar.level).toBe(0);
    expect(bar.pulse).toBe(0);
    expect(h.feedback.fired5b.drains).toBe(1);
    const n = h.overlay.numbers.at(-1)!;
    expect(n.color).toBe(BRANN_HEX.ink);
    expect(n.size).toBe(DRAIN_SIZE);
    expect(n.text).toBe(`−${Math.round(amount)} Bloodletting`);
    // His three empowered swings, as pips on the axe.
    expect(h.entities.drawn5b.bloodlet).toBe(3);
    // A hit of the same size does leave the white trail (the drain is its own channel).
    h.run(80);
    expect(barOf(h, brann.id).drain).toBeUndefined();
    brann.health!.hp -= amount;
    h.run(1);
    expect(barOf(h, brann.id).trail).toBeGreaterThan(barOf(h, brann.id).hp + 0.05);
    expect(barOf(h, brann.id).drain).toBeUndefined();
  });

  it('draws its drain segment under his shield band, never over the Ward on him', () => {
    /** Just enough DOM for the Overlay: elements that keep their children and styles. */
    class El {
      style: Record<string, string> = {};
      children: El[] = [];
      dataset: Record<string, string> = {};
      textContent = '';
      clientWidth = 1280;
      clientHeight = 720;
      appendChild(c: El): El {
        this.children.push(c);
        return c;
      }
      append(...c: El[]): void {
        this.children.push(...c);
      }
      setAttribute(): void {}
      remove(): void {}
    }
    const g = globalThis as unknown as Record<string, unknown>;
    const saved = { document: g.document, ResizeObserver: g.ResizeObserver };
    g.document = { createElement: () => new El(), createElementNS: () => new El() };
    g.ResizeObserver = class {
      observe(): void {}
      disconnect(): void {}
    };
    try {
      const camera = new THREE.PerspectiveCamera(45, 1280 / 720, 0.1, 200);
      camera.position.set(0, 22, 18);
      camera.lookAt(0, 0, 0);
      camera.updateMatrixWorld();
      const overlay = new Overlay(new El() as unknown as HTMLElement, camera);
      // Brann at 80% with a Ward of a fifth of his life, just after Bloodletting spent a tenth.
      overlay.allyBar(0, 1, 0, {
        hp: 0.8,
        trail: 0.8,
        shield: 0.2,
        incoming: 0,
        lethal: false,
        level: 0,
        key: '2',
        keyHex: BRANN_HEX.brass,
        dim: false,
        pulse: 0,
        drain: 0.1,
        drainAlpha: 1,
      });
      const bar = (overlay as unknown as { allyBars: Record<string, El>[] }).allyBars[0]!;
      const track = bar.track!.children;
      const at = (k: string) => track.indexOf(bar[k]!);
      expect(bar.drain!.style.display).toBe('block');
      expect(bar.shield!.style.width).toBe('20.0%');
      // Both start where his life ends; the drain is painted first, so the band shows whole.
      expect(bar.drain!.style.left).toBe(bar.shield!.style.left);
      expect(at('drain')).toBeGreaterThanOrEqual(0);
      expect(at('drain')).toBeLessThan(at('shield'));
      // And under the blow's stripes as well (they must read over anything of his).
      expect(at('drain')).toBeLessThan(at('fc'));
      overlay.dispose();
    } finally {
      g.document = saved.document;
      g.ResizeObserver = saved.ResizeObserver;
    }
  });
});

describe('Brann’s moves', () => {
  it('a hero-sourced leap arcs and lands (dust and his brass ring); Red Comet adds its gold', () => {
    const { of, sim, h } = setup();
    h.run(2);
    const brann = of(BRANN);
    const fromX = brann.x;
    const fromZ = brann.z;
    brann.x = fromX;
    brann.z = fromZ - 6;
    const leap: SimEvent = {
      type: 'attackFired',
      tick: sim.tick,
      source: brann.id,
      target: null,
      visual: 'leap',
      fromX,
      fromZ,
      toX: brann.x,
      toZ: brann.z,
      travel: 0,
    };
    h.frame([leap]);
    expect(h.feedback.firedM2.leaps).toBe(1);
    expect(h.feedback.fired5b.heroLeaps).toBe(1);
    expect(h.entities.drawnM2.leaps).toBe(1);
    expect(h.drewIn(BRANN_HEX.brass)).toBe(true);
    expect(h.drewIn(BRANN_HEX.body)).toBe(false);
    h.frame([
      leap,
      {
        type: 'flourish',
        tick: sim.tick,
        hero: brann.id,
        name: 'Red Comet',
        x: brann.x,
        z: brann.z,
        radius: 4.5,
      },
    ]);
    expect(h.feedback.fired5b.comets).toBe(1);
  });

  it('Red Frenzy: he spins with a crimson swipe ring, gold-edged only when Cued', () => {
    const { of, h } = setup();
    h.run(2);
    const brann = of(BRANN);
    blooded(brann);
    brann.hero!.soloActive = 5;
    brann.hero!.soloCued = false;
    h.run(1);
    expect(h.entities.drawn5b.spin).toBe(1);
    expect(h.entities.drawn5b.frenzy).toBe(1);
    expect(h.entities.drawn5b.frenzyGold).toBe(0);
    // The ring is his crimson (docs/phase-5b.md), not his brass signal.
    expect(h.drewIn(BRANN_HEX.body)).toBe(true);
    brann.hero!.soloCued = true;
    h.run(1);
    expect(h.entities.drawn5b.frenzyGold).toBe(1);
    brann.hero!.soloActive = 0;
    h.run(1);
    expect(h.entities.drawn5b.spin).toBe(0);
  });

  it('Blood Rage glows with the life he is missing, and not at full', () => {
    const { of, h } = setup();
    h.run(2);
    const brann = of(BRANN);
    blooded(brann);
    h.run(1);
    expect(h.entities.drawn5b.rage).toBe(0);
    atPct(brann, 0.4);
    h.run(1);
    expect(h.entities.drawn5b.rage).toBe(1);
  });

  it('a refused Rally shows its glyph; Iron Will and your Ward clear it', () => {
    const { of, sim, h } = setup(WITH_BRANN, { bonds: { talents: ['iron_will'], solos: [] } });
    h.run(2);
    const brann = of(BRANN);
    blooded(brann);
    atPct(brann, 0.3);
    h.frame([{ type: 'bloodlust', tick: sim.tick, hero: brann.id }]);
    expect(h.feedback.fired5b.refused).toBe(1);
    expect(h.feedback.drawn5b.refused).toBe(1);
    h.frame([]);
    expect(h.feedback.drawn5b.refused).toBe(1);
    // Your Ward holds him: with Iron Will he answers after all.
    (brann.health!.shields as Shield[]).push({
      kind: 'ward',
      amount: 400,
      max: 400,
      appliedAt: sim.state.time,
      expiresAt: sim.state.time + 4,
      source: sim.state.weaverId,
      fromWeaver: true,
      fromAura: false,
    } as unknown as Shield);
    h.frame([]);
    expect(h.feedback.drawn5b.refused).toBe(0);
    expect(h.feedback.fired5b.refusedCleared).toBe(1);
  });

  it('a refused Rally strikes its glyph across his Rally acknowledgement too', () => {
    const { of, sim, h } = setup(WITH_BRANN, { bonds: { talents: ['iron_will'], solos: [] } });
    h.run(2);
    const brann = of(BRANN);
    blooded(brann);
    atPct(brann, 0.3);
    h.frame([
      { type: 'directiveAck', tick: sim.tick, hero: brann.id, directive: 'rally' },
      { type: 'bloodlust', tick: sim.tick, hero: brann.id },
    ]);
    expect(h.feedback.drawn5b.refused).toBe(1);
    expect(h.feedback.drawn5b.refusedAck).toBe(1);
    expect(h.drewIn(BRANN_HEX.brass)).toBe(true);
    // It lasts as the acknowledgement lands, then only the glyph over his head stays.
    for (let i = 0; i < 50; i++) h.frame([]);
    expect(h.feedback.drawn5b.refused).toBe(1);
    expect(h.feedback.drawn5b.refusedAck).toBe(0);
    // Iron Will lifts both at once.
    h.frame([{ type: 'bloodlust', tick: sim.tick, hero: brann.id }]);
    expect(h.feedback.drawn5b.refusedAck).toBe(1);
    h.frame([
      {
        type: 'talentFired',
        tick: sim.tick,
        hero: brann.id,
        talent: 'iron_will',
        x: brann.x,
        z: brann.z,
        target: null,
      },
    ]);
    expect(h.feedback.drawn5b.refused).toBe(0);
    expect(h.feedback.drawn5b.refusedAck).toBe(0);
  });
});

describe('the dome glyph', () => {
  const tollBadges = (party: string[]) => {
    const sim = sandbox({ party });
    const h = harness(sim);
    sim.step([spawn('the_hollow_cantor', 0, -4)]);
    for (const e of worldOf(sim).entities.list())
      if (e.enemy && e.health) e.health.hp = e.health.maxHp = 1e6;
    const seen: string[][] = [];
    stepUntil(sim, (ev) => {
      h.frame(ev);
      seen.push(...h.overlay.badges.map((b) => b.answers));
      return ev.some((e) => e.type === 'telegraphStarted' && e.name === 'Toll');
    });
    for (let i = 0; i < 3; i++) {
      h.tick();
      seen.push(...h.overlay.badges.map((b) => b.answers));
    }
    return { seen, sim };
  };

  it('is drawn only when the party brings a dome', () => {
    const def = tollBadges(['kael', 'lyra', 'vexis']);
    expect(partyDome(def.sim.state)).toBe(true);
    expect(def.seen.some((a) => a.includes('dome'))).toBe(true);
    const b = tollBadges(PARTY_B);
    expect(partyDome(b.sim.state)).toBe(false);
    expect(b.seen.length).toBeGreaterThan(0);
    expect(b.seen.some((a) => a.includes('dome'))).toBe(false);
    expect(b.seen.some((a) => a.includes('ward'))).toBe(true);
    // The rule itself: the sim's answers, the dome dropped only without one.
    expect(shownAnswers(def.sim.state, ['ward', 'dome'])).toEqual(['ward', 'dome']);
    expect(shownAnswers(b.sim.state, ['ward', 'dome'])).toEqual(['ward']);
  });
});

describe('his colour never fills a danger channel', () => {
  it('his signals are brass: swipes, the bar’s key tag, the edge arrow, the Bonds moments', () => {
    const { of, sim, h } = setup();
    h.run(2);
    const brann = of(BRANN);
    blooded(brann);
    h.frame([
      {
        type: 'attackFired',
        tick: sim.tick,
        source: brann.id,
        target: null,
        visual: 'cleave',
        fromX: brann.x,
        fromZ: brann.z,
        toX: brann.x,
        toZ: brann.z - 2,
        travel: 0,
      },
    ]);
    expect(h.drewIn(BRANN_HEX.brass)).toBe(true);
    expect(h.drewIn(BRANN_HEX.body)).toBe(false);
    expect(barOf(h, brann.id).keyHex).toBe(BRANN_HEX.brass);
    expect(signalHex('brann', BRANN_HEX.body)).toBe(BRANN_HEX.brass);
    expect(cueHex('brann')).toBe(BRANN_HEX.brass);
    // Every default hero keeps their own.
    for (const id of ['kael', 'lyra', 'vexis']) {
      expect(signalHex(id, heroDef(id).color)).toBe(heroDef(id).color);
      expect(cueHex(id)).toBe(heroDef(id).color);
    }
    expect(barOf(h, of(0).id).keyHex).toBe(heroDef('kael').color);
  });

  it('no danger colour is his, and his brass stays clear of lethal, threat and Bear', () => {
    for (const vision of COLOR_VISIONS) {
      applyVision(vision);
      const p = visionPalette(vision);
      const see = (hex: string) => simulateVision(hex, vision);
      for (const role of ['lethal', 'threat'] as const) {
        expect(VISION_HEX[role]).not.toBe(BRANN_HEX.body);
        expect(
          deltaE(see(BRANN_HEX.brass), see(p[role])),
          `${vision} brass/${role}`,
        ).toBeGreaterThanOrEqual(20);
        expect(
          deltaE(see(BRANN_HEX.ember), see(p[role])),
          `${vision} ember/${role}`,
        ).toBeGreaterThanOrEqual(20);
      }
      expect(
        deltaE(see(BRANN_HEX.brass), see('#a3123a')),
        `${vision} brass/Bear`,
      ).toBeGreaterThanOrEqual(20);
    }
  });
});

describe('Brann’s Bonds', () => {
  it('Deathless reuses Unbreakable’s look for its seconds; the Hymn links him to the others', () => {
    const { of, sim, h } = setup(WITH_BRANN, {
      bonds: { talents: ['deathless'], solos: [] },
    });
    h.run(2);
    const brann = of(BRANN);
    const b = blooded(brann);
    // The Hymn shares Deathless's rank (one talent a rank in play): staged alongside it.
    brann.hero!.talents.push('berserkers_hymn');
    atPct(brann, 0.08);
    b.deathlessUntil = sim.state.time + 3;
    const fired = (talent: string): SimEvent => ({
      type: 'talentFired',
      tick: sim.tick,
      hero: brann.id,
      talent,
      x: brann.x,
      z: brann.z,
      target: null,
    });
    h.frame([fired('deathless'), fired('berserkers_hymn')]);
    h.run(20);
    expect(h.bonds.fired.deathless).toBe(1);
    expect(h.bonds.drawn.deathless).toBe(1);
    expect(h.bonds.drawn.unbreakable).toBe(0);
    expect(h.bonds.fired.berserkers_hymn).toBe(1);
    expect(h.bonds.drawn.hymnLinks).toBe(2);
    expect(h.bonds.lastHex.deathless).toBe(BRANN_HEX.brass);
    expect(h.overlay.callouts.map((c) => c.text)).toContain('DEATHLESS');
    // Above the Hymn's line its links go.
    atPct(brann, 0.6);
    b.deathlessUntil = 0;
    h.run(2);
    expect(h.bonds.drawn.hymnLinks).toBe(0);
  });

  it('Blood Brother’s tether runs to the hero you Thread; a Tithe refund shows its chip', () => {
    const { of, sim, h, w } = setup(WITH_BRANN, {
      bonds: { talents: [], solos: ['blood_brother'] },
    });
    h.run(2);
    const brann = of(BRANN);
    blooded(brann);
    h.run(1, [{ t: 'thread', slot: 0 }]);
    h.run(10);
    brann.hero!.soloActive = 6;
    h.frame([
      {
        type: 'soloStarted',
        tick: sim.tick,
        hero: brann.id,
        solo: 'blood_brother',
        cued: false,
        duration: 6,
      },
    ]);
    h.frame([]);
    expect(h.bonds.started.blood_brother).toBe(1);
    expect(h.bonds.drawn.brother).toBe(1);
    h.frame([{ type: 'titheRefund', tick: sim.tick, target: brann.id, spirit: 10, life: 0 }]);
    expect(h.bonds.fired5b.tithe).toBe(1);
    expect(h.overlay.callouts.map((c) => c.text)).toContain('+10 SPIRIT');
    void w;
  });

  it('Blood and Silk pulses along the Thread only while you Empower him below 30%', () => {
    const { of, h, w } = setup(WITH_BRANN, {
      motifs: [
        { id: 'blood_tithe', level: 1 },
        { id: 'taut_release', level: 1 },
        { id: 'blood_and_silk', level: 1 },
      ],
    });
    h.run(2);
    const brann = of(BRANN);
    blooded(brann);
    // The motif's number as its resolve case sets it (staged: W1 lands the case).
    (w.mods as { bloodAndSilk: number }).bloodAndSilk = 3;
    atPct(brann, 0.25);
    h.run(1, [{ t: 'thread', slot: BRANN }]);
    h.run(10);
    const weaver = w.entities.get(w.weaverId)!.weaver!;
    weaver.threadMode = 'empower';
    atPct(brann, 0.25);
    h.frame([]);
    expect(h.bonds.drawn.silk).toBe(1);
    // Mend: none; Empower above its line: none.
    weaver.threadMode = 'mend';
    h.frame([]);
    expect(h.bonds.drawn.silk).toBe(0);
    weaver.threadMode = 'empower';
    atPct(brann, 0.5);
    h.frame([]);
    expect(h.bonds.drawn.silk).toBe(0);
    // Without the motif, nothing at all.
    (w.mods as { bloodAndSilk: number }).bloodAndSilk = 0;
    atPct(brann, 0.25);
    h.frame([]);
    expect(h.bonds.drawn.silk).toBe(0);
  });
});

describe('the budget', () => {
  it('adds no FX batches: a Brann party draws through the same batches as the default', () => {
    const count = (party: string[] | undefined) => {
      const sim = createSim({ seed: 7, encounter: 'first_light', ...(party ? { party } : {}) });
      const h = harness(sim);
      for (const id of sim.state.party) {
        const e = worldOf(sim).entities.get(id)!;
        if (e.hero?.defId === 'brann') blooded(e);
      }
      h.run(600);
      return { fx: h.kit.group.children.length, rings: h.kit.rings.size };
    };
    const def = count(undefined);
    const withBrann = count(WITH_BRANN);
    const b = count(PARTY_B);
    expect(withBrann.fx).toBe(def.fx);
    expect(b.fx).toBe(def.fx);
    // Inside the shared ring batch's room.
    expect(withBrann.rings).toBeLessThan(384);
    expect(CONTENT.heroes.map((d) => d.id)).toContain('brann');
  });
});
