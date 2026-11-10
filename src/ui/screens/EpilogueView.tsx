/**
 * The epilogue (docs/phase-5d.md "Narrative beat and ending"; 02:311: no cutscene over 20 s): a
 * panel at the top of the Summary after a Finale victory, once per run. Five lines rise in about
 * 3 s apart (SceneView's line layout); with less motion asked for, they all show at once. Always
 * skippable (the button, Enter, Escape or Space), and it closes on its own when the last line has
 * had its moment. No new run phase: it sits inside the Summary. It comes first: the Summary's
 * modal cards (a Rank-up, a Bond rank) wait until it has ended or been skipped, so nothing covers
 * it or its Skip, and a skip key still held when it closes holds them a moment longer
 * (`useSkipKeysHeld`), so the key's auto-repeat never dismisses a card unseen.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { CONTENT, heroDef } from '../../content';
import type { RunState } from '../../meta/types';
import { finaleCleared } from '../../meta/runEnd';
import { heroInk } from '../kit/bondLook';
import { Button } from '../kit/Button';
import { Icon } from '../kit/Icon';
import { useReducedMotion } from '../kit/motion';
import { Panel } from '../kit/Panel';
import { t as txt } from '../text';

/** One line of the epilogue: narration (no speaker), the Conductor, a hero or the Weaver. */
export interface EpilogueLine {
  /** null: narration, in italics. */
  speaker: string | null;
  text: string;
  /** The speaker's ink (a hero's), or none. */
  color?: string;
}

/** Each hero's answer to the Conductor (the first party hero speaks). */
const HERO_LINES: Readonly<Record<string, string>> = {
  get kael() {
    return txt('screens.epilogueView.weRestWhenThe');
  },
  get lyra() {
    return txt('screens.epilogueView.youNeverAskedIf');
  },
  get vexis() {
    return txt('screens.epilogueView.anUnfinishedEquationIs');
  },
  get brann() {
    return txt('screens.epilogueView.restIVeOnly');
  },
};

/**
 * Phase 5e (docs/phase-5e.md): Seren's and Oro's answers, checked before HERO_LINES. Every party
 * of three from six holds a starter or Brann, so without this they would never speak; Seren
 * speaks when both are present (canonical order). Every other party is unchanged.
 */
const RECRUIT_LINES: Readonly<Record<string, string>> = {
  get seren() {
    return txt('screens.epilogueView.youCallItRest');
  },
  get oro() {
    return txt('screens.epilogueView.evenTheGroveSleeps');
  },
};

/** The hero who answers the Conductor: a recruit with a line first, then the first with one. */
export function epilogueSpeaker(party: readonly string[]): string {
  const recruit = CONTENT.heroes.find(
    (h) => party.includes(h.id) && RECRUIT_LINES[h.id] !== undefined,
  );
  if (recruit) return recruit.id;
  return party.find((id) => HERO_LINES[id] !== undefined) ?? CONTENT.defaultParty[0]!;
}

/** How long each line has before the next rises (ms). */
export const EPILOGUE_LINE_MS = 3000;
/** How long the last line holds before the panel closes on its own (ms). */
export const EPILOGUE_HOLD_MS = 2000;

/** The epilogue's lines for this party (its first hero answers the Conductor). */
export function epilogueLines(party: readonly string[]): EpilogueLine[] {
  const first = epilogueSpeaker(party);
  const hero = heroDef(first);
  return [
    {
      speaker: null,
      text: txt('screens.epilogueView.theBatonFallsThe'),
    },
    {
      speaker: txt('screens.epilogueView.theSilentConductor'),
      text: txt('screens.epilogueView.iWoveTheFirst'),
      color: '#cbd5e1',
    },
    { speaker: hero.name, text: RECRUIT_LINES[first] ?? HERO_LINES[first]!, color: heroInk(first) },
    {
      speaker: txt('screens.epilogueView.theWeaver'),
      text: txt('screens.epilogueView.aRestIsPart'),
      color: '#f5d78e',
    },
    { speaker: null, text: txt('screens.epilogueView.aboveTheCrucibleThe') },
  ];
}

/** The keys that skip it (with the Skip button): Escape, Enter and Space. */
export const EPILOGUE_SKIP_KEYS: ReadonlySet<string> = new Set(['Escape', 'Enter', ' ']);

/**
 * Is this key press the epilogue's to take? Not a repeat, not a press something else already
 * handled, and not one whose target sits inside a dialog (one the player opened over the Summary,
 * such as the Reliquary's release: Enter, Space and Escape there are the dialog's).
 */
export function epilogueTakesKey(
  e: Pick<
    KeyboardEvent,
    'key' | 'repeat' | 'ctrlKey' | 'metaKey' | 'altKey' | 'defaultPrevented'
  > & {
    target: EventTarget | null;
  },
): boolean {
  if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented) return false;
  if (!EPILOGUE_SKIP_KEYS.has(e.key)) return false;
  const t = e.target as { closest?: (sel: string) => unknown } | null;
  if (t && typeof t.closest === 'function' && t.closest('[role="dialog"], [aria-modal="true"]'))
    return false;
  return true;
}

/** The epilogue's whole length (ms): every line's moment, then the hold. Under 20 s. */
export function epilogueMs(lines: number): number {
  return lines * EPILOGUE_LINE_MS + EPILOGUE_HOLD_MS;
}

const SEEN_KEY = 'aetherweaver.epilogue.v1';

/** Was this run's epilogue shown already (once per victory: the run's seed)? */
function epilogueSeen(seed: number): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(SEEN_KEY) === String(seed);
  } catch {
    return false;
  }
}

/** The run's epilogue was shown (or skipped). */
export function markEpilogueSeen(seed: number): void {
  try {
    localStorage.setItem(SEEN_KEY, String(seed));
  } catch {
    // Private mode: it may show again.
  }
}

/** Is the epilogue due on this Summary: a won run that cleared the Finale, not shown yet? */
export function epilogueDue(run: Pick<RunState, 'outcome' | 'results' | 'seed'>): boolean {
  return run.outcome === 'victory' && finaleCleared(run) && !epilogueSeen(run.seed);
}

export interface EpilogueViewProps {
  /** The party's hero ids (the first answers the Conductor). */
  party: readonly string[];
  /** Skipped, or the last line has had its moment. */
  onDone(): void;
  /** UI lab and tests: every line shown, and no timers. */
  still?: boolean;
}

/**
 * The skip keys held down while `listen` (the epilogue is up): `held()` asks whether one still is
 * (asked as the epilogue closes), and `onReleased` runs when the last one comes up (or the window
 * loses focus). A capture listener on the window, so a press is counted before the epilogue's own
 * handler closes it. The Summary holds its cards on it: a held Enter's auto-repeat would
 * otherwise press the card's autofocused Onward.
 */
export function useSkipKeysHeld(listen: boolean, onReleased: () => void): () => boolean {
  const down = useRef(new Set<string>());
  useEffect(() => {
    if (!listen) return;
    const keys = down.current;
    const onDown = (e: KeyboardEvent) => {
      if (EPILOGUE_SKIP_KEYS.has(e.key)) keys.add(e.key);
    };
    const release = () => {
      if (keys.size === 0) return;
      keys.clear();
      onReleased();
    };
    const onUp = (e: KeyboardEvent) => {
      if (!keys.delete(e.key)) return;
      if (keys.size === 0) onReleased();
    };
    window.addEventListener('keydown', onDown, true);
    window.addEventListener('keyup', onUp, true);
    window.addEventListener('blur', release);
    return () => {
      window.removeEventListener('keydown', onDown, true);
      window.removeEventListener('keyup', onUp, true);
      window.removeEventListener('blur', release);
    };
  }, [listen, onReleased]);
  return useCallback(() => down.current.size > 0, []);
}

/** The epilogue panel. */
export function EpilogueView({ party, onDone, still = false }: EpilogueViewProps) {
  const reduced = useReducedMotion();
  const lines = epilogueLines(party);
  const all = still || reduced;
  const [shown, setShown] = useState(all ? lines.length : 1);
  useEffect(() => {
    if (still) return;
    // Less motion: every line at once, and the same moment to read them before it closes.
    if (reduced) {
      const t = window.setTimeout(onDone, epilogueMs(lines.length));
      return () => window.clearTimeout(t);
    }
    const t =
      shown < lines.length
        ? window.setTimeout(() => setShown((n) => n + 1), EPILOGUE_LINE_MS)
        : window.setTimeout(onDone, EPILOGUE_LINE_MS + EPILOGUE_HOLD_MS);
    return () => window.clearTimeout(t);
  }, [shown, still, reduced, lines.length, onDone]);
  useEffect(() => {
    if (still) return;
    const onKey = (e: KeyboardEvent) => {
      if (!epilogueTakesKey(e)) return;
      e.preventDefault();
      onDone();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [still, onDone]);
  return (
    <Panel
      tone="solid"
      className="anim-rise mt-6 p-6"
      role="region"
      aria-label={txt('screens.epilogueView.epilogue')}
      data-testid="epilogue"
      data-lines={lines.length}
      data-ms={epilogueMs(lines.length)}
      style={{ boxShadow: '0 0 0 1px rgb(255 246 224 / 0.25), 0 0 40px rgb(255 246 224 / 0.08)' }}
    >
      <div className="flex items-start justify-between gap-4">
        <p className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.3em] text-muted">
          <Icon name="baton" size={14} className="text-amber-50" />{' '}
          {txt('screens.epilogueView.epilogueTheCelestialCrucible')}
        </p>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDone}
          data-testid="epilogue-skip"
          aria-label={txt('screens.epilogueView.skipTheEpilogue')}
        >
          {txt('screens.epilogueView.skip')}
        </Button>
      </div>
      <ol className="mt-3 flex flex-col gap-2.5" aria-live="polite">
        {lines.slice(0, shown).map((l, i) => (
          <li
            key={i}
            className={`text-base leading-relaxed ${all ? '' : 'anim-fade'}`}
            data-testid="epilogue-line"
          >
            {l.speaker ? (
              <>
                <span className="mr-2 font-display font-bold" style={{ color: l.color }}>
                  {l.speaker}
                </span>
                <span className="text-text">“{l.text}”</span>
              </>
            ) : (
              <span className="italic text-muted">{l.text}</span>
            )}
          </li>
        ))}
      </ol>
    </Panel>
  );
}
