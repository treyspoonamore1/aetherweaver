/**
 * The Solo study (round 11): how Solos, Cues and Resonance are used in real fights, by the Novice
 * and the Skilled bot, today and under the prototype rules of `src/sim/soloProto.ts`.
 *
 *   npx tsx tools/solo-study.ts --variant today --seeds 12 --out /path/today.jsonl
 *   npx tsx tools/solo-study.ts --variant nocue-auto --seeds 12 --out /path/x.jsonl
 *   npx tsx tools/solo-study.ts --variant thread --lead --seeds 12 --out /path/y.jsonl
 *   npx tsx tools/solo-study.ts --report /path/a.jsonl /path/b.jsonl
 *
 * Variants (the rules a fight is played by):
 *   today        as shipped: Hero autonomy off, the bot Cues as it does
 *   today-auto   Hero autonomy on, the bot Cues
 *   nocue        autonomy off, every Cue the bot sends is dropped (a player who never Cues)
 *   nocue-auto   autonomy on, Cues dropped (a player who leaves it to the heroes)
 *   thread | always | empower | field | pay   a prototype rule (soloProto.ts); Cues are dropped
 *
 * `--lead`: the bot swings the Thread to a hero whose Solo is about to fire (and into Empower
 * under `empower`), unless someone needs the Thread more. It is a wrapper around the bot's
 * commands, here in the tool; the bots themselves are untouched.
 *
 * Each fight is one JSON line, appended as it ends, so a restart loses nothing: a cell already in
 * the file is skipped.
 */
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { makeBot, type BotKind } from '/home/user/aw-work/wt-p11solo/src/bots';
import { encounterDef } from '/home/user/aw-work/wt-p11solo/src/content';
import {
  createSim,
  type Command,
  type PartySlot,
  type SimConfig,
  type WorldState,
} from '/home/user/aw-work/wt-p11solo/src/sim';
import { crescendoCostOf } from '/home/user/aw-work/wt-p11solo/src/sim/systems/conducting';
import { defaultKit, kitById, kitConfig } from '/home/user/aw-work/wt-p11solo/tools/kits';

/** A skirmish (two in Movements I-III), a mini-boss and the boss of each Movement. */
const FIGHTS: readonly string[] = [
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

const MAX_SECONDS = 9 * 60;

interface Row {
  variant: string;
  fight: string;
  movement: number;
  kind: string;
  bot: string;
  seed: number;
  outcome: 'victory' | 'defeat' | 'timeout';
  duration: number;
  downs: number;
  /** Solo charge-ups (a Solo reaching full). */
  charged: number;
  /** Solos fired in the stronger form, by a Cue or by the prototype's rule. */
  strong: number;
  /** Solos fired in the plain form. */
  plain: number;
  /** Solos a Grand Finale turn played (not charge-ups). */
  finaleSolos: number;
  /** Solos full and unfired as the fight ended. */
  left: number;
  /** Hero-seconds spent standing with a full Solo and an enemy to fight, not firing. */
  waiting: number;
  cueSpent: number;
  crescendoSpent: number;
  cues: number;
  crescendos: number;
  gained: number;
  partyDamage: number;
  /** By Solo id: [strong, plain]. */
  solos: Record<string, [number, number]>;
  /** Of the Solos fired (Finale turns aside), those with the Thread on the hero as they fired. */
  onThread: number;
  /** Chorus pulses released. */
  pulses: number;
  /** The Conductor Calling: Duets and Trios formed (0 without it). */
  duets: number;
  trios: number;
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

/**
 * The `--eager` wrapper: a full song is sung at once (a player with nothing else to spend it on),
 * where the bot would keep it for trouble. Not in the Silent Conductor's fight, where the bots
 * keep the Crescendo to cancel Fortissimo Silence.
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

function play(
  variant: string,
  fight: string,
  bot: BotKind,
  seed: number,
  leading: boolean,
  eagerly: boolean,
  calling: SimConfig['calling'] | undefined,
  party: string[] | undefined,
): Row {
  const def = encounterDef(fight);
  const movement = def.movement ?? 1;
  const kit = kitConfig(kitById(defaultKit(movement)));
  const dropThread = variant === 'nothread';
  const config: SimConfig = {
    seed,
    encounter: fight,
    ...kit,
    ...(calling ? { calling } : {}),
    ...(party ? { party: party.map((heroId) => ({ heroId })) } : {}),
  };
  const sim = createSim(config);
  const player = makeBot(bot, seed);
  const row: Row = {
    variant,
    fight,
    movement,
    kind: def.kind,
    bot,
    seed,
    outcome: 'timeout',
    duration: 0,
    downs: 0,
    charged: 0,
    strong: 0,
    plain: 0,
    finaleSolos: 0,
    left: 0,
    waiting: 0,
    cueSpent: 0,
    crescendoSpent: 0,
    cues: 0,
    crescendos: 0,
    gained: 0,
    partyDamage: 0,
    solos: {},
    onThread: 0,
    pulses: 0,
    duets: 0,
    trios: 0,
  };
  const finaleTurns = new Set<string>();
  for (let t = 0; t < MAX_SECONDS * 60; t++) {
    let commands = player.decide(sim.state);
    if (dropThread) commands = commands.filter((c) => c.t !== 'thread');
    void leading;
    if (eagerly) commands = eager(sim.state, commands);
    const threadBefore = sim.state.entities.get(sim.state.weaverId)?.weaver?.threadSlot ?? null;
    sim.step(commands);
    const events = sim.drainEvents();
    finaleTurns.clear();
    for (const e of events) if (e.type === 'finaleTurn') finaleTurns.add(`${e.hero}`);
    for (const e of events) {
      if (e.type === 'soloReady') row.charged++;
      else if (e.type === 'soloStarted') {
        if (finaleTurns.has(`${e.hero}`)) {
          row.finaleSolos++;
          continue;
        }
        if (e.cued) row.strong++;
        else row.plain++;
        const s = (row.solos[e.solo] ??= [0, 0]);
        s[e.cued ? 0 : 1]++;
        const slot = sim.state.party.indexOf(e.hero);
        const now = sim.state.entities.get(sim.state.weaverId)?.weaver?.threadSlot ?? null;
        if (slot === threadBefore || slot === now) row.onThread++;
      } else if (e.type === 'resonanceSpent') {
        if (e.on === 'cue') row.cueSpent += e.amount;
        else row.crescendoSpent += e.amount;
      } else if (e.type === 'resonanceGained') row.gained += e.amount;
      else if (e.type === 'chorusPulse') row.pulses++;
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
  row.cues = state.ledger.cues;
  row.crescendos = state.ledger.crescendos;
  row.partyDamage = state.ledger.partyDamage;
  row.duets = state.ledger.conducting?.duets ?? 0;
  row.trios = state.ledger.conducting?.trios ?? 0;
  for (const id of state.party) {
    const h = state.entities.get(id)?.hero;
    if (h && h.solo >= 100 && h.soloActive <= 0) row.left++;
  }
  return row;
}

function key(r: { variant: string; fight: string; bot: string; seed: number }): string {
  return `${r.variant}|${r.fight}|${r.bot}|${r.seed}`;
}

function load(path: string): Row[] {
  if (!existsSync(path)) return [];
  return readFileSync(path, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l) as Row);
}

function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN;
}

function fmt(n: number, d = 1): string {
  return Number.isNaN(n) ? '-' : n.toFixed(d);
}

/** One line per variant, bot and group of fights. */
function report(paths: string[], by: 'all' | 'kind' | 'fight' | 'movement'): void {
  const rows = paths.flatMap(load);
  const groups = new Map<string, Row[]>();
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
    const k = `${r.variant}\t${r.bot}\t${g}`;
    (groups.get(k) ?? groups.set(k, []).get(k)!).push(r);
  }
  const lines: string[][] = [];
  lines.push([
    'variant',
    'bot',
    'fights',
    'n',
    'win%',
    'secs(win)',
    'downs',
    'charged',
    'strong',
    'plain',
    'left',
    'wait s',
    'strong%',
    'onThread%',
    'cue Res',
    'cresc Res',
    'crescendos',
    'gained',
    'pulses',
    'duets',
    'trios',
    'finaleSolos',
    'dmg/s',
  ]);
  for (const [k, g] of groups) {
    const wins = g.filter((r) => r.outcome === 'victory');
    const fired = g.reduce((s, r) => s + r.strong + r.plain, 0);
    lines.push([
      ...k.split('\t'),
      String(g.length),
      fmt((100 * wins.length) / g.length, 0),
      fmt(mean(wins.map((r) => r.duration)), 0),
      fmt(mean(g.map((r) => r.downs)), 2),
      fmt(mean(g.map((r) => r.charged))),
      fmt(mean(g.map((r) => r.strong))),
      fmt(mean(g.map((r) => r.plain))),
      fmt(mean(g.map((r) => r.left))),
      fmt(mean(g.map((r) => r.waiting))),
      fired ? fmt((100 * g.reduce((s, r) => s + r.strong, 0)) / fired, 0) : '-',
      fired ? fmt((100 * g.reduce((s, r) => s + r.onThread, 0)) / fired, 0) : '-',
      fmt(mean(g.map((r) => r.cueSpent)), 0),
      fmt(mean(g.map((r) => r.crescendoSpent)), 0),
      fmt(mean(g.map((r) => r.crescendos)), 2),
      fmt(mean(g.map((r) => r.gained)), 0),
      fmt(mean(g.map((r) => r.pulses)), 1),
      fmt(mean(g.map((r) => r.duets ?? 0)), 1),
      fmt(mean(g.map((r) => r.trios ?? 0)), 1),
      fmt(mean(g.map((r) => r.finaleSolos)), 1),
      fmt(mean(g.map((r) => r.partyDamage / Math.max(1, r.duration))), 0),
    ]);
  }
  const widths = lines[0]!.map((_, i) => Math.max(...lines.map((l) => l[i]!.length)));
  for (const l of lines) console.log(l.map((c, i) => c.padEnd(widths[i]!)).join('  '));
}

function main(): void {
  const reportAt = process.argv.indexOf('--report');
  if (reportAt >= 0) {
    const by = (arg('by') ?? 'all') as 'all' | 'kind' | 'fight' | 'movement';
    const paths = process.argv.slice(reportAt + 1).filter((p) => p.endsWith('.jsonl'));
    report(paths, by);
    return;
  }
  const variant = arg('variant') ?? 'today';
  const label = arg('label') ?? variant;
  const seeds = Number(arg('seeds') ?? 6);
  const seedBase = Number(arg('seed-base') ?? 1000);
  const out = arg('out');
  if (!out) throw new Error('--out <file.jsonl>');
  const fights = (arg('fights') ?? FIGHTS.join(',')).split(',');
  const bots = (arg('bots') ?? 'skilled,novice').split(',') as BotKind[];
  const leading = process.argv.includes('--lead');
  const eagerly = process.argv.includes('--eager');
  const callingId = arg('calling');
  const path = arg('path');
  const party = arg('party')?.split(',');
  const calling = callingId
    ? { id: callingId, ...(path ? { path: path.split(',') } : {}) }
    : undefined;
  const done = new Set(load(out).map(key));
  const started = Date.now();
  let played = 0;
  for (const fight of fights)
    for (const bot of bots)
      for (let i = 0; i < seeds; i++) {
        const seed = seedBase + i * 7919;
        if (done.has(key({ variant: label, fight, bot, seed }))) continue;
        const row = play(variant, fight, bot, seed, leading, eagerly, calling, party);
        row.variant = label;
        appendFileSync(out, `${JSON.stringify(row)}\n`);
        played++;
      }
  console.log(`${label}: ${played} fights in ${((Date.now() - started) / 1000).toFixed(0)} s`);
}

main();
