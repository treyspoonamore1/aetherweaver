/**
 * Prep's Route toggle (docs/phase-5a.md), wired to the stores: shown once Expeditions are open
 * (Rank 2, or Skip the unlocks), and switching it changes the run in Prep through the run store's
 * `setRunMode`, which keeps its Calling and Chords (and the profile remembers the choice). Null:
 * no toggle.
 */
import { useProfile } from '../../app/profileStore';
import { useRun } from '../../app/runStore';
import type { Route } from './routeText';

export function prepRoute(): { onChange(route: Route): void } | null {
  if (!useProfile.getState().expeditionOpen()) return null;
  return { onChange: (route) => useRun.getState().setRunMode(route) };
}
