/**
 * The playtest demo (docs/demo.md): a build for testers, who choose how to start. **Fresh** is the
 * real first hours; **veteran** is a Weaver some hours in, so the later systems can be tried at
 * once. Built with `VITE_DEMO=1`.
 */
import { RANK_XP, UNLOCKS } from '../meta/profile';
import * as Run from '../meta/run';
import { useProfile } from './profileStore';
import { useRun } from './runStore';

/** Is this the playtest demo's build? (Read loosely: the tests type-check without Vite's types.) */
export const DEMO =
  (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_DEMO === '1';

export type DemoStart = 'fresh' | 'veteran';

/** The veteran's Weaver Rank: every Calling and the Reliquary open, a few Ranks short of the top. */
export const VETERAN_RANK = 12;

/**
 * Starts the demo over as a fresh Weaver or a veteran, dropping any run in progress. The veteran
 * is built through the stores' own actions, as play would have built them: Rank 12 with the
 * Astrolabe's points left to spend, Starlight, a variant owned, the Luminary mastered and the
 * Martyr on her way, Brann recruited, Bonds at rank 4 (their first talents), a won run's Deed, and two relics
 * enshrined with materials to craft, Prism Loom carried. Their runs are Expeditions.
 * `recruit: false` leaves Brann in his cell (the e2e roster smoke recruits him itself).
 */
export function startDemo(kind: DemoStart, { recruit = true }: { recruit?: boolean } = {}): void {
  useRun.getState().closeRun();
  const store = useProfile.getState();
  store.resetProgress();
  if (kind === 'fresh') return;
  store.award(RANK_XP[VETERAN_RANK - 1]!);
  // A veteran has seen the rank-up cards and met what they opened (Prep marks nothing "New");
  // the stations' own intros still play.
  useProfile.getState().dismissRankUps();
  store.markIntroduced(UNLOCKS.filter((u) => u.rank <= VETERAN_RANK).map((u) => u.id));
  store.awardStarlight(320);
  store.ownVariant('purge');
  store.awardMastery('luminary', 1500);
  store.awardMastery('martyr', 480);
  // Brann freed from his cell on an earlier Expedition (docs/phase-5b.md), so Prep picks 3 of 4,
  // his Bond level with the others'.
  if (recruit) {
    store.recruit(['brann']);
    useProfile.getState().clearRecruitNotices();
  }
  store.awardBonds({ kael: 440, lyra: 440, vexis: 440, ...(recruit ? { brann: 440 } : {}) });
  useProfile.getState().dismissBondNotices();
  // A run won: its Deed lights the Hall of Deeds, and the record counts it.
  store.recordDeeds({ ...Run.newRun(1), outcome: 'victory' });
  useProfile.getState().dismissDeeds();
  store.recordRun(true);
  // Past their first run and Rank 2, a veteran's runs are Expeditions (docs/phase-5a.md).
  store.setRunMode('expedition');
  for (const id of ['prism_loom', 'lantern_of_the_lost']) store.enshrine({ id, cleansed: false });
  store.payReliquary({ shards: 40, tears: 2 });
  // Prism Loom carried (and attuned): a run shows a relic at work from its first fight.
  store.setCarry(
    useProfile
      .getState()
      .profile.reliquary.relics.slice(0, 1)
      .map((r) => r.uid),
  );
}
