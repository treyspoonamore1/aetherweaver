/**
 * CONTRACT v15 — the Loom (docs/phase-4g.md): Starlight, the Atelier's keepsakes and Calling
 * mastery. Pure: the profile store keeps the state.
 */
import { CONTENT } from '../content';
import type { EncounterResult } from './types';

/** What the Weaver wears and is called: a robe, a Thread look, a title (null: the default). */
export interface Look {
  robe: string | null;
  thread: string | null;
  title: string | null;
}

export function noLook(): Look {
  return { robe: null, thread: null, title: null };
}

/** The part of the profile the Loom reads and writes. */
export interface LoomState {
  starlight: number;
  /** Keepsakes owned: robes, Thread looks and bought titles. */
  cosmetics: string[];
  look: Look;
  /** Mastery XP by Calling id. */
  mastery: Record<string, number>;
  /** Technique variants owned (docs/phase-4f.md). */
  variants: string[];
  /** Deeds earned (a Deed's title is earned with it). */
  deeds: string[];
}

const S = () => CONTENT.starlight;

// ── Starlight ─────────────────────────────────────────────────────────────────────────

/** A fight's Starlight: a won fight pays by its kind (and the won run's bonus, at its end). */
export function starlightForFight(
  result: Pick<EncounterResult, 'kind' | 'outcome'>,
  wonRun: boolean,
  mult = 1,
): number {
  if (result.outcome !== 'victory' || result.kind === 'sandbox') return 0;
  const pay = S().fights[result.kind] + (wonRun ? S().winBonus : 0);
  return Math.round(pay * mult);
}

/** What these newly earned Deeds pay: the ladder's by their place on it, a badge its own. */
export function starlightForDeeds(ids: readonly string[]): number {
  const ladder = CONTENT.deeds.filter((d) => d.points === 1).map((d) => d.id);
  let total = 0;
  for (const id of ids) {
    const deed = CONTENT.deeds.find((d) => d.id === id);
    if (!deed) continue;
    const step = ladder.indexOf(id);
    total += step >= 0 ? (S().deedLadder[step] ?? S().deedLadder.at(-1) ?? 0) : S().deedBadge;
  }
  return total;
}

// ── Calling mastery ───────────────────────────────────────────────────────────────────

/** A Calling's mastery level (1–5) for this much mastery XP. */
export function masteryLevel(xp: number): number {
  const levels = CONTENT.mastery.levels;
  let level = 1;
  for (let i = 1; i < levels.length; i++) if (xp >= levels[i]!) level = i + 1;
  return level;
}

/** Progress through a mastery level (`span` null at the top). */
export function masteryProgress(xp: number): { level: number; into: number; span: number | null } {
  const levels = CONTENT.mastery.levels;
  const level = masteryLevel(xp);
  const from = levels[level - 1]!;
  const next = levels[level];
  return { level, into: xp - from, span: next === undefined ? null : next - from };
}

/** How many of a Calling's path tiers a run may offer: its mastery's (every one, with `all`). */
export function tiersOpen(callingId: string, masteryXp: number, all: boolean): number {
  const def = CONTENT.callings.find((c) => c.id === callingId);
  const tiers = def?.tiers.length ?? 0;
  return all ? tiers : Math.min(tiers, masteryLevel(masteryXp));
}

/** The Calling whose top mastery opens this variant, if one does. */
export function masteryFor(variantId: string): string | null {
  return CONTENT.mastery.callings.find((m) => m.variant === variantId)?.calling ?? null;
}

// ── The Atelier ───────────────────────────────────────────────────────────────────────

export type ShopKind = 'variant' | 'robe' | 'thread' | 'title';

export interface ShopItem {
  id: string;
  kind: ShopKind;
  name: string;
  /** Starlight; null for a title that's earned, not bought. */
  price: number | null;
  /**
   * `owned`, `earned` (a title, by mastery or a Deed), `buyable`, `open` (a variant Skip the
   * unlocks lets you play without buying) or `locked`.
   */
  state: 'owned' | 'earned' | 'buyable' | 'open' | 'locked';
  /** Why it's locked, or how a title is earned. */
  reason: string | null;
}

const TOP = () => CONTENT.mastery.levels.length;

/** The titles this profile has earned: its Callings' top masteries and its Deeds'. */
export function earnedTitles(state: Pick<LoomState, 'mastery' | 'deeds'>): string[] {
  return CONTENT.cosmetics.titles
    .filter((t) => {
      if (!t.earned) return false;
      if ('mastery' in t.earned) return masteryLevel(state.mastery[t.earned.mastery] ?? 0) >= TOP();
      return state.deeds.includes(t.earned.deed);
    })
    .map((t) => t.id);
}

/** Everything the Atelier shows, in order: variants, robes, Thread looks, titles. */
export function shopItems(state: LoomState, rank: number, all: boolean): ShopItem[] {
  const open = all || rank >= S().atelierRank;
  const closed = `The Atelier opens at Weaver Rank ${S().atelierRank}.`;
  const items: ShopItem[] = [];
  for (const v of CONTENT.techniqueVariants) {
    const calling = masteryFor(v.id);
    const name = calling ? CONTENT.callings.find((c) => c.id === calling)?.name : undefined;
    const mastered = !calling || masteryLevel(state.mastery[calling] ?? 0) >= TOP();
    const owned = state.variants.includes(v.id);
    items.push({
      id: v.id,
      kind: 'variant',
      name: v.name,
      price: S().variantPrice,
      state: owned ? 'owned' : all ? 'open' : !open || !mastered ? 'locked' : 'buyable',
      reason: owned
        ? null
        : !open
          ? closed
          : mastered
            ? null
            : `Opens with the ${name ?? calling}'s top mastery.`,
    });
  }
  const sell = (id: string, kind: ShopKind, name: string, price: number) =>
    items.push({
      id,
      kind,
      name,
      price,
      state: state.cosmetics.includes(id) ? 'owned' : open ? 'buyable' : 'locked',
      reason: state.cosmetics.includes(id) || open ? null : closed,
    });
  for (const r of CONTENT.cosmetics.robes) sell(r.id, 'robe', r.name, r.price);
  for (const t of CONTENT.cosmetics.threads) sell(t.id, 'thread', t.name, t.price);
  const earned = earnedTitles(state);
  for (const t of CONTENT.cosmetics.titles) {
    if (t.price !== undefined) {
      sell(t.id, 'title', t.text, t.price);
      continue;
    }
    const how =
      t.earned && 'mastery' in t.earned
        ? `Earned with the ${CONTENT.callings.find((c) => c.id === (t.earned as { mastery: string }).mastery)?.name ?? 'Calling'}'s top mastery.`
        : `Earned with the Deed ${CONTENT.deeds.find((d) => d.id === (t.earned as { deed: string }).deed)?.name ?? ''}.`;
    items.push({
      id: t.id,
      kind: 'title',
      name: t.text,
      price: null,
      state: earned.includes(t.id) ? 'earned' : 'locked',
      reason: how,
    });
  }
  return items;
}

/** Buys an Atelier item: the state after, or why it can't be bought. */
export function buy(
  state: LoomState,
  id: string,
  rank: number,
  all: boolean,
): { state: LoomState } | { refused: string } {
  const item = shopItems(state, rank, all).find((i) => i.id === id);
  if (!item) return { refused: 'unknown' };
  // Skip the unlocks lets you play a variant without buying it; it can still be bought.
  const buyable = item.state === 'buyable' || (item.state === 'open' && item.kind === 'variant');
  if (!buyable || item.price === null) return { refused: item.reason ?? 'not for sale' };
  if (state.starlight < item.price) return { refused: 'Not enough Starlight.' };
  const starlight = state.starlight - item.price;
  return item.kind === 'variant'
    ? { state: { ...state, starlight, variants: [...state.variants, id] } }
    : { state: { ...state, starlight, cosmetics: [...state.cosmetics, id] } };
}

/** Wears a keepsake (or the default, null): only one owned, or a title earned. */
export function equip(state: LoomState, slot: keyof Look, id: string | null): Look {
  if (id === null) return { ...state.look, [slot]: null };
  const list =
    slot === 'robe'
      ? CONTENT.cosmetics.robes
      : slot === 'thread'
        ? CONTENT.cosmetics.threads
        : CONTENT.cosmetics.titles;
  if (!list.some((x) => x.id === id)) return state.look;
  const mine =
    state.cosmetics.includes(id) || (slot === 'title' && earnedTitles(state).includes(id));
  return mine ? { ...state.look, [slot]: id } : state.look;
}

/** Owned keepsakes the content still knows, each once (earned titles aren't kept here). */
export function fitCosmetics(owned: readonly string[]): string[] {
  const c = CONTENT.cosmetics;
  const known = new Set([
    ...c.robes.map((r) => r.id),
    ...c.threads.map((t) => t.id),
    ...c.titles.filter((t) => t.price !== undefined).map((t) => t.id),
  ]);
  return [...new Set(owned.filter((id) => known.has(id)))];
}

/** A saved look fitted to the content and to what's owned or earned. */
export function fitLook(state: LoomState): Look {
  let look = noLook();
  for (const slot of ['robe', 'thread', 'title'] as const)
    look = equip({ ...state, look }, slot, state.look[slot]);
  return look;
}
