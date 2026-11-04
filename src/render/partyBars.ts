import { healthBands, healthLevel, raging } from '../app/healthLevels';
import { CONTENT, heroDef } from '../content';
import { fallingFast, vowHoldsAt, type EntityId, type WorldState } from '../sim';
import type { EntityLayer } from './entities';
import type { AllyBarView } from './overlay';
import { DRAIN_HOLD, bloodNotches, executeBelowOf, signalHex } from './crimsonCues';

/** A hit's white trail holds this long (s), then drains at this share of max life a second. */
export const TRAIL_HOLD = 0.4;
export const TRAIL_DRAIN = 0.9;
/** The bars sit this far over the heroes' heads (m): under the mode glyph and a call's bubble. */
export const BAR_LIFT = 0.42;

/**
 * Martyr's Vow holds every hero at 1 life: nothing that lands before it ends is lethal. The one
 * gate for every lethal cue (the bars here, Brann's off-screen arrow in combatView.ts).
 */
export function vowCoversAll(state: WorldState): boolean {
  return (
    !!state.field.vow &&
    state.telegraphs.every((t) => t.effect !== 'damage' || vowHoldsAt(state, t.impact))
  );
}

/** Bars over the heroes: always, only while hurt, or none (Settings → Health and the HUD). */
export type AllyBarsMode = 'always' | 'hurt' | 'off';

export interface AllyBarsSink {
  allyBar(x: number, y: number, z: number, bar: AllyBarView): void;
}

/**
 * The bars over the heroes (docs/health-ui.md): what a healer reads first, where the fight is.
 * Twice the old size and drawn for the whole party, each in the colour of how much is left
 * rather than the hero's own: healthy, under half, under a quarter (glowing), in the palette's
 * threat and lethal under every colour vision. A hit leaves a white trail that holds, then drains;
 * the damage telegraphed at them shows as stripes at the end of their life; the key that threads
 * them hangs beside it in their colour. Out of the Weaver's reach (her techniques' range), faded.
 */
export class PartyBarsView {
  private readonly trails = new Map<EntityId, { trail: number; hold: number; last: number }>();
  /** Bloodletting's drains (Brann only): the life spent seen, the segment's top and its end. */
  private readonly drains = new Map<EntityId, { seen: number; top: number; until: number }>();
  /** The bars drawn last frame (tests, the lab). */
  readonly drawn: (AllyBarView & { id: EntityId })[] = [];

  constructor(private readonly entities: Pick<EntityLayer, 'recs'>) {}

  sync(
    state: WorldState,
    overlay: AllyBarsSink | null,
    dt: number,
    time: number,
    mode: AllyBarsMode = 'always',
    keys: readonly string[] = DEFAULT_KEYS,
  ): void {
    this.drawn.length = 0;
    const weaver = state.entities.get(state.weaverId);
    const reach = CONTENT.techniques.ward.range;
    const vowCovers = vowCoversAll(state);
    state.party.forEach((id, slot) => {
      const e = state.entities.get(id);
      const h = e?.health;
      const rec = this.entities.recs.get(id);
      if (!e || !h || !rec || h.dead) {
        this.trails.delete(id);
        this.drains.delete(id);
        return;
      }
      const max = Math.max(1, h.maxHp);
      const hp = clamp01(h.hp / max);
      let shieldAmount = 0;
      for (const s of h.shields) shieldAmount += s.amount;
      // Brann's Bloodletting (docs/phase-5b.md) is life he spent, not a hit: a drain segment,
      // never the white trail. Absent `blood` (every default hero), nothing here runs.
      const blood = e.hero?.blood;
      const drain = blood ? this.drainOf(id, blood.spent, hp, max, time) : 0;
      const trail = this.trailOf(id, hp, dt, time);
      const hurt = hp < 0.999 || shieldAmount > 0 || h.incoming > 0 || h.downed || trail > hp;
      if (mode === 'off' || (mode === 'hurt' && !hurt)) return;
      const lethal = !vowCovers && h.incoming > 0 && h.incoming >= h.hp + shieldAmount;
      // His own alarm lines (healthLevels.ts): critical below 15% or falling fast. The default
      // heroes have none of their own, so theirs is the shared ramp as before.
      const defId = e.hero?.defId;
      // …and with a lethal hit coming, critical too (docs/phase-5b.md), as on his frame.
      const level = blood
        ? healthLevel(h.hp, max, defId, fallingFast(e) || lethal)
        : healthLevel(h.hp, max);
      const own = e.hero ? heroDef(e.hero.defId).color : '#e2e8f0';
      const bar: AllyBarView = {
        hp,
        trail,
        shield: clamp01(shieldAmount / max),
        incoming: clamp01(h.incoming / max),
        lethal,
        level,
        key: keys[slot] ?? String(slot + 1),
        // Brann's tag is his brass, never his crimson beside a lethal bar (crimsonCues.ts).
        keyHex: signalHex(defId, own),
        dim: weaver ? Math.hypot(e.x - weaver.x, e.z - weaver.z) > reach : false,
        pulse: level === 2 || lethal ? 0.5 + 0.5 * Math.sin(time * 9) : 0,
      };
      // Execution (Movement II): its threshold as a notch on the bar of the hero it marks.
      const notch = executionOn(state, id);
      if (notch > 0) bar.notch = notch;
      if (blood) {
        // Brann: his notches (40%; 30% with the Hymn or Blood and Silk; 10% with Deathless), the
        // raging band from his critical line up to his Bloodlust line, and a Bloodletting drain.
        const bands = healthBands(defId);
        bar.ticks = bloodNotches(state, e);
        if (bands.raging !== undefined) bar.band = [bands.critical, bands.raging];
        bar.raging = raging(h.hp, max, defId) && level !== 2;
        if (drain > 0) {
          bar.drain = drain;
          bar.drainAlpha = this.drainAlpha(id, time);
        }
      }
      this.drawn.push({ ...bar, id });
      overlay?.allyBar(rec.x, rec.height + BAR_LIFT + rec.y, rec.z, bar);
    });
  }

  /**
   * Bloodletting's drain (Brann): when `spent` (the state's life spent on purpose) grows, the life
   * it took shows as a drain segment above what is left, for `DRAIN_HOLD` seconds, and the white
   * trail is moved down with it, so the drop never reads as a hit. Returns the segment's width
   * (a share of max life; 0: none).
   */
  private drainOf(id: EntityId, spent: number, hp: number, max: number, time: number): number {
    let d = this.drains.get(id);
    if (!d) {
      d = { seen: spent, top: hp, until: -1 };
      this.drains.set(id, d);
    }
    if (spent > d.seen + 1e-6) {
      const share = (spent - d.seen) / max;
      d.seen = spent;
      d.top = Math.min(1, hp + share);
      d.until = time + DRAIN_HOLD;
      const t = this.trails.get(id);
      if (t) {
        t.trail = Math.max(hp, t.trail - share);
        t.last = hp;
      }
    } else if (spent < d.seen) d.seen = spent;
    if (time >= d.until) return 0;
    return Math.max(0, d.top - hp);
  }

  /** The drain segment's alpha: whole, then fading over its last third. */
  private drainAlpha(id: EntityId, time: number): number {
    const d = this.drains.get(id);
    if (!d) return 0;
    return clamp01(((d.until - time) / DRAIN_HOLD) * 3);
  }

  /** The white trail: it holds where life was for a moment after a hit, then drains to it. */
  private trailOf(id: EntityId, hp: number, dt: number, time: number): number {
    let t = this.trails.get(id);
    if (!t) {
      t = { trail: hp, hold: -1, last: hp };
      this.trails.set(id, t);
    }
    if (hp < t.last - 1e-4) t.hold = time + TRAIL_HOLD;
    t.last = hp;
    if (hp >= t.trail) t.trail = hp;
    else if (time >= t.hold) t.trail = Math.max(hp, t.trail - TRAIL_DRAIN * dt);
    return t.trail;
  }
}

const DEFAULT_KEYS = ['1', '2', '3', '4'];

/** The threshold of an Execution marking `id` (a share of max life), or 0 for none. */
export function executionOn(state: WorldState, id: EntityId): number {
  for (const t of state.telegraphs) {
    if (t.shape.kind !== 'mark' || t.shape.target !== id) continue;
    const below = executeBelowOf(t);
    if (below > 0) return below;
  }
  return 0;
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
