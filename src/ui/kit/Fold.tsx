import { useId, useState, type CSSProperties, type ReactNode } from 'react';
import { Icon } from './Icon';

/**
 * A group that folds (the second menu text pass, round 11): its heading is a button that shows or
 * hides what is under it, so a long page shows a list of headings and one open group. The button
 * is an ordinary one: Tab, Enter and Space, the pad's d-pad and bottom button all reach it, and it
 * says `aria-expanded`. What is folded stays in the page (`hidden`), so a screen reader and the
 * browser's own find skip it until it is opened, and nothing is built twice.
 */
export function Fold({
  heading,
  count,
  open: initial = false,
  force = false,
  small = false,
  label,
  children,
  className = '',
  headingClass = '',
  style,
  testId,
}: {
  /** The heading's own content (a glyph, a name, a few words). */
  heading: ReactNode;
  /** How many things are under it, shown beside the heading (a number says it in any language). */
  count?: number;
  /** Open at first. */
  open?: boolean;
  /** Held open (a filter is on: every group shows its matches). */
  force?: boolean;
  /** A fold inside a card: a line of body text for a heading (the page's own folds are larger). */
  small?: boolean;
  /** The section's name for a screen reader, when the heading is not plain words. */
  label?: string;
  children: ReactNode;
  className?: string;
  headingClass?: string;
  style?: CSSProperties;
  testId?: string;
}) {
  const [chosen, setChosen] = useState(initial);
  const open = force || chosen;
  const id = useId();
  const Heading = small ? 'h3' : 'h2';
  return (
    <section aria-label={label} className={className} data-testid={testId} data-open={open}>
      <Heading className="m-0">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setChosen(!open)}
          className={`flex w-full items-center gap-2 rounded-lg border border-ink-600/60 bg-ink-900/60 text-left transition-colors hover:bg-ink-800/80 ${small ? 'px-2.5 py-1.5 text-sm font-semibold' : 'px-3 py-2 font-display text-lg font-bold'} ${headingClass}`}
          style={style}
          data-fold
        >
          <span className="flex min-w-0 flex-1 flex-wrap items-center gap-2">{heading}</span>
          {count !== undefined && (
            <span className="font-mono text-xs font-normal text-muted">{count}</span>
          )}
          <Icon
            name="arrow"
            size={14}
            className={`shrink-0 text-muted transition-transform ${open ? '-rotate-90' : 'rotate-90'}`}
          />
        </button>
      </Heading>
      <div id={id} hidden={!open} className={small ? 'mt-2' : 'mt-3'}>
        {children}
      </div>
    </section>
  );
}
