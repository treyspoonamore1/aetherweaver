import { describe, expect, it } from 'vitest';
import type { EncounterResult, WithoutYou } from '../src/meta/types';
import { evaluateHints } from '../src/ui/hud/hints';
import { mockHud, resultRun } from '../src/ui/lab/mock';
import { statLines } from '../src/ui/screens/resultText';
import {
  madeTheDifference,
  tallyLine,
  withoutYouLine,
  withoutYouTally,
} from '../src/ui/screens/withoutYouText';

function alone(over: Partial<WithoutYou>): WithoutYou {
  return {
    outcome: 'defeat',
    duration: 41,
    wave: 2,
    waves: 3,
    downs: 4,
    standing: 0,
    bossHp: null,
    ticks: 2460,
    hash: 'x',
    ...over,
  };
}

const won = { outcome: 'victory' as const, duration: 95 };

describe('"Without you"', () => {
  it('says how the fight goes alone', () => {
    expect(withoutYouLine(alone({}), won)).toBe(
      'Without you, the party falls at 0:41 in wave 2 of 3.',
    );
    expect(withoutYouLine(alone({ waves: 1, wave: 1, bossHp: 0.42 }), won)).toBe(
      'Without you, the party falls at 0:41, with the boss at 42%.',
    );
    expect(withoutYouLine(alone({ outcome: 'victory', duration: 150, downs: 2 }), won)).toBe(
      'Without you, they still win, but it takes 2:30 (0:55 longer), with 2 heroes going down along the way.',
    );
    expect(withoutYouLine(alone({ outcome: 'timeout', duration: 600, standing: 1 }), won)).toMatch(
      /still going at 10:00 in wave 2 of 3: 1 still standing/,
    );
  });

  it('tallies a run', () => {
    const r = (w: WithoutYou | null) => ({ withoutYou: w }) as EncounterResult;
    const t = withoutYouTally([
      r(alone({})),
      r(alone({ outcome: 'victory' })),
      r(alone({ outcome: 'timeout' })),
      r(null),
      r(alone({})),
    ]);
    expect(t).toEqual({ fights: 4, fell: 2, stalled: 1, won: 1 });
    expect(tallyLine(t)).toBe(
      'Without you, the party would have fallen in 2 of 4 fights, and been stuck in 1 more.',
    );
    expect(tallyLine(withoutYouTally([r(null)]))).toBe('');
  });

  it('knows when you made the difference', () => {
    const run = resultRun(true, 0, 'defeat');
    expect(madeTheDifference(run.lastResult!)).toBe(true);
    const easy = resultRun(true, 0, 'victory');
    expect(madeTheDifference(easy.lastResult!)).toBe(false);
    expect(resultRun(true, 0, null).lastResult!.withoutYou).toBeNull();
  });

  it('result stat lines mention calls answered and Fermata holds', () => {
    const r = resultRun(true).lastResult!;
    const text = statLines(r).map((l) => l.text);
    expect(text.some((t) => /Answered \d+ of \d+ calls/.test(t))).toBe(true);
    expect(text.some((t) => /Fermata caught/.test(t))).toBe(true);
  });
});

describe('coach hints (Phase 2)', () => {
  const ids = (h: ReturnType<typeof mockHud>) => evaluateHints(h).map((x) => x.id);

  it('teaches an open call, and not an answered one', () => {
    const hud = mockHud('calls');
    const hints = evaluateHints(hud);
    const call = hints.find((h) => h.id === 'call');
    expect(call?.text).toMatch(/Kael is calling for a Ward/);
    hud.party.forEach((p) => {
      if (p.call) p.call.answered = true;
    });
    expect(ids(hud)).not.toContain('call');
  });

  it('a Fermata hold comes first', () => {
    const hud = mockHud('fermata');
    expect(ids(hud)[0]).toBe('hold');
  });

  it('Pedal Point planting when the party leaves the planted field', () => {
    const hud = mockHud('fermata');
    hud.weaver.plant = { remaining: 0, total: 2, key0: 'KeyV' };
    hud.party[2]!.inField = false;
    expect(evaluateHints(hud).find((h) => h.id === 'plant')?.text).toMatch(/\{V\}/);
  });

  it('the Directive wheel when the party is spread out', () => {
    const hud = mockHud('calm');
    hud.party.forEach((p) => (p.inField = false));
    expect(ids(hud)).toContain('wheel');
  });
});

describe('UI scale', () => {
  it('honours scaling down, and caps scaling up at what the window can fit', async () => {
    const { fittedScale } = await import('../src/ui/presentation');
    expect(fittedScale(0.8, 1280)).toBe(0.8);
    expect(fittedScale(1, 1280)).toBe(1);
    expect(fittedScale(1.25, 1280)).toBe(1);
    expect(fittedScale(1.25, 1920)).toBe(1.25);
    expect(fittedScale(1.5, 1600)).toBeCloseTo(1.25, 9);
    expect(fittedScale(9, 4000)).toBe(1.5);
    expect(fittedScale(Number.NaN, 1280)).toBe(1);
  });
});
