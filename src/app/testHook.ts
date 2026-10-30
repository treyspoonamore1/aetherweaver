import { reachable, findNode, chooseNode, reservePool } from '../meta/run';
import type { Reliquary } from '../meta/reliquary';
import { saveProfile } from '../meta/save';
import type { CombatOutcome, NodeKind, RunState } from '../meta/types';
import { encounterDef, heroDef, inscriptionDef } from '../content';
import { emptyLedger } from '../sim/world';
import { useUi } from '../ui/store';
import { useProfile } from './profileStore';
import { useRun } from './runStore';
import type { GameRuntime } from './runtime';
import { storage } from './storage';
import type { FightTally, ReliquarySeed } from './testHookTypes';

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
    markers: () => runtime.sim.state.ledger.markers.map((m) => m.kind),
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
    weaverXp: () => useProfile.getState().profile.xp,
    warp: (kind, aether) => {
      const state = run().run;
      if (!state || state.phase !== 'map') return null;
      const next = warpTo(state, kind, aether);
      if (!next) return null;
      useRun.setState({ run: next });
      return next.phase;
    },
    aether: () => run().run?.aether ?? 0,
    relics: () => run().run?.relics.map((r) => r.id) ?? [],
    buy: (index) => run().buy(index),
    leaveShop: () => run().leaveShop(),
    chooseEvent: (choiceId, motifId) =>
      run().chooseEvent(choiceId, motifId ? { motifId } : undefined),
    leaveEvent: () => run().leaveEvent(),
    pickRelic: (index) => run().pickRelic(index),
    leaveForge: () => run().leaveForge(),
    setCalling: (id) => run().setCalling(id),
    calling: () => {
      const c = run().run?.calling;
      return c ? { id: c.id, path: [...c.path] } : null;
    },
    reservePool: () => {
      const state = run().run;
      return state ? reservePool(state) : null;
    },
    pickCalling: (index) => run().pickCalling(index),
    winFight: (tally) => {
      const state = run().run;
      if (!state || state.phase !== 'combat') return false;
      const outcome = plainVictory(state, tally);
      if (!outcome) return false;
      run().finishCombat(outcome);
      return run().run?.phase !== 'combat';
    },
    astrolabe: () => {
      const p = useProfile.getState();
      const state = run().run;
      return {
        tree: [...p.profile.astrolabe],
        points: p.astrolabePoints(),
        run: state ? [...state.astrolabe] : null,
      };
    },
    deeds: () => {
      const p = useProfile.getState();
      const state = run().run;
      return {
        earned: [...p.profile.deeds],
        notices: [...p.deedNotices],
        run: state ? [...state.deeds] : null,
      };
    },
    reliquary: () => {
      const p = useProfile.getState();
      const rq = p.profile.reliquary;
      const state = run().run;
      return {
        open: p.reliquaryOpen(),
        slots: p.carrySlots(),
        shards: rq.shards,
        tears: rq.tears,
        relics: rq.relics.map((r) => ({
          uid: r.uid,
          id: r.id,
          inscriptions: r.inscriptions.map((i) => ({ ...i })),
          instability: r.instability,
          fractured: r.fractured,
          dissonance: r.dissonance?.kind ?? null,
        })),
        carry: [...rq.carry],
        run: state
          ? {
              carried: state.carried.map((r) => r.id),
              relics: state.relics.map((r) => ({
                id: r.id,
                carried: !!r.carried,
                dormant: !!r.dormant,
              })),
              paid: state.reliquary ? { ...state.reliquary } : null,
            }
          : null,
      };
    },
    seedReliquary: (seed) => {
      const p = useProfile.getState().profile;
      const reliquary = seededReliquary(p.reliquary, seed);
      const profile = { ...p, reliquary };
      saveProfile(storage(), profile);
      useProfile.setState({ profile });
    },
    winRun: (found = []) => {
      const state = run().run;
      if (!state || state.phase !== 'map') return false;
      const relics = [
        ...state.relics,
        ...found
          .filter((id) => !state.relics.some((r) => r.id === id))
          .map((id) => ({ id, cleansed: false })),
      ];
      const next = warpTo({ ...state, relics }, 'boss');
      if (!next) return false;
      useRun.setState({ run: next });
      const fight = run().run;
      const outcome = fight ? plainVictory(fight) : null;
      if (!outcome) return false;
      run().finishCombat(outcome);
      run().continueFromResult();
      return run().run?.phase === 'summary';
    },
  };
}

/** Test-only: a Reliquary holding these relics (uids r1, r2…), materials and a carry. */
function seededReliquary(rq: Reliquary, seed: ReliquarySeed): Reliquary {
  const relics = seed.relics.map((r, i) => ({
    uid: `r${i + 1}`,
    id: r.id,
    cleansed: false,
    inscriptions: (r.inscriptions ?? []).map((ins) => {
      const def = inscriptionDef(ins.id);
      const low = def.kind === 'normal' ? def.tiers[5 - ins.tier]![0] : 0;
      return { id: ins.id, tier: ins.tier, value: ins.value ?? low };
    }),
    instability: r.instability ?? 0,
    fractured: false,
    dissonance: null,
  }));
  return {
    ...rq,
    relics,
    shards: seed.shards ?? rq.shards,
    tears: seed.tears ?? rq.tears,
    carry: [...(seed.carry ?? [])],
    next: relics.length + 1,
  };
}

/**
 * Test-only: a won fight with nothing in its ledger but the `tally` (Phase 4b), the party as it
 * came in.
 */
function plainVictory(state: RunState, tally: FightTally = {}): CombatOutcome | null {
  const node = state.pending ? findNode(state, state.pending) : undefined;
  const encounterId = node?.kind === 'event' ? state.event?.encounterId : node?.encounterId;
  if (!encounterId) return null;
  return {
    encounterId,
    outcome: 'victory',
    duration: Math.max(30, encounterDef(encounterId).par * 0.8),
    ledger: { ...emptyLedger(), ...tally },
    party: state.party.map((h, slot) => {
      const maxHp = heroDef(h.heroId).maxHp;
      return {
        slot,
        heroId: h.heroId,
        hp: maxHp * h.hpPct,
        maxHp,
        downed: false,
        dead: false,
        damage: 0,
        amplified: 0,
      };
    }),
    withoutYou: null,
  };
}

/**
 * Test-only: walks the map's links to the first node of `kind` (skipping the fights on the
 * way, nothing else changes) and enters it. Null if no such node is reachable.
 */
function warpTo(state: RunState, kind: NodeKind, aether?: number): RunState | null {
  const rows = state.map.rows;
  const from = state.path.length > 0 ? findNode(state, state.path[state.path.length - 1]!) : null;
  const starts = from ? from.next : rows[0]!.map((n) => n.id);
  const queue: string[][] = starts.map((id) => [id]);
  while (queue.length > 0) {
    const route = queue.shift()!;
    const node = findNode(state, route[route.length - 1]!);
    if (!node) continue;
    if (node.kind === kind) {
      const walked: RunState = {
        ...state,
        path: [...state.path, ...route.slice(0, -1)],
        aether: aether ?? state.aether,
      };
      const next = chooseNode(walked, node.id);
      return next === walked ? null : next;
    }
    for (const id of node.next) queue.push([...route, id]);
  }
  return null;
}
