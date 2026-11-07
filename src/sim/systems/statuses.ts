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
import { heroDef } from '../../content';
import { POSSESS_DPS_SHARE } from '../../content/unstitched';
import { distSq } from '../core/dmath';
import { possessionVictim } from '../rules3';
import type { Entity, Status, StatusId } from '../state';
import type { World } from '../world';
import { ofParty } from './stasis';

/**
 * Statuses that end through their telegraph (it detonates or cancels them), not on their own
 * clock: a mark's (Dirge, Execution's Condemned; Movement III's Doubt and Doomed) and a link's
 * (Resound, Blood Pact; the Seamstress's Stitch).
 */
function boundToTelegraph(id: StatusId): boolean {
  return (
    id === 'dirge' ||
    id === 'resound' ||
    id === 'pact' ||
    id === 'condemned' ||
    id === 'doubt' ||
    id === 'doomed' ||
    id === 'stitch'
  );
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
  // Unravel (docs/phase-5c.md Q12): while Mend wounds, it can't hold a downed hero's bleed-out;
  // the revive channel only holds its progress. Under Stasis the reversed Mend waits, and Mend
  // holds them as ever. (Absent outside the Unweaver's phase 2.)
  const unravelled = world.field.unravel !== undefined && !stasis;
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
      // The Grand Silence (docs/phase-5d.md) holds the downed: Reignite stands them back up.
      const bleeds = !world.field.finale?.silence;
      if (reviving && unravelled) {
        if (bleeds) h.bleedOut -= dt;
        if (h.bleedOut <= 0) heroOut(world, e);
      } else if (!reviving) {
        h.revive = Math.max(0, h.revive - 0.5 * dt);
        if (bleeds) h.bleedOut -= dt;
        if (h.bleedOut <= 0) heroOut(world, e);
      }
    }
  }
  if (dueTicks.length > 0) {
    for (const t of dueTicks) {
      if (t.due) {
        // A possessed hero (Movement III) strikes an ally on the possession's own clock.
        if (t.status.id === 'possessed') possessionTick(world, t.target, t.status);
        else dotTick(world, t.target, t.status);
      }
      // Its last tick lands as it runs out.
      if (t.expired && t.target.health?.statuses.includes(t.status)) {
        removeStatus(world, t.target, t.status.id, 'expired');
        if (t.status.id === 'possessed')
          world.events.push({
            type: 'freed',
            tick: world.tick,
            hero: t.target.id,
            status: 'possessed',
            by: 'expired',
          });
      }
    }
    dueTicks.length = 0;
  }
}

/**
 * A possessed hero's strike (docs/phase-5c.md Q6): every `DOT_TICK` s, `POSSESS_DPS_SHARE` of
 * their own basic attack's damage a second, on the nearest other standing hero within reach
 * (`possessionVictim`: never the Weaver). A hero's hit on a hero: the ledger, threat, Bonds and
 * lifesteal all gate on an enemy target, so none of them see it. The recap answers Chime, Focus.
 */
function possessionTick(world: World, e: Entity, s: Status): void {
  const h = e.health;
  if (!h || h.dead || h.downed || !h.statuses.includes(s) || !e.hero) return;
  if (world.encounter.status === 'victory' || world.encounter.status === 'defeat') return;
  const victimId = possessionVictim(world, e);
  const victim = victimId === null ? undefined : world.entities.get(victimId);
  if (!isActive(victim)) return;
  const def = heroDef(e.hero.defId);
  const amount = POSSESS_DPS_SHARE * (def.attack.damage / def.attack.interval) * DOT_TICK;
  if (amount <= 0) return;
  dealDamage(world, victim, {
    source: e.id,
    sourceName: `${def.name} (possessed)`,
    amount,
    telegraph: null,
    kind: 'tick',
    status: 'possessed',
  });
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
