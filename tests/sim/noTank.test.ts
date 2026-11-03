/**
 * Phase 5b: a party without a tank (docs/phase-5b.md, "Is a tank required?"). Party B (Lyra,
 * Vexis, Brann) plays First Light, the Bellwarden and Vharun with the Skilled bot: the fights
 * run without errors, nothing taunts and threat alone decides whom enemies hit, and none of
 * Kael's rules fire. (Whom threat favours, Brann or the damage dealers, is W7's tuning.)
 */
import { describe, expect, it } from 'vitest';
import { heroDef } from '../../src/content';
import { makeBot } from '../../src/bots';
import { createSim, type SimConfig, type SimEvent } from '../../src/sim';
import { pickEnemyTarget } from '../../src/sim/combat/threat';
import type { Entity } from '../../src/sim/state';
import type { World } from '../../src/sim/world';
import { ARRIVAL_KIT, kitConfig } from '../../tools/kits';

const PARTY_B = ['lyra', 'vexis', 'brann'];
const KAEL_TALENTS = ['steady_vanguard', 'vanguards_roar', 'riposte_bash', 'unbreakable'];
const KAEL_MOVES = [...heroDef('kael').abilities.map((a) => a.id), heroDef('kael').solo.id];

const FIGHTS: readonly { encounter: string; ticks: number; config: Omit<SimConfig, 'seed'> }[] = [
  { encounter: 'first_light', ticks: 60 * 40, config: { auras: ['sostenuto', 'fortissimo'] } },
  {
    encounter: 'bellwarden',
    ticks: 60 * 60,
    config: { auras: ['sostenuto', 'ostinato'] },
  },
  { encounter: 'vharun', ticks: 60 * 90, config: kitConfig(ARRIVAL_KIT) },
];

describe('no tank: party B (docs/phase-5b.md)', () => {
  for (const { encounter, ticks, config } of FIGHTS)
    it(`${encounter}: plays clean, threat-led, with no Kael rules`, () => {
      const seed = 4141;
      const sim = createSim({ seed, encounter, party: PARTY_B, ...config });
      const bot = makeBot('skilled', seed);
      const events: SimEvent[] = [];
      const ids = sim.state.party;
      const defOf = new Map(ids.map((id) => [id, sim.state.entities.get(id)!.hero!.defId]));
      expect([...defOf.values()]).toEqual(PARTY_B);
      let taunted = 0;
      let led = 0;
      let chasing = 0;
      for (let t = 0; t < ticks; t++) {
        sim.step(bot.decide(sim.state));
        events.push(...sim.drainEvents());
        for (const e of sim.state.entities.list()) {
          const c = e.enemy;
          if (!c || !e.health || e.health.dead) continue;
          if (c.tauntTarget !== null) taunted++;
          if (c.targetId === null || c.cast || (c.state !== 'approach' && c.state !== 'attack'))
            continue;
          // Its target is the one its threat table names (bar this tick's late hits).
          chasing++;
          if (pickEnemyTarget(sim.state as unknown as World, e as Entity) === c.targetId) led++;
        }
        const status = sim.state.encounter.status;
        if (status === 'victory' || status === 'defeat') break;
      }
      // Nothing taunts without Kael: threat decides.
      expect(taunted).toBe(0);
      expect(chasing).toBeGreaterThan(0);
      expect(led / chasing).toBeGreaterThan(0.95);
      // None of Kael's moves, Solo or talents.
      for (const e of events) {
        if (e.type === 'abilityUsed') expect(KAEL_MOVES).not.toContain(e.ability);
        if (e.type === 'soloStarted') expect(['aegisWall', 'oathkeeper']).not.toContain(e.solo);
        if (e.type === 'talentFired') expect(KAEL_TALENTS).not.toContain(e.talent);
      }
      // Brann fought his fight.
      expect(events.some((e) => e.type === 'healApplied' && e.via === 'lifesteal')).toBe(true);
    }, 120_000);
});
