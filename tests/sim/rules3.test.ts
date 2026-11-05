/**
 * Movement III's contracts (docs/phase-5c.md, W0b): the shared pure rules in src/sim/rules3.ts
 * and the segment arithmetic in core/dmath, the boss-script registry, the new mods at their
 * neutral values, and the lifecycle of the new optional state (Stasis waits it, the end of an
 * encounter deletes it).
 */
import { describe, expect, it } from 'vitest';
import { CONTENT, enemyDef } from '../../src/content';
import { createSim } from '../../src/sim';
import { segmentDistSq, segmentsCross } from '../../src/sim/core/dmath';
import { NO_MODS, resolveMods } from '../../src/sim/mods';
import {
  cutWouldLand,
  enemyDamageMult,
  fightMovement,
  isRooted,
  mimicBeneficiary,
  mimicCopyOf,
  possessionVictim,
  relicAwake,
  specialsOf,
  suppressRadiusOf,
  threadSegment,
  weaverSilenced,
} from '../../src/sim/rules3';
import type { Entity, Telegraph } from '../../src/sim/state';
import { BOSS_SCRIPTS, bossScript } from '../../src/sim/systems/bossScripts';
import { bossPhaseTable, phaseRules } from '../../src/sim/systems/bosses';
import { holdEnemyTime } from '../../src/sim/systems/stasis';
import { resolveConfig, type World } from '../../src/sim/world';
import { ofType, sandbox, spawn, stepFor, stepUntil, worldOf } from './helpers';

function staged() {
  const sim = sandbox();
  const w = worldOf(sim);
  const weaver = w.entities.get(w.weaverId)!;
  const heroes = w.party.map((id) => w.entities.get(id)!);
  return { sim, w, weaver, heroes };
}

function place(e: Entity, x: number, z: number): void {
  e.x = x;
  e.z = z;
  e.px = x;
  e.pz = z;
}

/** A telegraph of `attackId` with `shape`, as the sim would hold it (only what rules3 reads). */
function telegraph(attackId: string, shape: Telegraph['shape']): Telegraph {
  return { id: 1, attackId, shape } as Telegraph;
}

describe('dmath: segments', () => {
  it('two segments that cross meet; touching at an endpoint counts', () => {
    expect(segmentsCross(-1, 0, 1, 0, 0, -1, 0, 1)).toBe(true);
    // A T: one segment ends on the other.
    expect(segmentsCross(-1, 0, 1, 0, 0, 0, 0, 1)).toBe(true);
    // Sharing an endpoint.
    expect(segmentsCross(0, 0, 1, 0, 1, 0, 2, 3)).toBe(true);
    // Short of each other.
    expect(segmentsCross(-1, 0, 1, 0, 0, 0.01, 0, 1)).toBe(false);
    expect(segmentsCross(-1, 0, 1, 0, 2, -1, 2, 1)).toBe(false);
  });

  it('parallel segments never cross unless they overlap on one line', () => {
    expect(segmentsCross(0, 0, 4, 0, 0, 2, 4, 2)).toBe(false);
    expect(segmentsCross(0, 0, 4, 0, 2, 0, 6, 0)).toBe(true);
    expect(segmentsCross(0, 0, 4, 0, 5, 0, 6, 0)).toBe(false);
  });

  it('the distance between segments: 0 when they meet, else the nearest ends', () => {
    expect(segmentDistSq(-1, 0, 1, 0, 0, -1, 0, 1)).toBe(0);
    expect(segmentDistSq(0, 0, 4, 0, 0, 2, 4, 2)).toBe(4);
    expect(segmentDistSq(0, 0, 4, 0, 5, 0, 6, 0)).toBe(1);
    expect(segmentDistSq(0, 0, 4, 0, 2, 3, 2, 1)).toBe(1);
  });
});

describe('rules3: the Thread and cuts', () => {
  it('threadSegment runs from the Weaver to the threaded hero, and is null without one', () => {
    const { w, weaver, heroes } = staged();
    weaver.weaver!.threadSlot = null;
    expect(threadSegment(w)).toBeNull();
    place(weaver, 1, 2);
    place(heroes[1]!, 5, -3);
    weaver.weaver!.threadSlot = 1;
    expect(threadSegment(w)).toEqual({ ax: 1, az: 2, bx: 5, bz: -3 });
    heroes[1]!.health!.dead = true;
    expect(threadSegment(w)).toBeNull();
  });

  it('cutWouldLand: a cut line that reaches the Thread; an always cut; nothing else', () => {
    const { w, weaver, heroes } = staged();
    place(weaver, 0, 0);
    place(heroes[0]!, 0, 10);
    place(heroes[1]!, 6, 0);
    weaver.weaver!.threadSlot = 0;
    const across = telegraph('shears_dash', {
      kind: 'line',
      x: -5,
      z: 5,
      toX: 5,
      toZ: 5,
      width: 1.2,
    });
    expect(cutWouldLand(w, across)).toBe(true);
    // Re-threaded to the hero on the Weaver's side of the line: it would miss.
    expect(cutWouldLand(w, across, 1)).toBe(false);
    // Its width reaches a Thread just past its end.
    const short = telegraph('shears_dash', {
      kind: 'line',
      x: -5,
      z: 5,
      toX: -0.5,
      toZ: 5,
      width: 1.2,
    });
    expect(cutWouldLand(w, short)).toBe(true);
    const shorter = telegraph('shears_dash', {
      kind: 'line',
      x: -5,
      z: 5,
      toX: -0.7,
      toZ: 5,
      width: 1.2,
    });
    expect(cutWouldLand(w, shorter)).toBe(false);
    // The Unpick cuts whatever the geometry, but not a Thread that isn't there.
    const unpick = telegraph('seamstress_unpick', { kind: 'raid' });
    expect(cutWouldLand(w, unpick)).toBe(true);
    expect(cutWouldLand(w, unpick, null)).toBe(false);
    // An attack without a cut never cuts.
    expect(cutWouldLand(w, telegraph('impaler_charge', across.shape))).toBe(false);
    weaver.weaver!.threadSlot = null;
    expect(cutWouldLand(w, across)).toBe(false);
  });

  it('weaverSilenced: only inside a null zone', () => {
    const { w, weaver } = staged();
    place(weaver, 0, 0);
    expect('zones' in w.field).toBe(false);
    expect(weaverSilenced(w)).toBe(false);
    const zone = { id: 1, kind: 'null' as const, owner: 0, x: 3, z: 0, r: 5, until: 99 };
    w.field.zones = [{ ...zone, kind: 'pull', pullSpeed: 2.4 }];
    expect(weaverSilenced(w)).toBe(false);
    w.field.zones = [{ ...zone, x: 6 }];
    expect(weaverSilenced(w)).toBe(false);
    w.field.zones = [{ ...zone }];
    expect(weaverSilenced(w)).toBe(true);
  });
});

describe('rules3: possession', () => {
  it('reaches max(5 m, the hero’s own range): a possessed Kael 5 m, a possessed Lyra 14', () => {
    const { w, weaver, heroes } = staged();
    const [kael, lyra, vexis] = heroes as [Entity, Entity, Entity];
    expect(CONTENT.heroes.find((h) => h.id === 'kael')!.attack.range).toBeLessThan(5);
    place(kael, 0, 0);
    place(lyra, 0, 6);
    place(vexis, 0, -12);
    // The Weaver stands right beside them: never a victim.
    place(weaver, 0.5, 0);
    expect(possessionVictim(w, kael)).toBeNull();
    place(lyra, 0, 4.9);
    expect(possessionVictim(w, kael)).toBe(lyra.id);
    place(lyra, 0, 0);
    place(kael, 0, 12);
    place(vexis, 0, 30);
    expect(possessionVictim(w, lyra)).toBe(kael.id);
    place(kael, 0, 14.5);
    expect(possessionVictim(w, lyra)).toBeNull();
  });

  it('the nearest wins, ties go to the lower slot, and the downed are skipped', () => {
    const { w, heroes } = staged();
    const [kael, lyra, vexis] = heroes as [Entity, Entity, Entity];
    place(lyra, 0, 0);
    place(kael, 3, 0);
    place(vexis, -3, 0);
    expect(possessionVictim(w, lyra)).toBe(kael.id);
    place(vexis, -2, 0);
    expect(possessionVictim(w, lyra)).toBe(vexis.id);
    vexis.health!.downed = true;
    expect(possessionVictim(w, lyra)).toBe(kael.id);
    place(kael, 0, 0);
    place(lyra, 1, 0);
    place(vexis, -1, 0);
    vexis.health!.downed = false;
    // Lyra and Vexis are both 1 m from Kael: Lyra has the lower slot.
    expect(possessionVictim(w, kael)).toBe(lyra.id);
  });
});

describe('rules3: enemies', () => {
  const fake = (defId: string, affixes: string[] = []) =>
    ({ enemy: { defId, affixes } }) as unknown as Entity;

  it('suppressRadiusOf matches every Movement I and II def, with or without their affixes', () => {
    const w = staged().w;
    const early = CONTENT.affixes.filter((a) => (a.movement ?? 1) <= 2).map((a) => a.id);
    for (const def of CONTENT.enemies.filter((e) => (e.movement ?? 1) <= 2)) {
      expect(suppressRadiusOf(w, fake(def.id)), def.id).toBe(def.suppressRadius);
      for (const a of early)
        expect(suppressRadiusOf(w, fake(def.id, [a])), def.id).toBe(def.suppressRadius);
    }
    expect(CONTENT.enemies.filter((e) => e.suppressRadius > 0).map((e) => e.id)).toEqual(['mute']);
    // Silencing carries the Mute's field; a Mute keeps its own.
    expect(suppressRadiusOf(w, fake('shears', ['silencing']))).toBe(7);
    expect(suppressRadiusOf(w, fake('mute', ['silencing']))).toBe(enemyDef('mute').suppressRadius);
    expect(suppressRadiusOf(w, { x: 0 } as unknown as Entity)).toBe(0);
  });

  it('isRooted: pinned or stitched', () => {
    const { heroes } = staged();
    const h = heroes[0]!;
    expect(isRooted(h)).toBe(false);
    const status = { remaining: 1, duration: 1, stacks: 1, source: null };
    h.health!.statuses.push({ id: 'pinned', ...status });
    expect(isRooted(h)).toBe(true);
    h.health!.statuses = [{ id: 'stitched', ...status }];
    expect(isRooted(h)).toBe(true);
    h.health!.statuses = [{ id: 'stun', ...status }];
    expect(isRooted(h)).toBe(false);
  });

  it('enemyDamageMult is c.damageMult itself unless Emboldened', () => {
    const sim = sandbox();
    stepFor(sim, 1, [spawn('hollow_chorister', 0, -8, true)]);
    const w = worldOf(sim);
    const c = w.entities.list().find((e) => e.enemy)!.enemy!;
    expect(Object.is(enemyDamageMult(w, c), c.damageMult)).toBe(true);
    c.emboldenedUntil = w.time;
    expect(Object.is(enemyDamageMult(w, c), c.damageMult)).toBe(true);
    c.emboldenedUntil = w.time + 1;
    expect(enemyDamageMult(w, c)).toBe(c.damageMult * 1.25);
  });

  it('specialsOf is def.specials itself unless an affix brings specials, each once', () => {
    const early = CONTENT.affixes.filter((a) => (a.movement ?? 1) <= 2).map((a) => a.id);
    for (const def of CONTENT.enemies) {
      expect(specialsOf(def, []), def.id).toBe(def.specials);
      expect(specialsOf(def, early), def.id).toBe(def.specials);
    }
    const shears = enemyDef('shears');
    expect(specialsOf(shears, ['mimicking'])).toEqual(['shears_dash', 'mimic_mirror']);
    expect(shears.specials).toEqual(['shears_dash']);
    // The Mimic already casts it: no second copy, and the same array.
    const mimic = enemyDef('mimic');
    expect(specialsOf(mimic, ['mimicking'])).toBe(mimic.specials);
  });

  it('mimicBeneficiary: the biggest other enemy within 12 m, ties to the lower id, else itself', () => {
    const sim = sandbox();
    stepFor(sim, 1, [
      spawn('mimic', 0, -8),
      spawn('hollow_chorister', 4, -8),
      spawn('bell_brute', -6, -8),
      spawn('bell_brute', 6, -8),
      spawn('the_bellwarden', 0, 10),
    ]);
    const w = worldOf(sim);
    const enemies = w.entities.list().filter((e) => e.enemy);
    const [mimic, , brute1, brute2] = enemies as Entity[];
    for (const [e, x, z] of [
      [enemies[0]!, 0, -8],
      [enemies[1]!, 4, -8],
      [enemies[2]!, -6, -8],
      [enemies[3]!, 6, -8],
      [enemies[4]!, 0, 10],
    ] as const)
      place(e, x, z);
    expect(mimicBeneficiary(w, mimic!)).toBe(Math.min(brute1!.id, brute2!.id));
    brute1!.health!.dead = true;
    expect(mimicBeneficiary(w, mimic!)).toBe(brute2!.id);
    brute2!.health!.dead = true;
    enemies[1]!.health!.dead = true;
    expect(mimicBeneficiary(w, mimic!)).toBe(mimic!.id);
  });

  it('mimicCopyOf: Empower, else the last Ward or Chime; a Reel or Rewind (both reel) or nothing: null', () => {
    const { w, weaver } = staged();
    const ww = weaver.weaver!;
    ww.threadMode = 'mend';
    ww.lastTechnique = null;
    expect(mimicCopyOf(w)).toBeNull();
    ww.lastTechnique = 'reel';
    expect(mimicCopyOf(w)).toBeNull();
    ww.lastTechnique = 'ward';
    expect(mimicCopyOf(w)).toBe('ward');
    ww.lastTechnique = 'chime';
    expect(mimicCopyOf(w)).toBe('chime');
    ww.threadMode = 'empower';
    expect(mimicCopyOf(w)).toBe('empower');
    ww.threadMode = 'bear';
    expect(mimicCopyOf(w)).toBe('chime');
  });
});

describe('rules3: Movements and sleeping relics', () => {
  it('fightMovement reads the encounter’s content Movement', () => {
    expect(fightMovement(staged().w)).toBe(1);
    expect(fightMovement({ encounter: { id: 'vharun' } } as World)).toBe(2);
    expect(fightMovement({ encounter: { id: 'the_unweaver' } } as World)).toBe(3);
    expect(fightMovement({ encounter: { id: 'nowhere' } } as World)).toBe(1);
  });

  it('relicAwake: a Rift relic or motif sleeps before Movement III; the rest never do', () => {
    const relic = (id: string) => CONTENT.relics.find((r) => r.id === id)!;
    const motif = (id: string) => CONTENT.motifs.find((m) => m.id === id)!;
    for (const id of ['sacrificial_lamb', 'knotted_cord', 'stillwater_bell']) {
      expect(relicAwake(relic(id), 2), id).toBe(false);
      expect(relicAwake(relic(id), 3), id).toBe(true);
    }
    expect(relicAwake(motif('guard_strand'), 1)).toBe(false);
    expect(relicAwake(motif('guard_strand'), 3)).toBe(true);
    for (const r of CONTENT.relics.filter((x) => x.movement === undefined))
      expect(relicAwake(r, 1), r.id).toBe(true);
    for (const m of CONTENT.motifs.filter((x) => x.id !== 'guard_strand'))
      expect(relicAwake(m, 1), m.id).toBe(true);
  });
});

describe('the new mods, the registry and the lifecycle', () => {
  it('every new mod is neutral by default, and the Rift resolvers set only their own', () => {
    expect(NO_MODS).toMatchObject({
      guardStrand: 0,
      cutLockMult: 1,
      cutResonance: 0,
      chimeCooldownCut: 0,
      stillwaterBell: 0,
      sacrificialLamb: 0,
    });
    const mods = (config: Parameters<typeof resolveConfig>[0]) =>
      resolveMods(resolveConfig(config), CONTENT);
    expect(mods({ seed: 1, relics: ['knotted_cord'] })).toMatchObject({
      cutLockMult: 0.5,
      cutResonance: 10,
    });
    expect(mods({ seed: 1, relics: ['stillwater_bell'] })).toMatchObject({
      chimeCooldownCut: 2,
      stillwaterBell: 0.5,
    });
    expect(mods({ seed: 1, relics: ['sacrificial_lamb'] }).sacrificialLamb).toBe(1);
    expect(mods({ seed: 1, motifs: [{ id: 'guard_strand', level: 2 }] }).guardStrand).toBe(1);
  });

  it('the registry is empty and misses every legacy boss', () => {
    expect(Object.keys(BOSS_SCRIPTS)).toEqual([]);
    for (const id of [
      'the_bellwarden',
      'the_hollow_cantor',
      'gorehound_matriarch',
      'vharun_crimson_warden',
      'constructor',
      'toString',
    ])
      expect(bossScript(id), id).toBeUndefined();
  });

  it('both Movement III bosses have their phase rows', () => {
    expect(bossPhaseTable('the_seamstress')).toEqual([{ at: 1 }, { at: 0.5, name: 'Unpicking' }]);
    expect(phaseRules('the_seamstress', 1)).toEqual({
      answers: ['ward', 'thread'],
      cooldownMult: 0.85,
    });
    expect(bossPhaseTable('the_unweaver')).toEqual([
      { at: 1 },
      { at: 0.66, name: 'Steal Verse' },
      { at: 0.33, name: 'Mirror Weave' },
    ]);
    expect(phaseRules('the_unweaver', 1)).toEqual({ specials: ['unweaver_shear'] });
    expect(phaseRules('the_unweaver', 2)).toEqual({
      answers: ['focus'],
      specials: ['unweaver_shear'],
    });
  });

  it('Stasis waits the zones, Unravel and a stolen verse', () => {
    const { w } = staged();
    holdEnemyTime(w, 0.5);
    expect('zones' in w.field || 'unravel' in w.field || 'stolen' in w.field).toBe(false);
    w.field.zones = [{ id: 1, kind: 'null', owner: 0, x: 0, z: 0, r: 5, until: 10 }];
    w.field.unravel = { until: 20, source: 0, acc: 0, tickIn: 0.5 };
    w.field.stolen = { chord: 1, aura: 0, add: 0, until: 30 };
    holdEnemyTime(w, 0.5);
    expect(w.field.zones[0]!.until).toBe(10.5);
    expect(w.field.unravel.until).toBe(20.5);
    expect(w.field.stolen.until).toBe(30.5);
  });

  it('the end of an encounter deletes every Movement III key', () => {
    const sim = createSim({ seed: 3, encounter: 'bellwarden', debug: true });
    stepUntil(sim, () => sim.state.encounter.bossId !== null);
    const w = worldOf(sim);
    w.field.zones = [{ id: 1, kind: 'null', owner: 0, x: 0, z: 0, r: 5, until: 999 }];
    w.field.unravel = { until: 999, source: 0, acc: 0, tickIn: 0.5 };
    w.field.stolen = { chord: 1, aura: 0, add: 0, until: 999 };
    w.internal.m3 = { nextSnipAt: 999 };
    const events = stepUntil(
      sim,
      (ev) => ev.some((e) => e.type === 'encounterEnded'),
      600,
      () => [{ t: 'debug', op: { op: 'killEnemies' } }],
    );
    expect(ofType(events, 'encounterEnded')[0]!.outcome).toBe('victory');
    for (const k of ['zones', 'unravel', 'stolen']) expect(k in w.field, k).toBe(false);
    expect('m3' in w.internal).toBe(false);
  });
});
