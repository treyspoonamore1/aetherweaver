import { Icon } from '../kit/Icon';
import { Ring } from '../kit/Ring';
import type { StatusHud } from '../store';
import { STATUS, statusTitle } from './labels';
import { stacksUrgent } from './legionLook';

/**
 * A status icon inside a countdown ring, with the seconds left beside it. `blind` (Blind Score,
 * Phase 4d): its tooltip doesn't say how to answer it. A stacking status (Movement II's bleed)
 * shows ×N; from STACKS_EMPHASIS it glows, with the Chime glyph (unless `blind`).
 */
export function StatusBadge({ status, blind = false }: { status: StatusHud; blind?: boolean }) {
  const look = STATUS[status.id];
  const timed = status.duration > 0;
  const frac = timed ? status.remaining / status.duration : 1;
  const secs = Math.ceil(status.remaining);
  const stacks = status.stacks ?? 0;
  const urgent = stacksUrgent(status);
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md bg-ink-950/60 py-0.5 pl-0.5 pr-1.5 ${urgent ? 'animate-pulse-soft' : ''}`}
      title={statusTitle(look, blind)}
      role="img"
      aria-label={`${look.label}${stacks > 1 ? `, ${stacks} stacks` : ''}${timed ? `, ${secs} seconds left` : ''}${urgent && !blind && look.answer ? `. ${look.answer}` : ''}`}
      style={{
        color: look.color,
        boxShadow: urgent ? `0 0 0 1px ${look.color}, 0 0 10px ${look.color}` : undefined,
      }}
      data-status={status.id}
      data-stacks={stacks > 1 ? stacks : undefined}
      data-urgent={urgent || undefined}
    >
      <Ring value={frac} size={22} stroke={2.5} color={look.color}>
        <Icon name={look.icon} size={12} />
      </Ring>
      {stacks > 1 && (
        <span
          className={`font-mono text-xs leading-none ${urgent ? 'font-bold text-white' : 'font-semibold'}`}
          data-testid="status-stacks"
        >
          ×{stacks}
        </span>
      )}
      <span className="font-mono text-xs leading-none">{timed ? `${secs}s` : look.label}</span>
      {urgent && !blind && look.answer?.startsWith('Chime') && (
        <span className="ml-0.5 text-gold-200" title="Chime it away" data-testid="status-chime">
          <Icon name="chime" size={12} />
        </span>
      )}
    </span>
  );
}
