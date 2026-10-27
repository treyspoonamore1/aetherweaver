/**
 * Phase 3e: the Chronomancer in the sim (docs/phase-3e.md). Rewind, Stasis, Foresight and each
 * option on the path.
 */
import { describe, expect, it } from 'vitest';
import { CONTENT, callingOption } from '../../src/content';
import type { Command, Telegraph } from '../../src/sim';
import { dealDamage, heal, shieldOf } from '../../src/sim/combat/health';
import { perfectWindow } from '../../src/sim/combat/telegraphs';
import { pastOf } from '../../src/sim/systems/rewind';
import type { World } from '../../src/sim/world';
import {
  hurt,
  ofType,
  resolvedOf,
  sandbox,
  spawn,
  stepFor,
  stepUntil,
  telegraphOn,
  worldOf,
} from './helpers';

const chrono = (...path: string[]) => ({ calling: { id: 'chronomancer', path } });
const value = (option: string, key: string) => callingOption(option).values[key]!;
const passive = (key: string) =>
  CONTENT.callings.find((c) => c.id === 'chronomancer')!.values[key]!;
/** Guardian: Fortissimo on the beam, Sostenuto in the field. */
const GUARDIAN = [
  { auras: ['fortissimo'], ornaments: [] },
  { auras: ['sostenuto'], ornaments: [] },
];
const REWIND: Command = { t: 'tech', id: 'reel' };
const CRESCENDO: Command = { t: 'crescendo' };
const weaverOf = (w: World) => w.entities.get(w.weaverId)!;
const heroAt = (w: World, slot: number) => w.entities.get(w.party[slot]!)!;

/** A Chronomancer sandbox with Kael threaded. */
function chronomancer(path: string[] = [], chords?: typeof GUARDIAN) {
  const sim = sandbox({ ...(chords ? { chords } : {}), ...chrono(...path) });
  stepFor(sim, 2, [{ t: 'thread', slot: 0 }]);
  sim.drainEvents();
  return { sim, w: worldOf(sim) };
}

/** A circle of damage landing in `delay` s (as a Volatile enemy's Shatter is built). */
function burst(w: World, x: number, z: number, r: number, delay = 1): Telegraph {
  const t: Telegraph = {
    id: w.internal.nextTelegraphId++,
    owner: -1,
    target: null,
    attackId: 'volatile_burst',
    name: 'Shatter',
    kind: 'burst',
    shape: { kind: 'circle', x, z, r },
    start: w.time,
    impact: w.time + delay,
    perfectFrom: w.time + delay - perfectWindow(w),
    damage: 300,
    pctMaxHp: 0,
    effect: 'damage',
    answers: ['move'],
    severity: 'normal',
  };
  w.telegraphs.push(t);
  return t;
}

/** Stops time with full Resonance; returns the Crescendo's events. */
function stopTime(sim: ReturnType<typeof sandbox>, w: World) {
  weaverOf(w).weaver!.resonance = CONTENT.resonance.max;
  return stepFor(sim, 1, [CRESCENDO]);
}

describe('the passive', () => {
  it('a longer Perfect window, telegraph timers, Rewind and Stasis', () => {
    const plain = worldOf(sandbox());
    const { w } = chronomancer();
    expect(perfectWindow(w) - perfectWindow(plain)).toBeCloseTo(passive('perfect'), 9);
    expect(w.calling).toMatchObject({ timers: true, rewind: true, crescendo: 'stasis' });
    expect(plain.calling).toBeNull();
  });
});

describe('Rewind', () => {
  it('takes Reel’s slot: back to where they stood 3 s ago, with the life they had', () => {
    const { sim, w } = chronomancer();
    const kael = heroAt(w, 0);
    stepFor(sim, 200);
    hurt(sim, 0, 500);
    stepFor(sim, 60);
    const past = { ...pastOf(kael)! };
    const hp = kael.health!.hp;
    expect(past.hp).toBeGreaterThan(hp);
    const events = stepFor(sim, 1, [REWIND]);
    expect(ofType(events, 'techniqueCast').map((e) => e.technique)).toEqual(['rewind']);
    expect(ofType(events, 'reeled')).toHaveLength(0);
    const r = ofType(events, 'rewound')[0]!;
    expect(r).toMatchObject({ target: kael.id, toX: past.x, toZ: past.z, revived: false });
    expect(r.restored).toBeCloseTo(past.hp - hp, 6);
    expect(w.ledger.calling.rewound).toBeCloseTo(r.restored, 6);
    const healed = ofType(events, 'healApplied').find((e) => e.via === 'rewind');
    expect(healed?.target).toBe(kael.id);
    expect(weaverOf(w).weaver!.cooldownTotals.reel).toBeCloseTo(passive('cooldown'), 9);
    // Once is all, for a while.
    const again = stepFor(sim, 1, [REWIND]);
    expect(ofType(again, 'techniqueRejected')[0]).toMatchObject({
      technique: 'rewind',
      reason: 'cooldown',
    });
  });

  it('without the Chronomancer, the same key still Reels', () => {
    const sim = sandbox();
    stepFor(sim, 2, [{ t: 'thread', slot: 0 }]);
    const events = stepFor(sim, 1, [REWIND]);
    expect(ofType(events, 'reeled')).toHaveLength(1);
    expect(ofType(events, 'rewound')).toHaveLength(0);
  });

  it('never lowers life: healing since is kept, and the place still goes back', () => {
    const { sim, w } = chronomancer();
    const kael = heroAt(w, 0);
    stepFor(sim, 30);
    hurt(sim, 0, 800);
    stepFor(sim, 60);
    heal(w, kael, 800, 'other');
    stepFor(sim, 150);
    const past = { ...pastOf(kael)! };
    expect(past.hp).toBeLessThan(kael.health!.hp);
    const hp = kael.health!.hp;
    const events = stepFor(sim, 1, [REWIND]);
    expect(ofType(events, 'rewound')[0]).toMatchObject({ restored: 0, toX: past.x, toZ: past.z });
    expect(kael.health!.hp).toBeGreaterThanOrEqual(hp);
  });

  it('stands up a hero who went down in that time, with the life they had', () => {
    const { sim, w } = chronomancer();
    const kael = heroAt(w, 0);
    stepFor(sim, 200);
    const amount = 1e5;
    dealDamage(w, kael, { source: null, sourceName: 'Toll Cleave', amount, telegraph: null });
    expect(kael.health!.downed).toBe(true);
    stepFor(sim, 60);
    const past = { ...pastOf(kael)! };
    expect(past.up).toBe(true);
    const events = stepFor(sim, 1, [REWIND]);
    expect(kael.health!.downed).toBe(false);
    const r = ofType(events, 'rewound')[0]!;
    expect(r.revived).toBe(true);
    expect(r.restored).toBeCloseTo(past.hp, 6);
    expect(ofType(events, 'revived').map((e) => e.hero)).toEqual([kael.id]);
    expect(w.ledger.calling.revived).toBe(1);
    expect(w.ledger.saves.map((s) => [s.cause, s.attack])).toEqual([['rewind', 'Toll Cleave']]);
  });

  it('can’t reach a hero who has been down longer than it reaches back', () => {
    const { sim, w } = chronomancer();
    // Lyra, not threaded: Mend isn't reviving her meanwhile.
    const lyra = heroAt(w, 1);
    dealDamage(w, lyra, { source: null, sourceName: 't', amount: 1e5, telegraph: null });
    stepFor(sim, 200);
    const events = stepFor(sim, 1, [{ t: 'tech', id: 'reel', slot: 1 }]);
    expect(ofType(events, 'techniqueRejected')[0]).toMatchObject({
      technique: 'rewind',
      reason: 'target',
    });
    expect(lyra.health!.downed).toBe(true);
    expect(weaverOf(w).weaver!.cooldowns.reel).toBe(0);
  });

  it('out of an attack’s shape is a dodge, as for Reel', () => {
    const { sim, w } = chronomancer();
    const { telegraph } = telegraphOn('bell_brute', 'Toll Cleave', 0, 2.5, sim, true);
    const kael = heroAt(w, 0);
    // Three seconds ago he stood well clear of it.
    for (const s of kael.hero!.past) Object.assign(s, { x: 0, z: 9 });
    stepFor(sim, 1, [REWIND]);
    const { resolved } = resolvedOf(sim, telegraph.id);
    expect(resolved.find((r) => r.target === kael.id)?.outcome).toBe('dodged');
    expect(w.ledger.reels).toBe(1);
  });
});

describe('Stasis', () => {
  it('replaces Sunrise: every enemy stands still, and nothing it set going gets closer', () => {
    const { sim, w } = chronomancer();
    const { telegraph } = telegraphOn('bell_brute', 'Toll Cleave', 0, 2.5, sim, true);
    const brute = w.entities.get(telegraph.owner)!;
    const left = telegraph.impact - w.time;
    const events = stopTime(sim, w);
    expect(w.field).toMatchObject({ stasis: true, crescendo: false });
    const start = ofType(events, 'crescendoStart')[0]!;
    expect(start.calling).toBe('Stasis');
    expect(start.duration).toBeCloseTo(passive('stasis'), 6);
    expect(ofType(events, 'healApplied').filter((e) => e.via === 'other')).toHaveLength(0);
    const at = { x: brute.x, z: brute.z, hp: brute.health!.hp };
    const cooldowns = [...brute.enemy!.specialCooldowns];
    stepFor(sim, 100);
    expect(w.field.stasis).toBe(true);
    expect(telegraph.impact - w.time).toBeCloseTo(left, 6);
    expect(brute.x).toBeCloseTo(at.x, 3);
    expect(brute.z).toBeCloseTo(at.z, 3);
    expect(brute.enemy!.specialCooldowns).toEqual(cooldowns);
    // The heroes don't wait.
    expect(brute.health!.hp).toBeLessThan(at.hp);
    // Afterwards it goes on and lands.
    const after = stepFor(sim, 300);
    expect(w.field.stasis).toBe(false);
    expect(ofType(after, 'crescendoEnd')).toHaveLength(1);
    expect(ofType(after, 'telegraphResolved').some((r) => r.telegraph === telegraph.id)).toBe(true);
  });

  it('a mark an enemy left waits with its attack', () => {
    const { sim, w } = chronomancer();
    const { telegraph } = telegraphOn('lamenter', 'Dirge', 1, 6, sim, true);
    const marked = w.entities.get((telegraph.shape as { target: number }).target)!;
    const dirge = () => marked.health!.statuses.find((s) => s.id === 'dirge')!.remaining;
    stopTime(sim, w);
    const before = dirge();
    stepFor(sim, 120);
    expect(dirge()).toBe(before);
  });

  it('techniques have no cooldowns and cost less Spirit while it lasts', () => {
    const { sim, w } = chronomancer();
    const weaver = weaverOf(w).weaver!;
    stopTime(sim, w);
    weaver.wardCharges = 0;
    weaver.cooldowns.chime = 5;
    weaver.spirit = 100;
    const tech = CONTENT.techniques;
    const ward = stepFor(sim, 1, [{ t: 'tech', id: 'ward', slot: 1 }]);
    expect(ofType(ward, 'techniqueCast')).toHaveLength(1);
    expect(weaver.wardCharges).toBe(0);
    expect(shieldOf(heroAt(w, 1).health!, 'ward')?.stasis).toBe(true);
    const spent = 100 - weaver.spirit;
    expect(spent).toBeGreaterThan(tech.ward.cost * (1 - passive('cost') / 100) - 0.5);
    expect(spent).toBeLessThan(tech.ward.cost * (1 - passive('cost') / 100) + 0.01);
    const chime = stepFor(sim, 1, [{ t: 'tech', id: 'chime', point: { x: 0, z: 0 } }]);
    expect(ofType(chime, 'chimeLaunched')).toHaveLength(1);
    expect(weaver.cooldowns.chime).toBeLessThan(5);
  });

  it('a Ward cast during it counts from the moment time stopped', () => {
    const run = (inWindow: boolean, path: string[] = []) => {
      const { sim, w } = chronomancer(path);
      const { telegraph } = telegraphOn('bell_brute', 'Toll Cleave', 0, 2.5, sim, true);
      const weaver = weaverOf(w).weaver!;
      const stopAt = inWindow ? telegraph.perfectFrom + 0.05 : telegraph.perfectFrom - 0.3;
      while (w.time < stopAt) stepFor(sim, 1);
      const started = stopTime(sim, w);
      stepFor(sim, 150);
      expect(w.field.stasis).toBe(true);
      weaver.spirit = 100;
      stepFor(sim, 1, [{ t: 'tech', id: 'ward', slot: 0 }]);
      const { events } = resolvedOf(sim, telegraph.id);
      return { events, started };
    };
    // Inside its window when time stopped: Perfect, however late in Stasis the Ward came.
    expect(ofType(run(true).events, 'perfectWard')).toHaveLength(1);
    // Before its window: an ordinary Ward.
    expect(ofType(run(false).events, 'perfectWard')).toHaveLength(0);
    // Eternal Moment: longer, and that Perfect gives Resonance.
    const path = ['quickened', 'echo_ward', 'temporal_mastery', 'eternal_moment'];
    const eternal = run(true, path);
    expect(ofType(eternal.started, 'crescendoStart')[0]!.duration).toBeCloseTo(
      passive('stasis') + value('eternal_moment', 'seconds'),
      6,
    );
    const gained = ofType(eternal.events, 'resonanceGained').filter(
      (e) => e.reason === 'eternal moment',
    );
    expect(gained.map((e) => e.amount)).toEqual([value('eternal_moment', 'resonance')]);
  });
});

describe('the path', () => {
  it('Quickened: every technique recovers faster', () => {
    const cooldowns = (path: string[]) => {
      const { sim, w } = chronomancer(path);
      const weaver = weaverOf(w).weaver!;
      stepFor(sim, 1, [{ t: 'tech', id: 'chime', point: { x: 0, z: 0 } }]);
      stepFor(sim, 1, [REWIND]);
      stepFor(sim, 1, [{ t: 'tech', id: 'ward', slot: 0 }]);
      stepFor(sim, 1, [{ t: 'glide', x: 1, z: 0 }]);
      return { ...weaver.cooldownTotals };
    };
    const plain = cooldowns([]);
    const quick = cooldowns(['quickened']);
    const cut = 1 - value('quickened', 'pct') / 100;
    for (const key of ['ward', 'chime', 'reel', 'glide'] as const)
      expect(quick[key] / plain[key]).toBeCloseTo(cut, 9);
  });

  it('Foresight: an attack is seen a second before it begins, a random target kept', () => {
    const { sim, w } = chronomancer(['foresight']);
    const lyra = heroAt(w, 1);
    stepFor(sim, 1, [spawn('lamenter', lyra.x, lyra.z - 6)]);
    for (const e of w.entities.list()) if (e.enemy && e.health) e.health.hp = e.health.maxHp = 1e6;
    const seen = stepUntil(sim, (ev) => ev.some((e) => e.type === 'foreseen'), 900);
    const first = ofType(seen, 'foreseen')[0]!;
    expect(first.name).toBe('Dirge');
    expect(first.target).not.toBeNull();
    expect(first.at - w.time).toBeLessThanOrEqual(value('foresight', 'seconds') + 1e-6);
    const lamenter = w.entities.get(first.enemy)!;
    expect(lamenter.enemy!.foreseen).toMatchObject({ name: 'Dirge', target: first.target });
    // (A stun puts it off: it's foreseen again when the Lamenter can act.)
    const began = stepUntil(sim, (ev) =>
      ev.some((e) => e.type === 'telegraphStarted' && e.name === 'Dirge'),
    );
    const last = ofType([...seen, ...began], 'foreseen').at(-1)!;
    const started = ofType(began, 'telegraphStarted').find((e) => e.name === 'Dirge')!;
    expect(started.target).toBe(last.target);
    expect(started.start - last.at).toBeLessThan(0.1);
    expect(lamenter.enemy!.foreseen).toBeNull();
  });

  it('without Foresight, nothing is foreseen', () => {
    const { sim, w } = chronomancer(['quickened']);
    const lyra = heroAt(w, 1);
    stepFor(sim, 1, [spawn('lamenter', lyra.x, lyra.z - 6)]);
    const events = stepFor(sim, 600);
    expect(ofType(events, 'foreseen')).toHaveLength(0);
    expect(w.entities.list().every((e) => !e.enemy?.foreseen)).toBe(true);
  });

  it('Echo Ward: a Perfect Ward comes back a second later at half strength', () => {
    const { sim, w } = chronomancer(['quickened', 'echo_ward']);
    const kael = heroAt(w, 0);
    const { telegraph } = telegraphOn('bell_brute', 'Toll Cleave', 0, 2.5, sim, true);
    while (w.time < telegraph.perfectFrom + 0.05) stepFor(sim, 1);
    stepFor(sim, 1, [{ t: 'tech', id: 'ward', slot: 0 }]);
    const cast = shieldOf(kael.health!, 'ward')!.max;
    const { events } = resolvedOf(sim, telegraph.id);
    expect(ofType(events, 'perfectWard')).toHaveLength(1);
    const later = stepFor(sim, 70);
    expect(ofType(later, 'echoWard').map((e) => e.amount)).toEqual([
      cast * (value('echo_ward', 'pct') / 100),
    ]);
    expect(shieldOf(kael.health!, 'ward')?.echo).toBe(true);
  });

  it('an echo never echoes, and never replaces a stronger Ward', () => {
    const { sim, w } = chronomancer(['quickened', 'echo_ward']);
    const kael = heroAt(w, 0);
    const weaver = weaverOf(w).weaver!;
    const { telegraph } = telegraphOn('bell_brute', 'Toll Cleave', 0, 2.5, sim, true);
    while (w.time < telegraph.perfectFrom + 0.05) stepFor(sim, 1);
    stepFor(sim, 1, [{ t: 'tech', id: 'ward', slot: 0 }]);
    shieldOf(kael.health!, 'ward')!.echo = true;
    resolvedOf(sim, telegraph.id);
    expect(w.internal.echoWards).toHaveLength(0);
    // A real Perfect schedules its echo; a fresh Ward cast meanwhile is stronger, so it stays.
    const next = stepUntil(sim, (ev) =>
      ev.some((e) => e.type === 'telegraphStarted' && e.name === 'Toll Cleave'),
    );
    const id = ofType(next, 'telegraphStarted').find((e) => e.name === 'Toll Cleave')!.telegraph;
    const second = w.telegraphs.find((t) => t.id === id)!;
    weaver.wardCharges = 2;
    weaver.spirit = 100;
    while (w.time < second.perfectFrom + 0.05) stepFor(sim, 1);
    stepFor(sim, 1, [{ t: 'tech', id: 'ward', slot: 0 }]);
    resolvedOf(sim, second.id);
    expect(w.internal.echoWards).toHaveLength(1);
    stepFor(sim, 1, [{ t: 'tech', id: 'ward', slot: 0 }]);
    const fresh = shieldOf(kael.health!, 'ward')!;
    const later = stepFor(sim, 70);
    expect(ofType(later, 'echoWard')).toHaveLength(0);
    expect(shieldOf(kael.health!, 'ward')).toBe(fresh);
  });

  it('Borrowed Time: Rewind fills part of that hero’s Solo', () => {
    const { sim, w } = chronomancer(['quickened', 'borrowed_time']);
    const kael = heroAt(w, 0);
    kael.hero!.solo = 10;
    stepFor(sim, 1, [REWIND]);
    expect(kael.hero!.solo).toBeGreaterThanOrEqual(10 + value('borrowed_time', 'pct'));
  });

  it('Temporal Mastery: Glide resets the last technique’s cooldown, once in a while', () => {
    const { sim, w } = chronomancer(['quickened', 'echo_ward', 'temporal_mastery']);
    const weaver = weaverOf(w).weaver!;
    stepFor(sim, 1, [{ t: 'tech', id: 'chime', point: { x: 0, z: 0 } }]);
    expect(weaver.cooldowns.chime).toBeGreaterThan(0);
    const events = stepFor(sim, 1, [{ t: 'glide', x: 1, z: 0 }]);
    expect(weaver.cooldowns.chime).toBe(0);
    expect(ofType(events, 'temporalMastery').map((e) => e.technique)).toEqual(['chime']);
    // Not again until its own cooldown is over.
    weaver.cooldowns.glide = 0;
    stepFor(sim, 1, [{ t: 'tech', id: 'chime', point: { x: 0, z: 0 } }]);
    stepFor(sim, 1, [{ t: 'glide', x: -1, z: 0 }]);
    expect(weaver.cooldowns.chime).toBeGreaterThan(0);
    // Rewind is named as itself; Ward gets a charge back.
    stepFor(sim, Math.ceil(value('temporal_mastery', 'cooldown') * 60));
    weaver.cooldowns.glide = 0;
    stepFor(sim, 1, [REWIND]);
    const rewound = stepFor(sim, 1, [{ t: 'glide', x: 1, z: 0 }]);
    expect(ofType(rewound, 'temporalMastery').map((e) => e.technique)).toEqual(['rewind']);
    expect(weaver.cooldowns.reel).toBe(0);
    stepFor(sim, Math.ceil(value('temporal_mastery', 'cooldown') * 60));
    weaver.cooldowns.glide = 0;
    weaver.wardCharges = 1;
    weaver.spirit = 100;
    stepFor(sim, 1, [{ t: 'tech', id: 'ward', slot: 0 }]);
    expect(weaver.wardCharges).toBe(0);
    stepFor(sim, 1, [{ t: 'glide', x: -1, z: 0 }]);
    expect(weaver.wardCharges).toBe(1);
  });

  it('Slow Dance: enemies in the field wind up longer, the Perfect window with them', () => {
    const windup = (path: string[]) => {
      const { sim } = chronomancer(path, GUARDIAN);
      const { telegraph } = telegraphOn('bell_brute', 'Toll Cleave', 0, 2.5, sim, true);
      return {
        windup: telegraph.impact - telegraph.start,
        window: telegraph.impact - telegraph.perfectFrom,
      };
    };
    const plain = windup(['quickened']);
    const dance = windup(['quickened', 'echo_ward', 'slow_dance']);
    const longer = 1 + value('slow_dance', 'windup') / 100;
    expect(dance.windup / plain.windup).toBeCloseTo(longer, 6);
    expect(dance.window / plain.window).toBeCloseTo(longer, 6);
  });

  it('Slow Dance: enemies in the field move slower', () => {
    const pace = (path: string[]) => {
      const { sim, w } = chronomancer(path, GUARDIAN);
      const weaver = weaverOf(w);
      // Inside the field, a few steps short of Kael: it walks the rest.
      stepFor(sim, 1, [spawn('bell_brute', weaver.x, weaver.z - w.field.radius * 0.9)]);
      const brute = w.entities.list().find((e) => e.enemy)!;
      let fastest = 0;
      for (let i = 0; i < 90; i++) {
        stepFor(sim, 1);
        expect(brute.enemy!.inField).toBe(true);
        fastest = Math.max(fastest, Math.hypot(brute.vx, brute.vz));
      }
      return fastest;
    };
    const plain = pace(['quickened']);
    const dance = pace(['quickened', 'echo_ward', 'slow_dance']);
    expect(dance / plain).toBeCloseTo(1 - value('slow_dance', 'speed') / 100, 1);
  });

  it('Paradox: Rewind cancels a mark on the hero', () => {
    const path = ['quickened', 'echo_ward', 'temporal_mastery', 'paradox'];
    const { sim, w } = chronomancer(path);
    const { telegraph } = telegraphOn('lamenter', 'Dirge', 1, 6, sim, true);
    const marked = w.entities.get((telegraph.shape as { target: number }).target)!;
    const answered = w.ledger.telegraphsAnswered;
    const events = stepFor(sim, 1, [{ t: 'tech', id: 'reel', slot: marked.hero!.slot }]);
    expect(w.telegraphs.some((t) => t.id === telegraph.id)).toBe(false);
    expect(marked.health!.statuses.some((s) => s.id === 'dirge')).toBe(false);
    expect(ofType(events, 'paradox')).toEqual([
      expect.objectContaining({ target: marked.id, cancelled: 1 }),
    ]);
    const resolved = ofType(events, 'telegraphResolved').find((r) => r.telegraph === telegraph.id);
    expect(resolved?.outcome).toBe('cancelled');
    expect(w.ledger.telegraphsAnswered).toBe(answered + 1);
  });

  it('Paradox: an area attack passes the Rewound hero by, and still hits the rest', () => {
    const outcome = (path: string[]) => {
      const { sim, w } = chronomancer(path);
      const kael = heroAt(w, 0);
      const lyra = heroAt(w, 1);
      // Kael doesn't move: where he stood is where he stands.
      for (const s of kael.hero!.past) Object.assign(s, { x: kael.x, z: kael.z });
      const t = burst(w, (kael.x + lyra.x) / 2, (kael.z + lyra.z) / 2, 20);
      stepFor(sim, 1, [REWIND]);
      const { resolved } = resolvedOf(sim, t.id);
      const of = (hero: { id: number }) => resolved.find((r) => r.target === hero.id)?.outcome;
      return { kael: of(kael), lyra: of(lyra) };
    };
    const paradox = ['quickened', 'echo_ward', 'temporal_mastery', 'paradox'];
    expect(outcome(paradox)).toEqual({ kael: 'dodged', lyra: 'hit' });
    expect(outcome(['quickened'])).toEqual({ kael: 'hit', lyra: 'hit' });
  });
});
