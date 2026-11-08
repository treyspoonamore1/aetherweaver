/**
 * Phase 5e VFX: Oro, the Grovekeeper (docs/phase-5e.md, Presentation). Every check drives a real
 * headless sim and feeds its state and events to the real EntityLayer, PartyBarsView, Feedback,
 * ThreadView and the Ancient's disc over a real FxKit, then reads what they drew. His Saplings
 * and the Ancient are the sim's to spawn (W2's `grove.ts` and `summons.ts`): the test stages
 * them on the real world as the contract says the sim keeps them (summon entities of kind
 * `summon`, team `party`, never in `party`), so render is checked against the contract alone.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CONTENT, heroDef } from '../src/content';
import {
  createSim,
  newGrove,
  type Command,
  type Sim,
  type SimEvent,
  type Status,
} from '../src/sim';
import type { Entity } from '../src/sim/state';
import { newHealth } from '../src/sim/world';
import { CallView } from '../src/render/calls';
import type { CameraRig } from '../src/render/camera';
import { EntityLayer } from '../src/render/entities';
import { FermataView } from '../src/render/fermata';
import { Feedback } from '../src/render/feedback';
import { FieldView } from '../src/render/field';
import { FxKit } from '../src/render/fx/kit';
import { PARTICLE } from '../src/render/fx/particles';
import {
  CHOIR_HEX,
  CHOIR_RADIUS,
  GROVE_HEX,
  SUMMON_BATCH,
  SUMMON_NUMBER_SHARE,
} from '../src/render/groveCues';
import { RING } from '../src/render/fx/rings';
import { GroveDiscView } from '../src/render/groveDisc';
import { ORO_SEED, buildAncient, buildHero, buildSapling } from '../src/render/models/library';
import { createModelMaterial } from '../src/render/models/material';
import type { AllyBarView, Overlay, SummonBarView } from '../src/render/overlay';
import { applyVision } from '../src/render/palette';
import { PartyBarsView } from '../src/render/partyBars';
import { REGEN_MASK } from '../src/render/songs';
import type { Stage } from '../src/render/stage';
import { TelegraphLayer } from '../src/render/telegraphs';
import { ThreadView } from '../src/render/thread';
import type { FrameInfo } from '../src/render/types';
import { sandbox, spawn, worldOf } from './sim/helpers';

const SETTINGS: FrameInfo['settings'] = {
  screenShake: 1,
  flashes: 1,
  damageNumbers: true,
  colorVision: 'normal',
};

/** Kael, Lyra, Oro: Oro in Vexis's slot. */
const WITH_ORO = ['kael', 'lyra', 'oro'];
const ORO = 2;

class FakeOverlay {
  width = 1280;
  height = 720;
  bars: AllyBarView[] = [];
  summonBars: SummonBarView[] = [];
  numbers = 0;
  beginFrame(): void {
    this.bars.length = 0;
    this.summonBars.length = 0;
  }
  badge(): void {}
  allyBar(_x: number, _y: number, _z: number, bar: AllyBarView): void {
    this.bars.push({ ...bar });
  }
  summonBar(_x: number, _y: number, _z: number, bar: SummonBarView): void {
    this.summonBars.push({ ...bar });
  }
  raid(): void {}
  callout(): void {}
  spawnNumber(): number {
    return this.numbers++;
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

function harness(sim: Sim) {
  const kit = new FxKit();
  const entities = new EntityLayer(createModelMaterial());
  const field = new FieldView(entities);
  const telegraphs = new TelegraphLayer(entities);
  const thread = new ThreadView(entities, null);
  const bars = new PartyBarsView(entities);
  const root = new THREE.Group();
  const disc = new GroveDiscView(root);
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
    disc.sync(sim.state, time);
    telegraphs.sync(sim.state, kit, overlay, 1 / 60, true);
    thread.sync(sim.state, kit, 1 / 60, time);
    bars.sync(sim.state, fake, 1 / 60, time);
    feedback.sync(sim.state, info, 1 / 60);
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
    bars,
    feedback,
    thread,
    disc,
    root,
    rig,
    overlay: fake,
    run,
    frame,
    drewIn,
  };
}

function setup(party: string[] = WITH_ORO) {
  const sim = sandbox({ party });
  // W2's sim plants his Saplings itself; these tests stage their own (`sprout`, `ancient`).
  clearGrove(sim, true);
  const w = worldOf(sim);
  const of = (slot: number) => w.entities.get(w.party[slot]!)! as Entity;
  return { sim, w, of, h: harness(sim) };
}

/**
 * Takes away the summons the sim spawned (W2's `spawnGrove` plants his Saplings when the fight is
 * made), so the tests below stage their own and render is checked against what they set. The
 * summons list goes with them, so the sim neither tends nor re-sprouts them, and the field writes
 * no `auraMask`/`inField` over what a test stages. `quiet`: before any frame, their spawn events
 * are dropped too (render never saw them); later, render hears them despawn.
 */
function clearGrove(sim: Sim, quiet = false) {
  const w = worldOf(sim);
  const ids = new Set(w.internal.summons ?? []);
  for (const id of ids) {
    w.entities.despawn(id);
    if (!quiet) w.events.push({ type: 'entityDespawned', tick: w.tick, id, kind: 'summon' });
  }
  delete w.internal.summons;
  delete w.field.ancient;
  for (const id of w.party) {
    const grove = w.entities.get(id)?.hero?.grove;
    if (!grove) continue;
    grove.saplings.length = 0;
    grove.respawnAt.length = 0;
    grove.ancient = null;
  }
  if (!quiet || ids.size === 0) return;
  for (const e of w.events.drain())
    if (
      !(e.type === 'entitySpawned' && ids.has(e.id)) &&
      !(e.type === 'summonSpawned' && ids.has(e.summon))
    )
      w.events.push(e);
}

/**
 * Oro's Saplings as W2 spawns them: summon entities at the Weaver's front spots, never in the
 * party, in his grove (staged here, in place of the sim's own: `clearGrove`). `inField`/`auraMask`: Q1's (W2b's) keys.
 */
function sprout(sim: Sim, oro: Entity, opts: { inField?: boolean[]; mask?: number } = {}) {
  const w = worldOf(sim);
  if (!oro.hero!.grove) oro.hero!.grove = newGrove();
  const grove = oro.hero!.grove;
  const weaver = w.entities.get(w.weaverId)!;
  const out: Entity[] = [];
  [-2.5, 2.5].forEach((dx, index) => {
    const x = weaver.x + dx;
    const z = weaver.z - 5;
    const e = w.entities.spawn('summon', {
      x,
      z,
      radius: 0.55,
      height: 0.7,
      team: 'party',
      health: newHealth(380, 380),
      summon: {
        owner: oro.id,
        kind: 'sapling',
        index,
        targetId: null,
        attackCooldown: 0,
        tauntAt: 0,
        plantX: x,
        plantZ: z,
        auraMask: opts.mask ?? 0,
        inField: opts.inField?.[index] ?? true,
        mendHealAcc: 0,
        auraHealAcc: 0,
      },
    });
    grove.saplings[index] = e.id;
    grove.respawnAt[index] = 0;
    out.push(e);
  });
  // The store adds them to its list at the next flush (the sim's own step).
  sim.step([]);
  sim.drainEvents();
  return out;
}

/**
 * The Ancient as W2's `raiseAncient` spawns it: burrowed through its 1 s ground warning
 * (`burrowUntil`, its rise), standing `life` s after it rises (`extra`: World Tree's 4 s more).
 */
function ancient(sim: Sim, oro: Entity, cued: boolean, extra = 0) {
  const w = worldOf(sim);
  const grove = oro.hero!.grove!;
  const rise = w.time + 1;
  const e = w.entities.spawn('summon', {
    x: 0,
    z: -8,
    radius: 1.1,
    height: 2.6,
    team: 'party',
    health: newHealth(2000, 2000),
    summon: {
      owner: oro.id,
      kind: 'ancient',
      index: 0,
      burrowUntil: rise,
      until: rise + heroDef('oro').summons!.ancient.life + extra,
      targetId: null,
      attackCooldown: 0,
      tauntAt: 0,
      plantX: 0,
      plantZ: -8,
      mendHealAcc: 0,
      auraHealAcc: 0,
    },
  });
  grove.ancient = e.id;
  if (cued) w.field.ancient = { id: e.id, x: 0, z: -8, r: 6 };
  sim.step([]);
  sim.drainEvents();
  return e;
}

afterEach(() => applyVision('normal'));

describe('Oro’s models', () => {
  const parts = (g: THREE.BufferGeometry, hex: string) => {
    const c = g.getAttribute('color');
    const want = new THREE.Color(hex);
    let n = 0;
    for (let i = 0; i < c.count; i++)
      if (
        Math.abs(c.getX(i) - want.r) < 1e-4 &&
        Math.abs(c.getY(i) - want.g) < 1e-4 &&
        Math.abs(c.getZ(i) - want.b) < 1e-4
      )
        n++;
    return n;
  };
  const bounds = (g: THREE.BufferGeometry) => {
    g.computeBoundingBox();
    return g.boundingBox!;
  };
  const luma = (g: THREE.BufferGeometry) => {
    const c = g.getAttribute('color');
    let s = 0;
    for (let i = 0; i < c.count; i++)
      s += 0.2126 * c.getX(i) + 0.7152 * c.getY(i) + 0.0722 * c.getZ(i);
    return s / c.count;
  };

  it('builds a summoner of his own: moss mantle, branch crown, the ORO_SEED trim', () => {
    const g = buildHero(heroDef('oro'));
    expect(g.getAttribute('position').count).toBeGreaterThan(400);
    expect(parts(g, heroDef('oro').color)).toBeGreaterThan(40);
    // The trim his Movement II and III measure needs (tests/colorVision.test.ts).
    expect(parts(g, ORO_SEED)).toBeGreaterThan(12);
  });

  it('reads apart from Kael in greyscale: short and broad, a different value', () => {
    const k = bounds(buildHero(heroDef('kael')));
    const o = bounds(buildHero(heroDef('oro')));
    expect(o.max.y).toBeLessThan(k.max.y - 0.15);
    expect(
      Math.abs(luma(buildHero(heroDef('oro'))) - luma(buildHero(heroDef('kael')))),
    ).toBeGreaterThan(0.03);
  });

  it('a knee-high Sapling and a 2.6 m Ancient, each with the seed glow', () => {
    const s = buildSapling();
    const a = buildAncient();
    expect(bounds(s).max.y).toBeLessThan(0.8);
    expect(bounds(a).max.y).toBeGreaterThan(2.4);
    expect(bounds(a).max.y).toBeLessThan(3.1);
    expect(parts(s, ORO_SEED)).toBeGreaterThan(0);
    expect(parts(a, ORO_SEED)).toBeGreaterThan(0);
  });
});

describe('his summons, drawn', () => {
  it('two lazy model batches, made only by the first summon; never a hero’s or a dummy’s', () => {
    const { sim, of, h } = setup();
    h.run(30);
    const before = h.entities.group.children.length;
    const saplings = sprout(sim, of(ORO));
    h.frame([]);
    expect(h.entities.group.children.length).toBe(before + 1);
    expect(h.entities.drawn5e.saplings).toBe(2);
    expect(h.entities.recs.get(saplings[0]!.id)!.kind).toBe('summon');
    expect(h.entities.recs.get(saplings[0]!.id)!.role).toBe('sapling');
    ancient(sim, of(ORO), false);
    h.frame([]);
    expect(h.entities.group.children.length).toBe(before + 2);
    expect(h.entities.drawn5e.ancients).toBe(1);
    expect(SUMMON_BATCH.sapling.capacity).toBe(8);
    expect(SUMMON_BATCH.ancient.capacity).toBe(2);
  });

  it('their aura rims as a hero’s: lit in your field, the same arcs grey outside it', () => {
    const { sim, of, h } = setup();
    h.run(2);
    sprout(sim, of(ORO), { inField: [true, false], mask: 0b1 });
    h.frame([]);
    expect(h.entities.drawn5e.summonRims).toBe(1);
    expect(h.entities.drawn5e.greyRims).toBe(1);
    expect(h.drewIn(GROVE_HEX.out)).toBe(true);
  });

  it('root tethers in his moss to each Sapling; the closed leaf while he tends', () => {
    const { sim, w, of, h } = setup();
    h.run(2);
    sprout(sim, of(ORO));
    // Their records are made as they are first drawn (after Oro's): the tethers from the next.
    h.frame([]);
    h.frame([]);
    expect(h.entities.drawn5e.rootTethers).toBe(2);
    expect(h.entities.drawn5e.tending).toBe(1);
    expect(h.drewIn(GROVE_HEX.moss)).toBe(true);
    // A Focus wakes him: no leaf.
    h.run(1, [spawn('hollow_chorister', 0, -9)]);
    h.run(40);
    const foe = [...w.entities.list()].find((e) => e.enemy && !e.health!.dead)!;
    (w as { focusTarget: number | null }).focusTarget = foe.id;
    h.frame([]);
    expect(h.entities.drawn5e.tending).toBe(0);
  });

  it('a burrow trail while re-planting; a dormant Sapling grey and still', () => {
    const { sim, w, of, h } = setup();
    h.run(2);
    const [a, b] = sprout(sim, of(ORO));
    a!.summon!.burrowUntil = w.time + 0.8;
    a!.summon!.plantX += 3;
    b!.summon!.dormant = true;
    h.frame([]);
    expect(h.entities.drawn5e.burrows).toBe(1);
    expect(h.entities.drawn5e.dormant).toBe(1);
    const bars = h.bars.drawnSummons;
    expect(bars.find((x) => x.id === a!.id)!.burrowing).toBe(true);
    expect(bars.find((x) => x.id === b!.id)!.dormant).toBe(true);
  });

  it('real sim: while Oro is down, and through his wake, his Saplings stand grey and still', () => {
    // The sim's own grove (no clearGrove): while he is down `tendGrove` pushes each dormant
    // Sapling's `burrowUntil` ahead every tick, which is the grove waiting, never a re-plant.
    const sim = sandbox({ party: WITH_ORO });
    const w = worldOf(sim);
    const h = harness(sim);
    const oro = w.entities.get(w.party[ORO]!)!;
    h.run(30);
    const ids = [...oro.hero!.grove!.saplings];
    expect(ids.length).toBeGreaterThan(0);
    const bars = () => h.bars.drawnSummons.filter((b) => ids.includes(b.id));
    const look = (ticks: number) => {
      let burrows = 0;
      let still = 0;
      for (let i = 0; i < ticks; i++) {
        h.run(1);
        burrows += h.entities.drawn5e.burrows;
        still += h.entities.drawn5e.dormant;
        for (const b of bars()) {
          expect(b.burrowing).toBe(false);
          expect(b.dormant).toBe(true);
        }
        for (const id of ids)
          expect(h.entities.recs.get(id)!.y, 'not sunk into the ground').toBeGreaterThan(-0.1);
      }
      return { burrows, still };
    };
    oro.health!.downed = true;
    oro.health!.bleedOut = 60;
    const down = look(30);
    expect(down.burrows).toBe(0);
    expect(down.still).toBe(30 * ids.length);
    // He rises: they wake 2 s on (summons.ts WAKE), held where they stand until then.
    oro.health!.downed = false;
    oro.health!.bleedOut = 0;
    const wake = look(30);
    expect(w.entities.get(ids[0]!)!.summon!.burrowUntil!).toBeGreaterThan(w.time);
    expect(wake.burrows).toBe(0);
    expect(wake.still).toBe(30 * ids.length);
    // A Rally in the wake moves the plant spot: from then on it burrows.
    const s = w.entities.get(ids[0]!)!.summon!;
    s.plantX += 3;
    s.burrowUntil = w.time + 0.8;
    h.frame([]);
    expect(h.entities.drawn5e.burrows).toBe(1);
    expect(h.bars.drawnSummons.find((b) => b.id === ids[0])!.burrowing).toBe(true);
  });

  it('Verdant Choir: a ring of leaves in Sostenuto’s green round each Sapling singing it', () => {
    const { sim, w, of, h } = setup();
    h.run(2);
    const [a, b] = sprout(sim, of(ORO), { inField: [true, false] });
    const leaves = () => {
      const ring = h.kit.rings.array('iRing');
      const out: number[] = [];
      for (let i = 0; i < h.kit.rings.size; i++)
        if (ring[i * 4 + 3] === RING.leaf) out.push(ring[i * 4]!);
      return out;
    };
    // Without the motif: nothing, whatever stands in your field.
    h.frame([]);
    expect(h.entities.drawn5e.choirRings).toBe(0);
    expect(leaves()).toEqual([]);
    (w.mods as { verdantChoir: number }).verdantChoir = 0.3;
    h.frame([]);
    // Only the Sapling in your field sings (the sim's rule): one ring, its reach, leaf-shaped.
    expect(h.entities.drawn5e.choirRings).toBe(1);
    expect(leaves()).toEqual([CHOIR_RADIUS]);
    expect(h.drewIn(CHOIR_HEX)).toBe(true);
    expect(CHOIR_HEX).toBe(CONTENT.auras.find((x) => x.id === 'sostenuto')!.color);
    b!.summon!.inField = true;
    h.frame([]);
    expect(h.entities.drawn5e.choirRings).toBe(2);
    // Held (the field clears `inField`), felled: silent.
    delete a!.summon!.inField;
    b!.health!.dead = true;
    h.frame([]);
    expect(h.entities.drawn5e.choirRings).toBe(0);
  });

  it('Verdant Choir rings in the real sim: the field’s own coverage, only with the motif', () => {
    const sim = sandbox({
      party: WITH_ORO,
      auras: ['sostenuto'],
      motifs: [{ id: 'verdant_choir', level: 1 }],
    });
    const h = harness(sim);
    expect(sim.state.mods.verdantChoir).toBeGreaterThan(0);
    let rings = 0;
    for (let i = 0; i < 60; i++) {
      h.run(1);
      rings = Math.max(rings, h.entities.drawn5e.choirRings);
    }
    const singing = [...sim.state.entities.list()].filter(
      (e) => e.summon?.kind === 'sapling' && e.summon.inField === true,
    ).length;
    expect(h.entities.drawn5e.choirRings).toBe(singing);
    expect(rings).toBeGreaterThan(0);
    // The same fight without it draws none.
    const plain = sandbox({ party: WITH_ORO, auras: ['sostenuto'] });
    const p = harness(plain);
    for (let i = 0; i < 60; i++) {
      p.run(1);
      expect(p.entities.drawn5e.choirRings).toBe(0);
    }
  });

  it('the Ancient: its ground warning before it rises, its taunt ring; vines on what it roots', () => {
    const { sim, w, of, h } = setup();
    h.run(1, [spawn('hollow_chorister', 1, -8)]);
    h.run(40);
    sprout(sim, of(ORO));
    ancient(sim, of(ORO), false);
    h.frame([]);
    // Burrowed through its warning: the closing ring, no taunt ring yet, no burrow trail.
    expect(h.entities.drawn5e.warnings).toBe(1);
    expect(h.entities.drawn5e.tauntRings).toBe(0);
    expect(h.entities.drawn5e.burrows).toBe(0);
    const foe = [...w.entities.list()].find((e) => e.enemy && !e.health!.dead)!;
    foe.enemy!.rootImmuneUntil = w.time + 5.5;
    foe.health!.statuses.push({
      id: 'rooted',
      remaining: 1.5,
      duration: 1.5,
      stacks: 1,
      source: null,
    } as Status);
    h.frame([{ type: 'rooted', tick: sim.state.tick, target: foe.id, seconds: 1.5 }]);
    expect(h.entities.drawn5e.vines).toBe(1);
    expect(h.feedback.grove.fired5e.rooted).toBe(1);
    // A second later it has risen: the warning is gone; the taunt ring stands while it does.
    for (let i = 0; i < 70; i++) {
      sim.step([]);
      h.frame(sim.drainEvents());
    }
    expect(h.entities.drawn5e.warnings).toBe(0);
    expect(h.entities.drawn5e.tauntRings).toBe(1);
  });

  it('times the warning from its rise, never its stand: World Tree’s 4 s more move nothing', () => {
    const { sim, w, of, h } = setup();
    h.run(30);
    sprout(sim, of(ORO));
    const a = ancient(sim, of(ORO), false, 4);
    const rise = a.summon!.burrowUntil!;
    // The warning shows from its first frame, while it is still below.
    h.frame([]);
    expect(h.entities.drawn5e.warnings).toBe(1);
    expect(h.entities.drawn5e.tauntRings).toBe(0);
    const below = h.entities.recs.get(a.id)!.y;
    expect(below).toBeLessThan(0);
    // Through its whole stand, after it rises, no warning shows again (the old clock, `until`
    // less the base 8 s, put one 4 s into a World Tree stand).
    let late = 0;
    while (w.time < a.summon!.until! - 0.1) {
      sim.step([]);
      h.frame(sim.drainEvents());
      if (w.time > rise) late += h.entities.drawn5e.warnings;
    }
    expect(late).toBe(0);
    expect(h.entities.drawn5e.tauntRings).toBe(1);
    expect(h.entities.recs.get(a.id)!.y).toBeGreaterThan(below);
  });

  it('the Cued Ancient’s disc is its own lazy decal, never one of the field’s slots', () => {
    const { sim, of, h } = setup();
    h.run(30);
    expect(h.disc.created).toBe(false);
    sprout(sim, of(ORO));
    ancient(sim, of(ORO), false);
    h.frame([]);
    // Uncued: no disc.
    expect(h.disc.created).toBe(false);
    worldOf(sim).field.ancient = { id: worldOf(sim).party[0]!, x: 0, z: -8, r: 6 };
    h.frame([]);
    expect(h.disc.created).toBe(true);
    expect(h.disc.drawn).toBe(true);
    expect(h.root.children.length).toBe(1);
    delete worldOf(sim).field.ancient;
    h.frame([]);
    expect(h.disc.drawn).toBe(false);
  });
});

describe('his healing, his numbers, his bars', () => {
  it('Rootbond on a Sapling runs motes along his tether, never the Thread’s pulse', () => {
    const { sim, of, h } = setup();
    h.run(2);
    const [a] = sprout(sim, of(ORO));
    const pulse = vi.spyOn(h.thread, 'pulse');
    // As grove.ts `rootbond` sends it: via 'mend' on the summon.
    h.frame([
      {
        type: 'healApplied',
        tick: sim.state.tick,
        target: a!.id,
        source: of(ORO).id,
        amount: 20,
        overheal: 0,
        via: 'mend',
      },
    ]);
    h.frame([]);
    expect(pulse).not.toHaveBeenCalled();
    expect(h.feedback.grove.fired5e.rootbond).toBe(1);
    expect(h.feedback.grove.drawn5e.motes).toBeGreaterThan(0);
    expect(h.drewIn(GROVE_HEX.seed)).toBe(true);
    // A Mend on a hero still pulses it.
    h.frame([
      {
        type: 'healApplied',
        tick: sim.state.tick,
        target: of(0).id,
        source: null,
        amount: 20,
        overheal: 0,
        via: 'mend',
      },
    ]);
    expect(pulse).toHaveBeenCalledTimes(1);
  });

  it('only Rootbond on a summon is motes: a song’s regen reads as on a hero, Regrowth as a heal', () => {
    const { sim, of, h } = setup();
    h.run(2);
    const [a] = sprout(sim, of(ORO), { mask: REGEN_MASK });
    h.frame([]);
    const pulse = vi.spyOn(h.thread, 'pulse');
    const emit = vi.spyOn(h.kit.particles, 'emit');
    const heal = (via: 'aura' | 'solo' | 'mend', amount: number): SimEvent => ({
      type: 'healApplied',
      tick: sim.state.tick,
      target: a!.id,
      source: via === 'solo' ? null : sim.state.weaverId,
      amount,
      overheal: 0,
      via,
    });
    const n0 = h.overlay.numbers;
    // Q1: Sostenuto's regen on a covered Sapling (1.5% of 380 a second), with Oro not Threaded.
    h.frame([heal('aura', 5.7)]);
    // Its notes rise in the regen song's colour (the Sapling's own mask), as on a hero.
    const song = h.entities.auraColors(REGEN_MASK)[0]!;
    const notes = emit.mock.calls.filter((c) => c[10] === PARTICLE.note);
    expect(notes.length).toBeGreaterThan(0);
    expect(notes.every((c) => (c[8] as THREE.Color).equals(song))).toBe(true);
    h.frame([]);
    expect(h.feedback.grove.fired5e.rootbond).toBe(0);
    expect(h.feedback.grove.drawn5e.motes).toBe(0);
    // Regrowth (a small share) and Homecoming (its whole life): no motes, no Thread pulse; only
    // Homecoming's is important enough for a number. The regen tick gets none.
    h.frame([heal('solo', 60)]);
    expect(h.overlay.numbers).toBe(n0);
    h.frame([heal('solo', 380)]);
    expect(h.overlay.numbers).toBe(n0 + 1);
    expect(h.feedback.grove.fired5e.rootbond).toBe(0);
    // Rootbond as the sim flushes it (via 'mend' on the summon): motes, never the Thread's pulse.
    h.frame([heal('mend', 12)]);
    h.frame([]);
    expect(h.feedback.grove.fired5e.rootbond).toBe(1);
    expect(h.feedback.grove.drawn5e.motes).toBeGreaterThan(0);
    expect(pulse).not.toHaveBeenCalled();
  });

  it('a hard blow on a Sapling never shakes the camera; on a hero it still does', () => {
    const { sim, of, h } = setup();
    h.run(2);
    const [a] = sprout(sim, of(ORO));
    h.frame([]);
    const trauma = vi.spyOn(h.rig, 'addTrauma');
    const hit = (target: number, amount: number): SimEvent => ({
      type: 'damageTaken',
      tick: sim.state.tick,
      target,
      source: null,
      amount,
      absorbed: 0,
      amplified: 0,
      aura: 0,
      radiance: 0,
      eclipse: 0,
      crit: false,
      telegraph: null,
      hit: 'hit',
    });
    // 200 is over half a Sapling's 380: a hero's hurt would shake it.
    h.frame([hit(a!.id, 200), hit(a!.id, 150)]);
    expect(trauma).not.toHaveBeenCalled();
    const hero = of(0);
    h.frame([hit(hero.id, hero.health!.maxHp * 0.4)]);
    expect(trauma).toHaveBeenCalledTimes(1);
  });

  it('a Sapling’s numbers are important-only: a quarter of its life, or the felling blow', () => {
    const { sim, of, h } = setup();
    h.run(2);
    const [a] = sprout(sim, of(ORO));
    const hit = (amount: number): SimEvent => ({
      type: 'damageTaken',
      tick: sim.state.tick,
      target: a!.id,
      source: null,
      amount,
      absorbed: 0,
      amplified: 0,
      aura: 0,
      radiance: 0,
      eclipse: 0,
      crit: false,
      telegraph: null,
      hit: 'hit',
    });
    const n0 = h.overlay.numbers;
    h.frame([hit(20)]);
    expect(h.overlay.numbers).toBe(n0);
    h.frame([hit(380 * SUMMON_NUMBER_SHARE + 1)]);
    expect(h.overlay.numbers).toBe(n0 + 1);
  });

  it('their bars: a separate pool, keyless, with a leaf in his moss; the heroes’ bars as ever', () => {
    const { sim, of, h } = setup();
    h.run(2);
    const [a, b] = sprout(sim, of(ORO), { inField: [true, false] });
    h.frame([]);
    expect(h.overlay.bars.length).toBe(3);
    expect(h.overlay.summonBars.length).toBe(2);
    // By id: the slots the sim's own Saplings freed are reused in either order.
    const bar = (id: number) => h.bars.drawnSummons.find((d) => d.id === id);
    const inside = bar(a!.id);
    const outside = bar(b!.id);
    expect(inside!.inField).toBe(true);
    expect(outside!.inField).toBe(false);
    expect(inside!.leafHex).toBe(heroDef('oro').color);
    expect(inside!.tended).toBe(true);
    for (const b of h.overlay.summonBars) expect(b).not.toHaveProperty('key');
  });

  it('a summon spawning and falling plays its own moments', () => {
    const { sim, of, h } = setup();
    h.run(2);
    const [a] = sprout(sim, of(ORO));
    const oro = of(ORO);
    h.frame([
      {
        type: 'summonSpawned',
        tick: sim.state.tick,
        owner: oro.id,
        summon: a!.id,
        kind: 'sapling',
      },
    ]);
    h.frame([
      { type: 'summonFell', tick: sim.state.tick, owner: oro.id, summon: a!.id, kind: 'sapling' },
      { type: 'gentleRefused', tick: sim.state.tick, hero: oro.id },
    ]);
    expect(h.feedback.grove.fired5e).toMatchObject({ sprouts: 1, felled: 1, refused: 1 });
  });
});

describe('the budget, and every other party', () => {
  it('the heroes’ bar pool stays 4 and the field shader’s slots 4: summons have their own', () => {
    const src = (f: string) => readFileSync(join(__dirname, '..', 'src', 'render', f), 'utf8');
    const overlay = src('overlay.ts');
    // The ally bars' pool (made in the constructor), and the summon bars' lazy one apart.
    expect(overlay).toMatch(/for \(let i = 0; i < 4; i\+\+\) \{\s+const el = div\(\s+this\.root,/);
    expect(overlay).toMatch(/const SUMMON_BARS = 6;/);
    expect(overlay).toMatch(/private summonBars: SummonBarItem\[\] \| null = null;/);
    expect(src('field.ts')).toMatch(/MAX_FIELDS = 4\b/);
    expect(src('field.ts')).not.toMatch(/ancient/);
  });

  it('no new FX batches; the default party makes no summon batch, bar or disc', () => {
    const count = (party: string[] | undefined, grow: boolean) => {
      const sim = createSim({ seed: 7, encounter: 'first_light', ...(party ? { party } : {}) });
      const h = harness(sim);
      h.run(300);
      if (grow) {
        const oro = worldOf(sim).entities.get(worldOf(sim).party[ORO]!)!;
        clearGrove(sim);
        sprout(sim, oro, { mask: 0b11 });
        ancient(sim, oro, true);
      }
      let any = 0;
      for (let i = 0; i < 300; i++) {
        sim.step([]);
        h.frame(sim.drainEvents());
        for (const n of Object.values(h.entities.drawn5e)) any += n;
        any += h.bars.drawnSummons.length;
      }
      return {
        fx: h.kit.group.children.length,
        models: h.entities.group.children.length,
        rings: h.kit.rings.size,
        any,
        disc: h.disc.created,
        summons: h.entities.summonIds.length,
      };
    };
    const def = count(undefined, false);
    expect(def.any).toBe(0);
    expect(def.disc).toBe(false);
    expect(def.summons).toBe(0);
    const brann = count(['kael', 'brann', 'vexis'], false);
    expect(brann.any).toBe(0);
    const oro = count(WITH_ORO, true);
    expect(oro.fx).toBe(def.fx);
    expect(oro.disc).toBe(true);
    expect(oro.summons).toBe(3);
    expect(oro.rings).toBeLessThan(384);
    expect(CONTENT.heroes.map((d) => d.id)).toContain('oro');
  });
});
