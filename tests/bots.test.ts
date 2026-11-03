import { describe, expect, it } from 'vitest';
import { movementEncounters, playEncounter } from '../tools/harness-core';
import { ARRIVAL_KIT, kitConfig } from '../tools/kits';
import { M1_ENCOUNTERS } from '../tools/m1-baseline';
import { CONTENT } from '../src/content';
import * as Run from '../src/meta/run';
import { makeBot } from '../src/bots';
import { dotIncoming, effectiveFraction } from '../src/bots/common';
import { createSim, type Command, type Sim, type SimEvent, type Status } from '../src/sim';
import { applyStatusPayload } from '../src/sim/combat/health';
import { phaseRules } from '../src/sim/systems/bosses';
import { hero, sandbox, spawn, stepFor, worldOf } from './sim/helpers';

const GUARDIAN = Run.CHORD_PRESETS.find((p) => p.id === 'guardian')!.chords.map((c) => ({
  auras: [...c.auras],
  ornaments: [...c.ornaments],
}));

/**
 * Smoke-level balance guards. The full bands live in the harness (`npm run harness`); these
 * pin a few representative outcomes so an accidental balance break fails CI.
 */
describe('bots (harness v1)', () => {
  it('the Skilled bot clears First Light cleanly', () => {
    for (const seed of [1000, 8919]) {
      const run = playEncounter(
        { seed, encounter: 'first_light', auras: ['sostenuto', 'fortissimo'] },
        'skilled',
      );
      expect(run.outcome, `seed ${seed}`).toBe('victory');
      expect(run.share).toBeGreaterThan(0.3);
    }
  });

  it('an idle Weaver usually loses the Tolling Halls', () => {
    let wins = 0;
    for (let i = 0; i < 10; i++) {
      const run = playEncounter(
        { seed: 1000 + i * 7919, encounter: 'tolling_halls', auras: ['sostenuto', 'fortissimo'] },
        'idle',
      );
      if (run.outcome === 'victory') wins++;
    }
    expect(wins).toBeLessThanOrEqual(3);
  });

  it('bot runs are deterministic', () => {
    const a = playEncounter(
      { seed: 77, encounter: 'glass_gallery', auras: ['sostenuto', 'fortissimo'] },
      'novice',
    );
    const b = playEncounter(
      { seed: 77, encounter: 'glass_gallery', auras: ['sostenuto', 'fortissimo'] },
      'novice',
    );
    expect(b).toEqual(a);
  });
});

describe('Chord presets', () => {
  it('are legal, distinct, and each wins First Light for the Skilled bot', () => {
    const ids = new Set(Run.CHORD_PRESETS.map((p) => p.id));
    expect(ids.size).toBe(Run.CHORD_PRESETS.length);
    const shapes = new Set(
      Run.CHORD_PRESETS.map((p) =>
        JSON.stringify(p.chords.map((c) => [...c.auras, ...c.ornaments].sort())),
      ),
    );
    expect(shapes.size).toBe(Run.CHORD_PRESETS.length);
    for (const preset of Run.CHORD_PRESETS) {
      expect(Run.chordsLegal(preset.chords), preset.id).toBe(true);
      const run = playEncounter(
        { seed: 4242, encounter: 'first_light', chords: preset.chords.map((c) => ({ ...c })) },
        'skilled',
      );
      expect(run.outcome, preset.id).toBe('victory');
    }
  });
});

describe('the Skilled bot and the beam song', () => {
  it('with a defensive beam song it still Empowers instead of idle-Mending a healthy tank', async () => {
    const choir = Run.CHORD_PRESETS.find((p) => p.id === 'choir')!;
    const sim = createSim({
      seed: 1000,
      encounter: 'first_light',
      chords: choir.chords.map((c) => ({ auras: [...c.auras], ornaments: [...c.ornaments] })),
    });
    const bot = makeBot('skilled', 1000);
    for (let t = 0; t < 60 * 120 && sim.state.encounter.status !== 'victory'; t++) {
      sim.step(bot.decide(sim.state));
      sim.drainEvents();
    }
    expect(sim.state.ledger.thread.amplified).toBeGreaterThan(0);
  });
});

// ── Movement II (docs/phase-5a.md, "Bots and harness") ───────────────────────────────

const KIT = kitConfig(ARRIVAL_KIT);
type Sandbox = ReturnType<typeof sandbox>;

/** A status staged on a hero, as the sim's payloads leave it (docs/phase-5a.md P2). */
function stage(sim: Sandbox, slot: number, status: Partial<Status> & { id: Status['id'] }): void {
  const e = worldOf(sim).entities.get(sim.state.party[slot]!)!;
  e.health!.statuses.push({ remaining: 4, duration: 4, stacks: 1, source: null, ...status });
}

/** The Skilled bot's commands over `ticks` ticks of a staged sandbox. */
function play(sim: Sandbox, ticks: number, seed = 1): Command[] {
  const bot = makeBot('skilled', seed);
  const commands: Command[] = [];
  for (let t = 0; t < ticks; t++) {
    const out = bot.decide(sim.state);
    commands.push(...out);
    sim.step(out);
    sim.drainEvents();
  }
  return commands;
}

describe('the Skilled bot reads Movement II (staged)', () => {
  it('Reels a pinned hero free within 2 s, and a latched one', () => {
    for (const id of ['pinned', 'latched'] as const) {
      const sim = sandbox({ chords: GUARDIAN });
      stage(sim, 1, { id, dps: 56 });
      const commands = play(sim, 120);
      expect(
        commands.some((c) => c.t === 'tech' && c.id === 'reel' && c.slot === 1),
        id,
      ).toBe(true);
    }
  });

  it('Chimes a hero bleeding at 5+ stacks, and leaves 4 stacks alone', () => {
    const chimes = (stacks: number) => {
      const sim = sandbox({ chords: GUARDIAN });
      stage(sim, 0, { id: 'bleed', stacks, remaining: 6, duration: 6, dps: 11.28 });
      return play(sim, 60).filter((c) => c.t === 'tech' && c.id === 'chime');
    };
    expect(chimes(6).length).toBeGreaterThan(0);
    expect(chimes(4)).toEqual([]);
  });

  it('Chimes the cluster with the most bleed', () => {
    const sim = sandbox({ chords: GUARDIAN });
    // Kael bleeds at 5 on his own; Lyra and Vexis, side by side, at 7 and 6.
    const w = worldOf(sim);
    const [kael, lyra, vexis] = w.party.map((id) => w.entities.get(id)!);
    Object.assign(kael!, { x: -5, z: 0 });
    Object.assign(lyra!, { x: 4, z: 0 });
    Object.assign(vexis!, { x: 5, z: 1 });
    stage(sim, 0, { id: 'bleed', stacks: 5, remaining: 6, dps: 11.28 });
    stage(sim, 1, { id: 'bleed', stacks: 7, remaining: 6, dps: 11.28 });
    stage(sim, 2, { id: 'bleed', stacks: 6, remaining: 6, dps: 11.28 });
    const chime = makeBot('skilled', 1)
      .decide(sim.state)
      .find((c) => c.t === 'tech' && c.id === 'chime');
    expect(chime?.t === 'tech' && chime.point ? chime.point.x : null).toBeGreaterThan(0);
  });

  it('counts the bleed still to come as damage on the way', () => {
    const sim = sandbox();
    const kael = hero(sim, 0);
    const before = effectiveFraction(kael);
    stage(sim, 0, { id: 'bleed', stacks: 6, remaining: 5, dps: 12 });
    expect(dotIncoming(kael)).toBeCloseTo(12 * 6 * 5);
    expect(effectiveFraction(kael)).toBeCloseTo(before - (12 * 6 * 5) / kael.health!.maxHp);
  });

  it('Focuses a guarded Crimson Sentinel', () => {
    const sim = sandbox({ chords: GUARDIAN });
    stepFor(sim, 1, [spawn('crimson_sentinel', 0, -8)]);
    const sentinel = worldOf(sim)
      .entities.list()
      .find((e) => e.enemy?.defId === 'crimson_sentinel')!;
    sentinel.health!.hp = sentinel.health!.maxHp = 1e6;
    // The sim gives a Sentinel its guard (docs/phase-5a.md P6); stage one where it doesn't yet.
    sentinel.enemy!.guard ??= { fx: 0, fz: 1, brokenUntil: 0 };
    play(sim, 240);
    expect(sim.state.focusTarget).toBe(sentinel.id);
  });

  it('Scatters for a Blood Pact', () => {
    const sim = sandbox({ chords: GUARDIAN });
    const w = worldOf(sim);
    const [a, b] = [w.party[0]!, w.party[1]!];
    w.telegraphs.push({
      id: 998,
      owner: w.weaverId,
      target: null,
      attackId: 'hemomancer_blood_pact',
      name: 'Blood Pact',
      kind: 'link',
      shape: { kind: 'link', a, b, r: 6 },
      start: w.time,
      impact: w.time + 6,
      perfectFrom: w.time + 5.65,
      damage: 282,
      pctMaxHp: 0,
      effect: 'damage',
      answers: ['scatter'],
      severity: 'normal',
      linkStatus: 'pact',
    });
    const out = makeBot('skilled', 1).decide(sim.state);
    expect(out).toContainEqual({ t: 'directive', kind: 'scatter' });
    // The Novice Scatters for it too, now and then (and draws for it only while it's up).
    const novice = makeBot('novice', 3);
    let scattered = false;
    for (let t = 0; t < 240 && !scattered && sim.state.telegraphs.length > 0; t++) {
      scattered = novice.decide(sim.state).some((c) => c.t === 'directive' && c.kind === 'scatter');
      sim.step([]);
      sim.drainEvents();
    }
    expect(scattered).toBe(true);
  });

  it('threads and Mends the hero an Execution condemns', () => {
    const sim = sandbox({ chords: GUARDIAN });
    const w = worldOf(sim);
    const lyra = w.entities.get(w.party[1]!)!;
    lyra.health!.hp = lyra.health!.maxHp * 0.3;
    w.telegraphs.push({
      id: 999,
      owner: w.weaverId,
      target: lyra.id,
      attackId: 'vharun_execution',
      name: 'Execution',
      kind: 'mark',
      shape: { kind: 'mark', target: lyra.id },
      start: w.time,
      impact: w.time + 4,
      perfectFrom: w.time + 3.65,
      damage: 75,
      pctMaxHp: 0,
      effect: 'damage',
      answers: ['mend', 'ward'],
      severity: 'lethal',
      executeBelow: 0.4,
    });
    const out = makeBot('skilled', 1).decide(sim.state);
    expect(out).toContainEqual({ t: 'thread', slot: 1 });
    const mode = sim.state.entities.get(sim.state.weaverId)!.weaver!.threadMode;
    expect(mode === 'mend' || out.some((c) => c.t === 'mode')).toBe(true);
  });

  it('stands in a Sanctuary pool under the Bloodmoon, and Rallies the party into it', () => {
    const sim = sandbox({ chords: GUARDIAN });
    worldOf(sim).field.sanctuary = {
      pools: [{ x: 8, z: 8, r: 3.6, vx: 0, vz: 0 }],
      healMult: 0.5,
      reformAt: 1e9,
    };
    const commands = play(sim, 60 * 8);
    const w = sim.state.entities.get(sim.state.weaverId)!;
    expect(Math.hypot(w.x - 8, w.z - 8)).toBeLessThan(3.6);
    expect(commands.some((c) => c.t === 'directive' && c.kind === 'rally')).toBe(true);
  });
});

describe('the Novice bot in Movement II', () => {
  it('Chimes a hero bleeding at 5+ stacks now and then, and draws for it only then', () => {
    const run = (bleed: boolean) => {
      const sim = sandbox({ chords: GUARDIAN });
      if (bleed) stage(sim, 0, { id: 'bleed', stacks: 6, remaining: 60, duration: 60, dps: 0 });
      const bot = makeBot('novice', 5);
      const out: Command[] = [];
      for (let t = 0; t < 600; t++) {
        const c = bot.decide(sim.state);
        out.push(...c);
        sim.step(c);
        sim.drainEvents();
      }
      return out;
    };
    expect(run(true).some((c) => c.t === 'tech' && c.id === 'chime')).toBe(true);
    expect(run(false).some((c) => c.t === 'tech' && c.id === 'chime')).toBe(false);
  });

  it('Movement II encounter runs are deterministic', () => {
    const a = playEncounter({ seed: 77, encounter: 'blood_rites', ...KIT }, 'novice');
    const b = playEncounter({ seed: 77, encounter: 'blood_rites', ...KIT }, 'novice');
    expect(b).toEqual(a);
  });
});

describe('Movement II smoke guards (arrival kit)', () => {
  it('the Skilled bot clears the Crimson Gate', () => {
    for (const seed of [1000, 8919]) {
      const run = playEncounter({ seed, encounter: 'crimson_gate', ...KIT }, 'skilled');
      expect(run.outcome, `seed ${seed}`).toBe('victory');
      expect(run.share).toBeGreaterThan(0.3);
    }
  });

  it('an idle Weaver loses the Gorehound Matriarch and Vharun', () => {
    for (const encounter of ['gorehound_matriarch', 'vharun'])
      for (const seed of [1000, 8919]) {
        const run = playEncounter({ seed, encounter, ...KIT }, 'idle');
        expect(run.outcome, `${encounter} ${seed}`).not.toBe('victory');
      }
  });

  it('lists each Movement’s fights from content, Movement I as the harness always had them', () => {
    expect(movementEncounters(1)).toEqual([...M1_ENCOUNTERS]);
    expect(movementEncounters(2)).toEqual([
      'crimson_gate',
      'blood_rites',
      'pike_line',
      'red_muster',
      'leech_warren',
      'shield_wall',
      'blood_forge',
      'gorehound_matriarch',
      'vharun',
    ]);
  });
});

/**
 * TODO(W1-W3 merge): the in-play tests below need the sim's Movement II behaviours (statuses
 * from W1, enemies and guards from W2, Vharun's script from W3), which land in parallel with
 * the bots. Until they are merged the probe finds the W0a stubs and these are skipped; once
 * they are, the probe passes and they run. Drop the probe after integration.
 */
const SIM_M2 = ((): boolean => {
  const sim = sandbox();
  const w = worldOf(sim);
  const kael = w.entities.get(w.party[0]!)!;
  const bleeds = applyStatusPayload(w, kael, { id: 'bleed', duration: 6, stacks: 1 }, null);
  stepFor(sim, 2, [spawn('crimson_sentinel', 0, -10)]);
  const guards = w.entities.list().some((e) => e.enemy?.guard !== undefined);
  return bleeds && guards && phaseRules('vharun_crimson_warden', 2) !== null;
})();

/** Plays a fight with the Skilled bot on the arrival kit, handing each tick to `watch`. */
function fight(
  encounter: string,
  seed: number,
  watch: (sim: Sim, events: SimEvent[], commands: Command[]) => void,
  opts: { seconds?: number; bossHp?: number } = {},
): Sim {
  const sim = createSim({ seed, encounter, debug: opts.bossHp !== undefined, ...KIT });
  const bot = makeBot('skilled', seed);
  for (let t = 0; t < (opts.seconds ?? 300) * 60; t++) {
    const commands = bot.decide(sim.state);
    if (opts.bossHp !== undefined && sim.state.encounter.status === 'fighting') {
      commands.push({ t: 'debug', op: { op: 'setBossHp', pct: opts.bossHp } });
      opts.bossHp = undefined;
    }
    sim.step(commands);
    watch(sim, sim.drainEvents(), commands);
    const s = sim.state.encounter.status;
    if (s === 'victory' || s === 'defeat') break;
  }
  return sim;
}

describe.runIf(SIM_M2)('the Skilled bot answers Movement II in play (arrival kit)', () => {
  it('Reels a pinned hero free within 2 s whenever its Reel is ready', () => {
    let pins = 0;
    let freed = 0;
    const cost = CONTENT.techniques.reel.cost;
    for (const seed of [1000, 8919, 16838, 24757]) {
      const open = new Map<number, number>();
      fight('pike_line', seed, (sim, events) => {
        const w = sim.state.entities.get(sim.state.weaverId)!.weaver!;
        for (const e of events) {
          if (e.type === 'statusRemoved' && e.status === 'pinned' && open.has(e.target)) {
            if (e.reason === 'freed' && sim.state.time - open.get(e.target)! <= 2) freed++;
            open.delete(e.target);
          }
        }
        // A pin while one Reel is ready for it (off cooldown, paid for, nobody else held).
        for (const e of events) {
          if (e.type !== 'statusApplied' || e.status !== 'pinned') continue;
          if (open.size > 0 || w.cooldowns.reel > 0 || w.spirit < cost) continue;
          open.set(e.target, sim.state.time);
          pins++;
        }
      });
    }
    expect(pins).toBeGreaterThan(0);
    expect(freed / pins).toBeGreaterThanOrEqual(0.75);
  });

  it('Chimes the bleeding at 5+ stacks', () => {
    const atCleanse: number[] = [];
    for (const seed of [1000, 8919]) {
      const stacks = new Map<number, number>();
      fight('crimson_gate', seed, (_sim, events) => {
        let most = 0;
        for (const e of events) {
          if (e.type === 'statusApplied' && e.status === 'bleed')
            stacks.set(e.target, e.stacks ?? 1);
          if (e.type === 'statusRemoved' && e.status === 'bleed') {
            if (e.reason === 'cleansed') most = Math.max(most, stacks.get(e.target) ?? 0);
            stacks.delete(e.target);
          }
        }
        if (most > 0) atCleanse.push(most);
      });
    }
    expect(atCleanse.length).toBeGreaterThan(0);
    // The Chimes that cleansed a bleed took in a hero at 5 stacks or more (a few answer a
    // hero's call instead, whatever their stacks).
    expect(atCleanse.filter((n) => n >= 5).length / atCleanse.length).toBeGreaterThanOrEqual(0.75);
  });

  it('Scatters each Blood Pact', () => {
    let pacts = 0;
    let scattered = 0;
    for (const seed of [1000, 8919]) {
      fight('blood_rites', seed, (sim, events) => {
        for (const e of events)
          if (e.type === 'telegraphStarted' && e.name === 'Blood Pact') pacts++;
        if (
          sim.state.directive === 'scatter' &&
          events.some((e) => e.type === 'directiveAck' && e.directive === 'scatter')
        )
          scattered++;
      });
    }
    expect(pacts).toBeGreaterThan(0);
    expect(scattered).toBeGreaterThan(0);
  });

  it('Focuses the Crimson Sentinel', () => {
    let focused = false;
    fight('red_muster', 1000, (sim, _events, commands) => {
      for (const c of commands)
        if (c.t === 'directive' && c.kind === 'focus' && c.target !== undefined)
          focused ||= sim.state.entities.get(c.target)?.enemy?.defId === 'crimson_sentinel';
    });
    expect(focused).toBe(true);
  });

  it('answers both blows of Twin Cleave on its target: a Ward each, a Reel, or a step', () => {
    let blows = 0;
    let answered = 0;
    for (const seed of [1000, 8919, 16838]) {
      const targets = new Map<number, number | null>();
      fight('vharun', seed, (_sim, events) => {
        for (const e of events) {
          if (e.type === 'telegraphStarted' && e.name === 'Twin Cleave')
            targets.set(e.telegraph, e.target);
          if (e.type !== 'telegraphResolved' || !targets.has(e.telegraph)) continue;
          if (e.target === null || e.target !== targets.get(e.telegraph)) continue;
          if (e.outcome === 'cancelled') continue;
          blows++;
          if (e.outcome !== 'hit') answered++;
        }
      });
    }
    expect(blows).toBeGreaterThan(5);
    expect(answered / blows).toBeGreaterThanOrEqual(0.75);
  });

  it('keeps the Execution target at or above 40% in 80% of casts', () => {
    let casts = 0;
    let kept = 0;
    // Eight seeds: one Execution each, so three made the share hang on a single cast.
    for (const seed of [1000, 8919, 16838, 24757, 32676, 40595, 48514, 56433]) {
      // The judgement (phase 3) from the start; the bot does the rest.
      const live = new Map<number, { target: number; frac: number }>();
      fight(
        'vharun',
        seed,
        (sim, events) => {
          for (const e of events) {
            if (e.type === 'telegraphResolved' && live.has(e.telegraph)) {
              const t = live.get(e.telegraph)!;
              casts++;
              if (t.frac >= 0.4 || e.outcome !== 'hit') kept++;
              live.delete(e.telegraph);
            }
          }
          // Each Execution's target life, as it stood just before it landed.
          for (const t of sim.state.telegraphs) {
            if (t.executeBelow === undefined || t.target === null) continue;
            const h = sim.state.entities.get(t.target)!.health!;
            live.set(t.id, { target: t.target, frac: h.hp / h.maxHp });
          }
        },
        { seconds: 120, bossHp: 0.32 },
      );
    }
    expect(casts).toBeGreaterThanOrEqual(3);
    expect(kept / casts).toBeGreaterThanOrEqual(0.8);
  });
});
