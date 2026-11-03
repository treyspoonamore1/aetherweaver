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

/** The ember of Brann's raging band: warm, never the lethal red or the threat orange. */
export const RAGING_COLOR = '#c2410c';
/** His Bloodletting, a drain he chose (never a hit to heal): his own crimson. */
export const BLOODLET_COLOR = '#b91c1c';

/** In the raging band (40% down to 15%), standing: his designed band, not a danger. */
export function frameRaging(h: Pick<HeroHud, 'hp' | 'maxHp' | 'defId' | 'blood'>): boolean {
  return !!h.blood && !h.blood.fast && raging(h.hp, h.maxHp, h.defId);
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

/**
 * The lines on his bar: Bloodlust's 40% and the critical 15% always; 30% with Berserker's Hymn
 * (where it turns on); 10% with Deathless (where it catches him). None for a hero without blood.
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
      title: `${Math.round(below * 100)}%: Bloodlust — below it he won’t Rally, and Blood Rage runs hot`,
    });
  if (h.talents.includes('berserkers_hymn')) {
    const at = (talentValue('berserkers_hymn', 'below') ?? 30) / 100;
    ticks.push({
      at,
      title: `${Math.round(at * 100)}%: Berserker’s Hymn — every hero hits harder`,
    });
  }
  ticks.push({
    at: bands.critical,
    title: `${Math.round(bands.critical * 100)}%: critical — Ward him now`,
  });
  if (h.talents.includes('deathless')) {
    const at = (talentValue('deathless', 'pct') ?? 10) / 100;
    ticks.push({ at, title: `${Math.round(at * 100)}%: Deathless — once a fight, he can’t die` });
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
      label: 'Deathless',
      title: `Deathless: ${h.name} can’t drop below 1 life while it lasts`,
    });
  if (b.bloodlust)
    out.push({
      id: 'bloodlust',
      label: 'Bloodlust · no Rally',
      title: `Bloodlust: ${h.name} won’t come back for a Rally. Ward him (Iron Will) or Reel him`,
    });
  if (b.rage >= 0.005)
    out.push({
      id: 'rage',
      label: rageLabel(b.rage),
      title: `Blood Rage: ${h.name} hits ${rageLabel(b.rage)} harder, the lower his life`,
    });
  if (b.bled > 0)
    out.push({
      id: 'bloodlet',
      label: `Bloodlet ×${b.bled}`,
      title: `Bloodletting: his next ${b.bled === 1 ? 'swing hits' : `${b.bled} swings hit`} harder, all round him. The life he spent isn’t damage`,
    });
  if (b.oath >= 1)
    out.push({
      id: 'oath',
      label: `Oath +${Math.round(b.oath)}`,
      title: `Blood Oath: your overheal rides on his next swing (+${Math.round(b.oath)})`,
    });
  if (b.tithe)
    out.push({
      id: 'tithe',
      label: 'Tithe',
      title: 'Blood Tithe: your Ward on him is stronger, and gives back Spirit when it breaks',
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
