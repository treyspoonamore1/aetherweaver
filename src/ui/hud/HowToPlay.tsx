import { Button } from '../kit/Button';
import { Icon, type IconName } from '../kit/Icon';
import { KeyCap } from '../kit/KeyCap';
import { Modal } from '../kit/Modal';
import { bindingLabel, mouseRoleDefault, mouseRoleLabel } from './labels';
import { levelName } from '../screens/dissonanceModel';
import { t } from '../text';

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

/** The Chronomancer's Rewind, in Reel's slot (Phase 3e): how far back, and its cooldown. */
export interface RewindPrimer {
  seconds: number;
  cooldown: number;
}

/**
 * Silent Cues (Dissonance, docs/solos.md): how long your Thread must have been on a hero as their
 * Solo fires for it to be Cued (null: no hold).
 */
export interface CuePrimer {
  hold: number;
}

/**
 * Phase 5f: the Conductor's chain, as this fight has it (`HudSnapshot.conducting`): the window a
 * second Cued Solo must fall in to make a Duet.
 */
export interface ConductPrimer {
  chainWindow: number;
}

/**
 * The Solo row (docs/solos.md): heroes fire their own, and a Solo fired with your Thread on them
 * is Cued. The Conductor's row adds how a Duet and a Trio are made.
 */
function soloRow(cue: CuePrimer | null, conduct: ConductPrimer | null): Row {
  if (conduct)
    return {
      icon: 'chain',
      keys: [],
      title: t('hud.howToPlay.leadThemDuetsAnd'),
      body: t('hud.howToPlay.aSoloFiredDuet', {
        Number: Number(conduct.chainWindow.toFixed(1)),
      }),
    };
  return {
    icon: 'note',
    keys: [],
    title: t('hud.howToPlay.cueTheirSolos'),
    body: cue
      ? t('hud.howToPlay.heroesFireHold', {
          hold: Number(cue.hold.toFixed(1)),
          levelName: levelName('cue_hold'),
        })
      : t('hud.howToPlay.heroesFire'),
  };
}

function rows(
  bear: boolean,
  rewind: RewindPrimer | null,
  cue: CuePrimer | null,
  conduct: ConductPrimer | null,
): Row[] {
  return [
    {
      icon: 'move',
      keys: (['moveUp', 'moveLeft', 'moveDown', 'moveRight'] as const).map(bindingLabel),
      title: t('hud.howToPlay.youAreTheWeaver'),
      body: t('hud.howToPlay.walkWithTheKeys'),
    },
    {
      icon: 'thread',
      keys: ['1', '2', '3', mouseRoleLabel('mode'), ...(bear ? [bindingLabel('bear')] : [])],
      title: t('hud.howToPlay.threadAHero'),
      body: t(
        mouseRoleDefault('mode')
          ? 'hud.howToPlay.clickAPartyFrame'
          : 'hud.howToPlay.clickAPartyFrameMode',
        {
          mode: mouseRoleLabel('mode'),
          value: bear
            ? t('hud.howToPlay.asTheMartyrBears', { bindingLabel: bindingLabel('bear') })
            : '',
        },
      ),
    },
    {
      icon: 'ward',
      keys: [bindingLabel('ward')],
      title: t('hud.howToPlay.wardBeforeTheHit'),
      body: t('hud.howToPlay.watchTheStripedBar'),
    },
    {
      icon: 'call',
      keys: [],
      title: t('hud.howToPlay.answerTheirCalls'),
      body: t('hud.howToPlay.beforeABigMove'),
    },
    rewind
      ? {
          icon: 'rewind',
          keys: [bindingLabel('chime'), bindingLabel('reel')],
          title: t('hud.howToPlay.chimeAndRewind'),
          body: t('hud.howToPlay.chimeCleansesMarksIn', {
            bindingLabel: bindingLabel('reel'),
            seconds: rewind.seconds,
            cooldown: rewind.cooldown,
          }),
        }
      : {
          icon: 'chime',
          keys: [bindingLabel('chime'), bindingLabel('reel')],
          title: t('hud.howToPlay.chimeAndReel'),
          body: t('hud.howToPlay.chimeCleansesMarksIn2'),
        },
    soloRow(cue, conduct),
  ];
}

/**
 * First-fight primer. The sim is paused while it is open (docs/plan/04 §7). `bear`: a Martyr
 * run, where Bear has its own key (Phase 3d). `rewind`: a Chronomancer run, where Reel's key
 * Rewinds (Phase 3e). `cue`: Silent Cues asks the Thread to hold (Phase 4d). `conduct`: a
 * Conductor run, whose Solo row teaches Duets and Trios (Phase 5f).
 */
export function HowToPlay({
  onClose,
  bear = false,
  rewind = null,
  cue = null,
  conduct = null,
}: {
  onClose: () => void;
  bear?: boolean;
  rewind?: RewindPrimer | null;
  cue?: CuePrimer | null;
  /** Phase 5f: a Conductor run (his Duets and Trios). */
  conduct?: ConductPrimer | null;
}) {
  return (
    <Modal title={t('hud.howToPlay.howToPlay')} width="max-w-2xl" onClose={onClose} closeOnEscape>
      {/* Tight enough that all six rows fit a 720 px window with nothing scrolled off the top. */}
      <ul className="mt-2 flex flex-col gap-2">
        {rows(bear, rewind, cue, conduct).map((r) => (
          <li
            key={r.title}
            className="flex gap-3 rounded-xl border border-ink-600/60 bg-ink-900/60 px-3 py-2"
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
              <p className="mt-0.5 text-sm leading-snug text-text">{r.body}</p>
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-xs text-muted">
          <KeyCap label={t('hud.howToPlay.esc')} /> {t('hud.howToPlay.pausesAtAnyTime')}
        </p>
        <Button variant="primary" size="lg" data-autofocus onClick={onClose} sound="confirm">
          {t('hud.howToPlay.beginTheFight')}
        </Button>
      </div>
    </Modal>
  );
}
