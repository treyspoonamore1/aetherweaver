import * as THREE from 'three';
import type { ColorVision } from '../app/colorVision';
import { auraDef } from '../content';
import type { EntityId, WorldState } from '../sim';
import type { EntityLayer } from './entities';
import type { FxKit } from './fx/kit';
import { PARTICLE } from './fx/particles';
import { RING } from './fx/rings';
import { SPRITE } from './fx/sprites';
import { threadLookHex } from './keepsakeCues';
import type { Overlay } from './overlay';
import { BORNE_TRAVEL, MARTYR_HEX } from './martyrCues';
import { C, approach, auraColor, color, currentVision, rgba } from './palette';
import { POUR_TRAVEL, SONG_GLYPH, beamSong, focusLabel, focusLevel, isAllIn } from './songs';

const N = 30;
const PULSES = 6;
/** Pulses running back along the Thread, hero → Weaver (the Martyr's Bear, Covenant's return). */
const BACK = 8;
const BEAR_HOT = color(MARTYR_HEX.bloodHot);
const ROSE = color(MARTYR_HEX.rose);
const OLD_GOLD = color(MARTYR_HEX.oldGold);
/** The pour splashes on the hero after `POUR_TRAVEL` and is over after this long. */
const POUR_LIFE = 1.1;
/**
 * A Thread look's beads (Phase 4g): the mode's colour flowing along the Thread from the Weaver's
 * hand to the hero, this far apart (m), this fast (m/s), at most this many, and how big and bright
 * (a sprite's size, over the core strand's half-width).
 */
export const BEAD_SPACING = 0.6;
export const BEAD_SPEED = 1.1;
const MAX_BEADS = 24;
const BEAD_SIZE = 0.09;
const BEAD_ALPHA = 0.95;
/** Beads fade in leaving her hand and out reaching the hero over this much of the Thread (m). */
const BEAD_EDGE = 0.35;

/**
 * The mode glyph over the threaded hero (docs/thread-dial.md): its half-size (m), its lift over
 * the head (m, under a call's bubble), and how long a switch's pop lasts (s).
 */
const GLYPH_SIZE = 0.4;
const GLYPH_LIFT = 1.05;
const GLYPH_POP = 0.35;

/** Where the Thread leaves from: the Weaver as drawn (her hand is found from her pose). */
export interface ThreadFrom {
  x: number;
  y: number;
  z: number;
  yaw: number;
}

/** Where the Thread arrives: the hero as drawn (their chest, their size). */
export interface ThreadTo {
  x: number;
  y: number;
  z: number;
  height: number;
  radius: number;
}

/** The Weaver's weaving hand, where the Thread leaves from (relics.ts reuses it). */
export function weaverHand(
  wr: { x: number; y: number; z: number; yaw: number },
  out: { x: number; y: number; z: number },
): { x: number; y: number; z: number } {
  const fx = -Math.sin(wr.yaw);
  const fz = -Math.cos(wr.yaw);
  out.x = wr.x - fz * 0.3 + fx * 0.26;
  out.y = 1.02 + wr.y;
  out.z = wr.z + fx * 0.3 + fz * 0.26;
  return out;
}

/**
 * ThreadView (docs/plan/05 §5.3): a camera-facing ribbon along a spline from the Weaver's hand
 * to the threaded hero's chest. Sags when slack, goes straight and thin when taut with a
 * high-frequency shimmer near snapping, sends visible pulses on every heal/amp tick, whips on
 * attach and bursts into strands when it snaps. Mend teal, Empower gold.
 *
 * Phase 3: the beam song rides the Thread. Whenever Chord I has auras, an aura-coloured sheath
 * wraps the Thread and beads of song flow Weaver → hero, louder with `chord.focus` (Unison, all
 * in, adds a second sheath and more, brighter beads). When the beam moves to a hero, the song
 * **pours**: a bright head floods along the new Thread, splashes on the hero in aura colours
 * and names the strength ("♪ ×2"); the old hero's halo drains meanwhile (field.ts).
 *
 * Phase 3d: **Bear** (the Martyr) turns the Thread crimson and heavy: it sags more, its core
 * is thicker, an old-gold strand braids round it, its flow runs back toward the Weaver and
 * crimson embers drip from it. Each wound she takes runs back along it as a pulse
 * (`backPulse`), from the hero into her hand; Sanguine Covenant's return is a faint one.
 *
 * Phase 4g: **a Thread look** (`setLook`, keepsakeCues.ts) is its filament, the core strand, and
 * its glow, the halo round it, fitted to the colour vision. The mode keeps what says which it is:
 * beads of its colour flow along the Thread from her hand to the hero, its pulses run in it, and
 * both ends glow in it (with the hero's rim, ring and motes or sparks, entities.ts and below).
 * Bear's crimson still takes the whole Thread. No look: the mode's colour all through, as before.
 */
export class ThreadView {
  private readonly pulses = new Float32Array(PULSES).fill(-10);
  private pulseCursor = 0;
  /** Back pulses: start time, strength (0..1.4), kind (0 Bear, 1 Covenant's return). */
  private readonly backAt = new Float32Array(BACK).fill(-10);
  private readonly backK = new Float32Array(BACK);
  private readonly backKind = new Uint8Array(BACK);
  private backCursor = 0;
  /** Bear, smoothed 0..1 (colour, weight, braid). */
  private bear = 0;
  /** The flow's phase: forward in Mend / Empower, back toward the Weaver in Bear. */
  private flowCore = 0;
  private flowHalo = 0;
  private dripAcc = 0;
  private readonly tmpCol = new THREE.Color();
  /** Back pulses started (tests and the lab read it). */
  backFired = 0;
  private whipAt = -10;
  private whipSign = 1;
  private mix = 0;
  private current: EntityId | null = null;
  private readonly col = new THREE.Color();
  private readonly core = new THREE.Color();
  private readonly pts = new Float32Array((N + 1) * 3);
  private hasPath = false;
  private now = 0;
  private visible = 0;
  private songA: THREE.Color | null = null;
  private songB: THREE.Color | null = null;
  private song = 0;
  private songLevel = 0;
  private songAllIn = false;
  private pourAt = -10;
  private pourSplashed = true;
  private readonly pourA = new THREE.Color();
  private readonly pourB = new THREE.Color();
  private readonly hand = { x: 0, y: 0, z: 0 };
  private pourLabel = '';
  private pourHex = '#ffffff';
  /**
   * The Thread look worn (content id; null: none) and the colour vision its filament and glow
   * were fitted to (null: fit them on the next frame). `halo` and `body` are this frame's halo and
   * core strand colours: the look's, or the mode's without one.
   */
  private lookId: string | null = null;
  private lookVision: ColorVision | null = null;
  private lookFilament: THREE.Color | null = null;
  private lookGlow: THREE.Color | null = null;
  private readonly halo = new THREE.Color();
  private readonly body = new THREE.Color();
  /** How far the nearest bead has flowed from her hand (m, under `BEAD_SPACING`). */
  private beadFlow = 0;
  /** Beads drawn last frame (tests, the lab). */
  beadsDrawn = 0;
  /** The mode drawn last frame (null: none yet) and when it last switched, for the glyph's pop. */
  private glyphMode: 'mend' | 'empower' | 'bear' | null = null;
  private glyphAt = -10;
  private readonly glyphCol = new THREE.Color();
  /**
   * The mode's glyph over the hero last frame (tests, the lab; null: none): its shape (0 Mend's
   * plus … 1 Empower's star), how much of it is Bear's drop, and its size (it pops on a switch).
   */
  glyphDrawn: { morph: number; bear: number; size: number } | null = null;

  constructor(
    private readonly entities: Pick<EntityLayer, 'recs'>,
    private readonly overlay: Overlay | null = null,
  ) {}

  /** The Thread look worn (its content id; null: none). Cheap when unchanged: called every frame. */
  setLook(id: string | null): void {
    if (id === this.lookId) return;
    this.lookId = id;
    this.lookVision = null;
  }

  /** The look's filament and glow as the colour vision sees them (only when either changes). */
  private fitLook(): void {
    const vision = currentVision();
    if (vision === this.lookVision) return;
    this.lookVision = vision;
    const hex = threadLookHex(this.lookId, vision);
    this.lookFilament = hex ? color(hex.filament) : null;
    this.lookGlow = hex ? color(hex.glow) : null;
  }

  /** This frame's colours (tests, the lab): the halo, the core strand, and the mode's own. */
  get haloColor(): THREE.Color {
    return this.halo;
  }

  get filamentColor(): THREE.Color {
    return this.body;
  }

  get modeColor(): THREE.Color {
    return this.col;
  }

  pulse(): void {
    this.pulses[this.pulseCursor] = this.now;
    this.pulseCursor = (this.pulseCursor + 1) % PULSES;
  }

  /**
   * The mode's glyph over the threaded hero (docs/thread-dial.md), as the HUD's Thread dial
   * shows it: Mend's plus, Empower's four-point star, Bear's drop, in the mode's colour. A switch
   * between Mend and Empower morphs one into the other, Bear's drop fades in over it, and the
   * glyph pops and turns as it changes. It floats just over the head, under a call's bubble.
   */
  private modeGlyph(
    kit: FxKit,
    time: number,
    tr: ThreadTo,
    toEmpower: boolean,
    bearing: boolean,
    vis: number,
  ): void {
    const mode = bearing ? 'bear' : toEmpower ? 'empower' : 'mend';
    if (this.glyphMode !== null && mode !== this.glyphMode) this.glyphAt = time;
    this.glyphMode = mode;
    const age = time - this.glyphAt;
    const k = age < GLYPH_POP ? age / GLYPH_POP : 1;
    const pop = Math.sin(k * Math.PI);
    const size = GLYPH_SIZE * (1 + 0.45 * pop) * (0.4 + 0.6 * vis);
    const y = tr.height + GLYPH_LIFT + tr.y + 0.05 * Math.sin(time * 2.4);
    const turn = (1 - k) * 0.8;
    const B = this.bear;
    const a = 0.95 * vis;
    this.glyphCol.copy(C.mend).lerp(C.empower, this.mix);
    kit.spritesTop.push(
      tr.x,
      y,
      tr.z,
      size,
      SPRITE.mode,
      this.glyphCol,
      a * (1 - B),
      turn,
      1,
      this.mix,
    );
    kit.spritesTop.push(tr.x, y, tr.z, size, SPRITE.mode, C.bear, a * B, 0, 1, 2);
    this.glyphDrawn = { morph: this.mix, bear: B, size };
  }

  /**
   * A wound running back along the Thread from the hero into the Weaver's hand (`kind` 0, Bear),
   * or Sanguine Covenant's faint return (`kind` 1). It arrives after `BORNE_TRAVEL`.
   */
  backPulse(strength: number, kind: 0 | 1 = 0): void {
    const i = this.backCursor;
    this.backAt[i] = this.now;
    this.backK[i] = Math.max(0.2, Math.min(1.4, strength));
    this.backKind[i] = kind;
    this.backCursor = (i + 1) % BACK;
    this.backFired++;
  }

  /** The Thread is drawn (it has a path this frame). */
  get drawn(): boolean {
    return this.hasPath;
  }

  /** Bear's weight on the Thread now, 0..1 (tests). */
  get bearLevel(): number {
    return this.bear;
  }

  attach(): void {
    this.whipAt = this.now;
    this.whipSign = -this.whipSign;
    this.visible = 0.2;
  }

  /** Bursts the last path into strands of light (its filament's, with a look). */
  snap(kit: FxKit): void {
    if (!this.hasPath) return;
    for (let i = 0; i <= N; i += 2) {
      const x = this.pts[i * 3];
      const y = this.pts[i * 3 + 1];
      const z = this.pts[i * 3 + 2];
      kit.particles.emit(
        x,
        y,
        z,
        (Math.random() - 0.5) * 3,
        1 + Math.random() * 2,
        (Math.random() - 0.5) * 3,
        0.6,
        0.14,
        this.body,
        1,
        PARTICLE.spark,
        2.2,
        4,
      );
      kit.particles.emit(
        x,
        y,
        z,
        (Math.random() - 0.5) * 1.5,
        Math.random(),
        (Math.random() - 0.5) * 1.5,
        0.9,
        0.08,
        C.white,
        0.8,
        PARTICLE.dot,
        1.5,
        1,
      );
    }
    this.hasPath = false;
  }

  sync(state: WorldState, kit: FxKit, dt: number, time: number): void {
    this.now = time;
    const weaver = state.entities.get(state.weaverId);
    const w = weaver?.weaver;
    const wr = this.entities.recs.get(state.weaverId);
    const targetId = w && w.threadSlot !== null ? (state.party[w.threadSlot] ?? null) : null;
    const tr = targetId === null ? undefined : this.entities.recs.get(targetId);
    if (targetId !== this.current) {
      this.current = targetId;
      if (targetId !== null) {
        this.attach();
        this.startPour(state);
      }
    }
    if (!w || !wr || !tr) {
      this.hasPath = false;
      this.glyphDrawn = null;
      return;
    }
    const toEmpower =
      w.threadMode === 'bear' ? w.lastMode === 'empower' : w.threadMode === 'empower';
    this.findSong(state, targetId);
    this.draw(
      kit,
      dt,
      time,
      wr,
      tr,
      toEmpower,
      w.threadMode === 'bear',
      w.threadTension,
      state.field.suppressed,
    );
  }

  /**
   * Draws the Thread from the Weaver's weaving hand to the hero's chest: in Empower (else Mend),
   * under Bear, this taut (0..1), the beam song hushed (a Mute's dome). `sync` draws it from the
   * state; the lab's lineup of looks draws through it too, with no song (the state finds that).
   */
  draw(
    kit: FxKit,
    dt: number,
    time: number,
    wr: ThreadFrom,
    tr: ThreadTo,
    toEmpower: boolean,
    bearing: boolean,
    tension: number,
    hushed = false,
  ): void {
    this.now = time;
    this.visible = Math.min(1, this.visible + dt * 6);
    this.mix = approach(this.mix, toEmpower ? 1 : 0, 10, dt);
    this.bear = approach(this.bear, bearing ? 1 : 0, 8, dt);
    if (this.bear < 0.002) this.bear = 0;
    const B = this.bear;
    this.col.copy(C.mend).lerp(C.empower, this.mix).lerp(C.bear, B);
    // Bear's core glows warm rose, not white, so the crimson holds.
    this.core
      .copy(this.col)
      .lerp(C.white, 0.55 * (1 - B))
      .lerp(BEAR_HOT, 0.3 * B);
    // A look: its glow round the Thread and its filament at its heart (Bear's crimson takes both).
    this.fitLook();
    const look = this.lookFilament !== null;
    this.halo.copy(this.lookGlow ?? this.col).lerp(C.bear, look ? B : 0);
    this.body.copy(this.lookFilament ?? this.col).lerp(C.bear, look ? B : 0);
    // Mend and Empower flow out to the hero; Bear's flows back to the Weaver.
    this.flowCore += dt * (-3 + 4.4 * B);
    this.flowHalo += dt * (-1.4 + 2.2 * B);

    // Endpoints: the Weaver's weaving hand → the hero's chest.
    weaverHand(wr, this.hand);
    const ax = this.hand.x;
    const ay = this.hand.y;
    const az = this.hand.z;
    const bx = tr.x;
    const by = tr.height * 0.58 + tr.y;
    const bz = tr.z;
    const dx = bx - ax;
    const dz = bz - az;
    const len = Math.hypot(dx, dz) || 1;
    const px = -dz / len;
    const pz = dx / len;
    // Bear is heavy: it hangs lower, even pulled taut.
    const sag =
      (1 - tension) * Math.min(1.1, len * 0.09) * (1 + 0.45 * B) +
      0.05 +
      B * (0.12 + 0.1 * (1 - tension));
    const whipAge = time - this.whipAt;
    const whip =
      whipAge < 0.35 ? (1 - whipAge / 0.35) ** 2 * Math.min(2, len * 0.25) * this.whipSign : 0;
    const shimmer = tension > 0.55 ? (tension - 0.55) / 0.45 : 0;

    // Quadratic Bezier with a lifted, sagging control point.
    const cx = (ax + bx) / 2;
    const cy = (ay + by) / 2 + 0.5 - sag * 2;
    const cz = (az + bz) / 2;
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const u = 1 - t;
      let x = u * u * ax + 2 * u * t * cx + t * t * bx;
      let y = u * u * ay + 2 * u * t * cy + t * t * by;
      let z = u * u * az + 2 * u * t * cz + t * t * bz;
      const env = Math.sin(Math.PI * t);
      if (whip !== 0) {
        const wave = Math.sin(t * Math.PI * 2 - whipAge * 32) * env * whip;
        x += px * wave;
        z += pz * wave;
        y += wave * 0.3;
      }
      if (shimmer > 0) {
        const j = Math.sin(time * 90 + i * 2.7) * 0.06 * shimmer * env;
        x += px * j;
        z += pz * j;
        y += Math.cos(time * 77 + i * 1.9) * 0.04 * shimmer * env;
      }
      this.pts[i * 3] = x;
      this.pts[i * 3 + 1] = y;
      this.pts[i * 3 + 2] = z;
    }
    this.hasPath = true;

    const baseW = (0.075 - 0.04 * tension) * (1 + shimmer * 0.3) * (1 + 0.5 * B);
    const vis = this.visible;
    // A look shows its glow more, and whitens its filament less, so its hues hold.
    const L = look ? 1 - B : 0;
    // Halo strand.
    kit.ribbons.beginStrip();
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const p = this.pulseAt(t, time) + this.backSwell(t, time);
      kit.ribbons.point(
        this.pts[i * 3],
        this.pts[i * 3 + 1],
        this.pts[i * 3 + 2],
        baseW * (3.2 + 3 * B) * (1 + p * 0.8),
        this.halo,
        (0.22 + 0.26 * L + 0.4 * B + p * 0.5) * vis * (1 - shimmer * 0.3 * Math.random()),
        t * len * 0.35 + this.flowHalo,
        0.35 * (1 - 0.85 * B),
      );
    }
    kit.ribbons.endStrip();
    // Core strand.
    kit.ribbons.beginStrip();
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const p = this.pulseAt(t, time) + this.backSwell(t, time);
      kit.ribbons.point(
        this.pts[i * 3],
        this.pts[i * 3 + 1],
        this.pts[i * 3 + 2],
        baseW * (1 + p * 1.6),
        // A pulse runs in the mode's colour, a look's filament or not.
        p > 0.3 ? this.core : this.body,
        (0.9 + p) * (1 - 0.2 * B) * vis,
        t * len * 0.6 + this.flowCore,
        // Bear's core stays crimson (a white core would turn it pink).
        0.35 * (1 - 0.8 * B) * (1 - 0.5 * L),
      );
    }
    kit.ribbons.endStrip();
    if (B > 0.02) this.bearBraid(kit, dt, len, px, pz, baseW, vis);
    // A look's beads: the mode's colour flowing out along it (Bear has its own braid and flow).
    if (look) this.beads(kit, dt, len, baseW, vis * (1 - B));
    else this.beadsDrawn = 0;
    // The beam song rides the Thread: an aura-coloured sheath and beads of song flowing from
    // the Weaver to the hero, louder with the focus (all in: a second sheath, more beads).
    this.song = approach(this.song, this.songA ? 1 : 0, 8, dt);
    const ua = this.songA;
    if (ua && this.song > 0.02) {
      const ub = this.songB ?? ua;
      const lv = this.songLevel;
      const allIn = this.songAllIn;
      const u = this.song * vis * (hushed ? 0.35 : 1);
      const pourAge = time - this.pourAt;
      const head = pourAge < POUR_TRAVEL ? pourAge / POUR_TRAVEL : 2;
      kit.ribbons.beginStrip();
      for (let i = 0; i <= N; i++) {
        const t = i / N;
        // During the pour the sheath fills in behind the travelling head.
        const filled = head > 1 ? 1 : t <= head ? 1 : 0.15;
        const surge = head <= 1 ? Math.exp(-(((t - head) / 0.08) ** 2)) : 0;
        kit.ribbons.point(
          this.pts[i * 3],
          this.pts[i * 3 + 1],
          this.pts[i * 3 + 2],
          baseW * (4 + 2.5 * lv) * (1 + surge * 1.5),
          (i & 4) === 0 ? ua : ub,
          (0.1 + 0.12 * lv) * u * filled * (0.6 + 0.4 * Math.sin(t * 9 - time * 5)) + surge * 0.6,
          t * len * 0.25 - time * 2,
        );
      }
      kit.ribbons.endStrip();
      if (allIn) {
        kit.ribbons.beginStrip();
        for (let i = 0; i <= N; i++) {
          const t = i / N;
          kit.ribbons.point(
            this.pts[i * 3],
            this.pts[i * 3 + 1],
            this.pts[i * 3 + 2],
            baseW * 9,
            (i & 4) === 0 ? ub : ua,
            0.07 * u * (0.5 + 0.5 * Math.sin(t * 5 + time * 3)),
            t * len * 0.15 - time * 1.2,
          );
        }
        kit.ribbons.endStrip();
      }
      const beads = allIn ? 8 : 4;
      const speed = 0.4 + 0.25 * lv;
      for (let k = 0; k < beads; k++) {
        const t = (time * speed + k / beads) % 1;
        if (head <= 1 && t > head) continue;
        const i = Math.min(N, Math.round(t * N));
        kit.sprites.push(
          this.pts[i * 3],
          this.pts[i * 3 + 1],
          this.pts[i * 3 + 2],
          0.12 + 0.08 * lv,
          SPRITE.diamond,
          k % 2 === 0 ? ua : ub,
          (0.6 + 0.35 * Math.min(1, lv)) * u * Math.sin(Math.PI * t),
        );
      }
    }
    this.pour(kit, time, tr);
    // Pulse heads as glows.
    for (let k = 0; k < PULSES; k++) {
      const age = time - this.pulses[k];
      const t = age / 0.45;
      if (t < 0 || t > 1) continue;
      const i = Math.min(N, Math.round(t * N));
      kit.sprites.push(
        this.pts[i * 3],
        this.pts[i * 3 + 1],
        this.pts[i * 3 + 2],
        0.28,
        0,
        this.core,
        0.8 * (1 - t * 0.5),
      );
    }
    this.backHeads(kit, time);
    // Endpoint glows, in the mode's colour (a little stronger when a look wears the strands).
    kit.sprites.push(ax, ay, az, 0.22 + 0.04 * L, 0, this.core, (0.7 + 0.15 * L) * vis);
    kit.sprites.push(
      bx,
      by,
      bz,
      0.3 + 0.1 * Math.sin(time * 6),
      0,
      this.col,
      (0.55 + 0.2 * L) * vis,
    );
    this.modeGlyph(kit, time, tr, toEmpower, bearing, vis);
    // Mend: teal motes drift up off the hero. Empower: gold sparks. Bear: embers sink.
    if (Math.random() < dt * 10 * kit.particles.density) {
      const sink = B > 0.5;
      kit.particles.emit(
        bx + (Math.random() - 0.5) * 0.6,
        by - 0.3,
        bz + (Math.random() - 0.5) * 0.6,
        0,
        sink ? -0.15 : 1.2,
        0,
        0.9,
        0.11,
        this.col,
        0.9,
        sink ? PARTICLE.dot : this.mix > 0.5 ? PARTICLE.spark : PARTICLE.dot,
        0.6,
        sink ? 0.9 : -0.2,
      );
    }
  }

  /**
   * A look's beads: the mode's colour flowing out along the Thread from her hand to the hero,
   * `BEAD_SPACING` apart at `BEAD_SPEED`, each a little wider than the core strand. They keep their
   * place in metres from her hand, so a Thread growing or shrinking never shuffles them; they fade
   * in leaving her hand and out reaching the hero.
   */
  private beads(kit: FxKit, dt: number, len: number, baseW: number, alpha: number): void {
    this.beadsDrawn = 0;
    this.beadFlow = (this.beadFlow + dt * BEAD_SPEED) % BEAD_SPACING;
    if (alpha <= 0.02) return;
    const size = BEAD_SIZE + baseW * 1.4;
    for (let d = this.beadFlow; d < len && this.beadsDrawn < MAX_BEADS; d += BEAD_SPACING) {
      // Along the curve by its parameter: near enough even for a Thread's gentle sag.
      const f = (d / len) * N;
      const i = Math.min(N - 1, Math.floor(f));
      const u = f - i;
      const o = i * 3;
      const edge = Math.min(1, d / BEAD_EDGE, (len - d) / BEAD_EDGE);
      kit.sprites.push(
        this.pts[o] + (this.pts[o + 3] - this.pts[o]) * u,
        this.pts[o + 1] + (this.pts[o + 4] - this.pts[o + 1]) * u,
        this.pts[o + 2] + (this.pts[o + 5] - this.pts[o + 2]) * u,
        size,
        SPRITE.glow,
        this.col,
        BEAD_ALPHA * alpha * edge,
      );
      this.beadsDrawn++;
    }
  }

  /** Bear: an old-gold strand braided round the crimson core, and embers dripping from it. */
  private bearBraid(
    kit: FxKit,
    dt: number,
    len: number,
    px: number,
    pz: number,
    baseW: number,
    vis: number,
  ): void {
    const B = this.bear;
    const turns = Math.max(1.5, len * 0.45);
    kit.ribbons.beginStrip();
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const env = Math.sin(Math.PI * t);
      const a = t * turns * Math.PI * 2 + this.flowCore * 1.3;
      const r = (0.09 + baseW) * (0.3 + 0.7 * env);
      kit.ribbons.point(
        this.pts[i * 3] + px * Math.sin(a) * r,
        this.pts[i * 3 + 1] + Math.cos(a) * r,
        this.pts[i * 3 + 2] + pz * Math.sin(a) * r,
        baseW * 0.8 + 0.008,
        OLD_GOLD,
        B * vis * (0.6 + 0.4 * Math.cos(a)),
        t * len * 0.5 + this.flowCore,
      );
    }
    kit.ribbons.endStrip();
    // Embers drip off the heavy Thread (glowing, small: never blood).
    this.dripAcc += dt * 7 * B * kit.particles.density;
    while (this.dripAcc > 1) {
      this.dripAcc -= 1;
      const i = 3 + Math.floor(Math.random() * (N - 6));
      const gold = Math.random() < 0.3;
      kit.particles.emit(
        this.pts[i * 3],
        this.pts[i * 3 + 1] - 0.03,
        this.pts[i * 3 + 2],
        (Math.random() - 0.5) * 0.15,
        -0.3,
        (Math.random() - 0.5) * 0.15,
        0.7 + Math.random() * 0.3,
        gold ? 0.07 : 0.09,
        gold ? OLD_GOLD : BEAR_HOT,
        0.85,
        PARTICLE.dot,
        0.3,
        2.2,
      );
    }
  }

  /** The heads of the pulses running back to the Weaver. */
  private backHeads(kit: FxKit, time: number): void {
    for (let k = 0; k < BACK; k++) {
      const age = time - this.backAt[k]!;
      if (age < 0 || age > BORNE_TRAVEL) continue;
      const t = 1 - age / BORNE_TRAVEL;
      const i = Math.min(N, Math.max(0, Math.round(t * N)));
      const s = this.backK[k]!;
      const x = this.pts[i * 3];
      const y = this.pts[i * 3 + 1];
      const z = this.pts[i * 3 + 2];
      if (this.backKind[k] === 1) {
        // Sanguine Covenant: a faint return of the Mend, rose-tinged.
        this.tmpCol.copy(C.mend).lerp(ROSE, 0.45);
        kit.sprites.push(x, y, z, 0.24, SPRITE.glow, this.tmpCol, 0.55);
        continue;
      }
      kit.sprites.push(x, y, z, 0.32 + 0.36 * s, SPRITE.glow, C.bear, 0.95);
      kit.sprites.push(x, y, z, 0.14 + 0.12 * s, SPRITE.glow, ROSE, 0.9);
    }
  }

  /** How much the back pulses swell the Thread at `t` (0 at the Weaver, 1 at the hero). */
  private backSwell(t: number, time: number): number {
    let p = 0;
    for (let k = 0; k < BACK; k++) {
      const age = time - this.backAt[k]!;
      if (age < 0 || age > BORNE_TRAVEL + 0.05) continue;
      const head = 1 - age / BORNE_TRAVEL;
      const d = (t - head) / 0.08;
      p += Math.exp(-d * d) * this.backK[k]! * (this.backKind[k] === 1 ? 0.35 : 1);
    }
    return Math.min(1.6, p);
  }

  /** The beam song pouring into `heroId`, if any (colours, focus level, all in). */
  private findSong(state: WorldState, heroId: EntityId | null): void {
    this.songA = null;
    this.songB = null;
    if (heroId === null) return;
    const c = beamSong(state);
    if (!c || c.threadHero !== heroId) return;
    this.songA = auraColor(c.auras[0]!);
    const b = c.auras[1];
    this.songB = b ? auraColor(b) : null;
    this.songLevel = focusLevel(c.focus);
    this.songAllIn = isAllIn(c);
  }

  /** The beam just moved to a hero: if a beam song sings, it pours over. */
  private startPour(state: WorldState): void {
    const c = beamSong(state);
    if (!c) return;
    this.pourAt = this.now;
    this.pourSplashed = false;
    this.pourA.copy(auraColor(c.auras[0]!));
    this.pourB.copy(auraColor(c.auras[1] ?? c.auras[0]!));
    this.pourLabel = `${SONG_GLYPH} ${isAllIn(c) ? 'All in ' : ''}${focusLabel(c.focus)}`;
    try {
      this.pourHex = auraDef(c.auras[0]!).color;
    } catch {
      this.pourHex = '#f5d78e';
    }
  }

  /** The pour's head along the Thread, then its splash on the hero. */
  private pour(
    kit: FxKit,
    time: number,
    tr: { x: number; y: number; z: number; radius: number; height: number },
  ): void {
    const age = time - this.pourAt;
    if (age < 0 || age > POUR_LIFE) return;
    if (age < POUR_TRAVEL) {
      const t = age / POUR_TRAVEL;
      const i = Math.min(N, Math.round(t * N));
      const x = this.pts[i * 3];
      const y = this.pts[i * 3 + 1];
      const z = this.pts[i * 3 + 2];
      kit.sprites.push(x, y, z, 0.75, SPRITE.glow, this.pourA, 0.9);
      kit.sprites.push(x, y, z, 0.3, SPRITE.star, C.white, 0.9, time * 6);
      if (Math.random() < 0.8 * kit.particles.density) {
        kit.particles.emit(
          x,
          y,
          z,
          (Math.random() - 0.5) * 1.2,
          0.6 + Math.random(),
          (Math.random() - 0.5) * 1.2,
          0.5,
          0.12,
          Math.random() < 0.5 ? this.pourA : this.pourB,
          0.95,
          PARTICLE.note,
          1.5,
          -0.2,
        );
      }
      return;
    }
    // Splash: rings of the song washing out from the hero, and a burst of notes.
    const u = (age - POUR_TRAVEL) / (POUR_LIFE - POUR_TRAVEL);
    const fade = 1 - u;
    kit.rings.push(
      tr.x,
      0.05,
      tr.z,
      tr.radius * (1.2 + 3.2 * u),
      0.16 * fade + 0.03,
      0.3,
      RING.plain,
      this.pourA,
      fade,
    );
    kit.rings.push(
      tr.x,
      0.06,
      tr.z,
      tr.radius * (1 + 2.2 * u),
      0.08,
      0.2,
      RING.dashed,
      this.pourB,
      0.85 * fade,
      0,
      7,
      0,
      14,
      time,
    );
    kit.sprites.push(
      tr.x,
      tr.height * 0.55 + tr.y,
      tr.z,
      tr.radius * (2.6 + 1.6 * u),
      SPRITE.glow,
      this.pourA,
      0.55 * fade,
    );
    if (!this.pourSplashed) {
      this.pourSplashed = true;
      const y = tr.height * 0.55 + tr.y;
      kit.particles.burst(
        tr.x,
        y,
        tr.z,
        16,
        2.6,
        2.4,
        0.8,
        0.14,
        this.pourA,
        1,
        PARTICLE.note,
        2,
        -0.3,
        tr.radius,
      );
      kit.particles.burst(
        tr.x,
        y,
        tr.z,
        12,
        3.4,
        2,
        0.5,
        0.11,
        this.pourB,
        1,
        PARTICLE.spark,
        3,
        2,
        tr.radius,
      );
      this.overlay?.callout(
        tr.x,
        tr.height + 1.25 + tr.y,
        tr.z,
        this.pourLabel,
        this.pourHex,
        19,
        0.9,
        rgba(this.pourHex, 0.85),
      );
    }
  }

  private pulseAt(t: number, time: number): number {
    let p = 0;
    for (let k = 0; k < PULSES; k++) {
      const age = time - this.pulses[k];
      if (age < 0 || age > 0.5) continue;
      const head = age / 0.45;
      const d = (t - head) / 0.07;
      p += Math.exp(-d * d);
    }
    return Math.min(1.5, p);
  }
}
