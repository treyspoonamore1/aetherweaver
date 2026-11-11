/**
 * Captions (docs/phase-7.md, W2): sounds that carry meaning, in words. The runtime asks for each
 * sim event the fight raises while Settings → Captions is on (`src/app/runtime.ts`), after the
 * event's own callouts, and pushes what comes back; a caption with a `key` first replaces the
 * last one with that key.
 *
 * What is captioned, each from the event that plays its sound:
 * - a telegraph's wind-up, by its timbre (which says the answer: brass for a Ward, glass for a
 *   Chime...) and its side, worked out as the effects engine picks them (`windupStyle`,
 *   `windupSide`; src/audio/sfx.ts `windStyle`, `shapeX`, `panFor`): every telegraph's but a
 *   Mimic's mirror (named once on its own), as every one winds up aloud; one begun in Stasis when
 *   time resumes, as its sound waits until then;
 * - Tyrant's edict, the Postlude's rise and its pair Cues, a Mimic's first mirror in a fight;
 * - the low-life tone: a hero falling under a quarter of their life, re-armed over 40%, at most
 *   one every 1.5 s across the party (src/audio/sfx.ts `lowAlert`), while it is on in Settings;
 * - the Finale's four, as before (`finaleCaption`).
 *
 * Each is a quiet bracketed line with its own lifetime. Never more than two show at once: they
 * take turns between two keys, so a third replaces the older of the two.
 */
import { useSettings } from '../../app/settings';
import { enemyDef, heroDef } from '../../content';
import type { EntityId, SimEvent, SimEventOf, TelegraphShape, WorldState } from '../../sim';
import { t } from '../text';
import { SILENCE_INK, finaleCaption, type FinaleCallout } from './finaleLook';

/** The two keys captions take turns with: at most two on screen. */
export const CAPTION_KEYS = ['caption:a', 'caption:b'] as const;
/** How long a caption stays (ms), as the Finale's always have. */
export const CAPTION_TTL = 1800;
/** Wind-up captions in one fight come at most this often (sim seconds): no stream of them. */
export const WINDUP_GAP = 0.6;
/** The low-life tone's thresholds and spacing (src/audio/sfx.ts `lowAlert`). */
export const LOW_ALERT = 0.25;
export const LOW_REARM = 0.4;
export const LOW_GAP = 1.5;

/** A wind-up's timbre, as the effects engine picks it (src/audio/sfx.ts `windStyle`). */
export type WindupStyle = 'glass' | 'brass' | 'swell' | 'taut' | 'invert';

export function windupStyle(
  kind: string,
  answers: readonly string[],
  state?: Pick<WorldState, 'dissonance'>,
): WindupStyle {
  if (kind === 'mark') return 'glass';
  if (state?.dissonance?.blindScore) return 'swell';
  if (answers.includes('mend')) return 'swell';
  if (answers[0] === 'thread') return 'taut';
  if (answers[0] === 'empower') return 'invert';
  return answers.includes('chime')
    ? 'glass'
    : answers.includes('ward') || answers.includes('dome')
      ? 'brass'
      : 'swell';
}

/** Where a telegraph's shape sits along x, if anywhere (src/audio/sfx.ts `shapeX`). */
function shapeX(shape: TelegraphShape, state: WorldState): number | undefined {
  switch (shape.kind) {
    case 'circle':
    case 'cone':
    case 'line':
    case 'donut':
      return shape.x;
    case 'mark':
      return state.entities.get(shape.target)?.x;
    case 'link':
      return state.entities.get(shape.a)?.x;
    case 'raid':
      return undefined;
  }
}

/**
 * The side a wind-up is heard from: the effects engine's pan (src/audio/sfx.ts `panFor`, its x
 * from the Weaver over 60% of the arena's radius), left or right past a quarter of the way,
 * otherwise ahead; a raid (no place) is all around.
 */
export function windupSide(
  shape: TelegraphShape,
  state: WorldState,
): 'left' | 'right' | 'centre' | 'around' {
  const x = shapeX(shape, state);
  if (x === undefined) return 'around';
  const w = state.entities.get(state.weaverId);
  const span = Math.max(6, state.arenaRadius * 0.6);
  const pan = Math.min(1, Math.max(-1, (x - (w?.x ?? 0)) / span)) * 0.85;
  return pan < -0.25 ? 'left' : pan > 0.25 ? 'right' : 'centre';
}

/** What captions remember about one fight (its world state). */
interface FightMemory {
  slot: number;
  windupAt: number;
  /** Telegraphs begun in Stasis: their wind-ups sound when time resumes (src/audio/sfx.ts). */
  frozen: Set<number>;
  mimicSeen: boolean;
  lowAt: number;
  /** Heroes whose low-life tone has played and not yet re-armed. */
  low: Set<EntityId>;
}

const memory = new WeakMap<object, FightMemory>();

function memoryOf(state: WorldState): FightMemory {
  let m = memory.get(state);
  if (!m) {
    m = {
      slot: 0,
      windupAt: -Infinity,
      frozen: new Set(),
      mimicSeen: false,
      lowAt: -Infinity,
      low: new Set(),
    };
    memory.set(state, m);
  }
  return m;
}

/** A caption line, in the next of the two turns. */
function line(state: WorldState, text: string): FinaleCallout {
  const m = memoryOf(state);
  const key = CAPTION_KEYS[m.slot]!;
  m.slot = 1 - m.slot;
  return {
    callout: { kind: 'system', text: `[${text}]`, color: SILENCE_INK, key },
    ttl: CAPTION_TTL,
  };
}

/** An enemy definition's name ("someone" for an unknown one). */
function defName(def: string | undefined): string {
  if (!def) return t('a11y.caption.someone');
  try {
    return enemyDef(def).name;
  } catch {
    return t('a11y.caption.someone');
  }
}

function enemyName(state: WorldState, id: EntityId): string {
  return defName(state.entities.get(id)?.enemy?.defId);
}

function heroName(state: WorldState, id: EntityId): string {
  const def = state.entities.get(id)?.hero?.defId;
  if (!def) return t('a11y.caption.someone');
  try {
    return heroDef(def).name;
  } catch {
    return t('a11y.caption.someone');
  }
}

function windup(e: SimEventOf<'telegraphStarted'>, state: WorldState): FinaleCallout | null {
  // A Mimic's mirror (Mimicry, docs/phase-6.md): its first in a fight is named once.
  if (e.effect === 'mimic') {
    const m = memoryOf(state);
    if (m.mimicSeen) return null;
    m.mimicSeen = true;
    return line(state, t('a11y.caption.mimic', { name: enemyName(state, e.owner) }));
  }
  // Under Stasis the wind-up waits, as its sound does (src/audio/sfx.ts): captioned as it plays.
  const m = memoryOf(state);
  if (state.field.stasis) {
    m.frozen.add(e.telegraph);
    return null;
  }
  return windupLine(e, state);
}

/** A wind-up's caption, at most one every WINDUP_GAP. */
function windupLine(
  e: { kind: string; answers: readonly string[]; shape: TelegraphShape },
  state: WorldState,
): FinaleCallout | null {
  const m = memoryOf(state);
  if (state.time - m.windupAt < WINDUP_GAP) return null;
  m.windupAt = state.time;
  const style = windupStyle(e.kind, e.answers, state);
  const side = windupSide(e.shape, state);
  return line(
    state,
    t('a11y.caption.windup', {
      sound: t(`a11y.caption.style.${style}`),
      side: t(`a11y.caption.side.${side}`),
    }),
  );
}

/**
 * Time resumes after Stasis: the effects engine winds up again each telegraph begun in it that is
 * still to land (src/audio/sfx.ts `resumeWindups`), so the first of them is captioned now.
 */
function resumed(state: WorldState): FinaleCallout | null {
  const m = memoryOf(state);
  if (m.frozen.size === 0 || state.field.stasis) return null;
  const ids = m.frozen;
  m.frozen = new Set();
  for (const tg of state.telegraphs ?? [])
    if (ids.has(tg.id) && tg.effect !== 'mimic' && tg.impact - state.time > 0.08)
      return windupLine(tg, state);
  return null;
}

/**
 * The low-life tone, from the damage that takes a hero under a quarter of their life (the tone
 * plays when it does: src/audio/sfx.ts `lowAlert`, on by default in Settings → Low-life sound).
 * Re-armed once they're back over 40%, which a heal reports.
 */
function lowLife(e: SimEvent, state: WorldState): FinaleCallout | null {
  if (e.type !== 'damageTaken' && e.type !== 'healApplied') return null;
  const id = e.target;
  const ent = state.entities.get(id);
  const h = ent?.health;
  if (!ent?.hero || !h || h.maxHp <= 0) return null;
  const m = memoryOf(state);
  const frac = h.hp / h.maxHp;
  if (frac > LOW_REARM) {
    m.low.delete(id);
    return null;
  }
  if (e.type !== 'damageTaken' || h.dead || h.downed || frac >= LOW_ALERT || m.low.has(id))
    return null;
  m.low.add(id);
  if (!useSettings.getState().settings.hud.lowHealthSound) return null;
  if (state.time - m.lowAt < LOW_GAP) return null;
  m.lowAt = state.time;
  return line(state, t('a11y.caption.lowLife', { name: heroName(state, id) }));
}

/** The caption for `event`, or null; else a wind-up resumed after Stasis (`resumed`). */
export function captionFor(event: SimEvent, state: WorldState): FinaleCallout | null {
  return ownCaption(event, state) ?? resumed(state);
}

function ownCaption(event: SimEvent, state: WorldState): FinaleCallout | null {
  const finale = finaleCaption(event);
  if (finale) return line(state, finale);
  switch (event.type) {
    case 'telegraphStarted':
      return windup(event, state);
    case 'tyrantEdict':
      return line(
        state,
        t('a11y.caption.edict', {
          boss: enemyName(state, event.boss),
          foe: defName(event.from),
        }),
      );
    case 'postludeRose':
      return line(state, t('a11y.caption.postludeRose'));
    case 'postludePair':
      return line(state, t('a11y.caption.postludePair'));
    default:
      return lowLife(event, state);
  }
}
