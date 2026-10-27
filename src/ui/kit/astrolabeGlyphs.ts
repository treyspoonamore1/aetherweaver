import { PATHS, type IconName } from './iconPaths';

/**
 * Line-art glyphs for the Astrolabe (Phase 4): the four constellations, the Weaver's Star, the
 * six keystones and the two great notables. Same 24×24 grid, stroke and round caps as the Icon
 * kit and the Calling glyphs. Every other star borrows a kit icon for what it does
 * (`astrolabeModel.ts`, `starGlyph`).
 */
export const ASTROLABE_GLYPHS: Readonly<Record<string, string>> = {
  // The Weaver's Star: a four-pointed star in a small ring.
  weaver_star:
    'M12 2.5l1.9 7.6 7.6 1.9-7.6 1.9L12 21.5l-1.9-7.6L2.5 12l7.6-1.9z M12 8.6a3.4 3.4 0 1 0 0 6.8 3.4 3.4 0 0 0 0-6.8z',
  // Silk: a spindle wound with thread, a loose end trailing.
  silk: 'M8 3.5h8 M8 20.5h8 M12 3.5v17 M8.5 7.5l7 2.2 M8.5 11l7 2.2 M8.5 14.5l7 2.2 M16 20.5c2.5 0 4-1.5 4-3.5',
  // Choir: three voices rising, a chord.
  choir:
    'M5 18.5V9 M5 9l5-1.6 M10 15.5V7.4 M10 7.4l5-1.6 M15 12.5V5.8 M15 5.8l4.5-1.4 M5 18.5a1.8 1.8 0 1 1-1.8-1.8 M10 15.5a1.8 1.8 0 1 1-1.8-1.8 M15 12.5a1.8 1.8 0 1 1-1.8-1.8',
  // Aegis: a Ward with a second, inner edge.
  aegis:
    'M12 3l7 3v5.5c0 4.7-3 8-7 9.5-4-1.5-7-4.8-7-9.5V6z M12 7l3.8 1.6v3.2c0 2.6-1.6 4.4-3.8 5.3-2.2-.9-3.8-2.7-3.8-5.3V8.6z',
  // Bond: three heroes, shoulder to shoulder.
  bond: 'M12 4.5a2.3 2.3 0 1 0 0 4.6 2.3 2.3 0 0 0 0-4.6z M5.5 7a2 2 0 1 0 0 4 2 2 0 0 0 0-4z M18.5 7a2 2 0 1 0 0 4 2 2 0 0 0 0-4z M7.6 19c0-3.2 2-5.4 4.4-5.4s4.4 2.2 4.4 5.4 M2 17.5c0-2.3 1.5-3.9 3.5-3.9 1 0 1.8.3 2.4 1 M22 17.5c0-2.3-1.5-3.9-3.5-3.9-1 0-1.8.3-2.4 1',
  // Overflowing Grace: Mend's cross in a Ward, spilling over its rim.
  overflowing_grace:
    'M12 6.5l6 2.5v4.2c0 3.9-2.5 6.7-6 7.9-3.5-1.2-6-4-6-7.9V9z M12 10.5v5 M9.5 13h5 M6.5 6.5C6.5 4.4 8 3 10 3 M17.5 6.5C17.5 4.4 16 3 14 3 M12 2.5v1.6',
  // Sanguine Font: a song whose note is a drop of blood.
  sanguine_font:
    'M13 15.2V3.5l6 1.8v3.3l-6-1.8 M9.5 11.2c2.1 2.6 3.2 4.3 3.2 5.8a3.2 3.2 0 0 1-6.4 0c0-1.5 1.1-3.2 3.2-5.8z',
  // Prism Covenant: a prism, the light through it split into a spread of colours.
  prism_covenant:
    'M10 4.5l6.5 13h-13z M1.5 12.5l5.3-1.4 M13.4 10.8l8-3.4 M14.6 13.2l7.4-.6 M15.4 15.6l6.6 2.4',
  // Unbroken Chorus: a field whose ring no Mute can crack, a song sounding inside it.
  unbroken_chorus:
    'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M12 6.4a5.6 5.6 0 1 0 0 11.2 5.6 5.6 0 0 0 0-11.2z M11 14.6V9.2l3-.8 M11 14.6a1.3 1.3 0 1 1-1.3-1.3',
  // Shatterproof Halo: a Ward under a halo, a crack that stops halfway.
  shatterproof_halo:
    'M12 7.5l6 2.5v4c0 3.8-2.5 6.4-6 7.6-3.5-1.2-6-3.8-6-7.6v-4z M12 10.2l-1.4 2.6 2 1.4-1.1 2.2 M6.5 4.2c0 .9 2.5 1.7 5.5 1.7s5.5-.8 5.5-1.7-2.5-1.7-5.5-1.7-5.5.8-5.5 1.7z',
  // Eldritch Conduit: a drop of Life with Spirit's lightning through it.
  eldritch_conduit:
    'M12 2.8c3.7 4.4 5.6 7.6 5.6 10.4a5.6 5.6 0 0 1-11.2 0c0-2.8 1.9-6 5.6-10.4z M13.2 9.2l-2.6 4.1h3.1l-2.4 4.2',
  // Second Wind: a breath of wind lifting a fallen hero back up.
  second_wind:
    'M3 13.5h8.5a2.5 2.5 0 1 0-2.5-2.5 M3 17h12.5a2.5 2.5 0 1 1-2.5 2.5 M18 12.5V3.5 M15 6.5l3-3 3 3',
  // Ensemble: three heroes' rings, one song arcing over them all.
  ensemble:
    'M5 14.5a2.4 2.4 0 1 0 0 4.8 2.4 2.4 0 0 0 0-4.8z M12 14.5a2.4 2.4 0 1 0 0 4.8 2.4 2.4 0 0 0 0-4.8z M19 14.5a2.4 2.4 0 1 0 0 4.8 2.4 2.4 0 0 0 0-4.8z M4 11c2.4-6.3 13.6-6.3 16 0 M12 5.2V3',
};

/** A glyph's path data: an Astrolabe glyph, else a kit icon (a plain diamond for neither). */
export function astrolabeGlyphPath(glyph: string): string {
  return ASTROLABE_GLYPHS[glyph] ?? PATHS[glyph as IconName] ?? PATHS.diamond;
}
