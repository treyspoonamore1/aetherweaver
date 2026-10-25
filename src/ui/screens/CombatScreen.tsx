import { useEffect, useMemo, useRef, useState } from 'react';
import { GameHost } from '../../app/GameHost';
import { useRun } from '../../app/runStore';
import type { CombatSession } from '../../app/runtime';
import { getRuntime } from '../../app/runtimeRegistry';
import { useSettings } from '../../app/settings';
import { DevPanel } from '../../debug/DevPanel';
import { PerfHud } from '../../debug/PerfHud';
import { Hud } from '../hud/Hud';
import { HowToPlay, howToSeen, markHowToSeen } from '../hud/HowToPlay';
import { PauseMenu } from '../hud/PauseMenu';
import { useUi } from '../store';

/** A combat node of the run: the 3D view, the HUD and the modal layers. */
export function CombatScreen() {
  const pending = useRun((s) => s.run?.pending ?? null);
  const encounters = useRun((s) => s.run?.encounters ?? 0);
  const nodesDone = useRun((s) => s.run?.path.length ?? 0);
  const rows = useRun((s) => s.run?.map.rows.length ?? 0);
  const fights = useRun((s) => s.run?.results.length ?? 0);

  // One session per pending node: re-renders must never restart the fight.
  const session = useMemo<CombatSession | null>(() => {
    const config = useRun.getState().combatConfig();
    if (!config) return null;
    return { config, onEnd: (outcome) => useRun.getState().finishCombat(outcome) };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the node being played
  }, [pending, encounters]);

  const paused = useUi((s) => s.paused);
  const showPerf = useUi((s) => s.showPerf);
  const devOpen = useUi((s) => s.devOpen);
  const hintsOn = useSettings((s) => s.settings.hints);

  // "How to play": the first fight of a fresh player. The sim is paused behind it.
  const [howto, setHowto] = useState(() => fights === 0 && hintsOn && !howToSeen());
  const armed = useRef(false);
  useEffect(() => {
    if (howto) getRuntime()?.setPaused(true);
    // Only on entering the fight.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    // Esc toggles the runtime's pause; treat un-pausing under the card as "Begin".
    if (!howto) return;
    if (paused) armed.current = true;
    else if (armed.current) {
      markHowToSeen();
      setHowto(false);
    }
  }, [paused, howto]);

  const closeHowTo = () => {
    markHowToSeen();
    setHowto(false);
    getRuntime()?.setPaused(false);
  };

  return (
    <div className="relative h-full w-full select-none overflow-hidden">
      {session && <GameHost session={session} />}
      <Hud subtitle={`The Prelude · node ${nodesDone} of ${rows}`} keyHints={fights < 2} />
      {showPerf && <PerfHud />}
      {devOpen && <DevPanel />}
      {howto ? (
        <HowToPlay onClose={closeHowTo} />
      ) : (
        paused && (
          <PauseMenu
            mode="run"
            onResume={() => getRuntime()?.setPaused(false)}
            onAbandon={() => {
              getRuntime()?.setPaused(false);
              useRun.getState().abandon();
            }}
          />
        )
      )}
    </div>
  );
}
