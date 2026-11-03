import { healthLevel } from '../app/healthLevels';
import { CONTENT, heroDef } from '../content';
import { vowHoldsAt, type EntityId, type WorldState } from '../sim';
import type { EntityLayer } from './entities';
import type { AllyBarView } from './overlay';
import { executeBelowOf } from './crimsonCues';

/** A hit's white trail holds this long (s), then drains at this share of max life a second. */
export const TRAIL_HOLD = 0.4;
export const TRAIL_DRAIN = 0.9;
/** The bars sit this far over the heroes' heads (m): under the mode glyph and a call's bubble. */
export const BAR_LIFT = 0.42;

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
    // Martyr's Vow holds every hero at 1 life: nothing that lands before it ends is lethal.
    const vowCovers =
      state.field.vow &&
      state.telegraphs.every((t) => t.effect !== 'damage' || vowHoldsAt(state, t.impact));
    state.party.forEach((id, slot) => {
      const e = state.entities.get(id);
      const h = e?.health;
      const rec = this.entities.recs.get(id);
      if (!e || !h || !rec || h.dead) {
        this.trails.delete(id);
        return;
      }
      const max = Math.max(1, h.maxHp);
      const hp = clamp01(h.hp / max);
      let shieldAmount = 0;
      for (const s of h.shields) shieldAmount += s.amount;
      const trail = this.trailOf(id, hp, dt, time);
      const hurt = hp < 0.999 || shieldAmount > 0 || h.incoming > 0 || h.downed || trail > hp;
      if (mode === 'off' || (mode === 'hurt' && !hurt)) return;
      const lethal = !vowCovers && h.incoming > 0 && h.incoming >= h.hp + shieldAmount;
      const level = healthLevel(h.hp, max);
      const bar: AllyBarView = {
        hp,
        trail,
        shield: clamp01(shieldAmount / max),
        incoming: clamp01(h.incoming / max),
        lethal,
        level,
        key: keys[slot] ?? String(slot + 1),
        keyHex: e.hero ? heroDef(e.hero.defId).color : '#e2e8f0',
        dim: weaver ? Math.hypot(e.x - weaver.x, e.z - weaver.z) > reach : false,
        pulse: level === 2 || lethal ? 0.5 + 0.5 * Math.sin(time * 9) : 0,
      };
      // Execution (Movement II): its threshold as a notch on the bar of the hero it marks.
      const notch = executionOn(state, id);
      if (notch > 0) bar.notch = notch;
      this.drawn.push({ ...bar, id });
      overlay?.allyBar(rec.x, rec.height + BAR_LIFT + rec.y, rec.z, bar);
    });
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
