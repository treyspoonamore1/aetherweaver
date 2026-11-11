/**
 * Records, from the tree before Phase 7 (main at 81a12ef), the values review A's fixes are proven
 * against: finding 1's fight (`reviewA7Fight.ts`, into `reviewA7Fight.81a12ef.json`) and finding
 * 10's pour (`reviewA7Pour.ts`, into `reviewA7Pour.81a12ef.json`). Run on an export of that
 * commit:
 *
 *   git archive 81a12ef src | tar -x -C <dir>   (with this tree's node_modules linked into <dir>)
 *   npx tsx --tsconfig tsconfig.app.json tests/reviewA7RecordOld.ts <dir>
 *
 * It never overwrites a file (recorded on a later tree it would prove nothing): it writes only
 * the ones missing, as compact JSON, which `npx prettier --write` then lays out (the values are
 * the recorded ones: only the layout changes).
 */
import { existsSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { fakeDom, playFight, type FightModules } from './reviewA7Fight';
import { playPour, type PourModules } from './reviewA7Pour';

const root = process.argv[2];
if (!root) throw new Error('usage: reviewA7RecordOld.ts <the 81a12ef tree>');
const at = (name: string) => fileURLToPath(new URL(`./${name}.81a12ef.json`, import.meta.url));

const sim = await import(`${root}/src/sim/index.ts`);
const set = await import(`${root}/src/app/settings.ts`);

const FIGHT = at('reviewA7Fight');
if (existsSync(FIGHT)) console.log(`${FIGHT} exists: kept.`);
else {
  const restore = fakeDom();
  const cv = await import(`${root}/src/render/combatView.ts`);
  const cam = await import(`${root}/src/render/camera.ts`);
  const content = await import(`${root}/src/content/index.ts`);
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
  writeFileSync(FIGHT, JSON.stringify(record) + '\n');
  console.log(`wrote ${FIGHT}`);
}

const POUR = at('reviewA7Pour');
if (existsSync(POUR)) console.log(`${POUR} exists: kept.`);
else {
  set.useSettings.setState({ settings: set.DEFAULT_SETTINGS });
  const m: PourModules = {
    createSim: sim.createSim,
    EntityLayer: (await import(`${root}/src/render/entities.ts`)).EntityLayer,
    createModelMaterial: (await import(`${root}/src/render/models/material.ts`))
      .createModelMaterial,
    FxKit: (await import(`${root}/src/render/fx/kit.ts`)).FxKit,
    ModelBatch: (await import(`${root}/src/render/models/batch.ts`)).ModelBatch,
  };
  writeFileSync(POUR, JSON.stringify({ commit: '81a12ef', frames: playPour(m) }) + '\n');
  console.log(`wrote ${POUR}`);
}
