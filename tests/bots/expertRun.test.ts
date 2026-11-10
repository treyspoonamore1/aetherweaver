/**
 * The Expert's run policy (src/bots/expertRun.ts, docs/phase-6.md "Design: the expert bot" item
 * 3): each choice on hand-built offers, the Calling paths, and the Rank 20 build's Bonds.
 */
import { describe, expect, it } from 'vitest';
import {
  CALLING_TAGS,
  ELITE_AT,
  ELITE_SHUNS,
  ELITE_UNDER,
  EXPERT_PATHS,
  REST_BELOW,
  expertBonds,
  expertDraft,
  expertMotifOrder,
  expertNode,
  expertPath,
  expertRelic,
  expertRespite,
  expertShop,
} from '../../src/bots/expertRun';
import { CONTENT, callingDef } from '../../src/content';
import * as Run from '../../src/meta/run';
import type { MapNode, RunState, ShopItem } from '../../src/meta/types';

const base = (): RunState => Run.embark(Run.newRun(2000));
const withLife = (run: RunState, hpPct: number, shaken = false): RunState => ({
  ...run,
  party: run.party.map((h) => ({ ...h, hpPct, shaken })),
});
const motif = (
  rarity: string,
  extra: (m: (typeof CONTENT.motifs)[number]) => boolean = () => true,
) => CONTENT.motifs.find((m) => m.rarity === rarity && extra(m))!;

describe('the Expert run policy (src/bots/expertRun.ts)', () => {
  it('rests only when a hero is under 50% or Shaken; else meditates', () => {
    const run = base();
    expect(REST_BELOW).toBe(0.5);
    expect(expertRespite(withLife(run, 1))).toBe('meditate');
    expect(expertRespite(withLife(run, 0.55))).toBe('meditate');
    expect(expertRespite(withLife(run, 0.49))).toBe('rest');
    expect(expertRespite(withLife(run, 1, true))).toBe('rest');
  });

  it('takes an elite at 70% average life or more under 20 points without Elite Vanguard, and none else', () => {
    const run = base();
    const node = (id: string, kind: MapNode['kind']): MapNode => ({
      id,
      row: 1,
      x: 0,
      kind,
      encounterId: null,
      eventId: null,
      next: [],
      reward: run.map.rows[0]![0]!.reward,
      movement: 1,
    });
    const options = [node('a', 'skirmish'), node('b', 'elite'), node('c', 'event')];
    expect(ELITE_AT).toBe(0.7);
    expect(expertNode(options, withLife(run, 0.7))).toBe(1);
    const hurt = expertNode(options, withLife(run, 0.69));
    expect(hurt === 0 || hurt === 2).toBe(true);
    // No elite offered and healthy, or every option an elite: the harness's own pick.
    expect(expertNode([options[0]!, options[2]!], withLife(run, 1))).toBeUndefined();
    expect(expertNode([options[1]!], withLife(run, 0.2))).toBeUndefined();
    // The run's Dissonance weighs in: at 20 points or more, or with Elite Vanguard, no elite.
    const at = (levels: RunState['dissonance']) => ({ ...withLife(run, 1), dissonance: levels });
    expect(ELITE_UNDER).toBe(20);
    expect(ELITE_SHUNS).toBe('elite_vanguard');
    const tierI = [
      { id: 'hardened', rank: 2 },
      { id: 'wounding_strikes', rank: 2 },
    ];
    expect(expertNode(options, at(tierI))).toBe(1);
    const twenty = [...tierI, { id: 'restless_dead', rank: 1 }, { id: 'tyrant', rank: 1 }];
    expect([0, 2]).toContain(expertNode(options, at([...twenty, { id: 'brisk_foes', rank: 1 }])));
    expect([0, 2]).toContain(expertNode(options, at([{ id: 'elite_vanguard', rank: 1 }])));
    // An Echo's forced levels count toward the weight, though they add no points.
    const forced = [
      { id: 'restless_dead', rank: 1, forced: true as const },
      { id: 'hardened', rank: 2 },
      { id: 'wounding_strikes', rank: 2 },
      { id: 'tyrant', rank: 1 },
      { id: 'brisk_foes', rank: 1 },
    ];
    expect([0, 2]).toContain(expertNode(options, at(forced)));
    expect(expertNode(options, at(forced.slice(1)))).toBe(1);
  });

  it('drafts by rarity, then by tags shared with the Calling and Chords, then a level it owns', () => {
    const run = base();
    const common = motif('common');
    const rare = motif('rare');
    const epic = motif('epic');
    const opt = (id: string, upgrade = false) => ({ motifId: id, level: 1, upgrade });
    expect(expertDraft([opt(common.id), opt(rare.id), opt(epic.id)], run)).toBe(2);
    expect(expertDraft([opt(common.id), opt(rare.id)], run)).toBe(1);
    // Two of a rarity: the one sharing a tag with the Calling.
    const cue = motif('rare', (m) => m.tags.includes('cue') && !m.tags.includes('aura'));
    const other = motif(
      'rare',
      (m) => !m.tags.some((t) => CALLING_TAGS.conductor!.includes(t) || t === 'aura'),
    );
    const conductor: RunState = {
      ...run,
      calling: { id: 'conductor', path: [null, null, null, null] },
    };
    expect(expertDraft([opt(other.id), opt(cue.id)], conductor)).toBe(1);
    expect(expertDraft([opt(other.id), opt(cue.id)], run)).toBe(0);
    // Alike else (a rarity, no shared tag): a level of one it owns.
    const plain = (m: (typeof CONTENT.motifs)[number]) =>
      !m.tags.includes('aura') && m.requires.aura === undefined;
    const [first, second] = CONTENT.motifs.filter((m) => m.rarity === 'rare' && plain(m));
    const owned: RunState = { ...run, motifs: [{ id: second!.id, level: 1 }] };
    expect(expertDraft([opt(first!.id), opt(second!.id, true)], owned)).toBe(1);
    expect(expertDraft([opt(first!.id), opt(second!.id)], run)).toBe(0);
    expect(expertDraft([], run)).toBeUndefined();
  });

  it('ranks every motif for an event as the draft does', () => {
    const order = expertMotifOrder(base());
    expect(new Set(order).size).toBe(CONTENT.motifs.length);
    const first = CONTENT.motifs.find((m) => m.id === order[0])!;
    expect(first.rarity).toBe('epic');
  });

  it('takes relics by rarity, a cursed one last', () => {
    const of = (r: string) => CONTENT.relics.find((x) => x.rarity === r)!.id;
    expect(expertRelic([of('common'), of('legendary'), of('rare')])).toBe(1);
    expect(expertRelic([of('cursed'), of('common')])).toBe(1);
    expect(expertRelic([of('rare'), of('rare')])).toBe(0);
  });

  it('shops for the rarest relic it can pay for, else a motif level, else healing when hurt', () => {
    const run = { ...base(), aether: 200 };
    const item = (
      kind: ShopItem['kind'],
      id: string,
      price: number,
      upgrade = false,
    ): ShopItem => ({
      kind,
      id,
      level: upgrade ? 2 : 1,
      upgrade,
      heal: kind === 'heal' ? 0.3 : 0,
      price,
      sold: false,
    });
    const of = (r: string) => CONTENT.relics.find((x) => x.rarity === r)!.id;
    const m = motif('rare');
    const items = [
      item('motif', m.id, 50, true),
      item('relic', of('common'), 80),
      item('relic', of('legendary'), 300),
      item('relic', of('rare'), 150),
      item('relic', of('cursed'), 40),
      item('heal', '', 30),
    ];
    expect(expertShop(items, run)).toBe(3);
    const noRelics = items.map((x) =>
      x.kind === 'relic' && x.id !== of('cursed') ? { ...x, sold: true } : x,
    );
    expect(expertShop(noRelics, run)).toBe(0);
    const nothing = noRelics.map((x) => (x.kind === 'motif' ? { ...x, sold: true } : x));
    expect(expertShop(nothing, withLife(run, 1))).toBeNull();
    expect(expertShop(nothing, withLife(run, 0.5))).toBe(5);
  });

  it('plays a path on every tier for each of the four Callings, and none without one', () => {
    expect(expertPath(null)).toBeUndefined();
    for (const [id, ids] of Object.entries(EXPERT_PATHS)) {
      const def = callingDef(id);
      const path = expertPath(id)!;
      expect(path, id).toHaveLength(def.tiers.length);
      path.forEach((k, i) => expect(def.tiers[i]!.options[k]!.id, `${id} ${i}`).toBe(ids[i]));
    }
    expect(Object.keys(EXPERT_PATHS).sort()).toEqual(CONTENT.callings.map((c) => c.id).sort());
  });

  it('gives each hero of the party a full Bond: one talent of each tier, their own Solo', () => {
    const bonds = expertBonds(CONTENT.defaultParty);
    expect(bonds.map((b) => b.heroId)).toEqual([...CONTENT.defaultParty]);
    for (const b of bonds) {
      expect(b.solo).toBeNull();
      expect(
        b.talents.map((t) => CONTENT.talents.find((x) => x.id === t)!.tier),
        b.heroId,
      ).toEqual([1, 2, 3]);
    }
  });
});
