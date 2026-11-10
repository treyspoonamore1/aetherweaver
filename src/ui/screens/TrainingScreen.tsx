import { useMemo, useState } from 'react';
import { useSettings, type Settings } from '../../app/settings';
import { GameHost, seedFromUrl } from '../../app/GameHost';
import { useProfile } from '../../app/profileStore';
import type { CombatSession } from '../../app/runtime';
import { getRuntime } from '../../app/runtimeRegistry';
import { CONTENT } from '../../content';
import { pruneTree } from '../../meta/astrolabe';
import { bondsConfig } from '../../meta/bonds';
import { carriedConfig, carriedRelics } from '../../meta/reliquary';
import { variantsConfig, type Techniques } from '../../meta/variants';
import { CHORD_PRESETS } from '../../meta/run';
import { DevPanel } from '../../debug/DevPanel';
import { PerfHud } from '../../debug/PerfHud';
import { Hud } from '../hud/Hud';
import { PauseMenu } from '../hud/PauseMenu';
import { useMood } from '../kit/sound';
import { useUi } from '../store';
import { SpawnPalette } from './TrainingParts';
import { trainingChoice } from './variantsModel';
import { WardTrainer } from './WardTrainer';
import { t as txt } from '../text';

/**
 * Training Grounds: the sandbox encounter with the debug commands enabled, and the Perfect-Ward
 * trainer (Phase 4g) at the top.
 */
export function TrainingScreen() {
  useMood('calm');
  const [seed] = useState(seedFromUrl);
  const [loadout, setLoadout] = useState(CHORD_PRESETS[0]!.id);
  // The profile's Astrolabe (docs/phase-4.md: try a change before a run), as a run would embark
  // with it: within the Rank's points. Read once: it can't change while training.
  const [astrolabe] = useState(() => {
    const p = useProfile.getState();
    return pruneTree(p.profile.astrolabe, p.astrolabePoints());
  });
  // The relics chosen to carry (docs/phase-4c.md), so one can be tried before a run.
  const [carried] = useState(() => {
    const p = useProfile.getState();
    return carriedConfig(carriedRelics(p.profile.reliquary, p.carrySlots()));
  });
  // The heroes' talents and Solos (docs/phase-4e.md: the Training Grounds play with your current
  // choices), as a run would embark with them: what their Bond ranks (or the settings) open.
  const [bonds] = useState(() => bondsConfig(useProfile.getState().runBonds(CONTENT.defaultParty)));
  // Technique variants (docs/phase-4f.md): the profile's choice to start, with every variant
  // open here (fitted with `all`); any can be tried, whatever's owned. The profile's choice and
  // what it owns stay as they are.
  const [techniques, setTechniques] = useState<Techniques>(() =>
    trainingChoice(useProfile.getState().profile),
  );
  // The assists (hero autonomy, the Perfect window, telegraph lead), as Settings has them. A
  // change made from the pause menu takes effect as the fight resumes (a fresh session), never
  // under the pause.
  const paused = useUi((s) => s.paused);
  const liveAssists = useSettings((s) => s.settings.assists);
  const [assists, setAssists] = useState<Settings['assists']>(liveAssists);
  // By value: any settings change (a volume, a HUD layout) makes a new assists object.
  if (!paused && !sameAssists(assists, liveAssists)) setAssists(liveAssists);
  // A new session (and runtime) whenever the loadout, a technique or an assist changes.
  const session = useMemo<CombatSession>(() => {
    const preset = CHORD_PRESETS.find((p) => p.id === loadout) ?? CHORD_PRESETS[0]!;
    return {
      config: {
        seed,
        encounter: 'sandbox',
        chords: preset.chords.map((c) => ({ auras: [...c.auras], ornaments: [...c.ornaments] })),
        astrolabe,
        relics: carried.relics,
        passives: carried.passives,
        bonds,
        techniques: variantsConfig(techniques),
        assists: { ...assists },
        debug: true,
      },
    };
  }, [seed, loadout, astrolabe, carried, bonds, techniques, assists]);
  const showPerf = useUi((s) => s.showPerf);
  const devOpen = useUi((s) => s.devOpen);
  // Edit HUD layout (from the pause menu) shows the HUD; the fight stays paused under it.
  const editingLayout = useUi((s) => s.layoutEditing);
  const setScreen = useUi((s) => s.setScreen);
  return (
    <div className="relative h-full w-full select-none overflow-hidden">
      <GameHost session={session} />
      <Hud subtitle={txt('screens.trainingScreen.sandbox')} keyHints={false} />
      {!devOpen && (
        <SpawnPalette
          loadout={loadout}
          onLoadout={setLoadout}
          techniques={techniques}
          onTechnique={(slot, id) => setTechniques((t) => ({ ...t, [slot]: id }))}
        />
      )}
      {/* After GameHost: its runtime is started before the trainer listens to it. */}
      <WardTrainer
        session={session}
        hidden={devOpen}
        className="absolute left-1/2 top-4 -translate-x-1/2"
      />
      {showPerf && <PerfHud />}
      {devOpen && <DevPanel />}
      {paused && !editingLayout && (
        <PauseMenu
          mode="training"
          onResume={() => getRuntime()?.setPaused(false)}
          onLeave={() => {
            getRuntime()?.setPaused(false);
            // Back to the Loom, where the Training Grounds are a station.
            setScreen('loom');
          }}
        />
      )}
    </div>
  );
}

function sameAssists(a: Settings['assists'], b: Settings['assists']): boolean {
  return (
    a.autonomy === b.autonomy &&
    a.perfectWindowBonus === b.perfectWindowBonus &&
    a.telegraphLead === b.telegraphLead
  );
}
