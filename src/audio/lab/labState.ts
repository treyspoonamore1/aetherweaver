/**
 * A tiny mutable stand-in for the sim's WorldState, with just enough surface for the audio
 * director (entities, weaver, telegraphs, encounter). Used by the lab's sound buttons and
 * the offline loudness audit.
 */
import { CONTENT } from '../../content';
import {
  newBlood,
  type AstrolabeState,
  type BloodState,
  type DissonanceState,
  type SimEvent,
  type WorldState,
} from '../../sim';

export const IDS = { weaver: 1, kael: 2, lyra: 3, vexis: 4, brann: 5, enemyBase: 10 } as const;
/** The default lab party (the starters): the lab's and the offline audit's world. */
export const HERO_IDS = ['kael', 'lyra', 'vexis'] as const;
export type HeroKey = (typeof HERO_IDS)[number];
/**
 * Phase 5b: every hero the lab can field. Brann (`IDS.brann`) is opt-in: a `FakeWorld` built with
 * a `party` naming him, or `setParty`. The default world never has him.
 */
export type LabHero = HeroKey | 'brann';
/** Phase 5b: a lab party with Brann as the fourth (the sim takes up to four), for his buttons. */
export const BRANN_LAB_PARTY: readonly LabHero[] = ['kael', 'lyra', 'vexis', 'brann'];

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
    /** Phase 5b: damage on its way (Brann's alert reads a lethal hit); absent until set. */
    incoming?: number;
  };
  /**
   * Phase 4f: the Weaver's technique variants (`variants`, null for a slot's default) and Skate's
   * charges, as the sim reports them.
   */
  weaver?: {
    resonance: number;
    threadTension: number;
    crescendo: number;
    variants: Record<'ward' | 'chime' | 'reel' | 'glide', string | null>;
    glideCharges: number;
    maxGlideCharges: number;
    /** Phase 5b: the Thread (Blood and Silk reads it); absent until `setThread`. */
    threadSlot?: number | null;
    threadMode?: 'mend' | 'empower' | 'bear';
  };
  /**
   * `afterglowUntil` (Phase 4): Empower lingers on this hero until this sim time. Phase 4e
   * (Bonds): the Solo they bring and whether it was cued, and a Celestial Sphere's hits.
   */
  hero?: {
    defId: string;
    slot: number;
    solo: number;
    soloActive: number;
    afterglowUntil: number;
    soloId: string;
    soloCued: boolean;
    talents: string[];
    sphereHits: number;
    sphereUntil: number;
    sphereCued: boolean;
    /** Phase 5b: Brann's Blood Rage state (only his; the sim's shape). */
    blood?: BloodState;
  };
  enemy?: {
    role: string;
    tier: string;
    state: string;
    phase: number;
    defId?: string;
    /** Phase 4d, Restless Dead: it has fallen and risen once already. */
    risen?: boolean;
  };
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
  passives: [],
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
  answers: ('ward' | 'chime' | 'reel' | 'focus' | 'scatter' | 'stack' | 'move' | 'dome' | 'mend')[];
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
  /**
   * Phase 5c: the timed zones the field reports (`field.zones`), absent unless a lab scene lays
   * one; in Stasis each one's `until` waits, as the sim's does.
   */
  zones:
    | {
        id: number;
        kind: 'pull' | 'null';
        owner: number;
        x: number;
        z: number;
        r: number;
        until: number;
      }[]
    | undefined = undefined;
  /** Phase 4: the Astrolabe the fake fight carries (`state.astrolabe`); see `setAstrolabe`. */
  astrolabe: AstrolabeState = NO_TREE;
  /** Phase 4d: the Dissonance in force (`state.dissonance`); see `setBlindScore`. */
  dissonance: DissonanceState = {
    levels: [],
    blindScore: false,
    cueCost: CONTENT.resonance.cueCost,
  };
  readonly state: WorldState;
  /** The party in slot order (Phase 5b: Brann only when asked for). */
  private party: LabHero[];
  /** Phase 5b: the run's Mods as the state reports them (Blood and Silk); absent by default. */
  mods: { bloodAndSilk: number } | undefined = undefined;

  constructor(opts: { party?: readonly LabHero[] } = {}) {
    this.party = [...(opts.party ?? HERO_IDS)];
    this.entities.set(IDS.weaver, {
      id: IDS.weaver,
      kind: 'weaver',
      x: 0,
      z: 0,
      health: health(300, 300),
      weaver: {
        resonance: 0,
        threadTension: 0,
        crescendo: 0,
        variants: { ward: null, chime: null, reel: null, glide: null },
        glideCharges: 1,
        maxGlideCharges: 1,
      },
    });
    this.party.forEach((defId, slot) => this.addHero(defId, slot));
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
      get party() {
        return self.party.map((h) => IDS[h]);
      },
      get mods() {
        return self.mods;
      },
      directive: null,
      focusTarget: null,
      chimes: [],
      get field() {
        return {
          chords: self.chords,
          crescendo: self.sunrise,
          vow: self.vow,
          stasis: self.stasis,
          ...(self.zones ? { zones: self.zones } : {}),
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
      get dissonance() {
        return self.dissonance;
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

  /** A hero in a slot, fresh (full life; Brann with his Blood Rage state and his own life). */
  private addHero(defId: LabHero, slot: number): void {
    const brann = defId === 'brann';
    const max = brann ? (CONTENT.heroes.find((h) => h.id === 'brann')?.maxHp ?? 1250) : 1000;
    this.entities.set(IDS[defId], {
      id: IDS[defId],
      kind: 'hero',
      x: (slot - 1) * 3,
      z: -3,
      health: health(max, max),
      hero: {
        defId,
        slot,
        solo: 0,
        soloActive: 0,
        afterglowUntil: 0,
        soloId: '',
        soloCued: false,
        talents: [],
        sphereHits: 0,
        sphereUntil: 0,
        sphereCued: false,
        ...(brann ? { blood: newBlood() } : {}),
      },
    });
  }

  /** The party's heroes, in slot order. */
  heroes(): readonly LabHero[] {
    return this.party;
  }

  /**
   * Phase 5b: a new party (1-4 heroes). Heroes staying keep their state; those leaving go; those
   * joining arrive fresh. The same party is a no-op.
   */
  setParty(heroes: readonly LabHero[]): void {
    if (heroes.length === this.party.length && heroes.every((h, i) => this.party[i] === h)) return;
    for (const h of this.party) if (!heroes.includes(h)) this.entities.delete(IDS[h]);
    this.party = [...heroes];
    this.party.forEach((h, slot) => {
      const e = this.entities.get(IDS[h]);
      if (!e?.hero) this.addHero(h, slot);
      else e.hero.slot = slot;
    });
  }

  /** Phase 5b: Brann's bleed rate (damage a second; `fallingFast` reads twice it against life). */
  setBleedRate(rate: number): void {
    const b = this.entities.get(IDS.brann)?.hero?.blood;
    if (b) b.bleedRate = rate;
  }

  /** Phase 5b: damage on its way to a hero (0 for none). */
  setIncoming(hero: LabHero, amount: number): void {
    const h = this.entities.get(IDS[hero]);
    if (h) h.health.incoming = amount;
  }

  /** Phase 5b: the Thread on a hero in a mode (null: off). */
  setThread(hero: LabHero | null, mode: 'mend' | 'empower' | 'bear' = 'mend'): void {
    const w = this.weaverData();
    const slot = hero === null ? -1 : this.party.indexOf(hero);
    w.threadSlot = slot < 0 ? null : slot;
    w.threadMode = mode;
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
  setSolo(hero: LabHero, solo: number, active = false): void {
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
    opts: Partial<
      Pick<FakeTelegraph, 'kind' | 'answers' | 'target' | 'severity' | 'attackId' | 'name'>
    > & {
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
      attackId: opts.attackId ?? 'lab',
      name: opts.name ?? 'Lab',
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
    if (this.zones) for (const z of this.zones) z.until += dt;
    for (const t of this.telegraphs as FakeTelegraph[]) {
      t.start += dt;
      t.impact += dt;
      t.perfectFrom += dt;
    }
  }
  setHeroHp(hero: LabHero, frac: number): void {
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
      passives: [],
      keystones: nodes.filter((n) => n.kind === 'keystone').map((n) => n.id),
      techCostMult: Math.max(0, 1 - cost / 100),
      techniquesCostLife: nodes.some((n) => n.effect === 'eldritch_conduit'),
      lifeCapPct: cap,
    };
  }
  /** Phase 4d: Blind Score on or off (the telegraphs' windups stop naming their answer). */
  setBlindScore(on: boolean): void {
    const id = CONTENT.dissonance.find((d) => d.effect === 'blind_score')?.id ?? 'blind_score';
    this.dissonance = {
      levels: on ? [{ id, rank: 1 }] : [],
      blindScore: on,
      cueCost: CONTENT.resonance.cueCost,
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
  setWard(hero: LabHero | 'weaver', amount: number, max = amount): void {
    const e = this.entities.get(hero === 'weaver' ? IDS.weaver : IDS[hero]);
    if (!e) return;
    e.health.shields = e.health.shields.filter((s) => s.kind !== 'ward');
    if (amount > 0) e.health.shields.push({ kind: 'ward', amount, max });
  }
  /** Phase 4: Empower lingers on a hero for `seconds` from now (Afterglow); 0 for none. */
  setAfterglow(hero: LabHero, seconds: number): void {
    const h = this.entities.get(IDS[hero])?.hero;
    if (h) h.afterglowUntil = seconds > 0 ? this.time + seconds : 0;
  }
  /**
   * Phase 4e, Bonds: a hero's alternate Solo under way (`soloId`), cued or not; `null` for none.
   * Hawk's Vigil's shots read whether it was cued (its mark).
   */
  setAltSolo(hero: LabHero, solo: string | null, cued = false): void {
    const h = this.entities.get(IDS[hero])?.hero;
    if (!h) return;
    h.soloId = solo ?? '';
    h.soloActive = solo ? 5 : 0;
    h.soloCued = cued;
  }
  /** Phase 4e: a hero's Celestial Sphere, `hits` left for `seconds` (0: none). */
  setSphere(hero: LabHero, hits: number, seconds = 5, cued = false): void {
    const h = this.entities.get(IDS[hero])?.hero;
    if (!h) return;
    h.sphereHits = hits;
    h.sphereUntil = hits > 0 ? this.time + seconds : 0;
    h.sphereCued = cued;
  }
  /**
   * Phase 4f: the Weaver's variant in a slot (null: its default). Skate brings its charges (all
   * ready), from the content.
   */
  setVariant(slot: 'ward' | 'chime' | 'reel' | 'glide', id: string | null): void {
    const w = this.weaverData();
    w.variants[slot] = id;
    if (slot === 'glide') {
      const charges =
        id === null ? 1 : (CONTENT.techniqueVariants.find((v) => v.id === id)?.values.charges ?? 1);
      w.maxGlideCharges = Math.max(1, charges);
      w.glideCharges = w.maxGlideCharges;
    }
  }
  /** Phase 4f: Skate's charges left (as the state has them just after a dash). */
  setGlideCharges(n: number): void {
    const w = this.weaverData();
    w.glideCharges = Math.max(0, Math.min(w.maxGlideCharges, n));
  }
  /** Moves a hero (Shieldbearer counts the heroes beside Kael). */
  moveHero(hero: LabHero, x: number, z: number): void {
    const h = this.entities.get(IDS[hero]);
    if (h) {
      h.x = x;
      h.z = z;
    }
  }
  setDowned(hero: LabHero, down: boolean): void {
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
  /** Adds a living Mute at (x, z): its dome is the content's (Unbroken Chorus's sound). */
  addMute(x: number, z: number): number {
    const id = IDS.enemyBase + 200 + this.entities.size;
    this.entities.set(id, {
      id,
      kind: 'enemy',
      x,
      z,
      health: health(100, 100),
      enemy: { role: 'controller', tier: 'normal', state: 'approach', phase: 0, defId: 'mute' },
    });
    return id;
  }
  /** Takes the Mutes away again. */
  removeMutes(): void {
    for (const [id, e] of [...this.entities])
      if (e.enemy?.defId === 'mute') this.entities.delete(id);
  }
  /** Moves the Weaver (Unbroken Chorus: walking under a Mute's dome and out of it). */
  moveWeaver(x: number, z: number): void {
    const w = this.entities.get(IDS.weaver);
    if (w) {
      w.x = x;
      w.z = z;
    }
  }
  /**
   * Phase 4d, Restless Dead: an enemy of a role at x that has just risen (standing back up at
   * `share` of its life, as the sim leaves it on `enemyRose`). Returns its id.
   */
  addRisen(role: string, x: number, tier = 'normal', share = 0.3): number {
    const id = IDS.enemyBase + 100 + this.entities.size;
    this.entities.set(id, {
      id,
      kind: 'enemy',
      x,
      z: 5,
      health: health(Math.round(100 * share), 100),
      enemy: { role, tier, state: 'spawning', phase: 0, risen: true },
    });
    return id;
  }
  /**
   * Adds one enemy of a role at x (kill sounds read the role from the entity). Phase 5a: or a
   * content enemy by its def id (a Legion soldier, the Matriarch, Vharun): its role, tier and def
   * id, as the sim would spawn it, so its sounds read its material.
   */
  addEnemy(roleOrDef: string, x: number): number {
    const id = IDS.enemyBase + 100 + this.entities.size;
    const def = CONTENT.enemies.find((e) => e.id === roleOrDef);
    const role = def?.role ?? roleOrDef;
    const tier = role === 'boss' || role === 'miniboss' ? role : 'normal';
    this.entities.set(id, {
      id,
      kind: 'enemy',
      x,
      z: 5,
      health: health(0, 100, true),
      enemy: def
        ? { role, tier, state: 'dying', phase: 0, defId: def.id }
        : { role, tier: 'normal', state: 'dying', phase: 0 },
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
