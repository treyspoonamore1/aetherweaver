import { CONTENT } from '../content';
import { contains, telegraphDamage } from '../sim/combat/telegraphs';
import { quantize } from '../sim/core/dmath';
import type {
  Command,
  DeepReadonly,
  PartySlot,
  ReadonlyEntity,
  Telegraph,
  ThreadMode,
  WorldState,
} from '../sim';

export type ReadonlyTelegraph = DeepReadonly<Telegraph>;

export const MOVE_STEP = 1 / 1024;
export const AIM_STEP = 1 / 16;

export function weaverOf(state: WorldState): ReadonlyEntity {
  return state.entities.get(state.weaverId)!;
}

/** The slot the Thread will be on once `out` runs: the last `thread` command's, else `current`. */
export function threadingTo(out: readonly Command[], current: PartySlot | null): PartySlot | null {
  for (let i = out.length - 1; i >= 0; i--) {
    const c = out[i]!;
    if (c.t === 'thread') return c.slot;
  }
  return current;
}

/**
 * The commands that move the Thread from `current` to `want`. Bear (the Martyr) has its own
 * toggle, and leaving it returns to the mode it left, so a switch can take two decisions.
 */
export function modeCommands(current: ThreadMode, want: ThreadMode): Command[] {
  if (want === 'bear') return current === 'bear' ? [] : [{ t: 'mode', mode: 'bear' }];
  if (current === 'bear') return [{ t: 'mode', mode: 'bear' }];
  return current === want ? [] : [{ t: 'mode' }];
}

export interface HeroView {
  e: ReadonlyEntity;
  slot: PartySlot;
  defId: string;
  role: string;
}

export function partyOf(state: WorldState, includeDowned = false): HeroView[] {
  const out: HeroView[] = [];
  state.party.forEach((id, slot) => {
    const e = state.entities.get(id);
    if (!e?.hero || !e.health || e.health.dead) return;
    if (!includeDowned && e.health.downed) return;
    const def = CONTENT.heroes.find((h) => h.id === e.hero!.defId)!;
    out.push({ e, slot: slot as PartySlot, defId: def.id, role: def.role });
  });
  return out;
}

export function enemiesOf(state: WorldState): ReadonlyEntity[] {
  return state.entities
    .list()
    .filter((e) => e.enemy && e.health && !e.health.dead && e.enemy.state !== 'spawning');
}

export function shieldOf(e: ReadonlyEntity): number {
  let total = 0;
  for (const s of e.health?.shields ?? []) total += s.amount;
  return total;
}

/** HP fraction after shields and the damage already aimed at them. */
export function effectiveFraction(e: ReadonlyEntity): number {
  const h = e.health!;
  return (h.hp + shieldOf(e) - h.incoming) / h.maxHp;
}

export function dist(a: { x: number; z: number }, b: { x: number; z: number }): number {
  return Math.sqrt((a.x - b.x) * (a.x - b.x) + (a.z - b.z) * (a.z - b.z));
}

export function damaging(t: ReadonlyTelegraph): boolean {
  return t.damage > 0 || t.pctMaxHp > 0;
}

/** Damaging telegraphs that would hit `e` now, soonest first. */
export function threatsOn(state: WorldState, e: ReadonlyEntity): ReadonlyTelegraph[] {
  return state.telegraphs
    .filter((t) => damaging(t) && contains(state, t, e))
    .sort((a, b) => a.impact - b.impact);
}

export function damageOf(t: ReadonlyTelegraph, e: ReadonlyEntity): number {
  return telegraphDamage(t, e);
}

export function statusRemaining(e: ReadonlyEntity, id: string): number {
  const s = e.health?.statuses.find((x) => x.id === id);
  return s ? s.remaining : Infinity;
}

/** Emits move/aim only when they change, quantised like the input layer. */
export class Intent {
  private lastMove = { x: Number.NaN, z: Number.NaN };
  private lastAim = { x: Number.NaN, z: Number.NaN };

  move(out: Command[], x: number, z: number): void {
    const m = Math.sqrt(x * x + z * z);
    let mx = 0;
    let mz = 0;
    if (m > 1e-6) {
      mx = quantize(x / Math.max(1, m), MOVE_STEP);
      mz = quantize(z / Math.max(1, m), MOVE_STEP);
    }
    if (mx === this.lastMove.x && mz === this.lastMove.z) return;
    this.lastMove = { x: mx, z: mz };
    out.push({ t: 'move', x: mx, z: mz });
  }

  /** Move toward a point, easing in over the last metre. */
  moveTo(
    out: Command[],
    from: { x: number; z: number },
    to: { x: number; z: number },
    deadzone = 0.4,
  ): void {
    const dx = to.x - from.x;
    const dz = to.z - from.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d < deadzone) return this.move(out, 0, 0);
    const k = d < 1.5 ? d / 1.5 : 1;
    this.move(out, (dx / d) * k, (dz / d) * k);
  }

  aim(out: Command[], x: number, z: number): void {
    const ax = quantize(x, AIM_STEP);
    const az = quantize(z, AIM_STEP);
    if (ax === this.lastAim.x && az === this.lastAim.z) return;
    this.lastAim = { x: ax, z: az };
    out.push({ t: 'aim', x: ax, z: az });
  }
}

export function centroid(points: readonly { x: number; z: number }[]): { x: number; z: number } {
  if (points.length === 0) return { x: 0, z: 0 };
  let x = 0;
  let z = 0;
  for (const p of points) {
    x += p.x;
    z += p.z;
  }
  return { x: x / points.length, z: z / points.length };
}

/** A point outside the telegraph's shape, near `e` (for dodging). */
export function escapeFrom(
  t: ReadonlyTelegraph,
  e: { x: number; z: number },
  margin: number,
): { x: number; z: number } | null {
  const s = t.shape;
  if (s.kind === 'circle' || s.kind === 'cone') {
    const dx = e.x - s.x;
    const dz = e.z - s.z;
    const d = Math.sqrt(dx * dx + dz * dz) || 1;
    return { x: s.x + (dx / d) * (s.r + margin), z: s.z + (dz / d) * (s.r + margin) };
  }
  if (s.kind === 'line') {
    const lx = s.toX - s.x;
    const lz = s.toZ - s.z;
    const l = Math.sqrt(lx * lx + lz * lz) || 1;
    const nx = -lz / l;
    const nz = lx / l;
    const side = (e.x - s.x) * nx + (e.z - s.z) * nz >= 0 ? 1 : -1;
    const off = s.width / 2 + margin;
    const along = ((e.x - s.x) * lx + (e.z - s.z) * lz) / l;
    return {
      x: s.x + (lx / l) * along + nx * side * off,
      z: s.z + (lz / l) * along + nz * side * off,
    };
  }
  if (s.kind === 'donut') {
    const dx = e.x - s.x;
    const dz = e.z - s.z;
    const d = Math.sqrt(dx * dx + dz * dz) || 1;
    const r = Math.max(0, s.innerR - margin);
    return { x: s.x + (dx / d) * r, z: s.z + (dz / d) * r };
  }
  return null;
}

// ── Calls, holds, planted fields and the beam song ────────────────────────────────────

/** The hero with an open, unanswered call, if any. */
export function caller(party: readonly HeroView[]): HeroView | null {
  return party.find((h) => h.e.hero!.call && !h.e.hero!.call.answered) ?? null;
}

/** A hero hanging on in a Fermata hold (heal them!), if any. */
export function heldHero(party: readonly HeroView[]): HeroView | null {
  return party.find((h) => h.e.hero!.hold) ?? null;
}

export function plantedChord(state: WorldState): WorldState['field']['chords'][number] | null {
  return state.field.chords.find((c) => c.anchor === 'planted') ?? null;
}

/** The beam song (Chord I), if it has any auras. */
export function beamSong(state: WorldState): WorldState['field']['chords'][number] | null {
  return state.field.chords.find((c) => c.role === 'beam' && c.auras.length > 0) ?? null;
}

const DEFENSIVE_AURAS = new Set(['sostenuto', 'ostinato', 'fermata']);

/** A beam song of mostly defensive auras belongs on the tank; mixed or offensive, on a striker. */
export function defensiveSong(chord: { auras: readonly string[] }): boolean {
  return chord.auras.filter((a) => DEFENSIVE_AURAS.has(a)).length * 2 > chord.auras.length;
}

/** Where to plant a Pedal Point field: the party's centre, pulled toward the tank. */
export function plantSpot(party: readonly HeroView[]): { x: number; z: number } {
  let x = 0;
  let z = 0;
  let w = 0;
  for (const h of party) {
    const k = h.role === 'tank' ? 2 : 1;
    x += h.e.x * k;
    z += h.e.z * k;
    w += k;
  }
  return w > 0 ? { x: x / w, z: z / w } : { x: 0, z: 0 };
}

export function plantCommand(at: { x: number; z: number }): Command {
  return { t: 'plant', point: { x: quantize(at.x, AIM_STEP), z: quantize(at.z, AIM_STEP) } };
}
