/**
 * Phase 5g, W3: the Finale motifs' sim (docs/phase-5g.md, "Finale: Resonance, Cues and the
 * Crescendo"; content in `src/content/fill/finale.ts`), and the bodies of N15 (Opening Bars and
 * W5's Tempo Rubato) and N15b (W6's Prompt Book). W0 placed every call site. Each hook runs only
 * behind an early `if` on its own `Mods` field, at its call site.
 *
 * Eight of the twelve are triggers (`triggers` on the content entry, read by
 * systems/triggers.ts): Call and Response, Taking Bows, Ringing On, Saving Grace, Lament's
 * Answer, Footlights, Fanfare and Answering Phrase. Their resolver case only claims the id. The
 * other four set a `Mods` field read by a hook below: Opening Bars (N15), Tenuto (N16), Tuning Up
 * (N17) and Vigil Song (N18).
 *
 * The rules of `src/sim/fill/silk.ts`'s header hold here too: no RNG, no new state (these hooks
 * keep none), `finaleMotifIds` returns an array literal, no edits to shared files.
 */
import { gainResonance } from '../combat/resonance';
import type { Mods } from '../mods';
import type { Entity, WorldState } from '../state';
import type { World } from '../world';

/** Vigil Song pays while the Mended hero is below this share of their life. */
const VIGIL_BELOW = 0.3;

/** The Finale motif ids this file's resolver knows. An array literal, in the doc's table order. */
export function finaleMotifIds(): readonly string[] {
  return [
    'call_and_response',
    'taking_bows',
    'opening_bars',
    'ringing_on',
    'saving_grace',
    'tenuto',
    'laments_answer',
    'footlights',
    'fanfare',
    'vigil_song',
    'answering_phrase',
    'tuning_up',
  ];
}

/**
 * The resolver's cases for the Finale motifs (see `applySilkMotif`). Fields: `firstCueGain`
 * (Opening Bars, Resonance), `fadeDelay` (Tenuto, seconds), `startSoloCharge` (Tuning Up, 0–100),
 * `vigilResonance` (Vigil Song, a second); each accumulates from 0. The trigger entries set
 * nothing here: their rules are resolved from content (`triggers`). Tempo Rubato's
 * `cueGainEvery` is set by the Harmonies' resolver and Prompt Book's `firstCrescendoCut` by the
 * relics'.
 */
export function applyFinaleMotif(m: Mods, id: string, v: number): boolean {
  switch (id) {
    case 'opening_bars':
      m.firstCueGain += v;
      return true;
    case 'tenuto':
      m.fadeDelay += v;
      return true;
    case 'tuning_up':
      m.startSoloCharge += v;
      return true;
    case 'vigil_song':
      m.vigilResonance += v;
      return true;
    case 'call_and_response':
    case 'taking_bows':
    case 'ringing_on':
    case 'saving_grace':
    case 'laments_answer':
    case 'footlights':
    case 'fanfare':
    case 'answering_phrase':
      // Trigger-only (systems/triggers.ts).
      return true;
    default:
      return false;
  }
}

/**
 * N15, Opening Bars and Tempo Rubato (docs/solos.md: a Cue costs nothing, so what once cut its
 * price now gives Resonance): called in `cueSolo` (systems/techniques.ts) once the Cue is
 * counted, behind `if (state.mods.firstCueGain > 0 || state.mods.cueGainEvery > 0)`. The Cue is
 * the fight's `ledger.cues`-th:
 * - Opening Bars: the first gives `firstCueGain`;
 * - Tempo Rubato: every `cueGainEvery`-th gives half of `segment` (the meter's segment).
 * Returns the Resonance to give (the caller gives it, so the gain's scale applies). Pure: reads
 * `state`, writes nothing.
 */
export function cueGain(state: WorldState, segment: number): number {
  const m = state.mods;
  const n = state.ledger.cues;
  let gain = 0;
  if (m.firstCueGain > 0 && n === 1) gain += m.firstCueGain;
  if (m.cueGainEvery > 0 && n > 0 && n % m.cueGainEvery === 0) gain += segment / 2;
  return gain;
}

/**
 * N15b, Prompt Book: called in `crescendoCostOf` (systems/conducting.ts) and in `crescendo`
 * (systems/techniques.ts), behind `firstCrescendoCut > 0`; `cost` is the Crescendo's price (100,
 * or Maestro's 75). The fight's first Crescendo (`ledger.crescendos` 0) costs `firstCrescendoCut`
 * less, never below 0. Pure.
 */
export function crescendoCostCut(state: WorldState, cost: number): number {
  if (state.ledger.crescendos > 0) return cost;
  return Math.max(0, cost - state.mods.firstCrescendoCut);
}

/**
 * N16, Tenuto: called in `decayResonance` (combat/resonance.ts) right after the content's idle
 * check (`decayDelay`), behind `if (world.mods.fadeDelay > 0)`: the seconds more Resonance waits
 * before it fades.
 */
export function tenutoDelay(world: World): number {
  return world.mods.fadeDelay;
}

/**
 * N17, Tuning Up: called in `createWorld` (sim/world.ts) for each hero right after it spawns
 * (beside The Last Note's `startSolos`), behind `if (mods.startSoloCharge > 0)`. Charges the
 * hero's Solo by `startSoloCharge`, never above 100; reaching 100 it says `soloReady` at tick 0,
 * as The Last Note does. A Solo The Last Note already filled is left (its `soloReady` is sent).
 */
export function tuningUp(world: World, hero: Entity): void {
  const h = hero.hero;
  if (!h || h.solo >= 100) return;
  h.solo = Math.min(100, h.solo + world.mods.startSoloCharge);
  if (h.solo >= 100) world.events.push({ type: 'soloReady', tick: 0, hero: hero.id });
}

/**
 * N18, Vigil Song: called in `updateThread` (systems/thread.ts) each tick Mend is on `hero`
 * (after its heal), behind `if (world.mods.vigilResonance > 0)`. Gives `vigilResonance` × `dt`
 * Resonance while the hero is below 30% of their life, silently (as Empower's trickle).
 */
export function vigilSong(world: World, hero: Entity, dt: number): void {
  const h = hero.health;
  if (!h || !(h.hp < h.maxHp * VIGIL_BELOW)) return;
  gainResonance(world, world.mods.vigilResonance * dt, 'vigil_song', true);
}
