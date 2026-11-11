import * as THREE from 'three';
import { CONTENT, arenaDef, enemyDef, heroDef } from '../../content';
import { ArenaView } from '../arena';
import { RIBBON_SAMPLES, weaverRibbons } from '../entities';
import { FxKit } from '../fx/kit';
import { RING } from '../fx/rings';
import { OWN_LOOK, restRim, ribbonHex, weaverPalette } from '../keepsakeCues';
import { ModelBatch } from '../models/batch';
import { buildEnemy, buildHero, buildWeaver } from '../models/library';
import { createModelMaterial, type ModelMaterial } from '../models/material';
import { C, applyVision, color } from '../palette';
import type { QualityTier, Stage } from '../stage';

/**
 * The art studio (`__VFX__.studio`): the characters' models standing on a real arena floor under
 * the arena's own light, with no sim, under a fixed camera, so the same subject can be pictured
 * the same way before and after a change to its model. Each figure stands as the fight draws it
 * at rest: its blob shadow, a hero's ring in its colour, the Weaver's gold ring and ribbons, a
 * rank-and-file enemy's faint hostile rim.
 *
 * Framing (fixed per subject, from content's heights, never from the model, so a redesign is
 * framed exactly like the model it replaces):
 * - `close`: the subject alone at the floor's centre, turned 0.6 rad toward the key light, seen
 *   from the front and 15° above, at 2.15 × its height, looking at half its height.
 * - `lineup`: all seven in a row, turned alike, from the front and 12° above, 14.2 m out.
 */
export type StudioSubject =
  'kael' | 'lyra' | 'vexis' | 'weaver' | 'hollow_chorister' | 'bell_brute' | 'the_bellwarden';

export const STUDIO_SUBJECTS: readonly StudioSubject[] = [
  'kael',
  'lyra',
  'vexis',
  'weaver',
  'hollow_chorister',
  'bell_brute',
  'the_bellwarden',
];

export interface StudioSpec {
  layout: 'close' | 'lineup';
  /** For `close`: the one subject. */
  subject?: StudioSubject;
  /** The floor (default: First Light's, the Reliquary Hall). */
  arena?: string;
  /** The figures' facing (rad, default π + 0.6: toward the camera, turned to the key light). */
  yaw?: number;
}

/** Turned toward the camera (+z) and 0.6 rad toward the key light (+x). */
const FACE = Math.PI + 0.6;
const WEAVER_HEIGHT = 1.75;

interface Figure {
  subject: StudioSubject;
  batch: ModelBatch;
  x: number;
  z: number;
  yaw: number;
  radius: number;
  height: number;
  kind: 'hero' | 'weaver' | 'enemy';
  ring: THREE.Color | null;
  rim: THREE.Color;
  rimStrength: number;
  hist: Float32Array | null;
}

function sizeOf(s: StudioSubject): { radius: number; height: number } {
  if (s === 'weaver') return { radius: CONTENT.weaver.radius, height: WEAVER_HEIGHT };
  if (s === 'kael' || s === 'lyra' || s === 'vexis') {
    const d = heroDef(s);
    return { radius: d.radius, height: d.height };
  }
  const d = enemyDef(s);
  return { radius: d.radius, height: d.height };
}

export class ArtStudio {
  readonly group = new THREE.Group();
  private readonly kit = new FxKit();
  private readonly model: ModelMaterial = createModelMaterial();
  private readonly figures: Figure[] = [];
  private readonly arena: ArenaView;
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly e = new THREE.Euler(0, 0, 0, 'YXZ');
  private readonly p = new THREE.Vector3();
  private readonly s = new THREE.Vector3(1, 1, 1);
  private readonly black = new THREE.Color(0, 0, 0);
  private readonly hostile = color('#ef4444');
  private readonly eye = new THREE.Vector3();
  private readonly target = new THREE.Vector3();

  constructor(
    private readonly stage: Stage,
    readonly spec: StudioSpec,
  ) {
    this.group.name = 'art-studio';
    stage.scene.add(this.group);
    this.arena = new ArenaView(arenaDef(spec.arena ?? 'reliquary_hall'), stage, this.model);
    this.group.add(this.arena.group, this.kit.group);
    const yaw = spec.yaw ?? FACE;
    if (spec.layout === 'close') {
      const subject = spec.subject ?? 'kael';
      this.figure(subject, 0, 0, yaw);
      const h = sizeOf(subject).height;
      const el = (15 * Math.PI) / 180;
      const d = 2.15 * h;
      this.target.set(0, 0.5 * h, 0);
      this.eye.set(0, 0.5 * h + d * Math.sin(el), d * Math.cos(el));
    } else {
      const gap = 0.9;
      const sizes = STUDIO_SUBJECTS.map(sizeOf);
      const width = sizes.reduce((a, s) => a + 2 * s.radius, 0) + gap * (sizes.length - 1);
      let x = -width / 2;
      STUDIO_SUBJECTS.forEach((s, i) => {
        const r = sizes[i]!.radius;
        this.figure(s, x + r, 0, yaw);
        x += 2 * r + gap;
      });
      const el = (12 * Math.PI) / 180;
      const d = 14.2;
      this.target.set(0, 1.55, 0);
      this.eye.set(0, 1.55 + d * Math.sin(el), d * Math.cos(el));
    }
  }

  /** Where each figure stands (for framing a clip around it). */
  places(): { subject: StudioSubject; x: number; z: number; height: number }[] {
    return this.figures.map((f) => ({ subject: f.subject, x: f.x, z: f.z, height: f.height }));
  }

  private figure(subject: StudioSubject, x: number, z: number, yaw: number): void {
    const { radius, height } = sizeOf(subject);
    let geometry: THREE.BufferGeometry;
    let kind: Figure['kind'];
    let ring: THREE.Color | null = null;
    let rim = this.black;
    let rimStrength = 0;
    let hist: Float32Array | null = null;
    if (subject === 'weaver') {
      geometry = buildWeaver(weaverPalette(OWN_LOOK, 'normal'));
      kind = 'weaver';
      const r = restRim(null);
      rim = color(r.hex);
      rimStrength = r.strength;
      ring = C.gold;
      // Her hand's path, as entities.ts samples it: just behind her, standing still.
      hist = new Float32Array(RIBBON_SAMPLES * 3);
      const fx = -Math.sin(yaw);
      const fz = -Math.cos(yaw);
      for (let k = 0; k < RIBBON_SAMPLES; k++) {
        hist[k * 3] = x - fx * 0.18;
        hist[k * 3 + 2] = z - fz * 0.18;
      }
    } else if (subject === 'kael' || subject === 'lyra' || subject === 'vexis') {
      const def = heroDef(subject);
      geometry = buildHero(def);
      kind = 'hero';
      ring = color(def.color);
    } else {
      const def = enemyDef(subject);
      geometry = buildEnemy(def);
      kind = 'enemy';
      if (def.role !== 'boss' && def.role !== 'miniboss') {
        rim = this.hostile;
        rimStrength = 0.18;
      }
    }
    const batch = new ModelBatch(geometry, this.model.material, 1, true);
    this.group.add(batch.mesh);
    this.figures.push({
      subject,
      batch,
      x,
      z,
      yaw,
      radius,
      height,
      kind,
      ring,
      rim: rim.clone(),
      rimStrength,
      hist,
    });
  }

  private compose(x: number, z: number, yaw: number): THREE.Matrix4 {
    this.e.set(0, yaw, 0, 'YXZ');
    this.q.setFromEuler(this.e);
    this.p.set(x, 0, z);
    return this.m.compose(this.p, this.q, this.s);
  }

  sync(time: number, dt: number, quality: QualityTier): void {
    applyVision('normal');
    const camera = this.stage.camera;
    camera.position.copy(this.eye);
    camera.lookAt(this.target);
    camera.updateMatrixWorld();
    this.model.uniforms.uTime.value = time;
    this.kit.begin(time, camera.position);
    for (const f of this.figures) {
      f.batch.begin();
      // At rest, each on its own clock (secondary motion, material.ts).
      f.batch.setPose(time + this.figures.indexOf(f) * 1.37, 0, 0, 0);
      f.batch.push(this.compose(f.x, f.z, f.yaw), 0, 0, 0, 0, f.rim, f.rimStrength);
      this.kit.shadows.push(
        f.x,
        0.015,
        f.z,
        f.radius * 1.25,
        0,
        0,
        RING.soft,
        this.black,
        0.5,
        0,
        7,
        1,
      );
      if (f.kind === 'hero' && f.ring)
        this.kit.rings.push(f.x, 0.03, f.z, f.radius * 1.45, 0.06, 0.1, RING.plain, f.ring, 0.38);
      if (f.kind === 'weaver' && f.ring) {
        this.kit.rings.push(f.x, 0.03, f.z, f.radius * 1.5, 0.07, 0.2, RING.plain, f.ring, 0.6);
        const ribbons = ribbonHex(null, 'normal');
        weaverRibbons(
          this.kit,
          f.hist!,
          RIBBON_SAMPLES,
          f.yaw,
          time,
          color(ribbons.filament),
          color(ribbons.glow),
          1,
        );
      }
      f.batch.end();
    }
    const canvas = this.stage.canvas;
    const pointScale = canvas.height / (2 * Math.tan((camera.fov * Math.PI) / 360));
    this.arena.update(time, pointScale, quality);
    this.kit.end(dt, canvas.clientWidth, canvas.clientHeight, canvas.height, camera.fov);
  }

  dispose(): void {
    for (const f of this.figures) f.batch.dispose();
    this.kit.dispose();
    this.arena.dispose();
    this.model.material.dispose();
    this.group.removeFromParent();
  }
}
