/**
 * Phase 5g, W6 (docs/phase-5g.md, "Events and boons"): the six new events, every choice of each,
 * where they sit on the map, and which choice the harness takes. Each choice is played through the
 * run layer (`Run.chooseEvent`) from a run standing in an event of the event's Movement.
 */
import { describe, expect, it } from 'vitest';
import { CONTENT, relicDef, runEventDef } from '../../src/content';
import { FILL_EVENTS } from '../../src/content/fill';
import * as Run from '../../src/meta/run';
import type { CombatOutcome, RunState } from '../../src/meta/types';
import { emptyLedger } from '../../src/sim/world';

const IDS = [
  'heros_doubt',
  'quartermaster',
  'bleeding_bell',
  'lost_weavers_echo',
  'unravelled_tapestry',
  'stopped_clock',
];
const MOVEMENT: Record<string, number> = {
  heros_doubt: 2,
  quartermaster: 2,
  bleeding_bell: 2,
  lost_weavers_echo: 3,
  unravelled_tapestry: 3,
  stopped_clock: 3,
};

/** A three-Movement Expedition, embarked, with Aether and two motifs that can still grow. */
function expedition(seed = 5, aether = 500): RunState {
  const run = Run.embark(Run.newRun(seed, undefined, [], [], [], [], undefined, 3));
  return {
    ...run,
    aether,
    motifs: [
      { id: 'relay_weave', level: 1 },
      { id: 'lifeline', level: 1 },
    ],
  };
}

/** The run standing in `eventId`, at an event node of the event's own Movement. */
function inEvent(eventId: string, base: RunState = expedition()): RunState {
  const movement = runEventDef(eventId).movement ?? 1;
  const nodes = base.map.rows.flat();
  const target = nodes.find((n) => n.kind === 'event' && n.movement === movement)!;
  expect(target, `an event node in Movement ${movement}`).toBeDefined();
  const before = base.map.rows[target.row - 1]?.find((n) => n.next.includes(target.id));
  const placed: RunState = {
    ...base,
    phase: 'map',
    path: before ? [before.id] : [],
    pending: null,
  };
  const run = Run.chooseNode(placed, target.id);
  expect(run.phase).toBe('event');
  return { ...run, event: { ...run.event!, eventId } };
}

function win(run: RunState): CombatOutcome {
  const config = Run.combatConfig(run)!;
  return {
    encounterId: config.encounter!,
    outcome: 'victory',
    duration: 40,
    ledger: emptyLedger(),
    party: run.party.map((h, slot) => ({
      slot,
      heroId: h.heroId,
      hp: 800,
      maxHp: 1000,
      downed: false,
      dead: false,
      damage: 100,
      amplified: 10,
    })),
    withoutYou: null,
  };
}

/** Puts the run on the next fight node after it (any), for boons that count fights. */
function nextFight(run: RunState): RunState {
  const target = run.map.rows.flat().find((n) => n.kind === 'skirmish')!;
  const before = run.map.rows[target.row - 1]?.find((n) => n.next.includes(target.id));
  return Run.chooseNode(
    { ...run, phase: 'map', path: before ? [before.id] : [], pending: null, event: null },
    target.id,
  );
}

const hpOf = (run: RunState) => run.party.map((h) => h.hpPct);
const hurtParty = (run: RunState, hpPct: number): RunState => ({
  ...run,
  party: run.party.map((h) => ({ ...h, hpPct })),
});
const rarityOf = (run: RunState) => relicDef(run.relics.at(-1)!.id).rarity;

/**
 * The harness's event rule (tools/harness-core.ts, `event`): the first choice with no motif to
 * pick, no Chords to choose, (with relics on) and no problem now. Copied here, read only.
 */
function harnessChoice(run: RunState): string | null {
  const def = runEventDef(run.event!.eventId);
  return (
    def.choices.find(
      (c) =>
        c.motif === 'none' &&
        !c.effects.some((e) => e.kind === 'retune') &&
        Run.eventChoiceProblem(run, c.id) === null,
    )?.id ?? null
  );
}

describe('the six events as content', () => {
  it('are appended after the Mirror Pool, in Movements II and III, with their choices in order', () => {
    expect(FILL_EVENTS.map((e) => e.id)).toEqual(IDS);
    expect(CONTENT.events.slice(-IDS.length).map((e) => e.id)).toEqual(IDS);
    for (const id of IDS) expect(runEventDef(id).movement, id).toBe(MOVEMENT[id]);
    expect(
      Object.fromEntries(IDS.map((id) => [id, runEventDef(id).choices.map((c) => c.id)])),
    ).toEqual({
      heros_doubt: ['hear', 'press', 'silent'],
      quartermaster: ['crate', 'chest', 'walk'],
      bleeding_bell: ['toll', 'ring', 'pass'],
      lost_weavers_echo: ['face', 'listen', 'away'],
      unravelled_tapestry: ['reweave', 'pull', 'leave'],
      stopped_clock: ['wind', 'spring', 'leave'],
    });
    // The last of each is free, with nothing to pick and nothing done.
    for (const id of IDS) {
      const last = runEventDef(id).choices.at(-1)!;
      expect([last.cost, last.motif, last.effects, last.chance], id).toEqual([
        0,
        'none',
        [],
        undefined,
      ]);
    }
  });

  it('the Mirror Hall, a Movement III skirmish, is Lost Weaver’s Echo’s fight', () => {
    const hall = CONTENT.encounters.find((e) => e.id === 'mirror_hall')!;
    expect([hall.kind, hall.movement]).toEqual(['skirmish', 3]);
    expect(Run.eventFightRelics('lost_weavers_echo')).toBe(2);
    expect(Run.eventHasFight('lost_weavers_echo')).toBe(true);
    for (const id of IDS.filter((x) => x !== 'lost_weavers_echo'))
      expect(Run.eventHasFight(id), id).toBe(false);
  });

  it('appear only on their own Movement’s map, and never on a Prelude', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 40; seed++) {
      const exp = Run.newRun(seed, undefined, [], [], [], [], undefined, 3);
      for (const n of exp.map.rows.flat())
        if (n.eventId && IDS.includes(n.eventId)) {
          expect(n.movement, n.eventId).toBe(MOVEMENT[n.eventId]);
          seen.add(n.eventId);
        }
      const prelude = Run.newRun(seed);
      for (const n of prelude.map.rows.flat()) expect(IDS).not.toContain(n.eventId);
    }
    expect([...seen].sort()).toEqual([...IDS].sort());
  });

  it('which choice the harness takes (its first it can, with relics on)', () => {
    const taken = Object.fromEntries(IDS.map((id) => [id, harnessChoice(inEvent(id))]));
    expect(taken).toEqual({
      heros_doubt: 'hear',
      quartermaster: 'crate',
      bleeding_bell: 'toll',
      lost_weavers_echo: 'face',
      // Both its first two choices pick a motif, which the harness never does (docs/phase-5g.md
      // lists them in this order): it walks on.
      unravelled_tapestry: 'leave',
      stopped_clock: 'wind',
    });
    // Too poor for the crate, the harness walks on from the Quartermaster.
    expect(harnessChoice(inEvent('quartermaster', expedition(5, 10)))).toBe('walk');
  });
});

describe('Hero’s Doubt', () => {
  it('Hear them out: every hero heals, and Steadied for the next 2 fights', () => {
    let run = Run.chooseEvent(inEvent('heros_doubt', hurtParty(expedition(), 0.5)), 'hear');
    expect(hpOf(run)).toEqual([0.7, 0.7, 0.7]);
    expect(run.boons).toEqual([{ id: 'steadied', fights: 2 }]);
    expect(run.event!.gains!.boons).toEqual(['steadied']);
    run = Run.leaveEvent(run);
    for (const left of [1, 0]) {
      run = nextFight(run);
      expect(Run.combatConfig(run)!.boons).toEqual(['steadied']);
      run = Run.finishCombat(run, win(run));
      expect(run.boons.length).toBe(left);
    }
  });

  it('Press on: 40 Aether, and Faltering for the next fight', () => {
    let run = Run.chooseEvent(inEvent('heros_doubt', expedition(5, 100)), 'press');
    expect(run.aether).toBe(140);
    expect(run.boons).toEqual([{ id: 'faltering', fights: 1 }]);
    run = nextFight(Run.leaveEvent(run));
    expect(Run.combatConfig(run)!.boons).toEqual(['faltering']);
    run = Run.finishCombat(run, win(run));
    expect(run.boons).toEqual([]);
  });

  it('Say nothing: nothing happens', () => {
    const before = inEvent('heros_doubt');
    const run = Run.chooseEvent(before, 'silent');
    expect([run.aether, run.boons, run.relics, hpOf(run)]).toEqual([
      before.aether,
      before.boons,
      before.relics,
      hpOf(before),
    ]);
    expect(run.event!.choice).toBe('silent');
  });
});

describe('The Quartermaster', () => {
  it('Buy the sealed crate: 70 Aether for a rare relic', () => {
    const run = Run.chooseEvent(inEvent('quartermaster'), 'crate');
    expect(run.aether).toBe(430);
    expect(run.relics).toHaveLength(1);
    expect(rarityOf(run)).toBe('rare');
    const poor = inEvent('quartermaster', expedition(5, 69));
    expect(Run.eventChoiceProblem(poor, 'crate')).toMatch(/70 Aether/);
    expect(Run.chooseEvent(poor, 'crate')).toBe(poor);
  });

  it('Buy the war chest: 140 Aether for a legendary relic', () => {
    const run = Run.chooseEvent(inEvent('quartermaster'), 'chest');
    expect(run.aether).toBe(360);
    expect(rarityOf(run)).toBe('legendary');
    expect(Run.eventChoiceProblem(inEvent('quartermaster', expedition(5, 139)), 'chest')).toMatch(
      /140 Aether/,
    );
  });

  it('Walk on: nothing happens', () => {
    const run = Run.chooseEvent(inEvent('quartermaster'), 'walk');
    expect([run.aether, run.relics]).toEqual([500, []]);
  });
});

describe('The Bleeding Bell', () => {
  it('Toll for the fallen: every hero heals 20% of their life', () => {
    const run = Run.chooseEvent(inEvent('bleeding_bell', hurtParty(expedition(), 0.4)), 'toll');
    expect(hpOf(run).map((x) => Math.round(x * 1000) / 1000)).toEqual([0.6, 0.6, 0.6]);
    expect(run.relics).toEqual([]);
  });

  it('Ring it yourself: a legendary relic, or every hero loses 25% of their life', () => {
    const outcomes = new Set<string>();
    for (let seed = 1; seed <= 12; seed++) {
      const run = Run.chooseEvent(inEvent('bleeding_bell', expedition(seed)), 'ring');
      if (run.event!.won) {
        expect(rarityOf(run)).toBe('legendary');
        expect(hpOf(run)).toEqual([1, 1, 1]);
        outcomes.add('won');
      } else {
        expect(run.relics).toEqual([]);
        expect(hpOf(run)).toEqual([0.75, 0.75, 0.75]);
        expect(run.event!.outcome).toMatch(/takes it/);
        outcomes.add('lost');
      }
    }
    expect(outcomes.size).toBe(2);
  });

  it('Pass by: nothing happens', () => {
    const run = Run.chooseEvent(inEvent('bleeding_bell'), 'pass');
    expect([run.aether, run.relics, hpOf(run)]).toEqual([500, [], [1, 1, 1]]);
  });
});

describe('Lost Weaver’s Echo', () => {
  it('Face your echo: the Mirror Hall, then a choice of 2 relics', () => {
    let run = Run.chooseEvent(inEvent('lost_weavers_echo'), 'face');
    expect(run.phase).toBe('combat');
    expect(Run.combatConfig(run)!.encounter).toBe('mirror_hall');
    run = Run.finishCombat(run, win(run));
    run = Run.continueFromResult(run);
    expect(run.phase).toBe('relic');
    expect(run.relicOffer!.options).toHaveLength(2);
    run = Run.pickRelic(run, 1);
    expect(run).toMatchObject({ phase: 'map', event: null, pending: null });
    expect(run.relics).toHaveLength(1);
  });

  it('Listen to it: a motif you choose gains a level; every hero loses 10% of their life', () => {
    const before = inEvent('lost_weavers_echo');
    expect(Run.chooseEvent(before, 'listen')).toBe(before);
    const run = Run.chooseEvent(before, 'listen', { motifId: 'lifeline' });
    expect(run.motifs).toEqual([
      { id: 'relay_weave', level: 1 },
      { id: 'lifeline', level: 2 },
    ]);
    expect(hpOf(run)).toEqual([0.9, 0.9, 0.9]);
    const maxed = inEvent('lost_weavers_echo', {
      ...expedition(),
      motifs: [{ id: 'twin_aegis', level: 1 }],
    });
    expect(Run.eventChoiceProblem(maxed, 'listen')).toMatch(/grow/);
  });

  it('Look away: nothing happens', () => {
    const run = Run.chooseEvent(inEvent('lost_weavers_echo'), 'away');
    expect([run.phase, run.relics, hpOf(run)]).toEqual(['event', [], [1, 1, 1]]);
  });
});

describe('The Unravelled Tapestry', () => {
  it('Reweave it: 50 Aether, and a motif you choose gains a level', () => {
    const run = Run.chooseEvent(inEvent('unravelled_tapestry'), 'reweave', {
      motifId: 'relay_weave',
    });
    expect(run.aether).toBe(450);
    expect(run.motifs[0]).toEqual({ id: 'relay_weave', level: 2 });
    const poor = inEvent('unravelled_tapestry', expedition(5, 49));
    expect(Run.eventChoiceProblem(poor, 'reweave')).toMatch(/50 Aether/);
  });

  it('Pull a thread: lose a motif you choose, gain a legendary relic', () => {
    const run = Run.chooseEvent(inEvent('unravelled_tapestry'), 'pull', { motifId: 'lifeline' });
    expect(run.motifs).toEqual([{ id: 'relay_weave', level: 1 }]);
    expect(run.event!.gains!.lostMotif).toBe('lifeline');
    expect(rarityOf(run)).toBe('legendary');
    const empty = inEvent('unravelled_tapestry', { ...expedition(), motifs: [] });
    expect(Run.eventChoiceProblem(empty, 'pull')).toMatch(/motif/);
  });

  it('Leave it: nothing happens', () => {
    const run = Run.chooseEvent(inEvent('unravelled_tapestry'), 'leave');
    expect([run.aether, run.motifs.length, run.relics]).toEqual([500, 2, []]);
  });
});

describe('The Stopped Clock', () => {
  it('Wind it: your heroes start the next 2 fights with their Solos charged', () => {
    const run = Run.chooseEvent(inEvent('stopped_clock'), 'wind');
    expect(run.boons).toEqual([{ id: 'last_note', fights: 2 }]);
    expect(runEventDef('stopped_clock').choices[0]!.text).toContain('next 2 fights');
  });

  it('Take its spring: every hero loses 15% of their life; gain a rare relic', () => {
    const run = Run.chooseEvent(inEvent('stopped_clock'), 'spring');
    expect(hpOf(run)).toEqual([0.85, 0.85, 0.85]);
    expect(rarityOf(run)).toBe('rare');
  });

  it('Leave it: nothing happens', () => {
    const run = Run.chooseEvent(inEvent('stopped_clock'), 'leave');
    expect([run.boons, run.relics, hpOf(run)]).toEqual([[], [], [1, 1, 1]]);
  });
});
