/**
 * The Atlas station's actions (docs/phase-6.md, "Design: the Atlas of Echoes", "Design: the
 * weekly seed"): the one place the station's buttons reach the stores. Each is a function the run
 * and profile stores will answer; until they do, each says it can't yet (`false`), and the lab and
 * tests set their own with `setAtlasActions`.
 *
 * What the stores must satisfy:
 * - `beginEcho(echoId)`: a new Echo run in Prep (its seed new each attempt, its twists applied),
 *   replacing no saved run without the caller's confirm; true once the run is in Prep.
 * - `beginWeekly()`: this week's run in Prep, built from the week alone; true once in Prep.
 * - `shareWeekly(code)`: copies the share line and saves the replay file; true when done.
 * - `addCode(text, name)`: adds a friend's code to this week's board (claimed until a replay
 *   checks it); the refusal's words if the code can't be read or is for another week, else null.
 * - `openReplay(file, code)`: verifies a replay file (with its code, if typed), in the
 *   background; resolves when it is under way (progress and the result come back through the
 *   weekly panel's input).
 */
import { t } from '../text';

export interface AtlasActions {
  beginEcho(echoId: string): boolean;
  beginWeekly(): boolean;
  shareWeekly(code: string): boolean;
  addCode(text: string, name: string | null): string | null;
  openReplay(file: File | Blob, code: string | null): void;
}

/** Until the stores answer: nothing starts, nothing is shared. */
export const NO_ATLAS_ACTIONS: AtlasActions = {
  beginEcho: () => false,
  beginWeekly: () => false,
  shareWeekly: () => false,
  addCode: () => t('screens.atlasActions.addingACodeIsn'),
  openReplay: () => {},
};

let actions: AtlasActions = NO_ATLAS_ACTIONS;

/** The actions the station calls now. */
export function atlasActions(): AtlasActions {
  return actions;
}

/** Sets them (the stores' wiring, the lab, tests); partial: the rest stay as they are. */
export function setAtlasActions(next: Partial<AtlasActions>): void {
  actions = { ...actions, ...next };
}

/** Back to `NO_ATLAS_ACTIONS` (tests). */
export function resetAtlasActions(): void {
  actions = NO_ATLAS_ACTIONS;
}

/** Begin on an Echo card: the one call it makes. */
export function beginEcho(echoId: string): boolean {
  return actions.beginEcho(echoId);
}
