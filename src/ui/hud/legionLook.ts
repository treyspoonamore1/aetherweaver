/**
 * Movement II's HUD looks as plain data (docs/phase-5a.md): stack emphasis, the healing cut's
 * words, the boss bar's phase ticks and cast glyphs. Testable without React.
 */
import { CONTENT } from '../../content';
import type { IconName } from '../kit/iconPaths';
import type { BossHud, StatusHud } from '../store';

/**
 * Stacks from which a stacking status asks for its answer (Chime the bleeding at 5 stacks or
 * more). The badge glows and shows the Chime glyph from here.
 */
export const STACKS_EMPHASIS = 5;

/** A stacking status's emphasis: its count is high enough that it wants its answer now. */
export function stacksUrgent(status: Pick<StatusHud, 'stacks'>): boolean {
  return (status.stacks ?? 0) >= STACKS_EMPHASIS;
}

/** "healing received halved" (×0.5), "quartered" (×0.25), else the share. */
export function healCutTitle(cut: number): string {
  if (Math.abs(cut - 0.5) < 1e-6) return 'healing received halved';
  if (Math.abs(cut - 0.25) < 1e-6) return 'healing received quartered';
  return `healing received ×${Math.round(cut * 100) / 100}`;
}

/** Execution's line, from content (`executeBelow`), as a whole percent. */
export const EXECUTE_PCT = Math.round(
  (CONTENT.attacks.find((a) => a.executeBelow !== undefined)?.executeBelow ?? 0.4) * 100,
);

/** Each boss's cast glyph (the Movement I bosses keep their bell). */
const CAST_ICON: Readonly<Record<string, IconName>> = {
  gorehound_matriarch: 'paw',
  vharun_crimson_warden: 'crown',
};

export function bossCastIcon(defId: string | undefined): IconName {
  return (defId && CAST_ICON[defId]) || 'bell';
}

/**
 * The boss bar's phase ticks, in percent: the sim's thresholds (`phaseAt`), or an even split for
 * a snapshot without them.
 */
export function phaseTicks(boss: Pick<BossHud, 'phases' | 'phaseAt'>): number[] {
  if (boss.phaseAt) return boss.phaseAt.map((at) => at * 100);
  return Array.from(
    { length: Math.max(0, boss.phases - 1) },
    (_, i) => ((boss.phases - 1 - i) / boss.phases) * 100,
  );
}
