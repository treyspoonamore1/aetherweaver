import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type RefObject,
} from 'react';
import { DEFAULT_HUD, useSettings, type FramesLayout } from '../../app/settings';
import { Button } from '../kit/Button';
import { Icon } from '../kit/Icon';
import { Segmented, Slider } from '../kit/Slider';
import { useUi } from '../store';
import { placeFor, type Box } from './framesLayout';

/** The party frames on the screen (the HUD draws them; Edit Layout finds them by this). */
const FRAMES = '[data-testid="party-frames"]';
/** A nudge with the arrow keys, as a share of the screen (Shift: five times as far). */
const NUDGE = 0.005;

/**
 * Edit Layout (docs/health-ui.md): the party frames can be dragged anywhere, as WoW's healers
 * move their raid frames to where their eyes are, sized, and turned into a row. The fight stays
 * paused under it. Changes show at once and are saved as each drag ends; Reset puts the frames
 * back where they started; Done or Esc closes it.
 */
export function LayoutEditor({ onDone }: { onDone: () => void }) {
  const saved = useSettings((s) => s.settings.hud.frames);
  const update = useSettings((s) => s.update);
  const draft = useUi((s) => s.framesDraft);
  const setDraft = useUi((s) => s.setFramesDraft);
  const layout = draft ?? saved;
  const root = useRef<HTMLDivElement>(null);
  const box = useFramesBox(root);
  const grab = useRef<{ dx: number; dy: number; width: number; height: number } | null>(null);

  const save = (next: FramesLayout) => update((s) => ({ ...s, hud: { ...s.hud, frames: next } }));

  // Esc closes the editor (before the game's own Esc, which would end the pause).
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopImmediatePropagation();
      onDone();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onDone]);

  /** Frames dropped at `next` (screen pixels, relative to the editor): placed and shown. */
  const moveTo = (next: Box): FramesLayout => {
    const r = root.current?.getBoundingClientRect();
    const placed = { ...layout, at: placeFor(next, r?.width ?? 1, r?.height ?? 1) };
    setDraft(placed);
    return placed;
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!box || e.button !== 0) return;
    const r = root.current!.getBoundingClientRect();
    grab.current = {
      dx: e.clientX - r.left - box.left,
      dy: e.clientY - r.top - box.top,
      width: box.width,
      height: box.height,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const g = grab.current;
    if (!g) return;
    const r = root.current!.getBoundingClientRect();
    moveTo({
      left: e.clientX - r.left - g.dx,
      top: e.clientY - r.top - g.dy,
      width: g.width,
      height: g.height,
    });
  };
  const onPointerUp = () => {
    if (!grab.current) return;
    grab.current = null;
    const next = useUi.getState().framesDraft;
    if (next) save(next);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = (e.shiftKey ? 5 : 1) * NUDGE;
    const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[
      e.key
    ];
    if (!d || !box || !root.current) return;
    e.preventDefault();
    const r = root.current.getBoundingClientRect();
    save(
      moveTo({
        ...box,
        left: box.left + d[0]! * step * r.width,
        top: box.top + d[1]! * step * r.height,
      }),
    );
  };

  const set = (patch: Partial<FramesLayout>) => {
    const next = { ...layout, ...patch };
    setDraft(next);
    save(next);
  };

  return (
    <div
      ref={root}
      className="pointer-events-auto absolute inset-0 z-40"
      data-testid="layout-editor"
      role="dialog"
      aria-label="Edit HUD layout"
    >
      {/* Guides: the screen's middle, where frames snap. */}
      <div className="absolute inset-y-0 left-1/2 w-px bg-gold-300/25" aria-hidden />
      <div className="absolute inset-x-0 top-1/2 h-px bg-gold-300/15" aria-hidden />
      {box && (
        <div
          className="absolute cursor-grab touch-none rounded-xl border-2 border-dashed border-gold-300 bg-gold-300/[0.06] outline-none focus-visible:border-solid active:cursor-grabbing"
          style={{
            left: box.left - 6,
            top: box.top - 6,
            width: box.width + 12,
            height: box.height + 12,
          }}
          tabIndex={0}
          role="slider"
          aria-label="Party frames: drag, or use the arrow keys, to move them"
          aria-valuetext={layout.at ? `${Math.round(layout.at.x * 100)}% across` : 'Bottom left'}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onKeyDown={onKeyDown}
          data-testid="frames-handle"
        >
          <span className="pointer-events-none absolute -top-8 left-0 flex items-center gap-1.5 whitespace-nowrap rounded-md border border-gold-500/60 bg-ink-900 px-2 py-1 text-xs font-semibold text-gold-200 shadow-lg shadow-black/50">
            <Icon name="move" size={13} /> Party frames · drag to move
          </span>
        </div>
      )}
      <div className="absolute left-1/2 top-6 w-[26rem] -translate-x-1/2 rounded-2xl border border-gold-500/60 bg-ink-900/96 p-4 shadow-2xl shadow-black/60">
        <h2 className="font-display text-base font-bold tracking-wide text-gold-300">
          Edit HUD layout
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-muted">
          Drag the party frames anywhere: beside the fight, by the Weaver bar, wherever your eyes
          are. Near the middle they snap to it. Arrow keys nudge them.
        </p>
        <div className="mt-3 flex flex-col gap-3">
          <Slider
            label="Size"
            value={layout.scale}
            min={0.75}
            max={1.5}
            step={0.05}
            onChange={(v) => set({ scale: v })}
          />
          <Segmented
            label="Frames"
            value={layout.orientation}
            options={[
              { value: 'vertical', label: 'Stacked' },
              { value: 'horizontal', label: 'Side by side' },
            ]}
            onChange={(v) => set({ orientation: v })}
          />
        </div>
        <div className="mt-4 flex justify-between gap-2">
          <Button size="sm" onClick={() => set(DEFAULT_HUD.frames)} data-testid="layout-reset">
            <Icon name="back" size={14} /> Reset
          </Button>
          <Button
            variant="primary"
            size="sm"
            data-autofocus
            onClick={onDone}
            sound="confirm"
            data-testid="layout-done"
          >
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}

/** The party frames' box relative to `root`, measured every frame while the editor is open. */
function useFramesBox(root: RefObject<HTMLDivElement | null>): Box | null {
  const [box, setBox] = useState<Box | null>(null);
  useEffect(() => {
    let raf = 0;
    const measure = () => {
      const el = document.querySelector(FRAMES);
      const r = root.current?.getBoundingClientRect();
      if (el && r) {
        const b = el.getBoundingClientRect();
        const next = {
          left: b.left - r.left,
          top: b.top - r.top,
          width: b.width,
          height: b.height,
        };
        setBox((cur) =>
          cur &&
          Math.abs(cur.left - next.left) < 0.5 &&
          Math.abs(cur.top - next.top) < 0.5 &&
          Math.abs(cur.width - next.width) < 0.5 &&
          Math.abs(cur.height - next.height) < 0.5
            ? cur
            : next,
        );
      }
      raf = requestAnimationFrame(measure);
    };
    measure();
    return () => cancelAnimationFrame(raf);
  }, [root]);
  return box;
}
