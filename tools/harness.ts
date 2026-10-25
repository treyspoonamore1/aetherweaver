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
import { playEncounter, playRun, type EncounterRun } from './harness-core';

interface Args {
  encounters: string[];
  bots: BotKind[];
  seeds: number;
  auras: string[];
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
    auras: (get('auras') ?? 'sostenuto,ostinato').split(',').filter(Boolean),
    json: get('json') ?? null,
    verbose: argv.includes('--verbose'),
  };
}

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

function runs(args: Args): void {
  console.log(`harness · whole Prelude runs · ${args.seeds} seeds · auras ${args.auras.join('+')}`);
  for (const bot of args.bots) {
    const results = Array.from({ length: args.seeds }, (_, i) =>
      playRun(2000 + i * 104729, bot, args.auras),
    );
    const wins = results.filter((r) => r.outcome === 'victory').length;
    const endedAt: Record<string, number> = {};
    for (const r of results)
      if (r.outcome === 'defeat') endedAt[r.lastEncounter] = (endedAt[r.lastEncounter] ?? 0) + 1;
    const minutes = results.reduce((s, r) => s + r.minutes, 0) / results.length;
    console.log(
      `${bot.padEnd(8)} win ${pct(wins / results.length).padStart(4)} · avg ${minutes.toFixed(1)} min of combat · lost at ${JSON.stringify(endedAt)}`,
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
  console.log(`harness · ${args.seeds} seeds · auras ${args.auras.join('+') || 'none'}`);
  console.log(
    'encounter          bot      win   avg s   wave@loss  boss%@loss  share  perf  saves  downs',
  );
  for (const encounter of args.encounters) {
    for (const bot of args.bots) {
      const runs: EncounterRun[] = [];
      for (let i = 0; i < args.seeds; i++) {
        const seed = 1000 + i * 7919;
        runs.push(playEncounter({ seed, encounter, auras: args.auras }, bot));
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
