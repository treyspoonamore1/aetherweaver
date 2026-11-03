/**
 * Movement I is bit-for-bit unchanged by Phase 5a (docs/phase-5a.md, "the Movement I
 * contract"). The five Movement I golden hashes are pinned here as literals, so they can't
 * drift through `npm run golden:update`; only new scenarios and `contentVersion` may change.
 */
import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../src/content';
import { createSim } from '../../src/sim';
import { SIM_VERSION } from '../../src/sim/constants';
import { parseReplay } from '../../src/sim/replay';
import { resolveConfig } from '../../src/sim/world';
import { runScenario } from '../../tools/runScenario';
import { SCENARIOS } from '../../tools/scenarios';
import golden from './golden.json';

const M1_HASHES: Readonly<Record<string, string>> = {
  patrol: '2626acee5ce8d584',
  crowd: '323bd3a88aea3f1b',
  'skilled-first-light': '905754ea95eb27ac',
  'skilled-bellwarden': '9ff673296b5779d5',
  'novice-cantor': 'ef492fba9d6c91ec',
};

describe('Movement I is unchanged (docs/phase-5a.md)', () => {
  it('SIM_VERSION is still 22', () => {
    expect(SIM_VERSION).toBe(22);
    expect(golden.simVersion).toBe(22);
  });

  it('golden.json still holds the five Movement I hashes', () => {
    for (const [name, hash] of Object.entries(M1_HASHES))
      expect((golden.scenarios as Record<string, string>)[name], name).toBe(hash);
  });

  for (const [name, hash] of Object.entries(M1_HASHES))
    it(`scenario "${name}" reproduces its Movement I hash`, () => {
      const scenario = SCENARIOS.find((s) => s.name === name);
      expect(scenario, name).toBeDefined();
      expect(runScenario(scenario!).hash).toBe(hash);
    });

  it('a Movement I config hashes the same with or without movement {1, 1}', () => {
    for (const encounter of ['first_light', 'bellwarden', 'hollow_cantor']) {
      const plain = resolveConfig({ seed: 7, encounter });
      const unit = resolveConfig({ seed: 7, encounter, movement: { life: 1, damage: 1 } });
      expect('movement' in plain, encounter).toBe(false);
      expect('movement' in unit, encounter).toBe(false);
      expect(unit).toStrictEqual(plain);
      const a = createSim({ seed: 7, encounter });
      const b = createSim({ seed: 7, encounter, movement: { life: 1, damage: 1 } });
      for (let t = 0; t < 120; t++) {
        a.step();
        b.step();
      }
      expect(b.hash(), encounter).toBe(a.hash());
    }
  });

  it('a Movement scale override is kept, and survives a replay round-trip', () => {
    const resolved = resolveConfig({
      seed: 7,
      encounter: 'first_light',
      movement: { life: 1.29, damage: 0.94 },
    });
    expect(resolved.movement).toEqual({ life: 1.29, damage: 0.94 });
    expect(resolveConfig(resolved)).toStrictEqual(resolved);
    const sim = createSim({ seed: 7, encounter: 'first_light' });
    expect('movement' in sim.config).toBe(false);
    expect(() =>
      parseReplay({
        format: 'aetherweaver-replay',
        version: 6,
        simVersion: SIM_VERSION,
        contentVersion: 'x',
        config: resolved,
        frames: [],
        finalTick: 1,
        finalHash: 'x',
      }),
    ).not.toThrow();
  });

  it('Movement I content gains no keys: every new field is absent on it', () => {
    const later = (m: number | undefined) => m === undefined || m >= 2;
    const m1Enemies = CONTENT.enemies.filter((e) => e.movement === undefined);
    for (const e of CONTENT.enemies) expect(later(e.movement), e.id).toBe(true);
    for (const e of m1Enemies) {
      for (const k of ['guard', 'material']) expect(k in e, `${e.id}.${k}`).toBe(false);
      expect('onHit' in e.basic, `${e.id}.basic.onHit`).toBe(false);
    }
    const m1Attacks = new Set(m1Enemies.flatMap((e) => e.specials));
    for (const a of CONTENT.attacks.filter((x) => m1Attacks.has(x.id))) {
      for (const k of [
        'markStatus',
        'linkStatus',
        'move',
        'centre',
        'fullLength',
        'followUp',
        'scripted',
        'executeBelow',
      ])
        expect(k in a, `${a.id}.${k}`).toBe(false);
      if (a.status) expect(Object.keys(a.status).sort(), a.id).toEqual(['duration', 'id']);
      if (a.summon) expect('maxAlive' in a.summon, a.id).toBe(false);
    }
    for (const f of CONTENT.affixes) {
      expect(later(f.movement), f.id).toBe(true);
      if (f.movement === undefined) expect('onHit' in f, `${f.id}.onHit`).toBe(false);
    }
    const m1Encounters = CONTENT.encounters.filter((e) => e.movement === undefined);
    for (const e of CONTENT.encounters) expect(later(e.movement), e.id).toBe(true);
    const m1Arenas = new Set(m1Encounters.map((e) => e.arena));
    for (const a of CONTENT.arenas.filter((x) => m1Arenas.has(x.id)))
      expect('biome' in a, a.id).toBe(false);
    for (const e of CONTENT.events) expect(later(e.movement), e.id).toBe(true);
    expect(CONTENT.movements[0]!.scale).toEqual({ life: 1, damage: 1 });
  });
});
