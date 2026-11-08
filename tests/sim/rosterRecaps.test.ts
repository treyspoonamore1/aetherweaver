/**
 * Phase 5e integration (docs/phase-5e.md, "Down recaps"): the sim writes Seren's and Oro's down
 * records (`DeathRecord.duel` / `.grove`) from the killing blow, and nobody else's carries them;
 * the map names a Rank-gated recruiting fight's Threat once your Rank shows it (`nodeThreat`).
 */
import { describe, expect, it } from 'vitest';
import * as Run from '../../src/meta/run';
import { EVERYTHING } from '../../src/meta/profile';
import type { MapNode } from '../../src/meta/types';
import { addShield, dealDamage } from '../../src/sim/combat/health';
import type { Entity } from '../../src/sim/state';
import { sandbox, worldOf } from './helpers';
import { foe, place } from './serenHelpers';

function staged(party: string[]) {
  const sim = sandbox({ party });
  const w = worldOf(sim);
  const of = (id: string) =>
    w.party.map((p) => w.entities.get(p)!).find((e) => e.hero!.defId === id)!;
  return { sim, w, of };
}

/** Fells `e` with one blow from `src` (a melee swing, or a plain hit). */
function fell(w: ReturnType<typeof worldOf>, e: Entity, src: Entity, melee: boolean) {
  dealDamage(w, e, {
    source: src.id,
    sourceName: 'Test blow',
    amount: e.health!.hp + e.health!.maxHp,
    ...(melee ? { melee: true as const } : {}),
  });
  const d = w.ledger.deaths.at(-1)!;
  expect(d.hero).toBe(e.id);
  return d;
}

describe('Seren’s down record', () => {
  it('an unwarded melee blow: parryable, not warded, not far', () => {
    const { w, of } = staged(['kael', 'lyra', 'seren']);
    const seren = of('seren');
    place(seren, 0, 0);
    const brute = foe(w, 'bell_brute', 1.5, 0, { stun: true });
    expect(fell(w, seren, brute, true).duel).toEqual({
      warded: false,
      parryable: true,
      overextended: false,
      far: false,
    });
  });

  it('a hit from far with a Ward on her: warded, not parryable, far', () => {
    const { w, of } = staged(['kael', 'lyra', 'seren']);
    const seren = of('seren');
    place(seren, 0, 0);
    const caster = foe(w, 'bell_brute', 14, 0, { stun: true });
    addShield(w, seren, 'ward', 5, 3, true);
    seren.hero!.duel!.overextended = true;
    expect(fell(w, seren, caster, false).duel).toEqual({
      warded: true,
      parryable: false,
      overextended: true,
      far: true,
    });
  });
});

describe('Oro’s down record', () => {
  it('caught in melee; a Severing cut on him in the last seconds; Saplings felled outside', () => {
    const { w, of } = staged(['kael', 'lyra', 'oro']);
    const oro = of('oro');
    place(oro, 0, 0);
    const brute = foe(w, 'bell_brute', 1.5, 0, { stun: true });
    oro.hero!.grove!.feltOutside = 2;
    oro.hero!.grove!.threadCutAt = w.time;
    expect(fell(w, oro, brute, false).grove).toEqual({
      melee: true,
      feltOutside: 2,
      threadCut: true,
    });
  });

  it('from far, long after a cut: neither melee nor the cut', () => {
    const { w, of } = staged(['kael', 'lyra', 'oro']);
    const oro = of('oro');
    place(oro, 0, 0);
    const far = foe(w, 'bell_brute', 14, 0, { stun: true });
    oro.hero!.grove!.threadCutAt = w.time - 30;
    expect(fell(w, oro, far, false).grove).toEqual({
      melee: false,
      feltOutside: 0,
      threadCut: false,
    });
  });
});

describe('everyone else’s down', () => {
  it('carries neither', () => {
    const { w, of } = staged(['kael', 'lyra', 'vexis']);
    const kael = of('kael');
    const brute = foe(w, 'bell_brute', kael.x + 1.5, kael.z, { stun: true });
    const d = fell(w, kael, brute, true);
    expect('duel' in d || 'grove' in d).toBe(false);
  });
});

describe('the map’s Threat for a Rank-gated recruiting fight', () => {
  it('the row’s, once your allowance shows the choice; the node’s own otherwise', () => {
    const run = Run.newRun(4);
    const base = run.map.rows.find((r) => Run.rowThreat(run, r[0]!) > 1)![0]!;
    const node: MapNode = {
      ...base,
      kind: 'event',
      eventId: 'tithe_altar',
      encounterId: null,
      reward: { ...base.reward, threat: 1 },
    };
    expect(Run.nodeThreat(run, node)).toBe(1);
    expect(Run.nodeThreat(run, node, { recruits: new Set() })).toBe(1);
    expect(Run.nodeThreat(run, node, EVERYTHING)).toBe(Run.rowThreat(run, node));
    // A fight node keeps its own.
    expect(Run.nodeThreat(run, base, EVERYTHING)).toBe(base.reward.threat);
  });
});
