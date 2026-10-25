import type { CallAnswer, EntityId, SimEventOf, WorldState } from '../sim';
import type { EntityLayer } from './entities';
import type { FxKit } from './fx/kit';
import { PARTICLE } from './fx/particles';
import { RING } from './fx/rings';
import { SPRITE } from './fx/sprites';
import type { Overlay } from './overlay';
import { C, VISION_HEX, clamp01 } from './palette';

const LABEL: Record<CallAnswer, string> = { ward: 'Ward', empower: 'Empower', chime: 'Chime' };
const QUIET_FADE = 0.45;
const POP_FADE = 0.32;

interface CallRec {
  hero: EntityId;
  seen: number;
  answer: CallAnswer;
  start: number;
  end: number;
  answered: boolean;
  flourish: string;
  /** 1 → 0 on the call opening. */
  pop: number;
  /** 1 → 0 when it is answered. */
  answerPop: number;
  /** ≥ 0 once the call has closed (seconds into the fade-out). */
  fade: number;
  /** Fade-out style: answered calls burst, missed / cancelled ones quietly sink away. */
  burst: boolean;
  motes: number;
}

/**
 * Signature 2, Call and Response (state + events): while a hero calls (`hero.call`), a gold
 * call glyph floats over them showing the answer they want (Ward / Empower / Chime) inside a
 * countdown ring, echoed by a countdown arc at their feet. Gold = opportunity, never the threat
 * amber or lethal red. Answered → the glyph fills and names the Flourish; closed → it bursts
 * (answered) or quietly sinks away (missed, cancelled). The answer link and the Flourishes
 * themselves are transient FX in feedback.ts.
 */
export class CallView {
  private readonly recs = new Map<EntityId, CallRec>();
  private frameNo = 0;
  /** Lab-only: synthetic calls drawn as if they were in the state. Never set by the game. */
  preview: Map<
    EntityId,
    { answer: CallAnswer; start: number; end: number; answered: boolean }
  > | null = null;

  constructor(private readonly entities: EntityLayer) {}

  private rec(hero: EntityId): CallRec {
    let r = this.recs.get(hero);
    if (!r) {
      r = {
        hero,
        seen: 0,
        answer: 'ward',
        start: 0,
        end: 1,
        answered: false,
        flourish: '',
        pop: 1,
        answerPop: 0,
        fade: -1,
        burst: false,
        motes: 0,
      };
      this.recs.set(hero, r);
    }
    return r;
  }

  onStarted(e: SimEventOf<'callStarted'>): void {
    const r = this.rec(e.hero);
    r.flourish = e.flourish;
    r.answer = e.answer;
    r.pop = 1;
    r.fade = -1;
    r.answered = false;
  }

  onAnswered(e: SimEventOf<'callAnswered'>): void {
    const r = this.rec(e.hero);
    r.flourish = e.flourish || r.flourish;
    r.answered = true;
    r.answerPop = 1;
  }

  onEnded(e: SimEventOf<'callEnded'>): void {
    const r = this.recs.get(e.hero);
    if (r && r.fade < 0) {
      r.fade = 0;
      r.burst = false;
    }
  }

  /** The flourish name a hero's open call would become (for labels). */
  flourishOf(hero: EntityId): string {
    return this.recs.get(hero)?.flourish ?? '';
  }

  sync(state: WorldState, kit: FxKit, overlay: Overlay, dt: number): void {
    this.frameNo++;
    const time = state.time;
    for (const id of state.party) {
      const e = state.entities.get(id);
      const p = this.preview?.get(id);
      if (p && !p.answered && time > p.end) this.preview!.delete(id);
      const call = e?.hero?.call ?? this.preview?.get(id) ?? null;
      if (!e || !call || e.health?.dead) continue;
      const r = this.rec(id);
      r.seen = this.frameNo;
      r.fade = -1;
      if (r.start !== call.start) r.pop = 1;
      r.answer = call.answer;
      r.start = call.start;
      r.end = call.end;
      if (call.answered && !r.answered) r.answerPop = 1;
      r.answered = call.answered;
      this.draw(r, kit, overlay, dt, time, -1);
    }
    for (const [id, r] of this.recs) {
      if (r.seen === this.frameNo) continue;
      if (r.seen === 0) {
        // Only an event so far (state not caught up): nothing to draw yet.
        if (r.fade >= 0) this.recs.delete(id);
        continue;
      }
      if (r.fade < 0) {
        r.fade = 0;
        r.burst = r.answered;
      }
      r.fade += dt;
      if (r.fade >= (r.burst ? POP_FADE : QUIET_FADE)) {
        this.recs.delete(id);
        continue;
      }
      this.draw(r, kit, overlay, dt, time, r.fade);
    }
  }

  private draw(
    r: CallRec,
    kit: FxKit,
    overlay: Overlay,
    dt: number,
    time: number,
    fade: number,
  ): void {
    const hr = this.entities.recs.get(r.hero);
    if (!hr) return;
    r.pop = Math.max(0, r.pop - dt * 4);
    r.answerPop = Math.max(0, r.answerPop - dt * 3);
    const total = Math.max(0.05, r.end - r.start);
    const remain = r.answered ? 1 : clamp01((r.end - time) / total);
    const closing = fade >= 0;
    let alpha = 1;
    let scale = 1 + r.pop * r.pop * 0.6 + r.answerPop * 0.35;
    let lift = 0;
    let hex = VISION_HEX.call;
    if (closing) {
      if (r.burst) {
        const k = fade / POP_FADE;
        alpha = 1 - k;
        scale = 1 + k * 1.1;
      } else {
        const k = fade / QUIET_FADE;
        alpha = (1 - k) * 0.8;
        scale = 1 - k * 0.2;
        lift = -k * 0.35;
        hex = '#94a3b8';
      }
    } else if (!r.answered && remain < 0.35) {
      // Hurry: the glyph throbs as the window closes.
      scale *= 1 + 0.07 * Math.sin(time * 24);
    }
    const y = hr.height + 1.05 + hr.y + lift;
    const label = r.answered ? r.flourish || 'Answered' : LABEL[r.answer];
    overlay.bubble(hr.x, y, hr.z, r.answer, label, hex, remain, scale, alpha, r.answered);
    if (closing && !r.burst) return;
    const a = alpha * (closing ? 0.6 : 1);
    // World echo: a glow behind the glyph, a countdown arc at the feet and a beckoning ring.
    kit.spritesTop.push(hr.x, y, hr.z, 0.75 * scale, SPRITE.glow, C.call, 0.35 * a);
    kit.rings.push(
      hr.x,
      0.04,
      hr.z,
      hr.radius * 2.15,
      0.1,
      0.22,
      RING.plain,
      C.call,
      0.95 * a,
      -Math.PI / 2,
      remain * Math.PI * 2,
    );
    if (!r.answered) {
      const beat = (time * 1.6) % 1;
      kit.rings.push(
        hr.x,
        0.04,
        hr.z,
        hr.radius * (2.2 + beat * 1.6),
        0.06,
        0.12,
        RING.plain,
        C.call,
        0.6 * (1 - beat) * a,
      );
    }
    r.motes += dt * 9 * kit.particles.density;
    while (r.motes > 1) {
      r.motes -= 1;
      const ang = Math.random() * Math.PI * 2;
      kit.particles.emit(
        hr.x + Math.cos(ang) * hr.radius * 1.4,
        0.2,
        hr.z + Math.sin(ang) * hr.radius * 1.4,
        0,
        1.8,
        0,
        0.7,
        0.1,
        C.call,
        0.9 * a,
        PARTICLE.spark,
        0.6,
      );
    }
  }

  clear(): void {
    this.recs.clear();
  }
}
