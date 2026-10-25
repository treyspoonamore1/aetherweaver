/**
 * The run's economy (docs/phase-3b.md): Aether earned by fighting, and what merchants, forges
 * and relic offers charge and give. Pure numbers; meta/run.ts applies them.
 */
import type { RelicRarity } from '../content';
import type { EncounterKind } from '../sim';
import type { ForgeService, Grade } from './types';

/** Aether a run starts with. */
export const START_AETHER = 0;

/**
 * Threat (docs/phase-3b.md): the deeper the row, the more life every enemy has, so the party's
 * growth (motifs, relics, a merchant's healing) never outruns the fights. Row 1 is ×1.
 */
export const THREAT_PER_ROW = 0.0375;

export function threatFor(row: number): number {
  return Math.round((1 + THREAT_PER_ROW * Math.max(0, row - 1)) * 1000) / 1000;
}

/** Aether for winning each kind of fight, before the grade bonus. A loss earns none. */
export const FIGHT_AETHER: Readonly<Record<EncounterKind, number>> = {
  sandbox: 0,
  skirmish: 20,
  elite: 35,
  miniboss: 50,
  boss: 0,
};
export const GRADE_AETHER: Readonly<Record<Grade, number>> = {
  S: 1.5,
  A: 1.3,
  B: 1.15,
  C: 1,
  D: 0.85,
};

export function aetherForFight(
  kind: EncounterKind,
  outcome: 'victory' | 'defeat',
  grade: Grade,
): number {
  if (outcome !== 'victory') return 0;
  return Math.round(FIGHT_AETHER[kind] * GRADE_AETHER[grade]);
}

export const RELIC_PRICE: Readonly<Record<RelicRarity, number>> = {
  common: 50,
  rare: 80,
  legendary: 130,
  cursed: 30,
};
export const MOTIF_PRICE: Readonly<Record<'common' | 'rare' | 'epic', number>> = {
  common: 35,
  rare: 55,
  epic: 80,
};
/** A merchant's healing: every hero heals this much, once per visit. */
export const SHOP_HEAL = { pct: 0.3, price: 25 } as const;
export const SHOP_RELICS = 3;
export const SHOP_MOTIFS = 2;
/** How likely each rarity is for a relic on a merchant's cloth. */
export const SHOP_RELIC_ODDS: Readonly<Record<RelicRarity, number>> = {
  common: 45,
  rare: 33,
  legendary: 10,
  cursed: 12,
};

export const FORGE_PRICE: Readonly<Record<ForgeService, number>> = {
  temper: 30,
  retune: 20,
  cleanse: 40,
};

/** Relics to choose from after winning: how many, and how likely each rarity is. */
export const RELIC_OFFERS: Readonly<
  Record<'elite' | 'boss' | 'event', { count: number; odds: Partial<Record<RelicRarity, number>> }>
> = {
  elite: { count: 2, odds: { common: 50, rare: 38, legendary: 12 } },
  boss: { count: 3, odds: { rare: 60, legendary: 40 } },
  event: { count: 3, odds: { common: 40, rare: 42, legendary: 18 } },
};
