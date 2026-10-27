/** Status timers, shield expiry, invulnerability, bleeding out and revive decay. */
import { NEVER, heroOut, releaseHold, removeShield, removeStatus } from '../combat/health';
import type { World } from '../world';
import { ofParty } from './stasis';

export function updateStatuses(world: World, dt: number): void {
  const w = world.entities.get(world.weaverId)?.weaver;
  const mendSlot = w && w.threadMode === 'mend' ? w.threadSlot : null;
  const stasis = world.field.stasis;
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
      s.remaining -= dt;
      if (s.remaining <= 0) {
        // Dirge and Resound end through their telegraphs; a Fermata hold resolves after the
        // loop (releasing it can down the hero, which rewrites their statuses); everything
        // else just expires.
        if (s.id === 'dirge' || s.id === 'resound') {
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
}
