/**
 * Phase 4e UI: Bonds (docs/phase-4e.md), as plain data and words. Every name, number and line
 * comes from content (`CONTENT.talents` and `talentText`, `CONTENT.altSolos` and `altSoloText`,
 * the heroes' own Solos, `CONTENT.scenes`, `CONTENT.bondRules`) or meta (`bondRank`,
 * `bondProgress`, `tierRank`, `soloRank`, `talentChoices`, `altSoloOf`, `rankOpens`,
 * `sceneWaiting`, `sceneXp`, `bondedHeroes`), so the tuning reaches every screen untouched.
 */
import {
  CONTENT,
  altSoloText,
  heroDef,
  talentDef,
  talentText,
  type SceneDef,
  type TalentDef,
} from '../../content';
import {
  altSoloOf,
  bondProgress,
  bondRank,
  bondedHeroes,
  emptyBond,
  rankOpens,
  sceneWaiting,
  sceneXp,
  soloRank,
  talentChoices,
  tierRank,
  type Bond,
  type RunBond,
} from '../../meta/bonds';
import type { EncounterResult, RunPhase, RunState } from '../../meta/types';
import { fmt, pct } from '../kit/format';

const RULES = () => CONTENT.bondRules;

export const NUMERALS = ['I', 'II', 'III'] as const;

/** A talent tier's numeral: "II". */
export function numeral(tier: number): string {
  return NUMERALS[tier - 1] ?? String(tier);
}

/** The highest Bond rank (content's ranks). */
export function maxBondRank(): number {
  return RULES().ranks.length;
}

/** The talent tiers (1, 2, 3), from content's ranks. */
export function tiers(): number[] {
  return RULES().talentRanks.map((_, i) => i + 1);
}

/** A hero's Bond in the profile, or a new one. */
export function bondOf(bonds: Readonly<Record<string, Bond>>, heroId: string): Bond {
  return bonds[heroId] ?? emptyBond();
}

/**
 * Bonds are open (the Title's button, Prep's row, the frames' ranks, the Codex's page) once a hero
 * has had a Bond rank-up, or with Settings → Skip the unlocks.
 */
export function bondsOpen(bonds: Readonly<Record<string, Bond>>, unlockAll: boolean): boolean {
  return unlockAll || bondedHeroes().some((h) => bondRank(bonds[h]?.xp ?? 0) > 1);
}

/** Each bonded hero's rank, by id: the HUD's frames and the Title's button. */
export function bondRanks(bonds: Readonly<Record<string, Bond>>): Record<string, number> {
  return Object.fromEntries(bondedHeroes().map((h) => [h, bondRank(bonds[h]?.xp ?? 0)]));
}

const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];

/** "two" (small counts in prose). */
export function countWord(n: number): string {
  return WORDS[n] ?? String(n);
}

/** "Kael, Lyra and Vexis". */
export function listAnd(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/** "Kael’s". */
function owner(name: string): string {
  return name.endsWith('s') ? `${name}’` : `${name}’s`;
}

// ── Talents and Solos ─────────────────────────────────────────────────────────────────

export interface TalentView {
  id: string;
  heroId: string;
  tier: number;
  numeral: string;
  name: string;
  /** Filled from its values (`talentText`). */
  text: string;
}

export function talentView(talent: TalentDef | string): TalentView {
  const def = typeof talent === 'string' ? talentDef(talent) : talent;
  return {
    id: def.id,
    heroId: def.hero,
    tier: def.tier,
    numeral: numeral(def.tier),
    name: def.name,
    text: talentText(def),
  };
}

/** A Solo as the screens show it: its name and its two lines (uncued, then cued). */
export interface SoloView {
  heroId: string;
  id: string;
  name: string;
  text: string;
  cued: string;
  /** The alternate one the Bond opens (not the hero's own). */
  alt: boolean;
}

/**
 * The Solo a hero brings: the alternate one named by `soloId` (a run's `RunBond.solo`, a fight's
 * `HeroComponent.soloId`), or their own.
 */
export function soloView(heroId: string, soloId?: string | null): SoloView {
  const alt = soloId ? CONTENT.altSolos.find((s) => s.id === soloId && s.hero === heroId) : null;
  if (alt) {
    const lines = altSoloText(alt);
    return { heroId, id: alt.id, name: alt.name, text: lines.text, cued: lines.cued, alt: true };
  }
  const own = heroDef(heroId).solo;
  return {
    heroId,
    id: own.id,
    name: own.name,
    text: own.description,
    cued: own.cuedDescription,
    alt: false,
  };
}

// ── Ranks and progress ────────────────────────────────────────────────────────────────

export interface BondProgressView {
  rank: number;
  xp: number;
  /** Bond XP into this rank, and the span to the next (null at the top). */
  into: number;
  span: number | null;
  /** 0..1 through this rank (1 at the top). */
  fraction: number;
  /** "112 / 200 Bond XP to rank 4", or "2,950 Bond XP · the highest rank". */
  text: string;
}

export function bondProgressView(xp: number): BondProgressView {
  const { rank, into, span } = bondProgress(xp);
  return {
    rank,
    xp,
    into,
    span,
    fraction: span === null ? 1 : Math.max(0, Math.min(1, into / span)),
    text:
      span === null
        ? `${fmt(xp)} Bond XP · the highest rank`
        : `${fmt(into)} / ${fmt(span)} Bond XP to rank ${rank + 1}`,
  };
}

/** Where a Bond bar stood before and after a gain, within the rank reached after it. */
export function bondGain(
  xpAfter: number,
  gained: number,
): { before: number; after: number; rank: number; rankedUp: boolean } {
  const xpBefore = Math.max(0, xpAfter - gained);
  const after = bondProgressView(xpAfter);
  const rankedUp = bondRank(xpBefore) < after.rank;
  const from = RULES().ranks[after.rank - 1]!;
  const frac = (xp: number) =>
    after.span === null ? 1 : Math.max(0, Math.min(1, (xp - from) / after.span));
  return {
    before: rankedUp ? 0 : frac(xpBefore),
    after: frac(xpAfter),
    rank: after.rank,
    rankedUp,
  };
}

/** Something a Bond rank opens for a hero. */
export interface OpensItem {
  kind: 'tier' | 'solo' | 'scene';
  rank: number;
  /** The tier, the alternate Solo's id, or the scene's id. */
  id: string;
  /** As "Rank 6 opens …" continues: "talents, tier II", "the alternate Solo, Oathkeeper". */
  phrase: string;
}

/** What reaching `rank` opens for a hero (`rankOpens`). */
export function opensAt(heroId: string, rank: number): OpensItem[] {
  const o = rankOpens(heroId, rank);
  const out: OpensItem[] = [];
  if (o.tier !== null)
    out.push({
      kind: 'tier',
      rank,
      id: `tier-${o.tier}`,
      phrase: `talents, tier ${numeral(o.tier)}`,
    });
  const alt = altSoloOf(heroId);
  if (o.solo && alt)
    out.push({ kind: 'solo', rank, id: alt.id, phrase: `the alternate Solo, ${alt.name}` });
  for (const s of o.scenes)
    out.push({ kind: 'scene', rank, id: s.id, phrase: `a scene, “${s.title}”` });
  return out;
}

/** Capitalised for a label: "Talents, tier II". */
export function opensLabel(item: OpensItem): string {
  return item.phrase.charAt(0).toUpperCase() + item.phrase.slice(1);
}

/** The next rank after `rank` that opens something for the hero, and what. */
export function nextOpening(
  heroId: string,
  rank: number,
): { rank: number; items: OpensItem[] } | null {
  for (let r = rank + 1; r <= maxBondRank(); r++) {
    const items = opensAt(heroId, r);
    if (items.length > 0) return { rank: r, items };
  }
  return null;
}

/** "Rank 6 opens talents, tier II." (null past the last opening). */
export function nextLine(heroId: string, rank: number): string | null {
  const next = nextOpening(heroId, rank);
  if (!next) return null;
  return `Rank ${next.rank} opens ${listAnd(next.items.map((i) => i.phrase))}.`;
}

/** One rank on a hero's Bond track. */
export interface TrackStep {
  rank: number;
  /** Cumulative Bond XP it needs. */
  xp: number;
  reached: boolean;
  current: boolean;
  opens: OpensItem[];
}

/** Ranks 1 to the top, with what each opens for the hero. */
export function bondTrack(heroId: string, xp: number): TrackStep[] {
  const rank = bondRank(xp);
  return RULES().ranks.map((need, i) => ({
    rank: i + 1,
    xp: need,
    reached: i + 1 <= rank,
    current: i + 1 === rank,
    opens: opensAt(heroId, i + 1),
  }));
}

// ── The Bonds screen ──────────────────────────────────────────────────────────────────

/** "Opens at Bond rank 6." */
export function lockLine(rank: number): string {
  return `Opens at Bond rank ${rank}.`;
}

/** "The alternate Solo opens at Bond rank 10." */
export function soloLockLine(rank: number): string {
  return `The alternate Solo opens at Bond rank ${rank}.`;
}

/** Open only because of Settings → Skip the unlocks. */
export const SKIP_NOTE = 'Open with Skip the unlocks';

export interface TierView {
  tier: number;
  numeral: string;
  /** The Bond rank it opens at (`tierRank`). */
  rank: number;
  /** The hero's rank has reached it. */
  reached: boolean;
  /** It can be chosen in: reached, or Skip the unlocks. */
  open: boolean;
  /** The talent the profile keeps for it (above its rank only after Skip the unlocks). */
  chosen: string | null;
  talents: (TalentView & { chosen: boolean })[];
  /** "Opens at Bond rank 6." while it's shut. */
  lockLine: string | null;
  /** Open only by Skip the unlocks. */
  note: string | null;
}

export function tierViews(heroId: string, bond: Bond, unlockAll: boolean): TierView[] {
  const rank = bondRank(bond.xp);
  return tiers().map((tier) => {
    const at = tierRank(tier);
    const reached = rank >= at;
    const open = reached || unlockAll;
    const kept = bond.talents[tier - 1] ?? null;
    const choices = talentChoices(heroId, tier);
    const chosen = kept !== null && choices.some((t) => t.id === kept) ? kept : null;
    return {
      tier,
      numeral: numeral(tier),
      rank: at,
      reached,
      open,
      chosen,
      talents: choices.map((t) => ({ ...talentView(t), chosen: t.id === chosen })),
      lockLine: open ? null : lockLine(at),
      note: open && !reached ? SKIP_NOTE : null,
    };
  });
}

/** What a click on a talent does: choose it, clear it (it was chosen), or nothing and why. */
export function talentClick(
  tier: TierView,
  id: string,
): { kind: 'choose' | 'clear'; id: string | null } | { kind: 'locked'; reason: string } {
  if (tier.chosen === id) return { kind: 'clear', id: null };
  if (!tier.open) return { kind: 'locked', reason: tier.lockLine ?? lockLine(tier.rank) };
  return { kind: 'choose', id };
}

export interface SoloChoiceView {
  /** The rank the alternate opens at (`soloRank`). */
  rank: number;
  reached: boolean;
  open: boolean;
  chosen: 'default' | 'alt';
  options: { key: 'default' | 'alt'; solo: SoloView; chosen: boolean }[];
  lockLine: string | null;
  note: string | null;
}

/** The Solo choice, for a hero with an alternate (null without one). */
export function soloChoiceView(
  heroId: string,
  bond: Bond,
  unlockAll: boolean,
): SoloChoiceView | null {
  const alt = altSoloOf(heroId);
  if (!alt) return null;
  const at = soloRank();
  const reached = bondRank(bond.xp) >= at;
  const open = reached || unlockAll;
  const chosen = bond.solo === 'alt' ? 'alt' : 'default';
  return {
    rank: at,
    reached,
    open,
    chosen,
    options: [
      { key: 'default', solo: soloView(heroId, null), chosen: chosen === 'default' },
      { key: 'alt', solo: soloView(heroId, alt.id), chosen: chosen === 'alt' },
    ],
    lockLine: open ? null : lockLine(at),
    note: open && !reached ? SKIP_NOTE : null,
  };
}

export type SceneState = 'seen' | 'waiting' | 'queued' | 'locked';

export interface SceneRow {
  id: string;
  title: string;
  rank: number;
  state: SceneState;
  /** The reply chosen (seen scenes). */
  reply: number | null;
  replyText: string | null;
  /** What it pays (`sceneXp`). */
  xp: number;
  line: string;
}

/**
 * A hero's scenes, by rank: seen (with the reply chosen), waiting for a Respite (the one a
 * Respite offers: `sceneWaiting`), queued behind it, or not yet reached.
 */
export function sceneRows(heroId: string, bond: Bond): SceneRow[] {
  const rank = bondRank(bond.xp);
  const next = sceneWaiting(heroId, bond);
  return CONTENT.scenes
    .filter((s) => s.hero === heroId)
    .sort((a, b) => a.rank - b.rank)
    .map((s) => {
      const reply = s.id in bond.seen ? bond.seen[s.id]! : null;
      const replyText = reply === null ? null : (s.replies[reply]?.text ?? null);
      const xp = sceneXp(s);
      const name = heroDef(heroId).name;
      const state: SceneState =
        reply !== null
          ? 'seen'
          : s.rank > rank
            ? 'locked'
            : next?.id === s.id
              ? 'waiting'
              : 'queued';
      const line =
        state === 'seen'
          ? replyText
            ? `Seen. You said “${replyText}”`
            : 'Seen.'
          : state === 'waiting'
            ? `Waits for a Respite: sit with ${name} there instead of resting (+${fmt(xp)} Bond XP).`
            : state === 'queued'
              ? `Waits for a Respite, after “${next?.title ?? ''}”.`
              : lockLine(s.rank);
      return { id: s.id, title: s.title, rank: s.rank, state, reply, replyText, xp, line };
    });
}

/** A hero's page on the Bonds screen. */
export interface BondPageView {
  heroId: string;
  name: string;
  heroTitle: string;
  color: string;
  progress: BondProgressView;
  /** "Rank 6 opens talents, tier II." (null past the last opening). */
  next: string | null;
  track: TrackStep[];
  tiers: TierView[];
  solo: SoloChoiceView | null;
  scenes: SceneRow[];
}

export function bondPage(heroId: string, bond: Bond, unlockAll: boolean): BondPageView {
  const def = heroDef(heroId);
  const progress = bondProgressView(bond.xp);
  return {
    heroId,
    name: def.name,
    heroTitle: def.title,
    color: def.color,
    progress,
    next: nextLine(heroId, progress.rank),
    track: bondTrack(heroId, bond.xp),
    tiers: tierViews(heroId, bond, unlockAll),
    solo: soloChoiceView(heroId, bond, unlockAll),
    scenes: sceneRows(heroId, bond),
  };
}

/** What a choice says to the screen reader: "Kael: Steady Vanguard, tier I." */
export function talentAnnounce(heroId: string, tier: number, id: string | null): string {
  const name = heroDef(heroId).name;
  return id
    ? `${name}: ${talentDef(id).name}, tier ${numeral(tier)}.`
    : `${name}: no talent in tier ${numeral(tier)}.`;
}

export function soloAnnounce(heroId: string, key: 'default' | 'alt'): string {
  const solo = soloView(heroId, key === 'alt' ? (altSoloOf(heroId)?.id ?? null) : null);
  return `${heroDef(heroId).name} brings ${solo.name}.`;
}

/** The Bonds screen's line under Skip the unlocks. */
export function skipLine(): string {
  return `Settings → Skip the unlocks: every talent and Solo can be chosen, as if each Bond were at rank ${maxBondRank()}. Scenes still wait for real ranks.`;
}

/** The line for a run under way (the screen opened from the Title mid-run). */
export const RUN_UNDER_WAY =
  'Your run under way keeps the talents and Solos it embarked with: what you change here is for the next one.';

// ── Prep ──────────────────────────────────────────────────────────────────────────────

export interface PrepBondView {
  heroId: string;
  name: string;
  color: string;
  rank: number;
  /** The talents the run will play (`run.bonds`), by tier. */
  talents: TalentView[];
  /** The Solo the run will bring. */
  solo: SoloView;
  /** Tiers that can be chosen in now (by rank, or Skip the unlocks). */
  openTiers: number;
  /** "No talent chosen" or "Talents from Bond rank 3", when there are none. */
  empty: string | null;
}

/** Prep's row: each hero's rank (the profile's) and what the run plays (`run.bonds`). */
export function prepBondViews(
  party: readonly string[],
  runBonds: readonly RunBond[],
  bonds: Readonly<Record<string, Bond>>,
  unlockAll: boolean,
): PrepBondView[] {
  const bonded = new Set(bondedHeroes());
  return party
    .filter((h) => bonded.has(h))
    .map((heroId) => {
      const def = heroDef(heroId);
      const rank = bondRank(bonds[heroId]?.xp ?? 0);
      const chosen = runBonds.find((b) => b.heroId === heroId);
      const talents = (chosen?.talents ?? [])
        .filter((id) => CONTENT.talents.some((t) => t.id === id))
        .map((id) => talentView(id))
        .sort((a, b) => a.tier - b.tier);
      const openTiers = tiers().filter((t) => unlockAll || rank >= tierRank(t)).length;
      return {
        heroId,
        name: def.name,
        color: def.color,
        rank,
        talents,
        solo: soloView(heroId, chosen?.solo ?? null),
        openTiers,
        empty:
          talents.length > 0
            ? null
            : openTiers > 0
              ? 'No talent chosen'
              : `Talents from Bond rank ${tierRank(1)}`,
      };
    });
}

// ── Rank-ups ──────────────────────────────────────────────────────────────────────────

/** A Bond rank reached (the profile store's `bondNotices`). */
export interface BondNotice {
  heroId: string;
  rank: number;
}

export interface BondUnlockView {
  kind: 'tier' | 'solo' | 'scene' | 'none';
  title: string;
  text: string;
  /** More: the alternate Solo's lines. */
  detail: string | null;
}

export interface BondRankUpView {
  key: string;
  heroId: string;
  name: string;
  heroTitle: string;
  color: string;
  rank: number;
  opens: BondUnlockView[];
}

/** Where talents and Solos are chosen. */
export const WHERE_TO_CHOOSE = 'on the Bonds screen, from the Title or from Prep';

/** One Bond rank-up's card: what the rank opened for the hero (`rankOpens`). */
export function bondRankUpView(n: BondNotice, bond?: Bond): BondRankUpView {
  const def = heroDef(n.heroId);
  const o = rankOpens(n.heroId, n.rank);
  const opens: BondUnlockView[] = [];
  if (o.tier !== null) {
    const [a, b] = talentChoices(n.heroId, o.tier);
    opens.push({
      kind: 'tier',
      title: `Talents, tier ${numeral(o.tier)}`,
      text: `${a?.name ?? ''} or ${b?.name ?? ''}. Choose one, or neither, ${WHERE_TO_CHOOSE}.`,
      detail: null,
    });
  }
  const alt = altSoloOf(n.heroId);
  if (o.solo && alt) {
    const lines = altSoloText(alt);
    opens.push({
      kind: 'solo',
      title: alt.name,
      text: `${owner(def.name)} alternate Solo. Choose which Solo ${def.name} brings ${WHERE_TO_CHOOSE}.`,
      detail: `${lines.text} ${lines.cued}`,
    });
  }
  const first = bond ? sceneWaiting(n.heroId, bond) : null;
  for (const s of o.scenes) {
    const after = first && first.id !== s.id && first.rank < s.rank ? first : null;
    opens.push({
      kind: 'scene',
      title: `“${s.title}”`,
      text: after
        ? `A scene with ${def.name}: it waits for a Respite, after “${after.title}” (+${fmt(sceneXp(s))} Bond XP).`
        : `A scene with ${def.name} waits for a Respite: sit with ${def.name} there instead of resting (+${fmt(sceneXp(s))} Bond XP).`,
      detail: null,
    });
  }
  if (opens.length === 0) {
    const next = nextLine(n.heroId, n.rank);
    opens.push({
      kind: 'none',
      title: `Bond rank ${n.rank}`,
      text: `Nothing new opens at this rank.${next ? ` ${next}` : ''}`,
      detail: null,
    });
  }
  return {
    key: `${n.heroId}:${n.rank}`,
    heroId: n.heroId,
    name: def.name,
    heroTitle: def.title,
    color: def.color,
    rank: n.rank,
    opens,
  };
}

/** The rank-up card's heading: "Kael’s Bond deepens", or "Bonds deepen". */
export function bondRankUpTitle(notices: readonly BondNotice[]): string {
  const heroes = [...new Set(notices.map((n) => n.heroId))];
  if (heroes.length === 1) return `${owner(heroDef(heroes[0]!).name)} Bond deepens`;
  return 'Bonds deepen';
}

/** The first Bond rank-up ever: what Bonds are, and where to choose. */
export function bondsIntroLines(): string[] {
  const names = bondedHeroes().map((h) => heroDef(h).name);
  const r = RULES();
  const sceneRanks = [...new Set(CONTENT.scenes.map((s) => s.rank))].sort((a, b) => a - b);
  const perHero = CONTENT.scenes.filter((s) => s.hero === bondedHeroes()[0]).length;
  return [
    `${listAnd(names)} grow with you. Every fight pays each of them Bond XP, and more for your support of them: your healing, shields and saves, and the damage you add to theirs.`,
    `Their Bond ranks open talents (at ranks ${listAnd(r.talentRanks.map(String))}: one of two each), an alternate Solo (rank ${r.soloRank}) and ${countWord(perHero)} scenes each (ranks ${listAnd(sceneRanks.map(String))}), told at a Respite instead of resting.`,
    `Choose talents and Solos ${WHERE_TO_CHOOSE}. They change freely between runs; a run keeps the ones it embarks with.`,
  ];
}

/** The card's line under Skip the unlocks. */
export const SKIP_RANKUP_LINE =
  'Skip the unlocks: every talent and Solo can be chosen already. Scenes wait for these ranks.';

/**
 * The Bond rank-up card is up: the Result, the Summary and the map (after a scene) show it once
 * the Weaver's rank-up cards are done. The Deed toasts wait for it, as for theirs.
 */
export function bondCardShows(at: {
  notices: number;
  rankUps: number;
  screen: string;
  phase: RunPhase | null;
}): boolean {
  return (
    at.notices > 0 &&
    at.rankUps === 0 &&
    at.screen === 'run' &&
    (at.phase === 'result' || at.phase === 'summary' || at.phase === 'map')
  );
}

// ── Bond XP: the Result and the Summary ───────────────────────────────────────────────

export interface BondXpRow {
  heroId: string;
  name: string;
  color: string;
  /** Bond XP earned (the fight's, or the run's fights'). */
  gained: number;
  /** Now (the gain included). */
  rank: number;
  before: number;
  after: number;
  rankedUp: boolean;
  /** "40 / 200 Bond XP to rank 4". */
  progress: string;
}

/** The Bond XP the heroes earned (`gained`), against their Bonds now (the gain included). */
export function bondXpRows(
  heroIds: readonly string[],
  gained: Readonly<Record<string, number>>,
  bonds: Readonly<Record<string, Bond>>,
): BondXpRow[] {
  const bonded = new Set(bondedHeroes());
  return heroIds
    .filter((h) => bonded.has(h) && h in gained)
    .map((heroId) => {
      const def = heroDef(heroId);
      const xp = bonds[heroId]?.xp ?? 0;
      const g = Math.max(0, gained[heroId] ?? 0);
      const gain = bondGain(xp, g);
      return {
        heroId,
        name: def.name,
        color: def.color,
        gained: g,
        rank: gain.rank,
        before: gain.before,
        after: gain.after,
        rankedUp: gain.rankedUp,
        progress: bondProgressView(xp).text,
      };
    });
}

/** "+18 Bond XP". */
export function bondXpHeadline(xp: number): string {
  return `+${fmt(xp)} Bond XP`;
}

/** The Bond XP a run paid each hero: its fights' (`EncounterResult.bondXp`) and its scenes'. */
export function runBondXp(run: Pick<RunState, 'results' | 'scenes'>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of run.results)
    for (const [heroId, xp] of Object.entries(r.bondXp ?? {}))
      out[heroId] = (out[heroId] ?? 0) + xp;
  for (const id of run.scenes ?? []) {
    const scene = CONTENT.scenes.find((s) => s.id === id);
    if (scene) out[scene.hero] = (out[scene.hero] ?? 0) + sceneXp(scene);
  }
  return out;
}

/** A fight's Bond XP, by hero (none for a result from before Bonds). */
export function fightBondXp(result: Pick<EncounterResult, 'bondXp'>): Record<string, number> {
  return { ...(result.bondXp ?? {}) };
}

// ── The Respite and its scenes ────────────────────────────────────────────────────────

export interface SceneChoiceView {
  sceneId: string;
  heroId: string;
  name: string;
  color: string;
  /** The key that takes it: 4, then 5. */
  key: string;
  /** "Sit with Kael". */
  title: string;
  sceneTitle: string;
  xp: number;
  lines: string[];
}

/** A Respite's fourth choice, one per waiting scene, keyed from `firstKey`. */
export function sceneChoices(scenes: readonly SceneDef[], firstKey = 4): SceneChoiceView[] {
  return scenes.map((s, i) => {
    const def = heroDef(s.hero);
    const xp = sceneXp(s);
    return {
      sceneId: s.id,
      heroId: s.hero,
      name: def.name,
      color: def.color,
      key: String(firstKey + i),
      title: `Sit with ${def.name}`,
      sceneTitle: s.title,
      xp,
      lines: [
        `“${s.title}”: a few words with ${def.name} by the fire.`,
        `+${fmt(xp)} Bond XP with ${def.name}.`,
        'No healing and no motif.',
      ],
    };
  });
}

/** The scene's Continue: what it pays. */
export function sceneXpLine(scene: SceneDef): string {
  return `${bondXpHeadline(sceneXp(scene))} with ${heroDef(scene.hero).name}`;
}

// ── In a fight ────────────────────────────────────────────────────────────────────────

export interface HeroBondTip {
  /** Their Bond rank (null: Bonds aren't open yet). */
  rank: number | null;
  /** The talents in force this fight, by tier. */
  talents: TalentView[];
  /** The Solo they brought. */
  solo: SoloView;
}

/** A frame's tooltip: the hero's rank, the fight's talents and the Solo they brought. */
export function heroBondTip(
  heroId: string,
  talents: readonly string[],
  soloId: string,
  rank: number | null,
): HeroBondTip {
  return {
    rank,
    talents: talents
      .filter((id) => CONTENT.talents.some((t) => t.id === id))
      .map((id) => talentView(id))
      .sort((a, b) => a.tier - b.tier),
    solo: soloView(heroId, soloId),
  };
}

// ── The Codex ─────────────────────────────────────────────────────────────────────────

const KIND_PHRASE: Record<string, string> = {
  skirmish: 'a skirmish',
  elite: 'an elite',
  miniboss: 'a mini-boss',
  boss: 'the boss',
};

/** "×1.5". */
function times(n: number): string {
  return `×${Math.round(n * 100) / 100}`;
}

/** How Bond XP is earned, from content's rules. */
export function bondRulesLines(): { fight: string; weights: string; scene: string } {
  const r = RULES();
  const kinds = Object.entries(r.kinds).map(([k, m]) => `${KIND_PHRASE[k] ?? k} ${times(m)}`);
  return {
    fight: `After every fight, each hero in it earns ${fmt(r.base)} Bond XP, and a share of ${fmt(r.pool)} more by your support of them that fight: your healing and shields on them, the damage your songs and Thread added to theirs, and the life your saves kept. Without any support, the share isn’t paid.`,
    weights: `Both scale with the fight: ${listAnd(kinds)}. A lost fight pays ${pct(r.loss)} of that.`,
    scene: `A scene pays ${pct(r.scene)} of the Bond XP between its rank and the next, once.`,
  };
}

export interface RankRow {
  rank: number;
  /** Cumulative Bond XP. */
  xp: number;
  /** From the rank before. */
  step: number;
  /** What it opens, for every hero: "Talents, tier I", "A scene each (56 Bond XP)". */
  opens: string[];
}

/** The ranks, their XP, and what each opens (the same for every hero). */
export function rankRows(): RankRow[] {
  const r = RULES();
  return r.ranks.map((xp, i) => {
    const rank = i + 1;
    const opens: string[] = [];
    const tier = r.talentRanks.indexOf(rank);
    if (tier >= 0) opens.push(`Talents, tier ${numeral(tier + 1)}`);
    if (rank === r.soloRank) opens.push('The alternate Solo');
    // A scene's XP is its rank's (`sceneXp`): the same for every hero at that rank.
    const scenes = CONTENT.scenes.filter((s) => s.rank === rank);
    if (scenes.length > 0) {
      const heroes = [...new Set(scenes.map((s) => s.hero))];
      const who = bondedHeroes().every((h) => heroes.includes(h))
        ? 'A scene each'
        : `A scene with ${listAnd(heroes.map((h) => heroDef(h).name))}`;
      opens.push(`${who} (${fmt(sceneXp(scenes[0]!))} Bond XP)`);
    }
    return { rank, xp, step: i === 0 ? 0 : xp - r.ranks[i - 1]!, opens };
  });
}
