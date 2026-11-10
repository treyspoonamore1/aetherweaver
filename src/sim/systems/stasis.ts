/**
 * The Chronomancer's Stasis (docs/phase-3e.md): while it lasts every enemy, and everything an
 * enemy set in motion, waits. The enemies' own systems don't run (api.ts), and every clock on
 * their side moves forward with time so nothing on it gets any closer: telegraphs, casts,
 * projectiles and summons in flight, waves, boss scripts and the enrage timer.
 */
import type { EntityId } from '../state';
import type { World } from '../world';
import { encounterScript } from './bossScripts';
import { endZones } from './zones';

/** Is `id` the Weaver or one of her heroes (whose clocks keep running)? */
export function ofParty(world: World, id: EntityId | null): boolean {
  // Oro's summons (docs/phase-5e.md) are the party's side: their clocks keep running too.
  if (id !== null && world.internal.summons?.includes(id)) return true;
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
      // A broken guard stays broken as long as it would have (Movement II's guarded enemies).
      if (c.guard && c.guard.brokenUntil > world.time) c.guard.brokenUntil += dt;
      if (c.foreseen) c.foreseen.at += dt;
      // Tyrant's borrowed attack (docs/phase-6.md) waits as the boss's own cooldowns do, the first
      // cast's delay too: its clock is a sim time, so it moves on with time (only a Tyrant run's
      // boss has the key).
      if (world.mods.tyrant && c.tyrant) c.tyrant.readyAt += dt;
      // Movement III (docs/phase-5c.md): an Emboldened enemy stays so as long as it would have.
      if (c.emboldenedUntil !== undefined && c.emboldenedUntil > world.time)
        c.emboldenedUntil += dt;
      // Oro (docs/phase-5e.md): a root waits with its statuses, so the immunity behind it waits
      // too (only his root writes the key).
      if (c.rootImmuneUntil !== undefined && c.rootImmuneUntil > world.time)
        c.rootImmuneUntil += dt;
      if (e.health) for (const s of e.health.shields) s.expiresAt += dt;
    } else if (e.health) {
      // Perfect timing is in the enemies' time: a Ward's moment waits with them, so a Ward cast
      // during Stasis counts as cast at the moment time stopped.
      for (const s of e.health.shields) if (s.kind === 'ward') s.appliedAt += dt;
      // A hero stepping out of an attack keeps going until it lands, however long that takes.
      // Seren's Feint step that answers no blow is her own half-second (docs/phase-5e.md).
      if (e.hero?.dodge && !e.hero.dodge.free) e.hero.dodge.until += dt;
    }
  }
  const internal = world.internal;
  // An Aegis Link's moment too (docs/phase-4f.md).
  if (internal.link) internal.link.appliedAt += dt;
  for (const hit of internal.pendingHits) if (!ofParty(world, hit.source)) hit.at += dt;
  for (const spawn of internal.pendingSpawns) spawn.at += dt;
  if (internal.director.nextWaveAt !== null) internal.director.nextWaveAt += dt;
  const boss = internal.boss;
  boss.nextRequiemAt += dt;
  boss.nextCircleShiftAt += dt;
  boss.phaseShiftUntil += dt;
  if (boss.doubleTollAt > 0) boss.doubleTollAt += dt;
  // Movement II's boss scripts (docs/phase-5a.md): a follow-up, Vharun's cadences, the
  // Bloodmoon's reform (its pools' drift runs in updateBosses, so it waits too).
  const m2 = internal.m2;
  if (m2) {
    if (m2.followUp) m2.followUp.at += dt;
    m2.nextTideAt += dt;
    m2.nextExecutionAt += dt;
  }
  if (world.field.sanctuary) world.field.sanctuary.reformAt += dt;
  // Movement III (docs/phase-5c.md): the zones, Unravel's window and a stolen verse wait too
  // (under Stasis, Unravel's reversed Mend is suspended: its window doesn't run out meanwhile),
  // and so does every clock a new boss's script keeps.
  // A zone whose owner the heroes killed meanwhile ends now, as its owner's telegraphs did.
  const field = world.field;
  if (field.zones) endZones(world, false);
  if (field.zones) for (const z of field.zones) z.until += dt;
  if (field.unravel) field.unravel.until += dt;
  if (field.stolen) field.stolen.until += dt;
  // A Severing elite's cut cooldown runs in its own time, in any fight (elite fights have no
  // boss script): a cooldown still running waits, so it can't cut again sooner in frozen time.
  const severAt = internal.m3?.severAt;
  if (severAt)
    for (const id of Object.keys(severAt)) {
      const key = Number(id);
      const at = severAt[key]!;
      if (at > world.time) severAt[key] = at + dt;
    }
  encounterScript(world)?.stasis?.(world, dt);
  if (world.encounter.enrageAt !== null) world.encounter.enrageAt += dt;
}
