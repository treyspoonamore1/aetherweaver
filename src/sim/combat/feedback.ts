/** Barks, ledger markers and hit-stop: the sim's side of "juice" (docs/plan/04 §3). */
import { heroDef } from '../../content';
import type { HeroDef } from '../../content/schema';
import type { SimEventOf } from '../events';
import type { Entity, EntityId, LedgerMarkerKind } from '../state';
import type { World } from '../world';

const BARK_COOLDOWN = 5;

export function bark(
  world: World,
  hero: Entity,
  kind: keyof HeroDef['barks'],
  force = false,
): void {
  const h = hero.hero;
  if (!h) return;
  if (!force && world.time - h.lastBarkAt < BARK_COOLDOWN) return;
  h.lastBarkAt = world.time;
  const line = world.rng.cosmetic.pick(heroDef(h.defId).barks[kind]);
  world.events.push({ type: 'bark', tick: world.tick, speaker: hero.id, line });
}

export function pushMarker(world: World, kind: LedgerMarkerKind, slot: number | null): void {
  world.ledger.markers.push({ time: world.time - world.encounter.startedAt, kind, slot });
}

/**
 * Hit-stop / slow-mo inside the sim, for `ticks` real ticks. Overlapping requests keep the
 * slowest scale and the longest duration. Deterministic, so replays include it.
 */
export function setTimeScale(
  world: World,
  scale: number,
  ticks: number,
  reason: SimEventOf<'timeScaleChanged'>['reason'],
): void {
  const internal = world.internal;
  const active = internal.timeScaleTicks > 0;
  const nextScale = active ? Math.min(world.timeScale, scale) : scale;
  const nextTicks = Math.max(internal.timeScaleTicks, ticks);
  world.timeScale = nextScale;
  internal.timeScaleTicks = nextTicks;
  world.events.push({
    type: 'timeScaleChanged',
    tick: world.tick,
    scale: nextScale,
    duration: nextTicks / 60,
    reason,
  });
}

/** Counts down a time-scale effect in real ticks. */
export function updateTimeScale(world: World): void {
  const internal = world.internal;
  if (internal.timeScaleTicks <= 0) return;
  internal.timeScaleTicks--;
  if (internal.timeScaleTicks === 0 && world.timeScale !== 1) {
    world.timeScale = 1;
    world.events.push({
      type: 'timeScaleChanged',
      tick: world.tick,
      scale: 1,
      duration: 0,
      reason: 'perfect',
    });
  }
}

/** Announces a boss decree and keeps it on the encounter for the boss bar. */
export function announceDecree(world: World, event: SimEventOf<'decree'>): void {
  world.encounter.decree = { name: event.name, text: event.text, at: world.time };
  world.events.push(event);
}

/**
 * A relic visibly acted (docs/phase-3b.md): the view hears `relicTriggered`, and the relic's
 * count in `WorldState.relics.triggers` goes up, so a HUD reading snapshots can flash it too.
 */
export function relicFired(
  world: World,
  relic: string,
  hero: EntityId | null,
  targets?: EntityId[],
): void {
  world.relics.triggers[relic] = (world.relics.triggers[relic] ?? 0) + 1;
  world.events.push({
    type: 'relicTriggered',
    tick: world.tick,
    relic,
    hero,
    ...(targets ? { targets } : {}),
  });
}
