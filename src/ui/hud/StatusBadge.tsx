import { Icon } from '../kit/Icon';
import { Ring } from '../kit/Ring';
import type { StatusHud } from '../store';
import { STATUS, statusTitle } from './labels';

/**
 * A status icon inside a countdown ring, with the seconds left beside it. `blind` (Blind Score,
 * Phase 4d): its tooltip doesn't say how to answer it.
 */
export function StatusBadge({ status, blind = false }: { status: StatusHud; blind?: boolean }) {
  const look = STATUS[status.id];
  const timed = status.duration > 0;
  const frac = timed ? status.remaining / status.duration : 1;
  const secs = Math.ceil(status.remaining);
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md bg-ink-950/60 py-0.5 pl-0.5 pr-1.5"
      title={statusTitle(look, blind)}
      role="img"
      aria-label={`${look.label}${timed ? `, ${secs} seconds left` : ''}`}
      style={{ color: look.color }}
      data-status={status.id}
    >
      <Ring value={frac} size={22} stroke={2.5} color={look.color}>
        <Icon name={look.icon} size={12} />
      </Ring>
      <span className="font-mono text-xs leading-none">{timed ? `${secs}s` : look.label}</span>
    </span>
  );
}
