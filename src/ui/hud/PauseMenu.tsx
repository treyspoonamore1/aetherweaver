import type { RunState } from '../../meta/types';
import { useState } from 'react';
import { SettingsPanel } from '../screens/SettingsScreen';
import { Button } from '../kit/Button';
import { Icon } from '../kit/Icon';
import { KeyCap } from '../kit/KeyCap';
import { Modal } from '../kit/Modal';
import { bindingLabel } from './labels';
import { useUi } from '../store';
import { abandonLine } from '../screens/routeText';
import { t } from '../text';

/**
 * Pause menu (Esc): resume, settings, Edit HUD layout (the party frames moved and sized,
 * docs/health-ui.md), leave. The runtime owns the Esc toggle itself.
 */
export function PauseMenu({
  mode,
  onResume,
  onAbandon,
  onLeave,
  movements = 1,
  run,
}: {
  mode: 'run' | 'training';
  /** The run's Movements (docs/phase-5a.md): 1, the Prelude; more, an Expedition. */
  movements?: number;
  /** Phase 6: an Echo or a weekly names itself in the abandon dialog (omitted: neither). */
  run?: Partial<Pick<RunState, 'echo' | 'weekly'>>;
  onResume: () => void;
  /** Run only: gives up the run (goes to the Summary). */
  onAbandon?: () => void;
  /** Training only: leaves the Training Grounds (for the Loom). */
  onLeave?: () => void;
}) {
  const [view, setView] = useState<'menu' | 'settings' | 'confirm'>('menu');
  if (view === 'settings') {
    return (
      <Modal title={t('hud.pauseMenu.settings')} width="max-w-2xl">
        <SettingsPanel compact context={mode} />
        <div className="mt-5 flex justify-end">
          <Button variant="primary" data-autofocus onClick={() => setView('menu')} sound="back">
            <Icon name="back" size={16} /> {t('hud.pauseMenu.backToThePause')}
          </Button>
        </div>
      </Modal>
    );
  }
  if (view === 'confirm') {
    return (
      <Modal title={t('hud.pauseMenu.abandonThisRun')} width="max-w-md">
        <p className="mt-2 text-sm leading-relaxed text-muted">
          {abandonLine({ movements, ...run }, true)}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" data-autofocus onClick={() => setView('menu')} sound="back">
            {t('hud.pauseMenu.keepPlaying')}
          </Button>
          <Button variant="danger" onClick={onAbandon} sound="confirm">
            {t('hud.pauseMenu.abandonRun')}
          </Button>
        </div>
      </Modal>
    );
  }
  return (
    <Modal title={t('hud.pauseMenu.paused')} width="max-w-sm">
      <p className="mt-1 text-sm text-muted">{t('hud.pauseMenu.theSimulationIsFrozen')}</p>
      <div className="mt-5 flex flex-col gap-2">
        <Button variant="primary" size="lg" data-autofocus onClick={onResume} sound="confirm">
          <Icon name="play" size={16} /> {t('hud.pauseMenu.resume')}
          <KeyCap label={bindingLabel('pause')} />
        </Button>
        <Button size="lg" onClick={() => setView('settings')}>
          <Icon name="gear" size={16} /> {t('hud.pauseMenu.settings')}
        </Button>
        <Button
          size="lg"
          onClick={() => useUi.getState().setLayoutEditing(true)}
          data-testid="edit-layout"
        >
          <Icon name="move" size={16} /> {t('hud.pauseMenu.editHudLayout')}
        </Button>
        {mode === 'run' ? (
          <Button variant="danger" size="lg" onClick={() => setView('confirm')}>
            <Icon name="flag" size={16} /> {t('hud.pauseMenu.abandonRun')}
          </Button>
        ) : (
          <Button size="lg" onClick={onLeave} sound="back">
            <Icon name="home" size={16} /> {t('hud.pauseMenu.leaveTrainingGrounds')}
          </Button>
        )}
      </div>
    </Modal>
  );
}
