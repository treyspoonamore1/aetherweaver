/**
 * Relic report (docs/phase-3b.md): what each relic does to the hard fights, for the Novice and
 * the Skilled bot, against the same seeds with no relic at all.
 *
 *   npx tsx tools/relics.ts --seeds 20
 *   npx tsx tools/relics.ts --seeds 20 --bots novice --encounters bellwarden,hollow_cantor
 *   npx tsx tools/relics.ts --movement 2 --seeds 20   # Movement II's hard fights, arrival kit
 *   npx tsx tools/relics.ts --movement 3 --seeds 20   # Movement III's, ARRIVAL3_KIT's motifs
 *
 * Movement II (docs/phase-5a.md) plays its elites, the Matriarch and Vharun with the arrival
 * kit's motifs (tools/kits.ts) but none of its relics, so each row is that relic alone; Movement
 * III (docs/phase-5c.md) its elite, the Seamstress and the Unweaver with ARRIVAL3_KIT's motifs.
 */
import type { BotKind } from '../src/bots';
import { CONTENT, movementDef } from '../src/content';
import { DEFAULT_CHORDS } from '../src/meta/run';
import { playEncounter } from './harness-core';
import { kitFor } from './kits';

const argv = process.argv.slice(2);
const get = (name: string) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
};
const seeds = Number(get('seeds') ?? 20);
const bots = (get('bots') ?? 'novice,skilled').split(',') as BotKind[];
const movement = Number(get('movement') ?? 1);
/** A Movement's hard fights: its elites, its mini-boss and its boss. */
function hardFights(n: number): string[] {
  const def = movementDef(n);
  return [...def.elites, def.miniboss, def.boss];
}
const encounters = (get('encounters') ?? hardFights(movement).join(',')).split(',');
/** A later Movement's party arrives with motifs (its kit's); Movement I's cells are bare. */
const motifs = movement >= 2 ? { motifs: kitFor(movement).motifs.map((m) => ({ ...m })) } : {};
const relics = CONTENT.relics.filter((r) => !r.runOnly).map((r) => r.id);

interface Cell {
  win: number;
  downs: number;
  share: number;
}

function measure(bot: BotKind, encounter: string, relic: string | null): Cell {
  let win = 0;
  let downs = 0;
  let share = 0;
  for (let i = 0; i < seeds; i++) {
    const r = playEncounter(
      {
        seed: 5000 + i * 7919,
        encounter,
        chords: DEFAULT_CHORDS.map((c) => ({ auras: [...c.auras], ornaments: [...c.ornaments] })),
        relics: relic ? [relic] : [],
        ...motifs,
      },
      bot,
    );
    if (r.outcome === 'victory') win++;
    downs += r.downs;
    share += r.share;
  }
  return { win: win / seeds, downs: downs / seeds, share: share / seeds };
}

const pct = (n: number) => `${Math.round(n * 100)}%`;
const signed = (n: number) => `${n > 0 ? '+' : ''}${Math.round(n * 100)}`;

const t0 = Date.now();
for (const bot of bots) {
  console.log(`\n${bot} · ${seeds} seeds · Steady loadout`);
  const base = encounters.map((e) => measure(bot, e, null));
  console.log(
    `| Relic | ${encounters.join(' | ')} | Avg Δ win | Δ downs |\n|---|${encounters.map(() => '---|').join('')}---|---|`,
  );
  console.log(
    `| (none) | ${base.map((c) => pct(c.win)).join(' | ')} | — | ${(base.reduce((s, c) => s + c.downs, 0) / base.length).toFixed(1)} |`,
  );
  for (const relic of relics) {
    const cells = encounters.map((e) => measure(bot, e, relic));
    const dWin = cells.reduce((s, c, i) => s + c.win - base[i]!.win, 0) / cells.length;
    const dDowns = cells.reduce((s, c, i) => s + c.downs - base[i]!.downs, 0) / cells.length;
    console.log(
      `| ${relic} | ${cells.map((c, i) => `${pct(c.win)} (${signed(c.win - base[i]!.win)})`).join(' | ')} | ${signed(dWin)} | ${dDowns > 0 ? '+' : ''}${dDowns.toFixed(1)} |`,
    );
  }
}
console.log(`\ndone in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
