import { len, rotateToward } from '../core/dmath';
import { decayResonance } from '../combat/resonance';
import type { TechniqueKey } from '../state';
import { weaverOf, type World } from '../world';
import { approachVelocity } from './steering';

const TECHNIQUES: readonly TechniqueKey[] = ['ward', 'chime', 'reel', 'glide'];
const heading = { x: 0, z: 0 };

/** Movement, Glide, Spirit, cooldowns, Resonance decay, the Crescendo clock and re-forming. */
export function updateWeaver(world: World, dt: number): void {
  const e = weaverOf(world);
  const w = e.weaver!;
  const h = e.health!;
  const def = world.content.weaver;

  if (h.downed) {
    e.vx = 0;
    e.vz = 0;
    w.reform -= dt;
    if (w.reform <= 0) {
      w.reform = 0;
      h.downed = false;
      h.hp = Math.round(h.maxHp * 0.5);
      h.invulnerable = Math.max(h.invulnerable, 1.5);
      world.events.push({ type: 'weaverReformed', tick: world.tick });
    }
  } else if (w.glide > 0) {
    const tech = world.content.techniques.glide;
    const speed = tech.distance / Math.max(0.01, tech.duration);
    e.vx = w.glideX * speed;
    e.vz = w.glideZ * speed;
    w.glide = Math.max(0, w.glide - dt);
    if (w.glide === 0) {
      e.vx = w.glideX * e.speed;
      e.vz = w.glideZ * e.speed;
    }
  } else {
    const moving = w.moveX !== 0 || w.moveZ !== 0;
    approachVelocity(e, w.moveX * e.speed, w.moveZ * e.speed, moving ? def.accel : def.decel, dt);
    if (moving) {
      const m = len(w.moveX, w.moveZ);
      rotateToward(
        w.headingX,
        w.headingZ,
        w.moveX / m,
        w.moveZ / m,
        def.headingTurnRate * dt,
        heading,
      );
      w.headingX = heading.x;
      w.headingZ = heading.z;
    }
  }

  // Spirit: only the unreserved part of the pool regenerates.
  const free = w.maxSpirit - w.reservedSpirit;
  if (!h.downed && w.spirit < free) {
    w.spirit = Math.min(
      free,
      w.spirit + free * def.spiritRegenPct * world.mods.spiritRegenMult * dt,
    );
  }

  // Cooldowns. Ward recharges one charge at a time.
  for (const key of TECHNIQUES) {
    if (w.cooldowns[key] <= 0) continue;
    w.cooldowns[key] = Math.max(0, w.cooldowns[key] - dt);
    if (key === 'ward' && w.cooldowns.ward === 0 && w.wardCharges < w.maxWardCharges) {
      w.wardCharges++;
      if (w.wardCharges < w.maxWardCharges) {
        w.cooldowns.ward = world.content.techniques.ward.cooldown;
        w.cooldownTotals.ward = w.cooldowns.ward;
      }
    }
  }
  if (w.threadLock > 0) w.threadLock = Math.max(0, w.threadLock - dt);

  if (w.crescendo > 0) {
    w.crescendo = Math.max(0, w.crescendo - dt);
    if (w.crescendo === 0) {
      world.field.crescendo = false;
      world.events.push({ type: 'crescendoEnd', tick: world.tick });
      if (world.mods.daCapo > 0)
        w.resonance = Math.min(world.content.resonance.max, world.mods.daCapo);
    }
  }
  decayResonance(world, dt);
}
