/**
 * The Calling in the fight (Phase 3c, 3d): the HUD chip's state, each hero's Radiance and the
 * Martyr's Life marks, derived from `WorldState.calling`, the Weaver and each hero's `inField`
 * / `auraMask`. A hero shines at `radiancePerAura × auras heard` (× `sunriseMult` in Sunrise)
 * while standing in the field.
 */
import { callingDef, callingOption, optionTier } from '../../content';
import { crescendoName, lowLifeMarks } from '../screens/callingText';
import type { LifeMarkHud } from '../store';

/** The run's Calling as the HUD shows it. */
export interface CallingHud {
  id: string;
  name: string;
  icon: string;
  /** Every tier, in order: the option taken (null while open). */
  tiers: ({ id: string; name: string; icon: string } | null)[];
  /** Sunrise (the Crescendo) is lit right now: Radiance ×`sunriseMult`. */
  sunrise: boolean;
  /** Sovereign Symphony is in force (on the path, with enough auras across the songs). */
  sovereign: boolean;
  /** Haloed is on the path: heroes in the field take less from ordinary hits. */
  haloed: boolean;
  radiancePerAura: number;
  sunriseMult: number;
  /** The Calling's Crescendo: Sunrise, or the Martyr's Vow (content `crescendoName`). */
  crescendo: 'sunrise' | 'vow';
  crescendoName: string;
  /** Martyr's Vow is up: heroes can't drop below 1 life. */
  vow: boolean;
  /** The Weaver Bears for her threaded hero right now. */
  bearing: boolean;
  /** Bear's share of the threaded hero's wounds (0 without the Martyr). */
  bearShare: number;
  /** Undying Devotion on the path: still to come this fight, or spent (null: not on the path). */
  undying: 'ready' | 'spent' | null;
  /** Blood Font and Low-Life Vigil: working right now (below their share of her Life). */
  lowLife: { id: string; name: string; icon: string; active: boolean }[];
}

/** What the view needs from `WorldState.calling` (plain data). */
export interface CallingSource {
  id: string;
  path: readonly string[];
  radiancePerAura: number;
  sunriseMult: number;
  sovereign: boolean;
  /** Phase 3d: the Crescendo and Bear (`CallingState.crescendo`, `bearShare`). */
  crescendo?: 'sunrise' | 'vow';
  bearShare?: number;
}

/** The Weaver's side of the Martyr, for the chip (all off without her). */
export interface MartyrState {
  vow: boolean;
  bearing: boolean;
  /** `WeaverComponent.undying`: Undying Devotion is still unused this fight. */
  undyingReady: boolean;
  marks: readonly LifeMarkHud[];
}

const NO_MARTYR: MartyrState = { vow: false, bearing: false, undyingReady: false, marks: [] };

/**
 * The Life marks the path draws on the Weaver bar: each option's `below` share of all her Life
 * (`lifeTotal`, reserved included, as the sim counts it), lit while her life is under it.
 */
export function lifeMarksOf(
  path: readonly (string | null)[],
  life: number,
  lifeTotal: number,
): LifeMarkHud[] {
  return lowLifeMarks(path).map((m) => ({
    id: m.id,
    name: m.name,
    icon: m.icon,
    at: m.below * lifeTotal,
    active: life < m.below * lifeTotal,
  }));
}

/** Number of bits set (auras a hero hears, from `auraMask`). */
export function popcount(mask: number): number {
  let n = 0;
  let m = mask >>> 0;
  while (m) {
    m &= m - 1;
    n++;
  }
  return n;
}

/**
 * How brightly a hero shines (0.08 = +8%): Radiance per aura × the auras they hear, ×
 * Sunrise's multiplier while it lasts; 0 outside the field or without a Calling.
 */
export function shineOf(
  hero: { inField: boolean; auraMask: number },
  calling: Pick<CallingSource, 'radiancePerAura' | 'sunriseMult'> | null,
  sunrise: boolean,
): number {
  if (!calling || !hero.inField || calling.radiancePerAura <= 0) return 0;
  const auras = popcount(hero.auraMask);
  return calling.radiancePerAura * auras * (sunrise ? calling.sunriseMult : 1);
}

/** "+8%", "+24%" (whole percent; one decimal below 1%). */
export function shineLabel(shine: number): string {
  const v = shine * 100;
  return `+${v >= 1 ? Math.round(v) : Number(v.toFixed(1))}%`;
}

/** The HUD chip's state from the world's Calling (null without one). */
export function callingHud(
  calling: CallingSource | null,
  sunrise: boolean,
  martyr: MartyrState = NO_MARTYR,
): CallingHud | null {
  if (!calling) return null;
  const def = callingDef(calling.id);
  const tiers: CallingHud['tiers'] = def.tiers.map(() => null);
  for (const id of calling.path) {
    const { tier } = optionTier(id);
    const o = callingOption(id);
    tiers[tier] = { id, name: o.name, icon: o.icon };
  }
  return {
    id: def.id,
    name: def.name,
    icon: def.icon,
    tiers,
    sunrise,
    sovereign: calling.sovereign,
    haloed: calling.path.includes('haloed'),
    radiancePerAura: calling.radiancePerAura,
    sunriseMult: calling.sunriseMult,
    crescendo: calling.crescendo ?? 'sunrise',
    crescendoName: crescendoName(calling.crescendo === 'vow' ? def : null),
    vow: martyr.vow,
    bearing: martyr.bearing && (calling.bearShare ?? 0) > 0,
    bearShare: calling.bearShare ?? 0,
    undying: calling.path.includes('undying_devotion')
      ? martyr.undyingReady
        ? 'ready'
        : 'spent'
      : null,
    lowLife: martyr.marks.map((m) => ({ id: m.id, name: m.name, icon: m.icon, active: m.active })),
  };
}

/** "Borne · 35%": what Bear takes of a hero's wounds. */
export function bearLabel(share: number): string {
  return `${Math.round(share * 100)}%`;
}

/** The chip's accessible sentence. */
export function callingHudLabel(c: CallingHud): string {
  const taken = c.tiers.flatMap((t) => (t ? [t.name] : []));
  return [
    `The ${c.name}${taken.length ? `: ${taken.join(', ')}` : ''}.`,
    c.sunrise ? `Sunrise: Radiance ×${c.sunriseMult}.` : '',
    c.haloed ? 'Haloed: heroes in your field take less from ordinary hits.' : '',
    c.sovereign ? 'Sovereign Symphony: every aura is stronger.' : '',
    c.vow ? `${c.crescendoName}: your heroes can’t drop below 1 life.` : '',
    c.bearing ? `Bearing: you take ${bearLabel(c.bearShare)} of your threaded hero’s wounds.` : '',
    c.undying === 'ready' ? 'Undying Devotion: ready.' : '',
    c.undying === 'spent' ? 'Undying Devotion: spent this fight.' : '',
    ...c.lowLife.filter((m) => m.active).map((m) => `${m.name}: on.`),
  ]
    .filter(Boolean)
    .join(' ');
}
