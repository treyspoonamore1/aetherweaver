import { Icon } from '../kit/Icon';
import { Tip } from '../kit/Tip';
import { BLIND_LOOK, DISCORD_LOOK } from '../kit/dissonanceLook';
import { blindLine, cueLine, hudDissonanceView } from '../screens/dissonanceModel';
import { RankPips } from '../screens/DissonanceParts';
import type { DissonanceHud } from '../store';

/**
 * The Dissonance in force this fight (Phase 4d), beside the Calling and keystone chips: its glyph
 * and its points, an eye struck through under Blind Score. Pointing at it (or focusing it) lists
 * its levels with their ranks and effects, and what Blind Score and a raised Cue cost mean here.
 * Nothing without Dissonance.
 */
export function DissonanceChip({
  dissonance,
  cueCost,
  open = false,
}: {
  dissonance: DissonanceHud | null;
  /** What a Cue costs this fight (`WeaverHud.cueCost`). */
  cueCost: number;
  /** UI lab: the tooltip shown. */
  open?: boolean;
}) {
  if (!dissonance) return null;
  const v = hudDissonanceView(dissonance.levels, cueCost);
  const raised = v.cueRaised;
  return (
    <Tip
      open={open}
      align="start"
      width="w-[26rem]"
      tip={
        <span className="flex flex-col gap-1.5" data-testid="hud-dissonance-tip">
          <span className="flex items-center justify-between gap-2">
            <b
              className="flex items-center gap-1.5 font-display text-base"
              style={{ color: DISCORD_LOOK.color }}
            >
              <Icon name={DISCORD_LOOK.icon} size={16} /> Dissonance {v.points}
            </b>
            <span className="font-mono text-xs text-muted">
              {v.levels.length} {v.levels.length === 1 ? 'level' : 'levels'}
            </span>
          </span>
          {/* One line each: its name, its ranks and points, then what it does. */}
          <ul className="flex flex-col gap-0.5">
            {v.levels.map((l) => (
              <li key={l.id} className="text-xs leading-snug" data-level={l.id} data-rank={l.rank}>
                <b className="font-semibold text-text">{l.name}</b>{' '}
                {l.ranks > 1 && <RankPips rank={l.rank} ranks={l.ranks} size={9} />}{' '}
                <span className="font-mono" style={{ color: DISCORD_LOOK.color }}>
                  +{l.adds}
                </span>{' '}
                <span className="text-muted">{l.text}</span>
              </li>
            ))}
          </ul>
          {(dissonance.blindScore || raised) && (
            <span className="flex flex-col gap-0.5 border-t border-ink-600/70 pt-1.5 text-xs leading-snug">
              {dissonance.blindScore && (
                <span className="flex items-start gap-1.5" style={{ color: BLIND_LOOK.color }}>
                  <Icon name={BLIND_LOOK.icon} size={13} className="mt-px shrink-0" />
                  {blindLine()}
                </span>
              )}
              {raised && (
                <span className="flex items-start gap-1.5 text-text">
                  <Icon
                    name="note"
                    size={13}
                    className="mt-px shrink-0"
                    style={{ color: DISCORD_LOOK.color }}
                  />
                  {cueLine(cueCost)}
                </span>
              )}
            </span>
          )}
        </span>
      }
    >
      <span
        tabIndex={0}
        className="pointer-events-auto flex items-center gap-1.5 rounded-xl border bg-ink-900/80 px-2.5 py-1.5 shadow-lg shadow-black/40 backdrop-blur-sm"
        style={{ borderColor: `color-mix(in srgb, ${DISCORD_LOOK.color} 55%, transparent)` }}
        role="img"
        aria-label={v.label}
        data-testid="hud-dissonance"
        data-points={v.points}
        data-blind={dissonance.blindScore || undefined}
      >
        <Icon name={DISCORD_LOOK.icon} size={17} style={{ color: DISCORD_LOOK.color }} />
        <span className="font-mono text-sm font-bold" style={{ color: DISCORD_LOOK.color }}>
          {v.points}
        </span>
        {dissonance.blindScore && (
          <Icon name={BLIND_LOOK.icon} size={15} style={{ color: BLIND_LOOK.color }} />
        )}
      </span>
    </Tip>
  );
}
