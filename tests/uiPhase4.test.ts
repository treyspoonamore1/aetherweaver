/**
 * Phase 4 UI: the Astrolabe (docs/phase-4.md, docs/phase-4/ui.md). The star map's moves are
 * meta/astrolabe.ts's through the profile store; its numbers come from content (`values`), the
 * Rank (`astrolabePoints`), the run (`Run.reservePool`, `Run.reserveMult`) and the sim
 * (`techniqueCost`, `canPay`, `WorldState.astrolabe`, `HeroComponent.afterglowUntil`).
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { COLOR_VISIONS, deltaE, simulateVision } from '../src/app/colorVision';
import { useProfile } from '../src/app/profileStore';
import { useRun } from '../src/app/runStore';
import { useSettings } from '../src/app/settings';
import { CONTENT, astrolabeNode, astrolabeText, type AstrolabeNode } from '../src/content';
import {
  ASTROLABE_RANK,
  ASTROLABE_START,
  allocate,
  astrolabePoints,
  canRefund,
  neighbours,
  pathTo,
} from '../src/meta/astrolabe';
import { EVERYTHING, MAX_RANK, RANK_XP, UNLOCKS } from '../src/meta/profile';
import * as Run from '../src/meta/run';
import {
  canPay,
  chordProblems,
  createSim,
  songReserveOf,
  techniqueCost,
  type ChordLoadout,
  type Command,
  type Sim,
} from '../src/sim';
import { dealDamage } from '../src/sim/combat/health';
import { buildHudSnapshot } from '../src/ui/hudBridge';
import { ASTROLABE_GLYPHS } from '../src/ui/kit/astrolabeGlyphs';
import { CONSTELLATIONS, CONSTELLATION_LOOK } from '../src/ui/kit/astrolabeLook';
import { PATHS } from '../src/ui/kit/iconPaths';
import {
  AFTERGLOW_TREE,
  GRACE_TREE,
  KEYSTONE_TREE,
  LIGHT_TREE,
  RANK12_TREE,
  RANK20_TREE,
  SANGUINE_TREE,
  astroCallouts,
  astroStage,
  heavierSongs,
  mockRankUps,
  type AstroScenario,
} from '../src/ui/lab/mock';
import { giveBackStar, respecStars, takeStar } from '../src/ui/screens/astrolabeActions';
import {
  MAP_BOX,
  STARS,
  STAR_RADIUS,
  bridgeOf,
  droppedStars,
  hangsOn,
  keystoneParts,
  namesLine,
  pathLinks,
  previewLine,
  previewStar,
  rankAstrolabeLine,
  spendLine,
  starAt,
  starGlyph,
  starShare,
  starState,
  starStats,
  starToward,
  takeSound,
  tipPlacement,
  treeAfterglow,
  treeBleedOutMult,
  treeLifeCap,
  treeLifeMult,
  treeTechCostMult,
  treeTechniquesCostLife,
  treeTotals,
  type StatKey,
} from '../src/ui/screens/astrolabeModel';
import {
  loadoutProblems,
  poolBlurb,
  spiritBudget,
  weaverLifeFor,
} from '../src/ui/screens/chordModel';
import { rankPanel } from '../src/ui/screens/rankText';
import { stepFor, worldOf } from './sim/helpers';

const GUARDIAN: ChordLoadout[] = [
  { auras: ['fortissimo'], ornaments: [] },
  { auras: ['sostenuto'], ornaments: [] },
];
/** Four auras, more than all of Spirit. */
const HEAVY: ChordLoadout[] = [
  { auras: ['fortissimo', 'ostinato'], ornaments: [] },
  { auras: ['sostenuto', 'allegro'], ornaments: [] },
];
/** The way to the first Economy: techniques cost less. */
const ECONOMY = pathTo([], 'aegis_b1')!;
/** Every pair of content's auras on the beam with every other pair in the field. */
const PAIRS: ChordLoadout[][] = (() => {
  const ids = CONTENT.auras.map((a) => a.id);
  const pairs = ids.flatMap((a, i) => ids.slice(i + 1).map((b) => [a, b]));
  return pairs.flatMap((beam) =>
    pairs
      .filter((field) => !field.some((id) => beam.includes(id)))
      .map((field) => [
        { auras: beam, ornaments: [] },
        { auras: field, ornaments: [] },
      ]),
  );
})();

const hud = (sim: Sim) => buildHudSnapshot(sim.state, { seed: 7, hovered: null });
function treeSim(tree: readonly string[], chords: ChordLoadout[] = GUARDIAN, calling?: string) {
  return createSim({
    seed: 7,
    encounter: 'sandbox',
    debug: true,
    chords: chords.map((c) => ({ auras: [...c.auras], ornaments: [...c.ornaments] })),
    astrolabe: [...tree],
    ...(calling ? { calling: { id: calling, path: [] } } : {}),
  });
}
const weaverOf = (sim: Sim) => worldOf(sim).entities.get(sim.state.weaverId)!;
const sum = (tree: readonly string[], f: (n: AstrolabeNode) => number) =>
  STARS.filter((n) => tree.includes(n.id)).reduce((s, n) => s + f(n), 0);

/** Every tree the tests walk: empty, partway, full, keystone-heavy, each keystone's. */
const TREES: readonly (readonly string[])[] = [
  [],
  ['silk_t1'],
  RANK12_TREE,
  RANK20_TREE,
  KEYSTONE_TREE,
  GRACE_TREE,
  SANGUINE_TREE,
  AFTERGLOW_TREE,
];

beforeEach(() => {
  useSettings.getState().reset();
  useProfile.getState().resetProgress();
  useRun.getState().closeRun();
});

describe('the star map', () => {
  it('every star sits inside the map, drawn by its kind, with a glyph for what it does', () => {
    for (const n of STARS) {
      const p = starAt(n);
      expect(Math.hypot(p.x, p.y) + STAR_RADIUS[n.kind]).toBeLessThan(MAP_BOX.rim);
      expect(p.y).toBe(-n.y);
      const glyph = starGlyph(n);
      expect(ASTROLABE_GLYPHS[glyph] ?? PATHS[glyph as keyof typeof PATHS], n.id).toBeTruthy();
    }
    // Keystones and great notables have their own glyphs.
    for (const n of STARS.filter((s) => s.kind === 'keystone' || s.kind === 'great'))
      expect(ASTROLABE_GLYPHS[starGlyph(n)], n.id).toBeTruthy();
    // The kinds are drawn from small to large.
    expect(STAR_RADIUS.travel).toBeLessThan(STAR_RADIUS.notable);
    expect(STAR_RADIUS.notable).toBeLessThan(STAR_RADIUS.great);
    expect(STAR_RADIUS.great).toBeLessThanOrEqual(STAR_RADIUS.keystone);
    // A bridge joins the two constellations its links lead to.
    for (const n of STARS.filter((s) => s.constellation === 'bridge')) {
      const pair = bridgeOf(n.id);
      expect(pair).toHaveLength(2);
      for (const c of pair)
        expect(neighbours(n.id).some((id) => astrolabeNode(id).constellation === c)).toBe(true);
    }
  });

  it('owned, touching the tree, or out of reach', () => {
    for (const tree of TREES)
      for (const n of STARS) {
        const s = starState(tree, n.id);
        if (n.id === ASTROLABE_START) expect(s).toBe('centre');
        else if (tree.includes(n.id)) expect(s).toBe('owned');
        else
          expect(s).toBe(
            neighbours(n.id).some((id) => id === ASTROLABE_START || tree.includes(id))
              ? 'takeable'
              : 'far',
          );
      }
  });

  it('arrow keys walk the map: every star can be reached from the centre', () => {
    expect(starToward(ASTROLABE_START, 0, -1)).toBe('silk_t1');
    expect(starToward(ASTROLABE_START, 1, 0)).toBe('choir_t1');
    expect(starToward(ASTROLABE_START, 0, 1)).toBe('bond_t1');
    expect(starToward(ASTROLABE_START, -1, 0)).toBe('aegis_t1');
    expect(starToward('silk_t1', 0, -1)).toBe('silk_t2');
    expect(starToward('silk_t1', 0, 1)).toBe(ASTROLABE_START);
    const seen = new Set([ASTROLABE_START]);
    const queue = [ASTROLABE_START];
    while (queue.length > 0) {
      const at = queue.shift()!;
      for (const [dx, dy] of [
        [0, -1],
        [0, 1],
        [-1, 0],
        [1, 0],
      ] as const) {
        const next = starToward(at, dx, dy);
        if (next && !seen.has(next)) {
          seen.add(next);
          queue.push(next);
        }
      }
    }
    expect(seen.size).toBe(STARS.length);
  });
});

describe('pointing at a star', () => {
  it('the path preview is `pathTo`, its cost the path’s length, take or short by the points', () => {
    for (const tree of TREES)
      for (const points of [tree.length, tree.length + 3, astrolabePoints(MAX_RANK)])
        for (const n of STARS) {
          const p = previewStar(tree, points, n.id);
          if (n.id === ASTROLABE_START) {
            expect(p.action).toBe('centre');
            continue;
          }
          if (tree.includes(n.id)) {
            expect(p.path).toEqual([]);
            expect(p.action).toBe(canRefund(tree, n.id) ? 'mine' : 'held');
            expect(p.hangs.length === 0).toBe(canRefund(tree, n.id));
            continue;
          }
          expect(p.path).toEqual(pathTo(tree, n.id));
          expect(p.cost).toBe(p.path.length);
          expect(p.action).toBe(p.cost <= points - tree.length ? 'take' : 'short');
        }
  });

  it('the path’s links run from a star you own, link by link, to the target', () => {
    for (const tree of TREES)
      for (const n of STARS) {
        const path = pathTo(tree, n.id) ?? [];
        const links = pathLinks(tree, path);
        expect(links).toHaveLength(path.length);
        if (path.length === 0) continue;
        expect([ASTROLABE_START, ...tree]).toContain(links[0]![0]);
        for (const [a, b] of links) expect(neighbours(a)).toContain(b);
        expect(links.at(-1)![1]).toBe(n.id);
      }
  });

  it('what hangs on a star is what giving it back would cut off', () => {
    expect(hangsOn(RANK12_TREE, 'silk_n1')).toEqual(['silk_b1', 'silk_b2', 'silk_bn']);
    expect(hangsOn(RANK12_TREE, 'silk_bn')).toEqual([]);
    for (const tree of TREES)
      for (const id of tree) expect(hangsOn(tree, id).length === 0).toBe(canRefund(tree, id));
  });

  it('the lines say the cost, why not, and what hangs on it', () => {
    expect(previewLine(previewStar([], 3, 'silk_n1'))).toBe(
      'Take it and the 2 on the way: 3 points.',
    );
    expect(previewLine(previewStar([], 3, 'silk_t1'))).toBe('Take it: 1 point.');
    expect(previewLine(previewStar(RANK12_TREE, 11, 'sanguine_font'))).toBe(
      `Not enough points: ${astrolabeNode('sanguine_font').name} takes 3 points, you have 2 points left.`,
    );
    expect(previewLine(previewStar(RANK12_TREE, 11, 'silk_n1'))).toMatch(
      `Yours. Something you’ve taken hangs on it: ${namesLine(hangsOn(RANK12_TREE, 'silk_n1'))}.`,
    );
    expect(previewLine(previewStar(RANK12_TREE, 11, 'choir_n1'))).toMatch(/^Yours\. Give it back/);
    // Over budget: taking waits, and the stars embarking would leave are marked.
    expect(previewLine(previewStar(RANK20_TREE, 11, 'bond_t1'))).toMatch(/give some back first/);
    const dropped = droppedStars(RANK20_TREE, 11);
    expect(dropped).toHaveLength(RANK20_TREE.length - 11);
    expect(droppedStars(RANK12_TREE, 11)).toEqual([]);
  });

  it('each take has its sound: a travel star, a notable, a path, a keystone', () => {
    expect(takeSound(['silk_t1'])).toBe('starTake');
    expect(takeSound(['choir_n1'])).toBe('starNotable');
    expect(takeSound(['bond_a4', 'second_wind'])).toBe('starPath');
    expect(takeSound(['second_wind'])).toBe('starNotable');
    expect(takeSound(pathTo(RANK20_TREE.slice(0, 8), 'prism_covenant')!)).toBe('starKeystone');
    expect(takeSound(pathTo([], 'eldritch_conduit')!)).toBe('starKeystone');
  });

  it('the tooltip goes by its star, clear of every star the preview lights, on screen', () => {
    // The map at 1280×720: 636 px square in a column 66 px wider each side; the screen reaches
    // past it to the header above, the side panel to the right and the edges (less a margin).
    const map = { w: 636, h: 636 };
    const room = { left: 66, right: 66, top: 0, bottom: 0 };
    const bounds = { left: 78, right: 550, top: 60, bottom: 8 };
    const scale = map.w / MAP_BOX.w;
    for (const h of [120, 160, 220])
      for (const tree of [[], RANK12_TREE, RANK20_TREE])
        for (const n of STARS) {
          const tip = { w: 288, h };
          const p = previewStar(tree, astrolabePoints(MAX_RANK), n.id);
          const at = tipPlacement(p, tree, map, tip, room, bounds);
          // On screen, and at most a little past the map's column.
          expect(at.x, n.id).toBeGreaterThanOrEqual(-bounds.left);
          expect(at.x + tip.w, n.id).toBeLessThanOrEqual(map.w + bounds.right);
          expect(at.y, n.id).toBeGreaterThanOrEqual(-bounds.top);
          expect(at.y + tip.h, n.id).toBeLessThanOrEqual(map.h + bounds.bottom);
          expect(at.x, n.id).toBeGreaterThanOrEqual(-room.left - 24);
          expect(at.x + tip.w, n.id).toBeLessThanOrEqual(map.w + room.right + 24);
          expect(at.y, n.id).toBeGreaterThanOrEqual(-room.top - 24);
          expect(at.y + tip.h, n.id).toBeLessThanOrEqual(map.h + room.bottom + 24);
          // Clear of the star, its path and what hangs on it.
          for (const id of new Set([n.id, ...p.path, ...p.hangs])) {
            const star = astrolabeNode(id);
            const s = starShare(star);
            const [x, y, r] = [s.x * map.w, s.y * map.h, STAR_RADIUS[star.kind] * scale];
            const covered =
              x + r > at.x && x - r < at.x + tip.w && y + r > at.y && y - r < at.y + tip.h;
            expect(covered, `${n.id} (${h} px) covers ${id}`).toBe(false);
          }
        }
  });
});

describe('the moves go through the profile store', () => {
  const atRank = (rank: number) =>
    useProfile.setState({ profile: { ...useProfile.getState().profile, xp: RANK_XP[rank - 1]! } });

  it('take a star and its path, give one back, respec', () => {
    atRank(ASTROLABE_RANK);
    expect(useProfile.getState().astrolabePoints()).toBe(astrolabePoints(ASTROLABE_RANK));
    const took = takeStar('silk_n1');
    expect(took.took).toEqual(pathTo([], 'silk_n1'));
    expect(useProfile.getState().profile.astrolabe).toEqual(took.took);
    // No points left: the store keeps the tree.
    const short = takeStar('choir_t1');
    expect(short.took).toEqual([]);
    expect(short.preview.action).toBe('short');
    expect(useProfile.getState().profile.astrolabe).toHaveLength(3);
    // Something hangs on the trunk; the notable at its end goes back.
    expect(giveBackStar('silk_t1').gave).toBe(false);
    expect(giveBackStar('silk_n1').gave).toBe(true);
    expect(useProfile.getState().profile.astrolabe).toEqual(['silk_t1', 'silk_t2']);
    expect(takeStar('choir_t1').took).toEqual(['choir_t1']);
    expect(respecStars()).toBe(3);
    expect(useProfile.getState().profile.astrolabe).toEqual([]);
  });

  it('Skip the unlocks gives every point; a run in Prep follows the tree', () => {
    useSettings.getState().update((s) => ({ ...s, unlockAll: true }));
    expect(useProfile.getState().astrolabePoints()).toBe(astrolabePoints(1, true));
    useRun.getState().newRun(4);
    const keystones = ['prism_covenant', 'eldritch_conduit'];
    for (const id of keystones) takeStar(id);
    const tree = useProfile.getState().profile.astrolabe;
    expect(tree).toEqual(
      keystones.reduce<string[]>((t, id) => allocate(t, id, astrolabePoints(1, true)), []),
    );
    expect(useRun.getState().run!.astrolabe).toEqual(tree);
    // Embarking keeps it; the first fight's config carries it.
    useRun.getState().embark();
    useRun.getState().chooseNode(Run.reachable(useRun.getState().run!)[0]!.id);
    expect(useRun.getState().combatConfig()!.astrolabe).toEqual(tree);
  });
});

describe('what the tree adds up to', () => {
  it('each total is the sum of its stars’ content values', () => {
    const pct = (n: AstrolabeNode) => n.values.pct ?? 0;
    for (const tree of TREES) {
      const t = treeTotals(tree);
      const value = (key: StatKey) =>
        t.groups.flatMap((g) => g.lines).find((l) => l.key === key)?.value ?? 0;
      const of = (effects: string[], f: (n: AstrolabeNode) => number = pct) =>
        sum(tree, (n) => (effects.includes(n.effect) ? f(n) : 0));
      expect(value('mend')).toBeCloseTo(of(['thread', 'spun_silver', 'mend']), 9);
      expect(value('empower')).toBeCloseTo(of(['thread', 'spun_silver', 'empower']), 9);
      expect(value('reach')).toBeCloseTo(
        of(['spun_silver'], (n) => n.values.range ?? 0),
        9,
      );
      expect(value('aura')).toBeCloseTo(of(['aura_effect', 'clear_voice']), 9);
      expect(value('reserve')).toBeCloseTo(
        of(['reserve']) + of(['clear_voice'], (n) => n.values.reserve ?? 0),
        9,
      );
      expect(value('ward')).toBeCloseTo(of(['ward', 'shieldwright']), 9);
      expect(value('techCost')).toBeCloseTo(of(['tech_cost']), 9);
      expect(value('heroLife')).toBeCloseTo(
        of(['hero_life']) + of(['fellowship'], (n) => n.values.life ?? 0),
        9,
      );
      // Keystones are listed with their price; notables with a rule of their own by name.
      expect(t.keystones.map((n) => n.id)).toEqual(
        STARS.filter((n) => n.kind === 'keystone' && tree.includes(n.id)).map((n) => n.id),
      );
      for (const n of t.rules) expect(Object.keys(starStats(n))).toHaveLength(0);
      // The lines print the totals.
      for (const g of t.groups)
        for (const l of g.lines) expect(l.text).toContain(String(Number(l.value.toFixed(2))));
    }
  });

  it('every star shows in the totals: a stat with its line, a rule by name, or a keystone', () => {
    for (const n of STARS) {
      if (n.kind === 'start') continue;
      const t = treeTotals(pathTo([], n.id)!);
      const lines = new Set(t.groups.flatMap((g) => g.lines.map((l) => l.key)));
      const stats = Object.entries(starStats(n)).filter(([, v]) => v > 0);
      if (n.kind === 'keystone') expect(t.keystones.map((k) => k.id)).toContain(n.id);
      else if (stats.length === 0) {
        // Every travel star adds a number; a notable without one is a rule of its own.
        expect(n.kind, n.id).not.toBe('travel');
        expect(t.rules.map((r) => r.id)).toContain(n.id);
      } else for (const [key] of stats) expect([...lines], `${n.id}: ${key}`).toContain(key);
    }
  });

  it('the totals are what the sim makes of the tree', () => {
    // A tree with no keystone: the sim's multipliers are the totals' "% more".
    const sim = treeSim(RANK12_TREE);
    const m = worldOf(sim).mods;
    const t = treeTotals(RANK12_TREE);
    const value = (key: StatKey) =>
      t.groups.flatMap((g) => g.lines).find((l) => l.key === key)?.value ?? 0;
    expect(m.mendMult).toBeCloseTo(1 + value('mend') / 100, 9);
    expect(m.empowerMult).toBeCloseTo(1 + value('empower') / 100, 9);
    expect(m.auraEffectMult).toBeCloseTo(1 + value('aura') / 100, 9);
    expect(m.threadRangeBonus).toBeCloseTo(value('reach'), 9);
    expect(songReserveOf(null, RANK12_TREE).mult).toBeCloseTo(1 - value('reserve') / 100, 9);
  });

  it('a keystone’s text is what it gives and what it costs you', () => {
    for (const n of STARS.filter((s) => s.kind === 'keystone')) {
      const parts = keystoneParts(n);
      expect(parts.prices.length, n.id).toBeGreaterThan(0);
      expect(parts.gains.length, n.id).toBeGreaterThan(0);
      // Every sentence of the content's text, once.
      const words = (s: string) => s.replace(/[.\s]+/g, ' ').trim();
      expect(words([...parts.gains, ...parts.prices].sort().join(' '))).toBe(
        words(
          astrolabeText(n)
            .split(/(?<=\.)\s+/)
            .map((s) => s.replace(/\.$/, ''))
            .sort()
            .join(' '),
        ),
      );
    }
    expect(keystoneParts(astrolabeNode('prism_covenant')).prices[0]).toMatch(/^You fight at/);
    expect(keystoneParts(astrolabeNode('eldritch_conduit')).prices[0]).toMatch(/cost Life/);
  });
});

describe('the HUD with a tree (real sims)', () => {
  it('technique costs and what pays them agree with `techniqueCost` and `canPay`', () => {
    const check = (sim: Sim) => {
      const h = hud(sim);
      for (const key of ['ward', 'chime', 'reel'] as const) {
        const t = h.weaver.techniques.find((x) => x.key === key)!;
        const cost = techniqueCost(sim.state, key);
        expect(t.cost, key).toBeCloseTo(cost.amount, 9);
        expect(t.pool, key).toBe(cost.pool);
        expect(t.affordable, key).toBe(canPay(sim.state, key));
        expect(t.baseCost, key).toBeCloseTo(
          CONTENT.techniques[key].cost * sim.state.astrolabe.techCostMult,
          9,
        );
      }
      return h;
    };
    // Economy alone: cheaper, still Spirit.
    const economy = check(treeSim(ECONOMY));
    expect(economy.weaver.techniques[0]!.pool).toBe('spirit');
    expect(economy.weaver.techniques[0]!.cost).toBeLessThan(CONTENT.techniques.ward.cost);
    // Eldritch Conduit with the Economy on its way: paid in Life.
    const sim = treeSim(KEYSTONE_TREE);
    expect(sim.state.astrolabe.techniquesCostLife).toBe(true);
    expect(check(sim).weaver.techniques.every((t) => t.key === 'glide' || t.pool === 'life')).toBe(
      true,
    );
    // Low on Life, between the cheapest technique's price and the dearest's: the cheapest can
    // be paid (never her last), the dearest can't, as the sim says.
    const w = weaverOf(sim);
    const [cheap, , dear] = (['ward', 'chime', 'reel'] as const)
      .map((key) => ({ key, cost: techniqueCost(sim.state, key).amount }))
      .sort((a, b) => a.cost - b.cost);
    expect(dear!.cost).toBeGreaterThan(cheap!.cost);
    dealDamage(worldOf(sim), w, {
      source: null,
      sourceName: 'test',
      amount: w.health!.hp - (cheap!.cost + dear!.cost) / 2 - 1,
      telegraph: null,
    });
    const low = check(sim);
    expect(low.weaver.techniques.find((t) => t.key === cheap!.key)!.affordable).toBe(true);
    expect(low.weaver.techniques.find((t) => t.key === dear!.key)!.affordable).toBe(false);
    // And the sim refuses it for Life: the runtime's callout says so.
    const kael = sim.state.entities.get(sim.state.party[0]!)!;
    const cast: Record<'ward' | 'chime' | 'reel', Command> = {
      ward: { t: 'tech', id: 'ward', slot: 0 },
      chime: { t: 'tech', id: 'chime', point: { x: kael.x, z: kael.z } },
      reel: { t: 'tech', id: 'reel', slot: 1 },
    };
    const events = stepFor(sim, 1, [cast[dear!.key]]);
    expect(events).toContainEqual(
      expect.objectContaining({ type: 'techniqueRejected', technique: dear!.key, reason: 'life' }),
    );
  });

  it('a Chronomancer’s Rewind is ready only when Life can pay it', () => {
    const sim = treeSim(KEYSTONE_TREE, GUARDIAN, 'chronomancer');
    expect(hud(sim).weaver.rewind!.ready).toBe(canPay(sim.state, 'reel'));
    const w = weaverOf(sim);
    dealDamage(worldOf(sim), w, {
      source: null,
      sourceName: 'test',
      amount: w.health!.hp - 2,
      telegraph: null,
    });
    expect(hud(sim).weaver.rewind!.ready).toBe(false);
  });

  it('Prism Covenant: the Life bar marks the cap she can’t be healed above', () => {
    const sim = treeSim(RANK20_TREE);
    const w = weaverOf(sim);
    const cap = (astrolabeNode('prism_covenant').values.cap ?? 0) / 100;
    expect(treeLifeCap(RANK20_TREE)).toBeCloseTo(cap, 9);
    const h = hud(sim);
    expect(h.weaver.lifeCap).toBeCloseTo(w.health!.maxHp * cap, 9);
    expect(h.weaver.life).toBeCloseTo(h.weaver.lifeCap!, 6);
    stepFor(sim, 600);
    expect(hud(sim).weaver.life).toBeLessThanOrEqual(hud(sim).weaver.lifeCap! + 1e-6);
    expect(hud(treeSim(RANK12_TREE)).weaver.lifeCap).toBeNull();
  });

  it('Sanguine Font: the songs hold Life on any run, as the bar and the chips say', () => {
    const sim = treeSim(SANGUINE_TREE);
    const h = hud(sim);
    expect(h.weaver.pool).toBe('life');
    expect(h.weaver.reservedLife).toBeGreaterThan(0);
    expect(h.weaver.reserved).toBe(0);
    // Each aura's share is what the fight holds: its reserve × the tree's (two-thirds) share.
    const mult = songReserveOf(null, SANGUINE_TREE).mult;
    const held = h.weaver.auras.reduce((s, a) => s + a.reserve, 0);
    expect(held * weaverOf(sim).weaver!.maxLife).toBeCloseTo(h.weaver.reservedLife, 6);
    expect(mult).toBeLessThan(1);
  });

  it('Afterglow, Overflowing Grace and the keystones on the frames and the chip', () => {
    const glow = astroStage('astro-afterglow');
    expect(glow.reached).toBe(true);
    const kael = glow.hud.party[0]!;
    const e = glow.sim.state.entities.get(kael.id)!;
    expect(kael.afterglow!.remaining).toBeCloseTo(e.hero!.afterglowUntil - glow.sim.state.time, 9);
    expect(kael.afterglow!.total).toBe(astrolabeNode('silk_bn').values.seconds);
    expect(treeAfterglow(AFTERGLOW_TREE)).toBe(worldOf(glow.sim).mods.empowerLinger);
    // The Thread on Lyra, Empowering: she has the real thing, not its afterglow.
    expect(glow.hud.party[1]!.afterglow).toBeNull();

    const grace = astroStage('astro-grace');
    expect(grace.reached).toBe(true);
    const k = grace.hud.party[0]!;
    const shield = grace.sim.state.entities
      .get(k.id)!
      .health!.shields.find((s) => s.kind === 'overshield')!;
    expect(k.grace!.amount).toBeCloseTo(shield.amount, 9);
    expect(k.grace!.cap).toBeCloseTo(
      (k.maxHp * (astrolabeNode('overflowing_grace').values.cap ?? 0)) / 100,
      9,
    );
    expect(grace.events.some((ev) => ev.type === 'graceShield')).toBe(true);
    // Without the keystone, a Weaver's overshield isn't Grace.
    expect(astroStage('astro-afterglow').hud.party.every((p) => p.grace === null)).toBe(true);

    const keys = astroStage('astro-conduit');
    expect(keys.hud.astrolabe!.keystones).toEqual(['prism_covenant', 'eldritch_conduit']);
    expect(keys.hud.astrolabe!.stars).toBe(KEYSTONE_TREE.length);
    expect(glow.hud.astrolabe!.keystones).toEqual([]);
  });

  it('the lab’s scenes are real sims that reach their moments', () => {
    const scenes: AstroScenario[] = [
      'astro-conduit',
      'astro-afterglow',
      'astro-grace',
      'astro-sanguine',
    ];
    for (const s of scenes) expect(astroStage(s).reached, s).toBe(true);
    // Eldritch Conduit's scene ends on a technique refused for Life, in the runtime's words.
    expect(astroCallouts('astro-conduit')[0]).toMatchObject({
      kind: 'reject',
      text: expect.stringMatching(/: not enough Life$/),
    });
  });
});

describe('the song builder with a tree', () => {
  /** Four auras at a quarter of Spirit each: exactly all of it. */
  const FULL: ChordLoadout[] = [
    { auras: ['sostenuto', 'allegro'], ornaments: [] },
    { auras: ['lullaby', 'fermata'], ornaments: [] },
  ];

  it('accepts exactly what the run accepts, for every pool and tree', () => {
    const loadouts = [GUARDIAN, HEAVY, FULL, Run.DEFAULT_CHORDS, ...PAIRS];
    const trees = [[], LIGHT_TREE, SANGUINE_TREE, KEYSTONE_TREE, RANK20_TREE];
    let both = 0;
    for (const tree of trees)
      for (const calling of [null, 'martyr', 'luminary'])
        for (const chords of loadouts) {
          const run = Run.newRun(3, undefined, tree);
          const r = calling ? Run.setCalling(run, calling) : run;
          const pool = Run.reservePool(r);
          const mult = Run.reserveMult(r);
          const ui = loadoutProblems(chords, EVERYTHING, undefined, pool, mult).length === 0;
          expect(ui, `${tree.length} ${calling} ${JSON.stringify(chords)}`).toBe(
            Run.chordsAllowed(chords, EVERYTHING, undefined, pool, mult),
          );
          if (ui) both++;
        }
    expect(both).toBeGreaterThan(0);
    // (a) Clear Voice and the Breaths let heavier songs in: more than all of Spirit without them.
    const light = Run.newRun(3, undefined, LIGHT_TREE);
    expect(Run.reserveMult(light)).toBeLessThan(1);
    const heavier = heavierSongs(LIGHT_TREE);
    expect(heavier).not.toBeNull();
    expect(loadoutProblems(heavier!, EVERYTHING)).not.toEqual([]);
    expect(
      loadoutProblems(heavier!, EVERYTHING, undefined, 'spirit', Run.reserveMult(light)),
    ).toEqual([]);
    // (b) Sanguine Font: songs at all of Spirit hold two-thirds as much of Life.
    const blood = Run.newRun(3, undefined, SANGUINE_TREE);
    expect(Run.reservePool(blood)).toBe('life');
    expect(loadoutProblems(FULL, EVERYTHING, undefined, 'life')).not.toEqual([]);
    expect(loadoutProblems(FULL, EVERYTHING, undefined, 'life', Run.reserveMult(blood))).toEqual(
      [],
    );
  });

  it('the budget is what the fight holds: Life with Sanguine Font, costs with the Economy', () => {
    for (const [tree, chords, calling] of [
      [SANGUINE_TREE, GUARDIAN, null],
      [SANGUINE_TREE, GUARDIAN, 'martyr'],
      [LIGHT_TREE, heavierSongs(LIGHT_TREE)!, null],
      [KEYSTONE_TREE, HEAVY, null],
      [[], GUARDIAN, 'martyr'],
    ] as const) {
      const run = calling
        ? Run.setCalling(Run.newRun(3, undefined, tree), calling)
        : Run.newRun(3, undefined, tree);
      const pool = Run.reservePool(run);
      const b = spiritBudget(chords, pool, calling, {
        reserveMult: Run.reserveMult(run),
        astrolabe: tree,
      });
      const sim = treeSim(tree, [...chords], calling ?? undefined);
      const w = weaverOf(sim);
      if (pool === 'life') {
        expect(b.max).toBeCloseTo(w.weaver!.maxLife, 6);
        expect(b.reserved).toBeCloseTo(w.weaver!.reservedLife, 6);
        expect(b.free).toBeCloseTo(w.health!.maxHp, 6);
      } else {
        expect(b.reserved).toBeCloseTo(w.weaver!.reservedSpirit, 6);
      }
      expect(b.weaverLife).toBeCloseTo(w.weaver!.maxLife, 6);
      expect(weaverLifeFor(calling, tree)).toBeCloseTo(w.weaver!.maxLife, 6);
      expect(b.lifeCap).toBeCloseTo(sim.state.astrolabe.lifeCapPct, 9);
      expect(b.techPool).toBe(sim.state.astrolabe.techniquesCostLife ? 'life' : 'spirit');
      for (const t of b.techniques)
        expect(t.cost).toBeCloseTo(techniqueCost(sim.state, t.key).amount, 9);
    }
    // The tree's own numbers, as the sim makes them.
    for (const tree of TREES) {
      const sim = treeSim(tree);
      const m = worldOf(sim).mods;
      expect(treeLifeMult(tree)).toBeCloseTo(m.lifeMult, 9);
      expect(treeTechCostMult(tree)).toBeCloseTo(m.techCostMult, 9);
      expect(treeTechniquesCostLife(tree)).toBe(m.techniquesCostLife);
      expect(treeBleedOutMult(tree)).toBeCloseTo(m.bleedOutMult, 9);
      expect(treeAfterglow(tree)).toBeCloseTo(m.empowerLinger, 9);
    }
  });

  it('Prep says what pays for what; every Training preset can be sung with any tree', () => {
    expect(poolBlurb(Run.newRun(3))).toMatch(/^Whatever Spirit your auras leave free/);
    expect(poolBlurb(Run.newRun(3, undefined, SANGUINE_TREE))).toMatch(/^With Sanguine Font/);
    expect(poolBlurb(Run.newRun(3, undefined, KEYSTONE_TREE))).toMatch(/^With Eldritch Conduit/);
    expect(poolBlurb(Run.setCalling(Run.newRun(3), 'martyr'))).toMatch(/^As the Martyr/);
    for (const tree of TREES)
      for (const preset of Run.CHORD_PRESETS) {
        const reserve = songReserveOf(null, tree);
        expect(
          chordProblems(preset.chords, CONTENT, { pool: reserve.pool, reserveMult: reserve.mult }),
          `${preset.id} with ${tree.length} stars`,
        ).toEqual([]);
      }
  });
});

describe('Ranks and points', () => {
  it('Rank 4 opens it with its points; every later Rank says +1 Astrolabe point', () => {
    for (let r = 1; r < ASTROLABE_RANK; r++) expect(rankAstrolabeLine(r)).toBeNull();
    expect(rankAstrolabeLine(ASTROLABE_RANK)).toBe(
      `It opens with ${astrolabePoints(ASTROLABE_RANK)} points to spend.`,
    );
    for (let r = ASTROLABE_RANK + 1; r <= MAX_RANK; r++)
      expect(rankAstrolabeLine(r)).toBe(`+1 Astrolabe point (${astrolabePoints(r)} in all).`);
    // The card for Rank 4 has the unlock; the panel before it says what's next.
    expect(mockRankUps([ASTROLABE_RANK])[0]!.unlocks.map((u) => u.kind)).toContain('astrolabe');
    expect(UNLOCKS.find((u) => u.kind === 'astrolabe')!.rank).toBe(ASTROLABE_RANK);
    expect(rankPanel({ xp: RANK_XP[ASTROLABE_RANK - 2]!, runs: 0, wins: 0 }).nextAstrolabe).toBe(
      rankAstrolabeLine(ASTROLABE_RANK),
    );
    expect(rankPanel({ xp: RANK_XP[10]!, runs: 0, wins: 0 }).nextAstrolabe).toBe(
      rankAstrolabeLine(12),
    );
    expect(rankPanel({ xp: RANK_XP[MAX_RANK - 1]!, runs: 0, wins: 0 }).nextAstrolabe).toBeNull();
  });

  it('the Title’s points to spend', () => {
    expect(spendLine(5)).toBe('5 points to spend');
    expect(spendLine(1)).toBe('1 point to spend');
    expect(spendLine(0)).toBe('Every point spent');
    expect(spendLine(-8)).toBe('8 points over');
  });
});

describe('the constellations’ look', () => {
  it('four colours that read apart in every colour-vision mode, each with a glyph and a name', () => {
    const colors = CONSTELLATIONS.map((c) => CONSTELLATION_LOOK[c].color);
    for (const vision of COLOR_VISIONS)
      for (let i = 0; i < colors.length; i++)
        for (let j = i + 1; j < colors.length; j++)
          expect(
            deltaE(simulateVision(colors[i]!, vision), simulateVision(colors[j]!, vision)),
            `${CONSTELLATIONS[i]} vs ${CONSTELLATIONS[j]} (${vision})`,
          ).toBeGreaterThanOrEqual(20);
    for (const c of CONSTELLATIONS) {
      expect(ASTROLABE_GLYPHS[CONSTELLATION_LOOK[c].glyph], c).toBeTruthy();
      expect(CONSTELLATION_LOOK[c].name).toBeTruthy();
      // Every constellation in content has its look, and its stars.
      expect(STARS.some((n) => n.constellation === c)).toBe(true);
    }
    const inContent = new Set(STARS.map((n) => n.constellation));
    for (const c of inContent) expect(['centre', 'bridge', ...CONSTELLATIONS]).toContain(c);
  });
});
