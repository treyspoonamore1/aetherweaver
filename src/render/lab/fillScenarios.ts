/**
 * Phase 5g: the VFX lab's scenarios for the content fill's cues (src/render/fill.ts). Each
 * restarts the real sim with the motifs and relics it names and stages the moment with real
 * commands and debug ops, except the trigger cues, which inject one `motifTriggered` of each
 * effect kind (a lab stand-in: twelve triggers can't be made to fire on the same frame). They
 * only need a sim, a clock, a command queue and an event tap (`FillStageRuntime`), so the lab
 * plays them in the browser and tests/renderFillFollow.test.ts plays them in Node.
 */
import type { Command, EntityId, PartySlot, SimConfig, SimEvent } from '../../sim';
import type { FillView } from '../fill';
import { TRIGGER_EFFECT_KINDS, TRIGGER_KINDS, type TriggerCue } from '../fillCues';
import type { StageRuntime } from './variantScenarios';

/** A StageRuntime that can also hand the view a lab stand-in event. */
export interface FillStageRuntime extends StageRuntime {
  inject(events: SimEvent[]): void;
}

export interface FillScenario {
  relics?: string[];
  motifs?: NonNullable<SimConfig['motifs']>;
  /** What FillView draws in it (the tests check each is drawn at least once). */
  shows: (keyof FillView['drawn'])[];
  /** Sim seconds the tests run it for. */
  seconds: number;
  note: string;
  stage(rt: FillStageRuntime): void;
}

const KAEL = 0;
const LYRA = 1;

const debug = (op: Extract<Command, { t: 'debug' }>['op']): Command => ({ t: 'debug', op });

/** What the scenarios read of the world (positions and lives; staging only). */
interface Mutable {
  entities: {
    list(): {
      id: EntityId;
      x: number;
      z: number;
      enemy?: unknown;
      health?: { hp: number; maxHp: number; dead?: boolean };
    }[];
    get(id: EntityId): { x: number; z: number; health?: { hp: number; maxHp: number } } | undefined;
  };
  party: EntityId[];
  weaverId: EntityId;
  time: number;
  telegraphs: { id: number; target: EntityId | null; perfectFrom: number; impact: number }[];
}

const world = (rt: StageRuntime) => rt.sim.state as unknown as Mutable;

/** Every enemy holds out (so a moment isn't cut short by the heroes). */
function toughen(rt: StageRuntime): void {
  for (const e of world(rt).entities.list())
    if (e.enemy && e.health && !e.health.dead) e.health.hp = e.health.maxHp = 1e6;
}

/** Wards the hero a telegraph is aimed at inside its Perfect window, on each telegraph `times`. */
function perfectEach(rt: StageRuntime, times: number): void {
  if (times <= 0) return;
  rt.onEvent(
    (e) => e.type === 'telegraphStarted',
    (e) => {
      if (e.type !== 'telegraphStarted') return;
      const w = world(rt);
      const t = w.telegraphs.find((k) => k.id === e.telegraph);
      if (t) {
        const aimed = t.target === null ? -1 : w.party.indexOf(t.target);
        const slot = (aimed >= 0 ? aimed : KAEL) as PartySlot;
        rt.later(Math.max(0, t.perfectFrom + 0.05 - w.time), () =>
          rt.queue({ t: 'tech', id: 'ward', slot }),
        );
      }
      perfectEach(rt, times - 1);
    },
  );
}

/** The doc's first entry that applies `kind` (the table's), for a stand-in fire. */
const sourceOf = (kind: TriggerCue): string =>
  Object.keys(TRIGGER_KINDS).find((id) => TRIGGER_KINDS[id] === kind) ?? 'unnamed_source';

/** One `motifTriggered` of each kind: on the heroes in turn, an enemy for damage and status. */
function everyKind(rt: StageRuntime): SimEvent[] {
  const w = world(rt);
  const enemy = w.entities.list().find((e) => e.enemy && !e.health?.dead)?.id;
  const tick = (rt.sim.state as unknown as { tick: number }).tick;
  return [...TRIGGER_EFFECT_KINDS, 'generic' as const].map((kind, i): SimEvent => {
    const onEnemy = kind === 'damage' || kind === 'status';
    const target = onEnemy ? enemy : w.party[i % w.party.length];
    return {
      type: 'motifTriggered',
      tick,
      source: kind === 'generic' ? 'unnamed_source' : sourceOf(kind),
      ...(target !== undefined ? { target } : {}),
    } as SimEvent;
  });
}

export const FILL_SCENARIOS: Record<string, FillScenario> = {
  'Trigger cues': {
    shows: [
      'barrier',
      'heal',
      'resonance',
      'spirit',
      'solo',
      'damage',
      'status',
      'cooldown',
      'ability',
      'empower',
      'crescendo',
      'generic',
    ],
    seconds: 3,
    note: 'Lab stand-in: one trigger of each effect kind at once (on the heroes, a chorister, the Weaver), every 2 s from 1.2 s (once the chorister has arrived)',
    stage: (rt) => {
      rt.later(0.1, () =>
        rt.queue(debug({ op: 'spawnEnemy', defId: 'hollow_chorister', x: 4, z: -6 })),
      );
      // It holds out from the moment it arrives (the heroes would fell it before the first fire).
      for (let k = 0; k < 6; k++) rt.later(0.2 + 0.15 * k, () => toughen(rt));
      for (let k = 0; k < 15; k++)
        rt.later(1.2 + 2 * k, () => {
          toughen(rt);
          rt.inject(everyKind(rt));
        });
    },
  },
  'Real triggers on a Perfect Ward': {
    motifs: [
      { id: 'tender_guard', level: 3 },
      { id: 'sister_ward', level: 3 },
      { id: 'clean_strike', level: 3 },
    ],
    shows: ['heal', 'barrier', 'spirit'],
    seconds: 4,
    note: 'Real triggers in the real field: a Perfect Ward on Kael fires Tender Guard (heal), Clean Strike (Spirit) and Sister Ward (a barrier on the hero nearest)',
    stage: (rt) => {
      rt.later(0.3, () => rt.queue(debug({ op: 'drill', slot: KAEL, windup: 1.2 })));
      // The drill heals Kael first; Tender Guard's heal counts only on a hero it can heal.
      rt.later(0.6, () => {
        const w = world(rt);
        const h = w.entities.get(w.party[KAEL]!)?.health;
        if (h) h.hp = h.maxHp * 0.6;
      });
      perfectEach(rt, 1);
    },
  },
  'Razor Silk': {
    motifs: [{ id: 'razor_silk', level: 3 }],
    shows: ['contacts', 'bites'],
    seconds: 3,
    note: 'Thread Kael; two choristers stand on the Thread: a glint where it crosses each, a bite each 0.5 s tick',
    stage: (rt) => {
      rt.later(0.1, () => rt.queue({ t: 'thread', slot: KAEL }));
      rt.later(0.3, () => {
        const w = world(rt);
        const me = w.entities.get(w.weaverId);
        const kael = w.entities.get(w.party[KAEL]!);
        if (!me || !kael) return;
        for (const u of [0.35, 0.65])
          rt.queue(
            debug({
              op: 'spawnEnemy',
              defId: 'hollow_chorister',
              x: me.x + (kael.x - me.x) * u,
              z: me.z + (kael.z - me.z) * u,
            }),
          );
      });
      for (let k = 0; k < 40; k++) rt.later(0.45 + 0.5 * k, () => toughen(rt));
    },
  },
  'Thread the Needle': {
    motifs: [{ id: 'thread_the_needle', level: 3 }],
    shows: ['needles'],
    seconds: 4,
    note: 'A training bell telegraphs a blow at Kael; the Thread moves onto him 0.2 s before it lands: the catch',
    stage: (rt) => {
      rt.later(0.1, () => rt.queue({ t: 'thread', slot: LYRA }));
      rt.later(0.3, () => rt.queue(debug({ op: 'drill', slot: KAEL, windup: 1.5 })));
      rt.onEvent(
        (e) => e.type === 'telegraphStarted',
        (e) => {
          if (e.type !== 'telegraphStarted') return;
          const w = world(rt);
          const t = w.telegraphs.find((k) => k.id === e.telegraph);
          if (t)
            rt.later(Math.max(0, t.impact - 0.2 - w.time), () =>
              rt.queue({ t: 'thread', slot: KAEL }),
            );
        },
      );
    },
  },
  'Concert Pitch: Ringing': {
    motifs: [{ id: 'concert_pitch', level: 1 }],
    shows: ['ringing'],
    seconds: 4,
    note: 'A Perfect Ward on Kael against a training bell: every standing hero rings (gold streaks rising) for 4 s',
    stage: (rt) => {
      rt.later(0.3, () => rt.queue(debug({ op: 'drill', slot: KAEL, windup: 1.2 })));
      perfectEach(rt, 1);
    },
  },
  'Spare Strings': {
    relics: ['spare_strings'],
    shows: ['spares'],
    seconds: 4,
    note: 'Thread Kael, Hold the party, and walk away until the Thread snaps at range: Spare Strings catches it (once a fight). Walked, not teleported: a teleport drags the Weaver’s own ribbons across the arena',
    stage: (rt) => {
      rt.later(0.1, () => rt.queue({ t: 'thread', slot: KAEL }));
      rt.later(0.2, () => rt.queue({ t: 'directive', kind: 'hold' }));
      rt.later(0.5, () => rt.queue({ t: 'move', x: -0.86, z: 0.5 }));
      // She stops once the relic has acted (its flag), or after 3.5 s whatever happens.
      let stopped = false;
      const stop = () => {
        if (stopped) return;
        stopped = true;
        rt.queue({ t: 'move', x: 0, z: 0 });
      };
      for (let k = 0; k < 30; k++)
        rt.later(0.6 + 0.1 * k, () => {
          const w = rt.sim.state;
          if (w.entities.get(w.weaverId)?.weaver?.spareUsed) stop();
        });
      rt.later(4, stop);
    },
  },
  'Water Clock': {
    relics: ['water_clock'],
    shows: ['clocks'],
    seconds: 9,
    note: 'Kael is caught by a Fermata hold (debug op) that runs out unhealed: he goes down and Water Clock stands him up again',
    stage: (rt) => {
      // The clock turns back three seconds: Kael must have stood that long first.
      rt.later(3.2, () => rt.queue(debug({ op: 'forceHold', slot: KAEL })));
    },
  },
};

export const FILL_SCENARIO_NAMES = Object.keys(FILL_SCENARIOS);
