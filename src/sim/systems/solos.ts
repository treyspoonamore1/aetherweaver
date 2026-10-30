/**
 * Solos (docs/plan/03 §5): each hero's signature move. They charge by fighting and, at 100,
 * wait for the Weaver's Cue, which fires them in their stronger *cued* form.
 */
import { heroDef } from '../../content';
import type { HeroDef } from '../../content/schema';
import { distSq } from '../core/dmath';
import { addShield, interruptEnemy, isActive, rising, shieldOf } from '../combat/health';
import { bark } from '../combat/feedback';
import type { Entity } from '../state';
import type { World } from '../world';
import { hasTalent, ricochet, soloValue, talentFired, talentHolder, talentValue } from '../bonds';
import { inAnyField } from './field';
import { attackRange, heroDamage } from './heroDamage';

/** The Solo a hero brings this fight: their own, or the alternate their Bond opened. */
export function soloSpec(
  world: World,
  hero: Entity,
): { id: string; name: string; chargeTime: number; duration: number } {
  const h = hero.hero!;
  const own = heroDef(h.defId).solo;
  if (h.soloId === own.id) return own;
  const alt = world.content.altSolos.find((s) => s.id === h.soloId)!;
  return { id: alt.id, name: alt.name, chargeTime: alt.chargeTime, duration: alt.values.seconds! };
}

/** How long a Solo lasts: a cued one longer with the Choirmaster's Baton. */
export function soloLength(world: World, hero: Entity, cued: boolean): number {
  return soloSpec(world, hero).duration * (cued ? world.mods.cuedSoloDurationMult : 1);
}

export function startSolo(world: World, hero: Entity, cued: boolean): void {
  const h = hero.hero!;
  const def = heroDef(h.defId);
  const solo = def.solo;
  const spec = soloSpec(world, hero);
  const duration = soloLength(world, hero, cued);
  h.solo = 0;
  h.soloCued = cued;
  h.soloActive = duration;
  h.soloPulseAt = world.time;
  h.cast = null;
  h.castName = spec.name;
  h.castProgress = 0;
  h.dodge = null;
  world.events.push({
    type: 'soloStarted',
    tick: world.tick,
    hero: hero.id,
    solo: spec.id,
    cued,
    duration,
  });
  if (cued) bark(world, hero, 'cued', true);

  // The alternate Solos (Bonds): Hawk's Vigil answers attacks from now on; Celestial Sphere
  // wraps its heroes at once; Oathkeeper acts in the damage path while it lasts.
  if (spec.id === 'hawks_vigil') h.vigilSeen = world.internal.nextTelegraphId - 1;
  if (spec.id === 'celestial_sphere') celestialSphere(world, hero, cued, duration);
  if (spec.id === 'aegisWall') {
    if (cued) {
      for (const id of world.party) {
        const ally = world.entities.get(id);
        if (isActive(ally))
          addShield(world, ally, 'dome', ally.health.maxHp * solo.cuedPower, duration, true);
      }
      const weaver = world.entities.get(world.weaverId);
      if (isActive(weaver))
        addShield(world, weaver, 'dome', weaver.health.maxHp * solo.cuedPower, duration, true);
    } else {
      addShield(world, hero, 'overshield', hero.health!.maxHp * solo.power, solo.duration, false);
      if (hasTalent(hero, 'shieldbearer')) shieldbearer(world, hero, solo.power, solo.duration);
    }
    world.events.push({
      type: 'abilityUsed',
      tick: world.tick,
      source: hero.id,
      ability: solo.id,
      name: solo.name,
      x: hero.x,
      z: hero.z,
      radius: cued ? world.field.radius : 1.5,
    });
  }
}

/** Advances an active Solo. Returns true while the hero is rooted by it. */
export function updateSolo(world: World, hero: Entity, dt: number): boolean {
  const h = hero.hero!;
  const def = heroDef(h.defId);
  const id = h.soloId;
  h.soloActive = Math.max(0, h.soloActive - dt);
  h.castProgress = 1 - h.soloActive / Math.max(0.01, soloLength(world, hero, h.soloCued));
  if (id === 'galeBarrage') galeBarrage(world, hero, def);
  else if (id === 'starfall') starfall(world, hero, def);
  else if (id === 'hawks_vigil') hawksVigil(world, hero, def);
  if (h.soloActive <= 0) {
    finishSolo(world, hero);
    return false;
  }
  // Gale Barrage and Hawk's Vigil root Lyra unless cued; Starfall always roots Vexis; the
  // others never root.
  if (id === 'galeBarrage' || id === 'hawks_vigil') return !h.soloCued;
  return id === 'starfall';
}

/**
 * Keeps a Solo's clock running while the hero can't act (stunned, being Reeled): the Solo's
 * effects (domes, shields) run on their own clocks, so the Solo must end on time too.
 */
export function tickSoloClock(world: World, hero: Entity, dt: number): void {
  const h = hero.hero!;
  if (h.soloActive <= 0) return;
  h.soloActive = Math.max(0, h.soloActive - dt);
  if (h.soloActive <= 0) finishSolo(world, hero);
}

function finishSolo(world: World, hero: Entity): void {
  const h = hero.hero!;
  h.castName = null;
  h.castProgress = 0;
  world.events.push({ type: 'soloEnded', tick: world.tick, hero: hero.id });
  // Supernova (Bonds): Starfall ends in a nova where it last struck.
  if (h.soloId === 'starfall' && hasTalent(hero, 'supernova')) supernova(world, hero);
  if (h.soloId === 'aegisWall' && world.mods.bulwarksEchoPct > 0) {
    for (const id of world.party) {
      const ally = world.entities.get(id);
      if (isActive(ally)) {
        addShield(
          world,
          ally,
          'overshield',
          ally.health.maxHp * world.mods.bulwarksEchoPct,
          4,
          true,
        );
      }
    }
  }
}

const GALE_RATE = 1 / 12;
const STAR_RATE = 0.3;

function galeBarrage(world: World, hero: Entity, def: HeroDef): void {
  const h = hero.hero!;
  while (h.soloPulseAt <= world.time && h.soloActive > 0) {
    h.soloPulseAt += GALE_RATE;
    const range = attackRange(world, hero, def.attack.range) + 2;
    const target = nearestEnemy(world, hero, range, h.targetId);
    if (!target) continue;
    const base = h.soloCued ? def.solo.cuedPower : def.solo.power;
    const critBonus = h.soloCued ? 0.4 : 0;
    loose(world, hero, hero, target, def, heroDamage(world, hero, base, critBonus));
    // Storm Queen (Bonds): the hero you Thread looses an arrow with each of hers.
    if (hasTalent(hero, 'storm_queen')) {
      const slot = world.entities.get(world.weaverId)?.weaver?.threadSlot;
      const from =
        slot === null || slot === undefined
          ? undefined
          : world.entities.get(world.party[slot] ?? -1);
      if (isActive(from) && from.id !== hero.id) {
        const other = nearestEnemy(world, from, range, null);
        const pct = talentValue(world, 'storm_queen', 'pct') / 100;
        if (other)
          loose(world, hero, from, other, def, heroDamage(world, hero, base * pct, critBonus));
      }
    }
  }
}

/** One of Lyra's Solo arrows, from `from` (her, or the hero she shoots through). */
function loose(
  world: World,
  lyra: Entity,
  from: Entity,
  target: Entity,
  def: HeroDef,
  hit: ReturnType<typeof heroDamage>,
): void {
  const d = Math.sqrt(distSq(from.x, from.z, target.x, target.z));
  const travel = d / def.attack.projectileSpeed;
  world.internal.pendingHits.push({
    at: world.time + travel,
    source: lyra.id,
    target: target.id,
    amount: hit.amount,
    amplified: hit.amplified,
    aura: hit.aura,
    empower: hit.empower,
    crit: hit.crit,
    splashRadius: 0,
    splash: 0,
    chain: 0,
    empowered: hit.empowered,
    stun: 0,
    ...ricochet(world, lyra),
  });
  world.events.push({
    type: 'attackFired',
    tick: world.tick,
    source: lyra.id,
    target: target.id,
    visual: 'arrow',
    fromX: from.x,
    fromZ: from.z,
    toX: target.x,
    toZ: target.z,
    travel,
  });
}

function starfall(world: World, hero: Entity, def: HeroDef): void {
  const h = hero.hero!;
  while (h.soloPulseAt <= world.time && h.soloActive > 0) {
    h.soloPulseAt += STAR_RATE;
    const target = h.soloCued ? randomEnemyInField(world) : randomEnemyNear(world, hero, 12);
    if (!target) continue;
    h.strikeX = target.x;
    h.strikeZ = target.z;
    const base = h.soloCued ? def.solo.cuedPower : def.solo.power;
    const hit = heroDamage(world, hero, base, 0);
    const travel = 0.45;
    world.internal.pendingHits.push({
      at: world.time + travel,
      source: hero.id,
      target: target.id,
      amount: hit.amount,
      amplified: hit.amplified,
      aura: hit.aura,
      empower: hit.empower,
      crit: hit.crit,
      splashRadius: 2.5,
      splash: 1,
      chain: 0,
      empowered: hit.empowered,
      stun: h.soloCued ? 0.5 : 0,
    });
    world.events.push({
      type: 'attackFired',
      tick: world.tick,
      source: hero.id,
      target: target.id,
      visual: 'meteor',
      fromX: target.x,
      fromZ: target.z,
      toX: target.x,
      toZ: target.z,
      travel,
    });
  }
}

export function nearestEnemy(
  world: World,
  from: Entity,
  range: number,
  prefer: number | null,
): Entity | null {
  if (prefer !== null) {
    const p = world.entities.get(prefer);
    if (
      p?.enemy &&
      isActive(p) &&
      !rising(p) &&
      distSq(p.x, p.z, from.x, from.z) <= (range + p.radius) * (range + p.radius)
    )
      return p;
  }
  let best: Entity | null = null;
  let bestD = Infinity;
  for (const e of world.entities.list()) {
    if (!e.enemy || !isActive(e) || rising(e)) continue;
    const d = distSq(e.x, e.z, from.x, from.z);
    if (d < bestD && d <= (range + e.radius) * (range + e.radius)) {
      best = e;
      bestD = d;
    }
  }
  return best;
}

function randomEnemyNear(world: World, from: Entity, range: number): Entity | null {
  const ids = world.scratch.ids;
  ids.length = 0;
  for (const e of world.entities.list()) {
    if (e.enemy && isActive(e) && distSq(e.x, e.z, from.x, from.z) <= range * range) ids.push(e.id);
  }
  if (ids.length === 0) return null;
  return world.entities.get(ids[world.rng.combat.int(ids.length)]!) ?? null;
}

/** Cued Starfall: meteors fall inside your fields (around the Weaver if there are none). */
function randomEnemyInField(world: World): Entity | null {
  const ids = world.scratch.ids;
  ids.length = 0;
  const f = world.field;
  const anyField = f.chords.some((c) => c.radius > 0);
  const r = f.radius + 2;
  for (const e of world.entities.list()) {
    if (!e.enemy || !isActive(e)) continue;
    const inside = anyField ? inAnyField(world, e.x, e.z, 2) : distSq(e.x, e.z, f.x, f.z) <= r * r;
    if (inside) ids.push(e.id);
  }
  if (ids.length === 0) return null;
  return world.entities.get(ids[world.rng.combat.int(ids.length)]!) ?? null;
}

/** Shieldbearer (Bonds): Kael's uncued Aegis Wall also shields the heroes beside him. */
function shieldbearer(world: World, kael: Entity, power: number, duration: number): void {
  const radius = talentValue(world, 'shieldbearer', 'radius');
  const share = talentValue(world, 'shieldbearer', 'pct') / 100;
  for (const id of world.party) {
    const ally = world.entities.get(id);
    if (!isActive(ally) || ally.id === kael.id) continue;
    if (distSq(ally.x, ally.z, kael.x, kael.z) > radius * radius) continue;
    const amount = ally.health.maxHp * power * share;
    // One overshield per hero: never trade a bigger one for this.
    const existing = shieldOf(ally.health, 'overshield');
    if (!existing || existing.amount < amount)
      addShield(world, ally, 'overshield', amount, duration, false);
  }
  talentFired(world, kael, 'shieldbearer', kael.x, kael.z);
}

/** Supernova (Bonds): Starfall's last meteor bursts into a nova. */
function supernova(world: World, vexis: Entity): void {
  const h = vexis.hero!;
  const def = heroDef(h.defId);
  const radius = talentValue(world, 'supernova', 'radius');
  const target = nearestTo(world, h.strikeX, h.strikeZ, radius);
  if (!target) return;
  const meteor = h.soloCued ? def.solo.cuedPower : def.solo.power;
  const hit = heroDamage(world, vexis, meteor * talentValue(world, 'supernova', 'meteors'), 0);
  world.internal.pendingHits.push({
    at: world.time + 0.3,
    source: vexis.id,
    target: target.id,
    amount: hit.amount,
    amplified: hit.amplified,
    aura: hit.aura,
    empower: hit.empower,
    crit: hit.crit,
    splashRadius: radius,
    splash: 1,
    chain: 0,
    empowered: hit.empowered,
    stun: 0,
  });
  talentFired(world, vexis, 'supernova', h.strikeX, h.strikeZ, target.id);
}

/**
 * Hawk's Vigil (Bonds, Lyra's alternate Solo): she shoots every enemy that starts an attack
 * within her reach, once each, interrupting what she can; cued, her shots mark them too.
 */
function hawksVigil(world: World, lyra: Entity, def: HeroDef): void {
  const h = lyra.hero!;
  const range = attackRange(world, lyra, def.attack.range) + 2;
  const power = soloValue(world, 'hawks_vigil', 'power');
  for (const t of world.telegraphs) {
    if (t.id <= h.vigilSeen) continue;
    h.vigilSeen = t.id;
    const owner = t.owner === null ? undefined : world.entities.get(t.owner);
    if (!owner?.enemy || !isActive(owner) || rising(owner)) continue;
    if (distSq(owner.x, owner.z, lyra.x, lyra.z) > (range + owner.radius) ** 2) continue;
    loose(world, lyra, lyra, owner, def, heroDamage(world, lyra, def.attack.damage * power, 0));
    if (owner.enemy.cast?.interruptible) interruptEnemy(world, owner, lyra.id);
    if (h.soloCued) owner.enemy.markedUntil = world.time + soloValue(world, 'hawks_vigil', 'mark');
    talentFired(world, lyra, 'hawks_vigil', owner.x, owner.z, owner.id);
  }
}

/**
 * Celestial Sphere (Bonds, Vexis's alternate Solo): a sphere that swallows hits whole, on the
 * hero you Thread (on her, if you Thread no one); cued, on every hero in your field.
 */
function celestialSphere(world: World, vexis: Entity, cued: boolean, duration: number): void {
  const hits = soloValue(world, 'celestial_sphere', 'hits');
  const give = (e: Entity) => {
    e.hero!.sphereHits = hits;
    e.hero!.sphereUntil = world.time + duration;
    e.hero!.sphereCued = cued;
  };
  if (cued) {
    for (const id of world.party) {
      const e = world.entities.get(id);
      if (isActive(e) && e.hero && (e.hero.inField || e.id === vexis.id)) give(e);
    }
    return;
  }
  const slot = world.entities.get(world.weaverId)?.weaver?.threadSlot;
  const threaded =
    slot === null || slot === undefined ? undefined : world.entities.get(world.party[slot] ?? -1);
  give(isActive(threaded) && threaded.hero ? threaded : vexis);
}

/**
 * Constellation (Bonds): a Cue leaves a star where the hero stands, casting Vexis's arcane bolt
 * for a while.
 */
export function placeStar(world: World, at: Entity): void {
  const vexis = talentHolder(world, 'constellation');
  if (!isActive(vexis)) return;
  world.internal.stars.push({
    x: at.x,
    z: at.z,
    source: vexis.id,
    until: world.time + talentValue(world, 'constellation', 'seconds'),
    nextAt: world.time + talentValue(world, 'constellation', 'interval'),
  });
  talentFired(world, vexis, 'constellation', at.x, at.z, at.id);
}

/** The stars a Cue left cast their bolts, then fade. */
export function updateStars(world: World): void {
  const stars = world.internal.stars;
  if (stars.length === 0) return;
  const interval = Math.max(0.1, talentValue(world, 'constellation', 'interval'));
  for (let i = 0; i < stars.length;) {
    const star = stars[i]!;
    const vexis = world.entities.get(star.source);
    while (star.nextAt <= world.time + 1e-9 && star.nextAt <= star.until + 1e-9) {
      star.nextAt += interval;
      const target = vexis?.hero ? nearestTo(world, star.x, star.z, 10) : null;
      if (!vexis || !target) continue;
      const def = heroDef(vexis.hero!.defId);
      const hit = heroDamage(world, vexis, def.attack.damage, 0);
      const travel =
        Math.sqrt(distSq(star.x, star.z, target.x, target.z)) / def.attack.projectileSpeed;
      world.internal.pendingHits.push({
        at: world.time + travel,
        source: vexis.id,
        target: target.id,
        amount: hit.amount,
        amplified: hit.amplified,
        aura: hit.aura,
        empower: hit.empower,
        crit: hit.crit,
        splashRadius: 0,
        splash: 0,
        chain: def.attack.chain,
        empowered: hit.empowered,
        stun: 0,
      });
      world.events.push({
        type: 'attackFired',
        tick: world.tick,
        source: vexis.id,
        target: target.id,
        visual: 'bolt',
        fromX: star.x,
        fromZ: star.z,
        toX: target.x,
        toZ: target.z,
        travel,
      });
    }
    if (star.until <= world.time + 1e-9) stars.splice(i, 1);
    else i++;
  }
}

/** The enemy nearest a point, within a radius (not one standing up again). */
function nearestTo(world: World, x: number, z: number, radius: number): Entity | null {
  let best: Entity | null = null;
  let bestD = Infinity;
  for (const e of world.entities.list()) {
    if (!e.enemy || !isActive(e) || rising(e)) continue;
    const d = distSq(e.x, e.z, x, z);
    if (d < bestD && d <= (radius + e.radius) * (radius + e.radius)) {
      best = e;
      bestD = d;
    }
  }
  return best;
}
