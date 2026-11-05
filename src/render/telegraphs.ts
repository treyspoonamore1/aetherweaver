import * as THREE from 'three';
import { enemyDef } from '../content';
import type { AnswerTag, EntityId, SimEventOf, WorldState } from '../sim';
import { mimicBeneficiary, threadSegment } from '../sim';
import {
  DOOM_AT,
  RIFT_HEX,
  copyLabel,
  cutOf,
  emptyRiftLook,
  isDoomMark,
  isNeedle,
  isStitch,
  riftAnswers,
  riftLabel,
  riftStatuses,
  shearsCrossing,
  zoneOf,
} from './riftCues';
import { RING } from './fx/rings';
import { SPRITE } from './fx/sprites';
import { CHRONO_HEX, timerLabel } from './chronoCues';
import { BLIND_ANSWERS, BLIND_KEY } from './dissonanceCues';
import {
  CRIMSON_HEX,
  PACT_LABEL,
  STATUS_BADGE_LIFT,
  TIDE_HALF,
  crimsonStatuses,
  emptyStatusLook,
  executeBelowOf,
  isPact,
  shownAnswers,
  statusAnswers,
} from './crimsonCues';
import type { EntityLayer, EntityRec } from './entities';
import { BEAM } from './fx/beams';
import type { FxKit } from './fx/kit';
import { PARTICLE } from './fx/particles';
import { TG } from './fx/telegraphBatch';
import { BADGE_TONE, type GlyphIcon, type Overlay } from './overlay';
import { C, VISION_HEX, approach, clamp01, color } from './palette';

type Effect = SimEventOf<'telegraphStarted'>['effect'];
type Outcome = SimEventOf<'telegraphResolved'>['outcome'];

interface TgRec {
  id: number;
  seen: number;
  effect: Effect;
  name: string;
  answers: AnswerTag[];
  key: string;
  owner: EntityId;
  ownerAccent: THREE.Color;
  ownerHex: string;
  shape: string;
  // Last known geometry (kept so the impact can play after the telegraph is gone).
  cx: number;
  cz: number;
  rot: number;
  ex: number;
  ez: number;
  a: number;
  b: number;
  start: number;
  impact: number;
  perfectFrom: number;
  sev: number;
  progress: number;
  /** ≥ 0 once the telegraph has left the state (seconds since). */
  ending: number;
  outcome: Outcome | null;
  impacted: boolean;
  /** Movement II: a Blood Pact link; Execution's threshold (0: not an Execution). */
  pact: boolean;
  execute: number;
  /**
   * Movement III (docs/phase-5c.md): a cut line (dotted, the scissors where it crosses the
   * Thread) or an always-cut raid (the Unpick's ripple along the Thread); a zone tell (the
   * Inhale's swirl, the rune closing); a Stitch link; Needle Rain; Doom's ignition mark.
   */
  cut: boolean;
  zone: 'pull' | 'null' | null;
  stitch: boolean;
  needle: boolean;
  doom: boolean;
}

const FADE_IN = 0.12;
const END = 0.38;
/** Stasis' bezel round a held telegraph (the Chronomancer, docs/phase-3e/vfx.md). */
const FROST = color(CHRONO_HEX.silver);
/** Blood Pact's link tint (Movement II). */
const PACT = color(CRIMSON_HEX.pact);
/** Movement III's colours (riftCues.ts). */
const SWIRL = color(RIFT_HEX.swirl);
const RUNE = color(RIFT_HEX.rune);
const MIRROR = color(RIFT_HEX.mirror);
const STITCH = color(RIFT_HEX.stitch);
const FRAY = color(RIFT_HEX.fray);
const NEEDLE = color(RIFT_HEX.stitch);

/**
 * A telegraph's last drawn geometry (kept after it leaves the state): the Chronomancer's
 * Paradox unravels a cancelled one back toward its caster from here.
 */
export interface TelegraphGeometry {
  readonly id: number;
  readonly owner: EntityId;
  readonly effect: Effect;
  readonly shape: string;
  readonly cx: number;
  readonly cz: number;
  readonly rot: number;
  readonly ex: number;
  readonly ez: number;
  readonly a: number;
  readonly b: number;
  readonly progress: number;
  readonly sev: number;
}

/**
 * Telegraph grammar (docs/plan/04 §5.3): filled circles, cones, lines and donuts on the floor;
 * marks as countdown rings over the head; links as beams between two heroes; raids as a
 * screen-edge warning. Enemy non-damage casts are cast circles in the caster's accent.
 */
export class TelegraphLayer {
  private readonly recs = new Map<number, TgRec>();
  private readonly effects = new Map<number, Effect>();
  private readonly outcomes = new Map<number, Outcome>();
  private frameNo = 0;
  /** Heroes some live threat is aimed at (for off-screen arrows). */
  readonly threatened = new Map<EntityId, number>();
  private readonly tmpColor = new THREE.Color();
  /**
   * The Chronomancer (docs/phase-3e/vfx.md): every telegraph shows its timer (`calling.timers`),
   * and while Stasis holds them they read as held (a cold timer and a bezel round each).
   */
  private timers = false;
  private frozen = false;
  /** Stasis' hold on the telegraphs, smoothed 0..1 (the bezels fade in and out). */
  frost = 0;
  /**
   * Blind Score (Dissonance, docs/phase-4d/vfx-audio.md): the badges hide which answer a telegraph
   * wants, a neutral "?" in their place. Their place, border (the danger), timer and the Perfect
   * window's pulse are kept; the shapes on the floor are unchanged.
   */
  private blind = false;
  /** What was drawn last frame (tests, the lab): timers shown, bezels drawn, blind badges. */
  readonly drawn = { timers: 0, frost: 0, blind: 0 };
  /**
   * Movement II, drawn last frame (tests, the lab): Blood Pact links, Crimson Tide cones,
   * Execution marks, and the answer badges over heroes held by a Legion status (bleed at 5+,
   * a pin, a latch).
   */
  readonly drawnM2 = { pacts: 0, tides: 0, executions: 0, statusBadges: 0 };
  private readonly m2Look = emptyStatusLook();
  /**
   * Movement III, drawn last frame (tests, the lab): dotted cut lines and the scissors where one
   * crosses the Thread; the Unpick's ripple along it; the Inhale's swirl and the rune closing;
   * the Mimic's mirror cast (its shimmer to the beneficiary and the copied glyph); Stitch links;
   * falling needles; Doom's ignition marks; and the answer badges over heroes a Rift status
   * holds (possessed, stitched, Doom at four or more).
   */
  readonly drawnM3 = {
    cutLines: 0,
    scissors: 0,
    ripples: 0,
    swirls: 0,
    runes: 0,
    mirrors: 0,
    stitches: 0,
    needles: 0,
    doomMarks: 0,
    statusBadges: 0,
  };
  private readonly m3Look = emptyRiftLook();
  private readonly cross = { x: 0, z: 0 };

  constructor(private readonly entities: EntityLayer) {}

  onStarted(e: SimEventOf<'telegraphStarted'>): void {
    this.effects.set(e.telegraph, e.effect);
  }

  onResolved(e: SimEventOf<'telegraphResolved'>): void {
    const prev = this.outcomes.get(e.telegraph);
    // Any landed hit wins over dodges for the impact flash.
    if (!prev || prev === 'cancelled' || prev === 'dodged' || e.outcome === 'hit') {
      this.outcomes.set(e.telegraph, e.outcome);
    }
    const rec = this.recs.get(e.telegraph);
    if (rec) rec.outcome = this.outcomes.get(e.telegraph) ?? null;
  }

  /** The owner of a telegraph (for the Perfect Ward stagger). */
  ownerOf(id: number): EntityId | null {
    return this.recs.get(id)?.owner ?? null;
  }

  /** A telegraph's last drawn geometry, while it is drawn or fading (null once forgotten). */
  geometry(id: number): TelegraphGeometry | null {
    return this.recs.get(id) ?? null;
  }

  private createRec(t: WorldState['telegraphs'][number], state: WorldState): TgRec {
    const owner = state.entities.get(t.owner);
    let accentHex = '#c084fc';
    if (owner?.enemy) {
      try {
        accentHex = enemyDef(owner.enemy.defId).accent;
      } catch {
        // keep default
      }
    }
    // The dome glyph only when the party brings one (docs/phase-5b.md; the default party does).
    const answers = shownAnswers(state, t.answers);
    const rec: TgRec = {
      id: t.id,
      seen: 0,
      effect: t.effect ?? this.effects.get(t.id) ?? 'damage',
      name: t.name,
      answers,
      key: answers.join(','),
      owner: t.owner,
      ownerAccent: color(accentHex),
      ownerHex: accentHex,
      shape: t.shape.kind,
      cx: 0,
      cz: 0,
      rot: 0,
      ex: 1,
      ez: 1,
      a: 1,
      b: 0,
      start: t.start,
      impact: t.impact,
      perfectFrom: t.perfectFrom,
      sev: t.severity === 'lethal' ? 1 : 0,
      progress: 0,
      ending: -1,
      outcome: null,
      impacted: false,
      pact: t.shape.kind === 'link' && isPact(t),
      execute: t.shape.kind === 'mark' ? executeBelowOf(t) : 0,
      cut: cutOf(t.attackId) !== null,
      zone: zoneOf(t.attackId),
      stitch: t.shape.kind === 'link' && isStitch(t),
      needle: isNeedle(t.attackId),
      doom: t.shape.kind === 'mark' && isDoomMark(t.attackId),
    };
    this.effects.delete(t.id);
    this.recs.set(t.id, rec);
    return rec;
  }

  /**
   * Lab-only: synthetic telegraphs drawn as if they were in the state (the grammar sheet).
   * Never set by the game runtime.
   */
  preview: { t: WorldState['telegraphs'][number]; effect: Effect }[] | null = null;

  sync(state: WorldState, kit: FxKit, overlay: Overlay, dt: number, showGlyphs: boolean): void {
    this.frameNo++;
    this.threatened.clear();
    const time = state.time;
    this.timers = !!state.calling?.timers;
    this.frozen = state.field.stasis;
    this.frost = approach(this.frost, this.frozen ? 1 : 0, this.frozen ? 9 : 10, dt);
    if (this.frost < 0.004) this.frost = 0;
    this.blind = !!(state as { dissonance?: WorldState['dissonance'] }).dissonance?.blindScore;
    this.drawn.timers = 0;
    this.drawn.frost = 0;
    this.drawn.blind = 0;
    this.drawnM2.pacts = 0;
    this.drawnM2.tides = 0;
    this.drawnM2.executions = 0;
    this.drawnM2.statusBadges = 0;
    const m3 = this.drawnM3;
    for (const k of Object.keys(m3) as (keyof typeof m3)[]) m3[k] = 0;
    for (const t of state.telegraphs) this.syncOne(t, state, kit, overlay, dt, showGlyphs, time);
    if (this.preview) {
      for (const p of this.preview) {
        if (!this.recs.has(p.t.id)) this.effects.set(p.t.id, p.effect);
        this.syncOne(p.t, state, kit, overlay, dt, showGlyphs, time);
      }
    }
    for (const [id, rec] of this.recs) {
      if (rec.seen === this.frameNo) continue;
      if (rec.ending < 0) {
        rec.ending = 0;
        rec.outcome = this.outcomes.get(id) ?? rec.outcome;
        this.outcomes.delete(id);
      }
      rec.ending += dt;
      if (rec.ending >= END) {
        this.recs.delete(id);
        continue;
      }
      this.draw(rec, state, kit, overlay, time, false, null);
    }
    if (showGlyphs) this.statusBadges(state, overlay);
  }

  /**
   * Movement II: a hero a Legion status holds shows its answer over the head, where you are
   * already looking: Chime at 5+ bleed stacks (with the count), Reel for a pin, Reel or Chime
   * for a latch. Nothing in Movement I has these statuses.
   */
  private statusBadges(state: WorldState, overlay: Overlay): void {
    const look = this.m2Look;
    const rift = this.m3Look;
    for (const id of state.party) {
      const e = state.entities.get(id);
      const h = e?.health;
      if (!e || !h || h.dead || h.downed || h.statuses.length === 0) continue;
      // Movement III first (possessed: Chime frees them, Focus the Wraith; stitched: Chime; Doom
      // at four or more: Chime or Ward). Nothing before Movement III has these statuses.
      if (riftStatuses(e, rift)) {
        const ra = riftAnswers(rift);
        const r = ra ? this.entities.recs.get(id) : undefined;
        if (ra && r) {
          overlay.badge(
            r.x,
            r.height + STATUS_BADGE_LIFT + r.y,
            r.z,
            ra,
            ra.join(','),
            rift.possessed ? RIFT_HEX.possess : rift.stitched ? RIFT_HEX.stitch : VISION_HEX.lethal,
            riftLabel(rift),
          );
          this.drawnM3.statusBadges++;
          continue;
        }
      }
      if (!crimsonStatuses(e, look)) continue;
      const answers = statusAnswers(look);
      if (!answers) continue;
      const r = this.entities.recs.get(id);
      if (!r) continue;
      const pinned = look.pinned;
      const label = pinned ? 'Pinned' : look.latchedBy >= 0 ? 'Latched' : `×${look.bleed}`;
      overlay.badge(
        r.x,
        r.height + STATUS_BADGE_LIFT + r.y,
        r.z,
        answers,
        answers.join(','),
        pinned ? CRIMSON_HEX.pin : VISION_HEX.ailment,
        label,
      );
      this.drawnM2.statusBadges++;
    }
  }

  private syncOne(
    t: WorldState['telegraphs'][number],
    state: WorldState,
    kit: FxKit,
    overlay: Overlay,
    dt: number,
    showGlyphs: boolean,
    time: number,
  ): void {
    {
      let rec = this.recs.get(t.id);
      if (!rec) rec = this.createRec(t, state);
      rec.seen = this.frameNo;
      rec.start = t.start;
      rec.impact = t.impact;
      rec.perfectFrom = t.perfectFrom;
      rec.sev = approach(rec.sev, t.severity === 'lethal' ? 1 : 0, 14, dt);
      rec.progress = clamp01((time - t.start) / Math.max(0.01, t.impact - t.start));
      const s = t.shape;
      switch (s.kind) {
        case 'circle':
          rec.cx = s.x;
          rec.cz = s.z;
          rec.a = s.r;
          rec.ex = rec.ez = s.r + 0.35;
          break;
        case 'cone':
          rec.cx = s.x;
          rec.cz = s.z;
          rec.rot = Math.atan2(s.dirZ, s.dirX);
          rec.a = s.r;
          rec.b = Math.acos(Math.max(-1, Math.min(1, s.halfAngleCos)));
          rec.ex = rec.ez = s.r + 0.35;
          break;
        case 'line': {
          const dx = s.toX - s.x;
          const dz = s.toZ - s.z;
          const len = Math.hypot(dx, dz);
          rec.cx = (s.x + s.toX) / 2;
          rec.cz = (s.z + s.toZ) / 2;
          rec.rot = Math.atan2(dz, dx);
          rec.a = len / 2;
          rec.b = s.width / 2;
          rec.ex = len / 2 + 0.35;
          rec.ez = s.width / 2 + 0.35;
          break;
        }
        case 'donut':
          rec.cx = s.x;
          rec.cz = s.z;
          rec.a = s.innerR;
          rec.b = s.outerR;
          rec.ex = rec.ez = s.outerR + 0.35;
          break;
        default:
          break;
      }
      this.draw(rec, state, kit, overlay, time, showGlyphs, s);
      this.markThreats(rec, state, s);
    }
  }

  private draw(
    rec: TgRec,
    state: WorldState,
    kit: FxKit,
    overlay: Overlay,
    time: number,
    showGlyphs: boolean,
    shape: WorldState['telegraphs'][number]['shape'] | null,
  ): void {
    const live = rec.ending < 0;
    const cancelled = rec.outcome === 'cancelled';
    const endT = live ? 0 : rec.ending / END;
    const alpha = live
      ? clamp01((time - rec.start) / FADE_IN)
      : cancelled
        ? Math.max(0, 1 - endT * 2)
        : 1 - endT;
    const flash = !live && !cancelled ? (1 - endT) * 1.2 : 0;
    const prog = live ? rec.progress : cancelled ? rec.progress : 1;
    const perfect = live ? clamp01((time - rec.perfectFrom) / 0.05) : 0;
    const pw = clamp01((rec.impact - rec.perfectFrom - 0.35) / 0.35);
    const sev = rec.sev;
    const borderHex = sev > 0.5 ? VISION_HEX.lethal : VISION_HEX.threat;
    const remain = Math.max(0, rec.impact - time);
    const glyphScale = 1 + perfect * 0.12 * (0.5 + 0.5 * Math.sin(time * 24));
    // The Chronomancer: every telegraph shows its timer; held by Stasis, it reads cold.
    const timer = this.timers && live && showGlyphs ? timerLabel(remain) : '';
    const tone = this.timers
      ? this.frozen
        ? BADGE_TONE.frozen
        : BADGE_TONE.timer
      : BADGE_TONE.plain;
    if (timer) this.drawn.timers++;
    const frost = live && this.frost > 0.01 ? this.frost * alpha : 0;
    // Blind Score: the badge keeps its place, border, timer and pulse, but not the answer.
    const hide = this.blind && rec.answers.length > 0;
    const answers = hide ? BLIND_ANSWERS : rec.answers;
    const key = hide ? BLIND_KEY : rec.key;
    if (hide && live && showGlyphs) this.drawn.blind++;

    if (!live && !cancelled && !rec.impacted) {
      rec.impacted = true;
      this.impact(rec, kit);
    }

    if (rec.effect !== 'damage') {
      // Movement III: a zone's tell is its own shape (the Inhale's swirl, the rune closing).
      if (rec.zone) {
        this.zoneTell(rec, kit, overlay, prog, alpha, live, showGlyphs, answers, key, timer, tone);
        return;
      }
      // The Mimic's mirror: a shimmer to whom it copies onto, the copied glyph over them.
      if (rec.effect === 'mimic' && live)
        this.mirrorCast(rec, state, kit, overlay, alpha, showGlyphs);
      // Enemy cast (heal / summon / suppress): a cast circle in the caster's accent.
      const owner = this.entities.recs.get(rec.owner);
      const x = owner ? owner.x : rec.cx;
      const z = owner ? owner.z : rec.cz;
      const r = rec.shape === 'circle' ? Math.min(rec.a, 9) : 2.4;
      kit.telegraphs.push(
        TG.cast,
        x,
        0.04,
        z,
        0,
        r + 0.4,
        r + 0.4,
        r,
        0,
        prog,
        0,
        0,
        flash * 0.4,
        alpha,
        rec.ownerAccent,
      );
      if (frost > 0) {
        kit.telegraphs.push(
          TG.cast,
          x,
          0.042,
          z,
          0,
          r + 0.7,
          r + 0.7,
          r,
          0,
          prog,
          0,
          0,
          0,
          frost * 0.7,
          FROST,
          0,
          2,
        );
        this.drawn.frost++;
      }
      if (live && showGlyphs && (rec.answers.length > 0 || timer)) {
        overlay.badge(x, 0.1, z + r, answers, key, rec.ownerHex, timer, 1, tone);
      }
      return;
    }
    if (frost > 0 && rec.shape !== 'mark' && rec.shape !== 'link' && rec.shape !== 'raid') {
      // Held by Stasis: a thin bezel just outside it, ticked like a clock's.
      const kind =
        rec.shape === 'circle'
          ? TG.circle
          : rec.shape === 'cone'
            ? TG.cone
            : rec.shape === 'line'
              ? TG.line
              : TG.donut;
      kit.telegraphs.push(
        kind,
        rec.cx,
        0.036,
        rec.cz,
        rec.rot,
        rec.ex + 0.3,
        rec.ez + 0.3,
        rec.a,
        rec.b,
        prog,
        0,
        0,
        0,
        frost * 0.75,
        FROST,
        0,
        2,
      );
      this.drawn.frost++;
    }

    switch (rec.shape) {
      case 'circle':
        kit.telegraphs.push(
          TG.circle,
          rec.cx,
          0.035,
          rec.cz,
          0,
          rec.ex,
          rec.ez,
          rec.a,
          0,
          prog,
          perfect,
          sev,
          flash,
          alpha,
          null,
          pw,
        );
        if (rec.needle && live) {
          // Needle Rain (Movement III): a needle falling point-first onto the circle.
          kit.sprites.push(
            rec.cx,
            0.5 + 7 * (1 - prog) * (1 - prog),
            rec.cz,
            0.6,
            SPRITE.needle,
            NEEDLE,
            alpha * (0.6 + 0.4 * prog),
          );
          this.drawnM3.needles++;
        }
        if (live && showGlyphs)
          overlay.badge(
            rec.cx,
            0.1,
            rec.cz + rec.a,
            answers,
            key,
            borderHex,
            timer,
            glyphScale,
            tone,
          );
        break;
      case 'cone':
        kit.telegraphs.push(
          TG.cone,
          rec.cx,
          0.035,
          rec.cz,
          rec.rot,
          rec.ex,
          rec.ez,
          rec.a,
          rec.b,
          prog,
          perfect,
          sev,
          flash,
          alpha,
          null,
          pw,
        );
        // A Crimson Tide (Movement II): half the arena; its badge sits near the caster, not at
        // its far edge (off the arena).
        if (rec.b >= TIDE_HALF && live) this.drawnM2.tides++;
        if (live && showGlyphs) {
          const reach = rec.b >= TIDE_HALF ? Math.min(rec.a, 6) : rec.a;
          overlay.badge(
            rec.cx + Math.cos(rec.rot) * reach,
            0.1,
            rec.cz + Math.sin(rec.rot) * reach,
            answers,
            key,
            borderHex,
            timer,
            glyphScale,
            tone,
          );
        }
        break;
      case 'line':
        kit.telegraphs.push(
          TG.line,
          rec.cx,
          0.035,
          rec.cz,
          rec.rot,
          rec.ex,
          rec.ez,
          rec.a,
          rec.b,
          prog,
          perfect,
          sev,
          flash,
          alpha,
          null,
          pw,
        );
        if (rec.cut && live && shape && shape.kind === 'line')
          this.cutLine(rec, state, shape, kit, alpha, time);
        if (live && showGlyphs) {
          // On the near side of the lance, a third of the way along.
          const k = -rec.a * 0.33;
          overlay.badge(
            rec.cx + Math.cos(rec.rot) * k,
            0.1,
            rec.cz + Math.sin(rec.rot) * k + rec.b + 0.3,
            answers,
            key,
            borderHex,
            timer,
            glyphScale,
            tone,
          );
        }
        break;
      case 'donut':
        kit.telegraphs.push(
          TG.donut,
          rec.cx,
          0.035,
          rec.cz,
          0,
          rec.ex,
          rec.ez,
          rec.a,
          rec.b,
          prog,
          perfect,
          sev,
          flash,
          alpha,
          null,
          pw,
        );
        if (live && showGlyphs)
          overlay.badge(
            rec.cx,
            0.1,
            rec.cz + rec.a * 0.5,
            answers,
            key,
            borderHex,
            timer,
            glyphScale,
            tone,
          );
        break;
      case 'mark': {
        const target = shape && shape.kind === 'mark' ? this.entities.recs.get(shape.target) : null;
        if (target) {
          rec.cx = target.x;
          rec.cz = target.z;
          rec.a = target.height;
          rec.b = target.radius;
        }
        this.drawMark(rec.cx, rec.cz, rec.a, rec.b, kit, prog, perfect, sev, flash, alpha, frost);
        // Execution (Movement II): its threshold on the badge; the ally bar shows the notch.
        if (rec.execute > 0 && live) this.drawnM2.executions++;
        if (rec.doom && live) {
          // Doom's ignition (Movement III): its five pips, all lit and lethal, circling the mark.
          for (let i = 0; i < DOOM_AT; i++) {
            const a = time * 2.4 + (i * Math.PI * 2) / DOOM_AT;
            kit.spritesTop.push(
              rec.cx + Math.cos(a) * 0.62,
              rec.a + 0.75 + Math.sin(a) * 0.62,
              rec.cz,
              0.13,
              SPRITE.doomPip,
              C.lethal,
              alpha,
              0,
              1,
              1,
            );
          }
          this.drawnM3.doomMarks++;
        }
        if (live && showGlyphs) {
          const left = timer || remain.toFixed(1);
          overlay.badge(
            rec.cx,
            rec.a + 1.9,
            rec.cz,
            answers,
            key,
            borderHex,
            rec.execute > 0 ? `<${Math.round(rec.execute * 100)}% · ${left}` : left,
            glyphScale,
            tone,
          );
        }
        break;
      }
      case 'link': {
        if (shape && shape.kind === 'link') {
          const a = this.entities.recs.get(shape.a);
          const b = this.entities.recs.get(shape.b);
          if (a && b) {
            rec.cx = (a.x + b.x) / 2;
            rec.cz = (a.z + b.z) / 2;
            if (rec.stitch) this.drawStitch(a, b, kit, prog, sev, alpha);
            else this.drawLink(a, b, shape.r, kit, prog, sev, alpha, time, rec.pact);
          }
        }
        if (rec.pact && live) this.drawnM2.pacts++;
        if (rec.stitch && live) this.drawnM3.stitches++;
        if (live && showGlyphs)
          overlay.badge(
            rec.cx,
            1.9,
            rec.cz,
            answers,
            key,
            borderHex,
            // Blood Pact (Movement II): both take +20% while linked.
            rec.pact ? `${PACT_LABEL} · ${timer || remain.toFixed(1)}` : timer || remain.toFixed(1),
            glyphScale,
            tone,
          );
        break;
      }
      case 'raid': {
        for (const id of state.party) {
          const h = this.entities.recs.get(id);
          const e = state.entities.get(id);
          if (!h || !e?.health || e.health.dead || e.health.downed) continue;
          this.drawMark(h.x, h.z, h.height, h.radius, kit, prog, perfect, sev, flash, alpha, frost);
        }
        if (rec.cut && live) this.unpickRipple(state, kit, alpha, time);
        if (live) {
          overlay.raid(`${rec.name} · ${timer || remain.toFixed(1)}s`, prog);
          if (showGlyphs) {
            const w = this.entities.recs.get(state.weaverId);
            if (w) overlay.badge(w.x, 3.2, w.z, answers, key, borderHex, '', glyphScale, tone);
          }
        }
        break;
      }
      default:
        break;
    }
  }

  // ── Movement III (docs/phase-5c/vfx-audio.md) ───────────────────────────────────────────

  /**
   * A zone's tell. The Void Maw's Inhale: a swirl at its full reach whose arms turn faster and
   * tighten as the tell runs out. The Null Priest's rune: a ring of glyphs closing in on the
   * Weaver's feet to the rune's reach. Each with its badge (Rally, Reel, move; move).
   */
  private zoneTell(
    rec: TgRec,
    kit: FxKit,
    overlay: Overlay,
    prog: number,
    alpha: number,
    live: boolean,
    showGlyphs: boolean,
    answers: readonly GlyphIcon[],
    key: string,
    timer: string,
    tone: number,
  ): void {
    const r = rec.a;
    if (rec.zone === 'pull') {
      kit.rings.push(
        rec.cx,
        0.04,
        rec.cz,
        r,
        0.1,
        0.25,
        RING.swirl,
        SWIRL,
        alpha * (0.5 + 0.5 * prog),
        0,
        7,
        0.25 + 0.55 * prog,
        0.4 + 2.6 * prog,
      );
      // The tightening: an inner ring drawn in from the rim as the breath is drawn.
      kit.rings.push(
        rec.cx,
        0.045,
        rec.cz,
        r * (1 - 0.65 * prog),
        0.06,
        0.2,
        RING.plain,
        SWIRL,
        alpha * 0.8,
      );
      if (live) this.drawnM3.swirls++;
    } else {
      // The rune closes from half again its reach onto it.
      const R = r * (1 + 0.6 * (1 - prog));
      kit.rings.push(
        rec.cx,
        0.045,
        rec.cz,
        R,
        0.1,
        0.16,
        RING.rune,
        RUNE,
        alpha,
        0,
        7,
        0.06 * prog,
        12,
        prog * 1.2,
      );
      kit.rings.push(rec.cx, 0.04, rec.cz, r, 0.04, 0.08, RING.plain, RUNE, alpha * 0.45);
      if (live) this.drawnM3.runes++;
    }
    if (live && showGlyphs && answers.length > 0)
      overlay.badge(
        rec.cx,
        0.1,
        rec.cz + r,
        answers,
        key,
        rec.zone === 'pull' ? RIFT_HEX.swirl : RIFT_HEX.rune,
        timer,
        1,
        tone,
      );
  }

  /**
   * The Mimic's mirror (live): a shimmer from the caster to whom the copy goes (the sim's own
   * rule), a mirror over them, and the copied glyph (Ward, Chime or Empower) on its badge.
   */
  private mirrorCast(
    rec: TgRec,
    state: WorldState,
    kit: FxKit,
    overlay: Overlay,
    alpha: number,
    showGlyphs: boolean,
  ): void {
    const caster = state.entities.get(rec.owner);
    const from = this.entities.recs.get(rec.owner);
    if (!caster || !from) return;
    const to = this.entities.recs.get(mimicBeneficiary(state, caster)) ?? from;
    const copy = caster.enemy?.mimic?.copy;
    const fy = from.height * 0.7 + from.y;
    const ty = to.height * 0.6 + to.y;
    if (to !== from) {
      kit.beams.push(from.x, fy, from.z, to.x, ty, to.z, 0.18, BEAM.lance, MIRROR, alpha * 0.8);
      kit.beams.push(from.x, fy, from.z, to.x, ty, to.z, 0.55, BEAM.glow, MIRROR, alpha * 0.3);
    }
    kit.sprites.push(to.x, to.height + 0.5 + to.y, to.z, 0.38, SPRITE.mirror, MIRROR, alpha * 0.9);
    this.drawnM3.mirrors++;
    if (copy && showGlyphs)
      overlay.badge(
        to.x,
        to.height + STATUS_BADGE_LIFT + to.y,
        to.z,
        [copy],
        `mirror:${copy}`,
        RIFT_HEX.mirror,
        `Mirror · ${copyLabel(copy)}`,
      );
  }

  /**
   * A cut line (the Shears, the Snip, Movement III): its centre drawn dotted, and the scissors
   * where it crosses the live Thread (the sim's own segment), so you see where it will cut.
   */
  private cutLine(
    rec: TgRec,
    state: WorldState,
    s: { readonly x: number; readonly z: number; readonly toX: number; readonly toZ: number },
    kit: FxKit,
    alpha: number,
    time: number,
  ): void {
    this.tmpColor.copy(rec.sev > 0.5 ? C.lethal : C.threat).lerp(C.white, 0.35);
    kit.beams.push(
      s.x,
      0.1,
      s.z,
      s.toX,
      0.1,
      s.toZ,
      0.2,
      BEAM.dashed,
      this.tmpColor,
      alpha,
      1,
      1,
      2.2,
    );
    this.drawnM3.cutLines++;
    if (!shearsCrossing(state, s, this.cross)) return;
    const pulse = 0.75 + 0.25 * Math.sin(time * 14);
    kit.spritesTop.push(
      this.cross.x,
      1.05,
      this.cross.z,
      0.42 * (0.9 + 0.1 * pulse),
      SPRITE.scissors,
      FRAY,
      alpha * pulse,
      Math.atan2(s.toZ - s.z, s.toX - s.x) * 0.2,
    );
    kit.rings.push(
      this.cross.x,
      0.05,
      this.cross.z,
      0.55,
      0.08,
      0.2,
      RING.plain,
      FRAY,
      alpha * 0.8 * pulse,
    );
    this.drawnM3.scissors++;
  }

  /** The Stitch (Movement III): a cross-stitched link, never the threat dashes. */
  private drawStitch(
    a: EntityRec,
    b: EntityRec,
    kit: FxKit,
    prog: number,
    sev: number,
    alpha: number,
  ): void {
    this.tmpColor.copy(STITCH).lerp(C.lethal, 0.35 * sev);
    const ay = a.height * 0.6 + a.y;
    const by = b.height * 0.6 + b.y;
    kit.beams.push(
      a.x,
      ay,
      a.z,
      b.x,
      by,
      b.z,
      0.36,
      BEAM.stitch,
      this.tmpColor,
      alpha * (0.7 + 0.3 * prog),
      1,
      1,
      0.8,
    );
    kit.beams.push(
      a.x,
      ay,
      a.z,
      b.x,
      by,
      b.z,
      0.8,
      BEAM.glow,
      C.ailment,
      alpha * 0.25 * (0.5 + prog),
    );
  }

  /** The Unpick (Movement III): a ripple of snaps running along your Thread as the raid builds. */
  private unpickRipple(state: WorldState, kit: FxKit, alpha: number, time: number): void {
    const seg = threadSegment(state);
    if (!seg) return;
    for (let k = 0; k < 3; k++) {
      const t = (time * 1.4 + k / 3) % 1;
      kit.sprites.push(
        seg.ax + (seg.bx - seg.ax) * t,
        1.1,
        seg.az + (seg.bz - seg.az) * t,
        0.3,
        SPRITE.ring,
        FRAY,
        alpha * Math.sin(Math.PI * t),
      );
    }
    this.drawnM3.ripples++;
  }

  private drawMark(
    x: number,
    z: number,
    height: number,
    radius: number,
    kit: FxKit,
    prog: number,
    perfect: number,
    sev: number,
    flash: number,
    alpha: number,
    frost = 0,
  ): void {
    kit.marks.push(
      TG.mark,
      x,
      height + 0.75,
      z,
      0,
      1.15,
      1.15,
      0.8,
      0,
      prog,
      perfect,
      sev,
      flash,
      alpha,
    );
    if (frost > 0) {
      // Held by Stasis: a thin cold ring round the mark.
      kit.marks.push(
        TG.mark,
        x,
        height + 0.75,
        z,
        0,
        1.3,
        1.3,
        0.8,
        0,
        prog,
        0,
        0,
        0,
        frost * 0.8,
        FROST,
        0,
        2,
      );
      this.drawn.frost++;
    }
    const r = radius * 1.9;
    kit.telegraphs.push(
      TG.target,
      x,
      0.04,
      z,
      0,
      r + 0.3,
      r + 0.3,
      r,
      0,
      prog,
      perfect,
      sev,
      flash,
      alpha * 0.9,
    );
  }

  private drawLink(
    a: EntityRec,
    b: EntityRec,
    r: number,
    kit: FxKit,
    prog: number,
    sev: number,
    alpha: number,
    time: number,
    pact = false,
  ): void {
    const d = Math.hypot(a.x - b.x, a.z - b.z);
    const close = d < r;
    // Close is lethal for any link; apart, a Blood Pact keeps its own plum tint.
    this.tmpColor.copy(close ? C.lethal : pact ? PACT : C.threat);
    if (!close && sev > 0.5) this.tmpColor.lerp(C.lethal, 0.5);
    const pulse = close ? 0.75 + 0.25 * Math.sin(time * 18) : 1;
    const width = close ? 0.42 : 0.3;
    kit.beams.push(
      a.x,
      a.height * 0.6,
      a.z,
      b.x,
      b.height * 0.6,
      b.z,
      width,
      BEAM.dashed,
      this.tmpColor,
      alpha * pulse * (1 + 0.6 * prog),
      1,
      1,
      2.5,
    );
    kit.beams.push(
      a.x,
      a.height * 0.6,
      a.z,
      b.x,
      b.height * 0.6,
      b.z,
      width * 2.6,
      BEAM.glow,
      this.tmpColor,
      alpha * 0.45 * (0.5 + prog),
    );
    if (close) {
      kit.telegraphs.push(
        TG.target,
        a.x,
        0.04,
        a.z,
        0,
        r + 0.3,
        r + 0.3,
        r,
        0,
        prog,
        0,
        1,
        0,
        alpha * 0.5,
      );
      kit.telegraphs.push(
        TG.target,
        b.x,
        0.04,
        b.z,
        0,
        r + 0.3,
        r + 0.3,
        r,
        0,
        prog,
        0,
        1,
        0,
        alpha * 0.5,
      );
    }
  }

  private impact(rec: TgRec, kit: FxKit): void {
    // A burst of threat-coloured sparks over the area as it resolves.
    const c = rec.sev > 0.5 ? C.lethal : C.threat;
    let spread = 1;
    let x = rec.cx;
    let z = rec.cz;
    if (rec.shape === 'circle') spread = rec.a * 1.4;
    else if (rec.shape === 'cone') {
      x += Math.cos(rec.rot) * rec.a * 0.5;
      z += Math.sin(rec.rot) * rec.a * 0.5;
      spread = rec.a;
    } else if (rec.shape === 'line') spread = Math.min(4, rec.a);
    else if (rec.shape === 'donut') spread = rec.b * 1.6;
    else if (rec.shape === 'mark') spread = 0.8;
    const n = Math.min(40, 10 + spread * 4);
    kit.particles.burst(x, 0.2, z, n, 4, 3.5, 0.6, 0.18, c, 0.95, PARTICLE.spark, 3, 6, spread);
  }

  private markThreats(
    rec: TgRec,
    state: WorldState,
    shape: WorldState['telegraphs'][number]['shape'],
  ): void {
    if (rec.effect !== 'damage') return;
    const level = 0.5 + rec.sev * 0.5;
    switch (shape.kind) {
      case 'mark':
        this.addThreat(shape.target, level);
        return;
      case 'link':
        this.addThreat(shape.a, level);
        this.addThreat(shape.b, level);
        return;
      case 'raid':
        for (const id of state.party) this.addThreat(id, level);
        return;
      default:
        break;
    }
    for (const id of state.party) {
      const h = this.entities.recs.get(id);
      if (!h) continue;
      if (this.contains(rec, shape, h.x, h.z, h.radius)) this.addThreat(id, level);
    }
  }

  private addThreat(id: EntityId, level: number): void {
    const prev = this.threatened.get(id) ?? 0;
    if (level > prev) this.threatened.set(id, level);
  }

  private contains(
    rec: TgRec,
    s: WorldState['telegraphs'][number]['shape'],
    x: number,
    z: number,
    r: number,
  ): boolean {
    switch (s.kind) {
      case 'circle':
        return Math.hypot(x - s.x, z - s.z) <= s.r + r;
      case 'donut': {
        const d = Math.hypot(x - s.x, z - s.z);
        return d > s.innerR && d <= s.outerR + r;
      }
      case 'cone': {
        const dx = x - s.x;
        const dz = z - s.z;
        const d = Math.hypot(dx, dz);
        if (d > s.r + r) return false;
        if (d < r + 0.5) return true;
        return (dx * s.dirX + dz * s.dirZ) / d >= s.halfAngleCos;
      }
      case 'line': {
        const lx = s.toX - s.x;
        const lz = s.toZ - s.z;
        const l2 = lx * lx + lz * lz;
        let u = l2 > 0 ? ((x - s.x) * lx + (z - s.z) * lz) / l2 : 0;
        u = u < 0 ? 0 : u > 1 ? 1 : u;
        return Math.hypot(x - (s.x + lx * u), z - (s.z + lz * u)) <= s.width / 2 + r;
      }
      default:
        return rec.id < 0;
    }
  }

  dispose(): void {
    this.recs.clear();
    this.effects.clear();
    this.outcomes.clear();
  }
}
