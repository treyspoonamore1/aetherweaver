/**
 * The Atlas of Echoes (docs/phase-6.md, "Design: the Atlas of Echoes"): an Echo's route as the
 * map generator plays it, its stars and their rewards, the best Dissonance each Echo was cleared
 * at, the constellations and the keepsakes they earn. Pure: functions over `Profile.atlas` and a
 * finished run's facts. The profile store records what they return (call sites only); nothing
 * here reads the app.
 */
import {
  CONTENT,
  isFieldMovement,
  movementDef,
  type EchoDef,
  type EchoLeg,
  type MovementDef,
} from '../content';
import { ECHO_STARS } from '../content/echoes';
import { dissonancePoints, type DissonanceChoice } from './dissonance';
import type { ProfileAtlas } from './profile';
import type { RunState } from './types';

// ── Echoes and their routes ───────────────────────────────────────────────────────────

/** An Echo by id (undefined if content has none). */
export function echoDef(id: string): EchoDef | undefined {
  return CONTENT.echoes.find((e) => e.id === id);
}

/** One leg of an Echo's route as the run layer plays it. */
export interface EchoRouteLeg {
  /** The leg's own content. */
  leg: EchoLeg;
  /**
   * The field Movement as the leg plays it, for `generateMapFrom`: its pools, lessons, rewards
   * and biome, with the leg's rows, fixed rows, mini-boss and boss. The same object every call,
   * so the run layer can key the leg's `rewards` on it (as `roadOf` keys the Finale's road).
   */
  def: MovementDef;
  /** The skirmish rows that pay more (a road's `rewards`); absent: none. */
  rewards: EchoLeg['rewards'];
  /**
   * The scale every fight of the leg plays at (`SimConfig.movement`), from the Movement whose
   * number the leg names; null: each encounter's own.
   */
  scale: MovementDef['scale'] | null;
}

const ROUTES = new Map<string, readonly EchoRouteLeg[]>();

/**
 * An Echo's legs, in order, each as a field Movement the map generator can play:
 * `generateMapFrom(seed, echoRoute(echo).map((l) => l.def))` is the Echo's map. A leg without
 * `fixed` keeps its Movement's fixed rows except those of its mini-boss and boss rows, which
 * play the leg's.
 */
export function echoRoute(echo: EchoDef): readonly EchoRouteLeg[] {
  const known = ROUTES.get(echo.id);
  if (known) return known;
  const route = echo.legs.map((leg): EchoRouteLeg => {
    const base = movementDef(leg.movement);
    if (!isFieldMovement(base))
      throw new Error(`Echo "${echo.id}": "${leg.movement}" has no pools`);
    const rows = leg.rows ?? base.rows;
    const crowned = (row: number) =>
      (rows[row] ?? []).every((k) => k === 'miniboss' || k === 'boss');
    const fixed = leg.fixed ?? base.fixed.filter((f) => !crowned(f.row));
    const def: MovementDef = {
      ...base,
      rows,
      fixed,
      miniboss: leg.miniboss ?? base.miniboss,
      boss: leg.boss,
    };
    const scaled = leg.scale === undefined ? undefined : CONTENT.movements[leg.scale - 1];
    return { leg, def, rewards: leg.rewards, scale: scaled ? { ...scaled.scale } : null };
  });
  ROUTES.set(echo.id, route);
  return route;
}

// ── Stars ─────────────────────────────────────────────────────────────────────────────

/** The stars an Echo has (three). */
export const STARS_PER_ECHO = ECHO_STARS.length;

/** The Atlas as the profile keeps it, empty where it has none yet. */
export function atlasOf(profile: { atlas?: ProfileAtlas }): ProfileAtlas {
  return profile.atlas ?? { stars: {}, best: {} };
}

/** The Dissonance a run's stars read: its levels' points, never an Echo's forced ones. */
export function starPoints(levels: readonly DissonanceChoice[]): number {
  return dissonancePoints(levels.filter((l) => !l.forced));
}

/** How many stars this many points of Dissonance light on a clear (1 to 3). */
export function starsAt(points: number): number {
  return ECHO_STARS.filter((s) => points >= s.points).length;
}

/** The stars a finished run lights: 0 unless it is a won run of a known Echo. */
export function starsFor(run: Pick<RunState, 'echo' | 'outcome' | 'dissonance'>): number {
  if (run.echo === undefined || !echoDef(run.echo) || run.outcome !== 'victory') return 0;
  return starsAt(starPoints(run.dissonance));
}

/** The stars lit on one Echo, 0 to 3 (a stored value out of range reads clamped). */
export function starsLit(atlas: ProfileAtlas | undefined, echoId: string): number {
  const n = Math.floor(atlas?.stars[echoId] ?? 0);
  return Number.isFinite(n) ? Math.max(0, Math.min(STARS_PER_ECHO, n)) : 0;
}

/** What lighting stars `from` + 1 to `to` pays, each star once (1-based, the lowest first). */
export function starRewards(from: number, to: number): { shards: number; tears: number } {
  let shards = 0;
  let tears = 0;
  for (let i = Math.max(0, from); i < Math.min(STARS_PER_ECHO, to); i++) {
    shards += ECHO_STARS[i]!.shards;
    tears += ECHO_STARS[i]!.tears;
  }
  return { shards, tears };
}

/** What a run's end did in the Atlas (`recordStars`). */
export interface AtlasRecord {
  /** The Atlas to keep: the one given (absent stays absent) when nothing changed. */
  atlas: ProfileAtlas | undefined;
  /** The Echo the run played, or null for any other run. */
  echo: string | null;
  /** The Dissonance its stars read (its forced levels count for nothing). */
  points: number;
  /** The Echo's stars after the run, 0 to 3. */
  stars: number;
  /** The stars newly lit, 1-based ([2, 3]: the second and third). */
  lit: number[];
  /** What the newly lit stars pay, each star only the first time it lights. */
  shards: number;
  tears: number;
  /** A new best Dissonance for this Echo (its first clear included). */
  best: boolean;
  /** Constellations whose every star is now lit, and weren't before. */
  constellations: string[];
  /** Every star of the Atlas is now lit, and wasn't before. */
  wholeAtlas: boolean;
  /** Keepsakes newly earned (a constellation's, the Atlas's), in content order. */
  keepsakes: string[];
}

/**
 * At a run's end: the stars it lights, their rewards (once each, ever), the Echo's best
 * Dissonance, and what completing a constellation or the Atlas earns. A run that isn't a won
 * Echo changes nothing and returns the profile's Atlas as it was.
 */
export function recordStars(
  profile: { atlas?: ProfileAtlas },
  run: Pick<RunState, 'echo' | 'outcome' | 'dissonance'>,
): AtlasRecord {
  const before = profile.atlas;
  const points = starPoints(run.dissonance);
  const earned = starsFor(run);
  const echo = run.echo !== undefined && echoDef(run.echo) ? run.echo : null;
  const had = echo === null ? 0 : starsLit(before, echo);
  const none: AtlasRecord = {
    atlas: before,
    echo,
    points,
    stars: had,
    lit: [],
    shards: 0,
    tears: 0,
    best: false,
    constellations: [],
    wholeAtlas: false,
    keepsakes: [],
  };
  if (echo === null || earned === 0) return none;
  const prevBest = before?.best[echo];
  const best = prevBest === undefined || points > prevBest;
  const stars = Math.max(had, earned);
  if (stars === had && !best) return none;
  const old = atlasOf(profile);
  const atlas: ProfileAtlas = {
    stars: stars > had ? { ...old.stars, [echo]: stars } : { ...old.stars },
    best: best ? { ...old.best, [echo]: points } : { ...old.best },
  };
  const lit: number[] = [];
  for (let s = had + 1; s <= stars; s++) lit.push(s);
  const { shards, tears } = starRewards(had, stars);
  const constellations = completeConstellations(atlas).filter(
    (id) => !constellationComplete(before, id),
  );
  const wholeAtlas = atlasComplete(atlas) && !atlasComplete(before);
  const owned = new Set(atlasKeepsakes(before));
  const keepsakes = atlasKeepsakes(atlas).filter((id) => !owned.has(id));
  return {
    atlas,
    echo,
    points,
    stars,
    lit,
    shards,
    tears,
    best,
    constellations,
    wholeAtlas,
    keepsakes,
  };
}

/** The best Dissonance an Echo was cleared at, or null if it never was. */
export function bestCleared(atlas: ProfileAtlas | undefined, echoId: string): number | null {
  return atlas?.best[echoId] ?? null;
}

// ── Totals and constellations ─────────────────────────────────────────────────────────

/** Stars lit and stars there are, over a list of Echoes (every Echo in content by default). */
export function atlasTotals(
  atlas: ProfileAtlas | undefined,
  echoes: readonly EchoDef[] = CONTENT.echoes,
): { lit: number; of: number } {
  return {
    lit: echoes.reduce((n, e) => n + starsLit(atlas, e.id), 0),
    of: echoes.length * STARS_PER_ECHO,
  };
}

/** "4 of 27 stars": the Atlas's progress, as the Hall of Deeds and the Atlas show it. */
export function starsLine(atlas: ProfileAtlas | undefined): string {
  const { lit, of } = atlasTotals(atlas);
  return `${lit} of ${of} stars`;
}

/** A constellation's Echoes, in the Atlas's order. */
export function constellationEchoes(id: string): EchoDef[] {
  return CONTENT.echoes.filter((e) => e.constellation === id);
}

/** Stars lit and stars there are in one constellation. */
export function constellationStars(
  atlas: ProfileAtlas | undefined,
  id: string,
): { lit: number; of: number } {
  return atlasTotals(atlas, constellationEchoes(id));
}

/** Is every star of this constellation lit? (A constellation with no Echo never is.) */
export function constellationComplete(atlas: ProfileAtlas | undefined, id: string): boolean {
  const { lit, of } = constellationStars(atlas, id);
  return of > 0 && lit === of;
}

/** The constellations whose every star is lit, in the Atlas's order. */
export function completeConstellations(atlas: ProfileAtlas | undefined): string[] {
  return CONTENT.constellations.filter((k) => constellationComplete(atlas, k.id)).map((k) => k.id);
}

/** Is every star of the Atlas lit? */
export function atlasComplete(atlas: ProfileAtlas | undefined): boolean {
  const { lit, of } = atlasTotals(atlas);
  return of > 0 && lit === of;
}

/**
 * The keepsakes the Atlas has earned: each robe, Thread look and title whose `earned` names a
 * complete constellation, or the whole Atlas once complete; in content order (robes, Thread
 * looks, titles).
 */
export function atlasKeepsakes(atlas: ProfileAtlas | undefined): string[] {
  const c = CONTENT.cosmetics;
  return [...c.robes, ...c.threads, ...c.titles]
    .filter((k) => {
      const e = k.earned;
      if (!e) return false;
      if ('constellation' in e) return constellationComplete(atlas, e.constellation);
      if ('atlas' in e) return atlasComplete(atlas);
      return false;
    })
    .map((k) => k.id);
}

// ── Words ─────────────────────────────────────────────────────────────────────────────

/** Each star's rule, lowest first: "Clear it", "Clear it at 10 Dissonance", … */
export function starRules(): string[] {
  return ECHO_STARS.map((s) => (s.points > 0 ? `Clear it at ${s.points} Dissonance` : 'Clear it'));
}

/** What each star pays the first time it lights, lowest first: "40 Tuning Shards", … */
export function starRewardTexts(): string[] {
  return ECHO_STARS.map((s) => {
    const shards = s.shards > 0 ? `${s.shards} Tuning Shards` : null;
    const tears = s.tears > 0 ? `${s.tears} Discord ${s.tears === 1 ? 'Tear' : 'Tears'}` : null;
    return [shards, tears].filter((x) => x !== null).join(' and ');
  });
}
