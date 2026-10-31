/**
 * How much life a hero has left, as the HUD and the bars over their heads say it
 * (docs/health-ui.md): healthy, hurt (under half) or critical (under a quarter). One ramp for
 * both, so a hero reads the same over their head and on their frame.
 */
export const HURT = 0.5;
export const CRITICAL = 0.25;

/** 0 healthy, 1 hurt (under half), 2 critical (under a quarter). */
export type HealthLevel = 0 | 1 | 2;

export function healthLevel(hp: number, maxHp: number): HealthLevel {
  const share = maxHp > 0 ? hp / maxHp : 0;
  return share < CRITICAL ? 2 : share < HURT ? 1 : 0;
}

/** A healthy hero's life: soft white (hurt and critical take the palette's threat and lethal). */
export const LIFE_OK = '#e8edf7';
