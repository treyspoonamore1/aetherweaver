import { partyHasDome } from '../../content';
import { Icon } from '../kit/Icon';
import { REWIND_NAME } from '../screens/callingText';
import type { AnswerTag } from '../types';
import { ANSWER, bindingLabel } from './labels';

/**
 * An answer to a telegraph: glyph + name (+ key). Never colour alone. `rewind`: a Chronomancer
 * run, where Reel's key Rewinds (going back out of the shape still dodges it). `party` (the
 * fight's hero ids, docs/phase-5b.md): the dome is drawn only when one of them brings it.
 */
export function AnswerGlyph({
  tag,
  showKey = true,
  rewind = false,
  party,
}: {
  tag: AnswerTag;
  showKey?: boolean;
  rewind?: boolean;
  party?: readonly string[];
}) {
  if (tag === 'dome' && party && !partyHasDome(party)) return null;
  const a =
    rewind && tag === 'reel'
      ? { ...ANSWER.reel, icon: 'rewind' as const, label: REWIND_NAME }
      : ANSWER[tag];
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-gold-500/50 bg-gold-400/10 px-1.5 py-0.5 text-xs font-semibold text-gold-200">
      <Icon name={a.icon} size={13} />
      {a.label}
      {showKey && a.action && (
        <span className="font-mono text-xs font-medium text-muted">{bindingLabel(a.action)}</span>
      )}
    </span>
  );
}
