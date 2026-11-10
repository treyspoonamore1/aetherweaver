/**
 * The Expert bot (docs/phase-6.md, "Design: the expert bot", decision 14(a)): the Skilled bot's
 * fight play deciding twice as often (every 2 ticks, a call answered after 0.25 s), every Skilled
 * rule as tuned (Phase 5f's `CONDUCTING_RULES` with `BEAT_AHEAD` 2.8 s and `BANK_WITH_FINALE`
 * false, Phase 5g's `FILL_RULES` and `cueGateCost`), plus its own rules for Phase 6's mechanics
 * (`EXPERT_RULES`). Its run policy (map, drafts, relics, merchants, Respites, the Calling's path)
 * is in expertRun.ts and its Rank 20 build in tools/dissonance.ts: the harness plays them.
 *
 * It is the Skilled bot built with the `expert` option (`SkilledOptions.expert`), which the
 * Skilled bot never sets, so the Novice's and the Skilled bot's commands are unchanged. It has
 * its own generator (salt `EXPERT_SALT`; at full attention it draws nothing). Every rule below
 * reads only public state and content, draws nothing, and is inert without its mechanic: with
 * none of Tyrant, Mimicry, a Mimicking foe, a rising enemy or the Postlude on the field, the
 * Expert plays exactly as the Skilled bot does at its decision rate. Each can be left off by name
 * (`ExpertOptions.skip`, tools/verbs.ts `--bot expert`).
 */
import { attackDef } from '../content';
import { CHOIR } from '../content/crucibleIds';
import type { Command, ReadonlyEntity, WorldState } from '../sim';
import {
  cueOf,
  discordOf,
  effectiveFraction,
  enemiesOf,
  fortissimoLive,
  mimicCasting,
  partyOf,
  unravelUp,
  weaverOf,
} from './common';
import {
  SkilledBot,
  type ConductingRule,
  type ExpertHooks,
  type ExpertRead,
  type FillRule,
  type FinaleRule,
  type M3Rule,
  type RosterRule,
} from './skilled';

/**
 * The Expert's own rules, each a name `ExpertOptions.skip` can turn off. Every one is gated on
 * its mechanic being on the field.
 */
export const EXPERT_RULES = [
  /**
   * Tyrant: a boss casting its borrowed attack when that attack is interruptible (the Hollow
   * Cantor's Mending Hymn, which heals its side) is Focused at once, ahead of every other pick.
   */
  'tyrantFocus',
  /**
   * Tyrant's edict names the borrowed attack and the boss holds its clock (`enemy.tyrant`): while
   * a damaging one a Ward answers is due within `TYRANT_WARD_AHEAD` s (or live), the last Ward
   * charge is kept for it (no call-answer or low-life Ward; its Perfect window takes it as any
   * blow's).
   */
  'tyrantWard',
  /**
   * Mimicry's mark on an ordinary foe (or any Mimicking enemy): while it casts its mirror and no
   * more than `MIMIC_FOCUS_AT` enemies stand, it is Focused at once (the affix's own answer).
   */
  'mimicFocus',
  /**
   * A mirror copying a Ward or a Chime: the Thread goes to Empower for the cast's last
   * `CRACK_AHEAD` s, so the copy no longer matches and the mirror cracks; then back. Never with a
   * mirror copying Empower, a hero down, the threaded hero low, Unravel up or Iron Mask.
   */
  'mimicCrack',
  /**
   * No Focus goes onto an enemy that is standing back up (Restless Dead's rise, the Postlude's):
   * it is untouchable and the heroes look elsewhere until it stands (the reconciled reading of
   * the doc's `restlessHold`: "don't Focus or Chime an enemy about to rise"; a Chime never aims
   * at an enemy, so only the Focus is held).
   */
  'restlessHold',
  /**
   * The Postlude's rise: while the Conductor is untouchable, no damage Cue, no Grand Finale and
   * no last-burn Cue goes into it (a dome still answers a threat).
   */
  'postludeRise',
  /**
   * The Postlude's faster Discord: once it passes `POSTLUDE_BANK_AT` with no Fortissimo Silence
   * live, the Crescendo (on a Conductor run, the Grand Finale itself) and the Cues that would
   * leave it short are held for Fortissimo Silence's cancel (`crescendoCancel` then casts it).
   */
  'postludeBank',
  /**
   * The Postlude's paired Cues: while a voice's Cue is live and another voice stands to answer
   * it, the last Ward charge is kept for the pair's Solos.
   */
  'postludePair',
] as const;
export type ExpertRule = (typeof EXPERT_RULES)[number];

/** A rule the Expert's `skip` can name: its own, or one it inherits from the Skilled bot. */
export type ExpertSkip = ExpertRule | M3Rule | FinaleRule | RosterRule | ConductingRule | FillRule;

// ── The Expert's levers (docs/phase-6.md, Bands: "Expert-only constants", lever 6) ──
/** Ticks between decisions (the Skilled bot's: 4). */
export const EXPERT_EVERY = 2;
/** Seconds before answering a hero's call (the Skilled bot's: 0.4). */
export const EXPERT_CALL_REACTION = 0.25;
/** The Expert's generator's salt (the Skilled bot's is 0x5eed). */
export const EXPERT_SALT = 0xe4be47;
/** `tyrantWard`: the borrowed attack due within this many seconds keeps the last Ward charge. */
const TYRANT_WARD_AHEAD = 2;
/** `tyrantWard`: …and for this long past its ready time, while the boss has yet to cast it. */
const TYRANT_WARD_LATE = 1;
/** `mimicFocus`: a casting Mimic is Focused only while no more than this many enemies stand. */
const MIMIC_FOCUS_AT = 4;
/** `mimicCrack`: the Thread is in Empower for this last part of a mirror's cast (s). */
const CRACK_AHEAD = 0.12;
/** `mimicCrack`: only while the threaded hero keeps more than this share of their life. */
const CRACK_ABOVE = 0.4;
/** `postludeBank`: the Discord past which the Postlude's Crescendo is banked (the doc's 70). */
const POSTLUDE_BANK_AT = 70;

/** The Mimicking affix's id (content `affixes`). */
export const MIMICKING = 'mimicking';
const VOICES: ReadonlySet<string> = new Set(CHOIR);

export interface ExpertOptions {
  /** Rules to leave off (verb ablation): the Expert's own, or any it inherits. */
  skip?: ReadonlySet<ExpertSkip>;
}

const NEUTRAL: ExpertRead = {
  keepWard: false,
  bank: false,
  holdDamage: false,
  focus: null,
  empower: false,
};

/**
 * The Expert's rules as the Skilled bot reads them (`ExpertHooks`), with a tally of the decisions
 * in which each one was met (`fires`: its condition held and it set its flag; `restlessHold`
 * counts the Focuses it took out). A rule met may change nothing the inherited rules don't
 * already do. It only counts, so a fight plays the same whoever reads it.
 */
export class ExpertPlay implements ExpertHooks {
  readonly salt = EXPERT_SALT;
  readonly fires: Record<ExpertRule, number> = Object.fromEntries(
    EXPERT_RULES.map((r) => [r, 0]),
  ) as Record<ExpertRule, number>;

  constructor(private readonly skip: ReadonlySet<ExpertSkip> = new Set()) {}

  on(rule: ExpertRule): boolean {
    return !this.skip.has(rule);
  }

  read(state: WorldState): ExpertRead {
    const now = state.time;
    const boss = bossOf(state);
    const postlude = state.field.finale?.postlude;
    const rising = postlude !== undefined && now < postlude.riseUntil - 1e-9;
    const r: ExpertRead = { ...NEUTRAL };
    let acted = false;
    const fire = (rule: ExpertRule) => {
      acted = true;
      this.fires[rule]++;
    };
    const wc = weaverOf(state).weaver!;

    // ── Tyrant ──
    const hold = boss?.enemy?.tyrant;
    if (boss && hold) {
      const cast = boss.enemy!.cast;
      if (
        this.on('tyrantFocus') &&
        cast !== null &&
        cast.interruptible &&
        cast.attackId === hold.attack
      ) {
        r.focus = boss;
        fire('tyrantFocus');
      }
      const borrowed = attackDef(hold.attack);
      if (
        this.on('tyrantWard') &&
        wc.wardCharges < 2 &&
        borrowed.effect === 'damage' &&
        borrowed.answers.includes('ward')
      ) {
        const live = state.telegraphs.some(
          (t) => t.owner === boss.id && t.attackId === hold.attack && t.impact > now,
        );
        const due = hold.readyAt - now;
        if (live || (due <= TYRANT_WARD_AHEAD && due >= -TYRANT_WARD_LATE)) {
          r.keepWard = true;
          fire('tyrantWard');
        }
      }
    }

    // ── Mimicry: a Mimicking foe's mirror ──
    const enemies = enemiesOf(state);
    const mirrors = mimicCasting(enemies);
    if (mirrors.length > 0) {
      if (this.on('mimicFocus') && r.focus === null && enemies.length <= MIMIC_FOCUS_AT) {
        const m = mirrors.find(
          (x) =>
            x.e.enemy!.affixes.includes(MIMICKING) &&
            x.e.enemy!.tier !== 'boss' &&
            x.e.enemy!.tier !== 'miniboss' &&
            x.e.enemy!.cast?.interruptible === true,
        );
        if (m) {
          r.focus = m.e;
          fire('mimicFocus');
        }
      }
      if (this.on('mimicCrack') && this.crackDue(state, mirrors, now)) {
        r.empower = true;
        fire('mimicCrack');
      }
    }

    // ── The Postlude ──
    if (postlude) {
      if (rising && this.on('postludeRise')) {
        r.holdDamage = true;
        fire('postludeRise');
      }
      const discord = discordOf(state);
      if (
        !rising &&
        this.on('postludeBank') &&
        discord !== null &&
        discord.value >= POSTLUDE_BANK_AT &&
        fortissimoLive(state) === null
      ) {
        r.bank = true;
        fire('postludeBank');
      }
      const cue = cueOf(state);
      if (this.on('postludePair') && cue && wc.wardCharges < 2) {
        const other = enemies.some((e) => VOICES.has(e.enemy!.defId) && e.id !== cue.soloist);
        if (other) {
          r.keepWard = true;
          fire('postludePair');
        }
      }
    }
    return acted ? r : NEUTRAL;
  }

  /**
   * `mimicCrack`'s moment: a mirror copying a Ward or a Chime ends within `CRACK_AHEAD` s, none
   * copies Empower, the Thread is on a hero above `CRACK_ABOVE` in Mend, nobody is down, and
   * neither Unravel nor Iron Mask is up.
   */
  private crackDue(
    state: WorldState,
    mirrors: readonly { copy: 'empower' | 'ward' | 'chime'; end: number }[],
    now: number,
  ): boolean {
    if (state.mods.noEmpower || unravelUp(state) !== null) return false;
    if (mirrors.some((m) => m.copy === 'empower')) return false;
    if (!mirrors.some((m) => m.end - now <= CRACK_AHEAD && m.end > now)) return false;
    const wc = weaverOf(state).weaver!;
    if (wc.threadSlot === null || wc.threadMode === 'bear') return false;
    if (partyOf(state, true).some((h) => h.e.health!.downed)) return false;
    const threaded = partyOf(state).find((h) => h.slot === wc.threadSlot);
    return threaded !== undefined && effectiveFraction(threaded.e) > CRACK_ABOVE;
  }

  filter(state: WorldState, out: Command[]): void {
    if (!this.on('restlessHold')) return;
    for (let i = out.length - 1; i >= 0; i--) {
      const c = out[i]!;
      if (c.t !== 'directive' || c.kind !== 'focus' || c.target === undefined) continue;
      const e = state.entities.get(c.target);
      if (e?.enemy?.state !== 'spawning') continue;
      out.splice(i, 1);
      this.fires.restlessHold++;
    }
  }
}

/** The fight's boss while it stands, or null. */
function bossOf(state: WorldState): ReadonlyEntity | null {
  const id = state.encounter.bossId;
  const e = id === null ? undefined : state.entities.get(id);
  return e?.enemy && e.health && !e.health.dead ? e : null;
}

/** The Expert: the Skilled bot every 2 ticks, with `EXPERT_RULES` (docs/phase-6.md). */
export class ExpertBot extends SkilledBot {
  /** Its rules' tally (`ExpertPlay.fires`). */
  readonly play: ExpertPlay;

  constructor(seed: number, opts: ExpertOptions = {}) {
    const skip = opts.skip ?? new Set<ExpertSkip>();
    const own = new Set<ExpertSkip>(EXPERT_RULES);
    const inherited = new Set([...skip].filter((r) => !own.has(r))) as ReadonlySet<
      M3Rule | FinaleRule | RosterRule | ConductingRule | FillRule
    >;
    const play = new ExpertPlay(skip);
    super(
      seed,
      {
        every: EXPERT_EVERY,
        attention: 1,
        callReaction: EXPERT_CALL_REACTION,
        ...(inherited.size > 0 ? { skip: inherited } : {}),
        expert: play,
      },
      'expert',
    );
    this.play = play;
  }
}

/** Every Expert rule (and only those) left off: for the equivalence with the Skilled bot. */
export const ALL_EXPERT_RULES_OFF: ReadonlySet<ExpertRule> = new Set(EXPERT_RULES);
