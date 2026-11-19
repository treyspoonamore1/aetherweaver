import { Icon } from '../kit/Icon';
import type { StatTile } from './resultText';

/**
 * The Result's and the Summary's numbers as tiles (the third menu pass): a number and a short
 * label each, a quiet tile at zero. A screen reader hears each tile as one sentence (`sr`), not
 * its pieces.
 */
export function StatTiles({
  tiles,
  className = '',
  big = false,
  testId,
}: {
  tiles: readonly StatTile[];
  className?: string;
  /** The Summary's larger numbers. */
  big?: boolean;
  testId?: string;
}) {
  if (tiles.length === 0) return null;
  return (
    <ul
      className={`grid grid-cols-2 gap-2.5 sm:grid-cols-3 ${big ? 'lg:grid-cols-4' : ''} ${className}`}
      data-testid={testId}
    >
      {tiles.map((t) => (
        <li
          key={t.id}
          className={`rounded-xl border border-ink-600/70 bg-ink-900/60 px-3 py-2.5 ${t.muted ? 'opacity-60' : ''}`}
          style={{ borderTopColor: t.muted ? undefined : t.color, borderTopWidth: 3 }}
          data-tile={t.id}
          data-muted={t.muted || undefined}
        >
          <span className="sr-only">{t.sr}</span>
          <span aria-hidden className="block">
            <span
              className={`block font-display font-bold leading-tight ${big ? 'text-4xl' : 'text-2xl'} ${t.muted ? 'text-muted' : 'text-text'}`}
            >
              {t.value}
            </span>
            <span
              className="mt-0.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider"
              style={{ color: t.muted ? 'var(--color-muted)' : t.color }}
            >
              <Icon name={t.icon} size={13} className="shrink-0" /> {t.label}
            </span>
            {t.detail && (
              <span className="mt-1 block font-mono text-xs leading-snug text-muted">
                {t.detail}
              </span>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}
