/**
 * Phase 8c: the boss-fight camera (docs/phase-8.md, "8c: the fight out from under the
 * interface"). The lean and the pull-back keep the boss, the heroes and the Weaver in the part of
 * the screen the HUD leaves free; they are smooth and bounded; Reduced motion eases them very
 * slowly; fights without a boss keep the camera they always had; aiming goes through the camera
 * as it stands; the sim is never touched.
 */
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { FightFraming, bossOf } from '../src/app/fightFraming';
import { screenBox } from '../src/app/figureBoxes';
import { BOSS_BAR_REM, CAST_ROW_REM, bossBarTop, safeAreaFrom } from '../src/app/hudSafeArea';
import { makeBot } from '../src/bots';
import { CameraRig, MAX_LEAN, MAX_PULL, type FightFrame } from '../src/render/camera';
import { OPEN_SAFE_AREA, type FrameSubject, type SafeArea } from '../src/render/framing';
import { groundUnder } from '../src/render/stage';
import { createSim } from '../src/sim';

const W = 1280;
const H = 720;
const RECT = { left: 0, top: 0, width: W, height: H };
const VIEW = { left: 0, top: 0, right: W, bottom: H };

/** The default HUD at 1280 × 720, as the browser lays it out (CSS pixels). */
const HUD_720 = {
  view: VIEW,
  bossBar: { left: 352, top: 16, right: 928, bottom: 158 },
  weaverBar: { left: 544, top: 556, right: 1248, bottom: 700 },
  dial: { left: 862, top: 475, right: 930, bottom: 555 },
  partyFrames: { left: 16, top: 348, right: 320, bottom: 700 },
  topLeft: { left: 16, top: 16, right: 283, bottom: 98 },
};
const SAFE = safeAreaFrom(HUD_720);

const fig = (x: number, z: number, radius: number, height: number): FrameSubject => ({
  x,
  z,
  radius,
  height,
});
const hero = (x: number, z: number) => fig(x, z, 0.5 * 1.12, 1.8 * 1.12);
const boss = (x: number, z: number) => fig(x, z, 1.5, 4.2);

function make(): { rig: CameraRig; camera: THREE.PerspectiveCamera } {
  const camera = new THREE.PerspectiveCamera(40, W / H, 0.5, 220);
  camera.updateProjectionMatrix();
  return { rig: new CameraRig(camera), camera };
}

/** The share of a figure's box inside the safe area's rectangle (0..1). */
function inSafe(camera: THREE.Camera, f: FrameSubject, safe: SafeArea = SAFE): number {
  camera.updateMatrixWorld();
  const b = screenBox(camera, RECT, f.x, f.z, f.radius, f.height);
  const l = Math.max(b.left, safe.left * W);
  const r = Math.min(b.right, safe.right * W);
  const t = Math.max(b.top, safe.top * H);
  const bt = Math.min(b.bottom, safe.bottom * H);
  const area = (b.right - b.left) * (b.bottom - b.top);
  return (Math.max(0, r - l) * Math.max(0, bt - t)) / area;
}

function run(rig: CameraRig, fight: FightFrame | null, seconds: number, safe = SAFE): void {
  const w = fight?.weaver ?? { x: 0, z: 0 };
  for (let i = 0; i < seconds * 60; i++) {
    rig.frame(fight, safe);
    rig.update(w.x, w.z, w.x, w.z, 1 / 60);
  }
}

describe('the safe area the HUD leaves free', () => {
  it('reads the default layout: the boss bar on top, the Weaver bar below, the frames a corner', () => {
    expect(SAFE.top).toBeCloseTo(158 / 720 + 0.012, 5);
    expect(SAFE.bottom).toBeCloseTo(556 / 720 - 0.024, 5);
    expect(SAFE.bottomLeft).toEqual({ x: 320 / 1280 + 0.012, y: 348 / 720 });
    expect(SAFE.bottomNotch!.y).toBeCloseTo(475 / 720 - 0.012, 5);
    expect(SAFE.topLeft!.y).toBeCloseTo(98 / 720, 5);
    expect(SAFE.topRight).toBeUndefined();
  });

  it('leaves room for the boss bar’s cast row while no cast shows, and for the bar before it arrives', () => {
    // Between casts the bar is a row shorter: the room is kept, at the UI's own scale.
    const quiet = { ...HUD_720, bossBar: { left: 352, top: 8, right: 928, bottom: 78 } };
    const idle = safeAreaFrom({ ...quiet, bossCasting: false });
    expect(idle.top).toBeCloseTo((78 + CAST_ROW_REM * 16) / 720 + 0.012, 5);
    const big = safeAreaFrom({ ...quiet, bossCasting: false, rem: 24 });
    expect(big.top).toBeCloseTo((78 + CAST_ROW_REM * 24) / 720 + 0.012, 5);
    const casting = { ...HUD_720, bossBar: { left: 352, top: 8, right: 928, bottom: 120 } };
    expect(safeAreaFrom({ ...casting, bossCasting: true }).top).toBeCloseTo(120 / 720 + 0.012, 5);
    // The two agree: no nod of the camera when the first cast begins.
    expect(Math.abs(idle.top - safeAreaFrom({ ...casting, bossCasting: true }).top)).toBeLessThan(
      0.005,
    );
    // Before the boss (and its bar) arrives: the same room, from the scale alone.
    expect(bossBarTop(720, 16)).toBeCloseTo((BOSS_BAR_REM * 16) / 720 + 0.012, 5);
    expect(Math.abs(bossBarTop(720, 16) - idle.top)).toBeLessThan(0.005);
    expect(bossBarTop(1080, 16)).toBeLessThan(bossBarTop(720, 16));
  });

  it('follows the panels wherever Edit HUD layout put them', () => {
    // The Weaver bar moved to the top: it is the top now, and the bottom is open.
    const top = safeAreaFrom({
      ...HUD_720,
      bossBar: null,
      weaverBar: { left: 288, top: 20, right: 992, bottom: 164 },
      dial: null,
    });
    expect(top.top).toBeCloseTo(164 / 720 + 0.024, 5);
    expect(top.bottom).toBe(OPEN_SAFE_AREA.bottom);
    // The frames moved to the right edge and the bar to a side: no corner, no bottom.
    const side = safeAreaFrom({
      ...HUD_720,
      weaverBar: { left: 700, top: 556, right: 1264, bottom: 700 },
      partyFrames: { left: 960, top: 300, right: 1264, bottom: 650 },
    });
    expect(side.bottomLeft).toBeUndefined();
    expect(side.bottom).toBe(OPEN_SAFE_AREA.bottom);
  });

  it('never returns an inside-out area, whatever the panels', () => {
    const odd = safeAreaFrom({
      view: VIEW,
      bossBar: { left: 300, top: 0, right: 900, bottom: 420 },
      weaverBar: { left: 300, top: 430, right: 900, bottom: 700 },
    });
    expect(odd.bottom - odd.top).toBeGreaterThan(0.3);
    expect(safeAreaFrom({ view: { left: 0, top: 0, right: 0, bottom: 0 } })).toEqual(
      OPEN_SAFE_AREA,
    );
  });
});

describe('the boss-fight lean and pull-back', () => {
  it('brings a boss ten metres north out from under the boss bar, the Weaver still clear', () => {
    const { rig, camera } = make();
    const fight = { weaver: hero(0, 4), heroes: [hero(-2, 2), hero(2, 1)], bosses: [boss(0, -6)] };
    // The plain follow camera: the boss is mostly under the bar.
    rig.snapTo(0, 4);
    expect(inSafe(camera, fight.bosses[0]!)).toBeLessThan(0.3);
    rig.snapTo(0, 4);
    run(rig, fight, 3);
    expect(inSafe(camera, fight.bosses[0]!)).toBeGreaterThan(0.99);
    expect(inSafe(camera, fight.weaver)).toBeGreaterThan(0.999);
    for (const h of fight.heroes) expect(inSafe(camera, h)).toBeGreaterThan(0.8);
    expect(rig.framed.leanZ).toBeLessThan(-2);
    expect(Math.hypot(rig.framed.leanX, rig.framed.leanZ)).toBeLessThanOrEqual(MAX_LEAN);
  });

  it('leans the other way for a boss that has got behind the party', () => {
    const { rig, camera } = make();
    const fight = { weaver: hero(0, 0), heroes: [hero(1, -3)], bosses: [boss(-2, 9)] };
    rig.snapTo(0, 0);
    expect(inSafe(camera, fight.bosses[0]!)).toBeLessThan(0.5);
    run(rig, fight, 3);
    expect(rig.framed.leanZ).toBeGreaterThan(1);
    expect(inSafe(camera, fight.bosses[0]!)).toBeGreaterThan(0.99);
    expect(inSafe(camera, fight.weaver)).toBeGreaterThan(0.999);
  });

  it('does not move at all when everyone is already in view', () => {
    const { rig } = make();
    const fight = { weaver: hero(0, 2), heroes: [hero(-2, 1)], bosses: [boss(1, 1.5)] };
    rig.snapTo(0, 2);
    run(rig, fight, 2);
    expect(rig.framed).toEqual({ leanX: 0, leanZ: 0, pull: 1 });
  });

  it('a fight with no boss keeps exactly the camera it always had', () => {
    const plain = make();
    const framed = make();
    plain.rig.snapTo(3, 5);
    framed.rig.snapTo(3, 5);
    const fight = { weaver: hero(3, 5), heroes: [hero(8, -9)], bosses: [] };
    for (let i = 0; i < 240; i++) {
      const x = 3 + Math.sin(i / 20) * 4;
      const z = 5 - i / 40;
      if (i === 60) {
        plain.rig.addTrauma(0.6);
        framed.rig.addTrauma(0.6);
        plain.rig.punch(-2);
        framed.rig.punch(-2);
      }
      fight.weaver.x = x;
      fight.weaver.z = z;
      plain.rig.update(x, z, x + 6, z - 3, 1 / 60);
      framed.rig.frame(i % 2 ? fight : null, SAFE);
      framed.rig.update(x, z, x + 6, z - 3, 1 / 60);
      expect(framed.camera.position.toArray()).toEqual(plain.camera.position.toArray());
      expect(framed.camera.quaternion.toArray()).toEqual(plain.camera.quaternion.toArray());
    }
  });

  it('is bounded: never past its longest lean or its furthest pull-back', () => {
    const { rig } = make();
    const fight = { weaver: hero(0, 15), heroes: [hero(-25, 15)], bosses: [boss(20, -60)] };
    rig.snapTo(0, 15);
    run(rig, fight, 4);
    expect(Math.abs(rig.framed.leanX)).toBeLessThanOrEqual(MAX_LEAN + 1e-9);
    expect(Math.abs(rig.framed.leanZ)).toBeLessThanOrEqual(MAX_LEAN + 1e-9);
    expect(rig.framed.pull).toBeLessThanOrEqual(MAX_PULL);
    expect(rig.framed.pull).toBeGreaterThan(1.4);
  });

  it('the Weaver stays wholly in the safe area on every frame, wherever the boss and heroes go', () => {
    const { rig, camera } = make();
    const fight = { weaver: hero(0, 6), heroes: [hero(-3, 4), hero(4, 9)], bosses: [boss(0, -8)] };
    rig.snapTo(0, 6);
    let seed = 12345;
    const rand = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff) * 2 - 1;
    for (let i = 0; i < 60 * 40; i++) {
      // The boss leaps somewhere else every two seconds; the heroes and the Weaver wander.
      if (i % 120 === 0) {
        fight.bosses[0]!.x = rand() * 18;
        fight.bosses[0]!.z = rand() * 18;
      }
      fight.weaver.x += rand() * 0.08;
      fight.weaver.z += rand() * 0.08;
      for (const h of fight.heroes) {
        h.x += rand() * 0.1;
        h.z += rand() * 0.1;
      }
      rig.frame(fight, SAFE);
      rig.update(fight.weaver.x, fight.weaver.z, fight.weaver.x, fight.weaver.z, 1 / 60);
      // (The follow camera's own lag is a few centimetres at this walking pace.)
      expect(inSafe(camera, fight.weaver)).toBeGreaterThan(0.97);
    }
  });

  it('is smooth: a boss that leaps twenty metres never makes the camera jump', () => {
    const { rig, camera } = make();
    const fight = { weaver: hero(0, 4), heroes: [hero(-2, 5)], bosses: [boss(0, -6)] };
    rig.snapTo(0, 4);
    run(rig, fight, 3);
    fight.bosses[0]!.z = 14;
    const last = camera.position.clone();
    let furthest = 0;
    for (let i = 0; i < 180; i++) {
      rig.frame(fight, SAFE);
      rig.update(0, 4, 0, 4, 1 / 60);
      furthest = Math.max(furthest, camera.position.distanceTo(last));
      last.copy(camera.position);
    }
    // At most about 0.4 m in a sixtieth of a second, and it does get there.
    expect(furthest).toBeLessThan(0.45);
    expect(rig.framed.leanZ).toBeGreaterThan(1);
  });

  it('a hero in view is not pushed out of view to show the boss', () => {
    const { rig, camera } = make();
    // Lyra stands well behind the Weaver; the boss is far to the north.
    const fight = { weaver: hero(0, 2), heroes: [hero(-3, 6.5)], bosses: [boss(0, -16)] };
    rig.snapTo(0, 2);
    expect(inSafe(camera, fight.heroes[0]!)).toBeGreaterThan(0.99);
    run(rig, fight, 4);
    expect(inSafe(camera, fight.heroes[0]!)).toBeGreaterThan(0.78);
    expect(inSafe(camera, fight.weaver)).toBeGreaterThan(0.999);
  });

  it('a fight opens already framed: the first framed frame takes its framing at once', () => {
    for (const still of [false, true]) {
      const { rig, camera } = make();
      rig.still = still;
      const fight = { weaver: hero(0, 9), heroes: [hero(0, 6.4)], bosses: [boss(0, -7.4)] };
      rig.snapTo(0, 9);
      rig.frame(fight, SAFE);
      rig.update(0, 9, 0, 9, 1 / 60);
      const first = { ...rig.framed };
      const at = camera.position.clone();
      expect(first.leanZ).toBeLessThan(-3);
      run(rig, fight, 2);
      // Nothing left to ease to.
      expect(rig.framed.leanZ).toBeCloseTo(first.leanZ, 6);
      expect(rig.framed.pull).toBeCloseTo(first.pull, 6);
      expect(camera.position.distanceTo(at)).toBeLessThan(1e-6);
    }
  });

  it('Reduced motion On: the framing eases very slowly, and the Weaver is still kept in view', () => {
    const moved = (still: boolean): number => {
      const { rig, camera } = make();
      rig.still = still;
      const fight = { weaver: hero(0, 4), heroes: [], bosses: [boss(0, -6)] };
      rig.snapTo(0, 4);
      run(rig, fight, 2);
      // The boss crosses to the south; one second later:
      fight.bosses[0]!.z = 13;
      const from = rig.framed.leanZ;
      let fastest = 0;
      const last = camera.position.clone();
      for (let i = 0; i < 60; i++) {
        rig.frame(fight, SAFE);
        rig.update(0, 4, 0, 4, 1 / 60);
        fastest = Math.max(fastest, camera.position.distanceTo(last) * 60);
        last.copy(camera.position);
        expect(inSafe(camera, fight.weaver)).toBeGreaterThan(0.999);
      }
      if (still) expect(fastest).toBeLessThan(2.5); // metres a second, at its fastest
      return Math.abs(rig.framed.leanZ - from);
    };
    const normal = moved(false);
    const reduced = moved(true);
    expect(normal).toBeGreaterThan(5);
    expect(reduced).toBeLessThan(normal * 0.2);
  });
});

describe('aiming through the leaned camera', () => {
  it('the ground point under the mouse and the screen point over the ground agree exactly', () => {
    const { rig, camera } = make();
    const fight = { weaver: hero(1, 5), heroes: [hero(-4, 8)], bosses: [boss(9, -12)] };
    rig.snapTo(1, 5);
    const out = { x: 0, z: 0 };
    const p = new THREE.Vector3();
    for (let i = 0; i < 200; i++) {
      fight.bosses[0]!.x = 9 - i * 0.1;
      rig.frame(fight, SAFE);
      // As the runtime does it: the rig moves, then the pointer is read, with nothing in between.
      rig.update(1, 5, 4, 2, 1 / 60);
      for (const [px, py] of [
        [640, 360],
        [100, 650],
        [1200, 200],
        [333.25, 471.5],
      ] as const) {
        expect(groundUnder(camera, RECT, px, py, out)).toBe(true);
        const before = { ...out };
        // The same answer once every matrix is refreshed: the pick was not a frame behind.
        camera.updateMatrixWorld();
        groundUnder(camera, RECT, px, py, out);
        expect(out.x).toBeCloseTo(before.x, 9);
        expect(out.z).toBeCloseTo(before.z, 9);
        // And the point picked draws back under the same pixel.
        p.set(out.x, 0, out.z).project(camera);
        expect((p.x * 0.5 + 0.5) * W).toBeCloseTo(px, 6);
        expect((-p.y * 0.5 + 0.5) * H).toBeCloseTo(py, 6);
      }
      // A hero's feet, drawn then picked: the hero's own place.
      const h = fight.heroes[0]!;
      p.set(h.x, 0, h.z).project(camera);
      groundUnder(camera, RECT, (p.x * 0.5 + 0.5) * W, (-p.y * 0.5 + 0.5) * H, out);
      expect(out.x).toBeCloseTo(h.x, 6);
      expect(out.z).toBeCloseTo(h.z, 6);
    }
    expect(Math.abs(rig.framed.leanZ) + Math.abs(rig.framed.leanX)).toBeGreaterThan(1);
  });
});

describe('framing a real fight', () => {
  it('knows which encounters bring a boss or a miniboss', () => {
    expect(bossOf('first_light')).toBeNull();
    expect(bossOf('bellwarden')).toBe('the_bellwarden');
    expect(bossOf('hollow_cantor')).toBe('the_hollow_cantor');
    expect(bossOf('vharun')).toBe('vharun_crimson_warden');
    expect(bossOf('the_silent_conductor')).toBe('the_silent_conductor');
  });

  it('frames the boss before it arrives, where the director will put it', () => {
    const sim = createSim({ seed: 4242, encounter: 'hollow_cantor' });
    const { rig, camera } = make();
    const w = sim.state.entities.get(sim.state.weaverId)!;
    rig.snapTo(w.x, w.z);
    const framing = FightFraming.for(rig, {} as HTMLCanvasElement, 'hollow_cantor', sim.state)!;
    framing.update(sim.state, 1, 16);
    rig.update(w.x, w.z, w.x, w.z, 1 / 60);
    const opening = camera.position.clone();
    expect(rig.framed.leanZ).toBeLessThan(-3);
    // Play until the Cantor stands in the arena: it is where the camera was already looking.
    const bot = makeBot('skilled', 4242);
    let cantor = null;
    for (let i = 0; i < 600 && !cantor; i++) {
      sim.step(bot.decide(sim.state));
      cantor = sim.state.entities.list().find((e) => e.enemy?.defId === 'the_hollow_cantor');
    }
    expect(cantor).toBeTruthy();
    const b = fig(cantor!.x, cantor!.z, cantor!.radius, cantor!.height);
    camera.position.copy(opening);
    // (The boss bar as it stands while the boss arrives, before its first cast: 102 px of 720.
    // Seventeen metres from the Weaver is more than the furthest pull-back shows whole at this
    // size with two heroes standing behind her: most of the boss, not all of it.)
    const entrance = { ...OPEN_SAFE_AREA, top: 0.155, bottom: 0.73 };
    expect(inSafe(camera, b, entrance)).toBeGreaterThan(0.65);
    expect(rig.framed.pull).toBeCloseTo(MAX_PULL, 6);
    expect(FightFraming.for(rig, {} as HTMLCanvasElement, 'first_light', sim.state)).toBeNull();
  });

  it('never touches the sim: the same fight, framed or not, ends on the same hash', () => {
    const play = (framed: boolean): string => {
      const sim = createSim({ seed: 4242, encounter: 'bellwarden' });
      const bot = makeBot('skilled', 4242);
      const { rig } = make();
      const framing = framed
        ? FightFraming.for(rig, {} as HTMLCanvasElement, 'bellwarden', sim.state)
        : null;
      for (let i = 0; i < 900; i++) {
        sim.step(bot.decide(sim.state));
        framing?.update(sim.state, 1, 1000 / 60);
        const w = sim.state.entities.get(sim.state.weaverId)!;
        rig.update(w.x, w.z, w.x, w.z, 1 / 60);
      }
      if (framed) expect(Math.abs(rig.framed.leanZ)).toBeGreaterThan(0.5);
      return sim.hash();
    };
    expect(play(true)).toBe(play(false));
  });
});
