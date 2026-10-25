/**
 * CONTRACT v3 — Chord loadouts (docs/plan/03 §4): validation, the Spirit budget and the
 * resolved per-Chord numbers. Pure; shared by the sim, the run layer and the Chord builder UI,
 * so all three agree on what a loadout costs and whether it is legal.
 */
import { CONTENT } from '../content';
import type { Content } from '../content/schema';
import type { ChordAnchor } from './state';

/** One Chord as configured: up to `auraSlots` auras sharing up to `ornamentSlots` ornaments. */
export interface ChordLoadout {
  auras: string[];
  ornaments: string[];
}

/** A Chord with its ornaments folded into numbers. */
export interface ChordResolved {
  index: number;
  auras: string[];
  ornaments: string[];
  anchor: ChordAnchor;
  /** Multiplies each aura's Spirit reservation. */
  reserveMult: number;
  /** Multiplies each aura's effects (before the Crescendo). */
  effectMult: number;
  /** Multiplies the field radius (meaningless for Unison). */
  radiusMult: number;
}

/** Folds a Chord's ornaments into multipliers and an anchor (unknown ids are skipped). */
export function resolveChord(
  chord: ChordLoadout,
  index: number,
  content: Content = CONTENT,
): ChordResolved {
  let reserveMult = 1;
  let effectMult = 1;
  let radiusMult = 1;
  let anchor: ChordAnchor = 'weaver';
  for (const id of chord.ornaments) {
    const o = content.ornaments.find((d) => d.id === id);
    if (!o) continue;
    reserveMult *= o.reserveMult;
    effectMult *= o.effectMult;
    radiusMult *= o.radiusMult;
    if (o.anchor !== 'weaver') anchor = o.anchor;
  }
  return {
    index,
    auras: [...chord.auras],
    ornaments: [...chord.ornaments],
    anchor,
    reserveMult,
    effectMult,
    radiusMult,
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
): string[] {
  const w = content.weaver;
  const problems: string[] = [];
  if (chords.length > w.chords) problems.push(`You can sing at most ${w.chords} Chords.`);
  const seenAuras = new Set<string>();
  const seenOrnaments = new Set<string>();
  chords.forEach((chord, i) => {
    const label = chordLabel(i);
    if (chord.auras.length > w.auraSlots)
      problems.push(`${label} holds at most ${w.auraSlots} auras.`);
    if (chord.ornaments.length > w.ornamentSlots)
      problems.push(`${label} holds at most ${w.ornamentSlots} ornaments.`);
    if (chord.ornaments.length > 0 && chord.auras.length === 0)
      problems.push(`${label} has ornaments but no aura for them to change.`);
    for (const id of chord.auras) {
      const def = content.auras.find((a) => a.id === id);
      if (!def) problems.push(`Unknown aura "${id}".`);
      else if (seenAuras.has(id)) problems.push(`${def.name} can only be in one Chord.`);
      seenAuras.add(id);
    }
    for (const id of chord.ornaments) {
      const def = content.ornaments.find((o) => o.id === id);
      if (!def) {
        problems.push(`Unknown ornament "${id}".`);
        continue;
      }
      if (seenOrnaments.has(id)) problems.push(`You own one ${def.name}: it fits one Chord.`);
      seenOrnaments.add(id);
      for (const other of chord.ornaments) {
        if (other === id || id > other) continue;
        // Either side may declare the exclusion.
        const o = content.ornaments.find((d) => d.id === other);
        if (def.excludes.includes(other) || o?.excludes.includes(id))
          problems.push(`${def.name} and ${o?.name ?? other} can't share a Chord.`);
      }
    }
  });
  if (chordReserve(chords, content) > 1 + 1e-9)
    problems.push('Your Chords reserve more Spirit than you have.');
  return problems;
}

/** "Chord I", "Chord II"… */
export function chordLabel(index: number): string {
  return `Chord ${['I', 'II', 'III', 'IV'][index] ?? String(index + 1)}`;
}

/** Drops empty Chords and copies the arrays (the canonical form stored in configs and saves). */
export function canonicalChords(chords: readonly ChordLoadout[]): ChordLoadout[] {
  return chords
    .filter((c) => c.auras.length > 0 || c.ornaments.length > 0)
    .map((c) => ({ auras: [...c.auras], ornaments: [...c.ornaments] }));
}
