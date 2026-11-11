/**
 * Movement III's HUD looks as plain data (docs/phase-5c.md "UI"): Doom's count, the rune lock on
 * the Weaver bar, a cut Thread's words and the boss bar's conditions. Testable without React.
 * Every helper answers as before (no condition, no lock, no words) when its key is absent, so a
 * Movement I or II HUD draws exactly as it did.
 */
import { CONTENT } from '../../content';
import { DOOM_CHIME_AT, EMBOLDENED_MULT } from '../../content/unstitched';
import type { IconName } from '../kit/iconPaths';
import type { BossHud } from '../store';
import type { ThreadCutCause } from '../../sim';
import { t } from '../text';

/** Doom's ignition count: the Doom-touched payload's `burst.at` (its `maxStacks`), from content. */
export function doomMax(): number {
  for (const f of CONTENT.affixes) {
    const hit = f.onHit;
    if (hit?.id === 'doom') return hit.burst?.at ?? hit.maxStacks ?? 5;
  }
  return 5;
}

/** From this many Doom stacks the badge glows and asks for the Chime (the bots' rule too). */
export const DOOM_EMPHASIS = DOOM_CHIME_AT;

/** "×3/5": Doom's count against its ignition. */
export function doomCount(stacks: number): string {
  return `×${stacks}/${doomMax()}`;
}

/** How much harder an Emboldened enemy hits, as a whole percent (25). */
export const EMBOLDENED_PCT = Math.round((EMBOLDENED_MULT - 1) * 100);

/** What cut the Thread, as the chip says it: "Shears", "Severing", "Snip", "Unpick". */
export const CUT_CAUSE_NAME: Readonly<Record<ThreadCutCause, string>> = {
  get shears() {
    return t('hud.riftLook.shears');
  },
  get severing() {
    return t('hud.riftLook.severing');
  },
  get snip() {
    return t('hud.riftLook.snip');
  },
  get unpick() {
    return t('hud.riftLook.unpick');
  },
};

/** "Cut · 3.0 s (Snip)": the Thread chip after an enemy cut, while its lock runs. */
export function cutPlate(cause: ThreadCutCause, lock: number): string {
  return t('hud.riftLook.cutS', { lock: lock.toFixed(1), value: CUT_CAUSE_NAME[cause] });
}

/** "Unravelled · 5 s": the Thread chip while Unravel turns Mend. */
export function unravelPlate(left: number): string {
  return t('hud.riftLook.unravelledS', { max: Math.max(0, Math.ceil(left)) });
}

/** A condition under the boss bar: its glyph and words (never colour alone). */
export interface BossCondition {
  id: 'bloodmoon' | 'spindles' | 'stolen' | 'unravel' | 'mirrorWard' | 'champion' | 'stitched';
  icon: IconName;
  /** The badge's word, upper case on screen. */
  label: string;
  /** What it means, and the answer. */
  text: string;
  /** Its colour (with the glyph and words). */
  color: string;
  /** The Hollow Champion's life, for a mini bar (0..1). */
  bar?: number;
}

/** The Spindles' damage cut on the boss, as a whole percent (their `tether.dr`), from content. */
export function spindleCutPct(): number {
  const dr = CONTENT.enemies.find((e) => e.tether)?.tether?.dr ?? 0.8;
  return Math.round(dr * 100);
}

/** The Bloodmoon's healing cut outside the pools (its badge's words). */
const BLOODMOON_TEXT = (): string => t('hud.riftLook.healing50OutsideThe');

/**
 * The boss's conditions, in the order they're drawn: Movement II's Bloodmoon as before, then
 * Movement III's from the optional BossHud keys. Empty when none is set (every Movement I boss).
 */
export function bossConditions(boss: BossHud): BossCondition[] {
  const out: BossCondition[] = [];
  if (boss.bloodmoon)
    out.push({
      id: 'bloodmoon',
      icon: 'moon',
      label: t('hud.riftLook.bloodmoon'),
      text: BLOODMOON_TEXT(),
      color: '#fca5a5',
    });
  if (boss.spindles !== undefined && boss.spindles > 0)
    out.push({
      id: 'spindles',
      icon: 'spindle',
      label: t('hud.riftLook.spindles', { spindles: boss.spindles }),
      text: t('hud.riftLook.damageToTheBoss', { spindleCutPct: spindleCutPct() }),
      color: '#c7d2fe',
    });
  if (boss.stolen)
    out.push({
      id: 'stolen',
      icon: 'note',
      label: t('hud.riftLook.stolen'),
      text: t('hud.riftLook.isMutedFocusThe', { name: boss.stolen.name }),
      color: '#e9d5ff',
    });
  if (boss.unravelLeft !== undefined && boss.unravelLeft > 0)
    out.push({
      id: 'unravel',
      icon: 'empower',
      label: t('hud.riftLook.unravel'),
      text: t('hud.riftLook.yourMendWoundsEmpower', { unravelLeft: Math.ceil(boss.unravelLeft) }),
      color: '#fda4af',
    });
  if (boss.mirrorWard)
    out.push({
      id: 'mirrorWard',
      icon: 'mirror',
      label: t('hud.riftLook.mirrorWard'),
      text: boss.mirrorWard.casting
        ? t('hud.riftLook.castingOnItsChampion')
        : t('hud.riftLook.upOnItsChampion', { upLeft: Math.ceil(boss.mirrorWard.upLeft) }),
      color: '#cbd5e1',
    });
  if (boss.champion)
    out.push({
      id: 'champion',
      icon: 'mirror',
      label: t('hud.riftLook.hollowChampion'),
      text: t('hud.riftLook.harderWhileTheUnweaver', { EMBOLDENED_PCT }),
      color: '#cbd5e1',
      bar:
        boss.champion.maxHp > 0
          ? Math.max(0, Math.min(1, boss.champion.hp / boss.champion.maxHp))
          : 0,
    });
  if (boss.stitched !== undefined && boss.stitched > 0)
    out.push({
      id: 'stitched',
      icon: 'needle',
      label:
        boss.stitched > 1
          ? t('hud.riftLook.stitched', { stitched: boss.stitched })
          : t('hud.riftLook.stitched2'),
      text: t('hud.riftLook.rootedHeroesChimeEach'),
      color: '#c4b5fd',
    });
  return out;
}
