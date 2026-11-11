/**
 * Records, from the tree before Phase 7 (main at 81a12ef), the values review A's fixes are proven
 * against (finding 1: `reviewA7Fight.ts`). Run once, on an export of that commit:
 *
 *   git archive 81a12ef src | tar -x -C <dir>   (with this tree's node_modules linked into <dir>)
 *   npx tsx --tsconfig tsconfig.app.json tests/reviewA7RecordOld.ts <dir>
 *
 * It refuses to overwrite its file: recorded on a later tree it would prove nothing.
 */
import { existsSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { fakeDom, playFight, type FightModules } from './reviewA7Fight';

const PATH = fileURLToPath(new URL('./reviewA7Fight.81a12ef.json', import.meta.url));
const root = process.argv[2];
if (!root) throw new Error('usage: reviewA7RecordOld.ts <the 81a12ef tree>');
if (existsSync(PATH)) {
  console.error(`${PATH} exists: it is recorded once, from 81a12ef.`);
  process.exit(1);
}

const restore = fakeDom();
const sim = await import(`${root}/src/sim/index.ts`);
const cv = await import(`${root}/src/render/combatView.ts`);
const cam = await import(`${root}/src/render/camera.ts`);
const content = await import(`${root}/src/content/index.ts`);
const set = await import(`${root}/src/app/settings.ts`);
const fight = (screenShake: number) => {
  const settings = { ...set.DEFAULT_SETTINGS, screenShake };
  set.useSettings.setState({ settings });
  const m: FightModules = {
    createSim: sim.createSim,
    CombatView: cv.CombatView,
    CameraRig: cam.CameraRig,
    arena: content.arenaDef(content.encounterDef('sandbox').arena),
    settings,
  };
  return playFight(m);
};
const record = { commit: '81a12ef', defaults: fight(1), shake0: fight(0) };
restore();
writeFileSync(PATH, JSON.stringify(record) + '\n');
console.log(`wrote ${PATH}`);
