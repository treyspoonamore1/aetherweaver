import type { AttackDef } from '../../content';
import { isActive, slotHero } from '../combat/health';
import { startTelegraph } from '../combat/telegraphs';
import type { PartySlot } from '../commands';
import { TUNING } from '../constants';
import type { Rng } from '../core/rng';
import type { World } from '../world';
import { arrive } from './steering';

/** Uniform point in a disc via rejection sampling (no trig, deterministic). */
export function randomPointInDisc(rng: Rng, radius: number, out: { x: number; z: number }): void {
  for (;;) {
    const x = rng.range(-1, 1);
    const z = rng.range(-1, 1);
    if (x * x + z * z <= 1) {
      out.x = x * radius;
      out.z = z * radius;
      return;
    }
  }
}

export function spawnDummies(world: World, count: number): void {
  const n = Math.max(0, Math.min(1000, Math.floor(count)));
  const p = world.scratch.slot;
  const rng = world.rng.ai;
  for (let i = 0; i < n; i++) {
    randomPointInDisc(rng, world.arenaRadius * 0.9, p);
    const x = p.x;
    const z = p.z;
    randomPointInDisc(rng, world.arenaRadius * 0.85, p);
    const e = world.entities.spawn('dummy', {
      x,
      z,
      radius: TUNING.dummyRadius,
      height: 1.6,
      speed: rng.range(TUNING.dummySpeedMin, TUNING.dummySpeedMax),
      wander: { targetX: p.x, targetZ: p.z },
    });
    world.events.push({ type: 'entitySpawned', tick: world.tick, id: e.id, kind: 'dummy' });
  }
}

export function clearDummies(world: World): void {
  for (const e of world.entities.list()) {
    if (e.kind !== 'dummy') continue;
    world.entities.despawn(e.id);
    world.events.push({ type: 'entityDespawned', tick: world.tick, id: e.id, kind: 'dummy' });
  }
}

export function updateDummies(world: World, dt: number): void {
  const rng = world.rng.ai;
  const p = world.scratch.slot;
  for (const e of world.entities.list()) {
    const wander = e.wander;
    if (!wander) continue;
    const dx = wander.targetX - e.x;
    const dz = wander.targetZ - e.z;
    if (dx * dx + dz * dz < 0.36) {
      randomPointInDisc(rng, world.arenaRadius * 0.85, p);
      wander.targetX = p.x;
      wander.targetZ = p.z;
    }
    arrive(e, wander.targetX, wander.targetZ, TUNING.dummyAccel, 1, dt);
  }
}

/** The training bell's blow: a Ward answers it, and a hero can't step out of it. */
const DRILL = {
  id: 'drill',
  name: 'Training Toll',
  kind: 'mark',
  effect: 'damage',
  answers: ['ward'],
} as unknown as AttackDef;

/**
 * The Perfect-Ward trainer (docs/phase-4g.md): a training bell (a still dummy, spawned beside the
 * hero if none stands) telegraphs one blow at a hero. Unanswered, it takes a quarter of their
 * life; the trainer heals the party between blows.
 */
export function drill(world: World, slot: PartySlot, windup: number): void {
  const hero = slotHero(world, slot);
  if (!isActive(hero)) return;
  let bell = world.entities.list().find((e) => e.kind === 'dummy');
  if (!bell) {
    bell = world.entities.spawn('dummy', {
      x: hero.x + 4,
      z: hero.z - 4,
      radius: TUNING.dummyRadius,
      height: 1.6,
      speed: 0,
      wander: { targetX: hero.x + 4, targetZ: hero.z - 4 },
    });
    world.events.push({ type: 'entitySpawned', tick: world.tick, id: bell.id, kind: 'dummy' });
  }
  const t = startTelegraph(world, {
    owner: bell,
    attack: DRILL,
    target: hero,
    shape: { kind: 'mark', target: hero.id },
    windup: Math.max(0.5, Math.min(3, windup)),
    damage: 0,
    pctMaxHp: 0.25,
  });
  t.drill = true;
}
