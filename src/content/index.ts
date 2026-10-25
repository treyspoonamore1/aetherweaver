import { ARENAS } from './arenas';
import { ENCOUNTERS } from './encounters';
import { AFFIXES, ATTACKS, ENEMIES } from './enemies';
import { HEROES } from './heroes';
import { MOTIFS } from './motifs';
import { AURAS } from './auras';
import { CRESCENDO, RESONANCE, TECHNIQUES, THREAD, WEAVER } from './weaver';
import {
  ContentSchema,
  type ArenaDef,
  type AttackDef,
  type AuraDef,
  type Content,
  type EncounterDef,
  type EnemyDef,
  type HeroDef,
  type MotifDef,
} from './schema';

/** Validated at module load: invalid content fails fast in dev, tests and CI. */
export const CONTENT: Content = ContentSchema.parse({
  weaver: WEAVER,
  thread: THREAD,
  techniques: TECHNIQUES,
  resonance: RESONANCE,
  crescendo: CRESCENDO,
  heroes: HEROES,
  defaultParty: ['kael', 'lyra', 'vexis'],
  auras: AURAS,
  attacks: ATTACKS,
  enemies: ENEMIES,
  affixes: AFFIXES,
  motifs: MOTIFS,
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
export const motifDef: (id: string) => MotifDef = index('motif', CONTENT.motifs);
export const arenaDef: (id: string) => ArenaDef = index('arena', CONTENT.arenas);
export const encounterDef: (id: string) => EncounterDef = index('encounter', CONTENT.encounters);

/** Player-facing motif text at a level (1-based), with the value filled in. */
export function motifText(def: MotifDef, level: number): string {
  const v = def.values[Math.min(def.values.length, Math.max(1, level)) - 1] ?? def.values[0];
  return def.text.split('{v}').join(String(v));
}

export type {
  ArenaDef,
  AttackDef,
  AuraDef,
  Content,
  EncounterDef,
  EnemyDef,
  HeroDef,
  MotifDef,
} from './schema';
