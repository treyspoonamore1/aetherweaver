import type { ReactNode } from 'react';
import { Icon, type IconName } from './Icon';
import { t } from '../text';

/** A small label with an optional glyph, tinted by `color` (border and text). */
export function Chip({
  children,
  color,
  icon,
  className = '',
  title,
}: {
  children: ReactNode;
  color?: string;
  icon?: IconName;
  className?: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium ${className}`}
      style={{
        borderColor: color ? `color-mix(in srgb, ${color} 55%, transparent)` : undefined,
        color: color ?? undefined,
        background: color ? `color-mix(in srgb, ${color} 12%, transparent)` : undefined,
      }}
    >
      {icon && <Icon name={icon} size={12} />}
      {children}
    </span>
  );
}

export const RARITY = {
  common: {
    get label() {
      return t('common.chip.common');
    },
    color: 'var(--color-common)',
    pips: 1,
  },
  rare: {
    get label() {
      return t('common.chip.rare');
    },
    color: 'var(--color-rare)',
    pips: 2,
  },
  epic: {
    get label() {
      return t('common.chip.epic');
    },
    color: 'var(--color-epic)',
    pips: 3,
  },
} as const;

/** Rarity: colour, a label and 1–3 diamonds. */
export function RarityChip({ rarity }: { rarity: keyof typeof RARITY }) {
  const r = RARITY[rarity];
  return (
    <Chip color={r.color}>
      <span className="flex" aria-hidden>
        {Array.from({ length: r.pips }, (_, i) => (
          <Icon key={i} name="diamond" size={10} solid className="-mr-0.5" />
        ))}
      </span>
      {r.label}
    </Chip>
  );
}

export const CATEGORY = {
  silk: {
    get label() {
      return t('common.chip.silk');
    },
    get blurb() {
      return t('common.chip.theThread');
    },
    icon: 'thread',
    color: '#5eead4',
  },
  aegis: {
    get label() {
      return t('common.chip.aegis');
    },
    get blurb() {
      return t('common.chip.techniques');
    },
    icon: 'ward',
    color: '#7dd3fc',
  },
  choir: {
    get label() {
      return t('common.chip.choir');
    },
    get blurb() {
      return t('common.chip.auras');
    },
    icon: 'note',
    color: '#fcd34d',
  },
  bond: {
    get label() {
      return t('common.chip.bond');
    },
    get blurb() {
      return t('common.chip.heroes');
    },
    icon: 'link',
    color: '#f9a8d4',
  },
  finale: {
    get label() {
      return t('common.chip.finale');
    },
    get blurb() {
      return t('common.chip.resonance');
    },
    icon: 'sparkle',
    color: '#c4b5fd',
  },
} as const satisfies Record<
  string,
  { label: string; blurb: string; icon: IconName; color: string }
>;
