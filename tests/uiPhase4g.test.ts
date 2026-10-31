/**
 * Phase 4g UI, the run's side of the Loom (docs/phase-4g.md): Starlight on the Result and the
 * Summary, Calling mastery in Prep and on the Calling's pages, and the Perfect-Ward trainer. The
 * screens' words are pure models over content (`CONTENT.starlight`, `CONTENT.mastery`) and meta
 * (`starlightForDeeds`, `masteryProgress`, `tiersOpen`); the trainer is driven against a real
 * sandbox sim, batch by batch as the runtime feeds it, with real Ward casts.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { useProfile } from '../src/app/profileStore';
import { useRun } from '../src/app/runStore';
import { useSettings } from '../src/app/settings';
import { CONTENT, callingDef } from '../src/content';
import { masteryLevel, starlightForDeeds, starlightForFight } from '../src/meta/loom';
import * as Run from '../src/meta/run';
import type { EncounterResult } from '../src/meta/types';
import { SIM_DT, type Command, type PartySlot, type Sim } from '../src/sim';
import { masteryRun, mockDrillView, mockTry } from '../src/ui/lab/loomRunMock';
import { mockDissonance } from '../src/ui/lab/mock';
import { nextTier, pathLabel, pathSteps, pathTipLines } from '../src/ui/screens/callingText';
import {
  levelOpens,
  masteryGain,
  masteryPrizes,
  masteryView,
  nextLine,
  tiersLine,
} from '../src/ui/screens/masteryModel';
import {
  dissonanceLine,
  fightStarlight,
  runStarlight,
  starlightUse,
} from '../src/ui/screens/starlightModel';
import {
  DRILL_GAP,
  DRILL_LEAD,
  DRILL_SPEEDS,
  LATE_GRACE,
  WardDrill,
  barPercent,
  judgeBlow,
  localBests,
  memoryBests,
  statusLine,
  tryDetail,
  tryTitle,
  type DrillTry,
} from '../src/ui/screens/wardDrill';
import { sandbox, worldOf } from './sim/helpers';

const S = CONTENT.starlight;
const M = CONTENT.mastery;
const skipUnlocks = (on: boolean) =>
  useSettings.getState().update((x) => ({ ...x, unlockAll: on }));

beforeEach(() => {
  useSettings.getState().reset();
  useProfile.getState().resetProgress();
  useRun.getState().closeRun();
});

// ── The Perfect-Ward trainer ─────────────────────────────────────────────────────────

/** A frame of the test's runtime: three ticks. */
const FRAME_MS = Math.round(3 * SIM_DT * 1000);

/** The live drill telegraph in the sim, if any. */
function drillTelegraph(sim: Sim) {
  return sim.state.telegraphs.find((t) => t.drill) ?? null;
}

/** The commands each drill's last batch asked for, going in with the next frame's. */
const pending = new WeakMap<WardDrill, Command[]>();

/**
 * Runs the sim as the runtime does: a few ticks a frame, the drill hearing each batch and its
 * commands going in with the next frame's. `act` adds the player's commands for a frame.
 */
function drive(
  sim: Sim,
  drill: WardDrill,
  frames: number,
  act: (sim: Sim) => Command[] = () => [],
  ticksPerFrame = 3,
): void {
  for (let f = 0; f < frames; f++) {
    const commands = [...(pending.get(drill) ?? []), ...act(sim)];
    for (let i = 0; i < ticksPerFrame; i++) sim.step(i === 0 ? commands : []);
    pending.set(drill, drill.step(sim.drainEvents(), sim.state));
  }
}

/** Frames until the drill's next try is judged (or `max`). */
function untilTry(
  sim: Sim,
  drill: WardDrill,
  act: (sim: Sim) => Command[] = () => [],
  max = 2000,
): DrillTry {
  const before = drill.view().tries;
  for (let f = 0; f < max && drill.view().tries === before; f++) drive(sim, drill, 1, act);
  expect(drill.view().tries).toBe(before + 1);
  return drill.view().last!;
}

/**
 * Wards the hero in `slot` once per blow, when the sim's clock reaches `at(blow)` (sim seconds):
 * the blow is remembered after it lands, so a Ward can come late.
 */
function wardAt(slot: PartySlot, at: (t: { perfectFrom: number; impact: number }) => number) {
  let blow: { id: number; perfectFrom: number; impact: number } | null = null;
  let cast = -1;
  return (sim: Sim): Command[] => {
    const t = drillTelegraph(sim);
    if (t && t.id !== blow?.id) blow = { id: t.id, perfectFrom: t.perfectFrom, impact: t.impact };
    if (blow && cast !== blow.id && sim.state.time >= at(blow)) {
      cast = blow.id;
      return [{ t: 'tech', id: 'ward', slot }];
    }
    return [];
  };
}

function newDrill(mode: 'slow' | 'normal' | 'quick' | 'mixed' = 'slow', target: PartySlot = 0) {
  const drill = new WardDrill({ mode, target, bests: memoryBests(), random: () => 0.5 });
  const sim = sandbox();
  // The party stands up on the first tick.
  sim.step();
  sim.drainEvents();
  drill.start();
  return { drill, sim };
}

const heroHp = (sim: Sim, slot: number) => {
  const w = worldOf(sim);
  const h = w.entities.get(w.party[slot]!)!.health!;
  return h.hp / h.maxHp;
};

describe('the Perfect-Ward trainer', () => {
  it('a slow blow comes at the chosen hero after the lead; Warded in the window it’s Perfect', () => {
    const { drill, sim } = newDrill('slow', 0);
    drive(sim, drill, 3);
    expect(drill.view().status).toMatchObject({ kind: 'next', slot: 0, speed: 'slow' });
    // The lead (to Thread its hero), then the bell's blow: a slow windup.
    let started: ReturnType<typeof drillTelegraph> = null;
    for (let f = 0; f < 200 && !started; f++) {
      drive(sim, drill, 1);
      started = drillTelegraph(sim);
    }
    expect(started).not.toBeNull();
    expect(started!.impact - started!.start).toBeCloseTo(DRILL_SPEEDS.slow.windup, 5);
    expect(started!.start).toBeGreaterThanOrEqual(DRILL_LEAD - 0.1);
    expect(sim.state.party.indexOf(started!.target!)).toBe(0);
    expect(drill.view().status).toMatchObject({ kind: 'blow', slot: 0 });

    const t = untilTry(
      sim,
      drill,
      wardAt(0, (b) => b.perfectFrom + 0.1),
    );
    expect(t.kind).toBe('perfect');
    expect(tryTitle(t)).toBe('Perfect');
    // Cast 0.1 s into the window: that many ms before it landed (to a tick, as the sim counts).
    expect(t.ms! / 1000).toBeGreaterThan(0);
    expect(t.ms! / 1000).toBeLessThanOrEqual(t.windowMs / 1000 - 0.1 + SIM_DT + 0.001);
    expect(tryDetail(t, () => 'Kael')).toMatch(/ms before it landed, inside the \d+ ms window/);
    const v = drill.view();
    expect(v.streak).toBe(1);
    expect(v.best).toBe(1);
    expect(v.newBest).toBe(true);
    expect(v.history).toEqual(['perfect']);
  });

  it('early and late by how many milliseconds; missed; the streak starts over, the best stays', () => {
    const { drill, sim } = newDrill('normal', 1);
    const perfect = untilTry(
      sim,
      drill,
      wardAt(1, (b) => b.perfectFrom + 0.05),
    );
    expect(perfect.kind).toBe('perfect');

    // 300 ms before the window opens: Warded, not Perfect, early by about that.
    const early = untilTry(
      sim,
      drill,
      wardAt(1, (b) => b.perfectFrom - 0.3),
    );
    expect(early.kind).toBe('early');
    // The Ward goes in with the frame after the clock passes the moment: up to a frame (3 ticks)
    // later, as a key pressed in the browser would.
    expect(early.ms!).toBeGreaterThanOrEqual(300 - FRAME_MS - 1);
    expect(early.ms!).toBeLessThanOrEqual(300 + 1);
    expect(tryTitle(early)).toBe(`Early · ${early.ms} ms`);
    expect(drill.view().streak).toBe(0);
    expect(drill.view().best).toBe(1);
    // The streak broke: the next one has to beat the best again to be "new".
    expect(drill.view().newBest).toBe(false);

    // 200 ms after it landed: late by about that.
    const late = untilTry(
      sim,
      drill,
      wardAt(1, (b) => b.impact + 0.2),
    );
    expect(late.kind).toBe('late');
    expect(late.ms!).toBeGreaterThanOrEqual(200 - 1);
    expect(late.ms!).toBeLessThanOrEqual(200 + FRAME_MS + 1);
    expect(late.castAt!).toBeGreaterThan(0);

    // No Ward at all.
    const missed = untilTry(sim, drill);
    expect(missed.kind).toBe('missed');
    expect(missed.note).toBeNull();
    expect(tryDetail(missed, (s) => ['Kael', 'Lyra', 'Vexis'][s]!)).toBe('No Ward reached Lyra.');
    expect(drill.view().history).toEqual(['perfect', 'early', 'late', 'missed']);
    expect(drill.view().tries).toBe(4);
    expect(drill.view().perfects).toBe(1);
  });

  it('a Ward on the wrong hero is a miss that says so', () => {
    const { drill, sim } = newDrill('slow', 0);
    const t = untilTry(
      sim,
      drill,
      wardAt(2, (b) => b.perfectFrom + 0.05),
    );
    expect(t.kind).toBe('missed');
    expect(t.note).toEqual({ kind: 'elsewhere', slot: 2 });
    expect(tryDetail(t, (s) => ['Kael', 'Lyra', 'Vexis'][s]!)).toBe(
      'Your Ward went to Vexis, not Kael.',
    );
  });

  it('the blows don’t hurt: each starts with its hero whole, the sim healing them', () => {
    const { drill, sim } = newDrill('quick', 2);
    expect(untilTry(sim, drill).kind).toBe('missed');
    // The blow took a share of Vexis's life…
    expect(heroHp(sim, 2)).toBeLessThan(0.95);
    // …and the next one heals her as it starts. The drill sends no heal of its own between them.
    const sent: Command[] = [];
    for (let f = 0; f < 400 && !drillTelegraph(sim); f++) {
      drive(sim, drill, 1);
      sent.push(...(pending.get(drill) ?? []));
    }
    expect(drillTelegraph(sim)).not.toBeNull();
    expect(heroHp(sim, 2)).toBeCloseTo(1, 5);
    expect(sent.some((c) => c.t === 'debug' && c.op.op === 'healParty')).toBe(false);
  });

  it('a Reel that takes the hero clear is a miss: the drill wants a Ward', () => {
    const { drill, sim } = newDrill('slow', 0);
    let reeled = -1;
    const t = untilTry(sim, drill, (s) => {
      const blow = drillTelegraph(s);
      if (!blow || reeled === blow.id || s.state.time < blow.impact - 0.2) return [];
      reeled = blow.id;
      return [{ t: 'tech', id: 'reel', slot: 0 }];
    });
    expect(t).toMatchObject({ kind: 'missed', note: { kind: 'slipped' } });
    expect(tryDetail(t, () => 'Kael')).toMatch(/Reel/);
    expect(drill.view().streak).toBe(0);
  });

  it('blows come on a steady beat, quicker than the Ward’s recharge: the sim readies it', () => {
    const { drill, sim } = newDrill('quick', 0);
    const ward = wardAt(0, (b) => b.perfectFrom + 0.05);
    const w = () => worldOf(sim).entities.get(worldOf(sim).weaverId)!.weaver!;
    // Blow by blow: when each started and landed, and whether the Ward was ready as it started.
    const blows: { start: number; impact: number; ready: boolean }[] = [];
    let seen = -1;
    for (let f = 0; f < 3000 && blows.length < 3; f++) {
      drive(sim, drill, 1, ward);
      const t = drillTelegraph(sim);
      if (t && t.id !== seen) {
        seen = t.id;
        blows.push({ start: t.start, impact: t.impact, ready: w().wardCharges > 0 });
      }
    }
    expect(blows).toHaveLength(3);
    // Each starts the beat after the last landed (to a frame: commands go in with the next one),
    // well inside the Ward's recharge, and finds the Ward ready.
    const frame = FRAME_MS / 1000 + 1e-6;
    for (let i = 1; i < blows.length; i++) {
      const gap = blows[i]!.start - blows[i - 1]!.impact;
      expect(gap).toBeGreaterThanOrEqual(DRILL_GAP - 1e-6);
      expect(gap).toBeLessThanOrEqual(DRILL_GAP + frame);
      expect(blows[i]!.start - blows[i - 1]!.start).toBeLessThan(CONTENT.techniques.ward.cooldown);
    }
    expect(blows.every((b) => b.ready)).toBe(true);
    // Between them, the next blow's hero, speed and countdown.
    untilTry(sim, drill, ward);
    expect(drill.view().streak).toBeGreaterThanOrEqual(3);
    drive(sim, drill, 2);
    expect(drill.view().status).toMatchObject({ kind: 'next', slot: 0, speed: 'quick' });
    expect(
      statusLine(
        drill.view(),
        () => 'Kael',
        () => '1',
        'Q',
      ),
    ).toMatch(/^Next: Kael \(1\), quick, in \d\.\d s, your Ward readied for it\.$/);
  });

  it('a new fight (the Grounds restart theirs on a new loadout) starts the drill over in it', () => {
    const { drill, sim } = newDrill('quick', 0);
    // A blow winding up in the first fight…
    for (let f = 0; f < 400 && !drillTelegraph(sim); f++) drive(sim, drill, 1);
    expect(drillTelegraph(sim)).not.toBeNull();
    // …then a new one: the drill lines up its next blow there, and it counts.
    const next = sandbox();
    next.step();
    next.drainEvents();
    const t = untilTry(
      next,
      drill,
      wardAt(0, (b) => b.perfectFrom + 0.05),
    );
    expect(t.kind).toBe('perfect');
    expect(drill.view()).toMatchObject({ tries: 1, streak: 1 });
  });

  it('mixed mode picks the hero and the speed; a new mode starts the streak over', () => {
    let i = 0;
    const picks = [0.1, 0.9, 0.6, 0.2, 0.95, 0.5];
    const drill = new WardDrill({
      mode: 'mixed',
      bests: memoryBests({ slow: 4 }),
      random: () => picks[i++ % picks.length]!,
    });
    const sim = sandbox();
    sim.step();
    sim.drainEvents();
    drill.start();
    const seen: { slot: number; windup: number }[] = [];
    for (let f = 0; f < 4000 && seen.length < 3; f++) {
      drive(sim, drill, 1);
      const t = drillTelegraph(sim);
      if (t && !seen.some((s) => s.windup === t.impact - t.start && s.slot === t.target))
        seen.push({ slot: t.target!, windup: t.impact - t.start });
    }
    expect(new Set(seen.map((s) => s.slot)).size).toBeGreaterThan(1);
    expect(new Set(seen.map((s) => Math.round(s.windup * 10))).size).toBeGreaterThan(1);
    drill.setMode('slow');
    expect(drill.view()).toMatchObject({ mode: 'slow', streak: 0, best: 4, running: true });
    drill.stop();
    expect(drill.view().status).toEqual({ kind: 'idle' });
  });

  it('judges from the sim’s outcome and the cast time; bests survive blocked storage', () => {
    const blow = {
      slot: 0,
      speed: 'normal' as const,
      start: 10,
      perfectFrom: 11.05,
      impact: 11.4,
      refused: [],
    };
    expect(
      judgeBlow({ ...blow, outcome: 'warded', casts: [{ time: 10.6, slot: 0 }] }),
    ).toMatchObject({ kind: 'early', ms: 450 });
    expect(judgeBlow({ ...blow, outcome: 'warded', casts: [] })).toMatchObject({
      kind: 'warded',
    });
    expect(
      judgeBlow({ ...blow, outcome: 'hit', casts: [{ time: 11.4 + LATE_GRACE + 0.1, slot: 0 }] }),
    ).toMatchObject({ kind: 'missed' });
    expect(judgeBlow({ ...blow, outcome: 'hit', casts: [], refused: ['cooldown'] })?.note).toEqual({
      kind: 'refused',
      reason: 'cooldown',
    });
    expect(judgeBlow({ ...blow, outcome: 'cancelled', casts: [] })).toBeNull();
    expect(barPercent(0)).toBeGreaterThan(barPercent(-0.35));
    expect(barPercent(-5)).toBe(0);
    expect(barPercent(5)).toBe(100);
    // Node has no localStorage: loading and saving don't throw.
    expect(localBests.load()).toEqual({});
    expect(() => localBests.save({ slow: 3 })).not.toThrow();
  });
});

// ── Starlight on the Result and the Summary ─────────────────────────────────────────

/** A won fight's result as the run builds it (`starlightForFight`). */
function won(
  kind: EncounterResult['kind'],
  wonRun = false,
  mult = 1,
): Pick<EncounterResult, 'kind' | 'outcome' | 'starlight'> {
  return {
    kind,
    outcome: 'victory',
    starlight: starlightForFight({ kind, outcome: 'victory' }, wonRun, mult),
  };
}

/** Wins `n` fights through the run store (plain victories), taking the first of every offer. */
function winFights(n: number): void {
  const store = () => useRun.getState();
  for (let fights = 0, guard = 0; fights < n && guard < 200; guard++) {
    const run = store().run!;
    if (run.phase === 'map') {
      const options = Run.reachable(run);
      const next = options.find((x) => x.encounterId && x.kind !== 'event') ?? options[0]!;
      store().chooseNode(next.id);
    } else if (run.phase === 'combat') {
      store().finishCombat({
        encounterId: store().combatConfig()!.encounter!,
        outcome: 'victory',
        duration: 40,
        ledger: worldOf(sandbox()).ledger,
        party: run.party.map((h, slot) => ({
          slot,
          heroId: h.heroId,
          hp: 100,
          maxHp: 100,
          downed: false,
          dead: false,
          damage: 0,
          amplified: 0,
        })),
        withoutYou: null,
      });
      fights++;
      store().continueFromResult();
    } else if (run.phase === 'calling') store().pickCalling(0);
    else if (run.phase === 'relic') store().pickRelic(0);
    else if (run.phase === 'draft') store().pickDraft(0);
    else if (run.phase === 'respite') store().respite('rest');
    else if (run.phase === 'merchant') store().leaveShop();
    else if (run.phase === 'forge') store().leaveForge();
    else if (run.phase === 'event') {
      const choices = CONTENT.events.find((e) => e.id === run.event?.eventId)?.choices ?? [];
      if (run.event?.choice === null && choices.length > 0) store().chooseEvent(choices.at(-1)!.id);
      else store().leaveEvent();
    } else break;
  }
}

describe('Starlight on the Result and the Summary', () => {
  it('a fight’s Starlight says what paid it: its kind, a won run, Dissonance; a loss, nothing', () => {
    const elite = fightStarlight(won('elite'))!;
    expect(elite).toEqual({
      amount: S.fights.elite,
      headline: `+${S.fights.elite} Starlight`,
      detail: `${S.fights.elite} for an elite won`,
    });
    const boss = fightStarlight(won('boss', true))!;
    expect(boss.amount).toBe(S.fights.boss + S.winBonus);
    expect(boss.detail).toBe(
      `${S.fights.boss} for the boss won, ${S.winBonus} for winning the run`,
    );
    const levels = mockDissonance(12);
    const line = dissonanceLine(levels)!;
    expect(line).toMatch(/^Dissonance \d+ · ×\d/);
    const deep = fightStarlight(won('skirmish'), levels)!;
    expect(deep.detail).toBe(`${S.fights.skirmish} for a skirmish won · ${line}`);
    expect(fightStarlight({ kind: 'miniboss', outcome: 'defeat', starlight: 0 })).toMatchObject({
      amount: 0,
      headline: '+0 Starlight',
      detail: 'A loss pays nothing; what the run earned before stays yours.',
    });
    expect(fightStarlight({ kind: 'sandbox', outcome: 'victory', starlight: 0 })).toBeNull();
    // A fight won in a save from before Starlight paid none, and says so.
    expect(fightStarlight({ kind: 'elite', outcome: 'victory', starlight: 0 })).toMatchObject({
      amount: 0,
      detail: 'Won before Starlight was paid.',
    });
  });

  it('what it’s for: the Loom’s Atelier, or when it opens', () => {
    expect(starlightUse(S.atelierRank)).toBe(
      'Spend it in the Loom’s Atelier: technique variants, robes, Thread looks and titles.',
    );
    expect(starlightUse(S.atelierRank - 1)).toContain(`opens at Weaver Rank ${S.atelierRank}`);
    expect(starlightUse(1, true)).toMatch(/^Spend it/);
    expect(starlightUse(S.atelierRank - 1, false, true)).toBe(
      `Saved for the Loom’s Atelier, open from Weaver Rank ${S.atelierRank}.`,
    );
  });

  it('a won run’s fights, the win’s bonus and its Deeds add up to what it paid', () => {
    const run = { ...masteryRun({ tiers: 4 }), deeds: ['through_the_prelude', 'heard'] };
    expect(run.outcome).toBe('victory');
    const paid = run.results.reduce((n, r) => n + r.starlight, 0);
    const s = runStarlight(run);
    expect(s.total).toBe(paid + starlightForDeeds(run.deeds));
    expect(s.lines.map((l) => l.label)).toEqual(['Fights', 'Winning the run', 'Deeds']);
    expect(s.lines[0]!.amount + s.lines[1]!.amount).toBe(paid);
    expect(s.lines[1]!.amount).toBe(S.winBonus);
    expect(s.lines[0]!.note).toBe(`${run.results.length} won`);
    expect(s.lines[2]).toMatchObject({ amount: starlightForDeeds(run.deeds), note: '2 earned' });
    expect(s.dissonance).toBeNull();
    // At Dissonance the fights (and the win) paid more, and the panel says at what.
    const deep = masteryRun({ tiers: 4, dissonance: mockDissonance(12) });
    const d = runStarlight(deep);
    expect(d.total).toBe(deep.results.reduce((n, r) => n + r.starlight, 0));
    expect(d.total).toBeGreaterThan(paid);
    expect(d.dissonance).toBe(dissonanceLine(deep.dissonance));
  });

  it('what the run’s screens add up is what the stores paid the profile', () => {
    skipUnlocks(true);
    useRun.getState().newRun(91);
    useRun.getState().setCalling('luminary');
    useRun.getState().embark();
    winFights(4);
    const run = useRun.getState().run!;
    expect(run.results.length).toBe(4);
    const profile = useProfile.getState().profile;
    expect(runStarlight(run).total).toBe(profile.starlight);
    for (const r of run.results) expect(fightStarlight(r)!.amount).toBe(r.starlight);
    // The Calling's mastery: the run's Weaver XP, fight by fight.
    expect(profile.mastery.luminary).toBe(run.xp);
    const g = masteryGain('luminary', profile.mastery.luminary!, run.xp);
    expect(g.view.level).toBe(masteryLevel(run.xp));
    expect(g.reached).toEqual(Array.from({ length: g.view.level - 1 }, (_, i) => i + 2));
  });
});

// ── Calling mastery ─────────────────────────────────────────────────────────────────

describe('Calling mastery on the run’s screens', () => {
  const prizes = masteryPrizes('luminary')!;
  const top = M.levels.length;

  it('a level, the way to the next and what it opens, from content', () => {
    const first = masteryView('luminary', 0);
    expect(first).toMatchObject({ level: 1, top, next: { level: 2, opens: 'tier II' } });
    expect(first.progressText).toBe(`0 / ${M.levels[1]} to mastery 2`);
    expect(nextLine(first)).toBe('Mastery 2 opens tier II.');
    const m = M.callings.find((c) => c.calling === 'luminary')!;
    expect(prizes).toEqual({
      title: CONTENT.cosmetics.titles.find((t) => t.id === m.title)!.text,
      variant: CONTENT.techniqueVariants.find((v) => v.id === m.variant)!.name,
    });
    const fourth = masteryView('luminary', M.levels[top - 2]!);
    expect(fourth.level).toBe(top - 1);
    expect(nextLine(fourth)).toBe(
      `Mastery ${top} earns the title ${prizes.title} and ${prizes.variant} in the Atelier.`,
    );
    const mastered = masteryView('luminary', M.levels.at(-1)! + 10);
    expect(mastered.next).toBeNull();
    expect(mastered.fraction).toBe(1);
    expect(mastered.mastered).toBe(
      `Mastered: the title ${prizes.title} is yours, and ${prizes.variant} is open in the Atelier.`,
    );
    // Each level opens the tier its threshold gives the run (meta's `tiersOpen`).
    for (let level = 1; level < top; level++)
      expect(levelOpens('luminary', level)).toBe(
        level <= callingDef('luminary').tiers.length
          ? `tier ${['I', 'II', 'III', 'IV'][level - 1]}`
          : null,
      );
  });

  it('the tiers a run offers, and the levels that open the rest', () => {
    expect(tiersLine('luminary', 1)).toBe(
      'This run offers tier I. Tiers II–IV open with mastery 2–4.',
    );
    expect(tiersLine('luminary', 2, { prep: true })).toBe(
      'This run will offer tiers I and II. Tiers III and IV open with mastery 3 and 4.',
    );
    expect(tiersLine('luminary', 3)).toBe(
      'This run offers tiers I, II and III. Tier IV opens with mastery 4.',
    );
    expect(tiersLine('luminary', 4)).toBe('This run offers every tier of the path.');
    expect(tiersLine('luminary', 1, { all: true, prep: true })).toBe(
      'This run will offer every tier: the unlocks are skipped (Settings).',
    );
  });

  it('what a fight or a run earned: the bar, the levels reached and what they open', () => {
    const third = masteryGain('luminary', M.levels[2]! + 10, 40);
    expect(third).toMatchObject({ reached: [3], before: 0, headline: '+40 Luminary mastery' });
    expect(third.reachedLine).toBe('Mastery 3: tier III, from your next Luminary run.');
    const quiet = masteryGain('luminary', M.levels[1]! + 100, 40);
    expect(quiet.reached).toEqual([]);
    expect(quiet.after).toBeGreaterThan(quiet.before);
    expect(quiet.reachedLine).toBeNull();
    // Never more than the profile holds (a run saved before mastery).
    expect(masteryGain('luminary', 60, 400)).toMatchObject({
      gained: 60,
      headline: '+60 Luminary mastery',
      reached: [],
    });
    const last = masteryGain(
      'luminary',
      M.levels.at(-1)! + 5,
      M.levels.at(-1)! - M.levels.at(-2)! + 50,
    );
    expect(last.reached).toEqual([top - 1, top]);
    expect(last.reachedLine).toBe(
      `Mastery ${top - 1} and ${top}: tier IV, from your next Luminary run; the title ${prizes.title} is yours, and ${prizes.variant} is open in the Atelier.`,
    );
  });

  it('what Prep says a run will offer is what it embarks with', () => {
    useProfile.getState().award(1e6);
    useProfile.getState().awardMastery('luminary', M.levels[1]! + 10);
    useRun.getState().newRun(92);
    useRun.getState().setCalling('luminary');
    const open = useProfile.getState().tiersOpen('luminary');
    expect(open).toBe(2);
    expect(tiersLine('luminary', open, { prep: true })).toBe(
      'This run will offer tiers I and II. Tiers III and IV open with mastery 3 and 4.',
    );
    useRun.getState().embark();
    const calling = useRun.getState().run!.calling!;
    expect(calling.tiersOpen).toBe(open);
    expect(pathSteps(calling).map((s) => s.state)).toEqual(['open', 'open', 'locked', 'locked']);
  });
});

describe('locked tiers on the path', () => {
  it('past the run’s snapshot, tiers are locked by mastery: the track, the strip and the map', () => {
    const run = masteryRun({ tiers: 2, picks: ['haloed', 'searing_hymns'], fights: 4 });
    const calling = run.calling!;
    expect(calling.path.slice(0, 2)).toEqual(['haloed', 'searing_hymns']);
    const steps = pathSteps(calling, { map: run.map });
    expect(steps.map((s) => s.state)).toEqual(['chosen', 'chosen', 'locked', 'locked']);
    expect(steps.map((s) => s.mastery)).toEqual([1, 2, 3, 4]);
    expect(nextTier(calling, run.map)).toBeNull();
    expect(pathLabel(calling, run.map)).toBe(
      'The Luminary: Haloed, Searing Hymns. Tiers III and IV are locked: they open with mastery 3 and 4.',
    );
    const tips = pathTipLines(calling, run.map);
    expect(tips[2]).toMatchObject({ title: 'Locked: Luminary mastery 3', chosen: false });
    expect(tips[3]!.text).toContain('Not this run');
    // The map never marks a locked tier's fight (meta's `callingTierDue` agrees).
    for (const row of run.map.rows)
      for (const node of row) expect(Run.callingTierDue(run, node)?.tier ?? 0).toBeLessThan(2);
    // The review's case: tier I taken with only tier I open. Nothing more is promised this run.
    const one = { id: 'luminary', path: ['haloed', null, null, null], tiersOpen: 1 };
    expect(nextTier(one, run.map)).toBeNull();
    expect(pathSteps(one).map((s) => s.state)).toEqual(['chosen', 'locked', 'locked', 'locked']);
    expect(pathLabel(one, run.map)).toBe(
      'The Luminary: Haloed. Tiers II–IV are locked: they open with mastery 2–4.',
    );
    expect(pathTipLines(one, run.map).map((l) => l.title)).toEqual([
      'Haloed',
      'Locked: Luminary mastery 2',
      'Locked: Luminary mastery 3',
      'Locked: Luminary mastery 4',
    ]);
    // A run from before mastery: every tier, as before.
    expect(pathSteps({ ...calling, tiersOpen: undefined }).map((s) => s.state)).toEqual([
      'chosen',
      'chosen',
      'open',
      'open',
    ]);
    // The tier screen offers tier II with III and IV locked on its track.
    const offer = masteryRun({ tiers: 2, picks: ['haloed'], untilTier: 1 });
    expect(offer.phase).toBe('calling');
    expect(
      pathSteps(offer.calling!, { offerTier: offer.callingOffer!.tier }).map((s) => s.state),
    ).toEqual(['chosen', 'offer', 'locked', 'locked']);
  });
});

describe('the trainer’s views in the lab', () => {
  it('mock tries are judged by the drill itself', () => {
    expect(mockTry('perfect', { cast: -0.14 })).toMatchObject({ kind: 'perfect', ms: 140 });
    expect(mockTry('warded', { speed: 'normal', cast: -0.53 })).toMatchObject({
      kind: 'early',
      ms: 180,
    });
    expect(mockTry('hit', { speed: 'quick', cast: 0.09 })).toMatchObject({ kind: 'late', ms: 90 });
    expect(mockTry('hit', { cast: -0.1, castSlot: 1 }).note).toEqual({
      kind: 'elsewhere',
      slot: 1,
    });
    expect(mockDrillView({ history: ['perfect', 'missed'] })).toMatchObject({
      tries: 2,
      perfects: 1,
    });
  });
});
