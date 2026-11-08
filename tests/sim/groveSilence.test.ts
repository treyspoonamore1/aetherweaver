/**
 * The grove sleeps (docs/phase-5e.md, "Oro downed" and "Grand Silence"; W2): while Oro is down
 * his Saplings are dormant (held, untargetable, doing nothing) and the Ancient leaves; they wake
 * 2 s after he rises. While the Grand Silence holds they are dormant too and the Ancient withers;
 * the grove wakes at Reignite.
 */
import { describe, expect, it } from 'vitest';
import { addStatus, dealDamage, reviveHero } from '../../src/sim/combat/health';
import type { Entity } from '../../src/sim/state';
import { spawnEnemy } from '../../src/sim/systems/enemies';
import { raiseAncient, WAKE } from '../../src/sim/systems/summons';
import type { World } from '../../src/sim/world';
import { ofType, sandbox, stepFor, worldOf } from './helpers';

function stage() {
  const sim = sandbox({ party: ['kael', 'vexis', 'oro'] });
  const w = worldOf(sim);
  for (const slot of [0, 1]) {
    const h = w.entities.get(w.party[slot]!)!;
    addStatus(w, h, 'stun', 1e6, null);
    h.health!.hp = h.health!.maxHp = 1e7;
  }
  const oro = w.entities.get(w.party[2]!)!;
  oro.hero!.abilityCooldowns = [99, 99];
  const saplings = oro.hero!.grove!.saplings.map((id) => w.entities.get(id)!);
  // A foe beside the first Sapling, held on it.
  const s = saplings[0]!;
  const foe = spawnEnemy(w, 'hollow_chorister', s.x + 1.2, s.z, { instant: true });
  w.entities.flush();
  foe.enemy!.engaged = true;
  foe.health!.hp = foe.health!.maxHp = 1e7;
  addStatus(w, foe, 'stun', 1e6, null);
  sim.drainEvents();
  return { sim, w, oro, saplings, foe };
}

const swings = (events: ReturnType<typeof stepFor>, s: Entity) =>
  ofType(events, 'attackFired').filter((e) => e.source === s.id).length;

function down(w: World, oro: Entity): void {
  dealDamage(w, oro, { source: null, sourceName: 'test', amount: 1e5 });
  expect(oro.health!.downed).toBe(true);
  // He doesn't bleed out while the test waits.
  oro.health!.bleedOut = 1e6;
}

describe('the grove sleeps (docs/phase-5e.md)', () => {
  it('Oro down: dormant, untargetable, idle; the Ancient leaves; awake 2 s after he rises', () => {
    const { sim, w, oro, saplings } = stage();
    const [s] = saplings;
    expect(swings(stepFor(sim, 120), s!)).toBeGreaterThan(0);
    const a = raiseAncient(w, oro, oro.hero!.grove!)!;
    stepFor(sim, 90);
    down(w, oro);
    const asleep = stepFor(sim, 120);
    for (const e of saplings) {
      expect(e.summon!.dormant).toBe(true);
      expect(e.summon!.targetId).toBeNull();
    }
    expect(swings(asleep, s!)).toBe(0);
    expect(a.health!.dead).toBe(true);
    expect(oro.hero!.grove!.ancient).toBeNull();
    expect(dealDamage(w, s!, { source: null, sourceName: 'test', amount: 50 }).dealt).toBe(0);
    // He rises: the grove waits 2 s more, then wakes.
    reviveHero(w, oro, 0.5);
    const waking = stepFor(sim, Math.round(WAKE * 60) - 10);
    expect(swings(waking, s!)).toBe(0);
    for (const e of saplings) expect(e.summon!.dormant).toBeUndefined();
    const awake = stepFor(sim, 120);
    expect(swings(awake, s!)).toBeGreaterThan(0);
    for (const e of saplings) expect(e.summon!.burrowUntil).toBeUndefined();
  });

  it('a felled Sapling doesn’t re-sprout while he is down, and does once he is up', () => {
    const { sim, w, oro, saplings } = stage();
    dealDamage(w, saplings[1]!, { source: null, sourceName: 'test', amount: 5000 });
    down(w, oro);
    const events = stepFor(sim, 60 * 13);
    expect(ofType(events, 'summonSpawned')).toHaveLength(0);
    reviveHero(w, oro, 0.5);
    const later = stepFor(sim, 5);
    expect(ofType(later, 'summonSpawned')).toHaveLength(1);
  });

  it('the Grand Silence: dormant, the Ancient withers; Reignite wakes the grove at once', () => {
    const { sim, w, oro, saplings } = stage();
    const [s] = saplings;
    const a = raiseAncient(w, oro, oro.hero!.grove!)!;
    stepFor(sim, 90);
    w.field.finale = {
      silence: { notes: 0, of: 8, since: w.time, until: w.time + 30, sources: [] },
    };
    const silent = stepFor(sim, 120);
    expect(swings(silent, s!)).toBe(0);
    for (const e of saplings) expect(e.summon!.dormant).toBe(true);
    expect(a.health!.dead).toBe(true);
    expect(ofType(silent, 'summonFell').some((e) => e.summon === a.id)).toBe(true);
    expect(w.field.ancient).toBeUndefined();
    // Reignite.
    delete w.field.finale.silence;
    const after = stepFor(sim, 90);
    for (const e of saplings) expect(e.summon!.dormant).toBeUndefined();
    expect(swings(after, s!)).toBeGreaterThan(0);
  });
});
