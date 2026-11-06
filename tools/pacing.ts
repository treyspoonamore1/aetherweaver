/**
 * Pacing report (docs/phase-4g.md, docs/phase-4h.md): a new player's first hours, run by run.
 *
 *   npx tsx tools/pacing.ts --players 12 --hours 3
 *   npx tsx tools/pacing.ts --players 12 --hours 3 --bot skilled
 *   npx tsx tools/pacing.ts --players 12 --hours 3 --route expedition
 *   npx tsx tools/pacing.ts --players 12 --hours 3 --seed-base 77003   # another seed set
 *
 * Each player plays whole runs with the bot on what their Rank has opened: the newest preset it
 * allows, its Astrolabe points spent on a fixed tree, and from the first Calling's Rank that
 * Calling, with the path tiers its mastery has opened. Weaver XP, Starlight (fights and Deeds) and
 * mastery accrue as the stores pay them. The clock is each run's fights plus a fixed allowance for
 * everything around them (`AROUND`); it's a model of a player, not a measurement of one.
 *
 * The route (docs/phase-5a.md): by default every run is a Prelude, the calibrated baseline of
 * docs/phase-4h.md. `--route expedition` plays as the game does: the first run is the Prelude,
 * and from Rank 2 (when Expeditions open) every run is an Expedition through every Movement in
 * content (`EXPEDITION_MOVEMENTS`: I-III and the Finale, to the Silent Conductor,
 * docs/phase-5d.md; `--movements 3` plays the old I-III route, `--movements 2` the I-II); it then
 * splits each run's minutes by Movement and prints the Finale's budget: the 40 modelled minutes
 * the roadmap allows an Expedition, less what I-N take.
 */
import { CONTENT } from '../src/content';
import type { BotKind } from '../src/bots';
import { astrolabePoints } from '../src/meta/astrolabe';
import { deedPoints, deedsEarned } from '../src/meta/deeds';
import { masteryLevel, starlightForDeeds, tiersOpen } from '../src/meta/loom';
import { EXPEDITION_MOVEMENTS, rankOf, RUN_WIN_XP } from '../src/meta/profile';
import { CHORD_PRESETS, movementOf, movementRewards } from '../src/meta/run';
import type { RunState } from '../src/meta/types';
import { buildTree, TREES } from './astrolabe';
import { playRun } from './harness-core';

/**
 * Seconds a player spends on each phase of a run besides its fights, and before each run (Prep
 * and the Loom). Reading a scene or an event takes longer than picking a path.
 */
const AROUND: Partial<Record<RunState['phase'], number>> = {
  map: 6,
  result: 12,
  calling: 20,
  relic: 15,
  draft: 20,
  respite: 25,
  scene: 45,
  merchant: 45,
  forge: 20,
  event: 40,
};
const BEFORE_RUN = 90;
const AFTER_RUN = 45;
/** The roadmap's ceiling for a whole Expedition, in modelled minutes (docs/plan/06, 30-40). */
const EXPEDITION_BUDGET = 40;

const ROMAN = ['I', 'II', 'III', 'IV', 'V'];

const argv = process.argv.slice(2);
const get = (name: string) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
};

interface Milestone {
  id: string;
  label: string;
}

function main(): void {
  const players = Number(get('players') ?? 12);
  const hours = Number(get('hours') ?? 3);
  const bot = (get('bot') ?? 'novice') as BotKind;
  const expedition = (get('route') ?? 'prelude') === 'expedition';
  /** An Expedition's Movements: every one in content, unless `--movements` says otherwise. */
  const route = Number(get('movements') ?? EXPEDITION_MOVEMENTS);
  const seedBase = Number(get('seed-base') ?? 9001);
  /** Rank 2 opens Expeditions (docs/phase-5a.md); the first run is always the Prelude. */
  const EXPEDITION_RANK = 2;
  const calling = CONTENT.callings.reduce((a, b) => (b.unlockRank < a.unlockRank ? b : a));
  const cheapest = Math.min(
    ...[...CONTENT.cosmetics.robes, ...CONTENT.cosmetics.threads].map((c) => c.price),
  );
  const milestones: Milestone[] = [
    ...Array.from({ length: 9 }, (_, i) => ({ id: `rank${i + 2}`, label: `Rank ${i + 2}` })),
    { id: 'atelier', label: `the Atelier opens (Rank ${CONTENT.starlight.atelierRank})` },
    { id: 'keepsake', label: `a first keepsake affordable (${cheapest} Starlight)` },
    {
      id: 'variant',
      label: `a variant affordable (${CONTENT.starlight.variantPrice} Starlight)`,
    },
    ...[2, 3, 4, 5].map((level) => ({
      id: `mastery${level}`,
      label: `${calling.name} mastery ${level}${level === 5 ? ' (its variant, its title)' : ` (tier ${['', '', 'II', 'III', 'IV'][level]})`}`,
    })),
    { id: 'win', label: 'a first won run' },
  ];
  const at: Record<string, number[]> = Object.fromEntries(milestones.map((m) => [m.id, []]));
  const checkpoints = [60, 120, 180].filter((m) => m <= hours * 60);
  const starlightAt: Record<number, number[]> = Object.fromEntries(checkpoints.map((m) => [m, []]));
  const rankAt: Record<number, number[]> = Object.fromEntries(checkpoints.map((m) => [m, []]));
  let allRuns = 0;
  let allWins = 0;
  let allXp = 0;
  let allMinutes = 0;
  // Expeditions only: their count, the runs reaching each Movement, minutes by Movement.
  let expeditions = 0;
  const reachedBy = Array.from({ length: route }, () => 0);
  let expeditionWins = 0;
  const minutesByMovement = Array.from({ length: route }, () => 0);
  // Weaver XP by Movement, without the run's win bonus (it belongs to the run, wherever it ends).
  const xpByMovement = Array.from({ length: route }, () => 0);
  const combatByMovement = Array.from({ length: route }, () => 0);

  for (let p = 0; p < players; p++) {
    let xp = 0;
    let starlight = 0;
    let minutes = 0;
    let wins = 0;
    const mastery: Record<string, number> = {};
    const deeds: string[] = [];
    const reached = new Set<string>();
    const reach = (id: string) => {
      if (reached.has(id)) return;
      reached.add(id);
      at[id]!.push(minutes);
    };
    const pending = [...checkpoints];
    for (let r = 0; minutes < hours * 60; r++) {
      const rank = rankOf(xp);
      const preset = CHORD_PRESETS.filter((x) => x.rank <= rank).at(-1)!;
      const points = astrolabePoints(rank, false, deedPoints(deeds));
      const tree = points > 0 ? buildTree([...TREES.grace!, ...TREES.notables!], points) : [];
      const callingId = rank >= calling.unlockRank ? calling.id : undefined;
      let around = BEFORE_RUN + AFTER_RUN;
      const movements = expedition && rank >= EXPEDITION_RANK ? route : 1;
      const aroundBy = Array.from({ length: Math.max(1, movements) }, (_, k) =>
        k === 0 ? BEFORE_RUN + AFTER_RUN : 0,
      );
      let finished: RunState | null = null;
      const summary = playRun(seedBase + p * 7919 + r * 104729, bot, preset.chords, {
        astrolabe: tree,
        calling: callingId,
        path: [0, 0, 0, 0],
        tiersOpen: callingId ? tiersOpen(callingId, mastery[callingId] ?? 0, false) : undefined,
        onPhase: (phase, now) => {
          const s = AROUND[phase] ?? 0;
          around += s;
          aroundBy[Math.min(aroundBy.length - 1, movementOf(now) - 1)]! += s;
        },
        onEnd: (run) => (finished = run),
        movements,
      });
      const run = finished as RunState | null;
      if (!run) throw new Error('the run never ended');
      const runXp = run.results.reduce((s, x) => s + x.xp, 0);
      const fresh = deedsEarned(run, deeds);
      deeds.push(...fresh);
      const earned =
        run.results.reduce((s, x) => s + (x.starlight ?? 0), 0) + starlightForDeeds(fresh);
      minutes += summary.minutes + around / 60;
      // Checkpoints read the totals as they stood when that minute passed.
      while (pending.length > 0 && minutes >= pending[0]!) {
        const m = pending.shift()!;
        starlightAt[m]!.push(starlight);
        rankAt[m]!.push(rankOf(xp));
      }
      xp += runXp;
      starlight += earned;
      if (callingId) mastery[callingId] = (mastery[callingId] ?? 0) + runXp;
      if (summary.outcome === 'victory') {
        wins++;
        reach('win');
      }
      allRuns++;
      allXp += runXp;
      allMinutes += summary.minutes + around / 60;
      if (movements >= 2) {
        expeditions++;
        for (let k = 0; k < route; k++) if (summary.movementReached >= k + 1) reachedBy[k]!++;
        if (summary.outcome === 'victory') expeditionWins++;
        for (let k = 0; k < route; k++)
          minutesByMovement[k]! += (summary.minutesByMovement[k] ?? 0) + (aroundBy[k] ?? 0) / 60;
        for (let k = 0; k < route; k++) combatByMovement[k]! += summary.minutesByMovement[k] ?? 0;
        for (const x of run.results) {
          const m = x.movement ?? 1;
          const win = x.wonRun ? Math.round(RUN_WIN_XP * movementRewards(m).xp) : 0;
          xpByMovement[Math.min(route - 1, m - 1)]! += x.xp - win;
        }
      }
      const now = rankOf(xp);
      for (let k = 2; k <= Math.min(10, now); k++) reach(`rank${k}`);
      if (now >= CONTENT.starlight.atelierRank) {
        reach('atelier');
        if (starlight >= cheapest) reach('keepsake');
        if (starlight >= CONTENT.starlight.variantPrice) reach('variant');
      }
      if (callingId)
        for (let level = 2; level <= masteryLevel(mastery[callingId]!); level++)
          reach(`mastery${level}`);
    }
    for (const m of pending) {
      starlightAt[m]!.push(starlight);
      rankAt[m]!.push(rankOf(xp));
    }
    allWins += wins;
  }

  const median = (xs: number[]) => {
    const s = [...xs].sort((a, b) => a - b);
    return s.length === 0 ? NaN : s[Math.floor((s.length - 1) / 2)]!;
  };
  const clock = (m: number) =>
    `${Math.floor(m / 60)}:${String(Math.round(m % 60)).padStart(2, '0')}`;
  console.log(
    `pacing · ${bot} · ${players} players · ${hours} h each · ${allRuns} runs · wins ${((100 * allWins) / allRuns).toFixed(0)}% · ${(allMinutes / allRuns).toFixed(1)} min and ${(allXp / allRuns).toFixed(0)} XP a run`,
  );
  const names = ROMAN.slice(0, route);
  if (expeditions > 0) {
    const pctOf = (n: number) => `${((100 * n) / expeditions).toFixed(0)}%`;
    const reach = names
      .slice(1)
      .map((name, k) => `reach ${name} ${pctOf(reachedBy[k + 1]!)}`)
      .join(' · ');
    console.log(
      `  Expeditions (from Rank ${EXPEDITION_RANK}, Movements ${names[0]}–${names.at(-1)}): ${expeditions} runs · ${reach} · won ${pctOf(expeditionWins)} · ${minutesByMovement.map((m) => (m / expeditions).toFixed(1)).join(' + ')} min a run (Movement ${names.join(' + ')})`,
    );
    // The roadmap's 40 minutes, less what the Movements in content take: the Finale's room
    // (docs/phase-5c.md, "Pacing"). Each Movement's minutes are over every Expedition (those
    // that never reach it count 0), so this is the room a typical run leaves.
    const total = minutesByMovement.reduce((s, m) => s + m, 0) / expeditions;
    console.log(
      `  Finale budget: ${EXPEDITION_BUDGET} − ${total.toFixed(1)} = ${(EXPEDITION_BUDGET - total).toFixed(1)} modelled min (Movements ${names.join(' + ')} a run)`,
    );
    const perMin = (mins: number[]) => xpByMovement.map((x, k) => x / Math.max(1e-9, mins[k]!));
    const line = (mins: number[]) => {
      const rates = perMin(mins);
      const first = rates[0]!;
      const ratios = rates
        .slice(1)
        .map((r, k) => `${names[k + 1]}/I ${(r / first).toFixed(2)}`)
        .join(', ');
      return `${rates.map((r) => r.toFixed(1)).join(' / ')} (${ratios})`;
    };
    console.log(
      `  Weaver XP a minute, Movement ${names.join(' / ')}, without the win bonus: ${line(minutesByMovement)} of the modelled clock · ${line(combatByMovement)} of combat`,
    );
  }
  console.log('  first reached (median, h:mm) · how many players reached it');
  for (const m of milestones) {
    const times = at[m.id]!;
    if (times.length === 0) {
      console.log(`  ${'—'.padStart(6)}  ${m.label} · 0/${players}`);
      continue;
    }
    console.log(`  ${clock(median(times)).padStart(6)}  ${m.label} · ${times.length}/${players}`);
  }
  for (const m of checkpoints)
    console.log(
      `  at ${clock(m)}: Rank ${median(rankAt[m]!)}, ${median(starlightAt[m]!)} Starlight earned (median)`,
    );
}

if (process.argv[1]?.endsWith('pacing.ts')) main();
