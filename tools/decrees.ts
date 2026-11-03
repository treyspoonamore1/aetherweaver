/**
 * The Decree gate (docs/phase-5a.md, "Bands"): plays Vharun on the arrival kit and reports, for
 * each of his Decrees, how often a bot sees it per fight and how often it answers it.
 *
 *   npx tsx tools/decrees.ts --seeds 50
 *   npx tsx tools/decrees.ts --seeds 50 --bots idle,skilled
 *   npx tsx tools/decrees.ts --seeds 50 --seed-base 500003   # another seed set (a check)
 *
 * What counts as answered, one occurrence at a time:
 * - **Twin Cleave**, **Crimson Tide**: a pair of blows (or sweeps) answered when no hero goes
 *   down to either of them (a down is charged to the telegraph that last hurt the hero).
 * - **Execution**: the sim's verdict is `spared` (lifted above the line, Warded, or out of it).
 * - **Bloodmoon**: each spell of it (from one announcement to the next, or the fight's end) is
 *   answered when no hero goes down in it, except to another Decree's own blow (a Twin Cleave,
 *   a Tide or an Execution, charged to that Decree). Its failure is the healing cut: a hero worn
 *   down by the Legion's ordinary blows. The share of hero time spent in a pool is shown too.
 *
 * Seen counts the Decree callouts (the 'decree' events), as the player does. Seeds as the harness.
 */
import type { BotKind } from '../src/bots';
import { makeBot } from '../src/bots';
import { createSim, type SimEvent } from '../src/sim';
import { ARRIVAL_KIT, kitConfig } from './kits';

const argv = process.argv.slice(2);
const get = (name: string) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
};
const SEEDS = Number(get('seeds') ?? 20);
const SEED_BASE = Number(get('seed-base') ?? 1000);
const BOTS = (get('bots') ?? 'idle,novice,skilled').split(',') as BotKind[];
const ENCOUNTER = get('encounter') ?? 'vharun';
const MAX_TICKS = 9 * 60 * 60;

const DECREES = ['Twin Cleave', 'Bloodmoon', 'Crimson Tide', 'Execution'] as const;
type Decree = (typeof DECREES)[number];

interface Tally {
  seen: number[];
  answered: number;
  occurrences: number;
}

interface Fight {
  won: boolean;
  seen: Record<Decree, number>;
  answered: Record<Decree, number>;
  occurrences: Record<Decree, number>;
  /** Under the Bloodmoon: hero ticks standing, and inside a pool. */
  standing: number;
  sheltered: number;
}

function zero(): Record<Decree, number> {
  return { 'Twin Cleave': 0, Bloodmoon: 0, 'Crimson Tide': 0, Execution: 0 };
}

function fight(seed: number, bot: BotKind): Fight {
  const sim = createSim({ seed, encounter: ENCOUNTER, ...kitConfig(ARRIVAL_KIT) });
  const player = makeBot(bot, seed);
  const out: Fight = {
    won: false,
    seen: zero(),
    answered: zero(),
    occurrences: zero(),
    standing: 0,
    sheltered: 0,
  };
  /** Telegraph id → its name; the pair (first blow's id) it belongs to. */
  const names = new Map<number, string>();
  const pairOf = new Map<number, number>();
  /** Open pairs by name: the first blow's id and how many blows have started. */
  const open = new Map<string, { id: number; blows: number }>();
  const failed = new Set<number>();
  const pairs: { id: number; name: Decree }[] = [];
  /** The telegraph that last hurt each hero. */
  const lastHurt = new Map<number, number | null>();
  // Bloodmoon spells: hero ticks standing and sheltered; whether a hero fell in it.
  let spell: { standing: number; sheltered: number; fell: boolean } | null = null;
  const closeSpell = () => {
    if (!spell) return;
    out.occurrences.Bloodmoon++;
    if (!spell.fell) out.answered.Bloodmoon++;
    out.standing += spell.standing;
    out.sheltered += spell.sheltered;
    spell = null;
  };
  for (let t = 0; t < MAX_TICKS; t++) {
    sim.step(player.decide(sim.state));
    const events: readonly SimEvent[] = sim.drainEvents();
    const state = sim.state;
    for (const e of events) {
      switch (e.type) {
        case 'decree':
          if ((DECREES as readonly string[]).includes(e.name)) out.seen[e.name as Decree]++;
          if (e.name === 'Bloodmoon') {
            closeSpell();
            spell = { standing: 0, sheltered: 0, fell: false };
          }
          break;
        case 'telegraphStarted': {
          names.set(e.telegraph, e.name);
          if (e.name !== 'Twin Cleave' && e.name !== 'Crimson Tide') break;
          const pair = open.get(e.name);
          if (pair && pair.blows === 1) {
            pair.blows = 2;
            pairOf.set(e.telegraph, pair.id);
            open.delete(e.name);
          } else {
            open.set(e.name, { id: e.telegraph, blows: 1 });
            pairOf.set(e.telegraph, e.telegraph);
            pairs.push({ id: e.telegraph, name: e.name });
          }
          break;
        }
        case 'telegraphResolved':
          if (e.execution !== undefined) {
            out.occurrences.Execution++;
            if (e.execution === 'spared') out.answered.Execution++;
          }
          break;
        case 'damageTaken':
          if (state.party.includes(e.target)) lastHurt.set(e.target, e.telegraph);
          break;
        case 'allyDowned': {
          const by = lastHurt.get(e.hero);
          const pair = by == null ? undefined : pairOf.get(by);
          if (pair !== undefined) failed.add(pair);
          else if (spell && (by == null || names.get(by) !== 'Execution')) spell.fell = true;
          break;
        }
        default:
          break;
      }
    }
    const pools = state.field.sanctuary?.pools;
    if (spell && pools)
      for (const id of state.party) {
        const h = state.entities.get(id);
        if (!h?.health || h.health.downed || h.health.dead) continue;
        spell.standing++;
        if (pools.some((p) => Math.hypot(h.x - p.x, h.z - p.z) <= p.r)) spell.sheltered++;
      }
    const s = state.encounter.status;
    if (s === 'victory' || s === 'defeat') {
      out.won = s === 'victory';
      break;
    }
  }
  closeSpell();
  for (const p of pairs) {
    out.occurrences[p.name]++;
    if (!failed.has(p.id)) out.answered[p.name]++;
  }
  return out;
}

function main(): void {
  console.log(`decree gate · ${ENCOUNTER} · ${SEEDS} seeds · ${ARRIVAL_KIT.name}`);
  console.log(
    'bot      won   decree         seen/fight (min)  answered          fights seeing it ≥2',
  );
  for (const bot of BOTS) {
    const fights = Array.from({ length: SEEDS }, (_, i) => fight(SEED_BASE + i * 7919, bot));
    const won = fights.filter((f) => f.won).length / fights.length;
    for (const d of DECREES) {
      const tally: Tally = { seen: [], answered: 0, occurrences: 0 };
      for (const f of fights) {
        tally.seen.push(f.seen[d]);
        tally.answered += f.answered[d];
        tally.occurrences += f.occurrences[d];
      }
      const mean = tally.seen.reduce((a, b) => a + b, 0) / fights.length;
      const twice = tally.seen.filter((n) => n >= 2).length;
      const rate = tally.occurrences
        ? `${Math.round((100 * tally.answered) / tally.occurrences)}%`
        : '-';
      console.log(
        [
          bot.padEnd(8),
          `${Math.round(won * 100)}%`.padStart(4),
          ` ${d.padEnd(14)}`,
          `${mean.toFixed(1)} (${Math.min(...tally.seen)})`.padStart(17),
          `  ${rate.padStart(4)} of ${String(tally.occurrences).padEnd(5)}`,
          `       ${twice}/${fights.length}`,
        ].join(' '),
      );
    }
    const standing = fights.reduce((s, f) => s + f.standing, 0);
    if (standing > 0)
      console.log(
        `${bot.padEnd(8)}       under the Bloodmoon, in a pool ${Math.round((100 * fights.reduce((s, f) => s + f.sheltered, 0)) / standing)}% of hero time`,
      );
  }
}

main();
