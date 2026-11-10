/**
 * Game speed (docs/phase-7.md, decision 15 and ground rule 3): how fast the runtime's real-time
 * clock runs, 0.7-1. It scales only `elapsed` before `stepper.advance` (`src/app/runtime.ts`),
 * never `SIM_DT` or `world.timeScale`: a fight played slowly has the same ticks and commands as one
 * played at full speed.
 *
 * W0 places the call and returns 1 (multiplying by 1 changes nothing); W2 writes the body (from
 * `optionsOf(settings).aids.gameSpeed`). Called once a frame: it must not allocate.
 */
export function gameSpeed(): number {
  return 1;
}
