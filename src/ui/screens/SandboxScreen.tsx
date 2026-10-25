import { Suspense, lazy } from 'react';
import { useUi } from '../store';
import { CodexScreen } from './CodexScreen';
import { SettingsScreen } from './SettingsScreen';

// The 3D view only loads when the Training Grounds open; Codex and Settings stay light.
const TrainingScreen = lazy(() =>
  import('./TrainingScreen').then((m) => ({ default: m.TrainingScreen })),
);

/** Everything that is not Title or the run: Training Grounds, Codex, Settings. */
export function SandboxScreen() {
  const screen = useUi((s) => s.screen);
  if (screen === 'codex') return <CodexScreen />;
  if (screen === 'settings') return <SettingsScreen />;
  return (
    <Suspense
      fallback={
        <div className="flex h-full items-center justify-center font-display text-gold-300">
          Weaving…
        </div>
      }
    >
      <TrainingScreen />
    </Suspense>
  );
}
