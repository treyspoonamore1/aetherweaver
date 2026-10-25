import type { Command, DebugOp, DirectiveKind } from '../commands';
import { len } from '../core/dmath';
import { heal, isActive, killEnemy, reviveHero } from '../combat/health';
import type { FollowMode } from '../state';
import { weaverOf, type World } from '../world';
import { clearDummies, spawnDummies } from './dummies';
import { spawnEnemy } from './enemies';
import { plantField } from './field';
import { castChime, castGlide, castReel, castWard, crescendo, cue } from './techniques';
import { attachThread, toggleThreadMode } from './thread';

/** Applies one tick's (already normalised) commands, in order. */
export function applyCommands(world: World, commands: readonly Command[]): void {
  const weaver = weaverOf(world);
  const w = weaver.weaver!;
  for (const c of commands) {
    switch (c.t) {
      case 'move': {
        const m = len(c.x, c.z);
        w.moveX = m > 1 ? c.x / m : c.x;
        w.moveZ = m > 1 ? c.z / m : c.z;
        break;
      }
      case 'aim':
        w.aimX = c.x;
        w.aimZ = c.z;
        break;
      case 'thread':
        attachThread(world, c.slot);
        break;
      case 'mode':
        toggleThreadMode(world);
        break;
      case 'tech':
        if (c.id === 'ward') castWard(world, c.slot);
        else if (c.id === 'chime') castChime(world, c.point);
        else castReel(world, c.slot);
        break;
      case 'glide':
        castGlide(world, c.x, c.z);
        break;
      case 'cue':
        cue(world, c.slot);
        break;
      case 'crescendo':
        crescendo(world);
        break;
      case 'directive':
        applyDirective(world, c.kind, c.target);
        break;
      case 'plant':
        plantField(world, c.point);
        break;
      case 'debug':
        if (world.config.debug) applyDebug(world, c.op);
        break;
      default: {
        const unknown: never = c;
        void unknown;
      }
    }
  }
}

const FOLLOW_FOR: Record<Exclude<DirectiveKind, 'focus'>, FollowMode> = {
  rally: 'follow',
  hold: 'hold',
  scatter: 'scatter',
};

function applyDirective(world: World, kind: DirectiveKind, target: number | undefined): void {
  if (kind === 'focus') {
    const enemy = target === undefined ? undefined : world.entities.get(target);
    if (!enemy?.enemy || !isActive(enemy)) {
      world.events.push({
        type: 'techniqueRejected',
        tick: world.tick,
        technique: 'thread',
        reason: 'target',
      });
      return;
    }
    world.focusTarget = enemy.id;
  } else {
    const follow = FOLLOW_FOR[kind];
    if (kind === 'rally') world.internal.rallyUntil = world.time + 3;
    for (const id of world.party) {
      const e = world.entities.get(id);
      if (!e?.hero) continue;
      e.hero.follow = follow;
      if (kind === 'rally') e.hero.quirk = 0;
      if (follow === 'hold') {
        e.hero.holdX = e.x;
        e.hero.holdZ = e.z;
      }
    }
  }
  world.directive = kind;
  for (const id of world.party) {
    const e = world.entities.get(id);
    if (isActive(e))
      world.events.push({ type: 'directiveAck', tick: world.tick, hero: id, directive: kind });
  }
  const speakers = world.party.filter((id) => isActive(world.entities.get(id)));
  if (speakers.length > 0 && world.time - world.internal.directiveBarkAt >= 4) {
    world.internal.directiveBarkAt = world.time;
    const cosmetic = world.rng.cosmetic;
    const speaker = speakers[cosmetic.int(speakers.length)]!;
    const line = cosmetic.pick(world.content.barks[kind]);
    world.events.push({ type: 'bark', tick: world.tick, speaker, line });
  }
}

function applyDebug(world: World, op: DebugOp): void {
  switch (op.op) {
    case 'spawnDummies':
      spawnDummies(world, op.count);
      break;
    case 'clearDummies':
      clearDummies(world);
      break;
    case 'teleportWeaver': {
      const e = weaverOf(world);
      e.x = e.px = op.x;
      e.z = e.pz = op.z;
      e.vx = e.vz = 0;
      break;
    }
    case 'spawnEnemy': {
      if (!world.content.enemies.some((d) => d.id === op.defId)) break;
      const e = spawnEnemy(world, op.defId, op.x, op.z, {
        elite: op.elite ?? false,
        instant: true,
      });
      if (e.enemy!.tier === 'boss' || e.enemy!.tier === 'miniboss') world.encounter.bossId = e.id;
      break;
    }
    case 'killEnemies':
      for (const e of world.entities.list()) if (e.enemy && isActive(e)) killEnemy(world, e, null);
      break;
    case 'setResonance': {
      const w = weaverOf(world).weaver!;
      w.resonance = Math.max(0, Math.min(world.content.resonance.max, op.value));
      break;
    }
    case 'chargeSolos':
      for (const id of world.party) {
        const e = world.entities.get(id);
        if (!isActive(e) || !e.hero || e.hero.soloActive > 0 || e.hero.solo >= 100) continue;
        e.hero.solo = 100;
        world.events.push({ type: 'soloReady', tick: world.tick, hero: e.id });
      }
      break;
    case 'setBossHp': {
      const boss =
        world.encounter.bossId === null ? undefined : world.entities.get(world.encounter.bossId);
      if (!boss?.health || boss.health.dead) break;
      const pct = Math.max(0.01, Math.min(1, op.pct));
      boss.health.hp = boss.health.maxHp * pct;
      break;
    }
    case 'healParty':
      for (const id of world.party) {
        const e = world.entities.get(id);
        if (!e?.health || e.health.dead) continue;
        if (e.health.downed) reviveHero(world, e, 1);
        else heal(world, e, e.health.maxHp, 'other');
      }
      break;
  }
}
