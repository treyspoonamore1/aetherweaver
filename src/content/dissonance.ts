/**
 * Dissonance (docs/phase-4d.md): opt-in levels chosen before a run, each worth points per rank.
 * A level's `effect` names what it does (the sim's mods or the run layer read it); `values` are
 * its numbers per rank, in the units the text shows (15 = 15%, 3 = 3 m).
 */
import { POSTLUDE } from './crucible';
import type { AnswerTagSchema, ContentInput } from './schema';
import type { z } from 'zod';

type AnswerTag = z.infer<typeof AnswerTagSchema>;

export const DISSONANCE: ContentInput['dissonance'] = [
  {
    id: 'brisk_foes',
    name: 'Brisk Foes',
    effect: 'enemy_speed',
    ranks: 1,
    points: 1,
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
    points: 1,
    values: { pct: 10 },
    text: 'Enemies’ wind-ups are {pct}% shorter for each rank.',
  },
  {
    id: 'muted_choir',
    name: 'Muted Choir',
    effect: 'aura_radius',
    ranks: 1,
    points: 1,
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
    text: 'In fights, heroes are healed {pct}% less for each rank.',
  },
  {
    id: 'elite_vanguard',
    name: 'Elite Vanguard',
    effect: 'elite_vanguard',
    ranks: 1,
    points: 5,
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
    points: 5,
    values: { pct: 30 },
    text: 'Enemies rise once at {pct}% of their life (not bosses or mini-bosses).',
  },
  {
    id: 'unforgiving',
    name: 'Unforgiving',
    effect: 'no_respite_heal',
    ranks: 1,
    points: 1,
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
  // ── Phase 6 (docs/phase-6.md): the last three, appended so every earlier level keeps its place ──
  {
    id: 'tyrant',
    name: 'Tyrant',
    effect: 'tyrant',
    ranks: 1,
    points: 4,
    // The borrowed attack's cooldown (% of its own), and its first cast (s into the phase).
    values: { cooldown: 150, first: 6 },
    text: 'Bosses and mini-bosses take up one more attack in each phase, borrowed from the foes of their road.',
  },
  {
    id: 'mimicry',
    name: 'Mimicry',
    effect: 'mimicry',
    ranks: 1,
    points: 3,
    values: { perWave: 1 },
    // One enemy of each wave that has one besides its boss or mini-boss (director.ts, `mimicry`).
    text: 'In each wave, {perWave} enemy that isn’t a boss or a mini-boss carries Mimicking: it copies your Empower, Ward or Chime.',
  },
  {
    id: 'true_dissonance',
    name: 'True Dissonance',
    effect: 'true_dissonance',
    ranks: 1,
    points: 5,
    // `life`: the share of its life the Conductor rises with (%). `finalePar`: how much longer the
    // Silent Conductor's fight's par is on this level (%), read by the run layer as `parMult`.
    values: { life: Math.round(POSTLUDE.life * 100), finalePar: 40 },
    text: 'The Silent Conductor rises from its fall with {life}% of its life and plays a fourth phase, the Postlude. Expeditions only.',
  },
];

/**
 * Tyrant's Decree (docs/phase-6.md): what the boss takes up for its phase, then its answers, each
 * in a few words. The second sentence is the answer, so Blind Score cuts it as every Decree.
 * Names come from content (the boss's, the foe's and the attack's); no number is in it.
 */
export function tyrantDecree(
  boss: string,
  foe: string,
  attack: string,
  answers: readonly AnswerTag[],
): string {
  const who = boss.startsWith('The ') ? `the ${boss.slice(4)}` : boss;
  const taken = foe === boss ? `plays its ${attack} more often` : `takes up the ${foe}’s ${attack}`;
  const head = `Tyrant — ${who} ${taken}.`;
  const said = answers.map((a) => TYRANT_ANSWERS[a]);
  if (said.length === 0) return head;
  const list = said.length === 1 ? said[0]! : `${said.slice(0, -1).join(', ')}, or ${said.at(-1)!}`;
  return `${head} ${list.charAt(0).toUpperCase()}${list.slice(1)}.`;
}

/** Each answer as Tyrant's Decree says it. */
const TYRANT_ANSWERS: Readonly<Record<AnswerTag, string>> = {
  ward: 'Ward it',
  chime: 'Chime it away',
  reel: 'Reel the target',
  focus: 'Focus the boss',
  scatter: 'scatter',
  stack: 'stack up',
  move: 'step aside',
  dome: 'raise the dome',
  mend: 'Mend them above it',
  thread: 're-thread',
  empower: 'Empower',
  crescendo: 'Crescendo',
};

/** When it opens and what its points pay. */
export const DISSONANCE_RULES: ContentInput['dissonanceRules'] = {
  // A Finale clear and this Rank open it, in either order (docs/phase-5d.md).
  openRank: 15,
  // Per point: % more Weaver XP and Tuning Shards.
  xpPerPoint: 3,
  shardsPerPoint: 4,
  // From these totals: a boss beaten with an A pays a Tear too; every win pays one more.
  tearOnA: 10,
  tearOnWin: 20,
};
