/**
 * Brann's pure rules (docs/phase-5b.md, "Passive: Blood Rage", ground rule 7): the read-only
 * helpers the sim, the bots, render and the UI share, and `partyHasDome`. They are checked on a
 * stand-in Blood Rage def built from Kael (so they don't lean on Brann's tuned numbers), and on
 * the real content's starters, for whom every one is neutral.
 */
import { describe, expect, it } from 'vitest';
import { CONTENT, partyHasDome } from '../../src/content';
import type { Content, HeroDef } from '../../src/content/schema';
import {
  bloodRageBonus,
  bloodlusting,
  deathlessActive,
  fallingFast,
  isWeaverVia,
  newBlood,
  weaverHealCut,
  type ReadonlyEntity,
} from '../../src/sim';
import type { HealVia } from '../../src/sim/combat/health';
import type { BloodState, ShieldKind } from '../../src/sim/state';

const kael = CONTENT.heroes.find((h) => h.id === 'kael')!;
/** A Blood Rage hero with Brann's rules (and round numbers). */
const RAGER: HeroDef = {
  ...kael,
  id: 'rager',
  maxHp: 1000,
  quirk: { ...kael.quirk, id: 'bloodlust', below: 0.4 },
  passive: { id: 'bloodRage', perMissing: 1, maxBonus: 0.8, lifesteal: 0.08, weaverHealMult: 0.5 },
};
const talent = (id: string, values: Record<string, number>) => ({
  id,
  name: id,
  hero: 'rager',
  tier: 1 as const,
  text: '',
  values,
});
const content = {
  heroes: [...CONTENT.heroes, RAGER],
  talents: [
    ...CONTENT.talents,
    talent('iron_will', { pct: 40 }),
    talent('red_mist', { max: 100 }),
    talent('blood_oath', { cap: 25 }),
  ],
} as unknown as Pick<Content, 'heroes' | 'talents'>;

interface Opts {
  hp: number;
  maxHp?: number;
  talents?: string[];
  shields?: ShieldKind[];
  blood?: Partial<BloodState> | null;
  downed?: boolean;
  dead?: boolean;
}

function entity(defId: string, o: Opts): ReadonlyEntity {
  const maxHp = o.maxHp ?? 1000;
  return {
    hero: {
      defId,
      talents: o.talents ?? [],
      ...(o.blood === null ? {} : { blood: { ...newBlood(), ...o.blood } }),
    },
    health: {
      hp: o.hp,
      maxHp,
      downed: o.downed ?? false,
      dead: o.dead ?? false,
      shields: (o.shields ?? []).map((kind) => ({ kind, amount: 100, max: 100 })),
    },
  } as unknown as ReadonlyEntity;
}

const VIAS: HealVia[] = [
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

describe("Brann's pure rules (docs/phase-5b.md)", () => {
  it('a fresh BloodState: everything 0, and no peak until he first falls low', () => {
    const b = newBlood();
    expect(b.peakAfterLow).toBe(-1);
    for (const [k, v] of Object.entries(b)) if (k !== 'peakAfterLow') expect(v, k).toBe(0);
    expect(newBlood()).not.toBe(b);
  });

  it("the Weaver's vias are Mend, the Chime, the auras, Rewind and other", () => {
    expect(VIAS.filter(isWeaverVia)).toEqual(['mend', 'chime', 'aura', 'rewind', 'other']);
  });

  it('the heal cut: ×0.5 by Weaver via only; Blood Oath lifts it; starters never cut', () => {
    const brann = entity('rager', { hp: 300 });
    for (const via of VIAS)
      expect(weaverHealCut(content, brann, via), via).toBe(isWeaverVia(via) ? 0.5 : 1);
    const sworn = entity('rager', { hp: 300, talents: ['blood_oath'] });
    for (const via of VIAS) expect(weaverHealCut(content, sworn, via), via).toBe(1);
    for (const id of CONTENT.defaultParty)
      for (const via of VIAS)
        expect(weaverHealCut(content, entity(id, { hp: 1, blood: null }), via)).toBe(1);
  });

  it('Blood Rage: +perMissing × missing life, capped at 80%, or 100% with Red Mist', () => {
    expect(bloodRageBonus(content, entity('rager', { hp: 1000 }))).toBe(0);
    expect(bloodRageBonus(content, entity('rager', { hp: 400 }))).toBeCloseTo(0.6, 12);
    expect(bloodRageBonus(content, entity('rager', { hp: 100 }))).toBe(0.8);
    const mist = (hp: number) =>
      bloodRageBonus(content, entity('rager', { hp, talents: ['red_mist'] }));
    expect(mist(400)).toBeCloseTo(0.6, 12);
    expect(mist(150)).toBeCloseTo(0.85, 12);
    expect(mist(0)).toBe(1);
    // Overhealed above max (never in play) gives no negative bonus.
    expect(bloodRageBonus(content, entity('rager', { hp: 1100 }))).toBe(0);
    for (const id of CONTENT.defaultParty)
      expect(bloodRageBonus(content, entity(id, { hp: 1, blood: null }))).toBe(0);
  });

  it('Bloodlust: below 40% with blood, unless Iron Will and a Ward hold him', () => {
    expect(bloodlusting(content, entity('rager', { hp: 401 }))).toBe(false);
    expect(bloodlusting(content, entity('rager', { hp: 400 }))).toBe(false);
    expect(bloodlusting(content, entity('rager', { hp: 399 }))).toBe(true);
    expect(bloodlusting(content, entity('rager', { hp: 399, blood: null }))).toBe(false);
    // Iron Will needs a Ward: a barrier or a dome won't do.
    const will = (shields: ShieldKind[]) =>
      bloodlusting(content, entity('rager', { hp: 200, talents: ['iron_will'], shields }));
    expect(will([])).toBe(true);
    expect(will(['barrier', 'dome'])).toBe(true);
    expect(will(['ward'])).toBe(false);
    // A Ward without Iron Will changes nothing.
    expect(bloodlusting(content, entity('rager', { hp: 200, shields: ['ward'] }))).toBe(true);
    for (const id of CONTENT.defaultParty)
      expect(bloodlusting(content, entity(id, { hp: 1, blood: null }))).toBe(false);
  });

  it('a downed or dead Blood Rage hero has no rage and no Bloodlust', () => {
    // At 0 life the formula alone would say +80% and bloodlusting: the bots' Rally limits and
    // the HUD's Bloodlust chip would keep reading a hero who lies downed.
    for (const fallen of [{ downed: true }, { dead: true }, { downed: true, dead: true }]) {
      const e = entity('rager', { hp: 0, ...fallen });
      expect(bloodRageBonus(content, e)).toBe(0);
      expect(bloodlusting(content, e)).toBe(false);
      const mist = entity('rager', { hp: 0, talents: ['red_mist'], ...fallen });
      expect(bloodRageBonus(content, mist)).toBe(0);
    }
    // Standing at the same 0 life (the frame before he goes down) he still has both.
    expect(bloodRageBonus(content, entity('rager', { hp: 0 }))).toBe(0.8);
    expect(bloodlusting(content, entity('rager', { hp: 0 }))).toBe(true);
    // The content's Brann too.
    const brann = entity('brann', { hp: 0, maxHp: 1250, downed: true });
    expect(bloodRageBonus(CONTENT, brann)).toBe(0);
    expect(bloodlusting(CONTENT, brann)).toBe(false);
  });

  it('falling fast: twice the bleed rate reaches his life; never without blood or once down', () => {
    expect(fallingFast(entity('rager', { hp: 300, blood: { bleedRate: 149 } }))).toBe(false);
    expect(fallingFast(entity('rager', { hp: 300, blood: { bleedRate: 150 } }))).toBe(true);
    expect(fallingFast(entity('rager', { hp: 300, blood: { bleedRate: 0 } }))).toBe(false);
    expect(fallingFast(entity('rager', { hp: 0, blood: { bleedRate: 0 } }))).toBe(false);
    expect(fallingFast(entity('rager', { hp: 0, downed: true, blood: { bleedRate: 500 } }))).toBe(
      false,
    );
    expect(fallingFast(entity('kael', { hp: 1, blood: null }))).toBe(false);
  });

  it('Deathless is active only inside its window', () => {
    const at = (deathlessUntil: number, time: number) =>
      deathlessActive({ time }, entity('rager', { hp: 1, blood: { deathlessUntil } }));
    expect(at(0, 0)).toBe(false);
    expect(at(13, 10)).toBe(true);
    expect(at(13, 13)).toBe(false);
    expect(deathlessActive({ time: 1 }, entity('kael', { hp: 1, blood: null }))).toBe(false);
  });

  it("the content's Brann plays by the same rules", () => {
    const brann = (o: Opts) => entity('brann', { maxHp: 1250, ...o });
    expect(weaverHealCut(CONTENT, brann({ hp: 600 }), 'mend')).toBe(0.5);
    expect(weaverHealCut(CONTENT, brann({ hp: 600 }), 'revive')).toBe(1);
    expect(bloodRageBonus(CONTENT, brann({ hp: 500 }))).toBeCloseTo(0.6, 12);
    expect(bloodRageBonus(CONTENT, brann({ hp: 0, talents: ['red_mist'] }))).toBe(1);
    expect(bloodlusting(CONTENT, brann({ hp: 499 }))).toBe(true);
    expect(
      bloodlusting(CONTENT, brann({ hp: 499, talents: ['iron_will'], shields: ['ward'] })),
    ).toBe(false);
    expect(weaverHealCut(CONTENT, brann({ hp: 600, talents: ['blood_oath'] }), 'mend')).toBe(1);
  });

  it('partyHasDome: a party with Kael (Aegis Wall) has one; any other does not', () => {
    expect(partyHasDome(CONTENT.defaultParty)).toBe(true);
    expect(partyHasDome(['kael'])).toBe(true);
    expect(partyHasDome(['lyra', 'vexis'])).toBe(false);
    expect(partyHasDome([])).toBe(false);
    expect(partyHasDome(['nobody'])).toBe(false);
  });
});
