/**
 * Phase 3e UI: the Chronomancer (docs/phase-3e.md, docs/phase-3e/ui.md). Numbers come from
 * content (`callingDef`, `callingOption`, `CONTENT.techniques`), the run (`runTotals`,
 * `RunCalling.reviveSpent`) and the sim (`HeroComponent.past`, `EnemyComponent.foreseen`,
 * `FieldState.stasis`, `WeaverComponent.masteryAt`, `rewindCanRevive`).
 */
import { describe, expect, it } from 'vitest';
import { CONTENT, callingDef, callingOption } from '../src/content';
import { COLOR_VISIONS, VISION_PALETTES, deltaE, simulateVision } from '../src/app/colorVision';
import {
  EVERYTHING,
  MAX_RANK,
  RANK_XP,
  UNLOCKS,
  allowanceFor,
  unlockRank,
} from '../src/meta/profile';
import * as Run from '../src/meta/run';
import { createSim, type Command, type Sim } from '../src/sim';
import { dealDamage } from '../src/sim/combat/health';
import type { World } from '../src/sim/world';
import { buildHudSnapshot } from '../src/ui/hudBridge';
import { callingHudLabel, stasisCostMult, stasisSeconds } from '../src/ui/hud/calling';
import { rewindSample } from '../src/ui/hud/chrono';
import { evaluateHints } from '../src/ui/hud/hints';
import { rewindMark, rewindSentence } from '../src/ui/hud/rewindText';
import { CALLING_GLYPHS } from '../src/ui/kit/callingGlyphs';
import { CALLING_LOOK } from '../src/ui/kit/callingLook';
import { fmt } from '../src/ui/kit/format';
import { PATHS } from '../src/ui/kit/iconPaths';
import {
  CHRONO_PICKS,
  chronoOfferRun,
  chronoResultRun,
  chronoStage,
  chronoSummaryRun,
  mockHud,
  mockRankUps,
  type ChronoScenario,
} from '../src/ui/lab/mock';
import { spiritBudget } from '../src/ui/screens/chordModel';
import {
  AXIS_LOOK,
  REWIND_NAME,
  callingAxes,
  callingNothingText,
  callingParts,
  callingResultLine,
  crescendoLine,
  optionAxes,
  passiveName,
  reviveSpentLine,
  rewindSeconds,
  rewindsFor,
  techniqueName,
} from '../src/ui/screens/callingText';
import { nextStep } from '../src/ui/screens/interlude';
import { callingLine, readyName, statLines } from '../src/ui/screens/resultText';
import { rankPanel, unlockIcon } from '../src/ui/screens/rankText';
import { rejectBuzz } from '../src/ui/hud/buzz';
import { ofType, spawn, stepFor, stepUntil, telegraphOn, worldOf } from './sim/helpers';

const CHRONO = callingDef('chronomancer');
const V = CHRONO.values;
const REWIND: Command = { t: 'tech', id: 'reel' };
const hud = (sim: Sim, hovered: number | null = null) =>
  buildHudSnapshot(sim.state, { seed: 7, hovered });
const GUARDIAN = [
  { auras: ['fortissimo'], ornaments: [] },
  { auras: ['sostenuto'], ornaments: [] },
];

/** A Chronomancer sandbox (Guardian's songs), the Weaver a step back, Kael threaded. */
function chronoSim(path: string[] = [], opts: { reviveSpent?: boolean; id?: string } = {}) {
  const sim = createSim({
    seed: 7,
    encounter: 'sandbox',
    debug: true,
    chords: GUARDIAN.map((c) => ({ ...c, auras: [...c.auras] })),
    calling: { id: opts.id ?? 'chronomancer', path, reviveSpent: opts.reviveSpent ?? false },
  });
  stepFor(sim, 1, [{ t: 'debug', op: { op: 'teleportWeaver', x: 0, z: 5 } }]);
  stepFor(sim, 2, [{ t: 'thread', slot: 0 }]);
  return { sim, w: worldOf(sim) };
}
const heroAt = (w: World, slot: number) => w.entities.get(w.party[slot]!)!;
const down = (w: World, slot: number) =>
  dealDamage(w, heroAt(w, slot), {
    source: null,
    sourceName: 'Toll Cleave',
    amount: 1e5,
    telegraph: null,
  });

describe('Rewind in Reel’s slot (the HUD, from a real sim)', () => {
  it('names itself, shows its glyph and its 18 s sweep; without him, Reel', () => {
    const { sim } = chronoSim();
    const before = hud(sim);
    const f = before.weaver.techniques.find((t) => t.key === 'reel')!;
    expect(f).toMatchObject({
      name: REWIND_NAME,
      icon: 'rewind',
      cost: CONTENT.techniques.reel.cost,
    });
    expect(before.weaver.rewind).toEqual({
      seconds: V.rewind,
      range: CONTENT.techniques.reel.range,
      ready: true,
    });
    stepFor(sim, 1, [REWIND]);
    const after = hud(sim).weaver;
    const cooling = after.techniques.find((t) => t.key === 'reel')!;
    expect(cooling.total).toBeCloseTo(V.cooldown!, 6);
    expect(cooling.remaining).toBeGreaterThan(V.cooldown! - 0.1);
    expect(after.rewind!.ready).toBe(false);
    // The Luminary keeps Reel.
    const lum = chronoSim([], { id: 'luminary' });
    const reel = hud(lum.sim).weaver.techniques.find((t) => t.key === 'reel')!;
    expect(reel).toMatchObject({ name: CONTENT.techniques.reel.name, icon: 'reel' });
    expect(hud(lum.sim).weaver.rewind).toBeNull();
    expect(hud(lum.sim).party.every((p) => p.rewind === null && p.lands === null)).toBe(true);
  });

  it('its rejections buzz the F slot', () => {
    const base = { kind: 'reject' as const, text: 'Rewind: not ready', expiresAt: 1 };
    expect(
      rejectBuzz([
        { ...base, id: 4, key: 'reject:ward' },
        { ...base, id: 7, key: 'reject:reel' },
        { ...base, id: 9, key: 'reject:reel' },
        { id: 10, kind: 'bark', text: 'Hm.', expiresAt: 1 },
      ]),
    ).toEqual({ ward: 4, reel: 9 });
  });
});

describe('the Rewind preview (from the hero’s past)', () => {
  it('gives back what they had then, on F’s target: the threaded hero, else the hovered one', () => {
    const { sim, w } = chronoSim();
    const kael = heroAt(w, 0);
    stepFor(sim, 200);
    dealDamage(w, kael, { source: null, sourceName: 'test', amount: 600, telegraph: null });
    stepFor(sim, 60);
    const past = rewindSample(kael)!;
    const h = hud(sim);
    const r = h.party[0]!.rewind!;
    expect(r).toMatchObject({ kind: 'restore', target: true, inRange: true, escape: null });
    expect(r.amount).toBeCloseTo(Math.min(kael.health!.maxHp, past.hp) - kael.health!.hp, 6);
    expect(rewindMark(r)).toBe(`Rewind +${fmt(r.amount)}`);
    expect(h.party.slice(1).every((p) => !p.rewind!.target)).toBe(true);
    // Pointing at Lyra makes her F's target.
    const lyra = heroAt(w, 1);
    const pointed = hud(sim, lyra.id);
    expect(pointed.party[1]!.rewind!.target).toBe(true);
    expect(pointed.party[0]!.rewind!.target).toBe(false);
    // F does what the preview said.
    const hp = kael.health!.hp;
    stepFor(sim, 1, [REWIND]);
    expect(kael.health!.hp).toBeCloseTo(hp + r.amount, 0);
    expect(kael.x).toBeCloseTo(past.x, 6);
  });

  it('says when going back takes them out of a hit on its way (a dodge, or Paradox undoing it)', () => {
    const { sim, w } = chronoSim();
    const { telegraph } = telegraphOn('bell_brute', 'Toll Cleave', 0, 2.5, sim, true);
    const kael = heroAt(w, 0);
    // Three seconds ago he stood well clear of it.
    for (const s of kael.hero!.past) Object.assign(s, { x: 0, z: 9 });
    const r = hud(sim).party[0]!.rewind!;
    expect(r.escape).toBe('dodge');
    expect(rewindSentence('Kael', r)).toMatch(/out of the hit on its way/);
    // Where he stands now is where he stood: no escape.
    for (const s of kael.hero!.past) Object.assign(s, { x: kael.x, z: kael.z });
    expect(hud(sim).party[0]!.rewind!.escape).toBeNull();
    expect(telegraph.impact).toBeGreaterThan(sim.state.time);
    // Paradox undoes what's aimed at him, wherever he stood.
    const path = ['quickened', 'echo_ward', 'temporal_mastery', 'paradox'];
    const p = chronoSim(path);
    telegraphOn('bell_brute', 'Toll Cleave', 0, 2.5, p.sim, true);
    expect(hud(p.sim).party[0]!.rewind!.escape).toBe('undo');
  });

  it('a hero who just fell stands back up, once a run; down too long is out of reach', () => {
    const { sim, w } = chronoSim();
    const kael = heroAt(w, 0);
    stepFor(sim, 200);
    down(w, 0);
    stepFor(sim, 40);
    const r = hud(sim).party[0]!.rewind!;
    const past = rewindSample(kael)!;
    expect(r).toMatchObject({ kind: 'revive', target: true });
    expect(r.amount).toBeCloseTo(Math.min(kael.health!.maxHp, past.hp), 6);
    expect(r.left).toBeGreaterThan(0);
    expect(r.left).toBeLessThanOrEqual(V.rewind!);
    expect(rewindMark(r)).toBe('Rewind: stands back up');
    expect(rewindSentence('Kael', r)).toMatch(/once a run/);
    expect(hud(sim).calling!.revive).toBe('ready');
    // F stands him up with the life it said.
    stepFor(sim, 1, [REWIND]);
    expect(kael.health!.downed).toBe(false);
    expect(kael.health!.hp).toBeCloseTo(r.amount, 0);
    // That was this run's revive: the next fall reads "spent".
    stepFor(sim, 30);
    down(w, 2);
    stepFor(sim, 30);
    const spent = hud(sim);
    expect(spent.party[2]!.rewind!.kind).toBe('spent');
    expect(rewindMark(spent.party[2]!.rewind!)).toBe('Rewind: revive spent');
    expect(spent.calling!.revive).toBe('spent');
    expect(callingHudLabel(spent.calling!)).toMatch(/its revive is spent/);
    // Down for longer than Rewind reaches.
    const late = chronoSim();
    down(late.w, 1);
    stepFor(late.sim, Math.ceil((V.rewind! + 1) * 60));
    expect(hud(late.sim).party[1]!.rewind!.kind).toBe('reach');
    expect(rewindMark(hud(late.sim).party[1]!.rewind!)).toBe('Rewind: out of reach');
  });

  it('a later fight of a run that spent its revive starts with it spent', () => {
    const { sim, w } = chronoSim([], { reviveSpent: true });
    expect(hud(sim).calling!.revive).toBe('spent');
    stepFor(sim, 100);
    down(w, 0);
    stepFor(sim, 30);
    expect(hud(sim).party[0]!.rewind!.kind).toBe('spent');
    // The sim agrees: F is refused, locked.
    const events = stepFor(sim, 1, [REWIND]);
    expect(ofType(events, 'techniqueRejected')[0]).toMatchObject({
      technique: 'rewind',
      reason: 'locked',
    });
  });
});

describe('Foresight and the telegraph timers on the frames', () => {
  it('a hero an attack is foreseen on shows it and its time, read from the state', () => {
    const { sim, w } = chronoSim(['foresight']);
    const lyra = heroAt(w, 1);
    stepFor(sim, 1, [spawn('lamenter', lyra.x, lyra.z - 6)]);
    for (const e of w.entities.list()) if (e.enemy && e.health) e.health.hp = e.health.maxHp = 1e6;
    const seen = stepUntil(sim, (ev) => ev.some((e) => e.type === 'foreseen'), 900);
    const first = ofType(seen, 'foreseen')[0]!;
    const h = hud(sim);
    const on = h.party.find((p) => p.id === first.target)!;
    expect(on.foreseen[0]).toMatchObject({ name: first.name, aimed: true });
    const enemy = w.entities.get(first.enemy)!;
    expect(on.foreseen[0]!.in).toBeCloseTo(Math.max(0, enemy.enemy!.foreseen!.at - w.time), 6);
    expect(h.party.filter((p) => p.id !== first.target).every((p) => p.foreseen.length === 0)).toBe(
      true,
    );
    // Without Foresight on the path, nothing is shown.
    expect(chronoStage('chrono-revive').hud.party.every((p) => p.foreseen.length === 0)).toBe(true);
  });

  it('every hit on its way shows when it lands; in Stasis it stands still', () => {
    const { sim, w } = chronoSim();
    const { telegraph } = telegraphOn('bell_brute', 'Toll Cleave', 0, 2.5, sim, true);
    const lands = hud(sim).party[0]!.lands!;
    expect(lands.name).toBe('Toll Cleave');
    expect(lands.in).toBeCloseTo(telegraph.impact - w.time, 6);
    w.entities.get(w.weaverId)!.weaver!.resonance = CONTENT.resonance.max;
    stepFor(sim, 1, [{ t: 'crescendo' }]);
    const held = hud(sim).party[0]!.lands!.in;
    stepFor(sim, 60);
    expect(w.field.stasis).toBe(true);
    expect(hud(sim).party[0]!.lands!.in).toBeCloseTo(held, 6);
  });
});

describe('Stasis on the HUD', () => {
  it('the read-out, the chip, and techniques free of cooldown at the content’s discount', () => {
    const path = ['foresight', 'echo_ward', 'temporal_mastery', 'eternal_moment'];
    const { sim, w } = chronoSim(path);
    const weaver = w.entities.get(w.weaverId)!.weaver!;
    stepFor(sim, 1, [{ t: 'tech', id: 'chime', point: { x: 0, z: -3 } }]);
    weaver.resonance = CONTENT.resonance.max;
    stepFor(sim, 1, [{ t: 'crescendo' }]);
    const h = hud(sim);
    expect(h.weaver.stasis).toBe(true);
    expect(h.weaver.crescendoName).toBe(CHRONO.crescendoName);
    const total = V.stasis! + callingOption('eternal_moment').values.seconds!;
    expect(h.weaver.crescendoTotal).toBeCloseTo(total, 6);
    expect(stasisSeconds('chronomancer', path)).toBeCloseTo(total, 6);
    expect(h.calling!.stasis).toBe(true);
    expect(h.calling!.crescendoName).toBe('Stasis');
    const mult = 1 - V.cost! / 100;
    expect(stasisCostMult('chronomancer')).toBeCloseTo(mult, 9);
    for (const t of h.weaver.techniques) {
      expect(t.free).toBe(true);
      expect(t.cost).toBeCloseTo(t.baseCost * mult, 9);
    }
    // Chime is still cooling, but in Stasis it can be cast: the HUD calls it free.
    expect(h.weaver.techniques.find((t) => t.key === 'chime')!.remaining).toBeGreaterThan(0);
    // The sim charges what the HUD says.
    weaver.spirit = 100;
    stepFor(sim, 1, [{ t: 'tech', id: 'ward', slot: 0 }]);
    expect(100 - weaver.spirit).toBeCloseTo(CONTENT.techniques.ward.cost * mult, 6);
    // The coach stays quiet in the Training Grounds; the lab's staged fight is a skirmish.
    const stasis = evaluateHints(mockHud('chrono-stasis')).find((x) => x.id === 'stasis')!;
    expect(stasis.text).toMatch(new RegExp(`no cooldowns and cost ${V.cost}% less`));
  });

  it('without the Chronomancer, no Stasis and no discount', () => {
    const { sim } = chronoSim([], { id: 'luminary' });
    const h = hud(sim);
    expect(h.weaver.stasis).toBe(false);
    expect(h.weaver.crescendoName).toBe(CONTENT.crescendo.name);
    expect(h.weaver.crescendoTotal).toBe(CONTENT.crescendo.duration);
    expect(h.weaver.techniques.every((t) => !t.free && t.cost === t.baseCost)).toBe(true);
    expect(h.calling!.revive).toBeNull();
    expect(stasisCostMult('luminary')).toBe(1);
  });
});

describe('Temporal Mastery', () => {
  it('the chip says ready or when; Glide’s button says what it would bring back', () => {
    const path = ['quickened', 'echo_ward', 'temporal_mastery'];
    const { sim } = chronoSim(path);
    stepFor(sim, 1, [{ t: 'tech', id: 'chime', point: { x: 0, z: -3 } }]);
    const ready = hud(sim);
    expect(ready.weaver.mastery).toMatchObject({ ready: true, resets: 'chime' });
    expect(ready.calling!.mastery).toMatchObject({ ready: true });
    stepFor(sim, 1, [{ t: 'glide', x: 1, z: 0 }]);
    const after = hud(sim);
    const cooldown = callingOption('temporal_mastery').values.cooldown!;
    expect(after.weaver.mastery!.ready).toBe(false);
    expect(after.weaver.mastery!.total).toBe(cooldown);
    expect(after.calling!.mastery!.remaining).toBeGreaterThan(cooldown - 0.1);
    expect(callingHudLabel(after.calling!)).toMatch(new RegExp(`back in ${cooldown} s`));
    // Not on the path: no state.
    expect(hud(chronoSim().sim).weaver.mastery).toBeNull();
  });
});

describe('the coach', () => {
  it('Rewind’s hints come on his runs only, and the right one at the right moment', () => {
    const ids = (s: Parameters<typeof mockHud>[0]) => evaluateHints(mockHud(s)).map((x) => x.id);
    const revive = evaluateHints(mockHud('chrono-revive'));
    expect(revive[0]!.id).toBe('rewind-up');
    expect(revive[0]!.text).toMatch(
      /^Kael just went down — press \{F\}: Rewind stands them back up, once a run/,
    );
    expect(ids('chrono-rewind')[0]).toBe('rewind-back');
    expect(ids('chrono-spent')).not.toContain('rewind-up');
    // Vexis just fell; Kael (threaded) is down too long: thread Vexis, then F.
    const reach = evaluateHints(mockHud('chrono-reach')).find((x) => x.id === 'rewind-up')!;
    expect(reach.text).toMatch(/^Vexis just went down — press \{3\}, then \{F\}/);
    for (const s of ['calm', 'crisis', 'luminary', 'martyr-bear', 'chrono-rewind'] as const)
      expect(ids(s)).not.toContain('lethal-reel');
    for (const s of ['calm', 'crisis', 'luminary', 'martyr-coach'] as const)
      expect(ids(s).some((id) => id.startsWith('rewind') || id === 'stasis')).toBe(false);
    // Strays: Rewind sends a hero back, not to you.
    for (const h of evaluateHints(mockHud('chrono-rewind')).filter((x) => x.id === 'strayed'))
      expect(h.text).not.toMatch(/Reel/);
  });

  it('the lab’s scenes come from real sims that reach their moments', () => {
    const scenarios: ChronoScenario[] = [
      'chrono-rewind',
      'chrono-revive',
      'chrono-spent',
      'chrono-reach',
      'chrono-saved',
      'chrono-stasis',
      'chrono-boss',
    ];
    for (const s of scenarios) expect(chronoStage(s).reached, s).toBe(true);
    expect(
      mockHud('chrono-saved').weaver.techniques.find((t) => t.key === 'reel')!.remaining,
    ).toBeGreaterThan(0);
    // The boss bar names every hero the frames mark with it (a link picks two).
    const boss = mockHud('chrono-boss');
    const next = boss.boss!.foreseen!;
    const marked = boss.party.filter((p) =>
      p.foreseen.some((f) => f.name === next.name && f.aimed),
    );
    expect(marked.length).toBeGreaterThan(0);
    expect(next.target!.split(' & ').sort()).toEqual(marked.map((p) => p.name).sort());
  });
});

describe('the Chronomancer’s words', () => {
  const chrono = { id: 'chronomancer', path: [null, null, null, null] };
  it('the Result line: what Rewind gave back and the heroes it stood up', () => {
    expect(
      callingResultLine(
        { callingAmplified: 0, callingShielded: 0, callingRewound: 1240, callingRevived: 1 },
        chrono,
      ),
    ).toBe('Rewind gave back 1,240 life · stood 1 hero back up');
    expect(
      callingResultLine(
        { callingAmplified: 0, callingShielded: 0, callingRewound: 300, callingRevived: 0 },
        chrono,
      ),
    ).toBe('Rewind gave back 300 life');
    expect(
      callingResultLine(
        { callingAmplified: 0, callingShielded: 0, callingRewound: 0, callingRevived: 2 },
        chrono,
      ),
    ).toBe('Rewind stood 2 heroes back up');
    expect(
      callingResultLine(
        { callingAmplified: 0, callingShielded: 0, callingRewound: 0, callingRevived: 0 },
        chrono,
      ),
    ).toBeNull();
    const line = callingLine(
      { callingAmplified: 0, callingShielded: 0, callingRewound: 5, callingRevived: 0 },
      chrono,
    )!;
    expect(line).toMatchObject({ icon: 'rewind', calling: true, text: 'Rewind gave back 5 life.' });
  });

  it('a Chronomancer run’s Result: his line after the songs, Rewind for Reel, then the tier', () => {
    const run = chronoResultRun();
    const r = run.lastResult!;
    expect(r.stats.callingRewound).toBeGreaterThan(0);
    const lines = statLines(r, run.calling);
    const i = lines.findIndex((l) => l.calling);
    expect(i).toBe(2);
    expect(lines[i]!.text).toMatch(/^Rewind gave back [\d,]+ life · stood 1 hero back up\.$/);
    expect(lines.some((l) => /^Rewind took heroes out of danger/.test(l.text))).toBe(true);
    expect(lines.some((l) => /Reeled/.test(l.text))).toBe(false);
    // The death recap's ready techniques: Reel's slot is Rewind.
    expect(r.deaths[0]!.readyTechniques).toContain('reel');
    expect(readyName('reel', run.calling!.id)).toBe('Rewind');
    expect(readyName('reel', 'luminary')).toBe('Reel');
    expect(readyName('ward', run.calling!.id)).toBe(CONTENT.techniques.ward.name);
    expect(nextStep(run)).toMatch(/Calling grows/);
  });

  it('the Summary: his path and totals, the revive once a run', () => {
    const run = chronoSummaryRun();
    expect(run.calling!.path).toEqual([...CHRONO_PICKS]);
    const totals = Run.runTotals(run);
    expect(totals.callingRewound).toBeGreaterThan(0);
    expect(totals.callingRevived).toBe(1);
    expect(callingParts(totals, run.calling).map((p) => p.label)).toEqual([
      'Rewound',
      'Stood back up',
    ]);
    expect(run.calling!.reviveSpent).toBe(true);
    expect(reviveSpentLine(run.calling)).toMatch(/its revive is spent/);
    expect(reviveSpentLine({ id: 'chronomancer', reviveSpent: false })).toBeNull();
    expect(reviveSpentLine({ id: 'martyr', reviveSpent: true })).toBeNull();
    expect(callingNothingText('chronomancer', 'B', 'F')).toMatch(
      new RegExp(`press F within ${V.rewind} s`),
    );
  });

  it('Reel’s slot is named Rewind wherever it shows, from content', () => {
    expect(rewindsFor('chronomancer')).toBe(true);
    expect(rewindsFor('martyr')).toBe(false);
    expect(rewindsFor(null)).toBe(false);
    expect(rewindSeconds('chronomancer')).toBe(V.rewind);
    expect(techniqueName('reel', 'chronomancer')).toBe(REWIND_NAME);
    expect(techniqueName('reel', 'luminary')).toBe(CONTENT.techniques.reel.name);
    expect(techniqueName('chime', 'chronomancer')).toBe(CONTENT.techniques.chime.name);
    expect(spiritBudget(GUARDIAN, 'spirit', 'chronomancer').techniques.map((t) => t.name)).toEqual([
      CONTENT.techniques.ward.name,
      CONTENT.techniques.chime.name,
      REWIND_NAME,
    ]);
  });

  it('the Crescendo line, the passive’s name and the tier screen', () => {
    const c = crescendoLine(CHRONO);
    expect(c.name).toBe('Stasis');
    expect(c.lead).toBe(false);
    expect(c.rest.startsWith(' replaces Sunrise')).toBe(true);
    expect(passiveName('chronomancer')).toMatch(/Rewind/);
    const offer = chronoOfferRun(1);
    expect(offer.callingOffer!.options).toEqual(CHRONO.tiers[1]!.options.map((o) => o.id));
  });

  it('every option has its design axis; the legend has his three', () => {
    for (const t of CHRONO.tiers)
      for (const o of t.options) expect(optionAxes(o.id).length, o.id).toBe(1);
    expect(new Set(callingAxes(CHRONO))).toEqual(new Set(['foresee', 'turns', 'undo']));
    const axis = (id: string) => optionAxes(id)[0];
    expect(['foresight', 'echo_ward', 'slow_dance'].map(axis)).toEqual([
      'foresee',
      'foresee',
      'foresee',
    ]);
    expect(['quickened', 'temporal_mastery', 'eternal_moment'].map(axis)).toEqual([
      'turns',
      'turns',
      'turns',
    ]);
    expect(['borrowed_time', 'paradox'].map(axis)).toEqual(['undo', 'undo']);
    // His three axes read apart in every colour-vision mode.
    const colors = (['foresee', 'turns', 'undo'] as const).map((a) => AXIS_LOOK[a].color);
    for (const vision of COLOR_VISIONS)
      for (let i = 0; i < colors.length; i++)
        for (let j = i + 1; j < colors.length; j++)
          expect(
            deltaE(simulateVision(colors[i]!, vision), simulateVision(colors[j]!, vision)),
          ).toBeGreaterThanOrEqual(20);
  });
});

describe('the Chronomancer’s look and glyphs', () => {
  it('a glyph for the emblem and every option icon; Rewind and Stasis kit icons', () => {
    expect(CALLING_GLYPHS[CHRONO.icon]).toBeTruthy();
    for (const t of CHRONO.tiers)
      for (const o of t.options) expect(CALLING_GLYPHS[o.icon], o.icon).toBeTruthy();
    expect(PATHS.rewind).toBeTruthy();
    expect(PATHS.stasis).toBeTruthy();
    expect(CALLING_LOOK.chronomancer).toMatchObject({ icon: 'rewind', crescendoIcon: 'stasis' });
  });

  it('his steel reads apart from both Callings, Mend, Empower and the relic rarities, in every palette', () => {
    const steel = CALLING_LOOK.chronomancer!.color;
    const fixed = [
      CALLING_LOOK.luminary!.color,
      CALLING_LOOK.luminary!.light,
      CALLING_LOOK.martyr!.color,
      // Mend's teal and Empower's gold as the standard palette has them.
      VISION_PALETTES.normal.mend,
      VISION_PALETTES.normal.empower,
      // RELIC_RARITY in src/ui/kit/RelicGlyph.tsx (a .tsx module the node config can't load).
      '#cbd5e1',
      '#60a5fa',
      '#fdba74',
      '#fb7185',
    ];
    for (const vision of COLOR_VISIONS) {
      // ...and as each colour-vision mode swaps them in.
      const p = VISION_PALETTES[vision];
      for (const other of [...fixed, p.mend, p.heal, p.empower, p.amp])
        expect(
          deltaE(simulateVision(steel, vision), simulateVision(other, vision)),
          `${steel} vs ${other} (${vision})`,
        ).toBeGreaterThanOrEqual(20);
    }
  });
});

describe('Rank 9', () => {
  it('opens the Chronomancer; the card, the allowance and the glyph follow content', () => {
    expect(unlockRank('calling', 'chronomancer')).toBe(CHRONO.unlockRank);
    expect(MAX_RANK).toBeGreaterThanOrEqual(CHRONO.unlockRank);
    const card = mockRankUps([CHRONO.unlockRank]);
    expect(card[0]!.unlocks.map((u) => u.id)).toContain('calling.chronomancer');
    expect(unlockIcon(UNLOCKS.find((u) => u.id === 'calling.chronomancer')!)).toBe('rewind');
    expect(allowanceFor(CHRONO.unlockRank - 1).callings.has('chronomancer')).toBe(false);
    expect(allowanceFor(CHRONO.unlockRank).callings.has('chronomancer')).toBe(true);
    expect(EVERYTHING.callings.has('chronomancer')).toBe(true);
    expect(
      Run.setCalling(Run.newRun(3), 'chronomancer', allowanceFor(CHRONO.unlockRank - 1)).calling,
    ).toBeNull();
    // The Rank before his: the panel says what the next one opens.
    const before = rankPanel({ xp: RANK_XP[CHRONO.unlockRank - 2]!, runs: 1, wins: 0 });
    expect(before.nextRank).toBe(CHRONO.unlockRank);
    expect(before.next.map((u) => u.id)).toContain('calling.chronomancer');
  });
});
