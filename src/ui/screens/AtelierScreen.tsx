import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useProfile } from '../../app/profileStore';
import { useSettings } from '../../app/settings';
import { shopItems, type Look, type ShopItem, type ShopKind } from '../../meta/loom';
import { rankOf } from '../../meta/profile';
import { Backdrop } from '../kit/Backdrop';
import { Button } from '../kit/Button';
import { fmt } from '../kit/format';
import { Icon } from '../kit/Icon';
import { KeyCap } from '../kit/KeyCap';
import {
  LOOM_SOUNDS,
  OWN_ROBE,
  STARLIGHT_LOOK,
  ribbonColors,
  robeColors,
  threadColors,
  type RobeColors,
  type ThreadColors,
} from '../kit/loomLook';
import { arrowFocus } from '../kit/menuNav';
import { useReducedMotion } from '../kit/motion';
import { Panel } from '../kit/Panel';
import { playUi, useMood } from '../kit/sound';
import { StarlightChip, StarlightPrice } from '../kit/Starlight';
import { VARIANT_LOOK } from '../kit/variantLook';
import { WeaverFigure } from '../kit/WeaverFigure';
import { useUi } from '../store';
import { LOOM_CSS, ThreadPreview } from './LoomParts';
import {
  atelierShelves,
  buyLine,
  lookSlot,
  titleText,
  wearLine,
  type Shelf,
  type ShelfItem,
} from './loomModel';
import { t as txt } from '../text';

/** What's being tried on: a keepsake (or the Weaver's own, `id` null) of a kind. */
interface Trying {
  kind: ShopKind;
  id: string | null;
}

export interface AtelierViewProps {
  /** Everything the Atelier shows (the profile store's `shop()`), with its state and why. */
  items: readonly ShopItem[];
  /**
   * With Settings → Skip the unlocks: the shop as it stands without it (`shopItems` with `all`
   * false), so a variant Skip opens to play is offered for sale only where it's sold anyway.
   */
  unskipped?: readonly ShopItem[] | null;
  /** What the Weaver wears. */
  look: Look;
  /** The balance. */
  starlight: number;
  /** Buys an item: null when bought, else why not (the profile store's `buy`). */
  onBuy(id: string): string | null;
  /** Wears a keepsake, or the Weaver's own (null) (the profile store's `equip`). */
  onWear(slot: keyof Look, id: string | null): void;
  onBack(): void;
  /** Where Back goes ("The Loom"). */
  backTo?: string;
  /** UI lab: a keepsake tried on, a line said, no motion. */
  initialTrying?: Trying | null;
  initialSaid?: { id: string; text: string; refused: boolean } | null;
  still?: boolean;
}

/**
 * The Atelier (Phase 4g, docs/phase-4g.md): Starlight's shop, a station of the Loom. Four shelves
 * from `shop()`, in its order: technique variants, robes, Thread looks and titles, each item with
 * its price, its state (for sale, owned, worn, earned, locked) and why. Buying is the store's
 * `buy` (a refusal is said on the item and read out); wearing is its `equip`, titles too, and each
 * shelf of keepsakes starts with the Weaver's own. An owned variant says it's chosen in Prep.
 *
 * Pointing at (or focusing) a robe, a Thread look or a title tries it on in the preview: the
 * Weaver in the robe, her title under her name, and the Thread in the look, once in Mend and once
 * in Empower, so it's plain the Thread still says which it is. The balance is in the corner.
 */
export function AtelierView({
  items,
  unskipped = null,
  look,
  starlight,
  onBuy,
  onWear,
  onBack,
  backTo = txt('screens.atelierScreen.theLoom'),
  initialTrying = null,
  initialSaid = null,
  still: stillProp = false,
}: AtelierViewProps) {
  useMood('loom');
  const reduced = useReducedMotion();
  // Her ribbons wear the Thread look as the fight draws it, fitted to the colour vision.
  const vision = useSettings((st) => st.settings.colorVision);
  const still = stillProp || reduced;
  const [trying, setTrying] = useState<Trying | null>(initialTrying);
  const [said, setSaid] = useState<Said>(initialSaid ? { ...initialSaid, n: 0 } : null);
  const shelvesRef = useRef<HTMLDivElement>(null);
  const shelves = atelierShelves(items, look, starlight, unskipped);

  // Escape goes back to the Loom.
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      e.preventDefault();
      onBack();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onBack]);

  /** One line said about an item (bought, refused, worn), shown on it and read out. */
  const say = (id: string, text: string, refused = false) =>
    setSaid((d) => ({ id, text, refused, n: (d?.n ?? 0) + 1 }));
  const act = (s: ShelfItem) => {
    const { item } = s;
    const slot = lookSlot(item.kind);
    if (s.action === 'buy') {
      const refusal = onBuy(item.id);
      playUi(refusal === null ? LOOM_SOUNDS.buy : LOOM_SOUNDS.refused);
      say(item.id, buyLine(item, refusal, s.short), refusal !== null);
    } else if (s.action === 'wear' && slot) {
      onWear(slot, item.id);
      playUi(LOOM_SOUNDS.wear, { keepsake: item.id });
      say(item.id, wearLine(item.kind, item.name));
    }
  };
  const wearOwn = (shelf: Shelf) => {
    const slot = lookSlot(shelf.kind);
    if (!slot || !shelf.own || shelf.own.worn) return;
    onWear(slot, null);
    playUi(LOOM_SOUNDS.unwear);
    say(`own-${shelf.kind}`, wearLine(shelf.kind, null));
  };

  // The preview: what's tried on, else what's worn.
  const robeId = trying?.kind === 'robe' ? trying.id : look.robe;
  const threadId = trying?.kind === 'thread' ? trying.id : look.thread;
  const titleId = trying?.kind === 'title' ? trying.id : look.title;
  const tryingItem =
    trying && trying.id !== null ? (items.find((i) => i.id === trying.id) ?? null) : null;
  const tryingWorn = trying ? (look[lookSlot(trying.kind)!] ?? null) === trying.id : true;

  const onShelvesKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (shelvesRef.current && arrowFocus(shelvesRef.current, e.key)) e.preventDefault();
  };

  return (
    <main className="relative h-full w-full overflow-hidden" data-testid="atelier-screen">
      <Backdrop tone="dusk" />
      <style>{LOOM_CSS}</style>
      <div className="scroll-thin relative z-10 flex h-full flex-col overflow-y-auto px-4 pb-5 pt-3 sm:px-5">
        <header className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="min-w-0">
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-muted">
              {txt('screens.atelierScreen.theLoomTheStarlight')}
            </p>
            <h1 className="flex items-center gap-2 font-display text-3xl font-bold tracking-wide text-gold-300">
              <Icon name="atelier" size={28} style={{ color: STARLIGHT_LOOK.color }} />{' '}
              {txt('screens.atelierScreen.theAtelier')}
            </h1>
          </div>
          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
            <StarlightChip amount={starlight} size="lg" testId="atelier-starlight" />
            <Button variant="ghost" onClick={onBack} sound="back" data-testid="atelier-back">
              <Icon name="back" size={16} /> {backTo}{' '}
              <KeyCap label={txt('screens.atelierScreen.esc')} />
            </Button>
          </div>
        </header>
        <p className="mt-1 max-w-3xl text-sm text-muted">
          {txt('screens.atelierScreen.spendStarlightOnNew')}
        </p>
        <p className="sr-only" aria-live="polite" data-testid="atelier-said">
          {said?.text ?? ''}
        </p>
        <div className="mt-3 grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_21rem]">
          <div ref={shelvesRef} className="flex min-w-0 flex-col gap-5" onKeyDown={onShelvesKey}>
            {shelves.map((shelf) => (
              <ShelfView
                key={shelf.kind}
                shelf={shelf}
                said={said}
                trying={trying}
                onTry={(t) => setTrying(t)}
                onAct={act}
                onOwn={() => wearOwn(shelf)}
              />
            ))}
          </div>
          <Panel
            tone="solid"
            className="order-first flex flex-col items-center gap-2 p-4 lg:sticky lg:top-0 lg:order-none"
            data-testid="atelier-preview"
            data-robe={robeId ?? 'own'}
            data-thread={threadId ?? 'own'}
          >
            <div className="flex min-h-7 items-center justify-between gap-2 self-stretch">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                {trying && !tryingWorn ? (
                  <>
                    {txt('screens.atelierScreen.tryingOn')}
                    <span className="normal-case tracking-normal text-text">
                      {tryingItem?.name ?? ownName(trying.kind)}
                    </span>
                    {tryingItem &&
                      tryingItem.state !== 'owned' &&
                      tryingItem.state !== 'earned' && (
                        <span className="normal-case tracking-normal">
                          {' '}
                          {txt('screens.atelierScreen.notYoursYet')}
                        </span>
                      )}
                  </>
                ) : (
                  txt('screens.atelierScreen.asYouAre')
                )}
              </p>
              {trying && !tryingWorn && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setTrying(null)}
                  sound="back"
                  className="shrink-0"
                  data-testid="atelier-as-you-are"
                >
                  {txt('screens.atelierScreen.asYouAre')}
                </Button>
              )}
            </div>
            <WeaverFigure
              robe={robeColors(robeId)}
              ribbons={ribbonColors(threadId, vision)}
              still={still}
              className="h-44 w-auto"
              label={txt('screens.atelierScreen.theWeaverIn', {
                value: robeId
                  ? (items.find((i) => i.id === robeId)?.name ??
                    txt('screens.atelierScreen.herRobe'))
                  : txt('screens.atelierScreen.herOwnRobe'),
              })}
            />
            <p className="-mt-1 font-display text-lg font-bold leading-tight text-gold-200">
              {txt('screens.atelierScreen.theWeaver')}
            </p>
            <p
              className="min-h-5 font-display text-sm italic leading-tight text-gold-300"
              data-testid="atelier-preview-title"
            >
              {titleText(titleId) ?? (
                <span className="not-italic text-muted">
                  {txt('screens.atelierScreen.noTitle')}
                </span>
              )}
            </p>
            <div className="mt-1 self-stretch border-t border-ink-600/60 pt-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                {txt('screens.atelierScreen.theThread')}
                <span className="normal-case tracking-normal">
                  {' '}
                  ·{' '}
                  {threadId
                    ? (items.find((i) => i.id === threadId)?.name ?? '')
                    : txt('screens.atelierScreen.itsOwnLook')}
                </span>
              </p>
              <ThreadPreview look={threadColors(threadId)} still={still} />
              <p className="mt-1 text-xs leading-snug text-muted">
                {txt('screens.atelierScreen.theFilamentAndIts')}
              </p>
            </div>
          </Panel>
        </div>
      </div>
    </main>
  );
}

/** The Weaver's own, by shelf. */
function ownName(kind: ShopKind): string {
  return kind === 'robe'
    ? txt('screens.atelierScreen.theWeaverSOwn')
    : kind === 'thread'
      ? txt('screens.atelierScreen.theThreadSOwn')
      : txt('screens.atelierScreen.noTitle2');
}

/** A shelf: its heading and blurb, how many are yours, the Weaver's own first, then the items. */
function ShelfView({
  shelf,
  said,
  trying,
  onTry,
  onAct,
  onOwn,
}: {
  shelf: Shelf;
  said: Said;
  trying: Trying | null;
  onTry(t: Trying): void;
  onAct(s: ShelfItem): void;
  onOwn(): void;
}) {
  const mine = shelf.items.filter((s) => s.item.state === 'owned' || s.item.state === 'earned');
  const cols =
    shelf.kind === 'variant' ? 'sm:grid-cols-2' : 'grid-cols-2 sm:grid-cols-3 xl:grid-cols-4';
  return (
    <section aria-labelledby={`shelf-${shelf.kind}`} data-testid={`shelf-${shelf.kind}`}>
      <div className="mb-2 flex flex-wrap items-end justify-between gap-x-3 gap-y-1">
        <div className="min-w-0">
          <h2
            id={`shelf-${shelf.kind}`}
            className="flex items-center gap-2 font-display text-lg font-bold tracking-wide text-gold-300"
          >
            <Icon name={shelf.icon} size={18} /> {shelf.title}
          </h2>
          <p className="text-xs text-muted">{shelf.blurb}</p>
          {shelf.more && (
            <p className="text-xs text-muted" data-testid="shelf-more">
              {shelf.more}
            </p>
          )}
        </div>
        <p className="font-mono text-xs text-muted">
          {txt('screens.atelierScreen.ofYours', {
            length: mine.length,
            length2: shelf.items.length,
          })}
        </p>
      </div>
      <ul className={`grid gap-2 ${cols}`}>
        {shelf.own && (
          <li>
            <OwnCard shelf={shelf} said={said} onTry={onTry} onOwn={onOwn} />
          </li>
        )}
        {shelf.items.map((s) => (
          <li key={s.item.id}>
            {shelf.kind === 'variant' ? (
              <VariantCard s={s} said={said} onAct={onAct} />
            ) : (
              <KeepsakeCard
                s={s}
                said={said}
                tried={trying?.id === s.item.id}
                onTry={onTry}
                onAct={onAct}
              />
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The line an item said last (bought, refused, worn), in place. */
function SaidLine({ said, id }: { said: Said; id: string }) {
  if (!said || said.id !== id) return null;
  return (
    <p
      key={said.n}
      className={`anim-fade mt-1.5 text-xs font-semibold ${said.refused ? 'text-rose-200' : 'text-gold-200'}`}
      data-testid="atelier-item-said"
      aria-hidden
    >
      {said.text}
    </p>
  );
}

/** A state as a small chip: owned, wearing, earned, locked, open (nothing for sale). */
function StatusChip({
  status,
  worn = false,
  locked = false,
}: {
  status: string | null;
  worn?: boolean;
  /** Its item is still locked (the chip greys, with a padlock): from the item, not the word. */
  locked?: boolean;
}) {
  if (!status) return null;
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md border px-1.5 py-px text-xs font-semibold ${locked ? 'border-ink-500 text-muted' : 'border-gold-400/60 bg-gold-400/10 text-gold-200'}`}
      data-testid="item-status"
    >
      {locked && <Icon name="lock" size={11} />}
      {worn && <Icon name="check" size={11} />}
      {status}
    </span>
  );
}

/** What an item's button does: buy it (its price on the button), or wear it. */
function ActionButton({ s, onAct }: { s: ShelfItem; onAct(s: ShelfItem): void }) {
  const { item } = s;
  if (s.action === null) return null;
  const buying = s.action === 'buy';
  const enough = buying && s.short === 0;
  return (
    <Button
      size="sm"
      variant={enough ? 'primary' : 'secondary'}
      onClick={() => onAct(s)}
      sound={null}
      aria-label={
        buying
          ? txt('screens.atelierScreen.buyForStarlight', {
              name: item.name,
              fmt: fmt(item.price ?? 0),
              value: s.short > 0 ? txt('screens.atelierScreen.short', { short: fmt(s.short) }) : '',
            })
          : txt('screens.atelierScreen.wear2', { name: item.name })
      }
      className="shrink-0"
      data-nav
      data-testid={`atelier-${s.action}-${item.id}`}
    >
      {buying ? (
        <>
          {txt('screens.atelierScreen.buy')}
          <StarlightPrice
            price={item.price ?? 0}
            tone={enough ? 'inherit' : s.short > 0 ? 'muted' : 'starlight'}
          />
        </>
      ) : (
        txt('screens.atelierScreen.wear')
      )}
    </Button>
  );
}

type Said = { id: string; text: string; refused: boolean; n: number } | null;

/** A technique variant: its glyph, name and slot, its words, its price or state. */
function VariantCard({ s, said, onAct }: { s: ShelfItem; said: Said; onAct(s: ShelfItem): void }) {
  const { item, variant } = s;
  const locked = item.state === 'locked';
  return (
    <div
      className={`flex h-full flex-col rounded-xl border p-3 ${locked ? 'border-dashed border-ink-600 bg-ink-900/60' : item.state === 'owned' ? 'border-gold-500/50 bg-ink-800/90' : 'border-ink-600 bg-ink-800/80'}`}
      data-testid={`atelier-item-${item.id}`}
      data-state={item.state}
    >
      <div className="flex items-start gap-2.5">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border"
          style={{
            color: locked ? 'var(--color-muted)' : VARIANT_LOOK.light,
            borderColor: locked ? 'var(--color-ink-500)' : VARIANT_LOOK.color,
            background: locked
              ? undefined
              : `radial-gradient(circle at 50% 45%, color-mix(in srgb, ${VARIANT_LOOK.color} 30%, transparent), rgb(10 16 34 / 0.9) 75%)`,
          }}
          aria-hidden
        >
          {variant && <Icon name={variant.icon} size={18} />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-baseline gap-x-2">
            <b
              className="font-display text-base"
              style={{ color: locked ? 'var(--color-text)' : VARIANT_LOOK.color }}
            >
              {item.name}
            </b>
            {variant && (
              <span className="font-mono text-xs text-muted">
                {variant.slot[0]!.toUpperCase() + variant.slot.slice(1)} · {variant.key}
              </span>
            )}
          </p>
          {variant && <p className="mt-0.5 text-xs leading-snug text-text">{variant.text}</p>}
        </div>
      </div>
      <div className="mt-auto flex min-h-8 items-center justify-between gap-2 pt-2.5">
        <span className="flex items-center gap-2">
          <StatusChip status={s.status} locked={s.item.state === 'locked'} />
          {locked && item.price !== null && <StarlightPrice price={item.price} tone="muted" />}
        </span>
        <ActionButton s={s} onAct={onAct} />
      </div>
      {s.note && (
        <p className="mt-1.5 text-xs leading-snug text-muted" data-testid="item-note">
          {s.note}
        </p>
      )}
      <SaidLine said={said} id={item.id} />
    </div>
  );
}

/** A robe's colours as a little robe: the body, its trim, its glow. */
function RobeSwatch({ colors }: { colors: RobeColors }) {
  return (
    <svg viewBox="0 0 24 24" width={40} height={40} aria-hidden focusable="false">
      <circle cx={12} cy={12} r={11} fill={colors.glow} fillOpacity={0.16} />
      <path
        d="M9.5 3.5c.6 1.2 1.4 1.8 2.5 1.8s1.9-.6 2.5-1.8L18 5l3 5.5-3 1.4-.9-1.6L19 20.5H5l1.9-10.2-.9 1.6L3 10.5 6 5z"
        fill={colors.body}
        stroke={colors.trim}
        strokeWidth={1.1}
        strokeLinejoin="round"
      />
      <path d="M12 5.3v15.2 M5.6 18.6h12.8" stroke={colors.trim} strokeWidth={1.1} />
    </svg>
  );
}

/** A Thread look as a short strand: its glow, its filament (null: Mend's and Empower's own). */
function ThreadSwatch({ colors }: { colors: ThreadColors | null }) {
  const d = 'M3 15 C8 6 12 22 17 12 S21 8 22 9';
  return (
    <svg viewBox="0 0 24 24" width={40} height={40} aria-hidden focusable="false">
      {colors ? (
        <>
          <path
            d={d}
            fill="none"
            stroke={colors.glow}
            strokeOpacity={0.45}
            strokeWidth={4.5}
            strokeLinecap="round"
          />
          <path
            d={d}
            fill="none"
            stroke={colors.filament}
            strokeWidth={1.6}
            strokeLinecap="round"
          />
        </>
      ) : (
        <>
          <path
            d="M3 11 C8 2 12 18 17 8 S21 4 22 5"
            fill="none"
            stroke="var(--color-heal)"
            strokeWidth={1.8}
            strokeLinecap="round"
          />
          <path
            d="M3 17 C8 8 12 24 17 14 S21 10 22 11"
            fill="none"
            stroke="var(--color-amp)"
            strokeWidth={1.8}
            strokeLinecap="round"
          />
        </>
      )}
    </svg>
  );
}

/** A keepsake's swatch: a robe, a strand, or a title's ribbon. */
function Swatch({ kind, id }: { kind: ShopKind; id: string | null }) {
  if (kind === 'robe') return <RobeSwatch colors={id ? robeColors(id) : OWN_ROBE} />;
  if (kind === 'thread') return <ThreadSwatch colors={threadColors(id)} />;
  return (
    <span
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-gold-500/40 text-gold-300"
      aria-hidden
    >
      <Icon name="banner" size={20} />
    </span>
  );
}

/**
 * A robe, a Thread look or a title: tried on when pointed at or focused. Its price is on its Buy
 * button; once it's yours, Wear (and once worn, "Wearing": wear another, or the Weaver's own, to
 * change).
 */
function KeepsakeCard({
  s,
  said,
  tried,
  onTry,
  onAct,
}: {
  s: ShelfItem;
  said: Said;
  tried: boolean;
  onTry(t: Trying): void;
  onAct(s: ShelfItem): void;
}) {
  const { item } = s;
  const locked = item.state === 'locked';
  const tryOn = () => onTry({ kind: item.kind, id: item.id });
  return (
    <div
      className={`flex h-full flex-col rounded-xl border p-2.5 transition-colors ${s.worn ? 'border-gold-400 bg-ink-800/95' : tried ? 'border-gold-500/60 bg-ink-800/90' : locked ? 'border-dashed border-ink-600 bg-ink-900/60' : 'border-ink-600 bg-ink-800/80'}`}
      onPointerEnter={tryOn}
      onFocus={tryOn}
      data-testid={`atelier-item-${item.id}`}
      data-state={item.state}
      data-worn={s.worn}
    >
      <div className="flex items-center gap-2.5">
        <Swatch kind={item.kind} id={item.id} />
        <p
          className={`min-w-0 font-display text-base leading-tight text-text ${item.kind === 'title' ? 'italic' : ''}`}
        >
          {item.name}
        </p>
      </div>
      <div className="mt-auto flex min-h-8 items-center justify-between gap-2 pt-2">
        <span className="flex items-center gap-2">
          <StatusChip status={s.status} worn={s.worn} locked={s.item.state === 'locked'} />
          {locked && item.price !== null && <StarlightPrice price={item.price} tone="muted" />}
        </span>
        <ActionButton s={s} onAct={onAct} />
      </div>
      {s.note && (locked || item.state === 'earned') && (
        <p className="mt-1.5 text-xs leading-snug text-muted" data-testid="item-note">
          {s.note}
        </p>
      )}
      <SaidLine said={said} id={item.id} />
    </div>
  );
}

/** The Weaver's own (her robe, the Thread's own look, no title): free, and always hers. */
function OwnCard({
  shelf,
  said,
  onTry,
  onOwn,
}: {
  shelf: Shelf;
  said: Said;
  onTry(t: Trying): void;
  onOwn(): void;
}) {
  const own = shelf.own!;
  const tryOn = () => onTry({ kind: shelf.kind, id: null });
  return (
    <div
      className={`flex h-full flex-col rounded-xl border p-2.5 ${own.worn ? 'border-gold-400 bg-ink-800/95' : 'border-ink-600 bg-ink-800/80'}`}
      onPointerEnter={tryOn}
      onFocus={tryOn}
      data-testid={`atelier-own-${shelf.kind}`}
      data-worn={own.worn}
    >
      <div className="flex items-center gap-2.5">
        <Swatch kind={shelf.kind} id={null} />
        <div className="min-w-0">
          <p className="font-display text-base leading-tight text-text">{own.name}</p>
          <p className="text-xs text-muted">{txt('screens.atelierScreen.alwaysYours')}</p>
        </div>
      </div>
      <div className="mt-auto flex min-h-8 items-center justify-between gap-2 pt-2">
        <StatusChip
          status={
            own.worn ? txt('screens.atelierScreen.wearing') : txt('screens.atelierScreen.yours')
          }
          worn={own.worn}
        />
        {!own.worn && (
          <Button
            size="sm"
            onClick={onOwn}
            sound={null}
            aria-label={txt('screens.atelierScreen.wear3', {
              replace: own.name.replace(/^The /, 'the '),
            })}
            data-nav
            data-testid={`atelier-own-wear-${shelf.kind}`}
          >
            {txt('screens.atelierScreen.wear')}
          </Button>
        )}
      </div>
      <SaidLine said={said} id={`own-${shelf.kind}`} />
    </div>
  );
}

/** The Atelier from the stores: `shop()`, `buy`, `equip`; Back returns to the Loom. */
export function AtelierScreen() {
  const profile = useProfile((s) => s.profile);
  const unlockAll = useSettings((s) => s.settings.unlockAll);
  const back = useUi((s) => s.back);
  const previous = useUi((s) => s.previous);
  // As the store's `shop()` has them, for this profile and Skip the unlocks; and, with Skip on,
  // as they'd stand without it (what's on sale).
  const rank = rankOf(profile.xp);
  const items = shopItems(profile, rank, unlockAll);
  return (
    <AtelierView
      items={items}
      unskipped={unlockAll ? shopItems(profile, rank, false) : null}
      look={profile.look}
      starlight={profile.starlight}
      onBuy={(id) => useProfile.getState().buy(id)}
      onWear={(slot, id) => useProfile.getState().equip(slot, id)}
      onBack={back}
      backTo={
        previous === 'loom'
          ? txt('screens.atelierScreen.theLoom')
          : txt('screens.atelierScreen.back')
      }
    />
  );
}
