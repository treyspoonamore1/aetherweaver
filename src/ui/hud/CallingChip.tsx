import { CallingEmblem, PathPip, callingLook } from '../kit/CallingGlyph';
import { CallingGlyph } from '../kit/CallingGlyph';
import { numeral } from '../screens/callingText';
import { bearLabel, callingHudLabel, type CallingHud } from './calling';

/**
 * The Calling in the fight (Phase 3c, 3d, 3e): its emblem and the path's pips, small, next to
 * the relic bar. The emblem blazes in its Crescendo (Sunrise, the Martyr's Vow, Stasis); Haloed
 * and Sovereign Symphony, the Martyr's Bear, Undying Devotion (ready or spent), Blood Font and
 * Low-Life Vigil (while they're working), and the Chronomancer's revive (once a run: ready or
 * spent) and Temporal Mastery (ready, or back in a few seconds) show as small states.
 */
export function CallingChip({ calling: c }: { calling: CallingHud }) {
  const look = callingLook(c.id);
  const blaze = c.sunrise || c.vow || c.stasis;
  const states =
    c.haloed ||
    c.sovereign ||
    c.bearing ||
    c.undying !== null ||
    c.lowLife.length > 0 ||
    c.mastery !== null ||
    c.revive !== null;
  return (
    <div
      className="flex items-center gap-1.5 rounded-xl border bg-ink-900/80 py-1 pl-1 pr-2 shadow-lg shadow-black/40 backdrop-blur-sm"
      style={{
        borderColor: blaze
          ? look.color
          : `color-mix(in srgb, ${look.color} 40%, var(--color-ink-600))`,
        boxShadow: blaze ? `0 0 18px color-mix(in srgb, ${look.color} 55%, transparent)` : '',
      }}
      role="img"
      aria-label={callingHudLabel(c)}
      data-testid="calling-chip"
      data-sunrise={c.sunrise || undefined}
      data-vow={c.vow || undefined}
      data-stasis={c.stasis || undefined}
    >
      <CallingEmblem
        callingId={c.id}
        icon={c.icon}
        size={28}
        bright={blaze}
        className={blaze ? 'anim-glow' : ''}
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
      {(c.vow || c.stasis) && (
        <span className="font-display text-xs font-bold" style={{ color: look.light }}>
          {c.crescendoName}
        </span>
      )}
      {states && (
        <span className="flex items-center gap-1">
          {c.haloed && <State icon="halo_ring" label="Haloed" color="var(--color-shield)" />}
          {c.sovereign && <State icon="crown" label="Sovereign" color={look.light} />}
          {c.bearing && (
            <State icon="martyr" label={`Bear ${bearLabel(c.bearShare)}`} color={look.light} />
          )}
          {c.undying !== null && (
            <State
              icon="undying"
              label={c.undying === 'ready' ? 'Undying' : 'Undying spent'}
              color={c.undying === 'ready' ? look.light : 'var(--color-muted)'}
              dim={c.undying === 'spent'}
            />
          )}
          {c.lowLife
            .filter((m) => m.active)
            .map((m) => (
              <State key={m.id} icon={m.icon} label={shortName(m.name)} color={look.light} />
            ))}
          {c.revive !== null && (
            // Rewind's revive is once a run: still to come, or spent (struck through).
            <State
              icon="chronomancer"
              label={c.revive === 'ready' ? 'Revive' : 'Revive spent'}
              color={c.revive === 'ready' ? look.light : 'var(--color-muted)'}
              dim={c.revive === 'spent'}
            />
          )}
          {c.mastery && (
            // Temporal Mastery: lit when a Glide would bring a technique back; else when.
            <State
              icon="mastery"
              label={c.mastery.ready ? 'Mastery' : `Mastery ${Math.ceil(c.mastery.remaining)}s`}
              color={c.mastery.ready ? look.light : 'var(--color-muted)'}
            />
          )}
        </span>
      )}
    </div>
  );
}

/** "Low-Life Vigil" → "Vigil" (the chip is small; the aria label has the whole name). */
function shortName(name: string): string {
  return name.replace(/^Low-Life /, '');
}

function State({
  icon,
  label,
  color,
  dim = false,
}: {
  icon: string;
  label: string;
  color: string;
  dim?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-0.5 whitespace-nowrap rounded-md border px-1 text-[11px] font-semibold leading-4 ${dim ? 'line-through opacity-70' : ''}`}
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
