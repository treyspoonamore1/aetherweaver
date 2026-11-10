import { useEffect, useRef, useState } from 'react';
import { CATEGORY } from '../kit/Chip';
import { Icon } from '../kit/Icon';
import { useReducedMotion } from '../kit/motion';
import { relicColor } from '../kit/RelicGlyph';
import {
  stepTriggerChips,
  triggerChipText,
  triggerIcon,
  type TriggerChip,
  type TriggerSource,
} from './triggers';

/** The relic bar's boon and bane colours (`RelicBar`): no new colour. */
const BOON = '#86efac';
const BANE = '#fb7185';

/** A source's colour: its motif category's, its relic rarity's, or the bar's boon colours. */
export function triggerColor(s: TriggerSource): string {
  if (s.kind === 'motif' && s.category) return CATEGORY[s.category].color;
  if (s.kind === 'relic' && s.rarity) return relicColor(s.rarity);
  return s.bane ? BANE : BOON;
}

function same(a: readonly TriggerChip[], b: readonly TriggerChip[]): boolean {
  return a.length === b.length && a.every((c, i) => c === b[i]);
}

/**
 * Phase 5g (docs/phase-5g.md): a small chip under the relic bar when a motif, relic or boon's
 * trigger fires, named from content in its category's or rarity's colour with its glyph (colour
 * is never alone). Read from the snapshot's `triggers` counts, so no event stream is needed; one
 * chip a source, counting up while it shows ("Clean Strike ×3"), at most three (`triggers.ts`).
 * Reduced motion: the chips appear without rising. Draws nothing without a trigger held.
 */
export function TriggerChips({
  triggers,
  seconds,
  shown,
}: {
  triggers?: Readonly<Record<string, number>>;
  /** Sim seconds (the snapshot's): chips live by sim time, so a pause holds them. */
  seconds: number;
  /** UI lab: these chips, drawn as they are (no counts read). */
  shown?: readonly TriggerChip[];
}) {
  const reduced = useReducedMotion();
  const [chips, setChips] = useState<readonly TriggerChip[]>([]);
  const prev = useRef<Readonly<Record<string, number>> | undefined>(undefined);
  useEffect(() => {
    if (shown) return;
    const before = prev.current;
    prev.current = triggers;
    setChips((c) => {
      const next = stepTriggerChips(c, before, triggers, seconds);
      return same(c, next) ? c : next;
    });
  }, [triggers, seconds, shown]);
  const list = shown ?? chips;
  if (list.length === 0) return null;
  return (
    <div
      className="flex flex-col items-start gap-1"
      data-testid="trigger-chips"
      role="group"
      aria-label="Triggers"
    >
      {list.map((c) => {
        const color = triggerColor(c.source);
        const text = triggerChipText(c);
        return (
          <span
            key={`${c.source.id}:${c.since}`}
            className={`inline-flex items-center gap-1 rounded-md border bg-ink-900/85 px-1.5 py-0.5 text-xs font-medium shadow shadow-black/40 ${reduced ? '' : 'anim-rise'}`}
            style={{
              color,
              borderColor: `color-mix(in srgb, ${color} 55%, transparent)`,
              borderStyle: c.source.bane ? 'dashed' : 'solid',
            }}
            data-trigger={c.source.id}
            data-count={c.count}
            role="img"
            aria-label={`${text}: triggered`}
          >
            <Icon name={triggerIcon(c.source)} size={12} />
            {text}
          </span>
        );
      })}
    </div>
  );
}
