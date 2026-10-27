/**
 * The Chronomancer as render sees it (docs/phase-3e/vfx.md). Pure helpers, no three.js, so the
 * look flags, Rewind's preview, the telegraph timers, Foresight's shapes and the Stasis wave are
 * testable in Node against the real sim.
 *
 * Everything is read from `WorldState.calling` (`id: 'chronomancer'`, `path`, `rewind`,
 * `timers`, `foresight`), `field.stasis`, the heroes' `past` / `pastAt`, the enemies'
 * `foreseen`, the shields' `echo` / `stasis` and the Chronomancer's events. Numbers come from
 * content (the Calling's `values`, the attacks' shapes), so the lead's tuning shows up without
 * render changes.
 */
import { CONTENT, attackDef } from '../content';
import type { AttackDef } from '../content';
import { rewindCanRevive } from '../sim';
import type {
  DeepReadonly,
  EntityId,
  PastSample,
  ReadonlyEntity,
  TelegraphShape,
  WorldState,
} from '../sim';

/** The Chronomancer's id, as `WorldState.calling.id`. */
export const CHRONOMANCER = 'chronomancer';

/**
 * The Chronomancer's colours: moonlit silver-blue with brass clockwork. Identity colours, not
 * semantic (a Ward stays `C.shield`, a heal `C.heal`). `silver` is ΔE ≥ 20 from Mend, Empower,
 * Bear, the Luminary's sun and dawn, lethal and threat under every palette's simulated vision
 * (tested); the others are ≥ 20 from lethal and ≥ 15 from threat. Every visual also has its own
 * shape (clock faces and hands, dashed outlines, afterimages), so none relies on colour.
 */
export const CHRONO_HEX = {
  /** The Chronomancer's own: Rewind's trail and ghost, Foresight's outlines, clock faces, frost. */
  silver: '#c9d6ea',
  /** Bright cores: a streak's head, glints, the moment a foreseen attack becomes real. */
  glass: '#eef4ff',
  /** Clockwork: clock hands, gear teeth, Borrowed Time, Temporal Mastery. */
  brass: '#b5935a',
  /** What a frozen enemy is tinted toward (the model shader), and Stasis' cool light. */
  frost: '#b9cbe9',
} as const;

/** The glyph on Rewind's number (text presentation: never an emoji). */
export const REWIND_GLYPH = '↺︎';

/** Stasis' wave: how fast the stillness spreads from the Weaver when time stops (m/s). */
export const STASIS_WAVE_SPEED = 34;
/** How long Foresight's outline takes to hand over to the real telegraph (s). */
export const HANDOFF = 0.2;
/** A foreseen attack that never began fades out over this long (s). */
export const LAPSE = 0.35;
/** The streak of a Rewind: how long the hero takes to run back along it (s). */
export const REWIND_TRAVEL = 0.18;

/** What the Chronomancer adds to the fight this frame. Reused (no allocation per frame). */
export interface ChronoLook {
  /** The Chronomancer is the Calling. */
  chrono: boolean;
  /** Stasis is up (`field.stasis`). Never Sunrise: `field.crescendo` stays false. */
  stasis: boolean;
  /** Telegraphs show their timers (`calling.timers`). */
  timers: boolean;
  /** Rewind replaces Reel (`calling.rewind`). */
  rewind: boolean;
  /** Foresight's lead (`calling.foresight`, seconds; 0 = none). */
  foresight: number;
  quickened: boolean;
  echoWard: boolean;
  borrowedTime: boolean;
  temporalMastery: boolean;
  slowDance: boolean;
  paradox: boolean;
  eternalMoment: boolean;
  /** Rewind could be cast now: off cooldown (none in Stasis), the Weaver up, Spirit for it. */
  rewindReady: boolean;
}

export function emptyChronoLook(): ChronoLook {
  return {
    chrono: false,
    stasis: false,
    timers: false,
    rewind: false,
    foresight: 0,
    quickened: false,
    echoWard: false,
    borrowedTime: false,
    temporalMastery: false,
    slowDance: false,
    paradox: false,
    eternalMoment: false,
    rewindReady: false,
  };
}

function has(path: readonly string[], id: string): boolean {
  for (let i = 0; i < path.length; i++) if (path[i] === id) return true;
  return false;
}

/** The Chronomancer is the Calling. */
export function isChrono(state: WorldState): boolean {
  return state.calling?.id === CHRONOMANCER;
}

/** A value of the Chronomancer's passive (`values[key]`: rewind, cooldown, stasis, cost…). */
export function chronoValue(key: string, fallback: number): number {
  const c = CONTENT.callings.find((k) => k.id === CHRONOMANCER);
  const v = c?.values[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

/** What Rewind costs right now (Reel's cost; Stasis halves it, from content). */
export function rewindCost(stasis: boolean): number {
  const base = CONTENT.techniques.reel.cost;
  return stasis ? base * (1 - chronoValue('cost', 50) / 100) : base;
}

/** Fills `out` from the state. */
export function chronoLook(state: WorldState, out: ChronoLook): ChronoLook {
  const c = state.calling;
  const on = !!c && c.id === CHRONOMANCER;
  const path = on ? c.path : [];
  out.chrono = on;
  out.stasis = on && state.field.stasis;
  out.timers = on && c.timers;
  out.rewind = on && c.rewind;
  out.foresight = on ? c.foresight : 0;
  out.quickened = on && has(path, 'quickened');
  out.echoWard = on && has(path, 'echo_ward');
  out.borrowedTime = on && has(path, 'borrowed_time');
  out.temporalMastery = on && has(path, 'temporal_mastery');
  out.slowDance = on && has(path, 'slow_dance');
  out.paradox = on && has(path, 'paradox');
  out.eternalMoment = on && has(path, 'eternal_moment');
  out.rewindReady = out.rewind && rewindReady(state);
  return out;
}

/** Rewind could be cast now (the sim's checks that don't depend on the target). */
export function rewindReady(state: WorldState): boolean {
  const e = state.entities.get(state.weaverId);
  const w = e?.weaver;
  const h = e?.health;
  if (!w || !h || h.downed || h.dead) return false;
  const status = state.encounter.status;
  if (status === 'victory' || status === 'defeat') return false;
  const stasis = state.field.stasis;
  if (w.cooldowns.reel > 0 && !stasis) return false;
  return w.spirit + 1e-9 >= rewindCost(stasis);
}

/** Where Rewind would send `e` (its oldest remembered moment), or null. */
export function rewindSample(e: ReadonlyEntity | undefined): DeepReadonly<PastSample> | null {
  const h = e?.hero;
  if (!h || h.past.length === 0) return null;
  return h.past[h.pastAt] ?? null;
}

/**
 * Rewind could act on this hero: remembered and not out; a downed one only if they went down
 * within its reach and Rewind can still stand someone back up (once a run, the sim's
 * `rewindCanRevive`).
 */
export function rewindable(state: WorldState, e: ReadonlyEntity | undefined): boolean {
  const past = rewindSample(e);
  const h = e?.health;
  if (!past || !h || h.dead) return false;
  if (!h.downed) return true;
  return past.up && rewindCanRevive(state);
}

/**
 * How long a downed hero can still be stood back up by Rewind: the moments remembered from
 * before they fell, oldest first, times the sampling step (0 when they were already down).
 */
export function reviveWindow(e: ReadonlyEntity | undefined, rewindSeconds = 3): number {
  const h = e?.hero;
  if (!h || h.past.length === 0) return 0;
  const n = h.past.length;
  let up = 0;
  for (let i = 0; i < n; i++) {
    if (!h.past[(h.pastAt + i) % n]!.up) break;
    up++;
  }
  return (up / n) * rewindSeconds;
}

/** Who Rewind's preview shows: the threaded hero, if Rewind could take them now. */
export function rewindPreviewHero(state: WorldState, look: ChronoLook): ReadonlyEntity | null {
  if (!look.rewindReady) return null;
  const w = state.entities.get(state.weaverId)?.weaver;
  if (!w || w.threadSlot === null) return null;
  const e = state.entities.get(state.party[w.threadSlot] ?? -1);
  return rewindable(state, e) ? (e ?? null) : null;
}

// ── Telegraph timers ────────────────────────────────────────────────────────────────

const TENTHS: string[] = [];
for (let i = 0; i < 20; i++) TENTHS.push((i / 10).toFixed(1));
const WHOLE: string[] = [];
for (let i = 0; i < 100; i++) WHOLE.push(String(i));

/**
 * A telegraph's timer as shown (the Chronomancer's passive): whole seconds from 2 s up, one
 * decimal under 2 s, counting down to 0.0 at impact. Truncated, so it never shows more time
 * than is left. The strings are built once (no allocation per frame).
 */
export function timerLabel(remain: number): string {
  if (!(remain > 0)) return TENTHS[0]!;
  if (remain < 2) return TENTHS[Math.min(19, Math.floor(remain * 10 + 1e-6))]!;
  return WHOLE[Math.min(99, Math.floor(remain + 1e-6))]!;
}

// ── Foresight ───────────────────────────────────────────────────────────────────────

/** The telegraph grammar kinds a foreseen attack is drawn as. */
export type GhostKind = 'circle' | 'cone' | 'line' | 'donut' | 'mark' | 'link' | 'raid' | 'cast';

/**
 * A foreseen attack's shape, in the telegraph layer's terms (telegraphs.ts): `x, z` the
 * centre, `rot` the heading, and `a, b` per kind (circle: a = r; cone: a = r, b = half angle;
 * line: a = half length, b = half width; donut: a = inner, b = outer; cast: a = r). `ex, ez`
 * are the instance extents. Filled in place.
 */
export interface GhostShape {
  kind: GhostKind;
  x: number;
  z: number;
  rot: number;
  a: number;
  b: number;
  ex: number;
  ez: number;
  /** Who it's aimed at (null: an area round the enemy, or the whole party). */
  target: EntityId | null;
  /** A link's second hero. */
  second: EntityId | null;
}

export function emptyGhostShape(): GhostShape {
  return {
    kind: 'circle',
    x: 0,
    z: 0,
    rot: 0,
    a: 1,
    b: 0,
    ex: 1,
    ez: 1,
    target: null,
    second: null,
  };
}

function standing(e: ReadonlyEntity | undefined): e is ReadonlyEntity {
  return !!e?.health && !e.health.dead && !e.health.downed;
}

/**
 * The shape the enemy's foreseen attack will take if it begins now, from content and the live
 * positions of the enemy and its target, as `beginAttack` (sim/systems/enemies.ts) builds it.
 * Null when there is nothing foreseen (or no attack by that id).
 */
export function foreseenShape(
  state: WorldState,
  enemy: ReadonlyEntity,
  out: GhostShape,
): GhostShape | null {
  const f = enemy.enemy?.foreseen;
  if (!f) return null;
  let attack: AttackDef;
  try {
    attack = attackDef(f.attackId);
  } catch {
    return null;
  }
  const t = f.target === null ? undefined : state.entities.get(f.target);
  const target = standing(t) ? t : undefined;
  out.target = target ? target.id : null;
  out.second = f.second;
  out.rot = 0;
  out.b = 0;
  if (attack.effect !== 'damage') {
    // A heal, summon or silence: drawn as the caster's cast circle (as telegraphs.ts does).
    out.kind = 'cast';
    out.x = enemy.x;
    out.z = enemy.z;
    out.a = attack.kind === 'burst' ? Math.min(attack.radius, 9) : 2.4;
    out.ex = out.ez = out.a + 0.4;
    out.target = null;
    return out;
  }
  // The direction it will face: its target, else where it looks now.
  let dx = target ? target.x - enemy.x : enemy.fx;
  let dz = target ? target.z - enemy.z : enemy.fz;
  let d = Math.hypot(dx, dz);
  if (d < 1e-6) {
    dx = 0;
    dz = 1;
    d = 1;
  }
  switch (attack.kind) {
    case 'cleave': {
      out.kind = 'cone';
      out.x = enemy.x;
      out.z = enemy.z;
      out.rot = Math.atan2(dz, dx);
      out.a = attack.radius + enemy.radius;
      out.b = ((attack.angleDeg / 2) * Math.PI) / 180;
      out.ex = out.ez = out.a + 0.35;
      return out;
    }
    case 'beam': {
      // The lance stops just past its target.
      const reach = target ? Math.min(attack.length, d + target.radius + 1.5) : attack.length;
      const ux = dx / d;
      const uz = dz / d;
      out.kind = 'line';
      out.x = enemy.x + ux * reach * 0.5;
      out.z = enemy.z + uz * reach * 0.5;
      out.rot = Math.atan2(uz, ux);
      out.a = reach / 2;
      out.b = attack.width / 2;
      out.ex = out.a + 0.35;
      out.ez = out.b + 0.35;
      return out;
    }
    case 'burst':
      out.kind = 'circle';
      out.x = enemy.x;
      out.z = enemy.z;
      out.a = attack.radius + enemy.radius;
      out.ex = out.ez = out.a + 0.35;
      return out;
    case 'donut':
      out.kind = 'donut';
      out.x = enemy.x;
      out.z = enemy.z;
      out.a = attack.innerRadius;
      out.b = attack.radius;
      out.ex = out.ez = out.b + 0.35;
      return out;
    case 'mark':
      if (!target) return null;
      out.kind = 'mark';
      out.x = target.x;
      out.z = target.z;
      out.a = target.height;
      out.b = target.radius;
      out.ex = out.ez = 1.15;
      return out;
    case 'link':
      out.kind = 'link';
      out.x = target ? target.x : enemy.x;
      out.z = target ? target.z : enemy.z;
      out.a = attack.radius;
      out.ex = out.ez = 1;
      return out;
    case 'raid':
      out.kind = 'raid';
      out.x = enemy.x;
      out.z = enemy.z;
      out.a = 0;
      out.ex = out.ez = 1;
      out.target = null;
      return out;
    default:
      return null;
  }
}

/**
 * A live telegraph's shape in the same terms (for the hand-off and Paradox), or null for the
 * kinds drawn on heroes (mark, link, raid) whose place comes from the entities.
 */
export function shapeOf(s: DeepReadonly<TelegraphShape>, out: GhostShape): GhostShape | null {
  out.rot = 0;
  out.b = 0;
  out.target = null;
  out.second = null;
  switch (s.kind) {
    case 'circle':
      out.kind = 'circle';
      out.x = s.x;
      out.z = s.z;
      out.a = s.r;
      out.ex = out.ez = s.r + 0.35;
      return out;
    case 'cone':
      out.kind = 'cone';
      out.x = s.x;
      out.z = s.z;
      out.rot = Math.atan2(s.dirZ, s.dirX);
      out.a = s.r;
      out.b = Math.acos(Math.max(-1, Math.min(1, s.halfAngleCos)));
      out.ex = out.ez = s.r + 0.35;
      return out;
    case 'line': {
      const dx = s.toX - s.x;
      const dz = s.toZ - s.z;
      const len = Math.hypot(dx, dz);
      out.kind = 'line';
      out.x = (s.x + s.toX) / 2;
      out.z = (s.z + s.toZ) / 2;
      out.rot = Math.atan2(dz, dx);
      out.a = len / 2;
      out.b = s.width / 2;
      out.ex = len / 2 + 0.35;
      out.ez = s.width / 2 + 0.35;
      return out;
    }
    case 'donut':
      out.kind = 'donut';
      out.x = s.x;
      out.z = s.z;
      out.a = s.innerR;
      out.b = s.outerR;
      out.ex = out.ez = s.outerR + 0.35;
      return out;
    case 'mark':
      out.kind = 'mark';
      out.target = s.target;
      return out;
    case 'link':
      out.kind = 'link';
      out.target = s.a;
      out.second = s.b;
      out.a = s.r;
      return out;
    case 'raid':
      out.kind = 'raid';
      return out;
    default:
      return null;
  }
}

/**
 * An area shape holds (x, z) with radius r (the sim's `contains` for the shapes Paradox lets
 * pass a hero by: circle, donut, cone, line, raid).
 */
export function areaContains(
  s: DeepReadonly<TelegraphShape>,
  x: number,
  z: number,
  r: number,
): boolean {
  switch (s.kind) {
    case 'circle':
      return Math.hypot(x - s.x, z - s.z) <= s.r + r;
    case 'donut': {
      const d = Math.hypot(x - s.x, z - s.z);
      return d > s.innerR && d <= s.outerR + r;
    }
    case 'cone': {
      const dx = x - s.x;
      const dz = z - s.z;
      const d = Math.hypot(dx, dz);
      if (d > s.r + r) return false;
      if (d <= r + 0.5) return true;
      return (dx * s.dirX + dz * s.dirZ) / d >= s.halfAngleCos;
    }
    case 'line': {
      const lx = s.toX - s.x;
      const lz = s.toZ - s.z;
      const l2 = lx * lx + lz * lz;
      let u = l2 > 0 ? ((x - s.x) * lx + (z - s.z) * lz) / l2 : 0;
      u = u < 0 ? 0 : u > 1 ? 1 : u;
      return Math.hypot(x - (s.x + lx * u), z - (s.z + lz * u)) <= s.width / 2 + r;
    }
    case 'raid':
      return true;
    default:
      return false;
  }
}

/** A telegraph Paradox cancels outright when Rewind takes `hero` (aimed at them). */
export function paradoxAimed(
  t: { readonly target: EntityId | null; readonly shape: DeepReadonly<TelegraphShape> },
  hero: EntityId,
): boolean {
  const s = t.shape;
  return (
    t.target === hero ||
    (s.kind === 'mark' && s.target === hero) ||
    (s.kind === 'link' && (s.a === hero || s.b === hero))
  );
}

// ── Stasis ──────────────────────────────────────────────────────────────────────────

/** How far the stillness has spread `age` seconds after time stopped (m). */
export function stasisWave(age: number): number {
  return age <= 0 ? 0 : age * STASIS_WAVE_SPEED;
}

/** Slow Dance holds this enemy back (on the path, in a field, standing). */
export function slowDanced(state: WorldState, e: ReadonlyEntity | undefined): boolean {
  const c = state.calling;
  if (!c || c.id !== CHRONOMANCER || !e?.enemy?.inField) return false;
  if (e.health && e.health.dead) return false;
  return has(c.path, 'slow_dance');
}

/** How many seconds Stasis lasts on this path (content: the passive, plus Eternal Moment). */
export function stasisSeconds(state: WorldState): number {
  let s = chronoValue('stasis', 3);
  const c = state.calling;
  if (c?.id === CHRONOMANCER && has(c.path, 'eternal_moment')) {
    for (const k of CONTENT.callings)
      for (const t of k.tiers)
        for (const o of t.options) if (o.id === 'eternal_moment') s += o.values.seconds ?? 0;
  }
  return s;
}

/** The technique Temporal Mastery reset, as a short word for its flick. */
export function masteryWord(technique: 'ward' | 'chime' | 'reel' | 'rewind'): string {
  return technique === 'ward'
    ? 'WARD'
    : technique === 'chime'
      ? 'CHIME'
      : technique === 'rewind'
        ? 'REWIND'
        : 'REEL';
}
