/**
 * Phase 4d VFX: Dissonance in the fight (docs/phase-4d/vfx-audio.md). Every check drives the real
 * sim at Dissonance levels (configs as in tests/sim/dissonance.test.ts) and feeds its state and
 * events to the real EntityLayer, FieldView, TelegraphLayer, ThreadView, Feedback and
 * DissonanceView over a real FxKit: Restless Dead's rise and its mark, Blind Score's badges,
 * Elite Vanguard's second affix, and the numbers the other levels change, read from the state.
 */
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { COLOR_VISIONS, deltaE, simulateVision, visionPalette } from '../src/app/colorVision';
import { CONTENT, dissonanceLevel } from '../src/content';
import type { Command, Sim, SimConfig, SimEvent, WorldState } from '../src/sim';
import { dealDamage } from '../src/sim/combat/health';
import type { CameraRig } from '../src/render/camera';
import { CallView } from '../src/render/calls';
import { DissonanceView } from '../src/render/dissonance';
import {
  BLIND_KEY,
  DISSONANCE_HEX,
  RISEN_DESAT,
  RISE_SECONDS,
  cueReady,
  cueTicks,
  dissonanceLook,
  emptyDissonanceLook,
  emptyRiseShape,
  riseShape,
} from '../src/render/dissonanceCues';
import { EntityLayer } from '../src/render/entities';
import { FermataView } from '../src/render/fermata';
import { Feedback } from '../src/render/feedback';
import { FieldView } from '../src/render/field';
import { FxKit } from '../src/render/fx/kit';
import { createModelMaterial } from '../src/render/models/material';
import type { Overlay } from '../src/render/overlay';
import { VISION_HEX, applyVision } from '../src/render/palette';
import type { Stage } from '../src/render/stage';
import { TelegraphLayer } from '../src/render/telegraphs';
import { ThreadView } from '../src/render/thread';
import type { FrameInfo } from '../src/render/types';
import { ofType, sandbox, spawn, stepFor, stepUntil, telegraphOn, worldOf } from './sim/helpers';

/** A Dissonance level by its effect, at a rank (the content names it). */
const level = (effect: string, rank = 1) => ({
  id: CONTENT.dissonance.find((d) => d.effect === effect)!.id,
  rank,
});
const value = (effect: string, key: string) =>
  dissonanceLevel(level(effect).id).values[key] ?? Number.NaN;

const SETTINGS: FrameInfo['settings'] = {
  screenShake: 1,
  flashes: 1,
  damageNumbers: true,
  colorVision: 'normal',
};

/** An overlay that records the badges it is asked to show (and ignores the rest). */
class FakeOverlay {
  width = 1280;
  height = 720;
  badges: { answers: string[]; key: string; border: string; label: string; scale: number }[] = [];
  callouts: string[] = [];
  beginFrame(): void {
    this.badges.length = 0;
  }
  badge(
    _x: number,
    _y: number,
    _z: number,
    answers: readonly string[],
    key: string,
    border: string,
    label: string,
    scale = 1,
  ): void {
    this.badges.push({ answers: [...answers], key, border, label, scale });
  }
  raid(): void {}
  callout(_x: number, _y: number, _z: number, text: string): void {
    this.callouts.push(text);
  }
  spawnNumber(): number {
    return 0;
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
}

/** The real views over a real FxKit, driven by a real sim (one sim tick, one frame). */
function harness(sim: Sim) {
  const kit = new FxKit();
  const entities = new EntityLayer(createModelMaterial());
  const field = new FieldView(entities);
  const telegraphs = new TelegraphLayer(entities);
  const thread = new ThreadView(entities, null);
  const fake = new FakeOverlay();
  const overlay = fake as unknown as Overlay;
  const stage = {
    lights: {
      key: new THREE.DirectionalLight(),
      hemi: new THREE.HemisphereLight(),
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
  const view = new DissonanceView({ kit, recs: entities.recs });
  const cam = new THREE.Vector3(0, 22, 18);
  let time = 0;
  const events: SimEvent[] = [];
  const tick = (commands: Command[] = [], flashes = 1) => {
    sim.step(commands);
    const ev = sim.drainEvents();
    events.push(...ev);
    feedback.handle(ev, sim.state);
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
    fake.beginFrame();
    kit.begin(time, cam);
    entities.sync(sim.state, frame, kit, 1 / 60);
    field.sync(sim.state, kit, 1 / 60, time);
    telegraphs.sync(sim.state, kit, overlay, 1 / 60, true);
    thread.sync(sim.state, kit, 1 / 60, time);
    feedback.sync(sim.state, frame, 1 / 60);
    view.sync(sim.state, 1 / 60, time, flashes);
    const counts = {
      rings: kit.rings.size,
      sprites: kit.sprites.size,
      shadows: kit.shadows.size,
      telegraphs: kit.telegraphs.size,
      marks: kit.marks.size,
      bars: kit.bars.size,
    };
    kit.end(1 / 60, 1280, 720, 720, 45);
    time += 1 / 60;
    return { counts, events: ev };
  };
  const run = (ticks: number, commands: Command[] = []) => {
    const seen: SimEvent[] = [];
    for (let i = 0; i < ticks; i++) seen.push(...tick(i === 0 ? commands : []).events);
    return seen;
  };
  const until = (pred: (ev: SimEvent[]) => boolean, max = 60 * 30) => {
    const seen: SimEvent[] = [];
    for (let i = 0; i < max; i++) {
      const { events: ev } = tick();
      seen.push(...ev);
      if (pred(ev)) return seen;
    }
    throw new Error('condition not reached');
  };
  /** The model instance an entity was drawn as this frame (its index in its batch). */
  const instance = (id: number) => {
    const rec = entities.recs.get(id)!;
    let i = 0;
    for (const e of sim.state.entities.list()) {
      if (e.id === id) break;
      if (entities.recs.get(e.id)?.batch === rec.batch) i++;
    }
    return { batch: rec.batch, i };
  };
  /** The life bar drawn over an entity this frame, if any. */
  const barOver = (id: number) => {
    const rec = entities.recs.get(id)!;
    for (let i = 0; i < kit.bars.size; i++) {
      const b = kit.bars.barOf(i);
      if (Math.abs(b.x - rec.x) < 1e-3 && Math.abs(b.z - rec.z) < 1e-3) return b;
    }
    return null;
  };
  return {
    kit,
    entities,
    field,
    telegraphs,
    thread,
    view,
    overlay: fake,
    events,
    tick,
    run,
    until,
    instance,
    barOver,
  };
}

function setup(config: Partial<SimConfig> = {}) {
  const sim = sandbox(config);
  return { sim, h: harness(sim) };
}

/** Out of the heroes' reach, so a risen enemy isn't struck down again before it is looked at. */
const FAR = -16;

/** The first living enemy in the fight. */
const firstEnemy = (sim: Sim) =>
  worldOf(sim)
    .entities.list()
    .find((e) => e.enemy && !e.health?.dead)!;

/** Strikes an enemy down with one blow from Kael (the sim then rises it, or kills it). */
function strike(sim: Sim, id: number): void {
  const w = worldOf(sim);
  const e = w.entities.get(id)!;
  dealDamage(w, e, {
    source: w.party[0]!,
    sourceName: 'test',
    amount: e.health!.hp + 1,
    telegraph: null,
  });
}

const near = (a: number[], hex: string) => {
  const c = new THREE.Color(hex);
  return (
    Math.abs(a[0]! - c.r) < 1e-4 && Math.abs(a[1]! - c.g) < 1e-4 && Math.abs(a[2]! - c.b) < 1e-4
  );
};

describe('Dissonance cues', () => {
  it('reads the levels in force from the state, every number from content', () => {
    const at = (levels: SimConfig['dissonance']) => {
      const sim = sandbox({ dissonance: levels });
      sim.step([]);
      return { ...dissonanceLook(sim.state, emptyDissonanceLook()) };
    };
    expect(at([])).toMatchObject({
      any: false,
      blindScore: false,
      restless: false,
      vanguard: false,
      cueCost: CONTENT.resonance.cueCost,
      segment: CONTENT.resonance.segment,
      max: CONTENT.resonance.max,
    });
    expect(at([level('blind_score')])).toMatchObject({ any: true, blindScore: true });
    expect(at([level('restless_dead')])).toMatchObject({
      restless: true,
      risePct: value('restless_dead', 'pct') / 100,
    });
    expect(at([level('elite_vanguard')])).toMatchObject({ vanguard: true });
    expect(at([level('cue_cost')]).cueCost).toBe(
      CONTENT.resonance.cueCost + value('cue_cost', 'resonance'),
    );
    // A state without `dissonance` (an old fixture, a lab stand-in) reads as none.
    const sim = sandbox();
    const bare = { ...sim.state, entities: sim.state.entities } as Record<string, unknown>;
    delete bare.dissonance;
    expect(dissonanceLook(bare as unknown as WorldState, emptyDissonanceLook()).any).toBe(false);
  });

  it('the rise: struck down onto its back and into ash, then up out of it, done in time', () => {
    const s = emptyRiseShape();
    const lies: number[] = [];
    const fills: number[] = [];
    for (let t = 0; t <= RISE_SECONDS + 1e-9; t += RISE_SECONDS / 40) {
      riseShape(t, s);
      lies.push(s.lie);
      fills.push(s.fill);
    }
    // It goes down all the way, and comes back up.
    expect(Math.max(...lies)).toBeGreaterThan(0.95);
    const low = lies.indexOf(Math.max(...lies));
    expect(low).toBeGreaterThan(2);
    expect(low).toBeLessThan(25);
    // Its life bar fills back as it stands, never down.
    for (let i = 1; i < fills.length; i++) expect(fills[i]!).toBeGreaterThanOrEqual(fills[i - 1]!);
    // Done when the sim lets it fight: standing, whole, ashen, its life back.
    riseShape(RISE_SECONDS, s);
    expect(s.lie).toBeCloseTo(0, 6);
    expect(s.dissolve).toBeCloseTo(0, 6);
    expect(s.fill).toBeCloseTo(1, 6);
    expect(s.desat).toBeCloseTo(RISEN_DESAT, 6);
  });

  it('the rise lasts as long as the sim keeps a risen enemy standing up', () => {
    const sim = sandbox({ dissonance: [level('restless_dead')] });
    stepFor(sim, 2, [spawn('hollow_chorister', 0, FAR)]);
    const e = firstEnemy(sim);
    strike(sim, e.id);
    let ticks = 0;
    stepUntil(sim, () => {
      ticks++;
      return e.enemy!.state !== 'spawning';
    });
    expect(ticks / 60).toBeCloseTo(RISE_SECONDS, 1);
  });

  it('Silent Cues: ticks where each Cue’s cost falls on the orbit, none at the content’s cost', () => {
    const out = new Float32Array(8);
    const look = emptyDissonanceLook();
    expect(cueTicks(look, out)).toBe(0);
    look.cueCost = CONTENT.resonance.cueCost + value('cue_cost', 'resonance');
    const n = cueTicks(look, out);
    const want: number[] = [];
    for (let k = 1; k * look.cueCost <= look.max; k++) {
      const at = (k * look.cueCost) / look.segment;
      if (Math.abs(at - Math.round(at)) > 1e-6) want.push(at);
    }
    expect(n).toBe(want.length);
    expect(n).toBeGreaterThan(0);
    for (let i = 0; i < n; i++) expect(out[i]).toBeCloseTo(want[i]!, 5);
  });

  it('a Cue is ready when the Weaver’s Resonance pays this fight’s cost (the Hymnal reads it)', () => {
    const cost = CONTENT.resonance.cueCost + value('cue_cost', 'resonance');
    const sim = sandbox({ dissonance: [level('cue_cost')] });
    stepFor(sim, 1, [{ t: 'debug', op: { op: 'setResonance', value: cost - 1 } }]);
    expect(cueReady(sim.state)).toBe(false);
    stepFor(sim, 1, [{ t: 'debug', op: { op: 'setResonance', value: cost } }]);
    expect(cueReady(sim.state)).toBe(true);
    const plain = sandbox();
    stepFor(plain, 1, [
      { t: 'debug', op: { op: 'setResonance', value: CONTENT.resonance.cueCost } },
    ]);
    expect(cueReady(plain.state)).toBe(true);
  });

  it('its colours stay apart from danger and from a living enemy’s life bar, in every vision', () => {
    try {
      for (const vision of COLOR_VISIONS) {
        const p = visionPalette(vision);
        const see = (h: string) => simulateVision(h, vision);
        for (const [name, hex] of Object.entries(DISSONANCE_HEX)) {
          expect(
            deltaE(see(hex), see(p.lethal)),
            `${vision} ${name}/lethal`,
          ).toBeGreaterThanOrEqual(20);
          expect(
            deltaE(see(hex), see(p.threat)),
            `${vision} ${name}/threat`,
          ).toBeGreaterThanOrEqual(15);
        }
        // A risen enemy's ash life bar against a living one's red.
        expect(
          deltaE(see(DISSONANCE_HEX.ash), see('#ef4444')),
          `${vision} ash/enemy bar`,
        ).toBeGreaterThanOrEqual(20);
        // The rise's grave-light against Mend and the Ward (it plays on enemies, never heroes).
        expect(
          deltaE(see(DISSONANCE_HEX.grave), see(p.heal)),
          `${vision} grave/heal`,
        ).toBeGreaterThan(15);
      }
    } finally {
      applyVision('normal');
    }
  });
});

describe('Restless Dead: the rise', () => {
  it('struck down, it falls back into ash and stands up out of it: one rise, drawn there', () => {
    const { sim, h } = setup({ dissonance: [level('restless_dead')] });
    h.run(2, [spawn('hollow_chorister', 0, FAR)]);
    const e = firstEnemy(sim);
    strike(sim, e.id);
    const ev = h.run(1);
    expect(ofType(ev, 'enemyRose')).toHaveLength(1);
    expect(ofType(ev, 'enemyKilled')).toHaveLength(0);
    expect(h.view.fired.rise).toBe(1);
    expect(h.view.drawn.rising).toBe(1);
    // A third of the way in it lies in the ash, crumbling, its edges in the grave-light.
    h.run(Math.round(RISE_SECONDS * 60 * 0.3));
    const rec = h.entities.recs.get(e.id)!;
    expect(rec.rising).toBeGreaterThan(0.8);
    const { batch, i } = h.instance(e.id);
    expect(batch.fxOf(i).dissolve).toBeGreaterThan(0.2);
    const rim = new THREE.Color();
    expect(batch.tintOf(i, rim)).toBeGreaterThan(0.5);
    expect(rim.getHexString()).toBe(new THREE.Color(DISSONANCE_HEX.grave).getHexString());
    // Its life bar fills back as it stands: under what it rises with, in ash.
    const bar = h.barOver(e.id)!;
    expect(bar.hp).toBeLessThan(e.health!.hp / e.health!.maxHp);
    expect(near(bar.color, DISSONANCE_HEX.ash)).toBe(true);
  });

  it('once up it carries the mark: ashen, a pale rim, an ash life bar at what it rose with', () => {
    const { sim, h } = setup({ dissonance: [level('restless_dead')] });
    h.run(2, [spawn('hollow_chorister', 0, FAR), spawn('hollow_chorister', 3, FAR)]);
    const [risen, fresh] = worldOf(sim)
      .entities.list()
      .filter((x) => x.enemy);
    strike(sim, risen!.id);
    h.run(Math.ceil(RISE_SECONDS * 60) + 2);
    expect(risen!.enemy!.state).not.toBe('spawning');
    const rec = h.entities.recs.get(risen!.id)!;
    expect(rec.risen).toBe(1);
    expect(rec.rising).toBe(0);
    const r = h.instance(risen!.id);
    expect(r.batch.fxOf(r.i).desat).toBeCloseTo(RISEN_DESAT, 6);
    expect(r.batch.fxOf(r.i).dissolve).toBe(0);
    const rim = new THREE.Color();
    expect(r.batch.tintOf(r.i, rim)).toBeGreaterThan(0.2);
    expect(rim.getHexString()).toBe(new THREE.Color(DISSONANCE_HEX.ash).getHexString());
    // Its bar is its life from the state, at most the share it rose with, in ash.
    const bar = h.barOver(risen!.id)!;
    expect(bar.hp).toBeCloseTo(risen!.health!.hp / risen!.health!.maxHp, 4);
    expect(bar.hp).toBeLessThanOrEqual(value('restless_dead', 'pct') / 100 + 1e-6);
    expect(near(bar.color, DISSONANCE_HEX.ash)).toBe(true);
    expect(h.entities.drawnDis.risen).toBe(1);
    // The fresh one beside it, as ever: no ash, a red bar when hurt.
    const f = h.instance(fresh!.id);
    expect(f.batch.fxOf(f.i).desat).toBe(0);
    worldOf(sim).entities.get(fresh!.id)!.health!.hp *= 0.5;
    h.run(1);
    expect(near(h.barOver(fresh!.id)!.color, '#ef4444')).toBe(true);
    // Ash drifts off the risen one (a few motes a second).
    h.run(60);
    expect(h.kit.smoke.alive).toBeGreaterThan(0);
  });

  it('it won’t rise again: struck down a second time it dies, crumbling to ash for good', () => {
    const { sim, h } = setup({ dissonance: [level('restless_dead')] });
    h.run(2, [spawn('hollow_chorister', 0, FAR)]);
    const e = firstEnemy(sim);
    strike(sim, e.id);
    h.run(Math.ceil(RISE_SECONDS * 60) + 2);
    strike(sim, e.id);
    const ev = h.run(3);
    expect(ofType(ev, 'enemyKilled')).toHaveLength(1);
    expect(ofType(ev, 'enemyRose')).toHaveLength(0);
    expect(h.view.fired.rise).toBe(1);
    const rec = h.entities.recs.get(e.id)!;
    expect(rec.dying).toBeGreaterThanOrEqual(0);
    // Its death dissolve keeps the ash.
    const { batch, i } = h.instance(e.id);
    expect(batch.fxOf(i).desat).toBeGreaterThanOrEqual(RISEN_DESAT - 1e-6);
  });

  it('gone for good before it stood (a debug clear): the rise gives way to its death', () => {
    const { sim, h } = setup({ dissonance: [level('restless_dead')] });
    h.run(2, [spawn('hollow_chorister', 0, FAR)]);
    const e = firstEnemy(sim);
    strike(sim, e.id);
    h.run(Math.round(RISE_SECONDS * 60 * 0.3));
    expect(h.view.activeCount()).toBe(1);
    const lying = h.entities.recs.get(e.id)!.rising;
    expect(lying).toBeGreaterThan(0.8);
    const ev = h.run(2, [{ t: 'debug', op: { op: 'killEnemies' } }]);
    expect(ofType(ev, 'enemyKilled')).toHaveLength(1);
    expect(h.view.activeCount()).toBe(0);
    // It crumbles where it lay, ashen.
    const rec = h.entities.recs.get(e.id)!;
    expect(rec.dying).toBeGreaterThanOrEqual(0);
    const { batch, i } = h.instance(e.id);
    expect(batch.fxOf(i).desat).toBeGreaterThanOrEqual(RISEN_DESAT - 1e-6);
    expect(rec.rising).toBe(lying);
  });

  it('not a spawn: a fresh enemy standing up from its portal has no rise and no ash', () => {
    const { sim, h } = setup({ dissonance: [level('restless_dead')] });
    // A wave's spawn (not a debug one): it comes through the portal in `spawning`.
    const w = worldOf(sim);
    w.internal.pendingSpawns.push({
      at: w.time,
      defId: 'hollow_chorister',
      x: 0,
      z: -6,
      elite: false,
      affixes: [],
      wave: 1,
    });
    h.run(2);
    const e = firstEnemy(sim);
    expect(e.enemy!.state).toBe('spawning');
    expect(h.view.fired.rise).toBe(0);
    expect(h.entities.recs.get(e.id)!.rising).toBe(0);
    expect(h.entities.recs.get(e.id)!.risen).toBe(0);
    expect(h.entities.drawnDis.rising).toBe(0);
  });

  it('without Restless Dead, struck down is dead: no rise, no ash', () => {
    const { sim, h } = setup();
    h.run(2, [spawn('hollow_chorister', 0, FAR)]);
    const e = firstEnemy(sim);
    strike(sim, e.id);
    const ev = h.run(2);
    expect(ofType(ev, 'enemyKilled')).toHaveLength(1);
    expect(h.view.fired.rise).toBe(0);
    expect(h.entities.recs.get(e.id)!.risen).toBe(0);
  });

  it('a pack struck down at once: each rises, all drawn, within the particle caps', () => {
    const { sim, h } = setup({ dissonance: [level('restless_dead')] });
    const spawns: Command[] = [];
    for (let i = 0; i < 8; i++) spawns.push(spawn('hollow_chorister', -6 + i * 1.7, -6));
    h.run(2, spawns);
    const pack = worldOf(sim)
      .entities.list()
      .filter((x) => x.enemy);
    for (const e of pack) strike(sim, e.id);
    h.run(1);
    expect(h.view.fired.rise).toBe(8);
    h.run(20);
    expect(h.view.drawn.rising).toBe(8);
    expect(h.entities.drawnDis.rising).toBe(8);
    expect(h.kit.particles.alive).toBeLessThanOrEqual(2600);
    h.run(Math.ceil(RISE_SECONDS * 60) + 20);
    expect(h.view.activeCount()).toBe(0);
    // Every one still standing carries the mark (the party may have put some down for good).
    const standing = pack.filter((e) => !e.health!.dead).length;
    expect(standing).toBeGreaterThan(0);
    expect(h.entities.drawnDis.risen).toBe(standing);
  });

  it('bosses don’t rise, so they never carry the mark', () => {
    const sim = sandbox({ dissonance: [level('restless_dead')] });
    const h = harness(sim);
    h.run(2, [spawn('the_bellwarden', 0, -8)]);
    const boss = firstEnemy(sim);
    strike(sim, boss.id);
    h.run(3);
    expect(h.view.fired.rise).toBe(0);
    expect(h.entities.recs.get(boss.id)?.risen ?? 0).toBe(0);
  });

  it('Flashes 0: the same rise still draws (its light dimmed, nothing dropped)', () => {
    const glow = (flashes: number) => {
      const { sim, h } = setup({ dissonance: [level('restless_dead')] });
      h.run(2, [spawn('hollow_chorister', 0, FAR)]);
      strike(sim, firstEnemy(sim).id);
      let sprites = 0;
      let rising = 0;
      for (let i = 0; i < 30; i++) {
        const r = h.tick([], flashes);
        sprites += r.counts.sprites;
        rising += h.view.drawn.rising;
      }
      return { sprites, rising };
    };
    const on = glow(1);
    const off = glow(0);
    expect(off.rising).toBe(on.rising);
    expect(off.sprites).toBe(on.sprites);
  });
});

describe('Blind Score', () => {
  it('a real telegraph’s badge hides its answer: a "?", its place, border and pulse kept', () => {
    const badgesOf = (config: Partial<SimConfig>) => {
      const sim = sandbox(config);
      const h = harness(sim);
      const { telegraph } = telegraphOn('bell_brute', 'Toll Cleave', 0, 2.5, sim);
      h.run(1);
      const tg = sim.state.telegraphs.find((t) => t.id === telegraph.id)!;
      return { badges: [...h.overlay.badges], counts: h.tick().counts, tg, h };
    };
    const plain = badgesOf({});
    const blind = badgesOf({ dissonance: [level('blind_score')] });
    expect(plain.badges[0]!.answers).toEqual([...plain.tg.answers]);
    expect(blind.badges).toHaveLength(plain.badges.length);
    expect(blind.badges[0]!.answers).toEqual(['unknown']);
    expect(blind.badges[0]!.key).toBe(BLIND_KEY);
    // The danger reads the same: the border is the telegraph's severity.
    const danger = blind.tg.severity === 'lethal' ? VISION_HEX.lethal : VISION_HEX.threat;
    expect(blind.badges[0]!.border).toBe(danger);
    // Its place on screen and its pulse (the Perfect window's) are the same.
    expect(blind.badges[0]!.scale).toBe(plain.badges[0]!.scale);
    expect(blind.badges[0]!.label).toBe(plain.badges[0]!.label);
    // The shape on the floor is drawn exactly as without it.
    expect(blind.counts.telegraphs).toBe(plain.counts.telegraphs);
    expect(blind.h.telegraphs.drawn.blind).toBeGreaterThan(0);
    expect(plain.h.telegraphs.drawn.blind).toBe(0);
  });

  it('every shape hides its answers; marks and links keep their countdown, timers their seconds', () => {
    const grammar = (config: Partial<SimConfig>) => {
      const sim = sandbox(config);
      const h = harness(sim);
      h.run(2, [spawn('hollow_chorister', 0, -9)]);
      const s = sim.state;
      const enemy = firstEnemy(sim).id;
      const [kael, lyra, vexis] = s.party;
      const now = s.time;
      type T = WorldState['telegraphs'][number];
      let id = 9000;
      const mk = (shape: T['shape'], answers: T['answers'], effect: T['effect'] = 'damage'): T =>
        ({
          id: id++,
          owner: enemy,
          target: null,
          attackId: 'lab',
          name: 'Lab',
          kind: 'burst',
          shape,
          start: now,
          impact: now + 3,
          perfectFrom: now + 2.65,
          damage: 300,
          pctMaxHp: 0,
          effect,
          answers,
          severity: 'normal',
        }) as T;
      h.telegraphs.preview = [
        { t: mk({ kind: 'circle', x: -4, z: -4, r: 2.5 }, ['scatter', 'reel']), effect: 'damage' },
        {
          t: mk({ kind: 'cone', x: 4, z: -3, r: 4, dirX: 0, dirZ: -1, halfAngleCos: 0.6 }, [
            'ward',
          ]),
          effect: 'damage',
        },
        {
          t: mk({ kind: 'line', x: -8, z: 4, toX: 8, toZ: 4, width: 1.4 }, ['reel', 'move']),
          effect: 'damage',
        },
        {
          t: mk({ kind: 'donut', x: 8, z: 2, innerR: 1.5, outerR: 4 }, ['stack']),
          effect: 'damage',
        },
        { t: mk({ kind: 'mark', target: lyra! }, ['chime', 'ward']), effect: 'damage' },
        { t: mk({ kind: 'link', a: kael!, b: vexis!, r: 6 }, ['scatter']), effect: 'damage' },
        {
          t: mk({ kind: 'circle', x: -9, z: -12, r: 3 }, ['focus'], 'healAllies'),
          effect: 'healAllies',
        },
      ];
      h.run(2);
      return h.overlay.badges.map((b) => ({ ...b }));
    };
    const plain = grammar({});
    const blind = grammar({ dissonance: [level('blind_score')] });
    expect(blind).toHaveLength(plain.length);
    expect(plain.length).toBe(7);
    for (const b of blind) expect(b.answers).toEqual(['unknown']);
    // The countdowns (marks, links) and every label stay.
    expect(blind.map((b) => b.label)).toEqual(plain.map((b) => b.label));
    expect(blind.filter((b) => b.label !== '').length).toBe(2);
    // The Chronomancer's timers on every telegraph: still there under Blind Score.
    const timers = grammar({
      calling: { id: 'chronomancer', path: [] },
      dissonance: [level('blind_score')],
    });
    expect(timers.filter((b) => b.label !== '').length).toBe(7);
    for (const b of timers) expect(b.answers).toEqual(['unknown']);
  });
});

describe('Elite Vanguard', () => {
  /** The Muted Nave until its elite brutes are out (wave 1 cleared), drawn throughout. */
  const elites = (dissonance: SimConfig['dissonance']) => {
    const sim: Sim = sandbox({ encounter: 'muted_nave', debug: true, dissonance });
    const h = harness(sim);
    const elite = () =>
      worldOf(sim)
        .entities.list()
        .filter((e) => e.enemy?.tier === 'elite' && !e.health?.dead);
    const brutes = () => elite().filter((e) => e.enemy!.state !== 'spawning');
    for (let t = 0; t < 60 * 40 && brutes().length === 0; t += 30) {
      h.run(30);
      // Clear the first wave (not the elites coming in) so the second one comes.
      if (worldOf(sim).internal.pendingSpawns.length === 0 && elite().length === 0)
        h.run(1, [{ t: 'debug', op: { op: 'killEnemies' } }]);
    }
    h.run(2);
    return { sim, h, list: brutes() };
  };

  it('each affix its turn on the rim, and a gem for each on the crown', () => {
    const { h, list } = elites([level('elite_vanguard')]);
    expect(list.length).toBeGreaterThanOrEqual(2);
    const e = list[0]!;
    expect(e.enemy!.affixes.length).toBe(2);
    const rec = h.entities.recs.get(e.id)!;
    expect(rec.affixColors.map((c) => c.getHexString())).toEqual(
      e.enemy!.affixes.map((a) =>
        new THREE.Color(CONTENT.affixes.find((x) => x.id === a)!.color).getHexString(),
      ),
    );
    // Over a few seconds of its pulse the rim shows each affix's colour.
    const seen = new Set<string>();
    const rim = new THREE.Color();
    for (let i = 0; i < 60 * 5; i++) {
      h.tick();
      if (h.entities.recs.get(e.id)?.dying !== -1) break;
      const { batch, i: at } = h.instance(e.id);
      batch.tintOf(at, rim);
      seen.add(rim.getHexString());
    }
    for (const c of rec.affixColors) expect(seen, c.getHexString()).toContain(c.getHexString());
    // A gem for each affix, on every two-affix elite in sight (a third may have come meanwhile).
    expect(h.entities.drawnDis.gems).toBeGreaterThanOrEqual(2 * list.length);
    expect(h.entities.drawnDis.gems % 2).toBe(0);
  });

  it('a one-affix elite (no Dissonance) keeps its one colour and wears no gems', () => {
    const { h, list } = elites([]);
    expect(list.length).toBe(1);
    const e = list[0]!;
    expect(e.enemy!.affixes.length).toBe(1);
    const want = new THREE.Color(
      CONTENT.affixes.find((x) => x.id === e.enemy!.affixes[0])!.color,
    ).getHexString();
    const rim = new THREE.Color();
    for (let i = 0; i < 120; i++) {
      h.tick();
      const { batch, i: at } = h.instance(e.id);
      batch.tintOf(at, rim);
      expect(rim.getHexString()).toBe(want);
    }
    expect(h.entities.drawnDis.gems).toBe(0);
  });
});

describe('the numbers follow the sim', () => {
  it('Muted Choir: the field is drawn where the sim has it, that much smaller', () => {
    const radius = (dissonance: SimConfig['dissonance']) => {
      const { sim, h } = setup({
        dissonance,
        chords: [{ auras: ['fortissimo'] }, { auras: ['sostenuto'] }],
      });
      h.run(30);
      // The first field drawn is the first Chord with a field.
      const chord = sim.state.field.chords.find((c) => c.radius > 0)!;
      return { drawn: h.field.batchInstance(0).radius, sim: chord.radius };
    };
    const plain = radius([]);
    const muted = radius([level('aura_radius')]);
    expect(muted.drawn).toBeCloseTo(muted.sim, 4);
    expect(plain.drawn).toBeCloseTo(plain.sim, 4);
    expect(muted.drawn / plain.drawn).toBeCloseTo(1 - value('aura_radius', 'pct') / 100, 3);
  });

  it('Fragile Threads: the Thread snaps where the sim says, and the view lets it go there', () => {
    const at = (dissonance: SimConfig['dissonance'], d: number) => {
      const { sim, h } = setup({ dissonance });
      h.run(2, [{ t: 'thread', slot: 0 }]);
      const kael = sim.state.entities.get(sim.state.party[0]!)!;
      h.run(1, [{ t: 'debug', op: { op: 'teleportWeaver', x: kael.x - d, z: kael.z } }]);
      const w = sim.state.entities.get(sim.state.weaverId)!.weaver!;
      return { drawn: h.thread.drawn, threaded: w.threadSlot !== null, tension: w.threadTension };
    };
    const snap = CONTENT.thread.snapRange;
    const shorter = value('thread_range', 'metres');
    const d = snap - shorter / 2;
    expect(at([], d)).toMatchObject({ drawn: true, threaded: true });
    expect(at([level('thread_range')], d)).toMatchObject({ drawn: false, threaded: false });
    // Inside the shorter reach it is drawn taut: the sim's tension, nearer snapping than without.
    const inside = snap - shorter - 0.5;
    const fragile = at([level('thread_range')], inside);
    const plain = at([], inside);
    expect(fragile.drawn).toBe(true);
    expect(fragile.tension).toBeGreaterThan(plain.tension + 0.5);
  });

  it('Silent Cues: the orbit ticks the Cue’s cost; at the content’s cost it looks as it did', () => {
    const ticks = (dissonance: SimConfig['dissonance']) => {
      const { h } = setup({ dissonance });
      h.run(2);
      return h.entities.drawnDis.cueTicks;
    };
    expect(ticks([])).toBe(0);
    expect(ticks([level('cue_cost')])).toBeGreaterThan(0);
  });

  it('Short Fuse: a telegraph is drawn over the sim’s shorter wind-up', () => {
    const windup = (dissonance: SimConfig['dissonance']) => {
      const sim = sandbox({ dissonance });
      const h = harness(sim);
      const { telegraph } = telegraphOn('bell_brute', 'Toll Cleave', 0, 2.5, sim);
      h.run(1);
      const g = h.telegraphs.geometry(telegraph.id)!;
      const t = sim.state.telegraphs.find((k) => k.id === telegraph.id)!;
      return {
        length: t.impact - t.start,
        progress: g.progress,
        elapsed: sim.state.time - t.start,
      };
    };
    const plain = windup([]);
    const fuse = windup([level('windup', 2)]);
    expect(fuse.length / plain.length).toBeCloseTo(1 - (2 * value('windup', 'pct')) / 100, 2);
    expect(fuse.progress).toBeCloseTo(fuse.elapsed / fuse.length, 2);
  });
});

describe('no new draw calls', () => {
  it('every level at once draws through the same FX batches and model batches', () => {
    const batches = (dissonance: SimConfig['dissonance']) => {
      const { sim, h } = setup({ dissonance });
      const spawns: Command[] = [];
      for (let i = 0; i < 4; i++) spawns.push(spawn('hollow_chorister', -3 + i * 2, -6));
      h.run(2, spawns);
      for (const e of worldOf(sim)
        .entities.list()
        .filter((x) => x.enemy))
        strike(sim, e.id);
      h.run(20);
      return { fx: h.kit.group.children.length, models: h.entities.group.children.length };
    };
    const every = CONTENT.dissonance.map((d) => ({ id: d.id, rank: d.ranks }));
    expect(batches(every)).toEqual(batches([]));
  });
});
