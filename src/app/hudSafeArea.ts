/**
 * The part of the screen the fight's interface leaves free (docs/phase-8.md, 8c), read from where
 * the HUD's panels really are: at any resolution, any UI scale and wherever the player has put
 * the party frames and the Weaver bar in Edit HUD layout. The boss-fight camera frames the fight
 * inside it (render/framing.ts).
 */
import { OPEN_SAFE_AREA, type SafeArea } from '../render/framing';

/** A rectangle in CSS pixels. */
export interface PanelRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** Where the HUD's standing panels are (null or absent: not on screen). */
export interface HudPanels {
  /** The fight's view (the canvas). */
  view: PanelRect;
  /** The boss bar with everything it holds. */
  bossBar?: PanelRect | null;
  /**
   * Whether the boss bar is showing a cast now. When it is not, room is left for the cast's row
   * all the same (`CAST_ROW_REM`): a boss is never framed where its next cast will cover it.
   */
  bossCasting?: boolean;
  /** The root font size in CSS pixels (the UI scale): what a rem is. 16 when absent. */
  rem?: number;
  /** The Weaver bar's panel, and the Thread dial standing on it. */
  weaverBar?: PanelRect | null;
  dial?: PanelRect | null;
  partyFrames?: PanelRect | null;
  /** The encounter header's column (top left) and the notes' column (top right). */
  topLeft?: PanelRect | null;
  topRight?: PanelRect | null;
}

/** The height of the boss bar's cast row with its margin, in rem (BossBar.tsx). */
export const CAST_ROW_REM = 2.65;
/**
 * Where the boss bar's lower edge is while it shows a cast and nothing more, in rem from the top
 * of the view: what a fight leaves free before its boss, and the bar with it, has arrived.
 */
export const BOSS_BAR_REM = 7.5;

/** Breathing room between a panel and a figure, as a share of the view's height. */
const GAP = 0.012;

const shown = (r: PanelRect | null | undefined): r is PanelRect =>
  !!r && r.right > r.left && r.bottom > r.top;

/**
 * The safe area for these panels. A panel counts as the top or the bottom only if it spans the
 * view's middle column (a bar moved to a side is a corner or nothing); the party frames count as
 * a corner where they have always been, bottom left.
 */
export function safeAreaFrom(panels: HudPanels): SafeArea {
  const { view } = panels;
  const w = view.right - view.left;
  const h = view.bottom - view.top;
  const safe: SafeArea = { ...OPEN_SAFE_AREA };
  if (!(w > 0 && h > 0)) return safe;
  const fx = (x: number) => (x - view.left) / w;
  const fy = (y: number) => (y - view.top) / h;
  const middle = (r: PanelRect) => fx(r.left) < 0.5 && fx(r.right) > 0.5;
  if (shown(panels.bossBar) && middle(panels.bossBar) && fy(panels.bossBar.top) < 0.3) {
    const room = panels.bossCasting === false ? (CAST_ROW_REM * (panels.rem ?? 16)) / h : 0;
    safe.top = Math.max(safe.top, fy(panels.bossBar.bottom) + room + GAP);
  }
  const bar = panels.weaverBar;
  if (shown(bar) && middle(bar)) {
    if (fy(bar.top) > 0.5) {
      safe.bottom = Math.min(safe.bottom, fy(bar.top) - 2 * GAP);
      const dial = panels.dial;
      if (shown(dial) && fy(dial.top) < safe.bottom)
        safe.bottomNotch = {
          x0: fx(dial.left) - GAP,
          x1: fx(dial.right) + GAP,
          y: fy(dial.top) - GAP,
        };
    } else if (fy(bar.bottom) < 0.5) safe.top = Math.max(safe.top, fy(bar.bottom) + 2 * GAP);
  }
  const frames = panels.partyFrames;
  if (shown(frames) && fx(frames.left) < 0.1 && fx(frames.right) < 0.45 && fy(frames.bottom) > 0.7)
    safe.bottomLeft = { x: fx(frames.right) + GAP, y: fy(frames.top) };
  const tl = panels.topLeft;
  if (shown(tl) && fx(tl.right) < 0.45 && fy(tl.top) < 0.2)
    safe.topLeft = { x: fx(tl.right) + GAP, y: fy(tl.bottom) };
  const tr = panels.topRight;
  if (shown(tr) && fx(tr.left) > 0.55 && fy(tr.top) < 0.2)
    safe.topRight = { x: fx(tr.left) - GAP, y: fy(tr.bottom) };
  // Never an inside-out area, however the panels were laid.
  if (safe.bottom - safe.top < 0.3) {
    safe.top = OPEN_SAFE_AREA.top;
    safe.bottom = OPEN_SAFE_AREA.bottom;
    delete safe.bottomNotch;
  }
  return safe;
}

const rectOf = (root: ParentNode, selector: string): PanelRect | null => {
  const el = root.querySelector(selector);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
};

function rootFontSize(): number {
  if (typeof document === 'undefined' || typeof getComputedStyle === 'undefined') return 16;
  return parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
}

/** The safe area's top under a boss bar that has yet to arrive, as a share of a view `height` tall. */
export function bossBarTop(height: number, rem = rootFontSize()): number {
  return height > 0 ? (BOSS_BAR_REM * rem) / height + GAP : OPEN_SAFE_AREA.top;
}

/** Reads the panels' places from the document (a handful of rectangles; a few times a second). */
export function measureHud(root: ParentNode, view: PanelRect): HudPanels {
  return {
    view,
    bossBar: rectOf(root, '[data-testid="boss-bar"]'),
    bossCasting: !!root.querySelector('[data-testid="boss-bar"] [data-testid="boss-cast"]'),
    rem: rootFontSize(),
    weaverBar: rectOf(root, '[data-testid="weaver-bar"]'),
    dial: rectOf(root, '[data-testid="thread-dial"]'),
    partyFrames: rectOf(root, '[data-testid="party-frames"]'),
    topLeft: rectOf(root, '[data-testid="hud-top-left"]'),
    topRight: rectOf(root, '[data-testid="hud-notes"]'),
  };
}
