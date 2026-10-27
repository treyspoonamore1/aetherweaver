/**
 * A tiny mutable stand-in for the sim's WorldState, with just enough surface for the audio
 * director (entities, weaver, telegraphs, encounter). Used by the lab's sound buttons and
 * the offline loudness audit.
 */
import { CONTENT } from '../../content';
import type { AstrolabeState, SimEvent, WorldState } from '../../sim';

export const IDS = { weaver: 1, kael: 2, lyra: 3, vexis: 4, enemyBase: 10 } as const;
export const HERO_IDS = ['kael', 'lyra', 'vexis'] as const;
export type HeroKey = (typeof HERO_IDS)[number];

/** Phase 4: a shield as the state holds it (the Shatterproof Halo reads the Ward's). */
interface FakeShield {
  kind: 'ward' | 'dome' | 'barrier' | 'overshield' | 'discord';
  amount: number;
  max: number;
}

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
    shields: FakeShield[];
  };
  weaver?: { resonance: number; threadTension: number; crescendo: number };
  /** `afterglowUntil` (Phase 4): Empower lingers on this hero until this sim time. */
  hero?: { defId: string; slot: number; solo: number; soloActive: number; afterglowUntil: number };
  enemy?: { role: string; tier: string; state: string; phase: number };
}

const health = (hp: number, maxHp: number, dead = false): FakeEntity['health'] => ({
  hp,
  maxHp,
  downed: false,
  dead,
  shields: [],
});

/** Phase 4: the Astrolabe with no tree, as the sim reports it. */
const NO_TREE: AstrolabeState = {
  nodes: [],
  keystones: [],
  techCostMult: 1,
  techniquesCostLife: false,
  lifeCapPct: 1,
};

/** Phase 4: the id of the content's node with this effect (the lab names nodes by effect). */
export function nodeWith(effect: string): string {
  return CONTENT.astrolabe.nodes.find((n) => n.effect === effect)?.id ?? effect;
}

/** Phase 3e: a telegraph as the state holds it, for the Stasis and final-second buttons. */
export interface FakeTelegraph {
  id: number;
  owner: number;
  target: number | null;
  attackId: string;
  name: string;
  kind: 'cleave' | 'beam' | 'burst' | 'donut' | 'mark' | 'link' | 'raid';
  shape: { kind: 'circle'; x: number; z: number; r: number } | { kind: 'mark'; target: number };
  start: number;
  impact: number;
  perfectFrom: number;
  damage: number;
  pctMaxHp: number;
  effect: 'damage' | 'healAllies' | 'summon' | 'suppress';
  answers: ('ward' | 'chime' | 'reel' | 'focus' | 'scatter' | 'stack' | 'move' | 'dome')[];
  severity: 'normal' | 'lethal';
}

export class FakeWorld {
  readonly entities = new Map<number, FakeEntity>();
  telegraphs: unknown[] = [];
  /** Chords the field reports (planted / thread anchors drive the pedal drone and Unison hum). */
  readonly chords: {
    role: string;
    anchor: string;
    auras: string[];
    focus: number;
    threadHero: number | null;
  }[] = [];
  status = 'fighting';
  /** Phase 3c: the Calling the fake run carries, and whether Sunrise is up (`field.crescendo`). */
  calling: { id: string; path: string[] } | null = null;
  sunrise = false;
  /** Phase 3d: Martyr's Vow is up (`field.vow`). */
  vow = false;
  /** Phase 3e: Stasis is up (`field.stasis`), and the sim clock (`state.time`). */
  stasis = false;
  time = 0;
  /** Phase 4: the Astrolabe the fake fight carries (`state.astrolabe`); see `setAstrolabe`. */
  astrolabe: AstrolabeState = NO_TREE;
  readonly state: WorldState;

  constructor() {
    this.entities.set(IDS.weaver, {
      id: IDS.weaver,
      kind: 'weaver',
      x: 0,
      z: 0,
      health: health(300, 300),
      weaver: { resonance: 0, threadTension: 0, crescendo: 0 },
    });
    HERO_IDS.forEach((defId, slot) => {
      this.entities.set(IDS[defId], {
        id: IDS[defId],
        kind: 'hero',
        x: (slot - 1) * 3,
        z: -3,
        health: health(1000, 1000),
        hero: { defId, slot, solo: 0, soloActive: 0, afterglowUntil: 0 },
      });
    });
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;
    this.state = {
      tick: 0,
      get time() {
        return self.time;
      },
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
        return {
          chords: self.chords,
          crescendo: self.sunrise,
          vow: self.vow,
          stasis: self.stasis,
        } as unknown as WorldState['field'];
      },
      get calling() {
        if (!self.calling) return null;
        const id = self.calling.id;
        const chrono = id === 'chronomancer';
        return {
          ...self.calling,
          radiancePerAura: 0.04,
          sunriseMult: 3,
          sovereign: false,
          crescendo: id === 'martyr' ? 'vow' : chrono ? 'stasis' : 'sunrise',
          bearShare: id === 'martyr' ? 0.35 : 0,
          rewind: chrono,
          reviveSpent: false,
          timers: chrono,
          foresight: chrono && self.calling.path.includes('foresight') ? 1 : 0,
        };
      },
      ledger: {} as WorldState['ledger'],
      get astrolabe() {
        return self.astrolabe;
      },
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
  /** Plants / removes a Pedal Point Chord and sets the beam song's focus (0 off, 2 normal, 3 Unison). */
  setChords(planted: boolean, beam: number | boolean, beamAuras = 2): void {
    this.chords.length = 0;
    if (planted)
      this.chords.push({
        role: 'field',
        anchor: 'planted',
        auras: ['a'],
        focus: 1,
        threadHero: null,
      });
    const focus = beam === true ? 3 : beam === false ? 0 : beam;
    if (focus > 0)
      this.chords.push({
        role: 'beam',
        anchor: 'weaver',
        auras: Array.from({ length: beamAuras }, () => 'a'),
        focus,
        threadHero: IDS.kael,
      });
  }
  setCrescendo(on: boolean): void {
    this.weaverData().crescendo = on ? 10 : 0;
    this.sunrise = on;
  }
  /** Phase 3d: Martyr's Vow up or down (also the Weaver's Crescendo clock). */
  setVow(on: boolean): void {
    this.weaverData().crescendo = on ? 5 : 0;
    this.vow = on;
  }
  /** Phase 3c: a Calling (the Luminary) with the option ids picked so far; null for none. */
  setCalling(id: string | null, path: string[] = []): void {
    this.calling = id === null ? null : { id, path };
  }
  /** Phase 3e: Stasis up for `seconds` (the Weaver's Crescendo clock), or down. */
  setStasis(on: boolean, seconds = 3): void {
    this.weaverData().crescendo = on ? seconds : 0;
    this.stasis = on;
  }
  /** Phase 3e: a hero's Solo gauge (0..100), and whether a Solo is under way. */
  setSolo(hero: HeroKey, solo: number, active = false): void {
    const h = this.entities.get(IDS[hero])?.hero;
    if (!h) return;
    h.solo = solo;
    h.soloActive = active ? 4 : 0;
  }
  /**
   * Phase 3e: a telegraph in the state, `windup` seconds long from now, aimed at a hero (a Ward
   * answer by default). Returns it, so its `telegraphStarted` can be fired with the same id.
   */
  addTelegraph(
    id: number,
    windup: number,
    opts: Partial<Pick<FakeTelegraph, 'kind' | 'answers' | 'target' | 'severity'>> & {
      x?: number;
    } = {},
  ): FakeTelegraph {
    this.removeTelegraph(id);
    const target = opts.target === undefined ? IDS.kael : opts.target;
    const kind = opts.kind ?? 'burst';
    const t: FakeTelegraph = {
      id,
      owner: IDS.enemyBase,
      target,
      attackId: 'lab',
      name: 'Lab',
      kind,
      shape:
        kind === 'mark' && target !== null
          ? { kind: 'mark', target }
          : { kind: 'circle', x: opts.x ?? 0, z: 4, r: 3 },
      start: this.time,
      impact: this.time + windup,
      perfectFrom: this.time + windup - 0.35,
      damage: 300,
      pctMaxHp: 0,
      effect: 'damage',
      answers: opts.answers ?? ['ward', 'dome'],
      severity: opts.severity ?? 'normal',
    };
    this.telegraphs.push(t);
    return t;
  }
  removeTelegraph(id: number): void {
    const i = (this.telegraphs as FakeTelegraph[]).findIndex((t) => t.id === id);
    if (i >= 0) this.telegraphs.splice(i, 1);
  }
  /** The sim clock moves on `dt` seconds; in Stasis every telegraph's times move with it. */
  advance(dt: number): void {
    this.time += dt;
    if (!this.stasis) return;
    for (const t of this.telegraphs as FakeTelegraph[]) {
      t.start += dt;
      t.impact += dt;
      t.perfectFrom += dt;
    }
  }
  setHeroHp(hero: HeroKey, frac: number): void {
    const h = this.entities.get(IDS[hero]);
    if (h) h.health.hp = Math.max(1, frac * h.health.maxHp);
  }
  /**
   * Phase 4: the Astrolabe the fight carries, as the sim reports it: the known nodes sorted, the
   * keystones among them, Economy's cost multiplier, Eldritch Conduit's Life and Prism
   * Covenant's ceiling, from the content's values. `[]` for none.
   */
  setAstrolabe(ids: readonly string[]): void {
    const nodes = CONTENT.astrolabe.nodes.filter((n) => ids.includes(n.id));
    if (nodes.length === 0) {
      this.astrolabe = NO_TREE;
      return;
    }
    let cost = 0;
    let cap = 1;
    for (const n of nodes) {
      if (n.effect === 'tech_cost') cost += n.values.pct ?? 0;
      if (n.effect === 'prism_covenant') cap = Math.min(cap, (n.values.cap ?? 100) / 100);
    }
    this.astrolabe = {
      nodes: nodes.map((n) => n.id).sort(),
      keystones: nodes.filter((n) => n.kind === 'keystone').map((n) => n.id),
      techCostMult: Math.max(0, 1 - cost / 100),
      techniquesCostLife: nodes.some((n) => n.effect === 'eldritch_conduit'),
      lifeCapPct: cap,
    };
  }
  /** Phase 4: the Weaver's Life, as a share of her usable Life. */
  setWeaverHp(frac: number): void {
    const w = this.entities.get(IDS.weaver);
    if (w) w.health.hp = Math.max(1, frac * w.health.maxHp);
  }
  /**
   * Phase 4: a hero's Ward as the state holds it after a hit: `amount` left of a `max` barrier
   * (0 takes it away).
   */
  setWard(hero: HeroKey | 'weaver', amount: number, max = amount): void {
    const e = this.entities.get(hero === 'weaver' ? IDS.weaver : IDS[hero]);
    if (!e) return;
    e.health.shields = e.health.shields.filter((s) => s.kind !== 'ward');
    if (amount > 0) e.health.shields.push({ kind: 'ward', amount, max });
  }
  /** Phase 4: Empower lingers on a hero for `seconds` from now (Afterglow); 0 for none. */
  setAfterglow(hero: HeroKey, seconds: number): void {
    const h = this.entities.get(IDS[hero])?.hero;
    if (h) h.afterglowUntil = seconds > 0 ? this.time + seconds : 0;
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
        health: health(100, 100),
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
      health: health(0, 100, true),
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
