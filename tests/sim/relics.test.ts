/**
 * Phase 3b: relics and boons in the sim (docs/phase-3b.md). Each relic changes one rule; these
 * tests stage the moment it should change and check it did, and that it shows (relicTriggered).
 */
import { describe, expect, it } from 'vitest';
import { CONTENT, heroDef } from '../../src/content';
import { addShield } from '../../src/sim/combat/health';
import { KNOWN_BOONS, KNOWN_RELICS, NO_MODS, resolveMods } from '../../src/sim/mods';
import { empowerBonus, threadPotency, updateThread } from '../../src/sim/systems/thread';
import { resolveConfig } from '../../src/sim/world';
import { createSim, ReplayRecorder, ReplaySchema } from '../../src/sim';
import {
  hero,
  hurt,
  ofType,
  resolvedOf,
  sandbox,
  spawn,
  stepFor,
  stepUntil,
  telegraphOn,
  weaver,
  worldOf,
} from './helpers';

const relics = (...ids: string[]) => ({ relics: ids });
const triggered = (events: ReturnType<typeof stepFor>, relic: string) =>
  ofType(events, 'relicTriggered').filter((e) => e.relic === relic);
const value = (relic: string, key: string) =>
  CONTENT.relics.find((r) => r.id === relic)!.values[key]!;

describe('relic content', () => {
  it('every relic with sim behaviour is known to the resolver, and every boon', () => {
    for (const r of CONTENT.relics)
      expect(r.runOnly || KNOWN_RELICS.includes(r.id), r.id).toBe(true);
    for (const b of CONTENT.boons) expect(KNOWN_BOONS.includes(b.id), b.id).toBe(true);
    expect(CONTENT.relics.filter((r) => r.rarity === 'cursed').every((r) => r.curse)).toBe(true);
  });

  it('the config takes ids or cleansed relics, drops duplicates and refuses unknown ones', () => {
    const c = resolveConfig({
      seed: 1,
      relics: ['tuning_fork', { id: 'heavy_score', cleansed: true }, 'tuning_fork'],
      boons: ['last_note', 'last_note'],
    });
    expect(c.relics).toEqual([
      { id: 'tuning_fork', cleansed: false },
      { id: 'heavy_score', cleansed: true },
    ]);
    expect(c.boons).toEqual(['last_note']);
    // Only a cursed relic can be cleansed.
    expect(
      resolveConfig({ seed: 1, relics: [{ id: 'hollow_bell', cleansed: true }] }).relics[0],
    ).toEqual({ id: 'hollow_bell', cleansed: false });
    expect(() => resolveConfig({ seed: 1, relics: ['no_such_relic'] })).toThrow(/Unknown relic/);
    expect(() => resolveConfig({ seed: 1, boons: ['no_such_boon'] })).toThrow(/Unknown boon/);
  });

  it('the Weaver’s relics and boons stay home when they are absent', () => {
    const c = resolveConfig({
      seed: 1,
      relics: ['tuning_fork'],
      boons: ['last_note'],
      absent: true,
    });
    expect(c.relics).toEqual([]);
    expect(c.boons).toEqual([]);
  });

  it('a replay carries the relics and boons and validates', () => {
    const config = { seed: 3, relics: ['silver_thimble'], boons: ['mended_loom'] };
    const sim = createSim(config);
    const rec = new ReplayRecorder(sim.config);
    stepFor(sim, 30);
    const replay = rec.export(sim.tick, sim.hash());
    expect(ReplaySchema.safeParse(replay).success).toBe(true);
    expect(replay.config.relics).toEqual([{ id: 'silver_thimble', cleansed: false }]);
    expect(replay.config.boons).toEqual(['mended_loom']);
  });
});

describe('common relics', () => {
  it('Silver Thimble shields the hero the Thread moves to, once every few seconds', () => {
    const sim = sandbox(relics('silver_thimble'));
    let events = stepFor(sim, 1, [{ t: 'thread', slot: 1 }]);
    const lyra = hero(sim, 1);
    const shield = lyra.health!.shields.find((s) => s.kind === 'overshield');
    expect(shield?.amount).toBeCloseTo(
      lyra.health!.maxHp * (value('silver_thimble', 'barrier') / 100),
      6,
    );
    expect(triggered(events, 'silver_thimble')).toHaveLength(1);
    // Too soon: no second shield.
    events = stepFor(sim, 70, [{ t: 'thread', slot: 2 }]);
    expect(hero(sim, 2).health!.shields.some((s) => s.kind === 'overshield')).toBe(false);
    expect(triggered(events, 'silver_thimble')).toHaveLength(0);
    stepFor(sim, 60 * value('silver_thimble', 'cooldown'));
    events = stepFor(sim, 1, [{ t: 'thread', slot: 0 }]);
    expect(triggered(events, 'silver_thimble')).toHaveLength(1);
    expect(sim.state.relics.thimbleAt).toBeGreaterThan(sim.state.time);
    // Every moment is counted in the relic state too (the HUD flashes on it).
    expect(sim.state.relics.triggers).toEqual({ silver_thimble: 2 });
  });

  it('Lantern of the Lost shields the others when a hero goes down', () => {
    const sim = sandbox(relics('lantern_of_the_lost'));
    stepFor(sim, 5);
    hurt(sim, 0, 1e6);
    const events = sim.drainEvents();
    expect(hero(sim, 0).health!.downed).toBe(true);
    for (const slot of [1, 2]) {
      const h = hero(sim, slot).health!;
      expect(h.shields.find((s) => s.kind === 'overshield')?.amount).toBeCloseTo(
        h.maxHp * (value('lantern_of_the_lost', 'barrier') / 100),
        6,
      );
    }
    expect(triggered(events, 'lantern_of_the_lost')[0]).toMatchObject({
      hero: hero(sim, 0).id,
      targets: [hero(sim, 1).id, hero(sim, 2).id],
    });
  });

  it('Featherweight Robes shorten Glide’s cooldown', () => {
    const sim = sandbox(relics('featherweight_robes'));
    stepFor(sim, 1, [{ t: 'glide', x: 1, z: 0 }]);
    const pct = value('featherweight_robes', 'pct') / 100;
    expect(weaver(sim).weaver!.cooldownTotals.glide).toBeCloseTo(
      CONTENT.techniques.glide.cooldown * (1 - pct),
      6,
    );
  });

  it('Warden’s Key: heroes hit Mutes for triple damage, the extra credited to you', () => {
    const sim = sandbox(relics('wardens_key'));
    stepFor(sim, 1, [spawn('mute', 0, -3)]);
    const mute = sim.state.entities.list().find((e) => e.enemy?.defId === 'mute')!;
    expect(mute).toBeDefined();
    const events = stepFor(sim, 60 * 4);
    const hits = ofType(events, 'damageTaken').filter(
      (e) => e.target === mute.id && sim.state.party.includes(e.source ?? -1) && e.amount > 0,
    );
    expect(hits.length).toBeGreaterThan(0);
    // Two thirds of every hit are the Key's.
    for (const h of hits)
      expect(h.amplified / (h.amount + h.absorbed)).toBeGreaterThanOrEqual(2 / 3 - 1e-6);
  });

  it('Tuning Fork: a Perfect Ward charges the hero’s Solo', () => {
    const { sim, telegraph: t } = telegraphOn(
      'bell_brute',
      'Toll Cleave',
      0,
      2.5,
      sandbox(relics('tuning_fork')),
    );
    const before = hero(sim, 0).hero!.solo;
    stepUntil(sim, () => sim.state.time >= t.perfectFrom + 0.05);
    stepFor(sim, 1, [{ t: 'tech', id: 'ward', slot: 0 }]);
    const { events } = resolvedOf(sim, t.id);
    expect(ofType(events, 'perfectWard')).toHaveLength(1);
    expect(triggered(events, 'tuning_fork')).toHaveLength(1);
    expect(hero(sim, 0).hero!.solo).toBeGreaterThanOrEqual(
      Math.min(100, before + value('tuning_fork', 'pct')) - 1e-6,
    );
  });
});

describe('rare relics', () => {
  it('Choirmaster’s Baton: a cued Solo lasts half again as long; the Hymnal pays the Cue', () => {
    const sim = sandbox(relics('choirmasters_baton', 'cantors_hymnal'));
    expect(weaver(sim).weaver!.resonance).toBe(value('cantors_hymnal', 'resonance'));
    stepFor(sim, 1, [{ t: 'debug', op: { op: 'chargeSolos' } }]);
    const events = stepFor(sim, 1, [{ t: 'cue', slot: 1 }]);
    const started = ofType(events, 'soloStarted')[0]!;
    const def = heroDef(hero(sim, 1).hero!.defId);
    expect(started.cued).toBe(true);
    expect(started.duration).toBeCloseTo(def.solo.duration * 1.5, 6);
    expect(hero(sim, 1).hero!.castProgress).toBeGreaterThanOrEqual(0);
  });

  it('Cantor’s Hymnal: the opening Resonance is a full segment, so it never fades', () => {
    const sim = sandbox(relics('cantors_hymnal'));
    stepFor(sim, 60 * 12);
    expect(weaver(sim).weaver!.resonance).toBe(value('cantors_hymnal', 'resonance'));
  });

  it('Hollow Bell: Chime comes back sooner but heals half as much', () => {
    const heals = (config: Parameters<typeof sandbox>[0]) => {
      const sim = sandbox(config);
      hurt(sim, 0, 200);
      const h = hero(sim, 0);
      const events = stepFor(sim, 30, [{ t: 'tech', id: 'chime', point: { x: h.x, z: h.z } }]);
      expect(ofType(events, 'chimeLanded')).toHaveLength(1);
      const healed = ofType(events, 'healApplied')
        .filter((e) => e.via === 'chime' && e.target === h.id)
        .reduce((s, e) => s + e.amount, 0);
      return { sim, healed };
    };
    const bell = heals(relics('hollow_bell'));
    const plain = heals({});
    expect(bell.healed).toBeCloseTo(plain.healed * (1 - value('hollow_bell', 'heal') / 100), 6);
    expect(weaver(bell.sim).weaver!.cooldownTotals.chime).toBeCloseTo(
      CONTENT.techniques.chime.cooldown * (1 - value('hollow_bell', 'pct') / 100),
      6,
    );
  });

  it('Martyr’s Veil: once per fight, the Weaver takes the blow that would down a hero', () => {
    const sim = sandbox(relics('martyrs_veil'));
    stepFor(sim, 5);
    const lifeBefore = weaver(sim).health!.hp;
    const hpBefore = hero(sim, 0).health!.hp;
    hurt(sim, 0, 1e5);
    const events = sim.drainEvents();
    expect(hero(sim, 0).health!.downed).toBe(false);
    expect(hero(sim, 0).health!.hp).toBe(hpBefore);
    // The Weaver takes it, and is left standing at 1 life.
    expect(weaver(sim).health!.hp).toBe(1);
    expect(weaver(sim).health!.downed).toBe(false);
    expect(lifeBefore).toBeGreaterThan(1);
    expect(ofType(events, 'save')[0]?.cause).toBe('martyr');
    expect(triggered(events, 'martyrs_veil')).toHaveLength(1);
    expect(sim.state.relics.veil).toBe(false);
    // Only once.
    stepFor(sim, 1);
    hurt(sim, 0, 1e6);
    expect(hero(sim, 0).health!.downed).toBe(true);
  });
});

describe('legendary relics', () => {
  it('Prism Loom: Mend and Empower spill onto heroes near the threaded one', () => {
    const sim = sandbox(relics('prism_loom'));
    stepFor(sim, 2, [{ t: 'thread', slot: 1 }]);
    const w = worldOf(sim);
    const [kael, lyra, vexis] = w.party.map((id) => w.entities.get(id)!);
    const radius = value('prism_loom', 'radius');
    kael!.x = lyra!.x + radius - 1;
    kael!.z = lyra!.z;
    vexis!.x = lyra!.x + radius + 4;
    vexis!.z = lyra!.z;
    expect(threadPotency(w, lyra!)).toBeGreaterThan(0.99);
    expect(threadPotency(w, kael!)).toBeCloseTo(
      (threadPotency(w, lyra!) * value('prism_loom', 'pct')) / 100,
      6,
    );
    expect(threadPotency(w, vexis!)).toBe(0);
    // Mend reaches Kael too.
    kael!.health!.hp = kael!.health!.maxHp * 0.6;
    const before = kael!.health!.hp;
    updateThread(w, 1);
    expect(kael!.health!.hp).toBeGreaterThan(before);
    // And so does Empower.
    stepFor(sim, 1, [{ t: 'mode' }]);
    kael!.x = lyra!.x + radius - 1;
    kael!.z = lyra!.z;
    expect(empowerBonus(w, kael!).more).toBeGreaterThan(0);
  });

  it('Cracked Metronome: an early Ward counts as Perfect, then it needs to wind up again', () => {
    const { sim, telegraph: t } = telegraphOn(
      'bell_brute',
      'Toll Cleave',
      0,
      2.5,
      sandbox(relics('cracked_metronome')),
    );
    stepFor(sim, 1, [{ t: 'tech', id: 'ward', slot: 0 }]);
    const { events, resolved } = resolvedOf(sim, t.id);
    expect(resolved.find((r) => r.target === hero(sim, 0).id)?.outcome).toBe('perfect');
    expect(triggered(events, 'cracked_metronome')).toHaveLength(1);
    expect(sim.state.relics.metronomeAt).toBeCloseTo(
      sim.state.time + value('cracked_metronome', 'cooldown'),
      1,
    );
  });

  it('Spindle of Fate: the echo plays at full strength; Unison stays silent', () => {
    const sim = sandbox({ auras: ['fortissimo'], ...relics('spindle_of_fate') });
    expect(sim.state.field.chords[0]!.echo).toBeCloseTo(1, 6);
    const unison = sandbox({
      chords: [{ auras: ['fortissimo'], ornaments: ['unison'] }],
      ...relics('spindle_of_fate'),
    });
    expect(unison.state.field.chords[0]!.echo).toBe(0);
    // No price on the Thread.
    const mods = resolveMods(resolveConfig({ seed: 1, ...relics('spindle_of_fate') }), CONTENT);
    expect(mods.mendMult).toBe(1);
    expect(mods.empowerMult).toBe(1);
  });
});

describe('cursed relics', () => {
  it('Heavy Score: heroes hit harder, and you can’t Glide until a Forge lifts the curse', () => {
    const sim = sandbox(relics('heavy_score'));
    const events = stepFor(sim, 1, [{ t: 'glide', x: 1, z: 0 }]);
    expect(ofType(events, 'techniqueRejected')[0]).toMatchObject({
      technique: 'glide',
      reason: 'locked',
    });
    const cleansed = sandbox({ relics: [{ id: 'heavy_score', cleansed: true }] });
    expect(cleansed.state.relics.cleansed).toEqual(['heavy_score']);
    const glided = stepFor(cleansed, 1, [{ t: 'glide', x: 1, z: 0 }]);
    expect(ofType(glided, 'glided')).toHaveLength(1);
    // The Score's share of every hit: pct / (100 + pct).
    stepFor(cleansed, 1, [spawn('bell_brute', 0, -3)]);
    const hits = ofType(stepFor(cleansed, 60 * 5), 'damageTaken').filter(
      (e) => cleansed.state.party.includes(e.source ?? -1) && e.amount + e.absorbed > 0,
    );
    expect(hits.length).toBeGreaterThan(0);
    const share = value('heavy_score', 'pct') / (100 + value('heavy_score', 'pct'));
    for (const h of hits)
      expect(h.amplified / (h.amount + h.absorbed)).toBeGreaterThanOrEqual(share - 1e-6);
  });

  it('Glass Halo: a Perfect Ward heals everyone; the curse halves Ward’s barrier', () => {
    const halo = resolveMods(resolveConfig({ seed: 1, ...relics('glass_halo') }), CONTENT);
    expect(halo.wardBarrierMult).toBeCloseTo(0.5, 6);
    const lifted = resolveMods(
      resolveConfig({ seed: 1, relics: [{ id: 'glass_halo', cleansed: true }] }),
      CONTENT,
    );
    expect(lifted.wardBarrierMult).toBe(NO_MODS.wardBarrierMult);
    const { sim, telegraph: t } = telegraphOn(
      'bell_brute',
      'Toll Cleave',
      0,
      2.5,
      sandbox(relics('glass_halo')),
    );
    hurt(sim, 2, 300);
    const hurtHp = hero(sim, 2).health!.hp;
    stepUntil(sim, () => sim.state.time >= t.perfectFrom + 0.05);
    stepFor(sim, 1, [{ t: 'tech', id: 'ward', slot: 0 }]);
    const { events } = resolvedOf(sim, t.id);
    expect(triggered(events, 'glass_halo')).toHaveLength(1);
    expect(hero(sim, 2).health!.hp).toBeGreaterThan(hurtHp);
  });
});

describe('boons and banes', () => {
  it('The Last Note: every hero starts with their Solo charged', () => {
    const sim = createSim({ seed: 2, encounter: 'sandbox', boons: ['last_note'] });
    expect(sim.state.party.map((id) => sim.state.entities.get(id)!.hero!.solo)).toEqual([
      100, 100, 100,
    ]);
    expect(ofType(sim.drainEvents(), 'soloReady')).toHaveLength(3);
  });

  it('Frayed Spirit shrinks Spirit; the Mended Loom strengthens the Thread', () => {
    const frayed = createSim({ seed: 2, encounter: 'sandbox', boons: ['frayed_spirit'] });
    expect(frayed.state.entities.get(frayed.state.weaverId)!.weaver!.maxSpirit).toBeCloseTo(
      CONTENT.weaver.maxSpirit * 0.9,
      6,
    );
    const loom = resolveMods(resolveConfig({ seed: 1, boons: ['mended_loom'] }), CONTENT);
    expect(loom.mendMult).toBeCloseTo(1.1, 6);
    expect(loom.empowerMult).toBeCloseTo(1.1, 6);
  });
});

describe('Threat', () => {
  it('multiplies every enemy’s life, and is clamped', () => {
    const plain = sandbox();
    const deep = sandbox({ threat: 1.2 });
    stepFor(plain, 1, [spawn('bell_brute', 0, -6)]);
    stepFor(deep, 1, [spawn('bell_brute', 0, -6)]);
    const hp = (sim: typeof plain) =>
      sim.state.entities.list().find((e) => e.enemy?.defId === 'bell_brute')!.health!.maxHp;
    expect(hp(deep)).toBe(Math.round(hp(plain) * 1.2));
    expect(resolveConfig({ seed: 1 }).threat).toBe(1);
    expect(resolveConfig({ seed: 1, threat: 0.5 }).threat).toBe(1);
    expect(resolveConfig({ seed: 1, threat: 9 }).threat).toBe(3);
  });
});

describe('review fixes', () => {
  it('Martyr’s Veil after an early Ward records one Save, not two', () => {
    const { sim, telegraph: t } = telegraphOn(
      'bell_brute',
      'Toll Cleave',
      0,
      2.5,
      sandbox(relics('martyrs_veil')),
      true,
    );
    // An early Ward (no Perfect), on a hero the cleave would kill anyway.
    stepFor(sim, 1, [{ t: 'tech', id: 'ward', slot: 0 }]);
    const kael = worldOf(sim).entities.get(sim.state.party[0]!)!;
    kael.health!.hp = 5;
    // A thin Ward: it takes part of the cleave, and the rest would still kill.
    kael.health!.shields.find((s) => s.kind === 'ward')!.amount = 10;
    resolvedOf(sim, t.id);
    expect(hero(sim, 0).health!.downed).toBe(false);
    expect(sim.state.ledger.saves.map((s) => s.cause)).toEqual(['martyr']);
  });

  it('Martyr’s Veil credits the life the hero kept, not the overkill', () => {
    const sim = sandbox(relics('martyrs_veil'));
    stepFor(sim, 5);
    worldOf(sim).entities.get(sim.state.party[0]!)!.health!.hp = 50;
    const before = sim.state.ledger.shielded;
    hurt(sim, 0, 5000);
    expect(hero(sim, 0).health!.hp).toBe(50);
    expect(sim.state.ledger.shielded - before).toBe(50);
  });

  it('Thimble and Lantern leave a hero’s own overshield alone', () => {
    const sim = sandbox(relics('silver_thimble', 'lantern_of_the_lost'));
    stepFor(sim, 5);
    const w = worldOf(sim);
    const lyra = w.entities.get(w.party[1]!)!;
    addShield(w, lyra, 'overshield', 10, 5, false);
    const events = stepFor(sim, 1, [{ t: 'thread', slot: 1 }]);
    expect(triggered(events, 'silver_thimble')).toHaveLength(0);
    expect(lyra.health!.shields.find((s) => s.kind === 'overshield')).toMatchObject({
      amount: 10,
      fromWeaver: false,
    });
    // The Thimble wasn't spent on it.
    expect(sim.state.relics.thimbleAt).toBe(0);
    hurt(sim, 0, 1e6);
    expect(lyra.health!.shields.find((s) => s.kind === 'overshield')!.fromWeaver).toBe(false);
    // The Lantern names who it reached: Vexis, not Lyra.
    const lit = ofType(sim.drainEvents(), 'relicTriggered').find(
      (e) => e.relic === 'lantern_of_the_lost',
    );
    expect(lit?.targets).toEqual([hero(sim, 2).id]);
    expect(hero(sim, 2).health!.shields.find((s) => s.kind === 'overshield')?.fromWeaver).toBe(
      true,
    );
  });
});
