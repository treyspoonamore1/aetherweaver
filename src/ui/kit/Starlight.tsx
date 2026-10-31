import { fmt } from './format';
import { Icon } from './Icon';
import { STARLIGHT_LOOK } from './loomLook';

const tint = (pct: number) => `color-mix(in srgb, ${STARLIGHT_LOOK.color} ${pct}%, transparent)`;

/**
 * Starlight, as an amount (Phase 4g): its twin sparkle, the number and the word, in its own
 * silver-periwinkle. The hub's and the Atelier's balance; `size="lg"` for the Atelier's header.
 */
export function StarlightChip({
  amount,
  size = 'md',
  className = '',
  testId,
}: {
  amount: number;
  size?: 'md' | 'lg';
  className?: string;
  testId?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border font-mono font-semibold ${size === 'lg' ? 'px-3 py-1.5 text-base' : 'px-2.5 py-1 text-sm'} ${className}`}
      style={{ color: STARLIGHT_LOOK.color, borderColor: tint(45), background: tint(10) }}
      aria-label={`${fmt(amount)} Starlight`}
      data-testid={testId}
      data-amount={amount}
    >
      <Icon name="starlight" size={size === 'lg' ? 18 : 16} solid aria-hidden />
      <span aria-hidden>{fmt(amount)}</span>
      <span className="font-sans text-xs font-medium text-muted" aria-hidden>
        Starlight
      </span>
    </span>
  );
}

/**
 * A price in Starlight: the sparkle and the number ("✦ 70"), in Starlight's colour; `muted` when
 * it's out of reach, `inherit` on a filled (gold) button.
 */
export function StarlightPrice({
  price,
  tone = 'starlight',
}: {
  price: number;
  tone?: 'starlight' | 'muted' | 'inherit';
}) {
  return (
    <span
      className="inline-flex items-center gap-1 font-mono text-sm font-semibold"
      style={{
        color:
          tone === 'muted'
            ? 'var(--color-muted)'
            : tone === 'inherit'
              ? 'inherit'
              : STARLIGHT_LOOK.color,
      }}
    >
      <Icon name="starlight" size={14} solid aria-hidden />
      {fmt(price)}
    </span>
  );
}

/** Starlight's twin sparkle in a lit disc: the Atelier on its Rank's rank-up card. */
export function StarlightDisc({ size = 40 }: { size?: number }) {
  return (
    <span
      className="mt-0.5 flex shrink-0 items-center justify-center rounded-full border-2"
      style={{
        width: size,
        height: size,
        color: STARLIGHT_LOOK.light,
        borderColor: STARLIGHT_LOOK.color,
        background: `radial-gradient(circle at 50% 45%, ${tint(40)}, rgb(10 16 34 / 0.95) 75%)`,
        boxShadow: `0 0 16px ${tint(40)}`,
      }}
      aria-hidden
      data-testid="unlock-disc-atelier"
    >
      <Icon name="starlight" size={Math.round(size * 0.55)} />
    </span>
  );
}
