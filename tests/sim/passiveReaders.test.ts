/**
 * The passive readers' equality table (docs/phase-5e.md, W0a "Characterisation first"), recorded
 * before W0b turns `HeroDef.passive` into a discriminated union and narrows these readers with
 * `bloodRageOf`. `bloodRageBonus` and `weaverHealCut` for Brann (bare, with Red Mist, with Blood
 * Oath, with both) and for each starter, on the real content, over life fractions 0-1 in 0.05
 * steps (plus downed and dead) and every HealVia, must stay equal to tests/sim/passiveReaders.json.
 *
 * Regenerate ONLY when Blood Rage's rules are meant to change:
 *   WRITE_PASSIVE_READERS=1 npx vitest run tests/sim/passiveReaders.test.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../src/content';
import { bloodRageBonus, newBlood, weaverHealCut, type ReadonlyEntity } from '../../src/sim';
import type { HealVia } from '../../src/sim/combat/health';

const PATH = fileURLToPath(new URL('./passiveReaders.json', import.meta.url));

/** Every HealVia, in the union's order (health.ts). */
const VIAS: readonly HealVia[] = [
  'mend',
  'chime',
  'aura',
  'revive',
  'solo',
  'self',
  'rewind',
  'other',
  'lifesteal',
];

/** Life fractions 0, 0.05, …, 1 (as i / 20, so each is the same double every run). */
const FRACTIONS = Array.from({ length: 21 }, (_, i) => i / 20);

interface Subject {
  name: string;
  heroId: string;
  talents: string[];
}

const SUBJECTS: readonly Subject[] = [
  { name: 'brann', heroId: 'brann', talents: [] },
  { name: 'brann+red_mist', heroId: 'brann', talents: ['red_mist'] },
  { name: 'brann+blood_oath', heroId: 'brann', talents: ['blood_oath'] },
  { name: 'brann+red_mist+blood_oath', heroId: 'brann', talents: ['red_mist', 'blood_oath'] },
  ...['kael', 'lyra', 'vexis'].map((heroId) => ({ name: heroId, heroId, talents: [] })),
];

type State = 'up' | 'downed' | 'dead';

function entity(s: Subject, fraction: number, state: State): ReadonlyEntity {
  const def = CONTENT.heroes.find((h) => h.id === s.heroId)!;
  return {
    hero: {
      defId: s.heroId,
      talents: s.talents,
      ...(def.passive ? { blood: newBlood() } : {}),
    },
    health: {
      hp: def.maxHp * fraction,
      maxHp: def.maxHp,
      downed: state === 'downed',
      dead: state === 'dead',
      shields: [],
    },
  } as unknown as ReadonlyEntity;
}

interface Row {
  /** `bloodRageBonus` at each fraction. */
  bonus: number[];
  /** `weaverHealCut` at each fraction, by via. */
  cut: Record<string, number[]>;
}

function table(): Record<string, Row> {
  const out: Record<string, Row> = {};
  for (const s of SUBJECTS)
    for (const state of ['up', 'downed', 'dead'] as const) {
      const cut: Record<string, number[]> = {};
      for (const via of VIAS)
        cut[via] = FRACTIONS.map((f) => weaverHealCut(CONTENT, entity(s, f, state), via));
      out[`${s.name}:${state}`] = {
        bonus: FRACTIONS.map((f) => bloodRageBonus(CONTENT, entity(s, f, state))),
        cut,
      };
    }
  return out;
}

describe("the passive readers' equality table (docs/phase-5e.md, W0a)", () => {
  it('bloodRageBonus and weaverHealCut equal the committed table', () => {
    const fresh = table();
    if (process.env.WRITE_PASSIVE_READERS)
      writeFileSync(PATH, JSON.stringify(fresh, null, 1) + '\n');
    const kept = JSON.parse(readFileSync(PATH, 'utf8')) as Record<string, Row>;
    expect(Object.keys(kept)).toHaveLength(SUBJECTS.length * 3);
    expect(fresh).toEqual(kept);
  });

  it('the table is not trivial: Brann rages and is cut, the starters are neutral', () => {
    const t = table();
    expect(Math.max(...t['brann:up']!.bonus)).toBeGreaterThan(0);
    expect(t['brann:up']!.cut.mend![10]).toBeLessThan(1);
    expect(t['brann+blood_oath:up']!.cut.mend!.every((c) => c === 1)).toBe(true);
    expect(Math.max(...t['brann+red_mist:up']!.bonus)).toBeGreaterThan(
      Math.max(...t['brann:up']!.bonus),
    );
    for (const id of ['kael', 'lyra', 'vexis']) {
      const row = t[`${id}:up`]!;
      expect(
        row.bonus.every((b) => b === 0),
        id,
      ).toBe(true);
      for (const via of VIAS)
        expect(
          row.cut[via]!.every((c) => c === 1),
          `${id} ${via}`,
        ).toBe(true);
    }
    expect(t['brann:downed']!.bonus.every((b) => b === 0)).toBe(true);
  });
});
