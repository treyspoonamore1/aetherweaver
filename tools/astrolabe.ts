/**
 * Astrolabe report (docs/phase-4.md): what a full tree (19 points) is worth, against no tree on
 * the same seeds. Each named tree takes its target nodes in order (the shortest path to each),
 * as a player pointing at them would.
 *
 *   npx tsx tools/astrolabe.ts --fights --seeds 20            the six hard fights (Threat 1)
 *   npx tsx tools/astrolabe.ts --loadout guardian --seeds 25   whole Prelude runs
 *   npx tsx tools/astrolabe.ts --trees silk,choir --bots novice
 *   npx tsx tools/astrolabe.ts --threat 1.15                  trees against enemies with 15% more life
 *
 * Fights report the win rate and the Weaver's output (healing, shielding, negation and
 * amplification from the ledger), per fight and per second; runs report the win rate. With
 * `--threat`, the trees play runs whose enemies have that much more life: a tree worth +15% wins
 * as often at 1.15 as no tree does at 1.
 */
import { makeBot, type BotKind } from '../src/bots';
import { allocate, astrolabeProblems } from '../src/meta/astrolabe';
import { CHORD_PRESETS } from '../src/meta/run';
import { createSim } from '../src/sim';
import { playRun } from './harness-core';

const POINTS = 19;

/** Takes each target and the path to it, in order, while the points last. */
export function buildTree(targets: readonly string[], points = POINTS): string[] {
  let tree: string[] = [];
  for (const id of targets) tree = allocate(tree, id, points);
  return tree;
}

/** Named trees: a constellation's travel nodes and notables (no keystone), or with one. */
export const TREES: Readonly<Record<string, readonly string[]>> = {
  silk: [
    'silk_an',
    'silk_a4',
    'silk_bn',
    'silk_b4',
    'resonant_thread',
    'lifeguard',
    'choir_an',
    'aegis_bn',
  ],
  choir: [
    'choir_an',
    'choir_a4',
    'choir_bn',
    'choir_b4',
    'resonant_thread',
    'anthem',
    'bond_an',
    'silk_bn',
  ],
  aegis: [
    'aegis_an',
    'aegis_a4',
    'aegis_bn',
    'aegis_b4',
    'lifeguard',
    'shield_bearer',
    'silk_an',
    'bond_bn',
  ],
  bond: ['second_wind', 'ensemble', 'anthem', 'shield_bearer', 'choir_b2', 'aegis_a2'],
  notables: ['silk_n1', 'choir_n1', 'aegis_n1', 'bond_n1', 'resonant_thread', 'anthem', 'choir_a2'],
  grace: [
    'overflowing_grace',
    'silk_bn',
    'silk_b2',
    'resonant_thread',
    'choir_n1',
    'choir_an',
    'choir_a3',
  ],
  sanguine: [
    'sanguine_font',
    'silk_an',
    'resonant_thread',
    'choir_an',
    'choir_n1',
    'lifeguard',
    'aegis_b2',
  ],
  prism: [
    'prism_covenant',
    'choir_bn',
    'resonant_thread',
    'silk_bn',
    'anthem',
    'bond_an',
    'choir_b3',
  ],
  chorus: [
    'unbroken_chorus',
    'choir_an',
    'anthem',
    'bond_an',
    'resonant_thread',
    'choir_a4',
    'silk_b2',
  ],
  halo: [
    'shatterproof_halo',
    'aegis_bn',
    'shield_bearer',
    'bond_bn',
    'lifeguard',
    'silk_an',
    'aegis_b3',
  ],
  conduit: [
    'eldritch_conduit',
    'aegis_an',
    'lifeguard',
    'silk_an',
    'shield_bearer',
    'bond_bn',
    'aegis_a3',
  ],
};

const HARD_FIGHTS = [
  'tolling_halls',
  'glass_gallery',
  'muted_nave',
  'shattered_choir',
  'bellwarden',
  'hollow_cantor',
];
const MAX_SECONDS = 9 * 60;

const argv = process.argv.slice(2);
const get = (name: string) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
};

function main(): void {
  const loadout = CHORD_PRESETS.find((p) => p.id === (get('loadout') ?? 'guardian'));
  if (!loadout) throw new Error(`Unknown loadout (${CHORD_PRESETS.map((p) => p.id)})`);
  const seeds = Number(get('seeds') ?? 20);
  const bots = (get('bots') ?? 'novice,skilled').split(',') as BotKind[];
  const names = (get('trees') ?? Object.keys(TREES).join(',')).split(',');
  const trees = names.map((name) => {
    const targets = TREES[name];
    if (!targets) throw new Error(`Unknown tree "${name}" (${Object.keys(TREES)})`);
    const tree = buildTree(targets);
    const problems = astrolabeProblems(tree, POINTS);
    if (problems.length > 0) throw new Error(`Tree "${name}": ${problems.join(' ')}`);
    return { name, tree };
  });
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  const signed = (x: number) => `${x >= 0 ? '+' : ''}${Math.round(x * 100)}%`;

  if (argv.includes('--fights')) {
    console.log(
      `astrolabe fights · loadout ${loadout.name} · ${HARD_FIGHTS.length} fights × ${seeds} seeds`,
    );
    for (const bot of bots) {
      const fight = (astrolabe: readonly string[]) => {
        let won = 0;
        let output = 0;
        let seconds = 0;
        for (const encounter of HARD_FIGHTS)
          for (let i = 0; i < seeds; i++) {
            const seed = 1000 + i * 7919;
            const chords = loadout.chords.map((c) => ({
              auras: [...c.auras],
              ornaments: [...c.ornaments],
            }));
            const sim = createSim({ seed, encounter, chords, astrolabe });
            const player = makeBot(bot, seed);
            for (let t = 0; t < MAX_SECONDS * 60; t++) {
              sim.step(player.decide(sim.state));
              sim.drainEvents();
              const s = sim.state.encounter.status;
              if (s === 'victory' || s === 'defeat') break;
            }
            const st = sim.state;
            const l = st.ledger;
            if (st.encounter.status === 'victory') won++;
            output += l.healing + l.shielded + l.negated + l.amplified;
            seconds += (st.encounter.endedAt ?? st.time) - st.encounter.startedAt;
          }
        const n = HARD_FIGHTS.length * seeds;
        return { win: won / n, output: output / n, perSecond: output / Math.max(1, seconds) };
      };
      const base = fight([]);
      console.log(
        `${bot.padEnd(8)} no tree ${pct(base.win)} · output ${Math.round(base.output)} a fight, ${Math.round(base.perSecond)}/s`,
      );
      for (const { name, tree } of trees) {
        const r = fight(tree);
        console.log(
          `  ${name.padEnd(9)} ${pct(r.win)} · output ${signed(r.output / base.output - 1)} a fight, ${signed(r.perSecond / base.perSecond - 1)}/s`,
        );
      }
    }
    return;
  }

  const threat = Number(get('threat') ?? 1);
  console.log(
    `astrolabe runs · loadout ${loadout.name} · ${seeds} seeds a tree` +
      (threat !== 1 ? ` · trees at ×${threat} enemy life` : ''),
  );
  for (const bot of bots) {
    const runs = (astrolabe: readonly string[], threatMult = 1) => {
      let won = 0;
      for (let i = 0; i < seeds; i++) {
        const seed = 2000 + i * 104729;
        const opts = { astrolabe, threatMult };
        if (playRun(seed, bot, loadout.chords, opts).outcome === 'victory') won++;
      }
      return won / seeds;
    };
    const base = runs([]);
    const harder = threat !== 1 ? ` · at ×${threat} ${pct(runs([], threat))}` : '';
    console.log(`${bot.padEnd(8)} no tree ${pct(base)}${harder}`);
    for (const { name, tree } of trees) {
      const win = runs(tree, threat);
      console.log(`  ${name.padEnd(9)} ${pct(win)} (${signed(win - base)})`);
    }
  }
}

if (process.argv[1]?.endsWith('astrolabe.ts')) main();
