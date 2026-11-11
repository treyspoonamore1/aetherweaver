import { CallingEmblem, PathPip, callingLook } from '../kit/CallingGlyph';
import { CallingGlyph } from '../kit/CallingGlyph';
import { numeral } from '../screens/callingText';
import { bearLabel, callingHudLabel, type CallingHud } from './calling';
import { conductingChipSentence, marcatoChipLabel, pctLabel } from './conducting';
import type { ConductingHud } from '../store';
import { t as txt } from '../text';

/**
 * The Calling in the fight (Phase 3c, 3d, 3e, 5f): its emblem and the path's pips, small, next to
 * the relic bar. The emblem blazes in its Crescendo (Sunrise, the Martyr's Vow, Stasis, the Grand
 * Finale); the Conductor's Marcato, Ensemble and Triad show as small states too; Haloed
 * and Sovereign Symphony, the Martyr's Bear, Undying Devotion (ready or spent), Blood Font and
 * Low-Life Vigil (while they're working), and the Chronomancer's revive (once a run: ready or
 * spent) and Temporal Mastery (ready, or back in a few seconds) show as small states. Phase 4g:
 * the tiers past the run's `tiersOpen` are locked by mastery.
 */
export function CallingChip({
  calling: c,
  tiersOpen,
  conducting,
}: {
  calling: CallingHud;
  /** The path tiers the run offers (the rest locked by mastery); omitted: every tier. */
  tiersOpen?: number;
  /** Phase 5f: the Conductor's fight (Marcato, Ensemble, Triad, the Grand Finale). */
  conducting?: ConductingHud;
}) {
  const look = callingLook(c.id);
  const finale = !!conducting?.finale;
  const blaze = c.sunrise || c.vow || c.stasis || finale;
  const conduct =
    !!conducting && (!!conducting.marcato || !!conducting.ensemble || !!conducting.triad);
  const shut = tiersOpen === undefined ? 0 : c.tiers.filter((t, i) => !t && i >= tiersOpen).length;
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
      aria-label={`${callingHudLabel(c)}${conducting ? ` ${conductingChipSentence(conducting, c.crescendoName)}` : ''}${shut > 0 ? txt('hud.callingChip.ofItsTiersLocked', { shut }) : ''}`}
      data-testid="calling-chip"
      data-sunrise={c.sunrise || undefined}
      data-vow={c.vow || undefined}
      data-stasis={c.stasis || undefined}
      data-finale={finale || undefined}
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
            state={t ? 'chosen' : tiersOpen !== undefined && i >= tiersOpen ? 'locked' : 'open'}
            icon={t?.icon}
            numeral={numeral(i)}
            size={18}
          />
        ))}
      </span>
      {c.sunrise && (
        <span className="font-display text-xs font-bold" style={{ color: look.light }}>
          {txt('hud.callingChip.sunrise', { sunriseMult: c.sunriseMult })}
        </span>
      )}
      {(c.vow || c.stasis || finale) && (
        <span className="font-display text-xs font-bold" style={{ color: look.light }}>
          {c.crescendoName}
        </span>
      )}
      {conduct && conducting && (
        // The Conductor (docs/phase-5f.md): Marcato ready or coming back, Ensemble's streak and
        // bonus, Triad holding the meter. Each with its glyph, in his ivory.
        <span className="flex items-center gap-1" data-testid="conduct-states">
          {conducting.marcato && (
            <State
              icon="marcato"
              label={marcatoChipLabel(conducting.marcato)}
              color={conducting.marcato.ready ? look.light : 'var(--color-muted)'}
            />
          )}
          {conducting.ensemble && (
            <span
              className="inline-flex items-center gap-0.5 whitespace-nowrap rounded-md border px-1 text-[0.75rem] font-semibold leading-4"
              style={{
                color: look.light,
                borderColor: `color-mix(in srgb, ${look.light} 50%, transparent)`,
              }}
              data-testid="ensemble-state"
              data-heroes={conducting.ensemble.heroes}
            >
              <CallingGlyph icon="ensemble" size={12} />
              {Array.from({ length: conducting.ensemble.most }, (_, i) => (
                <span
                  key={i}
                  className="h-1.5 w-1.5 rounded-full border"
                  style={{
                    borderColor: look.light,
                    background:
                      i < Math.min(conducting.ensemble!.heroes, conducting.ensemble!.most)
                        ? look.light
                        : 'transparent',
                  }}
                />
              ))}
              {conducting.ensemble.bonus > 0 && <span>{pctLabel(conducting.ensemble.bonus)}</span>}
            </span>
          )}
          {conducting.triad && (
            <State
              icon="triad"
              label={
                conducting.triad.holding
                  ? txt('hud.callingChip.triadHolding')
                  : txt('hud.callingChip.triad')
              }
              color={conducting.triad.holding ? look.light : 'var(--color-muted)'}
            />
          )}
        </span>
      )}
      {states && (
        <span className="flex items-center gap-1">
          {c.haloed && (
            <State
              icon="halo_ring"
              label={txt('hud.callingChip.haloed')}
              color="var(--color-shield)"
            />
          )}
          {c.sovereign && (
            <State icon="crown" label={txt('hud.callingChip.sovereign')} color={look.light} />
          )}
          {c.bearing && (
            <State
              icon="martyr"
              label={txt('hud.callingChip.bear', { bearLabel: bearLabel(c.bearShare) })}
              color={look.light}
            />
          )}
          {c.undying !== null && (
            <State
              icon="undying"
              label={
                c.undying === 'ready'
                  ? txt('hud.callingChip.undying')
                  : txt('hud.callingChip.undyingSpent')
              }
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
              label={
                c.revive === 'ready'
                  ? txt('hud.callingChip.revive')
                  : txt('hud.callingChip.reviveSpent')
              }
              color={c.revive === 'ready' ? look.light : 'var(--color-muted)'}
              dim={c.revive === 'spent'}
            />
          )}
          {c.mastery && (
            // Temporal Mastery: lit when a Glide would bring a technique back; else when.
            <State
              icon="mastery"
              label={
                c.mastery.ready
                  ? txt('hud.callingChip.mastery')
                  : txt('hud.callingChip.masteryS', { remaining: Math.ceil(c.mastery.remaining) })
              }
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
      className={`inline-flex items-center gap-0.5 whitespace-nowrap rounded-md border px-1 text-[0.75rem] font-semibold leading-4 ${dim ? 'line-through opacity-70' : ''}`}
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
