import { useState } from 'react';
import { unlockRank, type Allowance } from '../../meta/profile';
import type { CallingDef } from '../../content';
import { Button } from '../kit/Button';
import { PathPip, callingLook } from '../kit/CallingGlyph';
import { Icon } from '../kit/Icon';
import { Modal } from '../kit/Modal';
import { playUi } from '../kit/sound';
import { LockTag, NewTag } from './ChordBuilder';
import { CallingPassive, CallingPathPreview, CallingTitle } from './CallingParts';
import { allCallings, numeral, tierWhenList } from './callingText';

/** Is this Calling open to choose (its Rank reached, or Skip the unlocks)? */
export function callingOpen(allowance: Allowance, id: string): boolean {
  return allowance.all || allowance.callings.has(id);
}

/**
 * Prep's Calling picker (Phase 3c): "No Calling" and each Calling as a compact card (emblem,
 * passive, Sunrise, the four picks and when they come), with the whole path in a dialog.
 * Locked Callings show their Rank and what they are, and can't be chosen.
 */
export function CallingPicker({
  chosen,
  allowance,
  fresh,
  onChoose,
  openPath = null,
}: {
  chosen: string | null;
  allowance: Allowance;
  /** Unlock ids marked New this visit ("calling.luminary"). */
  fresh: ReadonlySet<string>;
  onChoose(id: string | null): void;
  /** UI lab: open one Calling's path dialog. */
  openPath?: string | null;
}) {
  const [viewing, setViewing] = useState<string | null>(openPath);
  const callings = allCallings();
  const choose = (id: string | null) => {
    if (id === chosen) return;
    playUi(id ? 'callingSelect' : 'back');
    onChoose(id);
  };
  const shown = callings.find((c) => c.id === viewing) ?? null;
  return (
    <section className="mt-6" aria-labelledby="calling-title" data-testid="calling-picker">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2
          id="calling-title"
          className="font-display text-lg font-bold tracking-wide text-gold-300"
        >
          Your Calling
        </h2>
        <p className="text-xs text-muted">
          The Weaver’s class for this run: chosen here, it grows as you win.
        </p>
      </div>
      <div
        className="grid gap-3 md:grid-cols-[15rem_1fr]"
        role="radiogroup"
        aria-labelledby="calling-title"
      >
        <NoCalling selected={chosen === null} onChoose={() => choose(null)} />
        {callings.map((def) => (
          <CallingCard
            key={def.id}
            def={def}
            selected={chosen === def.id}
            open={callingOpen(allowance, def.id)}
            isNew={fresh.has(`calling.${def.id}`)}
            onChoose={() => choose(def.id)}
            onView={() => setViewing(def.id)}
          />
        ))}
      </div>
      {shown && (
        // Fixed, so the dialog covers the screen however far Prep has scrolled.
        <div className="fixed inset-0 z-50">
          <CallingPathDialog
            def={shown}
            open={callingOpen(allowance, shown.id)}
            selected={chosen === shown.id}
            onChoose={() => {
              choose(shown.id);
              setViewing(null);
            }}
            onClose={() => setViewing(null)}
          />
        </div>
      )}
    </section>
  );
}

function NoCalling({ selected, onChoose }: { selected: boolean; onChoose(): void }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onChoose}
      className={`flex h-full flex-col items-start gap-1.5 rounded-xl border px-4 py-3 text-left transition-colors ${
        selected
          ? 'border-gold-400 bg-gold-400/10'
          : 'border-ink-600 bg-ink-800/80 hover:border-gold-500/70 hover:bg-ink-800'
      }`}
    >
      <span className="flex w-full items-center justify-between gap-2">
        <span className="font-display text-base font-bold text-text">No Calling</span>
        {selected && <Icon name="check" size={16} className="text-gold-300" />}
      </span>
      <span className="text-xs leading-relaxed text-muted">
        Your songs and your Thread, as always. No path to pick along the way.
      </span>
    </button>
  );
}

function CallingCard({
  def,
  selected,
  open,
  isNew,
  onChoose,
  onView,
}: {
  def: CallingDef;
  selected: boolean;
  open: boolean;
  isNew: boolean;
  onChoose(): void;
  onView(): void;
}) {
  const look = callingLook(def.id);
  const rank = unlockRank('calling', def.id);
  return (
    <div
      className={`relative flex flex-col gap-2 rounded-xl border p-3 transition-colors md:flex-row md:items-stretch ${
        open ? '' : 'border-dashed'
      }`}
      style={{
        borderColor: selected
          ? look.color
          : open
            ? `color-mix(in srgb, ${look.color} 35%, var(--color-ink-600))`
            : 'var(--color-ink-500)',
        background: selected
          ? `linear-gradient(100deg, color-mix(in srgb, ${look.color} 16%, rgb(17 26 51 / 0.92)), rgb(17 26 51 / 0.92) 60%)`
          : open
            ? 'rgb(17 26 51 / 0.85)'
            : 'rgb(10 16 34 / 0.6)',
        boxShadow: selected ? `0 0 22px color-mix(in srgb, ${look.color} 25%, transparent)` : '',
      }}
      data-testid={`calling-${def.id}`}
    >
      <button
        type="button"
        role="radio"
        aria-checked={selected}
        aria-disabled={!open}
        aria-label={
          open
            ? `The ${def.name}, ${def.title}${selected ? ': chosen' : ''}`
            : `The ${def.name}: unlocks at Rank ${rank}`
        }
        onClick={() => {
          if (open) onChoose();
          else playUi('error');
        }}
        className={`flex min-w-0 flex-1 flex-col gap-2 rounded-lg text-left md:flex-row md:items-start md:gap-4 ${open ? '' : 'cursor-not-allowed'}`}
      >
        <span className="flex shrink-0 items-center gap-2 md:w-56 md:flex-col md:items-start">
          <CallingTitle def={def} size={52} muted={!open} />
          <span className="flex items-center gap-1.5">
            {isNew && open && <NewTag />}
            {!open && <LockTag rank={rank} />}
            {selected && (
              <span
                className="inline-flex items-center gap-1 rounded-md px-1.5 text-xs font-bold leading-5 text-ink-950"
                style={{ background: look.color }}
              >
                <Icon name="check" size={12} /> Chosen
              </span>
            )}
          </span>
        </span>
        <span className={`min-w-0 flex-1 ${open ? '' : 'opacity-75'}`}>
          <CallingPassive def={def} compact />
          {!open && (
            <span className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-muted">
              <Icon name="lock" size={12} /> Reach Weaver Rank {rank} to choose it (or Settings →
              Skip the unlocks).
            </span>
          )}
        </span>
      </button>
      <span className="flex shrink-0 flex-col justify-between gap-2 md:w-60 md:border-l md:border-ink-600/60 md:pl-4">
        <span>
          <span className="flex items-center gap-1" aria-hidden>
            {def.tiers.map((_, i) => (
              <PathPip key={i} callingId={def.id} state="open" numeral={numeral(i)} size={22} />
            ))}
          </span>
          <span className="mt-1.5 block text-xs leading-relaxed text-muted">
            {def.tiers.length} picks along the way, one of two each:{' '}
            {tierWhenList(def.tiers.length)}.
          </span>
        </span>
        <Button size="sm" variant="secondary" onClick={onView} className="self-start">
          <Icon name="book" size={14} /> See the path
        </Button>
      </span>
    </div>
  );
}

/** The whole path in a dialog, with the Calling's flavour and a Choose button. */
function CallingPathDialog({
  def,
  open,
  selected,
  onChoose,
  onClose,
}: {
  def: CallingDef;
  open: boolean;
  selected: boolean;
  onChoose(): void;
  onClose(): void;
}) {
  const look = callingLook(def.id);
  const rank = unlockRank('calling', def.id);
  return (
    <Modal title={`The ${def.name}`} width="max-w-4xl" onClose={onClose} closeOnEscape>
      <p className="text-sm italic text-muted">
        {def.title} · “{def.flavor}”
      </p>
      <div className="mt-3">
        <CallingPassive def={def} />
      </div>
      <p
        className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wider"
        style={{ color: look.color }}
      >
        The path · one of two at each tier, for the rest of the run
      </p>
      <CallingPathPreview def={def} />
      <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
        {!open && (
          <span className="mr-auto flex items-center gap-1.5 text-sm text-muted">
            <Icon name="lock" size={14} /> Unlocks at Weaver Rank {rank}
          </span>
        )}
        <Button onClick={onClose} sound="back" data-autofocus>
          Close
        </Button>
        {open && !selected && (
          <Button variant="primary" onClick={onChoose} sound={null}>
            Choose the {def.name}
          </Button>
        )}
      </div>
    </Modal>
  );
}
