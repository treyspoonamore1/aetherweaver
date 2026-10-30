/**
 * CONTRACT v11 — the Reliquary (docs/phase-4c.md): relics kept between runs, their Inscriptions
 * and the crafting that shapes them. Pure: every function takes the Reliquary and returns a new
 * one. Randomness comes only from the Reliquary's own `seed`, advanced by each roll and saved
 * with the profile, so reloading can't roll a craft again.
 */
import {
  CONTENT,
  curseDef,
  inscriptionDef,
  relicDef,
  type InscriptionCategory,
  type InscriptionDef,
  type PassiveEffect,
  type RelicDef,
} from '../content';
import { Rng } from '../sim/core/rng';
import type { RunState } from './types';

/** An Inscription on a relic: which, its tier (5 = T5, the weakest, to 1 = T1) and its value. */
export interface Inscription {
  id: string;
  tier: number;
  value: number;
}

/** What a Dissonate did: the relic can't be crafted again. */
export type DissonanceKind = 'dissonant' | 'empowered' | 'cursed' | 'shattered';
export interface Dissonance {
  kind: DissonanceKind;
  /** Dissonant: its fifth slot. */
  inscription?: string;
  /** Cursed: the curse it carries. */
  curse?: string;
}

/** An enshrined relic: its own, with its own Inscriptions. */
export interface ReliquaryRelic {
  /** Unique within the Reliquary ("r1", "r2", …). */
  uid: string;
  /** The relic (content `relics`). */
  id: string;
  /** A cursed relic a Forge cleansed in the run it came from. */
  cleansed: boolean;
  inscriptions: Inscription[];
  /** 0–100: only rises. Past `fracture.above`, every craft risks a Fracture. */
  instability: number;
  /** Frozen as it was: carried and played, never crafted again. */
  fractured: boolean;
  dissonance: Dissonance | null;
}

export interface Reliquary {
  relics: ReliquaryRelic[];
  /** Tuning Shards. */
  shards: number;
  /** Discord Tears. */
  tears: number;
  /** The relics chosen to carry into the next run, by uid. */
  carry: string[];
  /** The crafting rolls' state: every roll draws from it and moves it on. */
  seed: number;
  /** The next uid's number. */
  next: number;
}

export function emptyReliquary(seed = 1): Reliquary {
  return { relics: [], shards: 0, tears: 0, carry: [], seed: seed >>> 0, next: 1 };
}

const RULES = () => CONTENT.reliquary;

// ── Ranks ────────────────────────────────────────────────────────────────────────────

/** The Reliquary opens at the first slot's Rank (or with Skip the unlocks). */
export function reliquaryOpen(rank: number, all = false): boolean {
  return all || rank >= RULES().slotRanks[0]!;
}

/** How many relics a run may carry: 0 until the Reliquary opens, then 1, 2, 3. */
export function carrySlots(rank: number, all = false): number {
  const ranks = RULES().slotRanks;
  return all ? ranks.length : ranks.filter((r) => rank >= r).length;
}

// ── Reading a relic ──────────────────────────────────────────────────────────────────

/** Can it still be crafted? (Not after a Fracture or a Dissonate.) */
export function craftable(r: ReliquaryRelic): boolean {
  return !r.fractured && r.dissonance === null;
}

/** It plays its empowered numbers. */
export function empowered(r: ReliquaryRelic): boolean {
  return r.dissonance?.kind === 'empowered';
}

/** What it adds to a fight: its Inscriptions, a Dissonant one, a curse. */
export function relicPassives(r: ReliquaryRelic): { effect: PassiveEffect; value: number }[] {
  const out: { effect: PassiveEffect; value: number }[] = [];
  for (const ins of r.inscriptions) {
    const def = inscriptionDef(ins.id);
    if (def.kind === 'normal') out.push({ effect: def.effect, value: ins.value });
  }
  const d = r.dissonance;
  if (d?.kind === 'dissonant' && d.inscription) {
    const def = inscriptionDef(d.inscription);
    if (def.kind === 'dissonant') out.push(...def.effects.map((e) => ({ ...e })));
  }
  if (d?.kind === 'cursed' && d.curse)
    out.push(...curseDef(d.curse).effects.map((e) => ({ ...e })));
  return out;
}

/** The Fracture chance (0–1) a craft runs at this Instability. */
export function fractureChance(instability: number): number {
  const f = RULES().fracture;
  return Math.min(1, Math.max(0, ((instability - f.above) * f.perPoint) / 100));
}

/** The shards a relic gives when it's released. */
export function releaseValue(r: ReliquaryRelic): number {
  const v = RULES().release;
  return v[relicDef(r.id).rarity] + v.perInscription * r.inscriptions.length;
}

/** The normal Inscriptions of a category this relic doesn't have yet. */
export function inscribable(r: ReliquaryRelic, category: InscriptionCategory): InscriptionDef[] {
  const have = new Set(r.inscriptions.map((i) => i.id));
  return CONTENT.inscriptions.filter(
    (d) => d.kind === 'normal' && d.category === category && !have.has(d.id),
  );
}

// ── Odds (what the screen shows before a craft) ──────────────────────────────────────

export type CraftAction = 'inscribe' | 'retune' | 'ascend' | 'dissonate';

export interface CraftOdds {
  /** What it costs: shards, or Discord Tears for a Dissonate. */
  shards: number;
  tears: number;
  /** The chance (0–1) the craft Fractures the relic instead. */
  fracture: number;
  /** Instability after it. */
  instability: number;
  /** Inscribe: the chance of each tier, T5 first (0–1). */
  tiers?: number[];
  /** Ascend: the chance to rise (0–1). */
  success?: number;
  /** Dissonate: the chance of each outcome (0–1). */
  outcomes?: Record<DissonanceKind, number>;
}

/** Why a craft can't be made now; null when it can. */
export function craftBlocked(
  rq: Reliquary,
  r: ReliquaryRelic,
  action: CraftAction,
  arg?: number | InscriptionCategory,
): string | null {
  const rules = RULES();
  if (r.fractured) return 'It’s fractured: it stays as it is.';
  if (r.dissonance) return 'It was Dissonated: it stays as it is.';
  switch (action) {
    case 'inscribe': {
      if (r.inscriptions.length >= rules.maxInscriptions)
        return `It holds ${rules.maxInscriptions} Inscriptions already.`;
      if (typeof arg === 'string' && inscribable(r, arg).length === 0)
        return 'It has every Inscription of that kind.';
      if (rq.shards < rules.inscribe.cost) return 'Not enough Tuning Shards.';
      return null;
    }
    case 'retune': {
      const ins = typeof arg === 'number' ? r.inscriptions[arg] : undefined;
      if (!ins) return 'Choose an Inscription.';
      const [min, max] = tierRange(ins);
      if (min === max) return 'Its tier has only one value.';
      if (rq.shards < rules.retune.cost) return 'Not enough Tuning Shards.';
      return null;
    }
    case 'ascend': {
      const ins = typeof arg === 'number' ? r.inscriptions[arg] : undefined;
      if (!ins) return 'Choose an Inscription.';
      if (ins.tier - 1 < rules.tierCap) return `T${rules.tierCap - 1} and T1 wait for Dissonance.`;
      if (rq.shards < rules.ascend.cost) return 'Not enough Tuning Shards.';
      return null;
    }
    case 'dissonate':
      if (rq.tears < rules.dissonate.cost) return 'No Discord Tear.';
      return null;
  }
}

/** What a craft would cost and risk, as the screen shows it. */
export function craftOdds(r: ReliquaryRelic, action: CraftAction, index?: number): CraftOdds {
  const rules = RULES();
  const fracture = fractureChance(r.instability);
  const after = (gain: number) => Math.min(100, r.instability + gain);
  switch (action) {
    case 'inscribe':
      return {
        shards: rules.inscribe.cost,
        tears: 0,
        fracture,
        instability: after(rules.inscribe.instability),
        tiers: rules.inscribe.tierOdds.map((p) => p / 100),
      };
    case 'retune':
      return {
        shards: rules.retune.cost,
        tears: 0,
        fracture,
        instability: after(rules.retune.instability),
      };
    case 'ascend': {
      const ins = index === undefined ? undefined : r.inscriptions[index];
      return {
        shards: rules.ascend.cost,
        tears: 0,
        fracture,
        instability: after(rules.ascend.instability),
        success: ins ? (rules.ascend.odds[5 - ins.tier] ?? 0) / 100 : 0,
      };
    }
    case 'dissonate':
      return {
        shards: 0,
        tears: rules.dissonate.cost,
        // Its own gamble: no Fracture.
        fracture: 0,
        instability: r.instability,
        outcomes: dissonateOdds(relicDef(r.id)),
      };
  }
}

/** A Dissonate's outcomes for this relic: one that can't be Empowered turns Dissonant instead. */
function dissonateOdds(def: RelicDef): Record<DissonanceKind, number> {
  const w = { ...RULES().dissonate.weights };
  if (!def.empowered) {
    w.dissonant += w.empowered;
    w.empowered = 0;
  }
  const total = w.dissonant + w.empowered + w.cursed + w.shattered;
  return {
    dissonant: w.dissonant / total,
    empowered: w.empowered / total,
    cursed: w.cursed / total,
    shattered: w.shattered / total,
  };
}

// ── Crafting ─────────────────────────────────────────────────────────────────────────

export type CraftOutcome =
  | { kind: 'inscribed'; inscription: Inscription }
  | { kind: 'retuned'; index: number; from: number; to: number }
  | { kind: 'ascended'; index: number; inscription: Inscription }
  | { kind: 'missed'; index: number }
  | { kind: 'fractured' }
  | { kind: 'dissonated'; dissonance: Dissonance };

export type CraftResult =
  { ok: true; reliquary: Reliquary; outcome: CraftOutcome } | { ok: false; reason: string };

function tierRange(ins: Inscription): [number, number] {
  const def = inscriptionDef(ins.id);
  return def.kind === 'normal' ? def.tiers[5 - ins.tier]! : [ins.value, ins.value];
}

/** A value within the tier, in the Inscription's steps. */
function rollValue(rng: Rng, def: InscriptionDef, tier: number): number {
  if (def.kind !== 'normal') return 0;
  const [min, max] = def.tiers[5 - tier]!;
  const steps = Math.round((max - min) / def.step) + 1;
  return Math.round((min + rng.int(steps) * def.step) * 1000) / 1000;
}

/** A tier by the given percentages, T5 first. */
function rollTier(rng: Rng, odds: readonly number[]): number {
  let roll = rng.float() * odds.reduce((a, b) => a + b, 0);
  for (let i = 0; i < odds.length; i++) {
    roll -= odds[i]!;
    if (roll < 0) return 5 - i;
  }
  return 5;
}

/** A new Inscription of the category, as Inscribe rolls it; null if none is left. */
function rollInscription(
  rng: Rng,
  r: ReliquaryRelic,
  category: InscriptionCategory,
): Inscription | null {
  const options = inscribable(r, category);
  if (options.length === 0) return null;
  const def = options[rng.int(options.length)]!;
  const tier = rollTier(rng, RULES().inscribe.tierOdds);
  return { id: def.id, tier, value: rollValue(rng, def, tier) };
}

/** Runs one craft on a relic: its roll draws on the seed; the seed moves on. */
function craft(
  rq: Reliquary,
  uid: string,
  action: CraftAction,
  arg: number | InscriptionCategory | undefined,
  apply: (r: ReliquaryRelic, rng: Rng) => { relic: ReliquaryRelic; outcome: CraftOutcome },
): CraftResult {
  const relic = rq.relics.find((r) => r.uid === uid);
  if (!relic) return { ok: false, reason: 'No such relic.' };
  const blocked = craftBlocked(rq, relic, action, arg);
  if (blocked) return { ok: false, reason: blocked };
  const rules = RULES();
  const rng = new Rng(rq.seed);
  const cost =
    action === 'dissonate'
      ? { shards: 0, tears: rules.dissonate.cost }
      : { shards: rules[action].cost, tears: 0 };
  const paid = { ...rq, shards: rq.shards - cost.shards, tears: rq.tears - cost.tears };
  let next: ReliquaryRelic;
  let outcome: CraftOutcome;
  // Past `fracture.above`, the craft may Fracture the relic instead (a Dissonate never does).
  if (action !== 'dissonate' && rng.float() < fractureChance(relic.instability)) {
    next = { ...relic, fractured: true };
    outcome = { kind: 'fractured' };
  } else {
    ({ relic: next, outcome } = apply(relic, rng));
    if (action !== 'dissonate')
      next = { ...next, instability: Math.min(100, relic.instability + rules[action].instability) };
  }
  return {
    ok: true,
    reliquary: {
      ...paid,
      relics: rq.relics.map((r) => (r.uid === uid ? next : r)),
      seed: rng.nextU32(),
    },
    outcome,
  };
}

/** Inscribe: a random Inscription of the chosen category joins the relic. */
export function inscribe(rq: Reliquary, uid: string, category: InscriptionCategory): CraftResult {
  return craft(rq, uid, 'inscribe', category, (r, rng) => {
    const inscription = rollInscription(rng, r, category)!;
    return {
      relic: { ...r, inscriptions: [...r.inscriptions, inscription] },
      outcome: { kind: 'inscribed', inscription },
    };
  });
}

/** Retune: one Inscription's value rolled again within its tier. */
export function retune(rq: Reliquary, uid: string, index: number): CraftResult {
  return craft(rq, uid, 'retune', index, (r, rng) => {
    const ins = r.inscriptions[index]!;
    const value = rollValue(rng, inscriptionDef(ins.id), ins.tier);
    const inscriptions = r.inscriptions.map((x, i) => (i === index ? { ...x, value } : x));
    return {
      relic: { ...r, inscriptions },
      outcome: { kind: 'retuned', index, from: ins.value, to: value },
    };
  });
}

/** Ascend: a chance to raise one Inscription a tier; a miss changes nothing. */
export function ascend(rq: Reliquary, uid: string, index: number): CraftResult {
  return craft(rq, uid, 'ascend', index, (r, rng) => {
    const ins = r.inscriptions[index]!;
    const odds = RULES().ascend.odds[5 - ins.tier] ?? 0;
    if (rng.float() * 100 >= odds) return { relic: r, outcome: { kind: 'missed', index } };
    const tier = ins.tier - 1;
    const inscription = { ...ins, tier, value: rollValue(rng, inscriptionDef(ins.id), tier) };
    const inscriptions = r.inscriptions.map((x, i) => (i === index ? inscription : x));
    return { relic: { ...r, inscriptions }, outcome: { kind: 'ascended', index, inscription } };
  });
}

/** Dissonate: the final gamble, for a Discord Tear. */
export function dissonate(rq: Reliquary, uid: string): CraftResult {
  return craft(rq, uid, 'dissonate', undefined, (r, rng) => {
    const odds = dissonateOdds(relicDef(r.id));
    let roll = rng.float();
    let kind: DissonanceKind = 'shattered';
    for (const k of ['dissonant', 'empowered', 'cursed', 'shattered'] as const) {
      roll -= odds[k];
      if (roll < 0) {
        kind = k;
        break;
      }
    }
    let relic = r;
    let dissonance: Dissonance = { kind };
    if (kind === 'dissonant') {
      const options = CONTENT.inscriptions.filter((d) => d.kind === 'dissonant');
      dissonance = { kind, inscription: options[rng.int(options.length)]!.id };
    } else if (kind === 'cursed') {
      // Every Inscription rises a tier, as far as T2; a curse joins it.
      const cap = RULES().dissonate.cursedTierCap;
      const inscriptions = r.inscriptions.map((ins) => {
        const tier = Math.max(cap, ins.tier - 1);
        return tier === ins.tier
          ? ins
          : { ...ins, tier, value: rollValue(rng, inscriptionDef(ins.id), tier) };
      });
      relic = { ...r, inscriptions };
      dissonance = { kind, curse: CONTENT.curses[rng.int(CONTENT.curses.length)]!.id };
    }
    return { relic: { ...relic, dissonance }, outcome: { kind: 'dissonated', dissonance } };
  });
}

// ── In and out ───────────────────────────────────────────────────────────────────────

export type EnshrineResult =
  { ok: true; reliquary: Reliquary; relic: ReliquaryRelic } | { ok: false; reason: string };

/**
 * A relic a won run found joins the Reliquary, with its first Inscriptions (by rarity, rolled as
 * Inscribe rolls them, from random categories, adding no Instability).
 */
export function enshrine(rq: Reliquary, found: { id: string; cleansed: boolean }): EnshrineResult {
  const rules = RULES();
  if (rq.relics.length >= rules.capacity)
    return { ok: false, reason: `The Reliquary holds ${rules.capacity}: release one first.` };
  const def = relicDef(found.id);
  const rng = new Rng(rq.seed);
  let relic: ReliquaryRelic = {
    uid: `r${rq.next}`,
    id: def.id,
    cleansed: def.rarity === 'cursed' && found.cleansed,
    inscriptions: [],
    instability: 0,
    fractured: false,
    dissonance: null,
  };
  const categories = ['silk', 'choir', 'aegis', 'bond', 'weaver'] as const;
  for (let n = rules.enshrineInscriptions[def.rarity]; n > 0; n--) {
    const open = categories.filter((c) => inscribable(relic, c).length > 0);
    const ins = rollInscription(rng, relic, open[rng.int(open.length)]!);
    if (ins) relic = { ...relic, inscriptions: [...relic.inscriptions, ins] };
  }
  return {
    ok: true,
    relic,
    reliquary: { ...rq, relics: [...rq.relics, relic], next: rq.next + 1, seed: rng.nextU32() },
  };
}

/** A relic leaves the Reliquary for Tuning Shards (and the carry). */
export function release(
  rq: Reliquary,
  uid: string,
): { ok: true; reliquary: Reliquary; shards: number } | { ok: false; reason: string } {
  const relic = rq.relics.find((r) => r.uid === uid);
  if (!relic) return { ok: false, reason: 'No such relic.' };
  const shards = releaseValue(relic);
  return {
    ok: true,
    shards,
    reliquary: {
      ...rq,
      relics: rq.relics.filter((r) => r.uid !== uid),
      carry: rq.carry.filter((u) => u !== uid),
      shards: rq.shards + shards,
    },
  };
}

/**
 * The relics to carry into the next run: known, at most `slots`, never two of the same relic
 * (the first of a pair stays).
 */
export function chooseCarry(rq: Reliquary, uids: readonly string[], slots: number): Reliquary {
  const carry: string[] = [];
  const ids = new Set<string>();
  for (const uid of uids) {
    const relic = rq.relics.find((r) => r.uid === uid);
    if (!relic || carry.includes(uid) || ids.has(relic.id) || carry.length >= slots) continue;
    carry.push(uid);
    ids.add(relic.id);
  }
  return { ...rq, carry };
}

/** The carried relics, in carry order (uids the Reliquary no longer holds are skipped). */
export function carriedRelics(rq: Reliquary, slots: number): ReliquaryRelic[] {
  return chooseCarry(rq, rq.carry, slots).carry.map((uid) => rq.relics.find((r) => r.uid === uid)!);
}

/**
 * A relic from a save, fitted to this build's content: null if the relic is gone; Inscriptions
 * it no longer knows are dropped, and a Dissonant slot or a curse it no longer knows is emptied.
 */
export function fitRelic(r: ReliquaryRelic): ReliquaryRelic | null {
  if (!CONTENT.relics.some((d) => d.id === r.id)) return null;
  const normal = new Set(CONTENT.inscriptions.filter((d) => d.kind === 'normal').map((d) => d.id));
  const seen = new Set<string>();
  const inscriptions = r.inscriptions.filter((i) => {
    const ok = normal.has(i.id) && !seen.has(i.id) && Number.isFinite(i.value);
    seen.add(i.id);
    return ok;
  });
  let dissonance = r.dissonance ? { ...r.dissonance } : null;
  if (
    dissonance?.inscription &&
    !CONTENT.inscriptions.some((d) => d.id === dissonance!.inscription)
  )
    delete dissonance.inscription;
  if (dissonance?.curse && !CONTENT.curses.some((d) => d.id === dissonance!.curse))
    delete dissonance.curse;
  if (dissonance?.kind === 'empowered' && !relicDef(r.id).empowered)
    dissonance = { kind: 'shattered' };
  return {
    ...r,
    // Back inside its tier: tiers retuned since a value was rolled don't keep old values.
    inscriptions: inscriptions.map((i) =>
      fitValue({ ...i, tier: Math.max(1, Math.min(5, Math.round(i.tier))) }),
    ),
    instability: Math.max(0, Math.min(100, r.instability)),
    dissonance,
  };
}

/** A value back inside its tier's range and on its steps. */
function fitValue(ins: Inscription): Inscription {
  const def = inscriptionDef(ins.id);
  if (def.kind !== 'normal') return ins;
  const [min, max] = def.tiers[5 - ins.tier]!;
  const stepped = min + Math.round((ins.value - min) / def.step) * def.step;
  return { ...ins, value: Math.round(Math.min(max, Math.max(min, stepped)) * 1000) / 1000 };
}

/** A Reliquary from a save, fitted to this build's content; the carry keeps only what it holds. */
export function fitReliquary(rq: Reliquary): Reliquary {
  const relics = rq.relics.map(fitRelic).filter((r): r is ReliquaryRelic => r !== null);
  const uids = new Set(relics.map((r) => r.uid));
  const highest = relics.reduce((n, r) => Math.max(n, Number(r.uid.slice(1)) || 0), 0);
  return {
    ...rq,
    relics,
    carry: rq.carry.filter((u) => uids.has(u)),
    shards: Math.max(0, Math.floor(rq.shards)),
    tears: Math.max(0, Math.floor(rq.tears)),
    seed: rq.seed >>> 0,
    next: Math.max(rq.next, highest + 1),
  };
}

/** A deep copy: what a run keeps of a relic it carries (crafting later doesn't reach it). */
export function snapshotRelic(r: ReliquaryRelic): ReliquaryRelic {
  return {
    ...r,
    inscriptions: r.inscriptions.map((i) => ({ ...i })),
    dissonance: r.dissonance ? { ...r.dissonance } : null,
  };
}

/**
 * Carried relics as a fight takes them (the Training Grounds): the attuned one's own effect (the
 * first; Empowered or not), and every carried relic's affixes.
 */
export function carriedConfig(relics: readonly ReliquaryRelic[]): {
  relics: { id: string; cleansed: boolean; empowered: boolean }[];
  passives: { effect: PassiveEffect; value: number }[];
} {
  return {
    relics: relics
      .slice(0, 1)
      .map((r) => ({ id: r.id, cleansed: r.cleansed, empowered: empowered(r) })),
    passives: relics.flatMap(relicPassives),
  };
}

/** What a run pays the Reliquary at its end: shards for its won fights, a Tear for its boss. */
export function runMaterials(run: RunState): { shards: number; tears: number } {
  const rules = RULES();
  let shards = 0;
  let tears = 0;
  for (const r of run.results) {
    if (r.outcome !== 'victory') continue;
    shards += rules.shards.perFight;
    if (r.kind === 'elite') shards += rules.shards.elite;
    if (r.kind === 'miniboss') shards += rules.shards.miniboss;
    if (r.kind === 'boss') {
      shards += rules.shards.boss;
      if (r.grade === rules.tearGrade) tears += 1;
    }
  }
  return { shards, tears };
}
