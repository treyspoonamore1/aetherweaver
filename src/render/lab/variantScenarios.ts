/**
 * Phase 4f: the VFX lab's technique-variant scenarios (docs/phase-4f/vfx-audio.md). Each restarts
 * the real sim with the Weaver's variants (`SimConfig.techniques`) and stages the moment they act
 * with real commands and debug ops. They only need a sim, a clock and a command queue
 * (`StageRuntime`), so the lab plays them in the browser and the tests play them in Node.
 */
import { CONTENT } from '../../content';
import type { ChordConfig, Command, PartySlot, SimConfig, SimEvent, WorldState } from '../../sim';
import type { VariantMoment } from '../variantsCues';

/** What a scenario needs of the lab's runtime (LabRuntime satisfies it). */
export interface StageRuntime {
  readonly sim: { readonly state: WorldState };
  /** Runs `fn` after `delay` sim seconds. */
  later(delay: number, fn: () => void): void;
  /** Runs `fn` on the first sim event matching `pred`. */
  onEvent(pred: (e: SimEvent) => boolean, fn: (e: SimEvent) => void): void;
  queue(command: Command): void;
}

export interface VariantScenario {
  /** The variant in each slot (content ids; a slot left out keeps its default). */
  techniques: NonNullable<SimConfig['techniques']>;
  /** The encounter (default: the sandbox), Chords (default: Guardian) and Autonomy. */
  encounter?: string;
  chords?: ChordConfig[];
  autonomy?: boolean;
  /** Motifs it needs (Twin Aegis: a second Ward charge). */
  motifs?: { id: string; level: number }[];
  /** The moments it stages (the tests check each is drawn). */
  shows: VariantMoment[];
  /** Sim seconds the tests run it for. */
  seconds: number;
  note: string;
  stage(rt: StageRuntime): void;
}

/** The sandbox's party: Kael, Lyra, Vexis. */
const KAEL = 0;
const LYRA = 1;
const VEXIS = 2;

/** A variant's number (content), for the notes. */
const val = (id: string, key: string) =>
  CONTENT.techniqueVariants.find((v) => v.id === id)?.values[key] ?? 0;

function heroPos(rt: StageRuntime, slot: number): { x: number; z: number } {
  const st = rt.sim.state;
  const e = st.entities.get(st.party[slot] ?? -1);
  return { x: e?.x ?? 0, z: e?.z ?? 0 };
}

function weaverPos(rt: StageRuntime): { x: number; z: number } {
  const st = rt.sim.state;
  const e = st.entities.get(st.weaverId);
  return { x: e?.x ?? 0, z: e?.z ?? 0 };
}

function spawnAt(rt: StageRuntime, defId: string, x: number, z: number, elite = false): void {
  rt.queue({ t: 'debug', op: { op: 'spawnEnemy', defId, x, z, elite } });
}

/**
 * A Bell Brute beside the hero in `slot`, with the Weaver stepped back out of its Toll Cleave (it
 * one-shots her), so the variant is the story (as the Bonds scenarios do).
 */
function brute(rt: StageRuntime, slot: number): void {
  const p = heroPos(rt, slot);
  rt.queue({ t: 'debug', op: { op: 'teleportWeaver', x: p.x - 6, z: p.z + 4 } });
  spawnAt(rt, 'bell_brute', p.x + 2.5, p.z - 1);
}

/** The hero in `slot` (a Ward on whoever the telegraph is aimed at, else them) gets `command`. */
function inWindow(
  rt: StageRuntime,
  name: string,
  slot: number,
  command: (slot: PartySlot) => Command,
  lead = 0.05,
): void {
  rt.onEvent(
    (e) => e.type === 'telegraphStarted' && e.name === name,
    (e) => {
      if (e.type !== 'telegraphStarted') return;
      const st = rt.sim.state;
      const t = st.telegraphs.find((k) => k.id === e.telegraph);
      if (!t) return;
      const aimed = t.target === null ? -1 : st.party.indexOf(t.target);
      const s = (aimed >= 0 ? aimed : slot) as PartySlot;
      const at = t.perfectFrom + lead - st.time;
      rt.later(Math.max(0, at), () => rt.queue(command(s)));
    },
  );
}

const ward = (slot: PartySlot): Command => ({ t: 'tech', id: 'ward', slot });
const reel = (slot: PartySlot): Command => ({ t: 'tech', id: 'reel', slot });

/** The Hollow Cantor ahead, at low life (debug): its Requiem strikes every hero after a while. */
function cantorRequiem(rt: StageRuntime): void {
  rt.later(0.2, () => {
    const w = weaverPos(rt);
    spawnAt(rt, 'the_hollow_cantor', w.x, w.z - 10);
  });
  rt.later(0.3, () => rt.queue({ t: 'debug', op: { op: 'setBossHp', pct: 0.2 } }));
}

/** A Chime landing on the hero in `slot` where they stand when it is cast. */
function chimeOn(rt: StageRuntime, slot: number): void {
  const p = heroPos(rt, slot);
  rt.queue({ t: 'tech', id: 'chime', point: { x: p.x, z: p.z } });
}

/** Casts in a loop: every `every` sim seconds from `from` to `to`, `cast(i)`. */
function loop(
  rt: StageRuntime,
  from: number,
  to: number,
  every: number,
  cast: (i: number) => void,
) {
  for (let i = 0; from + i * every <= to; i++) rt.later(from + i * every, () => cast(i));
}

/** The party's slots (the sandbox and First Light have three heroes). */
const SLOTS: PartySlot[] = [KAEL, LYRA, VEXIS];

export const VARIANT_SCENARIOS: Record<string, VariantScenario> = {
  Chorale: {
    techniques: { ward: 'chorale' },
    shows: ['chorale'],
    seconds: 4,
    note: `The party together; you Ward Lyra: a burst of song to ${val('chorale', 'radius')} m, and every hero in it gets a barrier (${val('chorale', 'pct')}% of their life + ${val('chorale', 'flat')}, ${val('chorale', 'seconds')} s), a choir band round each`,
    stage: (rt) => rt.later(0.6, () => rt.queue(ward(LYRA))),
  },
  'Chorale · Perfect': {
    techniques: { ward: 'chorale' },
    shows: ['chorale'],
    seconds: 14,
    note: 'The Hollow Cantor (debug, low life: its Requiem) ahead; you Ward Lyra in the Requiem’s Perfect window: her barrier turns Perfect, the plain barriers it gave the others absorb',
    stage: (rt) => {
      cantorRequiem(rt);
      inWindow(rt, 'Requiem', LYRA, () => ward(LYRA));
    },
  },
  'Chorale · two at once': {
    techniques: { ward: 'chorale' },
    motifs: [{ id: 'twin_aegis', level: 1 }],
    // One song only, so Spirit holds two Chorales.
    chords: [{ auras: ['fortissimo'] }, { auras: [] }],
    shows: ['chorale', 'chord'],
    seconds: 14,
    note: 'Twin Aegis (two Ward charges), one song (Spirit for two Chorales) and the Cantor’s Requiem; you Ward Kael, then Lyra, apart, both in its Perfect window: both turn Perfect against the one attack, and a chord joins them',
    stage: (rt) => {
      cantorRequiem(rt);
      inWindow(rt, 'Requiem', KAEL, () => ward(KAEL));
      inWindow(rt, 'Requiem', LYRA, () => ward(LYRA), 0.12);
    },
  },
  'Aegis Link': {
    techniques: { ward: 'aegis_link' },
    shows: ['link', 'share'],
    seconds: 7,
    note: `A Bell Brute on Kael; you Thread Lyra and Ward Kael: linked ${val('aegis_link', 'seconds')} s, each blow on him ${val('aegis_link', 'pct')}% lighter and shared with her (a bead along it)`,
    stage: (rt) => {
      rt.later(0.15, () => brute(rt, KAEL));
      rt.later(0.2, () => rt.queue({ t: 'thread', slot: LYRA }));
      rt.later(1.4, () => rt.queue(ward(KAEL)));
    },
  },
  'Aegis Link · Perfect': {
    techniques: { ward: 'aegis_link' },
    shows: ['link', 'join'],
    seconds: 8,
    note: 'A Bell Brute on Kael; you Thread Lyra and Ward Kael in its Toll Cleave’s Perfect window: the blow is negated and you join the link, three ways',
    stage: (rt) => {
      rt.later(0.15, () => brute(rt, KAEL));
      rt.later(0.2, () => rt.queue({ t: 'thread', slot: LYRA }));
      inWindow(rt, 'Toll Cleave', KAEL, ward);
    },
  },
  Purge: {
    techniques: { chime: 'purge' },
    shows: ['purge'],
    seconds: 8,
    note: `A Lamenter Dirges a hero; choristers close in on them; you Chime the hero: the Dirge bursts out at every enemy within ${val('purge', 'radius')} m (${val('purge', 'pct')}% of its damage)`,
    stage: (rt) => {
      rt.later(0.2, () => {
        const w = weaverPos(rt);
        // An elite Lamenter well back, choristers keeping the party busy up front.
        spawnAt(rt, 'lamenter', w.x - 3, w.z - 15, true);
        for (let i = 0; i < 4; i++) spawnAt(rt, 'hollow_chorister', w.x - 3 + i * 2, w.z - 5);
      });
      rt.onEvent(
        (e) => e.type === 'telegraphStarted' && e.name === 'Dirge',
        (e) => {
          if (e.type !== 'telegraphStarted' || e.target === null) return;
          const target = e.target;
          const at = () => rt.sim.state.entities.get(target);
          // Choristers right beside the marked hero (inside Purge's reach), then the Chime.
          rt.later(0.6, () => {
            const h = at();
            if (!h) return;
            const r = Math.max(1, val('purge', 'radius') * 0.45);
            for (let i = 0; i < 3; i++) {
              const a = (i / 3) * Math.PI * 2 + 0.4;
              spawnAt(rt, 'hollow_chorister', h.x + Math.cos(a) * r, h.z + Math.sin(a) * r);
            }
          });
          rt.later(1.6, () => {
            const h = at();
            if (h) rt.queue({ t: 'tech', id: 'chime', point: { x: h.x, z: h.z } });
          });
        },
      );
    },
  },
  Absolve: {
    techniques: { chime: 'absolve' },
    shows: ['absolve'],
    seconds: 6,
    note: `A Bell Brute on Kael; you Chime him: it heals ${val('absolve', 'heal')}% and a veil of light guards him (${val('absolve', 'pct')}% less damage for ${val('absolve', 'seconds')} s)`,
    stage: (rt) => {
      rt.later(0.15, () => brute(rt, KAEL));
      rt.later(2.2, () => chimeOn(rt, KAEL));
    },
  },
  Swap: {
    techniques: { reel: 'swap' },
    shows: ['swap'],
    seconds: 6,
    note: 'A Bell Brute on Kael; you Thread him, and as its Toll Cleave winds up you Swap: he is out of it, you are in it (and Glide out)',
    stage: (rt) => {
      rt.later(0.15, () => brute(rt, KAEL));
      rt.later(0.2, () => rt.queue({ t: 'thread', slot: KAEL }));
      inWindow(rt, 'Toll Cleave', KAEL, reel, -0.4);
      rt.onEvent(
        (e) => e.type === 'swapped',
        () => rt.later(0.25, () => rt.queue({ t: 'glide', x: -1, z: 1 })),
      );
    },
  },
  Anchor: {
    techniques: { reel: 'anchor' },
    shows: ['anchor'],
    seconds: 6,
    note: `A Bell Brute on Kael; you Thread him and Anchor him as its Toll Cleave winds up: he takes ${val('anchor', 'pct')}% less for ${val('anchor', 'seconds')} s, and nothing moves him`,
    stage: (rt) => {
      rt.later(0.15, () => brute(rt, KAEL));
      rt.later(0.2, () => rt.queue({ t: 'thread', slot: KAEL }));
      inWindow(rt, 'Toll Cleave', KAEL, reel, -0.6);
    },
  },
  'Phase Step': {
    techniques: { glide: 'phase_step' },
    shows: ['phase_step'],
    seconds: 5,
    note: `You step away from the party; choristers come for you; you Phase Step: a blink of ${val('phase_step', 'metres')} m, they lose you for ${val('phase_step', 'seconds')} s and turn on a hero, and your decoy stands where you were`,
    stage: (rt) => {
      rt.later(0.15, () => {
        const w = weaverPos(rt);
        rt.queue({ t: 'debug', op: { op: 'teleportWeaver', x: w.x + 7, z: w.z + 3 } });
      });
      rt.later(0.3, () => {
        const w = weaverPos(rt);
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2;
          spawnAt(rt, 'hollow_chorister', w.x + Math.cos(a) * 2.6, w.z + Math.sin(a) * 2.6 - 1);
        }
      });
      rt.later(1.6, () => rt.queue({ t: 'glide', x: 1, z: 0.4 }));
    },
  },
  Skate: {
    techniques: { glide: 'skate' },
    shows: ['skate'],
    seconds: 6,
    note: `Two Skate dashes of ${val('skate', 'metres')} m one after the other, a third refused; her ${val('skate', 'charges')} charges at her feet come back one at a time`,
    stage: (rt) => {
      rt.later(0.8, () => rt.queue({ t: 'glide', x: 1, z: 0 }));
      rt.later(1.3, () => rt.queue({ t: 'glide', x: 0, z: -1 }));
      rt.later(1.7, () => rt.queue({ t: 'glide', x: -1, z: 0 }));
    },
  },
  'Every variant · I': {
    techniques: { ward: 'chorale', chime: 'purge', reel: 'swap', glide: 'phase_step' },
    encounter: 'first_light',
    autonomy: true,
    shows: ['chorale', 'swap', 'phase_step'],
    seconds: 30,
    note: 'First Light with Chorale, Purge, Swap and Phase Step, Autonomy on, Kael threaded: each cast in turn (the clutter check)',
    stage: (rt) => {
      rt.later(0.2, () => rt.queue({ t: 'thread', slot: KAEL }));
      loop(rt, 2, 28, 7.5, (i) => rt.queue(ward(SLOTS[i % 3]!)));
      loop(rt, 3.5, 28, 9.5, (i) => chimeOn(rt, (i + 1) % 3));
      loop(rt, 5, 28, 15, () => rt.queue(reel(KAEL)));
      loop(rt, 6, 28, 5.5, (i) => rt.queue({ t: 'glide', x: i % 2 ? 1 : -1, z: 0.5 }));
    },
  },
  'Every variant · II': {
    techniques: { ward: 'aegis_link', chime: 'absolve', reel: 'anchor', glide: 'skate' },
    encounter: 'first_light',
    autonomy: true,
    shows: ['link', 'absolve', 'anchor', 'skate'],
    seconds: 30,
    note: 'First Light with Aegis Link, Absolve, Anchor and Skate, Autonomy on, Lyra threaded: each cast in turn (the clutter check)',
    stage: (rt) => {
      rt.later(0.2, () => rt.queue({ t: 'thread', slot: LYRA }));
      loop(rt, 2, 28, 7.5, () => rt.queue(ward(KAEL)));
      loop(rt, 3.5, 28, 14.5, () => chimeOn(rt, KAEL));
      loop(rt, 5, 28, 15, () => rt.queue(reel(LYRA)));
      loop(rt, 6, 28, 4.5, (i) => rt.queue({ t: 'glide', x: i % 2 ? 1 : -1, z: 0.5 }));
    },
  },
};

export const VARIANT_SCENARIO_NAMES = Object.keys(VARIANT_SCENARIOS);

/** The SimConfig a scenario plays in (the lab adds its seed, debug and the rest). */
export function scenarioConfig(sc: VariantScenario): Partial<SimConfig> {
  return {
    encounter: sc.encounter ?? 'sandbox',
    techniques: { ...sc.techniques },
    ...(sc.autonomy ? { assists: { autonomy: true } } : {}),
    ...(sc.motifs ? { motifs: sc.motifs.map((m) => ({ ...m })) } : {}),
  };
}
