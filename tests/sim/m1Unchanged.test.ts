/**
 * Movement I is bit-for-bit unchanged by Phase 5a (docs/phase-5a.md, "the Movement I
 * contract"), every default-party run by Phase 5b (docs/phase-5b.md, "Engineering ground
 * rules"), and Movements I and II and Brann's three fights by Phase 5c (docs/phase-5c.md,
 * ground rule 1). All eleven golden hashes are pinned here as literals, so they can't drift
 * through `npm run golden:update`; only new scenarios and `contentVersion` may change. Movement
 * III's four goldens are pinned beside them at the slice's hand-off, for the Finale slice.
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

/** Movement II's three default-party goldens (docs/phase-5b.md: pinned before Brann lands). */
const M2_HASHES: Readonly<Record<string, string>> = {
  'skilled-crimson-gate': '33de216e886e4fae',
  'novice-matriarch': 'c189c9db37b9b5f0',
  'skilled-vharun': '0d468d6046318cd6',
};

/** Brann's three goldens (docs/phase-5c.md, W0a: pinned before any Movement III content lands). */
const BRANN_HASHES: Readonly<Record<string, string>> = {
  'skilled-brann-crimson-gate': '5831f3df358d5c5d',
  'skilled-brann-bellwarden': '10e99af8f2dd8003',
  'novice-brann-first-light': '9ba4ea40f94cd1aa',
};

const PINNED: Readonly<Record<string, string>> = { ...M1_HASHES, ...M2_HASHES, ...BRANN_HASHES };

/** Movement III's four goldens (docs/phase-5c.md, "Hand-off": pinned for the Finale slice). */
const M3_HASHES: Readonly<Record<string, string>> = {
  'skilled-unstitched-threshold': 'f72dc5e1b03025cf',
  'novice-seamstress': 'c379707e6d0dab69',
  'skilled-unweaver': '63e8f91b068c4bad',
  'skilled-brann-mirror-hall': '34359b7e914cfd05',
};

/** All fifteen goldens, in golden.json's order. */
const ALL_PINNED: Readonly<Record<string, string>> = { ...PINNED, ...M3_HASHES };

describe('Movement I is unchanged (docs/phase-5a.md)', () => {
  it('SIM_VERSION is still 22', () => {
    expect(SIM_VERSION).toBe(22);
    expect(golden.simVersion).toBe(22);
  });

  it('golden.json still holds the eleven pinned hashes', () => {
    expect(Object.keys(PINNED)).toHaveLength(11);
    for (const [name, hash] of Object.entries(PINNED))
      expect((golden.scenarios as Record<string, string>)[name], name).toBe(hash);
  });

  it('golden.json holds exactly the fifteen pinned hashes, in order (docs/phase-5c.md)', () => {
    expect(Object.keys(ALL_PINNED)).toHaveLength(15);
    expect(golden.scenarios).toStrictEqual(ALL_PINNED);
    expect(Object.keys(golden.scenarios)).toEqual(Object.keys(ALL_PINNED));
  });

  for (const [name, hash] of Object.entries(ALL_PINNED))
    it(`scenario "${name}" reproduces its pinned hash`, () => {
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

  it('Movement I and II content gains no Movement III key (docs/phase-5c.md)', () => {
    const early = (m: number | undefined) => (m ?? 1) <= 2;
    const enemies = CONTENT.enemies.filter((e) => early(e.movement));
    expect(enemies.length).toBeGreaterThan(0);
    const payloads = (where: string, p: object | undefined) => {
      if (p) expect('burst' in p, `${where}.burst`).toBe(false);
    };
    for (const e of enemies) {
      for (const k of ['stationary', 'tether']) expect(k in e, `${e.id}.${k}`).toBe(false);
      expect(e.material, e.id).not.toBe('cloth');
      payloads(`${e.id}.basic.onHit`, e.basic.onHit);
    }
    const specials = new Set(enemies.flatMap((e) => e.specials));
    for (const a of CONTENT.attacks.filter((x) => specials.has(x.id))) {
      for (const k of ['cut', 'zone']) expect(k in a, `${a.id}.${k}`).toBe(false);
      expect(['zone', 'mimic'], a.id).not.toContain(a.effect);
      expect(['threadLine', 'allyEnemy'], a.id).not.toContain(a.targeting);
      expect(a.centre, a.id).not.toBe('weaver');
      expect(a.linkStatus, a.id).not.toBe('stitch');
      expect(a.answers, a.id).not.toContain('thread');
      expect(a.answers, a.id).not.toContain('empower');
      payloads(`${a.id}.status`, a.status);
    }
    for (const f of CONTENT.affixes.filter((x) => early(x.movement))) {
      for (const k of ['specials', 'suppressRadius', 'cut'])
        expect(k in f, `${f.id}.${k}`).toBe(false);
      payloads(`${f.id}.onHit`, f.onHit);
    }
    for (const m of CONTENT.motifs) {
      if (m.id === 'guard_strand') continue;
      expect('movement' in m.requires, `${m.id}.requires.movement`).toBe(false);
    }
    // The Rift's three, and the Finale's three (docs/phase-5d.md): the only gated relics.
    const gated = new Map([
      ['sacrificial_lamb', 3],
      ['knotted_cord', 3],
      ['stillwater_bell', 3],
      ['tacet_mark', 4],
      ['quick_rosin', 4],
      ['first_score', 4],
    ]);
    for (const r of CONTENT.relics)
      if (gated.has(r.id)) expect(r.movement, r.id).toBe(gated.get(r.id));
      else expect('movement' in r, `${r.id}.movement`).toBe(false);
    for (const m of CONTENT.movements.slice(0, 2)) expect('label' in m, m.id).toBe(false);
    const early2 = new Set(CONTENT.encounters.filter((e) => early(e.movement)).map((e) => e.arena));
    for (const a of CONTENT.arenas.filter((x) => early2.has(x.id)))
      expect(a.biome, a.id).not.toBe('abyssal_rift');
  });

  it('Movements I-III content gains no Finale key (docs/phase-5d.md)', () => {
    const early = (m: number | undefined) => (m ?? 1) <= 3;
    const enemies = CONTENT.enemies.filter((e) => early(e.movement));
    expect(enemies.length).toBeGreaterThan(0);
    for (const e of enemies) expect(e.material, e.id).not.toBe('glass');
    // Every attack an earlier enemy or any affix can cast: no Discord, no Crescendo answer.
    const specials = new Set([
      ...enemies.flatMap((e) => e.specials),
      ...CONTENT.affixes.flatMap((f) => f.specials ?? []),
    ]);
    for (const p of CONTENT.attacks.flatMap((a) => [a.status, a.zone?.status]))
      if (p?.burst) specials.add(p.burst.attack);
    for (const a of CONTENT.attacks.filter((x) => specials.has(x.id))) {
      for (const k of ['discord', 'discordQuorum']) expect(k in a, `${a.id}.${k}`).toBe(false);
      expect(a.answers, a.id).not.toContain('crescendo');
      expect(a.markStatus, a.id).not.toBe('stilled');
      expect(a.status?.id, a.id).not.toBe('stilled');
      // Only the Final Cadence is lethal from full; nothing earlier passes 100%.
      expect(a.pctMaxHp ?? 0, a.id).toBeLessThanOrEqual(1);
    }
    for (const e of CONTENT.encounters.filter((x) => early(x.movement)))
      expect(CONTENT.arenas.find((a) => a.id === e.arena)!.biome, e.id).not.toBe(
        'celestial_crucible',
      );
    // The three field Movements: no road, no finale flag, no label; still exactly three.
    expect(CONTENT.movements).toHaveLength(3);
    for (const m of CONTENT.movements)
      for (const k of ['road', 'finale', 'label']) expect(k in m, `${m.id}.${k}`).toBe(false);
  });
});
