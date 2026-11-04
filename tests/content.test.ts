import { describe, expect, it } from 'vitest';
import { CONTENT } from '../src/content';
import { EffectBundleSchema } from '../src/content/effects';
import { ContentSchema } from '../src/content/schema';
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
      threatMult: 1.5,
      dodge: 0,
      attack: {
        kind: 'melee',
        damage: 84,
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
        lifesteal: 0.06,
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
    expect(CONTENT.motifs.slice(-2).map((m) => [m.id, m.rarity, m.values])).toEqual([
      ['blood_tithe', 'rare', [50, 60, 70]],
      ['blood_and_silk', 'epic', [3]],
    ]);
    expect(CONTENT.motifs.at(-1)!.requires).toEqual({
      hero: 'brann',
      motifs: ['blood_tithe', 'taut_release'],
    });
    expect(CONTENT.motifs.at(-1)!.tags).toContain('harmony');
    expect(KNOWN_MOTIFS.slice(-2)).toEqual(['blood_tithe', 'blood_and_silk']);
    expect(CONTENT.deeds.at(-1)).toMatchObject({
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
    expect(noDome.map((a) => a.id).sort()).toEqual(['cantor_requiem', 'vharun_twin_cleave'].sort());
    for (const a of noDome) {
      expect(a.decreeNoDome, a.id).not.toMatch(/dome|Kael/);
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
    rejects((c) => void (c.movements[0]!.elites = ['tolling_halls']), /is a skirmish/);
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
    expect(later(CONTENT.events).map((e) => e.id)).toEqual(['tithe_altar', 'bloodsworn_cell']);
    expect(later(CONTENT.affixes).map((a) => a.id)).toEqual(['vampiric']);
  });

  it('every Legion enemy is iron, of Movement II, and in a Movement II fight', () => {
    const legion = later(CONTENT.enemies);
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
      later(CONTENT.encounters).flatMap((e) =>
        e.waves.flatMap((w) => w.spawns.map((s) => s.enemy)),
      ),
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
