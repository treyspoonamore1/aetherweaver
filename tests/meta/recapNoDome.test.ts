/**
 * Recaps for a party without Kael (docs/phase-5b.md, "Recaps for Brann's downs"): no recap,
 * summary or SAVE_HOW text names the dome or Kael, and Brann's downs are worded by what the down
 * record's `blood` says, in priority order. The default party's recaps are unchanged.
 */
import { describe, expect, it } from 'vitest';
import * as Run from '../../src/meta/run';
import type { CombatOutcome, MapNode } from '../../src/meta/types';
import type { DeathRecord, SaveRecord } from '../../src/sim/state';
import { emptyLedger } from '../../src/sim/world';
import { deathAnswerLine } from '../../src/ui/screens/resultText';

const B = ['lyra', 'vexis', 'brann'];
const C = ['kael', 'lyra', 'brann'];
const DEFAULT = ['kael', 'lyra', 'vexis'];

const run = Run.embark(Run.newRun(3, undefined, [], [], [], [], undefined, 2));
const VHARUN: MapNode = run.map.rows.flat().find((n) => n.encounterId === 'vharun')!;

const death = (heroDefId: string, extra: Partial<DeathRecord> = {}): DeathRecord => ({
  time: 30,
  hero: 1,
  heroDefId,
  killer: 'Twin Cleave',
  recap: [{ time: 29.5, amount: 400, source: 'Twin Cleave' }],
  readyTechniques: ['reel'],
  answers: ['ward', 'reel', 'dome'],
  ...extra,
});

const save = (heroDefId: string, cause: SaveRecord['cause']): SaveRecord => ({
  time: 12,
  hero: 2,
  heroDefId,
  cause,
  prevented: 600,
  attack: 'Twin Cleave',
});

function outcome(party: readonly string[], deaths: DeathRecord[], saves: SaveRecord[] = []) {
  const ledger = emptyLedger();
  ledger.deaths.push(...deaths);
  ledger.saves.push(...saves);
  const o: CombatOutcome = {
    encounterId: 'vharun',
    outcome: 'defeat',
    duration: 80,
    ledger,
    party: party.map((heroId, slot) => ({
      slot,
      heroId,
      hp: 0,
      maxHp: 1000,
      downed: true,
      dead: false,
      damage: 1000,
      amplified: 0,
    })),
    withoutYou: null,
  };
  return o;
}

describe('no dome, no Kael for a party without him', () => {
  it('the recap’s answers, the saves and the answer line drop the dome', () => {
    const r = Run.summarize(
      VHARUN,
      outcome(B, [death('brann'), death('lyra')], [save('lyra', 'dome'), save('vexis', 'ward')]),
    );
    for (const d of r.deaths) expect(d.answers).toEqual(['ward', 'reel']);
    const text = JSON.stringify({
      highlights: r.highlights,
      deaths: r.deaths.map((d) => d.answers),
      lines: r.deaths.map((d) => deathAnswerLine(d.answers)),
      advice: r.deaths.map((d) => Run.downAdvice(d, B)),
    });
    expect(text).not.toMatch(/dome|kael/i);
    expect(r.highlights.some((h) => h.text.includes('with a shield'))).toBe(true);
  });

  it('the default party (and party C) still hears of Kael’s dome', () => {
    for (const party of [DEFAULT, C]) {
      const r = Run.summarize(VHARUN, outcome(party, [death('lyra')], [save('lyra', 'dome')]));
      expect(r.deaths[0]!.answers).toEqual(['ward', 'reel', 'dome']);
      expect(r.highlights.some((h) => h.text.includes('under Kael’s dome'))).toBe(true);
    }
  });
});

describe('Brann’s downs, in priority order', () => {
  const brann = (blood: DeathRecord['blood'], killer = 'Twin Cleave') =>
    Run.summarize(VHARUN, outcome(B, [death('brann', { blood, killer })])).deaths[0]!;

  it('a refused Rally first, then a quartered heal, then Twin Cleave with no dome', () => {
    expect(Run.downAdvice(brann({ refusedRally: true, healCut: 0.25 }), B)).toBe(
      'He wouldn’t Rally below 40%: Reel him, or Ward him so Iron Will brings him back.',
    );
    expect(Run.downAdvice(brann({ refusedRally: false, healCut: 0.25 }), B)).toBe(
      'Your healing on him was quartered outside the pool: Ward him or give him a barrier.',
    );
    expect(Run.downAdvice(brann({ refusedRally: false, healCut: 0.125 }), B)).toMatch(/quartered/);
    expect(Run.downAdvice(brann({ refusedRally: false, healCut: 0.5 }), B)).toBe(
      'Two blows on Brann: Reel him, or Ward him twice.',
    );
  });

  it('otherwise the generic answers: with Kael there, another killer, or no blood', () => {
    expect(Run.downAdvice(brann({ refusedRally: false, healCut: 0.5 }), C)).toBeNull();
    expect(
      Run.downAdvice(brann({ refusedRally: false, healCut: 0.5 }, 'Blood Pact'), B),
    ).toBeNull();
    expect(Run.downAdvice(brann(undefined), B)).toBeNull();
    const lyra = Run.summarize(VHARUN, outcome(B, [death('lyra')])).deaths[0]!;
    expect(Run.downAdvice(lyra, B)).toBeNull();
  });
});
