import { Suspense, lazy, useEffect, type ReactNode } from 'react';
import { weavingLine } from '../ui/kit/loading';
import { useGamepadMenu } from '../ui/kit/menuNav';
import { installPresentation } from '../ui/presentation';
import { DeedToasts } from '../ui/screens/DeedToasts';
import { KeptSaveNotice } from '../ui/screens/SavesPanel';
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
// The Astrolabe (Phase 4): its own screen between runs, from the Loom and from Prep.
const AstrolabeScreen = lazy(() =>
  import('../ui/screens/AstrolabeScreen').then((m) => ({ default: m.AstrolabeScreen })),
);
// The Reliquary (Phase 4c): its own screen between runs, from the Loom and from Prep too.
const ReliquaryScreen = lazy(() =>
  import('../ui/screens/ReliquaryScreen').then((m) => ({ default: m.ReliquaryScreen })),
);
// Bonds (Phase 4e): the heroes' talents, Solos and scenes, from the Loom and from Prep.
const BondsScreen = lazy(() =>
  import('../ui/screens/BondsScreen').then((m) => ({ default: m.BondsScreen })),
);
// The Loom (Phase 4g): the hub between runs, through the Title's front door, and its Atelier.
const LoomScreen = lazy(() =>
  import('../ui/screens/LoomScreen').then((m) => ({ default: m.LoomScreen })),
);
const AtelierScreen = lazy(() =>
  import('../ui/screens/AtelierScreen').then((m) => ({ default: m.AtelierScreen })),
);

function Loading({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex h-full items-center justify-center font-display text-gold-300">
          {weavingLine()}
        </div>
      }
    >
      {children}
    </Suspense>
  );
}

const lab = new URLSearchParams(window.location.search).get('lab');

/**
 * The screen for the current destination: Title, the Loom and its Atelier, the run, the
 * Astrolabe, the Reliquary, Bonds, everything else.
 */
function Screen() {
  const screen = useUi((s) => s.screen);
  if (screen === 'title') return <TitleScreen />;
  if (screen === 'loom') {
    return (
      <Loading>
        <LoomScreen />
      </Loading>
    );
  }
  if (screen === 'atelier') {
    return (
      <Loading>
        <AtelierScreen />
      </Loading>
    );
  }
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
  if (screen === 'bonds') {
    return (
      <Loading>
        <BondsScreen />
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
  // One gamepad hook serves every menu screen (Phase 7, W1); it stands aside while a fight runs.
  useGamepadMenu(!lab);
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
      <KeptSaveNotice />
    </>
  );
}
