import { Button } from '../kit/Button';
import { Icon, type IconName } from '../kit/Icon';
import { KeyCap } from '../kit/KeyCap';
import { Modal } from '../kit/Modal';
import { bindingLabel } from './labels';
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
 * Phase 4d: what a Cue costs this fight, when Dissonance (Silent Cues) makes it more than a
 * segment of Resonance (null: a segment, as content has it).
 */
export interface CuePrimer {
  cost: number;
}

/**
 * Phase 5f: the Conductor's Cues, as this fight has them (`HudSnapshot.conducting`): what a Cue
 * costs, the chain's window, a Duet's and a Trio's power, and the Crescendo's name and cost.
 */
export interface ConductPrimer {
  cueCost: number;
  chainWindow: number;
  duet: number;
  trio: number;
  crescendoName: string;
  crescendoCost: number;
}

/** "+25%" from a power of 1.25. */
function morePct(power: number): string {
  return `${Math.round((power - 1) * 100)}%`;
}

function cueRow(cue: CuePrimer | null, conduct: ConductPrimer | null): Row {
  if (conduct)
    return {
      icon: 'chain',
      keys: [bindingLabel('cue'), bindingLabel('crescendo')],
      title: t('hud.howToPlay.leadThemDuetsAnd'),
      body: t('hud.howToPlay.goodSupportFillsResonance', {
        cueCost: conduct.cueCost,
        value: cue ? t('hud.howToPlay.raisesItThisRun', { levelName: levelName('cue_cost') }) : '',
        Number: Number(conduct.chainWindow.toFixed(1)),
        morePct: morePct(conduct.duet),
        morePct2: morePct(conduct.trio),
        crescendoName: conduct.crescendoName,
        crescendoCost: conduct.crescendoCost,
      }),
    };
  return {
    icon: 'note',
    keys: [bindingLabel('cue'), bindingLabel('crescendo')],
    title: t('hud.howToPlay.buildResonance'),
    body: cue
      ? t('hud.howToPlay.goodSupportFillsResonance2', {
          cost: cue.cost,
          levelName: levelName('cue_cost'),
        })
      : t('hud.howToPlay.goodSupportFillsResonance3'),
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
      keys: ['1', '2', '3', 'RMB', ...(bear ? [bindingLabel('bear')] : [])],
      title: t('hud.howToPlay.threadAHero'),
      body: t('hud.howToPlay.clickAPartyFrame', {
        value: bear
          ? t('hud.howToPlay.asTheMartyrBears', { bindingLabel: bindingLabel('bear') })
          : '',
      }),
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
    cueRow(cue, conduct),
  ];
}

/**
 * First-fight primer. The sim is paused while it is open (docs/plan/04 §7). `bear`: a Martyr
 * run, where Bear has its own key (Phase 3d). `rewind`: a Chronomancer run, where Reel's key
 * Rewinds (Phase 3e). `cue`: a Cue costs more than a segment this fight (Phase 4d). `conduct`:
 * a Conductor run, whose Cue row teaches Duets, Trios and the Grand Finale (Phase 5f).
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
  /** Phase 5f: a Conductor run (his Cues, Duets, Trios and Grand Finale). */
  conduct?: ConductPrimer | null;
}) {
  return (
    <Modal title={t('hud.howToPlay.howToPlay')} width="max-w-2xl" onClose={onClose} closeOnEscape>
      <p className="mt-1 text-sm text-muted">{t('hud.howToPlay.theFightIsPaused')}</p>
      <ul className="mt-4 flex flex-col gap-3">
        {rows(bear, rewind, cue, conduct).map((r) => (
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
          <KeyCap label={t('hud.howToPlay.esc')} /> {t('hud.howToPlay.pausesAtAnyTime')}
        </p>
        <Button variant="primary" size="lg" data-autofocus onClick={onClose} sound="confirm">
          {t('hud.howToPlay.beginTheFight')}
        </Button>
      </div>
    </Modal>
  );
}
