/**
 * The bots and Phase 5g's relics (docs/phase-5g.md; review B's B1, B2 and C2): Iron Mask, whose
 * curse refuses Empower; Everbell, a second Chime charge; and a Cue's price off the Conductor,
 * which Opening Bars, Tempo Rubato and Hollow Crown change. tests/bots/fillInert.test.ts shows the
 * same bots send what they always did on fights holding none of these.
 */
import { describe, expect, it } from 'vitest';
import { makeBot, type BotKind } from '../../src/bots';
import { cueGateCost } from '../../src/bots/common';
import { CONTENT } from '../../src/content';
import {
  createSim,
  cueCostNow,
  type Command,
  type SimConfig,
  type ThreadMode,
  type WorldState,
} from '../../src/sim';
import { ARRIVAL3_KIT, ARRIVAL_KIT, kitConfig } from '../../tools/kits';

const MAX_TICKS = 9 * 60 * 60;

/** The Thread mode a `mode` command would leave (the sim's toggle). */
function modeAfter(state: WorldState, c: Extract<Command, { t: 'mode' }>): ThreadMode {
  const w = state.entities.get(state.weaverId)!.weaver!;
  if (c.mode === 'bear') return w.threadMode === 'bear' ? w.lastMode : 'bear';
  if (w.threadMode === 'bear') return w.lastMode;
  return w.threadMode === 'mend' ? 'empower' : 'mend';
}

interface Played {
  outcome: 'victory' | 'defeat' | 'timeout';
  /** `mode` commands that ask for Empower. */
  askedEmpower: number;
  /** Thread toggles the sim refused (`techniqueRejected`, thread, locked) right after a `mode`. */
  refusedToggles: number;
  bearTicksInUnravel: number;
  /** Chimes cast onto a point a Chime still in the air already covers (≤ its radius − 0.5 m). */
  coveredChimes: number;
  /** Chimes cast while another, landing elsewhere, was in the air. */
  secondCharges: number;
  /** The Resonance held when each Cue was sent, and that Cue's price then. */
  cues: { resonance: number; now: number; base: number }[];
}

function play(config: SimConfig, bot: BotKind): Played {
  const sim = createSim(config);
  const player = makeBot(bot, config.seed);
  const r: Played = {
    outcome: 'timeout',
    askedEmpower: 0,
    refusedToggles: 0,
    bearTicksInUnravel: 0,
    coveredChimes: 0,
    secondCharges: 0,
    cues: [],
  };
  for (let t = 0; t < MAX_TICKS; t++) {
    const state = sim.state;
    const commands = player.decide(state);
    const toggled = commands.some((c) => c.t === 'mode');
    for (const c of commands) {
      if (c.t === 'mode' && modeAfter(state, c) === 'empower') r.askedEmpower++;
      if (c.t === 'tech' && c.id === 'chime' && c.point && state.chimes.length > 0) {
        const p = c.point;
        if (state.chimes.some((f) => Math.hypot(f.x - p.x, f.z - p.z) <= f.radius - 0.5))
          r.coveredChimes++;
        else r.secondCharges++;
      }
      if (c.t === 'cue') {
        const w = state.entities.get(state.weaverId)!.weaver!;
        r.cues.push({
          resonance: w.resonance,
          now: cueCostNow(state),
          base: state.dissonance.cueCost,
        });
      }
    }
    sim.step(commands);
    for (const e of sim.drainEvents())
      if (toggled && e.type === 'techniqueRejected' && e.technique === 'thread')
        if (e.reason === 'locked') r.refusedToggles++;
    const w = sim.state.entities.get(sim.state.weaverId)!.weaver!;
    if (sim.state.field.unravel && w.threadMode === 'bear') r.bearTicksInUnravel++;
    const s = sim.state.encounter.status;
    if (s === 'victory' || s === 'defeat') {
      r.outcome = s;
      break;
    }
  }
  return r;
}

const withRelic = (config: SimConfig, relic: string): SimConfig => ({
  ...config,
  relics: [...(config.relics ?? []), relic],
});

describe('Iron Mask: the bots never ask for Empower (review B1)', () => {
  // The review's fights (seed 11, no kit), then the Unweaver on Movement III's kit.
  const fights: [string, SimConfig][] = [
    ['frayed_threshold', { seed: 11, encounter: 'frayed_threshold' }],
    ['the_unweaver', { seed: 11, encounter: 'the_unweaver' }],
    ['the_unweaver (kit)', { seed: 5000, encounter: 'the_unweaver', ...kitConfig(ARRIVAL3_KIT) }],
    ['vharun (kit)', { seed: 5000, encounter: 'vharun', ...kitConfig(ARRIVAL_KIT) }],
  ];
  for (const bot of ['skilled', 'novice'] as const)
    for (const [name, config] of fights)
      it(`${bot} on ${name}: no Empower toggle, so none refused`, () => {
        const r = play(withRelic(config, 'iron_mask'), bot);
        expect(r.askedEmpower).toBe(0);
        expect(r.refusedToggles).toBe(0);
      }, 120_000);

  it('the Skilled bot wins the Unweaver on its kit with the mask, before the time limit', () => {
    for (const seed of [5000, 12919]) {
      const r = play(
        withRelic({ seed, encounter: 'the_unweaver', ...kitConfig(ARRIVAL3_KIT) }, 'iron_mask'),
        'skilled',
      );
      expect(r.outcome, `seed ${seed}`).toBe('victory');
    }
  }, 120_000);

  it('the Martyr Bears through Unravel with the mask (the one mode left that does not wound)', () => {
    const r = play(
      withRelic(
        {
          seed: 5000,
          encounter: 'the_unweaver',
          ...kitConfig(ARRIVAL3_KIT),
          calling: { id: 'martyr' },
        },
        'iron_mask',
      ),
      'skilled',
    );
    expect(r.askedEmpower).toBe(0);
    expect(r.bearTicksInUnravel).toBeGreaterThan(0);
  }, 120_000);
});

describe('Everbell: no second Chime where the first will land (review B2)', () => {
  // The review's fights: Movement II and III's hard fights on their kits.
  const fights: [string, Omit<SimConfig, 'seed'>][] = [
    ['gorehound_matriarch', { encounter: 'gorehound_matriarch', ...kitConfig(ARRIVAL_KIT) }],
    ['vharun', { encounter: 'vharun', ...kitConfig(ARRIVAL_KIT) }],
    ['the_seamstress', { encounter: 'the_seamstress', ...kitConfig(ARRIVAL3_KIT) }],
    ['the_unweaver', { encounter: 'the_unweaver', ...kitConfig(ARRIVAL3_KIT) }],
  ];
  it('casts no Chime onto a point one in the air covers, and still spends the second charge', () => {
    let second = 0;
    for (const [name, fight] of fights)
      for (const seed of [5000, 12919]) {
        const r = play(withRelic({ ...fight, seed }, 'everbell'), 'skilled');
        expect(r.coveredChimes, `${name}@${seed}`).toBe(0);
        second += r.secondCharges;
      }
    // A second charge spent at once, on a hero the first Chime doesn't reach.
    expect(second).toBeGreaterThan(0);
  }, 300_000);
});

describe('A Cue is gated on the price paid now, off the Conductor (review C2)', () => {
  it('cueCostNow is dissonance.cueCost on every tick of fights without a Cue discount', () => {
    const configs: SimConfig[] = [
      { seed: 5000, encounter: 'hollow_cantor' },
      { seed: 5000, encounter: 'vharun', ...kitConfig(ARRIVAL_KIT) },
      // Hollow Crown's cut is in dissonance.cueCost already; its floor never bites at 15.
      withRelic({ seed: 5000, encounter: 'vharun', ...kitConfig(ARRIVAL_KIT) }, 'hollow_crown'),
      { seed: 5000, encounter: 'hollow_cantor', dissonance: [{ id: 'silent_cues', rank: 1 }] },
    ];
    for (const config of configs) {
      const sim = createSim(config);
      const player = makeBot('skilled', config.seed);
      let ticks = 0;
      for (let t = 0; t < MAX_TICKS; t++) {
        expect(cueCostNow(sim.state)).toBe(sim.state.dissonance.cueCost);
        expect(cueGateCost(sim.state)).toBe(sim.state.dissonance.cueCost);
        ticks++;
        sim.step(player.decide(sim.state));
        sim.drainEvents();
        const s = sim.state.encounter.status;
        if (s === 'victory' || s === 'defeat') break;
      }
      expect(ticks).toBeGreaterThan(600);
    }
  }, 120_000);

  it('with Opening Bars the bots Cue at the cut price, and never below it', () => {
    const top = CONTENT.motifs.find((m) => m.id === 'opening_bars')!.values.length;
    // A bare party: Resonance is low when the first Solo fills (a kit's is far above 25 by then).
    const base: SimConfig = { seed: 5000, encounter: 'hollow_cantor' };
    for (const bot of ['skilled', 'novice'] as const) {
      let cheap = 0;
      for (const seed of [5000, 12919, 20838]) {
        const r = play(
          {
            ...base,
            seed,
            motifs: [...(base.motifs ?? []), { id: 'opening_bars', level: top }],
          },
          bot,
        );
        for (const c of r.cues) expect(c.resonance).toBeGreaterThanOrEqual(c.now - 1e-9);
        cheap += r.cues.filter((c) => c.resonance < c.base && c.now < c.base).length;
      }
      // The first Cue of a fight, sent with less Resonance than the uncut price.
      expect(cheap, bot).toBeGreaterThan(0);
    }
  }, 300_000);
});
