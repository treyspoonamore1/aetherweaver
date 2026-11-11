/**
 * The roster on screen (docs/phase-5b.md), as plain data so it is testable without React: Prep's
 * party picker (exactly three, their keys in canonical order), the note for each missing starter,
 * a hero's Passive and Needs rows, the locked silhouette's two-route text, the Cell's copy by
 * roster and party, the Result's recruit line, Brann's line on the Result and the Summary, and
 * the Harmony ribbon and 'would enable' hint on motif cards. Every list keeps content order.
 */
import {
  CONTENT,
  auraDef,
  bloodRageOf,
  encounterDef,
  heroDef,
  interruptAbilities,
  motifDef,
  partyTaunts,
  type HeroDef,
  type MotifDef,
} from '../../content';
import { HEAL_CUT } from '../../content/legion';
import { HEAVY_LIFE, PARRY_REACH } from '../../content/rosterIds';
import type { EventChoice } from '../../content/schema';
import type { HeroBloodStats, HeroDuelStats, HeroGroveStats, RunState } from '../../meta/types';
import { recruitWordLine } from '../../meta/run';
import { fmt, pct } from '../kit/format';
import { PARTY_SIZE } from './prepParty';
import type { Action } from '../../input/actions';
import { bindingLabel } from '../hud/labels';
import { t as txt } from '../text';

// ── Prep's picker ───────────────────────────────────────────────────────────────────

/** Ids in content order (the slot order the run gives them: `Run.setParty`'s canonical order). */
export function canonical(ids: readonly string[]): string[] {
  const set = new Set(ids);
  return CONTENT.heroes.filter((h) => set.has(h.id)).map((h) => h.id);
}

export interface PickerCard {
  heroId: string;
  name: string;
  title: string;
  role: HeroDef['role'];
  selected: boolean;
  /**
   * The number key this hero will take (1-based) once the party embarks: their place among the
   * chosen in content order. Null while not chosen.
   */
  key: number | null;
  /**
   * That key as the player has bound it (`bindingLabel('focusN')`), the label the frames show:
   * "1" unless the focus keys are rebound. Null while not chosen.
   */
  keyLabel: string | null;
  /** A pick is full and this one isn't in it: choose it only after dropping someone. */
  full: boolean;
}

/** Slot `n`'s (1-based) focus key as the player has bound it, as on the party frames. */
export function focusKeyLabel(n: number): string {
  return bindingLabel(`focus${n}` as Action);
}

/** The picker's cards: every roster hero, the chosen marked with the key they will take. */
export function pickerCards(roster: readonly string[], chosen: readonly string[]): PickerCard[] {
  const keys = canonical(chosen);
  const full = keys.length >= PARTY_SIZE;
  return canonical(roster).map((id) => {
    const def = heroDef(id);
    const at = keys.indexOf(id);
    return {
      heroId: id,
      name: def.name,
      title: def.title,
      role: def.role,
      selected: at >= 0,
      key: at >= 0 ? at + 1 : null,
      keyLabel: at >= 0 ? focusKeyLabel(at + 1) : null,
      full: full && at < 0,
    };
  });
}

/**
 * The pick after toggling a hero: dropped if chosen, else added while fewer than three are
 * chosen (a full pick stays as it is). Always in content order; unknown ids are ignored.
 */
export function togglePick(
  chosen: readonly string[],
  heroId: string,
  roster: readonly string[],
): string[] {
  const now = canonical(chosen).filter((id) => roster.includes(id));
  if (!roster.includes(heroId)) return now;
  if (now.includes(heroId)) return now.filter((id) => id !== heroId);
  if (now.length >= PARTY_SIZE) return now;
  return canonical([...now, heroId]);
}

/**
 * The picker's columns (docs/phase-5e.md): one per card up to four, as it always was; five or six
 * cards lay out three across (3 × 2), never four and a straggler.
 */
export function pickerColumns(cards: number): number {
  return cards <= 4 ? cards : 3;
}

/** A pick the run can take: exactly three distinct roster heroes. */
export function pickLegal(chosen: readonly string[], roster: readonly string[]): boolean {
  const ids = new Set(chosen);
  return (
    ids.size === PARTY_SIZE &&
    chosen.length === PARTY_SIZE &&
    chosen.every((id) => roster.includes(id))
  );
}

/** "Pick 1 more hero": what the picker still wants (null once the pick is legal). */
export function pickProblem(chosen: readonly string[]): string | null {
  const n = new Set(chosen).size;
  if (n === PARTY_SIZE) return null;
  const more = PARTY_SIZE - n;
  return more > 0
    ? txt('screens.rosterModel.pickMore', {
        more,
        value: more === 1 ? txt('screens.rosterModel.hero') : txt('screens.rosterModel.heroes'),
      })
    : null;
}

export interface StarterNote {
  heroId: string;
  text: string;
}

/** What a party loses without each starter (docs/phase-5b.md, "Prep"), by starter. */
const MISSING_NOTE: Readonly<Record<string, string>> = {
  get kael() {
    return txt('screens.rosterModel.noKaelNothingTaunts');
  },
  get lyra() {
    return txt('screens.rosterModel.noLyraOnlyKael');
  },
  get vexis() {
    return txt('screens.rosterModel.noVexisNoGravity');
  },
};

/** The roster MISSING_NOTE was written for (docs/phase-5b.md): a pick of these reads as it did. */
const FIRST_FOUR: ReadonlySet<string> = new Set(['kael', 'lyra', 'vexis', 'brann']);

/**
 * One note per starter the party leaves out (none for the default party), worded from the party
 * (docs/phase-5e.md): who the bosses find without Kael's taunt (`partyTaunts`), and who still
 * interrupts without Lyra (`interruptAbilities`). Every party of the first four heroes reads as
 * it always did.
 */
export function missingStarterNotes(party: readonly string[]): StarterNote[] {
  return CONTENT.defaultParty
    .filter((id) => !party.includes(id))
    .map((id) => ({
      heroId: id,
      text: missingNote(id, party),
    }));
}

function missingNote(id: string, party: readonly string[]): string {
  const known = MISSING_NOTE[id];
  // A pick of the first four heroes (the default party, Brann's parties, and every pick on the
  // way to one) keeps the notes it always had.
  if (known && party.every((h) => FIRST_FOUR.has(h))) return known;
  if (id === 'kael') return noTauntNote(party);
  if (id === 'lyra') return interruptNote(party);
  return known ?? txt('screens.rosterModel.noThisRun', { name: heroDef(id).name });
}

/**
 * Without Kael (no boss taunt): the boss's blows go to whoever holds its threat. Brann's 1.2 does
 * (as it always read); else a Warded Seren parries them; else, in Lyra, Vexis and Oro (OB, Q8),
 * nothing holds the bosses, and Oro won't.
 */
function noTauntNote(party: readonly string[]): string {
  if (partyTaunts(party)) return txt('screens.rosterModel.noKaelNoAegis');
  if (party.includes('brann')) return MISSING_NOTE.kael!;
  if (party.includes('seren')) return txt('screens.rosterModel.noKaelNothingTaunts2');
  if (party.includes('oro')) return txt('screens.rosterModel.noKaelNothingHolds');
  return txt('screens.rosterModel.noKaelNothingHolds2');
}

/** Without Lyra: who else interrupts, by name and ability ("Kael’s Shield Bash"). */
function interruptNote(party: readonly string[]): string {
  const who = canonical(party).flatMap((id) =>
    interruptAbilities(id).map((a) => {
      const def = heroDef(id);
      return `${def.name}’s ${def.abilities.find((x) => x.id === a)!.name}`;
    }),
  );
  if (who.length === 0) return txt('screens.rosterModel.noLyraNothingInterrupts');
  if (who.length === 1) return txt('screens.rosterModel.noLyraIsYour', { value: who[0] });
  const list = `${who.slice(0, -1).join(', ')} and ${who[who.length - 1]}`;
  return txt('screens.rosterModel.noLyraOnlyInterrupt', { list });
}

// ── Pronouns ─────────────────────────────────────────────────────────────────────────

export interface Pronouns {
  /** "he" */
  subj: string;
  /** "him" */
  obj: string;
  /** "his" */
  poss: string;
}

const HE: Pronouns = { subj: 'he', obj: 'him', poss: 'his' };
const SHE: Pronouns = { subj: 'she', obj: 'her', poss: 'her' };
const THEY: Pronouns = { subj: 'they', obj: 'them', poss: 'their' };
const PRONOUNS: Readonly<Record<string, Pronouns>> = {
  kael: HE,
  lyra: SHE,
  vexis: THEY,
  brann: HE,
  seren: SHE,
  oro: HE,
};

/** A hero's pronouns in the UI's copy (docs/phase-5e.md: Brann's copy narrowed by hero). */
export function heroPronouns(heroId: string): Pronouns {
  return PRONOUNS[heroId] ?? THEY;
}

/** A hero recruited since the last Prep, as Prep's "Newly unlocked" strip names them. */
export interface FreshHero {
  /** `hero.<id>`, kept in `profile.introduced` once shown. */
  id: string;
  name: string;
  text: string;
}

/** The recruits not yet introduced at Prep (`hero.<id>` not in `introduced`), in content order. */
export function freshHeroes(
  recruited: readonly string[],
  introduced: readonly string[],
): FreshHero[] {
  return canonical(recruited)
    .filter((id) => !CONTENT.defaultParty.includes(id) && !introduced.includes(`hero.${id}`))
    .map((id) => {
      const def = heroDef(id);
      return {
        id: `hero.${id}`,
        name: `${def.name}, ${def.title}`,
        text: txt('screens.rosterModel.joinsYourRosterChoose', {
          description: def.quirk.description,
        }),
      };
    });
}

// ── A hero's kit: Passive and Needs ───────────────────────────────────────────────────

/** A passive's name, by its id. */
const PASSIVE_NAME: Readonly<Record<string, string>> = {
  get bloodRage() {
    return txt('screens.rosterModel.bloodRage');
  },
  parry: 'Parry',
  rootbond: 'Rootbond',
};

/** A passive's glyph (Prep's card, the Codex): Blood Rage's flame, Seren's blades, Oro's leaf. */
export const PASSIVE_ICON = {
  bloodRage: 'flame',
  parry: 'blades',
  rootbond: 'leaf',
} as const;

/** The glyph for a hero's passive (the flame when it has none). */
export function passiveIcon(def: HeroDef): (typeof PASSIVE_ICON)[keyof typeof PASSIVE_ICON] {
  return def.passive ? PASSIVE_ICON[def.passive.id] : 'flame';
}

/**
 * A hero's Passive row (Prep's HeroCard, the Codex entry): its name and what it does, from the
 * def's numbers, narrowed by its id (Blood Rage, Parry, Rootbond). Null for a hero without one,
 * so the starters' cards are as they were.
 */
export function passiveRow(def: HeroDef): { name: string; text: string } | null {
  const passive = def.passive;
  if (passive?.id === 'parry')
    return {
      name: PASSIVE_NAME.parry!,
      text: txt('screens.rosterModel.whileWardedTheNext', {
        round: Math.round(passive.counterPct * 100),
        round2: Math.round(passive.eliteExecuteBelow * 100),
        killShotMult: passive.killShotMult,
      }),
    };
  if (passive?.id === 'rootbond')
    return {
      name: PASSIVE_NAME.rootbond!,
      text: txt('screens.rosterModel.yourThreadOnOro', {
        round: Math.round(passive.mendShare * 100),
      }),
    };
  const p = bloodRageOf(def);
  if (!p) return null;
  const { obj: him, poss: his } = heroPronouns(def.id);
  const halved =
    p.weaverHealMult === 0.5
      ? 'halved'
      : txt('screens.rosterModel.cutTo', { round: Math.round(p.weaverHealMult * 100) });
  return {
    name: PASSIVE_NAME[p.id] ?? p.id,
    text: txt('screens.rosterModel.upToDamageThe', {
      round: Math.round(p.maxBonus * 100),
      his,
      value: Math.round(p.perMissing * 100) / 100,
      him,
      value2: Math.round(p.lifesteal * 1000) / 10,
      halved,
    }),
  };
}

/** A share of healing in words: "a quarter", "an eighth", else a percent. */
function shareWords(x: number): string {
  if (Math.abs(x - 0.25) < 1e-9) return txt('screens.rosterModel.aQuarter');
  if (Math.abs(x - 0.125) < 1e-9) return txt('screens.rosterModel.anEighth');
  return `${Math.round(x * 100)}%`;
}

/**
 * The Codex's line on how his cut stacks (docs/phase-5b.md, "Weaver healing"): with a Wound, or
 * outside the Bloodmoon's pools, the cuts multiply. Both are Movement II's `HEAL_CUT`. Null for a
 * hero without a Weaver-heal cut.
 */
export function healCutStackText(def: HeroDef): string | null {
  const p = bloodRageOf(def);
  if (!p || p.weaverHealMult === 1) return null;
  const him = heroPronouns(def.id).obj;
  const one = p.weaverHealMult * (1 - HEAL_CUT);
  const both = one * (1 - HEAL_CUT);
  return txt('screens.rosterModel.itStacksWithA', {
    him,
    shareWords: shareWords(one),
    shareWords2: shareWords(both),
  });
}

/** A hero's Needs row: what keeping them alive asks of you. Null without one. */
export function needsRow(def: HeroDef): string | null {
  return def.needs ?? null;
}

/**
 * Oro's Saplings on Prep's card (docs/phase-5e.md): "2 Saplings · 456 life · take your songs ·
 * bosses ignore them", from his `summons`. Null for a hero without summons.
 */
export function summonsRow(def: HeroDef): string | null {
  const s = def.summons?.sapling;
  if (!s) return null;
  return txt('screens.rosterModel.saplingsLifeTakeYour', { count: s.count, maxHp: fmt(s.maxHp) });
}

// ── The Codex's terms and Oro's summons (docs/phase-5e.md) ─────────────────────────

export interface HeroTerm {
  term: string;
  text: string;
  /** The heroes the term belongs to: it shows once one of them is in the roster. */
  heroes: readonly string[];
}

/** The words Seren and Oro bring (docs/phase-5e.md, "Codex": Terms), with Heavy for both. */
export function heroTermList(): HeroTerm[] {
  const seren = heroDef('seren');
  const oro = heroDef('oro');
  const parry = seren.passive?.id === 'parry' ? seren.passive : null;
  const sapling = oro.summons?.sapling;
  const ancient = oro.summons?.ancient;
  const root = oro.abilities.find((a) => a.id === 'bramble')?.root ?? 1.5;
  return [
    {
      term: 'Parry',
      text: txt('screens.rosterModel.aWardOfYours', {
        PARRY_REACH,
        round: Math.round((parry?.counterPct ?? 3) * 100),
      }),
      heroes: ['seren'],
    },
    {
      term: txt('screens.rosterModel.killShot'),
      text: txt('screens.rosterModel.aPerfectWardOn', {
        round: Math.round((parry?.eliteExecuteBelow ?? 0.5) * 100),
        value: parry?.killShotMult ?? 6,
      }),
      heroes: ['seren'],
    },
    {
      term: 'Showboat',
      text: txt('screens.rosterModel.yourFocusMovesHer', { description: seren.quirk.description }),
      heroes: ['seren'],
    },
    {
      term: 'Sapling',
      text: sapling
        ? txt('screens.rosterModel.oneOfOroS', {
            count: sapling.count,
            maxHp: fmt(sapling.maxHp),
            radius: sapling.taunt.radius,
            respawn: sapling.respawn,
          })
        : txt('screens.rosterModel.oneOfOroS2'),
      heroes: ['oro'],
    },
    {
      term: 'Ancient',
      text: ancient
        ? txt('screens.rosterModel.oroSSoloA', {
            maxHp: fmt(ancient.maxHp),
            name: oro.solo.name,
            duration: oro.solo.duration,
            life: ancient.life,
            tauntRadius: ancient.tauntRadius,
          })
        : txt('screens.rosterModel.oroSSoloA2'),
      heroes: ['oro'],
    },
    {
      term: 'Rooted',
      text: txt('screens.rosterModel.heldInPlaceBy', { root }),
      heroes: ['oro'],
    },
    {
      term: 'Rootbond',
      text: passiveRow(oro)?.text ?? txt('screens.rosterModel.yourThreadOnOro2'),
      heroes: ['oro'],
    },
    {
      term: 'Tending',
      text: txt('screens.rosterModel.setAFocusTo', { description: oro.quirk.description }),
      heroes: ['oro'],
    },
    {
      term: 'Heavy',
      text: txt('screens.rosterModel.aNormalOrElite', { HEAVY_LIFE: fmt(HEAVY_LIFE) }),
      heroes: ['seren', 'oro'],
    },
  ];
}

/** The terms for this roster: none until Seren or Oro joins, so earlier Codexes are unchanged. */
export function heroTerms(roster: readonly string[]): HeroTerm[] {
  return heroTermList().filter((t) => t.heroes.some((h) => roster.includes(h)));
}

/**
 * Oro's Codex sub-entry, "Saplings and the Ancient" (docs/phase-5e.md), from his `summons`: a
 * line each. Empty for a hero without summons.
 */
export function summonsEntry(def: HeroDef): string[] {
  const s = def.summons;
  if (!s) return [];
  return [
    txt('screens.rosterModel.saplingsLifeArmourPlanted', {
      count: s.sapling.count,
      maxHp: fmt(s.sapling.maxHp),
      armor: pct(s.sapling.armor),
      forward: s.sapling.front.forward,
      damage: s.sapling.attack.damage,
      radius: s.sapling.taunt.radius,
      respawn: s.sapling.respawn,
      tendedBonus: pct(s.sapling.tendedBonus),
    }),
    txt('screens.rosterModel.theAncientLifeAfter', {
      name: def.solo.name,
      maxHp: fmt(s.ancient.maxHp),
      duration: def.solo.duration,
      life: s.ancient.life,
      tauntRadius: s.ancient.tauntRadius,
      radius: s.ancient.attack.radius,
      damage: s.ancient.attack.damage,
    }),
    txt('screens.rosterModel.bossesMinibossesAndThe'),
  ];
}

// ── The roster's locks ──────────────────────────────────────────────────────────────

const NUMERAL = ['', 'I', 'II', 'III', 'IV', 'V'];

/**
 * How a hero not yet in the roster is earned, both routes (the locked silhouette in the Codex):
 * "Free him from the Legion's cell in Movement II, or face Vharun." Read from the recruit's
 * `lockedText` (docs/phase-5e.md: each hero's own, with its Rank); null for a starter.
 */
export function lockedHeroText(heroId: string): string | null {
  const r = heroDef(heroId).recruit;
  if (!r) return null;
  if (r.lockedText) return r.lockedText;
  const event = CONTENT.events.find((e) => e.id === r.event);
  const m = event?.movement ?? 1;
  const where = event ? txt('screens.rosterModel.inMovement', { value: NUMERAL[m] ?? m }) : '';
  const face = r.fallback
    ? txt('screens.rosterModel.orFace', { shortName: shortName(encounterDef(r.fallback).name) })
    : '';
  return txt('screens.rosterModel.freeFromTheLegion', {
    obj: heroPronouns(heroId).obj,
    where,
    face,
  });
}

/** "Vharun, the Crimson Warden" → "Vharun". */
function shortName(name: string): string {
  return name.split(',')[0]!.replace(/^The /, 'the ');
}

/** The heroes outside the roster, in content order: the Codex's locked silhouettes. */
export function lockedHeroes(roster: readonly string[]): string[] {
  return CONTENT.heroes.filter((h) => !roster.includes(h.id)).map((h) => h.id);
}

// ── The Cell's copy and the recruit line ─────────────────────────────────────────────

/** The hero a choice's fight recruits, if any. */
export function choiceRecruit(choice: Pick<EventChoice, 'effects'>): string | null {
  for (const e of choice.effects) if (e.kind === 'fight' && e.recruit) return e.recruit;
  return null;
}

/**
 * The roster a recruiting choice's text reads against: the heroes the profile has really
 * recruited (and the starters), never "Skip the unlocks"' whole list. Winning the Cell recruits
 * him whatever that setting says, so the choice says so until he's truly free (docs/phase-5b.md).
 */
export function choiceRoster(recruited: readonly string[] | undefined): string[] {
  const owned = new Set([...CONTENT.defaultParty, ...(recruited ?? [])]);
  return CONTENT.heroes.filter((h) => owned.has(h.id)).map((h) => h.id);
}

/**
 * A choice's text as this run should read it: `partyText` once its recruit is in the party,
 * else `recruitedText` once in the roster, else its own. Draws nothing; any other choice keeps
 * its text.
 */
export function choiceText(
  choice: Pick<EventChoice, 'effects' | 'text' | 'recruitedText' | 'partyText'>,
  party: readonly string[],
  roster?: readonly string[],
): string {
  const hero = choiceRecruit(choice);
  if (!hero) return choice.text;
  if (party.includes(hero) && choice.partyText) return choice.partyText;
  if ((roster?.includes(hero) || party.includes(hero)) && choice.recruitedText)
    return choice.recruitedText;
  return choice.text;
}

/**
 * The Result's line for a hero just recruited: by the event's fight, they join from your next run;
 * by the fallback (the fight with `recruit.fallback`, won or lost), the recruit's own
 * `fallbackText` (Brann slipped his chain in the chaos). `cause` 'word' (docs/phase-5e.md,
 * `recruitCause`): an earlier fight of this run counted once your Rank opened the hero.
 */
export function recruitLine(
  heroId: string,
  encounterId: string | null | undefined,
  cause?: 'event' | 'fallback' | 'word',
): string {
  const def = heroDef(heroId);
  const fallback = def.recruit?.fallback;
  const joins = txt('screens.rosterModel.willFightBesideYou', { name: def.name, title: def.title });
  if (cause === 'word') return `${joins} ${recruitWordLine(heroId)}`;
  if (fallback && encounterId === fallback)
    return (
      def.recruit?.fallbackText ??
      txt('screens.rosterModel.inTheChaosOf', { shortName: shortName(encounterDef(fallback).name) })
    );
  return joins;
}

// ── Brann's line on the Result and the Summary ───────────────────────────────────────

/** The run plays Blood Oath for this hero: your healing on him isn't cut. */
export function oathIn(run: Pick<RunState, 'bonds'>, heroId: string): boolean {
  return run.bonds.some((b) => b.heroId === heroId && b.talents.includes('blood_oath'));
}

/** A hero's blood stats over a run's results (the Summary's line); null without any. */
export function runBlood(run: Pick<RunState, 'results'>, heroId: string): HeroBloodStats | null {
  return sumBlood(
    run.results
      .flatMap((r) => r.heroes.filter((h) => h.heroId === heroId && h.blood))
      .map((h) => h.blood!),
  );
}

/** Sums a hero's blood stats over results (the Summary's run total). */
export function sumBlood(stats: readonly HeroBloodStats[]): HeroBloodStats | null {
  if (stats.length === 0) return null;
  return stats.reduce((a, b) => ({
    lifesteal: a.lifesteal + b.lifesteal,
    lowTime: a.lowTime + b.lowTime,
    low30Time: a.low30Time + b.low30Time,
    aliveTime: a.aliveTime + b.aliveTime,
    peakAfterLow: Math.max(a.peakAfterLow, b.peakAfterLow),
    spent: a.spent + b.spent,
  }));
}

/**
 * "Under 40%: 62% of the fight · Lifesteal 1,240 · Your healing on him: halved" (docs/phase-5b.md),
 * from the result's `heroes[i].blood`. `oath`: Blood Oath played, so the cut was lifted.
 */
export function bloodLine(heroId: string, b: HeroBloodStats, oath = false, run = false): string {
  const def = heroDef(heroId);
  const below = Math.round((def.quirk.below ?? 0.4) * 100);
  const share = b.aliveTime > 0 ? b.lowTime / b.aliveTime : 0;
  const mult = bloodRageOf(def)?.weaverHealMult ?? 1;
  const cut = oath ? txt('screens.rosterModel.fullBloodOath') : mult === 0.5 ? 'halved' : pct(mult);
  return txt('screens.rosterModel.underOfTheLifesteal', {
    below,
    share: pct(share),
    value: run ? txt('screens.rosterModel.run') : txt('screens.rosterModel.fight'),
    lifesteal: fmt(b.lifesteal),
    obj: heroPronouns(heroId).obj,
    cut,
  });
}

// ── Seren's and Oro's lines on the Result and the Summary (docs/phase-5e.md) ─────────

/** A hero's duel stats over a run's results (the Summary's line); null without any. */
export function runDuel(run: Pick<RunState, 'results'>, heroId: string): HeroDuelStats | null {
  return sumDuel(
    run.results
      .flatMap((r) => r.heroes.filter((h) => h.heroId === heroId && h.duel))
      .map((h) => h.duel!),
  );
}

/** Sums a hero's duel stats over results. */
export function sumDuel(stats: readonly HeroDuelStats[]): HeroDuelStats | null {
  if (stats.length === 0) return null;
  return stats.reduce((a, b) => ({
    parries: a.parries + b.parries,
    killShots: a.killShots + b.killShots,
    counterDamage: a.counterDamage + b.counterDamage,
    overextendedTime: a.overextendedTime + b.overextendedTime,
    ...(a.wardsDealt !== undefined || b.wardsDealt !== undefined
      ? { wardsDealt: wardsDealt(a) + wardsDealt(b) }
      : {}),
  }));
}

/**
 * What your Wards dealt through her: the ledger's (the Ward counters and the kill shots), or, on
 * results from before it was kept, her counters' damage.
 */
function wardsDealt(d: HeroDuelStats): number {
  return d.wardsDealt ?? d.counterDamage;
}

/**
 * "Seren · parries 14 · kill shots 3 · your Wards dealt 4,210 · overextended 6 s", from the
 * result's `heroes[i].duel`: what your Wards on her did (the counters and kill shots).
 */
export function duelLine(heroId: string, d: HeroDuelStats): string {
  const def = heroDef(heroId);
  const over = Math.round(d.overextendedTime);
  return txt('screens.rosterModel.parriesKillShotsYour', {
    name: def.name,
    parries: fmt(d.parries),
    killShots: fmt(d.killShots),
    wardsDealt: fmt(wardsDealt(d)),
    value: over > 0 ? txt('screens.rosterModel.overextendedS', { over }) : '',
  });
}

/** A hero's grove stats over a run's results (the Summary's line); null without any. */
export function runGrove(run: Pick<RunState, 'results'>, heroId: string): HeroGroveStats | null {
  return sumGrove(
    run.results
      .flatMap((r) => r.heroes.filter((h) => h.heroId === heroId && h.grove))
      .map((h) => h.grove!),
  );
}

/**
 * Sums a hero's grove stats over results: the in-songs share is the plain mean of the fights'
 * (each fight's own share; the results keep no alive time).
 */
export function sumGrove(stats: readonly HeroGroveStats[]): HeroGroveStats | null {
  if (stats.length === 0) return null;
  const total = stats.reduce((a, b) => ({
    saplingsLost: a.saplingsLost + b.saplingsLost,
    inFieldShare: a.inFieldShare + b.inFieldShare,
    rootbondHeal: a.rootbondHeal + b.rootbondHeal,
    ancients: a.ancients + b.ancients,
    ...(a.summonDamage !== undefined || b.summonDamage !== undefined
      ? { summonDamage: (a.summonDamage ?? 0) + (b.summonDamage ?? 0) }
      : {}),
  }));
  return { ...total, inFieldShare: total.inFieldShare / stats.length };
}

/** "Oro · Saplings in your songs 74% · felled 3 · Rootbond 1,120", from `heroes[i].grove`. */
export function groveLine(heroId: string, g: HeroGroveStats): string {
  const def = heroDef(heroId);
  return txt('screens.rosterModel.saplingsInYourSongs', {
    name: def.name,
    inFieldShare: pct(g.inFieldShare),
    saplingsLost: fmt(g.saplingsLost),
    rootbondHeal: fmt(g.rootbondHeal),
    value: g.ancients > 0 ? txt('screens.rosterModel.ancients', { ancients: fmt(g.ancients) }) : '',
  });
}

// ── Harmonies on motif cards ─────────────────────────────────────────────────────────

/** A Harmony (tagged 'harmony', docs/phase-5b.md): its card wears a ribbon. */
export function isHarmony(motifId: string): boolean {
  return motifDef(motifId).tags.includes('harmony');
}

/** What a Harmony's offer checks, from the run (Phase 5g): motifs owned, songs, party. */
export interface HarmonyHave {
  motifs: readonly { id: string }[];
  /** The run's Chords (`run.chords`): an aura gate reads its auras. */
  chords?: readonly { auras: readonly string[] }[];
  /** The party's hero ids. */
  party?: readonly string[];
}

/** One thing a Harmony needs, and whether the run has it. */
export interface HarmonyNeed {
  kind: 'hero' | 'motif' | 'aura';
  id: string;
  /** "Kael in your party", "Iron Answer", "Fortissimo in your songs". */
  text: string;
  owned: boolean;
}

/**
 * Phase 5g (docs/phase-5g.md): everything a Harmony needs, in the doc's order (its hero, its
 * motifs, an aura in your songs), each marked owned or missing for this run. Empty for a motif
 * that isn't a Harmony (no `requires.motifs`). The draft offers one only once all are owned
 * (`run.ts` `eligible`); a merchant, or a prerequisite lost after, can show one missing.
 */
export function harmonyPrereqs(motifId: string, have: HarmonyHave): HarmonyNeed[] {
  const req = motifDef(motifId).requires;
  if (!req.motifs) return [];
  const needs: HarmonyNeed[] = [];
  if (req.hero)
    needs.push({
      kind: 'hero',
      id: req.hero,
      text: txt('screens.rosterModel.inYourParty', { name: heroDef(req.hero).name }),
      owned: (have.party ?? []).includes(req.hero),
    });
  for (const id of req.motifs)
    needs.push({
      kind: 'motif',
      id,
      text: motifDef(id).name,
      owned: have.motifs.some((m) => m.id === id),
    });
  if (req.aura)
    needs.push({
      kind: 'aura',
      id: req.aura,
      text: txt('screens.rosterModel.inYourSongs', { name: auraDef(req.aura).name }),
      owned: (have.chords ?? []).some((c) => c.auras.includes(req.aura!)),
    });
  return needs;
}

/** A Harmony a prerequisite's card points at, with what else it needs. */
export interface HarmonyLead {
  harmony: MotifDef;
  /** "Harmony: with Taut Release → Blood and Silk". */
  text: string;
  /** The Harmony's other needs (its hero aside), owned or missing when `have` is given. */
  others: HarmonyNeed[];
}

/**
 * Every Harmony this motif is a prerequisite of (Razor Silk leads to two), in content order,
 * skipping one whose hero isn't in the party. The text names the other motifs, then an aura gate
 * ("with Fortissimo in your songs"). With `have`, each other need says whether the run has it;
 * without, every one reads missing.
 */
export function harmonyLeads(
  motifId: string,
  party: readonly string[],
  have?: HarmonyHave,
): HarmonyLead[] {
  const out: HarmonyLead[] = [];
  for (const h of CONTENT.motifs) {
    const pre = h.requires.motifs;
    if (!pre?.includes(motifId)) continue;
    if (h.requires.hero && !party.includes(h.requires.hero)) continue;
    const others = harmonyPrereqs(h.id, have ?? { motifs: [], party }).filter(
      (n) => n.kind !== 'hero' && !(n.kind === 'motif' && n.id === motifId),
    );
    const named = others.map((n) => n.text);
    out.push({
      harmony: h,
      text: txt('screens.rosterModel.harmony', {
        value:
          named.length > 0 ? txt('screens.rosterModel.with', { named: named.join(' and ') }) : '',
        name: h.name,
      }),
      others,
    });
  }
  return out;
}

/**
 * On a prerequisite's card, when the Harmony's hero is in the party: "Harmony: with Taut Release →
 * Blood and Silk". Null for any other card, or a party without that hero. The first of
 * `harmonyLeads`.
 */
export function harmonyHint(motifId: string, party: readonly string[]): string | null {
  return harmonyLeads(motifId, party)[0]?.text ?? null;
}

/** A Harmony's prerequisites, by name ("Blood Tithe and Taut Release"); empty for others. */
export function harmonyNeeds(motifId: string): string[] {
  return (motifDef(motifId).requires.motifs ?? []).map((id) => motifDef(id).name);
}
