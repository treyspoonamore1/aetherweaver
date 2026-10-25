import { useState } from 'react';
import { SettingsPanel } from '../screens/SettingsScreen';
import { Button } from '../kit/Button';
import { Icon } from '../kit/Icon';
import { KeyCap } from '../kit/KeyCap';
import { Modal } from '../kit/Modal';
import { bindingLabel } from './labels';

/** Pause menu (Esc): resume, settings, leave. The runtime owns the Esc toggle itself. */
export function PauseMenu({
  mode,
  onResume,
  onAbandon,
  onLeave,
}: {
  mode: 'run' | 'training';
  onResume: () => void;
  /** Run only: gives up the run (goes to the Summary). */
  onAbandon?: () => void;
  /** Training only: back to the title. */
  onLeave?: () => void;
}) {
  const [view, setView] = useState<'menu' | 'settings' | 'confirm'>('menu');
  if (view === 'settings') {
    return (
      <Modal title="Settings" width="max-w-2xl">
        <SettingsPanel compact />
        <div className="mt-5 flex justify-end">
          <Button variant="primary" data-autofocus onClick={() => setView('menu')} sound="back">
            <Icon name="back" size={16} /> Back to the pause menu
          </Button>
        </div>
      </Modal>
    );
  }
  if (view === 'confirm') {
    return (
      <Modal title="Abandon this run?" width="max-w-md">
        <p className="mt-2 text-sm leading-relaxed text-muted">
          The Prelude ends here and you go straight to the summary. This cannot be undone.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" data-autofocus onClick={() => setView('menu')} sound="back">
            Keep playing
          </Button>
          <Button variant="danger" onClick={onAbandon} sound="confirm">
            Abandon run
          </Button>
        </div>
      </Modal>
    );
  }
  return (
    <Modal title="Paused" width="max-w-sm">
      <p className="mt-1 text-sm text-muted">The simulation is frozen.</p>
      <div className="mt-5 flex flex-col gap-2">
        <Button variant="primary" size="lg" data-autofocus onClick={onResume} sound="confirm">
          <Icon name="play" size={16} /> Resume
          <KeyCap label={bindingLabel('pause')} />
        </Button>
        <Button size="lg" onClick={() => setView('settings')}>
          <Icon name="gear" size={16} /> Settings
        </Button>
        {mode === 'run' ? (
          <Button variant="danger" size="lg" onClick={() => setView('confirm')}>
            <Icon name="flag" size={16} /> Abandon run
          </Button>
        ) : (
          <Button size="lg" onClick={onLeave} sound="back">
            <Icon name="home" size={16} /> Leave Training Grounds
          </Button>
        )}
      </div>
    </Modal>
  );
}
