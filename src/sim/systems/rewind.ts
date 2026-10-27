/**
 * The Chronomancer's Rewind (docs/phase-3e.md), in Reel's slot. Every hero's life and place are
 * remembered for a few seconds; Rewind sends one back to where they stood then, with the life
 * they had if that was more, and stands them back up if they went down since.
 */
import type { PartySlot } from '../commands';
import { PAST_SAMPLE_TICKS } from '../constants';
import { distSq } from '../core/dmath';
import { pushMarker } from '../combat/feedback';
import { heal, removeStatus, reviveHero } from '../combat/health';
import { recordSave } from '../combat/saves';
import { answered, cancelTelegraph, contains } from '../combat/telegraphs';
import type { Entity, PastSample } from '../state';
import type { World } from '../world';
import { heroForSlot, reject, spend, techCooldown, weaverReady } from './techniques';

/** Remembers every hero's life and place, a sample every 0.1 s (Chronomancer runs only). */
export function recordPast(world: World): void {
  if (world.mods.rewindSeconds <= 0 || world.tick % PAST_SAMPLE_TICKS !== 0) return;
  for (const id of world.party) {
    const e = world.entities.get(id);
    const h = e?.hero;
    if (!e?.health || !h || h.past.length === 0) continue;
    const sample = h.past[h.pastAt]!;
    sample.hp = e.health.hp;
    sample.x = e.x;
    sample.z = e.z;
    sample.up = !e.health.downed;
    h.pastAt = (h.pastAt + 1) % h.past.length;
  }
}

/** Where `hero` stood, and how much life they had, as far back as Rewind reaches. */
export function pastOf(hero: Entity): PastSample | null {
  const h = hero.hero;
  // The next slot to write is the oldest sample.
  return h && h.past.length > 0 ? h.past[h.pastAt]! : null;
}

export function castRewind(world: World, slot: PartySlot | undefined): void {
  const weaver = weaverReady(world, 'rewind');
  if (!weaver) return;
  const w = weaver.weaver!;
  const def = world.content.techniques.reel;
  const hero = heroForSlot(world, weaver, slot);
  const past = hero ? pastOf(hero) : null;
  // A hero down since before Rewind's reach can't be brought back by it.
  if (!hero || !past || (hero.health!.downed && !past.up)) return reject(world, 'rewind', 'target');
  const stasis = world.field.stasis;
  if (w.cooldowns.reel > 0 && !stasis) return reject(world, 'rewind', 'cooldown');
  if (distSq(hero.x, hero.z, weaver.x, weaver.z) > def.range * def.range)
    return reject(world, 'rewind', 'range');
  if (!spend(world, weaver, 'rewind', def.cost)) return;
  if (!stasis) {
    const cd = Math.max(
      1,
      techCooldown(world, world.mods.rewindCooldown - world.mods.reelCooldownCut),
    );
    w.cooldowns.reel = cd;
    w.cooldownTotals.reel = cd;
  }
  w.lastTechnique = 'reel';

  const h = hero.health!;
  const c = hero.hero!;
  const fromX = hero.x;
  const fromZ = hero.z;
  // Paradox undoes what's aimed at them; out of any other shape, it's a dodge, as for Reel.
  const cancelled = world.mods.paradox ? paradox(world, hero) : 0;
  for (const t of world.telegraphs) {
    if (contains(world, t, hero))
      world.internal.reelDodges.push({ telegraph: t.id, hero: hero.id });
  }
  hero.x = hero.px = past.x;
  hero.z = hero.pz = past.z;
  hero.vx = 0;
  hero.vz = 0;
  c.dodge = null;

  let restored = 0;
  const revived = h.downed;
  if (revived) {
    reviveHero(world, hero, 0);
    restored = h.hp + heal(world, hero, Math.max(0, past.hp - h.hp), 'rewind');
    world.ledger.calling.revived++;
    const fell = world.ledger.deaths.findLast((d) => d.hero === hero.id);
    recordSave(world, hero, 'rewind', restored, fell?.killer ?? 'a fall');
  } else if (past.hp > h.hp) {
    restored = heal(world, hero, past.hp - h.hp, 'rewind');
  }
  world.ledger.calling.rewound += restored;

  // Borrowed Time: a share of their Solo, too.
  if (world.mods.borrowedTimeSolo > 0 && c.soloActive <= 0 && c.solo < 100) {
    c.solo = Math.min(100, c.solo + world.mods.borrowedTimeSolo);
    if (c.solo >= 100) world.events.push({ type: 'soloReady', tick: world.tick, hero: hero.id });
  }

  pushMarker(world, 'rewind', c.slot);
  world.events.push({
    type: 'techniqueCast',
    tick: world.tick,
    technique: 'rewind',
    target: hero.id,
    x: hero.x,
    z: hero.z,
  });
  world.events.push({
    type: 'rewound',
    tick: world.tick,
    target: hero.id,
    fromX,
    fromZ,
    toX: hero.x,
    toZ: hero.z,
    restored,
    revived,
  });
  if (cancelled > 0)
    world.events.push({ type: 'paradox', tick: world.tick, target: hero.id, cancelled });
}

/**
 * Paradox: attacks aimed at `hero` (a mark on them, a link through them, a cleave or lance
 * at them) are cancelled; an area attack they stand in passes them by. Returns how many.
 */
function paradox(world: World, hero: Entity): number {
  let undone = 0;
  for (const t of [...world.telegraphs]) {
    if (t.effect !== 'damage') continue;
    const s = t.shape;
    const aimed =
      t.target === hero.id ||
      (s.kind === 'mark' && s.target === hero.id) ||
      (s.kind === 'link' && (s.a === hero.id || s.b === hero.id));
    if (aimed) {
      cancelTelegraph(world, t.id);
      answered(world);
      // Its mark goes with it.
      const marked = s.kind === 'link' ? [s.a, s.b] : s.kind === 'mark' ? [s.target] : [];
      for (const id of marked) {
        const e = world.entities.get(id);
        if (!e?.health) continue;
        const status = s.kind === 'link' ? 'resound' : 'dirge';
        if (e.health.statuses.some((x) => x.id === status))
          removeStatus(world, e, status, 'expired');
      }
      undone++;
    } else if (contains(world, t, hero)) {
      world.internal.spared.push({ telegraph: t.id, hero: hero.id });
      undone++;
    }
  }
  return undone;
}
