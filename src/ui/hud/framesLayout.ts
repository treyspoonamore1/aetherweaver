/**
 * Where the HUD's movable panels sit (docs/health-ui.md): the party frames and the Weaver bar.
 * Players move them anywhere in Edit HUD layout, as WoW's healers move their raid frames: by the
 * fight, wherever their eyes are. A panel's corner nearest the screen's edges is pinned (as a
 * share of the screen), so it keeps its place at any resolution and grows away from the edge
 * it's pinned to.
 */
import type { CSSProperties } from 'react';
import type { FramesLayout, PanelPlace } from '../../app/settings';

/** Where a frame's speech (barks) and its tooltip open: toward the middle of the screen. */
export type FrameSide = 'right' | 'left' | 'above' | 'below';

/** The frames' default place: bottom left, as they've always been. */
const DEFAULT_PLACE: CSSProperties = { left: '1rem', bottom: '1.25rem' };

const pct = (v: number) => `${(Math.min(1, Math.max(0, v)) * 100).toFixed(3)}%`;

/** The frames' position on the HUD (the pinned corner's offsets). Their size is `scale`. */
export function framesPlaceStyle(at: PanelPlace | null): CSSProperties {
  return at ? placeStyle(at) : { ...DEFAULT_PLACE };
}

/**
 * The Weaver bar's position: by default bottom middle (right of the frames' column on a narrow
 * screen, as it always was, wider or narrower with its size), else where it was put.
 */
export function weaverBarPlaceStyle(at: PanelPlace | null, scale = 1): CSSProperties {
  if (at) return placeStyle(at);
  return { left: `max(34rem, calc(50% - ${(22 * scale).toFixed(3)}rem))`, bottom: '1.25rem' };
}

/** Put in the top half of the screen, the bar's crest (the Thread dial and the rest) opens below it. */
export function crestBelow(at: PanelPlace | null): boolean {
  return at?.corner[0] === 't';
}

/** A panel's position from its pinned point. */
function placeStyle(at: PanelPlace): CSSProperties {
  const style: CSSProperties = {};
  if (at.corner[1] === 'l') style.left = pct(at.x);
  else if (at.corner[1] === 'r') style.right = pct(1 - at.x);
  else {
    style.left = pct(at.x);
    style.transform = 'translateX(-50%)';
  }
  if (at.corner[0] === 't') style.top = pct(at.y);
  else style.bottom = pct(1 - at.y);
  return style;
}

/**
 * Where barks and tooltips open: beside a column of frames, on the side away from the edge it's
 * pinned to; above or below a row, away from its edge.
 */
export function frameSide(layout: FramesLayout): FrameSide {
  const corner = layout.at?.corner ?? 'bl';
  if (layout.orientation === 'vertical') return corner[1] === 'r' ? 'left' : 'right';
  return corner[0] === 'b' ? 'above' : 'below';
}

/** A rectangle in screen pixels. */
export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * The place for a panel dropped at `box` on a screen `screenW` × `screenH`: kept on the screen,
 * snapped to the middle when near it, and pinned by the corner nearest the screen's edges.
 */
export function placeFor(box: Box, screenW: number, screenH: number): PanelPlace {
  const w = Math.min(box.width, screenW);
  const h = Math.min(box.height, screenH);
  const left = Math.min(Math.max(0, box.left), screenW - w);
  const top = Math.min(Math.max(0, box.top), screenH - h);
  // Near the middle, the panel's middle snaps to it and is pinned there (centred at any width).
  const mid = left + w / 2;
  const across: 'l' | 'c' | 'r' =
    Math.abs(mid - screenW / 2) < screenW * SNAP ? 'c' : mid > screenW / 2 ? 'r' : 'l';
  const bottom = top + h / 2 > screenH / 2;
  const x = across === 'c' ? 0.5 : (across === 'r' ? left + w : left) / screenW;
  const y = (bottom ? top + h : top) / screenH;
  return { x: round(x), y: round(y), corner: `${bottom ? 'b' : 't'}${across}` };
}

/** Snapping to the middle: within this share of the screen's width. */
export const SNAP = 0.015;

/**
 * The top middle of the screen (rem), where a boss's bar and the wave and decree banners show
 * over the fight (BossBar, Callouts). A panel left there covers them; Edit HUD layout says so,
 * as they aren't on screen while it's open.
 */
export const TOP_BAND_REM = { width: 36, height: 15 };

/** Whether `box` (px) covers the top middle on a screen `screenW` wide, `rem` px to the rem. */
export function coversTopBand(box: Box, screenW: number, rem: number): boolean {
  const width = TOP_BAND_REM.width * rem;
  const left = (screenW - width) / 2;
  return (
    box.top < TOP_BAND_REM.height * rem && box.left < left + width && box.left + box.width > left
  );
}

/** Where Edit HUD layout's toolbar sits: top middle, unless a panel is there. */
export type ToolbarSpot = 'top' | 'bottom' | 'middle';
const SPOTS: readonly ToolbarSpot[] = ['top', 'bottom', 'middle'];
/** The toolbar's distance from the screen's edge (px), and the room it keeps around panels. */
export const TOOLBAR_MARGIN = 24;
const TOOLBAR_CLEARANCE = 12;

/**
 * Edit HUD layout's toolbar keeps clear of the panels: where it is while nothing's under it,
 * else the first of top, bottom and the middle that's clear (where it is, if none is).
 */
export function toolbarSpot(
  current: ToolbarSpot,
  size: { width: number; height: number },
  panels: readonly (Box | null)[],
  screenW: number,
  screenH: number,
): ToolbarSpot {
  const left = (screenW - size.width) / 2;
  const topOf = (spot: ToolbarSpot) =>
    spot === 'top'
      ? TOOLBAR_MARGIN
      : spot === 'bottom'
        ? screenH - TOOLBAR_MARGIN - size.height
        : (screenH - size.height) / 2;
  const clear = (spot: ToolbarSpot) => {
    const top = topOf(spot);
    return panels.every(
      (b) =>
        !b ||
        b.left - TOOLBAR_CLEARANCE >= left + size.width ||
        b.left + b.width + TOOLBAR_CLEARANCE <= left ||
        b.top - TOOLBAR_CLEARANCE >= top + size.height ||
        b.top + b.height + TOOLBAR_CLEARANCE <= top,
    );
  };
  if (clear(current)) return current;
  return SPOTS.find(clear) ?? current;
}

const round = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 10_000) / 10_000;
