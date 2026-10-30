/**
 * CONTRACT v13 — Bonds (docs/phase-4e.md): each hero's Bond XP and rank, the talents and Solo
 * their rank opens, and the scenes waiting for a Respite. Pure: the profile keeps each hero's
 * Bond, the run the choices it embarked with.
 */
import { CONTENT, type AltSoloDef, type SceneDef, type TalentDef } from '../content';
import type { CombatOutcome, EncounterResult } from './types';

/** A hero's Bond, kept in the profile. */
export interface Bond {
  xp: number;
  /** The talent chosen in each of the three tiers (null: none). */
  talents: (string | null)[];
  /** The Solo they bring: their own, or the alternate their Bond opens. */
  solo: 'default' | 'alt';
  /** The scenes seen, by id, and the reply chosen in each (0 or 1). */
  seen: Record<string, number>;
}

/** What a hero plays with in a run: chosen in Prep, frozen at embark. */
export interface RunBond {
  heroId: string;
  talents: string[];
  /** The alternate Solo's id, or null for their own. */
  solo: string | null;
}

const RULES = () => CONTENT.bondRules;

/** The heroes the content gives Bonds. */
export function bondedHeroes(): string[] {
  return [...new Set(CONTENT.talents.map((t) => t.hero))];
}

export function emptyBond(): Bond {
  return { xp: 0, talents: [null, null, null], solo: 'default', seen: {} };
}

/** The Bond rank (1–10) this much Bond XP reaches. */
export function bondRank(xp: number): number {
  const ranks = RULES().ranks;
  let rank = 1;
  for (let i = 1; i < ranks.length; i++) if (xp >= ranks[i]!) rank = i + 1;
  return rank;
}

/** Progress through the current rank (`span` null at the top). */
export function bondProgress(xp: number): { rank: number; into: number; span: number | null } {
  const ranks = RULES().ranks;
  const rank = bondRank(xp);
  const from = ranks[rank - 1]!;
  const next = ranks[rank];
  return { rank, into: xp - from, span: next === undefined ? null : next - from };
}

/** The Bond rank a talent tier (1–3) opens at. */
export function tierRank(tier: number): number {
  return RULES().talentRanks[tier - 1]!;
}

/** The Bond rank the alternate Solo opens at. */
export function soloRank(): number {
  return RULES().soloRank;
}

/** A hero's two talents in a tier. */
export function talentChoices(heroId: string, tier: number): TalentDef[] {
  return CONTENT.talents.filter((t) => t.hero === heroId && t.tier === tier);
}

/** The alternate Solo a hero's Bond opens (undefined for a hero without one). */
export function altSoloOf(heroId: string): AltSoloDef | undefined {
  return CONTENT.altSolos.find((s) => s.hero === heroId);
}

/** What reaching a Bond rank opens for a hero: a talent tier, the alternate Solo, a scene. */
export function rankOpens(
  heroId: string,
  rank: number,
): { tier: number | null; solo: boolean; scenes: SceneDef[] } {
  const tier = RULES().talentRanks.indexOf(rank);
  return {
    tier: tier >= 0 ? tier + 1 : null,
    solo: rank === RULES().soloRank && altSoloOf(heroId) !== undefined,
    scenes: CONTENT.scenes.filter((s) => s.hero === heroId && s.rank === rank),
  };
}

/**
 * A hero's Bond fitted to the content: unknown talents and scenes forgotten, a talent in the
 * wrong tier cleared. With `rank` (the Bond's own, unless Skip the unlocks gives every rank),
 * choices above it are cleared too.
 */
export function fitBond(heroId: string, bond: Bond, rank = Infinity): Bond {
  const talents = [1, 2, 3].map((tier) => {
    const id = bond.talents[tier - 1] ?? null;
    if (id === null || rank < tierRank(tier)) return null;
    return talentChoices(heroId, tier).some((t) => t.id === id) ? id : null;
  });
  const solo = bond.solo === 'alt' && altSoloOf(heroId) && rank >= soloRank() ? 'alt' : 'default';
  const scenes = new Set(CONTENT.scenes.filter((s) => s.hero === heroId).map((s) => s.id));
  const seen = Object.fromEntries(
    Object.entries(bond.seen).filter(
      ([id, reply]) => scenes.has(id) && (reply === 0 || reply === 1),
    ),
  );
  const xp = Number.isFinite(bond.xp) ? Math.max(0, Math.floor(bond.xp)) : 0;
  return { xp, talents, solo, seen };
}

/**
 * What a run's heroes play with: each one's choices that their rank opens (every rank, with
 * Skip the unlocks). Heroes with nothing chosen are left out.
 */
export function runBonds(
  bonds: Readonly<Record<string, Bond>>,
  heroes: readonly string[],
  all: boolean,
): RunBond[] {
  const out: RunBond[] = [];
  for (const heroId of heroes) {
    const bond = bonds[heroId];
    if (!bond) continue;
    const fitted = fitBond(heroId, bond, all ? Infinity : bondRank(bond.xp));
    const talents = fitted.talents.filter((t): t is string => t !== null);
    const solo = fitted.solo === 'alt' ? (altSoloOf(heroId)?.id ?? null) : null;
    if (talents.length > 0 || solo !== null) out.push({ heroId, talents, solo });
  }
  return out;
}

/** A run's choices as the fight takes them (`SimConfig.bonds`). */
export function bondsConfig(bonds: readonly RunBond[]): { talents: string[]; solos: string[] } {
  return {
    talents: bonds.flatMap((b) => b.talents),
    solos: bonds.flatMap((b) => (b.solo ? [b.solo] : [])),
  };
}

/**
 * The Bond XP a fight pays each bonded hero in it: the fight's weight × (a base, and a share of
 * the pool by your support of them: your healing, shields and saves on them, and the damage you
 * added to theirs). A lost fight pays less.
 */
export function bondXpForFight(
  outcome: CombatOutcome,
  kind: EncounterResult['kind'],
): Record<string, number> {
  const rules = RULES();
  const weight = kind === 'sandbox' ? 0 : rules.kinds[kind];
  if (!(weight > 0)) return {};
  const scale = weight * (outcome.outcome === 'victory' ? 1 : rules.loss);
  const bonded = new Set(bondedHeroes());
  const support = outcome.party.map((p) => Math.max(0, (p.supported ?? 0) + p.amplified));
  const total = support.reduce((a, b) => a + b, 0);
  const out: Record<string, number> = {};
  outcome.party.forEach((p, i) => {
    if (!bonded.has(p.heroId)) return;
    const share = total > 0 ? support[i]! / total : 0;
    out[p.heroId] = Math.round(scale * (rules.base + rules.pool * share));
  });
  return out;
}

/** Adds Bond XP; reports the ranks each hero reached. */
export function addBondXp(
  bonds: Readonly<Record<string, Bond>>,
  xpByHero: Readonly<Record<string, number>>,
): { bonds: Record<string, Bond>; rankUps: { heroId: string; rank: number }[] } {
  const next: Record<string, Bond> = { ...bonds };
  const rankUps: { heroId: string; rank: number }[] = [];
  for (const [heroId, gained] of Object.entries(xpByHero)) {
    const xp = Math.max(0, Math.round(gained));
    if (xp <= 0 || !bondedHeroes().includes(heroId)) continue;
    const bond = next[heroId] ?? emptyBond();
    const before = bondRank(bond.xp);
    const after = bondRank(bond.xp + xp);
    next[heroId] = { ...bond, xp: bond.xp + xp };
    for (let r = before + 1; r <= after; r++) rankUps.push({ heroId, rank: r });
  }
  return { bonds: next, rankUps };
}

/** The scene waiting for a hero at a Respite: the first unseen one their rank has reached. */
export function sceneWaiting(heroId: string, bond: Bond | undefined): SceneDef | null {
  const rank = bondRank(bond?.xp ?? 0);
  return (
    CONTENT.scenes
      .filter((s) => s.hero === heroId && s.rank <= rank && !(bond && s.id in bond.seen))
      .sort((a, b) => a.rank - b.rank)[0] ?? null
  );
}

/** A scene's Bond XP: a share of the XP between its rank and the next. */
export function sceneXp(scene: SceneDef): number {
  const ranks = RULES().ranks;
  const from = ranks[scene.rank - 1]!;
  const to = ranks[scene.rank] ?? from;
  return Math.round(RULES().scene * (to - from));
}
