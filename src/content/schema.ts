/**
 * CONTRACT v3 — content schemas (docs/plan/05 §7). Content is data, validated with zod at
 * load time and in CI. TypeScript types are inferred from the schemas: one source of truth.
 * Player-facing numbers in text are generated from these values (docs/plan/02 §12 rule 7).
 */
import { z } from 'zod';
import { FINALE_MOVEMENT } from './crucibleIds';

export const IdSchema = z.string().regex(/^[a-z][a-z0-9_]*$/, 'ids are lower snake_case');
export const ColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'colours are #rrggbb');
const Seconds = z.number().nonnegative();
const Pct = z.number().min(0).max(1);

export const AnswerTagSchema = z.enum([
  'ward',
  'chime',
  'reel',
  'focus',
  'scatter',
  'stack',
  'move',
  'dome',
  /** Lift the hero's life above a threshold (Execution, docs/phase-5a.md). */
  'mend',
  // Movement III (docs/phase-5c.md): the Thread's own two verbs.
  /** Retarget: move the Thread off the line, or onto a hero on your side of it. */
  'thread',
  /** Switch the Thread to Empower (Unravel). */
  'empower',
  // The Finale (docs/phase-5d.md)
  /** Cancel it with the Weaver's Crescendo, whatever her Calling (Fortissimo Silence). */
  'crescendo',
]);
export const TelegraphKindSchema = z.enum([
  'cleave',
  'beam',
  'burst',
  'donut',
  'mark',
  'link',
  'raid',
]);
export const StatusIdSchema = z.enum([
  'dirge',
  'resound',
  'silence',
  'stun',
  'stagger',
  'immune',
  'sleep',
  'shaken',
  'held',
  'absolved',
  'anchored',
  // Movement II (docs/phase-5a.md)
  /** Stacking damage over time (an ailment): Chime clears it. */
  'bleed',
  /** Rooted, with damage over time (not an ailment): Reel frees. */
  'pinned',
  /** A Leech's drain (an ailment): Reel or Chime frees. */
  'latched',
  /** Healing received halved (an ailment). */
  'wound',
  /** Blood Pact: damage taken ×1.2 while linked (not an ailment): Scatter. */
  'pact',
  /** Execution's mark (display and recap). */
  'condemned',
  /** An enemy's guard is broken (display only; the state is `guard.brokenUntil`). */
  'guardBroken',
  // Movement III (docs/phase-5c.md)
  /** The Doubt Wraith's mark during its cast (an ailment): Chime cancels it. */
  'doubt',
  /** Possessed (an ailment): disabled, and strikes an ally. Chime frees them. */
  'possessed',
  /** Doom (an ailment, heroes only): stacks to its `burst.at`, then ignites. */
  'doom',
  /** Doom's ignition mark (an ailment), bound to its telegraph. */
  'doomed',
  /** Inside a Void Maw's Inhale: damage over time (not an ailment). */
  'voided',
  /** The Seamstress's Stitch link during its windup (an ailment). */
  'stitch',
  /** Stitched (an ailment): rooted. Chime frees, and a Reel frees the hero it pulls. */
  'stitched',
  /** Display and recap: taking Unravel's reversed Mend. */
  'unravelled',
  /** Display (enemies): the Mimic's Empower copy, or the Unweaver's Thread. */
  'emboldened',
  // The Finale (docs/phase-5d.md)
  /** The Grand Silence's freeze (not an ailment: Chime and immunity can't touch it). */
  'stilled',
  // Phase 5e (docs/phase-5e.md)
  /** Oro's root (enemies only, not an ailment): no approach, chase, charge or leap. */
  'rooted',
]);

/**
 * A status an attack, a basic hit or an affix applies (docs/phase-5a.md P2). Without the
 * optional fields it is today's refresh-only status. `stacks` adds that many stacks (up to
 * `maxStacks`) and refreshes the shared timer; `dps` deals damage per stack per second (× the
 * Movement's damage scale); `pctPerSec` deals that fraction of the target's max HP per second;
 * `drain` heals the source enemy by what it deals.
 */
export const StatusPayloadSchema = z
  .object({
    id: StatusIdSchema,
    duration: Seconds,
    stacks: z.number().int().positive().optional(),
    maxStacks: z.number().int().positive().optional(),
    dps: z.number().nonnegative().optional(),
    pctPerSec: Pct.optional(),
    drain: z.literal(true).optional(),
    /**
     * Movement III (docs/phase-5c.md, Doom): at `at` stacks the status clears and ignites
     * `attack`, a mark, on the hero (heroes only). Absent on every earlier payload.
     */
    burst: z.object({ at: z.number().int().positive(), attack: IdSchema }).strict().optional(),
  })
  .strict();
export type StatusPayload = z.infer<typeof StatusPayloadSchema>;

// ── The Weaver ────────────────────────────────────────────────────────────────────────

export const WeaverDefSchema = z.object({
  maxLife: z.number().int().positive(),
  maxSpirit: z.number().positive(),
  /** Unreserved Spirit regenerates this fraction of its own size per second. */
  spiritRegenPct: Pct,
  moveSpeed: z.number().positive(),
  radius: z.number().positive().max(1.5),
  accel: z.number().positive(),
  decel: z.number().positive(),
  /** Radians per second the formation heading turns toward the movement intent. */
  headingTurnRate: z.number().positive(),
  /** Seconds to re-form after going down. */
  reformTime: Seconds,
  /** Radius of the aura field around the Weaver, in metres. */
  fieldRadius: z.number().positive(),
  /** No field grows past this radius outside a Crescendo, so positioning always matters. */
  fieldRadiusCap: z.number().positive(),
  /**
   * Chord slots (docs/plan/03 §4): Chords, and auras and ornaments per Chord. Chord I is the
   * beam song (it rides the Thread), Chord II the field song (it surrounds the Weaver).
   */
  chords: z.number().int().positive(),
  auraSlots: z.number().int().positive(),
  ornamentSlots: z.number().int().nonnegative(),
  /** Pedal Point: how far from the Weaver a field can be planted, and how often. */
  plantRange: z.number().positive(),
  plantCooldown: Seconds,
  /**
   * The beam song: the threaded hero hears it at `beamFocus` strength, everyone else in its
   * field at `beamEcho` (docs/phase-3.md). The field song is heard at full strength by all.
   */
  beamFocus: z.number().positive(),
  beamEcho: z.number().min(0),
});

export const ThreadDefSchema = z.object({
  mendPerSec: z.number().positive(),
  /** Empower: "more" damage multiplier bonus and attack-speed bonus. */
  empowerMore: Pct,
  empowerAttackSpeed: Pct,
  comfortRange: z.number().positive(),
  snapRange: z.number().positive(),
  /** Potency at the snap range (linear from 1 at comfort range). */
  tautPotency: Pct,
  lockout: Seconds,
  reviveTime: Seconds,
  reviveHpPct: Pct,
});

export const TechniquesDefSchema = z.object({
  ward: z.object({
    name: z.string(),
    cost: z.number().nonnegative(),
    cooldown: Seconds,
    range: z.number().positive(),
    barrierPct: Pct,
    barrierFlat: z.number().nonnegative(),
    duration: Seconds,
    perfectWindow: Seconds,
    perfectRefund: Pct,
    staggerTime: Seconds,
  }),
  chime: z.object({
    name: z.string(),
    cost: z.number().nonnegative(),
    cooldown: Seconds,
    range: z.number().positive(),
    flight: Seconds,
    radius: z.number().positive(),
    immunity: Seconds,
    healPct: Pct,
    clutchWindow: Seconds,
  }),
  reel: z.object({
    name: z.string(),
    cost: z.number().nonnegative(),
    cooldown: Seconds,
    range: z.number().positive(),
    flight: Seconds,
    /** Landing distance in front of the Weaver. */
    landing: z.number().nonnegative(),
  }),
  glide: z.object({
    name: z.string(),
    cooldown: Seconds,
    distance: z.number().positive(),
    duration: Seconds,
    iframes: Seconds,
  }),
});

export const ResonanceDefSchema = z.object({
  max: z.number().positive(),
  segment: z.number().positive(),
  gains: z.object({
    perfectWard: z.number(),
    save: z.number(),
    clutchChime: z.number(),
    reelDodge: z.number(),
    cleanse: z.number(),
    wardAbsorb: z.number(),
    empowerPerSec: z.number(),
    empoweredKill: z.number(),
    /** Answering a hero's call in time. */
    response: z.number(),
  }),
  decayDelay: Seconds,
  decayPerSec: z.number().nonnegative(),
  cueCost: z.number().positive(),
  crescendoCost: z.number().positive(),
});

/** With enough auras active, every Cue also releases a chorus pulse (docs/plan/02 §4.7). */
export const ChorusDefSchema = z.object({
  minAuras: z.number().int().positive(),
  /** Per active aura, as a fraction of each reached hero's max HP. */
  healPctPerAura: Pct,
  barrierPctPerAura: Pct,
  barrierDuration: Seconds,
});

/** Call and Response pacing: how often heroes ask for help (docs/phase-2.md). */
export const CallsDefSchema = z.object({
  /** Seconds into a fight before the first call. */
  firstAfter: Seconds,
  /** Seconds a hero waits after a call before calling again. */
  heroCooldown: Seconds,
  /** Minimum seconds between any two calls. */
  gap: Seconds,
});

export const CrescendoDefSchema = z.object({
  id: IdSchema,
  name: z.string(),
  description: z.string(),
  duration: Seconds,
  auraEffectMult: z.number().positive(),
  radiusMult: z.number().positive(),
  healPct: Pct,
});

// ── Heroes ────────────────────────────────────────────────────────────────────────────

export const HeroRoleSchema = z.enum([
  'tank',
  'ranger',
  'arcanist',
  'berserker',
  'duelist',
  'summoner',
]);
export type HeroRole = z.infer<typeof HeroRoleSchema>;

export const HeroAbilityKindSchema = z.enum([
  'shieldBash',
  'challenge',
  'piercingShot',
  'volley',
  'gravityWell',
  'starbolt',
  // Brann (docs/phase-5b.md).
  'sunderLeap',
  'bloodletting',
  // Seren and Oro (docs/phase-5e.md).
  'lunge',
  'feint',
  'regrowth',
  'bramble',
]);

export const HeroAbilitySchema = z.object({
  id: HeroAbilityKindSchema,
  name: z.string(),
  description: z.string(),
  cooldown: Seconds,
  castTime: Seconds,
  damage: z.number().nonnegative(),
  radius: z.number().nonnegative(),
  range: z.number().positive(),
  stun: Seconds,
  // ── Brann's abilities (docs/phase-5b.md). Absent on every starter ability. ──
  /** Sunder Leap: the nearest a target may be (it leaps at targets `minRange`–`range` away). */
  minRange: z.number().positive().optional(),
  /** Bloodletting: the share of max HP it spends. */
  lifeCost: Pct.optional(),
  /** Bloodletting: it never spends him below this share of max HP. */
  lifeFloor: Pct.optional(),
  /** Bloodletting: the empowered swings it grants. */
  hits: z.number().int().positive().optional(),
  /** Bloodletting: the extra damage on each empowered swing. */
  hitBonus: Pct.optional(),
  // ── Seren's and Oro's abilities (docs/phase-5e.md). Absent on every other ability. ──
  /** Feint: seconds of its hard taunt. */
  taunt: Seconds.optional(),
  /** Feint: metres of its sure sidestep. */
  step: z.number().positive().optional(),
  /** Regrowth: the share of life a re-sprouted Sapling comes back with. */
  regrow: Pct.optional(),
  /** Regrowth: the share of life it heals the more hurt Sapling for, with both standing. */
  healPct: Pct.optional(),
  /** Bramble: seconds of root on the enemies inside it. */
  root: Seconds.optional(),
});

export const SoloKindSchema = z.enum([
  'aegisWall',
  'galeBarrage',
  'starfall',
  'redFrenzy',
  // Seren and Oro (docs/phase-5e.md). Their alternate Solos are KNOWN_ALT_SOLOS, never here.
  'thousandCuts',
  'wildgrowth',
]);

export const HeroSoloSchema = z.object({
  id: SoloKindSchema,
  name: z.string(),
  description: z.string(),
  cuedDescription: z.string(),
  /** Seconds of fighting to charge from 0 to 100. */
  chargeTime: Seconds,
  duration: Seconds,
  /** Kind-specific numbers (damage per hit, shield %, rate…). */
  power: z.number().nonnegative(),
  cuedPower: z.number().nonnegative(),
  // ── Red Frenzy (docs/phase-5b.md). Absent on every starter Solo. ──
  /** Pulses hit every enemy within this many metres. */
  radius: z.number().positive().optional(),
  /** Seconds between pulses. */
  pulse: Seconds.optional(),
  // ── Thousand Cuts (docs/phase-5e.md). Absent on every other Solo. ──
  /** Each blink reaches an enemy within this many metres of her start point. */
  reach: z.number().positive().optional(),
  /** Cued: the most seconds kills can add. */
  extendCap: Seconds.optional(),
});

export const HeroQuirkSchema = z.object({
  id: z.enum([
    'gloryHound',
    'greedyShot',
    'spellbound',
    'bloodlust',
    // Seren and Oro (docs/phase-5e.md).
    'showboat',
    'gentle',
  ]),
  name: z.string(),
  description: z.string(),
  /** Bloodlust: the share of max HP below which it holds (docs/phase-5b.md). */
  below: Pct.optional(),
  /** Showboat (docs/phase-5e.md): she duels the strongest enemy within this many metres of you. */
  leash: z.number().positive().optional(),
  /** Showboat: seconds a duel's pick is sticky. */
  seconds: Seconds.optional(),
  /** Gentle: with no Focus, he steps away from any enemy within this many metres. */
  retreat: z.number().positive().optional(),
});

export const CallAnswerSchema = z.enum(['ward', 'empower', 'chime']);

/**
 * A hero's call: before using one ability, they ask for a specific kind of support. Answer
 * in time and the ability goes off as its Flourish.
 */
export const HeroCallSchema = z.object({
  /** Which of the hero's two abilities the call is for. */
  ability: z.union([z.literal(0), z.literal(1)]),
  answer: CallAnswerSchema,
  /** Seconds the hero waits for the answer before using the plain ability. */
  answerTime: Seconds,
  lines: z.array(z.string().min(1)).min(1),
  /** Said when answered. */
  thanks: z.array(z.string().min(1)).min(1),
  flourish: z.object({
    name: z.string().min(1),
    description: z.string().min(1),
    damageMult: z.number().min(1).default(1),
    radiusMult: z.number().min(1).default(1),
    /** Seconds of stun on everything it hits. */
    stun: Seconds.default(0),
    /** Always crits. */
    crit: z.boolean().default(false),
    /** Solo charge refunded to the hero (0–100). */
    soloCharge: z.number().min(0).max(100).default(0),
    /** Kael: a barrier per enemy taunted (fraction of max HP), up to a cap, and a longer taunt. */
    barrierPerTarget: Pct.default(0),
    barrierCap: Pct.default(0),
    tauntBonus: Seconds.default(0),
  }),
});

export const HeroBarksSchema = z.object({
  quirk: z.array(z.string()).min(1),
  lowHp: z.array(z.string()).min(1),
  saved: z.array(z.string()).min(1),
  perfect: z.array(z.string()).min(1),
  cued: z.array(z.string()).min(1),
  downed: z.array(z.string()).min(1),
  revived: z.array(z.string()).min(1),
  /** Said once when the hero refuses a Rally (Brann's Bloodlust, docs/phase-5b.md). */
  defiant: z.array(z.string()).min(1).optional(),
  // ── Seren and Oro (docs/phase-5e.md). Absent on every other hero. ──
  /** Seren: said on a parry. */
  parried: z.array(z.string()).min(1).optional(),
  /** Oro: said when you Focus (Gentle). */
  focus: z.array(z.string()).min(1).optional(),
  /** Oro: said when a Sapling is felled, at most once per 8 s. */
  saplingFelled: z.array(z.string()).min(1).optional(),
});

/** Blood Rage (Brann, docs/phase-5b.md). */
export const BloodRagePassiveSchema = z
  .object({
    id: z.literal('bloodRage'),
    perMissing: z.number().positive(),
    maxBonus: z.number().min(0).max(2),
    lifesteal: Pct,
    weaverHealMult: Pct,
  })
  .strict();
export type BloodRagePassive = z.infer<typeof BloodRagePassiveSchema>;

/** Parry (Seren, docs/phase-5e.md). */
export const ParryPassiveSchema = z
  .object({
    id: z.literal('parry'),
    /** The counter, as a multiple of her attack. */
    counterPct: z.number().positive(),
    /** The counter strikes an attacker within her reach + this many metres. */
    reach: z.number().nonnegative(),
    /** A kill shot leaps at a target within this many metres (else a thrown lance). */
    killShotRange: z.number().positive(),
    /** A kill shot that doesn't execute deals this multiple of her attack. */
    killShotMult: z.number().positive(),
    /** An elite at or below this share of life is executed by a kill shot. */
    eliteExecuteBelow: Pct,
  })
  .strict();
export type ParryPassive = z.infer<typeof ParryPassiveSchema>;

/** Rootbond (Oro, docs/phase-5e.md). */
export const RootbondPassiveSchema = z
  .object({
    id: z.literal('rootbond'),
    /** Your Thread's Mend on Oro also Mends each living summon at this share. */
    mendShare: Pct,
  })
  .strict();
export type RootbondPassive = z.infer<typeof RootbondPassiveSchema>;

export const HeroPassiveSchema = z.discriminatedUnion('id', [
  BloodRagePassiveSchema,
  ParryPassiveSchema,
  RootbondPassiveSchema,
]);
export type HeroPassive = z.infer<typeof HeroPassiveSchema>;

/** Oro's summons (docs/phase-5e.md): his Saplings and the Ancient. */
export const HeroSummonsSchema = z
  .object({
    sapling: z
      .object({
        count: z.number().int().positive(),
        maxHp: z.number().int().positive(),
        armor: Pct,
        radius: z.number().positive().max(1.5),
        attack: z
          .object({
            damage: z.number().positive(),
            interval: Seconds,
            range: z.number().positive(),
          })
          .strict(),
        /** A taunt pulse on enemies within `radius` m, every `every` s, for `seconds` s. */
        taunt: z
          .object({ radius: z.number().positive(), every: Seconds, seconds: Seconds })
          .strict(),
        /** Seconds before a felled Sapling re-sprouts beside Oro. */
        respawn: Seconds,
        /** Tended (Gentle, no Focus): the extra damage share. */
        tendedBonus: z.number().nonnegative(),
        /** Its planting spots: `forward` m ahead of the Weaver, ±`spread` m. */
        front: z.object({ forward: z.number(), spread: z.number().nonnegative() }).strict(),
      })
      .strict(),
    ancient: z
      .object({
        maxHp: z.number().int().positive(),
        armor: Pct,
        radius: z.number().positive(),
        height: z.number().positive(),
        /** A slam on every enemy within `radius` m. */
        attack: z
          .object({
            damage: z.number().positive(),
            interval: Seconds,
            radius: z.number().positive(),
          })
          .strict(),
        /** Seconds it stands. */
        life: Seconds,
        tauntRadius: z.number().positive(),
        rootRadius: z.number().positive(),
        rootSeconds: Seconds,
      })
      .strict(),
  })
  .strict();
export type HeroSummons = z.infer<typeof HeroSummonsSchema>;

export const HeroDefSchema = z.object({
  id: IdSchema,
  name: z.string().min(1),
  title: z.string().min(1),
  role: HeroRoleSchema,
  color: ColorSchema,
  maxHp: z.number().int().positive(),
  /** Damage taken multiplier from non-telegraphed hits (armour). */
  armor: Pct,
  /** m/s. Must exceed the Weaver's so heroes can keep formation. */
  moveSpeed: z.number().positive().max(12),
  radius: z.number().positive().max(1.5),
  height: z.number().positive(),
  /** Formation slot relative to the Weaver's heading, in metres: +forward, +right. */
  formation: z.object({ forward: z.number(), right: z.number() }),
  attack: z.object({
    kind: z.enum(['melee', 'arrow', 'bolt']),
    damage: z.number().positive(),
    interval: Seconds,
    range: z.number().positive(),
    /** Projectile speed (m/s); 0 = instant. */
    projectileSpeed: z.number().nonnegative(),
    /** Extra enemies a hit chains to. */
    chain: z.number().int().nonnegative(),
    /**
     * Brann's axe (docs/phase-5b.md): every other enemy within `radius` m in the frontal
     * `arcDeg` takes `pct` of the hit. Absent on every starter.
     */
    cleave: z
      .object({ arcDeg: z.number().min(1).max(360), radius: z.number().positive(), pct: Pct })
      .strict()
      .optional(),
  }),
  /** Distance the hero tries to keep from its target. */
  preferredRange: z.number().nonnegative(),
  /** Threat generated per point of damage. */
  threatMult: z.number().positive(),
  /** Chance to step out of a telegraph they notice in time (0 = never). */
  dodge: Pct,
  abilities: z.tuple([HeroAbilitySchema, HeroAbilitySchema]),
  call: HeroCallSchema,
  solo: HeroSoloSchema,
  quirk: HeroQuirkSchema,
  barks: HeroBarksSchema,
  codex: z.string(),
  // ── The roster (docs/phase-5b.md). All optional: absent on every starter. ──
  /**
   * The hero's passive, by id (docs/phase-5e.md): Blood Rage (+`perMissing` × missing life
   * damage, up to `maxBonus`; heals `lifesteal` of what it deals; Weaver healing on the hero
   * ×`weaverHealMult`), Parry or Rootbond. Read Blood Rage through `bloodRageOf(def)`.
   */
  passive: HeroPassiveSchema.optional(),
  /** Oro's summons (docs/phase-5e.md). Absent on every other hero. */
  summons: HeroSummonsSchema.optional(),
  /** What the hero needs from the Weaver, in one line (Prep and the Codex). */
  needs: z.string().optional(),
  /**
   * How a hero outside the default party joins the roster: winning `event`'s fight, or fighting
   * the `fallback` encounter (an encounter id), won or lost. From docs/phase-5e.md: `rank`, the
   * Weaver Rank from which both routes recruit (absent: always); `lockedText`, the Codex's
   * locked line; `fallbackText`, the Result's line for a fallback recruit.
   */
  recruit: z
    .object({
      event: IdSchema,
      fallback: IdSchema.optional(),
      rank: z.number().int().positive().optional(),
      lockedText: z.string().min(1).optional(),
      fallbackText: z.string().min(1).optional(),
    })
    .strict()
    .optional(),
});
export type HeroDef = z.infer<typeof HeroDefSchema>;

// ── Enemies ───────────────────────────────────────────────────────────────────────────

export const TargetingSchema = z.enum([
  'current',
  'farthest',
  'squishiest',
  'randomHero',
  'randomNonTank',
  'pair',
  'self',
  'allHeroes',
  /** The hero with the lowest hp/maxHp; ties broken by slot (Execution). */
  'lowestHp',
  // Movement III (docs/phase-5c.md)
  /** A beam aimed through the Thread's midpoint at cast start (no Thread: the farthest hero). */
  'threadLine',
  /** The living enemy, not the caster, with the most max HP within reach (else the caster). */
  'allyEnemy',
]);

export const AttackDefSchema = z.object({
  id: IdSchema,
  name: z.string(),
  kind: TelegraphKindSchema,
  /**
   * What it does when it resolves. `script`: nothing; a boss script owns it (docs/phase-5a.md).
   * Movement III (docs/phase-5c.md): `zone` lays its `zone` and nothing else; `mimic` copies the
   * Weaver's technique onto its beneficiary.
   */
  effect: z.enum(['damage', 'healAllies', 'summon', 'suppress', 'script', 'zone', 'mimic']),
  windup: Seconds,
  cooldown: Seconds,
  /** Seconds before the first use after the enemy engages. */
  initialDelay: Seconds,
  damage: z.number().nonnegative(),
  /**
   * Alternative to `damage`: fraction of the target's max HP. Above 1 only for a blow lethal from
   * full life (the Finale's Final Cadence, docs/phase-5d.md); the content lint keeps that on
   * Movement 4's attacks.
   */
  pctMaxHp: z.number().nonnegative().optional(),
  radius: z.number().nonnegative(),
  angleDeg: z.number().min(0).max(360),
  length: z.number().nonnegative(),
  width: z.number().nonnegative(),
  innerRadius: z.number().nonnegative(),
  /** Max distance from the target to start the attack. */
  range: z.number().positive(),
  targeting: TargetingSchema,
  answers: z.array(AnswerTagSchema).min(1),
  status: StatusPayloadSchema.optional(),
  interruptible: z.boolean(),
  /**
   * Summon: enemy id and count, and at most `maxAlive` of that enemy alive at once (Movement
   * II). Heal: amount per second (uses `damage`).
   */
  summon: z
    .object({
      enemy: IdSchema,
      count: z.number().int().positive(),
      maxAlive: z.number().int().positive().optional(),
    })
    .optional(),
  /**
   * Boss decree text, announced when it starts: what's coming, then how to answer it in later
   * sentences (Blind Score, Dissonance, shows only the first).
   */
  decree: z.string().optional(),
  /** Announce the decree only on the first N casts of a fight (absent: every cast). */
  decreeLimit: z.number().int().positive().optional(),
  /**
   * The decree as the HUD shows it when no party hero has a dome (`partyHasDome`, docs/phase-5b.md):
   * the same sentence with the dome clause removed. Display only: never copied into sim state.
   */
  decreeNoDome: z.string().optional(),
  // ── Movement II (docs/phase-5a.md P5, P7). All optional: absent reproduces Movement I. ──
  /** The status a `mark` applies (absent: 'dirge'; null: none, and no chimed-away check). */
  markStatus: StatusIdSchema.nullable().optional(),
  /** The status a `link` applies (absent: 'resound'). */
  linkStatus: z.enum(['resound', 'pact', 'stitch']).optional(),
  /** The caster moves with the attack: to a beam's end (charge) or a burst's centre (leap). */
  move: z.enum(['charge', 'leap']).optional(),
  /**
   * A burst centred on its target rather than the caster; `weaver` (Movement III): at the
   * Weaver's feet, and not begun while she is absent or down.
   */
  centre: z.enum(['target', 'weaver']).optional(),
  /** A beam runs its full length, not capped just past its target. */
  fullLength: z.literal(true).optional(),
  /** Another attack that begins as this one resolves (`reverse`: aimed 180° from facing). */
  followUp: z
    .object({
      attack: IdSchema,
      delay: Seconds,
      reverse: z.literal(true).optional(),
    })
    .strict()
    .optional(),
  /** Only a boss script or a follow-up starts it: the generic special picker skips it. */
  scripted: z.literal(true).optional(),
  /** A target below this fraction of its max HP when it resolves is executed (hp + 1 damage). */
  executeBelow: Pct.optional(),
  // ── Movement III (docs/phase-5c.md). All optional: absent reproduces Movements I and II. ──
  /**
   * It cuts the Thread for `lock` seconds: a line whose rectangle crosses the Thread when it
   * resolves, or (`always`) unconditionally.
   */
  cut: z
    .object({ lock: Seconds, always: z.literal(true).optional() })
    .strict()
    .optional(),
  /**
   * A timed zone it lays when it resolves (effect `zone`): `pull` drags heroes and the Weaver
   * toward its centre at `pullSpeed` m/s and refreshes `status` on them; `null` refuses the
   * Weaver's Ward, Chime and Reel inside it. Centred on the caster or on the attack's target.
   */
  zone: z
    .object({
      kind: z.enum(['pull', 'null']),
      radius: z.number().positive(),
      duration: Seconds,
      at: z.enum(['caster', 'target']),
      pullSpeed: z.number().positive().optional(),
      status: StatusPayloadSchema.optional(),
    })
    .strict()
    .optional(),
  // ── The Finale (docs/phase-5d.md). All optional: absent reproduces Movements I-III. ──
  /**
   * The Conductor's Discord this telegraph adds when it fails (a victim took damage nobody
   * answered). Its presence runs the verdict; a lint keeps it on Finale attacks.
   */
  discord: z.number().nonnegative().optional(),
  /** How many failed victims fail the telegraph (absent: 1). Only with `discord`. */
  discordQuorum: z.number().int().min(1).optional(),
});
export type AttackDef = z.infer<typeof AttackDefSchema>;

export const EnemyRoleSchema = z.enum([
  'swarm',
  'brute',
  'caster',
  'sniper',
  'controller',
  'support',
  'miniboss',
  'boss',
]);

export const EnemyDefSchema = z.object({
  id: IdSchema,
  name: z.string(),
  role: EnemyRoleSchema,
  hp: z.number().positive(),
  speed: z.number().positive(),
  radius: z.number().positive().max(2.5),
  height: z.number().positive(),
  /** Porcelain body and crack/emissive accent (docs/plan/04 §1). */
  color: ColorSchema,
  accent: ColorSchema,
  basic: z.object({
    kind: z.enum(['melee', 'bolt']),
    damage: z.number().nonnegative(),
    interval: Seconds,
    range: z.number().positive(),
    /** A status each basic hit that lands applies (the Sanguine Hound's bleed). */
    onHit: StatusPayloadSchema.optional(),
  }),
  /** Distance kept from the target (0 = melee). */
  preferredRange: z.number().nonnegative(),
  specials: z.array(IdSchema),
  /** Aura suppression field radius (Mutes); 0 = none. */
  suppressRadius: z.number().nonnegative(),
  codex: z.string(),
  // ── Movement II (docs/phase-5a.md). All optional: absent reproduces Movement I. ──
  /**
   * A guard arc (P6): hits from heroes inside `arcDeg` of its guard direction deal ×`frontMult`.
   * The guard turns `turnRate` degrees per second toward its target; a guard break lasts
   * `breakTime` seconds.
   */
  guard: z
    .object({
      arcDeg: z.number().positive().max(360),
      frontMult: Pct,
      turnRate: z.number().positive(),
      breakTime: Seconds,
    })
    .strict()
    .optional(),
  /** What it's made of (death debris and kill sounds); absent: porcelain. */
  material: z.enum(['porcelain', 'iron', 'cloth', 'glass']).optional(),
  /** The Movement it belongs to (absent: 1). */
  movement: z.number().int().positive().optional(),
  // ── Movement III (docs/phase-5c.md). All optional: absent reproduces Movements I and II. ──
  /** It never moves (no approach, no chase-turn), and nothing pulls it; it still bites and casts. */
  stationary: z.literal(true).optional(),
  /** While one stands, the boss that summoned it takes `dr` less damage from heroes. */
  tether: z.object({ dr: Pct }).strict().optional(),
});
export type EnemyDef = z.infer<typeof EnemyDefSchema>;

export const AffixDefSchema = z.object({
  id: IdSchema,
  name: z.string(),
  description: z.string(),
  color: ColorSchema,
  /** The first Movement whose elites may roll it (absent: 1). */
  movement: z.number().int().positive().optional(),
  /** A status the affixed enemy's hits that land apply (Vampiric's wound). */
  onHit: StatusPayloadSchema.optional(),
  /** How the affix is answered (the HUD glyph and the death recap). */
  answers: z.array(AnswerTagSchema).min(1).optional(),
  // ── Movement III (docs/phase-5c.md). All optional. ──
  /** Severing: a hit it lands while the Thread passes within `radius` m cuts it for `lock` s. */
  cut: z.object({ radius: z.number().positive(), lock: Seconds }).strict().optional(),
  /** Silencing: it carries a Mute's aura suppression field of this radius. */
  suppressRadius: z.number().positive().optional(),
  /** Mimicking: attacks it also casts, each on that attack's own cooldown. */
  specials: z.array(IdSchema).min(1).optional(),
});
export type AffixDef = z.infer<typeof AffixDefSchema>;

// ── Auras ─────────────────────────────────────────────────────────────────────────────

export const AuraDefSchema = z.object({
  id: IdSchema,
  name: z.string(),
  subtitle: z.string(),
  color: ColorSchema,
  /** Fraction of max Spirit reserved while active. */
  reserve: Pct,
  description: z.string(),
  effects: z.object({
    regenPctPerSec: Pct.default(0),
    barrierPct: Pct.default(0),
    attackSpeed: Pct.default(0),
    moveSpeed: Pct.default(0),
    damage: Pct.default(0),
    flatDamage: z.number().nonnegative().default(0),
    enemySlow: Pct.default(0),
    enemyWindup: Pct.default(0),
    /** Fermata: below this fraction of max HP, heroes take `guardDr` less damage. */
    guardBelow: Pct.default(0),
    guardDr: Pct.default(0),
    /** Fermata: once per encounter, a lethal hit holds the hero at 1 HP for this long. */
    holdTime: Seconds.default(0),
  }),
});
export type AuraDef = z.infer<typeof AuraDefSchema>;

// ── Ornaments ─────────────────────────────────────────────────────────────────────────

/** Where a Chord's field sits: around the Weaver, or where Pedal Point planted it. */
export const ChordAnchorSchema = z.enum(['weaver', 'planted']);
/** Chord I is the beam song (rides the Thread), Chord II the field song (around the Weaver). */
export const ChordRoleSchema = z.enum(['beam', 'field']);

/** Ornaments change both auras in their Chord (docs/plan/03 §4). One copy of each. */
export const OrnamentDefSchema = z.object({
  id: IdSchema,
  name: z.string(),
  subtitle: z.string(),
  color: ColorSchema,
  description: z.string(),
  reserveMult: z.number().positive().default(1),
  effectMult: z.number().positive().default(1),
  radiusMult: z.number().positive().default(1),
  /** Where the Chord's field sits (Pedal Point plants it). */
  anchor: ChordAnchorSchema.default('weaver'),
  /** Beam song only: multiplies the strength on the threaded hero (Unison ×1.25). */
  focusMult: z.number().positive().default(1),
  /** Beam song only: multiplies the echo everyone else hears (Unison 0: no echo). */
  echoMult: z.number().min(0).default(1),
  /** The songs this ornament fits (Unison only makes sense on the beam). */
  roles: z.array(ChordRoleSchema).min(1).default(['beam', 'field']),
  /** Ornaments that can't share a Chord with this one. */
  excludes: z.array(IdSchema).default([]),
});
export type OrnamentDef = z.infer<typeof OrnamentDefSchema>;

// ── Triggers (docs/phase-5g.md, "The trigger system") ─────────────────────────────────

/**
 * The sim events a trigger reacts to (sim/events.ts, by their `type`), and `every`: a timer
 * that fires every `period` seconds its conditions hold.
 */
export const TRIGGER_EVENTS = [
  'perfectWard',
  'save',
  'cleansed',
  'chimeLanded',
  'reeled',
  'glided',
  'threadAttached',
  'threadSnapped',
  'techniqueCast',
  'shieldBroken',
  /** Only with the Weaver as the target. */
  'damageTaken',
  'abilityUsed',
  'cued',
  'crescendoStart',
  'crescendoEnd',
  'allyDowned',
  'revived',
  'parried',
  'summonFell',
  'enemyKilled',
  'every',
] as const;
export type TriggerEvent = (typeof TRIGGER_EVENTS)[number];

/**
 * Who a trigger's effect lands on. `event`: the event's hero (the Warded, cleansed, Reeled, Cued,
 * revived, downed or parrying hero; the hero a technique, a Thread, a shield or an ability belongs
 * to; a fallen summon's owner). `threaded`: the threaded hero. `all`: every standing hero.
 * `others`: every standing hero but the event's. `near`: every standing hero within `radius` of
 * `at`. `nearestOther`: the standing hero nearest the event's hero within `radius`, never the
 * event's own. `neediest`: the standing hero with the least of their life (a share), never the
 * event's or the threaded one. Ties go to the nearer, then the lower entity id: no draws.
 */
export const TRIGGER_TARGETS = [
  'event',
  'threaded',
  'all',
  'others',
  'near',
  'nearestOther',
  'neediest',
] as const;
export type TriggerTarget = (typeof TRIGGER_TARGETS)[number];

/**
 * Where an effect is centred: the event's place (its hero, or its x/z), the Weaver, the threaded
 * hero, or the event's hero wherever the event itself sits (`abilityUsed` sits at the struck
 * enemy; its hero is the one who acted).
 */
export const TRIGGER_POINTS = ['event', 'weaver', 'threaded', 'hero'] as const;
export type TriggerPoint = (typeof TRIGGER_POINTS)[number];

/** Shield kinds, as the sim names them (sim/state.ts `ShieldKind`). */
export const SHIELD_KINDS = ['ward', 'dome', 'barrier', 'overshield', 'discord', 'mirror'] as const;

/**
 * A trigger's number: a literal, `'v'` (a motif's value at its level), or the name of one of a
 * relic's or boon's `values` (its Empowered number when a Dissonate Empowered it). Display units:
 * percent as 25, seconds as 1.5.
 */
export const TriggerValueSchema = z.union([z.number(), z.string().regex(/^[a-z][a-zA-Z]*$/)]);
export type TriggerValue = z.infer<typeof TriggerValueSchema>;

const TriggerHeroes = {
  to: z.enum(TRIGGER_TARGETS).default('event'),
  /** `near`: the reach around `at`; `nearestOther`: around the event's hero (metres). */
  radius: z.number().positive().optional(),
  /** `near`: where it is measured from (default the event's place). */
  at: z.enum(TRIGGER_POINTS).optional(),
  /** Only heroes standing in your field (`hero.inField`: read, never written). */
  inField: z.literal(true).optional(),
};

/** What a trigger does when it fires (each through the sim's own function for it). */
export const TriggerEffectSchema = z.discriminatedUnion('kind', [
  /** A barrier (an overshield, the Weaver's) of `pct`% of each hero's life for `seconds`. */
  z
    .object({
      kind: z.literal('barrier'),
      pct: TriggerValueSchema,
      seconds: TriggerValueSchema,
      ...TriggerHeroes,
    })
    .strict(),
  /** A heal of `pct`% of each hero's life, or (`of: 'event'`) of the event's amount. */
  z
    .object({
      kind: z.literal('heal'),
      pct: TriggerValueSchema,
      of: z.enum(['life', 'event']).default('life'),
      ...TriggerHeroes,
    })
    .strict(),
  z.object({ kind: z.literal('resonance'), amount: TriggerValueSchema }).strict(),
  /** Spirit back, never above the unreserved pool. */
  z.object({ kind: z.literal('spirit'), amount: TriggerValueSchema }).strict(),
  /** Solo charge (0–100) on each hero whose Solo isn't running. */
  z.object({ kind: z.literal('solo'), pct: TriggerValueSchema, ...TriggerHeroes }).strict(),
  /**
   * Damage, the Weaver's, to every enemy within `radius` of `at` (or the `nearest` n of them):
   * `amount`, or (`of: 'riposte'`) `amount`% of Riposte Bloom's power.
   */
  z
    .object({
      kind: z.literal('damage'),
      amount: TriggerValueSchema,
      of: z.literal('riposte').optional(),
      at: z.enum(TRIGGER_POINTS).default('event'),
      radius: z.number().positive(),
      nearest: z.number().int().positive().optional(),
    })
    .strict(),
  /**
   * A status on every ordinary enemy within `radius` of `at` (`'event'`: the event's own radius,
   * a Chime's), for `seconds`.
   */
  z
    .object({
      kind: z.literal('status'),
      status: z.enum(['stun', 'sleep']),
      seconds: TriggerValueSchema,
      at: z.enum(TRIGGER_POINTS).default('event'),
      radius: z.union([z.number().positive(), z.literal('event')]),
    })
    .strict(),
  /** The Weaver's techniques recover `seconds` at once (a Ward or Glide charge comes back at 0). */
  z
    .object({
      kind: z.literal('cooldown'),
      techniques: z.array(z.enum(['ward', 'chime', 'reel', 'glide'])).min(1),
      seconds: TriggerValueSchema,
    })
    .strict(),
  /** A hero's ability (by its id: `challenge`, `piercingShot`) recovers `seconds` at once. */
  z
    .object({
      kind: z.literal('ability'),
      ability: HeroAbilityKindSchema,
      seconds: TriggerValueSchema,
      ...TriggerHeroes,
    })
    .strict(),
  /** Empowered for `seconds`, Thread or not (`hero.afterglowUntil`; the later time stands). */
  z.object({ kind: z.literal('empower'), seconds: TriggerValueSchema, ...TriggerHeroes }).strict(),
  /** A playing Crescendo lasts `seconds` longer, at most `cap` seconds more in one Crescendo. */
  z
    .object({ kind: z.literal('crescendo'), seconds: TriggerValueSchema, cap: TriggerValueSchema })
    .strict(),
]);
export type TriggerEffect = z.infer<typeof TriggerEffectSchema>;

/**
 * A data-driven rule (docs/phase-5g.md, "The trigger system"): when `on` happens and every
 * condition holds, each effect is applied, at most once every `every` seconds and `perFight`
 * times a fight. Read by sim/systems/triggers.ts; inert without a motif, relic or boon holding one.
 */
export const TriggerDefSchema = z
  .object({
    on: z.enum(TRIGGER_EVENTS),
    /** `every`: the timer's period, in seconds its conditions held. */
    period: TriggerValueSchema.optional(),
    // ── Conditions (all must hold) ──
    /** The event's hero is this hero (content id). */
    hero: IdSchema.optional(),
    /** `techniqueCast`: this technique (`rewind`: the Chronomancer's, in Reel's slot). */
    technique: z.enum(['ward', 'chime', 'reel', 'glide', 'rewind']).optional(),
    /** `abilityUsed`: this ability id. */
    ability: HeroAbilityKindSchema.optional(),
    /** `shieldBroken`: this kind of shield. */
    shield: z.enum(SHIELD_KINDS).optional(),
    /**
     * `shieldBroken`: used up (by a blow, or a parry), not spent by a Perfect Ward: no
     * `perfectWard` on the same holder in the same tick.
     */
    usedUp: z.literal(true).optional(),
    /** `threadAttached`: to a different hero than the Thread was last on (never the first). */
    moved: z.literal(true).optional(),
    /** `techniqueCast`: one of these technique variants (docs/phase-4f.md), never the default. */
    variant: z.array(IdSchema).min(1).optional(),
    /** `summonFell`: this kind of summon. */
    summon: z.enum(['sapling', 'ancient']).optional(),
    /** The Thread is on a hero, in this mode. */
    thread: z.enum(['mend', 'empower', 'bear']).optional(),
    /** A Crescendo is playing. */
    crescendo: z.literal(true).optional(),
    /** `cued`: another hero was Cued within this many seconds before. */
    cueWithin: z.number().positive().optional(),
    /** `cleansed`, `chimeLanded`: a Clutch Cleanse. */
    clutch: z.literal(true).optional(),
    /** `cleansed`: it took off at least one ailment. */
    removed: z.literal(true).optional(),
    /** `enemyKilled`: the slain enemy's content role. */
    role: EnemyRoleSchema.optional(),
    // ── Limits (their clocks live in `world.internal.triggers`) ──
    /** Seconds between fires. */
    every: z.number().positive().optional(),
    /** Fires a fight. */
    perFight: z.number().int().positive().optional(),
    effects: z.array(TriggerEffectSchema).min(1),
  })
  .strict();
export type TriggerDef = z.infer<typeof TriggerDefSchema>;

/** Every number-or-name a trigger holds, in a fixed order (the lint and the resolver read them). */
export function triggerValues(t: TriggerDef): TriggerValue[] {
  const out: TriggerValue[] = [];
  if (t.period !== undefined) out.push(t.period);
  for (const e of t.effects) {
    switch (e.kind) {
      case 'barrier':
        out.push(e.pct, e.seconds);
        break;
      case 'heal':
      case 'solo':
        out.push(e.pct);
        break;
      case 'resonance':
      case 'spirit':
      case 'damage':
        out.push(e.amount);
        break;
      case 'status':
      case 'cooldown':
      case 'ability':
      case 'empower':
        out.push(e.seconds);
        break;
      case 'crescendo':
        out.push(e.seconds, e.cap);
        break;
    }
  }
  return out;
}

// ── Motifs ────────────────────────────────────────────────────────────────────────────

export const MotifCategorySchema = z.enum(['silk', 'aegis', 'choir', 'bond', 'finale']);
export const MotifRaritySchema = z.enum(['common', 'rare', 'epic']);

export const MotifDefSchema = z
  .object({
    id: IdSchema,
    name: z.string(),
    category: MotifCategorySchema,
    rarity: MotifRaritySchema,
    /** One value per level; `text` shows the current level's value as {v}. */
    values: z.array(z.number()).min(1).max(3),
    text: z.string().includes('{v}'),
    requires: z
      .object({
        aura: IdSchema.optional(),
        hero: IdSchema.optional(),
        /** A Harmony (docs/phase-5b.md): offered only while every listed motif is owned. */
        motifs: z.array(IdSchema).min(1).optional(),
        /** Offered only from this Movement on (docs/phase-5c.md); it sleeps in earlier fights. */
        movement: z.number().int().positive().optional(),
        /**
         * Offered only on an Expedition (docs/phase-5g.md, decision 4): the run layer drops it on
         * a Prelude before any draw. Optional with no default, so older motifs parse as before.
         */
        expedition: z.literal(true).optional(),
      })
      .default({}),
    tags: z.array(z.string()).default([]),
    /**
     * Its rules for the trigger system (docs/phase-5g.md), `'v'` standing for its value at its
     * level. Optional with no default: a motif without any parses to the same JSON as before.
     */
    triggers: z.array(TriggerDefSchema).min(1).optional(),
  })
  .strict();
export type MotifDef = z.infer<typeof MotifDefSchema>;

// ── Relics, boons and events (docs/phase-3b.md) ─────────────────────────────────────

/** Named numbers in display units (25 = 25%, 4 = 4 s); `text` shows them as {name}. */
const ValuesSchema = z.record(z.string().regex(/^[a-z][a-zA-Z]*$/), z.number()).default({});

export const RelicRaritySchema = z.enum(['common', 'rare', 'legendary', 'cursed']);
export type RelicRarity = z.infer<typeof RelicRaritySchema>;

/**
 * A relic: something the Weaver carries for the rest of the run. Unlike a motif it changes a
 * rule rather than a number. The sim's relic resolver (sim/mods.ts) knows what each id does.
 */
export const RelicDefSchema = z
  .object({
    id: IdSchema,
    name: z.string(),
    rarity: RelicRaritySchema,
    /** The blessing, with {value} placeholders filled from `values`. */
    text: z.string(),
    /** Cursed relics: the price, lifted when a Forge cleanses it. */
    curse: z.string().optional(),
    flavor: z.string(),
    values: ValuesSchema,
    /** Only the run layer reads it (drafts, shops); the sim ignores it. */
    runOnly: z.boolean().default(false),
    /** Glyph key for the UI. */
    icon: IdSchema,
    /**
     * The Reliquary (docs/phase-4c.md): its numbers once a Dissonate Empowers it, replacing
     * `values` key by key. Without them, it can't be Empowered.
     */
    empowered: z.object({ values: ValuesSchema }).strict().optional(),
    /**
     * Offered only from this Movement on (docs/phase-5c.md); carried into an earlier fight, it
     * sleeps (absent: 1).
     */
    movement: z.number().int().positive().optional(),
    /**
     * Offered only on an Expedition (docs/phase-5g.md, decision 4): drafts, shops, relic offers,
     * events and Discordant Pact drop it on a Prelude before any draw. A carried one works on any
     * route. Optional with no default, so older relics parse as before.
     */
    expedition: z.literal(true).optional(),
    /**
     * Its rules for the trigger system (docs/phase-5g.md), naming its `values` (Empowered ones
     * when Empowered). Optional with no default.
     */
    triggers: z.array(TriggerDefSchema).min(1).optional(),
  })
  .strict();
export type RelicDef = z.infer<typeof RelicDefSchema>;

/** A boon (or a bane) from an event: lasts some fights, or the rest of the run. */
export const BoonDefSchema = z
  .object({
    id: IdSchema,
    name: z.string(),
    kind: z.enum(['boon', 'bane']),
    text: z.string(),
    values: ValuesSchema,
    /** Fights it lasts; null = the rest of the run. */
    fights: z.number().int().positive().nullable(),
    icon: IdSchema,
    /** Its rules for the trigger system (docs/phase-5g.md), naming its `values`. Optional. */
    triggers: z.array(TriggerDefSchema).min(1).optional(),
  })
  .strict();
export type BoonDef = z.infer<typeof BoonDefSchema>;

export const EventEffectSchema = z.discriminatedUnion('kind', [
  /** A random relic of this rarity the Weaver doesn't carry yet. */
  z.object({ kind: z.literal('relic'), rarity: RelicRaritySchema }).strict(),
  z.object({ kind: z.literal('aether'), amount: z.number().int() }).strict(),
  /** Every hero heals this fraction of max HP. */
  z.object({ kind: z.literal('heal'), pct: Pct }).strict(),
  /** Every hero loses this fraction of max HP (never below 5%). */
  z.object({ kind: z.literal('hurt'), pct: Pct }).strict(),
  z.object({ kind: z.literal('boon'), boon: IdSchema }).strict(),
  /** Change the Chords (the same rules as a Respite's Retune). */
  z.object({ kind: z.literal('retune') }).strict(),
  /** The chosen motif gains levels (up to its last). */
  z.object({ kind: z.literal('motifLevels'), levels: z.number().int().positive() }).strict(),
  /** The chosen motif is lost. */
  z.object({ kind: z.literal('loseMotif') }).strict(),
  /**
   * A fight; winning it offers `relics` relics to choose from, and recruits the `recruit` hero
   * for later runs (docs/phase-5b.md; only when it is won).
   */
  z
    .object({
      kind: z.literal('fight'),
      encounter: IdSchema,
      relics: z.number().int().positive(),
      recruit: IdSchema.optional(),
    })
    .strict(),
]);
export type EventEffect = z.infer<typeof EventEffectSchema>;

export const EventChoiceSchema = z
  .object({
    id: IdSchema,
    label: z.string(),
    /** What it does, plainly (shown under the label). */
    text: z.string(),
    /** Aether it costs; it can't be chosen without it. */
    cost: z.number().int().nonnegative().default(0),
    /** The player picks one of their motifs for it ('upgradable': below its last level). */
    motif: z.enum(['none', 'any', 'upgradable']).default('none'),
    effects: z.array(EventEffectSchema).default([]),
    /** Shown after choosing. */
    outcome: z.string(),
    /** A gamble: `chance` of `effects` and `outcome`, otherwise `fail` and `failOutcome`. */
    chance: Pct.optional(),
    fail: z.array(EventEffectSchema).default([]),
    failOutcome: z.string().optional(),
    /** A recruiting choice's `text` once its hero is in the roster (docs/phase-5b.md). */
    recruitedText: z.string().optional(),
    /** …and once that hero is in the party (it wins over `recruitedText`). */
    partyText: z.string().optional(),
    /**
     * A Rank-gated recruiting choice (docs/phase-5e.md): hidden, and refused, below the Rank its
     * recruit's `recruit.rank` names. It always comes after every unranked choice.
     */
    rank: z.number().int().positive().optional(),
  })
  .strict();
export type EventChoice = z.infer<typeof EventChoiceSchema>;

/** A map event: a scene and a few choices, each with a price or a risk (docs/phase-3b.md). */
export const RunEventDefSchema = z
  .object({
    id: IdSchema,
    name: z.string(),
    /** The scene, shown on arrival. */
    text: z.string(),
    /** One line for the map tooltip. */
    teaser: z.string(),
    choices: z.array(EventChoiceSchema).min(2).max(4),
    icon: IdSchema,
    /** The Movement whose map holds it (absent: 1). */
    movement: z.number().int().positive().optional(),
  })
  .strict();
export type RunEventDef = z.infer<typeof RunEventDefSchema>;

// ── Callings (docs/phase-3c.md) ─────────────────────────────────────────────────────

export const CallingOptionSchema = z
  .object({
    id: IdSchema,
    name: z.string(),
    /** What it does, with {value} placeholders filled from `values`. */
    text: z.string(),
    values: ValuesSchema,
    icon: IdSchema,
  })
  .strict();
export type CallingOption = z.infer<typeof CallingOptionSchema>;

/**
 * A Calling: the Weaver's class for a run. A passive, its own take on the Crescendo, and a
 * path of tiers, each a pick between two options made during the run. The sim's Calling
 * resolver (sim/mods.ts) knows what each id does.
 */
export const CallingDefSchema = z
  .object({
    id: IdSchema,
    name: z.string(),
    /** "the aura sovereign" */
    title: z.string(),
    /** One plain sentence on what it does, for the rank-up card and short tooltips. */
    summary: z.string(),
    /** The passive, with {value} placeholders. */
    text: z.string(),
    /** What it does to the Crescendo, with {value} placeholders. */
    crescendo: z.string(),
    /** Its own Crescendo's name, when it replaces Sunrise (the Martyr's Vow). */
    crescendoName: z.string().optional(),
    /** What its songs reserve: Spirit, or Life (the Martyr). */
    reserves: z.enum(['spirit', 'life']).default('spirit'),
    flavor: z.string(),
    values: ValuesSchema,
    /** The Weaver Rank that unlocks it. */
    unlockRank: z.number().int().positive(),
    icon: IdSchema,
    tiers: z
      .array(z.object({ options: z.array(CallingOptionSchema).length(2) }).strict())
      .min(1)
      .max(6),
  })
  .strict();
export type CallingDef = z.infer<typeof CallingDefSchema>;

// ── The Astrolabe (docs/phase-4.md) ───────────────────────────────────────────────────

export const AstrolabeNodeSchema = z
  .object({
    id: IdSchema,
    name: z.string(),
    /** `travel`: a small step; `great`: Bond's rim notables, in place of keystones. */
    kind: z.enum(['start', 'travel', 'notable', 'great', 'keystone']),
    constellation: z.enum(['centre', 'silk', 'choir', 'aegis', 'bond', 'bridge']),
    /** Map units, north up. */
    x: z.number(),
    y: z.number(),
    /** What it does: the sim's Astrolabe resolver knows each effect (sim/mods.ts). */
    effect: IdSchema,
    values: ValuesSchema,
    /** With {value} placeholders filled from `values`. */
    text: z.string(),
  })
  .strict();
export type AstrolabeNode = z.infer<typeof AstrolabeNodeSchema>;

/** The nodes and the links between them, each link listed once. */
export const AstrolabeSchema = z
  .object({
    nodes: z.array(AstrolabeNodeSchema).min(1),
    links: z.array(z.tuple([IdSchema, IdSchema])),
  })
  .strict();
export type Astrolabe = z.infer<typeof AstrolabeSchema>;

// ── Deeds (docs/phase-4b.md) ─────────────────────────────────────────────────────────

/** The rules a Deed can name; meta/deeds.ts judges each from what the run records. */
export const DEED_TESTS = [
  'win',
  'runCount',
  'grades',
  'fight',
  'callAll',
  'calling',
  'keystone',
  'elites',
  'flawless',
  'saveWays',
  /** Beat the encounter with the hero, never above `pct`% life once they first fell to it. */
  'heroCeiling',
  /**
   * Beat the encounter with the hero, with one of their fight tallies (`tally`) at least
   * `values.atLeast` or at most `values.atMost` (docs/phase-5e.md).
   */
  'heroTally',
  // ── Phase 6 (docs/phase-6.md, "Design: Deeds"): appended; no Deed names them yet. ──
  /** Beat Movement `movement`'s boss with `stat` at 0 in every one of that Movement's fights. */
  'movementWithout',
  /**
   * Clear the Finale at `values.points` Dissonance or more, with `level` on if it names one, or
   * with every level at its top rank (`allLevels`).
   */
  'dissonance',
  /** Profile: light at least `values.n` stars in the Atlas of Echoes. */
  'stars',
  /** Profile: light every star of one constellation (`constellation`, else any). */
  'constellation',
  /** Profile: win This Week's Song in at least `values.n` different weeks. */
  'weeks',
] as const;
/** The hero fight tallies a `heroTally` Deed may test (docs/phase-5e.md). */
export const HERO_TALLY_STATS = ['parries', 'killShots', 'saplingsLost'] as const;
/** The fight stats a `runCount` Deed may total over a run. */
export const DEED_STATS = [
  'responses',
  'perfects',
  'saves',
  'clutchCleanses',
  'reels',
  'cues',
  // Phase 6 (docs/phase-6.md, decision 17): Silent Bell's "without cleansing".
  'cleanses',
] as const;

export const DeedDefSchema = z
  .object({
    id: IdSchema,
    name: z.string(),
    /** 1: it gives an Astrolabe point. */
    points: z.union([z.literal(0), z.literal(1)]),
    test: z.enum(DEED_TESTS),
    /** `runCount`: the fight stat totalled over the run. */
    stat: z.enum(DEED_STATS).optional(),
    /** `fight`: the encounter to beat. */
    encounter: IdSchema.optional(),
    /** `fight`, `grades`: the grade it asks for. */
    grade: z.enum(['S', 'A', 'B', 'C']).optional(),
    /** `calling`: the Calling to win as. */
    calling: IdSchema.optional(),
    /** `heroCeiling`, `heroTally`: the hero it is about (docs/phase-5b.md). */
    hero: IdSchema.optional(),
    /** `heroTally`: the hero's fight tally it tests (docs/phase-5e.md). */
    tally: z.enum(HERO_TALLY_STATS).optional(),
    // ── Phase 6 (docs/phase-6.md, "Design: Deeds"). The Dissonance total is `values.points`. ──
    /** `movementWithout`: the Movement (its number, 1 the first) whose fights it judges. */
    movement: z.number().int().min(1).optional(),
    /** `dissonance`, `fight`: a Dissonance level the run must have played. */
    level: IdSchema.optional(),
    /** `dissonance`: every level at its top rank. */
    allLevels: z.literal(true).optional(),
    /** `constellation`: the one to light (absent: any). */
    constellation: IdSchema.optional(),
    /** Its numbers: `n` (how many) and, for a fight, `downs` (at most). */
    values: ValuesSchema,
    /** {n}, {downs} from `values`; {encounter}, {calling}, {grade}, {hero}, {movement}, {level} by name. */
    text: z.string(),
  })
  .strict();
export type DeedDef = z.infer<typeof DeedDefSchema>;

// ── The Reliquary (docs/phase-4c.md) ─────────────────────────────────────────────────

/**
 * The passive effects an Inscription or a curse may carry: the Astrolabe's stats (sim/astrolabe
 * folds them into the same sums as the tree's nodes), plus a few of their own. Percentages are
 * in percent, the Perfect window in seconds, ranges in metres, Resonance in points.
 */
export const PASSIVE_EFFECTS = [
  'thread',
  'mend',
  'empower',
  'thread_range',
  'aura_effect',
  'field',
  'reserve',
  'ward',
  'perfect',
  'tech_cost',
  'tech_cooldown',
  'hero_life',
  'hero_damage',
  'solo_charge',
  'revive_speed',
  'life',
  'spirit_regen',
  'perfect_resonance',
  'response',
  'start_resonance',
  'spirit',
] as const;
export type PassiveEffect = (typeof PASSIVE_EFFECTS)[number];

/** What Inscribe lets you choose: the Astrolabe's four constellations, and the Weaver. */
export const INSCRIPTION_CATEGORIES = ['silk', 'choir', 'aegis', 'bond', 'weaver'] as const;
export type InscriptionCategory = (typeof INSCRIPTION_CATEGORIES)[number];

const PassiveSchema = z.object({ effect: z.enum(PASSIVE_EFFECTS), value: z.number() }).strict();

export const InscriptionDefSchema = z.discriminatedUnion('kind', [
  z
    .object({
      id: IdSchema,
      name: z.string(),
      category: z.enum(INSCRIPTION_CATEGORIES),
      kind: z.literal('normal'),
      effect: z.enum(PASSIVE_EFFECTS),
      /** T5 first: each tier's [min, max], rolled in steps of `step`. */
      tiers: z.array(z.tuple([z.number(), z.number()])).length(5),
      step: z.number().positive(),
      /** {v}: the rolled value. */
      text: z.string(),
    })
    .strict(),
  z
    .object({
      id: IdSchema,
      name: z.string(),
      category: z.enum(INSCRIPTION_CATEGORIES),
      /** A Dissonate's fifth slot: fixed values. */
      kind: z.literal('dissonant'),
      effects: z.array(PassiveSchema).min(1).max(2),
      /** {a}, {b}: the effects' values, in order. */
      text: z.string(),
    })
    .strict(),
]);
export type InscriptionDef = z.infer<typeof InscriptionDefSchema>;

/** What a Dissonate gone Cursed leaves on a relic. */
export const CurseDefSchema = z
  .object({
    id: IdSchema,
    name: z.string(),
    effects: z.array(PassiveSchema).min(1).max(2),
    /** {a}, {b}: the effects' sizes, in order (the text says which way). */
    text: z.string(),
  })
  .strict();
export type CurseDef = z.infer<typeof CurseDefSchema>;

const Count = z.number().int().nonnegative();
const Percent = z.number().min(0).max(100);

export const ReliquaryDefSchema = z
  .object({
    /** How many relics it holds. */
    capacity: z.number().int().positive(),
    /** The Rank each carry slot opens at, in order; the first opens the Reliquary. */
    slotRanks: z.array(z.number().int().positive()).min(1),
    maxInscriptions: z.number().int().positive(),
    /** The Inscriptions an enshrined relic arrives with, by rarity. */
    enshrineInscriptions: z.object({ common: Count, rare: Count, legendary: Count, cursed: Count }),
    /** The best tier crafting reaches for now (3 = T3); a Dissonate gone Cursed may pass it. */
    tierCap: z.number().int().min(1).max(5),
    /** Its tier odds in percent, T5 first. */
    inscribe: z.object({ cost: Count, instability: Count, tierOdds: z.array(Percent).length(5) }),
    retune: z.object({ cost: Count, instability: Count }),
    /** The chance in percent to rise from T5, T4, T3 and T2. */
    ascend: z.object({ cost: Count, instability: Count, odds: z.array(Percent).length(4) }),
    /** Above `above` Instability, each craft risks a Fracture: `perPoint` percent a point. */
    fracture: z.object({ above: Percent, perPoint: z.number().nonnegative() }),
    dissonate: z.object({
      cost: z.number().int().positive(),
      weights: z.object({ dissonant: Count, empowered: Count, cursed: Count, shattered: Count }),
      /** How far a Cursed outcome raises the Inscriptions (2 = T2). */
      cursedTierCap: z.number().int().min(1).max(5),
    }),
    /** Shards a released relic gives: by rarity, and for each Inscription. */
    release: z.object({
      common: Count,
      rare: Count,
      legendary: Count,
      cursed: Count,
      perInscription: Count,
    }),
    /** Shards a run pays: for each fight it won, and on top for each kind of fight. */
    shards: z.object({ perFight: Count, elite: Count, miniboss: Count, boss: Count }),
    /**
     * Dissonance (docs/phase-4d.md): a relic's depth (the Dissonance it was won at) raises how
     * far it can be crafted. From each band's depth: the best tier Ascend reaches, Inscribe's
     * tier odds (T5 first) and how far a Cursed Dissonate raises. Below the first band,
     * `tierCap`, Inscribe's `tierOdds` and `dissonate.cursedTierCap` hold.
     */
    bands: z.array(
      z
        .object({
          depth: z.number().int().positive(),
          tierCap: z.number().int().min(1).max(5),
          tierOdds: z.array(Percent).length(5),
          cursedTierCap: z.number().int().min(1).max(5),
        })
        .strict(),
    ),
    /** A boss beaten with this grade pays a Discord Tear. */
    tearGrade: z.enum(['S', 'A', 'B', 'C']),
  })
  .strict();
export type ReliquaryDef = z.infer<typeof ReliquaryDefSchema>;

// ── Dissonance (docs/phase-4d.md) ────────────────────────────────────────────────────

/** What a Dissonance level does: the sim's mods read the fight's, the run layer the run's. */
export const DISSONANCE_EFFECTS = [
  'enemy_speed',
  'enemy_life',
  'windup',
  'aura_radius',
  'thread_range',
  'heal_received',
  'elite_vanguard',
  'cue_cost',
  'restless_dead',
  'no_respite_heal',
  'blind_score',
  'cursed_start',
  // Phase 6 (docs/phase-6.md): appended, so every earlier level's effect keeps its place.
  'tyrant',
  'mimicry',
  'true_dissonance',
] as const;
export type DissonanceEffect = (typeof DISSONANCE_EFFECTS)[number];

export const DissonanceLevelSchema = z
  .object({
    id: IdSchema,
    name: z.string(),
    effect: z.enum(DISSONANCE_EFFECTS),
    /** How many times it can be taken (each rank adds its effect and its points). */
    ranks: z.number().int().min(1).max(3),
    /** Points per rank. */
    points: z.number().int().positive(),
    /** Its numbers per rank, in the units its text shows. */
    values: ValuesSchema,
    text: z.string(),
  })
  .strict();
export type DissonanceLevel = z.infer<typeof DissonanceLevelSchema>;

export const DissonanceRulesSchema = z
  .object({
    /** The first win at this Rank or above opens Dissonance. */
    openRank: z.number().int().positive(),
    /** Per point: percent more Weaver XP, and Tuning Shards. */
    xpPerPoint: z.number().nonnegative(),
    shardsPerPoint: z.number().nonnegative(),
    /** From this total, a boss beaten with an A pays a Discord Tear too. */
    tearOnA: z.number().int().positive(),
    /** From this total, every win pays one more Tear. */
    tearOnWin: z.number().int().positive(),
  })
  .strict();
export type DissonanceRules = z.infer<typeof DissonanceRulesSchema>;

// ── Bonds (docs/phase-4e.md) ──────────────────────────────────────────────────────────

export const BondRulesSchema = z
  .object({
    /** The Bond XP each rank needs, cumulative: ranks 1 to 10 (rank 1 at 0). */
    ranks: z.array(z.number().int().nonnegative()).length(10),
    /** Per fight, for each hero in it: a base, and their share of a pool by your support. */
    base: z.number().nonnegative(),
    pool: z.number().nonnegative(),
    /** A fight's weight by kind. */
    kinds: z
      .object({
        skirmish: z.number().nonnegative(),
        elite: z.number().nonnegative(),
        miniboss: z.number().nonnegative(),
        boss: z.number().nonnegative(),
      })
      .strict(),
    /** What a lost fight pays, against a won one. */
    loss: Pct,
    /** The Bond ranks that open each talent tier, and the alternate Solo. */
    talentRanks: z.array(z.number().int().min(1).max(10)).length(3),
    soloRank: z.number().int().min(1).max(10),
    /** A scene pays this share of the XP between its rank and the next. */
    scene: Pct,
  })
  .strict();
export type BondRules = z.infer<typeof BondRulesSchema>;

/** A Bond talent: a hero's tier (1–3) holds two, one to choose. */
export const TalentDefSchema = z
  .object({
    id: IdSchema,
    hero: IdSchema,
    tier: z.number().int().min(1).max(3),
    name: z.string(),
    text: z.string(),
    values: ValuesSchema,
  })
  .strict();
export type TalentDef = z.infer<typeof TalentDefSchema>;

// ── The Loom (docs/phase-4g.md) ───────────────────────────────────────────────────────

const HexSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/);

/** Starlight, the meta currency: what fights, wins and Deeds pay, and the Atelier's terms. */
export const StarlightRulesSchema = z
  .object({
    fights: z
      .object({
        skirmish: z.number().int().min(0),
        elite: z.number().int().min(0),
        miniboss: z.number().int().min(0),
        boss: z.number().int().min(0),
      })
      .strict(),
    winBonus: z.number().int().min(0),
    deedLadder: z.array(z.number().int().min(0)),
    deedBadge: z.number().int().min(0),
    atelierRank: z.number().int().min(1),
    variantPrice: z.number().int().min(1),
  })
  .strict();
export type StarlightRules = z.infer<typeof StarlightRulesSchema>;

/**
 * How a keepsake is earned rather than bought: a Calling's top mastery or a Deed (titles), or,
 * since Phase 6 (docs/phase-6.md, "Design: the Atlas of Echoes"), every star of a constellation or
 * of the whole Atlas.
 */
export const KeepsakeEarnedSchema = z.union([
  z.object({ mastery: IdSchema }).strict(),
  z.object({ deed: IdSchema }).strict(),
  z.object({ constellation: IdSchema }).strict(),
  z.object({ atlas: z.literal(true) }).strict(),
]);
export type KeepsakeEarned = z.infer<typeof KeepsakeEarnedSchema>;

/** The Atelier's keepsakes: robes, Thread looks and titles. */
export const CosmeticsSchema = z
  .object({
    robes: z.array(
      z
        .object({
          id: IdSchema,
          name: z.string(),
          price: z.number().int().min(1),
          colors: z.object({ body: HexSchema, trim: HexSchema, glow: HexSchema }).strict(),
          /** Phase 6 (docs/phase-6.md): earned, not bought (a constellation's keepsake). */
          earned: KeepsakeEarnedSchema.optional(),
        })
        .strict(),
    ),
    threads: z.array(
      z
        .object({
          id: IdSchema,
          name: z.string(),
          price: z.number().int().min(1),
          filament: HexSchema,
          glow: HexSchema,
          /** Phase 6 (docs/phase-6.md): earned, not bought (a constellation's keepsake). */
          earned: KeepsakeEarnedSchema.optional(),
        })
        .strict(),
    ),
    titles: z.array(
      z
        .object({
          id: IdSchema,
          text: z.string(),
          /** Bought for Starlight, or earned (a Calling's top mastery, a Deed). */
          price: z.number().int().min(1).optional(),
          earned: KeepsakeEarnedSchema.optional(),
        })
        .strict(),
    ),
  })
  .strict();
export type Cosmetics = z.infer<typeof CosmeticsSchema>;

/** Calling mastery: the XP each level needs, and each Calling's top-mastery rewards. */
export const MasteryRulesSchema = z
  .object({
    levels: z.array(z.number().int().min(0)),
    callings: z.array(z.object({ calling: IdSchema, variant: IdSchema, title: IdSchema }).strict()),
  })
  .strict();
export type MasteryRules = z.infer<typeof MasteryRulesSchema>;

/** A technique variant (docs/phase-4f.md): a different way to use one of the Weaver's slots. */
export const TechniqueVariantDefSchema = z
  .object({
    id: IdSchema,
    slot: z.enum(['ward', 'chime', 'reel', 'glide']),
    name: z.string(),
    text: z.string(),
    values: ValuesSchema,
    /** Spirit, and seconds; the default's where absent. */
    cost: z.number().min(0).optional(),
    cooldown: z.number().positive().optional(),
  })
  .strict();
export type TechniqueVariantDef = z.infer<typeof TechniqueVariantDefSchema>;

/** A hero's alternate Solo, chosen at the Solo rank. Its length is `values.seconds`. */
export const AltSoloDefSchema = z
  .object({
    id: IdSchema,
    hero: IdSchema,
    name: z.string(),
    text: z.string(),
    cuedText: z.string(),
    chargeTime: Seconds,
    values: ValuesSchema,
  })
  .strict();
export type AltSoloDef = z.infer<typeof AltSoloDefSchema>;

/**
 * A Bond scene: a few lines at a Respite's fire, and one reply to choose. A hero's line is their
 * words alone (the views quote it); narration and a reply's response are prose, quotes and all.
 */
export const SceneDefSchema = z
  .object({
    id: IdSchema,
    hero: IdSchema,
    /** The Bond rank from which it waits for a Respite. */
    rank: z.number().int().min(1).max(10),
    title: z.string(),
    lines: z
      .array(z.object({ speaker: z.enum(['hero', 'narration']), text: z.string().min(1) }))
      .min(2),
    /** The Weaver's two possible replies, and the hero's answer to each. */
    replies: z.array(z.object({ text: z.string().min(1), response: z.string().min(1) })).length(2),
  })
  .strict();
export type SceneDef = z.infer<typeof SceneDefSchema>;

// ── Arenas and encounters ─────────────────────────────────────────────────────────────

/** A Movement's look and sound: one list for arenas and Movements, so the two can't drift. */
export const BiomeSchema = z.enum([
  'reliquary',
  'crimson_spire',
  'abyssal_rift',
  'celestial_crucible',
]);
export type Biome = z.infer<typeof BiomeSchema>;

export const ArenaDefSchema = z.object({
  id: IdSchema,
  name: z.string(),
  radius: z.number().positive(),
  obstacles: z.array(z.object({ x: z.number(), z: z.number(), r: z.number().positive() })),
  theme: z.object({
    floor: ColorSchema,
    line: ColorSchema,
    accent: ColorSchema,
    fog: ColorSchema,
  }),
  /** Its look and sound (docs/phase-5a.md); absent: the Sunlit Reliquary's. */
  biome: BiomeSchema.optional(),
});
export type ArenaDef = z.infer<typeof ArenaDefSchema>;

export const EncounterKindSchema = z.enum(['sandbox', 'skirmish', 'elite', 'miniboss', 'boss']);

export const WaveDefSchema = z.object({
  /** Seconds after the previous wave is (almost) cleared — or after the start, for wave 1. */
  delay: Seconds,
  spawns: z.array(
    z.object({
      enemy: IdSchema,
      count: z.number().int().positive(),
      elite: z.boolean().default(false),
      affixes: z.array(IdSchema).default([]),
    }),
  ),
});

export const EncounterDefSchema = z.object({
  id: IdSchema,
  name: z.string(),
  kind: EncounterKindSchema,
  arena: IdSchema,
  /** Target clear time in seconds (grades). */
  par: Seconds,
  waves: z.array(WaveDefSchema),
  boss: IdSchema.optional(),
  /** Seconds before the boss enrages. */
  enrage: Seconds.optional(),
  /** Contextual hint ids shown the first few times (UI coach). */
  hints: z.array(z.string()).default([]),
  flavor: z.string(),
  /** The Movement it belongs to (absent: 1): its enemies' scale and its pools. */
  movement: z.number().int().positive().optional(),
});
export type EncounterDef = z.infer<typeof EncounterDefSchema>;

// ── Movements (docs/phase-5a.md) ─────────────────────────────────────────────────────

/** A map stop's kind (meta/types.ts `NodeKind` is this). */
export const NodeKindSchema = z.enum([
  'skirmish',
  'elite',
  'shrine',
  'respite',
  'merchant',
  'forge',
  'event',
  'miniboss',
  'boss',
]);

/**
 * One Movement of an Expedition: its map template and pools, and how much harder its enemies
 * are. `rows` are row templates whose kinds are shuffled, except the `fixed` rows, which play
 * the named encounter. Movement I is the Prelude's map exactly (meta/run.ts).
 */
export const MovementDefSchema = z
  .object({
    id: IdSchema,
    name: z.string(),
    /** The map screen's title. */
    mapTitle: z.string(),
    /** How the route names it (docs/phase-5c.md, the Finale hook); absent: 'Movement N'. */
    label: z.string().optional(),
    biome: BiomeSchema,
    rows: z.array(z.array(NodeKindSchema).min(1)).min(1),
    /** Rows (within the Movement) that always play one encounter. */
    fixed: z.array(z.object({ row: z.number().int().nonnegative(), encounter: IdSchema }).strict()),
    /** A row of lesson fights: one of these each, every path learns one. */
    lessons: z.array(IdSchema).optional(),
    /** The first fight. */
    opening: IdSchema,
    skirmishes: z.array(IdSchema).min(1),
    elites: z.array(IdSchema).min(1),
    miniboss: IdSchema,
    boss: IdSchema,
    /** Its enemies' life and damage (sim `SimConfig.movement`); {1, 1} for Movement I. */
    scale: z.object({ life: z.number().positive(), damage: z.number().positive() }).strict(),
    /** Its fights' XP, Starlight and Aether multipliers. */
    rewards: z
      .object({
        xp: z.number().positive(),
        starlight: z.number().positive(),
        aether: z.number().positive(),
      })
      .strict(),
  })
  .strict();
export type MovementDef = z.infer<typeof MovementDefSchema>;

/**
 * The Finale's shorter road (docs/phase-5d.md): one earlier field Movement as the route that ends
 * in the Finale plays it. Only `routeDefs(n)` (meta/run.ts) reads it, and only when the n-th
 * def is the finale, so Movements I-III's own maps never change.
 */
export const RoadVariantSchema = z
  .object({
    /** The id of an earlier field Movement. */
    movement: IdSchema,
    rows: z.array(z.array(NodeKindSchema).min(1)).min(1),
    fixed: z.array(z.object({ row: z.number().int().nonnegative(), encounter: IdSchema }).strict()),
    /** Per road row, the row of the full Movement whose Threat it takes. */
    threat: z.array(z.number().int().nonnegative()),
    /** The rows its Calling tiers fall on (movements[0]'s road only; absent: CALLING_ROWS). */
    callingRows: z.array(z.number().int().nonnegative()).optional(),
    /** Shuffle the ladder's skirmish and elite pools on this road. */
    shuffle: z.literal(true).optional(),
    /**
     * The road's own rewards (docs/phase-5d.md, "Bands": the lever when the shorter road leaves
     * fewer drafts and relics before each boss): each skirmish on a listed row offers a motif of
     * this rarity and, with `relics`, a relic from this many (without it, a skirmish's own: none,
     * and no relic screen). Nothing else pays more; absent: the Movement's own.
     */
    rewards: z
      .array(
        z
          .object({
            row: z.number().int().nonnegative(),
            draft: z.enum(['rare', 'epic']),
            relics: z.number().int().positive().optional(),
          })
          .strict(),
      )
      .optional(),
  })
  .strict();
export type RoadVariant = z.infer<typeof RoadVariantSchema>;

/**
 * The Finale (docs/phase-5d.md): a boss-only last Movement with no pools, carrying the route's
 * shorter `road`. A separate schema, so MovementDef stays exactly as it was and every pool
 * reader narrows with `isFieldMovement`.
 */
export const FinaleMovementDefSchema = z
  .object({
    id: IdSchema,
    name: z.string(),
    mapTitle: z.string(),
    label: z.string(),
    biome: BiomeSchema,
    /** One row, its boss (lint: `[['boss']]`). */
    rows: z.array(z.array(NodeKindSchema).min(1)).min(1),
    /** Row 0, the boss's encounter (lint). */
    fixed: z.array(z.object({ row: z.number().int().nonnegative(), encounter: IdSchema }).strict()),
    boss: IdSchema,
    scale: z.object({ life: z.number().positive(), damage: z.number().positive() }).strict(),
    rewards: z
      .object({
        xp: z.number().positive(),
        starlight: z.number().positive(),
        aether: z.number().positive(),
      })
      .strict(),
    finale: z.literal(true),
    road: z.array(RoadVariantSchema),
  })
  .strict();
export type FinaleMovementDef = z.infer<typeof FinaleMovementDefSchema>;

/** Any Movement of an Expedition: a field Movement with pools, or the boss-only Finale. */
export type AnyMovementDef = MovementDef | FinaleMovementDef;

// ── Phase 6 (docs/phase-6.md): the Atlas of Echoes and the weekly rotation ─────────────────
// Contracts only (W0): every list is empty until W3 and W4 fill it, and `contentVersionOf`
// (index.ts) leaves an empty one out of the hash, so registering them moved no version.

/** A level of Dissonance as content names it: a level's id and a rank. */
const LevelRankSchema = z.object({ id: IdSchema, rank: z.number().int().min(1) }).strict();

/**
 * One leg of an Echo's route, built like the Finale route's road (`RoadVariantSchema`) over an
 * existing field Movement: its pools and encounters, with its own rows, fixed rows and rewards
 * where it gives them, its own mini-boss and boss, and the scale its enemies play at.
 */
export const EchoLegSchema = z
  .object({
    /** The id of an existing field Movement (not the Finale): its pools and encounters. */
    movement: IdSchema,
    /** Its rows of node kinds; absent: that Movement's own. */
    rows: z.array(z.array(NodeKindSchema).min(1)).min(1).optional(),
    /** Rows that always play one encounter; absent: that Movement's own. */
    fixed: z
      .array(z.object({ row: z.number().int().nonnegative(), encounter: IdSchema }).strict())
      .optional(),
    /** The rows that pay more, as a road's `rewards`; absent: the Movement's own. */
    rewards: z
      .array(
        z
          .object({
            row: z.number().int().nonnegative(),
            draft: z.enum(['rare', 'epic']),
            relics: z.number().int().positive().optional(),
          })
          .strict(),
      )
      .optional(),
    /** Its mini-boss's encounter; absent: that Movement's own. */
    miniboss: IdSchema.optional(),
    /** Its boss's encounter: the leg's last fight. */
    boss: IdSchema,
    /**
     * The scale every fight of the leg plays at: a Movement's number (1 the first), whose
     * `scale` goes into the fight's `SimConfig.movement`. Absent: each encounter's own.
     */
    scale: z.number().int().min(1).optional(),
  })
  .strict();
export type EchoLeg = z.infer<typeof EchoLegSchema>;

/** An Echo's fixed rules, applied at embark (docs/phase-6.md, "The Echoes"). */
export const EchoTwistsSchema = z
  .object({
    /** No Calling. */
    noCalling: z.literal(true).optional(),
    /** No Astrolabe. */
    noTree: z.literal(true).optional(),
    /** No carried relics. */
    noCarry: z.literal(true).optional(),
    /** The party, three hero ids, whoever is recruited. */
    party: z.array(IdSchema).length(3).optional(),
    /** Levels always on, worth no points (The Unrested). */
    dissonance: z.array(LevelRankSchema).optional(),
  })
  .strict();
export type EchoTwists = z.infer<typeof EchoTwistsSchema>;

/** An Echo: a remixed run with three stars (docs/phase-6.md, "Design: the Atlas of Echoes"). */
export const EchoDefSchema = z
  .object({
    id: IdSchema,
    name: z.string(),
    /** The constellation it belongs to. */
    constellation: IdSchema,
    text: z.string(),
    legs: z.array(EchoLegSchema).min(1),
    twists: EchoTwistsSchema,
  })
  .strict();
export type EchoDef = z.infer<typeof EchoDefSchema>;

/** A constellation of Echoes, and the keepsake all its stars earn. */
export const ConstellationSchema = z
  .object({
    id: IdSchema,
    name: z.string(),
    /** A keepsake's id: a robe, a Thread look or a title. */
    reward: IdSchema,
  })
  .strict();
export type Constellation = z.infer<typeof ConstellationSchema>;

/** One entry of the weekly rotation (docs/phase-6.md, decision 7): what everyone plays that week. */
export const WeeklyEntrySchema = z
  .object({
    /** The Finale-route Expedition, or an Echo's id. */
    route: IdSchema,
    /** The Calling, or null for none. */
    calling: IdSchema.nullable(),
    /** Three hero ids. */
    party: z.array(IdSchema).length(3),
    dissonance: z.array(LevelRankSchema),
  })
  .strict();
export type WeeklyEntry = z.infer<typeof WeeklyEntrySchema>;

/** A field Movement (pools, a ladder, a mini-boss), not the Finale. */
export function isFieldMovement(d: AnyMovementDef): d is MovementDef {
  return !('finale' in d);
}

// ── Movement II lint (docs/phase-5a.md, "Content lint") ───────────────────────────────

/**
 * The statuses Chime cleanses and immunity blocks, as content declares them (the sim's
 * `AILMENTS`, src/sim/combat/health.ts, holds the ones it implements): a status an attack
 * answered by Chime applies must be one of these.
 */
export const AILMENT_IDS: readonly StatusId[] = [
  'dirge',
  'resound',
  'silence',
  'stun',
  'sleep',
  'bleed',
  'latched',
  'wound',
  // Movement III (docs/phase-5c.md)
  'doubt',
  'possessed',
  'doom',
  'doomed',
  'stitch',
  'stitched',
];
export type StatusId = z.infer<typeof StatusIdSchema>;

/**
 * What each targeting picks, every one listed (docs/phase-5c.md), so a new targeting can't slip
 * past the lint unclassified: a hero, a pair of heroes, the caster or the whole party, the
 * Thread's line, or an enemy.
 */
const TARGETING_PICKS: Readonly<
  Record<z.infer<typeof TargetingSchema>, 'hero' | 'pair' | 'area' | 'thread' | 'enemy'>
> = {
  current: 'hero',
  farthest: 'hero',
  squishiest: 'hero',
  randomHero: 'hero',
  randomNonTank: 'hero',
  lowestHp: 'hero',
  pair: 'pair',
  self: 'area',
  allHeroes: 'area',
  threadLine: 'thread',
  allyEnemy: 'enemy',
};
/** Targetings that pick a hero (a mark or an execution needs one). */
const HERO_TARGETING: ReadonlySet<z.infer<typeof TargetingSchema>> = new Set(
  (Object.keys(TARGETING_PICKS) as z.infer<typeof TargetingSchema>[]).filter(
    (t) => TARGETING_PICKS[t] === 'hero',
  ),
);

interface LintSets {
  attacks: Set<string>;
  enemies: Set<string>;
  encounters: Set<string>;
}

interface ContentShape {
  attacks: AttackDef[];
  enemies: EnemyDef[];
  affixes: AffixDef[];
  encounters: EncounterDef[];
  movements: AnyMovementDef[];
  // The Finale's lint (docs/phase-5d.md) reads the Calling tiers.
  callings: { tiers: readonly unknown[] }[];
  // Movement III's lint (docs/phase-5c.md) reads these too.
  arenas: ArenaDef[];
  motifs: MotifDef[];
  relics: RelicDef[];
  weaver: { moveSpeed: number };
}

/**
 * Movement III's lint (docs/phase-5c.md, "Content lint"): cuts, possession, Stitch, zones,
 * Doom's burst, tethers, stationary enemies, affix specials and the Movement gates.
 */
function lintMovement3(c: ContentShape, ctx: z.RefinementCtx, sets: LintSets): void {
  const issue = (message: string) => ctx.addIssue({ code: 'custom', message });
  const ailments = new Set<string>(AILMENT_IDS);
  const attackById = new Map(c.attacks.map((a) => [a.id, a]));
  const arenaRadius = new Map(c.arenas.map((a) => [a.id, a.radius]));
  /** The arenas an attack is fought in: every encounter with an enemy (or affix) that casts it. */
  const arenasOf = (id: string): string[] => {
    const casters = new Set(c.enemies.filter((e) => e.specials.includes(id)).map((e) => e.id));
    const affixes = new Set(c.affixes.filter((f) => f.specials?.includes(id)).map((f) => f.id));
    return c.encounters
      .filter(
        (e) =>
          (e.boss !== undefined && casters.has(e.boss)) ||
          e.waves.some((w) =>
            w.spawns.some((s) => casters.has(s.enemy) || s.affixes.some((f) => affixes.has(f))),
          ),
      )
      .map((e) => e.arena);
  };
  for (const a of c.attacks) {
    const where = `attack "${a.id}"`;
    if (a.cut) {
      if (!a.answers.includes('thread')) issue(`${where}: a cut lists thread`);
      if (a.kind === 'beam' && a.targeting !== 'threadLine')
        issue(`${where}: a cut beam uses threadLine`);
    }
    if (a.kind === 'mark' && a.status?.id === 'possessed') {
      if (!a.interruptible) issue(`${where}: a possession is interruptible`);
      const mark = a.markStatus === undefined ? 'dirge' : a.markStatus;
      if (mark === null || !ailments.has(mark))
        issue(`${where}: a possession's mark is an ailment`);
      if (!a.answers.includes('chime') || !a.answers.includes('focus'))
        issue(`${where}: a possession lists chime and focus`);
    }
    if (a.kind === 'link' && a.linkStatus === 'stitch') {
      if (!a.answers.includes('chime')) issue(`${where}: a stitch lists chime`);
      for (const arena of arenasOf(a.id)) {
        const r = arenaRadius.get(arena);
        if (r !== undefined && a.radius < 2 * r)
          issue(`${where}: a stitch reaches across arena "${arena}" (radius ≥ its diameter)`);
      }
    }
    if ((a.effect === 'zone') !== (a.zone !== undefined))
      issue(`${where}: a zone attack has its zone, and only it does`);
    if (a.zone?.kind === 'pull') {
      if (!a.answers.includes('stack') && !a.answers.includes('reel'))
        issue(`${where}: a pull lists stack or reel`);
      if (a.zone.pullSpeed === undefined || !(a.zone.pullSpeed < c.weaver.moveSpeed))
        issue(`${where}: a pull is slower than the Weaver`);
    }
    if (a.zone?.kind === 'null') {
      if (a.centre !== 'weaver') issue(`${where}: a null zone is centred on the Weaver`);
      if (!a.answers.includes('move')) issue(`${where}: a null zone lists move`);
    }
  }
  // Doom's burst: every payload that carries one, wherever it is applied.
  const payloads = [
    ...c.attacks.flatMap((a) => [
      ...(a.status ? [{ p: a.status, where: `attack "${a.id}"` }] : []),
      ...(a.zone?.status ? [{ p: a.zone.status, where: `attack "${a.id}" zone` }] : []),
    ]),
    ...c.enemies.flatMap((e) =>
      e.basic.onHit ? [{ p: e.basic.onHit, where: `enemy "${e.id}"` }] : [],
    ),
    ...c.affixes.flatMap((f) => (f.onHit ? [{ p: f.onHit, where: `affix "${f.id}"` }] : [])),
  ];
  for (const { p, where } of payloads) {
    if (!p.burst) continue;
    const burst = attackById.get(p.burst.attack);
    if (!burst) {
      issue(`${where} references unknown "${p.burst.attack}"`);
      continue;
    }
    const at = `${where}: its burst "${burst.id}"`;
    if (burst.kind !== 'mark') issue(`${at} is a mark`);
    if (!burst.answers.includes('ward') || !burst.answers.includes('chime'))
      issue(`${at} lists ward and chime`);
    const mark = burst.markStatus === undefined ? 'dirge' : burst.markStatus;
    if (mark === null || !ailments.has(mark) || mark === p.id)
      issue(`${at} has an ailment mark status of its own`);
    if (c.enemies.some((e) => e.specials.includes(burst.id)))
      issue(`${at} is in no enemy's specials`);
  }
  const bossRoles = new Set(['boss', 'miniboss']);
  for (const e of c.enemies) {
    const where = `enemy "${e.id}"`;
    if (
      e.tether &&
      !c.enemies.some(
        (b) =>
          bossRoles.has(b.role) &&
          b.specials.some((id) => attackById.get(id)?.summon?.enemy === e.id),
      )
    )
      issue(`${where}: a tether is summoned by a boss attack`);
    if (e.stationary && e.specials.some((id) => attackById.get(id)?.move !== undefined))
      issue(`${where}: a stationary enemy has no move attack`);
  }
  for (const f of c.affixes) {
    const where = `affix "${f.id}"`;
    for (const id of f.specials ?? [])
      if (!sets.attacks.has(id)) issue(`${where} references unknown "${id}"`);
    if (f.cut && !f.answers?.includes('thread')) issue(`${where}: a cut lists thread`);
  }
  const movements = c.movements.length;
  for (const m of c.motifs)
    if (m.requires.movement !== undefined && m.requires.movement > movements)
      issue(`motif "${m.id}": Movement ${m.requires.movement} is past the last`);
  // A relic waits for a registered Movement (FINALE is registered: Movement 4 is the last).
  for (const r of c.relics)
    if (r.movement !== undefined && r.movement > movements)
      issue(`relic "${r.id}": Movement ${r.movement} is past the last`);
}

function lintMovements(c: ContentShape, ctx: z.RefinementCtx, sets: LintSets): void {
  const issue = (message: string) => ctx.addIssue({ code: 'custom', message });
  const need = (set: Set<string>, id: string, where: string) => {
    if (!set.has(id)) issue(`${where} references unknown "${id}"`);
  };
  const ailments = new Set<string>(AILMENT_IDS);
  for (const a of c.attacks) {
    const where = `attack "${a.id}"`;
    if (a.kind === 'link' && a.targeting !== 'pair') issue(`${where}: a link targets a pair`);
    if ((a.kind === 'mark' || a.executeBelow !== undefined) && !HERO_TARGETING.has(a.targeting))
      issue(`${where}: a mark or an execution needs a targeting that picks a hero`);
    if (a.followUp) {
      need(sets.attacks, a.followUp.attack, where);
      // A follow-up starts only from the attack before it, never from the generic picker.
      const next = c.attacks.find((x) => x.id === a.followUp!.attack);
      if (next && !next.scripted) issue(`${where}: its follow-up "${next.id}" is scripted`);
      for (const e of c.enemies)
        if (e.specials.includes(a.id) && !e.specials.includes(a.followUp.attack))
          issue(`enemy "${e.id}" lists "${a.id}" but not its follow-up "${a.followUp.attack}"`);
    }
    // The statuses it applies, and the answers they need.
    const mark = a.kind === 'mark' ? (a.markStatus === undefined ? 'dirge' : a.markStatus) : null;
    const applied = [
      ...(a.status ? [a.status.id] : []),
      ...(a.kind === 'link' ? [a.linkStatus ?? 'resound'] : []),
      ...(mark ? [mark] : []),
    ];
    for (const id of applied) {
      if (a.answers.includes('chime') && !ailments.has(id))
        issue(`${where}: Chime answers it, but "${id}" isn't an ailment`);
      if (id === 'pinned' && !a.answers.includes('reel')) issue(`${where}: a pin lists reel`);
      if (id === 'pact' && !a.answers.includes('scatter')) issue(`${where}: a pact lists scatter`);
    }
  }
  for (const f of c.affixes) {
    if (f.onHit && !f.answers) issue(`affix "${f.id}": what its hits apply names its answers`);
    if (f.onHit && f.answers?.includes('chime') && !ailments.has(f.onHit.id))
      issue(`affix "${f.id}": Chime answers it, but "${f.onHit.id}" isn't an ailment`);
  }
  const enemyMovement = new Map(c.enemies.map((e) => [e.id, e.movement ?? 1]));
  for (const e of c.encounters) {
    const movement = e.movement ?? 1;
    const where = `encounter "${e.id}"`;
    if (movement >= 2 && e.par <= 0) issue(`${where}: a Movement II+ encounter needs a par`);
    const enemies = [
      ...(e.boss ? [e.boss] : []),
      ...e.waves.flatMap((w) => w.spawns.map((s) => s.enemy)),
    ];
    for (const id of enemies)
      if ((enemyMovement.get(id) ?? 1) > movement)
        issue(`${where}: "${id}" belongs to a later Movement`);
  }
  const kindOf = new Map(c.encounters.map((e) => [e.id, e.kind]));
  c.movements.forEach((m, i) => {
    // The Finale has no pools; lintFinale checks it.
    if (!isFieldMovement(m)) return;
    const where = `movement "${m.id}"`;
    const encounter = (id: string, kinds: readonly string[], what: string) => {
      need(sets.encounters, id, where);
      const kind = kindOf.get(id);
      if (kind !== undefined && !kinds.includes(kind))
        issue(`${where}: ${what} "${id}" is a ${kind}`);
      const movement = c.encounters.find((e) => e.id === id)?.movement ?? 1;
      if (kind !== undefined && movement !== i + 1)
        issue(`${where}: "${id}" belongs to Movement ${movement}`);
    };
    encounter(m.opening, ['skirmish'], 'opening');
    for (const id of m.skirmishes) encounter(id, ['skirmish'], 'skirmish');
    for (const id of m.lessons ?? []) encounter(id, ['skirmish'], 'lesson');
    for (const id of m.elites) encounter(id, ['elite'], 'elite');
    encounter(m.miniboss, ['miniboss'], 'miniboss');
    encounter(m.boss, ['boss'], 'boss');
    const fixedRows = new Set<number>();
    for (const f of m.fixed) {
      if (fixedRows.has(f.row)) issue(`${where}: row ${f.row} is fixed twice`);
      fixedRows.add(f.row);
      const row = m.rows[f.row];
      if (!row) {
        issue(`${where}: fixed row ${f.row} is past its last row`);
        need(sets.encounters, f.encounter, where);
        continue;
      }
      // A fixed row is one stop, of the fixed encounter's kind.
      if (row.length !== 1) issue(`${where}: fixed row ${f.row} has one stop`);
      encounter(f.encounter, [row[0]!], `fixed row ${f.row}'s`);
    }
    if (m.lessons) {
      // The lesson row: one skirmish stop for each lesson.
      const n = m.lessons.length;
      if (!m.rows.some((r) => r.length === n && r.every((k) => k === 'skirmish')))
        issue(`${where}: no row of ${n} skirmishes for its lessons`);
    }
    if (!m.rows.some((r) => r.includes('miniboss'))) issue(`${where}: no row for its miniboss`);
    const last = m.rows[m.rows.length - 1]!;
    if (last.length !== 1 || last[0] !== 'boss') issue(`${where}: its last row is its boss`);
  });
  if (
    c.movements[0]?.id !== undefined &&
    (c.movements[0].scale.life !== 1 || c.movements[0].scale.damage !== 1)
  )
    issue(`movement "${c.movements[0].id}": Movement I plays at scale {1, 1}`);
}

/** The kinds of stop that are a fight (a Calling tier row is all fights, docs/phase-4.md). */
const FIGHT_KINDS: ReadonlySet<string> = new Set(['skirmish', 'elite', 'miniboss', 'boss']);

/**
 * The Finale's lint (docs/phase-5d.md, "Content lint additions"). Discord sits only on the
 * Finale's attacks, and `discordQuorum` only beside it; an attack the Crescendo answers is a raid.
 * A finale def is the last def, one row with its boss fixed on row 0, and every road variant
 * names an earlier field Movement and passes Movement-I-style lint: its opening on row 0, its
 * boss last, a Threat row per road row, and Calling rows (movements[0] only) one per tier, each
 * an all-fight row.
 */
function lintFinale(c: ContentShape, ctx: z.RefinementCtx, sets: LintSets): void {
  const issue = (message: string) => ctx.addIssue({ code: 'custom', message });
  const need = (set: Set<string>, id: string, where: string) => {
    if (!set.has(id)) issue(`${where} references unknown "${id}"`);
  };
  for (const a of c.attacks) {
    const where = `attack "${a.id}"`;
    if (a.discordQuorum !== undefined && a.discord === undefined)
      issue(`${where}: a discordQuorum needs discord`);
    if (a.discord !== undefined) {
      // Every caster is a Movement-4 enemy. An affix's specials reach any elite that wears it
      // (Mimicking's mirror), Movements I-III's included, so no affix may list one.
      const listers = c.enemies.filter((e) => e.specials.includes(a.id));
      const affixed = c.affixes.some((f) => f.specials?.includes(a.id));
      if (
        affixed ||
        listers.length === 0 ||
        listers.some((e) => (e.movement ?? 1) !== FINALE_MOVEMENT)
      )
        issue(`${where}: discord belongs to Movement ${FINALE_MOVEMENT}'s attacks`);
    }
    // A blow lethal from full life (pctMaxHp above 1, the Final Cadence) is the Finale's alone,
    // as `discord` is: the schema lets the fraction past 1, so this keeps it off Movements I-III.
    if (a.pctMaxHp !== undefined && a.pctMaxHp > 1) {
      const listers = c.enemies.filter((e) => e.specials.includes(a.id));
      const affixed = c.affixes.some((f) => f.specials?.includes(a.id));
      if (
        affixed ||
        listers.length === 0 ||
        listers.some((e) => (e.movement ?? 1) !== FINALE_MOVEMENT)
      )
        issue(`${where}: a pctMaxHp above 1 belongs to Movement ${FINALE_MOVEMENT}'s attacks`);
    }
    if (a.answers.includes('crescendo') && a.kind !== 'raid')
      issue(`${where}: an attack the Crescendo answers is a raid`);
  }
  const kindOf = new Map(c.encounters.map((e) => [e.id, e.kind]));
  const movementOf = new Map(c.encounters.map((e) => [e.id, e.movement ?? 1]));
  const tiers = Math.max(0, ...c.callings.map((k) => k.tiers.length));
  c.movements.forEach((m, i) => {
    if (isFieldMovement(m)) return;
    const where = `movement "${m.id}"`;
    if (i !== c.movements.length - 1) issue(`${where}: a finale is the last Movement`);
    if (m.rows.length !== 1 || m.rows[0]!.length !== 1 || m.rows[0]![0] !== 'boss')
      issue(`${where}: a finale is one row, its boss`);
    need(sets.encounters, m.boss, where);
    if (kindOf.has(m.boss) && kindOf.get(m.boss) !== 'boss')
      issue(`${where}: boss "${m.boss}" is a ${kindOf.get(m.boss)}`);
    if (kindOf.has(m.boss) && movementOf.get(m.boss) !== i + 1)
      issue(`${where}: "${m.boss}" belongs to Movement ${movementOf.get(m.boss)}`);
    if (m.fixed.length !== 1 || m.fixed[0]!.row !== 0 || m.fixed[0]!.encounter !== m.boss)
      issue(`${where}: a finale fixes its boss on row 0`);
    const roads = new Set<string>();
    for (const r of m.road) {
      const at = `${where}: road "${r.movement}"`;
      if (roads.has(r.movement)) issue(`${at} is given twice`);
      roads.add(r.movement);
      const j = c.movements.findIndex((d) => d.id === r.movement);
      const def = c.movements[j];
      if (!def || j >= i || !isFieldMovement(def)) {
        issue(`${at} names no earlier field Movement`);
        continue;
      }
      // Fixed rows: in range, one stop each, of their encounter's kind and Movement.
      const fixedRows = new Map<number, string>();
      for (const f of r.fixed) {
        if (fixedRows.has(f.row)) issue(`${at}: row ${f.row} is fixed twice`);
        fixedRows.set(f.row, f.encounter);
        need(sets.encounters, f.encounter, at);
        const row = r.rows[f.row];
        if (!row) {
          issue(`${at}: fixed row ${f.row} is past its last row`);
          continue;
        }
        if (row.length !== 1) issue(`${at}: fixed row ${f.row} has one stop`);
        const kind = kindOf.get(f.encounter);
        if (kind !== undefined && kind !== row[0])
          issue(`${at}: fixed row ${f.row}'s "${f.encounter}" is a ${kind}`);
        if (kind !== undefined && movementOf.get(f.encounter) !== j + 1)
          issue(`${at}: "${f.encounter}" belongs to Movement ${movementOf.get(f.encounter)}`);
      }
      if (fixedRows.get(0) !== def.opening) issue(`${at}: row 0 is fixed to its opening`);
      const last = r.rows[r.rows.length - 1]!;
      if (last.length !== 1 || last[0] !== 'boss') issue(`${at}: its last row is its boss`);
      if (!r.rows.some((row) => row.includes('miniboss'))) issue(`${at}: no row for its miniboss`);
      if (def.lessons) {
        const n = def.lessons.length;
        if (!r.rows.some((row) => row.length === n && row.every((k) => k === 'skirmish')))
          issue(`${at}: no row of ${n} skirmishes for its lessons`);
      }
      if (r.threat.length !== r.rows.length)
        issue(`${at}: a threat row for each of its ${r.rows.length} rows`);
      for (const t of r.threat)
        if (t >= def.rows.length) issue(`${at}: threat row ${t} is past the Movement's last`);
      // Movement I's road must carry its Calling rows: without them the Prelude's [0,3,5,7]
      // would put a tier past the shorter road, on the next Movement's rows.
      if (r.callingRows === undefined && j === 0)
        issue(`${at}: Movement I's road carries callingRows`);
      if (r.callingRows !== undefined) {
        if (j !== 0) issue(`${at}: only Movement I's road carries callingRows`);
        if (r.callingRows.length !== tiers)
          issue(`${at}: callingRows has one row per Calling tier (${tiers})`);
        // One tier a row, in order: a repeated row hides a tier, an unordered one swaps them.
        r.callingRows.forEach((row, k) => {
          if (k > 0 && row <= r.callingRows![k - 1]!)
            issue(
              `${at}: callingRows rise, one row per tier (${row} after ${r.callingRows![k - 1]})`,
            );
        });
        for (const row of r.callingRows) {
          const kinds = r.rows[row];
          if (!kinds || !kinds.every((k) => FIGHT_KINDS.has(k)))
            issue(`${at}: calling row ${row} is not a row of fights`);
        }
      }
      // The road's own rewards: one entry a row, each on a row with a skirmish to pay them.
      const paid = new Set<number>();
      for (const b of r.rewards ?? []) {
        if (paid.has(b.row)) issue(`${at}: reward row ${b.row} is given twice`);
        paid.add(b.row);
        if (!r.rows[b.row]?.includes('skirmish'))
          issue(`${at}: reward row ${b.row} has no skirmish to pay it`);
      }
    }
  });
}

/**
 * Phase 6 (docs/phase-6.md): the Atlas's Echoes and constellations, the weekly rotation, and what
 * the Phase 6 Deeds name. Every list is empty until W2-W4 fill it, so today it checks nothing.
 */
function lintPhase6(
  c: {
    movements: readonly { id: string; finale?: true }[];
    callings: readonly { id: string }[];
    dissonance: readonly { id: string; ranks: number }[];
    deeds: readonly { id: string; level?: string; constellation?: string; movement?: number }[];
    cosmetics: {
      robes: readonly { id: string }[];
      threads: readonly { id: string }[];
      titles: readonly { id: string }[];
    };
    echoes: readonly EchoDef[];
    constellations: readonly Constellation[];
    weekly: readonly WeeklyEntry[];
  },
  ctx: z.RefinementCtx,
  known: { heroes: Set<string>; encounters: Set<string> },
): void {
  const issue = (message: string) => ctx.addIssue({ code: 'custom', message });
  const unique = (label: string, ids: readonly string[]) => {
    const seen = new Set<string>();
    for (const id of ids) {
      if (seen.has(id)) issue(`duplicate ${label} id "${id}"`);
      seen.add(id);
    }
    return seen;
  };
  const constellations = unique(
    'constellation',
    c.constellations.map((k) => k.id),
  );
  const echoes = unique(
    'echo',
    c.echoes.map((e) => e.id),
  );
  const fieldMovements = new Set(c.movements.filter((m) => !m.finale).map((m) => m.id));
  const levels = new Map(c.dissonance.map((d) => [d.id, d.ranks]));
  const party = (heroes: readonly string[], where: string) => {
    if (new Set(heroes).size !== heroes.length) issue(`${where}: a party of distinct heroes`);
    for (const h of heroes) if (!known.heroes.has(h)) issue(`${where}: unknown hero "${h}"`);
  };
  const levelsOk = (list: readonly { id: string; rank: number }[], where: string) => {
    for (const l of list) {
      const ranks = levels.get(l.id);
      if (ranks === undefined) issue(`${where}: unknown Dissonance level "${l.id}"`);
      else if (l.rank > ranks) issue(`${where}: "${l.id}" has ${ranks} rank(s)`);
    }
  };
  for (const e of c.echoes) {
    const where = `echo "${e.id}"`;
    if (!constellations.has(e.constellation))
      issue(`${where}: unknown constellation "${e.constellation}"`);
    for (const leg of e.legs) {
      if (!fieldMovements.has(leg.movement))
        issue(`${where}: leg "${leg.movement}" is not a field Movement`);
      const fights = [
        leg.boss,
        ...(leg.miniboss ? [leg.miniboss] : []),
        ...(leg.fixed ?? []).map((f) => f.encounter),
      ];
      for (const id of fights)
        if (!known.encounters.has(id)) issue(`${where}: unknown encounter "${id}"`);
      if (leg.scale !== undefined && leg.scale > c.movements.length)
        issue(`${where}: scale ${leg.scale} is no Movement's`);
    }
    if (e.twists.party) party(e.twists.party, where);
    if (e.twists.dissonance) levelsOk(e.twists.dissonance, where);
  }
  const keepsakes = new Set([
    ...c.cosmetics.robes.map((r) => r.id),
    ...c.cosmetics.threads.map((t) => t.id),
    ...c.cosmetics.titles.map((t) => t.id),
  ]);
  for (const k of c.constellations)
    if (!keepsakes.has(k.reward)) issue(`constellation "${k.id}": unknown keepsake "${k.reward}"`);
  const callings = new Set(c.callings.map((k) => k.id));
  c.weekly.forEach((w, i) => {
    const where = `weekly entry ${i}`;
    if (w.route !== 'expedition' && !echoes.has(w.route))
      issue(`${where}: route "${w.route}" is neither 'expedition' nor an Echo`);
    if (w.calling !== null && !callings.has(w.calling))
      issue(`${where}: unknown calling "${w.calling}"`);
    party(w.party, where);
    levelsOk(w.dissonance, where);
  });
  for (const d of c.deeds) {
    const where = `deed "${d.id}"`;
    if (d.level !== undefined && !levels.has(d.level))
      issue(`${where}: unknown Dissonance level "${d.level}"`);
    if (d.constellation !== undefined && !constellations.has(d.constellation))
      issue(`${where}: unknown constellation "${d.constellation}"`);
    if (d.movement !== undefined && d.movement > c.movements.length)
      issue(`${where}: movement ${d.movement} is no Movement's`);
  }
}

// ── Root ──────────────────────────────────────────────────────────────────────────────

export const ContentSchema = z
  .object({
    weaver: WeaverDefSchema,
    thread: ThreadDefSchema,
    techniques: TechniquesDefSchema,
    resonance: ResonanceDefSchema,
    crescendo: CrescendoDefSchema,
    chorus: ChorusDefSchema,
    calls: CallsDefSchema,
    heroes: z.array(HeroDefSchema).min(3),
    /** Default party, by hero id, in slot order. */
    defaultParty: z.array(IdSchema).min(1).max(4),
    auras: z.array(AuraDefSchema).min(1).max(31),
    ornaments: z.array(OrnamentDefSchema),
    attacks: z.array(AttackDefSchema),
    enemies: z.array(EnemyDefSchema),
    affixes: z.array(AffixDefSchema),
    motifs: z.array(MotifDefSchema),
    relics: z.array(RelicDefSchema),
    boons: z.array(BoonDefSchema),
    events: z.array(RunEventDefSchema),
    callings: z.array(CallingDefSchema),
    astrolabe: AstrolabeSchema,
    deeds: z.array(DeedDefSchema),
    inscriptions: z.array(InscriptionDefSchema),
    curses: z.array(CurseDefSchema).min(1),
    reliquary: ReliquaryDefSchema,
    dissonance: z.array(DissonanceLevelSchema),
    dissonanceRules: DissonanceRulesSchema,
    bondRules: BondRulesSchema,
    talents: z.array(TalentDefSchema),
    altSolos: z.array(AltSoloDefSchema),
    techniqueVariants: z.array(TechniqueVariantDefSchema),
    starlight: StarlightRulesSchema,
    cosmetics: CosmeticsSchema,
    mastery: MasteryRulesSchema,
    scenes: z.array(SceneDefSchema),
    arenas: z.array(ArenaDefSchema).min(1),
    encounters: z.array(EncounterDefSchema).min(1),
    /** The Movements of an Expedition, in order (docs/phase-5a.md); the first is the Prelude. */
    movements: z.array(z.union([MovementDefSchema, FinaleMovementDefSchema])).min(1),
    /** Phase 6 (docs/phase-6.md): the Atlas of Echoes' Echoes and constellations. */
    echoes: z.array(EchoDefSchema),
    constellations: z.array(ConstellationSchema),
    /** Phase 6: the weekly rotation, only ever appended to (decision 7). */
    weekly: z.array(WeeklyEntrySchema),
    /** Directive acknowledgement lines. */
    barks: z.object({
      rally: z.array(z.string().min(1)).min(1),
      hold: z.array(z.string().min(1)).min(1),
      scatter: z.array(z.string().min(1)).min(1),
      focus: z.array(z.string().min(1)).min(1),
    }),
  })
  .superRefine((c, ctx) => {
    const unique = (label: string, ids: string[]) => {
      const seen = new Set<string>();
      for (const id of ids) {
        if (seen.has(id))
          ctx.addIssue({ code: 'custom', message: `duplicate ${label} id "${id}"` });
        seen.add(id);
      }
      return seen;
    };
    const heroes = unique(
      'hero',
      c.heroes.map((h) => h.id),
    );
    const auras = unique(
      'aura',
      c.auras.map((a) => a.id),
    );
    const attacks = unique(
      'attack',
      c.attacks.map((a) => a.id),
    );
    const enemies = unique(
      'enemy',
      c.enemies.map((e) => e.id),
    );
    const affixes = unique(
      'affix',
      c.affixes.map((a) => a.id),
    );
    unique(
      'motif',
      c.motifs.map((m) => m.id),
    );
    const ornaments = unique(
      'ornament',
      c.ornaments.map((o) => o.id),
    );
    const arenas = unique(
      'arena',
      c.arenas.map((a) => a.id),
    );
    const encounters = unique(
      'encounter',
      c.encounters.map((e) => e.id),
    );
    unique(
      'relic',
      c.relics.map((r) => r.id),
    );
    const boons = unique(
      'boon',
      c.boons.map((b) => b.id),
    );
    unique(
      'event',
      c.events.map((e) => e.id),
    );
    const need = (set: Set<string>, id: string, where: string) => {
      if (!set.has(id))
        ctx.addIssue({ code: 'custom', message: `${where} references unknown "${id}"` });
    };
    for (const h of c.heroes) {
      if (h.moveSpeed <= c.weaver.moveSpeed) {
        ctx.addIssue({
          code: 'custom',
          message: `hero "${h.id}" must be faster than the Weaver to hold formation`,
        });
      }
    }
    for (const id of c.defaultParty) need(heroes, id, 'defaultParty');
    for (const o of c.ornaments) {
      for (const x of o.excludes) need(ornaments, x, `ornament "${o.id}"`);
    }
    for (const e of c.enemies) for (const a of e.specials) need(attacks, a, `enemy "${e.id}"`);
    for (const a of c.attacks) {
      if (a.summon) need(enemies, a.summon.enemy, `attack "${a.id}"`);
      if (a.effect === 'damage' && a.damage === 0 && a.pctMaxHp === undefined) {
        ctx.addIssue({ code: 'custom', message: `damaging attack "${a.id}" has no damage` });
      }
    }
    for (const m of c.motifs) {
      if (m.requires.aura) need(auras, m.requires.aura, `motif "${m.id}"`);
      if (m.requires.hero) need(heroes, m.requires.hero, `motif "${m.id}"`);
    }
    // Triggers (docs/phase-5g.md): a motif's names only `'v'`; a relic's or boon's, its values.
    const lintTriggers = (
      triggers: readonly TriggerDef[] | undefined,
      names: (name: string) => boolean,
      where: string,
    ) => {
      for (const t of triggers ?? []) {
        if ((t.on === 'every') !== (t.period !== undefined))
          ctx.addIssue({
            code: 'custom',
            message: `${where}: a trigger has a period exactly when it is on 'every'`,
          });
        if (t.hero) need(heroes, t.hero, where);
        for (const v of triggerValues(t))
          if (typeof v === 'string' && !names(v))
            ctx.addIssue({ code: 'custom', message: `${where}: a trigger names unknown "${v}"` });
      }
    };
    for (const m of c.motifs) lintTriggers(m.triggers, (v) => v === 'v', `motif "${m.id}"`);
    for (const r of c.relics)
      lintTriggers(r.triggers, (v) => r.values[v] !== undefined, `relic "${r.id}"`);
    for (const b of c.boons)
      lintTriggers(b.triggers, (v) => b.values[v] !== undefined, `boon "${b.id}"`);
    for (const e of c.encounters) {
      need(arenas, e.arena, `encounter "${e.id}"`);
      if (e.boss) need(enemies, e.boss, `encounter "${e.id}"`);
      for (const w of e.waves) {
        for (const s of w.spawns) {
          need(enemies, s.enemy, `encounter "${e.id}"`);
          for (const a of s.affixes) need(affixes, a, `encounter "${e.id}"`);
        }
      }
    }
    /** Every {placeholder} in a text has a value. */
    const filled = (text: string, values: Record<string, number>, where: string) => {
      for (const m of text.matchAll(/\{([a-zA-Z]+)\}/g)) {
        if (values[m[1]!] === undefined)
          ctx.addIssue({ code: 'custom', message: `${where} has no value for {${m[1]}}` });
      }
    };
    for (const r of c.relics) {
      filled(r.text, r.values, `relic "${r.id}"`);
      if (r.curse) filled(r.curse, r.values, `relic "${r.id}"`);
      if ((r.rarity === 'cursed') !== (r.curse !== undefined))
        ctx.addIssue({
          code: 'custom',
          message: `relic "${r.id}": cursed relics, and only they, have a curse`,
        });
    }
    for (const b of c.boons) filled(b.text, b.values, `boon "${b.id}"`);
    unique(
      'calling',
      c.callings.map((k) => k.id),
    );
    // Option ids are global: the sim and saves name an option without its Calling.
    unique(
      'calling option',
      c.callings.flatMap((k) => k.tiers.flatMap((t) => t.options.map((o) => o.id))),
    );
    for (const k of c.callings) {
      filled(k.text, k.values, `calling "${k.id}"`);
      filled(k.crescendo, k.values, `calling "${k.id}"`);
      for (const t of k.tiers)
        for (const o of t.options) filled(o.text, o.values, `calling option "${o.id}"`);
    }
    // The Astrolabe: one start, links between real nodes listed once, and every node reachable.
    const astro = c.astrolabe;
    unique(
      'astrolabe node',
      astro.nodes.map((n) => n.id),
    );
    for (const n of astro.nodes) filled(n.text, n.values, `astrolabe node "${n.id}"`);
    const starts = astro.nodes.filter((n) => n.kind === 'start');
    if (starts.length !== 1)
      ctx.addIssue({ code: 'custom', message: 'the astrolabe needs exactly one start node' });
    const nodeIds = new Set(astro.nodes.map((n) => n.id));
    const adjacency = new Map<string, string[]>(astro.nodes.map((n) => [n.id, []]));
    const seenLinks = new Set<string>();
    for (const [a, b] of astro.links) {
      if (!nodeIds.has(a) || !nodeIds.has(b) || a === b) {
        ctx.addIssue({
          code: 'custom',
          message: `astrolabe link ${a}–${b} is not between two nodes`,
        });
        continue;
      }
      const key = a < b ? `${a}|${b}` : `${b}|${a}`;
      if (seenLinks.has(key))
        ctx.addIssue({ code: 'custom', message: `astrolabe link ${a}–${b} is listed twice` });
      seenLinks.add(key);
      adjacency.get(a)!.push(b);
      adjacency.get(b)!.push(a);
    }
    if (starts[0]) {
      const reached = new Set([starts[0].id]);
      const queue = [starts[0].id];
      while (queue.length > 0)
        for (const next of adjacency.get(queue.shift()!) ?? [])
          if (!reached.has(next)) {
            reached.add(next);
            queue.push(next);
          }
      for (const n of astro.nodes)
        if (!reached.has(n.id))
          ctx.addIssue({ code: 'custom', message: `astrolabe node "${n.id}" can't be reached` });
    }
    // Deeds: ten give a point, each names what its rule needs, and its text is all filled.
    unique(
      'deed',
      c.deeds.map((d) => d.id),
    );
    if (c.deeds.filter((d) => d.points === 1).length !== 10)
      ctx.addIssue({ code: 'custom', message: 'exactly 10 Deeds give an Astrolabe point' });
    const encounterIds = new Set(c.encounters.map((e) => e.id));
    const callingIds = new Set(c.callings.map((k) => k.id));
    for (const d of c.deeds) {
      const where = `deed "${d.id}"`;
      const needs: Record<(typeof DEED_TESTS)[number], string[]> = {
        win: [],
        runCount: ['stat', 'n'],
        grades: ['grade', 'n'],
        fight: ['encounter'],
        callAll: ['n'],
        calling: ['calling'],
        keystone: [],
        elites: ['n'],
        flawless: [],
        saveWays: ['n'],
        // Phase 6 (docs/phase-6.md): Red All the Way judges every fight, so no encounter.
        heroCeiling: ['hero', 'pct'],
        heroTally: ['hero', 'encounter', 'tally'],
        movementWithout: ['movement', 'stat'],
        dissonance: [],
        stars: ['n'],
        constellation: [],
        weeks: ['n'],
      };
      for (const field of needs[d.test]) {
        const has =
          field === 'n' || field === 'pct'
            ? d.values[field] !== undefined
            : d[
                field as 'stat' | 'encounter' | 'grade' | 'calling' | 'hero' | 'tally' | 'movement'
              ] !== undefined;
        if (!has) ctx.addIssue({ code: 'custom', message: `${where} (${d.test}) needs ${field}` });
      }
      if (d.encounter && !encounterIds.has(d.encounter))
        ctx.addIssue({ code: 'custom', message: `${where}: unknown encounter "${d.encounter}"` });
      if (d.calling && !callingIds.has(d.calling))
        ctx.addIssue({ code: 'custom', message: `${where}: unknown calling "${d.calling}"` });
      for (const m of d.text.matchAll(/\{([a-zA-Z]+)\}/g)) {
        const key = m[1]!;
        const named =
          key === 'encounter' ||
          key === 'calling' ||
          key === 'grade' ||
          key === 'hero' ||
          key === 'movement' ||
          key === 'level';
        const ok = named
          ? d[key as 'encounter' | 'calling' | 'grade' | 'hero' | 'movement' | 'level'] !==
            undefined
          : d.values[key] !== undefined;
        if (!ok) ctx.addIssue({ code: 'custom', message: `${where} has no value for {${key}}` });
      }
    }
    // The Reliquary: Inscriptions in order and filled, every category served, empowered relics
    // naming only their own numbers, and rules that add up.
    unique(
      'inscription',
      c.inscriptions.map((d) => d.id),
    );
    unique(
      'curse',
      c.curses.map((d) => d.id),
    );
    const lettered = (text: string, count: number, where: string) => {
      for (const m of text.matchAll(/\{([a-zA-Z]+)\}/g)) {
        const at = 'abcdefghij'.indexOf(m[1]!);
        if (m[1]!.length !== 1 || at < 0 || at >= count)
          ctx.addIssue({ code: 'custom', message: `${where} has no value for {${m[1]}}` });
      }
    };
    for (const d of c.inscriptions) {
      const where = `inscription "${d.id}"`;
      if (d.kind === 'dissonant') {
        lettered(d.text, d.effects.length, where);
        continue;
      }
      if (!d.text.includes('{v}') || /\{(?!v\})/.test(d.text))
        ctx.addIssue({ code: 'custom', message: `${where}: its text shows {v} and nothing else` });
      d.tiers.forEach(([min, max], i) => {
        const prev = d.tiers[i - 1];
        if (min > max || (prev && min < prev[1]))
          ctx.addIssue({ code: 'custom', message: `${where}: tier T${5 - i} is out of order` });
        for (const v of [min, max])
          if (Math.abs(v / d.step - Math.round(v / d.step)) > 1e-9)
            ctx.addIssue({ code: 'custom', message: `${where}: ${v} isn't a step of ${d.step}` });
      });
    }
    for (const cat of INSCRIPTION_CATEGORIES)
      for (const kind of ['normal', 'dissonant'] as const)
        if (!c.inscriptions.some((d) => d.category === cat && d.kind === kind))
          ctx.addIssue({ code: 'custom', message: `no ${kind} inscription for ${cat}` });
    for (const k of c.curses) lettered(k.text, k.effects.length, `curse "${k.id}"`);
    for (const r of c.relics) {
      for (const key of Object.keys(r.empowered?.values ?? {}))
        if (r.values[key] === undefined)
          ctx.addIssue({ code: 'custom', message: `relic "${r.id}" empowers no value "${key}"` });
    }
    const rq = c.reliquary;
    if (rq.slotRanks.some((r, i) => i > 0 && r <= rq.slotRanks[i - 1]!))
      ctx.addIssue({ code: 'custom', message: 'the Reliquary’s slots open in Rank order' });
    if (rq.inscribe.tierOdds.reduce((a, b) => a + b, 0) !== 100)
      ctx.addIssue({ code: 'custom', message: 'Inscribe’s tier odds add up to 100' });
    if (rq.inscribe.tierOdds.some((p, i) => p > 0 && 5 - i < rq.tierCap))
      ctx.addIssue({ code: 'custom', message: 'Inscribe rolls no tier past the cap' });
    if (Object.values(rq.dissonate.weights).reduce((a, b) => a + b, 0) <= 0)
      ctx.addIssue({ code: 'custom', message: 'a Dissonate has an outcome' });
    rq.bands.forEach((b, i) => {
      const prev = rq.bands[i - 1];
      if (prev && b.depth <= prev.depth)
        ctx.addIssue({ code: 'custom', message: 'the Reliquary’s bands go deeper in order' });
      if (b.tierOdds.reduce((a, x) => a + x, 0) !== 100)
        ctx.addIssue({ code: 'custom', message: `band ${b.depth}: its tier odds add up to 100` });
      if (b.tierOdds.some((p, t) => p > 0 && 5 - t < b.tierCap))
        ctx.addIssue({ code: 'custom', message: `band ${b.depth}: no tier past its cap` });
    });
    // Dissonance: unique levels, every placeholder filled.
    unique(
      'dissonance level',
      c.dissonance.map((d) => d.id),
    );
    for (const d of c.dissonance) filled(d.text, d.values, `dissonance level "${d.id}"`);
    // Bonds: for every hero with any, two talents a tier, one alternate Solo and two scenes.
    const br = c.bondRules;
    if (br.ranks[0] !== 0 || br.ranks.some((x, i) => i > 0 && x <= br.ranks[i - 1]!))
      ctx.addIssue({ code: 'custom', message: 'Bond ranks start at 0 and rise' });
    if (br.talentRanks.some((r, i) => i > 0 && r <= br.talentRanks[i - 1]!))
      ctx.addIssue({ code: 'custom', message: 'Bond talent tiers open in order' });
    if (br.soloRank <= br.talentRanks[2]!)
      ctx.addIssue({ code: 'custom', message: 'the alternate Solo opens after the talents' });
    const talentIds = unique(
      'talent',
      c.talents.map((t) => t.id),
    );
    unique(
      'alternate Solo',
      c.altSolos.map((s) => s.id),
    );
    unique(
      'scene',
      c.scenes.map((s) => s.id),
    );
    const bonded = new Set([...c.talents, ...c.altSolos, ...c.scenes].map((x) => x.hero));
    for (const hero of bonded) {
      need(heroes, hero, 'Bonds');
      for (const tier of [1, 2, 3])
        if (c.talents.filter((t) => t.hero === hero && t.tier === tier).length !== 2)
          ctx.addIssue({
            code: 'custom',
            message: `hero "${hero}" needs two talents in tier ${tier}`,
          });
      if (c.altSolos.filter((s) => s.hero === hero).length !== 1)
        ctx.addIssue({ code: 'custom', message: `hero "${hero}" needs one alternate Solo` });
      if (c.scenes.filter((s) => s.hero === hero).length !== 2)
        ctx.addIssue({ code: 'custom', message: `hero "${hero}" needs two scenes` });
    }
    for (const t of c.talents) filled(t.text, t.values, `talent "${t.id}"`);
    for (const s of c.altSolos) {
      filled(s.text, s.values, `alternate Solo "${s.id}"`);
      filled(s.cuedText, s.values, `alternate Solo "${s.id}"`);
      if (!(s.values.seconds! > 0))
        ctx.addIssue({ code: 'custom', message: `alternate Solo "${s.id}" needs its seconds` });
      if (talentIds.has(s.id) || c.heroes.some((h) => h.solo.id === s.id))
        ctx.addIssue({ code: 'custom', message: `alternate Solo "${s.id}" has its own id` });
    }
    // Technique variants: two per slot, their own ids, texts filled from values.
    unique(
      'technique variant',
      c.techniqueVariants.map((v) => v.id),
    );
    for (const slot of ['ward', 'chime', 'reel', 'glide'] as const)
      if (c.techniqueVariants.filter((v) => v.slot === slot).length !== 2)
        ctx.addIssue({ code: 'custom', message: `technique slot "${slot}" needs two variants` });
    for (const v of c.techniqueVariants) filled(v.text, v.values, `technique variant "${v.id}"`);
    // The Loom (docs/phase-4g.md): keepsakes with their own ids (the Atelier sells variants
    // beside them); titles bought or earned, from something real; one mastery reward per
    // Calling, each its own variant and the title that Calling's mastery earns.
    unique('Atelier item', [
      ...c.techniqueVariants.map((v) => v.id),
      ...c.cosmetics.robes.map((r) => r.id),
      ...c.cosmetics.threads.map((t) => t.id),
      ...c.cosmetics.titles.map((t) => t.id),
    ]);
    for (const t of c.cosmetics.titles) {
      if ((t.price === undefined) === (t.earned === undefined))
        ctx.addIssue({ code: 'custom', message: `title "${t.id}" is bought or earned, not both` });
      if (t.earned && 'mastery' in t.earned) need(callingIds, t.earned.mastery, `title "${t.id}"`);
      if (
        t.earned &&
        'deed' in t.earned &&
        !c.deeds.some((d) => d.id === (t.earned as { deed: string }).deed)
      )
        ctx.addIssue({ code: 'custom', message: `title "${t.id}": unknown Deed` });
    }
    const ml = c.mastery.levels;
    if (ml.length !== 5 || ml[0] !== 0 || ml.some((x, i) => i > 0 && x <= ml[i - 1]!))
      ctx.addIssue({ code: 'custom', message: 'mastery: five levels from 0, rising' });
    unique(
      'mastery Calling',
      c.mastery.callings.map((m) => m.calling),
    );
    unique(
      'mastery variant',
      c.mastery.callings.map((m) => m.variant),
    );
    for (const m of c.mastery.callings) {
      need(callingIds, m.calling, 'mastery');
      if (!c.techniqueVariants.some((v) => v.id === m.variant))
        ctx.addIssue({ code: 'custom', message: `mastery: unknown variant "${m.variant}"` });
      const title = c.cosmetics.titles.find((t) => t.id === m.title);
      if (!title?.earned || !('mastery' in title.earned) || title.earned.mastery !== m.calling)
        ctx.addIssue({
          code: 'custom',
          message: `mastery: "${m.title}" must be the title ${m.calling}'s mastery earns`,
        });
    }
    for (const ev of c.events) {
      unique(
        `choice in event "${ev.id}"`,
        ev.choices.map((ch) => ch.id),
      );
      // A way out that's always open: free, no motif or Chords to pick, no fight, no gamble.
      const free = ev.choices.some(
        (ch) =>
          ch.cost === 0 &&
          ch.motif === 'none' &&
          ch.chance === undefined &&
          !ch.effects.some((e) => e.kind === 'retune' || e.kind === 'fight'),
      );
      if (!free)
        ctx.addIssue({
          code: 'custom',
          message: `event "${ev.id}" needs a choice that is always open (free, nothing to pick)`,
        });
      for (const ch of ev.choices) {
        const where = `event "${ev.id}" choice "${ch.id}"`;
        if ((ch.chance !== undefined) !== (ch.failOutcome !== undefined))
          ctx.addIssue({ code: 'custom', message: `${where}: a gamble needs a failOutcome` });
        const needsMotif = [...ch.effects, ...ch.fail].some(
          (e) => e.kind === 'motifLevels' || e.kind === 'loseMotif',
        );
        if (needsMotif !== (ch.motif !== 'none'))
          ctx.addIssue({ code: 'custom', message: `${where}: motif effects need a chosen motif` });
        for (const e of [...ch.effects, ...ch.fail]) {
          if (e.kind === 'boon') need(boons, e.boon, where);
          if (e.kind === 'fight') need(encounters, e.encounter, where);
          if (e.kind === 'relic' && !c.relics.some((r) => r.rarity === e.rarity))
            ctx.addIssue({ code: 'custom', message: `${where}: no ${e.rarity} relics` });
        }
      }
    }
    // The roster (docs/phase-5b.md, "Content lint").
    const issue = (message: string) => ctx.addIssue({ code: 'custom', message });
    if (new Set(c.defaultParty).size !== c.defaultParty.length)
      issue('defaultParty names each hero once');
    const starters = new Set(c.defaultParty);
    const fightRecruits = c.events.flatMap((ev) =>
      ev.choices.flatMap((ch) =>
        [...ch.effects, ...ch.fail].flatMap((e) =>
          e.kind === 'fight' && e.recruit !== undefined ? [{ ev, ch, hero: e.recruit }] : [],
        ),
      ),
    );
    for (const h of c.heroes) {
      const where = `hero "${h.id}"`;
      if (starters.has(h.id) && h.recruit) issue(`${where} is in the default party: no recruit`);
      if (!starters.has(h.id) && !h.recruit) issue(`${where} needs a recruit`);
      if (h.recruit) {
        if (!fightRecruits.some((r) => r.ev.id === h.recruit!.event && r.hero === h.id))
          issue(`${where}: event "${h.recruit.event}" has no fight that recruits them`);
        if (h.recruit.fallback !== undefined)
          need(encounters, h.recruit.fallback, `${where} recruit fallback`);
        // docs/phase-5e.md: the Codex's locked line and the Result's fallback line are content.
        if (h.recruit.lockedText === undefined || h.recruit.fallbackText === undefined)
          issue(`${where}: a recruit needs lockedText and fallbackText`);
        // A Rank-gated recruit's choice carries the same Rank.
        for (const r of fightRecruits)
          if (r.hero === h.id && r.ch.rank !== h.recruit.rank)
            issue(
              `${where}: event "${r.ev.id}" choice "${r.ch.id}" needs rank ${h.recruit.rank ?? 'none'}`,
            );
      }
      // Each kit's own fields, for its kinds.
      for (const ab of h.abilities) {
        const at = `${where} ability "${ab.id}"`;
        if (ab.id === 'sunderLeap' && ab.minRange === undefined) issue(`${at} needs minRange`);
        if (ab.minRange !== undefined && !(ab.minRange < ab.range))
          issue(`${at}: minRange is below range`);
        if (
          ab.id === 'bloodletting' &&
          (ab.lifeCost === undefined ||
            ab.lifeFloor === undefined ||
            ab.hits === undefined ||
            ab.hitBonus === undefined)
        )
          issue(`${at} needs lifeCost, lifeFloor, hits and hitBonus`);
      }
      if (h.solo.id === 'redFrenzy' && (h.solo.radius === undefined || h.solo.pulse === undefined))
        issue(`${where} solo "redFrenzy" needs radius and pulse`);
      if (h.quirk.id === 'bloodlust' && h.quirk.below === undefined)
        issue(`${where} quirk "bloodlust" needs below`);
      if (h.passive) {
        if (!h.needs) issue(`${where} has a passive: it needs a Needs line`);
        // Blood Rage cuts your healing, so its Codex says so (docs/phase-5e.md: bloodRage only).
        if (h.passive.id === 'bloodRage' && !/heal/i.test(h.codex))
          issue(`${where} has a passive: its Codex names healing`);
      }
      // Seren's and Oro's kits (docs/phase-5e.md).
      for (const ab of h.abilities) {
        const at = `${where} ability "${ab.id}"`;
        if (ab.id === 'feint' && (ab.taunt === undefined || ab.step === undefined))
          issue(`${at} needs taunt and step`);
        if (ab.id === 'regrowth' && (ab.regrow === undefined || ab.healPct === undefined))
          issue(`${at} needs regrow and healPct`);
        if (ab.id === 'bramble' && ab.root === undefined) issue(`${at} needs root`);
        if ((ab.id === 'regrowth' || ab.id === 'bramble') && h.summons === undefined)
          issue(`${at} needs summons`);
      }
      if (
        h.solo.id === 'thousandCuts' &&
        (h.solo.pulse === undefined || h.solo.reach === undefined || h.solo.extendCap === undefined)
      )
        issue(`${where} solo "thousandCuts" needs pulse, reach and extendCap`);
      if (h.solo.id === 'wildgrowth' && (h.solo.radius === undefined || h.solo.pulse === undefined))
        issue(`${where} solo "wildgrowth" needs radius and pulse`);
      if (h.solo.id === 'wildgrowth' && h.summons === undefined)
        issue(`${where} solo "wildgrowth" needs summons`);
      if (
        h.quirk.id === 'showboat' &&
        (h.quirk.leash === undefined || h.quirk.seconds === undefined)
      )
        issue(`${where} quirk "showboat" needs leash and seconds`);
      if (h.quirk.id === 'gentle' && h.quirk.retreat === undefined)
        issue(`${where} quirk "gentle" needs retreat`);
      if ((h.role === 'duelist') !== (h.passive?.id === 'parry'))
        issue(`${where}: a duelist, and only a duelist, parries`);
      if ((h.role === 'summoner') !== (h.summons !== undefined))
        issue(`${where}: a summoner, and only a summoner, has summons`);
      if ((h.passive?.id === 'rootbond') !== (h.summons !== undefined))
        issue(`${where}: Rootbond goes with summons`);
    }
    for (const r of fightRecruits) {
      const where = `event "${r.ev.id}" choice "${r.ch.id}"`;
      need(heroes, r.hero, `${where} recruit`);
      if (starters.has(r.hero)) issue(`${where} recruits "${r.hero}", a starter`);
      // docs/phase-5e.md: `recruitsOf` matches event plus encounter, so a recruiting fight's
      // encounter is fought by no other choice of its event.
      for (const e of [...r.ch.effects, ...r.ch.fail])
        if (e.kind === 'fight' && e.recruit === r.hero)
          for (const other of r.ev.choices)
            if (
              other !== r.ch &&
              [...other.effects, ...other.fail].some(
                (o) => o.kind === 'fight' && o.encounter === e.encounter,
              )
            )
              issue(`${where}: choice "${other.id}" also fights "${e.encounter}"`);
    }
    // Rank-gated choices (docs/phase-5e.md): each recruits, and comes after every unranked one.
    for (const ev of c.events)
      ev.choices.forEach((ch, i) => {
        if (ch.rank === undefined) return;
        const where = `event "${ev.id}" choice "${ch.id}"`;
        if (!fightRecruits.some((r) => r.ev === ev && r.ch === ch))
          issue(`${where}: a ranked choice recruits`);
        if (ev.choices.slice(i + 1).some((later) => later.rank === undefined))
          issue(`${where}: a ranked choice comes after every unranked one`);
      });
    for (const ev of c.events)
      for (const ch of ev.choices)
        if (
          (ch.recruitedText !== undefined || ch.partyText !== undefined) &&
          !fightRecruits.some((r) => r.ev === ev && r.ch === ch)
        )
          issue(`event "${ev.id}" choice "${ch.id}": recruit texts need a fight that recruits`);
    for (let i = 0; i < c.heroes.length; i++)
      for (let j = i + 1; j < c.heroes.length; j++) {
        const a = c.heroes[i]!.formation;
        const b = c.heroes[j]!.formation;
        const df = a.forward - b.forward;
        const dr = a.right - b.right;
        if (df * df + dr * dr < 1.5 * 1.5)
          issue(
            `heroes "${c.heroes[i]!.id}" and "${c.heroes[j]!.id}": formation spots 1.5 m apart`,
          );
      }
    const motifIds = new Set(c.motifs.map((m) => m.id));
    const motifById = new Map(c.motifs.map((m) => [m.id, m]));
    for (const m of c.motifs) {
      const pre = m.requires.motifs;
      if (!pre) continue;
      const where = `motif "${m.id}"`;
      for (const id of pre) {
        need(motifIds, id, where);
        if (id === m.id) issue(`${where} can't require itself`);
      }
      // Gated before any draw, so a default party's Prelude never meets it: by a hero (Phase 5b),
      // or (Phase 5g, decision 4) as an Expedition-only Harmony.
      const gated =
        m.requires.hero !== undefined ||
        m.requires.expedition === true ||
        pre.some((id) => motifById.get(id)?.requires.hero !== undefined);
      if (!gated) issue(`${where} requires motifs: it must be hero-gated or Expedition-only`);
    }
    for (const a of c.attacks)
      if (
        a.decreeNoDome !== undefined &&
        !(a.answers.includes('dome') || /dome/i.test(a.decree ?? ''))
      )
        issue(`attack "${a.id}": decreeNoDome is for attacks the dome answers`);
    for (const d of c.deeds)
      if (d.test === 'heroCeiling' || d.test === 'heroTally') {
        const where = `deed "${d.id}"`;
        if (d.hero !== undefined) need(heroes, d.hero, where);
        if (d.points !== 0) issue(`${where}: a ${d.test} Deed gives no point`);
        if (
          d.test === 'heroTally' &&
          d.values.atLeast === undefined &&
          d.values.atMost === undefined
        )
          issue(`${where}: a heroTally Deed needs atLeast or atMost`);
      }
    lintMovements(c, ctx, { attacks, enemies, encounters });
    lintFinale(c, ctx, { attacks, enemies, encounters });
    lintMovement3(c, ctx, { attacks, enemies, encounters });
    lintPhase6(c, ctx, { heroes, encounters });
  });
export type Content = z.infer<typeof ContentSchema>;
export type ContentInput = z.input<typeof ContentSchema>;
