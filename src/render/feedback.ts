import * as THREE from 'three';
import { enemyDef, heroDef } from '../content';
import type { EntityId, SimEvent, SimEventOf, WorldState } from '../sim';
import type { CallView } from './calls';
import type { CameraRig } from './camera';
import type { EntityLayer, EntityRec } from './entities';
import { FERMATA_COLOR, type FermataView } from './fermata';
import type { FieldView } from './field';
import { BEAM } from './fx/beams';
import type { FxKit } from './fx/kit';
import { PARTICLE } from './fx/particles';
import { RING } from './fx/rings';
import { SHELL } from './fx/shells';
import { SPRITE } from './fx/sprites';
import type { Overlay } from './overlay';
import { C, VISION_HEX, auraColor, clamp01, color, currentVision, rgba } from './palette';
import {
  REGEN_MASK,
  SONG_GLYPH,
  chipText,
  fieldLook,
  softenHex,
  splitAmplified,
  type ChipSplit,
} from './songs';
import type { Stage } from './stage';
import type { TelegraphLayer } from './telegraphs';
import type { ThreadView } from './thread';
import type { FrameInfo } from './types';

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
  absorbed: number;
  crit: boolean;
}

function bucket(): Bucket {
  return { handle: -1, start: -10, amount: 0, amplified: 0, aura: 0, absorbed: 0, crit: false };
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
  private readonly split: ChipSplit = { empower: 0, aura: 0 };
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

  constructor(private readonly d: FeedbackDeps) {
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
        hist: new Float32Array(24 * 3),
        histCount: 0,
      });
    }
    const lights = d.stage.lights;
    this.baseKey = lights.key.intensity;
    this.baseHemi = lights.hemi.intensity;
    this.baseHemiColor.copy(lights.hemi.color);
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
      return heroDef(e.hero.defId).color;
    } catch {
      return null;
    }
  }

  // ── Events ─────────────────────────────────────────────────────────────────────────

  handle(events: readonly SimEvent[], state: WorldState): void {
    for (const ev of events) {
      switch (ev.type) {
        case 'attackFired':
          this.attack(ev, state);
          break;
        case 'damageTaken':
          this.damage(ev, state);
          break;
        case 'healApplied':
          this.healed(ev, state);
          break;
        case 'shieldApplied':
          this.shieldApplied(ev);
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
          this.save(ev);
          break;
        case 'fieldPlanted':
          this.planted(ev, state);
          break;
        case 'chorusPulse':
          this.chorus(ev, state);
          break;
        case 'fermataHold':
          this.d.fermata.onHold(ev, state);
          this.fermataHold(ev);
          break;
        case 'fermataReleased':
          this.d.fermata.onReleased(ev);
          this.fermataReleased(ev);
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
          const c = w?.threadMode === 'empower' ? C.amp : C.heal;
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
          const c = ev.mode === 'empower' ? C.amp : C.heal;
          if (w) this.ring(w.x, w.z, 0.4, 1.8, 0.3, c, 0.1, RING.plain, 1, 0.05, state.weaverId);
          break;
        }
        case 'threadSnapped': {
          this.d.thread.snap(this.d.kit);
          this.d.rig.addTrauma(0.2);
          const r = this.rec(ev.target);
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
          this.revived(ev.hero);
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
        case 'crescendoStart':
          this.crescendo(state);
          break;
        case 'crescendoEnd': {
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
        case 'phaseChanged':
          this.phase(ev);
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
  }

  private attack(e: SimEventOf<'attackFired'>, state: WorldState): void {
    const src = state.entities.get(e.source);
    const sr = this.rec(e.source);
    if (e.visual === 'melee' || e.visual === 'cleave')
      this.d.entities.lungeAt(e.source, e.toX, e.toZ);
    const isHero = src?.kind === 'hero';
    let c: THREE.Color = C.threat;
    if (isHero && src.hero) {
      c = sr ? sr.color : C.white;
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
        if (e.visual === 'meteor') {
          t.x = e.toX + 3;
          t.y = 16;
          t.z = e.toZ - 5;
        }
        break;
      }
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

  private damage(e: SimEventOf<'damageTaken'>, state: WorldState): void {
    const r = this.rec(e.target);
    const target = state.entities.get(e.target);
    if (!r || !target) return;
    const maxHp = target.health?.maxHp ?? 1;
    const total = e.amount + e.absorbed;
    const frac = total / maxHp;
    const isParty = target.team === 'party';
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
        isParty ? C.threat : SHARD,
        1,
        PARTICLE.spark,
        4,
        5,
        r.radius,
      );
      splitAmplified(e.amplified, e.aura, this.split);
      // The Weaver's share as sparks: gold for Empower / Flourishes, song colour for the auras.
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
    if (isParty && frac > 0.18) this.d.rig.addTrauma(Math.min(0.3, frac * 0.5));
    if (!this.settings.damageNumbers) return;
    let b = this.dmg.get(e.target);
    if (!b) {
      b = bucket();
      this.dmg.set(e.target, b);
    }
    const fresh = this.now - b.start > AGG || b.handle < 0 || !this.d.overlay.numberAlive(b.handle);
    if (fresh) {
      b.amount = 0;
      b.amplified = 0;
      b.aura = 0;
      b.absorbed = 0;
      b.crit = false;
      b.start = this.now;
    }
    b.amount += e.amount;
    b.amplified += e.amplified;
    b.aura += e.aura;
    b.absorbed += e.absorbed;
    b.crit = b.crit || e.crit;
    const shown = b.amount > 0 ? b.amount : b.absorbed;
    const sig = isParty
      ? 14 + 24 * Math.sqrt(Math.min(1, shown / maxHp))
      : 12 + 3.3 * Math.log10(1 + shown);
    const size = Math.min(40, sig * (b.crit ? 1.25 : 1));
    const colorHex =
      b.amount <= 0 ? '#a5f3fc' : isParty ? '#fb7185' : b.crit ? '#fde68a' : '#fff7ed';
    if (fresh) b.handle = this.d.overlay.spawnNumber(r.x, r.height + 0.35, r.z, colorHex, size);
    const text =
      b.amount > 0 ? `${Math.round(b.amount)}${b.crit ? '!' : ''}` : `(${Math.round(b.absorbed)})`;
    // Two chips: gold = Empower and Flourishes (`amplified - aura`), ♪ song = the auras' work.
    splitAmplified(b.amplified, b.aura, this.split);
    this.d.overlay.setNumber(
      b.handle,
      text,
      chipText(this.split.empower),
      size,
      !fresh,
      chipText(this.split.aura, SONG_GLYPH),
    );
  }

  private healed(e: SimEventOf<'healApplied'>, state: WorldState): void {
    const r = this.rec(e.target);
    const target = state.entities.get(e.target);
    if (!r || !target || e.amount <= 0) return;
    if (e.via === 'aura') {
      this.auraHealed(e, r, target);
      return;
    }
    if (e.via === 'mend') this.d.thread.pulse();
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
    let b = this.heal.get(e.target);
    if (!b) {
      b = bucket();
      this.heal.set(e.target, b);
    }
    const fresh = this.now - b.start > AGG || b.handle < 0 || !this.d.overlay.numberAlive(b.handle);
    if (fresh) {
      b.amount = 0;
      b.start = this.now;
    }
    b.amount += e.amount;
    if (b.amount < 2) return;
    const size = Math.min(30, 12 + 18 * Math.sqrt(Math.min(1, b.amount / maxHp)));
    if (fresh || b.handle < 0)
      b.handle = this.d.overlay.spawnNumber(
        r.x + 0.35,
        r.height + 0.2,
        r.z,
        VISION_HEX.heal,
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
  ): void {
    const maxHp = target.health?.maxHp ?? 1;
    const mask = (target.hero?.auraMask ?? 0) & REGEN_MASK;
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
    if (!this.settings.damageNumbers || target.team !== 'party') return;
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
    }
    b.amount += e.amount;
    if (b.amount < 1) return;
    const vision = currentVision();
    if (this.softHealFor !== vision) {
      this.softHealFor = vision;
      this.softHealHex = softenHex(VISION_HEX.heal, 0.45);
    }
    // Smaller than Mend's (12–30 px) but legible: a regen tick is ~1–3% of max life.
    const size = 13 + 7 * Math.sqrt(Math.min(1, (b.amount / maxHp) * 8));
    if (fresh)
      b.handle = this.d.overlay.spawnNumber(
        r.x - 0.4,
        r.height + 0.05,
        r.z,
        this.softHealHex,
        size,
        1.25,
        true,
      );
    this.d.overlay.setNumber(b.handle, `${SONG_GLYPH}+${Math.round(b.amount)}`, null, size, !fresh);
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

  private save(e: SimEventOf<'save'>): void {
    const r = this.rec(e.target);
    if (!r) return;
    this.d.entities.saveFlash(e.target);
    this.deathThatDidntHappen(r);
    const cy = r.height * 0.5 + r.y;
    this.ring(
      r.x,
      r.z,
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
    this.ring(r.x, r.z, 0.5, 5, 0.6, C.gold, 0.2, RING.plain, 0.9, 0.06);
    this.beam(r.x, 0, r.z, r.x, 6, r.z, 1.2, 0.45, C.gold, BEAM.glow, 0.7);
    this.d.kit.particles.burst(
      r.x,
      cy,
      r.z,
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
    this.d.overlay.callout(r.x, r.height + 1.7, r.z, 'SAVED', '#fcd98a', 32, 1.5);
    this.d.overlay.spotlight(r.x, cy, r.z, 0.45);
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
    t.color.copy(w?.threadMode === 'empower' ? C.amp : C.heal);
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
    const c = e.cued ? C.amp : r.color;
    this.ring(r.x, r.z, 0.4, 3.4, 0.5, c, 0.2, RING.plain, 1, 0.05, e.hero);
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
    const c = r ? (src?.kind === 'hero' ? r.color : r.accent) : C.threat;
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
    try {
      const def = enemyDef(e.defId);
      accent = color(def.accent);
      size = def.radius;
      height = def.height;
      boss = def.role === 'boss' || def.role === 'miniboss';
    } catch {
      // unknown def
    }
    const x = r?.x ?? e.x;
    const z = r?.z ?? e.z;
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

  /** Chorus: every field rings out (a Unison beam song at its hero) once per aura, in aura colours, scaled by `auras`. */
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
    const heroC = r ? r.color : C.call;
    const R = Math.max(1.5, e.radius);
    if (ability === 'challenge') this.bulwark(e, state, r, heroC, R);
    else if (ability === 'piercingShot') this.heartseeker(e, r, heroC);
    else if (ability === 'starbolt') this.resonantStarbolt(e, heroC, R);
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
    const kit = this.d.kit;
    const w = this.rec(state.weaverId);

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

    // Phase-change light shift: a flare of the key light tinted toward the boss accent.
    if (this.lightShift > 0) {
      this.lightShift = Math.max(0, this.lightShift - dt * 0.7);
      const lights = this.d.stage.lights;
      const k = Math.sin(this.lightShift * Math.PI * 0.5);
      lights.key.intensity = this.baseKey * (1 + 0.6 * k);
      lights.hemi.intensity = this.baseHemi * (1 + 0.3 * k);
      lights.hemi.color.copy(this.baseHemiColor).lerp(this.lightColor, 0.5 * k);
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
    const arc =
      t.visual === 'starbolt'
        ? Math.sin(Math.PI * k) * 1.4
        : t.visual === 'arrow'
          ? Math.sin(Math.PI * k) * 0.4
          : 0;
    y = sy + (ty - sy) * k + arc;
    if (t.visual === 'arrow') {
      const kb = Math.max(0, k - 0.09);
      const bx = t.x + (tx - t.x) * kb;
      const bz = t.z + (tz - t.z) * kb;
      const by = sy + (ty - sy) * kb + Math.sin(Math.PI * kb) * 0.4;
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

  dispose(): void {
    const lights = this.d.stage.lights;
    lights.key.intensity = this.baseKey;
    lights.hemi.intensity = this.baseHemi;
    lights.hemi.color.copy(this.baseHemiColor);
    this.dmg.clear();
    this.heal.clear();
  }
}
