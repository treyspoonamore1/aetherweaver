import { useEffect, useRef, useState, type ReactNode } from 'react';
import { COLOR_VISIONS, type ColorVision } from '../../app/colorVision';
import { CONTENT, arenaDef, heroDef } from '../../content';
import { CHORD_PRESETS } from '../../meta/run';
import {
  FixedStepper,
  createSim,
  type CallAnswer,
  type ChordConfig,
  type Command,
  type EntityId,
  type PartySlot,
  type Sim,
  type SimEvent,
  type WorldState,
} from '../../sim';
import { CameraRig } from '../camera';
import { CombatView } from '../combatView';
import { Stage, type QualityTier } from '../stage';
import type { FrameInfo } from '../types';

/**
 * VFX lab (`?lab=vfx`): a Stage + CameraRig + the real combat view over a real debug sim,
 * with buttons to stage every juice-table item, plus synthetic event injection so one-off
 * moments (Perfect Ward, Save…) can be reviewed in isolation. `window.__VFX__` exposes the
 * same controls to screenshot scripts.
 */

type Settings = FrameInfo['settings'];

interface LabApi {
  queue(command: Command): void;
  inject(events: SimEvent[]): void;
  state(): WorldState;
  info(): { calls: number; triangles: number; particles: number; fps: number };
  preset(name: string): void;
  setTheme(arena: string): void;
  setHymn(on: boolean): void;
  grammar(on: boolean): void;
  setQuality(q: QualityTier): void;
  setPaused(paused: boolean): void;
  /** Slow-mo for sim and FX alike (1 = normal). */
  setSlow(k: number): void;
  /** Freeze the real-time loop and render `frames` frames of `ms` each (deterministic shots). */
  manual(frames: number, ms: number): void;
  resume(): void;
  heroId(slot: number): EntityId;
  debug(): Record<string, number>;
  /** Phase 2 */
  setLoadout(name: string): void;
  setSettings(s: Partial<Settings>): void;
  stageCall(slot: number, answered?: boolean): void;
  answerCall(slot: number): void;
  missCall(slot: number): void;
  flourish(slot: number): void;
  stageHold(slot: number): void;
  releaseHold(slot: number, saved: boolean): void;
  save(slot: number): void;
  chorus(slot: number): void;
  plant(dx: number, dz: number): void;
  heroPos(slot: number): { x: number; z: number };
  zoom(wheelDeltaY: number): void;
  /** Phase 3 */
  loadouts(): string[];
  /** Real `{t:'thread', slot}`: the beam song pours into that hero. */
  thread(slot: number): void;
  /** Real sim: thread each hero in turn, `every` sim seconds apart. */
  cycleBeam(every: number): void;
  /** Synthetic hit from the hero in `slot` on the nearest enemy, split into the two chips. */
  auraHit(slot: number, amount: number, empower: number, aura: number): void;
  /** Synthetic `healApplied { via: 'aura' }` on a hero. */
  auraHeal(slot: number, amount: number): void;
  /** Real sim: enemies that go for the hero in `slot` (to see the beam's hexes). */
  attackers(slot: number, n: number): void;
  /** Phase 3b */
  relicScenarios(): string[];
  /** Restarts the real sim with that scenario's relics and stages the moment it acts. */
  relicScenario(name: string): void;
  /** Restarts the real sim carrying these relics (ids, as SimConfig.relics). */
  setRelics(ids: string[]): void;
  /** What the RelicView has played so far, and what is on screen now. */
  relicStats(): { fired: Record<string, number>; active: number; prism: number };
}

declare global {
  interface Window {
    __VFX__?: LabApi;
  }
}

const ENCOUNTERS = ['sandbox', 'first_light', 'muted_nave', 'bellwarden', 'hollow_cantor'];

/**
 * Chord loadouts (SimConfig.chords): the six presets straight from meta/run.ts (so the lead's
 * tuning shows up here), plus a few lab-only ones for the cases the presets don't cover.
 * Chord I is the beam song, Chord II the field song.
 */
const LOADOUTS: Record<string, ChordConfig[]> = {
  ...Object.fromEntries(
    CHORD_PRESETS.map((p) => [
      p.name,
      p.chords.map((c) => ({ auras: [...c.auras], ornaments: [...c.ornaments] })),
    ]),
  ),
  // Lab-only.
  'Lullaby beam': [{ auras: ['lullaby', 'fortissimo'] }, { auras: ['sostenuto'] }],
  'Planted echo': [
    { auras: ['sostenuto', 'fortissimo'], ornaments: ['pedal_point'] },
    { auras: ['ostinato'] },
  ],
  'Field song only': [{ auras: [] }, { auras: ['sostenuto', 'fortissimo'] }],
};
const LOADOUT_NAMES = Object.keys(LOADOUTS);
const THEMES = CONTENT.arenas.map((a) => a.id);

/** The relics the lab sim carries (kept across loadout / encounter changes). */
let carried: string[] = [];

interface RelicScenario {
  relics: string[];
  /** What it shows, for the button's tooltip. */
  note: string;
  stage(rt: LabRuntime): void;
}

/**
 * One scenario per relic moment: each restarts the real sim with `relics` and stages the
 * moment with real commands and debug ops (no injected events).
 */
const RELIC_SCENARIOS: Record<string, RelicScenario> = {
  'Silver Thimble': {
    relics: ['silver_thimble'],
    note: 'Thread Kael (needle + stitch), then Lyra once it has recharged (4 s)',
    stage: (rt) => {
      rt.later(0.2, () => rt.thread(0));
      rt.later(4.6, () => rt.thread(1));
    },
  },
  'Lantern of the Lost': {
    relics: ['lantern_of_the_lost'],
    note: 'A Fermata hold on Kael (debug op) runs out unhealed: he goes down, the Lantern lights the others',
    stage: (rt) => {
      rt.later(0.2, () => rt.queue({ t: 'debug', op: { op: 'forceHold', slot: 0 } }));
    },
  },
  "Martyr's Veil": {
    relics: ['martyrs_veil'],
    note: 'Kael is held and Mended to a sliver (debug op), you step back, and three brutes land the blow that would down him',
    stage: (rt) => {
      rt.later(0.2, () => {
        rt.queue({ t: 'debug', op: { op: 'forceHold', slot: 0 } });
        rt.thread(0);
      });
      rt.onEvent(
        (e) => e.type === 'fermataReleased',
        () => {
          rt.thread(2);
          const p = rt.heroPos(0);
          // Step back so the veil has room to run from Kael to you.
          rt.queue({ t: 'debug', op: { op: 'teleportWeaver', x: p.x - 6, z: p.z + 4 } });
          for (const [dx, dz] of [
            [0, -2.2],
            [-1.8, -1.2],
            [1.8, -1.2],
          ] as const)
            rt.queue({
              t: 'debug',
              op: { op: 'spawnEnemy', defId: 'bell_brute', x: p.x + dx, z: p.z + dz },
            });
        },
      );
      // Once the Veil has acted, clear the brutes so the party survives the lab.
      rt.onEvent(
        (e) => e.type === 'relicTriggered' && e.relic === 'martyrs_veil',
        () => rt.later(1.6, () => rt.queue({ t: 'debug', op: { op: 'killEnemies' } })),
      );
    },
  },
  'Cracked Metronome': {
    relics: ['cracked_metronome'],
    note: 'Ward Kael the moment a brute starts its Toll Cleave (far too early): the Metronome makes it Perfect',
    stage: (rt) => {
      rt.later(0.2, () => rt.brute(0));
      rt.onEvent(
        (e) => e.type === 'telegraphStarted' && e.name === 'Toll Cleave',
        () => rt.queue({ t: 'tech', id: 'ward', slot: 0 }),
      );
    },
  },
  'Tuning Fork': {
    relics: ['tuning_fork'],
    note: 'A Perfect Ward on Kael against a Toll Cleave: the Fork charges his Solo',
    stage: (rt) => {
      rt.later(0.2, () => rt.brute(0));
      rt.perfectOn('Toll Cleave', 0);
    },
  },
  'Glass Halo': {
    relics: ['glass_halo'],
    note: 'A Perfect Ward on Kael against an elite brute (choristers on Vexis): the halo heals every hero',
    stage: (rt) => {
      rt.later(0.2, () => {
        rt.attackers(2, 2);
        rt.brute(0, true);
      });
      rt.perfectOn('Toll Cleave', 0);
    },
  },
  "Cantor's Hymnal": {
    relics: ['cantors_hymnal'],
    note: 'The fight opens with 25 Resonance (tick 0)',
    stage: () => {},
  },
  'Prism Loom': {
    relics: ['prism_loom'],
    note: 'Thread Lyra and Rally: Mend reaches whoever stands within 4 m of her',
    stage: (rt) => {
      rt.later(0.2, () => rt.thread(1));
      rt.later(0.3, () => rt.queue({ t: 'directive', kind: 'rally' }));
    },
  },
  'Prism Loom · Empower': {
    relics: ['prism_loom'],
    note: 'The same in Empower (gold), with a small fight',
    stage: (rt) => {
      rt.later(0.2, () => {
        rt.thread(1);
        rt.queue({ t: 'mode' });
        rt.queue({ t: 'directive', kind: 'rally' });
        rt.spawn('hollow_chorister', -2, -6);
        rt.spawn('hollow_chorister', 2, -6);
      });
    },
  },
  'Spindle of Fate': {
    relics: ['spindle_of_fate'],
    note: 'The beam song’s echo at full strength (pick Guardian or Steady under Chords)',
    stage: (rt) => {
      rt.later(0.2, () => rt.thread(1));
    },
  },
  'Heavy Score': {
    relics: ['heavy_score'],
    note: 'Glide twice: the curse refuses it',
    stage: (rt) => {
      rt.later(0.3, () => rt.queue({ t: 'glide', x: 1, z: 0 }));
      rt.later(1.4, () => rt.queue({ t: 'glide', x: -1, z: 0 }));
    },
  },
  'Every relic': {
    relics: CONTENT.relics.map((r) => r.id),
    note: 'All fifteen at once, a Thread on Lyra and a small fight (clutter check)',
    stage: (rt) => {
      rt.later(0.2, () => {
        rt.thread(1);
        rt.queue({ t: 'directive', kind: 'rally' });
      });
      rt.later(1, () => rt.brute(0, true));
      rt.perfectOn('Toll Cleave', 0);
    },
  },
};
const RELIC_SCENARIO_NAMES = Object.keys(RELIC_SCENARIOS);

class LabRuntime {
  sim: Sim;
  readonly stage: Stage;
  readonly rig: CameraRig;
  private view: CombatView;
  private readonly overlay: HTMLDivElement;
  private readonly stepper = new FixedStepper(60, 5);
  private readonly pending: Command[] = [];
  private raf = 0;
  private last = -1;
  private start = -1;
  private aim: { x: number; z: number } | null = null;
  private keys = new Set<string>();
  private moveX = 0;
  private moveZ = 0;
  private hymn = false;
  private readonly scheduled: { at: number; fn: () => void }[] = [];
  private readonly taps: { pred: (e: SimEvent) => boolean; fn: (e: SimEvent) => void }[] = [];
  private frozen = false;
  private clock = 0;
  paused = false;
  timeScale = 1;
  settings: Settings = { screenShake: 1, flashes: 1, damageNumbers: true, colorVision: 'normal' };
  private frames = 0;
  private fpsTimer = 0;
  fps = 0;

  constructor(
    container: HTMLElement,
    private readonly encounter: string,
    private theme: string,
    quality: QualityTier,
    private readonly loadout: string,
    settings: Settings | null,
  ) {
    this.sim = this.createSim();
    if (settings) this.settings = settings;
    this.stage = new Stage(container, quality);
    this.rig = new CameraRig(this.stage.camera);
    this.overlay = document.createElement('div');
    this.overlay.className = 'pointer-events-none absolute inset-0 overflow-hidden';
    container.appendChild(this.overlay);
    this.view = this.createView();
    const w = this.sim.state.entities.get(this.sim.state.weaverId);
    this.rig.snapTo(w?.x ?? 0, w?.z ?? 0);
    this.view.onEvents(this.sim.drainEvents(), this.sim.state);
    this.stage.canvas.addEventListener('pointermove', this.onPointer);
    window.addEventListener('keydown', this.onKey);
    window.addEventListener('keyup', this.onKey);
  }

  private createSim(): Sim {
    return createSim({
      seed: 1234,
      encounter: this.encounter,
      debug: true,
      chords: LOADOUTS[this.loadout] ?? LOADOUTS.Steady,
      relics: carried,
    });
  }

  /** Phase 3b: a fresh real sim carrying `relics` (the view is rebuilt on it). */
  restart(relics: string[]): void {
    carried = [...relics];
    this.pending.length = 0;
    this.scheduled.length = 0;
    this.taps.length = 0;
    this.sim = this.createSim();
    this.view.dispose();
    this.view = this.createView();
    this.view.field.hymnOverride = this.hymn ? this.hymnCircles() : null;
    const w = this.sim.state.entities.get(this.sim.state.weaverId);
    this.rig.snapTo(w?.x ?? 0, w?.z ?? 0);
    this.view.onEvents(this.sim.drainEvents(), this.sim.state);
  }

  relicScenario(name: string): void {
    const s = RELIC_SCENARIOS[name];
    if (!s) return;
    this.restart(s.relics);
    s.stage(this);
  }

  relicStats(): { fired: Record<string, number>; active: number; prism: number } {
    const r = this.view.relics;
    return { fired: { ...r.fired }, active: r.activeCount(), prism: r.prism.count };
  }

  /** Runs `fn` on the first sim event matching `pred` (scenario staging). */
  onEvent(pred: (e: SimEvent) => boolean, fn: (e: SimEvent) => void): void {
    this.taps.push({ pred, fn });
  }

  /**
   * A Bell Brute beside the hero in `slot`, with the Weaver stepped back out of its Toll Cleave
   * (the cone is 5 m long, more for an elite, and one-shots the Weaver), so the Ward is the story.
   */
  brute(slot: number, elite = false): void {
    const p = this.heroPos(slot);
    this.queue({ t: 'debug', op: { op: 'teleportWeaver', x: p.x - 6, z: p.z + 4 } });
    this.queue({
      t: 'debug',
      op: { op: 'spawnEnemy', defId: 'bell_brute', x: p.x + 2.5, z: p.z - 1, elite },
    });
  }

  /** Wards the hero in `slot` inside the Perfect window of the next telegraph named `name`. */
  perfectOn(name: string, slot: number): void {
    this.onEvent(
      (e) => e.type === 'telegraphStarted' && e.name === name,
      (e) => {
        if (e.type !== 'telegraphStarted') return;
        const t = this.sim.state.telegraphs.find((k) => k.id === e.telegraph);
        if (!t) return;
        // Ward whoever it is aimed at (the hero in `slot` unless it picked someone else).
        const aimed = t.target === null ? -1 : this.sim.state.party.indexOf(t.target);
        const ward = (aimed >= 0 ? aimed : slot) as PartySlot;
        const at = t.perfectFrom + 0.05 - this.sim.state.time;
        this.later(Math.max(0, at), () => this.queue({ t: 'tech', id: 'ward', slot: ward }));
      },
    );
  }

  private tap(events: readonly SimEvent[]): void {
    if (this.taps.length === 0) return;
    for (const e of events) {
      for (let i = this.taps.length - 1; i >= 0; i--) {
        const t = this.taps[i]!;
        if (!t.pred(e)) continue;
        this.taps.splice(i, 1);
        t.fn(e);
      }
    }
  }

  private createView(): CombatView {
    return new CombatView(
      {
        stage: this.stage,
        rig: this.rig,
        overlay: this.overlay,
        arena: arenaDef(this.theme),
        quality: this.stage.qualityTier,
      },
      this.sim.state,
    );
  }

  setTheme(theme: string): void {
    this.theme = theme;
    this.view.dispose();
    this.view = this.createView();
    this.view.field.hymnOverride = this.hymn ? this.hymnCircles() : null;
  }

  setQuality(q: QualityTier): void {
    this.stage.setQuality(q);
    this.view.setQuality(q);
  }

  private hymnCircles(): { x: number; z: number; r: number }[] {
    const w = this.sim.state.entities.get(this.sim.state.weaverId);
    const x = w?.x ?? 0;
    const z = w?.z ?? 0;
    return [
      { x: x - 5, z: z - 3, r: 3.6 },
      { x: x + 6, z: z - 4, r: 3.6 },
      { x: x + 0.5, z: z + 5, r: 3.6 },
    ];
  }

  /** Synthetic telegraphs around the Weaver: every shape, both severities, a cast circle. */
  grammar(on: boolean): void {
    if (!on) {
      this.view.telegraphs.preview = null;
      return;
    }
    const s = this.sim.state;
    const w = this.weaverPos();
    const now = s.time;
    const kael = this.heroId(0);
    const lyra = this.heroId(1);
    const vexis = this.heroId(2);
    const enemy = this.nearestEnemy() ?? kael;
    let id = 900000 + Math.floor(now * 10) * 10;
    type T = WorldState['telegraphs'][number];
    const mk = (
      shape: T['shape'],
      severity: 'normal' | 'lethal',
      windup: number,
      answers: T['answers'],
      name: string,
    ): T => ({
      id: id++,
      owner: enemy,
      target: null,
      attackId: 'lab',
      name,
      kind: 'burst',
      shape,
      start: now,
      impact: now + windup,
      perfectFrom: now + windup - 0.35,
      damage: 500,
      pctMaxHp: 0,
      effect: 'damage',
      answers,
      severity,
    });
    this.view.telegraphs.preview = [
      {
        t: mk(
          { kind: 'circle', x: w.x - 7, z: w.z - 5, r: 2.6 },
          'normal',
          3,
          ['scatter', 'reel'],
          'Burst',
        ),
        effect: 'damage',
      },
      {
        t: mk(
          { kind: 'circle', x: w.x - 1, z: w.z - 7, r: 2.6 },
          'lethal',
          3,
          ['ward'],
          'Lethal burst',
        ),
        effect: 'damage',
      },
      {
        t: mk(
          {
            kind: 'cone',
            x: w.x + 4,
            z: w.z - 3,
            r: 4.5,
            dirX: 0.6,
            dirZ: -0.8,
            halfAngleCos: Math.cos(0.9),
          },
          'normal',
          2.4,
          ['ward'],
          'Cleave',
        ),
        effect: 'damage',
      },
      {
        t: mk(
          { kind: 'line', x: w.x - 10, z: w.z + 4, toX: w.x + 9, toZ: w.z + 6, width: 1.4 },
          'lethal',
          3.4,
          ['ward', 'reel', 'move'],
          'Lance',
        ),
        effect: 'damage',
      },
      {
        t: mk(
          { kind: 'donut', x: w.x + 9, z: w.z + 2, innerR: 1.6, outerR: 4.2 },
          'normal',
          3,
          ['stack'],
          'Toll Inward',
        ),
        effect: 'damage',
      },
      {
        t: mk({ kind: 'mark', target: lyra }, 'normal', 4, ['chime', 'ward'], 'Dirge'),
        effect: 'damage',
      },
      {
        t: mk({ kind: 'link', a: kael, b: vexis, r: 6 }, 'normal', 4, ['scatter'], 'Resound'),
        effect: 'damage',
      },
      {
        t: mk(
          { kind: 'circle', x: w.x - 9, z: w.z - 12, r: 3 },
          'normal',
          3,
          ['focus'],
          'Mending Hymn',
        ),
        effect: 'healAllies',
      },
    ];
    // Non-damage casts must carry their effect on the telegraph itself.
    for (const p of this.view.telegraphs.preview) p.t = { ...p.t, effect: p.effect };
  }

  setHymn(on: boolean): void {
    this.hymn = on;
    this.view.field.hymnOverride = on ? this.hymnCircles() : null;
  }

  run(): void {
    if (this.raf === 0) this.raf = requestAnimationFrame(this.frame);
  }

  queue(c: Command): void {
    this.pending.push(c);
  }

  inject(events: SimEvent[]): void {
    this.view.onEvents(events, this.sim.state);
  }

  heroId(slot: number): EntityId {
    return this.sim.state.party[slot] ?? -1;
  }

  heroPos(slot: number): { x: number; z: number } {
    const e = this.sim.state.entities.get(this.heroId(slot));
    return { x: e?.x ?? 0, z: e?.z ?? 0 };
  }

  weaverPos(): { x: number; z: number } {
    const e = this.sim.state.entities.get(this.sim.state.weaverId);
    return { x: e?.x ?? 0, z: e?.z ?? 0 };
  }

  nearestEnemy(): EntityId | null {
    const w = this.weaverPos();
    let best: EntityId | null = null;
    let bd = Infinity;
    for (const e of this.sim.state.entities.list()) {
      if (e.kind !== 'enemy' || e.health?.dead) continue;
      const d = Math.hypot(e.x - w.x, e.z - w.z);
      if (d < bd) {
        bd = d;
        best = e.id;
      }
    }
    return best;
  }

  spawn(defId: string, dx: number, dz: number, elite = false): void {
    const w = this.weaverPos();
    this.queue({ t: 'debug', op: { op: 'spawnEnemy', defId, x: w.x + dx, z: w.z + dz, elite } });
  }

  preset(name: string): void {
    const q = (c: Command) => this.queue(c);
    switch (name) {
      case 'gallery':
        q({ t: 'debug', op: { op: 'killEnemies' } });
        this.spawn('bell_brute', -3, -4);
        this.spawn('glass_lancer', 9, -10);
        this.spawn('lamenter', -8, -10);
        this.spawn('cantor_acolyte', 3, -12);
        this.spawn('mute', 6, -3);
        break;
      case 'busy': {
        q({ t: 'debug', op: { op: 'killEnemies' } });
        const ring: [string, number][] = [
          ['hollow_chorister', 12],
          ['bell_brute', 3],
          ['lamenter', 3],
          ['glass_lancer', 3],
          ['cantor_acolyte', 2],
          ['mute', 1],
        ];
        let i = 0;
        for (const [id, n] of ring) {
          for (let k = 0; k < n; k++, i++) {
            const a = (i / 24) * Math.PI * 2;
            const r = 6 + (i % 3) * 2.5;
            this.spawn(
              id,
              Math.cos(a) * r,
              Math.sin(a) * r - 2,
              k === 0 && id !== 'hollow_chorister',
            );
          }
        }
        this.spawn('the_bellwarden', 0, -12);
        break;
      }
      case 'cantor':
        q({ t: 'debug', op: { op: 'killEnemies' } });
        this.spawn('the_hollow_cantor', 0, -9);
        this.spawn('hollow_chorister', -4, -6);
        this.spawn('hollow_chorister', 4, -6);
        break;
      case 'bellwarden':
        q({ t: 'debug', op: { op: 'killEnemies' } });
        this.spawn('the_bellwarden', 0, -7);
        break;
      default:
        break;
    }
  }

  // ── Phase 2 staging ────────────────────────────────────────────────────────────────

  private callDef(slot: number): { answer: CallAnswer; time: number; flourish: string } {
    const e = this.sim.state.entities.get(this.heroId(slot));
    const def = e?.hero ? heroDef(e.hero.defId) : null;
    return {
      answer: def?.call?.answer ?? 'ward',
      time: def?.call?.answerTime ?? 2.5,
      flourish: def?.call?.flourish.name ?? 'Flourish',
    };
  }

  // ── Phase 3: the beam song and the field song ──────────────────────────────────────

  thread(slot: number): void {
    this.queue({ t: 'thread', slot: slot as PartySlot });
  }

  cycleBeam(every: number): void {
    for (let i = 0; i < 3; i++) this.later(every * i, () => this.thread(i));
  }

  auraHit(slot: number, amount: number, empower: number, aura: number): void {
    const target = this.nearestEnemy();
    if (target === null) return;
    this.inject([
      {
        type: 'damageTaken',
        tick: this.sim.tick,
        target,
        source: this.heroId(slot),
        amount,
        absorbed: 0,
        amplified: empower + aura,
        aura,
        radiance: 0,
        crit: false,
        telegraph: null,
        hit: 'hit',
      },
    ]);
  }

  auraHeal(slot: number, amount: number): void {
    this.inject([
      {
        type: 'healApplied',
        tick: this.sim.tick,
        target: this.heroId(slot),
        source: this.sim.state.weaverId,
        amount,
        overheal: 0,
        via: 'aura',
      },
    ]);
  }

  attackers(slot: number, n: number): void {
    const p = this.heroPos(slot);
    for (let i = 0; i < n; i++) {
      const a = (i / Math.max(1, n)) * Math.PI * 2;
      this.queue({
        t: 'debug',
        op: {
          op: 'spawnEnemy',
          defId: 'hollow_chorister',
          x: p.x + Math.cos(a) * 2.2,
          z: p.z + Math.sin(a) * 2.2,
        },
      });
    }
  }

  /** Lab-only synthetic call (the real one comes from `{op:'forceCall'}` once the sim has it). */
  stageCall(slot: number, answered = false): void {
    const id = this.heroId(slot);
    const now = this.sim.state.time;
    const d = this.callDef(slot);
    const calls = this.view.calls;
    if (!calls.preview) calls.preview = new Map();
    calls.preview.set(id, { answer: d.answer, start: now, end: now + d.time, answered });
    this.inject([
      {
        type: 'callStarted',
        tick: this.sim.tick,
        hero: id,
        answer: d.answer,
        ability: '',
        flourish: d.flourish,
        until: now + d.time,
        line: '',
      },
    ]);
  }

  answerCall(slot: number): void {
    const id = this.heroId(slot);
    const d = this.callDef(slot);
    const p = this.view.calls.preview?.get(id);
    if (p) p.answered = true;
    this.inject([
      {
        type: 'callAnswered',
        tick: this.sim.tick,
        hero: id,
        answer: d.answer,
        flourish: d.flourish,
        after: 1,
      },
    ]);
    this.later(0.25, () => {
      this.view.calls.preview?.delete(id);
      this.flourish(slot);
    });
  }

  missCall(slot: number): void {
    const id = this.heroId(slot);
    this.view.calls.preview?.delete(id);
    this.inject([{ type: 'callEnded', tick: this.sim.tick, hero: id, reason: 'missed' }]);
  }

  flourish(slot: number): void {
    const id = this.heroId(slot);
    const e = this.sim.state.entities.get(id);
    if (!e?.hero) return;
    const def = heroDef(e.hero.defId);
    const ability = def.call ? def.abilities[def.call.ability] : undefined;
    const enemyId = this.nearestEnemy();
    const en = enemyId === null ? undefined : this.sim.state.entities.get(enemyId);
    let x = e.x;
    let z = e.z;
    let radius: number;
    if (ability?.id === 'challenge') radius = (ability.radius || 7) * 1.5;
    else if (ability?.id === 'piercingShot') {
      x = en ? en.x : e.x;
      z = en ? en.z : e.z - 10;
      radius = (ability.radius || 0.7) * 1.6;
    } else {
      x = en ? en.x : e.x;
      z = en ? en.z : e.z - 6;
      radius = (ability?.radius || 3.5) * 1.5;
    }
    this.inject([
      {
        type: 'flourish',
        tick: this.sim.tick,
        hero: id,
        name: def.call?.flourish.name ?? 'Flourish',
        x,
        z,
        radius,
      },
    ]);
  }

  /** Lab-only synthetic Fermata hold (the real one comes from `{op:'forceHold'}`). */
  stageHold(slot: number): void {
    const id = this.heroId(slot);
    const until = this.sim.state.time + 1.5;
    const f = this.view.fermata;
    if (!f.preview) f.preview = new Map();
    f.preview.set(id, until);
    this.inject([
      { type: 'fermataHold', tick: this.sim.tick, hero: id, until, attack: 'Lab', damage: 900 },
    ]);
  }

  releaseHold(slot: number, saved: boolean): void {
    const id = this.heroId(slot);
    this.view.fermata.preview?.delete(id);
    const events: SimEvent[] = [{ type: 'fermataReleased', tick: this.sim.tick, hero: id, saved }];
    if (saved)
      events.push({
        type: 'save',
        tick: this.sim.tick,
        target: id,
        cause: 'fermata',
        counterfactualDamage: 900,
        attack: 'Lab',
      });
    if (!saved) events.push({ type: 'allyDowned', tick: this.sim.tick, hero: id });
    this.inject(events);
  }

  save(slot: number): void {
    this.inject([
      {
        type: 'save',
        tick: this.sim.tick,
        target: this.heroId(slot),
        cause: 'ward',
        counterfactualDamage: 1140,
        attack: 'Requiem',
      },
    ]);
  }

  chorus(slot: number): void {
    this.inject([
      {
        type: 'chorusPulse',
        tick: this.sim.tick,
        hero: this.heroId(slot),
        auras: this.sim.state.field.auras.length,
        reached: 3,
      },
    ]);
  }

  plant(dx: number, dz: number): void {
    const w = this.weaverPos();
    this.queue({ t: 'plant', point: { x: w.x + dx, z: w.z + dz } });
  }

  plantAtCursor(): void {
    if (this.aim) this.queue({ t: 'plant', point: { x: this.aim.x, z: this.aim.z } });
  }

  /** Runs `fn` after `delay` sim seconds (SwiftShader runs the sim slower than real time). */
  later(delay: number, fn: () => void): void {
    this.scheduled.push({ at: this.sim.state.time + delay, fn });
  }

  private runScheduled(): void {
    const now = this.sim.state.time;
    for (let i = this.scheduled.length - 1; i >= 0; i--) {
      const job = this.scheduled[i]!;
      if (job.at > now) continue;
      this.scheduled.splice(i, 1);
      job.fn();
    }
  }

  private onPointer = (ev: PointerEvent): void => {
    const p = { x: 0, z: 0 };
    if (this.stage.pickGround(ev.clientX, ev.clientY, p)) {
      this.aim = p;
      this.queue({ t: 'aim', x: p.x, z: p.z });
    }
  };

  private onKey = (ev: KeyboardEvent): void => {
    if (ev.target instanceof HTMLInputElement || ev.target instanceof HTMLSelectElement) return;
    const down = ev.type === 'keydown';
    if (down) this.keys.add(ev.code);
    else this.keys.delete(ev.code);
    let x = 0;
    let z = 0;
    if (this.keys.has('KeyW')) z -= 1;
    if (this.keys.has('KeyS')) z += 1;
    if (this.keys.has('KeyA')) x -= 1;
    if (this.keys.has('KeyD')) x += 1;
    const m = Math.hypot(x, z) || 1;
    x /= m;
    z /= m;
    if (x !== this.moveX || z !== this.moveZ) {
      this.moveX = x;
      this.moveZ = z;
      this.queue({ t: 'move', x, z });
    }
    if (down && ev.code === 'Space') {
      this.queue({ t: 'glide', x: x || 0, z: z || -1 });
    }
  };

  private hovered(kind: 'hero' | 'enemy'): EntityId | null {
    if (!this.aim) return null;
    for (const e of this.sim.state.entities.list()) {
      if (e.kind !== kind) continue;
      if (Math.hypot(e.x - this.aim.x, e.z - this.aim.z) < e.radius + 0.6) return e.id;
    }
    return null;
  }

  private frame = (now: number): void => {
    this.raf = requestAnimationFrame(this.frame);
    const elapsed = this.last < 0 ? 0 : Math.min(250, now - this.last);
    this.last = now;
    if (this.frozen) return;
    this.clock += elapsed;
    this.advance(elapsed);
  };

  /**
   * Stops the real-time loop and renders `frames` frames of `ms` each instead, so screenshot
   * scripts get the same moment every time (SwiftShader runs a few frames a second).
   */
  manual(frames: number, ms: number): void {
    this.frozen = true;
    for (let i = 0; i < frames; i++) {
      this.clock += ms;
      this.advance(ms);
    }
  }

  resume(): void {
    this.frozen = false;
  }

  private advance(elapsed: number): void {
    const now = this.clock;
    if (this.start < 0) this.start = now;
    if (!this.paused) {
      const steps = this.stepper.advance(elapsed * this.timeScale);
      if (steps > 0) {
        const cmds = this.pending.splice(0);
        for (let i = 0; i < steps; i++) this.sim.step(i === 0 ? cmds : []);
        const events = this.sim.drainEvents();
        this.view.onEvents(events, this.sim.state);
        this.tap(events);
        this.runScheduled();
      }
    }
    const state = this.sim.state;
    const alpha = this.stepper.alpha;
    const w = state.entities.get(state.weaverId);
    this.rig.shakeScale = this.settings.screenShake;
    if (w) {
      const wx = w.px + (w.x - w.px) * alpha;
      const wz = w.pz + (w.z - w.pz) * alpha;
      this.rig.update(wx, wz, this.aim?.x ?? wx, this.aim?.z ?? wz, elapsed / 1000);
    }
    // Slow-mo applies to the FX clock too, so transient moments can be reviewed (and shot).
    this.view.sync(state, {
      realDt: (elapsed / 1000) * this.timeScale,
      time: (now - this.start) / 1000,
      alpha,
      hoveredHero: this.hovered('hero'),
      hoveredEnemy: this.hovered('enemy'),
      aim: this.aim,
      settings: this.settings,
    });
    this.stage.render();
    this.frames++;
    this.fpsTimer += elapsed;
    if (this.fpsTimer > 500) {
      this.fps = (this.frames * 1000) / this.fpsTimer;
      this.frames = 0;
      this.fpsTimer = 0;
    }
  }

  info(): { calls: number; triangles: number; particles: number; fps: number } {
    const i = this.stage.info();
    return {
      ...i,
      particles: this.view.kit.particles.alive + this.view.kit.smoke.alive,
      fps: this.fps,
    };
  }

  debug(): Record<string, number> {
    const k = this.view.kit;
    return {
      rings: k.rings.size,
      beams: k.beams.size,
      sprites: k.sprites.size,
      shells: k.shells.size,
      telegraphs: k.telegraphs.size,
      marks: k.marks.size,
      bars: k.bars.size,
      geometries: this.stage.renderer.info.memory.geometries,
      textures: this.stage.renderer.info.memory.textures,
      programs: this.stage.renderer.info.programs?.length ?? 0,
    };
  }

  dispose(): void {
    cancelAnimationFrame(this.raf);
    this.stage.canvas.removeEventListener('pointermove', this.onPointer);
    window.removeEventListener('keydown', this.onKey);
    window.removeEventListener('keyup', this.onKey);
    this.view.dispose();
    this.stage.dispose();
    this.overlay.remove();
  }
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-b border-ink-700 px-3 py-2">
      <h2 className="mb-1.5 font-display text-[11px] tracking-[0.14em] text-gold-300 uppercase">
        {title}
      </h2>
      <div className="flex flex-wrap gap-1">{children}</div>
    </section>
  );
}

function Btn({
  onClick,
  children,
  title,
}: {
  onClick: () => void;
  children: ReactNode;
  title?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="rounded border border-ink-600 bg-ink-800 px-2 py-0.5 text-[11px] text-text hover:border-gold-400 hover:bg-ink-700"
    >
      {children}
    </button>
  );
}

export function VfxLab() {
  const hostRef = useRef<HTMLDivElement>(null);
  const statsRef = useRef<HTMLPreElement>(null);
  const rtRef = useRef<LabRuntime | null>(null);
  const [encounter, setEncounter] = useState('sandbox');
  const [theme, setTheme] = useState('reliquary_hall');
  const [quality, setQuality] = useState<QualityTier>('high');
  const [elite, setElite] = useState(false);
  const [slot, setSlot] = useState<PartySlot>(0);
  const [hymn, setHymn] = useState(false);
  const [loadout, setLoadout] = useState('Guardian');
  const [vision, setVision] = useState<ColorVision>('normal');
  const [flashes, setFlashes] = useState(1);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const rt = new LabRuntime(
      host,
      encounter,
      theme,
      quality,
      loadout,
      rtRef.current?.settings ?? null,
    );
    rtRef.current = rt;
    rt.run();
    window.__VFX__ = {
      queue: (c) => rt.queue(c),
      inject: (e) => rt.inject(e),
      state: () => rt.sim.state,
      info: () => rt.info(),
      preset: (n) => rt.preset(n),
      setTheme: (t) => rt.setTheme(t),
      setHymn: (on) => rt.setHymn(on),
      grammar: (on) => rt.grammar(on),
      setQuality: (q) => rt.setQuality(q),
      setPaused: (p) => {
        rt.paused = p;
      },
      setSlow: (k) => {
        rt.timeScale = k;
      },
      manual: (n, ms) => rt.manual(n, ms),
      resume: () => rt.resume(),
      heroId: (s) => rt.heroId(s),
      debug: () => rt.debug(),
      setLoadout: (name) => setLoadout(name),
      setSettings: (p) => {
        rt.settings = { ...rt.settings, ...p };
        if (p.colorVision) setVision(p.colorVision);
        if (p.flashes !== undefined) setFlashes(p.flashes);
      },
      stageCall: (s, a) => rt.stageCall(s, a),
      answerCall: (s) => rt.answerCall(s),
      missCall: (s) => rt.missCall(s),
      flourish: (s) => rt.flourish(s),
      stageHold: (s) => rt.stageHold(s),
      releaseHold: (s, saved) => rt.releaseHold(s, saved),
      save: (s) => rt.save(s),
      chorus: (s) => rt.chorus(s),
      plant: (dx, dz) => rt.plant(dx, dz),
      heroPos: (s) => rt.heroPos(s),
      zoom: (dy) => rt.rig.zoomBy(dy),
      loadouts: () => LOADOUT_NAMES,
      thread: (s) => rt.thread(s),
      cycleBeam: (every) => rt.cycleBeam(every),
      auraHit: (s, amount, empower, aura) => rt.auraHit(s, amount, empower, aura),
      auraHeal: (s, amount) => rt.auraHeal(s, amount),
      attackers: (s, n) => rt.attackers(s, n),
      relicScenarios: () => RELIC_SCENARIO_NAMES,
      relicScenario: (name) => rt.relicScenario(name),
      setRelics: (ids) => rt.restart(ids),
      relicStats: () => rt.relicStats(),
    };
    const timer = window.setInterval(() => {
      const i = rt.info();
      if (statsRef.current) {
        statsRef.current.textContent = `fps ${i.fps.toFixed(1)}  calls ${i.calls}  tris ${(i.triangles / 1000).toFixed(1)}k\nparticles ${i.particles}  entities ${rt.sim.state.entities.count}  tick ${rt.sim.tick}\nrelics ${rt.sim.state.relics.ids.length ? rt.sim.state.relics.ids.join(', ') : 'none'}`;
      }
    }, 250);
    return () => {
      window.clearInterval(timer);
      delete window.__VFX__;
      rt.dispose();
      rtRef.current = null;
    };
    // The theme and quality are applied live below; the encounter and loadout recreate the sim.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [encounter, loadout]);

  useEffect(() => {
    rtRef.current?.setTheme(theme);
  }, [theme]);
  useEffect(() => {
    rtRef.current?.setQuality(quality);
  }, [quality]);
  useEffect(() => {
    rtRef.current?.setHymn(hymn);
  }, [hymn]);
  useEffect(() => {
    const r = rtRef.current;
    if (r) r.settings = { ...r.settings, colorVision: vision, flashes };
  }, [vision, flashes]);

  const rt = () => rtRef.current;
  const q = (c: Command) => rt()?.queue(c);
  const tick = () => rt()?.sim.tick ?? 0;
  const hero = () => rt()?.heroId(slot) ?? -1;
  const inject = (e: SimEvent[]) => rt()?.inject(e);

  return (
    <main className="fixed inset-0 flex bg-ink-950 text-text">
      <div ref={hostRef} className="relative flex-1" data-testid="vfx-host" />
      <aside
        className="w-72 shrink-0 overflow-y-auto border-l border-ink-700 bg-ink-900/95 text-xs"
        data-testid="vfx-panel"
      >
        <header className="border-b border-ink-700 px-3 py-2">
          <h1 className="font-display text-sm tracking-[0.18em] text-gold-300">VFX LAB</h1>
          <pre ref={statsRef} className="mt-1 font-mono text-[10px] leading-tight text-muted" />
          <p className="mt-1 text-[10px] text-muted">WASD move · Space glide · mouse aims</p>
        </header>
        <Group title="Scene">
          <label className="flex w-full items-center justify-between gap-2">
            Encounter
            <select
              className="bg-ink-800"
              value={encounter}
              onChange={(e) => setEncounter(e.target.value)}
            >
              {ENCOUNTERS.map((id) => (
                <option key={id}>{id}</option>
              ))}
            </select>
          </label>
          <label className="flex w-full items-center justify-between gap-2">
            Theme
            <select className="bg-ink-800" value={theme} onChange={(e) => setTheme(e.target.value)}>
              {THEMES.map((id) => (
                <option key={id}>{id}</option>
              ))}
            </select>
          </label>
          <label className="flex w-full items-center justify-between gap-2">
            Quality
            <select
              className="bg-ink-800"
              value={quality}
              onChange={(e) => setQuality(e.target.value as QualityTier)}
            >
              <option>low</option>
              <option>medium</option>
              <option>high</option>
            </select>
          </label>
          <label className="flex w-full items-center justify-between gap-2">
            Chords
            <select
              className="bg-ink-800"
              value={loadout}
              onChange={(e) => setLoadout(e.target.value)}
            >
              {LOADOUT_NAMES.map((id) => (
                <option key={id}>{id}</option>
              ))}
            </select>
          </label>
          <label className="flex w-full items-center justify-between gap-2">
            Colour vision
            <select
              className="bg-ink-800"
              value={vision}
              onChange={(e) => setVision(e.target.value as ColorVision)}
            >
              {COLOR_VISIONS.map((id) => (
                <option key={id}>{id}</option>
              ))}
            </select>
          </label>
          <label className="flex w-full items-center justify-between gap-2">
            Flashes {Math.round(flashes * 100)}%
            <input
              type="range"
              min={0}
              max={1}
              step={0.25}
              value={flashes}
              onChange={(e) => setFlashes(Number(e.target.value))}
            />
          </label>
          <Btn onClick={() => rt() && (rt()!.paused = !rt()!.paused)}>Pause</Btn>
          <Btn onClick={() => rt() && (rt()!.timeScale = rt()!.timeScale === 1 ? 0.25 : 1)}>
            Slow ×¼
          </Btn>
          <Btn
            onClick={() =>
              rt() &&
              (rt()!.settings = { ...rt()!.settings, damageNumbers: !rt()!.settings.damageNumbers })
            }
          >
            Numbers
          </Btn>
        </Group>
        <Group title="Presets">
          <Btn onClick={() => rt()?.preset('gallery')}>Telegraph gallery</Btn>
          <Btn onClick={() => rt()?.preset('busy')}>Busy fight (25)</Btn>
          <Btn onClick={() => rt()?.preset('cantor')}>Boss: Cantor</Btn>
          <Btn onClick={() => rt()?.preset('bellwarden')}>Boss: Bellwarden</Btn>
          <Btn onClick={() => q({ t: 'debug', op: { op: 'killEnemies' } })}>Kill all</Btn>
          <Btn onClick={() => q({ t: 'debug', op: { op: 'healParty' } })}>Heal party</Btn>
          <Btn onClick={() => setHymn(!hymn)}>{hymn ? 'Hide' : 'Show'} hymn circles</Btn>
          <Btn
            onClick={() => rt()?.grammar(true)}
            title="Synthetic telegraphs: every shape, both severities (click again to restart)"
          >
            Telegraph grammar
          </Btn>
          <Btn onClick={() => rt()?.grammar(false)}>Clear grammar</Btn>
        </Group>
        <Group title="Spawn">
          <label className="flex w-full items-center gap-1">
            <input type="checkbox" checked={elite} onChange={(e) => setElite(e.target.checked)} />{' '}
            elite
          </label>
          {CONTENT.enemies.map((d) => (
            <Btn
              key={d.id}
              onClick={() =>
                rt()?.spawn(d.id, (Math.random() - 0.5) * 10, -7 - Math.random() * 4, elite)
              }
            >
              {d.name.replace('The ', '')}
            </Btn>
          ))}
        </Group>
        <Group title="Weaver">
          <label className="flex w-full items-center justify-between">
            Target slot
            <select
              className="bg-ink-800"
              value={slot}
              onChange={(e) => setSlot(Number(e.target.value) as PartySlot)}
            >
              <option value={0}>0 · Kael</option>
              <option value={1}>1 · Lyra</option>
              <option value={2}>2 · Vexis</option>
            </select>
          </label>
          <Btn onClick={() => q({ t: 'thread', slot })}>Thread</Btn>
          <Btn onClick={() => q({ t: 'mode' })}>Mode</Btn>
          <Btn onClick={() => q({ t: 'tech', id: 'ward', slot })}>Ward</Btn>
          <Btn onClick={() => rt() && q({ t: 'tech', id: 'chime', point: rt()!.heroPos(slot) })}>
            Chime
          </Btn>
          <Btn onClick={() => q({ t: 'tech', id: 'reel', slot })}>Reel</Btn>
          <Btn onClick={() => q({ t: 'glide', x: 1, z: 0 })}>Glide →</Btn>
          <Btn onClick={() => q({ t: 'glide', x: -1, z: 0 })}>Glide ←</Btn>
          <Btn
            onClick={() => {
              q({ t: 'debug', op: { op: 'setResonance', value: 100 } });
              q({ t: 'cue', slot });
            }}
          >
            Cue
          </Btn>
          <Btn
            onClick={() => {
              q({ t: 'debug', op: { op: 'setResonance', value: 100 } });
              q({ t: 'crescendo' });
            }}
          >
            Crescendo
          </Btn>
          <Btn onClick={() => q({ t: 'debug', op: { op: 'setResonance', value: 75 } })}>
            Resonance 75
          </Btn>
          <Btn
            onClick={() => {
              const id = rt()?.nearestEnemy();
              if (id !== null && id !== undefined) q({ t: 'directive', kind: 'focus', target: id });
            }}
          >
            Focus nearest
          </Btn>
          <Btn onClick={() => q({ t: 'directive', kind: 'scatter' })}>Scatter</Btn>
          <Btn onClick={() => q({ t: 'directive', kind: 'rally' })}>Rally</Btn>
        </Group>
        <Group title="Phase 3 · Beam & field songs">
          <p className="w-full text-[10px] text-muted">
            Chord I is the beam song (the threaded hero, at its focus), Chord II the field song.
            Pick a preset under Scene → Chords.
          </p>
          <Btn onClick={() => rt()?.thread(0)} title="Real {t:'thread'}: the beam pours into Kael">
            Beam → Kael
          </Btn>
          <Btn onClick={() => rt()?.thread(1)}>Beam → Lyra</Btn>
          <Btn onClick={() => rt()?.thread(2)}>Beam → Vexis</Btn>
          <Btn
            onClick={() => rt()?.cycleBeam(1.5)}
            title="Retarget the beam every 1.5 s (real sim)"
          >
            Cycle beam
          </Btn>
          <Btn
            onClick={() => q({ t: 'directive', kind: 'scatter' })}
            title="Spread the party: who is in the echo, who is out"
          >
            Scatter
          </Btn>
          <Btn
            onClick={() => q({ t: 'directive', kind: 'rally' })}
            title="Pull the party into your field"
          >
            Rally
          </Btn>
          <Btn
            onClick={() => rt()?.attackers(slot, 4)}
            title="Choristers on the target slot's hero: with Lullaby on the beam their hex is at focus"
          >
            Attackers on slot
          </Btn>
          <Btn
            onClick={() => {
              rt()?.spawn('bell_brute', -2, -5);
              rt()?.spawn('bell_brute', 3, -6);
              rt()?.spawn('hollow_chorister', 0, -4);
            }}
            title="A small real fight: real aura chips (Fortissimo) and aura heals (Sostenuto)"
          >
            Real fight
          </Btn>
          <Btn
            onClick={() => rt()?.auraHit(slot, 186, 22, 64)}
            title="Synthetic hit: 186 with a gold +22 and a ♪+64 aura chip"
          >
            Aura chips
          </Btn>
          <Btn onClick={() => rt()?.auraHit(slot, 140, 0, 48)}>Aura chip only</Btn>
          <Btn onClick={() => rt()?.auraHit(slot, 210, 70, 0)}>Gold chip only</Btn>
          <Btn
            onClick={() => {
              rt()?.auraHeal(slot, 38);
              inject([
                {
                  type: 'healApplied',
                  tick: tick(),
                  target: hero(),
                  source: rt()?.sim.state.weaverId ?? null,
                  amount: 120,
                  overheal: 0,
                  via: 'mend',
                },
              ]);
            }}
            title="Synthetic: an aura heal ♪+38 next to a Mend heal +120"
          >
            Aura heal + Mend
          </Btn>
        </Group>
        <Group title="Phase 3b · Relics">
          <p className="w-full text-[10px] text-muted">
            Each restarts the real sim carrying the relic and stages the moment it acts.
          </p>
          {RELIC_SCENARIO_NAMES.map((name) => (
            <Btn
              key={name}
              onClick={() => rt()?.relicScenario(name)}
              title={RELIC_SCENARIOS[name]!.note}
            >
              {name}
            </Btn>
          ))}
          <Btn onClick={() => rt()?.restart([])} title="Restart without relics">
            No relics
          </Btn>
        </Group>
        <Group title="Phase 2 · Chords">
          <Btn onClick={() => rt()?.plant(5, -4)} title="{t:'plant'} ahead-right of the Weaver">
            Plant ↗
          </Btn>
          <Btn onClick={() => rt()?.plant(-6, 2)}>Plant ↙</Btn>
          <Btn onClick={() => rt()?.plantAtCursor()}>Plant at cursor</Btn>
          <Btn onClick={() => rt()?.chorus(slot)} title="Synthetic chorusPulse">
            Chorus pulse
          </Btn>
          <Btn
            onClick={() => {
              for (let i = 0; i < 4; i++) rt()?.spawn('hollow_chorister', -4 + i * 2.5, -5);
            }}
            title="Choristers to hex (Lullaby)"
          >
            Hex targets
          </Btn>
        </Group>
        <Group title="Phase 2 · Moments">
          <Btn onClick={() => rt()?.save(slot)}>Save ghost</Btn>
          <Btn
            onClick={() => {
              for (let i = 0; i < 3; i++) rt()?.save(i);
            }}
          >
            Save ghosts ×3
          </Btn>
          <Btn
            onClick={() => q({ t: 'debug', op: { op: 'forceCall', slot } })}
            title="Real sim call (debug op)"
          >
            Force call (sim)
          </Btn>
          <Btn onClick={() => rt()?.stageCall(slot)} title="Lab-only synthetic call">
            Stage call
          </Btn>
          <Btn onClick={() => rt()?.answerCall(slot)}>Answer → Flourish</Btn>
          <Btn onClick={() => rt()?.missCall(slot)}>Miss call</Btn>
          <Btn onClick={() => rt()?.flourish(slot)}>Flourish only</Btn>
          <Btn
            onClick={() => q({ t: 'debug', op: { op: 'forceHold', slot } })}
            title="Real sim Fermata hold (debug op)"
          >
            Force hold (sim)
          </Btn>
          <Btn onClick={() => rt()?.stageHold(slot)} title="Lab-only synthetic hold">
            Stage hold
          </Btn>
          <Btn onClick={() => rt()?.releaseHold(slot, true)}>Hold → saved</Btn>
          <Btn onClick={() => rt()?.releaseHold(slot, false)}>Hold → downed</Btn>
        </Group>
        <Group title="Inject (synthetic)">
          <Btn
            onClick={() => {
              const s = rt()?.sim.state;
              const tg = s?.telegraphs[0]?.id ?? null;
              inject([
                { type: 'perfectWard', tick: tick(), target: hero(), telegraph: tg, negated: 520 },
              ]);
            }}
          >
            Perfect Ward
          </Btn>
          <Btn
            onClick={() =>
              inject([
                {
                  type: 'save',
                  tick: tick(),
                  target: hero(),
                  cause: 'ward',
                  counterfactualDamage: 1140,
                  attack: 'Requiem',
                },
              ])
            }
          >
            Save
          </Btn>
          <Btn
            onClick={() => {
              const p = rt()?.heroPos(slot) ?? { x: 0, z: 0 };
              inject([
                {
                  type: 'chimeLanded',
                  tick: tick(),
                  chime: 0,
                  x: p.x,
                  z: p.z,
                  radius: 4,
                  cleansed: 1,
                  clutch: true,
                },
                { type: 'cleansed', tick: tick(), target: hero(), removed: 2, clutch: true },
              ]);
            }}
          >
            Clutch Chime
          </Btn>
          <Btn
            onClick={() =>
              inject([
                {
                  type: 'damageTaken',
                  tick: tick(),
                  target: rt()?.nearestEnemy() ?? hero(),
                  source: hero(),
                  amount: 412,
                  absorbed: 0,
                  amplified: 96,
                  aura: 0,
                  radiance: 0,
                  crit: false,
                  telegraph: null,
                  hit: 'hit',
                },
              ])
            }
          >
            Hit 412 +96
          </Btn>
          <Btn
            onClick={() =>
              inject([
                {
                  type: 'damageTaken',
                  tick: tick(),
                  target: hero(),
                  source: null,
                  amount: 640,
                  absorbed: 180,
                  amplified: 0,
                  aura: 0,
                  radiance: 0,
                  crit: false,
                  telegraph: null,
                  hit: 'hit',
                },
              ])
            }
          >
            Hero hit
          </Btn>
          <Btn
            onClick={() =>
              inject([{ type: 'shieldBroken', tick: tick(), target: hero(), shield: 'ward' }])
            }
          >
            Shatter
          </Btn>
          <Btn
            onClick={() =>
              inject([
                {
                  type: 'soloStarted',
                  tick: tick(),
                  hero: hero(),
                  solo: 'aegisWall',
                  cued: true,
                  duration: 4,
                },
              ])
            }
          >
            Cue sigil + dome
          </Btn>
          <Btn
            onClick={() =>
              inject([{ type: 'crescendoStart', tick: tick(), calling: 'Test', duration: 6 }])
            }
          >
            Crescendo FX
          </Btn>
          <Btn onClick={() => inject([{ type: 'allyDowned', tick: tick(), hero: hero() }])}>
            Downed pulse
          </Btn>
          <Btn
            onClick={() => {
              const id = rt()?.nearestEnemy();
              if (id !== null && id !== undefined)
                inject([{ type: 'phaseChanged', tick: tick(), boss: id, phase: 2 }]);
            }}
          >
            Phase change
          </Btn>
          <Btn onClick={() => inject([{ type: 'threadSnapped', tick: tick(), target: hero() }])}>
            Snap
          </Btn>
          <Btn
            onClick={() => {
              const p = rt()?.heroPos(slot) ?? { x: 0, z: 0 };
              inject([{ type: 'spawnWarning', tick: tick(), x: p.x + 3, z: p.z - 3, delay: 1.2 }]);
            }}
          >
            Portal
          </Btn>
        </Group>
      </aside>
    </main>
  );
}
