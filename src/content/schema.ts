/**
 * CONTRACT v3 — content schemas (docs/plan/05 §7). Content is data, validated with zod at
 * load time and in CI. TypeScript types are inferred from the schemas: one source of truth.
 * Player-facing numbers in text are generated from these values (docs/plan/02 §12 rule 7).
 */
import { z } from 'zod';

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
]);

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
});

export const SoloKindSchema = z.enum(['aegisWall', 'galeBarrage', 'starfall']);

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
});

export const HeroQuirkSchema = z.object({
  id: z.enum(['gloryHound', 'greedyShot', 'spellbound']),
  name: z.string(),
  description: z.string(),
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
});

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
]);

export const AttackDefSchema = z.object({
  id: IdSchema,
  name: z.string(),
  kind: TelegraphKindSchema,
  /** What it does when it resolves. */
  effect: z.enum(['damage', 'healAllies', 'summon', 'suppress']),
  windup: Seconds,
  cooldown: Seconds,
  /** Seconds before the first use after the enemy engages. */
  initialDelay: Seconds,
  damage: z.number().nonnegative(),
  /** Alternative to `damage`: fraction of the target's max HP. */
  pctMaxHp: Pct.optional(),
  radius: z.number().nonnegative(),
  angleDeg: z.number().min(0).max(360),
  length: z.number().nonnegative(),
  width: z.number().nonnegative(),
  innerRadius: z.number().nonnegative(),
  /** Max distance from the target to start the attack. */
  range: z.number().positive(),
  targeting: TargetingSchema,
  answers: z.array(AnswerTagSchema).min(1),
  status: z.object({ id: StatusIdSchema, duration: Seconds }).optional(),
  interruptible: z.boolean(),
  /** Summon: enemy id and count. Heal: amount per second (uses `damage`). */
  summon: z.object({ enemy: IdSchema, count: z.number().int().positive() }).optional(),
  /** Boss decree text, announced when it starts. */
  decree: z.string().optional(),
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
  }),
  /** Distance kept from the target (0 = melee). */
  preferredRange: z.number().nonnegative(),
  specials: z.array(IdSchema),
  /** Aura suppression field radius (Mutes); 0 = none. */
  suppressRadius: z.number().nonnegative(),
  codex: z.string(),
});
export type EnemyDef = z.infer<typeof EnemyDefSchema>;

export const AffixDefSchema = z.object({
  id: IdSchema,
  name: z.string(),
  description: z.string(),
  color: ColorSchema,
});

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
    requires: z.object({ aura: IdSchema.optional(), hero: IdSchema.optional() }).default({}),
    tags: z.array(z.string()).default([]),
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
  /** A fight; winning it offers `relics` relics to choose from. */
  z
    .object({
      kind: z.literal('fight'),
      encounter: IdSchema,
      relics: z.number().int().positive(),
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
] as const;
/** The fight stats a `runCount` Deed may total over a run. */
export const DEED_STATS = [
  'responses',
  'perfects',
  'saves',
  'clutchCleanses',
  'reels',
  'cues',
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
    /** Its numbers: `n` (how many) and, for a fight, `downs` (at most). */
    values: ValuesSchema,
    /** {n}, {downs} from `values`; {encounter}, {calling}, {grade} by name. */
    text: z.string(),
  })
  .strict();
export type DeedDef = z.infer<typeof DeedDefSchema>;

// ── Arenas and encounters ─────────────────────────────────────────────────────────────

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
});
export type EncounterDef = z.infer<typeof EncounterDefSchema>;

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
    arenas: z.array(ArenaDefSchema).min(1),
    encounters: z.array(EncounterDefSchema).min(1),
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
      };
      for (const field of needs[d.test]) {
        const has =
          field === 'n'
            ? d.values.n !== undefined
            : d[field as 'stat' | 'encounter' | 'grade' | 'calling'] !== undefined;
        if (!has) ctx.addIssue({ code: 'custom', message: `${where} (${d.test}) needs ${field}` });
      }
      if (d.encounter && !encounterIds.has(d.encounter))
        ctx.addIssue({ code: 'custom', message: `${where}: unknown encounter "${d.encounter}"` });
      if (d.calling && !callingIds.has(d.calling))
        ctx.addIssue({ code: 'custom', message: `${where}: unknown calling "${d.calling}"` });
      for (const m of d.text.matchAll(/\{([a-zA-Z]+)\}/g)) {
        const key = m[1]!;
        const named = key === 'encounter' || key === 'calling' || key === 'grade';
        const ok = named
          ? d[key as 'encounter' | 'calling' | 'grade'] !== undefined
          : d.values[key] !== undefined;
        if (!ok) ctx.addIssue({ code: 'custom', message: `${where} has no value for {${key}}` });
      }
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
  });
export type Content = z.infer<typeof ContentSchema>;
export type ContentInput = z.input<typeof ContentSchema>;
