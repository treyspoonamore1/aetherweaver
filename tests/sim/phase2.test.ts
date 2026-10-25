/**
 * Phase 2: Chords and ornaments, Fermata, the chorus pulse, Call and Response and the
 * "without you" re-run (docs/phase-2.md).
 */
import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../src/content';
import {
  chordProblems,
  createSim,
  parseReplay,
  ReplayRecorder,
  runReplay,
  runWithoutYou,
} from '../../src/sim';
import { auraBit, heroFx } from '../../src/sim/combat/auras';
import { addStatus } from '../../src/sim/combat/health';
import { hero, hurt, ofType, sandbox, spawn, stepFor, weaver, worldOf } from './helpers';

const bit = (id: string) => auraBit(CONTENT, id);
const partyOf = (sim: ReturnType<typeof createSim>) =>
  sim.state.party.map((id) => sim.state.entities.get(id)!);

describe('Chords and ornaments', () => {
  it('reads `auras` as Chord I, keeps ornaments, and refuses illegal loadouts', () => {
    expect(createSim({ seed: 1, auras: ['sostenuto'] }).config.chords).toEqual([
      { auras: ['sostenuto'], ornaments: [] },
    ]);
    const two = [
      { auras: ['ostinato', 'fermata'], ornaments: ['grace_note', 'reverb'] },
      { auras: ['sostenuto'], ornaments: [] },
    ];
    expect(createSim({ seed: 1, chords: two }).config.chords).toEqual(two);
    expect(chordProblems(two)).toEqual([]);
    const bad = (chords: { auras: string[]; ornaments: string[] }[]) => chordProblems(chords);
    expect(bad([{ auras: ['sostenuto', 'ostinato', 'allegro'], ornaments: [] }])).toHaveLength(1);
    expect(
      bad([
        { auras: ['sostenuto'], ornaments: [] },
        { auras: ['sostenuto'], ornaments: [] },
      ]),
    ).not.toEqual([]);
    expect(
      bad([
        { auras: ['sostenuto'], ornaments: ['grace_note'] },
        { auras: ['ostinato'], ornaments: ['grace_note'] },
      ]),
    ).not.toEqual([]);
    expect(bad([{ auras: ['allegro'], ornaments: ['unison', 'pedal_point'] }])).not.toEqual([]);
    expect(
      bad([
        { auras: ['ostinato', 'fortissimo'], ornaments: [] },
        { auras: ['sostenuto', 'allegro'], ornaments: [] },
      ]),
    ).toContain('Your Chords reserve more Spirit than you have.');
    expect(() =>
      createSim({ seed: 1, chords: [{ auras: ['sostenuto', 'ostinato', 'allegro'] }] }),
    ).toThrow(/Illegal Chords/);
  });

  it('Grace Note cuts the reservation; Reverb widens the field, up to the cap', () => {
    const grace = sandbox({
      chords: [{ auras: ['ostinato', 'fortissimo'], ornaments: ['grace_note'] }],
    });
    expect(weaver(grace).weaver!.reservedSpirit).toBeCloseTo(60 * 0.7, 6);
    expect(heroFx(worldOf(grace), worldOf(grace).entities.get(grace.state.party[0]!)!).damage).toBe(
      0,
    );
    stepFor(grace, 2);
    expect(
      heroFx(worldOf(grace), worldOf(grace).entities.get(grace.state.party[0]!)!).damage,
    ).toBeCloseTo(0.18 * 0.9, 9);

    const reverb = sandbox({ chords: [{ auras: ['sostenuto'], ornaments: ['reverb'] }] });
    stepFor(reverb, 1);
    expect(reverb.state.field.chords[0]!.radius).toBeCloseTo(8 * 1.4, 9);
    expect(reverb.state.field.radius).toBeCloseTo(8 * 1.4, 9);
    // Second Verse (+field radius) can't push it past the 14 m cap.
    const capped = sandbox({
      chords: [{ auras: ['sostenuto'], ornaments: ['reverb'] }],
      motifs: [{ id: 'second_verse', level: 3 }],
    });
    stepFor(capped, 1);
    expect(capped.state.field.chords[0]!.radius).toBeLessThanOrEqual(CONTENT.weaver.fieldRadiusCap);
  });

  it('Pedal Point plants the field where commanded, within range and on a cooldown', () => {
    const sim = sandbox({ chords: [{ auras: ['sostenuto'], ornaments: ['pedal_point'] }] });
    stepFor(sim, 1);
    const chord = () => sim.state.field.chords[0]!;
    expect(chord().anchor).toBe('planted');
    expect(chord().radius).toBeCloseTo(8 * 0.85, 9);
    let events = stepFor(sim, 1, [{ t: 'plant', point: { x: 3, z: 2 } }]);
    expect(ofType(events, 'fieldPlanted')).toHaveLength(1);
    expect([chord().x, chord().z]).toEqual([3, 2]);
    events = stepFor(sim, 1, [{ t: 'plant', point: { x: -3, z: 0 } }]);
    expect(ofType(events, 'techniqueRejected')[0]).toMatchObject({
      technique: 'plant',
      reason: 'cooldown',
    });
    // The field stays put while the Weaver walks away.
    stepFor(sim, 60, [{ t: 'move', x: 1, z: 0 }]);
    expect([chord().x, chord().z]).toEqual([3, 2]);
    stepFor(sim, 90, [{ t: 'move', x: 0, z: 0 }]);
    stepFor(sim, 1, [{ t: 'plant', point: { x: -200, z: 0 } }]);
    const w = weaver(sim);
    expect(Math.hypot(chord().x - w.x, chord().z - w.z)).toBeLessThanOrEqual(
      CONTENT.weaver.plantRange + 1e-6,
    );
    // Without a Pedal Point Chord, planting is refused.
    const plain = sandbox({ auras: ['sostenuto'] });
    events = stepFor(plain, 1, [{ t: 'plant', point: { x: 1, z: 1 } }]);
    expect(ofType(events, 'techniqueRejected')[0]).toMatchObject({ reason: 'not-ready' });
  });

  it('Unison rides the Thread: only the threaded hero, at 2.5×', () => {
    const sim = sandbox({ chords: [{ auras: ['fortissimo'], ornaments: ['unison'] }] });
    stepFor(sim, 2);
    expect(partyOf(sim).map((h) => h.hero!.auraMask)).toEqual([0, 0, 0]);
    stepFor(sim, 2, [{ t: 'thread', slot: 1 }]);
    expect(partyOf(sim).map((h) => h.hero!.auraMask)).toEqual([0, bit('fortissimo'), 0]);
    const w = worldOf(sim);
    expect(heroFx(w, w.entities.get(sim.state.party[1]!)!).damage).toBeCloseTo(0.18 * 2.5, 9);
    expect(sim.state.field.chords[0]!.threadHero).toBe(sim.state.party[1]);
    stepFor(sim, 2, [{ t: 'thread', slot: 0 }]);
    expect(partyOf(sim).map((h) => h.hero!.auraMask)).toEqual([bit('fortissimo'), 0, 0]);
  });

  it('a Unison hex lulls whatever attacks the threaded hero', () => {
    const sim = sandbox({ chords: [{ auras: ['lullaby'], ornaments: ['unison'] }] });
    stepFor(sim, 1, [spawn('bell_brute', 0, -3)]);
    stepFor(sim, 90);
    const brute = sim.state.entities.list().find((e) => e.enemy)!;
    const targetSlot = sim.state.party.indexOf(brute.enemy!.targetId!);
    expect(targetSlot).toBeGreaterThanOrEqual(0);
    stepFor(sim, 2, [{ t: 'thread', slot: targetSlot as 0 | 1 | 2 }]);
    expect(brute.enemy!.auraMask).toBe(bit('lullaby'));
    expect(partyOf(sim).every((h) => h.hero!.auraMask === 0)).toBe(true);
  });

  it('Mute domes silence the song inside them; a Weaver inside one silences every Chord', () => {
    const sim = sandbox({ auras: ['sostenuto'] });
    stepFor(sim, 2);
    const kael = hero(sim, 0);
    expect(kael.hero!.auraMask).toBe(bit('sostenuto'));
    stepFor(sim, 1, [spawn('mute', kael.x + 1, kael.z)]);
    stepFor(sim, 2);
    expect(kael.hero!.auraMask).toBe(0);
    const mute = sim.state.entities.list().find((e) => e.enemy)!;
    stepFor(sim, 2, [{ t: 'debug', op: { op: 'teleportWeaver', x: mute.x, z: mute.z + 1 } }]);
    expect(sim.state.field.suppressed).toBe(true);
    expect(partyOf(sim).every((h) => h.hero!.auraMask === 0)).toBe(true);
  });

  it('the Crescendo grows every field by half and doubles every aura', () => {
    const sim = sandbox({ chords: [{ auras: ['fortissimo'], ornaments: ['reverb'] }] });
    stepFor(sim, 1, [{ t: 'debug', op: { op: 'setResonance', value: 100 } }]);
    stepFor(sim, 2, [{ t: 'crescendo' }]);
    expect(sim.state.field.chords[0]!.radius).toBeCloseTo(8 * 1.4 * 1.5, 6);
    const w = worldOf(sim);
    expect(heroFx(w, w.entities.get(sim.state.party[0]!)!).damage).toBeCloseTo(0.18 * 0.9 * 2, 9);
  });
});

describe('Fermata', () => {
  const fermata = { chords: [{ auras: ['fermata'], ornaments: [] }] };

  it('heroes low on life take less damage', () => {
    const sim = sandbox(fermata);
    stepFor(sim, 2);
    const lyra = hero(sim, 1);
    hurt(sim, 1, lyra.health!.maxHp * 0.7);
    const before = lyra.health!.hp;
    hurt(sim, 1, 100);
    expect(before - lyra.health!.hp).toBeCloseTo(70, 6);
  });

  it('holds a lethal hit once per fight; Mending during the hold is a Save', () => {
    const sim = sandbox(fermata);
    stepFor(sim, 2, [{ t: 'thread', slot: 1 }]);
    const lyra = hero(sim, 1);
    hurt(sim, 1, 5000);
    expect(lyra.health!.hp).toBe(1);
    expect(lyra.health!.downed).toBe(false);
    expect(lyra.hero!.hold).not.toBeNull();
    // Still held: nothing takes them below 1.
    hurt(sim, 1, 5000);
    expect(lyra.health!.hp).toBe(1);
    const events = stepFor(sim, 120);
    expect(ofType(events, 'fermataReleased')).toEqual([expect.objectContaining({ saved: true })]);
    expect(ofType(events, 'save')[0]).toMatchObject({
      cause: 'fermata',
      counterfactualDamage: 5000,
    });
    expect(sim.state.ledger.holds).toBe(1);
    expect(lyra.health!.downed).toBe(false);
    expect(lyra.health!.hp).toBeGreaterThan(50);
    // Once per encounter.
    hurt(sim, 1, 5000);
    expect(lyra.health!.downed).toBe(true);
  });

  it('a hold that ends with other statuses on the hero resolves cleanly', () => {
    // Statuses before 'held' in the list: going down rewrites the list mid-update.
    const sim = sandbox(fermata);
    stepFor(sim, 2);
    const w = worldOf(sim);
    const lyra = w.entities.get(sim.state.party[1]!)!;
    addStatus(w, lyra, 'silence', 3, null);
    hurt(sim, 1, 5000);
    expect(lyra.health!.statuses.map((x) => x.id)).toEqual(['silence', 'held']);
    const events = stepFor(sim, 120);
    expect(ofType(events, 'fermataReleased')).toEqual([expect.objectContaining({ saved: false })]);
    expect(lyra.health!.downed).toBe(true);
    expect(lyra.health!.statuses).toEqual([]);
  });

  it('an unhealed hold goes down when it ends — passive regeneration does not save them', () => {
    const sim = sandbox({ chords: [{ auras: ['fermata', 'sostenuto'], ornaments: [] }] });
    stepFor(sim, 2);
    hurt(sim, 2, 5000);
    const events = stepFor(sim, 120);
    expect(ofType(events, 'fermataReleased')).toEqual([expect.objectContaining({ saved: false })]);
    expect(hero(sim, 2).health!.downed).toBe(true);
    expect(ofType(events, 'save')).toHaveLength(0);
  });
});

describe('the chorus pulse', () => {
  it('a Cue with three or more auras heals and shields everyone in a field', () => {
    const three = [
      { auras: ['ostinato', 'fermata'], ornaments: ['grace_note'] },
      { auras: ['sostenuto'], ornaments: [] },
    ];
    const sim = sandbox({ chords: three });
    stepFor(sim, 2, [
      { t: 'debug', op: { op: 'chargeSolos' } },
      { t: 'debug', op: { op: 'setResonance', value: 50 } },
    ]);
    hurt(sim, 1, 400);
    const before = hero(sim, 1).health!.hp;
    const events = stepFor(sim, 1, [{ t: 'cue', slot: 0 }]);
    expect(ofType(events, 'chorusPulse')[0]).toMatchObject({ auras: 3, reached: 3 });
    expect(hero(sim, 1).health!.hp).toBeGreaterThan(before);
    expect(hero(sim, 1).health!.shields.some((s) => s.kind === 'overshield')).toBe(true);

    const two = sandbox({ auras: ['sostenuto', 'fortissimo'] });
    stepFor(two, 2, [
      { t: 'debug', op: { op: 'chargeSolos' } },
      { t: 'debug', op: { op: 'setResonance', value: 50 } },
    ]);
    expect(ofType(stepFor(two, 1, [{ t: 'cue', slot: 0 }]), 'chorusPulse')).toHaveLength(0);
  });
});

describe('Call and Response', () => {
  /** A sandbox with a pack in front of the party, fighting. */
  function fight() {
    const sim = sandbox({ auras: ['sostenuto'] });
    stepFor(sim, 1, [
      spawn('hollow_chorister', 0, -4),
      spawn('hollow_chorister', 1, -4),
      spawn('bell_brute', -1, -5),
    ]);
    stepFor(sim, 90);
    return sim;
  }

  /** Steps until the call is settled (Flourish, or ended), up to 8 s. */
  function settle(sim: ReturnType<typeof fight>, first: Parameters<typeof stepFor>[2] = []) {
    return stepFor(sim, 60 * 8, first);
  }

  it('Kael calls for a Ward; Warding him makes his Challenge a Bulwark', () => {
    const sim = fight();
    // Loose enemies on the back line, so the Challenge has someone to pull.
    stepFor(sim, 30, [spawn('hollow_chorister', 4, 4), spawn('hollow_chorister', -4, 4)]);
    let events = stepFor(sim, 1, [{ t: 'debug', op: { op: 'forceCall', slot: 0 } }]);
    expect(ofType(events, 'callStarted')[0]).toMatchObject({ answer: 'ward', flourish: 'Bulwark' });
    const resonance = weaver(sim).weaver!.resonance;
    events = settle(sim, [{ t: 'tech', id: 'ward', slot: 0 }]);
    expect(ofType(events, 'callAnswered')[0]).toMatchObject({ answer: 'ward' });
    expect(ofType(events, 'flourish')[0]).toMatchObject({ name: 'Bulwark' });
    expect(ofType(events, 'flourish')[0]!.radius).toBeCloseTo(7 * 1.5, 9);
    const kaelId = sim.state.party[0];
    expect(
      ofType(events, 'shieldApplied').some(
        (x) => x.target === kaelId && x.shield === 'overshield' && x.fromWeaver,
      ),
    ).toBe(true);
    expect(sim.state.ledger.responses).toBe(1);
    expect(weaver(sim).weaver!.resonance).toBeGreaterThan(resonance);
    expect(sim.state.ledger.markers.some((m) => m.kind === 'response')).toBe(true);
  });

  it('Empower answers Lyra: Heartseeker always crits and counts as the Weaver’s damage', () => {
    const sim = fight();
    const events = settle(sim, [
      { t: 'debug', op: { op: 'forceCall', slot: 1 } },
      { t: 'thread', slot: 1 },
      { t: 'mode' },
    ]);
    expect(ofType(events, 'callAnswered')[0]).toMatchObject({ answer: 'empower' });
    const flourish = ofType(events, 'flourish')[0]!;
    expect(flourish.name).toBe('Heartseeker');
    const lyraId = sim.state.party[1];
    const hits = ofType(events, 'damageTaken').filter(
      (d) => d.source === lyraId && d.tick === flourish.tick,
    );
    expect(hits.length).toBeGreaterThan(0);
    for (const h of hits) {
      expect(h.crit).toBe(true);
      expect(h.amplified).toBeGreaterThan(0);
    }
  });

  it('Vexis wants a Chime on her; a Chime elsewhere does not count', () => {
    const sim = fight();
    stepFor(sim, 1, [{ t: 'debug', op: { op: 'forceCall', slot: 2 } }]);
    const vexis = hero(sim, 2);
    let events = stepFor(sim, 30, [
      { t: 'tech', id: 'chime', point: { x: vexis.x + 12, z: vexis.z + 12 } },
    ]);
    expect(ofType(events, 'callAnswered')).toHaveLength(0);
    // Cooldowns are long; stage a fresh Chime.
    worldOf(sim).entities.get(sim.state.weaverId)!.weaver!.cooldowns.chime = 0;
    events = stepFor(sim, 30, [{ t: 'tech', id: 'chime', point: { x: vexis.x, z: vexis.z } }]);
    expect(ofType(events, 'callAnswered')[0]).toMatchObject({ answer: 'chime' });
  });

  it('an unanswered call ends quietly and the hero uses the plain ability', () => {
    const sim = fight();
    // Vexis waits 3 s for a Chime, then casts the plain two-second Starbolt.
    const events = settle(sim, [{ t: 'debug', op: { op: 'forceCall', slot: 2 } }]);
    const ended = ofType(events, 'callEnded')[0]!;
    expect(ended.reason).toBe('missed');
    expect(ofType(events, 'flourish')).toHaveLength(0);
    const vexisId = sim.state.party[2];
    expect(
      ofType(events, 'attackFired').some(
        (a) => a.source === vexisId && a.visual === 'starbolt' && a.tick === ended.tick,
      ),
    ).toBe(true);
  });

  it('a stunned caller drops the call', () => {
    const sim = fight();
    stepFor(sim, 1, [{ t: 'debug', op: { op: 'forceCall', slot: 0 } }]);
    const w = worldOf(sim);
    addStatus(w, w.entities.get(sim.state.party[0]!)!, 'stun', 1, null);
    const events = stepFor(sim, 2);
    expect(ofType(events, 'callEnded')[0]).toMatchObject({ reason: 'cancelled' });
    expect(hero(sim, 0).hero!.call).toBeNull();
  });

  it('heroes call on their own in a real fight, spaced out, and never without a Weaver', () => {
    const sim = createSim({
      seed: 21,
      encounter: 'tolling_halls',
      auras: ['sostenuto', 'fortissimo'],
    });
    const events = stepFor(sim, 60 * 60);
    const calls = ofType(events, 'callStarted');
    expect(calls.length).toBeGreaterThan(0);
    for (let i = 1; i < calls.length; i++) {
      expect(calls[i]!.tick - calls[i - 1]!.tick).toBeGreaterThanOrEqual(
        (CONTENT.calls.gap + 2) * 60 - 1,
      );
    }
    const alone = createSim({ seed: 21, encounter: 'tolling_halls', absent: true });
    expect(ofType(stepFor(alone, 60 * 40), 'callStarted')).toHaveLength(0);
  });
});

describe('"without you"', () => {
  it('the absent Weaver has no Chords, is never targeted, and the re-run is deterministic', () => {
    const config = {
      seed: 11,
      encounter: 'first_light',
      chords: [{ auras: ['sostenuto', 'fortissimo'] }],
    };
    const sim = createSim({ ...config, absent: true });
    expect(sim.config.chords).toEqual([]);
    for (let i = 0; i < 60 * 40 && sim.state.encounter.status !== 'defeat'; i++) {
      sim.step();
      for (const e of sim.state.entities.list())
        if (e.enemy) expect(e.enemy.targetId).not.toBe(sim.state.weaverId);
    }
    expect(weaver(sim).health!.hp).toBe(CONTENT.weaver.maxLife);
    const a = runWithoutYou(config);
    const b = runWithoutYou(config);
    expect(a).toEqual(b);
    expect(a.outcome).toBe('defeat');
    expect(a.standing).toBe(0);
  });
});

describe('replays', () => {
  it('record and replay planting and the staging commands', () => {
    const sim = createSim({
      seed: 5,
      encounter: 'sandbox',
      debug: true,
      chords: [{ auras: ['sostenuto'], ornaments: ['pedal_point'] }],
    });
    const recorder = new ReplayRecorder(sim.config);
    const script: Record<number, Parameters<typeof sim.step>[0]> = {
      2: [{ t: 'plant', point: { x: 2, z: -3 } }],
      5: [spawn('bell_brute', 0, -6)],
      90: [{ t: 'debug', op: { op: 'forceCall', slot: 0 } }],
      100: [{ t: 'debug', op: { op: 'forceHold', slot: 1 } }],
    };
    for (let t = 0; t < 240; t++) recorder.record(t, sim.step(script[t] ?? []));
    const replay = parseReplay(JSON.parse(JSON.stringify(recorder.export(sim.tick, sim.hash()))));
    expect(runReplay(replay).matches).toBe(true);
  });
});

describe('review fixes', () => {
  it('a hero held when the fight is won survives it (no down after victory)', () => {
    const sim = createSim({
      seed: 7,
      encounter: 'first_light',
      debug: true,
      chords: [{ auras: ['fermata'] }],
    });
    const w = worldOf(sim);
    const kill = { t: 'debug' as const, op: { op: 'killEnemies' as const } };
    let held = false;
    for (let t = 0; t < 60 * 90 && sim.state.encounter.status !== 'victory'; t++) {
      const lastWave =
        w.internal.director.nextWave >= sim.state.encounter.waves &&
        w.internal.pendingSpawns.length === 0;
      const live = sim.state.entities.list().some((e) => e.enemy && !e.health?.dead);
      if (lastWave && live && !held) {
        sim.step([{ t: 'debug', op: { op: 'forceHold', slot: 1 } }]);
        held = true;
      } else sim.step(held || !lastWave ? [kill] : []);
    }
    expect(held).toBe(true);
    expect(sim.state.encounter.status).toBe('victory');
    const events = stepFor(sim, 60 * 3);
    const lyra = hero(sim, 1);
    expect(lyra.health!.downed).toBe(false);
    expect(lyra.hero!.hold).toBeNull();
    expect(sim.state.ledger.downs).toBe(0);
    expect(ofType(events, 'allyDowned')).toHaveLength(0);
  });

  it('Bulwark never trades a bigger overshield for its own', () => {
    const sim = sandbox({ auras: ['sostenuto'] });
    // Brutes last long enough to stay loose around the party for the Challenge.
    stepFor(sim, 1, [
      spawn('bell_brute', 0, -5),
      spawn('bell_brute', 4, 3),
      spawn('bell_brute', -4, 3),
    ]);
    stepFor(sim, 30);
    const w = worldOf(sim);
    const kael = w.entities.get(sim.state.party[0]!)!;
    stepFor(sim, 1, [{ t: 'debug', op: { op: 'forceCall', slot: 0 } }]);
    // Aegis Wall-sized overshield, then answer the call.
    const big = kael.health!.maxHp * 0.6;
    kael.health!.shields.push({
      kind: 'overshield',
      amount: big,
      max: big,
      appliedAt: sim.state.time,
      expiresAt: sim.state.time + 30,
      fromWeaver: false,
    });
    let events = stepFor(sim, 1, [{ t: 'tech', id: 'ward', slot: 0 }]);
    // Check on the tick the Flourish lands: the brutes wear the overshield down afterwards.
    for (let i = 0; i < 60 * 6 && !ofType(events, 'flourish').length; i++) events = stepFor(sim, 1);
    expect(ofType(events, 'flourish').some((f) => f.name === 'Bulwark')).toBe(true);
    const shields = kael.health!.shields.filter((s) => s.kind === 'overshield');
    expect(shields).toHaveLength(1);
    expect(shields[0]!.fromWeaver).toBe(false);
  });

  it('a downed caller waits the full spacing before calling again', () => {
    const sim = sandbox({ auras: ['sostenuto'] });
    stepFor(sim, 1, [spawn('hollow_chorister', 0, -4)]);
    stepFor(sim, 60);
    stepFor(sim, 1, [{ t: 'debug', op: { op: 'forceCall', slot: 1 } }]);
    hurt(sim, 1, 99999);
    expect(hero(sim, 1).hero!.call).toBeNull();
    expect(hero(sim, 1).hero!.callCooldown).toBeGreaterThan(CONTENT.calls.heroCooldown - 0.1);
  });

  it('the first call comes no sooner than its delay into the fighting', () => {
    for (const seed of [3, 9, 21]) {
      const sim = createSim({ seed, encounter: 'tolling_halls', auras: ['sostenuto'] });
      const events = stepFor(sim, 60 * 40);
      const first = ofType(events, 'callStarted')[0];
      if (!first) continue;
      const started = sim.state.encounter.startedAt;
      expect(first.tick / 60).toBeGreaterThanOrEqual(started + CONTENT.calls.firstAfter - 1e-6);
    }
  });

  it('an ornament exclusion declared on either side is enforced', () => {
    const content = structuredClone(CONTENT);
    for (const o of content.ornaments) o.excludes = o.id === 'pedal_point' ? ['grace_note'] : [];
    expect(
      chordProblems([{ auras: ['sostenuto'], ornaments: ['grace_note', 'pedal_point'] }], content),
    ).toEqual(["Grace Note and Pedal Point can't share a Chord."]);
  });
});
