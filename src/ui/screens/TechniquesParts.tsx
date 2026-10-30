import { useState, type KeyboardEvent } from 'react';
import type { RunState } from '../../meta/types';
import { Button } from '../kit/Button';
import { Icon } from '../kit/Icon';
import { KeyCap } from '../kit/KeyCap';
import { playUi } from '../kit/sound';
import { VARIANT_LOOK, VARIANT_SOUNDS } from '../kit/variantLook';
import type { TechniqueKey } from '../types';
import {
  cooldownLabel,
  costLabel,
  defaultName,
  slotCooldown,
  slotCost,
  stepOption,
  techniqueClick,
  techniqueSlots,
  techniquesSummary,
  type OptionState,
  type TechniqueOption,
  type TechniqueSlotView,
} from './variantsModel';

/** Prep's panel open or folded, remembered between visits (a convenience: no save needed). */
const FOLD_KEY = 'aetherweaver.prep.techniques';

function storedExpanded(): boolean | null {
  try {
    const v = typeof localStorage === 'undefined' ? null : localStorage.getItem(FOLD_KEY);
    return v === 'open' ? true : v === 'folded' ? false : null;
  } catch {
    return null;
  }
}

function storeExpanded(open: boolean): void {
  try {
    localStorage.setItem(FOLD_KEY, open ? 'open' : 'folded');
  } catch {
    // Private mode: it opens as it likes next time.
  }
}

export interface PrepTechniquesProps {
  /** What the run plays (`run.techniques`, which follows the profile in Prep) and its Calling. */
  run: Pick<RunState, 'techniques' | 'calling'>;
  /** The variants the profile owns. */
  owned: readonly string[];
  /** Settings → Skip the unlocks: every variant can be chosen. */
  all: boolean;
  /** The profile store's `setTechnique` (the run in Prep follows it). */
  onChoose(slot: TechniqueKey, id: string | null): void;
  /** Opens the Codex's Techniques page. */
  onRules?(): void;
  /**
   * Open or folded at first (default: as last left, else open when a variant can be chosen).
   * The UI lab sets it.
   */
  expanded?: boolean;
  className?: string;
}

/**
 * Prep's techniques (Phase 4f, docs/phase-4f.md): each slot (Ward Q, Chime E, Reel F, Glide
 * Space) with its default and its two variants, their names and texts from content, the one the
 * run plays marked. A slot is a radio group: click, or the arrow keys, which skip what's locked.
 * A locked variant says how it's had, and a click on it says so again, changing nothing. On a
 * Chronomancer run Rewind takes Reel's slot: the Reel choice is kept but has no effect. Folded,
 * it's one line of what the four keys play.
 */
export function PrepTechniquesPanel({
  run,
  owned,
  all,
  onChoose,
  onRules,
  expanded,
  className = '',
}: PrepTechniquesProps) {
  const slots = techniqueSlots({
    techniques: run.techniques,
    owned,
    all,
    callingId: run.calling?.id ?? null,
  });
  const summary = techniquesSummary(owned, all);
  const [open, setOpen] = useState(() => expanded ?? storedExpanded() ?? summary.choosable);
  const [said, setSaid] = useState<{ text: string; locked: boolean } | null>(null);
  const toggle = () => {
    setOpen(!open);
    storeExpanded(!open);
  };
  const pick = (view: TechniqueSlotView, option: TechniqueOption) => {
    const action = techniqueClick(view, option);
    if (action.kind === 'none') return;
    if (action.kind === 'locked') {
      playUi(VARIANT_SOUNDS.locked);
      setSaid({ text: action.announce, locked: true });
      return;
    }
    playUi(action.id ? VARIANT_SOUNDS.choose : VARIANT_SOUNDS.clear);
    setSaid({ text: action.announce, locked: false });
    onChoose(action.slot, action.id);
  };
  return (
    <section
      className={`mt-5 ${className}`}
      aria-labelledby="techniques-title"
      data-testid="prep-techniques"
      data-expanded={open}
      data-all={all}
      data-owned={summary.owned}
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <h2
          id="techniques-title"
          className="flex items-center gap-2 font-display text-lg font-bold tracking-wide text-gold-300"
        >
          <Icon name="ward" size={19} /> Your techniques
        </h2>
        <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
          <p
            className="text-right text-xs leading-relaxed text-muted"
            data-testid="techniques-line"
          >
            {summary.line}
          </p>
          {onRules && (
            <Button
              variant="ghost"
              size="sm"
              className="!px-2 !py-1 text-xs"
              onClick={onRules}
              sound="click"
              data-testid="techniques-rules"
            >
              <Icon name="book" size={13} /> Rules
            </Button>
          )}
          <Button
            variant="secondary"
            size="sm"
            className="!py-1 text-xs"
            onClick={toggle}
            sound="click"
            aria-expanded={open}
            aria-controls="prep-technique-slots"
            data-testid="techniques-toggle"
          >
            {open ? 'Fold' : 'Choose variants'}
            <Icon name="arrow" size={13} className={open ? '-rotate-90' : 'rotate-90'} />
          </Button>
        </div>
      </div>
      <p
        className={`text-xs ${said ? 'mb-2' : ''} ${said?.locked ? 'text-rose-200' : 'text-gold-200'}`}
        role="status"
        aria-live="polite"
        data-testid="techniques-said"
      >
        {said ? (
          <span className="flex items-center gap-1.5">
            <Icon name={said.locked ? 'lock' : 'check'} size={12} /> {said.text}
          </span>
        ) : null}
      </p>
      {open ? (
        <div
          id="prep-technique-slots"
          className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
          data-testid="technique-slots"
        >
          {slots.map((view) => (
            <SlotColumn key={view.slot} view={view} onPick={(o) => pick(view, o)} />
          ))}
        </div>
      ) : (
        <ul
          id="prep-technique-slots"
          className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-ink-600/70 bg-ink-900/70 px-3 py-2"
          aria-label="What your four keys play"
          data-testid="techniques-folded"
        >
          {slots.map((view) => (
            <li
              key={view.slot}
              className="flex items-center gap-1.5 text-sm"
              data-testid={`techniques-folded-${view.slot}`}
              data-variant={view.chosen.id ?? undefined}
              title={view.chosen.text}
            >
              <KeyCap label={view.key} accent={view.chosen.id !== null} />
              <Icon
                name={view.chosen.icon}
                size={16}
                style={{ color: view.chosen.id ? VARIANT_LOOK.color : 'var(--color-muted)' }}
              />
              <span
                className={view.note ? 'text-muted line-through' : ''}
                style={{ color: view.chosen.id && !view.note ? VARIANT_LOOK.light : undefined }}
              >
                {view.chosen.name}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** A slot: its key and name, its three as a radio group, and the Chronomancer's note. */
function SlotColumn({
  view,
  onPick,
}: {
  view: TechniqueSlotView;
  onPick(option: TechniqueOption): void;
}) {
  const headingId = `technique-slot-${view.slot}`;
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const dir =
      e.key === 'ArrowDown' || e.key === 'ArrowRight'
        ? 1
        : e.key === 'ArrowUp' || e.key === 'ArrowLeft'
          ? -1
          : 0;
    if (dir === 0) return;
    e.preventDefault();
    const next = stepOption(view, dir);
    if (!next) return;
    onPick(next);
    e.currentTarget.querySelector<HTMLElement>(`[data-option="${next.id ?? 'default'}"]`)?.focus();
  };
  return (
    <div
      className="flex flex-col gap-2 rounded-xl border border-ink-600/70 bg-ink-900/70 p-2.5"
      data-testid={`technique-slot-${view.slot}`}
      data-chosen={view.chosen.id ?? 'default'}
      data-note={view.note ? 'rewind' : undefined}
    >
      <p id={headingId} className="flex items-center gap-2 px-0.5 text-sm font-semibold text-text">
        <KeyCap label={view.key} accent />
        <span>{view.name}</span>
        <span className="text-xs font-normal text-muted">
          · {view.chosen.id ? view.chosen.name : 'the default'}
        </span>
      </p>
      {view.note && (
        <p
          className="flex items-start gap-1.5 rounded-lg border border-ink-500/70 bg-ink-950/50 px-2 py-1.5 text-xs leading-snug text-muted"
          data-testid="technique-rewind-note"
        >
          <Icon name="rewind" size={14} className="mt-px shrink-0 text-gold-300" />
          {view.note}
        </p>
      )}
      <div
        role="radiogroup"
        aria-labelledby={headingId}
        className={`flex flex-col gap-2 ${view.note ? 'opacity-60' : ''}`}
        onKeyDown={onKey}
      >
        {view.options.map((o) => (
          <TechniqueCard key={o.id ?? 'default'} option={o} onPick={() => onPick(o)} />
        ))}
      </div>
    </div>
  );
}

/** A cost or cooldown, and the default's beside it when the variant's differs. */
function Stat({ label, changed, was }: { label: string; changed: boolean; was: string }) {
  return (
    <span
      className={changed ? 'text-gold-200' : ''}
      title={changed ? `The default: ${was}` : undefined}
      data-changed={changed || undefined}
    >
      {label}
      {changed && <span className="text-muted"> ({was})</span>}
    </span>
  );
}

/** One option of a slot: the default or a variant, as a radio (or a static card in the Codex). */
export function TechniqueCard({
  option: o,
  onPick,
  state,
  source,
}: {
  option: TechniqueOption;
  /** Interactive (Prep): a radio. Omitted: a static card (the Codex). */
  onPick?(): void;
  /** The Codex: the option's state ("Owned", "Open (Skip the unlocks)", "Locked"). */
  state?: OptionState;
  /** The Codex: how the variant is had. */
  source?: string;
}) {
  const locked = !o.open;
  const lit = onPick ? o.chosen : false;
  const textId = `technique-text-${o.id ?? `${o.slot}-default`}${onPick ? '' : '-codex'}`;
  const base = defaultStats(o.slot);
  const body = (
    <>
      <span className="flex w-full items-start justify-between gap-2">
        <b
          className={`flex items-center gap-1.5 font-display text-[0.95rem] leading-tight ${lit ? 'text-gold-100' : locked ? 'text-muted' : 'text-text'}`}
        >
          <Icon
            name={o.icon}
            size={17}
            className="shrink-0"
            style={{ color: locked ? 'var(--color-muted)' : VARIANT_LOOK.color }}
          />
          {o.name}
        </b>
        {lit ? (
          <span className="flex shrink-0 items-center gap-1 text-xs font-bold text-gold-200">
            <Icon name="check" size={13} /> Chosen
          </span>
        ) : state ? (
          <span
            className={`flex shrink-0 items-center gap-1 text-xs font-semibold ${state.kind === 'owned' || state.kind === 'open' ? 'text-gold-200' : 'text-muted'}`}
            data-testid="technique-state"
            data-state={state.kind}
          >
            <Icon
              name={
                state.kind === 'locked' ? 'lock' : state.kind === 'default' ? 'diamond' : 'check'
              }
              size={12}
            />
            {state.label}
          </span>
        ) : locked ? (
          <Icon name="lock" size={13} className="mt-0.5 shrink-0 text-muted" />
        ) : null}
      </span>
      <span
        id={textId}
        className={`mt-1 block text-xs leading-snug ${locked ? 'text-muted' : 'text-text/90'}`}
      >
        {o.text}
      </span>
      <span className="mt-1.5 flex flex-wrap gap-x-2 gap-y-0.5 font-mono text-[11px] text-muted">
        <Stat label={costLabel(o.cost)} changed={o.costChanged} was={base.cost} />
        <span aria-hidden>·</span>
        <Stat label={cooldownLabel(o.cooldown)} changed={o.cooldownChanged} was={base.cooldown} />
      </span>
      {source ? (
        <span
          className="mt-1.5 flex items-center gap-1.5 text-xs text-muted"
          data-testid="technique-source"
        >
          <Icon name="star" size={12} className="shrink-0 text-gold-300" /> {source}
        </span>
      ) : (
        locked && (
          <span
            className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-muted"
            data-testid="technique-lock"
          >
            <Icon name="star" size={12} className="shrink-0 text-gold-300" /> {o.lock}
          </span>
        )
      )}
    </>
  );
  const frame = `flex w-full flex-col items-start rounded-lg border px-2.5 py-2 text-left transition-colors ${
    locked
      ? 'border-dashed border-ink-600 bg-ink-950/40'
      : lit
        ? 'border-gold-400 bg-gold-400/10'
        : onPick
          ? 'border-ink-600 bg-ink-800/80 hover:border-gold-500/70 hover:bg-ink-800'
          : 'border-ink-600 bg-ink-800/80'
  }`;
  const data = {
    'data-testid': `technique-option-${o.id ?? `${o.slot}-default`}`,
    'data-option': o.id ?? 'default',
    'data-chosen': o.chosen,
    'data-open': o.open,
  };
  if (!onPick)
    return (
      <div className={frame} {...data}>
        {body}
      </div>
    );
  return (
    <button
      type="button"
      role="radio"
      aria-checked={o.chosen}
      aria-disabled={locked || undefined}
      aria-label={`${o.name}${o.id ? `, a ${defaultName(o.slot)} variant` : ', the default'}${locked ? `, locked: ${o.lock}` : ''}`}
      aria-describedby={textId}
      tabIndex={o.chosen ? 0 : -1}
      onClick={onPick}
      className={frame}
      {...data}
    >
      {body}
    </button>
  );
}

/** The slot's default cost and cooldown, as a variant's card compares them. */
function defaultStats(slot: TechniqueKey): { cost: string; cooldown: string } {
  const name = defaultName(slot);
  const cost = slotCost(slot, null);
  return {
    cost: `${name} ${cost === null ? 'free' : cost}`,
    cooldown: `${name} ${slotCooldown(slot, null)} s`,
  };
}
