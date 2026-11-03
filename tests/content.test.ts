import { describe, expect, it } from 'vitest';
import { CONTENT } from '../src/content';
import { EffectBundleSchema } from '../src/content/effects';
import { ContentSchema } from '../src/content/schema';
import { STATUS } from '../src/ui/hud/labels';

describe('content', () => {
  it('validates and has the starter party', () => {
    expect(CONTENT.heroes.map((h) => h.id)).toEqual(['kael', 'lyra', 'vexis']);
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
      scale: { life: 1.29, damage: 0.94 },
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
