/**
 * The kits isolated harness cells play with (docs/phase-5a.md, "Bots and harness").
 *
 * Movement I's cells are measured **bare**: the loadout alone, no motifs, no relics, at Threat 1
 * (docs/phase-1.md). A Movement II fight is never met bare: the party arrives through Movement I
 * with motifs and relics. So Movement II's cells play the **arrival kit**: a declared, fixed
 * stand-in for that party, so the bands don't inherit the bots' drafting bias (whole Expeditions
 * remain the real gate). It is the Guardian preset, the Bellwarden scenario's motifs plus four
 * more at levels 1–2, two common relics, and full life (every fight starts at full life).
 *
 * Movement III's cells (docs/phase-5c.md, "Kit") play **ARRIVAL3_KIT**: the arrival kit plus what
 * a party carries out of Movement II, as a floor of what Skilled winners hold at Vharun's
 * interlude (10.2 motifs and 9.1 relics measured): 10 motifs and 6 relics. ARRIVAL_KIT is never
 * edited (3 goldens, the commandSnapshot and the Movement II baseline stand on it).
 *
 * The Finale's cell (docs/phase-5d.md) plays **ARRIVAL4_KIT**, measured the same way at the
 * Unweaver's interlude on the Finale route.
 */
import { CHORD_PRESETS } from '../src/meta/run';
import type { ChordLoadout } from '../src/meta/types';
import type { SimConfig } from '../src/sim';

export type KitId = 'arrival' | 'arrival3' | 'arrival4' | 'bare';

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

/**
 * A party reaching the Abyssal Rift (docs/phase-5c.md, "Kit"): the arrival kit's 6 motifs and
 * 2 relics, plus the motifs and relics Skilled winners most often carry out of Movement II.
 */
export const ARRIVAL3_KIT: Kit = {
  id: 'arrival3',
  name: 'arrival kit III',
  preset: 'guardian',
  motifs: [
    ...ARRIVAL_KIT.motifs,
    { id: 'da_capo', level: 1 },
    { id: 'golden_filament', level: 1 },
    { id: 'second_verse', level: 1 },
    { id: 'standing_ovation', level: 1 },
  ],
  relics: [
    ...ARRIVAL_KIT.relics,
    'star_chart',
    'hollow_bell',
    'cantors_hymnal',
    'choirmasters_baton',
  ],
};

/**
 * A party reaching the Celestial Crucible (docs/phase-5d.md, "Harness"): ARRIVAL3_KIT plus a
 * floor of what Skilled runs carry out of the Unweaver's interlude on the Finale route. Measured
 * with `playRun` (the harness's default loadout, relics on) at the first phase in the Finale,
 * over 200 Skilled seeds (2000 and 900007 + i × 104729; 129 reached it): 12.1 motifs and 10.8
 * relics held. So 12 motifs (ARRIVAL3's 10 and the two most held it lacks: Quickened Verse 71,
 * Long Weave 70) and 8 relics (its 6 and Martyr's Veil 99, the Cracked Metronome 95), a floor
 * as ARRIVAL3's 6 of 9.1 was. No Finale relic: 71 of 129 held one, split three ways (The First
 * Score 29, Tacet Mark 21, Quick Rosin 21). ARRIVAL3_KIT is never edited (4 goldens,
 * commandSnapshotM3 and the Movement III baseline).
 */
export const ARRIVAL4_KIT: Kit = {
  id: 'arrival4',
  name: 'arrival kit IV',
  preset: 'guardian',
  motifs: [
    ...ARRIVAL3_KIT.motifs,
    { id: 'quickened_verse', level: 1 },
    { id: 'long_weave', level: 1 },
  ],
  relics: [...ARRIVAL3_KIT.relics, 'martyrs_veil', 'cracked_metronome'],
};

/** Nothing but the loadout: Movement I's isolated cells (docs/phase-1.md). */
export const BARE_KIT: Kit = {
  id: 'bare',
  name: 'bare',
  preset: 'guardian',
  motifs: [],
  relics: [],
};

export const KITS: Readonly<Record<KitId, Kit>> = {
  arrival: ARRIVAL_KIT,
  arrival3: ARRIVAL3_KIT,
  arrival4: ARRIVAL4_KIT,
  bare: BARE_KIT,
};

/**
 * The kit a Movement's isolated cells play by default: bare in I, arrival in II, arrival3 in III,
 * and arrival4 in the Finale (docs/phase-5d.md) and on.
 */
export function defaultKit(movement: number): KitId {
  return movement >= 4
    ? 'arrival4'
    : movement >= 3
      ? 'arrival3'
      : movement >= 2
        ? 'arrival'
        : 'bare';
}

/** The kit a Movement's isolated cells play by default, itself (`defaultKit`). */
export function kitFor(movement: number): Kit {
  return KITS[defaultKit(movement)];
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
