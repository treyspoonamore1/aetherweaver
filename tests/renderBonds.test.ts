/**
 * Phase 4e VFX: Bonds in the fight (docs/phase-4e/vfx-audio.md). Every check drives the real sim
 * with talents and alternate Solos (configs as in tests/sim/bonds.test.ts) and feeds its state and
 * events to the real EntityLayer and BondsView over a real FxKit: a moment for every talent the sim
 * announces (`talentFired`), each in its hero's colour; Oathkeeper's reach and tethers; Hawk's
 * Vigil's stance, shots and marks; Celestial Sphere's spheres and pops; Constellation's stars; all
 * drawn from the state and the content.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { COLOR_VISIONS, deltaE, simulateVision, visionPalette } from '../src/app/colorVision';
import { CONTENT, heroDef } from '../src/content';
import type { Command, Sim, SimConfig, SimEvent, WorldState } from '../src/sim';
import { dealDamage } from '../src/sim/combat/health';
import { attackRange } from '../src/sim/systems/heroDamage';
import { onPackArrived } from '../src/sim/systems/heroes';
import { startSolo } from '../src/sim/systems/solos';
import type { Entity } from '../src/sim/state';
import { BondsView } from '../src/render/bonds';
import {
  BONDS_HEX,
  BOND_CUES,
  CUE_LIFE,
  NOVA_DELAY,
  VIGIL_EXTRA,
  altSoloActive,
  bondCue,
  bondsLook,
  cueHero,
  emptyBondsLook,
  markLeft,
  markSeconds,
  novaRadius,
  oathReach,
  roarRadius,
  shieldbearerRadius,
  sphereHits,
  sphereMaxHits,
  starSeconds,
  unbreakableSeconds,
  vigilReach,
  type BondCue,
} from '../src/render/bondsCues';
import { EntityLayer } from '../src/render/entities';
import { FxKit } from '../src/render/fx/kit';
import { SHELL } from '../src/render/fx/shells';
import { createModelMaterial } from '../src/render/models/material';
import { applyVision } from '../src/render/palette';
import type { FrameInfo } from '../src/render/types';
import { sandbox, spawn, telegraphOn, worldOf } from './sim/helpers';

const SETTINGS: FrameInfo['settings'] = {
  screenShake: 1,
  flashes: 1,
  damageNumbers: true,
  colorVision: 'normal',
};
const KAEL = 0;
const LYRA = 1;
const VEXIS = 2;
const bonds = (talents: string[], solos: string[] = []): Partial<SimConfig> => ({
  bonds: { talents, solos },
});
const tv = (id: string, key: string) =>
  CONTENT.talents.find((t) => t.id === id)?.values[key] ?? Number.NaN;
const sv = (id: string, key: string) =>
  CONTENT.altSolos.find((s) => s.id === id)?.values[key] ?? Number.NaN;

/** An overlay that records the callouts it is asked to show. */
class FakeOverlay {
  callouts: { text: string; color: string }[] = [];
  callout(_x: number, _y: number, _z: number, text: string, color: string): void {
    this.callouts.push({ text, color });
  }
}

/** A colour as the batches hold it (three's working space), to compare what was drawn. */
const linear = (hex: string) => new THREE.Color(hex);
const sameColor = (a: ArrayLike<number>, o: number, c: THREE.Color) =>
  Math.abs(a[o]! - c.r) < 1e-4 &&
  Math.abs(a[o + 1]! - c.g) < 1e-4 &&
  Math.abs(a[o + 2]! - c.b) < 1e-4;

/** The real views over a real FxKit, driven by a real sim (one sim tick, one frame). */
function harness(sim: Sim) {
  const kit = new FxKit();
  const entities = new EntityLayer(createModelMaterial());
  const overlay = new FakeOverlay();
  const view = new BondsView({ kit, recs: entities.recs, overlay, rig: { addTrauma() {} } });
  const cam = new THREE.Vector3(0, 22, 18);
  let time = 0;
  /** What BondsView alone pushed last frame, batch by batch: [first index, count]. */
  const own = { rings: [0, 0], sprites: [0, 0], beams: [0, 0], shells: [0, 0], top: [0, 0] };
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
      top: kit.spritesTop.size,
    };
    view.sync(sim.state, 1 / 60, time, flashes);
    own.rings = [before.rings, kit.rings.size - before.rings];
    own.sprites = [before.sprites, kit.sprites.size - before.sprites];
    own.beams = [before.beams, kit.beams.size - before.beams];
    own.shells = [before.shells, kit.shells.size - before.shells];
    own.top = [before.top, kit.spritesTop.size - before.top];
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
  /** Did BondsView push something in this colour last frame (rings, sprites, beams, shells)? */
  const drewIn = (hex: string) => {
    const c = linear(hex);
    const scan = (arr: Float32Array, [from, n]: number[]) => {
      for (let i = from!; i < from! + n!; i++) if (sameColor(arr, i * 4, c)) return true;
      return false;
    };
    return (
      scan(kit.rings.array('iColor'), own.rings) ||
      scan(kit.sprites.array('iColor'), own.sprites) ||
      scan(kit.beams.array('iColor'), own.beams) ||
      scan(kit.shells.array('iColor'), own.shells) ||
      scan(kit.spritesTop.array('iColor'), own.top)
    );
  };
  /** How many shells of a style BondsView pushed last frame. */
  const shellsOf = (style: number) => {
    const pos = kit.shells.array('iPos');
    let n = 0;
    for (let i = own.shells[0]!; i < own.shells[0]! + own.shells[1]!; i++)
      if (pos[i * 4 + 3] === style) n++;
    return n;
  };
  return { kit, entities, view, overlay, tick, run, until, drewIn, shellsOf, own };
}

function setup(config: Partial<SimConfig> = {}) {
  const sim = sandbox(config);
  const w = worldOf(sim);
  const of = (slot: number) => w.entities.get(w.party[slot]!)!;
  return { sim, w, of, h: harness(sim) };
}

/** Enemies spawned at these points, stood up and ready (drawn as they come). */
function enemies(h: ReturnType<typeof harness>, ...at: [string, number, number][]): Entity[] {
  h.run(
    1,
    at.map(([id, x, z]) => spawn(id, x, z)),
  );
  h.run(60);
  return [];
}
const living = (sim: Sim) =>
  [...worldOf(sim).entities.list()].filter((e) => e.enemy && !e.health?.dead);
const hit = (sim: Sim, target: Entity, amount: number, source: Entity | null) =>
  dealDamage(worldOf(sim), target, {
    source: source?.id ?? null,
    sourceName: 'test',
    amount,
    telegraph: null,
  });
const heroHexOf = (slot: number) => heroDef(['kael', 'lyra', 'vexis'][slot]!).color;
const tough = (sim: Sim) => {
  for (const e of worldOf(sim).entities.list())
    if (e.enemy && e.health) e.health.hp = e.health.maxHp = 1e6;
};

/** Every talent id the sim announces (`talentFired(world, hero, 'id', …)`), read from its sources. */
function simTalents(): string[] {
  const found = new Set<string>();
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (p.endsWith('.ts')) {
        const src = readFileSync(p, 'utf8');
        for (const m of src.matchAll(/talentFired\(\s*world,\s*[\w.]+,\s*'([a-z_]+)'/g))
          found.add(m[1] as string);
      }
    }
  };
  walk(join(__dirname, '..', 'src', 'sim'));
  return [...found].sort();
}

describe('Bonds cues', () => {
  it('a cue for every talent the sim announces, each its hero’s', () => {
    expect([...BOND_CUES].sort()).toEqual(simTalents());
    for (const id of BOND_CUES) {
      expect(bondCue(id)).toBe(id);
      expect(['kael', 'lyra', 'vexis'], id).toContain(cueHero(id));
      expect(CUE_LIFE[id], id).toBeGreaterThanOrEqual(0);
    }
    // Talents with nothing visible to announce (their effect is a number) have no cue.
    for (const id of ['bulwark_of_faith', 'hawk_eye', 'hunters_mark', 'last_light', 'overchannel'])
      expect(bondCue(id), id).toBeNull();
  });

  it('every number is the content’s', () => {
    expect(oathReach(false)).toBe(sv('oathkeeper', 'radius'));
    expect(oathReach(true)).toBe(sv('oathkeeper', 'cuedRadius'));
    expect(roarRadius()).toBe(tv('vanguards_roar', 'radius'));
    expect(shieldbearerRadius()).toBe(tv('shieldbearer', 'radius'));
    expect(novaRadius()).toBe(tv('supernova', 'radius'));
    expect(starSeconds()).toBe(tv('constellation', 'seconds'));
    expect(unbreakableSeconds()).toBe(tv('unbreakable', 'seconds'));
    expect(markSeconds()).toBe(sv('hawks_vigil', 'mark'));
    expect(sphereMaxHits()).toBe(sv('celestial_sphere', 'hits'));
  });

  it('Hawk’s Vigil’s reach is the sim’s: her attack range (Hawk Eye’s too) and its extra', () => {
    for (const talents of [[], ['hawk_eye']]) {
      const { w, of } = setup(bonds(talents, ['hawks_vigil']));
      const lyra = of(LYRA);
      expect(vigilReach(lyra)).toBe(
        attackRange(w, lyra, heroDef('lyra').attack.range) + VIGIL_EXTRA,
      );
    }
    // The extra is the sim's own (solos.ts).
    const src = readFileSync(join(__dirname, '..', 'src', 'sim', 'systems', 'solos.ts'), 'utf8');
    const m = /attackRange\(world, lyra, def\.attack\.range\) \+ (\d+(?:\.\d+)?)/.exec(src);
    expect(Number(m?.[1])).toBe(VIGIL_EXTRA);
  });

  it('Supernova’s nova lands when the sim’s does', () => {
    const src = readFileSync(join(__dirname, '..', 'src', 'sim', 'systems', 'solos.ts'), 'utf8');
    const body = src.slice(src.indexOf('function supernova'));
    const m = /at: world\.time \+ (\d+(?:\.\d+)?)/.exec(body);
    expect(Number(m?.[1])).toBe(NOVA_DELAY);
  });

  it('reads the state: a state without Bonds (an old fixture) reads as none', () => {
    const { sim } = setup();
    sim.step([]);
    expect(bondsLook(sim.state, emptyBondsLook())).toEqual({ any: false, alt: false });
    const withBonds = setup(bonds(['ricochet'], ['oathkeeper']));
    withBonds.sim.step([]);
    expect(bondsLook(withBonds.sim.state, emptyBondsLook())).toEqual({ any: true, alt: true });
    const bare = { party: [1], entities: { get: () => ({ hero: { defId: 'kael' } }) } };
    expect(bondsLook(bare as unknown as WorldState, emptyBondsLook()).any).toBe(false);
    expect(sphereHits({ hero: { defId: 'kael' } } as never, 0)).toBe(0);
    expect(markLeft({ enemy: { defId: 'x' } } as never, 0)).toBe(0);
    expect(altSoloActive(undefined)).toBeNull();
  });

  it('its own colours stay apart from danger in every colour vision', () => {
    try {
      for (const vision of COLOR_VISIONS) {
        const p = visionPalette(vision);
        const see = (hex: string) => simulateVision(hex, vision);
        expect(deltaE(see(BONDS_HEX.starlight), see(p.lethal)), vision).toBeGreaterThanOrEqual(20);
        expect(deltaE(see(BONDS_HEX.starlight), see(p.threat)), vision).toBeGreaterThanOrEqual(15);
      }
    } finally {
      applyVision('normal');
    }
  });
});

describe('Kael’s talents', () => {
  it('Riposte Bash: a counter in his blue at the attacker, named', () => {
    const { sim, telegraph: t } = telegraphOn(
      'bell_brute',
      'Toll Cleave',
      KAEL,
      2.5,
      sandbox(bonds(['riposte_bash'])),
    );
    const h = harness(sim);
    const w = worldOf(sim);
    w.entities.get(w.party[KAEL]!)!.hero!.abilityCooldowns = [99, 99];
    h.until(() => sim.state.time >= t.perfectFrom + 0.05);
    h.tick([{ t: 'tech', id: 'ward', slot: KAEL }]);
    h.until((ev) => ev.some((e) => e.type === 'talentFired' && e.talent === 'riposte_bash'), 300);
    expect(h.view.fired.riposte_bash).toBe(1);
    h.run(10);
    expect(h.view.drawnBy.riposte_bash).toBe(1);
    expect(h.drewIn(heroHexOf(KAEL))).toBe(true);
    expect(h.view.lastHex.riposte_bash).toBe(heroHexOf(KAEL));
    expect(h.overlay.callouts.map((c) => c.text)).toContain('RIPOSTE BASH');
    // Its moment ends.
    h.run(60);
    expect(h.view.activeCount('riposte_bash')).toBe(0);
  });

  it('Unbreakable: the flare, then his bastion while he is untouchable, for its seconds', () => {
    const { sim, of, h } = setup(bonds(['unbreakable']));
    enemies(h, ['bell_brute', 0, -20]);
    const kael = of(KAEL);
    const brute = living(sim)[0]!;
    hit(sim, kael, 1e6, brute);
    h.run(2);
    expect(h.view.fired.unbreakable).toBe(1);
    expect(kael.health!.invulnerable).toBeGreaterThan(0);
    h.run(10);
    expect(h.view.drawn.unbreakable).toBe(1);
    expect(h.drewIn(heroHexOf(KAEL))).toBe(true);
    expect(h.overlay.callouts.map((c) => c.text)).toContain('UNBREAKABLE');
    // When his seconds are up, it lets go.
    h.run(Math.ceil((unbreakableSeconds() + 0.6) * 60));
    expect(kael.health!.invulnerable).toBe(0);
    expect(h.view.drawn.unbreakable).toBe(0);
    expect(h.view.activeCount('unbreakable')).toBe(0);
  });

  it('Shieldbearer: a ring to its reach, a run of light to each hero it shielded', () => {
    const { w, of, h } = setup(bonds(['shieldbearer']));
    h.run(2);
    const kael = of(KAEL);
    of(LYRA).x = kael.x + 2;
    of(LYRA).z = kael.z;
    of(VEXIS).x = kael.x + shieldbearerRadius() + 4;
    of(VEXIS).z = kael.z;
    h.run(1);
    startSolo(w, kael, false);
    h.run(8);
    expect(h.view.fired.shieldbearer).toBe(1);
    expect(h.view.drawnBy.shieldbearer).toBe(1);
    expect(h.drewIn(heroHexOf(KAEL))).toBe(true);
  });

  it('Steady Vanguard and Vanguard’s Roar: the charge at your Focus; the Roar turns the pack', () => {
    const steady = setup(bonds(['steady_vanguard']));
    enemies(steady.h, ['bell_brute', 0, -10], ['hollow_chorister', 4, -10]);
    const [a, b] = living(steady.sim);
    steady.w.encounter.wave = 2;
    steady.w.focusTarget = b!.id;
    onPackArrived(steady.w, [a!, b!]);
    steady.h.run(4);
    expect(steady.h.view.fired.steady_vanguard).toBe(1);
    expect(steady.h.view.drawnBy.steady_vanguard).toBe(1);
    expect(steady.h.drewIn(heroHexOf(KAEL))).toBe(true);

    const roar = setup(bonds(['vanguards_roar']));
    enemies(
      roar.h,
      ['bell_brute', 0, -10],
      ['hollow_chorister', 3, -10],
      ['hollow_chorister', 0, 12],
    );
    const [q] = living(roar.sim);
    roar.w.encounter.wave = 2;
    onPackArrived(roar.w, [q!]);
    roar.h.run(12);
    expect(roar.h.view.fired.vanguards_roar).toBe(1);
    expect(roar.h.drewIn(heroHexOf(KAEL))).toBe(true);
    expect(roar.h.overlay.callouts.map((c) => c.text)).toContain('VANGUARD’S ROAR');
  });
});

describe('Lyra’s and Vexis’s talents', () => {
  it('Wind Step: a gust where she stood, in her green, named', () => {
    const { sim, w, of, h } = setup(bonds(['wind_step']));
    const lyra = of(LYRA);
    for (const slot of [KAEL, VEXIS]) Object.assign(of(slot).health!, { hp: 0, dead: true });
    enemies(h, ['bell_brute', lyra.x, lyra.z - 2.5]);
    tough(sim);
    startSolo(w, lyra, false);
    h.until((ev) => ev.some((e) => e.type === 'talentFired' && e.talent === 'wind_step'), 60 * 15);
    h.run(3);
    expect(h.view.fired.wind_step).toBe(1);
    expect(h.view.drawnBy.wind_step).toBe(1);
    expect(h.drewIn(heroHexOf(LYRA))).toBe(true);
    expect(h.overlay.callouts.map((c) => c.text)).toContain('WIND STEP');
  });

  it('Arcane Ward: she folds away where she was struck and opens out where she landed', () => {
    const { sim, w, of, h } = setup(bonds(['arcane_ward']));
    const vexis = of(VEXIS);
    const me = w.entities.get(w.weaverId)!;
    enemies(h, ['bell_brute', 0, -20]);
    const brute = living(sim)[0]!;
    vexis.x = me.x + 10;
    vexis.z = me.z;
    brute.x = vexis.x + 1;
    brute.z = vexis.z;
    h.run(2);
    const from = vexis.x;
    hit(sim, vexis, 10, brute);
    h.run(3);
    expect(h.view.fired.arcane_ward).toBe(1);
    expect(from - vexis.x).toBeCloseTo(tv('arcane_ward', 'metres'), 1);
    expect(h.drewIn(heroHexOf(VEXIS))).toBe(true);
  });

  it('Event Horizon: each enemy it caught is drawn dragged into your field', () => {
    const { sim, w, of, h } = setup({
      ...bonds(['event_horizon']),
      chords: [{ auras: ['fortissimo'] }, { auras: ['sostenuto'] }],
    });
    const me = w.entities.get(w.weaverId)!;
    enemies(
      h,
      ['hollow_chorister', me.x + 9, me.z - 5],
      ['hollow_chorister', me.x + 10.5, me.z - 5],
      ['hollow_chorister', me.x + 9, me.z - 6.5],
    );
    tough(sim);
    of(VEXIS).hero!.abilityCooldowns = [0, 99];
    h.until((ev) => ev.some((e) => e.type === 'talentFired' && e.talent === 'event_horizon'), 600);
    h.run(2);
    expect(h.view.fired.event_horizon).toBe(1);
    expect(h.view.drawn.pulled).toBeGreaterThan(0);
    expect(h.drewIn(heroHexOf(VEXIS))).toBe(true);
  });

  it('Supernova: it gathers, then bursts after the sim’s delay, in her violet', () => {
    const { sim, w, of, h } = setup(bonds(['supernova']));
    enemies(h, ['bell_brute', 0, -6]);
    tough(sim);
    startSolo(w, of(VEXIS), false);
    h.until((ev) => ev.some((e) => e.type === 'talentFired' && e.talent === 'supernova'), 600);
    h.run(Math.ceil(NOVA_DELAY * 60) + 4);
    expect(h.view.fired.supernova).toBe(1);
    expect(h.view.drawnBy.supernova).toBe(1);
    expect(h.drewIn(heroHexOf(VEXIS))).toBe(true);
    expect(h.overlay.callouts.map((c) => c.text)).toContain('SUPERNOVA');
  });

  it('Starthread: her star runs along the Thread to the hero you Thread', () => {
    const { sim, of, h } = setup(bonds(['starthread']));
    h.run(1, [{ t: 'thread', slot: KAEL }]);
    const kael = of(KAEL);
    enemies(h, ['bell_brute', kael.x, kael.z - 3]);
    tough(sim);
    of(VEXIS).hero!.abilityCooldowns = [99, 0];
    h.until((ev) => ev.some((e) => e.type === 'talentFired' && e.talent === 'starthread'), 900);
    h.run(4);
    expect(h.view.fired.starthread).toBe(1);
    expect(h.drewIn(heroHexOf(VEXIS))).toBe(true);
    // Frequent: no callout.
    expect(h.overlay.callouts.map((c) => c.text)).not.toContain('STARTHREAD');
  });

  it('Constellation: a star where each Cue was, for its seconds, flaring as it casts, linked', () => {
    const { sim, of, h } = setup(bonds(['constellation']));
    enemies(h, ['bell_brute', 0, -6]);
    tough(sim);
    h.run(2, [
      { t: 'debug', op: { op: 'chargeSolos' } },
      { t: 'debug', op: { op: 'setResonance', value: 100 } },
    ]);
    h.run(1, [{ t: 'cue', slot: KAEL }]);
    h.run(1);
    expect(h.view.fired.constellation).toBe(1);
    expect(h.view.drawn.stars).toBe(1);
    expect(h.drewIn(heroHexOf(VEXIS))).toBe(true);
    const star = h.view.starsOf(sim.state)[0]!;
    expect(star.left).toBeCloseTo(starSeconds(), 1);
    // A second Cue: two stars, joined.
    h.run(1, [{ t: 'cue', slot: LYRA }]);
    h.run(1);
    expect(h.view.drawn.stars).toBe(2);
    expect(h.view.drawn.starLinks).toBe(1);
    // It casts: each bolt the sim sends from it flares it.
    h.run(Math.ceil(tv('constellation', 'interval') * 60) + 30);
    expect(h.view.starsOf(sim.state)[0]!.bolts).toBeGreaterThan(0);
    // Gone when its seconds are up.
    h.run(Math.ceil(starSeconds() * 60) + 30);
    expect(h.view.drawn.stars).toBe(0);
    expect(h.view.activeCount('constellation')).toBe(0);
    void of;
  });

  it('a star fades when Vexis falls (the sim’s rule)', () => {
    const { sim, of, h } = setup(bonds(['constellation']));
    enemies(h, ['bell_brute', 0, -6]);
    tough(sim);
    h.run(2, [
      { t: 'debug', op: { op: 'chargeSolos' } },
      { t: 'debug', op: { op: 'setResonance', value: 100 } },
    ]);
    h.run(2, [{ t: 'cue', slot: KAEL }]);
    expect(h.view.drawn.stars).toBe(1);
    Object.assign(of(VEXIS).health!, { hp: 0, downed: true });
    h.run(30);
    expect(h.view.drawn.stars).toBe(0);
  });
});

describe('the alternate Solos while they last', () => {
  it('Oathkeeper: his reach round him (the content’s), who stands under it, a tether per hit', () => {
    const { sim, w, of, h } = setup(bonds([], ['oathkeeper']));
    enemies(h, ['bell_brute', 0, -20]);
    const kael = of(KAEL);
    const lyra = of(LYRA);
    lyra.x = kael.x + 3;
    lyra.z = kael.z;
    h.run(1);
    startSolo(w, kael, false);
    h.run(2);
    expect(h.view.reachOf(KAEL).oath).toBe(oathReach(false));
    expect(h.view.drawn.covered).toBeGreaterThanOrEqual(1);
    expect(h.drewIn(heroHexOf(KAEL))).toBe(true);
    hit(sim, lyra, 200, living(sim)[0]!);
    h.run(2);
    expect(h.view.fired.oathkeeper).toBe(1);
    expect(h.view.drawn.tethers).toBe(1);
    // Frequent: no callout.
    expect(h.overlay.callouts).toHaveLength(0);
    // You stand under it too: a hit on you is his, a tether from you.
    const weaver = w.entities.get(w.weaverId)!;
    weaver.x = kael.x - 3;
    weaver.z = kael.z;
    h.run(1);
    expect(h.view.drawn.covered).toBeGreaterThanOrEqual(2);
    hit(sim, weaver, 50, living(sim)[0]!);
    h.run(2);
    expect(h.view.fired.oathkeeper).toBe(2);
    expect(h.view.drawn.tethers).toBe(2);
    // Untouchable, he takes no one's hits: his reach dims and no one stands under it.
    kael.health!.invulnerable = 1;
    h.run(1);
    expect(h.view.reachOf(KAEL).oath).toBe(oathReach(false));
    expect(h.view.drawn.covered).toBe(0);
    kael.health!.invulnerable = 0;
    h.run(1);
    expect(h.view.drawn.covered).toBeGreaterThanOrEqual(2);
    // It ends with the Solo.
    h.run(Math.ceil(sv('oathkeeper', 'seconds') * 60) + 10);
    expect(h.view.reachOf(KAEL).oath).toBe(0);
    // Cued, farther.
    const cued = setup(bonds([], ['oathkeeper']));
    cued.h.run(1);
    startSolo(cued.w, cued.of(KAEL), true);
    cued.h.run(2);
    expect(cued.h.view.reachOf(KAEL).oath).toBe(oathReach(true));
  });

  it('Hawk’s Vigil: her stance and reach while it lasts, a shot at each attacker, its marks', () => {
    const { sim, w, of, h } = setup(bonds([], ['hawks_vigil']));
    const lyra = of(LYRA);
    enemies(h, ['bell_brute', lyra.x, lyra.z - 4]);
    tough(sim);
    startSolo(w, lyra, true);
    h.run(1);
    expect(h.view.drawn.stance).toBe(1);
    expect(h.view.reachOf(LYRA).vigil).toBe(vigilReach(lyra));
    h.until((ev) => ev.some((e) => e.type === 'talentFired' && e.talent === 'hawks_vigil'), 600);
    h.run(2);
    expect(h.view.fired.hawks_vigil).toBeGreaterThanOrEqual(1);
    expect(h.view.drawn.marks).toBeGreaterThanOrEqual(1);
    expect(h.drewIn(heroHexOf(LYRA))).toBe(true);
    const marked = living(sim).find((e) => markLeft(e, sim.state.time) > 0)!;
    expect(markLeft(marked, sim.state.time)).toBeLessThanOrEqual(markSeconds());
    // When the Vigil and the marks are over, nothing is left.
    h.run(Math.ceil((sv('hawks_vigil', 'seconds') + markSeconds()) * 60) + 30);
    expect(h.view.drawn.stance).toBe(0);
    expect(h.view.drawn.marks).toBe(0);
  });

  it('Celestial Sphere: a sphere with its hits as stars; each swallowed hit pops one; the last shatters it', () => {
    const { sim, w, of, h } = setup(bonds([], ['celestial_sphere']));
    enemies(h, ['bell_brute', 0, -20]);
    h.run(1, [{ t: 'thread', slot: KAEL }]);
    const kael = of(KAEL);
    startSolo(w, of(VEXIS), false);
    h.run(2);
    const hits = sv('celestial_sphere', 'hits');
    expect(h.view.drawn.spheres).toBe(1);
    expect(h.view.drawn.sphereStars).toBe(hits);
    expect(h.shellsOf(SHELL.sphere)).toBe(1);
    expect(h.drewIn(heroHexOf(VEXIS))).toBe(true);
    const brute = living(sim)[0]!;
    hit(sim, kael, 300, brute);
    h.run(2);
    expect(h.view.fired.celestial_sphere).toBe(1);
    expect(h.view.drawn.sphereStars).toBe(hits - 1);
    for (let i = 1; i < hits; i++) hit(sim, kael, 300, brute);
    h.run(2);
    // Spent: the state has none, the shatter is drawn (its own sphere shell, fading).
    expect(h.view.drawn.spheres).toBe(0);
    expect(h.shellsOf(SHELL.sphere)).toBe(1);
    h.run(60);
    expect(h.shellsOf(SHELL.sphere)).toBe(0);
  });

  it('cued, every hero in your field has one, with its stars in your Cue’s gold', () => {
    const { w, of, h } = setup({
      ...bonds([], ['celestial_sphere']),
      chords: [{ auras: ['fortissimo'] }, { auras: ['sostenuto'] }],
    });
    h.run(30);
    for (const id of w.party) w.entities.get(id)!.hero!.inField = true;
    startSolo(w, of(VEXIS), true);
    h.run(2);
    expect(h.view.drawn.spheres).toBe(3);
    // It runs out with its seconds.
    h.run(Math.ceil(sv('celestial_sphere', 'seconds') * 60) + 40);
    expect(h.view.drawn.spheres).toBe(0);
  });
});

describe('every moment, and the rules they keep', () => {
  /** Each cue's `talentFired`, built as the sim builds it, from a real sandbox's heroes. */
  const synthetic = (id: BondCue, sim: Sim): SimEvent => {
    const st = sim.state;
    const hero = st.party[['kael', 'lyra', 'vexis'].indexOf(cueHero(id)!)]!;
    const he = st.entities.get(hero)!;
    const foe = [...st.entities.list()].find((e) => e.enemy)!;
    const target =
      id === 'oathkeeper' || id === 'celestial_sphere'
        ? st.party[LYRA]!
        : id === 'unbreakable' || id === 'shieldbearer' || id === 'wind_step'
          ? null
          : id === 'constellation'
            ? st.party[KAEL]!
            : foe.id;
    return {
      type: 'talentFired',
      tick: sim.tick,
      hero,
      talent: id,
      x: id === 'arcane_ward' || id === 'wind_step' ? he.x + 2 : he.x + 1,
      z: he.z - 1,
      target,
    };
  };

  it('each is drawn in its hero’s colour, at Flashes 0 too', () => {
    for (const flashes of [1, 0]) {
      for (const id of BOND_CUES) {
        const { sim, h } = setup(bonds([]));
        enemies(h, ['bell_brute', 0, -8]);
        h.view.handle([synthetic(id, sim)], sim.state);
        h.tick([], flashes);
        h.tick([], flashes);
        h.tick([], flashes);
        expect(h.view.fired[id], id).toBe(1);
        expect(h.drewIn(heroDef(cueHero(id)!).color), `${id} at flashes ${flashes}`).toBe(true);
      }
    }
  });

  it('an event before its hero is drawn waits for it; an unknown talent is ignored', () => {
    const { sim } = setup();
    const h = harness(sim);
    h.view.handle(
      [
        {
          type: 'talentFired',
          tick: 0,
          hero: sim.state.party[KAEL]!,
          talent: 'riposte_bash',
          x: 0,
          z: 0,
          target: null,
        },
        {
          type: 'talentFired',
          tick: 0,
          hero: sim.state.party[KAEL]!,
          talent: 'not_a_talent',
          x: 0,
          z: 0,
          target: null,
        },
      ],
      sim.state,
    );
    expect(h.view.activeCount()).toBe(1);
    h.run(3);
    expect(h.view.drawnBy.riposte_bash).toBe(1);
  });

  it('a busy fight with every talent kind stays inside the batches’ room, and no new draw calls', () => {
    const batches = (config: Partial<SimConfig>) => {
      const { sim, h } = setup({
        ...config,
        assists: { autonomy: true },
        encounter: 'first_light',
      });
      const counts: number[] = [];
      for (let i = 0; i < 60 * 25; i++) {
        h.tick(i % 300 === 20 ? [{ t: 'thread', slot: KAEL }] : []);
        counts.push(h.own.rings[1]! + h.own.sprites[1]! + h.own.beams[1]!);
      }
      void sim;
      return {
        fx: h.kit.group.children.length,
        models: h.entities.group.children.length,
        most: Math.max(...counts),
        fired: Object.values(h.view.fired).reduce((a, b) => a + b, 0),
      };
    };
    const every = batches(
      bonds(
        [
          'vanguards_roar',
          'riposte_bash',
          'unbreakable',
          'wind_step',
          'storm_queen',
          'arcane_ward',
          'starthread',
          'constellation',
        ],
        ['celestial_sphere'],
      ),
    );
    const none = batches({});
    expect(every.fx).toBe(none.fx);
    expect(every.models).toBe(none.models);
    expect(every.fired).toBeGreaterThan(0);
    expect(none.fired).toBe(0);
    // Well inside the shared batches (rings 384, sprites 256, beams 160).
    expect(every.most).toBeLessThan(160);
  });
});
