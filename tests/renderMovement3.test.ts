/**
 * Phase 5c W6: Movement III, the Unstitched (docs/phase-5c.md, Presentation;
 * docs/phase-5c/vfx-audio.md). Every check drives a real headless sim and feeds its state and
 * events to the real EntityLayer, FieldView, TelegraphLayer, ThreadView, PartyBarsView and
 * Feedback over a real FxKit, then reads what they drew. Where a Movement III mechanic is the
 * sim's to produce (W1, W2, W3: a cut, a zone, possession, Doom, a stitch, a mirror, Steal Verse,
 * Unravel), the test stages that state or event on the real world the way the contract
 * (docs/phase-5c.md) says the sim keeps it, so the render side is checked on its own.
 */
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { COLOR_VISIONS, deltaE, simulateVision, visionPalette } from '../src/app/colorVision';
import { CONTENT, arenaDef, enemyDef } from '../src/content';
import type { Command, Entity, Sim, SimEvent, Status, WorldState } from '../src/sim';
import { createSim, suppressRadiusOf } from '../src/sim';
import { addShield, dealDamage } from '../src/sim/combat/health';
import { ArenaView } from '../src/render/arena';
import { LIT_MOOD } from '../src/render/lightCues';
import { CallView } from '../src/render/calls';
import type { CameraRig } from '../src/render/camera';
import { arenaLook, arenaMood, materialOf } from '../src/render/crimsonCues';
import { EntityLayer } from '../src/render/entities';
import { FermataView } from '../src/render/fermata';
import { Feedback } from '../src/render/feedback';
import { FieldView } from '../src/render/field';
import { FxKit, PARTICLE_CAPS } from '../src/render/fx/kit';
import { buildEnemy } from '../src/render/models/library';
import { createModelMaterial } from '../src/render/models/material';
import type { Overlay } from '../src/render/overlay';
import { VISION_HEX, applyVision } from '../src/render/palette';
import { PartyBarsView } from '../src/render/partyBars';
import { MARTYR_HEX } from '../src/render/martyrCues';
import {
  ABYSS_HEX,
  DOOM_AT,
  DOOM_CHIME_AT,
  RIFT_HEX,
  crossing,
  cutLabel,
  doomIgnitionAt,
  emptyRiftLook,
  hovers,
  riftAnswers,
  riftStatuses,
  stitchedPairs,
} from '../src/render/riftCues';
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

/** An overlay that records what it is asked to show (and ignores the rest). */
class FakeOverlay {
  width = 1280;
  height = 720;
  badges: { answers: string[]; border: string; label: string }[] = [];
  callouts: { text: string; color: string }[] = [];
  numbers: { color: string; size: number }[] = [];
  beginFrame(): void {
    this.badges.length = 0;
  }
  badge(
    _x: number,
    _y: number,
    _z: number,
    answers: readonly string[],
    _key: string,
    border: string,
    label: string,
  ): void {
    this.badges.push({ answers: [...answers], border, label });
  }
  allyBar(): void {}
  raid(): void {}
  callout(_x: number, _y: number, _z: number, text: string, color: string): void {
    this.callouts.push({ text, color });
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
  const fake = new FakeOverlay();
  const overlay = fake as unknown as Overlay;
  const thread = new ThreadView(entities, overlay);
  const bars = new PartyBarsView(entities);
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
    const counts = {
      rings: kit.rings.size,
      sprites: kit.sprites.size,
      spritesTop: kit.spritesTop.size,
      beams: kit.beams.size,
      shells: kit.shells.size,
      telegraphs: kit.telegraphs.size,
      marks: kit.marks.size,
    };
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
  /** Feeds synthetic events (the contract's) to the views, with one frame. */
  const inject = (ev: SimEvent[]) => frame(ev);
  return { kit, entities, field, telegraphs, thread, feedback, overlay: fake, tick, run, inject };
}

const hero = (sim: Sim, slot: number) =>
  worldOf(sim).entities.get(sim.state.party[slot]!)! as Entity;

/** The newest living enemy of a def. */
function newest(sim: Sim, defId: string): Entity {
  const list = worldOf(sim)
    .entities.list()
    .filter((e) => e.enemy?.defId === defId && !e.health?.dead);
  return list[list.length - 1]! as Entity;
}

/** Puts a status on an entity as the sim keeps it. */
function giveStatus(e: Entity, status: Partial<Status> & { id: Status['id'] }): void {
  const list = e.health!.statuses as Status[];
  const i = list.findIndex((s) => s.id === status.id);
  const s: Status = { remaining: 6, duration: 6, stacks: 1, source: null, ...status };
  if (i >= 0) list[i] = s;
  else list.push(s);
}

/** Keeps every enemy alive (out of reach of the party's swings for long enough). */
function tough(sim: Sim): void {
  for (const e of worldOf(sim).entities.list())
    if (e.enemy && e.health) e.health.hp = e.health.maxHp = 1e6;
}

/** Every counter in a record is zero. */
const allZero = (o: Record<string, number>) => Object.values(o).every((v) => v === 0);

function fnv(h: number, s: string): number {
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

function geoHash(g: THREE.BufferGeometry): string {
  let h = 2166136261;
  for (const name of Object.keys(g.attributes).sort()) {
    const a = g.getAttribute(name) as THREE.BufferAttribute;
    h = fnv(h, name);
    const arr = a.array as Float32Array;
    for (let i = 0; i < arr.length; i++) h = fnv(h, arr[i]!.toFixed(4));
  }
  return h.toString(16);
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
    view.group.traverse((o) => {
      if ((o as THREE.Mesh).isMesh || (o as THREE.Points).isPoints) meshes++;
    });
    return { view, mood: moods[0]!, meshes };
  } finally {
    g.document = had;
  }
}

/** CIE L* of a hex colour (0 black … 100 white). */
function lightness(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const y = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  return y > 216 / 24389 ? 116 * Math.cbrt(y) - 16 : (24389 / 27) * y;
}

const RIFT_ARENAS = CONTENT.arenas.filter((a) => a.biome === 'abyssal_rift').map((a) => a.id);
const UNSTITCHED = CONTENT.enemies.filter((e) => e.movement === 3).map((e) => e.id);
/** A beam song and a field song (so there is an aura to steal). */
const SONGS = [{ auras: [CONTENT.auras[0]!.id] }, { auras: [CONTENT.auras[1]!.id] }];
const M1_ENCOUNTER = 'first_light';
const M2_ENCOUNTER = 'crimson_gate';

describe('Movements I and II draw as before, and none of Movement III', () => {
  it('the look and mood tables keep every Reliquary row and the Spire its lit row (renderSpireSnapshot pins them)', () => {
    for (const a of CONTENT.arenas) {
      if (a.biome === 'abyssal_rift') continue;
      // The Finale's Crucible has its own look (tests/renderFinale.test.ts pins it).
      if (a.biome === 'celestial_crucible') {
        expect(arenaLook(a), a.id).toBe('crucible');
        continue;
      }
      const look = arenaLook(a);
      expect(look, a.id).not.toBe('abyss');
      expect(look, a.id).toBe(
        a.biome === 'crimson_spire' ? 'crimson' : a.id === 'sandbox' ? 'cool' : 'warm',
      );
    }
    // A sample row of each, by value (the W0a snapshot holds them all).
    expect(arenaMood(arenaDef('nave')).rim).toBe(arenaDef('nave').theme.accent);
    expect(arenaMood(arenaDef('spire_gate'))).toEqual({ ...LIT_MOOD.crimson });
  });

  for (const encounter of [M1_ENCOUNTER, M2_ENCOUNTER]) {
    it(`a ${encounter} fight draws no Movement III cue and plays none`, () => {
      const sim = createSim({ seed: 11, encounter, auras: [] });
      const h = harness(sim);
      for (let i = 0; i < 60 * 12; i++) {
        h.tick(i === 30 ? [{ t: 'thread', slot: 0 }] : []);
        expect(allZero(h.entities.drawnM3), `${encounter} entities ${i}`).toBe(true);
        expect(allZero(h.telegraphs.drawnM3), `${encounter} telegraphs ${i}`).toBe(true);
        expect(allZero(h.field.drawnM3), `${encounter} field ${i}`).toBe(true);
        expect(allZero(h.thread.drawnM3), `${encounter} thread ${i}`).toBe(true);
      }
      expect(allZero(h.feedback.firedM3), encounter).toBe(true);
      const f = sim.state.field;
      expect('zones' in f || 'unravel' in f || 'stolen' in f).toBe(false);
    });
  }
});

describe('The Abyssal Rift', () => {
  /**
   * Phase 8a (docs/phase-8.md): the Rift lit indigo. The moon key and the cold rim are the shipped
   * ones (the rim ≤ 0.45, so a hero's edge never reads Mended); the sky and fog are indigo, so the
   * camera sees the void, not black.
   */
  it('every Rift arena wears the abyss: its lit indigo mood, its pieces swapped one for one (7 / 6 meshes)', () => {
    expect(RIFT_ARENAS.length).toBe(5);
    for (const id of RIFT_ARENAS) {
      const def = arenaDef(id);
      expect(arenaLook(def)).toBe('abyss');
      const a = buildArena(id);
      expect(a.view.look).toBe('abyss');
      expect(a.mood).toEqual({ ...LIT_MOOD.abyss });
      expect(a.mood.key).toBe(ABYSS_HEX.moon);
      expect(a.mood.rim).toBe(ABYSS_HEX.rim);
      for (const hex of [a.mood.sky, a.mood.fog] as string[]) {
        const c = new THREE.Color(hex);
        // Indigo: blue first, red over green.
        expect(c.b, hex).toBeGreaterThan(c.r);
        expect(c.r, hex).toBeGreaterThan(c.g);
      }
      expect(a.mood.rimIntensity as number).toBeLessThanOrEqual(0.45);
      expect(a.meshes, id).toBe(def.obstacles.length > 0 ? 7 : 6);
    }
  });

  it('the rift tears and frays hide on low quality, as the god rays and dust do', () => {
    const a = buildArena('rift_mouth');
    const extras: THREE.Object3D[] = [];
    a.view.group.traverse((o) => {
      if (o.renderOrder === 12) extras.push(o);
    });
    expect(extras).toHaveLength(2);
    a.view.update(1, 600, 'low');
    expect(extras.every((o) => !o.visible)).toBe(true);
    a.view.update(1, 600, 'medium');
    expect(extras.every((o) => o.visible)).toBe(true);
  });

  it('the floor sits far below the ailment, lethal and threat telegraphs in lightness, in every vision', () => {
    // An indigo floor pulls violet ailment telegraphs close in hue; they must keep lightness.
    // Measured against the Spire's floors (the Movement II floor that already reads well).
    const floorL = (id: string) => {
      const c = new THREE.Color(arenaDef(id).theme.floor).multiplyScalar(0.78);
      return lightness(`#${c.getHexString()}`);
    };
    const spire = Math.max(
      ...CONTENT.arenas.filter((a) => a.biome === 'crimson_spire').map((a) => floorL(a.id)),
    );
    // The violet ailment (Doom, Doubt, the stitch, a mark's ring) is the one nearest the indigo
    // floor in hue, so it must clear it by the most; lethal and threat keep the Spire's margin.
    const MIN = { ailment: 40, lethal: 25, threat: 25 } as const;
    for (const id of RIFT_ARENAS) {
      const L = floorL(id);
      expect(L, id).toBeLessThanOrEqual(spire + 1);
      for (const vision of COLOR_VISIONS) {
        const p = visionPalette(vision);
        for (const role of ['ailment', 'lethal', 'threat'] as const) {
          const t = lightness(simulateVision(p[role], vision));
          expect(t - L, `${id} ${vision} ${role}`).toBeGreaterThanOrEqual(MIN[role]);
          expect(t - L, `${id} ${vision} ${role} vs the Spire`).toBeGreaterThanOrEqual(
            t - spire - 1,
          );
        }
      }
    }
  });
});

describe('The Unstitched bodies', () => {
  it('every Movement III enemy has a body of its own, none a role fallback, all distinct', () => {
    expect(UNSTITCHED.length).toBe(10);
    const hashes = new Set<string>();
    for (const id of UNSTITCHED) {
      const def = enemyDef(id);
      const own = geoHash(buildEnemy(def));
      const role = geoHash(buildEnemy({ ...def, id: `${id}_as_role` }));
      expect(own, id).not.toBe(role);
      hashes.add(own);
      expect(materialOf(def), id).toBe('cloth');
    }
    expect(hashes.size).toBe(UNSTITCHED.length);
    expect(hovers('doubt_wraith')).toBe(true);
    expect(hovers('shears')).toBe(false);
  });

  it('cloth dies as cloth: strands, fray motes, indigo smoke; porcelain stays porcelain', () => {
    const sim = sandbox();
    const h = harness(sim);
    h.run(2, [spawn('shears', 6, -12), spawn('hollow_chorister', -6, -12)]);
    const strike = (e: Entity) =>
      dealDamage(worldOf(sim), e, {
        source: sim.state.party[0]!,
        sourceName: 'test',
        amount: e.health!.hp + 1,
        telegraph: null,
      });
    strike(newest(sim, 'shears'));
    h.run(1);
    expect(h.feedback.firedM3.clothDeaths).toBe(1);
    strike(newest(sim, 'hollow_chorister'));
    h.run(1);
    expect(h.feedback.firedM3.clothDeaths).toBe(1);
    expect(h.feedback.firedM2.ironDeaths).toBe(0);
  });
});

describe('Possession, Doom and the Stitch on a hero', () => {
  it('possessed: an indigo rim above threaded, a mask, a tether to its Wraith, a lash, Chime and Focus', () => {
    const sim = sandbox();
    const h = harness(sim);
    h.run(2, [spawn('doubt_wraith', 4, -11), { t: 'thread', slot: 1 }]);
    tough(sim);
    const wraith = newest(sim, 'doubt_wraith');
    giveStatus(hero(sim, 1), {
      id: 'possessed',
      remaining: 5,
      duration: 5,
      source: wraith.id,
      tickIn: 0.5,
    });
    h.tick();
    const d = h.entities.drawnM3;
    expect(d.possessRims).toBe(1);
    expect(d.masks).toBe(1);
    expect(d.possessTethers).toBe(1);
    expect(d.streaks).toBe(1);
    const badge = h.overlay.badges.find((b) => b.label === 'Possessed')!;
    expect(badge.answers).toEqual(['chime', 'focus']);
    expect(badge.border).toBe(RIFT_HEX.possess);
    h.inject([{ type: 'possessed', tick: sim.tick, hero: hero(sim, 1).id, source: wraith.id }]);
    expect(h.feedback.firedM3.possessed).toBe(1);
    expect(h.overlay.callouts.some((c) => c.text === 'POSSESSED')).toBe(true);
  });

  it('Doom: five pips filling, lethal and badged (Chime, Ward) from four', () => {
    const sim = sandbox();
    const h = harness(sim);
    h.run(2);
    giveStatus(hero(sim, 0), { id: 'doom', stacks: 3, remaining: 10, duration: 10 });
    h.tick();
    expect(h.entities.drawnM3.doomPips).toBe(3);
    expect(h.entities.drawnM3.doomHot).toBe(0);
    expect(h.telegraphs.drawnM3.statusBadges).toBe(0);
    giveStatus(hero(sim, 0), { id: 'doom', stacks: DOOM_CHIME_AT, remaining: 10, duration: 10 });
    h.tick();
    expect(h.entities.drawnM3.doomHot).toBe(1);
    const badge = h.overlay.badges.find((b) => b.label.startsWith('Doom'))!;
    expect(badge.answers).toEqual(['chime', 'ward']);
    expect(badge.label).toBe(`Doom ×4/${DOOM_AT}`);
  });

  it('stitched: a pair sharing a source is sewn together; a lone stitch is only rooted', () => {
    const sim = sandbox();
    const h = harness(sim);
    h.run(2, [spawn('the_seamstress', 0, -12)]);
    tough(sim);
    const s = newest(sim, 'the_seamstress');
    giveStatus(hero(sim, 0), { id: 'stitched', source: s.id });
    giveStatus(hero(sim, 1), { id: 'stitched', source: s.id });
    h.tick();
    expect(h.entities.drawnM3.sewn).toBe(1);
    expect(h.entities.drawnM3.rooted).toBe(2);
    expect(h.overlay.badges.filter((b) => b.label === 'Stitched')).toHaveLength(2);
    const pairs: number[] = [];
    expect(stitchedPairs(sim.state, pairs)).toBe(1);
    // A different source: no pair.
    giveStatus(hero(sim, 1), { id: 'stitched', source: s.id + 1000 });
    h.tick();
    expect(h.entities.drawnM3.sewn).toBe(0);
  });

  it('riftStatuses / riftAnswers read the contract’s statuses', () => {
    const look = emptyRiftLook();
    const fake = {
      health: { statuses: [{ id: 'doom', stacks: 5, source: null }] },
    } as unknown as Entity;
    expect(riftStatuses(fake, look)).toBe(true);
    expect(look.doom).toBe(5);
    expect(riftAnswers(look)).toEqual(['chime', 'ward']);
    expect(cutLabel('unpick')).toBe('UNPICKED');
    expect(cutLabel('snip')).toBe('CUT');
  });
});

/** A synthetic telegraph from `owner` (lab-only preview: the sim never sees it). */
function mk(
  sim: Sim,
  owner: number,
  attackId: string,
  shape: WorldState['telegraphs'][number]['shape'],
  effect: WorldState['telegraphs'][number]['effect'] = 'damage',
  id = 9000,
): { t: WorldState['telegraphs'][number]; effect: WorldState['telegraphs'][number]['effect'] } {
  const now = sim.state.time;
  return {
    t: {
      id,
      owner,
      target: null,
      attackId,
      name: attackId,
      kind: 'beam',
      shape,
      start: now,
      impact: now + 2,
      perfectFrom: now + 1.65,
      damage: 100,
      pctMaxHp: 0,
      effect,
      answers: ['thread', 'move'],
      severity: 'normal',
    },
    effect,
  };
}

describe('Cuts', () => {
  it('a cut line is dotted, with the scissors where it crosses the live Thread', () => {
    const sim = sandbox();
    const h = harness(sim);
    h.run(2, [spawn('shears', 6, -6), { t: 'thread', slot: 1 }]);
    h.run(2);
    tough(sim);
    const w = sim.state.entities.get(sim.state.weaverId)!;
    const l = hero(sim, 1);
    const mx = (w.x + l.x) / 2;
    const mz = (w.z + l.z) / 2;
    const dx = l.x - w.x;
    const dz = l.z - w.z;
    const d = Math.hypot(dx, dz);
    const px = -dz / d;
    const pz = dx / d;
    const owner = newest(sim, 'shears').id;
    h.telegraphs.preview = [
      mk(sim, owner, 'shears_dash', {
        kind: 'line',
        x: mx - px * 6,
        z: mz - pz * 6,
        toX: mx + px * 6,
        toZ: mz + pz * 6,
        width: 1.2,
      }),
    ];
    h.tick();
    expect(h.telegraphs.drawnM3.cutLines).toBe(1);
    expect(h.telegraphs.drawnM3.scissors).toBe(1);
    // Moved off the Thread: dotted, no scissors.
    h.telegraphs.preview = [
      mk(
        sim,
        owner,
        'shears_dash',
        {
          kind: 'line',
          x: w.x + 30,
          z: w.z + 30,
          toX: w.x + 31,
          toZ: w.z + 40,
          width: 1.2,
        },
        'damage',
        9001,
      ),
    ];
    h.tick();
    expect(h.telegraphs.drawnM3.cutLines).toBe(1);
    expect(h.telegraphs.drawnM3.scissors).toBe(0);
    const out = { x: 0, z: 0 };
    expect(crossing(-1, 0, 1, 0, 0, -1, 0, 1, out)).toBe(true);
    expect(out).toEqual({ x: 0, z: 0 });
  });

  it('an enemy cut: CUT in the fray (UNPICKED for the Unpick), the stub and its lock ring; the range snap stays SNAPPED', () => {
    const sim = sandbox();
    const h = harness(sim);
    h.run(2, [{ t: 'thread', slot: 1 }]);
    h.run(2);
    const w = worldOf(sim).entities.get(sim.state.weaverId)!.weaver!;
    const target = sim.state.party[1]!;
    w.threadSlot = null;
    w.threadLock = 3;
    h.inject([{ type: 'threadSnapped', tick: sim.tick, target, cause: 'snip', lock: 3 }]);
    expect(h.overlay.callouts.at(-1)).toEqual({ text: 'CUT', color: RIFT_HEX.fray });
    expect(h.feedback.firedM3.cuts).toBe(1);
    h.inject([]);
    expect(h.thread.drawnM3.stubs).toBe(1);
    expect(h.thread.drawnM3.lockRings).toBe(1);
    h.inject([{ type: 'threadSnapped', tick: sim.tick, target, cause: 'unpick', lock: 1 }]);
    expect(h.overlay.callouts.at(-1)!.text).toBe('UNPICKED');
    expect(h.feedback.firedM3.unpicked).toBe(1);
    // A range snap (no cause): the grey SNAPPED, no stub.
    h.inject([{ type: 'threadSnapped', tick: sim.tick, target }]);
    expect(h.overlay.callouts.at(-1)!.text).toBe('SNAPPED');
    h.inject([]);
    expect(h.thread.drawnM3.stubs).toBe(0);
    // Guard Strand: a silk spark.
    h.inject([
      { type: 'cutResolved', tick: sim.tick, telegraph: -1, cause: 'shears', result: 'strand' },
    ]);
    h.inject([{ type: 'strandBlocked', tick: sim.tick, source: null, x: 0, z: 0 }]);
    expect(h.feedback.firedM3.strands).toBe(2);
    // 'held' and 'none' draw nothing.
    h.inject([
      { type: 'cutResolved', tick: sim.tick, telegraph: -1, cause: 'shears', result: 'held' },
    ]);
    expect(h.feedback.firedM3.strands).toBe(2);
  });
});

describe('Zones, the Thread turned, a stolen aura', () => {
  it('a pull swirls inward and drags those inside; a rune rings the Weaver and locks her', () => {
    const sim = sandbox();
    const h = harness(sim);
    h.run(2);
    const w = sim.state.entities.get(sim.state.weaverId)!;
    const k = hero(sim, 0);
    // A zone ends when its owner dies (W2's updateZones), so these are owned by someone standing.
    const zones: NonNullable<ReturnType<typeof worldOf>['field']['zones']> = [
      { id: 1, kind: 'pull', owner: w.id, x: k.x, z: k.z, r: 8, until: 99, pullSpeed: 2.4 },
      { id: 2, kind: 'null', owner: w.id, x: w.x, z: w.z, r: 5, until: 99 },
    ];
    // Staged as the sim keeps them (W2's `field.zones`), then removed.
    worldOf(sim).field.zones = zones;
    h.tick();
    expect(h.field.drawnM3.pulls).toBe(1);
    expect(h.field.drawnM3.runes).toBe(1);
    expect(h.entities.drawnM3.drag).toBeGreaterThanOrEqual(1);
    expect(h.entities.drawnM3.runeLock).toBe(1);
    delete worldOf(sim).field.zones;
    h.tick();
    expect(allZero(h.field.drawnM3)).toBe(true);
    // The lab's override draws the same without the sim.
    h.field.zoneOverride = [{ kind: 'pull', x: 0, z: 0, r: 8 }];
    h.tick();
    expect(h.field.drawnM3.pulls).toBe(1);
  });

  it('Unravel: a black core, lethal barbs, forward beads, a minus; Empower and Stasis show your own Thread', () => {
    const sim = sandbox();
    const h = harness(sim);
    h.run(2, [{ t: 'thread', slot: 0 }]);
    h.run(20);
    const f = worldOf(sim).field;
    f.unravel = { until: sim.state.time + 5, source: -1, acc: 0, tickIn: 0.5 };
    h.run(20);
    const d = h.thread.drawnM3;
    expect(d.unravel).toBe(1);
    expect(d.barbs).toBeGreaterThan(0);
    expect(d.unravelBeads).toBeGreaterThan(0);
    expect(d.minus).toBe(1);
    // Under Stasis Mend heals as usual: the Thread is yours again.
    f.stasis = true;
    h.run(40);
    expect(h.thread.drawnM3.unravel).toBe(0);
    f.stasis = false;
    delete f.unravel;
    h.run(40);
    expect(allZero(h.thread.drawnM3)).toBe(true);
  });

  it('a stolen aura: its band hollow, its slot a dashed ring; the Stolen Verse in its colour; the pour back', () => {
    const sim = sandbox({ chords: SONGS });
    const h = harness(sim);
    h.run(2, [spawn('stolen_verse', 4, -9)]);
    tough(sim);
    const chord = sim.state.field.chords.findIndex((c) => c.auras.length > 0);
    expect(chord).toBeGreaterThanOrEqual(0);
    const verse = newest(sim, 'stolen_verse');
    worldOf(sim).field.stolen = { chord, aura: 0, add: verse.id, until: sim.state.time + 30 };
    h.tick();
    expect(h.field.drawnM3.stolen).toBe(1);
    expect(h.entities.drawnM3.verseTint).toBe(1);
    const aura = sim.state.field.chords[chord]!.auras[0]!;
    h.inject([{ type: 'verseStolen', tick: sim.tick, aura, add: verse.id, until: 30 }]);
    dealDamage(worldOf(sim), verse, {
      source: sim.state.party[0]!,
      sourceName: 'test',
      amount: verse.health!.hp + 1,
      telegraph: null,
    });
    delete worldOf(sim).field.stolen;
    h.run(1);
    h.inject([{ type: 'verseReturned', tick: sim.tick, aura, reason: 'killed' }]);
    expect(h.feedback.firedM3.steals).toBe(1);
    expect(h.feedback.firedM3.pours).toBe(1);
    expect(h.field.drawnM3.stolen).toBe(0);
  });
});

describe('Mirrors, Spindles and the champion', () => {
  it('a mirrored Ward on an enemy (never Ward’s shell), Emboldened’s shimmer, MIRROR CRACKED', () => {
    const sim = sandbox();
    const h = harness(sim);
    h.run(2, [spawn('mirror_champion', 2, -8), spawn('mimic', -3, -10)]);
    tough(sim);
    const c = newest(sim, 'mirror_champion');
    addShield(worldOf(sim), c, 'mirror', 5000, 6, false);
    c.enemy!.emboldenedUntil = sim.state.time + 8;
    h.tick();
    expect(h.entities.drawnM3.mirrorShells).toBe(1);
    expect(h.entities.drawnM3.emboldened).toBe(1);
    h.inject([
      { type: 'mirrorCracked', tick: sim.tick, enemy: newest(sim, 'mimic').id, copy: 'ward' },
    ]);
    expect(h.feedback.firedM3.cracked).toBe(1);
    expect(h.overlay.callouts.some((o) => o.text === 'MIRROR CRACKED')).toBe(true);
  });

  it('the Mimic’s cast: a shimmer to its beneficiary and the copied glyph on its badge', () => {
    const sim = sandbox();
    const h = harness(sim);
    h.run(2, [spawn('mimic', -3, -10), spawn('void_maw', 2, -9)]);
    tough(sim);
    const m = newest(sim, 'mimic');
    m.enemy!.mimic = { copy: 'ward' };
    h.telegraphs.preview = [
      mk(sim, m.id, 'mimic_mirror', { kind: 'circle', x: m.x, z: m.z, r: 1.5 }, 'mimic'),
    ];
    h.tick();
    expect(h.telegraphs.drawnM3.mirrors).toBe(1);
    const badge = h.overlay.badges.find((b) => b.label === 'Mirror · Ward')!;
    expect(badge.answers).toEqual(['ward']);
  });

  it('Spindles tether the Unweaver, which wears their plating; the champion’s mirror Thread', () => {
    const sim = sandbox();
    const h = harness(sim);
    h.run(2, [
      spawn('the_unweaver', 0, -12),
      spawn('spindle', -7, -8),
      spawn('spindle', 7, -8),
      spawn('mirror_champion', 2, -7),
    ]);
    tough(sim);
    h.tick();
    // The sim counts the Spindles onto its boss (W2's `tethered`): two tethers, the plating.
    expect(newest(sim, 'the_unweaver').enemy!.tethered).toBe(2);
    expect(h.entities.drawnM3.spindleTethers).toBe(2);
    // Without the key (no tethered add standing) there are no tethers and no plating.
    delete newest(sim, 'the_unweaver').enemy!.tethered;
    h.tick();
    expect(h.entities.drawnM3.spindleTethers).toBe(0);
    expect(h.entities.drawnM3.plating).toBe(0);
    newest(sim, 'the_unweaver').enemy!.tethered = 2;
    h.tick();
    expect(h.entities.drawnM3.spindleTethers).toBe(2);
    expect(h.entities.drawnM3.plating).toBe(1);
    expect(h.entities.drawnM3.championBeams).toBe(1);
    h.inject([
      {
        type: 'spindled',
        tick: sim.tick,
        enemy: newest(sim, 'the_unweaver').id,
        source: sim.state.party[0]!,
      },
    ]);
    expect(h.overlay.callouts.at(-1)!.text).toBe('−75%');
  });

  it('a Silencing elite carries the Mute’s dome at its own radius (suppressRadiusOf), with its rune gem', () => {
    const sim = sandbox();
    const h = harness(sim);
    h.run(2, [spawn('null_priest', 0, -8, true)]);
    const p = newest(sim, 'null_priest');
    p.enemy!.affixes = ['silencing'];
    h.entities.forget(p.id);
    h.tick();
    expect(suppressRadiusOf(sim.state, p)).toBe(7);
    expect(h.entities.recs.get(p.id)!.suppressRadius).toBe(7);
    expect(h.entities.drawnM3.gems).toBe(1);
  });
});

describe('The budget', () => {
  for (const tier of ['low', 'medium', 'high'] as const) {
    it(`no FX batch growth, every peak under capacity in a busy Unweaver scene (${tier})`, () => {
      const sim = sandbox({ chords: SONGS });
      const h = harness(sim);
      h.kit.setQuality(tier);
      const batches = h.kit.group.children.length;
      expect(batches).toBe(12);
      h.run(2, [
        spawn('the_unweaver', 0, -12),
        spawn('spindle', -7, -8),
        spawn('spindle', 7, -8),
        spawn('spindle', 0, -4),
        spawn('mirror_champion', 3, -7),
        spawn('doubt_wraith', -5, -10),
        spawn('void_maw', 5, -5),
        spawn('mimic', -6, -6),
        spawn('stolen_verse', 8, -10),
        { t: 'thread', slot: 0 },
      ]);
      h.run(2, [spawn('null_priest', 0, -8, true), spawn('shears', -2, -6, true)]);
      tough(sim);
      const w = worldOf(sim);
      const boss = newest(sim, 'the_unweaver');
      boss.enemy!.tethered = 3;
      const c = newest(sim, 'mirror_champion');
      c.enemy!.emboldenedUntil = 999;
      addShield(w, c, 'mirror', 5000, 60, false);
      newest(sim, 'mimic').enemy!.mimic = { copy: 'empower' };
      newest(sim, 'null_priest').enemy!.affixes = ['silencing'];
      newest(sim, 'shears').enemy!.affixes = ['severing', 'doom_touched'];
      h.entities.forget(newest(sim, 'null_priest').id);
      h.entities.forget(newest(sim, 'shears').id);
      const wraith = newest(sim, 'doubt_wraith');
      const seam = 777;
      giveStatus(hero(sim, 0), { id: 'doom', stacks: 4, remaining: 10, duration: 10 });
      giveStatus(hero(sim, 1), { id: 'possessed', source: wraith.id, tickIn: 0.5 });
      giveStatus(hero(sim, 1), { id: 'stitched', source: seam });
      giveStatus(hero(sim, 2), { id: 'stitched', source: seam });
      giveStatus(hero(sim, 2), { id: 'bleed', stacks: 7 });
      const weaver = sim.state.entities.get(sim.state.weaverId)!;
      w.field.zones = [
        { id: 1, kind: 'pull', owner: newest(sim, 'void_maw').id, x: 5, z: -5, r: 8, until: 999 },
        {
          id: 2,
          kind: 'null',
          owner: newest(sim, 'null_priest').id,
          x: weaver.x,
          z: weaver.z,
          r: 5,
          until: 999,
        },
      ];
      w.field.unravel = { until: 999, source: boss.id, acc: 0, tickIn: 0.5 };
      const chord = w.field.chords.findIndex((ch) => ch.auras.length > 0);
      if (chord >= 0)
        w.field.stolen = { chord, aura: 0, add: newest(sim, 'stolen_verse').id, until: 999 };
      const peak = {
        rings: 0,
        sprites: 0,
        spritesTop: 0,
        beams: 0,
        shells: 0,
        telegraphs: 0,
        marks: 0,
      };
      let particles = 0;
      for (let i = 0; i < 90; i++) {
        const n = h.tick().counts;
        for (const k of Object.keys(peak) as (keyof typeof peak)[])
          peak[k] = Math.max(peak[k], n[k]);
        particles = Math.max(particles, h.kit.particles.alive);
      }
      // Everything Movement III draws was on screen.
      const d = h.entities.drawnM3;
      expect(d.possessRims + d.masks + d.sewn + d.spindleTethers + d.plating).toBeGreaterThan(5);
      expect(d.championBeams).toBe(1);
      // Severing and Doom-touched on the Shears, Silencing on the Priest: a shaped gem each.
      expect(d.gems).toBe(3);
      expect(h.field.drawnM3.pulls + h.field.drawnM3.runes).toBe(2);
      expect(h.kit.group.children.length).toBe(batches);
      expect(peak.rings).toBeLessThan(384);
      expect(peak.sprites).toBeLessThan(256);
      expect(peak.spritesTop).toBeLessThan(48);
      expect(peak.beams).toBeLessThan(160);
      expect(peak.shells).toBeLessThan(64);
      expect(peak.telegraphs).toBeLessThan(96);
      expect(peak.marks).toBeLessThan(24);
      expect(particles).toBeLessThanOrEqual(PARTICLE_CAPS[tier].add);
      // Clean up the staged keys (as endEncounter would).
      delete w.field.zones;
      delete w.field.unravel;
      delete w.field.stolen;
    });
  }
});

describe('Colour', () => {
  it('every Rift semantic colour is ΔE ≥ 20 from lethal, threat, Bear, Mend and Empower in every palette', () => {
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
      for (const [name, hex] of Object.entries(RIFT_HEX))
        for (const [other, o] of Object.entries(against))
          expect(
            deltaE(see(hex), see(o)),
            `${vision}: ${name} ${hex} vs ${other} ${o}`,
          ).toBeGreaterThanOrEqual(20);
    }
  });
});

describe('Doom and Unravel follow the sim, not render constants', () => {
  it("Doom's ignition count is content's (burst.at), so a retune moves the pips and the label", () => {
    const touched = CONTENT.affixes.find((f) => f.id === 'doom_touched')!;
    expect(touched.onHit?.id).toBe('doom');
    expect(DOOM_AT).toBe(touched.onHit!.burst!.at);
    expect(doomIgnitionAt(CONTENT)).toBe(DOOM_AT);
    // A retune to 4 or 6 stacks is read through.
    const retuned = (at: number) => ({
      attacks: CONTENT.attacks,
      enemies: CONTENT.enemies,
      affixes: CONTENT.affixes.map((f) =>
        f.onHit?.id === 'doom'
          ? { ...f, onHit: { ...f.onHit, maxStacks: at, burst: { ...f.onHit.burst!, at } } }
          : f,
      ),
    });
    expect(doomIgnitionAt(retuned(4))).toBe(4);
    expect(doomIgnitionAt(retuned(6))).toBe(6);
    // Doom on an enemy's basic hit, with only maxStacks, is found too.
    const onEnemy = {
      attacks: [],
      affixes: [],
      enemies: [
        {
          ...CONTENT.enemies[0]!,
          basic: { ...CONTENT.enemies[0]!.basic, onHit: { ...touched.onHit!, burst: undefined } },
        },
      ],
    };
    expect(doomIgnitionAt(onEnemy)).toBe(touched.onHit!.maxStacks);
  });

  it('Doom draws DOOM_AT pip slots and caps the filled ones there', () => {
    const sim = sandbox();
    const h = harness(sim);
    h.run(2);
    giveStatus(hero(sim, 0), { id: 'doom', stacks: DOOM_AT + 3, remaining: 10, duration: 10 });
    h.tick();
    expect(h.entities.drawnM3.doomPips).toBe(DOOM_AT);
    const badge = h.overlay.badges.find((b) => b.label.startsWith('Doom'))!;
    expect(badge.label).toBe(`Doom ×${DOOM_AT + 3}/${DOOM_AT}`);
  });

  it("only Unravel's own tick on the threaded hero counts, in the live lethal colour", () => {
    const sim = sandbox();
    const h = harness(sim);
    h.run(2, [
      { t: 'thread', slot: 0 },
      spawn('the_unweaver', 0, -12),
      spawn('doubt_wraith', 4, -12),
    ]);
    h.run(10);
    tough(sim);
    const boss = newest(sim, 'the_unweaver');
    const wraith = newest(sim, 'doubt_wraith');
    const w = worldOf(sim);
    expect(sim.state.entities.get(sim.state.weaverId)!.weaver!.threadSlot).toBe(0);
    const threaded = hero(sim, 0).id;
    const other = hero(sim, 1).id;
    let n = 0;
    const tick = (
      target: number,
      source: number | null,
      hit: 'hit' | 'tick' = 'tick',
    ): SimEvent => ({
      type: 'damageTaken',
      tick: sim.tick,
      target,
      source,
      amount: 20 + n++,
      absorbed: 0,
      amplified: 0,
      aura: 0,
      radiance: 0,
      eclipse: 0,
      crit: false,
      telegraph: null,
      hit,
    });
    // No Unravel: nothing counts (Movement I and II never set the key).
    h.inject([tick(threaded, boss.id)]);
    expect(h.feedback.firedM3.unravelTicks).toBe(0);
    w.field.unravel = { until: sim.state.time + 5, source: boss.id, acc: 0, tickIn: 0.5 };
    try {
      for (const vision of ['normal', 'deuteranopia'] as const) {
        applyVision(vision);
        // Past the numbers' aggregation window (0.4 s), so each one starts fresh.
        for (let i = 0; i < 30; i++) h.inject([]);
        h.overlay.numbers.length = 0;
        const before = h.feedback.firedM3.unravelTicks;
        // A possession tick (the Wraith's) and the boss's tick on another hero: not Unravel.
        h.inject([tick(threaded, wraith.id), tick(other, boss.id), tick(threaded, boss.id, 'hit')]);
        expect(h.feedback.firedM3.unravelTicks).toBe(before);
        expect(h.overlay.numbers.some((x) => x.color === VISION_HEX.lethal)).toBe(false);
        // Unravel's own tick: counted, and its own number in the live lethal colour.
        h.inject([tick(threaded, boss.id)]);
        expect(h.feedback.firedM3.unravelTicks).toBe(before + 1);
        expect(h.overlay.numbers.at(-1)!.color).toBe(VISION_HEX.lethal);
        expect(h.overlay.numbers.at(-1)!.color).not.toBe(VISION_HEX.heal);
      }
      // A hit that lands inside the aggregation window after a tick starts its own number in
      // the party colour; it never joins the tick's lethal number (and a tick never joins it).
      for (let i = 0; i < 30; i++) h.inject([]);
      h.overlay.numbers.length = 0;
      h.inject([tick(threaded, boss.id)]);
      h.inject([tick(threaded, boss.id, 'hit')]);
      h.inject([tick(threaded, boss.id), tick(threaded, boss.id, 'hit')]);
      expect(h.overlay.numbers.map((x) => x.color)).toEqual([
        VISION_HEX.lethal,
        '#fb7185',
        VISION_HEX.lethal,
        '#fb7185',
      ]);
      // Two plain hits on the same hero still share one number.
      for (let i = 0; i < 30; i++) h.inject([]);
      h.overlay.numbers.length = 0;
      h.inject([tick(threaded, boss.id, 'hit'), tick(threaded, wraith.id, 'hit')]);
      expect(h.overlay.numbers).toHaveLength(1);
      // Under Stasis Mend heals: nothing is Unravel's.
      w.field.stasis = true;
      const before = h.feedback.firedM3.unravelTicks;
      h.inject([tick(threaded, boss.id)]);
      expect(h.feedback.firedM3.unravelTicks).toBe(before);
      w.field.stasis = false;
    } finally {
      applyVision('normal');
      delete w.field.unravel;
    }
  });
});
