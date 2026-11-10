/**
 * Phase 5g, W0 "foundations" (docs/phase-5g.md): the shared support the six content streams build
 * on, proven inert before any content lands.
 *
 * - The resolver's accumulate refactor (ground rule 4) reproduces the frozen pre-5g resolver
 *   exactly: every case of `pre5g/resolver.json` (every motif at every level alone, every relic
 *   and boon alone, and 200 seeded builds with relics, boons, a Calling and path, Astrolabe nodes,
 *   passives and Dissonance), written once by `pre5g/freezeResolver.ts` on the untouched tree.
 * - Every new `Mods` field and its default that does nothing; every hook body (`src/sim/fill/*`)
 *   with a return value gives its neutral value on a world holding no Phase 5g entry.
 * - The content: the two optional `expedition` keys and `triggers` keys (absent on every existing
 *   entry), the Harmony-prerequisite lint and the trigger lint, the fill lists concatenated after
 *   every existing list, `FILL_IDS`.
 * - The Expedition-only gate: never offered on a Prelude, before any draw (fixture entries).
 * - The trigger interpreter (systems/triggers.ts), on fixture triggers: each event, condition,
 *   limit, effect and target, its clocks and tally, its `motifTriggered`, and that it draws
 *   nothing.
 * - `triggers` in the ledger, `EncounterStats`, run totals and the run save.
 * - Each `src/sim/fill/*` file can be loaded first.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { z } from 'zod';
import { createSim } from '../../src/sim';
import { CONTENT } from '../../src/content';
import {
  FILL_BOONS,
  FILL_EVENTS,
  FILL_IDS,
  FILL_MOTIFS,
  FILL_RELICS,
} from '../../src/content/fill';
import { MOTIFS } from '../../src/content/motifs';
import { BOONS, RELICS } from '../../src/content/relics';
import {
  BoonDefSchema,
  ContentSchema,
  MotifDefSchema,
  RelicDefSchema,
  TriggerDefSchema,
  type ContentInput,
} from '../../src/content/schema';
import * as Run from '../../src/meta/run';
import { RunStateSchema } from '../../src/meta/save';
import type { RunState } from '../../src/meta/types';
import { SIM_DT } from '../../src/sim/constants';
import type { SimEvent } from '../../src/sim/events';
import {
  FILL_NO_MODS,
  KNOWN_BOONS,
  KNOWN_MOTIFS,
  KNOWN_RELICS,
  NO_MODS,
  resolveMods,
} from '../../src/sim/mods';
import { spawnEnemy } from '../../src/sim/systems/enemies';
import { empowerBonus } from '../../src/sim/systems/thread';
import { updateTriggers } from '../../src/sim/systems/triggers';
import { createWorld, emptyLedger, type ResolvedSimConfig, type World } from '../../src/sim/world';
import type { Entity } from '../../src/sim/state';
import type { SimConfig } from '../../src/sim';
import * as aegis from '../../src/sim/fill/aegis';
import * as bond from '../../src/sim/fill/bond';
import * as choir from '../../src/sim/fill/choir';
import * as finale from '../../src/sim/fill/finale';
import * as harmonies from '../../src/sim/fill/harmonies';
import * as relics from '../../src/sim/fill/relics';
import * as silk from '../../src/sim/fill/silk';
import { onThread, touchingThread } from '../../src/sim/fill/threadContact';
import { encodeMods, type ResolverFixture } from './pre5g/resolverFixture';

type TriggerIn = z.input<typeof TriggerDefSchema>;

// ── The resolver's accumulate refactor (ground rule 4) ───────────────────────────────────────

describe('the resolver reproduces the frozen pre-5g resolver (ground rule 4)', () => {
  const fixture = JSON.parse(
    readFileSync(fileURLToPath(new URL('./pre5g/resolver.json', import.meta.url)), 'utf8'),
  ) as ResolverFixture;
  const fill = encodeMods(FILL_NO_MODS as unknown as Record<string, unknown>);

  it('holds every motif at every level, every relic and boon alone, and 200 builds', () => {
    const motifLevels = CONTENT.motifs
      .filter((m) => !FILL_IDS.includes(m.id))
      .reduce((n, m) => n + m.values.length, 0);
    const alone = fixture.cases.filter(
      (c) => c.input.motifs.length === 1 && c.input.relics.length === 0 && !c.input.calling,
    );
    expect(alone).toHaveLength(motifLevels);
    const builds = fixture.cases.filter((c) => c.input.calling !== null);
    expect(builds).toHaveLength(200);
    expect(builds.every((c) => c.input.relics.length > 0)).toBe(true);
    expect(builds.filter((c) => c.input.astrolabe.length > 0).length).toBeGreaterThan(150);
  });

  it('NO_MODS keeps every frozen default; its other fields are FILL_NO_MODS', () => {
    const now = encodeMods(NO_MODS as unknown as Record<string, unknown>);
    for (const [k, v] of Object.entries(fixture.noMods)) expect(now[k], k).toEqual(v);
    const added = Object.keys(now).filter((k) => !(k in fixture.noMods));
    expect(added.sort()).toEqual(Object.keys(FILL_NO_MODS).sort());
    for (const k of added) expect(now[k], k).toEqual(fill[k]);
  });

  it('every frozen case resolves to exactly the frozen mods, and every new field to its default', () => {
    const wrong: string[] = [];
    for (const [i, c] of fixture.cases.entries()) {
      const got = encodeMods(
        resolveMods(c.input as unknown as ResolvedSimConfig, CONTENT) as unknown as Record<
          string,
          unknown
        >,
      );
      const want: Record<string, unknown> = { ...fixture.noMods, ...c.mods, ...fill };
      for (const k of new Set([...Object.keys(want), ...Object.keys(got)]))
        if (JSON.stringify(got[k]) !== JSON.stringify(want[k]))
          wrong.push(`case ${i} ${k}: ${JSON.stringify(got[k])} ≠ ${JSON.stringify(want[k])}`);
    }
    expect(wrong).toEqual([]);
  });

  it('a motif listed twice plays its last entry, as when every case assigned', () => {
    const one = resolveMods(
      { ...baseInput(), motifs: [{ id: 'deep_roots', level: 3 }] } as unknown as ResolvedSimConfig,
      CONTENT,
    );
    const twice = resolveMods(
      {
        ...baseInput(),
        motifs: [
          { id: 'deep_roots', level: 1 },
          { id: 'deep_roots', level: 3 },
        ],
      } as unknown as ResolvedSimConfig,
      CONTENT,
    );
    expect(twice).toEqual(one);
  });
});

function baseInput() {
  return {
    motifs: [] as { id: string; level: number }[],
    relics: [] as { id: string; cleansed: boolean; empowered: boolean }[],
    boons: [] as string[],
    calling: null,
    astrolabe: [] as string[],
    passives: [],
    dissonance: [],
  };
}

// ── The new Mods fields and the hook bodies' neutral values ──────────────────────────────────

describe('every new Mods field has a default that does nothing (ground rule 3)', () => {
  it('the defaults, as the hook table names them', () => {
    expect(FILL_NO_MODS).toEqual({
      triggers: [],
      razorDps: 0,
      razorMult: 1,
      razorCrit: false,
      razorSleep: 0,
      snapLockMult: 1,
      empowerSpeedMult: 1,
      needlePct: 0,
      empoweredKillBonus: 0,
      lowWardBonus: 0,
      lowWardBelow: 0,
      huddleRegen: 0,
      restDiscount: 0,
      perAuraGuard: 0,
      orbitCast: 0,
      constellationPct: 0,
      pierce: 0,
      redEdge: 0,
      counterBonus: 0,
      graftMult: 1,
      firstCueCut: 0,
      freeCueEvery: 0,
      firstCrescendoCut: 0,
      fadeDelay: 0,
      startSoloCharge: 0,
      vigilResonance: 0,
      wovenRefill: 0,
      ringingPct: 0,
      ringingSeconds: 0,
      staffMult: 1,
      woundedBonus: 0,
      circleGuard: 0,
      spareSnap: false,
      chimeCharges: 1,
      waterClock: 0,
      maskGuard: 0,
      noEmpower: false,
      cueCostFloor: false,
      thornPct: 0,
      thornBelow: 0,
    });
  });

  it('a fight with no Phase 5g entry resolves every new field to its default, triggers shared', () => {
    const world = createWorld({ seed: 1, encounter: 'first_light' });
    for (const [k, v] of Object.entries(FILL_NO_MODS))
      expect((world.mods as unknown as Record<string, unknown>)[k], k).toEqual(v);
    expect(world.mods.triggers).toBe(NO_MODS.triggers);
  });

  it('every hook with a return value gives its neutral value on a world holding no entry', () => {
    const world = createWorld({ seed: 1, encounter: 'sandbox', auras: [] });
    const hero = world.entities.get(world.party[0]!)!;
    const telegraph = { id: 1 } as unknown as Parameters<typeof silk.needleCatch>[1];
    const opts = { source: null, sourceName: 'test', amount: 30 };
    expect(silk.slackLineLock(world, 1.25)).toBe(1.25);
    expect(silk.quickeningSpeed(world, hero)).toBe(1);
    expect(silk.needleCatch(world, telegraph, hero, 42)).toBe(42);
    expect(choir.restCost(world, 7)).toBe(7);
    expect(choir.fullChordGuard(world, hero, 30, opts)).toBe(0);
    expect(aegis.lastBastionMult(world, hero)).toBe(1);
    expect(finale.cueCostCut(world, 25)).toBe(25);
    expect(finale.crescendoCostCut(world, 100)).toBe(100);
    expect(finale.tenutoDelay(world)).toBe(0);
    expect(bond.innerOrbitCast(world, hero)).toBe(1);
    expect(bond.edgeOfTheRedMult(world, hero)).toBe(1);
    expect(bond.graftShare(world, hero, 3.5)).toBe(3.5);
    expect(harmonies.cuttingChorus(world)).toEqual({ mult: 1, crit: false });
    expect(harmonies.concertPitchMult(world, hero)).toBe(1);
    expect(harmonies.woundedMendMult(world, hero)).toBe(1);
    expect(harmonies.woundedWardMult(world, hero)).toBe(1);
    expect(harmonies.closedCircleGuard(world, hero, 30, opts)).toBe(0);
    expect(relics.shopRelicBonus([], CONTENT)).toBe(0);
    expect(relics.waterClockOut(world, hero)).toBe(false);
    expect(relics.ironMaskRefuses(world, undefined)).toBe(false);
    expect(relics.ironMaskGuard(world, hero, 30, opts)).toBe(0);
    expect(relics.cueCostFloor(world, -10)).toBe(-10);
    expect(relics.thornwreathMult(world, hero)).toBe(1);
  });

  it('every stream resolver knows only its own content, and every content motif is known', () => {
    const ids = [
      ...silk.silkMotifIds(),
      ...aegis.aegisMotifIds(),
      ...choir.choirMotifIds(),
      ...bond.bondMotifIds(),
      ...finale.finaleMotifIds(),
      ...harmonies.harmonyMotifIds(),
    ];
    expect(new Set(ids).size).toBe(ids.length);
    const fillMotifs = FILL_MOTIFS.map((m) => m.id);
    for (const id of ids) expect(fillMotifs, id).toContain(id);
    for (const id of relics.fillRelicIds()) expect(FILL_RELICS.map((r) => r.id)).toContain(id);
    for (const id of relics.fillBoonIds()) expect(FILL_BOONS.map((b) => b.id)).toContain(id);
    // The fill's ids come first, so the KNOWN lists' pinned tails stay where they were.
    expect(KNOWN_MOTIFS.slice(ids.length)[0]).toBe('relay_weave');
    expect(KNOWN_RELICS.slice(relics.fillRelicIds().length)[0]).toBe('silver_thimble');
    expect(KNOWN_BOONS.slice(relics.fillBoonIds().length)[0]).toBe('last_note');
    for (const m of CONTENT.motifs) expect(KNOWN_MOTIFS, m.id).toContain(m.id);
  });
});

// ── Content: the keys, the lint, the concatenation ───────────────────────────────────────────

describe('the content (ground rules 6 and 7)', () => {
  const before = (id: string) => !FILL_IDS.includes(id);

  it('no existing entry carries `expedition` or `triggers`, so it parses to the JSON it did', () => {
    for (const m of CONTENT.motifs.filter((m) => before(m.id))) {
      expect('expedition' in m.requires, m.id).toBe(false);
      expect('triggers' in m, m.id).toBe(false);
    }
    for (const r of CONTENT.relics.filter((r) => before(r.id))) {
      expect('expedition' in r, r.id).toBe(false);
      expect('triggers' in r, r.id).toBe(false);
    }
    for (const b of CONTENT.boons.filter((b) => before(b.id))) expect('triggers' in b).toBe(false);
  });

  it('the fill comes after every existing list, in the doc order, and FILL_IDS names it all', () => {
    const ids = (list: readonly { id: string }[]) => list.map((x) => x.id);
    expect(ids(CONTENT.motifs)).toEqual([...ids(MOTIFS), ...ids(FILL_MOTIFS)]);
    expect(CONTENT.motifs[MOTIFS.length - 1]!.id).toBe('verdant_choir');
    expect(ids(CONTENT.relics)).toEqual([...ids(RELICS), ...ids(FILL_RELICS)]);
    expect(CONTENT.relics[RELICS.length - 1]!.id).toBe('first_score');
    expect(ids(CONTENT.boons)).toEqual([...ids(BOONS), ...ids(FILL_BOONS)]);
    expect(CONTENT.boons[BOONS.length - 1]!.id).toBe('mended_loom');
    const events = ids(CONTENT.events);
    expect(events.slice(events.length - FILL_EVENTS.length)).toEqual(ids(FILL_EVENTS));
    expect(events[events.length - FILL_EVENTS.length - 1]).toBe('mirror_pool');
    expect([...FILL_IDS]).toEqual([
      ...ids(FILL_MOTIFS),
      ...ids(FILL_RELICS),
      ...ids(FILL_BOONS),
      ...ids(FILL_EVENTS),
    ]);
    expect(new Set(FILL_IDS).size).toBe(FILL_IDS.length);
    // New entries use `expedition`, never `movement` (m1Unchanged's content-shape checks), and
    // every one is Expedition-only (decision 4); new events live in Movements II and III.
    for (const m of CONTENT.motifs.filter((m) => !before(m.id))) {
      expect(m.requires.movement, m.id).toBeUndefined();
      expect(m.requires.expedition, m.id).toBe(true);
    }
    for (const r of CONTENT.relics.filter((r) => !before(r.id))) {
      expect(r.movement, r.id).toBeUndefined();
      expect(r.expedition, r.id).toBe(true);
    }
    for (const e of CONTENT.events.filter((e) => !before(e.id)))
      expect([2, 3], e.id).toContain(e.movement);
  });

  const harmony = (id: string, motifs: string[]) => ({
    id,
    name: 'Test Harmony',
    category: 'silk' as const,
    rarity: 'epic' as const,
    values: [1],
    text: 'Test {v}.',
    requires: { motifs, expedition: true as const },
    tags: ['harmony'],
  });
  const parse = (extra: Partial<Pick<ContentInput, 'motifs' | 'relics' | 'boons'>>) =>
    ContentSchema.safeParse({
      ...CONTENT,
      motifs: [...CONTENT.motifs, ...(extra.motifs ?? [])],
      relics: [...CONTENT.relics, ...(extra.relics ?? [])],
      boons: [...CONTENT.boons, ...(extra.boons ?? [])],
    });
  const issues = (r: ReturnType<typeof parse>) =>
    r.success ? [] : r.error.issues.map((i) => i.message);

  it('a Harmony prerequisite must name a real motif, and never the Harmony itself', () => {
    expect(parse({ motifs: [harmony('test_ok', ['deep_roots', 'lifeline'])] }).success).toBe(true);
    expect(
      issues(parse({ motifs: [harmony('test_bad', ['deep_roots', 'no_such_motif'])] })),
    ).toEqual(['motif "test_bad" references unknown "no_such_motif"']);
    expect(issues(parse({ motifs: [harmony('test_self', ['test_self'])] }))).toEqual([
      `motif "test_self" can't require itself`,
    ]);
    // Phase 5b's rule, widened: gated before any draw by a hero, or as an Expedition-only one.
    const plain = harmony('test_plain', ['deep_roots']);
    expect(issues(parse({ motifs: [{ ...plain, requires: { motifs: ['deep_roots'] } }] }))).toEqual(
      ['motif "test_plain" requires motifs: it must be hero-gated or Expedition-only'],
    );
    const kaels = { ...plain, requires: { motifs: ['deep_roots'], hero: 'kael' } };
    expect(parse({ motifs: [kaels] }).success).toBe(true);
  });

  const relic = (triggers: TriggerIn[]) => ({
    id: 'test_relic',
    name: 'Test Relic',
    rarity: 'rare' as const,
    text: 'Test {pct}.',
    flavor: '',
    values: { pct: 10 },
    empowered: { values: { pct: 15 } },
    icon: 'test',
    expedition: true as const,
    triggers,
  });

  it('the trigger lint: a motif names only v, a relic or boon its values; every needs a period', () => {
    const motif = (triggers: TriggerIn[]) => ({
      ...harmony('test_motif', ['deep_roots']),
      triggers,
    });
    const spirit = (amount: number | string): TriggerIn => ({
      on: 'perfectWard',
      effects: [{ kind: 'spirit', amount }],
    });
    expect(parse({ motifs: [motif([spirit('v'), spirit(3)])] }).success).toBe(true);
    expect(issues(parse({ motifs: [motif([spirit('pct')])] }))).toEqual([
      'motif "test_motif": a trigger names unknown "pct"',
    ]);
    expect(parse({ relics: [relic([spirit('pct')])] }).success).toBe(true);
    expect(issues(parse({ relics: [relic([spirit('v')])] }))).toEqual([
      'relic "test_relic": a trigger names unknown "v"',
    ]);
    const boon = {
      id: 'test_boon',
      name: 'Test Boon',
      kind: 'boon' as const,
      text: 'Test.',
      values: { n: 2 },
      fights: 1,
      icon: 'test',
      triggers: [spirit('n')],
    };
    expect(parse({ boons: [boon] }).success).toBe(true);
    expect(issues(parse({ boons: [{ ...boon, triggers: [spirit('m')] }] }))).toEqual([
      'boon "test_boon": a trigger names unknown "m"',
    ]);
    const timer = (t: Partial<TriggerIn>): TriggerIn => ({ ...spirit(1), ...t });
    expect(issues(parse({ motifs: [motif([timer({ on: 'every' })])] }))).toEqual([
      `motif "test_motif": a trigger has a period exactly when it is on 'every'`,
    ]);
    expect(issues(parse({ motifs: [motif([timer({ period: 2 })])] }))).toEqual([
      `motif "test_motif": a trigger has a period exactly when it is on 'every'`,
    ]);
    expect(parse({ motifs: [motif([timer({ on: 'every', period: 'v' })])] }).success).toBe(true);
    expect(issues(parse({ motifs: [motif([timer({ hero: 'nobody' })])] }))).toEqual([
      'motif "test_motif" references unknown "nobody"',
    ]);
  });

  it('a trigger parses with its defaults (the event hero, a heal of life, the event place)', () => {
    const t = TriggerDefSchema.parse({
      on: 'cued',
      effects: [
        { kind: 'heal', pct: 5 },
        { kind: 'damage', amount: 10, radius: 3 },
      ],
    });
    expect(t.effects).toEqual([
      { kind: 'heal', pct: 5, of: 'life', to: 'event' },
      { kind: 'damage', amount: 10, radius: 3, at: 'event' },
    ]);
    expect(() => TriggerDefSchema.parse({ on: 'cued', effects: [] })).toThrow();
    expect(() =>
      TriggerDefSchema.parse({ on: 'nothing', effects: [{ kind: 'spirit', amount: 1 }] }),
    ).toThrow();
  });
});

// ── Fixture content (tests only): pushed onto CONTENT, removed after each test ──────────────

const lengths = {
  motifs: CONTENT.motifs.length,
  relics: CONTENT.relics.length,
  boons: CONTENT.boons.length,
};
afterEach(() => {
  CONTENT.motifs.length = lengths.motifs;
  CONTENT.relics.length = lengths.relics;
  CONTENT.boons.length = lengths.boons;
});

let serial = 0;
function fixtureMotif(
  triggers: TriggerIn[] | undefined,
  extra: { values?: number[]; expedition?: boolean; rarity?: 'common' | 'rare' | 'epic' } = {},
): string {
  const id = `fixture_motif_${++serial}`;
  CONTENT.motifs.push(
    MotifDefSchema.parse({
      id,
      name: `Fixture ${serial}`,
      category: 'silk',
      rarity: extra.rarity ?? 'common',
      values: extra.values ?? [10, 20, 30],
      text: 'Fixture {v}.',
      ...(extra.expedition ? { requires: { expedition: true } } : {}),
      ...(triggers ? { triggers } : {}),
    }),
  );
  return id;
}
function fixtureRelic(
  triggers: TriggerIn[] | undefined,
  extra: {
    rarity?: 'common' | 'rare' | 'legendary' | 'cursed';
    expedition?: boolean;
    values?: Record<string, number>;
    empowered?: Record<string, number>;
  } = {},
): string {
  const id = `fixture_relic_${++serial}`;
  const rarity = extra.rarity ?? 'rare';
  CONTENT.relics.push(
    RelicDefSchema.parse({
      id,
      name: `Fixture Relic ${serial}`,
      rarity,
      text: 'Fixture.',
      ...(rarity === 'cursed' ? { curse: 'A price.' } : {}),
      flavor: '',
      values: extra.values ?? { pct: 10 },
      ...(extra.empowered ? { empowered: { values: extra.empowered } } : {}),
      icon: 'fixture',
      ...(extra.expedition ? { expedition: true } : {}),
      ...(triggers ? { triggers } : {}),
    }),
  );
  return id;
}
function fixtureBoon(triggers: TriggerIn[], values: Record<string, number>): string {
  const id = `fixture_boon_${++serial}`;
  CONTENT.boons.push(
    BoonDefSchema.parse({
      id,
      name: `Fixture Boon ${serial}`,
      kind: 'boon',
      text: 'Fixture.',
      values,
      fights: 1,
      icon: 'fixture',
      triggers,
    }),
  );
  return id;
}

// ── The Expedition-only gate (ground rule 6) ────────────────────────────────────────────────

describe('Expedition-only entries are never offered on a Prelude, before any draw', () => {
  const SEEDS = Array.from({ length: 24 }, (_, i) => i + 1);
  const shopNode = (run: RunState) => {
    const nodes = run.map.rows.flat();
    return nodes.find((n) => n.kind === 'merchant') ?? nodes[0]!;
  };
  const runOf = (seed: number, movements: number) =>
    Run.embark(Run.newRun(seed, undefined, [], [], [], [], undefined, movements));
  const offers = (seed: number, movements: number) => {
    const run = runOf(seed, movements);
    return {
      drafts: [
        Run.makeDraft(run, 'victory', 'common'),
        Run.makeDraft(run, 'elite', 'rare'),
        Run.makeDraft(run, 'boss', 'epic'),
      ],
      shop: Run.makeShop(run, shopNode(run)),
    };
  };
  /**
   * The relics a shop drew. A fixture relic isn't in the content index (built at load), so the
   * shop throws pricing one it drew: that names it as drawn.
   */
  const shopRelics = (seed: number, movements: number): string[] => {
    const run = runOf(seed, movements);
    try {
      return Run.makeShop(run, shopNode(run))
        .filter((i) => i.kind === 'relic')
        .map((i) => i.id);
    } catch (e) {
      const drawn = /Unknown relic "(fixture_relic_\d+)"/.exec(String(e));
      if (!drawn) throw e;
      return [drawn[1]!];
    }
  };

  it('drafts and shops: a Prelude is as without them; an Expedition can offer them', () => {
    const prelude = SEEDS.map((s) => offers(s, 1));
    const motifs = [
      fixtureMotif(undefined, { expedition: true }),
      fixtureMotif(undefined, { expedition: true, rarity: 'rare' }),
      fixtureMotif(undefined, { expedition: true, rarity: 'epic' }),
    ];
    const relics = [
      fixtureRelic(undefined, { expedition: true, rarity: 'common' }),
      fixtureRelic(undefined, { expedition: true, rarity: 'rare' }),
      fixtureRelic(undefined, { expedition: true, rarity: 'legendary' }),
    ];
    // The same Preludes with the entries in CONTENT: byte-equal, so they never reached a draw.
    expect(SEEDS.map((s) => offers(s, 1))).toEqual(prelude);
    const seen = new Set<string>();
    for (const s of SEEDS) {
      const run = runOf(s, 2);
      for (const reason of ['victory', 'elite', 'boss'] as const)
        for (const opt of Run.makeDraft(run, reason, 'common').options) seen.add(opt.motifId);
      for (const id of shopRelics(s, 2)) seen.add(id);
    }
    expect(motifs.filter((id) => seen.has(id)).length).toBeGreaterThan(0);
    expect(relics.filter((id) => seen.has(id)).length).toBeGreaterThan(0);
  });

  it('Discordant Pact never gives a Prelude an Expedition-only cursed relic', () => {
    const pact = [{ id: 'discordant_pact', rank: 1 }];
    const pactOf = (seed: number, movements: number) =>
      Run.embark(Run.newRun(seed, undefined, [], [], pact, [], undefined, movements)).relics.find(
        (r) => r.pact,
      )?.id;
    const prelude = SEEDS.map((s) => pactOf(s, 1));
    const id = fixtureRelic(undefined, { expedition: true, rarity: 'cursed' });
    expect(SEEDS.map((s) => pactOf(s, 1))).toEqual(prelude);
    expect(SEEDS.map((s) => pactOf(s, 2))).toContain(id);
    // A run that doesn't say its route is taken as a Prelude.
    expect(
      Run.playedDissonance({ seed: 1, carried: [], dissonance: pact }).map((l) => l.id),
    ).toEqual(['discordant_pact']);
  });
});

// ── The trigger interpreter (systems/triggers.ts) ────────────────────────────────────────────

/** A sandbox world (default party: Kael, Lyra, Vexis) holding `motif` at `level`. */
function worldWith(config: Partial<SimConfig>): World {
  return createWorld({ seed: 3, encounter: 'sandbox', debug: true, auras: [], ...config });
}
function motifWorld(triggers: TriggerIn[], level = 2, config: Partial<SimConfig> = {}): World {
  return worldWith({ motifs: [{ id: fixtureMotif(triggers), level }], ...config });
}
const heroAt = (w: World, slot: number): Entity => w.entities.get(w.party[slot]!)!;
const weaverOf = (w: World): Entity => w.entities.get(w.weaverId)!;

/** Pushes `events` as this tick's and runs the interpreter; returns what it emitted. */
function tick(w: World, events: SimEvent[], dt = SIM_DT): SimEvent[] {
  w.events.drain();
  const mark = w.events.length;
  for (const e of events) w.events.push(e);
  updateTriggers(w, mark, dt);
  return w.events.drain().slice(events.length);
}
const fired = (out: SimEvent[]) => out.filter((e) => e.type === 'motifTriggered');
/** A probe effect: Resonance worth `v`. */
const RES: TriggerIn['effects'] = [{ kind: 'resonance', amount: 'v' }];

function ev(w: World, type: string, fields: Record<string, unknown>): SimEvent {
  return { type, tick: w.tick, ...fields } as unknown as SimEvent;
}
function addEnemy(w: World, defId: string, x: number, z: number, elite = false): Entity {
  const e = spawnEnemy(w, defId, x, z, { instant: true, elite });
  w.entities.flush();
  return e;
}

describe('the trigger interpreter: arming, resolution and the views (docs/phase-5g.md)', () => {
  it('without a trigger nothing is armed: no internal.triggers, no ledger.triggers', () => {
    const w = worldWith({ motifs: [{ id: fixtureMotif(undefined), level: 1 }] });
    expect('triggers' in w.internal).toBe(false);
    expect('triggers' in w.ledger).toBe(false);
    expect(w.mods.triggers).toBe(NO_MODS.triggers);
  });

  it('a motif trigger arms its clock and tally; v is its value at its level', () => {
    const w = motifWorld([{ on: 'perfectWard', every: 2, effects: RES }], 3);
    const id = w.config.motifs[0]!.id;
    expect(w.mods.triggers).toHaveLength(1);
    expect(w.mods.triggers[0]!.source).toBe(id);
    expect(w.mods.triggers[0]!.def.effects).toEqual([{ kind: 'resonance', amount: 30 }]);
    expect(w.internal.triggers).toEqual({ clocks: [{ readyAt: 0, fired: 0, held: 0, added: 0 }] });
    expect(w.ledger.triggers).toEqual({ [id]: 0 });
  });

  it('a relic names its values (Empowered ones when Empowered), a boon its own; motifs first', () => {
    const relic = fixtureRelic([{ on: 'save', effects: [{ kind: 'spirit', amount: 'pct' }] }], {
      values: { pct: 10 },
      empowered: { pct: 15 },
    });
    const boon = fixtureBoon([{ on: 'save', effects: [{ kind: 'spirit', amount: 'n' }] }], {
      n: 4,
    });
    const motif = fixtureMotif([{ on: 'save', effects: RES }]);
    const plain = worldWith({ motifs: [{ id: motif, level: 1 }], relics: [relic], boons: [boon] });
    expect(plain.mods.triggers.map((t) => t.source)).toEqual([motif, relic, boon]);
    expect(plain.mods.triggers.map((t) => t.def.effects[0])).toEqual([
      { kind: 'resonance', amount: 10 },
      { kind: 'spirit', amount: 10 },
      { kind: 'spirit', amount: 4 },
    ]);
    const empowered = worldWith({ relics: [{ id: relic, empowered: true }] });
    expect(empowered.mods.triggers[0]!.def.effects[0]).toEqual({ kind: 'spirit', amount: 15 });
  });

  it('a fire counts in ledger.triggers and emits motifTriggered with its first target', () => {
    const w = motifWorld([
      { on: 'perfectWard', effects: [{ kind: 'barrier', pct: 10, seconds: 3 }, ...RES] },
    ]);
    const id = w.config.motifs[0]!.id;
    const kael = heroAt(w, 0);
    const out = tick(w, [ev(w, 'perfectWard', { target: kael.id, telegraph: 1, negated: 10 })]);
    expect(fired(out)).toEqual([
      { type: 'motifTriggered', tick: w.tick, source: id, target: kael.id },
    ]);
    expect(w.ledger.triggers).toEqual({ [id]: 1 });
    expect(w.internal.triggers!.clocks[0]!.fired).toBe(1);
    // An effect with nobody to land on: no `target` key at all (absent, never undefined).
    const w2 = motifWorld([{ on: 'crescendoEnd', effects: RES }]);
    const [only] = fired(tick(w2, [ev(w2, 'crescendoEnd', {})]));
    expect(only && 'target' in only).toBe(false);
  });

  it('reads only the events from the mark on, and never the ones its own effects emit', () => {
    const w = motifWorld([
      { on: 'cued', effects: [{ kind: 'damage', amount: 1e6, radius: 30 }] },
      { on: 'enemyKilled', effects: RES },
    ]);
    const id = w.config.motifs[0]!.id;
    const cue = () => ev(w, 'cued', { hero: heroAt(w, 0).id });
    // An event before the mark is never read.
    w.events.drain();
    w.events.push(cue());
    updateTriggers(w, w.events.length, SIM_DT);
    expect(fired(w.events.drain())).toEqual([]);
    // Its damage kills, and the kill is reported, but no pass reads it: not this one, not the next.
    addEnemy(w, 'hollow_chorister', 0, -3);
    const out = tick(w, [cue()]);
    expect(out.some((e) => e.type === 'enemyKilled')).toBe(true);
    expect(fired(out)).toHaveLength(1);
    expect(fired(tick(w, []))).toEqual([]);
    expect(w.ledger.triggers).toEqual({ [id]: 1 });
  });

  it('draws no random number', () => {
    const w = motifWorld([
      { on: 'cued', effects: [{ kind: 'damage', amount: 50, radius: 10 }, ...RES] },
    ]);
    addEnemy(w, 'hollow_chorister', 0, -2);
    const states = () => {
      const out: number[][] = [];
      w.rng.forEach((_, rng) => out.push([...rng.getState()]));
      return out;
    };
    const before = states();
    const out = tick(w, [ev(w, 'cued', { hero: heroAt(w, 1).id })]);
    expect(fired(out)).toHaveLength(1);
    expect(states()).toEqual(before);
  });
});

describe('the trigger interpreter: every event it reacts to', () => {
  type Case = [string, (w: World) => SimEvent, ((w: World) => SimEvent)?];
  const hero = (w: World, slot = 0) => heroAt(w, slot).id;
  const CASES: Case[] = [
    ['perfectWard', (w) => ev(w, 'perfectWard', { target: hero(w), telegraph: 1, negated: 5 })],
    [
      'save',
      (w) =>
        ev(w, 'save', { target: hero(w), cause: 'ward', counterfactualDamage: 5, attack: 'x' }),
    ],
    ['cleansed', (w) => ev(w, 'cleansed', { target: hero(w), removed: 1, clutch: false })],
    [
      'chimeLanded',
      (w) => ev(w, 'chimeLanded', { chime: 1, x: 0, z: 0, radius: 3, cleansed: 0, clutch: false }),
    ],
    ['reeled', (w) => ev(w, 'reeled', { target: hero(w), fromX: 0, fromZ: 0, toX: 1, toZ: 1 })],
    ['glided', (w) => ev(w, 'glided', { fromX: 0, fromZ: 0, toX: 2, toZ: 2 })],
    ['threadAttached', (w) => ev(w, 'threadAttached', { hero: hero(w), slot: 0 })],
    ['threadSnapped', (w) => ev(w, 'threadSnapped', { target: hero(w) })],
    [
      'techniqueCast',
      (w) => ev(w, 'techniqueCast', { technique: 'ward', target: hero(w), x: 0, z: 0 }),
    ],
    [
      'shieldBroken',
      (w) => ev(w, 'shieldBroken', { target: hero(w), shield: 'ward' }),
      (w) =>
        ev(w, 'shieldBroken', {
          target: addEnemy(w, 'hollow_chorister', 0, -5).id,
          shield: 'discord',
        }),
    ],
    [
      'damageTaken',
      (w) => ev(w, 'damageTaken', damage(w.weaverId, 20)),
      (w) => ev(w, 'damageTaken', damage(hero(w), 20)),
    ],
    [
      'abilityUsed',
      (w) =>
        ev(w, 'abilityUsed', {
          source: hero(w),
          ability: 'challenge',
          name: 'C',
          x: 0,
          z: 0,
          radius: 6,
        }),
      (w) =>
        ev(w, 'abilityUsed', {
          source: w.weaverId,
          ability: 'riposteBloom',
          name: 'R',
          x: 0,
          z: 0,
          radius: 4,
        }),
    ],
    ['cued', (w) => ev(w, 'cued', { hero: hero(w) })],
    ['crescendoStart', (w) => ev(w, 'crescendoStart', { calling: 'Sunrise', duration: 8 })],
    ['crescendoEnd', (w) => ev(w, 'crescendoEnd', {})],
    ['allyDowned', (w) => ev(w, 'allyDowned', { hero: hero(w) })],
    ['revived', (w) => ev(w, 'revived', { hero: hero(w) })],
    ['parried', (w) => ev(w, 'parried', { hero: hero(w), attacker: 1, negated: 10 })],
    ['summonFell', (w) => ev(w, 'summonFell', { owner: hero(w), summon: 9999, kind: 'sapling' })],
    [
      'enemyKilled',
      (w) =>
        ev(w, 'enemyKilled', { enemy: 9999, defId: 'bell_brute', killer: hero(w), x: 0, z: 0 }),
    ],
  ];
  function damage(target: number, amount: number) {
    return {
      target,
      source: null,
      amount,
      absorbed: 0,
      amplified: 0,
      aura: 0,
      radiance: 0,
      eclipse: 0,
      crit: false,
      telegraph: null,
      hit: 'hit',
    };
  }

  for (const [on, make, skipped] of CASES)
    it(`on ${on}`, () => {
      const w = motifWorld([{ on: on as TriggerIn['on'], effects: RES }]);
      const w0 = weaverOf(w).weaver!.resonance;
      expect(fired(tick(w, [make(w)]))).toHaveLength(1);
      expect(weaverOf(w).weaver!.resonance).toBe(w0 + 20);
      // Another event type never fires it.
      const other = on === 'cued' ? 'revived' : 'cued';
      expect(fired(tick(w, [ev(w, other, { hero: hero(w) })]))).toHaveLength(0);
      if (skipped) expect(fired(tick(w, [skipped(w)])), `${on} skipped`).toHaveLength(0);
    });

  it('on every: each period its conditions held, in a fight', () => {
    const w = motifWorld([{ on: 'every', period: 'v', thread: 'mend', effects: RES }], 1);
    const steps = (seconds: number) => {
      let n = 0;
      for (let i = 0; i < Math.round(seconds / SIM_DT); i++) n += fired(tick(w, [])).length;
      return n;
    };
    // No Thread: its condition fails, so its 10 s never run.
    expect(steps(12)).toBe(0);
    weaverOf(w).weaver!.threadSlot = 0;
    expect(steps(9.9)).toBe(0);
    expect(steps(0.2)).toBe(1);
    expect(steps(20)).toBe(2);
    w.encounter.status = 'victory';
    expect(steps(12)).toBe(0);
  });
});

describe('the trigger interpreter: every condition and limit', () => {
  const run = (w: World, e: SimEvent) => fired(tick(w, [e])).length;

  it('hero: the event hero, by content id', () => {
    const w = motifWorld([{ on: 'cued', hero: 'lyra', effects: RES }]);
    expect(run(w, ev(w, 'cued', { hero: heroAt(w, 0).id }))).toBe(0);
    expect(run(w, ev(w, 'cued', { hero: heroAt(w, 1).id }))).toBe(1);
  });

  it('technique, ability, shield, summon', () => {
    const t = motifWorld([{ on: 'techniqueCast', technique: 'ward', effects: RES }]);
    const cast = (technique: string) =>
      ev(t, 'techniqueCast', { technique, target: heroAt(t, 0).id, x: 0, z: 0 });
    expect([run(t, cast('chime')), run(t, cast('ward'))]).toEqual([0, 1]);
    const a = motifWorld([{ on: 'abilityUsed', ability: 'challenge', effects: RES }]);
    const used = (ability: string) =>
      ev(a, 'abilityUsed', { source: heroAt(a, 0).id, ability, name: 'x', x: 0, z: 0, radius: 1 });
    expect([run(a, used('shieldBash')), run(a, used('challenge'))]).toEqual([0, 1]);
    const s = motifWorld([{ on: 'shieldBroken', shield: 'ward', effects: RES }]);
    const broke = (shield: string) => ev(s, 'shieldBroken', { target: heroAt(s, 0).id, shield });
    expect([run(s, broke('overshield')), run(s, broke('ward'))]).toEqual([0, 1]);
    const f = motifWorld([{ on: 'summonFell', summon: 'sapling', effects: RES }]);
    const fell = (kind: string) => ev(f, 'summonFell', { owner: heroAt(f, 0).id, summon: 1, kind });
    expect([run(f, fell('ancient')), run(f, fell('sapling'))]).toEqual([0, 1]);
  });

  it('thread: the Thread on a hero, in its mode', () => {
    const w = motifWorld([{ on: 'cued', thread: 'empower', effects: RES }]);
    const cue = () => ev(w, 'cued', { hero: heroAt(w, 0).id });
    expect(run(w, cue())).toBe(0);
    const ww = weaverOf(w).weaver!;
    ww.threadSlot = 1;
    expect(run(w, cue())).toBe(0);
    ww.threadMode = 'empower';
    expect(run(w, cue())).toBe(1);
  });

  it('crescendo: only while one plays', () => {
    const w = motifWorld([
      { on: 'perfectWard', crescendo: true, effects: [{ kind: 'spirit', amount: 1 }] },
    ]);
    const p = () => ev(w, 'perfectWard', { target: heroAt(w, 0).id, telegraph: 1, negated: 1 });
    expect(run(w, p())).toBe(0);
    weaverOf(w).weaver!.crescendo = 5;
    expect(run(w, p())).toBe(1);
  });

  it('cueWithin: another hero Cued within s before', () => {
    const w = motifWorld([{ on: 'cued', cueWithin: 4, effects: RES }]);
    const cue = (slot: number) => ev(w, 'cued', { hero: heroAt(w, slot).id });
    expect(run(w, cue(0))).toBe(0);
    expect(run(w, cue(0))).toBe(0);
    w.time += 3;
    expect(run(w, cue(1))).toBe(1);
    w.time += 4.5;
    expect(run(w, cue(2))).toBe(0);
    // Two Cues in one tick, long after the last: the second reads the first.
    w.time += 10;
    expect(fired(tick(w, [cue(0), cue(1)]))).toHaveLength(1);
  });

  it('clutch and removed', () => {
    const w = motifWorld([{ on: 'cleansed', clutch: true, removed: true, effects: RES }]);
    const c = (removed: number, clutch: boolean) =>
      ev(w, 'cleansed', { target: heroAt(w, 0).id, removed, clutch });
    expect([run(w, c(1, false)), run(w, c(0, true)), run(w, c(2, true))]).toEqual([0, 0, 1]);
    const l = motifWorld([{ on: 'chimeLanded', clutch: true, effects: RES }]);
    const land = (clutch: boolean) =>
      ev(l, 'chimeLanded', { chime: 1, x: 0, z: 0, radius: 3, cleansed: 1, clutch });
    expect([run(l, land(false)), run(l, land(true))]).toEqual([0, 1]);
  });

  it("role: the slain enemy's content role", () => {
    const w = motifWorld([{ on: 'enemyKilled', role: 'brute', effects: RES }]);
    const kill = (defId: string) =>
      ev(w, 'enemyKilled', { enemy: 1, defId, killer: null, x: 0, z: 0 });
    expect([run(w, kill('hollow_chorister')), run(w, kill('bell_brute'))]).toEqual([0, 1]);
  });

  it('every: seconds between fires; perFight: fires a fight', () => {
    const w = motifWorld([{ on: 'cued', every: 3, effects: RES }]);
    const cue = () => ev(w, 'cued', { hero: heroAt(w, 0).id });
    expect([run(w, cue()), run(w, cue())]).toEqual([1, 0]);
    w.time += 2.9;
    expect(run(w, cue())).toBe(0);
    w.time += 0.2;
    expect(run(w, cue())).toBe(1);
    const p = motifWorld([{ on: 'cued', perFight: 2, effects: RES }]);
    const c = () => ev(p, 'cued', { hero: heroAt(p, 0).id });
    expect([run(p, c()), run(p, c()), run(p, c())]).toEqual([1, 1, 0]);
  });
});

describe('the trigger interpreter: every effect and target', () => {
  const cue = (w: World, slot = 0) => ev(w, 'cued', { hero: heroAt(w, slot).id });

  it('barrier: an overshield, the Weaver’s; never over a hero’s own or a bigger one', () => {
    const w = motifWorld([{ on: 'cued', effects: [{ kind: 'barrier', pct: 'v', seconds: 3 }] }]);
    const kael = heroAt(w, 0);
    tick(w, [cue(w)]);
    const s = kael.health!.shields.find((x) => x.kind === 'overshield')!;
    expect(s.amount).toBeCloseTo(kael.health!.maxHp * 0.2, 9);
    expect(s.fromWeaver).toBe(true);
    expect(s.expiresAt).toBeCloseTo(w.time + 3, 9);
    s.amount = 1e6;
    tick(w, [cue(w)]);
    expect(kael.health!.shields.find((x) => x.kind === 'overshield')!.amount).toBe(1e6);
    s.fromWeaver = false;
    s.amount = 1;
    tick(w, [cue(w)]);
    expect(kael.health!.shields.find((x) => x.kind === 'overshield')!.amount).toBe(1);
  });

  it('heal: of their life, or of the event’s amount (to the threaded hero)', () => {
    const w = motifWorld([
      { on: 'cued', effects: [{ kind: 'heal', pct: 'v' }] },
      { on: 'damageTaken', effects: [{ kind: 'heal', pct: 50, of: 'event', to: 'threaded' }] },
    ]);
    const kael = heroAt(w, 0);
    const lyra = heroAt(w, 1);
    kael.health!.hp = 1;
    lyra.health!.hp = 1;
    tick(w, [cue(w)]);
    expect(kael.health!.hp).toBeCloseTo(1 + kael.health!.maxHp * 0.2, 9);
    weaverOf(w).weaver!.threadSlot = 1;
    tick(w, [
      ev(w, 'damageTaken', {
        target: w.weaverId,
        source: null,
        amount: 40,
        absorbed: 0,
        amplified: 0,
        aura: 0,
        radiance: 0,
        eclipse: 0,
        crit: false,
        telegraph: null,
        hit: 'hit',
      }),
    ]);
    expect(lyra.health!.hp).toBeCloseTo(21, 9);
  });

  it('spirit: back, never above the unreserved pool', () => {
    const w = motifWorld([{ on: 'cued', effects: [{ kind: 'spirit', amount: 'v' }] }]);
    const ww = weaverOf(w).weaver!;
    ww.spirit = 10;
    tick(w, [cue(w)]);
    expect(ww.spirit).toBe(30);
    ww.spirit = ww.maxSpirit - ww.reservedSpirit - 1;
    tick(w, [cue(w)]);
    expect(ww.spirit).toBe(ww.maxSpirit - ww.reservedSpirit);
  });

  it('solo: charge to the others; a full one is ready; never during a Solo', () => {
    const w = motifWorld([{ on: 'cued', effects: [{ kind: 'solo', pct: 'v', to: 'others' }] }]);
    const [kael, lyra, vexis] = [0, 1, 2].map((s) => heroAt(w, s));
    lyra!.hero!.solo = 90;
    vexis!.hero!.soloActive = 2;
    const out = tick(w, [cue(w)]);
    expect([kael!.hero!.solo, lyra!.hero!.solo, vexis!.hero!.solo]).toEqual([0, 100, 0]);
    expect(out.filter((e) => e.type === 'soloReady')).toEqual([
      { type: 'soloReady', tick: w.tick, hero: lyra!.id },
    ]);
  });

  it('damage: every enemy within reach, or the nearest n; or a share of Riposte Bloom’s power', () => {
    const w = motifWorld([
      { on: 'cued', effects: [{ kind: 'damage', amount: 'v', radius: 3, nearest: 1 }] },
      { on: 'revived', effects: [{ kind: 'damage', amount: 50, of: 'riposte', radius: 30 }] },
    ]);
    const kael = heroAt(w, 0);
    const near = addEnemy(w, 'bell_brute', kael.x, kael.z - 2);
    const nearer = addEnemy(w, 'bell_brute', kael.x, kael.z - 1);
    const far = addEnemy(w, 'bell_brute', kael.x, kael.z - 12);
    const hp = (e: Entity) => e.health!.maxHp - e.health!.hp;
    const amplified = w.ledger.amplified;
    tick(w, [cue(w)]);
    expect([hp(nearer), hp(near), hp(far)]).toEqual([20, 0, 0]);
    expect(w.ledger.amplified - amplified).toBe(20);
    // Riposte Bloom's power (here 0: no Riposte Bloom), so nothing is dealt.
    tick(w, [ev(w, 'revived', { hero: kael.id })]);
    expect(hp(far)).toBe(0);
    const r = worldWith({
      motifs: [
        { id: 'riposte_bloom', level: 1 },
        {
          id: fixtureMotif([
            { on: 'revived', effects: [{ kind: 'damage', amount: 50, of: 'riposte', radius: 30 }] },
          ]),
          level: 1,
        },
      ],
    });
    const enemy = addEnemy(r, 'bell_brute', 0, -3);
    tick(r, [ev(r, 'revived', { hero: heroAt(r, 0).id })]);
    expect(hp(enemy)).toBeCloseTo(r.mods.ripostePower / 2, 9);
  });

  it('status: on ordinary enemies only, within a radius or the Chime’s own', () => {
    const w = motifWorld([
      {
        on: 'chimeLanded',
        effects: [{ kind: 'status', status: 'stun', seconds: 'v', radius: 'event' }],
      },
    ]);
    const ordinary = addEnemy(w, 'hollow_chorister', 0, -2);
    const elite = addEnemy(w, 'hollow_chorister', 0, -2.5, true);
    const out = addEnemy(w, 'hollow_chorister', 0, -9);
    tick(w, [
      ev(w, 'chimeLanded', { chime: 1, x: 0, z: -2, radius: 3, cleansed: 0, clutch: false }),
    ]);
    const stunned = (e: Entity) => e.health!.statuses.find((s) => s.id === 'stun')?.remaining ?? 0;
    expect([stunned(ordinary), stunned(elite), stunned(out)]).toEqual([20, 0, 0]);
  });

  it('cooldown: the techniques recover; a Ward charge comes back at 0', () => {
    const w = motifWorld([
      { on: 'cued', effects: [{ kind: 'cooldown', techniques: ['chime', 'ward'], seconds: 3 }] },
    ]);
    const ww = weaverOf(w).weaver!;
    ww.cooldowns.chime = 5;
    ww.cooldowns.ward = 2;
    ww.wardCharges = 0;
    tick(w, [cue(w)]);
    expect(ww.cooldowns.chime).toBe(2);
    expect(ww.cooldowns.ward).toBe(0);
    expect(ww.wardCharges).toBe(1);
  });

  it('ability: the event hero’s ability by id recovers', () => {
    const w = motifWorld([
      { on: 'techniqueCast', effects: [{ kind: 'ability', ability: 'challenge', seconds: 'v' }] },
    ]);
    const kael = heroAt(w, 0);
    const lyra = heroAt(w, 1);
    kael.hero!.abilityCooldowns = [5, 30];
    lyra.hero!.abilityCooldowns = [5, 30];
    tick(w, [ev(w, 'techniqueCast', { technique: 'ward', target: kael.id, x: 0, z: 0 })]);
    tick(w, [ev(w, 'techniqueCast', { technique: 'ward', target: lyra.id, x: 0, z: 0 })]);
    // Kael's second ability is his Challenge; Lyra has none, so hers stand.
    expect(kael.hero!.abilityCooldowns).toEqual([5, 10]);
    expect(lyra.hero!.abilityCooldowns).toEqual([5, 30]);
  });

  it('empower: for s, Thread or not (afterglowUntil; the later time stands)', () => {
    const w = motifWorld([{ on: 'cued', effects: [{ kind: 'empower', seconds: 'v' }] }]);
    const kael = heroAt(w, 0);
    expect(empowerBonus(w, kael).more).toBe(0);
    tick(w, [cue(w)]);
    expect(kael.hero!.afterglowUntil).toBeCloseTo(w.time + 20, 9);
    expect(empowerBonus(w, kael).more).toBeGreaterThan(0);
    kael.hero!.afterglowUntil = w.time + 100;
    tick(w, [cue(w)]);
    expect(kael.hero!.afterglowUntil).toBeCloseTo(w.time + 100, 9);
  });

  it('crescendo: a playing Crescendo lasts longer, capped each Crescendo', () => {
    const w = motifWorld(
      [{ on: 'perfectWard', effects: [{ kind: 'crescendo', seconds: 1, cap: 'v' }] }],
      1,
    );
    const ww = weaverOf(w).weaver!;
    const p = () => ev(w, 'perfectWard', { target: heroAt(w, 0).id, telegraph: 1, negated: 1 });
    tick(w, [p()]);
    expect(ww.crescendo).toBe(0);
    ww.crescendo = 5;
    for (let i = 0; i < 12; i++) tick(w, [p()]);
    expect(ww.crescendo).toBe(15);
    tick(w, [ev(w, 'crescendoStart', { calling: 'Sunrise', duration: 8 }), p()]);
    expect(ww.crescendo).toBe(16);
  });

  it('targets: all, near, nearestOther, neediest, threaded, inField', () => {
    const w = motifWorld([
      { on: 'cued', effects: [{ kind: 'solo', pct: 1, to: 'all' }] },
      { on: 'revived', effects: [{ kind: 'solo', pct: 10, to: 'near', radius: 0.5 }] },
      { on: 'save', effects: [{ kind: 'solo', pct: 100, to: 'nearestOther', radius: 50 }] },
      { on: 'chimeLanded', effects: [{ kind: 'solo', pct: 30, to: 'neediest', inField: true }] },
      { on: 'glided', effects: [{ kind: 'solo', pct: 7, to: 'threaded' }] },
    ]);
    const [kael, lyra, vexis] = [0, 1, 2].map((s) => heroAt(w, s)) as [Entity, Entity, Entity];
    const solos = () => [kael, lyra, vexis].map((h) => h.hero!.solo);
    tick(w, [cue(w)]);
    expect(solos()).toEqual([1, 1, 1]);
    tick(w, [ev(w, 'revived', { hero: lyra.id })]);
    expect(solos()).toEqual([1, 11, 1]);
    // Nearest other to Kael, by distance then entity id.
    const dk = (h: Entity) => (h.x - kael.x) ** 2 + (h.z - kael.z) ** 2;
    const nearest = dk(lyra) <= dk(vexis) ? lyra : vexis;
    tick(w, [
      ev(w, 'save', { target: kael.id, cause: 'ward', counterfactualDamage: 1, attack: 'x' }),
    ]);
    expect(nearest.hero!.solo).toBe(100);
    for (const h of [kael, lyra, vexis]) h.hero!.solo = 0;
    // The neediest: the least of their life (a share), never the threaded hero; inField only.
    weaverOf(w).weaver!.threadSlot = 2;
    kael.health!.hp = kael.health!.maxHp * 0.1;
    vexis.health!.hp = vexis.health!.maxHp * 0.05;
    lyra.health!.hp = lyra.health!.maxHp * 0.5;
    const chime = () =>
      ev(w, 'chimeLanded', { chime: 1, x: 0, z: 0, radius: 3, cleansed: 0, clutch: false });
    tick(w, [chime()]);
    expect(solos()).toEqual([30, 0, 0]);
    kael.hero!.inField = false;
    tick(w, [chime()]);
    expect(solos()).toEqual([30, 30, 0]);
    // The threaded hero.
    tick(w, [ev(w, 'glided', { fromX: 0, fromZ: 0, toX: 1, toZ: 1 })]);
    expect(solos()).toEqual([30, 30, 7]);
  });

  it('a downed hero is no one’s target', () => {
    const w = motifWorld([{ on: 'cued', effects: [{ kind: 'solo', pct: 5, to: 'all' }] }]);
    heroAt(w, 1).health!.downed = true;
    tick(w, [cue(w)]);
    expect([0, 1, 2].map((s) => heroAt(w, s).hero!.solo)).toEqual([5, 0, 5]);
  });
});

describe('the trigger system in a stepped sim', () => {
  it('a Ward cast fires a techniqueCast trigger the same tick; with none held, nothing moves', () => {
    const id = fixtureMotif([
      {
        on: 'techniqueCast',
        technique: 'ward',
        effects: [{ kind: 'barrier', pct: 10, seconds: 3, to: 'others' }],
      },
    ]);
    const sim = createSim({
      seed: 5,
      encounter: 'sandbox',
      debug: true,
      auras: [],
      motifs: [{ id, level: 1 }],
    });
    sim.step([{ t: 'tech', id: 'ward', slot: 0 }]);
    const events = sim.drainEvents();
    expect(events.filter((e) => e.type === 'motifTriggered')).toHaveLength(1);
    const others = [1, 2].map((s) => sim.state.entities.get(sim.state.party[s]!)!);
    for (const h of others)
      expect(h.health!.shields.some((s) => s.kind === 'overshield' && s.fromWeaver)).toBe(true);
    expect(sim.state.ledger.triggers).toEqual({ [id]: 1 });
  });
});

// ── `triggers` in EncounterStats, run totals and the run save ───────────────────────────────

describe('triggers in the ledger, EncounterStats and the save (ground rule 9)', () => {
  const node = {
    id: 'r0c0',
    row: 0,
    x: 0.5,
    kind: 'skirmish' as const,
    encounterId: 'first_light',
    eventId: null,
    next: [],
    reward: { draft: 'common' as const, heal: 0, aether: 20, relics: 0, threat: 1, text: '' },
    movement: 1,
  };
  const outcome = (triggers?: Record<string, number>) => ({
    encounterId: 'first_light',
    outcome: 'victory' as const,
    duration: 40,
    ledger: { ...emptyLedger(), ...(triggers ? { triggers } : {}) },
    party: [],
    withoutYou: null,
  });

  it('a fight that held none has no key; one that did keeps its tally, summed over the run', () => {
    const none = Run.summarize(node, outcome());
    expect('triggers' in none.stats).toBe(false);
    const one = Run.summarize(node, outcome({ a: 2, b: 0 }));
    expect(one.stats.triggers).toEqual({ a: 2, b: 0 });
    const run = Run.newRun(7);
    const totals = Run.runTotals({
      ...run,
      results: [none, one, Run.summarize(node, outcome({ a: 1, c: 3 }))],
    });
    expect(totals.triggers).toEqual({ a: 3, b: 0, c: 3 });
    expect('triggers' in Run.runTotals({ ...run, results: [none] })).toBe(false);
  });

  it('the run save keeps it, and a result saved without it loads without it', () => {
    const run = Run.newRun(7);
    const results = [Run.summarize(node, outcome({ a: 2 })), Run.summarize(node, outcome())];
    const parsed = RunStateSchema.parse(JSON.parse(JSON.stringify({ ...run, results })));
    expect(parsed.results[0]!.stats.triggers).toEqual({ a: 2 });
    expect('triggers' in parsed.results[1]!.stats).toBe(false);
  });
});

// ── The Thread's contact test (N1) ───────────────────────────────────────────────────────────

describe('onThread and touchingThread (sim/fill/threadContact.ts)', () => {
  it('the segment from the Weaver to the threaded hero, against each standing enemy’s radius', () => {
    const w = worldWith({});
    const weaver = weaverOf(w);
    const kael = heroAt(w, 0);
    const midX = (weaver.x + kael.x) / 2;
    const midZ = (weaver.z + kael.z) / 2;
    const on = addEnemy(w, 'hollow_chorister', midX, midZ);
    const off = addEnemy(w, 'hollow_chorister', midX + 20, midZ);
    expect(onThread(w, on)).toBe(false);
    expect(touchingThread(w)).toEqual([]);
    weaverOf(w).weaver!.threadSlot = 0;
    expect([onThread(w, on), onThread(w, off), onThread(w, kael)]).toEqual([true, false, false]);
    expect(touchingThread(w).map((e) => e.id)).toEqual([on.id]);
    on.health!.dead = true;
    expect(touchingThread(w)).toEqual([]);
  });
});

// ── Load order: each stub file can be loaded first (its import rule, silk.ts header) ────────

describe('each src/sim/fill file can be loaded first', () => {
  for (const name of [
    'silk',
    'choir',
    'aegis',
    'finale',
    'bond',
    'harmonies',
    'relics',
    'threadContact',
  ])
    it(`fill/${name}.ts, then the sim`, async () => {
      vi.resetModules();
      await import(`../../src/sim/fill/${name}.ts`);
      const sim = await import('../../src/sim');
      const s = sim.createSim({ seed: 1, encounter: 'first_light' });
      for (let i = 0; i < 30; i++) s.step();
      expect(s.hash()).toMatch(/^[0-9a-f]{16}$/);
    });
});
