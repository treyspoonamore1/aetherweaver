/**
 * Phase 7, W6 (docs/phase-7.md, "W6: visual polish (no aura)"): the look items and the motion.
 *
 * - Tyrant's borrowed accent ring: where its accent sits within 20 ΔE of a meaning colour in the
 *   player's colour vision, its beads are crowns (a mark that is not a colour), through the same
 *   sprites batch, the same number of sprites (Phase 6 *Open* 7).
 * - Borrowed Crowns' panel header: the name on its own line, its progress under it (*Open* 5).
 * - Motion, transform-only inside the existing batches (one instance per body a frame, as before):
 *   an enemy's hit reaction, its death pose and fade, the heroes' and the Weaver's idle, and the
 *   Weaver's ribbons at rest (unchanged when she moves: `still` 0 draws exactly what it drew).
 * - The aura parts of `entities.ts` are not touched: the beam song's swell and Fermata's freeze
 *   still win over the idle (a held hero stands frozen; a poured-into hero only swells).
 */
import * as THREE from 'three';
import { WEAVER_HANDS } from '../src/render/models/art/weaver';
import { createElement, type FunctionComponent } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';
import {
  COLOR_VISIONS,
  VISION_PALETTES,
  deltaE,
  simulateVision,
  type ColorVision,
} from '../src/app/colorVision';
import { DEFAULT_SETTINGS, useSettings, type ReducedMotion } from '../src/app/settings';
import { CONTENT, enemyDef } from '../src/content';
import {
  EntityLayer,
  IDLE,
  deathDissolve,
  deathPose,
  weaverRibbons,
  type EntityRec,
} from '../src/render/entities';
import { FxKit } from '../src/render/fx/kit';
import { SPRITE } from '../src/render/fx/sprites';
import { createModelMaterial } from '../src/render/models/material';
import { applyVision } from '../src/render/palette';
import { TyrantView } from '../src/render/tyrant';
import {
  TYRANT_MARK_DELTA_E,
  tyrantAccentHex,
  tyrantAccentNearMeaning,
} from '../src/render/tyrantCues';
import type { FrameInfo } from '../src/render/types';
import { TYRANT_TABLE, type Entity, type Sim, type Status } from '../src/sim';
import { atlasAt } from '../src/ui/lab/phase6Fixture';
import { hero, sandbox, spawn, worldOf } from './sim/helpers';

const SETTINGS: FrameInfo['settings'] = {
  screenShake: 1,
  flashes: 1,
  damageNumbers: true,
  colorVision: 'normal',
};

/** The bodies over a real FxKit and a real sim, a tick a frame; and Tyrant's view over them. */
function harness(sim: Sim) {
  const kit = new FxKit();
  const entities = new EntityLayer(createModelMaterial());
  const tyrant = new TyrantView({ kit, recs: entities.recs });
  const cam = new THREE.Vector3(0, 22, 18);
  let time = 0;
  const tick = (step = true) => {
    if (step) sim.step([]);
    sim.drainEvents();
    const frame: FrameInfo = {
      realDt: 1 / 60,
      time,
      alpha: 1,
      hoveredHero: null,
      hoveredEnemy: null,
      aim: null,
      settings: SETTINGS,
    };
    kit.begin(time, cam);
    entities.sync(sim.state, frame, kit, 1 / 60);
    tyrant.sync(sim.state, 1 / 60, time, 1);
    kit.end(1 / 60, 1280, 720, 720, 45);
    time += 1 / 60;
  };
  return { kit, entities, tyrant, tick };
}

/** Every instance pushed into a body's batch, with its matrix (copied) and its push arguments. */
function watch(rec: EntityRec) {
  const pushes: { m: THREE.Matrix4; args: unknown[] }[] = [];
  const push = rec.batch.push.bind(rec.batch);
  rec.batch.push = (...args: Parameters<typeof push>) => {
    pushes.push({ m: args[0].clone(), args: args.slice(1) });
    push(...args);
  };
  return pushes;
}

const scaleY = (m: THREE.Matrix4) => Math.hypot(m.elements[4]!, m.elements[5]!, m.elements[6]!);
const posOf = (m: THREE.Matrix4) => [m.elements[12]!, m.elements[13]!, m.elements[14]!];

function giveStatus(e: Entity, status: Partial<Status> & { id: Status['id'] }): void {
  const list = e.health!.statuses as Status[];
  list.push({ remaining: 60, duration: 60, stacks: 1, source: null, ...status });
}

function newest(sim: Sim, defId: string) {
  let found: Entity | undefined;
  for (const e of worldOf(sim).entities.list()) if (e.enemy?.defId === defId) found = e;
  if (!found) throw new Error(`no ${defId}`);
  for (const e of worldOf(sim).entities.list())
    if (e.enemy && e.health) e.health.hp = e.health.maxHp = 1e7;
  return found;
}

afterEach(() => {
  applyVision('normal');
});

// ── Tyrant's band: the crowned beads ──────────────────────────────────────────────────────

/** Every foe the sim's Tyrant table borrows from. */
const FOES = [
  ...new Set(
    Object.values(TYRANT_TABLE).flatMap((rows) => rows.flatMap((r) => (r ? [r.from] : []))),
  ),
];

describe('Tyrant: the band’s non-colour mark (Phase 6 Open 7)', () => {
  it('is measured against every meaning colour of the vision’s own palette, at 20 ΔE', () => {
    expect(TYRANT_MARK_DELTA_E).toBe(20);
    for (const v of COLOR_VISIONS)
      for (const foe of FOES) {
        const hex = tyrantAccentHex(foe);
        const nearest = Math.min(
          ...Object.values(VISION_PALETTES[v]).map((m) =>
            deltaE(simulateVision(hex, v), simulateVision(m, v)),
          ),
        );
        expect(tyrantAccentNearMeaning(hex, v), `${foe} ${v} ${nearest.toFixed(1)}`).toBe(
          nearest < 20,
        );
      }
  });

  it('marks the cases Phase 6 named, and leaves a clear accent as it was', () => {
    // The Cantor Acolyte's accent is the call gold itself.
    expect(tyrantAccentNearMeaning(enemyDef('cantor_acolyte').accent, 'normal')).toBe(true);
    // The Bell Brute's is within 1 ΔE of Empower under protanopia.
    expect(tyrantAccentNearMeaning(enemyDef('bell_brute').accent, 'protanopia')).toBe(true);
    // The Leech's olive and the Void Maw's indigo are clear of every meaning colour in every vision.
    for (const v of COLOR_VISIONS) {
      expect(tyrantAccentNearMeaning(enemyDef('leech').accent, v), v).toBe(false);
      expect(tyrantAccentNearMeaning(enemyDef('void_maw').accent, v), v).toBe(false);
    }
  });

  const beads = (foe: string, vision: ColorVision) => {
    applyVision(vision);
    const sim = sandbox();
    const h = harness(sim);
    sim.step([spawn('the_bellwarden', 0, -9)]);
    h.tick();
    h.tick();
    const b = newest(sim, 'the_bellwarden');
    b.enemy!.tyrant = { attack: 'x', from: foe, phase: 1, readyAt: 1e9 };
    h.tick();
    const styles: number[] = [];
    const push = h.kit.sprites.push.bind(h.kit.sprites);
    h.kit.sprites.push = (...args: Parameters<typeof push>) => {
      styles.push(args[4]);
      push(...args);
    };
    const rings = h.kit.rings.size;
    h.tyrant.sync(sim.state, 1 / 60, 0, 1);
    return {
      crowns: styles.filter((s) => s === SPRITE.crown).length,
      diamonds: styles.filter((s) => s === SPRITE.diamond).length,
      sprites: styles.length,
      rings: h.kit.rings.size - rings,
      marked: h.tyrant.marked.bands,
      bands: h.tyrant.drawn.bands,
    };
  };

  it('crowns the beads exactly where the accent is near, in the same batch and count', () => {
    for (const v of COLOR_VISIONS)
      for (const foe of FOES) {
        const near = tyrantAccentNearMeaning(tyrantAccentHex(foe), v);
        const got = beads(foe, v);
        const label = `${foe} ${v}`;
        expect(got.bands, label).toBe(1);
        // Two hoops, four beads each: the same sprites and rings either way (no new draw call).
        expect(got.rings, label).toBe(2);
        expect(got.sprites, label).toBe(8);
        expect(got.crowns, label).toBe(near ? 8 : 0);
        expect(got.diamonds, label).toBe(near ? 0 : 8);
        expect(got.marked, label).toBe(near ? 1 : 0);
      }
  });
});

// ── Motion ────────────────────────────────────────────────────────────────────────────────

describe('an enemy’s hit reaction (transform only)', () => {
  it('flinches back, leans and squashes, and settles in under 0.3 s', () => {
    const sim = sandbox();
    const h = harness(sim);
    sim.step([spawn('bell_brute', 0, -9)]);
    h.tick();
    const e = newest(sim, 'bell_brute');
    h.tick();
    const rec = h.entities.recs.get(e.id)!;
    const pushes = watch(rec);
    // Hold it still so only the flinch moves it.
    const still = () => {
      e.vx = 0;
      e.vz = 0;
      e.px = e.x;
      e.pz = e.z;
    };
    still();
    h.tick(false);
    const rest = pushes.at(-1)!.m;
    h.entities.hit(e.id, 1);
    expect(rec.recoil).toBe(1);
    h.tick(false);
    expect(h.entities.drawn7.recoils).toBe(1);
    const hit = pushes.at(-1)!.m;
    // Squashed, and moved back away from where it faces.
    expect(scaleY(hit)).toBeLessThan(scaleY(rest) - 0.02);
    const [hx, , hz] = posOf(hit);
    const [rx, , rz] = posOf(rest);
    const back = (hx - rx) * Math.sin(rec.yaw) + (hz - rz) * Math.cos(rec.yaw);
    expect(back).toBeGreaterThan(0.05);
    for (let i = 0; i < 18; i++) h.tick(false);
    expect(rec.recoil).toBe(0);
    expect(h.entities.drawn7.recoils).toBe(0);
    expect(scaleY(pushes.at(-1)!.m)).toBeCloseTo(scaleY(rest), 5);
    // One instance a frame, as before.
    expect(pushes.length).toBe(20);
  });

  it('is an enemy’s only: a hero keeps the flash alone', () => {
    const sim = sandbox();
    const h = harness(sim);
    h.tick();
    const id = sim.state.party[0]!;
    h.entities.hit(id, 1);
    expect(h.entities.recs.get(id)!.flash).toBe(1);
    expect(h.entities.recs.get(id)!.recoil).toBe(0);
  });
});

describe('an enemy’s death: the fall reads before the fade', () => {
  const walker = { quad: false, hover: false, role: 'fodder' };
  it('keeps the fade’s ends and length, and holds the dissolve off for the fall', () => {
    expect(deathDissolve(0)).toBeCloseTo(0.05, 10);
    expect(deathDissolve(1)).toBeCloseTo(1, 10);
    expect(deathDissolve(0.2)).toBeCloseTo(0.05, 10);
    let last = 0;
    for (let t = 0; t <= 1.0001; t += 0.05) {
      const d = deathDissolve(Math.min(1, t));
      expect(d).toBeGreaterThanOrEqual(last);
      last = d;
    }
  });

  it('snaps back, then a walker falls back, a hound rolls onto its side, a cloth body slumps', () => {
    expect(deathPose(walker, 0.06).kick).toBeGreaterThan(0.5);
    expect(deathPose(walker, 0.5).kick).toBeCloseTo(0, 10);
    expect(deathPose(walker, 1).pitch).toBeCloseTo(0.62, 5);
    expect(deathPose(walker, 1).roll).toBe(0);
    const hound = deathPose({ quad: true, hover: false, role: 'fodder' }, 1);
    expect(hound.roll).toBeCloseTo(1.05, 5);
    expect(deathPose({ quad: false, hover: true, role: 'fodder' }, 1).sag).toBeCloseTo(0.7, 5);
    // A boss only sways back.
    expect(deathPose({ quad: false, hover: false, role: 'boss' }, 1).pitch).toBeLessThan(0.4);
  });

  it('draws one instance a frame through the fade, the dissolve reaching 1 at 0.75 s as before', () => {
    const sim = sandbox();
    const h = harness(sim);
    sim.step([spawn('glass_lancer', 0, -9)]);
    h.tick();
    const e = newest(sim, 'glass_lancer');
    h.tick();
    const rec = h.entities.recs.get(e.id)!;
    const pushes = watch(rec);
    h.entities.markDying(e.id);
    for (let i = 0; i < 50; i++) h.tick(false);
    expect(pushes.length).toBe(50);
    // The dissolve argument (the second after the matrix) climbs to 1.
    expect(pushes.at(-1)!.args[1]).toBeCloseTo(1, 5);
  });
});

describe('the idle: heroes and the Weaver breathe at rest', () => {
  it('rises and falls while a hero stands, out of step with the next hero', () => {
    const sim = sandbox();
    const h = harness(sim);
    h.tick();
    const ids = sim.state.party.slice(0, 2);
    const seen = ids.map((id) => watch(h.entities.recs.get(id)!));
    for (const id of ids) {
      const e = worldOf(sim).entities.get(id)!;
      e.vx = e.vz = 0;
    }
    // Three seconds: more than a whole breath.
    for (let i = 0; i < 180; i++) {
      for (const id of ids) {
        const e = worldOf(sim).entities.get(id)!;
        e.vx = e.vz = 0;
        e.px = e.x;
        e.pz = e.z;
      }
      h.tick(false);
    }
    expect(h.entities.drawn7.idle).toBeGreaterThanOrEqual(ids.length);
    const ys = seen.map((p) => p.map((x) => scaleY(x.m)));
    for (const y of ys) {
      expect(Math.max(...y) - Math.min(...y)).toBeGreaterThan(IDLE.breath * 1.5);
      expect(Math.max(...y) - Math.min(...y)).toBeLessThan(IDLE.breath * 2.2);
    }
    expect(ys[0]![90]).not.toBeCloseTo(ys[1]![90]!, 4);
  });

  it('never under Fermata’s hold: the held hero stands frozen (its aura look unchanged)', () => {
    const sim = sandbox();
    const h = harness(sim);
    h.tick();
    const id = sim.state.party[0]!;
    const e = worldOf(sim).entities.get(id)!;
    giveStatus(e, { id: 'held' });
    const pushes = watch(h.entities.recs.get(id)!);
    for (let i = 0; i < 40; i++) {
      e.vx = e.vz = 0;
      e.px = e.x;
      e.pz = e.z;
      h.tick(false);
    }
    const ys = pushes.map((p) => scaleY(p.m));
    expect(Math.max(...ys) - Math.min(...ys)).toBeLessThan(1e-9);
  });
});

describe('the Weaver’s ribbons at rest', () => {
  /**
   * The ribbons while she moves (still 0 must draw exactly these points; the rest drift adds only
   * at rest). Phase 8b: the outer two leave her hands (art/weaver.ts WEAVER_HANDS), the middle one
   * the knot at her back, wider; before, all three left a point behind her. Drawn here at scale 1.
   */
  function before(hist: Float32Array, count: number, yaw: number, now: number): number[] {
    const out: number[] = [];
    const fx = -Math.sin(yaw);
    const fz = -Math.cos(yaw);
    const sideX = -fz;
    const sideZ = fx;
    for (let r = 0; r < 3; r++) {
      const hand = r !== 1;
      const off = hand ? (r - 1) * WEAVER_HANDS.side : 0;
      const reach = hand ? WEAVER_HANDS.forward + 0.18 : 0;
      const baseY = hand ? WEAVER_HANDS.y : 1.04;
      const n = Math.min(count, 18 + r * 3);
      for (let k = 0; k < n; k++) {
        const t = k / (n - 1);
        const lead = reach * (1 - t) * (1 - t);
        const px = hist[k * 3]! + sideX * off * (1 + 0.5 * t) + fx * lead;
        const pz = hist[k * 3 + 2]! + sideZ * off * (1 + 0.5 * t) + fz * lead;
        const flutter = Math.sin(now * 5 + k * 0.55 + r * 2) * 0.09 * t;
        const droop = t * 0.75;
        out.push(
          px - fx * t * 0.55 + sideX * flutter,
          hist[k * 3 + 1]! + baseY - droop + Math.sin(now * 3.3 + k * 0.4 + r) * 0.06 * t,
          pz - fz * t * 0.55 + sideZ * flutter,
        );
      }
    }
    return out;
  }

  function drawn(still: number, now: number): number[] {
    const pts: number[] = [];
    const kit = {
      ribbons: {
        beginStrip() {},
        endStrip() {},
        point(x: number, y: number, z: number) {
          pts.push(x, y, z);
        },
      },
    } as unknown as FxKit;
    const hist = new Float32Array(26 * 3);
    for (let i = 0; i < 26; i++) {
      hist[i * 3] = 0.3 * i;
      hist[i * 3 + 1] = 0.02 * i;
      hist[i * 3 + 2] = -0.1 * i;
    }
    const c = new THREE.Color('#ffffff');
    weaverRibbons(kit, hist, 26, 0.7, now, c, c, still);
    return still === 0 ? pts.concat(before(hist, 26, 0.7, now)) : pts;
  }

  it('draws exactly the plain ribbons while she moves (still 0)', () => {
    for (const now of [0, 1.3, 7.7]) {
      const both = drawn(0, now);
      const half = both.length / 2;
      for (let i = 0; i < half; i++) expect(both[i]).toBeCloseTo(both[half + i]!, 6);
    }
  });

  it('lifts and drifts them at rest, the root held where it was', () => {
    const moving = drawn(0, 2).slice(0, drawn(0, 2).length / 2);
    const rest = drawn(1, 2);
    expect(rest.length).toBe(moving.length);
    // The first point of each ribbon (its root, t = 0) does not move.
    expect(rest[1]).toBeCloseTo(moving[1]!, 6);
    let lifted = 0;
    for (let i = 1; i < rest.length; i += 3) lifted = Math.max(lifted, rest[i]! - moving[i]!);
    expect(lifted).toBeGreaterThan(0.05);
    expect(lifted).toBeLessThanOrEqual(IDLE.ribbonLift + 1e-6);
  });

  it('follows her standing still in the fight (the layer’s own smoothing)', () => {
    const sim = sandbox();
    const h = harness(sim);
    const w = worldOf(sim).entities.get(sim.state.weaverId)!;
    for (let i = 0; i < 150; i++) {
      w.vx = w.vz = 0;
      h.tick(false);
    }
    expect((h.entities as unknown as { ribbonStill: number }).ribbonStill).toBeGreaterThan(0.9);
    expect(hero(sim, 0)).toBeDefined();
  });
});

// ── Borrowed Crowns' header ───────────────────────────────────────────────────────────────

describe('the Atlas: a constellation panel’s header (Phase 6 Open 5)', () => {
  it('sets the name on its own line and its progress under it', async () => {
    // A .tsx module, loaded at run time (the Node tsconfig compiles no JSX), as uiPhase6 does.
    const path = '../src/ui/screens/AtlasParts';
    const mod = (await import(/* @vite-ignore */ path)) as Record<
      string,
      FunctionComponent<Record<string, unknown>>
    >;
    const html = renderToStaticMarkup(
      createElement(mod['AtlasScreenView']!, {
        atlas: atlasAt('partway'),
        weekly: null,
        onBack: () => {},
        still: true,
      }),
    );
    const panels = html.split('data-constellation="').slice(1);
    const shown = panels.filter((p) => p.includes('class="flex flex-col gap-0.5"'));
    expect(shown.length).toBe(CONTENT.constellations.length);
    for (const k of CONTENT.constellations) {
      const panel = shown.find((p) => p.startsWith(k.id))!;
      const header = panel.slice(panel.indexOf('class="flex flex-col gap-0.5"'));
      // The name first, in its own bold block, then the progress.
      expect(header.indexOf(k.name)).toBeGreaterThan(0);
      expect(header.indexOf(k.name)).toBeLessThan(header.indexOf(' star'));
      expect(header.slice(0, header.indexOf(k.name))).not.toContain('justify-between');
    }
  });
});

// ── Reduced motion (W2's comfort option) over the motion above ─────────────────────────────

describe('Reduced motion On holds the new motion still; System and Off draw it as built', () => {
  afterEach(() => {
    useSettings.setState({ settings: DEFAULT_SETTINGS });
  });
  const motion = (m: ReducedMotion | undefined) =>
    useSettings.setState({
      settings: m === undefined ? DEFAULT_SETTINGS : { ...DEFAULT_SETTINGS, reducedMotion: m },
    });

  /**
   * One scripted scene: two heroes and the Weaver standing, an enemy hit then killed. Every
   * instance pushed for those bodies (matrix and arguments), the counters, the ribbons' rest.
   */
  function scene() {
    const sim = sandbox();
    const h = harness(sim);
    sim.step([spawn('bell_brute', 0, -9)]);
    h.tick();
    const foe = newest(sim, 'bell_brute');
    h.tick();
    const ids = [...sim.state.party.slice(0, 2), sim.state.weaverId, foe.id];
    const seen = ids.map((id) => watch(h.entities.recs.get(id)!));
    const hold = () => {
      for (const id of ids) {
        const e = worldOf(sim).entities.get(id)!;
        e.vx = e.vz = 0;
        e.px = e.x;
        e.pz = e.z;
      }
    };
    const counts = { recoils: 0, idle: 0 };
    const ribbon: number[] = [];
    const frame = () => {
      hold();
      h.tick(false);
      counts.recoils += h.entities.drawn7.recoils;
      counts.idle += h.entities.drawn7.idle;
      ribbon.push((h.entities as unknown as { ribbonStill: number }).ribbonStill);
    };
    for (let i = 0; i < 120; i++) frame();
    const rec = h.entities.recs.get(foe.id)!;
    const before = seen[3]!.length;
    h.entities.hit(foe.id, 1);
    for (let i = 0; i < 20; i++) frame();
    const hitFrames = seen[3]!.slice(before);
    const dyingFrom = seen[3]!.length;
    h.entities.markDying(foe.id);
    for (let i = 0; i < 50; i++) frame();
    const dying = seen[3]!.slice(dyingFrom);
    // (+ 0: a zero's sign is not a different frame.)
    const out = seen.map((p) =>
      p.map((x) => [...x.m.elements.map((v) => v + 0), ...x.args.map(String)]),
    );
    return { h, rec, seen, out, counts, ribbon, hitFrames, dying };
  }

  it('System (absent) and Off draw every frame exactly as the default does', () => {
    motion(undefined);
    const base = scene();
    expect(base.counts.recoils).toBeGreaterThan(0);
    expect(base.counts.idle).toBeGreaterThan(0);
    expect(Math.max(...base.ribbon)).toBeGreaterThan(0.5);
    for (const m of ['system', 'off'] as const) {
      motion(m);
      const run = scene();
      expect(run.h.entities.still).toBe(false);
      expect(run.out).toStrictEqual(base.out);
      expect(run.counts).toStrictEqual(base.counts);
      expect(run.ribbon).toStrictEqual(base.ribbon);
    }
  });

  it('On: no flinch, no idle breath or sway, no ribbon lift', () => {
    motion('on');
    const run = scene();
    expect(run.h.entities.still).toBe(true);
    expect(run.counts).toStrictEqual({ recoils: 0, idle: 0 });
    expect(Math.max(...run.ribbon)).toBe(0);
    // A standing body neither rises and falls nor sways (W6's breath spans ~2.8% of its height).
    for (const pushes of run.seen.slice(0, 3)) {
      const ys = pushes.slice(0, 140).map((p) => scaleY(p.m));
      const rolls = pushes.slice(0, 140).map((p) => p.m.elements[1]!);
      expect(Math.max(...ys) - Math.min(...ys)).toBeLessThan(IDLE.breath * 0.01);
      expect(Math.max(...rolls) - Math.min(...rolls)).toBeLessThan(IDLE.sway * 0.01);
    }
    // The struck enemy does not move from the blow.
    const rest = run.hitFrames[0]!.m.elements;
    for (const p of run.hitFrames) {
      expect(scaleY(p.m)).toBeCloseTo(Math.hypot(rest[4]!, rest[5]!, rest[6]!), 9);
      expect(posOf(p.m)[0]).toBeCloseTo(rest[12]!, 9);
      expect(posOf(p.m)[2]).toBeCloseTo(rest[14]!, 9);
    }
  });

  it('On: a death fades without the topple, over the same length to the same ends', () => {
    motion(undefined);
    const built = scene();
    motion('on');
    const run = scene();
    // The same number of frames drawn, the dissolve from 0.05 to 1 as W6's.
    expect(run.dying.length).toBe(built.dying.length);
    const dis = (p: (typeof run.dying)[number]) => p.args[1] as number;
    expect(dis(run.dying[0]!)).toBeLessThan(0.08);
    expect(dis(built.dying[0]!)).toBeLessThan(0.08);
    expect(dis(run.dying.at(-1)!)).toBeCloseTo(1, 5);
    expect(dis(built.dying.at(-1)!)).toBeCloseTo(1, 5);
    // No snap back, no fall, no roll: the fade's slight lean (0.15 rad at its end), as before
    // Phase 7, where W6's walker pitches far further.
    const rec = run.rec;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    for (let i = 0; i < run.dying.length; i++) {
      const t = Math.min(1, (i + 1) / 60 / 0.75);
      const s = 1 + t * 0.06;
      q.setFromEuler(new THREE.Euler(0.15 * t, rec.yaw, 0, 'YXZ'));
      m.compose(new THREE.Vector3(rec.x, -t * t * 0.25, rec.z), q, new THREE.Vector3(s, s, s));
      const got = run.dying[i]!.m.elements;
      for (let k = 0; k < 16; k++) expect(got[k]).toBeCloseTo(m.elements[k]!, 6);
      expect(dis(run.dying[i]!)).toBeCloseTo(0.05 + t * 0.95, 9);
    }
    expect(deathPose({ quad: true, hover: true, role: 'fodder' }, 1, true)).toStrictEqual({
      kick: 0,
      pitch: 0.15,
      roll: 0,
      sag: 1,
    });
  });
});

// ── The VFX lab's comfort controls ────────────────────────────────────────────────────────

describe('the VFX lab: the Phase 7 comfort options next to Flashes', () => {
  interface LabModule {
    ComfortControls: FunctionComponent;
    labComfort: {
      reducedMotion(v: ReducedMotion): void;
      telegraphs(patch: Record<string, number | boolean>): void;
      answerGlyphs(v: boolean): void;
      importantNumbersOnly(v: boolean): void;
      slowmoVignette(v: boolean): void;
    };
  }
  // A .tsx module, loaded at run time (the Node tsconfig compiles no JSX).
  const path = '../src/render/lab/VfxLab';
  const lab = async () => (await import(/* @vite-ignore */ path)) as unknown as LabModule;
  afterEach(() => {
    useSettings.setState({ settings: DEFAULT_SETTINGS });
  });
  const KEYS = [
    'reducedMotion',
    'telegraphs',
    'answerGlyphs',
    'importantNumbersOnly',
    'slowmoVignette',
  ] as const;

  it('shows every option at its default and writes nothing by being shown', async () => {
    const { ComfortControls } = await lab();
    const html = renderToStaticMarkup(createElement(ComfortControls));
    for (const label of [
      'Reduced motion',
      'Telegraph opacity 1.00',
      'Telegraph outline × 1.00',
      'Perfect band × 1.00',
      'Telegraph high contrast',
      'Answer glyphs',
      'Important numbers only',
      'Slow-mo vignette',
    ])
      expect(html).toContain(label);
    expect(html).toMatch(/<option selected="">system<\/option><option>on<\/option><option>off/);
    expect(useSettings.getState().settings).toBe(DEFAULT_SETTINGS);
    for (const k of KEYS) expect(k in useSettings.getState().settings).toBe(false);
  });

  it('writes each key as Settings does: only the one changed, the rest left absent', async () => {
    const { labComfort } = await lab();
    const cases: [() => void, (typeof KEYS)[number], unknown][] = [
      [() => labComfort.reducedMotion('on'), 'reducedMotion', 'on'],
      [() => labComfort.telegraphs({ outline: 1.5 }), 'telegraphs', { outline: 1.5 }],
      [() => labComfort.telegraphs({ highContrast: true }), 'telegraphs', { highContrast: true }],
      [() => labComfort.answerGlyphs(false), 'answerGlyphs', false],
      [() => labComfort.importantNumbersOnly(true), 'importantNumbersOnly', true],
      [() => labComfort.slowmoVignette(false), 'slowmoVignette', false],
    ];
    for (const [write, key, value] of cases) {
      useSettings.setState({ settings: DEFAULT_SETTINGS });
      write();
      const s = useSettings.getState().settings;
      expect(s[key]).toStrictEqual(value);
      for (const k of KEYS) if (k !== key) expect(k in s).toBe(false);
      expect({ ...s, [key]: undefined }).toStrictEqual({ ...DEFAULT_SETTINGS, [key]: undefined });
    }
    // Reduced motion On from the lab reaches the fight's bodies.
    labComfort.reducedMotion('on');
    const sim = sandbox();
    const h = harness(sim);
    h.tick();
    expect(h.entities.still).toBe(true);
  });
});
