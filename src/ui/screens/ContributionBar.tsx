import { splitContribution, type ContributionParts } from '../contribution';
import { fmt, pct } from '../kit/format';
import { Icon, type IconName } from '../kit/Icon';

/** The two songs' colours on screens, and everything else in the Weaver's grey-gold. */
export const PART_LOOK: Record<
  'auras' | 'thread' | 'other',
  { color: string; icon: IconName; label: string }
> = {
  auras: { color: '#c4b5fd', icon: 'note', label: 'Auras' },
  thread: { color: 'var(--color-gold-300)', icon: 'thread', label: 'Thread' },
  other: { color: 'var(--color-ink-500)', icon: 'ward', label: 'Wards & the rest' },
};

/**
 * Where the Weaver's work came from: auras, the Thread (Mend + Empower), the rest (Wards,
 * Perfect Wards, Chimes, Flourishes). Striped so the parts read without colour too.
 */
export function ContributionBar({
  parts,
  className = '',
}: {
  parts: ContributionParts;
  className?: string;
}) {
  const s = splitContribution(parts);
  if (s.total <= 0) return null;
  const rows = [
    { key: 'auras' as const, value: s.auras, share: s.auraShare },
    { key: 'thread' as const, value: s.thread, share: s.threadShare },
    { key: 'other' as const, value: s.other, share: s.otherShare },
  ];
  return (
    <div className={className} data-testid="contribution-bar">
      <div
        className="flex h-3 overflow-hidden rounded-full border border-ink-600 bg-ink-800"
        role="img"
        aria-label={rows
          .map((r) => `${PART_LOOK[r.key].label} ${pct(r.share)} (${fmt(r.value)})`)
          .join(', ')}
      >
        {rows.map((r) => (
          <div
            key={r.key}
            className={r.key === 'auras' ? 'stripes' : ''}
            style={{ width: `${r.share * 100}%`, backgroundColor: PART_LOOK[r.key].color }}
          />
        ))}
      </div>
      <ul className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs" aria-hidden>
        {rows.map((r) => (
          <li key={r.key} className="flex items-center gap-1.5 text-muted">
            <Icon
              name={PART_LOOK[r.key].icon}
              size={12}
              style={{ color: PART_LOOK[r.key].color }}
            />
            {PART_LOOK[r.key].label}
            <b className="font-mono text-text">{pct(r.share)}</b>
          </li>
        ))}
      </ul>
    </div>
  );
}
