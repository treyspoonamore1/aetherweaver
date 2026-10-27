import * as THREE from 'three';
import { CONTENT, enemyDef, heroDef } from '../content';
import type { EntityId, EntityKind, ReadonlyEntity, WorldState } from '../sim';
import { RING } from './fx/rings';
import { SHELL } from './fx/shells';
import { SPRITE } from './fx/sprites';
import { PARTICLE } from './fx/particles';
import type { FxKit } from './fx/kit';
import { ModelBatch } from './models/batch';
import { buildCrown, buildEnemy, buildHero, buildWeaver } from './models/library';
import type { ModelMaterial } from './models/material';
import { shineLevel, shineOf } from './callingCues';
import {
  CHRONO_HEX,
  chronoLook,
  emptyChronoLook,
  reviveWindow,
  rewindPreviewHero,
  rewindSample,
  slowDanced,
  stasisWave,
} from './chronoCues';
import { MARTYR_HEX } from './martyrCues';
import { C, approach, auraColor, clamp01, color, threadColor as threadModeColor } from './palette';
import {
  POUR_TRAVEL,
  auraHearing,
  beamSong,
  chordMask,
  focusLevel,
  isAllIn,
  isFullEcho,
} from './songs';
import type { FrameInfo } from './types';

/** Per-entity render state. Views never mutate the sim; this is all presentation. */
export interface EntityRec {
  id: EntityId;
  kind: EntityKind;
  batch: ModelBatch;
  radius: number;
  height: number;
  /** Signature colour (hero), accent (enemy), gold (Weaver). */
  color: THREE.Color;
  hex: string;
  accent: THREE.Color;
  role: string;
  tier: string;
  affixColor: THREE.Color | null;
  suppressRadius: number;
  seen: number;
  x: number;
  z: number;
  y: number;
  yaw: number;
  walk: number;
  flash: number;
  lunge: number;
  lungeX: number;
  lungeZ: number;
  stagger: number;
  lie: number;
  dissolve: number;
  /** ≥ 0 while the death dissolve plays (seconds). */
  dying: number;
  goldRim: number;
  rimFlash: number;
  /** How much the beam song swells this hero right now (0..1, render-side fade). */
  beam: number;
  bleedMax: number;
  smokeAcc: number;
  sparkleAcc: number;
  /**
   * The Luminary (docs/phase-3c/vfx.md): how brightly this hero shines (the shine level,
   * 0..1.6, smoothed: a quick brighten into the field, a slower fade out), and how much they
   * stand in the field (0..1, smoothed; Haloed's halo follows it).
   */
  shine: number;
  lit: number;
  /** Real seconds since this hero last stepped into the light (the kindle flare). */
  kindled: number;
  /**
   * The Martyr (docs/phase-3d/vfx.md): the Weaver's flinch when a wound she Bears reaches her
   * (0..1.4, decays in ~0.3 s): a crimson rim flash and a small recoil.
   */
  flinch: number;
  /**
   * A held rim tint, written each frame by the Martyr's view (Low-Life Vigil's pulse, Scarred
   * Hide's hardened rim). 0 for none. Read on the next frame (MartyrView syncs after this).
   */
  rimHold: number;
  rimHoldColor: THREE.Color;
  /**
   * The Chronomancer (docs/phase-3e/vfx.md). `frost`: an enemy held by Stasis (0..1, smoothed;
   * it rises as the stillness spreading from the Weaver reaches it). `slow`: Slow Dance holds it
   * back in the field (0..1). `chronoFlash`: a silver rim flash (Rewind's arrival, a revive, an
   * Echo Ward), decaying in ~0.4 s.
   */
  frost: number;
  slow: number;
  chronoFlash: number;
  /** The Ward last seen on this entity and the sim time it was first seen (its pop). */
  wardRef: unknown;
  wardSeen: number;
  lastHp: number;
  alive: boolean;
}

/** Rewind's preview (the Chronomancer): where the threaded hero would go back to. */
export interface RewindGhost {
  /** The hero, or -1 while there is none. */
  hero: EntityId;
  /** Where Rewind would send them (smoothed between samples). */
  x: number;
  z: number;
  yaw: number;
  /** Shown, 0..1 (fades in and out). */
  alpha: number;
  /** The hero is down and Rewind would stand them back up (0..1, smoothed). */
  revive: number;
  /** Seconds left to stand a downed hero back up (0 while they stand). */
  window: number;
  /** The model ghost is drawn (it hides while the hero stands where they stood). */
  drawn: boolean;
}

interface Ghost {
  active: boolean;
  /** Glide afterimage of the Weaver, or the "death that didn't happen" of a saved hero. */
  save: boolean;
  /**
   * The Chronomancer's: 1 an afterimage left along Rewind's streak (silver), 2 a downed hero's
   * fall played backwards, rising and running from (x, z) to (x2, z2) as Rewind stands them up.
   */
  chrono: number;
  x2: number;
  z2: number;
  batch: ModelBatch | null;
  x: number;
  z: number;
  yaw: number;
  age: number;
  life: number;
  /** Save ghosts: which entity, and the side it falls to. */
  hero: EntityId;
  side: number;
  radius: number;
}

const BLACK = new THREE.Color(0, 0, 0);
const ENEMY_BAR = color('#ef4444');
const MUTE_GLASS = color('#c4b5fd');
const AILMENTS = new Set(['dirge', 'silence', 'sleep', 'stun', 'resound', 'shaken']);
const HIST = 26;
/** Fermata's stillness: the held hero's rim and the suspended motes around them. */
const FERMATA = color('#e2d6f8');
/** The Martyr's flinch: a warm crimson rim. */
const FLINCH = color(MARTYR_HEX.blood);
const GHOST_ASH = color('#e8e4f4');
const SAVE_GHOST_LIFE = 1.05;
/** The Chronomancer's silver: frozen enemies' rims, Rewind's ghosts. */
const CHRONO_SILVER = color(CHRONO_HEX.silver);
/** A downed hero's fall played backwards (Rewind standing them up): how long it takes. */
export const UNFALL_LIFE = 0.55;

function hasStatus(list: readonly { readonly id: string }[], id: string): boolean {
  for (let i = 0; i < list.length; i++) if (list[i]!.id === id) return true;
  return false;
}

function angleApproach(current: number, target: number, rate: number, dt: number): number {
  let d = target - current;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return current + d * (1 - Math.exp(-rate * dt));
}

export class EntityLayer {
  readonly recs = new Map<EntityId, EntityRec>();
  readonly group = new THREE.Group();
  private readonly batches = new Map<string, ModelBatch>();
  private readonly crown: ModelBatch;
  private readonly ghosts: Ghost[] = [];
  private frameNo = 0;
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly e = new THREE.Euler(0, 0, 0, 'YXZ');
  private readonly p = new THREE.Vector3();
  private readonly s = new THREE.Vector3();
  private readonly tint = new THREE.Color();
  private readonly tmpColor = new THREE.Color();
  /** Aura colours by coverage mask (bit i ⇔ CONTENT.auras[i]) and their average (rim tint). */
  private readonly maskColors = new Map<number, THREE.Color[]>();
  private readonly maskAvg = new Map<number, THREE.Color>();
  /** The beam song this frame: its coverage bits, focus level (songs.ts), all in. */
  private beamMask = 0;
  /** The beam song's echo plays at full strength (Spindle of Fate). */
  private beamFullEcho = false;
  private beamLevel = 0;
  private beamAllIn = false;
  private beamTarget: EntityId | null = null;
  private beamSince = 0;
  // Weaver ribbon history.
  private readonly hist = new Float32Array(HIST * 3);
  private histCount = 0;
  private histTimer = 0;
  private shadowsEnabled = true;
  weaverId: EntityId = -1;
  /** Real seconds of the frame (presentation clock). */
  private now = 0;
  /** The Luminary's Sunrise, smoothed (0..1): the heroes' light turns more golden. */
  sunrise = 0;
  /** The Chronomancer, read once a frame (docs/phase-3e/vfx.md). */
  readonly chrono = emptyChronoLook();
  /**
   * The enemies' animation clock (real seconds): it stands still while Stasis holds them, so a
   * frozen enemy keeps its pose mid-motion (a stagger's shake, a stun's wobble, a boss's breath).
   */
  private enemyClock = 0;
  /** Real seconds since Stasis began, and where the Weaver stood (its stillness spreads from there). */
  private stasisAge = 0;
  private stasisX = 0;
  private stasisZ = 0;
  private stasisOn = false;
  /** Rewind's preview: the model ghost where the threaded hero would go back to. */
  readonly rewindGhost: RewindGhost = {
    hero: -1,
    x: 0,
    z: 0,
    yaw: 0,
    alpha: 0,
    revive: 0,
    window: 0,
    drawn: false,
  };

  constructor(private readonly model: ModelMaterial) {
    this.group.name = 'entities';
    this.crown = new ModelBatch(buildCrown(), model.material, 48, false);
    this.group.add(this.crown.mesh);
    for (let i = 0; i < 18; i++) {
      this.ghosts.push({
        active: false,
        save: false,
        chrono: 0,
        x2: 0,
        z2: 0,
        batch: null,
        x: 0,
        z: 0,
        yaw: 0,
        age: 0,
        life: 0.4,
        hero: -1,
        side: 1,
        radius: 0.6,
      });
    }
  }

  setShadows(enabled: boolean): void {
    this.shadowsEnabled = enabled;
    for (const [key, b] of this.batches) b.mesh.castShadow = enabled && this.castsShadow(key);
  }

  private castsShadow(key: string): boolean {
    if (key === 'weaver' || key.startsWith('hero:')) return true;
    if (key.startsWith('enemy:')) {
      const def = enemyDef(key.slice(6));
      return (
        def.role === 'brute' ||
        def.role === 'miniboss' ||
        def.role === 'boss' ||
        def.role === 'controller'
      );
    }
    return false;
  }

  private batchFor(key: string, build: () => THREE.BufferGeometry, capacity: number): ModelBatch {
    let b = this.batches.get(key);
    if (!b) {
      b = new ModelBatch(
        build(),
        this.model.material,
        capacity,
        this.shadowsEnabled && this.castsShadow(key),
      );
      this.batches.set(key, b);
      this.group.add(b.mesh);
    }
    return b;
  }

  private createRec(e: ReadonlyEntity): EntityRec {
    let batch: ModelBatch;
    let hex = '#f5d78e';
    let accentHex = '#f5d78e';
    let role: string = e.kind;
    let tier = 'normal';
    let suppressRadius = 0;
    let affixColor: THREE.Color | null = null;
    if (e.kind === 'weaver') {
      batch = this.batchFor('weaver', buildWeaver, 16);
      this.weaverId = e.id;
    } else if (e.hero) {
      const def = heroDef(e.hero.defId);
      // Room for the hero plus a few save ghosts (same model, same draw call).
      batch = this.batchFor(`hero:${def.id}`, () => buildHero(def), 8);
      hex = def.color;
      accentHex = def.color;
      role = def.role;
    } else if (e.enemy) {
      const def = enemyDef(e.enemy.defId);
      const big = def.role === 'boss' || def.role === 'miniboss';
      batch = this.batchFor(`enemy:${def.id}`, () => buildEnemy(def), big ? 4 : 64);
      hex = def.accent;
      accentHex = def.accent;
      role = def.role;
      tier = e.enemy.tier;
      suppressRadius = def.suppressRadius;
      const affix = e.enemy.affixes[0];
      if (affix) {
        const a = CONTENT.affixes.find((x) => x.id === affix);
        if (a) affixColor = color(a.color);
      }
    } else {
      // Debug dummies share the chorister silhouette in a neutral grey.
      batch = this.batchFor(
        'dummy',
        () => buildEnemy({ ...enemyDef('hollow_chorister'), color: '#8b8fa8', accent: '#5b5f7a' }),
        512,
      );
      hex = '#8b8fa8';
      accentHex = '#5b5f7a';
    }
    const rec: EntityRec = {
      id: e.id,
      kind: e.kind,
      batch,
      radius: e.radius,
      height: e.height,
      color: color(hex),
      hex,
      accent: color(accentHex),
      role,
      tier,
      affixColor,
      suppressRadius,
      seen: 0,
      x: e.x,
      z: e.z,
      y: 0,
      yaw: Math.atan2(-e.fx, -e.fz),
      walk: Math.random() * 10,
      flash: 0,
      lunge: 0,
      lungeX: 0,
      lungeZ: 0,
      stagger: 0,
      lie: 0,
      dissolve: 0,
      dying: -1,
      goldRim: 0,
      rimFlash: 0,
      beam: 0,
      bleedMax: 0,
      smokeAcc: 0,
      sparkleAcc: 0,
      shine: 0,
      lit: e.hero?.inField ? 1 : 0,
      kindled: 10,
      flinch: 0,
      rimHold: 0,
      rimHoldColor: new THREE.Color(),
      frost: 0,
      slow: 0,
      chronoFlash: 0,
      wardRef: null,
      wardSeen: 0,
      lastHp: e.health?.hp ?? 0,
      alive: true,
    };
    this.recs.set(e.id, rec);
    return rec;
  }

  // ── Event hooks (called by the feedback layer) ─────────────────────────────────────

  hit(id: EntityId, amount = 1): void {
    const r = this.recs.get(id);
    if (r) r.flash = Math.max(r.flash, amount);
  }

  lungeAt(id: EntityId, toX: number, toZ: number): void {
    const r = this.recs.get(id);
    if (!r) return;
    const dx = toX - r.x;
    const dz = toZ - r.z;
    const d = Math.hypot(dx, dz) || 1;
    r.lungeX = dx / d;
    r.lungeZ = dz / d;
    r.lunge = 1;
  }

  staggerEntity(id: EntityId): void {
    const r = this.recs.get(id);
    if (r) r.stagger = 1;
  }

  saveFlash(id: EntityId): void {
    const r = this.recs.get(id);
    if (r) r.goldRim = 1;
  }

  /** The Martyr: a wound she Bears reaches her (a crimson flash and a recoil). */
  flinch(id: EntityId, amount = 1): void {
    const r = this.recs.get(id);
    if (r) r.flinch = Math.max(r.flinch, Math.min(1.4, amount));
  }

  attachFlash(id: EntityId): void {
    const r = this.recs.get(id);
    if (r) r.rimFlash = 1;
  }

  /** The Chronomancer: a silver rim flash (Rewind's arrival, a revive, an Echo Ward). */
  chronoFlash(id: EntityId, amount = 1): void {
    const r = this.recs.get(id);
    if (r) r.chronoFlash = Math.max(r.chronoFlash, Math.min(1.5, amount));
  }

  /**
   * Rewind's streak: afterimages of the hero left behind along it, from where they were (the
   * first, at once) back toward where they go (later ones), silver and quick to fade.
   */
  rewindEchoes(id: EntityId, fromX: number, fromZ: number, toX: number, toZ: number): void {
    const r = this.recs.get(id);
    if (!r || r.kind !== 'hero') return;
    const n = 4;
    for (let i = 0; i < n; i++) {
      const g = this.freeGhost();
      if (!g) return;
      const k = i / n;
      g.active = true;
      g.save = false;
      g.chrono = 1;
      g.batch = r.batch;
      g.hero = id;
      g.x = fromX + (toX - fromX) * k;
      g.z = fromZ + (toZ - fromZ) * k;
      g.yaw = r.yaw;
      g.age = -k * 0.16;
      g.life = 0.34;
      g.radius = r.radius;
    }
  }

  /**
   * Rewind stands a downed hero back up: their fall plays backwards, the body rising from where
   * it lay and running back to where they stood, silver, merging into the hero there.
   */
  unfall(id: EntityId, fromX: number, fromZ: number, toX: number, toZ: number): boolean {
    const r = this.recs.get(id);
    if (!r || r.kind !== 'hero') return false;
    const g = this.freeGhost();
    if (!g) return false;
    g.active = true;
    g.save = false;
    g.chrono = 2;
    g.batch = r.batch;
    g.hero = id;
    g.x = fromX;
    g.z = fromZ;
    g.x2 = toX;
    g.z2 = toZ;
    g.yaw = r.yaw;
    g.age = 0;
    g.life = UNFALL_LIFE;
    g.radius = r.radius;
    g.side = Math.random() < 0.5 ? -1 : 1;
    return true;
  }

  markDying(id: EntityId): void {
    const r = this.recs.get(id);
    if (r && r.dying < 0) {
      r.dying = 0;
      r.flash = 1;
    }
  }

  ghost(x: number, z: number, yaw: number, delay: number): void {
    const w = this.recs.get(this.weaverId);
    if (!w) return;
    const g = this.freeGhost();
    if (!g) return;
    g.active = true;
    g.save = false;
    g.chrono = 0;
    g.batch = w.batch;
    g.x = x;
    g.z = z;
    g.yaw = yaw;
    g.age = -delay;
    g.life = 0.42;
  }

  /** The Chronomancer's ghosts playing: Rewind's afterimages (1) or a fall played back (2). */
  chronoGhosts(kind: 1 | 2): number {
    let n = 0;
    for (const g of this.ghosts) if (g.active && g.chrono === kind) n++;
    return n;
  }

  private freeGhost(): Ghost | null {
    for (const g of this.ghosts) if (!g.active) return g;
    return null;
  }

  /**
   * Signature 1, "the death that didn't happen": a translucent, ashen copy of the saved hero
   * buckles and falls where they stood, dissolving in gold, while the real hero fights on.
   * Returns false if one was spawned for this hero a moment ago (a Fermata save sends both
   * `fermataReleased` and `save`).
   */
  saveGhost(id: EntityId): boolean {
    const r = this.recs.get(id);
    if (!r || r.kind !== 'hero') return false;
    for (const g of this.ghosts) {
      if (g.active && g.save && g.hero === id && g.age < 0.3) return false;
    }
    const g = this.freeGhost();
    if (!g) return false;
    g.active = true;
    g.save = true;
    g.chrono = 0;
    g.batch = r.batch;
    g.hero = id;
    g.x = r.x;
    g.z = r.z;
    g.yaw = r.yaw;
    g.age = 0;
    g.life = SAVE_GHOST_LIFE;
    g.side = Math.random() < 0.5 ? -1 : 1;
    g.radius = r.radius;
    return true;
  }

  /** Aura colours for a coverage mask, in content order (cached per mask). */
  auraColors(mask: number): readonly THREE.Color[] {
    let list = this.maskColors.get(mask);
    if (!list) {
      list = [];
      const auras = CONTENT.auras;
      for (let i = 0; i < auras.length; i++) {
        if (mask & (1 << i)) list.push(auraColor(auras[i]!.id));
      }
      this.maskColors.set(mask, list);
      const avg = new THREE.Color(0, 0, 0);
      for (const c of list) avg.add(c);
      if (list.length > 0) avg.multiplyScalar(1 / list.length);
      this.maskAvg.set(mask, avg);
    }
    return list;
  }

  private auraTint(mask: number): THREE.Color {
    this.auraColors(mask);
    return this.maskAvg.get(mask)!;
  }

  // ── Per-frame sync ─────────────────────────────────────────────────────────────────

  sync(state: WorldState, frame: FrameInfo, kit: FxKit, dt: number): void {
    this.frameNo++;
    this.now = frame.time;
    this.model.uniforms.uTime.value = frame.time;
    for (const b of this.batches.values()) b.begin();
    this.crown.begin();

    const weaver = state.entities.get(state.weaverId);
    const w = weaver?.weaver;
    const threadedId = w && w.threadSlot !== null ? (state.party[w.threadSlot] ?? null) : null;
    const threadColor = threadModeColor(w?.threadMode);
    const beam = beamSong(state);
    this.beamMask = beam ? chordMask(beam.auras) : 0;
    this.beamFullEcho = beam ? isFullEcho(beam) : false;
    this.beamLevel = beam ? focusLevel(beam.focus) : 0;
    this.beamAllIn = beam ? isAllIn(beam) : false;
    const lum = state.calling?.id === 'luminary';
    this.sunrise = approach(this.sunrise, lum && state.field.crescendo ? 1 : 0, 4, dt);
    // The Chronomancer's Stasis: the enemies' clock stops and the stillness spreads from her.
    const look = chronoLook(state, this.chrono);
    if (look.stasis && !this.stasisOn) {
      this.stasisAge = 0;
      this.stasisX = weaver?.x ?? state.field.x;
      this.stasisZ = weaver?.z ?? state.field.z;
    }
    this.stasisOn = look.stasis;
    if (look.stasis) this.stasisAge += dt;
    else this.enemyClock += dt;
    const target = beam?.threadHero ?? null;
    if (target !== this.beamTarget) {
      this.beamTarget = target;
      this.beamSince = 0;
    } else this.beamSince += dt;

    for (const e of state.entities.list()) {
      let rec = this.recs.get(e.id);
      if (!rec) rec = this.createRec(e);
      rec.seen = this.frameNo;
      this.updateRec(rec, e, state, frame, kit, dt, threadedId, threadColor);
    }
    for (const [id, rec] of this.recs) {
      if (rec.seen === this.frameNo) continue;
      if (rec.dying >= 0 && rec.dying < 0.9) {
        this.updateDying(rec, kit, dt);
      } else {
        this.recs.delete(id);
      }
    }
    this.updateGhosts(kit, dt);
    this.rewindPreview(state, dt);
    for (const b of this.batches.values()) b.end();
    this.crown.end();
  }

  /**
   * Rewind's preview (the Chronomancer): while Rewind is ready, a faint silver ghost of the
   * threaded hero stands where Rewind would send them (their oldest remembered moment). It
   * hides while they stand where they stood, and shows stronger when they are down and Rewind
   * would stand them back up. ChronoView draws the trail to it from `rewindGhost`.
   */
  private rewindPreview(state: WorldState, dt: number): void {
    const g = this.rewindGhost;
    const e = rewindPreviewHero(state, this.chrono);
    const past = e ? rewindSample(e) : null;
    const rec = e ? this.recs.get(e.id) : undefined;
    g.drawn = false;
    if (e && past && rec) {
      if (g.hero !== e.id || g.alpha < 0.01) {
        g.hero = e.id;
        g.x = past.x;
        g.z = past.z;
        g.yaw = rec.yaw;
      } else {
        g.x = approach(g.x, past.x, 16, dt);
        g.z = approach(g.z, past.z, 16, dt);
      }
      // Facing the way they were going then (the next remembered moment), else as they face now.
      const h = e.hero!;
      const next = h.past[(h.pastAt + 1) % h.past.length]!;
      const mx = next.x - past.x;
      const mz = next.z - past.z;
      const yaw = mx * mx + mz * mz > 1e-4 ? Math.atan2(-mx, -mz) : rec.yaw;
      g.yaw = angleApproach(g.yaw, yaw, 8, dt);
      g.alpha = approach(g.alpha, 1, 6, dt);
      const down = !!e.health?.downed;
      g.revive = approach(g.revive, down ? 1 : 0, 8, dt);
      g.window = down ? reviveWindow(e) : 0;
    } else {
      g.alpha = approach(g.alpha, 0, 8, dt);
      g.revive = approach(g.revive, 0, 8, dt);
      g.window = 0;
      if (g.alpha < 0.01) {
        g.alpha = 0;
        g.hero = -1;
      }
    }
    if (g.hero < 0 || g.alpha <= 0.02) return;
    const r = this.recs.get(g.hero);
    if (!r) return;
    // Hidden while they stand where they stood (it would sit inside them).
    const apart = clamp01((Math.hypot(r.x - g.x, r.z - g.z) - 0.4) / 0.7);
    const show = g.alpha * Math.max(apart, g.revive);
    if (show <= 0.02) return;
    const m = this.compose(g.x, 0, g.z, g.yaw, 0, 0, 1);
    const k = g.revive;
    r.batch.push(
      m,
      0,
      0.62 - 0.4 * show - 0.12 * k,
      0.9,
      0.95 - 0.3 * k,
      CHRONO_SILVER,
      0.75 + 0.55 * k,
      0,
      0,
      1,
    );
    g.drawn = true;
  }

  private compose(
    x: number,
    y: number,
    z: number,
    yaw: number,
    pitch: number,
    roll: number,
    scale: number,
  ): THREE.Matrix4 {
    this.e.set(pitch, yaw, roll, 'YXZ');
    this.q.setFromEuler(this.e);
    this.p.set(x, y, z);
    this.s.set(scale, scale, scale);
    return this.m.compose(this.p, this.q, this.s);
  }

  private updateDying(rec: EntityRec, kit: FxKit, dt: number): void {
    rec.dying += dt;
    const t = clamp01(rec.dying / 0.75);
    rec.flash = Math.max(0, rec.flash - dt * 5);
    const sink = t * t * 0.25;
    const m = this.compose(rec.x, -sink, rec.z, rec.yaw, 0.15 * t, 0, 1 + t * 0.06);
    // (Killed while Stasis held it, it stays cold as it goes.)
    rec.batch.push(m, rec.flash, 0.05 + t * 0.95, 0.3 * t, 0, rec.accent, 1, 0, 0, rec.frost);
    kit.shadows.push(
      rec.x,
      0.015,
      rec.z,
      rec.radius * 1.2,
      0,
      0,
      RING.soft,
      BLACK,
      0.45 * (1 - t),
      0,
      7,
      1,
    );
  }

  private updateRec(
    rec: EntityRec,
    e: ReadonlyEntity,
    state: WorldState,
    frame: FrameInfo,
    kit: FxKit,
    dt: number,
    threadedId: EntityId | null,
    threadColor: THREE.Color,
  ): void {
    if (rec.dying >= 0) {
      rec.x = e.x;
      rec.z = e.z;
      this.updateDying(rec, kit, dt);
      return;
    }
    const alpha = frame.alpha;
    const x = e.px + (e.x - e.px) * alpha;
    const z = e.pz + (e.z - e.pz) * alpha;
    rec.x = x;
    rec.z = z;
    const h = e.health;
    const time = state.time;

    // Fermata hold: a freeze-frame. The pose stops mid-motion until the hold resolves.
    const held = !!e.hero?.hold || (!!h && hasStatus(h.statuses, 'held'));
    // Stasis (the Chronomancer): every enemy stands still mid-motion; its own clock waits.
    const isEnemy = e.kind === 'enemy';
    const frozen = isEnemy && this.stasisOn;
    const clock = isEnemy ? this.enemyClock : this.now;
    if (isEnemy) {
      const reached =
        frozen &&
        stasisWave(this.stasisAge) >=
          Math.hypot(rec.x - this.stasisX, rec.z - this.stasisZ) - rec.radius;
      rec.frost = approach(rec.frost, reached ? 1 : 0, reached ? 16 : 6, dt);
      if (rec.frost < 0.003) rec.frost = 0;
      rec.slow = approach(rec.slow, slowDanced(state, e) ? 1 : 0, 3, dt);
      if (rec.slow < 0.003) rec.slow = 0;
    }
    if (!held && !frozen) rec.yaw = angleApproach(rec.yaw, Math.atan2(-e.fx, -e.fz), 14, dt);
    const speed = held || frozen ? 0 : Math.hypot(e.vx, e.vz);
    rec.walk += dt * speed * 2.2;
    const moving = Math.min(1, speed / 2.5);
    const bob = Math.abs(Math.sin(rec.walk * Math.PI)) * 0.07 * moving * (rec.height / 2);
    let pitch = -0.12 * moving;
    let roll = Math.sin(rec.walk * Math.PI) * 0.04 * moving;
    let y = bob;
    let ox = 0;
    let oz = 0;
    let scale = 1;
    let dissolve = 0;
    let desat = 0;
    let ghost = 0;

    // Attack lunge (Slow Dance: a little slower; Stasis: held mid-swing).
    if (rec.lunge > 0 && !held) {
      const k = Math.sin((1 - rec.lunge) * Math.PI);
      const amt = k * Math.min(0.45, rec.radius * 0.5);
      ox += rec.lungeX * amt;
      oz += rec.lungeZ * amt;
      pitch -= k * 0.12;
      if (!frozen) rec.lunge = Math.max(0, rec.lunge - dt * 5.5 * (1 - 0.15 * rec.slow));
    }
    // Perfect Ward stagger: a violent shake and a recoil back.
    if (rec.stagger > 0) {
      const k = rec.stagger;
      ox += Math.sin(clock * 57) * 0.14 * k;
      oz += Math.cos(clock * 49) * 0.1 * k;
      pitch += 0.28 * k;
      if (!frozen) rec.stagger = Math.max(0, rec.stagger - dt * 1.7);
    }
    // The Martyr's flinch: a small recoil back and a shudder.
    if (rec.flinch > 0.01 && !held) {
      const k = Math.min(1, rec.flinch);
      pitch += 0.16 * k * k;
      ox += Math.sin(this.now * 53) * 0.035 * k;
    }
    rec.flinch = Math.max(0, rec.flinch - dt * 3.5);
    rec.flash = Math.max(0, rec.flash - dt * 9);
    rec.goldRim = Math.max(0, rec.goldRim - dt * 1.4);
    rec.rimFlash = Math.max(0, rec.rimFlash - dt * 3);
    rec.chronoFlash = Math.max(0, rec.chronoFlash - dt * 2.6);

    // Spawning: rise out of the portal.
    const enemy = e.enemy;
    if (enemy?.state === 'spawning') {
      const s = clamp01(enemy.stateTime / 0.6);
      dissolve = 1 - s;
      y -= (1 - s) * 0.4;
      if (s < 1) rec.flash = Math.max(rec.flash, (1 - s) * 0.6);
    }
    if (
      enemy?.state === 'stunned' ||
      (h && (hasStatus(h.statuses, 'stun') || hasStatus(h.statuses, 'stagger')))
    ) {
      roll += Math.sin(clock * 9) * 0.06;
    }

    // Downed / dead heroes lie down and lose their colour.
    const downed = !!h && (h.downed || h.dead);
    rec.lie = approach(rec.lie, downed ? 1 : 0, 10, dt);
    if (rec.lie > 0.001) {
      pitch = pitch * (1 - rec.lie) + (Math.PI / 2) * rec.lie;
      roll *= 1 - rec.lie;
      y += rec.radius * 0.45 * rec.lie;
      desat = 0.85 * rec.lie;
    }
    if (h?.dead && e.kind !== 'enemy') {
      rec.dissolve = approach(rec.dissolve, 1, 1.4, dt);
      dissolve = Math.max(dissolve, rec.dissolve);
    } else rec.dissolve = 0;
    // The Weaver re-forming.
    if (e.weaver && e.weaver.reform > 0) {
      desat = 0.8;
      ghost = 0.55;
      y += 0.05 * Math.sin(this.now * 3);
    }
    // Reel flight arc.
    const reel = e.hero?.reel;
    if (reel && reel.end > reel.start) {
      const t = clamp01((time - reel.start) / (reel.end - reel.start));
      y += Math.sin(Math.PI * t) * 1.5;
      pitch -= 0.4 * Math.sin(Math.PI * t);
    }
    if (held) {
      desat = Math.max(desat, 0.72);
      // A tiny tremor: holding on by a thread.
      ox += Math.sin(this.now * 41) * 0.015;
    }
    // Glide: lean hard into the dash.
    if (e.weaver && e.weaver.glide > 0) pitch -= 0.35;
    if (rec.kind === 'enemy' && (rec.role === 'boss' || rec.role === 'miniboss')) {
      // Bosses breathe (held while Stasis holds them).
      scale *= 1 + Math.sin(clock * 1.6) * 0.012;
    }
    // The beam song pours into this hero: they visibly swell with it (5% at ×2, 8% all in).
    const poured =
      !!e.hero?.beamFocus &&
      this.beamMask !== 0 &&
      !downed &&
      !held &&
      (rec.beam > 0.5 || this.beamSince >= POUR_TRAVEL * 0.85);
    rec.beam = approach(rec.beam, poured ? 1 : 0, 5, dt);
    if (rec.beam > 0.001) {
      const swell = 0.03 + 0.03 * Math.min(1, this.beamLevel) + (this.beamAllIn ? 0.02 : 0);
      scale *= 1 + swell * rec.beam * (1 + 0.15 * Math.sin(this.now * 5));
    }
    rec.y = y;

    // Rim tint priority: Fermata hold > Save gold > threaded > hovered > focus > auras > affix.
    let tintStrength = 0;
    const isHero = e.kind === 'hero';
    const auraMask = e.hero?.auraMask ?? 0;
    if (held) {
      this.tint.copy(FERMATA);
      tintStrength = 1.1 + 0.35 * Math.sin(this.now * 7);
    } else if (rec.goldRim > 0) {
      this.tint.copy(C.gold);
      tintStrength = 0.5 + rec.goldRim * 2.2;
    } else if (isHero && e.id === threadedId) {
      // The beam song's colours breathe through the Thread's rim while it pours in.
      this.tint.copy(threadColor);
      if (rec.beam > 0.01) {
        const k = (0.4 + 0.2 * Math.sin(this.now * 4)) * rec.beam;
        this.tint.lerp(this.auraTint(this.beamMask), k);
      }
      tintStrength = 0.5 + rec.rimFlash * 1.5 + 0.25 * Math.min(1, this.beamLevel) * rec.beam;
    } else if (isHero && e.id === frame.hoveredHero) {
      this.tint.setRGB(1, 1, 1);
      tintStrength = 0.45;
    } else if (e.kind === 'enemy' && e.id === state.focusTarget) {
      this.tint.copy(C.gold);
      tintStrength = 0.55 + 0.25 * Math.sin(this.now * 6);
    } else if (e.kind === 'enemy' && e.id === frame.hoveredEnemy) {
      this.tint.setRGB(1, 1, 1);
      tintStrength = 0.5;
    } else if (isHero && auraMask !== 0) {
      this.tint.copy(this.auraTint(auraMask));
      tintStrength = 0.3;
    } else if (rec.affixColor) {
      this.tint.copy(rec.affixColor);
      tintStrength = 0.45 + 0.2 * Math.sin(clock * 3 + rec.id);
    } else if (rec.tier === 'elite') {
      this.tint.copy(C.gold);
      tintStrength = 0.18;
    } else {
      this.tint.copy(BLACK);
    }
    if (isEnemy && rec.frost > 0.01 && e.id !== state.focusTarget && e.id !== frame.hoveredEnemy) {
      // Held by Stasis: a cold, glassy silver-blue edge.
      this.tint.lerp(CHRONO_SILVER, 0.8 * rec.frost);
      tintStrength = Math.max(tintStrength * (1 - 0.4 * rec.frost), 0.42 * rec.frost);
    }
    if (rec.chronoFlash > 0.01) {
      // The Chronomancer's moment on this hero: a silver rim flash.
      this.tint.lerp(CHRONO_SILVER, Math.min(1, rec.chronoFlash));
      tintStrength = Math.max(tintStrength, 0.4 + 1.5 * Math.min(1, rec.chronoFlash));
    }
    if (rec.kind === 'weaver') {
      // The Martyr: a borne wound flashes her rim crimson; Vigil and Scarred Hide hold one.
      if (rec.flinch > 0.01) {
        this.tint.copy(FLINCH);
        tintStrength = 0.4 + 1.9 * Math.min(1, rec.flinch);
      } else if (rec.rimHold > 0.01) {
        this.tint.copy(rec.rimHoldColor);
        tintStrength = rec.rimHold;
      } else if (tintStrength === 0) {
        this.tint.copy(C.gold);
        tintStrength = 0.18;
      }
    }

    const m = this.compose(x + ox, y, z + oz, rec.yaw, pitch, roll, scale);
    if (isHero) {
      // The Luminary's Radiance: a hero standing in the field shines (brighten in ~0.15 s,
      // fade out in ~0.5 s, so stepping in and out reads without a pop).
      const target = held ? 0 : shineLevel(shineOf(state, e));
      if (target > 0.05 && rec.shine < 0.05) rec.kindled = 0;
      else rec.kindled += dt;
      rec.shine = approach(rec.shine, target, target > rec.shine ? 9 : 4.5, dt);
      if (rec.shine < (target > 0 ? 0.002 : 0.02)) rec.shine = 0;
      rec.lit = approach(rec.lit, e.hero?.inField && !downed ? 1 : 0, 6, dt);
    }
    rec.batch.push(
      m,
      rec.flash,
      dissolve,
      desat,
      ghost,
      this.tint,
      tintStrength,
      Math.min(1.1, rec.shine) * (1 - desat),
      this.sunrise,
      // Stasis' frost; Slow Dance only cools them a little (no new clutter).
      Math.max(rec.frost, rec.slow * 0.35),
    );

    // Blob shadow (fodder has no shadow-map shadow) and selection rings.
    kit.shadows.push(
      x,
      0.015,
      z,
      rec.radius * 1.25,
      0,
      0,
      RING.soft,
      BLACK,
      0.5 * (1 - dissolve),
      0,
      7,
      1,
    );

    if (rec.tier === 'elite') {
      const cm = this.compose(
        x + ox,
        y + rec.height + 0.22,
        z + oz,
        clock * 0.8,
        0,
        0,
        Math.max(0.8, rec.radius * 1.2),
      );
      this.crown.push(cm, 0, dissolve, 0, 0, C.gold, 0.4);
    }

    if (isHero) this.heroExtras(rec, e, state, frame, kit, dt, threadedId, threadColor);
    else if (e.kind === 'enemy') this.enemyExtras(rec, e, state, frame, kit, clock);
    else if (e.kind === 'weaver') this.weaverExtras(rec, e, kit, dt);
    if (h) this.shields(rec, e, state, kit);
    if (h) this.ailments(rec, e, kit, dt);
    if (h) rec.lastHp = h.hp;
  }

  private heroExtras(
    rec: EntityRec,
    e: ReadonlyEntity,
    state: WorldState,
    frame: FrameInfo,
    kit: FxKit,
    dt: number,
    threadedId: EntityId | null,
    threadColor: THREE.Color,
  ): void {
    const h = e.health!;
    const hero = e.hero!;
    const x = rec.x;
    const z = rec.z;
    if (h.dead) return;
    const threaded = e.id === threadedId;
    const hovered = e.id === frame.hoveredHero;
    const ringColor = threaded ? threadColor : rec.color;
    const ringAlpha = threaded ? 0.95 : hovered ? 0.8 : 0.38;
    kit.rings.push(
      x,
      0.03,
      z,
      rec.radius * 1.45,
      threaded ? 0.1 : 0.06,
      threaded ? 0.25 : 0.1,
      RING.plain,
      ringColor,
      ringAlpha,
    );
    if (hovered && !threaded) {
      kit.rings.push(
        x,
        0.03,
        z,
        rec.radius * 1.8,
        0.05,
        0.05,
        RING.dashed,
        C.white,
        0.6,
        0,
        7,
        0,
        12,
      );
    }

    // Per-aura rim lights: the ring under the hero splits into one lit arc per aura on them.
    // Phase 3: how they hear it shows in the arc. Field song: solid (Phase 2). The beam song
    // poured in: a thick, glowing arc with a second arc outside. Its echo: thin and dashed.
    if (hero.auraMask !== 0 && !h.downed) {
      const list = this.auraColors(hero.auraMask);
      const n = list.length;
      const gap = n > 1 ? 0.32 : 0;
      const seg = (Math.PI * 2) / n;
      const spin = this.now * 0.6;
      const auras = CONTENT.auras.length;
      for (let b = 0, j = 0; b < auras && j < n; b++) {
        const bit = 1 << b;
        if ((hero.auraMask & bit) === 0) continue;
        const c = list[j]!;
        const start = spin + j * seg + gap * 0.5;
        j++;
        const hear = auraHearing(bit, this.beamMask, hero.beamFocus, this.beamFullEcho);
        if (hear === 'fullEcho') {
          // The echo at full strength (Spindle of Fate): a field song's weight, still dashed.
          kit.rings.push(
            x,
            0.032,
            z,
            rec.radius * 1.78,
            0.11,
            0.16,
            RING.dashed,
            c,
            0.95,
            start,
            seg - gap,
            0,
            12,
          );
        } else if (hear === 'echo') {
          kit.rings.push(
            x,
            0.032,
            z,
            rec.radius * 1.78,
            0.06,
            0.06,
            RING.dashed,
            c,
            0.6,
            start,
            seg - gap,
            0,
            22,
          );
        } else if (hear === 'focus') {
          kit.rings.push(
            x,
            0.032,
            z,
            rec.radius * 1.78,
            0.17,
            0.28,
            RING.plain,
            c,
            1,
            start,
            seg - gap,
          );
          kit.rings.push(
            x,
            0.033,
            z,
            rec.radius * 2.08,
            0.045,
            0.1,
            RING.plain,
            c,
            0.75,
            start + 0.08,
            seg - gap - 0.16,
          );
        } else {
          kit.rings.push(
            x,
            0.032,
            z,
            rec.radius * 1.78,
            0.11,
            0.16,
            RING.plain,
            c,
            0.95,
            start,
            seg - gap,
          );
        }
      }
    }

    if (h.downed) {
      if (rec.bleedMax < h.bleedOut) rec.bleedMax = h.bleedOut;
      const bleed = rec.bleedMax > 0 ? h.bleedOut / rec.bleedMax : 0;
      kit.rings.push(
        x,
        0.04,
        z,
        rec.radius * 2.0,
        0.08,
        0.15,
        RING.plain,
        C.lethal,
        0.7,
        -Math.PI / 2,
        bleed * Math.PI * 2,
      );
      if (h.revive > 0) {
        kit.rings.push(
          x,
          0.05,
          z,
          rec.radius * 2.4,
          0.16,
          0.3,
          RING.plain,
          C.heal,
          1,
          -Math.PI / 2,
          h.revive * Math.PI * 2,
        );
        rec.sparkleAcc += dt * 18 * kit.particles.density;
        while (rec.sparkleAcc > 1) {
          rec.sparkleAcc -= 1;
          const a = Math.random() * Math.PI * 2;
          const r = rec.radius * 2.4;
          kit.particles.emit(
            x + Math.cos(a) * r,
            0.1,
            z + Math.sin(a) * r,
            0,
            1.6,
            0,
            0.8,
            0.12,
            C.heal,
            0.9,
            PARTICLE.dot,
            0.5,
          );
        }
      }
    } else {
      rec.bleedMax = 0;
    }

    // Solo charged and waiting for a Cue: a gold pulse and orbiting motes.
    if (hero.solo >= 100 && hero.soloActive <= 0 && !h.downed) {
      const pulse = (this.now * 1.2) % 1;
      kit.rings.push(
        x,
        0.04,
        z,
        rec.radius * (1.4 + pulse * 1.1),
        0.05,
        0.12,
        RING.plain,
        C.amp,
        0.7 * (1 - pulse),
      );
      for (let i = 0; i < 3; i++) {
        const a = this.now * 2.4 + (i * Math.PI * 2) / 3;
        kit.sprites.push(
          x + Math.cos(a) * rec.radius * 1.3,
          rec.height * 0.55 + Math.sin(this.now * 3 + i) * 0.15,
          z + Math.sin(a) * rec.radius * 1.3,
          0.16,
          SPRITE.diamond,
          C.amp,
          0.9,
        );
      }
    }
    // Active Solo: hero-coloured (gold when Cued) column of light.
    if (hero.soloActive > 0) {
      const c = hero.soloCued ? C.amp : rec.color;
      kit.rings.push(x, 0.04, z, rec.radius * 1.7, 0.1, 0.35, RING.dashed, c, 0.85, 0, 7, 0, 8);
      rec.sparkleAcc += dt * 14 * kit.particles.density;
      while (rec.sparkleAcc > 1) {
        rec.sparkleAcc -= 1;
        const a = Math.random() * Math.PI * 2;
        kit.particles.emit(
          x + Math.cos(a) * rec.radius,
          0.2,
          z + Math.sin(a) * rec.radius,
          0,
          2.4,
          0,
          0.7,
          0.14,
          c,
          0.9,
          PARTICLE.spark,
          0.4,
        );
      }
    }
    // Bars (only when hurt).
    if (h.hp < h.maxHp - 0.5 || h.downed) {
      let shield = 0;
      for (const s of h.shields) shield += s.amount;
      kit.bars.push(
        x,
        rec.height + 0.45,
        z,
        34,
        h.hp / h.maxHp,
        Math.min(1, shield / h.maxHp),
        -1,
        rec.flash,
        rec.color,
        0,
      );
    }
    void state;
  }

  private enemyExtras(
    rec: EntityRec,
    e: ReadonlyEntity,
    state: WorldState,
    frame: FrameInfo,
    kit: FxKit,
    clock: number,
  ): void {
    const h = e.health;
    const enemy = e.enemy!;
    const x = rec.x;
    const z = rec.z;
    if (e.id === state.focusTarget) {
      kit.rings.push(
        x,
        0.04,
        z,
        rec.radius * 1.6 + 0.2,
        0.09,
        0.2,
        RING.reticle,
        C.amp,
        1,
        0,
        7,
        0.06,
        0,
        this.now,
      );
      kit.spritesTop.push(
        x,
        rec.height + 0.75 + Math.sin(this.now * 4) * 0.08,
        z,
        0.22,
        SPRITE.diamond,
        C.amp,
        1,
      );
    } else if (e.id === frame.hoveredEnemy) {
      kit.rings.push(
        x,
        0.04,
        z,
        rec.radius * 1.5 + 0.15,
        0.06,
        0.1,
        RING.dashed,
        C.white,
        0.75,
        0,
        7,
        0,
        10,
      );
    }
    // Hexed (Lullaby…): a drowsy swirl over the head in the hex's colour, a dashed ring below.
    // Phase 3: a beam-song hex on an enemy attacking the threaded hero (`beamFocus`) hits at
    // focus strength, so it shows heavier: bigger triple swirl, a solid glowing foot ring.
    if (enemy.auraMask !== 0 && !h?.dead && enemy.state !== 'dying') {
      const list = this.auraColors(enemy.auraMask);
      const big = Math.max(1, rec.radius * 1.1);
      const top = rec.height + 0.22 + rec.y;
      const auras = CONTENT.auras.length;
      for (let b = 0, i = 0; b < auras && i < list.length; b++) {
        const bit = 1 << b;
        if ((enemy.auraMask & bit) === 0) continue;
        const c = list[i]!;
        const strong = enemy.beamFocus && (bit & this.beamMask) !== 0;
        const k = strong ? 1.35 : 1;
        const spin = this.now * (strong ? 3 : 2.2) + rec.id * 0.7 + i * 1.3;
        const ty = top + i * 0.14 * k;
        kit.rings.push(
          x,
          ty,
          z,
          0.34 * big * k,
          0.06 * k,
          0.12,
          RING.swipe,
          c,
          strong ? 1 : 0.85,
          spin,
          2.4,
        );
        kit.rings.push(
          x,
          ty + 0.07,
          z,
          0.2 * big * k,
          0.05,
          0.08,
          RING.swipe,
          c,
          0.7,
          spin + Math.PI,
          2.0,
        );
        if (strong) {
          kit.rings.push(x, ty + 0.16, z, 0.48 * big, 0.05, 0.14, RING.swipe, c, 0.8, -spin, 2.2);
          // The hex presses down: a ring dropping from over the head to the feet, again and again.
          const ph = (this.now * 1.3 + rec.id * 0.37) % 1;
          kit.rings.push(
            x,
            (ty + 0.3) * (1 - ph) + 0.05,
            z,
            rec.radius * (1.6 - 0.5 * ph) + 0.1,
            0.06,
            0.16,
            RING.plain,
            c,
            0.9 * Math.sin(Math.PI * ph),
          );
          kit.rings.push(x, 0.03, z, rec.radius * 1.35 + 0.1, 0.09, 0.22, RING.plain, c, 0.85);
          kit.rings.push(
            x,
            0.031,
            z,
            rec.radius * 1.75 + 0.15,
            0.05,
            0.1,
            RING.dashed,
            c,
            0.7,
            0,
            7,
            0,
            10,
            this.now * 0.9,
          );
        } else {
          kit.rings.push(
            x,
            0.03,
            z,
            rec.radius * 1.35 + 0.1,
            0.04,
            0.1,
            RING.dashed,
            c,
            0.45,
            0,
            7,
            0,
            8,
            -this.now * 0.4,
          );
        }
        i++;
      }
    }
    // Controller (Mute) dome of cracked glass.
    if (rec.suppressRadius > 0 && !h?.dead) {
      const R = rec.suppressRadius;
      kit.shells.push(
        x,
        0,
        z,
        R,
        R * 0.45,
        R,
        SHELL.muteDome,
        MUTE_GLASS,
        0.32,
        1,
        0,
        true,
        rec.id * 0.37,
      );
      kit.rings.push(x, 0.03, z, R, 0.07, 0.2, RING.dashed, MUTE_GLASS, 0.55, 0, 7, 0.04, 40);
    }
    // Caster/support: their focus glows brighter while casting.
    if (enemy.cast) {
      kit.sprites.push(
        x,
        rec.height * 0.75,
        z,
        rec.radius * 1.2,
        SPRITE.glow,
        rec.accent,
        (0.35 + 0.2 * Math.sin(clock * 12)) * (1 - 0.6 * rec.frost),
      );
    }
    if (!h) return;
    const showBar =
      h.hp < h.maxHp - 0.5 ||
      enemy.cast !== null ||
      e.id === frame.hoveredEnemy ||
      e.id === state.focusTarget ||
      rec.tier !== 'normal';
    if (showBar) {
      const width =
        rec.role === 'boss'
          ? 104
          : rec.role === 'miniboss'
            ? 84
            : rec.tier === 'elite'
              ? 46
              : rec.role === 'swarm'
                ? 26
                : 36;
      let shield = 0;
      for (const s of h.shields) shield += s.amount;
      const cast = enemy.cast
        ? clamp01(
            (state.time - enemy.cast.start) / Math.max(0.01, enemy.cast.end - enemy.cast.start),
          )
        : -1;
      const flags =
        (rec.tier === 'elite' ? 1 : 0) +
        (rec.role === 'boss' || rec.role === 'miniboss' ? 2 : 0) +
        (enemy.cast?.interruptible ? 4 : 0);
      const top = rec.height + (rec.tier === 'elite' ? 0.65 : 0.4);
      kit.bars.push(
        x,
        top,
        z,
        width,
        h.hp / h.maxHp,
        Math.min(1, shield / h.maxHp),
        cast,
        rec.flash,
        ENEMY_BAR,
        flags,
      );
    }
  }

  private weaverExtras(rec: EntityRec, e: ReadonlyEntity, kit: FxKit, dt: number): void {
    const w = e.weaver!;
    const x = rec.x;
    const z = rec.z;
    kit.rings.push(x, 0.03, z, rec.radius * 1.5, 0.07, 0.2, RING.plain, C.gold, 0.6);
    // Resonance: orbiting white-gold segments (one per full 25).
    const full = Math.floor(w.resonance / 25);
    const partial = (w.resonance % 25) / 25;
    for (let i = 0; i < 4; i++) {
      const a = this.now * 1.6 + (i * Math.PI) / 2;
      const r = 0.85;
      const lit = i < full ? 1 : i === full ? partial * 0.6 : 0.08;
      kit.sprites.push(
        x + Math.cos(a) * r,
        1.25 + Math.sin(this.now * 2 + i) * 0.08,
        z + Math.sin(a) * r,
        i < full ? 0.2 : 0.13,
        i < full ? SPRITE.star : SPRITE.glow,
        C.resonance,
        lit,
      );
    }
    // Ribbons: sample the hand's path and trail three flowing ribbons behind.
    this.histTimer += dt;
    const fx = -Math.sin(rec.yaw);
    const fz = -Math.cos(rec.yaw);
    const ax = x - fx * 0.18;
    const az = z - fz * 0.18;
    const hx = this.hist[0];
    const hz = this.hist[2];
    const moved = Math.hypot(ax - hx, az - hz);
    if (this.histCount === 0 || moved > 0.08 || this.histTimer > 1 / 30) {
      this.histTimer = 0;
      this.hist.copyWithin(3, 0, (HIST - 1) * 3);
      this.hist[0] = ax;
      this.hist[1] = rec.y;
      this.hist[2] = az;
      this.histCount = Math.min(HIST, this.histCount + 1);
    }
    if (this.histCount < 3) return;
    const sideX = -fz;
    const sideZ = fx;
    for (let r = 0; r < 3; r++) {
      const off = (r - 1) * 0.16;
      const baseY = 1.12 - r * 0.12;
      const c = r === 1 ? C.goldHot : C.gold;
      kit.ribbons.beginStrip();
      const n = Math.min(this.histCount, 18 + r * 3);
      for (let k = 0; k < n; k++) {
        const t = k / (n - 1);
        const px = this.hist[k * 3] + sideX * off * (1 + t);
        const pz = this.hist[k * 3 + 2] + sideZ * off * (1 + t);
        const flutter = Math.sin(this.now * 5 + k * 0.55 + r * 2) * 0.09 * t;
        const droop = t * 0.75;
        kit.ribbons.point(
          px - fx * t * 0.55 + sideX * flutter,
          this.hist[k * 3 + 1] + baseY - droop + Math.sin(this.now * 3.3 + k * 0.4 + r) * 0.06 * t,
          pz - fz * t * 0.55 + sideZ * flutter,
          0.075 * (1 - t * 0.7),
          c,
          (1 - t) * 0.85,
          t * 2,
        );
      }
      kit.ribbons.endStrip();
    }
  }

  private shields(rec: EntityRec, e: ReadonlyEntity, state: WorldState, kit: FxKit): void {
    const h = e.health!;
    if (h.dead || h.shields.length === 0) return;
    const x = rec.x;
    const z = rec.z;
    const time = state.time;
    for (const s of h.shields) {
      // A Ward's `appliedAt` waits with the enemies during Stasis (Perfect timing is in their
      // time), so its pop is timed from when render first saw it: a Ward cast in Stasis pops
      // and settles like any other. Every other shield keeps its own clock.
      let age = time - s.appliedAt;
      if (s.kind === 'ward') {
        if (rec.wardRef !== s) {
          rec.wardRef = s;
          rec.wardSeen = Math.min(time, s.appliedAt);
        }
        age = time - rec.wardSeen;
      }
      const pop = age < 0.3 ? 1 - age / 0.3 : 0;
      const left = s.expiresAt - time;
      const fade = left < 0.6 ? clamp01(left / 0.6) : 1;
      const crack = s.max > 0 ? clamp01(1 - s.amount / s.max) : 0;
      const sc = 1 + pop * 0.3;
      const r = rec.radius;
      const hh = rec.height;
      switch (s.kind) {
        case 'ward':
          kit.shells.push(
            x,
            hh * 0.5 + rec.y,
            z,
            r * 1.6 * sc,
            hh * 0.62 * sc,
            r * 1.6 * sc,
            SHELL.ward,
            C.shield,
            0.95 * fade,
            crack,
            pop,
            false,
            rec.id,
          );
          break;
        case 'dome':
          kit.shells.push(
            x,
            0,
            z,
            r * 2.1 * sc,
            r * 2.4 * sc,
            r * 2.1 * sc,
            SHELL.dome,
            C.dome,
            0.8 * fade,
            crack,
            pop,
            true,
            rec.id,
          );
          break;
        case 'barrier':
          kit.shells.push(
            x,
            hh * 0.5 + rec.y,
            z,
            r * 1.35,
            hh * 0.56,
            r * 1.35,
            SHELL.barrier,
            C.shield,
            0.7 * fade,
            crack,
            pop * 0.3,
            false,
            rec.id,
          );
          break;
        case 'overshield':
          kit.shells.push(
            x,
            hh * 0.5 + rec.y,
            z,
            r * 1.5 * sc,
            hh * 0.6 * sc,
            r * 1.5 * sc,
            SHELL.overshield,
            C.amp,
            0.6 * fade,
            crack,
            pop * 0.5,
            false,
            rec.id,
          );
          break;
        case 'discord':
          kit.shells.push(
            x,
            hh * 0.5 + rec.y,
            z,
            r * 1.55,
            hh * 0.62,
            r * 1.55,
            SHELL.discord,
            C.discord,
            0.85 * fade,
            crack,
            pop,
            false,
            rec.id,
          );
          break;
      }
    }
  }

  private ailments(rec: EntityRec, e: ReadonlyEntity, kit: FxKit, dt: number): void {
    const h = e.health!;
    if (h.dead || h.statuses.length === 0) return;
    let ailing = false;
    let stunned = false;
    let immune = false;
    for (const s of h.statuses) {
      if (AILMENTS.has(s.id)) ailing = true;
      if (s.id === 'stun' || s.id === 'stagger') stunned = true;
      if (s.id === 'immune') immune = true;
    }
    const x = rec.x;
    const z = rec.z;
    if (ailing && rec.kind !== 'enemy') {
      // Violet dripping smoke.
      rec.smokeAcc += dt * 16 * kit.smoke.density;
      while (rec.smokeAcc > 1) {
        rec.smokeAcc -= 1;
        const a = Math.random() * Math.PI * 2;
        const r = rec.radius * 0.7 * Math.random();
        kit.smoke.emit(
          x + Math.cos(a) * r,
          rec.height * (0.5 + Math.random() * 0.5) + rec.y,
          z + Math.sin(a) * r,
          0,
          -0.35,
          0,
          1.1,
          0.35,
          C.ailment,
          0.55,
          PARTICLE.smoke,
          0.8,
          0.15,
          0.25,
        );
      }
    }
    if (stunned) {
      for (let i = 0; i < 3; i++) {
        const a = this.now * 5 + (i * Math.PI * 2) / 3;
        kit.sprites.push(
          x + Math.cos(a) * rec.radius * 0.8,
          rec.height + 0.15 + rec.y,
          z + Math.sin(a) * rec.radius * 0.8,
          0.14,
          SPRITE.star,
          C.goldHot,
          0.9,
        );
      }
    }
    if (immune) {
      this.tmpColor.copy(C.white).lerp(C.ailment, 0.3);
      kit.rings.push(
        x,
        rec.height * 0.5 + rec.y,
        z,
        rec.radius * 1.2,
        0.03,
        0.08,
        RING.dashed,
        this.tmpColor,
        0.5,
        0,
        7,
        0,
        6,
      );
    }
  }

  private updateGhosts(kit: FxKit, dt: number): void {
    for (const g of this.ghosts) {
      if (!g.active || !g.batch) continue;
      g.age += dt;
      if (g.age < 0) continue;
      const t = g.age / g.life;
      if (t >= 1) {
        g.active = false;
        continue;
      }
      if (g.save) {
        this.updateSaveGhost(g, t, kit);
        continue;
      }
      if (g.chrono === 1) {
        // Rewind's afterimage: left behind along the streak, a silver ghost dissolving upward.
        const m = this.compose(g.x, t * 0.12, g.z, g.yaw, 0, 0, 1);
        g.batch.push(m, 0.5 * (1 - t), 0.25 + t * 0.75, 0.9, 0.7, CHRONO_SILVER, 1.1, 0, 0, 1);
        continue;
      }
      if (g.chrono === 2) {
        this.updateUnfall(g, t, kit);
        continue;
      }
      this.e.set(-0.35, g.yaw, 0, 'YXZ');
      this.q.setFromEuler(this.e);
      this.p.set(g.x, 0, g.z);
      this.s.set(1, 1, 1);
      this.m.compose(this.p, this.q, this.s);
      g.batch.push(this.m, 0.7 * (1 - t), 0.15 + t * 0.85, 0, 0.55, C.gold, 1.2);
    }
  }

  /**
   * Rewind standing a downed hero up: their fall played backwards. The body lies where it fell,
   * lifts (0–0.45) while running back to where they stood, and dissolves into the hero there.
   */
  private updateUnfall(g: Ghost, t: number, kit: FxKit): void {
    const rise = clamp01(t / 0.7);
    const up = rise * rise * (3 - 2 * rise);
    const run = clamp01((t - 0.08) / 0.62);
    const mv = run * run * (3 - 2 * run);
    const x = g.x + (g.x2 - g.x) * mv;
    const z = g.z + (g.z2 - g.z) * mv;
    const pitch = (Math.PI / 2 - 0.12) * (1 - up);
    const roll = g.side * 0.22 * (1 - up);
    const y = g.radius * 0.35 * (1 - up);
    const m = this.compose(x, y, z, g.yaw, pitch, roll, 1);
    const dissolve = 0.1 + clamp01((t - 0.65) / 0.35) * 0.9;
    g.batch!.push(m, 0.4 * (1 - t), dissolve, 0.85, 0.55, CHRONO_SILVER, 1.4, 0, 0, 1);
    kit.sprites.push(
      x,
      0.5 + up * 0.5,
      z,
      g.radius * 2.4,
      SPRITE.glow,
      CHRONO_SILVER,
      0.4 * (1 - t),
    );
  }

  /** The ghost buckles (0–0.2), topples onto its back (0.2–0.6) and dissolves in gold. */
  private updateSaveGhost(g: Ghost, t: number, kit: FxKit): void {
    const buckle = clamp01(t / 0.2);
    const fallT = clamp01((t - 0.12) / 0.48);
    const fall = fallT * fallT * (3 - 2 * fallT);
    // Knees buckle forward, then it topples onto its back (positive pitch), a little sideways.
    const pitch = fall * (Math.PI / 2 - 0.12) - buckle * 0.2 * (1 - fall);
    const roll = g.side * fall * 0.22;
    const fx = -Math.sin(g.yaw);
    const fz = -Math.cos(g.yaw);
    const slide = fall * 0.35;
    const y =
      -buckle * 0.12 * (1 - fall) + fall * g.radius * 0.35 - clamp01((t - 0.6) / 0.4) * 0.15;
    const m = this.compose(g.x - fx * slide, y, g.z - fz * slide, g.yaw, pitch, roll, 1 + t * 0.04);
    const dissolve = 0.04 + clamp01((t - 0.5) / 0.5) * 0.96;
    const flash = t < 0.15 ? (1 - t / 0.15) * 0.8 : 0;
    g.batch!.push(m, flash, dissolve, 0.7, 0.4, C.gold, 0.7 + (1 - t) * 0.7);
    // A pale glow lingers on the body as it goes down.
    const bx = g.x - fx * slide * 1.8;
    const bz = g.z - fz * slide * 1.8;
    kit.sprites.push(
      bx,
      0.5 + (1 - fall) * 0.5,
      bz,
      g.radius * 2.6,
      SPRITE.glow,
      GHOST_ASH,
      0.45 * (1 - t),
    );
    // Its shadow fades with it; an ashen ring marks where it would have lain.
    kit.shadows.push(
      g.x,
      0.016,
      g.z,
      g.radius * 1.4,
      0,
      0,
      RING.soft,
      BLACK,
      0.4 * (1 - t),
      0,
      7,
      1,
    );
    kit.rings.push(
      g.x - fx * slide * 2,
      0.03,
      g.z - fz * slide * 2,
      g.radius * (1.2 + fall * 0.9),
      0.05,
      0.18,
      RING.plain,
      GHOST_ASH,
      0.55 * fall * (1 - t),
    );
  }

  dispose(): void {
    for (const b of this.batches.values()) b.dispose();
    this.batches.clear();
    this.crown.dispose();
    this.recs.clear();
    this.group.removeFromParent();
  }
}
