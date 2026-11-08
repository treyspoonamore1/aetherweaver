/**
 * The enemy root (docs/phase-5e.md, "Enemy root"; W2): Oro's Bramble and the Ancient root normal
 * and elite, non-heavy enemies for 1.5 s, followed by 4 s of root immunity. A rooted enemy
 * neither approaches, chases, charges nor leaps; its attacks and casts go on. Bosses, minibosses,
 * heavy foes, heroes and summons are never rooted.
 */
import { describe, expect, it } from 'vitest';
import { addStatus, hasStatus } from '../../src/sim/combat/health';
import type { Entity } from '../../src/sim/state';
import { spawnEnemy } from '../../src/sim/systems/enemies';
import { enemyRooted } from '../../src/sim/systems/grove';
import { ROOT_IMMUNE, rootEnemy } from '../../src/sim/systems/summons';
import type { World } from '../../src/sim/world';
import { ofType, sandbox, stepFor, worldOf } from './helpers';

function stage() {
  const sim = sandbox({ party: ['kael', 'vexis', 'oro'] });
  const w = worldOf(sim);
  for (const id of w.party) {
    const h = w.entities.get(id)!;
    addStatus(w, h, 'stun', 1e6, null);
    h.health!.hp = h.health!.maxHp = 1e7;
  }
  return { sim, w };
}

function enemy(w: World, defId: string, x: number, z: number, elite = false): Entity {
  const e = spawnEnemy(w, defId, x, z, { instant: true, ...(elite ? { elite: true } : {}) });
  w.entities.flush();
  e.enemy!.engaged = true;
  e.health!.hp = e.health!.maxHp = 1e7;
  return e;
}

describe('the root (docs/phase-5e.md)', () => {
  it('holds normal and elite, non-heavy foes only; never bosses, minibosses, heroes or summons', () => {
    const { sim, w } = stage();
    const normal = enemy(w, 'hollow_chorister', 0, -10);
    const elite = enemy(w, 'hollow_chorister', 3, -10, true);
    const champion = enemy(w, 'mirror_champion', -6, -10);
    const boss = enemy(w, 'the_bellwarden', 0, -18);
    const miniboss = enemy(w, 'gorehound_matriarch', 8, -16);
    expect(rootEnemy(w, normal, 1.5, null)).toBe(true);
    expect(rootEnemy(w, elite, 1.5, null)).toBe(true);
    expect(rootEnemy(w, champion, 1.5, null)).toBe(false);
    expect(rootEnemy(w, boss, 1.5, null)).toBe(false);
    expect(rootEnemy(w, miniboss, 1.5, null)).toBe(false);
    expect(enemyRooted(normal)).toBe(true);
    expect(enemyRooted(champion)).toBe(false);
    const events = sim.drainEvents();
    expect(ofType(events, 'rooted').map((e) => e.target)).toEqual([normal.id, elite.id]);
    expect(champion.enemy!.rootImmuneUntil).toBeUndefined();
    const kael = w.entities.get(w.party[0]!)!;
    expect(addStatus(w, kael, 'rooted', 1.5, null)).toBe(false);
    const oro = w.entities.get(w.party[2]!)!;
    const sapling = w.entities.get(oro.hero!.grove!.saplings[0]!)!;
    expect(addStatus(w, sapling, 'rooted', 1.5, null)).toBe(false);
  });

  it('lasts 1.5 s, then 4 s of root immunity', () => {
    const { sim, w } = stage();
    const foe = enemy(w, 'hollow_chorister', 0, -10);
    expect(rootEnemy(w, foe, 1.5, null)).toBe(true);
    expect(foe.enemy!.rootImmuneUntil).toBeCloseTo(w.time + 1.5 + ROOT_IMMUNE, 9);
    stepFor(sim, 95);
    expect(hasStatus(foe, 'rooted')).toBe(false);
    expect(enemyRooted(foe)).toBe(false);
    expect(rootEnemy(w, foe, 1.5, null)).toBe(false);
    stepFor(sim, 60 * 4);
    expect(rootEnemy(w, foe, 1.5, null)).toBe(true);
  });

  it('a rooted foe neither approaches nor chases, but it still strikes what is in reach', () => {
    const { sim, w } = stage();
    const kael = w.entities.get(w.party[0]!)!;
    const far = enemy(w, 'hollow_chorister', kael.x, kael.z - 9);
    const near = enemy(w, 'hollow_chorister', kael.x + 1.2, kael.z);
    for (const e of [far, near]) {
      e.enemy!.tauntTarget = kael.id;
      e.enemy!.tauntUntil = 1e9;
      // A long root, for the test (Bramble's is 1.5 s).
      expect(rootEnemy(w, e, 30, null)).toBe(true);
    }
    const at = [far.x, far.z];
    const events = stepFor(sim, 60 * 5);
    expect(Math.hypot(far.x - at[0]!, far.z - at[1]!)).toBeLessThan(0.05);
    expect(ofType(events, 'attackFired').some((e) => e.source === near.id)).toBe(true);
  });

  it('a rooted Impaler casts its charge but doesn’t move with it', () => {
    const run = (rooted: boolean) => {
      const { sim, w } = stage();
      const vexis = w.entities.get(w.party[1]!)!;
      const imp = enemy(w, 'impaler', vexis.x, vexis.z - 12);
      imp.enemy!.tauntTarget = vexis.id;
      imp.enemy!.tauntUntil = 1e9;
      if (rooted) expect(rootEnemy(w, imp, 60, null)).toBe(true);
      const from = [imp.x, imp.z];
      const events = stepFor(sim, 60 * 9);
      const charged = ofType(events, 'telegraphStarted').some((t) => t.owner === imp.id);
      return { charged, moved: Math.hypot(imp.x - from[0]!, imp.z - from[1]!) };
    };
    const free = run(false);
    const held = run(true);
    expect(held.charged).toBe(true);
    expect(free.moved).toBeGreaterThan(3);
    expect(held.moved).toBeLessThan(0.05);
  });
});
