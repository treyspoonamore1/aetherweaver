import { movementEncounters } from '/home/user/aw-work/wt-p11solo/tools/harness-core';
import { encounterDef } from '/home/user/aw-work/wt-p11solo/src/content';
for (const m of [1, 2, 3, 4]) {
  console.log(m, movementEncounters(m).map((id) => `${id}:${encounterDef(id).kind}`).join(' '));
}
