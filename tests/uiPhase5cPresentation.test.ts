/**
 * Phase 5c review fixes, presentation (docs/phase-5c.md): the Inhale hint names an answer that
 * works for the Reel slot and for a bloodlusting Brann; the Stitch copy never promises one Chime
 * frees a pair it may not reach; a sleeping Rift relic reads asleep on the fight's relic bar; a
 * MovementDef's `label` names its Movement; the Codex says what Movement III's zone, mirror and
 * script specials do; and the aura-silence hint names a Silencing elite only while one stands.
 */
import { describe, expect, it } from 'vitest';
import { CONTENT } from '../src/content';
import { createSim } from '../src/sim';
import { evaluateHints } from '../src/ui/hud/hints';
import { STATUS } from '../src/ui/hud/labels';
import { relicHuds } from '../src/ui/hud/relics';
import { bossConditions } from '../src/ui/hud/riftLook';
import { buildHudSnapshot } from '../src/ui/hudBridge';
import { brannHud, legionHud, mockHud, riftHud } from '../src/ui/lab/mock';
import { attackDamage } from '../src/ui/screens/codexAttack';
import { movementCard, movementLabel } from '../src/ui/screens/routeText';
import type { HudSnapshot } from '../src/ui/store';
import { stepFor, worldOf } from './sim/helpers';

const fighting = (hud: HudSnapshot): HudSnapshot => ({
  ...hud,
  encounter: { ...hud.encounter, status: 'fighting' },
});
const hint = (hud: HudSnapshot, id: string) =>
  evaluateHints(fighting(hud)).find((h) => h.id === id);

/** The HUD with Reel's slot playing `variant`. */
function withReel(hud: HudSnapshot, variant: string): HudSnapshot {
  return {
    ...hud,
    weaver: {
      ...hud.weaver,
      techniques: hud.weaver.techniques.map((t) =>
        t.key === 'reel' ? { ...t, variant: { id: variant, name: variant } as never } : t,
      ),
    },
  };
}

/** A Chronomancer's HUD: Rewind in Reel's place. */
function withRewind(hud: HudSnapshot): HudSnapshot {
  return { ...hud, weaver: { ...hud.weaver, rewind: { seconds: 3, range: 12, ready: true } } };
}

/** The Inhale with a bloodlusting Brann (party A) in the fight. */
function brannInhale(): HudSnapshot {
  const rally = brannHud('brann-rally');
  return { ...riftHud('rift-doom'), party: rally.party, directive: 'rally' };
}

describe('the Inhale hint names an answer that works', () => {
  it('a plain Reel takes one out; Anchor holds one before the pull; Rewind takes one back', () => {
    const plain = hint(riftHud('rift-doom'), 'inhale')!.text;
    expect(plain).toMatch(/Rally .* before the pull, or Reel \{\w+\} one out/);
    const anchor = hint(withReel(riftHud('rift-doom'), 'anchor'), 'inhale')!.text;
    expect(anchor).toMatch(/Anchor \{\w+\} one before it drags them in/);
    expect(anchor).not.toMatch(/Reel|one out/);
    const rewind = hint(withRewind(riftHud('rift-doom')), 'inhale')!.text;
    expect(rewind).toMatch(/Rewind \{\w+\} one it drags in/);
    expect(rewind).not.toMatch(/Reel/);
    expect(hint(withReel(riftHud('rift-doom'), 'swap'), 'inhale')!.text).toMatch(
      /Swap puts you in the Maw$/,
    );
  });

  it('a bloodlusting Brann is told his own answer, never only the Rally he refuses', () => {
    const hud = brannInhale();
    const b = hud.party.find((h) => h.blood)!;
    expect(b.blood!.bloodlust).toBe(true);
    const cases: [HudSnapshot, RegExp][] = [
      [hud, /Reel \{\w+\} him out/],
      [withReel(hud, 'anchor'), /Anchor \{\w+\} him before it drags him in/],
      [withRewind(hud), /Rewind \{\w+\} him back once it drags him/],
      [withReel(hud, 'swap'), /Hold \{\w+\} so he stays outside it/],
    ];
    for (const [h, answer] of cases) {
      const inhale = hint(h, 'inhale')!.text;
      expect(inhale).toMatch(new RegExp(`${b.name} won’t Rally below 40%`));
      expect(inhale).toMatch(answer);
      // His own Rally hint says the same during the Inhale: no Ward (it can't answer a pull).
      const rally = hint(h, 'brannRally')!.text;
      expect(rally).toMatch(answer);
      expect(rally).not.toMatch(/Ward/);
    }
    // Outside an Inhale his Rally hint reads as it always did.
    expect(hint(brannHud('brann-rally'), 'brannRally')!.text).toMatch(/Ward \{\w+\} him/);
  });
});

describe('the Stitch never promises one Chime frees a pair it may not reach', () => {
  it('the hint, the status, the boss condition: a Chime frees each one it reaches', () => {
    const text = hint(riftHud('seamstress'), 'stitched')!.text;
    expect(text).not.toMatch(/both/);
    expect(text).toMatch(
      /a Chime \{\w+\} frees each one it reaches, a Reel \{\w+\} the one it pulls/,
    );
    expect(hint(withRewind(riftHud('seamstress')), 'stitched')!.text).not.toMatch(/Reel/);
    expect(STATUS.stitched.answer).not.toMatch(/both/);
    const cond = bossConditions({ ...riftHud('seamstress').boss!, stitched: 2 }).find(
      (c) => c.id === 'stitched',
    )!;
    expect(cond.text).not.toMatch(/both/);
  });
});

describe('a sleeping Rift relic reads asleep on the relic bar', () => {
  const src = (movement?: number) => ({
    relics: {
      ids: ['stillwater_bell', 'cracked_metronome'],
      cleansed: [],
      metronomeAt: null,
      thimbleAt: null,
      veil: true,
    },
    time: 3,
    ledger: { perfects: 0, downs: 0 },
    ...(movement === undefined ? {} : { movement }),
  });

  it('asleep before the Rift, awake in it; ungated relics never carry the key', () => {
    const [bell, metronome] = relicHuds(src(1));
    expect(bell!.asleep).toBe('Wakes in the Abyssal Rift');
    expect(bell!.ready).toBe(false);
    expect(bell!.label).toMatch(/asleep/);
    expect(metronome).not.toHaveProperty('asleep');
    for (const m of [3, undefined]) expect(relicHuds(src(m))[0]).not.toHaveProperty('asleep');
  });

  it('the bridge passes the fight’s Movement: the Training Grounds sleep it, the Rift wakes it', () => {
    const relicsOf = (encounter: string) => {
      const sim = createSim({ seed: 7, encounter, relics: ['stillwater_bell'] });
      stepFor(sim, 120);
      expect(worldOf(sim).relics.ids).toEqual(['stillwater_bell']);
      return buildHudSnapshot(sim.state, { seed: 7, hovered: null }).relics;
    };
    expect(relicsOf('sandbox')[0]!.asleep).toBe('Wakes in the Abyssal Rift');
    expect(relicsOf('the_seamstress')[0]).not.toHaveProperty('asleep');
  });
});

describe('a MovementDef’s label names its Movement (the Finale hook)', () => {
  it('absent: Movement N; present: the label, wherever the route says it', () => {
    expect(CONTENT.movements.every((m) => m.label === undefined)).toBe(true);
    expect(movementLabel(3)).toBe('Movement III');
    expect(movementLabel(4)).toBe('Movement IV');
    const defs = [...CONTENT.movements, { label: 'The Finale' }];
    expect(movementLabel(4, defs)).toBe('The Finale');
    expect(movementLabel(2, defs)).toBe('Movement II');
    expect(movementCard(3).title).toBe('Movement III · The Unstitched');
  });
});

describe('the Codex says what Movement III’s specials do', () => {
  const attack = (id: string) => CONTENT.attacks.find((a) => a.id === id)!;

  it('no Movement III special reads "0 damage"', () => {
    const rift = new Set(
      CONTENT.enemies.filter((e) => e.movement === 3).flatMap((e) => e.specials),
    );
    for (const id of rift) expect(attackDamage(attack(id)), id).not.toBe('0 damage');
    const inhale = attack('maw_inhale');
    expect(attackDamage(inhale)).toBe(
      `pulls ${inhale.zone!.pullSpeed} m/s within ${inhale.zone!.radius} m, ${inhale.zone!.status!.dps} damage a second`,
    );
    expect(attackDamage(attack('null_rune'))).toMatch(/refuses Ward, Chime and Reel/);
    expect(attackDamage(attack('mimic_mirror'))).toMatch(/copies your Empower/);
  });

  it('Movement I and II specials read as they did', () => {
    expect(attackDamage(attack('vharun_bloodmoon'))).toBe('0 damage');
    for (const e of CONTENT.enemies.filter((x) => (x.movement ?? 1) < 3))
      for (const id of e.specials) {
        const a = attack(id);
        expect(['zone', 'mimic'], id).not.toContain(a.effect);
      }
  });
});

describe('the aura-silence hint names a Silencing elite only while one stands', () => {
  const silenced = (hud: HudSnapshot): HudSnapshot => ({
    ...hud,
    hymnCircles: 0,
    weaver: { ...hud.weaver, fieldSuppressed: true, downed: true },
  });

  it('a downed Weaver in Movement I or II still reads "the Mute"', () => {
    for (const hud of [
      { ...mockHud('calm'), foes: ['hollow_chorister'] },
      legionHud('vharun-cleave'),
      { ...mockHud('calm'), foes: undefined },
    ]) {
      const text = hint(silenced(hud), 'silenced')!.text;
      expect(text).toMatch(/mark the Mute/);
      expect(text).not.toMatch(/Silencing elite/);
    }
  });

  it('a Silencing elite with no Mute: named; a Mute standing: the Mute', () => {
    const rift = { ...riftHud('rift-cut'), rift: { silencer: true as const } };
    expect(hint(silenced(rift), 'silenced')!.text).toMatch(/mark the Silencing elite/);
    const both = { ...rift, foes: [...(rift.foes ?? []), 'mute'] };
    expect(hint(silenced(both), 'silenced')!.text).toMatch(/mark the Mute/);
  });

  it('the bridge sets rift.silencer for a Silencing elite, and never for a Mute', () => {
    const sim = createSim({ seed: 7, encounter: 'the_seamstress', debug: true });
    const world = worldOf(sim);
    const living = () => world.entities.list().find((e) => e.enemy && e.health && !e.health.dead);
    for (let i = 0; i < 900 && !living(); i++) sim.step([]);
    const foe = living()!;
    expect(buildHudSnapshot(sim.state, { seed: 7, hovered: null }).rift?.silencer).toBeUndefined();
    foe.enemy!.affixes.push('silencing');
    expect(buildHudSnapshot(sim.state, { seed: 7, hovered: null }).rift?.silencer).toBe(true);
    // A Movement I fight: no Rift key at all.
    const m1 = createSim({ seed: 7, encounter: 'first_light' });
    stepFor(m1, 120);
    expect(buildHudSnapshot(m1.state, { seed: 7, hovered: null }).rift).toBeUndefined();
  });
});
