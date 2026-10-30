/**
 * Phase 4d: Dissonance in the sim (docs/phase-4d.md). Each level's effect on the fight, at its
 * rank; Restless Dead's rise; Elite Vanguard's extra elite and affix; the state the views read.
 */
import { describe, expect, it } from 'vitest';
import { CONTENT, DISSONANCE_EFFECTS, attackDef, dissonanceLevel } from '../../src/content';
import { createSim, type SimConfig } from '../../src/sim';
import { addStatus, dealDamage, heal, rising } from '../../src/sim/combat/health';
import { updateField } from '../../src/sim/systems/field';
import { resolveMods } from '../../src/sim/mods';
import { resolveConfig } from '../../src/sim/world';
import { hero, ofType, sandbox, spawn, stepFor, stepUntil, worldOf } from './helpers';

const level = (id: string, rank = 1) => ({ id, rank });
const modsOf = (config: Partial<SimConfig> = {}) =>
  resolveMods(resolveConfig({ seed: 1, ...config }), CONTENT);
const v = (id: string, key: string) => dissonanceLevel(id).values[key]!;

describe('Dissonance in the fight', () => {
  it('every level the fight reads changes it; the run’s and the views’ are theirs', () => {
    const base = modsOf();
    const runOrViews = new Set(['no_respite_heal', 'blind_score', 'cursed_start']);
    for (const effect of DISSONANCE_EFFECTS) {
      const def = CONTENT.dissonance.find((d) => d.effect === effect)!;
      const mods = modsOf({ dissonance: [level(def.id)] });
      if (runOrViews.has(effect)) expect(mods, effect).toEqual(base);
      else expect(mods, effect).not.toEqual(base);
    }
  });

  it('each at its numbers, ranks adding up', () => {
    const m = modsOf({
      dissonance: [
        level('brisk_foes'),
        level('hardened', 2),
        level('short_fuse', 2),
        level('muted_choir'),
        level('fragile_threads'),
        level('wounding_strikes', 2),
        level('silent_cues'),
        level('restless_dead'),
        level('elite_vanguard'),
      ],
    });
    expect(m.enemySpeedMult).toBeCloseTo(1 + v('brisk_foes', 'pct') / 100, 9);
    expect(m.enemyLifeMult).toBeCloseTo(1 + (2 * v('hardened', 'pct')) / 100, 9);
    expect(m.dissonanceWindupMult).toBeCloseTo(1 - (2 * v('short_fuse', 'pct')) / 100, 9);
    expect(m.dissonanceRadiusMult).toBeCloseTo(1 - v('muted_choir', 'pct') / 100, 9);
    expect(m.fieldRadiusMult).toBe(1);
    expect(m.threadRangeBonus).toBe(-v('fragile_threads', 'metres'));
    expect(m.heroHealMult).toBeCloseTo(1 - (2 * v('wounding_strikes', 'pct')) / 100, 9);
    expect(m.cueCostBonus).toBe(v('silent_cues', 'resonance'));
    expect(m.restlessPct).toBe(v('restless_dead', 'pct'));
    expect([m.vanguardElites, m.vanguardAffixes]).toEqual([1, 1]);
  });

  it('the config: content order, ranks clamped, unknown refused, kept for an absent Weaver', () => {
    const config = resolveConfig({
      seed: 1,
      encounter: 'first_light',
      absent: true,
      dissonance: [level('short_fuse', 9), level('brisk_foes'), level('hardened', 0)],
    });
    expect(config.dissonance).toEqual([level('brisk_foes'), level('short_fuse', 2)]);
    expect(() => resolveConfig({ seed: 1, dissonance: [level('nonsense')] })).toThrow(/Dissonance/);
  });

  it('enemies spawn with more life and speed; the state says what’s in force', () => {
    const plain = sandbox();
    const hard = sandbox({ dissonance: [level('hardened', 2), level('brisk_foes')] });
    for (const sim of [plain, hard]) stepFor(sim, 30, [spawn('bell_brute', 0, -6)]);
    const brute = (sim: ReturnType<typeof sandbox>) =>
      [...worldOf(sim).entities.list()].find((e) => e.enemy)!;
    expect(brute(hard).health!.maxHp / brute(plain).health!.maxHp).toBeCloseTo(1.5, 1);
    expect(brute(hard).speed / brute(plain).speed).toBeCloseTo(1.15, 6);
    expect(hard.state.dissonance.levels).toEqual([level('brisk_foes'), level('hardened', 2)]);
    expect(hard.state.dissonance.blindScore).toBe(false);
    expect(sandbox({ dissonance: [level('blind_score')] }).state.dissonance.blindScore).toBe(true);
  });

  it('Wounding Strikes: heroes are healed less', () => {
    const healed = (config: Partial<SimConfig>) => {
      const sim = sandbox(config);
      const w = worldOf(sim);
      const kael = w.entities.get(w.party[0]!)!;
      kael.health!.hp = kael.health!.maxHp / 2;
      return heal(w, kael, 100, 'mend');
    };
    expect(healed({})).toBe(100);
    expect(healed({ dissonance: [level('wounding_strikes', 2)] })).toBeCloseTo(70, 9);
  });

  it('Muted Choir: every song reaches 15% less, past the field’s cap and in Sunrise', () => {
    // Reverb on the field song, the Luminary and Wide Choir: the field song is at the cap.
    const wide: Partial<SimConfig> = {
      chords: [
        { auras: ['fortissimo'], ornaments: [] },
        { auras: ['sostenuto'], ornaments: ['reverb'] },
      ],
      calling: { id: 'luminary', path: ['wide_choir'] },
    };
    const radii = (config: Partial<SimConfig>) => {
      const sim = sandbox(config);
      const first = sim.state.field.chords.map((c) => c.radius);
      stepFor(sim, 2);
      const w = worldOf(sim);
      const after = [w.field.radius, ...w.field.chords.map((c) => c.radius)];
      w.field.crescendo = true;
      updateField(w, 1 / 60);
      return [...first, ...after, w.field.radius, ...w.field.chords.map((c) => c.radius)];
    };
    const plain = radii(wide);
    const muted = radii({ ...wide, dissonance: [level('muted_choir')] });
    expect(plain[1]).toBe(CONTENT.weaver.fieldRadiusCap);
    const k = 1 - v('muted_choir', 'pct') / 100;
    plain.forEach((r, i) => expect(muted[i], `radius ${i}`).toBeCloseTo(r * k, 6));
  });

  it('an enemy healer’s hymn heals as many times, however long its channel runs', () => {
    /** Heal pulses over one hymn, staged with its channel `scale` × its wind-up. */
    const pulses = (scale: number, dissonance: SimConfig['dissonance'] = []) => {
      const sim = sandbox({ dissonance });
      const w = worldOf(sim);
      // No hero to stun the healer and cut its hymn short.
      for (const id of w.party) Object.assign(w.entities.get(id)!.health!, { hp: 0, dead: true });
      stepFor(sim, 60, [spawn('cantor_acolyte', 0, -10), spawn('bell_brute', 1, -10)]);
      const [acolyte, brute] = [...w.entities.list()].filter((e) => e.enemy);
      brute!.health!.hp = 10;
      const c = acolyte!.enemy!;
      c.cast = {
        attackId: 'acolyte_mending_hymn',
        name: 'Mending Hymn',
        telegraph: null,
        start: w.time,
        end: w.time + attackDef('acolyte_mending_hymn').windup * scale,
        interruptible: true,
      };
      c.state = 'channel';
      c.stateTime = 0;
      const ticks = new Set<number>();
      for (let t = 0; t < 60 * 8 && c.cast; t++)
        for (const e of ofType(stepFor(sim, 1), 'healApplied'))
          if (e.source === acolyte!.id) ticks.add(e.tick);
      expect(c.cast).toBeNull();
      return ticks.size;
    };
    const count = Math.floor(attackDef('acolyte_mending_hymn').windup);
    // Short Fuse ×2, Hastened, as written, the assist's lead, Lullaby or Slow Dance on top.
    for (const scale of [0.8, 0.85, 1, 1.5, 2]) expect(pulses(scale), `×${scale}`).toBe(count);
    const fuse = 1 - (2 * v('short_fuse', 'pct')) / 100;
    expect(pulses(fuse, [level('short_fuse', 2)])).toBe(count);
  });

  it('Fragile Threads: the Thread reaches less, for attaching and snapping', () => {
    const sim = sandbox({ dissonance: [level('fragile_threads')] });
    const w = worldOf(sim);
    const weaver = w.entities.get(w.weaverId)!;
    const reach = CONTENT.thread.snapRange - v('fragile_threads', 'metres');
    expect(weaver.weaver!.threadRange).toBe(reach);
    // A hero just past the shorter reach can't be threaded.
    const kael = w.entities.get(w.party[0]!)!;
    kael.x = weaver.x;
    kael.z = weaver.z - (reach + 0.5);
    expect(ofType(stepFor(sim, 1, [{ t: 'thread', slot: 0 }]), 'techniqueRejected')).toEqual([
      expect.objectContaining({ technique: 'thread', reason: 'range' }),
    ]);
  });

  it('Silent Cues: a Cue costs more', () => {
    const sim = sandbox({ dissonance: [level('silent_cues')] });
    const cost = CONTENT.resonance.cueCost + v('silent_cues', 'resonance');
    expect(sim.state.dissonance.cueCost).toBe(cost);
    stepFor(sim, 2, [
      { t: 'debug', op: { op: 'chargeSolos' } },
      { t: 'debug', op: { op: 'setResonance', value: CONTENT.resonance.cueCost } },
    ]);
    expect(ofType(stepFor(sim, 1, [{ t: 'cue', slot: 0 }]), 'cued')).toHaveLength(0);
    stepFor(sim, 1, [{ t: 'debug', op: { op: 'setResonance', value: cost } }]);
    expect(ofType(stepFor(sim, 1, [{ t: 'cue', slot: 0 }]), 'cued')).toHaveLength(1);
  });
});

describe('Restless Dead', () => {
  it('an enemy struck down rises once at 30% of its life, then dies for good', () => {
    const sim = sandbox({ dissonance: [level('restless_dead')] });
    stepFor(sim, 60, [spawn('hollow_chorister', 0, -6)]);
    const w = worldOf(sim);
    const e = [...w.entities.list()].find((x) => x.enemy)!;
    const strike = () =>
      dealDamage(w, e, {
        source: w.party[0]!,
        sourceName: 'test',
        amount: e.health!.hp + 1,
        telegraph: null,
      });
    strike();
    const rose = ofType(stepFor(sim, 1), 'enemyRose');
    expect(e.health!.dead).toBe(false);
    expect(e.enemy!.risen).toBe(true);
    expect(e.health!.hp).toBe(Math.round(e.health!.maxHp * 0.3));
    expect(rose).toHaveLength(1);
    // It stands up again before it fights.
    expect(e.enemy!.state).toBe('spawning');
    stepUntil(sim, () => e.enemy!.state !== 'spawning');
    strike();
    expect(e.health!.dead).toBe(true);
  });

  it('a rising enemy is untouchable until it stands; heroes look elsewhere', () => {
    const sim = sandbox({ dissonance: [level('restless_dead')] });
    stepFor(sim, 60, [spawn('hollow_chorister', 0, -6), spawn('hollow_chorister', 2, -7)]);
    const w = worldOf(sim);
    const [e] = [...w.entities.list()].filter((x) => x.enemy);
    const strike = (amount: number) =>
      dealDamage(w, e!, { source: w.party[0]!, sourceName: 'test', amount, telegraph: null });
    strike(e!.health!.hp + 1);
    expect(rising(e!)).toBe(true);
    const hp = e!.health!.hp;
    expect(strike(50).dealt).toBe(0);
    expect(addStatus(w, e!, 'stun', 2, w.party[0]!)).toBe(false);
    expect(e!.health!.hp).toBe(hp);
    expect(e!.health!.statuses).toEqual([]);
    // Focused, it's still left alone while it stands up.
    w.focusTarget = e!.id;
    for (let t = 0; t < 20 && rising(e!); t++) {
      stepFor(sim, 1);
      for (const id of w.party) expect(w.entities.get(id)!.hero!.targetId).not.toBe(e!.id);
    }
    expect(e!.health!.hp).toBe(hp);
    stepUntil(sim, () => !rising(e!));
    expect(strike(10).dealt).toBeGreaterThan(0);
  });

  it('bosses and mini-bosses don’t rise', () => {
    const sim = createSim({
      seed: 3,
      encounter: 'bellwarden',
      dissonance: [level('restless_dead')],
      debug: true,
    });
    stepUntil(sim, () => sim.state.encounter.bossId !== null, 60 * 30);
    const w = worldOf(sim);
    const boss = w.entities.get(w.encounter.bossId!)!;
    stepUntil(sim, () => boss.enemy!.state !== 'spawning', 60 * 10);
    dealDamage(w, boss, {
      source: w.party[0]!,
      sourceName: 'test',
      amount: boss.health!.hp + 1,
      telegraph: null,
    });
    expect(boss.health!.dead || boss.health!.hp <= 0).toBe(true);
    expect(boss.enemy?.risen ?? false).toBe(false);
  });
});

describe('Elite Vanguard', () => {
  it('an elite fight brings one more elite, and every elite an extra affix', () => {
    /** Every enemy the fight sends, its waves cleared as they come. */
    const sent = (dissonance: SimConfig['dissonance']) => {
      const sim = createSim({ seed: 5, encounter: 'muted_nave', dissonance, debug: true });
      const seen = new Map<number, { tier: string; affixes: string[] }>();
      const over = () => ['victory', 'defeat'].includes(sim.state.encounter.status);
      for (let t = 0; t < 60 * 120 && !over(); t += 30) {
        stepFor(sim, 30);
        for (const e of worldOf(sim).entities.list())
          if (e.enemy) seen.set(e.id, { tier: e.enemy.tier, affixes: [...e.enemy.affixes] });
        if (worldOf(sim).internal.pendingSpawns.length === 0)
          stepFor(sim, 1, [{ t: 'debug', op: { op: 'killEnemies' } }]);
      }
      return [...seen.values()].filter((e) => e.tier === 'elite');
    };
    const plain = sent([]);
    const more = sent([level('elite_vanguard')]);
    expect(plain.length).toBeGreaterThan(0);
    expect(more.length).toBe(plain.length + 1);
    // Every elite carries one more affix than in the plain fight (the extra one its group's).
    const base = new Set(plain.map((e) => e.affixes.length));
    expect(base.size).toBe(1);
    for (const e of more) {
      expect(new Set(e.affixes).size).toBe(e.affixes.length);
      expect(e.affixes.length).toBe([...base][0]! + 1);
    }
  });

  it('the extra affixes are seeded by the fight: the same seed, the same; others differ', () => {
    /** The first elite's affixes. */
    const first = (seed: number) => {
      const sim = createSim({
        seed,
        encounter: 'muted_nave',
        dissonance: [level('elite_vanguard')],
      });
      for (let t = 0; t < 60 * 30; t++) {
        stepFor(sim, 1);
        const elite = [...worldOf(sim).entities.list()].find((e) => e.enemy?.tier === 'elite');
        if (elite) return elite.enemy!.affixes.join(',');
      }
      throw new Error('no elite');
    };
    expect(first(11)).toBe(first(11));
    const seen = new Set([1, 2, 3, 4, 5, 6, 7, 8].map(first));
    expect(seen.size).toBeGreaterThan(1);
  });

  it('a fight that isn’t an elite one keeps its count', () => {
    const count = (dissonance: SimConfig['dissonance']) => {
      const sim = createSim({ seed: 5, encounter: 'first_light', dissonance });
      stepFor(sim, 60 * 6);
      return [...worldOf(sim).entities.list()].filter((e) => e.enemy).length;
    };
    expect(count([level('elite_vanguard')])).toBe(count([]));
    void hero;
  });
});
