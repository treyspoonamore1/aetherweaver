/**
 * Pure model behind the Chord builder (Prep and Respite → Retune): slot placement with
 * single-copy auras and ornaments, the Spirit budget (Life on a Martyr run), each song's
 * resolved numbers, and what the player's Rank keeps locked. Legality always comes from the sim (`chordProblems`) and
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
import { CHORD_PRESETS, reservePool } from '../../meta/run';
import type { RunState } from '../../meta/types';
import { rewindsFor, techniqueName } from './callingText';
import { slotCost as variantSlotCost, slotName } from './variantsModel';
import {
  treeLifeCap,
  treeLifeMult,
  treeTechCostMult,
  treeTechniquesCostLife,
} from './astrolabeModel';
import {
  LIFE_RESERVE_CAP,
  canonicalChords,
  chordProblems,
  chordReserve,
  chordRole,
  resolveChord,
  songName,
  type ChordAnchor,
  type ChordLoadout,
  type ChordRole,
  type Passive,
  type ReservePool,
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
  /** Points reserved from the pool (Spirit, or the Martyr's Life). */
  spirit: number;
}

export interface SpiritBudget {
  /** What the songs reserve from: Spirit, or (the Martyr's, Sanguine Font's) Life. */
  pool: ReservePool;
  /** The whole pool: max Spirit, or all of her Life. */
  max: number;
  /** The most the songs may hold (Spirit: all of it; Life: `LIFE_RESERVE_CAP` of it). */
  cap: number;
  /** Reserved by auras (may exceed `cap` for an illegal loadout). */
  reserved: number;
  /** What's left: Spirit for techniques, or the Life she fights with (never negative). */
  free: number;
  over: boolean;
  slices: BudgetSlice[];
  /**
   * Technique costs (the tree's Economy included) against what pays them: the free Spirit (all
   * of it when the songs hold Life), or her Life with Eldritch Conduit.
   */
  techniques: { key: 'ward' | 'chime' | 'reel'; name: string; cost: number; affordable: boolean }[];
  /** What techniques are paid from (Phase 4: Life with Eldritch Conduit). */
  techPool: ReservePool;
  /** The Spirit techniques draw on: `free` for Spirit, all of it when the songs hold Life. */
  spirit: number;
  wardAffordable: boolean;
  /** Ward + Chime + Reel back to back fits. */
  allThree: boolean;
  /** Total auras across Chords (3+ releases a chorus pulse on every Cue). */
  auraCount: number;
  chorus: boolean;
  /** Life only: a Weaver without the Martyr's Life (content `maxLife`), to compare against. */
  baseLife: number;
  /**
   * Phase 4: the Astrolabe's (and the carried relics') multiplier on the songs' share
   * (`Run.reserveMult(run)`; 1 without either): 0.86 reads "−14% from the Astrolabe".
   */
  reserveMult: number;
  /** Phase 4c: the carried relics' passives, so the share can say what's theirs. */
  passives: readonly Passive[];
  /** Prism Covenant: the share of what's left she fights at and can be healed to (1: all). */
  lifeCap: number;
  /** Her whole Life, the tree's included, whatever the songs hold (the Life techniques cost). */
  weaverLife: number;
}

/**
 * The Weaver's whole Life on a run with this Calling and tree: content `maxLife`, grown by the
 * Calling's `life` value (the Martyr's passive) and the tree's Blood (the sim's `lifeMult`).
 * The UI tests check it against a real sim's `WeaverComponent.maxLife`.
 */
export function weaverLifeFor(
  callingId: string | null | undefined,
  astrolabe: readonly string[] = [],
  /** The carried relics' passives (docs/phase-4c.md): Vigor adds to the tree's Blood. */
  passives: readonly Passive[] = [],
): number {
  const base = CONTENT.weaver.maxLife;
  const def = callingId ? CONTENT.callings.find((c) => c.id === callingId) : undefined;
  return base * (1 + (def?.values.life ?? 0) / 100) * treeLifeMult(astrolabe, passives);
}

/**
 * The songs' budget: reserved against free, for Spirit (the content's `maxSpirit`) or, when the
 * songs hold Life (the Martyr, Sanguine Font), for Life (`weaverLifeFor`, capped at
 * `LIFE_RESERVE_CAP`). Shares come from the sim's `chordReserve` times the tree's `reserveMult`
 * (`Run.reserveMult`), so the numbers match what the fight will hold.
 */
export function spiritBudget(
  chords: readonly ChordLoadout[],
  pool: ReservePool = 'spirit',
  callingId: string | null = null,
  /**
   * Phase 4: the run's tree (`run.astrolabe`) and its multiplier on the songs (`Run.reserveMult`);
   * Phase 4c: the carried relics' passives (`Run.carriedPassives`).
   */
  tree: {
    reserveMult?: number;
    astrolabe?: readonly string[];
    passives?: readonly Passive[];
    /** Phase 4f: the run's technique variants (`run.techniques`): their names and costs. */
    techniques?: Partial<Record<'ward' | 'chime' | 'reel' | 'glide', string | null>>;
  } = {},
): SpiritBudget {
  const mult = tree.reserveMult ?? 1;
  const astrolabe = tree.astrolabe ?? [];
  const passives = tree.passives ?? [];
  const life = pool === 'life';
  const weaverLife = weaverLifeFor(callingId, astrolabe, passives);
  const max = life ? weaverLife : CONTENT.weaver.maxSpirit;
  const cap = life ? max * LIFE_RESERVE_CAP : max;
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
          spirit: max * a.reserve * r.reserveMult * mult,
        });
    }
  });
  const reserved = max * chordReserve(canonicalChords(chords)) * mult;
  const free = Math.max(0, max - reserved);
  const spirit = life ? CONTENT.weaver.maxSpirit : free;
  const lifeCap = treeLifeCap(astrolabe);
  // Eldritch Conduit: techniques cost Life, paid from what she fights with (never her last).
  const techPool: ReservePool = treeTechniquesCostLife(astrolabe) ? 'life' : 'spirit';
  const payWith = techPool === 'life' ? (life ? free : weaverLife) * lifeCap - 1 : spirit;
  const costMult = treeTechCostMult(astrolabe, passives);
  // On a Chronomancer run Reel's slot is Rewind (same cost): it reads as Rewind (Phase 3e).
  // Phase 4f: a slot's variant by its name, at its own cost (Chorale's), Rewind's aside.
  const chosen = tree.techniques ?? {};
  const techniques = (['ward', 'chime', 'reel'] as const).map((key) => {
    const rewind = key === 'reel' && rewindsFor(callingId);
    const variant = rewind ? null : (chosen[key] ?? null);
    const cost = (variantSlotCost(key, variant) ?? 0) * costMult;
    return {
      key,
      name: rewind ? techniqueName(key, callingId) : slotName(key, variant),
      cost,
      affordable: payWith + 1e-9 >= cost,
    };
  });
  const auraCount = slices.length;
  return {
    pool,
    max,
    cap,
    reserved,
    free,
    over: reserved > cap + 1e-9,
    slices,
    techniques,
    techPool,
    spirit,
    wardAffordable: techniques[0]!.affordable,
    allThree: payWith + 1e-9 >= techniques.reduce((s, x) => s + x.cost, 0),
    auraCount,
    chorus: auraCount >= CONTENT.chorus.minAuras,
    baseLife: CONTENT.weaver.maxLife,
    reserveMult: mult,
    passives,
    lifeCap,
    weaverLife,
  };
}

/** A technique's cost as the builder prints it ("20", "18.4"). */
export function costText(cost: number): string {
  return String(Number(cost.toFixed(1)));
}

/**
 * What powers what, for Prep's blurb: Spirit for the techniques, unless the songs hold Life
 * (the Martyr, Sanguine Font) or the techniques cost it (Eldritch Conduit).
 */
export function poolBlurb(run: RunState): string {
  const reel = techniqueName('reel', run.calling?.id);
  const lifeTech = treeTechniquesCostLife(run.astrolabe);
  if (reservePool(run) === 'life') {
    const who =
      run.calling?.id === 'martyr' ? 'As the Martyr, your auras' : 'With Sanguine Font, your auras';
    return lifeTech
      ? `${who} reserve Life instead, and with Eldritch Conduit your techniques cost Life too: you fight with the Life your songs leave you.`
      : `${who} reserve Life instead: every point of Spirit powers Ward, Chime and ${reel}, and you fight with the Life your songs leave you.`;
  }
  return lifeTech
    ? `With Eldritch Conduit, Ward, Chime and ${reel} cost Life instead: your Spirit is your songs’ alone.`
    : `Whatever Spirit your auras leave free powers Ward, Chime and ${reel}.`;
}

/** "Spirit" or "Life": the word for what the songs reserve. */
export function poolWord(pool: ReservePool): 'Spirit' | 'Life' {
  return pool === 'life' ? 'Life' : 'Spirit';
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
  /** What the songs reserve: `Run.reservePool(run)` (Life on a Martyr run, at most 90%). */
  pool: ReservePool = 'spirit',
  /** Phase 4: the tree's multiplier on the songs' share: `Run.reserveMult(run)`. */
  reserveMult = 1,
): string[] {
  const canon = canonicalChords(chords);
  return [
    ...chordProblems(canon, CONTENT, { fieldAuraSlots, pool, reserveMult }),
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
