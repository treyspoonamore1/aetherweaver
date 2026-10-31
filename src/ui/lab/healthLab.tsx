/**
 * UI lab: health at a glance and the party frames' layout (docs/health-ui.md). `LayoutStage` is
 * a fight's HUD with its frames placed by a given layout; `EditStage` opens Edit HUD layout over
 * it, live on the settings store, so the frames can be dragged, sized and turned.
 */
import { useEffect, useMemo } from 'react';
import { useSettings, type FramesLayout } from '../../app/settings';
import { HudView } from '../hud/Hud';
import { LayoutEditor } from '../hud/LayoutEditor';
import { useUi } from '../store';
import { mockCallouts, mockHud, type HudScenario } from './mock';

/** A fight's HUD with its party frames placed by `layout`. */
export function LayoutStage({
  layout,
  scenario = 'crisis',
}: {
  layout: FramesLayout;
  scenario?: HudScenario;
}) {
  const hud = useMemo(() => mockHud(scenario), [scenario]);
  const callouts = useMemo(() => mockCallouts(scenario), [scenario]);
  return (
    <HudView
      hud={hud}
      callouts={callouts}
      decree={null}
      subtitle="The Prelude · node 3 of 10"
      coach={false}
      keyHints={false}
      framesLayout={layout}
    />
  );
}

/** Edit HUD layout over a fight's HUD, on the real settings store (as the pause menu opens it). */
export function EditStage() {
  const saved = useSettings((s) => s.settings.hud.frames);
  const draft = useUi((s) => s.framesDraft);
  const editing = useUi((s) => s.layoutEditing);
  useEffect(() => {
    useUi.getState().setLayoutEditing(true);
    return () => useUi.getState().setLayoutEditing(false);
  }, []);
  return (
    <>
      <LayoutStage layout={draft ?? saved} scenario="calm" />
      {editing && <LayoutEditor onDone={() => useUi.getState().setLayoutEditing(false)} />}
    </>
  );
}
