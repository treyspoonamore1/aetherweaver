/**
 * Call and Response (docs/phase-2.md): a hero calls for a specific kind of support in the
 * last seconds before a big move comes off cooldown — Kael wants a Ward, Lyra Empower, Vexis
 * a Chime. Answer before the move goes off (casts can be answered mid-cast) and it becomes
 * its Flourish, and the Weaver gains Resonance. The hero uses the move exactly when they
 * would have anyway, so ignoring a call costs nothing. Calls are spaced out and never made
 * while something lethal is on the board.
 */
import { heroDef } from '../../content';
import type { HeroDef } from '../../content/schema';
import { distSq } from '../core/dmath';
import { pushMarker } from '../combat/feedback';
import { hasStatus, isActive, isDisabled } from '../combat/health';
import { gainResonance } from '../combat/resonance';
import type { CallAnswer, Entity } from '../state';
import { weaverOf, type World } from '../world';

/** A call opens no earlier than this much of the answer time before the move is ready. */
const MIN_LEAD = 0.6;
/** Seconds a call may stay open past its expected moment while the hero waits for a target. */
const LINGER = 4;

/** Seconds the call ability's cast takes (0 for instant moves). */
function castTime(world: World, def: HeroDef): number {
  const ability = def.abilities[def.call.ability];
  return ability.castTime * (ability.id === 'starbolt' ? world.mods.starboltCastMult : 1);
}

/** Should `e` call for support now: their move is almost ready, it's calm, and an answer is possible? */
export function canCall(world: World, e: Entity, def: HeroDef): boolean {
  if (world.config.absent || world.encounter.status !== 'fighting') return false;
  const hero = e.hero!;
  if (hero.call || hero.callCooldown > 0 || world.time < world.internal.nextCallAt) return false;
  const answerTime = def.call.answerTime;
  const ready = hero.abilityCooldowns[def.call.ability];
  if (ready > answerTime || ready < answerTime * MIN_LEAD) return false;
  if (hero.cast || hero.soloActive > 0 || hero.hold || hasStatus(e, 'silence') || isDisabled(e))
    return false;
  // Danger first: no calls while anything lethal is on the board.
  for (const t of world.telegraphs) if (t.severity === 'lethal') return false;
  for (const id of world.party) if (world.entities.get(id)?.hero?.call) return false;
  const weaver = weaverOf(world);
  const w = weaver.weaver!;
  if (weaver.health!.downed) return false;
  const reach = world.content.techniques.ward.range;
  if (distSq(e.x, e.z, weaver.x, weaver.z) > reach * reach) return false;
  // Only ask for what the Weaver could plausibly give in time.
  const t = ready + castTime(world, def);
  const regen = (w.maxSpirit - w.reservedSpirit) * world.content.weaver.spiritRegenPct;
  const spiritBy = (cost: number) => w.spirit + regen * world.mods.spiritRegenMult * t >= cost;
  const tech = world.content.techniques;
  switch (def.call.answer) {
    case 'ward':
      return (w.wardCharges > 0 || w.cooldowns.ward <= t) && spiritBy(tech.ward.cost);
    case 'chime':
      return w.cooldowns.chime <= t && spiritBy(tech.chime.cost);
    case 'empower':
      return w.threadLock <= t;
  }
}

/** Opens `e`'s call for their call ability (which should be ready in a moment). */
export function startCall(world: World, e: Entity, def: HeroDef): void {
  const hero = e.hero!;
  const call = def.call;
  const index = call.ability;
  const end = world.time + hero.abilityCooldowns[index] + castTime(world, def);
  const target = hero.targetId === null ? undefined : world.entities.get(hero.targetId);
  hero.call = {
    answer: call.answer,
    ability: index,
    start: world.time,
    end,
    answered: false,
    target: target?.id ?? null,
    x: target?.x ?? e.x,
    z: target?.z ?? e.z,
  };
  world.internal.nextCallAt = end + world.content.calls.gap;
  world.ledger.calls++;
  world.events.push({
    type: 'callStarted',
    tick: world.tick,
    hero: e.id,
    answer: call.answer,
    ability: def.abilities[index].name,
    flourish: call.flourish.name,
    until: end,
    line: world.rng.cosmetic.pick(call.lines),
  });
}

/** The Weaver did `how` for `e`: if it's what their open call asked for, it's answered. */
export function answerCall(world: World, e: Entity, how: CallAnswer): void {
  const hero = e.hero;
  const call = hero?.call;
  if (!hero || !call || call.answered || call.answer !== how) return;
  call.answered = true;
  world.ledger.responses++;
  pushMarker(world, 'response', hero.slot);
  gainResonance(world, world.content.resonance.gains.response, 'response');
  const def = heroDef(hero.defId);
  if (hero.cast && hero.cast.ability === call.ability) {
    hero.cast.flourish = true;
    hero.castName = def.call.flourish.name;
  }
  world.events.push({
    type: 'callAnswered',
    tick: world.tick,
    hero: e.id,
    answer: how,
    flourish: def.call.flourish.name,
    after: world.time - call.start,
  });
  world.events.push({
    type: 'bark',
    tick: world.tick,
    speaker: e.id,
    line: world.rng.cosmetic.pick(def.call.thanks),
  });
}

/** Ends an open call that didn't go off: the hero was stopped, or the moment passed. */
export function endCall(world: World, e: Entity, reason: 'missed' | 'cancelled'): void {
  const hero = e.hero;
  if (!hero?.call) return;
  hero.call = null;
  hero.callCooldown = world.content.calls.heroCooldown;
  world.events.push({ type: 'callEnded', tick: world.tick, hero: e.id, reason });
}

/**
 * Each tick: a stunned, silenced or out-of-the-fight hero drops their call; a call for Empower
 * answers itself while the Thread Empowers them; a call whose moment has long passed ends.
 */
export function tendCall(world: World, e: Entity, empowered: boolean): void {
  const hero = e.hero;
  const call = hero?.call;
  if (!hero || !call) return;
  if (
    !isActive(e) ||
    isDisabled(e) ||
    hasStatus(e, 'silence') ||
    world.encounter.status !== 'fighting'
  ) {
    endCall(world, e, 'cancelled');
    return;
  }
  if (!call.answered && call.answer === 'empower' && empowered) answerCall(world, e, 'empower');
  const def = heroDef(hero.defId);
  const casting = hero.cast?.ability === call.ability;
  // A cancelled cast (a dodge) spent the move: the call goes with it.
  if (!casting && hero.abilityCooldowns[call.ability] > def.call.answerTime + 0.1) {
    endCall(world, e, call.answered ? 'cancelled' : 'missed');
    return;
  }
  if (casting) call.end = Math.max(call.end, hero.cast!.end);
  else if (world.time > call.end) {
    // Ready, but waiting for a target: keep the call open a little longer.
    if (world.time > call.start + def.call.answerTime + castTime(world, def) + LINGER)
      endCall(world, e, call.answered ? 'cancelled' : 'missed');
    else call.end = world.time + 0.25;
  }
}

/** Is `e`'s ability `index` about to go off as a Flourish? */
export function flourishing(e: Entity, index: 0 | 1): boolean {
  const call = e.hero?.call;
  return !!call && call.ability === index && call.answered;
}

/** The call's move went off: close the call (unanswered calls end as missed). */
export function settleCall(world: World, e: Entity, index: 0 | 1): void {
  const hero = e.hero!;
  const call = hero.call;
  if (!call || call.ability !== index) return;
  hero.call = null;
  hero.callCooldown = world.content.calls.heroCooldown;
  if (!call.answered)
    world.events.push({ type: 'callEnded', tick: world.tick, hero: e.id, reason: 'missed' });
}
