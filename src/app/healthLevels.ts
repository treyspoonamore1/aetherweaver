/**
 * How much life a hero has left, as the HUD and the bars over their heads say it
 * (docs/health-ui.md): healthy, hurt (under half) or critical (under a quarter). One ramp for
 * both, so a hero reads the same over their head and on their frame.
 *
 * Brann (docs/phase-5b.md, "Health alarms on Brann") fights best hurt, so his bands differ: no
 * hurt tier, an ember "raging" band from 40% down to 15%, and critical below 15% or when he is
 * falling fast. Every other hero keeps the shared ramp.
 */
export const HURT = 0.5;
export const CRITICAL = 0.25;

/** 0 healthy, 1 hurt (under half), 2 critical (under a quarter). */
export type HealthLevel = 0 | 1 | 2;

/** A hero's alarm lines, as shares of max HP. `hurt` 0: no hurt tier. */
export interface HealthBands {
  hurt: number;
  critical: number;
  /** The top of the raging band (Brann's Bloodlust line); absent for the shared ramp. */
  raging?: number;
}

const DEFAULT_BANDS: Readonly<HealthBands> = { hurt: HURT, critical: CRITICAL };

/** Heroes whose alarms aren't the shared ramp, by def id. */
const HERO_BANDS: Readonly<Record<string, Readonly<HealthBands>>> = {
  brann: { hurt: 0, critical: 0.15, raging: 0.4 },
};

/** A hero's alarm lines (the shared ramp when `defId` is absent or has none of its own). */
export function healthBands(defId?: string): HealthBands {
  const own = defId === undefined ? undefined : HERO_BANDS[defId];
  return { ...(own ?? DEFAULT_BANDS) };
}

/**
 * The alarm level. `fast` (Brann's `fallingFast`) makes a hero with bands of their own critical
 * at any life; the shared ramp ignores it, so the default heroes are unchanged.
 */
export function healthLevel(
  hp: number,
  maxHp: number,
  defId?: string,
  fast?: boolean,
): HealthLevel {
  const share = maxHp > 0 ? hp / maxHp : 0;
  const own = defId === undefined ? undefined : HERO_BANDS[defId];
  if (!own) return share < CRITICAL ? 2 : share < HURT ? 1 : 0;
  if (share < own.critical || fast) return 2;
  return share < own.hurt ? 1 : 0;
}

/** In the raging band: below the hero's raging line and not yet critical. False without one. */
export function raging(hp: number, maxHp: number, defId?: string): boolean {
  const own = defId === undefined ? undefined : HERO_BANDS[defId];
  if (own?.raging === undefined) return false;
  const share = maxHp > 0 ? hp / maxHp : 0;
  return share < own.raging && share >= own.critical;
}

/** A healthy hero's life: soft white (hurt and critical take the palette's threat and lethal). */
export const LIFE_OK = '#e8edf7';
