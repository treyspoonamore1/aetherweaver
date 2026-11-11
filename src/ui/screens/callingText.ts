/**
 * Plain-text parts of the Calling's screens (Phase 3c, 3d and 3e, docs/phase-3c.md, 3d.md,
 * 3e.md), testable without React: each option's axis, when each tier of the path is picked (in
 * the map's own terms), the path so far, the map's milestone fights, the Result's Calling line,
 * what the Martyr's low-Life options mean for the run's songs, and the Chronomancer's Rewind in
 * Reel's slot. Every number comes from content (`callingText`, `optionText`) or the run
 * (`callingRows`: CALLING_ROWS, or the Finale route's road, docs/phase-5d.md).
 */
import {
  CONTENT,
  callingDef,
  callingOption,
  callingText,
  encounterDef,
  optionText,
  type CallingDef,
  type CallingOption,
} from '../../content';
import { tiersOpen } from '../../meta/loom';
import { CALLING_ROWS, callingRows, callingTierDue, generateMap } from '../../meta/run';
import type {
  ChordLoadout,
  EncounterStats,
  MapNode,
  RunCalling,
  RunMap,
  RunState,
} from '../../meta/types';
import { canonicalChords, chordReserve } from '../../sim';
import { fmt } from '../kit/format';
import type { IconName } from '../kit/iconPaths';
import { t as txt } from '../text';

// ── Axes ──────────────────────────────────────────────────────────────────────────────

/**
 * The ways a Calling can grow (docs/phase-3c.md, 3d.md and 3e.md "The axes"): the Luminary's
 * protect / reach and number / radiance, the Martyr's endure / share the pain / live at low
 * Life, the Chronomancer's see it coming / more turns / undo it, the Conductor's lead them / in
 * time / more Solos (docs/phase-5f.md).
 */
export type CallingAxis =
  | 'protect'
  | 'reach'
  | 'radiance'
  | 'endure'
  | 'share'
  | 'lowlife'
  | 'foresee'
  | 'turns'
  | 'undo'
  | 'lead'
  | 'tempo'
  | 'encore';

/**
 * Content has no axis field; the design docs name each option's. An option can sit on two
 * (the Martyr's Blood Font: endure, and live at low Life again); the first is its own.
 */
export const OPTION_AXES: Readonly<Record<string, readonly CallingAxis[]>> = {
  haloed: ['protect'],
  dawnward: ['protect'],
  wide_choir: ['reach'],
  third_voice: ['reach'],
  sovereign_symphony: ['reach'],
  searing_hymns: ['radiance'],
  lantern_bearer: ['radiance'],
  eclipse: ['radiance'],
  scarred_hide: ['endure'],
  blood_font: ['endure', 'lowlife'],
  undying_devotion: ['endure'],
  penitence: ['share'],
  shared_wounds: ['share'],
  martyrs_aegis: ['share'],
  low_life_vigil: ['lowlife'],
  sanguine_covenant: ['lowlife'],
  foresight: ['foresee'],
  echo_ward: ['foresee'],
  slow_dance: ['foresee'],
  quickened: ['turns'],
  temporal_mastery: ['turns'],
  eternal_moment: ['turns'],
  borrowed_time: ['undo'],
  paradox: ['undo'],
  marcato: ['lead'],
  ensemble: ['lead'],
  spotlight: ['lead'],
  a_tempo: ['tempo'],
  upbeat: ['tempo'],
  triad: ['tempo'],
  reprise: ['encore'],
  maestro: ['encore'],
};

/** Each option's own axis (the first of `OPTION_AXES`). */
export const OPTION_AXIS: Readonly<Record<string, CallingAxis>> = Object.fromEntries(
  Object.entries(OPTION_AXES).map(([id, axes]) => [id, axes[0]!]),
);

export const AXIS_LOOK: Readonly<
  Record<CallingAxis, { label: string; blurb: string; icon: IconName; color: string }>
> = {
  protect: {
    get label() {
      return txt('screens.callingText.protect');
    },
    get blurb() {
      return txt('screens.callingText.keepsYourHeroesStanding');
    },
    icon: 'ward',
    color: 'var(--color-shield)',
  },
  reach: {
    get label() {
      return txt('screens.callingText.reachAndNumber');
    },
    get blurb() {
      return txt('screens.callingText.moreSongFarther');
    },
    icon: 'scatter',
    color: '#93c5fd',
  },
  radiance: {
    get label() {
      return txt('screens.callingText.radiance');
    },
    get blurb() {
      return txt('screens.callingText.yourHeroesShineBrighter');
    },
    icon: 'sun',
    color: '#ffc98f',
  },
  endure: {
    get label() {
      return txt('screens.callingText.endure');
    },
    get blurb() {
      return txt('screens.callingText.youTakeItAnd');
    },
    icon: 'heart',
    color: '#fcd5b5',
  },
  share: {
    get label() {
      return txt('screens.callingText.shareThePain');
    },
    get blurb() {
      return txt('screens.callingText.moreOfTheirWounds');
    },
    icon: 'bear',
    color: '#f9a8d4',
  },
  lowlife: {
    get label() {
      return txt('screens.callingText.liveAtLowLife');
    },
    get blurb() {
      return txt('screens.callingText.strongerTheCloserYou');
    },
    icon: 'drop',
    color: '#ff6b6b',
  },
  foresee: {
    get label() {
      return txt('screens.callingText.seeItComing');
    },
    get blurb() {
      return txt('screens.callingText.knowWhatComesAnd');
    },
    icon: 'eye',
    color: '#b8d3f2',
  },
  turns: {
    get label() {
      return txt('screens.callingText.moreTurns');
    },
    get blurb() {
      return txt('screens.callingText.yourTechniquesComeBack');
    },
    icon: 'clock',
    color: '#e3c27e',
  },
  undo: {
    get label() {
      return txt('screens.callingText.undoIt');
    },
    get blurb() {
      return txt('screens.callingText.takeBackWhatJust');
    },
    icon: 'rewind',
    // A deeper violet than a pale lilac: it stays apart from the ice of "See it coming" for
    // red-green colour vision (ΔE ≥ 25 between all three of his axes, in every mode).
    color: '#be9bfa',
  },
  // The Conductor's three (docs/phase-5f.md): his ivory, an ink-blue and a rose, ΔE ≥ 25 from one
  // another in every colour-vision mode, each with its glyph.
  lead: {
    get label() {
      return txt('screens.callingText.leadThem');
    },
    get blurb() {
      return txt('screens.callingText.yourHeroesHitHarder');
    },
    icon: 'swords',
    color: '#f4eedd',
  },
  tempo: {
    get label() {
      return txt('screens.callingText.inTime');
    },
    get blurb() {
      return txt('screens.callingText.theBeatAndThe');
    },
    icon: 'clock',
    color: '#7c8cf8',
  },
  encore: {
    get label() {
      return txt('screens.callingText.moreSolos');
    },
    get blurb() {
      return txt('screens.callingText.solosComeRoundSooner');
    },
    icon: 'note',
    color: '#d4789c',
  },
};

export function optionAxis(id: string): CallingAxis | null {
  return OPTION_AXES[id]?.[0] ?? null;
}

/** Every axis an option sits on (Blood Font: two). */
export function optionAxes(id: string): readonly CallingAxis[] {
  return OPTION_AXES[id] ?? [];
}

/** The axes a Calling's options use, in the order they first appear (the Codex's legend). */
export function callingAxes(def: CallingDef): CallingAxis[] {
  const out: CallingAxis[] = [];
  for (const t of def.tiers)
    for (const o of t.options) for (const a of optionAxes(o.id)) if (!out.includes(a)) out.push(a);
  return out;
}

// ── The Crescendo and the passive ─────────────────────────────────────────────────────

/** The Calling's own Crescendo: the Martyr's Vow, or Sunrise (content `crescendoName`). */
export function crescendoName(def: Pick<CallingDef, 'crescendoName'> | null | undefined): string {
  return def?.crescendoName ?? CONTENT.crescendo.name;
}

/**
 * The Crescendo line, split so its name can be set in bold: "Sunrise burns brighter: …" →
 * name "Sunrise", rest " burns brighter: …". A line that doesn't start with the name gets it
 * as a lead-in ("Martyr’s Vow." + the line).
 */
export function crescendoLine(def: CallingDef): { name: string; rest: string; lead: boolean } {
  const name = crescendoName(def);
  const text = callingText(def).crescendo;
  return text.startsWith(name)
    ? { name, rest: text.slice(name.length), lead: false }
    : { name, rest: text, lead: true };
}

/** What the Calling always gives, for the tier screen's reminder ("Always yours · Radiance"). */
export const PASSIVE_NAME: Readonly<Record<string, string>> = {
  get luminary() {
    return txt('screens.callingText.radiance');
  },
  get martyr() {
    return txt('screens.callingText.bearAndSongsSung');
  },
  get chronomancer() {
    return txt('screens.callingText.rewindTelegraphTimersAnd');
  },
  get conductor() {
    return txt('screens.callingText.cheapCuesDuetsAnd');
  },
};

export function passiveName(id: string): string {
  return PASSIVE_NAME[id] ?? txt('screens.callingText.thePassive');
}

/** Does this Calling's songs reserve Life instead of Spirit (the Martyr)? */
export function reservesLife(def: Pick<CallingDef, 'reserves'> | null | undefined): boolean {
  return def?.reserves === 'life';
}

// ── Rewind in Reel's slot (the Chronomancer) ──────────────────────────────────────────

/** What Reel's slot is called on a Chronomancer run (the sim's `'rewind'` technique). */
export const REWIND_NAME = 'Rewind';

/**
 * Does this Calling's Rewind replace Reel (the F key, `cooldowns.reel`)? Content's `rewind`
 * value is how far back it reaches; the sim's resolver reads the same (`rewindSeconds`).
 */
export function rewindsFor(callingId: string | null | undefined): boolean {
  if (!callingId) return false;
  const def = CONTENT.callings.find((c) => c.id === callingId);
  return (def?.values.rewind ?? 0) > 0;
}

/** How far back Rewind reaches, in seconds (0 without it). */
export function rewindSeconds(callingId: string | null | undefined): number {
  if (!rewindsFor(callingId)) return 0;
  return CONTENT.callings.find((c) => c.id === callingId)!.values.rewind!;
}

/**
 * The run's word on Rewind's revive, which comes once a run: null without Rewind or while it's
 * still to come.
 */
export function reviveSpentLine(
  calling: Pick<RunCalling, 'id' | 'reviveSpent'> | null,
): string | null {
  return calling && rewindsFor(calling.id) && calling.reviveSpent
    ? txt('screens.callingText.rewindHasStoodA')
    : null;
}

/** A technique's name on this run: Reel's slot is Rewind's on a Chronomancer run. */
export function techniqueName(
  key: 'ward' | 'chime' | 'reel' | 'glide',
  callingId: string | null | undefined,
): string {
  if (key === 'reel' && rewindsFor(callingId)) return REWIND_NAME;
  return CONTENT.techniques[key].name;
}

// ── When each tier comes ──────────────────────────────────────────────────────────────

const NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];

/** "I", "II"… (0-based tier). */
export function numeral(tier: number): string {
  return NUMERALS[tier] ?? String(tier + 1);
}

/**
 * Where the milestone rows are read: a run's map (its route is the Movements it holds), a route
 * alone (`{ movements }`: its reference map, seed 1), or neither (the Prelude's, as Prep's
 * preview and the Codex have always read them).
 */
export type TierPlace = RunMap | Partial<Pick<RunState, 'map' | 'movements' | 'echo'>>;

/** Reference maps, by route, to read the milestone rows from when no run is at hand. */
const referenceMaps = new Map<number, RunMap>();
function referenceMap(movements: number): RunMap {
  let map = referenceMaps.get(movements);
  if (!map) {
    map = generateMap(1, movements);
    referenceMaps.set(movements, map);
  }
  return map;
}

/** The milestone rows and the map they fall on, for `at` (`TierPlace`). */
function tierPlace(at?: TierPlace): { rows: readonly number[]; map: RunMap } {
  if (at && 'rows' in at) return { rows: callingRows({ movements: mapRoute(at) }), map: at };
  if (at?.map || at?.movements !== undefined) {
    // A map without its route reads the route off the map, as a bare map does.
    const movements = at.movements ?? (at.map ? mapRoute(at.map) : 1);
    // Phase 6: an Echo's tiers fall on rows of its own route (`callingRows` reads its `echo`).
    const echo = at.echo !== undefined ? { echo: at.echo } : {};
    return { rows: callingRows({ movements, ...echo }), map: at.map ?? referenceMap(movements) };
  }
  return { rows: CALLING_ROWS, map: referenceMap(1) };
}

/** A map's route: as many Movements as it holds (a saved I-III map keeps CALLING_ROWS). */
function mapRoute(map: RunMap): number {
  return Math.max(1, ...map.rows.map((r) => r[0]?.movement ?? 1));
}

/** "First Light" → "First Light"; "The Bellwarden" → "the Bellwarden" (mid-sentence). */
function inSentence(name: string): string {
  return name.startsWith('The ') ? `the ${name.slice(4)}` : name;
}

/**
 * When a tier is picked, in the map's terms: "after First Light", "after your fight at step
 * 4", "after the Bellwarden" (on the Finale route's road: "after the Hollow Cantor" for tier IV,
 * docs/phase-5d.md). A row whose fights are all one encounter is named by it; the others by
 * their step (the map's header counts steps from 1). `at`: the run's map or route (absent: the
 * Prelude's, as it always read).
 */
export function tierWhen(tier: number, at?: TierPlace): string {
  const place = tierPlace(at);
  const row = place.rows[tier];
  if (row === undefined) return txt('screens.callingText.laterInTheRun');
  const rows = place.map.rows;
  const nodes = rows[row] ?? [];
  const fights = nodes.filter((n) => n.encounterId && n.kind !== 'event');
  const encounters = [...new Set(fights.map((n) => n.encounterId!))];
  if (fights.length > 0 && fights.length === nodes.length && encounters.length === 1)
    return `after ${inSentence(encounterDef(encounters[0]!).name)}`;
  return txt('screens.callingText.afterYourFightAt', { stepInMovement: stepInMovement(rows, row) });
}

/**
 * A row's step as the map's header counts it: from 1, within its Movement (docs/phase-5a.md; the
 * Calling's tiers all fall in Movement I, on every route, whose steps are its rows).
 */
function stepInMovement(rows: RunMap['rows'], row: number): number {
  const movement = rows[row]?.[0]?.movement ?? 1;
  const first = rows.findIndex((r) => (r[0]?.movement ?? 1) === movement);
  return row - Math.max(0, first) + 1;
}

/**
 * Every tier's moment in one phrase: "after First Light, your fights at steps 4 and 6, and
 * the Bellwarden" (consecutive step fights merged).
 */
export function tierWhenList(tiers: number, map?: TierPlace): string {
  const items: string[] = [];
  let steps: string[] = [];
  const flush = () => {
    if (steps.length === 1)
      items.push(txt('screens.callingText.yourFightAtStep', { value: steps[0] }));
    else if (steps.length > 1)
      items.push(
        txt('screens.callingText.yourFightsAtSteps', {
          steps: steps.slice(0, -1).join(', '),
          at: steps.at(-1),
        }),
      );
    steps = [];
  };
  for (let t = 0; t < tiers; t++) {
    const when = tierWhen(t, map).replace(/^after /, '');
    const step = /^your fight at step (\d+)$/.exec(when);
    if (step) steps.push(step[1]!);
    else {
      flush();
      items.push(when);
    }
  }
  flush();
  const list =
    items.length <= 2
      ? items.join(' and ')
      : txt('screens.callingText.and', { items: items.slice(0, -1).join(', '), at: items.at(-1) });
  return `after ${list}`;
}

/** The same, capitalised for a label on its own ("After First Light"). */
export function tierWhenLabel(tier: number, map?: TierPlace): string {
  const s = tierWhen(tier, map);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ── The path ──────────────────────────────────────────────────────────────────────────

export interface PathStep {
  tier: number;
  numeral: string;
  /** "after your fight at step 4". */
  when: string;
  options: readonly CallingOption[];
  /** The option taken at this tier (null: not yet). */
  chosen: CallingOption | null;
  /**
   * chosen; offer (being picked right now); open (still to come); locked (Phase 4g: the
   * Calling's mastery hadn't opened it when the run embarked, so this run never offers it).
   */
  state: 'chosen' | 'offer' | 'open' | 'locked';
  /** The mastery level that opens this tier (Phase 4g): tier I at 1. */
  mastery: number;
}

/** The mastery level that opens a tier of a Calling's path (Phase 4g): tier I at 1, and so on. */
export function tierMastery(callingId: string, tier: number): number {
  const levels = CONTENT.mastery.levels;
  for (let level = 1; level <= levels.length; level++)
    if (tiersOpen(callingId, levels[level - 1]!, false) > tier) return level;
  return levels.length;
}

/**
 * Each tier of the run's Calling, in order: what was taken, what's on offer, what's to come, and
 * (Phase 4g) what its mastery keeps shut: past `tiersOpen` (the run's own, snapshotted at
 * embark; Prep passes the profile's). None given, as on runs from before mastery: every tier.
 */
export function pathSteps(
  calling: RunCalling,
  opts: { offerTier?: number | null; map?: TierPlace; tiersOpen?: number } = {},
): PathStep[] {
  const def = callingDef(calling.id);
  const open = opts.tiersOpen ?? calling.tiersOpen ?? def.tiers.length;
  return def.tiers.map((t, tier) => {
    const id = calling.path[tier] ?? null;
    const chosen = id ? callingOption(id) : null;
    return {
      tier,
      numeral: numeral(tier),
      when: tierWhen(tier, opts.map),
      options: t.options,
      chosen,
      state: chosen
        ? 'chosen'
        : opts.offerTier === tier
          ? 'offer'
          : tier >= open
            ? 'locked'
            : 'open',
      mastery: tierMastery(def.id, tier),
    };
  });
}

export interface PathTipLine {
  numeral: string;
  /** The option's name, or when the tier comes. */
  title: string;
  /** What the option does, or the two options to come. */
  text: string;
  chosen: boolean;
  icon: string | null;
}

/**
 * The path as tooltip lines: each chosen option with what it does, then each open tier with
 * when it comes and its two options, and (Phase 4g) each tier its mastery keeps shut.
 */
export function pathTipLines(calling: RunCalling, map?: TierPlace): PathTipLine[] {
  const name = callingDef(calling.id).name;
  return pathSteps(calling, { map }).map((s) =>
    s.chosen
      ? {
          numeral: s.numeral,
          title: s.chosen.name,
          text: optionText(s.chosen),
          chosen: true,
          icon: s.chosen.icon,
        }
      : s.state === 'locked'
        ? {
            numeral: s.numeral,
            title: txt('screens.callingText.lockedMastery', { name, mastery: s.mastery }),
            text: txt('screens.callingText.notThisRunOnce', {
              options: s.options.map((o) => o.name).join(' or '),
            }),
            chosen: false,
            icon: null,
          }
        : {
            numeral: s.numeral,
            title: tierWhenLabel(s.tier, map),
            text: txt('screens.callingText.choose', {
              options: s.options.map((o) => o.name).join(' or '),
            }),
            chosen: false,
            icon: null,
          },
  );
}

/**
 * "The Luminary: Haloed, Wide Choir. Next pick after your fight at step 6." (aria). Phase 4g:
 * "…Tiers III and IV are locked: they open with mastery 3 and 4." when they are.
 */
export function pathLabel(calling: RunCalling, map?: TierPlace): string {
  const def = callingDef(calling.id);
  const steps = pathSteps(calling, { map });
  const taken = steps.flatMap((s) => (s.chosen ? [s.chosen.name] : []));
  const next = steps.find((s) => s.state === 'open');
  const locked = steps.filter((s) => s.state === 'locked');
  const one = locked.length === 1;
  const shut =
    locked.length === 0
      ? ''
      : txt('screens.callingText.lockedWithMastery', {
          value: one ? txt('screens.callingText.tier2') : txt('screens.callingText.tiers'),
          spanOf: spanOf(locked.map((s) => s.numeral)),
          value2: one ? txt('screens.callingText.is') : txt('screens.callingText.are'),
          value3: one ? txt('screens.callingText.itOpens') : txt('screens.callingText.theyOpen'),
          spanOf2: spanOf(locked.map((s) => String(s.mastery))),
        });
  return txt('screens.callingText.the', {
    name: def.name,
    value: taken.length ? taken.join(', ') : txt('screens.callingText.noPathChosenYet'),
    value2: next
      ? txt('screens.callingText.nextPick', { when: next.when })
      : locked.length > 0
        ? ''
        : txt('screens.callingText.thePathIsComplete'),
    shut,
  });
}

/** "I", "I and II", "I, II and III". */
export function listOf(items: readonly string[]): string {
  return items.length <= 2
    ? items.join(' and ')
    : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;
}

/** A run of three or more as a span ("II–IV", "2–4"); fewer as a list ("III and IV"). */
export function spanOf(items: readonly string[]): string {
  return items.length >= 3 ? `${items[0]}–${items.at(-1)}` : listOf(items);
}

/**
 * The next tier still to come this run, and when (null: the path is complete, or the rest is
 * locked by mastery, Phase 4g).
 */
export function nextTier(
  calling: RunCalling,
  map?: TierPlace,
): { tier: number; when: string } | null {
  const tier = calling.path.findIndex((p) => p === null);
  const open = calling.tiersOpen ?? calling.path.length;
  return tier < 0 || tier >= open ? null : { tier, when: tierWhen(tier, map) };
}

/** The option on the path that adds field-song slots (Third Voice), if any. */
export function slotOption(calling: RunCalling | null): CallingOption | null {
  for (const id of calling?.path ?? []) {
    if (!id) continue;
    const o = callingOption(id);
    if ((o.values.slots ?? 0) > 0) return o;
  }
  return null;
}

/** The extra field slots' owner, for the song builder's marks (null: none). */
export function slotBonus(
  run: Pick<RunState, 'calling'>,
): { name: string; icon: string; callingId: string } | null {
  const o = slotOption(run.calling);
  return o && run.calling ? { name: o.name, icon: o.icon, callingId: run.calling.id } : null;
}

/** The run with `optionId` taken at `tier` (to preview Third Voice's slot before committing). */
export function withOption(run: RunState, tier: number, optionId: string): RunState {
  if (!run.calling) return run;
  return {
    ...run,
    calling: {
      ...run.calling,
      path: run.calling.path.map((p, i) => (i === tier ? optionId : p)),
    },
  };
}

// ── The map: milestone fights ─────────────────────────────────────────────────────────

/**
 * The tier this node's victory brings, if it's a fight on a milestone row whose tier is still
 * open (the run's `callingTierDue`): event fights never bring one.
 */
export function callingTierAt(
  run: Pick<RunState, 'calling' | 'movements'>,
  node: Pick<MapNode, 'row' | 'kind' | 'encounterId'>,
): number | null {
  return callingTierDue(run, node)?.tier ?? null;
}

/** The map tooltip's line for a milestone fight. */
export function milestoneLine(
  run: Pick<RunState, 'calling' | 'movements'>,
  node: Pick<MapNode, 'row' | 'kind' | 'encounterId'>,
): { title: string; text: string } | null {
  const tier = callingTierAt(run, node);
  if (tier === null || !run.calling) return null;
  const options = callingDef(run.calling.id).tiers[tier]!.options;
  return {
    title: txt('screens.callingText.yourCallingGrowsAfter'),
    text: txt('screens.callingText.tier', {
      numeral: numeral(tier),
      options: options.map((o) => o.name).join(' or '),
    }),
  };
}

// ── Result and Summary ────────────────────────────────────────────────────────────────

export interface CallingPart {
  /** "Radiance", "Radiance and Eclipse", "Haloed"; the Martyr's "Borne", "Kept off". */
  label: string;
  amount: number;
  /** The Result's words for it: "Haloed: 96 damage kept off", "Bore 640 for your heroes". */
  text: string;
  /** The Summary's figure ("+412", "640") and its caption. */
  figure: string;
  caption: string;
}

type CallingStats = Pick<EncounterStats, 'callingAmplified' | 'callingShielded'> &
  Partial<
    Pick<EncounterStats, 'callingBorne' | 'callingRewound' | 'callingRevived' | 'conducting'>
  >;

// ── The Conductor (docs/phase-5f.md) ──────────────────────────────────────────────────

/** The Conductor's content (the Calling whose passive chains Cues into Duets and Trios). */
export function conductorDef(): CallingDef | null {
  return CONTENT.callings.find((c) => (c.values.duet ?? 0) > 0) ?? null;
}

/** Does this Calling chain Cues into Duets and Trios (the Conductor)? */
export function conductsFor(callingId: string | null | undefined): boolean {
  return !!callingId && conductorDef()?.id === callingId;
}

/** "Duet", "Trio": what a Cue at this place in a chain plays as (1 starts one: a plain Cue). */
export function linkName(link: 1 | 2 | 3): string {
  return link === 3
    ? txt('screens.callingText.trio')
    : link === 2
      ? txt('screens.callingText.duet')
      : txt('screens.callingText.cue');
}

/** A Solo's power as the HUD says it: ×1.25, ×1.5, ×1.44, ×2.49 (two decimals at most). */
export function powerLabel(power: number): string {
  return `×${Number(power.toFixed(2))}`;
}

/**
 * The Conductor's parts of a fight or a run: the damage his Cues and his path added through the
 * heroes (the Calling's share, `callingAmplified`), then his tallies (`conducting`): Duets,
 * Trios, the Grand Finale's Solos and the free Cues. Zero parts are left out.
 */
function conductingParts(stats: CallingStats): CallingPart[] {
  const parts: CallingPart[] = [];
  const c = stats.conducting;
  const finale = crescendoName(conductorDef());
  if (stats.callingAmplified >= 1)
    parts.push({
      label: txt('screens.callingText.led'),
      amount: stats.callingAmplified,
      text: txt('screens.callingText.damageThroughYourHeroes', {
        callingAmplified: fmt(stats.callingAmplified),
      }),
      figure: `+${fmt(stats.callingAmplified)}`,
      caption: txt('screens.callingText.damageYourDuetsTrios'),
    });
  if (!c) return parts;
  const count = (n: number, one: string, many: string) => `${fmt(n)} ${n === 1 ? one : many}`;
  if (c.duets >= 1)
    parts.push({
      label: txt('screens.callingText.duets'),
      amount: c.duets,
      text: count(c.duets, 'Duet', 'Duets'),
      figure: fmt(c.duets),
      caption: c.duets === 1 ? txt('screens.callingText.duet') : txt('screens.callingText.duets'),
    });
  if (c.trios >= 1)
    parts.push({
      label: txt('screens.callingText.trios'),
      amount: c.trios,
      text: count(c.trios, 'Trio', 'Trios'),
      figure: fmt(c.trios),
      caption: c.trios === 1 ? txt('screens.callingText.trio') : txt('screens.callingText.trios'),
    });
  if (c.finaleSolos >= 1)
    parts.push({
      label: finale,
      amount: c.finaleSolos,
      text: txt('screens.callingText.played', {
        finale,
        count: count(c.finaleSolos, 'Solo', 'Solos'),
      }),
      figure: fmt(c.finaleSolos),
      caption: txt('screens.callingText.solosPlayed', { finale }),
    });
  // Cues that cost nothing on the downbeat (A Tempo; the sim counts only those that cost 0).
  if (c.freeCues >= 1)
    parts.push({
      label: txt('screens.callingText.freeCues'),
      amount: c.freeCues,
      text: count(
        c.freeCues,
        txt('screens.callingText.freeCue'),
        txt('screens.callingText.freeCues2'),
      ),
      figure: fmt(c.freeCues),
      caption:
        c.freeCues === 1
          ? txt('screens.callingText.freeCue')
          : txt('screens.callingText.freeCues2'),
    });
  return parts;
}

/**
 * The Summary's word on a Conductor run that never chained a Cue (null otherwise, or once a Duet
 * was played): how a Duet is made, with the window from content.
 */
export function conductingTip(
  callingId: string | null | undefined,
  stats: Pick<EncounterStats, 'conducting'>,
): string | null {
  const def = conductorDef();
  if (!def || !conductsFor(callingId)) return null;
  const c = stats.conducting;
  if (c && c.duets + c.trios > 0) return null;
  return txt('screens.callingText.noDuetThisRun', {
    value: def.values.chain ?? 0,
    value2: def.values.duet ?? 0,
  });
}

/**
 * What the Calling did, in its own words. The Luminary: Radiance (and Eclipse) for the damage
 * added through the heroes, Haloed for the damage kept off them. The Martyr: what she bore for
 * them (`callingBorne`), and what Bear, Shared Wounds and the Vow kept off them
 * (`callingShielded`). The Chronomancer: the life Rewind gave back (`callingRewound`, revives
 * included) and the heroes it stood back up (`callingRevived`). The Conductor: the damage his
 * Cues and path added, his Duets, Trios, Finale Solos and free Cues (`conductingParts`). Zero
 * parts are left out. A Calling given without an id reads as the Luminary (the Phase 3c callers).
 */
export function callingParts(
  stats: CallingStats,
  calling: (Pick<RunCalling, 'path'> & { id?: string }) | null,
): CallingPart[] {
  const path = calling?.path ?? [];
  if (conductsFor(calling?.id)) return conductingParts(stats);
  const parts: CallingPart[] = [];
  if (rewindsFor(calling?.id)) {
    const rewound = stats.callingRewound ?? 0;
    const revived = stats.callingRevived ?? 0;
    if (rewound >= 1)
      parts.push({
        label: txt('screens.callingText.rewound'),
        amount: rewound,
        text: txt('screens.callingText.gaveBackLife', { REWIND_NAME, rewound: fmt(rewound) }),
        figure: fmt(rewound),
        caption: txt('screens.callingText.lifeGaveBackTo', { REWIND_NAME }),
      });
    if (revived >= 1) {
      const heroes = `${fmt(revived)} ${revived === 1 ? 'hero' : 'heroes'}`;
      parts.push({
        label: txt('screens.callingText.stoodBackUp'),
        amount: revived,
        text: txt('screens.callingText.backUp', {
          value:
            parts.length > 0
              ? txt('screens.callingText.stood')
              : txt('screens.callingText.stood2', { REWIND_NAME }),
          heroes,
        }),
        figure: fmt(revived),
        caption: txt('screens.callingText.stoodBackUp2', {
          value:
            revived === 1 ? txt('screens.callingText.hero') : txt('screens.callingText.heroes'),
          REWIND_NAME,
        }),
      });
    }
    return parts;
  }
  if (calling?.id === 'martyr') {
    const borne = stats.callingBorne ?? 0;
    if (borne >= 1)
      parts.push({
        label: txt('screens.callingText.borne'),
        amount: borne,
        text: txt('screens.callingText.boreForYourHeroes', { borne: fmt(borne) }),
        figure: fmt(borne),
        caption: txt('screens.callingText.damageYouBoreFor'),
      });
    if (stats.callingShielded >= 1)
      parts.push({
        label: txt('screens.callingText.keptOff'),
        amount: stats.callingShielded,
        text: txt('screens.callingText.keptOffThem', {
          callingShielded: fmt(stats.callingShielded),
        }),
        figure: fmt(stats.callingShielded),
        caption: txt('screens.callingText.lifeKeptOffYour'),
      });
    return parts;
  }
  if (stats.callingAmplified >= 1) {
    const label = path.includes('eclipse')
      ? txt('screens.callingText.radianceAndEclipse')
      : txt('screens.callingText.radiance');
    parts.push({
      label,
      amount: stats.callingAmplified,
      text: txt('screens.callingText.damageThroughYourHeroes2', {
        label,
        callingAmplified: fmt(stats.callingAmplified),
      }),
      figure: `+${fmt(stats.callingAmplified)}`,
      caption: txt('screens.callingText.damageThroughYourHeroes3', { label }),
    });
  }
  if (stats.callingShielded >= 1)
    parts.push({
      label: txt('screens.callingText.haloed'),
      amount: stats.callingShielded,
      text: txt('screens.callingText.haloedDamageKeptOff', {
        callingShielded: fmt(stats.callingShielded),
      }),
      figure: fmt(stats.callingShielded),
      caption: txt('screens.callingText.damageHaloedKeptOff'),
    });
  return parts;
}

/**
 * "Radiance: +412 damage through your heroes · Haloed: 96 damage kept off"; the Martyr's
 * "Bore 640 for your heroes · 1,280 kept off them"; the Chronomancer's "Rewind gave back 1,240
 * life · stood 1 hero back up" (null: nothing).
 */
export function callingResultLine(
  stats: CallingStats,
  calling: (Pick<RunCalling, 'path'> & { id?: string }) | null,
): string | null {
  const parts = callingParts(stats, calling);
  return parts.length ? parts.map((p) => p.text).join(' · ') : null;
}

/**
 * The Summary's line when the Calling did nothing over the run (what to try next time). The
 * keys are the player's: Bear's for the Martyr, Reel's slot (Rewind) for the Chronomancer.
 */
export function callingNothingText(id: string, bearKey = 'B', rewindKey = 'F'): string {
  if (conductsFor(id))
    return txt('screens.callingText.yourCallingAddedNothing', {
      value: conductorDef()!.values.chain ?? 0,
    });
  if (rewindsFor(id))
    return txt('screens.callingText.rewindGaveNothingBack', {
      rewindKey,
      rewindSeconds: rewindSeconds(id),
    });
  return id === 'martyr'
    ? txt('screens.callingText.youBoreNothingThis', { bearKey })
    : txt('screens.callingText.radianceAddedNothingThis');
}

// ── Living at low Life (the Martyr) ───────────────────────────────────────────────────

/** A share of the Weaver's Life that an option on the path works below (Blood Font, Vigil). */
export interface LowLifeMark {
  id: string;
  name: string;
  icon: string;
  /** 0..1 of all her Life (reserved included), from the option's `below` value. */
  below: number;
  /** "Blood Font: below 50% of your Life, …" (the option's own text). */
  text: string;
}

/** The thresholds the path's options mark on the Weaver's Life (content `below` values). */
export function lowLifeMarks(path: readonly (string | null)[]): LowLifeMark[] {
  const out: LowLifeMark[] = [];
  for (const id of path) {
    if (!id) continue;
    const o = callingOption(id);
    const below = o.values.below;
    if (below === undefined) continue;
    out.push({ id, name: o.name, icon: o.icon, below: below / 100, text: optionText(o) });
  }
  return out.sort((a, b) => a.below - b.below);
}

/**
 * An option that works below a share of the Weaver's Life (Blood Font, Low-Life Vigil: a
 * `below` value), with what the run's songs mean for it: they hold `held` of her Life, so she
 * fights at most at `1 - held`. Null for an option without a threshold.
 */
export function belowNote(
  option: CallingOption,
  chords: readonly ChordLoadout[],
): { below: number; held: number; always: boolean; text: string } | null {
  const below = option.values.below;
  if (below === undefined) return null;
  const held = chordReserve(canonicalChords(chords));
  const top = 1 - held;
  const always = top < below / 100 - 1e-9;
  const heldPct = Math.round(held * 100);
  return {
    below: below / 100,
    held,
    always,
    text: always
      ? txt('screens.callingText.yourSongsHoldOf', { heldPct, below, name: option.name })
      : txt('screens.callingText.yourSongsHoldOf2', {
          heldPct,
          name: option.name,
          round: Math.round((top - below / 100) * 100),
        }),
  };
}

// ── Prep ──────────────────────────────────────────────────────────────────────────────

/** Every Calling content holds, for Prep's picker and the Codex. */
export function allCallings(): readonly CallingDef[] {
  return CONTENT.callings;
}
