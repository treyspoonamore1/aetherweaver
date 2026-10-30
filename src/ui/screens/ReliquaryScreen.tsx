import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useProfile } from '../../app/profileStore';
import { useSettings } from '../../app/settings';
import { storage } from '../../app/storage';
import { CONTENT, type InscriptionCategory, type RelicRarity } from '../../content';
import { rankOf } from '../../meta/profile';
import {
  carriedRelics,
  carrySlots,
  reliquaryOpen,
  type CraftAction,
  type CraftResult,
  type Reliquary,
  type ReliquaryRelic,
} from '../../meta/reliquary';
import { loadRun } from '../../meta/save';
import { AstrolabeGlyph } from '../kit/AstrolabeGlyph';
import { Backdrop } from '../kit/Backdrop';
import { Button } from '../kit/Button';
import { Icon, type IconName } from '../kit/Icon';
import { KeyCap } from '../kit/KeyCap';
import { Modal } from '../kit/Modal';
import { Panel } from '../kit/Panel';
import { RELIC_RARITY, RelicRarityChip, relicColor } from '../kit/RelicGlyph';
import { Tip } from '../kit/Tip';
import {
  CARRIED_LOOK,
  DISSONANCE_LOOK,
  SHARD_LOOK,
  TEAR_LOOK,
  categoryLook,
  tierLook,
} from '../kit/reliquaryLook';
import { playUi, useMood } from '../kit/sound';
import { useUi } from '../store';
import { CodexView } from './CodexScreen';
import { useAllowance } from './PrepScreen';
import {
  CarriedChip,
  InscriptionList,
  InstabilityBar,
  Materials,
  PanelLabel,
  RELIQUARY_CSS,
  RelicPlate,
  StateChip,
  TierBadge,
} from './ReliquaryParts';
import {
  ACTIONS,
  ACTION_LABEL,
  DISSONATE_ROLL_MS,
  ROLE_LINE,
  actionBlurb,
  attuneChange,
  capacityLine,
  carryChange,
  carryLine,
  carryPlace,
  carrySlotViews,
  categoryOptions,
  craftPreview,
  defaultArg,
  inscriptionOptions,
  instabilityView,
  isFull,
  materialsHow,
  outcomeView,
  releaseView,
  releasedLine,
  relicView,
  rollingLine,
  oddsText,
  shardsText,
  tearsText,
  type ActionId,
  type Chance,
  type CraftEffect,
  type CraftPreview,
  type CraftRecord,
  type OutcomeView,
  type RelicView,
} from './reliquaryModel';

export interface ReliquaryViewProps {
  /** The profile's Reliquary. */
  reliquary: Reliquary;
  rank: number;
  /** Settings → Skip the unlocks is on. */
  unlockAll?: boolean;
  /** The carry slots open now (`carrySlots`). */
  slots: number;
  /** The Reliquary is open (Rank 10, or Skip the unlocks). */
  open?: boolean;
  /** One craft through the profile store: its result (the new Reliquary and what happened). */
  onCraft(uid: string, action: CraftAction, arg?: number | InscriptionCategory): CraftResult;
  /** A relic released: the shards it gave (0 if it couldn't). */
  onRelease(uid: string): number;
  /** The relics to carry, by uid: the first is attuned. */
  onCarry(uids: string[]): void;
  onBack(): void;
  /** Where Back goes ("Prep", "Title"). */
  backTo?: string;
  /** A run under way keeps the relics it embarked with (opened from the Title mid-run). */
  runUnderWay?: boolean;
  /** Opens the Codex's Reliquary page (the rules). */
  onRules?(): void;
  /** UI lab: a relic selected, an action and its choice, a craft just made (or rolling). */
  initialSelected?: string | null;
  initialAction?: ActionId;
  initialArg?: number | InscriptionCategory;
  initialLast?: CraftRecord | null;
  /** UI lab: a Dissonate's roll held mid-swirl. */
  holdRoll?: boolean;
  initialRelease?: boolean;
}

/** How long a craft's effect lasts before the relic settles. */
const FX_MS = 2200;

interface Fx {
  key: number;
  uid: string;
  effect: CraftEffect;
  target: number | null;
}

/**
 * The Reliquary (Phase 4c, docs/phase-4c.md): the relics outlive their runs. The shelf of
 * enshrined relics on the left, the chosen one in the middle (its effect, its Inscriptions, its
 * Instability and Fracture chance), the crafts on the right, each previewed with its cost, its
 * odds and its chance to Fracture before it's made. The carry across the top: the first slot is
 * attuned (its own effect and its Inscriptions), the others lend their Inscriptions.
 */
export function ReliquaryView({
  reliquary: rq,
  rank,
  unlockAll = false,
  slots,
  open = true,
  onCraft,
  onRelease,
  onCarry,
  onBack,
  backTo = 'Title',
  runUnderWay = false,
  onRules,
  initialSelected,
  initialAction = 'inscribe',
  initialArg,
  initialLast = null,
  holdRoll = false,
  initialRelease = false,
}: ReliquaryViewProps) {
  useMood('map');
  const relics = rq.relics;
  const [picked, setPicked] = useState<string | null>(
    initialSelected === undefined ? (relics[0]?.uid ?? null) : initialSelected,
  );
  const selected = relics.some((r) => r.uid === picked) ? picked : (relics[0]?.uid ?? null);
  const [action, setAction] = useState<ActionId>(initialAction);
  const [args, setArgs] = useState<Partial<Record<ActionId, number | InscriptionCategory>>>(
    initialArg === undefined ? {} : { [initialAction]: initialArg },
  );
  const [last, setLast] = useState<CraftRecord | null>(initialLast);
  const [rolling, setRolling] = useState(holdRoll);
  const [fx, setFx] = useState<Fx | null>(() => {
    if (!initialLast || holdRoll) return null;
    const v = outcomeView(initialLast);
    return { key: 1, uid: initialLast.uid, effect: v.effect, target: v.target };
  });
  const [say, setSay] = useState('');
  const [notice, setNotice] = useState<{ where: 'carry' | 'craft'; text: string } | null>(null);
  const [releasing, setReleasing] = useState(initialRelease);
  /** How many crafts this visit has shown: each outcome's key. */
  const [crafts, setCrafts] = useState(0);
  const fxKey = useRef(1);
  const rollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (rollTimer.current) clearTimeout(rollTimer.current);
    },
    [],
  );
  useEffect(() => {
    if (!fx) return;
    const t = setTimeout(() => setFx(null), FX_MS);
    return () => clearTimeout(t);
  }, [fx]);
  // Escape goes back (the release dialog closes itself first).
  useEffect(() => {
    if (releasing) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      onBack();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onBack, releasing]);

  const current = relics.find((r) => r.uid === selected) ?? null;
  // While a Dissonate rolls, the relic shows as it was: the outcome waits for its reveal.
  const relic = rolling && last && current && last.uid === current.uid ? last.before : current;
  const view = relic ? relicView(relic) : null;
  const carried = carriedRelics(rq, slots);
  const place = relic ? carryPlace(rq, relic.uid, slots) : null;
  const choose = (a: ActionId) =>
    relic ? (args[a] !== undefined ? args[a] : defaultArg(rq, relic, a)) : undefined;
  const arg = choose(action);
  const preview =
    relic && view?.craftable && action !== 'release' ? craftPreview(rq, relic, action, arg) : null;
  const shownLast = last && relic && last.uid === relic.uid ? last : null;
  const outcome = shownLast && !rolling ? outcomeView(shownLast) : null;
  const myFx = fx && relic && fx.uid === relic.uid ? fx : null;

  const announce = (text: string) => setSay(text);

  const select = (uid: string) => {
    if (uid === selected) return;
    setPicked(uid);
    setNotice(null);
    setArgs({});
  };

  const playOutcome = (rec: CraftRecord) => {
    const v = outcomeView(rec);
    playUi(v.sound);
    announce(v.announce);
    fxKey.current += 1;
    setFx({ key: fxKey.current, uid: rec.uid, effect: v.effect, target: v.target });
  };

  const craft = () => {
    if (!relic || !preview || rolling) return;
    if (preview.blocked) {
      playUi(preview.blockSound);
      setNotice({ where: 'craft', text: preview.blocked });
      announce(preview.blocked);
      return;
    }
    const result = onCraft(relic.uid, preview.action, preview.arg);
    if (!result.ok) {
      playUi('error');
      setNotice({ where: 'craft', text: result.reason });
      announce(result.reason);
      return;
    }
    setNotice(null);
    const after = result.reliquary.relics.find((r) => r.uid === relic.uid) ?? relic;
    const rec: CraftRecord = {
      uid: relic.uid,
      action: preview.action,
      before: relic,
      after,
      outcome: result.outcome,
      cost: preview.cost,
    };
    setLast(rec);
    setCrafts((n) => n + 1);
    setFx(null);
    if (result.outcome.kind === 'dissonated') {
      // The roll first (its sound and the swirl), then the outcome.
      setRolling(true);
      playUi('dissonate');
      announce(rollingLine(view?.name ?? ''));
      if (rollTimer.current) clearTimeout(rollTimer.current);
      rollTimer.current = setTimeout(() => {
        rollTimer.current = null;
        setRolling(false);
        playOutcome(rec);
      }, DISSONATE_ROLL_MS);
    } else {
      playOutcome(rec);
    }
  };

  const changeCarry = (uid: string, attune = false) => {
    const target = relics.find((r) => r.uid === uid);
    if (!target) return;
    const name = relicView(target).name;
    const change = attune ? attuneChange(rq, uid, slots) : carryChange(rq, uid, slots);
    if ('problem' in change) {
      playUi('error');
      setNotice({ where: 'carry', text: change.problem });
      announce(change.problem);
      return;
    }
    setNotice(null);
    onCarry(change.uids);
    const index = change.uids.indexOf(uid);
    if (index < 0) {
      playUi('back');
      announce(`${name} stays home: it’s out of the carry.`);
    } else {
      playUi('carry');
      announce(
        `${name} is carried in slot ${index + 1}. ${ROLE_LINE[index === 0 ? 'attuned' : 'lends']}.`,
      );
    }
  };

  const release = () => {
    if (!relic) return;
    const at = relics.findIndex((r) => r.uid === relic.uid);
    const next = relics[at + 1] ?? relics[at - 1] ?? null;
    const name = view?.name ?? '';
    const shards = onRelease(relic.uid);
    setReleasing(false);
    if (shards <= 0) {
      playUi('error');
      return;
    }
    playUi('release');
    announce(releasedLine(name, shards));
    setNotice(null);
    setLast(null);
    setPicked(next?.uid ?? null);
  };

  const onShelfKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const moves: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -2,
      ArrowDown: 2,
    };
    const step = moves[e.key];
    if (step === undefined) return;
    const tiles = [...e.currentTarget.querySelectorAll<HTMLButtonElement>('button[data-relic]')];
    const at = tiles.indexOf(document.activeElement as HTMLButtonElement);
    if (at < 0) return;
    const next = tiles[Math.max(0, Math.min(tiles.length - 1, at + step))];
    next?.focus();
    e.preventDefault();
  };

  return (
    <main className="relative h-full w-full overflow-hidden" data-testid="reliquary-screen">
      <Backdrop tone="navy" />
      <style>{RELIQUARY_CSS}</style>
      <div className="scroll-thin relative z-10 flex h-full flex-col overflow-y-auto px-5 pb-4 pt-3 xl:overflow-hidden">
        <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
          <div className="min-w-0">
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-muted">
              Between runs · Weaver Rank {rank}
              {unlockAll && ' · all unlocked'}
            </p>
            <h1 className="flex items-center gap-2 font-display text-3xl font-bold tracking-wide text-gold-300">
              <Icon name="reliquary" size={28} /> The Reliquary
            </h1>
          </div>
          <MaterialsHeader shards={rq.shards} tears={rq.tears} />
          <div className="flex items-center gap-2">
            {onRules && (
              <Button variant="secondary" size="sm" onClick={onRules} sound="click">
                <Icon name="book" size={15} /> Rules
              </Button>
            )}
            <Button variant="ghost" onClick={onBack} sound="back" data-testid="reliquary-back">
              <Icon name="back" size={16} /> {backTo} <KeyCap label="Esc" />
            </Button>
          </div>
        </header>
        {!open && (
          <p className="mt-2 flex items-center gap-2 rounded-lg border border-ink-600 bg-ink-900/80 px-3 py-2 text-sm text-muted">
            <Icon name="lock" size={15} className="text-gold-300" /> The Reliquary opens at Rank{' '}
            {rqOpenRank()}.
          </p>
        )}
        {runUnderWay && (
          <p className="mt-2 flex items-start gap-2 rounded-lg border border-ink-600 bg-ink-900/80 px-3 py-2 text-xs text-muted">
            <Icon name="info" size={14} className="mt-px shrink-0 text-gold-300" />
            Your run under way keeps the relics it embarked with: what you change here is for the
            next one.
          </p>
        )}
        <CarryBar
          carried={carried}
          slots={slots}
          selected={selected}
          onSelect={select}
          onTakeOut={(uid) => changeCarry(uid)}
          onAttune={(uid) => changeCarry(uid, true)}
        />
        <div className="mt-3 grid min-h-0 flex-1 gap-4 lg:grid-cols-2 xl:grid-cols-[23rem_minmax(0,1fr)_24rem]">
          <Panel
            tone="solid"
            className="flex min-h-0 flex-col p-3 lg:col-span-2 xl:col-span-1"
            role="region"
            aria-label="Enshrined relics"
            data-testid="reliquary-shelf"
          >
            <PanelLabel
              right={
                <span
                  className={`font-mono text-xs ${isFull(rq) ? 'text-orange-200' : 'text-muted'}`}
                >
                  {capacityLine(relics.length)}
                  {isFull(rq) ? ' · full' : ''}
                </span>
              }
            >
              Enshrined
            </PanelLabel>
            <div
              className="scroll-thin mt-2 grid min-h-0 flex-1 auto-rows-min grid-cols-2 gap-2 overflow-y-auto p-0.5 lg:grid-cols-4 xl:grid-cols-2"
              onKeyDown={onShelfKey}
              role="group"
              aria-label="Choose a relic"
            >
              {relics.map((r) => {
                const shown = rolling && last?.uid === r.uid ? last.before : r;
                return (
                  <RelicTile
                    key={r.uid}
                    view={relicView(shown)}
                    selected={r.uid === selected}
                    place={carryPlace(rq, r.uid, slots)}
                    rolling={rolling && last?.uid === r.uid}
                    onSelect={() => select(r.uid)}
                  />
                );
              })}
              {Array.from({ length: Math.max(0, capacityOf() - relics.length) }, (_, i) => (
                <div
                  key={`niche${i}`}
                  className="flex h-[3.75rem] items-center justify-center rounded-xl border border-dashed border-ink-600/70 text-ink-500"
                  aria-hidden
                >
                  <Icon name="reliquary" size={18} />
                </div>
              ))}
            </div>
            {relics.length === 0 && (
              <p className="mt-2 text-xs leading-relaxed text-muted" data-testid="reliquary-empty">
                Win a run to enshrine one of the relics it found: its Summary asks which. It arrives
                with its first Inscriptions.
              </p>
            )}
          </Panel>
          {relic && view ? (
            <RelicDetail
              key={relic.uid}
              relic={relic}
              view={view}
              rq={rq}
              place={place}
              preview={preview}
              fx={myFx}
              rolling={rolling && shownLast !== null}
              slots={slots}
              notice={notice?.where === 'carry' ? notice.text : null}
              onCarry={() => changeCarry(relic.uid)}
              onAttune={() => changeCarry(relic.uid, true)}
            />
          ) : (
            <EmptyDetail />
          )}
          <Panel
            tone="solid"
            className="flex min-h-0 flex-col p-3"
            role="region"
            aria-label="Crafting"
            data-testid="craft-panel"
          >
            {relic && view ? (
              <CraftPanel
                rq={rq}
                relic={relic}
                view={view}
                action={action}
                arg={arg}
                preview={preview}
                rolling={rolling}
                outcome={outcome}
                rollingNow={rolling && shownLast !== null}
                notice={notice?.where === 'craft' ? notice.text : null}
                onAction={(a) => {
                  setAction(a);
                  setNotice(null);
                }}
                onArg={(a) => {
                  setArgs((x) => ({ ...x, [action]: a }));
                  setNotice(null);
                }}
                onRefuse={(text) => {
                  playUi('error');
                  setNotice({ where: 'craft', text });
                  announce(text);
                }}
                onCraft={craft}
                onRelease={() => setReleasing(true)}
                outcomeKey={crafts}
              />
            ) : (
              <NothingToCraft />
            )}
          </Panel>
        </div>
      </div>
      <div className="sr-only" role="status" aria-live="polite" data-testid="reliquary-live">
        {say}
      </div>
      {releasing && relic && view && (
        <Modal title={`Release ${view.name}?`} onClose={() => setReleasing(false)} closeOnEscape>
          <p className="mt-3 text-sm leading-relaxed text-text">
            It leaves the Reliquary for good, Inscriptions and all. You get{' '}
            <b className="text-gold-200">{releaseView(relic).line}</b>
          </p>
          {place && (
            <p className="mt-2 text-sm text-orange-200">
              It’s carried (slot {place.index + 1}): it leaves the carry too.
            </p>
          )}
          <div className="mt-5 flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => setReleasing(false)}
              sound="back"
              data-autofocus
            >
              Keep it
            </Button>
            <Button variant="danger" sound={null} onClick={release} data-testid="release-confirm">
              <Icon name="release" size={16} /> Release for {shardsText(releaseView(relic).total)}
            </Button>
          </div>
        </Modal>
      )}
    </main>
  );
}

/** The Rank the Reliquary opens at (its first carry slot's). */
function rqOpenRank(): number {
  return CONTENT.reliquary.slotRanks[0]!;
}

/** How many relics it holds. */
function capacityOf(): number {
  return CONTENT.reliquary.capacity;
}

/** The header's materials, with where they come from on hover or focus. */
function MaterialsHeader({ shards, tears }: { shards: number; tears: number }) {
  const how = materialsHow();
  return (
    <Tip
      align="center"
      width="w-96"
      tip={
        <span className="flex flex-col gap-2 text-xs leading-snug">
          <span className="flex items-start gap-1.5">
            <Icon
              name="shard"
              size={14}
              className="mt-px shrink-0"
              style={{ color: SHARD_LOOK.color }}
            />
            <span>
              <b className="text-text">Tuning Shards</b> pay for Inscribe, Retune and Ascend.{' '}
              <span className="text-muted">{how.shards}</span>
            </span>
          </span>
          <span className="flex items-start gap-1.5">
            <Icon
              name="tear"
              size={14}
              className="mt-px shrink-0"
              style={{ color: TEAR_LOOK.color }}
            />
            <span>
              <b className="text-text">Discord Tears</b> pay for a Dissonate.{' '}
              <span className="text-muted">{how.tears}</span>
            </span>
          </span>
        </span>
      }
    >
      <span
        tabIndex={0}
        className="rounded-xl border border-ink-600 bg-ink-900/80 px-3 py-1.5"
        aria-describedby={undefined}
      >
        <Materials shards={shards} tears={tears} />
      </span>
    </Tip>
  );
}

/** The carry: one slot per Rank that opens one; the first attuned, the others lending. */
function CarryBar({
  carried,
  slots,
  selected,
  onSelect,
  onTakeOut,
  onAttune,
}: {
  carried: readonly ReliquaryRelic[];
  slots: number;
  selected: string | null;
  onSelect(uid: string): void;
  onTakeOut(uid: string): void;
  onAttune(uid: string): void;
}) {
  const views = carrySlotViews(carried, slots);
  return (
    <section
      className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-ink-600/70 bg-ink-900/70 px-3 py-2"
      aria-label="The carry: the relics your next run takes"
      data-testid="carry-bar"
      data-carried={carried.map((r) => r.uid).join(' ')}
    >
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-gold-200">
          <Icon name="carry" size={16} /> Carry into your next run
        </p>
        <p className="font-mono text-xs text-muted">{carryLine(carried.length, slots)}</p>
      </div>
      <ol className="flex flex-1 flex-wrap gap-2">
        {views.map((s) => (
          <li
            key={s.index}
            className={`flex min-w-[14rem] flex-1 items-center gap-2 rounded-lg border px-2 py-1.5 ${s.open ? (s.relic ? 'bg-ink-800/90' : 'border-dashed bg-ink-900/40') : 'border-dashed border-ink-600/60 bg-ink-950/40'}`}
            style={
              s.open && s.relic
                ? {
                    borderColor: s.role === 'attuned' ? CARRIED_LOOK.color : 'var(--color-ink-500)',
                  }
                : { borderColor: s.open ? 'var(--color-ink-500)' : undefined }
            }
            data-testid={`carry-slot-${s.index + 1}`}
            data-open={s.open}
            data-relic={s.relic?.uid ?? ''}
          >
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border font-mono text-xs font-bold ${s.role === 'attuned' && s.open ? 'border-gold-300 text-gold-200' : 'border-ink-500 text-muted'}`}
              aria-hidden
            >
              {s.index + 1}
            </span>
            {!s.open ? (
              <span className="flex items-center gap-1.5 text-xs text-muted">
                <Icon name="lock" size={13} /> {s.lockLine}
              </span>
            ) : s.relic ? (
              <CarrySlotRelic
                relic={s.relic}
                index={s.index}
                selected={s.relic.uid === selected}
                onSelect={onSelect}
                onTakeOut={onTakeOut}
                onAttune={onAttune}
              />
            ) : (
              <span className="text-xs leading-snug text-muted">
                <b className="font-semibold text-text">
                  {s.index === 0 ? 'Attuned slot' : 'Empty'}
                </b>
                <span className="block">{ROLE_LINE[s.role]}</span>
              </span>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

function CarrySlotRelic({
  relic,
  index,
  selected,
  onSelect,
  onTakeOut,
  onAttune,
}: {
  relic: ReliquaryRelic;
  index: number;
  selected: boolean;
  onSelect(uid: string): void;
  onTakeOut(uid: string): void;
  onAttune(uid: string): void;
}) {
  const v = relicView(relic);
  const role = index === 0 ? 'attuned' : 'lends';
  return (
    <span className="flex min-w-0 flex-1 items-center gap-2">
      <button
        type="button"
        onClick={() => onSelect(relic.uid)}
        className={`flex min-w-0 flex-1 items-center gap-2 rounded-md text-left ${selected ? 'text-gold-100' : 'text-text'}`}
        aria-label={`Slot ${index + 1}: ${v.name}. ${ROLE_LINE[role]}. Show it.`}
      >
        <RelicPlate view={v} size={30} />
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold">{v.name}</span>
          <span
            className={`block truncate text-xs ${role === 'attuned' ? 'text-gold-200' : 'text-muted'}`}
          >
            {role === 'attuned' ? 'Attuned: its effect and Inscriptions' : 'Lends its Inscriptions'}
          </span>
        </span>
      </button>
      {index > 0 && (
        <Button
          size="sm"
          variant="ghost"
          className="!gap-1 !px-1.5 !py-1 text-xs"
          onClick={() => onAttune(relic.uid)}
          sound={null}
          aria-label={`Attune ${v.name}: move it to the first slot`}
          title="Attune: move it to the first slot (its own effect wakes)"
          data-testid="slot-attune"
        >
          <Icon name="ascend" size={14} /> Attune
        </Button>
      )}
      <Button
        size="sm"
        variant="ghost"
        className="!px-1.5 !py-1"
        onClick={() => onTakeOut(relic.uid)}
        sound={null}
        aria-label={`Take ${v.name} out of the carry`}
        title="Take it out of the carry"
        data-testid="slot-remove"
      >
        <Icon name="close" size={15} />
      </Button>
    </span>
  );
}

/** One enshrined relic on the shelf. */
function RelicTile({
  view: v,
  selected,
  place,
  rolling,
  onSelect,
}: {
  view: RelicView;
  selected: boolean;
  place: { index: number; role: 'attuned' | 'lends' } | null;
  rolling: boolean;
  onSelect(): void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      onPointerEnter={() => playUi('hover')}
      aria-pressed={selected}
      aria-label={`${v.label}${place ? ` Carried in slot ${place.index + 1}: ${ROLE_LINE[place.role]}.` : ''}`}
      className={`relative flex h-[3.75rem] min-w-0 items-center gap-2.5 rounded-xl border px-2 text-left transition-colors ${selected ? 'border-gold-400 bg-ink-700/90 shadow-[0_0_14px_rgb(245_184_61/0.25)]' : 'border-ink-600/80 bg-ink-900/70 hover:border-ink-500 hover:bg-ink-800'}`}
      data-relic={v.uid}
      data-testid="reliquary-tile"
      data-state={v.state?.label ?? 'craftable'}
      data-carried={place ? String(place.index + 1) : ''}
    >
      <RelicPlate view={v} size={32} rolling={rolling} carried={place?.role ?? null} />
      <RarityMark rarity={v.rarity} cleansed={v.cleansed} />
      <span className="min-w-0 flex-1" aria-hidden>
        <span className="line-clamp-2 pr-4 text-[13px] font-semibold leading-tight text-text">
          {v.name}
        </span>
        <span className="mt-0.5 flex items-center gap-0.5 overflow-hidden">
          {v.state ? (
            <StateChip look={v.state} small />
          ) : v.inscriptions.length > 0 ? (
            v.inscriptions.map((i) => <TierBadge key={i.id} tier={i.tier} size="sm" />)
          ) : (
            <span className="text-[11px] text-muted">No Inscriptions</span>
          )}
        </span>
      </span>
    </button>
  );
}

/**
 * A tile's rarity, small, in its corner: diamonds for a common or a rare, stars for a legendary,
 * a skull (a check once cleansed) for a cursed relic, so the ring's colour is never alone.
 */
function RarityMark({ rarity, cleansed }: { rarity: RelicRarity; cleansed: boolean }) {
  const look = RELIC_RARITY[rarity];
  return (
    <span
      className="absolute right-1.5 top-1.5 flex"
      style={{ color: relicColor(rarity, cleansed) }}
      aria-hidden
    >
      {rarity === 'cursed' ? (
        <Icon name={cleansed ? 'check' : 'skull'} size={10} />
      ) : (
        Array.from({ length: look.pips }, (_, i) => (
          <Icon
            key={i}
            name={rarity === 'legendary' ? 'star' : 'diamond'}
            size={8}
            solid
            className="-mr-px"
          />
        ))
      )}
    </span>
  );
}

/** The crafting panel before there's a relic: what pays for crafting, and where it comes from. */
function NothingToCraft() {
  const how = materialsHow();
  return (
    <div className="flex flex-col gap-3 text-sm" data-testid="craft-empty">
      <p className="text-muted">Nothing to craft yet. What crafting costs comes from your runs:</p>
      <p className="flex items-start gap-2">
        <Icon
          name="shard"
          size={16}
          className="mt-0.5 shrink-0"
          style={{ color: SHARD_LOOK.color }}
        />
        <span>
          <b className="text-text">Tuning Shards</b> pay for Inscribe, Retune and Ascend.{' '}
          <span className="text-muted">{how.shards}</span>
        </span>
      </p>
      <p className="flex items-start gap-2">
        <Icon
          name="tear"
          size={16}
          className="mt-0.5 shrink-0"
          style={{ color: TEAR_LOOK.color }}
        />
        <span>
          <b className="text-text">Discord Tears</b> pay for a Dissonate.{' '}
          <span className="text-muted">{how.tears}</span>
        </span>
      </p>
    </div>
  );
}

function EmptyDetail() {
  return (
    <Panel tone="solid" className="flex min-h-0 flex-col p-5" data-testid="reliquary-detail">
      <h2 className="font-display text-xl font-bold text-gold-200">
        Relics that outlive their runs
      </h2>
      <ul className="mt-3 flex flex-col gap-2.5 text-sm leading-relaxed text-text">
        <li className="flex gap-2">
          <Icon name="crown" size={16} className="mt-0.5 shrink-0 text-gold-300" />
          <span>
            <b>Enshrine.</b> A won run’s Summary lets you keep one relic it found. It arrives with
            its first Inscriptions.
          </span>
        </li>
        <li className="flex gap-2">
          <Icon name="inscribe" size={16} className="mt-0.5 shrink-0 text-gold-300" />
          <span>
            <b>Craft.</b> Inscribe, Retune and Ascend for Tuning Shards; each shows its cost, its
            odds and its chance to Fracture first. Dissonate is the last gamble, for a Discord Tear.
          </span>
        </li>
        <li className="flex gap-2">
          <Icon name="carry" size={16} className="mt-0.5 shrink-0 text-gold-300" />
          <span>
            <b>Carry.</b> The relic in the first slot is attuned: its own effect and its
            Inscriptions. The others lend their Inscriptions.
          </span>
        </li>
      </ul>
    </Panel>
  );
}

/** The chosen relic: what it does, its Inscriptions, its Instability, its place in the carry. */
function RelicDetail({
  relic,
  view: v,
  rq,
  place,
  preview,
  fx,
  rolling,
  slots,
  notice,
  onCarry,
  onAttune,
}: {
  relic: ReliquaryRelic;
  view: RelicView;
  rq: Reliquary;
  place: { index: number; role: 'attuned' | 'lends' } | null;
  preview: CraftPreview | null;
  fx: Fx | null;
  rolling: boolean;
  slots: number;
  notice: string | null;
  onCarry(): void;
  onAttune(): void;
}) {
  const dormant = place?.role === 'lends';
  const after = preview && !preview.blocked ? preview.instability.to : null;
  // After a craft, the line it changed comes into view (calmly with reduced motion).
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const box = scroller.current;
    // The last line it touched: a new Inscription, or a Cursed relic's curse after its rises.
    const marked = fx ? box?.querySelectorAll<HTMLElement>('[data-fx]') : undefined;
    const el = marked && marked.length > 0 ? marked[marked.length - 1] : null;
    if (!box || !el) return;
    // Only this panel scrolls (scrollIntoView would move the screen around it too).
    const b = box.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const by =
      r.bottom > b.bottom ? r.bottom - b.bottom + 8 : r.top < b.top ? r.top - b.top - 8 : 0;
    const calm = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (by !== 0) box.scrollBy({ top: by, behavior: calm ? 'auto' : 'smooth' });
  }, [fx]);
  const plateFx = fx && fx.target === null ? fx.effect : null;
  const carryProblem = !place ? carryWhyNot(rq, relic.uid, slots) : null;
  return (
    <Panel
      tone="solid"
      className="flex min-h-0 flex-col p-4"
      data-testid="reliquary-detail"
      data-relic={v.uid}
      role="region"
      aria-label={`${v.name}: its effect, Inscriptions and Instability`}
    >
      <div ref={scroller} className="scroll-thin -mr-1 min-h-0 flex-1 overflow-y-auto pr-1">
        <div className="flex items-start gap-3">
          <RelicPlate
            key={fx?.key ?? 0}
            view={v}
            size={60}
            effect={plateFx}
            rolling={rolling}
            carried={place?.role ?? null}
          />
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-xl font-bold leading-tight text-gold-100">{v.name}</h2>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <RelicRarityChip rarity={v.rarity} cleansed={v.cleansed} />
              {v.state && <StateChip look={v.state} />}
              {place && <CarriedChip index={place.index} role={place.role} />}
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            {!place && (
              <Button
                size="sm"
                variant="secondary"
                onClick={onCarry}
                sound={null}
                aria-disabled={carryProblem !== null || undefined}
                data-testid="carry-toggle"
                title={carryProblem ?? 'Carry it into your next run'}
              >
                <Icon name="carry" size={15} /> Carry
              </Button>
            )}
            {place && place.index > 0 && (
              <Button
                size="sm"
                variant="secondary"
                onClick={onAttune}
                sound={null}
                data-testid="attune"
              >
                <Icon name="ascend" size={15} /> Attune
              </Button>
            )}
            {place && (
              <Button
                size="sm"
                variant="ghost"
                onClick={onCarry}
                sound={null}
                data-testid="carry-toggle"
              >
                <Icon name="close" size={14} /> Take out
              </Button>
            )}
          </div>
        </div>
        {notice ? (
          <p
            className="mt-2 flex items-start gap-1.5 rounded-lg border border-threat/50 bg-threat/10 px-2.5 py-1.5 text-xs text-orange-100"
            data-testid="carry-problem"
          >
            <Icon name="info" size={13} className="mt-px shrink-0 text-threat" />
            {notice}
          </p>
        ) : (
          carryProblem && (
            <p
              className="mt-2 flex items-start gap-1.5 text-xs text-muted"
              data-testid="carry-why-not"
            >
              <Icon name="info" size={13} className="mt-px shrink-0 text-gold-300" />
              {carryProblem}
            </p>
          )
        )}
        <div className="mt-3">
          <PanelLabel
            right={
              dormant ? (
                <span className="text-muted">sleeps while it’s dormant</span>
              ) : v.empowered ? (
                <span style={{ color: DISSONANCE_LOOK.empowered.color }}>Empowered</span>
              ) : undefined
            }
          >
            Its own effect
          </PanelLabel>
          <p
            className={`mt-1 text-sm leading-relaxed ${dormant ? 'text-muted line-through decoration-1' : 'text-text'}`}
            data-testid="relic-effect"
          >
            {v.text}
          </p>
          {v.wasText && (
            <p className="mt-0.5 text-xs text-muted">
              Before it was Empowered: <span className="line-through">{v.wasText}</span>
            </p>
          )}
          {v.ownCurse && (
            <p
              className={`mt-1 flex items-start gap-1.5 text-xs leading-snug ${v.ownCurse.lifted || dormant ? 'text-muted' : 'text-rose-200'}`}
            >
              <Icon
                name={v.ownCurse.lifted ? 'check' : 'skull'}
                size={13}
                className="mt-px shrink-0"
              />
              <span>
                <b>{v.ownCurse.lifted ? 'Curse lifted: ' : 'Its curse: '}</b>
                <span className={v.ownCurse.lifted || dormant ? 'line-through' : ''}>
                  {v.ownCurse.text}
                </span>
              </span>
            </p>
          )}
          {dormant && (
            <p className="mt-1.5 text-xs text-muted">
              In slot {place!.index + 1} it’s dormant: its own effect sleeps, and it lends its
              Inscriptions. Attune it to wake it.
            </p>
          )}
        </div>
        <div className="mt-3">
          <InstabilityBar view={instabilityView(relic, after)} />
          <p
            className={`mt-1 text-xs ${v.fracture > 0 && v.craftable ? 'font-semibold text-orange-200' : 'text-muted'}`}
            data-testid="fracture-line"
            data-fracture={v.fracture}
          >
            {instabilityView(relic).fractureLine}
          </p>
        </div>
        <div className="mt-3">
          <PanelLabel
            right={
              <span className="font-mono text-xs text-muted">
                {v.used} of {v.max}
                {v.dissonant ? ' + 1 Dissonant' : ''}
              </span>
            }
          >
            Inscriptions
          </PanelLabel>
          <InscriptionList
            className="mt-1.5"
            view={v}
            effect={fx ? { effect: fx.effect, target: fx.target } : null}
            fxKey={fx?.key}
          />
          {v.craftable && v.used < v.max && (
            <p className="mt-1.5 text-xs text-muted">
              {v.max - v.used} {v.max - v.used === 1 ? 'slot' : 'slots'} free: Inscribe adds one.
            </p>
          )}
        </div>
      </div>
    </Panel>
  );
}

/** Why a relic can't be carried right now (shown before a click), or null. */
function carryWhyNot(rq: Reliquary, uid: string, slots: number): string | null {
  const c = carryChange(rq, uid, slots);
  return 'problem' in c ? c.problem : null;
}

const ACTION_ICON: Readonly<Record<ActionId, IconName>> = {
  inscribe: 'inscribe',
  retune: 'tune',
  ascend: 'ascend',
  dissonate: 'dissonate',
  release: 'release',
};

/** The crafts: a tab each, the choice it needs, its preview, the button, and what happened. */
function CraftPanel({
  rq,
  relic,
  view: v,
  action,
  arg,
  preview,
  rolling,
  rollingNow,
  outcome,
  notice,
  onAction,
  onArg,
  onRefuse,
  onCraft,
  onRelease,
  outcomeKey,
}: {
  rq: Reliquary;
  relic: ReliquaryRelic;
  view: RelicView;
  action: ActionId;
  arg: number | InscriptionCategory | undefined;
  preview: CraftPreview | null;
  rolling: boolean;
  rollingNow: boolean;
  outcome: OutcomeView | null;
  notice: string | null;
  onAction(a: ActionId): void;
  onArg(a: number | InscriptionCategory): void;
  onRefuse(text: string): void;
  onCraft(): void;
  onRelease(): void;
  /** Changes with each craft shown, to bring its outcome into view. */
  outcomeKey?: number;
}) {
  const panel = useRef<HTMLDivElement>(null);
  // A new outcome comes into view (only this panel scrolls; calmly with reduced motion).
  useEffect(() => {
    const box = panel.current;
    const el = box?.querySelector<HTMLElement>('[data-testid="craft-outcome"]');
    if (!box || !el) return;
    const b = box.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    if (r.bottom <= b.bottom) return;
    const calm = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    box.scrollBy({ top: r.bottom - b.bottom + 8, behavior: calm ? 'auto' : 'smooth' });
  }, [outcomeKey, rollingNow]);
  const onTabsKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const i = ACTIONS.indexOf(action);
    const next = ACTIONS[(i + (e.key === 'ArrowRight' ? 1 : ACTIONS.length - 1)) % ACTIONS.length]!;
    onAction(next);
    e.currentTarget.querySelector<HTMLElement>(`#craft-tab-${next}`)?.focus();
    e.preventDefault();
  };
  return (
    <>
      <div
        role="tablist"
        aria-label="Crafts"
        onKeyDown={onTabsKey}
        className="grid grid-cols-5 gap-1 rounded-lg bg-ink-900/80 p-1"
      >
        {ACTIONS.map((a) => (
          <button
            key={a}
            id={`craft-tab-${a}`}
            role="tab"
            type="button"
            aria-selected={action === a}
            aria-controls="craft-tabpanel"
            tabIndex={action === a ? 0 : -1}
            onClick={() => onAction(a)}
            className={`flex flex-col items-center gap-0.5 rounded-md px-1 py-1 text-[11px] font-semibold transition-colors ${action === a ? 'bg-gold-400 text-ink-950' : 'text-muted hover:bg-ink-700 hover:text-text'}`}
            data-testid={`craft-tab-${a}`}
          >
            <Icon name={ACTION_ICON[a]} size={16} />
            {ACTION_LABEL[a]}
          </button>
        ))}
      </div>
      <div
        ref={panel}
        id="craft-tabpanel"
        role="tabpanel"
        aria-labelledby={`craft-tab-${action}`}
        className="scroll-thin -mr-1 mt-2 min-h-0 flex-1 overflow-y-auto pr-1"
      >
        <p className="text-xs leading-snug text-muted">{actionBlurb(action)}</p>
        {rollingNow ? (
          // The roll: nothing to choose until its outcome is revealed.
          <OutcomeCard outcome={null} rolling name={v.name} />
        ) : action === 'release' ? (
          <ReleaseBody relic={relic} onRelease={onRelease} />
        ) : !v.craftable ? (
          !outcome && (
            <p
              className="mt-3 flex items-start gap-2 rounded-lg border border-ink-500 bg-ink-900/70 px-3 py-2 text-sm text-text"
              data-testid="craft-frozen"
            >
              {v.state && (
                <Icon
                  name={v.state.icon}
                  size={16}
                  className="mt-0.5 shrink-0"
                  style={{ color: v.state.color }}
                />
              )}
              <span>{v.frozen} It still works, and can still be carried or released.</span>
            </p>
          )
        ) : (
          <>
            {action === 'inscribe' && (
              <CategoryChooser rq={rq} relic={relic} arg={arg} onArg={onArg} onRefuse={onRefuse} />
            )}
            {(action === 'retune' || action === 'ascend') && (
              <InscriptionChooser
                rq={rq}
                relic={relic}
                action={action}
                arg={arg}
                onArg={onArg}
                onRefuse={onRefuse}
              />
            )}
            {preview && <PreviewBox preview={preview} rq={rq} />}
            {preview && (
              <CommitBar preview={preview} rolling={rolling} notice={notice} onCraft={onCraft} />
            )}
          </>
        )}
        {outcome && !rollingNow && (
          <OutcomeCard key={outcomeKey} outcome={outcome} rolling={false} name={v.name} />
        )}
      </div>
    </>
  );
}

/**
 * Inscribe's choice of kind: one button each, in its colour and glyph; a kind it can't take is
 * disabled, its reason written under the row (and said on a click).
 */
function CategoryChooser({
  rq,
  relic,
  arg,
  onArg,
  onRefuse,
}: {
  rq: Reliquary;
  relic: ReliquaryRelic;
  arg: number | InscriptionCategory | undefined;
  onArg(a: InscriptionCategory): void;
  onRefuse(text: string): void;
}) {
  const options = categoryOptions(rq, relic);
  const blocked = options.filter((o) => o.blocked);
  return (
    <div className="mt-2">
      <div
        className="grid grid-cols-5 gap-1"
        role="group"
        aria-label="Choose a kind of Inscription"
      >
        {options.map((o) => {
          const look = categoryLook(o.category);
          const chosen = arg === o.category;
          return (
            <button
              key={o.category}
              type="button"
              aria-pressed={chosen}
              aria-disabled={o.blocked !== null || undefined}
              aria-label={`${o.name}, ${o.blurb}: ${o.blocked ?? `${o.left.length} left: ${o.left.join(', ')}`}`}
              title={o.blocked ?? `${o.blurb}: ${o.left.join(', ')}`}
              onClick={() => (o.blocked ? onRefuse(o.blocked) : onArg(o.category))}
              className={`relative flex min-w-0 flex-col items-center gap-0.5 rounded-lg border px-1 py-1.5 text-[11px] font-semibold transition-colors ${o.blocked ? 'cursor-not-allowed border-dashed border-ink-600 bg-ink-950/40' : chosen ? 'bg-ink-700' : 'border-ink-600 bg-ink-900/70 hover:bg-ink-800'}`}
              style={{
                color: o.blocked ? 'var(--color-muted)' : look.color,
                ...(chosen && !o.blocked
                  ? { borderColor: look.color, boxShadow: `0 0 0 1px ${look.color}` }
                  : {}),
              }}
              data-category={o.category}
              data-blocked={o.blocked ?? ''}
            >
              {o.blocked ? (
                <Icon name="lock" size={15} />
              ) : (
                <AstrolabeGlyph glyph={look.glyph} size={15} />
              )}
              {o.name}
              <span className="font-mono font-normal text-muted">{o.left.length} left</span>
            </button>
          );
        })}
      </div>
      {blocked.map((o) => (
        <p
          key={o.category}
          className="mt-1 flex items-center gap-1 text-[11px] text-muted"
          data-testid="category-blocked"
        >
          <Icon name="lock" size={11} /> {o.name}: {o.blocked}
        </p>
      ))}
    </div>
  );
}

/** Retune's and Ascend's choice: each Inscription with its odds, or why it can't. */
function InscriptionChooser({
  rq,
  relic,
  action,
  arg,
  onArg,
  onRefuse,
}: {
  rq: Reliquary;
  relic: ReliquaryRelic;
  action: 'retune' | 'ascend';
  arg: number | InscriptionCategory | undefined;
  onArg(a: number): void;
  onRefuse(text: string): void;
}) {
  const options = inscriptionOptions(rq, relic, action);
  if (options.length === 0)
    return <p className="mt-2 text-sm text-muted">It has no Inscription yet: Inscribe first.</p>;
  return (
    <ul className="mt-2 flex flex-col gap-1" role="group" aria-label="Choose an Inscription">
      {options.map((o) => {
        const chosen = arg === o.index;
        return (
          <li key={o.row.id}>
            <button
              type="button"
              aria-pressed={chosen}
              aria-disabled={o.blocked !== null || undefined}
              aria-label={`${o.row.label} ${o.blocked ?? (action === 'ascend' ? `Rises to T${o.to}: ${o.pText}.` : `A higher value: ${o.pText}.`)}`}
              onClick={() => (o.blocked ? onRefuse(o.blocked) : onArg(o.index))}
              className={`flex w-full items-center gap-2 rounded-lg border px-2 py-1 text-left transition-colors ${o.blocked ? 'cursor-not-allowed border-dashed border-ink-600 bg-ink-950/40' : chosen ? 'border-gold-400 bg-ink-700' : 'border-ink-600 bg-ink-900/70 hover:bg-ink-800'}`}
              data-index={o.index}
              data-blocked={o.blocked ?? ''}
              data-p={o.p}
            >
              <TierBadge tier={o.row.tier} size="sm" />
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-text">
                {o.row.name}{' '}
                <span className="font-mono text-xs font-normal">{o.row.valueText}</span>
              </span>
              {o.blocked ? (
                <span className="flex shrink-0 items-center gap-1 text-[11px] text-orange-200">
                  <Icon name="lock" size={11} /> {o.blocked}
                </span>
              ) : action === 'ascend' ? (
                <span className="shrink-0 text-[11px] text-muted">
                  → T{o.to} <b className="font-mono text-gold-200">{o.pText}</b>
                </span>
              ) : (
                <span className="shrink-0 text-[11px] text-muted">
                  {o.row.rangeText} · <b className="font-mono text-gold-200">{o.pText}</b> higher
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** A chance as a labelled bar: "T5 ▮▮▮▮▮▮░░ 60%". */
function ChanceRow({ c, color, icon }: { c: Chance; color: string; icon?: IconName }) {
  return (
    <li className="text-xs" data-chance={c.key} data-p={c.p}>
      <span className="flex items-center gap-2">
        <span
          className="flex w-24 shrink-0 items-center gap-1 truncate font-semibold"
          style={{ color }}
        >
          {icon && <Icon name={icon} size={12} />}
          {c.label}
        </span>
        <span className="relative h-2 flex-1 overflow-hidden rounded-full bg-ink-700" aria-hidden>
          <span
            className="absolute inset-y-0 left-0 rounded-full"
            style={{ width: `${c.p * 100}%`, background: color }}
          />
        </span>
        <span className="w-12 shrink-0 text-right font-mono text-text">{c.text}</span>
      </span>
      {c.detail && <span className="mt-0.5 block pl-0 leading-snug text-muted">{c.detail}</span>}
    </li>
  );
}

function chanceLook(c: Chance): { color: string; icon?: IconName } {
  if (/^t\d$/.test(c.key)) return { color: tierLook(Number(c.key.slice(1))).color };
  if (c.key in DISSONANCE_LOOK) {
    const look = DISSONANCE_LOOK[c.key as keyof typeof DISSONANCE_LOOK];
    return { color: look.color, icon: look.icon };
  }
  if (c.key === 'rise' || c.key === 'higher') return { color: '#fcd98a' };
  if (c.key === 'miss' || c.key === 'lower') return { color: '#fda4af' };
  return { color: '#cbd5e1' };
}

/** Before a craft: what it costs, its odds, its chance to Fracture and what's at stake. */
function PreviewBox({ preview: p, rq }: { preview: CraftPreview; rq: Reliquary }) {
  const tearCost = p.cost.tears > 0;
  const have = tearCost ? rq.tears : rq.shards;
  return (
    <div
      className="mt-2 rounded-xl border border-ink-600 bg-ink-900/70 p-2.5"
      data-testid="craft-preview"
      data-action={p.action}
      data-shards={p.cost.shards}
      data-tears={p.cost.tears}
      data-fracture={p.odds.fracture}
      data-instability={p.instability.to}
    >
      <dl className="grid grid-cols-3 gap-2 text-xs">
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted">Cost</dt>
          <dd
            className={`mt-0.5 flex items-center gap-1 font-mono text-sm font-bold ${p.canPay ? 'text-text' : 'text-orange-200'}`}
            title={`${p.costText}; you have ${tearCost ? tearsText(rq.tears) : shardsText(rq.shards)}`}
          >
            <Icon
              name={tearCost ? 'tear' : 'shard'}
              size={14}
              style={{ color: tearCost ? TEAR_LOOK.color : SHARD_LOOK.color }}
            />
            {tearCost ? p.cost.tears : p.cost.shards}
            <span className="text-xs font-normal text-muted">of {have}</span>
          </dd>
        </div>
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted">
            Fracture
          </dt>
          <dd
            className={`mt-0.5 font-mono text-sm font-bold ${p.odds.fracture > 0 ? 'text-orange-200' : 'text-text'}`}
            data-testid="preview-fracture"
          >
            {p.action === 'dissonate' ? 'none' : p.fractureText}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted">
            Instability
          </dt>
          <dd className="mt-0.5 font-mono text-sm font-bold text-text">
            {p.instability.from === p.instability.to
              ? p.instability.from
              : `${p.instability.from} → ${p.instability.to}`}
          </dd>
          {p.action !== 'dissonate' && (
            <dd className="text-[11px] leading-tight text-muted">
              next craft{' '}
              <b className={p.nextFracture > 0 ? 'text-orange-200' : 'text-text'}>
                {oddsText(p.nextFracture)}
              </b>
            </dd>
          )}
        </div>
      </dl>
      <p className="sr-only">
        Costs {p.costText}; you have {tearCost ? tearsText(rq.tears) : shardsText(rq.shards)}.
      </p>
      {p.chances.length > 0 && p.overall && (
        <p className="mt-2 border-t border-ink-600/70 pt-1.5 text-[11px] text-muted">
          If it doesn’t Fracture:
        </p>
      )}
      {p.chances.length > 0 && (
        <ul
          className={`flex flex-col gap-1 ${p.overall ? 'mt-1' : 'mt-2 border-t border-ink-600/70 pt-2'}`}
          aria-label={p.overall ? 'Odds if it doesn’t Fracture' : 'Odds'}
        >
          {p.chances.map((c) => {
            const look = chanceLook(c);
            return <ChanceRow key={c.key} c={c} color={look.color} icon={look.icon} />;
          })}
        </ul>
      )}
      {p.overall && (
        <p
          className="mt-1.5 text-[11px] font-semibold text-orange-100"
          data-testid="preview-overall"
        >
          Overall: {p.overall.map((o) => `${o.label} ${o.text}`).join(', ')}.
        </p>
      )}
      {p.stakes.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1 border-t border-ink-600/70 pt-2 text-[11px] leading-snug text-muted">
          {p.stakes.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** The craft's button, and why it can't be made when it can't. */
function CommitBar({
  preview: p,
  rolling,
  notice,
  onCraft,
}: {
  preview: CraftPreview;
  rolling: boolean;
  notice: string | null;
  onCraft(): void;
}) {
  const reason = p.blocked ?? notice;
  const tearCost = p.cost.tears > 0;
  return (
    <div className="mt-2">
      {reason && (
        <p
          className="mb-1.5 flex items-start gap-1.5 text-xs font-semibold text-orange-200"
          data-testid="craft-blocked"
        >
          <Icon name="lock" size={13} className="mt-px shrink-0" />
          {reason}
        </p>
      )}
      <Button
        variant={p.blocked ? 'secondary' : 'primary'}
        className="w-full"
        onClick={onCraft}
        sound={null}
        aria-disabled={p.blocked !== null || rolling || undefined}
        aria-label={p.label}
        data-testid="craft-commit"
      >
        <Icon name={ACTION_ICON[p.action]} size={16} />
        {p.verb}
        <span
          className={`ml-1 inline-flex items-center gap-1 rounded-md px-1.5 py-px text-xs ${p.blocked ? 'bg-ink-700 text-muted' : 'bg-ink-950/20'}`}
        >
          <Icon name={tearCost ? 'tear' : 'shard'} size={12} />
          {tearCost ? p.cost.tears : p.cost.shards}
        </span>
      </Button>
    </div>
  );
}

/** What a craft did: its outcome, or a Dissonate still rolling. */
function OutcomeCard({
  outcome,
  rolling,
  name,
}: {
  outcome: OutcomeView | null;
  rolling: boolean;
  name: string;
}) {
  if (rolling || !outcome) {
    return (
      <div
        className="mt-3 flex items-center gap-2 rounded-xl border border-dashed px-3 py-2.5 text-sm"
        style={{
          borderColor: DISSONANCE_LOOK.dissonant.color,
          color: DISSONANCE_LOOK.dissonant.color,
        }}
        data-testid="craft-outcome"
        data-kind="rolling"
      >
        <Icon name="dissonate" size={18} /> {rollingLine(name)}
      </div>
    );
  }
  const color = outcomeColor(outcome);
  return (
    <div
      className="rq-pop mt-3 rounded-xl border px-3 py-2.5"
      style={{
        borderColor: `color-mix(in srgb, ${color} 60%, transparent)`,
        background: `linear-gradient(120deg, color-mix(in srgb, ${color} 14%, rgb(10 16 34 / 0.9)), rgb(10 16 34 / 0.85) 70%)`,
      }}
      data-testid="craft-outcome"
      data-kind={outcome.kind}
    >
      <p className="flex items-start gap-2 text-sm font-semibold" style={{ color }}>
        <Icon name={outcomeIcon(outcome)} size={17} className="mt-px shrink-0" />
        {outcome.title}
      </p>
      {outcome.lines.length > 0 && (
        <ul className="mt-1 flex flex-col gap-0.5 pl-6 text-xs leading-snug text-text">
          {outcome.lines.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function outcomeColor(o: OutcomeView): string {
  switch (o.kind) {
    case 'dissonant':
    case 'empowered':
    case 'cursed':
    case 'shattered':
      return DISSONANCE_LOOK[o.kind].color;
    case 'fractured':
      return '#fdba74';
    case 'missed':
      return '#fda4af';
    default:
      return '#fcd98a';
  }
}

function outcomeIcon(o: OutcomeView): IconName {
  switch (o.kind) {
    case 'inscribed':
      return 'inscribe';
    case 'retuned':
      return 'tune';
    case 'ascended':
      return 'ascend';
    case 'missed':
      return 'close';
    case 'fractured':
      return 'crack';
    case 'dissonant':
    case 'empowered':
    case 'cursed':
    case 'shattered':
      return DISSONANCE_LOOK[o.kind].icon;
    default:
      return 'sparkle';
  }
}

/** Release: what it gives, and the button that asks first. */
function ReleaseBody({ relic, onRelease }: { relic: ReliquaryRelic; onRelease(): void }) {
  const r = releaseView(relic);
  return (
    <div className="mt-2 flex flex-col gap-2" data-testid="release-panel" data-shards={r.total}>
      <p className="flex items-start gap-2 rounded-xl border border-ink-600 bg-ink-900/70 px-3 py-2 text-sm text-text">
        <Icon
          name="shard"
          size={16}
          className="mt-0.5 shrink-0"
          style={{ color: SHARD_LOOK.color }}
        />
        <span>
          Releasing it gives <b className="text-gold-200">{r.line}</b>
        </span>
      </p>
      <Button variant="danger" onClick={onRelease} sound="click" data-testid="release-open">
        <Icon name="release" size={16} /> Release · {shardsText(r.total)}
      </Button>
    </div>
  );
}

/**
 * The Reliquary from the stores: Title → Reliquary → Title, Prep → Reliquary → Prep. Crafting,
 * releasing and the carry go through the profile store; "Rules" opens the Codex's page in place,
 * so Back still knows where it came from.
 */
export function ReliquaryScreen() {
  const reliquary = useProfile((s) => s.profile.reliquary);
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
  if (codex) {
    return (
      <CodexView
        onBack={() => setCodex(false)}
        initialTab="reliquary"
        allowance={allowance}
        rank={rank}
        deeds={{ earned: deeds, best: deedBest }}
      />
    );
  }
  return (
    <ReliquaryView
      reliquary={reliquary}
      rank={rank}
      unlockAll={unlockAll}
      slots={carrySlots(rank, unlockAll)}
      open={reliquaryOpen(rank, unlockAll)}
      onCraft={(uid, action, arg) => useProfile.getState().craft(uid, action, arg)}
      onRelease={(uid) => useProfile.getState().releaseRelic(uid)}
      onCarry={(uids) => useProfile.getState().setCarry(uids)}
      onBack={back}
      backTo={previous === 'run' ? 'Prep' : 'Title'}
      runUnderWay={runUnderWay}
      onRules={() => setCodex(true)}
    />
  );
}
