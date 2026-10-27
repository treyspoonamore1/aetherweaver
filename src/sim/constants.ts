/** Simulation rate. Everything in the sim advances in whole ticks of SIM_DT seconds. */
export const SIM_HZ = 60;
export const SIM_DT = 1 / SIM_HZ;

/**
 * Bump whenever sim behaviour changes in a way that changes results for the same inputs.
 * Stamped into replays and golden hashes; update goldens deliberately (`npm run golden:update`).
 */
export const SIM_VERSION = 10;

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
