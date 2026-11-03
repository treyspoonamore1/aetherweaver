/** Status timers, shield expiry, invulnerability, bleeding out and revive decay. */
import {
  DOT_TICK,
  DRAIN_REACH,
  NEVER,
  dealDamage,
  dotName,
  heroOut,
  isActive,
  releaseHold,
  removeShield,
  removeStatus,
} from '../combat/health';
import { distSq } from '../core/dmath';
import type { Entity, Status, StatusId } from '../state';
import type { World } from '../world';
import { ofParty } from './stasis';

/**
 * Statuses that end through their telegraph (it detonates or cancels them), not on their own
 * clock: a mark's (Dirge, Execution's Condemned) and a link's (Resound, Blood Pact).
 */
function boundToTelegraph(id: StatusId): boolean {
  return id === 'dirge' || id === 'resound' || id === 'pact' || id === 'condemned';
}

/**
 * A damage-over-time status with a tick due, or running out, this step: handled after the
 * timers (a tick can down the hero, which rewrites their statuses).
 */
interface DotTick {
  target: Entity;
  status: Status;
  due: boolean;
  expired: boolean;
}
const dueTicks: DotTick[] = [];

export function updateStatuses(world: World, dt: number): void {
  const w = world.entities.get(world.weaverId)?.weaver;
  const mendSlot = w && w.threadMode === 'mend' ? w.threadSlot : null;
  const stasis = world.field.stasis;
  dueTicks.length = 0;
  for (const e of world.entities.list()) {
    const h = e.health;
    if (!h || h.dead) continue;
    // Stasis (the Chronomancer): an enemy's clocks wait, and so do the marks enemies left on
    // heroes (a mark waits with the attack it belongs to).
    const frozen = stasis && !!e.enemy;
    if (h.invulnerable > 0 && !frozen) h.invulnerable = Math.max(0, h.invulnerable - dt);
    let holdEnds = false;
    for (let i = h.statuses.length - 1; i >= 0; i--) {
      const s = h.statuses[i]!;
      if (s.remaining >= NEVER) continue;
      if (frozen || (stasis && s.source !== null && !ofParty(world, s.source))) continue;
      // Movement II damage over time (docs/phase-5a.md P2): a tick every half second, the last
      // one as the status runs out.
      if (s.tickIn !== undefined) {
        s.tickIn -= dt;
        s.remaining -= dt;
        const due = s.tickIn <= 1e-9;
        if (due) s.tickIn += DOT_TICK;
        const expired = s.remaining <= 1e-9;
        if (due || expired) dueTicks.push({ target: e, status: s, due, expired });
        continue;
      }
      s.remaining -= dt;
      if (s.remaining <= 0) {
        // Dirge and Resound end through their telegraphs (as do Execution's mark and a Blood
        // Pact); a Fermata hold resolves after the loop (releasing it can down the hero, which
        // rewrites their statuses); everything else just expires.
        if (boundToTelegraph(s.id)) {
          if (s.remaining < -0.5) removeStatus(world, e, s.id, 'expired');
        } else if (s.id === 'held' && e.hero?.hold) holdEnds = true;
        else removeStatus(world, e, s.id, 'expired');
      }
    }
    if (holdEnds) releaseHold(world, e);
    for (let i = h.shields.length - 1; i >= 0; i--) {
      const s = h.shields[i]!;
      if (s.expiresAt <= world.time) removeShield(world, e, s.kind, false);
    }
    if (e.hero && h.downed) {
      const reviving = mendSlot !== null && world.party[mendSlot] === e.id;
      if (!reviving) {
        h.revive = Math.max(0, h.revive - 0.5 * dt);
        h.bleedOut -= dt;
        if (h.bleedOut <= 0) heroOut(world, e);
      }
    }
  }
  if (dueTicks.length > 0) {
    for (const t of dueTicks) {
      if (t.due) dotTick(world, t.target, t.status);
      // Its last tick lands as it runs out.
      if (t.expired && t.target.health?.statuses.includes(t.status))
        removeStatus(world, t.target, t.status.id, 'expired');
    }
    dueTicks.length = 0;
  }
}

/**
 * One damage-over-time tick: `dps × stacks` for half a second, through the damage pipeline (the
 * ledger, Fermata, the Martyr and the death recap all see it). A drain heals its source by what
 * it took, and lets go when the source is dead or out of reach.
 */
function dotTick(world: World, e: Entity, s: Status): void {
  const h = e.health;
  // Already gone: cleansed, freed, or wiped by a down earlier this step.
  if (!h || h.dead || h.downed || !h.statuses.includes(s)) return;
  if (world.encounter.status === 'victory' || world.encounter.status === 'defeat') return;
  const source = s.source === null ? undefined : world.entities.get(s.source);
  if (s.drain) {
    const reach = DRAIN_REACH + e.radius + (source?.radius ?? 0);
    if (!isActive(source) || distSq(source.x, source.z, e.x, e.z) > reach * reach) {
      removeStatus(world, e, s.id, 'expired');
      return;
    }
  }
  const amount = (s.dps ?? 0) * s.stacks * DOT_TICK;
  if (amount <= 0) return;
  const r = dealDamage(world, e, {
    source: s.source,
    sourceName: dotName(world, s),
    amount,
    telegraph: null,
    kind: 'tick',
    status: s.id,
  });
  // A latch heals the Leech by what it took (the Mending Hymn pattern: enemies heal directly).
  if (s.drain && r.dealt > 0 && isActive(source)) {
    const missing = source.health.maxHp - source.health.hp;
    const healed = Math.min(missing, r.dealt);
    if (healed > 0) {
      source.health.hp += healed;
      world.events.push({
        type: 'healApplied',
        tick: world.tick,
        target: source.id,
        source: source.id,
        amount: healed,
        overheal: r.dealt - healed,
        via: 'other',
      });
    }
  }
}
