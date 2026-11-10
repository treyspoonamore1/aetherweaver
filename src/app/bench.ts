/**
 * The bench's scenes (docs/phase-7.md, W4): fixed fights, each with a fixed seed, debug spawns and
 * the Skilled bot playing, so the same scene draws the same frames on any machine. The bench page
 * (`?lab=bench`, src/debug/BenchPage.tsx) plays them in the real renderer and reads the frame
 * times, draw calls, triangles, React commits and heap; `tests/perfPhase7.test.ts` plays them
 * headless twice and compares the hashes; `e2e/perf.spec.ts` compares the browser's hash at the
 * scene's last tick with a headless run's.
 *
 * Nothing here is a golden: the scenes stand on debug commands, which only `debug` configs obey.
 */
import { makeBot } from '../bots';
import { ALTO, BASS, CHOIR, CONDUCTOR } from '../content/crucibleIds';
import { CHORD_PRESETS } from '../meta/run';
import { createSim, type Command, type SimConfig, type WorldState } from '../sim';

export type BenchSceneId = 'finale' | 'hounds' | 'unweaver' | 'crowd';
export const BENCH_SCENE_IDS: readonly BenchSceneId[] = ['finale', 'hounds', 'unweaver', 'crowd'];

/**
 * A scene's commands for one tick: the bot's, the scene's debug ops, and whatever the player sent
 * (`input`, empty on the bench page). Called once per tick, before the step, as the headless
 * harness drives a scenario.
 */
export type BenchDriver = (
  tick: number,
  state: WorldState,
  input: readonly Command[],
) => readonly Command[];

export interface BenchScene {
  id: BenchSceneId;
  /** Its name on the bench page. */
  name: string;
  /** What it puts on screen, one sentence (the bench page shows it). */
  what: string;
  seed: number;
  config: SimConfig;
  /** Ticks played before the measuring starts (the spawns land, the shaders compile). */
  warmupTicks: number;
  /** Ticks measured after the warm-up. The scene halts at `warmupTicks + measureTicks`. */
  measureTicks: number;
  /** A fresh driver (each owns its bot). */
  driver: () => BenchDriver;
}

/** A fresh copy of a preset's Chords. */
function preset(id: string): SimConfig['chords'] {
  const p = CHORD_PRESETS.find((c) => c.id === id) ?? CHORD_PRESETS[0]!;
  return p.chords.map((c) => ({ auras: [...c.auras], ornaments: [...c.ornaments] }));
}

/**
 * The harness's arrival kits (tools/kits.ts: ARRIVAL_KIT, ARRIVAL3_KIT, ARRIVAL4_KIT), the party a
 * fight of that Movement is met with. `tests/perfPhase7.test.ts` holds these equal to the tools'.
 */
const ARRIVAL_MOTIFS = [
  { id: 'deep_roots', level: 2 },
  { id: 'twin_aegis', level: 1 },
  { id: 'lifeline', level: 1 },
  { id: 'warm_hum', level: 2 },
  { id: 'clear_tone', level: 1 },
  { id: 'deep_breath', level: 2 },
] as const;
const ARRIVAL_RELICS = ['silver_thimble', 'tuning_fork'] as const;
const ARRIVAL3_MOTIFS = [
  ...ARRIVAL_MOTIFS,
  { id: 'da_capo', level: 1 },
  { id: 'golden_filament', level: 1 },
  { id: 'second_verse', level: 1 },
  { id: 'standing_ovation', level: 1 },
] as const;
const ARRIVAL3_RELICS = [
  ...ARRIVAL_RELICS,
  'star_chart',
  'hollow_bell',
  'cantors_hymnal',
  'choirmasters_baton',
] as const;
const ARRIVAL4_MOTIFS = [
  ...ARRIVAL3_MOTIFS,
  { id: 'quickened_verse', level: 1 },
  { id: 'long_weave', level: 1 },
] as const;
const ARRIVAL4_RELICS = [...ARRIVAL3_RELICS, 'martyrs_veil', 'cracked_metronome'] as const;

export type BenchKit = 'arrival' | 'arrival3' | 'arrival4';
/** A kit's motifs and relics, as the tools have them (see above). */
export const BENCH_KITS: Readonly<
  Record<BenchKit, { motifs: readonly { id: string; level: number }[]; relics: readonly string[] }>
> = {
  arrival: { motifs: ARRIVAL_MOTIFS, relics: ARRIVAL_RELICS },
  arrival3: { motifs: ARRIVAL3_MOTIFS, relics: ARRIVAL3_RELICS },
  arrival4: { motifs: ARRIVAL4_MOTIFS, relics: ARRIVAL4_RELICS },
};

function kit(id: BenchKit): Pick<SimConfig, 'chords' | 'motifs' | 'relics'> {
  return {
    chords: preset('guardian'),
    motifs: BENCH_KITS[id].motifs.map((m) => ({ ...m })),
    relics: [...BENCH_KITS[id].relics],
  };
}

/** Every `every` ticks, the party is healed (and any downed hero stood up): the scene runs on. */
function keepAlive(tick: number, every: number, out: Command[]): void {
  if (tick > 0 && tick % every === 0) out.push({ t: 'debug', op: { op: 'healParty' } });
}

function living(state: WorldState, match: (defId: string) => boolean): number {
  let n = 0;
  for (const e of state.entities.list())
    if (e.enemy && !e.health?.dead && match(e.enemy.defId)) n++;
  return n;
}

const CHOIR_SET: ReadonlySet<string> = new Set(CHOIR);

/**
 * The Finale with the full choir and a Grand Silence (docs/phase-5d.md): the Silent Conductor goes
 * to phase 2 as soon as the Overture's Alto and Bass stand, so its Raise brings the Tenor and the
 * Soprano and the choir is four (tools/sim-bench.ts's conductor-peak); 25 s later it goes to
 * phase 3, the Grand Silence (its grand-silence scenario).
 */
const FINALE: BenchScene = {
  id: 'finale',
  name: 'The Finale',
  what: 'The Silent Conductor with its four-voice mirror choir, then the Grand Silence.',
  seed: 9494,
  config: { seed: 9494, encounter: CONDUCTOR, debug: true, ...kit('arrival4') },
  warmupTicks: 60 * 4,
  measureTicks: 60 * 50,
  driver: () => {
    const bot = makeBot('skilled', 9494);
    let choirAt = -1;
    let silenced = false;
    return (tick, state, input) => {
      const out = [...input, ...bot.decide(state)];
      if (choirAt < 0 && state.encounter.bossId !== null) {
        const standing = state.entities
          .list()
          .filter(
            (e) =>
              e.enemy &&
              (e.enemy.defId === ALTO || e.enemy.defId === BASS) &&
              e.enemy.state !== 'spawning' &&
              !e.health?.dead,
          ).length;
        if (standing >= 2) {
          out.push({ t: 'debug', op: { op: 'setBossHp', pct: 0.59 } });
          choirAt = tick;
        }
      }
      if (choirAt >= 0 && !silenced && tick >= choirAt + 60 * 25) {
        out.push({ t: 'debug', op: { op: 'setBossHp', pct: 0.26 } });
        silenced = true;
      }
      keepAlive(tick, 60 * 5, out);
      return out;
    };
  },
};

/**
 * Movement II's hound swarm: the Gorehound Matriarch (her Pack Call) with six Sanguine Hounds
 * loosed 5 s, 15 s and 25 s in (tools/sim-bench.ts's hound-pack, three times over).
 */
const HOUNDS: BenchScene = {
  id: 'hounds',
  name: 'Hound swarm',
  what: 'The Gorehound Matriarch and her Pack Call, with eighteen more hounds loosed on the party.',
  seed: 8585,
  config: { seed: 8585, encounter: 'gorehound_matriarch', debug: true, ...kit('arrival') },
  warmupTicks: 60 * 6,
  measureTicks: 60 * 40,
  driver: () => {
    const bot = makeBot('skilled', 8585);
    return (tick, state, input) => {
      const out = [...input, ...bot.decide(state)];
      if (tick === 300 || tick === 900 || tick === 1500)
        for (let i = 0; i < 6; i++)
          out.push({
            t: 'debug',
            op: { op: 'spawnEnemy', defId: 'sanguine_hound', x: 10 - i * 4, z: -12 },
          });
      keepAlive(tick, 60 * 4, out);
      return out;
    };
  },
};

/**
 * The Unweaver's peak (docs/phase-5c.md; tools/sim-bench.ts's unweaver-peak): straight into phase
 * 3, the Mirror Weave, with three Spindles and eight choristers loosed on top 10 s in.
 */
const UNWEAVER: BenchScene = {
  id: 'unweaver',
  name: "The Unweaver's peak",
  what: 'The Unweaver in its Mirror Weave, with Spindles and a pack of choristers on top.',
  seed: 9393,
  config: { seed: 9393, encounter: 'the_unweaver', debug: true, ...kit('arrival3') },
  warmupTicks: 60 * 11,
  measureTicks: 60 * 40,
  driver: () => {
    const bot = makeBot('skilled', 9393);
    let phased = false;
    return (tick, state, input) => {
      const out = [...input, ...bot.decide(state)];
      if (!phased && state.encounter.bossId !== null) {
        out.push({ t: 'debug', op: { op: 'setBossHp', pct: 0.32 } });
        phased = true;
      }
      if (tick === 600) {
        for (let i = 0; i < 3; i++)
          out.push({
            t: 'debug',
            op: { op: 'spawnEnemy', defId: 'spindle', x: -9 + i * 9, z: -14 },
          });
        for (let i = 0; i < 8; i++)
          out.push({
            t: 'debug',
            op: { op: 'spawnEnemy', defId: 'hollow_chorister', x: 12 - i * 3, z: -10 },
          });
      }
      keepAlive(tick, 60 * 5, out);
      return out;
    };
  },
};

/** 05 §12's case: Movement I with 150 enemies standing. */
export const CROWD_ENEMIES = 150;
/** Movement I's enemies, in the mix the crowd is drawn from (mostly choristers, as its waves are). */
const CROWD_MIX = [
  'hollow_chorister',
  'hollow_chorister',
  'hollow_chorister',
  'bell_brute',
  'hollow_chorister',
  'lamenter',
  'hollow_chorister',
  'glass_lancer',
] as const;

/**
 * Movement I with 150 enemies (docs/plan/05 §12's performance case): First Light, its waves and a
 * crowd of Movement I enemies kept topped up to 150 standing, every second, in rings around the
 * party.
 */
const CROWD: BenchScene = {
  id: 'crowd',
  name: 'Movement I, 150 enemies',
  what: 'First Light with 150 Movement I enemies kept standing (the budgets’ reference case).',
  seed: 4242,
  config: { seed: 4242, encounter: 'first_light', debug: true, ...kit('arrival') },
  warmupTicks: 60 * 4,
  measureTicks: 60 * 40,
  driver: () => {
    const bot = makeBot('skilled', 4242);
    let placed = 0;
    return (tick, state, input) => {
      const out = [...input, ...bot.decide(state)];
      if (tick % 60 === 0) {
        const missing = CROWD_ENEMIES - living(state, () => true);
        for (let i = 0; i < missing; i++, placed++) {
          // Rings of 30 at radii 8, 11, 14, 17, 19: an even crowd inside the hall's 20.
          const ring = Math.floor(placed / 30) % 5;
          const k = placed % 30;
          const r = [8, 11, 14, 17, 19][ring]!;
          const a = ((k + ring * 0.5) / 30) * Math.PI * 2;
          out.push({
            t: 'debug',
            op: {
              op: 'spawnEnemy',
              defId: CROWD_MIX[placed % CROWD_MIX.length]!,
              x: Math.round(Math.cos(a) * r * 100) / 100,
              z: Math.round(Math.sin(a) * r * 100) / 100,
            },
          });
        }
      }
      keepAlive(tick, 30, out);
      return out;
    };
  },
};

export const BENCH_SCENES: readonly BenchScene[] = [FINALE, HOUNDS, UNWEAVER, CROWD];

export function benchScene(id: string): BenchScene | undefined {
  return BENCH_SCENES.find((s) => s.id === id);
}

/** The tick a scene halts at. */
export function benchEndTick(scene: BenchScene): number {
  return scene.warmupTicks + scene.measureTicks;
}

export interface HeadlessBenchRun {
  hash: string;
  tick: number;
  maxEntities: number;
  /** The most enemies standing at once. */
  maxEnemies: number;
  /** The most choir voices standing at once (the Finale). */
  maxChoir: number;
  /** Whether the Grand Silence held at some tick (the Finale). */
  silence: boolean;
  /** The encounter's status at the end. */
  status: string;
}

/**
 * Plays a scene headless to `ticks` (its end by default), as the bench page's runtime does with
 * no player input: the driver, then the step, every tick.
 */
export function runBenchHeadless(scene: BenchScene, ticks = benchEndTick(scene)): HeadlessBenchRun {
  const sim = createSim(scene.config);
  const drive = scene.driver();
  const none: readonly Command[] = [];
  let maxEntities = 0;
  let maxEnemies = 0;
  let maxChoir = 0;
  let silence = false;
  while (sim.tick < ticks) {
    sim.step(drive(sim.tick, sim.state, none));
    sim.drainEvents();
    const st = sim.state;
    maxEntities = Math.max(maxEntities, st.entities.count);
    maxEnemies = Math.max(
      maxEnemies,
      living(st, () => true),
    );
    maxChoir = Math.max(
      maxChoir,
      living(st, (d) => CHOIR_SET.has(d)),
    );
    if (st.field.finale?.silence) silence = true;
  }
  return {
    hash: sim.hash(),
    tick: sim.tick,
    maxEntities,
    maxEnemies,
    maxChoir,
    silence,
    status: sim.state.encounter.status,
  };
}
