import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CONTENT, deedText } from '../src/content';
import {
  CONDUCTOR_DECREES,
  CUE_EVERY,
  DISCORD_RATE,
  SILENCE_STEPS,
  soloDecree,
} from '../src/content/crucible';
import * as ids from '../src/content/crucibleIds';
import { FINALE } from '../src/content/crucibleRun';
import { FINALE_DEEDS } from '../src/content/deeds';
import { EffectBundleSchema } from '../src/content/effects';
import { ContentSchema, isFieldMovement, type FinaleMovementDef } from '../src/content/schema';
import { stealVerseDecree } from '../src/content/unstitched';
import { KNOWN_ALT_SOLOS, KNOWN_TALENTS } from '../src/sim/bonds';
import { KNOWN_MOTIFS } from '../src/sim/mods';
import { STATUS } from '../src/ui/hud/labels';

describe('content', () => {
  it('validates and has the starter party', () => {
    // Brann is appended (docs/phase-5b.md); the default party is still the three starters.
    expect(CONTENT.heroes.map((h) => h.id)).toEqual(['kael', 'lyra', 'vexis', 'brann']);
    expect(CONTENT.defaultParty).toEqual(['kael', 'lyra', 'vexis']);
  });

  it('rejects heroes slower than the Weaver and unknown party members', () => {
    const slow = structuredClone(CONTENT);
    slow.heroes[0]!.moveSpeed = 1;
    expect(ContentSchema.safeParse(slow).success).toBe(false);
    const unknown = structuredClone(CONTENT);
    unknown.defaultParty = ['kael', 'nobody'];
    expect(ContentSchema.safeParse(unknown).success).toBe(false);
  });
});

describe('Brann, the Bloodsworn (docs/phase-5b.md)', () => {
  const brann = CONTENT.heroes.find((h) => h.id === 'brann')!;

  it('ships at the doc’s numbers', () => {
    expect(brann).toMatchObject({
      name: 'Brann',
      title: 'the Bloodsworn',
      role: 'berserker',
      color: '#b91c1c',
      maxHp: 1250,
      armor: 0.25,
      moveSpeed: 7.4,
      radius: 0.7,
      height: 2.1,
      formation: { forward: 2, right: 1.9 },
      preferredRange: 1.4,
      threatMult: 1.2,
      dodge: 0,
      attack: {
        kind: 'melee',
        damage: 100,
        interval: 1.3,
        range: 2.4,
        projectileSpeed: 0,
        chain: 0,
        cleave: { arcDeg: 120, radius: 2.8, pct: 0.5 },
      },
      passive: {
        id: 'bloodRage',
        perMissing: 1,
        maxBonus: 0.8,
        lifesteal: 0.048,
        weaverHealMult: 0.5,
      },
      recruit: { event: 'bloodsworn_cell', fallback: 'vharun' },
    });
    expect(brann.abilities[0]).toMatchObject({
      id: 'sunderLeap',
      cooldown: 10,
      castTime: 0,
      damage: 120,
      radius: 3,
      range: 9,
      minRange: 4,
      stun: 0.5,
    });
    expect(brann.abilities[1]).toMatchObject({
      id: 'bloodletting',
      cooldown: 14,
      lifeCost: 0.12,
      lifeFloor: 0.2,
      hits: 3,
      hitBonus: 0.4,
    });
    expect(brann.call).toMatchObject({ ability: 0, answer: 'ward', answerTime: 2 });
    expect(brann.call.flourish).toMatchObject({
      name: 'Red Comet',
      damageMult: 1.6,
      radiusMult: 1.5,
      stun: 1,
    });
    expect(brann.solo).toMatchObject({
      id: 'redFrenzy',
      chargeTime: 25,
      duration: 5,
      power: 0.6,
      cuedPower: 3,
      radius: 3.5,
      pulse: 0.5,
    });
    expect(brann.quirk).toMatchObject({ id: 'bloodlust', below: 0.4 });
    expect(Object.keys(brann.barks)).toEqual([
      'quirk',
      'lowHp',
      'saved',
      'perfect',
      'cued',
      'downed',
      'revived',
      'defiant',
    ]);
    expect(brann.needs).toMatch(/Wards and barriers/);
  });

  it('the starters gain no key, and no starter has the roster fields', () => {
    for (const id of CONTENT.defaultParty) {
      const h = CONTENT.heroes.find((x) => x.id === id)!;
      for (const k of ['passive', 'needs', 'recruit']) expect(k in h, `${id}.${k}`).toBe(false);
      expect('cleave' in h.attack, id).toBe(false);
      expect('defiant' in h.barks, id).toBe(false);
      expect('below' in h.quirk, id).toBe(false);
      for (const k of ['radius', 'pulse']) expect(k in h.solo, `${id}.solo.${k}`).toBe(false);
      for (const ab of h.abilities)
        for (const k of ['minRange', 'lifeCost', 'lifeFloor', 'hits', 'hitBonus'])
          expect(k in ab, `${id}.${ab.id}.${k}`).toBe(false);
    }
  });

  it('his Bonds, motifs, Deed and the Cell are appended, and the sim knows their ids', () => {
    const bonds = CONTENT.talents.filter((t) => t.hero === 'brann');
    expect(bonds.map((t) => [t.id, t.tier])).toEqual([
      ['iron_will', 1],
      ['red_mist', 1],
      ['blood_oath', 2],
      ['scar_tissue', 2],
      ['deathless', 3],
      ['berserkers_hymn', 3],
    ]);
    expect(CONTENT.talents.slice(-6)).toEqual(bonds);
    expect(KNOWN_TALENTS.slice(-6)).toEqual(bonds.map((t) => t.id));
    expect(CONTENT.altSolos.at(-1)).toMatchObject({
      id: 'blood_brother',
      hero: 'brann',
      chargeTime: 25,
      values: { seconds: 6, pct: 16, cuedPct: 8 },
    });
    expect(KNOWN_ALT_SOLOS.at(-1)).toBe('blood_brother');
    expect(CONTENT.scenes.filter((x) => x.hero === 'brann').map((x) => [x.id, x.rank])).toEqual([
      ['brann_collar', 2],
      ['brann_war_song', 7],
    ]);
    // His two, by id: Movement III's Guard Strand is appended after them (docs/phase-5c.md).
    const brannMotifs = CONTENT.motifs.filter((m) => m.requires.hero === 'brann');
    expect(brannMotifs.map((m) => [m.id, m.rarity, m.values])).toEqual([
      ['blood_tithe', 'rare', [50, 60, 70]],
      ['blood_and_silk', 'epic', [3]],
    ]);
    const harmony = CONTENT.motifs.find((m) => m.id === 'blood_and_silk')!;
    expect(harmony.requires).toEqual({
      hero: 'brann',
      motifs: ['blood_tithe', 'taut_release'],
    });
    expect(harmony.tags).toContain('harmony');
    const at = KNOWN_MOTIFS.indexOf('blood_tithe');
    expect(KNOWN_MOTIFS.slice(at, at + 2)).toEqual(['blood_tithe', 'blood_and_silk']);
    expect(KNOWN_MOTIFS.at(-1)).toBe('guard_strand');
    expect(CONTENT.deeds.find((d) => d.id === 'in_the_red')).toMatchObject({
      id: 'in_the_red',
      points: 0,
      test: 'heroCeiling',
      hero: 'brann',
      encounter: 'vharun',
      values: { pct: 40 },
    });
    const cell = CONTENT.events.find((e) => e.id === 'bloodsworn_cell')!;
    expect(cell.choices.map((c) => c.id)).toEqual(['free', 'leave']);
    expect(cell.choices[0]!.effects).toEqual([
      { kind: 'fight', encounter: 'legion_vanguard', relics: 3, recruit: 'brann' },
    ]);
    expect(cell.choices[0]!.recruitedText).toBeDefined();
    expect(cell.choices[0]!.partyText).toBeDefined();
    const noDome = CONTENT.attacks.filter((a) => a.decreeNoDome !== undefined);
    // …and the Finale's Downbeat and Fortissimo Silence (docs/phase-5d.md).
    expect(noDome.map((a) => a.id).sort()).toEqual(
      [
        'cantor_requiem',
        'unweaver_shear',
        'vharun_twin_cleave',
        'conductor_downbeat',
        'fortissimo_silence',
      ].sort(),
    );
    for (const a of noDome) {
      // Fortissimo Silence's no-dome form names the dome's absence ('No dome: …'), never Kael's.
      expect(a.decreeNoDome, a.id).not.toMatch(/(?<!No )dome|Kael/);
      expect(a.decree, a.id).toMatch(/dome/);
    }
  });
});

describe('content lint: the roster (docs/phase-5b.md)', () => {
  const rejects = (edit: (c: typeof CONTENT) => void, message: RegExp) => {
    const c = structuredClone(CONTENT);
    edit(c);
    const parsed = ContentSchema.safeParse(c);
    expect(parsed.success).toBe(false);
    expect(parsed.error!.issues.map((i) => i.message).join('\n')).toMatch(message);
  };
  const hero = (c: typeof CONTENT, id: string) => c.heroes.find((h) => h.id === id)!;
  const cell = (c: typeof CONTENT) => c.events.find((e) => e.id === 'bloodsworn_cell')!;

  it('the default party names each hero once', () => {
    rejects((c) => void (c.defaultParty = ['kael', 'lyra', 'kael']), /each hero once/);
  });

  it('starters have no recruit; every other hero has one, through a real fight', () => {
    rejects(
      (c) => void (hero(c, 'kael').recruit = { event: 'bloodsworn_cell' }),
      /"kael" is in the default party/,
    );
    rejects((c) => void delete hero(c, 'brann').recruit, /"brann" needs a recruit/);
    rejects(
      (c) => void (hero(c, 'brann').recruit = { event: 'unsung_choir' }),
      /no fight that recruits/,
    );
    rejects(
      (c) => void (hero(c, 'brann').recruit = { event: 'bloodsworn_cell', fallback: 'nowhere' }),
      /recruit fallback references unknown "nowhere"/,
    );
    rejects((c) => {
      const e = cell(c).choices[0]!.effects[0]!;
      if (e.kind === 'fight') e.recruit = 'nobody';
    }, /recruit references unknown "nobody"/);
  });

  it('recruit texts only on a choice whose fight recruits', () => {
    rejects(
      (c) => void (cell(c).choices[1]!.partyText = 'x'),
      /recruit texts need a fight that recruits/,
    );
  });

  it('formation spots are 1.5 m apart', () => {
    rejects(
      (c) => void (hero(c, 'brann').formation = { forward: 2.4, right: 0.5 }),
      /"kael" and "brann": formation spots/,
    );
  });

  it("each new kind's fields, and minRange below range", () => {
    rejects((c) => void delete hero(c, 'brann').abilities[0].minRange, /needs minRange/);
    rejects((c) => void (hero(c, 'brann').abilities[0].minRange = 9), /minRange is below range/);
    rejects(
      (c) => void delete hero(c, 'brann').abilities[1].hits,
      /needs lifeCost, lifeFloor, hits and hitBonus/,
    );
    rejects((c) => void delete hero(c, 'brann').solo.pulse, /needs radius and pulse/);
    rejects((c) => void delete hero(c, 'brann').quirk.below, /bloodlust" needs below/);
  });

  it('a passive needs a Needs line, and a Codex that names healing', () => {
    rejects((c) => void delete hero(c, 'brann').needs, /needs a Needs line/);
    rejects((c) => void (hero(c, 'brann').codex = 'A Legion champion.'), /its Codex names healing/);
  });

  it('a Harmony names real motifs, not itself, and is hero-gated', () => {
    const silk = (c: typeof CONTENT) => c.motifs.find((m) => m.id === 'blood_and_silk')!;
    rejects(
      (c) => void (silk(c).requires.motifs = ['blood_tithe', 'nothing']),
      /"blood_and_silk" references unknown "nothing"/,
    );
    rejects((c) => void (silk(c).requires.motifs = ['blood_and_silk']), /can't require itself/);
    rejects(
      (c) => void (silk(c).requires = { motifs: ['taut_release', 'canon'] }),
      /must be hero-gated/,
    );
  });

  it('decreeNoDome only where the dome answers', () => {
    rejects((c) => {
      c.attacks.find(
        (a) => a.decree !== undefined && !/dome/.test(a.decree) && !a.answers.includes('dome'),
      )!.decreeNoDome = 'x';
    }, /decreeNoDome is for attacks the dome answers/);
  });

  it('a heroCeiling Deed names a real hero and encounter and gives no point', () => {
    const red = (c: typeof CONTENT) => c.deeds.find((d) => d.id === 'in_the_red')!;
    rejects((c) => void (red(c).hero = 'nobody'), /deed "in_the_red" references unknown/);
    rejects((c) => void (red(c).encounter = 'nowhere'), /unknown encounter "nowhere"/);
    rejects((c) => void delete red(c).hero, /needs hero/);
    rejects((c) => {
      // Trade a point Deed's point for this one's, so the ten still add up.
      red(c).points = 1;
      c.deeds.find((d) => d.points === 1)!.points = 0;
    }, /a heroCeiling Deed gives no point/);
  });
});

describe('content lint: Movements (docs/phase-5a.md)', () => {
  const rejects = (edit: (c: typeof CONTENT) => void, message: RegExp) => {
    const c = structuredClone(CONTENT);
    edit(c);
    const parsed = ContentSchema.safeParse(c);
    expect(parsed.success).toBe(false);
    expect(parsed.error!.issues.map((i) => i.message).join('\n')).toMatch(message);
  };
  const attack = (c: typeof CONTENT, kind: string) => c.attacks.find((a) => a.kind === kind)!;

  it('has Movement I, mirroring the Prelude', () => {
    expect(CONTENT.movements[0]).toMatchObject({
      opening: 'first_light',
      miniboss: 'bellwarden',
      boss: 'hollow_cantor',
      scale: { life: 1, damage: 1 },
    });
  });

  it('a link targets a pair; a mark or an execution picks a hero', () => {
    rejects((c) => void (attack(c, 'link').targeting = 'current'), /a link targets a pair/);
    rejects((c) => void (attack(c, 'mark').targeting = 'self'), /picks a hero/);
    rejects((c) => {
      const a = attack(c, 'cleave');
      a.executeBelow = 0.4;
      a.targeting = 'allHeroes';
    }, /execution needs a targeting/);
  });

  it('statuses carry the answers they need', () => {
    rejects((c) => {
      const a = attack(c, 'cleave');
      a.status = { id: 'pact', duration: 4 };
      a.answers = ['chime'];
    }, /isn't an ailment/);
    rejects((c) => {
      const a = attack(c, 'beam');
      a.status = { id: 'pinned', duration: 4 };
      a.answers = ['ward'];
    }, /a pin lists reel/);
    rejects((c) => {
      const a = attack(c, 'link');
      a.linkStatus = 'pact';
      a.answers = ['ward'];
    }, /a pact lists scatter/);
  });

  it('follow-ups resolve; later Movements hold their own enemies and pars', () => {
    rejects(
      (c) => void (attack(c, 'cleave').followUp = { attack: 'nothing_here', delay: 0 }),
      /references unknown "nothing_here"/,
    );
    rejects((c) => void (c.enemies[0]!.movement = 2), /belongs to a later Movement/);
    rejects((c) => {
      c.encounters[1]!.movement = 2;
      c.encounters[1]!.par = 0;
    }, /needs a par/);
  });

  it("every Movement's pools, mini-boss and boss resolve", () => {
    rejects((c) => void (c.movements[0]!.boss = 'nowhere'), /references unknown "nowhere"/);
    rejects((c) => {
      const m = c.movements[0]!;
      if (isFieldMovement(m)) m.elites = ['tolling_halls'];
    }, /is a skirmish/);
    rejects((c) => void (c.movements[0]!.scale = { life: 2, damage: 1 }), /scale \{1, 1\}/);
  });

  it('a follow-up is scripted and its enemy lists it; an on-hit affix names its answers', () => {
    rejects(
      (c) => void delete c.attacks.find((a) => a.id === 'vharun_twin_cleave_second')!.scripted,
      /its follow-up "vharun_twin_cleave_second" is scripted/,
    );
    rejects((c) => {
      const vharun = c.enemies.find((e) => e.id === 'vharun_crimson_warden')!;
      vharun.specials = vharun.specials.filter((id) => id !== 'vharun_crimson_tide_back');
    }, /lists "vharun_crimson_tide" but not its follow-up/);
    rejects(
      (c) => void delete c.affixes.find((a) => a.id === 'vampiric')!.answers,
      /names its answers/,
    );
  });

  it('fixed rows are one stop of their encounter’s kind; lessons have their row', () => {
    rejects(
      (c) => void (c.movements[1]!.fixed[1]!.encounter = 'red_muster'),
      /fixed row 4's "red_muster" is a skirmish/,
    );
    rejects(
      (c) => void c.movements[1]!.fixed.push({ row: 0, encounter: 'pike_line' }),
      /row 0 is fixed twice/,
    );
    rejects(
      (c) => void (c.movements[1]!.rows[1] = ['skirmish', 'event']),
      /no row of 2 skirmishes for its lessons/,
    );
    rejects(
      (c) => void (c.movements[1]!.fixed[0]!.encounter = 'first_light'),
      /"first_light" belongs to Movement 1/,
    );
  });
});

describe('Movement II: the Crimson Legion (docs/phase-5a.md)', () => {
  const later = <T extends { movement?: number }>(list: readonly T[]) =>
    list.filter((x) => (x.movement ?? 1) >= 2);
  const firstLater = <T extends { movement?: number }>(list: readonly T[]) =>
    list.findIndex((x) => (x.movement ?? 1) >= 2);

  it('is Movement II: its ladder, pools, scale and rewards', () => {
    const m = CONTENT.movements[1]!;
    expect(m).toMatchObject({
      id: 'crimson_legion',
      biome: 'crimson_spire',
      opening: 'crimson_gate',
      lessons: ['blood_rites', 'pike_line'],
      skirmishes: ['red_muster', 'leech_warren'],
      elites: ['shield_wall', 'blood_forge'],
      miniboss: 'gorehound_matriarch',
      boss: 'vharun',
      scale: { life: 1.5, damage: 1 },
      rewards: { xp: 1.25, starlight: 1.25, aether: 1.25 },
    });
    expect(m.rows).toHaveLength(7);
    expect(m.fixed.map((f) => f.row)).toEqual([0, 4, 6]);
    // No event among the lessons: every path learns one.
    expect(m.rows[1]).toEqual(['skirmish', 'skirmish']);
  });

  it('is appended after Movement I, which keeps its lists, pools and order', () => {
    for (const list of [
      CONTENT.enemies,
      CONTENT.affixes,
      CONTENT.encounters,
      CONTENT.events,
    ] as readonly (readonly { id: string; movement?: number }[])[]) {
      const at = firstLater(list);
      expect(at).toBeGreaterThan(0);
      expect(list.slice(at).every((x) => (x.movement ?? 1) >= 2)).toBe(true);
    }
    expect(CONTENT.affixes.filter((a) => (a.movement ?? 1) === 1).map((a) => a.id)).toEqual([
      'shielded',
      'volatile',
      'hastened',
    ]);
    expect(CONTENT.events.filter((e) => (e.movement ?? 1) === 1).map((e) => e.id)).toEqual([
      'wounded_cantor',
      'shrine_of_discord',
      'tuning_pool',
      'merchant_of_silences',
      'unsung_choir',
      'broken_loom',
    ]);
    const second = <T extends { movement?: number }>(list: readonly T[]) =>
      list.filter((x) => x.movement === 2);
    expect(second(CONTENT.events).map((e) => e.id)).toEqual(['tithe_altar', 'bloodsworn_cell']);
    expect(second(CONTENT.affixes).map((a) => a.id)).toEqual(['vampiric']);
  });

  it('every Legion enemy is iron, of Movement II, and in a Movement II fight', () => {
    const legion = CONTENT.enemies.filter((e) => e.movement === 2);
    expect(legion.map((e) => e.id)).toEqual([
      'sanguine_hound',
      'hemomancer',
      'impaler',
      'crimson_sentinel',
      'leech',
      'gorehound_matriarch',
      'vharun_crimson_warden',
    ]);
    const fought = new Set(
      CONTENT.encounters
        .filter((e) => e.movement === 2)
        .flatMap((e) => e.waves.flatMap((w) => w.spawns.map((s) => s.enemy))),
    );
    for (const e of legion) {
      expect(e.material, e.id).toBe('iron');
      expect(e.movement, e.id).toBe(2);
      expect(fought, e.id).toContain(e.id);
    }
    for (const e of later(CONTENT.encounters)) expect(e.par, e.id).toBeGreaterThan(0);
  });

  it('every status a payload applies has a look that says how to answer it', () => {
    const applied: [string, string][] = [];
    for (const a of CONTENT.attacks) {
      if (a.status) applied.push([a.id, a.status.id]);
      if (a.kind === 'link') applied.push([a.id, a.linkStatus ?? 'resound']);
      if (a.kind === 'mark' && a.markStatus !== null) applied.push([a.id, a.markStatus ?? 'dirge']);
    }
    for (const e of CONTENT.enemies) if (e.basic.onHit) applied.push([e.id, e.basic.onHit.id]);
    for (const f of CONTENT.affixes) if (f.onHit) applied.push([f.id, f.onHit.id]);
    // Movement I's silence after a Dirge is the Dirge's own answer; every new payload has its own.
    for (const [where, id] of applied.filter(([, id]) => id !== 'silence'))
      expect(STATUS[id as keyof typeof STATUS].answer, `${where}: ${id}`).toBeTruthy();
  });

  it('its Codex and affix lines are built from their numbers', () => {
    const vampiric = CONTENT.affixes.find((a) => a.id === 'vampiric')!;
    expect(vampiric.description).toBe(
      'Its hits Wound: healing received −50% for 4 s. Chime removes it.',
    );
    const hound = CONTENT.enemies.find((e) => e.id === 'sanguine_hound')!;
    expect(hound.codex).toContain(`${hound.basic.onHit!.dps} damage a second`);
    expect(hound.codex).toContain(`up to ${hound.basic.onHit!.maxStacks} stacks`);
    const sentinel = CONTENT.enemies.find((e) => e.id === 'crimson_sentinel')!;
    expect(sentinel.codex).toContain(`${sentinel.guard!.arcDeg}°`);
    for (const e of later(CONTENT.enemies)) expect(e.codex, e.id).not.toMatch(/[{}]|undefined/);
  });
});

describe('Movement III: the Unstitched (docs/phase-5c.md)', () => {
  const third = <T extends { movement?: number }>(list: readonly T[]) =>
    list.filter((x) => x.movement === 3);

  it('is Movement III: its six-stop ladder, one elite, pools, scale and rewards', () => {
    const m = CONTENT.movements[2]!;
    // Movement III, then the Finale (docs/phase-5d.md, registered by W3).
    expect(CONTENT.movements).toHaveLength(4);
    expect(m).toMatchObject({
      id: 'unstitched',
      biome: 'abyssal_rift',
      opening: 'frayed_threshold',
      lessons: ['maw_hollow', 'wraith_vigil', 'null_chapel'],
      skirmishes: ['mirror_hall'],
      elites: ['frayed_court'],
      miniboss: 'the_seamstress',
      boss: 'the_unweaver',
      scale: { life: 1.85, damage: 1.05 },
      rewards: { xp: 1.4, starlight: 1.5, aether: 1.5 },
    });
    expect(m.rows).toHaveLength(6);
    expect(m.fixed.map((f) => f.row)).toEqual([0, 3, 5]);
    expect('label' in m).toBe(false);
  });

  it('is appended after the Legion: its enemies, affixes, fights, events and Deeds', () => {
    expect(third(CONTENT.enemies).map((e) => e.id)).toEqual([
      'shears',
      'void_maw',
      'doubt_wraith',
      'null_priest',
      'mimic',
      'spindle',
      'stolen_verse',
      'mirror_champion',
      'the_seamstress',
      'the_unweaver',
    ]);
    expect(third(CONTENT.affixes).map((a) => a.id)).toEqual([
      'severing',
      'silencing',
      'mimicking',
      'doom_touched',
    ]);
    expect(third(CONTENT.events).map((e) => e.id)).toEqual(['loose_thread', 'mirror_pool']);
    for (const list of [
      CONTENT.enemies,
      CONTENT.affixes,
      CONTENT.encounters,
      CONTENT.events,
    ] as readonly (readonly { movement?: number }[])[]) {
      // Only the Finale's (Movement 4, docs/phase-5d.md) come after them.
      const at = list.findIndex((x) => x.movement === 3);
      expect(list.slice(at).every((x) => x.movement === 3 || x.movement === 4)).toBe(true);
      const four = list.findIndex((x) => x.movement === 4);
      if (four >= 0) expect(list.slice(four).every((x) => x.movement === 4)).toBe(true);
    }
    // Then the Finale's two (docs/phase-5d.md).
    expect(CONTENT.deeds.slice(-4, -2).map((d) => d.id)).toEqual(['whole_cloth', 'needle_sure']);
    expect(CONTENT.motifs.at(-1)).toMatchObject({
      id: 'guard_strand',
      category: 'silk',
      rarity: 'rare',
      values: [1.5, 1, 0.6],
      requires: { movement: 3 },
    });
    expect(third(CONTENT.relics).map((r) => [r.id, r.rarity, r.movement])).toEqual([
      ['sacrificial_lamb', 'rare', 3],
      ['knotted_cord', 'rare', 3],
      ['stillwater_bell', 'legendary', 3],
    ]);
  });

  it('every Unstitched enemy is cloth, of Movement III, and fought or summoned there', () => {
    const fought = new Set(
      third(CONTENT.encounters).flatMap((e) =>
        e.waves.flatMap((w) => w.spawns.map((s) => s.enemy)),
      ),
    );
    for (const a of CONTENT.attacks) if (a.summon) fought.add(a.summon.enemy);
    for (const e of third(CONTENT.enemies)) {
      expect(e.material, e.id).toBe('cloth');
      expect(fought, e.id).toContain(e.id);
      expect(e.codex, e.id).not.toMatch(/[{}]|undefined|NaN/);
    }
    for (const e of third(CONTENT.encounters)) expect(e.par, e.id).toBeGreaterThan(0);
    for (const a of CONTENT.arenas.filter((x) => x.biome === 'abyssal_rift'))
      expect(
        third(CONTENT.encounters).some((e) => e.arena === a.id),
        a.id,
      ).toBe(true);
  });

  it('the elite stop teaches all three combat affixes, one a wave', () => {
    const court = CONTENT.encounters.find((e) => e.id === 'frayed_court')!;
    expect(court.waves.map((w) => w.spawns.flatMap((s) => s.affixes))).toEqual([
      ['severing'],
      ['silencing'],
      ['doom_touched'],
    ]);
  });

  it('its lines are built from their numbers; Warden’s Key names Silencing elites', () => {
    const doom = CONTENT.affixes.find((a) => a.id === 'doom_touched')!;
    expect(doom.description).toContain(`At ${doom.onHit!.burst!.at} stacks`);
    expect(doom.description).toContain('40% of their life');
    const maw = CONTENT.enemies.find((e) => e.id === 'void_maw')!;
    const inhale = CONTENT.attacks.find((a) => a.id === 'maw_inhale')!;
    expect(maw.codex).toContain(`${inhale.zone!.pullSpeed} m/s`);
    expect(maw.codex).toContain(`Every ${inhale.cooldown} s`);
    const snip = CONTENT.attacks.find((a) => a.id === 'unweaver_snip')!;
    expect(snip.decree).toContain(`${snip.cut!.lock} s`);
    const key = CONTENT.relics.find((r) => r.id === 'wardens_key')!;
    expect(key.text).toBe('Your heroes deal {mult}× damage to Mutes and Silencing elites.');
    expect(key.values).toEqual({ mult: 3 });
    expect(key.empowered).toEqual({ values: { mult: 4 } });
  });

  it('every status a Movement III payload applies has a look with its answer', () => {
    for (const id of ['doubt', 'possessed', 'doom', 'doomed', 'voided', 'stitch', 'stitched'])
      expect(STATUS[id as keyof typeof STATUS].answer, id).toBeTruthy();
  });

  it('the Steal Verse Decree names the stolen aura; the attack keeps the unnamed form', () => {
    const steal = CONTENT.attacks.find((a) => a.id === 'unweaver_steal_verse')!;
    expect(steal.decree).toBe(stealVerseDecree());
    expect(steal.decree).toBe(
      'Steal Verse — the Unweaver tears an aura from your song. Focus the Stolen Verse to take it back.',
    );
    expect(stealVerseDecree('Valor')).toBe(
      'Steal Verse — the Unweaver tears Valor from your song. Focus the Stolen Verse to take it back.',
    );
  });

  it('every number in the Unstitched defs is a named constant (only 0, 1 and the Movement inline)', () => {
    const src = readFileSync(new URL('../src/content/unstitched.ts', import.meta.url), 'utf8');
    // The defs: from the first exported list to the end (the constants and BODIES come first).
    const defs = src.slice(src.indexOf('export const UNSTITCHED_ATTACKS'));
    const inline = [...defs.matchAll(/\b(\w+): (-?\d+(?:\.\d+)?)\b/g)]
      .filter(([, key, n]) => n !== '0' && !(key === 'movement' && n === '3'))
      .filter(([, key, n]) => !(n === '1' && ['count', 'maxAlive', 'stacks'].includes(key!)))
      .map(([m]) => m);
    expect(inline).toEqual([]);
  });
});

describe('content lint: Movement III (docs/phase-5c.md)', () => {
  const rejects = (edit: (c: typeof CONTENT) => void, message: RegExp) => {
    const c = structuredClone(CONTENT);
    edit(c);
    const parsed = ContentSchema.safeParse(c);
    expect(parsed.success).toBe(false);
    expect(parsed.error!.issues.map((i) => i.message).join('\n')).toMatch(message);
  };
  const attack = (c: typeof CONTENT, id: string) => c.attacks.find((a) => a.id === id)!;
  const enemy = (c: typeof CONTENT, id: string) => c.enemies.find((e) => e.id === id)!;
  const affix = (c: typeof CONTENT, id: string) => c.affixes.find((a) => a.id === id)!;

  it('a cut lists thread, and a cut beam rides the Thread', () => {
    rejects(
      (c) => void (attack(c, 'shears_dash').answers = ['focus', 'move']),
      /"shears_dash": a cut lists thread/,
    );
    rejects(
      (c) => void (attack(c, 'shears_dash').targeting = 'farthest'),
      /a cut beam uses threadLine/,
    );
    rejects(
      (c) => void (affix(c, 'severing').answers = ['focus']),
      /affix "severing": a cut lists thread/,
    );
  });

  it('a possession is interruptible, marks with an ailment, and lists chime and focus', () => {
    rejects(
      (c) => void (attack(c, 'wraith_doubt').interruptible = false),
      /a possession is interruptible/,
    );
    rejects((c) => {
      const a = attack(c, 'wraith_doubt');
      a.markStatus = 'condemned';
      a.answers = ['focus', 'ward'];
    }, /a possession's mark is an ailment/);
    rejects(
      (c) => void (attack(c, 'wraith_doubt').answers = ['chime', 'ward']),
      /a possession lists chime and focus/,
    );
  });

  it('a stitch lists chime and reaches across its arena', () => {
    rejects(
      (c) => void (attack(c, 'seamstress_stitch').answers = ['ward', 'reel']),
      /a stitch lists chime/,
    );
    rejects(
      (c) => void (attack(c, 'seamstress_stitch').radius = 30),
      /reaches across arena "loom_hollow"/,
    );
  });

  it('a zone attack has its zone; a pull lists stack or reel and is slower than the Weaver', () => {
    rejects(
      (c) => void delete attack(c, 'maw_inhale').zone,
      /"maw_inhale": a zone attack has its zone/,
    );
    rejects((c) => void (attack(c, 'maw_inhale').answers = ['move']), /a pull lists stack or reel/);
    rejects(
      (c) => void (attack(c, 'maw_inhale').zone!.pullSpeed = c.weaver.moveSpeed),
      /a pull is slower than the Weaver/,
    );
  });

  it('a null zone sits at the Weaver’s feet and lists move', () => {
    rejects(
      (c) => void delete attack(c, 'null_rune').centre,
      /a null zone is centred on the Weaver/,
    );
    rejects((c) => void (attack(c, 'null_rune').answers = ['focus']), /a null zone lists move/);
  });

  it('a burst names a mark of its own that Ward and Chime answer, in no enemy’s specials', () => {
    rejects(
      (c) => void (affix(c, 'doom_touched').onHit!.burst!.attack = 'nothing_here'),
      /references unknown "nothing_here"/,
    );
    rejects((c) => {
      const a = attack(c, 'doom_burst');
      a.kind = 'burst';
      a.targeting = 'self';
    }, /its burst "doom_burst" is a mark/);
    rejects(
      (c) => void (attack(c, 'doom_burst').answers = ['ward', 'focus']),
      /lists ward and chime/,
    );
    rejects(
      (c) => void (attack(c, 'doom_burst').markStatus = 'doom'),
      /has an ailment mark status of its own/,
    );
    rejects((c) => void enemy(c, 'mimic').specials.push('doom_burst'), /is in no enemy's specials/);
  });

  it('a tether is summoned by a boss; a stationary enemy never moves to attack', () => {
    rejects(
      (c) => void (attack(c, 'unweaver_spindles').summon!.enemy = 'shears'),
      /"spindle": a tether is summoned by a boss attack/,
    );
    rejects(
      (c) => void enemy(c, 'void_maw').specials.push('shears_dash'),
      /"void_maw": a stationary enemy has no move attack/,
    );
  });

  it('affix specials resolve; Movement gates are real Movements', () => {
    rejects(
      (c) => void (affix(c, 'mimicking').specials = ['nothing_here']),
      /affix "mimicking" references unknown "nothing_here"/,
    );
    rejects(
      // Four Movements with the Finale (docs/phase-5d.md): 5 is past the last.
      (c) => void (c.motifs.find((m) => m.id === 'guard_strand')!.requires.movement = 5),
      /motif "guard_strand": Movement 5 is past the last/,
    );
    rejects(
      // Four Movements with the Finale: a relic may wait for Movement 4, never 5.
      (c) => void (c.relics.find((r) => r.id === 'knotted_cord')!.movement = 5),
      /relic "knotted_cord": Movement 5 is past the last/,
    );
    // A relic waits for a registered Movement, not for fights alone: without FINALE, the
    // Finale's relics are past the last though its encounters stand.
    rejects(
      (c) => void c.movements.splice(c.movements.length - 1, 1),
      /relic "tacet_mark": Movement 4 is past the last/,
    );
  });

  it('the new targetings pick no hero; biomes and materials are one closed list each', () => {
    rejects((c) => void (attack(c, 'wraith_doubt').targeting = 'threadLine'), /picks a hero/);
    rejects((c) => void (attack(c, 'doom_burst').targeting = 'allyEnemy'), /picks a hero/);
    rejects(
      (c) => void ((c.arenas[0] as { biome?: string }).biome = 'nowhere'),
      /Invalid (enum value|option)/,
    );
    rejects(
      (c) => void ((enemy(c, 'shears') as { material?: string }).material = 'paper'),
      /Invalid (enum value|option)/,
    );
  });

  it('zone, mimic and script effects may deal no damage; a damage attack may not', () => {
    for (const id of ['maw_inhale', 'null_rune', 'mimic_mirror', 'unweaver_unravel'])
      expect(CONTENT.attacks.find((a) => a.id === id)!.damage, id).toBe(0);
    rejects(
      (c) => void (attack(c, 'mimic_mirror').effect = 'damage'),
      /damaging attack "mimic_mirror" has no damage/,
    );
  });
});

describe('effect vocabulary', () => {
  it('accepts a motif-shaped bundle', () => {
    // Riposte Bloom-like: Perfect Ward releases a nova (docs/plan/03 §8).
    const bundle = EffectBundleSchema.parse({
      stats: [{ stat: 'perfectWindow', bucket: 'add', value: 0.08 }],
      triggers: [
        {
          on: 'perfectWard',
          do: [{ type: 'damage', target: 'enemiesNearTarget', amount: 150, radius: 5 }],
        },
      ],
    });
    expect(bundle.triggers).toHaveLength(1);
  });

  it('rejects malformed effects', () => {
    expect(
      EffectBundleSchema.safeParse({
        triggers: [{ on: 'save', do: [{ type: 'heal', target: 'threaded' }] }],
      }).success,
    ).toBe(false);
    expect(
      EffectBundleSchema.safeParse({ stats: [{ stat: 'threadPotency', bucket: 'mega', value: 1 }] })
        .success,
    ).toBe(false);
  });
});

describe('content lint: the Finale (docs/phase-5d.md)', () => {
  type Mutable = typeof CONTENT;
  /** A synthetic Finale, appended: a Movement-4 copy of the Unweaver's fight, and the plan's road. */
  const withFinale = (c: Mutable): FinaleMovementDef => {
    const unweaver = c.encounters.find((e) => e.id === 'the_unweaver')!;
    c.encounters.push({ ...structuredClone(unweaver), id: 'test_conductor', movement: 4 });
    const finale: FinaleMovementDef = {
      id: 'test_finale',
      name: 'The Finale',
      mapTitle: 'The Celestial Crucible',
      label: 'The Finale',
      biome: 'celestial_crucible',
      rows: [['boss']],
      fixed: [{ row: 0, encounter: 'test_conductor' }],
      boss: 'test_conductor',
      scale: { life: 1.85, damage: 1.05 },
      rewards: { xp: 1.5, starlight: 1.5, aether: 1.5 },
      finale: true,
      road: [
        {
          movement: 'hollow_choir',
          rows: [
            ['skirmish'],
            ['skirmish', 'skirmish', 'event'],
            ['elite', 'skirmish', 'skirmish'],
            ['miniboss'],
            ['respite', 'merchant', 'forge'],
            ['boss'],
          ],
          fixed: [
            { row: 0, encounter: 'first_light' },
            { row: 3, encounter: 'bellwarden' },
            { row: 5, encounter: 'hollow_cantor' },
          ],
          threat: [0, 3, 5, 7, 8, 9],
          callingRows: [0, 2, 3, 5],
        },
        {
          movement: 'crimson_legion',
          rows: [
            ['skirmish'],
            ['skirmish', 'skirmish'],
            ['skirmish', 'elite', 'event'],
            ['miniboss'],
            ['respite', 'merchant', 'forge'],
            ['boss'],
          ],
          fixed: [
            { row: 0, encounter: 'crimson_gate' },
            { row: 3, encounter: 'gorehound_matriarch' },
            { row: 5, encounter: 'vharun' },
          ],
          threat: [0, 1, 2, 4, 5, 6],
          shuffle: true,
        },
      ],
    };
    // In the real Finale's place (the last Movement; W3 registers it).
    c.movements.splice(
      c.movements.findIndex((m) => !isFieldMovement(m)),
      1,
      finale,
    );
    return finale;
  };
  const issues = (edit: (c: Mutable) => void): string => {
    const c = structuredClone(CONTENT);
    edit(c);
    const parsed = ContentSchema.safeParse(c);
    return parsed.success ? '' : parsed.error.issues.map((i) => i.message).join('\n');
  };
  const rejects = (edit: (c: Mutable) => void, message: RegExp) =>
    expect(issues(edit)).toMatch(message);
  const attack = (c: Mutable, id: string) => c.attacks.find((a) => a.id === id)!;

  it('registers the Finale last: three field Movements, then FINALE', () => {
    expect(CONTENT.movements.map((m) => isFieldMovement(m))).toEqual([true, true, true, false]);
    expect(CONTENT.movements.map((m) => m.id)).toEqual([
      'hollow_choir',
      'crimson_legion',
      'unstitched',
      ids.FINALE_ID,
    ]);
  });

  it('a boss-only finale with the plan’s road passes; a field Movement refuses its keys', () => {
    expect(issues((c) => void withFinale(c))).toBe('');
    // A field Movement can't carry a road or the finale flag (the strict union refuses both).
    expect(issues((c) => void ((c.movements[0] as { road?: unknown }).road = []))).not.toBe('');
    expect(issues((c) => void ((c.movements[1] as { finale?: unknown }).finale = true))).not.toBe(
      '',
    );
  });

  it('a pctMaxHp above 1 sits only on the Finale’s attacks (the Final Cadence)', () => {
    expect(CONTENT.attacks.find((a) => a.id === ids.FINAL_CADENCE)!.pctMaxHp).toBeGreaterThan(1);
    expect(issues(() => {})).toBe('');
    rejects(
      (c) => void (attack(c, 'unweaver_spindles').pctMaxHp = 1.15),
      /"unweaver_spindles": a pctMaxHp above 1 belongs to Movement 4's attacks/,
    );
    // Exactly 1 stays legal anywhere (a Movement I-III share of life never passed it).
    expect(issues((c) => void (attack(c, 'unweaver_spindles').pctMaxHp = 1))).not.toMatch(
      /pctMaxHp above 1/,
    );
    rejects(
      (c) => void c.affixes.find((f) => f.id === 'mimicking')!.specials!.push(ids.FINAL_CADENCE),
      new RegExp(`"${ids.FINAL_CADENCE}": a pctMaxHp above 1 belongs to Movement 4's attacks`),
    );
  });

  it('discord sits only on the Finale’s attacks, discordQuorum only beside it', () => {
    rejects(
      (c) => void (attack(c, 'unweaver_spindles').discord = 8),
      /"unweaver_spindles": discord belongs to Movement 4's attacks/,
    );
    rejects((c) => {
      const a = c.attacks.find((x) => x.kind === 'cleave')!;
      a.discord = 8;
      a.discordQuorum = 2;
    }, /discord belongs to Movement 4's attacks/);
    rejects(
      (c) => void (c.attacks.find((x) => x.kind === 'cleave')!.discordQuorum = 2),
      /a discordQuorum needs discord/,
    );
    // An affix's specials reach any elite that wears it, Movements I-III's included: even with
    // only Movement-4 enemies listing the attack, an affix listing it too is refused.
    const finaleOnly = (c: Mutable) => {
      attack(c, 'unweaver_spindles').discord = 8;
      for (const e of c.enemies) if (e.specials.includes('unweaver_spindles')) e.movement = 4;
    };
    expect(issues(finaleOnly)).not.toMatch(/discord belongs to Movement 4's attacks/);
    rejects((c) => {
      finaleOnly(c);
      c.affixes.find((f) => f.id === 'mimicking')!.specials!.push('unweaver_spindles');
    }, /"unweaver_spindles": discord belongs to Movement 4's attacks/);
    rejects(
      (c) => void attack(c, 'unweaver_spindles').answers.push('crescendo'),
      /an attack the Crescendo answers is a raid/,
    );
  });

  it('the finale is last, one row, its boss fixed on row 0', () => {
    rejects((c) => {
      const f = withFinale(c);
      c.movements.splice(c.movements.indexOf(f), 1);
      c.movements.splice(1, 0, f);
    }, /"test_finale": a finale is the last Movement/);
    rejects((c) => void (withFinale(c).rows = [['skirmish'], ['boss']]), /one row, its boss/);
    rejects(
      (c) => void (withFinale(c).fixed = [{ row: 0, encounter: 'the_unweaver' }]),
      /fixes its boss on row 0/,
    );
  });

  it('every road variant names an earlier field Movement and passes its lint', () => {
    rejects(
      (c) => void (withFinale(c).road[0]!.movement = 'nowhere'),
      /road "nowhere" names no earlier field Movement/,
    );
    rejects(
      (c) => void (withFinale(c).road[0]!.threat = [0, 3, 5]),
      /road "hollow_choir": a threat row for each of its 6 rows/,
    );
    rejects(
      (c) => void (withFinale(c).road[0]!.threat[5] = 10),
      /threat row 10 is past the Movement's last/,
    );
    rejects(
      (c) => void (withFinale(c).road[0]!.callingRows = [0, 2, 3]),
      /callingRows has one row per Calling tier \(4\)/,
    );
    rejects(
      (c) => void (withFinale(c).road[0]!.callingRows = [0, 1, 3, 5]),
      /calling row 1 is not a row of fights/,
    );
    rejects(
      (c) => void (withFinale(c).road[1]!.callingRows = [0, 2, 3, 5]),
      /only Movement I's road carries callingRows/,
    );
    // One tier a row, in order; and Movement I's road can't leave them to the Prelude's rows.
    rejects(
      (c) => void (withFinale(c).road[0]!.callingRows = [0, 2, 2, 5]),
      /callingRows rise, one row per tier \(2 after 2\)/,
    );
    rejects(
      (c) => void (withFinale(c).road[0]!.callingRows = [5, 0, 2, 3]),
      /callingRows rise, one row per tier \(0 after 5\)/,
    );
    rejects(
      (c) => void delete withFinale(c).road[0]!.callingRows,
      /road "hollow_choir": Movement I's road carries callingRows/,
    );
    // The road's own rewards: one entry a row, on a row with a skirmish to pay them.
    rejects(
      (c) => void (withFinale(c).road[0]!.rewards = [{ row: 3, draft: 'rare', relics: 2 }]),
      /road "hollow_choir": reward row 3 has no skirmish to pay it/,
    );
    rejects(
      (c) =>
        void (withFinale(c).road[0]!.rewards = [
          { row: 1, draft: 'rare', relics: 2 },
          { row: 1, draft: 'epic', relics: 1 },
        ]),
      /road "hollow_choir": reward row 1 is given twice/,
    );
    rejects(
      (c) => void (withFinale(c).road[0]!.fixed[0]!.encounter = 'tolling_halls'),
      /row 0 is fixed to its opening/,
    );
    rejects(
      (c) => void (withFinale(c).road[1]!.rows[1] = ['skirmish', 'event']),
      /no row of 2 skirmishes for its lessons/,
    );
    rejects(
      (c) => void withFinale(c).road[1]!.rows.push(['respite']),
      /road "crimson_legion": its last row is its boss/,
    );
  });
});

describe('the Finale: the Silent Conductor (docs/phase-5d.md)', () => {
  const fourth = <T extends { movement?: number }>(list: readonly T[]) =>
    list.filter((x) => x.movement === 4);
  const attack = (id: string) => CONTENT.attacks.find((a) => a.id === id)!;
  const enemy = (id: string) => CONTENT.enemies.find((e) => e.id === id)!;
  const SILENCE = [ids.REST, ids.MEASURE, ids.FINAL_CADENCE, ids.HALF_CADENCE];
  const SOLOS = [ids.LAMENT, ids.BASSO_OSTINATO, ids.CADENZA, ids.SHATTER_ARIA];

  it('is appended after the Unstitched: the choir, the Conductor, its arena and its fight', () => {
    expect(fourth(CONTENT.enemies).map((e) => e.id)).toEqual([
      ids.ALTO,
      ids.BASS,
      ids.TENOR,
      ids.SOPRANO,
      ids.CONDUCTOR,
    ]);
    expect(fourth(CONTENT.encounters).map((e) => e.id)).toEqual([ids.CONDUCTOR_ENCOUNTER]);
    expect(CONTENT.arenas.filter((a) => a.biome === 'celestial_crucible')).toEqual([
      {
        id: ids.CRUCIBLE_ARENA,
        name: 'The Celestial Crucible',
        radius: 22,
        obstacles: [],
        theme: { floor: '#16141f', line: '#5a5470', accent: '#3a3350', fog: '#0b0a14' },
        biome: 'celestial_crucible',
      },
    ]);
    for (const e of fourth(CONTENT.enemies)) {
      expect(e.material, e.id).toBe('glass');
      expect(e.codex, e.id).not.toMatch(/[{}]|undefined|NaN/);
    }
    expect(CONTENT.encounters.find((e) => e.id === ids.CONDUCTOR_ENCOUNTER)).toMatchObject({
      kind: 'boss',
      arena: ids.CRUCIBLE_ARENA,
      boss: ids.CONDUCTOR,
      enrage: 420,
      par: 200,
      hints: ['decree', 'discord', 'silence'],
      movement: 4,
    });
  });

  it('the script’s tuned clocks, pinned as literals (docs/phase-5d.md, "Tuning")', () => {
    // tests/sim/finaleScript.test.ts reads these through their constants, so a silent change
    // would pass there: the shipped values are pinned here.
    expect(DISCORD_RATE).toEqual({ overture: 0.3, choir: 1 });
    expect(CUE_EVERY).toEqual({ overture: 12, choir: 11, enraged: 7 });
    expect(SILENCE_STEPS).toEqual({ measureLead: 0.5, cadenceLag: 0.5, nextCycle: 2 });
    expect(attack(ids.RAISE).cooldown).toBe(25);
    expect([ids.REST, ids.MEASURE].map((id) => attack(id).cooldown)).toEqual([10, 10]);
    expect([ids.FINAL_CADENCE, ids.HALF_CADENCE].map((id) => attack(id).cooldown)).toEqual([
      20, 20,
    ]);
  });

  it('the Conductor: its body, its melee and every scripted attack among its specials', () => {
    expect(enemy(ids.CONDUCTOR)).toMatchObject({
      role: 'boss',
      hp: 40000,
      speed: 2.2,
      radius: 1.5,
      height: 4.8,
      preferredRange: 0,
      basic: { kind: 'melee', damage: 110, interval: 1.6, range: 3 },
    });
    expect(enemy(ids.CONDUCTOR).specials).toEqual([
      ids.DOWNBEAT,
      ids.SFORZANDO,
      ids.CUE,
      ids.RAISE,
      ...ids.FORTISSIMO,
      ids.GRAND_SILENCE,
      ...SILENCE,
    ]);
    // Only Downbeat and Sforzando are on the generic picker; the rest are the script's.
    const picked = enemy(ids.CONDUCTOR).specials.filter((id) => !attack(id).scripted);
    expect(picked).toEqual([ids.DOWNBEAT, ids.SFORZANDO]);
    expect(attack(ids.DOWNBEAT)).toMatchObject({
      kind: 'cleave',
      windup: 1.6,
      cooldown: 9,
      damage: 600,
      radius: 4,
      angleDeg: 90,
      targeting: 'current',
      answers: ['ward', 'dome'],
      discord: 5,
    });
    expect(attack(ids.SFORZANDO)).toMatchObject({
      kind: 'beam',
      windup: 1.8,
      cooldown: 12,
      damage: 320,
      length: 22,
      width: 1.4,
      targeting: 'farthest',
      answers: ['move', 'reel'],
      discord: 5,
    });
    // Nothing lethal in the first 4 s: the first Raise at +3 s, the first Cue at +8 s.
    for (const id of [ids.DOWNBEAT, ids.SFORZANDO])
      expect(attack(id).initialDelay, id).toBeGreaterThanOrEqual(4);
    expect([attack(ids.RAISE).initialDelay, attack(ids.CUE).initialDelay]).toEqual([3, 8]);
  });

  it('the Cue and the Raise are scripted casts; Fortissimo Silence is a three-pulse raid chain', () => {
    for (const [id, windup] of [
      [ids.CUE, 1.2],
      [ids.RAISE, 1.5],
      [ids.GRAND_SILENCE, 2],
    ] as const) {
      expect(attack(id), id).toMatchObject({
        kind: 'burst',
        effect: 'script',
        damage: 0,
        windup,
        targeting: 'self',
        interruptible: false,
        scripted: true,
      });
      expect('discord' in attack(id), id).toBe(false);
    }
    const pulses = ids.FORTISSIMO.map(attack);
    expect(pulses.map((a) => a.windup)).toEqual([3, 1.5, 1.5]);
    expect(pulses.map((a) => a.followUp?.attack)).toEqual([...ids.FORTISSIMO.slice(1), undefined]);
    for (const a of pulses) {
      expect(a, a.id).toMatchObject({
        name: 'Fortissimo Silence',
        kind: 'raid',
        targeting: 'allHeroes',
        pctMaxHp: 0.4,
        damage: 0,
        answers: ['crescendo', 'dome', 'ward'],
        scripted: true,
      });
    }
    // 'Fortissimo Silence' in full, never 'Fortissimo' alone (an aura's name).
    expect(pulses[0]!.decree).toBe(
      'Fortissimo Silence — every hero loses 120% of their life over 3 s. Crescendo to cancel it, or dome, Ward and heal.',
    );
    expect(pulses[0]!.decreeNoDome).toBe(
      'Fortissimo Silence — 120% of every hero’s life over 3 s. No dome: keep 100 Resonance and cancel it with your Crescendo; Ward the one you can’t lose.',
    );
    expect(pulses.slice(1).every((a) => a.decree === undefined)).toBe(true);
  });

  it('the Grand Silence’s program: aimed, range 44, no Discord, the Cadences alternate', () => {
    const want: Record<string, object> = {
      [ids.REST]: { kind: 'mark', windup: 3.5, pctMaxHp: 0.5, targeting: 'randomNonTank' },
      [ids.MEASURE]: { kind: 'burst', windup: 2, pctMaxHp: 0.7, radius: 2.5, targeting: 'current' },
      [ids.FINAL_CADENCE]: { windup: 2.5, pctMaxHp: 1.15, radius: 2.5, targeting: 'lowestHp' },
      [ids.HALF_CADENCE]: { windup: 2.5, pctMaxHp: 0.6, radius: 2.5, targeting: 'lowestHp' },
    };
    for (const id of SILENCE) {
      const a = attack(id);
      expect(a, id).toMatchObject({ ...want[id], range: 44, discord: 0, scripted: true });
      if (a.kind === 'burst') expect(a.centre, id).toBe('target');
    }
    // The Rest is a Dirge (the clutch note): its mark status is the default.
    expect('markStatus' in attack(ids.REST)).toBe(false);
    expect(attack(ids.REST).answers).toEqual(['chime', 'ward']);
    expect(attack(ids.MEASURE).answers).toEqual(['ward']);
    expect(attack(ids.FINAL_CADENCE).answers).toEqual(['reel', 'ward']);
    expect(attack(ids.HALF_CADENCE).answers).toEqual(['ward', 'reel']);
  });

  it('the mirror-choir: four glass voices, each with one scripted, interruptible Solo', () => {
    const body = (id: string) => {
      const e = enemy(id);
      return [e.hp, e.basic.kind, e.basic.damage, e.basic.range];
    };
    expect([ids.ALTO, ids.BASS, ids.TENOR, ids.SOPRANO].map(body)).toEqual([
      [1200, 'bolt', 45, 10],
      [1800, 'melee', 90, 2],
      [1200, 'melee', 90, 2],
      [1200, 'bolt', 45, 10],
    ]);
    for (const [voice, solo] of Object.entries(ids.SOLOS)) {
      expect(enemy(voice).specials, voice).toEqual([solo]);
      expect(enemy(voice).movement, voice).toBe(4);
    }
    for (const id of SOLOS) {
      expect(attack(id), id).toMatchObject({
        windup: 2.5,
        range: 44,
        interruptible: true,
        scripted: true,
        discord: 25,
        decreeLimit: 2,
      });
      expect(attack(id).answers, id).toContain('focus');
      // The attack keeps the unnamed form; the script names the hero as the Solo begins.
      expect(attack(id).decree, id).toBe(soloDecree(id));
    }
    expect(attack(ids.LAMENT)).toMatchObject({ kind: 'mark', pctMaxHp: 0.5 });
    expect(attack(ids.BASSO_OSTINATO)).toMatchObject({ damage: 1000, radius: 2.5 });
    expect(attack(ids.CADENZA)).toMatchObject({
      kind: 'beam',
      pctMaxHp: 1,
      length: 24,
      width: 1.6,
    });
    expect(attack(ids.SHATTER_ARIA)).toMatchObject({ damage: 480, radius: 4.5, discordQuorum: 2 });
    expect(attack(ids.SHATTER_ARIA).answers).toEqual(['scatter', 'move', 'ward', 'focus']);
    expect(SOLOS.filter((id) => attack(id).discordQuorum !== undefined)).toEqual([
      ids.SHATTER_ARIA,
    ]);
    expect(soloDecree(ids.CADENZA, 'Lyra')).toBe(
      'Cadenza — the Tenor’s Solo cuts a line to Lyra: more than their life. Reel them out, step aside, or interrupt it.',
    );
  });

  it('discord sits on exactly the Finale’s telegraphs; every Finale attack is in a Finale def', () => {
    const finale = new Set(fourth(CONTENT.enemies).flatMap((e) => e.specials));
    const fed = CONTENT.attacks.filter((a) => a.discord !== undefined).map((a) => a.id);
    expect(fed.sort()).toEqual([ids.DOWNBEAT, ids.SFORZANDO, ...SILENCE, ...SOLOS].sort());
    for (const id of fed) expect(finale, id).toContain(id);
    // Every scripted Solo and silence attack reaches across the Crucible from anywhere in it.
    for (const id of [...SILENCE, ...SOLOS]) expect(attack(id).range, id).toBe(44);
  });

  it('every scripted Finale attack spans the Crucible: range ≥ its diameter, and inRange holds wall to wall', () => {
    const arena = CONTENT.arenas.find((a) => a.id === ids.CRUCIBLE_ARENA)!;
    const finale = new Set(fourth(CONTENT.enemies).flatMap((e) => e.specials));
    const scripted = CONTENT.attacks.filter((a) => a.scripted === true && finale.has(a.id));
    expect(scripted.map((a) => a.id)).toEqual(expect.arrayContaining([...SILENCE, ...SOLOS]));
    // The smallest bodies: each caster that owns a scripted attack, and the smallest hero.
    const heroR = Math.min(...CONTENT.heroes.map((h) => h.radius));
    for (const a of scripted) {
      expect(a.range, a.id).toBeGreaterThanOrEqual(2 * arena.radius);
      for (const e of fourth(CONTENT.enemies).filter((d) => d.specials.includes(a.id))) {
        // clampToArena keeps each centre at most (arena radius - its own) from the middle.
        const apart = 2 * arena.radius - e.radius - heroR;
        expect(apart, `${e.id} ${a.id}`).toBeLessThanOrEqual(a.range + e.radius + heroR);
      }
    }
  });

  it('the phase Decrees use the plan’s words', () => {
    expect(CONDUCTOR_DECREES.grandSilence).toContain('Eight notes rebuild the song.');
    expect(CONDUCTOR_DECREES.grandSilenceRewind).toContain('Rewinds that undo a blow');
    for (const text of Object.values(CONDUCTOR_DECREES))
      expect(text).not.toMatch(/Fortissimo(?! Silence)/);
  });

  it('three Movement-4 relics, offered only from the Finale on', () => {
    expect(fourth(CONTENT.relics).map((r) => [r.id, r.rarity, r.values])).toEqual([
      [ids.TACET_MARK, 'rare', { seconds: 0.1 }],
      [ids.QUICK_ROSIN, 'rare', { cut: 3 }],
      [ids.FIRST_SCORE, 'legendary', { charges: 1 }],
    ]);
    expect(CONTENT.relics.slice(-3)).toEqual(fourth(CONTENT.relics));
  });

  it('FINALE: a boss-only def with the plan’s road, registered last', () => {
    expect(FINALE).toMatchObject({
      id: ids.FINALE_ID,
      name: 'The Finale',
      mapTitle: 'The Celestial Crucible',
      label: 'The Finale',
      biome: 'celestial_crucible',
      rows: [['boss']],
      fixed: [{ row: 0, encounter: ids.CONDUCTOR_ENCOUNTER }],
      boss: ids.CONDUCTOR_ENCOUNTER,
      scale: { life: 1.85, damage: 1.05 },
      rewards: { xp: 1.35, starlight: 1.5, aether: 1.5 },
      finale: true,
    });
    expect(FINALE.road.map((r) => [r.movement, r.rows.length, r.threat])).toEqual([
      ['hollow_choir', 5, [0, 3, 7, 8, 9]],
      ['crimson_legion', 6, [0, 1, 2, 4, 5, 6]],
    ]);
    expect(FINALE.road[0]!.callingRows).toEqual([0, 1, 2, 4]);
    expect('shuffle' in FINALE.road[0]!).toBe(false);
    expect(FINALE.road[1]!.shuffle).toBe(true);
    expect(CONTENT.movements.at(-1)).toStrictEqual(FINALE);
  });

  it('registered, FINALE and its Deeds lint clean, the Deeds after Movement III’s', () => {
    const parsed = ContentSchema.safeParse(structuredClone(CONTENT));
    expect(parsed.success ? '' : parsed.error.issues.map((i) => i.message).join('\n')).toBe('');
    expect(CONTENT.deeds.slice(-FINALE_DEEDS.length)).toStrictEqual(FINALE_DEEDS);
  });

  it('two badge Deeds, no point, both on the Conductor’s fight', () => {
    expect(FINALE_DEEDS.map((d) => [d.id, d.name, d.points, d.test])).toEqual([
      [ids.SONG_GOES_ON, 'The Song Goes On', 0, 'fight'],
      [ids.NOT_ONE_SILENT, 'Not One Silent', 0, 'fight'],
    ]);
    expect(FINALE_DEEDS.map(deedText)).toEqual([
      'Beat the Silent Conductor.',
      'Beat the Silent Conductor with no hero going down.',
    ]);
    // Not 'finale' (the Cantor's Bright Finale) nor 'The Last Note' (a boon).
    for (const d of FINALE_DEEDS) expect(d.id).not.toMatch(/finale|last_note/);
    expect(CONTENT.deeds.filter((d) => FINALE_DEEDS.some((f) => f.id === d.id))).toHaveLength(2);
  });

  it('every number in the Finale defs is a named constant (only 0 inline)', () => {
    const src = readFileSync(new URL('../src/content/crucible.ts', import.meta.url), 'utf8');
    const defs = src.slice(src.indexOf('export const CRUCIBLE_ATTACKS'));
    const inline = [...defs.matchAll(/\b(\w+): (-?\d+(?:\.\d+)?)\b/g)]
      .filter(([, , n]) => n !== '0')
      .map(([m]) => m);
    // The arena's radius is named too: the scripted attacks' reach is its diameter.
    expect(inline).toEqual([]);
  });
});
