/**
 * The roster on screen (docs/phase-5b.md), as plain data so it is testable without React: Prep's
 * party picker (exactly three, their keys in canonical order), the note for each missing starter,
 * a hero's Passive and Needs rows, the locked silhouette's two-route text, the Cell's copy by
 * roster and party, the Result's recruit line, Brann's line on the Result and the Summary, and
 * the Harmony ribbon and 'would enable' hint on motif cards. Every list keeps content order.
 */
import { CONTENT, encounterDef, heroDef, motifDef, type HeroDef } from '../../content';
import { HEAL_CUT } from '../../content/legion';
import type { EventChoice } from '../../content/schema';
import type { HeroBloodStats, RunState } from '../../meta/types';
import { fmt, pct } from '../kit/format';
import { PARTY_SIZE } from './prepParty';
import type { Action } from '../../input/actions';
import { bindingLabel } from '../hud/labels';

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
  return more > 0 ? `Pick ${more} more ${more === 1 ? 'hero' : 'heroes'}` : null;
}

export interface StarterNote {
  heroId: string;
  text: string;
}

/** What a party loses without each starter (docs/phase-5b.md, "Prep"), by starter. */
const MISSING_NOTE: Readonly<Record<string, string>> = {
  kael: 'No Kael: nothing taunts. Twin Cleave and Execution will find Brann — keep a Reel and a Ward for him.',
  lyra: 'No Lyra: only Kael’s Shield Bash and Brann’s Sunder Leap interrupt. Break guards with Focus.',
  vexis: 'No Vexis: no Gravity Well — swarms stay spread out.',
};

/** One note per starter the party leaves out (none for the default party). */
export function missingStarterNotes(party: readonly string[]): StarterNote[] {
  return CONTENT.defaultParty
    .filter((id) => !party.includes(id))
    .map((id) => ({
      heroId: id,
      text: MISSING_NOTE[id] ?? `No ${heroDef(id).name} this run.`,
    }));
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
        text: `joins your roster. Choose your three under Your party: ${def.quirk.description}`,
      };
    });
}

// ── A hero's kit: Passive and Needs ───────────────────────────────────────────────────

/** A passive's name, by its id. */
const PASSIVE_NAME: Readonly<Record<string, string>> = { bloodRage: 'Blood Rage' };

/**
 * A hero's Passive row (Prep's HeroCard, the Codex entry): its name and what it does, from the
 * def's numbers. Null for a hero without one, so the starters' cards are as they were.
 */
export function passiveRow(def: HeroDef): { name: string; text: string } | null {
  const p = def.passive;
  if (!p) return null;
  const halved =
    p.weaverHealMult === 0.5 ? 'halved' : `cut to ${Math.round(p.weaverHealMult * 100)}%`;
  return {
    name: PASSIVE_NAME[p.id] ?? p.id,
    text: `Up to +${Math.round(p.maxBonus * 100)}% damage the lower his life (+${Math.round(p.perMissing * 100) / 100}% for each 1% missing), and his axe heals him for ${Math.round(p.lifesteal * 100)}% of what it deals. Your healing on him is ${halved}; your Wards and barriers aren’t.`,
  };
}

/** A share of healing in words: "a quarter", "an eighth", else a percent. */
function shareWords(x: number): string {
  if (Math.abs(x - 0.25) < 1e-9) return 'a quarter';
  if (Math.abs(x - 0.125) < 1e-9) return 'an eighth';
  return `${Math.round(x * 100)}%`;
}

/**
 * The Codex's line on how his cut stacks (docs/phase-5b.md, "Weaver healing"): with a Wound, or
 * outside the Bloodmoon's pools, the cuts multiply. Both are Movement II's `HEAL_CUT`. Null for a
 * hero without a Weaver-heal cut.
 */
export function healCutStackText(def: HeroDef): string | null {
  const p = def.passive;
  if (!p || p.weaverHealMult === 1) return null;
  const one = p.weaverHealMult * (1 - HEAL_CUT);
  const both = one * (1 - HEAL_CUT);
  return `It stacks: with a Wound on him, or outside the Bloodmoon’s pools, your healing on him is ${shareWords(one)}; with both, ${shareWords(both)}. A Chime clears the Wound; a pool or a Ward is the answer to the rest.`;
}

/** A hero's Needs row: what keeping them alive asks of you. Null without one. */
export function needsRow(def: HeroDef): string | null {
  return def.needs ?? null;
}

// ── The roster's locks ──────────────────────────────────────────────────────────────

const NUMERAL = ['', 'I', 'II', 'III', 'IV', 'V'];

/**
 * How a hero not yet in the roster is earned, both routes (the locked silhouette in the Codex):
 * "Free him from the Legion's cell in Movement II, or face Vharun." Null for a starter.
 */
export function lockedHeroText(heroId: string): string | null {
  const r = heroDef(heroId).recruit;
  if (!r) return null;
  const event = CONTENT.events.find((e) => e.id === r.event);
  const m = event?.movement ?? 1;
  const where = event ? ` in Movement ${NUMERAL[m] ?? m}` : '';
  const face = r.fallback ? `, or face ${shortName(encounterDef(r.fallback).name)}` : '';
  return `Free him from the Legion’s cell${where}${face}.`;
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
 * The Result's line for a hero just recruited: by the Cell, he joins from your next run; by the
 * fallback (the fight with `recruit.fallback`, won or lost), he slipped his chain in the chaos.
 */
export function recruitLine(heroId: string, encounterId: string | null | undefined): string {
  const def = heroDef(heroId);
  const fallback = def.recruit?.fallback;
  if (fallback && encounterId === fallback)
    return `In the chaos of your stand against ${shortName(encounterDef(fallback).name)}, the prisoner slipped his chain. He’ll find you before your next run.`;
  return `${def.name}, ${def.title}, will fight beside you from your next run.`;
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
  const mult = def.passive?.weaverHealMult ?? 1;
  const cut = oath ? 'full (Blood Oath)' : mult === 0.5 ? 'halved' : pct(mult);
  return `Under ${below}%: ${pct(share)} of the ${run ? 'run' : 'fight'} · Lifesteal ${fmt(b.lifesteal)} · Your healing on him: ${cut}`;
}

// ── Harmonies on motif cards ─────────────────────────────────────────────────────────

/** A Harmony (tagged 'harmony', docs/phase-5b.md): its card wears a ribbon. */
export function isHarmony(motifId: string): boolean {
  return motifDef(motifId).tags.includes('harmony');
}

/**
 * On a prerequisite's card, when the Harmony's hero is in the party: "Harmony: with Taut Release →
 * Blood and Silk". Null for any other card, or a party without that hero.
 */
export function harmonyHint(motifId: string, party: readonly string[]): string | null {
  for (const h of CONTENT.motifs) {
    const pre = h.requires.motifs;
    if (!pre?.includes(motifId)) continue;
    if (h.requires.hero && !party.includes(h.requires.hero)) continue;
    const others = pre.filter((id) => id !== motifId).map((id) => motifDef(id).name);
    return `Harmony: ${others.length > 0 ? `with ${others.join(' and ')} ` : ''}→ ${h.name}`;
  }
  return null;
}

/** A Harmony's prerequisites, by name ("Blood Tithe and Taut Release"); empty for others. */
export function harmonyNeeds(motifId: string): string[] {
  return (motifDef(motifId).requires.motifs ?? []).map((id) => motifDef(id).name);
}
