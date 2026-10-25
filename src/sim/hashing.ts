import { SIM_VERSION } from './constants';
import { StateHasher, hashValue } from './core/hash';
import type { EntityKind, FollowMode, ThreadMode } from './state';
import type { World } from './world';

/**
 * Deterministic hash of everything that affects future simulation: the resolved config,
 * world state, sim-internal bookkeeping, every entity, the entity allocator and the RNG
 * streams. Exact float bits are hashed. Excluded: content (versioned separately), the
 * event queue (drained by consumers) and derived caches (spatial hash, scratch).
 */
export function hashWorld(world: World): string {
  const h = new StateHasher();
  h.u32(SIM_VERSION);
  hashValue(h, world.config);
  hashValue(h, {
    tick: world.tick,
    time: world.time,
    timeScale: world.timeScale,
    arenaId: world.arenaId,
    arenaRadius: world.arenaRadius,
    obstacles: world.obstacles,
    weaverId: world.weaverId,
    party: world.party,
    directive: world.directive,
    focusTarget: world.focusTarget,
    telegraphs: world.telegraphs,
    chimes: world.chimes,
    field: world.field,
    encounter: world.encounter,
    ledger: world.ledger,
    relics: world.relics,
    internal: world.internal,
  });
  world.rng.forEach((name, rng) => {
    h.str(name);
    for (const word of rng.getState()) h.u32(word);
  });
  world.entities.hashInto(h);
  const list = world.entities.list();
  h.u32(list.length);
  for (const e of list) hashValue(h, e);
  return h.digest();
}

/** Plain JSON snapshot for tests, tools and the e2e hook. */
export interface SimSnapshot {
  tick: number;
  time: number;
  weaverId: number;
  party: number[];
  directive: string | null;
  encounter: { id: string; status: string; wave: number; waves: number };
  entities: Array<{
    id: number;
    kind: EntityKind;
    x: number;
    z: number;
    vx: number;
    vz: number;
    hp?: number;
    maxHp?: number;
    defId?: string;
    follow?: FollowMode;
    threadSlot?: number | null;
    threadMode?: ThreadMode;
  }>;
}

export function snapshotWorld(world: World): SimSnapshot {
  return {
    tick: world.tick,
    time: world.time,
    weaverId: world.weaverId,
    party: [...world.party],
    directive: world.directive,
    encounter: {
      id: world.encounter.id,
      status: world.encounter.status,
      wave: world.encounter.wave,
      waves: world.encounter.waves,
    },
    entities: world.entities.list().map((e) => ({
      id: e.id,
      kind: e.kind,
      x: e.x,
      z: e.z,
      vx: e.vx,
      vz: e.vz,
      ...(e.health ? { hp: e.health.hp, maxHp: e.health.maxHp } : {}),
      ...(e.hero ? { defId: e.hero.defId, follow: e.hero.follow } : {}),
      ...(e.enemy ? { defId: e.enemy.defId } : {}),
      ...(e.weaver ? { threadSlot: e.weaver.threadSlot, threadMode: e.weaver.threadMode } : {}),
    })),
  };
}
