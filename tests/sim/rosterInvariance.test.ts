/**
 * The roster leaves the default party alone (docs/phase-5b.md, "Engineering ground rules" 1, 5
 * and 6). Committed before any Brann content lands:
 *
 * - an explicit default party resolves and hashes the same as the implicit one;
 * - no `blood` or `tithe` key appears anywhere in a default-party fight's state;
 * - the key sets of every hero component and every shield a default-party Bellwarden fight
 *   makes in its first 600 ticks equal the committed snapshot (rosterInvariance.keys.json).
 *
 * - two of the Expedition baseline's runs (tools/expedition-baseline.ts, a smoke: the tool's
 *   `--check` plays all ten) still play out equal.
 *
 * Regenerate the snapshot with `UPDATE_ROSTER_KEYS=1 npx vitest run tests/sim/rosterInvariance`
 * only when the default party is meant to gain a key (never in Phase 5b).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { makeBot } from '../../src/bots';
import { CONTENT } from '../../src/content';
import { createSim, type WorldState } from '../../src/sim';
import { NO_MODS } from '../../src/sim/mods';
import { resolveConfig } from '../../src/sim/world';
import {
  EXPEDITION_SEEDS,
  expeditionRun,
  keptExpeditionBaseline,
  projectRun,
} from '../../tools/expedition-baseline';
import { SCENARIO_BELLWARDEN, SCENARIO_CHRONO_SILENCE } from '../../tools/scenarios';

interface KeySnapshot {
  ticks: number;
  /** Per hero (by def id, in slot order): `Object.keys` of its hero component and health. */
  heroes: { defId: string; hero: string[]; health: string[] }[];
  /** Every distinct shield key list seen in those ticks, in first-seen order. */
  shields: string[][];
}

const TICKS = 600;
const path = fileURLToPath(new URL('./rosterInvariance.keys.json', import.meta.url));

/**
 * Keys no default-party fight may carry: Brann's (`blood`, `tithe`, docs/phase-5b.md), Seren's
 * and Oro's (docs/phase-5e.md: `duel`, `grove`, `summon`, `summons`, `parried`,
 * `rootImmuneUntil`, `ancient`), the Conductor's (docs/phase-5f.md: `conducting`, `cuePower`)
 * and Phase 5g's (docs/phase-5g.md: each absent unless its motif or relic is held). A
 * `parent.key` entry names a key under that parent only (`relics.triggers`, the relics' own tally,
 * is always there; `internal.triggers` and `ledger.triggers` are the trigger system's).
 */
const FORBIDDEN = new Set([
  'blood',
  'tithe',
  'duel',
  'grove',
  'summon',
  'summons',
  'parried',
  'rootImmuneUntil',
  'ancient',
  'conducting',
  'cuePower',
  'internal.triggers',
  'ledger.triggers',
  'razorAt',
  'lullabyReady',
  'waterClockUsed',
  'needleUntil',
  'lastCastAt',
  'restPaid',
  'spareUsed',
  'chimeCharges',
  'chimeRecharge',
  'ringing',
]);

/** The key paths named in FORBIDDEN anywhere under `value`. */
function forbiddenKeys(value: unknown, at: string, out: string[], seen: Set<unknown>): void {
  if (value === null || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  if (value instanceof Map) {
    for (const [k, v] of value) forbiddenKeys(v, `${at}.${String(k)}`, out, seen);
    return;
  }
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (FORBIDDEN.has(k) || FORBIDDEN.has(`${at.split('.').at(-1)}.${k}`)) out.push(`${at}.${k}`);
    if (typeof v !== 'function') forbiddenKeys(v, `${at}.${k}`, out, seen);
  }
}

function stateKeys(state: WorldState): string[] {
  const out: string[] = [];
  const seen = new Set<unknown>();
  for (const e of state.entities.list()) forbiddenKeys(e, `entity${e.id}`, out, seen);
  for (const k of [
    'telegraphs',
    'chimes',
    'field',
    'encounter',
    'ledger',
    'relics',
    'internal',
  ] as const)
    forbiddenKeys((state as unknown as Record<string, unknown>)[k], k, out, seen);
  return out;
}

function bellwardenKeys(): { snapshot: KeySnapshot; forbidden: string[] } {
  const s = SCENARIO_BELLWARDEN;
  const sim = createSim({ seed: s.seed, ...s.config });
  const drive = s.driver();
  const shields: string[][] = [];
  const seen = new Set<string>();
  const forbidden: string[] = [];
  for (let t = 0; t < TICKS; t++) {
    sim.step(drive(t, sim.state));
    sim.drainEvents();
    for (const e of sim.state.entities.list())
      for (const shield of e.health?.shields ?? []) {
        const keys = Object.keys(shield);
        const id = keys.join(',');
        if (!seen.has(id)) {
          seen.add(id);
          shields.push(keys);
        }
      }
    if (t % 60 === 59) forbidden.push(...stateKeys(sim.state));
  }
  const heroes = sim.state.party.map((id) => {
    const e = sim.state.entities.get(id)!;
    return {
      defId: e.hero!.defId,
      hero: Object.keys(e.hero!),
      health: Object.keys(e.health!),
    };
  });
  return { snapshot: { ticks: TICKS, heroes, shields }, forbidden };
}

describe('the default party is invariant under the roster (docs/phase-5b.md)', () => {
  it('an explicit default party resolves and hashes like the implicit one', () => {
    expect(CONTENT.defaultParty).toEqual(['kael', 'lyra', 'vexis']);
    for (const encounter of ['first_light', 'bellwarden', 'crimson_gate']) {
      const implicit = resolveConfig({ seed: 11, encounter });
      const explicit = resolveConfig({ seed: 11, encounter, party: [...CONTENT.defaultParty] });
      expect(explicit, encounter).toStrictEqual(implicit);
      const a = createSim({ seed: 11, encounter });
      const b = createSim({ seed: 11, encounter, party: ['kael', 'lyra', 'vexis'] });
      const botA = makeBot('skilled', 11);
      const botB = makeBot('skilled', 11);
      for (let t = 0; t < 300; t++) {
        a.step(botA.decide(a.state));
        b.step(botB.decide(b.state));
      }
      expect(b.hash(), encounter).toBe(a.hash());
    }
  });

  it('no forbidden roster key exists, and the hero and shield key sets match the snapshot', () => {
    const { snapshot, forbidden } = bellwardenKeys();
    expect(forbidden).toEqual([]);
    expect(snapshot.heroes.map((h) => h.defId)).toEqual(['kael', 'lyra', 'vexis']);
    expect(snapshot.shields.length).toBeGreaterThan(0);
    if (process.env.UPDATE_ROSTER_KEYS)
      writeFileSync(path, JSON.stringify(snapshot, null, 1) + '\n');
    const kept = JSON.parse(readFileSync(path, 'utf8')) as KeySnapshot;
    expect(snapshot).toEqual(kept);
  });

  it("the Conductor's keys are absent from the Chronomancer's golden and a Luminary fight", () => {
    // docs/phase-5f.md W1: `field.conducting`, `ledger.conducting` and `PendingHit.cuePower`.
    const luminary = {
      ...SCENARIO_BELLWARDEN,
      config: {
        ...SCENARIO_BELLWARDEN.config,
        calling: { id: 'luminary', path: ['haloed', 'dawnward', 'third_voice', 'eclipse'] },
      },
    };
    for (const s of [SCENARIO_CHRONO_SILENCE, luminary]) {
      const sim = createSim({ seed: s.seed, debug: true, ...s.config });
      const drive = s.driver();
      const found: string[] = [];
      for (let t = 0; t < Math.min(s.ticks, TICKS * 3); t++) {
        sim.step(drive(t, sim.state));
        sim.drainEvents();
        if (t % 60 === 59)
          found.push(...stateKeys(sim.state).filter((k) => /conducting|cuePower/.test(k)));
      }
      expect(found, s.name).toEqual([]);
      expect(sim.state.calling).not.toHaveProperty('conducting');
    }
  });

  it("NO_MODS holds Brann's motif numbers at 0", () => {
    expect(NO_MODS.bloodTithe).toBe(0);
    expect(NO_MODS.bloodTitheRefund).toBe(0);
    expect(NO_MODS.bloodAndSilk).toBe(0);
  });

  it("NO_MODS holds Seren's and Oro's motif numbers at 0 (docs/phase-5e.md)", () => {
    expect(NO_MODS.enGarde).toBe(0);
    expect(NO_MODS.verdantChoir).toBe(0);
  });

  it('two Expedition baseline runs still play out equal (a smoke of the tool)', () => {
    const kept = keptExpeditionBaseline();
    expect(kept.runs).toHaveLength(2 * EXPEDITION_SEEDS);
    // The first Novice run and the first Skilled run.
    for (const [bot, index] of [
      ['novice', 0],
      ['skilled', EXPEDITION_SEEDS],
    ] as const) {
      const fresh = projectRun(expeditionRun(bot, 0), kept.runs[index]);
      expect(fresh, bot).toEqual(kept.runs[index]);
    }
    // Two whole runs: about 3 s alone, past vitest's 5 s default on a loaded machine.
  }, 60_000);
});
