/**
 * Phase 6 VFX (docs/phase-6.md, W6): Tyrant, Mimicry and the Postlude in the world. The sim does
 * not set `enemy.tyrant` or `field.finale.postlude`, nor emit `tyrantEdict`, `postludeRose` or
 * `postludePair`, in this tree yet (W1 builds them), so every check drives the real sim, the real
 * EntityLayer, TelegraphLayer and FxKit, and stages the state and events with W0's shapes
 * (`TyrantHold`, `PostludeField`, the three events), as the earlier phases' presentation tests do.
 *
 * Covered: Tyrant's band in the borrowed foe's accent for each boss of the table, its crown sigil
 * over (only) a cast of the borrowed attack, the edict's moment, a phase shift taking up the next
 * foe; the Postlude's rise (the Conductor's pose and the Finale-palette rise), the orrery dark then
 * re-lit ring by ring from the bottom, all eight by `riseUntil`, a pair's link and answering
 * sigils; the Flashes setting; Mimicking's look on Movement I and II enemy models (its crown gem,
 * the mirror's shimmer and copied glyph); nothing drawn, and every frame the same, with no Phase 6
 * state or event; no new draw call.
 */
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { enemyDef } from '../src/content';
import { CONDUCTOR, ALTO, BASS, DOWNBEAT, SFORZANDO } from '../src/content/crucibleIds';
import {
  CRUCIBLE_HEX,
  FINALE_HEX,
  ORRERY,
  crucibleSky,
  emptySky,
} from '../src/render/crucibleCues';
import { riseShape, emptyRiseShape } from '../src/render/dissonanceCues';
import { EntityLayer } from '../src/render/entities';
import { FxKit } from '../src/render/fx/kit';
import { SPRITE } from '../src/render/fx/sprites';
import { createModelMaterial } from '../src/render/models/material';
import type { Overlay } from '../src/render/overlay';
import { PostludeView } from '../src/render/postlude';
import {
  PAIR_LINK_SECONDS,
  POSTLUDE_HEX,
  pairOf,
  postludeOf,
  postludeRise,
  postludeRising,
  postludeShape,
  postludeSky,
  riseLength,
} from '../src/render/postludeCues';
import { TelegraphLayer } from '../src/render/telegraphs';
import { TyrantView } from '../src/render/tyrant';
import {
  TYRANT_FALLBACK_HEX,
  isBorrowed,
  isTyrantAttack,
  tyrantAccentHex,
  tyrantFoeName,
  tyrantMarkHex,
  tyrantBosses,
  tyrantCasting,
  tyrantEdicts,
  tyrantOf,
} from '../src/render/tyrantCues';
import type { FrameInfo } from '../src/render/types';
import {
  TYRANT_TABLE,
  createSim,
  tyrantAttackOf,
  type EntityId,
  type PostludeField,
  type ReadonlyEntity,
  type Sim,
  type SimEvent,
  type TyrantHold,
} from '../src/sim';
import { makeBot } from '../src/bots';
import { dealDamage } from '../src/sim/combat/health';
import { SCENARIO_BELLWARDEN, SCENARIO_CONDUCTOR, type Scenario } from '../tools/scenarios';
import { spawnEnemy } from '../src/sim/systems/enemies';
import { sandbox, spawn, worldOf } from './sim/helpers';

const SETTINGS: FrameInfo['settings'] = {
  screenShake: 1,
  flashes: 1,
  damageNumbers: true,
  colorVision: 'normal',
};

/**
 * The sim's Tyrant table (W1's, with its swaps: the Hemomancer's Blood Pact for the Leech's Latch),
 * phase by phase, for the Movement I-III bosses: boss → [foe, attack][].
 */
const TABLE: Record<string, [string, string][]> = Object.fromEntries(
  Object.entries(TYRANT_TABLE)
    .filter(([boss]) => boss !== CONDUCTOR)
    .map(([boss, rows]) => [
      boss,
      rows.flatMap((r) => (r ? [[r.from, r.attack] as [string, string]] : [])),
    ]),
);

/** A boss's hold for a phase, from the sim's own table: [foe, attack]. */
function entry(boss: string, phase: number): [string, string] {
  const e = tyrantAttackOf(boss, phase);
  if (!e) throw new Error(`no Tyrant entry for ${boss} ${phase}`);
  return [e.from, e.attack];
}

/** An overlay that records the badges it is asked for (and ignores the rest). */
class FakeOverlay {
  width = 1280;
  height = 720;
  badges: { answers: string[]; label: string }[] = [];
  beginFrame(): void {
    this.badges.length = 0;
  }
  badge(
    _x: number,
    _y: number,
    _z: number,
    answers: readonly string[],
    _key: string,
    _border: string,
    label: string,
  ): void {
    this.badges.push({ answers: [...answers], label });
  }
  raid(): void {}
  callout(): void {}
  danger(): void {}
}

/**
 * The real layers over a real FxKit, driven by a real sim (a tick a frame): the bodies, the
 * telegraphs, and the two Phase 6 views. `extra` events are handed to the views with the sim's.
 */
function harness(sim: Sim) {
  const kit = new FxKit();
  const entities = new EntityLayer(createModelMaterial());
  const telegraphs = new TelegraphLayer(entities);
  const overlay = new FakeOverlay();
  const tyrant = new TyrantView({ kit, recs: entities.recs });
  const postlude = new PostludeView({
    kit,
    recs: entities.recs,
    finale: (s) => s.field.finale ?? null,
  });
  const cam = new THREE.Vector3(0, 22, 18);
  let time = 0;
  const tick = (commands: Parameters<Sim['step']>[0] = [], extra: SimEvent[] = [], flashes = 1) => {
    sim.step(commands);
    const ev = [...sim.drainEvents(), ...extra];
    tyrant.handle(ev, sim.state);
    postlude.handle(ev, sim.state);
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
    overlay.beginFrame();
    entities.sync(sim.state, frame, kit, 1 / 60);
    telegraphs.sync(sim.state, kit, overlay as unknown as Overlay, 1 / 60, true);
    const was = {
      rings: kit.rings.size,
      sprites: kit.sprites.size + kit.spritesTop.size,
      beams: kit.beams.size,
    };
    tyrant.sync(sim.state, 1 / 60, time, flashes);
    postlude.sync(sim.state, 1 / 60, time, flashes);
    const mine = {
      rings: kit.rings.size - was.rings,
      sprites: kit.sprites.size + kit.spritesTop.size - was.sprites,
      beams: kit.beams.size - was.beams,
    };
    kit.end(1 / 60, 1280, 720, 720, 45);
    time += 1 / 60;
    return { mine, events: ev };
  };
  const run = (n: number, first: Parameters<Sim['step']>[0] = []) => {
    for (let i = 0; i < n; i++) tick(i === 0 ? first : []);
  };
  return { kit, entities, telegraphs, overlay, tyrant, postlude, tick, run };
}

const newest = (sim: Sim, defId: string): ReadonlyEntity => {
  let found: ReadonlyEntity | undefined;
  for (const e of sim.state.entities.list()) if (e.enemy?.defId === defId) found = e;
  if (!found) throw new Error(`no ${defId}`);
  return found;
};

/** Every enemy holds out, so a moment isn't cut short by the heroes. */
function tough(sim: Sim): void {
  for (const e of worldOf(sim).entities.list())
    if (e.enemy && e.health) e.health.hp = e.health.maxHp = 1e7;
}

/** A boss's Tyrant hold, written as W1's sim will (test staging only). */
function hold(sim: Sim, boss: ReadonlyEntity, from: string, attack: string, phase = 1): TyrantHold {
  const e = worldOf(sim).entities.get(boss.id)!;
  const h: TyrantHold = { attack, from, phase, readyAt: sim.state.time + 6 };
  e.enemy!.tyrant = h;
  return h;
}

const edict = (sim: Sim, boss: EntityId, h: TyrantHold): SimEvent => ({
  type: 'tyrantEdict',
  tick: sim.tick,
  boss,
  phase: h.phase,
  attack: h.attack,
  from: h.from,
});

/** The Postlude in the Finale's field, written as W1's sim will (test staging only). */
function postludeOn(sim: Sim, rise = 3): PostludeField {
  const w = worldOf(sim);
  const p: PostludeField = { since: w.time, riseUntil: w.time + rise };
  w.field.finale = { ...(w.field.finale ?? {}), postlude: p };
  return p;
}

describe('Tyrant: the pure readers', () => {
  it('every table foe’s band is its own body’s accent; an unknown foe is the neutral', () => {
    for (const rows of Object.values(TABLE))
      for (const [foe] of rows) expect(tyrantAccentHex(foe), foe).toBe(enemyDef(foe).accent);
    expect(tyrantAccentHex('nobody_has_this')).toBe(TYRANT_FALLBACK_HEX);
    expect(tyrantAccentHex(null)).toBe(TYRANT_FALLBACK_HEX);
  });

  it('reads the hold, a cast of the held attack, and the edicts of a batch', () => {
    const sim = sandbox();
    const h = harness(sim);
    h.run(2, [spawn('the_bellwarden', 0, -9)]);
    const b = newest(sim, 'the_bellwarden');
    expect(tyrantOf(b)).toBeNull();
    expect(tyrantCasting(b)).toBe(false);
    expect(tyrantBosses(sim.state, [])).toEqual([]);
    const held = hold(sim, b, ...entry('the_bellwarden', 1));
    expect(tyrantOf(b)).toEqual(held);
    expect(tyrantBosses(sim.state, [99])).toEqual([b.id]);
    expect(isTyrantAttack(b, entry('the_bellwarden', 1)[1])).toBe(true);
    expect(isTyrantAttack(b, 'bellwarden_toll')).toBe(false);
    worldOf(sim).entities.get(b.id)!.enemy!.cast = {
      attackId: entry('the_bellwarden', 1)[1],
      name: 'Lance',
      telegraph: null,
      start: sim.state.time,
      end: sim.state.time + 1.5,
      interruptible: false,
    };
    expect(tyrantCasting(b)).toBe(true);
    worldOf(sim).entities.get(b.id)!.enemy!.cast!.attackId = 'something_of_its_own';
    expect(tyrantCasting(b)).toBe(false);
    const ev = edict(sim, b.id, held);
    expect(tyrantEdicts([{ type: 'waveStarted', tick: 0, wave: 1 } as SimEvent, ev])).toEqual([ev]);
  });
});

describe('Tyrant in the world', () => {
  it('each boss of the table wears its phase’s foe’s band; a phase shift takes up the next', () => {
    for (const [boss, rows] of Object.entries(TABLE)) {
      const sim = sandbox();
      const h = harness(sim);
      h.run(2, [spawn(boss, 0, -10)]);
      tough(sim);
      const b = newest(sim, boss);
      expect(h.tick().mine, boss).toEqual({ rings: 0, sprites: 0, beams: 0 });
      rows.forEach(([foe, attack], i) => {
        const held = hold(sim, b, foe, attack, i + 1);
        const f = h.tick([], [edict(sim, b.id, held)]);
        expect(h.tyrant.drawn.bands, `${boss} ${i + 1}`).toBeGreaterThanOrEqual(1);
        expect(h.tyrant.drawn.edicts, `${boss} ${i + 1}`).toBe(1);
        expect(f.mine.rings).toBeGreaterThan(0);
        // The band's colour is that foe's accent (its body's own colour).
        expect(tyrantAccentHex(tyrantOf(sim.state.entities.get(b.id))!.from)).toBe(
          enemyDef(foe).accent,
        );
      });
      expect(h.tyrant.fired.edicts, boss).toBe(rows.length);
    }
  });

  it('the crown sigil shows over a cast of the borrowed attack only', () => {
    const sim = sandbox();
    const h = harness(sim);
    h.run(2, [spawn('vharun_crimson_warden', 0, -10)]);
    tough(sim);
    const b = newest(sim, 'vharun_crimson_warden');
    const [, latch] = entry('vharun_crimson_warden', 1);
    hold(sim, b, ...entry('vharun_crimson_warden', 1));
    h.tick();
    expect(h.tyrant.drawn.crowns).toBe(0);
    const e = worldOf(sim).entities.get(b.id)!;
    e.enemy!.cast = {
      attackId: latch,
      name: 'Latch',
      telegraph: null,
      start: sim.state.time,
      end: sim.state.time + 2,
      interruptible: false,
    };
    // The sim may clear or replace the cast on its own step: hold it for the frame.
    const crowns: number[] = [];
    for (let i = 0; i < 5; i++) {
      e.enemy!.cast = { ...e.enemy!.cast!, attackId: latch };
      sim.step([]);
      e.enemy!.cast = {
        attackId: latch,
        name: 'Latch',
        telegraph: null,
        start: sim.state.time - 0.1,
        end: sim.state.time + 2,
        interruptible: false,
      };
      h.tyrant.sync(sim.state, 1 / 60, 0, 1);
      crowns.push(h.tyrant.drawn.crowns);
    }
    expect(crowns.every((n) => n === 1)).toBe(true);
    // A cast of its own attack: no crown.
    e.enemy!.cast = { ...e.enemy!.cast!, attackId: 'vharun_execution' };
    h.tyrant.sync(sim.state, 1 / 60, 0, 1);
    expect(h.tyrant.drawn.crowns).toBe(0);
    expect(SPRITE.crown).toBe(21);
  });

  it('the edict plays out and ends; it waits for a body not drawn yet, and lets go of a dead one', () => {
    const sim = sandbox();
    const h = harness(sim);
    h.run(2, [spawn('the_seamstress', 0, -10)]);
    tough(sim);
    const b = newest(sim, 'the_seamstress');
    const held = hold(sim, b, ...entry('the_seamstress', 1));
    h.tick([], [edict(sim, b.id, held)]);
    let frames = 0;
    while (h.tyrant.drawn.edicts > 0 && frames < 200) {
      h.tick();
      frames++;
    }
    // About EDICT_SECONDS (1.1 s) of frames.
    expect(frames).toBeGreaterThan(55);
    expect(frames).toBeLessThan(75);
    // An edict for a body that never appears fades out without drawing.
    h.tick([], [edict(sim, 9999 as EntityId, held)]);
    expect(h.tyrant.drawn.edicts).toBe(0);
    for (let i = 0; i < 80; i++) h.tick();
    expect(h.tyrant.drawn.edicts).toBe(0);
  });

  it('honours Flashes: the band holds still and the edict’s flash is scaled down', () => {
    const run = (flashes: number) => {
      const sim = sandbox();
      const h = harness(sim);
      h.run(2, [spawn('the_bellwarden', 0, -9)]);
      tough(sim);
      const b = newest(sim, 'the_bellwarden');
      const held = hold(sim, b, ...entry('the_bellwarden', 1));
      const counts: number[] = [];
      counts.push(h.tick([], [edict(sim, b.id, held)], flashes).mine.sprites);
      for (let i = 0; i < 30; i++) counts.push(h.tick([], [], flashes).mine.sprites);
      return counts;
    };
    // The same marks are drawn at any Flashes (nothing hidden); only motion and brightness change.
    expect(run(0)).toEqual(run(1));
  });
});

describe('the Postlude: the pure readers', () => {
  it('the rise’s progress, its length and whether it still holds', () => {
    const p: PostludeField = { since: 10, riseUntil: 13 };
    expect(postludeOf({ postlude: p })).toBe(p);
    expect(postludeOf({})).toBeNull();
    expect(postludeOf(null)).toBeNull();
    expect(riseLength(p)).toBe(3);
    expect(postludeRise(null, 11)).toBe(-1);
    expect(postludeRise(p, 9)).toBe(0);
    expect(postludeRise(p, 11.5)).toBeCloseTo(0.5, 9);
    expect(postludeRise(p, 20)).toBe(1);
    expect(postludeRising(p, 12.99)).toBe(true);
    expect(postludeRising(p, 13)).toBe(false);
    expect(postludeRising(null, 11)).toBe(false);
  });

  it('the orrery goes dark and re-lights ring by ring from the bottom, all eight by riseUntil', () => {
    const p: PostludeField = { since: 10, riseUntil: 13 };
    const lit: number[] = [];
    for (let t = 10; t < 13; t += 1 / 60) {
      const sky = crucibleSky({ postlude: p }, undefined, t, emptySky());
      lit.push(postludeSky(p, t, sky).notes);
    }
    expect(lit[0]).toBe(0);
    for (let i = 1; i < lit.length; i++) expect(lit[i]!).toBeGreaterThanOrEqual(lit[i - 1]!);
    expect(new Set(lit)).toEqual(new Set([0, 1, 2, 3, 4, 5, 6, 7, 8]));
    expect(lit[lit.length - 1]).toBe(ORRERY.rings);
    // Each ring takes an eighth of the rise.
    const at = (t: number) => postludeSky(p, t, emptySky()).notes;
    expect(at(10 + 3 / 8 - 0.01)).toBe(1);
    expect(at(10 + 3 / 8 + 0.01)).toBe(2);
    // Once it stands the orrery follows the stems again, exactly as crucibleSky made it.
    const after = crucibleSky({ postlude: p }, undefined, 14, emptySky());
    expect(postludeSky(p, 14, { ...after, stems: [...after.stems] })).toEqual(after);
    expect(after.notes).toBe(-1);
    // Without a Postlude: untouched.
    const plain = crucibleSky(null, undefined, 11, emptySky());
    expect(postludeSky(null, 11, { ...plain, stems: [...plain.stems] })).toEqual(plain);
  });

  it('the Conductor’s pose is Restless Dead’s rise stretched to the rise', () => {
    const p: PostludeField = { since: 0, riseUntil: 3 };
    for (const k of [0, 0.1, 0.22, 0.5, 0.9, 1]) {
      const a = postludeShape(p, k * 3, emptyRiseShape());
      const b = riseShape(k * 0.8, emptyRiseShape());
      expect(a).toEqual(b);
    }
    // Down at the fall, standing at the end.
    expect(postludeShape(p, 0.66, emptyRiseShape()).lie).toBeGreaterThan(0.9);
    expect(postludeShape(p, 3, emptyRiseShape()).lie).toBe(0);
  });

  it('draws in the Finale’s own disc colours: brass, the stave’s slate, the choir’s glass', () => {
    expect(POSTLUDE_HEX.brass).toBe(FINALE_HEX.baton);
    expect(POSTLUDE_HEX.stave).toBe(CRUCIBLE_HEX.stave);
    expect(POSTLUDE_HEX.glass).toBe(CRUCIBLE_HEX.glass);
    expect(pairOf([3, 4, 5])).toEqual([3, 4]);
    expect(pairOf([3])).toBeNull();
  });
});

describe('the Postlude in the world', () => {
  it('the Conductor falls and stands back up over the rise, then the rise is gone', () => {
    const sim = sandbox();
    const h = harness(sim);
    h.run(2, [spawn(CONDUCTOR, 0, -12)]);
    tough(sim);
    const boss = newest(sim, CONDUCTOR);
    postludeOn(sim, 3);
    const rose: SimEvent = { type: 'postludeRose', tick: sim.tick, boss: boss.id, hp: 300 };
    const drawn: number[] = [];
    const poses: number[] = [];
    let f = h.tick([], [rose]);
    expect(f.mine.rings + f.mine.sprites).toBeGreaterThan(0);
    for (let i = 0; i < 60 * 3.6; i++) {
      drawn.push(h.postlude.drawn.rising);
      f = h.tick();
      poses.push(h.entities.drawn6.postludeRise);
    }
    expect(h.postlude.fired.rises).toBe(1);
    // Drawn through the rise (3 s) and its settling, then nothing.
    expect(drawn.slice(0, 170).every((n) => n === 1)).toBe(true);
    expect(drawn.slice(-10).every((n) => n === 0)).toBe(true);
    // The pose: one Conductor through the rise, none after it.
    expect(poses.slice(0, 170).every((n) => n === 1)).toBe(true);
    expect(poses.slice(-30).every((n) => n === 0)).toBe(true);
    expect(f.mine).toEqual({ rings: 0, sprites: 0, beams: 0 });
  });

  it('a pair: a link between the two voices and two answering sigils, for the link’s length', () => {
    const sim = sandbox();
    const h = harness(sim);
    h.run(2, [spawn(CONDUCTOR, 0, -12), spawn(ALTO, -5, -7), spawn(BASS, 5, -7)]);
    tough(sim);
    postludeOn(sim, 0.01);
    for (let i = 0; i < 30; i++) h.tick();
    const a = newest(sim, ALTO).id;
    const b = newest(sim, BASS).id;
    const f = h.tick([], [{ type: 'postludePair', tick: sim.tick, voices: [a, b] }]);
    expect(h.postlude.fired.pairs).toBe(1);
    expect(h.postlude.drawn.links).toBe(1);
    expect(h.postlude.drawn.sigils).toBe(2);
    expect(f.mine.sprites).toBeGreaterThanOrEqual(2);
    // The link fades in over its first fifth of a second.
    for (let i = 0; i < 20; i++) h.tick();
    expect(h.tick().mine.beams).toBe(1);
    let frames = 0;
    while (h.postlude.drawn.links > 0 && frames < 400) {
      h.tick();
      frames++;
    }
    expect(frames / 60).toBeCloseTo(PAIR_LINK_SECONDS, 0);
    // A pair of one voice draws nothing.
    h.tick([], [{ type: 'postludePair', tick: sim.tick, voices: [a] }]);
    expect(h.postlude.drawn.links).toBe(0);
  });
});

describe('Mimicry: 5c’s Mimicking look on Movement I and II models', () => {
  const MODELS = ['bell_brute', 'glass_lancer', 'leech', 'impaler', 'sanguine_hound'];

  it('wears the mirror gem at its crown, and its cast shows the shimmer and the copied glyph', () => {
    for (const def of MODELS) {
      const sim = sandbox();
      const h = harness(sim);
      h.run(2);
      const e = spawnEnemy(worldOf(sim), def, 0, -6, { affixes: ['mimicking'] });
      let gems = 0;
      let mirrors = 0;
      let badge = '';
      let copy: string | undefined;
      for (let t = 0; t < 60 * 20 && !(mirrors > 0 && badge); t++) {
        const ent = worldOf(sim).entities.get(e.id);
        if (!ent || ent.health?.dead) break;
        if (ent.health) ent.health.hp = ent.health.maxHp;
        h.tick(t % 90 === 30 ? [{ t: 'tech', id: 'ward', slot: 0 }] : []);
        gems = Math.max(gems, h.entities.drawnM3.gems);
        mirrors = Math.max(mirrors, h.telegraphs.drawnM3.mirrors);
        copy ??= sim.state.entities.get(e.id)?.enemy?.mimic?.copy;
        const b = h.overlay.badges.find((x) => x.label.startsWith('Mirror · '));
        if (b) badge = b.label;
      }
      expect(h.entities.recs.get(e.id)?.riftGems, def).toContain(SPRITE.mirror);
      expect(gems, `${def}: its crown gem`).toBeGreaterThanOrEqual(1);
      expect(mirrors, `${def}: the mirror's shimmer`).toBeGreaterThanOrEqual(1);
      expect(copy, `${def}: what it copies`).toBeDefined();
      expect(badge, `${def}: the copied glyph's badge`).toMatch(/^Mirror · (Ward|Chime|Empower)$/);
    }
  });
});

describe('without Phase 6', () => {
  it('a fight with no hold, no Postlude and no Phase 6 event draws nothing of it', () => {
    const sim = sandbox();
    const h = harness(sim);
    h.run(2, [
      spawn('the_bellwarden', 0, -9),
      spawn(CONDUCTOR, 4, -12),
      spawn('bell_brute', -3, -6),
    ]);
    for (let i = 0; i < 240; i++) {
      const f = h.tick(i === 30 ? [{ t: 'tech', id: 'ward', slot: 0 }] : []);
      expect(f.mine).toEqual({ rings: 0, sprites: 0, beams: 0 });
      expect(h.tyrant.drawn).toEqual({ bands: 0, crowns: 0, edicts: 0 });
      expect(h.postlude.drawn).toEqual({ rising: 0, links: 0, sigils: 0 });
      expect(h.entities.drawn6.postludeRise).toBe(0);
      expect(f.events.some((e) => /^(tyrantEdict|postludeRose|postludePair)$/.test(e.type))).toBe(
        false,
      );
    }
    expect(h.tyrant.fired).toEqual({ edicts: 0 });
    expect(h.postlude.fired).toEqual({ rises: 0, pairs: 0 });
    // A Finale field without a Postlude (every Finale today) is no Postlude either.
    worldOf(sim).field.finale = { discord: { value: 10, rate: 1 } };
    expect(h.tick().mine).toEqual({ rings: 0, sprites: 0, beams: 0 });
    expect(postludeSky(postludeOf(sim.state.field.finale), sim.state.time, emptySky())).toEqual(
      emptySky(),
    );
  });

  it('the bodies and telegraphs draw exactly the same with the Phase 6 views as without them', () => {
    const frames = (views: boolean) => {
      const sim = sandbox();
      const kit = new FxKit();
      const entities = new EntityLayer(createModelMaterial());
      const telegraphs = new TelegraphLayer(entities);
      const overlay = new FakeOverlay() as unknown as Overlay;
      const tyrant = new TyrantView({ kit, recs: entities.recs });
      const postlude = new PostludeView({ kit, recs: entities.recs, finale: () => null });
      const out: number[][] = [];
      sim.step([spawn('the_bellwarden', 0, -9)]);
      for (let i = 0; i < 120; i++) {
        sim.step(i === 20 ? [{ t: 'tech', id: 'ward', slot: 0 }] : []);
        const ev = sim.drainEvents();
        if (views) {
          tyrant.handle(ev, sim.state);
          postlude.handle(ev, sim.state);
        }
        kit.begin(i / 60, new THREE.Vector3(0, 22, 18));
        const frame: FrameInfo = {
          realDt: 1 / 60,
          time: i / 60,
          alpha: 1,
          hoveredHero: null,
          hoveredEnemy: null,
          aim: null,
          settings: SETTINGS,
        };
        entities.sync(sim.state, frame, kit, 1 / 60);
        telegraphs.sync(sim.state, kit, overlay, 1 / 60, true);
        if (views) {
          tyrant.sync(sim.state, 1 / 60, i / 60, 1);
          postlude.sync(sim.state, 1 / 60, i / 60, 1);
        }
        out.push([kit.rings.size, kit.sprites.size, kit.spritesTop.size, kit.beams.size]);
        kit.end(1 / 60, 1280, 720, 720, 45);
      }
      return out;
    };
    expect(frames(true)).toEqual(frames(false));
  });
});

describe('no new draw calls', () => {
  it('Tyrant and the Postlude draw through the same batches as a fight without them', () => {
    const batches = (on: boolean) => {
      const sim = sandbox();
      const h = harness(sim);
      h.run(2, [
        spawn('the_bellwarden', 0, -9),
        spawn(CONDUCTOR, 4, -12),
        spawn(ALTO, -5, -7),
        spawn(BASS, 5, -7),
      ]);
      tough(sim);
      if (on) {
        const b = newest(sim, 'the_bellwarden');
        const held = hold(sim, b, ...entry('the_bellwarden', 1));
        postludeOn(sim, 3);
        const voices = [newest(sim, ALTO).id, newest(sim, BASS).id];
        h.tick(
          [],
          [
            edict(sim, b.id, held),
            { type: 'postludeRose', tick: sim.tick, boss: newest(sim, CONDUCTOR).id, hp: 1 },
            { type: 'postludePair', tick: sim.tick, voices },
          ],
        );
        expect(h.tyrant.drawn.bands).toBeGreaterThanOrEqual(1);
        expect(h.postlude.drawn.rising + h.postlude.drawn.links).toBe(2);
      }
      for (let i = 0; i < 60; i++) h.tick();
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
    // Neither view owns a scene object: they only push into the kit's batches.
    const kit = new FxKit();
    const t = new TyrantView({ kit, recs: new Map() });
    const p = new PostludeView({ kit, recs: new Map(), finale: () => null });
    expect(Object.values(t).some((v) => v instanceof THREE.Object3D)).toBe(false);
    expect(Object.values(p).some((v) => v instanceof THREE.Object3D)).toBe(false);
  });
});

// ── With W1's sim: real Tyrant and True Dissonance fights ──────────────────────────────────

describe('with the sim: Tyrant', () => {
  const TYRANT = [{ id: 'tyrant', rank: 1 }];
  /** Plays `s` with Tyrant and the bot for `seconds`, the views fed each tick: what they drew. */
  function play(s: Scenario, seconds: number) {
    const sim = createSim({ seed: s.seed, ...s.config, debug: true, dissonance: TYRANT });
    const h = harness(sim);
    const bot = makeBot('skilled', s.seed);
    const seen = { edicts: 0, bands: 0, crowns: 0, castFrames: 0, ownCasts: 0, holds: 0 };
    for (let i = 0; i < seconds * 60; i++) {
      const { events } = h.tick(bot.decide(sim.state));
      seen.edicts += events.filter((e) => e.type === 'tyrantEdict').length;
      const boss = sim.state.encounter.bossId;
      const b = boss === null ? undefined : sim.state.entities.get(boss);
      if (b?.enemy?.tyrant) seen.holds++;
      if (tyrantCasting(b)) seen.castFrames++;
      else if (b?.enemy?.cast) seen.ownCasts += h.tyrant.drawn.crowns;
      seen.bands += h.tyrant.drawn.bands;
      seen.crowns += h.tyrant.drawn.crowns;
    }
    return { sim, h, seen };
  }

  it('the Bellwarden: its edict, the Lancer’s band from the real hold, the crown over each real borrowed cast only', () => {
    const { sim, h, seen } = play(SCENARIO_BELLWARDEN, 20);
    const b = sim.state.entities.get(sim.state.encounter.bossId!)!;
    expect(b.enemy!.tyrant!.from).toBe(TYRANT_TABLE['the_bellwarden']![0]!.from);
    expect(seen.edicts).toBeGreaterThanOrEqual(1);
    expect(h.tyrant.fired.edicts).toBe(seen.edicts);
    expect(seen.holds).toBeGreaterThan(0);
    // A band every frame it holds the attack (and once more on the edict's frames).
    expect(seen.bands).toBeGreaterThanOrEqual(seen.holds);
    // The borrowed attack was really cast, and the crown shows on exactly those frames.
    expect(seen.castFrames).toBeGreaterThan(0);
    expect(seen.crowns).toBe(seen.castFrames + 0);
    expect(seen.ownCasts).toBe(0);
  });

  it('the Silent Conductor: every Sforzando in phase 1 and Downbeat in phase 2 is its Tyrant cast, crowned in its brass, no band; nothing in the Grand Silence', () => {
    const s = SCENARIO_CONDUCTOR;
    const sim = createSim({ seed: s.seed, ...s.config, debug: true, dissonance: TYRANT });
    const h = harness(sim);
    const bot = makeBot('skilled', s.seed);
    const setBossHp = (pct: number) => ({
      t: 'debug' as const,
      op: { op: 'setBossHp' as const, pct },
    });
    const by = { 1: { held: 0, crowns: 0, other: 0 }, 2: { held: 0, crowns: 0, other: 0 } };
    let bands = 0;
    let silenceFrames = 0;
    let silenceCrowns = 0;
    let edicts = 0;
    const plan: [number, number | null][] = [
      [22, null],
      [22, 0.55],
      [12, 0.29],
    ];
    for (const [seconds, pct] of plan)
      for (let i = 0; i < seconds * 60; i++) {
        const cmds = bot.decide(sim.state);
        if (i === 0 && pct !== null) cmds.push(setBossHp(pct));
        const { events } = h.tick(cmds);
        edicts += events.filter((e) => e.type === 'tyrantEdict').length;
        const b = sim.state.entities.get(sim.state.encounter.bossId!);
        const phase = b?.enemy?.phase ?? 0;
        const cast = b?.enemy?.cast?.attackId;
        bands += h.tyrant.drawn.bands;
        if (sim.state.field.finale?.silence) {
          silenceFrames++;
          silenceCrowns += h.tyrant.drawn.crowns;
          expect(b?.enemy?.tyrant).toBeUndefined();
        } else if (phase === 1 || phase === 2) {
          const own = phase === 1 ? SFORZANDO : DOWNBEAT;
          const row = by[phase];
          if (cast === own) {
            row.held++;
            expect(b!.enemy!.tyrant?.attack).toBe(own);
          } else if (cast !== undefined) row.other += h.tyrant.drawn.crowns;
          row.crowns += h.tyrant.drawn.crowns;
        }
      }
    // Its own attack: nothing borrowed, so no band, and no foe to name.
    expect(bands).toBe(0);
    expect(isBorrowed(CONDUCTOR, CONDUCTOR)).toBe(false);
    expect(tyrantMarkHex(CONDUCTOR, CONDUCTOR)).toBe(FINALE_HEX.baton);
    expect(tyrantFoeName(CONDUCTOR, CONDUCTOR)).toBeNull();
    const [foe] = entry('the_bellwarden', 1);
    expect(tyrantFoeName(foe, 'the_bellwarden')).toBe(enemyDef(foe).name);
    expect(edicts).toBe(2);
    // Each phase's held attack was cast, and the crown is on exactly those frames.
    for (const phase of [1, 2] as const) {
      expect(by[phase].held, `phase ${phase}`).toBeGreaterThan(0);
      expect(by[phase].crowns, `phase ${phase}`).toBe(by[phase].held);
      expect(by[phase].other, `phase ${phase}`).toBe(0);
    }
    expect(silenceFrames).toBeGreaterThan(60);
    expect(silenceCrowns).toBe(0);
  });
});

describe('with the sim: the Postlude’s rise', () => {
  it('the Conductor stands up in the rise’s pose, never the ordinary spawn look, while the sim holds it in spawning', () => {
    const sim = sandbox({ dissonance: [{ id: 'true_dissonance', rank: 1 }] });
    const h = harness(sim);
    h.run(60, [spawn(CONDUCTOR, 0, -8)]);
    const w = worldOf(sim);
    const boss = w.entities.list().find((e) => e.enemy?.defId === CONDUCTOR)!;
    boss.health!.hp = boss.health!.maxHp = 1e6;
    for (const id of w.party) {
      const hh = w.entities.get(id)!.health!;
      hh.hp = hh.maxHp = 1e6;
      hh.invulnerable = 1e9;
    }
    for (let i = 0; i < 600 && w.field.finale === undefined; i++) h.tick();
    expect(w.field.finale).toBeDefined();
    // The killing blow: the sim raises it (W1's postludeRise).
    boss.health!.hp = 1;
    dealDamage(w, boss, { source: w.party[0]!, sourceName: 'test', amount: 50, telegraph: null });
    const p = w.field.finale!.postlude!;
    expect(p).toBeDefined();
    const rec = () => h.entities.recs.get(boss.id)!;
    const frames: {
      spawning: boolean;
      pose: number;
      rise: number;
      rising: number;
      flash: number;
      lit: number;
    }[] = [];
    const sky = emptySky();
    let rose = 0;
    while (sim.state.time < p.riseUntil + 0.5) {
      const { events } = h.tick();
      rose += events.filter((e) => e.type === 'postludeRose').length;
      const st = sim.state.entities.get(boss.id)!.enemy!.state;
      frames.push({
        spawning: st === 'spawning',
        pose: h.entities.drawn6.postludeRise,
        rise: h.postlude.drawn.rising,
        rising: rec().rising,
        flash: rec().flash,
        lit: postludeSky(
          postludeOf(sim.state.field.finale),
          sim.state.time,
          crucibleSky(sim.state.field.finale ?? null, undefined, sim.state.time, sky),
        ).notes,
      });
    }
    // The sim's real event reached the view (the rise drawn from it and the state).
    expect(rose + h.postlude.fired.rises).toBeGreaterThanOrEqual(1);
    const during = frames.filter((f) => f.spawning);
    // W1 holds it in `spawning` for the rise: every such frame takes the rise's pose (never the
    // portal's dissolve and flash), and the rise's own view draws.
    expect(during.length).toBeGreaterThan(150);
    for (const f of during) {
      expect(f.pose).toBe(1);
      expect(f.flash).toBeLessThan(0.05);
    }
    expect(during.filter((f) => f.rise === 1).length).toBe(during.length);
    // Down at its fall, standing at the end.
    expect(Math.max(...during.map((f) => f.rising))).toBeGreaterThan(0.9);
    // The sky: dark as it falls, all eight rings by the rise's end, then the stems again.
    expect(during[0]!.lit).toBeLessThanOrEqual(1);
    expect(Math.max(...during.map((f) => f.lit))).toBe(ORRERY.rings);
    expect(frames[frames.length - 1]!.lit).toBe(-1);
    expect(frames[frames.length - 1]!.pose).toBe(0);
  });
});
