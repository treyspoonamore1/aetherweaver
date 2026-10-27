/**
 * The Martyr as render sees it (docs/phase-3d/vfx.md). Pure helpers, no three.js, so the look
 * flags, the thresholds and the pulse scale are testable in Node against the real sim.
 *
 * Everything is read from `WorldState.calling` (`id: 'martyr'`, `path`, `bearShare`), the
 * Weaver's `threadMode` / `maxLife` / `undying`, `field.vow` and the `borne` / `undying` events.
 * Thresholds come from content (`callingValue`), so the lead's tuning shows up without render
 * changes.
 */
import type { ReadonlyEntity, WorldState } from '../sim';
import { callingValue } from './callingCues';

/** The Martyr's id, as `WorldState.calling.id`. */
export const MARTYR = 'martyr';

/**
 * The Martyr's colours: crimson and old gold, sacrificial, never gory. Identity colours, not
 * semantic (barriers keep `C.shield`, heals `C.heal`). `blood` is the Bear Thread and stays
 * ΔE ≥ 20 from Mend, Empower and lethal under every palette's simulated vision (tested); the
 * others are ≥ 20 from lethal and ≥ 15 from threat.
 */
export const MARTYR_HEX = {
  /** Bear: the Thread's third mode, a deep crimson. */
  blood: '#a3123a',
  /** A borne pulse's head, the flinch: a warm rose (lighter, so additive layers show it). */
  bloodHot: '#ff8a7a',
  /** The pale core of a pulse and the seal's heart. */
  rose: '#ffd0c4',
  /** Old gold: the Vow's seals, Martyr's Aegis, Undying Devotion. */
  oldGold: '#c9a45c',
  /** Pale old gold for highlights (the seal ring, Undying's star). */
  paleGold: '#ead9b0',
  /** Scarred Hide: a dull bronze rim. */
  scar: '#b07a4f',
} as const;

/** How long a borne pulse takes to run from the hero to the Weaver (s). */
export const BORNE_TRAVEL = 0.26;
/** A hero's Bear pulses: at most one per this long (extra amounts ride the last one). */
export const BEAR_GAP = 0.1;
/** Shared Wounds' faint pulses, per hero. */
export const SHARED_GAP = 0.35;
/** The Vow holding a hit, per hero (the seal flash and overflow). */
export const VOW_GAP = 0.15;
/** The Weaver's flinch at most this often (it reads as one flinch per blow, not a strobe). */
export const FLINCH_GAP = 0.12;

/**
 * A borne amount as a pulse strength, 0.25..1.4: a square root of the share of the Weaver's
 * usable Life it costs her (12% of it is 1), so small hits still show and big ones swell.
 */
export function borneScale(amount: number, maxHp: number): number {
  if (!(amount > 0)) return 0;
  const frac = amount / Math.max(1, maxHp);
  return Math.max(0.25, Math.min(1.4, Math.sqrt(frac / 0.12)));
}

/** What the Martyr adds to the fight this frame. Reused (no allocation per frame). */
export interface MartyrLook {
  /** The Martyr is the Calling. */
  martyr: boolean;
  /** Bearing: the Thread in Bear on a hero, the Weaver up (the sim's `bearShareOf` rule). */
  bearing: boolean;
  /** Martyr's Vow is up (`field.vow`). Never Sunrise: `field.crescendo` stays false. */
  vow: boolean;
  penitence: boolean;
  scarredHide: boolean;
  bloodFont: boolean;
  sharedWounds: boolean;
  undying: boolean;
  vigil: boolean;
  aegis: boolean;
  covenant: boolean;
  /** Her Life now, out of all of it (reserved included): `hp / maxLife`. */
  life: number;
  /** Low-Life Vigil in force: on the path and below its share of her Life. */
  vigilOn: boolean;
  /** Blood Font in force: on the path and below its share of her Life. */
  fontOn: boolean;
  /** Blood Font is actually healing her (in force and below her usable Life). */
  fontRegen: boolean;
  /** Undying Devotion still unused this fight. */
  undyingReady: boolean;
  /** The Weaver is untouchable after Undying Devotion held. */
  undyingGrace: boolean;
}

export function emptyMartyrLook(): MartyrLook {
  return {
    martyr: false,
    bearing: false,
    vow: false,
    penitence: false,
    scarredHide: false,
    bloodFont: false,
    sharedWounds: false,
    undying: false,
    vigil: false,
    aegis: false,
    covenant: false,
    life: 1,
    vigilOn: false,
    fontOn: false,
    fontRegen: false,
    undyingReady: false,
    undyingGrace: false,
  };
}

function has(path: readonly string[], id: string): boolean {
  for (let i = 0; i < path.length; i++) if (path[i] === id) return true;
  return false;
}

/** Low-Life Vigil's threshold, a share of all her Life (content: `below`, 35). */
export function vigilBelow(): number {
  return callingValue('low_life_vigil', 'below', 35) / 100;
}

/** Blood Font's threshold, a share of all her Life (content: `below`, 50). */
export function fontBelow(): number {
  return callingValue('blood_font', 'below', 50) / 100;
}

/** The Martyr is the Calling. */
export function isMartyr(state: WorldState): boolean {
  return state.calling?.id === MARTYR;
}

/**
 * Which Crescendo a `crescendoStart` / `crescendoEnd` is: the Martyr's Vow, the Chronomancer's
 * Stasis or Sunrise. The Vow and Stasis never play Sunrise's gold (feedback.ts asks this).
 */
export function crescendoKind(state: WorldState): 'sunrise' | 'vow' | 'stasis' {
  const c = state.calling?.crescendo;
  return c === 'vow' ? 'vow' : c === 'stasis' ? 'stasis' : 'sunrise';
}

/** Fills `out` from the state. */
export function martyrLook(state: WorldState, out: MartyrLook): MartyrLook {
  const c = state.calling;
  const m = !!c && c.id === MARTYR;
  const path = m ? c.path : [];
  const e = state.entities.get(state.weaverId);
  const w = e?.weaver;
  const h = e?.health;
  out.martyr = m;
  out.penitence = m && has(path, 'penitence');
  out.scarredHide = m && has(path, 'scarred_hide');
  out.bloodFont = m && has(path, 'blood_font');
  out.sharedWounds = m && has(path, 'shared_wounds');
  out.undying = m && has(path, 'undying_devotion');
  out.vigil = m && has(path, 'low_life_vigil');
  out.aegis = m && has(path, 'martyrs_aegis');
  out.covenant = m && has(path, 'sanguine_covenant');
  out.vow = m && state.field.vow;
  const up = !!h && !h.downed && !h.dead;
  out.bearing = m && up && !!w && w.threadMode === 'bear' && w.threadSlot !== null;
  const maxLife = w && w.maxLife > 0 ? w.maxLife : (h?.maxHp ?? 1);
  const hp = h ? h.hp : maxLife;
  out.life = Math.max(0, Math.min(1, hp / Math.max(1, maxLife)));
  out.vigilOn = out.vigil && up && hp < maxLife * vigilBelow();
  out.fontOn = out.bloodFont && up && hp < maxLife * fontBelow();
  out.fontRegen = out.fontOn && !!h && hp < h.maxHp - 0.5;
  out.undyingReady = out.undying && !!w && w.undying;
  out.undyingGrace = out.undying && !!w && !w.undying && !!h && h.invulnerable > 0 && up;
  return out;
}

/** The Vow holds this hero (the seal): the Vow is up and they stand. */
export function vowSeals(state: WorldState, e: ReadonlyEntity | undefined): boolean {
  if (!e?.hero || !state.field.vow || !isMartyr(state)) return false;
  return !!e.health && !e.health.dead && !e.health.downed;
}
