import { Suspense, lazy, useEffect, useRef, useState, type ReactNode } from 'react';
import { useRun } from '../../app/runStore';
import { ScreenFrame } from '../kit/Backdrop';
import { Button } from '../kit/Button';
import type { RunState } from '../../meta/types';
import { useUi } from '../store';
import { CallingScreen } from './CallingScreen';
import { DraftScreen } from './DraftScreen';
import { EventScreen } from './EventScreen';
import { ForgeScreen } from './ForgeScreen';
import { MapScreen } from './MapScreen';
import { MerchantScreen } from './MerchantScreen';
import { PrepScreen } from './PrepScreen';
import { ResultScreen } from './ResultScreen';
import { RelicScreen } from './RelicScreen';
import { RespiteScreen } from './RespiteScreen';
import { SummaryScreen } from './SummaryScreen';

// The 3D view (three.js) loads only when a fight starts.
const CombatScreen = lazy(() =>
  import('./CombatScreen').then((m) => ({ default: m.CombatScreen })),
);

function Weaving() {
  return (
    <div className="flex h-full items-center justify-center bg-ink-950 font-display text-gold-300">
      Weaving…
    </div>
  );
}

/** How long a new run screen ignores input: the rest of a double-click, or a key pressed twice. */
const ARRIVAL_MS = 350;

/** Changes whenever the screen under the cursor is replaced by another one. */
function stepOf(run: RunState | null): string {
  if (!run) return 'none';
  return [
    run.phase,
    run.pending ?? '',
    run.path.length,
    run.results.length,
    run.event?.choice ?? '',
    run.forge?.used ?? '',
    run.relicOffer?.options.join(',') ?? '',
    run.draft?.options.map((o) => o.motifId).join(',') ?? '',
  ].join('|');
}

/**
 * Keeps input meant for one screen from landing on the next (the Phase 3b review: a
 * double-click on a map node bought the relic that appeared under the cursor). For a moment
 * after the screen changes, a transparent veil takes the clicks and keys are swallowed; a
 * double-click's second click and a held key's repeats are always swallowed. Fights keep
 * their own input, untouched.
 */
function useArrivalGuard(step: string, active: boolean): boolean {
  const [guarding, setGuarding] = useState(false);
  const since = useRef(-Infinity);
  useEffect(() => {
    if (!active) return;
    since.current = performance.now();
    setGuarding(true);
    const t = setTimeout(() => setGuarding(false), ARRIVAL_MS);
    return () => clearTimeout(t);
  }, [step, active]);
  useEffect(() => {
    if (!active) return;
    const fresh = () => performance.now() - since.current < ARRIVAL_MS;
    const swallow = (e: Event) => {
      e.stopPropagation();
      e.preventDefault();
    };
    const onClick = (e: MouseEvent) => {
      if (e.detail > 1 || fresh()) swallow(e);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || fresh()) swallow(e);
    };
    window.addEventListener('click', onClick, true);
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('click', onClick, true);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [active]);
  return active && guarding;
}

/** The run: switches on the run's phase (Prep → Map → Combat → Result → Relic/Draft → Map, with Respite, Merchant, Forge and Event stops, → Summary). */
export function RunScreen() {
  const run = useRun((s) => s.run);
  const setScreen = useUi((s) => s.setScreen);
  const guarding = useArrivalGuard(stepOf(run), !!run && run.phase !== 'combat');
  if (!run) {
    return (
      <ScreenFrame>
        <div className="flex h-full flex-col items-center justify-center gap-4">
          <p className="font-display text-2xl text-gold-300">No expedition under way</p>
          <Button variant="primary" onClick={() => setScreen('title')}>
            Back to the title
          </Button>
        </div>
      </ScreenFrame>
    );
  }
  return (
    <>
      {screenFor(run)}
      {guarding && (
        <div className="fixed inset-0 z-[200]" aria-hidden="true" data-testid="arrival-guard" />
      )}
    </>
  );
}

function screenFor(run: RunState): ReactNode {
  switch (run.phase) {
    case 'prep':
      return <PrepScreen />;
    case 'map':
      return <MapScreen />;
    case 'combat':
      return (
        <Suspense fallback={<Weaving />}>
          <CombatScreen />
        </Suspense>
      );
    case 'result':
      return <ResultScreen />;
    case 'draft':
      return <DraftScreen />;
    case 'respite':
      return <RespiteScreen />;
    case 'summary':
      return <SummaryScreen />;
    case 'relic':
      return <RelicScreen />;
    case 'calling':
      return <CallingScreen />;
    case 'merchant':
      return <MerchantScreen />;
    case 'forge':
      return <ForgeScreen />;
    case 'event':
      return <EventScreen />;
  }
}
