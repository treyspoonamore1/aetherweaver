/**
 * Pure model behind the Chord builder (Prep and Respite → Retune): slot placement with
 * single-copy auras and ornaments, the Spirit budget, each song's resolved numbers, and what
 * the player's Rank keeps locked. Legality always comes from the sim (`chordProblems`) and
 * locks from the profile (`lockedProblems`), so the UI can't disagree with either.
 */
import { CONTENT, auraDef, ornamentDef } from '../../content';
import {
  EVERYTHING,
  UNLOCKS,
  lockedProblems,
  rankOf,
  unlockRank,
  type Allowance,
  type Unlock,
} from '../../meta/profile';
import { CHORD_PRESETS } from '../../meta/run';
import {
  canonicalChords,
  chordProblems,
  chordReserve,
  chordRole,
  resolveChord,
  songName,
  type ChordAnchor,
  type ChordLoadout,
  type ChordRole,
} from '../../sim';

export type SlotKind = 'aura' | 'ornament';

export interface SlotRef {
  chord: number;
  kind: SlotKind;
  index: number;
}

const listOf = (c: ChordLoadout, kind: SlotKind) => (kind === 'aura' ? c.auras : c.ornaments);

/** Exactly `count` Chords (empty ones appended), copied. */
export function padChords(
  chords: readonly ChordLoadout[],
  count: number = CONTENT.weaver.chords,
): ChordLoadout[] {
  const out = chords
    .slice(0, count)
    .map((c) => ({ auras: [...c.auras], ornaments: [...c.ornaments] }));
  while (out.length < count) out.push({ auras: [], ornaments: [] });
  return out;
}

/** Where an aura or ornament currently sits (each exists once). */
export function whereIs(
  chords: readonly ChordLoadout[],
  kind: SlotKind,
  id: string,
): { chord: number; index: number } | null {
  for (let chord = 0; chord < chords.length; chord++) {
    const index = listOf(chords[chord]!, kind).indexOf(id);
    if (index >= 0) return { chord, index };
  }
  return null;
}

/**
 * Puts `id` into the slot: it leaves wherever it was (you own one copy), replaces what was
 * in the slot, or fills the next free slot of that Chord.
 */
export function placeItem(
  chords: readonly ChordLoadout[],
  ref: SlotRef,
  id: string,
): ChordLoadout[] {
  const next = padChords(chords, Math.max(chords.length, ref.chord + 1));
  const from = whereIs(next, ref.kind, id);
  const target = listOf(next[ref.chord]!, ref.kind);
  if (from && from.chord === ref.chord) {
    // Moving inside its own Chord: swap with the slot's occupant.
    const occupant = target[ref.index];
    if (occupant === undefined) {
      target.splice(from.index, 1);
      target.push(id);
    } else {
      target[from.index] = occupant;
      target[ref.index] = id;
    }
    return next;
  }
  if (from) listOf(next[from.chord]!, ref.kind).splice(from.index, 1);
  if (ref.index < target.length) target[ref.index] = id;
  else target.push(id);
  return next;
}

/** Empties a slot (later slots shift up). */
export function removeItem(chords: readonly ChordLoadout[], ref: SlotRef): ChordLoadout[] {
  const next = padChords(chords, Math.max(chords.length, ref.chord + 1));
  const list = listOf(next[ref.chord]!, ref.kind);
  if (ref.index < list.length) list.splice(ref.index, 1);
  return next;
}

/** The two loadouts are the same once empty Chords are dropped. */
export function sameLoadout(a: readonly ChordLoadout[], b: readonly ChordLoadout[]): boolean {
  return JSON.stringify(canonicalChords(a)) === JSON.stringify(canonicalChords(b));
}

export function presetFor(chords: readonly ChordLoadout[]): (typeof CHORD_PRESETS)[number] | null {
  return CHORD_PRESETS.find((p) => sameLoadout(p.chords, chords)) ?? null;
}

export interface ChordNumbers {
  role: ChordRole;
  anchor: ChordAnchor;
  /** Field radius in metres: the beam song's echo or the field song (0 = no echo, Unison). */
  radius: number;
  /** Ornaments' strength multiplier (1 = normal; Grace Note and Reverb lower it). */
  effect: number;
  /** The beam song on your threaded hero: content `beamFocus` × ornaments (Unison raises it). 1 for the field song. */
  focus: number;
  /** Everyone else in the field: the beam song's echo (content `beamEcho` × ornaments; Unison 0); 1 for the field song. */
  echo: number;
  /** Reservation multiplier. */
  reserveMult: number;
  /** Spirit fraction this Chord reserves. */
  reserve: number;
}

export function chordNumbers(chord: ChordLoadout, index: number): ChordNumbers {
  const r = resolveChord(chord, index);
  const w = CONTENT.weaver;
  let reserve = 0;
  for (const id of chord.auras) {
    const a = CONTENT.auras.find((x) => x.id === id);
    if (a) reserve += a.reserve * r.reserveMult;
  }
  return {
    role: r.role,
    anchor: r.anchor,
    radius: r.echo > 0 ? Math.min(w.fieldRadiusCap, w.fieldRadius * r.radiusMult) : 0,
    effect: r.effectMult,
    focus: r.focus,
    echo: r.echo,
    reserveMult: r.reserveMult,
    reserve,
  };
}

export interface BudgetSlice {
  chord: number;
  id: string;
  name: string;
  color: string;
  /** Spirit points reserved. */
  spirit: number;
}

export interface SpiritBudget {
  max: number;
  /** Spirit reserved by auras (may exceed max for an illegal loadout). */
  reserved: number;
  /** Left for techniques (never negative). */
  free: number;
  over: boolean;
  slices: BudgetSlice[];
  /** Technique costs against the free Spirit. */
  techniques: { key: 'ward' | 'chime' | 'reel'; name: string; cost: number; affordable: boolean }[];
  wardAffordable: boolean;
  /** Ward + Chime + Reel back to back fits. */
  allThree: boolean;
  /** Total auras across Chords (3+ releases a chorus pulse on every Cue). */
  auraCount: number;
  chorus: boolean;
}

export function spiritBudget(chords: readonly ChordLoadout[]): SpiritBudget {
  const max = CONTENT.weaver.maxSpirit;
  const slices: BudgetSlice[] = [];
  chords.forEach((c, chord) => {
    const r = resolveChord(c, chord);
    for (const id of c.auras) {
      const a = CONTENT.auras.find((x) => x.id === id);
      if (a)
        slices.push({
          chord,
          id,
          name: a.name,
          color: a.color,
          spirit: max * a.reserve * r.reserveMult,
        });
    }
  });
  const reserved = max * chordReserve(canonicalChords(chords));
  const free = Math.max(0, max - reserved);
  const t = CONTENT.techniques;
  const techniques = (['ward', 'chime', 'reel'] as const).map((key) => ({
    key,
    name: t[key].name,
    cost: t[key].cost,
    affordable: free + 1e-9 >= t[key].cost,
  }));
  const auraCount = slices.length;
  return {
    max,
    reserved,
    free,
    over: reserved > max + 1e-9,
    slices,
    techniques,
    wardAffordable: techniques[0]!.affordable,
    allThree: free + 1e-9 >= techniques.reduce((s, x) => s + x.cost, 0),
    auraCount,
    chorus: auraCount >= CONTENT.chorus.minAuras,
  };
}

/**
 * Everything that stops a draft from being sung, as sentences (empty = it can be sung): the
 * sim's legality first, then whatever the player's Rank hasn't unlocked yet.
 */
export function loadoutProblems(
  chords: readonly ChordLoadout[],
  allowance: Allowance = EVERYTHING,
  /** The field song's aura slots: `Run.fieldAuraSlots(run)` (the Luminary's Third Voice adds one). */
  fieldAuraSlots: number = CONTENT.weaver.auraSlots,
): string[] {
  const canon = canonicalChords(chords);
  return [
    ...chordProblems(canon, CONTENT, { fieldAuraSlots }),
    ...lockedProblems(canon, allowance),
  ];
}

/**
 * Aura slots a song holds: the content's for the beam song, `fieldAuraSlots` for the field
 * song (index 1), as the sim's `chordProblems` counts them.
 */
export function auraSlotsFor(
  index: number,
  fieldAuraSlots: number = CONTENT.weaver.auraSlots,
): number {
  return index === 1 ? fieldAuraSlots : CONTENT.weaver.auraSlots;
}

/** Is this aura slot one a Calling added (beyond the content's slots)? */
export function isBonusSlot(ref: SlotRef): boolean {
  return ref.kind === 'aura' && ref.chord === 1 && ref.index >= CONTENT.weaver.auraSlots;
}

/** Short read-out of where a song's field sits. */
export function anchorLabel(anchor: ChordAnchor): string {
  return anchor === 'planted' ? 'Planted' : 'Around you';
}

/** "×2", "×0.75", "×1.8". */
export function mult(v: number): string {
  return `×${Number(v.toFixed(2))}`;
}

// ── The two songs ─────────────────────────────────────────────────────────────────────

export interface SongFact {
  /** "Your threaded hero", "Everyone else within 8 m"… */
  label: string;
  /** "×2", "No echo". */
  value: string;
  /** Strength after ornaments (0 = nothing reaches them). */
  strength: number;
}

export interface SongInfo {
  index: number;
  role: ChordRole;
  /** "Beam song" / "Field song". */
  name: string;
  /** One line: what the song does. */
  blurb: string;
  /** The numbers that matter, in the order they're read. */
  facts: SongFact[];
}

/**
 * What a song does with its numbers, for the builder's headings. The beam song: its focus on
 * your threaded hero and an echo for everyone else in its field; the field song: full
 * strength for everyone in its field. Numbers come from `resolveChord`, ornaments included.
 */
export function songInfo(chord: ChordLoadout, index: number): SongInfo {
  const n = chordNumbers(chord, index);
  const radius = `${Number(n.radius.toFixed(1))} m`;
  const where =
    n.anchor === 'planted' ? `within ${radius} of where you plant it` : `within ${radius}`;
  if (n.role === 'beam') {
    const focus = n.focus * n.effect;
    const echo = n.echo * n.effect;
    return {
      index,
      role: 'beam',
      name: songName(index),
      blurb:
        n.echo > 0
          ? `Rides your Thread: the hero you thread hears it at ${mult(n.focus)}, wherever they are. Everyone else near you hears an echo.`
          : `All in: it pours into the hero you thread at ${mult(n.focus)}, and nobody else hears an echo.`,
      facts: [
        { label: 'Your threaded hero', value: mult(focus), strength: focus },
        n.echo > 0
          ? { label: `Everyone else ${where}`, value: `echo ${mult(echo)}`, strength: echo }
          : { label: 'Everyone else', value: 'No echo', strength: 0 },
      ],
    };
  }
  const strength = n.effect;
  return {
    index,
    role: 'field',
    name: songName(index),
    blurb: 'Surrounds you: everyone near you hears it at full strength.',
    facts: [{ label: `Everyone ${where}`, value: mult(strength), strength }],
  };
}

// ── Locks (Weaver Rank) ───────────────────────────────────────────────────────────────

/** Which Rank opens a song ('beam' | 'field'), or null if this allowance already has it. */
export function songLock(allowance: Allowance, index: number): number | null {
  if (allowance.all || index < allowance.songs) return null;
  return unlockRank('song', chordRole(index));
}

/** Which Rank opens a slot, or null if it's open (aura slots follow their song). */
export function slotLock(allowance: Allowance, ref: SlotRef): number | null {
  const song = songLock(allowance, ref.chord);
  if (song !== null) return song;
  if (ref.kind === 'ornament' && !allowance.all && ref.index >= allowance.ornamentSlots)
    return unlockRank('ornamentSlot', String(ref.index + 1));
  return null;
}

/** Which Rank opens an aura or ornament, or null if it's open. */
export function itemLock(allowance: Allowance, kind: SlotKind, id: string): number | null {
  if (allowance.all) return null;
  const open = kind === 'aura' ? allowance.auras : allowance.ornaments;
  return open.has(id) ? null : unlockRank(kind, id);
}

/** Which Rank opens a preset (null: it can be applied now). */
export function presetLock(
  preset: (typeof CHORD_PRESETS)[number],
  allowance: Allowance,
): number | null {
  return lockedProblems(preset.chords, allowance).length === 0 ? null : preset.rank;
}

/** An ornament that only fits some songs ("Beam song only"), or null. */
export function roleNote(id: string, index: number): string | null {
  const def = ornamentDef(id);
  if (def.roles.includes(chordRole(index))) return null;
  return `${songName(def.roles[0] === 'beam' ? 0 : 1)} only`;
}

/**
 * Unlocks the player has reached but not been introduced to yet (Prep marks them "New").
 * With Skip the unlocks on, only what the Rank itself reached counts: the rest isn't news.
 */
export function freshUnlocks(xp: number, introduced: readonly string[]): Unlock[] {
  const rank = rankOf(xp);
  const seen = new Set(introduced);
  return UNLOCKS.filter((u) => u.rank <= rank && !seen.has(u.id));
}

/** The unlock id behind a slot or an item, to look it up in the "New" set. */
export function unlockId(
  what:
    | { kind: 'song'; index: number }
    | { kind: 'ornamentSlot'; index: number }
    | { kind: SlotKind; id: string },
): string {
  if (what.kind === 'song') return `song.${chordRole(what.index)}`;
  if (what.kind === 'ornamentSlot') return `ornamentSlot.${what.index + 1}`;
  return `${what.kind}.${what.id}`;
}

/** Names for chips and aria labels. */
export function itemName(kind: SlotKind, id: string): string {
  return kind === 'aura' ? auraDef(id).name : ornamentDef(id).name;
}
