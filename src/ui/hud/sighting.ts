/**
 * First sighting (docs/phase-5a.md): when an enemy the profile has never seen joins a fight, a
 * non-blocking "New foe" card names it, says its lesson in one line and shows the answer glyph,
 * and the profile records it (`profile.seen`, which also unlocks its Codex entry). Every Movement
 * I enemy is seen from the start, so the Prelude never shows one.
 */
import { useEffect } from 'react';
import { useProfile } from '../../app/profileStore';
import { CONTENT, enemyDef } from '../../content';
import type { AnswerTag } from '../types';
import { useUi, type Callout } from '../store';

/** How long a "New foe" card stays, in ms. */
export const SIGHTING_TTL = 6500;

/** A callout's key for a sighting: `sighting:<defId>`. */
export const SIGHTING_KEY = 'sighting:';

export interface Sighting {
  defId: string;
  name: string;
  /** One line: what it does and the verb that answers it. */
  lesson: string;
  answers: AnswerTag[];
}

/** The status a payload names, as a number for text (a whole percent of a share). */
const pctOf = (x: number | undefined, fallback: number) => Math.round((x ?? fallback) * 100);

/** The Crimson Legion's lessons, in the words of the hints; numbers from content. */
function legionLesson(defId: string): { lesson: string; answers: AnswerTag[] } | null {
  switch (defId) {
    case 'sanguine_hound': {
      const bleed = enemyDef(defId).basic.onHit;
      return {
        lesson: `Every bite adds a Bleed stack${bleed?.maxStacks ? ` (up to ${bleed.maxStacks})` : ''}. Chime the bleeding at 5 stacks or more; a Ward blocks the bites.`,
        answers: ['chime', 'ward'],
      };
    }
    case 'hemomancer':
      return {
        lesson:
          'Its Blood Pact links two heroes: they take more damage and burst together. Scatter — Chime can’t break it.',
        answers: ['scatter'],
      };
    case 'impaler':
      return {
        lesson:
          'It charges the farthest hero and pins them in place. Reel frees them; a Ward stops the pin.',
        answers: ['reel', 'ward'],
      };
    case 'crimson_sentinel': {
      const guard = enemyDef(defId).guard;
      return {
        lesson: `Its shield blocks ${pctOf(guard ? 1 - guard.frontMult : undefined, 0.9)}% of a blow from the front. Focus it, and the party flanks.`,
        answers: ['focus'],
      };
    }
    case 'leech':
      return {
        lesson: 'It latches on and drinks a hero’s life to heal itself. Reel or Chime frees them.',
        answers: ['reel', 'chime'],
      };
    case 'gorehound_matriarch':
      return {
        lesson:
          'Rend stacks Bleed on the tank, Pounce leaps on the frailest, Pack Call brings hounds. Chime, Reel, Focus.',
        answers: ['chime', 'reel', 'focus'],
      };
    case 'vharun_crimson_warden':
      return {
        lesson:
          'Twin Cleave strikes twice; Bloodmoon halves healing outside the pools; Execution kills a hero left low.',
        answers: ['ward', 'stack', 'mend'],
      };
    default:
      return null;
  }
}

/** A foe's card: its name, lesson and answers (any enemy: its Codex line and its attacks'). */
export function sightingOf(defId: string): Sighting {
  const def = enemyDef(defId);
  const legion = legionLesson(defId);
  if (legion) return { defId, name: def.name, ...legion };
  const answers = [
    ...new Set(
      def.specials.flatMap((id) => CONTENT.attacks.find((a) => a.id === id)?.answers ?? []),
    ),
  ];
  const first = /^[^.!?]*[.!?]/.exec(def.codex)?.[0] ?? def.codex;
  return { defId, name: def.name, lesson: first, answers };
}

/** The foes in a fight the profile hasn't seen, in the order they appeared. */
export function newSightings(
  foes: readonly string[] | undefined,
  seen: readonly string[],
): string[] {
  if (!foes) return [];
  const known = new Set(seen);
  return foes.filter((id, i) => !known.has(id) && foes.indexOf(id) === i && isEnemy(id));
}

function isEnemy(id: string): boolean {
  return CONTENT.enemies.some((e) => e.id === id);
}

/** The callout for a foe's first sighting. */
export function sightingCallout(defId: string): Omit<Callout, 'id' | 'expiresAt'> {
  const s = sightingOf(defId);
  return { kind: 'sighting', text: s.name, detail: s.lesson, key: `${SIGHTING_KEY}${defId}` };
}

/** A sighting callout's foe (null for any other callout). */
export function sightingDef(c: Pick<Callout, 'kind' | 'key'>): string | null {
  if (c.kind !== 'sighting' || !c.key?.startsWith(SIGHTING_KEY)) return null;
  const id = c.key.slice(SIGHTING_KEY.length);
  return isEnemy(id) ? id : null;
}

/** Records sightings on the profile (the profile store's `see`: each once, saved). */
export function recordSeen(ids: readonly string[]): void {
  if (ids.length === 0) return;
  useProfile.getState().see(ids);
}

/**
 * The fight's foes, against the profile: each one new shows its card, then is recorded, so it
 * never shows twice. Returns the new ones.
 */
export function noteSightings(foes: readonly string[] | undefined, now: number): string[] {
  const fresh = newSightings(foes, useProfile.getState().profile.seen);
  if (fresh.length === 0) return fresh;
  const ui = useUi.getState();
  for (const id of fresh) ui.pushCallout(sightingCallout(id), now, SIGHTING_TTL);
  recordSeen(fresh);
  return fresh;
}

/** The combat screen's first sightings: watches the HUD's foes while the fight is on. */
export function useFirstSightings(enabled = true): void {
  const foes = useUi((s) => s.hud?.foes);
  const fighting = useUi((s) => s.hud?.encounter.status === 'fighting');
  const sandbox = useUi((s) => s.hud?.encounter.kind === 'sandbox');
  useEffect(() => {
    if (!enabled || !fighting || sandbox) return;
    noteSightings(foes, performance.now());
  }, [enabled, foes, fighting, sandbox]);
}
