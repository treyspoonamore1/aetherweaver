/**
 * First sighting (docs/phase-5a.md): when an enemy the profile has never seen joins a fight, a
 * non-blocking "New foe" card names it, says its lesson in one line and shows the answer glyph,
 * and the profile records it (`profile.seen`, which also unlocks its Codex entry). Every Movement
 * I enemy is seen from the start, so the Prelude never shows one.
 */
import { useEffect, useRef } from 'react';
import { useProfile } from '../../app/profileStore';
import { CONTENT, bloodRageOf, enemyDef } from '../../content';
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
import { fortissimoName, noteSources } from './finaleLook';
import { t as txt } from '../text';

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
        lesson: txt('hud.sighting.everyBiteAddsA', {
          value: bleed?.maxStacks ? txt('hud.sighting.upTo', { maxStacks: bleed.maxStacks }) : '',
        }),
        answers: ['chime', 'ward'],
      };
    }
    case 'hemomancer':
      return {
        lesson: txt('hud.sighting.itsBloodPactLinks'),
        answers: ['scatter'],
      };
    case 'impaler':
      return rewinds
        ? {
            lesson: txt('hud.sighting.itChargesTheFarthest'),
            answers: ['ward'],
          }
        : {
            lesson: txt('hud.sighting.itChargesTheFarthest2'),
            answers: ['reel', 'ward'],
          };
    case 'crimson_sentinel': {
      const guard = enemyDef(defId).guard;
      return {
        lesson: txt('hud.sighting.itsShieldBlocksOf', {
          pctOf: pctOf(guard ? 1 - guard.frontMult : undefined, 0.9),
        }),
        answers: ['focus'],
      };
    }
    case 'leech':
      return {
        lesson: txt('hud.sighting.itLatchesOnAnd', {
          value: rewinds
            ? txt('hud.sighting.chimeFreesThem')
            : txt('hud.sighting.reelOrChimeFrees'),
        }),
        answers: rewinds ? ['chime'] : ['reel', 'chime'],
      };
    case 'gorehound_matriarch':
      return {
        lesson: txt('hud.sighting.rendStacksBleedOn', {
          value: rewinds ? txt('hud.sighting.chimeFocus') : txt('hud.sighting.chimeReelFocus'),
        }),
        answers: rewinds ? ['chime', 'focus'] : ['chime', 'reel', 'focus'],
      };
    case 'vharun_crimson_warden':
      return {
        lesson: txt('hud.sighting.twinCleaveStrikesTwice'),
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
        lesson: txt('hud.sighting.shearsCutYourThread'),
        answers: ['thread', 'focus', 'move'],
      };
    case 'void_maw':
      return rewinds
        ? {
            lesson: txt('hud.sighting.itBreathesInAnd'),
            answers: ['stack', 'move'],
          }
        : {
            lesson: txt('hud.sighting.itBreathesInAnd2'),
            answers: ['stack', 'reel', 'move'],
          };
    case 'doubt_wraith':
      return {
        lesson: txt('hud.sighting.itsLongCastPossesses', {
          value: paradox ? txt('hud.sighting.paradoxUndoesTheMark') : '',
        }),
        answers: ['focus', 'chime', 'ward'],
      };
    case 'null_priest':
      return {
        lesson: txt('hud.sighting.itClosesARune', { value: rewinds ? 'Rewind' : 'Reel' }),
        answers: ['move'],
      };
    case 'mimic':
      return {
        lesson: txt('hud.sighting.itCopiesYourEmpower'),
        answers: ['focus'],
      };
    case 'spindle':
      return {
        lesson: txt('hud.sighting.whileASpindleStands', { spindleCutPct: spindleCutPct() }),
        answers: ['focus'],
      };
    case 'stolen_verse':
      return {
        lesson: txt('hud.sighting.itFleesWithAn'),
        answers: ['focus'],
      };
    case 'mirror_champion':
      return {
        lesson: txt('hud.sighting.theUnweaverThreadsIt', { EMBOLDENED_PCT }),
        answers: ['focus', 'ward'],
      };
    case 'the_seamstress':
      return {
        lesson: txt('hud.sighting.needleRainFallsThree'),
        answers: ['move', 'chime', 'thread'],
      };
    case 'the_unweaver':
      return {
        lesson: txt('hud.sighting.snipCutsYourThread'),
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
  const undo = rewinds && paradox ? txt('hud.sighting.paradoxCancelsIt') : '';
  switch (defId) {
    case ALTO:
      return {
        lesson: txt('hud.sighting.cuedItsLamentMarks', { undo }),
        answers: ['chime', 'ward', 'focus'],
      };
    case BASS:
      return {
        lesson: txt('hud.sighting.cuedItsBassoOstinato', {
          value: rewinds ? txt('hud.sighting.rewindStepsThemBack') : '',
        }),
        answers: ['ward', 'dome', 'focus'],
      };
    case TENOR:
      return rewinds
        ? {
            lesson: txt('hud.sighting.cuedItsCadenzaCuts', { undo }),
            answers: ['move', 'focus'],
          }
        : reel === 'anchor'
          ? {
              lesson: txt('hud.sighting.cuedItsCadenzaCuts2'),
              answers: ['move', 'ward', 'focus'],
            }
          : {
              lesson: txt('hud.sighting.cuedItsCadenzaCuts3', {
                value:
                  reel === 'swap'
                    ? txt('hud.sighting.swapTakesTheBlow')
                    : txt('hud.sighting.reelThemOutStep'),
              }),
              answers: ['reel', 'move', 'focus'],
            };
    case SOPRANO:
      return {
        lesson: txt('hud.sighting.cuedItsShatterAria'),
        answers: ['scatter', 'move', 'ward', 'focus'],
      };
    case CONDUCTOR:
      return {
        lesson: txt('hud.sighting.itCuesItsMirror', {
          DISCORD_MAX,
          FORTISSIMO_NAME: fortissimoName(),
          noteSources: noteSources({ rewinds, reel }),
        }),
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

/**
 * The Finale's held-back voices, settled: a voice whose card waits for its Cue but leaves the
 * fight first (burst down before it is Cued, or shattered at the Grand Silence) or is still
 * waiting when the fight ends is recorded as seen without a card, so the Codex unlocks every voice
 * the party fought. `held`: the voices held back last time; `foes`: the fight's live foes (undefined
 * once the fight is over). Returns the voices held back now, and the ones to record silently.
 */
export function settleHeldVoices(
  held: readonly string[],
  foes: readonly string[] | undefined,
  cued: string | null | undefined,
): { held: string[]; record: string[] } {
  const live = foes ?? [];
  const now = live.filter(
    (id, i) =>
      (CHOIR as readonly string[]).includes(id) &&
      live.indexOf(id) === i &&
      enemyDef(id).name !== cued,
  );
  return { held: now, record: held.filter((id) => !live.includes(id)) };
}

/** Records held-back voices that never got their card (see `settleHeldVoices`). */
function recordHeld(ids: readonly string[]): void {
  if (ids.length === 0) return;
  recordSeen(newSightings(ids, useProfile.getState().profile.seen));
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
  // The voices whose card is waiting for a Cue: recorded without one if they go first.
  const held = useRef<string[]>([]);
  useEffect(
    () => () => {
      recordHeld(held.current);
      held.current = [];
    },
    [],
  );
  useEffect(() => {
    if (!enabled || sandbox) return;
    const settled = settleHeldVoices(held.current, fighting ? foes : undefined, cued);
    held.current = settled.held;
    recordHeld(settled.record);
    if (!fighting) return;
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
  const passive = bloodRageOf(def);
  // Phase 5e (docs/phase-5e.md): Seren's and Oro's own rules, narrowed by their passive.
  if (def.passive?.id === 'parry')
    lines.push(
      txt('hud.sighting.wardHerAsThe', { countTimes: countTimes(def.passive.counterPct) }),
      txt('hud.sighting.sheHuntsTheStrongest'),
    );
  else if (def.passive?.id === 'rootbond')
    lines.push(txt('hud.sighting.hisSaplingsTakeYour'), txt('hud.sighting.yourThreadOnHim'));
  else if (passive && passive.weaverHealMult < 1)
    lines.push(
      txt('hud.sighting.yourHealingOnHim', {
        value:
          passive.weaverHealMult === 0.5
            ? 'halved'
            : txt('hud.sighting.cutTo', { round: Math.round(passive.weaverHealMult * 100) }),
      }),
      txt('hud.sighting.wardHimAndGive'),
      txt('hud.sighting.fermataStillSavesHim'),
    );
  else lines.push(def.quirk.description);
  return { heroId: def.id, name: `${def.name}, ${def.title}`, color: def.color, lines };
}

/** A counter's multiple in words: "threefold" (300%), else "for 250%". */
function countTimes(mult: number): string {
  const fold: Record<number, string> = { 2: 'twofold', 3: 'threefold', 4: 'fourfold' };
  return fold[mult] ?? txt('hud.sighting.for', { round: Math.round(mult * 100) });
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
