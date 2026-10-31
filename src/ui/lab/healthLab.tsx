/**
 * UI lab: health at a glance and the HUD's layout (docs/health-ui.md). `LayoutStage` is a fight's
 * HUD with its party frames and Weaver bar placed by given layouts; `EditStage` opens Edit HUD
 * layout over it, live on the settings store, so they can be dragged and sized.
 */
import { useEffect, useMemo } from 'react';
import { useSettings, type FramesLayout, type WeaverBarLayout } from '../../app/settings';
import { HudView } from '../hud/Hud';
import { LayoutEditor, type PanelId } from '../hud/LayoutEditor';
import { useUi } from '../store';
import { mockCallouts, mockHud, type HudScenario } from './mock';

/** A fight's HUD with its party frames placed by `layout`, its Weaver bar by `bar`. */
export function LayoutStage({
  layout,
  bar,
  scenario = 'crisis',
}: {
  layout: FramesLayout;
  bar?: WeaverBarLayout;
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
      weaverBarLayout={bar}
    />
  );
}

/**
 * Edit HUD layout over a fight's HUD, on the real settings store (as the pause menu opens it).
 * `panel`: the panel chosen; `bar`: the Weaver bar shown moved (a draft, not saved). Keep `bar`
 * the same object across renders.
 */
export function EditStage({ panel, bar }: { panel?: PanelId; bar?: WeaverBarLayout } = {}) {
  const saved = useSettings((s) => s.settings.hud.frames);
  const savedBar = useSettings((s) => s.settings.hud.weaverBar);
  const draft = useUi((s) => s.framesDraft);
  const barDraft = useUi((s) => s.weaverBarDraft);
  const editing = useUi((s) => s.layoutEditing);
  useEffect(() => {
    useUi.getState().setLayoutEditing(true);
    if (bar) useUi.getState().setWeaverBarDraft(bar);
    return () => useUi.getState().setLayoutEditing(false);
  }, [bar]);
  return (
    <>
      <LayoutStage layout={draft ?? saved} bar={barDraft ?? savedBar} scenario="calm" />
      {editing && (
        <LayoutEditor initial={panel} onDone={() => useUi.getState().setLayoutEditing(false)} />
      )}
    </>
  );
}
