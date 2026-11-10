/**
 * Game speed (docs/phase-7.md, decision 15 and ground rule 3): how fast the runtime's real-time
 * clock runs, 0.7-1. It scales only `elapsed` before `stepper.advance` (`src/app/runtime.ts`),
 * never `SIM_DT` or `world.timeScale`: a fight played slowly has the same ticks and commands as one
 * played at full speed.
 *
 * Settings → Assists → Game speed (`aids.gameSpeed`, absent: 1). Called once a frame: `optionsOf`
 * keeps its answer for the settings object in force, so this allocates nothing.
 *
 * Also the run's `assisted` mark (decision 16), which game speed under 100% sets.
 */
import type { RunState } from '../meta/types';
import { DEFAULT_SETTINGS, optionsOf, useSettings, type Settings } from './settings';

/** How fast the runtime's clock runs now (1 = full speed). */
export function gameSpeed(): number {
  return optionsOf(useSettings.getState().settings).aids.gameSpeed;
}

/**
 * Whether a fight played now uses an assist (decision 16): one of the three in `assists` away from
 * its default, game speed under 100%, or Auto-Thread on. The run records it (`withAssisted`).
 */
export function assistsInUse(settings: Settings): boolean {
  const a = settings.assists;
  const d = DEFAULT_SETTINGS.assists;
  const aids = optionsOf(settings).aids;
  return (
    a.autonomy !== d.autonomy ||
    a.perfectWindowBonus !== d.perfectWindowBonus ||
    a.telegraphLead !== d.telegraphLead ||
    aids.gameSpeed < 1 ||
    aids.autoThread
  );
}

/**
 * The run, marked `assisted` once a fight in it used an assist (decision 16: the Summary's badge
 * reads it; the run layer never does). The same object when nothing changes: the key stays absent
 * until it is true, so a run played without assists saves exactly as before.
 */
export function withAssisted(run: RunState, settings: Settings): RunState {
  if (run.assisted || !assistsInUse(settings)) return run;
  return { ...run, assisted: true };
}
