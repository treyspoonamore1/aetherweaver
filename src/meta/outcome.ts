import type { CombatOutcome, HeroBloodStats, HeroDuelStats, HeroGroveStats } from './types';
import type {
  BloodState,
  DuelState,
  GroveState,
  LedgerDuel,
  LedgerGrove,
  WithoutYou,
  WorldState,
} from '../sim';

/** A Blood Rage hero's fight, as the run keeps it (docs/phase-5b.md): the sim's stats, copied. */
function bloodStats(b: Readonly<BloodState>): HeroBloodStats {
  return {
    lifesteal: b.lifesteal,
    lowTime: b.lowTime,
    low30Time: b.low30Time,
    aliveTime: b.aliveTime,
    peakAfterLow: b.peakAfterLow,
    spent: b.spent,
  };
}

/**
 * Seren's fight, as the run keeps it (docs/phase-5e.md): her duel's tallies, copied, and what your
 * Wards dealt through her (`ledger.duel`: the Ward counters and the kill shots; 0 without one).
 */
function duelStats(
  d: Pick<DuelState, 'parries' | 'killShots' | 'counterDamage' | 'overextendedTime'>,
  ledger: Readonly<LedgerDuel> | undefined,
): HeroDuelStats {
  return {
    parries: d.parries,
    killShots: d.killShots,
    counterDamage: d.counterDamage,
    overextendedTime: d.overextendedTime,
    wardsDealt: ledger?.wardsDealt ?? 0,
  };
}

/**
 * Oro's fight, as the run keeps it (docs/phase-5e.md): Saplings felled, the share of their alive
 * time inside your songs (0 when none stood), Rootbond's healing and the Ancients raised.
 */
function groveStats(
  g: Pick<GroveState, 'lost' | 'inFieldTime' | 'aliveTime' | 'rootbondHeal' | 'ancients'>,
  ledger: Readonly<LedgerGrove> | undefined,
): HeroGroveStats {
  return {
    saplingsLost: g.lost,
    inFieldShare: g.aliveTime > 0 ? Math.min(1, g.inFieldTime / g.aliveTime) : 0,
    rootbondHeal: g.rootbondHeal,
    ancients: g.ancients,
    // His summons' damage this fight (`ledger.grove`; one Oro to a party).
    summonDamage: ledger?.summonDamage ?? 0,
  };
}

/** A plain-data summary of how the encounter went, for the run layer. */
export function buildOutcome(
  state: WorldState,
  heroIds: readonly string[],
  withoutYou: WithoutYou | null = null,
): CombatOutcome {
  const enc = state.encounter;
  return {
    encounterId: enc.id,
    outcome: enc.status === 'victory' ? 'victory' : 'defeat',
    duration: Math.max(0, (enc.endedAt ?? state.time) - enc.startedAt),
    ledger: JSON.parse(JSON.stringify(state.ledger)) as CombatOutcome['ledger'],
    party: state.party.map((id, slot) => {
      const e = state.entities.get(id);
      const h = e?.health;
      return {
        slot,
        heroId: e?.hero?.defId ?? heroIds[slot] ?? '',
        hp: h?.hp ?? 0,
        maxHp: h?.maxHp ?? 1,
        downed: h?.downed ?? false,
        dead: h?.dead ?? false,
        damage: e?.hero?.damageDealt ?? 0,
        amplified: e?.hero?.damageAmplified ?? 0,
        // Bonds (docs/phase-4e.md): your healing, shields and saves on them.
        supported: e?.hero?.supportReceived ?? 0,
        // Brann (docs/phase-5b.md): only a hero with Blood Rage has it.
        ...(e?.hero?.blood ? { blood: bloodStats(e.hero.blood) } : {}),
        // Seren and Oro (docs/phase-5e.md): only a hero with Parry or Rootbond has each.
        ...(e?.hero?.duel ? { duel: duelStats(e.hero.duel, state.ledger.duel) } : {}),
        ...(e?.hero?.grove ? { grove: groveStats(e.hero.grove, state.ledger.grove) } : {}),
      };
    }),
    withoutYou,
  };
}
