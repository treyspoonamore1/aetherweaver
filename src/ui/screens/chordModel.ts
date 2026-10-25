/**
 * Pure model behind the Chord builder (Prep and Respite → Retune): slot placement with
 * single-copy auras and ornaments, the Spirit budget and each Chord's resolved numbers.
 * Legality itself always comes from the sim (`chordProblems`), so the UI can't disagree.
 */
import { CONTENT, auraDef, ornamentDef } from '../../content';
import { CHORD_PRESETS } from '../../meta/run';
import {
  canonicalChords,
  chordProblems,
  chordReserve,
  resolveChord,
  type ChordAnchor,
  type ChordLoadout,
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
  anchor: ChordAnchor;
  /** Field radius in metres (0 for Unison, which ignores range). */
  radius: number;
  /** Aura strength multiplier (1 = normal). */
  effect: number;
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
    anchor: r.anchor,
    radius: r.anchor === 'thread' ? 0 : Math.min(w.fieldRadiusCap, w.fieldRadius * r.radiusMult),
    effect: r.effectMult,
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

/** Legality problems as sentences (empty = legal), straight from the sim. */
export function loadoutProblems(chords: readonly ChordLoadout[]): string[] {
  return chordProblems(canonicalChords(chords));
}

/** Short read-out of a Chord's anchor. */
export function anchorLabel(anchor: ChordAnchor): string {
  return anchor === 'thread' ? 'On your Thread' : anchor === 'planted' ? 'Planted' : 'Around you';
}

/** Names for chips and aria labels. */
export function itemName(kind: SlotKind, id: string): string {
  return kind === 'aura' ? auraDef(id).name : ornamentDef(id).name;
}
