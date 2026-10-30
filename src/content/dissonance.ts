/**
 * Dissonance (docs/phase-4d.md): opt-in levels chosen before a run, each worth points per rank.
 * A level's `effect` names what it does (the sim's mods or the run layer read it); `values` are
 * its numbers per rank, in the units the text shows (15 = 15%, 3 = 3 m).
 */
import type { ContentInput } from './schema';

export const DISSONANCE: ContentInput['dissonance'] = [
  {
    id: 'brisk_foes',
    name: 'Brisk Foes',
    effect: 'enemy_speed',
    ranks: 1,
    points: 2,
    values: { pct: 15 },
    text: 'Enemies move {pct}% faster.',
  },
  {
    id: 'hardened',
    name: 'Hardened',
    effect: 'enemy_life',
    ranks: 2,
    points: 3,
    values: { pct: 25 },
    text: 'Enemies have {pct}% more life for each rank.',
  },
  {
    id: 'short_fuse',
    name: 'Short Fuse',
    effect: 'windup',
    ranks: 2,
    points: 3,
    values: { pct: 10 },
    text: 'Enemies’ wind-ups are {pct}% shorter for each rank.',
  },
  {
    id: 'muted_choir',
    name: 'Muted Choir',
    effect: 'aura_radius',
    ranks: 1,
    points: 2,
    values: { pct: 15 },
    text: 'Your field and your beam song’s echo reach {pct}% less far.',
  },
  {
    id: 'fragile_threads',
    name: 'Fragile Threads',
    effect: 'thread_range',
    ranks: 1,
    points: 1,
    values: { metres: 3 },
    text: 'The Thread snaps {metres} m sooner.',
  },
  {
    id: 'wounding_strikes',
    name: 'Wounding Strikes',
    effect: 'heal_received',
    ranks: 2,
    points: 2,
    values: { pct: 15 },
    text: 'Heroes are healed {pct}% less for each rank.',
  },
  {
    id: 'elite_vanguard',
    name: 'Elite Vanguard',
    effect: 'elite_vanguard',
    ranks: 1,
    points: 3,
    values: { elites: 1, affixes: 1 },
    text: 'Elite fights bring {elites} more elite, and every elite carries {affixes} more affix.',
  },
  {
    id: 'silent_cues',
    name: 'Silent Cues',
    effect: 'cue_cost',
    ranks: 1,
    points: 1,
    values: { resonance: 10 },
    text: 'A Cue costs {resonance} more Resonance.',
  },
  {
    id: 'restless_dead',
    name: 'Restless Dead',
    effect: 'restless_dead',
    ranks: 1,
    points: 3,
    values: { pct: 30 },
    text: 'Enemies rise once at {pct}% of their life (not bosses or mini-bosses).',
  },
  {
    id: 'unforgiving',
    name: 'Unforgiving',
    effect: 'no_respite_heal',
    ranks: 1,
    points: 2,
    values: {},
    text: 'Respites no longer heal.',
  },
  {
    id: 'blind_score',
    name: 'Blind Score',
    effect: 'blind_score',
    ranks: 1,
    points: 2,
    values: {},
    text: 'Telegraphs don’t show which answer they want.',
  },
  {
    id: 'discordant_pact',
    name: 'Discordant Pact',
    effect: 'cursed_start',
    ranks: 1,
    points: 1,
    values: {},
    text: 'Start the run with a random cursed relic.',
  },
];

/** When it opens and what its points pay. */
export const DISSONANCE_RULES: ContentInput['dissonanceRules'] = {
  // The first win at this Rank or above opens it.
  openRank: 15,
  // Per point: % more Weaver XP and Tuning Shards.
  xpPerPoint: 3,
  shardsPerPoint: 4,
  // From these totals: a boss beaten with an A pays a Tear too; every win pays one more.
  tearOnA: 10,
  tearOnWin: 20,
};
