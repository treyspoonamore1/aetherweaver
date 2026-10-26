/**
 * Line-art glyphs for Callings and their path options (Phase 3c, 3d), keyed by content `icon`.
 * Same 24×24 grid, stroke and round caps as the Icon kit and the relic glyphs.
 */
export const CALLING_GLYPHS: Readonly<Record<string, string>> = {
  // The Luminary: the sun rising over the horizon.
  luminary:
    'M2.5 16.5h19 M6.5 16.5a5.5 5.5 0 0 1 11 0 M12 5v2.6 M4.7 8.7l1.8 1.8 M19.3 8.7l-1.8 1.8 M1.8 12.6h2.4 M19.8 12.6h2.4 M7.5 20h9',
  // Haloed: a halo over a head and shoulders.
  halo_ring:
    'M12 3.2c3.6 0 6.5 1.1 6.5 2.4S15.6 8 12 8 5.5 6.9 5.5 5.6 8.4 3.2 12 3.2z M12 10.2a2.7 2.7 0 1 0 0 5.4 2.7 2.7 0 0 0 0-5.4z M6.5 21c0-3 2.4-4.8 5.5-4.8s5.5 1.8 5.5 4.8',
  // Wide Choir: the song spreading outward from you.
  wide: 'M12 18.5a1.2 1.2 0 1 0 0 .01 M8.4 15.2a5.1 5.1 0 0 1 7.2 0 M5.4 12.1a9.3 9.3 0 0 1 13.2 0 M2.4 9a13.5 13.5 0 0 1 19.2 0',
  // Dawnward: a ward with the sun rising in it.
  dawn: 'M12 3l7 3v5.5c0 4.7-3 8-7 9.5-4-1.5-7-4.8-7-9.5V6z M8.4 14.5a3.6 3.6 0 0 1 7.2 0 M7.2 14.5h9.6 M12 8.2v1.8 M8.6 9.6l1 1 M15.4 9.6l-1 1',
  // Searing Hymns: a flame with heat rising off it.
  sear: 'M12 3c3.2 3.4 4.8 6 4.8 9a4.8 4.8 0 0 1-9.6 0c0-1.7.7-3.1 1.9-4.3.2 1.6 1 2.6 2.1 2.8-.4-2.6.1-5 .8-7.5z M12 13.5c1 1 1.4 1.8 1.4 2.6a1.4 1.4 0 0 1-2.8 0c0-.8.4-1.6 1.4-2.6z M4.2 6.5l1.4 1.2 M19.8 6.5l-1.4 1.2',
  // Third Voice: three voices, a triad.
  voice:
    'M12 3.5a2.6 2.6 0 1 0 0 5.2 2.6 2.6 0 0 0 0-5.2z M6 14.3a2.6 2.6 0 1 0 0 5.2 2.6 2.6 0 0 0 0-5.2z M18 14.3a2.6 2.6 0 1 0 0 5.2 2.6 2.6 0 0 0 0-5.2z M10.6 8.6l-3.2 5.8 M13.4 8.6l3.2 5.8 M8.6 16.9h6.8',
  // Lantern Bearer: a lantern on a staff, planted in the ground.
  stake:
    'M12 10.2v11.3 M8.5 21.5h7 M9.4 3.4h5.2l-1 6.8h-3.2z M10.2 6.8h3.6 M5.8 6.2h1.6 M16.6 6.2h1.6 M6.6 2.8l1.1 1.1 M17.4 2.8l-1.1 1.1',
  // Sovereign Symphony: a crown with a gem.
  crown:
    'M3.5 8.5l4.2 3.8L12 5.5l4.3 6.8 4.2-3.8-1.6 10h-13.8z M5 21h14 M12 13.4a1.3 1.3 0 1 0 0 2.6 1.3 1.3 0 0 0 0-2.6z',
  // Eclipse: a dark disc with the corona blazing round it.
  eclipse:
    'M12 6.8a5.2 5.2 0 1 0 0 10.4 5.2 5.2 0 0 0 0-10.4z M14.6 8.4a4.2 4.2 0 0 1-5.9 6 M12 2v2 M12 20v2 M2 12h2 M20 12h2 M4.9 4.9l1.4 1.4 M17.7 17.7l1.4 1.4 M19.1 4.9l-1.4 1.4 M6.3 17.7l-1.4 1.4',
  // The Martyr: a heart, a drop of its blood falling into cupped hands.
  martyr:
    'M12 12.6C7.6 9.7 5.2 7.6 5.2 5.4a3.2 3.2 0 0 1 6.8-1.6 3.2 3.2 0 0 1 6.8 1.6c0 2.2-2.4 4.3-6.8 7.2z M12 14.6c1.2 1.5 1.8 2.5 1.8 3.3a1.8 1.8 0 0 1-3.6 0c0-.8.6-1.8 1.8-3.3z M3 15.2c1.4 3 3.8 5 6.6 5.6 M21 15.2c-1.4 3-3.8 5-6.6 5.6',
  // Penitence: a drop of borne blood, and the Resonance it fills rising round it.
  penitence:
    'M12 10.2c2.2 2.8 3.3 4.6 3.3 6.2a3.3 3.3 0 0 1-6.6 0c0-1.6 1.1-3.4 3.3-6.2z M3.8 12a8.4 8.4 0 0 1 3.4-6.2 M9.8 3.9a8.4 8.4 0 0 1 4.4 0 M16.8 5.8a8.4 8.4 0 0 1 3.4 6.2',
  // Scarred Hide: a hide (a shield) with a stitched scar across it.
  scar: 'M12 3l7 3v5.5c0 4.7-3 8-7 9.5-4-1.5-7-4.8-7-9.5V6z M8.3 15.7l7.4-7.4 M9.2 13.2l1.6 1.6 M11.2 11.2l1.6 1.6 M13.2 9.2l1.6 1.6',
  // Blood Font: a basin, the blood welling up out of it.
  font: 'M4.5 13.5h15 M6 13.5c0 3.6 2.7 6.5 6 6.5s6-2.9 6-6.5 M12 3c1.8 2.3 2.7 3.9 2.7 5.2a2.7 2.7 0 0 1-5.4 0c0-1.3.9-2.9 2.7-5.2z M7.2 9.6v1.4 M16.8 9.6v1.4',
  // Shared Wounds: three drops, bound to one another.
  wounds:
    'M12 3c1.3 1.6 2 2.7 2 3.6a2 2 0 0 1-4 0c0-.9.7-2 2-3.6z M5.5 13.2c1.3 1.6 2 2.7 2 3.6a2 2 0 0 1-4 0c0-.9.7-2 2-3.6z M18.5 13.2c1.3 1.6 2 2.7 2 3.6a2 2 0 0 1-4 0c0-.9.7-2 2-3.6z M10.4 10l-2.8 3.6 M13.6 10l2.8 3.6 M8.4 18.6h7.2',
  // Undying Devotion: a heart, a pulse that doesn't stop.
  undying:
    'M12 20.5C6.6 16.9 3.6 13.8 3.6 10.2A4.2 4.2 0 0 1 12 8a4.2 4.2 0 0 1 8.4 2.2c0 3.6-3 6.7-8.4 10.3z M2.5 13h4.6l1.5-2.8 2.4 5.6 2-4.4 1.2 1.6h7.3',
  // Low-Life Vigil: a candle burnt low, still lit.
  vigil:
    'M9 15.5h6V21H9z M12 15.5V14 M12 5c1.8 2.3 2.6 3.8 2.6 5.1a2.6 2.6 0 0 1-5.2 0c0-1.3.8-2.8 2.6-5.1z M6 21h12 M5.5 9.5l1.2.6 M18.5 9.5l-1.2.6',
  // Martyr's Aegis: a Ward over the hero, its edge over you too.
  aegis:
    'M10 4l6 2.5v4.6c0 4-2.5 6.8-6 8.1-3.5-1.3-6-4.1-6-8.1V6.5z M17.6 8.9l2.9 1.2v3c0 2.9-1.6 5-4.2 6.2 M10 9.4c1.2 1.5 1.8 2.5 1.8 3.4a1.8 1.8 0 0 1-3.6 0c0-.9.6-1.9 1.8-3.4z',
  // Sanguine Covenant: the chalice the blood is shared from.
  covenant:
    'M6.5 3.5h11c0 4.8-2.4 8-5.5 8s-5.5-3.2-5.5-8z M7.2 6.8h9.6 M12 11.5v6 M8.5 20.5h7 M9.8 17.5h4.4',
};

/** A Calling glyph's path data (a plain diamond for an unknown key). */
export function callingGlyphPath(icon: string): string {
  return CALLING_GLYPHS[icon] ?? 'M12 3l7 9-7 9-7-9z';
}
