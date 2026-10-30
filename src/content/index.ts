import { ARENAS } from './arenas';
import { ENCOUNTERS } from './encounters';
import { AFFIXES, ATTACKS, ENEMIES } from './enemies';
import { HEROES } from './heroes';
import { MOTIFS } from './motifs';
import { AURAS } from './auras';
import { ORNAMENTS } from './ornaments';
import { ASTROLABE } from './astrolabe';
import { DEEDS } from './deeds';
import { CALLINGS } from './callings';
import { BOONS, RELICS } from './relics';
import { CURSES, INSCRIPTIONS, RELIQUARY } from './reliquary';
import { DISSONANCE, DISSONANCE_RULES } from './dissonance';
import { ALT_SOLOS, BOND_RULES, SCENES, TALENTS } from './bonds';
import { RUN_EVENTS } from './runEvents';
import { CALLS, CHORUS, CRESCENDO, RESONANCE, TECHNIQUES, THREAD, WEAVER } from './weaver';
import {
  ContentSchema,
  type ArenaDef,
  type AstrolabeNode,
  type AltSoloDef,
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
  type OrnamentDef,
  type RelicDef,
  type RunEventDef,
  type SceneDef,
  type TalentDef,
} from './schema';

/** Validated at module load: invalid content fails fast in dev, tests and CI. */
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
  attacks: ATTACKS,
  enemies: ENEMIES,
  affixes: AFFIXES,
  motifs: MOTIFS,
  relics: RELICS,
  boons: BOONS,
  events: RUN_EVENTS,
  callings: CALLINGS,
  astrolabe: ASTROLABE,
  deeds: DEEDS,
  inscriptions: INSCRIPTIONS,
  curses: CURSES,
  reliquary: RELIQUARY,
  dissonance: DISSONANCE,
  dissonanceRules: DISSONANCE_RULES,
  bondRules: BOND_RULES,
  talents: TALENTS,
  altSolos: ALT_SOLOS,
  scenes: SCENES,
  arenas: ARENAS,
  encounters: ENCOUNTERS,
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
 * Derived from the validated content itself, so any change that could change sim results
 * changes the version stamped into replays and golden files. Nobody has to remember to bump it.
 */
export const CONTENT_VERSION = `c-${contentHash(JSON.stringify(CONTENT))}`;

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
  return fillValues(deed.text, deed.values).replace(
    /\{([a-zA-Z]+)\}/g,
    (m, k: string) => named[k] ?? m,
  );
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
  AttackDef,
  AuraDef,
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
  OrnamentDef,
  PassiveEffect,
  RelicDef,
  RelicRarity,
  ReliquaryDef,
  RunEventDef,
  SceneDef,
  TalentDef,
} from './schema';
export { DISSONANCE_EFFECTS, INSCRIPTION_CATEGORIES, PASSIVE_EFFECTS } from './schema';
