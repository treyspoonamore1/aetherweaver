/**
 * The encounter director (docs/plan/03 §9): waves with spawn warnings, the next wave when
 * the current one is (almost) cleared, victory and defeat.
 */
import { encounterDef, enemyDef } from '../../content';
import { len } from '../core/dmath';
import { isActive, killEnemy } from '../combat/health';
import { setTimeScale } from '../combat/feedback';
import type { Entity } from '../state';
import type { World } from '../world';
import { bossPhases } from './bosses';
import { onPackArrived } from './heroes';
import { spawnEnemy } from './enemies';

const WARNING = 1.2;

export function updateDirector(world: World): void {
  const enc = world.encounter;
  const def = encounterDef(enc.id);
  const d = world.internal.director;

  // Spawn portals that have finished opening.
  if (world.internal.pendingSpawns.length > 0) {
    const pack: Entity[] = [];
    for (let i = 0; i < world.internal.pendingSpawns.length;) {
      const p = world.internal.pendingSpawns[i]!;
      if (p.at > world.time + 1e-9) {
        i++;
        continue;
      }
      world.internal.pendingSpawns.splice(i, 1);
      if (enc.status === 'victory' || enc.status === 'defeat') continue;
      const e = spawnEnemy(world, p.defId, p.x, p.z, { elite: p.elite, affixes: p.affixes });
      pack.push(e);
      d.spawned++;
      if (d.firstSpawnAt === null) d.firstSpawnAt = world.time;
      const role = enemyDef(p.defId).role;
      if (role === 'boss' || role === 'miniboss') {
        enc.bossId = e.id;
        if (def.enrage !== undefined) enc.enrageAt = world.time + def.enrage;
        void bossPhases;
      }
    }
    if (pack.length > 0) onPackArrived(world, pack);
  }

  if (enc.kind === 'sandbox' || enc.status === 'victory' || enc.status === 'defeat') return;

  if (enc.status === 'intro') {
    if (d.nextWaveAt === null) d.nextWaveAt = def.waves[0]?.delay ?? 0;
    if (world.time >= d.nextWaveAt) {
      enc.status = 'fighting';
      enc.startedAt = world.time;
    } else return;
  }

  // Next wave: on schedule, or once the current one has thinned out.
  if (d.nextWave < def.waves.length) {
    if (d.nextWaveAt === null && waveThinned(world)) {
      d.nextWaveAt = world.time + def.waves[d.nextWave]!.delay;
    }
    if (d.nextWaveAt !== null && world.time >= d.nextWaveAt) startWave(world, d.nextWave);
  }
}

function aliveEnemies(world: World): { count: number; hp: number } {
  let count = 0;
  let hp = 0;
  for (const e of world.entities.list()) {
    if (e.enemy && e.health && !e.health.dead) {
      count++;
      hp += e.health.hp;
    }
  }
  return { count, hp };
}

function waveThinned(world: World): boolean {
  if (world.internal.pendingSpawns.length > 0) return false;
  const { count, hp } = aliveEnemies(world);
  return count === 0 || hp <= world.internal.director.waveHp * 0.15 || count <= 1;
}

function startWave(world: World, index: number): void {
  const def = encounterDef(world.encounter.id);
  const wave = def.waves[index]!;
  const d = world.internal.director;
  d.nextWave = index + 1;
  d.nextWaveAt = null;
  d.waveHp = 0;
  world.encounter.wave = index + 1;
  world.events.push({
    type: 'waveStarted',
    tick: world.tick,
    wave: index + 1,
    waves: def.waves.length,
  });
  // Portals open on the far side of the arena from the Weaver, spread along an arc.
  const weaver = world.entities.get(world.weaverId);
  const wx = weaver?.x ?? 0;
  const wz = weaver?.z ?? 0;
  const wl = len(wx, wz);
  const awayX = wl > 0.5 ? -wx / wl : 0;
  const awayZ = wl > 0.5 ? -wz / wl : -1;
  let n = 0;
  for (const s of wave.spawns) n += s.count;
  let i = 0;
  for (const s of wave.spawns) {
    const role = enemyDef(s.enemy).role;
    const boss = role === 'boss' || role === 'miniboss';
    for (let k = 0; k < s.count; k++) {
      const p = world.scratch.slot;
      if (boss) {
        p.x = awayX * world.arenaRadius * 0.35;
        p.z = awayZ * world.arenaRadius * 0.35;
      } else {
        arcPoint(world, awayX, awayZ, i, n, p);
      }
      i++;
      world.internal.pendingSpawns.push({
        at: world.time + WARNING,
        defId: s.enemy,
        x: p.x,
        z: p.z,
        elite: s.elite,
        affixes: [...s.affixes],
        wave: index + 1,
      });
      d.waveHp += enemyDef(s.enemy).hp * (s.elite ? 2.2 : 1);
      world.events.push({ type: 'spawnWarning', tick: world.tick, x: p.x, z: p.z, delay: WARNING });
    }
  }
}

/** Point i of n along an arc of the arena edge centred on (dirX, dirZ). No trig: rotate by steps. */
function arcPoint(
  world: World,
  dirX: number,
  dirZ: number,
  i: number,
  n: number,
  out: { x: number; z: number },
): void {
  // Spread across ±70°, using the tangent direction and renormalising (deterministic).
  const t = n <= 1 ? 0 : (i / (n - 1)) * 2 - 1;
  const spread = 1.6 * t + (world.rng.ai.float() - 0.5) * 0.25;
  const tx = -dirZ;
  const tz = dirX;
  let x = dirX + tx * spread;
  let z = dirZ + tz * spread;
  const m = len(x, z);
  x /= m;
  z /= m;
  const r = world.arenaRadius * (0.78 + world.rng.ai.float() * 0.12);
  out.x = x * r;
  out.z = z * r;
}

/** Victory when everything is dead (or the boss is), defeat when no hero is standing. */
export function checkEncounterEnd(world: World): void {
  const enc = world.encounter;
  if (enc.kind === 'sandbox' || enc.status !== 'fighting') return;
  // Defeat when nobody is standing — unless the Weaver is still up and someone can still be
  // revived: that last-ditch revive under pressure is one of the game's best moments.
  let standing = 0;
  let revivable = 0;
  for (const id of world.party) {
    const e = world.entities.get(id);
    if (isActive(e)) standing++;
    else if (e?.health?.downed && !e.health.dead) revivable++;
  }
  const weaverUp = isActive(world.entities.get(world.weaverId));
  if (standing === 0 && (revivable === 0 || !weaverUp)) {
    endEncounter(world, 'defeat');
    return;
  }
  const def = encounterDef(enc.id);
  if (enc.bossId !== null) {
    const boss = world.entities.get(enc.bossId);
    if (!boss || boss.health?.dead) {
      for (const e of world.entities.list()) {
        if (e.enemy && e.health && !e.health.dead) killEnemy(world, e, null);
      }
      endEncounter(world, 'victory');
    }
    return;
  }
  const d = world.internal.director;
  if (
    d.nextWave >= def.waves.length &&
    world.internal.pendingSpawns.length === 0 &&
    aliveEnemies(world).count === 0
  ) {
    endEncounter(world, 'victory');
  }
}

function endEncounter(world: World, outcome: 'victory' | 'defeat'): void {
  const enc = world.encounter;
  enc.status = outcome;
  enc.endedAt = world.time;
  for (let i = world.telegraphs.length - 1; i >= 0; i--) {
    const t = world.telegraphs[i]!;
    world.events.push({
      type: 'telegraphResolved',
      tick: world.tick,
      telegraph: t.id,
      target: null,
      outcome: 'cancelled',
      damage: 0,
    });
    world.events.push({ type: 'telegraphEnded', tick: world.tick, telegraph: t.id });
  }
  world.telegraphs.length = 0;
  world.internal.reelDodges = [];
  world.internal.pendingHits.length = 0;
  world.field.hymnCircles = [];
  world.events.push({ type: 'encounterEnded', tick: world.tick, outcome });
  if (outcome === 'defeat') setTimeScale(world, 0.3, 90, 'defeat');
}
