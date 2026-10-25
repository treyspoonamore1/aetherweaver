/**
 * A tiny mutable stand-in for the sim's WorldState, with just enough surface for the audio
 * director (entities, weaver, telegraphs, encounter). Used by the lab's sound buttons and
 * the offline loudness audit.
 */
import type { SimEvent, WorldState } from '../../sim';

export const IDS = { weaver: 1, kael: 2, lyra: 3, vexis: 4, enemyBase: 10 } as const;
export const HERO_IDS = ['kael', 'lyra', 'vexis'] as const;
export type HeroKey = (typeof HERO_IDS)[number];

interface FakeEntity {
  id: number;
  kind: 'weaver' | 'hero' | 'enemy';
  x: number;
  z: number;
  health: {
    hp: number;
    maxHp: number;
    downed: boolean;
    dead: boolean;
  };
  weaver?: { resonance: number; threadTension: number; crescendo: number };
  hero?: { defId: string; slot: number };
  enemy?: { role: string; tier: string; state: string; phase: number };
}

export class FakeWorld {
  readonly entities = new Map<number, FakeEntity>();
  telegraphs: unknown[] = [];
  /** Chords the field reports (planted / thread anchors drive the pedal drone and Unison hum). */
  readonly chords: { anchor: string; threadHero: number | null }[] = [];
  status = 'fighting';
  readonly state: WorldState;

  constructor() {
    this.entities.set(IDS.weaver, {
      id: IDS.weaver,
      kind: 'weaver',
      x: 0,
      z: 0,
      health: { hp: 300, maxHp: 300, downed: false, dead: false },
      weaver: { resonance: 0, threadTension: 0, crescendo: 0 },
    });
    HERO_IDS.forEach((defId, slot) => {
      this.entities.set(IDS[defId], {
        id: IDS[defId],
        kind: 'hero',
        x: (slot - 1) * 3,
        z: -3,
        health: { hp: 1000, maxHp: 1000, downed: false, dead: false },
        hero: { defId, slot },
      });
    });
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;
    this.state = {
      tick: 0,
      time: 0,
      timeScale: 1,
      arenaId: 'lab',
      arenaRadius: 20,
      obstacles: [],
      weaverId: IDS.weaver,
      party: [IDS.kael, IDS.lyra, IDS.vexis],
      directive: null,
      focusTarget: null,
      chimes: [],
      get field() {
        return { chords: self.chords } as unknown as WorldState['field'];
      },
      ledger: {} as WorldState['ledger'],
      get telegraphs() {
        return self.telegraphs as WorldState['telegraphs'];
      },
      get encounter() {
        return { status: self.status } as unknown as WorldState['encounter'];
      },
      entities: {
        get count() {
          return self.entities.size;
        },
        get: (id: number) =>
          self.entities.get(id) as unknown as ReturnType<WorldState['entities']['get']>,
        list: () =>
          [...self.entities.values()] as unknown as ReturnType<WorldState['entities']['list']>,
      },
    } as unknown as WorldState;
  }

  weaverData(): NonNullable<FakeEntity['weaver']> {
    return (this.entities.get(IDS.weaver) as FakeEntity).weaver as NonNullable<
      FakeEntity['weaver']
    >;
  }

  setResonance(v: number): void {
    this.weaverData().resonance = v;
  }
  setTension(v: number): void {
    this.weaverData().threadTension = v;
  }
  /** Plants / removes a Pedal Point Chord and puts a Unison Chord on the Thread (or not). */
  setChords(planted: boolean, unison: boolean): void {
    this.chords.length = 0;
    if (planted) this.chords.push({ anchor: 'planted', threadHero: null });
    if (unison) this.chords.push({ anchor: 'thread', threadHero: IDS.kael });
  }
  setCrescendo(on: boolean): void {
    this.weaverData().crescendo = on ? 10 : 0;
  }
  setHeroHp(hero: HeroKey, frac: number): void {
    const h = this.entities.get(IDS[hero]);
    if (h) h.health.hp = Math.max(1, frac * h.health.maxHp);
  }
  setDowned(hero: HeroKey, down: boolean): void {
    const h = this.entities.get(IDS[hero]);
    if (h) h.health.downed = down;
  }
  /** Replaces the enemies with `n` generic ones (intensity). */
  setEnemies(n: number, role = 'swarm', tier = 'normal', phase = 0): void {
    for (const id of [...this.entities.keys()]) if (id >= IDS.enemyBase) this.entities.delete(id);
    for (let i = 0; i < n; i++) {
      const id = IDS.enemyBase + i;
      this.entities.set(id, {
        id,
        kind: 'enemy',
        x: -8 + (i % 8) * 2.2,
        z: 6 + Math.floor(i / 8) * 2,
        health: { hp: 100, maxHp: 100, downed: false, dead: false },
        enemy: { role, tier, state: 'approach', phase },
      });
    }
  }
  /** Adds one enemy of a role at x (kill sounds read the role from the entity). */
  addEnemy(role: string, x: number): number {
    const id = IDS.enemyBase + 100 + this.entities.size;
    this.entities.set(id, {
      id,
      kind: 'enemy',
      x,
      z: 5,
      health: { hp: 0, maxHp: 100, downed: false, dead: true },
      enemy: { role, tier: 'normal', state: 'dying', phase: 0 },
    });
    return id;
  }
}

export function ev<T extends SimEvent['type']>(
  type: T,
  rest: Omit<Extract<SimEvent, { type: T }>, 'type' | 'tick'>,
): SimEvent {
  return { type, tick: 0, ...rest } as unknown as SimEvent;
}
