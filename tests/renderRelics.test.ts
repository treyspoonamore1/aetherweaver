/**
 * Phase 3b VFX: relics in the fight (docs/phase-3b/vfx.md). Every check drives the real sim,
 * stages the moment each relic acts (as tests/sim/relics.test.ts does), feeds the real events
 * to the real RelicView over a real FxKit, and checks the right visual starts on the right
 * hero and draws.
 */
import * as THREE from 'three';
import { afterEach, describe, expect, it } from 'vitest';
import { COLOR_VISIONS, deltaE, simulateVision, visionPalette } from '../src/app/colorVision';
import { CONTENT } from '../src/content';
import { CHORD_PRESETS } from '../src/meta/run';
import type { EntityId, Sim, SimEvent, WorldState } from '../src/sim';
import { threadPotency } from '../src/sim/systems/thread';
import { FxKit } from '../src/render/fx/kit';
import { applyVision } from '../src/render/palette';
import {
  CUE_OF_RELIC,
  PrismScan,
  flareScale,
  metronomeCharge,
  relicCharge,
  relicCue,
  relicValue,
  thimbleCharge,
} from '../src/render/relicCues';
import { RELIC_HEX, RelicView, type RelicRec } from '../src/render/relics';
import { auraHearing, chordMask, fieldLook, fieldLoudness, isFullEcho } from '../src/render/songs';
import {
  hero,
  hurt,
  ofType,
  resolvedOf,
  sandbox,
  stepFor,
  stepUntil,
  telegraphOn,
  worldOf,
} from './sim/helpers';

const relics = (...ids: string[]) => ({ relics: ids });

interface Counts {
  rings: number;
  beams: number;
  sprites: number;
  top: number;
  shells: number;
  ribbons: number;
}

/** A RelicView over a real FxKit, with entity records taken straight from the sim state. */
function harness() {
  const kit = new FxKit();
  const recs = new Map<EntityId, RelicRec>();
  const callouts: string[] = [];
  const trauma: number[] = [];
  const view = new RelicView({
    kit,
    recs,
    overlay: { callout: (_x, _y, _z, text) => void callouts.push(text) },
    rig: { addTrauma: (n) => void trauma.push(n) },
  });
  const cam = new THREE.Vector3(0, 22, 18);
  let time = 0;
  const place = (state: WorldState) => {
    for (const e of state.entities.list()) {
      let r = recs.get(e.id);
      if (!r) {
        r = { x: 0, y: 0, z: 0, radius: 0, height: 0, yaw: 0 };
        recs.set(e.id, r);
      }
      r.x = e.x;
      r.z = e.z;
      r.radius = e.radius;
      r.height = e.height;
    }
  };
  /** One render frame; returns how many instances each batch drew. */
  const frame = (state: WorldState, flashes = 1, withRecs = true): Counts => {
    if (withRecs) place(state);
    kit.begin(time, cam);
    view.sync(state, 1 / 60, time, flashes);
    const c: Counts = {
      rings: kit.rings.size,
      beams: kit.beams.size,
      sprites: kit.sprites.size,
      top: kit.spritesTop.size,
      shells: kit.shells.size,
      ribbons: kit.ribbons.vertices,
    };
    kit.end(1 / 60, 1280, 720, 720, 45);
    time += 1 / 60;
    return c;
  };
  const feed = (events: readonly SimEvent[], state: WorldState) => view.handle(events, state);
  const total = (c: Counts) => c.rings + c.beams + c.sprites + c.top + c.shells + c.ribbons;
  return { kit, view, recs, callouts, trauma, frame, feed, total };
}

/** Feeds `events`, then renders `frames` frames; returns the busiest frame's counts. */
function play(h: ReturnType<typeof harness>, sim: Sim, events: SimEvent[], frames = 20) {
  h.feed(events, sim.state);
  let peak = 0;
  for (let i = 0; i < frames; i++) peak = Math.max(peak, h.total(h.frame(sim.state)));
  return peak;
}

describe('relic cues', () => {
  it('maps every relicTriggered relic to a visual, and only a locked Glide to Heavy Score', () => {
    for (const id of Object.keys(CUE_OF_RELIC))
      expect(
        CONTENT.relics.some((r) => r.id === id),
        id,
      ).toBe(true);
    const ev = (relic: string): SimEvent => ({ type: 'relicTriggered', tick: 0, relic, hero: 1 });
    expect(relicCue(ev('silver_thimble'))).toBe('thimble');
    expect(relicCue(ev('cantors_hymnal'))).toBe('hymnal');
    expect(relicCue(ev('no_such_relic'))).toBeNull();
    const rejected = (technique: 'glide' | 'thread', reason: 'locked' | 'cooldown'): SimEvent => ({
      type: 'techniqueRejected',
      tick: 0,
      technique,
      reason,
    });
    expect(relicCue(rejected('glide', 'locked'))).toBe('heavy');
    expect(relicCue(rejected('glide', 'cooldown'))).toBeNull();
    // A Thread lockout after a snap is also 'locked': not Heavy Score.
    expect(relicCue(rejected('thread', 'locked'))).toBeNull();
  });

  it('reads relic numbers from content and charge timers from state', () => {
    expect(relicValue('prism_loom', 'radius', -1)).toBe(
      CONTENT.relics.find((r) => r.id === 'prism_loom')!.values.radius,
    );
    expect(relicValue('nope', 'radius', 7)).toBe(7);
    expect(relicCharge(null, 5, 12)).toBeNull();
    expect(relicCharge(5, 5, 12)).toBe(1);
    expect(relicCharge(11, 5, 12)).toBeCloseTo(0.5, 6);
    expect(flareScale(0)).toBeCloseTo(0.35, 6);
    expect(flareScale(1)).toBe(1);
    expect(flareScale(0.5)).toBeGreaterThan(flareScale(0));
  });

  it('keeps the relic colours apart from danger under every colour-vision palette', () => {
    for (const v of COLOR_VISIONS) {
      const p = visionPalette(v);
      const see = (hex: string) => simulateVision(hex, v);
      for (const [name, hex] of Object.entries(RELIC_HEX)) {
        expect(deltaE(see(hex), see(p.lethal)), `${v} ${name}/lethal`).toBeGreaterThanOrEqual(20);
        expect(deltaE(see(hex), see(p.threat)), `${v} ${name}/threat`).toBeGreaterThanOrEqual(15);
      }
    }
  });
});

describe('relics in the fight (real sim → RelicView)', () => {
  afterEach(() => {
    applyVision('normal');
  });

  it('Silver Thimble: the needle and stitch play on the hero the Thread moved to', () => {
    const sim = sandbox(relics('silver_thimble'));
    const h = harness();
    h.frame(sim.state);
    expect(thimbleCharge(sim.state)).toBe(1);
    // Ready: a glint waits at the Weaver's hand.
    const idle = h.frame(sim.state);
    expect(idle.sprites).toBeGreaterThan(0);
    const events = stepFor(sim, 1, [{ t: 'thread', slot: 1 }]);
    expect(ofType(events, 'relicTriggered').map((e) => e.relic)).toEqual(['silver_thimble']);
    const peak = play(h, sim, events);
    expect(h.view.fired.thimble).toBe(1);
    expect(peak).toBeGreaterThan(h.total(idle));
    expect(thimbleCharge(sim.state)).toBeLessThan(1);
    // Too soon: no second shield, no second stitch.
    const again = stepFor(sim, 30, [{ t: 'thread', slot: 2 }]);
    h.feed(again, sim.state);
    expect(h.view.fired.thimble).toBe(1);
    expect(h.callouts).toEqual(['THIMBLE']);
  });

  it('Lantern of the Lost: lights rise from the fallen hero and land on the others', () => {
    const sim = sandbox(relics('lantern_of_the_lost'));
    stepFor(sim, 5);
    const h = harness();
    h.frame(sim.state);
    hurt(sim, 0, 1e6);
    const events = sim.drainEvents();
    const fired = ofType(events, 'relicTriggered');
    expect(fired.map((e) => e.relic)).toEqual(['lantern_of_the_lost']);
    expect(fired[0]!.hero).toBe(hero(sim, 0).id);
    h.feed(events, sim.state);
    // Lights for Lyra and Vexis, not the fallen Kael.
    const m = (
      h.view as unknown as { pool: { active: boolean; targets: number[]; tcount: number }[] }
    ).pool.find((p) => p.active)!;
    expect(m.targets.slice(0, m.tcount)).toEqual([hero(sim, 1).id, hero(sim, 2).id]);
    let shells = 0;
    for (let i = 0; i < 70; i++) shells = Math.max(shells, h.frame(sim.state).shells);
    expect(shells).toBeGreaterThanOrEqual(2);
    expect(h.callouts).toContain('LANTERN');
    for (let i = 0; i < 60; i++) h.frame(sim.state);
    expect(h.view.activeCount()).toBe(0);
  });

  it('Martyr’s Veil: the veil runs from the saved hero to the Weaver, who takes the blow', () => {
    const sim = sandbox(relics('martyrs_veil'));
    stepFor(sim, 5);
    const h = harness();
    h.frame(sim.state);
    hurt(sim, 0, 1e5);
    const events = sim.drainEvents();
    expect(ofType(events, 'relicTriggered')[0]).toMatchObject({
      relic: 'martyrs_veil',
      hero: hero(sim, 0).id,
    });
    expect(ofType(events, 'save')[0]?.cause).toBe('martyr');
    expect(ofType(events, 'damageTaken').some((e) => e.target === sim.state.weaverId)).toBe(true);
    h.feed(events, sim.state);
    let ribbons = 0;
    for (let i = 0; i < 40; i++) ribbons = Math.max(ribbons, h.frame(sim.state).ribbons);
    expect(ribbons).toBeGreaterThan(20);
    expect(h.view.fired.veil).toBe(1);
    expect(h.callouts).toEqual(['VEIL']);
    expect(h.trauma.length).toBe(1);
  });

  it('Cracked Metronome: ticks while ready, fires on the warded hero, then winds back up', () => {
    const { sim, telegraph: t } = telegraphOn(
      'bell_brute',
      'Toll Cleave',
      0,
      2.5,
      sandbox(relics('cracked_metronome')),
    );
    const h = harness();
    expect(metronomeCharge(sim.state)).toBe(1);
    const ready = h.frame(sim.state);
    expect(ready.beams).toBeGreaterThanOrEqual(1); // the pendulum
    // An early Ward (long before the Perfect window): the Metronome makes it Perfect.
    const events = stepFor(sim, 1, [{ t: 'tech', id: 'ward', slot: 0 }]);
    const { events: rest } = resolvedOf(sim, t.id);
    const all = [...events, ...rest];
    expect(ofType(all, 'perfectWard')).toHaveLength(1);
    const fired = ofType(all, 'relicTriggered').filter((e) => e.relic === 'cracked_metronome');
    expect(fired[0]?.hero).toBe(hero(sim, 0).id);
    play(h, sim, all, 5);
    expect(h.view.fired.metronome).toBe(1);
    expect(h.callouts).toContain('METRONOME');
    expect(metronomeCharge(sim.state)).toBeLessThan(1);
    // (The brute's cleave can knock the Weaver down too: the dial hides while they're down.)
    stepFor(sim, 1, [{ t: 'debug', op: { op: 'killEnemies' } }]);
    stepUntil(sim, () => !sim.state.entities.get(sim.state.weaverId)!.health!.downed);
    expect(metronomeCharge(sim.state)).toBeLessThan(1);
    for (let i = 0; i < 90; i++) h.frame(sim.state);
    expect(h.view.activeCount()).toBe(0);
    // Winding up: the dial, no pendulum.
    const winding = h.frame(sim.state);
    expect(winding.beams).toBe(0);
    expect(winding.rings).toBeGreaterThanOrEqual(1);
  });

  it('Tuning Fork: the fork rings on the hero and their Solo arc grows by its share', () => {
    const { sim, telegraph: t } = telegraphOn(
      'bell_brute',
      'Toll Cleave',
      0,
      2.5,
      sandbox(relics('tuning_fork')),
    );
    const h = harness();
    stepUntil(sim, () => sim.state.time >= t.perfectFrom + 0.05);
    h.frame(sim.state);
    const events = stepFor(sim, 1, [{ t: 'tech', id: 'ward', slot: 0 }]);
    const { events: rest } = resolvedOf(sim, t.id);
    const all = [...events, ...rest];
    expect(ofType(all, 'relicTriggered').map((e) => e.relic)).toEqual(['tuning_fork']);
    const peak = play(h, sim, all, 10);
    expect(h.view.fired.fork).toBe(1);
    expect(peak).toBeGreaterThan(8);
    expect(h.callouts).toEqual([`+${relicValue('tuning_fork', 'pct', 0)}% SOLO`]);
  });

  it('Glass Halo: the halo shatters into glints for every hero standing', () => {
    const { sim, telegraph: t } = telegraphOn(
      'bell_brute',
      'Toll Cleave',
      0,
      2.5,
      sandbox(relics('glass_halo')),
    );
    hurt(sim, 2, 300);
    const h = harness();
    stepUntil(sim, () => sim.state.time >= t.perfectFrom + 0.05);
    const events = stepFor(sim, 1, [{ t: 'tech', id: 'ward', slot: 0 }]);
    const { events: rest } = resolvedOf(sim, t.id);
    const all = [...events, ...rest];
    expect(ofType(all, 'relicTriggered').filter((e) => e.relic === 'glass_halo')).toHaveLength(1);
    h.feed(all, sim.state);
    const m = (h.view as unknown as { pool: { active: boolean; tcount: number }[] }).pool.find(
      (p) => p.active,
    )!;
    expect(m.tcount).toBe(3);
    let sprites = 0;
    for (let i = 0; i < 40; i++) sprites = Math.max(sprites, h.frame(sim.state).sprites);
    expect(sprites).toBeGreaterThanOrEqual(6); // two glints per hero in flight
    expect(h.callouts).toContain('GLASS HALO');
  });

  it('Cantor’s Hymnal: the tick-0 event waits for the first drawn frame, then shimmers', () => {
    const sim = sandbox(relics('cantors_hymnal'));
    const events = sim.drainEvents();
    expect(ofType(events, 'relicTriggered').map((e) => e.relic)).toEqual(['cantors_hymnal']);
    const h = harness();
    h.feed(events, sim.state);
    // No entity drawn yet (the runtime dispatches tick-0 events before the first sync).
    h.frame(sim.state, 1, false);
    expect(h.view.activeCount('hymnal')).toBe(1);
    expect(h.callouts).toEqual([]);
    const peak = h.total(h.frame(sim.state));
    expect(peak).toBeGreaterThan(5);
    expect(h.callouts).toEqual(['HYMNAL · CUE READY']);
  });

  it('Heavy Score: a refused Glide drops the chain once, however hard Space is mashed', () => {
    const sim = sandbox(relics('heavy_score'));
    const h = harness();
    h.frame(sim.state);
    const events = [
      ...stepFor(sim, 2, [{ t: 'glide', x: 1, z: 0 }]),
      ...stepFor(sim, 2, [{ t: 'glide', x: 1, z: 0 }]),
    ];
    expect(ofType(events, 'techniqueRejected').filter((e) => e.reason === 'locked')).toHaveLength(
      2,
    );
    play(h, sim, events, 30);
    expect(h.view.fired.heavy).toBe(1);
    expect(h.callouts).toEqual(['NO GLIDE']);
    // A Forge lifts the curse: Glide works, nothing to show.
    const lifted = sandbox({ relics: [{ id: 'heavy_score', cleansed: true }] });
    const h2 = harness();
    play(h2, lifted, stepFor(lifted, 2, [{ t: 'glide', x: 1, z: 0 }]), 2);
    expect(h2.view.fired.heavy).toBe(0);
  });

  it('an Empowered relic’s cues read its empowered numbers (docs/phase-4c.md)', () => {
    const empowered = sandbox({
      relics: [
        { id: 'prism_loom', empowered: true },
        { id: 'cracked_metronome', empowered: true },
      ],
    });
    expect(empowered.state.relics.empowered).toEqual(['prism_loom', 'cracked_metronome']);
    const loom = CONTENT.relics.find((r) => r.id === 'prism_loom')!;
    const scan = new PrismScan().scan(empowered.state);
    expect(scan.radius).toBe(loom.empowered!.values.radius);
    expect(scan.pct).toBeCloseTo(loom.empowered!.values.pct! / 100, 9);
    const metronome = CONTENT.relics.find((r) => r.id === 'cracked_metronome')!;
    expect(relicValue('cracked_metronome', 'cooldown', 12, empowered.state)).toBe(
      metronome.empowered!.values.cooldown,
    );
    // Not Empowered: its own numbers.
    expect(new PrismScan().scan(sandbox(relics('prism_loom')).state).radius).toBe(
      loom.values.radius,
    );
  });

  it('Prism Loom: reaches exactly the heroes the sim’s threadPotency does, at the same share', () => {
    const sim = sandbox(relics('prism_loom'));
    stepFor(sim, 2, [{ t: 'thread', slot: 1 }]);
    const w = worldOf(sim);
    const [kael, lyra, vexis] = w.party.map((id) => w.entities.get(id)!);
    const scan = new PrismScan();
    const R = relicValue('prism_loom', 'radius', 4);
    // Kael inside, Vexis outside, then both inside, then a taut Thread (weaker), then Mend → Empower.
    const layouts: [number, number][] = [
      [R - 1, R + 4],
      [R - 0.5, -(R - 0.2)],
      [R + kael!.radius - 0.05, R + vexis!.radius + 0.3],
    ];
    for (const [dk, dv] of layouts) {
      kael!.x = lyra!.x + dk;
      kael!.z = lyra!.z;
      vexis!.x = lyra!.x + dv;
      vexis!.z = lyra!.z;
      for (const tension of [0, 0.7]) {
        w.entities.get(w.weaverId)!.weaver!.threadTension = tension;
        scan.scan(sim.state);
        expect(scan.threaded).toBe(lyra!.id);
        for (const e of [kael!, vexis!])
          expect(scan.potencyOf(e.id), `${dk},${dv},${tension}`).toBeCloseTo(
            threadPotency(w, e),
            9,
          );
      }
    }
    w.entities.get(w.weaverId)!.weaver!.threadTension = 0;
    // And it draws: one prismatic link per hero inside, none without the relic.
    kael!.x = lyra!.x + R - 1;
    vexis!.x = lyra!.x + R + 4;
    const h = harness();
    let with1 = 0;
    for (let i = 0; i < 30; i++) with1 = h.frame(sim.state).ribbons;
    expect(h.view.prism.count).toBe(1);
    expect(with1).toBe(2 * 2 * 13); // two strips × 13 points × 2 vertices
    vexis!.x = lyra!.x - (R - 1);
    let with2 = 0;
    for (let i = 0; i < 30; i++) with2 = h.frame(sim.state).ribbons;
    expect(with2).toBe(2 * with1);
    // A downed threaded hero spreads nothing (the sim's Mend revives instead).
    hurt(sim, 1, 1e6);
    sim.drainEvents();
    expect(scan.scan(sim.state).count).toBe(0);
    const plain = sandbox();
    stepFor(plain, 2, [{ t: 'thread', slot: 1 }]);
    const h0 = harness();
    for (let i = 0; i < 5; i++) expect(h0.frame(plain.state).ribbons).toBe(0);
  });

  it('Spindle of Fate: a full-strength echo stays the echo, drawn as loud as a field song', () => {
    const guardian = CHORD_PRESETS.find((p) => p.id === 'guardian')!.chords.map((c) => ({ ...c }));
    const plain = sandbox({ chords: guardian });
    const spun = sandbox({ chords: guardian, ...relics('spindle_of_fate') });
    for (const sim of [plain, spun]) stepFor(sim, 5, [{ t: 'thread', slot: 1 }]);
    const [beam0, field0] = plain.state.field.chords;
    const [beam1, field1] = spun.state.field.chords;
    expect(beam1!.echo).toBeCloseTo(1, 6);
    // Still the echo (dashed, nudged outside a shared field song), now at full loudness.
    expect(fieldLook(beam1!)).toBe('echo');
    expect(isFullEcho(beam1!)).toBe(true);
    expect(fieldLoudness(beam1!)).toBe(1);
    expect(isFullEcho(beam0!)).toBe(false);
    expect(fieldLoudness(beam0!)).toBeLessThan(0.75);
    expect(fieldLook(field0!)).toBe('song');
    expect(fieldLook(field1!)).toBe('song');
    // Heroes who hear the echo get the full-strength dashed arc; the threaded one is poured in.
    const mask = chordMask(beam1!.auras);
    const bit = mask & -mask;
    const kael = spun.state.entities.get(spun.state.party[0]!)!.hero!;
    const lyra = spun.state.entities.get(spun.state.party[1]!)!.hero!;
    expect(auraHearing(bit, mask, kael.beamFocus, isFullEcho(beam1!))).toBe('fullEcho');
    expect(auraHearing(bit, mask, lyra.beamFocus, isFullEcho(beam1!))).toBe('focus');
    expect(auraHearing(bit, mask, false, false)).toBe('echo');
  });

  it('reduced flashes dim the bright relic flares but never remove the moment', () => {
    const run = (flashes: number) => {
      const sim = sandbox(relics('silver_thimble'));
      const h = harness();
      h.frame(sim.state, flashes);
      h.feed(stepFor(sim, 1, [{ t: 'thread', slot: 0 }]), sim.state);
      let peak = 0;
      for (let i = 0; i < 30; i++) peak = Math.max(peak, h.total(h.frame(sim.state, flashes)));
      return { peak, fired: h.view.fired.thimble };
    };
    const full = run(1);
    const off = run(0);
    expect(off.fired).toBe(1);
    expect(off.peak).toBe(full.peak);
  });
});
