import { useMemo, useState } from 'react';
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

/** Training Grounds: the sandbox encounter with the debug commands enabled. */
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
  // A new session (and runtime) whenever the loadout or a technique changes.
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
        debug: true,
      },
    };
  }, [seed, loadout, astrolabe, carried, bonds, techniques]);
  const showPerf = useUi((s) => s.showPerf);
  const devOpen = useUi((s) => s.devOpen);
  const paused = useUi((s) => s.paused);
  const setScreen = useUi((s) => s.setScreen);
  return (
    <div className="relative h-full w-full select-none overflow-hidden">
      <GameHost session={session} />
      <Hud subtitle="Sandbox" keyHints={false} />
      {!devOpen && (
        <SpawnPalette
          loadout={loadout}
          onLoadout={setLoadout}
          techniques={techniques}
          onTechnique={(slot, id) => setTechniques((t) => ({ ...t, [slot]: id }))}
        />
      )}
      {showPerf && <PerfHud />}
      {devOpen && <DevPanel />}
      {paused && (
        <PauseMenu
          mode="training"
          onResume={() => getRuntime()?.setPaused(false)}
          onLeave={() => {
            getRuntime()?.setPaused(false);
            setScreen('title');
          }}
        />
      )}
    </div>
  );
}
