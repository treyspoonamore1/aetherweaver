/**
 * Hand-drawn 24×24 glyphs. Every semantic colour in the UI is paired with one of these (or
 * a label), so colour is never the only cue (docs/plan/04 §8).
 */
export const PATHS = {
  ward: 'M12 3l7 3v5.5c0 4.7-3 8-7 9.5-4-1.5-7-4.8-7-9.5V6z',
  chime:
    'M12 3.5a1 1 0 0 1 1 1v.7A6 6 0 0 1 18 11v4l2 2.5H4L6 15v-4a6 6 0 0 1 5-5.8v-.7a1 1 0 0 1 1-1z M10 20a2 2 0 0 0 4 0',
  reel: 'M20 12H9 M13 7l-5 5 5 5 M4 5v14',
  glide: 'M5 6l6 6-6 6 M13 6l6 6-6 6',
  thread:
    'M9.5 14.5l5-5 M8 11l-1.7 1.7a3.5 3.5 0 0 0 5 5L13 16 M16 13l1.7-1.7a3.5 3.5 0 0 0-5-5L11 8',
  mend: 'M12 5v14 M5 12h14',
  empower: 'M12 3l2.2 6.8L21 12l-6.8 2.2L12 21l-2.2-6.8L3 12l6.8-2.2z',
  note: 'M9 17.5V6l10-2v11.5 M9 17.5a2.75 2.75 0 1 1-2.75-2.75A2.75 2.75 0 0 1 9 17.5z M19 15.5a2.75 2.75 0 1 1-2.75-2.75A2.75 2.75 0 0 1 19 15.5z',
  skull:
    'M12 3a8 8 0 0 0-5 14.2V20h10v-2.8A8 8 0 0 0 12 3z M10 20v-2.5 M14 20v-2.5 M9.5 11.5h.01 M14.5 11.5h.01',
  link: 'M9 12h6 M6 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z M18 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z',
  mute: 'M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z M16 9.5l5 5 M21 9.5l-5 5',
  stun: 'M12 3.5v4 M12 16.5v4 M3.5 12h4 M16.5 12h4 M6.3 6.3l2.8 2.8 M14.9 14.9l2.8 2.8 M17.7 6.3l-2.8 2.8 M9.1 14.9l-2.8 2.8',
  immune: 'M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17z M8.5 12.3l2.4 2.4 4.6-5',
  shaken: 'M13 3l-3 7 4 2-4 4 3 5',
  sleep: 'M5 6h6L5 13h6 M13 12h5l-5 6h5',
  heart:
    'M12 20s-7.5-4.6-7.5-10.3A4.2 4.2 0 0 1 12 7.2a4.2 4.2 0 0 1 7.5 2.5C19.5 15.4 12 20 12 20z',
  swords:
    'M5 5l9.5 9.5 M19 5l-9.5 9.5 M13 15.5l2.5 2.5 M11 15.5L8.5 18 M15.5 18l1.5 1.5 M8.5 18L7 19.5 M4.5 4.5l1 3 M19.5 4.5l-1 3',
  flame:
    'M12 3c2.3 3.2 3.6 5.6 3.6 8a3.6 3.6 0 0 1-7.2 0c0-1.2.5-2.2 1.4-3.2 M6.5 21h11 M8.5 15.5V21 M15.5 15.5V21',
  moon: 'M19.5 14.5A8 8 0 1 1 9.5 4.5a6.4 6.4 0 0 0 10 10z',
  eye: 'M2.5 12S6.5 5.5 12 5.5 21.5 12 21.5 12 17.5 18.5 12 18.5 2.5 12 2.5 12z M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  crown: 'M4 8l3.5 3.5L12 5l4.5 6.5L20 8v10H4z M4 21h16',
  bell: 'M12 3.5a1 1 0 0 1 1 1v.7A6 6 0 0 1 18 11v4l2 2.5H4L6 15v-4a6 6 0 0 1 5-5.8v-.7a1 1 0 0 1 1-1z M10 20a2 2 0 0 0 4 0',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  close: 'M6 6l12 12 M18 6L6 18',
  arrow: 'M4 12h15 M13 6l6 6-6 6',
  back: 'M20 12H5 M11 6l-6 6 6 6',
  gear: 'M4 7h9 M17 7h3 M4 17h3 M11 17h9 M15 4.5v5 M9 14.5v5',
  play: 'M7 4.5v15l12-7.5z',
  pause: 'M8 5v14 M16 5v14',
  reroll: 'M20 11a8 8 0 1 0-1.8 6.2 M20 5v6h-6',
  book: 'M5 4.5h10.5A3.5 3.5 0 0 1 19 8v12.5H8.5A3.5 3.5 0 0 1 5 17z M5 17a3.5 3.5 0 0 1 3.5-3.5H19',
  star: 'M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.8 6.8 19.7l1-5.9L3.5 9.7l5.9-.8z',
  diamond: 'M12 3l7 9-7 9-7-9z',
  clock: 'M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17z M12 7.5V12l3 2',
  flag: 'M6 21V4 M6 5h11l-2 3.5L17 12H6',
  lock: 'M7 11V8a5 5 0 0 1 10 0v3 M5.5 11h13v9.5h-13z',
  home: 'M4 11l8-7 8 7 M6 9.5V20h12V9.5',
  focus: 'M12 3v4 M12 17v4 M3 12h4 M17 12h4 M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z',
  scatter:
    'M12 12L5 5 M12 12l7-7 M12 12l-7 7 M12 12l7 7 M4 4h3 M4 4v3 M20 4h-3 M20 4v3 M4 20h3 M4 20v-3 M20 20h-3 M20 20v-3',
  stack:
    'M12 12m-3 0a3 3 0 1 0 6 0 3 3 0 1 0-6 0 M12 12m-7.5 0a7.5 7.5 0 1 0 15 0 7.5 7.5 0 1 0-15 0',
  move: 'M12 3v18 M3 12h18 M12 3l-3 3 M12 3l3 3 M12 21l-3-3 M12 21l3-3 M3 12l3-3 M3 12l3 3 M21 12l-3-3 M21 12l-3 3',
  dome: 'M4 18a8 8 0 0 1 16 0z M3 18h18',
  mouse: 'M12 3a5 5 0 0 0-5 5v8a5 5 0 0 0 10 0V8a5 5 0 0 0-5-5z M12 3v6',
  sparkle: 'M12 4v4 M12 16v4 M4 12h4 M16 12h4 M7 7l2 2 M15 15l2 2 M17 7l-2 2 M9 15l-2 2',
  hourglass: 'M7 3.5h10 M7 20.5h10 M8 3.5c0 5 8 5 8 8.5s-8 3.5-8 8.5 M16 3.5c0 5-8 5-8 8.5',
  fermata: 'M3.5 16.5a8.5 8.5 0 0 1 17 0 M12 14.3a1.3 1.3 0 1 0 0 2.6 1.3 1.3 0 0 0 0-2.6z',
  call: 'M4.5 4.5h15v11h-8l-4.5 4v-4h-2.5z M12 7.5v4 M12 13.4h.01',
  tune: 'M8.5 3v7.5a3.5 3.5 0 0 0 7 0V3 M12 14v7.5',
  wheel: 'M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17z M12 3.5V9 M12 15v5.5 M3.5 12H9 M15 12h5.5',
  pin: 'M12 21.5s-6-6.2-6-11a6 6 0 0 1 12 0c0 4.8-6 11-6 11z M12 8a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z',
  info: 'M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17z M12 11v5 M12 7.7h.01',
  /** Phase 3b: Aether (a cut crystal), the merchant's purse, the forge's anvil, an event. */
  aether: 'M12 3l5.5 6.5L12 21 6.5 9.5z M6.5 9.5h11 M9.6 9.5L12 3l2.4 6.5L12 21',
  purse:
    'M9 4h6l-1.6 3.2h-2.8z M10.4 7.2C6.6 8.7 4.5 12.3 4.5 15.3a5 5 0 0 0 5 5h5a5 5 0 0 0 5-5c0-3-2.1-6.6-5.9-8.1 M12 11.3v5.4 M10 13.2h3.2 M10.8 15h3.2',
  anvil:
    'M3.5 6.5h12v2.2c0 2.3-1.7 4-4 4H8.8 M15.5 6.5h5c0 2.3-2.2 3.9-5 3.6 M9.5 12.7v3.3 M13 12.7v3.3 M6.5 20.5h10l-2-4.5h-6z',
  event:
    'M12 2.8l9.2 9.2-9.2 9.2L2.8 12z M9.7 9.7a2.4 2.4 0 1 1 3.3 2.2c-.6.3-1 .8-1 1.4v.5 M12 16.2h.01',
  relic:
    'M12 3l7 4v6c0 4-3 6.8-7 8-4-1.2-7-4-7-8V7z M12 8.5l1.2 2.4 2.6.4-1.9 1.8.5 2.6-2.4-1.3-2.4 1.3.5-2.6-1.9-1.8 2.6-.4z',
  /** Phase 3c: the Luminary's light (Radiance, the Calling). */
  sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z M12 2.5v2.5 M12 19v2.5 M2.5 12H5 M19 12h2.5 M5.3 5.3l1.8 1.8 M16.9 16.9l1.8 1.8 M18.7 5.3l-1.8 1.8 M7.1 16.9l-1.8 1.8',
  /** Phase 3d: the Martyr's blood (her Life, the Calling), Bear and her Vow. */
  drop: 'M12 3.5c3 3.8 4.6 6.4 4.6 8.7a4.6 4.6 0 0 1-9.2 0c0-2.3 1.6-4.9 4.6-8.7z',
  bear: 'M12 3c1.9 2.4 2.9 4.1 2.9 5.5a2.9 2.9 0 0 1-5.8 0c0-1.4 1-3.1 2.9-5.5z M3.5 13.5c1.6 4.2 4.7 6.8 8.5 6.8s6.9-2.6 8.5-6.8 M3.5 13.5h4 M20.5 13.5h-4',
  vow: 'M12 17.5s-7-4.1-7-9.2A3.9 3.9 0 0 1 12 6a3.9 3.9 0 0 1 7 2.3c0 5.1-7 9.2-7 9.2z M4 21h16',
  /**
   * Phase 3e: the Chronomancer's Rewind (in Reel's slot: a clock turning back) and Stasis (time
   * held still).
   */
  rewind: 'M4 12a8 8 0 1 0 8-8 8.7 8.7 0 0 0-6 2.4L4 8.5 M4 4v4.5h4.5 M12 8v4l3 1.8',
  stasis: 'M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17z M10 9v6 M14 9v6',
  /**
   * Phase 4c: the Reliquary (the shrine, as the events' glyph draws it), its materials (a Tuning
   * Shard, a Discord Tear with its crack), a relic carried into a run, the crafts (Inscribe's
   * stylus, Ascend's rise, Dissonate's swirl, Release's way out) and what crafting can leave: a
   * Fracture's crack and a Shattered relic's splinters.
   */
  reliquary:
    'M4.5 10.5h15v10h-15z M4.5 10.5a7.5 6 0 0 1 15 0 M4.5 14h15 M12 14v3.2 M12 4.5v-1.5 M10.5 3.8h3',
  shard: 'M14 2.5l5 5.5-8 13.5-5-5.5z M14 2.5l-3 19 M8.5 8.5l3.5 1',
  tear: 'M12 3c3.3 4.2 5.2 7.2 5.2 9.8a5.2 5.2 0 0 1-10.4 0C6.8 10.2 8.7 7.2 12 3z M12.9 9.4l-1.9 2.7 2.1 1.6-1.7 2.9',
  carry:
    'M9.5 3l6 3.4v5.1c0 3.4-2.6 5.8-6 6.8-3.4-1-6-3.4-6-6.8V6.4z M14 19.5h7 M18.5 17l2.5 2.5-2.5 2.5 M9.5 7.5v6 M6.5 10.5h6',
  inscribe: 'M16.5 3.5l4 4L9 19l-5 1 1-5z M14 6l4 4 M4 20.5h7',
  ascend: 'M6.5 12.5L12 7l5.5 5.5 M6.5 18.5L12 13l5.5 5.5 M7 3.5h10',
  dissonate: 'M12 12a2 2 0 0 1 4 0 4 4 0 0 1-8 0 6 6 0 0 1 12 0 8 8 0 0 1-16 0',
  release: 'M12 15V3.5 M7.5 8L12 3.5 16.5 8 M5 12.5v8h14v-8',
  crack: 'M13 2.5L9.5 8.5l4 3-4.5 5 2 5.5 M9.5 8.5L6 7.2 M13.5 11.5l4 1.3 M9 16.5l-3.2.9',
  shatter: 'M4 6l5 1.5-2.5 4z M14 3.5l5 3-4.5 2z M15.5 13l4.5 5.5-6 .5z M6 15l4 1-1.5 4.5z',
  /**
   * Phase 4d: Dissonance (a calm wave breaking into a jagged one: harmony turned to discord), and
   * Blind Score (an eye struck through: the answer a telegraph wants stays hidden).
   */
  dissonance: 'M2.5 12c.9-2.6 2.6-2.6 3.5 0s2.6 2.6 3.5 0 M9.5 12l2-6 2.5 12 2.5-12 2.5 12 2-6',
  blind:
    'M3.5 3.5l17 17 M10.6 5.6a9.9 9.9 0 0 1 1.4-.1c5.5 0 9.5 6.5 9.5 6.5a16.6 16.6 0 0 1-2.3 3.1 M6.5 6.6C3.9 8.3 2.5 12 2.5 12s4 6.5 9.5 6.5a9.3 9.3 0 0 0 4.5-1.2 M9.9 9.9a3 3 0 0 0 4.2 4.2',
  /**
   * Phase 4e: a Bond (two rings, linked), a talent (a rune that rises: a hero growing) and a
   * scene (a fire to sit at: the Respite's).
   */
  bond: 'M9.5 6.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11z M14.5 6.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11z',
  talent: 'M12 3l7.5 4.3v8.6L12 20.2l-7.5-4.3V7.3z M12 16.5v-8 M9 11l3-2.8 3 2.8',
  scene:
    'M12 3.5c1.9 2.5 3.1 4.3 3.1 6.3a3.1 3.1 0 0 1-6.2 0c0-1.1.5-2 1.3-3 .3 1 .9 1.6 1.6 1.9 M4.5 20.5l15-4 M4.5 16.5l15 4',
  /**
   * Phase 4f: the technique variants, each drawn from its slot's glyph. Chorale (a Ward ringing
   * out), Aegis Link (two Wards, split evenly), Purge (a Chime bursting outward), Absolve (a Chime
   * that heals), Swap (two arrows trading places), Anchor, Phase Step (a decoy left behind, a
   * blink ahead) and Skate (Glide's chevrons on a blade).
   */
  chorale:
    'M12 6.5l3.6 1.5v2.9c0 2.5-1.5 4.3-3.6 5.1-2.1-.8-3.6-2.6-3.6-5.1V8z M6.3 8.8a4.6 4.6 0 0 0 0 6.4 M17.7 8.8a4.6 4.6 0 0 1 0 6.4 M3.6 6.6a7.6 7.6 0 0 0 0 10.8 M20.4 6.6a7.6 7.6 0 0 1 0 10.8',
  aegisLink:
    'M6.5 6l3.8 1.6v3.3c0 2.9-1.6 5-3.8 5.9-2.2-.9-3.8-3-3.8-5.9V7.6z M17.5 6l3.8 1.6v3.3c0 2.9-1.6 5-3.8 5.9-2.2-.9-3.8-3-3.8-5.9V7.6z M10.3 10.2h3.4 M10.3 13h3.4',
  purge:
    'M12 6.5a.9.9 0 0 1 .9.9v.4A4.6 4.6 0 0 1 16.5 12.3v2.9l1.6 2H5.9l1.6-2v-2.9a4.6 4.6 0 0 1 3.6-4.5v-.4a.9.9 0 0 1 .9-.9z M10.5 19.7a1.5 1.5 0 0 0 3 0 M4.5 4.5l2 2 M19.5 4.5l-2 2 M2.5 11.5h2.5 M21.5 11.5H19',
  absolve:
    'M12 3.5a1 1 0 0 1 1 1v.7A6 6 0 0 1 18 11v4l2 2.5H4L6 15v-4a6 6 0 0 1 5-5.8v-.7a1 1 0 0 1 1-1z M10 20a2 2 0 0 0 4 0 M12 9v5.5 M9.25 11.75h5.5',
  swap: 'M4 8.5h14 M14.5 5L18 8.5 14.5 12 M20 15.5H6 M9.5 12L6 15.5 9.5 19',
  anchor:
    'M12 3.5a2 2 0 1 0 0 4 2 2 0 0 0 0-4z M12 7.5v13 M8.5 10.5h7 M4.5 13.5a7.5 7.5 0 0 0 15 0 M3 15l1.5-1.5L6 15 M18 15l1.5-1.5L21 15',
  phaseStep:
    'M5.5 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z M9.5 12h1.5 M13 12h1.5 M15.5 6.5l5.5 5.5-5.5 5.5',
  skate: 'M6 5l4.5 4.5L6 14 M12.5 5l4.5 4.5-4.5 4.5 M3.5 18.5H18a2.5 2.5 0 0 0 2.5-2.5',
  /**
   * Phase 4g: Starlight (a twin sparkle: never the Astrolabe's four-point star or XP's five), the
   * Loom (a loom's frame, its warp and a weft crossing), the Gate (an arch with its door), the
   * Atelier (a dress form), a robe, and a title (a ribbon with notched ends).
   */
  starlight:
    'M10 5c.7 4.6 2.4 6.3 7 7-4.6.7-6.3 2.4-7 7-.7-4.6-2.4-6.3-7-7 4.6-.7 6.3-2.4 7-7z M18.5 2.5c.3 1.9 1 2.6 3 3-2 .4-2.7 1.1-3 3-.3-1.9-1-2.6-3-3 2-.4 2.7-1.1 3-3z',
  loom: 'M4 3.5v17 M20 3.5v17 M4 6h16 M4 18h16 M8 6v12 M12 6v12 M16 6v12 M5 12.5c2.3-1.8 4.7 1.8 7 0s4.7-1.8 7 0',
  gate: 'M5 21V10a7 7 0 0 1 14 0v11 M3 21h18 M9 21v-7a3 3 0 0 1 6 0v7',
  atelier:
    'M9 3.5h6 M8.6 3.5c-.9 3 .4 5-1 7.3 1.4 2 1.4 4.2.9 6.7h7c-.5-2.5-.5-4.7.9-6.7-1.4-2.3-.1-4.3-1-7.3 M12 17.5v3.5 M8.5 21h7',
  robe: 'M9.5 3.5c.6 1.2 1.4 1.8 2.5 1.8s1.9-.6 2.5-1.8L18 5l3 5.5-3 1.4-.9-1.6L19 20.5H5l1.9-10.2-.9 1.6L3 10.5 6 5z M12 5.3v15.2',
  banner: 'M3.5 8h17l-2.2 3.5 2.2 3.5h-17l2.2-3.5z M8 11.5h8',
  /** Phase 5a: a paw print (the Gorehound Matriarch's map node). */
  paw: 'M12 12.5c-3 0-5.5 3-5.5 5.2 0 1.6 1.4 2.3 2.8 2.3 1.2 0 1.8-.6 2.7-.6s1.5.6 2.7.6c1.4 0 2.8-.7 2.8-2.3 0-2.2-2.5-5.2-5.5-5.2z M8.2 6.2a1.7 2.2 0 1 0 0 4.4 1.7 2.2 0 0 0 0-4.4z M15.8 6.2a1.7 2.2 0 1 0 0 4.4 1.7 2.2 0 0 0 0-4.4z M4.6 10a1.5 1.9 0 1 0 0 3.8 1.5 1.9 0 0 0 0-3.8z M19.4 10a1.5 1.9 0 1 0 0 3.8 1.5 1.9 0 0 0 0-3.8z',
  /**
   * Phase 5c, the Abyssal Rift: Retarget's glyph (the Thread with a cut mark across it), the
   * Shears' and the Unweaver's scissors, the Seamstress's needle, a Spindle, the Doubt Wraith's
   * mask, the Null Priest's rune, the Mimic's mirror and the Void Maw's mouth.
   */
  threadCut:
    'M9.5 14.5l5-5 M8 11l-1.7 1.7a3.5 3.5 0 0 0 5 5L13 16 M16 13l1.7-1.7a3.5 3.5 0 0 0-5-5L11 8 M4 4l4 4 M16 16l4 4',
  scissors:
    'M6.5 4a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z M6.5 15a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z M8.6 8l11.4 8.5 M8.6 16L20 7.5',
  needle: 'M19.5 3.5L6 17l-2.5 3.5L7 18l13.5-13.5z M17 4.6a1.6 1.6 0 1 1 2.4 2.3',
  spindle:
    'M12 2.5v19 M8 7.5h8 M6.5 11c0-1.4 2.5-2 5.5-2s5.5.6 5.5 2-2.5 2-5.5 2-5.5-.6-5.5-2z M7.5 14.5c0 1.6 2 2.5 4.5 2.5s4.5-.9 4.5-2.5 M10 20.5h4',
  mask: 'M4 5.5c2.7 1.2 5.4 1.2 8 0 2.6 1.2 5.3 1.2 8 0v6c0 4.6-3.6 8.5-8 8.5s-8-3.9-8-8.5z M7.5 11.5c.9-.8 2.1-.8 3 0 M13.5 11.5c.9-.8 2.1-.8 3 0 M9.5 16c1.6-1 3.4-1 5 0',
  rune: 'M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17z M12 7v10 M8.5 9.5L12 12l3.5-2.5 M9 15l3-1.5 3 1.5',
  mirror:
    'M12 3l6.5 6L12 21 5.5 9z M5.5 9h13 M12 3l-2.2 6L12 21 M14.5 12.5l1.5-1.5 M13.5 15.5l2.5-2.5',
  maw: 'M3.5 12a8.5 5.5 0 1 0 17 0 8.5 5.5 0 0 0-17 0z M6.5 10.5l1.5 2 1.5-2.5 1.5 2.5 1-2 1 2 1.5-2.5 1.5 2.5 1.5-2',
  // The Finale (docs/phase-5d.md): the Silent Conductor's baton, with the stroke of its beat.
  baton:
    'M7.5 16.5L19.5 4.5 M5 19a1.8 1.8 0 1 0 2.5-2.5A1.8 1.8 0 0 0 5 19z M13.5 4c1.8.4 3.2 1.6 3.8 3.4 M16.5 10.5c1.2.5 2 1.4 2.4 2.6',
  // Phase 5e (docs/phase-5e.md): Seren's crossed rapiers (her Parry, her Rank-up), and Oro's leaf
  // (his Rootbond, his Saplings, his Rank-up).
  blades: 'M4 4l16 16 M20 4L4 20 M15.5 18.5l3-3 M5.5 15.5l3 3 M19 21l2-2 M3 19l2 2',
  leaf: 'M5 19C5 10.5 10.5 5 19.5 4.5 19 13.5 13.5 19 5 19z M5 19l8.5-8.5 M10 14h3.5 M12.5 11.5V8',
  // Phase 5f (docs/phase-5f.md): the Conductor's chain (two notes bound by one link: a Duet, a
  // Trio) and the Grand Finale (the curtains open on a star; also the Curtain Call badge).
  chain:
    'M6.5 18a2.3 2.3 0 1 1-2.3-2.3A2.3 2.3 0 0 1 6.5 18z M6.5 18V4.5 M19.8 18a2.3 2.3 0 1 1-2.3-2.3 2.3 2.3 0 0 1 2.3 2.3z M19.8 18V4.5 M6.5 8.5h13.3a2 2 0 0 1 0 4H6.5a2 2 0 0 1 0-4z',
  finale:
    'M3 4h18 M4.5 4c0 6.2 1.4 11.2 4 16 M19.5 4c0 6.2-1.4 11.2-4 16 M12 8.5l1.1 2.3 2.5.3-1.8 1.7.4 2.5-2.2-1.2-2.2 1.2.4-2.5-1.8-1.7 2.5-.3z',
  // Phase 6 (docs/phase-6.md): the Atlas of Echoes (three stars joined, a constellation), the
  // week (a calendar page), sharing a result (a node sending to two), opening a replay file (a
  // page with an arrow in).
  atlas:
    'M5 17.5l5-9 9 4 M5 15.5l1.2 2-1.2 2-1.2-2z M10 6.5l1.2 2-1.2 2-1.2-2z M19 10.5l1.2 2-1.2 2-1.2-2z M14 19.5h.01 M17 4.5h.01 M3.5 6.5h.01',
  week: 'M4 6.5h16v13H4z M4 10.5h16 M8.5 4v4 M15.5 4v4 M8 14h2 M11 14h2 M14 14h2 M8 17h2',
  share:
    'M18 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5z M6 9.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5z M18 15.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5z M8.2 10.8l7.6-4 M8.2 13.2l7.6 4',
  upload: 'M6 3.5h8l4 4v13H6z M14 3.5v4h4 M12 18v-7 M9 13.5l3-3 3 3',
  // Phase 6's Deeds (docs/phase-6.md, "Design: Deeds"): a tuning fork under a star (Absolute
  // Pitch), a bell struck through (Silent Bell), a crown broken (Crownbreaker), a sky of stars
  // (Every Star).
  forkStar:
    'M6.5 7v6.5a3.5 3.5 0 0 0 7 0V7 M10 17v4.5 M18 2.5l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9z',
  bellSlash:
    'M12 3.5a1 1 0 0 1 1 1v.7A6 6 0 0 1 18 11v4l2 2.5H4L6 15v-4a6 6 0 0 1 5-5.8v-.7a1 1 0 0 1 1-1z M10 20a2 2 0 0 0 4 0 M3.5 3.5l17 17',
  crownBreak: 'M4 8l3.5 3.5L12 5l4.5 6.5L20 8v10H4z M4 21h16 M13 8.5l-2 3.5 2.5 1.5-2 4',
  starsMany:
    'M7 3.5l1 2.5 2.5 1-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1z M17 8.5l1 2.5 2.5 1-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1z M9 14.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z',
} as const;

export type IconName = keyof typeof PATHS;

/**
 * Phase 5g (docs/phase-5g.md): the fill's relic, event and boon glyphs, in the relic kit's style
 * (24×24, stroked, round caps; drawn by `Glyph` in `RelicGlyph.tsx`). Keyed by the entry's
 * content id, not its `icon`, so each new entry draws its own glyph whatever `icon` its content
 * names (`glyphKey`).
 */
export const FILL_GLYPHS: Readonly<Record<string, string>> = {
  // ── Relics (the doc's table order) ──
  // An oil lamp on its dish, its flame lit.
  pilgrims_lamp:
    'M4 15.5h11c0 2.5-2.5 4-5.5 4S4 18 4 15.5z M15 15.5l4.5-2.5 M9.5 15.5v-2 M9.5 6c1.4 1.6 2 2.8 1.6 3.9a1.6 1.6 0 0 1-3.2 0c-.4-1.1.2-2.3 1.6-3.9z M6 21.5h7',
  // A tin whistle, slanted, its three holes.
  tin_whistle:
    'M3.5 17.5L16 5 M6.5 20.5L19 8 M16 5l3 3 M3.5 17.5l3 3 M9.5 14.5h.01 M11.5 12.5h.01 M13.5 10.5h.01 M17.5 3.5l3 3',
  // A mourning ribbon, looped and crossed.
  black_ribbon:
    'M12 3.5c-2 0-3.5 1.5-3.5 3.5 0 2.5 3.5 6.5 3.5 6.5s3.5-4 3.5-6.5c0-2-1.5-3.5-3.5-3.5z M10.2 11L5.5 20.5l2.5-.8 1 2.3 3-6.2 M13.8 11l4.7 9.5-2.5-.8-1 2.3-3-6.2',
  // A ledger with its ruled lines, and a coin beside it.
  pedlars_ledger:
    'M4 4.5h11v16H4z M7 8.5h5 M7 11.5h5 M7 14.5h3 M18.5 12.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z M18.5 14v2',
  // A coil of spare string, its end loose.
  spare_strings:
    'M12 6a6 6 0 1 0 6 6 M12 9a3 3 0 1 0 3 3 M12 11.2a.8.8 0 1 0 .8.8 M18 12h3.5 M21.5 12l-1.5-1.5',
  // A spiral shell, and the echo it holds.
  echoing_shell:
    'M11 20.5a8 8 0 1 1 8-8 5.5 5.5 0 0 1-5.5 5.5 3.5 3.5 0 0 1-3.5-3.5 2 2 0 0 1 2-2 M20.5 17.5a6 6 0 0 1-2 2.5 M22 14a9 9 0 0 1-.6 2',
  // A pin whose head is a tear.
  lament_pin:
    'M4 20l6.5-6.5 M14.5 3.5c2.6 3.2 4 5.4 4 7.4a4 4 0 0 1-8 0c0-2 1.4-4.2 4-7.4z M4 20l-.5 1.5L5 21',
  // An hourglass in its frame, the sand settled.
  sand_glass:
    'M5.5 3.5h13 M5.5 20.5h13 M7.5 3.5c0 4.5 4.5 5.5 4.5 8.5s-4.5 4-4.5 8.5 M16.5 3.5c0 4.5-4.5 5.5-4.5 8.5s4.5 4 4.5 8.5 M9.5 18.5h5 M12 13.5v2',
  // A prompt book with its marker ribbon.
  prompt_book:
    'M5 4.5h11.5A2.5 2.5 0 0 1 19 7v13.5H7.5A2.5 2.5 0 0 1 5 18z M5 18a2.5 2.5 0 0 1 2.5-2.5H19 M8.5 8.5h4 M8.5 11.5h6 M15 4.5v4.5l1-1 1 1V4.5',
  // A ring of thorns.
  thornwreath:
    'M12 5.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13z M12 5.5l1.6-2.2 M18.5 12l2.2 1.6 M12 18.5l-1.6 2.2 M5.5 12l-2.2-1.6 M16.6 7.4l2.6-.4 M16.6 16.6l.4 2.6 M7.4 16.6l-2.6.4 M7.4 7.4l-.4-2.6',
  // A bell's clapper, ringing out.
  bell_clapper:
    'M12 3.5v10 M12 13.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z M9.5 3.5h5 M5 8.5l2.2 1 M19 8.5l-2.2 1 M4.5 14l2.4-.4 M19.5 14l-2.4-.4',
  // A needle, its eye, and a loop of thread.
  menders_needle:
    'M4.5 19.5L16.5 7.5 M16.5 7.5l1.8-1.8a1.5 1.5 0 0 1 2.1 2.1L18.6 9.6 M16.5 7.5l2.1 2.1 M18.4 7.6h.01 M8.5 15.5c-3.5-.2-4.8-3-3-4.6s5-.8 5.6 1.4',
  // Two bells, one behind the other: a Chime with a second charge.
  everbell:
    'M9 3.5a.8.8 0 0 1 .8.8v.5a4.5 4.5 0 0 1 3.7 4.4v3.3l1.5 2H3l1.5-2V9.2a4.5 4.5 0 0 1 3.7-4.4v-.5A.8.8 0 0 1 9 3.5z M7.5 17a1.5 1.5 0 0 0 3 0 M15.5 7.6a4.5 4.5 0 0 1 3 4.2v3.3l1.5 2h-5 M14 19.5a1.5 1.5 0 0 0 3 0',
  // A lute of heartwood: its round body, sound hole and neck.
  heartwood_lute:
    'M9.5 21a5.5 5.5 0 0 1-5.5-5.5c0-3.3 2.6-5.5 5.5-5.5s5.5 2.2 5.5 5.5A5.5 5.5 0 0 1 9.5 21z M13.3 11.7L19.5 5.5 M18 3.5l2.5 2.5 M9.5 14a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z',
  // A water clock: one bowl dripping into the next.
  water_clock: 'M5 4h14l-2 5.5H7z M12 9.5v2.5 M12 14v.01 M5 16h14l-1.5 4.5h-11z M8.5 18.2h7',
  // An iron mask, its eye slits and its rivets.
  iron_mask:
    'M5 5.5c4.5-1.5 9.5-1.5 14 0v6c0 5-3.5 8.5-7 9.5-3.5-1-7-4.5-7-9.5z M7.5 10.5h3 M13.5 10.5h3 M12 12.5v3 M9.5 17.5h5 M7 7.5h.01 M17 7.5h.01',
  // An ink bottle and a quill.
  red_ink:
    'M5.5 12h9v8.5h-9z M7.5 12V9.5h5V12 M20.5 3.5c-3.5.5-6 3-7 6.5 M20.5 3.5c-.5 3-2.5 5-5.5 6 M8 16.5h4',
  // A crown with a hollow at its heart.
  hollow_crown:
    'M4 8l3.5 3.5L12 5l4.5 6.5L20 8v10H4z M4 21h16 M10.2 14.5a1.8 1.8 0 1 0 3.6 0 1.8 1.8 0 0 0-3.6 0z',
  // ── Events ──
  // A hero, and the question they ask.
  heros_doubt:
    'M9 3.5a2.8 2.8 0 1 0 0 5.6 2.8 2.8 0 0 0 0-5.6z M3.5 20.5c0-4.6 2.4-8 5.5-8s5.5 3.4 5.5 8 M16.5 6a2.3 2.3 0 1 1 3.2 2.1c-.6.3-.9.8-.9 1.4v.5 M18.8 12.8h.01',
  // The quartermaster's cart: its crate and two wheels.
  quartermaster:
    'M2.5 5.5h13v9h-13z M2.5 5.5l13 9 M15.5 5.5l-13 9 M15.5 9h3.5l2.5 3v2.5h-6 M6.5 15a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z M17 15a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z',
  // A bell, and the drop of blood that rings it.
  bleeding_bell:
    'M12 2.5a.9.9 0 0 1 .9.9v.6A5.2 5.2 0 0 1 17.2 9v3.4l1.8 2.2H5l1.8-2.2V9a5.2 5.2 0 0 1 4.3-5v-.6a.9.9 0 0 1 .9-.9z M12 16.5c1.3 1.7 2 2.8 2 3.7a2 2 0 0 1-4 0c0-.9.7-2 2-3.7z',
  // A cracked mirror, and the Weaver in it.
  lost_weavers_echo:
    'M6.5 3h11v18h-11z M12 7a1.8 1.8 0 1 0 0 3.6A1.8 1.8 0 0 0 12 7z M9.5 16.5c0-2.2 1.1-3.8 2.5-3.8s2.5 1.6 2.5 3.8 M15 3l-1.6 3.4 2.1 1.6-1.4 2.8',
  // A tapestry on its rod, its threads hanging loose.
  unravelled_tapestry:
    'M3.5 4h17 M5.5 4v10.5h13V4 M8.5 7.5h7 M8.5 10.5h7 M8 14.5c0 2 1 3.2 0 6 M12 14.5c0 2-1 3.5 0 6 M16 14.5c0 1.5 1 2.5.5 4.5',
  // A clock face with no hands, on its stand.
  stopped_clock:
    'M12 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14z M12 5.5v1 M12 13.5v1 M7.5 10h1 M15.5 10h1 M12 17v3.5 M8.5 20.5h7 M12 10h.01',
  // ── Boons and banes ──
  // Steadied: a straight arrow rising from firm ground.
  steadied: 'M12 4v11.5 M7.5 8.5L12 4l4.5 4.5 M4.5 19.5h15 M8 16.5h8',
  // Faltering: a wavering line falling.
  faltering: 'M12 3.5c-2 2.5 2 4 0 6.5s2 4 0 6.5 M8 14.5l4 4 4-4 M4.5 21h15',
};

/**
 * The glyph key a content relic, boon or event draws with: its own fill glyph when it has one
 * (by id), else the `icon` its content names.
 */
export function glyphKey(def: { id: string; icon: string }): string {
  return FILL_GLYPHS[def.id] !== undefined ? def.id : def.icon;
}
