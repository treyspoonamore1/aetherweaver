/** Plays one encounter with a bot, headlessly. Shared by the harness CLI and tests. */
import { buildOutcome } from '../src/app/outcome';
import {
  CONTENT,
  callingOption,
  enemyDef,
  isFieldMovement,
  movementDef,
  runEventDef,
} from '../src/content';
import { makeBot, type BotKind } from '../src/bots';
import type { ReliquaryRelic } from '../src/meta/reliquary';
import * as Run from '../src/meta/run';
import type { ChordLoadout, RunState } from '../src/meta/types';
import { weaverShare } from '../src/meta/run';
import { inhaleTell, inNullZone, inPullZone, isStitched } from '../src/bots/common';
import {
  bloodRageBonus,
  chordReserve,
  createSim,
  fightMovement,
  isWeaverVia,
  type EntityId,
  type Sim,
  type SimConfig,
  type SimEvent,
} from '../src/sim';
import type { RunBond } from '../src/meta/bonds';
import { noVariants, type Techniques } from '../src/meta/variants';

export interface EncounterRun {
  encounter: string;
  bot: BotKind;
  seed: number;
  outcome: 'victory' | 'defeat' | 'timeout';
  duration: number;
  wave: number;
  waves: number;
  bossPct: number | null;
  share: number;
  perfects: number;
  saves: number;
  downs: number;
  partyDamage: number;
  healing: number;
  shielded: number;
  negated: number;
  amplified: number;
  incoming: number;
  calls: number;
  responses: number;
  holds: number;
  // ── Movement II's verbs (docs/phase-5a.md); 0, empty or null in Movement I. ──
  /** Pins and latches a Reel freed. */
  pinsFreed: number;
  /** The bleed stacks each Chime cleansed, one entry per bleeding hero cleansed. */
  bleedCleanses: number[];
  /** Blood Pacts that blasted (the pair still close when it landed). */
  pactBlasts: number;
  /**
   * The share of the heroes' hits on a guarded enemy that landed on its guard (×0.1), read
   * from where each hitter stood; null when no guarded enemy was hit.
   */
  guardBlockedPct: number | null;
  /** Execution casts, and the heroes they downed. */
  executeCasts: number;
  executions: number;
  /** Under the Bloodmoon: the share of hero-time spent inside a Sanctuary pool; else null. */
  timeInSanctuary: number | null;
  /** Brann's fight (docs/phase-5b.md, "Bots and harness"); absent without him in the party. */
  brann?: BrannTally;
  /** Movement III's verbs (docs/phase-5c.md, "Harness"); absent outside a Movement III fight. */
  m3?: VerbTally3Result;
  /** The Finale's verbs (docs/phase-5d.md, "Harness"); absent outside the Conductor's fight. */
  finale?: FinaleTally;
}

/** What made a Grand Silence note (the sim's `NoteSource`). */
type NoteFrom = 'perfect' | 'clutch' | 'reel' | 'rewind';
/** The mirror-choir's voices, by enemy def id (crucibleIds.ts). */
type Voice = 'mirror_alto' | 'mirror_bass' | 'mirror_tenor' | 'mirror_soprano';

/**
 * How the Finale's verbs went in the Conductor's fight (docs/phase-5d.md, "Harness"). W5 tallies
 * it; times are seconds and a mean is null when there was nothing to average.
 */
export interface FinaleTally {
  /** Discord fed by failed telegraphs: the boss's own, and the Solos'. */
  discordFed: { boss: number; solo: number };
  /** Fortissimo Silences begun; cancelled (by the Weaver's Calling); survived; downs within 4 s. */
  fortissimoCast: number;
  cancelled: Record<string, number>;
  survived: number;
  fortissimoDowns: number;
  /** Cues; Cues whose Solo couldn't begin; Solos interrupted; Solos answered (by answer). */
  cues: number;
  cuesFailed: number;
  cuesInterrupted: number;
  cuesAnswered: Record<string, number>;
  /** Solos begun, by voice. */
  solosBegun: Record<Voice, number>;
  /** Seconds in the Grand Silence; its notes by source. */
  silenceTime: number;
  notes: Record<NoteFrom, number>;
  /** How it ended: eight notes (Reignite) or the cap (the Coda). */
  reignited: boolean;
  silenceBroken: boolean;
  /** Heroes Reignite stood back up. */
  revived: number;
  /** Seconds from the silence's start to Reignite (null without one). */
  timeToReignite: number | null;
  /** Damage the party took while stilled. */
  damageWhileStilled: number;
}

/** The keys of a `FinaleTally`, in order (the harness tests pin them). */
export const VERB_TALLY4_KEYS: readonly (keyof FinaleTally)[] = [
  'discordFed',
  'fortissimoCast',
  'cancelled',
  'survived',
  'fortissimoDowns',
  'cues',
  'cuesFailed',
  'cuesInterrupted',
  'cuesAnswered',
  'solosBegun',
  'silenceTime',
  'notes',
  'reignited',
  'silenceBroken',
  'revived',
  'timeToReignite',
  'damageWhileStilled',
];

/** What cut the Thread (`threadSnapped.cause`), and a cut telegraph's verdict (`cutResolved`). */
type CutCause = 'shears' | 'severing' | 'snip' | 'unpick';
type CutResult = 'cut' | 'held' | 'strand' | 'none';

/**
 * How Movement III's verbs went in a fight (docs/phase-5c.md, "Harness"). Times are seconds;
 * a mean is null when there was nothing to average.
 */
export interface VerbTally3Result {
  /** Thread cuts by cause (`threadSnapped` with a cause). */
  threadCuts: Record<CutCause, number>;
  /** Every cut telegraph's verdict (`cutResolved.result`). */
  cutResults: Record<CutResult, number>;
  /** Mean seconds from an enemy cut to the Thread's next attach; null with no re-attach. */
  reattachDelay: number | null;
  /** Heroes possessed; freed by a Chime (or a Reel); Doubt casts interrupted; marks a Ward held. */
  possessions: number;
  possessFreed: number;
  possessInterrupted: number;
  wardBlockedPossess: number;
  /** Seconds the Weaver stood in a Null rune, and her techniques it refused. */
  runeTime: number;
  silencedRejects: number;
  /** Hero-seconds inside an Inhale's pull, and Rallies called during an Inhale's tell. */
  mawTime: number;
  inhaleRallies: number;
  /** Doom ignitions (a doomed mark begun), and the stacks each Chime cleansed. */
  doomIgnitions: number;
  doomCleanses: number[];
  /** Hero-seconds stitched. */
  stitchTime: number;
  /** Mirrors begun, by copy; mirrors cracked. */
  mimicCopies: Record<'empower' | 'ward' | 'chime', number>;
  mirrorsCracked: number;
  /** The share of the fight a boss stood tethered to its Spindles; null without a tether. */
  spindleUptime: number | null;
  /** Damage Unravel's reversed Mend dealt the party. */
  unravelHarm: number;
  /** Stolen verses taken back by a kill (`verseReturned` 'killed'). */
  versesRecovered: number;
  /** Mirror Ward casts interrupted. */
  mirrorWardsInterrupted: number;
}

const ATTACK_BY_ID = new Map(CONTENT.attacks.map((a) => [a.id, a]));
/** The names of the casts that possess (the Doubt Wraith's), and the Mirror Ward's. */
const POSSESS_CASTS: ReadonlySet<string> = new Set(
  CONTENT.attacks.filter((a) => a.status?.id === 'possessed').map((a) => a.name),
);
const MIRROR_WARD_NAMES: ReadonlySet<string> = new Set(
  CONTENT.attacks.filter((a) => a.id === 'unweaver_mirror_ward').map((a) => a.name),
);

/**
 * Tallies Movement III's verbs from a fight's events and public state, tick by tick
 * (docs/phase-5c.md, "Harness"). `VerbTally3.of` is null outside a Movement III fight, so no
 * Movement I or II `EncounterRun` gains the key.
 */
export class VerbTally3 {
  private readonly threadCuts: Record<CutCause, number> = {
    shears: 0,
    severing: 0,
    snip: 0,
    unpick: 0,
  };
  private readonly cutResults: Record<CutResult, number> = { cut: 0, held: 0, strand: 0, none: 0 };
  private cutAt: number | null = null;
  private readonly delays: number[] = [];
  private possessions = 0;
  private possessFreed = 0;
  private possessInterrupted = 0;
  private wardBlockedPossess = 0;
  private readonly possessMarks = new Set<number>();
  private runeTime = 0;
  private silencedRejects = 0;
  private mawTime = 0;
  private inhaleRallies = 0;
  private rallyTick = -1;
  private doomIgnitions = 0;
  private readonly doomCleanses: number[] = [];
  private readonly doom = new Map<EntityId, number>();
  private stitchTime = 0;
  private readonly mimicCopies = { empower: 0, ward: 0, chime: 0 };
  private mirrorsCracked = 0;
  private tetheredTime = 0;
  private bossTime = 0;
  private tether = false;
  private unravelHarm = 0;
  private versesRecovered = 0;
  private mirrorWardsInterrupted = 0;
  private lastTime: number;

  private constructor(sim: Sim) {
    this.lastTime = sim.state.time;
  }

  /** A tally for a Movement III fight; null for any other. */
  static of(sim: Sim): VerbTally3 | null {
    return fightMovement(sim.state) >= 3 ? new VerbTally3(sim) : null;
  }

  tick(sim: Sim, events: readonly SimEvent[]): void {
    const state = sim.state;
    const party = state.party;
    for (const e of events) {
      switch (e.type) {
        case 'threadSnapped':
          if (e.cause !== undefined) {
            this.threadCuts[e.cause]++;
            this.cutAt = state.time;
          }
          break;
        case 'threadAttached':
          if (this.cutAt !== null) {
            this.delays.push(state.time - this.cutAt);
            this.cutAt = null;
          }
          break;
        case 'cutResolved':
          this.cutResults[e.result]++;
          break;
        case 'possessed':
          this.possessions++;
          break;
        case 'freed':
          if (e.status === 'possessed' && e.by !== 'expired') this.possessFreed++;
          break;
        case 'castInterrupted':
          if (POSSESS_CASTS.has(e.name)) this.possessInterrupted++;
          if (MIRROR_WARD_NAMES.has(e.name)) this.mirrorWardsInterrupted++;
          break;
        case 'telegraphStarted': {
          const t = state.telegraphs.find((x) => x.id === e.telegraph);
          const def = t ? ATTACK_BY_ID.get(t.attackId) : undefined;
          if (def?.status?.id === 'possessed') this.possessMarks.add(e.telegraph);
          if (def?.markStatus === 'doomed') this.doomIgnitions++;
          if (def?.effect === 'mimic') {
            const copy = state.entities.get(e.owner)?.enemy?.mimic?.copy;
            if (copy) this.mimicCopies[copy]++;
          }
          break;
        }
        case 'telegraphResolved':
          if (
            this.possessMarks.has(e.telegraph) &&
            (e.outcome === 'warded' || e.outcome === 'perfect')
          )
            this.wardBlockedPossess++;
          break;
        case 'techniqueRejected':
          if (e.reason === 'silenced') this.silencedRejects++;
          break;
        case 'directiveAck':
          // One ack a hero: count the Rally once, and only in an Inhale's tell.
          if (
            e.directive === 'rally' &&
            e.tick !== this.rallyTick &&
            inhaleTell(state).length > 0
          ) {
            this.rallyTick = e.tick;
            this.inhaleRallies++;
          }
          break;
        case 'statusApplied':
          if (e.status === 'doom' && e.stacks !== undefined) this.doom.set(e.target, e.stacks);
          break;
        case 'statusRemoved':
          if (e.status === 'doom') {
            if (e.reason === 'cleansed') this.doomCleanses.push(this.doom.get(e.target) ?? 0);
            this.doom.delete(e.target);
          }
          break;
        case 'mirrorCracked':
          this.mirrorsCracked++;
          break;
        case 'verseReturned':
          if (e.reason === 'killed') this.versesRecovered++;
          break;
        case 'damageTaken':
          // Unravel's ticks: the reversed Mend, on a hero, from its source, with no telegraph.
          if (
            state.field.unravel &&
            e.hit === 'tick' &&
            e.telegraph === null &&
            e.source === state.field.unravel.source &&
            party.includes(e.target)
          )
            this.unravelHarm += e.amount + e.absorbed;
          break;
        default:
          break;
      }
    }
    const dt = state.time - this.lastTime;
    this.lastTime = state.time;
    if (dt <= 0) return;
    const w = state.entities.get(state.weaverId);
    if (w && inNullZone(state, w)) this.runeTime += dt;
    for (const id of party) {
      const h = state.entities.get(id);
      if (!h?.health || h.health.downed || h.health.dead) continue;
      if (inPullZone(state, h)) this.mawTime += dt;
      if (isStitched(h)) this.stitchTime += dt;
    }
    const bossId = state.encounter.bossId;
    const boss = bossId === null ? undefined : state.entities.get(bossId);
    if (boss?.enemy && boss.health && !boss.health.dead) {
      this.bossTime += dt;
      if (boss.enemy.tethered !== undefined) this.tether = true;
      if ((boss.enemy.tethered ?? 0) > 0) this.tetheredTime += dt;
    }
  }

  result(): VerbTally3Result {
    return {
      threadCuts: { ...this.threadCuts },
      cutResults: { ...this.cutResults },
      reattachDelay:
        this.delays.length > 0 ? this.delays.reduce((a, b) => a + b, 0) / this.delays.length : null,
      possessions: this.possessions,
      possessFreed: this.possessFreed,
      possessInterrupted: this.possessInterrupted,
      wardBlockedPossess: this.wardBlockedPossess,
      runeTime: this.runeTime,
      silencedRejects: this.silencedRejects,
      mawTime: this.mawTime,
      inhaleRallies: this.inhaleRallies,
      doomIgnitions: this.doomIgnitions,
      doomCleanses: [...this.doomCleanses],
      stitchTime: this.stitchTime,
      mimicCopies: { ...this.mimicCopies },
      mirrorsCracked: this.mirrorsCracked,
      spindleUptime: this.tether && this.bossTime > 0 ? this.tetheredTime / this.bossTime : null,
      unravelHarm: this.unravelHarm,
      versesRecovered: this.versesRecovered,
      mirrorWardsInterrupted: this.mirrorWardsInterrupted,
    };
  }
}

/** The keys of a `VerbTally3Result`, in order (the harness tests pin them). */
export const VERB_TALLY3_KEYS: readonly (keyof VerbTally3Result)[] = [
  'threadCuts',
  'cutResults',
  'reattachDelay',
  'possessions',
  'possessFreed',
  'possessInterrupted',
  'wardBlockedPossess',
  'runeTime',
  'silencedRejects',
  'mawTime',
  'inhaleRallies',
  'doomIgnitions',
  'doomCleanses',
  'stitchTime',
  'mimicCopies',
  'mirrorsCracked',
  'spindleUptime',
  'unravelHarm',
  'versesRecovered',
  'mirrorWardsInterrupted',
];

/**
 * How a Blood Rage hero's fight went (docs/phase-5b.md, "Bands"): the share of his alive time
 * below 40% and 30% life, his downs, the Weaver's (effective, halved) healing on him, the Wards
 * and Perfect Wards he got, what his axe drank and its share of all the healing he took, the
 * Resonance Blood and Silk made, Deathless's windows, and the Rallies he refused out of all the
 * Rallies called. Blood Rage where he fights: the share of his damage dealt at 60% life or less,
 * and his Blood Rage bonus weighted by the damage he dealt (0.45 is +45%).
 */
export interface BrannTally {
  lowShare40: number;
  lowShare30: number;
  /** His damage dealt (HP and shields) while at ≤ 60% life, as a share of all he dealt. */
  dealtLow60: number;
  /** His Blood Rage bonus as he dealt it, weighted by damage. */
  rageBonus: number;
  downs: number;
  weaverHealOn: number;
  wardsOn: number;
  perfectsOn: number;
  lifesteal: number;
  lifestealShare: number;
  silkResonance: number;
  deathless: number;
  refusedRallies: number;
  rallies: number;
}

const MAX_SECONDS = 9 * 60;

/**
 * The fights a Movement's isolated cells play, read from content in its order: the opening, the
 * lessons, the skirmish and elite pools, the mini-boss and the boss. Event-only fights (the
 * Unsung Choir, the Legion Vanguard) aren't in it. Movement I's is the harness's table.
 */
export function movementEncounters(movement: number): string[] {
  const def = movementDef(movement);
  // The Finale (docs/phase-5d.md) has no pools: its one fight is its boss.
  if (!isFieldMovement(def)) return [def.boss];
  const all = [
    def.opening,
    ...(def.lessons ?? []),
    ...def.skirmishes,
    ...def.elites,
    def.miniboss,
    def.boss,
  ];
  return all.filter((id, i) => all.indexOf(id) === i);
}

/** The resolutions of a Blood Pact that mean it went off on a hero (`VerbTally.pactBlasts`). */
const BLAST_OUTCOMES: ReadonlySet<string> = new Set(['hit', 'warded', 'absorbed', 'perfect']);

/** Tallies Movement II's verbs from a fight's events and state, tick by tick. */
export class VerbTally {
  pinsFreed = 0;
  bleedCleanses: number[] = [];
  private readonly bleed = new Map<EntityId, number>();
  private readonly pacts = new Set<number>();
  private readonly blasted = new Set<number>();
  private readonly executes = new Set<number>();
  executeCasts = 0;
  executions = 0;
  private guardHits = 0;
  private guardBlocked = 0;
  private bloodmoon = 0;
  private sheltered = 0;

  tick(sim: Sim, events: readonly SimEvent[]): void {
    const state = sim.state;
    for (const e of events) {
      switch (e.type) {
        case 'statusApplied':
          if (e.status === 'bleed' && e.stacks !== undefined) this.bleed.set(e.target, e.stacks);
          break;
        case 'statusRemoved':
          if (e.status === 'bleed') {
            if (e.reason === 'cleansed') this.bleedCleanses.push(this.bleed.get(e.target) ?? 0);
            this.bleed.delete(e.target);
          } else if ((e.status === 'pinned' || e.status === 'latched') && e.reason === 'freed')
            this.pinsFreed++;
          break;
        case 'telegraphStarted': {
          const t = state.telegraphs.find((x) => x.id === e.telegraph);
          if (t?.linkStatus === 'pact') this.pacts.add(t.id);
          if (t?.executeBelow !== undefined) {
            this.executes.add(t.id);
            this.executeCasts++;
          }
          break;
        }
        case 'telegraphResolved':
          if (e.target === null) break;
          // A Pact blasted when it landed on a hero of a pair still close, however that hero
          // met it: hit, Warded, absorbed or Perfect. (Its 'detonated' statusRemoved comes
          // whether or not the pair had split, so it can't tell a blast on its own.) 'dodged'
          // is a Reel or i-frames: no blast; 'cancelled' never applies to a link.
          if (this.pacts.has(e.telegraph) && BLAST_OUTCOMES.has(e.outcome))
            this.blasted.add(e.telegraph);
          if (this.executes.has(e.telegraph)) {
            // The sim's verdict when it gives one; else read it from the target's state.
            if (e.execution !== undefined) {
              if (e.execution === 'executed') this.executions++;
            } else if (e.outcome === 'hit' && state.entities.get(e.target)?.health?.downed)
              this.executions++;
          }
          break;
        case 'damageTaken': {
          if (e.source === null || !state.party.includes(e.source)) break;
          const enemy = state.entities.get(e.target);
          const guard = enemy?.enemy?.guard;
          if (!enemy || !guard) break;
          this.guardHits++;
          const source = state.entities.get(e.source);
          if (!source || guard.brokenUntil > state.time) break;
          const dx = source.x - enemy.x;
          const dz = source.z - enemy.z;
          const d = Math.sqrt(dx * dx + dz * dz) || 1;
          const half = ((enemyDef(enemy.enemy!.defId).guard?.arcDeg ?? 0) / 2) * (Math.PI / 180);
          if ((dx * guard.fx + dz * guard.fz) / d >= Math.cos(half)) this.guardBlocked++;
          break;
        }
        default:
          break;
      }
    }
    const pools = state.field.sanctuary?.pools;
    if (pools)
      for (const id of state.party) {
        const h = state.entities.get(id);
        if (!h?.health || h.health.downed || h.health.dead) continue;
        this.bloodmoon++;
        if (pools.some((p) => Math.hypot(h.x - p.x, h.z - p.z) <= p.r)) this.sheltered++;
      }
  }

  get pactBlasts(): number {
    return this.blasted.size;
  }
  get guardBlockedPct(): number | null {
    return this.guardHits > 0 ? this.guardBlocked / this.guardHits : null;
  }
  get timeInSanctuary(): number | null {
    return this.bloodmoon > 0 ? this.sheltered / this.bloodmoon : null;
  }
}

/** Blood and Silk's Resonance line (src/sim/systems/thread.ts `SILK_BELOW`). */
const SILK_BELOW = 0.3;

/**
 * Tallies a Blood Rage hero's fight (`BrannTally`), tick by tick. `BrannWatch.of` is null
 * without one in the party, so a default party's `EncounterRun` never gains the key.
 */
export class BrannWatch {
  private downs = 0;
  private weaverHeal = 0;
  private otherHeal = 0;
  private wards = 0;
  private perfects = 0;
  private silk = 0;
  private deathless = 0;
  private refused = 0;
  private rallies = 0;
  private rallyTick = -1;
  private dealt = 0;
  private dealtLow = 0;
  private dealtRage = 0;
  private lastTime: number;
  /** The Weaver's Resonance as the last tick ended: the room Blood and Silk had to fill. */
  private lastResonance: number;

  private constructor(
    readonly id: EntityId,
    sim: Sim,
  ) {
    this.lastTime = sim.state.time;
    this.lastResonance = sim.state.entities.get(sim.state.weaverId)?.weaver?.resonance ?? 0;
  }

  /** A watch on the party's Blood Rage hero (Brann), or null when it has none. */
  static of(sim: Sim): BrannWatch | null {
    const id = sim.state.party.find((p) => sim.state.entities.get(p)?.hero?.blood !== undefined);
    return id === undefined ? null : new BrannWatch(id, sim);
  }

  tick(sim: Sim, events: readonly SimEvent[]): void {
    const state = sim.state;
    const me = state.entities.get(this.id);
    for (const e of events) {
      switch (e.type) {
        case 'damageTaken': {
          // A possessed Brann's blows on his allies (Movement III) aren't damage he dealt.
          if (e.source !== this.id || !me?.health || state.party.includes(e.target)) break;
          // Read at the tick's end: his life as he swung, give or take one tick's lifesteal.
          const dealt = e.amount + e.absorbed;
          this.dealt += dealt;
          if (me.health.hp <= me.health.maxHp * 0.6) this.dealtLow += dealt;
          this.dealtRage += dealt * bloodRageBonus(CONTENT, me);
          break;
        }
        case 'allyDowned':
          if (e.hero === this.id) this.downs++;
          break;
        case 'healApplied':
          if (e.target !== this.id || e.via === 'lifesteal') break;
          if (isWeaverVia(e.via)) this.weaverHeal += e.amount;
          else this.otherHeal += e.amount;
          break;
        case 'techniqueCast':
          if (e.technique === 'ward' && e.target === this.id) this.wards++;
          break;
        case 'perfectWard':
          if (e.target === this.id) this.perfects++;
          break;
        case 'talentFired':
          if (e.talent === 'deathless' && e.hero === this.id) this.deathless++;
          break;
        case 'bloodlust':
          if (e.hero === this.id) this.refused++;
          break;
        case 'directiveAck':
          // One ack a hero: count the Rally once.
          if (e.directive === 'rally' && e.tick !== this.rallyTick) {
            this.rallyTick = e.tick;
            this.rallies++;
          }
          break;
        default:
          break;
      }
    }
    // Blood and Silk's Resonance is silent in the sim: read it off the rule it follows.
    const dt = state.time - this.lastTime;
    this.lastTime = state.time;
    const v = state.mods.bloodAndSilk;
    const w = state.entities.get(state.weaverId)?.weaver;
    const h = state.entities.get(this.id)?.health;
    const room = Math.max(0, CONTENT.resonance.max - this.lastResonance);
    this.lastResonance = w?.resonance ?? 0;
    if (
      v > 0 &&
      dt > 0 &&
      w &&
      h &&
      w.crescendo <= 0 &&
      w.threadMode === 'empower' &&
      w.threadSlot !== null &&
      state.party[w.threadSlot] === this.id &&
      !h.downed &&
      h.hp < h.maxHp * SILK_BELOW
    )
      // The sim's gainResonance clamps to the bar's max: a full bar takes nothing.
      this.silk += Math.min(room, v * dt * state.mods.resonanceMult);
  }

  result(sim: Sim): BrannTally {
    const b = sim.state.entities.get(this.id)?.hero?.blood;
    const alive = b?.aliveTime ?? 0;
    const lifesteal = b?.lifesteal ?? 0;
    const received = lifesteal + this.weaverHeal + this.otherHeal;
    return {
      lowShare40: alive > 0 ? (b?.lowTime ?? 0) / alive : 0,
      lowShare30: alive > 0 ? (b?.low30Time ?? 0) / alive : 0,
      dealtLow60: this.dealt > 0 ? this.dealtLow / this.dealt : 0,
      rageBonus: this.dealt > 0 ? this.dealtRage / this.dealt : 0,
      downs: this.downs,
      weaverHealOn: this.weaverHeal,
      wardsOn: this.wards,
      perfectsOn: this.perfects,
      lifesteal,
      lifestealShare: received > 0 ? lifesteal / received : 0,
      silkResonance: this.silk,
      deathless: this.deathless,
      refusedRallies: this.refused,
      rallies: this.rallies,
    };
  }
}

/**
 * Plays one fight to its end (or 9 minutes). `watch`, when given, sees the sim and each tick's
 * events after the harness's own tallies (tools/brann-bands.ts reads more from them); it only
 * reads, so a fight plays the same with or without one.
 */
export function playEncounter(
  config: SimConfig,
  bot: BotKind,
  watch?: (sim: Sim, events: readonly SimEvent[]) => void,
): EncounterRun {
  const sim = createSim(config);
  const player = makeBot(bot, config.seed);
  const maxTicks = MAX_SECONDS * 60;
  let incoming = 0;
  const verbs = new VerbTally();
  const brann = BrannWatch.of(sim);
  const m3 = VerbTally3.of(sim);
  for (let t = 0; t < maxTicks; t++) {
    sim.step(player.decide(sim.state));
    const events = sim.drainEvents();
    for (const e of events) {
      if (e.type === 'damageTaken' && sim.state.party.includes(e.target))
        incoming += e.amount + e.absorbed;
    }
    verbs.tick(sim, events);
    brann?.tick(sim, events);
    m3?.tick(sim, events);
    watch?.(sim, events);
    const s = sim.state.encounter.status;
    if (s === 'victory' || s === 'defeat') break;
  }
  const state = sim.state;
  const l = state.ledger;
  const boss =
    state.encounter.bossId === null ? undefined : state.entities.get(state.encounter.bossId);
  const status = state.encounter.status;
  return {
    encounter: state.encounter.id,
    bot,
    seed: config.seed,
    outcome: status === 'victory' ? 'victory' : status === 'defeat' ? 'defeat' : 'timeout',
    duration: (state.encounter.endedAt ?? state.time) - state.encounter.startedAt,
    wave: state.encounter.wave,
    waves: state.encounter.waves,
    bossPct: boss?.health
      ? boss.health.hp / boss.health.maxHp
      : state.encounter.bossId === null
        ? null
        : 0,
    share: weaverShare(l),
    perfects: l.perfects,
    saves: l.saves.length,
    downs: l.downs,
    partyDamage: l.partyDamage,
    healing: l.healing,
    shielded: l.shielded,
    negated: l.negated,
    amplified: l.amplified,
    incoming: incoming,
    calls: l.calls,
    responses: l.responses,
    holds: l.holds,
    pinsFreed: verbs.pinsFreed,
    bleedCleanses: verbs.bleedCleanses,
    pactBlasts: verbs.pactBlasts,
    guardBlockedPct: verbs.guardBlockedPct,
    executeCasts: verbs.executeCasts,
    executions: verbs.executions,
    timeInSanctuary: verbs.timeInSanctuary,
    ...(brann ? { brann: brann.result(sim) } : {}),
    ...(m3 ? { m3: m3.result() } : {}),
  };
}

export interface RunSummary {
  seed: number;
  bot: BotKind;
  outcome: 'victory' | 'defeat';
  /** Encounter where the run ended (or the boss). */
  lastEncounter: string;
  fights: number;
  minutes: number;
  motifs: string[];
  relics: string[];
  /** The Calling's path options taken. */
  path: string[];
  /** Aether earned over the run, and what was left at the end. */
  aetherEarned: number;
  aetherLeft: number;
  /** Bond XP the run's fights paid each hero (docs/phase-4e.md). */
  bondXp: Record<string, number>;
  /** The furthest Movement the run set foot in (docs/phase-5a.md): 1 for a Prelude. */
  movementReached: number;
  /** Minutes of combat in each Movement, Movement I first. */
  minutesByMovement: number[];
  /**
   * Blood and Silk's reachability (docs/phase-5b.md, "Other gates"); only for a party with
   * Brann. `silkOffered`: draft and shop offers that held it; `silkOfferedEligible`: those made
   * while both its prerequisites were owned; `prereqsOwned`: both were owned at some offer.
   */
  harmony?: { silkOffered: number; silkOfferedEligible: number; prereqsOwned: boolean };
}

/** The Harmony the harness watches for (docs/phase-5b.md), and what it needs owned. */
const SILK = 'blood_and_silk';
const SILK_NEEDS: readonly string[] =
  CONTENT.motifs.find((m) => m.id === SILK)?.requires.motifs ?? [];

/** Records Blood and Silk's offers as a run's drafts and shops come up (`RunSummary.harmony`). */
class HarmonyWatch {
  silkOffered = 0;
  silkOfferedEligible = 0;
  prereqsOwned = false;
  /** The draft or shop already looked at (each offer counts once, however many phases it spans). */
  private seen: unknown = null;

  look(run: RunState): void {
    const offer = run.phase === 'draft' ? run.draft : run.phase === 'merchant' ? run.shop : null;
    if (!offer || offer === this.seen) return;
    this.seen = offer;
    const owned =
      SILK_NEEDS.length > 0 && SILK_NEEDS.every((id) => run.motifs.some((m) => m.id === id));
    if (owned) this.prereqsOwned = true;
    const held =
      run.phase === 'draft'
        ? (run.draft?.options.some((o) => o.motifId === SILK) ?? false)
        : (run.shop?.items.some((i) => i.kind === 'motif' && i.id === SILK) ?? false);
    if (!held) return;
    this.silkOffered++;
    if (owned) this.silkOfferedEligible++;
  }
}

/**
 * The run's party, as `playRun`'s `party` option asks: exactly 3 distinct known heroes, set as
 * Prep sets it (`Run.setParty`: content order, fresh, the Bond choices of heroes who left
 * dropped), with every hero in the roster.
 */
export function withParty(run: RunState, party: readonly string[]): RunState {
  const next = Run.setParty(
    run,
    party,
    CONTENT.heroes.map((h) => h.id),
  );
  const want = CONTENT.heroes.map((h) => h.id).filter((id) => party.includes(id));
  if (party.length !== 3 || next.party.map((h) => h.heroId).join() !== want.join())
    throw new Error(`Not a party of 3 known heroes: ${party.join(',')}`);
  return next;
}

/**
 * The most phases a run may take; a run that needs more is stuck, and `playRun` throws. A
 * 2-Movement Expedition takes at most about 64, a 3-Movement one about 95 (docs/phase-5c.md;
 * tests/harnessTools.test.ts asserts the measured maximum stays well inside it).
 */
export const MAX_PHASES = 240;

/** The Movement a map node belongs to (1 for nodes from before Movements). */
function movementOfNode(run: RunState, id: string): number {
  return Run.findNode(run, id)?.movement ?? 1;
}

/** A node's row counted from its Movement's first row (Threat restarts in each Movement). */
function rowInMovement(run: RunState, id: string): number {
  const node = Run.findNode(run, id)!;
  const m = node.movement ?? 1;
  const start = run.map.rows.findIndex((r) => r.some((n) => (n.movement ?? 1) === m));
  return node.row - Math.max(0, start);
}

/**
 * The harness's shopping list (docs/phase-3b.md): relics first, the dearest it can afford,
 * then motifs; healing when the party is hurt. Deterministic, not clever.
 */
function shop(run: RunState, relics: boolean): RunState {
  for (let guard = 0; guard < 8; guard++) {
    const items = run.shop?.items ?? [];
    const hurt = run.party.reduce((s, h) => s + h.hpPct, 0) / Math.max(1, run.party.length) < 0.6;
    const want = items
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => !item.sold && item.price <= run.aether)
      .filter(({ item }) => item.kind !== 'heal' || hurt)
      .filter(({ item }) => relics || item.kind !== 'relic')
      .sort(
        (a, b) =>
          (a.item.kind === 'relic' ? 0 : a.item.kind === 'heal' ? 1 : 2) -
            (b.item.kind === 'relic' ? 0 : b.item.kind === 'heal' ? 1 : 2) ||
          b.item.price - a.item.price,
      )[0];
    if (!want) break;
    run = Run.buy(run, want.index);
  }
  return Run.leaveShop(run);
}

/** Lift a curse if there is one, else temper the first motif that can grow. */
function forge(run: RunState): RunState {
  const curse = Run.forgeTargets(run, 'cleanse')[0];
  const motif = Run.forgeTargets(run, 'temper')[0];
  if (curse) run = Run.forge(run, { service: 'cleanse', relicId: curse });
  else if (motif) run = Run.forge(run, { service: 'temper', motifId: motif });
  return Run.leaveForge(run);
}

/** The first choice it can make without picking a motif or new Chords (or a relic, if off). */
function event(run: RunState, relics: boolean): RunState {
  if (run.event && run.event.choice === null) {
    const def = runEventDef(run.event.eventId);
    const choice = def.choices.find(
      (c) =>
        c.motif === 'none' &&
        !c.effects.some((e) => e.kind === 'retune') &&
        (relics ||
          ![...c.effects, ...c.fail].some((e) => e.kind === 'relic' || e.kind === 'fight')) &&
        Run.eventChoiceProblem(run, c.id) === null,
    );
    if (choice) run = Run.chooseEvent(run, choice.id);
  }
  return run.phase === 'event' ? Run.leaveEvent(run) : run;
}

/** The most Spirit the bots will reserve when they fill a free slot (the presets reserve 55–73%). */
const MAX_RESERVE = 0.75;

/**
 * Third Voice's free retune: a third aura in a field song that already has two (the slot it
 * grants), the cheapest that stays legal and within `MAX_RESERVE`, with Grace Note on the field
 * song if that's what makes it fit. The bots never retune otherwise, so they don't fill slots
 * they already had. Undefined when nothing fits: the bot keeps its songs.
 */
function withAnotherAura(run: RunState, option: string): ChordLoadout[] | undefined {
  const path = run.calling!.path.map((p, i) => (i === run.callingOffer!.tier ? option : p));
  const slots = Run.fieldAuraSlots({ ...run, calling: { ...run.calling!, path } });
  if ((run.chords[1]?.auras.length ?? 0) < CONTENT.weaver.auraSlots) return undefined;
  const used = new Set(run.chords.flatMap((c) => c.auras));
  const base = run.chords.map((c) => ({ auras: [...c.auras], ornaments: [...c.ornaments] }));
  const variants = [base];
  const field = base[1]!;
  if (
    !base.some((c) => c.ornaments.includes('grace_note')) &&
    field.ornaments.length < CONTENT.weaver.ornamentSlots
  )
    variants.push(
      base.map((c, i) => (i === 1 ? { ...c, ornaments: [...c.ornaments, 'grace_note'] } : c)),
    );
  const auras = CONTENT.auras.filter((a) => !used.has(a.id)).sort((a, b) => a.reserve - b.reserve);
  for (const v of variants)
    for (const aura of auras) {
      const chords = v.map((c, i) => (i === 1 ? { ...c, auras: [...c.auras, aura.id] } : c));
      if (Run.chordsLegal(chords, slots) && chordReserve(chords) <= MAX_RESERVE) return chords;
    }
  return undefined;
}

/** Plays a whole Prelude run: map choices, fights, drafts (first option), respites (rest). */
export function playRun(
  seed: number,
  bot: BotKind,
  chords: readonly ChordLoadout[] = Run.DEFAULT_CHORDS,
  opts: {
    relics?: boolean;
    /** A Calling for the run (docs/phase-3c.md), and which option to take at each tier. */
    calling?: string;
    path?: readonly (0 | 1)[];
    /** The Astrolabe tree the run embarks with (docs/phase-4.md). */
    astrolabe?: readonly string[];
    /** The Reliquary's relics the run carries (docs/phase-4c.md). */
    carried?: readonly ReliquaryRelic[];
    /** The Dissonance the run plays at (docs/phase-4d.md). */
    dissonance?: readonly { id: string; rank: number }[];
    /** Its heroes' talents and Solos (docs/phase-4e.md). */
    bonds?: readonly RunBond[];
    /** The Weaver's technique variants (docs/phase-4f.md). */
    techniques?: Partial<Techniques>;
    /** Calibration: every fight's enemies have this much more life (1.15: 15% more). */
    threatMult?: number;
    /** Called with the finished run (the Deeds report reads it). */
    onEnd?: (run: RunState) => void;
    /** Called with each fight's events as they happen, and once at its end (the Bonds report). */
    onEvents?: (events: readonly SimEvent[]) => void;
    onFight?: () => void;
    /** The Calling's path tiers its mastery has opened (docs/phase-4g.md); absent: every one. */
    tiersOpen?: number;
    /** Called with each phase of the run as it comes up (the pacing report times them). */
    onPhase?: (phase: RunState['phase'], run: RunState) => void;
    /**
     * The route (docs/phase-5a.md): 1, the Prelude (the default, so every calibrated report
     * keeps its baseline); 2, an Expedition through the Crimson Legion; 3, on through the
     * Abyssal Rift to the Unweaver (docs/phase-5c.md).
     */
    movements?: number;
    /**
     * The party (docs/phase-5b.md): 3 hero ids, set in Prep as `Run.setParty` does (content
     * order); absent, the default party, so every calibrated report keeps its baseline.
     */
    party?: readonly string[];
    /**
     * A run already under way to play on from (docs/phase-5c.md): a recorded Vharun interlude,
     * say, played as a real arrival in Movement III. Its route, party, Calling and loadout are
     * its own (`movements`, `party`, `calling` and the creation options are not applied). The
     * summary's fights and Aether count its recorded results too; its minutes count only the
     * fights played from it.
     */
    start?: RunState;
  } = {},
): RunSummary {
  const relics = opts.relics ?? true;
  const movements = opts.movements ?? 1;
  let run: RunState;
  let harmony: HarmonyWatch | null;
  if (opts.start) {
    run = opts.start;
    harmony = run.party.some((h) => CONTENT.heroes.find((d) => d.id === h.heroId)?.passive)
      ? new HarmonyWatch()
      : null;
  } else {
    const created = Run.newRun(
      seed,
      undefined,
      opts.astrolabe ?? [],
      opts.carried ?? [],
      opts.dissonance ?? [],
      opts.bonds ?? [],
      { ...noVariants(), ...opts.techniques },
      movements,
    );
    const fresh = opts.party ? withParty(created, opts.party) : created;
    // Blood and Silk's offers, for a party with a Blood Rage hero only.
    harmony = fresh.party.some((h) => CONTENT.heroes.find((d) => d.id === h.heroId)?.passive)
      ? new HarmonyWatch()
      : null;
    run = Run.embark(Run.setCalling(Run.setChords(fresh, chords), opts.calling ?? null));
    if (opts.tiersOpen !== undefined && run.calling) run = Run.setCallingTiers(run, opts.tiersOpen);
  }
  let seconds = 0;
  const byMovement: number[] = [0];
  let last = '';
  for (let guard = 0; guard < MAX_PHASES && run.phase !== 'summary'; guard++) {
    opts.onPhase?.(run.phase, run);
    harmony?.look(run);
    switch (run.phase) {
      case 'map': {
        const options = Run.reachable(run);
        // Prefer fights early (more motifs), otherwise the first option.
        run = Run.chooseNode(run, options[seed % options.length]!.id);
        break;
      }
      case 'combat': {
        const config = Run.combatConfig(run)!;
        // Calibration: THREAT_PER_ROW=0.05 overrides the run's Threat curve.
        const perRow = process.env.THREAT_PER_ROW;
        if (perRow !== undefined) {
          const row = rowInMovement(run, run.pending!);
          config.threat = 1 + Number(perRow) * Math.max(0, row - 1);
        }
        if (opts.threatMult) config.threat = (config.threat ?? 1) * opts.threatMult;
        const sim = createSim(config);
        const player = makeBot(bot, config.seed);
        for (let t = 0; t < MAX_SECONDS * 60; t++) {
          sim.step(player.decide(sim.state));
          const events = sim.drainEvents();
          opts.onEvents?.(events);
          const s = sim.state.encounter.status;
          if (s === 'victory' || s === 'defeat') break;
        }
        opts.onFight?.();
        last = config.encounter ?? '';
        seconds += sim.state.time;
        const m = movementOfNode(run, run.pending!);
        while (byMovement.length < m) byMovement.push(0);
        byMovement[m - 1]! += sim.state.time;
        run = Run.finishCombat(
          run,
          buildOutcome(
            sim.state,
            sim.config.party.map((p) => p.heroId),
          ),
        );
        break;
      }
      case 'result':
        run = Run.continueFromResult(run);
        break;
      case 'draft':
        run = Run.pickDraft(run, run.draft && run.draft.options.length > 0 ? 0 : null);
        break;
      case 'respite':
        run = Run.respite(run, 'rest');
        break;
      case 'calling': {
        const tier = run.callingOffer!.tier;
        const index = opts.path?.[tier] ?? 0;
        const option = callingOption(run.callingOffer!.options[index]!);
        // An option that grants a slot (Third Voice): fill it, if any aura fits.
        const filled = option.values.slots ? withAnotherAura(run, option.id) : undefined;
        run = Run.pickCalling(run, index, filled);
        break;
      }
      case 'relic':
        run = Run.pickRelic(run, relics ? 0 : null);
        break;
      case 'merchant':
        run = shop(run, relics);
        break;
      case 'forge':
        run = forge(run);
        break;
      case 'event':
        run = event(run, relics);
        break;
      default:
        throw new Error(`unexpected phase ${run.phase}`);
    }
  }
  if (run.phase !== 'summary')
    throw new Error(`run ${seed} (${bot}) did not end within ${MAX_PHASES} phases`);
  opts.onEnd?.(run);
  return {
    seed,
    bot,
    outcome: run.outcome === 'victory' ? 'victory' : 'defeat',
    lastEncounter: last,
    fights: run.results.length,
    minutes: seconds / 60,
    motifs: run.motifs.map((m) => `${m.id}:${m.level}`),
    relics: run.relics.map((r) => (r.cleansed ? `${r.id}*` : r.id)),
    path: run.calling?.path.filter((p): p is string => p !== null) ?? [],
    aetherEarned: run.results.reduce((s, r) => s + r.aether, 0),
    aetherLeft: run.aether,
    bondXp: run.results.reduce<Record<string, number>>((all, r) => {
      for (const [hero, xp] of Object.entries(r.bondXp ?? {})) all[hero] = (all[hero] ?? 0) + xp;
      return all;
    }, {}),
    movementReached: run.path.reduce((m, id) => Math.max(m, movementOfNode(run, id)), 1),
    minutesByMovement: byMovement.map((s) => s / 60),
    ...(harmony
      ? {
          harmony: {
            silkOffered: harmony.silkOffered,
            silkOfferedEligible: harmony.silkOfferedEligible,
            prereqsOwned: harmony.prereqsOwned,
          },
        }
      : {}),
  };
}
