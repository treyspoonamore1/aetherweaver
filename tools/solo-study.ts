/**
 * The Solo study (docs/solos.md): how Solos, the Thread and Resonance are used in real fights,
 * by each bot and by the "person" follower (tools/person.ts), under the rules as they are or with
 * one of the Solo numbers changed for the run. It is the instrument the Solo rules are tuned by.
 *
 *   npx tsx tools/solo-study.ts --out /path/a.jsonl --seeds 20
 *   npx tsx tools/solo-study.ts --out /path/b.jsonl --players person,person-ready --wait 1.5
 *   npx tsx tools/solo-study.ts --out /path/c.jsonl --calling conductor --path a_tempo,upbeat,spotlight,maestro
 *   npx tsx tools/solo-study.ts --report /path/a.jsonl /path/b.jsonl --by kind
 *
 * Players (`--players`, default `skilled,novice`):
 *   novice | skilled | expert   the bots as they are
 *   person         the Skilled bot's play, with a person's hands on the Thread for Solos
 *   person-ready   the same, noticing a Solo only once it is full (the wait alone to react in)
 *   ignore         the Skilled bot with its Solo rule off: a player who never follows a Solo
 *
 * Numbers a run may change (the fight is played with them; nothing is written anywhere):
 *   --wait S  --kael-hold S  --gap S  --tell S   `SOLOS` (src/sim/constants.ts)
 *   --party-hit S  --root-hold S                 the heroes' judgement (0: off)
 *   --gain-scale X                               every Resonance gain times X
 *   --reaction S  --miss X                       the person's hands (tools/person.ts `PERSON`)
 *
 * `--label` names the run in the file (default: the numbers changed, or `built`). `--eager`: a
 * full song is sung at once. `--calling ID --path a,b,c,d`, `--party kael,lyra,vexis`, `--fights`,
 * `--seeds N`, `--seed-base N` as the harness has them.
 *
 * Each fight is one JSON line, appended as it ends, so a restart loses nothing: a cell already in
 * the file is skipped. `--report` prints one line per label, player and group of fights (`--by
 * all | kind | fight | movement`).
 */
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { makeBot, SkilledBot, type Bot, type BotKind } from '../src/bots';
import { CONTENT, encounterDef } from '../src/content';
import { createSim, SOLOS, type Command, type SimConfig, type WorldState } from '../src/sim';
import { crescendoCostOf } from '../src/sim/systems/conducting';
import { defaultKit, kitById, kitConfig } from './kits';
import { PERSON, PersonBot, type PersonOptions } from './person';

/** Two skirmishes (one in the Finale), a mini-boss and the boss of each Movement. */
export const STUDY_FIGHTS: readonly string[] = [
  'tolling_halls',
  'mourning_steps',
  'bellwarden',
  'hollow_cantor',
  'pike_line',
  'leech_warren',
  'gorehound_matriarch',
  'vharun',
  'maw_hollow',
  'mirror_hall',
  'the_seamstress',
  'the_unweaver',
  'the_silent_conductor',
];

export const STUDY_PLAYERS = [
  'novice',
  'skilled',
  'expert',
  'person',
  'person-ready',
  'ignore',
] as const;
export type StudyPlayer = (typeof STUDY_PLAYERS)[number];

const MAX_SECONDS = 9 * 60;

export interface StudyRow {
  label: string;
  fight: string;
  movement: number;
  kind: string;
  player: string;
  seed: number;
  outcome: 'victory' | 'defeat' | 'timeout';
  duration: number;
  downs: number;
  /** Solo charge-ups (a Solo reaching full). */
  charged: number;
  /** Solos the heroes fired Cued, and plain (Grand Finale turns aside). */
  cued: number;
  plain: number;
  /** Solos a Grand Finale turn played. */
  finaleSolos: number;
  /** Solos full and unfired as the fight ended. */
  left: number;
  /** Hero-seconds spent with a full Solo and an enemy to fight, not yet firing. */
  waiting: number;
  crescendos: number;
  /** Resonance gained over the fight, and by what (the trickles that send no event aside). */
  gained: number;
  gains: Record<string, number>;
  partyDamage: number;
  /** By Solo id: [Cued, plain]. */
  solos: Record<string, [number, number]>;
  pulses: number;
  /** The Conductor: Duets and Trios formed, Cued Solos A Tempo paid for (0 without him). */
  duets: number;
  trios: number;
  onBeat: number;
}

/** The numbers a run may change. */
export interface StudyKnobs {
  wait?: number;
  kaelHold?: number;
  gap?: number;
  tell?: number;
  partyHit?: number;
  rootHold?: number;
  gainScale?: number;
}

const SOLO_KNOBS = ['wait', 'kaelHold', 'gap', 'tell', 'partyHit', 'rootHold'] as const;

/**
 * Plays `fn` with the Solo numbers changed, then puts them back. The constants are the sim's own
 * objects: a study run is the one place they are written, and never while anything else plays.
 */
export function withKnobs<T>(knobs: StudyKnobs, fn: () => T): T {
  const solos = SOLOS as { -readonly [K in keyof typeof SOLOS]: number };
  const resonance = CONTENT.resonance as { gainScale: number };
  const before = { ...solos, gainScale: resonance.gainScale };
  try {
    for (const k of SOLO_KNOBS) {
      const v = knobs[k];
      if (v !== undefined) solos[k] = v;
    }
    if (knobs.gainScale !== undefined) resonance.gainScale = knobs.gainScale;
    return fn();
  } finally {
    for (const k of SOLO_KNOBS) solos[k] = before[k];
    resonance.gainScale = before.gainScale;
  }
}

export function studyPlayer(
  player: StudyPlayer,
  seed: number,
  person: Partial<PersonOptions> = {},
): Bot {
  switch (player) {
    case 'person':
      return new PersonBot(seed, { ...PERSON, ...person });
    case 'person-ready':
      return new PersonBot(seed, { ...PERSON, ...person, from: 'ready' }, 'person-ready');
    case 'ignore':
      return new SkilledBot(
        seed,
        { every: 4, attention: 1, callReaction: 0.4, skip: new Set(['soloCue']) },
        'ignore',
      );
    default:
      return makeBot(player as BotKind, seed);
  }
}

/**
 * `--eager`: a full song is sung at once (a player with nothing else to spend it on), where the
 * bot would keep it for trouble. Not in the Silent Conductor's fight, where the bots keep the
 * Crescendo to cancel Fortissimo Silence.
 */
function eager(state: WorldState, commands: Command[]): Command[] {
  const w = state.entities.get(state.weaverId)?.weaver;
  if (!w || state.field.finale || state.encounter.status !== 'fighting') return commands;
  if (w.crescendo > 0 || w.resonance + 1e-9 < crescendoCostOf(state)) return commands;
  if (commands.some((c) => c.t === 'crescendo')) return commands;
  let enemies = 0;
  for (const e of state.entities.list()) if (e.enemy && e.health && !e.health.dead) enemies++;
  return enemies > 0 ? [...commands, { t: 'crescendo' }] : commands;
}

export interface StudySetup {
  calling?: SimConfig['calling'];
  party?: readonly string[];
  eager?: boolean;
  /** The person's hands, where they differ from `PERSON`. */
  person?: Partial<PersonOptions>;
}

/** One fight, on its Movement's kit, as the harness's cells play it. */
export function studyFight(
  label: string,
  fight: string,
  player: StudyPlayer,
  seed: number,
  setup: StudySetup = {},
): StudyRow {
  const def = encounterDef(fight);
  const movement = def.movement ?? 1;
  const config: SimConfig = {
    seed,
    encounter: fight,
    ...kitConfig(kitById(defaultKit(movement))),
    ...(setup.calling ? { calling: setup.calling } : {}),
    ...(setup.party ? { party: setup.party.map((heroId) => ({ heroId })) } : {}),
  };
  const sim = createSim(config);
  const bot = studyPlayer(player, seed, setup.person);
  const row: StudyRow = {
    label,
    fight,
    movement,
    kind: def.kind,
    player,
    seed,
    outcome: 'timeout',
    duration: 0,
    downs: 0,
    charged: 0,
    cued: 0,
    plain: 0,
    finaleSolos: 0,
    left: 0,
    waiting: 0,
    crescendos: 0,
    gained: 0,
    gains: {},
    partyDamage: 0,
    solos: {},
    pulses: 0,
    duets: 0,
    trios: 0,
    onBeat: 0,
  };
  const finaleTurns = new Set<number>();
  for (let t = 0; t < MAX_SECONDS * 60; t++) {
    let commands = bot.decide(sim.state);
    if (setup.eager) commands = eager(sim.state, commands);
    sim.step(commands);
    const events = sim.drainEvents();
    finaleTurns.clear();
    for (const e of events) if (e.type === 'finaleTurn') finaleTurns.add(e.hero);
    for (const e of events) {
      if (e.type === 'soloReady') row.charged++;
      else if (e.type === 'soloStarted') {
        if (finaleTurns.has(e.hero)) {
          row.finaleSolos++;
          continue;
        }
        if (e.cued) row.cued++;
        else row.plain++;
        const s = (row.solos[e.solo] ??= [0, 0]);
        s[e.cued ? 0 : 1]++;
      } else if (e.type === 'resonanceGained') {
        row.gained += e.amount;
        row.gains[e.reason] = (row.gains[e.reason] ?? 0) + e.amount;
      } else if (e.type === 'chorusPulse') row.pulses++;
    }
    const status = sim.state.encounter.status;
    if (status === 'fighting') {
      for (const id of sim.state.party) {
        const e = sim.state.entities.get(id);
        const h = e?.hero;
        if (!e || !h || !e.health || e.health.dead || e.health.downed) continue;
        if (h.solo >= 100 && h.soloActive <= 0 && h.targetId !== null) row.waiting += 1 / 60;
      }
    }
    if (status === 'victory' || status === 'defeat') break;
  }
  const state = sim.state;
  const status = state.encounter.status;
  row.outcome = status === 'victory' ? 'victory' : status === 'defeat' ? 'defeat' : 'timeout';
  row.duration = (state.encounter.endedAt ?? state.time) - state.encounter.startedAt;
  row.downs = state.ledger.downs;
  row.crescendos = state.ledger.crescendos;
  row.partyDamage = state.ledger.partyDamage;
  row.duets = state.ledger.conducting?.duets ?? 0;
  row.trios = state.ledger.conducting?.trios ?? 0;
  row.onBeat = state.ledger.conducting?.freeCues ?? 0;
  for (const id of state.party) {
    const h = state.entities.get(id)?.hero;
    if (h && h.solo >= 100 && h.soloActive <= 0) row.left++;
  }
  return row;
}

function key(r: { label: string; fight: string; player: string; seed: number }): string {
  return `${r.label}|${r.fight}|${r.player}|${r.seed}`;
}

export function loadStudy(path: string): StudyRow[] {
  if (!existsSync(path)) return [];
  return readFileSync(path, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l) as StudyRow);
}

function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN;
}

function fmt(n: number, d = 1): string {
  return Number.isNaN(n) ? '-' : n.toFixed(d);
}

export type StudyGroup = 'all' | 'kind' | 'fight' | 'movement';

/** One line per label, player and group of fights. */
export function studyReport(rows: readonly StudyRow[], by: StudyGroup): string[] {
  const groups = new Map<string, StudyRow[]>();
  for (const r of rows) {
    const g =
      by === 'fight'
        ? r.fight
        : by === 'kind'
          ? r.kind === 'boss' || r.kind === 'miniboss'
            ? 'bosses'
            : 'skirmishes'
          : by === 'movement'
            ? `M${r.movement}`
            : 'all';
    const k = `${r.label}\t${r.player}\t${g}`;
    (groups.get(k) ?? groups.set(k, []).get(k)!).push(r);
  }
  const lines: string[][] = [
    [
      'run',
      'player',
      'fights',
      'n',
      'win%',
      'secs(win)',
      'downs',
      'charged',
      'cued',
      'plain',
      'cued%',
      'left',
      'wait s',
      'crescendos',
      'gained',
      'pulses',
      'duets',
      'trios',
      'on beat',
      'finale solos',
      'dmg/s',
    ],
  ];
  for (const [k, g] of groups) {
    const wins = g.filter((r) => r.outcome === 'victory');
    const cued = g.reduce((s, r) => s + r.cued, 0);
    const fired = cued + g.reduce((s, r) => s + r.plain, 0);
    lines.push([
      ...k.split('\t'),
      String(g.length),
      fmt((100 * wins.length) / g.length, 0),
      fmt(mean(wins.map((r) => r.duration)), 0),
      fmt(mean(g.map((r) => r.downs)), 2),
      fmt(mean(g.map((r) => r.charged))),
      fmt(mean(g.map((r) => r.cued))),
      fmt(mean(g.map((r) => r.plain))),
      fired ? fmt((100 * cued) / fired, 0) : '-',
      fmt(mean(g.map((r) => r.left))),
      fmt(mean(g.map((r) => r.waiting))),
      fmt(mean(g.map((r) => r.crescendos)), 2),
      fmt(mean(g.map((r) => r.gained)), 0),
      fmt(mean(g.map((r) => r.pulses))),
      fmt(mean(g.map((r) => r.duets))),
      fmt(mean(g.map((r) => r.trios))),
      fmt(mean(g.map((r) => r.onBeat))),
      fmt(mean(g.map((r) => r.finaleSolos))),
      fmt(mean(g.map((r) => r.partyDamage / Math.max(1, r.duration))), 0),
    ]);
  }
  const widths = lines[0]!.map((_, i) => Math.max(...lines.map((l) => l[i]!.length)));
  return lines.map((l) =>
    l
      .map((c, i) => c.padEnd(widths[i]!))
      .join('  ')
      .trimEnd(),
  );
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function num(name: string): number | undefined {
  const v = arg(name);
  if (v === undefined) return undefined;
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error(`--${name} ${v}: not a number`);
  return n;
}

function main(): void {
  const reportAt = process.argv.indexOf('--report');
  if (reportAt >= 0) {
    const by = (arg('by') ?? 'all') as StudyGroup;
    const paths = process.argv.slice(reportAt + 1).filter((p) => p.endsWith('.jsonl'));
    for (const line of studyReport(paths.flatMap(loadStudy), by)) console.log(line);
    return;
  }
  const out = arg('out');
  if (!out) throw new Error('--out <file.jsonl>');
  const knobs: StudyKnobs = {};
  const set = (k: keyof StudyKnobs, flag: string): void => {
    const v = num(flag);
    if (v !== undefined) knobs[k] = v;
  };
  set('wait', 'wait');
  set('kaelHold', 'kael-hold');
  set('gap', 'gap');
  set('tell', 'tell');
  set('partyHit', 'party-hit');
  set('rootHold', 'root-hold');
  set('gainScale', 'gain-scale');
  const reaction = num('reaction');
  const miss = num('miss');
  const person: Partial<PersonOptions> = {
    ...(reaction !== undefined ? { reaction } : {}),
    ...(miss !== undefined ? { miss } : {}),
  };
  const changed = Object.entries({ ...knobs, ...person })
    .map(([k, v]) => `${k}=${v}`)
    .join(',');
  const label = arg('label') ?? (changed || 'built');
  const seeds = num('seeds') ?? 6;
  const seedBase = num('seed-base') ?? 1000;
  const fights = (arg('fights') ?? STUDY_FIGHTS.join(',')).split(',');
  const players = (arg('players') ?? 'skilled,novice').split(',') as StudyPlayer[];
  for (const p of players)
    if (!STUDY_PLAYERS.includes(p)) throw new Error(`--players ${p}: one of ${STUDY_PLAYERS}`);
  const callingId = arg('calling');
  const path = arg('path');
  const party = arg('party')?.split(',');
  const setup: StudySetup = {
    ...(callingId
      ? { calling: { id: callingId, ...(path ? { path: path.split(',') } : {}) } }
      : {}),
    ...(party ? { party } : {}),
    eager: process.argv.includes('--eager'),
    person,
  };
  const done = new Set(loadStudy(out).map(key));
  const started = Date.now();
  let played = 0;
  withKnobs(knobs, () => {
    for (const fight of fights)
      for (const player of players)
        for (let i = 0; i < seeds; i++) {
          const seed = seedBase + i * 7919;
          if (done.has(key({ label, fight, player, seed }))) continue;
          appendFileSync(out, `${JSON.stringify(studyFight(label, fight, player, seed, setup))}\n`);
          played++;
        }
  });
  console.log(`${label}: ${played} fights in ${((Date.now() - started) / 1000).toFixed(0)} s`);
}

if (process.argv[1]?.endsWith('solo-study.ts')) main();
