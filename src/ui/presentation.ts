/**
 * Presentation settings applied to the document (docs/plan/04 §9): the colour-vision palette
 * (CSS custom properties), the UI scale and reduced motion. Everything in the HUD and the menus is
 * sized in rem, so scaling the root font size scales all of it; 1 = 16 px, keeping text ≥ 12 px.
 */
import { applyVisionCss } from '../app/colorVision';
import { optionsOf, useSettings, type ReducedMotion, type Settings } from '../app/settings';

export const BASE_FONT_PX = 16;
/** The combat HUD is laid out for a window this wide at scale 1. */
const HUD_WIDTH_PX = 1280;

/**
 * The scale actually used: the player's choice, except that scaling *up* never makes the HUD
 * wider than the window (at 1.25 it needs ~1600 px). Scaling down is always honoured.
 */
export function fittedScale(scale: number, viewportWidth: number): number {
  const s = Math.min(1.5, Math.max(0.8, Number.isFinite(scale) ? scale : 1));
  if (s <= 1 || !(viewportWidth > 0)) return s;
  return Math.max(1, Math.min(s, viewportWidth / HUD_WIDTH_PX));
}

export function applyUiScale(scale: number): void {
  if (typeof document === 'undefined') return;
  const width = typeof window === 'undefined' ? 0 : window.innerWidth;
  document.documentElement.style.fontSize = `${BASE_FONT_PX * fittedScale(scale, width)}px`;
}

/** The operating system's reduced-motion setting. Read once: safe outside the browser. */
export function osPrefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * Whether the UI moves less (docs/phase-7.md, W2): On and Off are the player's; System (absent,
 * the default) follows the operating system, as the UI always has.
 */
export function motionReduced(
  setting: ReducedMotion | undefined,
  os: boolean = osPrefersReducedMotion(),
): boolean {
  return setting === 'on' ? true : setting === 'off' ? false : os;
}

/**
 * Whether the fight holds still (docs/phase-7.md, W2): only Reduced motion On. Before Phase 7
 * nothing in the fight read the operating system's setting, so System (the default) keeps the
 * fight exactly as it was; On stops the camera's shake, the slow-motion vignette, the full-screen
 * pulses, and holds bursts and impact flashes still. Never the aura views (held for the owner).
 */
export function fightStill(settings: Settings): boolean {
  return optionsOf(settings).reducedMotion === 'on';
}

/**
 * The stylesheet's switch (src/index.css): `data-motion="on"` cuts animations as the OS setting
 * does; `"off"` keeps them whatever the OS says; absent (System) leaves the media query to decide.
 */
export function applyMotion(setting: ReducedMotion | undefined): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (setting === 'on' || setting === 'off') root.dataset.motion = setting;
  else delete root.dataset.motion;
}

export function applyPresentation(
  settings: Pick<Settings, 'colorVision' | 'uiScale' | 'reducedMotion'>,
): void {
  applyVisionCss(settings.colorVision);
  applyUiScale(settings.uiScale);
  applyMotion(settings.reducedMotion);
}

/** Applies the saved settings now and whenever they change. Returns the unsubscribe. */
export function installPresentation(): () => void {
  let last = useSettings.getState().settings;
  applyPresentation(last);
  const unsubscribe = useSettings.subscribe((state) => {
    const s = state.settings;
    if (s.colorVision !== last.colorVision) applyVisionCss(s.colorVision);
    if (s.uiScale !== last.uiScale) applyUiScale(s.uiScale);
    if (s.reducedMotion !== last.reducedMotion) applyMotion(s.reducedMotion);
    last = s;
  });
  // The fitted scale depends on the window's width.
  const onResize = () => applyUiScale(last.uiScale);
  if (typeof window !== 'undefined') window.addEventListener('resize', onResize);
  return () => {
    unsubscribe();
    if (typeof window !== 'undefined') window.removeEventListener('resize', onResize);
  };
}
