import * as THREE from 'three';
import { CONTENT, arenaDef, enemyDef, heroDef } from '../../content';
import { ArenaView } from '../arena';
import { arenaLook } from '../crimsonCues';
import { RIBBON_SAMPLES, weaverRibbons } from '../entities';
import { FxKit } from '../fx/kit';
import { RING } from '../fx/rings';
import { GROVE_HEX } from '../groveCues';
import { OWN_LOOK, restRim, ribbonHex, weaverPalette, type WeaverLook } from '../keepsakeCues';
import { HERO_DRAWN, HOSTILE_EDGE, HOSTILE_OUTLINE } from '../models/artFlag';
import { applyArtWorld } from '../models/artWorld';
import { ModelBatch } from '../models/batch';
import {
  buildAncient,
  buildCrown,
  buildEnemy,
  buildHero,
  buildSapling,
  buildWeaver,
} from '../models/library';
import { createModelMaterial, setModelQuality, type ModelMaterial } from '../models/material';
import { C, applyVision, color } from '../palette';
import type { QualityTier, Stage } from '../stage';

/**
 * The art studio (`__VFX__.studio`): any figure a fight draws, standing on a real arena floor under
 * the arena's own light, with no sim, under a fixed camera, so the same figure can be pictured the
 * same way before and after a change to its model (docs/art-style.md, The studio). Each figure
 * stands as the fight draws it at rest: its blob shadow, a hero's ring in its colour, the Weaver's
 * gold ring and ribbons, a rank-and-file enemy's faint hostile rim; heroes and the Weaver drawn
 * at the art pass's 1.12.
 *
 * A subject is any roster id: a hero id, `weaver`, an enemy id, `sapling`, `ancient` or `crown`.
 *
 * Framing (fixed per subject, from content's heights, never from the model, so a redesign is
 * framed exactly like the model it replaces):
 * - `close`: the subject alone at the floor's centre, turned 0.6 rad toward the key light, seen
 *   from the front and 15° above, at 2.15 × its drawn height, looking at half its height.
 * - `lineup`: the subjects in a row (default: the seven), turned alike, from the front and 12°
 *   above, 14.2 m out (farther for a long row).
 * - `field`: the subjects placed as in a fight under the game's own camera (52° pitch, 27 m, 40°
 *   field of view): the party facing up the screen toward the foes, the foes facing the party
 *   (`yaw` turns the party instead), to judge the figures at the size the player sees them.
 * `pose` holds every figure at a point of its motion (a wind-up, a blow, a walk) for strips.
 */
export type StudioSubject = string;

/** The seven of the first art pass (the default line-up and field). */
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
  layout: 'close' | 'lineup' | 'field';
  /** For `close`: the one subject. */
  subject?: StudioSubject;
  /** For `lineup` and `field`: the subjects (default: the seven). */
  subjects?: StudioSubject[];
  /** The floor (default: First Light's, the Reliquary Hall): any arena id. */
  arena?: string;
  /** The figures' facing (rad, default π + 0.6: toward the camera, turned to the key light). */
  yaw?: number;
  /**
   * A held pose for motion strips: the figures' clock (s, default the studio's time), wind-up,
   * blow (0..1 through a swing) and moving (0..1), as entities.ts passes them each frame.
   */
  pose?: { clock?: number; windup?: number; blow?: number; moving?: number };
  /** A rim on a subject, as the fight draws one (e.g. Mend's on the threaded hero). */
  rim?: Partial<Record<StudioSubject, { hex: string; strength: number }>>;
  /** false: no dark-world fit (artWorld.ts), for comparison. */
  world?: boolean;
  /** The Weaver's look: a robe and a Thread look (keepsakeCues.ts), as she wears them in a fight. */
  look?: Partial<WeaverLook>;
  /** Subjects staged as elites: the game's gold elite rim and the elite crown over them. */
  elite?: StudioSubject[];
  /**
   * The standing rims (the hostile rim, the elite's gold) as the owner's alternatives draw them
   * (artFlag.ts; default: the constants): `flat` (on the body, as approved), `edge` (the hostile
   * rim on the body's edge only), `outline` (on the body and the outline too: a red or gold
   * outline), `outline-edge` (the outline and the body's edge, no body wash), or `none` (no
   * hostile rim, for measuring it).
   */
  hostile?: 'flat' | 'edge' | 'outline' | 'outline-edge' | 'none';
}

type Kind = 'hero' | 'weaver' | 'enemy' | 'summon';

function kindOf(s: StudioSubject): Kind {
  if (s === 'weaver') return 'weaver';
  if (s === 'sapling' || s === 'ancient' || s === 'crown') return 'summon';
  if (CONTENT.heroes.some((h) => h.id === s)) return 'hero';
  return 'enemy';
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
  kind: Kind;
  ring: THREE.Color | null;
  rim: THREE.Color;
  rimStrength: number;
  /** A standing rim: drawn on the body only (ModelBatch `standing`). */
  standing: boolean;
  hist: Float32Array | null;
}

function sizeOf(s: StudioSubject): { radius: number; height: number } {
  if (s === 'weaver') return { radius: CONTENT.weaver.radius, height: WEAVER_HEIGHT };
  if (s === 'sapling') return { radius: 0.5, height: 1 };
  if (s === 'ancient') return { radius: 0.9, height: 2.4 };
  if (s === 'crown') return { radius: 0.35, height: 0.5 };
  if (kindOf(s) === 'hero') {
    const d = heroDef(s);
    return { radius: d.radius, height: d.height };
  }
  const d = enemyDef(s);
  return { radius: d.radius, height: d.height };
}

/** A subject's drawn height (heroes and the Weaver at the art pass's 1.12). */
function drawnHeight(s: StudioSubject): number {
  const k = kindOf(s);
  return sizeOf(s).height * (k === 'hero' || k === 'weaver' ? HERO_DRAWN : 1);
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
  /** The elite crown over every subject staged as an elite (entities.ts's own crown batch). */
  private crown: ModelBatch | null = null;
  private readonly target = new THREE.Vector3();

  constructor(
    private readonly stage: Stage,
    readonly spec: StudioSpec,
  ) {
    this.group.name = 'art-studio';
    stage.scene.add(this.group);
    const arena = arenaDef(spec.arena ?? 'reliquary_hall');
    this.arena = new ArenaView(arena, stage, this.model);
    if (spec.world !== false) applyArtWorld(this.model, arenaLook(arena));
    this.group.add(this.arena.group, this.kit.group);
    if (spec.elite?.length) {
      this.crown = new ModelBatch(buildCrown(), this.model.material, 32, false);
      this.group.add(this.crown.mesh);
    }
    const yaw = spec.yaw ?? FACE;
    if (spec.layout === 'close') {
      const subject = spec.subject ?? 'kael';
      this.figure(subject, 0, 0, yaw);
      const h = drawnHeight(subject);
      // A figure longer than it is tall (a hound, a quadruped boss) is framed by its model's
      // footprint so it is not cropped; an upright one by its content height, as before.
      const g = this.figures[0]!.batch.geometry;
      g.computeBoundingBox();
      const box = g.boundingBox!;
      const span =
        Math.max(box.max.x - box.min.x, box.max.z - box.min.z) * this.figures[0]!.batch.drawn;
      const size = Math.max(h, 0.85 * span);
      const el = (15 * Math.PI) / 180;
      const d = 2.15 * size;
      this.target.set(0, 0.5 * h, 0);
      this.eye.set(0, 0.5 * h + d * Math.sin(el), d * Math.cos(el));
    } else if (spec.layout === 'field') {
      const party = spec.yaw ?? 0;
      const foe = Math.PI;
      const list = spec.subjects ?? STUDIO_SUBJECTS;
      if (!spec.subjects) {
        // The first pass's placing, so its pictures line up.
        const place: [StudioSubject, number, number, number][] = [
          ['weaver', 0.4, 2.6, party],
          ['kael', 0.2, -1.4, party],
          ['lyra', -2.6, 0.4, party + 0.3],
          ['vexis', 2.8, 0.6, party - 0.3],
          ['hollow_chorister', -1.6, -4.6, foe + 0.4],
          ['bell_brute', 1.9, -4.9, foe - 0.3],
          ['the_bellwarden', 6.4, -3.2, foe - 0.9],
        ];
        for (const [s, x, z, y] of place) this.figure(s, x, z, y);
      } else {
        // Friends in a row in front, foes in rows behind, spaced by their footprints.
        const friends = list.filter((s) => kindOf(s) !== 'enemy');
        const foes = list.filter((s) => kindOf(s) === 'enemy');
        this.row(friends, 1.2, party, 0.9, 12);
        this.row(foes, -4.4, foe, 0.9, 12, -3.4);
      }
      const el = (52 * Math.PI) / 180;
      const d = 27;
      this.target.set(0.6, 0, -1);
      this.eye.set(0.6, d * Math.sin(el), -1 + d * Math.cos(el));
    } else {
      const list = spec.subjects ?? STUDIO_SUBJECTS;
      const gap = 0.9;
      const sizes = list.map(sizeOf);
      const width = sizes.reduce((a, s) => a + 2 * s.radius, 0) + gap * (sizes.length - 1);
      let x = -width / 2;
      list.forEach((s, i) => {
        const r = sizes[i]!.radius;
        this.figure(s, x + r, 0, yaw);
        x += 2 * r + gap;
      });
      const el = (12 * Math.PI) / 180;
      const d = Math.max(14.2, width * 0.95);
      this.target.set(0, 1.55, 0);
      this.eye.set(0, 1.55 + d * Math.sin(el), d * Math.cos(el));
    }
  }

  /**
   * Places `list` in rows of at most `width` m centred on x = 0, the first at depth `z`, each next
   * row `step` m further (negative: up the screen), all facing `yaw`.
   */
  private row(
    list: StudioSubject[],
    z: number,
    yaw: number,
    gap: number,
    width: number,
    step = 2.4,
  ) {
    let rowStart = 0;
    while (rowStart < list.length) {
      let w = 0;
      let end = rowStart;
      while (end < list.length) {
        const add = 2 * sizeOf(list[end]!).radius + (end > rowStart ? gap : 0);
        if (end > rowStart && w + add > width) break;
        w += add;
        end++;
      }
      let x = -w / 2;
      for (let i = rowStart; i < end; i++) {
        const r = sizeOf(list[i]!).radius;
        this.figure(list[i]!, x + r, z, yaw);
        x += 2 * r + gap;
      }
      rowStart = end;
      z += step;
    }
  }

  /** Where each figure stands (for framing a clip around it). */
  places(): { subject: StudioSubject; x: number; z: number; height: number }[] {
    return this.figures.map((f) => ({ subject: f.subject, x: f.x, z: f.z, height: f.height }));
  }

  private figure(subject: StudioSubject, x: number, z: number, yaw: number): void {
    const { radius, height } = sizeOf(subject);
    const kind = kindOf(subject);
    let geometry: THREE.BufferGeometry;
    let ring: THREE.Color | null = null;
    let rim = this.black;
    let rimStrength = 0;
    let standing = false;
    let hist: Float32Array | null = null;
    if (kind === 'weaver') {
      const look = { ...OWN_LOOK, ...this.spec.look };
      geometry = buildWeaver(weaverPalette(look, 'normal'));
      const r = restRim(look.robe);
      rim = color(r.hex);
      rimStrength = r.strength;
      // Her resting rim: on her body only, as entities.ts draws it.
      standing = true;
      ring = C.gold;
      // Her hand's path, as entities.ts samples it: just behind her, standing still.
      hist = new Float32Array(RIBBON_SAMPLES * 3);
      const fx = -Math.sin(yaw);
      const fz = -Math.cos(yaw);
      for (let k = 0; k < RIBBON_SAMPLES; k++) {
        hist[k * 3] = x - fx * 0.18;
        hist[k * 3 + 2] = z - fz * 0.18;
      }
    } else if (kind === 'hero') {
      const def = heroDef(subject);
      geometry = buildHero(def);
      ring = color(def.color);
    } else if (kind === 'summon') {
      // Oro's summons in his moss, the elite crown on its own.
      geometry =
        subject === 'crown'
          ? buildCrown()
          : subject === 'ancient'
            ? buildAncient(GROVE_HEX.moss)
            : buildSapling(GROVE_HEX.moss);
    } else {
      const def = enemyDef(subject);
      geometry = buildEnemy(def);
      const mode = this.hostileMode();
      const onOutline = mode === 'outline' || mode === 'outline-edge';
      if (this.spec.elite?.includes(subject)) {
        // As entities.ts draws an elite at rest: its gold rim, and its crown (below).
        rim = C.gold;
        rimStrength = 0.18;
        standing = !onOutline;
      } else if (def.role !== 'boss' && def.role !== 'miniboss') {
        rim = this.hostile;
        const edge = mode === 'edge' || mode === 'outline-edge';
        rimStrength = mode === 'none' ? 0 : edge ? -0.18 : 0.18;
        standing = !onOutline;
      }
    }
    const own = this.spec.rim?.[subject];
    if (own) {
      rim = color(own.hex);
      rimStrength = own.strength;
      standing = false;
    }
    const batch = new ModelBatch(geometry, this.model.material, 1, true);
    // Heroes and the Weaver drawn at the art pass's scale (as entities.ts draws them).
    if (kind === 'hero' || kind === 'weaver') batch.drawn = HERO_DRAWN;
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
      standing,
      hist,
    });
  }

  private compose(x: number, z: number, yaw: number): THREE.Matrix4 {
    this.e.set(0, yaw, 0, 'YXZ');
    this.q.setFromEuler(this.e);
    this.p.set(x, 0, z);
    return this.m.compose(this.p, this.q, this.s);
  }

  /** The standing rims' look: the spec's, else the owner's constants (artFlag.ts). */
  private hostileMode(): NonNullable<StudioSpec['hostile']> {
    if (this.spec.hostile) return this.spec.hostile;
    if (HOSTILE_OUTLINE) return HOSTILE_EDGE ? 'outline-edge' : 'outline';
    return HOSTILE_EDGE ? 'edge' : 'flat';
  }

  sync(time: number, dt: number, quality: QualityTier): void {
    applyVision('normal');
    const camera = this.stage.camera;
    camera.position.copy(this.eye);
    camera.lookAt(this.target);
    camera.updateMatrixWorld();
    this.model.uniforms.uTime.value = time;
    setModelQuality(this.model, quality);
    this.kit.begin(time, camera.position);
    this.crown?.begin();
    for (const f of this.figures) {
      if (this.crown && this.spec.elite?.includes(f.subject)) {
        // As entities.ts places it: over the head, turning, sized to the foe, tinted gold.
        const s = Math.max(0.8, f.radius * 1.2);
        this.e.set(0, time * 0.8, 0, 'YXZ');
        this.q.setFromEuler(this.e);
        this.p.set(f.x, f.height + 0.22, f.z);
        this.s.set(s, s, s);
        this.crown.push(
          this.m.compose(this.p, this.q, this.s),
          0,
          0,
          0,
          0,
          C.gold,
          0.4,
          0,
          0,
          0,
          0,
          !(this.hostileMode() === 'outline' || this.hostileMode() === 'outline-edge'),
        );
        this.s.set(1, 1, 1);
      }
      f.batch.begin();
      // At rest, each on its own clock (secondary motion, material.ts).
      const pose = this.spec.pose;
      f.batch.setPose(
        pose?.clock ?? time + this.figures.indexOf(f) * 1.37,
        pose?.windup ?? 0,
        pose?.blow ?? 0,
        pose?.moving ?? 0,
      );
      f.batch.push(
        this.compose(f.x, f.z, f.yaw),
        0,
        0,
        0,
        0,
        f.rim,
        f.rimStrength,
        0,
        0,
        0,
        0,
        f.standing,
      );
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
        const ribbons = ribbonHex(this.spec.look?.thread ?? null, 'normal');
        weaverRibbons(
          this.kit,
          f.hist!,
          RIBBON_SAMPLES,
          f.yaw,
          time,
          color(ribbons.filament),
          color(ribbons.glow),
          1,
          HERO_DRAWN,
        );
      }
      f.batch.end();
    }
    this.crown?.end();
    const canvas = this.stage.canvas;
    const pointScale = canvas.height / (2 * Math.tan((camera.fov * Math.PI) / 360));
    this.arena.update(time, pointScale, quality);
    this.kit.end(dt, canvas.clientWidth, canvas.clientHeight, canvas.height, camera.fov);
  }

  dispose(): void {
    for (const f of this.figures) f.batch.dispose();
    this.crown?.dispose();
    this.kit.dispose();
    this.arena.dispose();
    this.model.material.dispose();
    this.group.removeFromParent();
  }
}
