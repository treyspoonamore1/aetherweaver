import { Panel } from '../kit/Panel';
import { bindingLabel } from './labels';

/** A quiet controls reminder (bottom-right). Shown for the first fights and in training. */
export function KeyHints() {
  const rows: [string, string][] = [
    [
      `${bindingLabel('moveUp')}${bindingLabel('moveLeft')}${bindingLabel('moveDown')}${bindingLabel('moveRight')}`,
      'Move',
    ],
    ['1–4 / click', 'Thread a hero'],
    ['RMB', 'Mend ⇄ Empower'],
    [
      `${bindingLabel('ward')} ${bindingLabel('chime')} ${bindingLabel('reel')} ${bindingLabel('glide')}`,
      'Ward · Chime · Reel · Glide',
    ],
    [`${bindingLabel('cue')} / ⇧1–4`, 'Cue a Solo'],
    [bindingLabel('crescendo'), 'Crescendo'],
    [
      `${bindingLabel('directiveRally')} ${bindingLabel('directiveHold')} ${bindingLabel('directiveScatter')}`,
      'Rally · Hold · Scatter',
    ],
    [bindingLabel('directiveFocus'), 'Focus an enemy'],
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
