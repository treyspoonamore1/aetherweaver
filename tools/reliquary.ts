/**
 * Reliquary report (docs/phase-4c.md): what carried relics are worth, and how fast a career
 * builds them.
 *
 *   npx tsx tools/reliquary.ts --power --seeds 400 --bots novice         sets at ×1.15 enemy life
 *   npx tsx tools/reliquary.ts --power --sets cores,typical --threat 1.3
 *   npx tsx tools/reliquary.ts --career --runs 40 --bots skilled          materials and crafting
 *
 * Power: a set worth +15% wins as often against enemies with 15% more life as no set does
 * against the usual ones (as the Astrolabe was measured). Read on a logistic scale between the
 * two baselines: worth = (T − 1) × (logit(set at T) − logit(none at T)) / (logit(none at 1) −
 * logit(none at T)).
 *
 * Career: from Rank 10, every run carries the best relics the Reliquary holds, pays its
 * materials, enshrines the rarest relic it found when it's won, and crafts with a simple
 * push-your-luck policy (Inscribe to four, then Ascend the lowest tier while the Fracture chance
 * stays at or under 20%, then Dissonate with a Tear).
 */
import { inscriptionDef, relicDef, type InscriptionCategory } from '../src/content';
import type { BotKind } from '../src/bots';
import { RANK_XP, rankOf } from '../src/meta/profile';
import {
  ascend,
  carrySlots,
  chooseCarry,
  craftOdds,
  dissonate,
  emptyReliquary,
  enshrine,
  inscribe,
  release,
  runMaterials,
  type Inscription,
  type Reliquary,
  type ReliquaryRelic,
} from '../src/meta/reliquary';
import { CHORD_PRESETS } from '../src/meta/run';
import type { RunState } from '../src/meta/types';
import { playRun } from './harness-core';

const argv = process.argv.slice(2);
const get = (name: string) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
};

// ── Sets ─────────────────────────────────────────────────────────────────────────────

/** Three relics a seasoned player would carry: the legendaries. */
const TRIO = ['prism_loom', 'cracked_metronome', 'spindle_of_fate'] as const;
/** A generalist's Inscriptions, four on each: the Thread and songs, the techniques, the heroes. */
const BUILD: readonly (readonly string[])[] = [
  ['potent_thread', 'deep_mend', 'clear_tone', 'light_reserve'],
  ['stout_ward', 'true_timing', 'light_hands', 'quick_hands'],
  ['hardy', 'fierce', 'eager_solo', 'vigor'],
];

/** An Inscription at a tier, at the top, the middle or the bottom of its range. */
function at(id: string, tier: number, where: 'low' | 'mid' | 'high' = 'mid'): Inscription {
  const def = inscriptionDef(id);
  if (def.kind !== 'normal') throw new Error(`${id} isn't a normal Inscription`);
  const [min, max] = def.tiers[5 - tier]!;
  const raw = where === 'low' ? min : where === 'high' ? max : (min + max) / 2;
  const value = Math.round(Math.round(raw / def.step) * def.step * 1000) / 1000;
  return { id, tier, value };
}

function relicOf(uid: number, id: string, inscriptions: Inscription[]): ReliquaryRelic {
  return {
    uid: `r${uid}`,
    id,
    cleansed: false,
    inscriptions,
    instability: 0,
    fractured: false,
    dissonance: null,
  };
}

/** The named sets: what a carry might be at each stage. */
const SETS: Record<string, () => ReliquaryRelic[]> = {
  /** The relics alone, no Inscriptions: what carrying them is worth by itself. */
  cores: () => TRIO.map((id, i) => relicOf(i + 1, id, [])),
  /** A crafted set as most players will have it: four each, T4 and T5. */
  typical: () =>
    TRIO.map((id, i) =>
      relicOf(
        i + 1,
        id,
        BUILD[i]!.map((ins, j) => at(ins, j % 2 === 0 ? 4 : 5)),
      ),
    ),
  /** The best crafting can do now: four T3 each, rolled high. */
  excellent: () =>
    TRIO.map((id, i) =>
      relicOf(
        i + 1,
        id,
        BUILD[i]!.map((ins) => at(ins, 3, 'high')),
      ),
    ),
  /** Dissonated Cursed: four T2 each, and a curse. */
  cursed: () =>
    TRIO.map((id, i) => ({
      ...relicOf(
        i + 1,
        id,
        BUILD[i]!.map((ins) => at(ins, 2)),
      ),
      dissonance: { kind: 'cursed' as const, curse: 'thin_spirit' },
    })),
  /** Three rares' cores alone. */
  rares: () =>
    ['cantors_hymnal', 'choirmasters_baton', 'martyrs_veil'].map((id, i) => relicOf(i + 1, id, [])),
  /** Two rares and a legendary, cores alone. */
  mixed: () =>
    ['cantors_hymnal', 'choirmasters_baton', 'prism_loom'].map((id, i) => relicOf(i + 1, id, [])),
  /** Two rares and a legendary, typically crafted. */
  'mixed-typical': () =>
    ['cantors_hymnal', 'choirmasters_baton', 'prism_loom'].map((id, i) =>
      relicOf(
        i + 1,
        id,
        BUILD[i]!.map((ins, j) => at(ins, j % 2 === 0 ? 4 : 5)),
      ),
    ),
  /** Two rares and a legendary, excellently crafted. */
  'mixed-excellent': () =>
    ['cantors_hymnal', 'choirmasters_baton', 'prism_loom'].map((id, i) =>
      relicOf(
        i + 1,
        id,
        BUILD[i]!.map((ins) => at(ins, 3, 'high')),
      ),
    ),
  /** The Inscriptions alone: a typical set's, on relics with no effect worth carrying. */
  'inscriptions-typical': () =>
    ['wardens_key', 'star_chart', 'featherweight_robes'].map((id, i) =>
      relicOf(
        i + 1,
        id,
        BUILD[i]!.map((ins, j) => at(ins, j % 2 === 0 ? 4 : 5)),
      ),
    ),
  /** One legendary's core alone (Rank 10). */
  'one-core': () => [relicOf(1, 'prism_loom', [])],
  /** Rank 10's single slot: one relic, typically crafted. */
  one: () => [
    relicOf(
      1,
      'prism_loom',
      BUILD[0]!.map((ins, j) => at(ins, j % 2 === 0 ? 4 : 5)),
    ),
  ],
};

// ── Power ────────────────────────────────────────────────────────────────────────────

const logit = (p: number) => {
  const q = Math.min(0.995, Math.max(0.005, p));
  return Math.log(q / (1 - q));
};

function power(): void {
  const loadout = CHORD_PRESETS.find((p) => p.id === (get('loadout') ?? 'guardian'))!;
  const seeds = Number(get('seeds') ?? 100);
  const bots = (get('bots') ?? 'novice').split(',') as BotKind[];
  const threat = Number(get('threat') ?? 1.15);
  const names = (get('sets') ?? Object.keys(SETS).join(',')).split(',');
  const baseline = !argv.includes('--no-baseline');
  const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
  console.log(
    `reliquary power · loadout ${loadout.name} · ${seeds} runs each · sets at ×${threat} enemy life`,
  );
  for (const bot of bots) {
    const runs = (carried: ReliquaryRelic[], threatMult: number) => {
      let won = 0;
      for (let i = 0; i < seeds; i++) {
        const seed = 2000 + i * 104729;
        if (playRun(seed, bot, loadout.chords, { carried, threatMult }).outcome === 'victory')
          won++;
      }
      return won / seeds;
    };
    let lo = Number(get('base-hard') ?? NaN);
    let hi = Number(get('base') ?? NaN);
    if (baseline) {
      hi = runs([], 1);
      lo = runs([], threat);
      console.log(`${bot}: no set ${pct(hi)} · at ×${threat} ${pct(lo)}`);
    }
    for (const name of names) {
      const make = SETS[name];
      if (!make) throw new Error(`Unknown set "${name}" (${Object.keys(SETS)})`);
      const win = runs(make(), threat);
      const worth =
        Number.isFinite(lo) && Number.isFinite(hi) && hi !== lo
          ? ((threat - 1) * (logit(win) - logit(lo))) / (logit(hi) - logit(lo))
          : NaN;
      console.log(
        `  ${name.padEnd(10)} ${pct(win)}` +
          (Number.isFinite(worth) ? ` · worth ${(worth * 100).toFixed(1)}%` : ''),
      );
    }
  }
}

// ── Career ───────────────────────────────────────────────────────────────────────────

const RARITY_SCORE = { common: 1, rare: 2, cursed: 2, legendary: 4 } as const;

/** How good a relic is to carry: its rarity and its Inscriptions' tiers. */
function score(r: ReliquaryRelic): number {
  const tiers = r.inscriptions.reduce((n, i) => n + (6 - i.tier), 0);
  const dissonance =
    r.dissonance?.kind === 'dissonant' || r.dissonance?.kind === 'empowered' ? 3 : 0;
  return RARITY_SCORE[relicDef(r.id).rarity] + tiers + dissonance;
}

const CATEGORIES: InscriptionCategory[] = ['silk', 'aegis', 'choir', 'bond', 'weaver'];

/** Crafts one relic as far as the policy goes; returns the Reliquary and what it did. */
function craftRelic(rq: Reliquary, uid: string, log: Record<string, number>): Reliquary {
  for (let guard = 0; guard < 40; guard++) {
    const relic = rq.relics.find((r) => r.uid === uid);
    if (!relic || relic.fractured || relic.dissonance) return rq;
    let result;
    if (relic.inscriptions.length < 4) {
      if (rq.shards < craftOdds(relic, 'inscribe').shards) return rq;
      if (craftOdds(relic, 'inscribe').fracture > 0.2) break;
      const category = CATEGORIES.find((c) => inscribe(rq, uid, c).ok);
      if (!category) break;
      result = inscribe(rq, uid, category);
      log.inscribe = (log.inscribe ?? 0) + 1;
    } else {
      const index = relic.inscriptions
        .map((ins, i) => ({ ins, i }))
        .filter(({ ins }) => ins.tier > 3)
        .sort((a, b) => b.ins.tier - a.ins.tier)[0]?.i;
      if (index === undefined) break;
      const odds = craftOdds(relic, 'ascend', index);
      if (rq.shards < odds.shards) return rq;
      if (odds.fracture > 0.2) break;
      result = ascend(rq, uid, index);
      log.ascend = (log.ascend ?? 0) + 1;
    }
    if (!result.ok) break;
    rq = result.reliquary;
    if (result.outcome.kind === 'fractured') log.fractured = (log.fractured ?? 0) + 1;
  }
  // Done crafting it: gamble a Tear on it.
  const relic = rq.relics.find((r) => r.uid === uid);
  if (relic && !relic.fractured && !relic.dissonance && rq.tears > 0) {
    const result = dissonate(rq, uid);
    if (result.ok && result.outcome.kind === 'dissonated') {
      rq = result.reliquary;
      const key = `dissonate:${result.outcome.dissonance.kind}`;
      log[key] = (log[key] ?? 0) + 1;
    }
  }
  return rq;
}

function career(): void {
  const loadout = CHORD_PRESETS.find((p) => p.id === (get('loadout') ?? 'guardian'))!;
  const total = Number(get('runs') ?? 30);
  const bots = (get('bots') ?? 'novice,skilled').split(',') as BotKind[];
  const marks = new Set([5, 10, 20, 30, 40, 60]);
  console.log(`reliquary career · loadout ${loadout.name} · ${total} runs from Rank 10`);
  for (const bot of bots) {
    let rq = emptyReliquary(4242);
    let xp = RANK_XP[9]!;
    let earned = 0;
    let wins = 0;
    const log: Record<string, number> = {};
    console.log(`\n${bot}`);
    for (let i = 0; i < total; i++) {
      const slots = carrySlots(rankOf(xp));
      // Carry the best it holds, one of each relic.
      const best = [...rq.relics].sort((a, b) => score(b) - score(a)).map((r) => r.uid);
      rq = chooseCarry(rq, best, slots);
      const carried = rq.carry.map((uid) => rq.relics.find((r) => r.uid === uid)!);
      let end: RunState | undefined;
      const summary = playRun(9000 + i * 7919, bot, loadout.chords, {
        carried,
        onEnd: (r) => (end = r),
      });
      if (!end) continue;
      xp += end.xp;
      const paid = runMaterials(end);
      earned += paid.shards;
      rq = { ...rq, shards: rq.shards + paid.shards, tears: rq.tears + paid.tears };
      if (summary.outcome === 'victory') {
        wins++;
        const found = end.relics
          .filter((r) => !r.carried)
          .sort(
            (a, b) => RARITY_SCORE[relicDef(b.id).rarity] - RARITY_SCORE[relicDef(a.id).rarity],
          );
        if (found.length > 0) {
          if (rq.relics.length >= 12) {
            const worst = [...rq.relics].sort((a, b) => score(a) - score(b))[0]!;
            const r = release(rq, worst.uid);
            if (r.ok) rq = r.reliquary;
          }
          const r = enshrine(rq, found[0]!);
          if (r.ok) rq = r.reliquary;
        }
      }
      // Craft the best ones first.
      for (const uid of [...rq.relics].sort((a, b) => score(b) - score(a)).map((r) => r.uid))
        rq = craftRelic(rq, uid, log);
      if (marks.has(i + 1) || i + 1 === total) {
        const carriedNow = chooseCarry(
          rq,
          [...rq.relics].sort((a, b) => score(b) - score(a)).map((r) => r.uid),
          carrySlots(rankOf(xp)),
        ).carry.map((uid) => rq.relics.find((r) => r.uid === uid)!);
        const tiers = carriedNow.flatMap((r) => r.inscriptions.map((x) => `T${x.tier}`));
        const count = (t: string) => tiers.filter((x) => x === t).length;
        console.log(
          `  run ${String(i + 1).padStart(2)} · Rank ${rankOf(xp)} · won ${wins} · shards earned ${earned}, ` +
            `held ${rq.shards} · Tears ${rq.tears} · ${rq.relics.length} enshrined · carry ` +
            `${carriedNow.map((r) => relicDef(r.id).name.split(' ')[0]).join('/')}: ` +
            `T2 ${count('T2')} T3 ${count('T3')} T4 ${count('T4')} T5 ${count('T5')}`,
        );
      }
    }
    console.log(`  crafts: ${JSON.stringify(log)}`);
  }
}

if (process.argv[1]?.endsWith('reliquary.ts')) {
  if (argv.includes('--career')) career();
  else power();
}
