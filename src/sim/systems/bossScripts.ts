/**
 * The boss-script registry (docs/phase-5c.md, Q14): scripts for **new** bosses only, keyed by
 * enemy def id. Every call site consults it after the legacy `c.defId ===` branches and every
 * `m2` read, so the Bellwarden, the Cantor, the Matriarch and Vharun never reach it: the lookup
 * misses for their ids. Movement III's bosses register here (W3); the Finale's will too.
 */
import type { Entity, Telegraph } from '../state';
import type { World } from '../world';

/** A scheduled scripted attack, for Foresight (`Foreseen`, with `special: -1`). */
export interface ScriptedNext {
  attackId: string;
  /** Sim time it is due to begin. */
  at: number;
}

/** What a boss's script may do. Every hook is optional. */
export interface BossScript {
  /** Every tick the boss stands and isn't casting, after the follow-ups (bosses.ts). */
  tick?(world: World, boss: Entity): void;
  /** The boss entered `phase` (1-based), after the legacy phase handling. */
  enter?(world: World, boss: Entity, phase: number): void;
  /** One of the boss's `script` telegraphs resolved (enemies.ts, `completeCast`). */
  resolved?(world: World, boss: Entity, t: Telegraph): void;
  /** Its next scheduled attack, for Foresight (null: none due). */
  scriptedNext?(world: World, boss: Entity): ScriptedNext | null;
  /** An enemy other than the boss died (an add it summoned, or any other). */
  onAddDeath?(world: World, boss: Entity, add: Entity): void;
  /** One tick of Stasis: every clock the script keeps waits `dt` (stasis.ts). */
  stasis?(world: World, dt: number): void;
  /** The encounter ended: delete everything the script created (director.ts). */
  cleanup?(world: World): void;
}

/** The registry: empty until Movement III's bosses register (W3). */
export const BOSS_SCRIPTS: Readonly<Record<string, BossScript>> = {};

/** A boss's script by its enemy def id (undefined for every legacy boss). */
export function bossScript(defId: string): BossScript | undefined {
  return Object.prototype.hasOwnProperty.call(BOSS_SCRIPTS, defId)
    ? BOSS_SCRIPTS[defId]
    : undefined;
}

/**
 * The script of the fight's boss, by the encounter's content (the boss may already be dead, as
 * at the end of a won fight). Undefined for every legacy encounter.
 */
export function encounterScript(world: World): BossScript | undefined {
  const boss = world.content.encounters.find((e) => e.id === world.encounter.id)?.boss;
  return boss === undefined ? undefined : bossScript(boss);
}
