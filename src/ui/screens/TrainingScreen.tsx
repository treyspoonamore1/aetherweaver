import { useState } from 'react';
import { GameHost, seedFromUrl } from '../../app/GameHost';
import type { CombatSession } from '../../app/runtime';
import { getRuntime } from '../../app/runtimeRegistry';
import { CONTENT } from '../../content';
import { DevPanel } from '../../debug/DevPanel';
import { PerfHud } from '../../debug/PerfHud';
import type { DebugOp } from '../../sim';
import { Hud } from '../hud/Hud';
import { PauseMenu } from '../hud/PauseMenu';
import { Button } from '../kit/Button';
import { Icon } from '../kit/Icon';
import { Panel } from '../kit/Panel';
import { useMood } from '../kit/sound';
import { useUi } from '../store';

const debug = (op: DebugOp) => getRuntime()?.queue({ t: 'debug', op });

/** Training Grounds: the sandbox encounter with the debug commands enabled. */
export function TrainingScreen() {
  useMood('calm');
  // One session for the lifetime of the screen.
  const [session] = useState<CombatSession>(() => ({
    config: {
      seed: seedFromUrl(),
      encounter: 'sandbox',
      auras: ['sostenuto', 'fortissimo'],
      debug: true,
    },
  }));
  const showPerf = useUi((s) => s.showPerf);
  const devOpen = useUi((s) => s.devOpen);
  const paused = useUi((s) => s.paused);
  const setScreen = useUi((s) => s.setScreen);
  return (
    <div className="relative h-full w-full select-none overflow-hidden">
      <GameHost session={session} />
      <Hud subtitle="Sandbox" keyHints={false} />
      {!devOpen && <SpawnPalette />}
      {showPerf && <PerfHud />}
      {devOpen && <DevPanel />}
      {paused && (
        <PauseMenu
          mode="training"
          onResume={() => getRuntime()?.setPaused(false)}
          onLeave={() => {
            getRuntime()?.setPaused(false);
            setScreen('title');
          }}
        />
      )}
    </div>
  );
}

/** Spawn any enemy next to the Weaver, and a few handy buttons. */
function SpawnPalette() {
  const [elite, setElite] = useState(false);
  const [open, setOpen] = useState(true);
  const spawn = (defId: string) => {
    const w = useUi.getState().hud?.weaver;
    // The UI picks a spot; the command carries it, so the sim stays deterministic.
    const angle = Math.random() * Math.PI * 2;
    const dist = 7 + Math.random() * 3;
    debug({
      op: 'spawnEnemy',
      defId,
      x: (w?.x ?? 0) + Math.cos(angle) * dist,
      z: (w?.z ?? 0) + Math.sin(angle) * dist,
      elite,
    });
  };
  return (
    <Panel
      className="pointer-events-auto absolute right-4 top-4 w-60 p-3"
      aria-label="Spawn palette"
    >
      <button
        type="button"
        className="flex w-full items-center justify-between text-left font-display text-sm font-bold tracking-wide text-gold-300"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        Training tools
        <span className="text-xs font-normal text-muted">{open ? 'hide' : 'show'}</span>
      </button>
      {open && (
        <>
          <p className="mt-2 text-xs font-semibold uppercase tracking-wider text-muted">Spawn</p>
          <div className="mt-1 grid grid-cols-2 gap-1.5">
            {CONTENT.enemies.map((e) => (
              <button
                key={e.id}
                type="button"
                onClick={() => spawn(e.id)}
                title={`${e.name} (${e.role})`}
                className="rounded-md border border-ink-500 bg-ink-800 px-2 py-1 text-left text-xs font-medium leading-tight text-text hover:border-gold-400 hover:text-gold-200"
              >
                {e.name.replace(/^The /, '')}
              </button>
            ))}
          </div>
          <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs text-text">
            <input type="checkbox" checked={elite} onChange={(e) => setElite(e.target.checked)} />
            Spawn as elite
          </label>
          <div className="mt-2.5 flex flex-col gap-1.5 border-t border-ink-600/60 pt-2.5">
            <Button size="sm" onClick={() => debug({ op: 'killEnemies' })}>
              <Icon name="skull" size={14} /> Kill all enemies
            </Button>
            <Button size="sm" onClick={() => debug({ op: 'healParty' })}>
              <Icon name="heart" size={14} /> Heal party
            </Button>
            <Button size="sm" onClick={() => debug({ op: 'setResonance', value: 100 })}>
              <Icon name="note" size={14} /> Resonance 100
            </Button>
            <Button size="sm" onClick={() => debug({ op: 'spawnDummies', count: 20 })}>
              + 20 dummies
            </Button>
            <Button size="sm" onClick={() => debug({ op: 'clearDummies' })}>
              Clear dummies
            </Button>
          </div>
        </>
      )}
    </Panel>
  );
}
