/**
 * Movement III's shared rules (docs/phase-5c.md, principle 4): pure reads of public state and
 * content that the sim, the bots, render and the UI all use, so they can never disagree. Each
 * returns its neutral answer (null, false, 0, the very same value) when its mechanic is absent,
 * so a Movement I or II fight reads nothing new.
 */
import { CONTENT } from '../content';
import { EMBOLDENED_MULT, MIMIC_ALLY_RANGE, POSSESS_REACH_MIN } from '../content/unstitched';
import type { PartySlot } from './commands';
import { distSq, segmentDistSq } from './core/dmath';
import type {
  DeepReadonly,
  EnemyComponent,
  EntityId,
  ReadonlyEntity,
  StatusId,
  Telegraph,
  WorldState,
} from './state';

const ATTACKS = new Map(CONTENT.attacks.map((a) => [a.id, a]));
const ENEMIES = new Map(CONTENT.enemies.map((e) => [e.id, e]));
const AFFIXES = new Map(CONTENT.affixes.map((f) => [f.id, f]));
const HEROES = new Map(CONTENT.heroes.map((h) => [h.id, h]));
const ENCOUNTERS = new Map(CONTENT.encounters.map((e) => [e.id, e]));

/** A segment on the ground: from (ax, az) to (bx, bz). */
export interface Segment {
  ax: number;
  az: number;
  bx: number;
  bz: number;
}

/** What a Mimic can copy. */
export type MimicCopy = 'empower' | 'ward' | 'chime';

function hasStatus(e: ReadonlyEntity, id: StatusId): boolean {
  const statuses = e.health?.statuses;
  if (!statuses) return false;
  for (const s of statuses) if (s.id === id) return true;
  return false;
}

/** Up and fighting: not downed, not dead. */
function standing(e: ReadonlyEntity | undefined): e is ReadonlyEntity {
  return e?.health !== undefined && !e.health.downed && !e.health.dead;
}

/** The Thread from the Weaver to the hero in `slot` (null: no such hero, or they're gone). */
function segmentTo(world: WorldState, slot: PartySlot): Segment | null {
  const weaver = world.entities.get(world.weaverId);
  const id = world.party[slot];
  const hero = id === undefined ? undefined : world.entities.get(id);
  if (!weaver || !hero?.health || hero.health.dead) return null;
  return { ax: weaver.x, az: weaver.z, bx: hero.x, bz: hero.z };
}

/** The one Thread (docs/phase-5c.md): the Weaver to the threaded hero, or null with none. */
export function threadSegment(world: WorldState): Segment | null {
  const slot = world.entities.get(world.weaverId)?.weaver?.threadSlot;
  return slot === null || slot === undefined ? null : segmentTo(world, slot);
}

/**
 * Would this cut telegraph cut the Thread, were it on `slot` (default: where it is now)? An
 * `always` cut (the Unpick) does whenever there is a Thread; a line does when its rectangle
 * reaches the segment. Anything that isn't a cut never does.
 */
export function cutWouldLand(
  world: WorldState,
  t: DeepReadonly<Telegraph>,
  slot: PartySlot | null = world.entities.get(world.weaverId)?.weaver?.threadSlot ?? null,
): boolean {
  const cut = ATTACKS.get(t.attackId)?.cut;
  if (!cut || slot === null) return false;
  const seg = segmentTo(world, slot);
  if (!seg) return false;
  if (cut.always) return true;
  const s = t.shape;
  if (s.kind !== 'line') return false;
  const half = s.width / 2;
  return segmentDistSq(s.x, s.z, s.toX, s.toZ, seg.ax, seg.az, seg.bx, seg.bz) <= half * half;
}

/** The Weaver stands in a Null rune: her Ward, Chime and Reel (or Rewind) are refused. */
export function weaverSilenced(world: WorldState): boolean {
  const zones = world.field.zones;
  if (!zones) return false;
  const weaver = world.entities.get(world.weaverId);
  if (!weaver) return false;
  for (const z of zones)
    if (z.kind === 'null' && distSq(weaver.x, weaver.z, z.x, z.z) <= z.r * z.r) return true;
  return false;
}

/**
 * Whom a possessed hero strikes: the nearest other standing hero within the larger of
 * `POSSESS_REACH_MIN` and the hero's own attack range, ties to the lower slot. Never the Weaver.
 */
export function possessionVictim(world: WorldState, h: ReadonlyEntity): EntityId | null {
  const def = h.hero ? HEROES.get(h.hero.defId) : undefined;
  const range = def?.attack.range ?? 0;
  const reach = range > POSSESS_REACH_MIN ? range : POSSESS_REACH_MIN;
  const reach2 = reach * reach;
  let best: EntityId | null = null;
  let bestD = 0;
  for (const id of world.party) {
    if (id === h.id) continue;
    const e = world.entities.get(id);
    if (!standing(e)) continue;
    const d = distSq(h.x, h.z, e.x, e.z);
    if (d > reach2) continue;
    if (best === null || d < bestD) {
      best = id;
      bestD = d;
    }
  }
  return best;
}

/**
 * An enemy's aura suppression radius (a Mute's dome): its def's when it has one, else a
 * Silencing affix's; 0 for none. (`EnemyDef.suppressRadius` is required, 0 meaning none.) The
 * world is in the signature for the callers' symmetry; content alone decides it.
 */
export function suppressRadiusOf(_world: WorldState, e: ReadonlyEntity): number {
  const c = e.enemy;
  if (!c) return 0;
  const own = ENEMIES.get(c.defId)?.suppressRadius ?? 0;
  if (own > 0) return own;
  for (const id of c.affixes) {
    const r = AFFIXES.get(id)?.suppressRadius;
    if (r !== undefined && r > 0) return r;
  }
  return 0;
}

/** Rooted: pinned (checked first, as before), or stitched. */
export function isRooted(e: ReadonlyEntity): boolean {
  return hasStatus(e, 'pinned') || hasStatus(e, 'stitched');
}

/**
 * What a Mimic would copy now: Empower if the Thread is in Empower, else the Weaver's last Ward
 * or Chime; null otherwise (her last was a Reel or a Rewind, both `'reel'`, or nothing yet).
 */
export function mimicCopyOf(world: WorldState): MimicCopy | null {
  const w = world.entities.get(world.weaverId)?.weaver;
  if (!w) return null;
  if (w.threadMode === 'empower') return 'empower';
  return w.lastTechnique === 'ward' || w.lastTechnique === 'chime' ? w.lastTechnique : null;
}

/**
 * Whom a Mimic's copy goes to (`allyEnemy`): the standing enemy other than the caster with the
 * most max HP within `MIMIC_ALLY_RANGE`, ties to the lower id; else the caster itself.
 */
export function mimicBeneficiary(world: WorldState, caster: ReadonlyEntity): EntityId {
  const reach2 = MIMIC_ALLY_RANGE * MIMIC_ALLY_RANGE;
  let best: EntityId | null = null;
  let bestHp = 0;
  for (const e of world.entities.list()) {
    if (!e.enemy || e.id === caster.id || !standing(e)) continue;
    if (distSq(caster.x, caster.z, e.x, e.z) > reach2) continue;
    const hp = e.health!.maxHp;
    if (best === null || hp > bestHp || (hp === bestHp && e.id < best)) {
      best = e.id;
      bestHp = hp;
    }
  }
  return best ?? caster.id;
}

/**
 * An enemy's damage multiplier: `c.damageMult` itself, untouched, unless it is Emboldened right
 * now (then × `EMBOLDENED_MULT`). Replaces the raw reads, so `(dmg × dm) × enrage` keeps its order.
 */
export function enemyDamageMult(world: WorldState, c: DeepReadonly<EnemyComponent>): number {
  const until = c.emboldenedUntil;
  if (until === undefined || until <= world.time) return c.damageMult;
  return c.damageMult * EMBOLDENED_MULT;
}

/**
 * An enemy's specials with its affixes' (Mimicking's mirror) appended, each once. With no affix
 * that has specials, it is `def.specials` itself: the same array, by reference.
 */
export function specialsOf<T extends { readonly specials: readonly string[] }>(
  def: T,
  affixes: readonly string[],
): T['specials'] {
  let out: string[] | null = null;
  for (const id of affixes) {
    const extra = AFFIXES.get(id)?.specials;
    if (!extra) continue;
    for (const a of extra) {
      if ((out ?? def.specials).includes(a)) continue;
      out ??= [...def.specials];
      out.push(a);
    }
  }
  return out ?? def.specials;
}

/** The Movement this fight's encounter belongs to, as content says (1 for unknown ids). */
export function fightMovement(world: Pick<WorldState, 'encounter'>): number {
  return ENCOUNTERS.get(world.encounter.id)?.movement ?? 1;
}

/**
 * Does a Movement-gated relic (`movement`) or motif (`requires.movement`) wake in a fight of
 * `movement`? Ungated ones always do. A sleeping one has no effect (docs/phase-5c.md, Q16).
 */
export function relicAwake(
  def: { readonly movement?: number; readonly requires?: { readonly movement?: number } },
  movement: number,
): boolean {
  return (def.movement ?? def.requires?.movement ?? 1) <= movement;
}
