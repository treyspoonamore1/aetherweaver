/**
 * Balance harness v1 (docs/plan/06 §2 Phase 1 exit): plays encounters with Idle / Novice /
 * Skilled bots across many seeds and reports win rates, durations, the Weaver's share of
 * party output and the go/no-go bands.
 *
 *   npx tsx tools/harness.ts --encounters first_light,tolling_halls --seeds 20
 *   npx tsx tools/harness.ts --run --seeds 10      # whole Prelude runs (map, drafts, carry-over)
 */
import { writeFileSync } from 'node:fs';
import type { BotKind } from '../src/bots';
import { CHORD_PRESETS } from '../src/meta/run';
import type { ChordLoadout } from '../src/meta/types';
import { playEncounter, playRun, type EncounterRun } from './harness-core';

interface Args {
  encounters: string[];
  bots: BotKind[];
  seeds: number;
  /** The loadout: `--loadout <preset>` or `--auras a,b` (one Chord, no ornaments). */
  chords: ChordLoadout[];
  label: string;
  json: string | null;
  verbose: boolean;
}

function parseArgs(argv: string[]): Args {
  const get = (name: string) => {
    const i = argv.indexOf(`--${name}`);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  return {
    encounters: (
      get('encounters') ??
      'first_light,tolling_halls,glass_gallery,choir_loft,mourning_steps,muted_nave,shattered_choir,bellwarden,hollow_cantor'
    ).split(','),
    bots: (get('bots') ?? 'idle,novice,skilled').split(',') as BotKind[],
    seeds: Number(get('seeds') ?? 10),
    ...loadoutArg(get('loadout'), get('auras')),
    json: get('json') ?? null,
    verbose: argv.includes('--verbose'),
  };
}

function loadoutArg(
  preset: string | undefined,
  auras: string | undefined,
): { chords: ChordLoadout[]; label: string } {
  if (preset) {
    const p = CHORD_PRESETS.find((x) => x.id === preset);
    if (!p) throw new Error(`Unknown loadout "${preset}" (${CHORD_PRESETS.map((x) => x.id)})`);
    return { chords: p.chords.map((c) => ({ ...c })), label: p.name };
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
  console.log(
    `harness · whole Prelude runs · ${args.seeds} seeds · loadout ${args.label}${callingArg ? ` · ${callingArg} ${pathArg?.join('') ?? '0000'}` : ''}`,
  );
  for (const bot of args.bots) {
    const results = Array.from({ length: args.seeds }, (_, i) =>
      playRun(2000 + i * 104729, bot, args.chords, {
        relics: !process.argv.includes('--no-relics'),
        calling: callingArg,
        path: pathArg,
      }),
    );
    const wins = results.filter((r) => r.outcome === 'victory').length;
    const endedAt: Record<string, number> = {};
    for (const r of results)
      if (r.outcome === 'defeat') endedAt[r.lastEncounter] = (endedAt[r.lastEncounter] ?? 0) + 1;
    const mean = (f: (r: (typeof results)[number]) => number) =>
      results.reduce((s, r) => s + f(r), 0) / results.length;
    console.log(
      `${bot.padEnd(8)} win ${pct(wins / results.length).padStart(4)} · avg ${mean((r) => r.minutes).toFixed(1)} min of combat · ${mean((r) => r.fights).toFixed(1)} fights · ${mean((r) => r.relics.length).toFixed(1)} relics · Aether ${Math.round(mean((r) => r.aetherEarned))} earned, ${Math.round(mean((r) => r.aetherLeft))} left · lost at ${JSON.stringify(endedAt)}`,
    );
    if (args.verbose)
      for (const r of results)
        console.log(
          `  ${r.seed} ${r.outcome.padEnd(7)} ${r.fights} fights · relics ${r.relics.join(', ') || '—'} · motifs ${r.motifs.join(', ')}`,
        );
  }
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  if (process.argv.includes('--run')) {
    runs(args);
    return;
  }
  const all: EncounterRun[] = [];
  const t0 = Date.now();
  console.log(`harness · ${args.seeds} seeds · loadout ${args.label}`);
  console.log(
    'encounter          bot      win   avg s   wave@loss  boss%@loss  share  perf  saves  downs',
  );
  for (const encounter of args.encounters) {
    for (const bot of args.bots) {
      const runs: EncounterRun[] = [];
      for (let i = 0; i < args.seeds; i++) {
        const seed = 1000 + i * 7919;
        runs.push(playEncounter({ seed, encounter, chords: args.chords }, bot));
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
        ].join(' '),
      );
      if (args.verbose) {
        const k = (f: (r: EncounterRun) => number) => Math.round(avg(runs.map(f)));
        console.log(
          `   heroDmg ${k((r) => r.partyDamage - r.amplified)} amp ${k((r) => r.amplified)} heal ${k((r) => r.healing)} shield ${k((r) => r.shielded)} negated ${k((r) => r.negated)} incoming ${k((r) => r.incoming)}`,
        );
      }
    }
  }
  console.log(`done in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  if (args.json) {
    writeFileSync(args.json, JSON.stringify(all, null, 2));
  }
}

main();
