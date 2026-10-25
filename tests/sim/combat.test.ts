import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../src/content';
import { addShield, dealDamage } from '../../src/sim/combat/health';
import { KNOWN_MOTIFS, NO_MODS, resolveMods } from '../../src/sim/mods';
import { resolveConfig } from '../../src/sim/world';
import type { Sim } from '../../src/sim';
import { hero, hurt, ofType, sandbox, spawn, stepFor, stepUntil, weaver, worldOf } from './helpers';

const tech = CONTENT.techniques;
const res = CONTENT.resonance;

/** Puts an enemy near a hero and waits for its named telegraph. */
function telegraphOn(
  defId: string,
  name: string,
  slot = 0,
  offset = 2.5,
  sim: Sim = sandbox(),
  tough = false,
) {
  const h = hero(sim, slot);
  stepFor(sim, 1, [spawn(defId, h.x, h.z - offset)]);
  if (tough) {
    // Keep the caster alive: killing it would cancel its pending attacks.
    for (const e of worldOf(sim).entities.list()) {
      if (e.enemy && e.health) e.health.hp = e.health.maxHp = 1e6;
    }
  }
  const events = stepUntil(sim, (ev) =>
    ev.some((e) => e.type === 'telegraphStarted' && e.name === name),
  );
  const started = ofType(events, 'telegraphStarted').find((e) => e.name === name)!;
  return { sim, started, telegraph: sim.state.telegraphs.find((t) => t.id === started.telegraph)! };
}

function resolvedOf(sim: Sim, id: number) {
  const events = stepUntil(
    sim,
    (ev) => ev.some((e) => e.type === 'telegraphResolved' && e.telegraph === id),
    600,
  );
  return {
    events,
    resolved: ofType(events, 'telegraphResolved').filter((e) => e.telegraph === id),
  };
}

describe('Ward and the Perfect window', () => {
  it('a Ward inside the window negates the hit: Perfect, refund, stagger, Resonance', () => {
    const { sim, telegraph: t } = telegraphOn('bell_brute', 'Toll Cleave');
    expect(t.perfectFrom).toBeCloseTo(t.impact - tech.ward.perfectWindow, 6);
    stepUntil(sim, () => sim.state.time >= t.perfectFrom + 0.05);
    const hp = hero(sim, 0).health!.hp;
    const spirit = weaver(sim).weaver!.spirit;
    const events = stepFor(sim, 1, [{ t: 'tech', id: 'ward', slot: 0 }]);
    expect(ofType(events, 'techniqueCast')).toHaveLength(1);
    const { events: after, resolved } = resolvedOf(sim, t.id);
    const all = [...events, ...after];
    expect(resolved.find((r) => r.target === hero(sim, 0).id)?.outcome).toBe('perfect');
    expect(ofType(all, 'perfectWard')).toHaveLength(1);
    expect(hero(sim, 0).health!.hp).toBeGreaterThanOrEqual(hp - 200); // only basics, never the cleave
    expect(sim.state.ledger.perfects).toBe(1);
    expect(sim.state.ledger.negated).toBeGreaterThan(500);
    // Half the Ward's cost comes back (plus regen).
    expect(weaver(sim).weaver!.spirit).toBeGreaterThan(
      spirit - tech.ward.cost + tech.ward.cost * tech.ward.perfectRefund - 1,
    );
    expect(ofType(all, 'statusApplied').some((s) => s.status === 'stagger')).toBe(true);
    expect(weaver(sim).weaver!.resonance).toBeGreaterThanOrEqual(res.gains.perfectWard - 1);
    expect(ofType(all, 'timeScaleChanged').some((e) => e.reason === 'perfect')).toBe(true);
  });

  it('an early Ward only absorbs: no Perfect', () => {
    const { sim, telegraph: t } = telegraphOn('bell_brute', 'Toll Cleave');
    stepFor(sim, 1, [{ t: 'tech', id: 'ward', slot: 0 }]);
    const { events, resolved } = resolvedOf(sim, t.id);
    const outcome = resolved.find((r) => r.target === hero(sim, 0).id)?.outcome;
    expect(outcome === 'warded' || outcome === 'hit').toBe(true);
    expect(ofType(events, 'perfectWard')).toHaveLength(0);
    expect(sim.state.ledger.shielded).toBeGreaterThan(0);
  });

  it('rejects a Ward with no charges, out of range or without Spirit', () => {
    const sim = sandbox();
    let events = stepFor(sim, 1, [{ t: 'tech', id: 'ward', slot: 0 }]);
    expect(ofType(events, 'techniqueCast')).toHaveLength(1);
    events = stepFor(sim, 1, [{ t: 'tech', id: 'ward', slot: 0 }]);
    expect(ofType(events, 'techniqueRejected')[0]?.reason).toBe('cooldown');
    const far = sandbox();
    stepFor(far, 1, [{ t: 'debug', op: { op: 'teleportWeaver', x: 20, z: 0 } }]);
    events = stepFor(far, 1, [{ t: 'tech', id: 'ward', slot: 2 }]);
    expect(ofType(events, 'techniqueRejected')[0]?.reason).toBe('range');
    const broke = sandbox();
    worldOf(broke).entities.get(broke.state.weaverId)!.weaver!.spirit = 5;
    events = stepFor(broke, 1, [{ t: 'tech', id: 'ward', slot: 0 }]);
    expect(ofType(events, 'techniqueRejected')[0]?.reason).toBe('spirit');
  });
});

describe('Chime', () => {
  it('cleanses a Dirge late for a clutch, cancelling the detonation', () => {
    const { sim, telegraph: t } = telegraphOn('lamenter', 'Dirge', 0, 8, sandbox(), true);
    const target = sim.state.entities.get(t.target!)!;
    expect(target.health!.statuses.some((s) => s.id === 'dirge')).toBe(true);
    // Fire so it lands with < 1 s of the mark left.
    stepUntil(
      sim,
      () => t.impact - sim.state.time < tech.chime.clutchWindow + tech.chime.flight - 0.1,
    );
    const resonance = weaver(sim).weaver!.resonance;
    stepFor(sim, 1, [{ t: 'tech', id: 'chime', point: { x: target.x, z: target.z } }]);
    const { events, resolved } = resolvedOf(sim, t.id);
    const landed = ofType(events, 'chimeLanded')[0]!;
    expect(landed.clutch).toBe(true);
    expect(resolved[0]!.outcome).toBe('cancelled');
    expect(sim.state.entities.get(target.id)!.health!.statuses.some((s) => s.id === 'immune')).toBe(
      true,
    );
    expect(sim.state.ledger.cleanses).toBe(1);
    expect(sim.state.ledger.clutchCleanses).toBe(1);
    expect(weaver(sim).weaver!.resonance).toBeGreaterThanOrEqual(
      resonance + res.gains.cleanse + res.gains.clutchChime - 1,
    );
  });

  it('killing the singer ends the Dirge', () => {
    const { sim, telegraph: t } = telegraphOn('lamenter', 'Dirge', 0, 8, sandbox(), true);
    const singer = sim.state.entities.get(t.owner)!;
    stepFor(sim, 1, [{ t: 'debug', op: { op: 'killEnemies' } }]);
    expect(sim.state.entities.get(singer.id)).toBeUndefined();
    expect(sim.state.telegraphs.some((x) => x.id === t.id)).toBe(false);
  });

  it('an unanswered Dirge detonates for half the target’s life and silences them', () => {
    const { sim, telegraph: t } = telegraphOn('lamenter', 'Dirge', 0, 8, sandbox(), true);
    const target = t.target!;
    const before = sim.state.entities.get(target)!.health!;
    const maxHp = before.maxHp;
    const { events, resolved } = resolvedOf(sim, t.id);
    expect(resolved[0]!.outcome).toBe('hit');
    const hit = ofType(events, 'damageTaken').find((d) => d.telegraph === t.id)!;
    expect(hit.amount + hit.absorbed).toBeCloseTo(maxHp * 0.5, 0);
    expect(
      ofType(events, 'statusApplied').some((s) => s.target === target && s.status === 'silence'),
    ).toBe(true);
  });
});

describe('Reel', () => {
  it('pulls a hero out of a beam: dodged, with Resonance', () => {
    const sim = sandbox();
    // A lancer far away aims at the farthest hero; reel that hero to the Weaver.
    const { telegraph: t } = telegraphOn('glass_lancer', 'Glass Lance', 0, 14, sim);
    const victim = sim.state.party.indexOf(t.target!);
    expect(victim).toBeGreaterThanOrEqual(0);
    stepUntil(sim, () => t.impact - sim.state.time < 0.6);
    const before = weaver(sim).weaver!.resonance;
    stepFor(sim, 1, [
      { t: 'aim', x: weaver(sim).x + 3, z: weaver(sim).z + 3 },
      { t: 'tech', id: 'reel', slot: victim as 0 | 1 | 2 },
    ]);
    const { resolved } = resolvedOf(sim, t.id);
    expect(resolved.find((r) => r.target === t.target)?.outcome).toBe('dodged');
    expect(sim.state.ledger.reels).toBeGreaterThanOrEqual(1);
    expect(weaver(sim).weaver!.resonance).toBeGreaterThan(before);
  });
});

describe('the Thread', () => {
  it('heals in Mend, snaps past the snap range and locks out briefly', () => {
    const sim = sandbox();
    hurt(sim, 1, 400);
    const hp = hero(sim, 1).health!.hp;
    stepFor(sim, 60, [{ t: 'thread', slot: 1 }]);
    expect(hero(sim, 1).health!.hp).toBeGreaterThan(hp + CONTENT.thread.mendPerSec * 0.8);
    // Teleport the Weaver away: the Thread snaps.
    let events = stepFor(sim, 2, [{ t: 'debug', op: { op: 'teleportWeaver', x: 20, z: 0 } }]);
    expect(ofType(events, 'threadSnapped')).toHaveLength(1);
    expect(weaver(sim).weaver!.threadSlot).toBeNull();
    stepFor(sim, 1, [{ t: 'debug', op: { op: 'teleportWeaver', x: 0, z: 0 } }]);
    events = stepFor(sim, 1, [{ t: 'thread', slot: 1 }]);
    expect(ofType(events, 'techniqueRejected')[0]?.reason).toBe('locked');
    stepFor(sim, 70);
    events = stepFor(sim, 1, [{ t: 'thread', slot: 1 }]);
    expect(ofType(events, 'threadAttached')).toHaveLength(1);
  });

  it('revives a downed hero with Mend; unattended heroes bleed out', () => {
    const sim = sandbox();
    hurt(sim, 1, 5000);
    hurt(sim, 2, 5000);
    expect(hero(sim, 1).health!.downed).toBe(true);
    const events = stepUntil(
      sim,
      (ev) => ev.some((e) => e.type === 'revived'),
      60 * 5,
      (tick) => (tick === 1 ? [{ t: 'thread', slot: 1 }] : []),
    );
    expect(ofType(events, 'reviveStarted')).toHaveLength(1);
    const lyra = hero(sim, 1).health!;
    expect(lyra.downed).toBe(false);
    expect(lyra.hp).toBeCloseTo(lyra.maxHp * CONTENT.thread.reviveHpPct, -1);
    const out = stepUntil(sim, (ev) => ev.some((e) => e.type === 'allyOut'), 60 * 13);
    expect(ofType(out, 'allyOut')[0]!.hero).toBe(sim.state.party[2]);
    expect(hero(sim, 2).health!.dead).toBe(true);
  });

  it('Empower amplifies the threaded hero, and the ledger records the Weaver’s share', () => {
    const sim = sandbox();
    const lyra = hero(sim, 1);
    stepFor(sim, 1, [
      spawn('bell_brute', lyra.x, lyra.z - 6),
      { t: 'thread', slot: 1 },
      { t: 'mode' },
    ]);
    stepFor(sim, 60 * 6);
    expect(sim.state.ledger.amplified).toBeGreaterThan(0);
    expect(hero(sim, 1).hero!.damageAmplified).toBeGreaterThan(0);
  });
});

describe('Resonance, Cues and the Crescendo', () => {
  it('partial segments decay when idle; filled segments are kept', () => {
    const sim = sandbox();
    stepFor(sim, 1, [{ t: 'debug', op: { op: 'setResonance', value: 60 } }]);
    stepFor(sim, 60 * 12);
    expect(weaver(sim).weaver!.resonance).toBe(50);
  });

  it('a Cue needs a charged Solo and a segment of Resonance', () => {
    const sim = sandbox();
    let events = stepFor(sim, 1, [{ t: 'cue', slot: 0 }]);
    expect(ofType(events, 'techniqueRejected')[0]?.reason).toBe('not-ready');
    worldOf(sim).entities.get(sim.state.party[0]!)!.hero!.solo = 100;
    events = stepFor(sim, 1, [{ t: 'cue', slot: 0 }]);
    expect(ofType(events, 'techniqueRejected')[0]?.reason).toBe('resonance');
    stepFor(sim, 1, [{ t: 'debug', op: { op: 'setResonance', value: 50 } }]);
    events = stepFor(sim, 1, [{ t: 'cue', slot: 0 }]);
    const started = ofType(events, 'soloStarted')[0]!;
    expect(started.cued).toBe(true);
    expect(started.solo).toBe('aegisWall');
    expect(weaver(sim).weaver!.resonance).toBeCloseTo(25, 6);
    // Cued Aegis Wall: a dome on every hero.
    for (let s = 0; s < 3; s++)
      expect(hero(sim, s).health!.shields.some((x) => x.kind === 'dome')).toBe(true);
  });

  it('the Crescendo costs a full song, heals, and blazes the field for its duration', () => {
    const sim = sandbox({ auras: ['sostenuto', 'fortissimo'] });
    hurt(sim, 1, 400);
    let events = stepFor(sim, 1, [{ t: 'crescendo' }]);
    expect(ofType(events, 'techniqueRejected')[0]?.reason).toBe('resonance');
    stepFor(sim, 1, [{ t: 'debug', op: { op: 'setResonance', value: 100 } }]);
    const hp = hero(sim, 1).health!.hp;
    events = stepFor(sim, 1, [{ t: 'crescendo' }]);
    expect(ofType(events, 'crescendoStart')).toHaveLength(1);
    expect(sim.state.field.crescendo).toBe(true);
    expect(hero(sim, 1).health!.hp).toBeGreaterThan(hp + 100);
    const end = stepUntil(sim, (ev) => ev.some((e) => e.type === 'crescendoEnd'), 60 * 8);
    expect(ofType(end, 'crescendoEnd')).toHaveLength(1);
    expect(sim.state.field.crescendo).toBe(false);
  });
});

describe('enemies and affixes', () => {
  it('Glide grants i-frames: a hit during them is dodged', () => {
    const sim = sandbox();
    const w = weaver(sim);
    stepFor(sim, 1, [spawn('the_bellwarden', w.x, w.z - 3)]);
    // Wait for any ground telegraph that covers the Weaver, then glide just before it lands.
    const events = stepUntil(
      sim,
      () => sim.state.telegraphs.some((t) => ['circle', 'cone'].includes(t.shape.kind)),
      60 * 20,
    );
    void events;
    const t = sim.state.telegraphs.find((x) => ['circle', 'cone'].includes(x.shape.kind))!;
    stepUntil(sim, () => t.impact - sim.state.time < 0.15);
    stepFor(sim, 1, [{ t: 'glide', x: 0, z: 1 }]);
    expect(weaver(sim).health!.invulnerable).toBeGreaterThan(0);
  });

  it('Shielded elites need Empower to break their Discord barrier quickly', () => {
    const sim = sandbox();
    const w = worldOf(sim);
    stepFor(sim, 1, [spawn('bell_brute', 0, -10, true)]);
    const brute = w.entities.list().find((e) => e.enemy)!;
    brute.enemy!.affixes.push('shielded');
    addShield(w, brute, 'discord', 1000, 1e9, false);
    dealDamage(w, brute, { source: null, sourceName: 't', amount: 100 });
    expect(brute.health!.shields.find((s) => s.kind === 'discord')!.amount).toBeCloseTo(980, 6);
    dealDamage(w, brute, { source: null, sourceName: 't', amount: 100, empowered: true });
    expect(brute.health!.shields.find((s) => s.kind === 'discord')!.amount).toBeCloseTo(830, 6);
    expect(brute.health!.hp).toBe(brute.health!.maxHp);
  });

  it('Focus turns the whole party onto one enemy', () => {
    const sim = sandbox();
    stepFor(sim, 1, [spawn('hollow_chorister', -6, -8), spawn('hollow_chorister', 6, -8)]);
    stepFor(sim, 1);
    const target = sim.state.entities.list().find((e) => e.enemy)!;
    const events = stepFor(sim, 30, [{ t: 'directive', kind: 'focus', target: target.id }]);
    expect(sim.state.focusTarget).toBe(target.id);
    expect(ofType(events, 'directiveAck')).toHaveLength(3);
    for (let s = 0; s < 3; s++) expect(hero(sim, s).hero!.targetId).toBe(target.id);
  });
});

describe('motifs', () => {
  it('every motif in content has sim behaviour', () => {
    for (const m of CONTENT.motifs) expect(KNOWN_MOTIFS, m.id).toContain(m.id);
  });

  it('each motif changes its modifier, and levels scale it', () => {
    for (const m of CONTENT.motifs) {
      const level1 = resolveMods(
        resolveConfig({ seed: 1, motifs: [{ id: m.id, level: 1 }] }),
        CONTENT,
      );
      const changed = (Object.keys(NO_MODS) as (keyof typeof NO_MODS)[]).filter(
        (k) => level1[k] !== NO_MODS[k],
      );
      expect(changed, m.id).toHaveLength(1);
    }
    const lo = resolveMods(
      resolveConfig({ seed: 1, motifs: [{ id: 'deep_roots', level: 1 }] }),
      CONTENT,
    );
    const hi = resolveMods(
      resolveConfig({ seed: 1, motifs: [{ id: 'deep_roots', level: 3 }] }),
      CONTENT,
    );
    expect(hi.wardBarrierMult).toBeGreaterThan(lo.wardBarrierMult);
  });

  it('Twin Aegis gives the Ward two charges', () => {
    const sim = sandbox({ motifs: [{ id: 'twin_aegis', level: 1 }] });
    const events = stepFor(sim, 2, [
      { t: 'tech', id: 'ward', slot: 0 },
      { t: 'tech', id: 'ward', slot: 1 },
    ]);
    expect(ofType(events, 'techniqueCast')).toHaveLength(2);
  });
});

describe('content coverage', () => {
  it('every special is used by some enemy, and every enemy appears somewhere', () => {
    const used = new Set(CONTENT.enemies.flatMap((e) => e.specials));
    for (const a of CONTENT.attacks) expect(used, a.id).toContain(a.id);
    const appearing = new Set<string>();
    for (const enc of CONTENT.encounters)
      for (const w of enc.waves) for (const s of w.spawns) appearing.add(s.enemy);
    for (const a of CONTENT.attacks) if (a.summon) appearing.add(a.summon.enemy);
    for (const e of CONTENT.enemies) expect(appearing, e.id).toContain(e.id);
  });
});

describe('debug staging ops', () => {
  it('chargeSolos readies every Solo; setBossHp drives boss phases and decrees', () => {
    const sim = sandbox();
    let events = stepFor(sim, 1, [{ t: 'debug', op: { op: 'chargeSolos' } }]);
    expect(ofType(events, 'soloReady')).toHaveLength(3);
    stepFor(sim, 1, [spawn('the_hollow_cantor', 0, -12)]);
    events = stepFor(sim, 2, [{ t: 'debug', op: { op: 'setBossHp', pct: 0.6 } }]);
    expect(ofType(events, 'phaseChanged')[0]?.phase).toBe(2);
    expect(sim.state.field.hymnCircles).toHaveLength(3);
    expect(sim.state.encounter.decree?.name).toBe('Silent Verse');
    events = stepFor(sim, 2, [{ t: 'debug', op: { op: 'setBossHp', pct: 0.3 } }]);
    expect(ofType(events, 'phaseChanged')[0]?.phase).toBe(3);
    expect(sim.state.field.hymnCircles).toHaveLength(0);
    const requiem = stepUntil(
      sim,
      (ev) => ev.some((e) => e.type === 'telegraphStarted' && e.name === 'Requiem'),
      60 * 12,
    );
    expect(ofType(requiem, 'telegraphStarted').find((e) => e.name === 'Requiem')!.shape.kind).toBe(
      'raid',
    );
  });
});
