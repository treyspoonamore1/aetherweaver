/**
 * The run's route in words (docs/phase-5a.md, docs/phase-5c.md, docs/phase-5d.md): the Prelude
 * (Movement I alone, the first run) or an Expedition (every Movement in content: Movements I–III
 * and the Finale, to the Silent Conductor). Every Prelude string is the one it always was; an
 * Expedition's derive from its Movements (content `movements` and their labels,
 * `EXPEDITION_MOVEMENTS`, the route's `routeDefs`) and the map.
 */
import { CONTENT, encounterDef, movementDef, type Biome } from '../../content';
import { EXPEDITION_MOVEMENTS, inSentence, movementSpan, routeBoss } from '../../meta/profile';
import {
  findNode,
  isFinalNode,
  mapMovement as metaMapMovement,
  routeDefs,
  rowsOfMovement,
} from '../../meta/run';
import type { MapNode, RunState } from '../../meta/types';
import type { IconName } from '../kit/iconPaths';
import type { BackdropTone } from '../kit/backdropTone';

export type Route = 'prelude' | 'expedition';

/**
 * About how long a run of each route takes (Prep's Route toggle). The Expedition's is the Skilled
 * I-III Expedition as tools/pacing.ts models it (docs/phase-5c.md: 40.8 / 39.4 min).
 */
export const ROUTE_MINUTES: Readonly<Record<Route, number>> = { prelude: 15, expedition: 40 };

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

/**
 * "Movement II", or the Movement's own `label` when its def has one (docs/phase-5c.md, the
 * Finale hook: a Finale def reads 'The Finale', not 'Movement IV'). `movements`: content's.
 */
export function movementLabel(
  n: number,
  movements: readonly { readonly label?: string }[] = CONTENT.movements,
): string {
  return movements[n - 1]?.label ?? `Movement ${movementNumeral(n)}`;
}

/** Movement `n`'s content (Movement I for anything unknown). */
function movementOrFirst(n: number) {
  return CONTENT.movements[n - 1] ? movementDef(n) : movementDef(1);
}

/**
 * "Movement II · The Crimson Legion"; a labelled Movement named as its label ("The Finale · The
 * Celestial Crucible": its map's title, not its name twice).
 */
function movementTitle(n: number): string {
  const def = movementOrFirst(n);
  const label = movementLabel(n);
  return `${label} · ${label === def.name ? def.mapTitle : def.name}`;
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
    eyebrow: `${movementTitle(m)} · step ${step} of ${of}`,
    title: def.mapTitle,
    movement: m,
  };
}

/**
 * The one-time card on first reaching a Movement past the first: "Movement II · The Crimson
 * Legion", and its stops ("1 stop" for the Finale). `movements`: the run's route, whose road may
 * shorten the Movement (docs/phase-5d.md); absent, the Movement as content has it.
 */
export function movementCard(n: number, movements?: number): { title: string; text: string } {
  const def = movementOrFirst(n);
  const played = movements !== undefined ? routeDefs(movements)[n - 1] : undefined;
  const rows = (played ?? def).rows.length;
  return {
    title: movementTitle(n),
    text: `${def.mapTitle}: ${rows} ${rows === 1 ? 'stop' : 'stops'} to ${encounterDef(def.boss).name}.`,
  };
}

// ── Biomes on the map (docs/phase-5c.md) ─────────────────────────────────────────────

/** Each biome's map backdrop (undefined: the default navy, the Reliquary's). */
const BIOME_TONE: Readonly<Record<Biome, BackdropTone | undefined>> = {
  reliquary: undefined,
  crimson_spire: 'crimson',
  abyssal_rift: 'abyss',
  celestial_crucible: 'crucible',
};

/** Each biome as a place, mid-sentence ("the Abyssal Rift"), as the meta's Vharun node says it. */
const BIOME_PLACE: Readonly<Record<Biome, string>> = {
  reliquary: 'the Reliquary',
  crimson_spire: 'the Crimson Spire',
  abyssal_rift: 'the Abyssal Rift',
  celestial_crucible: 'the Celestial Crucible',
};

/** Movement `n`'s biome as a place, mid-sentence: "the Abyssal Rift". */
export function movementPlace(n: number): string {
  return BIOME_PLACE[movementOrFirst(n).biome];
}

/** A Movement's biome's backdrop tone (the map's, its card's). */
export function biomeTone(biome: Biome | undefined): BackdropTone | undefined {
  return biome ? BIOME_TONE[biome] : undefined;
}

/** How a Movement's title card looks: its eyebrow's colour, its title's glow, its button. */
export interface MovementCardLook {
  /** The eyebrow's Tailwind text class. */
  eyebrow: string;
  /** The title's text shadow. */
  glow: string;
  /** The button's words: climb the Spire, descend into the Rift. */
  button: string;
}

const CARD_LOOK: Readonly<Record<Biome, MovementCardLook>> = {
  reliquary: {
    eyebrow: 'text-gold-200/80',
    glow: '0 0 36px rgb(245 184 61 / 0.45), 0 3px 0 rgb(0 0 0 / 0.55)',
    button: 'Climb on',
  },
  crimson_spire: {
    eyebrow: 'text-rose-200/80',
    glow: '0 0 36px rgb(168 46 52 / 0.6), 0 3px 0 rgb(0 0 0 / 0.55)',
    button: 'Climb on',
  },
  abyssal_rift: {
    eyebrow: 'text-indigo-200/80',
    glow: '0 0 36px rgb(76 70 170 / 0.65), 0 3px 0 rgb(0 0 0 / 0.55)',
    button: 'Descend',
  },
  // The Finale (docs/phase-5d.md): a placeholder W8 styles.
  celestial_crucible: {
    eyebrow: 'text-slate-100/80',
    glow: '0 0 36px rgb(226 232 255 / 0.5), 0 3px 0 rgb(0 0 0 / 0.55)',
    button: 'Ascend',
  },
};

/** Movement `n`'s title card, styled by its biome. */
export function movementCardLook(n: number): MovementCardLook {
  return CARD_LOOK[movementOrFirst(n).biome] ?? CARD_LOOK.crimson_spire;
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

/**
 * Prep's eyebrow: "The Prelude · Movement I" / "The Expedition · Movements I–II" / "The Expedition
 * · Movements I–III and the Finale".
 */
export function prepEyebrow(run: Partial<Pick<RunState, 'movements'>>): string {
  const n = run.movements ?? 1;
  if (n < 2) return 'The Prelude · Movement I';
  return `The Expedition · ${movementSpan(1, n)}`;
}

/**
 * The Title's eyebrow: the Prelude's, or the Expedition's once it's the route ("Movements I–III
 * and the Finale · The Expedition" now).
 */
export function titleEyebrow(expedition: boolean, movements = EXPEDITION_MOVEMENTS): string {
  return expedition
    ? `${movementSpan(1, Math.max(2, movements))} · The Expedition`
    : 'Movement I · The Prelude';
}

/**
 * Prep's Route line: where an Expedition goes after the Prelude's Movement I. "into Movement II"
 * with two Movements, "through Movements II–III" with three, "through Movements II–III and the
 * Finale" with the Finale.
 */
export function expeditionOnward(movements = EXPEDITION_MOVEMENTS): string {
  const n = Math.max(2, movements);
  return n === 2 ? 'into Movement II' : `through ${movementSpan(2, n)}`;
}

/**
 * How many Movements Prep's Route copy names: the run's own when it is an Expedition (a save keeps
 * the length it was made with), else what an Expedition plays now (EXPEDITION_MOVEMENTS).
 */
export function expeditionLength(run: Partial<Pick<RunState, 'movements'>>): number {
  const n = run.movements ?? 1;
  return n >= 2 ? n : EXPEDITION_MOVEMENTS;
}

/** The Route toggle's options: "Prelude · ~15 min", "Expedition · ~40 min". */
export function routeOptions(): { value: Route; label: string }[] {
  return [
    { value: 'prelude', label: `Prelude · ~${ROUTE_MINUTES.prelude} min` },
    { value: 'expedition', label: `Expedition · ~${ROUTE_MINUTES.expedition} min` },
  ];
}

/**
 * The Route toggle's hint: what the chosen route plays. The Prelude's as it always was; an
 * Expedition's names every Movement it plays, "Movements I–III and the Finale, to the Silent
 * Conductor." ("Movements I–III, to the Unweaver." with three; with two, as it was: "Movement I,
 * then Movement II (…), to …").
 */
export function routeHint(route: Route, movements = EXPEDITION_MOVEMENTS): string {
  if (route === 'prelude') return `Movement I alone, to ${encounterDef(movementDef(1).boss).name}.`;
  const n = Math.max(2, Math.min(CONTENT.movements.length, movements));
  const last = CONTENT.movements[n - 1]!;
  const boss = encounterDef(last.boss).name;
  if (n === 2) return `Movement I, then ${movementLabel(n)} (${last.name}), to ${boss}.`;
  return `${movementSpan(1, n)}, to ${routeBoss(n)}.`;
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
  the_unweaver: 'The Unweaver falls, and the Rift knits shut.',
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
    const def = movementOrFirst(m);
    // A labelled Movement mid-sentence: "lost in the Finale, in the Celestial Crucible".
    const where = def.label
      ? `${inSentence(def.label)}, in ${movementPlace(m)}`
      : `${movementLabel(m)}, ${inSentence(def.name)}`;
    return `The party is lost in ${where}, but every note you wove is on record.`;
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

/**
 * The Deeds a player who has sighted these enemies can see (later Movements' wait). A hero's Deed
 * (In the Red, docs/phase-5b.md) shows only once that hero is in `roster`; without a roster,
 * none does, so the list is what it was before the roster.
 */
export function deedsInSight(
  seen?: readonly string[],
  roster?: readonly string[],
): typeof CONTENT.deeds {
  const reach = sightedMovement(seen);
  return CONTENT.deeds.filter(
    (d) =>
      deedMovement(d) <= reach && (d.hero === undefined || (roster?.includes(d.hero) ?? false)),
  );
}

// ── The map's Movement card and glyphs ──────────────────────────────────────────────

/**
 * Stops whose encounter has a glyph of its own: the Gorehound Matriarch's paw, Vharun's crown, the
 * Seamstress's needle, the Unweaver's shears. Every other stop draws its kind's (null).
 */
const ENCOUNTER_ICON: Readonly<Record<string, IconName>> = {
  gorehound_matriarch: 'paw',
  vharun: 'crown',
  // Movement III (docs/phase-5c.md): the Seamstress's needle, the Unweaver's shears.
  the_seamstress: 'needle',
  the_unweaver: 'scissors',
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
