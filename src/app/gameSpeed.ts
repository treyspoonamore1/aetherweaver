/**
 * Game speed (docs/phase-7.md, decision 15 and ground rule 3): how fast the runtime's real-time
 * clock runs, 0.7-1. It scales only `elapsed` before `stepper.advance` (`src/app/runtime.ts`),
 * never `SIM_DT` or `world.timeScale`: a fight played slowly has the same ticks and commands as one
 * played at full speed.
 *
 * Settings → Assists → Game speed (`aids.gameSpeed`, absent: 1). Called once a frame: `optionsOf`
 * keeps its answer for the settings object in force, so this allocates nothing.
 */
import { optionsOf, useSettings } from './settings';

export function gameSpeed(): number {
  return optionsOf(useSettings.getState().settings).aids.gameSpeed;
}
