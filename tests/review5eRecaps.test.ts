/**
 * Phase 5e review: every Seren and Oro down names an answer, and the blow's own answer (a raid's,
 * a mark's, the Finale's) is never replaced by a duel or grove line that doesn't answer it.
 */
import { describe, expect, it } from 'vitest';
import { GROVE_FELT_OUTSIDE } from '../src/meta/run';
import type { DeathRecap } from '../src/meta/types';
import { deathAdviceLine, runDownAdvice } from '../src/ui/screens/resultText';

const SO = ['kael', 'seren', 'oro'];

function down(over: Partial<DeathRecap>): DeathRecap {
  return {
    heroId: 'seren',
    time: 30,
    killer: 'Requiem',
    recap: [],
    readyTechniques: [],
    ...over,
  } as unknown as DeathRecap;
}

const QUIET_DUEL = { warded: false, parryable: false, overextended: false, far: false };
const QUIET_GROVE = { melee: false, feltOutside: 0, threadCut: false };

describe('Seren and Oro downs always name an answer', () => {
  it('a Movement I telegraph down names the blow’s own answers', () => {
    expect(deathAdviceLine(down({ duel: QUIET_DUEL, answers: ['dome', 'ward'] }), SO)).toMatch(
      /^Answers?: /,
    );
    const oro = down({
      heroId: 'oro',
      killer: 'Dirge',
      grove: { ...QUIET_GROVE, feltOutside: 2 },
      answers: ['chime', 'ward'],
    });
    // The mark's own answer, not the Saplings felled earlier.
    expect(deathAdviceLine(oro, SO)).toMatch(/^Answers?: /);
  });

  it('a down nothing else answers falls back to the hero’s own line', () => {
    const seren = deathAdviceLine(down({ killer: 'Hollow Chorister', duel: QUIET_DUEL }), SO);
    expect(seren).toBeTruthy();
    const felt = down({ heroId: 'oro', killer: 'x', grove: { ...QUIET_GROVE, feltOutside: 1 } });
    expect(deathAdviceLine(felt, SO)).toBe(GROVE_FELT_OUTSIDE);
    const quiet = down({ heroId: 'oro', killer: 'x', grove: QUIET_GROVE });
    expect(deathAdviceLine(quiet, SO)).toBeTruthy();
    // Every other hero's down stays as it was: no answers, no line.
    expect(deathAdviceLine(down({ heroId: 'kael', killer: 'x' }), SO)).toBeNull();
  });

  it('the Summary still counts Saplings felled outside your songs', () => {
    const felt = down({ heroId: 'oro', killer: 'x', grove: { ...QUIET_GROVE, feltOutside: 1 } });
    const r = { deaths: [felt], heroes: SO.map((heroId) => ({ heroId })) };
    expect(runDownAdvice([r as never], 'oro')).toEqual([{ text: GROVE_FELT_OUTSIDE, count: 1 }]);
  });
});
