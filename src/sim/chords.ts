/**
 * CONTRACT v4 — Chord loadouts (docs/plan/03 §4, docs/phase-3.md): validation, the Spirit
 * budget and the resolved per-Chord numbers. Pure; shared by the sim, the run layer and the
 * Chord builder UI, so all three agree on what a loadout costs and whether it is legal.
 *
 * Loadouts are positional: index 0 is the **beam song** (it rides the Thread: ×2 on the
 * threaded hero, an echo of ×0.75 for everyone else in its field) and index 1 the **field
 * song** (full strength for everyone in its field). A loadout may leave the beam song empty.
 */
import { CONTENT } from '../content';
import type { Content } from '../content/schema';
import type { ChordAnchor, ChordRole } from './state';

/** One Chord as configured: up to `auraSlots` auras sharing up to `ornamentSlots` ornaments. */
export interface ChordLoadout {
  auras: string[];
  ornaments: string[];
}

/** A Chord with its ornaments folded into numbers. */
export interface ChordResolved {
  index: number;
  role: ChordRole;
  auras: string[];
  ornaments: string[];
  anchor: ChordAnchor;
  /** Multiplies each aura's Spirit reservation. */
  reserveMult: number;
  /** Multiplies each aura's effects (before the Crescendo). */
  effectMult: number;
  /** Multiplies the field radius (the beam song's echo, or the field song). */
  radiusMult: number;
  /** Strength on the threaded hero: content `beamFocus` × ornaments for the beam song; 1 for the field song. */
  focus: number;
  /** Strength for everyone else in the field: content `beamEcho` × ornaments for the beam song; 1 for the field song. */
  echo: number;
}

/** Chord I is the beam song; every later Chord is a field song. */
export function chordRole(index: number): ChordRole {
  return index === 0 ? 'beam' : 'field';
}

/** Folds a Chord's ornaments into multipliers and an anchor (unknown ids are skipped). */
export function resolveChord(
  chord: ChordLoadout,
  index: number,
  content: Content = CONTENT,
): ChordResolved {
  const role = chordRole(index);
  let reserveMult = 1;
  let effectMult = 1;
  let radiusMult = 1;
  let focus = role === 'beam' ? content.weaver.beamFocus : 1;
  let echo = role === 'beam' ? content.weaver.beamEcho : 1;
  let anchor: ChordAnchor = 'weaver';
  for (const id of chord.ornaments) {
    const o = content.ornaments.find((d) => d.id === id);
    if (!o) continue;
    reserveMult *= o.reserveMult;
    effectMult *= o.effectMult;
    radiusMult *= o.radiusMult;
    if (role === 'beam') {
      focus *= o.focusMult;
      echo *= o.echoMult;
    }
    if (o.anchor !== 'weaver') anchor = o.anchor;
  }
  return {
    index,
    role,
    auras: [...chord.auras],
    ornaments: [...chord.ornaments],
    anchor,
    reserveMult,
    effectMult,
    radiusMult,
    focus,
    echo,
  };
}

/** Fraction of max Spirit the loadout reserves (can exceed 1 for an illegal loadout). */
export function chordReserve(chords: readonly ChordLoadout[], content: Content = CONTENT): number {
  let total = 0;
  chords.forEach((chord, index) => {
    const r = resolveChord(chord, index, content);
    for (const id of chord.auras) {
      const aura = content.auras.find((a) => a.id === id);
      if (aura) total += aura.reserve * r.reserveMult;
    }
  });
  return total;
}

/** Everything wrong with a loadout, as player-facing sentences. Empty means legal. */
export function chordProblems(
  chords: readonly ChordLoadout[],
  content: Content = CONTENT,
  /**
   * `fieldAuraSlots`: the field song's aura slots, when a Calling adds one (the Luminary's Third
   * Voice). `pool`: what the songs reserve, Spirit or (the Martyr's) Life.
   */
  opts: { fieldAuraSlots?: number; pool?: ReservePool } = {},
): string[] {
  const w = content.weaver;
  const problems: string[] = [];
  if (chords.length > w.chords) problems.push(`You can sing at most ${w.chords} songs.`);
  const seenAuras = new Set<string>();
  const seenOrnaments = new Set<string>();
  chords.forEach((chord, i) => {
    const label = `The ${songName(i).toLowerCase()}`;
    const slots = i === 1 ? (opts.fieldAuraSlots ?? w.auraSlots) : w.auraSlots;
    if (chord.auras.length > slots) problems.push(`${label} holds at most ${slots} auras.`);
    if (chord.ornaments.length > w.ornamentSlots)
      problems.push(`${label} holds at most ${w.ornamentSlots} ornaments.`);
    if (chord.ornaments.length > 0 && chord.auras.length === 0)
      problems.push(`${label} has ornaments but no aura for them to change.`);
    const role = chordRole(i);
    for (const id of chord.auras) {
      const def = content.auras.find((a) => a.id === id);
      if (!def) problems.push(`Unknown aura "${id}".`);
      else if (seenAuras.has(id)) problems.push(`${def.name} can only be in one song.`);
      seenAuras.add(id);
    }
    for (const id of chord.ornaments) {
      const def = content.ornaments.find((o) => o.id === id);
      if (!def) {
        problems.push(`Unknown ornament "${id}".`);
        continue;
      }
      if (seenOrnaments.has(id)) problems.push(`You own one ${def.name}: it fits one song.`);
      seenOrnaments.add(id);
      if (!def.roles.includes(role))
        problems.push(
          `${def.name} only fits the ${songName(def.roles[0] === 'beam' ? 0 : 1).toLowerCase()}.`,
        );
      for (const other of chord.ornaments) {
        if (other === id || id > other) continue;
        // Either side may declare the exclusion.
        const o = content.ornaments.find((d) => d.id === other);
        if (def.excludes.includes(other) || o?.excludes.includes(id))
          problems.push(`${def.name} and ${o?.name ?? other} can't share a song.`);
      }
    }
  });
  if (opts.pool === 'life') {
    if (chordReserve(chords, content) > LIFE_RESERVE_CAP + 1e-9)
      problems.push('Your songs would leave you less than a tenth of your Life.');
  } else if (chordReserve(chords, content) > 1 + 1e-9)
    problems.push('Your songs reserve more Spirit than you have.');
  return problems;
}

/** What the songs reserve: Spirit, or Life on a Martyr run (docs/phase-3d.md). */
export type ReservePool = 'spirit' | 'life';

/** The most Life songs may reserve: the Weaver keeps at least a tenth of it. */
export const LIFE_RESERVE_CAP = 0.9;

/** "Chord I", "Chord II"… */
export function chordLabel(index: number): string {
  return `Chord ${['I', 'II', 'III', 'IV'][index] ?? String(index + 1)}`;
}

/** "Beam song", "Field song" (later Chords fall back to their numeral). */
export function songName(index: number): string {
  if (index === 0) return 'Beam song';
  if (index === 1) return 'Field song';
  return chordLabel(index);
}

/**
 * Copies the arrays and drops trailing empty Chords (the canonical form stored in configs and
 * saves). Positions are kept: an empty beam song before a field song stays.
 */
export function canonicalChords(chords: readonly ChordLoadout[]): ChordLoadout[] {
  const out = chords.map((c) => ({ auras: [...c.auras], ornaments: [...c.ornaments] }));
  while (out.length > 0 && out[out.length - 1]!.auras.length === 0) {
    if (out[out.length - 1]!.ornaments.length > 0) break;
    out.pop();
  }
  return out;
}
