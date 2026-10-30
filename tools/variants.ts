/**
 * Technique variants report (docs/phase-4f.md): what each variant is worth against its slot's
 * default, as the enemy life it's worth.
 *
 *   npx tsx tools/variants.ts --tree --seeds 300 --base 0.85 --base-hard 0.61
 *   npx tsx tools/variants.ts --tree --bot skilled --threat 2 --seeds 300 --variants chorale,swap
 *   npx tsx tools/variants.ts --tree --fires --seeds 20          how often each variant is cast
 *   npx tsx tools/variants.ts --tree --bot skilled --threat 2 --variants chorale+purge+anchor+skate
 *                                                                 a set of them together
 *
 * The build is tools/bonds.ts's: the Novice bot (or `--bot skilled`), Guardian, and with
 * `--tree` the Rank-20 build. Each variant's worth is the extra enemy life that costs as much,
 * on a logistic scale between the base and the base with 25% more life; a variant that helps
 * is worth negative life. The bots press the same keys for every variant.
 */
import type { BotKind } from '../src/bots';
import { CONTENT } from '../src/content';
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
  const loadout = CHORD_PRESETS.find((p) => p.id === (get('loadout') ?? 'guardian'))!;
  const seeds = Number(get('seeds') ?? 100);
  const bot = (get('bot') ?? 'novice') as BotKind;
  const tree = argv.includes('--tree') ? buildTree([...TREES.grace!, ...TREES.notables!], 29) : [];
  const carried = argv.includes('--tree') ? SETS.typical!() : [];
  const threat = Number(get('threat') ?? 1);
  const ids = (get('variants') ?? CONTENT.techniqueVariants.map((v) => v.id).join(',')).split(',');
  // "chorale+skate" plays a set of variants together, one per slot.
  const technique = (id: string) =>
    Object.fromEntries(
      id.split('+').map((one) => {
        const def = CONTENT.techniqueVariants.find((v) => v.id === one);
        if (!def) throw new Error(`Unknown technique variant "${one}"`);
        return [def.slot, one];
      }),
    );
  const play = (threatMult: number, id: string | null, onCast?: () => void) => {
    let won = 0;
    for (let i = 0; i < seeds; i++) {
      const r = playRun(5000 + i * 104729, bot, loadout.chords, {
        astrolabe: tree,
        carried,
        threatMult,
        ...(id ? { techniques: technique(id) } : {}),
        ...(onCast
          ? {
              onEvents: (events) => {
                for (const e of events)
                  if (e.type === 'techniqueCast' && e.variant === id) onCast();
              },
            }
          : {}),
      });
      if (r.outcome === 'victory') won++;
    }
    return won / seeds;
  };
  const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

  if (argv.includes('--fires')) {
    console.log(`variants cast · ${bot} · ${seeds} runs each`);
    for (const id of ids) {
      let casts = 0;
      play(threat, id, () => casts++);
      console.log(`  ${id.padEnd(12)} ${(casts / seeds).toFixed(1).padStart(6)} a run`);
    }
    return;
  }

  const base = Number(get('base') ?? NaN);
  const harder = Number(get('base-hard') ?? NaN);
  const hi = Number.isFinite(base) ? base : play(threat, null);
  const lo = Number.isFinite(harder) ? harder : play(threat * 1.25, null);
  const worth = (win: number) => (25 * (logit(hi) - logit(win))) / (logit(hi) - logit(lo));
  console.log(
    `variants · ${bot} · ${seeds} runs each · base ×${threat}: ${pct(hi)}, ×${(threat * 1.25).toFixed(2)}: ${pct(lo)}`,
  );
  for (const id of ids) {
    const win = play(threat, id);
    console.log(`  ${id.padEnd(12)} ${pct(win)} · like ${worth(win).toFixed(1)}% enemy life`);
  }
}

if (process.argv[1]?.endsWith('variants.ts')) main();
