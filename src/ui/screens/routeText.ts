/**
 * The run's route in words (docs/phase-5a.md): the Prelude (Movement I alone, the first run) or
 * an Expedition (Movement I, then Movement II). Every Prelude string is the one it always was;
 * an Expedition's derive from its Movements (content `movements`) and the map.
 */
import { CONTENT, encounterDef, movementDef } from '../../content';
import {
  findNode,
  isFinalNode,
  mapMovement as metaMapMovement,
  rowsOfMovement,
} from '../../meta/run';
import type { MapNode, RunState } from '../../meta/types';
import type { IconName } from '../kit/iconPaths';

export type Route = 'prelude' | 'expedition';

/** About how long a run of each route takes (Prep's Route toggle). */
export const ROUTE_MINUTES: Readonly<Record<Route, number>> = { prelude: 15, expedition: 30 };

/** The run's route: more than one Movement is an Expedition (saves from before load as 1). */
export function routeOf(run: Partial<Pick<RunState, 'movements'>>): Route {
  return (run.movements ?? 1) >= 2 ? 'expedition' : 'prelude';
}

/** "The Prelude" / "The Expedition". */
export function routeName(run: Partial<Pick<RunState, 'movements'>>): string {
  return routeOf(run) === 'expedition' ? 'The Expedition' : 'The Prelude';
}

const NUMERALS = ['I', 'II', 'III', 'IV', 'V'];

/** 1 → "I", 2 → "II". */
export function movementNumeral(n: number): string {
  return NUMERALS[n - 1] ?? String(n);
}

/** "Movement II". */
export function movementLabel(n: number): string {
  return `Movement ${movementNumeral(n)}`;
}

/** Movement `n`'s content (Movement I for anything unknown). */
function movementOrFirst(n: number) {
  return CONTENT.movements[n - 1] ? movementDef(n) : movementDef(1);
}

type MapRun = Pick<RunState, 'map' | 'path'>;

/**
 * The Movement the map is in: the next reachable stop's, not the last one's (after the Cantor,
 * an Expedition is already climbing Movement II). The meta's rule (`mapMovement`); it reads only
 * the map and the path.
 */
export function mapMovement(run: MapRun): number {
  return metaMapMovement(run as RunState);
}

/** Movement `n`'s rows, in map order (the meta's `rowsOfMovement`). */
export function movementRows(run: Pick<RunState, 'map'>, n: number): MapNode[][] {
  return rowsOfMovement(run.map, n);
}

/** The stop the run is on in Movement `n` ("step k of N"): its stops walked, plus the next. */
export function movementStep(run: MapRun, n: number): { step: number; of: number } {
  const of = movementRows(run, n).length;
  const walked = run.path.filter((id) => (findNode(run as RunState, id)?.movement ?? 1) === n);
  return { step: Math.min(walked.length + 1, of), of };
}

/** The map's eyebrow and title: the Prelude's as ever; an Expedition's names the Movement. */
export function mapHeader(run: MapRun & Partial<Pick<RunState, 'movements'>>): {
  eyebrow: string;
  title: string;
  movement: number;
} {
  const m = mapMovement(run);
  const def = movementOrFirst(m);
  const { step, of } = movementStep(run, m);
  if (routeOf(run) === 'prelude')
    return {
      eyebrow: `The Prelude · Movement I · step ${step} of ${of}`,
      title: def.mapTitle,
      movement: m,
    };
  return {
    eyebrow: `${movementLabel(m)} · ${def.name} · step ${step} of ${of}`,
    title: def.mapTitle,
    movement: m,
  };
}

/** The one-time card on first reaching a Movement past the first: "Movement II · The Crimson Legion". */
export function movementCard(n: number): { title: string; text: string } {
  const def = movementOrFirst(n);
  const rows = def.rows.length;
  return {
    title: `${movementLabel(n)} · ${def.name}`,
    text: `${def.mapTitle}: ${rows} stops to ${encounterDef(def.boss).name}.`,
  };
}

/** The combat HUD's line: "The Prelude · node 3 of 10", or "Movement II · node 2 of 7". */
export function combatSubtitle(
  run: Pick<RunState, 'map' | 'path' | 'pending' | 'movements'>,
): string {
  if (routeOf(run) === 'prelude')
    return `The Prelude · node ${run.path.length} of ${run.map.rows.length}`;
  const node = run.pending ? findNode(run as RunState, run.pending) : undefined;
  const m = node?.movement ?? 1;
  const of = movementRows(run, m).length;
  const done = run.path.filter((id) => (findNode(run as RunState, id)?.movement ?? 1) === m);
  return `${movementLabel(m)} · node ${Math.min(Math.max(done.length, 1), of)} of ${of}`;
}

/** Prep's eyebrow: "The Prelude · Movement I" / "The Expedition · Movements I–II". */
export function prepEyebrow(run: Partial<Pick<RunState, 'movements'>>): string {
  const n = run.movements ?? 1;
  if (n < 2) return 'The Prelude · Movement I';
  return `The Expedition · Movements I–${movementNumeral(n)}`;
}

/** The Title's eyebrow: the Prelude's, or the Expedition's once it's the route. */
export function titleEyebrow(expedition: boolean): string {
  return expedition ? 'Movements I–II · The Expedition' : 'Movement I · The Prelude';
}

/** The Route toggle's options: "Prelude · ~15 min", "Expedition · ~30 min". */
export function routeOptions(): { value: Route; label: string }[] {
  return [
    { value: 'prelude', label: `Prelude · ~${ROUTE_MINUTES.prelude} min` },
    { value: 'expedition', label: `Expedition · ~${ROUTE_MINUTES.expedition} min` },
  ];
}

/** The Route toggle's hint: what the chosen route plays. */
export function routeHint(route: Route): string {
  if (route === 'prelude') return `Movement I alone, to ${encounterDef(movementDef(1).boss).name}.`;
  const last = CONTENT.movements[CONTENT.movements.length - 1]!;
  return `Movement I, then ${movementLabel(CONTENT.movements.length)} (${last.name}), to ${encounterDef(last.boss).name}.`;
}

/** "The Prelude ends here…" (the abandon dialogs; `straight`: the pause menu's wording). */
export function abandonLine(run: Partial<Pick<RunState, 'movements'>>, straight = false): string {
  return `${routeName(run)} ends here and you go ${straight ? 'straight ' : ''}to the summary. This cannot be undone.`;
}

/** The run's final stop: a boss with nothing after it (the Prelude's Cantor, an Expedition's last boss). */
export function finalEncounter(run: Pick<RunState, 'map'>): string | null {
  for (const row of run.map.rows)
    for (const node of row) if (isFinalNode(node)) return node.encounterId;
  return null;
}

/** The Movement the run reached: its last stop's (1 before the first step). */
export function movementReached(run: MapRun): number {
  let reached = 1;
  for (const id of run.path)
    reached = Math.max(reached, findNode(run as RunState, id)?.movement ?? 1);
  return reached;
}

const VICTORY: Readonly<Record<string, string>> = {
  hollow_cantor: 'The Hollow Cantor falls and the Reliquary sings again.',
  vharun: 'Vharun falls, and the Spire’s banners burn.',
};

/** The Summary's line under its title: a win names the final boss; a defeat, the Movement reached. */
export function outcomeSub(
  run: Pick<RunState, 'map' | 'path' | 'outcome'> & Partial<Pick<RunState, 'movements'>>,
): string | null {
  if (run.outcome === 'victory') {
    const id = finalEncounter(run) ?? 'hollow_cantor';
    return VICTORY[id] ?? `${encounterDef(id).name} falls.`;
  }
  if (run.outcome === 'defeat' && routeOf(run) === 'expedition') {
    const m = movementReached(run);
    return `The party is lost in ${movementLabel(m)}, ${movementOrFirst(m).name.replace(/^The /, 'the ')}, but every note you wove is on record.`;
  }
  return null;
}

/** The Summary's eyebrow: "The Prelude · summary" / "The Expedition · summary". */
export function summaryEyebrow(run: Partial<Pick<RunState, 'movements'>>): string {
  return `${routeName(run)} · summary`;
}

/** "Continue · step 4 of 10" (the Loom's Gate); an Expedition's names its Movement. */
export function gateStep(run: MapRun & Partial<Pick<RunState, 'movements'>>): string {
  if (routeOf(run) === 'prelude') {
    const steps = run.map.rows.length;
    return `step ${Math.min(run.path.length + 1, steps)} of ${steps}`;
  }
  const m = mapMovement(run);
  const { step, of } = movementStep(run, m);
  return `${movementLabel(m)} · step ${step} of ${of}`;
}

// ── What the player has met (Codex, Loom): `profile.seen` ────────────────────────────

/** An enemy's Movement (content `movement`, 1 when absent). */
export function enemyMovement(defId: string): number {
  return CONTENT.enemies.find((e) => e.id === defId)?.movement ?? 1;
}

/**
 * The furthest Movement whose enemies the player has sighted (`profile.seen`, seeded with every
 * Movement I enemy). Omitted: every Movement (the labs, the Codex's defaults).
 */
export function sightedMovement(seen?: readonly string[]): number {
  if (!seen) return CONTENT.movements.length;
  return Math.max(1, ...seen.map(enemyMovement));
}

/** A Deed's Movement: its fight's (1 for any other Deed). */
export function deedMovement(d: { encounter?: string }): number {
  if (!d.encounter) return 1;
  return CONTENT.encounters.find((e) => e.id === d.encounter)?.movement ?? 1;
}

/** The Deeds a player who has sighted these enemies can see (later Movements' wait). */
export function deedsInSight(seen?: readonly string[]): typeof CONTENT.deeds {
  const reach = sightedMovement(seen);
  return CONTENT.deeds.filter((d) => deedMovement(d) <= reach);
}

// ── The map's Movement card and glyphs ──────────────────────────────────────────────

/**
 * Stops whose encounter has a glyph of its own: the Gorehound Matriarch's paw, Vharun's crown.
 * Every other stop draws its kind's (null).
 */
const ENCOUNTER_ICON: Readonly<Record<string, IconName>> = {
  gorehound_matriarch: 'paw',
  vharun: 'crown',
};

export function encounterIcon(encounterId: string | null): IconName | null {
  return (encounterId && ENCOUNTER_ICON[encounterId]) || null;
}

const CARD_KEY = 'aetherweaver.movementCard.v1';

/** Has this run's card for Movement `n` been shown (once a run, on reaching it)? */
function cardShown(seed: number, n: number): boolean {
  try {
    const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(CARD_KEY);
    return raw === `${seed}:${n}`;
  } catch {
    return false;
  }
}

/** The run's card for Movement `n` was shown. */
export function markCardShown(seed: number, n: number): void {
  try {
    localStorage.setItem(CARD_KEY, `${seed}:${n}`);
  } catch {
    // Private mode: it may show again.
  }
}

/**
 * The one-time card on first reaching a later Movement (docs/phase-5a.md): only on its map, before
 * its first stop is walked, and once a run.
 */
export function wantsMovementCard(run: MapRun & Pick<RunState, 'seed'>, movement: number): boolean {
  return movement >= 2 && movementStep(run, movement).step === 1 && !cardShown(run.seed, movement);
}
