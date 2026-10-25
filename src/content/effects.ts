/**
 * CONTRACT — the effect vocabulary content is written in (docs/plan/05 §7, 02 §12).
 *
 * Motifs, relics, ornaments, talents and Astrolabe nodes are bundles of stat modifiers and
 * triggers. Declared and validated from Phase 0; executed by the sim from Phase 1.
 * The power-math rules (02 §12) are enforced on top of this by content lint.
 */
import { z } from 'zod';

export const StatKeySchema = z.enum([
  // Weaver
  'maxLife',
  'maxSpirit',
  'moveSpeed',
  'reservationEfficiency',
  'resonanceGain',
  // Thread
  'threadPotency',
  'threadRange',
  'mendPower',
  'empowerDamage',
  'empowerAttackSpeed',
  // Techniques
  'wardBarrier',
  'wardDuration',
  'perfectWindow',
  'chimeRadius',
  'techniqueCooldown',
  // Auras
  'auraEffect',
  'auraRadius',
  // Heroes
  'heroDamage',
  'heroAttackSpeed',
  'heroMaxHp',
  'heroDamageTaken',
  'soloCharge',
  'cueCost',
  // Enemies
  'enemyDamage',
  'enemyDamageTaken',
  'enemySpeed',
]);
export type StatKey = z.infer<typeof StatKeySchema>;

/**
 * final = (base + Σ add) × (1 + Σ increased) × Π (1 + more)   (docs/plan/05 §4.6)
 * `more` is reserved for a short list of sources (02 §12 rule 1); content lint enforces it.
 */
export const ModifierBucketSchema = z.enum(['base', 'add', 'increased', 'more']);
export type ModifierBucket = z.infer<typeof ModifierBucketSchema>;

export const ModifierSchema = z.object({
  stat: StatKeySchema,
  bucket: ModifierBucketSchema,
  value: z.number(),
});
export type Modifier = z.infer<typeof ModifierSchema>;

export const TriggerEventSchema = z.enum([
  'perfectWard',
  'save',
  'cleanse',
  'reel',
  'threadAttach',
  'threadSnap',
  'cue',
  'crescendoStart',
  'allyHit',
  'allyLow',
  'enemyKilled',
  'telegraphResolved',
  'interval',
]);
export type TriggerEvent = z.infer<typeof TriggerEventSchema>;

export const EffectTargetSchema = z.enum([
  'weaver',
  'threaded',
  'allHeroes',
  'heroesInField',
  'triggerTarget',
  'enemiesNearTarget',
]);
export type EffectTarget = z.infer<typeof EffectTargetSchema>;

export const TechniqueRefSchema = z.enum(['ward', 'chime', 'reel', 'glide']);

const HealEffect = z
  .object({
    type: z.literal('heal'),
    target: EffectTargetSchema,
    pctMaxHp: z.number().min(0).optional(),
    flat: z.number().min(0).optional(),
  })
  .refine((e) => e.pctMaxHp !== undefined || e.flat !== undefined, 'heal needs pctMaxHp or flat');

const ShieldEffect = z.object({
  type: z.literal('shield'),
  target: EffectTargetSchema,
  pctMaxHp: z.number().positive(),
  durationSec: z.number().positive(),
});

const DamageEffect = z.object({
  type: z.literal('damage'),
  target: EffectTargetSchema,
  amount: z.number().positive(),
  radius: z.number().positive().optional(),
});

const ApplyStatusEffect = z.object({
  type: z.literal('applyStatus'),
  target: EffectTargetSchema,
  status: z.string().min(1),
  durationSec: z.number().positive(),
  stacks: z.number().int().positive().optional(),
});

const CleanseEffect = z.object({ type: z.literal('cleanse'), target: EffectTargetSchema });

const ResonanceEffect = z.object({ type: z.literal('resonance'), amount: z.number() });

const ModifyStatsEffect = z.object({
  type: z.literal('modifyStats'),
  target: EffectTargetSchema,
  modifiers: z.array(ModifierSchema).min(1),
  durationSec: z.number().positive(),
});

const SpawnEffect = z.object({
  type: z.literal('spawn'),
  entity: z.string().min(1),
  count: z.number().int().positive(),
});

const CooldownEffect = z.object({
  type: z.literal('cooldown'),
  technique: TechniqueRefSchema,
  refundPct: z.number().min(0).max(1),
});

export const EffectSchema = z.discriminatedUnion('type', [
  HealEffect,
  ShieldEffect,
  DamageEffect,
  ApplyStatusEffect,
  CleanseEffect,
  ResonanceEffect,
  ModifyStatsEffect,
  SpawnEffect,
  CooldownEffect,
]);
export type Effect = z.infer<typeof EffectSchema>;

export const ConditionSchema = z.object({
  chance: z.number().min(0).max(1).optional(),
  targetHpBelowPct: z.number().min(0).max(1).optional(),
  /** Internal cooldown for the trigger. */
  cooldownSec: z.number().positive().optional(),
});

const EffectListSchema = z.array(EffectSchema).min(1);

/** Fires on a sim event. */
const EventTriggerSchema = z.object({
  on: TriggerEventSchema.exclude(['interval']),
  when: ConditionSchema.optional(),
  do: EffectListSchema,
});

/** Fires on a clock; the period is required. */
const IntervalTriggerSchema = z.object({
  on: z.literal('interval'),
  everySec: z.number().positive(),
  when: ConditionSchema.optional(),
  do: EffectListSchema,
});

export const TriggerSchema = z.union([EventTriggerSchema, IntervalTriggerSchema]);
export type Trigger = z.infer<typeof TriggerSchema>;

/** What motifs, relics, ornaments, talents and nodes are made of. */
export const EffectBundleSchema = z.object({
  stats: z.array(ModifierSchema).default([]),
  triggers: z.array(TriggerSchema).default([]),
});
export type EffectBundle = z.infer<typeof EffectBundleSchema>;
