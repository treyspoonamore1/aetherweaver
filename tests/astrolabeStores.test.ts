/**
 * The Astrolabe in the stores (app/profileStore.ts, app/runStore.ts; docs/phase-4.md): Prep
 * follows the profile's tree within the points it has now, and songs only a tree makes light
 * enough carry over to the next run.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { useProfile } from '../src/app/profileStore';
import { useRun } from '../src/app/runStore';
import { useSettings } from '../src/app/settings';
import { RANK_XP } from '../src/meta/profile';
import * as Run from '../src/meta/run';

/** Four auras holding 110% of Spirit: too heavy without the Choir's lighter songs. */
const HEAVY = [
  { auras: ['fortissimo', 'ostinato'], ornaments: [] },
  { auras: ['sostenuto', 'allegro'], ornaments: [] },
];
/** Clear Voice and both Breaths: songs light enough for HEAVY. */
const LIGHT = ['choir_t1', 'choir_t2', 'choir_n1', 'choir_b1', 'choir_b2', 'choir_bn', 'choir_b3'];

const skipUnlocks = (on: boolean) =>
  useSettings.getState().update((s) => ({ ...s, unlockAll: on }));
const run = () => useRun.getState().run!;

beforeEach(() => {
  useSettings.getState().reset();
  useProfile.getState().resetProgress();
  useRun.setState({ run: null });
  // Rank 3: every aura HEAVY sings, and no Astrolabe points yet.
  useProfile.getState().award(RANK_XP[2]!);
});

describe('the Astrolabe in the stores', () => {
  it('Prep follows the tree within the points it has now', () => {
    skipUnlocks(true);
    for (const id of LIGHT) useProfile.getState().takeNode(id);
    useRun.getState().newRun(21);
    expect(run().astrolabe).toEqual(LIGHT);
    useRun.getState().setChords(HEAVY);
    expect(run().chords).toEqual(HEAVY);
    // Turning "Skip the unlocks" off takes the points back: Prep's tree goes with them, and
    // songs only that tree could hold aren't offered any more.
    skipUnlocks(false);
    expect(run().astrolabe).toEqual([]);
    useRun.getState().setChords(Run.DEFAULT_CHORDS.map((c) => ({ ...c, auras: [...c.auras] })));
    useRun.getState().setChords(HEAVY);
    expect(run().chords).toEqual(Run.DEFAULT_CHORDS);
    // The profile keeps its tree for when the points come back.
    expect(useProfile.getState().profile.astrolabe).toEqual(LIGHT);
    skipUnlocks(true);
    expect(run().astrolabe).toEqual(LIGHT);
  });

  it('songs only the tree makes light enough are remembered and start the next run', () => {
    skipUnlocks(true);
    for (const id of LIGHT) useProfile.getState().takeNode(id);
    useRun.getState().newRun(22);
    useRun.getState().setChords(HEAVY);
    useRun.getState().embark();
    expect(run().chords).toEqual(HEAVY);
    expect(useProfile.getState().profile.lastChords).toEqual(HEAVY);
    useRun.getState().newRun(23);
    expect(run().chords).toEqual(HEAVY);
    // Without the tree, the next run starts from the defaults.
    useProfile.getState().respecTree();
    useRun.getState().newRun(24);
    expect(run().chords).toEqual(Run.DEFAULT_CHORDS);
  });
});
