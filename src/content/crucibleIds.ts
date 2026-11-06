/**
 * Every id and constant of the Finale (docs/phase-5d.md), in one place so no workstream guesses
 * a string. Content (crucible.ts, crucibleRun.ts), the sim's Conductor script, bots, harness,
 * render, audio and UI all import from here. Plain constants: this file imports nothing.
 */

/** The Finale's number among the Movements (its enemies, encounter and relics carry it). */
export const FINALE_MOVEMENT = 4;
/** The FINALE movement def's id. */
export const FINALE_ID = 'the_finale';

// ── The boss and its mirror-choir ─────────────────────────────────────────────────────

/** The Silent Conductor: the enemy and its encounter share this id. */
export const CONDUCTOR = 'the_silent_conductor';
export const ALTO = 'mirror_alto';
export const BASS = 'mirror_bass';
export const TENOR = 'mirror_tenor';
export const SOPRANO = 'mirror_soprano';
/** The four voices in the order a phase-2 Raise brings the missing ones. */
export const CHOIR = [TENOR, SOPRANO, ALTO, BASS] as const;

// ── The Conductor's attacks ───────────────────────────────────────────────────────────

export const DOWNBEAT = 'conductor_downbeat';
export const SFORZANDO = 'conductor_sforzando';
export const CUE = 'conductor_cue';
export const RAISE = 'conductor_raise';
/** Fortissimo Silence: three raid pulses, a P7 follow-up chain. */
export const FORTISSIMO = [
  'fortissimo_silence',
  'fortissimo_silence_2',
  'fortissimo_silence_3',
] as const;
export const GRAND_SILENCE = 'grand_silence';

// ── The Grand Silence's program ───────────────────────────────────────────────────────

export const REST = 'silence_rest';
export const MEASURE = 'silence_measure';
/** The Final Cadence (even cycles, lethal from full). */
export const FINAL_CADENCE = 'silence_cadence';
/** The Half Cadence (odd cycles). */
export const HALF_CADENCE = 'silence_half_cadence';

// ── The voices' Solos ─────────────────────────────────────────────────────────────────

export const LAMENT = 'alto_lament';
export const BASSO_OSTINATO = 'bass_ostinato';
export const CADENZA = 'tenor_cadenza';
export const SHATTER_ARIA = 'soprano_aria';
/** Each voice's Solo, by voice. */
export const SOLOS: Readonly<Record<string, string>> = {
  [ALTO]: LAMENT,
  [BASS]: BASSO_OSTINATO,
  [TENOR]: CADENZA,
  [SOPRANO]: SHATTER_ARIA,
};

// ── Arena, encounter, relics, Deeds ───────────────────────────────────────────────────

export const CRUCIBLE_ARENA = 'the_crucible';
export const CONDUCTOR_ENCOUNTER = CONDUCTOR;
export const TACET_MARK = 'tacet_mark';
export const QUICK_ROSIN = 'quick_rosin';
export const FIRST_SCORE = 'first_score';
/** The badge Deed for beating the Silent Conductor: the first Finale clear's record. */
export const SONG_GOES_ON = 'song_goes_on';
/** The badge Deed for beating it with no hero down. */
export const NOT_ONE_SILENT = 'not_one_silent';

// ── Numbers ───────────────────────────────────────────────────────────────────────────

/** Notes that rebuild the song and reignite the heroes. */
export const NOTES_NEEDED = 8;
/** The Grand Silence's cap at default assists (s): then the Coda. */
export const SILENCE_CAP = 50;
/** Discord's top: Fortissimo Silence. */
export const DISCORD_MAX = 100;
/** Discord's floor at phase 2's entry. */
export const DISCORD_P2_FLOOR = 70;
/** Reignite stands every downed hero back up at this fraction of max life. */
export const REVIVE_PCT = 0.3;
