import { useEffect, useId, useRef, type ReactNode } from 'react';

/**
 * A centred dialog over a dimmed backdrop. Tab stays inside it; the first focusable control
 * (or `[data-autofocus]`) takes focus on open and focus returns to the opener on close.
 */
export function Modal({
  title,
  children,
  onClose,
  width = 'max-w-lg',
  closeOnEscape = false,
}: {
  title: string;
  children: ReactNode;
  onClose?: () => void;
  width?: string;
  /** Pause menus leave Esc to the game runtime; other dialogs close on Esc themselves. */
  closeOnEscape?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const root = ref.current;
    const first =
      root?.querySelector<HTMLElement>('[data-autofocus]') ??
      root?.querySelector<HTMLElement>(
        'button, [href], input, select, [tabindex]:not([tabindex="-1"])',
      );
    first?.focus();
    return () => previous?.focus?.();
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && closeOnEscape && onClose) {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !ref.current) return;
      const items = [
        ...ref.current.querySelectorAll<HTMLElement>(
          'button:not(:disabled), [href], input:not(:disabled), select, [tabindex]:not([tabindex="-1"])',
        ),
      ];
      if (items.length === 0) return;
      const first = items[0]!;
      const last = items[items.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [closeOnEscape, onClose]);
  return (
    <div className="pointer-events-auto absolute inset-0 z-40 flex items-center justify-center bg-ink-950/65 p-4 backdrop-blur-[2px]">
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`anim-rise scroll-thin max-h-full w-full overflow-y-auto rounded-2xl border border-gold-500/50 bg-ink-800/95 p-6 shadow-2xl shadow-black/70 ${width}`}
      >
        <h2 id={titleId} className="font-display text-2xl font-bold tracking-wide text-gold-300">
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
}
