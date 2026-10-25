import type { Entity, EntityId, EntityKind, EntityStoreView } from '../state';
import type { StateHasher } from './hash';

const INDEX_BITS = 16;
const INDEX_MASK = (1 << INDEX_BITS) - 1;
const MAX_SLOTS = 1 << INDEX_BITS;

export type EntityInit = Partial<Omit<Entity, 'id' | 'kind'>>;

/**
 * Pooled entity store. Slots are reused LIFO (deterministic); each reuse bumps the slot's
 * generation, so an old EntityId never resolves to a new entity.
 *
 * Structural changes are deferred so iteration is always safe:
 * - `spawn()` allocates the id immediately (get() finds it) but the entity joins `list()` at
 *   the next `flush()`.
 * - `despawn()` keeps the entity fully present until the next `flush()`.
 * The sim flushes at fixed points in the tick (after commands, at the end of the tick).
 */
export class EntityStore implements EntityStoreView {
  private slots: (Entity | null)[] = [];
  private generations: number[] = [];
  private free: number[] = [];
  private alive: Entity[] = [];
  private pendingRemoval: EntityId[] = [];
  private pendingSet = new Set<EntityId>();
  private dirty = false;

  get count(): number {
    return this.alive.length;
  }

  spawn(kind: EntityKind, init: EntityInit = {}): Entity {
    let index = this.free.pop();
    if (index === undefined) {
      index = this.slots.length;
      if (index >= MAX_SLOTS) throw new Error('EntityStore: out of slots');
      this.slots.push(null);
      this.generations.push(0);
    }
    const id = index + (this.generations[index] as number) * MAX_SLOTS;
    const x = init.x ?? 0;
    const z = init.z ?? 0;
    const entity: Entity = {
      x,
      z,
      px: x,
      pz: z,
      vx: 0,
      vz: 0,
      fx: 0,
      fz: -1,
      radius: 0.5,
      height: 1,
      team: 'neutral',
      speed: 0,
      mass: 1,
      ...init,
      id,
      kind,
    };
    this.slots[index] = entity;
    this.dirty = true;
    return entity;
  }

  /** Schedules removal at the next flush(). Returns the entity, or undefined if already gone. */
  despawn(id: EntityId): Entity | undefined {
    const entity = this.get(id);
    if (!entity || this.pendingSet.has(id)) return undefined;
    this.pendingRemoval.push(id);
    this.pendingSet.add(id);
    return entity;
  }

  isPendingRemoval(id: EntityId): boolean {
    return this.pendingSet.has(id);
  }

  get(id: EntityId): Entity | undefined {
    const entity = this.slots[id & INDEX_MASK];
    return entity && entity.id === id ? entity : undefined;
  }

  /** Applies pending spawns and removals. Never call while iterating list(). */
  flush(): void {
    if (this.pendingRemoval.length > 0) {
      for (const id of this.pendingRemoval) {
        const index = id & INDEX_MASK;
        if (this.slots[index]?.id !== id) continue;
        this.slots[index] = null;
        this.generations[index] = (this.generations[index] as number) + 1;
        this.free.push(index);
      }
      this.pendingRemoval.length = 0;
      this.pendingSet.clear();
      this.dirty = true;
    }
    if (this.dirty) {
      this.alive = [];
      for (const entity of this.slots) if (entity) this.alive.push(entity);
      this.dirty = false;
    }
  }

  /**
   * Alive entities in slot order. Stable between flushes: a new array is built on flush,
   * so an array you are iterating is never mutated underneath you.
   */
  list(): readonly Entity[] {
    return this.alive;
  }

  /** Allocator state shapes future ids and iteration order, so it is part of the hash. */
  hashInto(h: StateHasher): void {
    h.u32(this.slots.length);
    h.u32(this.free.length);
    for (const index of this.free) h.u32(index);
    for (const gen of this.generations) h.u32(gen);
  }
}
