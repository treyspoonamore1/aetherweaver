/**
 * Runs the "without you" re-run off the main thread (docs/phase-2.md). The sim is pure and
 * deterministic, so the worker's answer is exactly what Node would compute.
 */
import { runWithoutYou, type SimConfig } from '../sim';

self.onmessage = (event: MessageEvent<SimConfig>) => {
  self.postMessage(runWithoutYou(event.data));
};
