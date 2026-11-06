/**
 * The epilogue (docs/phase-5d.md "Narrative beat and ending"; 02:311: no cutscene over 20 s): a
 * panel at the top of the Summary after a Finale victory, once per run. Five lines rise in about
 * 3 s apart (SceneView's line layout); with less motion asked for, they all show at once. Always
 * skippable (the button, Enter, Escape or Space), and it closes on its own when the last line has
 * had its moment. No new run phase: it sits inside the Summary.
 */
import { useEffect, useState } from 'react';
import { CONTENT, heroDef } from '../../content';
import type { RunState } from '../../meta/types';
import { finaleCleared } from '../../meta/runEnd';
import { heroInk } from '../kit/bondLook';
import { Button } from '../kit/Button';
import { Icon } from '../kit/Icon';
import { useReducedMotion } from '../kit/motion';
import { Panel } from '../kit/Panel';

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
  kael: 'We rest when the song is done. It isn’t.',
  lyra: 'You never asked if we were tired.',
  vexis: 'An unfinished equation is still worth solving.',
  brann: 'Rest? I’ve only just got loud.',
};

/** How long each line has before the next rises (ms). */
export const EPILOGUE_LINE_MS = 3000;
/** How long the last line holds before the panel closes on its own (ms). */
export const EPILOGUE_HOLD_MS = 2000;

/** The epilogue's lines for this party (its first hero answers the Conductor). */
export function epilogueLines(party: readonly string[]): EpilogueLine[] {
  const first = party.find((id) => HERO_LINES[id] !== undefined) ?? CONTENT.defaultParty[0]!;
  const hero = heroDef(first);
  return [
    {
      speaker: null,
      text: 'The baton falls. The Conductor’s ribbons are a Weaver’s, grey as ash.',
    },
    {
      speaker: 'The Silent Conductor',
      text: 'I wove the first of them. I only wanted the world to rest.',
      color: '#cbd5e1',
    },
    { speaker: hero.name, text: HERO_LINES[first]!, color: heroInk(first) },
    {
      speaker: 'The Weaver',
      text: 'A rest is part of the song. It isn’t the end of it.',
      color: '#f5d78e',
    },
    { speaker: null, text: 'Above the Crucible the rings turn, and the world sings on.' },
  ];
}

/** The keys that skip it (with the Skip button): Escape, Enter and Space. */
export const EPILOGUE_SKIP_KEYS: ReadonlySet<string> = new Set(['Escape', 'Enter', ' ']);

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
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      if (EPILOGUE_SKIP_KEYS.has(e.key)) {
        e.preventDefault();
        onDone();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [still, onDone]);
  return (
    <Panel
      tone="solid"
      className="anim-rise mt-6 p-6"
      role="region"
      aria-label="Epilogue"
      data-testid="epilogue"
      data-lines={lines.length}
      data-ms={epilogueMs(lines.length)}
      style={{ boxShadow: '0 0 0 1px rgb(255 246 224 / 0.25), 0 0 40px rgb(255 246 224 / 0.08)' }}
    >
      <div className="flex items-start justify-between gap-4">
        <p className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.3em] text-muted">
          <Icon name="baton" size={14} className="text-amber-50" /> Epilogue · the Celestial
          Crucible
        </p>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDone}
          data-testid="epilogue-skip"
          aria-label="Skip the epilogue"
        >
          Skip
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
