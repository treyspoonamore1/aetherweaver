/**
 * Phase 6 in the fight (docs/phase-6.md, the three levels' "what the player sees"): Tyrant's
 * decree and its line under the boss bar, the Postlude's fourth pip and decree, and the Mimic's
 * first-sighting card when an ordinary enemy carries Mimicking under Mimicry. Pure functions of
 * the sim's state and events (W0's types), so they can be tested on hand-built states.
 *
 * Reads: `enemy.tyrant` (`{ attack, from, phase }`), the `tyrantEdict` event (`boss`, `attack`,
 * `from`), `state.field.finale.postlude` (`since`, `riseUntil`, `enraged`), the `postludeRose`
 * event (`boss`), `state.dissonance.levels` and each enemy's `affixes` and `tier`. Names come from
 * content (the enemy, the attack and its answers, the levels'); the borrowed foe's accent from
 * `render/tyrantCues.ts`.
 */
import { CONTENT, enemyDef, type DissonanceEffect } from '../../content';
import type { WorldState } from '../../sim';
import type { SimEventOf } from '../../sim/events';
import { tyrantAccentHex, tyrantFoeName } from '../../render/tyrantCues';
import type { AnswerTag } from '../types';
import { blindDecree } from '../screens/dissonanceModel';

/** A level's name by its effect, as content names it, or `fallback` while content has none. */
function levelNamed(effect: DissonanceEffect, fallback: string): string {
  return CONTENT.dissonance.find((d) => d.effect === effect)?.name ?? fallback;
}

/** Is a level with this effect on in the fight? */
export function levelOn(state: Pick<WorldState, 'dissonance'>, effect: DissonanceEffect): boolean {
  return state.dissonance.levels.some(
    (l) => CONTENT.dissonance.find((d) => d.id === l.id)?.effect === effect,
  );
}

// ── Answers in words ───────────────────────────────────────────────────────────────────

const ANSWER_WORDS: Readonly<Record<AnswerTag, string>> = {
  ward: 'Ward it',
  chime: 'Chime it away',
  reel: 'Reel the target',
  focus: 'Focus the caster',
  scatter: 'scatter',
  stack: 'rally the party',
  move: 'step aside',
  dome: 'Cue a dome',
  mend: 'Mend them above the line',
  thread: 'move the Thread',
  empower: 'Empower',
  crescendo: 'Crescendo',
};

/** "Ward it, Reel the target, or step aside." from an attack's answer tags (null: none). */
export function answerSentence(answers: readonly AnswerTag[], rewinds = false): string | null {
  const words = answers.map((a) =>
    a === 'reel' && rewinds ? 'Rewind the target' : ANSWER_WORDS[a],
  );
  if (words.length === 0) return null;
  const list =
    words.length === 1
      ? words[0]!
      : `${words.slice(0, -1).join(', ')}${words.length > 2 ? ',' : ''} or ${words.at(-1)}`;
  return `${list.charAt(0).toUpperCase()}${list.slice(1)}.`;
}

/** "the Bellwarden" (a name that starts "The" keeps it, lowercased mid-sentence). */
function theName(name: string): string {
  return /^the /i.test(name) ? `the ${name.slice(4)}` : `the ${name}`;
}

/** A name as a sentence's subject: "The Bellwarden", "Vharun, the Crimson Warden". */
function subject(name: string): string {
  return /^the /i.test(name) ? `The ${name.slice(4)}` : name;
}

// ── Tyrant ─────────────────────────────────────────────────────────────────────────────

export interface TyrantDecree {
  /** The decree's name: the level's ("Tyrant"). */
  name: string;
  /** "The Bellwarden takes up the Glass Lancer’s Glass Lance. Ward it, Reel the target, or step aside." */
  text: string;
  /** The borrowed foe's name ("Glass Lancer"), the attack's ("Glass Lance"). */
  foe: string;
  attack: string;
  answers: AnswerTag[];
  /** The borrowed foe's accent (the ring the boss wears for the phase). */
  accent: string;
  phase: number;
}

/**
 * Tyrant's decree for a boss holding a borrowed attack: its own name, the foe's and the attack's,
 * then its answers (from the attack's tags), so Blind Score cuts it to the first sentence as it
 * cuts every decree. The Silent Conductor borrows its own attacks: it plays them earlier.
 */
export function tyrantDecree(
  bossDefId: string,
  hold: { attack: string; from: string; phase: number },
  opts: { blind?: boolean; rewinds?: boolean } = {},
): TyrantDecree {
  const boss = (() => {
    try {
      return enemyDef(bossDefId).name;
    } catch {
      return bossDefId;
    }
  })();
  const attack = CONTENT.attacks.find((a) => a.id === hold.attack);
  const attackName = attack?.name ?? hold.attack;
  const answers = [...(attack?.answers ?? [])] as AnswerTag[];
  const own = hold.from === bossDefId;
  const foe = tyrantFoeName(hold.from);
  const first = own
    ? `${subject(boss)} plays its ${attackName} earlier.`
    : `${subject(boss)} takes up ${theName(foe)}’s ${attackName}.`;
  const answer = answerSentence(answers, opts.rewinds);
  const full = answer ? `${first} ${answer}` : first;
  return {
    name: levelNamed('tyrant', 'Tyrant'),
    text: opts.blind ? blindDecree(full) : full,
    foe,
    attack: attackName,
    answers,
    accent: tyrantAccentHex(hold.from),
    phase: hold.phase,
  };
}

/** The decree a `tyrantEdict` announces, read against the state (null: its boss is gone). */
export function tyrantEdictDecree(
  state: WorldState,
  event: SimEventOf<'tyrantEdict'>,
  opts: { rewinds?: boolean } = {},
): TyrantDecree | null {
  const boss = state.entities.get(event.boss)?.enemy;
  if (!boss) return null;
  return tyrantDecree(
    boss.defId,
    { attack: event.attack, from: event.from, phase: event.phase },
    { blind: state.dissonance.blindScore, rewinds: opts.rewinds },
  );
}

/** The boss bar's Tyrant line: the boss's borrowed attack while it holds one (absent: none). */
export function bossTyrant(
  state: WorldState,
  bossId: number,
  opts: { rewinds?: boolean } = {},
): { tyrant?: TyrantDecree } {
  const e = state.entities.get(bossId)?.enemy;
  if (!e?.tyrant) return {};
  return {
    tyrant: tyrantDecree(e.defId, e.tyrant, {
      blind: state.dissonance.blindScore,
      rewinds: opts.rewinds,
    }),
  };
}

// ── The Postlude ───────────────────────────────────────────────────────────────────────

/** The Postlude's decree (docs/phase-6.md, "True Dissonance"). */
export const POSTLUDE_NAME = 'Postlude';
export const POSTLUDE_TEXT =
  'The Conductor will not let the song end, and its choir sings in pairs. Answer both voices, and silence its Fortissimo with your Crescendo.';

/** How long the boss bar shows the full decree after the rise, in seconds. */
export const POSTLUDE_DECREE_S = 10;

export function postludeDecree(blind = false): { name: string; text: string } {
  return { name: POSTLUDE_NAME, text: blind ? blindDecree(POSTLUDE_TEXT) : POSTLUDE_TEXT };
}

export interface PostludeHud {
  /** Seconds left of the rise (untouchable), or null once it has risen. */
  rising: number | null;
  enraged: boolean;
  /** The decree, while it is fresh (the rise's first seconds); null after. */
  decree: { name: string; text: string } | null;
}

/** The boss bar's Postlude: its rise, its pressure and its decree (absent: no Postlude). */
export function bossPostlude(state: WorldState): { postlude?: PostludeHud } {
  const p = state.field.finale?.postlude;
  if (!p) return {};
  const left = p.riseUntil - state.time;
  return {
    postlude: {
      rising: left > 0 ? left : null,
      enraged: !!p.enraged,
      decree:
        state.time - p.since < POSTLUDE_DECREE_S
          ? postludeDecree(state.dissonance.blindScore)
          : null,
    },
  };
}

/**
 * The boss bar's phases with the Postlude: a fourth pip, and the bar in it. The Postlude is not a
 * life threshold (it is entered by the rise), so the ticks stay where they are.
 */
export function postludePhases(
  base: { phase: number; phases: number },
  postlude: boolean,
): { phase: number; phases: number } {
  if (!postlude) return base;
  return { phase: base.phases + 1, phases: base.phases + 1 };
}

/** The decree a `postludeRose` announces (the state's Blind Score). */
export function postludeRoseDecree(
  state: Pick<WorldState, 'dissonance'>,
  _event: SimEventOf<'postludeRose'>,
): { name: string; text: string } {
  return postludeDecree(state.dissonance.blindScore);
}

// ── Mimicry ────────────────────────────────────────────────────────────────────────────

/** The Mimicking affix's id and the Mimic's (the enemy whose card teaches the mirror). */
export const MIMICKING = 'mimicking';
export const MIMIC = 'mimic';

/**
 * Under Mimicry, an ordinary enemy carrying Mimicking is the player's first Mimic: the sighting
 * foes gain the Mimic (its card is the one that teaches the mirror), so a profile that never met
 * one sees its card once. Without Mimicry the foes are as they were.
 */
export function mimicrySighting(state: WorldState, foes: readonly string[]): string[] {
  if (foes.includes(MIMIC) || !levelOn(state, 'mimicry')) return [...foes];
  for (const e of state.entities.list()) {
    const en = e.enemy;
    if (!en || !e.health || e.health.dead || e.kind === 'dummy') continue;
    if (en.defId !== MIMIC && en.affixes.includes(MIMICKING)) return [...foes, MIMIC];
  }
  return [...foes];
}
