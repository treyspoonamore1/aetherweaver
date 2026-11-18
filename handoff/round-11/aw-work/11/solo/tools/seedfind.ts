import { makeBot } from '/home/user/aw-work/wt-p11solo/src/bots';
import type { Command, WorldState } from '/home/user/aw-work/wt-p11solo/src/sim';
import { playEncounter } from '/home/user/aw-work/wt-p11solo/tools/harness-core';
import { ARRIVAL3_KIT, kitConfig } from '/home/user/aw-work/wt-p11solo/tools/kits';
import { decreeFight } from '/home/user/aw-work/wt-p11solo/tools/decrees';

const KIT3 = kitConfig(ARRIVAL3_KIT);
const wins: number[] = [];
for (let i = 0; i < 12; i++) {
  const seed = 1000 + i * 7919;
  const run = playEncounter({ seed, encounter: 'frayed_threshold', ...KIT3 }, 'skilled');
  if (run.outcome === 'victory' && run.share > 0.3) wins.push(seed);
}
console.log('frayed_threshold skilled wins:', wins.join(' '));
const stolen: number[] = [];
for (let i = 0; i < 40 && stolen.length < 3; i++) {
  const seed = 1000 + i * 7919;
  const skilled = makeBot('skilled', seed);
  let gone = false;
  let up = false;
  const deserter = {
    name: 'deserter',
    decide(state: WorldState): Command[] {
      up = state.field.stolen !== undefined;
      const boss = state.entities.get(state.encounter.bossId ?? -1);
      const near = boss?.health !== undefined && boss.health.hp <= 0.7 * boss.health.maxHp;
      if (!near && !gone) return skilled.decide(state);
      if (gone) return [];
      gone = true;
      return [{ t: 'debug', op: { op: 'teleportWeaver', x: 0, z: 21 } }];
    },
  };
  const f = decreeFight('the_unweaver', seed, 'skilled', deserter);
  const ok =
    !f.won &&
    up &&
    f.occurrences['Steal Verse'] === f.seen['Steal Verse']! - 1 &&
    f.answered['Steal Verse'] === 0;
  if (ok) stolen.push(seed);
}
console.log('decree gate seeds:', stolen.join(' '));
