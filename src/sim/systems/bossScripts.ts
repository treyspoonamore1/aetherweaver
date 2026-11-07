/**
 * The boss-script registry (docs/phase-5c.md, Q14): scripts for **new** bosses only, keyed by
 * enemy def id. Every call site consults it after the legacy `c.defId ===` branches and every
 * `m2` read, so the Bellwarden, the Cantor, the Matriarch and Vharun never reach it: the lookup
 * misses for their ids. Movement III's bosses register here (docs/phase-5c.md), and so does the
 * Finale's Silent Conductor (docs/phase-5d.md), whose script alone uses the two Finale hooks.
 */
import type { Entity, EntityId, Telegraph } from '../state';
import type { World } from '../world';
import { conductorScript } from './conductorBoss';
import { seamstressScript, unweaverScript } from './unstitchedBosses';

/** A scheduled scripted attack, for Foresight (`Foreseen`, with `special: -1`). */
export interface ScriptedNext {
  attackId: string;
  /** Sim time it is due to begin. */
  at: number;
}

/** What a boss's script may do. Every hook is optional. */
export interface BossScript {
  /**
   * Every tick the boss stands, whatever it is doing (before the phase-shift and cast gates,
   * bosses.ts): the clocks that must run out on time, however long a cast takes.
   */
  update?(world: World, boss: Entity): void;
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
  /**
   * The boss itself died (enemies.ts), before it is despawned: what it holds open ends with it,
   * even where no fight's end follows (a sandbox, whose encounter never ends).
   */
  onDeath?(world: World, boss: Entity): void;
  /** The radius of the ring its `summon` attack lays its adds on (absent: 3 m beyond its body). */
  summonRing?(attackId: string): number | undefined;
  /**
   * One tick of Stasis: every clock the script keeps waits `dt` (stasis.ts, which already waits
   * the field keys and Severing's `severAt`).
   */
  stasis?(world: World, dt: number): void;
  /** The encounter ended: delete everything the script created (director.ts). */
  cleanup?(world: World): void;
  /**
   * The Finale (docs/phase-5d.md Q1): a telegraph whose attack has `discord` resolved, and
   * whether it failed (failed victims reached its `discordQuorum`). `boss` is the standing boss
   * (null once it has fallen). `victims`: the ones counted as failed, in hit order (the
   * `discordRose` event carries them for render). Called through the installer in telegraphs.ts.
   */
  telegraphVerdict?(
    world: World,
    boss: Entity | null,
    t: Telegraph,
    failed: boolean,
    victims?: readonly EntityId[],
  ): void;
  /**
   * The Finale (Q4): the Weaver's Crescendo (any Calling's) just began, called once, right after
   * its flags are set (techniques.ts), so Stasis reaches it synchronously.
   */
  crescendo?(world: World): void;
}

/**
 * The registry: Movement III's Seamstress and Unweaver (unstitchedBosses.ts), and the Finale's
 * Silent Conductor (conductorBoss.ts).
 */
export const BOSS_SCRIPTS: Readonly<Record<string, BossScript>> = {
  the_seamstress: seamstressScript(),
  the_unweaver: unweaverScript(),
  the_silent_conductor: conductorScript(),
};

/** A boss's script by its enemy def id (undefined for every legacy boss). */
export function bossScript(defId: string): BossScript | undefined {
  return Object.prototype.hasOwnProperty.call(BOSS_SCRIPTS, defId)
    ? BOSS_SCRIPTS[defId]
    : undefined;
}

/**
 * The script of the fight's boss: the standing boss's (a staged sandbox fight has one too), else
 * the encounter's content's (the boss may already be gone, as at the end of a won fight).
 * Undefined for every legacy encounter.
 */
export function encounterScript(world: World): BossScript | undefined {
  const id = world.encounter.bossId;
  const standing = id === null ? undefined : world.entities.get(id)?.enemy;
  if (standing) return bossScript(standing.defId);
  const boss = world.content.encounters.find((e) => e.id === world.encounter.id)?.boss;
  return boss === undefined ? undefined : bossScript(boss);
}
