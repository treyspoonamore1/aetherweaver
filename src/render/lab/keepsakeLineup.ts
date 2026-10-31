import * as THREE from 'three';
import type { ColorVision } from '../../app/colorVision';
import { CONTENT, arenaDef, heroDef } from '../../content';
import { ArenaView } from '../arena';
import { RIBBON_SAMPLES, weaverRibbons } from '../entities';
import { FxKit } from '../fx/kit';
import { RING } from '../fx/rings';
import {
  OWN_LOOK,
  restRim,
  ribbonHex,
  robeDef,
  threadLookDef,
  weaverPalette,
  type WeaverLook,
} from '../keepsakeCues';
import { ModelBatch } from '../models/batch';
import { buildHero, buildWeaver, recolorModel } from '../models/library';
import { createModelMaterial, type ModelMaterial } from '../models/material';
import { C, VISION_HEX, applyVision, color } from '../palette';
import type { QualityTier, Stage } from '../stage';
import { ThreadView, type ThreadTo } from '../thread';

/**
 * The VFX lab's lineup of keepsakes (Phase 4g, docs/phase-4g.md), side by side and drawn by the
 * fight's own code: the Weaver's model in each robe (models/library.ts, with her resting rim and
 * her ribbons from entities.ts), and the Thread in each look in Mend and in Empower (thread.ts:
 * its strands, its beads, its pulses and ends) to Kael, rimmed and ringed in the mode's colour as
 * a threaded hero is. No sim: the figures stand still on the lab's arena, so every look is seen
 * on every floor and under every colour vision. Pages:
 *
 * - `robes`: her own and each robe in a row, turned a little toward you, seen from close.
 * - `threads`: her own Thread and each look, a row each: Mend on the left, Empower on the right,
 *   at the fight's camera angle. Mend pulses as its heal ticks would.
 */
export type LineupPage = 'robes' | 'threads';

/** The pages' layouts (m): figures this far apart; Weaver ↔ Kael in a Thread's tile. */
const ROBE_GAP = 2;
const THREAD_ROW = 2.5;
const THREAD_REACH = 4.6;
/** Mend's heal ticks, as its pulses run (s). */
const PULSE_EVERY = 0.6;
/** How taut the lineup's Threads hang (0..1). */
const TENSION = 0.25;
const KAEL = 'kael';

interface Figure {
  look: WeaverLook;
  batch: ModelBatch;
  x: number;
  z: number;
  yaw: number;
  /** Her resting rim in this robe. */
  rim: THREE.Color;
  rimStrength: number;
  /** Her hand's path, standing still (her ribbons hang from it). */
  hist: Float32Array;
}

interface Tile {
  figure: Figure;
  hero: ThreadTo & { yaw: number };
  thread: ThreadView;
  empower: boolean;
  nextPulse: number;
}

interface Label {
  el: HTMLDivElement;
  x: number;
  y: number;
  z: number;
}

export class KeepsakeLineup {
  readonly group = new THREE.Group();
  /**
   * The Threads' FX, and the figures' (their rings, shadows and ribbons): one kit's ribbons hold
   * a fight's worth, and a lineup is several fights' worth.
   */
  readonly kit = new FxKit();
  private readonly figureKit = new FxKit();
  private readonly model: ModelMaterial = createModelMaterial();
  private readonly figures: Figure[] = [];
  private readonly tiles: Tile[] = [];
  private readonly labels: Label[] = [];
  private readonly heroes: ModelBatch;
  private readonly layer: HTMLDivElement;
  private arena: ArenaView;
  private vision: ColorVision | null = null;
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly e = new THREE.Euler(0, 0, 0, 'YXZ');
  private readonly p = new THREE.Vector3();
  private readonly s = new THREE.Vector3(1, 1, 1);
  private readonly v = new THREE.Vector3();
  private readonly black = new THREE.Color(0, 0, 0);
  /** Where the camera looks (m), how far out it stands and how steeply it looks down (rad). */
  private readonly view = { x: 0, y: 0, z: 0, distance: 18, pitch: (52 * Math.PI) / 180 };

  constructor(
    private readonly stage: Stage,
    host: HTMLElement,
    readonly page: LineupPage,
    theme: string,
  ) {
    this.group.name = 'keepsake-lineup';
    stage.scene.add(this.group);
    this.arena = new ArenaView(arenaDef(theme), stage, this.model);
    this.group.add(this.arena.group);
    this.group.add(this.kit.group, this.figureKit.group);
    this.heroes = new ModelBatch(buildHero(heroDef(KAEL)), this.model.material, 8, true);
    this.group.add(this.heroes.mesh);
    this.layer = document.createElement('div');
    this.layer.className = 'pointer-events-none absolute inset-0 overflow-hidden';
    this.layer.dataset.testid = 'keepsake-lineup';
    host.appendChild(this.layer);
    if (page === 'robes') this.robes();
    else this.threads();
  }

  /** The lab's arena changed: the same lineup on its floor. */
  setTheme(theme: string): void {
    this.arena.dispose();
    this.arena = new ArenaView(arenaDef(theme), this.stage, this.model);
    this.group.add(this.arena.group);
  }

  /** What each figure wears, in order (robes left to right; Threads row by row, Mend first). */
  looks(): WeaverLook[] {
    return this.figures.map((f) => ({ ...f.look }));
  }

  /** Beads each Thread drew last frame, in the same order. */
  beads(): number[] {
    return this.tiles.map((t) => t.thread.beadsDrawn);
  }

  private robes(): void {
    const looks: WeaverLook[] = [
      { ...OWN_LOOK },
      ...CONTENT.cosmetics.robes.map((r) => ({ robe: r.id, thread: null })),
    ];
    const half = ((looks.length - 1) * ROBE_GAP) / 2;
    looks.forEach((look, i) => {
      const x = i * ROBE_GAP - half;
      // Turned a little toward you, alternately, so the hood and the sash both show.
      this.figure(look, x, 0, Math.PI + (i % 2 === 0 ? -0.4 : 0.4));
      const robe = robeDef(look.robe);
      this.label(robe?.name ?? 'Her own', robe?.colors.trim ?? '#f5d78e', x, 2.15, 0);
    });
    Object.assign(this.view, { x: 0, y: 0.75, z: 0, distance: 8.2, pitch: (24 * Math.PI) / 180 });
  }

  private threads(): void {
    const ids: (string | null)[] = [null, ...CONTENT.cosmetics.threads.map((t) => t.id)];
    const top = -((ids.length - 1) * THREAD_ROW) / 2;
    const hero = heroDef(KAEL);
    const left = -THREAD_REACH - 1.6;
    ids.forEach((id, r) => {
      const z = top + r * THREAD_ROW;
      const def = threadLookDef(id);
      this.label(def?.name ?? 'Her own', def?.filament ?? '#fff1c4', left - 1.9, 0.4, z);
      for (const empower of [false, true]) {
        const x = empower ? 1.6 : left;
        const figure = this.figure({ robe: null, thread: id }, x, z, -Math.PI / 2);
        const thread = new ThreadView({ recs: new Map() }, null);
        thread.setLook(id);
        this.tiles.push({
          figure,
          hero: {
            x: x + THREAD_REACH,
            y: 0,
            z,
            yaw: Math.PI / 2,
            height: hero.height,
            radius: hero.radius,
          },
          thread,
          empower,
          nextPulse: 0.2 + r * 0.15,
        });
      }
    });
    const head = top - THREAD_ROW * 0.75;
    this.label('Mend', VISION_HEX.mend, left + THREAD_REACH / 2, 0.3, head, 'mend');
    this.label('Empower', VISION_HEX.empower, 1.6 + THREAD_REACH / 2, 0.3, head, 'empower');
    Object.assign(this.view, { x: -0.9, y: 0, z: 0.5, distance: 17, pitch: (52 * Math.PI) / 180 });
  }

  private figure(look: WeaverLook, x: number, z: number, yaw: number): Figure {
    const batch = new ModelBatch(
      buildWeaver(weaverPalette(look, 'normal')),
      this.model.material,
      1,
      true,
    );
    this.group.add(batch.mesh);
    // Her hand's path, as entities.ts samples it: just behind her, standing still.
    const hist = new Float32Array(RIBBON_SAMPLES * 3);
    const fx = -Math.sin(yaw);
    const fz = -Math.cos(yaw);
    for (let k = 0; k < RIBBON_SAMPLES; k++) {
      hist[k * 3] = x - fx * 0.18;
      hist[k * 3 + 2] = z - fz * 0.18;
    }
    const rim = restRim(look.robe);
    const f: Figure = {
      look,
      batch,
      x,
      z,
      yaw,
      rim: color(rim.hex),
      rimStrength: rim.strength,
      hist,
    };
    this.figures.push(f);
    return f;
  }

  private label(
    text: string,
    hex: string,
    x: number,
    y: number,
    z: number,
    mode?: 'mend' | 'empower',
  ): void {
    const el = document.createElement('div');
    el.className =
      'absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded bg-ink-950/75 px-1.5 py-0.5 font-display text-sm font-bold tracking-wide';
    el.textContent = text;
    el.style.color = hex;
    if (mode) el.dataset.mode = mode;
    this.layer.appendChild(el);
    this.labels.push({ el, x, y, z });
  }

  /** Dresses the figures for a colour vision (their hands follow the look's fitting). */
  private fit(vision: ColorVision): void {
    this.vision = vision;
    for (const f of this.figures)
      recolorModel(f.batch.geometry, buildWeaver(weaverPalette(f.look, vision)));
    for (const l of this.labels) {
      if (l.el.dataset.mode === 'mend') l.el.style.color = VISION_HEX.mend;
      else if (l.el.dataset.mode === 'empower') l.el.style.color = VISION_HEX.empower;
    }
  }

  private compose(x: number, z: number, yaw: number): THREE.Matrix4 {
    this.e.set(0, yaw, 0, 'YXZ');
    this.q.setFromEuler(this.e);
    this.p.set(x, 0, z);
    return this.m.compose(this.p, this.q, this.s);
  }

  sync(time: number, dt: number, vision: ColorVision, quality: QualityTier): void {
    applyVision(vision);
    if (vision !== this.vision) this.fit(vision);
    const camera = this.stage.camera;
    const w = this.view;
    camera.position.set(
      w.x,
      w.y + w.distance * Math.sin(w.pitch),
      w.z + w.distance * Math.cos(w.pitch),
    );
    camera.lookAt(w.x, w.y, w.z);
    camera.updateMatrixWorld();
    this.model.uniforms.uTime.value = time;
    this.kit.begin(time, camera.position);
    this.figureKit.begin(time, camera.position);
    for (const f of this.figures) f.batch.begin();
    this.heroes.begin();
    const weaverR = CONTENT.weaver.radius;
    for (const f of this.figures) {
      f.batch.push(this.compose(f.x, f.z, f.yaw), 0, 0, 0, 0, f.rim, f.rimStrength);
      const fk = this.figureKit;
      fk.rings.push(f.x, 0.03, f.z, weaverR * 1.5, 0.07, 0.2, RING.plain, C.gold, 0.6);
      fk.shadows.push(f.x, 0.015, f.z, weaverR * 1.25, 0, 0, RING.soft, this.black, 0.5, 0, 7, 1);
      const ribbons = ribbonHex(f.look.thread, vision);
      weaverRibbons(
        fk,
        f.hist,
        RIBBON_SAMPLES,
        f.yaw,
        time,
        color(ribbons.filament),
        color(ribbons.glow),
      );
    }
    for (const t of this.tiles) {
      const h = t.hero;
      const mode = t.empower ? C.empower : C.mend;
      // A threaded hero: rimmed and ringed in the mode's colour (entities.ts).
      this.heroes.push(this.compose(h.x, h.z, h.yaw), 0, 0, 0, 0, mode, 0.5);
      this.kit.rings.push(h.x, 0.03, h.z, h.radius * 1.45, 0.1, 0.25, RING.plain, mode, 0.95);
      this.kit.shadows.push(
        h.x,
        0.015,
        h.z,
        h.radius * 1.25,
        0,
        0,
        RING.soft,
        this.black,
        0.5,
        0,
        7,
        1,
      );
      if (!t.empower && time >= t.nextPulse) {
        t.thread.pulse();
        t.nextPulse = time + PULSE_EVERY;
      }
      const f = t.figure;
      t.thread.draw(
        this.kit,
        dt,
        time,
        { x: f.x, y: 0, z: f.z, yaw: f.yaw },
        h,
        t.empower,
        false,
        TENSION,
      );
    }
    for (const f of this.figures) f.batch.end();
    this.heroes.end();
    // The drawing buffer's height (the canvas's own), as the combat view sizes points by it.
    const canvas = this.stage.canvas;
    const pointScale = canvas.height / (2 * Math.tan((camera.fov * Math.PI) / 360));
    this.arena.update(time, pointScale, quality);
    this.kit.end(dt, canvas.clientWidth, canvas.clientHeight, canvas.height, camera.fov);
    this.figureKit.end(dt, canvas.clientWidth, canvas.clientHeight, canvas.height, camera.fov);
    this.place();
  }

  /** The labels over their places on screen. */
  private place(): void {
    const camera = this.stage.camera;
    const w = this.layer.clientWidth;
    const h = this.layer.clientHeight;
    for (const l of this.labels) {
      const p = this.v.set(l.x, l.y, l.z).project(camera);
      l.el.style.left = `${(p.x * 0.5 + 0.5) * w}px`;
      l.el.style.top = `${(-p.y * 0.5 + 0.5) * h}px`;
    }
  }

  dispose(): void {
    for (const f of this.figures) f.batch.dispose();
    this.heroes.dispose();
    this.kit.dispose();
    this.figureKit.dispose();
    this.arena.dispose();
    this.model.material.dispose();
    this.layer.remove();
    this.group.removeFromParent();
  }
}
