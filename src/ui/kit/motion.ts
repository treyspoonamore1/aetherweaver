import { useState } from 'react';
import { useSettings } from '../../app/settings';
import { motionReduced, osPrefersReducedMotion } from '../presentation';

/**
 * The player asked for less motion: Settings → Reduced motion (docs/phase-7.md, W2), On or Off,
 * or (System, the default) the operating system's setting, as before. Safe outside the browser.
 */
export function prefersReducedMotion(): boolean {
  return motionReduced(useSettings.getState().settings.reducedMotion);
}

/**
 * `prefersReducedMotion()` for a component: the OS setting read when it mounts, the in-game
 * setting live. The global stylesheet already cuts every animation short; this is for what CSS
 * can't undo: staggered delays and timed reveals.
 */
export function useReducedMotion(): boolean {
  const [os] = useState(osPrefersReducedMotion);
  const setting = useSettings((s) => s.settings.reducedMotion);
  return motionReduced(setting, os);
}
