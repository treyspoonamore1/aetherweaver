/**
 * Phase 5d W6: the Finale, the Silent Conductor (docs/phase-5d.md, Presentation). Every check
 * drives a real headless sim and feeds its state and events to the real EntityLayer, FieldView,
 * TelegraphLayer, ThreadView, PartyBarsView and Feedback (with its CrucibleCues) over a real
 * FxKit, then reads what they drew. Where a Finale mechanic is the sim's to produce (W1, W2: the
 * Cue, Discord, Fortissimo Silence, the Grand Silence and its notes), the test stages that state
 * or event on the real world the way the contract (docs/phase-5d.md, contracts 3 and 5) says the
 * sim keeps it, so the render side is checked on its own. Until content registers the Conductor,
 * its choir and the Crucible (W2), the bodies and the arena are checked on stand-in defs with the
 * contract's ids; content's own are used once they exist.
 */
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { COLOR_VISIONS, simulateVision, visionPalette } from '../src/app/colorVision';
import { BEAT } from '../src/audio/theory';
import type { ArenaDef, EnemyDef } from '../src/content';
import { CONTENT, enemyDef } from '../src/content';
import {
  ALTO,
  BASS,
  CONDUCTOR,
  CRUCIBLE_ARENA,
  NOTES_NEEDED,
  SOPRANO,
  TENOR,
} from '../src/content/crucibleIds';
import type { Command, Entity, FinaleField, Sim, SimEvent, Status } from '../src/sim';
import { createSim } from '../src/sim';
import { ArenaView } from '../src/render/arena';
import { CallView } from '../src/render/calls';
import type { CameraRig } from '../src/render/camera';
import { CRUCIBLE_MOOD, arenaLook, arenaMood, materialOf } from '../src/render/crimsonCues';
import {
  BEAT_SECONDS,
  CRUCIBLE_ARENA_STAND_IN,
  CRUCIBLE_HEX,
  CRUCIBLE_SKY_HEX,
  CRUCIBLE_UNMARKED,
  FINALE_HEX,
  ORRERY,
  crucibleArenaDef,
  crucibleSky,
  emptySky,
  isStilled,
  orreryCentre,
  orreryRadius,
  orreryTop,
  silenceDepth,
} from '../src/render/crucibleCues';
import { EntityLayer } from '../src/render/entities';
import { FermataView } from '../src/render/fermata';
import { Feedback } from '../src/render/feedback';
import { FieldView } from '../src/render/field';
import { FxKit, PARTICLE_CAPS } from '../src/render/fx/kit';
import { buildEnemy } from '../src/render/models/library';
import { createModelMaterial } from '../src/render/models/material';
import type { Overlay } from '../src/render/overlay';
import { PartyBarsView } from '../src/render/partyBars';
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
  callouts: { text: string; color: string }[] = [];
  silence: number[] = [];
  dangers = 0;
  flashes = 0;
  beginFrame(): void {}
  badge(): void {}
  allyBar(): void {}
  raid(): void {}
  callout(_x: number, _y: number, _z: number, text: string, color: string): void {
    this.callouts.push({ text, color });
  }
  spawnNumber(): number {
    return 0;
  }
  setNumber(): void {}
  numberAlive(): boolean {
    return true;
  }
  flash(): void {
    this.flashes++;
  }
  coolFlash(): void {}
  chroma(): void {}
  spotlight(): void {}
  danger(): void {
    this.dangers++;
  }
  setStasis(): void {}
  setSilence(v: number): void {
    this.silence.push(v);
  }
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
  const lights = {
    key: new THREE.DirectionalLight('#e2dccc', 1.7),
    hemi: new THREE.HemisphereLight('#1b2142', '#16141f', 0.5),
    rim: new THREE.DirectionalLight(),
  };
  const stage = { lights } as unknown as Stage;
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
  return { kit, entities, telegraphs, feedback, overlay: fake, lights, tick, run, inject };
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
  const s: Status = { remaining: 60, duration: 60, stacks: 1, source: null, ...status };
  if (i >= 0) list[i] = s;
  else list.push(s);
}

function strip(e: Entity, id: Status['id']): void {
  const list = e.health!.statuses as Status[];
  const i = list.findIndex((s) => s.id === id);
  if (i >= 0) list.splice(i, 1);
}

/** Keeps every enemy alive. */
function tough(sim: Sim): void {
  for (const e of worldOf(sim).entities.list())
    if (e.enemy && e.health) e.health.hp = e.health.maxHp = 1e6;
}

/** Every counter in a record is zero. */
const allZero = (o: Readonly<Record<string, number>>) => Object.values(o).every((v) => v === 0);

/** The Finale's public state as the sim keeps it (contract 3), staged on the real world. */
function stage(sim: Sim, finale: FinaleField): FinaleField {
  worldOf(sim).field.finale = finale;
  return finale;
}

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
function buildArena(def: ArenaDef) {
  const g = globalThis as { document?: unknown };
  const had = g.document;
  g.document = { createElement: () => ({ width: 0, height: 0, getContext: () => null }) };
  try {
    const moods: Record<string, string | number>[] = [];
    const stage = { setMood: (m: Record<string, string | number>) => moods.push(m) } as never;
    const view = new ArenaView(def, stage, createModelMaterial());
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

/**
 * The Finale's enemy defs: content's once W2 registers them, else stand-ins built on Movement I's
 * chorister and Cantor with the contract's ids and `material: 'glass'`.
 */
function finaleDef(id: string): EnemyDef {
  const own = CONTENT.enemies.find((e) => e.id === id);
  if (own) return own;
  const base = enemyDef(id === CONDUCTOR ? 'the_hollow_cantor' : 'hollow_chorister');
  const tint: Record<string, string> = {
    [CONDUCTOR]: '#4a4658',
    [ALTO]: '#a7b4d6',
    [BASS]: '#9a8fb8',
    [TENOR]: '#b3a7c6',
    [SOPRANO]: '#c2b6d6',
  };
  return {
    ...base,
    id,
    color: tint[id] ?? base.color,
    accent: '#e8e0c8',
    material: 'glass',
    ...(id === CONDUCTOR ? { radius: 1.5, height: 4.8 } : { height: 2.1 }),
  };
}

/** A temporarily glass def (the death routing, until content's choir exists). */
function asGlass<T>(id: string, fn: () => T): T {
  const def = enemyDef(id) as { material?: string };
  const had = def.material;
  def.material = 'glass';
  try {
    return fn();
  } finally {
    if (had === undefined) delete def.material;
    else def.material = had;
  }
}

const M1_ENCOUNTER = 'first_light';
const M2_ENCOUNTER = 'crimson_gate';
const M3_ENCOUNTER = 'frayed_threshold';

describe('Movements I-III draw and play no Finale cue', () => {
  for (const encounter of [M1_ENCOUNTER, M2_ENCOUNTER, M3_ENCOUNTER]) {
    it(`a ${encounter} fight draws no Finale cue, plays none and keeps no Finale key`, () => {
      const sim = createSim({ seed: 11, encounter, auras: [] });
      const h = harness(sim);
      const keyColor = h.lights.key.color.getHex();
      for (let i = 0; i < 60 * 12; i++) {
        h.tick(i === 30 ? [{ t: 'thread', slot: 0 }] : []);
        expect(allZero(h.entities.drawnFinale), `${encounter} entities ${i}`).toBe(true);
        expect(allZero(h.feedback.drawnFinale), `${encounter} crucible ${i}`).toBe(true);
      }
      expect(allZero(h.feedback.firedFinale), encounter).toBe(true);
      expect('finale' in sim.state.field).toBe(false);
      expect(h.feedback.crucible.silence).toBe(0);
      expect(h.feedback.crucible.live).toBe(false);
      expect(h.overlay.silence).toEqual([]);
      expect(h.lights.key.color.getHex()).toBe(keyColor);
    });
  }

  it('no existing arena wears the crucible, and no earlier enemy is glass', () => {
    for (const a of CONTENT.arenas)
      if (a.biome !== 'celestial_crucible') expect(arenaLook(a), a.id).not.toBe('crucible');
    for (const e of CONTENT.enemies)
      if ((e.movement ?? 1) <= 3) expect(materialOf(e), e.id).not.toBe('glass');
  });

  it('riftCues.ts is untouched (every Finale VFX lives in crucibleCues.ts)', () => {
    const src = readFileSync(new URL('../src/render/riftCues.ts', import.meta.url), 'utf8');
    expect(fnv(2166136261, src).toString(16)).toBe('72806a7b');
  });
});

describe('The Celestial Crucible', () => {
  it('the biome has its BIOME_LOOK row and its mood: navy sky, starlight key, cobalt rim ≤ 0.45', () => {
    const def = crucibleArenaDef();
    expect(def.id).toBe(CRUCIBLE_ARENA);
    expect(arenaLook({ id: 'any', biome: 'celestial_crucible' })).toBe('crucible');
    expect(arenaLook(def)).toBe('crucible');
    const mood = arenaMood(def);
    expect(mood).toEqual({
      sky: CRUCIBLE_HEX.sky,
      ground: def.theme.floor,
      hemi: 0.5,
      key: CRUCIBLE_HEX.key,
      keyIntensity: CRUCIBLE_MOOD.keyIntensity,
      rim: CRUCIBLE_HEX.rim,
      rimIntensity: CRUCIBLE_MOOD.rimIntensity,
      fog: def.theme.fog,
      fogNear: 40,
      fogFar: 90,
    });
    expect(mood.keyIntensity).toBeLessThanOrEqual(1.85);
    expect(mood.rimIntensity).toBeLessThanOrEqual(0.45);
    // The white-gold never lights the disc: the key and rim are neither it nor the orrery's.
    for (const hex of Object.values(CRUCIBLE_SKY_HEX)) {
      expect(mood.key).not.toBe(hex);
      expect(mood.rim).not.toBe(hex);
    }
    // Every content arena of the biome wears it.
    for (const a of CONTENT.arenas.filter((x) => x.biome === 'celestial_crucible'))
      expect(arenaLook(a), a.id).toBe('crucible');
  });

  it('its pieces swap one for one: 6 meshes open, 7 with pillars', () => {
    const open = buildArena(crucibleArenaDef());
    expect(open.view.look).toBe('crucible');
    expect(open.meshes).toBe(crucibleArenaDef().obstacles.length > 0 ? 7 : 6);
    const pillared = buildArena({
      ...CRUCIBLE_ARENA_STAND_IN,
      obstacles: [
        { x: 6, z: -4, r: 1.2 },
        { x: -6, z: -4, r: 1.2 },
      ],
    });
    expect(pillared.meshes).toBe(7);
    const bare = buildArena(CRUCIBLE_ARENA_STAND_IN);
    expect(bare.meshes).toBe(6);
  });

  it('the sky orrery and the prism motes hide on low quality, as the god rays and dust do', () => {
    const a = buildArena(CRUCIBLE_ARENA_STAND_IN);
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

  it('white-gold and prism stay off the disc: orrery, motes and stalls stand outside its radius', () => {
    const def = CRUCIBLE_ARENA_STAND_IN;
    const R = def.radius;
    const a = buildArena(def);
    let orrery: THREE.Mesh | null = null;
    let motes: THREE.Points | null = null;
    let rim: THREE.InstancedMesh | null = null;
    a.view.group.traverse((o) => {
      if ((o as THREE.Points).isPoints) motes = o as THREE.Points;
      else if (o.renderOrder === 12) orrery = o as THREE.Mesh;
      else if ((o as THREE.InstancedMesh).isInstancedMesh) rim = o as THREE.InstancedMesh;
    });
    const minRadius = (g: THREE.BufferGeometry) => {
      const p = g.getAttribute('position');
      let min = Infinity;
      for (let i = 0; i < p.count; i++) min = Math.min(min, Math.hypot(p.getX(i), p.getZ(i)));
      return min;
    };
    expect(minRadius(orrery!.geometry)).toBeGreaterThan(R);
    // The motes sway half a metre round where they start.
    expect(minRadius(motes!.geometry)).toBeGreaterThan(R + 1);
    expect(minRadius(rim!.geometry)).toBeGreaterThan(R + 0.5);
    // The largest ring's top stops outside the disc, and leans toward it.
    const top = { x: 0, y: 0, z: 0 };
    orreryTop(R, ORRERY.rings - 1, top);
    expect(-top.z).toBeGreaterThan(R);
    expect(top.y).toBeGreaterThan(ORRERY.lift + orreryRadius(ORRERY.rings - 1) * 0.8);
    const c = { x: 0, y: 0, z: 0 };
    orreryCentre(R, c);
    expect(c.z).toBeLessThan(top.z);
  });

  it('the floor sits far below the ailment, lethal and threat telegraphs in lightness, in every vision', () => {
    const floor = new THREE.Color(crucibleArenaDef().theme.floor).multiplyScalar(0.78);
    const L = lightness(`#${floor.getHexString()}`);
    expect(L).toBeLessThan(12);
    const MIN = { ailment: 40, lethal: 25, threat: 25 } as const;
    for (const vision of COLOR_VISIONS) {
      const p = visionPalette(vision);
      for (const role of ['ailment', 'lethal', 'threat'] as const) {
        const t = lightness(simulateVision(p[role], vision));
        expect(t - L, `${vision} ${role}`).toBeGreaterThanOrEqual(MIN[role]);
      }
    }
  });

  it('the orrery follows the music when it has it, sim time and field.finale when it hasn’t', () => {
    expect(BEAT_SECONDS).toBeCloseTo(BEAT, 10);
    const sky = emptySky();
    // No music, no silence: a beat from time, the rings on the stems.
    crucibleSky(null, undefined, BEAT_SECONDS * 2.25, sky);
    expect(sky.beat).toBeCloseTo(0.25, 6);
    expect(sky.notes).toBe(-1);
    // The Grand Silence: every ring dark, one relit per note.
    const silence: FinaleField = {
      silence: { notes: 3, of: 8, since: 0, until: 50, sources: ['perfect', 'clutch', 'reel'] },
    };
    crucibleSky(silence, undefined, 1, sky);
    expect(sky.notes).toBe(3);
    // The music's own clock and stems when the runtime gives them.
    crucibleSky(
      null,
      { beatPhase: 0.6, beatInBar: 2, bar: 7, levels: [0.2, 0.4, 0.6, 0.8] },
      1,
      sky,
    );
    expect(sky.beat).toBe(0.6);
    expect(sky.stems).toEqual([0.2, 0.4, 0.6, 0.8]);
    crucibleSky(
      null,
      {
        beatPhase: 0,
        beatInBar: 0,
        bar: 0,
        levels: [0, 0, 0, 0],
        silence: { on: true, notes: 5 },
      },
      1,
      sky,
    );
    expect(sky.notes).toBe(5);
    // ArenaView takes it into the orrery's uniforms (and ignores it on any other floor).
    const a = buildArena(CRUCIBLE_ARENA_STAND_IN);
    a.view.update(1, 600, 'high', sky);
    expect(a.view.sky.notes).toBe(5);
    expect([...a.view.sky.stems]).toEqual([0, 0, 0, 0]);
    const nave = buildArena(CONTENT.arenas.find((x) => x.id === 'nave')!);
    nave.view.update(1, 600, 'high', sky);
    expect(nave.view.sky.notes).toBe(-1);
  });
});

describe('The Conductor and its mirror-choir', () => {
  const IDS = [CONDUCTOR, ALTO, BASS, TENOR, SOPRANO];

  it('each has a body of its own, none a role fallback, all distinct; all glass', () => {
    const hashes = new Set<string>();
    for (const id of IDS) {
      const def = finaleDef(id);
      const own = geoHash(buildEnemy(def));
      const role = geoHash(buildEnemy({ ...def, id: `${id}_as_role` }));
      expect(own, id).not.toBe(role);
      hashes.add(own);
      expect(materialOf(def), id).toBe('glass');
    }
    expect(hashes.size).toBe(IDS.length);
  });

  it('glass dies as glass: shards and rising notes, never porcelain, iron or cloth', () => {
    const sim = sandbox();
    const h = harness(sim);
    h.run(2, [spawn('hollow_chorister', 6, -10), spawn('the_hollow_cantor', -6, -12)]);
    const chor = newest(sim, 'hollow_chorister');
    const kill = (e: Entity, defId: string) =>
      h.inject([
        { type: 'enemyKilled', tick: sim.tick, enemy: e.id, defId, x: e.x, z: e.z } as SimEvent,
      ]);
    asGlass('hollow_chorister', () => kill(chor, 'hollow_chorister'));
    expect(h.feedback.firedFinale.glassDeaths).toBe(1);
    expect(h.feedback.firedM2.ironDeaths).toBe(0);
    expect(h.feedback.firedM3.clothDeaths).toBe(0);
    // Porcelain stays porcelain.
    kill(newest(sim, 'the_hollow_cantor'), 'the_hollow_cantor');
    expect(h.feedback.firedFinale.glassDeaths).toBe(1);
  });
});

/** A sandbox with a stand-in Conductor (a boss) and two voices, every enemy tough. */
function finaleScene() {
  const sim = sandbox();
  const h = harness(sim);
  h.run(2, [
    spawn('the_hollow_cantor', 0, -12),
    spawn('hollow_chorister', -5, -8),
    spawn('hollow_chorister', 5, -8),
  ]);
  tough(sim);
  const boss = newest(sim, 'the_hollow_cantor');
  const voices = worldOf(sim)
    .entities.list()
    .filter((e) => e.enemy?.defId === 'hollow_chorister') as Entity[];
  return { sim, h, boss, voices };
}

describe('The Cue, Discord and Fortissimo Silence', () => {
  it('the Cue: a brass baton line from the Conductor to its soloist, and the sigil over it', () => {
    const { sim, h, boss, voices } = finaleScene();
    const soloist = voices[0]!;
    stage(sim, {
      cue: { boss: boss.id, soloist: soloist.id, solo: 'alto_lament', until: sim.state.time + 4 },
    });
    h.inject([
      {
        type: 'enemyCued',
        tick: sim.tick,
        boss: boss.id,
        soloist: soloist.id,
        solo: 'alto_lament',
      } as SimEvent,
    ]);
    h.run(2);
    expect(h.feedback.firedFinale.cues).toBe(1);
    expect(h.feedback.drawnFinale.batonLines).toBe(1);
    expect(h.feedback.drawnFinale.batonSigils).toBe(1);
    delete worldOf(sim).field.finale;
    h.run(2);
    expect(h.feedback.drawnFinale.batonLines).toBe(0);
  });

  it('Discord fed: a brass streak from each hero it hit and a +N over the Conductor; answered, nothing', () => {
    const { sim, h, boss } = finaleScene();
    stage(sim, { discord: { value: 40, rate: 0.5 } });
    const target = sim.state.party[1]!;
    h.inject([
      {
        type: 'telegraphResolved',
        tick: sim.tick,
        telegraph: 4242,
        target,
        outcome: 'hit',
        damage: 300,
      } as SimEvent,
      {
        type: 'discordRose',
        tick: sim.tick,
        boss: boss.id,
        telegraph: 4242,
        amount: 20,
        value: 60,
      } as SimEvent,
    ]);
    expect(h.feedback.firedFinale.discordStreaks).toBe(1);
    expect(h.overlay.callouts).toContainEqual({ text: '+20', color: FINALE_HEX.discord });
    // An answered telegraph sends no discordRose, so nothing is drawn for it.
    h.inject([
      {
        type: 'telegraphResolved',
        tick: sim.tick,
        telegraph: 4243,
        target,
        outcome: 'warded',
        damage: 0,
      } as SimEvent,
    ]);
    expect(h.feedback.firedFinale.discordStreaks).toBe(1);
  });

  it('Fortissimo: three pips over the Conductor, a rising rim on every standing hero; the Crescendo shatters it', () => {
    const { sim, h, boss } = finaleScene();
    const f = stage(sim, { fortissimo: { pulse: 1, impact: sim.state.time + 3 } });
    h.run(30);
    expect(h.feedback.drawnFinale.fortissimoPips).toBe(3);
    expect(h.feedback.drawnFinale.fortissimoRims).toBe(sim.state.party.length);
    expect(h.feedback.firedFinale.fortissimoPulses).toBe(1);
    expect(h.overlay.dangers).toBe(1);
    f.fortissimo = { pulse: 2, impact: sim.state.time + 1.5 };
    h.run(2);
    expect(h.feedback.firedFinale.fortissimoPulses).toBe(2);
    expect(h.overlay.dangers).toBe(2);
    delete f.fortissimo;
    h.inject([
      { type: 'fortissimoCancelled', tick: sim.tick, boss: boss.id, by: 'crescendo' } as SimEvent,
    ]);
    expect(h.feedback.firedFinale.shatters).toBe(1);
    h.run(2);
    expect(h.feedback.drawnFinale.fortissimoPips).toBe(0);
    // A phase shift cancels it too, without the shatter.
    h.inject([
      { type: 'fortissimoCancelled', tick: sim.tick, boss: boss.id, by: 'phase' } as SimEvent,
    ]);
    expect(h.feedback.firedFinale.shatters).toBe(1);
    expect(h.feedback.firedFinale.cancelled).toBe(2);
  });
});

describe('The Grand Silence', () => {
  it('stilled heroes take the freeze-frame; the light greys, the vignette holds; both lift as the notes come', () => {
    const { sim, h, boss } = finaleScene();
    const baseHemi = h.lights.hemi.intensity;
    const baseKey = h.lights.key.color.getHex();
    const f = stage(sim, {
      silence: { notes: 0, of: 8, since: sim.state.time, until: sim.state.time + 50, sources: [] },
    });
    for (let s = 0; s < sim.state.party.length; s++) giveStatus(hero(sim, s), { id: 'stilled' });
    expect(isStilled(hero(sim, 0))).toBe(true);
    h.inject([{ type: 'silenceBegan', tick: sim.tick, boss: boss.id, until: 50 } as SimEvent]);
    h.run(90);
    expect(h.feedback.firedFinale.silences).toBe(1);
    expect(h.entities.drawnFinale.stilled).toBe(sim.state.party.length);
    expect(h.feedback.drawnFinale.stilledStaves).toBe(sim.state.party.length);
    expect(h.feedback.drawnFinale.halo).toBe(1);
    expect(h.feedback.drawnFinale.vignette).toBe(1);
    const dark = h.feedback.crucible.silence;
    expect(dark).toBeGreaterThan(0.85);
    expect(h.lights.hemi.intensity).toBeLessThan(baseHemi * 0.8);
    expect(h.lights.key.color.getHex()).not.toBe(baseKey);
    expect(h.overlay.silence[h.overlay.silence.length - 1]!).toBeGreaterThan(0.85);
    // Notes relight a step at a time.
    f.silence!.notes = 4;
    h.run(120);
    expect(h.feedback.crucible.silence).toBeLessThan(dark);
    expect(h.feedback.crucible.silence).toBeCloseTo(silenceDepth(f), 1);
    // Reignite: the silence is deleted, stilled comes off, the light returns exactly.
    delete f.silence;
    for (let s = 0; s < sim.state.party.length; s++) strip(hero(sim, s), 'stilled');
    h.run(600);
    expect(h.feedback.crucible.silence).toBe(0);
    expect(h.entities.drawnFinale.stilled).toBe(0);
    expect(h.lights.key.color.getHex()).toBe(baseKey);
    expect(h.lights.hemi.intensity).toBeCloseTo(baseHemi, 6);
    expect(h.overlay.silence[h.overlay.silence.length - 1]!).toBe(0);
  });

  it('each note: a gold mote rises from its hero to its ring in the sky; Reignite flares gold and raises the revived', () => {
    const { sim, h, boss } = finaleScene();
    stage(sim, {
      silence: { notes: 0, of: 8, since: sim.state.time, until: sim.state.time + 50, sources: [] },
    });
    const sources = ['perfect', 'clutch', 'reel', 'rewind'] as const;
    for (let n = 1; n <= NOTES_NEEDED; n++) {
      const src = sources[(n - 1) % 4]!;
      h.inject([
        {
          type: 'silenceNote',
          tick: sim.tick,
          n,
          of: 8,
          source: src,
          hero: src === 'rewind' ? null : sim.state.party[n % sim.state.party.length]!,
        } as SimEvent,
      ]);
      worldOf(sim).field.finale!.silence!.notes = n;
      h.run(6);
    }
    expect(h.feedback.firedFinale.notes).toBe(NOTES_NEEDED);
    expect(h.feedback.drawnFinale.motes).toBeGreaterThan(0);
    h.run(120);
    expect(h.feedback.drawnFinale.motes).toBe(0);
    const revived = sim.state.party[2]!;
    delete worldOf(sim).field.finale!.silence;
    h.inject([
      { type: 'reignited', tick: sim.tick, boss: boss.id, revived: [revived] } as SimEvent,
    ]);
    expect(h.feedback.firedFinale.reignites).toBe(1);
    expect(h.feedback.firedFinale.revived).toBe(1);
    for (const id of sim.state.party) expect(h.entities.recs.get(id)!.goldRim).toBeGreaterThan(0);
    h.run(2);
    expect(h.feedback.drawnFinale.risers).toBe(1);
    // The Coda: a grey wave, no gold.
    h.inject([{ type: 'silenceBroken', tick: sim.tick, boss: boss.id, notes: 3 } as SimEvent]);
    expect(h.feedback.firedFinale.codas).toBe(1);
  });
});

describe('Review fixes (the answered victim, the slow windup, the marks, Fermata, the orrery at full)', () => {
  /** A Discord-fed blow on three heroes: the telegraph's resolutions and its discordRose. */
  const shatter = (sim: Sim, boss: Entity, telegraph: number, failed?: number[]) => {
    const ev: SimEvent[] = [];
    for (const target of sim.state.party)
      ev.push({
        type: 'telegraphResolved',
        tick: sim.tick,
        telegraph,
        target,
        outcome: 'hit',
        damage: 250,
      } as SimEvent);
    ev.push({
      type: 'discordRose',
      tick: sim.tick,
      boss: boss.id,
      telegraph,
      amount: 20,
      value: 60,
      ...(failed ? { failed } : {}),
    } as SimEvent);
    return ev;
  };

  it('Discord: no streak from a victim the verdict counts as answered, inside a failed telegraph', () => {
    const { sim, h, boss } = finaleScene();
    stage(sim, { discord: { value: 40, rate: 0.5 } });
    const [a, b, c] = sim.state.party as [number, number, number];
    // The sim names the failed victims: only they streak.
    h.inject(shatter(sim, boss, 5001, [b, c]));
    expect(h.feedback.firedFinale.discordStreaks).toBe(1);
    expect(h.feedback.firedFinale.discordBeams).toBe(2);
    expect(h.feedback.crucible.failedVictims({ failed: [b, c] } as never)).toEqual([b, c]);
    // Without the list, render reads the batch: a partial Ward (shield absorbed part of it), a
    // Bear-borne blow and a save are answered; the clean hit alone streaks.
    const ev = shatter(sim, boss, 5002);
    ev.unshift(
      {
        type: 'damageTaken',
        tick: sim.tick,
        target: a,
        source: boss.id,
        amount: 120,
        absorbed: 130,
        amplified: 0,
        aura: 0,
        radiance: 0,
        eclipse: 0,
        crit: false,
        telegraph: 5002,
        hit: 'hit',
      } as SimEvent,
      { type: 'borne', tick: sim.tick, hero: b, amount: 90, via: 'bear' } as SimEvent,
    );
    h.inject(ev);
    expect(h.feedback.firedFinale.discordStreaks).toBe(2);
    expect(h.feedback.firedFinale.discordBeams).toBe(3);
    const saved = shatter(sim, boss, 5003);
    saved.splice(saved.length - 1, 0, {
      type: 'save',
      tick: sim.tick,
      target: c,
      cause: 'fermata',
      counterfactualDamage: 400,
      attack: 'Shatter Aria',
    } as SimEvent);
    h.inject(saved);
    // a and b were clean this time; c was saved.
    expect(h.feedback.firedFinale.discordBeams).toBe(5);
    // A live Aegis Link (a Ward variant shared it) answers its members; once it lapses, it doesn't.
    const linked = shatter(sim, boss, 5004);
    linked.unshift({
      type: 'linked',
      tick: sim.tick,
      a,
      b,
      weaver: false,
      until: sim.state.time + 5,
    } as SimEvent);
    h.inject(linked);
    // c alone streaks.
    expect(h.feedback.firedFinale.discordBeams).toBe(6);
    h.run(6 * 60);
    h.inject(shatter(sim, boss, 5005));
    expect(h.feedback.firedFinale.discordBeams).toBe(9);
  });

  it('Fortissimo: the winding pip fills over the whole windup, however long the assists make it', () => {
    const { sim, h } = finaleScene();
    // telegraphLead 1.5: pulse 1 lands 4.5 s after it starts.
    const f = stage(sim, { fortissimo: { pulse: 1, impact: sim.state.time + 4.5 } });
    h.run(90);
    expect(h.feedback.crucible.pulseFill).toBeGreaterThan(0.3);
    expect(h.feedback.crucible.pulseFill).toBeLessThan(0.37);
    h.run(90);
    expect(h.feedback.crucible.pulseFill).toBeCloseTo(2 / 3, 1);
    // Short Fuse: a 1.2 s pulse 2 is full at its own impact, half way at half of it.
    f.fortissimo = { pulse: 2, impact: sim.state.time + 1.2 };
    h.run(36);
    expect(h.feedback.crucible.pulseFill).toBeCloseTo(0.5, 1);
    // A held windup (Stasis pushes the impact on) holds the pip; it never runs backwards.
    const held = h.feedback.crucible.pulseFill;
    for (let i = 0; i < 30; i++) {
      f.fortissimo.impact += 1 / 60;
      h.tick();
    }
    expect(h.feedback.crucible.pulseFill).toBeCloseTo(held, 2);
  });

  it('the silence marks the disc in slate, never in the ash, the key light or the glass', () => {
    const { sim, h, boss } = finaleScene();
    const banned = new Set(CRUCIBLE_UNMARKED.map((k) => new THREE.Color(CRUCIBLE_HEX[k]).getHex()));
    const stave = new THREE.Color(CRUCIBLE_HEX.stave).getHex();
    const seen: number[] = [];
    const spy = (o: { push: (...a: never[]) => void }) => {
      const push = o.push.bind(o);
      o.push = (...args: never[]) => {
        for (const v of args as unknown[]) if (v instanceof THREE.Color) seen.push(v.getHex());
        push(...args);
      };
    };
    spy(h.kit.rings as never);
    spy(h.kit.beams as never);
    stage(sim, {
      silence: { notes: 2, of: 8, since: sim.state.time, until: sim.state.time + 50, sources: [] },
    });
    for (let s = 0; s < sim.state.party.length; s++) giveStatus(hero(sim, s), { id: 'stilled' });
    h.inject([{ type: 'silenceBegan', tick: sim.tick, boss: boss.id, until: 50 } as SimEvent]);
    h.run(30);
    expect(h.feedback.drawnFinale.stilledStaves).toBe(sim.state.party.length);
    expect(h.feedback.drawnFinale.halo).toBe(1);
    delete worldOf(sim).field.finale!.silence;
    h.inject([{ type: 'silenceBroken', tick: sim.tick, boss: boss.id, notes: 2 } as SimEvent]);
    h.run(10);
    asGlass('the_hollow_cantor', () =>
      h.inject([
        {
          type: 'enemyKilled',
          tick: sim.tick,
          enemy: boss.id,
          defId: 'the_hollow_cantor',
          x: boss.x,
          z: boss.z,
        } as SimEvent,
      ]),
    );
    h.run(10);
    expect(h.feedback.firedFinale.glassDeaths).toBe(1);
    expect(seen).toContain(stave);
    for (const hex of seen) expect(banned.has(hex), `#${hex.toString(16)}`).toBe(false);
  });

  it('a stilled hero Fermata holds keeps Fermata’s lavender rim and tremor', () => {
    const { sim, h } = finaleScene();
    stage(sim, {
      silence: { notes: 0, of: 8, since: sim.state.time, until: sim.state.time + 50, sources: [] },
    });
    for (let s = 0; s < sim.state.party.length; s++) giveStatus(hero(sim, s), { id: 'stilled' });
    giveStatus(hero(sim, 0), { id: 'held' });
    const fermata = new THREE.Color('#e2d6f8').getHex();
    const rims = new Map<number, number[]>();
    for (const id of sim.state.party.slice(0, 2)) {
      const rec = h.entities.recs.get(id)!;
      const push = rec.batch.push.bind(rec.batch);
      rec.batch.push = (...args: Parameters<typeof push>) => {
        rims.set(id, [args[5].getHex(), args[6], args[0].elements[12]!]);
        push(...args);
      };
    }
    const xs: number[] = [];
    for (let i = 0; i < 6; i++) {
      h.run(1);
      xs.push(rims.get(sim.state.party[0]!)![2]!);
    }
    expect(h.entities.drawnFinale.stilled).toBe(sim.state.party.length);
    // Held and stilled: Fermata's rim, its tremor.
    expect(rims.get(sim.state.party[0]!)![0]).toBe(fermata);
    expect(rims.get(sim.state.party[0]!)![1]).toBeGreaterThan(0.7);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(0.001);
    // Stilled alone: no Fermata rim.
    expect(rims.get(sim.state.party[1]!)![0]).not.toBe(fermata);
  });

  it('Reignite holds the orrery at full, then gives it back to the stems', () => {
    const { sim, h, boss } = finaleScene();
    const f = stage(sim, {
      silence: { notes: 8, of: 8, since: sim.state.time, until: sim.state.time + 50, sources: [] },
    });
    h.run(2);
    expect(h.feedback.crucible.orreryFull).toBe(0);
    delete f.silence;
    h.inject([{ type: 'reignited', tick: sim.tick, boss: boss.id, revived: [] } as SimEvent]);
    expect(h.feedback.crucible.orreryFull).toBe(1);
    const sky = emptySky();
    // No music, phase 3 (no Discord): the stems alone would leave every ring under full.
    crucibleSky(f, undefined, sim.state.time, sky);
    expect(Math.min(...sky.stems)).toBeLessThan(0.9);
    crucibleSky(f, undefined, sim.state.time, sky, h.feedback.crucible.orreryFull);
    expect(sky.notes).toBe(-1);
    expect(sky.stems).toEqual([1, 1, 1, 1]);
    const a = buildArena(CRUCIBLE_ARENA_STAND_IN);
    a.view.update(1, 600, 'high', sky);
    expect([...a.view.sky.stems]).toEqual([1, 1, 1, 1]);
    // Still full through the canon, then back to the music's levels.
    h.run(180);
    expect(h.feedback.crucible.orreryFull).toBe(1);
    h.run(300);
    expect(h.feedback.crucible.orreryFull).toBe(0);
    crucibleSky(f, undefined, sim.state.time, sky, h.feedback.crucible.orreryFull);
    expect(Math.min(...sky.stems)).toBeLessThan(0.9);
  });
});

describe('The budget', () => {
  for (const tier of ['low', 'medium', 'high'] as const) {
    it(`no FX batch growth, every peak under capacity in a busy Finale scene (${tier})`, () => {
      const sim = sandbox();
      const h = harness(sim);
      h.kit.setQuality(tier);
      const batches = h.kit.group.children.length;
      expect(batches).toBe(12);
      h.run(2, [
        spawn('the_hollow_cantor', 0, -12),
        spawn('hollow_chorister', -6, -8),
        spawn('hollow_chorister', 6, -8),
        spawn('hollow_chorister', -3, -5),
        spawn('hollow_chorister', 3, -5),
        { t: 'thread', slot: 0 },
      ]);
      tough(sim);
      const boss = newest(sim, 'the_hollow_cantor');
      const voices = worldOf(sim)
        .entities.list()
        .filter((e) => e.enemy?.defId === 'hollow_chorister');
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
      const sample = (n: { counts: typeof peak } | typeof peak) => {
        const c = 'counts' in n ? n.counts : n;
        for (const k of Object.keys(peak) as (keyof typeof peak)[])
          peak[k] = Math.max(peak[k], c[k]);
        particles = Math.max(particles, h.kit.particles.alive);
      };
      // Phase 2's peak: a Cue in flight, Discord feeding off every hero, Fortissimo winding up.
      stage(sim, {
        discord: { value: 96, rate: 1 },
        cue: { boss: boss.id, soloist: voices[0]!.id, solo: 'bass_ostinato', until: 999 },
        fortissimo: { pulse: 2, impact: sim.state.time + 1.5 },
      });
      for (let i = 0; i < 45; i++) {
        const ev: SimEvent[] = [];
        if (i % 3 === 0)
          for (const target of sim.state.party)
            ev.push(
              {
                type: 'telegraphResolved',
                tick: sim.tick,
                telegraph: 9000 + i,
                target,
                outcome: 'hit',
                damage: 200,
              } as SimEvent,
              {
                type: 'discordRose',
                tick: sim.tick,
                boss: boss.id,
                telegraph: 9000 + i,
                amount: 8,
                value: 99,
              } as SimEvent,
            );
        sample(h.inject(ev));
        sample(h.tick());
      }
      // The silence's peak: every hero stilled, eight notes in a burst, Reignite, glass deaths.
      stage(sim, {
        silence: { notes: 0, of: 8, since: sim.state.time, until: 999, sources: [] },
      });
      for (let s = 0; s < sim.state.party.length; s++) giveStatus(hero(sim, s), { id: 'stilled' });
      for (let n = 1; n <= NOTES_NEEDED; n++) {
        sample(
          h.inject([
            {
              type: 'silenceNote',
              tick: sim.tick,
              n,
              of: 8,
              source: 'perfect',
              hero: sim.state.party[n % 3]!,
            } as SimEvent,
          ]),
        );
        sample(h.tick());
      }
      sample(
        h.inject([
          {
            type: 'reignited',
            tick: sim.tick,
            boss: boss.id,
            revived: [...sim.state.party],
          } as SimEvent,
        ]),
      );
      asGlass('hollow_chorister', () => {
        for (const v of voices)
          sample(
            h.inject([
              {
                type: 'enemyKilled',
                tick: sim.tick,
                enemy: v.id,
                defId: 'hollow_chorister',
                x: v.x,
                z: v.z,
              } as SimEvent,
            ]),
          );
      });
      for (let i = 0; i < 60; i++) sample(h.tick());
      const fired = h.feedback.firedFinale;
      expect(fired.discordStreaks).toBeGreaterThan(10);
      expect(fired.notes).toBe(NOTES_NEEDED);
      expect(fired.glassDeaths).toBe(voices.length);
      expect(h.kit.group.children.length).toBe(batches);
      expect(peak.rings).toBeLessThan(384);
      expect(peak.sprites).toBeLessThan(256);
      expect(peak.spritesTop).toBeLessThan(48);
      expect(peak.beams).toBeLessThan(160);
      expect(peak.shells).toBeLessThan(64);
      expect(peak.telegraphs).toBeLessThan(96);
      expect(peak.marks).toBeLessThan(24);
      expect(particles).toBeLessThanOrEqual(PARTICLE_CAPS[tier].add);
      delete worldOf(sim).field.finale;
    });
  }
});
