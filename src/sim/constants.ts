/** Simulation rate. Everything in the sim advances in whole ticks of SIM_DT seconds. */
export const SIM_HZ = 60;
export const SIM_DT = 1 / SIM_HZ;

/**
 * Bump whenever sim behaviour changes in a way that changes results for the same inputs.
 * Stamped into replays and golden hashes; update goldens deliberately (`npm run golden:update`).
 */
export const SIM_VERSION = 23;

/**
 * Rewind's memory (the Chronomancer, docs/phase-3e.md): one sample of each hero every 0.1 s of
 * sim time (6 ticks at normal speed; slow motion stretches it in ticks, not in sim time).
 */
export const PAST_SAMPLE_TICKS = 6;
export const PAST_SAMPLE_SECONDS = PAST_SAMPLE_TICKS / SIM_HZ;

/** How many samples cover `seconds` of a hero's past, both ends included. */
export function pastSamples(seconds: number): number {
  return seconds > 0 ? Math.round(seconds / PAST_SAMPLE_SECONDS) + 1 : 0;
}

/**
 * Solos (docs/solos.md): heroes fire their own. A full Solo waits `wait` seconds with someone to
 * fight, then fires; Kael holds his Aegis Wall for a big hit, but never longer than `kaelHold`
 * seconds. No hero starts a Solo within `gap` seconds of another hero's starting, so Solos that
 * come due together can be followed one at a time with the Thread. `tell` is how long before a
 * Solo is full the views (and the bots) treat it as coming: the tell is its last `tell` seconds
 * of charge plus the wait. Tuning levers: change them here and nowhere else.
 *
 * `lead` and `danger` are for whoever follows Solos with the Thread on a player's behalf (the
 * Skilled bot, Auto-Thread): the Thread goes to a hero `lead` seconds before their Solo is due,
 * and not while any hero is below `danger` of their life.
 *
 * The heroes' judgement (heroes.ts `soloFires`):
 * - `partyHit`: with the Thread on him, Kael raises his wall at once for a hit about to land on
 *   two or more of the party within this many seconds (his Cued wall is a dome over everyone);
 *   0 leaves it off;
 * - a hero finishes what they are casting before they begin their Solo (no number).
 * (Measured and left out, docs/solos.md: holding a Solo on a wave's last, nearly dead enemy, and
 * while its target cannot be hurt. Neither changed one fight in 780. A plain Solo no longer
 * roots its hero, so the hold that kept a rooting Solo out of a hit is gone too.)
 */
export const SOLOS = {
  wait: 1,
  kaelHold: 3,
  gap: 1,
  tell: 3,
  lead: 0.5,
  danger: 0.3,
  partyHit: 1.5,
} as const;

/**
 * The music's tempo, owned by the sim (docs/phase-5f.md, A Tempo): 88 BPM in four, so a bar is
 * 240 / 88 = 2.727… s of sim time, and downbeats fall at sim time 0, 1 bar, 2 bars… The audio's
 * `BPM` (src/audio/theory.ts) must equal `MUSIC_BPM`; the audio tests check it.
 */
export const MUSIC_BPM = 88;
export const BEATS_PER_BAR = 4;
export const BAR_SECONDS = (60 / MUSIC_BPM) * BEATS_PER_BAR;

/** Upper bound on any entity radius; used to size spatial queries. */
export const MAX_ENTITY_RADIUS = 1;

/** Half-size of the square covered by the spatial hash grid, in metres. */
export const WORLD_HALF_EXTENT = 32;

export const TUNING = {
  /** Hero steering acceleration (m/s²) and arrive slowdown radius (m). */
  heroAccel: 28,
  heroArriveRadius: 2.5,
  /** Formation error correction (1/s) on top of matching the Weaver's velocity. */
  formationGain: 3,
  /** Formation spread multiplier under the Scatter directive. */
  scatterSpread: 2.2,
  /** Dummy wander tuning. */
  dummyAccel: 12,
  dummySpeedMin: 2,
  dummySpeedMax: 4,
  dummyRadius: 0.45,
  /** Gap kept between bodies when resolving overlaps (m). */
  bodyGap: 0.15,
} as const;
