/**
 * The bots and Phase 5g's relics (docs/phase-5g.md; review B's B1, B2 and C2): Iron Mask, whose
 * curse refuses Empower; and Everbell, a second Chime charge. (Review C2 was about a Cue's price;
 * a Cue costs nothing now, docs/solos.md.) tests/bots/fillInert.test.ts shows the same bots send
 * what they always did on fights holding none of these.
 */
import { describe, expect, it } from 'vitest';
import { makeBot, type BotKind } from '../../src/bots';
import {
  createSim,
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
