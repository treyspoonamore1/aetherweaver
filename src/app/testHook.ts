import { reachable, findNode } from '../meta/run';
import { useUi } from '../ui/store';
import { useRun } from './runStore';
import type { GameRuntime } from './runtime';
import type {} from './testHookTypes';

/** Automation hook for E2E tests and bots. Present in dev builds or with `?e2e` in the URL. */
export function testHookEnabled(): boolean {
  return import.meta.env.DEV || new URLSearchParams(window.location.search).has('e2e');
}

export function installTestHook(runtime: GameRuntime): () => void {
  if (!testHookEnabled()) return () => {};
  window.__AW__ = {
    tick: () => runtime.sim.tick,
    hash: () => runtime.sim.hash(),
    snapshot: () => runtime.sim.snapshot(),
    exportReplay: () => runtime.exportReplay(),
    queue: (command) => runtime.queue(command),
    setPaused: (paused) => runtime.setPaused(paused),
    setDevTimeScale: (scale) => {
      runtime.devTimeScale = scale;
    },
    perf: () => useUi.getState().perf,
    autoplay: (kind) => runtime.setAutoplay(kind),
    encounter: () => {
      const e = runtime.sim.state.encounter;
      return { id: e.id, status: e.status, wave: e.wave, waves: e.waves };
    },
  };
  return () => {
    delete window.__AW__;
  };
}

/** Installs the run hook once at startup (dev builds or `?e2e`). */
export function installRunHook(): void {
  if (!testHookEnabled()) return;
  const run = () => useRun.getState();
  window.__AWRUN__ = {
    phase: () => run().run?.phase ?? null,
    newRun: (seed) => {
      run().newRun(seed);
      useUi.getState().setScreen('run');
    },
    embark: () => run().embark(),
    choose: (nodeId) => {
      const state = run().run;
      if (!state) return null;
      const id = nodeId ?? reachable(state)[0]?.id;
      if (!id) return null;
      run().chooseNode(id);
      return findNode(state, id)?.kind ?? null;
    },
    continue: () => run().continueFromResult(),
    pick: (index) => run().pickDraft(index),
    rest: () => run().respite('rest'),
    outcome: () => run().run?.outcome ?? null,
    results: () => run().run?.results.length ?? 0,
    lastWithoutYou: () => run().run?.lastResult?.withoutYou ?? null,
  };
}
