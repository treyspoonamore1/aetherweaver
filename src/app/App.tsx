import { Suspense, lazy, useEffect, type ReactNode } from 'react';
import { installPresentation } from '../ui/presentation';
import { DeedToasts } from '../ui/screens/DeedToasts';
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
// The Astrolabe (Phase 4): its own screen between runs, from the Title and from Prep.
const AstrolabeScreen = lazy(() =>
  import('../ui/screens/AstrolabeScreen').then((m) => ({ default: m.AstrolabeScreen })),
);
// The Reliquary (Phase 4c): its own screen between runs, from the Title and from Prep too.
const ReliquaryScreen = lazy(() =>
  import('../ui/screens/ReliquaryScreen').then((m) => ({ default: m.ReliquaryScreen })),
);

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

/**
 * The screen for the current destination: Title, the run, the Astrolabe, the Reliquary, everything
 * else.
 */
function Screen() {
  const screen = useUi((s) => s.screen);
  if (screen === 'title') return <TitleScreen />;
  if (screen === 'astrolabe') {
    return (
      <Loading>
        <AstrolabeScreen />
      </Loading>
    );
  }
  if (screen === 'reliquary') {
    return (
      <Loading>
        <ReliquaryScreen />
      </Loading>
    );
  }
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

/**
 * Screen router: Title, the run (Prep → Map → Combat → …), Training Grounds, labs. The Deed
 * toasts (Phase 4b) sit over every screen, so a Deed earned is marked wherever the player goes.
 */
export function App() {
  // Colour-vision palette and UI scale, at startup and whenever Settings change them.
  useEffect(() => installPresentation(), []);
  if (lab) {
    return (
      <Loading>
        <LabRouter lab={lab} />
      </Loading>
    );
  }
  return (
    <>
      <Screen />
      <DeedToasts />
    </>
  );
}
