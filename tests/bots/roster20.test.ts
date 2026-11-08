/**
 * Every party of the six-hero roster plays (docs/phase-5e.md, "Tests: Bots"): all 20 parties of
 * three, the Skilled and Novice bots, on First Light (bare), Vharun (the arrival kit), the
 * Unweaver (ARRIVAL3_KIT) and the Silent Conductor (ARRIVAL4_KIT), each fight played whole (to
 * its end or the harness's 9-minute cap), twice: the command streams, what the fight showed and
 * the final sim hash are the same both times, and nothing throws. Played whole, the Unweaver's
 * later phases and the Conductor's Grand Silence and Fortissimo Silence come up with Seren and
 * with Oro standing, so the roster rules meet the silence rules (silenceWard, silenceReel,
 * silenceThread, fortissimoGuard against serenParryWard, serenReel, oroThread, oroRally); the
 * test checks that they did. An explicit default party issues exactly the commands the implicit
 * one does. (The committed command snapshots, commandSnapshot*.test.ts, pin the default and
 * Brann parties' streams.)
 */
import { describe, expect, it } from 'vitest';
import { makeBot, type BotKind } from '../../src/bots';
import { CONTENT } from '../../src/content';
import { CONDUCTOR } from '../../src/content/crucibleIds';
import { createSim, type SimConfig, type WorldState } from '../../src/sim';
import { StateHasher, hashValue } from '../../src/sim/core/hash';
import { ARRIVAL3_KIT, ARRIVAL4_KIT, ARRIVAL_KIT, BARE_KIT, kitConfig } from '../../tools/kits';

const BOTS: readonly BotKind[] = ['skilled', 'novice'];
const SEED = 1000;
/** The default party is cheap to play: it takes a second seed. */
const DEFAULT_SEEDS = [1000, 8919];
/** The harness's cap (tools/harness-core.ts MAX_SECONDS). */
const MAX_TICKS = 9 * 60 * 60;

interface Fight {
  encounter: string;
  config: Omit<SimConfig, 'seed' | 'encounter'>;
}

const FIRST_LIGHT: Fight = { encounter: 'first_light', config: kitConfig(BARE_KIT) };
const VHARUN: Fight = { encounter: 'vharun', config: kitConfig(ARRIVAL_KIT) };
const UNWEAVER: Fight = { encounter: 'the_unweaver', config: kitConfig(ARRIVAL3_KIT) };
const FINALE: Fight = { encounter: CONDUCTOR, config: kitConfig(ARRIVAL4_KIT) };
const FIGHTS: readonly Fight[] = [FIRST_LIGHT, VHARUN, UNWEAVER, FINALE];

/** Every party of three from the roster, in content (slot) order. */
function parties(): string[][] {
  const ids = CONTENT.heroes.map((h) => h.id);
  const out: string[][] = [];
  for (let a = 0; a < ids.length; a++)
    for (let b = a + 1; b < ids.length; b++)
      for (let c = b + 1; c < ids.length; c++) out.push([ids[a]!, ids[b]!, ids[c]!]);
  return out;
}

/** Ticks a fight spent in each moment the roster rules meet, by who was standing. */
interface Seen {
  /** The boss's highest phase. */
  phase: number;
  /** Ticks of the Grand Silence with Seren, and with Oro, standing (not fallen). */
  silenceSeren: number;
  silenceOro: number;
  /** Ticks of Fortissimo Silence with Seren, and with Oro, standing. */
  fortissimoSeren: number;
  fortissimoOro: number;
}

interface StreamRecord {
  commands: string;
  count: number;
  status: string;
  ticks: number;
  seen: Seen;
  final: string;
}

/** The hero `defId` is in the party and has not fallen for good. */
function standing(state: WorldState, defId: string): boolean {
  for (const id of state.party) {
    const e = state.entities.get(id);
    if (e?.hero?.defId === defId) return !e.health!.dead;
  }
  return false;
}

function stream(party: string[] | null, bot: BotKind, fight: Fight, seed: number): StreamRecord {
  const sim = createSim({
    seed,
    encounter: fight.encounter,
    ...fight.config,
    ...(party ? { party } : {}),
  });
  const player = makeBot(bot, seed);
  const h = new StateHasher();
  const seen: Seen = {
    phase: 0,
    silenceSeren: 0,
    silenceOro: 0,
    fortissimoSeren: 0,
    fortissimoOro: 0,
  };
  let count = 0;
  let t = 0;
  for (; t < MAX_TICKS; t++) {
    const commands = player.decide(sim.state);
    if (commands.length > 0) {
      h.u32(t);
      hashValue(h, commands);
      count += commands.length;
    }
    sim.step(commands);
    sim.drainEvents();
    const s = sim.state;
    const boss = s.encounter.bossId !== null ? s.entities.get(s.encounter.bossId) : undefined;
    if (boss?.enemy) seen.phase = Math.max(seen.phase, boss.enemy.phase);
    const finale = s.field.finale;
    if (finale?.silence || finale?.fortissimo) {
      const seren = standing(s, 'seren');
      const oro = standing(s, 'oro');
      if (finale.silence && seren) seen.silenceSeren++;
      if (finale.silence && oro) seen.silenceOro++;
      if (finale.fortissimo && seren) seen.fortissimoSeren++;
      if (finale.fortissimo && oro) seen.fortissimoOro++;
    }
    const status = s.encounter.status;
    if (status === 'victory' || status === 'defeat') break;
  }
  return {
    commands: h.digest(),
    count,
    status: sim.state.encounter.status,
    ticks: t,
    seen,
    final: sim.hash(),
  };
}

/** Each party's first run of `fight` with `bot`, checked against a second. */
function playAll(fight: Fight, bot: BotKind): Map<string, StreamRecord> {
  const out = new Map<string, StreamRecord>();
  for (const party of parties()) {
    const key = `${party.join(',')}:${bot}:${fight.encounter}`;
    const a = stream(party, bot, fight, SEED);
    expect(a.count, key).toBeGreaterThan(0);
    expect(stream(party, bot, fight, SEED), key).toEqual(a);
    out.set(party.join(','), a);
  }
  return out;
}

/** The records of the parties holding `hero`. */
function withHero(runs: Map<string, StreamRecord>, hero: string): StreamRecord[] {
  return [...runs].filter(([p]) => p.split(',').includes(hero)).map(([, r]) => r);
}

const sum = (rs: StreamRecord[], f: (s: Seen) => number) => rs.reduce((n, r) => n + f(r.seen), 0);

describe('every roster party plays (docs/phase-5e.md)', () => {
  it('names all 20 parties of three, each with Seren or Oro in 16 of them', () => {
    const all = parties();
    expect(all).toHaveLength(20);
    expect(new Set(all.map((p) => p.join())).size).toBe(20);
    expect(all.filter((p) => p.includes('seren') || p.includes('oro'))).toHaveLength(16);
  });

  for (const bot of BOTS) {
    for (const fight of [FIRST_LIGHT, VHARUN])
      it(`all 20 parties play ${fight.encounter} whole with the ${bot} bot, deterministically`, () => {
        const runs = playAll(fight, bot);
        // Whole fights: every one of them ends inside the cap, but SO's Skilled Vharun. SO
        // (Kael, Seren, Oro) is the damage-light party the bands print (docs/phase-5e.md, "W9
        // tuning round 1"): since round 1 its grove holds long enough to carry this seed to the
        // cap, a loss either way. It still plays to the cap, deterministically (above).
        for (const [p, r] of runs) {
          if (bot === 'skilled' && fight === VHARUN && p === 'kael,seren,oro') {
            if (r.status === 'fighting') expect(r.ticks, p).toBe(MAX_TICKS);
            continue;
          }
          expect(r.status, p).not.toBe('fighting');
        }
      }, 600_000);

    it(`all 20 parties play the_unweaver whole with the ${bot} bot, deterministically`, () => {
      const runs = playAll(UNWEAVER, bot);
      // The Unweaver's later phases come up with Seren and with Oro in the party.
      for (const hero of ['seren', 'oro'])
        expect(
          Math.max(...withHero(runs, hero).map((r) => r.seen.phase)),
          `${bot}:${hero}`,
        ).toBeGreaterThanOrEqual(bot === 'skilled' ? 3 : 2);
    }, 600_000);

    it(`all 20 parties play the Conductor whole with the ${bot} bot, deterministically`, () => {
      const runs = playAll(FINALE, bot);
      const seren = withHero(runs, 'seren');
      const oro = withHero(runs, 'oro');
      // Fortissimo Silence plays over a standing Seren and a standing Oro.
      expect(
        sum(seren, (s) => s.fortissimoSeren),
        bot,
      ).toBeGreaterThan(0);
      expect(
        sum(oro, (s) => s.fortissimoOro),
        bot,
      ).toBeGreaterThan(0);
      // The Skilled bot carries them to the Grand Silence, both standing (the Novice falls in
      // the earlier phases).
      if (bot === 'skilled') {
        expect(sum(seren, (s) => s.silenceSeren)).toBeGreaterThan(0);
        expect(sum(oro, (s) => s.silenceOro)).toBeGreaterThan(0);
        for (const r of [...seren, ...oro]) expect(r.seen.phase).toBeGreaterThanOrEqual(2);
      }
    }, 600_000);
  }

  it('an explicit default party issues the same commands as the implicit one', () => {
    for (const fight of FIGHTS)
      for (const bot of BOTS)
        for (const seed of DEFAULT_SEEDS)
          expect(
            stream([...CONTENT.defaultParty], bot, fight, seed),
            `${fight.encounter}:${bot}:${seed}`,
          ).toEqual(stream(null, bot, fight, seed));
  }, 600_000);
});
