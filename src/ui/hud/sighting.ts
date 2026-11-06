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
import { EMBOLDENED_PCT, spindleCutPct } from './riftLook';
import {
  ALTO,
  BASS,
  CHOIR,
  CONDUCTOR,
  DISCORD_MAX,
  SOPRANO,
  TENOR,
} from '../../content/crucibleIds';
import { FORTISSIMO_NAME, noteSources } from './finaleLook';

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
 * The Unstitched's lessons (docs/phase-5c.md), Calling-aware like the Legion's: on a Chronomancer
 * run Reel's slot casts Rewind, so the cards say what Rewind does instead; Paradox is named only
 * when it is on the path (`paradox`). Guard Strand is never taught here: it is a motif the run may
 * not hold. Numbers from content.
 */
function riftLesson(
  defId: string,
  rewinds: boolean,
  paradox: boolean,
): { lesson: string; answers: AnswerTag[] } | null {
  switch (defId) {
    case 'shears':
      return {
        lesson:
          'Shears cut your Thread. Thread a hero on your side of the line, or step across. Focus them.',
        answers: ['thread', 'focus', 'move'],
      };
    case 'void_maw':
      return rewinds
        ? {
            lesson:
              'It breathes in and drags everyone near it into its mouth. Rally the party in the tell; Rewind takes back a hero you lost to the pull.',
            answers: ['stack', 'move'],
          }
        : {
            lesson:
              'It breathes in and drags everyone near it into its mouth. Rally the party in the tell, or Reel one out; Glide yourself clear.',
            answers: ['stack', 'reel', 'move'],
          };
    case 'doubt_wraith':
      return {
        lesson: `Its long cast possesses a hero, who strikes an ally. Focus it to interrupt; Chime the mark, or the possessed hero, to free them.${paradox ? ' Paradox undoes the mark.' : ''}`,
        answers: ['focus', 'chime', 'ward'],
      };
    case 'null_priest':
      return {
        lesson: `It closes a rune at your feet: inside, Ward, Chime and ${rewinds ? 'Rewind' : 'Reel'} are refused. Glide or walk out; Glide always works.`,
        answers: ['move'],
      };
    case 'mimic':
      return {
        lesson:
          'It copies your Empower, or your last Ward or Chime, for its strongest ally. Cast something else before it ends to crack the mirror, or Focus it.',
        answers: ['focus'],
      };
    case 'spindle':
      return {
        lesson: `While a Spindle stands, the Unweaver takes ${spindleCutPct()}% less damage. Focus them.`,
        answers: ['focus'],
      };
    case 'stolen_verse':
      return {
        lesson: 'It flees with an aura it tore from your song. Focus it to take the aura back.',
        answers: ['focus'],
      };
    case 'mirror_champion':
      return {
        lesson: `The Unweaver threads it (${EMBOLDENED_PCT}% harder) and Wards it. Interrupt the Mirror Ward, and Focus the champion.`,
        answers: ['focus', 'ward'],
      };
    case 'the_seamstress':
      return {
        lesson:
          'Needle Rain falls three times; Stitch roots two heroes; Unpick tears your Thread loose. Dodge or Ward the needles, Chime the Stitch, re-thread at once.',
        answers: ['move', 'chime', 'thread'],
      };
    case 'the_unweaver':
      return {
        lesson:
          'Snip cuts your Thread; Unravel turns your Mend; the Mirror Ward shields its champion. Retarget, Empower, Focus.',
        answers: ['thread', 'empower', 'focus'],
      };
    default:
      return null;
  }
}

/**
 * The Finale's lessons (docs/phase-5d.md): each mirror-choir voice's Solo and the verb it
 * rehearses, and the Conductor's Grand Silence. Calling- and variant-aware: on a Chronomancer run
 * Reel's slot casts Rewind (a Rewind that undoes a blow is her note; Paradox, when held, cancels
 * an aimed Solo), an Anchor Weaver makes no Reel-saves (her notes are Perfects and Clutches), and
 * a Swap Weaver takes the blow on herself. `reel`: the variant Reel's slot plays (null: Reel).
 */
function crucibleLesson(
  defId: string,
  rewinds: boolean,
  paradox: boolean,
  reel: string | null,
): { lesson: string; answers: AnswerTag[] } | null {
  const undo = rewinds && paradox ? ' Paradox cancels it.' : '';
  switch (defId) {
    case ALTO:
      return {
        lesson: `Cued, its Lament marks a hero. Chime it away (in its last second, a Clutch), Ward it, or interrupt the Alto.${undo}`,
        answers: ['chime', 'ward', 'focus'],
      };
    case BASS:
      return {
        lesson: `Cued, its Basso Ostinato rings a circle on its target. Ward on the beat (a Perfect), or interrupt the Bass.${rewinds ? ' Rewind steps them back out.' : ''}`,
        answers: ['ward', 'dome', 'focus'],
      };
    case TENOR:
      return rewinds
        ? {
            lesson: `Cued, its Cadenza cuts a line to the farthest hero: more than their life. Rewind them back out of it, step aside, or interrupt the Tenor.${undo}`,
            answers: ['move', 'focus'],
          }
        : reel === 'anchor'
          ? {
              lesson:
                'Cued, its Cadenza cuts a line to the farthest hero: more than their life. Step aside, Ward them, or interrupt the Tenor; Anchor holds them, it can’t pull them out.',
              answers: ['move', 'ward', 'focus'],
            }
          : {
              lesson: `Cued, its Cadenza cuts a line to the farthest hero: more than their life. ${reel === 'swap' ? 'Swap takes the blow on you; step aside,' : 'Reel them out, step aside,'} or interrupt the Tenor.`,
              answers: ['reel', 'move', 'focus'],
            };
    case SOPRANO:
      return {
        lesson:
          'Cued, its Shatter Aria shatters a circle around a hero. Scatter so it catches one, Ward the one it’s on, or interrupt the Soprano.',
        answers: ['scatter', 'move', 'ward', 'focus'],
      };
    case CONDUCTOR:
      return {
        lesson: `It Cues its mirror-choir; every blow you leave unanswered feeds its Discord, and at ${DISCORD_MAX} it plays ${FORTISSIMO_NAME}: your Crescendo cancels it. At the last it stops the music: only your ${noteSources({ rewinds, reel })} are heard, and eight notes wake your heroes.`,
        answers: [
          'focus',
          'crescendo',
          'ward',
          'chime',
          ...(rewinds || reel === 'anchor' ? [] : ['reel' as const]),
        ],
      };
    default:
      return null;
  }
}

/**
 * A foe's card: its name, lesson and answers (any enemy: its Codex line and its attacks').
 * `rewinds`: a Chronomancer run (Rewind in Reel's slot), whose cards never teach Reel.
 * `paradox`: Paradox is on the Chronomancer's path, so a card may name it (Movement III).
 * `reel`: the Finale's cards name what Reel's variant does (Anchor, Swap; null: Reel itself).
 */
export function sightingOf(
  defId: string,
  rewinds = false,
  paradox = false,
  reel: string | null = null,
): Sighting {
  const def = enemyDef(defId);
  const legion =
    legionLesson(defId, rewinds) ??
    riftLesson(defId, rewinds, paradox) ??
    crucibleLesson(defId, rewinds, paradox, reel);
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

/**
 * The Finale (docs/phase-5d.md): a mirror-choir voice's card waits for its first Cue, when its
 * Solo is the lesson; every other foe shows as it appears. `cued`: the voice the Conductor is
 * Cueing now (its name, the boss bar's), or null.
 */
export function sightingFoes(
  foes: readonly string[] | undefined,
  cued: string | null | undefined,
): string[] | undefined {
  if (!foes) return foes;
  if (!foes.some((id) => (CHOIR as readonly string[]).includes(id))) return [...foes];
  return foes.filter(
    (id) => !(CHOIR as readonly string[]).includes(id) || enemyDef(id).name === cued,
  );
}

/** The callout for a foe's first sighting. */
export function sightingCallout(
  defId: string,
  rewinds = false,
  paradox = false,
  reel: string | null = null,
): Omit<Callout, 'id' | 'expiresAt'> {
  const s = sightingOf(defId, rewinds, paradox, reel);
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
  paradox = false,
  reel: string | null = null,
): string[] {
  const fresh = newSightings(foes, useProfile.getState().profile.seen);
  if (fresh.length === 0) return fresh;
  const ui = useUi.getState();
  for (const id of fresh)
    ui.pushCallout(sightingCallout(id, rewinds, paradox, reel), now, SIGHTING_TTL);
  recordSeen(fresh);
  return fresh;
}

/** The combat screen's first sightings: watches the HUD's foes while the fight is on. */
export function useFirstSightings(enabled = true): void {
  const foes = useUi((s) => s.hud?.foes);
  const fighting = useUi((s) => s.hud?.encounter.status === 'fighting');
  const sandbox = useUi((s) => s.hud?.encounter.kind === 'sandbox');
  const rewinds = useUi((s) => !!s.hud?.weaver.rewind);
  // Movement III: a card names Paradox only when it is on the path.
  const paradox = useUi((s) => !!s.hud?.calling?.tiers.some((t) => t?.id === 'paradox'));
  // Phase 5b: the party's def ids, as one string so the effect runs only when it changes.
  const party = useUi((s) => s.hud?.party.map((h) => h.defId).join(' ') ?? '');
  // The Finale: Reel's variant for the Conductor's card, and the voice being Cued (its card waits).
  const reel = useUi(
    (s) => s.hud?.weaver.techniques.find((t) => t.key === 'reel')?.variant?.id ?? null,
  );
  const cued = useUi((s) => s.hud?.boss?.cue?.soloist ?? null);
  useEffect(() => {
    if (!enabled || !fighting || sandbox) return;
    noteSightings(sightingFoes(foes, cued), performance.now(), rewinds, paradox, reel);
    noteAllies(party ? party.split(' ') : [], performance.now());
  }, [enabled, foes, fighting, sandbox, rewinds, paradox, party, reel, cued]);
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
