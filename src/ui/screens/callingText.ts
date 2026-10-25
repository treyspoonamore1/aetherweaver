/**
 * Plain-text parts of the Calling's screens (Phase 3c, docs/phase-3c.md), testable without
 * React: each option's axis, when each tier of the path is picked (in the map's own terms),
 * the path so far, the map's milestone fights, and the Result's Calling line. Every number
 * comes from content (`callingText`, `optionText`) or the run (`CALLING_ROWS`).
 */
import {
  CONTENT,
  callingDef,
  callingOption,
  encounterDef,
  optionText,
  type CallingDef,
  type CallingOption,
} from '../../content';
import { CALLING_ROWS, callingTierDue, generateMap } from '../../meta/run';
import type { EncounterStats, MapNode, RunCalling, RunMap, RunState } from '../../meta/types';
import { fmt } from '../kit/format';
import type { IconName } from '../kit/iconPaths';

// ── Axes ──────────────────────────────────────────────────────────────────────────────

/** The three ways a Luminary can grow (docs/phase-3c.md "The axes"). */
export type CallingAxis = 'protect' | 'reach' | 'radiance';

/** Content has no axis field; the design doc names each option's. */
export const OPTION_AXIS: Readonly<Record<string, CallingAxis>> = {
  haloed: 'protect',
  dawnward: 'protect',
  wide_choir: 'reach',
  third_voice: 'reach',
  sovereign_symphony: 'reach',
  searing_hymns: 'radiance',
  lantern_bearer: 'radiance',
  eclipse: 'radiance',
};

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
};

export function optionAxis(id: string): CallingAxis | null {
  return OPTION_AXIS[id] ?? null;
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
  /** "Radiance", "Radiance and Eclipse", "Haloed". */
  label: string;
  amount: number;
  text: string;
}

/**
 * What the Calling did, by the path's names: Radiance (and Eclipse) for the damage added
 * through the heroes, Haloed for the damage kept off them. Zero parts are left out.
 */
export function callingParts(
  stats: Pick<EncounterStats, 'callingAmplified' | 'callingShielded'>,
  calling: Pick<RunCalling, 'path'> | null,
): CallingPart[] {
  const path = calling?.path ?? [];
  const parts: CallingPart[] = [];
  if (stats.callingAmplified >= 1) {
    const label = path.includes('eclipse') ? 'Radiance and Eclipse' : 'Radiance';
    parts.push({
      label,
      amount: stats.callingAmplified,
      text: `${label}: +${fmt(stats.callingAmplified)} damage through your heroes`,
    });
  }
  if (stats.callingShielded >= 1)
    parts.push({
      label: 'Haloed',
      amount: stats.callingShielded,
      text: `Haloed: ${fmt(stats.callingShielded)} damage kept off`,
    });
  return parts;
}

/** "Radiance: +412 damage through your heroes · Haloed: 96 damage kept off" (null: nothing). */
export function callingResultLine(
  stats: Pick<EncounterStats, 'callingAmplified' | 'callingShielded'>,
  calling: Pick<RunCalling, 'path'> | null,
): string | null {
  const parts = callingParts(stats, calling);
  return parts.length ? parts.map((p) => p.text).join(' · ') : null;
}

// ── Prep ──────────────────────────────────────────────────────────────────────────────

/** Every Calling content holds, for Prep's picker and the Codex. */
export function allCallings(): readonly CallingDef[] {
  return CONTENT.callings;
}
