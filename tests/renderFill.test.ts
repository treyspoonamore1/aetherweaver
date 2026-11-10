/**
 * Phase 5g VFX (docs/phase-5g.md, W9): the content fill in the world. The fill's entries are not
 * in this tree yet, so every check drives the real sim and the real EntityLayer, ThreadView and
 * FxKit, and stages what the fill would do: synthetic `motifTriggered` and `needled` events,
 * and Razor Silk's state (`mods.razorDps`, its clock `world.internal.razorAt`) written into the
 * world. Covered: a cue for every trigger effect kind on its target (or at the Weaver), the merge
 * of a fast trigger, the Needle's catch, Razor Silk's contact and bites, the Flashes setting,
 * nothing drawn or allocated without the fill, and no new draw call.
 */
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { CONTENT } from '../src/content';
import { EntityLayer } from '../src/render/entities';
import { CUE_LOOK, FILL_POOL, FillView, MERGE } from '../src/render/fill';
import {
  TRIGGER_EFFECT_KINDS,
  TRIGGER_KINDS,
  razorOn,
  razorTicked,
  triggerCue,
  type TriggerCue,
} from '../src/render/fillCues';
import { FxKit } from '../src/render/fx/kit';
import { createModelMaterial } from '../src/render/models/material';
import { C } from '../src/render/palette';
import { ThreadView } from '../src/render/thread';
import type { FrameInfo } from '../src/render/types';
import type { Command, EntityId, Sim, SimEvent } from '../src/sim';
import { RAZOR_TICK } from '../src/sim/fill/silk';
import { onThread } from '../src/sim/fill/threadContact';
import { sandbox, spawn, worldOf } from './sim/helpers';

const SETTINGS: FrameInfo['settings'] = {
  screenShake: 1,
  flashes: 1,
  damageNumbers: true,
  colorVision: 'normal',
};

/** The doc's tables: every entry built as a trigger, by the effect its Sim column names. */
const DOC_TRIGGERS: Record<string, TriggerCue> = {
  whiplash: 'damage',
  stray_stitch: 'heal',
  spindle_turn: 'spirit',
  kindred_wound: 'heal',
  shatterglass: 'damage',
  sister_ward: 'barrier',
  clean_strike: 'spirit',
  clutch_peal: 'resonance',
  bright_peal: 'barrier',
  safe_harbour: 'barrier',
  light_step: 'heal',
  second_toll: 'cooldown',
  tender_guard: 'heal',
  penitent_shield: 'heal',
  iron_answer: 'ability',
  steady_draw: 'ability',
  bloodsong: 'heal',
  second_intention: 'barrier',
  seed_vault: 'barrier',
  call_and_response: 'empower',
  taking_bows: 'solo',
  ringing_on: 'crescendo',
  saving_grace: 'resonance',
  laments_answer: 'solo',
  footlights: 'barrier',
  fanfare: 'barrier',
  answering_phrase: 'resonance',
  guardians_cadence: 'damage',
  crossed_steel: 'cooldown',
  pilgrims_lamp: 'barrier',
  black_ribbon: 'heal',
  echoing_shell: 'solo',
  lament_pin: 'resonance',
  sand_glass: 'cooldown',
  bell_clapper: 'status',
  heartwood_lute: 'solo',
  red_ink: 'resonance',
};

const sourceOf = (kind: TriggerCue): string =>
  Object.keys(TRIGGER_KINDS).find((id) => TRIGGER_KINDS[id] === kind) ?? 'nobody_names_this';
/** The kinds whose effect lands on an enemy (the rest that land, on a hero). */
const ON_ENEMY: readonly TriggerCue[] = ['damage', 'status'];

const trig = (source: string, target?: EntityId): SimEvent =>
  ({
    type: 'motifTriggered',
    tick: 0,
    source,
    ...(target !== undefined ? { target } : {}),
  }) as SimEvent;
const needled = (hero: EntityId): SimEvent =>
  ({ type: 'needled', tick: 0, hero, telegraph: 1, negated: 40 }) as SimEvent;

/** The real views a fill cue needs, over a real FxKit, driven by a real sim (a tick a frame). */
function harness(sim: Sim) {
  const kit = new FxKit();
  const entities = new EntityLayer(createModelMaterial());
  const thread = new ThreadView(entities, null);
  const view = new FillView({ kit, recs: entities.recs, thread });
  const cam = new THREE.Vector3(0, 22, 18);
  let time = 0;
  /** One frame: `extra` events (the fill's, staged) handed to the view with the sim's. */
  const tick = (
    commands: Command[] = [],
    extra: SimEvent[] = [],
    flashes = 1,
    before?: () => void,
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
    const was = {
      rings: kit.rings.size,
      sprites: kit.sprites.size,
      ribbons: kit.ribbons.vertices,
    };
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
  const run = (ticks: number, commands: Command[] = []) => {
    for (let i = 0; i < ticks; i++) tick(i === 0 ? commands : []);
  };
  return { kit, entities, thread, view, tick, run };
}

/** A sandbox fight, its first half second played, with an enemy standing off to the side. */
function setup() {
  const sim = sandbox();
  const h = harness(sim);
  h.run(30, [spawn('hollow_chorister', 6, -6)]);
  const w = worldOf(sim);
  const enemy = w.entities.list().find((e) => e.enemy)!;
  return { sim, h, w, enemy };
}

describe('which cue a trigger plays', () => {
  it('the table is the doc’s: every trigger entry, by the effect it applies', () => {
    expect(TRIGGER_KINDS).toEqual(DOC_TRIGGERS);
    for (const [id, kind] of Object.entries(DOC_TRIGGERS)) expect(triggerCue(id), id).toBe(kind);
  });

  it('every effect kind the schema has is applied by some entry, and each has its own look', () => {
    expect(new Set(Object.values(TRIGGER_KINDS))).toEqual(new Set(TRIGGER_EFFECT_KINDS));
    const looks = new Set(
      [...TRIGGER_EFFECT_KINDS, 'generic' as const].map((k) => {
        const l = CUE_LOOK[k];
        return `${l.colour}|${l.shape}|${l.at}`;
      }),
    );
    expect(looks.size).toBe(TRIGGER_EFFECT_KINDS.length + 1);
  });

  it('an id the tables don’t name is read from its content; an unknown one is generic', () => {
    expect(triggerCue('no_such_source')).toBe('generic');
    const fixture = {
      ...CONTENT.motifs[0]!,
      id: 'w9_fixture_motif',
      triggers: [{ on: 'perfectWard', effects: [{ kind: 'spirit', amount: 3 }] }],
    };
    (CONTENT.motifs as unknown as object[]).push(fixture);
    try {
      expect(triggerCue('w9_fixture_motif')).toBe('spirit');
    } finally {
      (CONTENT.motifs as unknown as object[]).pop();
    }
  });

  it('agrees with every trigger content holds (vacuous until the fill merges)', () => {
    for (const list of [CONTENT.motifs, CONTENT.relics, CONTENT.boons]) {
      for (const def of list as readonly {
        id: string;
        triggers?: readonly { effects: readonly { kind: string }[] }[];
      }[]) {
        const first = def.triggers?.[0]?.effects[0]?.kind;
        if (first) expect(triggerCue(def.id), def.id).toBe(first);
      }
    }
  });
});

describe('a trigger firing, drawn', () => {
  for (const kind of [...TRIGGER_EFFECT_KINDS, 'generic' as const]) {
    it(`${kind}: its cue, ${CUE_LOOK[kind].at === 'weaver' ? 'at the Weaver' : 'on its target'}`, () => {
      const { sim, h, enemy } = setup();
      const hero = sim.state.party[1]!;
      const target = ON_ENEMY.includes(kind) ? enemy.id : hero;
      const f = h.tick([], [trig(sourceOf(kind), target)]);
      expect(h.view.firedBy[kind]).toBe(1);
      expect(h.view.fired.triggers).toBe(1);
      expect(f.drawn[kind]).toBe(1);
      expect(f.mine.rings + f.mine.sprites + f.mine.ribbons).toBeGreaterThan(0);
      const on = CUE_LOOK[kind].at === 'weaver' ? sim.state.weaverId : target;
      expect(h.view.targetsOf(kind)).toEqual([on]);
      // It plays out and is gone within a second.
      for (let i = 0; i < 60; i++) h.tick();
      expect(h.view.activeCount()).toBe(0);
      expect(h.tick().drawn[kind]).toBe(0);
    });
  }

  it('one that lands on someone and has no target (nothing in reach) draws nothing', () => {
    const { h } = setup();
    for (const kind of TRIGGER_EFFECT_KINDS) {
      if (CUE_LOOK[kind].at === 'weaver') continue;
      const f = h.tick([], [trig(sourceOf(kind))]);
      expect(f.drawn[kind], kind).toBe(0);
    }
    expect(h.view.fired.triggers).toBe(0);
    expect(h.view.fired.unseen).toBe(7);
    // The ones that land on no one are drawn at the Weaver either way.
    const f = h.tick(
      [],
      [trig('clutch_peal'), trig('spindle_turn'), trig('sand_glass'), trig('ringing_on')],
    );
    expect(f.drawn.resonance + f.drawn.spirit + f.drawn.cooldown + f.drawn.crescendo).toBe(4);
  });

  it('a fast trigger plays one cue: the same source on the same target within MERGE', () => {
    const { sim, h } = setup();
    const [a, b, c] = sim.state.party;
    h.tick([], [trig('bright_peal', a), trig('bright_peal', a), trig('bright_peal', b)]);
    expect(h.view.fired.triggers).toBe(2);
    expect(h.view.fired.merged).toBe(1);
    expect(h.view.activeCount('barrier')).toBe(2);
    // Another source on the same hero is its own cue.
    h.tick([], [trig('sister_ward', a)]);
    expect(h.view.fired.triggers).toBe(3);
    // The same again, once MERGE has passed, is a new cue.
    for (let t = 0; t < MERGE * 60 + 1; t++) h.tick();
    h.tick([], [trig('bright_peal', a), trig('bright_peal', c)]);
    expect(h.view.fired.triggers).toBe(5);
    expect(h.view.fired.merged).toBe(1);
  });

  it('a storm of triggers stays inside the pool and the batches’ room', () => {
    const { sim, h, enemy } = setup();
    let most = { rings: 0, sprites: 0, ribbons: 0 };
    for (let i = 0; i < 90; i++) {
      const extra: SimEvent[] = [];
      for (const kind of TRIGGER_EFFECT_KINDS)
        for (const id of sim.state.party)
          extra.push(trig(sourceOf(kind), ON_ENEMY.includes(kind) ? enemy.id : id));
      for (const id of sim.state.party) extra.push(needled(id));
      const f = h.tick([], i % 10 === 0 ? extra : []);
      expect(h.view.activeCount()).toBeLessThanOrEqual(FILL_POOL);
      most = {
        rings: Math.max(most.rings, f.mine.rings),
        sprites: Math.max(most.sprites, f.mine.sprites),
        ribbons: Math.max(most.ribbons, f.mine.ribbons),
      };
    }
    expect(most.rings).toBeLessThan(48);
    expect(most.sprites).toBeLessThan(64);
    expect(most.ribbons).toBeLessThan(400);
  });
});

describe('Thread the Needle’s catch', () => {
  it('a stitch drawn round the hero by a needle, pulled tight at their feet', () => {
    const { sim, h } = setup();
    const lyra = sim.state.party[1]!;
    let ribbons = 0;
    let sprites = 0;
    let frames = 0;
    const first = h.tick([], [needled(lyra)]);
    expect(h.view.fired.needles).toBe(1);
    expect(h.view.targetsOf('needle')).toEqual([lyra]);
    expect(first.drawn.needles).toBe(1);
    for (let i = 0; i < 60; i++) {
      const f = h.tick();
      ribbons += f.mine.ribbons;
      sprites += f.mine.sprites;
      if (f.drawn.needles > 0) frames++;
    }
    expect(ribbons).toBeGreaterThan(0);
    expect(sprites).toBeGreaterThan(0);
    // It lasts about three quarters of a second, then nothing.
    expect(frames).toBeGreaterThan(30);
    expect(frames).toBeLessThan(50);
    expect(h.view.activeCount()).toBe(0);
  });
});

/** Razor Silk staged: the Thread on Kael, one enemy standing on it and one off it. */
function razorSetup() {
  const sim = sandbox();
  const h = harness(sim);
  h.run(10, [{ t: 'thread', slot: 0 }]);
  h.run(10, [spawn('hollow_chorister', 0, 0)]);
  h.run(10, [spawn('hollow_chorister', 0, 0)]);
  const w = worldOf(sim);
  const [on, off] = w.entities.list().filter((e) => e.enemy);
  const me = w.entities.get(w.weaverId)!;
  const kael = w.entities.get(w.party[0]!)!;
  /** Holds the two in place: one on the Thread's middle, one well off to its side. */
  const place = () => {
    on!.x = (me.x + kael.x) / 2;
    on!.z = (me.z + kael.z) / 2;
    off!.x = me.x + 8;
    off!.z = me.z + 8;
    // They stand there all through (the heroes would kill them in a few seconds).
    on!.health!.hp = on!.health!.maxHp;
    off!.health!.hp = off!.health!.maxHp;
  };
  const frame = (extra: SimEvent[] = [], flashes = 1) => h.tick([], extra, flashes, place);
  return { sim, h, w, on: on!, off: off!, place, frame };
}

describe('Razor Silk', () => {
  it('reads the sim’s own contact test; off without Razor Silk or without the Thread', () => {
    const { sim, w, on, off, place, frame } = razorSetup();
    place();
    expect(onThread(sim.state, on)).toBe(true);
    expect(onThread(sim.state, off)).toBe(false);
    expect(razorOn(sim.state)).toBe(false);
    w.mods.razorDps = 30;
    expect(razorOn(sim.state)).toBe(true);
    expect(razorTicked(undefined, undefined)).toBe(false);
    // The clock starting deals nothing (the sim's first tick waits one RAZOR_TICK).
    expect(razorTicked(undefined, 1)).toBe(false);
    expect(razorTicked(1, 1)).toBe(false);
    // A tick moves it on by exactly one RAZOR_TICK.
    expect(razorTicked(1, 1 + RAZOR_TICK)).toBe(true);
    expect(razorTicked(1.5, 1)).toBe(false);
    // A fresh start after the Thread was off (more than a tick on) is no tick.
    expect(razorTicked(1, 4)).toBe(false);
    void frame;
  });

  it('a glint where the Thread crosses each enemy it touches, every frame it is held', () => {
    const { h, w, frame } = razorSetup();
    expect(frame().drawn.contacts).toBe(0);
    w.mods.razorDps = 30;
    for (let i = 0; i < 20; i++) {
      const f = frame();
      expect(f.drawn.contacts).toBe(1);
      expect(f.mine.sprites).toBeGreaterThanOrEqual(2);
    }
    // Its clock has started, but its first damage waits a whole tick: no bite yet.
    expect(w.internal.razorAt).toBeDefined();
    expect(h.view.fired.bites).toBe(0);
    // The Thread let go: no contact.
    w.entities.get(w.weaverId)!.weaver!.threadSlot = null;
    expect(frame().drawn.contacts).toBe(0);
  });

  it('bites each enemy it touches each time its damage ticks (its clock moves on), only then', () => {
    const { h, w, on, frame } = razorSetup();
    w.mods.razorDps = 30;
    /** The frames Razor Silk's damage landed on `on`, and the frames a bite was drawn. */
    const ticks: number[] = [];
    const bites: number[] = [];
    for (let i = 0; i < 130; i++) {
      const before = h.view.fired.bites;
      const f = frame();
      const cut = f.events.some(
        (e) => e.type === 'damageTaken' && e.source === w.weaverId && e.target === on.id,
      );
      if (cut) ticks.push(i);
      if (h.view.fired.bites > before) {
        bites.push(i);
        expect(h.view.targetsOf('bite').at(-1)).toBe(on.id);
        expect(f.drawn.bites).toBeGreaterThanOrEqual(1);
      }
    }
    // Every 0.5 s from the clock's start a half second in: four ticks in 130 frames, each bitten.
    expect(ticks).toHaveLength(4);
    expect(bites).toEqual(ticks);
    // A clock moved by less than a tick (no damage) is no bite.
    w.internal.razorAt = (w.internal.razorAt ?? 0) + 1 / 60;
    const n = h.view.fired.bites;
    frame();
    expect(h.view.fired.bites).toBe(n);
    // Gone from the world without Razor Silk, even with its clock moving and an enemy on the Thread.
    w.mods.razorDps = 0;
    w.internal.razorAt = (w.internal.razorAt ?? 0) + 0.5;
    const g = frame();
    expect(h.view.fired.bites).toBe(n);
    expect(g.drawn.contacts).toBe(0);
  });

  it('Flashes 0 dims its glow but draws the same', () => {
    const { w, frame } = razorSetup();
    w.mods.razorDps = 30;
    const a = frame([], 1);
    const b = frame([], 0);
    expect(b.drawn.contacts).toBe(a.drawn.contacts);
    expect(b.mine.sprites).toBe(a.mine.sprites);
  });
});

describe('settings and colour', () => {
  it('every cue draws the same at Flashes 0', () => {
    const { sim, h, enemy } = setup();
    const extra = (): SimEvent[] => [
      ...TRIGGER_EFFECT_KINDS.map((k) =>
        trig(sourceOf(k), ON_ENEMY.includes(k) ? enemy.id : sim.state.party[0]),
      ),
      needled(sim.state.party[1]!),
    ];
    const on = h.tick([], extra(), 1).drawn;
    for (let i = 0; i < 60; i++) h.tick();
    const off = h.tick([], extra(), 0).drawn;
    expect(off).toEqual(on);
  });

  it('wears only the game’s own colours: no new colour, none of its own', () => {
    const src = readFileSync(new URL('../src/render/fill.ts', import.meta.url), 'utf8');
    expect(src).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(src).not.toMatch(/new THREE\.Color|\bcolor\(/);
    for (const k of Object.keys(CUE_LOOK) as TriggerCue[])
      expect(C[CUE_LOOK[k].colour], k).toBeInstanceOf(THREE.Color);
  });
});

describe('nothing without the fill', () => {
  it('a fight without it draws nothing of it and allocates nothing', () => {
    const sim = sandbox();
    const h = harness(sim);
    h.run(10, [{ t: 'thread', slot: 0 }]);
    h.run(10, [spawn('hollow_chorister', 0, 0)]);
    for (let i = 0; i < 120; i++) {
      const f = h.tick(i === 30 ? [{ t: 'tech', id: 'ward', slot: 0 }] : []);
      expect(f.mine).toEqual({ rings: 0, sprites: 0, ribbons: 0 });
      expect(Object.values(f.drawn).every((n) => n === 0)).toBe(true);
    }
    expect(h.view.allocated).toBe(false);
    expect(Object.values(h.view.fired).every((n) => n === 0)).toBe(true);
    // A Razor clock without Razor Silk (it can't be, but): still nothing.
    worldOf(sim).internal.razorAt = 5;
    expect(h.tick().mine).toEqual({ rings: 0, sprites: 0, ribbons: 0 });
    expect(h.view.allocated).toBe(false);
  });
});

describe('no new draw calls', () => {
  it('every cue draws through the same FX batches and model batches as a fight without it', () => {
    const batches = (fill: boolean) => {
      const { sim, h, w, frame } = razorSetup();
      if (fill) w.mods.razorDps = 30;
      for (let i = 0; i < 60; i++) {
        if (fill && i % 30 === 0) w.internal.razorAt = w.time + 0.5;
        const extra: SimEvent[] = fill
          ? [
              ...TRIGGER_EFFECT_KINDS.map((k) => trig(sourceOf(k), sim.state.party[0])),
              needled(sim.state.party[1]!),
            ]
          : [];
        frame(i % 20 === 0 ? extra : []);
      }
      if (fill) expect(h.view.allocated).toBe(true);
      const materials = new Set(
        [...h.kit.group.children, ...h.entities.group.children].map(
          (o) => (o as THREE.Mesh).material,
        ),
      ).size;
      return {
        fx: h.kit.group.children.length,
        models: h.entities.group.children.length,
        types: h.kit.group.children.map((c) => c.type),
        materials,
      };
    };
    expect(batches(true)).toEqual(batches(false));
    // FillView owns no scene object: it only pushes into the kit's batches.
    const view = new FillView({ kit: new FxKit(), recs: new Map(), thread: null });
    view.handle([trig('fanfare', 1)], sandbox().state);
    expect(Object.values(view).some((v) => v instanceof THREE.Object3D)).toBe(false);
  });
});
