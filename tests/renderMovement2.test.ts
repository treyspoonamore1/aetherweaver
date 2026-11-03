/**
 * Phase 5a VFX: Movement II, the Crimson Legion (docs/phase-5a/vfx-audio.md). Every check drives a
 * real headless sim and feeds its state and events to the real EntityLayer, FieldView,
 * TelegraphLayer, PartyBarsView and Feedback over a real FxKit, then reads what they drew. Where a
 * Movement II mechanic is the sim's to produce (a status's stacks, a guard, the Sanctuary pools, a
 * leap's `attackFired`), the test stages that state on the real world the way the sim keeps it, so
 * the render side is checked against the contract (docs/phase-5a.md) on its own.
 */
import * as THREE from 'three';
import { afterEach, describe, expect, it } from 'vitest';
import { COLOR_VISIONS, deltaE, simulateVision, visionPalette } from '../src/app/colorVision';
import { CONTENT, arenaDef, attackDef, enemyDef } from '../src/content';
import type { Command, Sim, SimEvent, SimEventOf, Status } from '../src/sim';
import { dealDamage, healReceivedMult } from '../src/sim/combat/health';
import { beginAttack } from '../src/sim/systems/enemies';
import type { Entity } from '../src/sim';
import { ArenaView } from '../src/render/arena';
import { CameraRig } from '../src/render/camera';
import { CallView } from '../src/render/calls';
import {
  BLEED_CHIME_AT,
  CRIMSON_HEX,
  PIP_LIFT,
  STATUS_BADGE_LIFT,
  WOUND_LIFT,
  WOUND_SIZE,
  SPIRE_HEX,
  arenaLook,
  arenaMood,
  guardArc,
  inSanctuary,
  isPact,
  pipOffset,
} from '../src/render/crimsonCues';
import { CHARGE_SECONDS, EntityLayer, LEAP_SECONDS } from '../src/render/entities';
import { FermataView } from '../src/render/fermata';
import { Feedback } from '../src/render/feedback';
import { FieldView } from '../src/render/field';
import { FxKit } from '../src/render/fx/kit';
import { RING } from '../src/render/fx/rings';
import { buildEnemy } from '../src/render/models/library';
import { createModelMaterial } from '../src/render/models/material';
import { glyphLabel, type Overlay } from '../src/render/overlay';
import { MARTYR_HEX } from '../src/render/martyrCues';
import { BAR_LIFT, PartyBarsView } from '../src/render/partyBars';
import type { Stage } from '../src/render/stage';
import { TelegraphLayer } from '../src/render/telegraphs';
import { ThreadView } from '../src/render/thread';
import type { FrameInfo } from '../src/render/types';
import { ANSWER } from '../src/ui/hud/labels';
import { ofType, sandbox, spawn, worldOf } from './sim/helpers';
import { createSim } from '../src/sim';

const SETTINGS: FrameInfo['settings'] = {
  screenShake: 1,
  flashes: 1,
  damageNumbers: true,
  colorVision: 'normal',
};

/** An overlay that records what it is asked to show (and ignores the rest). */
class FakeOverlay {
  width = 1280;
  height = 720;
  badges: { answers: string[]; border: string; label: string; x: number; z: number }[] = [];
  callouts: string[] = [];
  numbers: { color: string; size: number }[] = [];
  bars: { notch?: number }[] = [];
  beginFrame(): void {
    this.badges.length = 0;
    this.bars.length = 0;
  }
  badge(
    x: number,
    _y: number,
    z: number,
    answers: readonly string[],
    _key: string,
    border: string,
    label: string,
  ): void {
    this.badges.push({ answers: [...answers], border, label, x, z });
  }
  allyBar(_x: number, _y: number, _z: number, bar: { notch?: number }): void {
    this.bars.push({ ...bar });
  }
  raid(): void {}
  callout(_x: number, _y: number, _z: number, text: string): void {
    this.callouts.push(text);
  }
  spawnNumber(_x: number, _y: number, _z: number, color: string, size: number): number {
    this.numbers.push({ color, size });
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
    const counts = { rings: kit.rings.size, sprites: kit.sprites.size, beams: kit.beams.size };
    kit.end(1 / 60, 1280, 720, 720, 45);
    time += 1 / 60;
    return counts;
  };
  const tick = (commands: Command[] = []) => {
    sim.step(commands);
    const ev = sim.drainEvents();
    return { counts: frame(ev), events: ev };
  };
  const run = (ticks: number, commands: Command[] = []) => {
    const seen: SimEvent[] = [];
    for (let i = 0; i < ticks; i++) seen.push(...tick(i === 0 ? commands : []).events);
    return seen;
  };
  /** Rings drawn last frame in a style: their centre, radius, arc and param. */
  const ringsOf = (style: number) => {
    const pos = kit.rings.array('iPos');
    const ring = kit.rings.array('iRing');
    const arc = kit.rings.array('iArc');
    const out: { x: number; z: number; r: number; start: number; len: number; param: number }[] =
      [];
    for (let i = 0; i < kit.rings.size; i++) {
      if (Math.round(ring[i * 4 + 3]!) !== style) continue;
      out.push({
        x: pos[i * 4]!,
        z: pos[i * 4 + 2]!,
        r: ring[i * 4]!,
        start: arc[i * 4]!,
        len: arc[i * 4 + 1]!,
        param: arc[i * 4 + 3]!,
      });
    }
    return out;
  };
  return {
    kit,
    entities,
    field,
    telegraphs,
    bars,
    feedback,
    stage,
    overlay: fake,
    tick,
    run,
    frame,
    ringsOf,
  };
}

const kael = (sim: Sim) => worldOf(sim).entities.get(sim.state.party[0]!)! as Entity;
const lyra = (sim: Sim) => worldOf(sim).entities.get(sim.state.party[1]!)! as Entity;

/** The newest living enemy of a def. */
function newest(sim: Sim, defId: string): Entity {
  const list = worldOf(sim)
    .entities.list()
    .filter((e) => e.enemy?.defId === defId && !e.health?.dead);
  return list[list.length - 1]! as Entity;
}

/** Puts a status on an entity as the sim keeps it (its payload keys only where the sim sets them). */
function giveStatus(e: Entity, status: Partial<Status> & { id: Status['id'] }): void {
  const list = e.health!.statuses as Status[];
  const i = list.findIndex((s) => s.id === status.id);
  const s: Status = { remaining: 6, duration: 6, stacks: 1, source: null, ...status };
  if (i >= 0) list[i] = s;
  else list.push(s);
}

function clearStatuses(e: Entity): void {
  (e.health!.statuses as Status[]).length = 0;
}

/** Keeps every enemy alive and still (out of reach of the party's swings for long enough). */
function tough(sim: Sim): void {
  for (const e of worldOf(sim).entities.list()) {
    if (e.enemy && e.health) e.health.hp = e.health.maxHp = 1e6;
  }
}

const M1_ARENAS = ['sandbox', 'reliquary_hall', 'nave', 'cloister', 'bell_tower', 'cantor_sanctum'];
const SPIRE_ARENAS = ['spire_gate', 'barracks', 'blood_forge', 'kennels', 'wardens_throne'];
const LEGION = [
  'sanguine_hound',
  'hemomancer',
  'impaler',
  'crimson_sentinel',
  'leech',
  'gorehound_matriarch',
  'vharun_crimson_warden',
];

/**
 * Movement I's arena moods, as `stage.setMood` was called before Movement II (snapshot), with
 * how many meshes each arena builds and a fingerprint of their geometry, uniforms and shaders.
 */
const M1_MOODS: Record<
  string,
  { mood: Record<string, string | number>; meshes: number; hash: string }
> = {
  sandbox: {
    mood: {
      sky: '#c9d6ff',
      ground: '#2a2f3a',
      hemi: 0.65,
      key: '#fff1dc',
      keyIntensity: 1.9,
      rim: '#8fb0ff',
      rimIntensity: 0.55,
      fog: '#1a1d24',
      fogNear: 46,
      fogFar: 96,
    },
    meshes: 6,
    hash: '5f6a876e',
  },
  reliquary_hall: {
    mood: {
      sky: '#ffe7c2',
      ground: '#3b3428',
      hemi: 0.6,
      key: '#ffd9a0',
      keyIntensity: 1.85,
      rim: '#f5d78e',
      rimIntensity: 0.55,
      fog: '#241f18',
      fogNear: 46,
      fogFar: 96,
    },
    meshes: 7,
    hash: 'e701b983',
  },
  nave: {
    mood: {
      sky: '#ffe7c2',
      ground: '#33302b',
      hemi: 0.6,
      key: '#ffd9a0',
      keyIntensity: 1.85,
      rim: '#fde68a',
      rimIntensity: 0.55,
      fog: '#1f1c18',
      fogNear: 46,
      fogFar: 96,
    },
    meshes: 7,
    hash: '83c50f15',
  },
  cloister: {
    mood: {
      sky: '#ffe7c2',
      ground: '#2f3529',
      hemi: 0.6,
      key: '#ffd9a0',
      keyIntensity: 1.85,
      rim: '#d9f99d',
      rimIntensity: 0.55,
      fog: '#1b2017',
      fogNear: 46,
      fogFar: 96,
    },
    meshes: 7,
    hash: 'a290b37b',
  },
  bell_tower: {
    mood: {
      sky: '#ffe7c2',
      ground: '#3a2f26',
      hemi: 0.6,
      key: '#ffd9a0',
      keyIntensity: 1.85,
      rim: '#fbbf24',
      rimIntensity: 0.55,
      fog: '#21190f',
      fogNear: 46,
      fogFar: 96,
    },
    meshes: 6,
    hash: 'a75e474',
  },
  cantor_sanctum: {
    mood: {
      sky: '#ffe7c2',
      ground: '#2b2838',
      hemi: 0.6,
      key: '#ffd9a0',
      keyIntensity: 1.85,
      rim: '#e9d5ff',
      rimIntensity: 0.55,
      fog: '#17141f',
      fogNear: 46,
      fogFar: 96,
    },
    meshes: 6,
    hash: '451813c4',
  },
};

/** Movement I's enemy models (geometry fingerprints), as built before Movement II. */
const M1_MODELS: Record<string, string> = {
  hollow_chorister: '2c17d72b',
  bell_brute: '1c518cff',
  lamenter: 'a47dbf9e',
  glass_lancer: '9a5faae3',
  mute: 'f852c54b',
  cantor_acolyte: 'e5b07abd',
  the_bellwarden: 'aafaccd7',
  the_hollow_cantor: 'd2ee4dae',
};

function fnv(h: number, s: string): number {
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

function geoHash(h: number, g: THREE.BufferGeometry): number {
  for (const name of Object.keys(g.attributes).sort()) {
    const a = g.getAttribute(name) as THREE.BufferAttribute;
    h = fnv(h, name);
    const arr = a.array as Float32Array;
    for (let i = 0; i < arr.length; i++) h = fnv(h, arr[i]!.toFixed(4));
  }
  return h;
}

/** Builds an arena headless (a canvas stand-in: no 2D context, so the floor isn't painted). */
function buildArena(id: string) {
  const g = globalThis as { document?: unknown };
  const had = g.document;
  g.document = { createElement: () => ({ width: 0, height: 0, getContext: () => null }) };
  try {
    const moods: Record<string, string | number>[] = [];
    const stage = { setMood: (m: Record<string, string | number>) => moods.push(m) } as never;
    const view = new ArenaView(arenaDef(id), stage, createModelMaterial());
    let meshes = 0;
    let h = 2166136261;
    view.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh && !(o as THREE.Points).isPoints) return;
      meshes++;
      h = geoHash(h, m.geometry);
      const mat = m.material as THREE.ShaderMaterial;
      if (mat.uniforms) {
        for (const k of Object.keys(mat.uniforms).sort()) {
          const u = mat.uniforms[k]!.value as unknown;
          h = fnv(h, k + (u instanceof THREE.Color ? u.getHexString() : JSON.stringify(u)));
        }
        h = fnv(h, mat.vertexShader + mat.fragmentShader);
      } else if ((mat as unknown as THREE.MeshStandardMaterial).color) {
        h = fnv(h, (mat as unknown as THREE.MeshStandardMaterial).color.getHexString());
      }
      h = fnv(h, `${m.position.toArray()}${m.rotation.toArray()}${m.renderOrder}`);
    });
    return { view, mood: moods[0]!, meshes, hash: h.toString(16) };
  } finally {
    g.document = had;
  }
}

afterEach(() => {
  // Nothing global to restore: each test builds its own sim and views.
});

describe('Movement I is drawn as before', () => {
  it('every Movement I arena: the same setMood arguments, meshes, geometry, uniforms and shaders', () => {
    for (const id of M1_ARENAS) {
      const a = buildArena(id);
      expect(a.mood, id).toEqual(M1_MOODS[id]!.mood);
      expect(arenaMood(arenaDef(id)), id).toEqual(M1_MOODS[id]!.mood);
      expect(a.meshes, id).toBe(M1_MOODS[id]!.meshes);
      expect(a.hash, id).toBe(M1_MOODS[id]!.hash);
      expect(a.view.look, id).toBe(id === 'sandbox' ? 'cool' : 'warm');
    }
    // Every Movement I arena in content is covered (none has a biome).
    expect(CONTENT.arenas.filter((a) => !a.biome).map((a) => a.id)).toEqual(M1_ARENAS);
  });

  it('every Movement I enemy model is built as before', () => {
    for (const [id, hash] of Object.entries(M1_MODELS)) {
      expect(geoHash(2166136261, buildEnemy(enemyDef(id))).toString(16), id).toBe(hash);
    }
  });

  it('a Movement I fight draws none of it, and gains no new state keys', () => {
    const sim = createSim({ seed: 7, encounter: 'first_light', auras: [] });
    const h = harness(sim);
    for (let i = 0; i < 60 * 12; i++) {
      h.tick();
      expect(Object.values(h.entities.drawnM2).every((v) => v === 0)).toBe(true);
      expect(Object.values(h.telegraphs.drawnM2).every((v) => v === 0)).toBe(true);
      expect(h.field.drawnM2.pools).toBe(0);
      expect(h.feedback.bloodmoon).toBe(0);
      expect(h.overlay.bars.every((b) => !('notch' in b))).toBe(true);
    }
    expect(Object.values(h.feedback.firedM2).every((v) => v === 0)).toBe(true);
    expect('sanctuary' in sim.state.field).toBe(false);
  });

  it('the overlay names the Mend glyph as the HUD does', () => {
    expect(glyphLabel('mend')).toBe('Mend');
    expect(glyphLabel('mend')).toBe(ANSWER.mend.label);
  });
});

describe('The Crimson Spire', () => {
  it('its own mood: a crimson sky, a torch key, nearer fog; crimson only above the disc', () => {
    for (const id of SPIRE_ARENAS) {
      const def = arenaDef(id);
      expect(arenaLook(def)).toBe('crimson');
      const a = buildArena(id);
      expect(a.mood).toEqual({
        sky: SPIRE_HEX.sky,
        ground: def.theme.floor,
        hemi: 0.55,
        key: SPIRE_HEX.torch,
        keyIntensity: 1.6,
        rim: SPIRE_HEX.rim,
        rimIntensity: 0.6,
        fog: def.theme.fog,
        fogNear: 38,
        fogFar: 84,
      });
      expect(a.view.look).toBe('crimson');
      // The same mesh budget as a Reliquary arena: torch cards for rays, embers for dust.
      expect(a.meshes).toBe(def.obstacles.length > 0 ? 7 : 6);
    }
  });

  it('torch cards and embers hide on low quality, as the god rays and dust do', () => {
    const a = buildArena('spire_gate');
    const extras: THREE.Object3D[] = [];
    a.view.group.traverse((o) => {
      if (o.renderOrder === 12) extras.push(o);
    });
    expect(extras).toHaveLength(2);
    a.view.update(1, 600, 'low');
    expect(extras.every((o) => !o.visible)).toBe(true);
    a.view.update(1, 600, 'high');
    expect(extras.every((o) => o.visible)).toBe(true);
  });

  it('every Legion enemy has a body of its own: none falls back to a porcelain role', () => {
    const hashes = new Set<string>();
    for (const id of LEGION) {
      const def = enemyDef(id);
      const own = geoHash(2166136261, buildEnemy(def)).toString(16);
      const role = geoHash(2166136261, buildEnemy({ ...def, id: `${id}_as_role` })).toString(16);
      expect(own, id).not.toBe(role);
      hashes.add(own);
    }
    expect(hashes.size).toBe(LEGION.length);
  });
});

describe('Legion statuses on a hero', () => {
  it('bleed: a violet pip per stack over the head; at 5+ they glow and Chime shows with the count', () => {
    const sim = sandbox();
    const h = harness(sim);
    h.run(2);
    giveStatus(kael(sim), { id: 'bleed', stacks: 3, dps: 12, tickIn: 0.5 });
    h.tick();
    expect(h.entities.drawnM2.pips).toBe(3);
    expect(h.entities.drawnM2.pipsHot).toBe(0);
    expect(h.telegraphs.drawnM2.statusBadges).toBe(0);
    giveStatus(kael(sim), { id: 'bleed', stacks: 6, dps: 12, tickIn: 0.5 });
    h.tick();
    expect(h.entities.drawnM2.pips).toBe(6);
    expect(h.entities.drawnM2.pipsHot).toBe(1);
    expect(h.telegraphs.drawnM2.statusBadges).toBe(1);
    const badge = h.overlay.badges.find((b) => b.label.startsWith('×'))!;
    expect(badge.answers).toEqual(['chime']);
    expect(badge.label).toBe('×6');
    // More than the cap draws the cap.
    giveStatus(kael(sim), { id: 'bleed', stacks: 12 });
    h.tick();
    expect(h.entities.drawnM2.pips).toBe(8);
    // The pips sit centred over the head, spreading as they grow.
    const o = { x: 0, y: 0 };
    pipOffset(0, 1, o);
    expect(o.x).toBeCloseTo(0, 6);
    pipOffset(0, 6, o);
    const left = o.x;
    pipOffset(5, 6, o);
    expect(o.x).toBeCloseTo(-left, 6);
    expect(BLEED_CHIME_AT).toBe(5);
  });

  it('over the head, bar, pips, Wound’s heart and the answer badge stack clear at 720p', () => {
    // DOM rows centred on their points: the bar row ~13 px tall, the badge 34 px.
    const BAR_HALF = 6.5;
    const BADGE_HALF = 17;
    const PIP = 0.15; // a hot pip's half size (m, view space)
    for (const wheel of [0, 2000]) {
      const camera = new THREE.PerspectiveCamera(40, 1280 / 720, 0.5, 220);
      const rig = new CameraRig(camera);
      rig.zoomBy(wheel);
      rig.snapTo(0, 0);
      camera.updateMatrixWorld();
      camera.updateProjectionMatrix();
      const top = 2; // a hero's height
      /** Screen y (px, down) of a point `lift` over the head, raised `half` metres in view space. */
      const sy = (lift: number, half = 0) => {
        const v = new THREE.Vector3(0, top + lift, 0).applyMatrix4(camera.matrixWorldInverse);
        v.y += half;
        v.applyMatrix4(camera.projectionMatrix);
        return ((1 - v.y) / 2) * 720;
      };
      const barTop = sy(BAR_LIFT) - BAR_HALF;
      const at = `zoom ${wheel}`;
      // The pips and the heart sit above the bar (the heart was behind its slot chip)...
      expect(sy(PIP_LIFT, -PIP), at).toBeLessThan(barTop);
      expect(sy(WOUND_LIFT, -WOUND_SIZE), at).toBeLessThan(barTop);
      // ...and the badge above the pips (at 1.5 m its lower half hid them).
      const badgeBottom = sy(STATUS_BADGE_LIFT) + BADGE_HALF;
      expect(badgeBottom, at).toBeLessThan(sy(PIP_LIFT, PIP));
      // Clear of the heart too at the default zoom (zoomed all the way out they may touch).
      if (wheel === 0) expect(badgeBottom, at).toBeLessThan(sy(WOUND_LIFT, WOUND_SIZE));
    }
  });

  it('wound: a cracked heart; latched: a violet tether to its Leech; pinned: a stake, a ring and Reel', () => {
    const sim = sandbox();
    const h = harness(sim);
    const k = kael(sim);
    h.run(2, [spawn('leech', k.x + 1.5, k.z - 1)]);
    tough(sim);
    const leech = newest(sim, 'leech');
    giveStatus(k, { id: 'wound', remaining: 4, duration: 4 });
    h.tick();
    expect(h.entities.drawnM2.wounds).toBe(1);
    expect(h.telegraphs.drawnM2.statusBadges).toBe(0);
    giveStatus(k, {
      id: 'latched',
      remaining: 8,
      duration: 8,
      source: leech.id,
      drain: true,
      tickIn: 0.5,
    });
    const before = h.tick().counts.beams;
    expect(h.entities.drawnM2.tethers).toBe(1);
    expect(before).toBeGreaterThanOrEqual(2);
    expect(h.overlay.badges.find((b) => b.label === 'Latched')!.answers).toEqual(['reel', 'chime']);
    giveStatus(k, { id: 'pinned', remaining: 4, duration: 4, dps: 60, tickIn: 0.5 });
    h.tick();
    expect(h.entities.drawnM2.stakes).toBe(1);
    const pin = h.overlay.badges.find((b) => b.label === 'Pinned')!;
    expect(pin.answers).toEqual(['reel']);
    expect(pin.border).toBe(CRIMSON_HEX.pin);
    // Bleed, latch and wound are ailments: the violet dripping smoke too.
    clearStatuses(k);
    h.tick();
    expect(h.entities.drawnM2.wounds + h.entities.drawnM2.tethers + h.entities.drawnM2.stakes).toBe(
      0,
    );
  });
});

describe('The Crimson Sentinel’s guard', () => {
  it('its arc faces the sim’s guard direction (not the body’s), and cracks with a flash when broken', () => {
    const sim = sandbox();
    const h = harness(sim);
    h.run(2, [spawn('crimson_sentinel', 0, -14)]);
    tough(sim);
    const s = newest(sim, 'crimson_sentinel');
    // The guard as the sim keeps it (P6): its own direction, independent of physics facing.
    s.enemy!.guard ??= { fx: 0, fz: 1, brokenUntil: 0 };
    s.enemy!.guard.fx = 1;
    s.enemy!.guard.fz = 0;
    s.enemy!.guard.brokenUntil = 0;
    h.tick();
    const g = s.enemy!.guard;
    const arcs = h.ringsOf(RING.guard);
    expect(arcs).toHaveLength(1);
    expect(h.entities.drawnM2.guardArcs).toBe(1);
    const half = ((enemyDef('crimson_sentinel').guard!.arcDeg / 2) * Math.PI) / 180;
    const want = guardArc(g, half, { start: 0, len: 0 });
    expect(arcs[0]!.start).toBeCloseTo(want.start, 5);
    expect(arcs[0]!.len).toBeCloseTo((120 * Math.PI) / 180, 5);
    // Its middle points along the sim's guard, whichever way the body faces.
    expect(Math.cos(arcs[0]!.start + arcs[0]!.len / 2)).toBeCloseTo(g.fx, 4);
    expect(Math.sin(arcs[0]!.start + arcs[0]!.len / 2)).toBeCloseTo(g.fz, 4);
    expect(arcs[0]!.param).toBe(0);
    // Broken: cracked (param 1), a flash on the frame it breaks.
    g.brokenUntil = sim.state.time + 6;
    h.tick();
    expect(h.entities.drawnM2.guardBroken).toBe(1);
    expect(h.ringsOf(RING.guard)[0]!.param).toBe(1);
    expect(h.entities.recs.get(s.id)!.guardFlash).toBeGreaterThan(0.9);
  });

  it('a blocked hit throws back a grey “Blocked” (rate-limited); a broken guard shatters', () => {
    const sim = sandbox();
    const h = harness(sim);
    h.run(2, [spawn('crimson_sentinel', 0, -14)]);
    const s = newest(sim, 'crimson_sentinel');
    const blocked: SimEvent = {
      type: 'guardBlocked',
      tick: sim.tick,
      enemy: s.id,
      source: sim.state.party[0]!,
    };
    h.frame([blocked]);
    h.frame([{ ...blocked }]);
    expect(h.feedback.firedM2.blocked).toBe(1);
    expect(h.overlay.callouts.filter((c) => c === 'Blocked')).toHaveLength(1);
    h.frame([{ type: 'guardBroken', tick: sim.tick, enemy: s.id }]);
    expect(h.feedback.firedM2.guardBroken).toBe(1);
    expect(h.overlay.callouts).toContain('GUARD BROKEN');
  });
});

describe('Bloodmoon: the Sanctuary pools', () => {
  it('draws each pool; a lab override shows them without the boss; the sky lerps crimson', () => {
    const sim = sandbox();
    const h = harness(sim);
    h.run(2);
    expect(h.field.drawnM2.pools).toBe(0);
    const w = worldOf(sim);
    w.field.sanctuary = {
      pools: [
        { x: -6, z: 0, r: 3.6, vx: 0.9, vz: 0 },
        { x: 6, z: 0, r: 3.6, vx: -0.9, vz: 0 },
      ],
      healMult: 0.5,
      reformAt: sim.state.time + 30,
    };
    const hemi = (h.stage as unknown as { lights: { hemi: THREE.HemisphereLight } }).lights.hemi;
    const base = hemi.color.clone();
    h.run(120);
    expect(h.field.drawnM2.pools).toBe(2);
    expect(h.feedback.bloodmoon).toBeGreaterThan(0.8);
    // The hemisphere light has moved toward the Bloodmoon's crimson.
    const blood = new THREE.Color(SPIRE_HEX.bloodmoon);
    const dist = (c: THREE.Color) => Math.hypot(c.r - blood.r, c.g - blood.g, c.b - blood.b);
    expect(dist(hemi.color)).toBeLessThan(dist(base));
    h.field.sanctuaryOverride = [
      { x: 0, z: 0, r: 3 },
      { x: 4, z: 4, r: 3 },
      { x: -4, z: 4, r: 3 },
    ];
    h.tick();
    expect(h.field.drawnM2.pools).toBe(3);
    h.field.sanctuaryOverride = null;
    // It ends: the pools go and the light comes back.
    delete w.field.sanctuary;
    h.run(400);
    expect(h.field.drawnM2.pools).toBe(0);
    expect(h.feedback.bloodmoon).toBe(0);
    expect(dist(hemi.color)).toBeCloseTo(dist(base), 4);
  });

  it('a heal outside every pool shows smaller and dimmer than one inside', () => {
    const sim = sandbox();
    const h = harness(sim);
    h.run(2);
    const k = kael(sim);
    const w = worldOf(sim);
    w.field.sanctuary = {
      pools: [{ x: k.x, z: k.z, r: 3.6, vx: 0, vz: 0 }],
      healMult: 0.5,
      reformAt: 99,
    };
    h.tick();
    expect(inSanctuary(w.field.sanctuary.pools, k.x, k.z)).toBe(true);
    const heal = (target: number): SimEvent => ({
      type: 'healApplied',
      tick: sim.tick,
      target,
      source: sim.state.weaverId,
      amount: 120,
      overheal: 0,
      via: 'mend',
    });
    h.frame([heal(k.id)]);
    const inside = h.overlay.numbers.at(-1)!;
    w.field.sanctuary.pools[0]!.x += 30;
    h.run(30);
    h.frame([heal(k.id)]);
    const outside = h.overlay.numbers.at(-1)!;
    expect(h.feedback.firedM2.cutHeals).toBe(1);
    expect(outside.size).toBeLessThan(inside.size);
    const lum = (hex: string) => new THREE.Color(hex).getHSL({ h: 0, s: 0, l: 0 }).l;
    expect(lum(outside.color)).toBeLessThan(lum(inside.color));
  });
});

describe('Cut heals render as the sim cuts them (healReceivedMult)', () => {
  const healEv = (sim: Sim, target: number, via: string, amount = 120): SimEvent =>
    ({
      type: 'healApplied',
      tick: sim.tick,
      target,
      source: sim.state.weaverId,
      amount,
      overheal: 0,
      via,
    }) as SimEvent;
  const lum = (hex: string) => new THREE.Color(hex).getHSL({ h: 0, s: 0, l: 0 }).l;

  /** A sandbox with Kael outside the one Sanctuary pool (the Bloodmoon up). */
  function outsidePool() {
    const sim = sandbox();
    const h = harness(sim);
    h.run(2);
    const w = worldOf(sim);
    const k = kael(sim);
    w.field.sanctuary = {
      pools: [{ x: k.x + 30, z: k.z, r: 3.6, vx: 0, vz: 0 }],
      healMult: 0.5,
      reformAt: 99,
    };
    h.tick();
    return { sim, h, w, k };
  }

  it('a revive outside every pool is not cut: full size and colour, no cut counted', () => {
    const { sim, h, w, k } = outsidePool();
    expect(healReceivedMult(w, k)).toBe(0.5);
    h.frame([healEv(sim, k.id, 'revive')]);
    const revive = h.overlay.numbers.at(-1)!;
    expect(h.feedback.firedM2.cutHeals).toBe(0);
    h.run(40);
    h.frame([healEv(sim, k.id, 'mend')]);
    const mend = h.overlay.numbers.at(-1)!;
    expect(h.feedback.firedM2.cutHeals).toBe(1);
    expect(mend.size).toBeLessThan(revive.size);
    expect(lum(mend.color)).toBeLessThan(lum(revive.color));
  });

  it('an aura heal outside every pool shows smaller and dimmer than one inside', () => {
    const { sim, h, w, k } = outsidePool();
    h.frame([healEv(sim, k.id, 'aura', 30)]);
    const outside = h.overlay.numbers.at(-1)!;
    expect(h.feedback.firedM2.cutHeals).toBe(1);
    w.field.sanctuary!.pools[0]!.x = k.x;
    h.run(40);
    h.frame([healEv(sim, k.id, 'aura', 30)]);
    const inside = h.overlay.numbers.at(-1)!;
    expect(h.feedback.firedM2.cutHeals).toBe(1);
    expect(outside.size).toBeLessThan(inside.size);
    expect(lum(outside.color)).toBeLessThan(lum(inside.color));
  });

  it('a Wound cuts Mend and aura heals inside a pool, and the Weaver’s own heals', () => {
    const sim = sandbox();
    const h = harness(sim);
    h.run(2);
    const k = kael(sim);
    const wv = worldOf(sim).entities.get(sim.state.weaverId)! as Entity;
    h.frame([healEv(sim, k.id, 'mend')]);
    const plain = h.overlay.numbers.at(-1)!;
    h.frame([healEv(sim, wv.id, 'self', 30)]);
    const plainSelf = h.overlay.numbers.at(-1)!;
    expect(h.feedback.firedM2.cutHeals).toBe(0);
    giveStatus(k, { id: 'wound', remaining: 30, duration: 30 });
    giveStatus(wv, { id: 'wound', remaining: 30, duration: 30 });
    h.run(40);
    h.frame([healEv(sim, k.id, 'mend')]);
    const wounded = h.overlay.numbers.at(-1)!;
    expect(wounded.size).toBeLessThan(plain.size);
    expect(lum(wounded.color)).toBeLessThan(lum(plain.color));
    h.frame([healEv(sim, k.id, 'aura', 30)]);
    h.frame([healEv(sim, wv.id, 'self', 30)]);
    const woundedSelf = h.overlay.numbers.at(-1)!;
    expect(woundedSelf.size).toBeLessThan(plainSelf.size);
    expect(lum(woundedSelf.color)).toBeLessThan(lum(plainSelf.color));
    expect(h.feedback.firedM2.cutHeals).toBe(3);
  });

  it('the Weaver’s heals under the Bloodmoon render cut exactly when the sim cuts them', () => {
    const { sim, h, w } = outsidePool();
    const wv = w.entities.get(sim.state.weaverId)! as Entity;
    w.field.sanctuary!.pools[0]!.x = wv.x + 30;
    h.frame([healEv(sim, wv.id, 'self', 30)]);
    expect(h.feedback.firedM2.cutHeals).toBe(healReceivedMult(w, wv) < 1 ? 1 : 0);
  });
});

describe('Legion telegraphs', () => {
  it('the Crimson Tide: two half-arena cones (front, then back), badged near Vharun', () => {
    const sim = sandbox();
    const h = harness(sim);
    const k = kael(sim);
    h.run(2, [spawn('vharun_crimson_warden', k.x, k.z - 6)]);
    tough(sim);
    const v = newest(sim, 'vharun_crimson_warden');
    const w = worldOf(sim);
    expect(beginAttack(w, v, attackDef('vharun_crimson_tide'), k)).toBe(true);
    h.tick();
    expect(h.telegraphs.drawnM2.tides).toBe(1);
    const tide = sim.state.telegraphs.find((t) => t.attackId === 'vharun_crimson_tide')!;
    expect(tide.shape.kind).toBe('cone');
    // Its badge sits near the caster, not 30 m out at its far edge.
    const badge = h.overlay.badges.find((b) => Math.hypot(b.x - v.x, b.z - v.z) < 7);
    expect(badge).toBeDefined();
    expect(beginAttack(w, v, attackDef('vharun_crimson_tide_back'), k)).toBe(true);
    h.tick();
    expect(h.telegraphs.drawnM2.tides).toBe(2);
  });

  it('a Blood Pact: the link in its own tint with “+20%”; a Bellwarden’s Resound is unchanged', () => {
    const sim = sandbox();
    const h = harness(sim);
    const k = kael(sim);
    h.run(2, [spawn('hemomancer', k.x + 3, k.z - 8)]);
    tough(sim);
    const hemo = newest(sim, 'hemomancer');
    expect(beginAttack(worldOf(sim), hemo, attackDef('hemomancer_blood_pact'), k)).toBe(true);
    h.tick();
    const t = sim.state.telegraphs.find((x) => x.attackId === 'hemomancer_blood_pact')!;
    expect(isPact(t)).toBe(true);
    expect(h.telegraphs.drawnM2.pacts).toBe(1);
    expect(h.overlay.badges.some((b) => b.label.startsWith('+20% · '))).toBe(true);

    const m1 = sandbox();
    const h1 = harness(m1);
    h1.run(2, [spawn('the_bellwarden', kael(m1).x, kael(m1).z - 8)]);
    tough(m1);
    const bell = newest(m1, 'the_bellwarden');
    const resound = CONTENT.attacks.find((a) => a.kind === 'link' && !a.linkStatus)!;
    expect(beginAttack(worldOf(m1), bell, resound, kael(m1))).toBe(true);
    h1.tick();
    expect(h1.telegraphs.drawnM2.pacts).toBe(0);
    expect(h1.overlay.badges.some((b) => b.label.includes('%'))).toBe(false);
  });

  it('Execution: the mark shows its threshold and the marked hero’s bar a 40% notch', () => {
    const sim = sandbox();
    const h = harness(sim);
    const k = kael(sim);
    h.run(2, [spawn('vharun_crimson_warden', k.x, k.z - 8)]);
    tough(sim);
    const v = newest(sim, 'vharun_crimson_warden');
    const l = lyra(sim);
    l.health!.hp = l.health!.maxHp * 0.3;
    // `lowestHp` targeting is the sim's (P7): until it picks, any hero-picking mark will do.
    const exec = attackDef('vharun_execution');
    const begun =
      beginAttack(worldOf(sim), v, exec, k) ||
      beginAttack(worldOf(sim), v, { ...exec, targeting: 'squishiest' }, k);
    expect(begun).toBe(true);
    h.tick();
    const t = sim.state.telegraphs.find((x) => x.attackId === 'vharun_execution')!;
    expect(t.shape.kind).toBe('mark');
    const target = t.shape.kind === 'mark' ? t.shape.target : -1;
    expect(h.telegraphs.drawnM2.executions).toBe(1);
    expect(h.overlay.badges.some((b) => b.label.startsWith('<40% · '))).toBe(true);
    const marked = h.bars.drawn.find((b) => b.id === target)!;
    expect(marked.notch).toBeCloseTo(0.4, 6);
    for (const b of h.bars.drawn) if (b.id !== target) expect('notch' in b).toBe(false);
  });
});

describe('Legion bodies in motion', () => {
  it('hounds run with a dog’s gait; the Matriarch crouches before a Pounce, then leaps there', () => {
    const sim = sandbox();
    const h = harness(sim);
    const k = kael(sim);
    h.run(2, [spawn('sanguine_hound', k.x + 10, k.z - 10)]);
    h.run(20);
    expect(h.entities.drawnM2.quadrupeds).toBeGreaterThanOrEqual(1);

    h.tick([spawn('gorehound_matriarch', k.x, k.z - 12)]);
    h.tick();
    tough(sim);
    const m = newest(sim, 'gorehound_matriarch');
    expect(beginAttack(worldOf(sim), m, attackDef('gorehound_pounce'), k)).toBe(true);
    h.run(20);
    expect(h.entities.drawnM2.crouch).toBe(1);

    // It lands: the sim snaps it to the target's circle (P7) and says so with 'leap'.
    const fromX = m.x;
    const fromZ = m.z;
    const toX = k.x + 1;
    const toZ = k.z - 1.5;
    m.x = m.px = toX;
    m.z = m.pz = toZ;
    h.frame([
      {
        type: 'attackFired',
        tick: sim.tick,
        source: m.id,
        target: k.id,
        visual: 'leap',
        fromX,
        fromZ,
        toX,
        toZ,
        travel: 0,
      },
    ]);
    expect(h.feedback.firedM2.leaps).toBe(1);
    expect(h.entities.drawnM2.leaps).toBe(1);
    const rec = h.entities.recs.get(m.id)!;
    // Mid-arc: in the air, part of the way there.
    for (let i = 0; i < Math.round((LEAP_SECONDS * 60) / 2) - 1; i++) h.frame([]);
    expect(h.entities.drawnM2.leaps).toBe(1);
    expect(rec.y).toBeGreaterThan(1.5);
    expect(Math.hypot(rec.x - toX, rec.z - toZ)).toBeGreaterThan(0.5);
    expect(Math.hypot(rec.x - fromX, rec.z - fromZ)).toBeGreaterThan(0.5);
    // Landed where the sim put it.
    for (let i = 0; i < Math.round(LEAP_SECONDS * 60) + 2; i++) h.frame([]);
    expect(h.entities.drawnM2.leaps).toBe(0);
    expect(rec.x).toBeCloseTo(m.x, 5);
    expect(rec.z).toBeCloseTo(m.z, 5);
  });

  it('the Impaler leans in as it winds up, then rushes the line with a streak', () => {
    const sim = sandbox();
    const h = harness(sim);
    const k = kael(sim);
    h.run(2, [spawn('impaler', k.x, k.z - 9)]);
    tough(sim);
    const imp = newest(sim, 'impaler');
    expect(beginAttack(worldOf(sim), imp, attackDef('impaler_charge'), k)).toBe(true);
    h.run(10);
    expect(h.entities.drawnM2.lean).toBe(1);
    const beams = h.kit.beams.size;
    h.frame([
      {
        type: 'attackFired',
        tick: sim.tick,
        source: imp.id,
        target: k.id,
        visual: 'charge',
        fromX: imp.x,
        fromZ: imp.z,
        toX: k.x,
        toZ: k.z + 4,
        travel: 0,
      },
    ]);
    expect(h.feedback.firedM2.charges).toBe(1);
    expect(h.entities.drawnM2.charges).toBe(1);
    expect(h.kit.beams.size).toBeGreaterThanOrEqual(beams);
  });

  it('a real charge: the sim moves the caster before attackFired; render rushes it from where it stood', () => {
    const sim = sandbox();
    const h = harness(sim);
    const k = kael(sim);
    h.run(2, [spawn('impaler', k.x, k.z - 9)]);
    tough(sim);
    const imp = newest(sim, 'impaler');
    const rec = h.entities.recs.get(imp.id)!;
    expect(beginAttack(worldOf(sim), imp, attackDef('impaler_charge'), k)).toBe(true);
    // Step the real sim until the charge lands (completeCast: move, then 'charge').
    let fired: SimEventOf<'attackFired'> | undefined;
    let drawnBefore = { x: 0, z: 0 };
    for (let i = 0; i < 240 && !fired; i++) {
      drawnBefore = { x: rec.x, z: rec.z };
      const { events } = h.tick();
      fired = ofType(events, 'attackFired').find((e) => e.visual === 'charge');
    }
    expect(fired).toBeDefined();
    // The order the render assumes: by the event, the sim has the caster at its destination
    // (the tick's overlap pass may nudge it), and `from` is where it stood.
    expect(Math.hypot(imp.x - fired!.toX, imp.z - fired!.toZ)).toBeLessThan(0.5);
    expect(Math.hypot(fired!.fromX - drawnBefore.x, fired!.fromZ - drawnBefore.z)).toBeLessThan(
      0.5,
    );
    expect(Math.hypot(fired!.toX - fired!.fromX, fired!.toZ - fired!.fromZ)).toBeGreaterThan(3);
    expect(h.feedback.firedM2.charges).toBe(1);
    // Drawn on the event's frame near where it stood, not snapped to the end...
    expect(Math.hypot(rec.x - fired!.fromX, rec.z - fired!.fromZ)).toBeLessThan(
      Math.hypot(rec.x - fired!.toX, rec.z - fired!.toZ),
    );
    // ...and where the sim put it once the rush is drawn.
    for (let i = 0; i < Math.round(CHARGE_SECONDS * 60) + 2; i++) h.frame([]);
    expect(Math.hypot(rec.x - imp.x, rec.z - imp.z)).toBeLessThan(1e-6);
  });

  it('an iron body dies in iron (shards, embers, smoke); porcelain stays porcelain', () => {
    const sim = sandbox();
    const h = harness(sim);
    const k = kael(sim);
    h.run(2, [
      spawn('sanguine_hound', k.x + 6, k.z - 12),
      spawn('hollow_chorister', k.x - 6, k.z - 12),
    ]);
    const strike = (e: Entity) =>
      dealDamage(worldOf(sim), e, {
        source: worldOf(sim).party[0]!,
        sourceName: 'test',
        amount: e.health!.hp + 1,
        telegraph: null,
      });
    strike(newest(sim, 'sanguine_hound'));
    const ev = h.run(1);
    expect(ofType(ev, 'enemyKilled')).toHaveLength(1);
    expect(h.feedback.firedM2.ironDeaths).toBe(1);
    strike(newest(sim, 'hollow_chorister'));
    h.run(1);
    expect(h.feedback.firedM2.ironDeaths).toBe(1);
  });
});

describe('The budget', () => {
  it('no FX batch growth: the kit keeps its batches through a busy Legion scene', () => {
    const sim = sandbox();
    const h = harness(sim);
    const batches = h.kit.group.children.length;
    expect(batches).toBe(12);
    const k = kael(sim);
    h.run(2, [
      spawn('crimson_sentinel', k.x + 6, k.z - 10),
      spawn('vharun_crimson_warden', k.x, k.z - 9),
      spawn('leech', k.x + 1.5, k.z - 1),
      spawn('hemomancer', k.x - 5, k.z - 9),
    ]);
    h.run(2, [
      spawn('sanguine_hound', k.x - 3, k.z - 3),
      spawn('gorehound_matriarch', k.x + 4, k.z - 14),
    ]);
    tough(sim);
    const w = worldOf(sim);
    const s = newest(sim, 'crimson_sentinel');
    s.enemy!.guard ??= { fx: 0, fz: 1, brokenUntil: 0 };
    giveStatus(k, { id: 'bleed', stacks: 7 });
    giveStatus(lyra(sim), { id: 'latched', source: newest(sim, 'leech').id, drain: true });
    giveStatus(lyra(sim), { id: 'wound' });
    giveStatus(k, { id: 'pinned', dps: 60 });
    w.field.sanctuary = {
      pools: [
        { x: -6, z: 0, r: 3.6, vx: 0, vz: 0 },
        { x: 6, z: 0, r: 3.6, vx: 0, vz: 0 },
      ],
      healMult: 0.5,
      reformAt: 99,
    };
    const v = newest(sim, 'vharun_crimson_warden');
    beginAttack(w, v, attackDef('vharun_crimson_tide'), k);
    beginAttack(w, newest(sim, 'hemomancer'), attackDef('hemomancer_blood_pact'), k);
    let peak = { rings: 0, sprites: 0, beams: 0 };
    for (let i = 0; i < 60; i++) {
      const c = h.tick().counts;
      peak = {
        rings: Math.max(peak.rings, c.rings),
        sprites: Math.max(peak.sprites, c.sprites),
        beams: Math.max(peak.beams, c.beams),
      };
    }
    expect(h.entities.drawnM2.pips).toBe(7);
    expect(h.entities.drawnM2.tethers).toBe(1);
    expect(h.entities.drawnM2.guardArcs).toBe(1);
    expect(h.field.drawnM2.pools).toBe(2);
    expect(h.kit.group.children.length).toBe(batches);
    // Well inside each batch's capacity (nothing dropped).
    expect(peak.rings).toBeLessThan(384);
    expect(peak.sprites).toBeLessThan(256);
    expect(peak.beams).toBeLessThan(160);
    // One model batch per Legion def on screen, as for any enemy.
    const keys = new Set(
      worldOf(sim)
        .entities.list()
        .filter((e) => e.enemy)
        .map((e) => e.enemy!.defId),
    );
    expect(h.entities.group.children.length).toBeLessThanOrEqual(keys.size + 8);
  });
});

describe('Colour', () => {
  it('every new semantic colour is ΔE ≥ 20 from lethal, threat, Bear, Mend and Empower in every palette', () => {
    for (const vision of COLOR_VISIONS) {
      const p = visionPalette(vision);
      const see = (hex: string) => simulateVision(hex, vision);
      const against = {
        lethal: p.lethal,
        threat: p.threat,
        bear: MARTYR_HEX.blood,
        mend: p.mend,
        empower: p.empower,
      };
      for (const [name, hex] of Object.entries(CRIMSON_HEX)) {
        for (const [other, o] of Object.entries(against)) {
          expect(
            deltaE(see(hex), see(o)),
            `${vision}: ${name} ${hex} vs ${other} ${o}`,
          ).toBeGreaterThanOrEqual(20);
        }
      }
    }
  });
});
