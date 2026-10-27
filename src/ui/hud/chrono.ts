/**
 * The Chronomancer in the fight (Phase 3e, docs/phase-3e.md), for the HUD: what Rewind would do
 * to each hero right now, the attacks Foresight sees coming at them, when the next hit lands (the
 * passive's telegraph timers) and what Temporal Mastery would bring back.
 *
 * Everything is read from the state on every snapshot and never cached. While Stasis lasts every
 * enemy-side clock (telegraph `impact`, `foreseen.at`) moves forward with time, so `impact − time`
 * stands still, which is what the HUD should show.
 */
import { attackDef } from '../../content';
import {
  PAST_SAMPLE_SECONDS,
  type DeepReadonly,
  type EntityId,
  type PastSample,
  type ReadonlyEntity,
  type WorldState,
} from '../../sim';
// The same read-only shape test the bots use: the HUD asks "would this hit them?" as the sim does.
import { contains } from '../../sim/combat/telegraphs';
import type { ForeseenHud, RewindHud } from '../store';

/**
 * The oldest sample of a hero's past (`past[pastAt]`): where Rewind would send them and the life
 * it would give back. `up: false` means they were already down then. Null without the
 * Chronomancer (the sim keeps no past).
 */
export function rewindSample(e: ReadonlyEntity): DeepReadonly<PastSample> | null {
  const h = e.hero;
  return h && h.past.length > 0 ? h.past[h.pastAt]! : null;
}

/**
 * How much longer Rewind can reach back to before a downed hero fell: the run of standing
 * samples from the oldest, a sample's worth each (0 once the oldest is a fallen one).
 */
export function reachLeft(e: ReadonlyEntity): number {
  const h = e.hero;
  if (!h || h.past.length === 0) return 0;
  let n = 0;
  for (let i = 0; i < h.past.length; i++) {
    if (!h.past[(h.pastAt + i) % h.past.length]!.up) break;
    n++;
  }
  return n * PAST_SAMPLE_SECONDS;
}

/** Damaging telegraphs that would hit `e` as things stand (what `incoming` sums). */
function hitsOn(state: WorldState, e: ReadonlyEntity) {
  return state.telegraphs.filter((t) => t.effect === 'damage' && contains(state, t, e));
}

/**
 * Would going back take them out of everything on its way to them? Rewind out of a shape is a
 * dodge (as Reel's is); with Paradox every attack aimed at them is undone and an area passes
 * them by, so it always escapes. Null when nothing is coming, or something would still land.
 */
function escapeOf(
  state: WorldState,
  e: ReadonlyEntity,
  past: DeepReadonly<PastSample>,
  paradox: boolean,
): RewindHud['escape'] {
  const hits = hitsOn(state, e);
  if (hits.length === 0) return null;
  if (paradox) return 'undo';
  const then = { ...e, x: past.x, z: past.z };
  return hits.every((t) => !contains(state, t, then)) ? 'dodge' : null;
}

/**
 * What Rewind would do to hero `e` right now, as the sim's `castRewind` would: a hero down since
 * before its reach can't be brought back (`reach`); one who fell within it stands back up with
 * the life they had then, once a run (`revive`, or `spent` once it's used: `canRevive` is the
 * sim's `rewindCanRevive`); anyone else gets back what they had then if it was more. Null for a
 * hero who is out of the fight, or without the Chronomancer.
 */
export function rewindPreview(
  state: WorldState,
  e: ReadonlyEntity,
  opts: { target: boolean; inRange: boolean; paradox: boolean; canRevive: boolean },
): RewindHud | null {
  const past = rewindSample(e);
  const h = e.health;
  if (!past || !h || h.dead) return null;
  const base = { target: opts.target, inRange: opts.inRange, escape: null, left: 0 } as const;
  if (h.downed) {
    // The sim's order: out of reach first, then the revive spent.
    if (!past.up) return { ...base, kind: 'reach', amount: 0 };
    if (!opts.canRevive) return { ...base, kind: 'spent', amount: 0 };
    return {
      ...base,
      kind: 'revive',
      amount: Math.min(h.maxHp, Math.max(1, past.hp)),
      left: reachLeft(e),
    };
  }
  const back = Math.max(0, Math.min(h.maxHp, past.hp) - h.hp);
  return {
    ...base,
    kind: back >= 1 ? 'restore' : 'none',
    amount: back,
    escape: escapeOf(state, e, past, opts.paradox),
  };
}

/** Every attack Foresight sees coming, once per snapshot (`EnemyComponent.foreseen`). */
export interface Foreseen {
  enemy: EntityId;
  name: string;
  /** Seconds until it begins (0: due, waiting until the enemy can strike). */
  in: number;
  /** The heroes it picked (a link picks two); empty for an area or every hero. */
  targets: EntityId[];
  /** It falls on every hero (Requiem). */
  everyone: boolean;
  /** It hurts (a mark, a cleave, a link); not a heal, a summons or a silence. */
  damage: boolean;
}

export function foreseenAll(state: WorldState): Foreseen[] {
  const out: Foreseen[] = [];
  for (const e of state.entities.list()) {
    const f = e.enemy?.foreseen;
    if (!f || !e.health || e.health.dead) continue;
    const def = attackDef(f.attackId);
    out.push({
      enemy: e.id,
      name: f.name,
      in: Math.max(0, f.at - state.time),
      targets: [f.target, f.second].filter((id): id is EntityId => id !== null),
      everyone: def.targeting === 'allHeroes',
      damage: def.effect === 'damage',
    });
  }
  return out.sort((a, b) => a.in - b.in);
}

/** The attacks foreseen on one hero, the soonest first: aimed at them, or at every hero. */
export function foreseenOn(all: readonly Foreseen[], hero: EntityId): ForeseenHud[] {
  return all
    .filter((f) => f.damage && (f.everyone || f.targets.includes(hero)))
    .map((f) => ({ name: f.name, in: f.in, aimed: f.targets.includes(hero) }));
}

/**
 * The passive's telegraph timers on a hero's frame: the soonest hit on its way to them and the
 * seconds until it lands (`impact − time`), or null when nothing is coming.
 */
export function landsOn(state: WorldState, e: ReadonlyEntity): { name: string; in: number } | null {
  let best: { name: string; in: number } | null = null;
  for (const t of hitsOn(state, e)) {
    const left = Math.max(0, t.impact - state.time);
    if (best === null || left < best.in) best = { name: t.name, in: left };
  }
  return best;
}

/**
 * What a Glide would bring back now with Temporal Mastery: the last technique cast, if it has a
 * cooldown to reset (Ward: a charge to give back). Null: nothing to bring back.
 */
export function masteryResets(w: {
  lastTechnique: 'ward' | 'chime' | 'reel' | null;
  wardCharges: number;
  maxWardCharges: number;
  cooldowns: { ward: number; chime: number; reel: number };
}): 'ward' | 'chime' | 'reel' | null {
  const last = w.lastTechnique;
  if (last === null) return null;
  if (last === 'ward') return w.wardCharges < w.maxWardCharges ? 'ward' : null;
  return w.cooldowns[last] > 0 ? last : null;
}

/** "0.8 s", "now" (a due attack waiting for its enemy, a hit about to land). */
export function secondsLabel(s: number): string {
  return s < 0.05 ? 'now' : `${s.toFixed(1)} s`;
}
