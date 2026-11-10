/**
 * CONTRACT v10 — Deeds (docs/phase-4b.md): feats within a run, judged from what the run records
 * (each fight's stats, grade, kind and outcome; its Calling and tree). Pure: the profile store
 * records them as fights end, the Codex lists them, and ten of them give an Astrolabe point.
 */
import { CONTENT, deedText, dissonanceLevel, type DeedDef } from '../content';
import { atlasTotals, completeConstellations, constellationComplete } from './atlas';
import { treeKeystones } from '../sim';
import { dissonancePoints, fitLevels } from './dissonance';
import { movementSpan, type Profile } from './profile';
import { countsRunWide, endsRun, finaleCleared } from './runEnd';
import type { EncounterResult, RunState } from './types';

/** The most Astrolabe points Deeds give (the ten point Deeds). */
export const DEED_POINTS_MAX = 10;

/** The Astrolabe points the earned Deeds give. */
export function deedPoints(earned: readonly string[]): number {
  const have = new Set(earned);
  const points = CONTENT.deeds.reduce((n, d) => n + (have.has(d.id) ? d.points : 0), 0);
  return Math.min(DEED_POINTS_MAX, points);
}

/**
 * The run is won: it ended in victory, or its final boss is beaten (the result is in; not an
 * Expedition's Cantor, docs/phase-5a.md).
 */
function won(run: RunState): boolean {
  return run.outcome === 'victory' || run.results.some(endsRun);
}

/** The rules judged from the profile, not a run (docs/phase-6.md): the Atlas's and the weekly's. */
const PROFILE_RULES: ReadonlySet<DeedDef['test']> = new Set(['stars', 'constellation', 'weeks']);

/** Is this Deed judged from the profile (`profileDeedsEarned`) rather than from a run? */
export function isProfileDeed(deed: Pick<DeedDef, 'test'>): boolean {
  return PROFILE_RULES.has(deed.test);
}

/**
 * The rules about a whole run (docs/phase-6.md, decision 10): judged on Preludes, Expeditions and
 * weekly runs, never on an Echo. `heroCeiling` with no encounter (Red All the Way) is one too.
 * The fight rules (`fight`, `heroCeiling` with an encounter, `heroTally`) count on every run.
 */
const RUN_WIDE: ReadonlySet<DeedDef['test']> = new Set([
  'win',
  'runCount',
  'grades',
  'callAll',
  'calling',
  'keystone',
  'elites',
  'flawless',
  'saveWays',
  'movementWithout',
  'dissonance',
]);

/** Is this Deed about the whole run (so an Echo can't earn it)? */
export function isRunWideDeed(deed: Pick<DeedDef, 'test' | 'encounter'>): boolean {
  return RUN_WIDE.has(deed.test) || (deed.test === 'heroCeiling' && deed.encounter === undefined);
}

/** Does the run judge this Deed at all: a fight Deed always, a run-wide one off an Echo. */
function judges(run: RunState, deed: DeedDef): boolean {
  return !isProfileDeed(deed) && (!isRunWideDeed(deed) || countsRunWide(run));
}

/**
 * How far a counting Deed has got in this run: the stat's total, the fights won with its grade,
 * or the different ways heroes were saved. Null for a Deed that doesn't count, and on a run that
 * doesn't judge it (an Echo, docs/phase-6.md).
 */
export function deedProgress(run: RunState, deed: DeedDef): number | null {
  if (!judges(run, deed)) return null;
  switch (deed.test) {
    case 'runCount': {
      const stat = deed.stat;
      if (!stat) return null;
      return run.results.reduce((n, r) => n + r.stats[stat], 0);
    }
    case 'grades':
      return run.results.filter((r) => r.outcome === 'victory' && r.grade === deed.grade).length;
    case 'saveWays':
      return new Set(run.results.flatMap((r) => r.stats.saveCauses.filter((c) => c !== 'other')))
        .size;
    default:
      return null;
  }
}

/** A fight that earns a `fight` Deed: that encounter, won, within its downs and grade. */
function fightHolds(r: EncounterResult, deed: DeedDef): boolean {
  if (r.outcome !== 'victory' || r.encounterId !== deed.encounter) return false;
  const downs = deed.values.downs;
  if (downs !== undefined && r.stats.downs > downs) return false;
  return !deed.grade || r.grade === deed.grade;
}

/**
 * A fight that earns a `heroCeiling` Deed (In the Red, docs/phase-5b.md): that encounter, won,
 * with the hero in it, never above `pct`% life once they first fell to their low line.
 */
function ceilingHolds(r: EncounterResult, deed: DeedDef): boolean {
  if (r.outcome !== 'victory' || r.encounterId !== deed.encounter) return false;
  const pct = deed.values.pct;
  const hero = r.heroes.find((h) => h.heroId === deed.hero);
  const peak = hero?.blood?.peakAfterLow;
  return pct !== undefined && peak !== undefined && peak >= 0 && peak <= pct / 100;
}

/**
 * A `heroCeiling` Deed with no encounter (Red All the Way, docs/phase-6.md): a won Expedition with
 * the hero, and in every fight where they fell to `pct`% life, never above it after. Every fight
 * must say how the hero's life went (`blood`): a fight that doesn't can't be judged, so it fails.
 */
function runCeilingHolds(run: RunState, deed: DeedDef): boolean {
  const pct = deed.values.pct;
  if (pct === undefined || !won(run) || run.echo !== undefined || run.movements < 2) return false;
  if (!run.party.some((h) => h.heroId === deed.hero)) return false;
  return run.results.every((r) => {
    const peak = r.heroes.find((h) => h.heroId === deed.hero)?.blood?.peakAfterLow;
    return peak !== undefined && (peak < 0 || peak <= pct / 100);
  });
}

/**
 * A `movementWithout` Deed (Silent Bell, docs/phase-6.md, decision 17): the run beat Movement
 * `movement`'s boss, and none of that Movement's fights recorded its `stat`.
 */
function movementWithoutHolds(run: RunState, deed: DeedDef): boolean {
  const stat = deed.stat;
  // A result's `movement` is its place on the route, a content Movement only off an Echo route.
  if (deed.movement === undefined || !stat || run.echo !== undefined) return false;
  const fights = run.results.filter((r) => r.movement === deed.movement);
  return (
    fights.some((r) => r.kind === 'boss' && r.outcome === 'victory') &&
    fights.every((r) => r.stats[stat] === 0)
  );
}

/**
 * A `dissonance` Deed (docs/phase-6.md): the run cleared the Finale at `values.points` Dissonance
 * or more (its forced levels count for nothing), and with every level at its top rank if it says
 * `allLevels`. A level it names (`level`) is checked for every rule (`levelOn`).
 */
function dissonanceHolds(run: RunState, deed: DeedDef): boolean {
  if (!finaleCleared(run)) return false;
  if (dissonancePoints(run.dissonance) < (deed.values.points ?? 0)) return false;
  if (!deed.allLevels) return true;
  const played = fitLevels(run.dissonance);
  return CONTENT.dissonance.every((d) =>
    played.some((l) => l.id === d.id && l.rank === d.ranks && l.forced !== true),
  );
}

/** The level a Deed names (`level`) was on in this run; true for a Deed that names none. */
function levelOn(run: RunState, deed: DeedDef): boolean {
  return deed.level === undefined || fitLevels(run.dissonance).some((l) => l.id === deed.level);
}

/** A hero's fight tally (docs/phase-5e.md), from the result's `duel` or `grove`; undefined without. */
function heroTally(
  hero: EncounterResult['heroes'][number] | undefined,
  tally: DeedDef['tally'],
): number | undefined {
  switch (tally) {
    case 'parries':
      return hero?.duel?.parries;
    case 'killShots':
      return hero?.duel?.killShots;
    case 'saplingsLost':
      return hero?.grove?.saplingsLost;
    default:
      return undefined;
  }
}

/**
 * A fight that earns a `heroTally` Deed (Debt Paid, Not a Leaf Lost, docs/phase-5e.md): that
 * encounter, won, with the hero in it, their `tally` at least `values.atLeast` and at most
 * `values.atMost`. A result without the hero's stats (saved before them) never earns it.
 */
function tallyHolds(r: EncounterResult, deed: DeedDef): boolean {
  if (r.outcome !== 'victory' || r.encounterId !== deed.encounter) return false;
  const n = heroTally(
    r.heroes.find((h) => h.heroId === deed.hero),
    deed.tally,
  );
  if (n === undefined) return false;
  const { atLeast, atMost } = deed.values;
  return (atLeast === undefined || n >= atLeast) && (atMost === undefined || n <= atMost);
}

/**
 * Does this run earn the Deed? A run-wide Deed never on an Echo (docs/phase-6.md, decision 10); a
 * profile Deed (`stars`, `constellation`, `weeks`) never from a run (`profileDeedsEarned`); a
 * Deed naming a level only with that level on.
 */
export function deedHolds(run: RunState, deed: DeedDef): boolean {
  if (!judges(run, deed) || !levelOn(run, deed)) return false;
  const n = deed.values.n ?? 0;
  switch (deed.test) {
    case 'win':
      return won(run);
    case 'runCount':
    case 'grades':
    case 'saveWays':
      return (deedProgress(run, deed) ?? 0) >= n;
    case 'fight':
      return run.results.some((r) => fightHolds(r, deed));
    case 'callAll':
      // A call a stun or the fight's end cut short couldn't be answered: only a missed one counts.
      return run.results.some((r) => r.stats.responses >= n && r.stats.missedCalls === 0);
    case 'calling':
      return won(run) && run.calling?.id === deed.calling;
    case 'keystone':
      return won(run) && treeKeystones(run.astrolabe).length > 0;
    case 'elites':
      return (
        won(run) &&
        run.results.filter((r) => r.kind === 'elite' && r.outcome === 'victory').length >= n
      );
    case 'flawless':
      return won(run) && run.results.every((r) => r.stats.downs === 0);
    case 'heroCeiling':
      return deed.encounter === undefined
        ? runCeilingHolds(run, deed)
        : run.results.some((r) => ceilingHolds(r, deed));
    case 'heroTally':
      return run.results.some((r) => tallyHolds(r, deed));
    // Phase 6 (docs/phase-6.md, "Design: Deeds").
    case 'movementWithout':
      return movementWithoutHolds(run, deed);
    case 'dissonance':
      return dissonanceHolds(run, deed);
    // The profile's rules: judged by `profileDeedHolds`, never from a run.
    case 'stars':
    case 'constellation':
    case 'weeks':
      return false;
  }
}

/** The Deeds this run has newly earned, in content order (none twice). */
export function deedsEarned(run: RunState, earned: readonly string[]): string[] {
  const have = new Set(earned);
  return CONTENT.deeds.filter((d) => !have.has(d.id) && deedHolds(run, d)).map((d) => d.id);
}

// ── Profile Deeds (docs/phase-6.md, "Design: Deeds") ──────────────────────────────────────
// The Atlas's and the weekly's: judged from the profile when its Atlas or weekly record changes.
// The Atlas's reads are meta/atlas.ts's; the weekly's is the minimal one the rule needs, on W0's
// shape (`Profile.weekly`).

/** Crockford base32 (docs/phase-6.md, "Share codes"): a typed I or L reads 1, an O reads 0. */
const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/**
 * Does a share code say its run was won? Read by the doc's field table, most significant bit
 * first: week (14 bits), build (32), sim version (8), then the won bit. False for a code that
 * doesn't read. A stand-in for the share code's own decoder (meta/shareCode.ts), which replaces it.
 */
export function shareCodeWon(code: string): boolean {
  const body = code.trim().toUpperCase();
  if (!body.startsWith('AW1-')) return false;
  const chars = body.slice(4).replace(/-/g, '').replace(/[IL]/g, '1').replace(/O/g, '0');
  if (chars.length !== 28) return false;
  const bits: number[] = [];
  for (const c of chars) {
    const v = CROCKFORD.indexOf(c);
    if (v < 0) return false;
    for (let b = 4; b >= 0; b--) bits.push((v >> b) & 1);
  }
  return bits[14 + 32 + 8] === 1;
}

/**
 * The different weeks in which the player won This Week's Song: weeks whose record holds one of
 * the player's own entries (`mine`), verified on this device (on this version or another), whose
 * code says it was won.
 */
export function weeksWon(
  profile: Pick<Profile, 'weekly'>,
  won: (code: string) => boolean = shareCodeWon,
): number {
  const weeks = new Set<number>();
  for (const w of profile.weekly ?? [])
    if (
      w.entries.some(
        (e) =>
          e.mine === true &&
          (e.status === 'verified' || e.status === 'otherVersion') &&
          won(e.code),
      )
    )
      weeks.add(w.week);
  return weeks.size;
}

/** Does the profile earn this profile Deed (`stars`, `constellation`, `weeks`)? No other rule. */
export function profileDeedHolds(
  profile: Pick<Profile, 'atlas' | 'weekly'>,
  deed: DeedDef,
): boolean {
  const n = deed.values.n ?? 0;
  switch (deed.test) {
    case 'stars':
      return atlasTotals(profile.atlas).lit >= n;
    case 'constellation':
      return deed.constellation !== undefined
        ? constellationComplete(profile.atlas, deed.constellation)
        : completeConstellations(profile.atlas).length > 0;
    case 'weeks':
      return weeksWon(profile) >= n;
    default:
      return false;
  }
}

/** How far a counting profile Deed has got ("4 of 27 stars"); null for any other Deed. */
export function profileDeedProgress(
  profile: Pick<Profile, 'atlas' | 'weekly'>,
  deed: DeedDef,
): number | null {
  switch (deed.test) {
    case 'stars':
      return atlasTotals(profile.atlas).lit;
    case 'weeks':
      return weeksWon(profile);
    default:
      return null;
  }
}

/** The profile Deeds the profile has newly earned, in content order (none twice). */
export function profileDeedsEarned(
  profile: Pick<Profile, 'atlas' | 'weekly' | 'deeds'>,
  earned: readonly string[] = profile.deeds,
): string[] {
  const have = new Set(earned);
  return CONTENT.deeds
    .filter((d) => !have.has(d.id) && isProfileDeed(d) && profileDeedHolds(profile, d))
    .map((d) => d.id);
}

/**
 * A Deed's condition, filled in (content's `deedText`), with Phase 6's named placeholders too:
 * `{movement}` as the Movement's name ("Movement III") and `{level}` as the level's ("Tyrant").
 */
export function deedLine(deed: DeedDef): string {
  return deedText(deed).replace(/\{(movement|level)\}/g, (m, k: string) => {
    if (k === 'movement' && deed.movement !== undefined)
      return movementSpan(deed.movement, deed.movement);
    if (k === 'level' && deed.level !== undefined) return dissonanceLevel(deed.level).name;
    return m;
  });
}
