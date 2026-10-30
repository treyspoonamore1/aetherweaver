/**
 * Phase 4f VFX: the Weaver's technique variants in the fight (docs/phase-4f.md,
 * docs/phase-4f/vfx-audio.md). Every check drives the real sim with variants (configs as in
 * tests/sim/variants.test.ts) and feeds its state and events to the real EntityLayer and
 * VariantsView over a real FxKit: a look for every variant the sim casts, each in its slot's
 * colour; what lasts (a link, a guard, a hold, the decoy, Chorale's barriers, Skate's charges) for
 * exactly as long as the state says; every number the content's; the lab's scenarios staged in
 * Node through the same code; the same batches and draw calls as without variants.
 */
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { COLOR_VISIONS, deltaE, simulateVision, visionPalette } from '../src/app/colorVision';
import { CONTENT } from '../src/content';
import {
  createSim,
  type Command,
  type Sim,
  type SimConfig,
  type SimEvent,
  type WorldState,
} from '../src/sim';
import { addStatus, dealDamage, hasStatus } from '../src/sim/combat/health';
import type { Entity } from '../src/sim/state';
import { KNOWN_VARIANTS } from '../src/sim/variants';
import { EntityLayer } from '../src/render/entities';
import { FxKit } from '../src/render/fx/kit';
import { SHELL } from '../src/render/fx/shells';
import {
  VARIANT_SCENARIOS,
  VARIANT_SCENARIO_NAMES,
  scenarioConfig,
  type StageRuntime,
} from '../src/render/lab/variantScenarios';
import { createModelMaterial } from '../src/render/models/material';
import { C, applyVision, threadColor } from '../src/render/palette';
import type { FrameInfo } from '../src/render/types';
import { VariantsView } from '../src/render/variants';
import {
  CAST_MOMENT,
  MOMENT_LIFE,
  VARIANTS_HEX,
  VARIANT_IDS,
  VARIANT_MOMENTS,
  absolveSeconds,
  anchorSeconds,
  choraleLead,
  choraleLeft,
  choraleRadius,
  choraleSeconds,
  emptyVariantsLook,
  linkSeconds,
  phaseMetres,
  phaseSeconds,
  purgeRadius,
  skateCharges,
  skateMax,
  skateMetres,
  statusLeft,
  variantOf,
  variantSlot,
  variantsLook,
} from '../src/render/variantsCues';
import { ofType, sandbox, spawn, telegraphOn, worldOf } from './sim/helpers';

const SETTINGS: FrameInfo['settings'] = {
  screenShake: 1,
  flashes: 1,
  damageNumbers: true,
  colorVision: 'normal',
};
const KAEL = 0;
const LYRA = 1;
const GUARDIAN = [{ auras: ['fortissimo'] }, { auras: ['sostenuto'] }];
const variants = (techniques: SimConfig['techniques']): Partial<SimConfig> => ({ techniques });
const vv = (id: string, key: string) =>
  CONTENT.techniqueVariants.find((v) => v.id === id)?.values[key] ?? Number.NaN;

/** An overlay that records the callouts it is asked to show. */
class FakeOverlay {
  callouts: { text: string; color: string }[] = [];
  callout(_x: number, _y: number, _z: number, text: string, color: string): void {
    this.callouts.push({ text, color });
  }
}

const sameColor = (a: ArrayLike<number>, o: number, c: THREE.Color) =>
  Math.abs(a[o]! - c.r) < 1e-4 &&
  Math.abs(a[o + 1]! - c.g) < 1e-4 &&
  Math.abs(a[o + 2]! - c.b) < 1e-4;

/** The real views over a real FxKit, driven by a real sim (one sim tick, one frame). */
function harness(sim: Sim) {
  const kit = new FxKit();
  const entities = new EntityLayer(createModelMaterial());
  const overlay = new FakeOverlay();
  const view = new VariantsView({
    kit,
    recs: entities.recs,
    overlay,
    rig: { addTrauma() {} },
    models: entities,
  });
  const cam = new THREE.Vector3(0, 22, 18);
  let time = 0;
  /** What VariantsView alone pushed last frame, batch by batch: [first index, count]. */
  const own = { rings: [0, 0], sprites: [0, 0], beams: [0, 0], shells: [0, 0], ribbons: 0 };
  const tick = (commands: Command[] = [], flashes = 1) => {
    sim.step(commands);
    const ev = sim.drainEvents();
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
    const before = {
      rings: kit.rings.size,
      sprites: kit.sprites.size,
      beams: kit.beams.size,
      shells: kit.shells.size,
      ribbons: kit.ribbons.vertices,
    };
    view.sync(sim.state, 1 / 60, time, flashes);
    own.rings = [before.rings, kit.rings.size - before.rings];
    own.sprites = [before.sprites, kit.sprites.size - before.sprites];
    own.beams = [before.beams, kit.beams.size - before.beams];
    own.shells = [before.shells, kit.shells.size - before.shells];
    own.ribbons = kit.ribbons.vertices - before.ribbons;
    kit.end(1 / 60, 1280, 720, 720, 45);
    time += 1 / 60;
    return ev;
  };
  const run = (ticks: number, commands: Command[] = []) => {
    const seen: SimEvent[] = [];
    for (let i = 0; i < ticks; i++) seen.push(...tick(i === 0 ? commands : []));
    return seen;
  };
  const until = (pred: (ev: SimEvent[]) => boolean, max = 60 * 30) => {
    const seen: SimEvent[] = [];
    for (let i = 0; i < max; i++) {
      const ev = tick();
      seen.push(...ev);
      if (pred(ev)) return seen;
    }
    throw new Error('condition not reached');
  };
  /** Did VariantsView push something in this colour last frame (rings, sprites, beams, shells)? */
  const drewIn = (c: THREE.Color) => {
    const scan = (arr: Float32Array, [from, n]: number[]) => {
      for (let i = from!; i < from! + n!; i++) if (sameColor(arr, i * 4, c)) return true;
      return false;
    };
    return (
      scan(kit.rings.array('iColor'), own.rings) ||
      scan(kit.sprites.array('iColor'), own.sprites) ||
      scan(kit.beams.array('iColor'), own.beams) ||
      scan(kit.shells.array('iColor'), own.shells)
    );
  };
  /** How many shells of a style VariantsView pushed last frame. */
  const shellsOf = (style: number) => {
    const pos = kit.shells.array('iPos');
    let n = 0;
    for (let i = own.shells[0]!; i < own.shells[0]! + own.shells[1]!; i++)
      if (pos[i * 4 + 3] === style) n++;
    return n;
  };
  /** The instances VariantsView pushed last frame. */
  const instances = () => own.rings[1]! + own.sprites[1]! + own.beams[1]! + own.shells[1]!;
  return { kit, entities, view, overlay, tick, run, until, drewIn, shellsOf, instances, own };
}

function setup(config: Partial<SimConfig> = {}) {
  const sim = sandbox(config);
  const w = worldOf(sim);
  const of = (slot: number) => w.entities.get(w.party[slot]!)!;
  const me = w.entities.get(w.weaverId)!;
  return { sim, w, of, me, h: harness(sim) };
}

/** Enemies spawned at these points, stood up and ready (drawn as they come). */
function enemies(h: ReturnType<typeof harness>, sim: Sim, ...at: [string, number, number][]) {
  h.run(
    1,
    at.map(([id, x, z]) => spawn(id, x, z)),
  );
  h.run(60);
  return [...worldOf(sim).entities.list()].filter((e) => e.enemy && !e.health?.dead);
}
const hit = (sim: Sim, target: Entity, amount: number, source: Entity) =>
  dealDamage(worldOf(sim), target, {
    source: source.id,
    sourceName: 'test',
    amount,
    telegraph: null,
  });
const tough = (list: Entity[]) => {
  for (const e of list) if (e.health) e.health.hp = e.health.maxHp = 1e6;
};

describe('variant cues', () => {
  it('a look for every variant the sim casts, each in its slot', () => {
    expect([...VARIANT_IDS].sort()).toEqual([...KNOWN_VARIANTS].sort());
    expect([...VARIANT_IDS]).toEqual(CONTENT.techniqueVariants.map((v) => v.id));
    for (const id of VARIANT_IDS) {
      expect(variantOf(id)).toBe(id);
      expect(['ward', 'chime', 'reel', 'glide'], id).toContain(variantSlot(id));
      expect(VARIANT_MOMENTS, id).toContain(CAST_MOMENT[id]);
    }
    for (const m of VARIANT_MOMENTS) expect(MOMENT_LIFE[m], m).toBeGreaterThan(0);
    // The defaults (no variant) and unknown ids have none.
    expect(variantOf(undefined)).toBeNull();
    expect(variantOf('nope')).toBeNull();
  });

  it('every number is the content’s', () => {
    expect(choraleRadius()).toBe(vv('chorale', 'radius'));
    expect(choraleSeconds()).toBe(vv('chorale', 'seconds'));
    expect(linkSeconds()).toBe(vv('aegis_link', 'seconds'));
    expect(purgeRadius()).toBe(vv('purge', 'radius'));
    expect(absolveSeconds()).toBe(vv('absolve', 'seconds'));
    expect(anchorSeconds()).toBe(vv('anchor', 'seconds'));
    expect(phaseMetres()).toBe(vv('phase_step', 'metres'));
    expect(phaseSeconds()).toBe(vv('phase_step', 'seconds'));
    expect(skateMax()).toBe(vv('skate', 'charges'));
    expect(skateMetres()).toBe(vv('skate', 'metres'));
  });

  it('reads the state: a state without variants (an old fixture) reads as none', () => {
    const plain = setup();
    plain.sim.step([]);
    expect(variantsLook(plain.sim.state, emptyVariantsLook()).any).toBe(false);
    const all = setup(
      variants({ ward: 'aegis_link', chime: 'absolve', reel: 'anchor', glide: 'skate' }),
    );
    all.sim.step([]);
    expect(variantsLook(all.sim.state, emptyVariantsLook())).toEqual({
      any: true,
      ward: 'aegis_link',
      chime: 'absolve',
      reel: 'anchor',
      glide: 'skate',
    });
    const bare = { weaverId: 1, entities: { get: () => ({ weaver: { threadSlot: null } }) } };
    expect(variantsLook(bare as unknown as WorldState, emptyVariantsLook()).any).toBe(false);
    const out = { charges: 0, max: 0, refill: 0 };
    expect(skateCharges(bare as unknown as WorldState, out)).toBeNull();
    expect(statusLeft({ health: { statuses: [] } } as never, 'absolved')).toBe(0);
    expect(statusLeft(undefined, 'anchored')).toBe(0);
    expect(choraleLeft({ health: { shields: [] } } as never, 0)).toBe(0);
  });

  it('its own colours stay apart from danger in every colour vision', () => {
    try {
      for (const vision of COLOR_VISIONS) {
        const p = visionPalette(vision);
        const see = (hex: string) => simulateVision(hex, vision);
        for (const hex of Object.values(VARIANTS_HEX)) {
          expect(deltaE(see(hex), see(p.lethal)), `${hex} ${vision}`).toBeGreaterThanOrEqual(20);
          expect(deltaE(see(hex), see(p.threat)), `${hex} ${vision}`).toBeGreaterThanOrEqual(15);
        }
      }
    } finally {
      applyVision('normal');
    }
  });
});

describe('Ward: Chorale and Aegis Link', () => {
  it('Chorale: a burst to its reach, a barrier landing on each hero, a band while each lasts', () => {
    const { sim, h } = setup(variants({ ward: 'chorale' }));
    h.run(30);
    const ev = h.run(1, [{ t: 'tech', id: 'ward', slot: LYRA }]);
    const burst = ofType(ev, 'chorale')[0]!;
    expect(burst.radius).toBe(choraleRadius());
    expect(burst.targets.length).toBeGreaterThanOrEqual(2);
    expect(h.view.fired.chorale).toBe(1);
    expect(h.view.started.chorale).toBe(1);
    h.run(8);
    expect(h.view.drawnBy.chorale).toBe(1);
    expect(h.drewIn(C.shield)).toBe(true);
    expect(h.view.lastHex.chorale).toBe(`#${C.shield.getHexString()}`);
    // A band round each Chorale barrier, for as long as the state keeps it.
    expect(h.view.drawn.bands).toBe(burst.targets.length);
    // Only the hero you Warded wears a Ward's shell (it can turn Perfect); the plain barriers the
    // others got only absorb, and look it.
    expect(h.kit.shells.styleCount(SHELL.ward)).toBe(1);
    expect(h.kit.shells.styleCount(SHELL.barrier)).toBe(burst.targets.length - 1);
    const lyra = sim.state.entities.get(sim.state.party[LYRA]!)!;
    expect(choraleLead(lyra)).toBe(true);
    const others = burst.targets.filter((id) => id !== lyra.id);
    for (const id of others) expect(choraleLead(sim.state.entities.get(id))).toBe(false);
    h.run(Math.ceil(choraleSeconds() * 60) + 5);
    expect(h.view.drawn.bands).toBe(0);
    expect(h.view.activeCount('chorale')).toBe(0);
    expect(sim.state.time).toBeGreaterThan(choraleSeconds());
  });

  /** A Toll Cleave on Kael with Kael and Lyra side by side in it, the rest well away. */
  function cleave() {
    const { sim, telegraph: t } = telegraphOn(
      'bell_brute',
      'Toll Cleave',
      KAEL,
      2.5,
      sandbox(variants({ ward: 'chorale' })),
    );
    const h = harness(sim);
    const w = worldOf(sim);
    const heroes = w.party.map((id) => w.entities.get(id)!);
    if (t.shape.kind !== 'cone') throw new Error('a cone');
    const { x, z, dirX, dirZ } = t.shape;
    const me = w.entities.get(w.weaverId)!;
    const pin = () => {
      heroes.forEach((e, slot) => {
        const k = [KAEL, LYRA].indexOf(slot);
        e.x = k >= 0 ? x + dirX * 2.5 - dirZ * 0.4 * k : x + 30;
        e.z = k >= 0 ? z + dirZ * 2.5 + dirX * 0.4 * k : z + 30 + slot * 3;
        e.vx = e.vz = 0;
      });
      me.x = x + dirX * 2.5 + 8;
      me.z = z + dirZ * 2.5;
    };
    while (sim.state.time < t.perfectFrom + 0.05) {
      pin();
      h.tick();
    }
    pin();
    h.tick([{ t: 'tech', id: 'ward', slot: KAEL }]);
    /** Plays the cleave out; the events of the tick it lands. */
    const land = () => {
      let seen: SimEvent[] = [];
      for (let i = 0; i < 300 && !seen.some((e) => e.type === 'telegraphResolved'); i++) {
        pin();
        seen = h.tick();
      }
      return seen;
    };
    return { sim, w, h, heroes, land };
  }

  it('Chorale: only the hero you Ward turns Perfect; the plain barrier beside them absorbs', () => {
    const { h, heroes, land } = cleave();
    expect(choraleLead(heroes[KAEL])).toBe(true);
    expect(choraleLead(heroes[LYRA])).toBe(false);
    const seen = land();
    expect(ofType(seen, 'perfectWard').map((e) => e.target)).toEqual([heroes[KAEL]!.id]);
    // The ordinary Perfect: no chord.
    expect(h.view.started.chord).toBe(0);
  });

  it('Chorale: two of its Perfect barriers meeting one attack are joined in a chord, named', () => {
    const { h, w, heroes, land } = cleave();
    // Two heroes you Warded (two Chorales, Twin Aegis's second charge, far enough apart that
    // neither's burst made the other's plain), as staged here: both can turn Perfect.
    const ward = w.entities.get(w.party[LYRA]!)!.health!.shields.find((x) => x.kind === 'ward')!;
    delete ward.plain;
    expect(choraleLead(heroes[LYRA])).toBe(true);
    const seen = land();
    expect(ofType(seen, 'perfectWard')).toHaveLength(2);
    expect(h.view.started.chord).toBe(1);
    h.run(3);
    expect(h.view.drawnBy.chord).toBe(1);
    expect(h.drewIn(C.gold)).toBe(true);
    expect(h.overlay.callouts.map((c) => c.text)).toContain('CHORALE');
    h.run(90);
    expect(h.view.activeCount('chord')).toBe(0);
  });

  it('Aegis Link: a strand between the two while it holds, a bead for each hit shared', () => {
    const { sim, of, h } = setup(variants({ ward: 'aegis_link' }));
    const [brute] = enemies(h, sim, ['bell_brute', 0, -25]);
    tough([brute!]);
    h.run(1, [{ t: 'thread', slot: LYRA }]);
    const ev = h.run(1, [{ t: 'tech', id: 'ward', slot: KAEL }]);
    const linked = ofType(ev, 'linked')[0]!;
    expect([linked.a, linked.b].sort()).toEqual([of(KAEL).id, of(LYRA).id].sort());
    expect(h.view.fired.aegis_link).toBe(1);
    expect(h.view.started.link).toBe(1);
    h.run(20);
    expect(h.view.drawn.strands).toBe(1);
    expect(h.drewIn(C.shield)).toBe(true);
    // A blow on Kael is lightened and shared with Lyra: a bead runs from him to her.
    hit(sim, of(KAEL), 200, brute!);
    h.run(1);
    expect(h.view.started.share).toBe(1);
    h.run(10);
    expect(h.view.activeCount('share')).toBe(1);
    // A blow from nothing (no enemy) isn't shared, so draws none.
    dealDamage(worldOf(sim), of(LYRA), {
      source: null,
      sourceName: 'test',
      amount: 50,
      telegraph: null,
    });
    h.run(1);
    expect(h.view.started.share).toBe(1);
    // It ends with its seconds (content).
    h.run(Math.ceil(linkSeconds() * 60));
    expect(h.view.drawn.strands).toBe(0);
    expect(h.view.link.on).toBe(false);
  });

  it('Aegis Link: a hero alone (no other standing) is linked with no tether, only marked', () => {
    const { sim, of, h } = setup(variants({ ward: 'aegis_link' }));
    for (const slot of [LYRA, 2]) Object.assign(of(slot).health!, { hp: 0, dead: true });
    h.run(5);
    const ev = h.run(1, [{ t: 'tech', id: 'ward', slot: KAEL }]);
    const linked = ofType(ev, 'linked')[0]!;
    expect(linked.b).toBe(linked.a);
    h.run(20);
    expect(h.view.link.on).toBe(true);
    expect(h.view.drawn.strands).toBe(0);
    expect(h.view.drawn.members).toBe(1);
    expect(h.own.ribbons).toBe(0);
    expect(sim.state.time).toBeGreaterThan(0);
  });

  it('Aegis Link: a Perfect brings the Weaver in, her strands to both, until it ends', () => {
    const { sim, telegraph: t } = telegraphOn(
      'bell_brute',
      'Toll Cleave',
      KAEL,
      2.5,
      sandbox(variants({ ward: 'aegis_link' })),
      true,
    );
    const h = harness(sim);
    h.until(() => sim.state.time >= t.perfectFrom + 0.05);
    h.tick([{ t: 'tech', id: 'ward', slot: KAEL }]);
    h.until((ev) => ev.some((e) => e.type === 'perfectWard'), 300);
    expect(h.view.started.join).toBe(1);
    expect(h.view.link.weaver).toBe(true);
    h.run(20);
    expect(h.view.drawn.strands).toBe(3);
    expect(h.drewIn(C.gold)).toBe(true);
    h.run(Math.ceil(linkSeconds() * 60));
    expect(h.view.drawn.strands).toBe(0);
  });
});

describe('Chime: Purge and Absolve', () => {
  it('Purge: what it cleansed bursts out of the hero, a dart to each enemy it reached', () => {
    const { sim, w, of, h } = setup(variants({ chime: 'purge' }));
    const lyra = of(LYRA);
    const [brute] = enemies(h, sim, ['bell_brute', lyra.x + 2, lyra.z]);
    tough([brute!]);
    const at = { x: lyra.x, z: lyra.z };
    const pin = () => {
      lyra.x = at.x;
      lyra.z = at.z;
      brute!.x = at.x + 2;
      brute!.z = at.z;
    };
    pin();
    addStatus(w, lyra, 'silence', 3, brute!.id);
    let ev = h.tick([{ t: 'tech', id: 'chime', point: at }]);
    expect(h.view.fired.purge).toBe(1);
    // In flight, the Chime carries Purge's violet.
    expect(h.view.drawn.chimes).toBe(1);
    expect(h.drewIn(C.ailment)).toBe(true);
    for (let i = 0; i < 120 && !ev.some((e) => e.type === 'purged'); i++) {
      pin();
      ev = h.tick();
    }
    const purged = ofType(ev, 'purged')[0]!;
    expect(purged.hit).toContain(brute!.id);
    expect(purged.radius).toBe(purgeRadius());
    expect(h.view.started.purge).toBe(1);
    h.run(12);
    expect(h.view.drawnBy.purge).toBe(1);
    expect(h.drewIn(C.ailment)).toBe(true);
    expect(hasStatus(brute!, 'silence')).toBe(true);
    h.run(60);
    expect(h.view.activeCount('purge')).toBe(0);
  });

  it('Absolve: a veil of light over each hero while its guard lasts, for its seconds', () => {
    const { of, h } = setup(variants({ chime: 'absolve' }));
    h.run(20);
    const kael = of(KAEL);
    h.run(1, [{ t: 'tech', id: 'chime', point: { x: kael.x, z: kael.z } }]);
    expect(h.view.fired.absolve).toBe(1);
    expect(h.view.drawn.chimes).toBe(1);
    h.until((ev) => ev.some((e) => e.type === 'statusApplied' && e.status === 'absolved'), 120);
    expect(h.view.started.absolve).toBeGreaterThanOrEqual(1);
    h.run(20);
    expect(h.view.drawn.veils).toBeGreaterThanOrEqual(1);
    expect(h.shellsOf(SHELL.veil)).toBe(h.view.drawn.veils);
    expect(statusLeft(kael, 'absolved')).toBeGreaterThan(0);
    // It ends with the guard (content's seconds).
    h.run(Math.ceil(absolveSeconds() * 60));
    expect(statusLeft(kael, 'absolved')).toBe(0);
    expect(h.view.drawn.veils).toBe(0);
    expect(h.shellsOf(SHELL.veil)).toBe(0);
  });
});

describe('Reel: Swap and Anchor', () => {
  it('Swap: the two run round each other and trade places, in the Thread’s colour and her gold', () => {
    const { sim, of, me, h } = setup(variants({ reel: 'swap' }));
    h.run(20);
    h.run(1, [{ t: 'thread', slot: LYRA }]);
    const was = { x: me.x, z: me.z };
    const ev = h.run(1, [{ t: 'tech', id: 'reel', slot: LYRA }]);
    expect(ofType(ev, 'swapped')).toHaveLength(1);
    expect(of(LYRA).x).toBeCloseTo(was.x, 1);
    expect(h.view.fired.swap).toBe(1);
    expect(h.view.started.swap).toBe(1);
    h.run(14);
    expect(h.view.drawnBy.swap).toBe(1);
    expect(
      h.drewIn(threadColor(sim.state.entities.get(sim.state.weaverId)!.weaver!.threadMode)),
    ).toBe(true);
    expect(h.drewIn(C.gold)).toBe(true);
    h.run(60);
    expect(h.view.activeCount('swap')).toBe(0);
  });

  it('Anchor: the pillar drops; chains hold the hero while anchored, for its seconds', () => {
    const { of, h } = setup(variants({ reel: 'anchor' }));
    h.run(20);
    h.run(1, [{ t: 'thread', slot: KAEL }]);
    h.run(1, [{ t: 'tech', id: 'reel', slot: KAEL }]);
    expect(h.view.fired.anchor).toBe(1);
    expect(h.view.started.anchor).toBe(1);
    h.run(20);
    expect(h.view.drawn.holds).toBe(1);
    expect(statusLeft(of(KAEL), 'anchored')).toBeGreaterThan(0);
    h.run(Math.ceil(anchorSeconds() * 60));
    expect(statusLeft(of(KAEL), 'anchored')).toBe(0);
    expect(h.view.drawn.holds).toBe(0);
  });
});

describe('Glide: Phase Step and Skate', () => {
  it('Phase Step: the blink, and her decoy where she was until the enemies find her again', () => {
    const { sim, me, h } = setup(variants({ glide: 'phase_step' }));
    const [brute] = enemies(h, sim, ['bell_brute', me.x + 3, me.z]);
    tough([brute!]);
    brute!.enemy!.targetId = me.id;
    const from = { x: me.x, z: me.z };
    const ev = h.run(1, [{ t: 'glide', x: -1, z: 0 }]);
    const step = ofType(ev, 'phaseStep')[0]!;
    expect(Math.hypot(me.x - from.x, me.z - from.z)).toBeCloseTo(phaseMetres(), 0);
    expect(step.until - sim.state.time).toBeCloseTo(phaseSeconds(), 1);
    expect(h.view.fired.phase_step).toBe(1);
    expect(h.view.started.phase_step).toBe(1);
    h.run(5);
    expect(h.view.drawnBy.phase_step).toBe(1);
    // The decoy: her model and its ring where she was, while its seconds last.
    expect(h.entities.decoy.drawn).toBe(true);
    expect(h.entities.decoy.x).toBeCloseTo(from.x, 3);
    expect(h.view.drawn.decoy).toBe(1);
    h.until(() => sim.state.time >= step.until, 60 * 5);
    h.run(1);
    expect(h.entities.decoy.drawn).toBe(false);
    expect(h.view.drawn.decoy).toBe(0);
  });

  it('Skate: each dash marked, her charges at her feet, lit while ready, refilling', () => {
    const { sim, h } = setup(variants({ glide: 'skate' }));
    h.run(20);
    expect(h.view.drawn.charges).toBe(skateMax());
    expect(h.view.drawn.lit).toBe(skateMax());
    // Its own dash: two afterimages of her (feedback.ts leaves the Glide's five to the default).
    const k = harness(sandbox(variants({ glide: 'skate' })));
    k.run(20);
    k.run(10, [{ t: 'glide', x: 1, z: 0 }]);
    const weaver = k.entities.recs.get(k.entities.weaverId)!;
    expect(weaver.batch.pushed).toBe(3);
    let ev = h.run(30, [{ t: 'glide', x: 1, z: 0 }]);
    expect(ofType(ev, 'glided')).toHaveLength(1);
    expect(h.view.fired.skate).toBe(1);
    expect(h.view.started.skate).toBe(1);
    expect(h.view.drawn.lit).toBe(skateMax() - 1);
    ev = h.run(2, [{ t: 'glide', x: 0, z: -1 }]);
    expect(ofType(ev, 'glided')).toHaveLength(1);
    expect(h.view.started.skate).toBe(2);
    expect(h.view.drawnBy.skate).toBeGreaterThanOrEqual(1);
    expect(h.drewIn(C.gold)).toBe(true);
    expect(h.view.drawn.lit).toBe(skateMax() - 2);
    // They come back with the cooldown, one at a time.
    const w = sim.state.entities.get(sim.state.weaverId)!.weaver!;
    h.run(Math.ceil((w.cooldownTotals.glide + 0.1) * 60));
    expect(h.view.drawn.lit).toBe(w.glideCharges);
    expect(h.view.drawn.lit).toBeGreaterThanOrEqual(1);
  });
});

describe('every look', () => {
  it('nothing without variants: the defaults draw none of these', () => {
    const { of, h } = setup();
    h.run(20);
    h.run(1, [{ t: 'thread', slot: LYRA }]);
    h.run(1, [{ t: 'tech', id: 'ward', slot: KAEL }]);
    h.run(1, [{ t: 'tech', id: 'chime', point: { x: of(KAEL).x, z: of(KAEL).z } }]);
    h.run(30, [{ t: 'tech', id: 'reel', slot: LYRA }]);
    h.run(30, [{ t: 'glide', x: 1, z: 0 }]);
    for (const m of VARIANT_MOMENTS) expect(h.view.started[m], m).toBe(0);
    for (const id of VARIANT_IDS) expect(h.view.fired[id], id).toBe(0);
    expect(h.instances()).toBe(0);
    expect(h.entities.decoy.drawn).toBe(false);
  });

  it('each is drawn at Flashes 1 and at 0, in its slot’s colour', () => {
    const cases: [SimConfig['techniques'], Command[], THREE.Color][] = [
      [{ ward: 'chorale' }, [{ t: 'tech', id: 'ward', slot: LYRA }], C.shield],
      [{ reel: 'anchor' }, [{ t: 'tech', id: 'reel', slot: KAEL }], C.mend],
      [{ glide: 'phase_step' }, [{ t: 'glide', x: 1, z: 0 }], C.gold],
      [{ glide: 'skate' }, [{ t: 'glide', x: 1, z: 0 }], C.gold],
    ];
    for (const [techniques, cast, col] of cases) {
      for (const flashes of [1, 0]) {
        const { h } = setup(variants(techniques));
        h.run(20);
        h.run(1, [{ t: 'thread', slot: KAEL }]);
        h.tick(cast, flashes);
        for (let i = 0; i < 6; i++) h.tick([], flashes);
        expect(h.view.drawn.moments, `${JSON.stringify(techniques)} ${flashes}`).toBeGreaterThan(0);
        expect(h.drewIn(col), `${JSON.stringify(techniques)} ${flashes}`).toBe(true);
      }
    }
  });

  it('a moment about a hero not drawn yet waits for them; an unknown variant is ignored', () => {
    const sim = sandbox(variants({ chime: 'absolve' }));
    const h = harness(sim);
    sim.step([]);
    sim.drainEvents();
    const kael = sim.state.party[KAEL]!;
    // Before any frame: no records yet.
    h.view.handle(
      [
        { type: 'statusApplied', tick: 1, target: kael, status: 'absolved', duration: 2 },
        {
          type: 'techniqueCast',
          tick: 1,
          technique: 'ward',
          target: kael,
          x: 0,
          z: 0,
          variant: 'not_a_variant',
        },
      ],
      sim.state,
    );
    expect(h.view.started.absolve).toBe(1);
    for (const id of VARIANT_IDS) expect(h.view.fired[id]).toBe(0);
    h.run(3);
    expect(h.view.drawnBy.absolve).toBe(1);
  });

  it('a busy fight with every variant: same batches and draw calls, under 140 instances', () => {
    const count = (h: ReturnType<typeof harness>) =>
      h.kit.group.children.length + h.entities.group.children.length;
    const fight = (techniques: SimConfig['techniques']) => {
      const sim = createSim({
        seed: 5,
        encounter: 'first_light',
        chords: GUARDIAN,
        assists: { autonomy: true },
        techniques,
      });
      const h = harness(sim);
      let most = 0;
      for (let i = 0; i < 60 * 30; i++) {
        const c: Command[] = [];
        if (i === 10) c.push({ t: 'thread', slot: KAEL });
        if (i % 420 === 60) c.push({ t: 'tech', id: 'ward', slot: (i / 420) % 3 === 0 ? 0 : 1 });
        if (i % 560 === 200) {
          const k = sim.state.entities.get(sim.state.party[KAEL]!)!;
          c.push({ t: 'tech', id: 'chime', point: { x: k.x, z: k.z } });
        }
        if (i % 900 === 300) c.push({ t: 'tech', id: 'reel', slot: KAEL });
        if (i % 300 === 120) c.push({ t: 'glide', x: i % 600 === 120 ? 1 : -1, z: 0.4 });
        h.tick(c);
        most = Math.max(most, h.instances());
      }
      return { h, most };
    };
    const none = fight({});
    for (const techniques of [
      { ward: 'chorale', chime: 'purge', reel: 'swap', glide: 'phase_step' },
      { ward: 'aegis_link', chime: 'absolve', reel: 'anchor', glide: 'skate' },
    ] as SimConfig['techniques'][]) {
      const { h, most } = fight(techniques);
      expect(most, JSON.stringify(techniques)).toBeLessThan(140);
      expect(most, JSON.stringify(techniques)).toBeGreaterThan(0);
      expect(count(h), JSON.stringify(techniques)).toBe(count(none.h));
    }
  });
});

/** A StageRuntime for the lab's scenarios over a headless harness (as the lab's LabRuntime). */
function stageRuntime(sim: Sim) {
  const pending: Command[] = [];
  const scheduled: { at: number; fn: () => void }[] = [];
  const taps: { pred: (e: SimEvent) => boolean; fn: (e: SimEvent) => void }[] = [];
  const rt: StageRuntime = {
    sim,
    later: (delay, fn) => scheduled.push({ at: sim.state.time + delay, fn }),
    onEvent: (pred, fn) => taps.push({ pred, fn }),
    queue: (c) => pending.push(c),
  };
  /** After a tick: the taps its events match, then what is due. */
  const after = (events: readonly SimEvent[]) => {
    for (const e of events)
      for (let i = taps.length - 1; i >= 0; i--) {
        const t = taps[i]!;
        if (!t.pred(e)) continue;
        taps.splice(i, 1);
        t.fn(e);
      }
    for (let i = scheduled.length - 1; i >= 0; i--) {
      if (scheduled[i]!.at > sim.state.time) continue;
      const [job] = scheduled.splice(i, 1);
      job!.fn();
    }
  };
  return { rt, pending, after };
}

describe('the lab’s scenarios (Phase 4f · Variants)', () => {
  it('each stages its variants in the real sim, and every moment it shows is drawn', () => {
    expect(VARIANT_SCENARIO_NAMES.length).toBeGreaterThanOrEqual(10);
    const shown = new Set<string>();
    for (const name of VARIANT_SCENARIO_NAMES) {
      const sc = VARIANT_SCENARIOS[name]!;
      const sim = createSim({
        seed: 1234,
        debug: true,
        chords: sc.chords ?? GUARDIAN,
        ...scenarioConfig(sc),
      });
      const h = harness(sim);
      const { rt, pending, after } = stageRuntime(sim);
      sc.stage(rt);
      const drawn = new Set<string>();
      for (let i = 0; i < sc.seconds * 60; i++) {
        const ev = h.tick(pending.splice(0));
        after(ev);
        for (const m of VARIANT_MOMENTS) if (h.view.drawnBy[m] > 0) drawn.add(m);
      }
      for (const m of sc.shows) {
        expect(h.view.started[m], `${name}: ${m}`).toBeGreaterThan(0);
        expect(drawn.has(m), `${name}: ${m} drawn`).toBe(true);
        shown.add(m);
      }
      // Its variants were cast.
      for (const id of Object.values(sc.techniques))
        if (id && sc.shows.includes(CAST_MOMENT[variantOf(id)!]))
          expect(h.view.fired[variantOf(id)!], `${name}: ${id}`).toBeGreaterThan(0);
    }
    // Between them they show every variant's cast.
    for (const id of VARIANT_IDS) expect(shown, id).toContain(CAST_MOMENT[id]);
  });
});
