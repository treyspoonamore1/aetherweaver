/**
 * Balance harness v1 (docs/plan/06 §2 Phase 1 exit): plays encounters with Idle / Novice /
 * Skilled bots across many seeds and reports win rates, durations, the Weaver's share of
 * party output and the go/no-go bands.
 *
 *   npx tsx tools/harness.ts --encounters first_light,tolling_halls --seeds 20
 *   npx tsx tools/harness.ts --movement 2 --seeds 50      # Movement II's fights, arrival kit
 *   npx tsx tools/harness.ts --movement 2 --kit bare      # …or bare, as Movement I is measured
 *   npx tsx tools/harness.ts --run --seeds 10             # whole Prelude runs (map, drafts, carry-over)
 *   npx tsx tools/harness.ts --run --movements 2          # whole Expeditions (docs/phase-5a.md)
 *   npx tsx tools/harness.ts --movement 3 --seeds 50      # Movement III's fights, arrival3 kit
 *   npx tsx tools/harness.ts --run --movements 3          # I-III, with won ÷ reached III
 *   npx tsx tools/harness.ts --movement 4 --seeds 50      # the Silent Conductor, arrival4 kit
 *   npx tsx tools/harness.ts --run --movements 4          # the Finale route (docs/phase-5d.md)
 *   npx tsx tools/harness.ts --movement 2 --seed-base 500003   # another seed set (a check)
 *   npx tsx tools/harness.ts --party kael,vexis,brann --verbose    # a roster party (docs/phase-5b.md)
 *   npx tsx tools/harness.ts --party B --compare                    # party B, beside the default party
 *
 * The fight list comes from content by Movement (`--movement`, default 1: Movement I's nine
 * fights). Movement I's cells play bare (the loadout alone), Movement II's the arrival kit,
 * Movement III's ARRIVAL3_KIT and the Finale's ARRIVAL4_KIT (tools/kits.ts); `--kit` overrides
 * it. Each Movement's bands are printed beside its rows; `--verbose` adds Movement II's verbs
 * and, in Movement III and the Finale, their own.
 *
 * `--party` plays a roster party (docs/phase-5b.md): 3 hero ids, or A (Kael, Vexis, Brann),
 * B (Lyra, Vexis, Brann) or C (Kael, Lyra, Brann), or one of Seren's and Oro's (docs/phase-5e.md:
 * SA, SB, SC, OA, OB, OC, R, SO, X, W; `NAMED_PARTIES`). Without it the config has no `party`
 * key, so every default-party report keeps its baseline. `--compare` plays the default party
 * beside it.
 */
import { writeFileSync } from 'node:fs';
import type { BotKind } from '../src/bots';
import { CONTENT, encounterDef } from '../src/content';
import { CHORD_PRESETS } from '../src/meta/run';
import type { ChordLoadout } from '../src/meta/types';
import {
  movementEncounters,
  movementName,
  OVEREXTENDED_ANSWER_WITHIN,
  playEncounter,
  playRun,
  type EncounterRun,
} from './harness-core';
import { defaultKit, kitById, kitConfig, presetChords, type Kit } from './kits';

interface Args {
  encounters: string[];
  bots: BotKind[];
  seeds: number;
  /** The loadout: `--loadout <preset>` or `--auras a,b` (one Chord, no ornaments). */
  chords: ChordLoadout[];
  label: string;
  json: string | null;
  verbose: boolean;
  /** The Movement whose fights it plays (`--movement`), and the kit they play with. */
  movement: number;
  kit: Kit;
  /** Whole runs: the route (`--movements`, 1 the Prelude). */
  movements: number;
  /** The first seed (`--seed-base`): fights 1000 + i × 7919, runs 2000 + i × 104729 by default. */
  seedBase: number | null;
  /** The party (`--party`), in content order; null: the default party (no `party` key). */
  party: string[] | null;
  /** `--compare`: play the default party beside `party`, for the bands' "≥ default − 5". */
  compare: boolean;
}

/**
 * The roster parties the bands measure: Brann's A, B and C (docs/phase-5b.md, "Bands"), and
 * Seren's and Oro's (docs/phase-5e.md, "By party"): SA, SB, SC and OA, OB, OC each drop one
 * starter; R is the Red Line (Kael, Brann, Seren), SO both new heroes with Kael, X no starter,
 * and W no Kael and no Lyra. Each in content order.
 */
export const NAMED_PARTIES: Readonly<Record<string, readonly string[]>> = {
  A: ['kael', 'vexis', 'brann'],
  B: ['lyra', 'vexis', 'brann'],
  C: ['kael', 'lyra', 'brann'],
  SA: ['kael', 'vexis', 'seren'],
  SB: ['lyra', 'vexis', 'seren'],
  SC: ['kael', 'lyra', 'seren'],
  OA: ['kael', 'vexis', 'oro'],
  OB: ['lyra', 'vexis', 'oro'],
  OC: ['kael', 'lyra', 'oro'],
  R: ['kael', 'brann', 'seren'],
  SO: ['kael', 'seren', 'oro'],
  X: ['brann', 'seren', 'oro'],
  W: ['vexis', 'seren', 'oro'],
};

/** The codes of NAMED_PARTIES, as `--party`'s message lists them. */
const PARTY_CODES = Object.keys(NAMED_PARTIES).join(', ');

/**
 * `--party`'s value: a NAMED_PARTIES code (A, B, C, SA … W), or 3 distinct known hero ids,
 * comma-separated; in content order (the run's slot order). Undefined: null, the default party.
 * Throws on anything else.
 */
export function partyArg(value: string | undefined): string[] | null {
  if (value === undefined) return null;
  const named = NAMED_PARTIES[value.toUpperCase()];
  const ids = named ? [...named] : value.split(',').filter(Boolean);
  const known = CONTENT.heroes.map((h) => h.id);
  const unknown = ids.filter((id) => !known.includes(id));
  if (unknown.length > 0) throw new Error(`Unknown hero "${unknown.join(',')}" (${known})`);
  if (ids.length !== 3 || new Set(ids).size !== 3)
    throw new Error(`A party is 3 distinct heroes, or one of ${PARTY_CODES}: "${value}"`);
  return known.filter((id) => ids.includes(id));
}

export function parseArgs(argv: string[]): Args {
  const get = (name: string) => {
    const i = argv.indexOf(`--${name}`);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const movement = Number(get('movement') ?? 1);
  const kit = kitById(get('kit') ?? defaultKit(movement));
  // The arrival kit brings its own preset unless a loadout is named; bare plays the old default.
  const named = get('loadout') !== undefined || get('auras') !== undefined;
  const loadout =
    kit.id === 'bare' || named
      ? loadoutArg(get('loadout'), get('auras'))
      : { chords: presetChords(kit.preset), label: `${kit.preset} (${kit.name})` };
  return {
    encounters: (get('encounters') ?? movementEncounters(movement).join(',')).split(','),
    bots: (get('bots') ?? 'idle,novice,skilled').split(',') as BotKind[],
    seeds: Number(get('seeds') ?? 10),
    ...loadout,
    json: get('json') ?? null,
    verbose: argv.includes('--verbose'),
    movement,
    kit,
    movements: Number(get('movements') ?? 1),
    seedBase: get('seed-base') === undefined ? null : Number(get('seed-base')),
    party: partyArg(get('party')),
    compare: argv.includes('--compare'),
  };
}

function loadoutArg(
  preset: string | undefined,
  auras: string | undefined,
): { chords: ChordLoadout[]; label: string } {
  if (preset) {
    const p = CHORD_PRESETS.find((x) => x.id === preset);
    if (!p) throw new Error(`Unknown loadout "${preset}" (${CHORD_PRESETS.map((x) => x.id)})`);
    return { chords: presetChords(preset), label: p.name };
  }
  const ids = (auras ?? 'sostenuto,fortissimo').split(',').filter(Boolean);
  return {
    chords: ids.length ? [{ auras: ids, ornaments: [] }] : [],
    label: ids.join('+') || 'none',
  };
}

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

/** `--calling luminary` and `--path 0101` (the option to take at each tier). */
const callingArg = ((): string | undefined => {
  const i = process.argv.indexOf('--calling');
  return i >= 0 ? process.argv[i + 1] : undefined;
})();
const pathArg = ((): (0 | 1)[] | undefined => {
  const i = process.argv.indexOf('--path');
  return i >= 0 ? [...(process.argv[i + 1] ?? '')].map((c) => (c === '1' ? 1 : 0)) : undefined;
})();

function runs(args: Args): void {
  const route = args.movements >= 2 ? `Expeditions (${args.movements} Movements)` : 'Prelude runs';
  console.log(
    `harness · whole ${route} · ${args.seeds} seeds · loadout ${args.label}${callingArg ? ` · ${callingArg} ${pathArg?.join('') ?? '0000'}` : ''}${args.party ? ` · party ${args.party.join(',')}` : ''}`,
  );
  for (const bot of args.bots) {
    const results = Array.from({ length: args.seeds }, (_, i) =>
      playRun((args.seedBase ?? 2000) + i * 104729, bot, args.chords, {
        relics: !process.argv.includes('--no-relics'),
        calling: callingArg,
        path: pathArg,
        movements: args.movements,
        ...(args.party ? { party: args.party } : {}),
      }),
    );
    const wins = results.filter((r) => r.outcome === 'victory').length;
    const endedAt: Record<string, number> = {};
    for (const r of results)
      if (r.outcome === 'defeat') endedAt[r.lastEncounter] = (endedAt[r.lastEncounter] ?? 0) + 1;
    const mean = (f: (r: (typeof results)[number]) => number) =>
      results.reduce((s, r) => s + f(r), 0) / results.length;
    let movementLine = '';
    if (args.movements >= 2) {
      const reached = Array.from(
        { length: args.movements - 1 },
        (_, k) =>
          `reach ${k + 2}: ${pct(results.filter((r) => r.movementReached >= k + 2).length / results.length)}`,
      );
      const split = Array.from({ length: args.movements }, (_, k) =>
        mean((r) => r.minutesByMovement[k] ?? 0).toFixed(1),
      );
      movementLine = ` · ${reached.join(' · ')} · combat min by Movement ${split.join(' / ')}`;
      // Movement III onward (docs/phase-5c.md): the win among the runs that reached the last
      // Movement, since reaching it is fixed by the Movements before. The Finale route
      // (docs/phase-5d.md) names it by its label: 'won ÷ reached the Finale'.
      if (args.movements >= 3) {
        const last = results.filter((r) => r.movementReached >= args.movements);
        const won = last.filter((r) => r.outcome === 'victory').length;
        movementLine += ` · won ÷ reached ${movementName(args.movements, true)} ${last.length ? pct(won / last.length) : '-'} (${won}/${last.length})`;
        const target = runBand(args.movements, bot, args.party);
        if (target) movementLine += ` · band ${target}`;
      }
    }
    // A Seren or Oro party's Prelude band (docs/phase-5e.md): the Finale route's is above.
    if (args.movements < 3 && args.party) {
      const target = runBand(args.movements, bot, args.party);
      if (target) movementLine += ` · band ${target}`;
    }
    console.log(
      `${bot.padEnd(8)} win ${pct(wins / results.length).padStart(4)} · avg ${mean((r) => r.minutes).toFixed(1)} min of combat · ${mean((r) => r.fights).toFixed(1)} fights · ${mean((r) => r.relics.length).toFixed(1)} relics · Aether ${Math.round(mean((r) => r.aetherEarned))} earned, ${Math.round(mean((r) => r.aetherLeft))} left${movementLine} · lost at ${JSON.stringify(endedAt)}`,
    );
    const harmony = results.filter((r) => r.harmony);
    if (harmony.length > 0) {
      // Harmony reachability (docs/phase-5b.md, "Other gates"): offered ≥ 50% of the runs that
      // owned both its prerequisites; the overall rate is recorded with no target.
      const owned = harmony.filter((r) => r.harmony!.prereqsOwned);
      const offered = owned.filter((r) => r.harmony!.silkOfferedEligible > 0).length;
      console.log(
        `         Blood and Silk: offered in ${pct(harmony.filter((r) => r.harmony!.silkOffered > 0).length / harmony.length)} of runs · prerequisites owned in ${owned.length} · offered then in ${owned.length ? pct(offered / owned.length) : '-'} (band ≥50%)`,
      );
    }
    if (args.verbose)
      for (const r of results)
        console.log(
          `  ${r.seed} ${r.outcome.padEnd(7)} ${r.fights} fights · Movement ${r.movementReached} · relics ${r.relics.join(', ') || '—'} · motifs ${r.motifs.join(', ')}`,
        );
  }
}

/**
 * The difficulty contract's bands for a fight (docs/phase-1.md; Movement II: docs/phase-5a.md,
 * "Bands"), printed beside each row so a miss shows. Win rates and the Skilled bot's share.
 */
export function band(
  encounter: string,
  bot: BotKind,
  party: readonly string[] | null = null,
): string {
  const def = encounterDef(encounter);
  if (party && rosterTier(party) !== null)
    return rosterBand(def.movement ?? 1, def.kind, bot, party);
  if (party?.includes('brann')) return brannBand(def.movement ?? 1, def.kind, bot, party);
  return MOVEMENT_BANDS[def.movement ?? 1]?.[def.kind]?.[bot] ?? '';
}

/**
 * How a party with Seren or Oro is banded (docs/phase-5e.md, "Bands"): `kael` the full protocol
 * with Kael (SA, SC, OA, OC); `sb` and `ob` the full protocol's no-tank parties (OB's provisional,
 * Q8); `reduced` (R, SO, X, W) printed against the bands; `sweep` the other parties with either
 * hero (a smoke test, unbanded). Null: no Seren or Oro (Brann's and the default bands apply).
 */
export type RosterTier = 'kael' | 'sb' | 'ob' | 'reduced' | 'sweep';

/** The party's tier (`RosterTier`), or null without Seren and Oro. */
export function rosterTier(party: readonly string[]): RosterTier | null {
  if (!party.includes('seren') && !party.includes('oro')) return null;
  const key = [...party].sort().join();
  const code = Object.keys(NAMED_PARTIES).find((c) => [...NAMED_PARTIES[c]!].sort().join() === key);
  if (code === 'SA' || code === 'SC' || code === 'OA' || code === 'OC') return 'kael';
  if (code === 'SB') return 'sb';
  if (code === 'OB') return 'ob';
  if (code === 'R' || code === 'SO' || code === 'X' || code === 'W') return 'reduced';
  return 'sweep';
}

/** Seren's and Oro's own bands (docs/phase-5e.md), for the Skilled bot's line (`--verbose`). */
function ownBands(party: readonly string[]): string {
  const own: string[] = [];
  if (party.includes('seren'))
    own.push(
      'Seren: ≥50% of Wards on her parry, counters and kill shots 20-40% of her damage, ≤0.3 downs, beyond 14 m ≤2%',
    );
  if (party.includes('oro'))
    own.push('Oro: Saplings in your field ≥60%, both standing ≥60%, tending ≤25%, ≤0.3 downs');
  return own.length ? ` · ${own.join(' · ')}` : '';
}

/**
 * A Seren or Oro party's cell (docs/phase-5e.md, "Bands"): win and share against the default
 * party's cell (`--compare` prints it), the Novice and the Idle bot, and the heroes' own bands.
 * Bosses are Movement I-III's bosses and the Conductor; skirmishes, elites and minibosses take
 * the skirmish row.
 */
function rosterBand(
  movement: number,
  kind: string,
  bot: BotKind,
  party: readonly string[],
): string {
  const tier = rosterTier(party)!;
  const boss = kind === 'boss';
  const share = boss ? 30 : 35;
  if (tier === 'sweep') return { idle: '-', novice: '-', skilled: 'unbanded (smoke)' }[bot];
  if (bot === 'idle') return boss ? '0%' : 'its default-party band';
  if (tier === 'reduced')
    return bot === 'novice'
      ? 'printed'
      : `printed vs default − ${boss ? 15 : 10} · share ≥${share}%${ownBands(party)}`;
  const minus = { kael: 5, sb: boss ? 15 : 5, ob: boss ? 25 : 10 }[tier];
  const provisional = tier === 'ob' ? ' (provisional, Q8)' : '';
  const length =
    tier === 'kael'
      ? movement >= 4
        ? ' · 170-280 s'
        : ' · ≤ default + 15%'
      : movement >= 4
        ? ' · ≤280 s'
        : '';
  if (bot === 'novice') {
    if (tier === 'ob') return 'recorded';
    if (tier === 'sb' && boss) return '≥10%';
    return 'its default-party band · ≤ Skilled';
  }
  return `≥ default − ${minus}${provisional} · share ≥${share}%${length}${ownBands(party)}`;
}

/**
 * Each Movement's cell bands by encounter kind (Movement I's are the docs/phase-1.md contract,
 * printed by no row): Movement II's (docs/phase-5a.md, "Bands"), Movement III's
 * (docs/phase-5c.md, "Bands", on ARRIVAL3_KIT) and the Finale's, its one boss
 * (docs/phase-5d.md, "Bands", on ARRIVAL4_KIT).
 */
const MOVEMENT_BANDS: Readonly<Record<number, Record<string, Record<BotKind, string>>>> = {
  2: {
    skirmish: { idle: '≤15%', novice: '≥65%', skilled: '≥85% · share ≥35% · 35-60 s' },
    elite: { idle: '0%', novice: '35-75%', skilled: '≥85% · share ≥35% · 50-80 s' },
    miniboss: { idle: '0%', novice: '40-70%', skilled: '≥90% · share ≥35% · 60-110 s' },
    boss: { idle: '0%', novice: '35-65%', skilled: '≥85% · share ≥30% · 180-300 s' },
  },
  3: {
    skirmish: { idle: '≤10%', novice: '≥55%', skilled: '≥85% · share ≥35% · 40-65 s' },
    elite: { idle: '0%', novice: '30-65%', skilled: '≥85% · share ≥35% · 55-85 s' },
    miniboss: { idle: '0%', novice: '30-60%', skilled: '≥90% · share ≥35% · 70-120 s' },
    boss: { idle: '0%', novice: '25-55%', skilled: '≥80% · share ≥30% · 180-280 s' },
  },
  4: {
    boss: { idle: '0%', novice: '15-40%', skilled: '≥80% · share ≥30% · 170-230 s' },
  },
};

/**
 * Whole-run bands for an Expedition through `movements` (docs/phase-5c.md; the Finale route's,
 * docs/phase-5d.md); '' for none.
 */
export function runBand(
  movements: number,
  bot: BotKind,
  party: readonly string[] | null = null,
): string {
  const tier = party ? rosterTier(party) : null;
  if (tier !== null) return rosterRunBand(movements, bot, tier);
  if (movements < 3) return '';
  if (movements >= 4)
    return {
      idle: 'won 0%',
      novice: 'won 1-6% · won ÷ reached the Finale 15-40% (pooled)',
      skilled:
        'won ≥55% · reached the Finale ≥65% · won ÷ reached the Finale ≥80% · won III within 5 points of the full road',
    }[bot];
  return {
    idle: 'won 0%',
    novice: 'won 3-10% · won ÷ reached III 20-50% (pooled)',
    skilled: 'won ≥60% · won ÷ reached III ≥75%',
  }[bot];
}

/**
 * A Seren or Oro party's whole runs (docs/phase-5e.md, "Bands"): the Prelude and the Finale
 * route, Skilled, against the default party's on the same seeds; '' where the doc sets none.
 */
function rosterRunBand(movements: number, bot: BotKind, tier: RosterTier): string {
  if (bot !== 'skilled' || tier === 'sweep') return '';
  if (movements <= 1)
    return { kael: '≥ default − 5', sb: '≥ default − 5', ob: '≥ default − 10', reduced: '' }[tier];
  if (movements < 4) return '';
  return {
    kael: 'won ≥ default − 5 and ≥55%',
    sb: 'won ≥ default − 10',
    ob: 'won ≥ default − 20 (provisional, Q8)',
    reduced: 'won ≥ default − 15',
  }[tier];
}

/**
 * Brann's cells (docs/phase-5b.md, "Bands") for parties A, B and C: win and share against the
 * default party's cell (`--compare` prints it), the Novice and the Idle bot, and Brann's own
 * numbers from the tally (`--verbose`).
 */
function brannBand(movement: number, kind: string, bot: BotKind, party: readonly string[]): string {
  const noTank = !party.includes('kael');
  const big = kind === 'miniboss' || kind === 'boss';
  const own = '· Brann below 40% ≥40% of his time, ≤0.3 downs, lifesteal 20-45% of his healing';
  if (movement >= 4) {
    // The Finale (docs/phase-5d.md, "Bands"): parties A and C within 5 of the default party and
    // no longer than 280 s; party B, with no dome, within 15 (its Crescendo cancel is forced).
    if (noTank) return { idle: '0%', novice: '≥10%', skilled: '≥ default − 15 · share ≥30%' }[bot];
    return {
      idle: '0%',
      novice: 'its default-party band',
      skilled: '≥ default − 5 · share ≥30% · ≤280 s',
    }[bot];
  }
  if (movement >= 3) {
    // Movement III (docs/phase-5c.md, "Bands"): parties A and C within 5 of the default party;
    // party B, with no tank, within 15 at the bosses.
    if (big && noTank)
      return { idle: '0%', novice: '≥10%', skilled: '≥ default − 15 · share ≥30%' }[bot];
    return {
      idle: big ? '0%' : 'its default-party band',
      novice: 'its default-party band',
      skilled: `≥ default − 5 · share ≥${big ? 30 : 35}%`,
    }[bot];
  }
  if (movement < 2) {
    if (big)
      return { idle: '0%', novice: '25-70%', skilled: `≥ default − 5 · share ≥30% ${own}` }[bot];
    return {
      idle: 'its Movement I band',
      novice: '≤ default, ≥ Idle + 30',
      skilled: `≥ default − 5 · share ≥35% ${own}`,
    }[bot];
  }
  if (!big)
    return {
      idle: 'as in 5a',
      novice: '5-20 pts under default',
      skilled: `≥ default − 5 · share ≥35% ${own} · ≤3 refused Rallies`,
    }[bot];
  if (noTank)
    return {
      idle: '0%',
      novice: '≥10%',
      skilled: '≥ default − 15 · share ≥30% · Twin Cleave on Brann survived ≥70%',
    }[bot];
  return {
    idle: '0%',
    novice: '20-60%',
    skilled: '≥ default − 5 · share ≥30% · Execution on Brann spared ≥80%',
  }[bot];
}

/** The tally line for a Brann party's runs (`--verbose`): his numbers, averaged a fight. */
function brannLine(runs: readonly EncounterRun[]): string | null {
  const tallies = runs.map((r) => r.brann).filter((b): b is NonNullable<typeof b> => !!b);
  if (tallies.length === 0) return null;
  const avg = (f: (b: (typeof tallies)[number]) => number) =>
    tallies.reduce((s, b) => s + f(b), 0) / tallies.length;
  return `   Brann: below 40% ${pct(avg((b) => b.lowShare40))} · below 30% ${pct(avg((b) => b.lowShare30))} · dealt at ≤ 60% ${pct(avg((b) => b.dealtLow60))} · rage +${pct(avg((b) => b.rageBonus))} · downs ${avg((b) => b.downs).toFixed(2)} · Weaver heal ${Math.round(avg((b) => b.weaverHealOn))} · Wards ${avg((b) => b.wardsOn).toFixed(1)} (Perfect ${avg((b) => b.perfectsOn).toFixed(1)}) · lifesteal ${Math.round(avg((b) => b.lifesteal))} (${pct(avg((b) => b.lifestealShare))} of his healing) · Blood and Silk ${avg((b) => b.silkResonance).toFixed(1)} · Deathless ${avg((b) => b.deathless).toFixed(1)} · Rallies refused ${avg((b) => b.refusedRallies).toFixed(1)} of ${avg((b) => b.rallies).toFixed(1)}`;
}

/** The tally line for a Seren party's fights (`--verbose`): her numbers, averaged a fight. */
export function serenLine(runs: readonly EncounterRun[]): string | null {
  const tallies = runs.map((r) => r.seren).filter((t): t is NonNullable<typeof t> => !!t);
  if (tallies.length === 0) return null;
  const sum = (f: (t: (typeof tallies)[number]) => number) => tallies.reduce((s, t) => s + f(t), 0);
  const avg = (f: (t: (typeof tallies)[number]) => number, digits = 1) =>
    (sum(f) / tallies.length).toFixed(digits);
  const share = (num: number, den: number) => (den > 0 ? pct(num / den) : '-');
  return [
    `   Seren: parries ${avg((t) => t.parries)} (Wards on her ${avg((t) => t.wardsOn)}, parried ${share(
      sum((t) => t.wardsParried),
      sum((t) => t.wardsOn),
    )})`,
    `kill shots ${avg((t) => t.killShots, 2)} (lost ${avg((t) => t.killShotsLost, 2)}, executed ${avg((t) => t.executed, 2)})`,
    `your Wards dealt ${share(
      sum((t) => t.counterDamage + t.killShotDamage),
      sum((t) => t.damage),
    )} of her damage`,
    `overextended ${avg((t) => t.overextensions)}×, answered ${share(
      sum((t) => t.overextendedAnswered),
      sum((t) => t.overextensions),
    )} within ${OVEREXTENDED_ANSWER_WITHIN} s`,
    `beyond reach ${share(
      sum((t) => t.beyondReachTime),
      sum((t) => t.aliveTime),
    )}`,
    `on the Showboat pick ${pct(sum((t) => t.quarryPickShare) / tallies.length)}`,
    `Lunge interrupts ${avg((t) => t.lungeInterrupts)}`,
    `downs ${avg((t) => t.downs, 2)}`,
  ].join(' · ');
}

/** The tally line for an Oro party's fights (`--verbose`): his and his grove's numbers. */
export function oroLine(runs: readonly EncounterRun[]): string | null {
  const tallies = runs.map((r) => r.oro).filter((t): t is NonNullable<typeof t> => !!t);
  if (tallies.length === 0) return null;
  const sum = (f: (t: (typeof tallies)[number]) => number) => tallies.reduce((s, t) => s + f(t), 0);
  const avg = (f: (t: (typeof tallies)[number]) => number, digits = 1) =>
    (sum(f) / tallies.length).toFixed(digits);
  const share = (num: number, den: number) => (den > 0 ? pct(num / den) : '-');
  const fight = runs.filter((r) => r.oro).reduce((s, r) => s + r.duration, 0);
  return [
    `   Oro: Saplings in your field ${share(
      sum((t) => t.saplingInFieldTime),
      sum((t) => t.saplingAliveTime),
    )}`,
    `both standing ${share(
      sum((t) => t.bothStandingTime),
      fight,
    )}`,
    `felled ${avg((t) => t.saplingsLost)}`,
    `tending ${share(
      sum((t) => t.tendingTime),
      sum((t) => t.aliveTime),
    )}`,
    `Sapling damage ${Math.round(sum((t) => t.saplingDamage) / tallies.length)}`,
    `Rootbond ${Math.round(sum((t) => t.rootbondHeal) / tallies.length)}`,
    `Ancients ${avg((t) => t.ancients)} (taunt ${avg((t) => t.ancientTauntTime)} s, your field ${avg((t) => t.ancientAuraTime)} s)`,
    `Thread cut on him ${avg((t) => t.threadCuts)}`,
    `downs ${avg((t) => t.downs, 2)}`,
  ].join(' · ');
}

/**
 * Movement III's verbs line (`--verbose`, docs/phase-5c.md "Harness"), averaged a fight; null
 * when no fight carried the tally (any fight before Movement III).
 */
export function m3Line(runs: readonly EncounterRun[]): string | null {
  const tallies = runs.map((r) => r.m3).filter((t): t is NonNullable<typeof t> => !!t);
  if (tallies.length === 0) return null;
  const n = tallies.length;
  const avg = (f: (t: (typeof tallies)[number]) => number) =>
    (tallies.reduce((s, t) => s + f(t), 0) / n).toFixed(1);
  const sum = (f: (t: (typeof tallies)[number]) => number) => tallies.reduce((s, t) => s + f(t), 0);
  const cuts = (k: keyof (typeof tallies)[number]['threadCuts']) => avg((t) => t.threadCuts[k]);
  const results = (k: keyof (typeof tallies)[number]['cutResults']) => sum((t) => t.cutResults[k]);
  const delays = tallies.flatMap((t) => (t.reattachDelay === null ? [] : [t.reattachDelay]));
  const doom = tallies.flatMap((t) => t.doomCleanses);
  const spindles = tallies.flatMap((t) => (t.spindleUptime === null ? [] : [t.spindleUptime]));
  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  return [
    `   cuts shears ${cuts('shears')} severing ${cuts('severing')} snip ${cuts('snip')} unpick ${cuts('unpick')}`,
    `verdicts cut ${results('cut')} held ${results('held')} strand ${results('strand')} none ${results('none')}`,
    `re-thread ${delays.length ? `${mean(delays).toFixed(2)} s` : '-'}`,
    `possessed ${avg((t) => t.possessions)} (freed ${avg((t) => t.possessFreed)}, interrupted ${avg((t) => t.possessInterrupted)}, Warded ${avg((t) => t.wardBlockedPossess)})`,
    `rune ${avg((t) => t.runeTime)} s, ${avg((t) => t.silencedRejects)} refused`,
    `in a Maw ${avg((t) => t.mawTime)} hero-s, ${avg((t) => t.inhaleRallies)} Rallies`,
    `Doom ${avg((t) => t.doomIgnitions)} ignited, ${(doom.length / n).toFixed(1)} cleansed at ${mean(doom).toFixed(1)}`,
    `stitched ${avg((t) => t.stitchTime)} hero-s`,
    `mirrors ${avg((t) => t.mimicCopies.empower + t.mimicCopies.ward + t.mimicCopies.chime)} (${avg((t) => t.mirrorsCracked)} cracked)`,
    `Spindles up ${spindles.length ? pct(mean(spindles)) : '-'}`,
    `Unravel harm ${Math.round(Number(avg((t) => t.unravelHarm)))}`,
    `verses back ${avg((t) => t.versesRecovered)}`,
    `Mirror Wards interrupted ${avg((t) => t.mirrorWardsInterrupted)}`,
  ].join(' · ');
}

/**
 * The Finale's verbs line (`--verbose`, docs/phase-5d.md "Harness"), averaged a fight; null when
 * no fight carried the tally (any fight before the Finale).
 */
export function finaleLine(runs: readonly EncounterRun[]): string | null {
  const tallies = runs.map((r) => r.finale).filter((t): t is NonNullable<typeof t> => !!t);
  if (tallies.length === 0) return null;
  const n = tallies.length;
  const sum = (f: (t: (typeof tallies)[number]) => number) => tallies.reduce((s, t) => s + f(t), 0);
  const avg = (f: (t: (typeof tallies)[number]) => number, digits = 1) =>
    (sum(f) / n).toFixed(digits);
  const records = (f: (t: (typeof tallies)[number]) => Record<string, number>) => {
    const out: Record<string, number> = {};
    for (const t of tallies) for (const [k, v] of Object.entries(f(t))) out[k] = (out[k] ?? 0) + v;
    return out;
  };
  const listed = (r: Record<string, number>, per = n) =>
    Object.entries(r)
      .filter(([, v]) => v > 0)
      .map(([k, v]) => `${k} ${(v / per).toFixed(1)}`)
      .join(' ') || '-';
  const begun = sum((t) => Object.values(t.solosBegun).reduce((a, b) => a + b, 0));
  const answered = sum((t) => Object.values(t.cuesAnswered).reduce((a, b) => a + b, 0));
  const cancelled = sum((t) => Object.values(t.cancelled).reduce((a, b) => a + b, 0));
  const silences = tallies.filter((t) => t.reignited || t.silenceBroken || t.silenceTime > 0);
  const toReignite = tallies.flatMap((t) => (t.timeToReignite === null ? [] : [t.timeToReignite]));
  const median = (xs: number[]) => {
    const s = [...xs].sort((a, b) => a - b);
    return s.length ? s[Math.floor((s.length - 1) / 2)]! : NaN;
  };
  return [
    `   Discord fed boss ${avg((t) => t.discordFed.boss, 0)} Solo ${avg((t) => t.discordFed.solo, 0)}`,
    `Fortissimo Silence ${avg((t) => t.fortissimoCast)} (cancelled ${(cancelled / n).toFixed(1)}: ${listed(records((t) => t.cancelled))}; survived ${avg((t) => t.survived)}; downs ${avg((t) => t.fortissimoDowns)})`,
    `Cues ${avg((t) => t.cues)} (failed ${avg((t) => t.cuesFailed)}, interrupted ${avg((t) => t.cuesInterrupted)})`,
    `Solos ${(begun / n).toFixed(1)} (${listed(records((t) => t.solosBegun))}; answered ${begun ? pct(answered / begun) : '-'}: ${listed(records((t) => t.cuesAnswered))})`,
    // The silence's numbers over the fights that reached it (reignited and Coda: of those).
    `Grand Silence in ${silences.length}/${n}${
      silences.length
        ? `: ${(silences.reduce((s, t) => s + t.silenceTime, 0) / silences.length).toFixed(1)} s, notes ${listed(
            records((t) => t.notes),
            silences.length,
          )}, reignited ${pct(silences.filter((t) => t.reignited).length / silences.length)} (median ${toReignite.length ? `${median(toReignite).toFixed(1)} s` : '-'}), Coda ${pct(silences.filter((t) => t.silenceBroken).length / silences.length)}, revived ${(silences.reduce((s, t) => s + t.revived, 0) / silences.length).toFixed(1)}, stilled harm ${Math.round(silences.reduce((s, t) => s + t.damageWhileStilled, 0) / silences.length)}`
        : ''
    }`,
  ].join(' · ');
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  if (process.argv.includes('--run')) {
    runs(args);
    return;
  }
  const all: EncounterRun[] = [];
  const t0 = Date.now();
  const kit = kitConfig(args.kit, args.chords);
  console.log(
    `harness · ${args.seeds} seeds · loadout ${args.label}${args.kit.id === 'bare' || args.label.includes(args.kit.name) ? '' : ` · ${args.kit.name}`}${args.party ? ` · party ${args.party.join(',')}` : ''}`,
  );
  console.log(
    'encounter          bot      win   avg s   wave@loss  boss%@loss  share  perf  saves  downs',
  );
  for (const encounter of args.encounters) {
    for (const bot of args.bots) {
      const runs: EncounterRun[] = [];
      const defaults: EncounterRun[] = [];
      for (let i = 0; i < args.seeds; i++) {
        const seed = (args.seedBase ?? 1000) + i * 7919;
        // The party key only when one is asked for: a default party's config stays as it was.
        runs.push(
          playEncounter(
            { seed, encounter, ...kit, ...(args.party ? { party: args.party } : {}) },
            bot,
          ),
        );
        if (args.party && args.compare)
          defaults.push(playEncounter({ seed, encounter, ...kit }, bot));
      }
      all.push(...runs);
      const wins = runs.filter((r) => r.outcome === 'victory');
      const losses = runs.filter((r) => r.outcome !== 'victory');
      const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
      const waveAtLoss = losses.length ? avg(losses.map((r) => r.wave)).toFixed(1) : '-';
      const bossAtLoss =
        losses.length && losses[0]!.bossPct !== null
          ? pct(avg(losses.map((r) => r.bossPct ?? 0)))
          : '-';
      const versus =
        defaults.length > 0
          ? ` · default ${pct(defaults.filter((r) => r.outcome === 'victory').length / defaults.length)} win, share ${pct(avg(defaults.map((r) => r.share)))}`
          : '';
      const target = band(encounter, bot, args.party) + versus;
      console.log(
        [
          encounter.padEnd(18),
          bot.padEnd(8),
          pct(wins.length / runs.length).padStart(4),
          avg(runs.map((r) => r.duration))
            .toFixed(0)
            .padStart(7),
          String(waveAtLoss).padStart(10),
          String(bossAtLoss).padStart(11),
          pct(avg(runs.map((r) => r.share))).padStart(6),
          avg(runs.map((r) => r.perfects))
            .toFixed(1)
            .padStart(5),
          avg(runs.map((r) => r.saves))
            .toFixed(1)
            .padStart(6),
          avg(runs.map((r) => r.downs))
            .toFixed(1)
            .padStart(6),
          ...(target ? [`  band ${target}`] : []),
        ].join(' '),
      );
      if (args.verbose) {
        const k = (f: (r: EncounterRun) => number) => Math.round(avg(runs.map(f)));
        console.log(
          `   heroDmg ${k((r) => r.partyDamage - r.amplified)} amp ${k((r) => r.amplified)} heal ${k((r) => r.healing)} shield ${k((r) => r.shielded)} negated ${k((r) => r.negated)} incoming ${k((r) => r.incoming)}`,
        );
        if ((encounterDef(encounter).movement ?? 1) >= 2) {
          const cleanses = runs.flatMap((r) => r.bleedCleanses);
          const guard = runs.filter((r) => r.guardBlockedPct !== null);
          const pools = runs.filter((r) => r.timeInSanctuary !== null);
          const casts = runs.reduce((s, r) => s + r.executeCasts, 0);
          console.log(
            `   pins freed ${avg(runs.map((r) => r.pinsFreed)).toFixed(1)} · bleed cleanses ${(cleanses.length / runs.length).toFixed(1)} at ${avg(cleanses).toFixed(1)} stacks · pact blasts ${avg(runs.map((r) => r.pactBlasts)).toFixed(1)} · guard blocked ${guard.length ? pct(avg(guard.map((r) => r.guardBlockedPct!))) : '-'} · executions ${runs.reduce((s, r) => s + r.executions, 0)}/${casts} · in Sanctuary ${pools.length ? pct(avg(pools.map((r) => r.timeInSanctuary!))) : '-'}`,
          );
        }
        // Movement III's line in its own fights (the Finale's rows carry `m3` too, all zero).
        const m3 = (encounterDef(encounter).movement ?? 1) <= 3 ? m3Line(runs) : null;
        if (m3) console.log(m3);
        const finale = finaleLine(runs);
        if (finale) console.log(finale);
        const line = brannLine(runs);
        if (line) console.log(line);
        const seren = serenLine(runs);
        if (seren) console.log(seren);
        const oro = oroLine(runs);
        if (oro) console.log(oro);
      }
    }
  }
  console.log(`done in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  if (args.json) {
    writeFileSync(args.json, JSON.stringify(all, null, 2));
  }
}

if (process.argv[1]?.endsWith('harness.ts')) main();
