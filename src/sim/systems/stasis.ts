/**
 * The Chronomancer's Stasis (docs/phase-3e.md): while it lasts every enemy, and everything an
 * enemy set in motion, waits. The enemies' own systems don't run (api.ts), and every clock on
 * their side moves forward with time so nothing on it gets any closer: telegraphs, casts,
 * projectiles and summons in flight, waves, boss scripts and the enrage timer.
 */
import type { EntityId } from '../state';
import type { World } from '../world';

/** Is `id` the Weaver or one of her heroes (whose clocks keep running)? */
export function ofParty(world: World, id: EntityId | null): boolean {
  return id !== null && (id === world.weaverId || world.party.includes(id));
}

/** One tick of Stasis: every enemy-side clock waits `dt`. */
export function holdEnemyTime(world: World, dt: number): void {
  for (const t of world.telegraphs) {
    t.start += dt;
    t.impact += dt;
    t.perfectFrom += dt;
  }
  for (const e of world.entities.list()) {
    const c = e.enemy;
    if (c) {
      e.vx = 0;
      e.vz = 0;
      if (c.cast) {
        c.cast.start += dt;
        c.cast.end += dt;
      }
      c.tauntUntil += dt;
      c.sleepImmuneUntil += dt;
      if (c.foreseen) c.foreseen.at += dt;
      if (e.health) for (const s of e.health.shields) s.expiresAt += dt;
    } else if (e.health) {
      // Perfect timing is in the enemies' time: a Ward's moment waits with them, so a Ward cast
      // during Stasis counts as cast at the moment time stopped.
      for (const s of e.health.shields) if (s.kind === 'ward') s.appliedAt += dt;
      // A hero stepping out of an attack keeps going until it lands, however long that takes.
      if (e.hero?.dodge) e.hero.dodge.until += dt;
    }
  }
  const internal = world.internal;
  for (const hit of internal.pendingHits) if (!ofParty(world, hit.source)) hit.at += dt;
  for (const spawn of internal.pendingSpawns) spawn.at += dt;
  if (internal.director.nextWaveAt !== null) internal.director.nextWaveAt += dt;
  const boss = internal.boss;
  boss.nextRequiemAt += dt;
  boss.nextCircleShiftAt += dt;
  boss.phaseShiftUntil += dt;
  if (boss.doubleTollAt > 0) boss.doubleTollAt += dt;
  if (world.encounter.enrageAt !== null) world.encounter.enrageAt += dt;
}
