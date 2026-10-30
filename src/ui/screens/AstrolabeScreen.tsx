import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { useProfile } from '../../app/profileStore';
import { useSettings } from '../../app/settings';
import { storage } from '../../app/storage';
import { astrolabeNode, astrolabeText, type AstrolabeNode } from '../../content';
import { ASTROLABE_START } from '../../meta/astrolabe';
import { rankOf } from '../../meta/profile';
import { loadRun } from '../../meta/save';
import { AstrolabeGlyph, KeystoneBadge } from '../kit/AstrolabeGlyph';
import { CONSTELLATION_LOOK, STARLIGHT, constellationLook } from '../kit/astrolabeLook';
import { Backdrop } from '../kit/Backdrop';
import { Button } from '../kit/Button';
import { Icon } from '../kit/Icon';
import { KeyCap } from '../kit/KeyCap';
import { Modal } from '../kit/Modal';
import { Panel } from '../kit/Panel';
import { playUi, useMood } from '../kit/sound';
import { useUi } from '../store';
import { AstrolabeMap } from './AstrolabeMap';
import { CodexView, useCodexBonds, useCodexDissonance } from './CodexScreen';
import { pointSourceParts, pointSources, type PointSources } from './deedsModel';
import { useAllowance } from './PrepScreen';
import { giveBackStar, respecStars, takeStar } from './astrolabeActions';
import {
  KIND_LABEL,
  droppedStars,
  firstNotableLine,
  keystoneParts,
  overBudgetLine,
  pointsLine,
  pointsWord,
  previewLine,
  previewStar,
  spendLine,
  starConstellations,
  starGlyph,
  starToward,
  takeSound,
  tipPlacement,
  treeTotals,
  type StarPreview,
} from './astrolabeModel';

export interface AstrolabeViewProps {
  /** The stars taken, in the order they were taken (the centre is never listed). */
  tree: readonly string[];
  /** The points the Rank and the Deeds give (all of them with Skip the unlocks). */
  points: number;
  /** Phase 4b: where they come from, the Rank's and the Deeds' (none: not shown). */
  sources?: PointSources;
  /** Opens the Codex's Deeds (from "2 from Deeds"). */
  onDeeds?(): void;
  rank: number;
  /** Settings → Skip the unlocks is on. */
  unlockAll?: boolean;
  onTake(id: string): void;
  onGiveBack(id: string): void;
  onRespec(): void;
  onBack(): void;
  /** Where Back goes ("Prep", "Title"). */
  backTo?: string;
  /** A run under way keeps the tree it embarked with (opened from the Title mid-run). */
  runUnderWay?: boolean;
  /** UI lab: a star pointed at (its path drawn), the respec dialog open. */
  initialPoint?: string | null;
  initialRespec?: boolean;
}

const ARROWS: Readonly<Record<string, readonly [number, number]>> = {
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
};

/** The least time between two hover sounds, so sweeping across the map doesn't rattle. */
const HOVER_SOUND_MS = 70;

/**
 * The Astrolabe (Phase 4, docs/phase-4.md): the star map between runs. Point at a star to see
 * what it does and the path to it (and what it costs); click (or Enter) takes it and the path;
 * right-click (or Delete) gives one back if nothing hangs on it; Respec gives everything back.
 * The side panel adds the tree up, stat by stat, and lists each keystone with its price.
 */
export function AstrolabeView({
  tree,
  points,
  sources,
  onDeeds,
  rank,
  unlockAll = false,
  onTake,
  onGiveBack,
  onRespec,
  onBack,
  backTo = 'Title',
  runUnderWay = false,
  initialPoint = null,
  initialRespec = false,
}: AstrolabeViewProps) {
  useMood('map');
  const [hover, setHover] = useState<string | null>(initialPoint);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(initialPoint);
  const [buzz, setBuzz] = useState<{ id: string; n: number } | null>(null);
  const [respec, setRespec] = useState(initialRespec);
  const refs = useRef(new Map<string, SVGGElement>());
  const lastSound = useRef(0);
  // Focus shows a star's tooltip only once the keyboard is in use on this screen, so the star
  // focused on arrival (and one focused by a click) stays quiet.
  const keyboard = useRef(false);
  useEffect(() => {
    const onKey = () => {
      keyboard.current = true;
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  const pointed = hover ?? focusId;
  const preview = useMemo(
    () => (pointed ? previewStar(tree, points, pointed) : null),
    [tree, points, pointed],
  );
  const card = selected ? previewStar(tree, points, selected) : null;
  const dropped = useMemo(() => new Set(droppedStars(tree, points)), [tree, points]);
  const left = points - tree.length;

  // Escape goes back (the respec dialog closes itself first).
  useEffect(() => {
    if (respec) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      onBack();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onBack, respec]);

  // The keyboard starts on the Weaver's Star, so the arrows work at once.
  useEffect(() => {
    if (!initialPoint) refs.current.get(ASTROLABE_START)?.focus();
  }, [initialPoint]);

  const point = (id: string | null, via: 'pointer' | 'focus', visible = true) => {
    if (via === 'pointer') setHover(id);
    else setFocusId(id && visible ? id : null);
    if (!id || (via === 'focus' && !visible)) return;
    setSelected(id);
    const now = performance.now();
    if (now - lastSound.current >= HOVER_SOUND_MS) {
      lastSound.current = now;
      playUi('starHover');
    }
  };

  const refuse = (id: string) => setBuzz((b) => ({ id, n: (b?.n ?? 0) + 1 }));

  const take = (id: string) => {
    setSelected(id);
    const p = previewStar(tree, points, id);
    if (p.action === 'take') {
      onTake(id);
      playUi(takeSound(p.path));
    } else if (p.action === 'short') {
      refuse(id);
      playUi('cantAfford');
    }
  };

  const giveBack = (id: string) => {
    setSelected(id);
    const p = previewStar(tree, points, id);
    if (p.action === 'mine') {
      onGiveBack(id);
      playUi('starRefund');
    } else if (p.action === 'held') {
      refuse(id);
      playUi('error');
    }
  };

  const onStarKey = (e: KeyboardEvent<SVGGElement>, id: string) => {
    const dir = ARROWS[e.key];
    if (dir) {
      e.preventDefault();
      const next = starToward(id, dir[0], dir[1]);
      if (next) refs.current.get(next)?.focus();
      return;
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      take(id);
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      giveBack(id);
    }
  };

  return (
    <main className="relative h-full w-full overflow-hidden" data-testid="astrolabe-screen">
      <Backdrop tone="navy" />
      <div className="relative z-10 flex h-full flex-col px-5 pb-4 pt-3">
        <header className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-muted">
              Between runs · Weaver Rank {rank}
              {unlockAll && ' · all unlocked'}
            </p>
            <h1 className="font-display text-3xl font-bold tracking-wide text-gold-300">
              The Astrolabe
            </h1>
          </div>
          <PointsMeter spent={tree.length} points={points} sources={sources} onDeeds={onDeeds} />
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={() => setRespec(true)}
              disabled={tree.length === 0}
              sound="click"
              title="Give every point back (free between runs)"
            >
              <Icon name="reroll" size={16} /> Respec
            </Button>
            <Button variant="ghost" onClick={onBack} sound="back">
              <Icon name="back" size={16} /> {backTo} <KeyCap label="Esc" />
            </Button>
          </div>
        </header>
        <div className="mt-1 flex min-h-0 flex-1 gap-4">
          <div className="relative flex min-w-0 flex-1 items-center justify-center">
            <div className="relative aspect-square h-full max-w-full">
              <AstrolabeMap
                tree={tree}
                preview={preview}
                focused={focusId}
                dropped={dropped}
                buzz={buzz}
                className="h-full w-full"
                label={`The Astrolabe: ${pointsLine(tree.length, points)}. Arrow keys move between stars; Enter takes one, Delete gives one back.`}
                onPoint={(id, via) =>
                  point(
                    id,
                    via,
                    via === 'focus' && id
                      ? keyboard.current && !!refs.current.get(id)?.matches?.(':focus-visible')
                      : true,
                  )
                }
                onTake={take}
                onGiveBack={giveBack}
                onKey={onStarKey}
                starRef={(id, el) => {
                  if (el) refs.current.set(id, el);
                  else refs.current.delete(id);
                }}
              />
              {preview && <StarTip preview={preview} tree={tree} />}
            </div>
          </div>
          <aside
            className="flex w-[28.5rem] shrink-0 flex-col gap-3"
            aria-label="Your tree"
            data-testid="astrolabe-side"
          >
            {runUnderWay && (
              <p className="flex items-start gap-2 rounded-lg border border-ink-600 bg-ink-900/80 px-3 py-2 text-xs text-muted">
                <Icon name="info" size={14} className="mt-px shrink-0 text-gold-300" />
                Your run under way keeps the tree it embarked with: what you change here is for the
                next one.
              </p>
            )}
            {left < 0 && (
              <p
                className="flex items-start gap-2 rounded-lg border border-threat/60 bg-threat/10 px-3 py-2 text-xs text-orange-100"
                role="status"
                data-testid="astrolabe-over"
              >
                <Icon name="info" size={14} className="mt-px shrink-0 text-threat" />
                {overBudgetLine(tree.length, points)}
              </p>
            )}
            <StarCard
              preview={card}
              onTake={() => card && take(card.id)}
              onGiveBack={() => card && giveBack(card.id)}
            />
            <TreeSummary tree={tree} />
          </aside>
        </div>
      </div>
      {respec && (
        <Modal title="Give every point back?" onClose={() => setRespec(false)} closeOnEscape>
          <p className="mt-3 text-sm leading-relaxed text-text">
            Every star you lit goes dark, and your {pointsWord(tree.length)} come back to spend
            again. It’s free between runs.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => setRespec(false)}
              sound="back"
              data-autofocus
            >
              Keep my tree
            </Button>
            <Button
              variant="danger"
              sound={null}
              onClick={() => {
                onRespec();
                playUi('starRespec');
                setSelected(null);
                setRespec(false);
              }}
            >
              <Icon name="reroll" size={16} /> Give everything back
            </Button>
          </div>
        </Modal>
      )}
    </main>
  );
}

/**
 * "3 points to spend · 12 of 15 points", a pip for each point (lit when spent), and where the
 * points come from: "11 from Ranks · 4 from Deeds" (the Deeds' share opens the Codex's Deeds).
 */
function PointsMeter({
  spent,
  points,
  sources,
  onDeeds,
}: {
  spent: number;
  points: number;
  sources?: PointSources;
  onDeeds?(): void;
}) {
  const left = points - spent;
  const pips = Math.max(points, spent);
  return (
    <div className="flex flex-col items-center">
      <div
        className="flex flex-col items-center"
        role="status"
        aria-label={`${spendLine(left)}: ${pointsLine(spent, points)}`}
        data-testid="astrolabe-points"
        data-left={left}
      >
        <p className="flex items-baseline gap-2">
          <span
            className={`font-display text-xl font-bold ${left < 0 ? 'text-threat' : left > 0 ? 'text-gold-200' : 'text-text'}`}
          >
            {spendLine(left)}
          </span>
          <span className="font-mono text-xs text-muted">{pointsLine(spent, points)}</span>
        </p>
        <span className="mt-1 flex gap-1" aria-hidden>
          {Array.from({ length: pips }, (_, i) => (
            <span
              key={i}
              className="h-2 w-2 rotate-45 rounded-[2px] border"
              style={
                i < Math.min(spent, points)
                  ? { background: STARLIGHT.color, borderColor: STARLIGHT.color }
                  : i < points
                    ? { borderColor: 'var(--color-gold-400)', background: 'transparent' }
                    : { borderColor: 'var(--color-threat)', background: 'var(--color-threat)' }
              }
            />
          ))}
        </span>
      </div>
      {sources && (
        <p
          className="mt-1 font-mono text-xs text-muted"
          data-testid="astrolabe-sources"
          data-ranks={sources.ranks}
          data-deeds={sources.deeds}
        >
          {pointSourceParts(sources).ranks} ·{' '}
          {onDeeds ? (
            <button
              type="button"
              onClick={onDeeds}
              className="text-gold-200 underline decoration-gold-400/50 decoration-dotted underline-offset-2 hover:text-gold-100"
              title="The Deeds, in the Codex: each on the ladder gives a point"
              data-testid="astrolabe-deeds"
            >
              {pointSourceParts(sources).deeds}
            </button>
          ) : (
            pointSourceParts(sources).deeds
          )}
        </p>
      )}
    </div>
  );
}

/** A star as a small badge: its glyph on its constellation's colour (a keystone's diamond). */
function StarBadge({ node, size = 36 }: { node: AstrolabeNode; size?: number }) {
  const c = starConstellations(node)[0];
  if (node.kind === 'keystone' && c)
    return <KeystoneBadge glyph={starGlyph(node)} constellation={c} size={size} />;
  const look = c ? constellationLook(c) : { ...STARLIGHT, light: STARLIGHT.light };
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full border-2"
      style={{
        width: size,
        height: size,
        borderColor: look.color,
        color: look.light,
        background: `radial-gradient(circle at 50% 40%, color-mix(in srgb, ${look.color} 40%, transparent), rgb(10 16 34 / 0.95) 75%)`,
      }}
      aria-hidden
    >
      <AstrolabeGlyph glyph={starGlyph(node)} size={Math.round(size * 0.58)} />
    </span>
  );
}

/** "Keystone · Silk", "Notable · Silk and Choir" with each constellation's glyph. */
function KindLine({ node }: { node: AstrolabeNode }) {
  const cs = starConstellations(node);
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
      <span className="font-semibold uppercase tracking-wider text-muted">
        {KIND_LABEL[node.kind]}
      </span>
      {cs.map((c) => {
        const look = CONSTELLATION_LOOK[c];
        return (
          <span key={c} className="flex items-center gap-1" style={{ color: look.color }}>
            <AstrolabeGlyph glyph={look.glyph} size={13} />
            {look.name}
            <span className="text-muted">· {look.blurb}</span>
          </span>
        );
      })}
    </p>
  );
}

/** What a star does: its text, or a keystone's gains and price line by line. */
function StarText({ node, compact = false }: { node: AstrolabeNode; compact?: boolean }) {
  if (node.kind === 'keystone') {
    const parts = keystoneParts(node);
    return (
      <ul className={`flex flex-col gap-1 ${compact ? 'text-xs' : 'text-sm'} leading-snug`}>
        {parts.gains.map((s) => (
          <li key={s} className="flex gap-1.5 text-text">
            <span className="font-bold text-gold-300" aria-label="Gives">
              +
            </span>
            {s}
          </li>
        ))}
        {parts.prices.map((s) => (
          <li key={s} className="flex gap-1.5 text-rose-200">
            <span className="font-bold text-rose-300" aria-label="Price">
              −
            </span>
            {s}
          </li>
        ))}
      </ul>
    );
  }
  return (
    <p className={`${compact ? 'text-xs' : 'text-sm'} leading-snug text-text`}>
      {astrolabeText(node)}
    </p>
  );
}

/** The cost or the reason, as a colour and a glyph (never colour alone). */
function ActionLine({ preview: p }: { preview: StarPreview }) {
  const tone =
    p.action === 'take'
      ? 'text-gold-200'
      : p.action === 'short' || p.action === 'held'
        ? 'text-orange-200'
        : 'text-muted';
  const icon =
    p.action === 'take'
      ? 'star'
      : p.action === 'short' || p.action === 'held'
        ? 'lock'
        : p.action === 'mine'
          ? 'check'
          : 'sparkle';
  return (
    <p className={`flex items-start gap-1.5 text-xs font-semibold ${tone}`}>
      <Icon name={icon} size={13} className="mt-px shrink-0" />
      <span>{previewLine(p)}</span>
    </p>
  );
}

/**
 * The tooltip by the star pointed at: name, kind, constellation, what it does, the cost. It goes
 * wherever it hides the fewest of the stars the preview lights (`tipPlacement`), measured once
 * it has its content and again when the window changes size.
 */
function StarTip({ preview: p, tree }: { preview: StarPreview; tree: readonly string[] }) {
  const node = astrolabeNode(p.id);
  const ref = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<{ x: number; y: number } | null>(null);
  const [resized, setResized] = useState(0);
  useEffect(() => {
    const onResize = () => setResized((n) => n + 1);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  useLayoutEffect(() => {
    const el = ref.current;
    const map = el?.parentElement;
    const column = map?.parentElement;
    const screen = el?.closest('[data-testid="astrolabe-screen"]') ?? document.body;
    if (!el || !map || !column) return;
    const m = map.getBoundingClientRect();
    const past = (r: DOMRect, margin = 0) => ({
      left: m.left - r.left - margin,
      right: r.right - m.right - margin,
      top: m.top - r.top - margin,
      bottom: r.bottom - m.bottom - margin,
    });
    const at = tipPlacement(
      p,
      tree,
      { w: m.width, h: m.height },
      { w: el.offsetWidth, h: el.offsetHeight },
      past(column.getBoundingClientRect()),
      past(screen.getBoundingClientRect(), 8),
    );
    setPlace((old) => (old && old.x === at.x && old.y === at.y ? old : at));
  }, [p, tree, resized]);
  return (
    <div
      ref={ref}
      role="tooltip"
      className="pointer-events-none absolute z-20 w-72 rounded-xl border border-gold-500/50 bg-ink-900/96 p-3 shadow-2xl shadow-black/70"
      style={{ left: place?.x ?? 0, top: place?.y ?? 0, visibility: place ? undefined : 'hidden' }}
      data-testid="star-tip"
      data-star={p.id}
      data-action={p.action}
      data-cost={p.cost}
    >
      <div className="flex items-center gap-2.5">
        <StarBadge node={node} size={32} />
        <div className="min-w-0">
          <p className="font-display text-base font-bold leading-tight text-gold-100">
            {node.name}
          </p>
          <KindLine node={node} />
        </div>
      </div>
      <div className="mt-2">
        <StarText node={node} compact />
      </div>
      {p.action !== 'centre' && (
        <div className="mt-2 border-t border-ink-600/70 pt-2">
          <ActionLine preview={p} />
        </div>
      )}
    </div>
  );
}

/** The star last pointed at, with buttons to take it or give it back. */
function StarCard({
  preview: p,
  onTake,
  onGiveBack,
}: {
  preview: StarPreview | null;
  onTake(): void;
  onGiveBack(): void;
}) {
  if (!p) {
    return (
      <Panel tone="solid" className="p-4" data-testid="star-card">
        <p className="font-display text-base font-bold text-gold-200">Plan a path</p>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          Point at a star: the path to it lights up, with what it costs. Take it and every star on
          the way; give one back if nothing you’ve taken hangs on it.
        </p>
        <Legend />
      </Panel>
    );
  }
  const node = astrolabeNode(p.id);
  return (
    <Panel tone="solid" className="p-4" data-testid="star-card" data-star={p.id}>
      <div className="flex items-start gap-3">
        <StarBadge node={node} size={40} />
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-lg font-bold leading-tight text-gold-100">
            {node.name}
          </h2>
          <KindLine node={node} />
        </div>
      </div>
      <div className="mt-2">
        <StarText node={node} />
      </div>
      {p.action !== 'centre' && (
        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2" role="status">
          <ActionLine preview={p} />
          <span className="flex gap-2">
            {(p.action === 'take' || p.action === 'short') && (
              <Button
                size="sm"
                variant={p.action === 'take' ? 'primary' : 'secondary'}
                onClick={onTake}
                sound={null}
                aria-disabled={p.action !== 'take'}
                data-testid="star-take"
              >
                Take · {pointsWord(p.cost)}
              </Button>
            )}
            {(p.action === 'mine' || p.action === 'held') && (
              <Button
                size="sm"
                variant="secondary"
                onClick={onGiveBack}
                sound={null}
                aria-disabled={p.action !== 'mine'}
                data-testid="star-give-back"
              >
                <Icon name="back" size={14} /> Give back
              </Button>
            )}
          </span>
        </div>
      )}
    </Panel>
  );
}

/** How the map reads, and its keys. */
function Legend() {
  const row = (shape: ReactNode, text: string) => (
    <li className="flex items-center gap-2">
      <span className="flex w-5 justify-center">{shape}</span>
      {text}
    </li>
  );
  const silk = CONSTELLATION_LOOK.silk.color;
  return (
    <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1 text-xs text-muted">
      <ul className="flex flex-col gap-1">
        {row(
          <span
            className="h-3 w-3 rounded-full"
            style={{ background: silk, boxShadow: `0 0 8px ${silk}` }}
          />,
          'Lit: yours',
        )}
        {row(
          <span className="h-3 w-3 rounded-full border-2" style={{ borderColor: silk }} />,
          'Touches your tree',
        )}
        {row(
          <span className="h-3 w-3 rounded-full border opacity-50" style={{ borderColor: silk }} />,
          'Out of reach for now',
        )}
        {row(
          <span className="h-3 w-3 rotate-45 border-2" style={{ borderColor: silk }} />,
          'Keystone: a rule, with a price',
        )}
      </ul>
      <ul className="flex flex-col gap-1">
        <li className="flex items-center gap-1.5">
          <KeyCap label="Click" /> or <KeyCap label="Enter" /> take
        </li>
        <li className="flex items-center gap-1.5">
          <KeyCap label="Right-click" className="whitespace-nowrap" /> or <KeyCap label="Del" />{' '}
          give back
        </li>
        <li className="flex items-center gap-1.5">
          <KeyCap label="Tab" /> <KeyCap label="← ↑ → ↓" /> move
        </li>
        <li className="flex items-center gap-1.5">
          <KeyCap label="Esc" /> back
        </li>
      </ul>
    </div>
  );
}

/** What the tree adds up to, stat by stat; the rules its notables add; each keystone's price. */
function TreeSummary({ tree }: { tree: readonly string[] }) {
  const t = treeTotals(tree);
  const empty = t.groups.length === 0 && t.rules.length === 0 && t.keystones.length === 0;
  return (
    <Panel
      tone="solid"
      className="scroll-thin min-h-0 flex-1 overflow-y-auto p-4"
      data-testid="astrolabe-totals"
    >
      <h2 className="font-display text-base font-bold text-gold-300">What your tree adds up to</h2>
      {empty ? (
        <p className="mt-1 text-sm text-muted">Nothing yet. {firstNotableLine()}</p>
      ) : (
        <div className="mt-2 flex flex-col gap-2.5">
          {t.groups.map((g) => {
            const look = CONSTELLATION_LOOK[g.constellation];
            return (
              <section key={g.constellation} aria-label={look.name}>
                <p
                  className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider"
                  style={{ color: look.color }}
                >
                  <AstrolabeGlyph glyph={look.glyph} size={13} /> {look.name}
                  <span className="font-normal normal-case tracking-normal text-muted">
                    {look.blurb}
                  </span>
                </p>
                <ul className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 pl-5 text-sm text-text">
                  {g.lines.map((l) => (
                    <li key={l.key} data-stat={l.key}>
                      {l.text}
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
          {t.keystones.length > 0 && (
            <section aria-label="Keystones" data-testid="astrolabe-keystones">
              <p className="text-xs font-bold uppercase tracking-wider text-gold-200">
                Keystones · each with its price
              </p>
              <ul className="mt-1 flex flex-col gap-2">
                {t.keystones.map((n) => (
                  <li key={n.id} className="flex items-start gap-2.5" data-keystone={n.id}>
                    <StarBadge node={n} size={30} />
                    <div className="min-w-0">
                      <p
                        className="font-display text-sm font-bold"
                        style={{ color: constellationLook(n.constellation).light }}
                      >
                        {n.name}
                      </p>
                      <StarText node={n} compact />
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {t.rules.length > 0 && (
            <section aria-label="Notables">
              <p className="text-xs font-bold uppercase tracking-wider text-gold-200">Notables</p>
              <ul className="mt-0.5 flex flex-col gap-1">
                {t.rules.map((n) => (
                  <li key={n.id} className="flex items-start gap-2 text-sm">
                    <span className="mt-0.5">
                      <StarBadge node={n} size={20} />
                    </span>
                    <span>
                      <b className="font-semibold text-text">{n.name}</b>{' '}
                      <span className="text-muted">{astrolabeText(n)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </Panel>
  );
}

/**
 * The Astrolabe from the profile store: Title → Astrolabe → Title, Prep → Astrolabe → Prep. Its
 * "from Deeds" opens the Codex's Deeds here, in place, so Back still knows where it came from.
 */
export function AstrolabeScreen() {
  const tree = useProfile((s) => s.profile.astrolabe);
  const xp = useProfile((s) => s.profile.xp);
  const deeds = useProfile((s) => s.profile.deeds);
  const deedBest = useProfile((s) => s.profile.deedBest);
  const unlockAll = useSettings((s) => s.settings.unlockAll);
  const allowance = useAllowance();
  const back = useUi((s) => s.back);
  const previous = useUi((s) => s.previous);
  const rank = rankOf(xp);
  const [runUnderWay] = useState(() => {
    if (previous === 'run') return false;
    const saved = loadRun(storage());
    return !!saved && saved.phase !== 'prep' && saved.phase !== 'summary';
  });
  const [codex, setCodex] = useState(false);
  const dissonance = useCodexDissonance();
  const bonds = useCodexBonds();
  if (codex) {
    return (
      <CodexView
        onBack={() => setCodex(false)}
        initialTab="deeds"
        allowance={allowance}
        rank={rank}
        deeds={{ earned: deeds, best: deedBest }}
        dissonance={dissonance}
        bonds={bonds}
      />
    );
  }
  const sources = pointSources(rank, unlockAll, deeds);
  return (
    <AstrolabeView
      tree={tree}
      points={sources.total}
      sources={sources}
      onDeeds={() => setCodex(true)}
      rank={rank}
      unlockAll={unlockAll}
      onTake={(id) => void takeStar(id)}
      onGiveBack={(id) => void giveBackStar(id)}
      onRespec={() => void respecStars()}
      onBack={back}
      backTo={previous === 'run' ? 'Prep' : 'Title'}
      runUnderWay={runUnderWay}
    />
  );
}
