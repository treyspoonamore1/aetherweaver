/**
 * Staging for Seren's sim tests (docs/phase-5e.md, "Seren"): a sandbox party with her in it,
 * sturdy foes, and telegraphs built from real attack defs (so `parryable` reads their shapes).
 */
import { attackDef } from '../../src/content';
import type { SimConfig } from '../../src/sim';
import { addStatus } from '../../src/sim/combat/health';
import type { Entity, Telegraph } from '../../src/sim/state';
import { spawnEnemy } from '../../src/sim/systems/enemies';
import type { World } from '../../src/sim/world';
import { sandbox, worldOf } from './helpers';

export function setup(
  party: string[] = ['kael', 'lyra', 'seren'],
  config: Partial<SimConfig> = {},
) {
  const sim = sandbox({ party, ...config });
  const w = worldOf(sim);
  const of = (id: string) =>
    w.party.map((p) => w.entities.get(p)!).find((e) => e.hero!.defId === id)!;
  const seren = of('seren');
  const slot = seren.hero!.slot as 0 | 1 | 2;
  return { sim, w, of, seren, slot };
}

export function place(e: Entity, x: number, z: number): void {
  e.x = e.px = x;
  e.z = e.pz = z;
  e.vx = e.vz = 0;
}

/** An enemy at (x, z), at once; `hp` sets its life (and max), `stun` holds it still. */
export function foe(
  w: World,
  defId: string,
  x: number,
  z: number,
  opts: { elite?: boolean; hp?: number; stun?: boolean; affixes?: string[] } = {},
): Entity {
  const e = spawnEnemy(w, defId, x, z, {
    instant: true,
    ...(opts.elite ? { elite: true } : {}),
    ...(opts.affixes ? { affixes: opts.affixes } : {}),
  });
  w.entities.flush();
  if (opts.hp !== undefined) e.health!.hp = e.health!.maxHp = opts.hp;
  if (opts.stun) addStatus(w, e, 'stun', 1e4, null);
  return e;
}

/**
 * A cone telegraph of the real attack `attackId` from `from` toward `at`, aimed at `target`,
 * landing in `impact` s (its Perfect window the last 0.35 s), dealing `damage`.
 */
export function cone(
  w: World,
  from: Entity,
  at: { x: number; z: number },
  target: number | null,
  opts: { attackId?: string; impact?: number; damage?: number; r?: number } = {},
): Telegraph {
  const attackId = opts.attackId ?? 'brute_toll_cleave';
  const def = attackDef(attackId);
  const dx = at.x - from.x;
  const dz = at.z - from.z;
  const d = Math.hypot(dx, dz) || 1;
  const impact = opts.impact ?? 1.5;
  const t: Telegraph = {
    id: w.internal.nextTelegraphId++,
    owner: from.id,
    target,
    attackId,
    name: def?.name ?? 'Test Cleave',
    kind: 'cleave',
    shape: {
      kind: 'cone',
      x: from.x,
      z: from.z,
      r: opts.r ?? def?.radius ?? 4.2,
      dirX: dx / d,
      dirZ: dz / d,
      halfAngleCos: Math.cos((50 * Math.PI) / 180),
    },
    start: w.time,
    impact: w.time + impact,
    perfectFrom: w.time + impact - 0.35,
    damage: opts.damage ?? 500,
    pctMaxHp: 0,
    effect: 'damage',
    answers: ['ward'],
    severity: 'normal',
  };
  w.telegraphs.push(t);
  return t;
}

export const gap = (a: { x: number; z: number }, b: { x: number; z: number }) =>
  Math.hypot(a.x - b.x, a.z - b.z);
