import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type RefObject,
} from 'react';
import {
  DEFAULT_HUD,
  DEFAULT_WEAVER_BAR,
  useSettings,
  type FramesLayout,
  type PanelPlace,
  type WeaverBarLayout,
} from '../../app/settings';
import { Button } from '../kit/Button';
import { Icon } from '../kit/Icon';
import { Segmented, Slider } from '../kit/Slider';
import { useUi } from '../store';
import { coversTopBand, placeFor, toolbarSpot, type Box, type ToolbarSpot } from './framesLayout';

/** The panels Edit HUD layout moves. */
export type PanelId = 'frames' | 'weaverBar';

/**
 * Each panel: its name, the element the HUD draws it as (measured every frame), its handle's
 * test id, where it sits by default, and how far it sizes.
 */
const PANELS: Record<
  PanelId,
  {
    name: string;
    /** In a sentence. */
    called: string;
    selector: string;
    handle: string;
    home: string;
    scale: [number, number];
  }
> = {
  frames: {
    name: 'Party frames',
    called: 'the party frames',
    selector: '[data-testid="party-frames"]',
    handle: 'frames-handle',
    home: 'Bottom left',
    scale: [0.75, 1.5],
  },
  weaverBar: {
    name: 'Weaver bar',
    called: 'the Weaver bar',
    selector: '[data-testid="weaver-bar-anchor"]',
    handle: 'weaver-bar-handle',
    home: 'Bottom middle',
    scale: [0.75, 1.25],
  },
};
/** Handles are drawn in this order: the bar's under the frames', as the panels are. */
const ORDER: readonly PanelId[] = ['weaverBar', 'frames'];
const CHOICES = (['frames', 'weaverBar'] as const).map((id) => ({
  value: id,
  label: PANELS[id].name,
}));
/** A nudge with the arrow keys, as a share of the screen (Shift: five times as far). */
const NUDGE = 0.005;

/** The panels' boxes and the editor's size (px). */
type Boxes = Record<PanelId, Box | null> & { width: number; height: number; rem: number };

/**
 * Edit HUD layout (docs/health-ui.md): the party frames and the Weaver bar can be dragged
 * anywhere, as WoW's healers move their raid frames to where their eyes are, and sized; the
 * frames also turn into a row. The fight stays paused under it. Click or drag a panel to choose
 * it; the toolbar sizes it or puts it back. Changes show at once and are saved as each drag ends;
 * Done or Esc closes it.
 */
export function LayoutEditor({
  onDone,
  initial = 'frames',
}: {
  onDone: () => void;
  /** The panel chosen when it opens (the UI lab). */
  initial?: PanelId;
}) {
  const savedFrames = useSettings((s) => s.settings.hud.frames);
  const savedBar = useSettings((s) => s.settings.hud.weaverBar);
  const update = useSettings((s) => s.update);
  const framesDraft = useUi((s) => s.framesDraft);
  const barDraft = useUi((s) => s.weaverBarDraft);
  const frames = framesDraft ?? savedFrames;
  const bar = barDraft ?? savedBar;
  const [selected, setSelected] = useState<PanelId>(initial);
  const root = useRef<HTMLDivElement>(null);
  const toolbar = useRef<HTMLDivElement>(null);
  // The toolbar stays put while it's being used (a size can grow a panel under it).
  const busy = useRef(false);
  const { boxes, spot } = useEditorLayout(root, toolbar, busy);
  const grab = useRef<{
    id: PanelId;
    dx: number;
    dy: number;
    width: number;
    height: number;
  } | null>(null);

  /** A panel's layout changed: shown at once, and saved when `keep` (a drag saves as it ends). */
  const change = (
    id: PanelId,
    patch: { at?: PanelPlace | null; scale?: number; orientation?: FramesLayout['orientation'] },
    keep: boolean,
  ) => {
    const ui = useUi.getState();
    const hud = useSettings.getState().settings.hud;
    if (id === 'frames') {
      const next: FramesLayout = { ...(ui.framesDraft ?? hud.frames), ...patch };
      ui.setFramesDraft(next);
      if (keep) update((s) => ({ ...s, hud: { ...s.hud, frames: next } }));
    } else {
      const cur = ui.weaverBarDraft ?? hud.weaverBar;
      const next: WeaverBarLayout = {
        at: patch.at !== undefined ? patch.at : cur.at,
        scale: patch.scale ?? cur.scale,
      };
      ui.setWeaverBarDraft(next);
      if (keep) update((s) => ({ ...s, hud: { ...s.hud, weaverBar: next } }));
    }
  };

  // Esc closes the editor (before the game's own Esc, which would end the pause).
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopImmediatePropagation();
      onDone();
    };
    const idle = () => void (busy.current = false);
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('pointerup', idle);
    window.addEventListener('pointercancel', idle);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('pointerup', idle);
      window.removeEventListener('pointercancel', idle);
    };
  }, [onDone]);

  /** A panel dropped at `next` (screen pixels, relative to the editor): placed and shown. */
  const moveTo = (id: PanelId, next: Box, keep: boolean) => {
    const r = root.current?.getBoundingClientRect();
    change(id, { at: placeFor(next, r?.width ?? 1, r?.height ?? 1) }, keep);
  };

  /** A panel's box now (relative to the editor), from the page: the last frame's may be stale. */
  const boxNow = (id: PanelId): Box | null => {
    const r = root.current?.getBoundingClientRect();
    return r ? boxOf(PANELS[id].selector, r) : null;
  };

  const onPointerDown = (id: PanelId) => (e: PointerEvent<HTMLDivElement>) => {
    const box = boxNow(id);
    setSelected(id);
    if (!box || e.button !== 0) return;
    const r = root.current!.getBoundingClientRect();
    grab.current = {
      id,
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
    moveTo(
      g.id,
      {
        left: e.clientX - r.left - g.dx,
        top: e.clientY - r.top - g.dy,
        width: g.width,
        height: g.height,
      },
      false,
    );
  };
  const onPointerUp = () => {
    const g = grab.current;
    if (!g) return;
    grab.current = null;
    change(g.id, {}, true);
  };
  const onKeyDown = (id: PanelId) => (e: KeyboardEvent<HTMLDivElement>) => {
    const step = (e.shiftKey ? 5 : 1) * NUDGE;
    const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[
      e.key
    ];
    const box = boxNow(id);
    if (!d || !box || !root.current) return;
    e.preventDefault();
    const r = root.current.getBoundingClientRect();
    moveTo(
      id,
      { ...box, left: box.left + d[0]! * step * r.width, top: box.top + d[1]! * step * r.height },
      true,
    );
  };

  const layouts = { frames, weaverBar: bar };
  const chosen = PANELS[selected];
  const chosenBox = boxes[selected];
  const overTop = chosenBox !== null && coversTopBand(chosenBox, boxes.width, boxes.rem);
  const reset = () =>
    selected === 'frames'
      ? change('frames', DEFAULT_HUD.frames, true)
      : change('weaverBar', DEFAULT_WEAVER_BAR, true);

  return (
    <div
      ref={root}
      className="pointer-events-auto absolute inset-0 z-40"
      data-testid="layout-editor"
      role="dialog"
      aria-label="Edit HUD layout"
    >
      {/* Guides: the screen's middle, where panels snap. */}
      <div className="absolute inset-y-0 left-1/2 w-px bg-gold-300/25" aria-hidden />
      <div className="absolute inset-x-0 top-1/2 h-px bg-gold-300/15" aria-hidden />
      {ORDER.map((id) => {
        const box = boxes[id];
        if (!box) return null;
        const p = PANELS[id];
        const on = id === selected;
        const at = layouts[id].at;
        // The label sits over the panel, under it at the screen's top, and on its right side in
        // the right half of the screen (so it stays on screen).
        const labelPlace = `${box.top < 40 ? 'top-full mt-2' : '-top-8'} ${
          box.left + box.width / 2 > boxes.width / 2 ? 'right-0' : 'left-0'
        }`;
        return (
          <div
            key={id}
            className={`absolute cursor-grab touch-none rounded-xl border-2 outline-none active:cursor-grabbing ${
              on
                ? 'border-solid border-gold-300 bg-gold-300/[0.08]'
                : 'border-dashed border-gold-300/60 bg-gold-300/[0.03] hover:border-gold-300 focus-visible:border-gold-300'
            }`}
            style={{
              left: box.left - 6,
              top: box.top - 6,
              width: box.width + 12,
              height: box.height + 12,
            }}
            tabIndex={0}
            role="slider"
            aria-label={`Move ${p.called}: drag, or use the arrow keys`}
            aria-valuetext={placeText(at, p.home)}
            onFocus={() => setSelected(id)}
            onPointerDown={onPointerDown(id)}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onKeyDown={onKeyDown(id)}
            data-testid={p.handle}
            data-selected={on || undefined}
          >
            <span
              className={`pointer-events-none absolute ${labelPlace} flex items-center gap-1.5 whitespace-nowrap rounded-md border bg-ink-900 px-2 py-1 text-xs font-semibold shadow-lg shadow-black/50 ${
                on ? 'border-gold-400 text-gold-200' : 'border-gold-500/40 text-gold-200/75'
              }`}
            >
              <Icon name="move" size={13} /> {p.name}
              {on && <span className="font-normal text-gold-200/75"> · drag to move</span>}
            </span>
          </div>
        );
      })}
      <div
        ref={toolbar}
        className={`absolute left-1/2 w-[26rem] max-w-[calc(100%-2rem)] -translate-x-1/2 rounded-2xl border border-gold-500/60 bg-ink-900/96 p-4 shadow-2xl shadow-black/60 ${SPOT_CLASS[spot]}`}
        onPointerDownCapture={() => void (busy.current = true)}
        data-testid="layout-toolbar"
        data-spot={spot}
      >
        <h2 className="font-display text-base font-bold tracking-wide text-gold-300">
          Edit HUD layout
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-muted">
          Drag the party frames or the Weaver bar anywhere: by the fight, wherever your eyes are.
          Near the middle they snap to it. Arrow keys nudge the one chosen.
        </p>
        <div className="mt-3 flex flex-col gap-3">
          <Segmented label="Panel" value={selected} options={CHOICES} onChange={setSelected} />
          <Slider
            label="Size"
            value={layouts[selected].scale}
            min={chosen.scale[0]}
            max={chosen.scale[1]}
            step={0.05}
            onChange={(v) => change(selected, { scale: v }, true)}
          />
          {selected === 'frames' && (
            <Segmented
              label="Frames"
              value={frames.orientation}
              options={[
                { value: 'vertical', label: 'Stacked' },
                { value: 'horizontal', label: 'Side by side' },
              ]}
              onChange={(v) => change('frames', { orientation: v }, true)}
            />
          )}
        </div>
        {overTop && (
          <p
            className="mt-3 flex items-start gap-1.5 text-xs leading-relaxed text-gold-200"
            role="note"
            data-testid="layout-over-top"
          >
            <Icon name="info" size={14} className="mt-0.5 shrink-0" />
            The top middle is where a boss&rsquo;s bar and the wave banners show: here,{' '}
            {chosen.called} would cover them.
          </p>
        )}
        <div className="mt-4 flex justify-between gap-2">
          <Button size="sm" onClick={reset} data-testid="layout-reset">
            <Icon name="back" size={14} /> Reset {selected === 'frames' ? 'frames' : 'bar'}
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

const SPOT_CLASS: Record<ToolbarSpot, string> = {
  top: 'top-6',
  bottom: 'bottom-6',
  middle: 'top-1/2 -translate-y-1/2',
};

/** Where a panel is, said for a screen reader. */
function placeText(at: PanelPlace | null, home: string): string {
  if (!at) return home;
  return `${Math.round(at.x * 100)}% across, ${Math.round(at.y * 100)}% down`;
}

/**
 * The panels' boxes relative to `root`, measured every frame while the editor is open, and where
 * the toolbar keeps clear of them (not while it's in use).
 */
function useEditorLayout(
  root: RefObject<HTMLDivElement | null>,
  toolbar: RefObject<HTMLDivElement | null>,
  busy: RefObject<boolean>,
): { boxes: Boxes; spot: ToolbarSpot } {
  const [boxes, setBoxes] = useState<Boxes>({
    frames: null,
    weaverBar: null,
    width: 0,
    height: 0,
    rem: 16,
  });
  const [spot, setSpot] = useState<ToolbarSpot>('top');
  useEffect(() => {
    let raf = 0;
    let now: ToolbarSpot = 'top';
    const measure = () => {
      const r = root.current?.getBoundingClientRect();
      if (r) {
        const next: Boxes = {
          frames: boxOf(PANELS.frames.selector, r),
          weaverBar: boxOf(PANELS.weaverBar.selector, r),
          width: r.width,
          height: r.height,
          // The UI scale sets the root font size, and the HUD's fixed parts are sized in rem.
          rem: parseFloat(getComputedStyle(document.documentElement).fontSize) || 16,
        };
        setBoxes((cur) =>
          sameBox(cur.frames, next.frames) &&
          sameBox(cur.weaverBar, next.weaverBar) &&
          Math.abs(cur.width - next.width) < 0.5 &&
          Math.abs(cur.height - next.height) < 0.5 &&
          cur.rem === next.rem
            ? cur
            : next,
        );
        const t = toolbar.current?.getBoundingClientRect();
        if (t && !busy.current) {
          const s = toolbarSpot(now, t, [next.frames, next.weaverBar], r.width, r.height);
          if (s !== now) {
            now = s;
            setSpot(s);
          }
        }
      }
      raf = requestAnimationFrame(measure);
    };
    measure();
    return () => cancelAnimationFrame(raf);
  }, [root, toolbar, busy]);
  return { boxes, spot };
}

function boxOf(selector: string, root: DOMRect): Box | null {
  const el = document.querySelector(selector);
  if (!el) return null;
  const b = el.getBoundingClientRect();
  return { left: b.left - root.left, top: b.top - root.top, width: b.width, height: b.height };
}

function sameBox(a: Box | null, b: Box | null): boolean {
  if (!a || !b) return a === b;
  return (
    Math.abs(a.left - b.left) < 0.5 &&
    Math.abs(a.top - b.top) < 0.5 &&
    Math.abs(a.width - b.width) < 0.5 &&
    Math.abs(a.height - b.height) < 0.5
  );
}
