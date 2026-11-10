import type { CombatOutcome } from '../../meta/types';
import { usePhase6Decrees } from '../hud/phase6Decrees';
import { useEffect, useMemo, useRef, useState } from 'react';
import { GameHost } from '../../app/GameHost';
import { selectCallingId, useRun } from '../../app/runStore';
import { CONTENT } from '../../content';
import type { CombatSession } from '../../app/runtime';
import { getRuntime } from '../../app/runtimeRegistry';
import { useSettings } from '../../app/settings';
import { DevPanel } from '../../debug/DevPanel';
import { PerfHud } from '../../debug/PerfHud';
import { Hud } from '../hud/Hud';
import { HowToPlay, howToSeen, markHowToSeen } from '../hud/HowToPlay';
import { PauseMenu } from '../hud/PauseMenu';
import { useUi } from '../store';
import { useFirstSightings } from '../hud/sighting';
import { combatSubtitle } from './routeText';

/** A combat node of the run: the 3D view, the HUD and the modal layers. */
/**
 * A fight's end, handed to the run (docs/phase-6.md, "Recording"): the outcome and the fight's
 * replay, exported in the same tick the runtime built the outcome (`onEnd` runs inside it, before
 * the runtime is let go), so a weekly or an Echo keeps recording. Other runs ignore the replay.
 */
export function handOff(outcome: CombatOutcome): void {
  const replay = getRuntime()?.exportReplay() ?? null;
  useRun.getState().finishFight(outcome, replay);
}

export function CombatScreen() {
  const pending = useRun((s) => s.run?.pending ?? null);
  const encounters = useRun((s) => s.run?.encounters ?? 0);
  // "The Prelude · node 3 of 10", or an Expedition's Movement and its node.
  const subtitle = useRun((s) => (s.run ? combatSubtitle(s.run) : 'The Prelude · node 0 of 0'));
  const movements = useRun((s) => s.run?.movements ?? 1);
  // Phase 6: an Echo's or a weekly's run names itself where a route would.
  const echo = useRun((s) => s.run?.echo);
  const week = useRun((s) => s.run?.weekly?.week);
  const phase6Route = {
    ...(echo !== undefined ? { echo } : {}),
    ...(week !== undefined ? { weekly: { week } } : {}),
  };
  const fights = useRun((s) => s.run?.results.length ?? 0);
  const callingId = useRun(selectCallingId);
  // The Martyr's Bear has its own key: the primer says so on her runs.
  const calling = CONTENT.callings.find((c) => c.id === callingId);
  const bear = (calling?.values.bear ?? 0) > 0;
  // The Chronomancer's Rewind takes Reel's key (Phase 3e): the primer says how far back it goes.
  const rewind =
    calling && (calling.values.rewind ?? 0) > 0
      ? { seconds: calling.values.rewind!, cooldown: calling.values.cooldown ?? 0 }
      : null;

  // One session per pending node: re-renders must never restart the fight.
  const session = useMemo<CombatSession | null>(() => {
    const config = useRun.getState().combatConfig();
    if (!config) return null;
    return { config, onEnd: (outcome) => handOff(outcome) };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the node being played
  }, [pending, encounters]);

  // Silent Cues (Phase 4d): the fight's own Cue cost, when it isn't a segment.
  const cueCost = useUi((s) => s.hud?.weaver.cueCost ?? null);
  const segment = useUi((s) => s.hud?.weaver.segment ?? null);
  // Phase 5f: the Conductor's own cheaper Cue isn't Dissonance's: only Silent Cues raises it.
  const cueBase = useUi((s) => s.hud?.weaver.cueBase ?? null);
  // Primitives only: the screen mustn't re-render with every snapshot.
  const conductCue = useUi((s) => s.hud?.conducting?.cueCost ?? null);
  const chainWindow = useUi((s) => s.hud?.conducting?.chainWindow ?? 0);
  const duet = useUi((s) => s.hud?.conducting?.duet ?? 1);
  const trio = useUi((s) => s.hud?.conducting?.trio ?? 1);
  const crescendoName = useUi((s) => s.hud?.weaver.crescendoName ?? '');
  const crescendoCost = useUi((s) => s.hud?.weaver.crescendoCost ?? 0);
  const cue =
    cueCost !== null && (conductCue !== null ? cueCost !== cueBase : cueCost !== segment)
      ? { cost: cueCost }
      : null;
  const conduct =
    conductCue !== null
      ? { cueCost: conductCue, chainWindow, duet, trio, crescendoName, crescendoCost }
      : null;
  const paused = useUi((s) => s.paused);
  // Edit HUD layout (from the pause menu) shows the HUD; the fight stays paused under it.
  const editingLayout = useUi((s) => s.layoutEditing);
  const showPerf = useUi((s) => s.showPerf);
  const devOpen = useUi((s) => s.devOpen);
  const hintsOn = useSettings((s) => s.settings.hints);
  // Movement II: a foe met for the first time gets its card (docs/phase-5a.md).
  useFirstSightings();
  // Phase 6: Tyrant's edicts and the Postlude's rise as decree banners (none without them).
  usePhase6Decrees(session);

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
      <Hud subtitle={subtitle} keyHints={fights < 2} />
      {showPerf && <PerfHud />}
      {devOpen && <DevPanel />}
      {howto ? (
        <HowToPlay onClose={closeHowTo} bear={bear} rewind={rewind} cue={cue} conduct={conduct} />
      ) : (
        paused &&
        !editingLayout && (
          <PauseMenu
            mode="run"
            movements={movements}
            run={phase6Route}
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
