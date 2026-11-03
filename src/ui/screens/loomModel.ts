/**
 * Phase 4g UI: the Loom (docs/phase-4g.md), as plain data and words. The hub's stations (lit or
 * dark, what each says, what waits there, which have lit up since the last visit), their
 * first-contact intros, the Gate's run, the Atelier's shelves, the Weaver's name plate and the
 * rank-up card's line for the Atelier.
 *
 * What's lit is each system's own gate, the same the Title and Prep read: the Astrolabe's Rank,
 * the Atelier's (`starlight.atelierRank`), the Reliquary's, a hero's first Bond rank-up, a first
 * Deed, Dissonance's win, or Settings → Skip the unlocks. Prices, pay and Ranks are content's;
 * what's for sale and why is `shopItems`'s (the profile store's `shop()`), so tuning reaches the
 * hub untouched.
 */
import { CONTENT, heroDef, variantText } from '../../content';
import { ASTROLABE_RANK, astrolabePoints } from '../../meta/astrolabe';
import { deedPoints, DEED_POINTS_MAX } from '../../meta/deeds';
import { rosterHeroes } from '../../meta/bonds';
import { opensAt } from '../../meta/dissonance';
import { masteryFor, type Look, type ShopItem, type ShopKind } from '../../meta/loom';
import { heroRoster, rankOf, rankProgress, type Profile } from '../../meta/profile';
import { reliquaryOpen, type Reliquary } from '../../meta/reliquary';
import type { RunState } from '../../meta/types';
import { fmt, plural } from '../kit/format';
import type { IconName } from '../kit/iconPaths';
import type { StationId } from '../kit/loomLook';
import { techniqueIcon } from '../kit/variantLook';
import type { TechniqueKey } from '../types';
import { astrolabeOpen, spendLine } from './astrolabeModel';
import { bondRanks, bondsOpen } from './bondsModel';
import { slotKey } from './variantsModel';
import { deedsTally } from './deedsModel';
import { gateStep } from './routeText';

export type { StationId };

/** The stations in the hub's order: what Tab and a screen reader go through. */
export const STATIONS: readonly StationId[] = [
  'gate',
  'training',
  'codex',
  'astrolabe',
  'atelier',
  'reliquary',
  'bonds',
  'deeds',
  'dissonance',
];

/** The stations open from the first run: they share one welcome intro. */
export const WELCOME: readonly StationId[] = ['gate', 'training', 'codex'];

/** The id an intro seen is recorded under, in the profile's `introduced` list. */
export function introId(id: StationId): string {
  return `station:${id}`;
}

/** What the hub reads of the profile. */
export type LoomProfile = Pick<
  Profile,
  | 'xp'
  | 'deeds'
  | 'astrolabe'
  | 'reliquary'
  | 'bonds'
  | 'dissonance'
  | 'introduced'
  | 'starlight'
  | 'look'
  | 'runs'
  | 'wins'
> &
  /** Phase 5a: the enemies sighted (later Movements' Deeds count once met); omitted: all. */
  Partial<Pick<Profile, 'seen'>> &
  /** Phase 5b: the heroes recruited (docs/phase-5b.md); omitted: none. */
  Pick<Profile, 'recruited'>;

/** The saved run the Gate can continue (null: none), as much of it as the Gate says. */
export type GateRun = Pick<RunState, 'phase' | 'path' | 'map'> &
  /** Phase 5a: an Expedition's Gate names its Movement (omitted: a Prelude). */
  Partial<Pick<RunState, 'movements'>>;

const NAMES: Readonly<Record<StationId, string>> = {
  gate: 'The Gate',
  training: 'Training Grounds',
  codex: 'Codex',
  astrolabe: 'The Astrolabe',
  atelier: 'The Atelier',
  reliquary: 'The Reliquary',
  bonds: 'Bonds',
  deeds: 'Hall of Deeds',
  dissonance: 'Dissonance',
};

/** A station's name ("The Astrolabe"). */
export function stationName(id: StationId): string {
  return NAMES[id];
}

/** A station's name inside a sentence ("the Astrolabe", "the Hall of Deeds", "Bonds"). */
export function stationProse(id: StationId): string {
  return id === 'deeds' || id === 'training' || id === 'codex'
    ? `the ${NAMES[id]}`
    : NAMES[id].replace(/^The /, 'the ');
}

/** "the Atelier" → "The Atelier": a sentence's first word. */
function capital(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** The Atelier's Rank (content's). */
export function atelierRank(): number {
  return CONTENT.starlight.atelierRank;
}

/** The Atelier is open: its Rank, or Settings → Skip the unlocks (as `shopItems` has it). */
export function atelierOpen(rank: number, unlockAll: boolean): boolean {
  return unlockAll || rank >= atelierRank();
}

/** The Hall of Deeds is open: a first Deed, or Settings → Skip the unlocks. */
export function deedsOpen(deeds: readonly string[], unlockAll: boolean): boolean {
  return unlockAll || deeds.length > 0;
}

/** Dissonance is open: won at its Rank, or Settings → Skip the unlocks (the store's own gate). */
export function dissonanceStationOpen(open: boolean, unlockAll: boolean): boolean {
  return unlockAll || open;
}

export interface StationView {
  id: StationId;
  /** "The Astrolabe". */
  name: string;
  /** Lit: open (by its Rank, its first time, or Skip the unlocks). Dark until then. */
  open: boolean;
  /** Lit, and its intro not seen yet: the hub draws the eye to it; its first visit plays it. */
  fresh: boolean;
  /** Dark: when it lights ("Opens at Weaver Rank 4."). Lit: what it's for, in a few words. */
  line: string;
  /** What waits there (lit only): "3 points to spend", "Best won: 14". Null: nothing to say. */
  badge: string | null;
}

/** The hub's stations for a profile, in the hub's order. */
export function stationViews(
  p: LoomProfile,
  unlockAll: boolean,
  opts: { run?: GateRun | null; shop?: readonly ShopItem[] } = {},
): StationView[] {
  const rank = rankOf(p.xp);
  const seen = (id: StationId) => p.introduced.includes(introId(id));
  const welcomeSeen = !welcomeDue(p.introduced);
  return STATIONS.map((id) => {
    const open = stationOpen(id, p, unlockAll);
    const fresh = open && (WELCOME.includes(id) ? !welcomeSeen : !seen(id));
    return {
      id,
      name: stationName(id),
      open,
      fresh,
      line: open ? litLine(id, opts.run ?? null) : darkLine(id, rank, rosterHeroes(p, unlockAll)),
      badge: open ? badgeOf(id, p, unlockAll, opts.shop ?? []) : null,
    };
  });
}

/** Is this station lit for the profile? */
export function stationOpen(id: StationId, p: LoomProfile, unlockAll: boolean): boolean {
  const rank = rankOf(p.xp);
  switch (id) {
    case 'gate':
    case 'training':
    case 'codex':
      return true;
    case 'astrolabe':
      return astrolabeOpen(rank, unlockAll);
    case 'atelier':
      return atelierOpen(rank, unlockAll);
    case 'reliquary':
      return reliquaryOpen(rank, unlockAll);
    case 'bonds':
      return bondsOpen(p.bonds, unlockAll, rosterHeroes(p, unlockAll));
    case 'deeds':
      return deedsOpen(p.deeds, unlockAll);
    case 'dissonance':
      return dissonanceStationOpen(p.dissonance.open, unlockAll);
  }
}

/** The welcome intro is still to play (the Gate's, the Grounds' and the Codex's, shared). */
export function welcomeDue(introduced: readonly string[]): boolean {
  return WELCOME.some((id) => !introduced.includes(introId(id)));
}

/** What choosing a dark station says (read out): "The Atelier is dark. Starlight’s shop. …" */
export function darkSaid(id: StationId, rank: number): string {
  return `${capital(stationProse(id))} is dark. ${darkLine(id, rank)}`;
}

/** "Kael, Lyra and Vexis". */
function andList(names: readonly string[]): string {
  return names.length <= 1
    ? (names[0] ?? '')
    : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** The heroes who build Bonds, by name: the player's (docs/phase-5b.md), the starters by default. */
function bondedNames(heroes: readonly string[] = rosterHeroes({}, false)): string {
  return andList(heroes.map((h) => heroDef(h).name));
}

/**
 * A dark station's line: what it is, in a few words, then when it opens (its Rank, or what opens
 * it), so a first visit reads as three places and the rest still to come.
 */
export function darkLine(
  id: StationId,
  rank: number,
  /** The Bonded heroes the player has (`rosterHeroes`); omitted, the starters. */
  heroes?: readonly string[],
): string {
  switch (id) {
    case 'astrolabe':
      return `A star map of bonuses. Opens at Weaver Rank ${ASTROLABE_RANK}.`;
    case 'atelier':
      return `The Starlight shop. Opens at Weaver Rank ${atelierRank()}.`;
    case 'reliquary':
      return `Relics kept between runs. Opens at Weaver Rank ${CONTENT.reliquary.slotRanks[0]}.`;
    case 'bonds':
      // Open from a hero's first Bond rank-up (`bondsOpen`: a rank above 1).
      return `Your heroes, ${bondedNames(heroes)}, earn Bond XP every fight. Opens when one reaches Bond rank 2.`;
    case 'deeds':
      return 'Deeds are feats within a run, like winning one. Opens with your first Deed.';
    case 'dissonance':
      return `Optional difficulty, for the endgame. ${
        opensAt(rank)
          ? 'Opens with your next win.'
          : `Opens with a win at Weaver Rank ${CONTENT.dissonanceRules.openRank} or above.`
      }`;
    default:
      return '';
  }
}

/** A lit station's line: what it's for (the Gate: the run it would continue). */
function litLine(id: StationId, run: GateRun | null): string {
  switch (id) {
    case 'gate':
      return gateLine(run);
    case 'training':
      return 'Practise, with nothing at stake';
    case 'codex':
      return 'Every enemy, song and system';
    case 'astrolabe':
      return 'Bonuses chosen between runs';
    case 'atelier':
      return 'Spend your Starlight';
    case 'reliquary':
      return 'Relics kept between runs';
    case 'bonds':
      return 'The heroes’ talents and Solos';
    case 'deeds':
      return 'Feats within a run';
    case 'dissonance':
      return 'Harder runs that pay more, set in Prep';
  }
}

/** What the Gate does: begin a run, or continue the one saved ("Continue · step 4 of 10"). */
export function gateLine(run: GateRun | null): string {
  if (!run) return 'Begin a run';
  if (run.phase === 'prep') return 'Continue · your run is in Prep';
  return `Continue · ${gateStep(run)}`;
}

/** The Reliquary's materials, short, as its station shows them: "34 Shards · 1 Tear". */
export function materialsShort(rq: Pick<Reliquary, 'shards' | 'tears'>): string | null {
  const parts = [
    rq.shards > 0 ? `${fmt(rq.shards)} ${plural(rq.shards, 'Shard')}` : null,
    rq.tears > 0 ? `${fmt(rq.tears)} ${plural(rq.tears, 'Tear')}` : null,
  ].filter((x): x is string => x !== null);
  return parts.length > 0 ? parts.join(' · ') : null;
}

/** Each hero's Bond rank, by name, as the Bonds station shows them: "Kael 2 · Lyra 2 · Vexis 2". */
export function bondRanksLine(
  bonds: LoomProfile['bonds'],
  heroes: readonly string[] = rosterHeroes({}, false),
): string {
  return Object.entries(bondRanks(bonds, heroes))
    .map(([h, r]) => `${heroDef(h).name} ${r}`)
    .join(' · ');
}

/** What waits at a lit station (the Title's badges, and the Atelier's and the Hall's). */
function badgeOf(
  id: StationId,
  p: LoomProfile,
  unlockAll: boolean,
  shop: readonly ShopItem[],
): string | null {
  const rank = rankOf(p.xp);
  switch (id) {
    case 'astrolabe': {
      const left = astrolabePoints(rank, unlockAll, deedPoints(p.deeds)) - p.astrolabe.length;
      return left > 0 ? spendLine(left) : null;
    }
    case 'atelier': {
      const n = affordable(shop, p.starlight);
      return n > 0 ? `${n} you can afford` : null;
    }
    case 'reliquary':
      return materialsShort(p.reliquary);
    case 'bonds':
      return bondRanksLine(p.bonds, rosterHeroes(p, unlockAll));
    case 'deeds': {
      // Out of the Deeds in sight (a later Movement's join once its enemies are met), counted as
      // the Codex's Deeds page counts them (`deedsTally`).
      const { earned, total } = deedsTally(p.deeds, p.seen, heroRoster(p, unlockAll));
      return earned > 0 ? `${earned} of ${total} earned` : null;
    }
    case 'dissonance': {
      const best = Math.max(0, ...Object.values(p.dissonance.best));
      return best > 0 ? `Best won: ${best}` : null;
    }
    default:
      return null;
  }
}

/**
 * What Starlight is for, beside the hub's balance: a line while the Atelier is still dark (where
 * it's spent, and from when), and the chip's tooltip (how it's earned, what it buys).
 */
export function starlightAbout(
  rank: number,
  unlockAll: boolean,
): { line: string | null; tip: string } {
  const open = atelierOpen(rank, unlockAll);
  return {
    line: open ? null : `Spent at the Atelier, which opens at Weaver Rank ${atelierRank()}`,
    tip: `Starlight: every won fight pays it, and every Deed. Spend it at the Atelier${
      open ? '' : `, which opens at Weaver Rank ${atelierRank()}`
    }, on technique variants, robes, Thread looks and titles.`,
  };
}

/** How many of the Atelier's items the balance buys now (not owned, not locked). */
export function affordable(shop: readonly ShopItem[], starlight: number): number {
  return shop.filter((i) => i.state === 'buyable' && i.price !== null && i.price <= starlight)
    .length;
}

/** The lit stations whose intro waits (the welcome's three aside): "The Atelier has lit up." */
export function freshLine(stations: readonly StationView[]): string | null {
  const names = stations
    .filter((s) => s.fresh && !WELCOME.includes(s.id))
    .map((s) => stationProse(s.id));
  if (names.length === 0) return null;
  const list =
    names.length === 1
      ? names[0]!
      : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  return `${capital(list)} ${names.length === 1 ? 'has' : 'have'} lit up: visit to see what’s there.`;
}

// ── Intros ────────────────────────────────────────────────────────────────────────────

export interface IntroPanel {
  heading: string;
  body: string;
  /** The stations drawn beside it (none: the Loom's wheel). */
  art: readonly StationId[];
}

export interface StationIntro {
  /** The station it opens ("Try it"): the welcome's is the Gate. */
  station: StationId;
  /** The dialog's title. */
  title: string;
  panels: IntroPanel[];
  /** Its "Try it" button. */
  tryIt: string;
  /** What's recorded as seen (`markIntroduced`): the station, or the welcome's three. */
  seen: string[];
}

const S = () => CONTENT.starlight;

/** "60–90", or "60" when every price is the same. */
function priceRange(prices: readonly number[]): string {
  const lo = Math.min(...prices);
  const hi = Math.max(...prices);
  return lo === hi ? fmt(lo) : `${fmt(lo)}–${fmt(hi)}`;
}

/** Robes' and Thread looks' prices, and the titles sold. */
function keepsakePrices(): { looks: string; titles: string } {
  const c = CONTENT.cosmetics;
  const titles = c.titles.flatMap((t) => (t.price === undefined ? [] : [t.price]));
  return {
    looks: priceRange([...c.robes.map((r) => r.price), ...c.threads.map((t) => t.price)]),
    titles: titles.length > 0 ? priceRange(titles) : '—',
  };
}

/** "an S", "a B": a grade with its article. */
function withArticle(grade: string): string {
  return `${/^[AEFHILMNORSX]/.test(grade) ? 'an' : 'a'} ${grade}`;
}

/** The Rank the first Calling opens at (content's). */
function firstCallingRank(): number {
  return Math.min(...CONTENT.callings.map((c) => c.unlockRank));
}

/** The welcome: what the Loom is, the Gate, the Grounds and the Codex. */
export function welcomeIntro(run: GateRun | null = null): StationIntro {
  return {
    station: 'gate',
    title: 'The Loom',
    panels: [
      {
        heading: 'Your sanctum between runs',
        art: [],
        body: 'Between runs you come back here. Each station is a place to go: to set out, to practise, to read up and, as you play, to grow the Weaver. The dark ones open one by one, and the first visit to each shows you around.',
      },
      {
        heading: 'The Gate',
        art: ['gate'],
        body: 'Every run starts here. Through the Gate is Prep, where you choose your songs (the auras you sing to your heroes as they fight: healing them, or making them hit harder), then set out on the road. A run you leave waits at the Gate to be continued.',
      },
      {
        heading: 'The Training Grounds and the Codex',
        art: ['training', 'codex'],
        body: `The Training Grounds are a sandbox: your party, enemies to spawn and your build to try, with nothing at stake. Their drill rings a training bell at a hero: Ward them just before the blow lands and it’s a Perfect Ward, the hit negated. The Codex explains every enemy, song and system you meet.`,
      },
    ],
    tryIt: run ? 'Try it: continue your run' : 'Try it: begin a run',
    seen: WELCOME.map(introId),
  };
}

/** A station's first-contact intro: two or three panels, then "Try it". */
export function stationIntro(id: StationId): StationIntro {
  const intro = (panels: Omit<IntroPanel, 'art'>[]): StationIntro => ({
    station: id,
    title: stationName(id),
    panels: panels.map((p) => ({ ...p, art: [id] })),
    tryIt: `Try it: open ${stationProse(id)}`,
    seen: [introId(id)],
  });
  const s = S();
  switch (id) {
    case 'gate':
      return welcomeIntro();
    case 'training':
    case 'codex':
      return { ...welcomeIntro(), station: id, tryIt: `Try it: open ${stationProse(id)}` };
    case 'astrolabe':
      return intro([
        {
          heading: 'A star map of bonuses',
          body: `Passive bonuses, chosen between runs. It opens with ${astrolabePoints(ASTROLABE_RANK)} points; every Rank after gives one more, and Deeds (feats in a run, kept in the Hall of Deeds) give up to ${DEED_POINTS_MAX} more. Spend them on stars for the Thread, the songs, your techniques or the heroes.`,
        },
        {
          heading: 'Take a path',
          body: 'Choose a star to take it and the path to it. To give one back, right-click it, or choose a star you’ve taken and press Give back. Respec gives every point back: it’s all free between runs.',
        },
        {
          heading: 'It goes with you',
          body: 'A run embarks with the tree you have, and the Training Grounds use it too, so try a change there first. Open it here, or from Prep.',
        },
      ]);
    case 'atelier': {
      const prices = keepsakePrices();
      return intro([
        {
          heading: 'Starlight',
          body: `Every won fight pays Starlight: a skirmish ${s.fights.skirmish}, an elite ${s.fights.elite}, a mini-boss ${s.fights.miniboss}, a boss ${s.fights.boss}, and a won run ${s.winBonus} more. Each Deed pays it too. A lost fight pays nothing, but what the run earned stays.`,
        },
        {
          heading: 'What it buys',
          body: `Technique variants, new ways to play one of your four techniques (${fmt(s.variantPrice)} each); robes and Thread looks (${prices.looks}); titles (${prices.titles}). A few are earned instead. A Calling (a class for the Weaver, chosen in Prep from Rank ${firstCallingRank()}) gains mastery as you play it, and its top mastery puts its own variant on sale and earns its title.`,
        },
        {
          heading: 'Yours to wear',
          body: 'A robe and a Thread look change how the Weaver looks, never how she plays: Mend’s and Empower’s colours stay, so the Thread still says which it is. A variant you buy is chosen in Prep, slot by slot.',
        },
      ]);
    }
    case 'reliquary': {
      const rq = CONTENT.reliquary;
      const [one, two, three] = rq.slotRanks;
      return intro([
        {
          heading: 'Relics that outlive their runs',
          body: 'A run finds relics, each with an effect of its own. Win the run, and its Summary lets you enshrine one it found: it waits here between runs with its first Inscriptions, small bonuses of its own that crafting adds to.',
        },
        {
          heading: 'Craft them',
          body: `Every run that ends pays crafting materials: Tuning Shards for each fight it won, and a Discord Tear for beating its boss with ${withArticle(rq.tearGrade)} grade. Spend them here to add an Inscription to a relic, roll one again, or raise its tier.`,
        },
        {
          heading: 'Carry them',
          body: `Choose relics to carry into a run: one from Rank ${one}, two from ${two}, three from ${three}. Each lends the run its Inscriptions, and the first, attuned, plays its own effect too.`,
        },
      ]);
    }
    case 'bonds':
      return intro([
        {
          heading: 'Bonds',
          body: `Every fight pays ${bondedNames()} Bond XP, more for the support you gave each. Each Bond rank opens something: talents (one of two in each tier), an alternate Solo (a hero’s big move, which they charge as they fight), or a scene by a Respite’s fire.`,
        },
        {
          heading: 'Who they become',
          body: 'On each hero’s page, choose one talent a tier (or neither) and which Solo they bring. Choices change freely between runs; a run keeps what it embarked with.',
        },
      ]);
    case 'deeds': {
      const ladder = CONTENT.deeds.filter((d) => d.points > 0).length;
      return intro([
        {
          heading: 'Deeds',
          body: `Feats within a run, from winning one to a run where no hero ever goes down. Each pays Starlight as you earn it, and ${ladder} of them give an Astrolabe point each too.`,
        },
        {
          heading: 'The Hall',
          body: 'Every Deed hangs here, earned or not: how each is earned, and your best run so far at the Deeds that keep a count.',
        },
      ]);
    }
    case 'dissonance': {
      const d = CONTENT.dissonanceRules;
      return intro([
        {
          heading: 'Optional difficulty',
          body: `For the endgame: levels you turn on before a run. Each makes the fight harder in its own way (tougher enemies, shorter wind-ups, Respites that don’t heal) and is worth points. Each point pays +${d.xpPerPoint}% Weaver XP and +${d.shardsPerPoint}% Tuning Shards, and relics found in harder runs can be crafted to higher tiers.`,
        },
        {
          heading: 'Chosen in Prep',
          body: 'Turn its levels on in Prep, through the Gate. Your choice is kept from run to run, and a run keeps it to the end.',
        },
        {
          heading: 'Your records',
          body: 'Here: the best you’ve won at with each Calling, every level, and what the points pay.',
        },
      ]);
    }
  }
}

// ── The Weaver ────────────────────────────────────────────────────────────────────────

/** A title's words, by id (null: none, or one content dropped). */
export function titleText(id: string | null | undefined): string | null {
  return CONTENT.cosmetics.titles.find((t) => t.id === id)?.text ?? null;
}

/** The Weaver's name plate: name, title, Rank and XP. */
export function weaverPlate(p: Pick<Profile, 'xp' | 'look'>): {
  name: string;
  title: string | null;
  rank: number;
  progress: string;
  fraction: number;
} {
  const { rank, into, span } = rankProgress(p.xp);
  return {
    name: 'The Weaver',
    title: titleText(p.look.title),
    rank,
    progress:
      span === null
        ? `${fmt(p.xp)} XP · the highest Rank for now`
        : `${fmt(into)} / ${fmt(span)} XP to Rank ${rank + 1}`,
    fraction: span === null ? 1 : Math.max(0, Math.min(1, into / span)),
  };
}

/** "245 Starlight". */
export function starlightText(n: number): string {
  return `${fmt(n)} Starlight`;
}

// ── The Atelier ───────────────────────────────────────────────────────────────────────

/** The slot a keepsake is worn in (variants aren't worn: they're chosen in Prep). */
export function lookSlot(kind: ShopKind): keyof Look | null {
  return kind === 'robe'
    ? 'robe'
    : kind === 'thread'
      ? 'thread'
      : kind === 'title'
        ? 'title'
        : null;
}

export interface ShelfItem {
  item: ShopItem;
  /** Worn now. */
  worn: boolean;
  /** Can be worn now: owned, or a title earned. */
  wearable: boolean;
  /** Starlight still needed to buy it (0: enough, or not for sale). */
  short: number;
  /**
   * The state as a word: "Owned", "Wearing", "Earned", "Locked", "Open". Null for sale: its Buy
   * button (with the price) says so.
   */
  status: string | null;
  /** What its button does: buy it, wear it; null: no button (locked, worn, an owned variant). */
  action: 'buy' | 'wear' | null;
  /** A line under it: why it's locked, how a title's earned, "Choose it in Prep (Q)." */
  note: string | null;
  /** A variant's slot, its key and its words; null for keepsakes. */
  variant: { slot: TechniqueKey; key: string; text: string; icon: IconName } | null;
}

export interface Shelf {
  kind: ShopKind;
  title: string;
  blurb: string;
  /** A second line, for a term the shelf is the first to use (the variants': a Calling's mastery). */
  more: string | null;
  icon: IconName;
  items: ShelfItem[];
  /** The Weaver's own (the robe, the Thread's own look, no title): worn when nothing else is. */
  own: { name: string; worn: boolean } | null;
}

const SHELVES: readonly { kind: ShopKind; title: string; blurb: string; icon: IconName }[] = [
  {
    kind: 'variant',
    title: 'Technique variants',
    blurb:
      'Another way to play one of your four techniques, yours for good. Choose it in Prep, slot by slot.',
    icon: 'ward',
  },
  {
    kind: 'robe',
    title: 'Robes',
    blurb: 'The Weaver’s colours: her robe, its trim and its glow.',
    icon: 'robe',
  },
  {
    kind: 'thread',
    title: 'Thread looks',
    blurb: 'The Thread’s filament and glow. Mend’s and Empower’s colours stay.',
    icon: 'thread',
  },
  {
    kind: 'title',
    title: 'Titles',
    blurb:
      'Worn under your name in the Loom. Some are earned, not bought: by a Calling’s top mastery, or by a Deed.',
    icon: 'banner',
  },
];

/** The variants' shelf says what a Calling's mastery is, where the Atelier first names it. */
function masteryLine(): string {
  const n = CONTENT.mastery.callings.length;
  return `${n === 1 ? 'One goes' : `${capital(countWord(n))} go`} on sale with a Calling’s top mastery: a Calling is a class for the Weaver, chosen in Prep from Rank ${firstCallingRank()}, and playing it builds its mastery.`;
}

/** "three". */
function countWord(n: number): string {
  return ['no', 'one', 'two', 'three', 'four', 'five', 'six'][n] ?? String(n);
}

const OWN_NAMES: Readonly<Record<ShopKind, string | null>> = {
  variant: null,
  robe: 'The Weaver’s own',
  thread: 'The Thread’s own',
  title: 'No title',
};

/**
 * The Atelier's shelves from `shop()`: variants, robes, Thread looks, titles, in its order. With
 * Settings → Skip the unlocks, `unskipped` is the shop as it stands without it (`shopItems` with
 * `all` false): a variant Skip opens to play is bought only where that one sells it.
 */
export function atelierShelves(
  items: readonly ShopItem[],
  look: Look,
  starlight: number,
  unskipped: readonly ShopItem[] | null = null,
): Shelf[] {
  // Without Skip the Atelier itself is closed (below its Rank): a robe, which nothing else
  // gates, isn't for sale.
  const closed = !!unskipped?.some((i) => i.kind === 'robe' && i.state === 'locked');
  return SHELVES.map((s) => {
    const slot = lookSlot(s.kind);
    const worn = slot ? look[slot] : null;
    return {
      ...s,
      more: s.kind === 'variant' && CONTENT.mastery.callings.length > 0 ? masteryLine() : null,
      items: items
        .filter((i) => i.kind === s.kind)
        .map((i) =>
          shelfItem(i, look, starlight, unskipped?.find((u) => u.id === i.id) ?? null, closed),
        ),
      own: OWN_NAMES[s.kind] ? { name: OWN_NAMES[s.kind]!, worn: worn === null } : null,
    };
  });
}

/**
 * One item on a shelf: its state in words, what its button does, its note. `unskipped`: the same
 * item without Skip the unlocks (for a variant Skip opens: whether it's on sale, and if not, why);
 * `closedWithoutSkip`: the Atelier is below its Rank without Skip.
 */
export function shelfItem(
  item: ShopItem,
  look: Look,
  starlight: number,
  unskipped: ShopItem | null = null,
  closedWithoutSkip = false,
): ShelfItem {
  const slot = lookSlot(item.kind);
  const worn = slot !== null && look[slot] === item.id;
  const wearable = slot !== null && (item.state === 'owned' || item.state === 'earned');
  // Skip the unlocks opens a variant to play, never to own: it's sold where it's sold without Skip.
  const sold =
    item.state === 'buyable' || (item.state === 'open' && unskipped?.state === 'buyable');
  const short = sold && item.price !== null ? Math.max(0, item.price - starlight) : 0;
  const def =
    item.kind === 'variant' ? CONTENT.techniqueVariants.find((v) => v.id === item.id) : undefined;
  const variant = def
    ? {
        slot: def.slot,
        key: slotKey(def.slot),
        text: variantText(def),
        icon: techniqueIcon(def.slot, def.id),
      }
    : null;
  let status: string | null = null;
  let action: ShelfItem['action'] = null;
  let note: string | null = item.reason === null ? null : typeset(item.reason);
  if (item.state === 'locked') {
    status = 'Locked';
  } else if (item.kind === 'variant') {
    if (item.state === 'owned') {
      status = 'Owned';
      if (variant) note = `Yours: choose it in Prep, under Your techniques (${variant.key}).`;
    } else if (item.state === 'open') {
      status = 'Open';
      action = sold ? 'buy' : null;
      note = sold
        ? 'Settings → Skip the unlocks lets you play it now, and it’s on sale too, to keep.'
        : `Settings → Skip the unlocks lets you play it now. ${openWhy(item.id, unskipped, closedWithoutSkip)}`;
    } else {
      action = 'buy';
    }
  } else if (wearable) {
    status = worn ? 'Wearing' : item.state === 'earned' ? 'Earned' : 'Owned';
    action = worn ? null : 'wear';
  } else {
    action = 'buy';
  }
  return { item, worn, wearable, short, status, action, note, variant };
}

/** The shop's words in the screens' typography: its apostrophes curled ("the Luminary’s"). */
function typeset(text: string): string {
  return text.replace(/'/g, '’');
}

/**
 * Where a variant Skip the unlocks opens is sold without it: from the Atelier's Rank (and its
 * Calling's top mastery, for one of theirs), else the shop's own reason ("On sale with the
 * Luminary's top mastery.").
 */
function openWhy(id: string, unskipped: ShopItem | null, closedWithoutSkip: boolean): string {
  if (!closedWithoutSkip) return typeset(unskipped?.reason ?? '');
  const calling = masteryFor(id);
  const name = calling ? CONTENT.callings.find((c) => c.id === calling)?.name : null;
  return `On sale from Weaver Rank ${atelierRank()}${name ? `, with the ${name}’s top mastery` : ''}.`;
}

/** A purchase's line, for the live region: bought, or why not ("Ember: Not enough Starlight."). */
export function buyLine(item: ShopItem, refusal: string | null, short: number): string {
  if (refusal === null)
    return item.kind === 'variant'
      ? `${item.name} is yours: choose it in Prep.`
      : `${item.name} is yours${item.price !== null ? ` for ${fmt(item.price)} Starlight` : ''}. Wear it when you like.`;
  return `${item.name}: ${typeset(refusal)}${short > 0 ? ` ${fmt(short)} more to go.` : ''}`;
}

/** What wearing (or taking off) says: "Wearing Ember.", "Back to the Weaver’s own robe." */
export function wearLine(kind: ShopKind, name: string | null): string {
  if (name !== null) return kind === 'title' ? `Your title: ${name}.` : `Wearing ${name}.`;
  return kind === 'robe'
    ? 'Back to the Weaver’s own robe.'
    : kind === 'thread'
      ? 'Back to the Thread’s own look.'
      : 'No title.';
}

// ── The rank-up card ─────────────────────────────────────────────────────────────────

/**
 * The Atelier on its Rank's rank-up card (it isn't one of the profile's unlocks: the card adds it
 * as it adds the Astrolabe's point). Null at any other Rank.
 */
export function atelierUnlock(rank: number): { name: string; text: string; where: string } | null {
  if (rank !== atelierRank()) return null;
  const s = S();
  const prices = keepsakePrices();
  return {
    name: 'The Atelier',
    text: `The Starlight shop: technique variants, new ways to play your four techniques (${fmt(s.variantPrice)} each), robes and Thread looks (${prices.looks}) and titles (${prices.titles}). Every won fight pays Starlight.`,
    where: 'Visit it in the Loom.',
  };
}
