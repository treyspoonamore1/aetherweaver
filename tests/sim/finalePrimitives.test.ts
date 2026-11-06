/**
 * The Finale's guarded primitives (docs/phase-5d.md, "The new sim primitives", W1): the Discord
 * verdict (row by row of the victim table), `DamageResult.borne` only while `internal.m4` exists,
 * the `stilled` status and its contract, and the Crescendo hook. Each is inert outside a Finale
 * fight: `isDisabled` reads the same for every other status, on heroes and enemies, and the hooks
 * write nothing in a legacy encounter.
 */
import { describe, expect, it } from 'vitest';
import { attackDef } from '../../src/content';
import {
  CONDUCTOR,
  FORTISSIMO,
  LAMENT,
  BASSO_OSTINATO,
  SHATTER_ARIA,
  ALTO,
} from '../../src/content/crucibleIds';
import { StatusIdSchema } from '../../src/content/schema';
import { makeBot } from '../../src/bots';
import { createSim, type Command, type Sim, type SimConfig, type SimEvent } from '../../src/sim';
import {
  addShield,
  addStatus,
  cleanseAilments,
  dealDamage,
  hasStatus,
  interruptEnemy,
  isDisabled,
  killEnemy,
  removeStatus,
} from '../../src/sim/combat/health';
import { startTelegraph } from '../../src/sim/combat/telegraphs';
import type { Entity, StatusId, Telegraph } from '../../src/sim/state';
import { beginAttack, ensureM4 } from '../../src/sim/systems/enemies';
import { startSolo } from '../../src/sim/systems/solos';
import type { World } from '../../src/sim/world';
import { hero, ofType, sandbox, spawn, stepFor, stepUntil, worldOf } from './helpers';

const NEVER = 1e9;
const KAEL = 0;
const LYRA = 1;
const VEXIS = 2;
const RESONANCE = (value: number): Command => ({ t: 'debug', op: { op: 'setResonance', value } });
const CRESCENDO: Command = { t: 'crescendo' };
const fieldSong = (auras: string[]) => ({
  chords: [
    { auras: [], ornaments: [] },
    { auras, ornaments: [] },
  ],
});

/** The predicate `isDisabled` had before the Finale. */
function oldDisabled(e: Entity): boolean {
  return (
    hasStatus(e, 'stun') ||
    hasStatus(e, 'stagger') ||
    hasStatus(e, 'sleep') ||
    hasStatus(e, 'possessed')
  );
}

const at = (w: World, slot: number) => w.entities.get(w.party[slot]!)!;

/**
 * A sandbox with the Silent Conductor standing far off, tough and still: its script runs (so the
 * verdict and the Crescendo reach it) but casts nothing, and Discord neither swells nor is near
 * Fortissimo Silence.
 */
function stage(config: Partial<SimConfig> = {}) {
  const sim = sandbox(config);
  stepFor(sim, 1, [spawn(CONDUCTOR, 0, -19)]);
  const w = worldOf(sim);
  const boss = w.entities.list().find((e) => e.enemy?.defId === CONDUCTOR)!;
  boss.health!.hp = boss.health!.maxHp = 1e7;
  boss.speed = 0;
  stepUntil(sim, () => w.field.finale !== undefined, 60 * 10);
  freeze(w, boss);
  stepFor(sim, 2);
  return { sim, w, boss };
}

/** The Conductor waits: no special, no Raise or Cue, no swell. */
function freeze(w: World, boss: Entity): void {
  boss.enemy!.specialCooldowns.fill(NEVER);
  boss.enemy!.attackCooldown = NEVER;
  const m4 = ensureM4(w);
  m4.nextCueAt = NEVER;
  m4.nextRaiseAt = NEVER;
  w.field.finale!.discord = { value: 0, rate: 0 };
}

/**
 * A Finale telegraph from the boss: a mark on one hero (its Dirge on them, as `beginAttack` lays
 * it), a circle at their feet, or a raid on every hero.
 */
function strike(
  w: World,
  boss: Entity,
  attackId: string,
  opts: { on?: Entity; shape?: 'mark' | 'circle' | 'raid'; damage?: number; windup?: number },
): Telegraph {
  const attack = attackDef(attackId);
  const windup = opts.windup ?? 1;
  const kind = opts.shape ?? 'mark';
  const on = opts.on ?? null;
  const t = startTelegraph(w, {
    owner: boss,
    attack,
    target: kind === 'raid' ? null : on,
    shape:
      kind === 'raid'
        ? { kind: 'raid' }
        : kind === 'circle'
          ? { kind: 'circle', x: on!.x, z: on!.z, r: 1.5 }
          : { kind: 'mark', target: on!.id },
    windup,
    damage: opts.damage ?? 300,
    pctMaxHp: 0,
  });
  if (kind === 'mark') addStatus(w, on!, 'dirge', windup, boss.id);
  return t;
}

/** Steps until `t` has ended; returns the events on the way. */
function land(sim: Sim, t: Telegraph, before?: (w: World) => void, lead = 2 / 60): SimEvent[] {
  const w = worldOf(sim);
  const events: SimEvent[] = [];
  let primed = false;
  events.push(
    ...stepUntil(
      sim,
      (ev) => {
        if (!primed && before && w.time >= t.impact - lead) {
          primed = true;
          before(w);
        }
        return ev.some((e) => e.type === 'telegraphEnded' && e.telegraph === t.id);
      },
      60 * 10,
    ),
  );
  return events;
}

/** The Discord a telegraph fed (0: answered, or no verdict). */
function fed(events: SimEvent[], t: Telegraph): number {
  return ofType(events, 'discordRose')
    .filter((e) => e.telegraph === t.id)
    .reduce((s, e) => s + e.amount, 0);
}

const SOLO = attackDef(LAMENT).discord!;

describe('the verdict, victim by victim', () => {
  it('a clean hit fails, and feeds the attack’s Discord once', () => {
    const { sim, w, boss } = stage();
    const t = strike(w, boss, LAMENT, { on: at(w, LYRA) });
    const events = land(sim, t);
    expect(fed(events, t)).toBe(SOLO);
    expect(w.field.finale!.discord!.value).toBe(SOLO);
    expect(ofType(events, 'discordRose')[0]).toMatchObject({
      boss: boss.id,
      telegraph: t.id,
      amount: SOLO,
      value: SOLO,
    });
  });

  it('a Perfect Ward, a partial Ward and the dome answer it', () => {
    const perfect = stage();
    const lyra = at(perfect.w, LYRA);
    const t1 = strike(perfect.w, perfect.boss, LAMENT, { on: lyra });
    stepUntil(perfect.sim, () => perfect.w.time >= t1.perfectFrom + 0.01, 120);
    addShield(perfect.w, lyra, 'ward', 500, 3, true);
    const e1 = land(perfect.sim, t1);
    expect(ofType(e1, 'perfectWard')).toHaveLength(1);
    expect(fed(e1, t1)).toBe(0);

    const partial = stage();
    const p = at(partial.w, LYRA);
    addShield(partial.w, p, 'ward', 100, 5, true);
    const t2 = strike(partial.w, partial.boss, LAMENT, { on: p });
    const e2 = land(partial.sim, t2);
    expect(ofType(e2, 'damageTaken').find((d) => d.telegraph === t2.id)!.amount).toBeGreaterThan(0);
    expect(fed(e2, t2)).toBe(0);

    const dome = stage();
    const d = at(dome.w, LYRA);
    addShield(dome.w, d, 'dome', 100, 5, true);
    const t3 = strike(dome.w, dome.boss, LAMENT, { on: d });
    expect(fed(land(dome.sim, t3), t3)).toBe(0);
  });

  it('Oathkeeper and the sphere take it (`takenBy`, or nothing landed): answered', () => {
    const oath = stage({ bonds: { talents: [], solos: ['oathkeeper'] } });
    const kael = at(oath.w, KAEL);
    startSolo(oath.w, kael, false);
    const t1 = strike(oath.w, oath.boss, LAMENT, { on: at(oath.w, LYRA) });
    const e1 = land(oath.sim, t1, (w) => {
      const lyra = at(w, LYRA);
      lyra.x = kael.x + 1;
      lyra.z = kael.z;
    });
    expect(ofType(e1, 'talentFired').some((e) => e.talent === 'oathkeeper')).toBe(true);
    expect(fed(e1, t1)).toBe(0);

    const sphere = stage({ bonds: { talents: [], solos: ['celestial_sphere'] } });
    stepFor(sphere.sim, 1, [{ t: 'thread', slot: KAEL }]);
    startSolo(sphere.w, at(sphere.w, VEXIS), false);
    const k = at(sphere.w, KAEL);
    expect(k.hero!.sphereHits).toBeGreaterThan(0);
    const t2 = strike(sphere.w, sphere.boss, LAMENT, { on: k });
    const hp = k.health!.hp;
    const e2 = land(sphere.sim, t2);
    expect(k.health!.hp).toBeGreaterThanOrEqual(hp);
    expect(fed(e2, t2)).toBe(0);
  });

  it('a live Aegis Link shares it: answered', () => {
    const { sim, w, boss } = stage();
    const lyra = at(w, LYRA);
    const vexis = at(w, VEXIS);
    w.internal.link = { a: lyra.id, b: vexis.id, weaver: false, appliedAt: w.time, until: NEVER };
    const t = strike(w, boss, LAMENT, { on: lyra, windup: 2 });
    const events = land(sim, t);
    expect(ofType(events, 'damageTaken').find((d) => d.telegraph === t.id)!.amount).toBeGreaterThan(
      0,
    );
    expect(fed(events, t)).toBe(0);
  });

  it('a Fermata hold and the Sacrificial Lamb catch it: answered; Fermata’s guard alone fails', () => {
    const hold = stage(fieldSong(['fermata']));
    const t1 = strike(hold.w, hold.boss, LAMENT, { on: at(hold.w, LYRA), damage: 50000 });
    const e1 = land(hold.sim, t1);
    expect(at(hold.w, LYRA).hero!.hold).not.toBeNull();
    expect(fed(e1, t1)).toBe(0);

    const lamb = stage();
    (lamb.w.mods as { sacrificialLamb: number }).sacrificialLamb = 1;
    const t2 = strike(lamb.w, lamb.boss, LAMENT, { on: at(lamb.w, LYRA), damage: 50000 });
    const e2 = land(lamb.sim, t2);
    expect(at(lamb.w, LYRA).health!.downed).toBe(false);
    expect(fed(e2, t2)).toBe(0);

    const guard = stage(fieldSong(['fermata']));
    const lyra = at(guard.w, LYRA);
    dealDamage(guard.w, lyra, {
      source: null,
      sourceName: 'test',
      amount: lyra.health!.maxHp * 0.7,
      telegraph: null,
    });
    const t3 = strike(guard.w, guard.boss, LAMENT, { on: lyra, damage: 100 });
    const e3 = land(guard.sim, t3);
    const hit = ofType(e3, 'damageTaken').find((d) => d.telegraph === t3.id)!;
    expect(hit.amount).toBeCloseTo(70, 6);
    expect(fed(e3, t3)).toBe(SOLO);
  });

  it('what the Martyr bears answers it (`borne`)', () => {
    const { sim, w, boss } = stage({ calling: { id: 'martyr', path: [] } });
    stepFor(sim, 2, [{ t: 'thread', slot: LYRA }]);
    stepFor(sim, 2, [{ t: 'mode', mode: 'bear' }]);
    expect(w.entities.get(w.weaverId)!.weaver!.threadMode).toBe('bear');
    const t = strike(w, boss, LAMENT, { on: at(w, LYRA) });
    const events = land(sim, t);
    expect(ofType(events, 'borne').length).toBeGreaterThan(0);
    expect(fed(events, t)).toBe(0);
  });

  it('a Reel, a walking dodge, a Chimed mark and Paradox leave no victim to fail', () => {
    const reel = stage();
    const t1 = strike(reel.w, reel.boss, BASSO_OSTINATO, {
      on: at(reel.w, LYRA),
      shape: 'circle',
      windup: 1.5,
    });
    const e1 = land(
      reel.sim,
      t1,
      () => reel.sim.step([{ t: 'tech', id: 'reel', slot: LYRA }]),
      0.25,
    );
    expect(reel.w.ledger.reels).toBe(1);
    expect(fed(e1, t1)).toBe(0);

    const walk = stage();
    const t2 = strike(walk.w, walk.boss, BASSO_OSTINATO, { on: at(walk.w, LYRA), shape: 'circle' });
    const e2 = land(walk.sim, t2, (w) => {
      const lyra = at(w, LYRA);
      lyra.x += 8;
    });
    expect(fed(e2, t2)).toBe(0);

    const chime = stage();
    const c = at(chime.w, LYRA);
    const t3 = strike(chime.w, chime.boss, LAMENT, { on: c });
    const e3 = land(chime.sim, t3, (w) => removeStatus(w, c, 'dirge', 'cleansed'));
    expect(ofType(e3, 'telegraphResolved').find((e) => e.telegraph === t3.id)!.outcome).toBe(
      'cancelled',
    );
    expect(fed(e3, t3)).toBe(0);

    const paradox = stage();
    const t4 = strike(paradox.w, paradox.boss, LAMENT, { on: at(paradox.w, LYRA) });
    paradox.w.internal.spared.push({ telegraph: t4.id, hero: at(paradox.w, LYRA).id });
    expect(fed(land(paradox.sim, t4), t4)).toBe(0);
  });

  it('an interrupt or a kill cancels it: no verdict at all', () => {
    for (const end of ['interrupt', 'kill'] as const) {
      const { sim, w } = stage();
      stepFor(sim, 1, [spawn(ALTO, 0, -6, true)]);
      const alto = w.entities.list().find((e) => e.enemy?.defId === ALTO)!;
      stepFor(sim, 60);
      expect(beginAttack(w, alto, attackDef(LAMENT), null)).toBe(true);
      const t = w.telegraphs.find((x) => x.owner === alto.id)!;
      const events = stepFor(sim, 30);
      if (end === 'interrupt') expect(interruptEnemy(w, alto, null)).toBe(true);
      else killEnemy(w, alto, null);
      events.push(...stepFor(sim, 240));
      expect(ofType(events, 'telegraphResolved').find((e) => e.telegraph === t.id)!.outcome).toBe(
        'cancelled',
      );
      expect(ofType(events, 'discordRose')).toHaveLength(0);
    }
  });

  it('a raid gives one verdict; discordQuorum 2 needs two failed victims', () => {
    const raid = stage();
    const t1 = strike(raid.w, raid.boss, BASSO_OSTINATO, { shape: 'raid' });
    const e1 = land(raid.sim, t1);
    expect(ofType(e1, 'damageTaken').filter((d) => d.telegraph === t1.id).length).toBe(3);
    expect(ofType(e1, 'discordRose')).toHaveLength(1);
    expect(fed(e1, t1)).toBe(attackDef(BASSO_OSTINATO).discord);

    const one = stage();
    const t2 = strike(one.w, one.boss, SHATTER_ARIA, { on: at(one.w, LYRA) });
    expect(fed(land(one.sim, t2), t2)).toBe(0);

    const two = stage();
    const t3 = strike(two.w, two.boss, SHATTER_ARIA, { shape: 'raid' });
    expect(fed(land(two.sim, t3), t3)).toBe(attackDef(SHATTER_ARIA).discord);
  });
});

describe('borne', () => {
  it('is on a hit’s result only while internal.m4 exists', () => {
    const sim = sandbox({ calling: { id: 'martyr', path: [] } });
    stepFor(sim, 2, [{ t: 'thread', slot: LYRA }]);
    stepFor(sim, 2, [{ t: 'mode', mode: 'bear' }]);
    const w = worldOf(sim);
    const lyra = at(w, LYRA);
    const hit = () =>
      dealDamage(w, lyra, { source: null, sourceName: 'test', amount: 200, telegraph: null });
    const legacy = hit();
    expect(legacy.dealt).toBeGreaterThan(0);
    expect('borne' in legacy).toBe(false);
    expect(ofType(sim.drainEvents(), 'borne').length).toBe(1);
    ensureM4(w);
    const finale = hit();
    expect(finale.borne).toBeGreaterThan(0);
    delete w.internal.m4;
    expect('borne' in hit()).toBe(false);
  });

  it('Bear, Shared Wounds and the Vow in a Movement I fight: no result carries it', () => {
    const sim = sandbox({ calling: { id: 'martyr', path: ['shared_wounds'] } });
    stepFor(sim, 2, [{ t: 'thread', slot: LYRA }]);
    stepFor(sim, 2, [{ t: 'mode', mode: 'bear' }]);
    const w = worldOf(sim);
    for (const id of w.party) w.entities.get(id)!.hero!.inField = true;
    const results = [];
    for (const slot of [KAEL, LYRA, VEXIS])
      results.push(
        dealDamage(w, at(w, slot), { source: null, sourceName: 't', amount: 150, telegraph: null }),
      );
    stepFor(sim, 1, [RESONANCE(100)]);
    stepFor(sim, 1, [CRESCENDO]);
    expect(w.field.vow).toBe(true);
    results.push(
      dealDamage(w, at(w, VEXIS), { source: null, sourceName: 't', amount: 9000, telegraph: null }),
    );
    expect(results.some((r) => r.dealt > 0)).toBe(true);
    expect(w.ledger.calling.borne).toBeGreaterThan(0);
    for (const r of results) expect('borne' in r).toBe(false);
    expect(w.internal.m4).toBeUndefined();
  });
});

describe('stilled', () => {
  it('disables, refuses a Cue, can’t be Chimed or blocked by immune, and lets a Reel pull', () => {
    const sim = sandbox();
    stepFor(sim, 2, [{ t: 'debug', op: { op: 'chargeSolos' } }]);
    const w = worldOf(sim);
    const lyra = at(w, LYRA);
    addStatus(w, lyra, 'immune', 5, w.weaverId);
    expect(addStatus(w, lyra, 'stilled', NEVER, null)).toBe(true);
    expect(isDisabled(lyra)).toBe(true);
    expect(oldDisabled(lyra)).toBe(false);
    cleanseAilments(w, lyra);
    expect(hasStatus(lyra, 'stilled')).toBe(true);
    const events = stepFor(sim, 2, [RESONANCE(100)]);
    events.push(...stepFor(sim, 2, [{ t: 'cue', slot: LYRA }]));
    expect(ofType(events, 'techniqueRejected')).toEqual([
      expect.objectContaining({ technique: 'cue', reason: 'target' }),
    ]);
    expect(lyra.hero!.soloActive).toBe(0);
    // Frozen: she doesn't move or act.
    const x = lyra.x;
    const z = lyra.z;
    stepFor(sim, 30);
    expect([lyra.x, lyra.z]).toEqual([x, z]);
    expect(lyra.hero!.action).toBe('idle');
    // A Reel still pulls her.
    stepFor(sim, 1, [{ t: 'tech', id: 'reel', slot: LYRA }]);
    expect(lyra.hero!.reel).not.toBeNull();
    stepFor(sim, 30);
    expect(Math.hypot(lyra.x - x, lyra.z - z)).toBeGreaterThan(0.5);
  });

  it('a stilled hero still notices telegraphs, and a running Solo burns out on its clock', () => {
    const sim = sandbox();
    stepFor(sim, 2);
    const w = worldOf(sim);
    stepFor(sim, 1, [spawn('bell_brute', 0, -18)]);
    const brute = w.entities.list().find((e) => e.enemy)!;
    const vexis = at(w, VEXIS);
    startSolo(w, vexis, true);
    const left = vexis.hero!.soloActive;
    expect(left).toBeGreaterThan(0);
    addStatus(w, vexis, 'stilled', NEVER, brute.id);
    const t = startTelegraph(w, {
      owner: brute,
      attack: attackDef('brute_toll_cleave'),
      target: vexis,
      shape: { kind: 'circle', x: vexis.x, z: vexis.z, r: 2 },
      windup: 3,
      damage: 100,
      pctMaxHp: 0,
    });
    stepFor(sim, 2);
    expect(vexis.hero!.lastTelegraphSeen).toBe(t.id);
    expect(vexis.health!.incoming).toBeGreaterThan(0);
    expect(vexis.hero!.soloActive).toBeLessThan(left);
    stepUntil(sim, () => vexis.hero!.soloActive <= 0, 60 * 30);
    expect(hasStatus(vexis, 'stilled')).toBe(true);
  });

  it('isDisabled reads as before for every other status, on heroes and enemies', () => {
    const sim = sandbox();
    stepFor(sim, 1, [spawn('bell_brute', 0, -18)]);
    const w = worldOf(sim);
    const brute = w.entities.list().find((e) => e.enemy)!;
    const kael = at(w, KAEL);
    for (const id of StatusIdSchema.options as StatusId[]) {
      for (const e of [kael, brute]) {
        e.health!.statuses = [{ id, remaining: 5, duration: 5, stacks: 1, source: null }];
        expect(isDisabled(e), `${id} on ${e.hero ? 'a hero' : 'an enemy'}`).toBe(
          id === 'stilled' ? true : oldDisabled(e),
        );
      }
    }
  });

  it('isDisabled equals the old predicate on every sampled tick of a Movement I fight', () => {
    const sim = createSim({ seed: 3, encounter: 'bellwarden' });
    const bot = makeBot('skilled', 3);
    let checked = 0;
    for (let tick = 0; tick < 60 * 90; tick++) {
      sim.step([...bot.decide(sim.state)]);
      sim.drainEvents();
      if (tick % 60 !== 0) continue;
      for (const e of worldOf(sim).entities.list()) {
        if (!e.health) continue;
        expect(isDisabled(e)).toBe(oldDisabled(e));
        checked++;
      }
      if (sim.state.encounter.status === 'victory' || sim.state.encounter.status === 'defeat')
        break;
    }
    expect(checked).toBeGreaterThan(100);
    expect(sim.state.field.finale).toBeUndefined();
  });
});

describe('the Crescendo hook', () => {
  /** A staged Conductor whose Discord is full: Fortissimo Silence begins. */
  function fortissimo(config: Partial<SimConfig>) {
    const s = stage(config);
    s.w.field.finale!.discord!.value = 100;
    const events = stepUntil(
      s.sim,
      () => s.w.telegraphs.some((t) => t.attackId === FORTISSIMO[0]),
      60 * 5,
    );
    return { ...s, events };
  }

  for (const [name, config] of [
    ['Sunrise', {}],
    ['the Vow', { calling: { id: 'martyr', path: [] } }],
    ['Stasis', { calling: { id: 'chronomancer', path: [] } }],
  ] as [string, Partial<SimConfig>][]) {
    it(`${name} cancels a live Fortissimo Silence at once`, () => {
      const { sim, w, boss } = fortissimo(config);
      expect(w.field.finale!.fortissimo).toEqual({ pulse: 1, impact: expect.any(Number) });
      stepFor(sim, 1, [RESONANCE(100)]);
      const events = stepFor(sim, 1, [CRESCENDO]);
      expect(ofType(events, 'crescendoStart')).toHaveLength(1);
      expect(ofType(events, 'fortissimoCancelled')).toEqual([
        expect.objectContaining({ boss: boss.id, by: 'crescendo' }),
      ]);
      expect(w.telegraphs.some((t) => (FORTISSIMO as readonly string[]).includes(t.attackId))).toBe(
        false,
      );
      expect(boss.enemy!.cast).toBeNull();
      expect(w.internal.m2?.followUp ?? null).toBeNull();
      expect(w.field.finale!.fortissimo).toBeUndefined();
      expect(w.field.finale!.discord!.value).toBe(0);
    });
  }

  it('a Crescendo already running cancels one as it would begin', () => {
    const { sim, w } = stage();
    stepFor(sim, 1, [RESONANCE(100)]);
    stepFor(sim, 1, [CRESCENDO]);
    w.field.finale!.discord!.value = 100;
    const events = stepFor(sim, 30);
    expect(ofType(events, 'fortissimoCancelled')).toEqual([
      expect.objectContaining({ by: 'crescendo' }),
    ]);
    expect(w.telegraphs.some((t) => t.attackId === FORTISSIMO[0])).toBe(false);
    expect(w.field.finale!.discord!.value).toBeLessThan(1);
  });

  it('is a no-op in a legacy encounter: no event, no Finale state', () => {
    for (const config of [{}, { calling: { id: 'chronomancer', path: [] } }]) {
      const sim = sandbox(config as Partial<SimConfig>);
      stepFor(sim, 1, [spawn('the_unweaver', 0, -18)]);
      stepFor(sim, 60, [RESONANCE(100)]);
      const events = stepFor(sim, 2, [CRESCENDO]);
      expect(ofType(events, 'crescendoStart')).toHaveLength(1);
      expect(ofType(events, 'fortissimoCancelled')).toHaveLength(0);
      const w = worldOf(sim);
      expect(w.field.finale).toBeUndefined();
      expect(w.internal.m4).toBeUndefined();
    }
  });
});

describe('the hooks write nothing outside the Finale', () => {
  it('a Movement III fight: no Finale event, key or status', () => {
    const sim = createSim({ seed: 5, encounter: 'the_unweaver' });
    const bot = makeBot('skilled', 5);
    const finale = new Set([
      'discordRose',
      'fortissimoCancelled',
      'enemyCued',
      'silenceBegan',
      'silenceNote',
      'reignited',
      'silenceBroken',
    ]);
    for (let tick = 0; tick < 60 * 60; tick++) {
      sim.step([...bot.decide(sim.state)]);
      for (const e of sim.drainEvents()) expect(finale.has(e.type), e.type).toBe(false);
      if (tick % 60 === 0) {
        const w = worldOf(sim);
        expect(w.field.finale).toBeUndefined();
        expect(w.internal.m4).toBeUndefined();
        for (const e of w.entities.list()) expect(e.health && hasStatus(e, 'stilled')).toBeFalsy();
      }
    }
    void hero;
  });
});
