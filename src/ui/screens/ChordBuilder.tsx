import { useState, type KeyboardEvent } from 'react';
import { CONTENT, auraDef, ornamentDef } from '../../content';
import { EVERYTHING, UNLOCKS, type Allowance } from '../../meta/profile';
import { CHORD_PRESETS } from '../../meta/run';
import {
  LIFE_RESERVE_CAP,
  chordRole,
  songName,
  type ChordLoadout,
  type Passive,
  type ReservePool,
} from '../../sim';
import type { RunCalling } from '../../meta/types';
import type { Techniques } from '../../meta/variants';
import { bindingLabel } from '../hud/labels';
import { fmt, pct } from '../kit/format';
import { Icon, type IconName } from '../kit/Icon';
import { KeyCap } from '../kit/KeyCap';
import { Panel } from '../kit/Panel';
import { playUi } from '../kit/sound';
import { CallingGlyph, callingLook } from '../kit/CallingGlyph';
import {
  anchorLabel,
  auraSlotsFor,
  costText,
  isBonusSlot,
  chordNumbers,
  itemLock as itemLockOf,
  itemName,
  loadoutProblems,
  mult,
  placeItem,
  poolWord,
  presetFor,
  presetLock,
  removeItem,
  roleNote,
  slotLock,
  songInfo,
  songLock,
  spiritBudget,
  unlockId,
  whereIs,
  type SlotKind,
  type SlotRef,
  type SpiritBudget,
} from './chordModel';
import { lowLifeMarks, type LowLifeMark } from './callingText';
import { AstrolabeGlyph } from '../kit/AstrolabeGlyph';
import { CONSTELLATION_LOOK, STARLIGHT } from '../kit/astrolabeLook';
import { reserveStars } from './astrolabeModel';

const ANCHOR_ICON = { weaver: 'note', planted: 'pin' } as const satisfies Record<string, IconName>;

/** Each song's accent: the beam is the Thread's gold, the field a cool blue (glyphs say it too). */
export const SONG_LOOK = {
  beam: { color: 'var(--color-gold-300)', icon: 'thread' },
  field: { color: '#93c5fd', icon: 'scatter' },
} as const satisfies Record<string, { color: string; icon: IconName }>;

const NO_FRESH: ReadonlySet<string> = new Set();
const NO_TREE: readonly string[] = [];
const NO_PASSIVES: readonly Passive[] = [];

/**
 * "−14%": the Astrolabe's share of the songs (Clear Voice, Breath, Eldritch Conduit, Sanguine
 * Font), with the stars behind it in its tooltip. Nothing when the tree leaves the songs alone.
 */
export function AstrolabeShare({
  reserveMult,
  astrolabe,
  passives = NO_PASSIVES,
  className = '',
}: {
  reserveMult: number;
  astrolabe: readonly string[];
  /** The carried relics' passives (docs/phase-4c.md): Light Reserve lightens the songs too. */
  passives?: readonly Passive[];
  className?: string;
}) {
  const less = Math.round((1 - reserveMult) * 100);
  if (less === 0) return null;
  const relics = passives.some((p) => p.effect === 'reserve');
  const stars = [
    ...new Set(reserveStars(astrolabe).map((n) => n.name)),
    ...(relics ? ['your carried relics’ Inscriptions'] : []),
  ];
  const source =
    astrolabe.length > 0 && relics
      ? 'the Astrolabe and relics'
      : relics
        ? 'relics'
        : 'the Astrolabe';
  const text = `${less > 0 ? '−' : '+'}${Math.abs(less)}% from ${source}`;
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md border px-1.5 py-px text-xs font-semibold ${className}`}
      style={{
        color: CONSTELLATION_LOOK.choir.light,
        borderColor: `color-mix(in srgb, ${CONSTELLATION_LOOK.choir.color} 60%, transparent)`,
        background: `color-mix(in srgb, ${CONSTELLATION_LOOK.choir.color} 14%, transparent)`,
      }}
      title={`${relics ? 'Your Astrolabe and relics make' : 'Your Astrolabe makes'} your songs ${Math.abs(less)}% ${less > 0 ? 'lighter' : 'heavier'}: ${stars.join(', ')}`}
      data-testid="astrolabe-share"
    >
      <AstrolabeGlyph glyph="weaver_star" size={12} style={{ color: STARLIGHT.color }} />
      {text}
    </span>
  );
}

/** Who added the field song's extra aura slots (the Luminary's Third Voice), to mark them. */
export interface SlotBonus {
  /** "Third Voice". */
  name: string;
  /** The option's glyph key. */
  icon: string;
  /** The Calling, for its colour. */
  callingId: string;
}

/** "in the beam song" for the palette's tags. */
function inSong(index: number): string {
  return `in the ${songName(index).toLowerCase()}`;
}

/**
 * The Chord builder (docs/phase-3.md): the **beam song** (Chord I, it rides the Thread) and the
 * **field song** (Chord II, around you), each two auras and up to two ornaments. You own one
 * copy of each aura and ornament, so placing one moves it. Live Spirit budget, legality from
 * the sim, locks from the player's Rank, presets, and each song's numbers.
 *
 * Controlled: `value` is the draft (it may be illegal while you edit); the owner decides
 * what to do with legal loadouts. `allowance` locks what the Rank hasn't opened yet; `fresh`
 * holds unlock ids to mark "New".
 */
export function ChordBuilder({
  value,
  onChange,
  allowance = EVERYTHING,
  fresh = NO_FRESH,
  fieldAuraSlots = CONTENT.weaver.auraSlots,
  bonus = null,
  pool = 'spirit',
  calling = null,
  reserveMult = 1,
  astrolabe = NO_TREE,
  passives = NO_PASSIVES,
  techniques,
}: {
  value: ChordLoadout[];
  onChange(next: ChordLoadout[]): void;
  allowance?: Allowance;
  fresh?: ReadonlySet<string>;
  /** The field song's aura slots: `Run.fieldAuraSlots(run)` (Third Voice adds one). */
  fieldAuraSlots?: number;
  /** Who added the extra field slots, to mark them (null: no extra slots). */
  bonus?: SlotBonus | null;
  /** What the songs reserve: `Run.reservePool(run)` (the Martyr's Life, Sanguine Font's). */
  pool?: ReservePool;
  /** The run's Calling: the Martyr's Life and the thresholds her path marks on it. */
  calling?: RunCalling | null;
  /** Phase 4: the Astrolabe's multiplier on the songs' share (`Run.reserveMult(run)`). */
  reserveMult?: number;
  /** Phase 4: the run's tree (`run.astrolabe`): its Life, its technique costs, its lighter songs. */
  astrolabe?: readonly string[];
  /** Phase 4c: the carried relics' passives (`Run.carriedPassives(run)`): Vigor, Light Hands. */
  passives?: readonly Passive[];
  /** Phase 4f: the run's technique variants (`run.techniques`): the budget names and costs them. */
  techniques?: Techniques;
}) {
  const w = CONTENT.weaver;
  const firstEmpty = (): SlotRef => {
    for (let c = 0; c < value.length; c++) {
      const ref: SlotRef = { chord: c, kind: 'aura', index: value[c]!.auras.length };
      if (
        value[c]!.auras.length < auraSlotsFor(c, fieldAuraSlots) &&
        slotLock(allowance, ref) === null
      )
        return ref;
    }
    return { chord: 0, kind: 'aura', index: 0 };
  };
  const [selected, setSelected] = useState<SlotRef>(firstEmpty);
  const problems = loadoutProblems(value, allowance, fieldAuraSlots, pool, reserveMult);
  const budget = spiritBudget(value, pool, calling?.id ?? null, {
    reserveMult,
    astrolabe,
    passives,
    techniques,
  });
  const preset = presetFor(value);

  const place = (id: string) => {
    const next = placeItem(value, selected, id);
    playUi('pick');
    onChange(next);
    // Move on to the next empty, open slot of the same kind in this song, if there is one.
    const list =
      selected.kind === 'aura' ? next[selected.chord]!.auras : next[selected.chord]!.ornaments;
    const cap =
      selected.kind === 'aura' ? auraSlotsFor(selected.chord, fieldAuraSlots) : w.ornamentSlots;
    const ref = { ...selected, index: list.length };
    if (list.length < cap && slotLock(allowance, ref) === null) setSelected(ref);
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
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {CHORD_PRESETS.map((p) => {
            const on = preset?.id === p.id;
            const lock = presetLock(p, allowance);
            return (
              <li key={p.id}>
                <button
                  type="button"
                  aria-pressed={on}
                  disabled={lock !== null}
                  aria-label={
                    lock !== null ? `${p.name}: unlocks at Rank ${lock}` : `${p.name}. ${p.summary}`
                  }
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
                      : lock !== null
                        ? 'cursor-not-allowed border-dashed border-ink-600 bg-ink-900/40'
                        : 'border-ink-600 bg-ink-900/70 hover:border-gold-500/70 hover:bg-ink-800'
                  }`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span
                      className={`font-display text-base font-bold ${lock !== null ? 'text-muted' : 'text-gold-200'}`}
                    >
                      {p.name}
                    </span>
                    {on ? (
                      <Icon name="check" size={16} className="text-gold-300" />
                    ) : lock !== null ? (
                      <LockTag rank={lock} />
                    ) : (
                      <span className="font-mono text-xs text-muted">Rank {p.rank}</span>
                    )}
                  </span>
                  <span
                    className={`mt-1 flex flex-col gap-0.5 ${lock !== null ? 'opacity-50' : ''}`}
                    aria-hidden
                  >
                    {p.chords.map((c, ci) =>
                      c.auras.length + c.ornaments.length === 0 ? null : (
                        <span key={ci} className="flex flex-wrap items-center gap-1">
                          <Icon
                            name={SONG_LOOK[chordRole(ci)].icon}
                            size={12}
                            style={{ color: SONG_LOOK[chordRole(ci)].color }}
                          />
                          {c.auras.map((id) => (
                            <Dot
                              key={`a${id}`}
                              color={auraDef(id).color}
                              label={auraDef(id).name}
                            />
                          ))}
                          {c.ornaments.map((id) => (
                            <Dot
                              key={`o${id}`}
                              color={ornamentDef(id).color}
                              label={ornamentDef(id).name}
                              diamond
                            />
                          ))}
                        </span>
                      ),
                    )}
                  </span>
                  <span
                    className={`mt-1 block text-xs leading-relaxed ${lock !== null ? 'text-ink-500' : 'text-muted'}`}
                  >
                    {p.summary}
                  </span>
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
              <SongCard
                key={i}
                chord={chord}
                index={i}
                allowance={allowance}
                fresh={fresh}
                auraSlots={auraSlotsFor(i, fieldAuraSlots)}
                bonus={bonus}
                pool={pool}
                reserveMult={reserveMult}
                selected={selected.chord === i ? selected : null}
                onSelect={(ref) => {
                  playUi('click');
                  setSelected(ref);
                }}
                onRemove={remove}
              />
            ))}
          </div>
          {budget.pool === 'life' ? (
            <LifeBudgetPanel
              budget={budget}
              marks={lowLifeMarks(calling?.path ?? [])}
              callingId={calling?.id ?? null}
              astrolabe={astrolabe}
            />
          ) : (
            <BudgetPanel budget={budget} astrolabe={astrolabe} />
          )}
          {problems.length > 0 && (
            <div
              role="alert"
              className="rounded-xl border border-lethal/60 bg-lethal/10 px-4 py-3 text-sm"
              data-testid="chord-problems"
            >
              <p className="flex items-center gap-2 font-semibold text-rose-200">
                <Icon name="info" size={16} /> These songs can’t be sung yet
              </p>
              <ul className="mt-1 list-disc pl-6 text-rose-100">
                {problems.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <Palette
          value={value}
          selected={selected}
          allowance={allowance}
          fresh={fresh}
          pool={pool}
          reserveMult={reserveMult}
          onPlace={place}
          onRemove={remove}
        />
      </div>
    </div>
  );
}

/** A small "locked until Rank N" tag. */
export function LockTag({ rank }: { rank: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 rounded border border-ink-500 bg-ink-900 px-1.5 text-xs font-medium text-muted"
      title={`Unlocks at Rank ${rank}`}
    >
      <Icon name="lock" size={11} /> Rank {rank}
    </span>
  );
}

/** "New": an unlock the player hasn't been introduced to yet. */
export function NewTag() {
  return (
    <span className="anim-glow inline-flex shrink-0 items-center rounded bg-gold-400 px-1.5 text-xs font-bold uppercase leading-5 tracking-wider text-ink-950">
      New
    </span>
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

function SongCard({
  chord,
  index,
  allowance,
  fresh,
  auraSlots,
  bonus,
  pool,
  reserveMult,
  selected,
  onSelect,
  onRemove,
}: {
  chord: ChordLoadout;
  index: number;
  allowance: Allowance;
  fresh: ReadonlySet<string>;
  auraSlots: number;
  bonus: SlotBonus | null;
  pool: ReservePool;
  /** The Astrolabe's multiplier on the songs' share. */
  reserveMult: number;
  selected: SlotRef | null;
  onSelect(ref: SlotRef): void;
  onRemove(ref: SlotRef): void;
}) {
  const w = CONTENT.weaver;
  const n = chordNumbers(chord, index);
  const info = songInfo(chord, index);
  const look = SONG_LOOK[info.role];
  const empty = chord.auras.length === 0 && chord.ornaments.length === 0;
  const pedal = chord.ornaments.includes('pedal_point');
  const lock = songLock(allowance, index);
  const unlock = UNLOCKS.find((u) => u.id === unlockId({ kind: 'song', index }));
  const isNew = fresh.has(unlockId({ kind: 'song', index }));
  return (
    <Panel
      tone="solid"
      className={`flex flex-col p-3.5 ${empty ? 'border-dashed' : ''} ${lock !== null ? 'bg-ink-900/60' : ''}`}
      style={{ borderTopColor: lock === null ? look.color : undefined, borderTopWidth: 3 }}
      aria-label={info.name}
      role="group"
      data-testid={`song-${info.role}`}
    >
      <div className="flex items-center justify-between gap-2">
        <h3
          className="flex items-center gap-2 font-display text-lg font-bold"
          style={{ color: lock === null ? look.color : 'var(--color-muted)' }}
        >
          <Icon name={look.icon} size={18} />
          {info.name}
          {isNew && <NewTag />}
        </h3>
        {lock !== null ? (
          <LockTag rank={lock} />
        ) : (
          !empty && (
            <span className="flex items-center gap-1 text-xs text-muted">
              <Icon name={ANCHOR_ICON[n.anchor]} size={13} />
              {anchorLabel(n.anchor)}
            </span>
          )
        )}
      </div>
      {lock !== null && empty ? (
        <div className="mt-2 flex flex-1 flex-col items-start justify-center gap-1.5 rounded-lg border border-dashed border-ink-600 bg-ink-950/40 px-4 py-5">
          <p className="flex items-center gap-2 text-sm font-semibold text-text">
            <Icon name="lock" size={16} className="text-muted" /> Unlocks at Rank {lock}
          </p>
          {unlock && <p className="text-xs leading-relaxed text-muted">{unlock.text}</p>}
        </div>
      ) : (
        <>
          <p className="mt-1 text-xs leading-relaxed text-muted">{info.blurb}</p>
          <dl className="mt-2 grid grid-cols-2 gap-2" aria-label={`${info.name} strength`}>
            {info.facts.map((f) => (
              <div
                key={f.label}
                className={`flex min-w-0 flex-col rounded-lg bg-ink-900/70 px-2.5 py-1.5 ${info.facts.length === 1 ? 'col-span-2' : ''}`}
              >
                <dt className="text-xs leading-snug text-muted">{f.label}</dt>
                <dd
                  className="order-first font-mono text-lg font-bold leading-tight"
                  style={{ color: f.strength > 0 ? look.color : 'var(--color-muted)' }}
                >
                  {f.value}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mb-1.5 mt-3 text-xs font-semibold uppercase tracking-wider text-muted">
            Auras
            {bonus && auraSlots > w.auraSlots && (
              <span className="font-normal normal-case tracking-normal">
                {' '}
                · {bonus.name} adds a {auraSlots === 3 ? 'third' : 'new'} slot: it needs{' '}
                {poolWord(pool)}, and Grace Note helps
              </span>
            )}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {Array.from({ length: auraSlots }, (_, i) => (
              <Slot
                key={i}
                slot={{ chord: index, kind: 'aura', index: i }}
                bonus={isBonusSlot({ chord: index, kind: 'aura', index: i }) ? bonus : null}
                id={chord.auras[i]}
                lock={lock}
                itemLock={
                  chord.auras[i] !== undefined
                    ? itemLockOf(allowance, 'aura', chord.auras[i]!)
                    : null
                }
                isNew={false}
                selected={selected?.kind === 'aura' && selected.index === i}
                onSelect={onSelect}
                onRemove={onRemove}
                note={
                  chord.auras[i] !== undefined
                    ? `reserves ${pct(auraDef(chord.auras[i]!).reserve * n.reserveMult * reserveMult)}`
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
            {Array.from({ length: w.ornamentSlots }, (_, i) => {
              const ref: SlotRef = { chord: index, kind: 'ornament', index: i };
              return (
                <Slot
                  key={i}
                  slot={ref}
                  id={chord.ornaments[i]}
                  lock={slotLock(allowance, ref)}
                  itemLock={
                    chord.ornaments[i] !== undefined
                      ? itemLockOf(allowance, 'ornament', chord.ornaments[i]!)
                      : null
                  }
                  isNew={fresh.has(unlockId({ kind: 'ornamentSlot', index: i }))}
                  selected={selected?.kind === 'ornament' && selected.index === i}
                  onSelect={onSelect}
                  onRemove={onRemove}
                  note={chord.ornaments[i] ? ornamentDef(chord.ornaments[i]!).subtitle : undefined}
                />
              );
            })}
          </div>
          {!empty && (
            <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-xs text-muted">
              <span>
                reserves <b className="text-text">{pct(n.reserve * reserveMult)}</b> of{' '}
                {poolWord(pool)}
              </span>
              {Math.abs(n.effect - 1) > 0.001 && (
                <span className={n.effect > 1 ? 'text-gold-300' : 'text-threat'}>
                  ornaments {mult(n.effect)} strength
                </span>
              )}
            </p>
          )}
          {pedal && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-lime-200">
              <Icon name="pin" size={13} /> Plant it at the cursor with{' '}
              <KeyCap label={bindingLabel('plant')} /> (every {CONTENT.weaver.plantCooldown} s).
            </p>
          )}
          {lock !== null && (
            <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-threat">
              <Icon name="lock" size={13} /> {info.name} unlocks at Rank {lock}: empty it to embark.
            </p>
          )}
        </>
      )}
    </Panel>
  );
}

function Slot({
  slot,
  id,
  lock,
  itemLock = null,
  isNew,
  selected,
  onSelect,
  onRemove,
  note,
  bonus = null,
}: {
  slot: SlotRef;
  /** A slot a Calling added (Third Voice): marked with its glyph and name, full width. */
  bonus?: SlotBonus | null;
  id: string | undefined;
  /** The Rank that opens this slot (null: open). A filled locked slot can still be emptied. */
  lock: number | null;
  /** The Rank that opens the item in it (null: open). */
  itemLock?: number | null;
  isNew: boolean;
  selected: boolean;
  onSelect(ref: SlotRef): void;
  onRemove(ref: SlotRef): void;
  note?: string;
}) {
  const def = id ? (slot.kind === 'aura' ? auraDef(id) : ornamentDef(id)) : null;
  const kindName = slot.kind === 'aura' ? 'aura' : 'ornament';
  const song = songName(slot.chord);
  // A filled slot can hold something the Rank doesn't allow (remembered songs, a reset).
  const locked = def ? Math.max(lock ?? 0, itemLock ?? 0) || null : null;
  const onKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (id && (e.key === 'Delete' || e.key === 'Backspace')) {
      e.preventDefault();
      onRemove(slot);
    }
  };
  if (!def && lock !== null) {
    return (
      <div
        className="flex h-12 w-full items-center gap-1.5 rounded-lg border border-dashed border-ink-600 bg-ink-950/40 px-2.5 text-xs text-muted"
        aria-label={`${song} ${kindName} slot ${slot.index + 1}: unlocks at Rank ${lock}`}
        role="img"
      >
        <Icon name="lock" size={14} /> {slot.kind === 'aura' ? 'Aura' : 'Ornament'} · Rank {lock}
      </div>
    );
  }
  const bonusLook = bonus ? callingLook(bonus.callingId) : null;
  return (
    <div
      className={`relative ${bonus ? 'col-span-2' : ''}`}
      data-bonus-slot={bonus ? '' : undefined}
    >
      {bonus && bonusLook && (
        <span
          className="pointer-events-none absolute -top-2 right-2 z-10 inline-flex items-center gap-1 rounded-md border bg-ink-900 px-1.5 text-[11px] font-semibold leading-4"
          style={{ color: bonusLook.color, borderColor: bonusLook.color }}
          aria-hidden
        >
          <CallingGlyph icon={bonus.icon} size={12} /> {bonus.name}
        </span>
      )}
      <button
        type="button"
        aria-pressed={selected}
        disabled={lock !== null && !def}
        aria-label={
          (def
            ? `${song} ${kindName} slot ${slot.index + 1}: ${def.name}. Select to change, Delete to remove`
            : `${song} ${kindName} slot ${slot.index + 1}: empty. Select to fill`) +
          (bonus ? `. ${bonus.name}’s slot` : '')
        }
        onClick={() => onSelect(slot)}
        onKeyDown={onKey}
        className={`flex h-12 w-full items-center gap-2 rounded-lg border px-2.5 text-left transition-colors ${
          selected && lock === null ? 'ring-2 ring-gold-300' : ''
        } ${def ? 'bg-ink-800' : 'border-dashed bg-ink-900/40 hover:bg-ink-800'} ${locked !== null ? 'border-dashed' : ''}`}
        style={{
          borderColor: def ? def.color : (bonusLook?.color ?? 'var(--color-ink-500)'),
          background:
            bonusLook && !def
              ? `color-mix(in srgb, ${bonusLook.color} 8%, rgb(10 16 34 / 0.6))`
              : undefined,
        }}
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
              {locked !== null ? (
                <span className="flex items-center gap-1 truncate text-xs font-semibold text-threat">
                  <Icon name="lock" size={11} /> Rank {locked}: empty it
                </span>
              ) : (
                note && <span className="block truncate text-xs text-muted">{note}</span>
              )}
            </span>
          </>
        ) : (
          <span className="flex items-center gap-1.5 text-xs text-muted">
            <Icon name="mend" size={14} /> {slot.kind === 'aura' ? 'Aura' : 'Ornament'}
            {isNew && <NewTag />}
          </span>
        )}
      </button>
      {def && (
        <button
          type="button"
          onClick={() => onRemove(slot)}
          aria-label={`Remove ${def.name} from the ${song.toLowerCase()}`}
          className="absolute right-1 top-1 rounded p-0.5 text-muted hover:bg-ink-700 hover:text-rose-300"
          tabIndex={-1}
        >
          <Icon name="close" size={12} />
        </button>
      )}
    </div>
  );
}

interface PaletteItem {
  id: string;
  name: string;
  subtitle: string;
  color: string;
  description: string;
  stat: string;
  warn: string | null;
  /** Rank that opens it (null: open). */
  lock: number | null;
  /** Can't go in this song at all ("Beam song only"). */
  misfit: string | null;
  isNew: boolean;
}

/** Everything that fits the selected slot, with where each item sits now. */
function Palette({
  value,
  selected,
  allowance,
  fresh,
  pool,
  reserveMult,
  onPlace,
  onRemove,
}: {
  value: ChordLoadout[];
  selected: SlotRef;
  allowance: Allowance;
  fresh: ReadonlySet<string>;
  pool: ReservePool;
  /** The Astrolabe's multiplier on the songs' share. */
  reserveMult: number;
  onPlace(id: string): void;
  onRemove(ref: SlotRef): void;
}) {
  const kind: SlotKind = selected.kind;
  const chord = value[selected.chord]!;
  const current = (kind === 'aura' ? chord.auras : chord.ornaments)[selected.index];
  const n = chordNumbers(chord, selected.chord);
  const song = songName(selected.chord);
  const slotLocked = slotLock(allowance, selected) !== null;
  const items: PaletteItem[] =
    kind === 'aura'
      ? CONTENT.auras.map((a) => ({
          id: a.id,
          name: a.name,
          subtitle: a.subtitle,
          color: a.color,
          description: a.description,
          stat: `reserves ${pct(a.reserve * n.reserveMult * reserveMult)}`,
          warn: null,
          lock: itemLockOf(allowance, 'aura', a.id),
          misfit: null,
          isNew: fresh.has(unlockId({ kind: 'aura', id: a.id })),
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
            o.focusMult !== 1 && `beam ${mult(CONTENT.weaver.beamFocus * o.focusMult)}`,
            o.echoMult === 0 && 'no echo',
          ].filter(Boolean);
          return {
            id: o.id,
            name: o.name,
            subtitle: o.subtitle,
            color: o.color,
            description: o.description,
            stat: stats.join(' · '),
            warn: other ? `Can’t share a song with ${ornamentDef(other).name}` : null,
            lock: itemLockOf(allowance, 'ornament', o.id),
            misfit: roleNote(o.id, selected.chord),
            isNew: fresh.has(unlockId({ kind: 'ornament', id: o.id })),
          };
        });
  return (
    <Panel tone="solid" className="flex flex-col p-3.5" aria-labelledby="palette-title">
      <div className="flex items-baseline justify-between gap-2">
        <h3 id="palette-title" className="font-display text-base font-bold text-gold-300">
          {kind === 'aura' ? 'Auras' : 'Ornaments'}
        </h3>
        <span className="text-xs text-muted">
          for the {song.toLowerCase()}, slot {selected.index + 1}
        </span>
      </div>
      <p className="mb-2 text-xs text-muted">
        {kind === 'aura'
          ? selected.chord === 0
            ? `On the beam song, an aura is doubled on whoever you thread. Each reserves ${poolWord(pool)} while sung; you have one of each.`
            : `In the field song, an aura reaches everyone near you. Each reserves ${poolWord(pool)} while sung; you have one of each.`
          : 'An ornament changes both auras in its song. You own one copy of each.'}
      </p>
      {slotLocked && (
        <p className="mb-2 flex items-center gap-1.5 rounded-md bg-ink-900 px-2 py-1 text-xs text-muted">
          <Icon name="lock" size={12} /> This slot is still locked: you can only empty it.
        </p>
      )}
      <ul className="scroll-thin -mr-1 flex max-h-[30rem] flex-col gap-1.5 overflow-y-auto pr-1">
        {items.map((it) => {
          const at = whereIs(value, kind, it.id);
          const here = at?.chord === selected.chord && at.index === selected.index;
          const elsewhere = at && !here ? inSong(at.chord) : null;
          const blocked = !here && (it.lock !== null || it.misfit !== null || slotLocked);
          return (
            <li key={it.id}>
              <button
                type="button"
                aria-pressed={here}
                disabled={blocked}
                onClick={() => (here || blocked ? undefined : onPlace(it.id))}
                aria-label={`${it.name}, ${it.subtitle}. ${it.lock !== null ? `Unlocks at Rank ${it.lock}.` : `${it.stat}.`}${it.misfit ? ` ${it.misfit}.` : ''}${elsewhere ? ` Now ${elsewhere}: choosing moves it.` : ''}${it.warn ? ` ${it.warn}.` : ''}`}
                className={`w-full rounded-lg border px-3 py-2 text-left transition-colors ${
                  here
                    ? 'bg-ink-700'
                    : blocked
                      ? 'cursor-not-allowed bg-ink-950/40'
                      : 'bg-ink-900/70 hover:bg-ink-800'
                }`}
                style={{ borderColor: here ? it.color : 'var(--color-ink-600)' }}
              >
                <span className="flex items-center justify-between gap-2">
                  <span
                    className={`flex items-center gap-1.5 text-sm font-semibold ${it.lock !== null ? 'opacity-55' : ''}`}
                    style={{ color: it.color }}
                  >
                    <Icon
                      name={
                        here
                          ? 'check'
                          : it.lock !== null
                            ? 'lock'
                            : kind === 'aura'
                              ? 'note'
                              : 'diamond'
                      }
                      size={14}
                    />
                    {it.name}
                    <span className="text-xs font-normal text-muted">{it.subtitle}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1">
                    {it.isNew && it.lock === null && <NewTag />}
                    {it.lock !== null && <LockTag rank={it.lock} />}
                    {elsewhere && (
                      <span className="rounded border border-ink-500 px-1.5 text-xs text-muted">
                        {elsewhere}
                      </span>
                    )}
                  </span>
                </span>
                {it.lock === null && it.stat && (
                  <span className="mt-0.5 block font-mono text-xs text-muted">{it.stat}</span>
                )}
                <span
                  className={`mt-0.5 block text-xs leading-relaxed ${it.lock !== null ? 'text-muted' : 'text-text'}`}
                >
                  {it.description}
                </span>
                {it.misfit && it.lock === null && (
                  <span className="mt-1 flex items-center gap-1 text-xs font-medium text-muted">
                    <Icon name="thread" size={12} /> {it.misfit}
                  </span>
                )}
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

/**
 * What pays for the techniques, with Eldritch Conduit (Phase 4): their costs in Life, from the
 * Life she fights with.
 */
function LifeTechniques({ budget: b }: { budget: SpiritBudget }) {
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1" data-testid="techniques-life">
      <span className="flex items-center gap-1.5" style={{ color: LIFE }}>
        <Icon name="heart" size={12} /> Your techniques cost Life:
      </span>
      {b.techniques.map((t) => (
        <span
          key={t.key}
          className={`flex items-center gap-1 ${t.affordable ? 'text-text' : 'text-lethal'}`}
        >
          <Icon name={t.affordable ? 'check' : 'close'} size={12} />
          {t.name} {costText(t.cost)}
        </span>
      ))}
    </li>
  );
}

/** Reserved vs free Spirit, and what the free part buys. */
function BudgetPanel({
  budget: b,
  astrolabe,
}: {
  budget: ReturnType<typeof spiritBudget>;
  astrolabe: readonly string[];
}) {
  const scale = Math.max(b.max, b.reserved);
  const width = (v: number) => `${(v / scale) * 100}%`;
  const ward = b.techniques[0]!;
  const c = CONTENT.chorus;
  // Eldritch Conduit: Spirit is the songs' alone; the techniques cost Life.
  const lifeTech = b.techPool === 'life';
  return (
    <Panel tone="solid" className="p-3.5" aria-label="Spirit budget">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="flex items-center gap-2 text-sm font-semibold text-text">
          Spirit budget
          <AstrolabeShare reserveMult={b.reserveMult} astrolabe={astrolabe} passives={b.passives} />
        </p>
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
          {!lifeTech &&
            b.techniques.map((t) => (
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
        {lifeTech ? (
          <LifeTechniques budget={b} />
        ) : (
          <>
            {b.techniques.map((t) => (
              <li
                key={t.key}
                className={`flex items-center gap-1.5 ${t.affordable ? 'text-text' : 'text-lethal'}`}
              >
                <Icon name={t.affordable ? 'check' : 'close'} size={12} />
                {t.name} {costText(t.cost)}
              </li>
            ))}
            <li className={b.allThree ? 'text-muted' : 'text-threat'}>
              {b.allThree
                ? 'Room for all three back to back'
                : `All three back to back need ${costText(b.techniques.reduce((s, t) => s + t.cost, 0))}`}
            </li>
          </>
        )}
      </ul>
      {!ward.affordable && !lifeTech && (
        <p
          className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-lethal"
          role="status"
        >
          <Icon name="ward" size={14} /> Only {fmt(b.free)} Spirit stays free: you could never cast
          {` ${ward.name}`} ({costText(ward.cost)}).
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

/** Life on the bar, as on the Weaver bar. */
const LIFE = '#fb7185';

/**
 * The Life budget (Phase 3d, a Martyr run): what the songs hold of all her Life (hatched, in
 * the auras' colours), what's left to fight with, the most they may hold (`LIFE_RESERVE_CAP`)
 * and the thresholds her path marks (Blood Font, Low-Life Vigil). Every point of Spirit is
 * free for Ward, Chime and Reel.
 */
function LifeBudgetPanel({
  budget: b,
  marks,
  callingId,
  astrolabe,
}: {
  budget: SpiritBudget;
  marks: LowLifeMark[];
  callingId: string | null;
  astrolabe: readonly string[];
}) {
  const scale = Math.max(b.max, b.reserved);
  const at = (v: number) => `${(v / scale) * 100}%`;
  // The Martyr's blood; Sanguine Font's (Phase 4) on another Calling's run is the Silk's.
  const martyr = callingId === 'martyr';
  const look = martyr ? callingLook(callingId) : CONSTELLATION_LOOK.silk;
  const c = CONTENT.chorus;
  const capPct = Math.round(LIFE_RESERVE_CAP * 100);
  const heldPct = Math.round((b.reserved / b.max) * 100);
  // Prism Covenant: she fights at a share of what the songs leave her.
  const prism = b.lifeCap < 1 ? b.free * b.lifeCap : null;
  return (
    <Panel
      tone="solid"
      className="p-3.5"
      aria-label="Life budget"
      data-testid="life-budget"
      style={{ borderColor: `color-mix(in srgb, ${look.color} 45%, var(--color-ink-600))` }}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <p className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-text">
          <Icon name="drop" size={14} style={{ color: look.color }} /> Life budget
          <span className="font-normal text-muted">· your songs reserve Life, not Spirit</span>
          <AstrolabeShare reserveMult={b.reserveMult} astrolabe={astrolabe} passives={b.passives} />
        </p>
        <p className="font-mono text-xs text-muted">
          <span className={b.over ? 'text-lethal' : ''}>
            {fmt(b.reserved)} held ({heldPct}%)
          </span>{' '}
          · <span style={{ color: LIFE }}>{fmt(b.free)} to fight with</span> of {fmt(b.max)}
        </p>
      </div>
      <div className="relative mt-5">
        <div
          className="relative flex h-6 overflow-hidden rounded-full border border-ink-500 bg-ink-700"
          role="img"
          aria-label={`${fmt(b.free)} of ${fmt(b.max)} Life to fight with; ${b.slices.map((s) => `${s.name} holds ${fmt(s.spirit)}`).join(', ') || 'no auras'}. Your songs may hold at most ${capPct}%.`}
        >
          <div
            className="flex h-full items-center overflow-hidden px-2 text-xs font-semibold text-ink-950 transition-[width] duration-200"
            style={{ width: at(b.free), background: LIFE }}
          >
            <span className="truncate">{fmt(b.free)} Life</span>
          </div>
          {b.slices.map((s) => (
            <div
              key={`${s.chord}${s.id}`}
              className="stripes flex h-full items-center justify-center overflow-hidden border-l border-ink-950 text-xs font-semibold text-ink-950 transition-[width] duration-200"
              style={{ width: at(s.spirit), backgroundColor: s.color }}
              title={`${s.name}: holds ${fmt(s.spirit)} Life`}
            >
              <span className="truncate px-1">{s.name}</span>
            </div>
          ))}
          {b.over && (
            <div
              className="absolute inset-y-0 border-l-2 border-white bg-lethal/70"
              style={{ left: at(b.max - b.reserved), width: at(b.reserved - b.cap) }}
              title="More than your songs may hold"
            />
          )}
        </div>
        {/* The cap: songs may hold at most this much, so she keeps a tenth. */}
        <span
          className="absolute -top-4 bottom-0 border-l-2 border-dashed border-white/70"
          style={{ left: at(b.max - b.cap) }}
          aria-hidden
        >
          <span className="absolute -top-0.5 left-1 whitespace-nowrap font-mono text-[11px] leading-none text-muted">
            ← you keep at least {100 - capPct}%
          </span>
        </span>
        {prism !== null && (
          // Prism Covenant (Phase 4): where she fights, and can't be healed above.
          <span
            className="absolute -bottom-1 -top-1 w-0.5"
            style={{ left: at(prism), background: CONSTELLATION_LOOK.choir.light }}
            title={`Prism Covenant: you fight at ${Math.round(b.lifeCap * 100)}% of it (${fmt(prism)} Life)`}
            data-testid="life-budget-prism"
            aria-hidden
          />
        )}
        {marks.map((m) => {
          const on = b.free < m.below * b.max - 1e-9;
          return (
            <span
              key={m.id}
              className="absolute -bottom-1.5 -top-1.5 w-0.5"
              style={{ left: at(m.below * b.max), background: look.light }}
              title={`${m.name}: below ${Math.round(m.below * 100)}% of your Life`}
              aria-hidden
            >
              <span
                className="absolute -left-2 top-full mt-0.5 flex h-4 w-4 items-center justify-center rounded-full border"
                style={{
                  color: on ? look.light : look.color,
                  borderColor: look.color,
                  background: on ? look.deep : 'var(--color-ink-900)',
                }}
              >
                <CallingGlyph icon={m.icon} size={11} />
              </span>
            </span>
          );
        })}
      </div>
      <ul className={`flex flex-col gap-1 text-xs ${marks.length > 0 ? 'mt-5' : 'mt-2'}`}>
        <li className="flex items-center gap-1.5 text-text">
          <Icon name="heart" size={12} style={{ color: LIFE }} />
          You fight with {fmt(b.free)} Life of {fmt(b.max)}
          {martyr ? `: a Weaver without the Martyr has ${fmt(b.baseLife)}.` : '.'}
          {b.free < b.max * 0.5 && b.reserved > 0 && (
            <span className="text-muted">You start below half your Life.</span>
          )}
        </li>
        {prism !== null && (
          <li
            className="flex items-center gap-1.5"
            style={{ color: CONSTELLATION_LOOK.choir.light }}
          >
            <AstrolabeGlyph glyph="prism_covenant" size={12} />
            Prism Covenant: you fight at {Math.round(b.lifeCap * 100)}% of that ({fmt(prism)} Life)
            and can’t be healed above it.
          </li>
        )}
        {marks.map((m) => {
          const on = b.free < m.below * b.max - 1e-9;
          return (
            <li key={m.id} className="flex items-center gap-1.5" style={{ color: look.light }}>
              <CallingGlyph icon={m.icon} size={12} />
              {m.name} below {Math.round(m.below * 100)}% ({fmt(m.below * b.max)} Life):{' '}
              {on ? 'on from the start with these songs' : 'once you’ve been hurt'}.
            </li>
          );
        })}
        {b.techPool === 'life' ? (
          <LifeTechniques budget={b} />
        ) : (
          <li className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="flex items-center gap-1.5" style={{ color: 'var(--color-spirit)' }}>
              <Icon name="sparkle" size={12} /> All {fmt(b.spirit)} Spirit is free:
            </span>
            {b.techniques.map((t) => (
              <span
                key={t.key}
                className={`flex items-center gap-1 ${t.affordable ? 'text-text' : 'text-lethal'}`}
              >
                <Icon name={t.affordable ? 'check' : 'close'} size={12} />
                {t.name} {costText(t.cost)}
              </span>
            ))}
          </li>
        )}
      </ul>
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
