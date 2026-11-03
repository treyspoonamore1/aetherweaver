/**
 * Phase 4g UI: the Loom's hub and its Atelier (docs/phase-4g.md). Each station is lit by its
 * system's own gate (the meta's and the stores': a Rank, a first Bond rank-up, a first Deed,
 * Dissonance's win, Skip the unlocks) and says when it opens while it's dark; what waits there is
 * the Title's old badges and the profile's numbers; intros are recorded as `station:<id>`; the
 * Atelier's shelves are `shop()`'s, bought and worn through the profile store; the rank-up card
 * adds the Atelier at its Rank; and the arrows move by where the stations stand.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { COLOR_VISIONS, deltaE, simulateVision } from '../src/app/colorVision';
import { useProfile } from '../src/app/profileStore';
import { useRun } from '../src/app/runStore';
import { useSettings } from '../src/app/settings';
import { CONTENT, heroDef } from '../src/content';
import { ASTROLABE_RANK, astrolabePoints } from '../src/meta/astrolabe';
import { DEED_POINTS_MAX, deedPoints } from '../src/meta/deeds';
import { buy, shopItems } from '../src/meta/loom';
import { rosterHeroes } from '../src/meta/bonds';

/**
 * The Bonded heroes a profile with no recruit sees (docs/phase-5b.md): the starters, whatever
 * Brann's Bonds in content. With unlockAll off, the Loom reads as it did before the roster.
 */
const bondedHeroes = () => rosterHeroes({}, false);
import { RANK_XP, UNLOCKS, newProfile, rankOf, type Profile } from '../src/meta/profile';
import * as Run from '../src/meta/run';
import { PATHS } from '../src/ui/kit/iconPaths';
import {
  OWN_RIBBONS,
  OWN_ROBE,
  STARLIGHT_LOOK,
  STATION_LOOK,
  ribbonColors,
  robeColors,
  threadColors,
} from '../src/ui/kit/loomLook';
import { nextInDirection, type Box } from '../src/ui/kit/menuNav';
import { ribbonHex } from '../src/render/keepsakeCues';
import { spendLine } from '../src/ui/screens/astrolabeModel';
import {
  STATIONS,
  WELCOME,
  affordable,
  atelierShelves,
  atelierUnlock,
  bondRanksLine,
  buyLine,
  darkSaid,
  freshLine,
  materialsShort,
  starlightAbout,
  gateLine,
  introId,
  shelfItem,
  stationIntro,
  stationViews,
  wearLine,
  weaverPlate,
  welcomeDue,
  welcomeIntro,
  type StationView,
} from '../src/ui/screens/loomModel';

const S = CONTENT.starlight;
const RULES = CONTENT.dissonanceRules;
const RELIQUARY_RANK = CONTENT.reliquary.slotRanks[0]!;

/** A profile at a Rank (a little into it). */
const at = (rank: number, extra: Partial<Profile> = {}): Profile => ({
  ...newProfile(3),
  xp: RANK_XP[rank - 1]! + 10,
  ...extra,
});
const station = (views: StationView[], id: string) => views.find((v) => v.id === id)!;
const lit = (views: StationView[]) => views.filter((v) => v.open).map((v) => v.id);
const skipUnlocks = (on: boolean) =>
  useSettings.getState().update((s) => ({ ...s, unlockAll: on }));
const profile = () => useProfile.getState().profile;

beforeEach(() => {
  useSettings.getState().reset();
  useProfile.getState().resetProgress();
  useRun.getState().closeRun();
});

describe('the Loom’s stations', () => {
  it('a new Weaver: the Gate, the Grounds and the Codex lit; the rest dark, saying what and when', () => {
    const views = stationViews(newProfile(), false);
    expect(views.map((v) => v.id)).toEqual(STATIONS);
    expect(lit(views)).toEqual(['gate', 'training', 'codex']);
    // What it is, then when it opens, every number content's.
    expect(station(views, 'astrolabe').line).toBe(
      `A star map of bonuses. Opens at Weaver Rank ${ASTROLABE_RANK}.`,
    );
    expect(station(views, 'atelier').line).toBe(
      `The Starlight shop. Opens at Weaver Rank ${S.atelierRank}.`,
    );
    expect(station(views, 'reliquary').line).toBe(
      `Relics kept between runs. Opens at Weaver Rank ${RELIQUARY_RANK}.`,
    );
    // Bonds: the heroes who earn Bond XP, by name, and the rank that opens it (a rank above 1).
    const heroes = bondedHeroes().map((h) => heroDef(h).name);
    expect(heroes.length).toBeGreaterThan(1);
    expect(station(views, 'bonds').line).toBe(
      `Your heroes, ${heroes.slice(0, -1).join(', ')} and ${heroes.at(-1)}, earn Bond XP every fight. Opens when one reaches Bond rank 2.`,
    );
    expect(station(views, 'deeds').line).toBe(
      'Deeds are feats within a run, like winning one. Opens with your first Deed.',
    );
    // The first Deed is winning a run, as the line says.
    expect(CONTENT.deeds[0]!.test).toBe('win');
    expect(station(views, 'dissonance').line).toBe(
      `Optional difficulty, for the endgame. Opens with a win at Weaver Rank ${RULES.openRank} or above.`,
    );
    // Dark stations have nothing waiting.
    for (const v of views.filter((x) => !x.open)) expect(v.badge).toBeNull();
  });

  it('each lights at its own system’s gate, and not a step before', () => {
    const open = (p: Profile, id: string) => station(stationViews(p, false), id).open;
    for (const [id, rank] of [
      ['astrolabe', ASTROLABE_RANK],
      ['atelier', S.atelierRank],
      ['reliquary', RELIQUARY_RANK],
    ] as const) {
      expect(open(at(rank - 1), id), `${id} below its Rank`).toBe(false);
      expect(open(at(rank), id), `${id} at its Rank`).toBe(true);
    }
    // Bonds: a hero's first Bond rank-up (rank 2), any hero.
    const second = CONTENT.bondRules.ranks[1]!;
    const bond = (xp: number) => ({
      xp,
      talents: [null, null, null],
      solo: 'default' as const,
      seen: {},
    });
    expect(open(at(1, { bonds: { lyra: bond(second - 1) } }), 'bonds')).toBe(false);
    expect(open(at(1, { bonds: { lyra: bond(second) } }), 'bonds')).toBe(true);
    // The Hall: a first Deed.
    expect(open(at(1, { deeds: [CONTENT.deeds[0]!.id] }), 'deeds')).toBe(true);
    // Dissonance: its win, as the store records it; at its Rank it says the next win opens it.
    const ready = at(RULES.openRank);
    expect(open(ready, 'dissonance')).toBe(false);
    expect(station(stationViews(ready, false), 'dissonance').line).toBe(
      'Optional difficulty, for the endgame. Opens with your next win.',
    );
    const won = { ...ready, dissonance: { open: true, levels: [], best: {} } };
    expect(open(won, 'dissonance')).toBe(true);
  });

  it('Skip the unlocks lights every station', () => {
    expect(lit(stationViews(newProfile(), true))).toEqual(STATIONS);
    // Each one new, named as a sentence names it.
    const welcomed = { ...newProfile(), introduced: WELCOME.map(introId) };
    expect(freshLine(stationViews(welcomed, true))).toBe(
      'The Astrolabe, the Atelier, the Reliquary, Bonds, the Hall of Deeds and Dissonance have lit up: visit to see what’s there.',
    );
    expect(stationIntro('deeds').tryIt).toBe('Try it: open the Hall of Deeds');
    expect(darkSaid('deeds', 1)).toBe(
      'The Hall of Deeds is dark. Deeds are feats within a run, like winning one. Opens with your first Deed.',
    );
  });

  it('what waits there: the Title’s badges, what Starlight buys, Deeds earned, the best won', () => {
    const deeds = CONTENT.deeds.slice(0, 3).map((d) => d.id);
    const p = at(12, {
      astrolabe: ['silk_t1', 'silk_t2'],
      deeds,
      starlight: 130,
      reliquary: { ...newProfile().reliquary, shards: 24, tears: 1 },
      dissonance: { open: true, levels: [], best: { none: 9, luminary: 14 } },
    });
    const shop = shopItems(p, rankOf(p.xp), false);
    const views = stationViews(p, false, { shop });
    const points = astrolabePoints(12, false, deedPoints(deeds));
    expect(station(views, 'astrolabe').badge).toBe(spendLine(points - 2));
    // Named: "24 Shards · 1 Tear", each hero "Kael 1 · Lyra 1 · Vexis 1".
    expect(station(views, 'reliquary').badge).toBe('24 Shards · 1 Tear');
    expect(materialsShort({ shards: 1, tears: 0 })).toBe('1 Shard');
    expect(materialsShort({ shards: 0, tears: 3 })).toBe('3 Tears');
    expect(materialsShort({ shards: 0, tears: 0 })).toBeNull();
    expect(
      bondRanksLine({
        kael: {
          xp: CONTENT.bondRules.ranks[1]!,
          talents: [null, null, null],
          solo: 'default',
          seen: {},
        },
      }),
    ).toBe(
      bondedHeroes()
        .map((h) => `${heroDef(h).name} ${h === 'kael' ? 2 : 1}`)
        .join(' · '),
    );
    // Out of the Deeds in sight (docs/phase-5a.md): Movement II's two wait until it's met.
    expect(station(views, 'deeds').badge).toBe(
      `3 of ${CONTENT.deeds.filter((d) => !['crimson_crowned', 'pack_leader'].includes(d.id) && !d.hero).length} earned`,
    );
    expect(station(views, 'dissonance').badge).toBe('Best won: 14');
    const n = shop.filter(
      (i) => i.state === 'buyable' && i.price !== null && i.price <= 130,
    ).length;
    expect(n).toBeGreaterThan(0);
    expect(affordable(shop, 130)).toBe(n);
    expect(station(views, 'atelier').badge).toBe(`${n} you can afford`);
    // Nothing to afford, nothing said.
    expect(station(stationViews({ ...p, starlight: 0 }, false, { shop }), 'atelier').badge).toBe(
      null,
    );
  });

  it('the Gate begins a run, or continues the saved one where it stands', () => {
    expect(gateLine(null)).toBe('Begin a run');
    const prep = Run.newRun(7);
    expect(gateLine(prep)).toMatch(/^Continue · .*Prep/);
    const run = Run.embark(prep);
    const along = { ...run, path: run.map.rows.slice(0, 3).map((r) => r[0]!.id) };
    expect(gateLine(along)).toBe(`Continue · step 4 of ${run.map.rows.length}`);
    expect(station(stationViews(newProfile(), false, { run: along }), 'gate').line).toBe(
      gateLine(along),
    );
  });
});

describe('first contact', () => {
  it('a new Weaver’s first visit: the welcome, shared by the Gate, the Grounds and the Codex', () => {
    expect(welcomeDue(profile().introduced)).toBe(true);
    const welcome = welcomeIntro();
    expect(welcome.seen).toEqual(WELCOME.map(introId));
    expect(welcome.seen).toEqual(['station:gate', 'station:training', 'station:codex']);
    expect(welcome.station).toBe('gate');
    expect(welcomeIntro(Run.newRun(1)).tryIt).toMatch(/continue/);
    useProfile.getState().markIntroduced(welcome.seen);
    expect(welcomeDue(profile().introduced)).toBe(false);
    expect(stationViews(profile(), false).some((v) => v.fresh)).toBe(false);
  });

  it('a station that lights up draws the eye until its intro has played', () => {
    useProfile.getState().markIntroduced(WELCOME.map(introId));
    useProfile.getState().award(RANK_XP[S.atelierRank - 1]!);
    let views = stationViews(profile(), false);
    expect(views.filter((v) => v.fresh).map((v) => v.id)).toEqual(['astrolabe', 'atelier']);
    expect(freshLine(views)).toBe(
      'The Astrolabe and the Atelier have lit up: visit to see what’s there.',
    );
    useProfile.getState().markIntroduced(stationIntro('atelier').seen);
    expect(profile().introduced).toContain('station:atelier');
    views = stationViews(profile(), false);
    expect(views.filter((v) => v.fresh).map((v) => v.id)).toEqual(['astrolabe']);
    expect(freshLine(views)).toBe('The Astrolabe has lit up: visit to see what’s there.');
  });

  it('every intro: two or three panels drawn with their station, a Try it, recorded once', () => {
    for (const id of STATIONS) {
      const intro = stationIntro(id);
      expect(intro.panels.length, id).toBeGreaterThanOrEqual(2);
      expect(intro.panels.length, id).toBeLessThanOrEqual(3);
      expect(intro.tryIt).toMatch(/^Try it/);
      if (!WELCOME.includes(id)) {
        expect(intro.station).toBe(id);
        expect(intro.seen).toEqual([`station:${id}`]);
        for (const p of intro.panels) expect(p.art).toEqual([id]);
      }
      for (const p of intro.panels) expect(p.body).not.toMatch(/\{|undefined|NaN/);
    }
  });

  it('each intro says what its words mean, on first use, in content’s numbers', () => {
    const text = (id: Parameters<typeof stationIntro>[0]) =>
      stationIntro(id)
        .panels.map((p) => p.body)
        .join(' ');
    // The welcome: what the drill drills, and what Prep's songs are.
    const welcome = welcomeIntro()
      .panels.map((p) => p.body)
      .join(' ');
    expect(welcome).toMatch(/Ward them just before the blow lands and it’s a Perfect Ward/);
    expect(welcome).toMatch(/Prep, where you choose your songs \(the auras you sing/);
    // The Astrolabe: Deeds' points, and how a star is given back (right-click, or Give back).
    expect(text('astrolabe')).toContain(`up to ${DEED_POINTS_MAX} more`);
    expect(text('astrolabe')).toContain('Hall of Deeds');
    expect(text('astrolabe')).toContain('choose a star you’ve taken and press Give back');
    // The Reliquary: Inscriptions, its materials, and the carry by Rank.
    const rq = CONTENT.reliquary;
    expect(text('reliquary')).toMatch(/Inscriptions, small bonuses/);
    expect(text('reliquary')).toMatch(/Tuning Shards for each fight it won/);
    expect(text('reliquary')).toContain(
      `a Discord Tear for beating its boss with an ${rq.tearGrade}`,
    );
    expect(text('reliquary')).toContain(
      `one from Rank ${rq.slotRanks[0]}, two from ${rq.slotRanks[1]}, three from ${rq.slotRanks[2]}`,
    );
    expect(text('reliquary')).toMatch(
      /Each lends the run its Inscriptions, and the first, attuned, plays its own effect/,
    );
    // Bonds: who earns Bond XP, and what a Solo is.
    for (const h of bondedHeroes()) expect(text('bonds')).toContain(heroDef(h).name);
    expect(text('bonds')).toMatch(/Solo \(a hero’s big move/);
    // The Hall: the Deeds that keep a count.
    expect(text('deeds')).toContain('the Deeds that keep a count');
    // Dissonance: optional difficulty, and what each point pays.
    const d = CONTENT.dissonanceRules;
    expect(stationIntro('dissonance').panels[0]!.heading).toBe('Optional difficulty');
    expect(text('dissonance')).toContain(
      `+${d.xpPerPoint}% Weaver XP and +${d.shardsPerPoint}% Tuning Shards`,
    );
    // The Atelier: a Calling and its mastery, from the first Calling's Rank.
    const first = Math.min(...CONTENT.callings.map((c) => c.unlockRank));
    expect(text('atelier')).toContain(
      `A Calling (a class for the Weaver, chosen in Prep from Rank ${first})`,
    );
  });

  it('the hub says what Starlight is for: where it’s spent, and from when', () => {
    const dark = starlightAbout(1, false);
    expect(dark.line).toBe(`Spent at the Atelier, which opens at Weaver Rank ${S.atelierRank}`);
    expect(dark.tip).toMatch(/every won fight pays it, and every Deed/);
    expect(dark.tip).toContain(`which opens at Weaver Rank ${S.atelierRank}`);
    const open = starlightAbout(S.atelierRank, false);
    expect(open.line).toBeNull();
    expect(open.tip).not.toContain('opens at');
    expect(starlightAbout(1, true).line).toBeNull();
  });

  it('the Atelier’s intro: what Starlight pays and buys, in content’s numbers', () => {
    const text = stationIntro('atelier')
      .panels.map((p) => p.body)
      .join(' ');
    for (const n of [...Object.values(S.fights), S.winBonus, S.variantPrice])
      expect(text).toContain(String(n));
    const looks = [
      ...CONTENT.cosmetics.robes.map((r) => r.price),
      ...CONTENT.cosmetics.threads.map((t) => t.price),
    ];
    expect(text).toContain(`${Math.min(...looks)}–${Math.max(...looks)}`);
    expect(text).toMatch(/Mend’s and Empower’s colours stay/);
  });
});

describe('the Weaver in the hub', () => {
  it('wears her robe’s colours (her own, when none), her ribbons the Thread look’s', () => {
    expect(robeColors(null)).toEqual(OWN_ROBE);
    expect(robeColors('robe_gone')).toEqual(OWN_ROBE);
    for (const r of CONTENT.cosmetics.robes) expect(robeColors(r.id)).toEqual(r.colors);
    expect(ribbonColors(null)).toEqual(OWN_RIBBONS);
    expect(threadColors(null)).toBeNull();
    for (const t of CONTENT.cosmetics.threads)
      expect(ribbonColors(t.id)).toEqual({ filament: t.filament, glow: t.glow });
  });

  it('her ribbons are the fight’s under every colour vision (the look fitted clear of the modes)', () => {
    for (const vision of COLOR_VISIONS)
      for (const id of [null, ...CONTENT.cosmetics.threads.map((t) => t.id)])
        expect(ribbonColors(id, vision), `${id} · ${vision}`).toEqual(ribbonHex(id, vision));
  });

  it('her name plate: her title under her name, her Rank', () => {
    const p = at(6, { look: { robe: null, thread: null, title: 'title_steady_hand' } });
    const plate = weaverPlate(p);
    expect(plate.name).toBe('The Weaver');
    expect(plate.title).toBe(
      CONTENT.cosmetics.titles.find((t) => t.id === 'title_steady_hand')!.text,
    );
    expect(plate.rank).toBe(6);
    expect(weaverPlate(newProfile()).title).toBeNull();
  });
});

describe('the Atelier', () => {
  it('its shelves are shop()’s, in its order: variants, robes, Thread looks, titles', () => {
    const p = at(S.atelierRank);
    const items = shopItems(p, rankOf(p.xp), false);
    const shelves = atelierShelves(items, p.look, p.starlight);
    expect(shelves.map((s) => s.kind)).toEqual(['variant', 'robe', 'thread', 'title']);
    expect(shelves.flatMap((s) => s.items.map((i) => i.item.id))).toEqual(items.map((i) => i.id));
    expect(shelves[0]!.items.map((i) => i.item.id)).toEqual(
      CONTENT.techniqueVariants.map((v) => v.id),
    );
    // The Weaver's own heads each keepsake shelf, worn while nothing else is.
    expect(shelves.map((s) => s.own?.worn ?? null)).toEqual([null, true, true, true]);
  });

  it('buying with Starlight given, a refusal when short, then wearing it: the profile store', () => {
    skipUnlocks(false);
    useProfile.getState().award(RANK_XP[S.atelierRank - 1]!);
    const robe = CONTENT.cosmetics.robes[0]!;
    const before = () =>
      useProfile
        .getState()
        .shop()
        .find((i) => i.id === robe.id)!;
    expect(before().state).toBe('buyable');
    // Short: the store refuses, and the line says how far.
    useProfile.getState().awardStarlight(robe.price - 10);
    let s = shelfItem(before(), profile().look, profile().starlight);
    expect(s.action).toBe('buy');
    expect(s.short).toBe(10);
    const refusal = useProfile.getState().buy(robe.id);
    expect(refusal).not.toBeNull();
    expect(buyLine(before(), refusal, s.short)).toBe(`${robe.name}: ${refusal} 10 more to go.`);
    expect(profile().cosmetics).not.toContain(robe.id);
    // Enough: bought, owned, wearable.
    useProfile.getState().awardStarlight(10);
    expect(useProfile.getState().buy(robe.id)).toBeNull();
    expect(profile().starlight).toBe(0);
    s = shelfItem(before(), profile().look, profile().starlight);
    expect([s.status, s.action, s.worn]).toEqual(['Owned', 'wear', false]);
    // Worn: the shelf says so, and the Weaver's own isn't.
    useProfile.getState().equip('robe', robe.id);
    expect(profile().look.robe).toBe(robe.id);
    const shelves = atelierShelves(useProfile.getState().shop(), profile().look, 0);
    const worn = shelves[1]!.items.find((i) => i.item.id === robe.id)!;
    expect([worn.status, worn.action, worn.worn]).toEqual(['Wearing', null, true]);
    expect(shelves[1]!.own!.worn).toBe(false);
    expect(wearLine('robe', robe.name)).toBe(`Wearing ${robe.name}.`);
  });

  it('variants: owned ones are chosen in Prep, mastery’s are locked with its reason', () => {
    const p = at(S.atelierRank, { variants: ['purge'] });
    const items = shopItems(p, rankOf(p.xp), false);
    const purge = shelfItem(
      items.find((i) => i.id === 'purge')!,
      p.look,
      0,
    );
    expect([purge.status, purge.action]).toEqual(['Owned', null]);
    expect(purge.note).toMatch(/choose it in Prep/);
    const m = CONTENT.mastery.callings[0]!;
    const locked = shelfItem(
      items.find((i) => i.id === m.variant)!,
      p.look,
      999,
    );
    expect([locked.status, locked.action]).toEqual(['Locked', null]);
    // The shop's reason, in the screens' typography.
    expect(locked.note).toBe(items.find((i) => i.id === m.variant)!.reason!.replace(/'/g, '’'));
  });

  it('Skip the unlocks: every variant open to play, bought only where it’s sold without Skip', () => {
    const shelvesAt = (p: Profile) => {
      const rank = rankOf(p.xp);
      return atelierShelves(shopItems(p, rank, true), p.look, 999, shopItems(p, rank, false))[0]!
        .items;
    };
    const m = CONTENT.mastery.callings[0]!;
    const name = CONTENT.callings.find((c) => c.id === m.calling)!.name;
    const plain = CONTENT.techniqueVariants.find(
      (v) => !CONTENT.mastery.callings.some((x) => x.variant === v.id),
    )!;
    // At the Atelier's Rank: a plain variant is on sale too; a mastery one says where it's sold.
    let items = shelvesAt(at(S.atelierRank));
    const sold = items.find((i) => i.item.id === plain.id)!;
    expect([sold.status, sold.action]).toEqual(['Open', 'buy']);
    expect(sold.note).toMatch(
      /^Settings → Skip the unlocks lets you play it now, and it’s on sale/,
    );
    const unsold = items.find((i) => i.item.id === m.variant)!;
    expect([unsold.status, unsold.action]).toEqual(['Open', null]);
    expect(unsold.note).toBe(
      `Settings → Skip the unlocks lets you play it now. On sale with the ${name}’s top mastery.`,
    );
    // The store agrees: the mastery variant can't be bought under Skip.
    expect(buy(at(S.atelierRank, { starlight: 999 }), m.variant, S.atelierRank, true)).toEqual({
      refused: shopItems(at(S.atelierRank), S.atelierRank, false).find((i) => i.id === m.variant)!
        .reason,
    });
    // Below the Atelier's Rank: none on sale yet, each says from when.
    items = shelvesAt(at(1));
    expect(items.every((i) => i.action === null)).toBe(true);
    expect(items.find((i) => i.item.id === plain.id)!.note).toBe(
      `Settings → Skip the unlocks lets you play it now. On sale from Weaver Rank ${S.atelierRank}.`,
    );
    expect(items.find((i) => i.item.id === m.variant)!.note).toBe(
      `Settings → Skip the unlocks lets you play it now. On sale from Weaver Rank ${S.atelierRank}, with the ${name}’s top mastery.`,
    );
  });

  it('a title earned by mastery is worn without buying', () => {
    const m = CONTENT.mastery.callings[0]!;
    const top = CONTENT.mastery.levels[CONTENT.mastery.levels.length - 1]!;
    const p = at(S.atelierRank, { mastery: { [m.calling]: top } });
    const item = shopItems(p, rankOf(p.xp), false).find((i) => i.id === m.title)!;
    expect(item.price).toBeNull();
    const s = shelfItem(item, p.look, 0);
    expect([s.status, s.action]).toEqual(['Earned', 'wear']);
  });
});

describe('the rank-up card and the Rank panel', () => {
  it('the Atelier shows at its Rank only, though it isn’t one of the profile’s unlocks', () => {
    expect(UNLOCKS.some((u) => u.name === 'The Atelier')).toBe(false);
    const line = atelierUnlock(S.atelierRank)!;
    expect(line.name).toBe('The Atelier');
    expect(line.text).toContain(String(S.variantPrice));
    expect(line.where).toMatch(/Loom/);
    for (let r = 1; r <= 20; r++) if (r !== S.atelierRank) expect(atelierUnlock(r)).toBeNull();
  });
});

describe('moving between stations', () => {
  // A hall of five: the Gate in the middle of the back row, two either side, one in front.
  const box = (x: number, y: number): Box => ({ x, y, width: 100, height: 80 });
  const hall = [box(0, 0), box(200, -40), box(400, 0), box(600, -40), box(800, 0), box(400, 300)];
  const from = (i: number, dir: readonly [number, number]) =>
    nextInDirection(
      hall[i]!,
      hall.filter((_, j) => j !== i),
      dir,
    );
  const index = (i: number, k: number) => (k < 0 ? -1 : k >= i ? k + 1 : k);

  it('the arrows go to the nearest station that way, by where it stands', () => {
    expect(index(2, from(2, [1, 0]))).toBe(3);
    expect(index(2, from(2, [-1, 0]))).toBe(1);
    expect(index(2, from(2, [0, 1]))).toBe(5);
    expect(index(5, from(5, [0, -1]))).toBe(2);
    // Up from the Gate: the nearer of the two higher on the back wall (a step across counts double).
    expect(index(2, from(2, [0, -1]))).toBe(1);
    // Nothing that way: stay.
    expect(from(4, [1, 0])).toBe(-1);
    expect(from(0, [-1, 0])).toBe(-1);
  });
});

describe('the Loom’s look', () => {
  it('Starlight never reads as the Weaver’s gold, Empower’s, or the Astrolabe’s starlight', () => {
    for (const vision of COLOR_VISIONS)
      for (const other of ['#f5b83d', '#fbbf24', STATION_LOOK.astrolabe.color])
        expect(
          deltaE(simulateVision(STARLIGHT_LOOK.color, vision), simulateVision(other, vision)),
          `${other} (${vision})`,
        ).toBeGreaterThanOrEqual(20);
  });

  it('every glyph it draws is in the kit', () => {
    for (const name of ['starlight', 'loom', 'gate', 'atelier', 'robe', 'banner'])
      expect(PATHS[name as keyof typeof PATHS], name).toBeTruthy();
    for (const id of STATIONS) expect(PATHS[STATION_LOOK[id].icon], id).toBeTruthy();
  });
});

describe('the roster at the Loom (docs/phase-5b.md)', () => {
  const second = CONTENT.bondRules.ranks[1]!;
  const bond = (xp: number) => ({
    xp,
    talents: [null, null, null] as (string | null)[],
    solo: 'default' as const,
    seen: {},
  });

  it('a default profile is unchanged: three heroes, no Brann, no In the Red', () => {
    const p = at(12, { bonds: { kael: bond(second) }, deeds: [CONTENT.deeds[0]!.id] });
    expect(station(stationViews(p, false), 'bonds').badge).toBe('Kael 2 · Lyra 1 · Vexis 1');
    expect(station(stationViews(newProfile(), false), 'bonds').line).not.toMatch(/Brann/);
    const seenAll = { ...p, seen: CONTENT.enemies.map((e) => e.id) };
    expect(station(stationViews(seenAll, false), 'deeds').badge).toBe(
      `1 of ${CONTENT.deeds.filter((d) => !d.hero).length} earned`,
    );
  });

  it('a recruited profile adds Brann: his rank, his name, his Deed', () => {
    const p = at(12, {
      recruited: ['brann'],
      bonds: { brann: bond(second) },
      deeds: [CONTENT.deeds[0]!.id],
      seen: CONTENT.enemies.map((e) => e.id),
    });
    const views = stationViews(p, false);
    expect(station(views, 'bonds').open).toBe(true);
    expect(station(views, 'bonds').badge).toBe('Kael 1 · Lyra 1 · Vexis 1 · Brann 2');
    expect(station(stationViews({ ...p, bonds: {} }, false), 'bonds').line).toMatch(
      /Kael, Lyra, Vexis and Brann/,
    );
    expect(station(views, 'deeds').badge).toBe(`1 of ${CONTENT.deeds.length} earned`);
  });
});
