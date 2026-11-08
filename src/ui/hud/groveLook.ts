/**
 * Oro on the HUD (docs/phase-5e.md, "Oro's frame"), as plain data so it is testable without
 * React: the sub-row of mini bars under his life, one per Sapling (a leaf, its life, the auras it
 * hears or an out-of-field mark, its re-sprout timer), the Ancient's timer (with a 'your field'
 * mark when Cued), and the Gentle glyph on his portrait. Everything keys on `HeroHud.grove`
 * (present only for a hero with Rootbond), so every other frame is exactly as it was.
 */
import { heroDef } from '../../content';
import type { HeroHud } from '../store';

/** Oro's moss (his def's colour): the leaf glyphs and the Sapling bars' edge. */
export const GROVE_MOSS = heroDef('oro').color;
/** A Sapling's life on its mini bar: a lighter moss, never the heal green of your auras. */
export const SAPLING_LIFE = '#86b896';
/** The grove's text: his moss lightened, so it reads on the dark frame. */
export const GROVE_INK = '#b7d8c0';

/** The names he gives his Saplings, by index (his `saplingFelled` barks name the first two). */
export const SAPLING_NAMES: readonly string[] = ['Moss', 'Fern', 'Sorrel'];

/** "Moss" (the Sapling at this index), or "Sapling 4" past the names. */
export function saplingName(index: number): string {
  return SAPLING_NAMES[index] ?? `Sapling ${index + 1}`;
}

export interface SaplingRow {
  index: number;
  name: string;
  /** 0..1 of its life; 0 when felled. */
  life: number;
  felled: boolean;
  /** Felled: seconds until it re-sprouts (null: none counting). */
  respawnIn: number | null;
  inField: boolean;
  auras: string[];
  burrowing: boolean;
  /** The tooltip and accessible sentence. */
  title: string;
}

/** The mini bars under Oro's life, one per Sapling his grove keeps. Empty without `grove`. */
export function saplingRows(h: Pick<HeroHud, 'name' | 'grove'>): SaplingRow[] {
  const g = h.grove;
  if (!g) return [];
  return g.saplings.map((s, index) => {
    const name = saplingName(index);
    const felled = s.hpPct < 0;
    const respawnIn = felled && s.respawnIn !== undefined ? s.respawnIn : null;
    const auras = s.auras ?? [];
    const burrowing = !felled && s.burrowing === true;
    const title = felled
      ? `${name} was felled${respawnIn !== null ? `: it re-sprouts in ${Math.ceil(respawnIn)} s` : ''}`
      : burrowing
        ? `${name} is burrowing: it re-plants ahead of you`
        : s.inField
          ? `${name} stands in your songs (${Math.round(s.hpPct * 100)}% life)`
          : `${name} is outside your songs (${Math.round(s.hpPct * 100)}% life): walk back, or Rally to re-plant it`;
    return {
      index,
      name,
      life: felled ? 0 : Math.max(0, Math.min(1, s.hpPct)),
      felled,
      respawnIn,
      inField: !felled && s.inField,
      auras,
      burrowing,
      title,
    };
  });
}

/** Saplings standing outside your songs right now (not felled, not burrowing). */
export function saplingsOutside(h: Pick<HeroHud, 'grove'>): number {
  return (h.grove?.saplings ?? []).filter((s) => s.hpPct >= 0 && !s.inField && !s.burrowing).length;
}

/** The Ancient's chip: its seconds left, and 'your field' when Cued (Q2). Null with none. */
export function ancientChip(
  h: Pick<HeroHud, 'grove'>,
): { label: string; title: string; cued: boolean } | null {
  const g = h.grove;
  if (!g || g.ancient <= 0) return null;
  const s = Math.ceil(g.ancient);
  const cued = g.ancientCued === true;
  return {
    label: cued ? `Ancient ${s} s · your field` : `Ancient ${s} s`,
    title: cued
      ? `The Ancient stands ${s} s more, wreathed in your songs: its disc counts as your field`
      : `The Ancient stands ${s} s more: it roots, taunts and slams the lesser enemies around it`,
    cued,
  };
}

/** Gentle on his portrait: tending (no Focus), so he won't fight and his Saplings hit harder. */
export function tendingTitle(h: Pick<HeroHud, 'name' | 'grove'>): string | null {
  if (!h.grove?.tending) return null;
  return `Tending: ${h.name} won’t fight without a Focus, and his Saplings fight harder for him`;
}
