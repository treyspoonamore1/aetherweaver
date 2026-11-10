/**
 * Phase 6 UI (docs/phase-6.md, "Design: the Atlas of Echoes", "Design: the weekly seed"): the
 * Atlas station's star chart, its Echo cards and keepsakes, Prep's Echo and weekly panels, the
 * Summary's stars and weekly score, and the Codex's Atlas page, as plain data and words. Pure, so
 * it can be tested without React: every Echo, constellation, star rule, reward and keepsake comes
 * from content (`CONTENT.echoes`, `CONTENT.constellations`, `CONTENT.cosmetics`) and meta
 * (`src/meta/atlas.ts`); nothing is typed twice.
 *
 * The weekly's numbers (its week, days left, score, codes and their statuses, verification's
 * progress and messages) are the weekly model's, not this file's: the panel takes them as a plain
 * input (`WeeklyPanelInput`) shaped on that model's own types (a board row, a verify progress, a
 * verify result), so wiring it is a mapping and no maths lives here.
 */
import {
  CONTENT,
  callingDef,
  dissonanceLevel,
  heroDef,
  movementDef,
  type Constellation,
  type EchoDef,
  type EchoLeg,
  type EchoTwists,
  type WeeklyEntry,
} from '../../content';
import { ECHO_STARS } from '../../content/echoes';
import {
  STARS_PER_ECHO,
  atlasComplete,
  atlasKeepsakes,
  atlasTotals,
  bestCleared,
  constellationEchoes,
  constellationStars,
  echoDef,
  starRewardTexts,
  starRules,
  starsLine,
  starsLit,
  type AtlasRecord,
} from '../../meta/atlas';
import { dissonancePoints, type DissonanceChoice } from '../../meta/dissonance';
import type { ProfileAtlas, WeeklyCode, WeeklyWeek } from '../../meta/profile';
import type { VerifyStatus } from '../../meta/runReplay';
import {
  bestScore,
  daysLeft,
  entryLine,
  weekOf,
  weeklyBoard,
  weeklyEntry,
  weeklyRecords,
  weeklyScore,
} from '../../meta/weekly';
import { fmt, plural } from '../kit/format';
import type { IconName } from '../kit/iconPaths';
import { t as txt } from '../text';

// ── Words ──────────────────────────────────────────────────────────────────────────────

/** "Kael, Lyra and Vexis". */
export function andList(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

const COUNT_WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];

/** "two", or the digits past nine. */
export function countWord(n: number): string {
  return COUNT_WORDS[n] ?? fmt(n);
}

/** "the robe", "the Thread look", "the title". */
function keepsakeKindWord(kind: KeepsakeKind): string {
  return kind === 'robe'
    ? txt('screens.atlasModel.theRobe')
    : kind === 'thread'
      ? txt('screens.atlasModel.theThreadLook')
      : txt('screens.atlasModel.theTitle');
}

// ── Keepsakes ──────────────────────────────────────────────────────────────────────────

export type KeepsakeKind = 'robe' | 'thread' | 'title';

export interface KeepsakeView {
  id: string;
  kind: KeepsakeKind;
  /** Its name as the Atelier shows it ("Crownless", "Atlas-Walker"). */
  name: string;
  earned: boolean;
  /** How it is earned: "Light every star of Borrowed Crowns." */
  how: string;
}

/** A keepsake's kind and name by id (content's), or null for an id content doesn't know. */
export function keepsakeOf(id: string): { kind: KeepsakeKind; name: string } | null {
  const c = CONTENT.cosmetics;
  const robe = c.robes.find((r) => r.id === id);
  if (robe) return { kind: 'robe', name: robe.name };
  const thread = c.threads.find((t) => t.id === id);
  if (thread) return { kind: 'thread', name: thread.name };
  const title = c.titles.find((t) => t.id === id);
  if (title) return { kind: 'title', name: title.text };
  return null;
}

/** "the robe Crownless". */
export function keepsakeLine(id: string): string {
  const k = keepsakeOf(id);
  return k ? `${keepsakeKindWord(k.kind)} ${k.name}` : id;
}

/**
 * The Atlas's keepsakes, in content order (robes, Thread looks, titles): every one whose
 * `earned` names a constellation or the whole Atlas, earned or not (`atlasKeepsakes`).
 */
export function atlasKeepsakeViews(atlas: ProfileAtlas | undefined): KeepsakeView[] {
  const owned = new Set(atlasKeepsakes(atlas));
  const c = CONTENT.cosmetics;
  const out: KeepsakeView[] = [];
  const add = (
    id: string,
    kind: KeepsakeKind,
    name: string,
    earned: (typeof c.titles)[number]['earned'],
  ) => {
    if (!earned) return;
    if ('constellation' in earned) {
      const k = CONTENT.constellations.find((x) => x.id === earned.constellation);
      out.push({
        id,
        kind,
        name,
        earned: owned.has(id),
        how: txt('screens.atlasModel.lightEveryStarOf', {
          value: k?.name ?? txt('screens.atlasModel.aConstellation'),
        }),
      });
    } else if ('atlas' in earned) {
      out.push({
        id,
        kind,
        name,
        earned: owned.has(id),
        how: txt('screens.atlasModel.lightEveryStarIn', { of: atlasTotals(undefined).of }),
      });
    }
  };
  for (const r of c.robes) add(r.id, 'robe', r.name, r.earned);
  for (const t of c.threads) add(t.id, 'thread', t.name, t.earned);
  for (const t of c.titles) add(t.id, 'title', t.text, t.earned);
  return out;
}

// ── An Echo in words ───────────────────────────────────────────────────────────────────

/** A field Movement's road, as its map is titled ("The Reliquary Road"). */
export function roadName(movementId: string): string {
  const def = movementDef(movementId) as { mapTitle?: string; name: string };
  return def.mapTitle ?? def.name;
}

/** An encounter's name ("Vharun, the Crimson Warden"), or the id content doesn't know. */
export function encounterName(id: string): string {
  return CONTENT.encounters.find((e) => e.id === id)?.name ?? id;
}

/** An encounter's name mid-sentence: "the Unweaver", "Vharun, the Crimson Warden". */
export function encounterInSentence(id: string): string {
  return encounterName(id).replace(/^The /, 'the ');
}

const NODE_WORDS: Readonly<Record<string, string>> = {
  get respite() {
    return txt('screens.atlasModel.aRespite');
  },
  get merchant() {
    return txt('screens.atlasModel.aMerchant');
  },
  get forge() {
    return txt('screens.atlasModel.aForge');
  },
  get event() {
    return txt('screens.atlasModel.anEvent');
  },
};

/** A leg's scale in words: "at the Unravelling Descent’s strength" (null: its own). */
export function scaleWords(leg: Pick<EchoLeg, 'scale' | 'movement'>): string | null {
  if (leg.scale === undefined) return null;
  const m = CONTENT.movements[leg.scale - 1];
  if (!m || m.id === leg.movement) return null;
  return txt('screens.atlasModel.atSStrength', { roadName: roadName(m.id) }).replace(
    /^at The /,
    'at the ',
  );
}

/**
 * One leg in a line: its road (or, for a leg of only rests and a boss, those), the mini-boss and
 * boss it ends at, and the strength its foes play at. "The Reliquary Road, then the Gorehound
 * Matriarch and Vharun, the Crimson Warden".
 */
export function legLine(leg: EchoLeg): string {
  const kinds = (leg.rows ?? []).flat();
  const fights = kinds.some((k) => k === 'skirmish' || k === 'elite');
  const boss = encounterInSentence(leg.boss);
  const crowned = leg.miniboss ? `${encounterInSentence(leg.miniboss)} and ${boss}` : boss;
  let head: string;
  if (leg.rows && !fights) {
    const stops = kinds.filter((k) => k !== 'boss' && k !== 'miniboss').map((k) => NODE_WORDS[k]);
    head =
      stops.length > 0
        ? txt('screens.atlasModel.then', { andList: andList(stops as string[]), boss })
        : boss;
    head = head.charAt(0).toUpperCase() + head.slice(1);
  } else {
    head = txt('screens.atlasModel.endingAt', { roadName: roadName(leg.movement), crowned });
  }
  const scale = scaleWords(leg);
  return scale ? `${head}, ${scale}` : head;
}

/** The levels an Echo forces on, by name: "Restless Dead and Unforgiving". */
export function forcedNames(levels: readonly DissonanceChoice[] | undefined): string {
  return andList(
    (levels ?? []).map((l) => {
      const def = dissonanceLevel(l.id);
      return def.ranks > 1
        ? txt('screens.atlasModel.rank', { name: def.name, rank: l.rank })
        : def.name;
    }),
  );
}

/** One twist, as Prep and the Echo card show it. */
export interface TwistLine {
  kind: 'noCalling' | 'noTree' | 'noCarry' | 'party' | 'dissonance';
  text: string;
  icon: IconName;
}

/** An Echo's twists in words, in a fixed order (none for an Echo with no twist). */
export function twistLines(t: EchoTwists): TwistLine[] {
  const out: TwistLine[] = [];
  if (t.noCalling)
    out.push({ kind: 'noCalling', text: txt('screens.atlasModel.noCalling'), icon: 'lock' });
  if (t.noTree)
    out.push({ kind: 'noTree', text: txt('screens.atlasModel.noAstrolabe'), icon: 'lock' });
  if (t.noCarry)
    out.push({ kind: 'noCarry', text: txt('screens.atlasModel.noCarriedRelics'), icon: 'lock' });
  if (t.party && t.party.length > 0)
    out.push({
      kind: 'party',
      text: txt('screens.atlasModel.thePartyIs', {
        andList: andList(t.party.map((h) => heroDef(h).name)),
      }),
      icon: 'heart',
    });
  if (t.dissonance && t.dissonance.length > 0)
    out.push({
      kind: 'dissonance',
      text: txt('screens.atlasModel.alwaysOnAndAdd', {
        forcedNames: forcedNames(t.dissonance),
        value: t.dissonance.length === 1 ? 'is' : 'are',
      }),
      icon: 'dissonance',
    });
  return out;
}

// ── Stars ──────────────────────────────────────────────────────────────────────────────

export interface StarRow {
  /** 1-based. */
  n: number;
  /** "Clear it at 10 Dissonance". */
  rule: string;
  /** "60 Tuning Shards". */
  reward: string;
  lit: boolean;
}

/** An Echo's three stars: each rule, what it pays the first time, and whether it is lit. */
export function starRows(lit: number): StarRow[] {
  const rules = starRules();
  const rewards = starRewardTexts();
  return ECHO_STARS.map((_, i) => ({
    n: i + 1,
    rule: rules[i]!,
    reward: rewards[i]!,
    lit: i < lit,
  }));
}

/** "★ Clear it · ★ Clear it at 10 Dissonance · ★ Clear it at 20 Dissonance". */
export function starRulesLine(): string {
  return starRules()
    .map((r) => `★ ${r}`)
    .join(' · ');
}

/** "★★☆": the stars lit, out of three. */
export function starGlyphs(lit: number, of = STARS_PER_ECHO): string {
  return '★'.repeat(Math.max(0, Math.min(of, lit))) + '☆'.repeat(Math.max(0, of - lit));
}

// ── An Echo card ───────────────────────────────────────────────────────────────────────

export interface EchoCardView {
  id: string;
  name: string;
  /** Content's text. */
  text: string;
  constellation: string;
  constellationName: string;
  /** Each leg in a line, in order. */
  legs: string[];
  twists: TwistLine[];
  /** Stars lit, 0 to 3, and how many there are. */
  lit: number;
  of: number;
  stars: StarRow[];
  /** The best Dissonance it was cleared at (null: never). */
  best: number | null;
  /** "Best clear: 12 Dissonance", "Cleared without Dissonance", "Not cleared yet". */
  bestLine: string;
  /** "Choir of Blood, 2 of 3 stars. …" for screen readers. */
  label: string;
}

export function bestLine(best: number | null): string {
  if (best === null) return txt('screens.atlasModel.notClearedYet');
  return best > 0
    ? txt('screens.atlasModel.bestClearDissonance', { best })
    : txt('screens.atlasModel.clearedWithoutDissonance');
}

export function echoCard(echo: EchoDef, atlas: ProfileAtlas | undefined): EchoCardView {
  const lit = starsLit(atlas, echo.id);
  const best = bestCleared(atlas, echo.id);
  const k = CONTENT.constellations.find((c) => c.id === echo.constellation);
  const twists = twistLines(echo.twists);
  return {
    id: echo.id,
    name: echo.name,
    text: echo.text,
    constellation: echo.constellation,
    constellationName: k?.name ?? echo.constellation,
    legs: echo.legs.map(legLine),
    twists,
    lit,
    of: STARS_PER_ECHO,
    stars: starRows(lit),
    best,
    bestLine: bestLine(best),
    label: txt('screens.atlasModel.of', {
      name: echo.name,
      lit,
      STARS_PER_ECHO,
      STARS_PER_ECHOWord: plural(STARS_PER_ECHO, 'star'),
      text: echo.text,
      bestLine: bestLine(best),
    }),
  };
}

// ── The star chart ─────────────────────────────────────────────────────────────────────

/** Where each star stands in a constellation (fractions of its cell), for up to five Echoes. */
const SHAPES: readonly (readonly [number, number])[][] = [
  [[0.5, 0.5]],
  [
    [0.3, 0.6],
    [0.7, 0.4],
  ],
  [
    [0.22, 0.7],
    [0.5, 0.28],
    [0.8, 0.62],
  ],
  [
    [0.2, 0.65],
    [0.42, 0.3],
    [0.66, 0.55],
    [0.84, 0.25],
  ],
  [
    [0.18, 0.6],
    [0.36, 0.28],
    [0.56, 0.52],
    [0.72, 0.22],
    [0.86, 0.66],
  ],
];

export interface ChartStar {
  id: string;
  name: string;
  /** Position in the chart, 0-1 each way. */
  x: number;
  y: number;
  lit: number;
  of: number;
}

export interface ChartLine {
  from: string;
  to: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** Both ends have a star lit: the line is drawn in light. */
  lit: boolean;
}

export interface ConstellationView {
  id: string;
  name: string;
  echoes: EchoCardView[];
  stars: ChartStar[];
  lines: ChartLine[];
  /** Stars lit and stars there are. */
  lit: number;
  of: number;
  complete: boolean;
  /** "5 of 9 stars". */
  progress: string;
  /** The keepsake all its stars earn (null: content names none it knows). */
  reward: KeepsakeView | null;
  /** "All nine stars: the robe Crownless". */
  rewardLine: string;
  /** Its name's place in the chart. */
  labelX: number;
}

function constellationView(
  k: Constellation,
  index: number,
  count: number,
  atlas: ProfileAtlas | undefined,
): ConstellationView {
  const echoes = constellationEchoes(k.id);
  const shape = SHAPES[Math.min(echoes.length, SHAPES.length) - 1] ?? SHAPES[0]!;
  const cell = 1 / Math.max(1, count);
  const stars: ChartStar[] = echoes.map((e, i) => {
    const [fx, fy] = shape[i] ?? shape[shape.length - 1]!;
    return {
      id: e.id,
      name: e.name,
      x: (index + fx) * cell,
      y: 0.12 + fy * 0.8,
      lit: starsLit(atlas, e.id),
      of: STARS_PER_ECHO,
    };
  });
  const lines: ChartLine[] = stars.slice(1).map((s, i) => {
    const a = stars[i]!;
    return {
      from: a.id,
      to: s.id,
      x1: a.x,
      y1: a.y,
      x2: s.x,
      y2: s.y,
      lit: a.lit > 0 && s.lit > 0,
    };
  });
  const { lit, of } = constellationStars(atlas, k.id);
  const owned = new Set(atlasKeepsakes(atlas));
  const r = keepsakeOf(k.reward);
  const reward: KeepsakeView | null = r
    ? {
        id: k.reward,
        kind: r.kind,
        name: r.name,
        earned: owned.has(k.reward),
        how: txt('screens.atlasModel.lightEveryStarOf2', { name: k.name }),
      }
    : null;
  return {
    id: k.id,
    name: k.name,
    echoes: echoes.map((e) => echoCard(e, atlas)),
    stars,
    lines,
    lit,
    of,
    complete: of > 0 && lit === of,
    progress: `${lit} of ${of} ${plural(of, 'star')}`,
    reward,
    rewardLine: txt('screens.atlasModel.all', {
      countWord: countWord(of),
      ofWord: plural(of, 'star'),
      keepsakeLine: keepsakeLine(k.reward),
    }),
    labelX: (index + 0.5) * cell,
  };
}

export interface AtlasView {
  constellations: ConstellationView[];
  /** Stars lit and stars there are. */
  lit: number;
  of: number;
  /** "4 of 27 stars" (meta's `starsLine`). */
  total: string;
  complete: boolean;
  /** Every Atlas keepsake, earned or not. */
  keepsakes: KeepsakeView[];
  /** The three star rules with their rewards, as the chart's legend. */
  legend: StarRow[];
  /** The intro card's words (the station's first visit, the Codex). */
  about: string;
}

/** What the Atlas is, in the intro card's words, with content's star thresholds. */
export function atlasAbout(): string {
  const ord = ['first', 'second', 'third', 'fourth', 'fifth'];
  const rules = ECHO_STARS.map((s, i) => {
    const which = ord[i] ?? `star ${i + 1}`;
    if (s.points <= 0)
      return txt('screens.atlasModel.byClearingIt', {
        value: i === 0 ? txt('screens.atlasModel.lightThe') : 'the',
        which,
      });
    return i <= 1 || ECHO_STARS[i - 1]!.points <= 0
      ? txt('screens.atlasModel.byClearingItAt', {
          value: i === 0 ? txt('screens.atlasModel.lightThe') : 'the',
          which,
          points: s.points,
        })
      : txt('screens.atlasModel.theAt', { which, points: s.points });
  });
  return txt('screens.atlasModel.echoesAreOldSongs', {
    countWord: countWord(STARS_PER_ECHO),
    rules: rules.join(', '),
  });
}

/** The whole Atlas for a profile's `atlas` (absent: nothing lit). */
export function atlasView(atlas: ProfileAtlas | undefined): AtlasView {
  const ks = CONTENT.constellations;
  const { lit, of } = atlasTotals(atlas);
  return {
    constellations: ks.map((k, i) => constellationView(k, i, ks.length, atlas)),
    lit,
    of,
    total: starsLine(atlas),
    complete: atlasComplete(atlas),
    keepsakes: atlasKeepsakeViews(atlas),
    legend: starRows(0),
    about: atlasAbout(),
  };
}

// ── The station ────────────────────────────────────────────────────────────────────────

/** The Atlas has Echoes to play (content holds some). */
export function atlasInContent(): boolean {
  return CONTENT.echoes.length > 0;
}

/** The Atlas station is lit: Dissonance is open (or Skip the unlocks), and content has Echoes. */
export function atlasStationOpen(dissonanceOpen: boolean, unlockAll: boolean): boolean {
  return atlasInContent() && (unlockAll || dissonanceOpen);
}

/** The station's badge: "4 of 27 stars" once one is lit (null: none yet). */
export function atlasBadge(atlas: ProfileAtlas | undefined): string | null {
  return atlasTotals(atlas).lit > 0 ? starsLine(atlas) : null;
}

// ── Prep: an Echo's twists ─────────────────────────────────────────────────────────────

export interface PrepEchoView {
  id: string;
  name: string;
  text: string;
  /** What the Echo fixes: its legs, then its party, if it sets one. */
  fixed: string[];
  /** What is off in it (no Calling, no Astrolabe, no carried relics). */
  off: string[];
  /** Levels it forces on: shown locked in the Dissonance panel; they add no points. */
  forced: { id: string; name: string; rank: number }[];
  /** "Your Chords and techniques are your own." (and the Calling, where it isn't off). */
  yours: string;
  /** The star rules, and how many this Echo has lit. */
  stars: StarRow[];
  /** "A Cappella: no Calling, no Astrolabe, no carried relics. Your Chords and techniques are your own." */
  label: string;
}

/** Prep's panel for an Echo run (null for an id content doesn't know). */
export function prepEchoView(echoId: string, atlas?: ProfileAtlas): PrepEchoView | null {
  const echo = echoDef(echoId);
  if (!echo) return null;
  const twists = twistLines(echo.twists);
  const off = twists
    .filter((t) => t.kind === 'noCalling' || t.kind === 'noTree' || t.kind === 'noCarry')
    .map((t) => t.text);
  const party = twists.find((t) => t.kind === 'party');
  const fixed = [...echo.legs.map(legLine), ...(party ? [party.text] : [])];
  const forced = (echo.twists.dissonance ?? []).map((l) => ({
    id: l.id,
    name: dissonanceLevel(l.id).name,
    rank: l.rank,
  }));
  const own = ['Chords', 'techniques'];
  if (!echo.twists.noCalling) own.unshift('Calling');
  if (!party) own.unshift('party');
  const yours = txt('screens.atlasModel.yourAreYourOwn', { andList: andList(own) });
  const offLine = off.length > 0 ? `${off.join(', ').replace(/^No/, 'no')}. ` : '';
  return {
    id: echo.id,
    name: echo.name,
    text: echo.text,
    fixed,
    off,
    forced,
    yours,
    stars: starRows(starsLit(atlas, echo.id)),
    label: `${echo.name}: ${offLine}${yours}`.replace(/: no/, ': no'),
  };
}

// ── Prep: the weekly's fixed choices ───────────────────────────────────────────────────

/**
 * What the weekly model gives Prep: the week and its entry (`weeklyEntry(week)`, content's
 * `WeeklyEntry`). Everything else is read from content.
 */
export interface PrepWeeklyInput {
  week: number;
  entry: WeeklyEntry;
}

export interface PrepWeeklyView {
  week: number;
  /** "Week 44 · This Week’s Song". */
  title: string;
  /** Each fixed choice, locked: its label and value. */
  fixed: { label: string; value: string; icon: IconName }[];
  /** The Dissonance it plays at: its levels and points. */
  dissonance: { id: string; name: string; rank: number }[];
  points: number;
  /** "Everyone plays this". */
  everyone: string;
  /** What the player still chooses. */
  yours: string;
  label: string;
}

/** The route's name: the Expedition, or an Echo's. */
export function routeWords(route: WeeklyEntry['route']): string {
  return route === 'expedition'
    ? txt('screens.atlasModel.theExpeditionToThe')
    : (echoDef(route)?.name ?? route);
}

export function prepWeeklyView(input: PrepWeeklyInput): PrepWeeklyView {
  const { week, entry } = input;
  const calling = entry.calling
    ? `The ${callingDef(entry.calling).name}`
    : txt('screens.atlasModel.noCalling');
  const party = andList(entry.party.map((h) => heroDef(h).name));
  const dissonance = entry.dissonance.map((l) => ({
    id: l.id,
    name: dissonanceLevel(l.id).name,
    rank: l.rank,
  }));
  const points = dissonancePoints(entry.dissonance);
  const levels = dissonance.length
    ? `${points} (${andList(dissonance.map((d) => (dissonanceLevel(d.id).ranks > 1 ? `${d.name} ${d.rank}` : d.name)))})`
    : 'None';
  const fixed: PrepWeeklyView['fixed'] = [
    { label: txt('screens.atlasModel.route'), value: routeWords(entry.route), icon: 'flag' },
    { label: txt('screens.atlasModel.calling'), value: calling, icon: 'crown' },
    { label: txt('screens.atlasModel.party'), value: party, icon: 'heart' },
    { label: txt('screens.atlasModel.dissonance'), value: levels, icon: 'dissonance' },
    {
      label: txt('screens.atlasModel.seed'),
      value: txt('screens.atlasModel.weekS', { week }),
      icon: 'week',
    },
  ];
  const yours = txt('screens.atlasModel.yourChordsAndTechnique');
  return {
    week,
    title: txt('screens.atlasModel.weekThisWeekS', { week }),
    fixed,
    dissonance,
    points,
    everyone: txt('screens.atlasModel.everyonePlaysThis'),
    yours,
    label: txt('screens.atlasModel.weekEveryonePlaysThis', {
      week,
      fixed: fixed.map((f) => `${f.label} ${f.value}`).join(', '),
      yours,
    }),
  };
}

// ── The weekly panel (the Atlas station) ───────────────────────────────────────────────

/** One leaderboard row as the weekly model reads it (`weeklyBoard`'s `BoardRow`). */
export interface WeeklyRowInput {
  entry: WeeklyCode;
  score: number | null;
  seconds: number | null;
  won: boolean | null;
  fightsWon: number | null;
}

/** Verification under way (the verifier's `VerifyProgress`). */
export interface WeeklyProgressInput {
  fight: number;
  fights: number;
  ticks: number;
  totalTicks: number;
}

/**
 * Verification's answer (the verifier's `VerifyResult`: its status and its own message). A
 * replay that isn't a weekly (an Echo, a Prelude, an Expedition) only ever `playsBack`.
 */
export interface WeeklyResultInput {
  status: VerifyStatus;
  message: string;
}

/**
 * Everything the weekly panel shows, from the weekly model: the week (`weekOf`), days left
 * (`daysLeft`), the entry (`weeklyEntry`, null: the rotation is empty) and its line
 * (`entryLine`), your best (`bestScore`), the board (`weeklyBoard`), and a verification's
 * progress or result.
 */
export interface WeeklyPanelInput {
  week: number;
  daysLeft: number;
  entry: WeeklyEntry | null;
  entryLine: string;
  best: number | null;
  rows: readonly WeeklyRowInput[];
  progress: WeeklyProgressInput | null;
  result: WeeklyResultInput | null;
  /** Begin is offered (no run in progress that it would replace). */
  canBegin: boolean;
  /** You have a result this week to share (its code). */
  shareCode: string | null;
}

export interface StatusLook {
  status: VerifyStatus;
  /** "Verified", "Another version", "Claimed", "Didn't match". */
  word: string;
  /** Its own glyph, so the colour is never the only cue. */
  icon: IconName;
  color: string;
  /** What it means, for a tooltip and screen readers. */
  means: string;
}

/**
 * The four statuses, each with its own word, glyph and colour (`tests/colorVision.test.ts` keeps
 * the colours apart under every vision; the glyphs differ anyway).
 */
export const STATUS_LOOK: Readonly<Record<VerifyStatus, StatusLook>> = {
  verified: {
    status: 'verified',
    get word() {
      return txt('screens.atlasModel.verified');
    },
    icon: 'check',
    color: '#60a5fa',
    get means() {
      return txt('screens.atlasModel.itsReplayPlayedThrough');
    },
  },
  otherVersion: {
    status: 'otherVersion',
    get word() {
      return txt('screens.atlasModel.anotherVersion');
    },
    icon: 'info',
    color: '#e5e7eb',
    get means() {
      return txt('screens.atlasModel.verifiedThoughItWas');
    },
  },
  claimed: {
    status: 'claimed',
    get word() {
      return txt('screens.atlasModel.claimed');
    },
    icon: 'flag',
    color: '#8b95a8',
    get means() {
      return txt('screens.atlasModel.onlyACodeIts');
    },
  },
  mismatch: {
    status: 'mismatch',
    get word() {
      return txt('screens.atlasModel.didnTMatch');
    },
    icon: 'close',
    color: '#fb923c',
    get means() {
      return txt('screens.atlasModel.itsReplayDoesnT');
    },
  },
  // Not a weekly: an Echo's, a Prelude's or an Expedition's replay played back as recorded. It is
  // never "Verified" (nothing fixes its start), so it has its own word, glyph and colour.
  playsBack: {
    status: 'playsBack',
    get word() {
      return txt('screens.atlasModel.playsBack');
    },
    icon: 'play',
    color: '#facc15',
    get means() {
      return txt('screens.atlasModel.notAWeeklyIts');
    },
  },
};

export interface WeeklyRowView {
  code: string;
  /** "You", the name given, or "A code". */
  who: string;
  mine: boolean;
  /** 1-based, in the board's order. */
  place: number;
  /** "3,210" (null: the code can't be read). */
  score: string | null;
  /** "Won", "Lost at fight 9" (null: unreadable). */
  result: string | null;
  /** "31 min" (null: unreadable). */
  time: string | null;
  status: StatusLook;
  label: string;
}

/** "31 min", "under a minute". */
export function minutes(seconds: number): string {
  const m = Math.round(seconds / 60);
  return m < 1 ? txt('screens.atlasModel.underAMinute') : `${fmt(m)} min`;
}

export function weeklyRow(row: WeeklyRowInput, place: number): WeeklyRowView {
  const status = STATUS_LOOK[row.entry.status];
  const mine = !!row.entry.mine;
  const who = mine ? 'You' : (row.entry.name ?? txt('screens.atlasModel.aCode'));
  const score = row.score === null ? null : fmt(row.score);
  const result =
    row.won === null
      ? null
      : row.won
        ? 'Won'
        : row.fightsWon !== null
          ? txt('screens.atlasModel.lostAfterWon', {
              fightsWon: row.fightsWon,
              fightsWonWord: plural(row.fightsWon, 'fight'),
            })
          : 'Lost';
  const time = row.seconds === null ? null : minutes(row.seconds);
  return {
    code: row.entry.code,
    who,
    mine,
    place,
    score,
    result,
    time,
    status,
    label: `${place}. ${who}: ${score === null ? txt('screens.atlasModel.aCodeThatCan') : txt('screens.atlasModel.pointsOfFighting', { score, result, time })}. ${status.word}.`,
  };
}

export interface WeeklyPanelView {
  week: number;
  /** "Week 44". */
  title: string;
  /** "3 days left", "Last day". */
  left: string;
  /** "The Chronomancer, with Kael, Seren and Vexis, at 10 Dissonance" (null: no entry). */
  entry: string | null;
  /** "Your best this week: 3,210" (null: none yet). */
  best: string | null;
  rows: WeeklyRowView[];
  /** "Verifying · fight 3 of 15" and a fraction (null: nothing under way). */
  progress: { line: string; fraction: number } | null;
  result: (StatusLook & { message: string }) | null;
  canBegin: boolean;
  canShare: boolean;
  /** "No results yet this week: play it, or add a friend’s code." */
  empty: string | null;
}

export function daysLeftLine(days: number): string {
  if (days <= 1) return txt('screens.atlasModel.lastDay');
  return `${days} ${plural(days, 'day')} left`;
}

export function weeklyPanelView(input: WeeklyPanelInput): WeeklyPanelView {
  const rows = input.rows.map((r, i) => weeklyRow(r, i + 1));
  const p = input.progress;
  const fraction = p
    ? p.totalTicks > 0
      ? Math.max(0, Math.min(1, p.ticks / p.totalTicks))
      : 0
    : 0;
  return {
    week: input.week,
    title: txt('screens.atlasModel.week', { week: input.week }),
    left: daysLeftLine(input.daysLeft),
    entry: input.entry ? input.entryLine : null,
    best:
      input.best === null
        ? null
        : txt('screens.atlasModel.yourBestThisWeek', { best: fmt(input.best) }),
    rows,
    progress: p
      ? {
          line: txt('screens.atlasModel.verifyingFightOf', {
            min: Math.min(p.fight + 1, Math.max(1, p.fights)),
            fights: p.fights,
          }),
          fraction,
        }
      : null,
    result: input.result
      ? { ...STATUS_LOOK[input.result.status], message: input.result.message }
      : null,
    canBegin: input.canBegin && input.entry !== null,
    canShare: input.shareCode !== null,
    empty: rows.length === 0 ? txt('screens.atlasModel.noResultsYetThis') : null,
  };
}

// ── The Summary ────────────────────────────────────────────────────────────────────────

export interface SummaryAtlasView {
  echo: string;
  name: string;
  /** "Echo cleared at 12 Dissonance". */
  title: string;
  /** "two stars lit" (null: none new). */
  litLine: string | null;
  /** The stars after the run, 1-3, and the ones newly lit. */
  stars: number;
  lit: number[];
  /** "+100 Tuning Shards", "+40 Tuning Shards and 1 Discord Tear" (null: nothing new). */
  rewards: string | null;
  /** "A new best for this Echo." (null otherwise). */
  bestLine: string | null;
  /** "Borrowed Crowns is complete: the robe Crownless is yours." and the Atlas's, if any. */
  completions: string[];
  /** Star rows, for the card. */
  rows: StarRow[];
  /** One line for screen readers and the share line. */
  line: string;
}

/**
 * What the run's end did in the Atlas (`recordStars`' `AtlasRecord`), in the Summary's words.
 * `cleared` is whether the run was won: a lost or abandoned Echo lights no star, and says so.
 */
export function summaryAtlasView(r: AtlasRecord, cleared = true): SummaryAtlasView | null {
  if (r.echo === null) return null;
  const echo = echoDef(r.echo);
  const name = echo?.name ?? r.echo;
  if (!cleared) {
    const title = txt('screens.atlasModel.echoNotCleared');
    const litLine = txt('screens.atlasModel.noStarLit');
    return {
      echo: r.echo,
      name,
      title,
      litLine,
      stars: r.stars,
      lit: [],
      rewards: null,
      bestLine: null,
      completions: [],
      rows: starRows(r.stars),
      line: `${title} · ${litLine}`,
    };
  }
  const title =
    r.points > 0
      ? txt('screens.atlasModel.echoClearedAtDissonance', { points: r.points })
      : txt('screens.atlasModel.echoCleared');
  const n = r.lit.length;
  const litLine = n > 0 ? `${countWord(n)} ${plural(n, 'star')} lit` : null;
  const parts = [
    r.shards > 0 ? txt('screens.atlasModel.tuningShards', { shards: fmt(r.shards) }) : null,
    r.tears > 0
      ? txt('screens.atlasModel.discord', { tears: r.tears, tearsWord: plural(r.tears, 'Tear') })
      : null,
  ].filter((x): x is string => x !== null);
  const rewards = parts.length ? parts.join(' and ') : null;
  const completions = [
    ...r.constellations.map((id) => {
      const k = CONTENT.constellations.find((x) => x.id === id);
      return txt('screens.atlasModel.isCompleteIsYours', {
        value: k?.name ?? id,
        keepsakeLine: keepsakeLine(k?.reward ?? ''),
      });
    }),
    ...(r.wholeAtlas
      ? [
          txt('screens.atlasModel.everyStarInThe', {
            value: r.keepsakes.length
              ? txt('screens.atlasModel.isYours', {
                  andList: andList(
                    r.keepsakes
                      .filter((id) => !CONTENT.constellations.some((k) => k.reward === id))
                      .map(keepsakeLine),
                  ),
                })
              : '',
          }),
        ]
      : []),
  ];
  return {
    echo: r.echo,
    name,
    title,
    litLine,
    stars: r.stars,
    lit: [...r.lit],
    rewards,
    bestLine: r.best ? txt('screens.atlasModel.aNewBestFor') : null,
    completions,
    rows: starRows(r.stars),
    line: [title, litLine, rewards].filter(Boolean).join(' · '),
  };
}

/** The Summary's weekly slot: the weekly model's score and code (`weeklyScore`, the share code). */
export interface SummaryWeeklyInput {
  week: number;
  score: number;
  won: boolean;
  code: string | null;
  /** False: the run played no fight, so nothing was recorded (`weeklyRecords`). Omitted: true. */
  recorded?: boolean;
}

export interface SummaryWeeklyView {
  title: string;
  score: string;
  /** "Won" / "Lost". */
  result: string;
  code: string | null;
  canShare: boolean;
  /** The line that stands in for the card when nothing was recorded (absent: the card shows). */
  none?: string;
}

export function summaryWeeklyView(w: SummaryWeeklyInput): SummaryWeeklyView {
  return {
    title: txt('screens.atlasModel.thisWeekSSong', { week: w.week }),
    score: `${fmt(w.score)} ${plural(w.score, 'point')}`,
    result: w.won ? 'Won' : 'Lost',
    code: w.code,
    canShare: w.code !== null,
    ...(w.recorded === false ? { none: txt('screens.atlasModel.nothingWasRecordedNo') } : {}),
  };
}

// ── The first Finale clear's card ──────────────────────────────────────────────────────

/** A Phase 6 piece the first-clear card names: built (in content) or still to come. */
export function laterPieces(): { atlas: boolean; trueDissonance: boolean } {
  return {
    atlas: atlasInContent(),
    trueDissonance: CONTENT.dissonance.some((d) => d.effect === 'true_dissonance'),
  };
}

// ── Sounds ─────────────────────────────────────────────────────────────────────────────

/**
 * What the Summary's Atlas card sounds (audio/ui.ts): `atlasStar` with the stars the Echo now
 * has, when any star newly lit (null: none); then `atlasConstellation`, when a constellation or
 * the whole Atlas completed.
 */
export function atlasCues(
  r: Pick<AtlasRecord, 'lit' | 'stars' | 'constellations' | 'wholeAtlas'>,
): {
  stars: number | null;
  constellation: boolean;
} {
  return {
    stars: r.lit.length > 0 ? r.stars : null,
    constellation: r.constellations.length > 0 || r.wholeAtlas,
  };
}

/** What a verification's answer sounds: verified (either kind), didn't match, or nothing for a claim. */
export function verifyCue(status: VerifyStatus): 'runVerified' | 'runMismatch' | null {
  if (status === 'mismatch') return 'runMismatch';
  if (status === 'verified' || status === 'otherVersion') return 'runVerified';
  return null;
}

// ── The weekly panel's input, from the profile (the weekly model's functions) ──────────

/**
 * The weekly panel's input at `now` (ms since 1970, the caller's clock): the week (`weekOf`), its
 * days left, its entry and line, your best, the board (`weeklyBoard`), a verification's progress
 * and answer, and your own code this week (Share's).
 */
export function weeklyPanelFrom(
  weeks: readonly WeeklyWeek[] | undefined,
  now: number,
  opts: {
    progress?: WeeklyProgressInput | null;
    result?: WeeklyResultInput | null;
    canBegin: boolean;
  },
): WeeklyPanelInput {
  const week = weekOf(now);
  const entry = weeklyEntry(week);
  const rows = weeklyBoard(weeks, week);
  const mine = rows.find((r) => r.entry.mine === true && r.score !== null) ?? null;
  return {
    week,
    daysLeft: daysLeft(now),
    entry,
    entryLine: entry ? entryLine(entry) : '',
    best: bestScore(weeks, week),
    rows,
    progress: opts.progress ?? null,
    result: opts.result ?? null,
    canBegin: opts.canBegin,
    shareCode: mine?.entry.code ?? null,
  };
}

/** The Summary's weekly slot for a finished weekly run: its score, won or not, and its code. */
export function summaryWeeklyFrom(
  run: Parameters<typeof weeklyScore>[0] & { weekly?: { week: number }; outcome?: string | null },
  code: string | null,
): SummaryWeeklyInput | null {
  if (run.weekly === undefined) return null;
  return {
    week: run.weekly.week,
    score: weeklyScore(run),
    won: run.outcome === 'victory',
    code: weeklyRecords(run) ? code : null,
    ...(weeklyRecords(run) ? {} : { recorded: false }),
  };
}
