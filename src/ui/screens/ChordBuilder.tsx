import { useState, type KeyboardEvent } from 'react';
import { CONTENT, auraDef, ornamentDef } from '../../content';
import { CHORD_PRESETS } from '../../meta/run';
import { chordLabel, type ChordLoadout } from '../../sim';
import { bindingLabel } from '../hud/labels';
import { fmt, pct } from '../kit/format';
import { Icon, type IconName } from '../kit/Icon';
import { KeyCap } from '../kit/KeyCap';
import { Panel } from '../kit/Panel';
import { playUi } from '../kit/sound';
import {
  anchorLabel,
  chordNumbers,
  itemName,
  loadoutProblems,
  placeItem,
  presetFor,
  removeItem,
  spiritBudget,
  whereIs,
  type SlotKind,
  type SlotRef,
} from './chordModel';

const ANCHOR_ICON = { weaver: 'note', planted: 'flag', thread: 'thread' } as const satisfies Record<
  string,
  IconName
>;

function mult(v: number): string {
  return `×${Number(v.toFixed(2))}`;
}

/**
 * The Chord builder (docs/plan/03 §4): up to two Chords of two auras and two ornaments. You
 * own one copy of each aura and ornament, so placing one moves it. Live Spirit budget,
 * legality from the sim, presets, and each Chord's effective radius and strength.
 *
 * Controlled: `value` is the draft (it may be illegal while you edit); the owner decides
 * what to do with legal loadouts.
 */
export function ChordBuilder({
  value,
  onChange,
}: {
  value: ChordLoadout[];
  onChange(next: ChordLoadout[]): void;
}) {
  const w = CONTENT.weaver;
  const firstEmpty = (): SlotRef => {
    for (let c = 0; c < value.length; c++) {
      if (value[c]!.auras.length < w.auraSlots)
        return { chord: c, kind: 'aura', index: value[c]!.auras.length };
    }
    return { chord: 0, kind: 'aura', index: 0 };
  };
  const [selected, setSelected] = useState<SlotRef>(firstEmpty);
  const problems = loadoutProblems(value);
  const budget = spiritBudget(value);
  const preset = presetFor(value);

  const place = (id: string) => {
    const next = placeItem(value, selected, id);
    playUi('pick');
    onChange(next);
    // Move on to the next empty slot of the same kind in this Chord, if there is one.
    const list =
      selected.kind === 'aura' ? next[selected.chord]!.auras : next[selected.chord]!.ornaments;
    const cap = selected.kind === 'aura' ? w.auraSlots : w.ornamentSlots;
    if (list.length < cap) setSelected({ ...selected, index: list.length });
  };
  const remove = (ref: SlotRef) => {
    playUi('back');
    const next = removeItem(value, ref);
    onChange(next);
    setSelected({ ...ref, index: Math.min(ref.index, listLength(next, ref)) });
  };

  return (
    <div className="flex flex-col gap-4" data-testid="chord-builder">
      <section aria-labelledby="presets-title">
        <h3
          id="presets-title"
          className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted"
        >
          Presets · one click
        </h3>
        <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {CHORD_PRESETS.map((p) => {
            const on = preset?.id === p.id;
            return (
              <li key={p.id}>
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => {
                    playUi('pick');
                    onChange(
                      Array.from({ length: w.chords }, (_, i) => ({
                        auras: [...(p.chords[i]?.auras ?? [])],
                        ornaments: [...(p.chords[i]?.ornaments ?? [])],
                      })),
                    );
                  }}
                  className={`h-full w-full rounded-xl border px-3 py-2.5 text-left transition-colors ${
                    on
                      ? 'border-gold-400 bg-gold-400/10'
                      : 'border-ink-600 bg-ink-900/70 hover:border-gold-500/70 hover:bg-ink-800'
                  }`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-display text-base font-bold text-gold-200">{p.name}</span>
                    {on && <Icon name="check" size={16} className="text-gold-300" />}
                  </span>
                  <span className="mt-1 flex flex-wrap gap-1" aria-hidden>
                    {p.chords.flatMap((c, ci) => [
                      ...c.auras.map((id) => (
                        <Dot
                          key={`a${ci}${id}`}
                          color={auraDef(id).color}
                          label={auraDef(id).name}
                        />
                      )),
                      ...c.ornaments.map((id) => (
                        <Dot
                          key={`o${ci}${id}`}
                          color={ornamentDef(id).color}
                          label={ornamentDef(id).name}
                          diamond
                        />
                      )),
                    ])}
                  </span>
                  <span className="mt-1 block text-xs leading-relaxed text-muted">{p.summary}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
        <div className="flex flex-col gap-4">
          <div className="grid gap-3 md:grid-cols-2">
            {value.map((chord, i) => (
              <ChordCard
                key={i}
                chord={chord}
                index={i}
                selected={selected.chord === i ? selected : null}
                onSelect={(ref) => {
                  playUi('click');
                  setSelected(ref);
                }}
                onRemove={remove}
              />
            ))}
          </div>
          <BudgetPanel budget={budget} />
          {problems.length > 0 && (
            <div
              role="alert"
              className="rounded-xl border border-lethal/60 bg-lethal/10 px-4 py-3 text-sm"
              data-testid="chord-problems"
            >
              <p className="flex items-center gap-2 font-semibold text-rose-200">
                <Icon name="info" size={16} /> This loadout can’t be sung yet
              </p>
              <ul className="mt-1 list-disc pl-6 text-rose-100">
                {problems.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <Palette value={value} selected={selected} onPlace={place} onRemove={remove} />
      </div>
    </div>
  );
}

function listLength(chords: ChordLoadout[], ref: SlotRef): number {
  const c = chords[ref.chord];
  return c ? (ref.kind === 'aura' ? c.auras.length : c.ornaments.length) : 0;
}

function Dot({
  color,
  label,
  diamond = false,
}: {
  color: string;
  label: string;
  diamond?: boolean;
}) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded border px-1.5 text-xs"
      style={{ color, borderColor: `color-mix(in srgb, ${color} 45%, transparent)` }}
    >
      <Icon name={diamond ? 'diamond' : 'note'} size={10} />
      {label}
    </span>
  );
}

function ChordCard({
  chord,
  index,
  selected,
  onSelect,
  onRemove,
}: {
  chord: ChordLoadout;
  index: number;
  selected: SlotRef | null;
  onSelect(ref: SlotRef): void;
  onRemove(ref: SlotRef): void;
}) {
  const w = CONTENT.weaver;
  const n = chordNumbers(chord, index);
  const empty = chord.auras.length === 0 && chord.ornaments.length === 0;
  const unison = chord.ornaments.includes('unison');
  const pedal = chord.ornaments.includes('pedal_point');
  return (
    <Panel
      tone="solid"
      className={`p-3.5 ${empty ? 'border-dashed' : ''}`}
      aria-label={chordLabel(index)}
      role="group"
    >
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-display text-lg font-bold text-gold-300">{chordLabel(index)}</h3>
        {!empty && (
          <span className="flex items-center gap-1 text-xs text-muted">
            <Icon name={ANCHOR_ICON[n.anchor]} size={13} />
            {anchorLabel(n.anchor)}
          </span>
        )}
      </div>
      <p className="mb-1.5 mt-2 text-xs font-semibold uppercase tracking-wider text-muted">Auras</p>
      <div className="grid grid-cols-2 gap-2">
        {Array.from({ length: w.auraSlots }, (_, i) => (
          <Slot
            key={i}
            slot={{ chord: index, kind: 'aura', index: i }}
            id={chord.auras[i]}
            selected={selected?.kind === 'aura' && selected.index === i}
            onSelect={onSelect}
            onRemove={onRemove}
            note={
              chord.auras[i] !== undefined
                ? `${pct(auraDef(chord.auras[i]!).reserve * n.reserveMult)}`
                : undefined
            }
          />
        ))}
      </div>
      <p className="mb-1.5 mt-3 text-xs font-semibold uppercase tracking-wider text-muted">
        Ornaments{' '}
        <span className="font-normal normal-case tracking-normal">· change both auras</span>
      </p>
      <div className="grid grid-cols-2 gap-2">
        {Array.from({ length: w.ornamentSlots }, (_, i) => (
          <Slot
            key={i}
            slot={{ chord: index, kind: 'ornament', index: i }}
            id={chord.ornaments[i]}
            selected={selected?.kind === 'ornament' && selected.index === i}
            onSelect={onSelect}
            onRemove={onRemove}
            note={chord.ornaments[i] ? ornamentDef(chord.ornaments[i]!).subtitle : undefined}
          />
        ))}
      </div>
      {!empty && (
        <dl className="mt-3 grid grid-cols-3 gap-2 rounded-lg bg-ink-900/70 px-3 py-2 text-xs">
          <div>
            <dt className="text-muted">Radius</dt>
            <dd className="font-mono text-sm text-text">
              {unison ? 'any range' : `${Number(n.radius.toFixed(1))} m`}
            </dd>
          </div>
          <div>
            <dt className="text-muted">Strength</dt>
            <dd
              className={`font-mono text-sm ${n.effect > 1.001 ? 'text-gold-300' : n.effect < 0.999 ? 'text-threat' : 'text-text'}`}
            >
              {mult(n.effect)}
            </dd>
          </div>
          <div>
            <dt className="text-muted">Reserves</dt>
            <dd className="font-mono text-sm text-text">{pct(n.reserve)}</dd>
          </div>
        </dl>
      )}
      {unison && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-gold-200">
          <Icon name="thread" size={13} /> Rides your Thread: only the threaded hero is touched.
        </p>
      )}
      {pedal && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-lime-200">
          <Icon name="flag" size={13} /> Plant it at the cursor with{' '}
          <KeyCap label={bindingLabel('plant')} /> (every {CONTENT.weaver.plantCooldown} s).
        </p>
      )}
    </Panel>
  );
}

function Slot({
  slot,
  id,
  selected,
  onSelect,
  onRemove,
  note,
}: {
  slot: SlotRef;
  id: string | undefined;
  selected: boolean;
  onSelect(ref: SlotRef): void;
  onRemove(ref: SlotRef): void;
  note?: string;
}) {
  const def = id ? (slot.kind === 'aura' ? auraDef(id) : ornamentDef(id)) : null;
  const kindName = slot.kind === 'aura' ? 'aura' : 'ornament';
  const onKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (id && (e.key === 'Delete' || e.key === 'Backspace')) {
      e.preventDefault();
      onRemove(slot);
    }
  };
  return (
    <div className="relative">
      <button
        type="button"
        aria-pressed={selected}
        aria-label={
          def
            ? `${chordLabel(slot.chord)} ${kindName} slot ${slot.index + 1}: ${def.name}. Select to change, Delete to remove`
            : `${chordLabel(slot.chord)} ${kindName} slot ${slot.index + 1}: empty. Select to fill`
        }
        onClick={() => onSelect(slot)}
        onKeyDown={onKey}
        className={`flex h-12 w-full items-center gap-2 rounded-lg border px-2.5 text-left transition-colors ${
          selected ? 'ring-2 ring-gold-300' : ''
        } ${def ? 'bg-ink-800' : 'border-dashed bg-ink-900/40 hover:bg-ink-800'}`}
        style={{ borderColor: def ? def.color : 'var(--color-ink-500)' }}
      >
        {def ? (
          <>
            <Icon
              name={slot.kind === 'aura' ? 'note' : 'diamond'}
              size={16}
              style={{ color: def.color }}
              className="shrink-0"
            />
            <span className="min-w-0 flex-1 pr-5">
              <span className="block truncate text-sm font-semibold" style={{ color: def.color }}>
                {def.name}
              </span>
              {note && <span className="block truncate text-xs text-muted">{note}</span>}
            </span>
          </>
        ) : (
          <span className="flex items-center gap-1.5 text-xs text-muted">
            <Icon name="mend" size={14} /> {slot.kind === 'aura' ? 'Aura' : 'Ornament'}
          </span>
        )}
      </button>
      {def && (
        <button
          type="button"
          onClick={() => onRemove(slot)}
          aria-label={`Remove ${def.name} from ${chordLabel(slot.chord)}`}
          className="absolute right-1 top-1 rounded p-0.5 text-muted hover:bg-ink-700 hover:text-rose-300"
          tabIndex={-1}
        >
          <Icon name="close" size={12} />
        </button>
      )}
    </div>
  );
}

/** Everything that fits the selected slot, with where each item sits now. */
function Palette({
  value,
  selected,
  onPlace,
  onRemove,
}: {
  value: ChordLoadout[];
  selected: SlotRef;
  onPlace(id: string): void;
  onRemove(ref: SlotRef): void;
}) {
  const kind: SlotKind = selected.kind;
  const chord = value[selected.chord]!;
  const current = (kind === 'aura' ? chord.auras : chord.ornaments)[selected.index];
  const n = chordNumbers(chord, selected.chord);
  const items =
    kind === 'aura'
      ? CONTENT.auras.map((a) => ({
          id: a.id,
          name: a.name,
          subtitle: a.subtitle,
          color: a.color,
          description: a.description,
          stat: `reserves ${pct(a.reserve * n.reserveMult)}`,
          warn: null as string | null,
        }))
      : CONTENT.ornaments.map((o) => {
          const clash = chord.ornaments.find(
            (x) => x !== o.id && x !== current && o.excludes.includes(x),
          );
          const clashBack = chord.ornaments.find(
            (x) => x !== o.id && x !== current && ornamentDef(x).excludes.includes(o.id),
          );
          const other = clash ?? clashBack;
          const stats = [
            o.reserveMult !== 1 && `reserve ${mult(o.reserveMult)}`,
            o.effectMult !== 1 && `effect ${mult(o.effectMult)}`,
            o.radiusMult !== 1 && `radius ${mult(o.radiusMult)}`,
          ].filter(Boolean);
          return {
            id: o.id,
            name: o.name,
            subtitle: o.subtitle,
            color: o.color,
            description: o.description,
            stat: stats.join(' · '),
            warn: other ? `Can’t share a Chord with ${ornamentDef(other).name}` : null,
          };
        });
  return (
    <Panel tone="solid" className="flex flex-col p-3.5" aria-labelledby="palette-title">
      <div className="flex items-baseline justify-between gap-2">
        <h3 id="palette-title" className="font-display text-base font-bold text-gold-300">
          {kind === 'aura' ? 'Auras' : 'Ornaments'}
        </h3>
        <span className="text-xs text-muted">
          for {chordLabel(selected.chord)}, slot {selected.index + 1}
        </span>
      </div>
      <p className="mb-2 text-xs text-muted">
        {kind === 'aura'
          ? 'Each aura reserves Spirit while sung. You have one of each.'
          : 'An ornament changes both auras in its Chord. You own one copy of each.'}
      </p>
      <ul className="scroll-thin -mr-1 flex max-h-[30rem] flex-col gap-1.5 overflow-y-auto pr-1">
        {items.map((it) => {
          const at = whereIs(value, kind, it.id);
          const here = at?.chord === selected.chord && at.index === selected.index;
          const elsewhere = at && !here ? chordLabel(at.chord) : null;
          return (
            <li key={it.id}>
              <button
                type="button"
                aria-pressed={here}
                onClick={() => (here ? undefined : onPlace(it.id))}
                aria-label={`${it.name}, ${it.subtitle}. ${it.stat}.${elsewhere ? ` Now in ${elsewhere}: choosing moves it.` : ''}${it.warn ? ` ${it.warn}.` : ''}`}
                className={`w-full rounded-lg border px-3 py-2 text-left transition-colors ${
                  here ? 'bg-ink-700' : 'bg-ink-900/70 hover:bg-ink-800'
                }`}
                style={{ borderColor: here ? it.color : 'var(--color-ink-600)' }}
              >
                <span className="flex items-center justify-between gap-2">
                  <span
                    className="flex items-center gap-1.5 text-sm font-semibold"
                    style={{ color: it.color }}
                  >
                    <Icon name={here ? 'check' : kind === 'aura' ? 'note' : 'diamond'} size={14} />
                    {it.name}
                    <span className="text-xs font-normal text-muted">{it.subtitle}</span>
                  </span>
                  {elsewhere && (
                    <span className="shrink-0 rounded border border-ink-500 px-1.5 text-xs text-muted">
                      in {elsewhere}
                    </span>
                  )}
                </span>
                {it.stat && (
                  <span className="mt-0.5 block font-mono text-xs text-muted">{it.stat}</span>
                )}
                <span className="mt-0.5 block text-xs leading-relaxed text-text">
                  {it.description}
                </span>
                {it.warn && (
                  <span className="mt-1 flex items-center gap-1 text-xs font-medium text-threat">
                    <Icon name="info" size={12} /> {it.warn}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
      {current && (
        <button
          type="button"
          onClick={() => onRemove(selected)}
          className="mt-2 flex items-center justify-center gap-1.5 rounded-lg border border-ink-500 px-3 py-1.5 text-sm text-muted hover:border-rose-400 hover:text-rose-200"
        >
          <Icon name="close" size={14} /> Empty this slot ({itemName(kind, current)})
        </button>
      )}
    </Panel>
  );
}

/** Reserved vs free Spirit, and what the free part buys. */
function BudgetPanel({ budget: b }: { budget: ReturnType<typeof spiritBudget> }) {
  const scale = Math.max(b.max, b.reserved);
  const width = (v: number) => `${(v / scale) * 100}%`;
  const ward = b.techniques[0]!;
  const c = CONTENT.chorus;
  return (
    <Panel tone="solid" className="p-3.5" aria-label="Spirit budget">
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-semibold text-text">Spirit budget</p>
        <p className="font-mono text-xs text-muted">
          <span className={b.over ? 'text-lethal' : ''}>{fmt(b.reserved)} reserved</span> ·{' '}
          <span style={{ color: 'var(--color-spirit)' }}>{fmt(b.free)} free</span> of {b.max}
        </p>
      </div>
      <div
        className="relative mt-2 flex h-6 overflow-hidden rounded-full border border-ink-500 bg-ink-700"
        role="img"
        aria-label={`${fmt(b.free)} of ${b.max} Spirit free; ${b.slices.map((s) => `${s.name} reserves ${fmt(s.spirit)}`).join(', ') || 'no auras'}`}
      >
        {b.slices.map((s) => (
          <div
            key={`${s.chord}${s.id}`}
            className="stripes flex h-full items-center justify-center overflow-hidden border-r border-ink-950 text-xs font-semibold text-ink-950 transition-[width] duration-200"
            style={{ width: width(s.spirit), backgroundColor: s.color }}
            title={`${s.name}: ${fmt(s.spirit)} reserved`}
          >
            <span className="truncate px-1">{s.name}</span>
          </div>
        ))}
        <div
          className="flex h-full overflow-hidden transition-[width] duration-200"
          style={{ width: width(b.free), background: 'var(--color-spirit)' }}
        >
          {/* What the free Spirit buys, back to back: Ward, then Chime, then Reel. */}
          {b.techniques.map((t) => (
            <span
              key={t.key}
              className="flex h-full shrink-0 items-center justify-center border-r-2 border-dashed border-ink-950/60 text-xs font-semibold text-ink-950"
              style={{ width: `${(t.cost / Math.max(1, b.free)) * 100}%` }}
              aria-hidden
            >
              {t.name}
            </span>
          ))}
        </div>
        {b.over && (
          <div
            className="absolute inset-y-0 right-0 border-l-2 border-white bg-lethal/70"
            style={{ width: width(b.reserved - b.max) }}
            title="Over budget"
          />
        )}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {b.techniques.map((t) => (
          <li
            key={t.key}
            className={`flex items-center gap-1.5 ${t.affordable ? 'text-text' : 'text-lethal'}`}
          >
            <Icon name={t.affordable ? 'check' : 'close'} size={12} />
            {t.name} {t.cost}
          </li>
        ))}
        <li className={b.allThree ? 'text-muted' : 'text-threat'}>
          {b.allThree
            ? 'Room for all three back to back'
            : `All three back to back need ${b.techniques.reduce((s, t) => s + t.cost, 0)}`}
        </li>
      </ul>
      {!ward.affordable && (
        <p
          className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-lethal"
          role="status"
        >
          <Icon name="ward" size={14} /> Only {fmt(b.free)} Spirit stays free: you could never cast
          Ward ({ward.cost}).
        </p>
      )}
      <p
        className={`mt-2 flex items-center gap-1.5 text-xs ${b.chorus ? 'text-gold-200' : 'text-muted'}`}
      >
        <Icon name="sparkle" size={13} />
        {b.chorus
          ? `Chorus: ${b.auraCount} auras, so every Cue releases a pulse that heals ${pct(c.healPctPerAura * b.auraCount, 1)} and shields ${pct(c.barrierPctPerAura * b.auraCount, 1)} of life.`
          : `With ${c.minAuras}+ auras, every Cue also releases a chorus pulse (heal + barrier).`}
      </p>
    </Panel>
  );
}
