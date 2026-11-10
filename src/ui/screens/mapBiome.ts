/**
 * The Map's music (docs/phase-5a.md): the Map voices its Movement's biome, the Movement of the
 * next stop (the meta's `mapMovement`), so an Expedition's map is the Crimson Spire's from the
 * moment the Cantor falls, and any Prelude's map (even one right after an Expedition) is the
 * Sunlit Reliquary's. `setBiome` only records the voicing, so calling it again is harmless.
 */
import { getAudio } from '../../audio';
import { movementDef } from '../../content';
import { mapMovement, runMovementDef } from '../../meta/run';
import type { RunState } from '../../meta/types';

type MapRun = Pick<RunState, 'map' | 'path'> & Partial<Pick<RunState, 'movements' | 'echo'>>;

/** The biome the map of this run is voiced in. */
export function mapBiome(run: MapRun): ReturnType<typeof movementDef>['biome'] {
  // Phase 6: an Echo's leg is voiced as the Movement it is built over (`runMovementDef`).
  if (run.echo !== undefined)
    return runMovementDef(
      { movements: run.movements ?? 1, echo: run.echo },
      mapMovement(run as RunState),
    ).biome;
  return movementDef(mapMovement(run as RunState)).biome;
}

/** Voices the map's biome (audio is garnish: it never throws). */
export function voiceMapBiome(run: MapRun): void {
  try {
    getAudio().setBiome?.(mapBiome(run));
  } catch {
    // Silent.
  }
}
