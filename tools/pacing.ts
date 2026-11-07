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
 * content (`EXPEDITION_MOVEMENTS`: the Finale route, I-III and the Finale on their shorter road,
 * docs/phase-5d.md; `--movements 3` plays the old I-III route to the Unweaver, `--movements 2`
 * I-II). It then splits each run's minutes by Movement and prints the Phase 5 exit's clock
 * (docs/phase-5d.md, "Pacing", question 2): the losses-included average Expedition against the
 * 30-40 band (stretch 38), the winning-run median beside it (soft ≤ 45), and the share that won
 * the Movement before the last (won III, guarded within 5 points of the full road).
 *
 * The Finale's own time is the played fight's (not a modelled 210 s): its modelled minutes per run
 * that reached it, and the fight's seconds by the run's Calling and party (`--party`: A, B, C or
 * 3 hero ids, as the harness takes it; the default party without it), since `bankCrescendo`'s
 * cost differs by both.
 */
import { CONTENT } from '../src/content';
import type { BotKind } from '../src/bots';
import { astrolabePoints } from '../src/meta/astrolabe';
import { deedPoints, deedsEarned } from '../src/meta/deeds';
import { masteryLevel, starlightForDeeds, tiersOpen } from '../src/meta/loom';
import { EXPEDITION_MOVEMENTS, rankOf, RUN_WIN_XP } from '../src/meta/profile';
import { isFieldMovement, movementDef } from '../src/content';
import { CHORD_PRESETS, movementOf, movementRewards } from '../src/meta/run';
import type { RunState } from '../src/meta/types';
import { buildTree, TREES } from './astrolabe';
import { partyArg } from './harness';
import { movementName, playRun } from './harness-core';

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
/**
 * The roadmap's band for a whole Expedition, in modelled minutes (docs/plan/06, 30-40), its
 * stretch, and the winning-run median's soft ceiling (docs/phase-5d.md, question 2).
 */
const EXPEDITION_BAND = [30, 40] as const;
const EXPEDITION_STRETCH = 38;
const WINNING_MEDIAN_SOFT = 45;
/** The Finale's modelled minutes per run that reaches it (docs/phase-5d.md, "Pacing"). */
const FINALE_BAND = [3.5, 5] as const;

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
  const party = partyArg(get('party'));
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
  // Each Expedition's modelled minutes, and whether it won; the last Movement's played seconds by
  // the run's Calling (docs/phase-5d.md: the Finale's time is the played fight's).
  const expeditionMinutes: { minutes: number; won: boolean }[] = [];
  const lastFight: Record<string, number[]> = {};

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
        ...(party ? { party } : {}),
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
        expeditionMinutes.push({
          minutes: summary.minutes + around / 60,
          won: summary.outcome === 'victory',
        });
        if (summary.movementReached >= route) {
          const key = callingId ?? 'none';
          (lastFight[key] ??= []).push((summary.minutesByMovement[route - 1] ?? 0) * 60);
        }
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
  // Movements by name: numerals, or a def's label (docs/phase-5d.md: 'The Finale').
  const names = Array.from({ length: route }, (_, k) => movementName(k + 1));
  const finale = !isFieldMovement(movementDef(route));
  if (expeditions > 0) {
    const pctOf = (n: number) => `${((100 * n) / expeditions).toFixed(0)}%`;
    const reach = names
      .slice(1)
      .map((_name, k) => `reach ${movementName(k + 2, true)} ${pctOf(reachedBy[k + 1]!)}`)
      .join(' · ');
    // 'Movements I–III and the Finale' on the Finale route; 'Movements I–III' before it.
    const fields = finale ? names.slice(0, -1) : names;
    const span = `Movements ${fields[0]}–${fields.at(-1)}${finale ? ` and ${movementName(route, true)}` : ''}`;
    console.log(
      `  Expeditions (from Rank ${EXPEDITION_RANK}, ${span}): ${expeditions} runs · ${reach} · won ${pctOf(expeditionWins)} · ${minutesByMovement.map((m) => (m / expeditions).toFixed(1)).join(' + ')} min a run (${names.join(' + ')})`,
    );
    // The Phase 5 exit's clock (docs/phase-5d.md, question 2): the losses-included average
    // Expedition (every one, lost runs included) against the band, the winning-run median beside
    // it, and the share that won the Movement before the last (won III on the Finale route).
    const average = expeditionMinutes.reduce((s, r) => s + r.minutes, 0) / expeditions;
    const winning = expeditionMinutes.filter((r) => r.won).map((r) => r.minutes);
    const inBand = average >= EXPEDITION_BAND[0] && average <= EXPEDITION_BAND[1];
    const before = route >= 2 ? ` · won ${names[route - 2]} ${pctOf(reachedBy[route - 1]!)}` : '';
    console.log(
      `  Expedition: average ${average.toFixed(1)} min (band ${EXPEDITION_BAND.join('-')}, stretch ${EXPEDITION_STRETCH}: ${inBand ? (average <= EXPEDITION_STRETCH ? 'band met, stretch met' : 'band met, stretch not met') : 'missed'}) · winning-run median ${winning.length ? median(winning).toFixed(1) : '-'} (${winning.length} won; soft ≤${WINNING_MEDIAN_SOFT})${before}`,
    );
    if (finale && reachedBy[route - 1]! > 0) {
      // The Finale, played: its modelled minutes per run that reached it, and the fight itself
      // by the run's Calling, in the run's party.
      const reaching = reachedBy[route - 1]!;
      const perRun = minutesByMovement[route - 1]! / reaching;
      const byCalling = Object.entries(lastFight)
        .map(
          ([k, xs]) =>
            `${k} ${(xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(0)} s (${xs.length})`,
        )
        .join(' · ');
      console.log(
        `  ${names[route - 1]}: ${perRun.toFixed(1)} modelled min per run that reached it (band ${FINALE_BAND.join('-')}) · the fight, party ${party ? party.join(',') : 'default'}: ${byCalling}`,
      );
    }
    const perMin = (mins: number[]) => xpByMovement.map((x, k) => x / Math.max(1e-9, mins[k]!));
    const line = (mins: number[]) => {
      const rates = perMin(mins);
      const first = rates[0]!;
      const ratios = rates
        .slice(1)
        .map((r, k) => `${ROMAN[k + 1]}/I ${(r / first).toFixed(2)}`)
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
