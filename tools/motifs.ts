/**
 * Motif report (docs/phase-5g.md, "Bands"): what each motif does to a Movement's hard fights, for
 * the Novice and the Skilled bot, at its first and third level, against the same seeds with the
 * kit alone. `tools/relics.ts`' shape, for motifs.
 *
 *   npx tsx tools/motifs.ts --movement 2 --seeds 20            # every motif at L1 and L3
 *   npx tsx tools/motifs.ts --movement 3 --seeds 20 --fill     # only what the fill adds
 *   npx tsx tools/motifs.ts --movement 4 --seeds 20 --bots skilled --motifs razor_silk,whiplash
 *   npx tsx tools/motifs.ts --movement 2 --seeds 20 --levels 1,2,3 --encounters crimson_gate
 *   npx tsx tools/motifs.ts --movement 4 --runs 30 --fill      # also whole runs, drafted first
 *
 * Cells: the Movement's elites, mini-boss and boss (`relics.ts`' hard fights) on its kit
 * (tools/kits.ts: the arrival kit's motifs and relics, its Chords), the same seeds with and
 * without the motif. The motif is added at the asked level (a motif the kit already holds is set
 * to that level, and marked `kit`). A Harmony brings its prerequisite motifs at level 1; a
 * hero-gated motif plays with that hero in the third slot of the party (its own kit-alone row
 * is printed first, since the party differs), and a motif that needs an aura the kit's songs
 * lack is marked `aura`. The columns are the win rate on each fight (change from the kit), the
 * average change in wins and in downs, and the trigger system's counts: of the fights the
 * motif was held in, how many it fired in (the Bands want half), and fires a fight.
 *
 * `--runs N` (0 by default) adds whole Expeditions on the Movement's route (`playRun`,
 * `--run-seed-base` + i × 104729; Movement I measures them on the I-II route): N runs that draft the motif first (`draftPrefer`), against N
 * that don't, giving the pick rate (runs that ended holding it) in each, the win rate and the
 * change. Seeds: cells 5000 + i × 7919 (as `relics.ts`).
 */
import type { BotKind } from '../src/bots';
import { CONTENT, isFieldMovement, movementDef, type MotifDef } from '../src/content';
import { FILL_IDS } from '../src/content/fill';
import { playEncounter, knownIds, playRun, type EncounterRun } from './harness-core';
import { kitById, kitConfig, defaultKit, type Kit } from './kits';

/** A Movement's hard fights: its elites, its mini-boss and its boss (`relics.ts`). */
export function hardFights(n: number): string[] {
  const def = movementDef(n);
  // The Finale has no pools: its one hard fight is its boss.
  if (!isFieldMovement(def)) return [def.boss];
  return [...def.elites, def.miniboss, def.boss];
}

/** The levels a motif is measured at: those asked, none above its top level, once each. */
export function levelsFor(def: MotifDef, asked: readonly number[]): number[] {
  return [...new Set(asked.map((l) => Math.min(l, def.values.length)))].sort((a, b) => a - b);
}

/** The default party, with the motif's hero in the third slot when the party lacks him or her. */
export function partyFor(def: MotifDef): string[] {
  const party = [...CONTENT.defaultParty];
  const hero = def.requires.hero;
  if (hero && !party.includes(hero)) party[party.length - 1] = hero;
  return party;
}

/** The kit's motifs with `def` at `level` (and its prerequisites at 1), overriding the kit's own. */
export function motifsWith(
  kit: Kit,
  def: MotifDef,
  level: number,
): { id: string; level: number }[] {
  const out = kit.motifs.map((m) => ({ ...m }));
  const put = (id: string, l: number) => {
    const held = out.find((m) => m.id === id);
    if (held) held.level = l;
    else out.push({ id, level: l });
  };
  for (const id of def.requires.motifs ?? []) put(id, 1);
  put(def.id, level);
  return out;
}

interface Cell {
  win: number;
  downs: number;
  /** Fights the motif was held in with a trigger, fights it fired in, and its fires. */
  held: number;
  fired: number;
  fires: number;
}

const pct = (n: number) => `${Math.round(n * 100)}%`;
const signed = (n: number) => `${n > 0 ? '+' : ''}${Math.round(n * 100)}`;

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function main(): void {
  const t0 = Date.now();
  const seeds = Number(arg('seeds') ?? 20);
  const bots = (arg('bots') ?? 'novice,skilled').split(',') as BotKind[];
  const movement = Number(arg('movement') ?? 1);
  const kit = kitById(arg('kit') ?? defaultKit(movement));
  const encounters = (arg('encounters') ?? hardFights(movement).join(',')).split(',');
  const levels = (arg('levels') ?? '1,3').split(',').map(Number);
  const runsN = Number(arg('runs') ?? 0);
  const runBase = Number(arg('run-seed-base') ?? 2000);
  const chosen = arg('motifs');
  const ids = chosen ? knownIds('motif', chosen.split(',')) : null;
  const fillOnly = process.argv.includes('--fill');
  const motifs = CONTENT.motifs.filter(
    (m) => (!ids || ids.includes(m.id)) && (!fillOnly || FILL_IDS.includes(m.id)),
  );

  /** The cell's sim config for a party and the extra motifs (none: the kit alone). */
  const cell = (
    bot: BotKind,
    encounter: string,
    i: number,
    party: readonly string[],
    extra: { id: string; level: number }[] | null,
  ): EncounterRun =>
    playEncounter(
      {
        seed: 5000 + i * 7919,
        encounter,
        ...kitConfig(kit),
        ...(extra ? { motifs: extra } : {}),
        ...(party.join() !== CONTENT.defaultParty.join() ? { party: [...party] } : {}),
      },
      bot,
    );

  function measure(
    bot: BotKind,
    encounter: string,
    party: readonly string[],
    def: MotifDef | null,
    level: number,
  ): Cell {
    const extra = def ? motifsWith(kit, def, level) : null;
    const r: Cell = { win: 0, downs: 0, held: 0, fired: 0, fires: 0 };
    for (let i = 0; i < seeds; i++) {
      const run = cell(bot, encounter, i, party, extra);
      if (run.outcome === 'victory') r.win++;
      r.downs += run.downs;
      const fires = def ? run.triggers?.[def.id] : undefined;
      if (fires !== undefined) {
        r.held++;
        if (fires > 0) r.fired++;
        r.fires += fires;
      }
    }
    r.win /= seeds;
    r.downs /= seeds;
    return r;
  }

  const kitAuras = new Set(kitConfig(kit).chords?.flatMap((c) => c.auras));
  const label = (def: MotifDef, level: number): string => {
    const marks = [
      FILL_IDS.includes(def.id) ? 'new' : '',
      kit.motifs.some((m) => m.id === def.id) ? 'kit' : '',
      def.requires.aura && !kitAuras.has(def.requires.aura) ? 'aura' : '',
    ].filter(Boolean);
    return `${def.id} L${level} (${def.rarity}${marks.length ? `, ${marks.join(', ')}` : ''})`;
  };

  for (const bot of bots) {
    console.log(
      `\n${bot} · ${seeds} seeds · ${kit.name} · ${
        movement >= 2 ? `Movement ${movement}'s` : "Movement I's"
      } hard fights`,
    );
    const head = `| Motif | ${encounters.join(' | ')} | Avg Δ win | Δ downs | Fired in | Fires a fight |`;
    console.log(`${head}\n|---|${encounters.map(() => '---|').join('')}---|---|---|---|`);
    /** The kit alone, per party (the default party first). */
    const bases = new Map<string, Cell[]>();
    const baseFor = (party: readonly string[]): Cell[] => {
      const key = party.join();
      let b = bases.get(key);
      if (!b) {
        b = encounters.map((e) => measure(bot, e, party, null, 1));
        bases.set(key, b);
        const avg = (f: (c: Cell) => number) => b!.reduce((s, c) => s + f(c), 0) / b!.length;
        console.log(
          `| (kit alone${key === CONTENT.defaultParty.join() ? '' : `, ${key}`}) | ${b.map((c) => pct(c.win)).join(' | ')} | — | ${avg((c) => c.downs).toFixed(1)} | — | — |`,
        );
      }
      return b;
    };
    // The kit alone for each party a row will need, up front.
    baseFor(CONTENT.defaultParty);
    for (const def of motifs) baseFor(partyFor(def));
    /** Each row's average win change, to name the strongest existing motif of each rarity. */
    const best = new Map<string, { id: string; dWin: number }>();
    for (const def of motifs) {
      const party = partyFor(def);
      const base = baseFor(party);
      for (const level of levelsFor(def, levels)) {
        const cells = encounters.map((e) => measure(bot, e, party, def, level));
        const dWin = cells.reduce((s, c, i) => s + c.win - base[i]!.win, 0) / cells.length;
        const dDowns = cells.reduce((s, c, i) => s + c.downs - base[i]!.downs, 0) / cells.length;
        const held = cells.reduce((s, c) => s + c.held, 0);
        const fired = cells.reduce((s, c) => s + c.fired, 0);
        const fires = cells.reduce((s, c) => s + c.fires, 0);
        // The Bands want a trigger to fire in at least half the fights it is held in.
        const rate = held > 0 ? `${pct(fired / held)}${fired / held < 0.5 ? ' ⚠' : ''}` : '—';
        console.log(
          `| ${label(def, level)} | ${cells.map((c, i) => `${pct(c.win)} (${signed(c.win - base[i]!.win)})`).join(' | ')} | ${signed(dWin)} | ${dDowns > 0 ? '+' : ''}${dDowns.toFixed(1)} | ${rate} | ${held > 0 ? (fires / held).toFixed(1) : '—'} |`,
        );
        if (!FILL_IDS.includes(def.id)) {
          const key = `${def.rarity} L${level}`;
          if (dWin > (best.get(key)?.dWin ?? -Infinity)) best.set(key, { id: def.id, dWin });
        }
      }
    }
    if (best.size > 0)
      console.log(
        `\nStrongest existing motif of each rarity: ${[...best]
          .map(([key, b]) => `${key} ${b.id} (${signed(b.dWin)})`)
          .join(', ')}`,
      );
  }

  if (runsN > 0) {
    console.log(`\n## Whole runs (Movement ${movement}'s route) · ${runsN} runs, drafted first\n`);
    console.log(
      '| Bot | Motif | Held (drafted first) | Held (not asked) | Won | Won (not asked) | Δ win |',
    );
    console.log('|---|---|---|---|---|---|---|');
    const party = (def: MotifDef) => partyFor(def);
    for (const bot of bots) {
      /** Runs without any preference, by party. */
      const plain = new Map<string, { won: number; held: Map<string, number> }>();
      const playPlain = (p: readonly string[]) => {
        const key = p.join();
        let r = plain.get(key);
        if (!r) {
          r = { won: 0, held: new Map() };
          for (let i = 0; i < runsN; i++) {
            const run = playRun(runBase + i * 104729, bot, undefined, {
              movements: Math.max(2, movement),
              ...(key === CONTENT.defaultParty.join() ? {} : { party: [...p] }),
            });
            if (run.outcome === 'victory') r.won++;
            for (const m of run.motifs) {
              const id = m.split(':')[0]!;
              r.held.set(id, (r.held.get(id) ?? 0) + 1);
            }
          }
          plain.set(key, r);
        }
        return r;
      };
      for (const def of motifs) {
        const p = party(def);
        const base = playPlain(p);
        let won = 0;
        let held = 0;
        for (let i = 0; i < runsN; i++) {
          const run = playRun(runBase + i * 104729, bot, undefined, {
            movements: Math.max(2, movement),
            ...(p.join() === CONTENT.defaultParty.join() ? {} : { party: [...p] }),
            draftPrefer: [def.id, ...(def.requires.motifs ?? [])],
          });
          if (run.outcome === 'victory') won++;
          if (run.motifs.some((m) => m.startsWith(`${def.id}:`))) held++;
        }
        console.log(
          `| ${bot} | ${def.id} | ${pct(held / runsN)} | ${pct((base.held.get(def.id) ?? 0) / runsN)} | ${pct(won / runsN)} | ${pct(base.won / runsN)} | ${signed((won - base.won) / runsN)} |`,
        );
      }
    }
  }
  console.log(`\ndone in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
}

if (process.argv[1]?.endsWith('motifs.ts')) main();
