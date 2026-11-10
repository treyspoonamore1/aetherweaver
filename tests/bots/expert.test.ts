/**
 * The Expert bot (docs/phase-6.md, "Design: the expert bot", decision 14(a)): it reproduces, it
 * decides every 2 ticks and draws nothing at full attention, with every one of its own rules off
 * it sends exactly what the Skilled bot sends at that decision rate, and each of its rules acts in
 * a fight staged for it (and the fight's commands change when it is left off). The Skilled and
 * Novice bots' own commands are pinned by commandSnapshot*.test.ts, fillInert.test.ts and
 * roster20.test.ts, which this stream never re-records.
 */
import { describe, expect, it } from 'vitest';
import { makeBot, type Bot } from '../../src/bots';
import { EXPERT_RULES, ExpertBot, ExpertPlay, type ExpertRule } from '../../src/bots/expert';
import { SkilledBot } from '../../src/bots/skilled';
import { CONTENT, attackDef } from '../../src/content';
import { CONDUCTOR } from '../../src/content/crucibleIds';
import {
  createSim,
  TYRANT_TABLE,
  tyrantAttackOf,
  type Command,
  type SimConfig,
  type WorldState,
} from '../../src/sim';
import { StateHasher, hashValue } from '../../src/sim/core/hash';
import { ARRIVAL4_KIT, ARRIVAL_KIT, kitConfig } from '../../tools/kits';

const MAX_TICKS = 9 * 60 * 60;
const level = (id: string) => [{ id, rank: 1 }];

/** A fight's staging: a debug `setBossHp` once the boss stands, and a hook on the live state. */
interface Stage {
  bossPct?: number;
  /** Called each tick before the bot decides, with the sim's (mutable, test-only) state. */
  each?: (state: WorldState) => void;
  /** Called before each fight a test plays with this stage (re-arms a one-time `each`). */
  reset?: () => void;
  ticks?: number;
}

interface Played {
  status: string;
  /** A digest of every tick's commands, with the tick. */
  commands: string;
  /** Ticks with any command that weren't a decision tick (every 2). */
  offTicks: number;
  fires: Record<ExpertRule, number> | null;
}

function play(config: SimConfig, bot: Bot, stage: Stage = {}): Played {
  stage.reset?.();
  const debug = stage.bossPct !== undefined;
  const sim = createSim({ ...config, ...(debug ? { debug: true } : {}) });
  const h = new StateHasher();
  let set = false;
  let offTicks = 0;
  const ticks = stage.ticks ?? MAX_TICKS;
  for (let t = 0; t < ticks; t++) {
    stage.each?.(sim.state);
    const commands: Command[] = bot.decide(sim.state);
    if (commands.length > 0) {
      if (sim.state.tick % 2 !== 0) offTicks++;
      h.u32(t);
      hashValue(h, commands);
    }
    if (debug && !set && sim.state.encounter.bossId !== null) {
      commands.push({ t: 'debug', op: { op: 'setBossHp', pct: stage.bossPct! } });
      set = true;
    }
    sim.step(commands);
    sim.drainEvents();
    const s = sim.state.encounter.status;
    if (s === 'victory' || s === 'defeat') break;
  }
  return {
    status: sim.state.encounter.status,
    commands: h.digest(),
    offTicks,
    fires: bot instanceof ExpertBot ? { ...bot.play.fires } : null,
  };
}

const expert = (seed: number, skip: ExpertRule[] = []) =>
  new ExpertBot(seed, skip.length > 0 ? { skip: new Set(skip) } : {});
/** The Skilled bot at the Expert's decision rate and call reaction (docs/phase-6.md, item 1). */
const skilledAtTwo = (seed: number) =>
  new SkilledBot(seed, { every: 2, attention: 1, callReaction: 0.25 });

const VHARUN_TYRANT: SimConfig = {
  seed: 1000,
  encounter: 'vharun',
  ...kitConfig(ARRIVAL_KIT),
  dissonance: level('tyrant'),
};
const POSTLUDE: SimConfig = {
  seed: 1000,
  encounter: CONDUCTOR,
  ...kitConfig(ARRIVAL4_KIT),
  dissonance: level('true_dissonance'),
};

describe('the Expert bot (docs/phase-6.md)', () => {
  it("is makeBot('expert'), named expert", () => {
    const bot = makeBot('expert', 7);
    expect(bot).toBeInstanceOf(ExpertBot);
    expect(bot.name).toBe('expert');
  });

  it('reproduces: the same seed twice sends the same commands', () => {
    const a = play(VHARUN_TYRANT, expert(1000), { ticks: 60 * 60 });
    const b = play(VHARUN_TYRANT, expert(1000), { ticks: 60 * 60 });
    expect(b.commands).toBe(a.commands);
    expect(b.fires).toEqual(a.fires);
  });

  it('decides every 2 ticks, and draws nothing: its seed changes none of its commands', () => {
    const a = play(VHARUN_TYRANT, expert(1000), { ticks: 60 * 60 });
    const b = play(VHARUN_TYRANT, expert(424242), { ticks: 60 * 60 });
    expect(a.offTicks).toBe(0);
    expect(b.commands).toBe(a.commands);
  });

  // With every Expert rule off: the Skilled bot every 2 ticks, answering a call after 0.25 s.
  const equal: [string, SimConfig, Stage][] = [
    ['first_light, no level', { seed: 4242, encounter: 'first_light' }, {}],
    ['vharun with Tyrant', VHARUN_TYRANT, { ticks: 60 * 90 }],
    [
      'tolling_halls with Mimicry',
      { seed: 1000, encounter: 'tolling_halls', dissonance: level('mimicry') },
      {},
    ],
    ['the Silent Conductor with True Dissonance', POSTLUDE, {}],
  ];
  for (const [name, config, stage] of equal)
    it(`with every Expert rule off it plays as the Skilled bot every 2 ticks: ${name}`, () => {
      const off = play(config, expert(config.seed, [...EXPERT_RULES]), stage);
      const skilled = play(config, skilledAtTwo(config.seed), stage);
      expect(off.commands).toBe(skilled.commands);
      expect(Object.values(off.fires!).every((n) => n === 0)).toBe(true);
    }, 120_000);

  it('none of its rules acts in a fight without their mechanics', () => {
    const r = play({ seed: 4242, encounter: 'first_light' }, expert(4242));
    expect(r.fires).toEqual(Object.fromEntries(EXPERT_RULES.map((x) => [x, 0])));
    expect(r.commands).toBe(
      play({ seed: 4242, encounter: 'first_light' }, skilledAtTwo(4242)).commands,
    );
  });
});

/** Each rule acts in its staged fight, never once left off, and the fight's commands change. */
function actsIn(rule: ExpertRule, config: SimConfig, stage: Stage = {}): void {
  const on = play(config, expert(config.seed), stage);
  const off = play(config, expert(config.seed, [rule]), stage);
  expect(on.fires![rule], `${rule} acted`).toBeGreaterThan(0);
  expect(off.fires![rule]).toBe(0);
  expect(off.commands, `${rule} left off changes the commands`).not.toBe(on.commands);
}

describe('each Expert rule acts in a fight staged for it, and changes it when left off', () => {
  it('tyrantFocus: the Hollow Cantor in phase 3 (Tyrant), its Focus moved off it mid-Hymn', () => {
    // Staged: once the Hymn has been cast for 1 s, the Focus is cleared (test-only), as when
    // something else took it. The Skilled bot's own caster rule waits out its 4 s between Focuses
    // (the cast is 3 s); the Expert Focuses the boss again at once.
    let staged = false;
    actsIn(
      'tyrantFocus',
      { seed: 1000, encounter: 'hollow_cantor', dissonance: level('tyrant') },
      {
        bossPct: 0.3,
        each: (state) => {
          const id = state.encounter.bossId;
          const cast = id === null ? null : state.entities.get(id)?.enemy?.cast;
          // The Cantor's phase 3 borrowed attack, as the sim's own table names it.
          if (staged || !cast || cast.attackId !== tyrantAttackOf('the_hollow_cantor', 3)?.attack)
            return;
          if (state.time < cast.start + 1 || state.focusTarget === null) return;
          (state as { focusTarget: number | null }).focusTarget = null;
          staged = true;
        },
        reset: () => (staged = false),
      },
    );
  }, 60_000);

  it('tyrantWard: the first Tyrant boss whose borrowed attack a Ward answers, that telegraph live', () => {
    // Chosen through the sim's own table: the first boss (table order) with a damaging borrowed
    // attack a Ward answers, in its own encounter (Movement I's, played bare). Measured on the
    // merged fight (6 seeds a boss): the rule changed commands in 4 of 6 Bellwarden fights, 4 of 6
    // Vharun's, 1 of 6 at the Cantor and the Conductor, none elsewhere.
    const wards = (defId: string) =>
      (TYRANT_TABLE[defId] ?? []).some(
        (e) =>
          e !== null &&
          attackDef(e.attack).effect === 'damage' &&
          attackDef(e.attack).answers.includes('ward'),
      );
    const boss = Object.keys(TYRANT_TABLE).find(wards)!;
    const encounter = CONTENT.encounters.find((e) => e.boss === boss)!;
    expect(encounter.movement ?? 1).toBe(1);
    actsIn('tyrantWard', { seed: 1000, encounter: encounter.id, dissonance: level('tyrant') });
  }, 60_000);

  it('mimicFocus: the Shattered Choir with Mimicry, the Mimicking foe casting its mirror', () => {
    actsIn('mimicFocus', {
      seed: 1000,
      encounter: 'shattered_choir',
      dissonance: level('mimicry'),
    });
  }, 60_000);

  it('mimicCrack: the Tolling Halls with Mimicry, a mirror copying a Ward or a Chime', () => {
    actsIn('mimicCrack', { seed: 1000, encounter: 'tolling_halls', dissonance: level('mimicry') });
  }, 60_000);

  it('postludeRise: the Conductor rising with every Solo full and the Resonance to Cue them', () => {
    // Staged: as the rise begins, every hero's Solo is full and the Weaver's Resonance is at its
    // top (test-only). The Skilled bot Cues a damage Solo into the untouchable boss; the Expert waits.
    let staged = false;
    actsIn('postludeRise', POSTLUDE, {
      each: (state) => {
        const p = state.field.finale?.postlude;
        if (staged || !p) return;
        const w = state.entities.get(state.weaverId)!.weaver! as { resonance: number };
        w.resonance = 100;
        for (const id of state.party) {
          const hero = state.entities.get(id)?.hero as { solo: number } | undefined;
          if (hero) hero.solo = 100;
        }
        staged = true;
      },
      reset: () => (staged = false),
    });
  }, 120_000);

  it('postludePair: the Silent Conductor with True Dissonance, a pair under way', () => {
    // Seed 8919: a pair under way meets a Ward the plain rules would spend (seed 1000's meets none).
    actsIn('postludePair', { ...POSTLUDE, seed: 8919 });
  }, 120_000);

  it('postludeBank: the Postlude on a Conductor run, Discord set past its line after the rise', () => {
    // Staged: once the Conductor has stood up, its Discord is put at 80 (test-only), so the bank
    // meets Fortissimo Silence; a Conductor run, where `bankCrescendo` holds nothing.
    let staged = false;
    const stage: Stage = {
      each: (state) => {
        const p = state.field.finale?.postlude;
        const d = state.field.finale?.discord;
        if (staged || !p || !d || state.time < p.riseUntil) return;
        (d as { value: number }).value = 80;
        staged = true;
      },
      reset: () => (staged = false),
    };
    const config: SimConfig = {
      ...POSTLUDE,
      calling: { id: 'conductor', path: ['marcato', 'reprise', 'ensemble', 'triad'] },
    };
    actsIn('postludeBank', config, stage);
  }, 120_000);

  it('restlessHold: a Focus onto an enemy standing up is never sent; one onto a standing enemy is', () => {
    // Staged on a live state: First Light's first wave, still `spawning` as it stands up, and the
    // same enemies once they stand.
    const sim = createSim({ seed: 1000, encounter: 'first_light' });
    let rising: number | undefined;
    for (let t = 0; t < 600 && rising === undefined; t++) {
      sim.step();
      rising = sim.state.entities.list().find((e) => e.enemy?.state === 'spawning')?.id;
    }
    expect(rising).toBeDefined();
    const focus = (target: number): Command[] => [
      { t: 'move', x: 0, z: 1 },
      { t: 'directive', kind: 'focus', target },
    ];
    const held = new ExpertPlay();
    const out = focus(rising!);
    held.filter(sim.state, out);
    expect(out).toEqual([{ t: 'move', x: 0, z: 1 }]);
    expect(held.fires.restlessHold).toBe(1);
    const off = new ExpertPlay(new Set(['restlessHold']));
    const kept = focus(rising!);
    off.filter(sim.state, kept);
    expect(kept).toEqual(focus(rising!));
    expect(off.fires.restlessHold).toBe(0);
    for (let t = 0; t < 600; t++) {
      sim.step();
      if (sim.state.entities.get(rising!)?.enemy?.state !== 'spawning') break;
    }
    const standing = focus(rising!);
    new ExpertPlay().filter(sim.state, standing);
    expect(standing).toEqual(focus(rising!));
  });
});
