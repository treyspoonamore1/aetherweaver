/**
 * The "person" follower (docs/solos.md, "For hands"): a stand-in for a player's hands on the one
 * thing the Solo rules ask of them, having the Thread on a hero as their Solo fires. The bots
 * move the Thread within a tick of deciding to; a person sees the tell, and their hand arrives
 * later. This plays everything else as the Skilled bot does (its own Solo rule left off), and
 * follows Solos like this:
 *
 * - it notices a Solo when its tell appears (the sim's `soloDueIn`: the last `SOLOS.tell` seconds
 *   of charge and the wait), or, with `from: 'ready'`, only once the Solo is full (a player who
 *   reacts to the wait itself, the harder case);
 * - `reaction` seconds later (0.35) it moves the Thread there, and keeps it there until the Solo
 *   fires;
 * - it misses one Solo in six altogether (`miss`): looking elsewhere, it never goes;
 * - it does not leave a hero under 30% of their life (`danger`), and goes back to one who falls
 *   that low (a Blood Rage hero aside: Brann sits low on purpose).
 *
 * Deterministic for a seed, like every bot. The study (tools/solo-study.ts) plays it; the target
 * it is tuned to is at least 70% of boss-fight Solos Cued.
 */
import { SkilledBot } from '../src/bots/skilled';
import type { Bot } from '../src/bots/types';
import type { Command, PartySlot, ReadonlyEntity, WorldState } from '../src/sim';
import { soloDueIn } from '../src/sim';
import { Rng } from '../src/sim/core/rng';

export interface PersonOptions {
  /** Seconds between a Solo's tell appearing and the Thread moving. */
  reaction: number;
  /** The chance a Solo is missed altogether. */
  miss: number;
  /** A hero under this share of their life is not left, and is gone back to. */
  danger: number;
  /** What is noticed: the tell as it appears, or only a Solo that is full and waiting. */
  from: 'tell' | 'ready';
}

export const PERSON: PersonOptions = { reaction: 0.35, miss: 1 / 6, danger: 0.3, from: 'tell' };

interface Noticed {
  /** Sim time the tell was first seen. */
  since: number;
  /** False for the one in six the person never goes to. */
  go: boolean;
}

function lifeShare(e: ReadonlyEntity): number {
  return e.health ? e.health.hp / Math.max(1, e.health.maxHp) : 1;
}

/** A hero who is low on purpose (Blood Rage) is never "in danger" by their life alone. */
function lowOnPurpose(e: ReadonlyEntity): boolean {
  return e.hero?.blood !== undefined;
}

export class PersonBot implements Bot {
  readonly name: string;
  private readonly base: SkilledBot;
  private readonly rng: Rng;
  private readonly noticed = new Map<PartySlot, Noticed>();

  constructor(
    seed: number,
    private readonly opts: PersonOptions = PERSON,
    name = 'person',
  ) {
    this.base = new SkilledBot(seed, {
      every: 4,
      attention: 1,
      callReaction: 0.4,
      skip: new Set(['soloCue']),
    });
    this.rng = new Rng((seed ^ 0x9e3779b9) >>> 0);
    this.name = name;
  }

  decide(state: WorldState): Command[] {
    const out = this.base.decide(state);
    const weaver = state.entities.get(state.weaverId);
    const w = weaver?.weaver;
    if (!weaver || !w || !weaver.health || weaver.health.downed) return out;
    if (state.encounter.status !== 'fighting') return out;

    // What the person has noticed: each hero's tell, from the tick it appears until it goes.
    let target: PartySlot | null = null;
    let soonest = Infinity;
    let danger = false;
    state.party.forEach((id, i) => {
      const slot = i as PartySlot;
      const e = state.entities.get(id);
      if (!e?.hero || !e.health || e.health.dead || e.health.downed) {
        this.noticed.delete(slot);
        return;
      }
      if (lifeShare(e) < this.opts.danger && !lowOnPurpose(e)) danger = true;
      const due = soloDueIn(state, e);
      const told = due !== null && (this.opts.from === 'tell' || e.hero.solo >= 100);
      if (!told) {
        this.noticed.delete(slot);
        return;
      }
      let n = this.noticed.get(slot);
      if (!n) {
        n = { since: state.time, go: this.rng.float() >= this.opts.miss };
        this.noticed.set(slot, n);
      }
      if (!n.go || state.time - n.since < this.opts.reaction - 1e-9) return;
      if (Math.hypot(e.x - weaver.x, e.z - weaver.z) >= w.threadRange - 0.5) return;
      if (due < soonest) {
        soonest = due;
        target = slot;
      }
    });
    // Someone under 30% of their life: the Thread is theirs (the Skilled bot's own choice stands).
    if (target === null || danger) return out;
    const kept: Command[] = out.filter((c) => c.t !== 'thread');
    if (w.threadSlot !== target) kept.push({ t: 'thread', slot: target });
    return kept;
  }
}
