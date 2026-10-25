import { Button } from '../kit/Button';
import { Icon, type IconName } from '../kit/Icon';
import { KeyCap } from '../kit/KeyCap';
import { Modal } from '../kit/Modal';
import { bindingLabel } from './labels';

const STORE_KEY = 'aetherweaver.howto.v1';

export function howToSeen(): boolean {
  try {
    return localStorage.getItem(STORE_KEY) === '1';
  } catch {
    return false;
  }
}

export function markHowToSeen(): void {
  try {
    localStorage.setItem(STORE_KEY, '1');
  } catch {
    // Shown again next time; harmless.
  }
}

interface Row {
  icon: IconName;
  keys: string[];
  title: string;
  body: string;
}

function rows(): Row[] {
  return [
    {
      icon: 'move',
      keys: (['moveUp', 'moveLeft', 'moveDown', 'moveRight'] as const).map(bindingLabel),
      title: 'You are the Weaver',
      body: 'Walk with the keys. Your party follows, fights on its own, and fights better inside your aura field.',
    },
    {
      icon: 'thread',
      keys: ['1', '2', '3', 'RMB'],
      title: 'Thread a hero',
      body: 'Click a party frame (or press its number) to tie your Thread to that hero. Mend heals them; right-click switches to Empower for extra damage. Your beam song pours into whoever you thread.',
    },
    {
      icon: 'ward',
      keys: [bindingLabel('ward')],
      title: 'Ward before the hit',
      body: 'Watch the striped bar on a hero’s frame: that is damage on its way. Ward them just before it lands for a Perfect Ward.',
    },
    {
      icon: 'call',
      keys: [],
      title: 'Answer their calls',
      body: 'Before a big move a hero calls for help: a gold glyph on their frame shows what they want, its key and a countdown. Answer in time and the move becomes a Flourish.',
    },
    {
      icon: 'chime',
      keys: [bindingLabel('chime'), bindingLabel('reel')],
      title: 'Chime and Reel',
      body: 'Chime cleanses marks in a circle under your cursor. Reel yanks a hero out of danger and to your side.',
    },
    {
      icon: 'note',
      keys: [bindingLabel('cue'), bindingLabel('crescendo')],
      title: 'Build Resonance',
      body: 'Good support fills Resonance. Spend a segment to Cue a charged hero’s Solo, or a full song on your Crescendo.',
    },
  ];
}

/** First-fight primer. The sim is paused while it is open (docs/plan/04 §7). */
export function HowToPlay({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="How to play" width="max-w-2xl" onClose={onClose} closeOnEscape>
      <p className="mt-1 text-sm text-muted">The fight is paused until you begin.</p>
      <ul className="mt-4 flex flex-col gap-3">
        {rows().map((r) => (
          <li
            key={r.title}
            className="flex gap-3 rounded-xl border border-ink-600/60 bg-ink-900/60 p-3"
          >
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gold-500/50 bg-gold-400/10 text-gold-300">
              <Icon name={r.icon} size={20} />
            </span>
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-1.5 font-semibold text-gold-200">
                {r.title}
                <span className="flex gap-1">
                  {r.keys.map((k) => (
                    <KeyCap key={k} label={k} />
                  ))}
                </span>
              </p>
              <p className="mt-0.5 text-sm leading-relaxed text-text">{r.body}</p>
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-5 flex items-center justify-between gap-3">
        <p className="text-xs text-muted">
          <KeyCap label="Esc" /> pauses at any time.
        </p>
        <Button variant="primary" size="lg" data-autofocus onClick={onClose} sound="confirm">
          Begin the fight
        </Button>
      </div>
    </Modal>
  );
}
