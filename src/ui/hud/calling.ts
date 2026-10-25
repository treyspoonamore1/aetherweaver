/**
 * The Calling in the fight (Phase 3c): the HUD chip's state and each hero's Radiance, derived
 * from `WorldState.calling` and each hero's `inField` / `auraMask`. A hero shines at
 * `radiancePerAura × auras heard` (× `sunriseMult` in Sunrise) while standing in the field.
 */
import { callingDef, callingOption, optionTier } from '../../content';

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
}

/** What the view needs from `WorldState.calling` (plain data). */
export interface CallingSource {
  id: string;
  path: readonly string[];
  radiancePerAura: number;
  sunriseMult: number;
  sovereign: boolean;
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
export function callingHud(calling: CallingSource | null, sunrise: boolean): CallingHud | null {
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
  };
}

/** The chip's accessible sentence. */
export function callingHudLabel(c: CallingHud): string {
  const taken = c.tiers.flatMap((t) => (t ? [t.name] : []));
  return [
    `The ${c.name}${taken.length ? `: ${taken.join(', ')}` : ''}.`,
    c.sunrise ? `Sunrise: Radiance ×${c.sunriseMult}.` : '',
    c.haloed ? 'Haloed: heroes in your field take less from ordinary hits.' : '',
    c.sovereign ? 'Sovereign Symphony: every aura is stronger.' : '',
  ]
    .filter(Boolean)
    .join(' ');
}
