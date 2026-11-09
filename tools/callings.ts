/**
 * Calling report (docs/phase-3c.md): whole Prelude runs with a Calling, every path played, against
 * the same seeds with no Calling. Each of the 2^tiers paths gets its own `--seeds` seeds, so a
 * report at 50 seeds is 800 runs a bot; each tier's two options are compared over the half of
 * the runs that took each one.
 *
 *   npx tsx tools/callings.ts --loadout guardian --seeds 50
 *   npx tsx tools/callings.ts --calling luminary --loadout steady --seeds 25 --bots skilled
 *
 * `--cells` (docs/phase-5c.md, "Bands: Callings") plays a Movement's isolated fights instead, on
 * its kit (Movement III: ARRIVAL3_KIT), once with no Calling and once with each Calling on its
 * first path; a Calling with Paradox on its path plays with it and with its other option, so the
 * Chronomancer is measured both ways. The band is the Skilled bot ≥ 75% at the Unweaver for each.
 *
 *   npx tsx tools/callings.ts --cells --movement 3 --encounters the_unweaver --seeds 50
 *
 * `--movement 4` (docs/phase-5d.md, "Bands: Callings at the Conductor") plays the Silent
 * Conductor on ARRIVAL4_KIT: Skilled ≥ 75% each, and no longer than the no-Calling cell + 40 s
 * (each row prints its length against it), so `bankCrescendo`'s cost shows per Calling.
 *
 *   npx tsx tools/callings.ts --cells --movement 4 --seeds 50
 *   npx tsx tools/callings.ts --cells --movement 4 --party B --seeds 50
 *
 * `--party` (A, B, C or 3 hero ids, as the harness takes it) plays a roster party's cells.
 *
 * The Conductor (docs/phase-5f.md, "Harness") is split in two, as the Chronomancer's Paradox is:
 * `conductor + Triad` (Marcato, Reprise, Ensemble, Triad) and `conductor + Maestro` (A Tempo,
 * Upbeat, Spotlight, Maestro). Its rows also print what it did a fight (Cues, Duets and Trios as a
 * share of Cues, Trios, Finales, Cues on the beat, chorus pulses). `--uses` prints the same
 * columns that exist for every Calling (Cues, chorus pulses, Crescendos) on every row, so the
 * Conductor's can be read against none's; without it, every other row is as it always was.
 *
 *   npx tsx tools/callings.ts --cells --movement 4 --uses --seeds 50
 */
import type { BotKind } from '../src/bots';
import { CONTENT, callingDef } from '../src/content';
import { CHORD_PRESETS } from '../src/meta/run';
import type { SimConfig } from '../src/sim';
import { FINALE_MOVEMENT } from '../src/content/crucibleIds';
import { partyArg } from './harness';
import { movementEncounters, playEncounter, playRun, type EncounterRun } from './harness-core';
import { kitConfig, kitFor } from './kits';

const argv = process.argv.slice(2);
const get = (name: string) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
};
const pct = (x: number) => `${Math.round(x * 100)}%`;
const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / Math.max(1, xs.length);

/** The option that splits the Chronomancer's measurements (docs/phase-5c.md). */
const PARADOX = 'paradox';

/** A Calling as a cell plays it: its label, and the sim's calling config (null: none). */
export interface CallingSetup {
  label: string;
  calling: SimConfig['calling'];
}

/** The Callings whose cells play both options of the last tier along the whole path. */
const SPLIT_BY_KEYSTONE: ReadonlySet<string> = new Set(['conductor']);

/**
 * Every Calling on its first path, with no Calling first; a Calling whose path can take Paradox
 * twice, with it and with that tier's other option; the Conductor once with each keystone (Triad
 * or Maestro) and the first or second option of every tier before it.
 */
export function callingSetups(): CallingSetup[] {
  const out: CallingSetup[] = [{ label: 'none', calling: null }];
  for (const c of CONTENT.callings) {
    if (SPLIT_BY_KEYSTONE.has(c.id)) {
      for (const k of [0, 1] as const)
        out.push({
          label: `${c.id} + ${c.tiers[c.tiers.length - 1]!.options[k]!.name}`,
          calling: { id: c.id, path: c.tiers.map((t) => t.options[k]!.id) },
        });
      continue;
    }
    const first = c.tiers.map((t) => t.options[0]!.id);
    const tier = c.tiers.findIndex((t) => t.options.some((o) => o.id === PARADOX));
    if (tier < 0) {
      out.push({ label: c.id, calling: { id: c.id, path: first } });
      continue;
    }
    const other = c.tiers[tier]!.options.find((o) => o.id !== PARADOX)!.id;
    const withIt = first.map((id, t) => (t === tier ? PARADOX : id));
    const without = first.map((id, t) => (t === tier ? other : id));
    out.push({ label: `${c.id} + Paradox`, calling: { id: c.id, path: withIt } });
    out.push({ label: `${c.id} + ${other}`, calling: { id: c.id, path: without } });
  }
  return out;
}

/**
 * The cells' band, by Movement: the Unweaver's (docs/phase-5c.md), the Silent Conductor's (5d).
 * `conducting`: the Conductor Calling's own (docs/phase-5f.md): the same win rate, and at the
 * Silent Conductor a length from none − 25 s to none + 40 s.
 */
export function callingBand(movement: number, conducting = false): string {
  if (conducting)
    return movement >= FINALE_MOVEMENT
      ? 'Skilled ≥75% at the Silent Conductor, each, none − 25 s to none + 40 s'
      : 'Skilled ≥75% at the Unweaver, each';
  return movement >= FINALE_MOVEMENT
    ? 'Skilled ≥75% at the Silent Conductor, each, ≤ none + 40 s'
    : 'Skilled ≥75% at the Unweaver, each';
}

/** What a fight showed of Cues, chorus pulses and Crescendos, whatever the Calling (`--uses`). */
export interface FightUses {
  cues: number;
  pulses: number;
  crescendos: number;
}

/** A watch for `playEncounter` that fills a `FightUses`: read-only, so the fight plays the same. */
export function usesWatch(uses: FightUses): Parameters<typeof playEncounter>[2] {
  return (sim, events) => {
    for (const e of events) if (e.type === 'chorusPulse') uses.pulses++;
    uses.cues = sim.state.ledger.cues;
    uses.crescendos = sim.state.ledger.crescendos;
  };
}

/**
 * The use columns (`--uses`): the mean of Cues, chorus pulses and Crescendos a fight, then, for a
 * Conductor row, what it did: Duets and Trios as a share of Cues, Trios, Cues that began a chain,
 * Grand Finales (and the Solos they played and the turns lost), Cues on the beat as a share of
 * Cues, and Marcato and Reprise. Undefined for no Conductor fights.
 */
export function useColumns(
  uses: readonly FightUses[],
  runs: readonly EncounterRun[],
  extra: boolean,
): string {
  const n = Math.max(1, uses.length);
  const m = (f: (u: FightUses) => number) => uses.reduce((s, u) => s + f(u), 0) / n;
  const base = `cues ${m((u) => u.cues).toFixed(1)} · pulses ${m((u) => u.pulses).toFixed(2)} · crescendos ${m((u) => u.crescendos).toFixed(2)}`;
  const tallies = runs.flatMap((r) => (r.conducting ? [r.conducting] : []));
  if (!extra || tallies.length === 0) return base;
  const t = (f: (c: NonNullable<EncounterRun['conducting']>) => number) =>
    tallies.reduce((s, c) => s + f(c), 0) / tallies.length;
  const cues = tallies.reduce((s, c) => s + c.cues, 0);
  const share = (num: number) => (cues > 0 ? pct(num / cues) : '–');
  const linked = tallies.reduce((s, c) => s + c.duets + c.trios, 0);
  const onBeat = tallies.reduce((s, c) => s + c.onBeat, 0);
  return `${base} · duets+trios ${share(linked)} of cues · trios ${t((c) => c.trios).toFixed(2)} · chains ${t((c) => c.chains).toFixed(1)} · finales ${t((c) => c.finales).toFixed(2)} (solos ${t((c) => c.finaleSolos).toFixed(1)}, lost ${t((c) => c.finaleLost).toFixed(1)}) · on the beat ${share(onBeat)} · marcato ${t((c) => c.marcatos).toFixed(1)} · reprise ${t((c) => c.reprised).toFixed(0)}`;
}

function cells(): void {
  const movement = Number(get('movement') ?? 3);
  const kit = kitFor(movement);
  const encounters = (get('encounters') ?? movementEncounters(movement).join(',')).split(',');
  const seeds = Number(get('seeds') ?? 50);
  const base = Number(get('seed-base') ?? 1000);
  const bots = (get('bots') ?? 'skilled').split(',') as BotKind[];
  const party = partyArg(get('party'));
  const showUses = argv.includes('--uses');
  console.log(
    `calling cells · Movement ${movement} · ${kit.name} · ${encounters.length} fights × ${seeds} seeds${party ? ` · party ${party.join(',')}` : ''} · band: ${callingBand(movement)}`,
  );
  console.log(`  conductor band: ${callingBand(movement, true)}`);
  for (const encounter of encounters)
    for (const bot of bots) {
      /** The no-Calling cell's mean length, for the Finale's "≤ none + 40 s". */
      let none: number | null = null;
      for (const setup of callingSetups()) {
        const uses: FightUses[] = [];
        const runs = Array.from({ length: seeds }, (_, i) => {
          const use: FightUses = { cues: 0, pulses: 0, crescendos: 0 };
          uses.push(use);
          return playEncounter(
            {
              seed: base + i * 7919,
              encounter,
              ...kitConfig(kit),
              ...(setup.calling ? { calling: setup.calling } : {}),
              ...(party ? { party } : {}),
            },
            bot,
            usesWatch(use),
          );
        });
        const won = runs.filter((r) => r.outcome === 'victory').length / runs.length;
        const length = mean(runs.map((r) => r.duration));
        if (setup.calling === null) none = length;
        const longer =
          movement >= FINALE_MOVEMENT && setup.calling !== null && none !== null
            ? ` (${length - none >= 0 ? '+' : ''}${(length - none).toFixed(0)} s on none)`
            : '';
        console.log(
          `${encounter.padEnd(18)} ${bot.padEnd(8)} ${setup.label.padEnd(30)} win ${pct(won).padStart(4)} · share ${pct(mean(runs.map((r) => r.share)))} · ${length.toFixed(0)} s${longer} · downs ${mean(runs.map((r) => r.downs)).toFixed(1)}${
            showUses || setup.calling?.id === 'conductor'
              ? ` · ${useColumns(uses, runs, setup.calling?.id === 'conductor')}`
              : ''
          }`,
        );
      }
    }
}

function runs(): void {
  const calling = callingDef(get('calling') ?? 'luminary');
  const loadout = CHORD_PRESETS.find((p) => p.id === (get('loadout') ?? 'guardian'));
  if (!loadout) throw new Error(`Unknown loadout (${CHORD_PRESETS.map((p) => p.id)})`);
  const seeds = Number(get('seeds') ?? 50);
  const bots = (get('bots') ?? 'novice,skilled').split(',') as BotKind[];
  const tiers = calling.tiers.length;
  const paths = Array.from({ length: 2 ** tiers }, (_, p) =>
    Array.from({ length: tiers }, (_, t) => ((p >> (tiers - 1 - t)) & 1) as 0 | 1),
  );
  console.log(
    `calling report · ${calling.name} · loadout ${loadout.name} · ${paths.length} paths × ${seeds} seeds`,
  );
  for (const bot of bots) {
    const base: number[] = [];
    const byPath: number[] = [];
    paths.forEach((path, p) => {
      let won = 0;
      let wonWith = 0;
      for (let i = 0; i < seeds; i++) {
        const seed = 2000 + (p * seeds + i) * 104729;
        if (playRun(seed, bot, loadout.chords).outcome === 'victory') won++;
        const run = playRun(seed, bot, loadout.chords, { calling: calling.id, path });
        if (run.outcome === 'victory') wonWith++;
      }
      base.push(won / seeds);
      byPath.push(wonWith / seeds);
    });
    console.log(
      `${bot.padEnd(8)} no Calling ${pct(mean(base))} · ${calling.name} ${pct(mean(byPath))} (all paths)`,
    );
    calling.tiers.forEach((tier, t) => {
      const took = (k: 0 | 1) => mean(byPath.filter((_, p) => paths[p]![t] === k));
      const [a, b] = tier.options;
      console.log(`  tier ${t + 1}: ${a!.name} ${pct(took(0))} · ${b!.name} ${pct(took(1))}`);
    });
    console.log(
      `  by path: ${paths.map((path, p) => `${path.join('')} ${pct(byPath[p]!)}`).join(' · ')}`,
    );
  }
}

if (process.argv[1]?.endsWith('callings.ts')) {
  if (argv.includes('--cells')) cells();
  else runs();
}
