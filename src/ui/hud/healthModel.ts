/**
 * A hero's life on their party frame (docs/health-ui.md), as the best healer UIs show it: the
 * colour of how much is left (the same ramp as over their heads), the number a healer works
 * from (by default the life missing), and what the whole frame says at a glance: critical, an
 * ailment Chime would cleanse, out of the Weaver's reach.
 */
import { LIFE_OK, healthLevel, type HealthLevel } from '../../app/healthLevels';
import type { HudSettings } from '../../app/settings';
import { CONTENT } from '../../content';
import { isAilment } from '../../sim';
import { fmt } from '../kit/format';
import type { HeroHud } from '../store';

export type HealthText = HudSettings['healthText'];

/** A hero's life at this level: soft white, then the palette's threat, then its lethal. */
export function lifeColor(level: HealthLevel): string {
  return level === 2 ? 'var(--color-lethal)' : level === 1 ? 'var(--color-threat)' : LIFE_OK;
}

/**
 * The numbers on a frame's bar: the big one the player chose (life missing, by default; nothing
 * at full life), and the percent beside it unless the big one is the percent.
 */
export function lifeLabels(
  hp: number,
  maxHp: number,
  mode: HealthText,
): { big: string; percent: string | null } {
  const percent = `${Math.round((Math.max(0, hp) / Math.max(1, maxHp)) * 100)}%`;
  if (mode === 'percent') return { big: percent, percent: null };
  if (mode === 'current') return { big: fmt(hp), percent };
  const missing = Math.max(0, maxHp - hp);
  return { big: missing >= 1 ? `−${fmt(missing)}` : '', percent };
}

/**
 * A hero's alarm level on their frame: the shared ramp, or their own bands (Brann, docs/phase-5b.md:
 * no hurt tier, critical below 15%, when falling fast or with a lethal hit coming).
 */
export function frameLevel(
  h: Pick<HeroHud, 'hp' | 'maxHp' | 'defId' | 'blood' | 'lethal'>,
): HealthLevel {
  return healthLevel(h.hp, h.maxHp, h.defId, h.blood ? h.blood.fast || h.lethal : undefined);
}

/** What the whole frame says: critical (under a quarter), an ailment to cleanse, out of reach. */
export function frameState(
  h: HeroHud,
  blind = false,
): { critical: boolean; ailing: boolean; far: boolean } {
  const standing = !h.dead && !h.downed;
  return {
    critical: standing && frameLevel(h) === 2,
    // Blind Score (Phase 4d) names no answer: no cleanse highlight under it.
    ailing: standing && !blind && h.statuses.some((s) => isAilment(s.id)),
    far: !h.dead && h.distance > CONTENT.techniques.ward.range,
  };
}
