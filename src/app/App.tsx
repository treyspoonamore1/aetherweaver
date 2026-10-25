import { Suspense, lazy, useEffect, type ReactNode } from 'react';
import { installPresentation } from '../ui/presentation';
import { TitleScreen } from '../ui/screens/TitleScreen';
import { useUi } from '../ui/store';

// Screens are lazy-loaded (docs/plan/05 §6): three.js only downloads when combat opens.
const SandboxScreen = lazy(() =>
  import('../ui/screens/SandboxScreen').then((m) => ({ default: m.SandboxScreen })),
);
const RunScreen = lazy(() =>
  import('../ui/screens/RunScreen').then((m) => ({ default: m.RunScreen })),
);
const LabRouter = lazy(() => import('./LabRouter').then((m) => ({ default: m.LabRouter })));

function Loading({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex h-full items-center justify-center font-display text-gold-300">
          Weaving…
        </div>
      }
    >
      {children}
    </Suspense>
  );
}

const lab = new URLSearchParams(window.location.search).get('lab');

/** Screen router: Title, the run (Prep → Map → Combat → …), Training Grounds, labs. */
export function App() {
  const screen = useUi((s) => s.screen);
  // Colour-vision palette and UI scale, at startup and whenever Settings change them.
  useEffect(() => installPresentation(), []);
  if (lab) {
    return (
      <Loading>
        <LabRouter lab={lab} />
      </Loading>
    );
  }
  if (screen === 'title') return <TitleScreen />;
  if (screen === 'run') {
    return (
      <Loading>
        <RunScreen />
      </Loading>
    );
  }
  return (
    <Loading>
      <SandboxScreen />
    </Loading>
  );
}
