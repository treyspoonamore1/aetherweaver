import type { CSSProperties } from 'react';
import type { Action } from '../../input/actions';
import {
  WHEEL_DEAD_ZONE,
  WHEEL_RADIUS,
  WHEEL_SPOKES,
  useWheel,
  type WheelSpoke,
  type WheelView,
} from '../../input/wheel';
import { Icon, type IconName } from '../kit/Icon';
import { KeyCap } from '../kit/KeyCap';
import { bindingCode } from './labels';
import { keyLabel } from '../../input/keyLabel';

const LOOK: Record<WheelSpoke, { icon: IconName; hint: string; action: Action }> = {
  focus: { icon: 'focus', hint: 'The party targets it', action: 'directiveFocus' },
  rally: { icon: 'stack', hint: 'Regroup on you', action: 'directiveRally' },
  hold: { icon: 'lock', hint: 'Stay put', action: 'directiveHold' },
  scatter: { icon: 'scatter', hint: 'Spread 6 m apart', action: 'directiveScatter' },
};

/**
 * The Directive wheel (hold C or the middle mouse button): four spokes around the cursor.
 * Move toward one and release; release in the centre to cancel. Purely presentational; the
 * InputController owns the logic (input/wheel.ts).
 */
export function DirectiveWheelView({
  wheel,
  focusName,
  fixed = true,
}: {
  wheel: WheelView;
  /** Name of the enemy Focus would mark (null: none under the cursor). */
  focusName?: string | null;
  /** Position with viewport coordinates (the game) or relative to the parent (the lab). */
  fixed?: boolean;
}) {
  const len = Math.hypot(wheel.dx, wheel.dy);
  const reach = Math.min(len, WHEEL_RADIUS - 24);
  const angle = (Math.atan2(wheel.dy, wheel.dx) * 180) / Math.PI;
  const size = WHEEL_RADIUS * 2 + 96;
  const style: CSSProperties = {
    position: fixed ? 'fixed' : 'absolute',
    left: wheel.x - size / 2,
    top: wheel.y - size / 2,
    width: size,
    height: size,
  };
  return (
    <div
      className="pointer-events-none z-30"
      style={style}
      role="menu"
      aria-label="Directive wheel"
      data-testid="directive-wheel"
    >
      <div
        className="anim-fade absolute rounded-full border border-gold-500/40 bg-ink-950/55 shadow-2xl shadow-black/60 backdrop-blur-[1px]"
        style={{
          left: 48 - 12,
          top: 48 - 12,
          width: WHEEL_RADIUS * 2 + 24,
          height: WHEEL_RADIUS * 2 + 24,
        }}
      />
      {/* Dead zone: release here to cancel. */}
      <div
        className={`absolute flex items-center justify-center rounded-full border text-center text-xs leading-tight ${
          wheel.spoke ? 'border-ink-500 text-muted' : 'border-gold-300 text-gold-200'
        }`}
        style={{
          left: size / 2 - WHEEL_DEAD_ZONE,
          top: size / 2 - WHEEL_DEAD_ZONE,
          width: WHEEL_DEAD_ZONE * 2,
          height: WHEEL_DEAD_ZONE * 2,
          background: 'rgb(5 8 20 / 0.85)',
        }}
      >
        {wheel.spoke ? '' : 'Cancel'}
      </div>
      {len > 4 && (
        <div
          className="absolute h-0.5 origin-left rounded-full bg-gold-300/80"
          style={{
            left: size / 2,
            top: size / 2 - 1,
            width: reach,
            transform: `rotate(${angle}deg)`,
          }}
          aria-hidden
        />
      )}
      {WHEEL_SPOKES.map((s) => {
        const look = LOOK[s.id];
        const disabled = s.id === 'focus' && wheel.focusTarget === null;
        const on = wheel.spoke === s.id;
        const rad = ((s.angle - 90) * Math.PI) / 180;
        const cx = size / 2 + Math.cos(rad) * WHEEL_RADIUS;
        const cy = size / 2 + Math.sin(rad) * WHEEL_RADIUS;
        const code = bindingCode(look.action);
        return (
          <div
            key={s.id}
            role="menuitem"
            aria-disabled={disabled}
            aria-current={on}
            className={`absolute flex w-32 -translate-x-1/2 -translate-y-1/2 flex-col items-center rounded-xl border px-2 py-1.5 text-center transition-transform duration-75 ${
              on
                ? 'scale-110 border-gold-300 bg-gold-400 text-ink-950 shadow-[0_0_18px_rgb(245_184_61/0.6)]'
                : disabled
                  ? 'border-ink-600 bg-ink-900/90 text-muted opacity-60'
                  : 'border-ink-500 bg-ink-900/92 text-text'
            }`}
            style={{ left: cx, top: cy }}
          >
            <span className="flex items-center gap-1.5 text-sm font-bold">
              <Icon name={look.icon} size={16} />
              {s.label}
              {code && <KeyCap label={keyLabel(code)} accent={on} />}
            </span>
            <span className={`text-xs leading-tight ${on ? 'text-ink-900' : 'text-muted'}`}>
              {s.id === 'focus'
                ? disabled
                  ? 'No enemy targeted'
                  : focusName
                    ? `Mark ${focusName}`
                    : look.hint
                : look.hint}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Connected: draws the wheel while the InputController has it open. */
export function DirectiveWheel({ focusName }: { focusName?: (id: number) => string | null }) {
  const wheel = useWheel((s) => s.wheel);
  if (!wheel) return null;
  return (
    <DirectiveWheelView
      wheel={wheel}
      focusName={wheel.focusTarget === null ? null : (focusName?.(wheel.focusTarget) ?? null)}
    />
  );
}
