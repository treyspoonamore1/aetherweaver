/**
 * The mark over a hero whose Solo is coming (src/render/soloMark.ts, docs/solos.md): what it
 * shows is the sim's (`soloDueIn`, `threadCues`), its two looks differ by shape, it stands still
 * with Reduced motion, follows the colour-vision palette, and costs two sprites a hero.
 */
import type * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { COLOR_VISIONS, deltaE, simulateVision, visionPalette } from '../src/app/colorVision';
import { CONTENT } from '../src/content';
import { SOLOS } from '../src/sim/constants';
import { soloDueIn, threadCues, type Command, type Sim } from '../src/sim';
import type { FxKit } from '../src/render/fx/kit';
import { SPRITE } from '../src/render/fx/sprites';
import { HERO_DRAWN } from '../src/render/models/artFlag';
import { C, applyVision } from '../src/render/palette';
import {
  SOLO_MARK_CALL_LIFT,
  SOLO_MARK_CUED_SIZE,
  SOLO_MARK_HOLD,
  SOLO_MARK_LIFT,
  SOLO_MARK_QUIET,
  SOLO_MARK_SIZE,
  SoloMarkView,
  soloMarkOf,
  soloTellSeconds,
  type SoloMarkRec,
} from '../src/render/soloMark';
import { sandbox, stepUntil } from './sim/helpers';

const brute: Command = { t: 'debug', op: { op: 'spawnEnemy', defId: 'bell_brute', x: 0, z: -5 } };
/** A sandbox fight with the party engaged on a Bell Brute. */
function fight(config: Parameters<typeof sandbox>[0] = {}) {
  const sim = sandbox(config);
  const st = sim.state;
  sim.step([brute]);
  stepUntil(sim, () => st.party.every((id) => st.entities.get(id)!.hero!.targetId !== null));
  const hero = (slot: number) => st.entities.get(st.party[slot]!)!;
  const setSolo = (slot: number, solo: number) => {
    (hero(slot).hero as { solo: number }).solo = solo;
  };
  return { sim, st, hero, setSolo };
}

interface Pushed {
  x: number;
  y: number;
  z: number;
  size: number;
  style: number;
  hex: string;
  alpha: number;
  param: number;
}
/** A kit that records what the mark pushes to the overhead sprite batch (its only batch). */
function recorder() {
  const pushed: Pushed[] = [];
  const spritesTop = {
    push(
      x: number,
      y: number,
      z: number,
      size: number,
      style: number,
      c: THREE.Color,
      alpha: number,
      _rotation = 0,
      _stretch = 1,
      param = 0,
    ) {
      pushed.push({ x, y, z, size, style, hex: `#${c.getHexString()}`, alpha, param });
    },
  };
  return { kit: { spritesTop } as unknown as FxKit, pushed };
}
/** The mark's view over the sim's own positions (a record a hero: where they stand, how tall). */
function viewOf(sim: Sim) {
  const recs = new Map<number, SoloMarkRec>();
  const sync = () => {
    for (const id of sim.state.party) {
      const e = sim.state.entities.get(id)!;
      recs.set(id, { x: e.x, y: 0, z: e.z, height: e.height });
    }
  };
  sync();
  const view = new SoloMarkView(recs);
  let time = 0;
  const frame = (flashes = 1, still = false) => {
    sync();
    const { kit, pushed } = recorder();
    time += 1 / 60;
    view.sync(sim.state, kit, 1 / 60, time, flashes, still);
    return pushed;
  };
  return { view, frame };
}

describe('what the mark shows is the sim’s', () => {
  it('none until the tell; then the seconds are soloDueIn’s and Cued is threadCues’', () => {
    const { sim, st, hero, setSolo } = fight();
    for (let slot = 0; slot < 3; slot++) expect(soloMarkOf(st, hero(slot))).toBeNull();
    setSolo(1, 95);
    sim.step([]);
    let seen = 0;
    let last = -1;
    for (let i = 0; i < 400; i++) {
      // The Thread reaches Lyra a second and a half in.
      sim.step(i === 90 ? [{ t: 'thread', slot: 1 }] : []);
      const e = hero(1);
      const m = soloMarkOf(st, e);
      const due = soloDueIn(st, e);
      if (due === null) {
        expect(m).toBeNull();
        continue;
      }
      seen++;
      expect(m).not.toBeNull();
      expect(m!.due).toBe(due);
      expect(m!.cued).toBe(threadCues(st, e));
      expect(m!.cued).toBe(i >= 90);
      expect(m!.now).toBe(e.hero!.solo >= 100);
      expect(m!.fill).toBeCloseTo(1 - due / soloTellSeconds(e), 9);
      // The ring only fills.
      expect(m!.fill).toBeGreaterThanOrEqual(last - 1e-9);
      last = m!.fill;
    }
    expect(seen).toBeGreaterThan(60);
    // It fired, Cued; the mark is gone with it.
    expect(hero(1).hero!.soloCued).toBe(true);
    expect(soloTellSeconds(hero(1))).toBe(SOLOS.tell + SOLOS.wait);
    expect(soloTellSeconds(hero(0))).toBe(SOLOS.tell + SOLOS.kaelHold);
  });

  it('none for a downed, possessed or stilled hero, or one full with nobody to fight', () => {
    const idle = sandbox();
    idle.step([{ t: 'debug', op: { op: 'chargeSolos' } }]);
    idle.step([]);
    for (const id of idle.state.party) {
      expect(idle.state.entities.get(id)!.hero!.solo).toBe(100);
      expect(soloMarkOf(idle.state, idle.state.entities.get(id)!)).toBeNull();
    }
    const { sim, st, hero, setSolo } = fight();
    setSolo(1, 100);
    sim.step([]);
    expect(soloMarkOf(st, hero(1))).not.toBeNull();
    const statuses = hero(1).health!.statuses as unknown as Record<string, unknown>[];
    for (const id of ['possessed', 'stilled']) {
      statuses.push({ id, remaining: 9, duration: 9, stacks: 1, source: null });
      expect(soloMarkOf(st, hero(1)), id).toBeNull();
      statuses.pop();
    }
    (hero(1).health as { downed: boolean }).downed = true;
    expect(soloMarkOf(st, hero(1))).toBeNull();
  });

  it('with Hollow Crown every Solo is Cued, Thread or not: the Cued look', () => {
    const relic = CONTENT.relics.find((r) => r.id === 'hollow_crown');
    expect(relic).toBeDefined();
    const { sim, st, hero, setSolo } = fight({ relics: ['hollow_crown'] });
    expect(st.mods.alwaysCued).toBe(true);
    setSolo(1, 100);
    sim.step([]);
    expect(st.entities.get(st.weaverId)!.weaver!.threadSlot).not.toBe(1);
    expect(soloMarkOf(st, hero(1))).toMatchObject({ cued: true });
  });
});

describe('the two looks, drawn', () => {
  it('plain: one dashed ring with a note over the head, quiet while charging, loud once full', () => {
    const { sim, st, hero, setSolo } = fight();
    const { frame } = viewOf(sim);
    expect(frame()).toEqual([]);
    setSolo(1, 95);
    sim.step([]);
    const quiet = frame(1, true);
    expect(quiet).toHaveLength(1);
    const e = hero(1);
    const q = quiet[0]!;
    expect(q.style).toBe(SPRITE.solo);
    // In the Thread glyph's slot over the drawn head.
    expect(q).toMatchObject({ x: e.x, z: e.z });
    expect(q.y).toBeCloseTo(e.height * HERO_DRAWN + SOLO_MARK_LIFT, 9);
    // The plain look: `param` is how full the ring is (under 1).
    expect(q.param).toBeCloseTo(soloMarkOf(st, e)!.fill, 9);
    expect(q.param).toBeLessThan(1);
    expect(q.size).toBeCloseTo(SOLO_MARK_SIZE * SOLO_MARK_QUIET, 9);
    // Full: the same shape, larger and brighter.
    setSolo(1, 100);
    sim.step([]);
    const loud = frame(1, true)[0]!;
    expect(loud.style).toBe(SPRITE.solo);
    expect(loud.param).toBeLessThan(1);
    expect(loud.size).toBeCloseTo(SOLO_MARK_SIZE, 9);
    expect(loud.alpha).toBeGreaterThan(q.alpha + 0.2);
  });

  it('Cued: a solid rayed ring, a third larger, with a light behind it; it pops once', () => {
    const { sim, hero, setSolo } = fight();
    const { frame } = viewOf(sim);
    setSolo(1, 95);
    sim.step([]);
    frame();
    sim.step([{ t: 'thread', slot: 1 }]);
    const sizes: number[] = [];
    for (let i = 0; i < 30; i++) {
      const drawn = frame();
      expect(drawn).toHaveLength(2);
      const ring = drawn.find((d) => d.style === SPRITE.solo)!;
      const glow = drawn.find((d) => d.style === SPRITE.glow)!;
      // The Cued look: `param` 2 + how full.
      expect(ring.param).toBeGreaterThanOrEqual(2);
      expect(ring.param).toBeLessThanOrEqual(3);
      expect(glow.size).toBeGreaterThan(ring.size);
      expect(ring.y).toBeCloseTo(hero(1).height * HERO_DRAWN + SOLO_MARK_LIFT, 9);
      sizes.push(ring.size);
    }
    // The pop: it swells as the Thread arrives, then rests at its size.
    expect(Math.max(...sizes)).toBeGreaterThan(SOLO_MARK_CUED_SIZE * 1.15);
    expect(sizes.at(-1)).toBeCloseTo(SOLO_MARK_CUED_SIZE, 9);
    expect(SOLO_MARK_CUED_SIZE / SOLO_MARK_SIZE).toBeGreaterThan(1.3);
  });

  it('a call’s bubble over the hero: the mark stands above it', () => {
    const { sim, st, hero, setSolo } = fight();
    const { frame } = viewOf(sim);
    setSolo(1, 95);
    sim.step([]);
    const low = frame(1, true)[0]!.y;
    (hero(1).hero as { call: unknown }).call = {
      answer: 'ward',
      start: st.time,
      end: st.time + 3,
      answered: false,
    };
    expect(soloMarkOf(st, hero(1))!.raised).toBe(true);
    expect(frame(1, true)[0]!.y).toBeCloseTo(low + SOLO_MARK_CALL_LIFT, 9);
  });

  it('Silent Cues: a second ring outside the first fills as the Thread holds', () => {
    const level = CONTENT.dissonance.find((d) => d.effect === 'cue_hold')!;
    const { sim, st, hero, setSolo } = fight({ dissonance: [{ id: level.id, rank: 1 }] });
    const { frame } = viewOf(sim);
    setSolo(1, 95);
    sim.step([]);
    expect(frame(1, true)).toHaveLength(1);
    sim.step([{ t: 'thread', slot: 1 }]);
    sim.step([]);
    const drawn = frame(1, true);
    expect(drawn).toHaveLength(2);
    const ring = drawn.find((d) => d.style === SPRITE.solo)!;
    const hold = drawn.find((d) => d.style === SPRITE.timer)!;
    expect(ring.param).toBeLessThan(1);
    expect(hold.size).toBeCloseTo(ring.size * SOLO_MARK_HOLD, 9);
    expect(hold.param).toBeCloseTo(soloMarkOf(st, hero(1))!.hold, 9);
    expect(hold.param).toBeGreaterThan(0);
    expect(hold.param).toBeLessThan(0.2);
  });
});

describe('comfort and cost', () => {
  it('Reduced motion: the mark neither breathes nor pops; only its fill moves', () => {
    for (const threaded of [false, true]) {
      const { sim, setSolo } = fight();
      const { frame } = viewOf(sim);
      setSolo(1, 100);
      sim.step(threaded ? [{ t: 'thread', slot: 1 }] : []);
      const sizes = new Set<string>();
      const alphas = new Set<string>();
      for (let i = 0; i < 40; i++) {
        sim.step([]);
        const drawn = frame(1, true);
        if (drawn.length === 0) break;
        const ring = drawn.find((d) => d.style === SPRITE.solo)!;
        sizes.add(ring.size.toFixed(6));
        alphas.add(ring.alpha.toFixed(6));
      }
      expect(sizes.size, `threaded ${threaded}`).toBe(1);
      expect(alphas.size, `threaded ${threaded}`).toBe(1);
    }
    // Without it the loud plain look breathes.
    const { sim, setSolo } = fight();
    const { frame } = viewOf(sim);
    setSolo(1, 100);
    sim.step([]);
    const sizes = new Set<string>();
    for (let i = 0; i < 20; i++) sizes.add(frame()[0]!.size.toFixed(6));
    expect(sizes.size).toBeGreaterThan(5);
  });

  it('Flashes at 0 dims it, but it stays plain to see: it is information, not a flash', () => {
    const { sim, setSolo } = fight();
    const { frame } = viewOf(sim);
    setSolo(1, 100);
    sim.step([]);
    const full = frame(1, true)[0]!.alpha;
    const none = frame(0, true)[0]!.alpha;
    expect(none).toBeLessThan(full);
    expect(none).toBeGreaterThanOrEqual(0.55);
  });

  it('two sprites a hero at most (three with Silent Cues’ hold), and nothing else', () => {
    const { sim, setSolo } = fight();
    const { frame } = viewOf(sim);
    for (const slot of [0, 1, 2]) setSolo(slot, 100);
    sim.step([{ t: 'thread', slot: 2 }]);
    sim.step([]);
    const drawn = frame();
    // Three heroes: two plain marks (one sprite each) and one Cued (ring and light).
    expect(drawn).toHaveLength(4);
    expect(drawn.filter((d) => d.style === SPRITE.solo)).toHaveLength(3);
  });

  it('its colour is the palette’s call, far from danger, Mend and the enemy outline in every vision', () => {
    // The enemies' red outline (the art studio's hostile red).
    const OUTLINE = '#ef4444';
    try {
      for (const vision of COLOR_VISIONS) {
        applyVision(vision);
        const p = visionPalette(vision);
        const { sim, setSolo } = fight();
        const { frame } = viewOf(sim);
        setSolo(1, 100);
        sim.step([]);
        const mark = frame(1, true)[0]!.hex;
        expect(mark).toBe(`#${C.call.getHexString()}`);
        expect(mark).toBe(p.call.toLowerCase());
        for (const other of [p.lethal, p.threat, p.mend, p.heal, p.empower, OUTLINE])
          expect(
            deltaE(simulateVision(mark, vision), simulateVision(other, vision)),
            `${vision}: ${mark} vs ${other}`,
          ).toBeGreaterThanOrEqual(30);
      }
    } finally {
      applyVision('normal');
    }
  });
});
