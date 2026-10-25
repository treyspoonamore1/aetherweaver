import { CallingEmblem, PathPip, callingLook } from '../kit/CallingGlyph';
import { CallingGlyph } from '../kit/CallingGlyph';
import { numeral } from '../screens/callingText';
import { callingHudLabel, type CallingHud } from './calling';

/**
 * The Calling in the fight (Phase 3c): its emblem and the path's pips, small, next to the
 * relic bar. The emblem blazes in Sunrise; Haloed and Sovereign Symphony show as lit states.
 */
export function CallingChip({ calling: c }: { calling: CallingHud }) {
  const look = callingLook(c.id);
  return (
    <div
      className="flex items-center gap-1.5 rounded-xl border bg-ink-900/80 py-1 pl-1 pr-2 shadow-lg shadow-black/40 backdrop-blur-sm"
      style={{
        borderColor: c.sunrise
          ? look.color
          : `color-mix(in srgb, ${look.color} 40%, var(--color-ink-600))`,
        boxShadow: c.sunrise ? `0 0 18px color-mix(in srgb, ${look.color} 55%, transparent)` : '',
      }}
      role="img"
      aria-label={callingHudLabel(c)}
      data-testid="calling-chip"
      data-sunrise={c.sunrise || undefined}
    >
      <CallingEmblem
        callingId={c.id}
        icon={c.icon}
        size={28}
        bright={c.sunrise}
        className={c.sunrise ? 'anim-glow' : ''}
      />
      <span className="flex items-center gap-0.5">
        {c.tiers.map((t, i) => (
          <PathPip
            key={i}
            callingId={c.id}
            state={t ? 'chosen' : 'open'}
            icon={t?.icon}
            numeral={numeral(i)}
            size={18}
          />
        ))}
      </span>
      {c.sunrise && (
        <span className="font-display text-xs font-bold" style={{ color: look.light }}>
          Sunrise ×{c.sunriseMult}
        </span>
      )}
      {(c.haloed || c.sovereign) && (
        <span className="flex items-center gap-1">
          {c.haloed && <State icon="halo_ring" label="Haloed" color="var(--color-shield)" />}
          {c.sovereign && <State icon="crown" label="Sovereign" color={look.light} />}
        </span>
      )}
    </div>
  );
}

function State({ icon, label, color }: { icon: string; label: string; color: string }) {
  return (
    <span
      className="inline-flex items-center gap-0.5 rounded-md border px-1 text-[11px] font-semibold leading-4"
      style={{
        color,
        borderColor: `color-mix(in srgb, ${color} 50%, transparent)`,
        background: `color-mix(in srgb, ${color} 10%, transparent)`,
      }}
    >
      <CallingGlyph icon={icon} size={12} />
      {label}
    </span>
  );
}
