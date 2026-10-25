/**
 * Runs a real headless sim in the lab (60 Hz, fed to the director) so the mix can be judged
 * with realistic event density. Optional "auto-support" bot plays the Weaver a little.
 */
import {
  SIM_DT,
  createSim,
  type Command,
  type PartySlot,
  type Sim,
  type SimEvent,
} from '../../sim';

export interface FightOptions {
  autoSupport: boolean;
  encounter?: string;
}

export class Fight {
  readonly sim: Sim;
  private acc = 0;
  private wardedTelegraphs = new Set<number>();
  private lastThreadTick = -999;
  ended: 'victory' | 'defeat' | null = null;
  eventCount = 0;

  constructor(readonly options: FightOptions) {
    this.sim = createSim({
      seed: 1,
      encounter: options.encounter ?? 'first_light',
      auras: ['sostenuto', 'fortissimo'],
      debug: true,
    });
  }

  /** Advances by real seconds; returns the sim events produced. */
  advance(realDt: number, maxSteps = 8): SimEvent[] {
    this.acc += realDt;
    const out: SimEvent[] = [];
    let steps = 0;
    while (this.acc >= SIM_DT && steps < maxSteps) {
      this.acc -= SIM_DT;
      steps++;
      this.sim.step(this.options.autoSupport ? this.bot() : []);
      const events = this.sim.drainEvents();
      for (const e of events) {
        if (e.type === 'encounterEnded') this.ended = e.outcome;
        out.push(e);
      }
    }
    if (this.acc > SIM_DT * maxSteps) this.acc = 0;
    this.eventCount += out.length;
    return out;
  }

  /** Debug command: set Resonance directly (works because the sim is created with debug on). */
  setResonance(value: number): void {
    this.sim.step([{ t: 'debug', op: { op: 'setResonance', value } }]);
  }

  private bot(): Command[] {
    const s = this.sim.state;
    const cmds: Command[] = [];
    const heroes = s.party.map((id) => s.entities.get(id)).filter((e) => e?.hero && e.health);
    if (s.tick - this.lastThreadTick >= 40) {
      this.lastThreadTick = s.tick;
      let best: PartySlot = 0;
      let bestFrac = 2;
      for (const h of heroes) {
        if (!h?.health || !h.hero || h.health.downed) continue;
        const f = h.health.hp / h.health.maxHp;
        if (f < bestFrac) {
          bestFrac = f;
          best = h.hero.slot;
        }
      }
      cmds.push({ t: 'thread', slot: best });
    }
    for (const tg of s.telegraphs) {
      if (this.wardedTelegraphs.has(tg.id) || tg.target === null) continue;
      if (!tg.answers.includes('ward')) continue;
      if (s.time >= tg.perfectFrom) {
        const hero = s.entities.get(tg.target);
        if (hero?.hero) {
          this.wardedTelegraphs.add(tg.id);
          cmds.push({ t: 'tech', id: 'ward', slot: hero.hero.slot });
        }
      }
    }
    const w = s.entities.get(s.weaverId)?.weaver;
    if (w) {
      if (w.resonance >= 100 && w.crescendo <= 0 && s.tick % 7 === 0) cmds.push({ t: 'crescendo' });
      else if (w.resonance >= 25 && s.tick % 90 === 0) {
        const ready = heroes.find((h) => h?.hero && h.hero.solo >= 100 && !h.health?.downed);
        if (ready?.hero) cmds.push({ t: 'cue', slot: ready.hero.slot });
      }
      if (s.tick % 240 === 120) {
        const target = heroes.find((h) => h?.health && h.health.hp / h.health.maxHp < 0.6);
        if (target) cmds.push({ t: 'tech', id: 'chime', point: { x: target.x, z: target.z } });
      }
    }
    return cmds;
  }
}
