/**
 * The marks over the larger heroes (docs/phase-8.md, "The marks on the larger heroes"): heroes and
 * the Weaver are drawn HERO_DRAWN tall, and a mark over one of them is lifted from that drawn
 * height, so it keeps its place over the head and over the health bar (which is lifted from it
 * too). An enemy is drawn at its own height, and a mark over an enemy stays where it was. The real
 * sim drives the real views over a real FxKit, as tests/renderMovement2.test.ts does.
 */
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { Command, Sim, SimEvent, Status } from '../src/sim';
import type { CameraRig } from '../src/render/camera';
import { CallView } from '../src/render/calls';
import { PIP_LIFT, STATUS_BADGE_LIFT, pipOffset } from '../src/render/crimsonCues';
import { EntityLayer } from '../src/render/entities';
import { FermataView } from '../src/render/fermata';
import { Feedback } from '../src/render/feedback';
import { FieldView } from '../src/render/field';
import { FxKit } from '../src/render/fx/kit';
import { SPRITE } from '../src/render/fx/sprites';
import { HERO_DRAWN, drawnHeight } from '../src/render/models/artFlag';
import { createModelMaterial } from '../src/render/models/material';
import type { Overlay } from '../src/render/overlay';
import { BAR_LIFT, PartyBarsView } from '../src/render/partyBars';
import type { Stage } from '../src/render/stage';
import { TelegraphLayer } from '../src/render/telegraphs';
import { ThreadView } from '../src/render/thread';
import type { FrameInfo } from '../src/render/types';
import { hero, sandbox, spawn, weaver } from './sim/helpers';

const SETTINGS: FrameInfo['settings'] = {
  screenShake: 1,
  flashes: 1,
  damageNumbers: true,
  colorVision: 'normal',
};

/** An overlay that records where it is asked to show things (and ignores the rest). */
class FakeOverlay {
  width = 1280;
  height = 720;
  badges: { x: number; y: number; label: string }[] = [];
  bars: { x: number; y: number }[] = [];
  callouts: { x: number; y: number; text: string }[] = [];
  numbers: { x: number; y: number }[] = [];
  beginFrame(): void {
    this.badges.length = 0;
    this.bars.length = 0;
  }
  badge(
    x: number,
    y: number,
    _z: number,
    _answers: readonly string[],
    _key: string,
    _border: string,
    label: string,
  ): void {
    this.badges.push({ x, y, label });
  }
  allyBar(x: number, y: number): void {
    this.bars.push({ x, y });
  }
  raid(): void {}
  callout(x: number, y: number, _z: number, text: string): void {
    this.callouts.push({ x, y, text });
  }
  spawnNumber(x: number, y: number): number {
    this.numbers.push({ x, y });
    return this.numbers.length - 1;
  }
  setNumber(): void {}
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

function harness(sim: Sim = sandbox()) {
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
  const cam = new THREE.Vector3(0, 22, 18);
  let time = 0;
  const frame = (ev: SimEvent[]) => {
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
    fake.beginFrame();
    kit.begin(time, cam);
    entities.sync(sim.state, info, kit, 1 / 60);
    field.sync(sim.state, kit, 1 / 60, time);
    telegraphs.sync(sim.state, kit, overlay, 1 / 60, true);
    thread.sync(sim.state, kit, 1 / 60, time);
    bars.sync(sim.state, fake, 1 / 60, time);
    feedback.sync(sim.state, info, 1 / 60);
    kit.end(1 / 60, 1280, 720, 720, 45);
    time += 1 / 60;
  };
  const tick = (commands: Command[] = [], inject: SimEvent[] = []) => {
    sim.step(commands);
    frame([...sim.drainEvents(), ...inject]);
  };
  /** The sprites of a shape drawn last frame in a batch, within `near` metres of (x, z). */
  const sprites = (
    batch: FxKit['sprites'],
    shape: number,
    x: number,
    z: number,
    near = 1.2,
  ): { x: number; y: number; z: number }[] => {
    const pos = batch.array('iPos');
    const siz = batch.array('iSize');
    const out: { x: number; y: number; z: number }[] = [];
    for (let i = 0; i < batch.size; i++) {
      const o = i * 4;
      if (Math.round(siz[o + 2]!) !== shape) continue;
      const p = { x: pos[o]!, y: pos[o + 1]!, z: pos[o + 2]! };
      if (Math.hypot(p.x - x, p.z - z) <= near) out.push(p);
    }
    return out;
  };
  return { sim, kit, entities, fake, tick, sprites };
}

const status = (s: Partial<Status> & { id: Status['id'] }): Status => ({
  remaining: 8,
  duration: 8,
  stacks: 1,
  source: null,
  ...s,
});
const foeOf = (sim: Sim) =>
  sim.state.entities.list().find((e) => e.enemy?.defId === 'hollow_chorister')!;
const give = (e: { health?: { statuses: readonly Status[] } }, s: Status) =>
  (e.health!.statuses as Status[]).push(s);

describe('the marks over the larger heroes', () => {
  it('a hero and the Weaver are drawn HERO_DRAWN tall, an enemy at its own height', () => {
    const h = harness();
    h.tick([spawn('hollow_chorister', 6, 0)]);
    const foe = foeOf(h.sim);
    const kael = h.entities.recs.get(hero(h.sim, 0).id)!;
    const her = h.entities.recs.get(weaver(h.sim).id)!;
    const it = h.entities.recs.get(foe.id)!;
    expect(drawnHeight(kael)).toBeCloseTo(kael.height * HERO_DRAWN, 6);
    expect(drawnHeight(her)).toBeCloseTo(her.height * HERO_DRAWN, 6);
    expect(drawnHeight(it)).toBe(it.height);
    // A record with no model is taken at its own height.
    expect(drawnHeight({ height: 2 })).toBe(2);
  });

  it('stun stars: over a hero’s drawn head, over an enemy where they were', () => {
    const h = harness();
    h.tick([spawn('hollow_chorister', 6, 0)]);
    const foe = foeOf(h.sim);
    const kael = hero(h.sim, 0);
    give(kael, status({ id: 'stun' }));
    give(h.sim.state.entities.get(foe.id)!, status({ id: 'stun' }));
    h.tick();
    const kr = h.entities.recs.get(kael.id)!;
    const fr = h.entities.recs.get(foe.id)!;
    const onHero = h.sprites(h.kit.sprites, SPRITE.star, kr.x, kr.z);
    const onFoe = h.sprites(h.kit.sprites, SPRITE.star, fr.x, fr.z);
    expect(onHero).toHaveLength(3);
    expect(onFoe).toHaveLength(3);
    for (const s of onHero) expect(s.y).toBeCloseTo(kr.height * HERO_DRAWN + 0.15 + kr.y, 4);
    for (const s of onFoe) expect(s.y).toBeCloseTo(fr.height + 0.15 + fr.y, 4);
  });

  it('bleed pips and the status badge keep their places over the bar', () => {
    const h = harness();
    h.tick();
    const kael = hero(h.sim, 0);
    give(kael, status({ id: 'bleed', stacks: 6, dps: 0.01, tickIn: 0.5 }));
    h.tick();
    const kr = h.entities.recs.get(kael.id)!;
    const top = kr.height * HERO_DRAWN + kr.y;
    const bar = h.fake.bars.find((b) => Math.abs(b.x - kr.x) < 1e-6)!;
    expect(bar.y).toBeCloseTo(top + BAR_LIFT, 4);
    const pips = h.sprites(h.kit.sprites, SPRITE.drop, kr.x, kr.z);
    expect(pips).toHaveLength(6);
    const at = { x: 0, y: 0 };
    const ys = new Set<number>();
    for (let i = 0; i < 6; i++) {
      pipOffset(i, 6, at);
      ys.add(Math.round((top + PIP_LIFT + at.y) * 1e4));
    }
    for (const p of pips) expect(ys.has(Math.round(p.y * 1e4))).toBe(true);
    // The bar, then the pips, then the badge: as laid out for the old figures (crimsonCues.ts).
    const low = Math.min(...pips.map((p) => p.y));
    expect(low - bar.y).toBeGreaterThan(0.5);
    const badge = h.fake.badges.find((b) => Math.abs(b.x - kr.x) < 1e-6)!;
    expect(badge.y).toBeCloseTo(top + STATUS_BADGE_LIFT, 4);
  });

  it('PERFECT, SAVED and a heal number start from the drawn head; a hit on an enemy as before', () => {
    const h = harness();
    h.tick([spawn('hollow_chorister', 6, 0)]);
    const foe = foeOf(h.sim);
    const kael = hero(h.sim, 0);
    const kr = h.entities.recs.get(kael.id)!;
    const fr = h.entities.recs.get(foe.id)!;
    const tick = h.sim.tick;
    h.tick(
      [],
      [
        { type: 'perfectWard', tick, target: kael.id, telegraph: null, negated: 500 },
        {
          type: 'save',
          tick,
          target: kael.id,
          cause: 'ward',
          counterfactualDamage: 900,
          attack: 'Test',
        },
        {
          type: 'healApplied',
          tick,
          target: kael.id,
          source: weaver(h.sim).id,
          amount: 120,
          overheal: 0,
          via: 'mend',
        },
        {
          type: 'damageTaken',
          tick,
          target: foe.id,
          source: kael.id,
          amount: 80,
          absorbed: 0,
          amplified: 20,
          aura: 0,
          radiance: 0,
          eclipse: 0,
          crit: false,
          telegraph: null,
          hit: 'hit',
        },
      ],
    );
    const top = kr.height * HERO_DRAWN;
    const call = (text: string) => h.fake.callouts.find((c) => c.text === text)!;
    expect(call('PERFECT').y).toBeCloseTo(top + 1.25, 4);
    expect(call('SAVED').y).toBeCloseTo(top + 1.7, 4);
    // The numbers in the order their events came: the heal on Kael, then the hit on the enemy.
    expect(h.fake.numbers).toHaveLength(2);
    const [heal, hit] = h.fake.numbers;
    expect(heal!.y).toBeCloseTo(top + 0.2, 4);
    expect(hit!.y).toBeCloseTo(fr.height + 0.35, 4);
  });
});
