/**
 * Phase 3c VFX: the Luminary in the fight (docs/phase-3c/vfx.md). Every check drives the real
 * sim (configs as in tests/sim/luminary.test.ts), feeds its state and events to the real
 * EntityLayer, FieldView and CallingView over a real FxKit, and checks each visual triggers on
 * the right state and events.
 */
import * as THREE from 'three';
import { afterEach, describe, expect, it } from 'vitest';
import { COLOR_VISIONS, deltaE, simulateVision, visionPalette } from '../src/app/colorVision';
import { CONTENT, callingOption } from '../src/content';
import type { ChordConfig, Command, DebugOp, Sim, SimEvent } from '../src/sim';
import { radianceOf } from '../src/sim/combat/health';
import { CallingView } from '../src/render/calling';
import {
  CALLING_HEX,
  MAX_SHINE_LEVEL,
  RADIANT_CHIP,
  RADIANT_FLARE,
  SUN_GLYPH,
  auraCount,
  callingLook,
  callingValue,
  eclipseMarks,
  emptyLook,
  radiantTier,
  shineLevel,
  shineOf,
  splitRadiant,
  sunChipText,
} from '../src/render/callingCues';
import { EntityLayer } from '../src/render/entities';
import { dawnwardIn } from '../src/render/feedback';
import { FieldView } from '../src/render/field';
import { FxKit } from '../src/render/fx/kit';
import { createModelMaterial } from '../src/render/models/material';
import { applyVision, auraColor } from '../src/render/palette';
import type { FrameInfo } from '../src/render/types';
import { hero, ofType, sandbox, spawn, stepFor, worldOf } from './sim/helpers';

const luminary = (...path: string[]) => ({ calling: { id: 'luminary', path } });
const passive = (key: string) => CONTENT.callings.find((c) => c.id === 'luminary')!.values[key]!;
/** Guardian: Fortissimo on the beam, Sostenuto in the field. */
const GUARDIAN: ChordConfig[] = [
  { auras: ['fortissimo'], ornaments: [] },
  { auras: ['sostenuto'], ornaments: [] },
];
const PLANTED: ChordConfig[] = [
  { auras: ['fortissimo'], ornaments: [] },
  { auras: ['sostenuto'], ornaments: ['pedal_point'] },
];
const FOUR: ChordConfig[] = [
  { auras: ['fortissimo', 'sostenuto'], ornaments: ['grace_note'] },
  { auras: ['ostinato', 'allegro'], ornaments: [] },
];
const SOVEREIGN = ['haloed', 'dawnward', 'lantern_bearer', 'sovereign_symphony'];
const ECLIPSE = ['haloed', 'dawnward', 'lantern_bearer', 'eclipse'];

const SETTINGS: FrameInfo['settings'] = {
  screenShake: 1,
  flashes: 1,
  damageNumbers: true,
  colorVision: 'normal',
};

/** The real EntityLayer, FieldView and CallingView over a real FxKit, driven by a real sim. */
function harness(sim: Sim) {
  const kit = new FxKit();
  const entities = new EntityLayer(createModelMaterial());
  const field = new FieldView(entities);
  const callouts: string[] = [];
  const view = new CallingView({
    kit,
    recs: entities.recs,
    overlay: { callout: (_x, _y, _z, text) => void callouts.push(text) },
  });
  const cam = new THREE.Vector3(0, 22, 18);
  let time = 0;
  const events: SimEvent[] = [];
  /** One sim tick and one render frame; returns what the batches drew. */
  const tick = (commands: Command[] = [], flashes = 1) => {
    sim.step(commands);
    const ev = sim.drainEvents();
    events.push(...ev);
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
    field.sync(sim.state, kit, 1 / 60, time);
    view.sync(sim.state, 1 / 60, time, flashes);
    const counts = {
      rings: kit.rings.size,
      beams: kit.beams.size,
      sprites: kit.sprites.size,
      shells: kit.shells.size,
      shadows: kit.shadows.size,
    };
    kit.end(1 / 60, 1280, 720, 720, 45);
    time += 1 / 60;
    return counts;
  };
  const run = (ticks: number, commands: Command[] = []) => {
    for (let i = 0; i < ticks; i++) tick(i === 0 ? commands : []);
  };
  const shine = (slot: number) => entities.recs.get(sim.state.party[slot]!)!.shine;
  return { kit, entities, field, view, callouts, events, tick, run, shine };
}

const debug = (op: DebugOp): Command => ({ t: 'debug', op });
const away = debug({ op: 'teleportWeaver', x: 14, z: 6 });

/** Sunrise, staged as the lab does it: Resonance to 100, then `{t:'crescendo'}`. */
function sunrise(h: ReturnType<typeof harness>): void {
  h.run(1, [debug({ op: 'setResonance', value: 100 })]);
  h.run(2, [{ t: 'crescendo' }]);
}

describe('Luminary cues', () => {
  it('a hero shines by the sim’s own rule (radianceOf), in and out of the field and in Sunrise', () => {
    for (const path of [[], ['wide_choir', 'searing_hymns']]) {
      const sim = sandbox({ chords: GUARDIAN, ...luminary(...path) });
      stepFor(sim, 30, [{ t: 'thread', slot: 1 }]);
      const w = worldOf(sim);
      const check = () => {
        for (const id of sim.state.party) {
          const e = w.entities.get(id)!;
          expect(shineOf(sim.state, e), `${path} ${e.hero!.defId}`).toBeCloseTo(
            radianceOf(w, e),
            9,
          );
        }
      };
      check();
      expect(shineOf(sim.state, hero(sim, 1))).toBeGreaterThan(0);
      // Step away: the heroes leave every field.
      stepFor(sim, 2, [away]);
      expect(hero(sim, 1).hero!.inField).toBe(false);
      expect(shineOf(sim.state, hero(sim, 1))).toBe(0);
      check();
      // Walk back in, then Sunrise.
      stepFor(sim, 240);
      stepFor(sim, 1, [debug({ op: 'setResonance', value: 100 })]);
      stepFor(sim, 2, [{ t: 'crescendo' }]);
      expect(sim.state.field.crescendo).toBe(true);
      check();
      expect(shineOf(sim.state, hero(sim, 0))).toBeCloseTo(
        sim.state.calling!.radiancePerAura *
          auraCount(hero(sim, 0).hero!.auraMask) *
          sim.state.calling!.sunriseMult,
        9,
      );
    }
    // Without the Luminary nobody shines.
    const plain = sandbox({ chords: GUARDIAN });
    stepFor(plain, 30);
    expect(shineOf(plain.state, hero(plain, 0))).toBe(0);
  });

  it('maps shine to a level: +4% shows, +12% is full, Sunrise is brighter but capped', () => {
    const per = passive('radiance') / 100;
    expect(shineLevel(0)).toBe(0);
    expect(shineLevel(per)).toBeGreaterThan(0.5);
    expect(shineLevel(per * 3)).toBeCloseTo(1, 6);
    expect(shineLevel(per * 2 * passive('sunrise'))).toBeGreaterThan(shineLevel(per * 2) * 1.6);
    expect(shineLevel(10)).toBe(MAX_SHINE_LEVEL);
  });

  it('splits the Weaver’s share three ways and keeps Radiance out of the gold chip', () => {
    const out = { empower: 0, aura: 0, radiance: 0 };
    expect(splitRadiant(100, 30, 20, out)).toEqual({ empower: 50, aura: 30, radiance: 20 });
    expect(splitRadiant(10, 30, 20, out)).toEqual({ empower: 0, aura: 10, radiance: 0 });
    expect(splitRadiant(40, 0, 0, out)).toEqual({ empower: 40, aura: 0, radiance: 0 });
    expect(sunChipText(0.6)).toBeNull();
    expect(sunChipText(12.4)).toBe(`${SUN_GLYPH}+12`);
    // The glyph asks for text presentation (never the colour emoji).
    expect(SUN_GLYPH.endsWith('︎')).toBe(true);
  });

  it('radiant tiers: +4% per aura only glows the number; Sunrise and Searing Hymns get the chip', () => {
    const per = passive('radiance') / 100;
    const frac = (r: number) => r / (1 + r);
    // A hit of 100 before Radiance: `radiance` is 100·r out of 100·(1 + r).
    const tierAt = (r: number) => radiantTier(100 * r, 100 * (1 + r));
    expect(tierAt(0)).toBe(0);
    for (const auras of [1, 2, 3]) expect(tierAt(per * auras), `${auras} auras`).toBe(1);
    expect(frac(per * 3)).toBeLessThan(RADIANT_CHIP);
    const searing = per * callingOption('searing_hymns').values.mult!;
    expect(tierAt(searing * 2)).toBe(2);
    const sun = passive('sunrise');
    expect(tierAt(per * 2 * sun)).toBe(2);
    expect(tierAt(searing * 3 * sun)).toBe(3);
    expect(frac(searing * 3 * sun)).toBeGreaterThanOrEqual(RADIANT_FLARE);
  });

  it('reads the path: Haloed, Dawnward, Lantern Bearer, Sovereign Symphony, Eclipse', () => {
    const look = emptyLook();
    const at = (chords: ChordConfig[], path: string[]) => {
      const sim = sandbox({ chords, ...luminary(...path) });
      stepFor(sim, 2);
      return { ...callingLook(sim.state, look) };
    };
    expect(at(GUARDIAN, [])).toMatchObject({ luminary: true, haloed: false, sovereign: false });
    expect(at(GUARDIAN, ['haloed', 'dawnward'])).toMatchObject({ haloed: true, dawnward: true });
    expect(at(PLANTED, ['wide_choir', 'searing_hymns', 'lantern_bearer'])).toMatchObject({
      haloed: false,
      searing: true,
      lantern: true,
    });
    expect(at(FOUR, SOVEREIGN).sovereign).toBe(true);
    // Sovereign Symphony on the path but only three auras: not in force.
    expect(at(GUARDIAN, SOVEREIGN).sovereign).toBe(false);
    expect(at(GUARDIAN, ECLIPSE)).toMatchObject({ eclipse: true, eclipseOn: false });
    const plain = sandbox({ chords: GUARDIAN });
    stepFor(plain, 2);
    expect(callingLook(plain.state, look).luminary).toBe(false);
    expect(callingValue('dawnward', 'cooldown', -1)).toBe(
      callingOption('dawnward').values.cooldown,
    );
    expect(callingValue('nope', 'pct', 7)).toBe(7);
  });

  it('keeps the Luminary’s colours apart from danger and the gold chip in every palette', () => {
    for (const v of COLOR_VISIONS) {
      const p = visionPalette(v);
      const see = (h: string) => simulateVision(h, v);
      for (const [name, hex] of Object.entries(CALLING_HEX)) {
        expect(deltaE(see(hex), see(p.lethal)), `${v} ${name}/lethal`).toBeGreaterThanOrEqual(20);
        expect(deltaE(see(hex), see(p.threat)), `${v} ${name}/threat`).toBeGreaterThanOrEqual(15);
      }
      // The ☀ chip's fill vs the gold chip (Empower): apart by colour too, not only by shape.
      expect(deltaE(see(CALLING_HEX.sun), see(p.amp)), `${v} sun/amp`).toBeGreaterThanOrEqual(20);
      // Dawnward's bloom vs the barrier colour.
      expect(deltaE(see(CALLING_HEX.dawn), see(p.shield)), `${v} dawn/shield`).toBeGreaterThan(20);
    }
  });
});

describe('the Luminary in the fight (real sim → render)', () => {
  afterEach(() => {
    applyVision('normal');
  });

  it('Radiance: heroes in the field shine, brighten quickly and fade out (no pop)', () => {
    const sim = sandbox({ chords: GUARDIAN, ...luminary() });
    const h = harness(sim);
    h.run(1);
    // The first frames ramp up rather than pop.
    const first = h.shine(0);
    const target = shineLevel(shineOf(sim.state, hero(sim, 0)));
    expect(target).toBeGreaterThan(0.5);
    expect(first).toBeGreaterThan(0);
    expect(first).toBeLessThan(target * 0.5);
    h.run(18);
    expect(h.shine(0)).toBeGreaterThan(target * 0.9);
    expect(h.view.drawn.shining).toBe(3);
    // The model gets the sunlight: the hero's batch carries it.
    const lit = h.tick();
    expect(lit.beams).toBeGreaterThanOrEqual(3);
    // Step away: out of the field, the light fades over a few frames.
    h.run(2, [away]);
    expect(hero(sim, 0).hero!.inField).toBe(false);
    const kindled = h.view.fired.kindle;
    const fading = h.shine(0);
    expect(fading).toBeGreaterThan(0.05);
    expect(fading).toBeLessThan(target);
    h.run(12);
    expect(h.shine(0)).toBeLessThan(fading);
    expect(h.shine(0)).toBeGreaterThan(0);
    // Kael's light is gone before he walks back in (about 1.5 s; the others are nearer).
    let dark = false;
    for (let i = 0; i < 70 && !dark; i++) {
      h.tick();
      dark = h.shine(0) === 0 && h.view.drawn.shining < 3;
    }
    expect(dark).toBe(true);
    // Walking back in, a hero whose light went out kindles once (Vexis, the nearest, is back
    // before hers has faded, so she just brightens again).
    h.run(240);
    expect(h.view.drawn.shining).toBe(3);
    expect(h.view.fired.kindle - kindled).toBeGreaterThanOrEqual(2);
    expect(h.view.fired.kindle - kindled).toBeLessThanOrEqual(3);
  });

  it('no Calling, no light: nothing shines, no sun, no halos', () => {
    const sim = sandbox({ chords: GUARDIAN });
    const h = harness(sim);
    h.run(30);
    sunrise(h);
    h.run(30);
    expect(sim.state.field.crescendo).toBe(true);
    expect(h.shine(0)).toBe(0);
    expect(h.view.drawn).toEqual({
      shining: 0,
      haloes: 0,
      marked: 0,
      circlet: 0,
      sunRays: 0,
      sun: 0,
    });
    expect(h.view.fired.sunrise).toBe(0);
    expect(h.view.warmth).toBe(0);
  });

  it('Sunrise (the Luminary’s): heroes burn brighter, a sun rises, the field and light warm', () => {
    const sim = sandbox({ chords: GUARDIAN, ...luminary() });
    const h = harness(sim);
    h.run(40);
    const before = h.shine(0);
    sunrise(h);
    expect(h.view.fired.sunrise).toBe(1);
    h.run(60);
    expect(sim.state.field.crescendo).toBe(true);
    expect(h.shine(0) / before).toBeCloseTo(Math.sqrt(passive('sunrise')), 1);
    expect(h.view.sun).toBeGreaterThan(0.9);
    expect(h.view.warmth).toBeGreaterThan(0.9);
    expect(h.view.drawn.sun).toBe(1);
    expect(h.view.drawn.sunRays).toBe(3);
    // The field shader's Sunrise parameter is on for every drawn field.
    expect(h.field.batchInstance(0).lum[0]).toBeGreaterThan(0.9);
    expect(h.field.batchInstance(1).lum[0]).toBeGreaterThan(0.9);
    // It ends: the sun sets.
    h.run(60 * 8);
    expect(sim.state.field.crescendo).toBe(false);
    expect(h.view.sun).toBe(0);
    expect(h.view.drawn.sun).toBe(0);
  });

  it('radiant hits: a spark only when Radiance is a real part of the hit, rate-limited', () => {
    const fight = (path: string[], sun: boolean) => {
      const sim = sandbox({ chords: GUARDIAN, ...luminary(...path) });
      const h = harness(sim);
      h.run(2, [spawn('bell_brute', -2.5, -5.5)]);
      h.run(1, [spawn('bell_brute', 2.5, -5.5)]);
      if (sun) sunrise(h);
      h.run(60 * 4);
      const radiant = ofType(h.events, 'damageTaken').filter((e) => e.radiance > 0);
      return { h, radiant };
    };
    // +4% per aura outside Sunrise: the numbers glow, nothing sparks.
    const plain = fight([], false);
    expect(plain.radiant.length).toBeGreaterThan(3);
    expect(plain.h.view.fired.glow).toBe(plain.radiant.length);
    expect(plain.h.view.fired.spark + plain.h.view.fired.flare).toBe(0);
    // Sunrise: Radiance ×3 crosses the chip threshold, and the target sparks.
    const lit = fight([], true);
    const big = lit.radiant.filter((e) => radiantTier(e.radiance, e.amount + e.absorbed) >= 2);
    expect(big.length).toBeGreaterThan(0);
    expect(lit.h.view.fired.spark + lit.h.view.fired.flare).toBeGreaterThan(0);
    expect(lit.h.view.fired.spark + lit.h.view.fired.flare).toBeLessThanOrEqual(big.length);
    // Two radiant hits on one target in the same frame make one spark.
    const sim = sandbox({ chords: GUARDIAN, ...luminary() });
    const h = harness(sim);
    h.run(2, [spawn('bell_brute', 0, -5)]);
    const target = [...sim.state.entities.list()].find((e) => e.enemy)!.id;
    const hit: SimEvent = {
      type: 'damageTaken',
      tick: sim.tick,
      target,
      source: sim.state.party[0]!,
      amount: 100,
      absorbed: 0,
      amplified: 40,
      aura: 0,
      radiance: 40,
      eclipse: 0,
      crit: false,
      telegraph: null,
      hit: 'hit',
    };
    h.view.handle([hit, { ...hit }], sim.state);
    expect(h.view.fired.flare).toBe(1);
    expect(h.view.activeCount('spark')).toBe(1);
  });

  it('Dawnward: each hero stepping into the field gets one dawn bloom with its barrier', () => {
    const sim = sandbox({ chords: GUARDIAN, ...luminary('haloed', 'dawnward') });
    const h = harness(sim);
    h.run(30);
    h.run(240, [away]);
    const dawn = ofType(h.events, 'dawnward');
    expect(dawn.length).toBe(3);
    expect(h.view.fired.dawn).toBe(3);
    expect(h.callouts.filter((c) => c.startsWith(SUN_GLYPH))).toHaveLength(3);
    expect(h.callouts).toContain(`${SUN_GLYPH} +${Math.round(dawn[0]!.amount)}`);
    // The generic overshield ring is skipped for the barrier Dawnward gave (same tick).
    const shield = ofType(h.events, 'shieldApplied').find((e) => e.target === dawn[0]!.hero)!;
    expect(shield.tick).toBe(dawn[0]!.tick);
    expect(dawnwardIn([shield, dawn[0]!], shield.target)).toBe(true);
    expect(dawnwardIn([shield], shield.target)).toBe(false);
    // A bloom draws its veil (a shell) while it plays.
    const sim2 = sandbox({ chords: GUARDIAN, ...luminary('haloed', 'dawnward') });
    const h2 = harness(sim2);
    h2.run(30);
    h2.run(1, [away]);
    let peakShells = 0;
    for (let i = 0; i < 240; i++) peakShells = Math.max(peakShells, h2.tick().shells);
    expect(h2.view.fired.dawn).toBe(3);
    expect(peakShells).toBeGreaterThan(0);
    // Without Dawnward on the path, no barrier and no bloom.
    const none = sandbox({ chords: GUARDIAN, ...luminary('haloed') });
    const h3 = harness(none);
    h3.run(30);
    h3.run(240, [away]);
    expect(ofType(h3.events, 'dawnward')).toHaveLength(0);
    expect(h3.view.fired.dawn).toBe(0);
  });

  it('Haloed: a halo over exactly the heroes in the field', () => {
    const sim = sandbox({ chords: GUARDIAN, ...luminary('haloed') });
    const h = harness(sim);
    h.run(30);
    expect(h.view.drawn.haloes).toBe(3);
    h.run(2, [away]);
    expect(sim.state.party.every((id) => !sim.state.entities.get(id)!.hero!.inField)).toBe(true);
    // The halos fade out with the light and come back as the heroes walk in.
    let fewest = 3;
    for (let i = 0; i < 240; i++) {
      h.tick();
      const lit = sim.state.party.filter((id) => h.entities.recs.get(id)!.lit > 0.01).length;
      expect(h.view.drawn.haloes).toBe(lit);
      fewest = Math.min(fewest, lit);
    }
    expect(fewest).toBeLessThan(3);
    expect(h.view.drawn.haloes).toBe(3);
    const plain = harness(sandbox({ chords: GUARDIAN, ...luminary('wide_choir') }));
    plain.run(30);
    expect(plain.view.drawn.haloes).toBe(0);
  });

  it('Lantern Bearer: a planted field carries a lantern and a stronger ring', () => {
    const at = (path: string[]) => {
      const sim = sandbox({ chords: PLANTED, ...luminary(...path) });
      const h = harness(sim);
      h.run(10);
      h.run(40, [{ t: 'plant', point: { x: 4, z: -3 } }]);
      const planted = sim.state.field.chords.findIndex((c) => c.anchor === 'planted');
      return { h, planted };
    };
    const lantern = at(['haloed', 'dawnward', 'lantern_bearer']);
    expect(lantern.planted).toBe(1);
    expect(lantern.h.field.drawn.lanterns).toBe(1);
    expect(lantern.h.field.batchInstance(lantern.planted).lum[2]).toBe(1);
    // The beam's echo round the Weaver isn't planted: no lantern on it.
    expect(lantern.h.field.batchInstance(0).lum[2]).toBe(0);
    const plain = at(['haloed', 'dawnward']);
    expect(plain.h.field.drawn.lanterns).toBe(0);
    expect(plain.h.field.batchInstance(plain.planted).lum[2]).toBe(0);
  });

  it('Sovereign Symphony: the field is crowned and a circlet shines over the Weaver', () => {
    const sim = sandbox({ chords: FOUR, ...luminary(...SOVEREIGN) });
    const h = harness(sim);
    h.run(60);
    expect(sim.state.calling!.sovereign).toBe(true);
    expect(h.view.drawn.circlet).toBe(1);
    expect(h.field.drawn.crowned).toBe(1);
    // Only the outermost field (the field song) wears the crown, not the beam's echo.
    expect(h.field.batchInstance(1).lum[3]).toBeGreaterThan(0.9);
    expect(h.field.batchInstance(0).lum[3]).toBe(0);
    // On the path but three auras: no crown.
    const short = harness(sandbox({ chords: GUARDIAN, ...luminary(...SOVEREIGN) }));
    short.run(60);
    expect(short.view.drawn.circlet).toBe(0);
    expect(short.field.drawn.crowned).toBe(0);
  });

  it('Eclipse: in Sunrise, a dark rim with a corona, and every vulnerable enemy marked', () => {
    const sim = sandbox({ chords: GUARDIAN, ...luminary(...ECLIPSE) });
    const h = harness(sim);
    h.run(2, [spawn('bell_brute', -2.5, -5.5)]);
    h.run(1, [spawn('bell_brute', 2.5, -5.5)]);
    h.run(30);
    // Before Sunrise: nothing.
    expect(h.view.drawn.marked).toBe(0);
    expect(h.field.drawn.eclipseRims).toBe(0);
    sunrise(h);
    h.run(60);
    expect(sim.state.field.crescendo).toBe(true);
    const marked = [...sim.state.entities.list()].filter((e) => eclipseMarks(sim.state, e));
    // The sim's rule: Sunrise on and the enemy in the field.
    for (const e of sim.state.entities.list())
      if (e.enemy && !e.health?.dead)
        expect(eclipseMarks(sim.state, e)).toBe(sim.state.field.crescendo && e.enemy.inField);
    // Any loadout: Guardian holds nothing for enemies, and the brutes in the light are marked.
    expect(marked.length).toBe(2);
    expect(h.view.drawn.marked).toBe(marked.length);
    // One dark rim, on the outermost field only.
    expect(h.field.drawn.eclipseRims).toBe(1);
    expect(h.field.batchInstance(1).lum[1]).toBeGreaterThan(0.9);
    expect(h.field.batchInstance(0).lum[1]).toBe(0);
    // Eclipse's part of a hit (`damageTaken.eclipse`) flickers a corona at the target, rate-
    // limited per target; Radiance's part still sparks on its own.
    const eclipsed = ofType(h.events, 'damageTaken').filter((e) => e.eclipse > 0);
    expect(eclipsed.length).toBeGreaterThan(0);
    for (const e of eclipsed)
      expect(
        marked.some((m) => m.id === e.target) || !sim.state.entities.get(e.target)?.enemy?.inField,
      ).toBe(true);
    expect(h.view.fired.eclipse).toBeGreaterThan(0);
    expect(h.view.fired.eclipse).toBeLessThanOrEqual(eclipsed.length);
    expect(h.view.fired.spark + h.view.fired.flare).toBeGreaterThan(0);
    // A hit with only Eclipse's part (the attacker didn't shine) gets the corona, not a spark.
    const before = { ...h.view.fired };
    const target = marked[0]!.id;
    h.view.handle(
      [
        {
          type: 'damageTaken',
          tick: sim.tick,
          target,
          source: sim.state.party[0]!,
          amount: 100,
          absorbed: 0,
          amplified: 15,
          aura: 0,
          radiance: 0,
          eclipse: 15,
          crit: false,
          telegraph: null,
          hit: 'hit',
        },
      ],
      sim.state,
    );
    expect(h.view.fired.spark + h.view.fired.flare).toBe(before.spark + before.flare);
    expect(h.view.fired.glow).toBe(before.glow);
    // Eclipse off the path: Sunrise has no rim and marks nobody.
    const plain = sandbox({ chords: GUARDIAN, ...luminary('haloed', 'dawnward') });
    const hp = harness(plain);
    hp.run(2, [spawn('bell_brute', 0, -5)]);
    sunrise(hp);
    hp.run(60);
    expect(hp.view.drawn.marked).toBe(0);
    expect(hp.field.drawn.eclipseRims).toBe(0);
  });

  it('Third Voice: the field song’s third aura gets its own band', () => {
    const sim = sandbox({
      chords: [
        { auras: ['fortissimo'], ornaments: [] },
        { auras: ['sostenuto', 'ostinato', 'allegro'], ornaments: ['grace_note'] },
      ],
      ...luminary('haloed', 'dawnward', 'third_voice'),
    });
    const h = harness(sim);
    h.run(10);
    expect(h.field.drawn.thirdBands).toBe(1);
    const inst = h.field.batchInstance(1);
    expect(inst.count).toBe(3);
    const allegro = auraColor('allegro');
    [allegro.r, allegro.g, allegro.b].forEach((v, i) => expect(inst.third[i]).toBeCloseTo(v, 5));
    // Two auras: two bands, as before.
    const two = harness(sandbox({ chords: GUARDIAN, ...luminary() }));
    two.run(10);
    expect(two.field.batchInstance(1).count).toBe(1);
    expect(two.field.drawn.thirdBands).toBe(0);
  });

  it('flashes 0 vs 1: the same visuals draw, only the flares are dimmer', () => {
    const counts = (flashes: number) => {
      const sim = sandbox({ chords: GUARDIAN, ...luminary('haloed', 'dawnward') });
      const h = harness(sim);
      for (let i = 0; i < 30; i++) h.tick([], flashes);
      sunrise(h);
      for (let i = 0; i < 30; i++) h.tick([], flashes);
      return { last: h.tick([], flashes), fired: { ...h.view.fired } };
    };
    const on = counts(1);
    const off = counts(0);
    expect(off.fired).toEqual(on.fired);
    expect(off.last.rings).toBe(on.last.rings);
    expect(off.last.beams).toBe(on.last.beams);
    expect(off.last.sprites).toBe(on.last.sprites);
  });

  it('stays cheap per frame (Sovereign path, Sunrise, a fight)', () => {
    const sim = sandbox({ chords: FOUR, ...luminary(...SOVEREIGN) });
    const h = harness(sim);
    h.run(2, [spawn('bell_brute', -2.5, -5.5)]);
    h.run(1, [spawn('bell_brute', 2.5, -5.5)]);
    sunrise(h);
    h.run(30);
    const kit = h.kit;
    const cam = new THREE.Vector3(0, 22, 18);
    const N = 2000;
    let t = 100;
    const t0 = performance.now();
    for (let i = 0; i < N; i++) {
      kit.begin(t, cam);
      h.view.sync(sim.state, 1 / 60, t, 1);
      kit.end(1 / 60, 1280, 720, 720, 45);
      t += 1 / 60;
    }
    const us = ((performance.now() - t0) / N) * 1000;
    // Includes FxKit.begin/end (particles); generous for a shared CI machine.
    expect(us).toBeLessThan(400);
    expect(h.view.drawn.shining).toBe(3);
  });
});
