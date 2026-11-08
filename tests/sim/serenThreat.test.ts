/**
 * Phase 5e W9 (docs/phase-5e.md, "By party"; default, awaiting your confirmation): with no Kael
 * (no tank) in the party, Seren holds the bosses. Her hits on a boss or miniboss count
 * `DUEL_BOSS_THREAT` times her own threat; with Kael in the party, on any lesser foe, and for
 * every other hero, threat is what it always was.
 */
import { describe, expect, it } from 'vitest';
import { heroDef } from '../../src/content';
import { dealDamage } from '../../src/sim/combat/health';
import { DUEL_BOSS_THREAT } from '../../src/sim/systems/duel';
import { foe, setup } from './serenHelpers';

function threatAfter(party: string[], enemyId: string, who = 'seren', noThreat = false) {
  const s = setup(party.includes('seren') ? party : [...party.slice(0, 2), 'seren']);
  const hero = s.of(who);
  const target = foe(s.w, enemyId, hero.x, hero.z - 8, { hp: 1e7, stun: true });
  dealDamage(s.w, target, {
    source: hero.id,
    sourceName: 'test',
    amount: 100,
    ...(noThreat ? { noThreat: true as const } : {}),
  });
  return target.enemy!.threat[hero.hero!.slot] ?? 0;
}

describe('Seren holds the bosses when there is no Kael (docs/phase-5e.md, "By party")', () => {
  it('no tank: a boss or miniboss takes her hits at DUEL_BOSS_THREAT times her threat', () => {
    const mult = heroDef('seren').threatMult;
    expect(DUEL_BOSS_THREAT).toBe(6);
    expect(threatAfter(['lyra', 'vexis', 'seren'], 'the_hollow_cantor')).toBeCloseTo(
      100 * mult * DUEL_BOSS_THREAT,
      6,
    );
    expect(threatAfter(['lyra', 'vexis', 'seren'], 'the_bellwarden')).toBeCloseTo(
      100 * mult * DUEL_BOSS_THREAT,
      6,
    );
  });

  it('with Kael, on a lesser foe, for another hero, or with no threat: as it always was', () => {
    const mult = heroDef('seren').threatMult;
    expect(threatAfter(['kael', 'vexis', 'seren'], 'the_hollow_cantor')).toBeCloseTo(100 * mult, 6);
    expect(threatAfter(['lyra', 'vexis', 'seren'], 'bell_brute')).toBeCloseTo(100 * mult, 6);
    expect(threatAfter(['lyra', 'vexis', 'seren'], 'the_hollow_cantor', 'lyra')).toBeCloseTo(
      100 * heroDef('lyra').threatMult,
      6,
    );
    expect(threatAfter(['lyra', 'vexis', 'seren'], 'the_hollow_cantor', 'seren', true)).toBe(0);
  });
});
