/**
 * The Reliquary in the UI (Phase 4c, docs/phase-4c.md): its screen, the crafting previews and
 * outcomes, the carry, the Summary's enshrine panel, Prep's row and the Codex's page. Pure, so it
 * can be tested without React: every name, number and odd comes from content (`inscriptionDef`,
 * `inscriptionText`, `curseText`, `relicText`, `CONTENT.reliquary`) or meta (`craftOdds`,
 * `craftBlocked`, `fractureChance`, `releaseValue`, `inscribable`, `carriedRelics`,
 * `enshrineOptions`), so the content's tuning flows through.
 */
import type { UiSound } from '../../audio';
import {
  CONTENT,
  INSCRIPTION_CATEGORIES,
  curseDef,
  curseText,
  inscriptionDef,
  inscriptionText,
  relicCurse,
  relicDef,
  relicText,
  type InscriptionCategory,
  type InscriptionDef,
  type RelicRarity,
} from '../../content';
import { unlockRank } from '../../meta/profile';
import {
  carriedRelics,
  craftBlocked,
  craftOdds,
  craftable,
  empowered,
  fractureChance,
  inscribable,
  releaseValue,
  tierValues,
  type CraftAction,
  type CraftOdds,
  type CraftOutcome,
  type DissonanceKind,
  type Reliquary,
  type ReliquaryRelic,
} from '../../meta/reliquary';
import { enshrineOptions } from '../../meta/run';
import type { OwnedRelic, RunState } from '../../meta/types';
import { plural } from '../kit/format';
import {
  CARRIED_LOOK,
  CATEGORY_LOOK,
  DISSONANCE_LOOK,
  FRACTURED_LOOK,
  type StateLook,
} from '../kit/reliquaryLook';

const RULES = () => CONTENT.reliquary;

/** The kinds of Inscription, in content order (what Inscribe lets you choose). */
export const CATEGORIES: readonly InscriptionCategory[] = INSCRIPTION_CATEGORIES;

/** How long a Dissonate's roll plays (its sound, about 1.6 s) before its outcome is revealed. */
export const DISSONATE_ROLL_MS = 1600;

/** The four outcomes of a Dissonate, in the order the meta rolls them. */
export const DISSONANCE_KINDS: readonly DissonanceKind[] = [
  'dissonant',
  'empowered',
  'cursed',
  'shattered',
];

// ── Numbers ───────────────────────────────────────────────────────────────────────────

/** A value as content writes it (no float noise): 0.5, 0.03, 12. */
export function num(v: number): string {
  return String(Math.round(v * 1000) / 1000);
}

/** A chance (0–1) as the screen shows it, honestly: "60%", "10.5%", "33.3%". */
export function oddsText(p: number): string {
  return `${Math.round(p * 1000) / 10}%`;
}

/** "T3". */
export function tierLabel(tier: number): string {
  return `T${tier}`;
}

/** "6 Tuning Shards", "1 Tuning Shard". */
export function shardsText(n: number): string {
  return `${n} Tuning ${plural(n, 'Shard')}`;
}

/** "1 Discord Tear", "2 Discord Tears". */
export function tearsText(n: number): string {
  return `${n} Discord ${plural(n, 'Tear')}`;
}

/** What a craft costs, in words: "6 Tuning Shards", "1 Discord Tear". */
export function costText(cost: { shards: number; tears: number }): string {
  if (cost.tears > 0 && cost.shards > 0)
    return `${shardsText(cost.shards)} and ${tearsText(cost.tears)}`;
  return cost.tears > 0 ? tearsText(cost.tears) : shardsText(cost.shards);
}

// ── Inscriptions ──────────────────────────────────────────────────────────────────────

/**
 * The unit that follows a normal Inscription's value in its text ("+{v}% Thread potency" → "%",
 * "reaches {v} m farther" → " m", "{v} s more forgiving" → " s"); none for a count.
 */
export function unitOf(def: InscriptionDef): string {
  if (def.kind !== 'normal') return '';
  const after = def.text.split('{v}')[1] ?? '';
  if (after.startsWith('%')) return '%';
  const word = /^ (m|s)\b/.exec(after);
  return word ? ` ${word[1]}` : '';
}

/** "5%", "0.5 m", "0.02 s", "3". */
export function valueText(def: InscriptionDef, value: number): string {
  return `${num(value)}${unitOf(def)}`;
}

/** A normal Inscription's range at a tier (5 = T5), from content. */
export function tierRange(def: InscriptionDef, tier: number): readonly [number, number] {
  if (def.kind !== 'normal') return [0, 0];
  return def.tiers[5 - tier] ?? [0, 0];
}

/** "4–5%", or the one value a tier allows: "0.5 m". */
export function rangeText(def: InscriptionDef, tier: number): string {
  const [min, max] = tierRange(def, tier);
  return min === max ? valueText(def, min) : `${num(min)}–${num(max)}${unitOf(def)}`;
}

/** The values a tier can roll, as `retune` and `ascend` roll them (the engine's own list). */
export { tierValues };

/** The category's name and what it's about: "Silk · the Thread". */
export function categoryName(category: InscriptionCategory): string {
  return CATEGORY_LOOK[category].name;
}

export interface InscriptionRow {
  index: number;
  id: string;
  name: string;
  category: InscriptionCategory;
  tier: number;
  /** "T4". */
  tierLabel: string;
  value: number;
  /** "5%". */
  valueText: string;
  /** Its line, as content writes it: "+5% Thread potency (Mend and Empower)". */
  text: string;
  range: readonly [number, number];
  /** "4–5%". */
  rangeText: string;
  /** The tier allows one value (Retune can't change it). */
  fixed: boolean;
  /** Where the value sits in its tier's range, 0 (the lowest) to 1 (the highest; 1 if fixed). */
  within: number;
  /** For screen readers: name, tier, what it does, its range and kind. */
  label: string;
}

/** One Inscription on a relic, as every panel shows it. */
export function inscriptionRow(
  ins: { id: string; tier: number; value: number },
  index = 0,
): InscriptionRow {
  const def = inscriptionDef(ins.id);
  const range = tierRange(def, ins.tier);
  const fixed = range[0] === range[1];
  const text = inscriptionText(def, ins.value);
  return {
    index,
    id: ins.id,
    name: def.name,
    category: def.category,
    tier: ins.tier,
    tierLabel: tierLabel(ins.tier),
    value: ins.value,
    valueText: valueText(def, ins.value),
    text,
    range,
    rangeText: rangeText(def, ins.tier),
    fixed,
    within: fixed ? 1 : Math.max(0, Math.min(1, (ins.value - range[0]) / (range[1] - range[0]))),
    label: `${def.name}, ${tierLabel(ins.tier)} (tier ${ins.tier} of 5; T1 is the best): ${text}. ${tierLabel(ins.tier)} ${fixed ? 'is always' : 'ranges'} ${rangeText(def, ins.tier)}. ${categoryName(def.category)}.`,
  };
}

/** A Dissonant Inscription's or a Reliquary curse's line. */
export interface FixedRow {
  id: string;
  name: string;
  /** A Dissonant Inscription's kind; null for a curse. */
  category: InscriptionCategory | null;
  text: string;
}

export function dissonantRow(id: string): FixedRow {
  const def = inscriptionDef(id);
  return { id, name: def.name, category: def.category, text: inscriptionText(def) };
}

export function curseRow(id: string): FixedRow {
  const def = curseDef(id);
  return { id, name: def.name, category: null, text: curseText(def) };
}

// ── A relic ───────────────────────────────────────────────────────────────────────────

const RARITY_WORD: Readonly<Record<RelicRarity, string>> = {
  common: 'Common',
  rare: 'Rare',
  legendary: 'Legendary',
  cursed: 'Cursed',
};

export interface RelicView {
  uid: string;
  id: string;
  name: string;
  icon: string;
  rarity: RelicRarity;
  rarityLabel: string;
  cleansed: boolean;
  /** A Dissonate Empowered it: `text` has its empowered numbers. */
  empowered: boolean;
  /** Its effect, as it plays. */
  text: string;
  /** What its effect was before it was Empowered (null otherwise). */
  wasText: string | null;
  /** A cursed relic's own curse (lifted if a Forge cleansed it). */
  ownCurse: { text: string; lifted: boolean } | null;
  inscriptions: InscriptionRow[];
  /** A Dissonate gone Dissonant: its fifth slot. */
  dissonant: FixedRow | null;
  /** A Dissonate gone Cursed: the curse it carries. */
  curse: FixedRow | null;
  instability: number;
  /** The chance (0–1) the next craft Fractures it (`fractureChance`). */
  fracture: number;
  fractured: boolean;
  dissonance: DissonanceKind | null;
  craftable: boolean;
  /** Fractured, or what a Dissonate left (null: still craftable). */
  state: StateLook | null;
  /** Why it can't be crafted, as meta says (`craftBlocked`), or null. */
  frozen: string | null;
  used: number;
  max: number;
  /** Shards it gives if released. */
  release: number;
  /** One sentence for screen readers. */
  label: string;
}

/** Plenty of everything: what a craft would say if the materials were no object. */
function rich(rq: Reliquary): Reliquary {
  return { ...rq, shards: Number.MAX_SAFE_INTEGER, tears: Number.MAX_SAFE_INTEGER };
}

/** Everything the screen shows of an enshrined relic. */
export function relicView(r: ReliquaryRelic): RelicView {
  const def = relicDef(r.id);
  const emp = empowered(r);
  const own = relicCurse(def);
  const d = r.dissonance;
  const state = r.fractured ? FRACTURED_LOOK : d ? DISSONANCE_LOOK[d.kind] : null;
  const inscriptions = r.inscriptions.map((ins, i) => inscriptionRow(ins, i));
  const dissonant = d?.kind === 'dissonant' && d.inscription ? dissonantRow(d.inscription) : null;
  const curse = d?.kind === 'cursed' && d.curse ? curseRow(d.curse) : null;
  // The meta's own words for a relic that stays as it is (any craft says the same).
  const frozen = craftBlocked(rich(emptyFor(r)), r, 'dissonate');
  const view: Omit<RelicView, 'label'> = {
    uid: r.uid,
    id: r.id,
    name: def.name,
    icon: def.icon,
    rarity: def.rarity,
    rarityLabel: RARITY_WORD[def.rarity],
    cleansed: def.rarity === 'cursed' && r.cleansed,
    empowered: emp,
    text: relicText(def, emp),
    wasText: emp ? relicText(def) : null,
    ownCurse: own ? { text: own, lifted: r.cleansed } : null,
    inscriptions,
    dissonant,
    curse,
    instability: r.instability,
    fracture: fractureChance(r.instability),
    fractured: r.fractured,
    dissonance: d?.kind ?? null,
    craftable: craftable(r),
    state,
    frozen,
    used: r.inscriptions.length,
    max: RULES().maxInscriptions,
    release: releaseValue(r),
  };
  return { ...view, label: relicLabel(view) };
}

/** A Reliquary holding just this relic (for reading the meta's reasons about it alone). */
function emptyFor(r: ReliquaryRelic): Reliquary {
  return { relics: [r], shards: 0, tears: 0, carry: [], seed: 1, next: 1 };
}

function relicLabel(v: Omit<RelicView, 'label'>): string {
  const parts = [
    `${v.name}, ${v.rarityLabel.toLowerCase()} relic${v.cleansed ? ', cleansed' : ''}.`,
    v.state ? `${v.state.label}.` : '',
    `${v.used} of ${v.max} ${plural(v.max, 'Inscription')}${v.inscriptions.length ? `: ${v.inscriptions.map((i) => `${i.name} ${i.tierLabel}`).join(', ')}` : ''}.`,
    v.dissonant ? `Dissonant: ${v.dissonant.name}.` : '',
    v.curse ? `Curse: ${v.curse.name}.` : '',
    `Instability ${v.instability}.`,
  ];
  return parts.filter(Boolean).join(' ');
}

/** "Prism Loom T4 T5 T3": a relic with its tiers, for chips. */
export function relicLine(v: Pick<RelicView, 'name' | 'inscriptions'>): string {
  return [v.name, ...v.inscriptions.map((i) => i.tierLabel)].join(' ');
}

// ── Instability ───────────────────────────────────────────────────────────────────────

export interface InstabilityView {
  value: number;
  /** After the craft being previewed (null: none). */
  after: number | null;
  /** Past this, every craft risks a Fracture (`fracture.above`). */
  above: number;
  max: number;
  /** The Fracture chance now, and after the previewed craft. */
  fracture: number;
  fractureAfter: number | null;
  /** "Instability 44 of 100". */
  line: string;
  /** What it means for the next craft. */
  fractureLine: string;
}

export const INSTABILITY_MAX = 100;

export function instabilityView(r: ReliquaryRelic, after: number | null = null): InstabilityView {
  const f = RULES().fracture;
  const fracture = fractureChance(r.instability);
  let fractureLine: string;
  if (!craftable(r)) fractureLine = 'No more crafts: nothing can Fracture it now.';
  else if (fracture <= 0)
    fractureLine = `No risk yet. Past ${f.above}, Inscribe, Retune and Ascend risk a Fracture: ${num(f.perPoint)}% for each point.`;
  else
    fractureLine = `Inscribe, Retune and Ascend now risk a Fracture: ${oddsText(fracture)}. A Dissonate never does.`;
  return {
    value: r.instability,
    after,
    above: f.above,
    max: INSTABILITY_MAX,
    fracture,
    fractureAfter: after === null ? null : fractureChance(after),
    line: `Instability ${r.instability} of ${INSTABILITY_MAX}`,
    fractureLine,
  };
}

// ── Crafting ──────────────────────────────────────────────────────────────────────────

/** A tab of the crafting panel: the four crafts, and Release. */
export type ActionId = CraftAction | 'release';

export const ACTIONS: readonly ActionId[] = [
  'inscribe',
  'retune',
  'ascend',
  'dissonate',
  'release',
];

export const ACTION_LABEL: Readonly<Record<ActionId, string>> = {
  inscribe: 'Inscribe',
  retune: 'Retune',
  ascend: 'Ascend',
  dissonate: 'Dissonate',
  release: 'Release',
};

/** What each does, in a line (the numbers are in the preview). */
export function actionBlurb(action: ActionId): string {
  const tierCap = RULES().tierCap;
  switch (action) {
    case 'inscribe':
      return 'Adds a random Inscription of the kind you choose.';
    case 'retune':
      return 'Rolls one Inscription’s value again, within its tier.';
    case 'ascend':
      return `Tries to raise one Inscription a tier, as far as T${tierCap}. A miss changes nothing.`;
    case 'dissonate':
      return 'The final gamble, for a Discord Tear: four outcomes, and no crafting after.';
    case 'release':
      return 'The relic leaves the Reliquary for Tuning Shards.';
  }
}

export interface Chance {
  key: string;
  /** "T5", "Rises to T4", "Dissonant". */
  label: string;
  p: number;
  /** "60%". */
  text: string;
  /** What it means, when the label doesn't say. */
  detail?: string;
}

export interface CraftPreview {
  action: CraftAction;
  arg?: number | InscriptionCategory;
  /** The meta's own numbers (`craftOdds`): the source of everything below. */
  odds: CraftOdds;
  cost: { shards: number; tears: number };
  /** "6 Tuning Shards". */
  costText: string;
  canPay: boolean;
  /** "6%" (a Dissonate: "none"). */
  fractureText: string;
  instability: { from: number; to: number };
  /** The Fracture chance of the craft after this one (it only rises). */
  nextFracture: number;
  /** Tier odds, the chance to rise, or a Dissonate's outcomes. */
  chances: Chance[];
  /** Why it can't be made now (`craftBlocked`), or null. */
  blocked: string | null;
  /** The sound a refused click makes: short of materials, or anything else. */
  blockSound: UiSound;
  /** What's at stake, in plain sentences. */
  stakes: string[];
  /**
   * When a Fracture is possible, the chances above are the craft's own, if it holds: the
   * Fracture is rolled first. This is the whole picture (null without a risk).
   */
  overall: { label: string; p: number; text: string }[] | null;
  /** The button: "Inscribe", "Ascend Hardy". */
  verb: string;
  /** For screen readers: the verb, its cost and its odds. */
  label: string;
}

/** The chance of each value a Retune can land on, against the value now. */
export function retuneChances(ins: { id: string; tier: number; value: number }): Chance[] {
  const def = inscriptionDef(ins.id);
  const values = tierValues(def, ins.tier);
  const n = values.length;
  if (n === 0) return [];
  const higher = values.filter((v) => v > ins.value + 1e-9).length / n;
  const same = values.filter((v) => Math.abs(v - ins.value) <= 1e-9).length / n;
  const lower = values.filter((v) => v < ins.value - 1e-9).length / n;
  return [
    { key: 'higher', label: 'Higher', p: higher, text: oddsText(higher) },
    { key: 'same', label: 'The same', p: same, text: oddsText(same) },
    { key: 'lower', label: 'Lower', p: lower, text: oddsText(lower) },
  ];
}

/** The chance of each Dissonate outcome for this relic, with what each would do. */
export function dissonateChances(r: ReliquaryRelic): Chance[] {
  const outcomes = craftOdds(r, 'dissonate').outcomes!;
  const def = relicDef(r.id);
  const rules = RULES();
  const dissonants = CONTENT.inscriptions.filter((d) => d.kind === 'dissonant');
  return DISSONANCE_KINDS.map((kind) => {
    const p = outcomes[kind];
    let detail: string;
    switch (kind) {
      case 'dissonant':
        detail = `A fifth slot holds one of ${dissonants.length} Dissonant Inscriptions: ${dissonants.map((d) => d.name).join(', ')}.`;
        break;
      case 'empowered':
        detail = def.empowered
          ? `Its own effect grows: ${relicText(def, true)}`
          : `It has no numbers to grow: that share turns Dissonant.`;
        break;
      case 'cursed':
        detail = `Every Inscription rises a tier, as far as T${rules.dissonate.cursedTierCap}, and one of ${CONTENT.curses.length} curses joins it: ${CONTENT.curses.map((c) => c.name).join(', ')}.`;
        break;
      case 'shattered':
        detail = 'Nothing changes. The Tear is spent.';
        break;
    }
    return { key: kind, label: DISSONANCE_LOOK[kind].label, p, text: oddsText(p), detail };
  });
}

/** The preview of one craft on one relic: cost, odds, Fracture, and what's at stake. */
export function craftPreview(
  rq: Reliquary,
  r: ReliquaryRelic,
  action: CraftAction,
  arg?: number | InscriptionCategory,
): CraftPreview {
  const index = typeof arg === 'number' ? arg : undefined;
  const odds = craftOdds(r, action, index);
  const cost = { shards: odds.shards, tears: odds.tears };
  const blocked = craftBlocked(rq, r, action, arg);
  // Short of materials only when plenty would make it.
  const short = blocked !== null && craftBlocked(rich(rq), r, action, arg) === null;
  const ins = index === undefined ? undefined : r.inscriptions[index];
  const row = ins ? inscriptionRow(ins, index) : null;
  const chances: Chance[] = [];
  const stakes: string[] = [];
  const f = RULES().fracture;
  let verb: string = ACTION_LABEL[action];
  switch (action) {
    case 'inscribe': {
      (odds.tiers ?? []).forEach((p, i) => {
        if (p > 0)
          chances.push({ key: `t${5 - i}`, label: tierLabel(5 - i), p, text: oddsText(p) });
      });
      if (typeof arg === 'string') {
        const left = inscribable(r, arg);
        verb = `Inscribe ${categoryName(arg)}`;
        if (left.length > 0)
          stakes.push(
            left.length === 1
              ? `Adds ${left[0]!.name}: the one ${categoryName(arg)} Inscription it doesn’t have yet.`
              : `Adds one of the ${left.length} ${categoryName(arg)} Inscriptions it doesn’t have, at random: ${left.map((d) => d.name).join(', ')}.`,
          );
      }
      break;
    }
    case 'retune':
      if (row) {
        verb = `Retune ${row.name}`;
        chances.push(...retuneChances(ins!));
        stakes.push(
          `Rolls ${row.name} again within ${row.tierLabel} (${row.rangeText}), every value as likely; it’s ${row.valueText} now.`,
        );
      }
      break;
    case 'ascend':
      if (row) {
        verb = `Ascend ${row.name}`;
        const p = odds.success ?? 0;
        const to = row.tier - 1;
        chances.push(
          {
            key: 'rise',
            label: `Rises to ${tierLabel(to)}`,
            p,
            text: oddsText(p),
            detail: `Its value rolls again within ${tierLabel(to)}: ${rangeText(inscriptionDef(row.id), to)}.`,
          },
          { key: 'miss', label: 'Misses', p: 1 - p, text: oddsText(1 - p) },
        );
        stakes.push(
          'On a miss nothing changes, but the shards are spent and Instability still rises.',
        );
      }
      break;
    case 'dissonate':
      chances.push(...dissonateChances(r));
      stakes.push(
        'The final gamble: afterwards it can’t be crafted again. A Dissonate never Fractures.',
      );
      break;
  }
  if (action !== 'dissonate') {
    if (odds.fracture > 0)
      stakes.push(
        `If it Fractures (${oddsText(odds.fracture)}), the relic freezes as it is and the ${costText(cost)} are lost. It still works, and can still be carried.`,
      );
    else
      stakes.push(
        `No risk of a Fracture: Instability is ${r.instability}, and the risk starts past ${f.above}.`,
      );
  }
  const fractureText = action === 'dissonate' ? 'none' : oddsText(odds.fracture);
  // The Fracture is rolled first: the craft's own odds hold only if it doesn't.
  const holds = 1 - odds.fracture;
  const overall =
    action === 'dissonate' || odds.fracture <= 0
      ? null
      : [
          ...(action === 'ascend'
            ? [
                { label: 'it rises', p: holds * (odds.success ?? 0) },
                { label: 'it misses', p: holds * (1 - (odds.success ?? 0)) },
              ]
            : [{ label: action === 'inscribe' ? 'it adds one' : 'it rolls again', p: holds }]),
          { label: 'it Fractures', p: odds.fracture },
        ].map((o) => ({ ...o, text: oddsText(o.p) }));
  return {
    action,
    arg,
    odds,
    overall,
    cost,
    costText: costText(cost),
    canPay: rq.shards >= cost.shards && rq.tears >= cost.tears,
    fractureText,
    instability: { from: r.instability, to: odds.instability },
    nextFracture: fractureChance(odds.instability),
    chances,
    blocked,
    blockSound: short ? 'cantAfford' : 'error',
    stakes,
    verb,
    label: `${verb} for ${costText(cost)}${chances.length ? `: ${chances.map((c) => `${c.label} ${c.text}`).join(', ')}` : ''}. Fracture chance ${fractureText}.${blocked ? ` ${blocked}` : ''}`,
  };
}

/** Inscribe's choice: each kind, the Inscriptions it could still add, or why not. */
export interface CategoryOption {
  category: InscriptionCategory;
  name: string;
  blurb: string;
  /** The Inscriptions of this kind it doesn't have yet. */
  left: string[];
  /** Why this kind can't be chosen, when the reason is its own (`craftBlocked`). */
  blocked: string | null;
}

export function categoryOptions(rq: Reliquary, r: ReliquaryRelic): CategoryOption[] {
  const plenty = rich(rq);
  const general = craftBlocked(plenty, r, 'inscribe');
  return CATEGORIES.map((category) => {
    const reason = craftBlocked(plenty, r, 'inscribe', category);
    const look = CATEGORY_LOOK[category];
    return {
      category,
      name: look.name,
      blurb: look.blurb,
      left: inscribable(r, category).map((d) => d.name),
      blocked: reason !== null && reason !== general ? reason : null,
    };
  });
}

/** Retune's or Ascend's choice: each Inscription, its odds, or why it can't. */
export interface InscriptionOption {
  index: number;
  row: InscriptionRow;
  /** Ascend: the chance to rise (`craftOdds`); Retune: the chance of a higher value. */
  p: number;
  /** "75%". */
  pText: string;
  /** Ascend: the tier it would rise to. */
  to: number | null;
  /** Why it can't (`craftBlocked`): one value only, or T2 and T1 wait for Dissonance. */
  blocked: string | null;
}

export function inscriptionOptions(
  rq: Reliquary,
  r: ReliquaryRelic,
  action: 'retune' | 'ascend',
): InscriptionOption[] {
  const plenty = rich(rq);
  const general = craftBlocked(plenty, r, action);
  return r.inscriptions.map((ins, index) => {
    const row = inscriptionRow(ins, index);
    const reason = craftBlocked(plenty, r, action, index);
    const p =
      action === 'ascend'
        ? (craftOdds(r, 'ascend', index).success ?? 0)
        : (retuneChances(ins).find((c) => c.key === 'higher')?.p ?? 0);
    return {
      index,
      row,
      p,
      pText: oddsText(p),
      to: action === 'ascend' ? ins.tier - 1 : null,
      blocked: reason !== null && reason !== general ? reason : null,
    };
  });
}

/** The first choice worth previewing for an action: a kind with room, an Inscription it can take. */
export function defaultArg(
  rq: Reliquary,
  r: ReliquaryRelic,
  action: ActionId,
): number | InscriptionCategory | undefined {
  if (action === 'inscribe') {
    const options = categoryOptions(rq, r);
    return (options.find((o) => !o.blocked && o.left.length > 0) ?? options[0])?.category;
  }
  if (action === 'retune' || action === 'ascend') {
    const options = inscriptionOptions(rq, r, action);
    return (options.find((o) => !o.blocked) ?? options[0])?.index;
  }
  return undefined;
}

// ── Release ───────────────────────────────────────────────────────────────────────────

export interface ReleaseView {
  total: number;
  base: number;
  per: number;
  count: number;
  /** "14 Tuning Shards: 8 for a legendary relic, and 2 for each of its 3 Inscriptions." */
  line: string;
}

export function releaseView(r: ReliquaryRelic): ReleaseView {
  const v = RULES().release;
  const def = relicDef(r.id);
  const base = v[def.rarity];
  const count = r.inscriptions.length;
  const total = releaseValue(r);
  const kind = def.rarity === 'cursed' ? 'cursed relic' : `${def.rarity} relic`;
  return {
    total,
    base,
    per: v.perInscription,
    count,
    line: `${shardsText(total)}: ${base} for a ${kind}${count > 0 ? `, and ${v.perInscription} for each of its ${count} ${plural(count, 'Inscription')}` : ''}.`,
  };
}

// ── After a craft ─────────────────────────────────────────────────────────────────────

/** A craft as the screen remembers it: the relic before and after, and what happened. */
export interface CraftRecord {
  uid: string;
  action: CraftAction;
  before: ReliquaryRelic;
  after: ReliquaryRelic;
  outcome: CraftOutcome;
  /** What it cost (`craftOdds` before it). */
  cost: { shards: number; tears: number };
}

/** The small effect a craft plays on the relic (CSS; calm with reduced motion). */
export type CraftEffect =
  | 'etch'
  | 'etchFine'
  | 'tune'
  | 'rise'
  | 'miss'
  | 'crack'
  | 'dissonant'
  | 'empowered'
  | 'cursed'
  | 'shatter';

export interface OutcomeView {
  kind: CraftOutcome['kind'] | DissonanceKind;
  /** "Inscribed Potent Thread". */
  title: string;
  lines: string[];
  /** Played when it's shown (a Dissonate's after its roll). */
  sound: UiSound;
  effect: CraftEffect;
  /** The Inscription the effect plays on (null: the relic itself). */
  target: number | null;
  tone: 'good' | 'neutral' | 'bad' | 'mixed';
  /** The live region's sentence. */
  announce: string;
}

/** A Dissonate's roll: what the live region says while it plays. */
export function rollingLine(name: string): string {
  return `Dissonating ${name}…`;
}

export function outcomeView(rec: CraftRecord): OutcomeView {
  const name = relicDef(rec.before.id).name;
  const o = rec.outcome;
  let v: Omit<OutcomeView, 'announce'>;
  switch (o.kind) {
    case 'inscribed': {
      const row = inscriptionRow(o.inscription, rec.after.inscriptions.length - 1);
      const fine = o.inscription.tier <= RULES().tierCap;
      v = {
        kind: 'inscribed',
        title: `Inscribed ${row.name} ${row.tierLabel}`,
        lines: [
          row.text,
          row.fixed
            ? `${row.tierLabel} is always ${row.rangeText}.`
            : `${row.tierLabel} ranges ${row.rangeText}.`,
        ],
        sound: fine ? 'inscribeFine' : 'inscribe',
        effect: fine ? 'etchFine' : 'etch',
        target: row.index,
        tone: 'good',
      };
      break;
    }
    case 'retuned': {
      const ins = rec.after.inscriptions[o.index]!;
      const def = inscriptionDef(ins.id);
      const same = Math.abs(o.to - o.from) <= 1e-9;
      v = {
        kind: 'retuned',
        title: same
          ? `Retuned ${def.name}: it stayed at ${valueText(def, o.to)}`
          : `Retuned ${def.name}: ${valueText(def, o.from)} → ${valueText(def, o.to)}`,
        lines: [inscriptionText(def, o.to)],
        sound: 'retune',
        effect: 'tune',
        target: o.index,
        tone: o.to > o.from ? 'good' : o.to < o.from ? 'bad' : 'neutral',
      };
      break;
    }
    case 'ascended': {
      const was = rec.before.inscriptions[o.index]!;
      const def = inscriptionDef(was.id);
      v = {
        kind: 'ascended',
        title: `Ascended ${def.name} to ${tierLabel(o.inscription.tier)}`,
        lines: [
          `${tierLabel(was.tier)} ${valueText(def, was.value)} → ${tierLabel(o.inscription.tier)} ${valueText(def, o.inscription.value)}`,
          inscriptionText(def, o.inscription.value),
        ],
        sound: 'ascend',
        effect: 'rise',
        target: o.index,
        tone: 'good',
      };
      break;
    }
    case 'missed': {
      const ins = rec.after.inscriptions[o.index]!;
      const def = inscriptionDef(ins.id);
      v = {
        kind: 'missed',
        title: `Ascend missed: ${def.name} stays ${tierLabel(ins.tier)}`,
        lines: [
          `The ${costText(rec.cost)} are spent, and Instability rose to ${rec.after.instability}.`,
        ],
        sound: 'ascendMiss',
        effect: 'miss',
        target: o.index,
        tone: 'bad',
      };
      break;
    }
    case 'fractured':
      v = {
        kind: 'fractured',
        title: `Fractured: ${name} froze as it was`,
        lines: [
          `The ${ACTION_LABEL[rec.action]} didn’t happen, and its ${costText(rec.cost)} are lost.`,
          'It still works, and can still be carried, but it can’t be crafted again.',
        ],
        sound: 'fracture',
        effect: 'crack',
        target: null,
        tone: 'bad',
      };
      break;
    case 'dissonated':
      v = dissonatedView(rec, name, o.dissonance.kind);
      break;
  }
  return { ...v, announce: [v.title, ...v.lines].join('. ').replace(/\.\./g, '.') };
}

function dissonatedView(
  rec: CraftRecord,
  name: string,
  kind: DissonanceKind,
): Omit<OutcomeView, 'announce'> {
  const d = rec.after.dissonance;
  const def = relicDef(rec.before.id);
  switch (kind) {
    case 'dissonant': {
      const row = d?.inscription ? dissonantRow(d.inscription) : null;
      return {
        kind,
        title: `Dissonant: a fifth slot holds ${row?.name ?? 'a Dissonant Inscription'}`,
        lines: [row?.text ?? ''].filter(Boolean),
        sound: 'dissonant',
        effect: 'dissonant',
        target: null,
        tone: 'good',
      };
    }
    case 'empowered':
      return {
        kind,
        title: `Empowered: ${name}’s own effect grows`,
        lines: [relicText(def, true), `It was: ${relicText(def)}`],
        sound: 'empowered',
        effect: 'empowered',
        target: null,
        tone: 'good',
      };
    case 'cursed': {
      const curse = d?.curse ? curseRow(d.curse) : null;
      const rose = rec.after.inscriptions.flatMap((ins, i) => {
        const was = rec.before.inscriptions[i];
        if (!was || was.tier === ins.tier) return [];
        const idef = inscriptionDef(ins.id);
        return [
          `${idef.name} ${tierLabel(was.tier)} → ${tierLabel(ins.tier)}: ${valueText(idef, was.value)} → ${valueText(idef, ins.value)}`,
        ];
      });
      return {
        kind,
        title: `Cursed: ${rose.length > 0 ? `${rose.length} ${plural(rose.length, 'Inscription')} rose a tier, and` : 'no Inscription could rise, and'} ${curse?.name ?? 'a curse'} joins it`,
        lines: [...rose, curse ? `Curse: ${curse.text}.` : ''].filter(Boolean),
        sound: 'cursedRelic',
        effect: 'cursed',
        target: null,
        tone: 'mixed',
      };
    }
    case 'shattered':
      return {
        kind,
        title: `Shattered: nothing changes`,
        lines: [`The Discord Tear is spent, and ${name} stays as it was, for good.`],
        sound: 'shattered',
        effect: 'shatter',
        target: null,
        tone: 'neutral',
      };
  }
}

/** A relic released: what the live region and the screen say. */
export function releasedLine(name: string, shards: number): string {
  return `Released ${name}: +${shardsText(shards)}.`;
}

// ── The carry ─────────────────────────────────────────────────────────────────────────

/** The uids carried into the next run: within the slots, one of each relic (as meta reads it). */
export function carriedUids(rq: Reliquary, slots: number): string[] {
  return carriedRelics(rq, slots).map((r) => r.uid);
}

/**
 * Attunement (docs/phase-4c.md): the relic in the first carry slot plays its own effect and lends
 * its affixes; the others are dormant and lend only their affixes (their own effect, and a
 * cursed relic's own curse, sleep).
 */
export type CarryRole = 'attuned' | 'lends';

export const ROLE_LABEL: Readonly<Record<CarryRole, string>> = {
  attuned: 'Attuned',
  lends: 'Lends its Inscriptions',
};

/** What a slot's relic gives a run. */
export const ROLE_LINE: Readonly<Record<CarryRole, string>> = {
  attuned: 'Attuned: its own effect and its Inscriptions',
  lends: 'Lends its Inscriptions: its own effect sleeps',
};

/** A dormant relic, wherever a run shows it. */
export const DORMANT_LINE = 'Dormant: its own effect sleeps. It lends the run its Inscriptions.';

/** The role of the relic in this carry slot (0: the first, attuned). */
export function carryRole(index: number): CarryRole {
  return index === 0 ? 'attuned' : 'lends';
}

export interface CarrySlotView {
  index: number;
  /** The Rank it opens at (content `slotRanks`). */
  rank: number;
  open: boolean;
  /** Attuned (the first) or lending its Inscriptions. */
  role: CarryRole;
  /** What it holds (null: empty, or locked). */
  relic: ReliquaryRelic | null;
  /** "Opens at Rank 15". */
  lockLine: string | null;
}

/** Every carry slot content has: open ones (filled or not) and the ones a Rank still locks. */
export function carrySlotViews(carried: readonly ReliquaryRelic[], slots: number): CarrySlotView[] {
  return RULES().slotRanks.map((rank, index) => {
    const open = index < slots;
    return {
      index,
      rank,
      open,
      role: carryRole(index),
      relic: open ? (carried[index] ?? null) : null,
      lockLine: open ? null : `Opens at Rank ${rank}`,
    };
  });
}

/** Where a relic sits in the next run's carry: its slot and role (null: not carried). */
export function carryPlace(
  rq: Reliquary,
  uid: string,
  slots: number,
): { index: number; role: CarryRole } | null {
  const index = carriedUids(rq, slots).indexOf(uid);
  return index < 0 ? null : { index, role: carryRole(index) };
}

/**
 * Attuning a relic: it moves to the first slot (carried already, or carried now if a slot is
 * free); the others keep their order. The uids to give `setCarry`, or why not.
 */
export function attuneChange(
  rq: Reliquary,
  uid: string,
  slots: number,
): { uids: string[] } | { problem: string } {
  const uids = carriedUids(rq, slots);
  if (uids[0] === uid) return { uids };
  if (uids.includes(uid)) return { uids: [uid, ...uids.filter((u) => u !== uid)] };
  const added = carryChange(rq, uid, slots);
  if ('problem' in added) return added;
  return { uids: [uid, ...uids] };
}

const ORDINAL = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth'];

/**
 * Carrying a relic, or taking it out: the uids to give `setCarry`, or why it can't be carried
 * (the store would keep the first of a pair and the slots; the screen says so first).
 */
export function carryChange(
  rq: Reliquary,
  uid: string,
  slots: number,
): { uids: string[]; adding: boolean } | { problem: string } {
  const now = carriedRelics(rq, slots);
  const uids = now.map((r) => r.uid);
  if (uids.includes(uid)) return { uids: uids.filter((u) => u !== uid), adding: false };
  const relic = rq.relics.find((r) => r.uid === uid);
  if (!relic) return { problem: 'That relic isn’t in the Reliquary.' };
  const name = relicDef(relic.id).name;
  if (now.some((r) => r.id === relic.id))
    return {
      problem: `You carry another ${name} already: a run never carries two of the same relic.`,
    };
  if (uids.length >= slots) {
    const ranks = RULES().slotRanks;
    if (slots <= 0)
      return { problem: `The Reliquary opens at Rank ${unlockRank('reliquary', '1')}.` };
    const next = ranks[slots];
    return {
      problem: `${slots === 1 ? 'Your carry slot is' : `All ${slots} carry slots are`} full: take a relic out first.${next !== undefined ? ` Rank ${next} opens a ${ORDINAL[slots] ?? 'new'} slot.` : ''}`,
    };
  }
  return { uids: [...uids, uid], adding: true };
}

/**
 * The rank-up card's line under a Reliquary unlock (Phase 4c): the slots still to come when it
 * opens; attunement when a second slot opens. Null for any other unlock.
 */
export function reliquaryUnlockLine(u: { kind: string; target: string }): string | null {
  const ranks = RULES().slotRanks;
  if (u.kind === 'reliquary') {
    const later = ranks.slice(1).map((r, i) => `Rank ${r} gives a ${ORDINAL[i + 1] ?? 'new'}`);
    return `One relic to carry now${later.length ? `; ${andList(later)}` : ''}.`;
  }
  if (u.kind === 'carrySlot')
    return 'Only the first slot is attuned (its own effect and its Inscriptions); the others lend their Inscriptions. Choose in the Reliquary or from Prep.';
  return null;
}

/** "Carrying 1 of 2" (or "Nothing carried · 2 slots"). */
export function carryLine(carried: number, slots: number): string {
  if (slots <= 0) return 'No carry slot yet';
  return carried > 0
    ? `Carrying ${carried} of ${slots}`
    : `Nothing carried · ${slots} ${plural(slots, 'slot')}`;
}

// ── Materials ─────────────────────────────────────────────────────────────────────────

function encounterName(kind: 'miniboss' | 'boss'): string {
  return (
    CONTENT.encounters.find((e) => e.kind === kind)?.name ??
    (kind === 'boss' ? 'the boss' : 'a mini-boss')
  );
}

/** Mid-sentence: "the Hollow Cantor". */
function midName(name: string): string {
  return name.replace(/^The /, 'the ');
}

/** Where the materials come from, from content's numbers. */
export function materialsHow(): { shards: string; tears: string } {
  const s = RULES().shards;
  const grade = RULES().tearGrade;
  return {
    shards: `Every run that ends pays them: ${s.perFight} for each fight it won, ${s.elite} more for an elite, ${s.miniboss} more for ${midName(encounterName('miniboss'))} and ${s.boss} more for ${midName(encounterName('boss'))}.`,
    tears: `A Discord Tear for beating ${midName(encounterName('boss'))} with ${/^[AEFHILMNORSX]/.test(grade) ? 'an' : 'a'} ${grade}.`,
  };
}

/** The Title's badge: what there is to craft with (null: nothing). */
export function materialsBadge(rq: Pick<Reliquary, 'shards' | 'tears'>): string | null {
  if (rq.shards <= 0 && rq.tears <= 0) return null;
  return [rq.shards > 0 && shardsText(rq.shards), rq.tears > 0 && tearsText(rq.tears)]
    .filter(Boolean)
    .join(', ');
}

/** "5 of 12 enshrined". */
export function capacityLine(count: number): string {
  return `${count} of ${RULES().capacity} enshrined`;
}

export function isFull(rq: Pick<Reliquary, 'relics'>): boolean {
  return rq.relics.length >= RULES().capacity;
}

// ── The Summary ───────────────────────────────────────────────────────────────────────

/** What a run's end paid: "+24 Tuning Shards and +1 Discord Tear". */
export function paidLine(paid: { shards: number; tears: number }): string {
  if (paid.shards <= 0 && paid.tears <= 0) return 'nothing: it won no fight';
  return [
    paid.shards > 0 && `+${shardsText(paid.shards)}`,
    paid.tears > 0 && `+${tearsText(paid.tears)}`,
  ]
    .filter(Boolean)
    .join(' and ');
}

export interface EnshrineChoice {
  id: string;
  cleansed: boolean;
  /** How many Inscriptions it arrives with (content `enshrineInscriptions`, by rarity). */
  arrives: number;
  /** "It arrives with 2 Inscriptions." */
  arrivesLine: string;
}

/** The relics a won run may enshrine (`enshrineOptions`), each with what it arrives with. */
export function enshrineChoices(run: RunState): EnshrineChoice[] {
  return enshrineOptions(run).map((r: OwnedRelic) => {
    const def = relicDef(r.id);
    const arrives = RULES().enshrineInscriptions[def.rarity];
    const cleansed = def.rarity === 'cursed' && r.cleansed;
    return {
      id: r.id,
      cleansed,
      arrives,
      arrivesLine: `It arrives with ${arrives} ${plural(arrives, 'Inscription')}${cleansed ? ', and cleansed' : ''}.`,
    };
  });
}

/** Where the Summary's Reliquary panel stands. */
export type EnshrineStage =
  | 'closed' // the run ended with the Reliquary shut: nothing paid, nothing to keep
  | 'lost' // not won: it paid, nothing to keep
  | 'none' // won, but it found no relic
  | 'full' // won, but the Reliquary must release one first
  | 'choose' // won: choose one (or none)
  | 'done'; // one enshrined

export function enshrineStage(run: RunState, rq: Pick<Reliquary, 'relics'>): EnshrineStage {
  if (!run.reliquary) return 'closed';
  if (run.reliquary.enshrined) return 'done';
  if (run.outcome !== 'victory') return 'lost';
  if (enshrineOptions(run).length === 0) return 'none';
  return isFull(rq) ? 'full' : 'choose';
}

// ── The Codex ─────────────────────────────────────────────────────────────────────────

/** A stand-in relic for reading the meta's odds about a relic of content (`craftOdds`). */
export function blankRelic(id: string, instability = 0): ReliquaryRelic {
  return {
    uid: 'codex',
    id,
    cleansed: false,
    inscriptions: [],
    instability,
    fractured: false,
    dissonance: null,
  };
}

/** Fracture chances at a few Instabilities past the threshold, and at the top. */
export function fractureExamples(): { at: number; p: number }[] {
  const above = RULES().fracture.above;
  const at = [above + 10, above + 20, INSTABILITY_MAX].filter((v) => v <= INSTABILITY_MAX);
  return [...new Set(at)].map((v) => ({ at: v, p: fractureChance(v) }));
}

export interface CodexInscription {
  id: string;
  name: string;
  category: InscriptionCategory;
  /** Its line with an X for the value: "+X% Thread potency (Mend and Empower)". */
  text: string;
  /** T5 first: each tier's range. */
  tiers: { tier: number; text: string; reachable: boolean }[];
}

/** Every normal Inscription with its five tiers, by kind (T2 and T1 marked as not reachable yet). */
export function codexInscriptions(): { category: InscriptionCategory; rows: CodexInscription[] }[] {
  const cap = RULES().tierCap;
  return CATEGORIES.map((category) => ({
    category,
    rows: CONTENT.inscriptions
      .filter((d) => d.kind === 'normal' && d.category === category)
      .map((d) => ({
        id: d.id,
        name: d.name,
        category,
        text: d.kind === 'normal' ? d.text.split('{v}').join('X') : inscriptionText(d),
        tiers: [5, 4, 3, 2, 1].map((tier) => ({
          tier,
          text: rangeText(d, tier),
          reachable: tier >= cap,
        })),
      })),
  }));
}

/** Relics a Dissonate can Empower, with their effect before and after; the rest by name. */
export function codexEmpowered(): {
  rows: { id: string; name: string; text: string; empowered: string }[];
  none: string[];
} {
  const rows = CONTENT.relics
    .filter((d) => d.empowered)
    .map((d) => ({ id: d.id, name: d.name, text: relicText(d), empowered: relicText(d, true) }));
  const none = CONTENT.relics.filter((d) => !d.empowered).map((d) => d.name);
  return { rows, none };
}

/** "A, B and C". */
export function andList(items: readonly string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/** Which carried relic this is, for a run's relic (its Inscriptions live in `run.carried`). */
export function carriedSnapshot(
  relic: Pick<OwnedRelic, 'id' | 'carried'>,
  carried: readonly ReliquaryRelic[] | undefined,
): ReliquaryRelic | null {
  if (!relic.carried || !carried) return null;
  return carried.find((c) => c.id === relic.id) ?? null;
}

export { CARRIED_LOOK };
