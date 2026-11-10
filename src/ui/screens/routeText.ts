/**
 * The run's route in words (docs/phase-5a.md, docs/phase-5c.md, docs/phase-5d.md): the Prelude
 * (Movement I alone, the first run) or an Expedition (every Movement in content: Movements I–III
 * and the Finale, to the Silent Conductor). Every Prelude string is the one it always was; an
 * Expedition's derive from its Movements (content `movements` and their labels,
 * `EXPEDITION_MOVEMENTS`, the route's `routeDefs`) and the map.
 */
import { CONTENT, encounterDef, movementDef, type Biome, type DeedDef } from '../../content';
import { EXPEDITION_MOVEMENTS, inSentence, movementSpan, routeBoss } from '../../meta/profile';
import {
  findNode,
  isFinalNode,
  mapMovement as metaMapMovement,
  routeDefs,
  rowsOfMovement,
  runMovementDef,
} from '../../meta/run';
import type { MapNode, RunState } from '../../meta/types';
import type { IconName } from '../kit/iconPaths';
import type { BackdropTone } from '../kit/backdropTone';

export type Route = 'prelude' | 'expedition';

/**
 * About how long a run of each route takes (Prep's Route toggle). The Expedition's is the Skilled
 * Finale-route Expedition as tools/pacing.ts models it, losses included (docs/phase-5d.md,
 * "Pacing": 39.6 / 39.4 min on bases 9001 / 77003, rounded; the winning-run median is 43.2 /
 * 43.7). It was the I-III Expedition's 40.8 / 39.4 min (docs/phase-5c.md).
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

/** Movement `n`'s label mid-sentence: "for the Finale", "Met in Movement II" (docs/phase-5d.md). */
export function movementInSentence(n: number): string {
  return inSentence(movementLabel(n));
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

// ── Phase 6: an Echo's legs (docs/phase-6.md) ────────────────────────────────────────

/** The Echo a run plays, by content's name (null: no Echo, or one content lost). */
export function echoName(run: Partial<Pick<RunState, 'echo'>>): string | null {
  if (run.echo === undefined) return null;
  return CONTENT.echoes.find((e) => e.id === run.echo)?.name ?? run.echo;
}

/** How many legs an Echo run has (its map's Movements). */
function legCount(run: Partial<Pick<RunState, 'echo' | 'movements'>>): number {
  return CONTENT.echoes.find((e) => e.id === run.echo)?.legs.length ?? run.movements ?? 1;
}

/** "Retrograde · leg 2 of 3", or the Echo's name alone for an Echo of one leg. */
function echoLegLabel(run: Partial<Pick<RunState, 'echo' | 'movements'>>, n: number): string {
  const legs = legCount(run);
  return legs > 1 ? `${echoName(run)} · leg ${n} of ${legs}` : echoName(run)!;
}

/**
 * The def the run's Movement (an Echo's leg) `n` plays: its biome, title and road (the meta's
 * `runMovementDef`; on an Echo, `node.movement` counts legs, not content's Movements).
 */
export function runMovementOf(
  run: Partial<Pick<RunState, 'echo' | 'movements'>>,
  n: number,
): ReturnType<typeof movementDef> {
  if (run.echo === undefined) return movementOrFirst(n);
  return runMovementDef({ movements: run.movements ?? 1, echo: run.echo }, n);
}

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
export function mapHeader(run: MapRun & Partial<Pick<RunState, 'movements' | 'echo'>>): {
  eyebrow: string;
  title: string;
  movement: number;
} {
  const m = mapMovement(run);
  const def = movementOrFirst(m);
  const { step, of } = movementStep(run, m);
  // Phase 6: an Echo names itself and its leg; the title is the road the leg is built over.
  if (run.echo !== undefined)
    return {
      eyebrow: `${echoLegLabel(run, m)} · step ${step} of ${of}`,
      title: runMovementOf(run, m).mapTitle,
      movement: m,
    };
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
 * Legion", and its stops ("1 stop to the Silent Conductor" for the Finale). `movements`: the
 * run's route, whose road may shorten the Movement (docs/phase-5d.md); absent, the Movement as
 * content has it. A labelled Movement (the Finale) names its boss mid-sentence, as the doc
 * writes it; the numbered Movements' cards keep their words ("to The Unweaver", pinned by
 * tests/meta/expedition3Pin.test.ts).
 */
export function movementCard(n: number, movements?: number): { title: string; text: string } {
  const def = movementOrFirst(n);
  const played = movements !== undefined ? routeDefs(movements)[n - 1] : undefined;
  const rows = (played ?? def).rows.length;
  const boss = encounterDef(def.boss).name;
  return {
    title: movementTitle(n),
    text: `${def.mapTitle}: ${rows} ${rows === 1 ? 'stop' : 'stops'} to ${def.label ? inSentence(boss) : boss}.`,
  };
}

/**
 * A Movement card's narrative line, above its stops (null: none, every Movement before the
 * Finale, whose cards keep their words). The Crucible's: docs/phase-5d.md "Narrative beat and
 * ending".
 */
const MOVEMENT_LORE: Readonly<Partial<Record<Biome, string>>> = {
  celestial_crucible: 'Above the Rift the sky rings like a struck bell. Someone is conducting it.',
};

/** Movement `n`'s narrative line on its card, or null. */
export function movementLore(n: number): string | null {
  return MOVEMENT_LORE[movementOrFirst(n).biome] ?? null;
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
  // The Finale (docs/phase-5d.md): white-gold, the rings in the sky; you climb out of the Rift.
  celestial_crucible: {
    eyebrow: 'text-amber-50/85',
    glow: '0 0 40px rgb(255 246 224 / 0.55), 0 0 12px rgb(245 215 142 / 0.4), 0 3px 0 rgb(0 0 0 / 0.6)',
    button: 'Ascend',
  },
};

/** Movement `n`'s title card, styled by its biome. */
export function movementCardLook(n: number): MovementCardLook {
  return CARD_LOOK[movementOrFirst(n).biome] ?? CARD_LOOK.crimson_spire;
}

/**
 * A run's card for its Movement (an Echo's leg) `n`: the Movement's card, or on an Echo its leg
 * ("Retrograde · leg 2 of 3"), the road the leg is built over and its stops to the leg's boss,
 * with that road's look and narrative line.
 */
export function runMovementCard(
  run: Pick<RunState, 'map'> & Partial<Pick<RunState, 'movements' | 'echo'>>,
  n: number,
): { title: string; text: string; look: MovementCardLook; lore: string | null } {
  if (run.echo === undefined)
    return {
      ...movementCard(n, run.movements),
      look: movementCardLook(n),
      lore: movementLore(n),
    };
  const def = runMovementOf(run, n);
  const rows = rowsOfMovement(run.map, n).length;
  const boss = encounterDef(def.boss).name;
  return {
    title: echoLegLabel(run, n),
    text: `${def.mapTitle}: ${rows} ${rows === 1 ? 'stop' : 'stops'} to ${boss}.`,
    look: CARD_LOOK[def.biome] ?? CARD_LOOK.crimson_spire,
    lore: MOVEMENT_LORE[def.biome] ?? null,
  };
}

/** The combat HUD's line: "The Prelude · node 3 of 10", or "Movement II · node 2 of 7". */
export function combatSubtitle(
  run: Pick<RunState, 'map' | 'path' | 'pending' | 'movements'> & Partial<Pick<RunState, 'echo'>>,
): string {
  if (run.echo === undefined && routeOf(run) === 'prelude')
    return `The Prelude · node ${run.path.length} of ${run.map.rows.length}`;
  const node = run.pending ? findNode(run as RunState, run.pending) : undefined;
  const m = node?.movement ?? 1;
  const of = movementRows(run, m).length;
  const done = run.path.filter((id) => (findNode(run as RunState, id)?.movement ?? 1) === m);
  const where = run.echo !== undefined ? echoLegLabel(run, m) : movementLabel(m);
  return `${where} · node ${Math.min(Math.max(done.length, 1), of)} of ${of}`;
}

/**
 * Prep's eyebrow: "The Prelude · Movement I" / "The Expedition · Movements I–II" / "The Expedition
 * · Movements I–III and the Finale".
 */
export function prepEyebrow(run: Partial<Pick<RunState, 'movements' | 'echo' | 'weekly'>>): string {
  // Phase 6: an Echo names itself; a weekly names its week.
  if (run.echo !== undefined)
    return `The Atlas of Echoes · ${CONTENT.echoes.find((e) => e.id === run.echo)?.name ?? run.echo}`;
  if (run.weekly !== undefined) return `This Week’s Song · Week ${run.weekly.week}`;
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
export function abandonLine(
  run: Partial<Pick<RunState, 'movements' | 'echo' | 'weekly'>>,
  straight = false,
): string {
  const name = echoName(run) ?? (run.weekly !== undefined ? 'This Week’s Song' : routeName(run));
  return `${name} ends here and you go ${straight ? 'straight ' : ''}to the summary. This cannot be undone.`;
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
  // The Finale (docs/phase-5d.md): the run's last victory line.
  the_silent_conductor: 'The Silent Conductor lowers its baton, and the song goes on.',
};

/** The Summary's line under its title: a win names the final boss; a defeat, the Movement reached. */
export function outcomeSub(
  run: Pick<RunState, 'map' | 'path' | 'outcome'> & Partial<Pick<RunState, 'movements' | 'echo'>>,
): string | null {
  // Phase 6: an Echo lost names the road its leg was built over.
  if (run.outcome === 'defeat' && run.echo !== undefined) {
    const def = runMovementOf(run, movementReached(run));
    return `The party is lost on ${echoName(run)}’s road, on ${def.mapTitle.replace(/^The /, 'the ')}, but every note you wove is on record.`;
  }
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
export function summaryEyebrow(
  run: Partial<Pick<RunState, 'movements' | 'echo' | 'weekly'>>,
): string {
  // Phase 6: an Echo names itself; a weekly names its week.
  if (run.echo !== undefined)
    return `${CONTENT.echoes.find((e) => e.id === run.echo)?.name ?? run.echo} · summary`;
  if (run.weekly !== undefined) return `This Week’s Song · Week ${run.weekly.week} · summary`;
  return `${routeName(run)} · summary`;
}

/** "Continue · step 4 of 10" (the Loom's Gate); an Expedition's names its Movement. */
export function gateStep(run: MapRun & Partial<Pick<RunState, 'movements' | 'echo'>>): string {
  if (run.echo !== undefined) {
    const m = mapMovement(run);
    const { step, of } = movementStep(run, m);
    return `${echoLegLabel(run, m)} · step ${step} of ${of}`;
  }
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
export function deedMovement(
  d: Pick<DeedDef, 'encounter'> & Partial<Pick<DeedDef, 'movement' | 'level' | 'test'>>,
): number {
  if (d.encounter) return CONTENT.encounters.find((e) => e.id === d.encounter)?.movement ?? 1;
  // Phase 6 (docs/phase-6.md): a Movement's Deed (Silent Bell) waits for that Movement; one about
  // Dissonance, the Atlas or the weekly (all opened by a Finale clear) waits for the Finale.
  if (d.movement !== undefined) return d.movement;
  if (
    d.level !== undefined ||
    d.test === 'dissonance' ||
    d.test === 'stars' ||
    d.test === 'constellation' ||
    d.test === 'weeks'
  )
    return CONTENT.movements.length;
  return 1;
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
 * Seamstress's needle, the Unweaver's shears, the Silent Conductor's baton. Every other stop draws
 * its kind's (null).
 */
const ENCOUNTER_ICON: Readonly<Record<string, IconName>> = {
  gorehound_matriarch: 'paw',
  vharun: 'crown',
  // Movement III (docs/phase-5c.md): the Seamstress's needle, the Unweaver's shears.
  the_seamstress: 'needle',
  the_unweaver: 'scissors',
  // The Finale (docs/phase-5d.md).
  the_silent_conductor: 'baton',
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
