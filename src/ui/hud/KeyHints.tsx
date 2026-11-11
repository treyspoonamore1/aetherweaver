import { CONTENT } from '../../content';
import { Panel } from '../kit/Panel';
import { REWIND_NAME } from '../screens/callingText';
import { bindingLabel, cueModifierMark, mouseRoleLabel } from './labels';
import { t as txt } from '../text';

/**
 * A quiet controls reminder (bottom-right). Shown for the first fights and in training. `bear`:
 * a Martyr run, where Bear has its own key (Phase 3d). `rewind`: a Chronomancer run, where
 * Reel's key Rewinds (Phase 3e). `techniques` (Phase 4f): what the four keys play this fight, by
 * name (the variants chosen, Rewind in Reel's slot), in key order. Phase 5f: on a Conductor run,
 * the Cue row says how a Duet is made and the Crescendo row names the Grand Finale.
 */
export function KeyHints({
  bear = false,
  rewind = false,
  techniques,
  crescendoName,
  chainWindow,
}: {
  bear?: boolean;
  rewind?: boolean;
  techniques?: readonly string[];
  /** Phase 5f: the Crescendo by its name when it isn't Sunrise (the Grand Finale). */
  crescendoName?: string;
  /** Phase 5f: the Conductor's chain window (s): a second Cue inside it is a Duet. */
  chainWindow?: number;
}) {
  const t = CONTENT.techniques;
  const names = techniques ?? [
    t.ward.name,
    t.chime.name,
    rewind ? REWIND_NAME : t.reel.name,
    t.glide.name,
  ];
  const rows: [string, string][] = [
    [
      `${bindingLabel('moveUp')}${bindingLabel('moveLeft')}${bindingLabel('moveDown')}${bindingLabel('moveRight')}`,
      txt('hud.keyHints.move'),
    ],
    [txt('hud.keyHints.n14Click'), txt('hud.keyHints.threadAHero')],
    [mouseRoleLabel('mode'), txt('hud.keyHints.mendEmpower')],
    ...(bear
      ? [[bindingLabel('bear'), txt('hud.keyHints.bearTakePartOf')] as [string, string]]
      : []),
    [
      `${bindingLabel('ward')} ${bindingLabel('chime')} ${bindingLabel('reel')} ${bindingLabel('glide')}`,
      names.join(' · '),
    ],
    [
      txt('hud.keyHints.cueKeys', { cue: bindingLabel('cue'), mod: cueModifierMark() }),
      chainWindow !== undefined
        ? txt('hud.keyHints.cueASoloAnother', { Number: Number(chainWindow.toFixed(1)) })
        : txt('hud.keyHints.cueASolo'),
    ],
    [
      bindingLabel('crescendo'),
      crescendoName
        ? txt('hud.keyHints.crescendoNamed', { crescendoName })
        : txt('hud.keyHints.crescendo'),
    ],
    [
      txt('hud.keyHints.holdMmb', {
        bindingLabel: bindingLabel('directiveWheel'),
        wheel: mouseRoleLabel('wheel'),
      }),
      txt('hud.keyHints.directiveWheel'),
    ],
    [
      txt('hud.keyHints.mmbClick', {
        bindingLabel: bindingLabel('directiveFocus'),
        wheel: mouseRoleLabel('wheel'),
      }),
      txt('hud.keyHints.focusAnEnemy'),
    ],
    [bindingLabel('plant'), txt('hud.keyHints.plantPedalPoint')],
    [bindingLabel('pause'), txt('hud.keyHints.pause')],
  ];
  return (
    <Panel
      className="absolute right-4 top-4 hidden px-4 py-3 min-[1180px]:block"
      aria-label={txt('hud.keyHints.controls')}
    >
      <dl className="grid grid-cols-[auto_auto] gap-x-3 gap-y-1 text-xs">
        {rows.map(([key, what]) => (
          <div key={what} className="contents">
            <dt className="font-mono text-gold-300">{key}</dt>
            <dd className="text-muted">{what}</dd>
          </div>
        ))}
      </dl>
    </Panel>
  );
}
