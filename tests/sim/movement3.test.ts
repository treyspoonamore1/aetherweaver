/**
 * Movement III, the Weaver's side (docs/phase-5c.md, W1): the Thread cuts and their verdicts,
 * Guard Strand, Severing on bolts, the Null rune's silence, Cue and calls on a possessed hero,
 * Unravel's reversed Mend, Steal Verse's runtime mute, the Silencing dome, Stillwater Bell, and
 * the Rift relics sleeping outside a Movement III fight.
 */
import { describe, expect, it } from 'vitest';
import { attackDef, CONTENT, heroDef } from '../../src/content';
import type { Command, Sim, SimConfig, SimEvent } from '../../src/sim';
import { createSim, weaverSilenced } from '../../src/sim';
import {
  addStatus,
  dealDamage,
  hasStatus,
  killEnemy,
  removeStatus,
} from '../../src/sim/combat/health';
import { auraBit } from '../../src/sim/combat/auras';
import type { Entity } from '../../src/sim/state';
import { canCall, tendCall } from '../../src/sim/systems/calls';
import { beginAttack } from '../../src/sim/systems/enemies';
import { underMuteDome } from '../../src/sim/systems/field';
import { startSolo } from '../../src/sim/systems/solos';
import { updatePendingHits } from '../../src/sim/systems/hits';
import { castReel, cue } from '../../src/sim/systems/techniques';
import { hashWorld } from '../../src/sim/hashing';
import { cutThread, severingHit } from '../../src/sim/systems/thread';
import type { PendingHit, World } from '../../src/sim/world';
import { ofType, sandbox, spawn, stepFor, worldOf } from './helpers';

const RIFT_RELICS = ['sacrificial_lamb', 'knotted_cord', 'stillwater_bell'];
/** A Movement III fight (fightMovement 3) with nobody in it yet. */
const RIFT = 'the_seamstress';

function rift(config: Partial<SimConfig> = {}): Sim {
  const sim = createSim({ seed: 7, encounter: RIFT, debug: true, auras: [], ...config });
  stepFor(sim, 1, [{ t: 'debug', op: { op: 'killEnemies' } }]);
  return sim;
}

function place(e: Entity, x: number, z: number): void {
  e.x = e.px = x;
  e.z = e.pz = z;
  e.vx = e.vz = 0;
}

function weaverEntity(w: World): Entity {
  return w.entities.get(w.weaverId)!;
}

function heroAt(w: World, slot: number): Entity {
  return w.entities.get(w.party[slot]!)!;
}

/** Threads the hero in `slot` (a step, so the attach goes through the command path). */
function thread(sim: Sim, slot: 0 | 1 | 2): void {
  stepFor(sim, 1, [{ t: 'thread', slot }]);
  expect(worldOf(sim).entities.get(sim.state.weaverId)!.weaver!.threadSlot).toBe(slot);
}

/** A sturdy enemy far off: an owner for staged zones, a source for staged bolts. */
function enemyOf(sim: Sim, defId = 'hollow_chorister', x = 0, z = 18): Entity {
  stepFor(sim, 1, [spawn(defId, x, z)]);
  const w = worldOf(sim);
  const e = [...w.entities.list()].filter((x) => x.enemy).at(-1)!;
  e.health!.hp = e.health!.maxHp = 1e7;
  return e;
}

/** A bolt from `source` landing on `target` now. */
function bolt(w: World, source: Entity, target: Entity, amount = 40): PendingHit {
  return {
    at: w.time,
    source: source.id,
    target: target.id,
    amount,
    amplified: 0,
    aura: 0,
    empower: 0,
    crit: false,
    splashRadius: 0,
    splash: 0,
    chain: 0,
    empowered: false,
    stun: 0,
  };
}

describe('cutThread: an enemy cuts the Thread', () => {
  it('lets go of the hero, locks the Thread and says what cut it', () => {
    const sim = sandbox();
    thread(sim, 0);
    const w = worldOf(sim);
    sim.drainEvents();
    expect(cutThread(w, 'shears', 1, null)).toBe('cut');
    const wv = weaverEntity(w).weaver!;
    expect(wv.threadSlot).toBeNull();
    expect(wv.threadTension).toBe(0);
    expect(wv.threadLock).toBe(1);
    const snapped = ofType(sim.drainEvents(), 'threadSnapped');
    expect(snapped).toEqual([
      { type: 'threadSnapped', tick: w.tick, target: w.party[0], cause: 'shears', lock: 1 },
    ]);
    // Nothing left to cut.
    expect(cutThread(w, 'shears', 1, null)).toBe('none');
    expect(ofType(sim.drainEvents(), 'threadSnapped')).toHaveLength(0);
    // Locked: the Thread can't go back on at once.
    const events = stepFor(sim, 1, [{ t: 'thread', slot: 0 }]);
    expect(ofType(events, 'techniqueRejected')).toEqual([
      expect.objectContaining({ technique: 'thread', reason: 'locked' }),
    ]);
  });

  it('the Snip locks it for 3 s, and names the enemy that cut it', () => {
    const sim = sandbox();
    const boss = enemyOf(sim);
    thread(sim, 1);
    const w = worldOf(sim);
    sim.drainEvents();
    expect(cutThread(w, 'snip', 3, boss.id)).toBe('cut');
    expect(weaverEntity(w).weaver!.threadLock).toBe(3);
    expect(ofType(sim.drainEvents(), 'threadSnapped')[0]).toMatchObject({
      target: w.party[1],
      cause: 'snip',
      lock: 3,
      by: boss.id,
    });
  });

  it('the Unpick cuts with nobody hurt: one threadSnapped, cause unpick', () => {
    const sim = sandbox();
    const boss = enemyOf(sim);
    thread(sim, 2);
    const w = worldOf(sim);
    for (const id of w.party) w.entities.get(id)!.health!.invulnerable = 10;
    sim.drainEvents();
    expect(cutThread(w, 'unpick', 1, boss.id)).toBe('cut');
    const events = sim.drainEvents();
    expect(ofType(events, 'threadSnapped')).toEqual([
      {
        type: 'threadSnapped',
        tick: w.tick,
        target: w.party[2],
        cause: 'unpick',
        lock: 1,
        by: boss.id,
      },
    ]);
    expect(ofType(events, 'damageTaken')).toHaveLength(0);
  });

  it('Taut Release fires on a cut, as on a snap', () => {
    const sim = sandbox({ motifs: [{ id: 'taut_release', level: 1 }] });
    thread(sim, 0);
    const w = worldOf(sim);
    const kael = heroAt(w, 0);
    expect(kael.health!.shields.some((s) => s.kind === 'overshield')).toBe(false);
    cutThread(w, 'shears', 1, null);
    const pct = CONTENT.motifs.find((m) => m.id === 'taut_release')!.values[0]! / 100;
    const shield = kael.health!.shields.find((s) => s.kind === 'overshield')!;
    expect(shield.fromWeaver).toBe(true);
    expect(shield.amount).toBeCloseTo(kael.health!.maxHp * pct, 6);
  });

  it('the range snap is untouched: no cause, the usual lockout, the same event shape', () => {
    // Knotted Cord in a Rift fight changes cuts only.
    for (const sim of [sandbox(), rift({ relics: ['knotted_cord'] })]) {
      thread(sim, 0);
      const w = worldOf(sim);
      const wv = weaverEntity(w).weaver!;
      const resonance = wv.resonance;
      const weaver = weaverEntity(w);
      place(heroAt(w, 0), weaver.x + wv.threadRange + 5, weaver.z);
      const events = stepFor(sim, 1);
      const snapped = ofType(events, 'threadSnapped');
      expect(snapped).toHaveLength(1);
      expect(Object.keys(snapped[0]!).sort()).toEqual(['target', 'tick', 'type']);
      expect(wv.threadLock).toBe(CONTENT.thread.lockout);
      expect(wv.resonance).toBe(resonance);
    }
  });

  it('Knotted Cord halves a cut’s lock and gives 10 Resonance a cut', () => {
    const sim = rift({ relics: ['knotted_cord'] });
    const w = worldOf(sim);
    expect(w.mods.cutLockMult).toBe(0.5);
    expect(w.mods.cutResonance).toBe(10);
    thread(sim, 0);
    const wv = weaverEntity(w).weaver!;
    const before = wv.resonance;
    sim.drainEvents();
    expect(cutThread(w, 'snip', 3, null)).toBe('cut');
    expect(wv.threadLock).toBe(1.5);
    expect(wv.resonance - before).toBeCloseTo(10 * w.mods.resonanceMult, 9);
    const events = sim.drainEvents();
    expect(ofType(events, 'threadSnapped')[0]).toMatchObject({ cause: 'snip', lock: 1.5 });
    // It acted, so the view hears it (its sound, W7).
    expect(ofType(events, 'relicTriggered')).toEqual([
      expect.objectContaining({ relic: 'knotted_cord', hero: heroAt(w, 0).id }),
    ]);
    expect(w.relics.triggers['knotted_cord']).toBe(1);
  });
});

describe('Guard Strand', () => {
  const strand = { motifs: [{ id: 'guard_strand', level: 1 }] };
  const every = CONTENT.motifs.find((m) => m.id === 'guard_strand')!.values[0]!;

  it('turns a Shears, Severing or Snip cut aside once every few seconds', () => {
    const sim = rift(strand);
    const w = worldOf(sim);
    expect(w.mods.guardStrand).toBe(every);
    thread(sim, 0);
    const wv = weaverEntity(w).weaver!;
    sim.drainEvents();
    expect(cutThread(w, 'shears', 1, null)).toBe('strand');
    expect(wv.threadSlot).toBe(0);
    expect(w.internal.guardStrandAt).toBeCloseTo(w.time + every, 9);
    expect(ofType(sim.drainEvents(), 'threadSnapped')).toHaveLength(0);
    // On its cooldown, the next one cuts.
    expect(cutThread(w, 'snip', 3, null)).toBe('cut');
    expect(wv.threadSlot).toBeNull();
  });

  it('never refuses the Unpick, and leaves its clock alone', () => {
    const sim = rift(strand);
    const w = worldOf(sim);
    thread(sim, 0);
    expect(cutThread(w, 'unpick', 1, null)).toBe('cut');
    expect(w.internal.guardStrandAt).toBeUndefined();
  });

  it('destroys an enemy bolt crossing the Thread, at its cooldown', () => {
    const sim = rift(strand);
    const w = worldOf(sim);
    const source = enemyOf(sim);
    thread(sim, 0);
    // The Thread runs from (0, 0) to (0, -8); the bolt flies across it at z = -4.
    place(weaverEntity(w), 0, 0);
    place(heroAt(w, 0), 0, -8);
    place(source, -6, -4);
    const lyra = heroAt(w, 1);
    place(lyra, 6, -4);
    sim.drainEvents();
    const hp = lyra.health!.hp;
    w.internal.pendingHits.push(bolt(w, source, lyra));
    updatePendingHits(w);
    expect(lyra.health!.hp).toBe(hp);
    const blocked = ofType(sim.drainEvents(), 'strandBlocked');
    expect(blocked).toHaveLength(1);
    expect(blocked[0]).toMatchObject({ source: source.id });
    expect(blocked[0]!.x).toBeCloseTo(0, 9);
    expect(blocked[0]!.z).toBeCloseTo(-4, 9);
    // On its cooldown, the next one lands.
    w.internal.pendingHits.push(bolt(w, source, lyra));
    updatePendingHits(w);
    expect(lyra.health!.hp).toBeLessThan(hp);
    expect(ofType(sim.drainEvents(), 'strandBlocked')).toHaveLength(0);
  });

  it('never stops a bolt at the threaded hero or at the Weaver', () => {
    const sim = rift(strand);
    const w = worldOf(sim);
    const source = enemyOf(sim);
    thread(sim, 0);
    place(weaverEntity(w), 0, 0);
    const kael = heroAt(w, 0);
    place(kael, 0, -8);
    place(source, 0, -14);
    sim.drainEvents();
    const hp = kael.health!.hp;
    w.internal.pendingHits.push(bolt(w, source, kael));
    updatePendingHits(w);
    expect(kael.health!.hp).toBeLessThan(hp);
    expect(ofType(sim.drainEvents(), 'strandBlocked')).toHaveLength(0);
    expect(w.internal.guardStrandAt).toBeUndefined();
  });

  it('sleeps outside the Abyssal Rift: no mod, so no bolt is ever stopped', () => {
    const sim = sandbox(strand);
    expect(worldOf(sim).mods.guardStrand).toBe(0);
  });
});

describe('Severing on bolts', () => {
  function severing() {
    const sim = sandbox();
    const w = worldOf(sim);
    const elite = enemyOf(sim);
    elite.enemy!.affixes = ['severing'];
    thread(sim, 0);
    place(weaverEntity(w), 0, 0);
    place(heroAt(w, 0), 0, -8);
    const lyra = heroAt(w, 1);
    place(lyra, 3, -4);
    sim.drainEvents();
    return { sim, w, elite, lyra };
  }

  it('a bolt it lands while the Thread passes near it cuts, once every 3 s', () => {
    const { sim, w, elite, lyra } = severing();
    // 1.5 m from the Thread: within 2 m plus its radius.
    place(elite, 1.5, -4);
    w.internal.pendingHits.push(bolt(w, elite, lyra));
    updatePendingHits(w);
    const wv = weaverEntity(w).weaver!;
    expect(wv.threadSlot).toBeNull();
    expect(wv.threadLock).toBe(1);
    expect(ofType(sim.drainEvents(), 'threadSnapped')[0]).toMatchObject({
      cause: 'severing',
      lock: 1,
      by: elite.id,
    });
    expect(w.internal.m3?.severAt?.[elite.id]).toBeCloseTo(w.time + 3, 9);
    // Threaded again at once (staged): its next bolt doesn't cut.
    wv.threadLock = 0;
    wv.threadSlot = 0;
    w.internal.pendingHits.push(bolt(w, elite, lyra));
    updatePendingHits(w);
    expect(wv.threadSlot).toBe(0);
  });

  it('far from the Thread, or without the affix, a bolt cuts nothing', () => {
    const { w, elite, lyra } = severing();
    place(elite, 9, -4);
    w.internal.pendingHits.push(bolt(w, elite, lyra));
    updatePendingHits(w);
    expect(weaverEntity(w).weaver!.threadSlot).toBe(0);
    expect(w.internal.m3).toBeUndefined();
    place(elite, 1.5, -4);
    elite.enemy!.affixes = [];
    w.internal.pendingHits.push(bolt(w, elite, lyra));
    updatePendingHits(w);
    expect(weaverEntity(w).weaver!.threadSlot).toBe(0);
    // Called directly on a plain enemy, nothing happens either.
    severingHit(w, elite);
    expect(weaverEntity(w).weaver!.threadSlot).toBe(0);
  });
});

describe('the Null rune silences the Weaver', () => {
  function runed(config: Partial<SimConfig> = {}) {
    const sim = sandbox(config);
    const w = worldOf(sim);
    const owner = enemyOf(sim);
    const weaver = weaverEntity(w);
    w.field.zones = [
      { id: 99, kind: 'null', owner: owner.id, x: weaver.x, z: weaver.z, r: 5, until: 1e9 },
    ];
    sim.drainEvents();
    return { sim, w };
  }

  const refusals = (events: SimEvent[]) =>
    ofType(events, 'techniqueRejected').map((e) => [e.technique, e.reason]);

  it('Ward, Chime and Reel are refused with silenced', () => {
    const { sim } = runed();
    for (const cmd of [
      { t: 'tech', id: 'ward', slot: 0 },
      { t: 'tech', id: 'chime', point: { x: 0, z: -3 } },
      { t: 'tech', id: 'reel', slot: 1 },
    ] as Command[]) {
      const events = stepFor(sim, 1, [cmd]);
      expect(refusals(events)).toEqual([[(cmd as { id: string }).id, 'silenced']]);
      expect(ofType(events, 'techniqueCast')).toHaveLength(0);
    }
  });

  it('Rewind is refused too', () => {
    const { sim } = runed({ calling: { id: 'chronomancer', path: [] } });
    stepFor(sim, 30);
    const events = stepFor(sim, 1, [{ t: 'tech', id: 'reel', slot: 0 }]);
    expect(refusals(events)).toEqual([['rewind', 'silenced']]);
  });

  it('Glide, plant, the Thread, mode, Directives, Cue and Crescendo still work', () => {
    const { sim } = runed({
      chords: [
        { auras: [], ornaments: [] },
        { auras: ['sostenuto'], ornaments: ['pedal_point'] },
      ],
    });
    const ok = (cmds: Command[], type: SimEvent['type']) => {
      const events = stepFor(sim, 1, cmds);
      expect(refusals(events)).toEqual([]);
      expect(events.some((e) => e.type === type)).toBe(true);
    };
    ok([{ t: 'thread', slot: 0 }], 'threadAttached');
    ok([{ t: 'mode' }], 'threadModeChanged');
    ok([{ t: 'plant', point: { x: 4, z: 0 } }], 'fieldPlanted');
    ok([{ t: 'directive', kind: 'rally' }], 'directiveAck');
    stepFor(sim, 1, [
      { t: 'debug', op: { op: 'chargeSolos' } },
      { t: 'debug', op: { op: 'setResonance', value: 100 } },
    ]);
    ok([{ t: 'cue', slot: 1 }], 'cued');
    stepFor(sim, 1, [{ t: 'debug', op: { op: 'setResonance', value: 100 } }]);
    ok([{ t: 'crescendo' }], 'crescendoStart');
    ok([{ t: 'glide', x: 1, z: 0 }], 'glided');
  });

  it('a rune whose owner died under Stasis silences no one, and ends with it', () => {
    const { sim, w } = runed();
    const owner = w.entities.get(w.field.zones![0]!.owner)!;
    w.field.stasis = true;
    stepFor(sim, 5);
    expect(weaverSilenced(w)).toBe(true);
    // The heroes fight on under Stasis: the owner falls, its rune with it.
    killEnemy(w, owner, null);
    expect(weaverSilenced(w)).toBe(false);
    const events = stepFor(sim, 1, [{ t: 'tech', id: 'ward', slot: 0 }]);
    expect(refusals(events)).toEqual([]);
    expect(ofType(events, 'techniqueCast')).toHaveLength(1);
    expect(ofType(events, 'zoneEnded')).toEqual([expect.objectContaining({ zone: 99 })]);
    expect('zones' in w.field).toBe(false);
  });

  it('outside the rune every technique casts', () => {
    const { sim, w } = runed();
    w.field.zones![0]!.x += 20;
    const events = stepFor(sim, 1, [{ t: 'tech', id: 'ward', slot: 0 }]);
    expect(refusals(events)).toEqual([]);
    expect(ofType(events, 'techniqueCast')).toHaveLength(1);
  });

  it('heroes don’t call for a Ward or a Chime inside it; an Empower call is unaffected', () => {
    const { sim, w } = runed();
    stepFor(sim, 60 * 7);
    const ready = (slot: number) => {
      const e = heroAt(w, slot);
      const def = heroDef(e.hero!.defId);
      e.hero!.abilityCooldowns[def.call.ability] = def.call.answerTime * 0.9;
      e.hero!.callCooldown = 0;
      e.hero!.cast = null;
      w.internal.nextCallAt = 0;
      return canCall(w, e, def);
    };
    const zones = w.field.zones!;
    const answers = [0, 1, 2].map((s) => heroDef(heroAt(w, s).hero!.defId).call.answer);
    expect(answers).toEqual(['ward', 'empower', 'chime']);
    delete w.field.zones;
    expect([0, 1, 2].map(ready)).toEqual([true, true, true]);
    w.field.zones = zones;
    expect([0, 1, 2].map(ready)).toEqual([false, true, false]);
  });
});

describe('a possessed hero', () => {
  it('can’t be Cued', () => {
    const sim = sandbox();
    stepFor(sim, 1, [
      { t: 'debug', op: { op: 'chargeSolos' } },
      { t: 'debug', op: { op: 'setResonance', value: 100 } },
    ]);
    const w = worldOf(sim);
    addStatus(w, heroAt(w, 0), 'possessed', 5, null);
    sim.drainEvents();
    cue(w, 0);
    const events = sim.drainEvents();
    expect(ofType(events, 'techniqueRejected')).toEqual([
      expect.objectContaining({ technique: 'cue', reason: 'target' }),
    ]);
    expect(ofType(events, 'cued')).toHaveLength(0);
    // Another hero can.
    cue(w, 1);
    expect(ofType(sim.drainEvents(), 'cued')).toHaveLength(1);
  });

  it('loses the Solo pulses it misses: freed, they aren’t all fired at once', () => {
    const sim = sandbox();
    const w = worldOf(sim);
    const lyra = heroAt(w, 1);
    const foe = enemyOf(sim, 'hollow_chorister', lyra.x, lyra.z - 6);
    addStatus(w, foe, 'stun', 1e6, null);
    startSolo(w, lyra, false);
    // Her arrows as they are loosed (they land a flight later).
    const hits = (events: SimEvent[]) =>
      ofType(events, 'attackFired').filter((d) => d.source === lyra.id && d.target === foe.id);
    expect(hits(stepFor(sim, 3)).length).toBeGreaterThan(0);
    addStatus(w, lyra, 'possessed', 5, null);
    expect(hits(stepFor(sim, 60))).toEqual([]);
    expect(lyra.hero!.soloActive).toBeGreaterThan(0.5);
    removeStatus(w, lyra, 'possessed', 'freed');
    // Gale Barrage fires 12 a second: at most one in a tick, as before she was possessed.
    expect(hits(stepFor(sim, 1)).length).toBeLessThanOrEqual(1);
    expect(hits(stepFor(sim, 12)).length).toBeGreaterThan(0);
  });

  it('drops their call', () => {
    const sim = sandbox();
    stepFor(sim, 1, [{ t: 'debug', op: { op: 'forceCall', slot: 0 } }]);
    const w = worldOf(sim);
    const kael = heroAt(w, 0);
    expect(kael.hero!.call).not.toBeNull();
    tendCall(w, kael, false);
    expect(kael.hero!.call).not.toBeNull();
    addStatus(w, kael, 'possessed', 5, null);
    sim.drainEvents();
    tendCall(w, kael, false);
    expect(kael.hero!.call).toBeNull();
    expect(ofType(sim.drainEvents(), 'callEnded')).toEqual([
      expect.objectContaining({ hero: kael.id, reason: 'cancelled' }),
    ]);
  });
});

describe('a Reel frees the Stitched hero it pulls', () => {
  it('the Reeled one only', () => {
    const sim = sandbox();
    const w = worldOf(sim);
    const [kael, lyra] = [heroAt(w, 0), heroAt(w, 1)];
    addStatus(w, kael, 'stitched', 6, null);
    addStatus(w, lyra, 'stitched', 6, null);
    sim.drainEvents();
    castReel(w, 0);
    expect(hasStatus(kael, 'stitched')).toBe(false);
    expect(hasStatus(lyra, 'stitched')).toBe(true);
    const events = sim.drainEvents();
    expect(ofType(events, 'freed')).toEqual([
      expect.objectContaining({ hero: kael.id, status: 'stitched', by: 'reel' }),
    ]);
    expect(ofType(events, 'statusRemoved')).toEqual([
      expect.objectContaining({ target: kael.id, status: 'stitched', reason: 'freed' }),
    ]);
  });
});

describe('Unravel: your Mend wounds', () => {
  /** A sandbox with a dummy to name as Unravel's source, the hero in `slot` threaded. */
  function unravelled(config: Partial<SimConfig> = {}, slot: 0 | 1 | 2 = 0) {
    const sim = sandbox(config);
    stepFor(sim, 1, [{ t: 'debug', op: { op: 'spawnDummies', count: 1 } }]);
    const w = worldOf(sim);
    const source = [...w.entities.list()].find((e) => e.kind === 'dummy')!.id;
    thread(sim, slot);
    sim.drainEvents();
    const open = () => {
      w.field.unravel = { until: w.time + 5, source, acc: 0, tickIn: 0.5 };
    };
    return { sim, w, source, open };
  }

  it('Mend deals what it would have healed, every half second', () => {
    const { sim, w, source, open } = unravelled();
    const kael = heroAt(w, 0);
    dealDamage(w, kael, { source: null, sourceName: 'test', amount: 600, telegraph: null });
    open();
    const hp = kael.health!.hp;
    const events = stepFor(sim, 60);
    const ticks = ofType(events, 'damageTaken').filter((e) => e.source === source);
    expect(ticks).toHaveLength(2);
    for (const t of ticks) expect(t).toMatchObject({ source, hit: 'tick' });
    const perSec = CONTENT.thread.mendPerSec * w.mods.mendMult;
    expect(hp - kael.health!.hp).toBeCloseTo(perSec, 6);
    expect(
      ofType(events, 'healApplied').filter((e) => e.target === kael.id && e.via === 'mend'),
    ).toHaveLength(0);
  });

  it('holds the revive channel where it is', () => {
    const { sim, w, open } = unravelled({}, 1);
    const lyra = heroAt(w, 1);
    dealDamage(w, lyra, { source: null, sourceName: 'test', amount: 1e6, telegraph: null });
    expect(lyra.health!.downed).toBe(true);
    stepFor(sim, 30);
    const revive = lyra.health!.revive;
    expect(revive).toBeGreaterThan(0);
    open();
    const events = stepFor(sim, 60);
    expect(lyra.health!.revive).toBe(revive);
    expect(lyra.health!.downed).toBe(true);
    expect(ofType(events, 'revived')).toHaveLength(0);
  });

  it('leaves Empower and Bear alone', () => {
    const cases: [Partial<SimConfig>, { mode?: 'bear' }][] = [
      [{}, {}],
      [{ calling: { id: 'martyr', path: [] } }, { mode: 'bear' }],
    ];
    for (const [config, mode] of cases) {
      const { sim, w, source, open } = unravelled(config);
      stepFor(sim, 1, [{ t: 'mode', ...mode }]);
      expect(weaverEntity(w).weaver!.threadMode).not.toBe('mend');
      const kael = heroAt(w, 0);
      dealDamage(w, kael, { source: null, sourceName: 'test', amount: 300, telegraph: null });
      open();
      const hp = kael.health!.hp;
      const events = stepFor(sim, 60);
      expect(ofType(events, 'damageTaken').filter((e) => e.source === source)).toHaveLength(0);
      expect(kael.health!.hp).toBeGreaterThanOrEqual(hp);
      expect(w.field.unravel!.acc).toBe(0);
    }
  });

  it('no Relay heal while it runs', () => {
    const { sim, w, open } = unravelled({ motifs: [{ id: 'relay_weave', level: 1 }] });
    const lyra = heroAt(w, 1);
    dealDamage(w, lyra, { source: null, sourceName: 'test', amount: 300, telegraph: null });
    open();
    const events = stepFor(sim, 1, [{ t: 'thread', slot: 1 }]);
    expect(ofType(events, 'threadAttached')).toHaveLength(1);
    expect(ofType(events, 'healApplied').filter((e) => e.target === lyra.id)).toHaveLength(0);
  });

  it('under Stasis Mend heals as usual and the window waits', () => {
    const { sim, w, source, open } = unravelled({ calling: { id: 'chronomancer', path: [] } });
    stepFor(sim, 1, [{ t: 'debug', op: { op: 'setResonance', value: 100 } }]);
    stepFor(sim, 1, [{ t: 'crescendo' }]);
    expect(w.field.stasis).toBe(true);
    const kael = heroAt(w, 0);
    dealDamage(w, kael, { source: null, sourceName: 'test', amount: 600, telegraph: null });
    open();
    const until = w.field.unravel!.until;
    const t0 = w.time;
    const hp = kael.health!.hp;
    const events = stepFor(sim, 30);
    expect(kael.health!.hp).toBeGreaterThan(hp);
    expect(ofType(events, 'damageTaken').filter((e) => e.source === source)).toHaveLength(0);
    // The window waits as long as Stasis held it.
    expect(w.field.unravel!.until).toBeCloseTo(until + (w.time - t0), 9);
    expect(w.field.unravel!.acc).toBe(0);
  });
});

describe('Unravel: what Mend gathered stays with that stretch of Mend', () => {
  function opened() {
    const sim = sandbox();
    stepFor(sim, 1, [{ t: 'debug', op: { op: 'spawnDummies', count: 1 } }]);
    const w = worldOf(sim);
    const source = [...w.entities.list()].find((e) => e.kind === 'dummy')!.id;
    // Everyone beside the Weaver, so the Thread is never taut.
    place(weaverEntity(w), 0, 0);
    for (let s = 0; s < 3; s++) {
      const h = heroAt(w, s);
      place(h, s - 1, 1);
      addStatus(w, h, 'stun', 1e6, null);
      dealDamage(w, h, { source: null, sourceName: 'test', amount: 600, telegraph: null });
    }
    thread(sim, 0);
    w.field.unravel = { until: w.time + 5, source, acc: 0, tickIn: 0.5 };
    sim.drainEvents();
    const ticks = (events: SimEvent[]) =>
      ofType(events, 'damageTaken').filter((e) => e.source === source);
    return { sim, w, ticks };
  }

  it('moving the Thread drops it: the new hero takes only their own Mend, half a second on', () => {
    const { sim, w, ticks } = opened();
    const kael = heroAt(w, 0);
    const lyra = heroAt(w, 1);
    // 0.4 s of Mend gathered on Kael, not yet landed.
    expect(ticks(stepFor(sim, 24))).toEqual([]);
    expect(w.field.unravel!.acc).toBeGreaterThan(0);
    const kaelHp = kael.health!.hp;
    const lyraHp = lyra.health!.hp;
    const moved = stepFor(sim, 1, [{ t: 'thread', slot: 1 }]);
    expect(ofType(moved, 'threadAttached')).toHaveLength(1);
    // Not 0.1 s later with Kael's 0.4 s on top: a full half second of Lyra's own Mend.
    const early = stepFor(sim, 28);
    expect(ticks([...moved, ...early])).toEqual([]);
    const later = stepFor(sim, 2);
    expect(ticks(later)).toEqual([expect.objectContaining({ target: lyra.id })]);
    const perSec = CONTENT.thread.mendPerSec * w.mods.mendMult;
    expect(lyraHp - lyra.health!.hp).toBeCloseTo(perSec * 0.5, 6);
    expect(kael.health!.hp).toBe(kaelHp);
  });

  it('answering with Empower drops it: going back to Mend starts a fresh half second', () => {
    const { sim, w, ticks } = opened();
    const kael = heroAt(w, 0);
    expect(ticks(stepFor(sim, 24))).toEqual([]);
    expect(ticks(stepFor(sim, 1, [{ t: 'mode' }]))).toEqual([]);
    expect(weaverEntity(w).weaver!.threadMode).toBe('empower');
    expect(w.field.unravel!.acc).toBe(0);
    stepFor(sim, 30);
    const hp = kael.health!.hp;
    const back = stepFor(sim, 1, [{ t: 'mode' }]);
    expect(weaverEntity(w).weaver!.threadMode).toBe('mend');
    // The stale 0.4 s doesn't land as Mend resumes; the first tick is a whole half second later.
    expect(ticks([...back, ...stepFor(sim, 28)])).toEqual([]);
    expect(ticks(stepFor(sim, 2))).toEqual([expect.objectContaining({ target: kael.id })]);
    const perSec = CONTENT.thread.mendPerSec * w.mods.mendMult;
    expect(hp - kael.health!.hp).toBeCloseTo(perSec * 0.5, 6);
  });
});

describe('Steal Verse: a stolen aura sings for nothing', () => {
  const FOUR = [
    { auras: ['ostinato', 'fermata'], ornaments: ['grace_note'] },
    { auras: ['sostenuto', 'fortissimo'], ornaments: [] },
  ];
  const index = (id: string) => CONTENT.auras.findIndex((a) => a.id === id);

  function sung(steal: boolean) {
    const auras = structuredClone(CONTENT.auras);
    const sim = sandbox({ chords: FOUR });
    stepFor(sim, 1, [{ t: 'debug', op: { op: 'spawnDummies', count: 1 } }]);
    const w = worldOf(sim);
    const add = [...w.entities.list()].find((e) => e.kind === 'dummy')!.id;
    const reserved = weaverEntity(w).weaver!.reservedSpirit;
    const sovereign = w.calling;
    if (steal) w.field.stolen = { chord: 1, aura: 0, add, until: w.time + 30 };
    stepFor(sim, 2);
    expect(weaverEntity(w).weaver!.reservedSpirit).toBe(reserved);
    expect(w.calling).toEqual(sovereign);
    expect(w.field.auras).toEqual(['ostinato', 'fermata', 'sostenuto', 'fortissimo']);
    expect(w.field.chords[1]!.auras).toEqual(['sostenuto', 'fortissimo']);
    expect(CONTENT.auras).toEqual(auras);
    return { sim, w };
  }

  it('0 mult and no mask bit for it; the other auras sing on', () => {
    const plain = sung(false).w;
    const { w } = sung(true);
    const s = index('sostenuto');
    const f = index('fortissimo');
    expect(plain.scratch.auraMult[s]).toBeGreaterThan(0);
    expect(w.scratch.auraMult[s]).toBe(0);
    expect(w.scratch.auraFocus[s]).toBe(1);
    expect(w.scratch.auraEcho[s]).toBe(1);
    expect(w.scratch.auraMult[f]).toBe(plain.scratch.auraMult[f]);
    const bit = auraBit(CONTENT, 'sostenuto');
    const kael = heroAt(w, 0);
    expect(heroAt(plain, 0).hero!.auraMask & bit).toBe(bit);
    expect(kael.hero!.auraMask & bit).toBe(0);
    expect(kael.hero!.auraMask & auraBit(CONTENT, 'fortissimo')).not.toBe(0);
  });

  it('the chorus pulse counts one aura fewer', () => {
    for (const [steal, auras] of [
      [false, 4],
      [true, 3],
    ] as const) {
      const { sim } = sung(steal);
      stepFor(sim, 1, [
        { t: 'debug', op: { op: 'chargeSolos' } },
        { t: 'debug', op: { op: 'setResonance', value: 50 } },
      ]);
      const events = stepFor(sim, 1, [{ t: 'cue', slot: 0 }]);
      expect(ofType(events, 'chorusPulse')[0]).toMatchObject({ auras });
    }
  });
});

describe('the Silencing dome', () => {
  it('a Silencing elite carries the Mute’s dome; the same enemy without it doesn’t', () => {
    for (const silencing of [false, true]) {
      const sim = sandbox();
      const w = worldOf(sim);
      const elite = enemyOf(sim);
      if (silencing) elite.enemy!.affixes = ['silencing'];
      const weaver = weaverEntity(w);
      place(elite, weaver.x + 3, weaver.z);
      stepFor(sim, 1);
      expect(w.field.suppressed).toBe(silencing);
      expect(underMuteDome(w, weaver.x, weaver.z)).toBe(silencing);
    }
  });
});

describe('Stillwater Bell', () => {
  it('Chime recovers 2 s sooner, in a Rift fight', () => {
    const cooldown = (sim: Sim) => {
      const w = worldOf(sim);
      stepFor(sim, 1, [{ t: 'tech', id: 'chime', point: { x: 0, z: -2 } }]);
      return weaverEntity(w).weaver!.cooldownTotals.chime;
    };
    const plain = cooldown(rift());
    expect(cooldown(rift({ relics: ['stillwater_bell'] }))).toBeCloseTo(plain - 2, 9);
    // Carried into Movement I it sleeps.
    expect(cooldown(sandbox({ relics: ['stillwater_bell'] }))).toBe(cooldown(sandbox()));
  });

  it('a Chime that frees a possessed hero gives back half its Spirit', () => {
    const spent = (possessed: boolean) => {
      const sim = rift({ relics: ['stillwater_bell'] });
      const w = worldOf(sim);
      const kael = heroAt(w, 0);
      if (possessed) addStatus(w, kael, 'possessed', 5, null);
      const wv = weaverEntity(w).weaver!;
      wv.spirit = CONTENT.techniques.chime.cost + 5;
      const events = stepFor(sim, 60, [
        { t: 'tech', id: 'chime', point: { x: kael.x, z: kael.z } },
      ]);
      expect(ofType(events, 'chimeLanded')).toHaveLength(1);
      expect(hasStatus(kael, 'possessed')).toBe(false);
      return { spirit: wv.spirit, events, w };
    };
    const plain = spent(false);
    const freed = spent(true);
    const cost = CONTENT.techniques.chime.cost;
    expect(freed.spirit - plain.spirit).toBeCloseTo(cost * 0.5, 6);
    expect(ofType(freed.events, 'freed')).toEqual([
      expect.objectContaining({ status: 'possessed', by: 'chime' }),
    ]);
    // The refund is heard; a Chime that frees nobody refunds nothing and is silent.
    expect(ofType(freed.events, 'relicTriggered')).toEqual([
      expect.objectContaining({ relic: 'stillwater_bell', hero: null }),
    ]);
    expect(ofType(plain.events, 'relicTriggered')).toEqual([]);
  });

  it('half of what the Chime really cost: a Chime cast in Stasis refunds half its Stasis price', () => {
    const stasisMult = 0.6;
    const spent = (possessed: boolean, relic: boolean) => {
      const sim = rift(relic ? { relics: ['stillwater_bell'] } : {});
      const w = worldOf(sim);
      const kael = heroAt(w, 0);
      if (possessed) addStatus(w, kael, 'possessed', 5, null);
      const wv = weaverEntity(w).weaver!;
      wv.spirit = CONTENT.techniques.chime.cost + 5;
      w.mods.stasisCostMult = stasisMult;
      // Cast in Stasis; Stasis ends while the Chime flies, so the refund can't read it at landing.
      w.field.stasis = true;
      const events = stepFor(sim, 1, [{ t: 'tech', id: 'chime', point: { x: kael.x, z: kael.z } }]);
      expect(ofType(events, 'chimeLaunched')).toHaveLength(1);
      if (relic)
        expect(w.chimes[0]!.paid).toBeCloseTo(CONTENT.techniques.chime.cost * stasisMult, 9);
      else expect('paid' in w.chimes[0]!).toBe(false);
      w.field.stasis = false;
      events.push(...stepFor(sim, 60));
      expect(ofType(events, 'chimeLanded')).toHaveLength(1);
      expect(hasStatus(kael, 'possessed')).toBe(false);
      return wv.spirit;
    };
    const cost = CONTENT.techniques.chime.cost;
    expect(spent(true, true) - spent(false, true)).toBeCloseTo(cost * stasisMult * 0.5, 6);
    // Without the relic, freeing gives nothing back and the Chime carries no `paid`.
    expect(spent(true, false)).toBeCloseTo(spent(false, false), 9);
  });
});

describe('the Rift relics sleep outside a Movement III fight', () => {
  const carried = {
    relics: RIFT_RELICS,
    motifs: [{ id: 'guard_strand', level: 3 }],
  };

  it('in Movements I and II they leave the mods and the fight exactly as without them', () => {
    for (const encounter of ['sandbox', 'first_light', 'crimson_gate']) {
      const base = { seed: 11, encounter, auras: ['sostenuto'] } as SimConfig;
      const a = createSim(base);
      const b = createSim({ ...base, ...carried });
      expect(worldOf(b).mods).toEqual(worldOf(a).mods);
      // Carried all the same.
      expect(b.state.relics.ids).toEqual(RIFT_RELICS);
      const run = (sim: Sim) => {
        const out: SimEvent[] = [];
        for (let i = 0; i < 60 * 20; i++) {
          sim.step([]);
          out.push(...sim.drainEvents());
        }
        return out;
      };
      expect(run(b)).toEqual(run(a));
      // The fight's hash differs only by what was carried: the config's relics and motif, and
      // the relic ids `world.relics` lists (each sleeping one never triggered).
      const wa = worldOf(a);
      const wb = worldOf(b);
      expect(hashWorld(wb)).not.toBe(hashWorld(wa));
      for (const id of RIFT_RELICS) expect(wb.relics.triggers[id]).toBe(0);
      const carriedBy = wb as { config: World['config']; relics: World['relics'] };
      const own = { config: wb.config, relics: wb.relics };
      carriedBy.config = wa.config;
      carriedBy.relics = wa.relics;
      try {
        expect(hashWorld(wb)).toBe(hashWorld(wa));
      } finally {
        carriedBy.config = own.config;
        carriedBy.relics = own.relics;
      }
    }
  });

  it('in a Rift fight they wake', () => {
    const plain = worldOf(rift()).mods;
    const mods = worldOf(rift(carried)).mods;
    expect(plain).toMatchObject({
      sacrificialLamb: 0,
      cutLockMult: 1,
      cutResonance: 0,
      chimeCooldownCut: 0,
      stillwaterBell: 0,
      guardStrand: 0,
    });
    expect(mods).toMatchObject({
      sacrificialLamb: 1,
      cutLockMult: 0.5,
      cutResonance: 10,
      chimeCooldownCut: 2,
      stillwaterBell: 1,
      stillwaterRefund: 0.5,
      guardStrand: CONTENT.motifs.find((m) => m.id === 'guard_strand')!.values[2],
    });
  });
});

/**
 * Integration (W1 × W2): the enemy side's cut verdict (telegraphs.ts) against the Weaver side's
 * real cutThread, with nothing mocked, and the silence in a down's readyTechniques (health.ts).
 */
describe('the cut verdict, end to end', () => {
  /** Weaver at (0, 0), Lyra threaded at (0, 10), everyone held still; a Shears at (6, 5). */
  function setup() {
    const sim = sandbox();
    const w = worldOf(sim);
    place(weaverEntity(w), 0, 0);
    place(heroAt(w, 0), 8, 4);
    place(heroAt(w, 1), 0, 10);
    place(heroAt(w, 2), -8, 4);
    for (let s = 0; s < 3; s++) {
      addStatus(w, heroAt(w, s), 'stun', 1e6, null);
      heroAt(w, s).health!.hp = heroAt(w, s).health!.maxHp = 1e6;
    }
    thread(sim, 1);
    const shears = enemyOf(sim, 'shears', 6, 5);
    shears.enemy!.attackCooldown = 1e6;
    shears.enemy!.specialCooldowns = shears.enemy!.specialCooldowns.map(() => 1e6);
    sim.drainEvents();
    return { sim, w, shears };
  }

  function dash(sim: Sim, w: World, shears: Entity) {
    expect(beginAttack(w, shears, attackDef('shears_dash'), null)).toBe(true);
    const t = w.telegraphs.at(-1)!;
    return { t, resolve: () => stepUntilEnded(sim, t.id) };
  }

  function stepUntilEnded(sim: Sim, id: number): SimEvent[] {
    const out: SimEvent[] = [];
    for (let i = 0; i < 60 * 5; i++) {
      const ev = stepFor(sim, 1);
      out.push(...ev);
      if (ev.some((e) => e.type === 'telegraphEnded' && e.telegraph === id)) break;
    }
    return out;
  }

  it('a dash whose line crosses the Thread when it lands cuts it: one verdict, one snap', () => {
    const { sim, w, shears } = setup();
    const { t, resolve } = dash(sim, w, shears);
    const events = resolve();
    expect(ofType(events, 'cutResolved')).toEqual([
      expect.objectContaining({ telegraph: t.id, cause: 'shears', result: 'cut' }),
    ]);
    expect(ofType(events, 'threadSnapped')).toEqual([
      expect.objectContaining({ target: heroAt(w, 1).id, cause: 'shears', by: shears.id }),
    ]);
    expect(weaverEntity(w).weaver!.threadSlot).toBeNull();
  });

  it('a cut needs a crossing at resolution: a Thread moved off the line is held', () => {
    const { sim, w, shears } = setup();
    const { t, resolve } = dash(sim, w, shears);
    // Both ends of the Thread below the line (z = 5) before it lands.
    place(heroAt(w, 1), 0, 2);
    const events = resolve();
    expect(ofType(events, 'cutResolved')).toEqual([
      expect.objectContaining({ telegraph: t.id, cause: 'shears', result: 'held' }),
    ]);
    expect(ofType(events, 'threadSnapped')).toEqual([]);
    expect(weaverEntity(w).weaver!.threadSlot).toBe(1);
  });

  it('Guard Strand turns the dash aside: the verdict is strand and the Thread holds', () => {
    // Guard Strand sleeps outside a Movement III fight.
    const sim = rift({ motifs: [{ id: 'guard_strand', level: 1 }] });
    const w = worldOf(sim);
    expect(w.mods.guardStrand).toBeGreaterThan(0);
    place(weaverEntity(w), 0, 0);
    place(heroAt(w, 1), 0, 10);
    for (let s = 0; s < 3; s++) addStatus(w, heroAt(w, s), 'stun', 1e6, null);
    heroAt(w, 1).health!.hp = heroAt(w, 1).health!.maxHp = 1e6;
    thread(sim, 1);
    const shears = enemyOf(sim, 'shears', 6, 5);
    shears.enemy!.attackCooldown = 1e6;
    shears.enemy!.specialCooldowns = shears.enemy!.specialCooldowns.map(() => 1e6);
    const { t, resolve } = dash(sim, w, shears);
    const events = resolve();
    expect(ofType(events, 'cutResolved')).toEqual([
      expect.objectContaining({ telegraph: t.id, result: 'strand' }),
    ]);
    expect(ofType(events, 'threadSnapped')).toEqual([]);
    expect(weaverEntity(w).weaver!.threadSlot).toBe(1);
  });

  /**
   * A Severing Shears 1.5 m from the Thread, dashing along z = 5 through Kael at (-3, 5): the
   * blow lands on Kael, so Severing is owed on the same resolution as the dash's own verdict.
   */
  function severingDash() {
    const { sim, w, shears } = setup();
    place(shears, 1.5, 5);
    place(heroAt(w, 0), -3, 5);
    shears.enemy!.affixes = ['severing'];
    const kaelHp = heroAt(w, 0).health!.hp;
    const { t, resolve } = dash(sim, w, shears);
    return { sim, w, shears, t, resolve, kaelHp };
  }

  it('a Severing Shears whose dash cuts the Thread: the verdict is cut, not held', () => {
    const { w, shears, t, resolve, kaelHp } = severingDash();
    const events = resolve();
    // The blow landed (so Severing was owed) …
    expect(heroAt(w, 0).health!.hp).toBeLessThan(kaelHp);
    // … but the dash's own verdict comes first: it cut, and Severing found nothing left to cut.
    expect(ofType(events, 'cutResolved')).toEqual([
      expect.objectContaining({ telegraph: t.id, cause: 'shears', result: 'cut' }),
    ]);
    expect(ofType(events, 'threadSnapped')).toEqual([
      expect.objectContaining({ target: heroAt(w, 1).id, cause: 'shears', by: shears.id }),
    ]);
    // Its 3 s clock is spent only on a cut it made.
    expect(w.internal.m3?.severAt?.[shears.id]).toBeUndefined();
  });

  it('a Severing Shears dash Guard Strand turns aside takes its Severing with it: one Strand, one saved Thread', () => {
    const { w, shears, t, resolve, kaelHp } = severingDash();
    // Guard Strand held (staged: the sandbox isn't a Rift fight, where it would sleep).
    w.mods.guardStrand = 1.5;
    const events = resolve();
    // The blow landed, so Severing was owed on the same resolution …
    expect(heroAt(w, 0).health!.hp).toBeLessThan(kaelHp);
    // … but the Strand that turned the dash aside turns the blow's Severing aside too.
    expect(ofType(events, 'cutResolved')).toEqual([
      expect.objectContaining({ telegraph: t.id, cause: 'shears', result: 'strand' }),
    ]);
    expect(ofType(events, 'threadSnapped')).toEqual([]);
    expect(weaverEntity(w).weaver!.threadSlot).toBe(1);
    // Drawn once, where the Thread came closest to the elite, and spent once.
    expect(ofType(events, 'strandBlocked')).toEqual([
      expect.objectContaining({ source: shears.id }),
    ]);
    const strandAt = w.internal.guardStrandAt!;
    expect(strandAt).toBeGreaterThan(w.time);
    expect(strandAt).toBeLessThanOrEqual(w.time + 1.5);
    // Its Severing clock runs as for any Severing a Strand turned aside (stamped the same tick).
    expect(w.internal.m3!.severAt![shears.id]).toBeCloseTo(strandAt - 1.5 + 3, 9);
  });

  it('a Severing Shears whose dash misses the Thread: held, then Severing cuts it', () => {
    const { w, shears, t, resolve, kaelHp } = severingDash();
    // The Thread pulled below the line (z = 5 ± 0.6), but still within Severing's reach.
    place(heroAt(w, 1), 0, 3.6);
    const events = resolve();
    expect(heroAt(w, 0).health!.hp).toBeLessThan(kaelHp);
    expect(ofType(events, 'cutResolved')).toEqual([
      expect.objectContaining({ telegraph: t.id, cause: 'shears', result: 'held' }),
    ]);
    expect(ofType(events, 'threadSnapped')).toEqual([
      expect.objectContaining({ target: heroAt(w, 1).id, cause: 'severing', by: shears.id }),
    ]);
    // The verdict is reported before the Severing cut that followed it.
    const order = events
      .filter((e) => e.type === 'cutResolved' || e.type === 'threadSnapped')
      .map((e) => e.type);
    expect(order).toEqual(['cutResolved', 'threadSnapped']);
    expect(w.internal.m3!.severAt![shears.id]).toBeCloseTo(w.time + 3, 9);
  });

  it('a hero who goes down inside a Null rune had none of Ward, Chime or Reel ready', () => {
    const readyAtDown = (runed: boolean) => {
      const sim = sandbox();
      const w = worldOf(sim);
      const owner = enemyOf(sim);
      const weaver = weaverEntity(w);
      if (runed)
        w.field.zones = [
          { id: 99, kind: 'null', owner: owner.id, x: weaver.x, z: weaver.z, r: 5, until: 1e9 },
        ];
      const kael = heroAt(w, 0);
      dealDamage(w, kael, { source: owner.id, sourceName: 'test', amount: 1e6, telegraph: null });
      expect(kael.health!.downed).toBe(true);
      return w.ledger.deaths.find((d) => d.hero === kael.id)!.readyTechniques;
    };
    expect(readyAtDown(false)).toEqual(expect.arrayContaining(['ward', 'chime', 'reel']));
    expect(readyAtDown(true)).toEqual([]);
  });
});
