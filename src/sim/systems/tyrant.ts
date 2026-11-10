/**
 * Tyrant (docs/phase-6.md, "Tyrant"): on a Tyrant run, a boss or mini-boss entering a phase (the
 * fight's start counts as entering phase 1) takes up that phase's **borrowed attack**, an attack
 * of an ordinary foe of its road. It is announced by `tyrantEdict` as the phase begins, held in
 * `enemy.tyrant` (never in `specialCooldowns`, which lines up with the boss's own specials), and
 * cast through the generic picker (`trySpecial`, enemies.ts) under the usual cap on damaging
 * telegraphs shown at once, on its own cooldown × `tyrantCooldownMult`, first `tyrantFirst` s
 * after the phase begins. A phase shift replaces it with the next phase's.
 *
 * The Silent Conductor borrows nothing (the Finale's Weaver faces only its choir's answers): it
 * plays its own closing attacks earlier instead, Sforzando in the Overture and Downbeat in the
 * Mirror Choir on their own cadences, nothing in the Grand Silence, and in the last burn (and the
 * Postlude) the Downbeat and Sforzando on `TYRANT_BURN`'s cadences (`closingEvery`).
 *
 * Nothing borrowed silences, steals, shrinks or weakens an aura, and nothing summons (decision 5:
 * no Mute's dome, no Silencing, no Steal Verse). Every call site is behind `world.mods.tyrant`, so
 * no other fight has the key, the event or a draw.
 */
import { attackDef, enemyDef } from '../../content';
import { BURN_EVERY, TYRANT_BURN } from '../../content/crucible';
import { CONDUCTOR, DOWNBEAT, SFORZANDO } from '../../content/crucibleIds';
import { tyrantDecree } from '../../content/dissonance';
import type { Entity, TyrantHold } from '../state';
import type { World } from '../world';
import { beginAttack, READABILITY_CAP } from './enemies';

/** One phase's borrowed attack: its id, the foe it is borrowed from, and an own cadence. */
export interface TyrantEntry {
  attack: string;
  /** The enemy definition it is borrowed from (the boss's own for the Conductor). */
  from: string;
  /** Seconds between casts, instead of the attack's cooldown × the level's (the Conductor's). */
  every?: number;
}

/**
 * The table (docs/phase-6.md, checked from each boss in a scenario: `tests/sim/tyrant.test.ts`):
 * by boss, each phase's entry in order, `null` for a phase that borrows nothing.
 */
export const TYRANT_TABLE: Readonly<Record<string, readonly (TyrantEntry | null)[]>> = {
  // Movement I
  the_bellwarden: [
    { attack: 'lancer_lance', from: 'glass_lancer' },
    { attack: 'lamenter_dirge', from: 'lamenter' },
  ],
  the_hollow_cantor: [
    { attack: 'brute_toll_cleave', from: 'bell_brute' },
    { attack: 'lancer_lance', from: 'glass_lancer' },
    { attack: 'acolyte_mending_hymn', from: 'cantor_acolyte' },
  ],
  // Movement II
  // The doc's Leech · Latch (phase 2 here, phase 1 for Vharun) is swapped for the Hemomancer's
  // Blood Pact: its 1.8 m reach never meets a boss's tank, who stands at the boss's own longer
  // basic reach, so it was never cast (checked in a scenario, tests/sim/tyrant.test.ts).
  gorehound_matriarch: [
    { attack: 'impaler_charge', from: 'impaler' },
    { attack: 'hemomancer_blood_pact', from: 'hemomancer' },
  ],
  vharun_crimson_warden: [
    { attack: 'hemomancer_blood_pact', from: 'hemomancer' },
    { attack: 'impaler_charge', from: 'impaler' },
    // Not the Hemomancer's Pact: Vharun's Judgement stops Pacts on purpose.
    { attack: 'lamenter_dirge', from: 'lamenter' },
  ],
  // Movement III
  the_seamstress: [
    { attack: 'shears_dash', from: 'shears' },
    { attack: 'wraith_doubt', from: 'doubt_wraith' },
  ],
  the_unweaver: [
    { attack: 'null_rune', from: 'null_priest' },
    { attack: 'maw_inhale', from: 'void_maw' },
    { attack: 'wraith_doubt', from: 'doubt_wraith' },
  ],
  // The Finale: its own closing attacks, earlier; the Grand Silence stays as built.
  [CONDUCTOR]: [
    { attack: SFORZANDO, from: CONDUCTOR, every: BURN_EVERY.sforzando },
    { attack: DOWNBEAT, from: CONDUCTOR, every: BURN_EVERY.downbeat },
    null,
  ],
};

/** A borrowed attack that the cap holds back is tried again this long after (as the picker's). */
const CAP_RETRY = 1.5;

/** The borrowed attack of `defId`'s phase `phase` (1-based), or null. */
export function tyrantAttackOf(defId: string, phase: number): TyrantEntry | null {
  const rows = Object.prototype.hasOwnProperty.call(TYRANT_TABLE, defId)
    ? TYRANT_TABLE[defId]
    : undefined;
  return rows?.[phase - 1] ?? null;
}

/**
 * Every tick the fight's boss stands (bosses.ts, after its phase check): a phase it has just
 * entered (or the fight's first) takes up its attack; a phase with none lets the last one go.
 */
export function tyrantUpdate(world: World, boss: Entity): void {
  const c = boss.enemy!;
  const entry = tyrantAttackOf(c.defId, c.phase);
  if (entry ? c.tyrant?.phase !== c.phase : c.tyrant !== undefined)
    enterTyrantPhase(world, boss, c.phase);
}

/** The boss enters `phase`: its borrowed attack replaces the last phase's, and is announced. */
export function enterTyrantPhase(world: World, boss: Entity, phase: number): void {
  const c = boss.enemy!;
  const entry = tyrantAttackOf(c.defId, phase);
  if (!entry) {
    delete c.tyrant;
    return;
  }
  c.tyrant = {
    attack: entry.attack,
    from: entry.from,
    phase,
    readyAt: world.time + world.mods.tyrantFirst,
  };
  world.events.push({
    type: 'tyrantEdict',
    tick: world.tick,
    boss: boss.id,
    phase,
    attack: entry.attack,
    from: entry.from,
  });
}

/**
 * Foresight's mark for the borrowed attack (`Foreseen.special`): -1 is a boss script's scheduled
 * attack, an index from 0 one of its own specials.
 */
export const TYRANT_FORESEEN = -2;

/**
 * Foresight's candidate for the hold (enemies.ts, `foresee`, on a Tyrant run only): the borrowed
 * attack, due once it is ready and the boss is free (`free`), as `tryTyrant` would begin it; none
 * while the cap on damaging telegraphs would hold it back as things stand.
 */
export function tyrantForeseeable(
  world: World,
  e: Entity,
  free: number,
): { special: number; attackId: string; at: number } | null {
  const hold = e.enemy!.tyrant;
  if (!hold) return null;
  const attack = attackDef(hold.attack);
  if (attack.effect === 'damage' && liveDamaging(world) >= READABILITY_CAP) return null;
  return { special: TYRANT_FORESEEN, attackId: hold.attack, at: Math.max(free, hold.readyAt) };
}

/**
 * The generic picker's first try for a boss on a Tyrant run (enemies.ts, `trySpecial`): its
 * borrowed attack once it is ready, unless the cap on damaging telegraphs shown at once holds it
 * back (it is tried again `CAP_RETRY` s on). What Foresight showed of it is kept (its target, if
 * rolled early). True if it began.
 */
export function tryTyrant(world: World, e: Entity, target: Entity): boolean {
  const c = e.enemy!;
  const hold = c.tyrant;
  if (!hold || world.time < hold.readyAt - 1e-9) return false;
  const attack = attackDef(hold.attack);
  if (attack.effect === 'damage' && liveDamaging(world) >= READABILITY_CAP) {
    hold.readyAt = world.time + CAP_RETRY;
    return false;
  }
  const f = c.foreseen;
  const promised = f?.special === TYRANT_FORESEEN && f.attackId === hold.attack ? f : null;
  if (!beginAttack(world, e, attack, target, promised)) return false;
  const entry = tyrantAttackOf(e.enemy!.defId, hold.phase);
  hold.readyAt = world.time + (entry?.every ?? attack.cooldown * world.mods.tyrantCooldownMult);
  return true;
}

/** Damaging telegraphs live now, whoever owns them. */
function liveDamaging(world: World): number {
  let n = 0;
  for (const t of world.telegraphs) if (t.effect === 'damage') n++;
  return n;
}

/** The Silent Conductor's closing attacks' cadences: Tyrant's in a Tyrant fight. */
export function closingEvery(world: World): {
  readonly downbeat: number;
  readonly sforzando: number;
} {
  if (world.mods.tyrant) return TYRANT_BURN;
  return BURN_EVERY;
}

/**
 * Tyrant's Decree for a boss's hold (docs/phase-6.md): "Tyrant — the Bellwarden takes up the Glass
 * Lancer's Glass Lance. Ward it, Reel the target, or step aside." Built from content names and
 * the attack's answers, for the views (the sim announces only `tyrantEdict`).
 */
export function tyrantDecreeOf(bossDefId: string, hold: Pick<TyrantHold, 'attack' | 'from'>) {
  const attack = attackDef(hold.attack);
  return tyrantDecree(
    enemyDef(bossDefId).name,
    enemyDef(hold.from).name,
    attack.name,
    attack.answers,
  );
}
