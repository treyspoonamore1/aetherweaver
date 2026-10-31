/**
 * The raw-power cap (docs/phase-4h.md): what the Astrolabe and the Reliquary are worth together,
 * as the enemy life they make up for. The plan caps it at about +30% (02 §9).
 *
 *   npx tsx tools/powercap.ts --seeds 400 --set typical --steps 1.3,1.45
 *
 * Whole Prelude runs on Guardian with the Novice bot (the Skilled one wins too often to show it).
 * No meta at the usual enemy life is the base; the full tree (every Rank's and Deed's point) with a
 * carried set plays against tougher enemies at each step. The meta is worth the enemy life at
 * which it wins as often as the base, read on a logistic scale between the steps either side.
 */
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

function main(): void {
  const seeds = Number(get('seeds') ?? 400);
  const setName = get('set') ?? 'typical';
  const set = SETS[setName];
  if (!set) throw new Error(`Unknown set "${setName}" (${Object.keys(SETS).join(', ')})`);
  const steps = (get('steps') ?? '1.3,1.45').split(',').map(Number);
  const chords = CHORD_PRESETS.find((p) => p.id === 'guardian')!.chords;
  // `--points 19` spends fewer points; `--without overflowing_grace` leaves nodes out of reach.
  const without = new Set((get('without') ?? '').split(',').filter(Boolean));
  const tree = argv.includes('--no-tree')
    ? []
    : buildTree(
        [...TREES.grace!, ...TREES.notables!].filter((id) => !without.has(id)),
        Number(get('points') ?? 29),
      );
  const carried = argv.includes('--no-set') ? [] : set();
  const play = (threatMult: number, meta: boolean) => {
    let won = 0;
    for (let i = 0; i < seeds; i++) {
      const r = playRun(5000 + i * 104729, 'novice', chords, {
        astrolabe: meta ? tree : [],
        carried: meta ? carried : [],
        threatMult,
      });
      if (r.outcome === 'victory') won++;
    }
    return won / seeds;
  };
  const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
  const base = Number(get('base') ?? NaN);
  const b = Number.isFinite(base) ? base : play(1, false);
  console.log(
    `raw power · novice · ${seeds} runs · tree ${tree.length} nodes · set ${argv.includes('--no-set') ? 'none' : setName} · no meta at ×1: ${pct(b)}`,
  );
  const at = steps.map((t) => ({ t, win: play(t, true) }));
  for (const { t, win } of at) console.log(`  meta at ×${t}: ${pct(win)}`);
  // The step either side of the base, read on a logistic scale (or the nearest two, extrapolated).
  const sorted = [...at].sort((x, y) => x.t - y.t);
  let lo = sorted[0]!;
  let hi = sorted[sorted.length - 1]!;
  for (let i = 0; i + 1 < sorted.length; i++)
    if (sorted[i]!.win >= b && sorted[i + 1]!.win <= b) {
      lo = sorted[i]!;
      hi = sorted[i + 1]!;
    }
  if (lo === hi) {
    console.log('  (one step: give two to read the worth)');
    return;
  }
  const t = lo.t + ((logit(lo.win) - logit(b)) / (logit(lo.win) - logit(hi.win))) * (hi.t - lo.t);
  console.log(`  worth about +${((t - 1) * 100).toFixed(0)}% enemy life`);
}

if (process.argv[1]?.endsWith('powercap.ts')) main();
