/**
 * The Decree gate (docs/phase-5a.md, "Bands"; docs/phase-5c.md, "Bands"): plays a boss on its
 * Movement's kit and reports, for each of its Decrees, how often a bot sees it per fight and how
 * often it answers it. One table per boss: Vharun (the default, on the arrival kit), the
 * Seamstress and the Unweaver (on ARRIVAL3_KIT).
 *
 *   npx tsx tools/decrees.ts --seeds 50
 *   npx tsx tools/decrees.ts --seeds 50 --bots idle,skilled
 *   npx tsx tools/decrees.ts --seeds 50 --seed-base 500003   # another seed set (a check)
 *   npx tsx tools/decrees.ts --boss the_unweaver --seeds 50
 *   npx tsx tools/decrees.ts --boss the_seamstress --seeds 50
 *
 * What counts as answered, one occurrence at a time.
 *
 * Vharun:
 * - **Twin Cleave**, **Crimson Tide**: a pair of blows (or sweeps) answered when no hero goes
 *   down to either of them (a down is charged to the telegraph that last hurt the hero).
 * - **Execution**: the sim's verdict is `spared` (lifted above the line, Warded, or out of it).
 * - **Bloodmoon**: each spell of it (from one announcement to the next, or the fight's end) is
 *   answered when no hero goes down in it, except to another Decree's own blow (a Twin Cleave,
 *   a Tide or an Execution, charged to that Decree). Its failure is the healing cut: a hero worn
 *   down by the Legion's ordinary blows. The share of hero time spent in a pool is shown too.
 *
 * The Unweaver:
 * - **Shear**: no hero goes down to it (charged as above).
 * - **Snip**: its `cutResolved` verdict is `held` or `strand`; a `none` (no Thread as it began)
 *   isn't counted.
 * - **Spindles**: every Spindle dead within 25 s of the summons.
 * - **Steal Verse**: the verse taken back by a kill (`verseReturned` 'killed').
 * - **Unravel**: its reversed Mend dealt each hero less than 5% of their max life.
 * - **Mirror Weave**: each Mirror Ward cast is interrupted, or the champion dies within 45 s.
 *
 * The Seamstress:
 * - **Stitch**: the link broken in its windup (no hero stitched by it), or every hero it
 *   stitched freed before the next Needle Rain begins.
 * - **Unpicking**: each Unpick with no hero down within 4 s of it landing, and, when it cut the
 *   Thread, re-threaded within 1.0 s of the lock's end.
 *
 * Idle never threads or casts (src/bots/index.ts), so the Thread's Decrees (Snip, Unravel and the
 * Unpick's re-thread) are N/A for it: accepted exceptions, as 5a's Twin Cleave was
 * (docs/phase-5c.md, "Accepted Idle exceptions").
 *
 * Seen counts the Decree callouts (the 'decree' events), as the player does. Seeds as the harness.
 */
import type { BotKind } from '../src/bots';
import { makeBot } from '../src/bots';
import { createSim, type Sim, type SimEvent } from '../src/sim';
import { ARRIVAL3_KIT, ARRIVAL_KIT, kitConfig, type Kit } from './kits';

const MAX_TICKS = 9 * 60 * 60;

/** A boss's Decree table: the encounter, its kit and its Decrees in the order printed. */
export interface BossTable {
  encounter: string;
  kit: Kit;
  decrees: readonly string[];
  /** Decrees N/A for the Idle bot (it never threads or casts). */
  idleNa: readonly string[];
}

export const BOSS_TABLES: Readonly<Record<string, BossTable>> = {
  vharun: {
    encounter: 'vharun',
    kit: ARRIVAL_KIT,
    decrees: ['Twin Cleave', 'Bloodmoon', 'Crimson Tide', 'Execution'],
    idleNa: [],
  },
  the_seamstress: {
    encounter: 'the_seamstress',
    kit: ARRIVAL3_KIT,
    decrees: ['Stitch', 'Unpicking'],
    idleNa: [],
  },
  the_unweaver: {
    encounter: 'the_unweaver',
    kit: ARRIVAL3_KIT,
    decrees: ['Shear', 'Snip', 'Spindles', 'Steal Verse', 'Unravel', 'Mirror Weave'],
    idleNa: ['Snip', 'Unravel'],
  },
};

/** How one fight went, Decree by Decree. */
export interface Fight {
  won: boolean;
  seen: Record<string, number>;
  answered: Record<string, number>;
  occurrences: Record<string, number>;
  /** Under the Bloodmoon: hero ticks standing, and inside a pool. */
  standing: number;
  sheltered: number;
}

function zero(decrees: readonly string[]): Record<string, number> {
  return Object.fromEntries(decrees.map((d) => [d, 0]));
}

function newFight(table: BossTable): Fight {
  return {
    won: false,
    seen: zero(table.decrees),
    answered: zero(table.decrees),
    occurrences: zero(table.decrees),
    standing: 0,
    sheltered: 0,
  };
}

/** Plays one fight with `bot`, each tick's events to `tick`; returns the sim at the end. */
function play(
  table: BossTable,
  seed: number,
  bot: BotKind,
  out: Fight,
  tick: (sim: Sim, events: readonly SimEvent[]) => void,
): Sim {
  const sim = createSim({ seed, encounter: table.encounter, ...kitConfig(table.kit) });
  const player = makeBot(bot, seed);
  for (let t = 0; t < MAX_TICKS; t++) {
    sim.step(player.decide(sim.state));
    const events = sim.drainEvents();
    for (const e of events)
      if (e.type === 'decree' && e.name in out.seen) out.seen[e.name] = out.seen[e.name]! + 1;
    tick(sim, events);
    const s = sim.state.encounter.status;
    if (s === 'victory' || s === 'defeat') {
      out.won = s === 'victory';
      break;
    }
  }
  return sim;
}

function count(out: Fight, decree: string, answered: boolean): void {
  out.occurrences[decree] = out.occurrences[decree]! + 1;
  if (answered) out.answered[decree] = out.answered[decree]! + 1;
}

// ── Vharun (docs/phase-5a.md) ────────────────────────────────────────────────────────

function vharunFight(table: BossTable, seed: number, bot: BotKind): Fight {
  const out = newFight(table);
  /** Telegraph id → its name; the pair (first blow's id) it belongs to. */
  const names = new Map<number, string>();
  const pairOf = new Map<number, number>();
  /** Open pairs by name: the first blow's id and how many blows have started. */
  const open = new Map<string, { id: number; blows: number }>();
  const failed = new Set<number>();
  const pairs: { id: number; name: string }[] = [];
  /** The telegraph that last hurt each hero. */
  const lastHurt = new Map<number, number | null>();
  // Bloodmoon spells: hero ticks standing and sheltered; whether a hero fell in it.
  let spell: { standing: number; sheltered: number; fell: boolean } | null = null;
  const closeSpell = () => {
    if (!spell) return;
    count(out, 'Bloodmoon', !spell.fell);
    out.standing += spell.standing;
    out.sheltered += spell.sheltered;
    spell = null;
  };
  play(table, seed, bot, out, (sim, events) => {
    const state = sim.state;
    for (const e of events) {
      switch (e.type) {
        case 'decree':
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
          if (e.execution !== undefined) count(out, 'Execution', e.execution === 'spared');
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
  });
  closeSpell();
  for (const p of pairs) count(out, p.name, !failed.has(p.id));
  return out;
}

// ── The Unweaver (docs/phase-5c.md) ──────────────────────────────────────────────────

/** Spindles answered: every Spindle dead within this many seconds of the summons. */
const SPINDLES_WITHIN = 25;
/** Unravel answered: its reversed Mend dealt each hero less than this share of their life. */
const UNRAVEL_HARM_UNDER = 0.05;
/** Mirror Weave answered: the Mirror Ward interrupted, or the champion dead within this long. */
const CHAMPION_WITHIN = 45;
const SPINDLE = 'spindle';
const CHAMPION = 'mirror_champion';

function alive(sim: Sim, defId: string): boolean {
  return sim.state.entities
    .list()
    .some((e) => e.enemy?.defId === defId && e.health !== undefined && !e.health.dead);
}

function unweaverFight(table: BossTable, seed: number, bot: BotKind): Fight {
  const out = newFight(table);
  const idle = bot === 'idle';
  const lastHurt = new Map<number, number | null>();
  const shears = new Set<number>();
  const failedShear = new Set<number>();
  /** Spindles summoned at (sim time), still to judge. */
  let spindles: number[] = [];
  /** The open Unravel window: each hero's harm from it. */
  let unravel: Map<number, number> | null = null;
  /** Mirror Ward casts still to judge: when each began, and whether it was interrupted. */
  let mirrors: { at: number; done: boolean }[] = [];
  const championFell: number[] = [];
  const closeUnravel = (sim: Sim) => {
    if (!unravel) return;
    let ok = true;
    for (const [id, harm] of unravel) {
      const max = sim.state.entities.get(id)?.health?.maxHp ?? 1;
      if (harm >= max * UNRAVEL_HARM_UNDER) ok = false;
    }
    if (!idle) count(out, 'Unravel', ok);
    unravel = null;
  };
  const sim = play(table, seed, bot, out, (sim, events) => {
    const state = sim.state;
    const now = state.time;
    for (const e of events) {
      switch (e.type) {
        case 'telegraphStarted':
          if (e.name === 'Shear') shears.add(e.telegraph);
          if (e.name === 'Spindles') spindles.push(e.impact);
          if (e.name === 'Mirror Ward') mirrors.push({ at: now, done: false });
          break;
        case 'castInterrupted':
          if (e.name === 'Mirror Ward') {
            const open = mirrors.find((m) => !m.done);
            if (open) {
              open.done = true;
              count(out, 'Mirror Weave', true);
            }
          }
          break;
        case 'enemyKilled':
          if (e.defId === CHAMPION) championFell.push(now);
          break;
        case 'cutResolved':
          if (e.cause === 'snip' && e.result !== 'none' && !idle)
            count(out, 'Snip', e.result === 'held' || e.result === 'strand');
          break;
        case 'verseReturned':
          count(out, 'Steal Verse', e.reason === 'killed');
          break;
        case 'unravelled':
          if (e.active) unravel = new Map();
          else closeUnravel(sim);
          break;
        case 'damageTaken':
          if (!state.party.includes(e.target)) break;
          lastHurt.set(e.target, e.telegraph);
          // Unravel's ticks: the reversed Mend, from its source, with no telegraph.
          if (
            unravel &&
            e.hit === 'tick' &&
            e.telegraph === null &&
            e.source === state.field.unravel?.source
          )
            unravel.set(e.target, (unravel.get(e.target) ?? 0) + e.amount + e.absorbed);
          break;
        case 'allyDowned': {
          const by = lastHurt.get(e.hero);
          if (by != null && shears.has(by)) failedShear.add(by);
          break;
        }
        default:
          break;
      }
    }
    // Spindles: judged SPINDLES_WITHIN s on (or as soon as none stands).
    spindles = spindles.filter((at) => {
      if (now < at) return true;
      const up = alive(sim, SPINDLE);
      if (up && now < at + SPINDLES_WITHIN) return true;
      count(out, 'Spindles', !up);
      return false;
    });
    // Mirror Ward casts not interrupted: answered if the champion fell within its window.
    mirrors = mirrors.filter((m) => {
      if (m.done) return false;
      if (championFell.some((t) => t >= m.at && t <= m.at + CHAMPION_WITHIN)) {
        count(out, 'Mirror Weave', true);
        return false;
      }
      if (now <= m.at + CHAMPION_WITHIN) return true;
      count(out, 'Mirror Weave', false);
      return false;
    });
  });
  // The fight's end: whatever is still open is judged as it stands (a win kills every add).
  closeUnravel(sim);
  for (const _ of spindles) count(out, 'Spindles', out.won || !alive(sim, SPINDLE));
  for (const m of mirrors) if (!m.done) count(out, 'Mirror Weave', out.won);
  for (const id of shears) count(out, 'Shear', !failedShear.has(id));
  return out;
}

// ── The Seamstress (docs/phase-5c.md) ────────────────────────────────────────────────

/** Unpicking answered: no down within this long of it landing, and re-threaded this soon. */
const UNPICK_DOWNS_WITHIN = 4;
const UNPICK_RETHREAD_WITHIN = 1;

function seamstressFight(table: BossTable, seed: number, bot: BotKind): Fight {
  const out = newFight(table);
  const idle = bot === 'idle';
  /** Each Stitch: its telegraph, its windup's end, the heroes it stitched, and whether it failed. */
  const stitches: { id: number; impact: number; heroes: Set<number>; failed: boolean }[] = [];
  /** Each Unpick still to judge: when it landed, its lock's end (null: no cut), its verdicts. */
  let unpicks: { at: number; lockEnd: number | null; rethreaded: boolean; downed: boolean }[] = [];
  const judge = (u: (typeof unpicks)[number]) =>
    count(out, 'Unpicking', !u.downed && (idle || u.lockEnd === null || u.rethreaded));
  play(table, seed, bot, out, (sim, events) => {
    const state = sim.state;
    const now = state.time;
    for (const e of events) {
      switch (e.type) {
        case 'telegraphStarted':
          if (e.name === 'Stitch')
            stitches.push({ id: e.telegraph, impact: e.impact, heroes: new Set(), failed: false });
          if (e.name === 'Needle Rain')
            // A needle begins while a hero this Stitch rooted is still rooted: it failed.
            for (const s of stitches)
              if (s.heroes.size > 0) {
                const rooted = [...s.heroes].some((id) =>
                  state.entities.get(id)?.health?.statuses.some((x) => x.id === 'stitched'),
                );
                if (rooted) s.failed = true;
              }
          break;
        case 'statusApplied':
          if (e.status === 'stitched') {
            const s = [...stitches].reverse().find((x) => now <= x.impact + 0.2);
            s?.heroes.add(e.target);
          }
          break;
        case 'cutResolved':
          if (e.cause === 'unpick')
            unpicks.push({ at: now, lockEnd: null, rethreaded: false, downed: false });
          break;
        case 'threadSnapped':
          if (e.cause === 'unpick' && unpicks.length > 0)
            unpicks[unpicks.length - 1]!.lockEnd = now + (e.lock ?? 0);
          break;
        case 'threadAttached':
          for (const u of unpicks)
            if (u.lockEnd !== null && !u.rethreaded && now <= u.lockEnd + UNPICK_RETHREAD_WITHIN)
              u.rethreaded = true;
          break;
        case 'allyDowned':
          for (const u of unpicks) if (now <= u.at + UNPICK_DOWNS_WITHIN) u.downed = true;
          break;
        default:
          break;
      }
    }
    unpicks = unpicks.filter((u) => {
      const until = Math.max(
        u.at + UNPICK_DOWNS_WITHIN,
        u.lockEnd === null ? 0 : u.lockEnd + UNPICK_RETHREAD_WITHIN,
      );
      if (now <= until) return true;
      judge(u);
      return false;
    });
  });
  for (const u of unpicks) judge(u);
  for (const s of stitches) count(out, 'Stitch', !s.failed);
  return out;
}

const FIGHTS: Readonly<Record<string, (table: BossTable, seed: number, bot: BotKind) => Fight>> = {
  vharun: vharunFight,
  the_seamstress: seamstressFight,
  the_unweaver: unweaverFight,
};

/** Plays one fight against `boss`'s table (vharun, the_seamstress or the_unweaver). */
export function decreeFight(boss: string, seed: number, bot: BotKind): Fight {
  const table = BOSS_TABLES[boss];
  const fight = FIGHTS[boss];
  if (!table || !fight) throw new Error(`No Decree table for "${boss}" (${Object.keys(FIGHTS)})`);
  return fight(table, seed, bot);
}

function main(): void {
  const argv = process.argv.slice(2);
  const get = (name: string) => {
    const i = argv.indexOf(`--${name}`);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const seeds = Number(get('seeds') ?? 20);
  const seedBase = Number(get('seed-base') ?? 1000);
  const bots = (get('bots') ?? 'idle,novice,skilled').split(',') as BotKind[];
  // `--encounter` is the old name of `--boss`.
  const boss = get('boss') ?? get('encounter') ?? 'vharun';
  const table = BOSS_TABLES[boss];
  if (!table) throw new Error(`No Decree table for "${boss}" (${Object.keys(BOSS_TABLES)})`);
  console.log(`decree gate · ${table.encounter} · ${seeds} seeds · ${table.kit.name}`);
  console.log(
    'bot      won   decree         seen/fight (min)  answered          fights seeing it ≥2',
  );
  for (const bot of bots) {
    const fights = Array.from({ length: seeds }, (_, i) =>
      decreeFight(boss, seedBase + i * 7919, bot),
    );
    const won = fights.filter((f) => f.won).length / fights.length;
    for (const d of table.decrees) {
      const seen = fights.map((f) => f.seen[d] ?? 0);
      const answered = fights.reduce((s, f) => s + (f.answered[d] ?? 0), 0);
      const occurrences = fights.reduce((s, f) => s + (f.occurrences[d] ?? 0), 0);
      const mean = seen.reduce((a, b) => a + b, 0) / fights.length;
      const twice = seen.filter((n) => n >= 2).length;
      const na = bot === 'idle' && table.idleNa.includes(d);
      const rate = na
        ? 'N/A'
        : occurrences
          ? `${Math.round((100 * answered) / occurrences)}%`
          : '-';
      console.log(
        [
          bot.padEnd(8),
          `${Math.round(won * 100)}%`.padStart(4),
          ` ${d.padEnd(14)}`,
          `${mean.toFixed(1)} (${Math.min(...seen)})`.padStart(17),
          `  ${rate.padStart(4)} of ${String(occurrences).padEnd(5)}`,
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

if (process.argv[1]?.endsWith('decrees.ts')) main();
