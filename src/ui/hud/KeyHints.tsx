import { Panel } from '../kit/Panel';
import { REWIND_NAME } from '../screens/callingText';
import { bindingLabel } from './labels';

/**
 * A quiet controls reminder (bottom-right). Shown for the first fights and in training. `bear`:
 * a Martyr run, where Bear has its own key (Phase 3d). `rewind`: a Chronomancer run, where
 * Reel's key Rewinds (Phase 3e).
 */
export function KeyHints({ bear = false, rewind = false }: { bear?: boolean; rewind?: boolean }) {
  const rows: [string, string][] = [
    [
      `${bindingLabel('moveUp')}${bindingLabel('moveLeft')}${bindingLabel('moveDown')}${bindingLabel('moveRight')}`,
      'Move',
    ],
    ['1–4 / click', 'Thread a hero'],
    ['RMB', 'Mend ⇄ Empower'],
    ...(bear
      ? [[bindingLabel('bear'), 'Bear: take part of their wounds'] as [string, string]]
      : []),
    [
      `${bindingLabel('ward')} ${bindingLabel('chime')} ${bindingLabel('reel')} ${bindingLabel('glide')}`,
      `Ward · Chime · ${rewind ? REWIND_NAME : 'Reel'} · Glide`,
    ],
    [`${bindingLabel('cue')} / ⇧1–4`, 'Cue a Solo'],
    [bindingLabel('crescendo'), 'Crescendo'],
    [`hold ${bindingLabel('directiveWheel')} / MMB`, 'Directive wheel'],
    [`${bindingLabel('directiveFocus')} / MMB click`, 'Focus an enemy'],
    [bindingLabel('plant'), 'Plant Pedal Point'],
    [bindingLabel('pause'), 'Pause'],
  ];
  return (
    <Panel
      className="absolute right-4 top-4 hidden px-4 py-3 min-[1180px]:block"
      aria-label="Controls"
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
