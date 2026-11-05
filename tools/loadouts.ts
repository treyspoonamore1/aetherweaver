/**
 * Loadout report (docs/plan/06 Phase 2 exit, "build diversity"): plays every Chord preset
 * against every encounter with each bot, and flags loadouts that miss the difficulty contract
 * (dead) or beat every other loadout everywhere (dominant).
 *
 *   npx tsx tools/loadouts.ts --seeds 20 --bots skilled,novice --runs 10 --md docs/phase-2/loadouts.md
 *   npx tsx tools/loadouts.ts --movement 2 --seeds 20    # Movement II's fights, on the arrival kit
 *   npx tsx tools/loadouts.ts --movement 3 --seeds 20    # Movement III's, on ARRIVAL3_KIT
 *
 * Movement I's cells play bare; later Movements' play each preset with their kit's motifs and
 * relics (tools/kits.ts: the arrival kit, ARRIVAL3_KIT), against their floors (docs/phase-5a.md
 * and docs/phase-5c.md, "Bands"). `--runs` plays whole runs on the Movement's route (Movement
 * II: I-II Expeditions; Movement III: I-III).
 */
import { writeFileSync } from 'node:fs';
import type { BotKind } from '../src/bots';
import { encounterDef } from '../src/content';
import { CHORD_PRESETS } from '../src/meta/run';
import { movementEncounters, playEncounter, playRun } from './harness-core';
import { defaultKit, kitById, kitConfig } from './kits';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const movement = Number(arg('movement') ?? 1);
const kit = kitById(arg('kit') ?? defaultKit(movement));
const ENCOUNTERS = movementEncounters(movement);
const SHORT: Record<string, string> = {
  first_light: 'First',
  tolling_halls: 'Tolling',
  glass_gallery: 'Glass',
  choir_loft: 'Loft',
  mourning_steps: 'Steps',
  muted_nave: 'Nave*',
  shattered_choir: 'Shatter*',
  bellwarden: 'Bell**',
  hollow_cantor: 'Cantor**',
  crimson_gate: 'Gate',
  blood_rites: 'Rites',
  pike_line: 'Pikes',
  red_muster: 'Muster',
  leech_warren: 'Warren',
  shield_wall: 'Wall*',
  blood_forge: 'Forge*',
  gorehound_matriarch: 'Matriarch**',
  vharun: 'Vharun**',
  frayed_threshold: 'Threshold',
  maw_hollow: 'Maw',
  wraith_vigil: 'Vigil',
  null_chapel: 'Chapel',
  mirror_hall: 'Mirror',
  frayed_court: 'Court*',
  the_seamstress: 'Seamstress**',
  the_unweaver: 'Unweaver**',
};
/**
 * Skilled-bot floors from the difficulty contract (docs/phase-1.md; Movement II's from
 * docs/phase-5a.md: skirmishes and elites 85%, the Matriarch 90%, Vharun 85%; Movement III's from
 * docs/phase-5c.md: the same, but the Unweaver 80%).
 */
function floor(encounter: string): number {
  const def = encounterDef(encounter);
  if ((def.movement ?? 1) >= 3 && def.kind === 'boss') return 0.8;
  if ((def.movement ?? 1) >= 2) return def.kind === 'miniboss' ? 0.9 : 0.85;
  if (encounter === 'first_light') return 1;
  if (encounter === 'muted_nave' || encounter === 'shattered_choir') return 0.9;
  if (encounter === 'bellwarden' || encounter === 'hollow_cantor') return 0.9;
  return 0.8;
}

const seeds = Number(arg('seeds') ?? 20);
const runsN = Number(arg('runs') ?? 0);
const bots = (arg('bots') ?? 'skilled,novice').split(',') as BotKind[];
const only = arg('loadouts')?.split(',');
const presets = CHORD_PRESETS.filter((p) => !only || only.includes(p.id));
const pct = (v: number) => `${Math.round(v * 100)}%`;

const lines: string[] = [];
const out = (line = '') => {
  console.log(line);
  lines.push(line);
};

const t0 = Date.now();
out(`# Loadout report`);
out();
out(
  `${movement >= 2 ? `Movement ${movement}, ${kit.name}. ` : ''}${seeds} seeds per cell${runsN ? `, ${runsN} whole ${movement >= 2 ? 'Expeditions' : 'Prelude runs'} per loadout` : ''}. * elite, ** boss.`,
);
for (const bot of bots) {
  out();
  out(`## ${bot}`);
  out();
  out(
    `| Loadout | ${ENCOUNTERS.map((e) => SHORT[e]).join(' | ')} | Share | Calls answered |${runsN ? ' Runs |' : ''}`,
  );
  out(`|---|${ENCOUNTERS.map(() => '---').join('|')}|---|---|${runsN ? '---|' : ''}`);
  const table: Record<string, number[]> = {};
  for (const p of presets) {
    const rates: number[] = [];
    let share = 0;
    let calls = 0;
    let answered = 0;
    let n = 0;
    for (const encounter of ENCOUNTERS) {
      let wins = 0;
      for (let i = 0; i < seeds; i++) {
        const r = playEncounter(
          kit.id === 'bare'
            ? { seed: 1000 + i * 7919, encounter, chords: p.chords.map((c) => ({ ...c })) }
            : { seed: 1000 + i * 7919, encounter, ...kitConfig(kit, p.chords) },
          bot,
        );
        if (r.outcome === 'victory') wins++;
        share += r.share;
        calls += r.calls;
        answered += r.responses;
        n++;
      }
      rates.push(wins / seeds);
    }
    table[p.id] = rates;
    let runCell = '';
    if (runsN) {
      let wins = 0;
      for (let i = 0; i < runsN; i++)
        if (
          playRun(2000 + i * 104729, bot, p.chords, { movements: movement }).outcome === 'victory'
        )
          wins++;
      runCell = ` ${pct(wins / runsN)} |`;
    }
    const flags =
      bot === 'skilled'
        ? ENCOUNTERS.filter((e, i) => rates[i]! < floor(e)).map((e) => SHORT[e])
        : [];
    out(
      `| ${p.name}${flags.length ? ` ⚠ ${flags.join(', ')}` : ''} | ${rates.map(pct).join(' | ')} | ${pct(share / n)} | ${calls > 0 ? pct(answered / calls) : '—'} |${runCell}`,
    );
  }
  // Dominance: one loadout at least as good everywhere and better in total by 10 points.
  for (const a of presets) {
    const ra = table[a.id]!;
    const dominates = presets.every((b) => {
      if (b.id === a.id) return true;
      const rb = table[b.id]!;
      const total = ra.reduce((s, v, i) => s + v - rb[i]!, 0);
      return ra.every((v, i) => v >= rb[i]!) && total >= 0.1 * ENCOUNTERS.length;
    });
    if (dominates && presets.length > 1)
      out(`\n⚠ **${a.name}** dominates every other loadout for ${bot}.`);
  }
}
out();
out(`_Generated by \`tools/loadouts.ts\` in ${((Date.now() - t0) / 1000).toFixed(0)} s._`);
const md = arg('md');
if (md) writeFileSync(md, lines.join('\n') + '\n');
