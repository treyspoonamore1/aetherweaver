/**
 * The aura field (docs/plan/03 §3): auras reserve Spirit and affect everyone inside the
 * Weaver's field. Mutes crack it (no auras inside their dome; none at all if the Weaver
 * stands in one); during the Silent Verse only the hymn circles carry the song.
 */
import { auraDef, enemyDef } from '../../content';
import type { AuraDef } from '../../content/schema';
import { distSq } from '../core/dmath';
import { addShield, heal, removeShield, shieldOf, NEVER } from '../combat/health';
import type { Entity } from '../state';
import { weaverOf, type World } from '../world';

const AURA_FLUSH_TICKS = 60;

export interface AuraTotals {
  regenPctPerSec: number;
  barrierPct: number;
  attackSpeed: number;
  moveSpeed: number;
  damage: number;
  flatDamage: number;
  enemySlow: number;
  enemyWindup: number;
}

const ZERO: AuraTotals = {
  regenPctPerSec: 0,
  barrierPct: 0,
  attackSpeed: 0,
  moveSpeed: 0,
  damage: 0,
  flatDamage: 0,
  enemySlow: 0,
  enemyWindup: 0,
};

/** Current aura totals for someone standing in the field (zero outside it). */
export function fieldEffects(world: World): AuraTotals {
  if (world.field.auras.length === 0) return ZERO;
  const mult = world.field.crescendo ? world.content.crescendo.auraEffectMult : 1;
  const out: AuraTotals = { ...ZERO };
  for (const id of world.field.auras) {
    const def: AuraDef = auraDef(id);
    const fx = def.effects;
    let regen = fx.regenPctPerSec;
    if (id === 'sostenuto') regen *= world.mods.sostenutoMult;
    let attackSpeed = fx.attackSpeed;
    if (id === 'allegro') attackSpeed += world.mods.allegroBonus;
    out.regenPctPerSec += regen * mult;
    out.barrierPct += fx.barrierPct * mult;
    out.attackSpeed += attackSpeed * mult;
    out.moveSpeed += fx.moveSpeed * mult;
    out.damage += fx.damage * mult;
    out.flatDamage += fx.flatDamage * mult;
    out.enemySlow += fx.enemySlow * mult;
    out.enemyWindup += fx.enemyWindup * mult;
  }
  out.enemySlow = Math.min(0.6, out.enemySlow);
  return out;
}

/** Alias kept for call sites that read the field's effects. */
export const fieldFx = fieldEffects;

function insideField(world: World, e: Entity): boolean {
  const f = world.field;
  if (f.suppressed) return false;
  if (distSq(e.x, e.z, f.x, f.z) > (f.radius + e.radius) * (f.radius + e.radius)) return false;
  // Mute domes silence the song inside them.
  for (const m of world.entities.list()) {
    const enemy = m.enemy;
    if (!enemy || m.health?.dead) continue;
    const r = enemyDef(enemy.defId).suppressRadius;
    if (r > 0 && distSq(e.x, e.z, m.x, m.z) <= r * r) return false;
  }
  if (f.hymnCircles.length > 0) {
    let inCircle = false;
    for (const c of f.hymnCircles) {
      if (distSq(e.x, e.z, c.x, c.z) <= (c.r + e.radius) * (c.r + e.radius)) {
        inCircle = true;
        break;
      }
    }
    if (!inCircle) return false;
  }
  return true;
}

export function updateField(world: World, dt: number): void {
  const weaver = weaverOf(world);
  const f = world.field;
  f.x = weaver.x;
  f.z = weaver.z;
  const base = world.content.weaver.fieldRadius * world.mods.fieldRadiusMult;
  f.radius = base * (f.crescendo ? world.content.crescendo.radiusMult : 1);

  let suppressed = weaver.health!.downed;
  if (!suppressed) {
    for (const m of world.entities.list()) {
      if (!m.enemy || m.health?.dead) continue;
      const r = enemyDef(m.enemy.defId).suppressRadius;
      if (r > 0 && distSq(weaver.x, weaver.z, m.x, m.z) <= r * r) {
        suppressed = true;
        break;
      }
    }
  }
  f.suppressed = suppressed;

  const fx = fieldFx(world);
  const flush = world.tick % AURA_FLUSH_TICKS === 0;
  const refill = Math.max(0.5, 3 - world.mods.ostinatoRefillCut);

  for (const id of world.party) {
    const hero = world.entities.get(id);
    if (!hero?.hero || !hero.health) continue;
    const inField = !hero.health.dead && !hero.health.downed && insideField(world, hero);
    hero.hero.inField = inField;
    applyAuraLife(world, hero, inField, fx, dt, flush, refill);
  }
  applyAuraLife(world, weaver, !weaver.health!.downed && !f.suppressed, fx, dt, flush, refill);

  for (const e of world.entities.list()) {
    if (e.enemy && e.health && !e.health.dead)
      e.enemy.inField = !f.suppressed && insideField(world, e);
  }
}

function applyAuraLife(
  world: World,
  e: Entity,
  inField: boolean,
  fx: AuraTotals,
  dt: number,
  flush: boolean,
  refill: number,
): void {
  const h = e.health!;
  if (inField && fx.regenPctPerSec > 0 && h.hp < h.maxHp) {
    const healed = heal(world, e, h.maxHp * fx.regenPctPerSec * dt, 'aura', false);
    if (e.hero) e.hero.auraHealAcc += healed;
  }
  if (flush && e.hero && e.hero.auraHealAcc > 0.5) {
    world.events.push({
      type: 'healApplied',
      tick: world.tick,
      target: e.id,
      source: world.weaverId,
      amount: e.hero.auraHealAcc,
      overheal: 0,
      via: 'aura',
    });
    e.hero.auraHealAcc = 0;
  }
  const barrier = shieldOf(h, 'barrier');
  if (!inField || fx.barrierPct <= 0) {
    if (barrier) removeShield(world, e, 'barrier', false);
    return;
  }
  const max = h.maxHp * fx.barrierPct;
  if (world.time - h.lastHitAt < refill) return;
  if (!barrier) addShield(world, e, 'barrier', max, NEVER, true);
  else if (barrier.amount < max - 0.5 || barrier.max !== max) {
    barrier.amount = max;
    barrier.max = max;
  }
}
