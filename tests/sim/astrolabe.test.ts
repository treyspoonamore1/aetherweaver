/**
 * Phase 4: the Astrolabe in the sim (docs/phase-4.md). The tree's shape, what each kind of node
 * does, every keystone, and the helpers the HUD and the bots share with the sim.
 */
import { describe, expect, it } from 'vitest';
import { CONTENT, astrolabeNode } from '../../src/content';
import {
  KNOWN_ASTROLABE_EFFECTS,
  canPay,
  chordProblems,
  createSim,
  parseReplay,
  runReplay,
  songReserve,
  techniqueCost,
  type Command,
  type SimConfig,
  type Telegraph,
} from '../../src/sim';
import { dealDamage, heal, shieldOf } from '../../src/sim/combat/health';
import { NO_MODS, resolveMods } from '../../src/sim/mods';
import { ReplayRecorder } from '../../src/sim/replay';
import { empowerBonus } from '../../src/sim/systems/thread';
import { resolveConfig, type World } from '../../src/sim/world';
import { ofType, sandbox, spawn, stepFor, stepUntil, worldOf } from './helpers';

const GUARDIAN = [
  { auras: ['fortissimo'], ornaments: [] },
  { auras: ['sostenuto'], ornaments: [] },
];
const v = (id: string, key: string) => astrolabeNode(id).values[key]!;
const modsOf = (astrolabe: string[], config: Partial<SimConfig> = {}) =>
  resolveMods(resolveConfig({ seed: 1, astrolabe, ...config }), CONTENT);
const weaverOf = (w: World) => w.entities.get(w.weaverId)!;
const heroAt = (w: World, slot: number) => w.entities.get(w.party[slot]!)!;
const WARD = (slot = 0): Command => ({ t: 'tech', id: 'ward', slot: slot as 0 });

/** A sandbox with Kael threaded (Mend) and the tree given. */
function tree(astrolabe: string[], config: Partial<SimConfig> = {}) {
  const sim = sandbox({ astrolabe, ...config });
  stepFor(sim, 2, [{ t: 'thread', slot: 0 }]);
  sim.drainEvents();
  return { sim, w: worldOf(sim) };
}

/** Steps from the centre to each node (breadth-first). */
function distances(): Map<string, number> {
  const adj = new Map<string, string[]>(CONTENT.astrolabe.nodes.map((n) => [n.id, []]));
  for (const [a, b] of CONTENT.astrolabe.links) {
    adj.get(a)!.push(b);
    adj.get(b)!.push(a);
  }
  const dist = new Map([['star', 0]]);
  const queue = ['star'];
  while (queue.length > 0) {
    const at = queue.shift()!;
    for (const next of adj.get(at)!)
      if (!dist.has(next)) {
        dist.set(next, dist.get(at)! + 1);
        queue.push(next);
      }
  }
  return dist;
}

describe('the tree', () => {
  it('65 nodes: four forks, six keystones, two great notables and four bridges', () => {
    const nodes = CONTENT.astrolabe.nodes;
    expect(nodes).toHaveLength(65);
    expect(nodes.filter((n) => n.kind === 'keystone').map((n) => n.id)).toEqual([
      'overflowing_grace',
      'sanguine_font',
      'prism_covenant',
      'unbroken_chorus',
      'shatterproof_halo',
      'eldritch_conduit',
    ]);
    expect(nodes.filter((n) => n.kind === 'great').map((n) => n.id)).toEqual([
      'second_wind',
      'ensemble',
    ]);
    expect(nodes.filter((n) => n.constellation === 'bridge')).toHaveLength(4);
    for (const n of nodes) expect(KNOWN_ASTROLABE_EFFECTS, n.id).toContain(n.effect);
  });

  it('a first notable is 3 points out, a bridge 6 and every rim 9', () => {
    const d = distances();
    for (const c of ['silk', 'choir', 'aegis', 'bond']) expect(d.get(`${c}_n1`), c).toBe(3);
    for (const id of ['resonant_thread', 'anthem', 'shield_bearer', 'lifeguard'])
      expect(d.get(id), id).toBe(6);
    const rims = CONTENT.astrolabe.nodes.filter((n) => n.kind === 'keystone' || n.kind === 'great');
    for (const n of rims) expect(d.get(n.id), n.id).toBe(9);
  });

  it('no tree changes nothing; unknown ids are ignored and the rest sorted', () => {
    expect(modsOf([])).toEqual(resolveMods(resolveConfig({ seed: 1 }), CONTENT));
    expect(modsOf([])).toEqual(NO_MODS);
    expect(
      resolveConfig({ seed: 1, astrolabe: ['silk_t2', 'nonsense', 'silk_t1'] }).astrolabe,
    ).toEqual(['silk_t1', 'silk_t2']);
    // The Weaver absent: no tree.
    expect(resolveConfig({ seed: 1, absent: true, astrolabe: ['silk_t1'] }).astrolabe).toEqual([]);
  });

  it('travel nodes add up within the tree, then multiply what the run gave', () => {
    const m = modsOf(['silk_t1', 'silk_t2', 'silk_n1', 'silk_a1']);
    const thread = 2 * v('silk_t1', 'pct') + v('silk_n1', 'pct');
    expect(m.mendMult).toBeCloseTo(1 + (thread + v('silk_a1', 'pct')) / 100, 9);
    expect(m.empowerMult).toBeCloseTo(1 + thread / 100, 9);
    expect(m.threadRangeBonus).toBe(v('silk_n1', 'range'));
    // On top of a motif's: Golden Filament sets Empower, the tree multiplies it.
    const withMotif = modsOf(['silk_b1'], { motifs: [{ id: 'golden_filament', level: 1 }] });
    const motif = CONTENT.motifs.find((d) => d.id === 'golden_filament')!.values[0]!;
    expect(withMotif.empowerMult).toBeCloseTo(
      (1 + motif / 100) * (1 + v('silk_b1', 'pct') / 100),
      9,
    );
  });

  it('the world shows the tree, its keystones and what the HUD needs', () => {
    const { w } = tree(['eldritch_conduit', 'aegis_b1', 'prism_covenant']);
    expect(w.astrolabe.nodes).toEqual(['aegis_b1', 'eldritch_conduit', 'prism_covenant']);
    expect(w.astrolabe.keystones).toEqual(['prism_covenant', 'eldritch_conduit']);
    expect(w.astrolabe.techniquesCostLife).toBe(true);
    expect(w.astrolabe.techCostMult).toBeCloseTo(1 - v('aegis_b1', 'pct') / 100, 9);
    expect(w.astrolabe.lifeCapPct).toBe(0.5);
  });
});

describe('Silk', () => {
  /** Life Mend gives Kael over a second, from `hpPct` of his life. */
  function mended(astrolabe: string[], hpPct: number, prep?: (w: World) => void) {
    const { sim, w } = tree(astrolabe);
    const kael = heroAt(w, 0);
    kael.health!.hp = kael.health!.maxHp * hpPct;
    prep?.(w);
    const before = kael.health!.hp;
    stepFor(sim, 60);
    return kael.health!.hp - before;
  }

  it('Second Stitch: Mend heals more on a hero below a share of their life', () => {
    const low = v('silk_an', 'below') / 100 - 0.1;
    const plain = mended([], low);
    expect(mended(['silk_an'], low)).toBeCloseTo(plain * (1 + v('silk_an', 'pct') / 100), 0);
    // Above the line it's plain Mend.
    expect(mended(['silk_an'], 0.6)).toBeCloseTo(mended([], 0.6), 6);
  });

  it('Overflowing Grace: Mend’s overheal shields the hero, up to a share of their life', () => {
    // Threaded from the first tick: it fills at Mend's overheal, up to the cap, and lasts while
    // Mend keeps topping it up (well past its own few seconds, the cap reached long before).
    const sim = sandbox({ astrolabe: ['overflowing_grace'] });
    const w = worldOf(sim);
    const kael = heroAt(w, 0);
    const events = stepFor(sim, 60 * 20, [{ t: 'thread', slot: 0 }]);
    const shield = shieldOf(kael.health!, 'overshield')!;
    expect(shield.fromWeaver).toBe(true);
    expect(shield.grace).toBe(true);
    expect(shield.amount).toBeCloseTo(
      (kael.health!.maxHp * v('overflowing_grace', 'cap')) / 100,
      3,
    );
    // It formed once and was topped up after: one event.
    expect(ofType(events, 'graceShield')).toHaveLength(1);
    // The price: a smaller Ward.
    expect(modsOf(['overflowing_grace']).wardBarrierMult).toBeCloseTo(
      1 - v('overflowing_grace', 'ward') / 100,
      9,
    );
  });

  it('Overflowing Grace keeps to its own shield: another of yours is neither topped up nor kept', () => {
    const { sim, w } = tree(['overflowing_grace']);
    const kael = heroAt(w, 0);
    kael.health!.shields.length = 0;
    const thimble = {
      kind: 'overshield' as const,
      amount: 5,
      max: 5,
      appliedAt: w.time,
      expiresAt: w.time + 0.5,
      fromWeaver: true,
      fromAura: false,
    };
    kael.health!.shields.push(thimble);
    stepFor(sim, 15);
    expect(shieldOf(kael.health!, 'overshield')).toEqual(thimble);
    // Once it's gone, Grace's own forms.
    stepFor(sim, 60);
    expect(shieldOf(kael.health!, 'overshield')!.grace).toBe(true);
  });

  it('Overflowing Grace leaves a hero’s own overshield alone', () => {
    const { sim, w } = tree(['overflowing_grace']);
    const kael = heroAt(w, 0);
    kael.health!.shields.length = 0;
    kael.health!.shields.push({
      kind: 'overshield',
      amount: 5,
      max: 5,
      appliedAt: 0,
      expiresAt: 1e9,
      fromWeaver: false,
      fromAura: false,
    });
    stepFor(sim, 60);
    expect(shieldOf(kael.health!, 'overshield')!.amount).toBe(5);
  });

  it('Afterglow: Empower lingers on the hero the Thread leaves', () => {
    const { sim, w } = tree(['silk_bn']);
    stepFor(sim, 1, [{ t: 'mode' }]);
    expect(empowerBonus(w, heroAt(w, 0)).more).toBeGreaterThan(0);
    stepFor(sim, 1, [{ t: 'thread', slot: 1 }]);
    expect(empowerBonus(w, heroAt(w, 0)).more).toBeGreaterThan(0);
    stepFor(sim, Math.round(v('silk_bn', 'seconds') * 60) + 2);
    expect(empowerBonus(w, heroAt(w, 0)).more).toBe(0);
    // Without it, Empower leaves with the Thread.
    const plain = tree([]);
    stepFor(plain.sim, 1, [{ t: 'mode' }]);
    stepFor(plain.sim, 1, [{ t: 'thread', slot: 1 }]);
    expect(empowerBonus(plain.w, heroAt(plain.w, 0)).more).toBe(0);
  });

  it('Sanguine Font: the songs hold Life, two-thirds as much; Mend heals her; slower Spirit', () => {
    const plain = tree([], { chords: GUARDIAN }).w;
    const { w } = tree(['sanguine_font'], { chords: GUARDIAN });
    const wv = weaverOf(w).weaver!;
    expect(wv.reservedSpirit).toBe(0);
    expect(wv.spirit).toBe(wv.maxSpirit);
    const share = weaverOf(plain).weaver!.reservedSpirit / weaverOf(plain).weaver!.maxSpirit;
    expect(wv.reservedLife).toBeCloseTo(
      share * (v('sanguine_font', 'share') / 100) * wv.maxLife,
      6,
    );
    const m = modsOf(['sanguine_font']);
    expect(m.covenantPct).toBeCloseTo(v('sanguine_font', 'mend') / 100, 9);
    expect(m.spiritRegenMult).toBeCloseTo(1 - v('sanguine_font', 'regen') / 100, 9);
    // The songs' legality is checked against Life, and the Martyr's floor.
    expect(songReserve(false, ['sanguine_font']).pool).toBe('life');
    const heavy = [
      { auras: ['fortissimo', 'sostenuto'], ornaments: [] },
      { auras: ['ostinato', 'fermata'], ornaments: [] },
    ];
    const r = songReserve(false, ['sanguine_font']);
    expect(chordProblems(heavy, CONTENT, { pool: r.pool, reserveMult: r.mult })).toEqual([]);
  });

  it('Sanguine Font lightens the Martyr’s songs too', () => {
    const martyr = { calling: { id: 'martyr', path: [] } };
    const plain = tree([], { chords: GUARDIAN, ...martyr }).w;
    const { w } = tree(['sanguine_font'], { chords: GUARDIAN, ...martyr });
    expect(weaverOf(w).weaver!.reservedLife).toBeCloseTo(
      weaverOf(plain).weaver!.reservedLife * (v('sanguine_font', 'share') / 100),
      6,
    );
  });
});

describe('Choir', () => {
  it('aura effect, lighter songs and a wider field', () => {
    const m = modsOf(['choir_t1', 'choir_t2', 'choir_n1', 'choir_b1', 'choir_b2']);
    expect(m.auraEffectMult).toBeCloseTo(
      1 + (v('choir_t1', 'pct') + v('choir_t2', 'pct') + v('choir_n1', 'pct')) / 100,
      9,
    );
    expect(m.reserveMult).toBeCloseTo(
      1 - (v('choir_n1', 'reserve') + v('choir_b1', 'pct')) / 100,
      9,
    );
    expect(m.fieldRadiusMult).toBeCloseTo(1 + v('choir_b2', 'pct') / 100, 9);
    // The songs hold less Spirit in the fight, as `songReserve` says.
    const plain = tree([], { chords: GUARDIAN }).w;
    const light = tree(['choir_n1'], { chords: GUARDIAN }).w;
    expect(weaverOf(light).weaver!.reservedSpirit).toBeCloseTo(
      weaverOf(plain).weaver!.reservedSpirit * songReserve(false, ['choir_n1']).mult,
      6,
    );
  });

  it('Held Note: the Crescendo lasts longer', () => {
    const { sim, w } = tree(['choir_an']);
    weaverOf(w).weaver!.resonance = CONTENT.resonance.max;
    stepFor(sim, 1, [{ t: 'crescendo' }]);
    const left = weaverOf(w).weaver!.crescendo;
    expect(left).toBeGreaterThan(CONTENT.crescendo.duration + v('choir_an', 'seconds') - 0.05);
    expect(left).toBeLessThanOrEqual(CONTENT.crescendo.duration + v('choir_an', 'seconds'));
  });

  it('Prism Covenant: she fights at half her Life and can’t be healed above it', () => {
    const { w } = tree(['prism_covenant']);
    const me = weaverOf(w);
    expect(me.health!.hp).toBeCloseTo(me.health!.maxHp * 0.5, 6);
    expect(heal(w, me, 500, 'self')).toBe(0);
    me.health!.hp = 10;
    heal(w, me, 1e6, 'self');
    expect(me.health!.hp).toBeCloseTo(me.health!.maxHp * 0.5, 6);
    const m = modsOf(['prism_covenant']);
    expect(m.auraEffectMult).toBeCloseTo(1 + v('prism_covenant', 'aura') / 100, 9);
    expect(m.mendMult).toBeCloseTo(1 + v('prism_covenant', 'thread') / 100, 9);
  });

  it('Unbroken Chorus: a Mute can’t silence her; more auras sing louder; a weaker Thread', () => {
    const silenced = (astrolabe: string[]) => {
      const { sim, w } = tree(astrolabe, { chords: GUARDIAN });
      const me = weaverOf(w);
      stepFor(sim, 2, [spawn('mute', me.x + 1, me.z)]);
      return w.field.suppressed;
    };
    expect(silenced([])).toBe(true);
    expect(silenced(['unbroken_chorus'])).toBe(false);
    const m = modsOf(['unbroken_chorus']);
    expect(m.auraPerExtra).toBeCloseTo(v('unbroken_chorus', 'pct') / 100, 9);
    expect(m.mendMult).toBeCloseTo(1 - v('unbroken_chorus', 'thread') / 100, 9);
  });
});

describe('Aegis', () => {
  it('Economy: techniques cost less, and `techniqueCost` and `canPay` agree with the sim', () => {
    const spent = (astrolabe: string[]) => {
      const { sim, w } = tree(astrolabe);
      const before = weaverOf(w).weaver!.spirit;
      stepFor(sim, 1, [WARD()]);
      return { w, spent: before - weaverOf(w).weaver!.spirit };
    };
    const { w, spent: cheap } = spent(['aegis_b1', 'aegis_b3']);
    const economy = (v('aegis_b1', 'pct') + v('aegis_b3', 'pct')) / 100;
    const cost = techniqueCost(w, 'ward');
    expect(cost.pool).toBe('spirit');
    expect(cost.amount).toBeCloseTo(CONTENT.techniques.ward.cost * (1 - economy), 9);
    // The same Spirit regenerates in both: the difference is the discount.
    expect(spent([]).spent - cheap).toBeCloseTo(CONTENT.techniques.ward.cost * economy, 6);
    weaverOf(w).weaver!.spirit = cost.amount - 0.5;
    expect(canPay(w, 'ward')).toBe(false);
  });

  it('Shieldwright: the Ward recharges a second faster', () => {
    const { sim, w } = tree(['aegis_n1']);
    stepFor(sim, 1, [WARD()]);
    expect(weaverOf(w).weaver!.cooldownTotals.ward).toBeCloseTo(
      CONTENT.techniques.ward.cooldown - v('aegis_n1', 'seconds'),
      6,
    );
  });

  it('Shatterproof Halo: no single hit breaks the Ward; it lasts shorter', () => {
    const { sim, w } = tree(['shatterproof_halo']);
    const kael = heroAt(w, 0);
    stepFor(sim, 1, [WARD()]);
    const ward = shieldOf(kael.health!, 'ward')!;
    expect(ward.expiresAt - w.time).toBeCloseTo(CONTENT.techniques.ward.duration * 0.6, 1);
    const hp = kael.health!.hp;
    dealDamage(w, kael, { source: null, sourceName: 'test', amount: 5000, telegraph: null });
    expect(kael.health!.hp).toBe(hp);
    expect(ward.amount).toBeCloseTo(ward.max * 0.5, 6);
    // A second big hit is still caught, and breaks it.
    dealDamage(w, kael, { source: null, sourceName: 'test', amount: 5000, telegraph: null });
    expect(kael.health!.hp).toBe(hp);
    expect(shieldOf(kael.health!, 'ward')).toBeUndefined();
    // Without it, the first big hit breaks the Ward and the rest lands.
    const plain = tree([]);
    const k2 = heroAt(plain.w, 0);
    stepFor(plain.sim, 1, [WARD()]);
    const hp2 = k2.health!.hp;
    dealDamage(plain.w, k2, { source: null, sourceName: 'test', amount: 1000, telegraph: null });
    expect(k2.health!.hp).toBeLessThan(hp2);
  });

  it('Eldritch Conduit: techniques cost Life, never down to nothing; lighter songs', () => {
    const { sim, w } = tree(['eldritch_conduit'], { chords: GUARDIAN });
    const me = weaverOf(w);
    const spirit = me.weaver!.spirit;
    const life = me.health!.hp;
    expect(techniqueCost(w, 'ward')).toEqual({
      amount: CONTENT.techniques.ward.cost,
      pool: 'life',
    });
    stepFor(sim, 1, [WARD()]);
    expect(life - me.health!.hp).toBeCloseTo(CONTENT.techniques.ward.cost, 0);
    expect(me.weaver!.spirit).toBeGreaterThanOrEqual(spirit);
    // Not enough Life: refused.
    me.health!.hp = CONTENT.techniques.chime.cost;
    expect(canPay(w, 'chime')).toBe(false);
    const events = stepFor(sim, 1, [{ t: 'tech', id: 'chime', point: { x: me.x, z: me.z } }]);
    expect(ofType(events, 'techniqueRejected')[0]).toMatchObject({
      technique: 'chime',
      reason: 'life',
    });
    expect(modsOf(['eldritch_conduit']).reserveMult).toBeCloseTo(
      1 - v('eldritch_conduit', 'reserve') / 100,
      9,
    );
  });

  it('Ringing Parry and Bell Tower', () => {
    const parry = modsOf(['aegis_an']);
    expect(parry.staggerMult).toBeCloseTo(1 + v('aegis_an', 'pct') / 100, 9);
    expect(parry.perfectResonance).toBe(v('aegis_an', 'resonance'));
    const bell = modsOf(['aegis_bn']);
    expect(bell.chimeRadiusMult).toBeCloseTo(1 + v('aegis_bn', 'radius') / 100, 9);
    expect(bell.chimeHealMult).toBeCloseTo(1 + v('aegis_bn', 'heal') / 100, 9);
  });
});

describe('what the tree changes elsewhere', () => {
  it('a death recap lists only the techniques she could have paid for, Life costs included', () => {
    const { w } = tree(['eldritch_conduit']);
    const weaver = weaverOf(w);
    weaver.weaver!.cooldowns.chime = 0;
    weaver.weaver!.cooldowns.reel = 0;
    // Spirit is full (nothing costs it), but 10 Life pays for nothing.
    weaver.health!.hp = 10;
    const kael = heroAt(w, 0);
    dealDamage(w, kael, { source: null, sourceName: 't', amount: 1e5, telegraph: null });
    expect(w.ledger.deaths.at(-1)!.readyTechniques).toEqual([]);
    // With the Life to pay, they're ready.
    weaver.health!.hp = weaver.health!.maxHp * 0.5;
    const lyra = heroAt(w, 1);
    dealDamage(w, lyra, { source: null, sourceName: 't', amount: 1e5, telegraph: null });
    expect(w.ledger.deaths.at(-1)!.readyTechniques).toEqual(['ward', 'chime', 'reel']);
  });

  it('Prism Covenant: she re-forms at half her Life, never above the ceiling', () => {
    const { sim, w } = tree(['prism_covenant']);
    const weaver = weaverOf(w);
    weaver.health!.maxHp = 417;
    weaver.health!.invulnerable = 0;
    dealDamage(w, weaver, { source: null, sourceName: 't', amount: 1e5, telegraph: null });
    expect(weaver.health!.downed).toBe(true);
    stepUntil(sim, () => !weaver.health!.downed, 60 * 30);
    expect(weaver.health!.hp).toBeLessThanOrEqual((417 * v('prism_covenant', 'cap')) / 100);
  });
});

describe('Bond', () => {
  it('heroes have more life and hit harder, and the extra is the Weaver’s', () => {
    const { w } = tree(['bond_t1', 'bond_t2', 'bond_n1']);
    const plain = tree([]).w;
    const life = 1 + (v('bond_t1', 'pct') + v('bond_n1', 'life')) / 100;
    expect(heroAt(w, 0).health!.maxHp).toBe(Math.round(heroAt(plain, 0).health!.maxHp * life));
    const m = modsOf(['bond_t1', 'bond_t2', 'bond_n1']);
    expect(m.partyDamageMult).toBeCloseTo(1 + v('bond_n1', 'damage') / 100, 9);
    // The trunk's second node is Rhythm: Solos charge faster.
    expect(m.soloChargeMult).toBeCloseTo(1 + v('bond_t2', 'pct') / 100, 9);
  });

  it('Close Ranks: ordinary hits on a hero near another are softer; telegraphed ones aren’t', () => {
    const hit = (astrolabe: string[], telegraphed: boolean) => {
      const { w } = tree(astrolabe);
      const kael = heroAt(w, 0);
      const lyra = heroAt(w, 1);
      lyra.x = kael.x + 1;
      lyra.z = kael.z;
      const telegraph: Telegraph = {
        id: w.internal.nextTelegraphId++,
        owner: -1,
        target: kael.id,
        attackId: 'volatile_burst',
        name: 'Shatter',
        kind: 'burst',
        shape: { kind: 'circle', x: kael.x, z: kael.z, r: 2 },
        start: w.time,
        impact: w.time,
        perfectFrom: w.time,
        damage: 100,
        pctMaxHp: 0,
        effect: 'damage',
        answers: ['move'],
        severity: 'normal',
      };
      const hp = kael.health!.hp;
      dealDamage(w, kael, {
        source: null,
        sourceName: 'test',
        amount: 100,
        telegraph: telegraphed ? telegraph : null,
      });
      return hp - kael.health!.hp;
    };
    expect(hit(['bond_an'], false)).toBeCloseTo(
      hit([], false) * (1 - v('bond_an', 'pct') / 100),
      6,
    );
    expect(hit(['bond_an'], true)).toBeCloseTo(hit([], true), 6);
  });

  it('Second Wind: a Mend revive stands them up at 60%, untouchable a moment', () => {
    const { sim, w } = tree(['second_wind', 'bond_a4']);
    const kael = heroAt(w, 0);
    dealDamage(w, kael, { source: null, sourceName: 'test', amount: 1e6, telegraph: null });
    expect(kael.health!.downed).toBe(true);
    const start = sim.tick;
    stepUntil(sim, (ev) => ev.some((e) => e.type === 'revived'), 600);
    expect(kael.health!.hp).toBe(Math.round(kael.health!.maxHp * (v('second_wind', 'life') / 100)));
    expect(kael.health!.invulnerable).toBeGreaterThan(v('second_wind', 'seconds') - 0.1);
    // Lift: quicker than the content's revive time.
    const took = (sim.tick - start) / 60;
    expect(took).toBeLessThan(CONTENT.thread.reviveTime / (1 + v('bond_a4', 'pct') / 100) + 0.1);
  });

  it('Ready Answer and Ensemble', () => {
    expect(modsOf(['bond_bn']).responseBonus).toBe(v('bond_bn', 'resonance'));
    expect(modsOf(['ensemble']).canon).toBe(v('ensemble', 'pct'));
  });
});

describe('bridges', () => {
  it('Resonant Thread, Anthem, Shield Bearer and Lifeguard', () => {
    expect(modsOf(['resonant_thread']).beamFocusMult).toBeCloseTo(
      1 + v('resonant_thread', 'pct') / 100,
      9,
    );
    expect(modsOf(['anthem']).inFieldDamage).toBeCloseTo(v('anthem', 'pct') / 100, 9);
    expect(modsOf(['shield_bearer']).wardedDamage).toBeCloseTo(v('shield_bearer', 'pct') / 100, 9);
    expect(modsOf(['lifeguard']).mendWarded).toBeCloseTo(v('lifeguard', 'pct') / 100, 9);
  });

  it('Lifeguard: Mend heals a Warded hero more', () => {
    const mendWith = (astrolabe: string[]) => {
      const { sim, w } = tree(astrolabe);
      const kael = heroAt(w, 0);
      stepFor(sim, 1, [WARD()]);
      kael.health!.hp = kael.health!.maxHp * 0.6;
      const before = kael.health!.hp;
      stepFor(sim, 30);
      return kael.health!.hp - before;
    };
    expect(mendWith(['lifeguard'])).toBeCloseTo(
      mendWith([]) * (1 + v('lifeguard', 'pct') / 100),
      0,
    );
  });
});

describe('replays', () => {
  it('a fight with a tree replays bit-exactly; an older replay has none', () => {
    const config: SimConfig = {
      seed: 3,
      encounter: 'tolling_halls',
      chords: GUARDIAN,
      astrolabe: ['star', 'silk_t1', 'silk_t2', 'silk_n1', 'overflowing_grace'],
    };
    const resolved = resolveConfig(config);
    const recorder = new ReplayRecorder(resolved);
    const sim = createSim(config);
    for (let t = 0; t < 600; t++) {
      const cmds: Command[] = t === 1 ? [{ t: 'thread', slot: 0 }] : [];
      recorder.record(sim.tick, sim.step(cmds));
      sim.drainEvents();
    }
    const replay = parseReplay(JSON.parse(JSON.stringify(recorder.export(sim.tick, sim.hash()))));
    expect(runReplay(replay).matches).toBe(true);
    const old = JSON.parse(JSON.stringify(replay)) as Record<string, Record<string, unknown>>;
    delete old.config!.astrolabe;
    expect(parseReplay(old).config.astrolabe).toEqual([]);
  });
});
