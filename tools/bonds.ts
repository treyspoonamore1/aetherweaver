/**
 * Bonds report (docs/phase-4e.md): Bond XP pacing, and what each talent and alternate Solo is
 * worth, as the enemy life it's worth.
 *
 *   npx tsx tools/bonds.ts --pace --seeds 40                    Bond XP a run, and runs to each tier
 *   npx tsx tools/bonds.ts --find --seeds 100                   the build's win rates at a threat
 *   npx tsx tools/bonds.ts --seeds 300 --base 0.8 --base-hard 0.55 --talents ricochet,last_light
 *   npx tsx tools/bonds.ts --seeds 300 --base 0.8 --base-hard 0.55 --sets
 *
 * The build: the Novice bot (or `--bot skilled`), Guardian, and with `--tree` the Rank-20 build
 * of tools/dissonance.ts (a full tree and a typical carried set). Each choice's worth is read as
 * the extra enemy life that costs as much, on a logistic scale between the base and the base
 * with 25% more life; a talent that helps is worth negative life.
 */
import type { BotKind } from '../src/bots';
import { CONTENT } from '../src/content';
import { bondRank, type RunBond } from '../src/meta/bonds';
import { CHORD_PRESETS } from '../src/meta/run';
import { buildTree, TREES } from './astrolabe';
import { playRun } from './harness-core';
import { SETS } from './reliquary';

const argv = process.argv.slice(2);
const get = (name: string) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
};

const logit = (p: number) => {
  const q = Math.min(0.995, Math.max(0.005, p));
  return Math.log(q / (1 - q));
};

/** One hero's choice as a run's Bonds. */
function choice(id: string): RunBond[] {
  const talent = CONTENT.talents.find((t) => t.id === id);
  if (talent) return [{ heroId: talent.hero, talents: [id], solo: null }];
  const solo = CONTENT.altSolos.find((s) => s.id === id);
  if (solo) return [{ heroId: solo.hero, talents: [], solo: id }];
  throw new Error(`Unknown talent or Solo "${id}"`);
}

/** A hero's full Bond: the first talent of each tier (or `pick` of them), and a Solo. */
function fullBond(hero: string, pick: 0 | 1, alt: boolean): RunBond {
  const talents = [1, 2, 3].map(
    (tier) => CONTENT.talents.filter((t) => t.hero === hero && t.tier === tier)[pick]!.id,
  );
  const solo = alt ? (CONTENT.altSolos.find((s) => s.hero === hero)?.id ?? null) : null;
  return { heroId: hero, talents, solo };
}

function main(): void {
  const loadout = CHORD_PRESETS.find((p) => p.id === (get('loadout') ?? 'guardian'))!;
  const seeds = Number(get('seeds') ?? 100);
  const bot = (get('bot') ?? 'novice') as BotKind;
  const tree = argv.includes('--tree') ? buildTree([...TREES.grace!, ...TREES.notables!], 29) : [];
  const carried = argv.includes('--tree') ? SETS.typical!() : [];
  const threat = Number(get('threat') ?? 1);
  const play = (threatMult: number, bonds: RunBond[] = []) => {
    let won = 0;
    const xp: Record<string, number> = {};
    for (let i = 0; i < seeds; i++) {
      const seed = 5000 + i * 104729;
      const r = playRun(seed, bot, loadout.chords, {
        astrolabe: tree,
        carried,
        threatMult,
        bonds,
      });
      if (r.outcome === 'victory') won++;
      for (const [hero, v] of Object.entries(r.bondXp)) xp[hero] = (xp[hero] ?? 0) + v;
    }
    for (const hero of Object.keys(xp)) xp[hero]! /= seeds;
    return { win: won / seeds, xp };
  };
  const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

  if (argv.includes('--pace')) {
    const { win, xp } = play(threat);
    console.log(`Bond XP a run · ${bot} · ${seeds} runs · wins ${pct(win)}`);
    const ranks = CONTENT.bondRules.ranks;
    for (const [hero, perRun] of Object.entries(xp)) {
      const runsTo = (rank: number) => (ranks[rank - 1]! / perRun).toFixed(1);
      console.log(
        `  ${hero.padEnd(6)} ${perRun.toFixed(0).padStart(4)} a run · rank 3 in ${runsTo(3)}, 6 in ${runsTo(6)}, 9 in ${runsTo(9)}, 10 in ${runsTo(10)} runs · after 10 runs: rank ${bondRank(perRun * 10)}`,
      );
    }
    return;
  }

  if (argv.includes('--find')) {
    console.log(`bonds base · ${bot} · tree ${tree.length} nodes · ${seeds} runs each`);
    const steps = (get('steps') ?? '1,1.25').split(',').map(Number);
    for (const t of steps) console.log(`  ×${t}: ${pct(play(t).win)}`);
    return;
  }

  const base = Number(get('base') ?? NaN);
  const harder = Number(get('base-hard') ?? NaN);
  const hi = Number.isFinite(base) ? base : play(threat).win;
  const lo = Number.isFinite(harder) ? harder : play(threat * 1.25).win;
  const worth = (win: number) => (25 * (logit(hi) - logit(win))) / (logit(hi) - logit(lo));
  console.log(
    `bonds · ${bot} · ${seeds} runs each · base ×${threat}: ${pct(hi)}, ×${(threat * 1.25).toFixed(2)}: ${pct(lo)}`,
  );
  if (argv.includes('--sets')) {
    const heroes = [...new Set(CONTENT.talents.map((t) => t.hero))];
    for (const hero of heroes)
      for (const pick of [0, 1] as const)
        for (const alt of [false, true]) {
          const win = play(threat, [fullBond(hero, pick, alt)]).win;
          console.log(
            `  ${hero} (${pick === 0 ? 'first' : 'second'} picks${alt ? ', alternate Solo' : ''})`.padEnd(
              46,
            ) + `${pct(win)} · like ${worth(win).toFixed(1)}% enemy life`,
          );
        }
    for (const pick of [0, 1] as const) {
      const win = play(
        threat,
        heroes.map((h) => fullBond(h, pick, false)),
      ).win;
      console.log(
        `  everyone (${pick === 0 ? 'first' : 'second'} picks)`.padEnd(46) +
          `${pct(win)} · like ${worth(win).toFixed(1)}% enemy life`,
      );
    }
    return;
  }
  const ids = (
    get('talents') ?? [...CONTENT.talents, ...CONTENT.altSolos].map((t) => t.id).join(',')
  ).split(',');
  for (const id of ids) {
    const win = play(threat, choice(id)).win;
    console.log(`  ${id.padEnd(18)} ${pct(win)} · like ${worth(win).toFixed(1)}% enemy life`);
  }
}

if (process.argv[1]?.endsWith('bonds.ts')) main();
