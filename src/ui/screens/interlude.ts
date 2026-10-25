/**
 * Pure text and availability for the Phase 3b screens (relic offers, merchants, forges,
 * events, the run strip and the map's tooltips). Every number comes from content, the run
 * state or meta/economy.ts, so tuning flows through; tests/uiPhase3b.test.ts pins the wording.
 */
import {
  CONTENT,
  boonDef,
  boonText,
  motifDef,
  relicCurse,
  relicDef,
  relicText,
  runEventDef,
  type EventChoice,
  type EventEffect,
  type RelicRarity,
} from '../../content';
import { FIGHT_AETHER, GRADE_AETHER } from '../../meta/economy';
import { findNode, forgeTargets, eventChoiceProblem, motifLine } from '../../meta/run';
import type {
  ActiveBoon,
  EncounterResult,
  EventGains,
  ForgeService,
  RelicOffer,
  RewardPreview,
  RunState,
  ShopItem,
} from '../../meta/types';
import { auraDef } from '../../content';
import { songName } from '../../sim';
import { plural } from '../kit/format';
import type { IconName } from '../kit/iconPaths';
import { callingTierAt } from './callingText';

// ── Aether ────────────────────────────────────────────────────────────────────────────

/** "+20 Aether" / "−40 Aether". */
export function aetherDelta(n: number): string {
  return `${n < 0 ? '−' : '+'}${Math.abs(Math.round(n))} Aether`;
}

/** "35 Aether" */
export function aetherAmount(n: number): string {
  return `${Math.round(n)} Aether`;
}

/** What a fight paid in Aether, and how (for the result screen). Null: this kind never pays. */
export function aetherLine(
  r: Pick<EncounterResult, 'kind' | 'outcome' | 'grade' | 'aether'>,
): { headline: string; detail: string } | null {
  const base = FIGHT_AETHER[r.kind];
  if (base <= 0) return null;
  if (r.outcome !== 'victory') return { headline: '+0 Aether', detail: 'A loss pays nothing.' };
  const mult = GRADE_AETHER[r.grade];
  return {
    headline: aetherDelta(r.aether),
    detail:
      mult === 1 ? `${base} for the win` : `${base} for the win × ${mult} for grade ${r.grade}`,
  };
}

/** Aether the run's fights have paid so far. */
export function aetherEarned(run: Pick<RunState, 'results'>): number {
  return run.results.reduce((s, r) => s + (r.aether ?? 0), 0);
}

// ── Relics and boons ──────────────────────────────────────────────────────────────────

export interface RelicInfo {
  id: string;
  name: string;
  icon: string;
  rarity: RelicRarity;
  rarityLabel: string;
  /** The blessing, values filled in. */
  rule: string;
  /** The curse, values filled in (null for blessings-only relics). */
  curse: string | null;
  /** A cursed relic whose curse a forge lifted. */
  cleansed: boolean;
  flavor: string;
  /** Only the run layer reads it (Star Chart): it never shows in a fight. */
  runOnly: boolean;
}

const RARITY_LABEL: Record<RelicRarity, string> = {
  common: 'Common',
  rare: 'Rare',
  legendary: 'Legendary',
  cursed: 'Cursed',
};

export function relicInfo(id: string, cleansed = false): RelicInfo {
  const def = relicDef(id);
  return {
    id,
    name: def.name,
    icon: def.icon,
    rarity: def.rarity,
    rarityLabel: RARITY_LABEL[def.rarity],
    rule: relicText(def),
    curse: relicCurse(def),
    cleansed: cleansed && def.rarity === 'cursed',
    flavor: def.flavor,
    runOnly: def.runOnly,
  };
}

/** One sentence for screen readers and tooltips' aria: name, rarity, rule, curse. */
export function relicSentence(r: RelicInfo): string {
  const curse = r.curse
    ? r.cleansed
      ? ` Its curse is lifted (was: ${r.curse})`
      : ` Curse: ${r.curse}`
    : '';
  return `${r.name}, ${r.rarityLabel.toLowerCase()} relic. ${r.rule}${curse}`;
}

export interface BoonInfo {
  id: string;
  name: string;
  icon: string;
  kind: 'boon' | 'bane';
  text: string;
  /** "2 fights left", "1 fight left", "The rest of the run". */
  left: string;
  /** Short form for chips: "2 fights", "run". */
  short: string;
}

export function boonInfo(active: Pick<ActiveBoon, 'id' | 'fights'>): BoonInfo {
  const def = boonDef(active.id);
  const n = active.fights;
  return {
    id: def.id,
    name: def.name,
    icon: def.icon,
    kind: def.kind,
    text: boonText(def),
    left: n === null ? 'The rest of the run' : `${n} ${plural(n, 'fight')} left`,
    short: n === null ? 'run' : `${n} ${plural(n, 'fight')}`,
  };
}

/** How long a boon lasts when gained (event choices, the Codex). */
export function boonDuration(id: string): string {
  const fights = boonDef(id).fights;
  return fights === null ? 'for the rest of the run' : `for ${fights} ${plural(fights, 'fight')}`;
}

// ── The map ───────────────────────────────────────────────────────────────────────────

export interface RewardChip {
  icon: IconName;
  text: string;
  /** 'aether' | 'relic' | 'heal' | 'draft-<rarity>' — the caller colours it. */
  tone: 'aether' | 'relic' | 'heal' | 'common' | 'rare' | 'epic';
}

/** The tooltip's reward chips: Aether, relics, the draft and healing. */
export function rewardChips(reward: RewardPreview): RewardChip[] {
  const chips: RewardChip[] = [];
  if (reward.aether > 0)
    chips.push({
      icon: 'aether',
      text: `${aetherDelta(reward.aether)}, more for a good grade`,
      tone: 'aether',
    });
  if (reward.relics > 0)
    chips.push({
      icon: 'relic',
      text: `Choose 1 of ${reward.relics} ${plural(reward.relics, 'relic')}`,
      tone: 'relic',
    });
  if (reward.draft) {
    const label = reward.draft === 'common' ? 'Common' : reward.draft === 'rare' ? 'Rare' : 'Epic';
    chips.push({ icon: 'diamond', text: `${label}+ motif`, tone: reward.draft });
  }
  if (reward.heal > 0)
    chips.push({ icon: 'heart', text: `+${Math.round(reward.heal * 100)}% life`, tone: 'heal' });
  return chips;
}

/**
 * A fight's threat, understated: "Threat: enemies +18% life" (null at ×1). For events it's
 * the fight they may hold.
 */
export function threatLine(threat: number, event = false): string | null {
  const pct = Math.round((threat - 1) * 100);
  if (pct <= 0) return null;
  return event ? `Threat: any fight here, enemies +${pct}% life` : `Threat: enemies +${pct}% life`;
}

/** An event node's tooltip: the event's name and teaser (null for other nodes). */
export function eventPreview(eventId: string | null): { name: string; teaser: string } | null {
  if (!eventId) return null;
  const def = runEventDef(eventId);
  return { name: def.name, teaser: def.teaser };
}

// ── Relic offers ──────────────────────────────────────────────────────────────────────

/** Title and blurb of a relic offer, by why it's offered. */
export function relicOfferCopy(
  offer: Pick<RelicOffer, 'reason' | 'options'>,
  eventName: string | null = null,
): { eyebrow: string; title: string; blurb: string } {
  const n = offer.options.length;
  const choose = n === 1 ? 'Take it, or leave it.' : `Choose 1 of ${n}, or leave them.`;
  switch (offer.reason) {
    case 'elite':
      return {
        eyebrow: 'Spoils of an elite',
        title: 'A relic for the taking',
        blurb: `${choose} A relic changes a rule for the rest of the run.`,
      };
    case 'boss':
      return {
        eyebrow: 'The Bellwarden falls',
        title: 'The Warden’s hoard',
        blurb: `${choose} Only rare and legendary relics lie here.`,
      };
    case 'event':
      return {
        eyebrow: eventName ?? 'An event',
        title: 'The reliquary opens',
        blurb: `${choose} You earned it.`,
      };
  }
}

// ── Merchants ─────────────────────────────────────────────────────────────────────────

export interface ShopItemStatus {
  /** Can be bought right now. */
  available: boolean;
  /** Why not (null when it can be bought): "Sold", "Needs 15 more Aether". */
  problem: string | null;
}

export function shopItemStatus(run: Pick<RunState, 'aether'>, item: ShopItem): ShopItemStatus {
  if (item.sold) return { available: false, problem: 'Sold' };
  if (run.aether < item.price)
    return { available: false, problem: `Needs ${item.price - run.aether} more Aether` };
  return { available: true, problem: null };
}

/** The item's name for buttons and announcements. */
export function shopItemName(item: ShopItem): string {
  if (item.kind === 'relic') return relicDef(item.id).name;
  if (item.kind === 'motif') return motifDef(item.id).name;
  return `Healing (${Math.round(item.heal * 100)}%)`;
}

// ── Forges ────────────────────────────────────────────────────────────────────────────

export const FORGE_SERVICES: readonly ForgeService[] = ['temper', 'retune', 'cleanse'];

export const FORGE_COPY: Record<
  ForgeService,
  { title: string; icon: IconName; color: string; text: string }
> = {
  temper: {
    title: 'Temper',
    icon: 'anvil',
    color: '#fdba74',
    text: 'One of your motifs gains a level.',
  },
  retune: {
    title: 'Retune',
    icon: 'tune',
    color: '#fcd98a',
    text: 'Rebuild your songs: auras, ornaments, presets.',
  },
  cleanse: {
    title: 'Lift a curse',
    icon: 'sparkle',
    color: '#a5b4fc',
    text: 'A cursed relic loses its curse and keeps its blessing.',
  },
};

export interface ForgeServiceStatus {
  price: number;
  /** What it can be used on (motif ids, cursed relic ids, or ['chords']). */
  targets: string[];
  available: boolean;
  /** Why not: the forge has cooled, nothing to use it on, or not enough Aether. */
  problem: string | null;
  /** A short line under the title when it is available ("3 motifs can grow"). */
  note: string;
}

export function forgeServiceStatus(run: RunState, service: ForgeService): ForgeServiceStatus {
  const price = run.forge?.prices[service] ?? 0;
  const targets = forgeTargets(run, service);
  const note =
    service === 'temper'
      ? `${targets.length} ${plural(targets.length, 'motif')} can grow`
      : service === 'cleanse'
        ? `${targets.length} ${plural(targets.length, 'curse')} to lift`
        : 'Same rules as Prep';
  const used = run.forge?.used ?? null;
  let problem: string | null = null;
  if (used !== null)
    problem = used === service ? 'Done' : 'The forge has cooled: one service per visit.';
  else if (targets.length === 0)
    problem =
      service === 'temper'
        ? run.motifs.length === 0
          ? 'You have no motifs yet.'
          : 'Every motif you have is at its last level.'
        : 'You carry no curse.';
  else if (run.aether < price) problem = `Needs ${price - run.aether} more Aether`;
  return { price, targets, available: problem === null, problem, note };
}

/** What the forge did this visit, for the "after" view (the run only records the service). */
export type ForgeResult =
  | { service: 'temper'; step: MotifStep }
  | { service: 'retune' }
  | { service: 'cleanse'; relicId: string };

/**
 * What the forge did, from the run itself (`forge.used` and `forge.target`), for when the
 * screen no longer remembers it (a reload mid-visit).
 */
export function forgeResultOf(run: Pick<RunState, 'forge' | 'motifs'>): ForgeResult | null {
  const forge = run.forge;
  if (!forge?.used) return null;
  if (forge.used === 'retune') return { service: 'retune' };
  if (!forge.target) return null;
  if (forge.used === 'cleanse') return { service: 'cleanse', relicId: forge.target };
  const level = run.motifs.find((m) => m.id === forge.target)?.level;
  if (level === undefined) return null;
  // Tempering added one level: step from the one before.
  const step = motifStep({ motifs: [{ id: forge.target, level: level - 1 }] }, forge.target, 1);
  return { service: 'temper', step };
}

/** A motif before and after gaining `levels` (capped at its last level). */
export interface MotifStep {
  motifId: string;
  name: string;
  from: number;
  to: number;
  max: number;
  now: string;
  next: string;
}

export function motifStep(run: Pick<RunState, 'motifs'>, motifId: string, levels = 1): MotifStep {
  const def = motifDef(motifId);
  const max = def.values.length;
  const from = run.motifs.find((m) => m.id === motifId)?.level ?? 1;
  const to = Math.min(max, from + levels);
  return {
    motifId,
    name: def.name,
    from,
    to,
    max,
    now: motifLine(motifId, from),
    next: motifLine(motifId, to),
  };
}

// ── Events ────────────────────────────────────────────────────────────────────────────

export interface ChoiceInfo {
  id: string;
  label: string;
  text: string;
  /** Aether it costs (0: free). */
  cost: number;
  /** A gamble: its odds as whole percentages. */
  odds: { win: number; lose: number } | null;
  /** Why it is greyed out (null: it can be chosen). */
  problem: string | null;
  /** It asks for one of your motifs first. */
  motif: EventChoice['motif'];
  /** It opens the song builder first. */
  retune: boolean;
  /** It starts a fight. */
  fight: boolean;
  /** Short tags: "An elite fight", "Costs 40 Aether", "60% / 40%"... */
  tags: { icon: IconName; text: string; tone: 'aether' | 'risk' | 'fight' | 'relic' | 'plain' }[];
}

function hasEffect(choice: EventChoice, kind: EventEffect['kind']): boolean {
  return choice.effects.some((e) => e.kind === kind) || choice.fail.some((e) => e.kind === kind);
}

export function choiceInfo(run: RunState, eventId: string, choice: EventChoice): ChoiceInfo {
  const odds =
    choice.chance === undefined
      ? null
      : { win: Math.round(choice.chance * 100), lose: 100 - Math.round(choice.chance * 100) };
  const fight = hasEffect(choice, 'fight');
  const retune = hasEffect(choice, 'retune');
  const tags: ChoiceInfo['tags'] = [];
  if (choice.cost > 0)
    tags.push({ icon: 'aether', text: `Costs ${aetherAmount(choice.cost)}`, tone: 'aether' });
  if (odds) tags.push({ icon: 'reroll', text: `${odds.win}% / ${odds.lose}%`, tone: 'risk' });
  if (fight) tags.push({ icon: 'skull', text: 'An elite fight', tone: 'fight' });
  for (const e of choice.effects) {
    if (e.kind === 'relic')
      tags.push({
        icon: 'relic',
        text: `A ${RARITY_LABEL[e.rarity].toLowerCase()} relic`,
        tone: 'relic',
      });
    if (e.kind === 'hurt')
      tags.push({ icon: 'heart', text: `−${Math.round(e.pct * 100)}% life`, tone: 'risk' });
    if (e.kind === 'heal')
      tags.push({ icon: 'heart', text: `+${Math.round(e.pct * 100)}% life`, tone: 'plain' });
    if (e.kind === 'aether')
      tags.push({ icon: 'aether', text: aetherDelta(e.amount), tone: 'aether' });
  }
  if (choice.motif !== 'none') tags.push({ icon: 'note', text: 'Choose a motif', tone: 'plain' });
  if (retune) tags.push({ icon: 'tune', text: 'Opens the song builder', tone: 'plain' });
  const live = run.event?.eventId === eventId;
  return {
    id: choice.id,
    label: choice.label,
    text: choice.text,
    cost: choice.cost,
    odds,
    problem: live ? eventChoiceProblem(run, choice.id) : null,
    motif: choice.motif,
    retune,
    fight,
    tags,
  };
}

/** The motifs an event choice may take ('upgradable': only those below their last level). */
export function eventMotifTargets(run: RunState, mode: EventChoice['motif']): string[] {
  if (mode === 'none') return [];
  return run.motifs
    .filter((m) => mode === 'any' || m.level < motifDef(m.id).values.length)
    .map((m) => m.id);
}

/** Levels a choice's motif effect grants (Shrine of Discord: 2). */
export function choiceLevels(choice: EventChoice): number {
  for (const e of choice.effects) if (e.kind === 'motifLevels') return e.levels;
  return 0;
}

export interface GainLine {
  icon: IconName | 'glyph';
  /** For 'glyph' lines: the content icon key. */
  glyph?: string;
  text: string;
  tone: 'good' | 'bad' | 'plain';
}

/**
 * What an event choice gave or took, as lines (relics are shown as cards by the caller, so
 * they're listed here only by name). `run` is the run after the choice.
 */
/**
 * What a heal or a hurt really did to each hero, from the life they had before the choice:
 * "Every hero healed 25% of their life." when it's the same for all, else hero by hero.
 */
function lifeLine(
  gains: EventGains,
  run: Pick<RunState, 'party'>,
  verb: 'healed' | 'lost',
  pct: number,
): string {
  const deltas = run.party.map((h, i) =>
    Math.round(Math.abs(h.hpPct - (gains.before[i] ?? h.hpPct)) * 100),
  );
  const full = Math.round(pct * 100);
  if (gains.before.length !== run.party.length || deltas.every((d) => d === full))
    return `Every hero ${verb} ${full}% of their life.`;
  const each = run.party.map((h, i) => `${heroName(h.heroId)} ${deltas[i]}%`).join(', ');
  return `The party ${verb} ${verb === 'healed' ? 'up to' : 'at most'} ${full}% of their life: ${each}.`;
}

function heroName(heroId: string): string {
  return CONTENT.heroes.find((h) => h.id === heroId)?.name ?? heroId;
}

export function gainLines(gains: EventGains, run: Pick<RunState, 'chords' | 'party'>): GainLine[] {
  const lines: GainLine[] = [];
  for (const id of gains.relics)
    lines.push({ icon: 'relic', text: `${relicDef(id).name} is yours.`, tone: 'good' });
  for (const id of gains.boons) {
    const def = boonDef(id);
    lines.push({
      icon: 'glyph',
      glyph: def.icon,
      text: `${def.name} ${boonDuration(id)}: ${boonText(def)}`,
      tone: def.kind === 'bane' ? 'bad' : 'good',
    });
  }
  if (gains.aether !== 0)
    lines.push({
      icon: 'aether',
      text: `${aetherDelta(gains.aether)}.`,
      tone: gains.aether > 0 ? 'good' : 'bad',
    });
  if (gains.heal > 0)
    lines.push({ icon: 'heart', text: lifeLine(gains, run, 'healed', gains.heal), tone: 'good' });
  if (gains.hurt > 0)
    lines.push({ icon: 'heart', text: lifeLine(gains, run, 'lost', gains.hurt), tone: 'bad' });
  if (gains.motif) {
    const def = motifDef(gains.motif.id);
    const from =
      gains.motif.from > 0
        ? `level ${gains.motif.from} → ${gains.motif.level}`
        : `level ${gains.motif.level}`;
    lines.push({
      icon: 'note',
      text: `${def.name} rises, ${from}: ${motifLine(def.id, gains.motif.level)}`,
      tone: 'good',
    });
  }
  if (gains.lostMotif)
    lines.push({
      icon: 'close',
      text: `${motifDef(gains.lostMotif).name} is lost.`,
      tone: 'bad',
    });
  if (gains.retuned) lines.push({ icon: 'tune', text: songsLine(run.chords), tone: 'good' });
  if (lines.length === 0) lines.push({ icon: 'info', text: 'Nothing changed.', tone: 'plain' });
  return lines;
}

/** "Your songs now: Beam song: Fortissimo + Allegro · Field song: Sostenuto". */
export function songsLine(chords: RunState['chords']): string {
  const parts = chords
    .map((c, i) =>
      c.auras.length > 0
        ? `${songName(i)}: ${c.auras.map((a) => auraDef(a).name).join(' + ')}`
        : '',
    )
    .filter(Boolean);
  return `Your songs now: ${parts.length ? parts.join(' · ') : 'silence'}.`;
}

/** The event node the run is at (for headers after its fight). */
export function eventNameOf(run: Pick<RunState, 'event'>): string | null {
  return run.event ? runEventDef(run.event.eventId).name : null;
}

// ── The result screen's Continue ──────────────────────────────────────────────────────

/** What Continue leads to after a fight: a relic, a motif, the map or the summary. */
export function nextStep(run: RunState): string {
  const r = run.lastResult;
  if (!r || run.outcome === 'defeat' || r.outcome !== 'victory') return 'Continue';
  const node = run.pending ? findNode(run, run.pending) : undefined;
  if (!node || node.kind === 'boss') return 'Continue';
  if (callingTierAt(run, node) !== null) return 'Continue: your Calling grows';
  const relics = node.kind === 'event' ? (run.event?.relics ?? 0) : node.reward.relics;
  if (relics > 0) return `Continue: choose a relic`;
  if (node.reward.draft) return 'Continue: choose a motif';
  return 'Continue';
}
