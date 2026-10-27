/**
 * The Calling in the fight (Phase 3c, 3d, 3e): the HUD chip's state, each hero's Radiance, the
 * Martyr's Life marks and the Chronomancer's Stasis and Temporal Mastery, derived from
 * `WorldState.calling`, the Weaver and each hero's `inField` / `auraMask`. A hero shines at
 * `radiancePerAura × auras heard` (× `sunriseMult` in Sunrise) while standing in the field.
 */
import { CONTENT, callingDef, callingOption, optionTier } from '../../content';
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
  /** The Calling's Crescendo: Sunrise, the Martyr's Vow or Stasis (content `crescendoName`). */
  crescendo: 'sunrise' | 'vow' | 'stasis';
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
  /** Phase 3e: Stasis is up (the Chronomancer's Crescendo): every enemy waits. */
  stasis: boolean;
  /**
   * Temporal Mastery on the path: ready, or back in `remaining` of its `total` seconds (null:
   * not on the path).
   */
  mastery: { ready: boolean; remaining: number; total: number } | null;
  /** The Chronomancer's Rewind can still stand a hero back up this run (null: no Rewind). */
  revive: 'ready' | 'spent' | null;
}

/** What the view needs from `WorldState.calling` (plain data). */
export interface CallingSource {
  id: string;
  path: readonly string[];
  radiancePerAura: number;
  sunriseMult: number;
  sovereign: boolean;
  /** Phase 3d: the Crescendo and Bear (`CallingState.crescendo`, `bearShare`). */
  crescendo?: 'sunrise' | 'vow' | 'stasis';
  bearShare?: number;
  /** Phase 3e: Rewind replaces Reel; Foresight's reach (`CallingState.rewind`, `foresight`). */
  rewind?: boolean;
  foresight?: number;
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

/** The Weaver's side of the Chronomancer, for the chip (all off without him). */
export interface ChronoState {
  /** `FieldState.stasis`. */
  stasis: boolean;
  /** Seconds until Temporal Mastery can reset a cooldown again (`masteryAt − time`; 0: ready). */
  masteryIn: number;
  /** Rewind's once-a-run revive: still to come, or spent (`rewindCanRevive`); null: no Rewind. */
  revive: 'ready' | 'spent' | null;
}

const NO_CHRONO: ChronoState = { stasis: false, masteryIn: 0, revive: null };

/** Temporal Mastery's own cooldown (content), or null when it isn't on the path. */
export function masteryCooldown(path: readonly (string | null)[]): number | null {
  const id = path.find((p) => p === 'temporal_mastery');
  return id ? (callingOption(id).values.cooldown ?? 0) : null;
}

/**
 * The share of a technique's Spirit cost paid during Stasis (content `cost`, the discount in %,
 * as the sim's `stasisCostMult` reads it); 1 for a Calling without Stasis.
 */
export function stasisCostMult(callingId: string | null | undefined): number {
  const def = callingId ? CONTENT.callings.find((c) => c.id === callingId) : undefined;
  if (!def || (def.values.stasis ?? 0) <= 0) return 1;
  return 1 - (def.values.cost ?? 0) / 100;
}

/** How long Stasis lasts on this path: content `stasis`, plus Eternal Moment's `seconds`. */
export function stasisSeconds(
  callingId: string | null | undefined,
  path: readonly (string | null)[],
): number {
  const def = callingId ? CONTENT.callings.find((c) => c.id === callingId) : undefined;
  const base = def?.values.stasis ?? 0;
  if (base <= 0) return 0;
  const eternal = path.includes('eternal_moment')
    ? (callingOption('eternal_moment').values.seconds ?? 0)
    : 0;
  return base + eternal;
}

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
  chrono: ChronoState = NO_CHRONO,
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
    // Sunrise is the Weaver's own; the Vow and Stasis are the Calling's (content `crescendoName`).
    crescendoName: crescendoName((calling.crescendo ?? 'sunrise') !== 'sunrise' ? def : null),
    vow: martyr.vow,
    bearing: martyr.bearing && (calling.bearShare ?? 0) > 0,
    bearShare: calling.bearShare ?? 0,
    undying: calling.path.includes('undying_devotion')
      ? martyr.undyingReady
        ? 'ready'
        : 'spent'
      : null,
    lowLife: martyr.marks.map((m) => ({ id: m.id, name: m.name, icon: m.icon, active: m.active })),
    stasis: chrono.stasis,
    mastery: masteryOf(calling.path, chrono.masteryIn),
    revive: chrono.revive,
  };
}

function masteryOf(path: readonly string[], masteryIn: number): CallingHud['mastery'] {
  const total = masteryCooldown(path);
  if (total === null) return null;
  const remaining = Math.max(0, Math.min(total, masteryIn));
  return { ready: remaining <= 0.05, remaining, total };
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
    c.stasis
      ? `${c.crescendoName}: every enemy waits, and your techniques have no cooldowns and cost less.`
      : '',
    c.mastery
      ? c.mastery.ready
        ? 'Temporal Mastery: ready, your next Glide brings back your last technique.'
        : `Temporal Mastery: back in ${Math.ceil(c.mastery.remaining)} s.`
      : '',
    c.revive === 'ready' ? 'Rewind can stand a fallen hero back up, once this run.' : '',
    c.revive === 'spent' ? 'Rewind has stood a hero back up this run: its revive is spent.' : '',
  ]
    .filter(Boolean)
    .join(' ');
}
