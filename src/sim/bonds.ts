/**
 * Bonds in the fight (docs/phase-4e.md): which hero plays which talent and Solo, and their
 * numbers. The talents' effects live where they act (Glory Hound, the Perfect Ward, healing,
 * hits, Solos); this is what they share.
 */
import type { Content } from '../content/schema';
import type { Entity, EntityId } from './state';
import type { World } from './world';

/** Every talent and alternate Solo the sim acts on (content lint checks each has its hook). */
export const KNOWN_TALENTS: readonly string[] = [
  'steady_vanguard',
  'vanguards_roar',
  'riposte_bash',
  'bulwark_of_faith',
  'unbreakable',
  'shieldbearer',
  'wind_step',
  'hawk_eye',
  'ricochet',
  'hunters_mark',
  'storm_queen',
  'last_light',
  'arcane_ward',
  'overchannel',
  'starthread',
  'event_horizon',
  'supernova',
  'constellation',
];
export const KNOWN_ALT_SOLOS: readonly string[] = ['oathkeeper', 'hawks_vigil', 'celestial_sphere'];

/** The hero a talent belongs to. */
export function talentHero(content: Content, id: string): string | undefined {
  return content.talents.find((t) => t.id === id)?.hero;
}

/** The hero plays with this talent. */
export function hasTalent(e: Entity | undefined, id: string): boolean {
  return e?.hero?.talents.includes(id) ?? false;
}

/** A talent's number, in the units its text shows (20 = 20%). */
export function talentValue(world: World, id: string, key: string): number {
  return world.content.talents.find((t) => t.id === id)?.values[key] ?? 0;
}

/** The party's hero with this talent, standing or not. */
export function talentHolder(world: World, id: string): Entity | undefined {
  if (!world.config.bonds.talents.includes(id)) return undefined;
  for (const pid of world.party) {
    const e = world.entities.get(pid);
    if (e?.hero?.talents.includes(id)) return e;
  }
  return undefined;
}

/** An alternate Solo's number. */
export function soloValue(world: World, id: string, key: string): number {
  return world.content.altSolos.find((s) => s.id === id)?.values[key] ?? 0;
}

/** Ricochet: Lyra's arrows bounce once inside your field, at a share (a hit's `bounce`). */
export function ricochet(world: World, hero: Entity): { bounce?: number } {
  return hasTalent(hero, 'ricochet') ? { bounce: talentValue(world, 'ricochet', 'pct') / 100 } : {};
}

/** A talent visibly acted: for the views and the sounds. */
export function talentFired(
  world: World,
  hero: Entity,
  talent: string,
  x: number,
  z: number,
  target: EntityId | null = null,
): void {
  world.events.push({ type: 'talentFired', tick: world.tick, hero: hero.id, talent, x, z, target });
}
