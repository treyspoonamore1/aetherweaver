/**
 * Brann on the HUD (docs/phase-5b.md, "Frames"), as plain data so it is testable without React:
 * his alarm (no hurt tier; critical below 15%, falling fast or a lethal hit coming), the raging
 * band and its ticks, the chips his frame shows (Blood Rage, Bloodlust, Bloodletting, Deathless,
 * Blood Oath, Blood Tithe) and the Call prompt that names its hero. Everything here keys on
 * `HeroHud.blood` (present only for a hero with Blood Rage) or on `defId`, so the default heroes'
 * frames are exactly as they were.
 */
import { healthBands, raging } from '../../app/healthLevels';
import { CONTENT } from '../../content';
import type { HeroHud } from '../store';
import { t as txt } from '../text';

/** The ember of Brann's raging band: warm, never the lethal red or the threat orange. */
export const RAGING_COLOR = '#c2410c';
/** His Bloodletting, a drain he chose (never a hit to heal): his own crimson. */
export const BLOODLET_COLOR = '#b91c1c';
/** How long the frame's Bloodletting drain shows, in seconds (as over his head: `DRAIN_HOLD`). */
export const BLOODLET_DRAIN_S = 0.9;

/**
 * How a frame reads a change of life (docs/phase-5b.md, "a drop the player didn't cause must not
 * read as damage"): `bled`, the life Bloodletting spent since the last look (`blood.spent` grew),
 * drawn as its own crimson drain; `hit`, whether the drop is more than that, so the white hit
 * trail holds. Without `spent` (every default hero) a drop is a hit, as it always was.
 */
export function lifeDrop(
  prevHp: number,
  hp: number,
  prevSpent: number,
  spent: number,
): { hit: boolean; bled: number } {
  const bled = spent > prevSpent + 0.5 ? spent - prevSpent : 0;
  return { hit: hp < prevHp - bled - 0.5, bled };
}

/**
 * In the raging band (40% down to 15%), standing: his designed band, not a danger. Falling fast
 * or with a lethal hit coming he is critical instead (`frameLevel`), as over his head.
 */
export function frameRaging(
  h: Pick<HeroHud, 'hp' | 'maxHp' | 'defId' | 'blood' | 'lethal'>,
): boolean {
  return !!h.blood && !h.blood.fast && !h.lethal && raging(h.hp, h.maxHp, h.defId);
}

/** The raging band's span on the bar, as shares of max life (null without one). */
export function ragingBand(defId: string): { top: number; bottom: number } | null {
  const b = healthBands(defId);
  return b.raging === undefined ? null : { top: b.raging, bottom: b.critical };
}

export interface BloodTick {
  /** A share of max life. */
  at: number;
  /** What the line means, for its tooltip. */
  title: string;
}

function talentValue(id: string, key: string): number | undefined {
  return CONTENT.talents.find((t) => t.id === id)?.values[key];
}

/** Blood and Silk's line (its motif text: below 30%), as over his head (`SILK_BELOW`). */
const SILK_BELOW = 0.3;

/**
 * The lines on his bar: Bloodlust's 40% and the critical 15% always; 30% with Berserker's Hymn
 * (where it turns on) or Blood and Silk (where it pays), one line for both, as over his head; 10%
 * with Deathless (where it catches him). None for a hero without blood.
 */
export function bloodTicks(h: Pick<HeroHud, 'defId' | 'talents' | 'blood'>): BloodTick[] {
  if (!h.blood) return [];
  const def = CONTENT.heroes.find((x) => x.id === h.defId);
  const bands = healthBands(h.defId);
  const ticks: BloodTick[] = [];
  const below = def?.quirk.below ?? bands.raging;
  if (below !== undefined)
    ticks.push({
      at: below,
      title: txt('hud.bloodLook.bloodlustBelowItHe', { round: Math.round(below * 100) }),
    });
  const hymn = h.talents.includes('berserkers_hymn')
    ? (talentValue('berserkers_hymn', 'below') ?? 30) / 100
    : 0;
  const silk = h.blood.silk ? SILK_BELOW : 0;
  if (hymn > 0 || silk > 0) {
    const at = Math.max(hymn, silk);
    const says = [
      ...(hymn === at ? [txt('hud.bloodLook.berserkerSHymnEvery')] : []),
      ...(silk === at ? [txt('hud.bloodLook.bloodAndSilkEmpower')] : []),
    ];
    ticks.push({ at, title: `${Math.round(at * 100)}%: ${says.join('; ')}` });
  }
  ticks.push({
    at: bands.critical,
    title: txt('hud.bloodLook.criticalWardHimNow', { round: Math.round(bands.critical * 100) }),
  });
  if (h.talents.includes('deathless')) {
    const at = (talentValue('deathless', 'pct') ?? 10) / 100;
    ticks.push({
      at,
      title: txt('hud.bloodLook.deathlessOnceAFight', { round: Math.round(at * 100) }),
    });
  }
  return ticks.sort((a, b) => b.at - a.at);
}

/** "+62%": Blood Rage's damage bonus as a whole percent. */
export function rageLabel(rage: number): string {
  return `+${Math.round(Math.max(0, rage) * 100)}%`;
}

export type BloodChipId = 'rage' | 'bloodlust' | 'bloodlet' | 'deathless' | 'oath' | 'tithe';

export interface BloodChip {
  id: BloodChipId;
  label: string;
  /** The tooltip and accessible sentence. */
  title: string;
}

/**
 * His frame's chips, most urgent first: Deathless, Bloodlust (he won't Rally), the rage %, the
 * Bloodletting swings left, Blood Oath's bank, a Blood Tithe Ward. Empty for a hero without blood.
 */
export function bloodChips(h: Pick<HeroHud, 'name' | 'blood' | 'dead' | 'downed'>): BloodChip[] {
  const b = h.blood;
  if (!b || h.dead || h.downed) return [];
  const out: BloodChip[] = [];
  if (b.deathless)
    out.push({
      id: 'deathless',
      label: txt('hud.bloodLook.deathless'),
      title: txt('hud.bloodLook.deathlessCanTDrop', { name: h.name }),
    });
  if (b.bloodlust)
    out.push({
      id: 'bloodlust',
      label: txt('hud.bloodLook.bloodlustNoRally'),
      title: txt('hud.bloodLook.bloodlustWonTCome', { name: h.name }),
    });
  if (b.rage >= 0.005)
    out.push({
      id: 'rage',
      label: rageLabel(b.rage),
      title: txt('hud.bloodLook.bloodRageHitsHarder', {
        name: h.name,
        rageLabel: rageLabel(b.rage),
      }),
    });
  if (b.bled > 0)
    out.push({
      id: 'bloodlet',
      label: txt('hud.bloodLook.bloodlet', { bled: b.bled }),
      title: txt('hud.bloodLook.bloodlettingHisNextHarder', {
        value:
          b.bled === 1
            ? txt('hud.bloodLook.swingHits')
            : txt('hud.bloodLook.swingsHit', { bled: b.bled }),
      }),
    });
  if (b.oath >= 1)
    out.push({
      id: 'oath',
      label: txt('hud.bloodLook.oath', { oath: Math.round(b.oath) }),
      title: txt('hud.bloodLook.bloodOathYourOverheal', { oath: Math.round(b.oath) }),
    });
  if (b.tithe)
    out.push({
      id: 'tithe',
      label: txt('hud.bloodLook.tithe'),
      title: txt('hud.bloodLook.bloodTitheYourWard'),
    });
  return out;
}

/**
 * Does a hero's Call prompt carry their name? A hero outside the default party always does (so
 * Brann's Ward call can't be mistaken for Kael's), and so does any hero whose answer another
 * party hero also asks for. The default party's calls are all different, so it shows none.
 */
export function callNamed(
  h: Pick<HeroHud, 'id' | 'defId' | 'call'>,
  party: readonly Pick<HeroHud, 'id' | 'defId'>[],
): boolean {
  if (!h.call) return false;
  if (!CONTENT.defaultParty.includes(h.defId)) return true;
  const answer = CONTENT.heroes.find((x) => x.id === h.defId)?.call.answer;
  return party.some(
    (o) => o.id !== h.id && CONTENT.heroes.find((x) => x.id === o.defId)?.call.answer === answer,
  );
}
