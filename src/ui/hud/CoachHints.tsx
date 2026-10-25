import { useEffect, useRef, useState } from 'react';
import { useSettings } from '../../app/settings';
import { Icon } from '../kit/Icon';
import { KeyCap } from '../kit/KeyCap';
import { useUi, type HudSnapshot } from '../store';
import { MAX_SHOWS, bumpHint, evaluateHints, hintCount, splitHint, type Hint } from './hints';

const MIN_SHOW_MS = 2500;
const MAX_SHOW_MS = 9000;
const COOLDOWN_MS = 3500;

/** One contextual hint at a time, shown ≤ 3 times each, respecting settings.hints. */
export function CoachHints({ hud, force }: { hud: HudSnapshot; force?: boolean }) {
  const enabled = useSettings((s) => s.settings.hints);
  const [shown, setShown] = useState<Hint | null>(null);
  const state = useRef({ id: null as string | null, since: 0, lastEnd: -1e9 });

  useEffect(() => {
    const st = state.current;
    const now = performance.now();
    if (!enabled && !force) {
      if (st.id) {
        st.id = null;
        setShown(null);
      }
      return;
    }
    const candidates = evaluateHints(hud);
    if (st.id) {
      const still = candidates.find((c) => c.id === st.id);
      const age = now - st.since;
      if ((!still && age > MIN_SHOW_MS) || age > MAX_SHOW_MS) {
        st.id = null;
        st.lastEnd = now;
        setShown(null);
      } else if (still) {
        setShown((cur) => (cur?.text === still.text ? cur : still));
      }
      return;
    }
    if (now - st.lastEnd < COOLDOWN_MS) return;
    const next = candidates.find((c) => force || hintCount(c.id) < MAX_SHOWS);
    if (next) {
      st.id = next.id;
      st.since = now;
      if (!force) bumpHint(next.id);
      useUi.getState().markHint(next.id);
      setShown(next);
    }
  }, [hud, enabled, force]);

  if (!shown) return null;
  return (
    <div
      className="absolute left-1/2 flex -translate-x-1/2 justify-center"
      style={{ bottom: '15rem' }}
      role="status"
    >
      <p
        key={shown.id}
        className="anim-rise flex max-w-xl items-start gap-2.5 rounded-xl border border-gold-500/60 bg-ink-900/92 px-4 py-2.5 text-sm leading-relaxed shadow-xl shadow-black/60"
      >
        <Icon name="info" size={18} className="mt-0.5 shrink-0 text-gold-300" />
        <span>
          {splitHint(shown.text).map((part, i) =>
            part.key ? (
              <KeyCap key={i} label={part.text} className="mx-0.5 align-baseline" />
            ) : (
              <span key={i}>{part.text}</span>
            ),
          )}
        </span>
      </p>
    </div>
  );
}
