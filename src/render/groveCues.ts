import type * as THREE from 'three';
import { CONTENT, heroDef } from '../content';
import {
  gentle,
  type EntityId,
  type ReadonlyEntity,
  type SimEvent,
  type SimEventOf,
  type WorldState,
} from '../sim';
import { enemyRooted } from '../sim/systems/grove';
import type { FxKit } from './fx/kit';
import { PARTICLE } from './fx/particles';
import { RING } from './fx/rings';
import { SPRITE } from './fx/sprites';
import { ORO_SEED } from './models/library';
import { clamp01, color } from './palette';

/**
 * Oro, the Grovekeeper (docs/phase-5e.md, Presentation): what render reads of his grove and his
 * summons, the colours it draws them in, and his transient moments (`GroveFx`). Every key read
 * here (`hero.grove`, `summon`, `enemy.rootImmuneUntil`, `field.ancient`) is absent without him
 * in the party, so nothing here draws, and nothing here is called, in any other party.
 */

/**
 * Oro's render colours. `moss` is his content colour (rings, tethers, the summon bars' leaf
 * tag); `seed` his model's trim glow (the Ancient's eyes, the sprouting burst); `bark` the
 * Ancient disc's rim; `out` the grey an aura rim takes outside your field; `vine` the root
 * vines on an enemy (the stake's look, in his moss).
 */
export const GROVE_HEX = {
  moss: '#487858',
  seed: ORO_SEED,
  bark: '#7a5a3c',
  out: '#6b7280',
  vine: '#6f9a4a',
} as const;

/**
 * Verdant Choir (Q3, docs/phase-5e.md Colour): its rings are Sostenuto's green (the regen it
 * pulses), so they carry a leaf shape (`RING.leaf`) beside Sostenuto's own plain rims.
 */
export const CHOIR_HEX = CONTENT.auras.find((a) => a.id === 'sostenuto')?.color ?? '#34d399';
export const GROVE_CHOIR = color(CHOIR_HEX);
/** Verdant Choir's reach (m): a Sapling's song heals within this of it (grove.ts `CHOIR_RADIUS`). */
export const CHOIR_RADIUS = 4;

/**
 * A Sapling singing Verdant Choir now, as grove.ts `verdantChoir` reads it: the motif taken
 * (`mods.verdantChoir` above 0, hero-gated to Oro), and a living Sapling standing in your field
 * (`summon.inField`, which the field clears on a held one). False in every party without him.
 */
export function choirSings(state: Pick<WorldState, 'mods'>, e: ReadonlyEntity): boolean {
  if (!((state.mods?.verdantChoir ?? 0) > 0)) return false;
  const s = e.summon;
  const h = e.health;
  return s?.kind === 'sapling' && s.inField === true && !!h && !h.dead;
}

/** A summon's model batch key and capacity (two lazy batches: the Saplings' and the Ancient's). */
export const SUMMON_BATCH = {
  sapling: { key: 'summon:sapling', capacity: 8 },
  ancient: { key: 'summon:ancient', capacity: 2 },
} as const;

/**
 * The Ancient's ground warning (s): the sim spawns it burrowed and it rises at `burrowUntil`
 * (W2's `ANCIENT_WARNING`), so the warning runs over the last this-long before that rise.
 */
export const ANCIENT_RISE = 1.0;
/** A summon's floating number shows only for a hit of at least this share of its life. */
export const SUMMON_NUMBER_SHARE = 0.25;

/** The grove's owner (Oro) of a summon, standing or not. */
export function ownerOf(
  state: Pick<WorldState, 'entities'>,
  e: ReadonlyEntity,
): ReadonlyEntity | undefined {
  const s = e.summon;
  return s ? state.entities.get(s.owner) : undefined;
}

/** The first hero with a grove in the party (Oro), or undefined (every other party). */
export function groveHero(
  state: Pick<WorldState, 'party' | 'entities'>,
): ReadonlyEntity | undefined {
  for (const id of state.party) {
    const e = state.entities.get(id);
    if (e?.hero?.grove) return e;
  }
  return undefined;
}

/**
 * What a summon receives of your songs, as its rim shows it (Q1, W2b's `auraMask`): the mask,
 * and whether it stands in your field (outside, its arcs grey).
 */
export function summonCoverage(e: ReadonlyEntity): { mask: number; inField: boolean } {
  const s = e.summon;
  return { mask: s?.auraMask ?? 0, inField: !!s?.inField };
}

/**
 * Burrowed (untargetable): a Sapling re-planting after a Rally, or the Ancient through its ground
 * warning (W2 spawns it burrowed until it rises). Only a Sapling's draws the burrow trail.
 *
 * Never while dormant: while Oro is down the sim holds each Sapling with a `burrowUntil` it
 * pushes `WAKE` s ahead every tick (summons.ts `tendGrove`), and that is the grove waiting for
 * him, grey and still, not a re-plant. Nor through that wake once he rises (`waking`): a Sapling
 * held where it stands is not re-planting. A Rally's re-plant moves its plant spot.
 */
export function burrowing(state: Pick<WorldState, 'time'>, e: ReadonlyEntity): boolean {
  const s = e.summon;
  const u = s?.burrowUntil;
  if (!s || u === undefined || !(u > state.time) || s.dormant) return false;
  return !(s.kind === 'sapling' && s.plantX === e.x && s.plantZ === e.z);
}

/**
 * A Sapling through its wake (summons.ts `WAKE`, 2 s after Oro rises): still held, and still
 * where it stood while dormant, so it is drawn as the dormant grove is, grey and still, until it
 * wakes. A Rally in the wake moves its plant spot, and from then on it is `burrowing`.
 */
export function waking(state: Pick<WorldState, 'time'>, e: ReadonlyEntity): boolean {
  const s = e.summon;
  const u = s?.burrowUntil;
  if (!s || s.kind !== 'sapling' || s.dormant || u === undefined || !(u > state.time)) return false;
  return s.plantX === e.x && s.plantZ === e.z;
}

/**
 * The Ancient's ground warning before it rises: its progress 0 → 1 over the last
 * `ANCIENT_RISE` s before `burrowUntil` (its rise time), or -1 (risen, a Sapling, or no
 * summon). Timed from the explicit rise, never from `until` less a life, so World Tree's
 * longer stand moves nothing.
 */
export function ancientRising(state: Pick<WorldState, 'time'>, e: ReadonlyEntity): number {
  const s = e.summon;
  if (s?.kind !== 'ancient' || s.burrowUntil === undefined) return -1;
  const left = s.burrowUntil - state.time;
  if (!(left > 0)) return -1;
  return clamp01(1 - left / ANCIENT_RISE);
}

/** Held while Oro is down or the Grand Silence holds: drawn grey and still. */
export function dormant(e: ReadonlyEntity): boolean {
  return !!e.summon?.dormant;
}

/** Drawn grey and still: dormant, or through its wake after Oro rises (`waking`). */
export function stillHeld(state: Pick<WorldState, 'time'>, e: ReadonlyEntity): boolean {
  return dormant(e) || waking(state, e);
}

/** Oro tends (Gentle, no Focus): the closed-leaf glyph, and his Saplings' tended sparkle. */
export function tending(state: WorldState, oro: ReadonlyEntity | undefined): boolean {
  const h = oro?.health;
  return !!oro?.hero?.grove && !!h && !h.dead && !h.downed && gentle(state, oro);
}

/** An enemy Oro rooted: the vines. The immunity key exists only once a root has landed. */
export function rootedLook(e: ReadonlyEntity): boolean {
  return e.enemy?.rootImmuneUntil !== undefined && enemyRooted(e);
}

/** The Ancient's taunt reach (content; 7 m). */
export function ancientTauntRadius(owner: ReadonlyEntity | undefined): number {
  const id = owner?.hero?.defId;
  const s = id ? heroDef(id).summons : undefined;
  return s?.ancient.tauntRadius ?? 7;
}

/** The Cued Ancient's disc (Q2): its point and radius, or null (every other party, and Oro's mostly). */
export function ancientDisc(
  state: Pick<WorldState, 'field'>,
): { x: number; z: number; r: number } | null {
  const a = state.field.ancient;
  return a ? { x: a.x, z: a.z, r: a.r } : null;
}

/** A Sapling's name, by its index (the saplingFelled bark's list: Moss, Fern, …). */
export const SAPLING_NAMES = ['Moss', 'Fern', 'Bramble'] as const;

/** Oro's content, for render (his summons block). */
export function groveSummons():
  NonNullable<(typeof CONTENT.heroes)[number]['summons']> | undefined {
  return CONTENT.heroes.find((h) => h.id === 'oro')?.summons;
}

// ── His moments (event-driven) ────────────────────────────────────────────────────────

export interface GroveFxDeps {
  kit: FxKit;
  recs: ReadonlyMap<EntityId, { x: number; z: number; y: number; radius: number; height: number }>;
  overlay?: {
    callout(
      x: number,
      y: number,
      z: number,
      text: string,
      color: string,
      size: number,
      life?: number,
      glow?: string,
    ): void;
  } | null;
}

type Kind = 'sprout' | 'fell' | 'rootbond' | 'root' | 'refused';

interface Moment {
  active: boolean;
  kind: Kind;
  age: number;
  life: number;
  a: EntityId;
  b: EntityId;
  x: number;
  z: number;
  value: number;
  done: boolean;
}

const POOL = 32;
const MOSS = color(GROVE_HEX.moss);
const SEED = color(GROVE_HEX.seed);
const VINE = color(GROVE_HEX.vine);
const seg = (t: number, a: number, b: number) => clamp01((t - a) / Math.max(1e-4, b - a));
const easeOut = (t: number) => 1 - (1 - t) * (1 - t) * (1 - t);

/**
 * Oro's transient moments (Feedback owns one and hands it only his events): a Sapling
 * sprouting (and the Ancient rising), a Sapling felled, Rootbond's motes running along his
 * tether to a Sapling (never the Thread's Mend pulse, never a Weaver heal burst), a root landing,
 * Gentle refusing.
 */
export class GroveFx {
  readonly fired5e = { sprouts: 0, ancients: 0, felled: 0, rootbond: 0, rooted: 0, refused: 0 };
  readonly drawn5e = { moments: 0, motes: 0 };
  private readonly pool: Moment[] = [];
  private cursor = 0;

  constructor(private readonly d: GroveFxDeps) {
    for (let i = 0; i < POOL; i++)
      this.pool.push({
        active: false,
        kind: 'sprout',
        age: 0,
        life: 1,
        a: -1,
        b: -1,
        x: 0,
        z: 0,
        value: 0,
        done: false,
      });
  }

  get live(): boolean {
    return this.pool.some((m) => m.active);
  }

  handle(e: SimEvent, state: WorldState): void {
    switch (e.type) {
      case 'summonSpawned':
        this.spawned(e, state);
        break;
      case 'summonFell':
        this.fell(e, state);
        break;
      case 'rooted': {
        this.fired5e.rooted++;
        const m = this.alloc('root', 0.5);
        m.a = e.target;
        break;
      }
      case 'gentleRefused': {
        this.fired5e.refused++;
        const m = this.alloc('refused', 0.8);
        m.a = e.hero;
        break;
      }
      default:
        break;
    }
  }

  /** Rootbond (or any grove heal) on a summon: motes along Oro's tether to it. */
  rootbond(e: SimEventOf<'healApplied'>, state: WorldState): void {
    this.fired5e.rootbond++;
    const target = state.entities.get(e.target);
    const m = this.alloc('rootbond', 0.7);
    m.a = target?.summon?.owner ?? e.source ?? -1;
    m.b = e.target;
    m.value = e.amount;
  }

  private alloc(kind: Kind, life: number): Moment {
    let m = this.pool.find((k) => !k.active);
    if (!m) {
      m = this.pool[this.cursor]!;
      this.cursor = (this.cursor + 1) % POOL;
    }
    m.active = true;
    m.kind = kind;
    m.age = 0;
    m.life = life;
    m.a = -1;
    m.b = -1;
    m.value = 0;
    m.done = false;
    return m;
  }

  private spawned(e: SimEventOf<'summonSpawned'>, state: WorldState): void {
    if (e.kind === 'ancient') this.fired5e.ancients++;
    else this.fired5e.sprouts++;
    const s = state.entities.get(e.summon);
    const m = this.alloc('sprout', e.kind === 'ancient' ? 0.9 : 0.6);
    m.a = e.summon;
    m.x = s?.x ?? 0;
    m.z = s?.z ?? 0;
    m.value = e.kind === 'ancient' ? 1 : 0;
  }

  private fell(e: SimEventOf<'summonFell'>, state: WorldState): void {
    this.fired5e.felled++;
    const s = state.entities.get(e.summon);
    const r = this.d.recs.get(e.summon);
    const m = this.alloc('fell', 0.7);
    m.a = e.summon;
    m.x = r?.x ?? s?.x ?? 0;
    m.z = r?.z ?? s?.z ?? 0;
    m.value = e.kind === 'ancient' ? 1 : 0;
  }

  sync(state: WorldState, dt: number): void {
    this.drawn5e.moments = 0;
    this.drawn5e.motes = 0;
    for (const m of this.pool) {
      if (!m.active) continue;
      this.draw(m, state);
      this.drawn5e.moments++;
      m.age += dt;
      if (m.age >= m.life) m.active = false;
    }
  }

  private draw(m: Moment, state: WorldState): void {
    const kit = this.d.kit;
    const t = m.age;
    switch (m.kind) {
      case 'sprout': {
        const big = m.value ? 2.4 : 1;
        const f = 1 - seg(t, 0, m.life);
        kit.rings.push(
          m.x,
          0.04,
          m.z,
          0.3 + big * 1.3 * easeOut(seg(t, 0, 0.4)),
          0.12,
          0.25,
          RING.plain,
          MOSS,
          0.9 * f,
        );
        if (!m.done) {
          m.done = true;
          kit.particles.burst(
            m.x,
            0.3,
            m.z,
            m.value ? 26 : 10,
            2.2 * big,
            2.4,
            0.6,
            0.1,
            SEED,
            1,
            PARTICLE.dot,
            2,
            1,
            0.3 * big,
          );
          kit.smoke.emit(
            m.x,
            0.1,
            m.z,
            0,
            0.4,
            0,
            0.8,
            0.5 * big,
            MOSS,
            0.4,
            PARTICLE.smoke,
            1.2,
            0,
            0.6,
          );
        }
        return;
      }
      case 'fell': {
        // Felled: its leaves scatter, a ring sinks into the ground.
        const f = 1 - seg(t, 0, m.life);
        kit.rings.push(
          m.x,
          0.04,
          m.z,
          0.9 * (1 - 0.6 * seg(t, 0, m.life)),
          0.08,
          0.2,
          RING.dashed,
          MOSS,
          0.8 * f,
          0,
          7,
          0,
          8,
        );
        if (!m.done) {
          m.done = true;
          kit.particles.burst(
            m.x,
            0.5,
            m.z,
            m.value ? 24 : 12,
            2.6,
            1.8,
            0.8,
            0.1,
            MOSS,
            1,
            PARTICLE.shard,
            2,
            3,
            0.3,
          );
        }
        return;
      }
      case 'rootbond': {
        // Motes running from Oro along his root tether to the Sapling (never the Thread).
        const o = this.d.recs.get(m.a);
        const s = this.d.recs.get(m.b);
        if (!o || !s) return;
        for (let i = 0; i < 3; i++) {
          const k = clamp01(t / m.life + i * 0.18);
          if (k >= 1) continue;
          kit.sprites.push(
            o.x + (s.x - o.x) * k,
            0.25 + Math.sin(Math.PI * k) * 0.35,
            o.z + (s.z - o.z) * k,
            0.12,
            SPRITE.glow,
            SEED,
            0.9 * (1 - k * 0.4),
          );
          this.drawn5e.motes++;
        }
        return;
      }
      case 'root': {
        // A root lands: vines snap up round it (the per-frame vines hold while it lasts).
        const r = this.d.recs.get(m.a);
        if (!r) return;
        const f = 1 - seg(t, 0, m.life);
        kit.rings.push(
          r.x,
          0.04,
          r.z,
          r.radius * (2.4 - 1 * easeOut(seg(t, 0, 0.3))),
          0.12,
          0.2,
          RING.plain,
          VINE,
          0.9 * f,
        );
        return;
      }
      case 'refused': {
        // Gentle: he won't raise a hand. The closed leaf flares over him.
        const r = this.d.recs.get(m.a);
        if (!r) return;
        const f = 1 - seg(t, 0, m.life);
        kit.sprites.push(
          r.x,
          r.y + r.height + 0.55,
          r.z,
          0.36 + 0.12 * f,
          SPRITE.drop,
          MOSS,
          f,
          0,
          1,
          0,
        );
        return;
      }
    }
    void state;
  }
}

/** Shared colours for the entity layer's grove draws. */
export const GROVE_MOSS: THREE.Color = MOSS;
export const GROVE_SEED: THREE.Color = SEED;
export const GROVE_VINE: THREE.Color = VINE;
export const GROVE_OUT: THREE.Color = color(GROVE_HEX.out);
export const GROVE_BARK: THREE.Color = color(GROVE_HEX.bark);
