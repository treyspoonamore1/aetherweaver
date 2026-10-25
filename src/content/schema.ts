/**
 * CONTRACT v2 — content schemas (docs/plan/05 §7). Content is data, validated with zod at
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
  }),
  decayDelay: Seconds,
  decayPerSec: z.number().nonnegative(),
  cueCost: z.number().positive(),
  crescendoCost: z.number().positive(),
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
  }),
});
export type AuraDef = z.infer<typeof AuraDefSchema>;

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
    heroes: z.array(HeroDefSchema).min(3),
    /** Default party, by hero id, in slot order. */
    defaultParty: z.array(IdSchema).min(1).max(4),
    auras: z.array(AuraDefSchema).min(1),
    attacks: z.array(AttackDefSchema),
    enemies: z.array(EnemyDefSchema),
    affixes: z.array(AffixDefSchema),
    motifs: z.array(MotifDefSchema),
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
    const arenas = unique(
      'arena',
      c.arenas.map((a) => a.id),
    );
    unique(
      'encounter',
      c.encounters.map((e) => e.id),
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
  });
export type Content = z.infer<typeof ContentSchema>;
export type ContentInput = z.input<typeof ContentSchema>;
