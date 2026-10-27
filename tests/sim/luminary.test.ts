/**
 * Phase 3c: the Luminary in the sim (docs/phase-3c.md). Radiance, the field song's reach,
 * Sunrise's brighter light, and each option on the path.
 */
import { describe, expect, it } from 'vitest';
import { CONTENT, callingOption } from '../../src/content';
import { addShield, dealDamage, radianceOf } from '../../src/sim/combat/health';
import { KNOWN_CALLINGS, KNOWN_CALLING_OPTIONS, resolveMods } from '../../src/sim/mods';
import { updateField } from '../../src/sim/systems/field';
import { resolveConfig } from '../../src/sim/world';
import { hero, hurt, ofType, sandbox, spawn, stepFor, telegraphOn, worldOf } from './helpers';

const luminary = (...path: string[]) => ({ calling: { id: 'luminary', path } });
const value = (option: string, key: string) => callingOption(option).values[key]!;
const passive = (key: string) => CONTENT.callings.find((c) => c.id === 'luminary')!.values[key]!;
/** Guardian: Fortissimo on the beam, Sostenuto in the field. */
const GUARDIAN: { auras: string[]; ornaments: string[] }[] = [
  { auras: ['fortissimo'], ornaments: [] },
  { auras: ['sostenuto'], ornaments: [] },
];

describe('the Luminary in content and config', () => {
  it('every Calling and option has sim behaviour', () => {
    for (const c of CONTENT.callings) {
      expect(KNOWN_CALLINGS).toContain(c.id);
      for (const t of c.tiers)
        for (const o of t.options) expect(KNOWN_CALLING_OPTIONS).toContain(o.id);
    }
  });

  it('the config validates the path and drops the Calling when the Weaver is absent', () => {
    expect(resolveConfig({ seed: 1, ...luminary('haloed') }).calling).toEqual({
      id: 'luminary',
      path: ['haloed'],
      reviveSpent: false,
    });
    expect(() => resolveConfig({ seed: 1, calling: { id: 'nope' } })).toThrow(/Unknown calling/);
    expect(() => resolveConfig({ seed: 1, ...luminary('haloed', 'wide_choir') })).toThrow(
      /Two options from tier 1/,
    );
    expect(() => resolveConfig({ seed: 1, ...luminary('ward') })).toThrow(/not on the/);
    expect(resolveConfig({ seed: 1, ...luminary(), absent: true }).calling).toBeNull();
  });

  it('the view sees the Calling: its path, Radiance and Sovereign Symphony', () => {
    const calling = sandbox({ chords: GUARDIAN, ...luminary('haloed', 'searing_hymns') }).state
      .calling!;
    expect(calling.id).toBe('luminary');
    expect(calling.path).toEqual(['haloed', 'searing_hymns']);
    expect(calling.radiancePerAura).toBeCloseTo(
      (passive('radiance') / 100) * value('searing_hymns', 'mult'),
      6,
    );
    expect(calling.sunriseMult).toBe(passive('sunrise'));
    expect(calling.sovereign).toBe(false);
    const sovereign = luminary('haloed', 'dawnward', 'lantern_bearer', 'sovereign_symphony');
    const four = [
      { auras: ['fortissimo', 'sostenuto'], ornaments: ['grace_note'] },
      { auras: ['ostinato', 'allegro'], ornaments: [] },
    ];
    expect(sandbox({ chords: four, ...sovereign }).state.calling!.sovereign).toBe(true);
    expect(sandbox({ chords: GUARDIAN, ...sovereign }).state.calling!.sovereign).toBe(false);
    expect(sandbox({ chords: GUARDIAN }).state.calling).toBeNull();
  });

  it('Third Voice makes a third field aura legal, and only it', () => {
    const three = [
      { auras: ['fortissimo'], ornaments: [] },
      { auras: ['sostenuto', 'ostinato', 'allegro'], ornaments: ['grace_note'] },
    ];
    expect(() => resolveConfig({ seed: 1, chords: three, ...luminary() })).toThrow(
      /at most 2 auras/,
    );
    expect(
      resolveConfig({ seed: 1, chords: three, ...luminary('haloed', 'dawnward', 'third_voice') })
        .chords[1]!.auras,
    ).toHaveLength(3);
  });
});

describe('Radiance', () => {
  it('a hero in your field shines for every aura they hear; three times in Sunrise', () => {
    const sim = sandbox({ chords: GUARDIAN, ...luminary() });
    stepFor(sim, 2, [{ t: 'thread', slot: 1 }]);
    const w = worldOf(sim);
    const lyra = w.entities.get(w.party[1]!)!;
    expect(lyra.hero!.inField).toBe(true);
    // She hears the beam (focus) and the field song.
    expect(radianceOf(w, lyra)).toBeCloseTo((passive('radiance') / 100) * 2, 6);
    w.field.crescendo = true;
    expect(radianceOf(w, lyra)).toBeCloseTo(
      (passive('radiance') / 100) * 2 * passive('sunrise'),
      6,
    );
    w.field.crescendo = false;
    // Out of every field, a threaded hero still hears the beam but doesn't shine.
    lyra.hero!.inField = false;
    expect(radianceOf(w, lyra)).toBe(0);
    // Without the Luminary, nothing.
    const plain = sandbox({ chords: GUARDIAN });
    stepFor(plain, 2);
    expect(radianceOf(worldOf(plain), hero(plain, 1) as never)).toBe(0);
  });

  it('shows on hits and in the ledger, inside the Weaver’s share', () => {
    const sim = sandbox({ chords: GUARDIAN, ...luminary() });
    stepFor(sim, 1, [spawn('bell_brute', 0, -4), spawn('bell_brute', 2, -5)]);
    const events = stepFor(sim, 60 * 6);
    const shone = ofType(events, 'damageTaken').filter((e) => e.radiance > 0);
    expect(shone.length).toBeGreaterThan(0);
    for (const e of shone) expect(e.radiance).toBeLessThanOrEqual(e.amplified + 1e-9);
    const l = sim.state.ledger;
    expect(l.calling.amplified).toBeGreaterThan(0);
    expect(l.calling.amplified).toBeLessThanOrEqual(l.amplified + 1e-6);
  });

  it('Searing Hymns doubles it', () => {
    const mods = resolveMods(
      resolveConfig({ seed: 1, ...luminary('haloed', 'searing_hymns') }),
      CONTENT,
    );
    expect(mods.radiancePerAura).toBeCloseTo(
      (passive('radiance') / 100) * value('searing_hymns', 'mult'),
      6,
    );
  });
});

describe('reach and strength', () => {
  it('the field song reaches farther; Wide Choir farther still; the beam’s echo is unchanged', () => {
    const radius = (config: object) => {
      const sim = sandbox({ chords: GUARDIAN, ...config });
      stepFor(sim, 2);
      return sim.state.field.chords.map((c) => c.radius);
    };
    const [beam, field] = radius({});
    const [beamL, fieldL] = radius(luminary());
    const [, fieldW] = radius(luminary('wide_choir'));
    expect(beamL).toBeCloseTo(beam!, 6);
    expect(fieldL).toBeCloseTo(field! * (1 + passive('reach') / 100), 6);
    expect(fieldW).toBeCloseTo(
      field! * (1 + passive('reach') / 100) * (1 + value('wide_choir', 'pct') / 100),
      6,
    );
  });

  it('Lantern Bearer strengthens a planted field; Sovereign Symphony every aura from 4', () => {
    const multOf = (chords: typeof GUARDIAN, config: object, aura: string) => {
      const sim = sandbox({ chords, ...config });
      stepFor(sim, 2);
      return worldOf(sim).scratch.auraMult[CONTENT.auras.findIndex((a) => a.id === aura)]!;
    };
    const planted = [
      { auras: ['fortissimo'], ornaments: [] },
      { auras: ['sostenuto'], ornaments: ['pedal_point'] },
    ];
    const base = multOf(planted, luminary(), 'sostenuto');
    expect(
      multOf(planted, luminary('haloed', 'dawnward', 'lantern_bearer'), 'sostenuto'),
    ).toBeCloseTo(base * (1 + value('lantern_bearer', 'pct') / 100), 6);
    const sovereign = luminary('haloed', 'dawnward', 'lantern_bearer', 'sovereign_symphony');
    const four = [
      { auras: ['fortissimo', 'sostenuto'], ornaments: ['grace_note'] },
      { auras: ['ostinato', 'allegro'], ornaments: [] },
    ];
    expect(multOf(four, sovereign, 'allegro')).toBeCloseTo(
      multOf(four, luminary(), 'allegro') * (1 + value('sovereign_symphony', 'pct') / 100),
      6,
    );
    // Three auras: not enough.
    const three = [
      { auras: ['fortissimo', 'sostenuto'], ornaments: ['grace_note'] },
      { auras: ['ostinato'], ornaments: [] },
    ];
    expect(multOf(three, sovereign, 'ostinato')).toBeCloseTo(
      multOf(three, luminary(), 'ostinato'),
      6,
    );
  });

  it('Lantern Bearer on a planted beam song: its echo sings stronger, not the pour', () => {
    const strengths = (config: object) => {
      const sim = sandbox({
        chords: [
          { auras: ['fortissimo'], ornaments: ['pedal_point'] },
          { auras: ['sostenuto'], ornaments: [] },
        ],
        ...config,
      });
      stepFor(sim, 2);
      const s = worldOf(sim).scratch;
      const i = CONTENT.auras.findIndex((a) => a.id === 'fortissimo');
      return { mult: s.auraMult[i]!, focus: s.auraFocus[i]!, echo: s.auraEcho[i]! };
    };
    const plain = strengths(luminary());
    const lantern = strengths(luminary('haloed', 'dawnward', 'lantern_bearer'));
    expect(lantern.mult).toBeCloseTo(plain.mult, 9);
    expect(lantern.focus).toBeCloseTo(plain.focus, 9);
    expect(lantern.echo).toBeCloseTo(plain.echo * (1 + value('lantern_bearer', 'pct') / 100), 9);
  });
});

describe('protection', () => {
  it('Haloed: heroes in your field take less from ordinary hits', () => {
    const taken = (config: object) => {
      const sim = sandbox({ chords: GUARDIAN, ...config });
      stepFor(sim, 2);
      const before = hero(sim, 0).health!.hp;
      hurt(sim, 0, 200);
      return { lost: before - hero(sim, 0).health!.hp, sim };
    };
    const plain = taken(luminary());
    const haloed = taken(luminary('haloed'));
    expect(haloed.lost).toBeCloseTo(plain.lost * (1 - value('haloed', 'pct') / 100), 6);
    expect(haloed.sim.state.ledger.calling.shielded).toBeCloseTo(plain.lost - haloed.lost, 6);
  });

  it('Haloed leaves telegraphed attacks to your Ward', () => {
    const taken = (config: object) => {
      const sim = sandbox({ chords: GUARDIAN, ...config });
      const { started } = telegraphOn('bell_brute', 'Toll Cleave', 0, 2.5, sim);
      const w = worldOf(sim);
      const telegraph = w.telegraphs.find((t) => t.id === started.telegraph)!;
      const kael = w.entities.get(w.party[0]!)!;
      expect(kael.hero!.inField).toBe(true);
      const before = kael.health!.hp;
      const credited = w.ledger.calling.shielded;
      dealDamage(w, kael, { source: null, sourceName: 'test', amount: 100, telegraph });
      return { lost: before - kael.health!.hp, shielded: w.ledger.calling.shielded - credited };
    };
    const plain = taken(luminary());
    const haloed = taken(luminary('haloed'));
    expect(plain.lost).toBeGreaterThan(0);
    expect(haloed.lost).toBeCloseTo(plain.lost, 6);
    expect(haloed.shielded).toBe(0);
  });

  it('Haloed and Fermata’s guard share the life the hero kept', () => {
    const chords = [
      { auras: ['fortissimo'], ornaments: [] },
      { auras: ['sostenuto', 'fermata'], ornaments: [] },
    ];
    for (const amount of [400, 600, 700, 800, 1000]) {
      const sim = sandbox({ chords, ...luminary('haloed') });
      stepFor(sim, 2);
      const w = worldOf(sim);
      const kael = w.entities.get(w.party[0]!)!;
      kael.health!.hp = kael.health!.maxHp * 0.2;
      const before = w.ledger.shielded;
      dealDamage(w, kael, { source: null, sourceName: 'test', amount, telegraph: null });
      if (kael.health!.downed) continue;
      expect(w.ledger.shielded - before).toBeLessThanOrEqual(kael.health!.hp + 1e-9);
    }
  });

  it('Dawnward: stepping into the field shields a hero, once every few seconds', () => {
    const sim = sandbox({ chords: GUARDIAN, ...luminary('haloed', 'dawnward') });
    stepFor(sim, 2);
    const w = worldOf(sim);
    const lyra = w.entities.get(w.party[1]!)!;
    // Take her out of every field, then let the field update find her back inside.
    lyra.hero!.inField = false;
    updateField(w, 1 / 60);
    const events = sim.drainEvents();
    const dawn = ofType(events, 'dawnward');
    expect(dawn).toHaveLength(1);
    const shield = lyra.health!.shields.find((s) => s.kind === 'overshield')!;
    expect(shield.fromWeaver).toBe(true);
    expect(shield.amount).toBeCloseTo(dawn[0]!.amount, 6);
    // Worth a share of her life for every aura she hears (the beam's echo and the field song).
    expect(dawn[0]!.amount).toBeCloseTo(
      lyra.health!.maxHp * (value('dawnward', 'pct') / 100) * 2,
      6,
    );
    // Too soon for another.
    lyra.hero!.inField = false;
    updateField(w, 1 / 60);
    expect(ofType(sim.drainEvents(), 'dawnward')).toHaveLength(0);
    // After the cooldown (the first barrier has worn off by then), again.
    stepFor(sim, 60 * value('dawnward', 'cooldown') + 1);
    sim.drainEvents();
    lyra.hero!.inField = false;
    updateField(w, 1 / 60);
    expect(ofType(sim.drainEvents(), 'dawnward')).toHaveLength(1);
  });

  it('Dawnward leaves a bigger barrier alone', () => {
    const sim = sandbox({ chords: GUARDIAN, ...luminary('haloed', 'dawnward') });
    stepFor(sim, 2);
    const w = worldOf(sim);
    const lyra = w.entities.get(w.party[1]!)!;
    addShield(w, lyra, 'overshield', lyra.health!.maxHp, 10, true);
    sim.drainEvents();
    lyra.hero!.inField = false;
    updateField(w, 1 / 60);
    expect(ofType(sim.drainEvents(), 'dawnward')).toHaveLength(0);
    expect(lyra.health!.shields.find((x) => x.kind === 'overshield')!.amount).toBe(
      lyra.health!.maxHp,
    );
  });
});

describe('Eclipse', () => {
  it('Sunrise reaches twice as far, and enemies in the field take more from heroes', () => {
    const sim = sandbox({
      chords: GUARDIAN,
      ...luminary('haloed', 'dawnward', 'lantern_bearer', 'eclipse'),
    });
    stepFor(sim, 2);
    const w = worldOf(sim);
    const resting = w.field.chords[1]!.radius;
    w.field.crescendo = true;
    updateField(w, 1 / 60);
    expect(w.field.chords[1]!.radius).toBeCloseTo(resting * value('eclipse', 'reach'), 6);
    stepFor(sim, 1, [spawn('bell_brute', 0, -3)]);
    w.field.crescendo = true;
    const events = stepFor(sim, 60);
    expect(ofType(events, 'damageTaken').some((e) => e.eclipse > 0)).toBe(true);
  });

  it('the same hit in Sunrise lands harder with Eclipse, by its share alone', () => {
    const hit = (capstone: string) => {
      const sim = sandbox({
        chords: GUARDIAN,
        ...luminary('haloed', 'dawnward', 'lantern_bearer', capstone),
      });
      stepFor(sim, 1, [spawn('bell_brute', 0, -3)]);
      stepFor(sim, 1);
      const w = worldOf(sim);
      w.field.crescendo = true;
      updateField(w, 1 / 60);
      const enemy = w.entities.list().find((e) => e.enemy)!;
      const kael = w.entities.get(w.party[0]!)!;
      expect(enemy.enemy!.inField).toBe(true);
      const before = enemy.health!.hp;
      dealDamage(w, enemy, { source: kael.id, sourceName: 'test', amount: 10 });
      return { lost: before - enemy.health!.hp, radiance: radianceOf(w, kael) };
    };
    // Sovereign Symphony is idle with two auras: the only difference is Eclipse.
    const eclipse = hit('eclipse');
    const plain = hit('sovereign_symphony');
    expect(eclipse.radiance).toBeCloseTo(plain.radiance, 9);
    expect(eclipse.lost / plain.lost).toBeCloseTo(
      (1 + eclipse.radiance + value('eclipse', 'pct') / 100) / (1 + eclipse.radiance),
      6,
    );
  });

  it('a hero out of the light adds no Radiance, but Eclipse still counts', () => {
    const sim = sandbox({
      chords: GUARDIAN,
      ...luminary('haloed', 'dawnward', 'lantern_bearer', 'eclipse'),
    });
    stepFor(sim, 1, [spawn('bell_brute', 0, -3)]);
    stepFor(sim, 1);
    const w = worldOf(sim);
    w.field.crescendo = true;
    updateField(w, 1 / 60);
    const enemy = w.entities.list().find((e) => e.enemy)!;
    const kael = w.entities.get(w.party[0]!)!;
    kael.hero!.inField = false;
    sim.drainEvents();
    dealDamage(w, enemy, { source: kael.id, sourceName: 'test', amount: 10 });
    const hit = ofType(sim.drainEvents(), 'damageTaken')[0]!;
    expect(hit.radiance).toBe(0);
    expect(hit.eclipse).toBeGreaterThan(0);
    expect(hit.eclipse).toBeCloseTo(hit.amplified, 9);
  });
});
