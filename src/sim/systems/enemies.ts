/**
 * Enemy AI (docs/plan/03 §6): approach by role, basic attacks, telegraphed specials with a
 * readability cap, threat-driven targeting, affixes (Shielded, Volatile, Hastened).
 */
import { attackDef, enemyDef } from '../../content';
import type { AttackDef, EnemyDef } from '../../content/schema';
import { dcos, distSq, len } from '../core/dmath';
import type { TelegraphShape } from '../events';
import {
  addShield,
  addStatus,
  dealDamage,
  isActive,
  isDisabled,
  NEVER,
  setOnEnemyDeath,
} from '../combat/health';
import { pickEnemyTarget, WEAVER_THREAT_INDEX } from '../combat/threat';
import { announceDecree } from '../combat/feedback';
import { countAimed, perfectWindow, setOnCastComplete, startTelegraph } from '../combat/telegraphs';
import type { Entity, EnemyTier, Telegraph } from '../state';
import type { World } from '../world';
import { newHealth } from '../world';
import { enemyFx, hasAura } from '../combat/auras';
import { approachVelocity, arrive } from './steering';

/** Normal enemies may have at most this many telegraphs up at once (readability cap). */
const READABILITY_CAP = 2;
const SPAWN_TIME = 0.8;
const ENEMY_ACCEL = 18;

export interface SpawnOptions {
  elite?: boolean;
  affixes?: string[];
  /** Skip the emerge animation (debug spawns). */
  instant?: boolean;
}

export function spawnEnemy(
  world: World,
  defId: string,
  x: number,
  z: number,
  opts: SpawnOptions = {},
): Entity {
  const def = enemyDef(defId);
  const tier: EnemyTier =
    def.role === 'boss'
      ? 'boss'
      : def.role === 'miniboss'
        ? 'miniboss'
        : opts.elite
          ? 'elite'
          : 'normal';
  const affixes = [...(opts.affixes ?? [])];
  const hpMult = tier === 'elite' ? 2.2 : 1;
  const hastened = affixes.includes('hastened');
  const maxHp = Math.round(def.hp * hpMult);
  const e = world.entities.spawn('enemy', {
    x,
    z,
    radius: tier === 'elite' ? Math.min(2.5, def.radius * 1.15) : def.radius,
    height: tier === 'elite' ? def.height * 1.15 : def.height,
    speed: def.speed * (hastened ? 1.3 : 1),
    mass: tier === 'boss' || tier === 'miniboss' ? 0.05 : def.role === 'brute' ? 0.5 : 1,
    team: 'enemy',
    health: newHealth(maxHp, maxHp),
    enemy: {
      defId,
      role: def.role,
      tier,
      affixes,
      state: opts.instant ? 'approach' : 'spawning',
      stateTime: 0,
      targetId: null,
      threat: [0, 0, 0, 0, 0],
      attackCooldown: def.basic.interval * 0.5,
      specialCooldowns: def.specials.map((id) => attackDef(id).initialDelay),
      cast: null,
      phase: tier === 'boss' || tier === 'miniboss' ? 1 : 0,
      inField: false,
      auraMask: 0,
      damageMult: tier === 'elite' ? 1.25 : 1,
      windupMult: hastened ? 0.85 : 1,
      tauntTarget: null,
      tauntUntil: 0,
      lullabyTime: 0,
      sleepImmuneUntil: 0,
      engaged: false,
    },
  });
  if (affixes.includes('shielded')) addShield(world, e, 'discord', maxHp * 0.4, NEVER, false);
  world.events.push({ type: 'entitySpawned', tick: world.tick, id: e.id, kind: 'enemy' });
  return e;
}

export function updateEnemies(world: World, dt: number): void {
  const fighting = world.encounter.status === 'fighting';
  for (const e of world.entities.list()) {
    const c = e.enemy;
    const h = e.health;
    if (!c || !h || h.dead) continue;
    const def = enemyDef(c.defId);
    c.stateTime += dt;

    if (c.state === 'spawning') {
      e.vx = 0;
      e.vz = 0;
      if (c.stateTime >= SPAWN_TIME) setState(c, 'approach');
      continue;
    }
    if (!fighting) {
      approachVelocity(e, 0, 0, ENEMY_ACCEL, dt);
      continue;
    }
    if (!c.engaged) engage(world, e);

    // Lullaby: slower, and (Heavy Eyelids) sleepy.
    const slow = enemyFx(world, e).enemySlow;
    const speed = e.speed * (1 - slow);
    if (
      world.mods.heavyEyelidsSleep > 0 &&
      c.tier === 'normal' &&
      hasAura(world, c.auraMask, 'lullaby')
    ) {
      c.lullabyTime += dt;
      if (c.lullabyTime >= 4 && world.time >= c.sleepImmuneUntil) {
        addStatus(world, e, 'sleep', world.mods.heavyEyelidsSleep, world.weaverId);
        c.lullabyTime = 0;
        c.sleepImmuneUntil = world.time + 15;
      }
    } else c.lullabyTime = 0;

    if (isDisabled(e)) {
      approachVelocity(e, 0, 0, ENEMY_ACCEL * 2, dt);
      continue;
    }
    if (c.attackCooldown > 0) c.attackCooldown -= dt;
    for (let i = 0; i < c.specialCooldowns.length; i++) {
      if (c.specialCooldowns[i]! > 0) c.specialCooldowns[i] = c.specialCooldowns[i]! - dt;
    }

    if (c.cast) {
      updateCast(world, e, def, dt);
      continue;
    }
    if (c.state === 'recover') {
      approachVelocity(e, 0, 0, ENEMY_ACCEL, dt);
      if (c.stateTime >= 0.5) setState(c, 'approach');
      continue;
    }

    c.targetId = pickEnemyTarget(world, e);
    const target = c.targetId === null ? undefined : world.entities.get(c.targetId);
    if (!isActive(target)) {
      approachVelocity(e, 0, 0, ENEMY_ACCEL, dt);
      continue;
    }
    if (trySpecial(world, e, def, target)) continue;

    // Approach to basic range (casters keep their distance), then attack.
    const reach = def.basic.range + e.radius + target.radius;
    const d = len(target.x - e.x, target.z - e.z);
    const keep = def.preferredRange > 0 ? Math.max(def.preferredRange, reach * 0.6) : reach - 0.25;
    if (d > keep) {
      const k = (d - keep) / d;
      arriveAt(e, e.x + (target.x - e.x) * k, e.z + (target.z - e.z) * k, speed, dt);
      setState(c, 'approach');
    } else {
      approachVelocity(e, 0, 0, ENEMY_ACCEL, dt);
      face(e, target);
    }
    if (d <= reach + 0.15 && c.attackCooldown <= 0) basicAttack(world, e, def, target);
  }
}

function setState(
  c: NonNullable<Entity['enemy']>,
  state: NonNullable<Entity['enemy']>['state'],
): void {
  if (c.state !== state) {
    c.state = state;
    c.stateTime = 0;
  }
}

function arriveAt(e: Entity, x: number, z: number, speed: number, dt: number): void {
  const base = e.speed;
  e.speed = speed;
  arrive(e, x, z, ENEMY_ACCEL, 1, dt);
  e.speed = base;
}

function face(e: Entity, target: Entity): void {
  const dx = target.x - e.x;
  const dz = target.z - e.z;
  const m = len(dx, dz);
  if (m > 0.05) {
    e.fx = dx / m;
    e.fz = dz / m;
  }
}

/** On first contact, threat starts by proximity; divers favour whoever is casting. */
function engage(world: World, e: Entity): void {
  const c = e.enemy!;
  c.engaged = true;
  for (let i = 0; i <= WEAVER_THREAT_INDEX; i++) {
    const id = i === WEAVER_THREAT_INDEX ? world.weaverId : world.party[i];
    const p = id === undefined ? undefined : world.entities.get(id);
    if (!isActive(p)) continue;
    const d = len(p.x - e.x, p.z - e.z);
    let base = Math.max(1, 30 - d) * 2;
    if (p.hero && c.role === 'swarm' && p.hero.defId === 'vexis') base *= 2;
    c.threat[i] = (c.threat[i] ?? 0) + base;
  }
}

function basicAttack(world: World, e: Entity, def: EnemyDef, target: Entity): void {
  const c = e.enemy!;
  c.attackCooldown = def.basic.interval * (c.affixes.includes('hastened') ? 0.85 : 1);
  setState(c, 'attack');
  const amount = def.basic.damage * c.damageMult * enrageMult(world, c.tier);
  face(e, target);
  if (def.basic.kind === 'melee') {
    world.events.push({
      type: 'attackFired',
      tick: world.tick,
      source: e.id,
      target: target.id,
      visual: 'melee',
      fromX: e.x,
      fromZ: e.z,
      toX: target.x,
      toZ: target.z,
      travel: 0,
    });
    dealDamage(world, target, { source: e.id, sourceName: def.name, amount });
    return;
  }
  const d = len(target.x - e.x, target.z - e.z);
  const travel = d / 16;
  world.internal.pendingHits.push({
    at: world.time + travel,
    source: e.id,
    target: target.id,
    amount,
    amplified: 0,
    crit: false,
    splashRadius: 0,
    splash: 0,
    chain: 0,
    empowered: false,
    stun: 0,
  });
  world.events.push({
    type: 'attackFired',
    tick: world.tick,
    source: e.id,
    target: target.id,
    visual: 'bolt',
    fromX: e.x,
    fromZ: e.z,
    toX: target.x,
    toZ: target.z,
    travel,
  });
}

export function enrageMult(world: World, tier: EnemyTier): number {
  return (tier === 'boss' || tier === 'miniboss') && world.internal.boss.enraged ? 2.5 : 1;
}

function activeNormalTelegraphs(world: World): number {
  let n = 0;
  for (const t of world.telegraphs) {
    const owner = world.entities.get(t.owner);
    if (owner?.enemy && owner.enemy.tier !== 'boss' && owner.enemy.tier !== 'miniboss') n++;
  }
  return n;
}

/** Specials handled by boss scripts instead of the generic picker. */
const SCRIPTED = new Set(['cantor_silent_verse', 'cantor_requiem']);

function trySpecial(world: World, e: Entity, def: EnemyDef, target: Entity): boolean {
  const c = e.enemy!;
  const boss = c.tier === 'boss' || c.tier === 'miniboss';
  if (world.internal.boss.phaseShiftUntil > world.time && boss) return false;
  // A chained toll is coming: the boss script owns the next cast.
  if (boss && world.internal.boss.doubleTollAt > 0) return false;
  for (let i = 0; i < def.specials.length; i++) {
    if (c.specialCooldowns[i]! > 0) continue;
    const id = def.specials[i]!;
    if (SCRIPTED.has(id)) continue;
    const attack = attackDef(id);
    if (!boss && attack.effect === 'damage' && activeNormalTelegraphs(world) >= READABILITY_CAP) {
      c.specialCooldowns[i] = 1.5;
      continue;
    }
    if (beginAttack(world, e, attack, target)) {
      c.specialCooldowns[i] = attack.cooldown * cooldownMult(world, e);
      return true;
    }
  }
  return false;
}

function cooldownMult(world: World, e: Entity): number {
  const c = e.enemy!;
  if (c.defId === 'the_bellwarden' && c.phase >= 2) return 0.85;
  if (c.affixes.includes('hastened')) return 0.85;
  void world;
  return 1;
}

/**
 * Starts an attack: picks targets, builds the shape and the telegraph. Returns false if the
 * attack can't be used right now (no valid target in range).
 */
export function beginAttack(
  world: World,
  e: Entity,
  attack: AttackDef,
  current: Entity | null,
): boolean {
  const c = e.enemy!;
  const heroes: Entity[] = [];
  for (const id of world.party) {
    const hero = world.entities.get(id);
    if (isActive(hero)) heroes.push(hero);
  }
  if (heroes.length === 0) return false;
  const inRange = (t: Entity) =>
    distSq(t.x, t.z, e.x, e.z) <= sq(attack.range + e.radius + t.radius);

  let target: Entity | null = null;
  let shape: TelegraphShape | null = null;
  switch (attack.targeting) {
    case 'current':
      target = current && inRange(current) ? current : null;
      break;
    case 'farthest': {
      let best = -1;
      for (const hero of heroes) {
        const d = distSq(hero.x, hero.z, e.x, e.z);
        if (d > best && inRange(hero)) {
          best = d;
          target = hero;
        }
      }
      break;
    }
    case 'squishiest': {
      let best = Infinity;
      for (const hero of heroes) {
        if (hero.health!.maxHp < best && inRange(hero)) {
          best = hero.health!.maxHp;
          target = hero;
        }
      }
      break;
    }
    case 'randomHero':
    case 'randomNonTank': {
      const pool = heroes.filter(
        (hero) =>
          inRange(hero) &&
          !hero.health!.statuses.some((s) => s.id === 'dirge' || s.id === 'immune') &&
          (attack.targeting === 'randomHero' || hero.hero!.defId !== 'kael'),
      );
      const fallback = heroes.filter(
        (hero) => inRange(hero) && !hero.health!.statuses.some((s) => s.id === 'dirge'),
      );
      const from = pool.length > 0 ? pool : fallback;
      if (from.length > 0) target = from[world.rng.ai.int(from.length)]!;
      break;
    }
    case 'pair': {
      if (heroes.length < 2) return false;
      const a = world.rng.ai.int(heroes.length);
      let b = world.rng.ai.int(heroes.length - 1);
      if (b >= a) b++;
      shape = { kind: 'link', a: heroes[a]!.id, b: heroes[b]!.id, r: attack.radius };
      target = heroes[a]!;
      break;
    }
    case 'self':
    case 'allHeroes':
      target = current;
      break;
  }
  if (!target && attack.targeting !== 'self' && attack.targeting !== 'allHeroes') return false;

  if (!shape) {
    switch (attack.kind) {
      case 'cleave': {
        const t = target!;
        const dx = t.x - e.x;
        const dz = t.z - e.z;
        const d = len(dx, dz) || 1;
        shape = {
          kind: 'cone',
          x: e.x,
          z: e.z,
          r: attack.radius + e.radius,
          dirX: dx / d,
          dirZ: dz / d,
          halfAngleCos: dcos(((attack.angleDeg / 2) * Math.PI) / 180),
        };
        break;
      }
      case 'beam': {
        // The lance stops just past its target: a single-target threat, not a line wipe.
        const t = target!;
        const dx = t.x - e.x;
        const dz = t.z - e.z;
        const d = len(dx, dz) || 1;
        const reach = Math.min(attack.length, d + t.radius + 1.5);
        shape = {
          kind: 'line',
          x: e.x,
          z: e.z,
          toX: e.x + (dx / d) * reach,
          toZ: e.z + (dz / d) * reach,
          width: attack.width,
        };
        break;
      }
      case 'burst':
        shape = {
          kind: 'circle',
          x: e.x,
          z: e.z,
          r: attack.radius + (attack.effect === 'damage' ? e.radius : 0),
        };
        break;
      case 'donut':
        shape = {
          kind: 'donut',
          x: e.x,
          z: e.z,
          innerR: attack.innerRadius,
          outerR: attack.radius,
        };
        break;
      case 'mark':
        shape = { kind: 'mark', target: target!.id };
        break;
      case 'raid':
        shape = { kind: 'raid' };
        break;
      case 'link':
        return false;
    }
  }

  let windup = attack.windup * c.windupMult * world.config.assists.telegraphLead;
  // Lullaby: slower wind-ups, and a Perfect window widened in proportion.
  const lullaby = attack.effect === 'damage' ? enemyFx(world, e).enemyWindup : 0;
  windup *= 1 + lullaby;
  const scale = c.damageMult * enrageMult(world, c.tier);
  const t = startTelegraph(world, {
    owner: e,
    attack,
    target: attack.targeting === 'self' || attack.targeting === 'allHeroes' ? null : target,
    shape: shape!,
    windup,
    damage: attack.damage * scale,
    pctMaxHp: (attack.pctMaxHp ?? 0) * (c.tier === 'elite' ? 1.1 : 1),
    perfectWindowMult: 1 + lullaby,
  });
  if (attack.kind === 'mark' && target) addStatus(world, target, 'dirge', windup, e.id);
  if (shape!.kind === 'link') {
    for (const id of [shape!.a, shape!.b]) {
      const hero = world.entities.get(id);
      if (hero) addStatus(world, hero, 'resound', windup, e.id);
    }
  }
  if (attack.decree) {
    announceDecree(world, {
      type: 'decree',
      tick: world.tick,
      boss: e.id,
      name: attack.name,
      text: attack.decree,
      answers: [...attack.answers],
    });
  }
  c.cast = {
    attackId: attack.id,
    name: attack.name,
    telegraph: t.id,
    start: world.time,
    end: t.impact,
    interruptible: attack.interruptible,
  };
  c.state = attack.effect === 'healAllies' ? 'channel' : 'casting';
  c.stateTime = 0;
  if (target) face(e, target);
  e.vx = 0;
  e.vz = 0;
  return true;
}

const sq = (v: number) => v * v;

function updateCast(world: World, e: Entity, def: EnemyDef, dt: number): void {
  const c = e.enemy!;
  const cast = c.cast!;
  approachVelocity(e, 0, 0, ENEMY_ACCEL * 2, dt);
  // Mending Hymn heals in pulses while channelled.
  if (cast.attackId === 'acolyte_mending_hymn') {
    const attack = attackDef(cast.attackId);
    const before = Math.floor(c.stateTime - dt + 1e-9);
    const now = Math.floor(c.stateTime + 1e-9);
    if (now > before && now >= 1) {
      for (const m of world.entities.list()) {
        if (!m.enemy || !isActive(m)) continue;
        if (distSq(m.x, m.z, e.x, e.z) > sq(attack.radius)) continue;
        const missing = m.health.maxHp - m.health.hp;
        if (missing > 0) {
          m.health.hp += Math.min(missing, attack.damage);
          world.events.push({
            type: 'healApplied',
            tick: world.tick,
            target: m.id,
            source: e.id,
            amount: Math.min(missing, attack.damage),
            overheal: 0,
            via: 'other',
          });
        }
      }
    }
  }
  if (world.time >= cast.end - 1e-9) {
    c.cast = null;
    setState(c, 'recover');
  }
  void def;
}

/** Non-damage casts complete (called by telegraph resolution). */
function completeCast(world: World, owner: Entity, t: Telegraph): void {
  const attack = world.content.attacks.find((a) => a.id === t.attackId);
  if (!attack) return;
  if (attack.effect === 'summon' && attack.summon) {
    const n = attack.summon.count;
    for (let i = 0; i < n; i++) {
      const p = world.scratch.slot;
      ringPoint(world, owner.x, owner.z, 3 + owner.radius, i, n, p);
      world.internal.pendingSpawns.push({
        at: world.time + 0.6,
        defId: attack.summon.enemy,
        x: p.x,
        z: p.z,
        elite: false,
        affixes: [],
        wave: world.encounter.wave,
      });
      world.events.push({ type: 'spawnWarning', tick: world.tick, x: p.x, z: p.z, delay: 0.6 });
    }
  }
  if (attack.effect === 'suppress') beginSilentVerse(world);
  if (attack.id === 'bellwarden_toll_out' && owner.enemy && owner.enemy.phase >= 2) {
    // The cracked bell rings twice: Outward, then Inward.
    world.internal.boss.doubleTollAt = world.time + 1.1;
  }
  // healAllies pulses during the channel.
}

/** Silent Verse: auras only work inside three hymn circles. */
export function beginSilentVerse(world: World): void {
  const r = world.arenaRadius * 0.45;
  world.field.hymnCircles = [
    { x: 0, z: -r, r: 3.6 },
    { x: -r * 0.866, z: r * 0.5, r: 3.6 },
    { x: r * 0.866, z: r * 0.5, r: 3.6 },
  ];
  world.internal.boss.nextCircleShiftAt = world.time + 14;
}

/** Evenly spaced point i of n on a ring (deterministic trig). */
export function ringPoint(
  world: World,
  cx: number,
  cz: number,
  r: number,
  i: number,
  n: number,
  out: { x: number; z: number },
): void {
  const a = (i / n) * 2 * Math.PI + world.rng.ai.float() * 0.6;
  out.x = cx + dcos(a) * r;
  out.z = cz + dcos(a - Math.PI / 2) * r;
  const d = len(out.x, out.z);
  const max = world.arenaRadius - 1.5;
  if (d > max) {
    out.x = (out.x / d) * max;
    out.z = (out.z / d) * max;
  }
}

/** Volatile: shatters 3 s after death. */
function onDeath(world: World, e: Entity): void {
  const c = e.enemy!;
  if (!c.affixes.includes('volatile')) return;
  const t: Telegraph = {
    id: world.internal.nextTelegraphId++,
    owner: e.id,
    target: null,
    attackId: 'volatile_burst',
    name: 'Shatter',
    kind: 'burst',
    shape: { kind: 'circle', x: e.x, z: e.z, r: 5 },
    start: world.time,
    impact: world.time + 3,
    perfectFrom: world.time + 3 - perfectWindow(world),
    damage: 260,
    pctMaxHp: 0,
    effect: 'damage',
    answers: ['move', 'reel'],
    severity: 'normal',
  };
  world.telegraphs.push(t);
  countAimed(world, t);
  world.events.push({
    type: 'telegraphStarted',
    tick: world.tick,
    telegraph: t.id,
    owner: t.owner,
    target: null,
    name: t.name,
    kind: t.kind,
    shape: t.shape,
    start: t.start,
    impact: t.impact,
    perfectFrom: t.perfectFrom,
    damage: t.damage,
    pctMaxHp: 0,
    answers: t.answers,
    effect: 'damage',
  });
}

setOnEnemyDeath(onDeath);
setOnCastComplete(completeCast);
