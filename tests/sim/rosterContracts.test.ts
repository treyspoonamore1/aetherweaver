/**
 * Phase 5e's contracts, before any Seren or Oro behaviour (docs/phase-5e.md, W0b): the passive
 * union and its one reader, the new content and its lint, the pure shared rules, and every
 * generic-but-inert guard W0b put in a shared file, each shown to do nothing in a party without
 * Seren or Oro and to act on a hand-made summon. A Seren party and an Oro party build and play
 * (the interim ranged branch) without throwing.
 */
import { describe, expect, it } from 'vitest';
import { makeBot } from '../../src/bots';
import {
  CONTENT,
  bloodRageOf,
  enemyDef,
  heroDef,
  partyTaunts,
  partyInterrupts,
} from '../../src/content';
import {
  DUEL_CLAMP,
  DUEL_PICK,
  HEAVY_LIFE,
  PARRY_REACH,
  SAPLING_FRONT,
  SAPLING_SPREAD,
  SEREN_LEASH,
} from '../../src/content/rosterIds';
import { ROSTER_DEEDS } from '../../src/content/rosterDeeds';
import { ContentSchema, HeroDefSchema } from '../../src/content/schema';
import {
  createSim,
  duelTarget,
  gentle,
  groveCallReady,
  heavy,
  isSummon,
  lungeTarget,
  overextended,
  parryArmed,
  parryable,
  saplingInField,
  summonsOf,
} from '../../src/sim';
import { addShield, addStatus, applyStatusPayload, dealDamage } from '../../src/sim/combat/health';
import { KNOWN_ALT_SOLOS, KNOWN_TALENTS } from '../../src/sim/bonds';
import { KNOWN_MOTIFS, NO_MODS } from '../../src/sim/mods';
import type { Entity } from '../../src/sim/state';
import { spawnEnemy } from '../../src/sim/systems/enemies';
import { updateField } from '../../src/sim/systems/field';
import { untauntedTarget, rootable } from '../../src/sim/systems/grove';
import { updatePendingHits } from '../../src/sim/systems/hits';
import { resolveOverlaps } from '../../src/sim/systems/physics';
import { ofParty } from '../../src/sim/systems/stasis';
import { summonFell, updateSummons } from '../../src/sim/systems/summons';
import { newHealth, type World } from '../../src/sim/world';
import { allowanceFor, EVERYTHING } from '../../src/meta/profile';
import { threatFor } from '../../src/meta/economy';
import * as Run from '../../src/meta/run';
import type { MapNode, RunState } from '../../src/meta/types';
import { sandbox, stepFor, worldOf } from './helpers';

const OLD = ['kael', 'lyra', 'vexis', 'brann'] as const;

function heroAt(w: World, slot: number): Entity {
  return w.entities.get(w.party[slot]!)!;
}

function place(e: Entity, x: number, z: number): void {
  e.x = e.px = x;
  e.z = e.pz = z;
  e.vx = e.vz = 0;
}

/** A summon made by hand (W2 owns `spawnSummon`): planted, unkillable, owned by `owner`. */
function handSummon(w: World, owner: Entity, x: number, z: number): Entity {
  const s = w.entities.spawn('summon', {
    x,
    z,
    radius: 0.55,
    height: 1.2,
    team: 'party',
    mass: 1,
    health: newHealth(1e6, 1e6),
    summon: {
      owner: owner.id,
      kind: 'sapling',
      index: 0,
      targetId: null,
      attackCooldown: 0,
      tauntAt: 0,
      plantX: x,
      plantZ: z,
      mendHealAcc: 0,
      auraHealAcc: 0,
    },
  });
  w.entities.flush();
  return s;
}

/** Holds every hero still and unkillable. */
function freeze(w: World): void {
  for (const id of w.party) {
    const h = w.entities.get(id)!;
    addStatus(w, h, 'stun', 1e6, null);
    h.health!.hp = h.health!.maxHp = 1e6;
  }
}

describe('the passive union (docs/phase-5e.md, contracts item 1)', () => {
  it('parses every existing def unchanged, and bloodRageOf equals the old truthiness', () => {
    for (const id of OLD) {
      const def = heroDef(id);
      expect(HeroDefSchema.parse(def), id).toEqual(def);
      expect(!!bloodRageOf(def), id).toBe(!!def.passive);
      if (def.passive) expect(bloodRageOf(def)).toBe(def.passive);
    }
    expect(bloodRageOf(heroDef('brann'))).toMatchObject({ id: 'bloodRage', weaverHealMult: 0.5 });
    expect(bloodRageOf(heroDef('seren'))).toBeNull();
    expect(bloodRageOf(heroDef('oro'))).toBeNull();
    expect(heroDef('seren').passive).toEqual({
      id: 'parry',
      counterPct: 3,
      reach: 1,
      killShotRange: 9,
      killShotMult: 6,
      eliteExecuteBelow: 0.5,
    });
    expect(heroDef('oro').passive).toEqual({ id: 'rootbond', mendShare: 0.5 });
  });

  it('a Seren or Oro party spawns duel or grove state, and no blood', () => {
    const sim = createSim({ seed: 3, encounter: 'first_light', party: ['kael', 'seren', 'oro'] });
    const [kael, seren, oro] = sim.state.party.map((id) => sim.state.entities.get(id)!);
    expect('duel' in kael!.hero! || 'grove' in kael!.hero! || 'blood' in kael!.hero!).toBe(false);
    expect(seren!.hero!.duel).toMatchObject({ parryOn: null, killShotOn: null, parries: 0 });
    expect('blood' in seren!.hero! || 'grove' in seren!.hero!).toBe(false);
    // `ancients` counts the Ancients raised (HeroGroveStats.ancients reads it at the end).
    // W2: his two Saplings sprout with him (after the party, so the slots keep their ids).
    expect(oro!.hero!.grove).toMatchObject({ ancient: null, lost: 0, ancients: 0 });
    expect(oro!.hero!.grove!.saplings).toHaveLength(2);
    expect('blood' in oro!.hero! || 'duel' in oro!.hero!).toBe(false);
  });
});

describe('the new content (docs/phase-5e.md)', () => {
  it('appends Seren and Oro at their numbers and colours', () => {
    expect(CONTENT.heroes.map((h) => h.id).slice(-2)).toEqual(['seren', 'oro']);
    expect(heroDef('seren')).toMatchObject({
      role: 'duelist',
      color: '#a018f8',
      maxHp: 900,
      dodge: 0.45,
      formation: { forward: 2, right: -1.9 },
      attack: { kind: 'melee', damage: 60, interval: 0.75, range: 2.2 },
      solo: { id: 'thousandCuts', pulse: 0.5, reach: 10, extendCap: 4 },
      quirk: { id: 'showboat', leash: 12, seconds: 8 },
      call: { ability: 0, answer: 'ward', flourish: { name: 'Flèche', damageMult: 1.6 } },
      recruit: { event: 'tithe_altar', fallback: 'gorehound_matriarch', rank: 8 },
    });
    expect(heroDef('oro')).toMatchObject({
      role: 'summoner',
      color: '#487858',
      maxHp: 950,
      threatMult: 0.6,
      formation: { forward: -3.4, right: 0 },
      solo: { id: 'wildgrowth', radius: 7, pulse: 1, cuedPower: 6 },
      quirk: { id: 'gentle', retreat: 4 },
      call: { ability: 0, answer: 'chime', flourish: { name: 'Spring Rain', soloCharge: 20 } },
      summons: { sapling: { count: 2, maxHp: 380, front: { forward: 5, spread: 2.5 } } },
      recruit: { event: 'loose_thread', fallback: 'the_seamstress', rank: 12 },
    });
    // Brann's two hard-coded lines are content now, unchanged.
    expect(heroDef('brann').recruit).toMatchObject({
      lockedText: 'Free him from the Legion’s cell in Movement II, or face Vharun.',
      fallbackText:
        'In the chaos of your stand against Vharun, the prisoner slipped his chain. He’ll find you before your next run.',
    });
  });

  it('their Bonds, alternate Solos, scenes and motifs are appended, and the sim knows them', () => {
    const ids = (hero: string) => CONTENT.talents.filter((t) => t.hero === hero).map((t) => t.id);
    expect(ids('seren')).toEqual([
      'riposte_chain',
      'cold_focus',
      'bladesong',
      'unflinching',
      'thousandfold',
      'duellists_honour',
    ]);
    expect(ids('oro')).toEqual([
      'taproot',
      'thorned_bark',
      'grove_chorus',
      'old_growth',
      'world_tree',
      'seedling_swarm',
    ]);
    expect(KNOWN_TALENTS.slice(-12)).toEqual([...ids('seren'), ...ids('oro')]);
    // Q7: no talent is called Deep Roots.
    expect(CONTENT.talents.some((t) => /deep roots/i.test(t.name))).toBe(false);
    expect(CONTENT.altSolos.slice(-2).map((s) => [s.id, s.hero])).toEqual([
      ['blade_waltz', 'seren'],
      ['homecoming', 'oro'],
    ]);
    expect(KNOWN_ALT_SOLOS.slice(-2)).toEqual(['blade_waltz', 'homecoming']);
    // SoloKind holds the six main Solos only; the alternates are KNOWN_ALT_SOLOS.
    expect(CONTENT.heroes.map((h) => h.solo.id)).toEqual([
      'aegisWall',
      'galeBarrage',
      'starfall',
      'redFrenzy',
      'thousandCuts',
      'wildgrowth',
    ]);
    expect(CONTENT.scenes.slice(-4).map((s) => [s.id, s.rank])).toEqual([
      ['seren_ledger', 2],
      ['seren_paid', 7],
      ['oro_names', 2],
      ['oro_last_grove', 7],
    ]);
    expect(CONTENT.motifs.slice(-2).map((m) => [m.id, m.requires.hero, m.values])).toEqual([
      ['en_garde', 'seren', [8, 10, 12]],
      ['verdant_choir', 'oro', [30, 40, 50]],
    ]);
    expect(KNOWN_MOTIFS.slice(-2)).toEqual(['en_garde', 'verdant_choir']);
    expect(NO_MODS.enGarde).toBe(0);
    expect(NO_MODS.verdantChoir).toBe(0);
    // ROSTER_DEEDS is concatenated last (W3 filled it): the 27 keep their order.
    expect(ROSTER_DEEDS.map((d) => d.id)).toEqual(['debt_paid', 'not_a_leaf_lost']);
    expect(CONTENT.deeds).toHaveLength(29);
    expect(CONTENT.deeds.slice(27)).toStrictEqual(ROSTER_DEEDS);
  });

  it('the shared constants', () => {
    expect([PARRY_REACH, DUEL_CLAMP, DUEL_PICK, SEREN_LEASH, HEAVY_LIFE]).toEqual([
      6, 13, 12, 9, 5000,
    ]);
    expect([SAPLING_FRONT, SAPLING_SPREAD]).toEqual([5, 2.5]);
  });

  it('the recruiting choices are appended last, Rank-gated, on encounters no other choice fights', () => {
    const choice = (event: string) => CONTENT.events.find((e) => e.id === event)!.choices.at(-1)!;
    expect(choice('tithe_altar')).toMatchObject({
      id: 'debt',
      rank: 8,
      effects: [{ kind: 'fight', encounter: 'legion_vanguard', relics: 3, recruit: 'seren' }],
    });
    expect(choice('loose_thread')).toMatchObject({
      id: 'follow',
      rank: 12,
      effects: [{ kind: 'fight', encounter: 'frayed_court', relics: 3, recruit: 'oro' }],
    });
  });

  it('partyTaunts and partyInterrupts read the kits', () => {
    expect(partyTaunts(['kael', 'lyra', 'vexis'])).toBe(true);
    expect(partyTaunts(['lyra', 'vexis', 'oro'])).toBe(false);
    expect(partyTaunts(['brann', 'seren', 'oro'])).toBe(false);
    expect(partyInterrupts(['vexis', 'seren', 'oro'])).toBe(true);
    expect(partyInterrupts(['vexis', 'oro'])).toBe(false);
    expect(partyInterrupts(['nobody'])).toBe(false);
  });

  it('Allowance.recruits holds a ranked recruit only from its Rank; EVERYTHING holds them all', () => {
    expect([...EVERYTHING.recruits]).toEqual(['brann', 'seren', 'oro']);
    expect([...allowanceFor(1).recruits]).toEqual(['brann']);
    expect([...allowanceFor(7).recruits]).toEqual(['brann']);
    expect([...allowanceFor(8).recruits]).toEqual(['brann', 'seren']);
    expect([...allowanceFor(11).recruits]).toEqual(['brann', 'seren']);
    expect([...allowanceFor(12).recruits]).toEqual(['brann', 'seren', 'oro']);
  });
});

describe('the roster lint (docs/phase-5e.md)', () => {
  const broken = (edit: (c: ReturnType<typeof structuredClone<typeof CONTENT>>) => void) => {
    const c = structuredClone(CONTENT);
    edit(c);
    const parsed = ContentSchema.safeParse(c);
    return parsed.success ? [] : parsed.error.issues.map((i) => i.message);
  };
  const hero = (c: typeof CONTENT, id: string) => c.heroes.find((h) => h.id === id)!;
  const choice = (c: typeof CONTENT, ev: string, id: string) =>
    c.events.find((e) => e.id === ev)!.choices.find((x) => x.id === id)!;

  it('passes for the six heroes', () => {
    expect(ContentSchema.safeParse(structuredClone(CONTENT)).success).toBe(true);
  });

  it('Codex names healing for Blood Rage only', () => {
    expect(broken((c) => void (hero(c, 'seren').codex = 'A duellist.'))).toEqual([]);
    expect(broken((c) => void (hero(c, 'brann').codex = 'A champion.'))).toContain(
      'hero "brann" has a passive: its Codex names healing',
    );
  });

  it('every recruit carries its locked and fallback lines', () => {
    expect(broken((c) => void delete hero(c, 'brann').recruit!.lockedText)).toContain(
      'hero "brann": a recruit needs lockedText and fallbackText',
    );
    expect(broken((c) => void delete hero(c, 'oro').recruit!.fallbackText)).toContain(
      'hero "oro": a recruit needs lockedText and fallbackText',
    );
  });

  it('a ranked recruit and its choice agree, and the ranked choice comes last', () => {
    expect(broken((c) => void (hero(c, 'seren').recruit!.rank = 9))).toContain(
      'hero "seren": event "tithe_altar" choice "debt" needs rank 9',
    );
    expect(
      broken((c) => {
        const ev = c.events.find((e) => e.id === 'tithe_altar')!;
        ev.choices.unshift(ev.choices.pop()!);
      }),
    ).toContain(
      'event "tithe_altar" choice "debt": a ranked choice comes after every unranked one',
    );
  });

  it('a recruiting choice fights an encounter no other choice of its event fights', () => {
    // Revision 1's `follow`, on `pull`'s encounter: recruitsOf would have recruited off `pull`.
    expect(
      broken((c) => {
        const e = choice(c, 'loose_thread', 'follow').effects[0]!;
        if (e.kind === 'fight') e.encounter = 'unstitched_vanguard';
      }),
    ).toContain(
      'event "loose_thread" choice "follow": choice "pull" also fights "unstitched_vanguard"',
    );
  });

  it('per-kit rules, and pairwise formation for six', () => {
    expect(broken((c) => void delete hero(c, 'seren').abilities[1].taunt)).toContain(
      'hero "seren" ability "feint" needs taunt and step',
    );
    expect(broken((c) => void delete hero(c, 'oro').abilities[0].regrow)).toContain(
      'hero "oro" ability "regrowth" needs regrow and healPct',
    );
    expect(broken((c) => void delete hero(c, 'seren').solo.reach)).toContain(
      'hero "seren" solo "thousandCuts" needs pulse, reach and extendCap',
    );
    expect(broken((c) => void delete hero(c, 'seren').quirk.leash)).toContain(
      'hero "seren" quirk "showboat" needs leash and seconds',
    );
    expect(broken((c) => void delete hero(c, 'oro').summons)).toContain(
      'hero "oro": a summoner, and only a summoner, has summons',
    );
    expect(broken((c) => void (hero(c, 'oro').formation = { forward: -3.4, right: 1 }))).toEqual(
      [],
    );
    expect(
      broken((c) => void (hero(c, 'seren').formation = { forward: 2.6, right: -0.5 })),
    ).toContain('heroes "kael" and "seren": formation spots 1.5 m apart');
  });
});

describe('the pure rules (docs/phase-5e.md, contracts item 5)', () => {
  it('parryable: every enumerated cone, never Crimson Tide, a Toll or a beam', () => {
    const PARRYABLE = [
      'brute_toll_cleave',
      'bellwarden_slam',
      'cantor_toll',
      'leech_latch',
      'gorehound_rend',
      'vharun_twin_cleave',
      'vharun_twin_cleave_second',
      'unweaver_shear',
      'champion_cleave',
      'conductor_downbeat',
    ];
    expect(CONTENT.attacks.filter((a) => parryable(a)).map((a) => a.id)).toEqual(PARRYABLE);
    for (const id of ['vharun_crimson_tide', 'bellwarden_toll_out', 'bellwarden_toll_in'])
      expect(parryable(CONTENT.attacks.find((a) => a.id === id)), id).toBe(false);
    expect(parryable(null)).toBe(false);
  });

  it('heavy matches the enumeration: of every lesser def, only the Hollow Champion', () => {
    const lesser = CONTENT.enemies.filter((e) => e.role !== 'boss' && e.role !== 'miniboss');
    const sim = sandbox();
    const w = worldOf(sim);
    const heavyIds = lesser
      .filter((d) => heavy(w, { enemy: { tier: 'normal', defId: d.id } } as never))
      .map((d) => d.id);
    expect(heavyIds).toEqual(['mirror_champion']);
    // Bosses and minibosses are excluded by tier: heavy reads false on them.
    const boss = CONTENT.enemies.find((e) => e.role === 'boss')!;
    expect(heavy(w, { enemy: { tier: 'boss', defId: boss.id } } as never)).toBe(false);
  });

  it('duelTarget: Focus, then tier, life and id within 12 m of the Weaver, Kael’s left to him', () => {
    const sim = sandbox({ party: ['kael', 'lyra', 'seren'] });
    const w = worldOf(sim);
    freeze(w);
    const seren = heroAt(w, 2);
    place(w.entities.get(w.weaverId)!, 0, 0);
    const a = spawnEnemy(w, 'hollow_chorister', 4, 0, { instant: true });
    const b = spawnEnemy(w, 'hollow_chorister', -4, 0, { instant: true, elite: true });
    const far = spawnEnemy(w, 'bell_brute', 0, 20, { instant: true, elite: true });
    w.entities.flush();
    expect(duelTarget(w, seren)?.id).toBe(b.id);
    // An elite Kael is on: she takes the other one.
    heroAt(w, 0).hero!.targetId = b.id;
    expect(duelTarget(w, seren)?.id).toBe(a.id);
    // Your Focus wins, wherever it is.
    w.focusTarget = far.id;
    expect(duelTarget(w, seren)?.id).toBe(far.id);
    // Not a duellist: no pick.
    expect(duelTarget(w, heroAt(w, 1))).toBeNull();
  });

  it('duelTarget: an enemy swinging at Kael is his even while Kael has no target (a Rally)', () => {
    const sim = sandbox({ party: ['kael', 'lyra', 'seren'] });
    const w = worldOf(sim);
    freeze(w);
    const kael = heroAt(w, 0);
    const seren = heroAt(w, 2);
    place(w.entities.get(w.weaverId)!, 0, 0);
    const a = spawnEnemy(w, 'hollow_chorister', 4, 0, { instant: true });
    const b = spawnEnemy(w, 'hollow_chorister', -4, 0, { instant: true, elite: true });
    w.entities.flush();
    kael.hero!.targetId = null;
    b.enemy!.targetId = kael.id;
    expect(duelTarget(w, seren)?.id).toBe(a.id);
    // His is the only choice: she takes it.
    a.health!.dead = true;
    expect(duelTarget(w, seren)?.id).toBe(b.id);
    // Without Kael in the party, nothing is anyone's: the strongest wins.
    const solo = sandbox({ party: ['lyra', 'vexis', 'seren'] });
    const v = worldOf(solo);
    freeze(v);
    place(v.entities.get(v.weaverId)!, 0, 0);
    spawnEnemy(v, 'hollow_chorister', 4, 0, { instant: true });
    const e = spawnEnemy(v, 'hollow_chorister', -4, 0, { instant: true, elite: true });
    v.entities.flush();
    e.enemy!.targetId = heroAt(v, 0).id;
    expect(duelTarget(v, heroAt(v, 2))?.id).toBe(e.id);
  });

  it('parryArmed, overextended and lungeTarget are false or null for every other hero', () => {
    const sim = sandbox({ party: ['kael', 'lyra', 'seren'] });
    const w = worldOf(sim);
    const [kael, , seren] = [0, 1, 2].map((s) => heroAt(w, s));
    addShield(w, kael!, 'ward', 300, 3, true);
    expect(parryArmed(kael!)).toBe(false);
    expect(parryArmed(seren!)).toBe(false);
    addShield(w, seren!, 'ward', 300, 3, true);
    expect(parryArmed(seren!)).toBe(true);
    expect(overextended(w, kael!)).toBe(false);
    expect(overextended(w, seren!)).toBe(false);
    const lunge = heroDef('seren').abilities[0];
    expect(lungeTarget(w, kael!, lunge)).toBeNull();
  });

  it('summonsOf is empty, isSummon false, and the grove rules quiet, for a default party', () => {
    const sim = createSim({ seed: 5, encounter: 'first_light' });
    const bot = makeBot('skilled', 5);
    for (let t = 0; t < 600; t++) sim.step(bot.decide(sim.state));
    expect(summonsOf(sim.state)).toEqual([]);
    for (const e of sim.state.entities.list()) {
      expect(isSummon(e)).toBe(false);
      expect(gentle(sim.state, e)).toBe(false);
      expect(groveCallReady(sim.state, e)).toBe(false);
    }
  });

  it('saplingInField matches a probe hero’s inField (coverage() !== 0 inside a field)', () => {
    const sim = sandbox({ auras: ['sostenuto'] });
    const w = worldOf(sim);
    const weaver = w.entities.get(w.weaverId)!;
    const probe = heroAt(w, 0);
    const check = (label: string) => {
      for (const [x, z] of [
        [0, 0],
        [3, 2],
        [6, 0],
        [0, 9],
        [14, 0],
        [-20, 5],
      ] as const) {
        place(probe, weaver.x + x, weaver.z + z);
        updateField(w, 0);
        expect(saplingInField(w, probe), `${label} at ${x},${z}`).toBe(probe.hero!.inField);
      }
    };
    check('open field');
    // A Mute's dome over some of the spots.
    const mute = spawnEnemy(w, 'mute', weaver.x + 6, weaver.z, { instant: true });
    w.entities.flush();
    check('a Mute dome');
    mute.health!.dead = true;
    // The hymn circles.
    w.field.hymnCircles.push({ x: weaver.x + 3, z: weaver.z + 2, r: 2 });
    check('the Silent Verse');
    w.field.hymnCircles.length = 0;
    // The Weaver downed: every field is suppressed.
    weaver.health!.downed = true;
    check('suppressed');
  });

  it('saplingInField: a song with nothing for the party, or whose verse is stolen, is no field', () => {
    const probeAll = (w: World, label: string, expected?: boolean) => {
      const weaver = w.entities.get(w.weaverId)!;
      const probe = heroAt(w, 0);
      for (const [x, z] of [
        [1, 0],
        [3, 2],
        [0, 9],
      ] as const) {
        place(probe, weaver.x + x, weaver.z + z);
        updateField(w, 0);
        expect(saplingInField(w, probe), `${label} at ${x},${z}`).toBe(probe.hero!.inField);
        if (expected !== undefined && x === 1) expect(probe.hero!.inField, label).toBe(expected);
      }
    };
    // A Lullaby-only song: its chord has a radius, but sings only for enemies.
    const lull = worldOf(sandbox({ auras: ['lullaby'] }));
    expect(lull.field.chords.some((c) => c.radius > 0 || c.auras.length > 0)).toBe(true);
    updateField(lull, 0);
    expect(lull.field.chords.some((c) => c.radius > 0)).toBe(true);
    probeAll(lull, 'lullaby only', false);
    // Sostenuto, then its verse stolen: the field is gone for the party while it is.
    const w = worldOf(sandbox({ auras: ['sostenuto'] }));
    probeAll(w, 'sostenuto', true);
    const chord = w.field.chords.find((c) => c.auras.includes('sostenuto'))!;
    w.field.stolen = {
      chord: chord.index,
      aura: chord.auras.indexOf('sostenuto'),
      add: w.weaverId,
      until: 1e9,
    };
    probeAll(w, 'stolen', false);
    delete w.field.stolen;
    probeAll(w, 'returned', true);
  });
});

describe('the inert guards (docs/phase-5e.md, ground rule 4)', () => {
  it('updateSummons returns at once without summons: the hash is untouched', () => {
    const sim = createSim({ seed: 9, encounter: 'crimson_gate' });
    const w = worldOf(sim);
    stepFor(sim, 120);
    const before = sim.hash();
    updateSummons(w, 1 / 60);
    expect(sim.hash()).toBe(before);
    expect(w.internal.summons).toBeUndefined();
  });

  it('a basic melee swing (`melee: true`) on a non-duelist lands exactly as before', () => {
    const run = (melee: boolean) => {
      const sim = sandbox();
      const w = worldOf(sim);
      const kael = heroAt(w, 0);
      const result = dealDamage(w, kael, {
        source: null,
        sourceName: 'test',
        amount: 300,
        ...(melee ? { melee: true as const } : {}),
      });
      return { result, hp: kael.health!.hp, hash: sim.hash() };
    };
    expect(run(true)).toEqual(run(false));
    expect('parried' in run(true).result).toBe(false);
  });

  it('`rooted` is never applied without Oro, and never holds a boss or a heavy foe', () => {
    const sim = createSim({ seed: 21, encounter: 'bellwarden' });
    const bot = makeBot('skilled', 21);
    for (let t = 0; t < 1200; t++) {
      sim.step(bot.decide(sim.state));
      for (const ev of sim.drainEvents())
        if (ev.type === 'statusApplied') expect(ev.status).not.toBe('rooted');
    }
    for (const e of sim.state.entities.list())
      expect(e.enemy?.rootImmuneUntil, String(e.id)).toBeUndefined();
    const w = worldOf(sandbox());
    const normal = spawnEnemy(w, 'hollow_chorister', 3, 3, { instant: true });
    const champion = spawnEnemy(w, 'mirror_champion', -3, 3, { instant: true });
    const boss = spawnEnemy(w, 'the_bellwarden', 0, 8, { instant: true });
    expect(rootable(w, normal)).toBe(true);
    expect(rootable(w, champion)).toBe(false);
    expect(rootable(w, boss)).toBe(false);
    expect(addStatus(w, boss, 'rooted', 1.5, null)).toBe(false);
    expect(addStatus(w, heroAt(w, 0), 'rooted', 1.5, null)).toBe(false);
  });

  it('no default-party fight ever holds a summon, so no summon guard is reached', () => {
    for (const [encounter, seed] of [
      ['first_light', 4],
      ['crimson_gate', 7],
      ['frayed_threshold', 8],
    ] as const) {
      const sim = createSim({ seed, encounter });
      const bot = makeBot('skilled', seed);
      for (let t = 0; t < 900; t++) {
        sim.step(bot.decide(sim.state));
        if (t % 60 === 0)
          for (const e of sim.state.entities.list()) expect(e.kind).not.toBe('summon');
      }
      expect(worldOf(sim).internal.summons).toBeUndefined();
    }
  });

  it('a summon takes no status (addStatus and a payload alike)', () => {
    const w = worldOf(sandbox());
    const s = handSummon(w, heroAt(w, 0), 2, 2);
    expect(addStatus(w, s, 'bleed', 3, null)).toBe(false);
    expect(addStatus(w, s, 'stun', 3, null)).toBe(false);
    expect(applyStatusPayload(w, s, { id: 'bleed', duration: 4, stacks: 1, dps: 10 }, null)).toBe(
      false,
    );
    expect(applyStatusPayload(w, s, { id: 'wound', duration: 4 }, null)).toBe(false);
    expect(s.health!.statuses).toEqual([]);
  });

  it('ofParty holds a summon only once it is in the summons list', () => {
    const w = worldOf(sandbox());
    const s = handSummon(w, heroAt(w, 0), 2, 2);
    expect(ofParty(w, s.id)).toBe(false);
    w.internal.summons = [s.id];
    expect(ofParty(w, s.id)).toBe(true);
    expect(ofParty(w, w.party[0]!)).toBe(true);
    expect(ofParty(w, null)).toBe(false);
  });

  it('a summon is pinned in the overlap pass; heroes are as before', () => {
    const w = worldOf(sandbox());
    const s = handSummon(w, heroAt(w, 0), 5, 5);
    const e = spawnEnemy(w, 'hollow_chorister', 5.3, 5, { instant: true });
    w.entities.flush();
    resolveOverlaps(w);
    expect([s.x, s.z]).toEqual([5, 5]);
    expect(e.x).toBeGreaterThan(5.3);
  });

  it('enemy splash and chain skip a summon', () => {
    const w = worldOf(sandbox());
    const kael = heroAt(w, 0);
    place(kael, 8, 8);
    const s = handSummon(w, kael, 8.8, 8);
    const enemy = spawnEnemy(w, 'hollow_chorister', 0, 14, { instant: true });
    w.entities.flush();
    w.internal.pendingHits.push({
      at: w.time,
      source: enemy.id,
      target: kael.id,
      amount: 100,
      amplified: 0,
      aura: 0,
      empower: 0,
      crit: false,
      splashRadius: 4,
      splash: 1,
      chain: 3,
      empowered: false,
      stun: 0,
    });
    updatePendingHits(w);
    expect(s.health!.hp).toBe(1e6);
    expect(kael.health!.hp).toBeLessThan(kael.health!.maxHp);
  });

  it('a summon at 0 life is felled, never killed as an enemy', () => {
    const w = worldOf(sandbox());
    const s = handSummon(w, heroAt(w, 0), 3, 3);
    s.health!.hp = s.health!.maxHp = 50;
    expect(() => dealDamage(w, s, { source: null, sourceName: 'test', amount: 500 })).not.toThrow();
    expect(s.health!.dead).toBe(true);
    summonFell(w, s, null);
  });

  it('a special that would aim at a summon re-aims at the party; a blow on it never Severs', () => {
    const sim = sandbox();
    const w = worldOf(sim);
    freeze(w);
    const weaver = w.entities.get(w.weaverId)!;
    place(weaver, 0, 0);
    place(heroAt(w, 1), 0, 10);
    weaver.weaver!.threadSlot = 1;
    const s = handSummon(w, heroAt(w, 0), 1.2, 5);
    const sever = (onto: Entity) => {
      const e = spawnEnemy(w, 'hollow_chorister', 2.4, 5, { instant: true, affixes: ['severing'] });
      w.entities.flush();
      e.health!.hp = e.health!.maxHp = 1e7;
      e.enemy!.engaged = true;
      e.enemy!.tauntTarget = onto.id;
      e.enemy!.tauntUntil = 1e9;
      // The re-aim: never the summon, and the taunt is left on it.
      expect(untauntedTarget(w, e)?.summon).toBeUndefined();
      expect(e.enemy!.tauntTarget).toBe(onto.id);
      stepFor(sim, 240);
      return w.internal.m3?.severAt?.[e.id];
    };
    // On the summon: it swings (the Sapling is struck) but never cuts.
    expect(sever(s)).toBeUndefined();
    expect(s.health!.hp).toBeLessThan(1e6);
    // The same blow on a hero standing there cuts (the control).
    place(s, 30, 30);
    const kael = heroAt(w, 0);
    place(kael, 1.2, 5);
    expect(sever(kael)).toBeDefined();
  });
});

describe('Seren and Oro parties build and play (the interim ranged branch)', () => {
  for (const party of [
    ['kael', 'lyra', 'seren'],
    ['kael', 'vexis', 'oro'],
    ['lyra', 'seren', 'oro'],
  ]) {
    it(party.join(', '), () => {
      for (const encounter of ['first_light', 'crimson_gate']) {
        const sim = createSim({ seed: 13, encounter, party });
        const bot = makeBot('skilled', 13);
        expect(() => {
          for (let t = 0; t < 600; t++) sim.step(bot.decide(sim.state));
        }).not.toThrow();
        // W2: only an Oro party holds summons.
        expect(sim.state.entities.list().some((e) => e.kind === 'summon')).toBe(
          party.includes('oro'),
        );
      }
    });
  }
  it('the content stays valid with the enemies it names', () => {
    expect(enemyDef('mirror_champion').hp).toBeGreaterThanOrEqual(HEAVY_LIFE);
  });
});

describe('a Rank-gated recruiting fight takes its row’s Threat (docs/phase-5e.md)', () => {
  /** The party arriving at `target` from a node of the row before. */
  const at = (run: RunState, target: MapNode): RunState => {
    const before = run.map.rows[target.row - 1]?.find((n) => n.next.includes(target.id));
    const placed: RunState = {
      ...run,
      phase: 'map',
      path: before ? [before.id] : [],
      pending: null,
    };
    return Run.chooseNode(placed, target.id);
  };
  for (const movements of [2, 3, 4]) {
    it(`movements ${movements}: debt and follow at their rows, pull and the map as before`, () => {
      let seen = 0;
      for (let seed = 1; seed <= 40 && seen < 6; seed++) {
        const base = Run.embark(Run.newRun(seed, undefined, [], [], [], [], undefined, movements));
        for (const node of base.map.rows.flat()) {
          if (node.eventId !== 'tithe_altar' && node.eventId !== 'loose_thread') continue;
          const ranked = node.eventId === 'tithe_altar' ? 'debt' : 'follow';
          // The row's Threat, as any fight on that row reads it on the map.
          const row = base.map.rows[node.row]!;
          const fight = row.find((n) => n.encounterId !== null);
          const expected = Run.rowThreat(base, node);
          if (fight) expect(expected, `${seed} ${node.id}`).toBe(fight.reward.threat);
          expect(expected).toBeGreaterThan(1);
          // The map is untouched: the altar still reads ×1, the thread its row (pull fights).
          expect(node.reward.threat).toBe(node.eventId === 'tithe_altar' ? 1 : expected);
          const there = at({ ...base, aether: 999 }, node);
          expect(there.phase).toBe('event');
          const recruit = Run.chooseEvent(there, ranked);
          expect(recruit.phase).toBe('combat');
          expect(Run.combatConfig(recruit)!.threat, `${seed} ${node.id} ${ranked}`).toBe(expected);
          if (node.eventId === 'loose_thread') {
            const pull = Run.chooseEvent(there, 'pull');
            expect(Run.combatConfig(pull)!.threat).toBe(node.reward.threat);
          }
          seen++;
        }
      }
      expect(seen).toBeGreaterThan(0);
      expect(threatFor(1)).toBe(1);
    });
  }
});

describe('the Rank-gated recruit choices are gated (docs/phase-5e.md)', () => {
  const at = (eventId: string): RunState => ({
    ...Run.newRun(1),
    phase: 'event',
    aether: 999,
    event: {
      nodeId: 'n',
      eventId,
      choice: null,
      won: null,
      outcome: null,
    } as RunState['event'],
  });

  it('refuses debt and follow below their Rank and without an allowance', () => {
    for (const [ev, id, hero, rank] of [
      ['tithe_altar', 'debt', 'seren', 8],
      ['loose_thread', 'follow', 'oro', 12],
    ] as const) {
      const run = at(ev);
      expect(Run.eventChoiceProblem(run, id)).toBe(`Opens at Rank ${rank}.`);
      expect(Run.eventChoiceProblem(run, id, allowanceFor(rank - 1))).toBe(
        `Opens at Rank ${rank}.`,
      );
      expect(allowanceFor(rank).recruits.has(hero)).toBe(true);
      expect(Run.eventChoiceProblem(run, id, allowanceFor(rank))).toBeNull();
      expect(Run.eventChoiceProblem(run, id, EVERYTHING)).toBeNull();
      expect(Run.chooseEvent(run, id, {}, allowanceFor(rank - 1))).toBe(run);
    }
  });
});
