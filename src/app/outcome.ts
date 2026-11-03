import type { CombatOutcome, HeroBloodStats } from '../meta/types';
import type { BloodState, WithoutYou, WorldState } from '../sim';

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
      };
    }),
    withoutYou,
  };
}
