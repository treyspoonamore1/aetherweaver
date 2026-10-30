import { useEffect, type ReactNode } from 'react';
import { useRun } from '../../app/runStore';
import { CONTENT, auraDef, heroDef, motifDef } from '../../content';
import * as Run from '../../meta/run';
import { motifLine } from '../../meta/run';
import type { DraftOffer, DraftOption, RunState } from '../../meta/types';
import { ScreenFrame, ScreenHeader } from '../kit/Backdrop';
import { Button } from '../kit/Button';
import { CATEGORY, Chip, RARITY, RarityChip } from '../kit/Chip';
import { Icon } from '../kit/Icon';
import { KeyCap } from '../kit/KeyCap';
import { playUi, useMood } from '../kit/sound';
import { Pips } from './shared';

const REASON: Record<DraftOffer['reason'], { title: string; blurb: string }> = {
  victory: { title: 'Spoils of the fight', blurb: 'Choose one motif to weave into your song.' },
  elite: { title: 'Rare spoils', blurb: 'An elite fell. Its motifs are rarer.' },
  shrine: { title: 'The shrine offers', blurb: 'A quiet place, and a rare gift.' },
  meditate: {
    title: 'Meditation',
    blurb: 'You sit with the song. Strengthen what you already know.',
  },
  boss: { title: 'The Warden’s gift', blurb: 'The great bell is silent. Take something epic.' },
};

export interface DraftViewProps {
  run: RunState;
  onPick(index: number | null): void;
  onReroll(): void;
}

export function DraftView({ run, onPick, onReroll }: DraftViewProps) {
  useMood('map');
  const draft = run.draft;
  const options = draft?.options;
  const rerolls = draft?.rerollsLeft ?? 0;
  const count = options?.length ?? 0;
  useEffect(() => {
    // 1–3 pick, R rerolls. Plain keys; the page has no text inputs.
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const n = Number(e.key);
      if (n >= 1 && n <= count) {
        e.preventDefault();
        playUi('pick');
        onPick(n - 1);
      } else if (e.key.toLowerCase() === 'r' && rerolls > 0) {
        e.preventDefault();
        onReroll();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [count, rerolls, onPick, onReroll]);
  if (!draft || !options) return null;
  const reason = REASON[draft.reason];
  return (
    <ScreenFrame tone="gold">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <ScreenHeader eyebrow="A motif to weave" title={reason.title}>
          <p className="mt-2 text-sm text-muted">
            {reason.blurb}
            {options.length >= 4 && Run.relicActive(run, 'star_chart') && (
              <span className="ml-1.5 text-gold-200">Your Star Chart adds a fourth choice.</span>
            )}
          </p>
        </ScreenHeader>

        <ul
          className={`mt-8 grid gap-5 ${options.length >= 4 ? 'md:grid-cols-2 xl:grid-cols-4' : 'md:grid-cols-3'}`}
        >
          {options.map((o, i) => (
            <li key={o.motifId} className="anim-rise" style={{ animationDelay: `${i * 90}ms` }}>
              <MotifCard option={o} index={i} onPick={() => onPick(i)} />
            </li>
          ))}
        </ul>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button onClick={onReroll} disabled={rerolls <= 0}>
            <Icon name="reroll" size={16} /> Reroll
            <span className="font-mono text-xs text-muted">{rerolls} left</span>
            <KeyCap label="R" />
          </Button>
          <Button variant="ghost" onClick={() => onPick(null)} sound="back">
            Skip: heal the party a little
          </Button>
        </div>
        <OwnedStrip run={run} />
      </div>
    </ScreenFrame>
  );
}

/**
 * A motif offer as a card (draft, merchant): category, name, rarity, new or upgrade, the line
 * at its new level. `action` replaces the gold call to action; `disabled` keeps it focusable
 * (aria-disabled) so a click can still say why.
 */
export function MotifCard({
  option,
  index,
  onPick,
  action,
  disabled = false,
  dim = false,
  label,
}: {
  option: DraftOption;
  /** 0-based; shows the number key (omit for none). */
  index?: number;
  onPick(): void;
  action?: ReactNode;
  disabled?: boolean;
  dim?: boolean;
  label?: string;
}) {
  const def = motifDef(option.motifId);
  const cat = CATEGORY[def.category];
  const rarity = RARITY[def.rarity];
  const max = def.values.length;
  const prev = option.upgrade ? motifLine(def.id, option.level - 1) : null;
  const req = def.requires;
  return (
    <button
      type="button"
      onClick={onPick}
      aria-disabled={disabled || undefined}
      aria-label={
        label ??
        `${def.name}, ${rarity.label} ${cat.label} motif${option.upgrade ? `, upgrade to level ${option.level}` : ''}. ${motifLine(def.id, option.level)}`
      }
      className={`group flex h-full w-full flex-col rounded-2xl border-2 bg-ink-800/90 p-5 text-left shadow-xl shadow-black/40 transition-all ${disabled ? 'cursor-not-allowed' : 'hover:-translate-y-1.5 hover:bg-ink-700/90'} ${dim ? 'opacity-55 saturate-50' : ''}`}
      style={{ borderColor: rarity.color }}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className="flex items-center gap-1.5 text-sm font-semibold"
          style={{ color: cat.color }}
        >
          <Icon name={cat.icon} size={18} /> {cat.label}
          <span className="text-xs font-normal text-muted">{cat.blurb}</span>
        </span>
        {index !== undefined && <KeyCap label={String(index + 1)} />}
      </div>
      <h2 className="mt-3 font-display text-2xl font-bold leading-tight text-text">{def.name}</h2>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <RarityChip rarity={def.rarity} />
        {option.upgrade ? (
          <Chip color="var(--color-gold-300)" icon="arrow">
            Upgrade · level {option.level - 1} → {option.level}
          </Chip>
        ) : (
          <Chip color="var(--color-heal)" icon="star">
            New
          </Chip>
        )}
      </div>
      <p className="mt-4 text-base leading-relaxed text-text">{motifLine(def.id, option.level)}</p>
      {prev && (
        <p className="mt-2 text-xs leading-relaxed text-muted">
          Now: <span className="line-through decoration-ink-500">{prev}</span>
        </p>
      )}
      <div className="mt-3 flex items-center gap-2 text-xs text-muted">
        Level <Pips level={option.level} max={max} color={cat.color} />
      </div>
      <div className="mt-auto pt-4">
        {(req.aura || req.hero) && (
          <p className="mb-2 flex items-center gap-1.5 text-xs text-heal">
            <Icon name="check" size={13} />
            {req.aura
              ? `Works with your ${auraDef(req.aura).name} aura`
              : `Works with ${heroDef(req.hero!).name} in your party`}
          </p>
        )}
        <div className="flex flex-wrap gap-1.5">
          {def.tags.map((t) => (
            <span
              key={t}
              className="rounded border border-ink-500 px-1.5 py-px font-mono text-xs text-muted"
            >
              #{t}
            </span>
          ))}
        </div>
      </div>
      {action ?? (
        <span className="mt-4 rounded-lg bg-gold-400 py-2 text-center text-sm font-semibold text-ink-950 opacity-90 group-hover:opacity-100">
          {option.upgrade ? 'Strengthen' : 'Weave in'}
        </span>
      )}
    </button>
  );
}

function OwnedStrip({ run }: { run: RunState }) {
  if (run.motifs.length === 0) return null;
  return (
    <section className="mx-auto mt-10 max-w-4xl" aria-label="Motifs you own">
      <h2 className="text-center font-display text-sm font-bold uppercase tracking-[0.25em] text-muted">
        Your motifs
      </h2>
      <ul className="mt-3 flex flex-wrap justify-center gap-2">
        {run.motifs.map((m) => {
          const def = CONTENT.motifs.find((x) => x.id === m.id)!;
          const cat = CATEGORY[def.category];
          return (
            <li key={m.id}>
              <Chip color={cat.color} icon={cat.icon} title={motifLine(m.id, m.level)}>
                {def.name} <Pips level={m.level} max={def.values.length} color={cat.color} />
              </Chip>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function DraftScreen() {
  const run = useRun((s) => s.run);
  const pick = useRun((s) => s.pickDraft);
  const reroll = useRun((s) => s.rerollDraft);
  if (!run) return null;
  return <DraftView run={run} onPick={pick} onReroll={reroll} />;
}
