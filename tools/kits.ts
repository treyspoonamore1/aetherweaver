/**
 * The kits isolated harness cells play with (docs/phase-5a.md, "Bots and harness").
 *
 * Movement I's cells are measured **bare**: the loadout alone, no motifs, no relics, at Threat 1
 * (docs/phase-1.md). A Movement II fight is never met bare: the party arrives through Movement I
 * with motifs and relics. So Movement II's cells play the **arrival kit**: a declared, fixed
 * stand-in for that party, so the bands don't inherit the bots' drafting bias (whole Expeditions
 * remain the real gate). It is the Guardian preset, the Bellwarden scenario's motifs plus four
 * more at levels 1–2, two common relics, and full life (every fight starts at full life).
 */
import { CHORD_PRESETS } from '../src/meta/run';
import type { ChordLoadout } from '../src/meta/types';
import type { SimConfig } from '../src/sim';

export type KitId = 'arrival' | 'bare';

export interface Kit {
  id: KitId;
  name: string;
  /** The preset its Chords come from (a `--loadout` overrides it). */
  preset: string;
  motifs: readonly { id: string; level: number }[];
  relics: readonly string[];
}

/** A party reaching the Crimson Spire: what a run through Movement I typically holds. */
export const ARRIVAL_KIT: Kit = {
  id: 'arrival',
  name: 'arrival kit',
  preset: 'guardian',
  motifs: [
    // The Bellwarden scenario's (tools/scenarios.ts).
    { id: 'deep_roots', level: 2 },
    { id: 'twin_aegis', level: 1 },
    // Four more, levels 1–2.
    { id: 'lifeline', level: 1 },
    { id: 'warm_hum', level: 2 },
    { id: 'clear_tone', level: 1 },
    { id: 'deep_breath', level: 2 },
  ],
  relics: ['silver_thimble', 'tuning_fork'],
};

/** Nothing but the loadout: Movement I's isolated cells (docs/phase-1.md). */
export const BARE_KIT: Kit = {
  id: 'bare',
  name: 'bare',
  preset: 'guardian',
  motifs: [],
  relics: [],
};

export const KITS: Readonly<Record<KitId, Kit>> = { arrival: ARRIVAL_KIT, bare: BARE_KIT };

/** The kit a Movement's isolated cells play by default: bare in Movement I, else arrival. */
export function defaultKit(movement: number): KitId {
  return movement >= 2 ? 'arrival' : 'bare';
}

export function kitById(id: string): Kit {
  const kit = KITS[id as KitId];
  if (!kit) throw new Error(`Unknown kit "${id}" (${Object.keys(KITS)})`);
  return kit;
}

/** A fresh copy of a preset's Chords. */
export function presetChords(id: string): ChordLoadout[] {
  const preset = CHORD_PRESETS.find((p) => p.id === id);
  if (!preset) throw new Error(`Unknown loadout "${id}" (${CHORD_PRESETS.map((p) => p.id)})`);
  return preset.chords.map((c) => ({ auras: [...c.auras], ornaments: [...c.ornaments] }));
}

/**
 * The sim config a kit fights with: its Chords (or `chords`, when a loadout is given), motifs
 * and relics. The bare kit adds no keys beyond the Chords, so Movement I cells are unchanged.
 */
export function kitConfig(
  kit: Kit,
  chords?: readonly ChordLoadout[],
): Pick<SimConfig, 'chords' | 'motifs' | 'relics'> {
  const out: Pick<SimConfig, 'chords' | 'motifs' | 'relics'> = {
    chords: chords
      ? chords.map((c) => ({ auras: [...c.auras], ornaments: [...c.ornaments] }))
      : presetChords(kit.preset),
  };
  if (kit.motifs.length > 0) out.motifs = kit.motifs.map((m) => ({ ...m }));
  if (kit.relics.length > 0) out.relics = [...kit.relics];
  return out;
}
