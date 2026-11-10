/**
 * The Atlas of Echoes (docs/phase-6.md, "Design: the Atlas of Echoes", W3, and the Echoes entry of
 * "Tests"): the nine Echoes and three constellations as content, each Echo's map from its legs,
 * the stars for a clear, 10 and 20 (forced levels ignored), rewards given once, constellation and
 * Atlas keepsakes, and that the Atelier never sells an earned look.
 */
import { describe, expect, it } from 'vitest';
import { CONTENT, encounterDef, type EchoDef } from '../../src/content';
import { ECHO_STARS } from '../../src/content/echoes';
import {
  atlasComplete,
  atlasKeepsakes,
  atlasTotals,
  bestCleared,
  completeConstellations,
  constellationComplete,
  constellationStars,
  echoDef,
  echoRoute,
  recordStars,
  starPoints,
  starRewards,
  starRewardTexts,
  starRules,
  starsFor,
  starsLine,
  starsLit,
} from '../../src/meta/atlas';
import type { DissonanceChoice } from '../../src/meta/dissonance';
import {
  buy,
  earnedLooks,
  earnedTitles,
  equip,
  fitCosmetics,
  noLook,
  shopItems,
  type LoomState,
} from '../../src/meta/loom';
import type { ProfileAtlas } from '../../src/meta/profile';
import { generateMapFrom, isFinalNode } from '../../src/meta/run';
import type { MapNode, RunState } from '../../src/meta/types';

const FIGHTS = new Set(['skirmish', 'elite', 'miniboss', 'boss']);
const SEEDS = 200;

/** A finished run's facts, as `starsFor` and `recordStars` read them. */
function ran(
  echo: string | undefined,
  dissonance: DissonanceChoice[] = [],
  outcome: RunState['outcome'] = 'victory',
): Pick<RunState, 'echo' | 'outcome' | 'dissonance'> {
  return { ...(echo === undefined ? {} : { echo }), outcome, dissonance };
}

/** Levels worth exactly `points` (Hardened 3 a rank, Elite Vanguard 5, Brisk Foes 1, …). */
function levelsWorth(points: number): DissonanceChoice[] {
  const out: DissonanceChoice[] = [];
  let left = points;
  for (const d of [...CONTENT.dissonance].sort((a, b) => b.points - a.points))
    for (let r = d.ranks; r >= 1; r--)
      if (d.points * r <= left && !out.some((l) => l.id === d.id)) {
        out.push({ id: d.id, rank: r });
        left -= d.points * r;
      }
  if (left !== 0) throw new Error(`no levels worth ${points}`);
  return out;
}

/** An Atlas with every star of these Echoes lit. */
function litAll(echoes: readonly EchoDef[], from: ProfileAtlas = { stars: {}, best: {} }) {
  const stars = { ...from.stars };
  for (const e of echoes) stars[e.id] = ECHO_STARS.length;
  return { stars, best: { ...from.best } };
}

function loom(over: Partial<LoomState> = {}): LoomState {
  return {
    starlight: 0,
    cosmetics: [],
    look: noLook(),
    mastery: {},
    variants: [],
    deeds: [],
    ...over,
  };
}

describe('the Echoes and constellations as content', () => {
  it('nine Echoes in three constellations of three, each rewarding a keepsake earned by it', () => {
    expect(CONTENT.echoes).toHaveLength(9);
    expect(CONTENT.constellations).toHaveLength(3);
    const c = CONTENT.cosmetics;
    const keepsakes = [...c.robes, ...c.threads, ...c.titles];
    for (const k of CONTENT.constellations) {
      expect(
        CONTENT.echoes.filter((e) => e.constellation === k.id),
        k.id,
      ).toHaveLength(3);
      const reward = keepsakes.find((x) => x.id === k.reward);
      expect(reward?.earned, k.id).toEqual({ constellation: k.id });
    }
    // One of each kind: a robe, a Thread look, a title; and the Atlas's own title.
    expect(CONTENT.constellations.map((k) => k.reward)).toEqual([
      'robe_crownless',
      'thread_wayward',
      'title_hard_bargainer',
    ]);
    const whole = keepsakes.filter((x) => x.earned && 'atlas' in x.earned);
    expect(whole.map((x) => x.id)).toEqual(['title_atlas_walker']);
  });

  it('keepsakes are appended: the existing ones keep their place and order', () => {
    const c = CONTENT.cosmetics;
    expect(c.robes.map((r) => r.id)).toEqual([
      'robe_dusk',
      'robe_ember',
      'robe_tide',
      'robe_bone',
      'robe_crownless',
    ]);
    expect(c.threads.map((t) => t.id)).toEqual([
      'thread_silver',
      'thread_rose',
      'thread_starlit',
      'thread_wayward',
    ]);
    expect(c.titles.slice(0, 7).map((t) => t.id)).toEqual([
      'title_steady_hand',
      'title_quiet_bell',
      'title_threadbare',
      'title_lightbearer',
      'title_unbroken',
      'title_keeper',
      'title_flawless',
    ]);
    // An earned look's price (the schema wants one) sits inside the sold looks' range, so the
    // Atelier's "60–90" stays true; nothing charges it.
    const sold = [...c.robes, ...c.threads].filter((k) => !k.earned).map((k) => k.price);
    for (const k of [...c.robes, ...c.threads].filter((x) => x.earned)) {
      expect(k.price).toBeGreaterThanOrEqual(Math.min(...sold));
      expect(k.price).toBeLessThanOrEqual(Math.max(...sold));
    }
  });

  it('no twist touches an aura, and no Echo forces Muted Choir (decision 5)', () => {
    for (const e of CONTENT.echoes) {
      expect(
        Object.keys(e.twists).every((k) =>
          ['noCalling', 'noTree', 'noCarry', 'party', 'dissonance'].includes(k),
        ),
        e.id,
      ).toBe(true);
      for (const l of e.twists.dissonance ?? []) {
        const def = CONTENT.dissonance.find((d) => d.id === l.id)!;
        expect(def.effect, e.id).not.toBe('aura_radius');
        expect(def.id, e.id).not.toBe('muted_choir');
      }
    }
    expect(echoDef('the_unrested')!.twists.dissonance).toEqual([
      { id: 'restless_dead', rank: 1 },
      { id: 'unforgiving', rank: 1 },
    ]);
    expect(echoDef('a_cappella')!.twists).toEqual({ noCalling: true, noTree: true, noCarry: true });
    expect(echoDef('strangers')!.twists).toEqual({ party: ['brann', 'seren', 'oro'] });
  });

  it('each leg is whole: rows come with their fixed stops, a boss row last, its fights its own', () => {
    for (const e of CONTENT.echoes)
      for (const [i, leg] of e.legs.entries()) {
        const where = `${e.id} leg ${i + 1}`;
        if (leg.rows) expect(leg.fixed, where).toBeDefined();
        const { def } = echoRoute(e)[i]!;
        expect(def.rows.at(-1), where).toEqual(['boss']);
        for (const f of def.fixed) {
          const kinds = def.rows[f.row];
          expect(kinds, `${where} row ${f.row}`).toBeDefined();
          if (kinds!.every((k) => k === 'boss')) expect(f.encounter, where).toBe(leg.boss);
          if (kinds!.every((k) => k === 'miniboss') && leg.miniboss)
            expect(f.encounter, where).toBe(leg.miniboss);
        }
        if (leg.rewards)
          for (const r of leg.rewards) expect(def.rows[r.row], where).toContain('skirmish');
      }
  });

  it('Echo texts carry no copied number', () => {
    for (const e of CONTENT.echoes) expect(e.text, e.id).not.toMatch(/\d/);
  });

  it('a leg plays at its named Movement’s scale; without one, each encounter at its own', () => {
    const scales = (id: string) => echoRoute(echoDef(id)!).map((l) => l.scale);
    const m = (n: number) => CONTENT.movements[n - 1]!.scale;
    // As tuned (docs/phase-6.md, "Tuning"): Retrograde's first leg at Movement II's scale, Choir
    // of Blood's whole road at Movement II's.
    expect(scales('retrograde')).toEqual([m(2), m(2), m(3)]);
    expect(scales('bells_in_the_rift')).toEqual([m(3)]);
    expect(scales('choir_of_blood')).toEqual([m(2)]);
    // Choir of Blood: its crowns are Movement II's.
    const choir = echoDef('choir_of_blood')!.legs[0]!;
    expect(encounterDef(choir.miniboss!).movement).toBe(2);
    expect(encounterDef(choir.boss).movement).toBe(2);
    // The Seamstress's Court: its crowns are Movement III's.
    const court = echoDef('seamstress_court')!.legs[0]!;
    expect(encounterDef(court.miniboss!).movement).toBe(3);
    expect(encounterDef(court.boss).movement).toBe(3);
  });
});

describe('each Echo generates a legal map', () => {
  /** Every node id reachable from the first row. */
  function reached(rows: readonly MapNode[][]): Set<string> {
    const byId = new Map(rows.flat().map((n) => [n.id, n]));
    const seen = new Set<string>();
    const todo = [...rows[0]!.map((n) => n.id)];
    while (todo.length > 0) {
      const id = todo.pop()!;
      if (seen.has(id)) continue;
      seen.add(id);
      todo.push(...(byId.get(id)?.next ?? []));
    }
    return seen;
  }

  for (const echo of CONTENT.echoes)
    it(`${echo.id}: ${SEEDS} seeds, every fight reachable, each leg’s boss last, the Echo’s boss final`, () => {
      const route = echoRoute(echo);
      const defs = route.map((l) => l.def);
      // The route is the same objects every call (the run layer keys road rewards on them).
      expect(echoRoute(echo)).toBe(route);
      const last = echo.legs.at(-1)!.boss;
      const allowed = new Set(
        echo.legs.flatMap((leg, i) => {
          const d = defs[i]!;
          return [
            ...d.skirmishes,
            ...d.elites,
            ...(d.lessons ?? []),
            d.opening,
            d.miniboss,
            leg.boss,
            ...d.fixed.map((f) => f.encounter),
          ];
        }),
      );
      for (let seed = 1; seed <= SEEDS; seed++) {
        const map = generateMapFrom(seed * 7919, defs);
        const nodes = map.rows.flat();
        const seen = reached(map.rows);
        for (const n of nodes) {
          expect(seen.has(n.id), `${seed} ${n.id}`).toBe(true);
          if (FIGHTS.has(n.kind)) {
            expect(n.encounterId, `${seed} ${n.id}`).not.toBeNull();
            expect(() => encounterDef(n.encounterId!)).not.toThrow();
            expect(allowed.has(n.encounterId!), `${seed} ${n.id} ${n.encounterId}`).toBe(true);
          }
          if (!isFinalNode(n)) expect(n.next.length, `${seed} ${n.id}`).toBeGreaterThan(0);
        }
        // One final stop: the last row's single boss, the last leg's.
        const finals = nodes.filter(isFinalNode);
        expect(finals).toHaveLength(1);
        expect(finals[0]!.row).toBe(map.rows.length - 1);
        expect(finals[0]!.encounterId).toBe(last);
        // Each leg is its own Movement on the map, its last row its boss.
        let at = 0;
        echo.legs.forEach((leg, i) => {
          const rows = map.rows.slice(at, at + defs[i]!.rows.length);
          at += defs[i]!.rows.length;
          for (const row of rows) for (const n of row) expect(n.movement).toBe(i + 1);
          const end = rows.at(-1)!;
          expect(end.map((n) => [n.kind, n.encounterId])).toEqual([['boss', leg.boss]]);
          for (const n of rows.flat())
            if (n.kind === 'miniboss') expect(n.encounterId).toBe(defs[i]!.miniboss);
        });
        expect(at).toBe(map.rows.length);
      }
      // Seeded: the same seed draws the same map.
      expect(generateMapFrom(42, defs)).toEqual(generateMapFrom(42, defs));
    });

  it('the borrowed crowns replace the Movement’s own, wherever its content fixed them', () => {
    const fightsOf = (id: string) =>
      new Set(
        generateMapFrom(
          9,
          echoRoute(echoDef(id)!).map((l) => l.def),
        )
          .rows.flat()
          .map((n) => n.encounterId),
      );
    const bells = fightsOf('bells_in_the_rift');
    expect(bells.has('the_seamstress') || bells.has('the_unweaver')).toBe(false);
    expect(bells.has('bellwarden') && bells.has('hollow_cantor')).toBe(true);
    const court = fightsOf('seamstress_court');
    expect(court.has('gorehound_matriarch') || court.has('vharun')).toBe(false);
    const choir = fightsOf('choir_of_blood');
    expect(choir.has('bellwarden') || choir.has('hollow_cantor')).toBe(false);
    expect(choir.has('gorehound_matriarch') && choir.has('vharun')).toBe(true);
    const gilded = generateMapFrom(
      9,
      echoRoute(echoDef('gilded_road')!).map((l) => l.def),
    );
    expect(gilded.rows.flat().filter((n) => n.kind === 'skirmish')).toEqual([]);
    const rehearsal = generateMapFrom(
      9,
      echoRoute(echoDef('last_rehearsal')!).map((l) => l.def),
    );
    expect(
      rehearsal.rows
        .flat()
        .filter((n) => FIGHTS.has(n.kind))
        .map((n) => n.encounterId),
    ).toEqual(['hollow_cantor', 'vharun', 'the_unweaver', 'the_silent_conductor']);
  });

  it.todo(
    'a leg’s rewards pay on the map: the generator takes a road’s rewards only through run.ts’s own road table (ROADS, set by routeDefs), which W2 extends for Echo legs',
  );
  it.todo(
    'a leg’s scale only on its fights (absent elsewhere): combatConfig sets SimConfig.movement from the leg (W2, tests/meta/echoRun.test.ts)',
  );
});

describe('stars', () => {
  it('a clear lights one, 10 Dissonance two, 20 three; a loss or another run none', () => {
    expect(starsFor(ran('choir_of_blood'))).toBe(1);
    expect(starsFor(ran('choir_of_blood', levelsWorth(9)))).toBe(1);
    expect(starsFor(ran('choir_of_blood', levelsWorth(10)))).toBe(2);
    expect(starsFor(ran('choir_of_blood', levelsWorth(19)))).toBe(2);
    expect(starsFor(ran('choir_of_blood', levelsWorth(20)))).toBe(3);
    expect(starsFor(ran('choir_of_blood', levelsWorth(30)))).toBe(3);
    expect(starsFor(ran('choir_of_blood', levelsWorth(30), 'defeat'))).toBe(0);
    expect(starsFor(ran('choir_of_blood', [], 'abandoned'))).toBe(0);
    expect(starsFor(ran(undefined, levelsWorth(30)))).toBe(0);
    expect(starsFor(ran('no_such_echo'))).toBe(0);
  });

  it('an Echo’s forced levels count for nothing toward its stars', () => {
    const forced: DissonanceChoice[] = [
      { id: 'restless_dead', rank: 1, forced: true },
      { id: 'unforgiving', rank: 1, forced: true },
    ];
    expect(starPoints(forced)).toBe(0);
    expect(starsFor(ran('the_unrested', forced))).toBe(1);
    expect(starsFor(ran('the_unrested', [...forced, ...levelsWorth(9)]))).toBe(1);
    expect(starsFor(ran('the_unrested', [...forced, ...levelsWorth(10)]))).toBe(2);
  });

  it('rewards: each star pays once, ever; a higher star lights the lower ones', () => {
    // The doc's Summary: "Echo cleared at 12 Dissonance · two stars lit · +100 Tuning Shards".
    const first = recordStars({}, ran('choir_of_blood', levelsWorth(12)));
    expect(first.lit).toEqual([1, 2]);
    expect([first.shards, first.tears]).toEqual([ECHO_STARS[0]!.shards + ECHO_STARS[1]!.shards, 0]);
    expect(first.shards).toBe(100);
    expect(first.best).toBe(true);
    expect(first.atlas).toEqual({ stars: { choir_of_blood: 2 }, best: { choir_of_blood: 12 } });
    // The same again: nothing new, nothing paid, the Atlas as it was.
    const again = recordStars({ atlas: first.atlas }, ran('choir_of_blood', levelsWorth(12)));
    expect([again.lit, again.shards, again.tears, again.best]).toEqual([[], 0, 0, false]);
    expect(again.atlas).toBe(first.atlas);
    // A higher best with no new star: kept, unpaid.
    const higher = recordStars({ atlas: first.atlas }, ran('choir_of_blood', levelsWorth(15)));
    expect([higher.lit, higher.shards, higher.best]).toEqual([[], 0, true]);
    expect(higher.atlas!.best.choir_of_blood).toBe(15);
    // The third: its own reward, Tear and all.
    const third = recordStars({ atlas: higher.atlas }, ran('choir_of_blood', levelsWorth(20)));
    expect(third.lit).toEqual([3]);
    expect([third.shards, third.tears]).toEqual([ECHO_STARS[2]!.shards, ECHO_STARS[2]!.tears]);
    // All three at once pays all three; a lower clear later pays nothing and keeps the best.
    const all = recordStars({}, ran('retrograde', levelsWorth(25)));
    expect(all.lit).toEqual([1, 2, 3]);
    expect(all.shards).toBe(starRewards(0, 3).shards);
    expect(all.tears).toBe(starRewards(0, 3).tears);
    const lower = recordStars({ atlas: all.atlas }, ran('retrograde'));
    expect([lower.lit, lower.shards, lower.best]).toEqual([[], 0, false]);
    expect(bestCleared(lower.atlas, 'retrograde')).toBe(25);
  });

  it('a run that lights nothing leaves the Atlas absent (or as it was)', () => {
    for (const run of [
      ran(undefined, levelsWorth(20)),
      ran('choir_of_blood', [], 'defeat'),
      ran('no_such_echo'),
    ]) {
      const r = recordStars({}, run);
      expect(r.atlas).toBeUndefined();
      expect([r.lit, r.shards, r.tears, r.keepsakes]).toEqual([[], 0, 0, []]);
    }
    const a: ProfileAtlas = { stars: { strangers: 1 }, best: { strangers: 0 } };
    expect(recordStars({ atlas: a }, ran('strangers')).atlas).toBe(a);
  });

  it('a first clear at no Dissonance records a best of 0', () => {
    const r = recordStars({}, ran('gilded_road'));
    expect(r.best).toBe(true);
    expect(bestCleared(r.atlas, 'gilded_road')).toBe(0);
    expect(bestCleared(r.atlas, 'retrograde')).toBeNull();
  });

  it('stars read clamped; unknown Echoes count for nothing', () => {
    const a: ProfileAtlas = { stars: { choir_of_blood: 7, strangers: -2, gone: 3 }, best: {} };
    expect(starsLit(a, 'choir_of_blood')).toBe(3);
    expect(starsLit(a, 'strangers')).toBe(0);
    expect(atlasTotals(a)).toEqual({ lit: 3, of: 27 });
    expect(starsLine(undefined)).toBe('0 of 27 stars');
    expect(starsLine({ stars: { choir_of_blood: 3, strangers: 1 }, best: {} })).toBe(
      '4 of 27 stars',
    );
  });

  it('the star rules and rewards in words take their numbers from the rules', () => {
    expect(starRules()).toEqual([
      'Clear it',
      `Clear it at ${ECHO_STARS[1]!.points} Dissonance`,
      `Clear it at ${ECHO_STARS[2]!.points} Dissonance`,
    ]);
    expect(starRewardTexts()).toEqual([
      `${ECHO_STARS[0]!.shards} Tuning Shards`,
      `${ECHO_STARS[1]!.shards} Tuning Shards`,
      `${ECHO_STARS[2]!.shards} Tuning Shards and ${ECHO_STARS[2]!.tears} Discord Tear`,
    ]);
  });
});

const crowns = CONTENT.echoes.filter((e) => e.constellation === 'borrowed_crowns');

describe('constellations and the Atlas', () => {
  it('a constellation is complete when all nine of its stars are lit, and earns its keepsake once', () => {
    const eight: ProfileAtlas = {
      stars: { choir_of_blood: 3, bells_in_the_rift: 3, seamstress_court: 2 },
      best: {},
    };
    expect(constellationStars(eight, 'borrowed_crowns')).toEqual({ lit: 8, of: 9 });
    expect(constellationComplete(eight, 'borrowed_crowns')).toBe(false);
    const done = recordStars({ atlas: eight }, ran('seamstress_court', levelsWorth(20)));
    expect(done.constellations).toEqual(['borrowed_crowns']);
    expect(done.keepsakes).toEqual(['robe_crownless']);
    expect(done.wholeAtlas).toBe(false);
    expect(completeConstellations(done.atlas)).toEqual(['borrowed_crowns']);
    // Lit again later: nothing earned twice.
    const later = recordStars({ atlas: done.atlas }, ran('retrograde'));
    expect([later.constellations, later.keepsakes]).toEqual([[], []]);
    expect(atlasKeepsakes(later.atlas)).toEqual(['robe_crownless']);
  });

  it('every star earns the Atlas’s title, with the last constellation’s keepsake', () => {
    const almost = litAll(CONTENT.echoes);
    almost.stars.the_unrested = 2;
    expect(atlasComplete(almost)).toBe(false);
    const r = recordStars({ atlas: almost }, ran('the_unrested', levelsWorth(20)));
    expect(r.wholeAtlas).toBe(true);
    expect(r.constellations).toEqual(['hard_bargains']);
    expect(r.keepsakes).toEqual(['title_hard_bargainer', 'title_atlas_walker']);
    expect(atlasTotals(r.atlas)).toEqual({ lit: 27, of: 27 });
    expect(atlasKeepsakes(r.atlas)).toEqual([
      'robe_crownless',
      'thread_wayward',
      'title_hard_bargainer',
      'title_atlas_walker',
    ]);
    expect(atlasKeepsakes(undefined)).toEqual([]);
    expect(atlasKeepsakes(litAll(crowns))).toEqual(['robe_crownless']);
  });
});

describe('the Atelier and the Atlas’s keepsakes', () => {
  const ROBE = 'robe_crownless';
  const THREAD = 'thread_wayward';

  it('an earned look is never sold: not on the shelf until earned, refused with Starlight and Skip', () => {
    const rich = loom({ starlight: 100000 });
    for (const all of [false, true]) {
      const shop = shopItems(rich, 30, all);
      // An unearned Atlas look isn't shown (the views read a locked robe as a closed Atelier);
      // an unearned title is shown locked, with how it's earned, as the earlier titles are.
      for (const id of [ROBE, THREAD]) {
        expect(
          shop.find((i) => i.id === id),
          id,
        ).toBeUndefined();
        expect(buy(rich, id, 30, all), id).toEqual({ refused: 'unknown' });
      }
      for (const id of ['title_hard_bargainer', 'title_atlas_walker']) {
        const item = shop.find((i) => i.id === id)!;
        expect([item.state, item.price], id).toEqual(['locked', null]);
        expect(item.reason, id).toMatch(/Atlas of Echoes/);
        expect('refused' in buy(rich, id, 30, all), id).toBe(true);
      }
      expect(shop.filter((i) => i.kind === 'robe' && i.state === 'locked')).toEqual([]);
    }
    expect(shopItems(rich, 30, false).find((i) => i.id === 'title_hard_bargainer')!.reason).toBe(
      'Earned by lighting every star of Hard Bargains in the Atlas of Echoes.',
    );
    expect(shopItems(rich, 30, false).find((i) => i.id === 'title_atlas_walker')!.reason).toBe(
      'Earned by lighting every star in the Atlas of Echoes.',
    );
    // Earned: shown earned and wearable, still not bought (no Starlight taken, not kept as owned).
    const atlas = litAll(CONTENT.echoes);
    const earned = loom({ starlight: 100000, atlas });
    for (const id of [ROBE, THREAD, 'title_hard_bargainer', 'title_atlas_walker']) {
      const item = shopItems(earned, 30, false).find((i) => i.id === id)!;
      expect([item.state, item.price], id).toEqual(['earned', null]);
      expect('refused' in buy(earned, id, 30, false), id).toBe(true);
    }
    expect(shopItems(earned, 30, false).find((i) => i.id === ROBE)!.reason).toBe(
      'Earned by lighting every star of Borrowed Crowns in the Atlas of Echoes.',
    );
    expect(earnedLooks(earned)).toEqual([ROBE, THREAD]);
    expect(earnedTitles(earned)).toEqual(['title_hard_bargainer', 'title_atlas_walker']);
    expect(equip(earned, 'robe', ROBE).robe).toBe(ROBE);
    expect(equip(earned, 'thread', THREAD).thread).toBe(THREAD);
    expect(equip(earned, 'title', 'title_atlas_walker').title).toBe('title_atlas_walker');
    expect(equip(loom(), 'robe', ROBE).robe).toBeNull();
    expect(equip(loom(), 'title', 'title_hard_bargainer').title).toBeNull();
    // Only the constellation's own: Borrowed Crowns alone earns the robe.
    const one = loom({ atlas: litAll(crowns) });
    expect(earnedLooks(one)).toEqual([ROBE]);
    expect(earnedTitles(one)).toEqual([]);
    // A saved list that names an earned look drops it: it is never owned by purchase.
    expect(fitCosmetics([ROBE, THREAD, 'robe_dusk'])).toEqual(['robe_dusk']);
  });

  it('the looks on sale are sold as before', () => {
    const p = loom({ starlight: 1000 });
    const items = shopItems(p, 30, false);
    for (const r of CONTENT.cosmetics.robes.filter((x) => !x.earned)) {
      const item = items.find((i) => i.id === r.id)!;
      expect([item.state, item.price]).toEqual(['buyable', r.price]);
    }
    for (const t of CONTENT.cosmetics.threads.filter((x) => !x.earned)) {
      const item = items.find((i) => i.id === t.id)!;
      expect([item.state, item.price]).toEqual(['buyable', t.price]);
    }
    // The earlier earned titles read as they did.
    expect(items.find((i) => i.id === 'title_flawless')!.reason).toBe(
      'Earned with the Deed Flawless.',
    );
    expect(items.find((i) => i.id === 'title_lightbearer')!.reason).toBe(
      `Earned with the ${CONTENT.callings.find((c) => c.id === 'luminary')!.name}'s top mastery.`,
    );
  });
});
