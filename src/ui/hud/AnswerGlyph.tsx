import { Icon } from '../kit/Icon';
import type { AnswerTag } from '../types';
import { ANSWER, bindingLabel } from './labels';

/** An answer to a telegraph: glyph + name (+ key). Never colour alone. */
export function AnswerGlyph({ tag, showKey = true }: { tag: AnswerTag; showKey?: boolean }) {
  const a = ANSWER[tag];
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
