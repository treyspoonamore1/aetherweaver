/**
 * Phase 4g: the Loom (docs/phase-4g.md). Starlight from fights, wins and Deeds; Calling mastery
 * and the path tiers it opens; the Atelier's items, buying and wearing them; the stores; saves;
 * and the Perfect-Ward trainer's drill.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { useProfile } from '../src/app/profileStore';
import { useRun } from '../src/app/runStore';
import { useSettings } from '../src/app/settings';
import { CONTENT } from '../src/content';
import {
  buy,
  equip,
  masteryLevel,
  runStarlight,
  shopItems,
  starlightForDeeds,
  starlightForFight,
  tiersOpen,
  type LoomState,
} from '../src/meta/loom';
import { PROFILE_VERSION, RANK_XP, newProfile } from '../src/meta/profile';
import * as Run from '../src/meta/run';
import { loadProfile, type KeyValueStore } from '../src/meta/save';
import { ofType, sandbox, stepFor, stepUntil, worldOf } from './sim/helpers';

function memoryStore(): KeyValueStore {
  const data = new Map<string, string>();
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

const S = CONTENT.starlight;
const M = CONTENT.mastery;
const skipUnlocks = (on: boolean) =>
  useSettings.getState().update((s) => ({ ...s, unlockAll: on }));
const profile = () => useProfile.getState().profile;
const run = () => useRun.getState().run!;
const loom = (over: Partial<LoomState> = {}): LoomState => ({
  starlight: 0,
  cosmetics: [],
  look: { robe: null, thread: null, title: null },
  mastery: {},
  variants: [],
  deeds: [],
  ...over,
});

beforeEach(() => {
  useSettings.getState().reset();
  useProfile.getState().resetProgress();
  useRun.getState().closeRun();
});

describe('Starlight', () => {
  it('a won fight pays by its kind, the run-winning one its bonus too; a loss pays nothing', () => {
    expect(starlightForFight({ kind: 'skirmish', outcome: 'victory' }, false)).toBe(
      S.fights.skirmish,
    );
    expect(starlightForFight({ kind: 'boss', outcome: 'victory' }, true)).toBe(
      S.fights.boss + S.winBonus,
    );
    expect(starlightForFight({ kind: 'elite', outcome: 'defeat' }, false)).toBe(0);
    expect(starlightForFight({ kind: 'sandbox', outcome: 'victory' }, false)).toBe(0);
    expect(starlightForFight({ kind: 'elite', outcome: 'victory' }, false, 1.5)).toBe(
      Math.round(S.fights.elite * 1.5),
    );
  });

  it('Deeds pay by their place on the ladder; badges their own', () => {
    const ladder = CONTENT.deeds.filter((d) => d.points === 1);
    const badge = CONTENT.deeds.find((d) => d.points === 0)!;
    expect(starlightForDeeds([ladder[0]!.id])).toBe(S.deedLadder[0]);
    expect(starlightForDeeds([ladder.at(-1)!.id, badge.id])).toBe(
      S.deedLadder[ladder.length - 1]! + S.deedBadge,
    );
    expect(starlightForDeeds(['nope'])).toBe(0);
  });

  it('a run’s Starlight: its fights’ and its newly earned Deeds’', () => {
    const deed = CONTENT.deeds.find((d) => d.points === 1)!.id;
    const total = runStarlight({
      results: [{ starlight: 3 }, { starlight: 6 }, {}] as never,
      deeds: [deed],
    });
    expect(total).toEqual({ fights: 9, deeds: S.deedLadder[0], total: 9 + S.deedLadder[0]! });
  });
});

describe('Calling mastery', () => {
  it('levels by mastery XP; tiers open with them; every tier with Skip the unlocks', () => {
    expect(masteryLevel(0)).toBe(1);
    expect(masteryLevel(M.levels[1]!)).toBe(2);
    expect(masteryLevel(M.levels[4]! + 1e6)).toBe(5);
    expect(tiersOpen('luminary', 0, false)).toBe(1);
    expect(tiersOpen('luminary', M.levels[2]!, false)).toBe(3);
    expect(tiersOpen('luminary', 1e6, false)).toBe(4);
    expect(tiersOpen('luminary', 0, true)).toBe(4);
  });

  it('a run offers only the tiers its mastery opened at embark', () => {
    const r = Run.newRun(81);
    const withCalling = { ...r, calling: { id: 'luminary', path: [null, null, null, null] } };
    const opened = Run.setCallingTiers(withCalling, 1);
    expect(opened.calling!.tiersOpen).toBe(1);
    // Tier I's milestone row still offers; tier II's offers nothing.
    const due = (row: number) =>
      Run.callingTierDue(opened, { row, kind: 'skirmish', encounterId: 'first_light' });
    const [first, second] = Run.CALLING_ROWS;
    expect(due(first!)?.tier).toBe(0);
    expect(due(second!)).toBeNull();
    // A run from before mastery offers every tier.
    expect(
      Run.callingTierDue(withCalling, {
        row: second!,
        kind: 'skirmish',
        encounterId: 'first_light',
      })?.tier,
    ).toBe(1);
  });

  it('the Calling rows read the run’s road: a caller must hand over its movements', () => {
    // docs/phase-5d.md contract 6: `callingRows` and `callingTierDue` require `movements`
    // (a Finale route plays Movement I's road with rows of its own), so tsc flags any caller
    // that drops it. The `@ts-expect-error`s fail the typecheck if the field turns optional.
    const node = {
      row: Run.CALLING_ROWS[0]!,
      kind: 'skirmish' as const,
      encounterId: 'first_light',
    };
    const calling = { id: 'luminary', path: [null, null, null, null] };
    expect(Run.callingRows({ movements: 3 })).toEqual(Run.CALLING_ROWS);
    expect(Run.callingTierDue({ calling, movements: 3 }, node)?.tier).toBe(0);
    // @ts-expect-error movements is required
    expect(Run.callingRows({})).toEqual(Run.CALLING_ROWS);
    // @ts-expect-error movements is required
    expect(Run.callingTierDue({ calling }, node)?.tier).toBe(0);
  });
});

describe('the Atelier', () => {
  it('closed until its Rank; variants for sale, three by mastery; keepsakes; titles earned', () => {
    const closed = shopItems(loom(), S.atelierRank - 1, false);
    expect(closed.every((i) => i.state === 'locked' || i.state === 'earned')).toBe(true);
    const open = shopItems(loom(), S.atelierRank, false);
    const variants = open.filter((i) => i.kind === 'variant');
    expect(variants.filter((i) => i.state === 'buyable')).toHaveLength(
      CONTENT.techniqueVariants.length - M.callings.length,
    );
    for (const m of M.callings)
      expect(variants.find((i) => i.id === m.variant)!.state).toBe('locked');
    const mastered = shopItems(loom({ mastery: { luminary: M.levels[4]! } }), S.atelierRank, false);
    expect(mastered.find((i) => i.id === 'chorale')!.state).toBe('buyable');
    expect(mastered.find((i) => i.id === 'title_lightbearer')!.state).toBe('earned');
    // Skip the unlocks opens every variant to play, not to own; keepsakes are still bought.
    const all = shopItems(loom(), 1, true);
    expect(all.filter((i) => i.kind === 'variant').every((i) => i.state === 'open')).toBe(true);
    expect(all.find((i) => i.kind === 'robe')!.state).toBe('buyable');
  });

  it('buying needs the Starlight and takes it; wearing needs owning (or a title earned)', () => {
    const robe = CONTENT.cosmetics.robes[0]!;
    expect(buy(loom({ starlight: robe.price - 1 }), robe.id, 9, false)).toEqual({
      refused: 'Not enough Starlight.',
    });
    const bought = buy(loom({ starlight: robe.price + 5 }), robe.id, 9, false);
    if (!('state' in bought)) throw new Error('bought');
    expect(bought.state.starlight).toBe(5);
    expect(bought.state.cosmetics).toEqual([robe.id]);
    expect(equip(bought.state, 'robe', robe.id).robe).toBe(robe.id);
    expect(equip(loom(), 'robe', robe.id).robe).toBeNull();
    const variant = buy(loom({ starlight: S.variantPrice }), 'swap', S.atelierRank, false);
    if (!('state' in variant)) throw new Error('bought');
    expect(variant.state.variants).toEqual(['swap']);
    const earned = loom({ mastery: { martyr: M.levels[4]! } });
    expect(equip(earned, 'title', 'title_unbroken').title).toBe('title_unbroken');
    // What's yours isn't sold again.
    expect(buy(variant.state, 'swap', S.atelierRank, false)).toEqual({ refused: 'Already yours.' });
  });

  it('Skip the unlocks opens variants to play, never to own past their gates', () => {
    const rich = loom({ starlight: 1000 });
    // Below the Atelier's Rank, or before a Calling's top mastery, a variant isn't sold.
    expect('refused' in buy(rich, 'swap', S.atelierRank - 1, true)).toBe(true);
    expect('refused' in buy(rich, 'chorale', S.atelierRank, true)).toBe(true);
    // Where it would be sold anyway, it is.
    expect('state' in buy(rich, 'swap', S.atelierRank, true)).toBe(true);
    // Keepsakes add no power: Skip sells them as the Atelier shows them.
    expect('state' in buy(rich, CONTENT.cosmetics.robes[0]!.id, 1, true)).toBe(true);
  });
});

/** The run's pending fight, ended with this outcome and everyone standing. */
function outcomeOf(outcome: 'victory' | 'defeat') {
  return {
    encounterId: useRun.getState().combatConfig()!.encounter!,
    outcome,
    duration: 40,
    ledger: worldOf(sandbox()).ledger,
    party: run().party.map((h, slot) => ({
      slot,
      heroId: h.heroId,
      hp: 100,
      maxHp: 100,
      downed: false,
      dead: false,
      damage: 0,
      amplified: 0,
    })),
    withoutYou: null,
  };
}

describe('the stores', () => {
  it('a lost fight pays no Starlight but still masters; a fight pays once', () => {
    skipUnlocks(true);
    useRun.getState().newRun(84);
    useRun.getState().setCalling('martyr');
    useRun.getState().embark();
    useRun.getState().chooseNode(Run.reachable(run())[0]!.id);
    const lost = outcomeOf('defeat');
    useRun.getState().finishCombat(lost);
    expect(run().lastResult!.starlight).toBe(0);
    expect(profile().starlight).toBe(0);
    const mastery = profile().mastery.martyr!;
    expect(mastery).toBe(run().lastResult!.xp);
    expect(mastery).toBeGreaterThan(0);
    // The same fight's end, reported again, pays nothing more.
    useRun.getState().finishCombat(lost);
    expect(profile().mastery.martyr).toBe(mastery);
  });

  it('newly earned Deeds pay their Starlight as they’re recorded, once', () => {
    useRun.getState().newRun(85);
    const won = { ...run(), outcome: 'victory' as const };
    const earned = useProfile.getState().recordDeeds(won);
    expect(earned).toContain('through_the_prelude');
    expect(profile().starlight).toBe(starlightForDeeds(earned));
    useProfile.getState().recordDeeds(won);
    expect(profile().starlight).toBe(starlightForDeeds(earned));
  });

  it('a fight pays Starlight and the Calling’s mastery with its Weaver XP', () => {
    skipUnlocks(true);
    useRun.getState().newRun(82);
    useRun.getState().setCalling('luminary');
    useRun.getState().embark();
    expect(run().calling!.tiersOpen).toBe(4);
    useRun.getState().chooseNode(Run.reachable(run())[0]!.id);
    const encounter = useRun.getState().combatConfig()!.encounter!;
    useRun.getState().finishCombat({
      encounterId: encounter,
      outcome: 'victory',
      duration: 40,
      ledger: worldOf(sandbox()).ledger,
      party: run().party.map((h, slot) => ({
        slot,
        heroId: h.heroId,
        hp: 100,
        maxHp: 100,
        downed: false,
        dead: false,
        damage: 0,
        amplified: 0,
      })),
      withoutYou: null,
    });
    expect(profile().starlight).toBe(run().lastResult!.starlight);
    expect(profile().starlight).toBeGreaterThan(0);
    expect(profile().mastery.luminary).toBe(run().lastResult!.xp);
  });

  it('without mastery, a run embarks with tier I alone', () => {
    useProfile.getState().award(RANK_XP[11]!);
    useRun.getState().newRun(83);
    useRun.getState().setCalling('luminary');
    useRun.getState().embark();
    expect(run().calling?.tiersOpen).toBe(1);
  });

  it('the Atelier sells through the store, and refuses without the Starlight', () => {
    useProfile.getState().award(RANK_XP[S.atelierRank - 1]!);
    expect(useProfile.getState().buy('purge')).toBe('Not enough Starlight.');
    useProfile.getState().awardStarlight(S.variantPrice);
    expect(useProfile.getState().buy('purge')).toBeNull();
    expect(profile().variants).toContain('purge');
    expect(profile().starlight).toBe(0);
  });
});

describe('saves', () => {
  it('a v7 profile migrates; unknown or broken keepsakes, looks and Callings are forgotten', () => {
    const {
      starlight: _s,
      cosmetics: _c,
      look: _l,
      mastery: _m,
      ...v7
    } = {
      ...newProfile(),
      version: 7,
    };
    const store = memoryStore();
    store.setItem('aetherweaver.profile', JSON.stringify(v7));
    const loaded = loadProfile(store);
    expect(loaded.version).toBe(PROFILE_VERSION);
    expect(loaded.starlight).toBe(0);
    // Deeds earned before Starlight existed pay theirs as the save is brought up to date.
    const ladder = CONTENT.deeds.filter((d) => d.points === 1).map((d) => d.id);
    store.setItem('aetherweaver.profile', JSON.stringify({ ...v7, deeds: ladder.slice(0, 2) }));
    expect(loadProfile(store).starlight).toBe(starlightForDeeds(ladder.slice(0, 2)));
    const robe = CONTENT.cosmetics.robes[0]!.id;
    store.setItem(
      'aetherweaver.profile',
      JSON.stringify({
        ...newProfile(),
        starlight: 12.7,
        // A bad entry is dropped, not what else was bought.
        cosmetics: [robe, 'gone', 7, robe],
        variants: ['purge', null, 'swap', 'gone'],
        look: { robe, thread: 'gone', title: 'title_lightbearer' },
        mastery: { luminary: 30, nobody: 99, martyr: 'x' },
      }),
    );
    const fitted = loadProfile(store);
    expect(fitted.starlight).toBe(12);
    expect(fitted.cosmetics).toEqual([robe]);
    expect(fitted.variants).toEqual(['purge', 'swap']);
    // The title isn't earned yet: not worn.
    expect(fitted.look).toEqual({ robe, thread: null, title: null });
    expect(fitted.mastery).toEqual({ luminary: 30 });
  });
});

describe('the Perfect-Ward trainer', () => {
  it('a drill telegraphs a blow at a hero; Warded in time it’s Perfect, unanswered it bites', () => {
    const sim = sandbox();
    const w = worldOf(sim);
    const kael = w.entities.get(w.party[0]!)!;
    // The party stands up on the first tick.
    stepFor(sim, 2);
    let events = stepFor(sim, 1, [{ t: 'debug', op: { op: 'drill', slot: 0, windup: 1 } }]);
    const started = ofType(events, 'telegraphStarted')[0]!;
    expect(started.target).toBe(kael.id);
    stepUntil(sim, () => sim.state.time >= started.perfectFrom + 0.05);
    stepFor(sim, 1, [{ t: 'tech', id: 'ward', slot: 0 }]);
    events = stepUntil(sim, (ev) => ev.some((e) => e.type === 'telegraphEnded'), 200);
    expect(ofType(events, 'telegraphResolved')[0]!.outcome).toBe('perfect');
    // Unanswered: a quarter of their life.
    const before = kael.health!.hp;
    stepFor(sim, 1, [{ t: 'debug', op: { op: 'drill', slot: 0, windup: 1 } }]);
    events = stepUntil(sim, (ev) => ev.some((e) => e.type === 'telegraphEnded'), 200);
    expect(ofType(events, 'telegraphResolved')[0]!.outcome).toBe('hit');
    expect(before - kael.health!.hp).toBeGreaterThan(0);
  });

  it('each try starts even: the hero whole, the Ward ready, on a beat quicker than its recharge', () => {
    const sim = sandbox();
    const w = worldOf(sim);
    const kael = w.entities.get(w.party[0]!)!;
    stepFor(sim, 2);
    for (let i = 0; i < 3; i++) {
      kael.health!.hp = kael.health!.maxHp * 0.5;
      let events = stepFor(sim, 1, [{ t: 'debug', op: { op: 'drill', slot: 0, windup: 0.8 } }]);
      expect(kael.health!.hp).toBe(kael.health!.maxHp);
      const started = ofType(events, 'telegraphStarted')[0]!;
      stepUntil(sim, () => sim.state.time >= started.perfectFrom + 0.05);
      stepFor(sim, 1, [{ t: 'tech', id: 'ward', slot: 0 }]);
      events = stepUntil(sim, (ev) => ev.some((e) => e.type === 'telegraphEnded'), 200);
      expect(ofType(events, 'telegraphResolved')[0]!.outcome).toBe('perfect');
    }
  });
});
