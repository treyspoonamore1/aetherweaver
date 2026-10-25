import { Suspense, lazy } from 'react';
import { useRun } from '../../app/runStore';
import { ScreenFrame } from '../kit/Backdrop';
import { Button } from '../kit/Button';
import { useUi } from '../store';
import { DraftScreen } from './DraftScreen';
import { MapScreen } from './MapScreen';
import { PrepScreen } from './PrepScreen';
import { ResultScreen } from './ResultScreen';
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

/** The run: switches on the run's phase (Prep → Map → Combat → Result → Draft/Respite → Summary). */
export function RunScreen() {
  const run = useRun((s) => s.run);
  const setScreen = useUi((s) => s.setScreen);
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
  }
}
