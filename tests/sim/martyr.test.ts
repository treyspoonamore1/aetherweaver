/**
 * Phase 3d: the Martyr in the sim (docs/phase-3d.md). Life reservation, Bear, Martyr's Vow, and
 * each option on the path.
 */
import { describe, expect, it } from 'vitest';
import { CONTENT, callingOption } from '../../src/content';
import { vowHoldsAt, type Command } from '../../src/sim';
import { chordProblems, chordReserve } from '../../src/sim/chords';
import { dealDamage, heal } from '../../src/sim/combat/health';
import { resolveConfig, type World } from '../../src/sim/world';
import { ofType, sandbox, stepFor, telegraphOn, worldOf } from './helpers';

const martyr = (...path: string[]) => ({ calling: { id: 'martyr', path } });
const value = (option: string, key: string) => callingOption(option).values[key]!;
const passive = (key: string) => CONTENT.callings.find((c) => c.id === 'martyr')!.values[key]!;
/** Guardian: Fortissimo on the beam, Sostenuto in the field (55% reserved). */
const GUARDIAN: { auras: string[]; ornaments: string[] }[] = [
  { auras: ['fortissimo'], ornaments: [] },
  { auras: ['sostenuto'], ornaments: [] },
];
const BEAR: Command = { t: 'mode', mode: 'bear' };
const weaverOf = (w: World) => w.entities.get(w.weaverId)!;
const heroAt = (w: World, slot: number) => w.entities.get(w.party[slot]!)!;

/** A Martyr sandbox with Kael threaded, in Bear (unless `mode` says otherwise). */
function bearing(path: string[] = [], mode: 'bear' | 'mend' = 'bear') {
  const sim = sandbox({ chords: GUARDIAN, ...martyr(...path) });
  stepFor(sim, 2, [{ t: 'thread', slot: 0 }, ...(mode === 'bear' ? [BEAR] : [])]);
  sim.drainEvents();
  return { sim, w: worldOf(sim) };
}

describe('Life instead of Spirit', () => {
  it('the songs reserve the Martyr’s Life; all her Spirit is free', () => {
    const w = worldOf(sandbox({ chords: GUARDIAN, ...martyr() }));
    const weaver = weaverOf(w);
    const share = chordReserve(GUARDIAN);
    const maxLife = CONTENT.weaver.maxLife * (1 + passive('life') / 100);
    expect(weaver.weaver!.maxLife).toBeCloseTo(maxLife, 6);
    expect(weaver.weaver!.reservedLife).toBeCloseTo(share * maxLife, 6);
    expect(weaver.health!.maxHp).toBeCloseTo(maxLife * (1 - share), 6);
    expect(weaver.health!.hp).toBeCloseTo(weaver.health!.maxHp, 6);
    expect(weaver.weaver!.reservedSpirit).toBe(0);
    expect(weaver.weaver!.spirit).toBe(weaver.weaver!.maxSpirit);
    // Heals stop at the unreserved part.
    weaver.health!.hp = 10;
    heal(w, weaver, 1e6, 'other');
    expect(weaver.health!.hp).toBeCloseTo(weaver.health!.maxHp, 6);
    // Without the Martyr: Spirit, as before.
    const plain = weaverOf(worldOf(sandbox({ chords: GUARDIAN })));
    expect(plain.weaver!.reservedLife).toBe(0);
    expect(plain.weaver!.maxLife).toBe(CONTENT.weaver.maxLife);
    expect(plain.health!.maxHp).toBe(CONTENT.weaver.maxLife);
    expect(plain.weaver!.reservedSpirit).toBeCloseTo(share * plain.weaver!.maxSpirit, 6);
  });

  it('songs may reserve at most nine tenths of her Life', () => {
    const heavy = [
      { auras: ['fortissimo', 'ostinato'], ornaments: ['grace_note'] },
      { auras: ['sostenuto', 'allegro'], ornaments: [] },
    ];
    expect(chordReserve(heavy)).toBeCloseTo(0.92, 6);
    expect(chordProblems(heavy)).toEqual([]);
    expect(chordProblems(heavy, CONTENT, { pool: 'life' })).toHaveLength(1);
    expect(() => resolveConfig({ seed: 1, chords: heavy, ...martyr() })).toThrow(
      /tenth of your Life/,
    );
    expect(resolveConfig({ seed: 1, chords: heavy }).chords).toHaveLength(2);
  });
});

describe('Bear', () => {
  it('is the Martyr’s: its own key toggles it, and right-click returns to the mode it left', () => {
    const plain = sandbox({ chords: GUARDIAN });
    const refused = stepFor(plain, 1, [BEAR]);
    expect(
      ofType(refused, 'techniqueRejected').some(
        (e) => e.technique === 'thread' && e.reason === 'locked',
      ),
    ).toBe(true);
    expect(weaverOf(worldOf(plain)).weaver!.threadMode).toBe('mend');

    const sim = sandbox({ chords: GUARDIAN, ...martyr() });
    const mode = () => weaverOf(worldOf(sim)).weaver!.threadMode;
    stepFor(sim, 1, [{ t: 'mode' }]);
    expect(mode()).toBe('empower');
    stepFor(sim, 1, [BEAR]);
    expect(mode()).toBe('bear');
    stepFor(sim, 1, [BEAR]);
    expect(mode()).toBe('empower');
    stepFor(sim, 1, [BEAR]);
    stepFor(sim, 1, [{ t: 'mode' }]);
    expect(mode()).toBe('empower');
  });

  it('the Weaver takes Bear’s share of what gets through to the threaded hero', () => {
    const { sim, w } = bearing();
    const kael = heroAt(w, 0);
    const weaver = weaverOf(w);
    const [kaelBefore, weaverBefore] = [kael.health!.hp, weaver.health!.hp];
    dealDamage(w, kael, { source: null, sourceName: 'test', amount: 200, telegraph: null });
    // Kael's armour acts first; Bear splits what gets through.
    const through = 200 * (1 - CONTENT.heroes.find((h) => h.id === 'kael')!.armor);
    const share = passive('bear') / 100;
    const toll = 1 - passive('cut') / 100;
    expect(kaelBefore - kael.health!.hp).toBeCloseTo(through * (1 - share), 6);
    // It reaches her softened.
    expect(weaverBefore - weaver.health!.hp).toBeCloseTo(through * share * toll, 6);
    expect(w.ledger.calling.borne).toBeCloseTo(through * share * toll, 6);
    expect(w.ledger.calling.shielded).toBeCloseTo(through * share, 6);
    const borne = ofType(sim.drainEvents(), 'borne');
    expect(borne).toHaveLength(1);
    expect(borne[0]).toMatchObject({ hero: kael.id, via: 'bear' });
  });

  it('nothing is borne in Mend, or for a hero the Thread isn’t on', () => {
    const { w } = bearing([], 'mend');
    const weaverBefore = weaverOf(w).health!.hp;
    dealDamage(w, heroAt(w, 0), { source: null, sourceName: 't', amount: 200, telegraph: null });
    const bearer = bearing();
    dealDamage(bearer.w, heroAt(bearer.w, 1), {
      source: null,
      sourceName: 't',
      amount: 200,
      telegraph: null,
    });
    expect(weaverOf(w).health!.hp).toBe(weaverBefore);
    expect(weaverOf(bearer.w).health!.hp).toBe(weaverOf(bearer.w).health!.maxHp);
  });

  it('a hit Bear makes survivable is a Save', () => {
    const { w } = bearing();
    const kael = heroAt(w, 0);
    kael.health!.hp = 100;
    // 180 → 126 through armour: lethal alone, 82 with Bear's share taken.
    dealDamage(w, kael, { source: null, sourceName: 'Toll Cleave', amount: 180, telegraph: null });
    expect(kael.health!.hp).toBeGreaterThan(0);
    expect(w.ledger.saves.map((s) => s.cause)).toEqual(['bear']);
  });
});

describe('what Bear and the Vow won’t do', () => {
  it('Bear never takes more than leaves her at 1 life, Scarred Hide included', () => {
    const { w } = bearing(['scarred_hide']);
    const weaver = weaverOf(w);
    weaver.health!.hp = 20;
    dealDamage(w, heroAt(w, 0), { source: null, sourceName: 't', amount: 1000, telegraph: null });
    expect(weaver.health!.downed).toBe(false);
    expect(weaver.health!.hp).toBeCloseTo(1, 6);
  });

  it('a hit that fells the hero anyway costs her nothing, and Martyr’s Veil still catches it', () => {
    const sim = sandbox({ chords: GUARDIAN, ...martyr(), relics: ['martyrs_veil'] });
    stepFor(sim, 2, [{ t: 'thread', slot: 0 }, BEAR]);
    const w = worldOf(sim);
    heroAt(w, 0).health!.hp = 50;
    dealDamage(w, heroAt(w, 0), { source: null, sourceName: 't', amount: 1000, telegraph: null });
    expect(w.ledger.calling.borne).toBe(0);
    expect(w.ledger.saves.map((x) => x.cause)).toEqual(['martyr']);
  });

  it('while she’s untouchable, Bear lifts nothing', () => {
    const { w } = bearing();
    weaverOf(w).health!.invulnerable = 2;
    const kael = heroAt(w, 0);
    const before = kael.health!.hp;
    dealDamage(w, kael, { source: null, sourceName: 't', amount: 200, telegraph: null });
    const armor = CONTENT.heroes.find((h) => h.id === 'kael')!.armor;
    expect(before - kael.health!.hp).toBeCloseTo(200 * (1 - armor), 6);
    expect(w.ledger.calling.borne).toBe(0);
  });

  it('a hero Fermata holds needs neither Bear nor the Vow', () => {
    const sim = sandbox({
      chords: [
        { auras: ['fortissimo'], ornaments: [] },
        { auras: ['sostenuto', 'fermata'], ornaments: [] },
      ],
      ...martyr(),
    });
    stepFor(sim, 2, [{ t: 'thread', slot: 0 }, BEAR]);
    const w = worldOf(sim);
    const kael = heroAt(w, 0);
    kael.health!.hp = 50;
    dealDamage(w, kael, { source: null, sourceName: 't', amount: 1000, telegraph: null });
    expect(kael.hero!.hold).not.toBeNull();
    dealDamage(w, kael, { source: null, sourceName: 't', amount: 300, telegraph: null });
    expect(kael.health!.hp).toBe(1);
    expect(w.ledger.calling.borne).toBe(0);
  });

  it('Scarred Hide needs someone to Bear', () => {
    const sim = sandbox({ chords: GUARDIAN, ...martyr('scarred_hide') });
    stepFor(sim, 1, [BEAR]);
    const weaver = weaverOf(worldOf(sim));
    expect(weaver.weaver!.threadMode).toBe('bear');
    const before = weaver.health!.hp;
    dealDamage(worldOf(sim), weaver, {
      source: null,
      sourceName: 't',
      amount: 100,
      telegraph: null,
    });
    expect(before - weaver.health!.hp).toBeCloseTo(100, 6);
  });

  it('her own Aegis Ward isn’t counted as shielding the party', () => {
    const { sim, w } = bearing(
      ['penitence', 'blood_font', 'undying_devotion', 'martyrs_aegis'],
      'mend',
    );
    stepFor(sim, 1, [{ t: 'tech', id: 'ward', slot: 0 }]);
    const weaver = weaverOf(w);
    expect(weaver.health!.shields.some((x) => x.kind === 'ward')).toBe(true);
    const before = w.ledger.shielded;
    dealDamage(w, weaver, { source: null, sourceName: 't', amount: 50, telegraph: null });
    expect(w.ledger.shielded).toBe(before);
  });
});

describe('the path', () => {
  it('Penitence: what she bears fills Resonance', () => {
    const { w } = bearing(['penitence']);
    const before = weaverOf(w).weaver!.resonance;
    dealDamage(w, heroAt(w, 0), { source: null, sourceName: 't', amount: 200, telegraph: null });
    // What she lifted off Kael (before the toll softens it).
    const lifted = w.ledger.calling.shielded;
    expect(weaverOf(w).weaver!.resonance - before).toBeCloseTo(
      (lifted / 100) * value('penitence', 'per'),
      6,
    );
  });

  it('Scarred Hide: she takes less while she Bears', () => {
    const lost = (mode: 'bear' | 'mend') => {
      const { w } = bearing(['scarred_hide'], mode);
      const weaver = weaverOf(w);
      const before = weaver.health!.hp;
      dealDamage(w, weaver, { source: null, sourceName: 't', amount: 100, telegraph: null });
      return before - weaver.health!.hp;
    };
    expect(lost('bear')).toBeCloseTo(lost('mend') * (1 - value('scarred_hide', 'pct') / 100), 6);
  });

  it('Shared Wounds: while Bearing, a share of every other hero in the field', () => {
    const { sim, w } = bearing(['penitence', 'shared_wounds']);
    const lyra = heroAt(w, 1);
    expect(lyra.hero!.inField).toBe(true);
    const weaverBefore = weaverOf(w).health!.hp;
    const lyraBefore = lyra.health!.hp;
    dealDamage(w, lyra, { source: null, sourceName: 't', amount: 100, telegraph: null });
    const share = value('shared_wounds', 'pct') / 100;
    expect(lyraBefore - lyra.health!.hp).toBeCloseTo(100 * (1 - share), 6);
    expect(weaverBefore - weaverOf(w).health!.hp).toBeCloseTo(
      100 * share * (1 - passive('cut') / 100),
      6,
    );
    expect(ofType(sim.drainEvents(), 'borne')[0]).toMatchObject({ via: 'shared' });
  });

  it('Blood Font: below half her Life, what her songs reserve regenerates her', () => {
    const after = (path: string[]) => {
      const { sim, w } = bearing(path, 'mend');
      const weaver = weaverOf(w);
      weaver.health!.hp = weaver.health!.maxHp * 0.3;
      stepFor(sim, 60);
      return { hp: weaver.health!.hp, reserved: weaver.weaver!.reservedLife };
    };
    const plain = after(['penitence']);
    const font = after(['penitence', 'blood_font']);
    expect(font.hp - plain.hp).toBeCloseTo(font.reserved * (value('blood_font', 'pct') / 100), 1);
  });

  it('Undying Devotion: once a fight, the hit that would down her doesn’t', () => {
    const { sim, w } = bearing(['penitence', 'blood_font', 'undying_devotion'], 'mend');
    const weaver = weaverOf(w);
    const lyra = heroAt(w, 1);
    lyra.health!.hp = 100;
    dealDamage(w, weaver, { source: null, sourceName: 't', amount: 1e5, telegraph: null });
    expect(weaver.health!.downed).toBe(false);
    expect(weaver.health!.hp).toBe(1);
    expect(weaver.health!.invulnerable).toBeCloseTo(value('undying_devotion', 'seconds'), 6);
    expect(lyra.health!.hp).toBeCloseTo(
      100 + lyra.health!.maxHp * (value('undying_devotion', 'pct') / 100),
      6,
    );
    expect(ofType(sim.drainEvents(), 'undying')).toHaveLength(1);
    // Once: after the respite, the next one downs her.
    weaver.health!.invulnerable = 0;
    dealDamage(w, weaver, { source: null, sourceName: 't', amount: 1e5, telegraph: null });
    expect(weaver.health!.downed).toBe(true);
  });

  it('Low-Life Vigil: below a share of her Life, every aura is stronger', () => {
    const mult = (lifeShare: number) => {
      const { sim, w } = bearing(['penitence', 'blood_font', 'low_life_vigil'], 'mend');
      const weaver = weaverOf(w);
      weaver.health!.hp = weaver.weaver!.maxLife * lifeShare;
      stepFor(sim, 1);
      return w.scratch.auraMult[CONTENT.auras.findIndex((a) => a.id === 'sostenuto')]!;
    };
    // Guardian leaves her 45% of her Life: at 40% she isn't low, at 30% she is.
    expect(mult(0.3)).toBeCloseTo(mult(0.4) * (1 + value('low_life_vigil', 'pct') / 100), 6);
  });

  it('Martyr’s Aegis: Wards are stronger, and each one shields her too', () => {
    const ward = (path: string[]) => {
      const { sim, w } = bearing(path, 'mend');
      stepFor(sim, 1, [{ t: 'tech', id: 'ward', slot: 0 }]);
      const shield = (e: ReturnType<typeof heroAt>) =>
        e.health!.shields.find((s) => s.kind === 'ward')?.amount ?? 0;
      return { kael: shield(heroAt(w, 0)), weaver: shield(weaverOf(w)), w };
    };
    const base = ['penitence', 'blood_font', 'undying_devotion'];
    const plain = ward(base);
    const aegis = ward([...base, 'martyrs_aegis']);
    const mult = 1 + value('martyrs_aegis', 'pct') / 100;
    expect(aegis.kael).toBeCloseTo(plain.kael * mult, 6);
    expect(plain.weaver).toBe(0);
    const def = CONTENT.techniques.ward;
    const weaverMax = weaverOf(aegis.w).health!.maxHp;
    expect(aegis.weaver).toBeCloseTo((weaverMax * def.barrierPct + def.barrierFlat) * mult, 6);
  });

  it('Sanguine Covenant: Mend heals her too', () => {
    const gained = (path: string[]) => {
      const { sim, w } = bearing(path, 'mend');
      const weaver = weaverOf(w);
      const kael = heroAt(w, 0);
      weaver.health!.hp = 50;
      kael.health!.hp = 400;
      stepFor(sim, 30);
      return { weaver: weaver.health!.hp, mended: w.ledger.thread.healing };
    };
    const base = ['penitence', 'blood_font', 'undying_devotion'];
    const plain = gained(base);
    const covenant = gained([...base, 'sanguine_covenant']);
    expect(covenant.mended).toBeCloseTo(plain.mended, 6);
    expect(covenant.weaver - plain.weaver).toBeCloseTo(
      covenant.mended * (value('sanguine_covenant', 'pct') / 100),
      6,
    );
  });
});

describe('Martyr’s Vow', () => {
  function vowed() {
    const { sim, w } = bearing([], 'mend');
    weaverOf(w).weaver!.resonance = CONTENT.resonance.max;
    const events = stepFor(sim, 1, [{ t: 'crescendo' }]);
    return { sim, w, events };
  }

  it('replaces Sunrise: no surge, no heal, its own name', () => {
    const { w, events } = vowed();
    expect(w.field.vow).toBe(true);
    expect(w.field.crescendo).toBe(false);
    const start = ofType(events, 'crescendoStart')[0]!;
    expect(start.calling).toBe(CONTENT.callings.find((c) => c.id === 'martyr')!.crescendoName);
    expect(start.duration).toBeCloseTo(passive('vow'), 6);
    expect(ofType(events, 'healApplied').filter((e) => e.via === 'other')).toHaveLength(0);
  });

  it('a hero can’t drop below 1 life; she takes the rest, softened, and it’s a Save', () => {
    const { w } = vowed();
    const lyra = heroAt(w, 1);
    const weaver = weaverOf(w);
    const before = { lyra: lyra.health!.hp, weaver: weaver.health!.hp };
    dealDamage(w, lyra, { source: null, sourceName: 'Dirge', amount: 1000, telegraph: null });
    expect(lyra.health!.hp).toBe(1);
    const excess = 1000 - (before.lyra - 1);
    expect(before.weaver - weaver.health!.hp).toBeCloseTo(
      excess * (1 - passive('redirect') / 100),
      6,
    );
    expect(w.ledger.saves.map((s) => s.cause)).toEqual(['vow']);
  });

  it('one Save a hero, however often it holds them', () => {
    const { w } = vowed();
    const lyra = heroAt(w, 1);
    // (Small enough that the overflow doesn't down her: that would end the Vow.)
    for (const amount of [900, 200, 200])
      dealDamage(w, lyra, { source: null, sourceName: 'Dirge', amount, telegraph: null });
    expect(weaverOf(w).health!.downed).toBe(false);
    expect(lyra.health!.hp).toBe(1);
    expect(w.ledger.saves.map((x) => x.cause)).toEqual(['vow']);
  });

  it('ends when she goes down', () => {
    const { w } = vowed();
    dealDamage(w, weaverOf(w), { source: null, sourceName: 't', amount: 1e5, telegraph: null });
    expect(weaverOf(w).health!.downed).toBe(true);
    expect(w.field.vow).toBe(false);
  });

  it('a hit that lands while it holds is never lethal; one that lands after it ends still is', () => {
    const { sim, w } = vowed();
    const clock = weaverOf(w).weaver!;
    clock.crescendo = 30; // (long enough for the brute to wind up)
    const { telegraph } = telegraphOn('bell_brute', 'Toll Cleave', 0, 2.5, sim, true);
    // Kael's alone in the cleave (the Vow doesn't hold her), at 1 life.
    const weaver = weaverOf(w);
    weaver.x = weaver.px = 0;
    weaver.z = weaver.pz = 3;
    heroAt(w, 0).health!.hp = 1;
    stepFor(sim, 1);
    expect(weaver.health!.incoming).toBe(0);
    expect(w.field.vow).toBe(true);
    expect(vowHoldsAt(w, telegraph.impact)).toBe(true);
    expect(heroAt(w, 0).health!.incoming).toBeGreaterThan(heroAt(w, 0).health!.hp);
    expect(telegraph.severity).toBe('normal');
    // The Vow ends before it lands: lethal again.
    clock.crescendo = (telegraph.impact - w.time) / 2;
    stepFor(sim, 1);
    expect(w.field.vow).toBe(true);
    expect(vowHoldsAt(w, telegraph.impact)).toBe(false);
    expect(telegraph.severity).toBe('lethal');
    // A hit in the Vow's last tick doesn't count: its clock runs out before telegraphs land.
    clock.crescendo = telegraph.impact - w.time;
    expect(vowHoldsAt(w, telegraph.impact)).toBe(false);
    clock.crescendo = telegraph.impact - w.time + 2 / 60;
    expect(vowHoldsAt(w, telegraph.impact)).toBe(true);
  });

  it('doubles her healing received, and ends on time', () => {
    const { sim, w } = vowed();
    const weaver = weaverOf(w);
    weaver.health!.hp = 50;
    heal(w, weaver, 10, 'other');
    expect(weaver.health!.hp).toBeCloseTo(50 + 10 * passive('healing'), 6);
    // (Its opening slow-motion costs a few ticks of sim time.)
    stepFor(sim, Math.ceil(60 * passive('vow')) - 30);
    expect(w.field.vow).toBe(true);
    stepFor(sim, 60);
    expect(w.field.vow).toBe(false);
  });
});
