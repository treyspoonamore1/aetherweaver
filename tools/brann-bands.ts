/**
 * Brann's bands (docs/phase-5b.md, "Bands"): every cell of the table for parties A, B and C beside
 * the default party, in one run of the tool, with the numbers the harness's own tally leaves out.
 *
 *   npx tsx tools/brann-bands.ts --movement 1 --seeds 50                 Movement I's cells
 *   npx tsx tools/brann-bands.ts --movement 2 --seeds 50 --seed-base 500003
 *   npx tsx tools/brann-bands.ts --movement 2 --parties B --bots skilled --encounters vharun
 *   npx tsx tools/brann-bands.ts --runs --movements 2 --seeds 200        whole Expeditions
 *   npx tsx tools/brann-bands.ts --runs --movements 1 --seeds 200        whole Preludes
 *   npx tsx tools/brann-bands.ts --movement 3 --seeds 50                 Movement III's cells
 *   npx tsx tools/brann-bands.ts --runs --movements 3 --seeds 200        I-III Expeditions
 *   npx tsx tools/brann-bands.ts --movement 4 --seeds 50                 the Silent Conductor
 *   npx tsx tools/brann-bands.ts --runs --movements 4 --seeds 200        the Finale route
 *
 * Cells play as tools/harness.ts plays them (Movement I bare, Movement II the arrival kit,
 * Movement III ARRIVAL3_KIT, the Finale ARRIVAL4_KIT; fights at seed base + i × 7919, runs at
 * base + i × 104729). Beside
 * the harness's BrannTally each fight also records:
 *
 * - who the boss targets, as a share of the fight's time, by hero;
 * - Executions on Brann and their verdicts (spared or executed), and Twin Cleave's first blows on
 *   him and the ones of those that downed him (either blow);
 * - Movement III (docs/phase-5c.md): the Thread cut while on Brann, Unravel's harm to him, and
 *   whom the Unweaver's Hollow Champion targets;
 * - the Finale (docs/phase-5d.md): the life Fortissimo Silence took from Brann, his seconds
 *   stilled in the Grand Silence, and the Solos aimed at him and those that landed (cost him
 *   life);
 * - the Weaver's Mend time on each hero (the Thread on them in Mend mode), and the Weaver's
 *   healing, shields and Wards on each, for the inversion check.
 *
 * Runs record each hero's Bond XP a fight (the catch-up is a profile rule, so the harness's runs
 * are without it) and Blood and Silk's offers. `--json` writes every row.
 */
import { writeFileSync } from 'node:fs';
import type { BotKind } from '../src/bots';
import { FORTISSIMO, SOLOS } from '../src/content/crucibleIds';
import { isWeaverVia, type EntityId, type Sim, type SimEvent } from '../src/sim';
import { NAMED_PARTIES, parseArgs } from './harness';
import {
  movementEncounters,
  movementName,
  playEncounter,
  playRun,
  type EncounterRun,
} from './harness-core';
import { kitConfig } from './kits';

const argv = process.argv.slice(2);
const get = (name: string) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
};

/** One fight's extra numbers, by hero id. */
export interface Extra {
  /** Seconds the boss spent targeting each hero (absent without a boss). */
  bossTarget: Record<string, number>;
  bossTime: number;
  execOnBrann: number;
  execSpared: number;
  twinFirstOnBrann: number;
  twinDownedBrann: number;
  mendTime: Record<string, number>;
  weaverHeal: Record<string, number>;
  weaverShield: Record<string, number>;
  weaverWard: Record<string, number>;
  // ── Movement III (docs/phase-5c.md): 0 or empty before it. ──
  /** Enemy cuts of the Thread while it was on Brann (the Shears, Severing, the Snip, Unpick). */
  cutsOnBrann: number;
  /** Damage Unravel's reversed Mend dealt Brann. */
  unravelOnBrann: number;
  /** Seconds the Hollow Champion spent targeting each hero, of `championTime`. */
  championTarget: Record<string, number>;
  championTime: number;
  // ── The Finale (docs/phase-5d.md): 0 before it. ──
  /** Life Fortissimo Silence's pulses took from Brann. */
  fortissimoOnBrann: number;
  /** Seconds Brann stood stilled in the Grand Silence. */
  stilledBrann: number;
  /** The mirror-choir's Solos aimed at Brann, and those that landed on him (cost him life). */
  solosAtBrann: number;
  solosOnBrann: number;
}

/** The Unweaver's champion (Mirror Weave). */
const CHAMPION = 'mirror_champion';

const TWIN = 'vharun_twin_cleave';
const TWIN_SECOND = 'vharun_twin_cleave_second';
const EXECUTION = 'vharun_execution';
/** The Finale's: Fortissimo Silence's pulses, and the voices' Solos. */
const PULSES: ReadonlySet<string> = new Set(FORTISSIMO);
const SOLO_IDS: ReadonlySet<string> = new Set(Object.values(SOLOS));

/** Reads a fight's extra numbers off its events and state (`playEncounter`'s `watch`). */
export class ExtraWatch {
  readonly x: Extra = {
    bossTarget: {},
    bossTime: 0,
    execOnBrann: 0,
    execSpared: 0,
    twinFirstOnBrann: 0,
    twinDownedBrann: 0,
    mendTime: {},
    weaverHeal: {},
    weaverShield: {},
    weaverWard: {},
    cutsOnBrann: 0,
    unravelOnBrann: 0,
    championTarget: {},
    championTime: 0,
    fortissimoOnBrann: 0,
    stilledBrann: 0,
    solosAtBrann: 0,
    solosOnBrann: 0,
  };
  private readonly attackOf = new Map<number, string>();
  private lastTime = -1;
  private wasDowned = false;
  /** The Hollow Champion standing now (Movement III), learnt as it spawns. */
  private champion: EntityId | null = null;

  private hero(sim: Sim, id: EntityId | null): string | null {
    if (id === null) return null;
    return sim.state.entities.get(id)?.hero?.defId ?? null;
  }

  watch = (sim: Sim, events: readonly SimEvent[]): void => {
    const state = sim.state;
    const x = this.x;
    const add = (r: Record<string, number>, k: string | null, v: number) => {
      if (k !== null) r[k] = (r[k] ?? 0) + v;
    };
    let twinOnBrann = false;
    const brannId = state.party.find((id) => this.hero(sim, id) === 'brann');
    const brann = brannId === undefined ? undefined : state.entities.get(brannId);
    for (const e of events) {
      switch (e.type) {
        case 'telegraphStarted': {
          const t = state.telegraphs.find((tt) => tt.id === e.telegraph);
          if (t) this.attackOf.set(t.id, t.attackId);
          if (t && SOLO_IDS.has(t.attackId) && this.hero(sim, e.target) === 'brann')
            x.solosAtBrann++;
          break;
        }
        case 'telegraphResolved': {
          const attack = this.attackOf.get(e.telegraph);
          if (this.hero(sim, e.target) !== 'brann') break;
          if (attack !== undefined && SOLO_IDS.has(attack) && e.outcome === 'hit' && e.damage > 0)
            x.solosOnBrann++;
          if (attack === EXECUTION && e.execution !== 'fallen') {
            x.execOnBrann++;
            if (e.execution === 'spared') x.execSpared++;
          }
          if (attack === TWIN) x.twinFirstOnBrann++;
          if (attack === TWIN || attack === TWIN_SECOND) twinOnBrann = true;
          break;
        }
        case 'healApplied':
          if (isWeaverVia(e.via)) add(x.weaverHeal, this.hero(sim, e.target), e.amount);
          break;
        case 'shieldApplied':
          if (!e.fromWeaver) break;
          add(x.weaverShield, this.hero(sim, e.target), e.amount);
          if (e.shield === 'ward') add(x.weaverWard, this.hero(sim, e.target), e.amount);
          break;
        case 'threadSnapped':
          if (e.cause !== undefined && this.hero(sim, e.target) === 'brann') x.cutsOnBrann++;
          break;
        case 'damageTaken':
          if (
            e.telegraph !== null &&
            PULSES.has(this.attackOf.get(e.telegraph) ?? '') &&
            this.hero(sim, e.target) === 'brann'
          )
            x.fortissimoOnBrann += e.amount;
          // Unravel's ticks: the reversed Mend, from its source, with no telegraph.
          if (
            state.field.unravel &&
            e.hit === 'tick' &&
            e.telegraph === null &&
            e.source === state.field.unravel.source &&
            this.hero(sim, e.target) === 'brann'
          )
            x.unravelOnBrann += e.amount + e.absorbed;
          break;
        case 'entitySpawned':
          if (state.entities.get(e.id)?.enemy?.defId === CHAMPION) this.champion = e.id;
          break;
        default:
          break;
      }
    }
    // His down lands in the same tick as the blow (its allyDowned comes before the resolution).
    const downed = !!brann?.health?.downed;
    if (twinOnBrann && downed && !this.wasDowned) x.twinDownedBrann++;
    this.wasDowned = downed;
    const dt = this.lastTime < 0 ? 0 : state.time - this.lastTime;
    this.lastTime = state.time;
    if (dt <= 0) return;
    // (A staged state may carry no statuses.)
    if (brann?.health?.statuses?.some((st) => st.id === 'stilled')) x.stilledBrann += dt;
    const w = state.entities.get(state.weaverId)?.weaver;
    if (w && w.threadSlot !== null && w.threadMode === 'mend')
      add(x.mendTime, this.hero(sim, state.party[w.threadSlot] ?? null), dt);
    const bossId = state.encounter.bossId;
    const boss = bossId === null ? undefined : state.entities.get(bossId);
    if (boss?.enemy && !boss.health?.dead) {
      x.bossTime += dt;
      add(x.bossTarget, this.hero(sim, boss.enemy.targetId), dt);
    }
    const champ = this.champion === null ? undefined : state.entities.get(this.champion);
    if (champ?.enemy && champ.health && !champ.health.dead) {
      x.championTime += dt;
      add(x.championTarget, this.hero(sim, champ.enemy.targetId), dt);
    } else this.champion = null;
  };
}

export interface Cell {
  party: string;
  encounter: string;
  bot: BotKind;
  runs: (EncounterRun & { extra: Extra })[];
}

function mean(xs: readonly number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}
const pct = (n: number) => `${Math.round(n * 100)}%`;

/** The parties asked for: `default` (no party key) and A, B, C. */
function parties(): [string, string[] | null][] {
  return (get('parties') ?? 'default,A,B,C')
    .split(',')
    .map((p) => [p, p === 'default' ? null : [...NAMED_PARTIES[p.toUpperCase()]!]]);
}

function sumBy(rs: readonly Cell['runs'][number][], f: (x: Extra) => Record<string, number>) {
  const out: Record<string, number> = {};
  for (const r of rs) for (const [k, v] of Object.entries(f(r.extra))) out[k] = (out[k] ?? 0) + v;
  return out;
}

/** A cell's summary line: the harness's numbers, Brann's tally and the extras. */
export function cellLine(c: Cell): string {
  const rs = c.runs;
  const win = rs.filter((r) => r.outcome === 'victory').length / rs.length;
  const parts = [
    `${c.party.padEnd(7)} ${c.encounter.padEnd(19)} ${c.bot.padEnd(7)} win ${pct(win).padStart(4)} share ${pct(mean(rs.map((r) => r.share))).padStart(4)} ${mean(
      rs.map((r) => r.duration),
    )
      .toFixed(0)
      .padStart(4)} s downs ${mean(rs.map((r) => r.downs)).toFixed(2)}`,
  ];
  const b = rs.map((r) => r.brann).filter((t): t is NonNullable<typeof t> => !!t);
  if (b.length > 0) {
    parts.push(
      `brann <40% ${pct(mean(b.map((t) => t.lowShare40)))} <30% ${pct(mean(b.map((t) => t.lowShare30)))} dealt<=60% ${pct(mean(b.map((t) => t.dealtLow60)))} rage +${pct(mean(b.map((t) => t.rageBonus)))} downs ${mean(b.map((t) => t.downs)).toFixed(2)} steal ${pct(mean(b.map((t) => t.lifestealShare)))} refused ${mean(b.map((t) => t.refusedRallies)).toFixed(1)}/${mean(b.map((t) => t.rallies)).toFixed(1)}`,
    );
    const exec = rs.reduce((s, r) => s + r.extra.execOnBrann, 0);
    const spared = rs.reduce((s, r) => s + r.extra.execSpared, 0);
    const twin = rs.reduce((s, r) => s + r.extra.twinFirstOnBrann, 0);
    const twinDown = rs.reduce((s, r) => s + r.extra.twinDownedBrann, 0);
    if (exec > 0) parts.push(`exec spared ${spared}/${exec} ${pct(spared / exec)}`);
    if (twin > 0)
      parts.push(`twin survived ${twin - twinDown}/${twin} ${pct(1 - twinDown / twin)}`);
    // Movement III: the Thread cut while on him, and Unravel's harm to him, a fight.
    const cuts = rs.reduce((s, r) => s + r.extra.cutsOnBrann, 0);
    const unravel = rs.reduce((s, r) => s + r.extra.unravelOnBrann, 0);
    if (cuts > 0) parts.push(`cut on Brann ${(cuts / rs.length).toFixed(1)}`);
    if (unravel > 0) parts.push(`Unravel on Brann ${Math.round(unravel / rs.length)}`);
    // The Finale, a fight: Fortissimo Silence's toll on him, his stilled seconds, Solos on him.
    const loud = rs.reduce((s, r) => s + r.extra.fortissimoOnBrann, 0);
    const still = rs.reduce((s, r) => s + r.extra.stilledBrann, 0);
    const at = rs.reduce((s, r) => s + r.extra.solosAtBrann, 0);
    const on = rs.reduce((s, r) => s + r.extra.solosOnBrann, 0);
    if (loud > 0) parts.push(`Fortissimo on Brann ${Math.round(loud / rs.length)}`);
    if (still > 0) parts.push(`stilled ${(still / rs.length).toFixed(1)} s`);
    if (at > 0)
      parts.push(
        `Solos at Brann ${(at / rs.length).toFixed(1)}, landed ${(on / rs.length).toFixed(1)}`,
      );
  }
  const championTime = rs.reduce((s, r) => s + r.extra.championTime, 0);
  if (championTime > 0) {
    const t = sumBy(rs, (x) => x.championTarget);
    parts.push(
      `champion on ${Object.entries(t)
        .sort((a, z) => z[1] - a[1])
        .map(([k, v]) => `${k} ${pct(v / championTime)}`)
        .join(' ')}`,
    );
  }
  const bossTime = rs.reduce((s, r) => s + r.extra.bossTime, 0);
  if (bossTime > 0) {
    const t = sumBy(rs, (x) => x.bossTarget);
    parts.push(
      `boss on ${Object.entries(t)
        .sort((a, z) => z[1] - a[1])
        .map(([k, v]) => `${k} ${pct(v / bossTime)}`)
        .join(' ')}`,
    );
  }
  return parts.join(' · ');
}

/** The inversion check's numbers for a party and bot: per hero, a fight's Mend s and support. */
export function supportLine(cells: readonly Cell[]): string {
  const rs = cells.flatMap((c) => c.runs);
  const n = rs.length;
  const mend = sumBy(rs, (x) => x.mendTime);
  const heal = sumBy(rs, (x) => x.weaverHeal);
  const shield = sumBy(rs, (x) => x.weaverShield);
  const ward = sumBy(rs, (x) => x.weaverWard);
  const heroes = [...new Set([...Object.keys(heal), ...Object.keys(shield)])];
  return heroes
    .map((h) => {
      const support = (heal[h] ?? 0) + (shield[h] ?? 0);
      return `${h} mend ${((mend[h] ?? 0) / n).toFixed(1)} s · heal ${pct((heal[h] ?? 0) / (support || 1))} ward ${pct((ward[h] ?? 0) / (support || 1))} of ${Math.round(support / n)}`;
    })
    .join(' | ');
}

function cellsMain(): void {
  const movement = Number(get('movement') ?? 1);
  // The harness's kit and loadout for the Movement (its parseArgs, so the two never differ).
  const hargs = parseArgs([
    '--movement',
    String(movement),
    ...(get('kit') ? ['--kit', get('kit')!] : []),
  ]);
  const kit = kitConfig(hargs.kit, hargs.chords);
  const encounters = (get('encounters') ?? movementEncounters(movement).join(',')).split(',');
  const bots = (get('bots') ?? 'idle,novice,skilled').split(',') as BotKind[];
  const seeds = Number(get('seeds') ?? 50);
  const base = Number(get('seed-base') ?? 1000);
  const t0 = Date.now();
  console.log(
    `brann-bands · Movement ${movement} · ${hargs.label} · ${seeds} seeds from ${base} · ${encounters.length} cells`,
  );
  const all: Cell[] = [];
  for (const [name, party] of parties()) {
    for (const encounter of encounters) {
      for (const bot of bots) {
        const cell: Cell = { party: name, encounter, bot, runs: [] };
        for (let i = 0; i < seeds; i++) {
          const seed = base + i * 7919;
          const w = new ExtraWatch();
          const r = playEncounter(
            { seed, encounter, ...kit, ...(party ? { party } : {}) },
            bot,
            w.watch,
          );
          cell.runs.push({ ...r, extra: w.x });
        }
        all.push(cell);
        console.log(cellLine(cell));
      }
    }
    for (const bot of bots) {
      const mine = all.filter((c) => c.party === name && c.bot === bot);
      console.log(`  support ${name} ${bot}: ${supportLine(mine)}`);
    }
  }
  console.log(`done in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  const json = get('json');
  if (json) writeFileSync(json, JSON.stringify(all));
}

function runsMain(): void {
  const movements = Number(get('movements') ?? 2);
  const hargs = parseArgs(get('loadout') ? ['--loadout', get('loadout')!] : []);
  const seeds = Number(get('seeds') ?? 200);
  const base = Number(get('seed-base') ?? 2000);
  const bots = (get('bots') ?? 'idle,novice,skilled').split(',') as BotKind[];
  const t0 = Date.now();
  console.log(
    `brann-bands · whole ${movements >= 2 ? 'Expeditions' : 'Preludes'} · ${hargs.label} · ${seeds} seeds from ${base}`,
  );
  const rows: unknown[] = [];
  for (const [name, party] of parties()) {
    for (const bot of bots) {
      const results = Array.from({ length: seeds }, (_, i) =>
        playRun(base + i * 104729, bot, hargs.chords, {
          relics: true,
          movements,
          ...(party ? { party } : {}),
        }),
      );
      const wins = results.filter((r) => r.outcome === 'victory').length / results.length;
      const fights = results.reduce((s, r) => s + r.fights, 0);
      const xp: Record<string, number> = {};
      for (const r of results)
        for (const [h, v] of Object.entries(r.bondXp)) xp[h] = (xp[h] ?? 0) + v;
      const perFight = Object.entries(xp)
        .map(([h, v]) => `${h} ${(v / fights).toFixed(1)}`)
        .join(' ');
      let line = `${name.padEnd(7)} ${bot.padEnd(7)} win ${pct(wins).padStart(4)} · ${(fights / results.length).toFixed(1)} fights · Bond XP a fight ${perFight}`;
      if (xp.brann !== undefined) {
        const others = Object.entries(xp).filter(([h]) => h !== 'brann');
        const avg = mean(others.map(([, v]) => v));
        line += ` · Brann ${pct(xp.brann / (avg || 1))} of the starters' average`;
      }
      const harmony = results.filter((r) => r.harmony);
      if (harmony.length > 0) {
        const owned = harmony.filter((r) => r.harmony!.prereqsOwned);
        const offered = owned.filter((r) => r.harmony!.silkOfferedEligible > 0).length;
        line += ` · Blood and Silk offered in ${pct(harmony.filter((r) => r.harmony!.silkOffered > 0).length / harmony.length)} of runs; prerequisites owned in ${owned.length}, offered then ${owned.length ? `${offered}/${owned.length} ${pct(offered / owned.length)}` : '-'}`;
      }
      // Where the lost runs ended, most first (the harness's 'lost at').
      const lost: Record<string, number> = {};
      for (const r of results)
        if (r.outcome !== 'victory') lost[r.lastEncounter] = (lost[r.lastEncounter] ?? 0) + 1;
      const lostAt = Object.entries(lost)
        .sort((a, z) => z[1] - a[1] || a[0].localeCompare(z[0]))
        .slice(0, 6)
        .map(([k, v]) => `${k} ${v}`)
        .join(', ');
      if (lostAt) line += ` · lost at ${lostAt}`;
      // Movement III onward (docs/phase-5c.md): the win among runs that reached the last one
      // (the Finale route's by its label, docs/phase-5d.md).
      if (movements >= 3) {
        const last = results.filter((r) => r.movementReached >= movements);
        const won = last.filter((r) => r.outcome === 'victory').length;
        const name = movements >= 4 ? movementName(movements, true) : String(movements);
        line += ` · reached ${name} ${pct(last.length / results.length)}, won of those ${last.length ? pct(won / last.length) : '-'}`;
      }
      console.log(line);
      rows.push({ party: name, bot, wins, results });
    }
  }
  console.log(`done in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  const json = get('json');
  if (json) writeFileSync(json, JSON.stringify(rows));
}

if (process.argv[1]?.endsWith('brann-bands.ts')) {
  if (argv.includes('--runs')) runsMain();
  else cellsMain();
}
