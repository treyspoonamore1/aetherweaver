/**
 * The roster's bands (docs/phase-5e.md, "Bands"; generalises tools/brann-bands.ts with `--hero`):
 * every cell for a hero's parties beside the default party, in one run of the tool, with the
 * numbers the harness's own tallies leave out, and **every down instrumented** from day one.
 *
 *   npx tsx tools/roster-bands.ts --hero seren --movement 2 --seeds 50        Seren's parties
 *   npx tsx tools/roster-bands.ts --hero oro --movement 3 --seeds 50 --seed-base 500003
 *   npx tsx tools/roster-bands.ts --hero brann --movement 1 --seeds 50        Brann's A, B, C
 *   npx tsx tools/roster-bands.ts --parties default,OB --bots skilled --encounters vharun
 *   npx tsx tools/roster-bands.ts --hero seren --runs --movements 4 --seeds 200
 *   npx tsx tools/roster-bands.ts --first-look                                the W8 gate
 *   npx tsx tools/roster-bands.ts --first-look --cells-only | --runs-only     either half
 *   npx tsx tools/roster-bands.ts --first-look --seeds 24 --run-seeds 50      its sizes
 *
 * `--hero` picks the parties (`HERO_PARTIES`: the default party first, then the hero's) and whose
 * Decree numbers the extras follow; `--parties` names them instead (NAMED_PARTIES codes, `default`,
 * hero ids joined by `+`, or `roster`: every 3-hero party with Seren or Oro). Cells play as
 * tools/harness.ts plays them (Movement I bare, Movement II the arrival kit, Movement III
 * ARRIVAL3_KIT, the Finale ARRIVAL4_KIT; fights at seed base + i × 7919, runs at base +
 * i × 104729). Beside the harness's tallies (`brann`, `seren`, `oro`) each fight records:
 *
 * - who the boss targets, as a share of its time: by hero, or `sapling` / `ancient` for Oro's
 *   summons (both expected 0: bosses ignore them), and the Hollow Champion's likewise;
 * - the hero's Decree numbers: Executions on them and their verdicts, Twin Cleave's first blows
 *   on them and the downs to either blow; the Thread cut while on them and Unravel's harm; the
 *   Finale's Fortissimo Silence toll, stilled seconds and Solos aimed at them and landed;
 * - the Weaver's Mend time and support on each hero (and on the Saplings), for the inversion check;
 * - **Weaver safety**: the Weaver's damage taken and downs, and every enemy cut of the Thread;
 * - **every down** (`DownRecord`): who went down, the last blow (its attack, its source), whether
 *   that blow's telegraph was aimed at the victim, at another hero or at no one (or was a basic
 *   swing or a tick), the victim's distance from the Weaver, whether Seren's parry was armed, and
 *   whether one of Oro's summons stood within 4 m; plus the sim's own recap fields (`duel`,
 *   `grove`).
 *
 * Runs record each hero's Bond XP a fight, and a recruit's share of **the starters' average**
 * (CONTENT.defaultParty, the same three for every party). `--json` writes every row.
 *
 * `--first-look` (docs/phase-5e.md, "First look", a gate before any tuning): the default party and
 * every Seren or Oro party at every Movement's boss (Movement I-III's and the Conductor, each on
 * its Movement's kit), 24 seeds from 1000, Idle, Novice and Skilled; then 50 Skilled Finale-route
 * runs from 2000. Each row prints its gap to the default party, flagged past 15 points (25 for OB,
 * Q8); then the per-down table.
 */
import { writeFileSync } from 'node:fs';
import type { BotKind } from '../src/bots';
import { CONTENT, movementDef } from '../src/content';
import { FORTISSIMO, SOLOS } from '../src/content/crucibleIds';
import { isWeaverVia, parryArmed, type EntityId, type Sim, type SimEvent } from '../src/sim';
import { NAMED_PARTIES, oroLine, parseArgs, rosterTier, serenLine } from './harness';
import {
  movementName,
  playEncounter,
  playRun,
  type EncounterRun,
  type RunSummary,
} from './harness-core';
import { kitConfig } from './kits';

const argv = process.argv.slice(2);
const get = (name: string) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
};

/** How the blow that downed a hero was aimed (`DownRecord.aimed`). */
export type Aimed = 'self' | 'other' | 'none' | 'basic' | 'tick' | 'unknown';

/** One hero's down, as it happened (docs/phase-5e.md: the instrument 5b had to bolt on). */
export interface DownRecord {
  /** The hero's def id. */
  hero: string;
  /** Sim seconds into the fight. */
  time: number;
  /** The last blow's attack id (a telegraph's), `basic` for a swing, `tick` for a status tick. */
  attack: string;
  /** The enemy def id that struck it ('' when the source wasn't an enemy). */
  by: string;
  aimed: Aimed;
  /** The victim's distance from the Weaver (m). */
  distance: number;
  /** Seren's parry was armed as she went down (absent for any other hero). */
  parryArmed?: boolean;
  /** One of Oro's summons stood within 4 m of the victim. */
  summonNear: boolean;
  /** The sim's own recap fields for Seren and Oro (`DeathRecord.duel` / `.grove`). */
  duel?: { warded: boolean; parryable: boolean; overextended: boolean; far: boolean };
  grove?: { melee: boolean; feltOutside: number; threadCut: boolean };
}

/** One fight's extra numbers, by hero id. */
export interface RosterExtra {
  /** Seconds the boss spent targeting each hero (or summon kind), absent without a boss. */
  bossTarget: Record<string, number>;
  bossTime: number;
  /** The watched hero's (`--hero`) Decree numbers. */
  execOn: number;
  execSpared: number;
  twinFirstOn: number;
  twinDowned: number;
  cutsOn: number;
  unravelOn: number;
  fortissimoOn: number;
  stilled: number;
  solosAt: number;
  solosOn: number;
  mendTime: Record<string, number>;
  weaverHeal: Record<string, number>;
  weaverShield: Record<string, number>;
  weaverWard: Record<string, number>;
  /** Seconds the Hollow Champion spent targeting each hero (or summon kind). */
  championTarget: Record<string, number>;
  championTime: number;
  /** Weaver safety: her damage taken (HP and shields) and downs; enemy cuts of the Thread. */
  weaverDamage: number;
  weaverDowns: number;
  threadCuts: number;
  downs: DownRecord[];
}

/** The keys of a `RosterExtra`, in order (the harness tests pin them). */
export const ROSTER_EXTRA_KEYS: readonly (keyof RosterExtra)[] = [
  'bossTarget',
  'bossTime',
  'execOn',
  'execSpared',
  'twinFirstOn',
  'twinDowned',
  'cutsOn',
  'unravelOn',
  'fortissimoOn',
  'stilled',
  'solosAt',
  'solosOn',
  'mendTime',
  'weaverHeal',
  'weaverShield',
  'weaverWard',
  'championTarget',
  'championTime',
  'weaverDamage',
  'weaverDowns',
  'threadCuts',
  'downs',
];

const CHAMPION = 'mirror_champion';
const TWIN = 'vharun_twin_cleave';
const TWIN_SECOND = 'vharun_twin_cleave_second';
const EXECUTION = 'vharun_execution';
const PULSES: ReadonlySet<string> = new Set(FORTISSIMO);
const SOLO_IDS: ReadonlySet<string> = new Set(Object.values(SOLOS));
/** A summon this near a downed hero (m) was involved. */
const SUMMON_NEAR = 4;

/** The last blow on a hero: what struck, from where, aimed how. */
interface Blow {
  attack: string;
  by: string;
  aimed: Aimed;
}

/**
 * Reads a fight's extra numbers off its events and state (`playEncounter`'s `watch`); it only
 * reads, so a fight plays the same with or without one. `hero` is whose Decree numbers it follows.
 */
export class RosterWatch {
  readonly x: RosterExtra = {
    bossTarget: {},
    bossTime: 0,
    execOn: 0,
    execSpared: 0,
    twinFirstOn: 0,
    twinDowned: 0,
    cutsOn: 0,
    unravelOn: 0,
    fortissimoOn: 0,
    stilled: 0,
    solosAt: 0,
    solosOn: 0,
    mendTime: {},
    weaverHeal: {},
    weaverShield: {},
    weaverWard: {},
    championTarget: {},
    championTime: 0,
    weaverDamage: 0,
    weaverDowns: 0,
    threadCuts: 0,
    downs: [],
  };
  private readonly telegraph = new Map<number, { attack: string; target: EntityId | null }>();
  private readonly lastBlow = new Map<EntityId, Blow>();
  private lastTime = -1;
  private wasDowned = false;
  private champion: EntityId | null = null;

  constructor(readonly hero: string = 'brann') {}

  /** A hero's def id, or a summon's kind (`sapling`, `ancient`); null for anything else. */
  private who(sim: Sim, id: EntityId | null): string | null {
    if (id === null) return null;
    const e = sim.state.entities.get(id);
    return e?.hero?.defId ?? e?.summon?.kind ?? null;
  }

  watch = (sim: Sim, events: readonly SimEvent[]): void => {
    const state = sim.state;
    const x = this.x;
    const add = (r: Record<string, number>, k: string | null, v: number) => {
      if (k !== null) r[k] = (r[k] ?? 0) + v;
    };
    const mine = (id: EntityId | null) => this.who(sim, id) === this.hero;
    let twinOnMe = false;
    const meId = state.party.find((id) => this.who(sim, id) === this.hero);
    const me = meId === undefined ? undefined : state.entities.get(meId);
    const downed: EntityId[] = [];
    for (const e of events) {
      switch (e.type) {
        case 'telegraphStarted': {
          const t = state.telegraphs.find((tt) => tt.id === e.telegraph);
          const attack = t?.attackId ?? e.name;
          this.telegraph.set(e.telegraph, { attack, target: e.target });
          if (SOLO_IDS.has(attack) && mine(e.target)) x.solosAt++;
          break;
        }
        case 'telegraphResolved': {
          const attack = this.telegraph.get(e.telegraph)?.attack;
          if (!mine(e.target)) break;
          if (attack !== undefined && SOLO_IDS.has(attack) && e.outcome === 'hit' && e.damage > 0)
            x.solosOn++;
          if (attack === EXECUTION && e.execution !== 'fallen') {
            x.execOn++;
            if (e.execution === 'spared') x.execSpared++;
          }
          if (attack === TWIN) x.twinFirstOn++;
          if (attack === TWIN || attack === TWIN_SECOND) twinOnMe = true;
          break;
        }
        case 'healApplied':
          if (isWeaverVia(e.via)) add(x.weaverHeal, this.who(sim, e.target), e.amount);
          break;
        case 'shieldApplied':
          if (!e.fromWeaver) break;
          add(x.weaverShield, this.who(sim, e.target), e.amount);
          if (e.shield === 'ward') add(x.weaverWard, this.who(sim, e.target), e.amount);
          break;
        case 'threadSnapped':
          if (e.cause === undefined) break;
          x.threadCuts++;
          if (mine(e.target)) x.cutsOn++;
          break;
        case 'weaverDowned':
          x.weaverDowns++;
          break;
        case 'damageTaken': {
          if (e.target === state.weaverId) x.weaverDamage += e.amount + e.absorbed;
          const tel = e.telegraph === null ? undefined : this.telegraph.get(e.telegraph);
          if (tel && PULSES.has(tel.attack) && mine(e.target)) x.fortissimoOn += e.amount;
          if (
            state.field.unravel &&
            e.hit === 'tick' &&
            e.telegraph === null &&
            e.source === state.field.unravel.source &&
            mine(e.target)
          )
            x.unravelOn += e.amount + e.absorbed;
          if (state.party.includes(e.target) && e.amount + e.absorbed > 0)
            this.lastBlow.set(e.target, this.blow(sim, e, tel));
          break;
        }
        case 'allyDowned':
          downed.push(e.hero);
          break;
        case 'entitySpawned':
          if (state.entities.get(e.id)?.enemy?.defId === CHAMPION) this.champion = e.id;
          break;
        default:
          break;
      }
    }
    // A down's blow lands in its own tick: read every down once the tick's events are in.
    for (const id of downed) this.recordDown(sim, id);
    // A down lands in the same tick as the blow (its allyDowned comes before the resolution).
    const isDown = !!me?.health?.downed;
    if (twinOnMe && isDown && !this.wasDowned) x.twinDowned++;
    this.wasDowned = isDown;
    const dt = this.lastTime < 0 ? 0 : state.time - this.lastTime;
    this.lastTime = state.time;
    if (dt <= 0) return;
    if (me?.health?.statuses?.some((st) => st.id === 'stilled')) x.stilled += dt;
    const w = state.entities.get(state.weaverId)?.weaver;
    if (w && w.threadSlot !== null && w.threadMode === 'mend')
      add(x.mendTime, this.who(sim, state.party[w.threadSlot] ?? null), dt);
    const bossId = state.encounter.bossId;
    const boss = bossId === null ? undefined : state.entities.get(bossId);
    if (boss?.enemy && !boss.health?.dead) {
      x.bossTime += dt;
      add(x.bossTarget, this.who(sim, boss.enemy.targetId), dt);
    }
    const champ = this.champion === null ? undefined : state.entities.get(this.champion);
    if (champ?.enemy && champ.health && !champ.health.dead) {
      x.championTime += dt;
      add(x.championTarget, this.who(sim, champ.enemy.targetId), dt);
    } else this.champion = null;
  };

  private blow(
    sim: Sim,
    e: Extract<SimEvent, { type: 'damageTaken' }>,
    tel: { attack: string; target: EntityId | null } | undefined,
  ): Blow {
    const src = e.source === null ? undefined : sim.state.entities.get(e.source);
    const by = src?.enemy?.defId ?? '';
    if (tel)
      return {
        attack: tel.attack,
        by,
        aimed: tel.target === null ? 'none' : tel.target === e.target ? 'self' : 'other',
      };
    if (e.hit === 'tick') return { attack: 'tick', by, aimed: 'tick' };
    return { attack: src?.enemy ? 'basic' : 'other', by, aimed: src?.enemy ? 'basic' : 'unknown' };
  }

  private recordDown(sim: Sim, id: EntityId): void {
    const state = sim.state;
    const v = state.entities.get(id);
    if (!v?.hero) return;
    const w = state.entities.get(state.weaverId);
    const blow = this.lastBlow.get(id) ?? { attack: 'unknown', by: '', aimed: 'unknown' as const };
    let summonNear = false;
    for (const s of state.entities.list())
      if (s.summon && s.health && !s.health.dead && Math.hypot(s.x - v.x, s.z - v.z) <= SUMMON_NEAR)
        summonNear = true;
    const death = [...state.ledger.deaths].reverse().find((d) => d.hero === id);
    this.x.downs.push({
      hero: v.hero.defId,
      time: state.time - state.encounter.startedAt,
      ...blow,
      distance: w ? Math.hypot(v.x - w.x, v.z - w.z) : 0,
      ...(v.hero.duel ? { parryArmed: parryArmed(v) } : {}),
      summonNear,
      ...(death?.duel ? { duel: { ...death.duel } } : {}),
      ...(death?.grove ? { grove: { ...death.grove } } : {}),
    });
  }
}

export interface Cell {
  party: string;
  encounter: string;
  bot: BotKind;
  runs: (EncounterRun & { extra: RosterExtra })[];
}

function mean(xs: readonly number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}
const pct = (n: number) => `${Math.round(n * 100)}%`;

/** Each hero's parties (`--hero`), the default party first. */
export const HERO_PARTIES: Readonly<Record<string, readonly string[]>> = {
  brann: ['default', 'A', 'B', 'C'],
  seren: ['default', 'SA', 'SB', 'SC', 'R', 'SO', 'X', 'W'],
  oro: ['default', 'OA', 'OB', 'OC', 'SO', 'X', 'W'],
};

/** A hero's initial, for an unnamed party's label (`KLB`); Kael and Lyra's are their own. */
const INITIAL: Readonly<Record<string, string>> = {
  kael: 'K',
  lyra: 'L',
  vexis: 'V',
  brann: 'B',
  seren: 'S',
  oro: 'O',
};

/** A party's label: its NAMED_PARTIES code, or its heroes' initials in content order. */
export function partyLabel(party: readonly string[]): string {
  const key = [...party].sort().join();
  const code = Object.keys(NAMED_PARTIES).find((c) => [...NAMED_PARTIES[c]!].sort().join() === key);
  if (code) return code;
  return CONTENT.heroes
    .map((h) => h.id)
    .filter((id) => party.includes(id))
    .map((id) => INITIAL[id] ?? id)
    .join('');
}

/** Every 3-hero party with Seren or Oro (16 of the 20), in content order, named. */
export function rosterParties(): [string, string[]][] {
  const ids = CONTENT.heroes.map((h) => h.id);
  const out: [string, string[]][] = [];
  for (let a = 0; a < ids.length; a++)
    for (let b = a + 1; b < ids.length; b++)
      for (let c = b + 1; c < ids.length; c++) {
        const party = [ids[a]!, ids[b]!, ids[c]!];
        if (party.includes('seren') || party.includes('oro')) out.push([partyLabel(party), party]);
      }
  // Banded parties first (the full protocol, then the reduced), the sweep after.
  const rank = (p: string[]) =>
    ({ kael: 0, sb: 0, ob: 0, reduced: 1, sweep: 2 })[rosterTier(p) ?? 'sweep'];
  return out.sort((x, y) => rank(x[1]) - rank(y[1]));
}

/**
 * `--parties`' value (or `--hero`'s parties): `default` (no party key), NAMED_PARTIES codes, an
 * unnamed party's initials (`LBS`),
 * hero ids joined by `+`, or `roster` (every party with Seren or Oro).
 */
export function partiesArg(value: string | undefined, hero: string): [string, string[] | null][] {
  const list = value ?? (HERO_PARTIES[hero] ?? HERO_PARTIES.brann!).join(',');
  const out: [string, string[] | null][] = [];
  for (const p of list.split(',').filter(Boolean)) {
    if (p === 'default') out.push(['default', null]);
    else if (p === 'roster') out.push(...rosterParties());
    else if (NAMED_PARTIES[p.toUpperCase()])
      out.push([p.toUpperCase(), [...NAMED_PARTIES[p.toUpperCase()]!]]);
    else if (rosterParties().some(([label]) => label === p.toUpperCase()))
      out.push(rosterParties().find(([label]) => label === p.toUpperCase())!);
    else {
      const ids = p.split('+');
      const known = CONTENT.heroes.map((h) => h.id);
      if (ids.length !== 3 || ids.some((id) => !known.includes(id)) || new Set(ids).size !== 3)
        throw new Error(`Unknown party "${p}" (${Object.keys(NAMED_PARTIES)}, default, roster)`);
      const party = known.filter((id) => ids.includes(id));
      out.push([partyLabel(party), party]);
    }
  }
  return out;
}

function sumBy(rs: readonly Cell['runs'][number][], f: (x: RosterExtra) => Record<string, number>) {
  const out: Record<string, number> = {};
  for (const r of rs) for (const [k, v] of Object.entries(f(r.extra))) out[k] = (out[k] ?? 0) + v;
  return out;
}

const winOf = (rs: readonly { outcome: string }[]) =>
  rs.length ? rs.filter((r) => r.outcome === 'victory').length / rs.length : 0;

/** A cell's summary line: the harness's numbers, the heroes' tallies and the extras. */
export function cellLine(c: Cell, hero = 'brann', vs?: Cell): string {
  const rs = c.runs;
  const n = rs.length || 1;
  const win = winOf(rs);
  const gap = vs
    ? ` (${win >= winOf(vs.runs) ? '+' : ''}${Math.round(100 * (win - winOf(vs.runs)))})`
    : '';
  const parts = [
    `${c.party.padEnd(7)} ${c.encounter.padEnd(20)} ${c.bot.padEnd(7)} win ${pct(win).padStart(4)}${gap} share ${pct(mean(rs.map((r) => r.share))).padStart(4)} ${mean(
      rs.map((r) => r.duration),
    )
      .toFixed(0)
      .padStart(4)} s downs ${mean(rs.map((r) => r.downs)).toFixed(2)}`,
  ];
  const sum = (f: (x: RosterExtra) => number) => rs.reduce((s, r) => s + f(r.extra), 0);
  // Weaver safety, a fight: her damage taken and downs, and the Thread's enemy cuts.
  parts.push(
    `Weaver hurt ${Math.round(sum((x) => x.weaverDamage) / n)} downs ${(sum((x) => x.weaverDowns) / n).toFixed(2)} cuts ${(sum((x) => x.threadCuts) / n).toFixed(1)}`,
  );
  const exec = sum((x) => x.execOn);
  const spared = sum((x) => x.execSpared);
  const twin = sum((x) => x.twinFirstOn);
  const twinDown = sum((x) => x.twinDowned);
  if (exec > 0) parts.push(`exec on ${hero} spared ${spared}/${exec}`);
  // Twin Cleave: its first blows on the hero, and the downs to either blow (the second re-aims).
  if (twin > 0 || twinDown > 0) parts.push(`twin first on ${hero} ${twin}, downed ${twinDown}`);
  const cuts = sum((x) => x.cutsOn);
  if (cuts > 0) parts.push(`cut on ${hero} ${(cuts / n).toFixed(1)}`);
  const at = sum((x) => x.solosAt);
  if (at > 0)
    parts.push(
      `Solos at ${hero} ${(at / n).toFixed(1)}, landed ${(sum((x) => x.solosOn) / n).toFixed(1)}`,
    );
  for (const [label, time, target] of [
    ['champion', sum((x) => x.championTime), sumBy(rs, (x) => x.championTarget)],
    ['boss', sum((x) => x.bossTime), sumBy(rs, (x) => x.bossTarget)],
  ] as const)
    if (time > 0)
      parts.push(
        `${label} on ${Object.entries(target)
          .sort((a, z) => z[1] - a[1])
          .map(([k, v]) => `${k} ${pct(v / time)}`)
          .join(' ')}`,
      );
  const lines = [parts.join(' · ')];
  const seren = serenLine(rs);
  if (seren) lines.push(seren);
  const oro = oroLine(rs);
  if (oro) lines.push(oro);
  return lines.join('\n');
}

/** The inversion check's numbers for a party and bot: per hero, a fight's Mend s and support. */
export function supportLine(cells: readonly Cell[]): string {
  const rs = cells.flatMap((c) => c.runs);
  const n = rs.length || 1;
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

/** The per-down table for cells (docs/phase-5e.md, "First look": read it first). */
export function downTable(cells: readonly Cell[]): string[] {
  const rs = cells.flatMap((c) => c.runs);
  const downs = rs.flatMap((r) => r.extra.downs);
  if (downs.length === 0) return ['    no downs'];
  const byHero = new Map<string, DownRecord[]>();
  for (const d of downs) byHero.set(d.hero, [...(byHero.get(d.hero) ?? []), d]);
  const lines: string[] = [];
  const order = CONTENT.heroes.map((h) => h.id).filter((h) => byHero.has(h));
  for (const hero of order) {
    const ds = byHero.get(hero)!;
    const count = (f: (d: DownRecord) => boolean) => ds.filter(f).length;
    const aimed = (a: Aimed) => count((d) => d.aimed === a);
    const attacks: Record<string, number> = {};
    for (const d of ds) attacks[d.attack] = (attacks[d.attack] ?? 0) + 1;
    const top = Object.entries(attacks)
      .sort((a, z) => z[1] - a[1] || a[0].localeCompare(z[0]))
      .slice(0, 4)
      .map(([k, v]) => `${k} ${v}`)
      .join(', ');
    const extras = [
      ds.some((d) => d.parryArmed !== undefined)
        ? `parry armed ${count((d) => !!d.parryArmed)}`
        : '',
      ds.some((d) => d.duel) ? `overextended ${count((d) => !!d.duel?.overextended)}` : '',
      ds.some((d) => d.grove) ? `in melee ${count((d) => !!d.grove?.melee)}` : '',
      `summon near ${count((d) => d.summonNear)}`,
    ].filter(Boolean);
    lines.push(
      `    ${hero.padEnd(6)} ${(ds.length / rs.length).toFixed(2)} a fight (${ds.length}) · aimed at them ${aimed('self')}, at another ${aimed('other')}, at no one ${aimed('none')}, basic ${aimed('basic')}, tick ${aimed('tick')}${aimed('unknown') ? `, unknown ${aimed('unknown')}` : ''} · beyond 14 m ${count((d) => d.distance > 14)} · ${extras.join(' · ')} · top ${top}`,
    );
  }
  return lines;
}

/** Plays one cell: `seeds` fights of `encounter` for `party`, watched. */
export function playCell(
  name: string,
  party: readonly string[] | null,
  encounter: string,
  bot: BotKind,
  kit: ReturnType<typeof kitConfig>,
  seeds: number,
  base: number,
  hero: string,
): Cell {
  const cell: Cell = { party: name, encounter, bot, runs: [] };
  for (let i = 0; i < seeds; i++) {
    const seed = base + i * 7919;
    const w = new RosterWatch(hero);
    const r = playEncounter(
      { seed, encounter, ...kit, ...(party ? { party: [...party] } : {}) },
      bot,
      w.watch,
    );
    cell.runs.push({ ...r, extra: w.x });
  }
  return cell;
}

/** The gap below the default party past which a row is diagnosed before tuning (OB: 25, Q8). */
export function firstLookGap(party: readonly string[] | null): number {
  return party && rosterTier(party) === 'ob' ? 25 : 15;
}

function cellsMain(): void {
  const hero = get('hero') ?? (argv.includes('--first-look') ? 'seren' : 'brann');
  const firstLook = argv.includes('--first-look');
  // The first look plays every Movement's boss, or the Movements `--movement` lists (`1,2`).
  const movements = (get('movement') ?? (firstLook ? '1,2,3,4' : '1')).split(',').map(Number);
  const bots = (get('bots') ?? 'idle,novice,skilled').split(',') as BotKind[];
  const seeds = Number(get('seeds') ?? (firstLook ? 24 : 50));
  const base = Number(get('seed-base') ?? 1000);
  const parties = partiesArg(get('parties') ?? (firstLook ? 'default,roster' : undefined), hero);
  const t0 = Date.now();
  const all: Cell[] = [];
  for (const movement of movements) {
    // The harness's kit and loadout for the Movement (its parseArgs, so the two never differ).
    const hargs = parseArgs([
      '--movement',
      String(movement),
      ...(get('kit') ? ['--kit', get('kit')!] : []),
    ]);
    const kit = kitConfig(hargs.kit, hargs.chords);
    const encounters = firstLook
      ? [movementDef(movement).boss]
      : (get('encounters') ?? hargs.encounters.join(',')).split(',');
    console.log(
      `roster-bands · ${firstLook ? 'first look · ' : ''}${movement >= 4 ? movementName(movement) : `Movement ${movementName(movement)}`} · ${hargs.label} · ${seeds} seeds from ${base} · ${encounters.length} cells · ${parties.length} parties`,
    );
    const mine: Cell[] = [];
    for (const [name, party] of parties) {
      for (const encounter of encounters) {
        for (const bot of bots) {
          const cell = playCell(name, party, encounter, bot, kit, seeds, base, hero);
          const vs = mine.find(
            (c) => c.party === 'default' && c.encounter === encounter && c.bot === bot,
          );
          mine.push(cell);
          let line = cellLine(cell, hero, vs);
          if (vs && party && bot === 'skilled') {
            const gap = Math.round(100 * (winOf(vs.runs) - winOf(cell.runs)));
            if (gap > firstLookGap(party))
              line += `\n   DIAGNOSE: ${gap} points under default (past ${firstLookGap(party)})`;
          }
          console.log(line);
        }
      }
      for (const bot of bots) {
        const cells = mine.filter((c) => c.party === name && c.bot === bot);
        console.log(`  support ${name} ${bot}: ${supportLine(cells)}`);
        if (bot !== 'idle') {
          console.log(`  downs ${name} ${bot}:`);
          for (const l of downTable(cells)) console.log(l);
        }
      }
    }
    all.push(...mine);
  }
  console.log(`done in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  const json = get('json');
  if (json) writeFileSync(json, JSON.stringify(all));
}

/** A run list's Bond XP a fight, by hero, and each recruit's share of the starters' average. */
export function bondLine(results: readonly RunSummary[]): string {
  const fights = results.reduce((s, r) => s + r.fights, 0) || 1;
  const xp: Record<string, number> = {};
  for (const r of results) for (const [h, v] of Object.entries(r.bondXp)) xp[h] = (xp[h] ?? 0) + v;
  const perFight = Object.entries(xp)
    .map(([h, v]) => `${h} ${(v / fights).toFixed(1)}`)
    .join(' ');
  // The starters are CONTENT.defaultParty's heroes, whatever the party: party R or X has only
  // Kael, or none, of them; their average is then of those it has (else nothing to compare).
  const starters = CONTENT.defaultParty.filter((h) => xp[h] !== undefined);
  const avg = mean(starters.map((h) => xp[h]!));
  const recruits = Object.keys(xp).filter((h) => !CONTENT.defaultParty.includes(h));
  const shares =
    starters.length > 0
      ? recruits.map((h) => `${h} ${pct(xp[h]! / (avg || 1))} of the starters' average`)
      : [];
  return [`Bond XP a fight ${perFight}`, ...shares].join(' · ');
}

function runsMain(): void {
  const hero = get('hero') ?? (argv.includes('--first-look') ? 'seren' : 'brann');
  const firstLook = argv.includes('--first-look');
  const movements = Number(get('movements') ?? (firstLook ? 4 : 2));
  const hargs = parseArgs(get('loadout') ? ['--loadout', get('loadout')!] : []);
  const seeds = Number(firstLook ? (get('run-seeds') ?? 50) : (get('seeds') ?? 200));
  const base = Number(get('seed-base') ?? 2000);
  const bots = (get('bots') ?? (firstLook ? 'skilled' : 'idle,novice,skilled')).split(
    ',',
  ) as BotKind[];
  const parties = partiesArg(get('parties') ?? (firstLook ? 'default,roster' : undefined), hero);
  const t0 = Date.now();
  console.log(
    `roster-bands · whole ${movements >= 2 ? 'Expeditions' : 'Preludes'} (${movements} Movements) · ${hargs.label} · ${seeds} seeds from ${base} · ${parties.length} parties`,
  );
  const rows: { party: string; bot: BotKind; wins: number; results: RunSummary[] }[] = [];
  for (const [name, party] of parties) {
    for (const bot of bots) {
      const results = Array.from({ length: seeds }, (_, i) =>
        playRun(base + i * 104729, bot, hargs.chords, {
          relics: true,
          movements,
          ...(party ? { party } : {}),
        }),
      );
      const wins = winOf(results);
      const vs = rows.find((r) => r.party === 'default' && r.bot === bot);
      const gap = vs ? ` (${wins >= vs.wins ? '+' : ''}${Math.round(100 * (wins - vs.wins))})` : '';
      let line = `${name.padEnd(7)} ${bot.padEnd(7)} win ${pct(wins).padStart(4)}${gap} · ${(results.reduce((s, r) => s + r.fights, 0) / results.length).toFixed(1)} fights · ${(results.reduce((s, r) => s + r.minutes, 0) / results.length).toFixed(1)} min · ${bondLine(results)}`;
      const lost: Record<string, number> = {};
      for (const r of results)
        if (r.outcome !== 'victory') lost[r.lastEncounter] = (lost[r.lastEncounter] ?? 0) + 1;
      const lostAt = Object.entries(lost)
        .sort((a, z) => z[1] - a[1] || a[0].localeCompare(z[0]))
        .slice(0, 6)
        .map(([k, v]) => `${k} ${v}`)
        .join(', ');
      if (lostAt) line += ` · lost at ${lostAt}`;
      if (movements >= 3) {
        const last = results.filter((r) => r.movementReached >= movements);
        const won = last.filter((r) => r.outcome === 'victory').length;
        line += ` · reached ${movementName(movements, true)} ${pct(last.length / results.length)}, won of those ${last.length ? pct(won / last.length) : '-'}`;
      }
      if (vs && party && bot === 'skilled') {
        const under = Math.round(100 * (vs.wins - wins));
        if (under > firstLookGap(party))
          line += `\n   DIAGNOSE: ${under} points under default (past ${firstLookGap(party)})`;
      }
      console.log(line);
      rows.push({ party: name, bot, wins, results });
    }
  }
  console.log(`done in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  const json = get('json');
  if (json) writeFileSync(json, JSON.stringify(rows));
}

if (process.argv[1]?.endsWith('roster-bands.ts')) {
  if (argv.includes('--first-look')) {
    if (!argv.includes('--runs-only')) cellsMain();
    if (!argv.includes('--cells-only')) runsMain();
  } else if (argv.includes('--runs')) runsMain();
  else cellsMain();
}
