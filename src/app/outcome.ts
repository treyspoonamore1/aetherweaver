import type { CombatOutcome } from '../meta/types';
import type { WithoutYou, WorldState } from '../sim';

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
      };
    }),
    withoutYou,
  };
}
