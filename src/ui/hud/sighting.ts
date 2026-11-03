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

/**
 * The Crimson Legion's lessons, in the words of the hints; numbers from content. `rewinds`: a
 * Chronomancer run, whose Reel slot casts Rewind and frees no one, so Reel is never taught.
 */
function legionLesson(
  defId: string,
  rewinds: boolean,
): { lesson: string; answers: AnswerTag[] } | null {
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
      return rewinds
        ? {
            lesson: 'It charges the farthest hero and pins them in place. A Ward stops the pin.',
            answers: ['ward'],
          }
        : {
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
        lesson: `It latches on and drinks a hero’s life to heal itself. ${rewinds ? 'Chime frees them.' : 'Reel or Chime frees them.'}`,
        answers: rewinds ? ['chime'] : ['reel', 'chime'],
      };
    case 'gorehound_matriarch':
      return {
        lesson: `Rend stacks Bleed on the tank, Pounce leaps on the frailest, Pack Call brings hounds. ${rewinds ? 'Chime, Focus.' : 'Chime, Reel, Focus.'}`,
        answers: rewinds ? ['chime', 'focus'] : ['chime', 'reel', 'focus'],
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

/**
 * A foe's card: its name, lesson and answers (any enemy: its Codex line and its attacks').
 * `rewinds`: a Chronomancer run (Rewind in Reel's slot), whose cards never teach Reel.
 */
export function sightingOf(defId: string, rewinds = false): Sighting {
  const def = enemyDef(defId);
  const legion = legionLesson(defId, rewinds);
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
export function sightingCallout(defId: string, rewinds = false): Omit<Callout, 'id' | 'expiresAt'> {
  const s = sightingOf(defId, rewinds);
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
export function noteSightings(
  foes: readonly string[] | undefined,
  now: number,
  rewinds = false,
): string[] {
  const fresh = newSightings(foes, useProfile.getState().profile.seen);
  if (fresh.length === 0) return fresh;
  const ui = useUi.getState();
  for (const id of fresh) ui.pushCallout(sightingCallout(id, rewinds), now, SIGHTING_TTL);
  recordSeen(fresh);
  return fresh;
}

/** The combat screen's first sightings: watches the HUD's foes while the fight is on. */
export function useFirstSightings(enabled = true): void {
  const foes = useUi((s) => s.hud?.foes);
  const fighting = useUi((s) => s.hud?.encounter.status === 'fighting');
  const sandbox = useUi((s) => s.hud?.encounter.kind === 'sandbox');
  const rewinds = useUi((s) => !!s.hud?.weaver.rewind);
  // Phase 5b: the party's def ids, as one string so the effect runs only when it changes.
  const party = useUi((s) => s.hud?.party.map((h) => h.defId).join(' ') ?? '');
  useEffect(() => {
    if (!enabled || !fighting || sandbox) return;
    noteSightings(foes, performance.now(), rewinds);
    noteAllies(party ? party.split(' ') : [], performance.now());
  }, [enabled, foes, fighting, sandbox, rewinds, party]);
}

// ── A new ally (docs/phase-5b.md) ────────────────────────────────────────────────────

/** A callout's key for a recruit's first fight: `ally:<heroId>` (kind 'sighting'). */
export const ALLY_KEY = 'ally:';

/** How long a "New ally" card stays, in ms. */
export const ALLY_TTL = 9000;

export interface Ally {
  heroId: string;
  name: string;
  color: string;
  /** What changes in how you play them, a line each. */
  lines: string[];
}

/** A recruit's card: who joined, and the rules that ask a different hand of you. */
export function allyOf(heroId: string): Ally | null {
  const def = CONTENT.heroes.find((h) => h.id === heroId);
  if (!def || CONTENT.defaultParty.includes(def.id)) return null;
  const lines: string[] = [];
  const passive = def.passive;
  if (passive && passive.weaverHealMult < 1)
    lines.push(
      `Your healing on him is ${passive.weaverHealMult === 0.5 ? 'halved' : `cut to ${Math.round(passive.weaverHealMult * 100)}%`}: his axe heals him, and he hits harder the lower he falls.`,
      'Ward him and give him barriers: they aren’t cut. Keep him low, but alive.',
      'Fermata still saves him: one touch of the Thread during the hold.',
    );
  else lines.push(def.quirk.description);
  return { heroId: def.id, name: `${def.name}, ${def.title}`, color: def.color, lines };
}

/** An ally callout's hero (null for any other callout). */
export function allyDef(c: Pick<Callout, 'kind' | 'key'>): string | null {
  if (c.kind !== 'sighting' || !c.key?.startsWith(ALLY_KEY)) return null;
  const id = c.key.slice(ALLY_KEY.length);
  return allyOf(id) ? id : null;
}

/** The party's recruits whose first fight this is (no `ally:<id>` introduced yet). */
export function newAllies(party: readonly string[], introduced: readonly string[]): string[] {
  return party.filter(
    (id, i) =>
      party.indexOf(id) === i && allyOf(id) !== null && !introduced.includes(`${ALLY_KEY}${id}`),
  );
}

/** The callout for a recruit's first fight. */
export function allyCallout(heroId: string): Omit<Callout, 'id' | 'expiresAt'> {
  const a = allyOf(heroId);
  return { kind: 'sighting', text: a?.name ?? heroId, key: `${ALLY_KEY}${heroId}` };
}

/**
 * The fight's party, against the profile: each recruit fighting for the first time shows its
 * "New ally" card once, then it is recorded (`introduced`). The default party never shows one.
 */
export function noteAllies(party: readonly string[], now: number): string[] {
  const p = useProfile.getState();
  const fresh = newAllies(party, p.profile.introduced);
  if (fresh.length === 0) return fresh;
  const ui = useUi.getState();
  for (const id of fresh) ui.pushCallout(allyCallout(id), now, ALLY_TTL);
  p.markIntroduced(fresh.map((id) => `${ALLY_KEY}${id}`));
  return fresh;
}
