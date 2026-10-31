/**
 * Where the party frames sit, and which way they face (docs/health-ui.md). Players move them
 * anywhere in Edit Layout, as WoW's healers move their raid frames: by the fight, beside the
 * Weaver bar, wherever their eyes are. The frames' corner nearest the screen's edges is pinned
 * (as a share of the screen), so they keep their place at any resolution and grow away from the
 * edge they're pinned to.
 */
import type { CSSProperties } from 'react';
import type { FramesLayout, FramesPlace } from '../../app/settings';

/** Where a frame's speech (barks) and its tooltip open: toward the middle of the screen. */
export type FrameSide = 'right' | 'left' | 'above' | 'below';

/** The frames' default place: bottom left, as they've always been. */
const DEFAULT_PLACE: CSSProperties = { left: '1rem', bottom: '1.25rem' };

const pct = (v: number) => `${(Math.min(1, Math.max(0, v)) * 100).toFixed(3)}%`;

/** The frames' position on the HUD (the pinned corner's offsets). Their size is `scale`. */
export function framesPlaceStyle(at: FramesPlace | null): CSSProperties {
  if (!at) return { ...DEFAULT_PLACE };
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
 * The place for frames dropped at `box` on a screen `screenW` × `screenH`: kept on the screen,
 * snapped to the middle when near it, and pinned by the corner nearest the screen's edges.
 */
export function placeFor(box: Box, screenW: number, screenH: number): FramesPlace {
  const w = Math.min(box.width, screenW);
  const h = Math.min(box.height, screenH);
  const left = Math.min(Math.max(0, box.left), screenW - w);
  const top = Math.min(Math.max(0, box.top), screenH - h);
  // Near the middle, the frames' middle snaps to it and is pinned there (centred at any width).
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

const round = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 10_000) / 10_000;
