import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../src/content';
import { createSim } from '../../src/sim';
import { hero, hurt, ofType, sandbox, spawn, stepFor, stepUntil, weaver, worldOf } from './helpers';

const until = (name: string) => (ev: ReturnType<typeof stepFor>) =>
  ev.some((e) => e.type === 'telegraphStarted' && e.name === name);

describe('boss scripts', () => {
  it('the cracked Bellwarden chains Toll Outward into Toll Inward in phase 2', () => {
    const sim = sandbox();
    stepFor(sim, 1, [spawn('the_bellwarden', 0, -10)]);
    stepFor(sim, 2, [{ t: 'debug', op: { op: 'setBossHp', pct: 0.45 } }]);
    // Keep the party alive while we watch the script.
    const heal = (tick: number) =>
      tick % 60 === 0 ? [{ t: 'debug' as const, op: { op: 'healParty' as const } }] : [];
    const out = stepUntil(sim, until('Toll Outward'), 60 * 40, heal);
    const outward = ofType(out, 'telegraphStarted').find((e) => e.name === 'Toll Outward')!;
    const after = stepUntil(sim, until('Toll Inward'), 60 * 6, heal);
    const inward = ofType(after, 'telegraphStarted').find((e) => e.name === 'Toll Inward')!;
    // Inward starts right after Outward lands.
    expect(inward.start - outward.impact).toBeGreaterThanOrEqual(0);
    expect(inward.start - outward.impact).toBeLessThan(1.5);
  });

  it('phase shifts make bosses briefly invulnerable, mini-bosses included', () => {
    const sim = sandbox();
    stepFor(sim, 1, [spawn('the_bellwarden', 0, -10)]);
    const events = stepFor(sim, 2, [{ t: 'debug', op: { op: 'setBossHp', pct: 0.45 } }]);
    expect(ofType(events, 'phaseChanged')).toHaveLength(1);
    const w = worldOf(sim);
    expect(w.internal.boss.phaseShiftUntil).toBeGreaterThan(sim.state.time);
  });

  it('the Requiem repeats on its cadence in phase 3', () => {
    const sim = sandbox();
    stepFor(sim, 1, [spawn('the_hollow_cantor', 0, -12)]);
    stepFor(sim, 2, [{ t: 'debug', op: { op: 'setBossHp', pct: 0.3 } }]);
    const heal = (tick: number) =>
      tick % 30 === 0 ? [{ t: 'debug' as const, op: { op: 'healParty' as const } }] : [];
    const first = ofType(stepUntil(sim, until('Requiem'), 60 * 15, heal), 'telegraphStarted').find(
      (e) => e.name === 'Requiem',
    )!;
    const second = ofType(stepUntil(sim, until('Requiem'), 60 * 40, heal), 'telegraphStarted').find(
      (e) => e.name === 'Requiem',
    )!;
    expect(second.start - first.start).toBeGreaterThanOrEqual(27.9);
    expect(second.start - first.start).toBeLessThan(30);
  });

  it('bosses enrage on schedule', () => {
    const sim = createSim({ seed: 3, encounter: 'bellwarden', debug: true, auras: [] });
    // Keep both sides standing: we only care about the clock.
    const heal = (tick: number) =>
      tick % 30 === 0
        ? [
            { t: 'debug' as const, op: { op: 'healParty' as const } },
            { t: 'debug' as const, op: { op: 'setBossHp' as const, pct: 1 } },
          ]
        : [];
    const events = stepUntil(
      sim,
      (ev) => ev.some((e) => e.type === 'decree' && e.name === 'Enrage'),
      60 * 320,
      heal,
    );
    expect(ofType(events, 'decree').some((d) => d.name === 'Enrage')).toBe(true);
    expect(worldOf(sim).internal.boss.enraged).toBe(true);
  });
});

describe('Reel edge cases', () => {
  function cleaveOnKael() {
    const sim = sandbox();
    const kael = hero(sim, 0);
    stepFor(sim, 1, [spawn('bell_brute', kael.x, kael.z - 2.5)]);
    const events = stepUntil(sim, until('Toll Cleave'));
    const started = ofType(events, 'telegraphStarted').find((e) => e.name === 'Toll Cleave')!;
    return { sim, t: sim.state.telegraphs.find((x) => x.id === started.telegraph)! };
  }

  it('a last-moment Reel (hero still mid-flight at impact) is credited', () => {
    const { sim, t } = cleaveOnKael();
    stepUntil(sim, () => t.impact - sim.state.time < 0.1);
    const before = weaver(sim).weaver!.resonance;
    stepFor(sim, 1, [
      { t: 'aim', x: weaver(sim).x, z: weaver(sim).z + 3 },
      { t: 'tech', id: 'reel', slot: 0 },
    ]);
    const events = stepUntil(sim, (ev) =>
      ev.some((e) => e.type === 'telegraphResolved' && e.telegraph === t.id),
    );
    const resolved = ofType(events, 'telegraphResolved').find((e) => e.telegraph === t.id)!;
    expect(resolved.outcome).toBe('dodged');
    expect(sim.state.ledger.reels).toBe(1);
    expect(weaver(sim).weaver!.resonance).toBeGreaterThanOrEqual(
      before + CONTENT.resonance.gains.reelDodge - 0.01,
    );
  });

  it('counts Reels that dodged something, not Reel casts', () => {
    const sim = sandbox();
    stepFor(sim, 1, [{ t: 'tech', id: 'reel', slot: 1 }]);
    stepFor(sim, 60);
    expect(sim.state.ledger.reels).toBe(0);
    expect(sim.state.ledger.markers.some((m) => m.kind === 'reel')).toBe(true);
  });

  it('drags a downed hero’s body to the Weaver', () => {
    const sim = sandbox();
    stepFor(sim, 1, [{ t: 'debug', op: { op: 'teleportWeaver', x: 8, z: 0 } }]);
    stepFor(sim, 30);
    hurt(sim, 1, 5000);
    expect(hero(sim, 1).health!.downed).toBe(true);
    const d0 = Math.hypot(hero(sim, 1).x - weaver(sim).x, hero(sim, 1).z - weaver(sim).z);
    stepFor(sim, 40, [{ t: 'tech', id: 'reel', slot: 1 }]);
    const d1 = Math.hypot(hero(sim, 1).x - weaver(sim).x, hero(sim, 1).z - weaver(sim).z);
    expect(d1).toBeLessThan(d0 - 2);
    expect(hero(sim, 1).health!.downed).toBe(true);
  });
});

describe('encounter director', () => {
  it('starts the next wave once the current one is cleared', () => {
    const sim = createSim({ seed: 9, encounter: 'first_light', debug: true });
    stepUntil(sim, (ev) => ev.some((e) => e.type === 'waveStarted' && e.wave === 1), 60 * 10);
    stepFor(sim, 90); // spawn portals open
    const events = stepFor(sim, 60 * 5, [{ t: 'debug', op: { op: 'killEnemies' } }]);
    expect(ofType(events, 'waveStarted').map((e) => e.wave)).toContain(2);
  });

  it('a fallen boss ends the fight even with adds still up', () => {
    const sim = createSim({ seed: 9, encounter: 'bellwarden', debug: true });
    stepUntil(sim, () => sim.state.encounter.bossId !== null, 60 * 10);
    stepFor(sim, 1, [spawn('hollow_chorister', 5, -5)]);
    const events = stepFor(sim, 2, [{ t: 'debug', op: { op: 'killEnemies' } }]);
    expect(ofType(events, 'encounterEnded')[0]?.outcome).toBe('victory');
  });

  it('keeps going while the Weaver can still revive someone, then ends', () => {
    const sim = createSim({ seed: 9, encounter: 'first_light', debug: true });
    stepUntil(sim, () => sim.state.encounter.status === 'fighting', 60 * 10);
    for (let s = 0; s < 3; s++) hurt(sim, s, 10_000);
    stepFor(sim, 5);
    expect(sim.state.encounter.status).toBe('fighting');
    const events = stepUntil(sim, (ev) => ev.some((e) => e.type === 'encounterEnded'), 60 * 20);
    expect(ofType(events, 'encounterEnded')[0]!.outcome).toBe('defeat');
  });
});

describe('affixes and auras', () => {
  it('Volatile enemies shatter three seconds after death', () => {
    const sim = sandbox();
    const w = worldOf(sim);
    stepFor(sim, 1, [spawn('hollow_chorister', 0, -8)]);
    w.entities
      .list()
      .find((e) => e.enemy)!
      .enemy!.affixes.push('volatile');
    const events = stepFor(sim, 2, [{ t: 'debug', op: { op: 'killEnemies' } }]);
    const shatter = ofType(events, 'telegraphStarted').find((e) => e.name === 'Shatter')!;
    expect(shatter.impact - shatter.start).toBeCloseTo(3, 6);
    const done = stepUntil(sim, (ev) =>
      ev.some((e) => e.type === 'telegraphEnded' && e.telegraph === shatter.telegraph),
    );
    expect(ofType(done, 'telegraphResolved').some((e) => e.telegraph === shatter.telegraph)).toBe(
      true,
    );
  });

  it('Hastened enemies move faster', () => {
    const sim = sandbox();
    stepFor(sim, 1, [spawn('bell_brute', 0, -12)]);
    const w = worldOf(sim);
    const plain = w.entities.list().find((e) => e.enemy)!;
    expect(plain.speed).toBeCloseTo(CONTENT.enemies.find((e) => e.id === 'bell_brute')!.speed, 6);
  });

  /** Only a field song (Chord II): full strength for everyone in the field. */
  const field = (auras: string[]) => ({
    chords: [
      { auras: [], ornaments: [] },
      { auras, ornaments: [] },
    ],
  });

  it('Ostinato keeps a barrier on heroes in the field and refills it after a lull', () => {
    const sim = sandbox(field(['ostinato']));
    stepFor(sim, 10);
    const barrier = () => hero(sim, 0).health!.shields.find((s) => s.kind === 'barrier');
    expect(barrier()?.amount).toBeCloseTo(hero(sim, 0).health!.maxHp * 0.12, 3);
    hurt(sim, 0, 100);
    expect(barrier()?.amount ?? 0).toBeLessThan(hero(sim, 0).health!.maxHp * 0.12);
    stepFor(sim, 60 * 3 + 10);
    expect(barrier()?.amount).toBeCloseTo(hero(sim, 0).health!.maxHp * 0.12, 3);
  });

  it('Lullaby lengthens wind-ups and widens the Perfect window with them', () => {
    const plain = sandbox();
    const lull = sandbox(field(['lullaby']));
    const windows: number[][] = [];
    for (const sim of [plain, lull]) {
      const kael = hero(sim, 0);
      stepFor(sim, 1, [spawn('bell_brute', kael.x, kael.z - 2.5)]);
      const ev = stepUntil(sim, until('Toll Cleave'));
      const t = ofType(ev, 'telegraphStarted').find((e) => e.name === 'Toll Cleave')!;
      windows.push([t.impact - t.start, t.impact - t.perfectFrom]);
    }
    expect(windows[1]![0]).toBeCloseTo(windows[0]![0]! * 1.15, 3);
    expect(windows[1]![1]).toBeCloseTo(windows[0]![1]! * 1.15, 3);
  });
});

describe('motifs in play', () => {
  const ward = (motifs: { id: string; level: number }[]) => {
    const sim = sandbox({ motifs });
    stepFor(sim, 1, [{ t: 'tech', id: 'ward', slot: 0 }]);
    return hero(sim, 0).health!.shields.find((s) => s.kind === 'ward')!;
  };

  it('Deep Roots and Lingering Aegis change the Ward', () => {
    const base = ward([]);
    const deep = ward([{ id: 'deep_roots', level: 3 }]);
    expect(deep.amount).toBeCloseTo(base.amount * 1.55, 3);
    const long = ward([{ id: 'lingering_aegis', level: 2 }]);
    expect(long.expiresAt - long.appliedAt).toBeCloseTo(base.expiresAt - base.appliedAt + 1.5, 6);
  });

  it('Second Verse widens the field; Clear Tone widens the Chime', () => {
    const sim = sandbox({
      motifs: [
        { id: 'second_verse', level: 1 },
        { id: 'clear_tone', level: 1 },
      ],
    });
    stepFor(sim, 1, [{ t: 'tech', id: 'chime', point: { x: 0, z: -2 } }]);
    expect(sim.state.field.radius).toBeCloseTo(CONTENT.weaver.fieldRadius * 1.15, 6);
    expect(sim.state.chimes[0]!.radius).toBeCloseTo(CONTENT.techniques.chime.radius * 1.2, 6);
  });

  it('Long Weave keeps the Thread past the usual snap range', () => {
    const sim = sandbox({ motifs: [{ id: 'long_weave', level: 3 }] });
    stepFor(sim, 1, [{ t: 'thread', slot: 0 }]);
    const kael = hero(sim, 0);
    const events = stepFor(sim, 3, [
      { t: 'debug', op: { op: 'teleportWeaver', x: kael.x, z: kael.z + 16 } },
    ]);
    expect(ofType(events, 'threadSnapped')).toHaveLength(0);
  });

  it('Relay Weave heals a hero when the Thread moves to them', () => {
    const sim = sandbox({ motifs: [{ id: 'relay_weave', level: 3 }] });
    hurt(sim, 1, 500);
    stepFor(sim, 1, [{ t: 'thread', slot: 0 }]);
    const hp = hero(sim, 1).health!.hp;
    stepFor(sim, 1, [{ t: 'thread', slot: 1 }]);
    expect(hero(sim, 1).health!.hp).toBeGreaterThanOrEqual(
      hp + hero(sim, 1).health!.maxHp * 0.12 - 1,
    );
  });

  it('Encore lengthens the Crescendo; Da Capo keeps Resonance after it', () => {
    const sim = sandbox({
      motifs: [
        { id: 'encore', level: 1 },
        { id: 'da_capo', level: 1 },
      ],
    });
    stepFor(sim, 1, [{ t: 'debug', op: { op: 'setResonance', value: 100 } }]);
    const events = stepFor(sim, 1, [{ t: 'crescendo' }]);
    expect(ofType(events, 'crescendoStart')[0]!.duration).toBeCloseTo(
      CONTENT.crescendo.duration + 2,
      6,
    );
    stepUntil(sim, (ev) => ev.some((e) => e.type === 'crescendoEnd'), 60 * 10);
    expect(weaver(sim).weaver!.resonance).toBe(25);
  });

  it('Standing Ovation multiplies Resonance gains; Quickened Verse speeds Solo charge', () => {
    const sim = sandbox({ motifs: [{ id: 'quickened_verse', level: 3 }] });
    const plain = sandbox();
    for (const s of [sim, plain]) {
      const kael = hero(s, 0);
      stepFor(s, 1, [spawn('bell_brute', kael.x, kael.z - 3)]);
      for (const e of worldOf(s).entities.list())
        if (e.enemy && e.health) e.health.hp = e.health.maxHp = 1e6;
      stepFor(s, 60 * 5);
    }
    expect(hero(sim, 0).hero!.solo).toBeGreaterThan(hero(plain, 0).hero!.solo * 1.25);
  });
});
