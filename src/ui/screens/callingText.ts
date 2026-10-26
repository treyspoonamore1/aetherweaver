/**
 * Plain-text parts of the Calling's screens (Phase 3c and 3d, docs/phase-3c.md, 3d.md),
 * testable without React: each option's axis, when each tier of the path is picked (in the
 * map's own terms), the path so far, the map's milestone fights, the Result's Calling line
 * and what the Martyr's low-Life options mean for the run's songs. Every number
 * comes from content (`callingText`, `optionText`) or the run (`CALLING_ROWS`).
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
import { CALLING_ROWS, callingTierDue, generateMap } from '../../meta/run';
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

// ── Axes ──────────────────────────────────────────────────────────────────────────────

/**
 * The ways a Calling can grow (docs/phase-3c.md and 3d.md "The axes"): the Luminary's
 * protect / reach and number / radiance, the Martyr's endure / share the pain / live at low Life.
 */
export type CallingAxis = 'protect' | 'reach' | 'radiance' | 'endure' | 'share' | 'lowlife';

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
};

/** Each option's own axis (the first of `OPTION_AXES`). */
export const OPTION_AXIS: Readonly<Record<string, CallingAxis>> = Object.fromEntries(
  Object.entries(OPTION_AXES).map(([id, axes]) => [id, axes[0]!]),
);

export const AXIS_LOOK: Readonly<
  Record<CallingAxis, { label: string; blurb: string; icon: IconName; color: string }>
> = {
  protect: {
    label: 'Protect',
    blurb: 'Keeps your heroes standing',
    icon: 'ward',
    color: 'var(--color-shield)',
  },
  reach: {
    label: 'Reach and number',
    blurb: 'More song, farther',
    icon: 'scatter',
    color: '#93c5fd',
  },
  radiance: {
    label: 'Radiance',
    blurb: 'Your heroes shine brighter',
    icon: 'sun',
    color: '#ffc98f',
  },
  endure: {
    label: 'Endure',
    blurb: 'You take it, and you stand',
    icon: 'heart',
    color: '#fcd5b5',
  },
  share: {
    label: 'Share the pain',
    blurb: 'More of their wounds become yours',
    icon: 'bear',
    color: '#f9a8d4',
  },
  lowlife: {
    label: 'Live at low Life',
    blurb: 'Stronger the closer you are to falling',
    icon: 'drop',
    color: '#ff6b6b',
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
  luminary: 'Radiance',
  martyr: 'Bear, and songs sung with your Life',
};

export function passiveName(id: string): string {
  return PASSIVE_NAME[id] ?? 'the passive';
}

/** Does this Calling's songs reserve Life instead of Spirit (the Martyr)? */
export function reservesLife(def: Pick<CallingDef, 'reserves'> | null | undefined): boolean {
  return def?.reserves === 'life';
}

// ── When each tier comes ──────────────────────────────────────────────────────────────

const NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];

/** "I", "II"… (0-based tier). */
export function numeral(tier: number): string {
  return NUMERALS[tier] ?? String(tier + 1);
}

/** A map to read the milestone rows from when no run is at hand (Prep's preview, the Codex). */
let referenceMap: RunMap | null = null;
function mapOf(map?: RunMap): RunMap {
  if (map) return map;
  referenceMap ??= generateMap(1);
  return referenceMap;
}

/** "First Light" → "First Light"; "The Bellwarden" → "the Bellwarden" (mid-sentence). */
function inSentence(name: string): string {
  return name.startsWith('The ') ? `the ${name.slice(4)}` : name;
}

/**
 * When a tier is picked, in the map's terms: "after First Light", "after your fight at step
 * 4", "after the Bellwarden". A row whose fights are all one encounter is named by it; the
 * others by their step (the map's header counts steps from 1).
 */
export function tierWhen(tier: number, map?: RunMap): string {
  const row = CALLING_ROWS[tier];
  if (row === undefined) return 'later in the run';
  const nodes = mapOf(map).rows[row] ?? [];
  const fights = nodes.filter((n) => n.encounterId && n.kind !== 'event');
  const encounters = [...new Set(fights.map((n) => n.encounterId!))];
  if (fights.length > 0 && fights.length === nodes.length && encounters.length === 1)
    return `after ${inSentence(encounterDef(encounters[0]!).name)}`;
  return `after your fight at step ${row + 1}`;
}

/**
 * Every tier's moment in one phrase: "after First Light, your fights at steps 4 and 6, and
 * the Bellwarden" (consecutive step fights merged).
 */
export function tierWhenList(tiers: number, map?: RunMap): string {
  const items: string[] = [];
  let steps: string[] = [];
  const flush = () => {
    if (steps.length === 1) items.push(`your fight at step ${steps[0]}`);
    else if (steps.length > 1)
      items.push(`your fights at steps ${steps.slice(0, -1).join(', ')} and ${steps.at(-1)}`);
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
      : `${items.slice(0, -1).join(', ')}, and ${items.at(-1)}`;
  return `after ${list}`;
}

/** The same, capitalised for a label on its own ("After First Light"). */
export function tierWhenLabel(tier: number, map?: RunMap): string {
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
  /** chosen; offer (being picked right now); open (still to come). */
  state: 'chosen' | 'offer' | 'open';
}

/** Each tier of the run's Calling, in order: what was taken, what's on offer, what's to come. */
export function pathSteps(
  calling: RunCalling,
  opts: { offerTier?: number | null; map?: RunMap } = {},
): PathStep[] {
  const def = callingDef(calling.id);
  return def.tiers.map((t, tier) => {
    const id = calling.path[tier] ?? null;
    const chosen = id ? callingOption(id) : null;
    return {
      tier,
      numeral: numeral(tier),
      when: tierWhen(tier, opts.map),
      options: t.options,
      chosen,
      state: chosen ? 'chosen' : opts.offerTier === tier ? 'offer' : 'open',
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
 * when it comes and its two options.
 */
export function pathTipLines(calling: RunCalling, map?: RunMap): PathTipLine[] {
  return pathSteps(calling, { map }).map((s) =>
    s.chosen
      ? {
          numeral: s.numeral,
          title: s.chosen.name,
          text: optionText(s.chosen),
          chosen: true,
          icon: s.chosen.icon,
        }
      : {
          numeral: s.numeral,
          title: tierWhenLabel(s.tier, map),
          text: `Choose ${s.options.map((o) => o.name).join(' or ')}.`,
          chosen: false,
          icon: null,
        },
  );
}

/** "The Luminary: Haloed, Wide Choir. Next pick after your fight at step 6." (aria). */
export function pathLabel(calling: RunCalling, map?: RunMap): string {
  const def = callingDef(calling.id);
  const steps = pathSteps(calling, { map });
  const taken = steps.flatMap((s) => (s.chosen ? [s.chosen.name] : []));
  const next = steps.find((s) => !s.chosen);
  return `The ${def.name}: ${taken.length ? taken.join(', ') : 'no path chosen yet'}.${
    next ? ` Next pick ${next.when}.` : ' The path is complete.'
  }`;
}

/** The next tier still open, and when it comes (null: the path is complete). */
export function nextTier(calling: RunCalling, map?: RunMap): { tier: number; when: string } | null {
  const tier = calling.path.findIndex((p) => p === null);
  return tier < 0 ? null : { tier, when: tierWhen(tier, map) };
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
  run: Pick<RunState, 'calling'>,
  node: Pick<MapNode, 'row' | 'kind' | 'encounterId'>,
): number | null {
  return callingTierDue(run, node)?.tier ?? null;
}

/** The map tooltip's line for a milestone fight. */
export function milestoneLine(
  run: Pick<RunState, 'calling'>,
  node: Pick<MapNode, 'row' | 'kind' | 'encounterId'>,
): { title: string; text: string } | null {
  const tier = callingTierAt(run, node);
  if (tier === null || !run.calling) return null;
  const options = callingDef(run.calling.id).tiers[tier]!.options;
  return {
    title: 'Your Calling grows after this fight',
    text: `Tier ${numeral(tier)}: ${options.map((o) => o.name).join(' or ')}.`,
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
  Partial<Pick<EncounterStats, 'callingBorne'>>;

/**
 * What the Calling did, in its own words. The Luminary: Radiance (and Eclipse) for the damage
 * added through the heroes, Haloed for the damage kept off them. The Martyr: what she bore for
 * them (`callingBorne`), and what Bear, Shared Wounds and the Vow kept off them
 * (`callingShielded`). Zero parts are left out. A Calling given without an id reads as the
 * Luminary (the Phase 3c callers).
 */
export function callingParts(
  stats: CallingStats,
  calling: (Pick<RunCalling, 'path'> & { id?: string }) | null,
): CallingPart[] {
  const path = calling?.path ?? [];
  const parts: CallingPart[] = [];
  if (calling?.id === 'martyr') {
    const borne = stats.callingBorne ?? 0;
    if (borne >= 1)
      parts.push({
        label: 'Borne',
        amount: borne,
        text: `Bore ${fmt(borne)} for your heroes`,
        figure: fmt(borne),
        caption: 'damage you bore for your heroes',
      });
    if (stats.callingShielded >= 1)
      parts.push({
        label: 'Kept off',
        amount: stats.callingShielded,
        text: `${fmt(stats.callingShielded)} kept off them`,
        figure: fmt(stats.callingShielded),
        caption: 'life kept off your heroes',
      });
    return parts;
  }
  if (stats.callingAmplified >= 1) {
    const label = path.includes('eclipse') ? 'Radiance and Eclipse' : 'Radiance';
    parts.push({
      label,
      amount: stats.callingAmplified,
      text: `${label}: +${fmt(stats.callingAmplified)} damage through your heroes`,
      figure: `+${fmt(stats.callingAmplified)}`,
      caption: `damage through your heroes (${label})`,
    });
  }
  if (stats.callingShielded >= 1)
    parts.push({
      label: 'Haloed',
      amount: stats.callingShielded,
      text: `Haloed: ${fmt(stats.callingShielded)} damage kept off`,
      figure: fmt(stats.callingShielded),
      caption: 'damage Haloed kept off',
    });
  return parts;
}

/**
 * "Radiance: +412 damage through your heroes · Haloed: 96 damage kept off"; the Martyr's
 * "Bore 640 for your heroes · 1,280 kept off them" (null: nothing).
 */
export function callingResultLine(
  stats: CallingStats,
  calling: (Pick<RunCalling, 'path'> & { id?: string }) | null,
): string | null {
  const parts = callingParts(stats, calling);
  return parts.length ? parts.map((p) => p.text).join(' · ') : null;
}

/** The Summary's line when the Calling did nothing over the run (what to try next time). */
export function callingNothingText(id: string, bearKey = 'B'): string {
  return id === 'martyr'
    ? `You bore nothing this run: thread a hero and press ${bearKey} to Bear when a big hit is coming at them.`
    : 'Radiance added nothing this run: bring your heroes into your field, and give them auras to hear.';
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
      ? `Your songs hold ${heldPct}% of your Life, so you fight below ${below}% from the start: ${option.name} is on all the time.`
      : `Your songs hold ${heldPct}% of your Life: ${option.name} wakes after you lose ${Math.round((top - below / 100) * 100)}% of it.`,
  };
}

// ── Prep ──────────────────────────────────────────────────────────────────────────────

/** Every Calling content holds, for Prep's picker and the Codex. */
export function allCallings(): readonly CallingDef[] {
  return CONTENT.callings;
}
