/**
 * The playtest demo's starts (src/app/demo.ts): a fresh Weaver, or a veteran built through the
 * stores as play would have built them.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { startDemo, VETERAN_RANK, VETERAN_RECRUITS } from '../src/app/demo';
import { useProfile } from '../src/app/profileStore';
import { useRun } from '../src/app/runStore';
import { useSettings } from '../src/app/settings';
import { bondRank } from '../src/meta/bonds';
import { earnedTitles, masteryLevel } from '../src/meta/loom';
import { rankOf } from '../src/meta/profile';

const profile = () => useProfile.getState().profile;

beforeEach(() => {
  useSettings.getState().reset();
  useProfile.getState().resetProgress();
  useRun.getState().closeRun();
});

describe('the demo', () => {
  it('a veteran: the later systems open, Starlight to spend, no rank-up cards waiting', () => {
    startDemo('veteran');
    const p = profile();
    expect(rankOf(p.xp)).toBe(VETERAN_RANK);
    expect(useProfile.getState().rankUps).toEqual([]);
    expect(useProfile.getState().bondNotices).toEqual([]);
    expect(p.starlight).toBeGreaterThan(0);
    expect(p.variants).toEqual(['purge']);
    expect(masteryLevel(p.mastery.luminary ?? 0)).toBe(5);
    expect(earnedTitles(p)).toContain('title_lightbearer');
    expect(p.deeds).toContain('through_the_prelude');
    expect(useProfile.getState().deedNotices).toEqual([]);
    for (const hero of ['kael', 'lyra', 'vexis', 'brann', 'seren', 'oro'])
      expect(bondRank(p.bonds[hero]?.xp ?? 0)).toBeGreaterThanOrEqual(3);
    // Brann freed on an earlier Expedition (docs/phase-5b.md), Seren and Oro met since (Rank 12
    // opens both, docs/phase-5e.md): Prep picks 3 of 6.
    expect(p.recruited).toEqual(['brann', 'seren', 'oro']);
    expect(useProfile.getState().roster()).toEqual([
      'kael',
      'lyra',
      'vexis',
      'brann',
      'seren',
      'oro',
    ]);
    expect(useProfile.getState().recruitNotices).toEqual([]);
    // Their Rank unlocks are met, not "New"; the joins themselves (`hero.<id>`) still are.
    expect(p.introduced).toEqual(expect.arrayContaining(['recruit.seren', 'recruit.oro']));
    expect(p.introduced.some((id) => id.startsWith('hero.'))).toBe(false);
    expect('lastParty' in p).toBe(false);
    expect(p.reliquary.relics.map((r) => r.id).sort()).toEqual(
      ['lantern_of_the_lost', 'prism_loom'].sort(),
    );
    expect(p.reliquary.shards).toBeGreaterThan(0);
    expect(p.reliquary.carry).toHaveLength(1);
    // What Rank 12 opened isn't marked "New" in Prep.
    expect(p.introduced).toContain('astrolabe');
    // The stations' intros are still to come.
    expect(p.introduced.some((id) => id.startsWith('station:'))).toBe(false);
  });

  it('the test hook’s veteran leaves Brann, Seren and Oro to be recruited', () => {
    startDemo('veteran', { recruit: false });
    const p = profile();
    expect(rankOf(p.xp)).toBe(VETERAN_RANK);
    expect('recruited' in p).toBe(false);
    expect(useProfile.getState().roster()).toEqual(['kael', 'lyra', 'vexis']);
    for (const hero of VETERAN_RECRUITS) expect(p.bonds[hero], hero).toBeUndefined();
    // Rank 12 opens both: a test can recruit them.
    useProfile.getState().recruit(['seren', 'oro']);
    expect(profile().recruited).toEqual(['seren', 'oro']);
  });

  it('fresh: a new Weaver, and the run in progress is dropped', () => {
    startDemo('veteran');
    useRun.getState().newRun(7);
    startDemo('fresh');
    expect(rankOf(profile().xp)).toBe(1);
    expect(profile().starlight).toBe(0);
    expect(useRun.getState().run).toBeNull();
    // The fresh start is untouched: the starters only.
    expect('recruited' in profile()).toBe(false);
    expect(useProfile.getState().roster()).toEqual(['kael', 'lyra', 'vexis']);
  });
});
