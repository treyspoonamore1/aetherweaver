/**
 * The playtest demo's starts (src/app/demo.ts): a fresh Weaver, or a veteran built through the
 * stores as play would have built them.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { startDemo, VETERAN_RANK } from '../src/app/demo';
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
    for (const hero of ['kael', 'lyra', 'vexis'])
      expect(bondRank(p.bonds[hero]?.xp ?? 0)).toBeGreaterThanOrEqual(3);
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

  it('fresh: a new Weaver, and the run in progress is dropped', () => {
    startDemo('veteran');
    useRun.getState().newRun(7);
    startDemo('fresh');
    expect(rankOf(profile().xp)).toBe(1);
    expect(profile().starlight).toBe(0);
    expect(useRun.getState().run).toBeNull();
  });
});
