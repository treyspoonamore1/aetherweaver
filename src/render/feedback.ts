import * as THREE from 'three';
import { CONTENT, enemyDef, heroDef } from '../content';
import {
  bloodlusting,
  threadSegment,
  type EntityId,
  type SimEvent,
  type SimEventOf,
  type WorldState,
} from '../sim';
import type { CallView } from './calls';
import {
  ABYSS_HEX,
  RIFT_HEX,
  SPINDLED_LABEL,
  STOLEN_VERSE_ID,
  crossing,
  cutLabel,
} from './riftCues';
import type { CameraRig } from './camera';
import type { EntityLayer, EntityRec } from './entities';
import { FERMATA_COLOR, type FermataView } from './fermata';
import type { FieldView } from './field';
import { BEAM } from './fx/beams';
import type { FxKit } from './fx/kit';
import { PARTICLE, type ParticleSystem } from './fx/particles';
import { RING } from './fx/rings';
import { SHELL } from './fx/shells';
import { SPRITE } from './fx/sprites';
import type { Overlay } from './overlay';
import { CHRONO_HEX } from './chronoCues';
import { CRUCIBLE_HEX, CrucibleCues } from './crucibleCues';
import { SerenFx, wardBlows } from './serenCues';
import { GROVE_BARK, GroveFx, SUMMON_NUMBER_SHARE } from './groveCues';
import {
  BRANN_HEX,
  CRIMSON_HEX,
  CUT_HEAL_ALPHA,
  CUT_HEAL_SIZE,
  DRAIN_SIZE,
  LIFESTEAL_MOTE,
  LIFESTEAL_MOTE_CUED,
  REFUSED_ACK_SECONDS,
  REFUSED_SECONDS,
  SPIRE_HEX,
  cuedFrenzy,
  healCut,
  materialOf,
  signalHex,
} from './crimsonCues';
import { MARTYR_HEX, crescendoKind } from './martyrCues';
import { C, VISION_HEX, auraColor, clamp01, color, currentVision, rgba } from './palette';
import {
  CALLING_HEX,
  radiantTier,
  splitRadiant,
  sunChipText,
  type RadiantSplit,
} from './callingCues';
import { REGEN_MASK, SONG_GLYPH, chipText, fieldLook, softenHex } from './songs';
import type { Stage } from './stage';
import type { TelegraphLayer } from './telegraphs';
import type { ThreadView } from './thread';
import type { FrameInfo } from './types';
import { optionsOf, useSettings } from '../app/settings';
import { fightStill } from '../ui/presentation';
import { flareScale } from './relicCues';

const enum K {
  Ring,
  Sprite,
  Beam,
  Proj,
  Shell,
  Trail,
  Portal,
  Dome,
}

interface Transient {
  active: boolean;
  kind: K;
  age: number;
  life: number;
  x: number;
  y: number;
  z: number;
  x2: number;
  y2: number;
  z2: number;
  r0: number;
  r1: number;
  th: number;
  style: number;
  color: THREE.Color;
  alpha: number;
  arcStart: number;
  arcLen: number;
  follow: EntityId;
  top: boolean;
  // Projectiles (sim-time based so they sync with hit-stop).
  visual: string;
  startSim: number;
  travelSim: number;
  target: EntityId;
  gold: boolean;
  /**
   * An enemy's projectile (the Chronomancer's Stasis holds it in the air: its clock waits, as
   * the sim's pending hit does, and it hangs where it was until time resumes).
   */
  enemy: boolean;
  /** Held by Stasis this frame, and where it hangs. */
  held: boolean;
  hx: number;
  hy: number;
  hz: number;
  /** Re-aimed from where it hung when time resumed (no arc from there). */
  rebased: boolean;
  hist: Float32Array;
  histCount: number;
}

interface Bucket {
  handle: number;
  start: number;
  amount: number;
  amplified: number;
  /** The auras' part of `amplified`. */
  aura: number;
  /** Radiance's part of `amplified` (the Luminary: the attacker shone). */
  radiance: number;
  /** Eclipse's part of `amplified` (the target stood in the light during Sunrise). */
  eclipse: number;
  absorbed: number;
  crit: boolean;
  /** A heal number the sim cut (Movement II: Wound, Bloodmoon), decided when it is fresh. */
  cut: boolean;
  /** Unravel's reversed-Mend ticks (Movement III), in the live lethal colour; set when fresh. */
  unravel: boolean;
  /**
   * Phase 5e: the part of the number that is your Ward's work (Seren's counter and kill shot,
   * beyond `amplified`), shown in the gold chip. 0 in every party without her.
   */
  ward: number;
}

function bucket(): Bucket {
  return {
    handle: -1,
    start: -10,
    amount: 0,
    amplified: 0,
    aura: 0,
    radiance: 0,
    eclipse: 0,
    absorbed: 0,
    crit: false,
    cut: false,
    unravel: false,
    ward: 0,
  };
}

const POOL = 320;
const AGG = 0.4;
/** Aura heals arrive about once a second per hero; merge only what lands together. */
const AURA_AGG = 0.25;
const SHARD = color('#f1ecf8');
const WHITE_GOLD = color('#fff4d6');
const CHIME = color('#efe6ff');
const GHOST_ASH = color('#e8e4f4');
const DUST = color('#b9b2a4');
const VISION_CALL_TEXT = '#fff3c4';
/** The Luminary's Sunrise: the key light warms toward this while it lasts. */
const SUN_LIGHT = color(CALLING_HEX.sunHot);
/** Martyr's Vow: the key light dims a little toward crimson (never Sunrise's gold swell). */
const VOW_LIGHT = color(MARTYR_HEX.blood);
/** The Chronomancer's Stasis: the light cools toward this while time is held (no gold). */
const STASIS_LIGHT = color(CHRONO_HEX.frost);
const CHRONO_SILVER = color(CHRONO_HEX.silver);
/**
 * Movement II (docs/phase-5a/vfx-audio.md): iron deaths (dark shards, ember sparks, smoke; never
 * red mist), the Bloodmoon's crimson sky, a guard's brass and its 'Blocked' grey.
 */
const IRON = color(SPIRE_HEX.iron);
const IRON_SMOKE = color(SPIRE_HEX.smoke);
const EMBER = color(CRIMSON_HEX.ember);
const BLOODMOON_SKY = color(SPIRE_HEX.bloodmoon);
const GUARD = color(CRIMSON_HEX.guard);
/** Movement III's colours (riftCues.ts). */
const BONE = color(ABYSS_HEX.bone);
const FRAY_MOTE = color(ABYSS_HEX.fray);
const CLOTH_SMOKE = color(ABYSS_HEX.smoke);
const FRAY = color(RIFT_HEX.fray);
const STRAND = color(RIFT_HEX.strand);
const POSSESS = color(RIFT_HEX.possess);
const STITCH = color(RIFT_HEX.stitch);
const MIRROR = color(RIFT_HEX.mirror);
const SWIRL = color(RIFT_HEX.swirl);
const RUNE = color(RIFT_HEX.rune);
/** The Finale's Grand Silence: the light drains toward this grey (crucibleCues.ts). */
const SILENCE_GREY = color(CRUCIBLE_HEX.silence);
/** A guard's 'Blocked' floater shows at most this often per enemy (s, render clock). */
const BLOCKED_EVERY = 0.6;

/**
 * Comfort (docs/phase-7.md, W2) as feedback's particles see it: `flare` scales their brightness
 * (`flareScale(flashes)`, 1 at full Flashes); `still` (Reduced motion On) holds them where they
 * spawn, fewer of them, with no speed and no fall; `aura` is set while an aura's or ornament's
 * own effect draws (the plant, Chorus, Fermata, an aura's heal notes), which no comfort option
 * scales, recolours or cuts (held for the owner: docs/phase-7.md, ground rule 4).
 */
export interface FxComfort {
  flare: number;
  still: boolean;
  aura: boolean;
}

/**
 * A particle system that passes everything through `real` under `fx` (no allocation per call). At
 * the defaults (flare 1, not still) every call is passed on unchanged. `flares`: false for the
 * smoke, which is dust, not light (it only holds still).
 */
export function comfortParticles(
  real: ParticleSystem,
  fx: Readonly<FxComfort>,
  flares = true,
): ParticleSystem {
  const p = Object.create(real) as ParticleSystem & { emit: unknown; burst: unknown };
  p.emit = (
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    life: number,
    size: number,
    c: THREE.Color,
    alpha: number,
    style: number = PARTICLE.dot,
    drag = 1.5,
    gravity = 0,
    grow = 0,
  ): void => {
    if (fx.aura)
      return real.emit(x, y, z, vx, vy, vz, life, size, c, alpha, style, drag, gravity, grow);
    const still = fx.still;
    real.emit(
      x,
      y,
      z,
      still ? 0 : vx,
      still ? 0 : vy,
      still ? 0 : vz,
      life,
      size,
      c,
      flares ? alpha * fx.flare : alpha,
      style,
      drag,
      still ? 0 : gravity,
      still ? 0 : grow,
    );
  };
  p.burst = (
    x: number,
    y: number,
    z: number,
    count: number,
    speed: number,
    up: number,
    life: number,
    size: number,
    c: THREE.Color,
    alpha: number,
    style: number = PARTICLE.dot,
    drag = 2.5,
    gravity = 0,
    spread = 0,
  ): void => {
    if (fx.aura)
      return real.burst(
        x,
        y,
        z,
        count,
        speed,
        up,
        life,
        size,
        c,
        alpha,
        style,
        drag,
        gravity,
        spread,
      );
    const still = fx.still;
    real.burst(
      x,
      y,
      z,
      still ? Math.max(1, Math.round(count * STILL_SHARE)) : count,
      still ? 0 : speed,
      still ? 0 : up,
      life,
      size,
      c,
      flares ? alpha * fx.flare : alpha,
      style,
      drag,
      still ? 0 : gravity,
      spread,
    );
  };
  return p;
}

/** Reduced motion On: the share of a burst's particles kept, held still where they spawn. */
export const STILL_SHARE = 0.5;

/** `kit` with feedback's particles and smoke under `fx` (everything else is the kit's own). */
function comfortKit(kit: FxKit, fx: Readonly<FxComfort>): FxKit {
  return Object.create(kit, {
    particles: { value: comfortParticles(kit.particles, fx) },
    smoke: { value: comfortParticles(kit.smoke, fx, false) },
  }) as FxKit;
}

export interface FeedbackDeps {
  kit: FxKit;
  entities: EntityLayer;
  telegraphs: TelegraphLayer;
  thread: ThreadView;
  field: FieldView;
  overlay: Overlay;
  rig: CameraRig;
  stage: Stage;
  calls: CallView;
  fermata: FermataView;
}

/**
 * Transient feedback from sim events (docs/plan/04 §3, the juice table): swings, projectiles,
 * hit sparks, aggregated numbers, shatters, Perfect Ward / Save stacks, Chime rings, Reel
 * trails, Glide afterimages, Crescendo blazes, deaths and phase shifts.
 */
export class Feedback {
  private readonly pool: Transient[] = [];
  private cursor = 0;
  private readonly dmg = new Map<EntityId, Bucket>();
  private readonly heal = new Map<EntityId, Bucket>();
  /** Aura heals (Sostenuto…): their own softer numbers, never merged into Mend's. */
  private readonly auraHeal = new Map<EntityId, Bucket>();
  /** The Martyr healing herself (Blood Font, Sanguine Covenant): her own soft numbers. */
  private readonly selfHeal = new Map<EntityId, Bucket>();
  private readonly split: RadiantSplit = { empower: 0, aura: 0, radiance: 0 };
  /**
   * The Luminary's Sunrise, 0..1 (set by the combat view from CallingView): the key light
   * stays warm and a little brighter while it lasts.
   */
  sunWarmth = 0;
  /**
   * The Chronomancer's Stasis, 0..1 (set by the combat view from ChronoView): the light cools a
   * little and dims while time is held.
   */
  stasisCool = 0;
  /** The sim time last frame (enemy projectiles wait as Stasis holds them). */
  private lastSim = -1;
  /** Enemy projectiles Stasis held in the air last frame (tests, the lab). */
  heldProjectiles = 0;
  private lightLive = false;
  private softHealHex = '';
  private softHealFor = '';
  private now = 0;
  private settings: FrameInfo['settings'] = {
    screenShake: 1,
    flashes: 1,
    damageNumbers: true,
    colorVision: 'normal',
  };
  private resonanceAcc = 0;
  private lightShift = 0;
  private lightColor = new THREE.Color();
  private baseKey = 2.4;
  private baseHemi = 0.7;
  private readonly baseHemiColor = new THREE.Color();
  private readonly tmp = new THREE.Color();
  private readonly centre = { x: 0, z: 0 };
  /** The Bloodmoon (Movement II), smoothed 0..1: the sky and fill light lerp toward crimson. */
  bloodmoon = 0;
  /** When each guarded enemy last threw back a 'Blocked' (render clock). */
  private readonly blockedAt = new Map<EntityId, number>();
  /** Movement II, what has been played so far (tests, the lab). */
  readonly firedM2 = {
    leaps: 0,
    charges: 0,
    blocked: 0,
    guardBroken: 0,
    ironDeaths: 0,
    cutHeals: 0,
  };
  /**
   * Brann (docs/phase-5b.md), what has been played so far (tests, the lab): lifesteal draws (never
   * a cut heal), Bloodletting drains (never a hit), his own Sunder Leaps and Red Comets, Red
   * Frenzies begun, Rallies he refused (and refusals Iron Will cleared).
   */
  readonly fired5b = {
    lifesteal: 0,
    drains: 0,
    heroLeaps: 0,
    comets: 0,
    frenzies: 0,
    refused: 0,
    refusedCleared: 0,
  };
  /**
   * Movement III (docs/phase-5c/vfx-audio.md), what has been played so far (tests, the lab):
   * enemy cuts (and Unpicks) with their fray callout, Guard Strand's sparks (a cut turned aside, a
   * bolt destroyed), possessions and frees, mirrors cracked, Mirror Wards, verses stolen and
   * poured back, Unravel opening, zones laid, Spindled hits, cloth deaths, and Unravel's ticks
   * shown as damage (never heal teal).
   */
  readonly firedM3 = {
    cuts: 0,
    unpicked: 0,
    strands: 0,
    possessed: 0,
    freed: 0,
    cracked: 0,
    mirrorWards: 0,
    steals: 0,
    pours: 0,
    unravels: 0,
    zones: 0,
    spindled: 0,
    clothDeaths: 0,
    unravelTicks: 0,
  };
  /** Where the last Stolen Verse fell (its pour starts there). */
  private readonly verseAt = { x: 0, z: 0, known: false };
  /** Brann's refused-Rally glyph: until when it shows (render time), per hero. */
  private readonly refusedUntil = new Map<EntityId, number>();
  /** The same glyph struck across his Rally acknowledgement at his feet: until when, per hero. */
  private readonly refusedAckUntil = new Map<EntityId, number>();
  /** What the refused glyphs drew last frame (tests, the lab): over his head, and on the ack. */
  readonly drawn5b = { refused: 0, refusedAck: 0 };
  /**
   * The Finale (docs/phase-5d.md): every Finale-only effect (crucibleCues.ts). It is called only
   * while a Finale key or event is present, so it draws and plays nothing in Movements I-III.
   */
  readonly crucible: CrucibleCues;
  /**
   * Seren's and Oro's moments (docs/phase-5e.md; serenCues.ts, groveCues.ts). Handed only their
   * own events (none in any other party) and synced only while one plays.
   */
  readonly seren: SerenFx;
  readonly grove: GroveFx;
  /** The key light's own colour (the Grand Silence greys it; restored as the notes come). */
  private readonly baseKeyColor = new THREE.Color();
  private keyGreyed = false;

  /** Comfort as this frame's settings give it (docs/phase-7.md, W2); its particles read it. */
  readonly fx: FxComfort = { flare: 1, still: false, aura: false };
  /** Damage numbers: only the important ones (docs/phase-7.md, W2). */
  private importantOnly = false;
  private readonly d: FeedbackDeps;

  constructor(deps: FeedbackDeps) {
    // Everything feedback (and the Finale's, Seren's and Oro's cues it drives) bursts goes
    // through the comfort options; the real kit is left as it is for every other view.
    const d = (this.d = { ...deps, kit: comfortKit(deps.kit, this.fx) });
    for (let i = 0; i < POOL; i++) {
      this.pool.push({
        active: false,
        kind: K.Ring,
        age: 0,
        life: 1,
        x: 0,
        y: 0,
        z: 0,
        x2: 0,
        y2: 0,
        z2: 0,
        r0: 0,
        r1: 0,
        th: 0,
        style: 0,
        color: new THREE.Color(),
        alpha: 1,
        arcStart: 0,
        arcLen: 7,
        follow: -1,
        top: false,
        visual: '',
        startSim: 0,
        travelSim: 0,
        target: -1,
        gold: false,
        enemy: false,
        held: false,
        hx: 0,
        hy: 0,
        hz: 0,
        rebased: false,
        hist: new Float32Array(24 * 3),
        histCount: 0,
      });
    }
    const lights = d.stage.lights;
    this.baseKey = lights.key.intensity;
    this.baseHemi = lights.hemi.intensity;
    this.baseHemiColor.copy(lights.hemi.color);
    this.baseKeyColor.copy(lights.key.color);
    this.crucible = new CrucibleCues({
      kit: d.kit,
      recs: d.entities.recs,
      entities: d.entities,
      overlay: d.overlay,
      rig: d.rig,
      sink: this,
    });
    this.seren = new SerenFx({
      kit: d.kit,
      recs: d.entities.recs,
      overlay: d.overlay,
      rig: d.rig,
      travel: (id, kind, x, z) => d.entities.travel(id, kind, x, z),
      afterimage: (id, x, z, cued) => d.entities.afterimage(id, x, z, cued),
    });
    this.grove = new GroveFx({ kit: d.kit, recs: d.entities.recs, overlay: d.overlay });
  }

  /** The Finale's draws last frame (crucibleCues.ts; zero in every Movement I-III fight). */
  get drawnFinale(): Readonly<CrucibleCues['drawnFinale']> {
    return this.crucible.drawnFinale;
  }

  /** The Finale's effects played so far (crucibleCues.ts; zero in every Movement I-III fight). */
  get firedFinale(): Readonly<CrucibleCues['firedFinale']> {
    return this.crucible.firedFinale;
  }

  private alloc(kind: K, life: number): Transient {
    let t: Transient | undefined;
    for (let i = 0; i < POOL; i++) {
      const k = this.pool[(this.cursor + i) % POOL]!;
      if (!k.active) {
        t = k;
        this.cursor = (this.cursor + i + 1) % POOL;
        break;
      }
    }
    if (!t) {
      t = this.pool[this.cursor]!;
      this.cursor = (this.cursor + 1) % POOL;
    }
    t.active = true;
    t.kind = kind;
    t.age = 0;
    t.life = life;
    t.follow = -1;
    t.top = false;
    t.alpha = 1;
    t.arcStart = 0;
    t.arcLen = 7;
    t.style = 0;
    t.th = 0.1;
    t.y = 0;
    t.histCount = 0;
    t.gold = false;
    t.enemy = false;
    t.held = false;
    t.rebased = false;
    return t;
  }

  ring(
    x: number,
    z: number,
    r0: number,
    r1: number,
    life: number,
    c: THREE.Color,
    th = 0.12,
    style: number = RING.plain,
    alpha = 1,
    y = 0.05,
    follow: EntityId = -1,
  ): Transient {
    const t = this.alloc(K.Ring, life);
    t.x = x;
    t.y = y;
    t.z = z;
    t.r0 = r0;
    t.r1 = r1;
    t.th = th;
    t.style = style;
    t.color.copy(c);
    t.alpha = alpha;
    t.follow = follow;
    return t;
  }

  sprite(
    x: number,
    y: number,
    z: number,
    s0: number,
    s1: number,
    life: number,
    c: THREE.Color,
    style: number = SPRITE.glow,
    alpha = 1,
    follow: EntityId = -1,
    top = false,
  ): Transient {
    const t = this.alloc(K.Sprite, life);
    t.x = x;
    t.y = y;
    t.z = z;
    t.r0 = s0;
    t.r1 = s1;
    t.style = style;
    t.color.copy(c);
    t.alpha = alpha;
    t.follow = follow;
    t.top = top;
    return t;
  }

  beam(
    ax: number,
    ay: number,
    az: number,
    bx: number,
    by: number,
    bz: number,
    width: number,
    life: number,
    c: THREE.Color,
    style: number = BEAM.glow,
    alpha = 1,
  ): Transient {
    const t = this.alloc(K.Beam, life);
    t.x = ax;
    t.y = ay;
    t.z = az;
    t.x2 = bx;
    t.y2 = by;
    t.z2 = bz;
    t.th = width;
    t.style = style;
    t.color.copy(c);
    t.alpha = alpha;
    return t;
  }

  private rec(id: EntityId | null): EntityRec | undefined {
    return id === null ? undefined : this.d.entities.recs.get(id);
  }

  private heroHex(state: WorldState, id: EntityId): string | null {
    const e = state.entities.get(id);
    if (!e?.hero) return null;
    try {
      // Brann's rings are his brass, never his crimson beside danger (crimsonCues.ts).
      return signalHex(e.hero.defId, heroDef(e.hero.defId).color);
    } catch {
      return null;
    }
  }

  /**
   * A hero's colour where it sits beside danger (swipes, leap rings, Solo and ability rings):
   * `own` (their record's colour), except Brann's brass. Every default hero keeps `own`.
   */
  private signal(state: WorldState, id: EntityId, own: THREE.Color): THREE.Color {
    const hex = signalHex(state.entities.get(id)?.hero?.defId, '');
    return hex ? color(hex) : own;
  }

  // ── Events ─────────────────────────────────────────────────────────────────────────

  /** The comfort options in force: Flashes from the frame, the rest from Settings. */
  private comfort(): void {
    const s = useSettings.getState().settings;
    this.fx.flare = flareScale(this.settings.flashes);
    this.fx.still = fightStill(s);
    this.importantOnly = optionsOf(s).importantNumbersOnly;
  }

  handle(events: readonly SimEvent[], state: WorldState): void {
    this.comfort();
    let finale = false;
    // Seren's Ward blows (her counter, her kill shot) are looked for only when the batch has one.
    let ward: ReadonlySet<SimEvent> | null = null;
    for (const ev of events)
      if (ev.type === 'parryCountered' || ev.type === 'killShot') {
        ward = wardBlows(events, state);
        break;
      }
    for (const ev of events) {
      switch (ev.type) {
        case 'attackFired':
          this.attack(ev, state);
          break;
        case 'damageTaken':
          this.damage(ev, state, ward !== null && ward.has(ev));
          break;
        case 'healApplied':
          // Rewind's restored life is part of its moment (ChronoView draws its number).
          if (ev.via !== 'rewind') this.healed(ev, state);
          break;
        case 'shieldApplied':
          // Dawnward's barrier has its own dawn bloom (CallingView): skip the generic ring.
          if (ev.shield !== 'overshield' || !dawnwardIn(events, ev.target)) this.shieldApplied(ev);
          break;
        case 'shieldBroken':
          this.shieldBroken(ev);
          break;
        case 'statusApplied':
          this.statusApplied(ev);
          break;
        case 'telegraphStarted':
          this.d.telegraphs.onStarted(ev);
          if (ev.effect !== 'damage') {
            const r = this.rec(ev.owner);
            if (r)
              this.sprite(
                r.x,
                r.height * 0.8,
                r.z,
                0.4,
                1.6,
                0.35,
                r.accent,
                SPRITE.star,
                0.9,
                ev.owner,
              );
          }
          break;
        case 'telegraphResolved':
          this.d.telegraphs.onResolved(ev);
          this.resolved(ev);
          break;
        case 'techniqueCast':
          this.technique(ev, state);
          break;
        case 'perfectWard':
          this.perfectWard(ev);
          break;
        case 'save':
          this.save(ev, state, ev.cause === 'rewind');
          break;
        // An aura's or ornament's own effects: no comfort option touches them (FxComfort),
        // nor Reduced motion their camera moves (CameraRig.aura).
        case 'fieldPlanted':
          this.fx.aura = this.d.rig.aura = true;
          this.planted(ev, state);
          this.fx.aura = this.d.rig.aura = false;
          break;
        case 'chorusPulse':
          this.fx.aura = this.d.rig.aura = true;
          this.chorus(ev, state);
          this.fx.aura = this.d.rig.aura = false;
          break;
        case 'fermataHold':
          this.fx.aura = this.d.rig.aura = true;
          this.d.fermata.onHold(ev, state);
          this.fermataHold(ev);
          this.fx.aura = this.d.rig.aura = false;
          break;
        case 'fermataReleased':
          this.fx.aura = this.d.rig.aura = true;
          this.d.fermata.onReleased(ev);
          this.fermataReleased(ev);
          this.fx.aura = this.d.rig.aura = false;
          break;
        case 'callStarted':
          this.d.calls.onStarted(ev);
          this.callStarted(ev);
          break;
        case 'callAnswered':
          this.d.calls.onAnswered(ev);
          this.callAnswered(ev, state);
          break;
        case 'callEnded':
          this.d.calls.onEnded(ev);
          break;
        case 'flourish':
          this.flourish(ev, state);
          break;
        case 'chimeLaunched': {
          const w = this.rec(state.weaverId);
          if (w) this.sprite(w.x, 1.3, w.z, 0.3, 1.2, 0.25, CHIME, SPRITE.star, 1);
          break;
        }
        case 'chimeLanded':
          this.chimeLanded(ev);
          break;
        case 'cleansed':
          this.cleansed(ev);
          break;
        case 'reeled':
          this.reeled(ev, state);
          break;
        case 'glided':
          this.glided(ev, state);
          break;
        case 'threadAttached': {
          this.d.thread.attach();
          this.d.entities.attachFlash(ev.hero);
          const r = this.rec(ev.hero);
          const w = state.entities.get(state.weaverId)?.weaver;
          const c =
            w?.threadMode === 'empower' ? C.amp : w?.threadMode === 'bear' ? C.bear : C.heal;
          if (r)
            this.ring(
              r.x,
              r.z,
              r.radius,
              r.radius * 2.6,
              0.35,
              c,
              0.12,
              RING.plain,
              1,
              0.05,
              ev.hero,
            );
          break;
        }
        case 'threadModeChanged': {
          this.d.thread.pulse();
          this.d.thread.pulse();
          const w = this.rec(state.weaverId);
          const c = ev.mode === 'empower' ? C.amp : ev.mode === 'bear' ? C.bear : C.heal;
          if (w) this.ring(w.x, w.z, 0.4, 1.8, 0.3, c, 0.1, RING.plain, 1, 0.05, state.weaverId);
          if (ev.mode === 'bear' && w)
            // Bear settles on her: a heavier ring sinking in, not spreading out.
            this.ring(w.x, w.z, 1.6, 0.5, 0.4, c, 0.16, RING.plain, 1, 0.05, state.weaverId);
          break;
        }
        case 'threadSnapped': {
          this.d.thread.snap(this.d.kit);
          this.d.rig.addTrauma(0.2);
          const r = this.rec(ev.target);
          if (ev.cause !== undefined) {
            // An enemy cut it (Movement III): CUT (or UNPICKED) in the fray, not the range snap's
            // grey SNAPPED, and the stub frays at her hand until the lock lifts.
            this.cutThread(ev.cause, ev.lock ?? 0, r);
            break;
          }
          this.d.thread.clearCut();
          if (r)
            this.d.overlay.callout(
              r.x,
              r.height + 1.1,
              r.z,
              'SNAPPED',
              '#e2e8f0',
              15,
              0.9,
              'rgba(148,163,184,0.9)',
            );
          break;
        }
        case 'reviveStarted': {
          const r = this.rec(ev.hero);
          if (r)
            this.ring(
              r.x,
              r.z,
              r.radius * 3,
              r.radius * 1.8,
              0.4,
              C.heal,
              0.1,
              RING.plain,
              1,
              0.05,
              ev.hero,
            );
          break;
        }
        case 'revived':
          // Rewind standing a hero back up has its own moment (ChronoView).
          if (!rewoundIn(events, ev.hero)) this.revived(ev.hero);
          break;
        case 'resonanceGained':
          this.resonanceAcc += ev.amount;
          break;
        case 'resonanceSpent': {
          const w = this.rec(state.weaverId);
          if (w) {
            this.d.kit.particles.burst(
              w.x,
              1.2,
              w.z,
              22,
              3,
              2,
              0.8,
              0.16,
              C.resonance,
              1,
              PARTICLE.spark,
              2.5,
              -0.5,
            );
            this.ring(
              w.x,
              w.z,
              0.4,
              2.2,
              0.35,
              C.resonance,
              0.12,
              RING.plain,
              1,
              1.2,
              state.weaverId,
            );
          }
          break;
        }
        case 'crescendoStart': {
          // The Martyr's Vow, the Chronomancer's Stasis and the Conductor's Grand Finale have
          // their own moments (MartyrView, ChronoView, ConductView): none of Sunrise's gold.
          const kind = crescendoKind(state);
          if (kind === 'vow') this.vowStart();
          else if (kind === 'stasis') this.stasisStart();
          else if (kind === 'finale') this.finaleStart();
          else this.crescendo(state);
          break;
        }
        case 'crescendoEnd': {
          const kind = crescendoKind(state);
          if (kind === 'stasis') this.d.overlay.coolFlash(0.1, 0.18);
          if (kind !== 'sunrise') break;
          const w = this.rec(state.weaverId);
          if (w)
            this.ring(
              w.x,
              w.z,
              state.field.radius * 1.2,
              0.5,
              0.5,
              C.gold,
              0.15,
              RING.plain,
              0.8,
              0.05,
              state.weaverId,
            );
          break;
        }
        case 'weaverDowned': {
          const w = this.rec(state.weaverId);
          this.d.overlay.danger();
          this.d.rig.addTrauma(0.35);
          if (w)
            this.d.kit.particles.burst(
              w.x,
              1,
              w.z,
              30,
              4,
              3,
              0.9,
              0.18,
              C.gold,
              1,
              PARTICLE.shard,
              2.5,
              6,
            );
          break;
        }
        case 'weaverReformed': {
          const w = this.rec(state.weaverId);
          if (w) {
            this.ring(w.x, w.z, 0.3, 3, 0.5, C.gold, 0.18, RING.plain, 1, 0.05);
            this.beam(w.x, 0, w.z, w.x, 7, w.z, 1.4, 0.5, C.goldHot, BEAM.glow, 0.8);
          }
          break;
        }
        case 'soloReady': {
          const r = this.rec(ev.hero);
          if (r)
            this.ring(
              r.x,
              r.z,
              r.radius,
              r.radius * 3,
              0.4,
              C.amp,
              0.1,
              RING.plain,
              1,
              0.05,
              ev.hero,
            );
          break;
        }
        case 'cued': {
          const r = this.rec(ev.hero);
          if (r) {
            this.d.overlay.spotlight(r.x, r.height * 0.6, r.z, 0.4);
            this.d.rig.punch(-1.2, 6);
          }
          break;
        }
        case 'soloStarted':
          this.solo(ev, state);
          break;
        case 'allyDowned': {
          const r = this.rec(ev.hero);
          this.d.overlay.danger();
          this.d.rig.addTrauma(0.25);
          if (r) {
            this.ring(r.x, r.z, r.radius, r.radius * 4, 0.6, C.lethal, 0.14, RING.plain, 1);
            this.d.kit.particles.burst(
              r.x,
              1,
              r.z,
              16,
              3,
              2,
              0.7,
              0.14,
              C.lethal,
              0.9,
              PARTICLE.spark,
              3,
              4,
            );
          }
          break;
        }
        case 'allyOut': {
          const r = this.rec(ev.hero);
          if (r)
            this.d.kit.smoke.burst(
              r.x,
              0.6,
              r.z,
              18,
              1.2,
              1.5,
              1.4,
              0.5,
              C.ailment,
              0.6,
              PARTICLE.smoke,
              1.5,
              -0.3,
              1,
            );
          break;
        }
        case 'directiveAck': {
          const r = this.rec(ev.hero);
          const hex = this.heroHex(state, ev.hero);
          if (r && hex)
            this.ring(
              r.x,
              r.z,
              r.radius * 2.2,
              r.radius * 1.2,
              0.3,
              color(hex),
              0.08,
              RING.dashed,
              0.9,
              0.05,
              ev.hero,
            );
          break;
        }
        case 'abilityUsed':
          this.ability(ev, state);
          break;
        case 'lifeSpent':
          this.lifeSpent(ev, state);
          break;
        case 'bloodlust':
          // Brann refused your Rally: a 'refused' glyph over him while he still refuses.
          this.refusedUntil.set(ev.hero, this.now + REFUSED_SECONDS);
          this.refusedAckUntil.set(ev.hero, this.now + REFUSED_ACK_SECONDS);
          this.fired5b.refused++;
          break;
        case 'talentFired':
          // Iron Will: your Ward made him answer, so the refusal is lifted at once.
          if (ev.talent === 'iron_will') {
            this.refusedAckUntil.delete(ev.hero);
            if (this.refusedUntil.delete(ev.hero)) this.fired5b.refusedCleared++;
          }
          break;
        // Seren and Oro (docs/phase-5e.md): emitted only with that hero in the party.
        case 'parried':
        case 'parryCountered':
        case 'killShot':
        case 'duelChosen':
        case 'overextended':
          this.seren.handle(ev, state);
          break;
        case 'summonSpawned':
        case 'summonFell':
        case 'rooted':
        case 'gentleRefused':
          this.grove.handle(ev, state);
          break;
        case 'castInterrupted': {
          const r = this.rec(ev.enemy);
          if (r) {
            this.d.kit.particles.burst(
              r.x,
              r.height * 0.7,
              r.z,
              24,
              5,
              2,
              0.5,
              0.15,
              C.white,
              1,
              PARTICLE.shard,
              3,
              4,
            );
            this.ring(r.x, r.z, 2.4, 0.4, 0.3, r.accent, 0.12, RING.dashed, 1);
            this.d.overlay.callout(
              r.x,
              r.height + 1.1,
              r.z,
              'INTERRUPTED',
              '#f8fafc',
              14,
              1,
              'rgba(255,255,255,0.7)',
            );
          }
          break;
        }
        case 'enemyKilled':
          this.killed(ev, state);
          break;
        case 'guardBlocked':
          this.blocked(ev);
          break;
        case 'guardBroken':
          this.guardBroken(ev);
          break;
        case 'phaseChanged':
          this.phase(ev);
          break;
        // ── Movement III (docs/phase-5c.md): none of these is sent before it. ──
        case 'cutResolved':
          if (ev.result === 'strand') this.strandCut(ev, state);
          break;
        case 'strandBlocked':
          this.strandSpark(ev.x, ev.z);
          break;
        case 'possessed':
          this.possessed(ev.hero);
          break;
        case 'freed':
          this.freed(ev.hero, ev.status);
          break;
        case 'mirrorCracked':
          this.mirrorCracked(ev.enemy);
          break;
        case 'mirrorWard':
          this.mirrorWard(ev.enemy);
          break;
        case 'verseStolen':
          this.verseStolen(ev.aura, ev.add, state);
          break;
        case 'verseReturned':
          this.verseReturned(ev.aura, ev.reason, state);
          break;
        case 'unravelled':
          if (ev.active) this.unravelOpened(state);
          break;
        case 'zoneStarted':
          this.zoneLaid(ev.kind, ev.x, ev.z, ev.r);
          break;
        case 'spindled':
          this.spindledHit(ev.enemy);
          break;
        // ── The Finale (docs/phase-5d.md): none of these is sent before it. ──
        case 'discordRose':
        case 'fortissimoCancelled':
        case 'enemyCued':
        case 'silenceBegan':
        case 'silenceNote':
        case 'reignited':
        case 'silenceBroken':
          finale = true;
          break;
        case 'spawnWarning': {
          const t = this.alloc(K.Portal, Math.max(0.3, ev.delay) + 0.35);
          t.x = ev.x;
          t.z = ev.z;
          t.r0 = Math.max(0.3, ev.delay);
          t.color.copy(C.ailment);
          break;
        }
        case 'encounterEnded': {
          const w = this.rec(state.weaverId);
          if (w && ev.outcome === 'victory') {
            for (let i = 0; i < 3; i++)
              this.ring(w.x, w.z, 0.5, 8 + i * 4, 0.9 + i * 0.25, C.gold, 0.2, RING.plain, 1);
            this.d.kit.particles.burst(
              w.x,
              1,
              w.z,
              60,
              6,
              6,
              1.4,
              0.2,
              C.gold,
              1,
              PARTICLE.spark,
              1.5,
              2,
              2,
            );
          }
          break;
        }
        default:
          break;
      }
    }
    if (finale || state.field.finale !== undefined || this.crucible.override !== null)
      this.crucible.handle(events, state);
  }

  private attack(e: SimEventOf<'attackFired'>, state: WorldState): void {
    const src = state.entities.get(e.source);
    const sr = this.rec(e.source);
    if (e.visual === 'melee' || e.visual === 'cleave')
      this.d.entities.lungeAt(e.source, e.toX, e.toZ);
    this.d.entities.swingAt(e.source);
    const isHero = src?.kind === 'hero';
    let c: THREE.Color = C.threat;
    if (isHero && src.hero) {
      c = this.signal(state, e.source, sr ? sr.color : C.white);
      const w = state.entities.get(state.weaverId)?.weaver;
      const empowered = w?.threadMode === 'empower' && w.threadSlot === src.hero.slot;
      if (empowered || (src.hero.soloActive > 0 && src.hero.soloCued)) {
        this.tmp.copy(c).lerp(C.amp, 0.65);
        c = this.tmp;
      }
    } else if (sr) c = sr.accent;
    const fromY = sr ? sr.height * 0.6 : 1;
    const dx = e.toX - e.fromX;
    const dz = e.toZ - e.fromZ;
    const dist = Math.hypot(dx, dz) || 1;
    switch (e.visual) {
      case 'charge':
      case 'leap':
        this.travel(e, sr, c, isHero);
        break;
      case 'melee':
      case 'cleave': {
        const ang = Math.atan2(dz, dx);
        const half = e.visual === 'cleave' ? 1.2 : 0.85;
        const r = Math.max(1.0, Math.min(2.6, dist * 0.85));
        const t = this.ring(
          e.fromX,
          e.fromZ,
          r * 0.8,
          r,
          0.22,
          isHero ? c : C.threat,
          0.5,
          RING.swipe,
          1,
          0.6,
        );
        t.arcStart = ang - half;
        t.arcLen = half * 2;
        this.d.kit.particles.burst(
          e.toX,
          1,
          e.toZ,
          isHero ? 5 : 4,
          3,
          2,
          0.3,
          0.1,
          isHero ? C.white : C.threat,
          0.9,
          PARTICLE.spark,
          4,
          6,
        );
        break;
      }
      case 'arrow':
      case 'bolt':
      case 'starbolt':
      case 'meteor': {
        const t = this.alloc(K.Proj, Math.max(0.05, e.travel) + 0.05);
        t.visual = e.visual;
        t.x = e.fromX;
        t.y = fromY;
        t.z = e.fromZ;
        t.x2 = e.toX;
        t.z2 = e.toZ;
        t.startSim = state.time;
        t.travelSim = Math.max(0.05, e.travel);
        t.target = e.target ?? -1;
        t.color.copy(c);
        t.gold = c === this.tmp;
        t.enemy = src?.kind === 'enemy';
        if (e.visual === 'meteor') {
          t.x = e.toX + 3;
          t.y = 16;
          t.z = e.toZ - 5;
        }
        break;
      }
      case 'lunge':
      case 'feint':
      case 'blink':
        // Seren's (docs/phase-5e.md): her dash, her step, a Thousand Cuts blink.
        this.seren.handle(e, state);
        break;
      case 'pierce':
      case 'lance':
      case 'heal-beam': {
        const beamC = e.visual === 'heal-beam' ? C.heal : c;
        const w = e.visual === 'lance' ? 0.7 : 0.35;
        this.beam(e.fromX, fromY, e.fromZ, e.toX, 1, e.toZ, w, 0.28, beamC, BEAM.lance, 1);
        this.beam(e.fromX, fromY, e.fromZ, e.toX, 1, e.toZ, w * 3, 0.36, beamC, BEAM.glow, 0.35);
        const n = Math.min(14, Math.round(dist));
        for (let i = 0; i < n; i++) {
          const k = i / Math.max(1, n - 1);
          this.d.kit.particles.emit(
            e.fromX + dx * k,
            1,
            e.fromZ + dz * k,
            (Math.random() - 0.5) * 1.5,
            Math.random() * 1.5,
            (Math.random() - 0.5) * 1.5,
            0.4,
            0.1,
            beamC,
            0.9,
            PARTICLE.spark,
            3,
          );
        }
        if (e.visual === 'lance') this.d.rig.addTrauma(0.12);
        break;
      }
      default:
        break;
    }
  }

  /**
   * A charge or a leap (Movement II): the sim snapped the caster to where it lands; the entity
   * layer draws it rushing or arcing there. A charge leaves a streak in its accent along the
   * line, a leap a ring and a puff of dust where it comes down. A hero's leap (Brann's Sunder
   * Leap, docs/phase-5b.md, `source` = the hero) arcs the same way and also leaves a ring of dust
   * where he lands; its ring is his brass (`c`, from `signal`).
   */
  private travel(
    e: SimEventOf<'attackFired'>,
    sr: EntityRec | undefined,
    c: THREE.Color,
    isHero = false,
  ): void {
    const fromX = sr ? sr.x : e.fromX;
    const fromZ = sr ? sr.z : e.fromZ;
    this.d.entities.travel(e.source, e.visual === 'leap' ? 'leap' : 'charge', e.fromX, e.fromZ);
    if (e.visual === 'charge') {
      this.firedM2.charges++;
      this.beam(fromX, 0.6, fromZ, e.toX, 0.6, e.toZ, 0.5, 0.45, c, BEAM.lance, 0.8);
      this.beam(fromX, 0.6, fromZ, e.toX, 0.6, e.toZ, 1.6, 0.55, c, BEAM.glow, 0.3);
      const n = Math.min(16, Math.round(Math.hypot(e.toX - fromX, e.toZ - fromZ)));
      for (let i = 0; i < n; i++) {
        const k = i / Math.max(1, n - 1);
        this.d.kit.smoke.emit(
          fromX + (e.toX - fromX) * k,
          0.15,
          fromZ + (e.toZ - fromZ) * k,
          (Math.random() - 0.5) * 0.6,
          0.3,
          (Math.random() - 0.5) * 0.6,
          0.8,
          0.4,
          DUST,
          0.35,
          PARTICLE.smoke,
          1.2,
          0,
          0.6,
        );
      }
      this.d.rig.addTrauma(0.08);
    } else {
      this.firedM2.leaps++;
      // Where it comes down: a ring spreading there and a puff of dust as it lands.
      this.ring(e.toX, e.toZ, 0.6, 3.2, 0.8, c, 0.14, RING.plain, 0.9);
      this.d.kit.particles.burst(
        e.toX,
        0.2,
        e.toZ,
        10,
        3,
        1.5,
        0.5,
        0.14,
        DUST,
        0.7,
        PARTICLE.dot,
        3,
        4,
        1,
      );
      if (isHero) {
        this.fired5b.heroLeaps++;
        // His landing: a low ring of dust kicked out round him, and a second, later one.
        this.ring(e.toX, e.toZ, 0.4, 2.4, 0.55, DUST, 0.3, RING.soft, 0.6, 0.04);
        this.ring(e.toX, e.toZ, 0.3, 1.6, 0.4, DUST, 0.2, RING.plain, 0.5, 0.045);
        this.d.rig.addTrauma(0.1);
      }
    }
  }

  /** A hero's hit glanced off a guard arc: a grey 'Blocked' and a brass spark (rate-limited). */
  private blocked(e: SimEventOf<'guardBlocked'>): void {
    const r = this.rec(e.enemy);
    if (!r) return;
    const last = this.blockedAt.get(e.enemy) ?? -Infinity;
    if (this.now - last < BLOCKED_EVERY) return;
    this.blockedAt.set(e.enemy, this.now);
    this.firedM2.blocked++;
    const src = this.rec(e.source);
    const ang = src ? Math.atan2(src.z - r.z, src.x - r.x) : 0;
    const R = r.radius * 1.9 + 0.35;
    const t = this.ring(r.x, r.z, R, R + 0.3, 0.25, GUARD, 0.18, RING.swipe, 0.95, 0.06);
    t.arcStart = ang - 0.35;
    t.arcLen = 0.7;
    this.d.kit.particles.burst(
      r.x + Math.cos(ang) * R,
      r.height * 0.5,
      r.z + Math.sin(ang) * R,
      6,
      3,
      1.5,
      0.3,
      0.1,
      GUARD,
      0.9,
      PARTICLE.spark,
      4,
      6,
    );
    if (this.settings.damageNumbers)
      this.d.overlay.callout(
        r.x,
        r.height + 0.9,
        r.z,
        'Blocked',
        CRIMSON_HEX.blocked,
        13,
        0.7,
        'rgba(100,116,139,0.8)',
      );
  }

  /** A guard broke (an Empowered Piercing Shot): its arc flashes and shatters in brass. */
  private guardBroken(e: SimEventOf<'guardBroken'>): void {
    const r = this.rec(e.enemy);
    if (!r) return;
    this.firedM2.guardBroken++;
    this.d.entities.guardBreak(e.enemy);
    this.d.kit.particles.burst(
      r.x,
      r.height * 0.5,
      r.z,
      26,
      5,
      3,
      0.7,
      0.14,
      GUARD,
      1,
      PARTICLE.shard,
      2.5,
      7,
      r.radius,
    );
    this.ring(r.x, r.z, r.radius, r.radius * 3.4, 0.4, GUARD, 0.16, RING.plain, 1);
    this.d.overlay.callout(
      r.x,
      r.height + 1.2,
      r.z,
      'GUARD BROKEN',
      '#fef3c7',
      15,
      1.1,
      'rgba(201,178,138,0.9)',
    );
  }

  /**
   * Unravel's own tick (docs/phase-5c.md, Q12): a 'tick' from `field.unravel.source` on the
   * threaded hero while Unravel runs (not under Stasis). False outside Movement III: no key.
   */
  private isUnravelTick(e: SimEventOf<'damageTaken'>, state: WorldState): boolean {
    const u = state.field.unravel;
    if (u === undefined || state.field.stasis) return false;
    if (e.hit !== 'tick' || e.source !== u.source || e.amount + e.absorbed <= 0) return false;
    const slot = state.entities.get(state.weaverId)?.weaver?.threadSlot;
    return slot !== null && slot !== undefined && state.party[slot] === e.target;
  }

  private damage(e: SimEventOf<'damageTaken'>, state: WorldState, ward = false): void {
    const r = this.rec(e.target);
    const target = state.entities.get(e.target);
    if (!r || !target) return;
    const maxHp = target.health?.maxHp ?? 1;
    const total = e.amount + e.absorbed;
    const frac = total / maxHp;
    const isParty = target.team === 'party';
    // Oro's summons are team 'party' but never get a hero's hurt treatment (the threat sparks,
    // the camera's trauma): two Saplings tanking a pack would keep the camera shaking. Their
    // feedback is important-only; bark chips fly instead. False in every party without Oro.
    const hurt = isParty && !target.summon;
    if (e.amount > 0) this.d.entities.hit(e.target, Math.min(1, (isParty ? 0.5 : 0.3) + frac * 5));
    const y = r.height * 0.6 + r.y;
    if (e.amount > 0) {
      const n = Math.min(14, 3 + Math.round(frac * 30));
      this.d.kit.particles.burst(
        r.x,
        y,
        r.z,
        n,
        3.5,
        2.5,
        0.35,
        0.11,
        hurt ? C.threat : target.summon ? GROVE_BARK : SHARD,
        1,
        PARTICLE.spark,
        4,
        5,
        r.radius,
      );
      splitRadiant(e.amplified, e.aura, e.radiance + e.eclipse, this.split);
      // The Weaver's share as sparks (Radiance's warm spark is CallingView's): gold for Empower / Flourishes, song colour for the auras.
      if (this.split.empower >= 1)
        this.d.kit.particles.burst(
          r.x,
          y,
          r.z,
          3,
          2.5,
          3,
          0.45,
          0.12,
          C.amp,
          1,
          PARTICLE.spark,
          3,
          3,
          r.radius,
        );
      if (this.split.aura >= 1)
        this.d.kit.particles.burst(
          r.x,
          y,
          r.z,
          3,
          2,
          3.4,
          0.55,
          0.12,
          C.song,
          1,
          PARTICLE.note,
          2.5,
          1,
          r.radius,
        );
    }
    if (e.absorbed > 0) {
      this.ring(r.x, r.z, r.radius * 1.3, r.radius * 1.9, 0.2, C.shield, 0.06, RING.plain, 0.8, y);
      this.d.kit.particles.burst(
        r.x,
        y,
        r.z,
        4,
        2.5,
        1.5,
        0.3,
        0.1,
        C.shield,
        1,
        PARTICLE.shard,
        4,
        2,
        r.radius,
      );
    }
    if (e.hit === 'detonation') {
      this.ring(r.x, r.z, 0.3, 3, 0.45, C.ailment, 0.2, RING.plain, 1);
      this.d.kit.particles.burst(
        r.x,
        y,
        r.z,
        30,
        5,
        3,
        0.7,
        0.18,
        C.ailment,
        1,
        PARTICLE.spark,
        2.5,
        3,
      );
      this.d.rig.addTrauma(0.2);
    }
    if (hurt && frac > 0.18) this.d.rig.addTrauma(Math.min(0.3, frac * 0.5));
    // Unravel (Movement III): the reversed Mend's ticks on the threaded hero show as damage, in
    // the live lethal colour below (never heal teal). Only Unravel's own tick counts: its source,
    // on the threaded hero (a possession tick or another DoT there is not it).
    const unravelTick = isParty && this.isUnravelTick(e, state);
    if (unravelTick) this.firedM3.unravelTicks++;
    if (!this.settings.damageNumbers) return;
    // Oro's summons (docs/phase-5e.md): only an important hit gets a number (two Saplings
    // would flood them): a quarter of its life, or the blow that fells it.
    if (target.summon && e.amount < maxHp * SUMMON_NUMBER_SHARE && (target.health?.hp ?? 0) > 0)
      return;
    let b = this.dmg.get(e.target);
    if (!b) {
      b = bucket();
      this.dmg.set(e.target, b);
    }
    // An Unravel tick keeps a number of its own (its colour is set when the number spawns): a
    // tick never joins another hit's number, and no other hit joins a tick's. Outside Movement
    // III both sides are always false.
    const fresh =
      this.now - b.start > AGG ||
      b.handle < 0 ||
      !this.d.overlay.numberAlive(b.handle) ||
      unravelTick !== b.unravel;
    if (fresh) {
      b.amount = 0;
      b.amplified = 0;
      b.aura = 0;
      b.radiance = 0;
      b.eclipse = 0;
      b.absorbed = 0;
      b.crit = false;
      b.start = this.now;
      b.unravel = unravelTick;
      b.ward = 0;
    }
    b.amount += e.amount;
    b.amplified += e.amplified;
    if (ward) b.ward += Math.max(0, e.amount + e.absorbed - e.amplified);
    b.aura += e.aura;
    b.radiance += e.radiance;
    b.eclipse += e.eclipse;
    b.absorbed += e.absorbed;
    b.crit = b.crit || e.crit;
    const shown = b.amount > 0 ? b.amount : b.absorbed;
    const sig = isParty
      ? 14 + 24 * Math.sqrt(Math.min(1, shown / maxHp))
      : 12 + 3.3 * Math.log10(1 + shown);
    const size = Math.min(40, sig * (b.crit ? 1.25 : 1));
    const colorHex =
      b.amount <= 0
        ? '#a5f3fc'
        : b.unravel
          ? VISION_HEX.lethal
          : isParty
            ? '#fb7185'
            : b.crit
              ? '#fde68a'
              : '#fff7ed';
    // Important numbers only (docs/phase-7.md, W2): a hit shows only when the Weaver had a hand
    // in it (an Empower, a song's share, a Ward blow: its chips); never a hit on the party.
    if (this.importantOnly && (isParty || b.amplified + b.aura + b.ward <= 0)) {
      b.handle = -1;
      return;
    }
    if (fresh) b.handle = this.d.overlay.spawnNumber(r.x, r.height + 0.35, r.z, colorHex, size);
    const text =
      b.amount > 0 ? `${Math.round(b.amount)}${b.crit ? '!' : ''}` : `(${Math.round(b.absorbed)})`;
    // Chips: gold = Empower and Flourishes, ♪ song = the auras' work, ☀ = the Luminary's light
    // (Radiance and Eclipse). A hero who shone makes the number glow; the ☀ chip waits until
    // the light is a real part of the hit.
    const dealt = b.amount + b.absorbed;
    splitRadiant(b.amplified, b.aura, b.radiance + b.eclipse, this.split);
    const glow = radiantTier(b.radiance, dealt);
    const lit = radiantTier(b.radiance + b.eclipse, dealt);
    this.d.overlay.setNumber(
      b.handle,
      text,
      chipText(this.split.empower + b.ward),
      size,
      !fresh,
      chipText(this.split.aura, SONG_GLYPH),
      lit >= 2 ? sunChipText(this.split.radiance) : null,
      glow >= 2 ? 1 : glow === 1 ? 0.5 : 0,
    );
  }

  private healed(e: SimEventOf<'healApplied'>, state: WorldState): void {
    const r = this.rec(e.target);
    const target = state.entities.get(e.target);
    // Oro's grove (docs/phase-5e.md): only Rootbond's heal on a summon (the Mend on Oro spilling
    // to his grove: via 'grove', or 'mend' as the sim flushes it) is motes along his root tether,
    // never the Thread's Mend pulse. A song's regen on a covered summon (Q1, via 'aura') reads
    // as on a hero; Regrowth's or Homecoming's (via 'solo') is a plain heal. A grove heal on a
    // hero is drawn as the songs' own.
    if (target?.summon) {
      if (e.amount <= 0) return;
      if (e.via === 'grove' || e.via === 'mend') {
        this.grove.rootbond(e, state);
        return;
      }
    }
    if (!r || !target || e.amount <= 0) return;
    if (e.via === 'grove') {
      this.auraHealed(e, r, target, state);
      return;
    }
    // Brann's axe drinking (docs/phase-5b.md): his own crimson motes and soft "+N", never the
    // Weaver's heal burst, never a cut heal, never the Thread's Mend pulse.
    if (e.via === 'lifesteal') {
      this.lifesteal(e, r, target);
      return;
    }
    if (e.via === 'aura') {
      // An aura's heal notes, in its colours: as the aura draws them, whatever the comfort.
      this.fx.aura = true;
      this.auraHealed(e, r, target, state);
      this.fx.aura = false;
      return;
    }
    if (e.via === 'self') {
      this.selfHealed(e, r, target, state);
      return;
    }
    if (e.via === 'mend' && !target.summon) this.d.thread.pulse();
    const maxHp = target.health?.maxHp ?? 1;
    const n = Math.min(8, 1 + Math.round((e.amount / maxHp) * 20));
    for (let i = 0; i < n * this.d.kit.particles.density; i++) {
      const a = Math.random() * Math.PI * 2;
      const rr = r.radius * Math.random();
      this.d.kit.particles.emit(
        r.x + Math.cos(a) * rr,
        0.3 + Math.random() * r.height * 0.6,
        r.z + Math.sin(a) * rr,
        0,
        1.4 + Math.random(),
        0,
        0.9,
        0.12,
        C.heal,
        0.95,
        PARTICLE.dot,
        0.8,
        -0.3,
      );
    }
    if (e.via === 'revive' || e.via === 'chime') {
      this.ring(
        r.x,
        r.z,
        r.radius,
        r.radius * 2.4,
        0.4,
        C.heal,
        0.1,
        RING.plain,
        1,
        0.05,
        e.target,
      );
    }
    if (!this.settings.damageNumbers || target.team !== 'party') return;
    // Important numbers only (docs/phase-7.md, W2): the Weaver's own heals (Mend, a Chime, a
    // revive); a hero's Solo or another source's heal shows none.
    if (this.importantOnly && e.via !== 'mend' && e.via !== 'chime' && e.via !== 'revive') return;
    // A summon's numbers are important-only (a quarter of its life at once: Homecoming's).
    if (target.summon && e.amount < maxHp * SUMMON_NUMBER_SHARE) return;
    let b = this.heal.get(e.target);
    if (!b) {
      b = bucket();
      this.heal.set(e.target, b);
    }
    const fresh = this.now - b.start > AGG || b.handle < 0 || !this.d.overlay.numberAlive(b.handle);
    if (fresh) {
      b.amount = 0;
      b.start = this.now;
      b.cut = this.healWasCut(e, target, state);
    }
    b.amount += e.amount;
    if (b.amount < 2) return;
    // Movement II: a heal the sim cut (a Wound; the Bloodmoon outside every Sanctuary pool) shows
    // smaller and dimmer. A revive is exempt: it stood them up whole.
    const cut = b.cut;
    const size =
      Math.min(30, 12 + 18 * Math.sqrt(Math.min(1, b.amount / maxHp))) * (cut ? CUT_HEAL_SIZE : 1);
    if (fresh || b.handle < 0)
      b.handle = this.d.overlay.spawnNumber(
        r.x + 0.35,
        r.height + 0.2,
        r.z,
        cut ? dimHex(VISION_HEX.heal, CUT_HEAL_ALPHA) : VISION_HEX.heal,
        size,
        0.9,
      );
    this.d.overlay.setNumber(b.handle, `+${Math.round(b.amount)}`, null, size, !fresh);
  }

  /**
   * An aura heal (Sostenuto's regeneration, batched by the sim about once a second): a few
   * notes rising in the healing aura's colour and a small, soft "♪+N" on the hero's other
   * side, distinct from Mend's numbers (which keep their own aggregation).
   */
  private auraHealed(
    e: SimEventOf<'healApplied'>,
    r: EntityRec,
    target: NonNullable<ReturnType<WorldState['entities']['get']>>,
    state: WorldState,
  ): void {
    const maxHp = target.health?.maxHp ?? 1;
    // A covered summon (Q1) carries its own mask (W2b's `summon.auraMask`).
    const mask = (target.hero?.auraMask ?? target.summon?.auraMask ?? 0) & REGEN_MASK;
    const cols = this.d.entities.auraColors(mask);
    const n = Math.min(4, 1 + Math.round((e.amount / maxHp) * 25));
    for (let i = 0; i < n * this.d.kit.particles.density; i++) {
      const a = Math.random() * Math.PI * 2;
      const rr = r.radius * (0.5 + Math.random() * 0.6);
      this.d.kit.particles.emit(
        r.x + Math.cos(a) * rr,
        0.25 + Math.random() * r.height * 0.5,
        r.z + Math.sin(a) * rr,
        0,
        1.1 + Math.random() * 0.6,
        0,
        1.1,
        0.11,
        cols.length > 0 ? cols[i % cols.length]! : C.heal,
        0.8,
        PARTICLE.note,
        0.6,
        -0.2,
      );
    }
    // A summon's regen ticks are never important: its notes, no number (two Saplings and the
    // Ancient would flood them).
    if (!this.settings.damageNumbers || target.team !== 'party' || target.summon) return;
    let b = this.auraHeal.get(e.target);
    if (!b) {
      b = bucket();
      this.auraHeal.set(e.target, b);
    }
    const fresh =
      this.now - b.start > AURA_AGG || b.handle < 0 || !this.d.overlay.numberAlive(b.handle);
    if (fresh) {
      b.amount = 0;
      b.start = this.now;
      b.cut = this.healWasCut(e, target, state);
    }
    b.amount += e.amount;
    if (b.amount < 1) return;
    const vision = currentVision();
    if (this.softHealFor !== vision) {
      this.softHealFor = vision;
      this.softHealHex = softenHex(VISION_HEX.heal, 0.45);
    }
    // A cut regen tick (Wound, Bloodmoon outside the pools) reads as Mend's cut numbers do.
    const cut = b.cut;
    // Smaller than Mend's (12–30 px) but legible: a regen tick is ~1–3% of max life.
    const size =
      (13 + 7 * Math.sqrt(Math.min(1, (b.amount / maxHp) * 8))) * (cut ? CUT_HEAL_SIZE : 1);
    if (fresh)
      b.handle = this.d.overlay.spawnNumber(
        r.x - 0.5,
        r.height * 0.75 + r.y,
        r.z,
        cut ? dimHex(this.softHealHex, CUT_HEAL_ALPHA) : this.softHealHex,
        size,
        1.25,
        true,
      );
    this.d.overlay.setNumber(b.handle, `${SONG_GLYPH}+${Math.round(b.amount)}`, null, size, !fresh);
  }

  /**
   * The Martyr healing herself (Blood Font, Sanguine Covenant; the sim reports it about once a
   * second): a small, soft "+N" in her rose beside her and no burst, since MartyrView already
   * draws Blood Font's embers and Covenant's return along the Thread.
   */
  private selfHealed(
    e: SimEventOf<'healApplied'>,
    r: EntityRec,
    target: NonNullable<ReturnType<WorldState['entities']['get']>>,
    state: WorldState,
  ): void {
    if (!this.settings.damageNumbers || this.importantOnly) return;
    let b = this.selfHeal.get(e.target);
    if (!b) {
      b = bucket();
      this.selfHeal.set(e.target, b);
    }
    const fresh =
      this.now - b.start > AURA_AGG || b.handle < 0 || !this.d.overlay.numberAlive(b.handle);
    if (fresh) {
      b.amount = 0;
      b.start = this.now;
      b.cut = this.healWasCut(e, target, state);
    }
    b.amount += e.amount;
    if (b.amount < 1) return;
    const maxHp = target.health?.maxHp ?? 1;
    // Blood Font under a Wound (or a Bloodmoon, if the sim cuts her): smaller and dimmer.
    const cut = b.cut;
    const size =
      (13 + 7 * Math.sqrt(Math.min(1, (b.amount / maxHp) * 8))) * (cut ? CUT_HEAL_SIZE : 1);
    if (fresh)
      b.handle = this.d.overlay.spawnNumber(
        r.x - 0.5,
        r.height * 0.75 + r.y,
        r.z,
        cut ? dimHex(MARTYR_HEX.rose, CUT_HEAL_ALPHA) : MARTYR_HEX.rose,
        size,
        1.25,
        true,
      );
    this.d.overlay.setNumber(b.handle, `+${Math.round(b.amount)}`, null, size, !fresh);
  }

  /**
   * Brann's lifesteal (the sim sums it every 0.5 s, `source` = Brann): crimson motes drawn in from
   * round him, as if pulled off the axe, and a small, soft "+N" in his ink in the self-heal bucket
   * (his own, so it never stacks with the Weaver's numbers). Never cut, never the Weaver's look.
   */
  private lifesteal(
    e: SimEventOf<'healApplied'>,
    r: EntityRec,
    target: NonNullable<ReturnType<WorldState['entities']['get']>>,
  ): void {
    this.fired5b.lifesteal++;
    const maxHp = target.health?.maxHp ?? 1;
    const ink = color(BRANN_HEX.ink);
    const mote = cuedFrenzy(target) ? LIFESTEAL_MOTE_CUED : LIFESTEAL_MOTE;
    const n = Math.min(5, 1 + Math.round((e.amount / maxHp) * 30));
    for (let i = 0; i < n * this.d.kit.particles.density; i++) {
      const a = Math.random() * Math.PI * 2;
      const rr = r.radius * (1.6 + Math.random() * 0.8);
      // From a ring round him, inward and up: drawn into him.
      this.d.kit.particles.emit(
        r.x + Math.cos(a) * rr,
        0.4 + Math.random() * r.height * 0.5,
        r.z + Math.sin(a) * rr,
        -Math.cos(a) * rr * 1.6,
        0.6,
        -Math.sin(a) * rr * 1.6,
        0.55,
        mote,
        ink,
        0.9,
        PARTICLE.dot,
        0.6,
      );
    }
    if (!this.settings.damageNumbers || this.importantOnly || target.team !== 'party') return;
    let b = this.selfHeal.get(e.target);
    if (!b) {
      b = bucket();
      this.selfHeal.set(e.target, b);
    }
    const fresh =
      this.now - b.start > AURA_AGG || b.handle < 0 || !this.d.overlay.numberAlive(b.handle);
    if (fresh) {
      b.amount = 0;
      b.start = this.now;
      b.cut = false;
    }
    b.amount += e.amount;
    if (b.amount < 1) return;
    const size = 13 + 7 * Math.sqrt(Math.min(1, (b.amount / maxHp) * 8));
    if (fresh)
      b.handle = this.d.overlay.spawnNumber(
        r.x - 0.5,
        r.height * 0.75 + r.y,
        r.z,
        BRANN_HEX.ink,
        size,
        1.25,
        true,
      );
    this.d.overlay.setNumber(b.handle, `+${Math.round(b.amount)}`, null, size, !fresh);
  }

  /**
   * Bloodletting (docs/phase-5b.md): life Brann spent on purpose. A palm-cut spark in his ink at
   * his hand and a calm "−N Bloodletting" in his ink, drawn as a drain: no hit flash, no shake, no
   * damage number style (the bar's drain segment is PartyBarsView's). Never an alarm.
   */
  private lifeSpent(e: SimEventOf<'lifeSpent'>, state: WorldState): void {
    const r = this.rec(e.hero);
    const hero = state.entities.get(e.hero);
    if (!r || !hero || e.amount <= 0) return;
    this.fired5b.drains++;
    const ink = color(BRANN_HEX.ink);
    this.d.kit.particles.burst(
      r.x,
      r.height * 0.5 + r.y,
      r.z,
      8,
      1.2,
      1.4,
      0.4,
      0.08,
      ink,
      1,
      PARTICLE.spark,
      2,
      2,
      r.radius * 0.5,
    );
    this.sprite(r.x, r.height * 0.5 + r.y, r.z, 0.25, 0.7, 0.35, ink, SPRITE.diamond, 0.9, e.hero);
    if (!this.settings.damageNumbers || this.importantOnly) return;
    const h = this.d.overlay.spawnNumber(
      r.x + 0.5,
      r.height * 0.6 + r.y,
      r.z,
      BRANN_HEX.ink,
      DRAIN_SIZE,
      1.1,
      true,
    );
    this.d.overlay.setNumber(h, `−${Math.round(e.amount)} Bloodletting`, null, DRAIN_SIZE, false);
  }

  /**
   * The sim cut this heal (Movement II: Wound, the Bloodmoon outside the pools; never a revive).
   * Counted once per number shown (`firedM2.cutHeals`).
   */
  private healWasCut(
    e: SimEventOf<'healApplied'>,
    target: NonNullable<ReturnType<WorldState['entities']['get']>>,
    state: WorldState,
  ): boolean {
    const cut = healCut(state, target, e.via, this.d.field.pools(state));
    if (cut) this.firedM2.cutHeals++;
    return cut;
  }

  private shieldApplied(e: SimEventOf<'shieldApplied'>): void {
    const r = this.rec(e.target);
    if (!r) return;
    if (e.shield === 'ward') {
      this.ring(
        r.x,
        r.z,
        r.radius * 2.6,
        r.radius * 1.5,
        0.25,
        C.shield,
        0.1,
        RING.plain,
        1,
        0.05,
        e.target,
      );
      this.d.kit.particles.burst(
        r.x,
        r.height * 0.5,
        r.z,
        10,
        2,
        2,
        0.45,
        0.12,
        C.shield,
        1,
        PARTICLE.shard,
        3,
        0,
        r.radius,
      );
    } else if (e.shield === 'overshield' || e.shield === 'dome') {
      this.ring(
        r.x,
        r.z,
        r.radius,
        r.radius * 2.2,
        0.35,
        e.shield === 'dome' ? C.dome : C.amp,
        0.08,
        RING.plain,
        0.9,
        0.05,
        e.target,
      );
    }
  }

  private shieldBroken(e: SimEventOf<'shieldBroken'>): void {
    const r = this.rec(e.target);
    if (!r) return;
    if (e.shield === 'barrier') return;
    const c = e.shield === 'discord' ? C.discord : e.shield === 'overshield' ? C.amp : C.shield;
    const big = e.shield === 'discord' || e.shield === 'dome';
    this.d.kit.particles.burst(
      r.x,
      r.height * 0.5,
      r.z,
      big ? 36 : 20,
      big ? 6 : 4.5,
      3,
      0.7,
      0.16,
      c,
      1,
      PARTICLE.shard,
      2.5,
      7,
      r.radius * 1.5,
    );
    this.ring(
      r.x,
      r.z,
      r.radius * 1.4,
      r.radius * (big ? 4 : 3),
      0.35,
      c,
      0.14,
      RING.plain,
      1,
      r.height * 0.4,
    );
    this.sprite(r.x, r.height * 0.5, r.z, r.radius * 2, r.radius * 3.4, 0.2, c, SPRITE.star, 0.9);
    if (big) this.d.rig.addTrauma(0.15);
  }

  private statusApplied(e: SimEventOf<'statusApplied'>): void {
    const r = this.rec(e.target);
    if (!r) return;
    if (
      e.status === 'dirge' ||
      e.status === 'silence' ||
      e.status === 'resound' ||
      e.status === 'sleep'
    ) {
      this.d.kit.smoke.burst(
        r.x,
        r.height * 0.8,
        r.z,
        10,
        1,
        0.5,
        1,
        0.4,
        C.ailment,
        0.6,
        PARTICLE.smoke,
        1.5,
        0.2,
        r.radius,
      );
    } else if (e.status === 'stun') {
      this.sprite(r.x, r.height + 0.2, r.z, 0.3, 1.2, 0.25, C.goldHot, SPRITE.star, 1);
    }
  }

  private resolved(e: SimEventOf<'telegraphResolved'>): void {
    const r = this.rec(e.target);
    if (!r) return;
    const y = r.height * 0.5 + r.y;
    switch (e.outcome) {
      case 'hit':
        this.d.kit.particles.burst(
          r.x,
          y,
          r.z,
          14,
          5,
          3,
          0.5,
          0.16,
          C.threat,
          1,
          PARTICLE.spark,
          3,
          5,
          r.radius,
        );
        break;
      case 'warded':
      case 'absorbed':
        this.ring(r.x, r.z, r.radius * 1.4, r.radius * 2.6, 0.3, C.shield, 0.12, RING.plain, 1, y);
        this.d.kit.particles.burst(
          r.x,
          y,
          r.z,
          12,
          4,
          2,
          0.45,
          0.13,
          C.shield,
          1,
          PARTICLE.shard,
          3,
          3,
          r.radius,
        );
        break;
      case 'dodged':
        this.ring(
          r.x,
          r.z,
          r.radius * 0.8,
          r.radius * 2,
          0.3,
          C.white,
          0.05,
          RING.dashed,
          0.5,
          0.05,
        );
        break;
      default:
        break;
    }
  }

  private technique(e: SimEventOf<'techniqueCast'>, state: WorldState): void {
    const w = this.rec(state.weaverId);
    if (!w) return;
    if (e.technique === 'ward' && e.target !== null) {
      const r = this.rec(e.target);
      if (r) this.beam(w.x, 1.1, w.z, r.x, r.height * 0.5, r.z, 0.3, 0.2, C.shield, BEAM.glow, 0.9);
      this.sprite(w.x, 1.1, w.z, 0.3, 1, 0.2, C.shield, SPRITE.star, 1);
    }
  }

  private perfectWard(e: SimEventOf<'perfectWard'>): void {
    const r = this.rec(e.target);
    if (!r) return;
    const cy = r.height * 0.5 + r.y;
    // Shell flare → shockwave rings.
    const s = this.alloc(K.Shell, 0.4);
    s.follow = e.target;
    s.r0 = r.radius * 1.6;
    s.r1 = r.radius * 2.8;
    s.y = cy;
    s.th = r.height * 0.62;
    s.style = SHELL.flare;
    s.color.copy(C.shield);
    this.sprite(r.x, cy, r.z, 0.8, 3.4, 0.3, WHITE_GOLD, SPRITE.star, 1, e.target, true);
    this.ring(r.x, r.z, 0.6, 7, 0.5, WHITE_GOLD, 0.3, RING.plain, 1, 0.06);
    this.ring(r.x, r.z, 0.4, 4.5, 0.65, C.shield, 0.16, RING.plain, 0.9, 0.06);
    this.ring(r.x, r.z, 0.3, 2.6, 0.35, C.gold, 0.5, RING.plain, 0.6, cy);
    this.d.kit.particles.burst(
      r.x,
      cy,
      r.z,
      34,
      7,
      3,
      0.7,
      0.16,
      C.shield,
      1,
      PARTICLE.shard,
      2.5,
      3,
      r.radius,
    );
    this.d.kit.particles.burst(
      r.x,
      cy,
      r.z,
      26,
      5,
      4,
      0.9,
      0.14,
      C.gold,
      1,
      PARTICLE.spark,
      2,
      2,
      r.radius,
    );
    // The attacker staggers.
    const owner = e.telegraph === null ? null : this.d.telegraphs.ownerOf(e.telegraph);
    if (owner !== null) {
      this.d.entities.staggerEntity(owner);
      const o = this.rec(owner);
      if (o) {
        this.d.kit.particles.burst(
          o.x,
          o.height * 0.7,
          o.z,
          16,
          4,
          2,
          0.5,
          0.13,
          C.white,
          1,
          PARTICLE.spark,
          3,
          3,
          o.radius,
        );
        this.sprite(o.x, o.height + 0.3, o.z, 0.4, 1.6, 0.4, C.goldHot, SPRITE.star, 1, owner);
      }
    }
    this.d.rig.addTrauma(0.42);
    this.d.rig.punch(-1.1, 5);
    this.d.overlay.spotlight(r.x, cy, r.z, 0.4);
    this.d.overlay.flash(0.28, 0.12);
    this.d.overlay.callout(r.x, r.height + 1.25, r.z, 'PERFECT', '#fff1c4', 28, 1.2);
  }

  /**
   * `rewound`: Rewind stood a downed hero back up, so the death did happen and is undone: no
   * falling ghost here (ChronoView plays their fall backwards instead). The rest is every Save's.
   */
  private save(e: SimEventOf<'save'>, state: WorldState, rewound = false): void {
    const r = this.rec(e.target);
    if (!r) return;
    this.d.entities.saveFlash(e.target);
    if (!rewound) this.deathThatDidntHappen(r);
    // Rewind moved them this tick: the Save plays where they stand back up.
    const hero = rewound ? state.entities.get(e.target) : undefined;
    const x = hero ? hero.x : r.x;
    const z = hero ? hero.z : r.z;
    const cy = r.height * 0.5 + (hero ? 0 : r.y);
    this.ring(
      x,
      z,
      r.radius * 3.5,
      r.radius * 1.2,
      0.45,
      C.gold,
      0.18,
      RING.plain,
      1,
      0.06,
      e.target,
    );
    this.ring(x, z, 0.5, 5, 0.6, C.gold, 0.2, RING.plain, 0.9, 0.06);
    // (Rewind's own moment rises from their feet instead of the pillar.)
    if (!rewound) this.beam(x, 0, z, x, 6, z, 1.2, 0.45, C.gold, BEAM.glow, 0.7);
    this.d.kit.particles.burst(
      x,
      cy,
      z,
      30,
      3,
      5,
      1,
      0.15,
      C.gold,
      1,
      PARTICLE.spark,
      1.8,
      1,
      r.radius * 1.4,
    );
    this.d.overlay.callout(x, r.height + 1.7, z, 'SAVED', '#fcd98a', 32, 1.5);
    this.d.overlay.spotlight(x, cy, z, 0.45);
    this.d.rig.punch(-1.8, 2.6);
    this.d.overlay.flash(0.2, 0.18);
  }

  private chimeLanded(e: SimEventOf<'chimeLanded'>): void {
    const big = e.clutch ? 1.35 : 1;
    this.ring(e.x, e.z, 0.3, e.radius * big, 0.4, CHIME, 0.22, RING.plain, 1, 0.06);
    this.ring(e.x, e.z, 0.2, e.radius * 0.7 * big, 0.55, C.ailment, 0.12, RING.plain, 0.9, 0.06);
    this.ring(e.x, e.z, e.radius, e.radius * 1.15, 0.6, C.gold, 0.06, RING.dashed, 0.8, 0.06);
    this.beam(e.x, 0, e.z, e.x, 6, e.z, 1.6 * big, 0.4, CHIME, BEAM.glow, 0.9);
    this.d.kit.particles.burst(
      e.x,
      0.3,
      e.z,
      34 * big,
      6,
      4,
      0.8,
      0.15,
      CHIME,
      1,
      PARTICLE.spark,
      2.5,
      3,
      0.6,
    );
    this.d.kit.particles.burst(
      e.x,
      1.5,
      e.z,
      10,
      2,
      2,
      1.2,
      0.18,
      C.gold,
      1,
      PARTICLE.note,
      1,
      -0.4,
      e.radius,
    );
    this.d.rig.addTrauma(e.clutch ? 0.22 : 0.1);
    if (e.clutch)
      this.d.overlay.callout(e.x, 2.6, e.z, 'CLUTCH', '#e9d5ff', 24, 1.2, 'rgba(167,139,250,0.95)');
  }

  private cleansed(e: SimEventOf<'cleansed'>): void {
    const r = this.rec(e.target);
    if (!r) return;
    // Ailment smoke rips off and up.
    const n = 16 + e.removed * 8;
    for (let i = 0; i < n * this.d.kit.smoke.density; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 2 + Math.random() * 3;
      this.d.kit.smoke.emit(
        r.x,
        r.height * (0.4 + Math.random() * 0.6),
        r.z,
        Math.cos(a) * s,
        3 + Math.random() * 3,
        Math.sin(a) * s,
        0.8,
        0.45,
        C.ailment,
        0.7,
        PARTICLE.smoke,
        2.5,
        -1,
        0.6,
      );
    }
    this.d.kit.particles.burst(
      r.x,
      r.height * 0.6,
      r.z,
      14,
      3,
      4,
      0.6,
      0.13,
      C.white,
      1,
      PARTICLE.spark,
      2.5,
      0,
      r.radius,
    );
    this.ring(
      r.x,
      r.z,
      r.radius * 0.8,
      r.radius * 2.6,
      0.35,
      CHIME,
      0.1,
      RING.plain,
      1,
      r.height * 0.6,
      e.target,
    );
  }

  private reeled(e: SimEventOf<'reeled'>, state: WorldState): void {
    const t = this.alloc(K.Trail, 0.9);
    t.follow = e.target;
    const w = state.entities.get(state.weaverId)?.weaver;
    t.color.copy(w?.threadMode === 'empower' ? C.amp : w?.threadMode === 'bear' ? C.bear : C.heal);
    this.ring(e.fromX, e.fromZ, 0.4, 2, 0.35, t.color, 0.1, RING.plain, 1);
    const r = this.rec(e.target);
    if (r)
      this.d.kit.particles.burst(
        e.fromX,
        0.4,
        e.fromZ,
        14,
        3,
        3,
        0.5,
        0.12,
        t.color,
        1,
        PARTICLE.spark,
        3,
        3,
        r.radius,
      );
  }

  private glided(e: SimEventOf<'glided'>, state: WorldState): void {
    // Skate (a Glide variant, docs/phase-4f/vfx-audio.md) dashes in a look of its own
    // (VariantsView): blade marks, two afterimages, a carve. The Glide's own is the default's.
    if (state.entities.get(state.weaverId)?.weaver?.variants?.glide === 'skate') return;
    const w = this.rec(state.weaverId);
    const yaw = Math.atan2(-(e.toX - e.fromX), -(e.toZ - e.fromZ));
    for (let i = 0; i < 5; i++) {
      const k = i / 4;
      this.d.entities.ghost(
        e.fromX + (e.toX - e.fromX) * k * 0.85,
        e.fromZ + (e.toZ - e.fromZ) * k * 0.85,
        yaw,
        k * 0.12,
      );
    }
    this.beam(e.fromX, 1, e.fromZ, e.toX, 1, e.toZ, 0.9, 0.3, C.goldHot, BEAM.glow, 0.7);
    this.beam(e.fromX, 0.25, e.fromZ, e.toX, 0.25, e.toZ, 0.4, 0.4, C.gold, BEAM.glow, 0.5);
    this.d.kit.particles.burst(
      e.fromX,
      0.3,
      e.fromZ,
      14,
      3,
      1.5,
      0.5,
      0.12,
      C.gold,
      1,
      PARTICLE.spark,
      3,
      2,
      0.6,
    );
    void w;
  }

  private revived(id: EntityId): void {
    const r = this.rec(id);
    if (!r) return;
    this.beam(r.x, 0, r.z, r.x, 7, r.z, 1.5, 0.6, C.heal, BEAM.glow, 0.9);
    this.ring(r.x, r.z, 0.3, 3.2, 0.5, C.heal, 0.2, RING.plain, 1);
    this.d.kit.particles.burst(
      r.x,
      0.4,
      r.z,
      30,
      3,
      5,
      1,
      0.14,
      C.heal,
      1,
      PARTICLE.dot,
      1.6,
      -0.5,
      r.radius,
    );
    this.d.overlay.callout(
      r.x,
      r.height + 1.1,
      r.z,
      'REVIVED',
      VISION_HEX.heal,
      18,
      1.1,
      rgba(VISION_HEX.heal, 0.9),
    );
  }

  /**
   * The Chronomancer's Stasis: time stops. A cool flash and the camera held still (a small push
   * in, no shake); ChronoView draws the moment and the light cools while it lasts (stasisCool).
   */
  private stasisStart(): void {
    this.d.rig.punch(-1.6, 1.4);
    this.d.overlay.coolFlash(0.22, 0.24);
  }

  /**
   * The Conductor's Grand Finale (docs/phase-5f.md): no Sunrise (no gold rings, pillar, field
   * blaze, chroma, flash or warm light), only a small push of the camera; its turns are drawn by
   * ConductView.
   */
  private finaleStart(): void {
    this.d.rig.punch(-1.2, 1.2);
  }

  /** Martyr's Vow: the light dims toward crimson, a small weight on the camera, a soft flash. */
  private vowStart(): void {
    this.lightShift = 0.55;
    this.lightColor.copy(VOW_LIGHT);
    this.d.rig.punch(-2.2, 2.2);
    this.d.rig.addTrauma(0.18);
    this.d.overlay.flash(0.12, 0.2);
  }

  private crescendo(state: WorldState): void {
    const w = this.rec(state.weaverId);
    this.d.field.crescendoBlaze();
    this.d.overlay.chroma();
    // The sky responds: a warm swell of the key light.
    this.lightShift = 1;
    this.lightColor.copy(C.gold);
    this.d.rig.punch(5, 1.4);
    this.d.rig.addTrauma(0.3);
    this.d.overlay.flash(0.3, 0.25);
    if (!w) return;
    this.d.overlay.spotlight(w.x, 1, w.z, 0.4);
    const R = state.field.radius;
    for (let i = 0; i < 3; i++)
      this.ring(
        w.x,
        w.z,
        0.5,
        R * (1.1 + i * 0.35),
        0.6 + i * 0.2,
        i === 1 ? C.goldHot : C.gold,
        0.25,
        RING.plain,
        1,
        0.06,
        state.weaverId,
      );
    this.beam(w.x, 0, w.z, w.x, 10, w.z, 2.4, 0.7, C.goldHot, BEAM.glow, 0.9);
    this.d.kit.particles.burst(
      w.x,
      0.5,
      w.z,
      70,
      8,
      6,
      1.3,
      0.18,
      C.gold,
      1,
      PARTICLE.spark,
      1.6,
      2,
      1,
    );
    this.d.kit.particles.burst(
      w.x,
      1.5,
      w.z,
      20,
      3,
      3,
      1.6,
      0.2,
      C.resonance,
      1,
      PARTICLE.note,
      0.8,
      -0.5,
      R,
    );
  }

  private solo(e: SimEventOf<'soloStarted'>, state: WorldState): void {
    const r = this.rec(e.hero);
    if (!r) return;
    const c = e.cued ? C.amp : this.signal(state, e.hero, r.color);
    this.ring(r.x, r.z, 0.4, 3.4, 0.5, c, 0.2, RING.plain, 1, 0.05, e.hero);
    // Red Frenzy (Brann): its whirl and swipe ring are drawn from the state while it lasts
    // (EntityLayer); here, the burst of brass it starts with.
    if (e.solo === 'redFrenzy') this.fired5b.frenzies++;
    if (e.cued) {
      this.sprite(r.x, r.height + 1.1, r.z, 1.3, 1.6, 1.5, C.amp, SPRITE.sigil, 1, e.hero, true);
      this.sprite(
        r.x,
        r.height + 1.1,
        r.z,
        1.0,
        2.6,
        0.5,
        C.goldHot,
        SPRITE.glow,
        0.8,
        e.hero,
        true,
      );
      this.d.kit.particles.burst(
        r.x,
        r.height * 0.6,
        r.z,
        28,
        4,
        4,
        0.9,
        0.15,
        C.amp,
        1,
        PARTICLE.spark,
        2,
        1,
        r.radius,
      );
      this.d.overlay.spotlight(r.x, r.height * 0.6, r.z, 0.4);
    }
    if (e.solo === 'aegisWall' && e.cued) {
      const t = this.alloc(K.Dome, Math.max(0.5, e.duration));
      t.follow = e.hero;
      t.r0 = state.field.radius;
      t.color.copy(C.dome);
      this.d.rig.addTrauma(0.2);
    }
  }

  private ability(e: SimEventOf<'abilityUsed'>, state: WorldState): void {
    const src = state.entities.get(e.source);
    const r = this.rec(e.source);
    if (e.ability === 'aegisWall') return;
    const c = r
      ? src?.kind === 'hero'
        ? this.signal(state, e.source, r.color)
        : r.accent
      : C.threat;
    const radius = Math.max(1.2, e.radius);
    if (e.ability === 'gravityWell') {
      const t = this.ring(e.x, e.z, radius, radius * 0.4, 1.1, c, 0.12, RING.portal, 1, 0.05);
      t.arcLen = 7;
      this.d.kit.particles.burst(
        e.x,
        0.6,
        e.z,
        24,
        -3,
        1,
        0.9,
        0.14,
        c,
        1,
        PARTICLE.spark,
        0.5,
        0,
        radius * 2,
      );
      return;
    }
    if (e.ability === 'challenge') {
      this.ring(e.x, e.z, 0.5, radius, 0.45, c, 0.25, RING.plain, 1);
      this.ring(e.x, e.z, 0.3, radius * 0.7, 0.55, C.white, 0.1, RING.plain, 0.7);
      this.d.rig.addTrauma(0.12);
      return;
    }
    if (e.ability === 'shieldBash') {
      this.d.kit.particles.burst(
        e.x,
        1,
        e.z,
        20,
        5,
        3,
        0.5,
        0.15,
        C.white,
        1,
        PARTICLE.spark,
        3,
        4,
        0.5,
      );
      this.sprite(e.x, 1, e.z, 0.4, 1.8, 0.2, c, SPRITE.star, 1);
      this.d.rig.addTrauma(0.1);
      return;
    }
    this.ring(e.x, e.z, radius * 0.3, radius, 0.45, c, 0.16, RING.plain, 0.9);
    this.d.kit.particles.burst(
      e.x,
      0.5,
      e.z,
      12,
      3,
      2.5,
      0.6,
      0.13,
      c,
      1,
      PARTICLE.spark,
      2.5,
      2,
      radius,
    );
  }

  private killed(e: SimEventOf<'enemyKilled'>, state: WorldState): void {
    this.d.entities.markDying(e.enemy);
    const r = this.rec(e.enemy);
    let accent = C.ailment;
    let size = 0.5;
    let height = 1.5;
    let boss = false;
    let iron = false;
    let cloth = false;
    let glass = false;
    try {
      const def = enemyDef(e.defId);
      accent = color(def.accent);
      size = def.radius;
      height = def.height;
      boss = def.role === 'boss' || def.role === 'miniboss';
      const material = materialOf(def);
      iron = material === 'iron';
      cloth = material === 'cloth';
      glass = material === 'glass';
    } catch {
      // unknown def
    }
    const x = r?.x ?? e.x;
    const z = r?.z ?? e.z;
    if (iron) {
      this.ironDeath(x, z, size, height, accent, boss);
      return;
    }
    if (cloth) {
      if (e.defId === STOLEN_VERSE_ID) {
        this.verseAt.x = x;
        this.verseAt.z = z;
        this.verseAt.known = true;
      }
      this.clothDeath(x, z, size, height, accent, boss);
      return;
    }
    if (glass) {
      // The Finale's choir and Conductor: prism shards rising as notes (crucibleCues.ts).
      this.crucible.glassDeath(x, z, size, height, accent, boss);
      return;
    }
    this.d.kit.particles.burst(
      x,
      height * 0.5,
      z,
      14 + size * 14,
      3 + size * 2,
      3.5,
      0.9,
      0.14 + size * 0.06,
      SHARD,
      1,
      PARTICLE.shard,
      2.2,
      7,
      size,
    );
    this.d.kit.particles.burst(
      x,
      height * 0.6,
      z,
      10 + size * 8,
      2.5,
      2.5,
      0.8,
      0.13,
      accent,
      1,
      PARTICLE.spark,
      2,
      1,
      size,
    );
    this.ring(x, z, size, size * 3.2, 0.4, accent, 0.12, RING.plain, 0.9);
    this.sprite(x, height * 0.55, z, size * 1.5, size * 3, 0.18, C.white, SPRITE.glow, 0.9);
    if (boss) {
      this.d.rig.addTrauma(0.6);
      this.d.rig.panToward(x, z, 0.5, 1.4);
      for (let i = 0; i < 3; i++)
        this.ring(
          x,
          z,
          size,
          10 + i * 5,
          0.8 + i * 0.3,
          i === 0 ? C.white : accent,
          0.3,
          RING.plain,
          1,
        );
      this.d.overlay.flash(0.35, 0.3);
    }
    void state;
  }

  /**
   * An iron body's death (Movement II, `material: 'iron'`): dark iron shards and ember sparks
   * thrown out, smoke rising where it fell, its accent's ring. Never a red mist.
   */
  private ironDeath(
    x: number,
    z: number,
    size: number,
    height: number,
    accent: THREE.Color,
    boss: boolean,
  ): void {
    this.firedM2.ironDeaths++;
    const kit = this.d.kit;
    kit.particles.burst(
      x,
      height * 0.5,
      z,
      12 + size * 12,
      3 + size * 2,
      3,
      0.9,
      0.15 + size * 0.06,
      IRON,
      1,
      PARTICLE.shard,
      2,
      9,
      size,
    );
    kit.particles.burst(
      x,
      height * 0.55,
      z,
      12 + size * 10,
      3.5,
      4,
      0.8,
      0.1,
      EMBER,
      1,
      PARTICLE.spark,
      2,
      3,
      size,
    );
    const puffs = Math.round((5 + size * 6) * kit.smoke.density);
    for (let i = 0; i < puffs; i++) {
      const a = Math.random() * Math.PI * 2;
      const rr = size * Math.random();
      kit.smoke.emit(
        x + Math.cos(a) * rr,
        0.3 + Math.random() * height * 0.5,
        z + Math.sin(a) * rr,
        Math.cos(a) * 0.4,
        0.5 + Math.random() * 0.4,
        Math.sin(a) * 0.4,
        1.4,
        0.5 + size * 0.3,
        IRON_SMOKE,
        0.5,
        PARTICLE.smoke,
        1.2,
        0,
        0.8,
      );
    }
    this.ring(x, z, size, size * 3.2, 0.4, accent, 0.12, RING.plain, 0.9);
    this.sprite(x, height * 0.55, z, size * 1.5, size * 3, 0.18, EMBER, SPRITE.glow, 0.8);
    if (boss) {
      this.d.rig.addTrauma(0.6);
      this.d.rig.panToward(x, z, 0.5, 1.4);
      for (let i = 0; i < 3; i++)
        this.ring(
          x,
          z,
          size,
          10 + i * 5,
          0.8 + i * 0.3,
          i === 0 ? EMBER : accent,
          0.3,
          RING.plain,
          1,
        );
      this.d.overlay.flash(0.35, 0.3);
    }
  }

  // ── Movement III (docs/phase-5c/vfx-audio.md) ───────────────────────────────────────────

  /**
   * A cloth body's death (`material: 'cloth'`): it unravels. Strands whip off it (long spark
   * streaks in its accent and bone), loose fray motes drift down, indigo smoke rises where it
   * stood. Never a red mist, never porcelain shards.
   */
  private clothDeath(
    x: number,
    z: number,
    size: number,
    height: number,
    accent: THREE.Color,
    boss: boolean,
  ): void {
    this.firedM3.clothDeaths++;
    const kit = this.d.kit;
    kit.particles.burst(
      x,
      height * 0.55,
      z,
      14 + size * 12,
      4.5,
      2.5,
      0.7,
      0.12,
      BONE,
      1,
      PARTICLE.spark,
      1.6,
      1,
      size,
    );
    kit.particles.burst(
      x,
      height * 0.5,
      z,
      10 + size * 8,
      3.5,
      3,
      0.8,
      0.11,
      accent,
      1,
      PARTICLE.spark,
      2,
      1,
      size,
    );
    kit.particles.burst(
      x,
      height * 0.6,
      z,
      12 + size * 10,
      1.2,
      1.4,
      1.6,
      0.09,
      FRAY_MOTE,
      0.9,
      PARTICLE.dot,
      1.2,
      0.6,
      size * 1.4,
    );
    const puffs = Math.round((5 + size * 6) * kit.smoke.density);
    for (let i = 0; i < puffs; i++) {
      const a = Math.random() * Math.PI * 2;
      const rr = size * Math.random();
      kit.smoke.emit(
        x + Math.cos(a) * rr,
        0.3 + Math.random() * height * 0.5,
        z + Math.sin(a) * rr,
        Math.cos(a) * 0.3,
        0.45 + Math.random() * 0.4,
        Math.sin(a) * 0.3,
        1.5,
        0.5 + size * 0.3,
        CLOTH_SMOKE,
        0.55,
        PARTICLE.smoke,
        1.2,
        0,
        0.8,
      );
    }
    this.ring(x, z, size, size * 3, 0.45, accent, 0.1, RING.dashed, 0.8);
    this.sprite(x, height * 0.55, z, size * 1.4, size * 2.6, 0.2, BONE, SPRITE.glow, 0.6);
    if (boss) {
      this.d.rig.addTrauma(0.6);
      this.d.rig.panToward(x, z, 0.5, 1.4);
      for (let i = 0; i < 3; i++)
        this.ring(
          x,
          z,
          size,
          10 + i * 5,
          0.8 + i * 0.3,
          i === 0 ? BONE : accent,
          0.3,
          RING.plain,
          1,
        );
      this.d.overlay.flash(0.35, 0.3);
    }
  }

  /** An enemy cut the Thread: the fray callout (CUT, or UNPICKED for the Unpick) and the stub. */
  private cutThread(cause: string, lock: number, r: EntityRec | undefined): void {
    this.d.thread.cut(cause, lock);
    this.firedM3.cuts++;
    if (cause === 'unpick') this.firedM3.unpicked++;
    if (!r) return;
    this.d.overlay.callout(
      r.x,
      r.height + 1.1,
      r.z,
      cutLabel(cause),
      RIFT_HEX.fray,
      cause === 'unpick' ? 18 : 17,
      1.1,
      rgba(RIFT_HEX.fray, 0.85),
    );
    this.d.kit.particles.burst(
      r.x,
      r.height * 0.6,
      r.z,
      10,
      3,
      2,
      0.5,
      0.1,
      FRAY,
      1,
      PARTICLE.spark,
      2.5,
      2,
    );
  }

  /** Guard Strand turned a cut aside (`cutResolved 'strand'`): a silk spark at the crossing. */
  private strandCut(e: SimEventOf<'cutResolved'>, state: WorldState): void {
    const g = this.d.telegraphs.geometry(e.telegraph);
    const seg = threadSegment(state);
    let x = seg ? (seg.ax + seg.bx) / 2 : (g?.cx ?? 0);
    let z = seg ? (seg.az + seg.bz) / 2 : (g?.cz ?? 0);
    if (seg && g && g.shape === 'line') {
      const c = Math.cos(g.rot) * g.a;
      const s = Math.sin(g.rot) * g.a;
      const out = { x, z };
      if (crossing(g.cx - c, g.cz - s, g.cx + c, g.cz + s, seg.ax, seg.az, seg.bx, seg.bz, out)) {
        x = out.x;
        z = out.z;
      }
    }
    this.strandSpark(x, z);
  }

  /** A silk spark: Guard Strand turned a cut aside, or destroyed a bolt crossing the Thread. */
  private strandSpark(x: number, z: number): void {
    this.firedM3.strands++;
    this.d.kit.particles.burst(x, 1, z, 16, 4, 2.5, 0.45, 0.1, STRAND, 1, PARTICLE.spark, 3, 2);
    this.ring(x, z, 0.2, 1.4, 0.3, STRAND, 0.1, RING.plain, 1, 1);
    this.sprite(x, 1, z, 0.3, 0.9, 0.22, STRAND, SPRITE.star, 1);
  }

  /** A hero was possessed: POSSESSED in indigo over them, a ring closing on them. */
  private possessed(hero: EntityId): void {
    this.firedM3.possessed++;
    const r = this.rec(hero);
    if (!r) return;
    this.ring(
      r.x,
      r.z,
      r.radius * 3,
      r.radius * 1.2,
      0.45,
      POSSESS,
      0.14,
      RING.plain,
      1,
      0.05,
      hero,
    );
    this.d.overlay.callout(
      r.x,
      r.height + 1.2,
      r.z,
      'POSSESSED',
      RIFT_HEX.possess,
      16,
      1,
      rgba(RIFT_HEX.possess, 0.8),
    );
  }

  /** Freed of possession or a stitch (a Chime, a Reel): it breaks like glass off them. */
  private freed(hero: EntityId, status: string): void {
    if (status !== 'possessed' && status !== 'stitched') return;
    this.firedM3.freed++;
    const r = this.rec(hero);
    if (!r) return;
    const c = status === 'possessed' ? POSSESS : STITCH;
    this.d.kit.particles.burst(
      r.x,
      r.height * 0.6,
      r.z,
      14,
      3.5,
      2.5,
      0.5,
      0.12,
      c,
      1,
      PARTICLE.shard,
      3,
      5,
      r.radius,
    );
    this.ring(r.x, r.z, r.radius, r.radius * 3, 0.35, C.white, 0.1, RING.plain, 0.9);
  }

  /** The Mimic's copy no longer matched what you cast: the mirror cracks, a glass burst. */
  private mirrorCracked(enemy: EntityId): void {
    this.firedM3.cracked++;
    const r = this.rec(enemy);
    if (!r) return;
    const y = r.height * 0.6 + r.y;
    this.d.kit.particles.burst(
      r.x,
      y,
      r.z,
      22,
      4.5,
      3,
      0.6,
      0.13,
      MIRROR,
      1,
      PARTICLE.shard,
      2.5,
      6,
      r.radius,
    );
    this.sprite(r.x, y, r.z, 0.4, 1.2, 0.3, MIRROR, SPRITE.mirror, 1, enemy);
    this.d.overlay.callout(
      r.x,
      r.height + 1.2,
      r.z,
      'MIRROR CRACKED',
      RIFT_HEX.mirror,
      16,
      1,
      rgba(RIFT_HEX.mirror, 0.75),
    );
  }

  /** The Unweaver's Mirror Ward landed on its champion: a mirrored flash (its shell persists). */
  private mirrorWard(enemy: EntityId): void {
    this.firedM3.mirrorWards++;
    const r = this.rec(enemy);
    if (!r) return;
    this.ring(
      r.x,
      r.z,
      r.radius * 2.6,
      r.radius * 1.4,
      0.4,
      MIRROR,
      0.16,
      RING.plain,
      1,
      0.05,
      enemy,
    );
    this.d.overlay.callout(
      r.x,
      r.height + 1.2,
      r.z,
      'MIRROR WARD',
      RIFT_HEX.mirror,
      15,
      0.9,
      rgba(RIFT_HEX.mirror, 0.7),
    );
  }

  /** Steal Verse: the aura is torn out of the Weaver's song and flies to the Stolen Verse. */
  private verseStolen(aura: string, add: EntityId, state: WorldState): void {
    this.firedM3.steals++;
    const w = this.rec(state.weaverId);
    const a = this.rec(add);
    if (!w) return;
    const c = auraColor(aura);
    this.ring(w.x, w.z, 2.4, 0.4, 0.5, c, 0.14, RING.dashed, 1, 0.05, state.weaverId);
    if (a) this.beam(w.x, 1, w.z, a.x, a.height * 0.6, a.z, 0.5, 0.6, c, BEAM.lance, 0.9);
  }

  /**
   * The aura comes back: killed, it pours from where the Verse fell into the Weaver (a stream
   * in its colour and a ring on her); on its own or at phase 3, it settles back where she stands.
   */
  private verseReturned(aura: string, reason: string, state: WorldState): void {
    this.firedM3.pours++;
    const w = this.rec(state.weaverId);
    if (!w) return;
    const c = auraColor(aura);
    if (reason === 'killed' && this.verseAt.known) {
      const { x, z } = this.verseAt;
      this.beam(x, 1, z, w.x, 1.1, w.z, 0.7, 0.8, c, BEAM.lance, 1);
      const dx = w.x - x;
      const dz = w.z - z;
      const d = Math.hypot(dx, dz) || 1;
      for (let i = 0; i < 18; i++) {
        const t = i / 18;
        this.d.kit.particles.emit(
          x + dx * t * 0.3,
          1,
          z + dz * t * 0.3,
          (dx / d) * 6,
          0.6,
          (dz / d) * 6,
          0.6,
          0.13,
          c,
          1,
          PARTICLE.note,
          0.6,
          0,
        );
      }
    }
    this.verseAt.known = false;
    this.ring(w.x, w.z, 0.4, 2.6, 0.6, c, 0.16, RING.plain, 1, 0.05, state.weaverId);
  }

  /** Unravel opens: UNRAVEL in lethal at the Weaver (the Thread itself turns, thread.ts). */
  private unravelOpened(state: WorldState): void {
    this.firedM3.unravels++;
    const w = this.rec(state.weaverId);
    if (!w) return;
    this.d.overlay.callout(
      w.x,
      w.height + 1.3,
      w.z,
      'UNRAVEL',
      VISION_HEX.lethal,
      17,
      1.1,
      rgba(VISION_HEX.lethal, 0.8),
    );
  }

  /** A zone is laid: a pull's swirl gulps in, a rune's ring flashes down. */
  private zoneLaid(kind: 'pull' | 'null', x: number, z: number, r: number): void {
    this.firedM3.zones++;
    if (kind === 'pull') this.ring(x, z, r * 1.2, r * 0.3, 0.5, SWIRL, 0.18, RING.plain, 1);
    else this.ring(x, z, r * 1.5, r, 0.35, RUNE, 0.14, RING.plain, 1);
  }

  /** A hit on the Unweaver cut down by its Spindles (the sim rate-limits it): '−80%'. */
  private spindledHit(enemy: EntityId): void {
    this.firedM3.spindled++;
    const r = this.rec(enemy);
    if (!r) return;
    this.d.overlay.callout(
      r.x,
      r.height + 0.6,
      r.z,
      SPINDLED_LABEL,
      RIFT_HEX.spindle,
      13,
      0.6,
      rgba(RIFT_HEX.spindle, 0.7),
    );
  }

  private phase(e: SimEventOf<'phaseChanged'>): void {
    const r = this.rec(e.boss);
    if (!r) return;
    this.d.kit.particles.burst(
      r.x,
      r.height * 0.6,
      r.z,
      70,
      8,
      5,
      1.1,
      0.2,
      SHARD,
      1,
      PARTICLE.shard,
      1.8,
      7,
      r.radius,
    );
    this.d.kit.particles.burst(
      r.x,
      r.height * 0.6,
      r.z,
      40,
      6,
      4,
      1.1,
      0.18,
      r.accent,
      1,
      PARTICLE.spark,
      1.8,
      2,
      r.radius,
    );
    this.ring(r.x, r.z, r.radius, 12, 0.8, r.accent, 0.3, RING.plain, 1);
    this.ring(r.x, r.z, r.radius, 7, 0.6, C.white, 0.15, RING.plain, 0.8);
    const s = this.alloc(K.Shell, 0.5);
    s.follow = e.boss;
    s.r0 = r.radius * 1.5;
    s.r1 = r.radius * 3;
    s.y = r.height * 0.5;
    s.th = r.height * 0.7;
    s.style = SHELL.flare;
    s.color.copy(r.accent);
    this.d.rig.addTrauma(0.5);
    this.d.rig.panToward(r.x, r.z, 0.45, 1.6);
    this.d.overlay.spotlight(r.x, r.height * 0.6, r.z, 0.5);
    this.d.overlay.flash(0.25, 0.2);
    this.lightShift = 1;
    this.lightColor.copy(r.accent);
  }

  // ── Phase 2: the death that didn't happen, Chords, Fermata, Call and Response ───────

  /** Signature 1: the saved hero's ghost falls where they stood (entities.ts) + ash and a rim. */
  private deathThatDidntHappen(r: EntityRec): void {
    if (!this.d.entities.saveGhost(r.id)) return;
    this.d.kit.particles.burst(
      r.x,
      r.height * 0.6,
      r.z,
      18,
      1.2,
      0.4,
      1.1,
      0.12,
      GHOST_ASH,
      0.8,
      PARTICLE.shard,
      1.2,
      -1.5,
      r.radius,
    );
    this.ring(r.x, r.z, r.radius * 2.4, r.radius * 0.9, 0.5, GHOST_ASH, 0.08, RING.plain, 0.7);
  }

  private planted(e: SimEventOf<'fieldPlanted'>, state: WorldState): void {
    this.d.field.planted(e.chord);
    const c = state.field.chords[e.chord];
    const a0 = c && c.auras[0] ? auraColor(c.auras[0]) : C.gold;
    const radius = c ? c.radius : 6;
    // The streak from where it stood, and the stake driven in.
    this.beam(e.fromX, 0.12, e.fromZ, e.x, 0.12, e.z, 0.6, 0.35, a0, BEAM.glow, 0.85);
    this.beam(e.fromX, 0.14, e.fromZ, e.x, 0.14, e.z, 0.16, 0.3, C.goldHot, BEAM.glow, 1);
    this.beam(e.x, 7, e.z, e.x, 0, e.z, 0.6, 0.22, C.goldHot, BEAM.glow, 1);
    this.ring(e.x, e.z, 0.3, 2.6, 0.4, C.goldHot, 0.22, RING.plain, 1, 0.06);
    this.ring(e.x, e.z, 0.4, radius * 0.5, 0.5, a0, 0.12, RING.plain, 0.85, 0.06);
    this.d.kit.particles.burst(
      e.x,
      0.15,
      e.z,
      26,
      5,
      2.5,
      0.6,
      0.14,
      C.gold,
      1,
      PARTICLE.spark,
      2.5,
      5,
      0.4,
    );
    this.d.kit.smoke.burst(
      e.x,
      0.2,
      e.z,
      8,
      2.2,
      0.6,
      0.9,
      0.4,
      DUST,
      0.4,
      PARTICLE.smoke,
      2,
      0,
      0.6,
    );
    this.d.rig.addTrauma(0.12);
  }

  /**
   * Chorus: every Chord with auras rings out once per aura, in aura colours, scaled by `auras`
   * (a Unison beam song, which has no field, rings at its hero).
   */
  private chorus(e: SimEventOf<'chorusPulse'>, state: WorldState): void {
    const k = 1 + 0.18 * Math.max(0, e.auras - 3);
    const chords = state.field.chords;
    for (let i = 0; i < chords.length; i++) {
      const c = chords[i]!;
      if (c.auras.length === 0) continue;
      if (!this.d.field.centreOf(state, i, this.centre)) continue;
      const x = this.centre.x;
      const z = this.centre.z;
      const onHero = fieldLook(c) === 'none';
      const follow = onHero ? (c.threadHero ?? -1) : c.anchor === 'weaver' ? state.weaverId : -1;
      const R = onHero ? 3 : c.radius;
      for (let j = 0; j < c.auras.length; j++) {
        this.ring(
          x,
          z,
          0.4,
          R * (1.02 + 0.08 * j),
          0.55 + 0.14 * j,
          auraColor(c.auras[j]!),
          0.16 * k,
          RING.plain,
          1,
          0.06,
          follow,
        );
      }
      // The heal + barrier it carries.
      this.ring(x, z, 0.3, R * 0.75, 0.5, C.heal, 0.1 * k, RING.plain, 0.8, 0.07, follow);
      this.ring(x, z, R * 0.4, R * 0.95, 0.65, C.shield, 0.06, RING.dashed, 0.7, 0.07, follow);
      this.d.kit.particles.burst(
        x,
        0.3,
        z,
        8 + 4 * e.auras,
        2.5,
        2.5,
        0.9,
        0.13,
        C.heal,
        0.95,
        PARTICLE.note,
        1.2,
        -0.3,
        R * 0.6,
      );
    }
  }

  private fermataHold(e: SimEventOf<'fermataHold'>): void {
    const r = this.rec(e.hero);
    if (!r) return;
    const cy = r.height * 0.5 + r.y;
    // The hit stops dead: a lavender flare snaps inward, the moment is spotlit.
    const s = this.alloc(K.Shell, 0.3);
    s.follow = e.hero;
    s.r0 = r.radius * 3;
    s.r1 = r.radius * 1.7;
    s.y = cy;
    s.th = r.height * 0.66;
    s.style = SHELL.flare;
    s.color.copy(FERMATA_COLOR);
    this.ring(r.x, r.z, r.radius * 5, r.radius * 2.2, 0.35, FERMATA_COLOR, 0.16, RING.plain, 1);
    this.sprite(
      r.x,
      r.height + 0.95,
      r.z,
      1.4,
      0.5,
      0.3,
      FERMATA_COLOR,
      SPRITE.star,
      1,
      e.hero,
      true,
    );
    this.d.overlay.callout(
      r.x,
      r.height + 1.75,
      r.z,
      'HOLD',
      '#f3edff',
      24,
      0.7,
      'rgba(226,214,248,0.95)',
    );
    this.d.overlay.spotlight(r.x, cy, r.z, 0.5);
    this.d.rig.punch(-0.9, 4);
  }

  private fermataReleased(e: SimEventOf<'fermataReleased'>): void {
    const r = this.rec(e.hero);
    if (!r) return;
    const gy = r.height + 0.95 + r.y;
    if (!e.saved) {
      // The held note breaks: the glyph cracks and falls; downed visuals follow from state.
      this.d.kit.particles.burst(
        r.x,
        gy,
        r.z,
        14,
        1.5,
        0.5,
        0.8,
        0.1,
        FERMATA_COLOR,
        0.8,
        PARTICLE.shard,
        1,
        -6,
        0.2,
      );
      return;
    }
    const cy = r.height * 0.5 + r.y;
    const s = this.alloc(K.Shell, 0.35);
    s.follow = e.hero;
    s.r0 = r.radius * 1.75;
    s.r1 = r.radius * 2.4;
    s.y = cy;
    s.th = r.height * 0.66;
    s.style = SHELL.flare;
    s.alpha = 0.35;
    s.color.copy(C.heal);
    this.ring(r.x, r.z, 0.4, 4.5, 0.55, C.heal, 0.2, RING.plain, 1, 0.06);
    this.ring(r.x, r.z, 0.3, 3, 0.45, FERMATA_COLOR, 0.12, RING.plain, 0.9, 0.06);
    this.sprite(r.x, gy, r.z, 0.5, 2.2, 0.3, FERMATA_COLOR, SPRITE.star, 1, e.hero, true);
    this.d.kit.particles.burst(
      r.x,
      gy,
      r.z,
      22,
      4,
      2,
      0.6,
      0.12,
      FERMATA_COLOR,
      1,
      PARTICLE.shard,
      2,
      2,
      0.2,
    );
    this.d.kit.particles.burst(
      r.x,
      cy,
      r.z,
      20,
      3,
      4,
      0.9,
      0.13,
      C.heal,
      1,
      PARTICLE.spark,
      1.8,
      1,
      r.radius,
    );
    this.deathThatDidntHappen(r);
  }

  private callStarted(e: SimEventOf<'callStarted'>): void {
    const r = this.rec(e.hero);
    if (!r) return;
    this.ring(r.x, r.z, r.radius, r.radius * 3.2, 0.45, C.call, 0.12, RING.plain, 1, 0.05, e.hero);
    this.sprite(r.x, r.height + 1.05, r.z, 0.4, 1.4, 0.3, C.call, SPRITE.star, 1, e.hero, true);
  }

  private callAnswered(e: SimEventOf<'callAnswered'>, state: WorldState): void {
    const r = this.rec(e.hero);
    const w = this.rec(state.weaverId);
    if (!r) return;
    const cy = r.height * 0.58 + r.y;
    if (w) {
      this.beam(w.x, 1.1, w.z, r.x, cy, r.z, 0.7, 0.4, C.call, BEAM.glow, 1);
      this.beam(w.x, 1.1, w.z, r.x, cy, r.z, 0.18, 0.3, C.white, BEAM.glow, 1);
      this.sprite(w.x, 1.1, w.z, 0.3, 1.1, 0.25, C.call, SPRITE.star, 1);
    }
    this.ring(r.x, r.z, 0.4, r.radius * 4.5, 0.45, C.call, 0.2, RING.plain, 1, 0.06, e.hero);
    this.sprite(r.x, r.height + 1.05, r.z, 0.6, 2.4, 0.32, C.call, SPRITE.star, 1, e.hero, true);
    this.d.kit.particles.burst(
      r.x,
      cy,
      r.z,
      24,
      4,
      3,
      0.7,
      0.14,
      C.call,
      1,
      PARTICLE.spark,
      2.2,
      1.5,
      r.radius,
    );
    this.d.rig.punch(-0.7, 5);
  }

  /** Flourishes: big, readable versions of each hero's answered ability. */
  private flourish(e: SimEventOf<'flourish'>, state: WorldState): void {
    const src = state.entities.get(e.hero);
    const r = this.rec(e.hero);
    let ability = '';
    if (src?.hero) {
      try {
        const def = heroDef(src.hero.defId);
        if (def.call) ability = def.abilities[def.call.ability]?.id ?? '';
      } catch {
        // unknown hero: generic flourish
      }
    }
    const heroC = r ? this.signal(state, e.hero, r.color) : C.call;
    const R = Math.max(1.5, e.radius);
    if (ability === 'challenge') this.bulwark(e, state, r, heroC, R);
    else if (ability === 'piercingShot') this.heartseeker(e, r, heroC);
    else if (ability === 'starbolt') this.resonantStarbolt(e, heroC, R);
    else if (ability === 'sunderLeap') this.redComet(e, heroC, R);
    else {
      this.ring(e.x, e.z, 0.4, R, 0.55, C.call, 0.25, RING.plain, 1);
      this.ring(e.x, e.z, 0.3, R * 0.7, 0.5, heroC, 0.14, RING.plain, 0.9);
      this.d.kit.particles.burst(
        e.x,
        0.6,
        e.z,
        30,
        5,
        3,
        0.8,
        0.15,
        C.call,
        1,
        PARTICLE.spark,
        2,
        2,
        R * 0.5,
      );
    }
    const cx = r ? r.x : e.x;
    const cz = r ? r.z : e.z;
    const top = r ? r.height + 1.4 : 2.6;
    this.d.overlay.callout(
      cx,
      top,
      cz,
      e.name.toUpperCase(),
      VISION_CALL_TEXT,
      26,
      1.3,
      'rgba(253,230,138,0.95)',
    );
  }

  private bulwark(
    e: SimEventOf<'flourish'>,
    state: WorldState,
    r: EntityRec | undefined,
    heroC: THREE.Color,
    R: number,
  ): void {
    // Challenge at half again the reach: a shockwave of the hero's colour edged in gold, a
    // shield flare around Kael, and gold tethers to every enemy it caught.
    this.ring(e.x, e.z, 0.6, R, 0.55, heroC, 0.4, RING.plain, 1);
    this.ring(e.x, e.z, 0.4, R * 1.05, 0.7, C.call, 0.18, RING.plain, 1);
    this.ring(e.x, e.z, R * 0.95, R * 0.35, 0.6, C.shield, 0.1, RING.dashed, 0.9);
    if (r) {
      const s = this.alloc(K.Shell, 0.55);
      s.follow = r.id;
      s.r0 = r.radius * 1.8;
      s.r1 = r.radius * 3.6;
      s.y = r.height * 0.5;
      s.th = r.height * 0.75;
      s.style = SHELL.flare;
      s.color.copy(C.shield);
      this.beam(r.x, 0, r.z, r.x, 6, r.z, 1.6, 0.4, C.call, BEAM.glow, 0.8);
      let n = 0;
      for (const en of state.entities.list()) {
        if (en.kind !== 'enemy' || en.health?.dead || n >= 14) continue;
        if (Math.hypot(en.x - e.x, en.z - e.z) > R + en.radius) continue;
        n++;
        this.beam(
          en.x,
          en.height * 0.6,
          en.z,
          r.x,
          r.height * 0.6,
          r.z,
          0.16,
          0.6,
          C.call,
          BEAM.glow,
          0.95,
        );
        this.sprite(
          en.x,
          en.height + 0.4,
          en.z,
          0.6,
          0.2,
          0.6,
          C.call,
          SPRITE.diamond,
          1,
          en.id,
          true,
        );
      }
    }
    this.d.kit.particles.burst(
      e.x,
      0.4,
      e.z,
      40,
      9,
      2,
      0.6,
      0.16,
      C.call,
      1,
      PARTICLE.spark,
      2.4,
      3,
      1,
    );
    this.d.rig.addTrauma(0.32);
    this.d.rig.punch(-1, 4);
  }

  private heartseeker(
    e: SimEventOf<'flourish'>,
    r: EntityRec | undefined,
    heroC: THREE.Color,
  ): void {
    // Piercing Shot that always crits: a wide gold lance cut straight through the line.
    const hx = r ? r.x : e.x;
    const hz = r ? r.z : e.z;
    let dx = e.x - hx;
    let dz = e.z - hz;
    let len = Math.hypot(dx, dz);
    if (len < 0.5 && r) {
      dx = -Math.sin(r.yaw);
      dz = -Math.cos(r.yaw);
      len = 1;
    }
    dx /= len || 1;
    dz /= len || 1;
    const L = Math.max(18, len);
    const ex = hx + dx * L;
    const ez = hz + dz * L;
    const y = r ? r.height * 0.6 : 1.2;
    const width = Math.max(1.3, e.radius * 2.4);
    this.beam(hx, y, hz, ex, y, ez, width, 0.5, C.call, BEAM.glow, 0.9);
    this.beam(hx, y, hz, ex, y, ez, width * 0.45, 0.45, heroC, BEAM.lance, 1);
    this.beam(hx, y, hz, ex, y, ez, 0.22, 0.35, C.white, BEAM.glow, 1);
    for (let d = 2.5; d < L; d += 2.6) {
      this.sprite(hx + dx * d, y, hz + dz * d, 0.3, 1.3, 0.4, C.goldHot, SPRITE.star, 1);
    }
    this.ring(hx, hz, 0.3, 2.6, 0.4, C.call, 0.18, RING.plain, 1);
    this.d.kit.particles.burst(
      ex,
      y,
      ez,
      18,
      4,
      2,
      0.5,
      0.14,
      C.call,
      1,
      PARTICLE.spark,
      3,
      2,
      0.5,
    );
    this.d.rig.addTrauma(0.26);
    this.d.rig.punch(-0.8, 5);
  }

  /**
   * Bloodlust (Brann, docs/phase-5b.md): he refused your Rally. Over his head, a brass 'refused'
   * sign (a ring struck through) for a moment; it clears early once he would answer after all
   * (Iron Will and your Ward, or he climbed above his Bloodlust line), or when he falls. The same
   * sign is struck across his Rally acknowledgement (the dashed ring at his feet) while it lands.
   */
  private refusedGlyphs(state: WorldState): void {
    const brass = color(BRANN_HEX.brass);
    for (const [id, until] of this.refusedUntil) {
      const e = state.entities.get(id);
      const r = this.rec(id);
      if (!e || !r || this.now >= until || !bloodlusting(CONTENT, e)) {
        if (e && r && this.now < until) this.fired5b.refusedCleared++;
        this.refusedUntil.delete(id);
        this.refusedAckUntil.delete(id);
        continue;
      }
      const ack = this.refusedAckUntil.get(id) ?? 0;
      if (this.now < ack) {
        // On the ack: a ring where the dashed acknowledgement closes (1.2 × his radius), struck.
        const a = 0.9 * clamp01((ack - this.now) / 0.25);
        const RA = r.radius * 1.2;
        this.d.kit.rings.push(r.x, 0.07, r.z, RA, 0.07, 0.08, RING.plain, brass, a);
        this.d.kit.beams.push(
          r.x - RA * 0.75,
          0.08,
          r.z - RA * 0.75,
          r.x + RA * 0.75,
          0.08,
          r.z + RA * 0.75,
          0.09,
          BEAM.glow,
          brass,
          a,
        );
        this.drawn5b.refusedAck++;
      } else if (ack > 0) this.refusedAckUntil.delete(id);
      const k = clamp01((until - this.now) / 0.3);
      const y = r.height + r.y + 1.05;
      const R = 0.26;
      this.d.kit.spritesTop.push(r.x, y, r.z, R * 2.2, SPRITE.ring, brass, 0.95 * k);
      this.d.kit.beams.push(
        r.x - R * 0.7,
        y + R * 0.7,
        r.z,
        r.x + R * 0.7,
        y - R * 0.7,
        r.z,
        0.07,
        BEAM.glow,
        brass,
        0.95 * k,
      );
      this.drawn5b.refused++;
    }
  }

  /**
   * Red Comet (Brann's Flourish, docs/phase-5b.md): his Sunder Leap lands wider and harder. Over
   * the leap's own brass ring and dust: a gold shock ring out to the Flourish's reach, a brass
   * one inside it, and sparks. Never his crimson (it lands among enemies, beside their red).
   */
  private redComet(e: SimEventOf<'flourish'>, heroC: THREE.Color, R: number): void {
    this.fired5b.comets++;
    this.ring(e.x, e.z, 0.4, R * 1.15, 0.6, C.call, 0.32, RING.plain, 1, 0.06);
    this.ring(e.x, e.z, 0.3, R * 0.8, 0.5, heroC, 0.18, RING.plain, 0.9, 0.055);
    this.d.kit.particles.burst(
      e.x,
      0.5,
      e.z,
      26,
      6,
      3,
      0.7,
      0.15,
      C.call,
      1,
      PARTICLE.spark,
      2,
      4,
      R * 0.4,
    );
    this.d.rig.addTrauma(0.22);
  }

  private resonantStarbolt(e: SimEventOf<'flourish'>, heroC: THREE.Color, R: number): void {
    // The Chime-tuned Starbolt: a bell-ring of light, a star-burst in Vexis' violet and a column.
    this.ring(e.x, e.z, 0.3, R * 1.1, 0.5, CHIME, 0.35, RING.plain, 1, 0.06);
    this.ring(e.x, e.z, 0.5, R, 0.65, heroC, 0.22, RING.plain, 1, 0.06);
    this.ring(e.x, e.z, R * 1.1, R * 1.35, 0.75, C.call, 0.08, RING.dashed, 0.9, 0.06);
    const t = this.ring(e.x, e.z, R * 0.9, R * 0.2, 0.7, heroC, 0.12, RING.portal, 0.8, 0.05);
    t.arcLen = 7;
    this.beam(e.x, 0, e.z, e.x, 9, e.z, R * 0.7, 0.5, CHIME, BEAM.glow, 0.9);
    this.sprite(e.x, 1.8, e.z, 0.8, 4.4, 0.35, C.goldHot, SPRITE.star, 1);
    this.d.kit.particles.burst(
      e.x,
      0.8,
      e.z,
      40,
      8,
      5,
      0.9,
      0.17,
      heroC,
      1,
      PARTICLE.shard,
      2,
      4,
      R * 0.4,
    );
    this.d.kit.particles.burst(
      e.x,
      0.8,
      e.z,
      30,
      6,
      4,
      0.8,
      0.14,
      CHIME,
      1,
      PARTICLE.spark,
      2.2,
      2,
      R * 0.4,
    );
    this.d.kit.particles.burst(
      e.x,
      1.2,
      e.z,
      10,
      2,
      2.5,
      1.4,
      0.18,
      CHIME,
      1,
      PARTICLE.note,
      0.8,
      -0.4,
      R * 0.6,
    );
    this.d.rig.addTrauma(0.45);
    this.d.rig.punch(-1.4, 4);
    this.d.overlay.spotlight(e.x, 1, e.z, 0.4);
    this.d.overlay.flash(0.16, 0.18);
  }

  // ── Per-frame ──────────────────────────────────────────────────────────────────────

  sync(state: WorldState, frame: FrameInfo, dt: number): void {
    this.now = frame.time;
    this.settings = frame.settings;
    this.comfort();
    const kit = this.d.kit;
    const w = this.rec(state.weaverId);
    this.drawn5b.refused = 0;
    this.drawn5b.refusedAck = 0;
    if (this.refusedUntil.size > 0) this.refusedGlyphs(state);
    // Stasis: an enemy's projectile waits as its pending hit does in the sim (its clock moves
    // forward with time), hanging where it was; when time resumes it flies on from there.
    const simDt = this.lastSim < 0 ? 0 : Math.max(0, state.time - this.lastSim);
    this.lastSim = state.time;
    this.holdProjectiles(state, simDt);

    // Resonance notes rising off the Weaver.
    if (w && this.resonanceAcc > 0) {
      const n = Math.min(4, Math.floor(this.resonanceAcc / 2));
      if (n > 0) {
        this.resonanceAcc -= n * 2;
        for (let i = 0; i < n; i++) {
          kit.particles.emit(
            w.x + (Math.random() - 0.5) * 0.8,
            1.4,
            w.z + (Math.random() - 0.5) * 0.8,
            (Math.random() - 0.5) * 0.4,
            1.5,
            0,
            1.1,
            0.16,
            C.resonance,
            0.95,
            PARTICLE.note,
            0.5,
            -0.1,
          );
        }
      }
      this.resonanceAcc = Math.min(this.resonanceAcc, 6);
    }

    // Chimes in flight: a bell of light arcing to its landing point.
    for (const c of state.chimes) {
      const t = clamp01((state.time - c.launchedAt) / Math.max(0.01, c.landsAt - c.launchedAt));
      const x = c.fromX + (c.x - c.fromX) * t;
      const z = c.fromZ + (c.z - c.fromZ) * t;
      const y = 1.3 + Math.sin(Math.PI * t) * 3.2 - t * 1.1;
      kit.sprites.push(x, y, z, 0.55, SPRITE.glow, CHIME, 0.9);
      kit.sprites.push(x, y, z, 0.32, SPRITE.star, C.gold, 1, this.now * 3);
      kit.rings.push(
        c.x,
        0.04,
        c.z,
        c.radius,
        0.07,
        0.15,
        RING.dashed,
        CHIME,
        0.4 + 0.5 * t,
        0,
        7,
        0.05 * t,
        18,
      );
      kit.rings.push(c.x, 0.04, c.z, c.radius * (1 - t), 0.05, 0.1, RING.plain, C.gold, 0.6 * t);
      if (Math.random() < dt * 40 * kit.particles.density) {
        kit.particles.emit(
          x,
          y,
          z,
          (Math.random() - 0.5) * 0.6,
          -0.3,
          (Math.random() - 0.5) * 0.6,
          0.5,
          0.12,
          CHIME,
          0.9,
          PARTICLE.spark,
          1,
        );
      }
    }

    // Seren and Oro (docs/phase-5e.md): only while one of their moments plays.
    if (this.seren.live) this.seren.sync(state, dt, frame.settings.flashes > 0 ? 1 : 0.6);
    if (this.grove.live) this.grove.sync(state, dt);
    // The Finale (crucibleCues.ts): the Cue, Fortissimo, the Grand Silence, its notes.
    if (state.field.finale !== undefined || this.crucible.override !== null || this.crucible.live)
      this.crucible.sync(state, frame, dt);

    for (const t of this.pool) {
      if (!t.active) continue;
      t.age += dt;
      if (t.age >= t.life) {
        if (t.kind === K.Portal) {
          kit.particles.burst(
            t.x,
            0.3,
            t.z,
            18,
            3.5,
            3,
            0.6,
            0.14,
            t.color,
            1,
            PARTICLE.spark,
            3,
            3,
            0.6,
          );
          this.ring(t.x, t.z, 0.4, 2.2, 0.3, t.color, 0.12, RING.plain, 1);
        }
        t.active = false;
        continue;
      }
      this.drawTransient(t, state, dt);
    }

    // Phase-change light shift: a flare of the key light tinted toward the boss accent. The
    // Luminary's Sunrise holds it warm while it lasts (sunWarmth). One last write restores it.
    const warm = this.sunWarmth < 0.002 ? 0 : Math.min(1, this.sunWarmth);
    const cool = this.stasisCool < 0.002 ? 0 : Math.min(1, this.stasisCool);
    // The Bloodmoon (Movement II): the sky lerps crimson while Vharun's pools are up.
    this.bloodmoon = approachTo(this.bloodmoon, this.d.field.pools(state) ? 1 : 0, 1.2, dt);
    if (this.bloodmoon < 0.002) this.bloodmoon = 0;
    const blood = this.bloodmoon;
    // The Finale's Grand Silence (crucibleCues.ts): 0 in every other fight.
    const silence = this.crucible.silence;
    if (
      this.lightShift > 0 ||
      warm > 0 ||
      cool > 0 ||
      blood > 0 ||
      silence > 0 ||
      this.lightLive ||
      this.keyGreyed
    ) {
      this.lightShift = Math.max(0, this.lightShift - dt * 0.7);
      const lights = this.d.stage.lights;
      const k = Math.sin(this.lightShift * Math.PI * 0.5);
      lights.key.intensity = this.baseKey * (1 + 0.6 * k + 0.22 * warm - 0.12 * cool);
      lights.hemi.intensity = this.baseHemi * (1 + 0.3 * k + 0.12 * warm);
      lights.hemi.color.copy(this.baseHemiColor).lerp(this.lightColor, 0.5 * k);
      if (warm > 0) lights.hemi.color.lerp(SUN_LIGHT, 0.32 * warm);
      if (cool > 0) lights.hemi.color.lerp(STASIS_LIGHT, 0.3 * cool);
      if (blood > 0) {
        lights.hemi.color.lerp(BLOODMOON_SKY, 0.55 * blood);
        lights.hemi.intensity *= 1 - 0.15 * blood;
      }
      // The music stops: the light drains toward grey and dims, a step back per note.
      if (silence > 0) {
        lights.hemi.color.lerp(SILENCE_GREY, 0.6 * silence);
        lights.hemi.intensity *= 1 - 0.3 * silence;
        lights.key.intensity *= 1 - 0.35 * silence;
        lights.key.color.copy(this.baseKeyColor).lerp(SILENCE_GREY, 0.5 * silence);
        this.keyGreyed = true;
      } else if (this.keyGreyed) {
        lights.key.color.copy(this.baseKeyColor);
        this.keyGreyed = false;
      }
      this.lightLive = this.lightShift > 0 || warm > 0 || cool > 0 || blood > 0 || silence > 0;
    }
  }

  /** Stasis holds every enemy projectile in the air; when it ends they fly on from there. */
  private holdProjectiles(state: WorldState, simDt: number): void {
    const stasis = state.field.stasis;
    this.heldProjectiles = 0;
    for (const t of this.pool) {
      if (!t.active || t.kind !== K.Proj || !t.enemy) continue;
      if (stasis) {
        t.startSim += simDt;
        t.held = true;
        this.heldProjectiles++;
      } else if (t.held) {
        // Time resumes: fly the rest of the way from where it hung (no new arc).
        const k = clamp01((state.time - t.startSim) / t.travelSim);
        t.x = t.hx;
        t.y = t.hy;
        t.z = t.hz;
        t.startSim = state.time;
        t.travelSim = Math.max(0.05, (1 - k) * t.travelSim);
        t.held = false;
        t.rebased = true;
        t.life = t.age + t.travelSim + 0.3;
      }
      // Its transient life waits too (it ends when it lands).
      if (stasis) t.age = Math.min(t.age, Math.max(0, t.life - 0.2));
    }
  }

  private follow(t: Transient): void {
    if (t.follow < 0) return;
    const r = this.d.entities.recs.get(t.follow);
    if (r) {
      t.x = r.x;
      t.z = r.z;
    }
  }

  private drawTransient(t: Transient, state: WorldState, dt: number): void {
    const kit = this.d.kit;
    const k = t.age / t.life;
    const ease = 1 - (1 - k) * (1 - k) * (1 - k);
    switch (t.kind) {
      case K.Ring: {
        this.follow(t);
        const r = t.r0 + (t.r1 - t.r0) * ease;
        const a = t.alpha * (1 - k) * (1 - k * 0.3);
        kit.rings.push(
          t.x,
          t.y,
          t.z,
          Math.max(0.01, r),
          t.th * (1 - k * 0.5),
          t.th * 1.6,
          t.style,
          t.color,
          a,
          t.arcStart,
          t.arcLen,
          0,
          0,
        );
        break;
      }
      case K.Sprite: {
        this.follow(t);
        const s = t.r0 + (t.r1 - t.r0) * ease;
        const a = t.alpha * (k < 0.15 ? 1 : 1 - (k - 0.15) / 0.85);
        (t.top ? kit.spritesTop : kit.sprites).push(
          t.x,
          t.y,
          t.z,
          s,
          t.style,
          t.color,
          a,
          t.style === SPRITE.star ? k * 0.6 : 0,
        );
        break;
      }
      case K.Beam: {
        const a = t.alpha * (1 - k);
        kit.beams.push(
          t.x,
          t.y,
          t.z,
          t.x2,
          t.y2,
          t.z2,
          t.th * (1 - k * 0.6),
          t.style,
          t.color,
          a,
          1,
          1,
          0,
        );
        break;
      }
      case K.Shell: {
        this.follow(t);
        const r = t.r0 + (t.r1 - t.r0) * ease;
        kit.shells.push(
          t.x,
          t.y,
          t.z,
          r,
          t.th * (r / t.r0),
          r,
          t.style,
          t.color,
          (1 - k) * 1.2 * t.alpha,
          0,
          (1 - k) * t.alpha,
        );
        break;
      }
      case K.Dome: {
        this.follow(t);
        const fadeIn = clamp01(t.age / 0.3);
        const fadeOut = clamp01((t.life - t.age) / 0.5);
        const a = fadeIn * fadeOut;
        const R = t.r0 * (0.85 + 0.15 * fadeIn);
        kit.shells.push(
          t.x,
          0,
          t.z,
          R,
          R * 0.62,
          R,
          SHELL.dome,
          t.color,
          0.75 * a,
          0,
          (1 - fadeIn) * 0.8,
          true,
          3.1,
        );
        kit.rings.push(t.x, 0.04, t.z, R, 0.12, 0.4, RING.plain, C.gold, 0.8 * a);
        break;
      }
      case K.Portal: {
        const open = clamp01(t.age / t.r0);
        const r = 0.3 + open * 1.1;
        kit.rings.push(t.x, 0.04, t.z, r, 0.1, 0.35, RING.portal, t.color, 1, 0, 7, 0.55);
        kit.rings.push(
          t.x,
          0.045,
          t.z,
          r * 1.25,
          0.04,
          0.1,
          RING.dashed,
          C.white,
          0.5 * open,
          0,
          7,
          0,
          10,
        );
        if (Math.random() < dt * 30 * kit.particles.density) {
          const a = Math.random() * Math.PI * 2;
          kit.particles.emit(
            t.x + Math.cos(a) * r,
            0.1,
            t.z + Math.sin(a) * r,
            -Math.cos(a) * 0.6,
            2 + Math.random() * 2,
            -Math.sin(a) * 0.6,
            0.6,
            0.12,
            t.color,
            1,
            PARTICLE.spark,
            1,
          );
        }
        break;
      }
      case K.Trail: {
        // Record the reeled hero's arc and draw it as a fading ribbon.
        const r = this.d.entities.recs.get(t.follow);
        if (r && t.age < t.life - 0.35) {
          const y = r.y + r.height * 0.5;
          const h = t.hist;
          if (t.histCount === 0 || Math.hypot(h[0]! - r.x, h[2]! - r.z) > 0.15) {
            h.copyWithin(3, 0, 23 * 3);
            h[0] = r.x;
            h[1] = y;
            h[2] = r.z;
            t.histCount = Math.min(24, t.histCount + 1);
            if (Math.random() < 0.6)
              kit.particles.emit(
                r.x,
                y,
                r.z,
                0,
                0.5,
                0,
                0.5,
                0.12,
                t.color,
                0.9,
                PARTICLE.spark,
                1,
              );
          }
        }
        if (t.histCount < 2) break;
        const fade = t.age > t.life - 0.35 ? (t.life - t.age) / 0.35 : 1;
        kit.ribbons.beginStrip();
        for (let i = 0; i < t.histCount; i++) {
          const u = i / (t.histCount - 1);
          kit.ribbons.point(
            t.hist[i * 3]!,
            t.hist[i * 3 + 1]!,
            t.hist[i * 3 + 2]!,
            0.22 * (1 - u * 0.8),
            t.color,
            (1 - u) * fade,
            u * 3,
          );
        }
        kit.ribbons.endStrip();
        break;
      }
      case K.Proj:
        this.drawProjectile(t, state);
        break;
    }
  }

  private drawProjectile(t: Transient, state: WorldState): void {
    const kit = this.d.kit;
    if (t.held && t.histCount > 0) {
      // Held by Stasis: it hangs where it was, cold, with a glint on it.
      this.heldProjectile(t);
      return;
    }
    const k = clamp01((state.time - t.startSim) / t.travelSim);
    // Home on the target's current position.
    const target = t.target >= 0 ? this.d.entities.recs.get(t.target) : undefined;
    const tx = target ? target.x : t.x2;
    const tz = target ? target.z : t.z2;
    const ty = target ? target.height * 0.55 + target.y : 1;
    if (k >= 1) {
      if (t.visual === 'meteor') {
        this.ring(tx, tz, 0.4, 2.8, 0.4, t.color, 0.25, RING.plain, 1);
        kit.particles.burst(
          tx,
          0.4,
          tz,
          22,
          5,
          4,
          0.6,
          0.16,
          t.color,
          1,
          PARTICLE.spark,
          2.5,
          6,
          0.8,
        );
        this.d.rig.addTrauma(0.08);
      } else if (t.visual === 'starbolt') {
        this.ring(tx, tz, 0.3, 1.6, 0.3, t.color, 0.15, RING.plain, 1, 0.05);
        kit.particles.burst(tx, ty, tz, 10, 3, 2, 0.4, 0.12, t.color, 1, PARTICLE.spark, 3, 3);
      }
      t.active = false;
      return;
    }
    let x: number;
    let y: number;
    let z: number;
    if (t.visual === 'meteor') {
      x = t.x + (tx - t.x) * k;
      y = t.y + (0.3 - t.y) * k * k;
      z = t.z + (tz - t.z) * k;
      const px = t.x + (tx - t.x) * Math.max(0, k - 0.12);
      const py = t.y + (0.3 - t.y) * Math.max(0, k - 0.12) ** 2;
      const pz = t.z + (tz - t.z) * Math.max(0, k - 0.12);
      kit.beams.push(px, py, pz, x, y, z, 0.5, BEAM.glow, t.color, 1, 1, 1, 0);
      kit.sprites.push(x, y, z, 0.6, SPRITE.star, t.color, 1, this.now * 4);
      kit.rings.push(
        tx,
        0.04,
        tz,
        1.2 * (1 - k) + 0.4,
        0.06,
        0.15,
        RING.plain,
        t.color,
        0.5 + 0.5 * k,
      );
      return;
    }
    const sy = t.y;
    x = t.x + (tx - t.x) * k;
    z = t.z + (tz - t.z) * k;
    const arc = t.rebased
      ? 0
      : t.visual === 'starbolt'
        ? Math.sin(Math.PI * k) * 1.4
        : t.visual === 'arrow'
          ? Math.sin(Math.PI * k) * 0.4
          : 0;
    y = sy + (ty - sy) * k + arc;
    // Where it is now (Stasis may catch it here; histCount marks it has been drawn once).
    t.hx = x;
    t.hy = y;
    t.hz = z;
    t.histCount = 1;
    if (t.visual === 'arrow') {
      const kb = Math.max(0, k - 0.09);
      const bx = t.x + (tx - t.x) * kb;
      const bz = t.z + (tz - t.z) * kb;
      const by = sy + (ty - sy) * kb + (t.rebased ? 0 : Math.sin(Math.PI * kb) * 0.4);
      kit.beams.push(bx, by, bz, x, y, z, 0.13, BEAM.lance, t.color, 1, 1, 1, 0);
    } else if (t.visual === 'bolt') {
      kit.sprites.push(x, y, z, 0.32, SPRITE.glow, t.color, 1);
      kit.sprites.push(x, y, z, 0.14, SPRITE.glow, C.white, 0.9);
      if (Math.random() < 0.5)
        kit.particles.emit(x, y, z, 0, 0, 0, 0.25, 0.1, t.color, 0.9, PARTICLE.dot, 1);
    } else {
      kit.sprites.push(x, y, z, 0.42, SPRITE.star, t.color, 1, this.now * 5);
      kit.particles.emit(
        x,
        y,
        z,
        (Math.random() - 0.5) * 0.5,
        -0.2,
        (Math.random() - 0.5) * 0.5,
        0.35,
        0.12,
        t.color,
        0.9,
        PARTICLE.spark,
        1,
      );
    }
  }

  /** An enemy projectile held by Stasis: still, dimmed toward silver, a cold glint and ring. */
  private heldProjectile(t: Transient): void {
    const kit = this.d.kit;
    this.tmp.copy(t.color).lerp(CHRONO_SILVER, 0.55);
    const x = t.hx;
    const y = t.hy;
    const z = t.hz;
    if (t.visual === 'arrow') {
      // The shaft hangs along its line of flight.
      const dx = t.x2 - t.x;
      const dz = t.z2 - t.z;
      const d = Math.hypot(dx, dz) || 1;
      kit.beams.push(
        x - (dx / d) * 0.7,
        y,
        z - (dz / d) * 0.7,
        x,
        y,
        z,
        0.13,
        BEAM.lance,
        this.tmp,
        0.8,
      );
    } else {
      kit.sprites.push(x, y, z, 0.32, SPRITE.glow, this.tmp, 0.75);
      kit.sprites.push(x, y, z, 0.13, SPRITE.glow, C.white, 0.6);
    }
    kit.sprites.push(x, y, z, 0.46, SPRITE.ring, CHRONO_SILVER, 0.55);
    kit.sprites.push(x, y + 0.02, z, 0.22, SPRITE.star, CHRONO_SILVER, 0.45, 0.4);
  }

  dispose(): void {
    const lights = this.d.stage.lights;
    lights.key.intensity = this.baseKey;
    lights.hemi.intensity = this.baseHemi;
    lights.hemi.color.copy(this.baseHemiColor);
    if (this.keyGreyed) lights.key.color.copy(this.baseKeyColor);
    this.crucible.dispose();
    this.dmg.clear();
    this.heal.clear();
    this.auraHeal.clear();
    this.selfHeal.clear();
  }
}

/** A Rewind standing `hero` back up among this batch of events (its `revived` is the same tick's). */
export function rewoundIn(events: readonly SimEvent[], hero: EntityId): boolean {
  for (let i = 0; i < events.length; i++) {
    const e = events[i]!;
    if (e.type === 'rewound' && e.target === hero && e.revived) return true;
  }
  return false;
}

/** A `dawnward` for `hero` among this batch of events (its barrier is the same tick's). */
export function dawnwardIn(events: readonly SimEvent[], hero: EntityId): boolean {
  for (let i = 0; i < events.length; i++) {
    const e = events[i]!;
    if (e.type === 'dawnward' && e.hero === hero) return true;
  }
  return false;
}

/** Frame-rate independent approach (as palette.approach). */
function approachTo(current: number, target: number, rate: number, dt: number): number {
  return current + (target - current) * (1 - Math.exp(-rate * dt));
}

/** A hex toward the dark at `alpha` (a dimmed heal number, Movement II's Bloodmoon). */
function dimHex(hex: string, alpha: number): string {
  const c = new THREE.Color(hex).multiplyScalar(0.35 + 0.65 * alpha);
  return `#${c.getHexString()}`;
}
