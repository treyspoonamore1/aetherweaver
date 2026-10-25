import * as THREE from 'three';
import { enemyDef } from '../content';
import type { AnswerTag, EntityId, SimEventOf, WorldState } from '../sim';
import type { EntityLayer, EntityRec } from './entities';
import { BEAM } from './fx/beams';
import type { FxKit } from './fx/kit';
import { PARTICLE } from './fx/particles';
import { TG } from './fx/telegraphBatch';
import type { Overlay } from './overlay';
import { C, approach, clamp01, color } from './palette';

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
}

const FADE_IN = 0.12;
const END = 0.38;
const AMBER_HEX = '#fb923c';
const CRIMSON_HEX = '#f43f5e';

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
    const rec: TgRec = {
      id: t.id,
      seen: 0,
      effect: t.effect ?? this.effects.get(t.id) ?? 'damage',
      name: t.name,
      answers: [...t.answers],
      key: t.answers.join(','),
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
    const borderHex = sev > 0.5 ? CRIMSON_HEX : AMBER_HEX;
    const remain = Math.max(0, rec.impact - time);
    const glyphScale = 1 + perfect * 0.12 * (0.5 + 0.5 * Math.sin(time * 24));

    if (!live && !cancelled && !rec.impacted) {
      rec.impacted = true;
      this.impact(rec, kit);
    }

    if (rec.effect !== 'damage') {
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
      if (live && showGlyphs && rec.answers.length > 0) {
        overlay.badge(x, 0.1, z + r, rec.answers, rec.key, rec.ownerHex, '', 1);
      }
      return;
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
        if (live && showGlyphs)
          overlay.badge(
            rec.cx,
            0.1,
            rec.cz + rec.a,
            rec.answers,
            rec.key,
            borderHex,
            '',
            glyphScale,
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
        if (live && showGlyphs) {
          overlay.badge(
            rec.cx + Math.cos(rec.rot) * rec.a,
            0.1,
            rec.cz + Math.sin(rec.rot) * rec.a,
            rec.answers,
            rec.key,
            borderHex,
            '',
            glyphScale,
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
        if (live && showGlyphs) {
          // On the near side of the lance, a third of the way along.
          const k = -rec.a * 0.33;
          overlay.badge(
            rec.cx + Math.cos(rec.rot) * k,
            0.1,
            rec.cz + Math.sin(rec.rot) * k + rec.b + 0.3,
            rec.answers,
            rec.key,
            borderHex,
            '',
            glyphScale,
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
            rec.answers,
            rec.key,
            borderHex,
            '',
            glyphScale,
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
        this.drawMark(rec.cx, rec.cz, rec.a, rec.b, kit, prog, perfect, sev, flash, alpha);
        if (live && showGlyphs) {
          overlay.badge(
            rec.cx,
            rec.a + 1.9,
            rec.cz,
            rec.answers,
            rec.key,
            borderHex,
            remain.toFixed(1),
            glyphScale,
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
            this.drawLink(a, b, shape.r, kit, prog, sev, alpha, time);
          }
        }
        if (live && showGlyphs)
          overlay.badge(
            rec.cx,
            1.9,
            rec.cz,
            rec.answers,
            rec.key,
            borderHex,
            remain.toFixed(1),
            glyphScale,
          );
        break;
      }
      case 'raid': {
        for (const id of state.party) {
          const h = this.entities.recs.get(id);
          const e = state.entities.get(id);
          if (!h || !e?.health || e.health.dead || e.health.downed) continue;
          this.drawMark(h.x, h.z, h.height, h.radius, kit, prog, perfect, sev, flash, alpha);
        }
        if (live) {
          overlay.raid(`${rec.name} · ${remain.toFixed(1)}s`, prog);
          if (showGlyphs) {
            const w = this.entities.recs.get(state.weaverId);
            if (w) overlay.badge(w.x, 3.2, w.z, rec.answers, rec.key, borderHex, '', glyphScale);
          }
        }
        break;
      }
      default:
        break;
    }
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
  ): void {
    const d = Math.hypot(a.x - b.x, a.z - b.z);
    const close = d < r;
    this.tmpColor.copy(close ? C.lethal : C.threat);
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
