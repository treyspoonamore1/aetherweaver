import { ARENAS } from './arenas';
import { ENCOUNTERS } from './encounters';
import { AFFIXES, ATTACKS, ENEMIES } from './enemies';
import { HEROES } from './heroes';
export { SAPLING_NAMES } from './heroes';
import { MOTIFS } from './motifs';
import { AURAS } from './auras';
import { ORNAMENTS } from './ornaments';
import { ASTROLABE } from './astrolabe';
import { CONDUCTING_DEEDS, DEEDS, FINALE_DEEDS, PHASE6_DEEDS } from './deeds';
import { ROSTER_DEEDS } from './rosterDeeds';
import { CALLINGS } from './callings';
import { BOONS, RELICS } from './relics';
import { CURSES, INSCRIPTIONS, RELIQUARY } from './reliquary';
import { DISSONANCE, DISSONANCE_RULES } from './dissonance';
import { ALT_SOLOS, BOND_RULES, SCENES, TALENTS } from './bonds';
import { TECHNIQUE_VARIANTS } from './variants';
import { COSMETICS, MASTERY, STARLIGHT } from './loom';
import { MOVEMENTS } from './movements';
import { LEGION_AFFIXES, LEGION_ATTACKS, LEGION_ENEMIES } from './legion';
import {
  CRIMSON_LEGION,
  LEGION_ARENAS,
  LEGION_DEEDS,
  LEGION_ENCOUNTERS,
  LEGION_EVENTS,
} from './legionRun';
import { RUN_EVENTS } from './runEvents';
import { UNSTITCHED_AFFIXES, UNSTITCHED_ATTACKS, UNSTITCHED_ENEMIES } from './unstitched';
import {
  UNSTITCHED,
  UNSTITCHED_ARENAS,
  UNSTITCHED_DEEDS,
  UNSTITCHED_ENCOUNTERS,
  UNSTITCHED_EVENTS,
} from './unstitchedRun';
import { CRUCIBLE_ARENAS, CRUCIBLE_ATTACKS, CRUCIBLE_ENEMIES } from './crucible';
import { CRUCIBLE_ENCOUNTERS, FINALE } from './crucibleRun';
import { CALLS, CHORUS, CRESCENDO, RESONANCE, TECHNIQUES, THREAD, WEAVER } from './weaver';
import { FILL_BOONS, FILL_EVENTS, FILL_MOTIFS, FILL_RELICS } from './fill';
import { CONSTELLATIONS, ECHOES } from './echoes';
import { WEEKLY_ROTATION } from './weekly';
import {
  ContentSchema,
  type ArenaDef,
  type AstrolabeNode,
  type AltSoloDef,
  type TechniqueVariantDef,
  type AttackDef,
  type AuraDef,
  type BoonDef,
  type CallingDef,
  type CallingOption,
  type Content,
  type CurseDef,
  type DeedDef,
  type DissonanceLevel,
  type EncounterDef,
  type EnemyDef,
  type HeroDef,
  type InscriptionDef,
  type MotifDef,
  type AnyMovementDef,
  type BloodRagePassive,
  type OrnamentDef,
  type RelicDef,
  type RunEventDef,
  type SceneDef,
  type TalentDef,
} from './schema';

/**
 * Validated at module load: invalid content fails fast in dev, tests and CI. Later Movements'
 * content is appended after Movement I's, never interleaved, so every Movement I list keeps its
 * order (docs/phase-5a.md: pools are filtered by Movement in content order).
 */
export const CONTENT: Content = ContentSchema.parse({
  weaver: WEAVER,
  thread: THREAD,
  techniques: TECHNIQUES,
  resonance: RESONANCE,
  crescendo: CRESCENDO,
  chorus: CHORUS,
  calls: CALLS,
  heroes: HEROES,
  defaultParty: ['kael', 'lyra', 'vexis'],
  auras: AURAS,
  ornaments: ORNAMENTS,
  attacks: [...ATTACKS, ...LEGION_ATTACKS, ...UNSTITCHED_ATTACKS, ...CRUCIBLE_ATTACKS],
  enemies: [...ENEMIES, ...LEGION_ENEMIES, ...UNSTITCHED_ENEMIES, ...CRUCIBLE_ENEMIES],
  affixes: [...AFFIXES, ...LEGION_AFFIXES, ...UNSTITCHED_AFFIXES],
  // Phase 5g (docs/phase-5g.md, ground rule 7): the fill comes after every existing entry.
  motifs: [...MOTIFS, ...FILL_MOTIFS],
  relics: [...RELICS, ...FILL_RELICS],
  boons: [...BOONS, ...FILL_BOONS],
  events: [...RUN_EVENTS, ...LEGION_EVENTS, ...UNSTITCHED_EVENTS, ...FILL_EVENTS],
  callings: CALLINGS,
  astrolabe: ASTROLABE,
  // Seren's and Oro's (docs/phase-5e.md) come after the first 27, so those keep their order; then
  // the Conductor's badge (docs/phase-5f.md), and Phase 6's last of all (docs/phase-6.md).
  deeds: [
    ...DEEDS,
    ...LEGION_DEEDS,
    ...UNSTITCHED_DEEDS,
    ...FINALE_DEEDS,
    ...ROSTER_DEEDS,
    ...CONDUCTING_DEEDS,
    ...PHASE6_DEEDS,
  ],
  inscriptions: INSCRIPTIONS,
  curses: CURSES,
  reliquary: RELIQUARY,
  dissonance: DISSONANCE,
  dissonanceRules: DISSONANCE_RULES,
  bondRules: BOND_RULES,
  talents: TALENTS,
  altSolos: ALT_SOLOS,
  techniqueVariants: TECHNIQUE_VARIANTS,
  starlight: STARLIGHT,
  cosmetics: COSMETICS,
  mastery: MASTERY,
  scenes: SCENES,
  arenas: [...ARENAS, ...LEGION_ARENAS, ...UNSTITCHED_ARENAS, ...CRUCIBLE_ARENAS],
  encounters: [
    ...ENCOUNTERS,
    ...LEGION_ENCOUNTERS,
    ...UNSTITCHED_ENCOUNTERS,
    ...CRUCIBLE_ENCOUNTERS,
  ],
  movements: [...MOVEMENTS, CRIMSON_LEGION, UNSTITCHED, FINALE],
  // Phase 6 (docs/phase-6.md): the Atlas of Echoes and the weekly rotation.
  echoes: ECHOES,
  constellations: CONSTELLATIONS,
  weekly: WEEKLY_ROTATION,
  barks: {
    rally: ['On you!', 'Regrouping!', 'Right behind you.'],
    hold: ['Holding here.', 'Standing firm.', 'We wait for your word.'],
    scatter: ['Spreading out!', 'Give them room!', 'Fanning out!'],
    focus: ['Marked!', 'On that one!', 'Bringing it down!'],
  },
});

/** FNV-1a over the canonical JSON, in two independent 32-bit lanes. */
function contentHash(text: string): string {
  let a = 0x811c9dc5;
  let b = 0x01000193 ^ 0x9e3779b9;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193) >>> 0;
    b = Math.imul(b ^ c, 0x01000193 + 0x5bd1e995) >>> 0;
  }
  return a.toString(16).padStart(8, '0') + b.toString(16).padStart(8, '0');
}

/**
 * The lists Phase 6 added to the content (docs/phase-6.md, ground rule 5). Each is left out of the
 * hash while it is empty, so registering them moved no `contentVersion`; once it holds an entry it
 * is hashed like every other list.
 */
const HASHED_ONCE_FILLED: ReadonlySet<string> = new Set(['echoes', 'constellations', 'weekly']);

/**
 * The version of a validated content (docs/phase-5g.md): what `CONTENT_VERSION` is for
 * `CONTENT`, and what the masked replay recomputes for `CONTENT` without the slice's entries.
 */
export function contentVersionOf(content: Content): string {
  const text = JSON.stringify(content, function (this: unknown, key: string, value: unknown) {
    const empty = Array.isArray(value) && value.length === 0;
    return this === content && empty && HASHED_ONCE_FILLED.has(key) ? undefined : value;
  });
  return `c-${contentHash(text)}`;
}

/**
 * Derived from the validated content itself, so any change that could change sim results
 * changes the version stamped into replays and golden files. Nobody has to remember to bump it.
 */
export const CONTENT_VERSION = contentVersionOf(CONTENT);

function index<T extends { id: string }>(label: string, items: readonly T[]): (id: string) => T {
  const map = new Map(items.map((item) => [item.id, item]));
  return (id) => {
    const item = map.get(id);
    if (!item) throw new Error(`Unknown ${label} "${id}"`);
    return item;
  };
}

export const heroDef: (id: string) => HeroDef = index('hero', CONTENT.heroes);
export const enemyDef: (id: string) => EnemyDef = index('enemy', CONTENT.enemies);
export const attackDef: (id: string) => AttackDef = index('attack', CONTENT.attacks);
export const auraDef: (id: string) => AuraDef = index('aura', CONTENT.auras);
export const ornamentDef: (id: string) => OrnamentDef = index('ornament', CONTENT.ornaments);
export const motifDef: (id: string) => MotifDef = index('motif', CONTENT.motifs);
export const arenaDef: (id: string) => ArenaDef = index('arena', CONTENT.arenas);
export const encounterDef: (id: string) => EncounterDef = index('encounter', CONTENT.encounters);

const movementById = index('movement', CONTENT.movements);
/**
 * A Movement (docs/phase-5a.md) by content id, or by its 1-based number (1: Movement I, the
 * Prelude's map).
 */
export function movementDef(id: string | number): AnyMovementDef {
  if (typeof id === 'string') return movementById(id);
  const def = CONTENT.movements[id - 1];
  if (!def) throw new Error(`Unknown movement ${id}`);
  return def;
}
export const relicDef: (id: string) => RelicDef = index('relic', CONTENT.relics);
export const boonDef: (id: string) => BoonDef = index('boon', CONTENT.boons);
export const runEventDef: (id: string) => RunEventDef = index('event', CONTENT.events);
export const callingDef: (id: string) => CallingDef = index('calling', CONTENT.callings);
export const astrolabeNode: (id: string) => AstrolabeNode = index(
  'astrolabe node',
  CONTENT.astrolabe.nodes,
);
export const callingOption: (id: string) => CallingOption = index(
  'calling option',
  CONTENT.callings.flatMap((k) => k.tiers.flatMap((t) => t.options)),
);

/** The Calling whose path holds this option, and the option's tier (0-based). */
export function optionTier(id: string): { calling: CallingDef; tier: number } {
  for (const calling of CONTENT.callings) {
    const tier = calling.tiers.findIndex((t) => t.options.some((o) => o.id === id));
    if (tier >= 0) return { calling, tier };
  }
  throw new Error(`Unknown calling option "${id}"`);
}

/** Fills {name} placeholders from a relic's or boon's values. */
export function fillValues(text: string, values: Readonly<Record<string, number>>): string {
  return text.replace(/\{([a-zA-Z]+)\}/g, (all, key: string) =>
    values[key] === undefined ? all : String(values[key]),
  );
}

/** A relic's blessing, filled in: with its empowered numbers when a Dissonate Empowered it. */
export function relicText(def: RelicDef, empowered = false): string {
  return fillValues(def.text, relicValues(def, empowered));
}

/** A relic's numbers: its own, or with its empowered ones in their place. */
export function relicValues(def: RelicDef, empowered = false): Readonly<Record<string, number>> {
  return empowered && def.empowered ? { ...def.values, ...def.empowered.values } : def.values;
}

/** A cursed relic's curse, filled in (null for other relics). */
export function relicCurse(def: RelicDef): string | null {
  return def.curse === undefined ? null : fillValues(def.curse, def.values);
}

export function boonText(def: BoonDef): string {
  return fillValues(def.text, def.values);
}

/** An Astrolabe node's effect, filled in. */
export function astrolabeText(node: AstrolabeNode): string {
  return fillValues(node.text, node.values);
}

/** An Inscription (normal or Dissonant) by id. */
export const inscriptionDef: (id: string) => InscriptionDef = index(
  'inscription',
  CONTENT.inscriptions,
);
/** A Reliquary curse by id. */
export const curseDef: (id: string) => CurseDef = index('curse', CONTENT.curses);

/** {a}, {b}: a Dissonant Inscription's or a curse's effects, in order (sizes, unsigned). */
function lettered(effects: readonly { value: number }[]): Record<string, number> {
  return Object.fromEntries(effects.map((e, i) => ['abcdefghij'[i]!, Math.abs(e.value)]));
}

/** An Inscription's line, with its value (a Dissonant one has its own). */
export function inscriptionText(def: InscriptionDef, value = 0): string {
  return def.kind === 'normal'
    ? def.text.split('{v}').join(String(value))
    : fillValues(def.text, lettered(def.effects));
}

/** A Reliquary curse's line. */
export function curseText(def: CurseDef): string {
  return fillValues(def.text, lettered(def.effects));
}

/** A Dissonance level by id (docs/phase-4d.md). */
export const dissonanceLevel: (id: string) => DissonanceLevel = index(
  'dissonance level',
  CONTENT.dissonance,
);

/** A Dissonance level's effect, filled in. */
export function dissonanceText(level: DissonanceLevel): string {
  return fillValues(level.text, level.values);
}

/** A Bond talent by id (docs/phase-4e.md). */
export const talentDef: (id: string) => TalentDef = index('talent', CONTENT.talents);

/** A Bond talent's effect, filled in. */
export function talentText(def: TalentDef): string {
  return fillValues(def.text, def.values);
}

/** An alternate Solo by id. */
export const altSoloDef: (id: string) => AltSoloDef = index('alternate Solo', CONTENT.altSolos);

/** An alternate Solo's two lines, filled in: uncued, then cued. */
export function altSoloText(def: AltSoloDef): { text: string; cued: string } {
  return { text: fillValues(def.text, def.values), cued: fillValues(def.cuedText, def.values) };
}

/** A technique variant by id (docs/phase-4f.md). */
export const variantDef: (id: string) => TechniqueVariantDef = index(
  'technique variant',
  CONTENT.techniqueVariants,
);

/** A technique variant's effect, filled in. */
export function variantText(def: TechniqueVariantDef): string {
  return fillValues(def.text, def.values);
}

/** A Bond scene by id. */
export const sceneDef: (id: string) => SceneDef = index('scene', CONTENT.scenes);

/** A Deed by id. */
export const deedDef: (id: string) => DeedDef = index('deed', CONTENT.deeds);

/** A Deed's condition, filled in: its numbers, and the encounter, Calling and grade by name. */
export function deedText(deed: DeedDef): string {
  const named: Record<string, string> = {};
  // Mid-sentence: "Beat the Bellwarden".
  if (deed.encounter) named.encounter = encounterDef(deed.encounter).name.replace(/^The /, 'the ');
  if (deed.calling) named.calling = `the ${callingDef(deed.calling).name}`;
  if (deed.grade) named.grade = deed.grade;
  if (deed.hero) named.hero = heroDef(deed.hero).name;
  return fillValues(deed.text, deed.values).replace(
    /\{([a-zA-Z]+)\}/g,
    (m, k: string) => named[k] ?? m,
  );
}

/**
 * Does any of these heroes bring a dome (a Solo that is Kael's Aegis Wall, docs/phase-5b.md)?
 * The HUD's decree texts, the answer glyphs, the recaps and SAVE_HOW name the dome only then.
 * Unknown ids count as no dome.
 */
export function partyHasDome(heroIds: readonly string[]): boolean {
  return heroIds.some((id) => CONTENT.heroes.find((h) => h.id === id)?.solo.id === 'aegisWall');
}

/** The abilities that taunt a boss off the party (Kael's Challenge; docs/phase-5e.md). */
const BOSS_TAUNTS: ReadonlySet<string> = new Set(['challenge']);
/** The abilities that interrupt a cast (Shield Bash, Piercing Shot, Sunder Leap, Lunge). */
const INTERRUPTS: ReadonlySet<string> = new Set([
  'shieldBash',
  'piercingShot',
  'sunderLeap',
  'lunge',
]);

/**
 * Does any of these heroes bring a taunt that holds a boss (docs/phase-5e.md, Prep's party
 * notes)? Feint and the Saplings' taunts never bind a boss, so they don't count. Unknown ids
 * count as none.
 */
export function partyTaunts(heroIds: readonly string[]): boolean {
  return heroIds.some((id) =>
    CONTENT.heroes.find((h) => h.id === id)?.abilities.some((a) => BOSS_TAUNTS.has(a.id)),
  );
}

/** Does any of these heroes bring an interrupt (docs/phase-5e.md)? Unknown ids count as none. */
export function partyInterrupts(heroIds: readonly string[]): boolean {
  return heroIds.some((id) =>
    CONTENT.heroes.find((h) => h.id === id)?.abilities.some((a) => INTERRUPTS.has(a.id)),
  );
}

/**
 * The ids of a hero's abilities that interrupt a cast, in kit order (docs/phase-5e.md: Prep's
 * party notes name them). Empty for an unknown id or a hero with none.
 */
export function interruptAbilities(heroId: string): string[] {
  const def = CONTENT.heroes.find((h) => h.id === heroId);
  return def ? def.abilities.filter((a) => INTERRUPTS.has(a.id)).map((a) => a.id) : [];
}

/**
 * A hero's Blood Rage, or null (docs/phase-5e.md): the one reader of `def.passive` for every
 * Blood Rage rule, since a passive is now Blood Rage, Parry or Rootbond. For every hero before
 * Phase 5e it is non-null exactly when `def.passive` was set.
 */
export function bloodRageOf(def: Pick<HeroDef, 'passive'>): BloodRagePassive | null {
  return def.passive?.id === 'bloodRage' ? def.passive : null;
}

/** A Calling's passive and its Crescendo line, filled in. */
export function callingText(def: CallingDef): { passive: string; crescendo: string } {
  return {
    passive: fillValues(def.text, def.values),
    crescendo: fillValues(def.crescendo, def.values),
  };
}

export function optionText(def: CallingOption): string {
  return fillValues(def.text, def.values);
}

/** Player-facing motif text at a level (1-based), with the value filled in. */
export function motifText(def: MotifDef, level: number): string {
  const v = def.values[Math.min(def.values.length, Math.max(1, level)) - 1] ?? def.values[0];
  return def.text.split('{v}').join(String(v));
}

export type {
  AltSoloDef,
  ArenaDef,
  Astrolabe,
  AstrolabeNode,
  AffixDef,
  AttackDef,
  AuraDef,
  Biome,
  BondRules,
  BoonDef,
  CallingDef,
  CallingOption,
  Content,
  CurseDef,
  DeedDef,
  DissonanceEffect,
  DissonanceLevel,
  DissonanceRules,
  EncounterDef,
  EnemyDef,
  EventChoice,
  EventEffect,
  HeroDef,
  InscriptionCategory,
  InscriptionDef,
  MotifDef,
  MovementDef,
  AnyMovementDef,
  BloodRagePassive,
  HeroPassive,
  HeroSummons,
  ParryPassive,
  RootbondPassive,
  FinaleMovementDef,
  RoadVariant,
  OrnamentDef,
  PassiveEffect,
  RelicDef,
  RelicRarity,
  ReliquaryDef,
  RunEventDef,
  SceneDef,
  StatusPayload,
  TalentDef,
  TechniqueVariantDef,
  Cosmetics,
  MasteryRules,
  StarlightRules,
  // Phase 6 (docs/phase-6.md).
  Constellation,
  EchoDef,
  EchoLeg,
  EchoTwists,
  KeepsakeEarned,
  WeeklyEntry,
} from './schema';
export {
  AILMENT_IDS,
  DISSONANCE_EFFECTS,
  HERO_TALLY_STATS,
  INSCRIPTION_CATEGORIES,
  PASSIVE_EFFECTS,
  isFieldMovement,
} from './schema';
