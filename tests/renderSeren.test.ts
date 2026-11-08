/**
 * Phase 5e VFX: Seren, the Riposte (docs/phase-5e.md, Presentation). Every check drives a real
 * headless sim and feeds its state and events to the real EntityLayer, PartyBarsView, Feedback
 * and BondsView over a real FxKit, then reads what they drew. Where a Seren mechanic is the
 * sim's to produce (a parry, a kill shot, a Showboat quarry, a blink: W1's `duel.ts`), the test
 * stages it on the real world as the contract says the sim keeps it, so render is checked
 * against the contract on its own.
 */
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import * as THREE from 'three';
import { afterEach, describe, expect, it } from 'vitest';
import { CONTENT, heroDef } from '../src/content';
import { createSim, newDuel, parryable, type Command, type Sim, type SimEvent } from '../src/sim';
import { addShield } from '../src/sim/combat/health';
import { beginAttack } from '../src/sim/systems/enemies';
import type { Entity } from '../src/sim/state';
import { BondsView } from '../src/render/bonds';
import { CallView } from '../src/render/calls';
import type { CameraRig } from '../src/render/camera';
import { EntityLayer } from '../src/render/entities';
import { FermataView } from '../src/render/fermata';
import { Feedback } from '../src/render/feedback';
import { FieldView } from '../src/render/field';
import { FxKit } from '../src/render/fx/kit';
import { SEREN_STEEL, buildHero } from '../src/render/models/library';
import { createModelMaterial } from '../src/render/models/material';
import type { Overlay } from '../src/render/overlay';
import { applyVision } from '../src/render/palette';
import { PartyBarsView } from '../src/render/partyBars';
import {
  EXECUTED_TEXT,
  KILL_SHOT_STOP,
  KILL_SHOT_TEXT,
  PARRIED_TEXT,
  SEREN_HEX,
  beyondReach,
  heavyPip,
  parryGlyph,
  reachArcShows,
  rosterHeavyShown,
} from '../src/render/serenCues';
import type { Stage } from '../src/render/stage';
import { TelegraphLayer } from '../src/render/telegraphs';
import { ThreadView } from '../src/render/thread';
import type { FrameInfo } from '../src/render/types';
import { SILENCE_INK } from '../src/ui/hud/finaleLook';
import { sandbox, spawn, worldOf } from './sim/helpers';

const SETTINGS: FrameInfo['settings'] = {
  screenShake: 1,
  flashes: 1,
  damageNumbers: true,
  colorVision: 'normal',
};

/** Kael, Seren, Vexis: Seren in Lyra's slot. */
const WITH_SEREN = ['kael', 'seren', 'vexis'];
const SEREN = 1;

class FakeOverlay {
  width = 1280;
  height = 720;
  callouts: { text: string; color: string }[] = [];
  beginFrame(): void {}
  badge(): void {}
  allyBar(): void {}
  summonBar(): void {}
  raid(): void {}
  callout(_x: number, _y: number, _z: number, text: string, color: string): void {
    this.callouts.push({ text, color });
  }
  /** Each number's latest gold chip, by handle (one handle per number spawned). */
  chips: (string | null)[] = [];
  spawnNumber(): number {
    this.chips.push(null);
    return this.chips.length - 1;
  }
  setNumber(handle: number, _text: string, chip: string | null): void {
    this.chips[handle] = chip;
  }
  numberAlive(): boolean {
    return true;
  }
  flash(): void {}
  coolFlash(): void {}
  chroma(): void {}
  spotlight(): void {}
  danger(): void {}
  setStasis(): void {}
  bubble(): void {}
  edgeArrow(): void {}
}

function harness(sim: Sim) {
  const kit = new FxKit();
  const entities = new EntityLayer(createModelMaterial());
  const field = new FieldView(entities);
  const telegraphs = new TelegraphLayer(entities);
  const thread = new ThreadView(entities, null);
  const bars = new PartyBarsView(entities);
  const fake = new FakeOverlay();
  const overlay = fake as unknown as Overlay;
  const stage = {
    lights: {
      key: new THREE.DirectionalLight(),
      hemi: new THREE.HemisphereLight('#ffe7c2'),
      rim: new THREE.DirectionalLight(),
    },
  } as unknown as Stage;
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
  const bonds = new BondsView({ kit, recs: entities.recs, overlay: fake, rig });
  const cam = new THREE.Vector3(0, 22, 18);
  let time = 0;
  const frame = (ev: SimEvent[]) => {
    feedback.handle(ev, sim.state);
    bonds.handle(ev, sim.state);
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
    bonds.sync(sim.state, 1 / 60, time);
    kit.end(1 / 60, 1280, 720, 720, 45);
    time += 1 / 60;
  };
  const tick = (commands: Command[] = []) => {
    sim.step(commands);
    const ev = sim.drainEvents();
    frame(ev);
    return ev;
  };
  const run = (ticks: number, commands: Command[] = []) => {
    for (let i = 0; i < ticks; i++) tick(i === 0 ? commands : []);
  };
  const drewIn = (hex: string) => {
    const c = new THREE.Color(hex);
    const scan = (a: ArrayLike<number>, n: number) => {
      for (let i = 0; i < n; i++)
        if (
          Math.abs(a[i * 4]! - c.r) < 1e-4 &&
          Math.abs(a[i * 4 + 1]! - c.g) < 1e-4 &&
          Math.abs(a[i * 4 + 2]! - c.b) < 1e-4
        )
          return true;
      return false;
    };
    return (
      scan(kit.rings.array('iColor'), kit.rings.size) ||
      scan(kit.sprites.array('iColor'), kit.sprites.size) ||
      scan(kit.spritesTop.array('iColor'), kit.spritesTop.size) ||
      scan(kit.beams.array('iColor'), kit.beams.size)
    );
  };
  return { kit, entities, bars, feedback, bonds, overlay: fake, tick, run, frame, drewIn };
}

function setup(party: string[] = WITH_SEREN) {
  const sim = sandbox({ party });
  const w = worldOf(sim);
  const of = (slot: number) => w.entities.get(w.party[slot]!)! as Entity;
  return { sim, w, of, h: harness(sim) };
}

/** Seren's `duel` as the sim keeps it (world.ts spawns it for a `parry` passive). */
function dueled(e: Entity) {
  if (!e.hero!.duel) e.hero!.duel = newDuel();
  return e.hero!.duel;
}

/** A Weaver Ward on her (she stands en garde under it). */
const ward = (sim: Sim, e: Entity) => addShield(worldOf(sim), e, 'ward', 390, 4, true);

const enemiesOf = (sim: Sim) =>
  [...worldOf(sim).entities.list()].filter((e) => e.enemy && !e.health?.dead);

afterEach(() => applyVision('normal'));

describe('Seren’s model', () => {
  /** The starters' geometry, pinned (renderBrann.test.ts: before Brann, and still). */
  const STARTERS: Record<string, string> = {
    kael: 'a308e371062b933d',
    lyra: '255f216e02f7ed32',
    vexis: 'dd3c1eeb35556e95',
  };
  const hashOf = (g: THREE.BufferGeometry) => {
    const h = createHash('sha256');
    for (const k of ['position', 'normal', 'color', 'aGlow'])
      h.update(Buffer.from((g.getAttribute(k).array as Float32Array).buffer));
    return h.digest('hex').slice(0, 16);
  };
  const parts = (g: THREE.BufferGeometry, hex: string) => {
    const c = g.getAttribute('color');
    const want = new THREE.Color(hex);
    let n = 0;
    for (let i = 0; i < c.count; i++)
      if (
        Math.abs(c.getX(i) - want.r) < 1e-4 &&
        Math.abs(c.getY(i) - want.g) < 1e-4 &&
        Math.abs(c.getZ(i) - want.b) < 1e-4
      )
        n++;
    return n;
  };
  const box = (id: string) => {
    const g = buildHero(heroDef(id));
    g.computeBoundingBox();
    return g.boundingBox!;
  };
  const luma = (id: string) => {
    const c = buildHero(heroDef(id)).getAttribute('color');
    let s = 0;
    for (let i = 0; i < c.count; i++)
      s += 0.2126 * c.getX(i) + 0.7152 * c.getY(i) + 0.0722 * c.getZ(i);
    return s / c.count;
  };

  it('builds a duellist of her own: a steel coat and blade, her violet sash and edge', () => {
    const g = buildHero(heroDef('seren'));
    // Not the generic fallback (a cylinder and an orb).
    expect(g.getAttribute('position').count).toBeGreaterThan(400);
    expect(parts(g, SEREN_STEEL)).toBeGreaterThan(60);
    expect(parts(g, heroDef('seren').color)).toBeGreaterThan(24);
    for (const [id, hash] of Object.entries(STARTERS))
      expect(hashOf(buildHero(heroDef(id))), id).toBe(hash);
  });

  it('her rapier’s tip reaches ahead of every other hero’s box', () => {
    const tip = box('seren').min.z;
    for (const d of CONTENT.heroes)
      if (d.id !== 'seren') expect(tip, d.id).toBeLessThan(box(d.id).min.z - 0.2);
  });

  it('reads apart from Kael in greyscale: a different silhouette and a different value', () => {
    const k = box('kael');
    const s = box('seren');
    // Slim and tall: narrower than his shield and shoulders, taller.
    expect(s.max.x - s.min.x).toBeLessThan(k.max.x - k.min.x - 0.2);
    expect(s.max.y).toBeGreaterThan(k.max.y - 0.25);
    expect(Math.abs(luma('seren') - luma('kael'))).toBeGreaterThan(0.03);
  });

  it('her steel is model-only: the stilled ink by design, and no UI or 2D module imports it', () => {
    expect(SEREN_STEEL).toBe(SILENCE_INK);
    expect(SEREN_HEX.violet).toBe(heroDef('seren').color);
    expect(Object.values(SEREN_HEX)).not.toContain(SEREN_STEEL);
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.(ts|tsx)$/.test(p) && !p.endsWith(join('models', 'library.ts'))) {
          const src = readFileSync(p, 'utf8');
          if (/import[^;]*\bSEREN_STEEL\b[^;]*;/.test(src)) offenders.push(p);
        }
      }
    };
    walk(join(__dirname, '..', 'src'));
    expect(offenders).toEqual([]);
  });
});

describe('Seren’s cues', () => {
  it('her notched ring always; the crossed blades only while Warded', () => {
    const { sim, of, h } = setup();
    h.run(2);
    const seren = of(SEREN);
    dueled(seren);
    h.frame([]);
    expect(h.entities.drawn5e.notched).toBe(1);
    expect(h.entities.drawn5e.enGarde).toBe(0);
    ward(sim, seren);
    h.frame([]);
    expect(h.entities.drawn5e.enGarde).toBe(1);
    expect(h.drewIn(SEREN_HEX.flash)).toBe(true);
    // A Ward on Kael arms nothing.
    seren.health!.shields.length = 0;
    ward(sim, of(0));
    h.frame([]);
    expect(h.entities.drawn5e.enGarde).toBe(0);
  });

  it('the duel tether and crown on her quarry; overextended once three are on her', () => {
    const { sim, w, of, h } = setup();
    const seren = of(SEREN);
    h.run(1, [
      spawn('hollow_chorister', seren.x, seren.z - 4),
      spawn('hollow_chorister', seren.x + 2, seren.z - 4),
      spawn('hollow_chorister', seren.x - 2, seren.z - 4),
    ]);
    h.run(40);
    const foes = enemiesOf(sim);
    expect(foes.length).toBe(3);
    const duel = dueled(seren);
    duel.quarry = foes[0]!.id;
    h.frame([]);
    expect(h.entities.drawn5e.tethers).toBe(1);
    expect(h.entities.drawn5e.crowns).toBe(1);
    expect(h.drewIn(SEREN_HEX.violet)).toBe(true);
    for (const f of foes) f.enemy!.targetId = seren.id;
    h.frame([]);
    expect(h.entities.drawn5e.overextended).toBe(1);
    // Without a quarry she isn't duelling: never overextended.
    duel.quarry = null;
    h.frame([]);
    expect(h.entities.drawn5e.overextended).toBe(0);
    void w;
  });

  it('the reach arc beyond 10 m from the Weaver; beyond 14 m, out of reach', () => {
    const { sim, w, of, h } = setup();
    h.run(2);
    const seren = of(SEREN);
    dueled(seren);
    const weaver = w.entities.get(w.weaverId)!;
    const at = (d: number) => {
      seren.x = seren.px = weaver.x;
      seren.z = seren.pz = weaver.z - d;
    };
    at(8);
    h.frame([]);
    expect(h.entities.drawn5e.reachArcs).toBe(0);
    at(11);
    h.frame([]);
    expect(reachArcShows(sim.state, seren)).toBe(true);
    expect(beyondReach(sim.state, seren)).toBe(false);
    expect(h.entities.drawn5e.reachArcs).toBe(1);
    at(15);
    expect(beyondReach(sim.state, seren)).toBe(true);
    // Never for Kael, however far.
    expect(beyondReach(sim.state, of(0))).toBe(false);
  });

  it('Thousand Cuts hides her; each blink leaves an afterimage (gold-edged when Cued)', () => {
    const { sim, of, h } = setup();
    h.run(2);
    const seren = of(SEREN);
    dueled(seren);
    seren.hero!.soloId = 'thousandCuts';
    seren.hero!.soloActive = 3;
    seren.hero!.soloCued = true;
    const blink: SimEvent = {
      type: 'attackFired',
      tick: sim.state.tick,
      source: seren.id,
      target: null,
      visual: 'blink',
      fromX: seren.x,
      fromZ: seren.z,
      toX: seren.x + 3,
      toZ: seren.z,
      travel: 0,
    };
    h.frame([blink]);
    h.frame([]);
    expect(h.entities.drawn5e.hidden).toBe(1);
    expect(h.entities.drawn5e.afterimages).toBe(1);
    expect(h.feedback.seren.fired5e.blinks).toBe(1);
  });

  it('crossed blades on a blow she can parry aimed at her, never on one aimed at Kael', () => {
    const attack = CONTENT.attacks.find(
      (a) => parryable(a) && CONTENT.enemies.some((d) => d.specials.includes(a.id)),
    )!;
    expect(attack).toBeDefined();
    const owner = CONTENT.enemies.find((d) => d.specials.includes(attack.id))!;
    for (const [slot, glyphs] of [
      [SEREN, 1],
      [0, 0],
    ] as const) {
      const { sim, w, of, h } = setup();
      const target = of(slot);
      dueled(of(SEREN));
      h.run(1, [spawn(owner.id, target.x, target.z - 2.5)]);
      h.run(40);
      const foe = [...w.entities.list()].find((e) => e.enemy?.defId === owner.id)!;
      expect(beginAttack(w, foe, attack, target)).toBe(true);
      const t = sim.state.telegraphs.find((x) => x.attackId === attack.id)!;
      expect(t.target).toBe(target.id);
      expect(parryGlyph(sim.state, t)).toBe(slot === SEREN);
      h.frame([]);
      expect(h.entities.drawn5e.parryGlyphs, `slot ${slot}`).toBe(glyphs);
    }
  });

  it('the heavy pip on the Hollow Champion’s bar only with Seren in the party', () => {
    for (const [party, pips] of [
      [WITH_SEREN, 1],
      [undefined, 0],
    ] as const) {
      const sim = sandbox(party ? { party: [...party] } : {});
      const h = harness(sim);
      h.run(1, [spawn('mirror_champion', 0, -6)]);
      h.run(60);
      const champ = enemiesOf(sim).find((e) => e.enemy!.defId === 'mirror_champion')!;
      expect(heavyPip(sim.state, champ, rosterHeavyShown(sim.state))).toBe(pips === 1);
      h.frame([]);
      expect(h.entities.drawn5e.heavyPips, String(party)).toBe(pips);
    }
  });
});

describe('Seren’s moments', () => {
  it('a parry: a white-steel flash, PARRIED; her counter a beat later in her violet', () => {
    const { sim, of, h } = setup();
    const seren = of(SEREN);
    h.run(1, [spawn('hollow_chorister', seren.x, seren.z - 2)]);
    h.run(30);
    dueled(seren);
    const foe = enemiesOf(sim)[0]!;
    h.frame([
      { type: 'parried', tick: sim.state.tick, hero: seren.id, attacker: foe.id, negated: 90 },
      {
        type: 'parryCountered',
        tick: sim.state.tick,
        hero: seren.id,
        target: foe.id,
        amount: 180,
      },
    ]);
    expect(h.overlay.callouts.map((c) => c.text)).toContain(PARRIED_TEXT);
    expect(h.drewIn(SEREN_HEX.flash)).toBe(true);
    expect(h.feedback.seren.fired5e.parries).toBe(1);
    expect(h.feedback.seren.fired5e.counters).toBe(1);
    // A beat later, the counter: her violet.
    for (let i = 0; i < 10; i++) h.frame([]);
    expect(h.drewIn(SEREN_HEX.violet)).toBe(true);
    // It is Seren's, never Riposte Bash's (BondsView plays nothing).
    expect(h.bonds.fired.riposte_bash).toBe(0);
  });

  it('her counter’s and kill shot’s numbers wear the Weaver’s gold chip (your Ward did it)', () => {
    const { sim, of, h } = setup();
    const seren = of(SEREN);
    h.run(1, [
      spawn('hollow_chorister', seren.x, seren.z - 2),
      spawn('hollow_chorister', seren.x + 2, seren.z - 2),
    ]);
    h.run(30);
    dueled(seren);
    const [foe, other] = enemiesOf(sim);
    const hit = (target: number, amount: number, amplified = 0): SimEvent => ({
      type: 'damageTaken',
      tick: sim.state.tick,
      target,
      source: seren.id,
      amount,
      absorbed: 0,
      amplified,
      aura: 0,
      radiance: 0,
      eclipse: 0,
      crit: false,
      telegraph: null,
      hit: 'hit',
    });
    const countered = (target: number, amount: number): SimEvent => ({
      type: 'parryCountered',
      tick: sim.state.tick,
      hero: seren.id,
      target,
      amount,
    });
    const last = () => h.overlay.chips[h.overlay.chips.length - 1];
    // A plain swing of hers: no chip.
    h.frame([hit(foe!.id, 60)]);
    expect(last()).toBeNull();
    for (let i = 0; i < 60; i++) h.frame([]);
    // The counter: the whole hit in gold (a part Empowered stays counted once).
    h.frame([hit(foe!.id, 180, 30), countered(foe!.id, 180)]);
    expect(last()).toBe('+180');
    for (let i = 0; i < 60; i++) h.frame([]);
    // Only on the counter's own target.
    h.frame([hit(other!.id, 50), countered(foe!.id, 180)]);
    expect(last()).toBeNull();
    for (let i = 0; i < 60; i++) h.frame([]);
    // A kill shot taken: gold; one lost draws nothing.
    h.frame([
      hit(other!.id, 400),
      {
        type: 'killShot',
        tick: sim.state.tick,
        hero: seren.id,
        target: other!.id,
        executed: false,
        amount: 400,
      },
    ]);
    expect(last()).toBe('+400');
    for (let i = 0; i < 60; i++) h.frame([]);
    // Blade Waltz's counters are hers, not your Ward's: no chip.
    seren.hero!.soloId = 'blade_waltz';
    seren.hero!.soloActive = 3;
    h.frame([hit(foe!.id, 120), countered(foe!.id, 120)]);
    expect(last()).toBeNull();
  });

  it('the gold chip is the counter’s own blow: matched by tick, and Blade Waltz read at the event', () => {
    const { sim, of, h } = setup();
    const seren = of(SEREN);
    h.run(1, [spawn('hollow_chorister', seren.x, seren.z - 2)]);
    h.run(30);
    dueled(seren);
    const foe = enemiesOf(sim)[0]!;
    const T = sim.state.tick;
    const hit = (tick: number, amount: number, amplified = 0): SimEvent => ({
      type: 'damageTaken',
      tick,
      target: foe.id,
      source: seren.id,
      amount,
      absorbed: 0,
      amplified,
      aura: 0,
      radiance: 0,
      eclipse: 0,
      crit: false,
      telegraph: null,
      hit: 'hit',
    });
    const countered = (tick: number, amount: number): SimEvent => ({
      type: 'parryCountered',
      tick,
      hero: seren.id,
      target: foe.id,
      amount,
    });
    const last = () => h.overlay.chips[h.overlay.chips.length - 1];
    const rest = () => {
      for (let i = 0; i < 60; i++) h.frame([]);
    };
    // A frame of two ticks: her plain swing the tick before joins the number, never the chip.
    h.frame([hit(T - 1, 60), hit(T, 180, 30), countered(T, 180)]);
    expect(last()).toBe('+180');
    rest();
    // Her swing in the counter's own tick, before its blow or after its event: still only +180.
    h.frame([hit(T, 60), hit(T, 180, 30), countered(T, 180)]);
    expect(last()).toBe('+180');
    rest();
    h.frame([hit(T, 180, 30), countered(T, 180), hit(T, 60)]);
    expect(last()).toBe('+180');
    rest();
    // A kill shot the same: only its own blow.
    h.frame([
      hit(T - 1, 60),
      hit(T, 400),
      {
        type: 'killShot',
        tick: T,
        hero: seren.id,
        target: foe.id,
        executed: false,
        amount: 400,
      },
    ]);
    expect(last()).toBe('+400');
    rest();
    // Blade Waltz ended later in the batch: the counter was the waltz's, so no chip.
    seren.hero!.soloId = 'blade_waltz';
    seren.hero!.soloActive = 0;
    h.frame([
      hit(T - 1, 120),
      countered(T - 1, 120),
      { type: 'soloEnded', tick: T, hero: seren.id },
    ]);
    expect(last()).toBeNull();
    rest();
    // Blade Waltz began after the counter in the batch: the counter was your Ward's.
    seren.hero!.soloActive = 3;
    h.frame([
      hit(T - 1, 120),
      countered(T - 1, 120),
      {
        type: 'soloStarted',
        tick: T,
        hero: seren.id,
        solo: 'blade_waltz',
        cued: false,
        duration: 3,
      },
    ]);
    expect(last()).toBe('+120');
  });

  it('a kill shot: EXECUTED or KILL SHOT, a short hit-stop; a lost one draws nothing', () => {
    const { sim, of, h } = setup();
    const seren = of(SEREN);
    h.run(1, [spawn('hollow_chorister', seren.x, seren.z - 6)]);
    h.run(30);
    const foe = enemiesOf(sim)[0]!;
    const shot = (executed: boolean, lost?: 'disabled'): SimEvent => ({
      type: 'killShot',
      tick: sim.state.tick,
      hero: seren.id,
      target: foe.id,
      executed,
      amount: 360,
      ...(lost ? { lost } : {}),
    });
    h.frame([shot(true)]);
    expect(h.overlay.callouts.map((c) => c.text)).toContain(EXECUTED_TEXT);
    expect(h.feedback.seren.hitStop(1 / 60)).toBeLessThan(1);
    // It holds for its 0.08 s, then lets go.
    for (let t = 0; t < KILL_SHOT_STOP + 0.05; t += 1 / 60) h.feedback.seren.hitStop(1 / 60);
    expect(h.feedback.seren.hitStop(1 / 60)).toBe(1);
    h.frame([shot(false)]);
    expect(h.overlay.callouts.map((c) => c.text)).toContain(KILL_SHOT_TEXT);
    const before = h.overlay.callouts.length;
    h.frame([shot(false, 'disabled')]);
    expect(h.overlay.callouts.length).toBe(before);
    expect(h.feedback.seren.fired5e).toMatchObject({ killShots: 2, executed: 1, killShotsLost: 1 });
  });

  it('Lunge dashes (a streak, the travel drawn); Feint holds a thin dashed taunt line', () => {
    const { sim, of, h } = setup();
    const seren = of(SEREN);
    h.run(1, [spawn('hollow_chorister', seren.x, seren.z - 7)]);
    h.run(30);
    const foe = enemiesOf(sim)[0]!;
    const fired = (visual: 'lunge' | 'feint'): SimEvent => ({
      type: 'attackFired',
      tick: sim.state.tick,
      source: seren.id,
      target: foe.id,
      visual,
      fromX: seren.x,
      fromZ: seren.z + 3,
      toX: seren.x,
      toZ: seren.z,
      travel: 0,
    });
    h.frame([fired('lunge')]);
    expect(h.entities.recs.get(seren.id)!.travel).toBe(1);
    expect(h.feedback.seren.fired5e.lunges).toBe(1);
    h.frame([fired('feint')]);
    h.frame([]);
    expect(h.feedback.seren.drawn5e.tauntLines).toBe(1);
    expect(h.entities.drawn5e.afterimages).toBe(1);
  });
});

describe('every other party is drawn as before', () => {
  it('the default party and Brann’s draw none of Seren’s cues and play none of her moments', () => {
    for (const party of [undefined, ['kael', 'brann', 'vexis']]) {
      const sim = createSim({ seed: 7, encounter: 'first_light', ...(party ? { party } : {}) });
      const h = harness(sim);
      let any = 0;
      for (let i = 0; i < 900; i++) {
        h.tick();
        for (const n of Object.values(h.entities.drawn5e)) any += n;
      }
      expect(any, String(party)).toBe(0);
      expect(h.feedback.seren.live).toBe(false);
      expect(Object.values(h.feedback.seren.fired5e).every((n) => n === 0)).toBe(true);
      expect(h.feedback.seren.hitStop(1 / 60)).toBe(1);
    }
  });
});
