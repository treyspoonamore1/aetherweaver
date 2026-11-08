/**
 * Entity counts and the entity allocator, pinned before summons exist (docs/phase-5e.md, W0a
 * "Characterisation first"; decision: "Summons are a new EntityKind 'summon' … spawned after the
 * party loop only in Oro parties"). For the default party and Brann's parties A, B and C, on the
 * Bellwarden (bare Guardian), Vharun (the arrival kit) and the Silent Conductor (ARRIVAL4_KIT),
 * the Skilled bot plays each fight to its end while every 60 ticks records how many heroes,
 * enemies and dummies stand and the allocator's state (slots, free list, generations: it shapes
 * future ids and iteration order, so a stray spawn moves it). After W0b and W2 these must stay
 * equal: no summon is ever spawned, and no slot is taken, without Oro in the party.
 *
 * Regenerate ONLY when spawning is meant to change for these parties:
 *   WRITE_SUMMON_INERT=1 npx vitest run tests/sim/summonInert.test.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { makeBot } from '../../src/bots';
import { CONDUCTOR } from '../../src/content/crucibleIds';
import { createSim, type SimConfig } from '../../src/sim';
import type { EntityStore } from '../../src/sim/core/entities';
import { StateHasher } from '../../src/sim/core/hash';
import type { World } from '../../src/sim/world';
import { NAMED_PARTIES } from '../../tools/harness';
import { ARRIVAL4_KIT, ARRIVAL_KIT, BARE_KIT, kitConfig } from '../../tools/kits';

const PATH = fileURLToPath(new URL('./summonInert.json', import.meta.url));
const PARTIES = ['default', 'A', 'B', 'C'] as const;
const SEED = 1000;
const EVERY = 60;
/** The harness's cap (tools/harness-core.ts MAX_SECONDS). */
const MAX_TICKS = 9 * 60 * 60;

interface Fight {
  encounter: string;
  config: Omit<SimConfig, 'seed' | 'encounter'>;
}

const FIGHTS: readonly Fight[] = [
  { encounter: 'bellwarden', config: kitConfig(BARE_KIT) },
  { encounter: 'vharun', config: kitConfig(ARRIVAL_KIT) },
  { encounter: CONDUCTOR, config: kitConfig(ARRIVAL4_KIT) },
];

interface Record_ {
  /** Ticks played. */
  ticks: number;
  /** Every 60 ticks: `heroes,enemies,dummies` standing in the store, joined by spaces. */
  counts: string;
  /** The allocator's hash at every sample, hashed together in order. */
  allocator: string;
  /** The most entities alive at once, and the store's slot count at the end. */
  peak: number;
  slots: number;
  /** The sim's hash at the end. */
  final: string;
}

/** Kinds seen across every sample, for the inertness asserts. */
const SEEN = new Set<string>();

function play(party: (typeof PARTIES)[number], fight: Fight): Record_ {
  const sim = createSim({
    seed: SEED,
    encounter: fight.encounter,
    ...fight.config,
    ...(party === 'default' ? {} : { party: [...NAMED_PARTIES[party]!] }),
  });
  const world = sim.state as unknown as World;
  const store = world.entities as unknown as EntityStore;
  const player = makeBot('skilled', SEED);
  const counts: string[] = [];
  const all = new StateHasher();
  let peak = 0;
  let t = 0;
  const sample = () => {
    const by = { hero: 0, enemy: 0, dummy: 0 };
    for (const e of store.list()) {
      SEEN.add(e.kind);
      if (e.kind in by) by[e.kind as keyof typeof by]++;
    }
    counts.push(`${by.hero},${by.enemy},${by.dummy}`);
    const h = new StateHasher();
    store.hashInto(h);
    all.u32(t);
    all.u32(store.count);
    all.u32(parseInt(h.digest().slice(0, 8), 16) >>> 0);
    all.u32(parseInt(h.digest().slice(8), 16) >>> 0);
    expect('summons' in world.internal, `${party} ${fight.encounter} ${t}`).toBe(false);
  };
  for (; t < MAX_TICKS; t++) {
    if (t % EVERY === 0) sample();
    sim.step(player.decide(sim.state));
    sim.drainEvents();
    peak = Math.max(peak, store.count);
    const s = sim.state.encounter.status;
    if (s === 'victory' || s === 'defeat') {
      t++;
      break;
    }
  }
  sample();
  return {
    ticks: t,
    counts: counts.join(' '),
    allocator: all.digest(),
    peak,
    slots: (store as unknown as { slots: unknown[] }).slots.length,
    final: sim.hash(),
  };
}

function current(): Record<string, Record_> {
  const out: Record<string, Record_> = {};
  for (const party of PARTIES)
    for (const fight of FIGHTS) out[`${party}:${fight.encounter}`] = play(party, fight);
  return out;
}

describe('entity counts and the allocator are unchanged (docs/phase-5e.md, W0a)', () => {
  it('default, A, B and C on the Bellwarden, Vharun and the Conductor equal the snapshot', () => {
    SEEN.clear();
    const fresh = current();
    if (process.env.WRITE_SUMMON_INERT) writeFileSync(PATH, JSON.stringify(fresh, null, 1) + '\n');
    const kept = JSON.parse(readFileSync(PATH, 'utf8')) as Record<string, Record_>;
    expect(Object.keys(kept)).toHaveLength(PARTIES.length * FIGHTS.length);
    expect(fresh).toEqual(kept);
    // No summon kind, ever: only the Weaver, heroes, enemies and dummies.
    expect([...SEEN].every((k) => ['weaver', 'hero', 'enemy', 'dummy'].includes(k))).toBe(true);
    expect(SEEN.has('summon')).toBe(false);
  }, 300_000);
});
