/**
 * Presentation settings applied to the document (docs/plan/04 §9): the colour-vision palette
 * (CSS custom properties) and the UI scale. Everything in the HUD and the menus is sized in
 * rem, so scaling the root font size scales all of it; 1 = 16 px, keeping text ≥ 12 px.
 */
import { applyVisionCss } from '../app/colorVision';
import { useSettings, type Settings } from '../app/settings';

export const BASE_FONT_PX = 16;

export function applyUiScale(scale: number): void {
  if (typeof document === 'undefined') return;
  const s = Math.min(1.5, Math.max(0.8, Number.isFinite(scale) ? scale : 1));
  document.documentElement.style.fontSize = `${BASE_FONT_PX * s}px`;
}

export function applyPresentation(settings: Pick<Settings, 'colorVision' | 'uiScale'>): void {
  applyVisionCss(settings.colorVision);
  applyUiScale(settings.uiScale);
}

/** Applies the saved settings now and whenever they change. Returns the unsubscribe. */
export function installPresentation(): () => void {
  let last = useSettings.getState().settings;
  applyPresentation(last);
  return useSettings.subscribe((state) => {
    const s = state.settings;
    if (s.colorVision !== last.colorVision) applyVisionCss(s.colorVision);
    if (s.uiScale !== last.uiScale) applyUiScale(s.uiScale);
    last = s;
  });
}
