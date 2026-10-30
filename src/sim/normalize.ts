/**
 * Canonical form for commands at the sim boundary.
 *
 * The sim hashes exact float bits, but JSON (replays) turns -0 into 0 and NaN/Infinity into
 * null. So every command is normalised once — -0 → +0, non-finite numbers rejected, unknown
 * properties dropped — and the *normalised* copy is what gets both recorded and simulated.
 */
import type { Command, DebugOp, PartySlot, Vec2 } from './commands';

const z0 = (v: number) => v + 0;
const ok = (...vs: number[]) => vs.every((v) => Number.isFinite(v));
const isSlot = (v: unknown): v is PartySlot => v === 0 || v === 1 || v === 2 || v === 3;

function vec(p: Vec2 | undefined): Vec2 | undefined | null {
  if (p === undefined) return undefined;
  return ok(p.x, p.z) ? { x: z0(p.x), z: z0(p.z) } : null;
}

function normalizeDebug(op: DebugOp): DebugOp | null {
  switch (op.op) {
    case 'spawnDummies':
      return ok(op.count) ? { op: 'spawnDummies', count: z0(op.count) } : null;
    case 'clearDummies':
      return { op: 'clearDummies' };
    case 'teleportWeaver':
      return ok(op.x, op.z) ? { op: 'teleportWeaver', x: z0(op.x), z: z0(op.z) } : null;
    case 'spawnEnemy':
      return ok(op.x, op.z)
        ? {
            op: 'spawnEnemy',
            defId: String(op.defId),
            x: z0(op.x),
            z: z0(op.z),
            elite: op.elite === true,
          }
        : null;
    case 'killEnemies':
      return { op: 'killEnemies' };
    case 'setResonance':
      return ok(op.value) ? { op: 'setResonance', value: z0(op.value) } : null;
    case 'healParty':
      return { op: 'healParty' };
    case 'chargeSolos':
      return { op: 'chargeSolos' };
    case 'setBossHp':
      return ok(op.pct) ? { op: 'setBossHp', pct: z0(op.pct) } : null;
    case 'forceCall':
    case 'forceHold':
      return isSlot(op.slot) ? { op: op.op, slot: op.slot } : null;
    case 'drill':
      return isSlot(op.slot) && ok(op.windup)
        ? { op: 'drill', slot: op.slot, windup: z0(op.windup) }
        : null;
    default:
      return null;
  }
}

export function normalizeCommand(c: Command): Command | null {
  switch (c.t) {
    case 'move':
    case 'aim':
    case 'glide':
      return ok(c.x, c.z) ? { t: c.t, x: z0(c.x), z: z0(c.z) } : null;
    case 'thread':
    case 'cue':
      return isSlot(c.slot) ? { t: c.t, slot: c.slot } : null;
    case 'mode':
      return c.mode === 'bear' ? { t: 'mode', mode: 'bear' } : { t: 'mode' };
    case 'crescendo':
      return { t: c.t };
    case 'tech': {
      if (c.id !== 'ward' && c.id !== 'chime' && c.id !== 'reel') return null;
      const point = vec(c.point);
      if (point === null) return null;
      if (c.slot !== undefined && !isSlot(c.slot)) return null;
      return {
        t: 'tech',
        id: c.id,
        ...(c.slot !== undefined ? { slot: c.slot } : {}),
        ...(point ? { point } : {}),
      };
    }
    case 'directive': {
      if (c.kind !== 'focus' && c.kind !== 'rally' && c.kind !== 'hold' && c.kind !== 'scatter') {
        return null;
      }
      const point = vec(c.point);
      if (point === null) return null;
      if (c.target !== undefined && !ok(c.target)) return null;
      return {
        t: 'directive',
        kind: c.kind,
        ...(c.target !== undefined ? { target: c.target } : {}),
        ...(point ? { point } : {}),
      };
    }
    case 'plant': {
      const point = vec(c.point);
      return point ? { t: 'plant', point } : null;
    }
    case 'debug': {
      const op = normalizeDebug(c.op);
      return op ? { t: 'debug', op } : null;
    }
    default:
      return null;
  }
}

/** Normalised copies of the valid commands, in order. Idempotent. */
export function normalizeCommands(commands: readonly Command[]): Command[] {
  const out: Command[] = [];
  for (const c of commands) {
    const n = normalizeCommand(c);
    if (n) out.push(n);
  }
  return out;
}
